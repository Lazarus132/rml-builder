"use strict";

// Runtime Graph interface, rendering, interactions and shared host state.

const RML_GRAPH_VISUAL_TEST =
    new URLSearchParams(window.location.search).has("rmlTourTest") ||
    window.location.hash.includes("rmlTourTest");

const RML_GRAPH_REQUESTED_TEST_STORAGE_SCOPE =
    new URLSearchParams(window.location.search).get("rmlTourStorageKey") || "";

const RML_GRAPH_TEST_STORAGE_SCOPE =
    /^rml-configuration-builder-visual-test-[a-z0-9._-]+$/i.test(
      RML_GRAPH_REQUESTED_TEST_STORAGE_SCOPE
    )
      ? RML_GRAPH_REQUESTED_TEST_STORAGE_SCOPE
      : "rml-configuration-builder-visual-test-default";

const GRAPH_GRID = 12;

const GRAPH_AUTOPAN_EDGE = 54;

const GRAPH_AUTOPAN_MAX_SPEED = 24;

const GRAPH_NODE_MIN_BODY_HEIGHT = 48;

const GRAPH_WIRE_DRAG_THRESHOLD = 4;

const GRAPH_NODE_DRAG_THRESHOLD = 3;

const GRAPH_WIRE_POINT_SNAP = 6;

const GRAPH_WIRE_POINT_REUSE_DISTANCE = 18;

const GRAPH_WIRE_PATH_SAMPLES = 36;

const GRAPH_SVG_COMPATIBILITY_LIMIT = 700;

const GRAPH_DOM_VIRTUALIZATION_THRESHOLD = 240;

const GRAPH_FALLBACK_MAX_DETAILED_NODES = 220;

const GRAPH_FALLBACK_MAX_SVG_CONNECTIONS = 600;

const GRAPH_EAGER_CONNECTION_TARGET_NODE_LIMIT = 180;

const GRAPH_EAGER_CONNECTION_TARGET_WIRE_LIMIT = 400;

let runtimeGraphStylePromise = null;

let runtimeGraphStyleActivationQueued = false;

let runtimeGraphStyleFailureReported = false;

let runtimeGraphStyleTransitionPending = false;

function runtimeGraphStylesLoaded() {
    const stylesLoaded =
      window.RMLStyleLoader
        ?.isLoaded?.("runtime-graph") === true;
    const scriptsLoaded =
      window.RMLScriptLoader
        ?.isLoaded?.("runtime-view") === true ||
      typeof window.RMLGraphHybridRenderer
        ?.create === "function";
    return stylesLoaded && scriptsLoaded;
  }

function ensureRuntimeGraphStyles() {
    if (runtimeGraphStylesLoaded()) {
      return Promise.resolve(true);
    }
    if (runtimeGraphStylePromise) {
      return runtimeGraphStylePromise;
    }
    const styleLoader = window.RMLStyleLoader;
    const scriptLoader = window.RMLScriptLoader;
    if (
      !styleLoader?.ensure ||
      (
        !scriptLoader?.ensure &&
        typeof window.RMLGraphHybridRenderer
          ?.create !== "function"
      )
    ) {
      return Promise.reject(
        new Error("The deferred Runtime Graph asset loader is unavailable.")
      );
    }
    runtimeGraphStylePromise = Promise
      .resolve()
      .then(() =>
        styleLoader.ensure("runtime-graph")
      )
      .then(() =>
        scriptLoader?.ensure?.("runtime-view") ||
          Promise.resolve(true)
      )
      .then(() => {
        runtimeGraphStyleFailureReported = false;
        return true;
      })
      .finally(() => {
        runtimeGraphStylePromise = null;
      });
    return runtimeGraphStylePromise;
  }

function reportRuntimeGraphStyleFailure(error) {
    if (runtimeGraphStyleFailureReported) return;
    runtimeGraphStyleFailureReported = true;
    showGraphMessage(
      `The Runtime Graph view assets could not be loaded: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
      "error"
    );
  }

function setGraphButtonAvailability(
    button,
    available,
    reason = ""
  ) {
    const shared =
      window.RMLAlwaysClickableButtons
        ?.set;
    if (typeof shared === "function") {
      shared(button, available, reason);
      return;
    }
    if (!button) return;
    button.disabled = false;
    button.setAttribute(
      "aria-disabled",
      String(available !== true)
    );
    if (available !== true) {
      button.dataset.unavailableReason =
        String(reason || "Action unavailable.");
    } else {
      delete button.dataset
        .unavailableReason;
    }
  }

const GRAPH_SEARCHABLE_RENDER_LIMIT = 200;

const GRAPH_GPU_OVERVIEW_ENTER_ZOOM = 0.20;

const GRAPH_GPU_OVERVIEW_EXIT_ZOOM = 0.24;

const GRAPH_NODE_VIRTUAL_OVERSCAN_PIXELS = 260;

const GRAPH_NODE_VIRTUALIZATION_PAN_STEP_PIXELS = 96;

const GRAPH_NODE_SPATIAL_CELL_SIZE = 720;

const GRAPH_NODE_SPATIAL_MAX_QUERY_CELLS = 4096;

const GRAPH_NODE_SPATIAL_KEY_STRIDE = 1000003;

const GRAPH_DOM_DETAIL_NODE_MINIMUM = 48;

const GRAPH_DOM_DETAIL_NODE_MAXIMUM = 240;

const GRAPH_DOM_DETAIL_PIXELS_PER_NODE = 8000;

const GRAPH_VIEW_PERSIST_IDLE_MILLISECONDS = 180;

let graphInspectorRenderDeferred = false;

let graphInspectorRenderedSelectionKey = "";

let builderProjectEpoch = 0;

function requestProjectAnimationFrame(
    callback
  ) {
    const projectEpoch =
      builderProjectEpoch;
    return window.requestAnimationFrame(
      timestamp => {
        if (
          projectEpoch !==
            builderProjectEpoch
        ) {
          return;
        }
        callback(timestamp);
      }
    );
  }

let runtimeGraphViewActive = false;

let graphCatalogReadiness = "ready";

let graphCatalogReadinessMessage = "";

let graphCatalogGateSettled = false;

let graphCatalogGateError = null;

let lastGraphCatalogRefreshRevision = -1;

let openGraphCatalogReconciliationPromise = null;

let openGraphCatalogReconciliationCompletedKey = "";

let graphHostInitialized = false;

let graphBaseModulesReady = false;

let graphHostError = null;

let runtimeBridgeSubscription = null;

let runtimeBridgeChannel = "";

let runtimeBridgeRefreshFrame = 0;

let persistSchedule = 0;

let persistGeneratedOutputDirty = false;

let graphViewPersistTimer = 0;

let graphViewPersistContentDirty = false;

let generatedOutputRefreshQueued = false;

let generatedOutputRefreshEpoch = 0;

let graphMessageTimer = 0;

let graphNodeSearchQuery = "";

let graphNodeSearchIndex = -1;

let graphEditModeScrollY = 0;

let graphEditViewportFrame = 0;

const GRAPH_SEARCHABLE_LIST_THRESHOLD = 8;

const GRAPH_PANEL_LAYOUT_STORAGE_KEY =
    RML_GRAPH_VISUAL_TEST && RML_GRAPH_TEST_STORAGE_SCOPE
      ? `${RML_GRAPH_TEST_STORAGE_SCOPE}-panel-layout`
      : "rml-node-graph-panel-layout-v1";

const GRAPH_PALETTE_UI_STORAGE_KEY =
    RML_GRAPH_VISUAL_TEST && RML_GRAPH_TEST_STORAGE_SCOPE
      ? `${RML_GRAPH_TEST_STORAGE_SCOPE}-palette-ui`
      : "rml-node-graph-palette-ui-v1";

const GRAPH_PALETTE_CONFIG_GROUP_KEY =
    "__packed_configuration__";

let graphLeftPanelCollapsed = false;

let graphRightPanelCollapsed = false;

let graphPaletteUiLoaded = false;

let graphPaletteUiPersistScheduled = false;

let graphPaletteUiState = {
    scrollTop: 0,
    groups: Object.create(null)
  };

let graphPaletteIndicatorCleanup = null;

let autoPanFrame = 0;

let autoPanState = null;

let guidedInteractionAutoPanSuppressed = false;

let guidedAutomaticNodeCreationSuppressed = false;

let lastGuidedPaletteDropState = null;

let paletteDragSuppressClickUntil = 0;

let nodeGraphPalettePointerTransactionSequence = 0;

let paletteClickSuppression = null;

const consumedPalettePointerSources = new WeakSet();

let packedSnapshotSyncScheduled = false;

let packedSnapshotSyncEpoch = 0;

const nodeBodyScrollPositions =
    new Map();

let nodeBodyWireRefreshFrame = 0;

let graphWireRenderFrame = 0;

let graphWireFullRenderPending = false;

const graphWirePartialConnectionIds =
    new Set();

let nodeResizeLimitRefreshFrame = 0;

let lastNodeResizePress = null;

const NODE_RESIZE_DOUBLE_CLICK_MS = 450;

const NODE_RESIZE_DOUBLE_CLICK_DISTANCE = 8;

let lastWirePointPress = null;

let lastWireSegmentPress = null;

const WIRE_DOUBLE_CLICK_MS = 450;

const WIRE_DOUBLE_CLICK_DISTANCE = 8;

function connectionPointSnapshot(
    clientX,
    clientY,
    excludedSocket = null,
    excludedConnectionId = null
  ) {
    const socket = socketRefAtPoint(
      clientX,
      clientY,
      excludedSocket
    );
    const wire = wireTargetAtPoint(
      clientX,
      clientY,
      excludedConnectionId
    );
    return {
      clientX,
      clientY,
      insideViewport: Boolean(
        dom.viewport &&
        (() => {
          const rect = dom.viewport.getBoundingClientRect();
          return clientX >= rect.left && clientX <= rect.right &&
            clientY >= rect.top && clientY <= rect.bottom;
        })()
      ),
      socket,
      wire: wire
        ? {
            connectionId: wire.connectionId,
            segmentIndex: wire.segmentIndex,
            connected: wire.path?.isConnected === true
          }
        : null
    };
  }

let graphScrollLayerSelection = null;

let graphScrollLayerSelectionCandidates = null;

let graphScrollLayerSession = null;

const graphCyclicWheelStepper =
    window.RMLScrollManager
      ?.createCyclicWheelStepper?.({
        threshold: 40
      }) || null;

let graphScrollLayerVisualFrame = 0;

let graphScrollLayerVisualFollowFrame = 0;

let graphScrollLayerIndicatorTimer = 0;

let graphScrollLayerOutline = null;

let graphScrollLayerIndicator = null;

let graphRevealAnimationFrame = 0;

let graphHybridRenderer = null;

let graphToolbarResizeObserver = null;

let graphToolbarResizeFallback = null;

function releaseGraphToolbarResizeTracking() {
    graphToolbarResizeObserver?.disconnect();
    graphToolbarResizeObserver = null;
    if (graphToolbarResizeFallback) {
      window.removeEventListener(
        "resize",
        graphToolbarResizeFallback
      );
      graphToolbarResizeFallback = null;
    }
  }

function detachGraphHybridRenderer() {
    if (!graphHybridRenderer) {
      return;
    }
    if (
      typeof graphHybridRenderer.detach ===
        "function"
    ) {
      graphHybridRenderer.detach();
      return;
    }

    // Compatibility with a cached pre-v7 renderer: it cannot be reused
    // safely, so release it once and let the current renderer be created.
    graphHybridRenderer.dispose?.();
    graphHybridRenderer = null;
  }

function disposeGraphHybridRenderer() {
    graphHybridRenderer?.dispose?.();
    graphHybridRenderer = null;
  }

let graphNodeVirtualizationFrame = 0;

let graphNodeViewportSpatialIndex = new Map();

let graphNodeViewportSpatialRecordById = new Map();

let graphNodeViewportSpatialSource = null;

let graphNodeViewportSpatialLength = -1;

let graphNodeViewportSpatialDirty = true;

const graphNodeViewportSpatialDirtyNodeIds = new Set();

let graphGpuDetailOverflowMode = false;

let graphGpuNodeRecordSource = null;

let graphGpuNodeRecordLength = -1;

let graphGpuNodeRecords = [];

const graphGpuNodeRecordById = new Map();

const graphGpuNodeDirtyIds = new Set();

let graphGpuNodeRecordsDirty = true;

let graphGpuSelectedNodeId = null;

let graphConnectedPortKeysSource = null;

let graphConnectedPortKeysLength = -1;

let graphConnectedPortKeysCache = new Set();

const graphConnectionGeometryCache = new Map();

const emptyGraphSocketGeometry = new Map();

let graphInteractionMotionFrame = 0;

let graphPendingInteractionMotion = null;

let graphConnectionPreviewPath = null;

let graphConnectionDragTelemetry = {
    eagerTargets: 0,
    hoveredTargets: 0,
    previewBackend: "none"
  };

function cancelProjectScopedGraphWork() {
    const cancelFrame = value => {
      if (value) {
        cancelAnimationFrame(value);
      }
      return 0;
    };

    runtimeBridgeRefreshFrame =
      cancelFrame(runtimeBridgeRefreshFrame);
    graphEditViewportFrame =
      cancelFrame(graphEditViewportFrame);
    autoPanFrame =
      cancelFrame(autoPanFrame);
    nodeBodyWireRefreshFrame =
      cancelFrame(nodeBodyWireRefreshFrame);
    graphWireRenderFrame =
      cancelFrame(graphWireRenderFrame);
    graphStructuralPaintFrame =
      cancelFrame(graphStructuralPaintFrame);
    graphStructuralCommitFrame =
      cancelFrame(graphStructuralCommitFrame);
    nodeResizeLimitRefreshFrame =
      cancelFrame(nodeResizeLimitRefreshFrame);
    graphScrollLayerVisualFrame =
      cancelFrame(graphScrollLayerVisualFrame);
    graphScrollLayerVisualFollowFrame =
      cancelFrame(
        graphScrollLayerVisualFollowFrame
      );
    graphRevealAnimationFrame =
      cancelFrame(graphRevealAnimationFrame);
    graphNodeVirtualizationFrame =
      cancelFrame(graphNodeVirtualizationFrame);
    graphInteractionMotionFrame =
      cancelFrame(graphInteractionMotionFrame);

    if (graphScrollLayerIndicatorTimer) {
      clearTimeout(
        graphScrollLayerIndicatorTimer
      );
      graphScrollLayerIndicatorTimer = 0;
    }
    if (graphMessageTimer) {
      clearTimeout(graphMessageTimer);
      graphMessageTimer = 0;
    }
    if (graphViewPersistTimer) {
      clearTimeout(graphViewPersistTimer);
      graphViewPersistTimer = 0;
    }

    graphWireFullRenderPending = false;
    graphWirePartialConnectionIds.clear();
    graphPendingInteractionMotion = null;
    graphViewPersistContentDirty = false;
    packedSnapshotSyncScheduled = false;
    packedSnapshotSyncEpoch = 0;
    graphNodeViewportSpatialIndex.clear();
    graphNodeViewportSpatialRecordById.clear();
    graphNodeViewportSpatialSource = null;
    graphNodeViewportSpatialLength = -1;
    graphNodeViewportSpatialDirty = true;
    graphNodeViewportSpatialDirtyNodeIds.clear();
    graphGpuDetailOverflowMode = false;
    graphGpuNodeRecordSource = null;
    graphGpuNodeRecordLength = -1;
    graphGpuNodeRecords = [];
    graphGpuNodeRecordById.clear();
    graphGpuNodeDirtyIds.clear();
    graphGpuNodeRecordsDirty = true;
    graphGpuSelectedNodeId = null;
    graphConnectedPortKeysSource = null;
    graphConnectedPortKeysLength = -1;
    graphConnectedPortKeysCache = new Set();
    graphConnectionGeometryCache.clear();
  }

const graphSharedWheelClaims = (() => {
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

function claimGraphWheelEvent(event) {
    if (
      !event ||
      graphSharedWheelClaims.has(event)
    ) {
      return false;
    }

    graphSharedWheelClaims.add(event);

    if (event.cancelable) {
      event.preventDefault();
    }

    event.stopImmediatePropagation();

    return true;
  }

const dom = {
    packButton: null,
    palettePanel: null,
    paletteTitle: null,
    paletteTitleOriginal: "",
    canvasPanel: null,
    canvasTitle: null,
    canvasTitleOriginal: "",
    inspectorPanel: null,
    inspectorTitle: null,
    inspectorTitleOriginal: "",
    paletteContent: null,
    builderCanvas: null,
    itemCount: null,
    activeContainerName: null,
    inspectorContent: null,
    root: null,
    navigationTrail: null,
    toolbar: null,
    viewport: null,
    stage: null,
    wires: null,
    nodesHost: null,
    gpuCanvas: null,
    toast: null,
    sourceBadge: null,
    editModeButton: null,
    leftPanelToggle: null,
    rightPanelToggle: null
  };

function normalizePresentationPage(value) {
    return value === "runtime-graph"
      ? "runtime-graph"
      : "configuration-outline";
  }

function savedPresentationPage() {
    return normalizePresentationPage(
      bridge?.getActivePage?.() ||
      graph?.lastOpenPage
    );
  }

function tracePresentationPage(
    stage,
    detail = {}
  ) {
    window.RMLPageStateDiagnostics
      ?.record?.(
        `graph.${stage}`,
        {
          savedPage:
            savedPresentationPage(),
          graphPage:
            graph?.lastOpenPage || null,
          runtimeGraphViewActive,
          ...detail
        }
      );
  }

function commitPresentationPage(
    page,
    reason = "runtime-graph"
  ) {
    const normalized =
      normalizePresentationPage(page);
    if (graph) {

      
      graph.lastOpenPage = normalized;
    }
    bridge?.setActivePage?.(
      normalized,
      {
        immediate: true,
        reason
      }
    );
    tracePresentationPage(
      "commit",
      { page: normalized, reason }
    );
    return normalized;
  }

function nodePaletteIconDescriptor(
    definition = {}
  ) {
    const memberKind = String(
      definition?.apiMemberKind || ""
    );
    const inputs = Array.isArray(
      definition?.inputs
    )
      ? definition.inputs
      : [];
    const outputs = Array.isArray(
      definition?.outputs
    )
      ? definition.outputs
      : [];
    const meaningfulPort = ports =>
      ports.find(port => {
        const type = String(
          port?.type || ""
        );
        return (
          type &&
          type !== "impulse" &&
          type !== "generic" &&
          type !== "auto"
        );
      });
    const semanticPort =
      memberKind === "property-set" ||
      memberKind === "field-set"
        ? (
            inputs.find(port =>
              String(port?.id || "") ===
                "value"
            ) || meaningfulPort(inputs)
          )
        : meaningfulPort(outputs) ||
          meaningfulPort(inputs);
    const semanticType = String(
      semanticPort?.type || ""
    );
    const semanticInformation =
      semanticType
        ? typeInfo(semanticType)
        : null;
    const customCSharp = Boolean(
      definition?.customCSharpNode === true ||
      definition?.customCSharpSyntaxNode === true ||
      definition?.customCSharpSubgraphOnly === true ||
      definition?.customCSharpCatalogNode === true
    );
    const expert =
      definition?.expertOnly === true;
    let symbol = String(
      definition?.symbol || "?"
    );

    if (
      memberKind === "enum"
    ) {
      symbol = "ENUM";
    } else if (
      memberKind === "type"
    ) {
      symbol = "TYPE";
    }

    const color =
      customCSharp || expert
        ? "#ffd181"
        : memberKind &&
            semanticInformation?.color
          ? String(
              semanticInformation.color
            )
          : "#8fdcff";

    return Object.freeze({
      symbol,
      color,
      tone:
        customCSharp
          ? "custom-csharp"
          : expert
            ? "expert"
            : memberKind
              ? `api-${memberKind}`
              : "standard"
    });
  }

function constraintLabel(constraint) {
    const labels = {
      value: "Any value",
      anyValue: "Any non-impulse value",
      enumOrString: "Enum or string",
      reference: "Reference value",
      arithmetic: "Numeric or vector",
      scalar: "Scalar number",
      ordered: "Ordered number",
      interpolatable: "Interpolatable value",
      reflectionMember: "Reflection member",
      serializable: "Serializable value",
      enumerable: "Enumerable collection",
      collectableCollection:
        "Strongly typed collector list"
    };

    return labels[constraint] || "Generic";
  }

function normalizeGraphNodeParameters(
    node,
    definition,
    coerce = true
  ) {
    return normalizeNodeParametersObject(
      node?.parameters,
      definition,
      node?.operatorId || "",
      coerce
    );
  }

function closeEmbeddedEditorForGraphReplacement() {
    const editorKey =
      customCSharpInlineEditorKey;
    const record = editorKey
      ? customCSharpDetachedEditors.get(
          editorKey
        )
      : null;
    const previousPresentation =
      customCSharpEditorRecordActive(record)
        ? {
            consumed: false,
            nodeId: record.nodeId,
            parameterKey:
              record.parameterKey,
            specification:
              record.specification,
            value:
              record.getValue?.() || ""
          }
        : null;
    if (editorKey) {
      if (
        record
      ) {
        closeCustomCSharpEditorRecord(
          editorKey
        );
      } else {
        restoreGraphAfterCustomCSharpInlineEditor(
          editorKey
        );
      }
    }
    return previousPresentation;
  }

function restorePreviousEmbeddedEditor(
    presentation
  ) {
    if (
      !presentation ||
      presentation.consumed === true ||
      !graph
    ) {
      return false;
    }
    presentation.consumed = true;
    const node = graph.nodes?.find(
      candidate =>
        candidate?.id ===
        presentation.nodeId
    );
    if (!node) {
      return false;
    }
    openCustomCSharpDetachedEditor(
      node,
      presentation.specification || {
        key:
          presentation.parameterKey ||
          "code",
        label: "Custom C#"
      },
      {
        value: String(
          presentation.value || ""
        )
      }
    );
    return true;
  }

function savedApiContractSemanticKey(
    contract
  ) {
    if (
      !contract ||
      typeof contract !== "object" ||
      Array.isArray(contract)
    ) {
      return "";
    }
    const normalizePorts = value =>
      (Array.isArray(value) ? value : [])
        .map(portValue => ({
          id: String(portValue?.id || ""),
          type: String(portValue?.type || ""),
          typeVar: String(
            portValue?.typeVar || ""
          ),
          generic:
            portValue?.generic === true,
          optional:
            portValue?.optional === true,
          role: String(portValue?.role || "")
        }));
    return JSON.stringify(
      savedApiCompositeCanonicalValue({
        kind: String(contract.kind || ""),
        ownerType: String(
          contract.ownerType || ""
        ),
        memberName: String(
          contract.memberName || ""
        ),
        signature: String(
          contract.signature || ""
        ),
        parameters:
          Array.isArray(contract.parameters)
            ? contract.parameters
            : [],
        returnType: String(
          contract.returnType || "System.Void"
        ),
        isStatic:
          contract.isStatic === true,
        genericArity: Math.max(
          0,
          Number(contract.genericArity) || 0
        ),
        runtimeBound:
          contract.runtimeBound === true,
        inputPorts: normalizePorts(
          contract.inputPorts
        ),
        outputPorts: normalizePorts(
          contract.outputPorts
        )
      })
    );
  }

function rootRuntimeGraphView() {
    return apiCompositeEditor?.mainView ||
      customCSharpEditor?.mainView ||
      graphViewFrom(graph);
  }

function graphNavigationLevelExists(
    level
  ) {
    if (!graph?.active || !level) {
      return false;
    }

    if (level.kind === "runtime") {
      return true;
    }

    if (level.kind === "api-composite") {
      return Boolean(
        apiCompositeEditor &&
        apiCompositeEditor.containerNodeId ===
          level.ownerId &&
        apiCompositeEditor.mainView?.nodes?.some(
          node => node?.id === level.ownerId
        ) &&
        graph.apiCompositeGraphs?.[
          level.ownerId
        ]
      );
    }

    if (level.kind === "custom-csharp-file") {
      return Boolean(
        customCSharpEditor &&
        customCSharpEditor.fileNodeId ===
          level.ownerId &&
        customCSharpEditor.mainView?.nodes?.some(
          node => node?.id === level.ownerId
        ) &&
        graph.customCSharpFiles?.[
          level.ownerId
        ]
      );
    }

    if (level.kind === "code-editor") {
      if (level.pending === true) {
        return true;
      }
      return customCSharpEditorRecordActive(
        customCSharpDetachedEditors.get(
          level.editorKey
        )
      );
    }

    return false;
  }

function graphNavigationLevels({
    inlineEditorKey = "",
    inlineEditorTitle = ""
  } = {}) {
    const levels = [
      {
        id: "runtime-graph",
        kind: "runtime",
        typeLabel: "Root",
        label: "Runtime Graph",
        ownerId: ""
      }
    ];

    if (apiCompositeEditor) {
      levels.push({
        id:
          `api-composite:${apiCompositeEditor.containerNodeId}`,
        kind: "api-composite",
        typeLabel: "API & Logic",
        label:
          String(
            apiCompositeEditor.title ||
            "API Composite"
          ),
        ownerId:
          apiCompositeEditor.containerNodeId
      });
    }

    if (customCSharpEditor) {
      levels.push({
        id:
          `custom-csharp-file:${customCSharpEditor.fileNodeId}`,
        kind: "custom-csharp-file",
        typeLabel: "Custom C# File",
        label:
          String(
            customCSharpEditor.fileName ||
            "Custom C# File"
          ),
        ownerId:
          customCSharpEditor.fileNodeId
      });
    }

    const editorKey = String(
      inlineEditorKey ||
      customCSharpInlineEditorKey ||
      ""
    );
    if (editorKey) {
      const record =
        customCSharpDetachedEditors.get(
          editorKey
        );
      const node = record
        ? customCSharpEditorNode(
            record.nodeId
          )
        : null;
      const title = String(
        node?.label ||
        (node
          ? nodeDefinition(node)?.title
          : "") ||
        record?.specification?.label ||
        inlineEditorTitle ||
        "Code Editor"
      ).replace(
        /\s*·\s*Code editor\s*$/i,
        ""
      );
      levels.push({
        id: `code-editor:${editorKey}`,
        kind: "code-editor",
        typeLabel: "Code Editor",
        label: title,
        editorKey,
        pending: !record
      });
    }

    return levels.map(
      (level, index) => ({
        ...level,
        index,
        exists:
          graphNavigationLevelExists(
            level
          ),
        current:
          index === levels.length - 1
      })
    );
  }

function graphNavigationPathText(
    options = {}
  ) {
    return graphNavigationLevels(options)
      .map(level => level.label)
      .join(" › ");
  }

function navigateToGraphNavigationLevel(
    targetId
  ) {
    const initialLevels =
      graphNavigationLevels();
    const target = initialLevels.find(
      level => level.id === targetId
    );
    if (
      !target ||
      !target.exists ||
      target.current
    ) {
      return false;
    }

    for (let guard = 0; guard < 32; guard += 1) {
      const levels =
        graphNavigationLevels();
      const targetIndex =
        levels.findIndex(
          level => level.id === targetId
        );
      if (targetIndex < 0) {
        showGraphMessage(
          "That graph level no longer exists. The current graph was preserved.",
          "error"
        );
        return false;
      }
      if (targetIndex === levels.length - 1) {
        showGraphMessage(
          `Opened graph level ${targetIndex + 1}: ${levels[targetIndex].label}.`,
          "success"
        );
        return true;
      }

      if (customCSharpInlineEditorKey) {
        const editorKey =
          customCSharpInlineEditorKey;
        const record =
          customCSharpDetachedEditors.get(
            editorKey
          );
        if (record) {
          closeCustomCSharpEditorRecord(
            editorKey
          );
        } else {
          restoreGraphAfterCustomCSharpInlineEditor(
            editorKey
          );
        }
        continue;
      }

      if (customCSharpEditor) {
        if (!closeCustomCSharpFileGraph({
          restorePreviousPresentation: false
        })) {
          return false;
        }
        continue;
      }

      if (apiCompositeEditor) {
        if (!closeApiCompositeGraph({
          restorePreviousPresentation: false
        })) {
          return false;
        }
        continue;
      }

      break;
    }

    showGraphMessage(
      "The requested graph level could not be reached without creating a navigation cycle.",
      "error"
    );
    return false;
  }

function createGraphNavigationTrail(
    options = {}
  ) {
    const levels =
      graphNavigationLevels(options);
    const navigation =
      document.createElement("nav");
    navigation.className =
      "rml-graph-navigation";
    navigation.setAttribute(
      "aria-label",
      "Current graph hierarchy"
    );
    navigation.title =
      graphNavigationPathText(options);

    const list =
      document.createElement("div");
    list.className =
      "rml-graph-navigation-levels";

    levels.forEach((level, index) => {
      if (index > 0) {
        const separator =
          document.createElement("span");
        separator.className =
          "rml-graph-navigation-separator";
        separator.textContent = "›";
        separator.setAttribute(
          "aria-hidden",
          "true"
        );
        list.appendChild(separator);
      }

      const element =
        document.createElement(
          level.current
            ? "span"
            : "button"
        );
      element.className =
        "rml-graph-navigation-level";
      element.dataset.graphNavigationKind =
        level.kind;
      element.title =
        `${level.typeLabel} · ${level.label}`;

      const typeLabel =
        document.createElement("small");
      typeLabel.textContent =
        level.typeLabel;
      const label =
        document.createElement("strong");
      label.textContent = level.label;
      element.append(
        typeLabel,
        label
      );

      if (level.current) {
        element.classList.add("current");
        element.setAttribute(
          "aria-current",
          "page"
        );
      } else {
        element.type = "button";
        element.disabled = !level.exists;
        element.setAttribute(
          "aria-label",
          `Open level ${index + 1}: ${level.label}`
        );
        element.addEventListener(
          "click",
          () =>
            navigateToGraphNavigationLevel(
              level.id
            )
        );
      }

      list.appendChild(element);
    });

    const depth =
      document.createElement("span");
    depth.className =
      "rml-graph-navigation-depth";
    depth.textContent =
      `Level ${levels.length}`;
    depth.title =
      `Current graph level ${levels.length} of ${levels.length}`;
    depth.setAttribute(
      "aria-label",
      depth.title
    );

    navigation.append(
      list,
      depth
    );

    requestProjectAnimationFrame(() => {
      list.scrollLeft = list.scrollWidth;
    });

    return navigation;
  }

function selectConnectedApiNodes(
    startNodeId
  ) {
    if (
      !graph ||
      customCSharpEditor ||
      apiCompositeEditor
    ) {
      return false;
    }
    const eligible = new Set(
      graph.nodes
        .filter(node =>
          node.kind === "operator" &&
          nodeDefinition(node)
            ?.catalogGenerated === true &&
          portableApiContractForNode(node)
        )
        .map(node => node.id)
    );
    if (!eligible.has(startNodeId)) {
      return false;
    }
    const selected = new Set([
      startNodeId
    ]);
    const neighbors = new Map();
    const appendNeighbor = (from, to) => {
      if (
        !eligible.has(from) ||
        !eligible.has(to)
      ) {
        return;
      }
      if (!neighbors.has(from)) {
        neighbors.set(from, []);
      }
      neighbors.get(from).push(to);
    };
    for (const connection of
      graph.connections) {
      appendNeighbor(
        connection.fromNode,
        connection.toNode
      );
      appendNeighbor(
        connection.toNode,
        connection.fromNode
      );
    }
    const queue = [startNodeId];
    for (let index = 0;
      index < queue.length;
      index += 1) {
      const current = queue[index];
      for (const other of
        neighbors.get(current) || []) {
        if (
          eligible.has(other) &&
          !selected.has(other)
        ) {
          selected.add(other);
          queue.push(other);
        }
      }
    }
    graph.selectedNodeIds =
      [...selected];
    graph.selectedNodeId = startNodeId;
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    persistGraphView();
    updateSelectionClasses();
    renderGraphInspector();
    showGraphMessage(
      selected.size > 1
        ? `${selected.size.toLocaleString("de-DE")} connected API nodes selected. Choose Create API Composite in the inspector.`
        : "No directly connected catalog API node belongs to this chain. Use Ctrl/Command-click to add individual API nodes.",
      selected.size > 1
        ? "success"
        : ""
    );
    return selected.size > 1;
  }

function commitRootRuntimeGraphView(view) {
    const target =
      apiCompositeEditor?.mainView ||
      customCSharpEditor?.mainView ||
      null;
    if (target) {
      Object.assign(
        target,
        graphViewFrom(view)
      );
    } else {
      applyGraphView(
        graphViewFrom(view)
      );
    }
  }

function handleProjectReplacement(event) {
    const replacementProjectEpoch =
      Number(
        event?.detail?.projectEpoch
      ) || 0;
    if (replacementProjectEpoch > 0) {
      builderProjectEpoch =
        replacementProjectEpoch;
    }
    openGraphCatalogReconciliationCompletedKey =
      "";
    cancelProjectScopedGraphWork();
    customCSharpProjectEpoch += 1;
    persistSchedule += 1;
    persistGeneratedOutputDirty = false;

    for (const timer of customCSharpSourceSyncTimers.values()) {
      window.clearTimeout(timer);
    }
    customCSharpSourceSyncTimers.clear();
    for (const timer of
      customCSharpLiveDiagnosticTimers.values()) {
      window.clearTimeout(timer);
    }
    customCSharpLiveDiagnosticTimers.clear();
    customCSharpLiveDiagnosticRevisions.clear();
    for (const editor of
      customCSharpDetachedEditors.values()) {
      editor?.close?.();
    }
    customCSharpDetachedEditors.clear();
    customCSharpEditorDraftValues.clear();
    customCSharpActiveEditorKey = "";
    graphInspectorRenderedSelectionKey = "";

    for (const controller of
      customCSharpSynchronizationControllers.values()) {
      controller.abort(
        new DOMException(
          "The project changed while Custom C# synchronization was running.",
          "AbortError"
        )
      );
    }

    for (const record of [...customCSharpBuildWorkers.values()]) {
      record.abort?.(
        new DOMException(
          "The project changed while the Custom C# worker was running.",
          "AbortError"
        )
      );
    }
    customCSharpBuildWorkers.clear();
    customCSharpSynchronizations.clear();
    customCSharpSynchronizationStatus.clear();
    customCSharpDiagnostics.clear();
    customCSharpDebugOutput.clear();
    customCSharpDiagnosticClockEpoch = 0;
    customCSharpSynchronizationControllers.clear();
    customCSharpSynchronizationTasks.clear();
    customCSharpForegroundSynchronizationTokens.clear();

    if (customCSharpEditor && graph) {
      applyGraphView(
        customCSharpEditor.mainView
      );
    }
    if (apiCompositeEditor && graph) {
      applyGraphView(
        apiCompositeEditor.mainView
      );
    }
    customCSharpEditor = null;
    apiCompositeEditor = null;
    customCSharpRootOperation = false;
    apiCompositeRootOperation = false;

    if (graphInteractionMotionFrame) {
      cancelAnimationFrame(
        graphInteractionMotionFrame
      );
      graphInteractionMotionFrame = 0;
    }
    graphPendingInteractionMotion = null;
    activeInteraction?.ghost?.remove?.();
    activeInteraction = null;
    stopAutoPan();
    clearConnectionTargetStates();

    lastPersistedGraphReference = null;
    typedGraphCodegenCacheKey = "";
    typedGraphCodegenCache = null;
    resetGraphRenderCaches();
    if (runtimeGraphViewActive) {
      deactivateGraphMode();
    }
  }

function refreshVisibleInspectorActionControls() {
    if (!dom.inspectorContent) {
      return;
    }
    const nodeIds = new Set(
      [...dom.inspectorContent.querySelectorAll(
        `[${CUSTOM_CSHARP_ACTION_NODE_ATTRIBUTE}]`
      )]
        .map(button => String(
          button.getAttribute(
            CUSTOM_CSHARP_ACTION_NODE_ATTRIBUTE
          ) || ""
        ))
        .filter(Boolean)
    );
    for (const nodeId of nodeIds) {
      updateCustomCSharpSynchronizationControl(
        nodeId
      );
    }
  }

function hasPackedRuntimeProgram() {
    return Boolean(
      graph?.configSnapshot &&
      Array.isArray(
        graph.configSnapshot.nodes
      ) &&
      Array.isArray(graph.nodes) &&
      graph.nodes.some(node =>
        node?.kind === "configuration"
      ) &&
      Array.isArray(graph.connections)
    );
  }

function clearSelectedWirePoint() {
    if (graph) {
      graph.selectedWirePoint = null;
    }
  }

function replacementGeometrySignature(
    graphDocument,
    replacementNodeIds = []
  ) {
    const nodeIds = new Set(
      (Array.isArray(replacementNodeIds)
        ? replacementNodeIds
        : [])
        .map(value => String(value || ""))
        .filter(Boolean)
    );
    const nodes =
      (Array.isArray(graphDocument?.nodes)
        ? graphDocument.nodes
        : [])
        .filter(node =>
          nodeIds.size === 0 ||
          nodeIds.has(String(node?.id || ""))
        )
        .map(node => ({
          id: node.id,
          x: node.x,
          y: node.y,
          width: node.width,
          height: node.height
        }));
    const connections =
      (Array.isArray(graphDocument?.connections)
        ? graphDocument.connections
        : [])
        .map(connection => {
          const {
            fromPort: _fromPort,
            toPort: _toPort,
            ...routing
          } = connection || {};
          return routing;
        });

    return JSON.stringify({
      nodes,
      connections
    });
  }

function applyNodeReplacementsPreservingGeometry(
    graphDocument,
    replacements
  ) {
    if (
      !graphDocument ||
      !Array.isArray(graphDocument.nodes) ||
      !Array.isArray(graphDocument.connections)
    ) {
      throw new TypeError(
        "A replacement transaction requires a complete Runtime Graph document."
      );
    }

    const requested =
      Array.isArray(replacements)
        ? replacements
        : [];
    const nodesById = new Map(
      graphDocument.nodes.map(node => [
        String(node?.id || ""),
        node
      ])
    );
    const prepared = [];
    const usedNodeIds = new Set();

    for (const replacement of requested) {
      const nodeId = String(
        replacement?.nodeId || ""
      ).trim();
      const operatorId = String(
        replacement?.operatorId || ""
      ).trim();
      const node = nodesById.get(nodeId);

      if (
        !nodeId ||
        !operatorId ||
        !node ||
        node.kind !== "operator" ||
        usedNodeIds.has(nodeId)
      ) {
        throw new Error(
          `The replacement transaction contains an invalid or duplicate node '${nodeId || "<unnamed>"}'.`
        );
      }

      usedNodeIds.add(nodeId);
      prepared.push({
        node,
        nodeId,
        operatorId,
        inputMap:
          replacement?.inputMap &&
          typeof replacement.inputMap === "object" &&
          !Array.isArray(replacement.inputMap)
            ? replacement.inputMap
            : {},
        outputMap:
          replacement?.outputMap &&
          typeof replacement.outputMap === "object" &&
          !Array.isArray(replacement.outputMap)
            ? replacement.outputMap
            : {}
      });
    }

    const replacementNodeIds =
      prepared.map(value => value.nodeId);
    const geometrySignature =
      replacementGeometrySignature(
        graphDocument,
        replacementNodeIds
      );
    const originalNodes =
      prepared.map(value => ({
        node: value.node,
        value: nodeGraphClone(value.node)
      }));
    const originalConnections =
      graphDocument.connections.map(
        connection => ({
          connection,
          value: nodeGraphClone(connection),
          fromPort: connection.fromPort,
          toPort: connection.toPort
        })
      );
    const replacementByNodeId =
      new Map(
        prepared.map(value => [
          value.nodeId,
          value
        ])
      );
    let active = true;

    const rollback = () => {
      if (!active) return false;

      for (const original of
        originalNodes) {
        for (const key of
          Object.keys(original.node)) {
          delete original.node[key];
        }
        Object.assign(
          original.node,
          nodeGraphClone(original.value)
        );
      }
      for (const original of
        originalConnections) {
        for (const key of
          Object.keys(
            original.connection
          )) {
          delete original.connection[key];
        }
        Object.assign(
          original.connection,
          nodeGraphClone(original.value)
        );
      }

      active = false;
      return true;
    };
    const assertGeometry = () => {
      const current =
        replacementGeometrySignature(
          graphDocument,
          replacementNodeIds
        );

      if (current !== geometrySignature) {
        rollback();
        throw new Error(
          "Node replacement was rolled back because it changed node placement or stored wire routing geometry."
        );
      }

      return true;
    };

    try {
      for (const connection of
        graphDocument.connections) {
        const source =
          replacementByNodeId.get(
            String(
              connection.fromNode || ""
            )
          );
        const target =
          replacementByNodeId.get(
            String(
              connection.toNode || ""
            )
          );

        if (source) {
          connection.fromPort = String(
            source.outputMap[
              connection.fromPort
            ] || connection.fromPort || ""
          );
        }
        if (target) {
          connection.toPort = String(
            target.inputMap[
              connection.toPort
            ] || connection.toPort || ""
          );
        }
      }

      for (const replacement of
        prepared) {
        replacement.node.operatorId =
          replacement.operatorId;
      }

      assertGeometry();
    } catch (error) {
      rollback();
      throw error;
    }

    return Object.freeze({
      replacedNodeCount:
        prepared.length,
      remappedConnectionCount:
        originalConnections.filter(
          original =>
            original.connection.fromPort !==
              original.fromPort ||
            original.connection.toPort !==
              original.toPort
        ).length,
      geometrySignature,
      assertGeometry,
      rollback,
      commit() {
        assertGeometry();
        active = false;
        return true;
      }
    });
  }

function applyCatalogMigrationsPreservingGeometry(
    graphDocument,
    migrations,
    portMigrations
  ) {
    const operatorMigrations =
      migrations &&
      typeof migrations === "object" &&
      !Array.isArray(migrations)
        ? migrations
        : {};
    const portMaps =
      portMigrations &&
      typeof portMigrations === "object" &&
      !Array.isArray(portMigrations)
        ? portMigrations
        : {};
    const views = [];
    const visited = new Set();
    const appendView = (
      candidate,
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
        graph: candidate,
        path
      });

      const customFiles =
        candidate.customCSharpFiles &&
        typeof candidate.customCSharpFiles === "object" &&
        !Array.isArray(
          candidate.customCSharpFiles
        )
          ? candidate.customCSharpFiles
          : {};
      for (const [ownerNodeId, customGraph] of
        Object.entries(customFiles)) {
        appendView(
          customGraph,
          `${path}/custom-csharp:${String(ownerNodeId || "<unnamed>")}`
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
      for (const [ownerNodeId, compositeGraph] of
        Object.entries(apiComposites)) {
        appendView(
          compositeGraph,
          `${path}/api-composite:${String(ownerNodeId || "<unnamed>")}`
        );
      }
    };
    appendView(graphDocument);

    const boundarySnapshots = [];
    for (const view of views) {
      const composites =
        view.graph.apiCompositeGraphs &&
        typeof view.graph.apiCompositeGraphs ===
          "object" &&
        !Array.isArray(
          view.graph.apiCompositeGraphs
        )
          ? view.graph.apiCompositeGraphs
          : {};
      const owners = new Map(
        view.graph.nodes.map(node => [
          node.id,
          node
        ])
      );
      for (const [ownerId, composite] of
        Object.entries(composites)) {
        const owner = owners.get(ownerId);
        const originalBoundaries = nodeGraphClone(
          composite?.boundaryPorts || []
        );
        const originalOwnerBoundaries = nodeGraphClone(
          owner?.parameters?.boundaryPorts ||
          []
        );
        boundarySnapshots.push({
          composite,
          owner,
          originalBoundaries,
          originalOwnerBoundaries
        });
        const internalNodes = new Map(
          (Array.isArray(composite?.nodes)
            ? composite.nodes
            : []).map(node => [
              node.id,
              node
            ])
        );
        const remapped =
          apiCompositeBoundaryRecords(
            composite?.boundaryPorts
          ).map(boundary => {
            const internalNode =
              internalNodes.get(
                boundary.internalNodeId
              );
            const map = portMaps[
              String(
                internalNode?.operatorId || ""
              )
            ];
            const directionMap =
              boundary.direction === "input"
                ? map?.input
                : map?.output;
            return {
              ...boundary,
              internalPortId: String(
                directionMap?.[
                  boundary.internalPortId
                ] ||
                boundary.internalPortId
              )
            };
          });
        composite.boundaryPorts = remapped;
        if (owner) {
          owner.parameters =
            owner.parameters &&
            typeof owner.parameters === "object"
              ? owner.parameters
              : {};
          owner.parameters.boundaryPorts =
            nodeGraphClone(remapped);
        }
      }
    }

    const restoreCompositeBoundaries = () => {
      for (const snapshot of
        boundarySnapshots) {
        snapshot.composite.boundaryPorts =
          nodeGraphClone(
            snapshot.originalBoundaries
          );
        if (snapshot.owner) {
          snapshot.owner.parameters =
            snapshot.owner.parameters &&
            typeof snapshot.owner.parameters ===
              "object"
              ? snapshot.owner.parameters
              : {};
          snapshot.owner.parameters.boundaryPorts =
            nodeGraphClone(
              snapshot.originalOwnerBoundaries
            );
        }
      }
    };

    if (views.length === 0) {
      throw new TypeError(
        "A catalog migration requires a complete Runtime Graph document."
      );
    }

    const transactions = [];
    try {
      for (const view of views) {
        const replacements = [];
        for (const node of view.graph.nodes) {
          const originalOperatorId =
            String(node?.operatorId || "");
          const migratedOperatorId = String(
            operatorMigrations[
              originalOperatorId
            ] || ""
          ).trim();
          const portMap =
            portMaps[
              originalOperatorId
            ];
          const hasPortMigration = Boolean(
            portMap &&
            typeof portMap === "object" &&
            !Array.isArray(portMap) &&
            (
              Object.keys(
                portMap.input || {}
              ).length > 0 ||
              Object.keys(
                portMap.output || {}
              ).length > 0
            )
          );

          if (
            !migratedOperatorId &&
            !hasPortMigration
          ) {
            continue;
          }

          replacements.push({
            nodeId: node.id,
            operatorId:
              migratedOperatorId ||
              originalOperatorId,
            inputMap:
              portMap?.input || {},
            outputMap:
              portMap?.output || {}
          });
        }

        if (replacements.length === 0) {
          continue;
        }

        transactions.push({
          path: view.path,
          transaction:
            applyNodeReplacementsPreservingGeometry(
              view.graph,
              replacements
            )
        });
      }
    } catch (error) {
      for (const entry of
        transactions.slice().reverse()) {
        entry.transaction.rollback();
      }
      restoreCompositeBoundaries();
      throw error;
    }

    let active = true;
    const assertGeometry = () => {
      try {
        for (const entry of transactions) {
          entry.transaction.assertGeometry();
        }
      } catch (error) {
        for (const entry of
          transactions.slice().reverse()) {
          entry.transaction.rollback();
        }
        restoreCompositeBoundaries();
        active = false;
        throw error;
      }
      return true;
    };
    const rollback = () => {
      if (!active) return false;
      for (const entry of
        transactions.slice().reverse()) {
        entry.transaction.rollback();
      }
      restoreCompositeBoundaries();
      active = false;
      return true;
    };

    return Object.freeze({
      replacedNodeCount:
        transactions.reduce(
          (total, entry) =>
            total +
            Number(
              entry.transaction
                .replacedNodeCount || 0
            ),
          0
        ),
      remappedConnectionCount:
        transactions.reduce(
          (total, entry) =>
            total +
            Number(
              entry.transaction
                .remappedConnectionCount || 0
            ),
          0
        ),
      geometrySignature:
        JSON.stringify(
          transactions.map(entry => ({
            path: entry.path,
            signature:
              entry.transaction
                .geometrySignature
          }))
        ),
      assertGeometry,
      rollback,
      commit() {
        if (!active) return false;
        assertGeometry();
        for (const entry of transactions) {
          entry.transaction.commit();
        }
        active = false;
        return true;
      }
    });
  }

function migrateLegacyOperatorsForImport(
    graphDocument
  ) {
    if (
      !graphDocument ||
      !Array.isArray(graphDocument.nodes) ||
      !Array.isArray(
        graphDocument.connections
      )
    ) {
      throw new TypeError(
        "Legacy operator migration requires a complete Runtime Graph document."
      );
    }

    const nodeIds =
      graphDocument.nodes.map(node =>
        String(node?.id || "")
      );
    const geometrySignature =
      replacementGeometrySignature(
        graphDocument,
        nodeIds
      );
    const sanitized =
      sanitizeGraphState(
        graphDocument
      );
    const sanitizedNodes =
      new Map(
        sanitized.nodes.map(node => [
          String(node?.id || ""),
          node
        ])
      );
    const sanitizedConnections =
      new Map(
        sanitized.connections.map(
          connection => [
            String(
              connection?.id || ""
            ),
            connection
          ]
        )
      );
    const migrations = [];
    let remappedConnectionCount = 0;

    for (const node of
      graphDocument.nodes) {
      const migrated =
        sanitizedNodes.get(
          String(node?.id || "")
        );
      const previousOperatorId =
        String(
          node?.operatorId || ""
        );
      const nextOperatorId =
        String(
          migrated?.operatorId || ""
        );

      if (
        node?.kind !== "operator" ||
        !migrated ||
        !nextOperatorId ||
        previousOperatorId ===
          nextOperatorId
      ) {
        continue;
      }

      node.operatorId =
        nextOperatorId;
      node.parameters =
        nodeGraphClone(
          migrated.parameters || {}
        );
      migrations.push({
        nodeId:
          String(node.id || ""),
        from: previousOperatorId,
        to: nextOperatorId
      });
    }

    for (const connection of
      graphDocument.connections) {
      const migrated =
        sanitizedConnections.get(
          String(
            connection?.id || ""
          )
        );

      if (!migrated) {
        continue;
      }

      const nextFromPort = String(
        migrated.fromPort || ""
      );
      const nextToPort = String(
        migrated.toPort || ""
      );
      if (
        nextFromPort !==
          String(
            connection.fromPort || ""
          ) ||
        nextToPort !==
          String(
            connection.toPort || ""
          )
      ) {
        connection.fromPort =
          nextFromPort;
        connection.toPort =
          nextToPort;
        remappedConnectionCount += 1;
      }
    }

    if (
      replacementGeometrySignature(
        graphDocument,
        nodeIds
      ) !== geometrySignature
    ) {
      throw new Error(
        "Legacy operator migration changed stored node or wire geometry. The JSON was not loaded."
      );
    }

    return Object.freeze({
      migratedNodeCount:
        migrations.length,
      remappedConnectionCount,
      migrations:
        Object.freeze(
          migrations.map(value =>
            Object.freeze({
              ...value
            })
          )
        )
    });
  }

function portableApiContract(
    definition
  ) {
    const contract =
      definition?.apiVerification;

    if (
      definition?.catalogGenerated !==
        true ||
      !contract ||
      typeof contract !== "object" ||
      !String(contract.ownerType || "").trim() ||
      !String(contract.kind || "").trim()
    ) {
      return null;
    }

    const contractInputPorts = new Map(
      (Array.isArray(contract.inputPorts) ? contract.inputPorts : []).map(port => [String(port?.id || ""), port])
    );
    const contractOutputPorts = new Map(
      (Array.isArray(contract.outputPorts) ? contract.outputPorts : []).map(port => [String(port?.id || ""), port])
    );
    const normalizePort = (port, direction) => ({
      id: String(port?.id || ""),
      type: String(port?.type || ""),
      typeVar: String(port?.typeVar || ""),
      generic:
        port?.generic === true,
      optional:
        port?.optional === true,
      role: String(
        (direction === "input" ? contractInputPorts : contractOutputPorts)
          .get(String(port?.id || ""))?.role ||
        `${direction}:${String(port?.id || "")}`
      )
    });

    return {
      schemaVersion: 3,
      kind: String(contract.kind || ""),
      ownerType: String(
        contract.ownerType || ""
      ),
      memberName: String(
        contract.memberName || ""
      ),
      signature: String(
        contract.signature || ""
      ),
      parameters:
        Array.isArray(contract.parameters)
          ? nodeGraphClone(contract.parameters)
          : [],
      returnType: String(
        contract.returnType || "System.Void"
      ),
      isStatic:
        contract.isStatic === true,
      genericArity: Math.max(
        0,
        Number(contract.genericArity) || 0
      ),
      runtimeBound:
        contract.runtimeBound === true,
      stableContractId: String(
        contract.stableContractId || ""
      ),
      canonicalOperatorId: String(
        definition.canonicalOperatorId ||
        contract.nodeId ||
        ""
      ),
      inputPorts:
        (Array.isArray(definition.inputs)
          ? definition.inputs
          : []).map(port => normalizePort(port, "input")),
      outputPorts:
        (Array.isArray(definition.outputs)
          ? definition.outputs
          : []).map(port => normalizePort(port, "output"))
    };
  }

function portableApiContractForNode(
    node
  ) {
    const definition =
      OPERATOR_DEFINITIONS[
        node?.operatorId
      ];

    if (
      definition?.unavailableApiContract === true &&
      definition.preservedApiContract &&
      typeof definition.preservedApiContract === "object"
    ) {
      return nodeGraphClone(definition.preservedApiContract);
    }

    return portableApiContract(
      definition
    ) || (
      node?.apiContract &&
      typeof node.apiContract === "object" &&
      !Array.isArray(node.apiContract)
        ? nodeGraphClone(node.apiContract)
        : null
    );
  }

function serializableGraphView(source) {
    const view = graphViewFrom(source);
    return {
      nodes: view.nodes.map(node => ({
        id: node.id,
        kind: node.kind,
        ...(node.kind === "operator"
          ? {
              operatorId:
                node.operatorId,
              ...(portableApiContractForNode(
                node
              )
                ? {
                    apiContract:
                      portableApiContractForNode(
                        node
                      )
                  }
                : {})
            }
          : {}),
        x: node.x,
        y: node.y,
        width:
          Number.isFinite(node.width)
            ? node.width
            : null,
        height:
          Number.isFinite(node.height)
            ? node.height
            : null,
        label: node.label || "",
        parameters:
          serializableNodeParameters(
            node
          )
      })),
      connections:
        view.connections.map(
          connection => ({
            id: connection.id,
            fromNode:
              connection.fromNode,
            fromPort:
              connection.fromPort,
            toNode:
              connection.toNode,
            toPort:
              connection.toPort,
            points:
              (connection.points || [])
                .map(point => ({
                  id: point.id,
                  x: point.x,
                  y: point.y
                })),
            branchFrom:
              connection.branchFrom
                ? {
                    connectionId:
                      connection.branchFrom
                        .connectionId,
                    pointId:
                      connection.branchFrom
                        .pointId
                  }
                : null
          })
        ),
      viewport: {
        ...view.viewport
      },
      selectedNodeId:
        view.selectedNodeId,
      selectedNodeIds:
        Array.isArray(view.selectedNodeIds)
          ? [...view.selectedNodeIds]
          : [],
      selectedConnectionId:
        view.selectedConnectionId,
      selectedWirePoint:
        view.selectedWirePoint
          ? {
              connectionId:
                view.selectedWirePoint
                  .connectionId,
              pointId:
                view.selectedWirePoint
                  .pointId
            }
          : null,
      nextSequence:
        view.nextSequence
    };
  }

function graphSerializableState(
    options = {}
  ) {
    const viewOnly =
      options.viewOnly === true;
    captureCustomCSharpEditorView({
      synchronizeSource: !viewOnly
    });
    captureApiCompositeEditorView({
      synchronizeBoundaries: !viewOnly
    });
    const rootView = rootRuntimeGraphView();
    const customCSharpFiles =
      serializableCustomCSharpFiles(
        graph.customCSharpFiles
      );
    const apiCompositeGraphs = {};
    for (const [ownerId, composite] of
      Object.entries(
        graph.apiCompositeGraphs || {}
      )) {
      const owner = rootView.nodes.find(
        node => node?.id === ownerId
      );
      const title = String(
        owner?.parameters?.title ||
        owner?.label ||
        composite?.title ||
        "API Composite"
      );
      const portLayout =
        owner?.parameters?.portLayout ===
          "mirrored"
          ? "mirrored"
          : "standard";
      const fingerprintNameKey =
        savedApiCompositeNameKey(title);
      const fingerprintNeedsRefresh =
        !viewOnly &&
        (
          !String(
            composite.contentFingerprint ||
            ""
          ) ||
          composite.fingerprintNameKey !==
            fingerprintNameKey ||
          composite.fingerprintPortLayout !==
            portLayout ||
          apiCompositeEditor
            ?.containerNodeId === ownerId
        );
      const contentFingerprint =
        fingerprintNeedsRefresh
          ? savedApiCompositeFingerprint(
              title,
              composite,
              portLayout
            )
          : String(
              composite.contentFingerprint
            );
      composite.contentFingerprint =
        contentFingerprint;
      composite.fingerprintNameKey =
        fingerprintNameKey;
      composite.fingerprintPortLayout =
        portLayout;
      if (owner) {
        owner.parameters =
          owner.parameters &&
          typeof owner.parameters === "object"
            ? owner.parameters
            : {};
        owner.parameters.apiCompositeFingerprint =
          contentFingerprint;
      }
      apiCompositeGraphs[ownerId] = {
        version: 1,
        title,
        contentFingerprint,
        fingerprintNameKey,
        fingerprintPortLayout:
          portLayout,
        createdCatalogFingerprint:
          String(
            composite
              ?.createdCatalogFingerprint ||
            ""
          ),
        createdEngineVersion:
          String(
            composite
              ?.createdEngineVersion ||
            ""
          ),
        boundaryPorts:
          apiCompositeBoundaryRecords(
            composite?.boundaryPorts
          ),
        branchRouting:
          nodeGraphClone(
            composite?.branchRouting || {}
          ),
        customCSharpFiles:
          serializableCustomCSharpFiles(
            customCSharpFilesForNodes(
              composite?.nodes,
              graph.customCSharpFiles
            )
          ),
        ...serializableGraphView(
          composite
        )
      };
    }
    return {
      version: GRAPH_SCHEMA_VERSION,
      revision: Math.max(0, Math.trunc(finiteNumber(graph.revision, graphCodegenRevision))),
      active: graph.active,
      lastOpenPage: graph.lastOpenPage === "runtime-graph" ? "runtime-graph" : "configuration-outline",
      sourceSignature: graph.sourceSignature,
      showAdvancedNodes: graph.showAdvancedNodes === true,
      apiCompatibility:
        graph.apiCompatibility &&
        typeof graph.apiCompatibility === "object"
          ? nodeGraphClone(graph.apiCompatibility)
          : {
              schemaVersion: 1,
              history: []
            },
      integratedNodeCompatibility:
        nodeGraphClone(
          currentIntegratedNodeContract()
        ),
      configSnapshot: graph.configSnapshot ? nodeGraphClone(graph.configSnapshot) : null,
      customCSharpFiles,
      apiCompositeGraphs,
      ...serializableGraphView(rootView)
    };
  }

function scheduleGeneratedOutputRefresh() {
    const projectEpoch =
      builderProjectEpoch;
    if (
      generatedOutputRefreshQueued &&
      generatedOutputRefreshEpoch ===
        projectEpoch
    ) {
      return;
    }

    generatedOutputRefreshQueued = true;
    generatedOutputRefreshEpoch =
      projectEpoch;
    const run = () => {
      if (
        generatedOutputRefreshEpoch !==
          projectEpoch
      ) {
        return;
      }
      generatedOutputRefreshQueued = false;
      if (
        projectEpoch !==
          builderProjectEpoch
      ) {
        return;
      }
      bridge
        .requestGeneratedOutputRefresh
        ?.();
    };

    queueMicrotask(run);
  }

function persistGraph(
    immediate = false,
    refreshGeneratedOutput = true,
    viewOnly = false,
    refreshCompositeActions = false
  ) {
    if (!viewOnly && graphViewPersistTimer) {
      clearTimeout(graphViewPersistTimer);
      graphViewPersistTimer = 0;
      graphViewPersistContentDirty = false;
    }
    if (refreshGeneratedOutput) {
      refreshVisibleInspectorActionControls();
    }
    const schedule =
      ++persistSchedule;
    const projectEpoch =
      builderProjectEpoch;
    persistGeneratedOutputDirty =
      persistGeneratedOutputDirty ||
      refreshGeneratedOutput;

    const commit = () => {
      if (
        schedule !== persistSchedule ||
        projectEpoch !==
          builderProjectEpoch
      ) {
        return;
      }
      const refreshOutput =
        persistGeneratedOutputDirty;
      persistGeneratedOutputDirty = false;
      graphNodeDefinitionCache = new WeakMap();
      graphNodeLookupSource = null;
      graphConnectionLookupSource = null;

      if (refreshOutput) {
        graphCodegenRevision =
          Math.max(
            graphCodegenRevision,
            Math.trunc(
              finiteNumber(
                graph.revision,
                0
              )
            )
          ) + 1;
        graph.revision =
          graphCodegenRevision;
        typedGraphCodegenCacheKey = "";
        typedGraphCodegenCache = null;
      }

      graph.version = GRAPH_SCHEMA_VERSION;
      const persistedGraph =
        graphSerializableState({
          viewOnly
        });
      if (
        refreshOutput ||
        refreshCompositeActions
      ) {
        refreshVisibleApiCompositeInspectorSaveActions();
        refreshVisibleSavedApiCompositeUpdateActions();
      }
      lastPersistedGraphReference = persistedGraph;

      bridge.setExtensionState(
        EXTENSION_NAME,
        persistedGraph,
        {
          assumeDetached: true,
          persistImmediately:
            immediate
        }
      );

      if (refreshOutput) {
        scheduleGeneratedOutputRefresh();
      }
    };

    if (immediate) {
      commit();
    } else {
      queueMicrotask(commit);
    }
  }

function persistGraphView(
    immediate = false,
    contentChanged = false
  ) {
    graphViewPersistContentDirty =
      graphViewPersistContentDirty ||
      contentChanged;

    if (graphViewPersistTimer) {
      clearTimeout(graphViewPersistTimer);
      graphViewPersistTimer = 0;
    }

    const commit = () => {
      const refreshContent =
        graphViewPersistContentDirty;
      graphViewPersistContentDirty = false;
      persistGraph(
        immediate,
        false,
        !refreshContent,
        refreshContent
      );
    };

    if (immediate) {
      commit();
      return;
    }

    const projectEpoch =
      builderProjectEpoch;
    const commitWhenIdle = () => {
      graphViewPersistTimer = 0;
      if (
        projectEpoch !==
          builderProjectEpoch
      ) {
        graphViewPersistContentDirty =
          false;
        return;
      }
      if (activeInteraction) {
        graphViewPersistTimer =
          window.setTimeout(
            commitWhenIdle,
            GRAPH_VIEW_PERSIST_IDLE_MILLISECONDS
          );
        return;
      }
      commit();
    };
    graphViewPersistTimer =
      window.setTimeout(
        commitWhenIdle,
        GRAPH_VIEW_PERSIST_IDLE_MILLISECONDS
      );
  }

function flushGraphViewPersistence(
    immediate = true
  ) {
    if (!graphViewPersistTimer) {
      return false;
    }
    clearTimeout(graphViewPersistTimer);
    graphViewPersistTimer = 0;
    const refreshContent =
      graphViewPersistContentDirty;
    graphViewPersistContentDirty = false;
    persistGraph(
      immediate,
      false,
      !refreshContent,
      refreshContent
    );
    return true;
  }

function snapshotSignature(snapshot) {
    return hashText(
      JSON.stringify({
        metadata:
          snapshot?.metadata || {},
        nodes:
          snapshot?.nodes || []
      })
    );
  }

function currentBuilderSignature() {
    return snapshotSignature(
      snapshotFromBuilder()
    );
  }

function variadicReducePreview(node, context, operation, type) {
    const ids = variadicInputIds(node);
    let result = ids.length > 0
      ? previewInputValue(node, (nodeDefinition(node).inputs || [])[0], context)
      : previewDefaultValue(type);

    for (let index = 1; index < ids.length; index += 1) {
      const spec = nodeDefinition(node).inputs.find(item => item.id === ids[index]);
      result = previewMapBinary(
        result,
        spec ? previewInputValue(node, spec, context) : previewDefaultValue(type),
        operation,
        type
      );
    }
    return result;
  }

function serializableNodeParameters(
    node
  ) {
    const parameters =
      nodeGraphClone(node?.parameters || {});

    return normalizePortLayoutParameter(
      parameters,
      nodeDefinition(node),
      node?.kind === "configuration"
    );
  }

function previewKnown(
    type,
    value
  ) {
    return {
      known: true,
      type,
      value,
      reason: ""
    };
  }

function previewUnknown(
    type,
    reason
  ) {
    return {
      known: false,
      type: type || null,
      value: null,
      reason:
        reason ||
        "Runtime value"
    };
  }

function previewDefaultValue(type) {
    if (type === "bool") {
      return previewKnown(type, false);
    }

    if (
      type === "int" ||
      type === "float" ||
      type === "double"
    ) {
      return previewKnown(type, 0);
    }

    if (
      /^(?:int|float|double)[234]$/.test(
        type || ""
      )
    ) {
      const count =
        Number(
          String(type).slice(-1)
        );

      return previewKnown(
        type,
        Array.from(
          { length: count },
          () => 0
        )
      );
    }

    if (type === "colorX") {
      return previewKnown(
        type,
        [0, 0, 0, 0]
      );
    }

    if (
      type === "string" ||
      type === "Uri"
    ) {
      return previewKnown(type, "");
    }

    if (
      typeof type === "string" &&
      type.startsWith("enum:")
    ) {
      return previewKnown(type, "0");
    }

    return previewUnknown(
      type,
      "Unbound value"
    );
  }

function previewConfigurationValue(
    sourceNode,
    type,
    previewSnapshot = null
  ) {
    if (!sourceNode) {
      return previewDefaultValue(type);
    }

    if (sourceNode.kind === "controller") {
      const current =
        previewSnapshot?.controllers?.[
          sourceNode.id
        ];

      return previewKnown(
        type,
        current ??
          sourceNode.defaultOption ??
          sourceNode.options?.[0]?.name ??
          "0"
      );
    }

    const currentValue =
      previewSnapshot?.values?.[
        sourceNode.id
      ];
    const raw =
      currentValue !== undefined &&
      currentValue !== null
        ? currentValue
        : sourceNode.defaultValue;

    if (type === "bool") {
      return previewKnown(
        type,
        String(raw)
          .trim()
          .toLowerCase() !== "false"
      );
    }

    if (
      type === "int" ||
      type === "float" ||
      type === "double"
    ) {
      return previewKnown(
        type,
        previewNumber(raw)
      );
    }

    if (
      /^(?:int|float|double)[234]$/.test(
        type || ""
      )
    ) {
      const count =
        Number(
          String(type).slice(-1)
        );
      const values =
        Array.isArray(raw)
          ? raw.map(previewNumber)
          : String(raw || "")
              .split(",")
              .map(previewNumber);

      while (values.length < count) {
        values.push(0);
      }

      return previewKnown(
        type,
        values.slice(0, count)
      );
    }

    if (type === "colorX") {
      const colorState =
        previewSnapshot?.colorStates?.[
          sourceNode.id
        ];

      if (colorState) {
        const strength =
          Number(colorState.strength) || 1;

        return previewKnown(
          type,
          [
            previewNumber(colorState.red) * strength,
            previewNumber(colorState.green) * strength,
            previewNumber(colorState.blue) * strength,
            previewNumber(colorState.alpha)
          ]
        );
      }

      return previewKnown(
        type,
        previewColorChannels(raw)
      );
    }

    return previewKnown(
      type,
      String(raw ?? "")
    );
  }

function previewResolvedPortType(
    node,
    spec,
    analysis
  ) {
    return (
      spec?.type ||
      analysis?.bindings
        ?.get(node.id)?.[
          spec?.typeVar
        ] ||
      null
    );
  }

function previewIncomingConnection(
    nodeId,
    portId
  ) {
    return graph.connections.find(
      connection =>
        connection.toNode === nodeId &&
        connection.toPort === portId
    ) || null;
  }

function previewContext() {
    const analysis =
      currentAnalysis ||
      analyzeConnections(
        graph.connections
      );
    const configurationEntries =
      flattenConfiguration(
        graph.configSnapshot?.nodes || []
      );

    return {
      analysis,
      configurationById:
        new Map(
          configurationEntries.map(
            entry => [
              entry.node.id,
              entry.node
            ]
          )
        ),
      previewSnapshot:
        bridge?.getPreviewValueSnapshot?.() ||
        null,
      cache: new Map(),
      stack: new Set()
    };
  }

function previewMapBinary(
    left,
    right,
    operation,
    type
  ) {
    if (
      !left.known ||
      !right.known
    ) {
      return previewUnknown(
        type,
        left.reason ||
          right.reason
      );
    }

    if (
      Array.isArray(left.value) &&
      Array.isArray(right.value)
    ) {
      return previewKnown(
        type,
        left.value.map(
          (value, index) =>
            operation(
              value,
              right.value[index] ?? 0
            )
        )
      );
    }

    return previewKnown(
      type,
      operation(
        left.value,
        right.value
      )
    );
  }

function previewInputValue(
    node,
    inputSpec,
    context
  ) {
    const concreteType =
      previewResolvedPortType(
        node,
        inputSpec,
        context.analysis
      );
    const connection =
      previewIncomingConnection(
        node.id,
        inputSpec.id
      );

    if (!connection) {
      return previewDefaultValue(
        concreteType
      );
    }

    return previewOutputValue(
      connection.fromNode,
      connection.fromPort,
      context
    );
  }

function previewOutputValue(
    nodeId,
    portId,
    context
  ) {
    const key =
      `${nodeId}:${portId}`;

    if (context.cache.has(key)) {
      return context.cache.get(key);
    }

    if (context.stack.has(key)) {
      return previewUnknown(
        null,
        "Cyclic preview dependency"
      );
    }

    context.stack.add(key);

    const node =
      findGraphNode(nodeId);
    const definition =
      node
        ? nodeDefinition(node)
        : null;
    const outputSpec =
      definition?.outputs?.find(
        spec =>
          spec.id === portId
      );

    if (
      !node ||
      !definition ||
      !outputSpec
    ) {
      const missing =
        previewUnknown(
          null,
          "Missing output"
        );
      context.stack.delete(key);
      context.cache.set(key, missing);
      return missing;
    }

    const type =
      previewResolvedPortType(
        node,
        outputSpec,
        context.analysis
      );
    let result;

    if (node.kind === "configuration") {
      if (type === "impulse") {
        result = previewUnknown(
          type,
          "Impulse event"
        );
      } else {
        result =
          previewConfigurationValue(
            context.configurationById.get(
              outputSpec.sourceNodeId
            ),
            type,
            context.previewSnapshot
          );
      }
    } else {
      const input = id => {
        const spec =
          definition.inputs?.find(
            candidate =>
              candidate.id === id
          );

        return spec
          ? previewInputValue(
              node,
              spec,
              context
            )
          : previewDefaultValue(null);
      };

      switch (node.operatorId) {
        case "constant.number":
          result = previewKnown(
            type,
            previewNumber(
              node.parameters?.value
            )
          );
          break;

        case "constant.bool":
          result = previewKnown(
            "bool",
            Boolean(
              node.parameters?.value
            )
          );
          break;

        case "constant.string":
          result = previewKnown(
            "string",
            String(
              node.parameters?.value ?? ""
            )
          );
          break;

        case "constant.color": {
          const channels =
            previewColorChannels(
              node.parameters?.value
            );
          const strength = nodeGraphClamp(
            Number(
              node.parameters
                ?.colorStrength
            ) || 1,
            1,
            10
          );

          result = previewKnown(
            "colorX",
            [
              finiteNumber(channels[0], 0) *
                strength,
              finiteNumber(channels[1], 0) *
                strength,
              finiteNumber(channels[2], 0) *
                strength,
              finiteNumber(channels[3], 1)
            ]
          );
          break;
        }

        case "constant.typedDefault":
          result = previewDefaultValue(type);
          break;

        case "math.add":
          result = variadicReducePreview(
            node, context, (a, b) => a + b, type
          );
          break;

        case "math.subtract":
          result = previewMapBinary(
            input("a"),
            input("b"),
            (a, b) => a - b,
            type
          );
          break;

        case "math.multiply":
          result = variadicReducePreview(
            node, context, (a, b) => a * b, type
          );
          break;

        case "math.divide":
          result = previewMapBinary(
            input("a"),
            input("b"),
            (a, b) =>
              b === 0
                ? Number.NaN
                : a / b,
            type
          );
          break;

        case "math.minimum":
          result = variadicReducePreview(
            node, context, Math.min, type
          );
          break;

        case "math.maximum":
          result = variadicReducePreview(
            node, context, Math.max, type
          );
          break;

        case "math.clamp": {
          const value = input("value");
          const minimum = input("min");
          const maximum = input("max");

          result =
            value.known &&
            minimum.known &&
            maximum.known
              ? previewKnown(
                  type,
                  Math.min(
                    maximum.value,
                    Math.max(
                      minimum.value,
                      value.value
                    )
                  )
                )
              : previewUnknown(
                  type,
                  value.reason ||
                    minimum.reason ||
                    maximum.reason
                );
          break;
        }

        case "math.negate": {
          const value = input("value");
          result = !value.known
            ? previewUnknown(
                type,
                value.reason
              )
            : previewKnown(
                type,
                Array.isArray(value.value)
                  ? value.value.map(
                      component =>
                        -component
                    )
                  : -value.value
              );
          break;
        }

        case "math.absolute": {
          const value = input("value");
          result = !value.known
            ? previewUnknown(
                type,
                value.reason
              )
            : previewKnown(
                type,
                Math.abs(value.value)
              );
          break;
        }

        case "math.lerp": {
          const left = input("a");
          const right = input("b");
          const factor = input("t");

          result =
            left.known &&
            right.known &&
            factor.known
              ? previewMapBinary(
                  left,
                  right,
                  (a, b) =>
                    a +
                    (b - a) *
                      factor.value,
                  type
                )
              : previewUnknown(
                  type,
                  left.reason ||
                    right.reason ||
                    factor.reason
                );
          break;
        }

        case "logic.and":
          result = previewKnown(
            "bool",
            Boolean(input("a").value) &&
              Boolean(input("b").value)
          );
          break;

        case "logic.or":
          result = previewKnown(
            "bool",
            Boolean(input("a").value) ||
              Boolean(input("b").value)
          );
          break;

        case "logic.not":
          result = previewKnown(
            "bool",
            !input("value").value
          );
          break;

        case "logic.equal": {
          const left = input("a");
          const right = input("b");
          result =
            left.known && right.known
              ? previewKnown(
                  "bool",
                  JSON.stringify(
                    left.value
                  ) ===
                    JSON.stringify(
                      right.value
                    )
                )
              : previewUnknown(
                  "bool",
                  left.reason ||
                    right.reason
                );
          break;
        }

        case "logic.greater":
          result = previewKnown(
            "bool",
            input("a").value >
              input("b").value
          );
          break;

        case "logic.less":
          result = previewKnown(
            "bool",
            input("a").value <
              input("b").value
          );
          break;

        case "logic.select": {
          const condition =
            input("condition");
          result = condition.known
            ? input(
                condition.value
                  ? "true"
                  : "false"
              )
            : previewUnknown(
                type,
                condition.reason
              );
          break;
        }

        case "cast.doubleToFloat":
        case "cast.floatToInt": {
          const value = input("value");
          result = value.known
            ? previewKnown(
                type,
                node.operatorId ===
                  "cast.floatToInt"
                  ? Math.trunc(value.value)
                  : Number(value.value)
              )
            : previewUnknown(
                type,
                value.reason
              );
          break;
        }

        case "cast.toString": {
          const value = input("value");
          result = value.known
            ? previewKnown(
                "string",
                previewFormatValue(value)
              )
            : previewUnknown(
                "string",
                value.reason
              );
          break;
        }

        case "resonite.valueRelay":
        case "resonite.displayValue":
          result = input("value");
          break;

        case "resonite.store":
        case "resonite.executionStore":
          result = input("value");
          break;

        case "resonite.packColorX":
          result = previewKnown(
            "colorX",
            [
              input("r").value || 0,
              input("g").value || 0,
              input("b").value || 0,
              input("a").value || 0
            ]
          );
          break;

        case "resonite.unpackColorX": {
          const value = input("value");
          const index =
            ["r", "g", "b", "a"]
              .indexOf(portId);
          result = value.known
            ? previewKnown(
                "float",
                value.value?.[index] || 0
              )
            : previewUnknown(
                "float",
                value.reason
              );
          break;
        }

        default: {
          const evaluator =
            definition.previewEvaluate;

          if (
            typeof evaluator ===
            "function"
          ) {
            try {
              const evaluated =
                evaluator({
                  node,
                  definition,
                  portId,
                  type,
                  input,
                  known: previewKnown,
                  unknown: previewUnknown,
                  defaultValue:
                    previewDefaultValue,
                  number: previewNumber,
                  colorChannels:
                    previewColorChannels,
                  format:
                    previewFormatValue
                });

              result =
                evaluated === undefined
                  ? previewUnknown(
                      type,
                      "Runtime-only value"
                    )
                  : evaluated;
            } catch (error) {
              result = previewUnknown(
                type,
                error instanceof Error
                  ? error.message
                  : String(error)
              );
            }
          } else {
            result = previewUnknown(
              type,
              type === "impulse"
                ? "Impulse event"
                : "Runtime-only value"
            );
          }
          break;
        }
      }
    }

    context.stack.delete(key);
    context.cache.set(key, result);
    return result;
  }

const previewFlowOnceState =
    new Set();

function previewImpulseInputValue(
    node,
    inputId
  ) {
    const definition =
      nodeDefinition(node);
    const specification =
      definition?.inputs?.find(
        input => input.id === inputId
      );

    if (!specification) {
      return previewUnknown(
        null,
        `Missing input ${inputId}`
      );
    }

    return previewInputValue(
      node,
      specification,
      previewContext()
    );
  }

function previewMenuItemId(result) {
    if (!result?.known) return "";

    return String(
      result.value?.itemId || ""
    );
  }

function previewApplyConfigurationAction(
    node,
    statistics
  ) {
    const input = id =>
      previewImpulseInputValue(
        node,
        id
      );
    const itemId = () =>
      previewMenuItemId(
        input("item")
      );
    let action;
    let payload;

    switch (node.operatorId) {
      case "configuration.setVisibility":
        action = "visibility";
        payload = {
          itemId: itemId(),
          visible:
            Boolean(input("visible").value)
        };
        break;

      case "configuration.setOrder":
        action = "order";
        payload = {
          itemId: itemId(),
          order: input("order").value
        };
        break;

      case "configuration.setValue":
        action = "value";
        payload = {
          itemId: itemId(),
          value: input("value").value,
          save:
            Boolean(input("save").value)
        };
        break;

      case "configuration.saveSettings":
        action = "saveSettings";
        payload = {};
        break;

      case "configuration.setLayout":
        action = "layout";
        payload = {
          itemId: itemId(),
          horizontal:
            Boolean(
              input("horizontal").value
            )
        };
        break;

      case "configuration.setWidth":
        action = "width";
        payload = {
          itemId: itemId(),
          width: input("width").value
        };
        break;

      case "configuration.setLabelVisibility":
        action = "labelVisibility";
        payload = {
          itemId: itemId(),
          visible:
            Boolean(input("visible").value)
        };
        break;

      case "configuration.resetItem":
        action = "resetItem";
        payload = {
          itemId: itemId()
        };
        break;

      case "configuration.resetMenu":
        action = "resetMenu";
        payload = {};
        break;

      default:
        return false;
    }

    const result =
      bridge
        ?.applyPreviewConfigurationMenuAction
        ?.(action, payload);

    if (result?.applied) {
      statistics.actionsApplied += 1;
    } else {
      statistics.runtimeOnlySkipped += 1;
      statistics.messages.push(
        result?.message ||
          `${node.operatorId} had no valid Preview target.`
      );
    }

    return (
      node.operatorId ===
        "configuration.saveSettings" &&
      !result?.applied
        ? "failed"
        : "done"
    );
  }

function previewConfigurationImpulse(
    outlineNodeId
  ) {
    const statistics = {
      started: false,
      actionsApplied: 0,
      runtimeOnlySkipped: 0,
      steps: 0,
      error: false,
      message: "",
      messages: []
    };

    if (!hasPackedRuntimeProgram()) {
      statistics.message =
        "Typed Runtime Graph has not been packed yet";
      return statistics;
    }

    synchronizePackedSnapshot(false);

    const outputPort =
      `config-${String(
        outlineNodeId || ""
      )}`;
    const configurationIds =
      new Set(
        graph.nodes
          .filter(
            node =>
              node.kind ===
              "configuration"
          )
          .map(node => node.id)
      );
    const queue = graph.connections
      .filter(connection =>
        configurationIds.has(
          connection.fromNode
        ) &&
        connection.fromPort ===
          outputPort
      )
      .map(connection => ({
        nodeId: connection.toNode,
        inputPortId:
          connection.toPort
      }));

    if (queue.length === 0) {
      statistics.message =
        "Configuration impulse has no connected graph path";
      return statistics;
    }

    statistics.started = true;
    const visits = new Map();
    const enqueueOutputs = (
      nodeId,
      outputPortIds
    ) => {
      for (const outputPortId of
        outputPortIds) {
        for (const connection of
          graph.connections) {
          if (
            connection.fromNode ===
              nodeId &&
            connection.fromPort ===
              outputPortId
          ) {
            queue.push({
              nodeId:
                connection.toNode,
              inputPortId:
                connection.toPort
            });
          }
        }
      }
    };

    while (
      queue.length > 0 &&
      statistics.steps < 2048
    ) {
      const current = queue.shift();
      const endpoint =
        `${current.nodeId}:${current.inputPortId}`;
      const visitCount =
        (visits.get(endpoint) || 0) + 1;
      visits.set(endpoint, visitCount);

      if (visitCount > 32) {
        statistics.runtimeOnlySkipped += 1;
        statistics.messages.push(
          `Preview stopped a repeating impulse at ${endpoint}.`
        );
        continue;
      }

      statistics.steps += 1;
      const node = findGraphNode(
        current.nodeId
      );

      if (!node) continue;

      const configurationOutput =
        previewApplyConfigurationAction(
          node,
          statistics
        );

      if (configurationOutput) {
        enqueueOutputs(
          node.id,
          [configurationOutput]
        );
        continue;
      }

      let outputPortIds = [];

      switch (node.operatorId) {
        case "flow.branch": {
          const condition =
            previewImpulseInputValue(
              node,
              "condition"
            );

          if (condition.known) {
            outputPortIds = [
              condition.value
                ? "true"
                : "false"
            ];
          } else {
            statistics.runtimeOnlySkipped +=
              1;
            statistics.messages.push(
              "Branch condition is runtime-only in Preview."
            );
          }
          break;
        }

        case "flow.gate": {
          const open =
            previewImpulseInputValue(
              node,
              "open"
            );

          if (open.known && open.value) {
            outputPortIds = [
              "passed"
            ];
          } else if (!open.known) {
            statistics.runtimeOnlySkipped +=
              1;
          }
          break;
        }

        case "flow.once":
          if (
            current.inputPortId ===
            "reset"
          ) {
            previewFlowOnceState.delete(
              node.id
            );
          } else if (
            !previewFlowOnceState.has(
              node.id
            )
          ) {
            previewFlowOnceState.add(
              node.id
            );
            outputPortIds = [
              "passed"
            ];
          }
          break;

        case "flow.sequence":
        case "flow.impulseMerge":
          outputPortIds =
            impulseOutputsForInput(
              node,
              current.inputPortId
            );
          break;

        default: {
          const routed =
            impulseOutputsForInput(
              node,
              current.inputPortId
            );
          const definition =
            nodeDefinition(node);
          const hasExplicitRoute =
            Boolean(
              definition?.impulseRoutes &&
              Object.hasOwn(
                definition.impulseRoutes,
                current.inputPortId
              )
            );

          if (
            hasExplicitRoute ||
            routed.length === 1
          ) {
            outputPortIds = routed;
          } else if (routed.length > 1) {
            statistics.runtimeOnlySkipped +=
              1;
            statistics.messages.push(
              `${node.operatorId || "Runtime node"} has multiple runtime-dependent impulse outputs.`
            );
          }

          if (
            node.kind === "operator" &&
            !node.operatorId?.startsWith(
              "flow."
            )
          ) {
            statistics.runtimeOnlySkipped +=
              1;
          }
          break;
        }
      }

      enqueueOutputs(
        node.id,
        outputPortIds
      );
    }

    if (statistics.steps >= 2048) {
      statistics.error = true;
      statistics.message =
        "Preview impulse stopped at its safety limit";
    } else if (
      statistics.actionsApplied === 0
    ) {
      statistics.message =
        statistics.messages[0] ||
        "No Preview-safe Configuration Menu action was reached";
    } else {
      statistics.message =
        "Local Configuration Menu Preview updated";
    }

    delete statistics.messages;
    return statistics;
  }

function previewConfigurationPhase(
    phase,
    outlineNodeId = ""
  ) {
    const normalizedPhase =
      String(phase || "")
        .trim()
        .toLowerCase();
    const requestedId =
      String(outlineNodeId || "");
    const statistics = {
      phase: normalizedPhase,
      started: false,
      reactions: 0,
      actionsApplied: 0,
      runtimeOnlySkipped: 0,
      steps: 0,
      error: false,
      message: ""
    };

    if (
      normalizedPhase !== "startup" &&
      normalizedPhase !== "saved"
    ) {
      statistics.error = true;
      statistics.message =
        "Unknown Configuration Preview phase";
      return statistics;
    }

    if (!hasPackedRuntimeProgram()) {
      statistics.message =
        "Typed Runtime Graph has not been packed yet";
      return statistics;
    }

    synchronizePackedSnapshot(false);

    if (normalizedPhase === "startup") {
      previewFlowOnceState.clear();
    }

    const snapshot =
      graph.configSnapshot ||
      snapshotFromBuilder();
    const sources =
      flattenConfiguration(
        snapshot?.nodes || []
      )
        .map(entry => entry?.node)
        .filter(node =>
          node &&
          node.kind !== "layoutRow" &&
          (!requestedId ||
            String(node.id || "") ===
              requestedId) &&
          (
            normalizedPhase === "startup"
              ? runtimeBehaviorIncludesStartup(
                  node.reaction
                )
              : runtimeBehaviorIncludesSaved(
                  node.reaction
                )
          )
        );

    for (const source of sources) {
      const result =
        previewConfigurationImpulse(
          source.id
        );

      statistics.reactions += 1;
      statistics.started =
        statistics.started ||
        result.started === true;
      statistics.actionsApplied +=
        Number(
          result.actionsApplied || 0
        );
      statistics.runtimeOnlySkipped +=
        Number(
          result.runtimeOnlySkipped || 0
        );
      statistics.steps +=
        Number(result.steps || 0);
      statistics.error =
        statistics.error ||
        result.error === true;
    }

    if (sources.length === 0) {
      statistics.message = requestedId
        ? `Configuration item has no ${normalizedPhase} reaction`
        : `No ${normalizedPhase} Configuration reactions`;
    } else if (
      statistics.actionsApplied > 0
    ) {
      statistics.message =
        `Local ${normalizedPhase} Configuration Preview updated`;
    } else if (statistics.started) {
      statistics.message =
        `${normalizedPhase} reactions executed locally`;
    } else {
      statistics.message =
        `${normalizedPhase} reactions have no connected graph path`;
    }

    return statistics;
  }

function previewFormatNumber(value) {
    if (!Number.isFinite(value)) {
      return String(value);
    }

    if (Number.isInteger(value)) {
      return String(value);
    }

    return Number(
      Number(value)
        .toPrecision(8)
    ).toString();
  }

function previewFormatValue(preview) {
    if (!preview?.known) {
      return preview?.reason ||
        "Runtime value";
    }

    if (preview.type === "bool") {
      return preview.value
        ? "true"
        : "false";
    }

    if (
      typeof preview.value ===
      "number"
    ) {
      return previewFormatNumber(
        preview.value
      );
    }

    if (Array.isArray(preview.value)) {
      const values =
        preview.value.map(
          value =>
            previewFormatNumber(value)
        );

      if (preview.type === "colorX") {
        return `colorX(${values.join(", ")})`;
      }

      return `${preview.type || "value"}(${values.join(", ")})`;
    }

    return String(
      preview.value ?? ""
    );
  }

function runtimeBridgeChannelForGraph() {
    const stateSnapshot =
      bridge?.getStateSnapshot?.() ||
      {};
    const metadata =
      stateSnapshot.metadata ||
      graph?.configSnapshot?.metadata ||
      {};
    const namespaceName =
      graphCsNamespace(
        metadata.namespaceName
      );
    const className =
      graphCsIdentifier(
        metadata.className,
        "YourMod"
      );

    return `${namespaceName}.${className}`;
  }

function graphContainsRuntimeMonitors() {
    return Boolean(
      graph?.nodes?.some(node => {
        const definition =
          nodeDefinition(node);

        return (
          definition?.displaysValue ===
            true ||
          definition?.displaysImpulse ===
            true ||
          (
            node?.operatorId ===
              "collection.collectToList" &&
            (
              node?.parameters?.markAsEditable === true ||
              node?.parameters?.markAsEditable === "true" ||
              node?.parameters?.markAsEditable === 1
            )
          )
        );
      })
    );
  }

function scheduleRuntimeMonitorRefresh() {
    if (runtimeBridgeRefreshFrame) {
      return;
    }

    runtimeBridgeRefreshFrame =
      requestProjectAnimationFrame(() => {
        runtimeBridgeRefreshFrame = 0;
        refreshDisplayValueNodes();
      });
  }

function clearRuntimeBridgeSubscription() {
    runtimeBridgeSubscription?.();
    runtimeBridgeSubscription = null;
    runtimeBridgeChannel = "";
  }

function synchronizeRuntimeBridgeSubscription(
    force = false
  ) {
    const runtimeBridge =
      window.RMLRuntimeBridge;

    if (
      !graph?.active ||
      !runtimeBridge ||
      typeof runtimeBridge.subscribe !==
        "function" ||
      !graphContainsRuntimeMonitors()
    ) {
      clearRuntimeBridgeSubscription();
      scheduleRuntimeMonitorRefresh();
      return;
    }

    const channel =
      runtimeBridgeChannelForGraph();

    if (
      !force &&
      runtimeBridgeSubscription &&
      runtimeBridgeChannel === channel
    ) {
      return;
    }

    clearRuntimeBridgeSubscription();
    runtimeBridgeChannel =
      channel;

    try {
      runtimeBridgeSubscription =
        runtimeBridge.subscribe(
          channel,
          () => {
            scheduleRuntimeMonitorRefresh();
          }
        );
    } catch (error) {
      console.warn(
        "The live Resonite runtime bridge could not be subscribed.",
        error
      );
      clearRuntimeBridgeSubscription();
    }

    scheduleRuntimeMonitorRefresh();
  }

function runtimeBridgeState() {
    const runtimeBridge =
      window.RMLRuntimeBridge;
    const channel =
      runtimeBridgeChannel ||
      runtimeBridgeChannelForGraph();

    return runtimeBridge
      ?.getState?.(channel) || {
        connected: false,
        active: false,
        sessionId: "",
        lastSeenUtc: ""
      };
  }

function liveRuntimeRecordForNode(
    node
  ) {
    const runtimeBridge =
      window.RMLRuntimeBridge;
    const channel =
      runtimeBridgeChannel ||
      runtimeBridgeChannelForGraph();
    const state =
      runtimeBridge
        ?.getState?.(channel);

    if (
      !runtimeBridge ||
      state?.connected !== true ||
      state?.active !== true
    ) {
      return null;
    }

    return runtimeBridge
      .getValue?.(
        channel,
        node.id
      ) || null;
  }

function runtimeStructuredValueText(
    value,
    depth = 0
  ) {
    if (value === null || value === undefined) {
      return "<null>";
    }

    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "bigint"
    ) {
      return String(value);
    }

    if (depth >= 2) {
      return String(value);
    }

    if (Array.isArray(value)) {
      return `[${value
        .map(item =>
          runtimeStructuredValueText(
            item,
            depth + 1
          )
        )
        .join(", ")}]`;
    }

    if (
      typeof value === "object" &&
      typeof value.display === "string"
    ) {
      return value.display;
    }

    if (typeof value === "object") {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }

    return String(value);
  }

function runtimeRecordPresentationText(
    record
  ) {
    if (
      record?.valueKind === "sequence" &&
      Array.isArray(record.value)
    ) {
      return record.value.length > 0
        ? record.value
            .map(value =>
              runtimeStructuredValueText(
                value
              )
            )
            .join("\n")
        : "[]";
    }

    if (
      record?.valueKind === "map" &&
      record.value &&
      typeof record.value === "object" &&
      !Array.isArray(record.value)
    ) {
      const entries =
        Object.entries(record.value);

      return entries.length > 0
        ? entries
            .map(([key, value]) =>
              `${key}: ${runtimeStructuredValueText(value)}`
            )
            .join("\n")
        : "{}";
    }

    return (
      record?.display ||
      (
        record?.isNull
          ? "<null>"
          : ""
      )
    );
  }

function runtimeMonitorPresentation(
    node
  ) {
    const definition =
      nodeDefinition(node);
    const state =
      runtimeBridgeState();
    const record =
      liveRuntimeRecordForNode(
        node
      );

    if (record) {
      const runtimeType =
        record.runtimeType ||
        record.graphType ||
        "runtime value";
      const updated =
        record.updatedAtUtc
          ? new Date(
              record.updatedAtUtc
            ).toLocaleTimeString()
          : "";

      const text =
        runtimeRecordPresentationText(
          record
        );

      return {
        live: true,
        known: true,
        multiline:
          record.valueKind === "sequence" ||
          record.valueKind === "map" ||
          text.includes("\n"),
        label:
          definition?.displaysImpulse
            ? "Live Resonite calls"
            : "Live Resonite value",
        text,
        title:
          `${runtimeType}${
            record.display
              ? ` · ${record.display}`
              : ""
          }${
            updated
              ? ` · ${updated}`
              : ""
          }`
      };
    }

    if (definition?.displaysImpulse) {
      return {
        live: false,
        known: false,
        multiline: false,
        label: "Runtime Only",
        text:
          state.connected
            ? state.active
              ? "0 · no pulse received yet"
              : "Waiting for the generated mod to run"
            : "Scanner connection unavailable",
        title:
          state.connected && state.active
            ? "The matching generated mod is running. This Display Impulse monitor will update immediately when its impulse path fires; its generated runtime also publishes the current counter during monitor refresh."
            : "The live Resonite pulse counter is used when the scanner and matching generated mod are running."
      };
    }

    const preview =
      displayPreviewForNode(
        node
      );

    return {
      live: false,
      known:
        preview.known === true,
      multiline: false,
      label: "Runtime Only",
      text:
        previewFormatValue(
          preview
        ),
      title:
        state.connected
          ? state.active
            ? "No matching live monitor has been published yet. Rebuild and reload the generated mod if this node was added later."
            : "The scanner is connected, but the matching generated mod is not currently publishing."
          : "No scanner connection is available; the local graph preview is shown as the fallback."
    };
  }

function displayPreviewForNode(node) {
    const definition =
      nodeDefinition(node);
    const inputSpec =
      definition?.inputs?.find(
        spec =>
          spec.id === "value"
      );

    if (!inputSpec) {
      return previewUnknown(
        null,
        "No display input"
      );
    }

    const connection =
      previewIncomingConnection(
        node.id,
        inputSpec.id
      );

    if (!connection) {
      return previewUnknown(
        null,
        "Not connected"
      );
    }

    return previewOutputValue(
      connection.fromNode,
      connection.fromPort,
      previewContext()
    );
  }

function refreshDisplayValueNodes() {
    if (!graph) {
      return;
    }

    const roots = [
      dom.nodesHost,
      dom.inspectorContent
    ].filter(Boolean);
    let sizeMayHaveChanged = false;

    for (const root of roots) {
      const monitors =
        root.querySelectorAll(
          ".rml-graph-display-value[data-runtime-monitor-id]"
        );

      for (const host of monitors) {
        const monitorId =
          host.dataset
            .runtimeMonitorId;
        const node =
          graph.nodes.find(
            candidate =>
              candidate.id ===
              monitorId
          );

        if (!node) {
          continue;
        }

        const presentation =
          runtimeMonitorPresentation(
            node
          );
        const label =
          host.querySelector("span");
        const output =
          host.querySelector("output");

        host.classList.toggle(
          "live-runtime",
          presentation.live
        );
        host.classList.toggle(
          "unknown",
          !presentation.known
        );
        host.classList.toggle(
          "multiline",
          presentation.multiline === true
        );

        if (
          label &&
          label.textContent !==
            presentation.label
        ) {
          label.textContent =
            presentation.label;
          sizeMayHaveChanged = true;
        }

        if (
          output &&
          output.textContent !==
            presentation.text
        ) {
          output.textContent =
            presentation.text;
          sizeMayHaveChanged = true;
        }

        if (output) {
          output.title =
            presentation.title ||
            presentation.text;
        }

        host.title =
          presentation.title || "";
      }
    }

    if (sizeMayHaveChanged) {
      scheduleRenderedNodeResizeLimitRefresh();
    }
  }

function cacheDom() {
    dom.palettePanel =
      document.querySelector(
        ".workspace > .palette"
      );
    dom.canvasPanel =
      document.querySelector(
        ".workspace > .canvas"
      );
    dom.inspectorPanel =
      document.querySelector(
        ".workspace > .inspector"
      );
    dom.paletteTitle =
      dom.palettePanel?.querySelector(
        ".panel-title > span"
      ) || null;
    dom.canvasTitle =
      dom.canvasPanel?.querySelector(
        ".panel-title > span"
      ) || null;
    dom.inspectorTitle =
      dom.inspectorPanel?.querySelector(
        ".panel-title > span"
      ) || null;
    dom.paletteContent =
      document.getElementById(
        "palette-content"
      );
    dom.builderCanvas =
      document.getElementById(
        "builder-canvas"
      );
    dom.itemCount =
      document.getElementById(
        "item-count"
      );
    dom.activeContainerName =
      document.getElementById(
        "active-container-name"
      );
    dom.inspectorContent =
      document.getElementById(
        "inspector-content"
      );

    if (
      dom.paletteTitle &&
      !dom.paletteTitleOriginal
    ) {
      dom.paletteTitleOriginal =
        dom.paletteTitle.innerHTML;
    }

    if (
      dom.canvasTitle &&
      !dom.canvasTitleOriginal
    ) {
      dom.canvasTitleOriginal =
        dom.canvasTitle.innerHTML;
    }

    if (
      dom.inspectorTitle &&
      !dom.inspectorTitleOriginal
    ) {
      dom.inspectorTitleOriginal =
        dom.inspectorTitle.innerHTML;
    }
  }

function ensurePackButton() {
    let button =
      document.getElementById(
        "pack-into-node"
      );

    if (!button) {
      button =
        document.createElement(
          "button"
        );
      button.id =
        "pack-into-node";
      button.className =
        "button secondary top-action-button rml-pack-button";
      button.type = "button";
    }

    if (
      button.dataset
        .rmlGraphActionBound !== "true"
    ) {
      button.dataset.rmlGraphActionBound =
        "true";
      button.addEventListener(
        "click",
        togglePackedNodeMode
      );
      const warmRuntimeGraphStyles = () => {
        void ensureRuntimeGraphStyles().catch(() => {});
      };
      button.addEventListener(
        "pointerenter",
        warmRuntimeGraphStyles,
        { passive: true, once: true }
      );
      button.addEventListener(
        "pointerdown",
        warmRuntimeGraphStyles,
        { passive: true, once: true }
      );
      button.addEventListener(
        "focus",
        warmRuntimeGraphStyles,
        { once: true }
      );

    }

    if (!button.isConnected) {
      const exportButton =
        document.getElementById(
          "download-code"
        );

      exportButton?.parentElement
        ?.insertBefore(
          button,
          exportButton
        );
    }

    dom.packButton = button;
    updatePackButton();
  }

function updatePackButton() {
    if (!dom.packButton) {
      return;
    }

    const inlineEditorActive =
      Boolean(customCSharpInlineEditorKey);
    const active = Boolean(
      graph?.active &&
      runtimeGraphViewActive
    );
    const hostLoading =
      !graphHostError &&
      (
        !graphHostInitialized ||
        (
          !bridge ||
          !graph
        )
      );
    const hostFailed =
      Boolean(graphHostError);
    const catalogDependent =
      graphUsesCatalogOperators();
    const catalogLoading =
      hostLoading ||
      runtimeGraphStyleTransitionPending ||
      (
        catalogDependent &&
        graphCatalogReadiness ===
          "pending"
      );
    const catalogFailed =
      hostFailed ||
      (
        !hostLoading &&
        catalogDependent &&
        graphCatalogReadiness ===
          "failed"
      );

    const visualState = inlineEditorActive
      ? "editor-back"
      : catalogLoading
        ? "loading"
        : catalogFailed
          ? hostFailed
            ? "failed-host"
            : "failed-catalog"
          : customCSharpEditor ||
            apiCompositeEditor
            ? "graph-back"
            : active
              ? "outline-back"
              : graph?.active
                ? "graph-open"
                : "graph-pack";

    if (
      dom.packButton.dataset
        .rmlRuntimeButtonVisual !==
        visualState
    ) {
      dom.packButton.dataset
        .rmlRuntimeButtonVisual =
        visualState;
      dom.packButton.innerHTML =
        inlineEditorActive
          ? `<svg class="rml-pack-back-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5 M10 7l-5 5 5 5"></path></svg><span class="top-action-label">Back to Previous Graph</span>`
          : catalogLoading
            ? `<span class="brand-mark rml-pack-brand-mark rml-runtime-graph-loader rml-runtime-graph-spinner" aria-hidden="true"><span></span><span></span></span><span class="top-action-label">Loading Runtime Graph…</span>`
            : catalogFailed
            ? `<span class="brand-mark rml-pack-brand-mark" aria-hidden="true"><span></span><span></span></span><span class="top-action-label">${hostFailed ? "Runtime Graph unavailable" : "Repair Runtime Graph…"}</span>`
            : customCSharpEditor ||
              apiCompositeEditor
              ? `<svg class="rml-pack-back-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5 M10 7l-5 5 5 5"></path></svg><span class="top-action-label">Back to Previous Graph</span>`
            : active
              ? `<svg class="rml-pack-back-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5 M10 7l-5 5 5 5"></path></svg><span class="top-action-label">Back to Outline</span>`
              : graph?.active
                ? `<span class="brand-mark rml-pack-brand-mark" aria-hidden="true"><span></span><span></span></span><span class="top-action-label">Open Runtime Graph</span>`
                : `<span class="brand-mark rml-pack-brand-mark" aria-hidden="true"><span></span><span></span></span><span class="top-action-label">Pack into Node</span>`;
    }

    dom.packButton.setAttribute(
      "aria-label",
      inlineEditorActive
        ? "Close embedded editor and return to the previous graph"
        : catalogLoading
          ? "Runtime Graph is loading"
          : catalogFailed
          ? hostFailed
            ? "Runtime Graph is unavailable"
            : "Review catalog replacements for the Runtime Graph"
          : customCSharpEditor ||
            apiCompositeEditor
            ? "Back to previous graph"
          : active
            ? "Back to Configuration Outline"
            : graph?.active
              ? "Open Runtime Graph"
              : "Pack into Node"
    );

    if (
      catalogLoading &&
      !inlineEditorActive
    ) {
      dom.packButton.setAttribute(
        "aria-busy",
        "true"
      );
    } else {
      dom.packButton.removeAttribute(
        "aria-busy"
      );
    }

    dom.packButton.dataset.runtimeReadiness =
      inlineEditorActive
        ? "ready"
        : catalogLoading
          ? "loading"
          : catalogFailed
            ? "failed"
            : "ready";

    dom.packButton.dataset.helpTone =
      "runtime";
    dom.packButton.dataset.helpKicker =
      "Runtime Graph";

    dom.packButton.classList.toggle(
      "graph-active",
      Boolean(graph?.active)
    );

    const sourceNodes =
      bridge?.getStateSnapshot()
        ?.nodes || [];

    setGraphButtonAvailability(
      dom.packButton,
      inlineEditorActive || !(
        !hostLoading &&
        !hostFailed &&
        sourceNodes.length === 0 &&
        !graph?.active
      ),
      "Add at least one Configuration Outline item before packing or opening the Runtime Graph."
    );

    dom.packButton.dataset.help =
      inlineEditorActive
        ? "Close the embedded Custom C# editor and return to the graph that it replaced."
        : catalogLoading
        ? runtimeGraphStyleTransitionPending
          ? "The Runtime Graph stylesheet is being prepared locally before the view changes."
          : hostLoading
          ? "The Runtime Graph control is ready. The locally restored project state is still being connected to it."
          : graphCatalogReadinessMessage ||
            "The saved graph is available. Its catalog-generated API definitions are still being restored."
        : catalogFailed
          ? hostFailed
            ? `The Runtime Graph base modules failed: ${
                graphHostError instanceof Error
                  ? graphHostError.message
                  : String(graphHostError)
            }`
            : graphCatalogReadinessMessage ||
            "Click to review deterministic replacements for incompatible API nodes, including nodes inside placed API Composites."
        : sourceNodes.length === 0
        ? "Add at least one Configuration Outline item before opening the Typed Runtime Graph."
        : customCSharpEditor ||
          apiCompositeEditor
          ? "Return to the immediately previous main view. This return entry is consumed once, so navigation cannot form a cycle."
        : active
          ? "Return to the Configuration Outline. The packed graph is preserved."
          : graph?.active
            ? "Open the preserved Typed Runtime Graph. Its export remains enabled while the Configuration Outline is visible."
            : "Open the automatically synchronized Typed Runtime Graph. The Configuration Outline remains preserved.";
    dom.packButton.removeAttribute("title");
  }

function ensureGraphViewportToast() {
    let toast =
      document.querySelector(
        '[data-rml-graph-viewport-toast="true"]'
      );

    if (!toast) {
      toast =
        document.createElement("div");
      toast.className =
        "rml-graph-toast";
      toast.dataset.rmlGraphViewportToast =
        "true";
      toast.hidden = true;
      toast.setAttribute(
        "aria-atomic",
        "true"
      );
      document.body.appendChild(toast);
    }

    dom.toast = toast;
    return toast;
  }

function sourceIsOutdated() {
    return Boolean(
      graph?.configSnapshot &&
      graph.sourceSignature &&
      graph.sourceSignature !==
        currentBuilderSignature()
    );
  }

function updateSourceBadge() {
    updatePackButton();

    if (!dom.sourceBadge) {
      return;
    }

    const synchronizing =
      sourceIsOutdated();

    dom.sourceBadge.classList.toggle(
      "outdated",
      synchronizing
    );

    dom.sourceBadge.textContent =
      synchronizing
        ? "Synchronizing packed configuration…"
        : `${
            graph.configSnapshot?.nodes
              ?.length || 0
          } root item(s) packed · auto-synced · strict typed wiring`;
  }

function showGraphMessage(
    text,
    tone = ""
  ) {
    clearTimeout(
      graphMessageTimer
    );

    if (
      !graph?.active ||
      !runtimeGraphViewActive
    ) {
      if (
        typeof window.RMLBuilderDialog
          ?.notice === "function"
      ) {
        void window.RMLBuilderDialog.notice({
          tone:
            tone === "error"
              ? "danger"
              : tone === "success"
                ? "success"
                : "info",
          kicker: "Runtime Graph",
          title:
            tone === "error"
              ? "Graph action unavailable"
              : "Runtime Graph notice",
          message: text,
          confirmLabel: "OK"
        });
      } else {
        console.info(
          `[Runtime Graph] ${text}`
        );
      }
      return;
    }

    const toast =
      ensureGraphViewportToast();

    delete toast.dataset
      .rmlCustomCSharpOperation;
    toast.textContent = text;
    toast.className =
      `rml-graph-toast${
        tone
          ? ` ${tone}`
          : ""
      }`;
    toast.setAttribute(
      "role",
      tone === "error"
        ? "alert"
        : "status"
    );
    toast.setAttribute(
      "aria-live",
      tone === "error"
        ? "assertive"
        : "polite"
    );
    toast.hidden = false;

    graphMessageTimer =
      window.setTimeout(() => {
        if (dom.toast) {
          dom.toast.hidden = true;
        }
      }, 2600);
  }

function ensureConfigurationNode() {
    let node =
      graph.nodes.find(
        candidate =>
          candidate.kind ===
          "configuration"
      );

    if (node) {
      return node;
    }

    node = {
      id: makeId("configuration"),
      kind: "configuration",
      x: 110,
      y: 92,
      width: null,
      height: null,
      label: "",
      parameters: {
        portLayout: "standard"
      }
    };

    graph.nodes.unshift(node);
    return node;
  }

async function togglePackedNodeMode() {
    if (customCSharpInlineEditorKey) {
      closeEmbeddedEditorForGraphReplacement();
      updatePackButton();
      return;
    }

    if (
      graphHostError ||
      !graphHostInitialized ||
      !bridge ||
      !graph
    ) {
      showGraphMessage(
        graphHostError
          ? `The Runtime Graph base modules failed: ${
              graphHostError instanceof Error
                ? graphHostError.message
                : String(graphHostError)
            }`
          : "The Runtime Graph control is visible and the locally restored project state is still being connected. It will become available automatically when the builder bridge-ready event arrives.",
        graphHostError ? "error" : ""
      );
      return;
    }

    if (customCSharpEditor) {
      closeCustomCSharpFileGraph();
      return;
    }
    if (apiCompositeEditor) {
      closeApiCompositeGraph();
      return;
    }

    if (
      graphUsesCatalogOperators() &&
      graphCatalogReadiness !== "ready"
    ) {
      if (
        graphCatalogReadiness === "failed" &&
        apiCompositeCatalogAvailable()
      ) {
        void scheduleOpenGraphCatalogReconciliation({
          force: true
        });
        return;
      }
      showGraphMessage(
        graphCatalogReadinessMessage ||
          (graphCatalogReadiness === "pending"
            ? "The Runtime Graph is still restoring its API node definitions. It will become available automatically when the factory-ready event arrives."
            : "The Runtime Graph cannot be opened because one or more required API node definitions are unavailable."),
        graphCatalogReadiness === "failed"
          ? "error"
          : ""
      );
      return;
    }

    if (
      graph?.active &&
      runtimeGraphViewActive
    ) {
      unpackToOutline();
      return;
    }

    if (runtimeGraphStyleTransitionPending) {
      return;
    }

    runtimeGraphStyleTransitionPending = true;
    updatePackButton();
    try {
      await ensureRuntimeGraphStyles();
    } catch (error) {
      reportRuntimeGraphStyleFailure(error);
      runtimeGraphStyleTransitionPending = false;
      updatePackButton();
      return;
    }
    runtimeGraphStyleTransitionPending = false;

    if (graph?.active) {
      commitPresentationPage(
        "runtime-graph",
        "runtime-graph-open"
      );
      runtimeGraphViewActive = true;
      synchronizePackedSnapshot(false);
      persistGraphView(true);
      activateGraphMode();
    } else {
      packIntoNode();
    }
  }

function pruneConnectionsForConfigurationSnapshot(
    snapshot
  ) {
    const validPorts =
      new Set(
        flattenConfiguration(
          snapshot?.nodes || []
        )
          .filter(
            entry =>
              entry.node?.kind !==
                "layoutRow"
          )
          .map(
            entry =>
              `config-${entry.node.id}`
          )
      );
    const configurationNodeIds =
      new Set(
        graph.nodes
          .filter(
            node =>
              node.kind ===
                "configuration"
          )
          .map(node => node.id)
      );
    const removed = [];

    graph.connections =
      graph.connections.filter(
        connection => {
          const configurationPort =
            configurationNodeIds.has(
              connection.fromNode
            ) &&
            String(
              connection.fromPort || ""
            ).startsWith("config-");
          const keep =
            !configurationPort ||
            validPorts.has(
              connection.fromPort
            );

          if (!keep) {
            removed.push({
              id: connection.id,
              fromNode:
                connection.fromNode,
              fromPort:
                connection.fromPort,
              toNode:
                connection.toNode,
              toPort:
                connection.toPort
            });
          }

          return keep;
        }
      );

    if (removed.length > 0) {
      normalizeConnectionRouting(
        graph.connections
      );
      graph.selectedConnectionId =
        graph.connections.some(
          connection =>
            connection.id ===
              graph.selectedConnectionId
        )
          ? graph.selectedConnectionId
          : null;
      normalizeSelectedWirePoint();
    }

    return removed;
  }

function synchronizePackedSnapshot(
    render = true
  ) {
    if (!hasPackedRuntimeProgram()) {
      return false;
    }

    const snapshot =
      snapshotFromBuilder();
    const signature =
      snapshotSignature(snapshot);

    if (
      graph.sourceSignature ===
        signature &&
      graph.configSnapshot
    ) {
      return false;
    }

    const removedConnections =
      pruneConnectionsForConfigurationSnapshot(
        snapshot
      );
    graph.configSnapshot = snapshot;
    graph.sourceSignature =
      signature;
    ensureConfigurationNode();
    pruneConnections();
    persistGraph(true);

    if (render) {
      renderGraphNodesAndWires();
      renderGraphInspector();
      renderGraphPalette();
    }

    updateSourceBadge();

    if (removedConnections.length > 0) {
      showGraphMessage(
        `${removedConnections.length} connection${removedConnections.length === 1 ? "" : "s"} from removed Configuration Outline items were detached safely.`,
        "warning"
      );
      console.info(
        "Detached connections whose Configuration Outline ports were removed.",
        removedConnections
      );
    }

    return true;
  }

function schedulePackedSnapshotSync() {
    if (!hasPackedRuntimeProgram()) {
      return;
    }

    const projectEpoch =
      builderProjectEpoch;
    if (
      packedSnapshotSyncScheduled &&
      packedSnapshotSyncEpoch ===
        projectEpoch
    ) {
      return;
    }

    packedSnapshotSyncScheduled = true;
    packedSnapshotSyncEpoch =
      projectEpoch;
    queueMicrotask(() => {
      if (
        packedSnapshotSyncEpoch !==
          projectEpoch
      ) {
        return;
      }
      packedSnapshotSyncScheduled = false;
      if (
        projectEpoch !==
          builderProjectEpoch
      ) {
        return;
      }
      synchronizePackedSnapshot(true);
    });
  }

function packIntoNode() {
    const snapshot =
      snapshotFromBuilder();

    if (
      !Array.isArray(snapshot.nodes) ||
      snapshot.nodes.length === 0
    ) {
      showGraphMessage(
        "Add at least one configuration item before packing.",
        "error"
      );
      return;
    }

    graph.active = true;
    commitPresentationPage(
      "runtime-graph",
      "runtime-graph-pack"
    );
    runtimeGraphViewActive = true;
    graph.configSnapshot =
      snapshot;
    graph.sourceSignature =
      snapshotSignature(snapshot);

    const configNode =
      ensureConfigurationNode();

    graph.selectedNodeId =
      configNode.id;
    graph.selectedNodeIds = [
      configNode.id
    ];
    graph.selectedConnectionId =
      null;
    clearSelectedWirePoint();

    pruneConnections();
    persistGraph(true);
    activateGraphMode();

    requestProjectAnimationFrame(() => {
      centerGraph();
    });

    showGraphMessage(
      "Configuration packed into an automatically synchronized typed start node.",
      "success"
    );
  }

function unpackToOutline() {
    if (customCSharpEditor) {
      closeCustomCSharpFileGraph();
    }
    if (apiCompositeEditor) {
      closeApiCompositeGraph();
    }
    cancelInteraction(true);

    

    commitPresentationPage(
      "configuration-outline",
      "runtime-graph-back"
    );
    runtimeGraphViewActive = false;
    graph.selectedNodeId = null;
    graph.selectedNodeIds = [];
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    persistGraphView(true);
    deactivateGraphMode();
    bridge.requestPaletteRender();
    bridge.requestRender();
    updatePackButton();
  }

async function clearGraphOperators() {
    const confirmation =
      window.RMLBuilderDialog
        ?.confirm;

    if (
      typeof confirmation !==
      "function"
    ) {
      showGraphMessage(
        "The confirmation dialog is not available yet.",
        "error"
      );
      return;
    }

    const confirmed =
      await confirmation({
        tone: "danger",
        kicker: "Runtime Graph reset",
        title: "Clear all Runtime Graph operators?",
        message:
          "All operator nodes and wires are removed. The packed configuration start node is kept.",
        details:
          "This changes the generated runtime logic immediately.",
        confirmLabel: "Clear Operators"
      });

    if (!confirmed) {
      return;
    }

    graph.nodes =
      graph.nodes.filter(
        node =>
          node.kind ===
          "configuration"
      );
    graph.connections = [];
    graph.apiCompositeGraphs = {};
    graph.customCSharpFiles = {};
    graph.selectedNodeId =
      graph.nodes[0]?.id || null;
    graph.selectedNodeIds =
      graph.selectedNodeId
        ? [graph.selectedNodeId]
        : [];
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    currentAnalysis =
      analyzeConnections([]);
    persistGraph(true);
    renderGraphCanvas();
    renderGraphPalette();
    renderGraphInspector();
    scheduleGraphNodeVirtualization();
  }

function loadGraphPanelLayout() {
    if (graphPanelsAreStacked()) {
      graphLeftPanelCollapsed = false;
      graphRightPanelCollapsed = false;
      return;
    }
    try {
      const stored = JSON.parse(
        localStorage.getItem(
          GRAPH_PANEL_LAYOUT_STORAGE_KEY
        ) || "{}"
      );
      graphLeftPanelCollapsed =
        stored.left === true;
      graphRightPanelCollapsed =
        stored.right === true;
    } catch {
      graphLeftPanelCollapsed = false;
      graphRightPanelCollapsed = false;
    }
  }

function graphPanelsAreStacked() {
    return window.matchMedia?.("(max-width: 780px)")?.matches === true;
  }

function persistGraphPanelLayout() {
    try {
      localStorage.setItem(
        GRAPH_PANEL_LAYOUT_STORAGE_KEY,
        JSON.stringify({
          left: graphLeftPanelCollapsed,
          right: graphRightPanelCollapsed
        })
      );
    } catch {

    }
  }

function loadGraphPaletteUiState() {
    if (graphPaletteUiLoaded) {
      return;
    }

    graphPaletteUiLoaded = true;

    try {
      const stored = JSON.parse(
        localStorage.getItem(
          GRAPH_PALETTE_UI_STORAGE_KEY
        ) || "{}"
      );
      const groups =
        Object.create(null);

      if (
        stored.groups &&
        typeof stored.groups === "object" &&
        !Array.isArray(stored.groups)
      ) {
        for (
          const [key, open] of
          Object.entries(stored.groups)
            .slice(0, 500)
        ) {
          if (typeof open === "boolean") {
            groups[key] = open;
          }
        }
      }

      graphPaletteUiState = {
        scrollTop: Math.max(
          0,
          finiteNumber(
            stored.scrollTop,
            0
          )
        ),
        groups
      };
    } catch {
      graphPaletteUiState = {
        scrollTop: 0,
        groups: Object.create(null)
      };
    }
  }

function persistGraphPaletteUiState(
    immediate = false
  ) {
    const commit = () => {
      graphPaletteUiPersistScheduled =
        false;

      try {
        localStorage.setItem(
          GRAPH_PALETTE_UI_STORAGE_KEY,
          JSON.stringify({
            scrollTop:
              graphPaletteUiState
                .scrollTop,
            groups:
              graphPaletteUiState.groups
          })
        );
      } catch {

      }
    };

    if (immediate) {
      graphPaletteUiPersistScheduled =
        false;
      commit();
    } else if (
      !graphPaletteUiPersistScheduled
    ) {
      graphPaletteUiPersistScheduled =
        true;
      queueMicrotask(commit);
    }
  }

function captureGraphPaletteUiState() {
    const scroll =
      dom.paletteContent?.querySelector(
        ".rml-graph-palette-scroll"
      );

    if (scroll) {
      graphPaletteUiState.scrollTop =
        Math.max(
          0,
          finiteNumber(
            scroll.scrollTop,
            0
          )
        );
    }

    dom.paletteContent
      ?.querySelectorAll(
        ".rml-graph-palette-group[data-graph-palette-group]"
      )
      .forEach(details => {
        const key =
          details.dataset
            .graphPaletteGroup;

        if (key) {
          graphPaletteUiState
            .groups[key] =
              details.open;
        }
      });
  }

function graphPaletteGroupOpen(
    key,
    defaultOpen = false
  ) {
    return Object.prototype
      .hasOwnProperty.call(
        graphPaletteUiState.groups,
        key
      )
        ? graphPaletteUiState.groups[key]
        : defaultOpen;
  }

function configureGraphPaletteGroup(
    details,
    key,
    defaultOpen = false
  ) {
    details.dataset.graphPaletteGroup =
      key;
    details.open =
      graphPaletteGroupOpen(
        key,
        defaultOpen
      );

    details.addEventListener(
      "toggle",
      () => {
        graphPaletteUiState.groups[key] =
          details.open;
        persistGraphPaletteUiState();
      }
    );
  }

function restoreGraphPaletteScroll(
    scroll
  ) {
    const savedScrollTop =
      graphPaletteUiState.scrollTop;

    requestProjectAnimationFrame(() => {
      if (!scroll.isConnected) {
        return;
      }

      scroll.scrollTop =
        savedScrollTop;
    });
  }

function applyGraphPanelLayout() {
    const stacked = graphPanelsAreStacked();
    if (stacked) {
      graphLeftPanelCollapsed = false;
      graphRightPanelCollapsed = false;
    }
    document.body.classList.toggle(
      "rml-graph-left-collapsed",
      graphLeftPanelCollapsed
    );
    document.body.classList.toggle(
      "rml-graph-right-collapsed",
      graphRightPanelCollapsed
    );

    if (dom.leftPanelToggle) {
      dom.leftPanelToggle.hidden = stacked;
      dom.leftPanelToggle.setAttribute(
        "aria-hidden",
        String(stacked)
      );
      dom.leftPanelToggle.textContent =
        graphLeftPanelCollapsed
          ? "▶"
          : "◀";
      dom.leftPanelToggle.title =
        graphLeftPanelCollapsed
          ? "Show node library"
          : "Hide node library";
      dom.leftPanelToggle.setAttribute(
        "aria-label",
        dom.leftPanelToggle.title
      );
      dom.leftPanelToggle.setAttribute(
        "aria-expanded",
        String(!graphLeftPanelCollapsed)
      );
    }

    if (dom.rightPanelToggle) {
      dom.rightPanelToggle.hidden = stacked;
      dom.rightPanelToggle.setAttribute(
        "aria-hidden",
        String(stacked)
      );
      dom.rightPanelToggle.textContent =
        graphRightPanelCollapsed
          ? "◀"
          : "▶";
      dom.rightPanelToggle.title =
        graphRightPanelCollapsed
          ? "Show node inspector"
          : "Hide node inspector";
      dom.rightPanelToggle.setAttribute(
        "aria-label",
        dom.rightPanelToggle.title
      );
      dom.rightPanelToggle.setAttribute(
        "aria-expanded",
        String(!graphRightPanelCollapsed)
      );
    }

    requestProjectAnimationFrame(() => {
      renderGraphWires();
    });
  }

function ensureGraphPanelToggles() {
    const title =
      dom.canvasPanel?.querySelector(
        ":scope > .panel-title"
      );

    if (!title) return;

    let left = title.querySelector(
      ":scope > .rml-graph-panel-toggle-left"
    );
    if (!left) {
      left = document.createElement("button");
      left.type = "button";
      left.className =
        "rml-graph-panel-toggle rml-graph-panel-toggle-left";
      left.addEventListener("click", () => {
        if (graphPanelsAreStacked()) return;
        graphLeftPanelCollapsed =
          !graphLeftPanelCollapsed;
        persistGraphPanelLayout();
        applyGraphPanelLayout();
      });
      title.insertBefore(left, title.firstChild);
    }

    let right = title.querySelector(
      ":scope > .rml-graph-panel-toggle-right"
    );
    if (!right) {
      right = document.createElement("button");
      right.type = "button";
      right.className =
        "rml-graph-panel-toggle rml-graph-panel-toggle-right";
      right.addEventListener("click", () => {
        if (graphPanelsAreStacked()) return;
        graphRightPanelCollapsed =
          !graphRightPanelCollapsed;
        persistGraphPanelLayout();
        applyGraphPanelLayout();
      });
      title.appendChild(right);
    }

    title.classList.add(
      "rml-workspace-toggle-title"
    );

    dom.leftPanelToggle = left;
    dom.rightPanelToggle = right;
    applyGraphPanelLayout();
  }

function removeGraphPanelToggles() {
    const title =
      dom.canvasPanel?.querySelector(
        ":scope > .panel-title"
      );

    dom.leftPanelToggle?.remove();
    dom.rightPanelToggle?.remove();
    title?.classList.remove(
      "rml-workspace-toggle-title"
    );
    dom.leftPanelToggle = null;
    dom.rightPanelToggle = null;
    document.body.classList.remove(
      "rml-graph-left-collapsed",
      "rml-graph-right-collapsed"
    );
  }

function graphEditModeActive() {
    return document.body.classList.contains(
      "rml-graph-edit-mode"
    );
  }

function clearGraphEditViewportMetrics() {
    if (graphEditViewportFrame) {
      cancelAnimationFrame(
        graphEditViewportFrame
      );
      graphEditViewportFrame = 0;
    }

    const rootData =
      document.documentElement.dataset;
    delete rootData.rmlGraphEditViewportWidth;
    delete rootData.rmlGraphEditViewportHeight;
    delete rootData.rmlGraphEditViewportLeft;
    delete rootData.rmlGraphEditViewportTop;
    delete rootData.rmlGraphEditPaletteHeight;
    delete rootData.rmlGraphEditInspectorHeight;
  }

function updateGraphEditViewportMetrics() {
    if (!graphEditModeActive()) {
      return;
    }

    if (graphEditViewportFrame) {
      cancelAnimationFrame(
        graphEditViewportFrame
      );
    }

    graphEditViewportFrame =
      requestProjectAnimationFrame(() => {
        graphEditViewportFrame = 0;

        const viewport =
          window.visualViewport;
        const width = Math.max(
          1,
          Math.floor(
            viewport?.width ||
            window.innerWidth ||
            document.documentElement.clientWidth ||
            1
          )
        );
        const height = Math.max(
          1,
          Math.floor(
            viewport?.height ||
            window.innerHeight ||
            document.documentElement.clientHeight ||
            1
          )
        );
        const left = Math.max(
          0,
          Math.round(
            viewport?.offsetLeft ||
            0
          )
        );
        const top = Math.max(
          0,
          Math.round(
            viewport?.offsetTop ||
            0
          )
        );
        const paletteHeight =
          Math.min(
            680,
            Math.max(
              320,
              Math.round(
                height * 0.68
              )
            )
          );
        const inspectorHeight =
          Math.min(
            640,
            Math.max(
              300,
              Math.round(
                height * 0.62
              )
            )
          );
        const rootData =
          document.documentElement.dataset;

        rootData.rmlGraphEditViewportWidth =
          String(width);
        rootData.rmlGraphEditViewportHeight =
          String(height);
        rootData.rmlGraphEditViewportLeft =
          String(left);
        rootData.rmlGraphEditViewportTop =
          String(top);
        rootData.rmlGraphEditPaletteHeight =
          String(paletteHeight);
        rootData.rmlGraphEditInspectorHeight =
          String(inspectorHeight);

        applyGraphPanelLayout();
        renderGraphWires();
        scheduleGraphScrollLayerVisualRefresh();
      });
  }

function updateGraphEditModeButton() {
    const active = graphEditModeActive();
    for (const editor of
      customCSharpDetachedEditors.values()) {
      if (
        customCSharpEditorRecordActive(editor) &&
        typeof editor.setPageAreasHidden ===
          "function"
      ) {
        editor.setPageAreasHidden(active);
      }
    }
    if (!dom.editModeButton) {
      return;
    }

    const label =
      active
        ? "Exit Edit Mode"
        : "Edit Mode";
    const labelElement =
      dom.editModeButton.querySelector(
        ".rml-graph-toolbar-sr-label"
      );
    const enterIcon =
      dom.editModeButton.querySelector(
        ".rml-graph-edit-enter-icon"
      );
    const exitIcon =
      dom.editModeButton.querySelector(
        ".rml-graph-edit-exit-icon"
      );

    if (labelElement) {
      labelElement.textContent = label;
    }
    if (enterIcon) {
      enterIcon.hidden = active;
    }
    if (exitIcon) {
      exitIcon.hidden = !active;
    }
    dom.editModeButton.title =
      active
        ? "Show the normal page areas above and below the Runtime Graph"
        : "Hide only the page areas above and below the Runtime Graph";
    dom.editModeButton.dataset.help =
      dom.editModeButton.title;
    dom.editModeButton.setAttribute(
      "aria-label",
      dom.editModeButton.title
    );
    dom.editModeButton.setAttribute(
      "aria-pressed",
      String(active)
    );
    dom.editModeButton.classList.toggle(
      "active",
      active
    );
  }

function refreshGraphAfterEditModeChange() {
    requestProjectAnimationFrame(() => {
      applyGraphPanelLayout();

      requestProjectAnimationFrame(() => {
        renderGraphWires();
        scheduleGraphScrollLayerVisualRefresh();
      });
    });
  }

function setGraphEditMode(
    active,
    restoreScroll = true
  ) {
    const next =
      active === true &&
      graph?.active === true &&
      runtimeGraphViewActive === true;
    const current =
      graphEditModeActive();

    if (next === current) {
      updateGraphEditModeButton();
      if (next) {
        updateGraphEditViewportMetrics();
      }
      return current;
    }

    if (next) {
      graphEditModeScrollY =
        Math.max(
          0,
          window.scrollY ||
          window.pageYOffset ||
          0
        );
    }

    document.documentElement.classList.toggle(
      "rml-graph-edit-mode",
      next
    );
    document.body.classList.toggle(
      "rml-graph-edit-mode",
      next
    );

    clearGraphScrollLayerSelection();
    window.RMLUniversalScrollLayers
      ?.clear?.();

    if (next) {
      updateGraphEditViewportMetrics();
    } else {
      clearGraphEditViewportMetrics();
    }

    updateGraphEditModeButton();
    refreshGraphAfterEditModeChange();

    if (!next && restoreScroll) {
      const scrollY =
        graphEditModeScrollY;

      requestProjectAnimationFrame(() => {
        window.scrollTo({
          left: 0,
          top: scrollY,
          behavior: "auto"
        });
      });
    }

    return next;
  }

function toggleGraphEditMode() {
    setGraphEditMode(
      !graphEditModeActive()
    );
  }

function activateGraphMode() {
    if (!runtimeGraphStylesLoaded()) {
      if (!runtimeGraphStyleActivationQueued) {
        runtimeGraphStyleActivationQueued = true;
        void ensureRuntimeGraphStyles()
          .then(() => {
            if (
              graph?.active === true &&
              savedPresentationPage() ===
                "runtime-graph"
            ) {
              activateGraphMode();
            }
          })
          .catch(
            reportRuntimeGraphStyleFailure
          )
          .finally(() => {
            runtimeGraphStyleActivationQueued = false;
          });
      }
      return false;
    }

    cacheDom();

    runtimeGraphViewActive = true;

    document.body.classList.add(
      "rml-node-graph-mode"
    );

    loadGraphPanelLayout();
    ensureGraphPanelToggles();

    if (dom.paletteTitle) {
      dom.paletteTitle.innerHTML =
        customCSharpEditor
          ? "<small>Custom C# File</small> Node library"
          : apiCompositeEditor
            ? "<small>API Composite</small> API &amp; Logic node library"
          : "<small>Step 2</small> Node library";
    }

    if (dom.canvasTitle) {
      dom.canvasTitle.innerHTML =
        customCSharpEditor
          ? "<small>File graph</small> Custom C# File"
          : apiCompositeEditor
            ? "<small>Composite graph</small> API &amp; Logic structure"
          : "<small>Step 3</small> Typed runtime graph";
    }

    if (dom.inspectorTitle) {
      dom.inspectorTitle.innerHTML =
        customCSharpEditor
          ? "<small>C# file graph</small> Node inspector"
          : apiCompositeEditor
            ? "<small>API Composite</small> Node inspector"
          : "<small>Step 4</small> Node inspector";
    }

    if (dom.activeContainerName) {
      dom.activeContainerName.textContent =
        customCSharpEditor
          ? `Isolated · ${customCSharpEditor.fileName}`
          : apiCompositeEditor
            ? `Composite · ${apiCompositeEditor.title}`
          : "Exact type matching";
    }

    renderGraphPalette();
    renderGraphCanvas();
    renderGraphInspector();
    synchronizeRuntimeBridgeSubscription(
      true
    );
    updatePackButton();
    window.dispatchEvent(
      new CustomEvent(
        "rml-graph-advanced-mode-change",
        {
          detail: Object.freeze({
            enabled: graph.showAdvancedNodes === true,
            customCSharpGraph: Boolean(customCSharpEditor)
          })
        }
      )
    );
    return true;
  }

function deactivateGraphMode() {
    runtimeGraphViewActive = false;
    graphPaletteIndicatorCleanup?.();
    graphPaletteIndicatorCleanup = null;
    setGraphEditMode(false);
    captureGraphPaletteUiState();
    persistGraphPaletteUiState();
    if (!graph?.active) {
      clearRuntimeBridgeSubscription();
    }
    clearGraphScrollLayerSelection();
    graphScrollLayerOutline?.remove();
    graphScrollLayerIndicator?.remove();
    graphScrollLayerOutline = null;
    graphScrollLayerIndicator = null;

    document.body.classList.remove(
      "rml-node-graph-mode"
    );

    removeGraphPanelToggles();

    if (dom.paletteTitle) {
      dom.paletteTitle.innerHTML =
        dom.paletteTitleOriginal;
    }

    if (dom.canvasTitle) {
      dom.canvasTitle.innerHTML =
        dom.canvasTitleOriginal;
    }

    if (dom.inspectorTitle) {
      dom.inspectorTitle.innerHTML =
        dom.inspectorTitleOriginal;
    }

    if (dom.toast) {
      dom.toast.hidden = true;
    }

    if (graphNodeVirtualizationFrame) {
      cancelAnimationFrame(
        graphNodeVirtualizationFrame
      );
      graphNodeVirtualizationFrame = 0;
    }
    if (graphWireRenderFrame) {
      cancelAnimationFrame(
        graphWireRenderFrame
      );
      graphWireRenderFrame = 0;
    }
    graphWireFullRenderPending = false;
    graphWirePartialConnectionIds.clear();
    releaseGraphToolbarResizeTracking();
    detachGraphHybridRenderer();
    graphNodeVirtualizationSignature = "";

    dom.root = null;
    dom.navigationTrail = null;
    dom.toolbar = null;
    dom.viewport = null;
    dom.stage = null;
    dom.wires = null;
    dom.nodesHost = null;
    dom.gpuCanvas = null;
    dom.toast = null;
    dom.sourceBadge = null;
    dom.editModeButton = null;
  }

function createPaletteItem(
    operatorId,
    definition,
    isConfiguration = false
  ) {
    const icon =
      nodePaletteIconDescriptor(
        definition
      );
    const button =
      document.createElement(
        "button"
      );
    button.className =
      "rml-graph-palette-item";
    button.type = "button";
    button.dataset.graphOperator =
      operatorId;

    if (definition.expertOnly === true) {
      button.classList.add(
        "expert"
      );
    }

    if (
      customCSharpEditor ||
      definition.customCSharpNode === true ||
      definition.customCSharpSyntaxNode === true ||
      definition.customCSharpSubgraphOnly === true ||
      definition.customCSharpCatalogNode === true
    ) {
      button.classList.add(
        "custom-csharp-node"
      );
    }

    let configurationPresent = false;
    if (isConfiguration) {
      button.dataset.graphConfiguration =
        "true";
      configurationPresent =
        graph.nodes.some(
          node =>
            node.kind ===
            "configuration"
        );
      setGraphButtonAvailability(
        button,
        !configurationPresent,
        "The graph already contains its packed configuration node."
      );
    }

    const symbol =
      document.createElement("span");
    symbol.textContent =
      icon.symbol;
    symbol.dataset.iconTone =
      icon.tone;
    symbol.dataset.rmlNodeIconColor =
      icon.color;

    const title =
      document.createElement("strong");
    title.textContent =
      definition.title;

    const add =
      document.createElement("small");
    add.textContent =
      configurationPresent
        ? "✓"
        : "＋";

    button.append(
      symbol,
      title,
      add
    );

    button.title =
      definition.description ||
      definition.title;

    button.addEventListener(
      "click",
      event => {
        const transactionSuppressed = Boolean(
          paletteClickSuppression &&
          paletteClickSuppression.operatorId === operatorId
        );
        if (
          !button.isConnected ||
          consumedPalettePointerSources.has(button) ||
          transactionSuppressed ||
          performance.now() <
          paletteDragSuppressClickUntil
        ) {
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }

        addPaletteNodeAtCenter(
          operatorId,
          isConfiguration
        );
      }
    );

    button.addEventListener(
      "keydown",
      event => {
        if (
          (event.key === "Enter" || event.key === " ") &&
          paletteClickSuppression?.operatorId === operatorId
        ) {
          paletteClickSuppression = null;
          consumedPalettePointerSources.delete(button);
        }
      }
    );

    button.addEventListener(
      "pointerdown",
      event =>
        beginPalettePointerDrag(
          event,
          operatorId,
          isConfiguration,
          definition
        )
    );

    return button;
  }

function definitionBelongsToCurrentGraph(definition) {
    if (apiCompositeEditor) {
      return Boolean(
        definition?.unavailableApiContract !==
          true &&
        apiCompositeInternalDefinitionAllowed(
          definition
        )
      );
    }
    if (customCSharpEditor) {
      return Boolean(
        definition?.customCSharpSyntaxNode === true ||
        definition?.customCSharpSubgraphOnly === true ||
        definition?.customCSharpCatalogNode === true
      );
    }
    return !(
      definition?.customCSharpSyntaxNode === true ||
      definition?.customCSharpSubgraphOnly === true
    );
  }

function renderGraphPalette() {
    if (
      !graph?.active ||
      !runtimeGraphViewActive ||
      !dom.paletteContent
    ) {
      return;
    }

    graphPaletteIndicatorCleanup?.();
    graphPaletteIndicatorCleanup = null;

    loadGraphPaletteUiState();
    captureGraphPaletteUiState();

    const previousQuery =
      dom.paletteContent.querySelector(
        ".rml-graph-palette-search input"
      )?.value || "";

    dom.paletteContent.replaceChildren();

    const root =
      document.createElement("div");
    root.className =
      "rml-graph-palette";

    const searchWrap =
      document.createElement("label");
    searchWrap.className =
      "rml-graph-palette-search";
    searchWrap.textContent =
      "Find node";

    const search =
      document.createElement("input");
    search.type = "search";
    search.placeholder =
      apiCompositeEditor
        ? "Search API and logic nodes…"
        : "Type at least 2 characters for API nodes…";
    search.autocomplete = "off";
    search.value = previousQuery;
    searchWrap.appendChild(search);

    const modeWrap =
      document.createElement("label");
    modeWrap.className =
      "rml-graph-palette-mode";

    const modeInput =
      document.createElement("input");
    modeInput.type = "checkbox";
    modeInput.checked =
      graph.showAdvancedNodes === true;
    modeInput.disabled = Boolean(customCSharpEditor);

    const modeCopy =
      document.createElement("span");
    const modeTitle =
      document.createElement("strong");
    modeTitle.textContent =
      "Show Advanced / Raw C#";
    modeCopy.appendChild(
      modeTitle
    );
    modeWrap.append(
      modeInput,
      modeCopy
    );
    modeWrap.hidden = Boolean(customCSharpEditor);

    const scroll =
      document.createElement("div");
    scroll.className =
      "rml-graph-palette-scroll";
    const scrollShell =
      document.createElement("div");
    scrollShell.className =
      "rml-graph-palette-scroll-shell";
    const scrollIndicator =
      document.createElement("div");
    scrollIndicator.className =
      "rml-graph-palette-scroll-indicator";
    const scrollThumb =
      document.createElement("span");
    scrollIndicator.appendChild(
      scrollThumb
    );
    scrollShell.append(
      scroll,
      scrollIndicator
    );
    let scrollIndicatorFrame = 0;
    const updateScrollIndicator = () => {
      scrollIndicatorFrame = 0;
      const viewportHeight =
        scroll.clientHeight;
      const contentHeight =
        scroll.scrollHeight;
      const trackHeight =
        scrollIndicator.clientHeight;
      const scrollRange = Math.max(
        0,
        contentHeight - viewportHeight
      );
      const visible =
        viewportHeight > 0 &&
        scrollRange > 1 &&
        trackHeight > 0;
      scrollIndicator.classList.toggle(
        "visible",
        visible
      );
      if (!visible) {
        return;
      }
      const minimumThumbHeight =
        window.matchMedia(
          "(pointer: coarse), (max-width: 780px)"
        ).matches
          ? 44
          : 34;
      const thumbHeight = Math.min(
        trackHeight,
        Math.max(
          minimumThumbHeight,
        trackHeight * viewportHeight /
          contentHeight
        )
      );
      const thumbRange = Math.max(
        0,
        trackHeight - thumbHeight
      );
      const offset = scrollRange > 0
        ? thumbRange * scroll.scrollTop /
          scrollRange
        : 0;
      scrollThumb.dataset.rmlThumbHeight =
        String(thumbHeight);
      scrollThumb.dataset.rmlThumbOffset =
        String(offset);
    };
    const scheduleScrollIndicatorUpdate = () => {
      if (scrollIndicatorFrame) {
        return;
      }
      scrollIndicatorFrame =
        requestProjectAnimationFrame(
          updateScrollIndicator
        );
    };
    const indicatorAbort =
      new AbortController();
    scroll.addEventListener(
      "scroll",
      () => {
        graphPaletteUiState.scrollTop =
          Math.max(
            0,
            finiteNumber(
              scroll.scrollTop,
              0
            )
        );
        persistGraphPaletteUiState();
        scheduleScrollIndicatorUpdate();
      },
      {
        passive: true,
        signal: indicatorAbort.signal
      }
    );

    const indicatorResizeObserver =
      typeof ResizeObserver === "function"
        ? new ResizeObserver(
            scheduleScrollIndicatorUpdate
          )
        : null;
    indicatorResizeObserver?.observe(scroll);
    indicatorResizeObserver?.observe(
      scrollShell
    );

    const indicatorMutationObserver =
      new MutationObserver(
        scheduleScrollIndicatorUpdate
      );
    indicatorMutationObserver.observe(
      scroll,
      {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["open", "hidden"]
      }
    );

    window.addEventListener(
      "resize",
      scheduleScrollIndicatorUpdate,
      { signal: indicatorAbort.signal }
    );
    window.visualViewport?.addEventListener(
      "resize",
      scheduleScrollIndicatorUpdate,
      { signal: indicatorAbort.signal }
    );
    window.visualViewport?.addEventListener(
      "scroll",
      scheduleScrollIndicatorUpdate,
      {
        passive: true,
        signal: indicatorAbort.signal
      }
    );

    graphPaletteIndicatorCleanup = () => {
      indicatorAbort.abort();
      indicatorResizeObserver?.disconnect();
      indicatorMutationObserver.disconnect();
      if (scrollIndicatorFrame) {
        cancelAnimationFrame(
          scrollIndicatorFrame
        );
        scrollIndicatorFrame = 0;
      }
    };


    root.append(
      searchWrap,
      modeWrap
    );
    root.appendChild(scrollShell);
    dom.paletteContent.appendChild(root);

    const allEntries =
      Object.entries(
        OPERATOR_DEFINITIONS
      );

    const MAX_SEARCH_RESULTS = 240;
    const CATALOG_GROUP_BATCH_SIZE = 120;
    const CATALOG_GROUP_NAMES = [
      "API · Types & Enums",
      "API · Constructors",
      "API · Methods",
      "API · Properties",
      "API · Fields",
      "API · Events"
    ];
    let searchFrame = 0;

    const searchableText =
      (operatorId, definition) =>
        `${
          definition.title || ""
        } ${
          definition.description || ""
        } ${
          definition.apiSearchText || ""
        } ${
          definition.group || ""
        } ${operatorId}`
          .toLowerCase();

    let entriesRendered = false;

    const finishEntriesRender = () => {
      entriesRendered = true;
      restoreGraphPaletteScroll(
        scroll
      );
      requestProjectAnimationFrame(
        updateScrollIndicator
      );
    };

    const appendGroup = (
      group,
      entries,
      options = {}
    ) => {
      const details =
        document.createElement("details");
      details.className =
        "rml-graph-palette-group";
      configureGraphPaletteGroup(
        details,
        options.key || group,
        options.open === true
      );

      const summary =
        document.createElement("summary");
      const title =
        document.createElement("span");
      title.textContent = group;
      const count =
        document.createElement("b");
      count.textContent =
        String(entries.length);
      summary.append(title, count);

      const list =
        document.createElement("div");
      list.className =
        "rml-graph-palette-list";

      for (
        const [operatorId, definition] of
        entries
      ) {
        list.appendChild(
          createPaletteItem(
            operatorId,
            definition
          )
        );
      }

      details.append(summary, list);
      scroll.appendChild(details);
    };

    const appendCatalogGroup = (
      group,
      entries
    ) => {
      if (entries.length === 0) {
        return;
      }

      const details =
        document.createElement("details");
      details.className =
        "rml-graph-palette-group rml-graph-palette-catalog-group";
      configureGraphPaletteGroup(
        details,
        `catalog:${group}`,
        false
      );

      const summary =
        document.createElement("summary");
      const title =
        document.createElement("span");
      title.textContent =
        group === "Advanced / Raw C#"
          ? "API · Advanced / Raw C#"
          : group;
      const count =
        document.createElement("b");
      count.textContent =
        entries.length.toLocaleString();
      summary.append(title, count);

      const list =
        document.createElement("div");
      list.className =
        "rml-graph-palette-list";

      let rendered = 0;
      let initialized = false;
      let moreButton = null;

      const renderNextBatch = () => {
        initialized = true;

        if (entries.length === 0) {
          const empty =
            document.createElement("div");
          empty.className =
            "rml-graph-palette-status";
          empty.textContent =
            "No nodes of this category were generated from the loaded API catalog.";
          list.appendChild(empty);
          return;
        }

        moreButton?.remove();
        moreButton = null;

        const end = Math.min(
          entries.length,
          rendered +
            CATALOG_GROUP_BATCH_SIZE
        );
        const fragment =
          document.createDocumentFragment();

        while (rendered < end) {
          const [operatorId, definition] =
            entries[rendered];
          fragment.appendChild(
            createPaletteItem(
              operatorId,
              definition
            )
          );
          rendered += 1;
        }

        list.appendChild(fragment);

        if (rendered < entries.length) {
          moreButton =
            document.createElement("button");
          moreButton.type = "button";
          moreButton.className =
            "rml-graph-palette-more";
          const remaining =
            entries.length - rendered;
          moreButton.textContent =
            `Show next ${Math.min(
              CATALOG_GROUP_BATCH_SIZE,
              remaining
            ).toLocaleString()} · ${rendered.toLocaleString()} of ${entries.length.toLocaleString()} loaded`;
          moreButton.addEventListener(
            "click",
            renderNextBatch,
            { once: true }
          );
          list.appendChild(moreButton);
        }
      };

      const ensureFirstBatch = () => {
        if (
          details.open &&
          !initialized
        ) {
          renderNextBatch();
        }
      };

      details.addEventListener(
        "toggle",
        ensureFirstBatch
      );
      details.append(summary, list);
      scroll.appendChild(details);

      if (details.open) {
        queueMicrotask(
          ensureFirstBatch
        );
      }
    };

    const appendSavedCompositeGroup =
      records => {
        if (
          customCSharpEditor ||
          apiCompositeEditor ||
          records.length === 0
        ) {
          return;
        }
        const details =
          document.createElement("details");
        details.className =
          "rml-graph-palette-group rml-saved-api-composite-group";
        configureGraphPaletteGroup(
          details,
          "__saved_api_composites__",
          true
        );
        const summary =
          document.createElement("summary");
        const title =
          document.createElement("span");
        title.textContent =
          "Saved API Composites";
        const count =
          document.createElement("b");
        count.textContent =
          records.length.toLocaleString(
            "de-DE"
          );
        summary.append(title, count);
        const list =
          document.createElement("div");
        list.className =
          "rml-graph-palette-list";
        for (const record of records) {
          list.appendChild(
            createSavedApiCompositePaletteItem(
              record
            )
          );
        }
        details.append(summary, list);
        scroll.appendChild(details);
      };

    const appendMessage = text => {
      const message =
        document.createElement("div");
      message.className =
        "rml-graph-palette-status";
      message.textContent = text;
      scroll.appendChild(message);
    };

    const renderEntries = () => {
      if (entriesRendered) {
        captureGraphPaletteUiState();
      }

      scroll.replaceChildren();

      const configGroup =
        document.createElement("details");
      configGroup.className =
        "rml-graph-palette-group";
      configureGraphPaletteGroup(
        configGroup,
        GRAPH_PALETTE_CONFIG_GROUP_KEY,
        true
      );

      const configSummary =
        document.createElement("summary");
      const configSummaryText =
        document.createElement("span");
      configSummaryText.textContent =
        "Packed Configuration";
      const configCount =
        document.createElement("b");
      configCount.textContent = "1";
      configSummary.append(
        configSummaryText,
        configCount
      );

      const configList =
        document.createElement("div");
      configList.className =
        "rml-graph-palette-list";
      configList.appendChild(
        createPaletteItem(
          "configuration",
          {
            title:
              "Packed Configuration",
            symbol: "§",
            description:
              "Restores the packed configuration start node after it was deleted."
          },
          true
        )
      );

      configGroup.append(
        configSummary,
        configList
      );
      if (
        !customCSharpEditor &&
        !apiCompositeEditor
      ) {
        scroll.appendChild(
          configGroup
        );
      }

      const query =
        search.value
          .trim()
          .toLowerCase();

      const savedRecords = [
        ...savedApiCompositeTemplates.values()
      ].sort((left, right) =>
        left.name.localeCompare(
          right.name,
          undefined,
          { sensitivity: "base" }
        )
      );
      const matchingSavedRecords = query
        ? savedRecords.filter(record =>
            savedApiCompositeSearchText(
              record
            ).includes(query)
          )
        : savedRecords;

      const showAdvanced =
        graph.showAdvancedNodes === true;

      if (query.length >= 2) {
        const matching = [];

        for (
          const entry of allEntries
        ) {
          const [, definition] = entry;

          if (
            definition.hiddenFromPalette === true ||
            !definitionBelongsToCurrentGraph(definition) ||
            (
              !showAdvanced &&
              definition.expertOnly === true &&
              !customCSharpEditor
            )
          ) {
            continue;
          }

          if (
            searchableText(
              entry[0],
              definition
            ).includes(query)
          ) {
            matching.push(entry);

            if (
              matching.length >=
              MAX_SEARCH_RESULTS
            ) {
              break;
            }
          }
        }

        appendSavedCompositeGroup(
          matchingSavedRecords
        );

        if (
          matching.length === 0 &&
          matchingSavedRecords.length === 0
        ) {
          appendMessage(
            "No node matches this search."
          );
          finishEntriesRender();
          return;
        }

        const grouped =
          new Map();

        for (const entry of matching) {
          const group =
            entry[1].group ||
            "Other";

          if (!grouped.has(group)) {
            grouped.set(group, []);
          }

          grouped.get(group).push(entry);
        }

        for (
          const group of
          OPERATOR_GROUP_ORDER
        ) {
          const entries =
            grouped.get(group);

          if (entries) {
            appendGroup(
              group,
              entries
            );
            grouped.delete(group);
          }
        }

        for (
          const [group, entries] of
          grouped
        ) {
          appendGroup(
            group,
            entries
          );
        }

        if (
          matching.length >=
          MAX_SEARCH_RESULTS
        ) {
          appendMessage(
            `Showing the first ${MAX_SEARCH_RESULTS} matches. Refine the search to narrow the live API catalog.`
          );
        }

        finishEntriesRender();
        return;
      }

      const normalGroups =
        new Map();
      const catalogGroups =
        new Map();
      const catalogDefinitionCount =
        allEntries.reduce(
          (count, [, definition]) =>
            count +
            (definition.catalogGenerated ===
              true
              ? 1
              : 0),
          0
        );
      let visibleCatalogEntries = 0;

      appendSavedCompositeGroup(
        savedRecords
      );

      for (
        const group of
        CATALOG_GROUP_NAMES
      ) {
        catalogGroups.set(
          group,
          []
        );
      }

      for (
        const entry of allEntries
      ) {
        const [, definition] = entry;

        if (
          definition.hiddenFromPalette === true ||
          !definitionBelongsToCurrentGraph(definition) ||
          (
            !showAdvanced &&
            definition.expertOnly === true &&
            !customCSharpEditor
          )
        ) {
          continue;
        }

        const group =
          definition.group ||
          "Other";

        if (
          definition.catalogGenerated === true
        ) {
          visibleCatalogEntries += 1;
          if (!catalogGroups.has(group)) {
            catalogGroups.set(group, []);
          }

          catalogGroups.get(group)
            .push(entry);
          continue;
        }

        if (!normalGroups.has(group)) {
          normalGroups.set(group, []);
        }

        normalGroups.get(group)
          .push(entry);
      }

      for (
        const group of
        OPERATOR_GROUP_ORDER
      ) {
        const entries =
          normalGroups.get(group);

        if (!entries) {
          continue;
        }

        appendGroup(
          group,
          entries
        );

        normalGroups.delete(group);
      }

      for (
        const [group, entries] of
        normalGroups
      ) {
        appendGroup(
          group,
          entries,
          { open: false }
        );
      }

      for (
        const group of
        OPERATOR_GROUP_ORDER
      ) {
        const entries =
          catalogGroups.get(group);

        if (!entries) {
          continue;
        }

        appendCatalogGroup(
          group,
          entries
        );
        catalogGroups.delete(group);
      }

      for (
        const [group, entries] of
        catalogGroups
      ) {
        appendCatalogGroup(
          group,
          entries
        );
      }

      if (catalogDefinitionCount === 0) {
        const catalog =
          window.RMLResoniteApiCatalog ||
          window.RMLFrooxComponentCatalog;
        appendMessage(
          catalog
            ? "The Resonite API catalog is loaded, but its typed API node factory produced no usable nodes. Check the API status for the exact factory error."
            : "API nodes are unavailable because no cached or live Resonite API catalog is loaded. Click the Resonite API status in the top bar to load one."
        );
      } else if (
        visibleCatalogEntries === 0 &&
        !showAdvanced
      ) {
        appendMessage(
          "API nodes are loaded, but the current filter hides all of them. Enable Show Advanced / Raw C# or search for a concrete API member."
        );
      }

      finishEntriesRender();

    };

    modeInput.addEventListener(
      "change",
      () => {
        graph.showAdvancedNodes =
          modeInput.checked;
        persistGraph(true);
        window.dispatchEvent(
          new CustomEvent(
            "rml-graph-advanced-mode-change",
            {
              detail: Object.freeze({
                enabled: graph.showAdvancedNodes === true,
                customCSharpGraph: Boolean(customCSharpEditor)
              })
            }
          )
        );
        renderEntries();
      }
    );

    search.addEventListener(
      "input",
      () => {
        if (searchFrame) {
          cancelAnimationFrame(
            searchFrame
          );
        }

        searchFrame =
          requestProjectAnimationFrame(() => {
            searchFrame = 0;
            renderEntries();
          });
      }
    );

    renderEntries();
  }

function nodeDefaultParameters(
    definition
  ) {
    const parameters = {};

    normalizePortLayoutParameter(
      parameters,
      definition
    );

    if (
      definition.configurableTypeVar
    ) {
      parameters.valueType =
        definition.defaultType ||
        definition.configurableTypes?.[0] ||
        "float";
    }

    if (
      definition.parameterKind ===
      "number"
    ) {
      parameters.value = "0";
    } else if (
      definition.parameterKind ===
      "bool"
    ) {
      parameters.value = true;
    } else if (
      definition.parameterKind ===
      "string"
    ) {
      parameters.value = "Text";
    } else if (
      definition.parameterKind ===
      "color"
    ) {
      parameters.value =
        "colorX.White";
      parameters.colorProfile =
        "linear";
      parameters.colorStrength = 1;
    }

    for (
      const specification of
      Array.isArray(definition.parameters)
        ? definition.parameters
        : []
    ) {
      if (
        !specification ||
        typeof specification.key !==
          "string" ||
        Object.hasOwn(
          parameters,
          specification.key
        )
      ) {
        continue;
      }

      parameters[specification.key] =
        nodeGraphClone(
          specification.default ?? ""
        );
    }

    return parameters;
  }

function findOpenNodePosition(
    requestedX,
    requestedY,
    width = 280,
    height = 180
  ) {
    let x = nodeGraphClamp(
      requestedX,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );
    let y = nodeGraphClamp(
      requestedY,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );

    for (
      let attempt = 0;
      attempt < 36;
      attempt += 1
    ) {
      const overlaps =
        graph.nodes.some(node => {
          const definition =
            nodeDefinition(node);
          const nodeWidth =
            Number.isFinite(node.width)
              ? node.width
              : definition?.width || 280;
          const nodeHeight =
            Number.isFinite(node.height)
              ? node.height
              : node.kind === "configuration"
                ? 520
                : 190;

          return !(
            x + width + 18 < node.x ||
            x > node.x + nodeWidth + 18 ||
            y + height + 18 < node.y ||
            y > node.y + nodeHeight + 18
          );
        });

      if (!overlaps) {
        return { x, y };
      }

      x += 42;
      y += 36;

      if (
        x > GRAPH_COORDINATE_LIMIT
      ) {
        x = requestedX -
          (attempt % 5) * 24;
      }

      if (
        y > GRAPH_COORDINATE_LIMIT
      ) {
        y = requestedY -
          (attempt % 7) * 24;
      }
    }

    return { x, y };
  }

function createOperatorNodeRecord(
    operatorId,
    x,
    y
  ) {
    const definition =
      OPERATOR_DEFINITIONS[
        operatorId
      ];

    if (
      !definition ||
      !definitionBelongsToCurrentGraph(definition)
    ) {
      return null;
    }

    const position =
      findOpenNodePosition(
        x,
        y,
        definition.width || 280,
        190
      );

    const node = {
      id: makeId("graph-node"),
      kind: "operator",
      operatorId,
      apiContract:
        portableApiContract(
          definition
        ),
      x: position.x,
      y: position.y,
      width: null,
      height: null,
      label: "",
      parameters:
        nodeDefaultParameters(
          definition
        )
    };

    graph.nodes.push(node);
    graph.nextSequence += 1;
    return node;
  }

function addOperatorNode(
    operatorId,
    x,
    y,
    fitAfter = false
  ) {
    const node =
      createOperatorNodeRecord(
        operatorId,
        x,
        y
      );

    if (!node) {
      return null;
    }

    graph.selectedNodeId =
      node.id;
    graph.selectedNodeIds = [node.id];
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    currentAnalysis =
      currentAnalysis ||
      analyzeConnections(
        graph.connections
      );
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();
    renderGraphPalette();

    if (fitAfter) {
      requestProjectAnimationFrame(() => {
        centerGraph();
      });
    }

    return node;
  }

function graphPortReference(
    node,
    portId,
    direction
  ) {
    const mirrored =
      definitionHasSockets(
        nodeDefinition(node)
      ) &&
      node.parameters?.portLayout ===
        "mirrored";

    return {
      nodeId: node.id,
      portId,
      direction,
      side:
        direction === "input"
          ? mirrored
            ? "right"
            : "left"
          : mirrored
            ? "left"
            : "right"
    };
  }

function interactionConcreteType(
    interaction
  ) {
    if (interaction?.startType) {
      return interaction.startType;
    }

    const portRef =
      findPortSpec(
        interaction.start.nodeId,
        interaction.start.portId,
        interaction.start.direction
      );
    const analysis =
      currentAnalysis ||
      analyzeConnections(
        graph.connections
      );

    return (
      resolvePortType(
        portRef,
        analysis.bindings ||
          new Map()
      ) ||
      fallbackConcreteTypeForPort(
        portRef
      )
    );
  }

function automaticNodeDropPoint(
    clientX,
    clientY
  ) {
    if (!dom.viewport) {
      return null;
    }

    const rectangle =
      dom.viewport.getBoundingClientRect();

    if (
      clientX < rectangle.left ||
      clientX > rectangle.right ||
      clientY < rectangle.top ||
      clientY > rectangle.bottom
    ) {
      return null;
    }

    const elements =
      typeof document.elementsFromPoint ===
        "function"
        ? document.elementsFromPoint(
            clientX,
            clientY
          )
        : [
            document.elementFromPoint(
              clientX,
              clientY
            )
          ];

    const blocked =
      elements.some(element =>
        element?.closest?.(
          ".rml-graph-node, .rml-graph-toolbar, .rml-graph-toast, .rml-graph-palette-ghost, .rml-graph-wire-point, .rml-graph-wire-hit"
        )
      );

    return blocked
      ? null
      : clientToGraph(
          clientX,
          clientY
        );
  }

function automaticVisibleGraphBounds() {
    if (!dom.viewport) {
      return null;
    }

    const rectangle =
      dom.viewport.getBoundingClientRect();
    const topLeft =
      clientToGraph(
        rectangle.left,
        rectangle.top
      );
    const bottomRight =
      clientToGraph(
        rectangle.right,
        rectangle.bottom
      );

    return {
      left: Math.min(
        topLeft.x,
        bottomRight.x
      ),
      right: Math.max(
        topLeft.x,
        bottomRight.x
      ),
      top: Math.min(
        topLeft.y,
        bottomRight.y
      ),
      bottom: Math.max(
        topLeft.y,
        bottomRight.y
      )
    };
  }

function automaticStringValueForInput(
    inputRef
  ) {
    const operatorId =
      String(
        inputRef?.node?.operatorId ||
        ""
      );
    const portId =
      String(
        inputRef?.spec?.id ||
        ""
      ).toLowerCase();

    if (
      operatorId ===
        "reflection.findType" &&
      portId === "name"
    ) {
      return "System.Object";
    }

    if (/argumenttypes/.test(portId)) {
      return "";
    }

    if (/url|uri/.test(portId)) {
      return "https://example.com/";
    }

    if (/pattern/.test(portId)) {
      return "*";
    }

    if (/event/.test(portId)) {
      return "EventName";
    }

    if (/method/.test(portId)) {
      return "MethodName";
    }

    if (/path|file|directory/.test(portId)) {
      return "path";
    }

    if (/body|json/.test(portId)) {
      return "{}";
    }

    if (/name/.test(portId)) {
      return "Name";
    }

    return "Text";
  }

function automaticNumberValueForInput(
    inputRef
  ) {
    const portId =
      String(
        inputRef?.spec?.id ||
        ""
      ).toLowerCase();

    if (/interval|millisecond|delay/.test(portId)) {
      return "1000";
    }

    if (portId === "port") {
      return "80";
    }

    if (/count/.test(portId)) {
      return "1";
    }

    if (/max|maximum/.test(portId)) {
      return "1";
    }

    return "0";
  }

function automaticTypedDefaultRecipe() {
    return {
      operatorId:
        "constant.typedDefault",
      outputPort: "value"
    };
  }

function scannerGeneratedConstantRecipe(
    valueType,
    memberKinds = null
  ) {
    const allowedKinds =
      Array.isArray(memberKinds) &&
      memberKinds.length > 0
        ? new Set(memberKinds)
        : null;

    for (const [operatorId, definition]
      of Object.entries(
        OPERATOR_DEFINITIONS
      )) {
      if (
        definition
          ?.catalogGenerated !== true ||
        definition
          ?.legacyCatalogAlias === true ||
        (definition.inputs?.length || 0) !== 0 ||
        (
          allowedKinds &&
          !allowedKinds.has(
            definition.apiMemberKind
          )
        )
      ) {
        continue;
      }

      const output =
        definition.outputs?.find(
          specification =>
            specification.type ===
              valueType &&
            specification.type !==
              "impulse"
        );

      if (output) {
        return {
          operatorId,
          outputPort: output.id
        };
      }
    }

    return null;
  }

function automaticSourceRecipe(
    inputRef,
    valueType
  ) {
    if (
      !valueType ||
      valueType === "impulse"
    ) {
      return null;
    }

    if (nodeGraphIsScalarNumericType(valueType)) {
      return {
        operatorId: "constant.number",
        outputPort: "value"
      };
    }

    if (numericVectorInfo(valueType)) {
      return {
        operatorId: "constant.vector",
        outputPort: "value"
      };
    }


    if (
      valueType.startsWith(
        "apiEnum:"
      )
    ) {
      return (
        scannerGeneratedConstantRecipe(
          valueType,
          ["enum"]
        ) ||
        automaticTypedDefaultRecipe()
      );
    }

    if (
      valueType === "object" &&
      inputRef?.node?.operatorId ===
        "asset.request" &&
      inputRef?.spec?.id === "manager"
    ) {
      return {
        operatorId: "asset.manager",
        outputPort: "manager"
      };
    }

    const selfContainedRecipes = {
      bool: ["constant.bool", "value"],
      string: ["constant.string", "value"],
      Uri: ["constant.uri", "value"],
      colorX: ["constant.color", "value"],
      object: ["constant.nullObject", "value"],
      stringArray: ["constant.stringArray", "value"],
      task: ["task.completedTask", "task"]
    };
    const recipe =
      selfContainedRecipes[valueType];

    return recipe
      ? {
          operatorId: recipe[0],
          outputPort: recipe[1]
        }
      : automaticTypedDefaultRecipe();
  }

function automaticSourceIsSelfContained(
    node,
    outputPort
  ) {
    const definition =
      nodeDefinition(node);

    return Boolean(
      definition &&
      (definition.inputs?.length || 0) === 0 &&
      definition.outputs?.some(
        specification =>
          specification.id === outputPort
      )
    );
  }

function configureAutomaticNode(
    node,
    valueType,
    inputRef = null
  ) {
    if (!node) {
      return;
    }

    switch (node.operatorId) {
      case "constant.number":
        node.parameters.valueType =
          valueType;
        node.parameters.value =
          automaticNumberValueForInput(
            inputRef
          );
        break;

      case "constant.vector": {
        node.parameters.valueType =
          valueType;
        const vector =
          numericVectorInfo(
            valueType
          );
        node.parameters.components =
          Array.from(
            {
              length:
                vector?.componentCount ||
                3
            },
            () => "0"
          ).join(", ");
        break;
      }

      case "constant.string":
        node.parameters.value =
          automaticStringValueForInput(
            inputRef
          );
        break;

      case "constant.uri":
        node.parameters.value =
          "about:blank";
        break;

      case "constant.stringArray":
        node.parameters.items = "";
        break;

      case "constant.typedDefault":
        node.parameters.valueType =
          valueType;
        break;

      default: {
        const definition =
          OPERATOR_DEFINITIONS[
            node.operatorId
          ];

        if (
          definition?.configurableTypeVar &&
          definition.configurableTypes
            ?.includes(valueType)
        ) {
          node.parameters.valueType =
            valueType;
        }
        break;
      }
    }
  }

function createAutomaticOperatorNode(
    operatorId,
    valueType,
    dropPoint,
    referencePoint,
    role,
    inputRef = null
  ) {
    const definition =
      OPERATOR_DEFINITIONS[
        operatorId
      ];

    if (!definition) {
      return null;
    }

    const width =
      definition.width ||
      280;
    const estimatedHeight = 190;
    const visibleBounds =
      automaticVisibleGraphBounds();
    let requestedX =
      dropPoint.x - width / 2;
    let requestedY =
      dropPoint.y - 82;

    if (visibleBounds) {
      const margin = 18;
      requestedX = nodeGraphClamp(
        requestedX,
        visibleBounds.left + margin,
        Math.max(
          visibleBounds.left + margin,
          visibleBounds.right -
            width -
            margin
        )
      );
      requestedY = nodeGraphClamp(
        requestedY,
        visibleBounds.top + margin,
        Math.max(
          visibleBounds.top + margin,
          visibleBounds.bottom -
            estimatedHeight -
            margin
        )
      );
    }

    const node =
      createOperatorNodeRecord(
        operatorId,
        requestedX,
        requestedY
      );

    if (!node) {
      return null;
    }

    if (visibleBounds) {
      const margin = 18;
      node.x = nodeGraphClamp(
        node.x,
        visibleBounds.left + margin,
        Math.max(
          visibleBounds.left + margin,
          visibleBounds.right -
            width -
            margin
        )
      );
      node.y = nodeGraphClamp(
        node.y,
        visibleBounds.top + margin,
        Math.max(
          visibleBounds.top + margin,
          visibleBounds.bottom -
            estimatedHeight -
            margin
        )
      );
    }

    const nodeCenterX =
      node.x + width / 2;
    const droppedBeforeReference =
      nodeCenterX <
      (referencePoint?.x ??
        nodeCenterX);

    if (definitionHasSockets(definition)) {
      node.parameters.portLayout =
        role === "source"
          ? droppedBeforeReference
            ? "standard"
            : "mirrored"
          : droppedBeforeReference
            ? "mirrored"
            : "standard";
    }

    configureAutomaticNode(
      node,
      valueType,
      inputRef
    );

    return node;
  }

function removeAutomaticNode(
    node,
    previousSequence
  ) {
    graph.nodes =
      graph.nodes.filter(
        candidate =>
          candidate.id !== node?.id
      );
    graph.connections =
      graph.connections.filter(
        connection =>
          connection.fromNode !== node?.id &&
          connection.toNode !== node?.id
      );
    graph.nextSequence =
      previousSequence;
  }

function createAutomaticSourceForInput(
    interaction,
    clientX,
    clientY
  ) {
    const dropPoint =
      automaticNodeDropPoint(
        clientX,
        clientY
      );

    if (!dropPoint) {
      return {
        attempted: false,
        connected: false,
        reason: ""
      };
    }

    const inputRef =
      findPortSpec(
        interaction.start.nodeId,
        interaction.start.portId,
        "input"
      );
    const valueType =
      interactionConcreteType(
        interaction
      );

    if (!valueType) {
      return {
        attempted: true,
        connected: false,
        reason:
          "The input type is unresolved. Connect another socket first or choose a concrete type in the inspector."
      };
    }

    const targetPoint =
      socketGraphCenter(
        interaction.start.nodeId,
        interaction.start.portId,
        "input"
      ) || dropPoint;

    if (valueType === "impulse") {
      return {
        attempted: true,
        connected: false,
        reason:
          "Impulse inputs require an explicit event source or an existing impulse path. No event node was created automatically because choosing one would change runtime behavior."
      };
    }

    const preferred =
      automaticSourceRecipe(
        inputRef,
        valueType
      );
    const recipes = preferred
      ? [preferred]
      : [];

    if (
      preferred?.operatorId !==
        "constant.typedDefault"
    ) {
      recipes.push(
        automaticTypedDefaultRecipe()
      );
    }

    let lastReason = "";

    for (const recipe of recipes) {
      const previousSequence =
        graph.nextSequence;
      const node =
        createAutomaticOperatorNode(
          recipe.operatorId,
          valueType,
          dropPoint,
          targetPoint,
          "source",
          inputRef
        );

      if (!node) {
        lastReason =
          `The suggested ${typeLabel(valueType)} source node is unavailable.`;
        continue;
      }

      const definition =
        nodeDefinition(node);

      if (
        !automaticSourceIsSelfContained(
          node,
          recipe.outputPort
        )
      ) {
        removeAutomaticNode(
          node,
          previousSequence
        );
        lastReason =
          `${definition?.title || "The suggested node"} is not a self-contained source and was not created automatically.`;
        continue;
      }

      const proposal =
        connectionProposal(
          graphPortReference(
            node,
            recipe.outputPort,
            "output"
          ),
          interaction.start,
          graph.connections
        );

      if (!proposal.valid) {
        removeAutomaticNode(
          node,
          previousSequence
        );
        lastReason =
          proposal.reason;
        continue;
      }

      applyAutoVectorUpdates(
        proposal.autoVectorUpdates
      );
      graph.connections =
        proposal.nextConnections;
      normalizeConnectionRouting(
        graph.connections
      );
      graph.selectedNodeId =
        node.id;
      graph.selectedConnectionId =
        null;
      clearSelectedWirePoint();
      currentAnalysis =
        proposal.analysis;

      return {
        attempted: true,
        connected: true,
        reason: "",
        message:
          node.operatorId ===
            "constant.typedDefault"
            ? `Safe typed default created for ${typeLabel(valueType)}. Replace it with an explicit runtime source when needed.`
            : `${definition.title} created for ${typeLabel(valueType)}.`
      };
    }

    return {
      attempted: true,
      connected: false,
      reason:
        lastReason ||
        `No safe automatic source could be created for ${typeLabel(valueType)}.`
    };
  }

function createAutomaticMonitorForOutput(
    interaction,
    clientX,
    clientY
  ) {
    const dropPoint =
      automaticNodeDropPoint(
        clientX,
        clientY
      );

    if (!dropPoint) {
      return {
        attempted: false,
        connected: false,
        reason: ""
      };
    }

    const valueType =
      interactionConcreteType(
        interaction
      );
    const sourcePoint =
      socketGraphCenter(
        interaction.start.nodeId,
        interaction.start.portId,
        "output"
      ) || dropPoint;
    const operatorId =
      valueType === "impulse"
        ? "debug.displayImpulse"
        : "resonite.displayValue";
    const inputPort =
      valueType === "impulse"
        ? "call"
        : "value";
    const previousSequence =
      graph.nextSequence;
    const node =
      createAutomaticOperatorNode(
        operatorId,
        valueType,
        dropPoint,
        sourcePoint,
        "monitor"
      );

    if (!node) {
      return {
        attempted: true,
        connected: false,
        reason:
          `The ${typeLabel(valueType)} monitor node is unavailable.`
      };
    }

    const proposal =
      connectionProposal(
        interaction.start,
        graphPortReference(
          node,
          inputPort,
          "input"
        ),
        graph.connections
      );

    if (!proposal.valid) {
      removeAutomaticNode(
        node,
        previousSequence
      );

      return {
        attempted: true,
        connected: false,
        reason: proposal.reason
      };
    }

    applyAutoVectorUpdates(
      proposal.autoVectorUpdates
    );
    graph.connections =
      proposal.nextConnections;
    normalizeConnectionRouting(
      graph.connections
    );
    graph.selectedNodeId = node.id;
    graph.selectedNodeIds = [node.id];
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    currentAnalysis =
      proposal.analysis;

    return {
      attempted: true,
      connected: true,
      reason: "",
      message:
        `${nodeDefinition(node).title} created for ${typeLabel(valueType)}.`
    };
  }

function addConfigurationNode(
    x,
    y,
    fitAfter = false
  ) {
    if (
      graph.nodes.some(
        node =>
          node.kind ===
          "configuration"
      )
    ) {
      showGraphMessage(
        "The graph already contains its packed configuration node.",
        "error"
      );
      return null;
    }

    const position =
      findOpenNodePosition(
        x,
        y,
        390,
        520
      );

    const node = {
      id: makeId("configuration"),
      kind: "configuration",
      x: position.x,
      y: position.y,
      width: null,
      height: null,
      label: "",
      parameters: {
        portLayout: "standard"
      }
    };

    graph.nodes.unshift(node);
    graph.selectedNodeId = node.id;
    graph.selectedNodeIds = [node.id];
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();
    renderGraphPalette();

    if (fitAfter) {
      requestProjectAnimationFrame(() => {
        centerGraph();
      });
    }

    return node;
  }

function addPaletteNodeAtCenter(
    operatorId,
    isConfiguration
  ) {
    if (!dom.viewport) {
      return;
    }

    const rectangle =
      dom.viewport.getBoundingClientRect();
    const visibleLeft =
      Math.max(0, rectangle.left);
    const visibleRight =
      Math.min(
        window.innerWidth,
        rectangle.right
      );
    const visibleTop =
      Math.max(0, rectangle.top);
    const visibleBottom =
      Math.min(
        window.innerHeight,
        rectangle.bottom
      );
    const point =
      clientToGraph(
        (visibleLeft + visibleRight) / 2,
        (visibleTop + visibleBottom) / 2
      );

    const x =
      point.x - 130 +
      (graph.nextSequence % 5) * 18;
    const y =
      point.y - 70 +
      (graph.nextSequence % 5) * 18;

    if (
      String(operatorId).startsWith(
        SAVED_API_COMPOSITE_PALETTE_PREFIX
      )
    ) {
      void instantiateSavedApiCompositeAt(
        String(operatorId).slice(
          SAVED_API_COMPOSITE_PALETTE_PREFIX.length
        ),
        x,
        y,
        { fitAfter: true }
      );
    } else if (isConfiguration) {
      addConfigurationNode(
        x,
        y,
        true
      );
    } else {
      addOperatorNode(
        operatorId,
        x,
        y,
        true
      );
    }
  }

function createToolbarButton(
    text,
    handler,
    className = "secondary"
  ) {
    const button =
      document.createElement("button");
    button.type = "button";
    button.className =
      `button ${className}`;
    button.textContent = text;
    button.addEventListener(
      "click",
      event => {
        event.stopPropagation();
        handler();
      }
    );
    return button;
  }

const GRAPH_TOOLBAR_ICONS =
    Object.freeze({
      center: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5"></path>
          <circle cx="12" cy="12" r="2.5"></circle>
        </svg>`,
      clear: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"></path>
        </svg>`,
      zoomOut: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5"></circle>
          <path d="M15.5 15.5 21 21M7.5 10.5h6"></path>
        </svg>`,
      zoomIn: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5"></circle>
          <path d="M15.5 15.5 21 21M7.5 10.5h6M10.5 7.5v6"></path>
        </svg>`,
      editMode: `
        <svg class="rml-graph-edit-enter-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"></path>
        </svg>
        <svg class="rml-graph-edit-exit-icon" viewBox="0 0 24 24" aria-hidden="true" hidden>
          <path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"></path>
        </svg>`,
      search: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="10.5" cy="10.5" r="6.5"></circle>
          <path d="M15.5 15.5 21 21"></path>
        </svg>`,
      next: `
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M5 6h14M12 5v13M7.5 14.5 12 19l4.5-4.5"></path>
        </svg>`
    });

function createToolbarIconButton(
    iconMarkup,
    label,
    handler,
    className = "secondary"
  ) {
    const button =
      createToolbarButton(
        "",
        handler,
        className
      );
    button.classList.add(
      "rml-graph-icon-button"
    );
    button.innerHTML =
      `${iconMarkup}<span class="rml-graph-toolbar-sr-label">${label}</span>`;
    button.title = label;
    button.dataset.help = label;
    button.setAttribute(
      "aria-label",
      label
    );
    return button;
  }

function graphNodeSearchText(node) {
    const definition = nodeDefinition(node);
    return [
      node.label,
      definition?.title,
      definition?.group,
      node.operatorId
    ].filter(Boolean).join(" ").toLowerCase();
  }

function focusGraphNodeSearch(query, advance = true) {
    const normalized = String(query || "").trim().toLowerCase();
    if (!normalized) {
      graphNodeSearchQuery = "";
      graphNodeSearchIndex = -1;
      return 0;
    }

    const matches = graph.nodes.filter(node =>
      graphNodeSearchText(node).includes(normalized)
    );
    if (matches.length === 0) {
      graphNodeSearchQuery = normalized;
      graphNodeSearchIndex = -1;
      showGraphMessage("No graph node matches this search.", "error");
      return 0;
    }

    if (graphNodeSearchQuery !== normalized) {
      graphNodeSearchQuery = normalized;
      graphNodeSearchIndex = 0;
    } else if (advance) {
      graphNodeSearchIndex = (graphNodeSearchIndex + 1) % matches.length;
    } else if (graphNodeSearchIndex < 0 || graphNodeSearchIndex >= matches.length) {
      graphNodeSearchIndex = 0;
    }

    const node = matches[graphNodeSearchIndex];
    graph.selectedNodeId = node.id;
    graph.selectedNodeIds = [node.id];
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    renderGraphNodesAndWires();
    renderGraphInspector();

    const element = dom.nodesHost?.querySelector(
      `[data-graph-node-id="${CSS.escape(node.id)}"]`
    );
    const rectangle = dom.viewport?.getBoundingClientRect();
    if (rectangle) {
      const estimated =
        estimatedGraphNodeGeometry(node);
      const width =
        element?.offsetWidth ||
        estimated.width;
      const height =
        element?.offsetHeight ||
        estimated.height;
      graph.viewport.x = rectangle.width / 2 - (node.x + width / 2) * graph.viewport.scale;
      graph.viewport.y = rectangle.height / 2 - (node.y + height / 2) * graph.viewport.scale;
      applyViewportTransform();
      persistGraphView();
      scheduleGraphNodeVirtualization();
    }

    showGraphMessage(
      `Node ${graphNodeSearchIndex + 1} of ${matches.length}: ${node.label || nodeDefinition(node).title}`,
      "success"
    );
    return matches.length;
  }

function renderGraphCanvas() {
    if (
      !graph.active ||
      !runtimeGraphViewActive ||
      !dom.builderCanvas
    ) {
      return;
    }
    if (
      customCSharpInlineEditorKey &&
      customCSharpEditorRecordActive(
        customCSharpDetachedEditors.get(
          customCSharpInlineEditorKey
        )
      )
    ) {
      return;
    }

    cancelInteraction(false);
    if (!currentAnalysis) {
      pruneConnections();
    }

    releaseGraphToolbarResizeTracking();
    detachGraphHybridRenderer();
    graphNodeVirtualizationSignature = "";

    dom.builderCanvas.replaceChildren();

    const root =
      document.createElement("div");
    root.className =
      "rml-graph-root";
    root.addEventListener(
      "click",
      event =>
        event.stopPropagation()
    );

    const toolbar =
      document.createElement("div");
    toolbar.className =
      "rml-graph-toolbar";

    toolbar.append(
      createToolbarIconButton(
        GRAPH_TOOLBAR_ICONS.center,
        "Center Graph",
        centerGraph
      ),
      createToolbarIconButton(
        GRAPH_TOOLBAR_ICONS.clear,
        "Clear Operators",
        clearGraphOperators
      )
    );

    const zoomOut =
      createToolbarIconButton(
        GRAPH_TOOLBAR_ICONS.zoomOut,
        "Zoom out",
        () => zoomGraphBy(-0.1)
      );
    const zoomIn =
      createToolbarIconButton(
        GRAPH_TOOLBAR_ICONS.zoomIn,
        "Zoom in",
        () => zoomGraphBy(0.1)
      );
    toolbar.append(
      zoomOut,
      zoomIn
    );

    const editModeButton =
      createToolbarIconButton(
        GRAPH_TOOLBAR_ICONS.editMode,
        "Edit Mode",
        toggleGraphEditMode
      );
    editModeButton.classList.add(
      "rml-graph-edit-mode-button"
    );
    dom.editModeButton =
      editModeButton;
    updateGraphEditModeButton();
    toolbar.appendChild(
      editModeButton
    );

    const nodeSearch = document.createElement("div");
    nodeSearch.className = "rml-graph-node-search";
    const nodeSearchInput = document.createElement("input");
    nodeSearchInput.type = "search";
    nodeSearchInput.placeholder = "Find node in graph…";
    nodeSearchInput.autocomplete = "off";
    const nodeSearchNext = createToolbarIconButton(
      GRAPH_TOOLBAR_ICONS.next,
      "Next",
      () =>
        focusGraphNodeSearch(
          nodeSearchInput.value,
          true
        )
    );
    nodeSearchNext.title =
      "Jump to the next matching node";
    nodeSearchNext.dataset.help =
      nodeSearchNext.title;
    nodeSearchNext.setAttribute(
      "aria-label",
      nodeSearchNext.title
    );
    nodeSearchInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        focusGraphNodeSearch(nodeSearchInput.value, true);
      }
    });
    nodeSearchInput.addEventListener("input", () => {
      if (nodeSearchInput.value.trim() !== graphNodeSearchQuery) {
        graphNodeSearchIndex = -1;
      }
    });
    nodeSearch.append(nodeSearchInput, nodeSearchNext);
    toolbar.appendChild(nodeSearch);

    const compactSearchButton =
      createToolbarIconButton(
        GRAPH_TOOLBAR_ICONS.search,
        "Find node in graph",
        () => {
          const overlay = root.querySelector(
            ":scope > .rml-graph-search-overlay"
          );

          if (!overlay) {
            return;
          }

          overlay.hidden = false;
          const input = overlay.querySelector("input");
          if (input instanceof HTMLInputElement) {
            input.value = nodeSearchInput.value;
            requestProjectAnimationFrame(() => {
              input.focus({ preventScroll: true });
              input.select();
            });
          }
        }
      );
    compactSearchButton.classList.add(
      "rml-graph-compact-search-button"
    );
    compactSearchButton.title = "Find node in graph";
    compactSearchButton.dataset.help =
      compactSearchButton.title;
    compactSearchButton.setAttribute(
      "aria-label",
      "Find node in graph"
    );
    toolbar.appendChild(compactSearchButton);

    const searchOverlay =
      document.createElement("div");
    searchOverlay.className =
      "rml-graph-search-overlay";
    searchOverlay.hidden = true;
    searchOverlay.innerHTML = `
      <div class="rml-graph-search-overlay-card" role="dialog" aria-modal="true" aria-label="Find node in graph">
        <div class="rml-graph-search-overlay-head">
          <strong>Find node in graph</strong>
          <button class="rml-graph-search-overlay-close" type="button" aria-label="Close search">×</button>
        </div>
        <div class="rml-graph-search-overlay-body">
          <input type="search" autocomplete="off" placeholder="Find node in graph…">
          <button class="button secondary rml-graph-icon-button rml-graph-search-overlay-next" type="button" title="Jump to the next matching node" aria-label="Jump to the next matching node">
            ${GRAPH_TOOLBAR_ICONS.next}
            <span class="rml-graph-toolbar-sr-label">Next</span>
          </button>
        </div>
      </div>`;

    const overlayInput =
      searchOverlay.querySelector("input");
    const overlayNext =
      searchOverlay.querySelector(
        ".rml-graph-search-overlay-next"
      );
    const overlayClose =
      searchOverlay.querySelector(
        ".rml-graph-search-overlay-close"
      );

    const closeSearchOverlay = () => {
      searchOverlay.hidden = true;
      compactSearchButton.focus({
        preventScroll: true
      });
    };

    const runOverlaySearch = () => {
      if (!(overlayInput instanceof HTMLInputElement)) {
        return;
      }

      nodeSearchInput.value = overlayInput.value;
      focusGraphNodeSearch(
        overlayInput.value,
        true
      );
    };

    overlayInput?.addEventListener(
      "input",
      () => {
        if (!(overlayInput instanceof HTMLInputElement)) {
          return;
        }

        if (
          overlayInput.value.trim() !==
          graphNodeSearchQuery
        ) {
          graphNodeSearchIndex = -1;
        }
      }
    );
    overlayInput?.addEventListener(
      "keydown",
      event => {
        if (event.key === "Enter") {
          event.preventDefault();
          runOverlaySearch();
        } else if (event.key === "Escape") {
          event.preventDefault();
          closeSearchOverlay();
        }
      }
    );
    overlayNext?.addEventListener(
      "click",
      runOverlaySearch
    );
    overlayClose?.addEventListener(
      "click",
      closeSearchOverlay
    );
    searchOverlay.addEventListener(
      "pointerdown",
      event => {
        if (event.target === searchOverlay) {
          closeSearchOverlay();
        }
      }
    );
    root.appendChild(searchOverlay);

    const badge =
      document.createElement("div");
    badge.className =
      "rml-graph-source-badge";
    toolbar.appendChild(badge);

    const viewport =
      document.createElement("div");
    viewport.className =
      "rml-graph-viewport";

    const stage =
      document.createElement("div");
    stage.className =
      "rml-graph-stage";

    const svg =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "svg"
      );
    svg.classList.add(
      "rml-graph-wires"
    );
    svg.setAttribute(
      "width",
      String(GRAPH_STAGE_WIDTH)
    );
    svg.setAttribute(
      "height",
      String(GRAPH_STAGE_HEIGHT)
    );
    svg.setAttribute(
      "overflow",
      "visible"
    );

    const nodesHost =
      document.createElement("div");
    nodesHost.className =
      "rml-graph-nodes";

    stage.append(svg, nodesHost);

    const hybridFactory =
      window.RMLGraphHybridRenderer;
    const rendererAttachment = {
      viewport,
      onAvailabilityChange(
        available
      ) {
        root.classList.toggle(
          "rml-graph-hybrid-active",
          available
        );
        const synchronizeRenderer = () => {
          renderGraphNodes();
          renderGraphWires();
        };
        if (
          dom.viewport === viewport &&
          dom.nodesHost &&
          dom.wires
        ) {
          synchronizeRenderer();
        } else {
          requestProjectAnimationFrame(
            synchronizeRenderer
          );
        }
      }
    };
    if (
      typeof graphHybridRenderer?.attach ===
        "function" ||
      typeof hybridFactory?.create ===
        "function"
    ) {
      try {
        if (
          typeof graphHybridRenderer?.attach ===
            "function"
        ) {
          graphHybridRenderer.attach(
            rendererAttachment
          );
        } else {
          graphHybridRenderer =
            hybridFactory.create(
              rendererAttachment
            );
        }
      } catch (error) {
        disposeGraphHybridRenderer();
        console.error(
          "RML graph hybrid renderer could not be created. SVG fallback remains active.",
          error
        );
      }
    }

    if (graphHybridRenderer?.canvas) {
      viewport.appendChild(
        graphHybridRenderer.canvas
      );
    }
    viewport.appendChild(stage);

    const toast =
      ensureGraphViewportToast();

    const navigationTrail =
      createGraphNavigationTrail();

    root.append(
      navigationTrail,
      toolbar,
      viewport
    );
    dom.builderCanvas.appendChild(root);

    dom.root = root;
    dom.navigationTrail =
      navigationTrail;
    dom.toolbar = toolbar;
    dom.viewport = viewport;
    dom.stage = stage;
    dom.wires = svg;
    dom.nodesHost = nodesHost;
    dom.gpuCanvas =
      graphHybridRenderer?.canvas || null;
    dom.toast = toast;
    dom.sourceBadge = badge;

    const updateToolbarLayout = () => {
      const width = root.getBoundingClientRect().width;
      root.classList.toggle(
        "rml-graph-compact-toolbar",
        width < 760
      );
      root.classList.toggle(
        "rml-graph-tiny-toolbar",
        width < 520
      );
    };

    updateToolbarLayout();

    if (typeof ResizeObserver === "function") {
      graphToolbarResizeObserver =
        new ResizeObserver(updateToolbarLayout);
      graphToolbarResizeObserver.observe(root);
    } else {
      graphToolbarResizeFallback =
        updateToolbarLayout;
      window.addEventListener(
        "resize",
        graphToolbarResizeFallback,
        { passive: true }
      );
    }

    viewport.addEventListener(
      "pointerdown",
      beginViewportPan
    );
    viewport.addEventListener(
      "contextmenu",
      event =>
        event.preventDefault()
    );

    if (
      graph.nodes.length >
        GRAPH_DOM_VIRTUALIZATION_THRESHOLD &&
      !graphViewportHasVisibleNode()
    ) {
      centerGraph();
    } else {
      applyViewportTransform();
    }
    renderGraphNodesAndWires();
    updateSourceBadge();

    if (dom.itemCount) {
      dom.itemCount.textContent =
        String(graph.nodes.length);
    }
  }

function applyViewportTransform() {
    if (!dom.stage) {
      return;
    }

    const previousOverview =
      graphGpuOverviewMode;
    const overview =
      graphGpuOverviewActive();

    dom.stage.dataset.rmlViewportX =
      String(graph.viewport.x);
    dom.stage.dataset.rmlViewportY =
      String(graph.viewport.y);
    dom.stage.dataset.rmlViewportScale =
      String(graph.viewport.scale);

    graphHybridRenderer?.setCamera?.(
      graph.viewport
    );
    const viewportPanActive =
      activeInteraction?.kind === "pan";
    const liveNodeVirtualizationRequired =
      graphHybridActive() ||
      fallbackGraphVirtualizationActive();
    if (
      (
        !viewportPanActive ||
        liveNodeVirtualizationRequired
      ) &&
      (
        !overview ||
        overview !== previousOverview
      ) &&
      graphNodeVirtualizationRefreshRequired()
    ) {
      scheduleGraphNodeVirtualization();
    }

    if (
      !viewportPanActive &&
      fallbackGraphVirtualizationActive()
    ) {
      scheduleGraphWireRender();
    }

    scheduleGraphScrollLayerVisualRefresh();
  }

function installGraphRevealProvider() {
    if (
      !window.RMLScrollManager?.registerRevealProvider ||
      window.__RMLGraphRevealProviderInstalled
    ) {
      return;
    }

    window.__RMLGraphRevealProviderInstalled = true;

    window.RMLScrollManager.registerRevealProvider(
      "typed-runtime-graph-virtual-surface",
      (element, context = {}) => {
        if (
          !graph?.active ||
          !runtimeGraphViewActive ||
          !dom.viewport?.isConnected ||
          !(element instanceof HTMLElement) ||
          !dom.viewport.contains(element) ||
          element === dom.viewport
        ) {
          return false;
        }

        const node =
          element.closest(".rml-graph-node");

        if (!node || !dom.nodesHost?.contains(node)) {
          return false;
        }

        const viewportRect =
          dom.viewport.getBoundingClientRect();
        const targetRect =
          element.getBoundingClientRect();
        const margin =
          Math.max(0, Number(context.margin) || 18);

        const left = viewportRect.left + margin;
        const right = viewportRect.right - margin;
        const top = viewportRect.top + margin;
        const bottom = viewportRect.bottom - margin;

        let dx = 0;
        let dy = 0;

        if (targetRect.width > Math.max(1, right - left)) {
          dx = left - targetRect.left;
        } else if (targetRect.left < left) {
          dx = left - targetRect.left;
        } else if (targetRect.right > right) {
          dx = right - targetRect.right;
        }

        if (targetRect.height > Math.max(1, bottom - top)) {
          dy = top - targetRect.top;
        } else if (targetRect.top < top) {
          dy = top - targetRect.top;
        } else if (targetRect.bottom > bottom) {
          dy = bottom - targetRect.bottom;
        }

        if (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) {
          return false;
        }

        if (graphRevealAnimationFrame) {
          cancelAnimationFrame(
            graphRevealAnimationFrame
          );
          graphRevealAnimationFrame = 0;
        }

        if (context.behavior !== "smooth") {
          graph.viewport.x += dx;
          graph.viewport.y += dy;
          applyViewportTransform();
          persistGraphView();
          return true;
        }

        const startX = graph.viewport.x;
        const startY = graph.viewport.y;
        const targetX = startX + dx;
        const targetY = startY + dy;
        const startedAt = performance.now();
        const duration = 430;

        const animateReveal = now => {
          const raw =
            Math.min(
              1,
              (now - startedAt) /
                duration
            );
          const eased =
            raw < 0.5
              ? 2 * raw * raw
              : 1 -
                Math.pow(
                  -2 * raw + 2,
                  2
                ) / 2;

          graph.viewport.x =
            startX +
            (targetX - startX) *
              eased;
          graph.viewport.y =
            startY +
            (targetY - startY) *
              eased;

          applyViewportTransform();

          if (raw < 1) {
            graphRevealAnimationFrame =
              requestProjectAnimationFrame(
                animateReveal
              );
          } else {
            graphRevealAnimationFrame = 0;
            persistGraphView();
          }
        };

        graphRevealAnimationFrame =
          requestProjectAnimationFrame(
            animateReveal
          );

        return true;
      },
      100
    );
  }

function graphToClient(
    x,
    y
  ) {
    const rectangle =
      dom.viewport
        ?.getBoundingClientRect();

    if (!rectangle) {
      return {
        x: 0,
        y: 0
      };
    }

    return {
      x:
        rectangle.left +
        graph.viewport.x +
        x * graph.viewport.scale,
      y:
        rectangle.top +
        graph.viewport.y +
        y * graph.viewport.scale
    };
  }

function clientToGraph(
    clientX,
    clientY
  ) {
    const rectangle =
      dom.viewport
        ?.getBoundingClientRect();

    if (!rectangle) {
      return {
        x: 0,
        y: 0
      };
    }

    return {
      x:
        (
          clientX -
          rectangle.left -
          graph.viewport.x
        ) /
        graph.viewport.scale,
      y:
        (
          clientY -
          rectangle.top -
          graph.viewport.y
        ) /
        graph.viewport.scale
    };
  }

function zoomGraphBy(delta) {
    if (!dom.viewport) {
      return;
    }

    const rectangle =
      dom.viewport.getBoundingClientRect();
    setGraphZoomAt(
      nodeGraphClamp(
        graph.viewport.scale + delta,
        GRAPH_MIN_ZOOM,
        GRAPH_MAX_ZOOM
      ),
      rectangle.left +
        rectangle.width / 2,
      rectangle.top +
        rectangle.height / 2
    );
  }

function setGraphZoomAt(
    nextScale,
    clientX,
    clientY
  ) {
    const before =
      clientToGraph(
        clientX,
        clientY
      );

    graph.viewport.scale =
      nodeGraphClamp(
        nextScale,
        GRAPH_MIN_ZOOM,
        GRAPH_MAX_ZOOM
      );

    const rectangle =
      dom.viewport.getBoundingClientRect();

    graph.viewport.x =
      clientX -
      rectangle.left -
      before.x *
        graph.viewport.scale;
    graph.viewport.y =
      clientY -
      rectangle.top -
      before.y *
        graph.viewport.scale;

    applyViewportTransform();
    persistGraphView();
  }

function normalizedWheelDelta(
    event,
    referenceElement = dom.viewport
  ) {
    const scale =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? Math.max(
              1,
              referenceElement?.clientHeight ||
                window.innerHeight ||
                1
            )
          : 1;

    return {
      x: event.deltaX * scale,
      y: event.deltaY * scale
    };
  }

function rootWheelDelta(event) {
    const delta =
      normalizedWheelDelta(
        event,
        dom.viewport
      );

    if (
      event.shiftKey &&
      Math.abs(delta.x) <
        Math.abs(delta.y)
    ) {
      return {
        x: delta.y,
        y: 0
      };
    }

    return delta;
  }

function panGraphWithWheel(event) {
    const delta =
      rootWheelDelta(event);

    graph.viewport.x -= delta.x;
    graph.viewport.y -= delta.y;

    applyViewportTransform();
    persistGraphView();
  }

function graphEditModeScrollElement() {
    if (!graphEditModeActive()) {
      return null;
    }

    const workspace =
      document.querySelector(
        "body.rml-graph-edit-mode > main > .workspace"
      );

    return workspace instanceof HTMLElement
      ? workspace
      : null;
  }

function graphDocumentScrollElement() {
    return (
      graphEditModeScrollElement() ||
      document.scrollingElement ||
      document.documentElement
    );
  }

function graphScrollLayerMode(element) {
    return String(
      element?.getAttribute?.(
        "data-rml-scroll-layer"
      ) || ""
    )
      .trim()
      .toLowerCase();
  }

function graphScrollLayerAlwaysSelectable(
    element
  ) {
    return [
      "always",
      "true",
      "empty",
      "virtual",
      "programmatic"
    ].includes(
      graphScrollLayerMode(element)
    );
  }

function graphScrollLayerProgrammatic(
    element
  ) {
    return [
      "auto",
      "always",
      "true",
      "programmatic"
    ].includes(
      graphScrollLayerMode(element)
    );
  }

function graphScrollLayerAxes(element) {
    if (!(element instanceof HTMLElement)) {
      return {
        x: false,
        y: false
      };
    }

    const style =
      getComputedStyle(element);
    const programmatic =
      graphScrollLayerProgrammatic(
        element
      );
    const scrollableOverflow =
      value =>
        value === "auto" ||
        value === "scroll" ||
        value === "overlay";

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
  }

function graphVisibleViewportRectangle() {
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
        document.documentElement
          .clientWidth ||
        1
      );
    const height =
      Math.max(
        1,
        visual?.height ||
        window.innerHeight ||
        document.documentElement
          .clientHeight ||
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
  }

function scrollGraphDocumentLayer(
    event,
    descriptor
  ) {
    let target = null;

    if (
      descriptor.kind ===
        "html-root"
    ) {
      target =
        graphDocumentScrollElement() ===
          document.documentElement
          ? document.documentElement
          : null;
    } else if (
      descriptor.kind ===
        "document-root"
    ) {
      const scrolling =
        graphDocumentScrollElement();

      target =
        scrolling !==
          document.documentElement
          ? scrolling
          : null;
    }

    if (!target) {
      scheduleGraphScrollLayerVisualRefresh();

      return {
        moved: false,
        empty: true
      };
    }

    const delta =
      normalizedWheelDelta(
        event,
        target
      );

    let horizontal = delta.x;
    let vertical = delta.y;

    if (
      event.shiftKey &&
      Math.abs(horizontal) <
        Math.abs(vertical)
    ) {
      horizontal = vertical;
      vertical = 0;
    }

    const allowsX =
      target.scrollWidth >
      target.clientWidth + 1;
    const allowsY =
      target.scrollHeight >
      target.clientHeight + 1;

    if (!allowsX) horizontal = 0;
    if (!allowsY) vertical = 0;

    const beforeLeft =
      target.scrollLeft;
    const beforeTop =
      target.scrollTop;

    target.scrollLeft += horizontal;
    target.scrollTop += vertical;

    const moved =
      Math.abs(
        target.scrollLeft -
        beforeLeft
      ) > .25 ||
      Math.abs(
        target.scrollTop -
        beforeTop
      ) > .25;

    scheduleGraphScrollLayerVisualRefresh();

    return {
      moved,
      empty:
        !allowsX &&
        !allowsY
    };
  }

function graphScrollLayerCanScroll(
    element
  ) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    if (
      element ===
        document.documentElement
    ) {
      return true;
    }

    if (
      element ===
        graphDocumentScrollElement() &&
      element !==
        document.documentElement
    ) {
      return true;
    }

    if (element === dom.viewport) {
      return true;
    }

    const style =
      getComputedStyle(element);

    if (
      style.display === "none" ||
      style.visibility === "hidden"
    ) {
      return false;
    }

    const rectangle =
      element.getBoundingClientRect();

    if (
      rectangle.width <= 0 ||
      rectangle.height <= 0
    ) {
      return false;
    }

    const axes =
      graphScrollLayerAxes(element);

    return (
      axes.x ||
      axes.y ||
      graphScrollLayerAlwaysSelectable(
        element
      )
    );
  }

function graphScrollLayerVisible(
    element
  ) {
    if (
      !(element instanceof HTMLElement) ||
      !element.isConnected
    ) {
      return false;
    }

    const style =
      getComputedStyle(element);
    const rectangle =
      element.getBoundingClientRect();

    return (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      rectangle.width > 0 &&
      rectangle.height > 0
    );
  }

function graphScrollLayerHitTestVisibleAt(
    element,
    clientX,
    clientY
  ) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const viewport = graphVisibleViewportRectangle();

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
  }

function graphScrollLayerHasExposedPixels(
    element,
    rectangle = null
  ) {
    if (!(element instanceof HTMLElement)) {
      return false;
    }

    const rect = rectangle ||
      element.getBoundingClientRect();
    const viewport = graphVisibleViewportRectangle();
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

    for (const y of ys) {
      for (const x of xs) {
        const hit = graphScrollLayerHitTestVisibleAt(
          element,
          x,
          y
        );
        if (hit) {
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

    for (const y of boundedYs) {
      for (const x of boundedXs) {
        if (graphScrollLayerHitTestVisibleAt(element, x, y)) {
          return true;
        }
      }
    }

    return false;
  }

function graphScrollLayerNodeTitle(
    element
  ) {
    const node =
      element?.closest?.(
        ".rml-graph-node"
      );

    return String(
      node?.querySelector(
        ".rml-graph-node-title > strong"
      )?.textContent ||
      node?.querySelector(
        ".rml-graph-node-title strong"
      )?.textContent ||
      ""
    )
      .replace(/\s+/g, " ")
      .trim();
  }

function graphScrollLayerLabel(
    element
  ) {
    if (
      element ===
        graphEditModeScrollElement()
    ) {
      return "Edit Mode · Workspace ROOT";
    }

    if (
      element ===
        document.documentElement
    ) {
      return "<html> · Page ROOT";
    }

    if (
      element ===
        graphDocumentScrollElement() &&
      element !==
        document.documentElement
    ) {
      return `${
        element.tagName.toLowerCase()
      } · Document scroll surface`;
    }

    if (element === dom.viewport) {
      return "Graph ROOT";
    }

    const nodeTitle =
      graphScrollLayerNodeTitle(
        element
      );

    if (
      element.matches(
        ".rml-graph-node-body"
      )
    ) {
      return nodeTitle
        ? `${nodeTitle} · Node contents`
        : "Node contents";
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
      element.getAttribute("title") ||
      element.getAttribute(
        "placeholder"
      ) ||
      (wrappingLabel !== element
        ? wrappingLabel?.childNodes?.[0]
            ?.textContent
        : "") ||
      "";

    let area = String(explicit)
      .replace(/\s+/g, " ")
      .trim();

    if (!area) {
      if (element.matches?.(".code-panel pre")) {
        area = "Generated code";
      } else if (
        element instanceof
          HTMLTextAreaElement
      ) {
        area = "Text editor";
      } else if (
        element.getAttribute("role") ===
          "listbox"
      ) {
        area = "Scrollable list";
      } else {
        area = "Nested scroll area";
      }
    }

    area = area.slice(0, 72);

    return nodeTitle
      ? `${nodeTitle} · ${area}`
      : area;
  }

function graphStableScrollLayerIdentity(
    element
  ) {
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

    return null;
  }

function graphElementBelongsToViewport(
    element
  ) {
    if (!element || !dom.viewport) {
      return false;
    }

    let current = element;

    while (current) {
      if (current === dom.viewport) {
        return true;
      }

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

    return false;
  }

function resolveGraphStableScrollLayerIdentity(
    identity
  ) {
    if (!identity?.value || !dom.viewport) {
      return null;
    }

    if (identity.kind === "dom-id") {
      const element =
        document.getElementById(
          identity.value
        );

      return element?.isConnected
        ? element
        : null;
    }

    const attribute =
      identity.kind === "declared-key"
        ? "data-rml-scroll-layer-key"
        : identity.kind === "node-scroll-id"
          ? "data-node-scroll-id"
          : "";

    return attribute
      ? document.querySelector(
          `[${attribute}="${CSS.escape(identity.value)}"]`
        )
      : null;
  }

function graphScrollLayerDescriptor(
    element
  ) {
    if (!(element instanceof HTMLElement)) {
      return null;
    }

    if (
      element ===
        document.documentElement
    ) {
      return {
        kind: "html-root",
        key: "html-root",
        label:
          graphScrollLayerLabel(
            element
          ),
        element
      };
    }

    if (
      element ===
        graphDocumentScrollElement() &&
      element !==
        document.documentElement
    ) {
      return {
        kind: "document-root",
        key: "document-root",
        label:
          graphScrollLayerLabel(
            element
          ),
        element
      };
    }

    if (element === dom.viewport) {
      return {
        kind: "root",
        key: "root",
        label: "Graph ROOT",
        element
      };
    }

    const node =
      element.closest(
        ".rml-graph-node"
      );
    const nodeId =
      node?.dataset.graphNodeId ||
      "";

    if (
      element.matches(
        ".rml-graph-node-body"
      ) &&
      nodeId
    ) {
      return {
        kind: "node-body",
        key: `node-body:${nodeId}`,
        label:
          graphScrollLayerLabel(
            element
          ),
        nodeId,
        element
      };
    }

    const stableIdentity =
      graphStableScrollLayerIdentity(
        element
      );

    let elementId =
      element.dataset
        .rmlGraphScrollLayerId;

    if (!stableIdentity && !elementId) {
      elementId =
        makeId("scroll-layer");
      element.dataset
        .rmlGraphScrollLayerId =
        elementId;
    }

    return {
      kind: "element",
      key:
        stableIdentity
          ? `element:${stableIdentity.kind}:${stableIdentity.value}`
          : `element:${elementId}`,
      label:
        graphScrollLayerLabel(
          element
        ),
      nodeId,
      stableIdentity,
      elementId,
      element
    };
  }

function resolveGraphScrollLayerElement(
    descriptor
  ) {
    if (!descriptor || !dom.viewport) {
      return null;
    }

    if (
      descriptor.kind ===
        "html-root"
    ) {
      return document.documentElement;
    }

    if (
      descriptor.kind ===
        "document-root"
    ) {
      const scrolling =
        graphDocumentScrollElement();

      return scrolling !==
        document.documentElement
        ? scrolling
        : null;
    }

    if (descriptor.kind === "root") {
      return dom.viewport;
    }

    if (
      descriptor.kind ===
        "node-body" &&
      descriptor.nodeId
    ) {
      return dom.nodesHost?.querySelector(
        `.rml-graph-node-body[data-node-scroll-id="${CSS.escape(descriptor.nodeId)}"]`
      ) || null;
    }

    if (
      descriptor.element
        ?.isConnected
    ) {
      return descriptor.element;
    }

    const stable =
      resolveGraphStableScrollLayerIdentity(
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
        `[data-rml-graph-scroll-layer-id="${CSS.escape(descriptor.elementId)}"]`
      );
    }

    return null;
  }

function graphDynamicAncestorElements(
    target,
    composedPath = null,
    hitPoint = null
  ) {
    const result = [];
    const seen = new Set();

    const add = element => {
      if (
        element instanceof HTMLElement &&
        element !== dom.viewport &&
        graphElementBelongsToViewport(element) &&
        !seen.has(element)
      ) {
        seen.add(element);
        result.push(element);
      }
    };

    const addOwningNodeBody = element => {
      if (!(element instanceof Element)) {
        return;
      }

      const node = element.closest(
        ".rml-graph-node"
      );
      const body = node?.querySelector(
        ":scope > .rml-graph-node-body"
      );

      if (body instanceof HTMLElement) {
        add(body);
      }
    };

    if (Array.isArray(composedPath)) {
      for (const item of composedPath) {
        if (item === dom.viewport) {
          break;
        }
        add(item);
        addOwningNodeBody(item);
      }
    }

    let current =
      target instanceof Element
        ? target
        : null;

    if (
      current &&
      graphElementBelongsToViewport(
        current
      )
    ) {
      addOwningNodeBody(current);
    } else {
      current = dom.viewport;
    }

    while (
      current &&
      current !== dom.viewport
    ) {
      add(current);
      addOwningNodeBody(current);

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

    if (
      Number.isFinite(hitPoint?.x) &&
      Number.isFinite(hitPoint?.y) &&
      typeof document.elementsFromPoint ===
        "function"
    ) {
      for (const element of
        document.elementsFromPoint(
          hitPoint.x,
          hitPoint.y
        )) {
        if (
          !graphElementBelongsToViewport(
            element
          )
        ) {
          continue;
        }

        add(element);
        addOwningNodeBody(element);
      }
    }

    return result;
  }

function graphViewportVisibleScrollElements() {
    const values = [];

    for (const element of
      document.querySelectorAll("*")) {
      if (
        !(element instanceof HTMLElement) ||
        element === document.documentElement ||
        element === document.body ||
        element === dom.viewport ||
        !graphScrollLayerCanScroll(element)
      ) {
        continue;
      }

      const descriptor =
        graphScrollLayerDescriptor(element);
      if (!descriptor) continue;

      const clipped =
        graphScrollLayerClipRectangle(
          element,
          descriptor
        );
      const width = Math.max(0, clipped.right - clipped.left);
      const height = Math.max(0, clipped.bottom - clipped.top);

      if (
        width < 1 ||
        height < 1 ||
        !graphScrollLayerHasExposedPixels(
          element,
          clipped
        )
      ) {
        continue;
      }

      const isGeneratedCode =
        element.matches(".code-panel pre") ||
        element.querySelector?.("#generated-code") != null;

      values.push({
        element,
        visibleArea: Math.max(1, width * height),
        priority: isGeneratedCode ? 1000 : 0,
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

    return values.map(value =>
      value.element
    );
  }

function graphScrollLayerCandidates(
    target,
    composedPath = null,
    hitPoint = null,
    options = {}
  ) {
    const candidates = [];
    const keys = new Set();

    for (
      const current of
      graphDynamicAncestorElements(
        target,
        composedPath,
        hitPoint
      )
    ) {
      if (
        graphScrollLayerCanScroll(
          current
        )
      ) {
        const descriptor =
          graphScrollLayerDescriptor(
            current
          );

        if (
          descriptor &&
          !keys.has(descriptor.key)
        ) {
          keys.add(descriptor.key);
          candidates.push(descriptor);
        }
      }
    }

    if (options.includeViewportWide === true) {
      for (const current of
        graphViewportVisibleScrollElements()) {
        const descriptor =
          graphScrollLayerDescriptor(current);

        if (
          descriptor &&
          !keys.has(descriptor.key)
        ) {
          keys.add(descriptor.key);
          candidates.push(descriptor);
        }
      }
    }

    const root =
      graphScrollLayerDescriptor(
        dom.viewport
      );

    if (root && !keys.has(root.key)) {
      keys.add(root.key);
      candidates.push(root);
    }

    const documentRoot =
      graphDocumentScrollElement();

    if (
      documentRoot instanceof
        HTMLElement &&
      documentRoot !==
        document.documentElement
    ) {
      const documentDescriptor =
        graphScrollLayerDescriptor(
          documentRoot
        );

      if (
        documentDescriptor &&
        !keys.has(
          documentDescriptor.key
        )
      ) {
        keys.add(
          documentDescriptor.key
        );
        candidates.push(
          documentDescriptor
        );
      }
    }

    if (!graphEditModeScrollElement()) {
      const html =
        graphScrollLayerDescriptor(
          document.documentElement
        );

      if (
        html &&
        !keys.has(html.key)
      ) {
        candidates.push(html);
      }
    }


    return candidates;
  }

function normalizeGraphScrollHierarchy(
    descriptors
  ) {
    return Array.isArray(descriptors)
      ? descriptors
      : [];
  }

function orderGraphScrollLayerCandidatesByReadingHierarchy(
    descriptors
  ) {
    const hierarchy =
      window.RMLScrollHierarchy;

    if (
      !hierarchy ||
      typeof hierarchy.orderByReadingHierarchy !==
        "function"
    ) {
      return normalizeGraphScrollHierarchy(
        descriptors
      );
    }

    const ordered =
      hierarchy.orderByReadingHierarchy(
        descriptors,
        {
          resolveElement:
            resolveGraphScrollLayerElement,
          isVirtualParent(parent, child) {
            if (
              parent?.kind !== "root" ||
              !child ||
              child.kind === "root" ||
              child.kind === "html-root" ||
              child.kind === "document-root"
            ) {
              return false;
            }

            const element =
              resolveGraphScrollLayerElement(
                child
              );

            return (
              element instanceof Element &&
              graphElementBelongsToViewport(
                element
              )
            );
          }
        }
      );

    return normalizeGraphScrollHierarchy(
      ordered
    );
  }

function refreshGraphScrollLayerCandidateChain(
    descriptors
  ) {
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
        resolveGraphScrollLayerElement(
          descriptor
        );
      const rebound =
        element
          ? graphScrollLayerDescriptor(
              element
            )
          : null;

      add(rebound || descriptor);
    }

    return normalizeGraphScrollHierarchy(
      refreshed
    );
  }

function ensureGraphScrollLayerVisuals() {
    if (!dom.viewport) {
      return;
    }

    if (
      !graphScrollLayerOutline
        ?.isConnected ||
      graphScrollLayerOutline
        .parentElement !== document.body
    ) {
      graphScrollLayerOutline
        ?.remove();
      graphScrollLayerOutline =
        document.createElement("div");
      graphScrollLayerOutline.className =
        "rml-graph-scroll-layer-outline";
      graphScrollLayerOutline.hidden =
        true;
      graphScrollLayerOutline.setAttribute(
        "aria-hidden",
        "true"
      );
      document.body.appendChild(
        graphScrollLayerOutline
      );
    }


  }

function hideGraphScrollLayerIndicator(
    immediate = false
  ) {
    window.clearTimeout(
      graphScrollLayerIndicatorTimer
    );
    graphScrollLayerIndicatorTimer = 0;

    if (!graphScrollLayerIndicator) {
      return;
    }

    graphScrollLayerIndicator
      .classList.remove("visible");

    if (immediate) {
      graphScrollLayerIndicator.hidden =
        true;
      return;
    }

    graphScrollLayerIndicatorTimer =
      window.setTimeout(() => {
        if (graphScrollLayerIndicator) {
          graphScrollLayerIndicator.hidden =
            true;
        }
      }, 180);
  }

function showGraphScrollLayerIndicator(
    mode,
    descriptor,
    options = {}
  ) {
    hideGraphScrollLayerIndicator(true);
  }

function graphScrollLayerClipRectangle(
    element,
    descriptor
  ) {
    if (
      descriptor?.kind ===
        "html-root" ||
      descriptor?.kind ===
        "document-root"
    ) {
      const viewportRectangle =
        graphVisibleViewportRectangle();

      return {
        left:
          viewportRectangle.left,
        top:
          viewportRectangle.top,
        right:
          viewportRectangle.right,
        bottom:
          viewportRectangle.bottom,
        viewportRectangle
      };
    }

    const belongsToGraph =
      graphElementBelongsToViewport(element);
    const viewportRectangle =
      belongsToGraph
        ? dom.viewport.getBoundingClientRect()
        : graphVisibleViewportRectangle();
    const rectangle =
      element.getBoundingClientRect();

    let left = Math.max(
      rectangle.left,
      viewportRectangle.left
    );
    let top = Math.max(
      rectangle.top,
      viewportRectangle.top
    );
    let right = Math.min(
      rectangle.right,
      viewportRectangle.right
    );
    let bottom = Math.min(
      rectangle.bottom,
      viewportRectangle.bottom
    );

    let ancestor =
      element.parentElement;

    while (
      ancestor &&
      ancestor !== (
        belongsToGraph
          ? dom.viewport
          : document.body
      ) &&
      ancestor !== document.documentElement
    ) {
      const style =
        getComputedStyle(ancestor);
      const clips =
        style.overflowX !== "visible" ||
        style.overflowY !== "visible";

      if (clips) {
        const clip =
          ancestor.getBoundingClientRect();
        left = Math.max(left, clip.left);
        top = Math.max(top, clip.top);
        right = Math.min(right, clip.right);
        bottom = Math.min(
          bottom,
          clip.bottom
        );
      }

      ancestor = ancestor.parentElement;
    }

    return {
      left,
      top,
      right,
      bottom,
      viewportRectangle
    };
  }

function positionGraphScrollLayerVisual() {
    graphScrollLayerVisualFrame = 0;

    const preview =
      graphScrollLayerSession
        ?.candidates?.[
          graphScrollLayerSession.index
        ] || null;
    const descriptor =
      preview ||
      graphScrollLayerSelection;

    if (!descriptor || !dom.viewport) {
      if (graphScrollLayerOutline) {
        graphScrollLayerOutline.hidden =
          true;
      }
      return;
    }

    const element =
      resolveGraphScrollLayerElement(
        descriptor
      );

    const renderable =
      element &&
      (
        descriptor.kind ===
          "root" ||
        descriptor.kind ===
          "html-root" ||
        descriptor.kind ===
          "document-root" ||
        (
          graphScrollLayerVisible(
            element
          ) &&
          graphScrollLayerHasExposedPixels(
            element,
            graphScrollLayerClipRectangle(
              element,
              descriptor
            )
          )
        )
      );

    if (!renderable) {
      if (graphScrollLayerOutline) {
        graphScrollLayerOutline.hidden =
          true;
      }
      return;
    }

    ensureGraphScrollLayerVisuals();

    const outline =
      graphScrollLayerOutline;
    const clipped =
      graphScrollLayerClipRectangle(
        element,
        descriptor
      );

    let left = clipped.left;
    let top = clipped.top;
    let right = clipped.right;
    let bottom = clipped.bottom;

    if (
      descriptor.kind ===
        "root"
    ) {
      left += 4;
      top += 4;
      right -= 4;
      bottom -= 4;
    } else if (
      descriptor.kind ===
        "html-root"
    ) {
      left += 5;
      top += 5;
      right -= 5;
      bottom -= 5;
    } else if (
      descriptor.kind ===
        "document-root"
    ) {
      left += 8;
      top += 8;
      right -= 8;
      bottom -= 8;
    }

    const width = Math.max(
      0,
      right - left
    );
    const height = Math.max(
      0,
      bottom - top
    );

    if (
      !outline ||
      width < 4 ||
      height < 4
    ) {
      if (outline) outline.hidden = true;
      return;
    }

    const computed =
      getComputedStyle(element);

    outline.dataset.rmlBoxLeft =
      String(left);
    outline.dataset.rmlBoxTop =
      String(top);
    outline.dataset.rmlBoxWidth =
      String(width);
    outline.dataset.rmlBoxHeight =
      String(height);
    outline.dataset.rmlBoxRadius =
      descriptor.kind ===
        "html-root"
        ? "12px"
        : computed.borderRadius === "0px"
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
  }

function scheduleGraphScrollLayerVisualRefresh() {
    if (
      !graphScrollLayerSelection &&
      !graphScrollLayerSession
    ) {
      return;
    }
    if (graphScrollLayerVisualFrame) {
      return;
    }

    graphScrollLayerVisualFrame =
      requestProjectAnimationFrame(
        positionGraphScrollLayerVisual
      );
  }

function followGraphScrollLayerVisualDuringViewportMotion(
    descriptor
  ) {
    if (graphScrollLayerVisualFollowFrame) {
      cancelAnimationFrame(
        graphScrollLayerVisualFollowFrame
      );
      graphScrollLayerVisualFollowFrame = 0;
    }

    const startedAt = performance.now();
    let lastLeft = Number.NaN;
    let lastTop = Number.NaN;
    let stableFrames = 0;

    const tick = () => {
      graphScrollLayerVisualFollowFrame = 0;

      if (
        !graphScrollLayerSelection ||
        !descriptor ||
        graphScrollLayerSelection.key !== descriptor.key
      ) {
        return;
      }

      positionGraphScrollLayerVisual();

      const element =
        resolveGraphScrollLayerElement(descriptor);

      if (!element?.isConnected) {
        return;
      }

      const rectangle =
        element.getBoundingClientRect();
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
        graphScrollLayerVisualFollowFrame =
          requestProjectAnimationFrame(tick);
      } else {
        positionGraphScrollLayerVisual();
      }
    };

    graphScrollLayerVisualFollowFrame =
      requestProjectAnimationFrame(tick);
  }

function clearGraphScrollLayerSelection(
    options = {}
  ) {
    graphScrollLayerSelection = null;
    graphScrollLayerSelectionCandidates = null;
    graphScrollLayerSession = null;
    graphCyclicWheelStepper?.reset?.();

    if (graphScrollLayerVisualFrame) {
      cancelAnimationFrame(
        graphScrollLayerVisualFrame
      );
      graphScrollLayerVisualFrame = 0;
    }

    if (graphScrollLayerVisualFollowFrame) {
      cancelAnimationFrame(
        graphScrollLayerVisualFollowFrame
      );
      graphScrollLayerVisualFollowFrame = 0;
    }

    if (graphScrollLayerOutline) {
      graphScrollLayerOutline.hidden =
        true;
    }

    if (options.keepIndicator !== true) {
      hideGraphScrollLayerIndicator(true);
    }
  }

function focusGraphScrollLayerInViewport(
    descriptor
  ) {
    if (
      !descriptor ||
      descriptor.kind === "html-root" ||
      descriptor.kind === "document-root"
    ) {
      return;
    }

    const element =
      resolveGraphScrollLayerElement(descriptor);

    if (!element?.isConnected) {
      return;
    }

    followGraphScrollLayerVisualDuringViewportMotion(
      descriptor
    );

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
  }

function commitGraphScrollLayerSelection() {
    const frozenChain =
      refreshGraphScrollLayerCandidateChain(
        graphScrollLayerSession
          ?.candidates ||
        graphScrollLayerSelectionCandidates ||
        (
          graphScrollLayerSelection
            ? [graphScrollLayerSelection]
            : []
        )
      );

    const candidate =
      graphScrollLayerSession
        ?.candidates?.[
          graphScrollLayerSession.index
        ] ||
      graphScrollLayerSelection ||
      null;

    graphScrollLayerSession = null;
    graphCyclicWheelStepper?.reset?.();

    if (!candidate) {
      scheduleGraphScrollLayerVisualRefresh();
      return graphScrollLayerSelection;
    }

    graphScrollLayerSelection =
      candidate;
    graphScrollLayerSelectionCandidates =
      frozenChain.length > 0
        ? frozenChain
        : [candidate];


    focusGraphScrollLayerInViewport(
      graphScrollLayerSelection
    );
    scheduleGraphScrollLayerVisualRefresh();

    showGraphScrollLayerIndicator(
      "GLOBAL SCROLL OVERRIDE LOCKED",
      graphScrollLayerSelection,
      {
        variant: "selected",
        duration: 1650
      }
    );

    return graphScrollLayerSelection;
  }

function cycleGraphScrollLayer(
    event
  ) {
    if (!claimGraphWheelEvent(event)) {
      return;
    }

    const previousActiveKey =
      graphScrollLayerSession
        ?.candidates?.[
          graphScrollLayerSession.index
        ]?.key ||
      graphScrollLayerSelection?.key ||
      "";

    let candidates;

    if (
      graphScrollLayerSession
        ?.candidates?.length
    ) {
      candidates =
        refreshGraphScrollLayerCandidateChain(
          graphScrollLayerSession
            .candidates
        );
    } else {
      candidates =
        graphScrollLayerCandidates(
          event.target,
          event.composedPath?.(),
          {
            x: event.clientX,
            y: event.clientY
          },
          { includeViewportWide: true }
        );
    }

    if (candidates.length === 0) {
      candidates = [
        graphScrollLayerDescriptor(
          graphDocumentScrollElement()
        )
      ].filter(Boolean);
    }

    const startingSession =
      !graphScrollLayerSession;

    if (startingSession) {
      candidates =
        orderGraphScrollLayerCandidatesByReadingHierarchy(
          candidates
        );
    }

    const selectedIndex =
      candidates.findIndex(
        candidate =>
          candidate.key ===
          previousActiveKey
      );

    if (startingSession) {
      graphScrollLayerSession = {
        candidates,
        index: 0,
        modifierLabel:
          event.metaKey &&
          !event.ctrlKey
            ? "COMMAND + WHEEL"
            : "CTRL + WHEEL"
      };
      graphCyclicWheelStepper?.reset?.();
    } else {
      graphScrollLayerSession.candidates =
        candidates;
      graphScrollLayerSession.index =
        selectedIndex >= 0
          ? selectedIndex
          : nodeGraphClamp(
              graphScrollLayerSession.index,
              0,
              candidates.length - 1
            );
    }

    const reference =
      event.target instanceof HTMLElement
        ? event.target
        : dom.viewport;
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
      Math.sign(dominant);

    if (
      direction !== 0 &&
      !startingSession
    ) {
      const stepped =
        graphCyclicWheelStepper?.step?.(
          graphScrollLayerSession.index,
          candidates.length,
          dominant
        );

      if (stepped) {
        graphScrollLayerSession.index =
          stepped.index;
      } else {
        graphScrollLayerSession.index =
          (
            graphScrollLayerSession.index +
            (direction > 0 ? 1 : -1) +
            candidates.length
          ) % candidates.length;
      }
    }

    const active =
      candidates[
        graphScrollLayerSession.index
      ];


    scheduleGraphScrollLayerVisualRefresh();
    showGraphScrollLayerIndicator(
      `${graphScrollLayerSession.modifierLabel} · GLOBAL OVERRIDE · ↓ INNER / ↑ OUTER`,
      active,
      {
        position:
          `Layer ${graphScrollLayerSession.index + 1}/${candidates.length}`,
        variant: "preview",
        sticky: true
      }
    );
  }

function graphScrollElementWithWheel(
    event,
    descriptor,
    element
  ) {
    const delta =
      normalizedWheelDelta(
        event,
        element
      );
    const axes =
      graphScrollLayerAxes(element);
    const allowsX = axes.x;
    const allowsY = axes.y;

    let horizontal = delta.x;
    let vertical = delta.y;

    if (
      event.shiftKey &&
      Math.abs(horizontal) <
        Math.abs(vertical)
    ) {
      horizontal = vertical;
      vertical = 0;
    } else if (
      !allowsY &&
      allowsX &&
      Math.abs(horizontal) <
        Math.abs(vertical)
    ) {
      horizontal = vertical;
      vertical = 0;
    }

    if (!allowsX) horizontal = 0;
    if (!allowsY) vertical = 0;

    const beforeLeft =
      element.scrollLeft;
    const beforeTop =
      element.scrollTop;

    element.scrollLeft += horizontal;
    element.scrollTop += vertical;

    const moved =
      Math.abs(
        element.scrollLeft -
        beforeLeft
      ) > .25 ||
      Math.abs(
        element.scrollTop -
        beforeTop
      ) > .25;


    if (
      descriptor.kind ===
        "node-body"
    ) {
      rememberNodeBodyScroll(
        descriptor.nodeId,
        element
      );
      scheduleNodeBodyWireRefresh(
        descriptor.nodeId
      );
    }

    scheduleGraphScrollLayerVisualRefresh();

    return moved;
  }

function selectedGraphScrollLayerFor(
    target,
    composedPath = null,
    hitPoint = null
  ) {
    if (graphScrollLayerSelection) {
      return {
        descriptor:
          graphScrollLayerSelection,
        element:
          resolveGraphScrollLayerElement(
            graphScrollLayerSelection
          ),
        explicit: true
      };
    }

    const descriptor =
      graphScrollLayerCandidates(
        target,
        composedPath,
        hitPoint,
        { includeViewportWide: false }
      )[0] ||
      graphScrollLayerDescriptor(
        dom.viewport
      );

    return {
      descriptor,
      element:
        resolveGraphScrollLayerElement(
          descriptor
        ),
      explicit: false
    };
  }

function handleGraphWheel(event) {
    if (
      !graph.active ||
      !runtimeGraphViewActive ||
      !dom.viewport
    ) {
      return;
    }

    const target =
      event.target instanceof Element
        ? event.target
        : null;
    const graphOwnsWheel =
      Boolean(
        graphScrollLayerSelection ||
        graphScrollLayerSession
      );
    const insideGraph =
      Boolean(
        target &&
        graphElementBelongsToViewport(
          target
        )
      );
    const universalState =
      window
        .RMLUniversalScrollLayers
        ?.getState?.();
    const universalOwnsWheel =
      Boolean(
        universalState?.active ||
        universalState?.cycling ||
        universalState?.selected
      );

    if (universalOwnsWheel) {
      return;
    }

    const graphRectangle =
      dom.viewport.getBoundingClientRect();
    const visibleViewport =
      graphVisibleViewportRectangle();
    const graphVisible =
      graphRectangle.right > visibleViewport.left &&
      graphRectangle.left < visibleViewport.right &&
      graphRectangle.bottom > visibleViewport.top &&
      graphRectangle.top < visibleViewport.bottom;

    if (
      !graphOwnsWheel &&
      !insideGraph &&
      !(
        (event.ctrlKey || event.metaKey) &&
        graphVisible
      )
    ) {
      return;
    }

    if (
      event.ctrlKey ||
      event.metaKey
    ) {
      cycleGraphScrollLayer(event);
      return;
    }

    if (graphScrollLayerSession) {
      commitGraphScrollLayerSelection();
    }

    if (!claimGraphWheelEvent(event)) {
      return;
    }

    const selected =
      selectedGraphScrollLayerFor(
        target,
        event.composedPath?.(),
        {
          x: event.clientX,
          y: event.clientY
        }
      );
    const descriptor =
      selected.descriptor;
    const element =
      selected.element ||
      resolveGraphScrollLayerElement(
        descriptor
      );

    if (!descriptor) {
      return;
    }

    if (!element) {
      scheduleGraphScrollLayerVisualRefresh();

      if (selected.explicit) {
        showGraphScrollLayerIndicator(
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

    let result = {
      moved: true,
      empty: false
    };

    if (descriptor.kind === "root") {
      panGraphWithWheel(event);
      scheduleGraphScrollLayerVisualRefresh();
    } else if (
      descriptor.kind ===
        "html-root" ||
      descriptor.kind ===
        "document-root"
    ) {
      result =
        scrollGraphDocumentLayer(
          event,
          descriptor
        );
    } else {
      result.moved =
        graphScrollElementWithWheel(
          event,
          descriptor,
          element
        );
      result.empty =
        !graphScrollLayerAxes(
          element
        ).x &&
        !graphScrollLayerAxes(
          element
        ).y;
    }

    if (selected.explicit) {
      showGraphScrollLayerIndicator(
        result.moved
          ? "GLOBAL OVERRIDE · SCROLLING LOCKED LEVEL"
          : result.empty
            ? "GLOBAL OVERRIDE · LOCKED LEVEL EMPTY"
            : "GLOBAL OVERRIDE · LOCKED LEVEL EDGE",
        descriptor,
        {
          variant:
            result.moved
              ? "selected"
              : result.empty
                ? "empty"
                : "edge",
          duration: 900
        }
      );
    }
  }

function activeGraphScrollLayerDescriptor() {
    return (
      graphScrollLayerSession
        ?.candidates?.[
          graphScrollLayerSession.index
        ] ||
      graphScrollLayerSelection ||
      null
    );
  }

function graphDescriptorHasHorizontalScroll(
    descriptor
  ) {
    if (!descriptor) {
      return false;
    }

    if (descriptor.kind === "root") {
      return false;
    }

    let element =
      resolveGraphScrollLayerElement(
        descriptor
      );

    if (
      descriptor.kind ===
        "html-root"
    ) {
      element =
        graphDocumentScrollElement() ===
          document.documentElement
          ? document.documentElement
          : null;
    } else if (
      descriptor.kind ===
        "document-root"
    ) {
      const scrolling =
        graphDocumentScrollElement();

      element =
        scrolling !==
          document.documentElement
          ? scrolling
          : null;
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

    return graphScrollLayerAxes(
      element
    ).x;
  }

function releaseGraphScrollLayerFromInput() {
    const previous =
      activeGraphScrollLayerDescriptor();

    if (
      !graph?.active ||
      !runtimeGraphViewActive ||
      !previous
    ) {
      return false;
    }

    clearGraphScrollLayerSelection({
      keepIndicator: true
    });

    showGraphScrollLayerIndicator(
      "SCROLL LEVEL RELEASED",
      previous,
      {
        variant: "cancelled",
        duration: 900
      }
    );

    return true;
  }

function handleGraphScrollLayerCancelClick() {
    releaseGraphScrollLayerFromInput();
  }

function handleGraphScrollLayerCancelKeyDown(
    event
  ) {
    if (
      !graph?.active ||
      !runtimeGraphViewActive ||
      (
        !graphScrollLayerSelection &&
        !graphScrollLayerSession
      )
    ) {
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
      graphDescriptorHasHorizontalScroll(
        activeGraphScrollLayerDescriptor()
      )
    ) {
      return;
    }

    releaseGraphScrollLayerFromInput();
  }

function handleGraphModifierKeyUp(
    event
  ) {
    if (
      !graph?.active ||
      !runtimeGraphViewActive ||
      !graphScrollLayerSession
    ) {
      return;
    }

    if (
      event.key === "Control" ||
      event.key === "Meta"
    ) {
      commitGraphScrollLayerSelection();
    }
  }

function centerGraph() {
    if (
      !dom.viewport ||
      graph.nodes.length === 0
    ) {
      return;
    }

    let minimumX = Infinity;
    let minimumY = Infinity;
    let maximumX = -Infinity;
    let maximumY = -Infinity;

    for (const node of graph.nodes) {
      const element =
        dom.nodesHost?.querySelector(
          `[data-graph-node-id="${CSS.escape(node.id)}"]`
        );
      const geometry =
        estimatedGraphNodeGeometry(node);
      const width =
        element?.offsetWidth ||
        geometry.width;
      const height =
        element?.offsetHeight ||
        geometry.height;

      minimumX = Math.min(
        minimumX,
        node.x
      );
      minimumY = Math.min(
        minimumY,
        node.y
      );
      maximumX = Math.max(
        maximumX,
        node.x + width
      );
      maximumY = Math.max(
        maximumY,
        node.y + height
      );
    }

    for (const connection of graph.connections) {
      for (const point of connection.points || []) {
        minimumX = Math.min(
          minimumX,
          point.x
        );
        minimumY = Math.min(
          minimumY,
          point.y
        );
        maximumX = Math.max(
          maximumX,
          point.x
        );
        maximumY = Math.max(
          maximumY,
          point.y
        );
      }
    }

    const rectangle =
      dom.viewport.getBoundingClientRect();
    const contentWidth =
      Math.max(
        1,
        maximumX - minimumX
      );
    const contentHeight =
      Math.max(
        1,
        maximumY - minimumY
      );
    const scale = nodeGraphClamp(
      Math.min(
        (rectangle.width - 100) /
          contentWidth,
        (rectangle.height - 100) /
          contentHeight,
        1.15
      ),
      GRAPH_MIN_ZOOM,
      GRAPH_MAX_ZOOM
    );

    graph.viewport.scale = scale;
    graph.viewport.x =
      (rectangle.width -
        contentWidth * scale) /
        2 -
      minimumX * scale;
    graph.viewport.y =
      (rectangle.height -
        contentHeight * scale) /
        2 -
      minimumY * scale;

    applyViewportTransform();
    persistGraphView();
  }

function connectedPortKeys() {
    if (
      graphConnectedPortKeysSource ===
        graph.connections &&
      graphConnectedPortKeysLength ===
        graph.connections.length
    ) {
      return graphConnectedPortKeysCache;
    }

    const keys = new Set();

    for (const connection of graph.connections) {
      keys.add(
        `output:${connection.fromNode}:${connection.fromPort}`
      );
      keys.add(
        `input:${connection.toNode}:${connection.toPort}`
      );
    }

    graphConnectedPortKeysSource =
      graph.connections;
    graphConnectedPortKeysLength =
      graph.connections.length;
    graphConnectedPortKeysCache = keys;
    return graphConnectedPortKeysCache;
  }

function scheduleNodeBodyWireRefresh(
    nodeId = null
  ) {
    const connectionIds = nodeId
      ? incidentGraphConnectionIds(nodeId)
      : null;
    scheduleGraphWireRender(connectionIds);
  }

function scheduleGraphWireRender(
    connectionIds = null
  ) {
    if (
      connectionIds === null ||
      connectionIds === undefined
    ) {
      graphWireFullRenderPending = true;
      graphWirePartialConnectionIds.clear();
    } else if (!graphWireFullRenderPending) {
      for (
        const connectionId of
        Array.isArray(connectionIds) ||
        connectionIds instanceof Set
          ? connectionIds
          : [connectionIds]
      ) {
        if (connectionId) {
          graphWirePartialConnectionIds.add(
            connectionId
          );
        }
      }
    }
    if (graphWireRenderFrame) {
      return;
    }
    const projectEpoch =
      builderProjectEpoch;
    graphWireRenderFrame =
      requestProjectAnimationFrame(() => {
        graphWireRenderFrame = 0;
        if (
          projectEpoch !==
            builderProjectEpoch
        ) {
          graphWireFullRenderPending = false;
          graphWirePartialConnectionIds.clear();
          return;
        }
        const full =
          graphWireFullRenderPending;
        const partial = [
          ...graphWirePartialConnectionIds
        ];
        graphWireFullRenderPending = false;
        graphWirePartialConnectionIds.clear();
        if (
          !full &&
          partial.length > 0 &&
          updateGraphWireConnections(
            partial
          )
        ) {
          return;
        }
        renderGraphWires();
      });
  }

function scheduleRenderedNodeResizeLimitRefresh() {
    if (nodeResizeLimitRefreshFrame) {
      return;
    }

    const projectEpoch =
      builderProjectEpoch;
    nodeResizeLimitRefreshFrame =
      requestProjectAnimationFrame(() => {
        nodeResizeLimitRefreshFrame = 0;
        if (
          projectEpoch !==
            builderProjectEpoch
        ) {
          return;
        }
        refreshRenderedNodeResizeLimits();
        scheduleGraphWireRender();
      });
  }

function rememberNodeBodyScroll(
    nodeId,
    body
  ) {
    if (!nodeId || !body) {
      return;
    }

    nodeBodyScrollPositions.set(
      nodeId,
      {
        top: body.scrollTop,
        left: body.scrollLeft
      }
    );
  }

function captureRenderedNodeBodyScrolls() {
    if (!dom.nodesHost) {
      return;
    }

    for (
      const body of
      dom.nodesHost.querySelectorAll(
        ".rml-graph-node-body[data-node-scroll-id]"
      )
    ) {
      rememberNodeBodyScroll(
        body.dataset.nodeScrollId,
        body
      );
    }
  }

function restoreNodeBodyScroll(
    nodeId,
    body
  ) {
    const saved =
      nodeBodyScrollPositions.get(
        nodeId
      );

    if (!saved || !body) {
      return;
    }

    body.scrollTop = saved.top;
    body.scrollLeft = saved.left;
  }

function syncNodeBodyOverflow(article) {
    const body = article?.querySelector(
      ".rml-graph-node-body"
    );
    if (!body) return;

    const hasY = body.scrollHeight > body.clientHeight + 1;
    const hasX = body.scrollWidth > body.clientWidth + 1;

    body.classList.toggle(
      "rml-scroll-y",
      hasY
    );
    body.classList.toggle(
      "rml-scroll-x",
      hasX
    );

    if (!hasY) body.scrollTop = 0;
    if (!hasX) body.scrollLeft = 0;

    scheduleNodeBodyWireRefresh(
      article.dataset.graphNodeId || null
    );
  }

function scheduleNodeBodyOverflowSync(article) {
    const projectEpoch =
      builderProjectEpoch;
    requestProjectAnimationFrame(() => {
      if (
        projectEpoch !==
          builderProjectEpoch
      ) {
        return;
      }
      syncNodeBodyOverflow(article);
      requestProjectAnimationFrame(() => {
        if (
          projectEpoch ===
            builderProjectEpoch
        ) {
          syncNodeBodyOverflow(article);
        }
      });
    });
  }

function renderGraphNodesAndWires() {
    if (
      !dom.nodesHost ||
      !dom.wires
    ) {
      return;
    }

    if (!currentAnalysis) {
      pruneConnections();
    }
    scheduleGraphWireRender();
    renderGraphNodes();

    if (dom.itemCount) {
      dom.itemCount.textContent =
        String(graph.nodes.length);
    }

    updateSourceBadge();
    synchronizeRuntimeBridgeSubscription();

    const projectEpoch =
      builderProjectEpoch;
    requestProjectAnimationFrame(() => {
      if (
        projectEpoch ===
          builderProjectEpoch
      ) {
        refreshDisplayValueNodes();
      }
    });

    scheduleGraphScrollLayerVisualRefresh();
  }

function createPortRow(
    node,
    spec,
    direction,
    visualSide,
    bindings,
    connectedKeys
  ) {
    const row =
      document.createElement("div");
    row.className =
      `rml-graph-port-row ${direction} side-${visualSide}`;

    const concreteType =
      spec.type ||
      bindings.get(node.id)?.[
        spec.typeVar
      ] || null;
    const info =
      typeInfo(concreteType);

    const copy =
      document.createElement("div");
    copy.className =
      "rml-graph-port-copy";

    const strong =
      document.createElement("strong");
    strong.textContent =
      spec.label;

    const small =
      document.createElement("small");
    small.textContent =
      spec.detail
        ? `${
            concreteType
              ? typeLabel(concreteType)
              : constraintLabel(
                  spec.constraint
                )
          } · ${spec.detail}`
        : concreteType
          ? typeLabel(concreteType)
          : `${spec.typeVar || "T"} · ${constraintLabel(
              spec.constraint
            )}`;

    copy.append(strong, small);

    const socket =
      document.createElement("button");
    socket.type = "button";
    socket.className =
      "rml-graph-socket";
    socket.dataset.rmlPortColor =
      info.color;
    socket.dataset.nodeId =
      node.id;
    socket.dataset.portId =
      spec.id;
    socket.dataset.direction =
      direction;
    socket.dataset.side =
      visualSide;
    socket.dataset.concreteType =
      concreteType || "";
    socket.dataset.constraint =
      spec.constraint || "";
    socket.setAttribute(
      "aria-label",
      `${direction} ${spec.label}: ${
        concreteType
          ? typeLabel(concreteType)
          : constraintLabel(
              spec.constraint
            )
      }`
    );
    socket.title =
      `${spec.label} · ${
        concreteType
          ? typeLabel(concreteType)
          : constraintLabel(
              spec.constraint
            )
      }`;

    const reaction =
      RUNTIME_BEHAVIORS[
        spec.reaction
      ];

    if (reaction) {
      socket.classList.add(
        `shape-${reaction.shape}`
      );
      socket.title +=
        ` · ${reaction.symbol} ${reaction.label}`;
    }

    if (
      connectedKeys.has(
        `${direction}:${node.id}:${spec.id}`
      )
    ) {
      socket.classList.add(
        "connected"
      );
    }

    socket.addEventListener(
      "pointerdown",
      beginConnectionDrag
    );
    socket.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();
      }
    );

    if (visualSide === "left") {
      row.append(socket, copy);
    } else {
      row.append(copy, socket);
    }

    return row;
  }

function nodeDefaultWidth(node, definition = nodeDefinition(node)) {
    return definition?.width || 280;
  }

function applyNodeSizeStyles(
    node,
    article,
    definition = nodeDefinition(node)
  ) {
    const manualWidth =
      Number.isFinite(node.width);
    const manualHeight =
      Number.isFinite(node.height);

    article.classList.toggle(
      "manually-sized-width",
      manualWidth
    );
    article.classList.toggle(
      "manually-sized-height",
      manualHeight
    );

    const automaticWidth =
      Number.isFinite(
        article._rmlAutomaticWidth
      )
        ? article._rmlAutomaticWidth
        : nodeDefaultWidth(
            node,
            definition
          );

    article.dataset.rmlNodeWidth =
      String(
        manualWidth
          ? node.width
          : automaticWidth
      );

    if (manualHeight) {
      article.dataset.rmlNodeHeight =
        String(node.height);
    } else {
      delete article.dataset
        .rmlNodeHeight;
    }
  }

function numericCssValue(value) {
    const number = Number.parseFloat(value);
    return Number.isFinite(number)
      ? number
      : 0;
  }

function horizontalBoxSize(element) {
    const style = getComputedStyle(element);
    return (
      numericCssValue(style.paddingLeft) +
      numericCssValue(style.paddingRight) +
      numericCssValue(style.borderLeftWidth) +
      numericCssValue(style.borderRightWidth)
    );
  }

let intrinsicTextMeasureCanvas = null;

function intrinsicTextWidth(element) {
    if (!element) {
      return 0;
    }

    const text =
      element.textContent || "";

    if (!text) {
      return 0;
    }

    intrinsicTextMeasureCanvas ||=
      document.createElement("canvas");

    const context =
      intrinsicTextMeasureCanvas.getContext(
        "2d"
      );
    const style =
      getComputedStyle(element);

    if (!context) {
      return Math.ceil(
        text.length *
          numericCssValue(style.fontSize) *
          0.62
      );
    }

    context.font =
      style.font ||
      `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;

    const letterSpacing =
      numericCssValue(
        style.letterSpacing
      );

    const lines =
      text.split(/\r?\n/);

    return Math.ceil(
      Math.max(
        0,
        ...lines.map(line =>
          context.measureText(line).width +
          Math.max(
            0,
            line.length - 1
          ) * letterSpacing
        )
      )
    );
  }

function intrinsicPortColumnWidth(column) {
    if (!column || column.hidden) {
      return 0;
    }

    let maximum = 0;

    for (
      const row of
      column.querySelectorAll(
        ":scope > .rml-graph-port-row"
      )
    ) {
      const copy = row.querySelector(
        ".rml-graph-port-copy"
      );
      const strong = copy?.querySelector(
        "strong"
      );
      const small = copy?.querySelector(
        "small"
      );
      const socket = row.querySelector(
        ".rml-graph-socket"
      );
      const style = getComputedStyle(row);
      const gap = numericCssValue(
        style.columnGap || style.gap
      );
      const textWidth = Math.max(
        intrinsicTextWidth(strong),
        intrinsicTextWidth(small)
      );
      const required =
        textWidth +
        (socket?.offsetWidth || 0) +
        gap +
        horizontalBoxSize(row);

      maximum = Math.max(
        maximum,
        required
      );
    }

    return Math.ceil(maximum);
  }

function measureNodeResizeLimits(
    article,
    node
  ) {
    const header = article.querySelector(
      ".rml-graph-node-header"
    );
    const body = article.querySelector(
      ".rml-graph-node-body"
    );
    const content = article.querySelector(
      ".rml-graph-node-body-content"
    );
    const title = header?.querySelector(
      ".rml-graph-node-title"
    );
    const symbol = header?.querySelector(
      ".rml-graph-node-symbol"
    );
    const flip = header?.querySelector(
      ".rml-graph-node-flip"
    );
    const remove = header?.querySelector(
      ".rml-graph-node-delete"
    );
    const headerStyle = header
      ? getComputedStyle(header)
      : null;
    const headerGap = headerStyle
      ? numericCssValue(
          headerStyle.columnGap ||
          headerStyle.gap
        )
      : 0;
    const titleWidth =
      intrinsicTextWidth(
        title?.querySelector("strong")
      );
    const headerItemCount = [
      symbol,
      title,
      flip,
      remove
    ].filter(Boolean).length;
    const headerWidth =
      (symbol?.offsetWidth || 0) +
      (flip?.offsetWidth || 0) +
      (remove?.offsetWidth || 0) +
      titleWidth +
      headerGap * Math.max(
        0,
        headerItemCount - 1
      ) +
      (header
        ? horizontalBoxSize(header)
        : 0);

    const inputColumn = content?.querySelector(
      ":scope > .rml-graph-port-column.inputs"
    );
    const outputColumn = content?.querySelector(
      ":scope > .rml-graph-port-column.outputs"
    );
    const inputWidth =
      intrinsicPortColumnWidth(inputColumn);
    const outputWidth =
      intrinsicPortColumnWidth(outputColumn);
    const contentStyle = content
      ? getComputedStyle(content)
      : null;
    const contentGap = contentStyle
      ? numericCssValue(
          contentStyle.columnGap ||
          contentStyle.gap
        )
      : 0;
    const hasInput = inputWidth > 0;
    const hasOutput = outputWidth > 0;
    let bodyWidth =
      inputWidth + outputWidth +
      (hasInput && hasOutput
        ? contentGap
        : 0) +
      (content
        ? horizontalBoxSize(content)
        : 0);

    const displayOutput = content?.querySelector(
      ".rml-graph-display-value output"
    );
    const display = displayOutput?.closest(
      ".rml-graph-display-value"
    );

    if (displayOutput && display) {
      bodyWidth = Math.max(
        bodyWidth,
        intrinsicTextWidth(displayOutput) +
          horizontalBoxSize(display) +
          18
      );
    }

    const defaultWidth =
      nodeDefaultWidth(node);
    const minimumWidth = Math.ceil(
      Math.min(
        GRAPH_NODE_MAX_WIDTH,
        Math.max(
          GRAPH_NODE_MIN_WIDTH,
          headerWidth + 2
        )
      )
    );
    const maximumWidth = Math.ceil(
      Math.min(
        GRAPH_NODE_MAX_WIDTH,
        Math.max(
          minimumWidth,
          defaultWidth,
          bodyWidth + 2
        )
      )
    );
    const bodyIntrinsicWidth =
      Math.ceil(
        Math.max(
          GRAPH_NODE_MIN_WIDTH - 2,
          bodyWidth
        )
      );

    if (
      content &&
      Number.isFinite(node.width)
    ) {
      content.dataset.rmlMinWidth =
        String(bodyIntrinsicWidth);
      window.RMLClassStyles?.sync(content);
    }

    const headerHeight =
      header?.offsetHeight || 45;
    const contentHeight = Math.ceil(
      Math.max(
        content?.scrollHeight || 0,
        content?.offsetHeight || 0
      )
    );
    const minimumHeight = Math.ceil(
      Math.max(
        GRAPH_NODE_MIN_HEIGHT,
        headerHeight +
          Math.min(
            GRAPH_NODE_MIN_BODY_HEIGHT,
            Math.max(1, contentHeight)
          ) +
          2
      )
    );
    const maximumHeight = Math.ceil(
      Math.min(
        GRAPH_NODE_MAX_HEIGHT,
        Math.max(
          minimumHeight,
          headerHeight +
            contentHeight +
            2
        )
      )
    );

    return {
      minimumWidth,
      maximumWidth,
      minimumHeight,
      maximumHeight,
      bodyIntrinsicWidth,
      body,
      content
    };
  }

function applyNodeBodyIntrinsicWidth(
    node,
    limits
  ) {
    if (!limits?.content) {
      return;
    }

    if (Number.isFinite(node.width)) {
      limits.content.dataset.rmlMinWidth =
        String(limits.bodyIntrinsicWidth);
    } else {
      delete limits.content.dataset
        .rmlMinWidth;
    }
  }

function updateNodeResizeLimitData(
    article,
    node,
    limits = measureNodeResizeLimits(
      article,
      node
    )
  ) {
    article._rmlResizeLimits = limits;
    article.dataset.resizeMinWidth =
      String(limits.minimumWidth);
    article.dataset.resizeMaxWidth =
      String(limits.maximumWidth);
    article.dataset.resizeMinHeight =
      String(limits.minimumHeight);
    article.dataset.resizeMaxHeight =
      String(limits.maximumHeight);
    applyNodeBodyIntrinsicWidth(
      node,
      limits
    );
    return limits;
  }

function refreshRenderedNodeResizeLimits() {
    if (!dom.nodesHost) {
      return;
    }

    let changed = false;

    for (
      const article of
      dom.nodesHost.querySelectorAll(
        ":scope > .rml-graph-node"
      )
    ) {
      const node = findGraphNode(
        article.dataset.graphNodeId
      );
      if (!node) {
        continue;
      }

      let limits = measureNodeResizeLimits(
        article,
        node
      );

      if (Number.isFinite(node.width)) {
        article._rmlAutomaticWidth =
          null;

        const width = nodeGraphClamp(
          node.width,
          limits.minimumWidth,
          limits.maximumWidth
        );
        if (width !== node.width) {
          node.width = width;
          changed = true;
        }
      } else {
        article._rmlAutomaticWidth =
          nodeGraphClamp(
            Math.max(
              nodeDefaultWidth(node),
              limits.minimumWidth,
              limits.bodyIntrinsicWidth + 2
            ),
            limits.minimumWidth,
            limits.maximumWidth
          );
      }

      if (Number.isFinite(node.height)) {
        const height = nodeGraphClamp(
          node.height,
          limits.minimumHeight,
          limits.maximumHeight
        );
        if (height !== node.height) {
          node.height = height;
          changed = true;
        }
      }

      applyNodeSizeStyles(
        node,
        article
      );
      updateNodeResizeLimitData(
        article,
        node,
        limits
      );
      scheduleNodeBodyOverflowSync(article);
      cacheGraphNodeGeometry(
        node,
        article
      );
    }

    if (changed) {
      persistGraphView(false, true);
    }
  }

function resetNodeSize(
    nodeId,
    axis = "both"
  ) {
    const node = findGraphNode(nodeId);

    if (!node) {
      return;
    }

    if (axis === "width" || axis === "both") {
      node.width = null;
    }
    if (axis === "height" || axis === "both") {
      node.height = null;
    }

    persistGraphView(false, true);
    renderGraphNodesAndWires();
    renderGraphInspector();
  }

function createNodeResizeHandle(
    node,
    axis
  ) {
    const handle = document.createElement(
      "button"
    );
    handle.type = "button";
    handle.className =
      `rml-graph-node-resize-handle ${axis}`;
    handle.setAttribute(
      "aria-label",
      axis === "width"
        ? "Resize node width"
        : axis === "height"
          ? "Resize node height"
          : "Resize node width and height"
    );
    handle.title =
      axis === "width"
        ? "Drag to resize width · double-click to reset width"
        : axis === "height"
          ? "Drag to resize height · double-click to reset height"
          : "Drag to resize both · double-click to reset size";
    handle.addEventListener(
      "pointerdown",
      event => {
        if (event.button !== 0) {
          return;
        }

        const now = performance.now();
        const previous = lastNodeResizePress;
        const isDoublePress = Boolean(
          previous &&
          previous.nodeId === node.id &&
          previous.axis === axis &&
          now - previous.time <=
            NODE_RESIZE_DOUBLE_CLICK_MS &&
          Math.hypot(
            event.clientX - previous.clientX,
            event.clientY - previous.clientY
          ) <= NODE_RESIZE_DOUBLE_CLICK_DISTANCE
        );

        if (isDoublePress) {
          lastNodeResizePress = null;
          event.preventDefault();
          event.stopImmediatePropagation();

          if (
            activeInteraction?.kind ===
              "node-resize"
          ) {
            finishNodeResize(false, true);
          }

          resetNodeSize(node.id, axis);
          return;
        }

        lastNodeResizePress = {
          nodeId: node.id,
          axis,
          time: now,
          clientX: event.clientX,
          clientY: event.clientY
        };

        beginNodeResize(
          event,
          node.id,
          axis
        );
      }
    );
    handle.addEventListener(
      "dblclick",
      event => {
        event.preventDefault();
        event.stopPropagation();
        resetNodeSize(
          node.id,
          axis
        );
      }
    );
    handle.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();
      }
    );
    return handle;
  }

function beginNodeResize(
    event,
    nodeId,
    axis
  ) {
    if (event.button !== 0) {
      return;
    }

    const node = findGraphNode(nodeId);
    const article = event.currentTarget.closest(
      ".rml-graph-node"
    );

    if (!node || !article) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    selectGraphNode(nodeId);

    const limits = updateNodeResizeLimitData(
      article,
      node
    );
    const rectangle = article.getBoundingClientRect();
    const startWidth =
      rectangle.width /
      graph.viewport.scale;
    const startHeight =
      rectangle.height /
      graph.viewport.scale;

    activeInteraction = {
      kind: "node-resize",
      pointerId: event.pointerId,
      nodeId,
      axis,
      startX: event.clientX,
      startY: event.clientY,
      startWidth,
      startHeight,
      originalWidth:
        Number.isFinite(node.width)
          ? node.width
          : null,
      originalHeight:
        Number.isFinite(node.height)
          ? node.height
          : null,
      connectionIds:
        incidentGraphConnectionIds(
          nodeId
        ),
      minimumWidth:
        limits.minimumWidth,
      maximumWidth:
        limits.maximumWidth,
      minimumHeight:
        limits.minimumHeight,
      maximumHeight:
        limits.maximumHeight,
      article,
      content:
        limits.content
    };

    if (axis === "width" || axis === "both") {
      node.width = nodeGraphClamp(
        startWidth,
        limits.minimumWidth,
        limits.maximumWidth
      );
    }
    if (axis === "height" || axis === "both") {
      node.height = nodeGraphClamp(
        startHeight,
        limits.minimumHeight,
        limits.maximumHeight
      );
    }

    article.classList.add("resizing");
    applyNodeSizeStyles(
      node,
      article
    );
    applyNodeBodyIntrinsicWidth(
      node,
      limits
    );

    try {
      event.currentTarget.setPointerCapture(
        event.pointerId
      );
    } catch {
    }
  }

function updateNodeResize(
    clientX,
    clientY
  ) {
    const interaction = activeInteraction;

    if (
      interaction?.kind !==
      "node-resize"
    ) {
      return;
    }

    const node = findGraphNode(
      interaction.nodeId
    );

    if (!node) {
      return;
    }

    const deltaX =
      (clientX - interaction.startX) /
      graph.viewport.scale;
    const deltaY =
      (clientY - interaction.startY) /
      graph.viewport.scale;

    if (
      interaction.axis === "width" ||
      interaction.axis === "both"
    ) {
      node.width = nodeGraphClamp(
        interaction.startWidth + deltaX,
        interaction.minimumWidth,
        interaction.maximumWidth
      );
    }

    if (
      interaction.axis === "height" ||
      interaction.axis === "both"
    ) {
      node.height = nodeGraphClamp(
        interaction.startHeight + deltaY,
        interaction.minimumHeight,
        interaction.maximumHeight
      );
    }

    invalidateGraphNodeViewportSpatialIndex(
      node.id
    );

    applyNodeSizeStyles(
      node,
      interaction.article
    );
    scheduleNodeBodyOverflowSync(
      interaction.article
    );

    if (
      interaction.content &&
      Number.isFinite(node.width)
    ) {
      interaction.content.dataset.rmlMinWidth =
        String(
          Math.max(
            0,
            interaction.maximumWidth - 2
          )
        );
    }

    rememberNodeBodyScroll(
      node.id,
      interaction.article.querySelector(
        ".rml-graph-node-body"
      )
    );
    scheduleGraphWireRender(
      interaction.connectionIds
    );
  }

function finishNodeResize(
    commit,
    restoreOriginal = false
  ) {
    const interaction = activeInteraction;

    if (
      interaction?.kind !==
      "node-resize"
    ) {
      return;
    }

    const node = findGraphNode(
      interaction.nodeId
    );

    if (node) {
      if (!commit && restoreOriginal) {
        node.width =
          interaction.originalWidth;
        node.height =
          interaction.originalHeight;
      } else if (commit) {
        if (Number.isFinite(node.width)) {
          node.width = nodeGraphClamp(
            Math.round(
              node.width / GRAPH_GRID
            ) * GRAPH_GRID,
            interaction.minimumWidth,
            interaction.maximumWidth
          );
        }
        if (Number.isFinite(node.height)) {
          node.height = nodeGraphClamp(
            Math.round(
              node.height / GRAPH_GRID
            ) * GRAPH_GRID,
            interaction.minimumHeight,
            interaction.maximumHeight
          );
        }
      }
      invalidateGraphNodeViewportSpatialIndex(
        node.id
      );
    }

    interaction.article?.classList.remove(
      "resizing"
    );
    activeInteraction = null;
    persistGraphView(
      false,
      commit === true
    );
    renderGraphNodesAndWires();
    renderGraphInspector();
  }

function createGraphNodeElementRmlOriginal(
    node,
    bindings,
    connectedKeys
  ) {
    const definition =
      nodeDefinition(node);
    const paletteIcon =
      nodePaletteIconDescriptor(
        definition
      );
    const hasSockets =
      definitionHasSockets(
        definition
      );
    const mirrored =
      hasSockets &&
      node.parameters?.portLayout ===
        "mirrored";
    const inputSide =
      mirrored ? "right" : "left";
    const outputSide =
      mirrored ? "left" : "right";
    const article =
      document.createElement("article");
    const customCSharpNode = Boolean(
      customCSharpEditor ||
      definition?.customCSharpNode === true ||
      definition?.customCSharpSyntaxNode === true ||
      definition?.customCSharpSubgraphOnly === true ||
      definition?.customCSharpCatalogNode === true
    );
    const expertNode =
      definition?.expertOnly === true;
    const apiCompositeNode =
      definition?.apiCompositeContainer ===
        true;
    article.className =
      `rml-graph-node ${
        node.kind
      }${mirrored ? " mirrored" : ""}${
        customCSharpNode
          ? " custom-csharp-node"
          : ""
      }${
        expertNode
          ? " expert"
          : ""
      }${
        apiCompositeNode
          ? " api-composite-node"
          : ""
      }${
        (
          Array.isArray(
            graph.selectedNodeIds
          ) &&
          graph.selectedNodeIds.includes(
            node.id
          )
        ) ||
        graph.selectedNodeId === node.id
          ? " selected"
          : ""
      }`;
    article.dataset.graphNodeId =
      node.id;
    article.dataset.rmlNodeX =
      String(node.x);
    article.dataset.rmlNodeY =
      String(node.y);

    applyNodeSizeStyles(
      node,
      article,
      definition
    );

    const header =
      document.createElement("header");
    header.className =
      "rml-graph-node-header";
    header.dataset.graphNodeHeader =
      "true";

    const symbol =
      document.createElement("div");
    symbol.className =
      "rml-graph-node-symbol";
    symbol.textContent =
      paletteIcon.symbol;
    symbol.dataset.iconTone =
      paletteIcon.tone;
    symbol.dataset.rmlNodeIconColor =
      paletteIcon.color;

    const title =
      document.createElement("div");
    title.className =
      "rml-graph-node-title";
    const strong =
      document.createElement("strong");
    strong.textContent =
      node.label ||
      definition?.title ||
      "Node";
    const small =
      document.createElement("small");
    small.textContent =
      definition?.group ||
      "Graph";
    title.append(strong, small);

    let flip = null;

    if (hasSockets) {
      flip =
        document.createElement("button");
      flip.className =
        "rml-graph-node-flip";
      flip.type = "button";
      flip.textContent = "⇄";
      flip.title = mirrored
        ? "Use inputs on the left and outputs on the right"
        : "Use outputs on the left and inputs on the right";
      flip.setAttribute(
        "aria-label",
        flip.title
      );
      flip.addEventListener(
        "pointerdown",
        event =>
          event.stopPropagation()
      );
      flip.addEventListener(
        "click",
        event => {
          event.preventDefault();
          event.stopPropagation();
          node.parameters.portLayout =
            mirrored
              ? "standard"
              : "mirrored";
          persistGraph(true);
          renderGraphNodesAndWires();
        }
      );
    }

    const remove =
      document.createElement("button");
    remove.className =
      "rml-graph-node-delete";
    remove.type = "button";
    remove.textContent = "×";
    remove.title =
      node.kind === "configuration"
        ? "Delete start node (it remains available in the palette)"
        : "Delete node";
    remove.addEventListener(
      "pointerdown",
      event =>
        event.stopPropagation()
    );
    remove.addEventListener(
      "click",
      event => {
        event.stopPropagation();
        deleteGraphNode(node.id);
      }
    );

    header.append(
      symbol,
      title
    );

    if (flip) {
      header.appendChild(flip);
    }

    header.appendChild(remove);

    const body =
      document.createElement("div");
    body.className =
      "rml-graph-node-body";
    body.dataset.nodeScrollId =
      node.id;
    body.dataset.rmlScrollLayer =
      "auto";
    body.dataset.rmlScrollLayerKey =
      `graph-node-body:${node.id}`;
    body.dataset.scrollLabel =
      `${definition?.title || "Graph node"} · Node contents`;
    body.addEventListener(
      "scroll",
      () => {
        rememberNodeBodyScroll(
          node.id,
          body
        );
        cacheGraphNodeGeometry(
          node,
          article
        );
        scheduleNodeBodyWireRefresh(
          node.id
        );
      },
      {
        passive: true
      }
    );

    const bodyContent =
      document.createElement("div");
    bodyContent.className =
      "rml-graph-node-body-content";

    if (!(definition?.inputs || []).length) {
      bodyContent.classList.add(
        "outputs-only"
      );
    }

    if (!(definition?.outputs || []).length) {
      bodyContent.classList.add(
        "inputs-only"
      );
    }

    const inputColumn =
      document.createElement("div");
    inputColumn.className =
      `rml-graph-port-column inputs side-${inputSide}`;

    const outputColumn =
      document.createElement("div");
    outputColumn.className =
      `rml-graph-port-column outputs side-${outputSide}`;

    for (
      const spec of
      definition?.inputs || []
    ) {
      inputColumn.appendChild(
        createPortRow(
          node,
          spec,
          "input",
          inputSide,
          bindings,
          connectedKeys
        )
      );
    }

    for (
      const spec of
      definition?.outputs || []
    ) {
      outputColumn.appendChild(
        createPortRow(
          node,
          spec,
          "output",
          outputSide,
          bindings,
          connectedKeys
        )
      );
    }

    if (mirrored) {
      bodyContent.append(
        outputColumn,
        inputColumn
      );
    } else {
      bodyContent.append(
        inputColumn,
        outputColumn
      );
    }

    if (
      definition?.displaysValue ||
      definition?.displaysImpulse
    ) {
      const presentation =
        runtimeMonitorPresentation(
          node
        );
      const display =
        document.createElement("div");
      display.className =
        `rml-graph-display-value${
          presentation.live
            ? " live-runtime"
            : ""
        }${
          presentation.known
            ? ""
            : " unknown"
        }${
          presentation.multiline
            ? " multiline"
            : ""
        }`;
      display.dataset
        .runtimeMonitorId =
        node.id;
      const displayLabel =
        document.createElement("span");
      displayLabel.textContent =
        presentation.label;
      const displayOutput =
        document.createElement("output");
      displayOutput.textContent =
        presentation.text;
      displayOutput.title =
        presentation.title ||
        presentation.text;
      display.title =
        presentation.title || "";
      display.append(
        displayLabel,
        displayOutput
      );
      bodyContent.appendChild(display);
    }

    if (node.kind === "configuration") {
      const note =
        document.createElement("div");
      note.className =
        "rml-graph-node-footer-note";
      note.textContent =
        "● stored · ▶ startup · ■ saved · ◆ startup + saved. Delete this node safely; restore it from the left palette.";
      bodyContent.appendChild(note);
    }

    body.appendChild(bodyContent);

    const widthHandle =
      createNodeResizeHandle(
        node,
        "width"
      );
    const heightHandle =
      createNodeResizeHandle(
        node,
        "height"
      );
    const bothHandle =
      createNodeResizeHandle(
        node,
        "both"
      );

    article.append(
      header,
      body,
      widthHandle,
      heightHandle,
      bothHandle
    );

    article.addEventListener(
      "pointerdown",
      event => {
        if (
          !event.target.closest(
            ".rml-graph-node-header"
          ) ||
          event.target.closest(
            ".rml-graph-socket, button, input, select, textarea"
          )
        ) {
          return;
        }

        beginNodeDrag(
          event,
          node.id
        );
      }
    );

    article.addEventListener(
      "click",
      event => {
        event.stopPropagation();
        selectGraphNode(
          node.id,
          event
        );
      }
    );

    return article;
  }

function createGraphNodeElement(...args) {

    const result = createGraphNodeElementRmlOriginal(...args);

    try {
      const node = args[0];
      if (node?.parameters?._rmlInternalDynamicMonitor === true && result instanceof HTMLElement) {
        result.hidden = true;
        result.dataset.rmlInternalDynamicMonitor = "true";
      }


      return window.RMLDynamicSettingsModes

        ?.augmentConfigurationDefinition

        ?.(result, args) ?? result;

    } catch (error) {

      console.error("Dynamic configuration-port augmentation failed.", error);

      return result;

    }

  }

function graphHybridActive() {
    return Boolean(
      graphHybridRenderer?.available
    );
  }

function fallbackGraphVirtualizationActive() {
    return Boolean(
      !graphHybridActive() &&
      (
        graph.nodes.length >
          GRAPH_DOM_VIRTUALIZATION_THRESHOLD ||
        graph.connections.length >
          GRAPH_SVG_COMPATIBILITY_LIMIT
      )
    );
  }

function graphGpuOverviewActive() {
    if (!graphHybridActive()) {
      graphGpuOverviewMode = false;
      return false;
    }
    const scale =
      graph?.viewport?.scale || 1;
    if (graphGpuOverviewMode) {
      if (
        scale >=
        GRAPH_GPU_OVERVIEW_EXIT_ZOOM
      ) {
        graphGpuOverviewMode = false;
      }
    } else if (
      scale <=
      GRAPH_GPU_OVERVIEW_ENTER_ZOOM
    ) {
      graphGpuOverviewMode = true;
    }
    return graphGpuOverviewMode;
  }

function estimatedGraphNodeGeometry(node) {
    const cached =
      graphNodeGeometryCache.get(
        node.id
      );
    const definition =
      nodeDefinition(node);
    const inputCount =
      definition?.inputs?.length || 0;
    const outputCount =
      definition?.outputs?.length || 0;
    const rowCount = Math.max(
      inputCount,
      outputCount,
      1
    );
    const portBodyHeight =
      17 +
      rowCount * 31 +
      Math.max(0, rowCount - 1) * 4;
    const monitorHeight =
      definition?.displaysValue ||
      definition?.displaysImpulse
        ? 58
        : 0;
    const footerHeight =
      node.kind === "configuration"
        ? 40
        : 0;
    const width =
      cached?.width ||
      (
        Number.isFinite(node.width)
          ? node.width
          : nodeDefaultWidth(
              node,
              definition
            )
      );
    const height =
      cached?.height ||
      (
        Number.isFinite(node.height)
          ? node.height
          : Math.max(
              GRAPH_NODE_MIN_HEIGHT,
              45 +
                portBodyHeight +
                monitorHeight +
                footerHeight
            )
      );

    return {
      x: node.x,
      y: node.y,
      width,
      height,
      right: node.x + width,
      bottom: node.y + height,
      sockets:
        cached?.sockets ||
        emptyGraphSocketGeometry
    };
  }

function invalidateGraphNodeViewportSpatialIndex(
    nodeId = null
  ) {
    invalidateGraphGpuNodeRecord(nodeId);
    if (
      nodeId &&
      !graphNodeViewportSpatialDirty &&
      graphNodeViewportSpatialSource ===
        graph?.nodes &&
      graphNodeViewportSpatialLength ===
        graph.nodes.length
    ) {
      graphNodeViewportSpatialDirtyNodeIds.add(
        nodeId
      );
      return;
    }
    graphNodeViewportSpatialDirty = true;
    graphNodeViewportSpatialDirtyNodeIds.clear();
  }

function graphNodeSpatialRecord(
    node,
    order
  ) {
    const geometry =
      estimatedGraphNodeGeometry(node);
    return {
      node,
      order,
      left: geometry.x,
      top: geometry.y,
      right: geometry.right,
      bottom: geometry.bottom
    };
  }

function insertGraphNodeSpatialRecord(
    index,
    record
  ) {
    const range =
      graphNodeSpatialCellRange(record);
    for (
      let y = range.minimumY;
      y <= range.maximumY;
      y += 1
    ) {
      for (
        let x = range.minimumX;
        x <= range.maximumX;
        x += 1
      ) {
        const key =
          graphNodeSpatialCellKey(x, y);
        const values = index.get(key);
        if (values) {
          values.push(record);
        } else {
          index.set(key, [record]);
        }
      }
    }
  }

function removeGraphNodeSpatialRecord(
    index,
    record
  ) {
    const range =
      graphNodeSpatialCellRange(record);
    for (
      let y = range.minimumY;
      y <= range.maximumY;
      y += 1
    ) {
      for (
        let x = range.minimumX;
        x <= range.maximumX;
        x += 1
      ) {
        const key =
          graphNodeSpatialCellKey(x, y);
        const values = index.get(key);
        if (!values) {
          continue;
        }
        const position = values.indexOf(record);
        if (position >= 0) {
          values.splice(position, 1);
        }
        if (values.length === 0) {
          index.delete(key);
        }
      }
    }
  }

function updateDirtyGraphNodeSpatialRecords() {
    if (
      graphNodeViewportSpatialDirtyNodeIds
        .size === 0
    ) {
      return;
    }
    for (const nodeId of
      graphNodeViewportSpatialDirtyNodeIds) {
      const previous =
        graphNodeViewportSpatialRecordById
          .get(nodeId);
      if (previous) {
        removeGraphNodeSpatialRecord(
          graphNodeViewportSpatialIndex,
          previous
        );
        graphNodeViewportSpatialRecordById
          .delete(nodeId);
      }
      const node = findGraphNode(nodeId);
      if (
        !node ||
        node?.parameters
          ?._rmlInternalDynamicMonitor ===
            true
      ) {
        continue;
      }
      const record = graphNodeSpatialRecord(
        node,
        previous?.order ?? 0
      );
      graphNodeViewportSpatialRecordById.set(
        nodeId,
        record
      );
      insertGraphNodeSpatialRecord(
        graphNodeViewportSpatialIndex,
        record
      );
    }
    graphNodeViewportSpatialDirtyNodeIds.clear();
  }

function graphNodeSpatialCellRange(bounds) {
    const size =
      GRAPH_NODE_SPATIAL_CELL_SIZE;
    return {
      minimumX:
        Math.floor(bounds.left / size),
      maximumX:
        Math.floor(bounds.right / size),
      minimumY:
        Math.floor(bounds.top / size),
      maximumY:
        Math.floor(bounds.bottom / size)
    };
  }

function graphNodeSpatialCellKey(x, y) {
    return y *
      GRAPH_NODE_SPATIAL_KEY_STRIDE +
      x;
  }

function ensureGraphNodeViewportSpatialIndex() {
    const nodes = graph?.nodes || [];
    const rebuild =
      graphNodeViewportSpatialDirty ||
      graphNodeViewportSpatialSource !== nodes ||
      graphNodeViewportSpatialLength !==
        nodes.length;
    if (!rebuild) {
      updateDirtyGraphNodeSpatialRecords();
      return;
    }

    const index = new Map();
    const byId = new Map();

    for (
      let order = 0;
      order < nodes.length;
      order += 1
    ) {
      const node = nodes[order];
      if (
        node?.parameters
          ?._rmlInternalDynamicMonitor ===
            true
      ) {
        continue;
      }
      const record = graphNodeSpatialRecord(
        node,
        order
      );
      byId.set(node.id, record);
      insertGraphNodeSpatialRecord(
        index,
        record
      );
    }

    graphNodeViewportSpatialIndex = index;
    graphNodeViewportSpatialRecordById =
      byId;
    graphNodeViewportSpatialSource = nodes;
    graphNodeViewportSpatialLength =
      nodes.length;
    graphNodeViewportSpatialDirty = false;
    graphNodeViewportSpatialDirtyNodeIds.clear();
  }

function graphNodeSpatialRecordsInBounds(
    bounds
  ) {
    ensureGraphNodeViewportSpatialIndex();
    if (
      !Number.isFinite(bounds.left) ||
      !Number.isFinite(bounds.top) ||
      !Number.isFinite(bounds.right) ||
      !Number.isFinite(bounds.bottom)
    ) {
      return [
        ...graphNodeViewportSpatialRecordById
          .values()
      ];
    }

    const range =
      graphNodeSpatialCellRange(bounds);
    const columns =
      range.maximumX - range.minimumX + 1;
    const rows =
      range.maximumY - range.minimumY + 1;
    if (
      columns <= 0 ||
      rows <= 0
    ) {
      return [];
    }

    if (
      columns * rows >
        GRAPH_NODE_SPATIAL_MAX_QUERY_CELLS
    ) {
      return [
        ...graphNodeViewportSpatialRecordById
          .values()
      ].filter(record => !(
        record.right < bounds.left ||
        record.left > bounds.right ||
        record.bottom < bounds.top ||
        record.top > bounds.bottom
      ));
    }

    const candidates = new Set();
    for (
      let y = range.minimumY;
      y <= range.maximumY;
      y += 1
    ) {
      for (
        let x = range.minimumX;
        x <= range.maximumX;
        x += 1
      ) {
        for (const record of
          graphNodeViewportSpatialIndex.get(
            graphNodeSpatialCellKey(x, y)
          ) || []) {
          candidates.add(record);
        }
      }
    }

    return [...candidates]
      .filter(record => !(
        record.right < bounds.left ||
        record.left > bounds.right ||
        record.bottom < bounds.top ||
        record.top > bounds.bottom
      ))
      .sort((a, b) => a.order - b.order);
  }

function requiredGraphNodeIds() {
    const ids = new Set(
      Array.isArray(
        graph.selectedNodeIds
      )
        ? graph.selectedNodeIds
        : []
    );
    if (graph.selectedNodeId) {
      ids.add(graph.selectedNodeId);
    }
    if (activeInteraction?.nodeId) {
      ids.add(activeInteraction.nodeId);
    }
    if (
      activeInteraction?.kind ===
        "connection" &&
      activeInteraction.start?.nodeId
    ) {
      ids.add(
        activeInteraction.start.nodeId
      );
    }
    for (const nodeId of graphForcedNodeIds) {
      ids.add(nodeId);
    }
    return ids;
  }

function visibleGraphBounds(
    overscanPixels =
      GRAPH_NODE_VIRTUAL_OVERSCAN_PIXELS
  ) {
    const rectangle =
      dom.viewport
        ?.getBoundingClientRect();
    const scale = Math.max(
      GRAPH_MIN_ZOOM,
      graph?.viewport?.scale || 1
    );

    if (!rectangle) {
      return {
        left: -Infinity,
        top: -Infinity,
        right: Infinity,
        bottom: Infinity
      };
    }

    const overscan =
      Math.max(0, overscanPixels) /
      scale;
    return {
      left:
        -graph.viewport.x / scale -
        overscan,
      top:
        -graph.viewport.y / scale -
        overscan,
      right:
        (
          rectangle.width -
          graph.viewport.x
        ) / scale + overscan,
      bottom:
        (
          rectangle.height -
          graph.viewport.y
        ) / scale + overscan
    };
  }

function recordGraphNodeVirtualizationAnchor() {
    if (!dom.viewport || !graph?.viewport) {
      graphNodeVirtualizationAnchor = null;
      return;
    }
    graphNodeVirtualizationAnchor = {
      x: graph.viewport.x,
      y: graph.viewport.y,
      scale: graph.viewport.scale,
      width: dom.viewport.clientWidth,
      height: dom.viewport.clientHeight
    };
  }

function graphNodeVirtualizationRefreshRequired() {
    const anchor =
      graphNodeVirtualizationAnchor;
    if (
      !anchor ||
      !dom.viewport ||
      !graph?.viewport
    ) {
      return true;
    }

    if (
      anchor.width !==
        dom.viewport.clientWidth ||
      anchor.height !==
        dom.viewport.clientHeight ||
      Math.abs(
        anchor.scale -
          graph.viewport.scale
      ) > 0.000001
    ) {
      return true;
    }

    return Math.hypot(
      graph.viewport.x - anchor.x,
      graph.viewport.y - anchor.y
    ) >=
      GRAPH_NODE_VIRTUALIZATION_PAN_STEP_PIXELS;
  }

function graphViewportHasVisibleNode() {
    const rectangle =
      dom.viewport
        ?.getBoundingClientRect();
    if (
      !rectangle ||
      rectangle.width <= 0 ||
      rectangle.height <= 0
    ) {
      return true;
    }

    const bounds =
      visibleGraphBounds(0);

    if (
      graphGpuOverviewActive() &&
      (
        graphNodeViewportSpatialDirty ||
        graphNodeViewportSpatialSource !==
          graph.nodes ||
        graphNodeViewportSpatialLength !==
          graph.nodes.length
      )
    ) {
      for (const node of graph.nodes) {
        if (
          node?.parameters
            ?._rmlInternalDynamicMonitor ===
              true
        ) {
          continue;
        }
        const geometry =
          estimatedGraphNodeGeometry(node);
        if (!(
          geometry.right < bounds.left ||
          geometry.x > bounds.right ||
          geometry.bottom < bounds.top ||
          geometry.y > bounds.bottom
        )) {
          return true;
        }
      }
      return false;
    }

    return graphNodeSpatialRecordsInBounds(
      bounds
    ).length > 0;
  }

function graphDetailedDomNodeLimit() {
    const width = Math.max(
      1,
      dom.viewport?.clientWidth || 1
    );
    const height = Math.max(
      1,
      dom.viewport?.clientHeight || 1
    );
    return Math.round(
      nodeGraphClamp(
        Math.floor(
          width * height /
            GRAPH_DOM_DETAIL_PIXELS_PER_NODE
        ),
        GRAPH_DOM_DETAIL_NODE_MINIMUM,
        GRAPH_DOM_DETAIL_NODE_MAXIMUM
      )
    );
  }

function nearestGraphNodeRecords(
    records,
    limit,
    centerX,
    centerY
  ) {
    if (
      limit <= 0 ||
      records.length === 0
    ) {
      return [];
    }
    for (const record of records) {
      const x = (record.left + record.right) / 2;
      const y = (record.top + record.bottom) / 2;
      record.viewportDistance =
        (x - centerX) ** 2 +
        (y - centerY) ** 2;
    }
    if (records.length <= limit) {
      return records;
    }

    let left = 0;
    let right = records.length - 1;
    const target = limit - 1;
    while (left < right) {
      const pivot =
        records[
          left + ((right - left) >> 1)
        ].viewportDistance;
      let low = left;
      let high = right;
      while (low <= high) {
        while (
          records[low].viewportDistance < pivot
        ) {
          low += 1;
        }
        while (
          records[high].viewportDistance > pivot
        ) {
          high -= 1;
        }
        if (low <= high) {
          const swap = records[low];
          records[low] = records[high];
          records[high] = swap;
          low += 1;
          high -= 1;
        }
      }
      if (target <= high) {
        right = high;
      } else if (target >= low) {
        left = low;
      } else {
        break;
      }
    }
    return records.slice(0, limit);
  }

function desiredRenderedGraphNodes() {
    const fallbackVirtualized =
      fallbackGraphVirtualizationActive();
    const hybrid = graphHybridActive();

    if (
      !hybrid &&
      !fallbackVirtualized
    ) {
      graphGpuDetailOverflowMode = false;
      return graph.nodes.filter(node =>
        node?.parameters
          ?._rmlInternalDynamicMonitor !==
          true
      );
    }

    const overview =
      graphGpuOverviewActive();
    const bounds =
      visibleGraphBounds();
    const requiredIds =
      requiredGraphNodeIds();
    const candidateRecords = overview
      ? []
      : graphNodeSpatialRecordsInBounds(
          bounds
        );
    const selectedRecords = new Set(
      candidateRecords
    );
    for (const nodeId of requiredIds) {
      let record =
        !overview ||
        (
          graphNodeViewportSpatialSource ===
            graph.nodes &&
          graphNodeViewportSpatialLength ===
            graph.nodes.length
        )
          ? graphNodeViewportSpatialRecordById
              .get(nodeId)
          : null;
      if (!record && overview) {
        const node = findGraphNode(nodeId);
        if (node) {
          record = graphNodeSpatialRecord(
            node,
            0
          );
        }
      }
      if (record) {
        selectedRecords.add(record);
      }
    }
    const candidates = [...selectedRecords];
    const detailLimit = fallbackVirtualized
      ? Math.min(
          GRAPH_FALLBACK_MAX_DETAILED_NODES,
          graphDetailedDomNodeLimit()
        )
      : graphDetailedDomNodeLimit();
    graphGpuDetailOverflowMode = Boolean(
      hybrid &&
      !overview &&
      candidates.length > detailLimit
    );

    if (candidates.length <= detailLimit) {
      return candidates
        .sort((a, b) => a.order - b.order)
        .map(record => record.node);
    }

    const required = candidates.filter(
      record => requiredIds.has(record.node.id)
    );
    const requiredRecordIds = new Set(
      required.map(record => record.node.id)
    );
    const remaining = Math.max(
      0,
      detailLimit -
        required.length
    );
    const centerX =
      (bounds.left + bounds.right) / 2;
    const centerY =
      (bounds.top + bounds.bottom) / 2;
    const optional = candidates.filter(record =>
        !requiredRecordIds.has(
          record.node.id
        )
      );
    const nearest = nearestGraphNodeRecords(
      optional,
      remaining,
      centerX,
      centerY
    );

    return [
      ...required,
      ...nearest
    ]
      .sort((a, b) => a.order - b.order)
      .map(record => record.node);
  }

function cacheGraphNodeGeometry(
    node,
    article
  ) {
    if (
      !node ||
      !article ||
      !dom.viewport ||
      !article.isConnected
    ) {
      return null;
    }

    const rectangle =
      article.getBoundingClientRect();
    const scale = Math.max(
      GRAPH_MIN_ZOOM,
      graph.viewport.scale
    );
    const sockets = new Map();

    for (
      const socket of
      article.querySelectorAll(
        ".rml-graph-socket"
      )
    ) {
      const socketRectangle =
        socket.getBoundingClientRect();
      const center = clientToGraph(
        socketRectangle.left +
          socketRectangle.width / 2,
        socketRectangle.top +
          socketRectangle.height / 2
      );
      sockets.set(
        `${socket.dataset.direction}:${socket.dataset.portId}`,
        {
          x: center.x - node.x,
          y: center.y - node.y,
          side:
            socket.dataset.side ||
            (
              socket.dataset.direction ===
                "input"
                ? "left"
                : "right"
            )
        }
      );
    }

    const value = {
      width:
        rectangle.width / scale,
      height:
        rectangle.height / scale,
      sockets
    };
    const previous =
      graphNodeGeometryCache.get(
        node.id
      );
    graphNodeGeometryCache.set(
      node.id,
      value
    );
    if (
      !previous ||
      Math.abs(
        previous.width - value.width
      ) > 0.01 ||
      Math.abs(
        previous.height - value.height
      ) > 0.01
    ) {
      invalidateGraphNodeViewportSpatialIndex(
        node.id
      );
    }
    return value;
  }

function renderedGraphNodeSignature(
    nodes
  ) {
    return `${
      graphGpuOverviewActive()
        ? "overview"
        : graphGpuDetailOverflowMode
          ? "density"
        : "detail"
    }:${nodes.map(node => node.id).join("\u0001")}`;
  }

function populateGraphNodeHost(
    nodes,
    preserveExisting = false
  ) {
    const projectEpoch =
      builderProjectEpoch;
    if (!dom.nodesHost) {
      return;
    }

    currentAnalysis =
      currentAnalysis ||
      analyzeConnections(
        graph.connections
      );
    const bindings =
      currentAnalysis.bindings;
    const connectedKeys =
      connectedPortKeys();
    const existing = new Map();
    const geometryChangedNodeIds = new Set();
    const appendTarget =
      preserveExisting
        ? dom.nodesHost
        : document.createDocumentFragment();

    if (preserveExisting) {
      for (
        const element of
        dom.nodesHost.querySelectorAll(
          ":scope > .rml-graph-node"
        )
      ) {
        existing.set(
          element.dataset.graphNodeId,
          element
        );
      }
    } else {
      captureRenderedNodeBodyScrolls();
      dom.nodesHost.replaceChildren();
    }

    const desiredIds = new Set(
      nodes.map(node => node.id)
    );
    for (const [nodeId, element] of existing) {
      if (!desiredIds.has(nodeId)) {
        const node = findGraphNode(nodeId);
        if (node) {
          cacheGraphNodeGeometry(
            node,
            element
          );
        }
        const body = element.querySelector(
          ".rml-graph-node-body"
        );
        rememberNodeBodyScroll(
          nodeId,
          body
        );
        element.remove();
        existing.delete(nodeId);
        geometryChangedNodeIds.add(nodeId);
      }
    }

    for (const node of nodes) {
      let element = existing.get(
        node.id
      );
      if (!element) {
        element = createGraphNodeElement(
          node,
          bindings,
          connectedKeys
        );
        appendTarget.appendChild(
          element
        );
        restoreNodeBodyScroll(
          node.id,
          element.querySelector(
            ".rml-graph-node-body"
          )
        );
        scheduleNodeBodyOverflowSync(
          element
        );
        geometryChangedNodeIds.add(
          node.id
        );
      }
    }

    if (!preserveExisting) {
      dom.nodesHost.appendChild(
        appendTarget
      );
    }

    graphSocketElementCache.clear();
    for (
      const socket of
      dom.nodesHost.querySelectorAll(
        ".rml-graph-socket"
      )
    ) {
      graphSocketElementCache.set(
        `${socket.dataset.direction}:${socket.dataset.nodeId}:${socket.dataset.portId}`,
        socket
      );
    }

    graphNodeVirtualizationSignature =
      renderedGraphNodeSignature(nodes);
    recordGraphNodeVirtualizationAnchor();


    

    if (!graphWireFullRenderPending) {
      synchronizeGpuOverviewNodes();
    }

    requestProjectAnimationFrame(() => {
      if (
        projectEpoch !==
          builderProjectEpoch
      ) {
        return;
      }
      for (const node of nodes) {
        const article =
          dom.nodesHost?.querySelector(
            `.rml-graph-node[data-graph-node-id="${CSS.escape(node.id)}"]`
          );
        if (!article) {
          continue;
        }
        restoreNodeBodyScroll(
          node.id,
          article.querySelector(
            ".rml-graph-node-body"
          )
        );
        cacheGraphNodeGeometry(
          node,
          article
        );
        scheduleNodeBodyOverflowSync(
          article
        );
      }

      refreshRenderedNodeResizeLimits();
      if (
        preserveExisting &&
        geometryChangedNodeIds.size > 0
      ) {
        const connectionIds = new Set();
        for (const nodeId of geometryChangedNodeIds) {
          for (const connectionId of incidentGraphConnectionIds(nodeId)) {
            connectionIds.add(connectionId);
          }
        }
        scheduleGraphWireRender(connectionIds);
      }
    });
  }

function scheduleGraphNodeVirtualization() {
    if (
      graphNodeVirtualizationFrame ||
      !graph?.active ||
      !runtimeGraphViewActive ||
      !dom.nodesHost
    ) {
      return;
    }

    const projectEpoch =
      builderProjectEpoch;
    graphNodeVirtualizationFrame =
      requestProjectAnimationFrame(() => {
        graphNodeVirtualizationFrame = 0;
        if (
          projectEpoch !==
            builderProjectEpoch
        ) {
          return;
        }
        const nodes =
          desiredRenderedGraphNodes();
        const signature =
          renderedGraphNodeSignature(
            nodes
          );
        recordGraphNodeVirtualizationAnchor();
        if (
          signature ===
            graphNodeVirtualizationSignature
        ) {
          return;
        }
        populateGraphNodeHost(
          nodes,
          true
        );
      });
  }

function forceGraphNodesRendered(
    ...nodeIds
  ) {
    for (const nodeId of nodeIds) {
      if (nodeId) {
        graphForcedNodeIds.add(nodeId);
      }
    }
    graphNodeVirtualizationSignature = "";
    renderGraphNodes();
  }

function renderGraphNodes() {
    if (!dom.nodesHost) {
      return;
    }

    currentAnalysis =
      currentAnalysis ||
      analyzeConnections(
        graph.connections
      );
    populateGraphNodeHost(
      desiredRenderedGraphNodes(),
      false
    );
  }

function socketElement(
    nodeId,
    portId,
    direction
  ) {
    const key =
      `${direction}:${nodeId}:${portId}`;
    const cached =
      graphSocketElementCache.get(key);
    if (
      cached?.isConnected &&
      dom.nodesHost?.contains(cached)
    ) {
      return cached;
    }
    const socket = dom.nodesHost?.querySelector(
      `.rml-graph-socket[data-node-id="${CSS.escape(nodeId)}"]` +
      `[data-port-id="${CSS.escape(portId)}"]` +
      `[data-direction="${direction}"]`
    ) || null;
    if (socket) {
      graphSocketElementCache.set(
        key,
        socket
      );
    } else {
      graphSocketElementCache.delete(key);
    }
    return socket;
  }

function estimatedSocketGraphCenter(
    nodeId,
    portId,
    direction
  ) {
    const node = findGraphNode(nodeId);
    if (!node) {
      return null;
    }
    const geometry =
      estimatedGraphNodeGeometry(node);
    const cached =
      geometry.sockets.get(
        `${direction}:${portId}`
      );
    if (cached) {
      return {
        x: node.x + cached.x,
        y: node.y + cached.y,
        side: cached.side
      };
    }

    const definition =
      nodeDefinition(node);
    const specifications =
      direction === "input"
        ? definition?.inputs || []
        : definition?.outputs || [];
    const index = Math.max(
      0,
      specifications.findIndex(
        specification =>
          specification.id === portId
      )
    );
    const mirrored =
      definitionHasSockets(
        definition
      ) &&
      node.parameters?.portLayout ===
        "mirrored";
    const side = direction === "input"
      ? mirrored ? "right" : "left"
      : mirrored ? "left" : "right";
    const scroll =
      nodeBodyScrollPositions.get(
        node.id
      ) || { top: 0 };
    const unclippedY =
      45 + 8 + index * 35 + 15.5 -
      finiteNumber(scroll.top, 0);
    const minimumY = 45 + 7;
    const maximumY = Math.max(
      minimumY,
      geometry.height - 7
    );

    return {
      x:
        node.x +
        (
          side === "left"
            ? 7
            : geometry.width - 7
        ),
      y:
        node.y +
        nodeGraphClamp(
          unclippedY,
          minimumY,
          maximumY
        ),
      side
    };
  }

function socketGraphCenter(
    nodeId,
    portId,
    direction
  ) {
    const node = findGraphNode(nodeId);
    const cachedSocket =
      graphNodeGeometryCache
        .get(nodeId)
        ?.sockets
        ?.get(
          `${direction}:${portId}`
        );
    const liveGeometryRequired = Boolean(
      activeInteraction?.nodeId ===
        nodeId &&
      activeInteraction.kind ===
        "node-resize"
    );
    if (
      node &&
      cachedSocket &&
      !liveGeometryRequired
    ) {
      return {
        x: node.x + cachedSocket.x,
        y: node.y + cachedSocket.y,
        side: cachedSocket.side
      };
    }

    const socket =
      socketElement(
        nodeId,
        portId,
        direction
      );

    if (!socket || !dom.viewport) {
      return estimatedSocketGraphCenter(
        nodeId,
        portId,
        direction
      );
    }

    const rectangle =
      socket.getBoundingClientRect();
    const article = socket.closest(
      ".rml-graph-node"
    );
    const body = socket.closest(
      ".rml-graph-node-body"
    );
    const articleRectangle =
      article?.getBoundingClientRect();
    const bodyRectangle =
      body?.getBoundingClientRect();
    const side =
      socket.dataset.side ||
      (direction === "input"
        ? "left"
        : "right");

    let clientX =
      rectangle.left +
      rectangle.width / 2;
    let clientY =
      rectangle.top +
      rectangle.height / 2;

    if (articleRectangle && bodyRectangle) {
      const clipLeft = Math.max(
        articleRectangle.left,
        bodyRectangle.left
      );
      const clipRight = Math.min(
        articleRectangle.right,
        bodyRectangle.right
      );
      const clipTop = Math.max(
        articleRectangle.top,
        bodyRectangle.top
      );
      const clipBottom = Math.min(
        articleRectangle.bottom,
        bodyRectangle.bottom
      );

      if (clipRight >= clipLeft) {
        if (
          clientX < clipLeft ||
          clientX > clipRight
        ) {
          clientX = side === "left"
            ? articleRectangle.left + 1
            : articleRectangle.right - 1;
        } else {
          clientX = nodeGraphClamp(
            clientX,
            clipLeft,
            clipRight
          );
        }
      }

      if (clipBottom >= clipTop) {
        const halfSocket = Math.max(
          1,
          Math.min(
            rectangle.width,
            rectangle.height
          ) / 2
        );
        const availableHeight =
          Math.max(0, clipBottom - clipTop);
        const inset = Math.min(
          halfSocket,
          availableHeight / 2
        );
        const minimumY =
          clipTop + inset;
        const maximumY =
          clipBottom - inset;

        clientY = minimumY <= maximumY
          ? nodeGraphClamp(
              clientY,
              minimumY,
              maximumY
            )
          : (clipTop + clipBottom) / 2;
      }
    }

    return {
      ...clientToGraph(
        clientX,
        clientY
      ),
      side
    };
  }

function wirePath(
    from,
    to
  ) {
    const horizontal =
      Math.abs(to.x - from.x);
    const vertical =
      Math.abs(to.y - from.y);
    const control = nodeGraphClamp(
      Math.max(
        horizontal * 0.48,
        vertical * 0.24
      ),
      36,
      260
    );
    const fromDirection =
      from.side === "left"
        ? -1
        : 1;
    const toDirection =
      to.side === "right"
        ? 1
        : -1;

    return (
      `M ${from.x} ${from.y} ` +
      `C ${from.x + control * fromDirection} ${from.y}, ` +
      `${to.x + control * toDirection} ${to.y}, ` +
      `${to.x} ${to.y}`
    );
  }

function svgPath(
    className,
    d
  ) {
    const path =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "path"
      );
    path.setAttribute(
      "class",
      className
    );
    path.setAttribute("d", d);
    return path;
  }

function branchPointUsageMap() {
    const usage = new Map();

    for (const connection of graph.connections) {
      const branch =
        connection.branchFrom;

      if (!branch) {
        continue;
      }

      const key =
        `${branch.connectionId}\u0000${branch.pointId}`;
      usage.set(
        key,
        (usage.get(key) || 0) + 1
      );
    }

    return usage;
  }

function branchPointUsageCount(
    connectionId,
    pointId,
    usage = null
  ) {
    const map = usage ||
      branchPointUsageMap();

    return map.get(
      `${connectionId}\u0000${pointId}`
    ) || 0;
  }

function connectionVisualStart(
    connection
  ) {
    const branch =
      connection.branchFrom;

    if (branch) {
      const parent =
        graphConnectionById(
          branch.connectionId
        );
      const point =
        wirePointById(
          parent,
          branch.pointId
        );

      if (point) {
        return {
          x: point.x,
          y: point.y,
          side: null,
          branch: true
        };
      }
    }

    return socketGraphCenter(
      connection.fromNode,
      connection.fromPort,
      "output"
    );
  }

function connectionGeometry(
    connection,
    includeSvgPath = true
  ) {
    const start =
      connectionVisualStart(
        connection
      );
    const end =
      socketGraphCenter(
        connection.toNode,
        connection.toPort,
        "input"
      );

    if (!start || !end) {
      return null;
    }

    const routePoints =
      Array.isArray(connection.points)
        ? connection.points
        : [];
    const cached =
      graphConnectionGeometryCache.get(
        connection.id
      );
    let pointsUnchanged = Boolean(
      cached &&
      cached.pointCoordinates.length ===
        routePoints.length * 2
    );
    if (pointsUnchanged) {
      for (
        let index = 0;
        index < routePoints.length;
        index += 1
      ) {
        if (
          cached.pointCoordinates[index * 2] !==
            routePoints[index].x ||
          cached.pointCoordinates[
            index * 2 + 1
          ] !== routePoints[index].y
        ) {
          pointsUnchanged = false;
          break;
        }
      }
    }
    if (
      pointsUnchanged &&
      cached.startX === start.x &&
      cached.startY === start.y &&
      cached.startSide === start.side &&
      cached.endX === end.x &&
      cached.endY === end.y &&
      cached.endSide === end.side
    ) {
      if (
        includeSvgPath &&
        !cached.hasSvgPaths
      ) {
        for (const segment of
          cached.geometry.segments) {
          segment.d = wirePath(
            segment.from,
            segment.to
          );
        }
        cached.hasSvgPaths = true;
      }
      return cached.geometry;
    }
    const anchors = [
      {
        x: start.x,
        y: start.y,
        side: start.side || null,
        endpoint: "start"
      },
      ...routePoints.map(point => ({
        x: point.x,
        y: point.y,
        side: null,
        endpoint: "point",
        point
      })),
      {
        x: end.x,
        y: end.y,
        side: end.side || null,
        endpoint: "end"
      }
    ];
    const segments = [];

    for (
      let index = 0;
      index < anchors.length - 1;
      index += 1
    ) {
      const rawFrom = anchors[index];
      const rawTo = anchors[index + 1];
      const from = {
        ...rawFrom,
        side:
          rawFrom.side ||
          (rawTo.x >= rawFrom.x
            ? "right"
            : "left")
      };
      const to = {
        ...rawTo,
        side:
          rawTo.side ||
          (rawFrom.x <= rawTo.x
            ? "left"
            : "right")
      };

      const segment = {
        index,
        from,
        to
      };
      if (includeSvgPath) {
        segment.d = wirePath(from, to);
      }
      segments.push(segment);
    }

    const geometry = {
      start,
      end,
      anchors,
      segments
    };
    const pointCoordinates =
      new Float64Array(
        routePoints.length * 2
      );
    for (
      let index = 0;
      index < routePoints.length;
      index += 1
    ) {
      pointCoordinates[index * 2] =
        routePoints[index].x;
      pointCoordinates[index * 2 + 1] =
        routePoints[index].y;
    }
    graphConnectionGeometryCache.set(
      connection.id,
      {
        startX: start.x,
        startY: start.y,
        startSide: start.side,
        endX: end.x,
        endY: end.y,
        endSide: end.side,
        pointCoordinates,
        hasSvgPaths: includeSvgPath,
        geometry
      }
    );
    return geometry;
  }

function sourceSocketRefForConnection(
    connection
  ) {
    const socket =
      socketElement(
        connection.fromNode,
        connection.fromPort,
        "output"
      );
    const sourceNode =
      findGraphNode(
        connection.fromNode
      );
    const mirrored =
      sourceNode?.parameters?.portLayout ===
        "mirrored";

    return {
      nodeId:
        connection.fromNode,
      portId:
        connection.fromPort,
      direction: "output",
      side:
        socket?.dataset.side ||
        (mirrored
          ? "left"
          : "right")
    };
  }

function quickWireBranchTargetState(
    connection,
    inputRef
  ) {
    if (
      !inputRef ||
      inputRef.direction !== "input"
    ) {
      return null;
    }

    const source =
      sourceSocketRefForConnection(
        connection
      );

    if (
      source.nodeId ===
        inputRef.nodeId
    ) {
      return "invalid";
    }

    const candidate = {
      id: "wire-branch-preview",
      fromNode: source.nodeId,
      fromPort: source.portId,
      toNode: inputRef.nodeId,
      toPort: inputRef.portId
    };
    const withoutCurrentInput =
      graph.connections.filter(
        current =>
          !(
            current.toNode ===
              candidate.toNode &&
            current.toPort ===
              candidate.toPort
          )
      );

    if (
      wouldCreateCycle(
        withoutCurrentInput,
        candidate
      )
    ) {
      return "invalid";
    }

    const sourcePort =
      findPortSpec(
        source.nodeId,
        source.portId,
        "output"
      );
    const targetPort =
      findPortSpec(
        inputRef.nodeId,
        inputRef.portId,
        "input"
      );
    const bindings =
      currentAnalysis?.bindings ||
      new Map();
    const sourceType =
      resolvePortType(
        sourcePort,
        bindings
      );
    const targetType =
      resolvePortType(
        targetPort,
        bindings
      );

    if (
      !isConfigurationReactionConnection(
        sourcePort,
        targetPort
      ) &&
      sourceType &&
      targetType &&
      !connectionTypesCompatible(
        sourceType,
        targetType
      )
    ) {
      return "invalid";
    }

    return "valid";
  }

function nearestGraphPointOnSvgPath(
    path,
    clientX,
    clientY
  ) {
    if (
      path?._rmlGraphSegment &&
      graphHybridRenderer
        ?.nearestGraphPoint
    ) {
      return graphHybridRenderer
        .nearestGraphPoint(
          path,
          clientX,
          clientY
        );
    }

    const target =
      clientToGraph(
        clientX,
        clientY
      );

    if (
      !path ||
      typeof path.getTotalLength !==
        "function"
    ) {
      return target;
    }

    let totalLength;

    try {
      totalLength =
        path.getTotalLength();
    } catch {
      return target;
    }

    if (!(totalLength > 0)) {
      return target;
    }

    let bestLength = 0;
    let bestPoint =
      path.getPointAtLength(0);
    let bestDistance =
      Math.hypot(
        bestPoint.x - target.x,
        bestPoint.y - target.y
      );

    for (
      let index = 1;
      index <= GRAPH_WIRE_PATH_SAMPLES;
      index += 1
    ) {
      const length =
        totalLength *
        index /
        GRAPH_WIRE_PATH_SAMPLES;
      const point =
        path.getPointAtLength(
          length
        );
      const distance =
        Math.hypot(
          point.x - target.x,
          point.y - target.y
        );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestLength = length;
        bestPoint = point;
      }
    }

    let step =
      totalLength /
      GRAPH_WIRE_PATH_SAMPLES;

    for (
      let pass = 0;
      pass < 6;
      pass += 1
    ) {
      const candidates = [
        nodeGraphClamp(
          bestLength - step,
          0,
          totalLength
        ),
        bestLength,
        nodeGraphClamp(
          bestLength + step,
          0,
          totalLength
        )
      ];

      for (const length of candidates) {
        const point =
          path.getPointAtLength(
            length
          );
        const distance =
          Math.hypot(
            point.x - target.x,
            point.y - target.y
          );

        if (distance < bestDistance) {
          bestDistance = distance;
          bestLength = length;
          bestPoint = point;
        }
      }

      step *= 0.5;
    }

    return {
      x: bestPoint.x,
      y: bestPoint.y
    };
  }

function wireTargetAtPoint(
    clientX,
    clientY,
    excludedConnectionId = null
  ) {
    const elements =
      typeof document.elementsFromPoint ===
        "function"
        ? document.elementsFromPoint(
            clientX,
            clientY
          )
        : [
            document.elementFromPoint(
              clientX,
              clientY
            )
          ];

    for (const element of elements) {
      const hit =
        element?.closest?.(
          ".rml-graph-wire-hit"
        );

      if (!hit) {
        continue;
      }

      const connectionId =
        hit.dataset.connectionId;

      if (
        !connectionId ||
        connectionId ===
          excludedConnectionId
      ) {
        continue;
      }

      return {
        connectionId,
        segmentIndex:
          Math.max(
            0,
            Math.trunc(
              finiteNumber(
                hit.dataset.segmentIndex,
                0
              )
            )
          ),
        path: hit
      };
    }

    return graphHybridRenderer
      ?.pickWire?.(
        clientX,
        clientY,
        12,
        excludedConnectionId
      ) || null;
  }

function createWirePointHandle(
    connection,
    point,
    color,
    junction,
    branchCount,
    selected
  ) {
    const handle =
      document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle"
      );
    const dragging =
      activeInteraction?.kind ===
        "wire-point" &&
      activeInteraction.connectionId ===
        connection.id &&
      activeInteraction.pointId ===
        point.id;

    handle.setAttribute(
      "class",
      `rml-graph-wire-point ${
        junction
          ? "junction"
          : "bend"
      }${selected ? " selected" : ""}${dragging ? " dragging" : ""}`
    );
    handle.setAttribute(
      "cx",
      String(point.x)
    );
    handle.setAttribute(
      "cy",
      String(point.y)
    );
    handle.setAttribute(
      "r",
      junction
        ? "8"
        : selected
          ? "7"
          : "5.5"
    );
    handle.dataset.rmlWireColor =
      color;

    handle.dataset.connectionId =
      connection.id;
    handle.dataset.pointId =
      point.id;
    handle.title = junction
      ? `Typed wire junction · ${branchCount} branch${
          branchCount === 1 ? "" : "es"
        } · click to select · drag to move · Delete or double-click to remove`
      : "Manual wire bend · click to select · drag to move · Delete or double-click to remove";

    handle.addEventListener(
      "pointerdown",
      beginWirePointDrag
    );
    handle.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopPropagation();
      }
    );

    return handle;
  }

function materializeSvgWireCompatibility() {
    return Boolean(
      !graphHybridActive() ||
      RML_GRAPH_VISUAL_TEST ||
      document.documentElement
        .classList.contains(
          "rml-setup-tour-active"
        ) ||
      graph.connections.length <=
        GRAPH_SVG_COMPATIBILITY_LIMIT
    );
  }

function forceSvgWireVisuals() {
    return Boolean(
      RML_GRAPH_VISUAL_TEST ||
      document.documentElement
        .classList.contains(
          "rml-setup-tour-active"
        )
    );
  }

function graphPointInsideViewport(
    point,
    margin = 28
  ) {
    if (
      !fallbackGraphVirtualizationActive() &&
      (
        !graphHybridActive() ||
        materializeSvgWireCompatibility()
      )
    ) {
      return true;
    }
    const rectangle =
      dom.viewport
        ?.getBoundingClientRect();
    if (!rectangle) {
      return true;
    }
    const client = graphToClient(
      point.x,
      point.y
    );
    return Boolean(
      client.x >= rectangle.left - margin &&
      client.x <= rectangle.right + margin &&
      client.y >= rectangle.top - margin &&
      client.y <= rectangle.bottom + margin
    );
  }

function graphSegmentInsideViewport(
    segment,
    margin = 90
  ) {
    if (
      !fallbackGraphVirtualizationActive()
    ) {
      return true;
    }

    const rectangle =
      dom.viewport
        ?.getBoundingClientRect();
    if (!rectangle) {
      return true;
    }

    const from = graphToClient(
      segment.from.x,
      segment.from.y
    );
    const to = graphToClient(
      segment.to.x,
      segment.to.y
    );
    const left = Math.min(from.x, to.x);
    const right = Math.max(from.x, to.x);
    const top = Math.min(from.y, to.y);
    const bottom = Math.max(from.y, to.y);

    return Boolean(
      right >= rectangle.left - margin &&
      left <= rectangle.right + margin &&
      bottom >= rectangle.top - margin &&
      top <= rectangle.bottom + margin
    );
  }

function graphGpuSimplifiedNodesActive() {
    return Boolean(
      graphHybridActive() &&
      !forceSvgWireVisuals() &&
      (
        graphGpuOverviewActive() ||
        graphGpuDetailOverflowMode
      )
    );
  }

function graphGpuNodeRecord(node) {
    const geometry =
      estimatedGraphNodeGeometry(node);
    return {
      nodeId: node.id,
      x: node.x,
      y: node.y,
      width: geometry.width,
      height: geometry.height,
      configuration:
        node.kind === "configuration",
      selected:
        graph.selectedNodeId === node.id
    };
  }

function invalidateGraphGpuNodeRecord(
    nodeId = null
  ) {
    if (nodeId) {
      if (!graphGpuNodeRecordsDirty) {
        graphGpuNodeDirtyIds.add(nodeId);
      }
      return;
    }
    graphGpuNodeRecordsDirty = true;
    graphGpuNodeDirtyIds.clear();
  }

function ensureGraphGpuNodeRecords() {
    const nodes = graph?.nodes || [];
    const rebuild =
      graphGpuNodeRecordsDirty ||
      graphGpuNodeRecordSource !== nodes ||
      graphGpuNodeRecordLength !== nodes.length;
    if (rebuild) {
      graphGpuNodeRecords = [];
      graphGpuNodeRecordById.clear();
      for (const node of nodes) {
        if (
          node?.parameters
            ?._rmlInternalDynamicMonitor ===
              true
        ) {
          continue;
        }
        const record =
          graphGpuNodeRecord(node);
        const index =
          graphGpuNodeRecords.length;
        graphGpuNodeRecords.push(record);
        graphGpuNodeRecordById.set(
          node.id,
          { index, record }
        );
      }
      graphGpuNodeRecordSource = nodes;
      graphGpuNodeRecordLength = nodes.length;
      graphGpuNodeRecordsDirty = false;
      graphGpuNodeDirtyIds.clear();
      return {
        records: graphGpuNodeRecords,
        updates: [],
        rebuilt: true
      };
    }

    const updates = [];
    for (const nodeId of graphGpuNodeDirtyIds) {
      const entry =
        graphGpuNodeRecordById.get(nodeId);
      const node = findGraphNode(nodeId);
      if (
        !entry ||
        !node ||
        node?.parameters
          ?._rmlInternalDynamicMonitor ===
            true
      ) {
        graphGpuNodeRecordsDirty = true;
        graphGpuNodeDirtyIds.clear();
        return ensureGraphGpuNodeRecords();
      }
      const record = graphGpuNodeRecord(node);
      graphGpuNodeRecords[entry.index] = record;
      graphGpuNodeRecordById.set(
        nodeId,
        { index: entry.index, record }
      );
      updates.push(record);
    }
    graphGpuNodeDirtyIds.clear();
    return {
      records: graphGpuNodeRecords,
      updates,
      rebuilt: false
    };
  }

function gpuOverviewNodeRecords() {
    return graphGpuSimplifiedNodesActive()
      ? ensureGraphGpuNodeRecords().records
      : [];
  }

function synchronizeGpuOverviewNodes() {
    if (
      !graphHybridActive() ||
      forceSvgWireVisuals() ||
      !graphHybridRenderer?.setNodes
    ) {
      return;
    }
    const selectedNodeId =
      graph.selectedNodeId || null;
    if (
      graphGpuSelectedNodeId !==
        selectedNodeId
    ) {
      invalidateGraphGpuNodeRecord(
        graphGpuSelectedNodeId
      );
      invalidateGraphGpuNodeRecord(
        selectedNodeId
      );
      graphGpuSelectedNodeId =
        selectedNodeId;
    }
    if (!graphGpuSimplifiedNodesActive()) {
      graphHybridRenderer
        .setNodeExclusions?.([]);
      graphHybridRenderer.setNodes([]);
      graphHybridRenderer.setCamera?.(
        graph.viewport
      );
      graphHybridRenderer.drawNow?.();
      return;
    }

    const snapshot =
      ensureGraphGpuNodeRecords();
    const installed =
      graphHybridRenderer.setNodes(
        snapshot.records
      );
    if (
      !installed &&
      snapshot.updates.length > 0 &&
      !graphHybridRenderer.updateNodes?.(
        snapshot.updates
      )
    ) {
      graphHybridRenderer.setNodes(
        snapshot.records.slice()
      );
    }
    const rendered = new Set(
      [
        ...dom.nodesHost
          ?.querySelectorAll(
            ":scope > .rml-graph-node"
          ) || []
      ].map(element =>
        element.dataset.graphNodeId
      )
    );
    graphHybridRenderer
      .setNodeExclusions?.(rendered);
    graphHybridRenderer.setCamera?.(
      graph.viewport
    );
    graphHybridRenderer.drawNow?.();
  }

function gpuSegmentsForConnection(
    connection,
    inputBranchStart = null,
    target = null
  ) {
    const geometry =
      connectionGeometry(
        connection,
        false
      );
    if (!geometry) {
      return [];
    }
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
    const reactiveImpulse =
      isConfigurationReactionConnection(
        fromRef,
        toRef
      );
    const concreteType =
      resolvePortType(
        fromRef,
        currentAnalysis?.bindings ||
          new Map()
      ) || "generic";
    const color =
      typeInfo(concreteType).color;
    const targetState = inputBranchStart
      ? quickWireBranchTargetState(
          connection,
          inputBranchStart
        )
      : null;
    const impulse = Boolean(
      concreteType === "impulse" ||
      reactiveImpulse
    );
    const selected =
      graph.selectedConnectionId ===
      connection.id;
    const records = target || [];
    for (const segment of geometry.segments) {
      records.push({
        connectionId: connection.id,
        segmentIndex: segment.index,
        from: segment.from,
        to: segment.to,
        color,
        impulse,
        selected,
        targetState
      });
    }
    return records;
  }

function relatedGraphConnectionIds(
    connectionId
  ) {
    const result = new Set([
      connectionId
    ]);
    for (const connection of graph.connections) {
      if (
        connection.branchFrom
          ?.connectionId ===
        connectionId
      ) {
        result.add(connection.id);
      }
    }
    return result;
  }

function incidentGraphConnectionIds(
    nodeId
  ) {
    ensureGraphConnectionLookups();
    return new Set(
      graphIncidentConnectionLookupCache.get(
        nodeId
      ) || []
    );
  }

function graphSvgWirePathKey(
    connectionId,
    segmentIndex
  ) {
    return `${connectionId}\u0000${segmentIndex}`;
  }

function graphSvgWirePointKey(
    connectionId,
    pointId
  ) {
    return `${connectionId}\u0000${pointId}`;
  }

function rebuildGraphSvgWireCaches() {
    graphSvgWirePathCache.clear();
    graphSvgWirePointCache.clear();
    for (const element of
      dom.wires?.querySelectorAll(
        "[data-connection-id][data-segment-index]"
      ) || []) {
      const key = graphSvgWirePathKey(
        element.dataset.connectionId,
        element.dataset.segmentIndex
      );
      const paths =
        graphSvgWirePathCache.get(key) ||
        [];
      paths.push(element);
      graphSvgWirePathCache.set(
        key,
        paths
      );
    }
    for (const element of
      dom.wires?.querySelectorAll(
        ".rml-graph-wire-point[data-connection-id][data-point-id]"
      ) || []) {
      graphSvgWirePointCache.set(
        graphSvgWirePointKey(
          element.dataset.connectionId,
          element.dataset.pointId
        ),
        element
      );
    }
  }

function updateGraphSvgWirePaths(
    records
  ) {
    if (!materializeSvgWireCompatibility()) {
      return true;
    }
    for (const record of records) {
      const paths =
        graphSvgWirePathCache.get(
          graphSvgWirePathKey(
            record.connectionId,
            record.segmentIndex
          )
        );
      if (!paths?.length) {
        return false;
      }
      const path = wirePath(
        record.from,
        record.to
      );
      for (const element of paths) {
        element.setAttribute(
          "d",
          path
        );
      }
    }
    return true;
  }

function graphWireGeometryInteractionActive() {
    return [
      "node",
      "node-resize",
      "wire-segment",
      "wire-point"
    ].includes(
      activeInteraction?.kind
    );
  }

function updateGraphWireConnections(
    connectionIds
  ) {
    const gpuPartialUpdate =
      graphHybridActive() &&
      !forceSvgWireVisuals() &&
      Boolean(
        graphHybridRenderer
          ?.updateSegments
      );
    const svgInteractionUpdate =
      !graphHybridActive() &&
      !forceSvgWireVisuals() &&
      graphWireGeometryInteractionActive();
    if (
      !gpuPartialUpdate &&
      !svgInteractionUpdate
    ) {
      return false;
    }
    const records = [];
    const ids = new Set(
      connectionIds
    );
    for (const connectionId of ids) {
      const connection =
        graphConnectionById(
          connectionId
        );
      if (!connection) {
        return false;
      }
      for (const record of
        gpuSegmentsForConnection(
          connection
        )) {
        records.push(record);
      }
    }
    if (
      records.length === 0 ||
      (
        gpuPartialUpdate &&
        !graphHybridRenderer
          .updateSegments(records)
      )
    ) {
      return false;
    }

    if (!updateGraphSvgWirePaths(records)) {
      return false;
    }

    for (const connectionId of ids) {
      const connection =
        graphConnectionById(
          connectionId
        );
      for (const point of
        connection?.points || []) {
        const handle =
          graphSvgWirePointCache.get(
            graphSvgWirePointKey(
              connectionId,
              point.id
            )
          );
        if (!handle) {
          continue;
        }
        handle.setAttribute(
          "cx",
          String(point.x)
        );
        handle.setAttribute(
          "cy",
          String(point.y)
        );
      }
    }
    if (gpuPartialUpdate) {
      graphHybridRenderer.drawNow?.();
    }
    return true;
  }

function notifyGraphRenderComplete() {
    const rootView = rootRuntimeGraphView();
    document.dispatchEvent(
      new CustomEvent(
        "rml-graph:render-complete",
        {
          detail: {
            scope: customCSharpEditor
              ? "custom-csharp-file"
              : "runtime-root",
            fileNodeId:
              customCSharpEditor?.fileNodeId || "",
            nodes:
              graph?.nodes?.length || 0,
            connections:
              graph?.connections?.length || 0,
            rootNodes:
              rootView?.nodes?.length || 0,
            rootConnections:
              rootView?.connections?.length || 0,
            projectEpoch:
              builderProjectEpoch
          }
        }
      )
    );
  }

function renderCompleteHybridGraphWires({
    branchUsage
  }) {
    const gpuSegments = [];
    const handles = [];


    

    for (const connection of graph.connections) {
      const firstRecordIndex =
        gpuSegments.length;
      gpuSegmentsForConnection(
        connection,
        null,
        gpuSegments
      );

      const color =
        gpuSegments[firstRecordIndex]
          ?.color ||
        typeInfo("generic").color;
      for (const point of
        connection.points || []) {
        const branchCount =
          branchPointUsageCount(
            connection.id,
            point.id,
            branchUsage
          );
        const junction =
          branchCount > 0;
        const selected = Boolean(
          graph.selectedWirePoint &&
          graph.selectedWirePoint
            .connectionId ===
              connection.id &&
          graph.selectedWirePoint
            .pointId === point.id
        );

        if (
          selected ||
          graphPointInsideViewport(
            point
          )
        ) {
          handles.push(
            createWirePointHandle(
              connection,
              point,
              color,
              junction,
              branchCount,
              selected
            )
          );
        }
      }
    }

    graphHybridRenderer?.setScene?.({
      segments: gpuSegments,
      nodes: gpuOverviewNodeRecords()
    });
    graphHybridRenderer?.setCamera?.(
      graph.viewport
    );
    graphHybridRenderer?.drawNow?.();
    dom.wires.replaceChildren(
      ...handles
    );
    rebuildGraphSvgWireCaches();
    notifyGraphRenderComplete();
  }

function renderGraphWires() {
    if (!dom.wires) {
      return;
    }

    if (graphWireRenderFrame) {
      cancelAnimationFrame(
        graphWireRenderFrame
      );
      graphWireRenderFrame = 0;
    }
    graphWireFullRenderPending = false;
    graphWirePartialConnectionIds.clear();

    currentAnalysis =
      currentAnalysis ||
      analyzeConnections(
        graph.connections
      );

    const branchUsage =
      branchPointUsageMap();
    const gpuVisual =
      graphHybridActive() &&
      !forceSvgWireVisuals();
    const svgCompatibility =
      materializeSvgWireCompatibility();

    if (
      gpuVisual &&
      !svgCompatibility &&
      !activeInteraction
    ) {
      renderCompleteHybridGraphWires({
        branchUsage
      });
      return;
    }

    const svgItems = [];
    const handles = [];
    const gpuSegments = [];
    const inputBranchStart =
      activeInteraction?.kind ===
        "connection" &&
      activeInteraction.start
        ?.direction === "input"
        ? activeInteraction.start
        : null;
    const fallbackVirtualized =
      fallbackGraphVirtualizationActive();
    let fallbackSvgConnectionCount = 0;

    for (const connection of graph.connections) {
      const selectedConnection =
        graph.selectedConnectionId ===
          connection.id;
      if (
        fallbackVirtualized &&
        !selectedConnection &&
        fallbackSvgConnectionCount >=
          GRAPH_FALLBACK_MAX_SVG_CONNECTIONS
      ) {
        continue;
      }

      const geometry =
        connectionGeometry(
          connection,
          !gpuVisual || svgCompatibility
        );

      if (!geometry) {
        continue;
      }

      if (
        fallbackVirtualized &&
        !selectedConnection
      ) {
        const visible =
          geometry.segments.some(
            segment =>
              graphSegmentInsideViewport(
                segment
              )
          );
        if (
          !visible ||
          fallbackSvgConnectionCount >=
            GRAPH_FALLBACK_MAX_SVG_CONNECTIONS
        ) {
          continue;
        }
      }
      if (fallbackVirtualized) {
        fallbackSvgConnectionCount += 1;
      }

      const fromRef =
        findPortSpec(
          connection.fromNode,
          connection.fromPort,
          "output"
        );
      const toRef =
        findPortSpec(
          connection.toNode,
          connection.toPort,
          "input"
        );
      const reactiveImpulse =
        isConfigurationReactionConnection(
          fromRef,
          toRef
        );
      const concreteType =
        resolvePortType(
          fromRef,
          currentAnalysis.bindings
        ) || "generic";
      const color =
        typeInfo(concreteType).color;
      const targetState =
        inputBranchStart
          ? quickWireBranchTargetState(
              connection,
              inputBranchStart
            )
          : null;

      for (const segment of geometry.segments) {
        const impulse = Boolean(
          concreteType === "impulse" ||
          reactiveImpulse
        );
        const selected =
          graph.selectedConnectionId ===
          connection.id;

        if (gpuVisual) {
          gpuSegments.push({
            connectionId: connection.id,
            segmentIndex: segment.index,
            from: segment.from,
            to: segment.to,
            color,
            impulse,
            selected,
            targetState
          });
        }

        if (!gpuVisual) {
          const shadow = svgPath(
            "rml-graph-wire-shadow",
            segment.d
          );
          const visible = svgPath(
            `rml-graph-wire${
              impulse ? " impulse" : ""
            }${
              selected ? " selected" : ""
            }${
              targetState
                ? ` branch-target-${targetState}`
                : ""
            }`,
            segment.d
          );
          visible.dataset.rmlWireColor =
            color;
          shadow.dataset.connectionId =
            connection.id;
          shadow.dataset.segmentIndex =
            String(segment.index);
          visible.dataset.connectionId =
            connection.id;
          visible.dataset.segmentIndex =
            String(segment.index);
          const hit = svgPath(
            `rml-graph-wire-hit${
              targetState
                ? ` branch-target-${targetState}`
                : ""
            }`,
            segment.d
          );
          hit.dataset.connectionId =
            connection.id;
          hit.dataset.segmentIndex =
            String(segment.index);
          hit.addEventListener(
            "pointerdown",
            event =>
              beginWireSegmentDrag(
                event,
                connection.id,
                segment.index,
                hit
              )
          );
          svgItems.push(
            shadow,
            visible,
            hit
          );
        } else if (svgCompatibility) {
          const proxy = svgPath(
            "rml-graph-wire rml-graph-gpu-proxy",
            segment.d
          );
          proxy.dataset.connectionId =
            connection.id;
          proxy.dataset.segmentIndex =
            String(segment.index);
          const hit = svgPath(
            `rml-graph-wire-hit${
              targetState
                ? ` branch-target-${targetState}`
                : ""
            }`,
            segment.d
          );
          hit.dataset.connectionId =
            connection.id;
          hit.dataset.segmentIndex =
            String(segment.index);
          hit.addEventListener(
            "pointerdown",
            event =>
              beginWireSegmentDrag(
                event,
                connection.id,
                segment.index,
                hit
              )
          );
          svgItems.push(
            proxy,
            hit
          );
        }
      }

      for (const point of connection.points || []) {
        const branchCount =
          branchPointUsageCount(
            connection.id,
            point.id,
            branchUsage
          );
        const junction =
          branchCount > 0;
        const selected = Boolean(
          graph.selectedWirePoint &&
          graph.selectedWirePoint
            .connectionId ===
              connection.id &&
          graph.selectedWirePoint
            .pointId === point.id
        );

        if (
          selected ||
          graphPointInsideViewport(
            point
          )
        ) {
          handles.push(
            createWirePointHandle(
              connection,
              point,
              color,
              junction,
              branchCount,
              selected
            )
          );
        }
      }
    }

    graphHybridRenderer?.setScene?.({
      segments:
        forceSvgWireVisuals()
          ? []
          : gpuSegments,
      nodes:
        forceSvgWireVisuals()
          ? []
          : gpuOverviewNodeRecords()
    });
    graphHybridRenderer?.setCamera?.(
      graph.viewport
    );
    graphHybridRenderer?.drawNow?.();

    

    dom.wires.replaceChildren(
      ...svgItems,
      ...handles
    );
    rebuildGraphSvgWireCaches();

    if (
      activeInteraction?.kind ===
      "connection"
    ) {
      renderConnectionPreview();
    }

    notifyGraphRenderComplete();
  }

function refreshGraphSelectionWires(
    previousConnectionId = null
  ) {
    const ids = new Set();
    if (previousConnectionId) {
      ids.add(previousConnectionId);
    }
    if (graph.selectedConnectionId) {
      ids.add(graph.selectedConnectionId);
    }
    if (ids.size === 0) {
      return;
    }
    if (!updateGraphWireConnections(ids)) {
      renderGraphWires();
    }
  }

function selectGraphNode(
    nodeId,
    event = null
  ) {
    const previousConnectionId =
      graph.selectedConnectionId;
    if (graphGpuOverviewActive()) {
      graphForcedNodeIds.clear();
      graphForcedNodeIds.add(nodeId);
      graphNodeVirtualizationSignature = "";
    }
    const additive = Boolean(
      event?.ctrlKey ||
      event?.metaKey
    );
    const selected = new Set(
      Array.isArray(graph.selectedNodeIds)
        ? graph.selectedNodeIds
        : []
    );
    if (additive) {
      if (selected.has(nodeId)) {
        selected.delete(nodeId);
      } else {
        selected.add(nodeId);
      }
    } else {
      selected.clear();
      selected.add(nodeId);
    }
    graph.selectedNodeIds =
      [...selected];
    graph.selectedNodeId =
      selected.has(nodeId)
        ? nodeId
        : graph.selectedNodeIds.at(-1) ||
          null;
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    persistGraphView();
    updateSelectionClasses();
    refreshGraphSelectionWires(
      previousConnectionId
    );
    synchronizeGpuOverviewNodes();
    renderGraphInspector();
    scheduleGraphNodeVirtualization();
  }

function selectGraphConnection(
    connectionId
  ) {
    const previousConnectionId =
      graph.selectedConnectionId;
    if (graphGpuOverviewActive()) {
      graphForcedNodeIds.clear();
      graphNodeVirtualizationSignature = "";
    }
    graph.selectedNodeId = null;
    graph.selectedNodeIds = [];
    graph.selectedConnectionId =
      connectionId;
    clearSelectedWirePoint();
    persistGraphView();
    updateSelectionClasses();
    refreshGraphSelectionWires(
      previousConnectionId
    );
    synchronizeGpuOverviewNodes();
    renderGraphInspector();
    scheduleGraphNodeVirtualization();
  }

function selectGraphWirePoint(
    connectionId,
    pointId,
    rerenderWires = true
  ) {
    const connection =
      graphConnectionById(
        connectionId
      );
    const point =
      wirePointById(
        connection,
        pointId
      );

    if (!connection || !point) {
      return false;
    }

    graph.selectedNodeId = null;
    graph.selectedNodeIds = [];
    graph.selectedConnectionId =
      connection.id;
    graph.selectedWirePoint = {
      connectionId:
        connection.id,
      pointId: point.id
    };
    persistGraphView();
    updateSelectionClasses();

    if (rerenderWires) {
      renderGraphWires();
    } else {
      dom.wires
        ?.querySelectorAll(
          ".rml-graph-wire"
        )
        .forEach(path => {
          path.classList.toggle(
            "selected",
            path.dataset.connectionId ===
              connection.id
          );
        });
      dom.wires
        ?.querySelectorAll(
          ".rml-graph-wire-point"
        )
        .forEach(handle => {
          handle.classList.toggle(
            "selected",
            handle.dataset
              .connectionId ===
                connection.id &&
            handle.dataset.pointId ===
              point.id
          );
        });
    }

    renderGraphInspector();
    return true;
  }

function updateSelectionClasses() {
    dom.nodesHost
      ?.querySelectorAll(
        ".rml-graph-node"
      )
      .forEach(element => {
        element.classList.toggle(
          "selected",
          (
            Array.isArray(
              graph.selectedNodeIds
            ) &&
            graph.selectedNodeIds.includes(
              element.dataset.graphNodeId
            )
          ) ||
          element.dataset.graphNodeId ===
            graph.selectedNodeId
        );
      });
  }

function expandedGraphConnectionRemovalIds(
    connectionIds
  ) {
    const removed = new Set(
      Array.isArray(connectionIds) ||
      connectionIds instanceof Set
        ? connectionIds
        : [connectionIds]
    );
    removed.delete("");
    removed.delete(null);
    removed.delete(undefined);

    const childrenByConnectionId =
      new Map();
    for (const connection of graph.connections) {
      const parentId =
        connection.branchFrom
          ?.connectionId;
      if (!parentId) {
        continue;
      }
      const children =
        childrenByConnectionId.get(
          parentId
        ) || [];
      children.push(connection.id);
      childrenByConnectionId.set(
        parentId,
        children
      );
    }

    const queue = [...removed];
    for (
      let index = 0;
      index < queue.length;
      index += 1
    ) {
      for (
        const childId of
        childrenByConnectionId.get(
          queue[index]
        ) || []
      ) {
        if (removed.has(childId)) {
          continue;
        }
        removed.add(childId);
        queue.push(childId);
      }
    }
    return removed;
  }

function hideGraphConnectionsImmediately(
    connectionIds
  ) {
    const ids = new Set(connectionIds);
    if (ids.size === 0) {
      return;
    }

    if (graphWireRenderFrame) {
      cancelAnimationFrame(
        graphWireRenderFrame
      );
      graphWireRenderFrame = 0;
    }
    graphWireFullRenderPending = false;
    graphWirePartialConnectionIds.clear();

    for (
      const element of
      dom.wires?.querySelectorAll(
        "[data-connection-id]"
      ) || []
    ) {
      if (
        ids.has(
          element.dataset.connectionId
        )
      ) {
        element.remove();
      }
    }

    graphHybridRenderer
      ?.hideConnections?.(ids);
    graphHybridRenderer?.drawNow?.();
  }

function removeGraphConnectionsFromState(
    connectionIds
  ) {
    const removed =
      expandedGraphConnectionRemovalIds(
        connectionIds
      );
    if (removed.size === 0) {
      return removed;
    }
    graph.connections =
      graph.connections.filter(
        connection =>
          !removed.has(connection.id)
      );
    hideGraphConnectionsImmediately(
      removed
    );
    currentAnalysis = null;
    graphConnectionLookupSource = null;
    graphConnectionLookupLength = -1;
    graphIncidentConnectionLookupCache.clear();
    graphConnectedPortKeysSource = null;
    graphConnectedPortKeysLength = -1;
    for (const connectionId of removed) {
      graphConnectionGeometryCache.delete(
        connectionId
      );
    }
    return removed;
  }

function scheduleStructuralGraphCommit() {
    if (
      graphStructuralPaintFrame ||
      graphStructuralCommitFrame
    ) {
      return;
    }


    

    const projectEpoch =
      builderProjectEpoch;
    graphStructuralPaintFrame =
      requestProjectAnimationFrame(() => {
        graphStructuralPaintFrame = 0;
        if (
          projectEpoch !==
            builderProjectEpoch
        ) {
          return;
        }
        graphStructuralCommitFrame =
          requestProjectAnimationFrame(() => {
            graphStructuralCommitFrame = 0;
            if (
              projectEpoch !==
                builderProjectEpoch
            ) {
              return;
            }
            pruneConnections();
            persistGraph(true);
            renderGraphNodesAndWires();
            renderGraphPalette();
            renderGraphInspector();
          });
      });
  }

function deleteGraphNode(nodeId) {
    const node =
      findGraphNode(nodeId);

    if (!node) {
      return;
    }

    if (apiCompositeEditor) {
      if (
        apiCompositeVerifiedCatalogNode(
          node
        ) &&
        graph.nodes.filter(
          apiCompositeVerifiedCatalogNode
        ).length <= 1
      ) {
        showGraphMessage(
          "This is the last verified catalog API node in the Composite and cannot be deleted.",
          "error"
        );
        return;
      }
      const ownerId =
        apiCompositeEditor.containerNodeId;
      const boundaries =
        apiCompositeBoundaryRecords(
          graph.apiCompositeGraphs?.[
            ownerId
          ]?.boundaryPorts
        ).filter(boundary =>
          boundary.internalNodeId ===
            nodeId &&
          apiCompositeBoundaryHasExternalWire(
            boundary
          )
        );
      if (boundaries.length > 0) {
        showGraphMessage(
          `Cannot delete this internal node while ${boundaries.length.toLocaleString("de-DE")} exposed Composite port${boundaries.length === 1 ? " is" : "s are"} connected in the outer Runtime Graph. Disconnect those outer wires first.`,
          "error"
        );
        return;
      }
    }

    const deletedEditorNodeIds = new Set([
      nodeId
    ]);
    if (
      node.operatorId ===
        "container.apiComposite"
    ) {
      for (const ownerId of Object.keys(
        graph.apiCompositeGraphs?.[nodeId]
          ?.customCSharpFiles || {}
      )) {
        deletedEditorNodeIds.add(ownerId);
      }
    }
    for (const [editorKey, detachedEditor] of
      customCSharpDetachedEditors) {
      if (
        !deletedEditorNodeIds.has(
          detachedEditor?.nodeId
        )
      ) {
        continue;
      }
      if (
        customCSharpEditorRecordActive(
          detachedEditor
        )
      ) {
        detachedEditor.close?.();
      }
      customCSharpDetachedEditors.delete(
        editorKey
      );
    }

    if (
      !customCSharpEditor &&
      node.operatorId === "csharp.file" &&
      graph.customCSharpFiles
    ) {
      delete graph.customCSharpFiles[nodeId];
    }
    if (
      !customCSharpEditor &&
      !apiCompositeEditor &&
      node.operatorId ===
        "container.apiComposite" &&
      graph.apiCompositeGraphs
    ) {
      const removedComposite =
        graph.apiCompositeGraphs[nodeId];
      for (const ownerId of Object.keys(
        removedComposite?.customCSharpFiles || {}
      )) {
        delete graph.customCSharpFiles?.[
          ownerId
        ];
      }
      delete graph.apiCompositeGraphs[
        nodeId
      ];
    }

    nodeBodyScrollPositions.delete(
      nodeId
    );
    graphNodeGeometryCache.delete(
      nodeId
    );
    graphForcedNodeIds.delete(
      nodeId
    );

    const incidentConnectionIds =
      graph.connections
        .filter(
          connection =>
            connection.fromNode ===
              nodeId ||
            connection.toNode ===
              nodeId
        )
        .map(connection => connection.id);

    graph.nodes =
      graph.nodes.filter(
        candidate =>
          candidate.id !== nodeId
      );
    currentAnalysis = null;
    removeGraphConnectionsFromState(
      incidentConnectionIds
    );

    if (
      graph.selectedNodeId ===
      nodeId
    ) {
      graph.selectedNodeId = null;
    }
    graph.selectedNodeIds =
      (graph.selectedNodeIds || [])
        .filter(id => id !== nodeId);

    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    dom.nodesHost
      ?.querySelector(
        `[data-graph-node-id="${CSS.escape(nodeId)}"]`
      )
      ?.remove();
    synchronizeGpuOverviewNodes();
    if (dom.itemCount) {
      dom.itemCount.textContent =
        String(graph.nodes.length);
    }
    persistGraph(true, false);
    renderGraphInspector();
    scheduleStructuralGraphCommit();
  }

function deleteSelectedGraphItem() {
    const selectedPoint =
      selectedWirePointReference();

    if (selectedPoint) {
      removeWirePoint(
        selectedPoint.connection.id,
        selectedPoint.point.id
      );
      return;
    }

    if (graph.selectedNodeId) {
      deleteGraphNode(
        graph.selectedNodeId
      );
      return;
    }

    if (graph.selectedConnectionId) {
      removeGraphConnectionsFromState(
        [graph.selectedConnectionId]
      );
      graph.selectedConnectionId = null;
      clearSelectedWirePoint();
      persistGraph(true, false);
      renderGraphInspector();
      scheduleStructuralGraphCommit();
    }
  }

function graphInspectorHasActiveEditor() {
    const active = document.activeElement;
    if (
      !(active instanceof HTMLElement) ||
      !dom.inspectorContent?.contains(active)
    ) {
      return false;
    }

    if (active instanceof HTMLTextAreaElement) {
      return true;
    }
    if (active.isContentEditable) {
      return true;
    }
    if (!(active instanceof HTMLInputElement)) {
      return false;
    }

    return ![
      "button",
      "checkbox",
      "color",
      "file",
      "hidden",
      "radio",
      "range",
      "reset",
      "submit"
    ].includes(active.type);
  }

function graphInspectorSelectionKey() {
    const context = customCSharpEditor
      ? `custom-csharp:${String(customCSharpEditor.ownerId || "")}`
      : apiCompositeEditor
        ? `api-composite:${String(apiCompositeEditor.ownerId || "")}`
        : "runtime";
    const selectedPoint = graph?.selectedWirePoint;
    if (
      selectedPoint?.connectionId &&
      selectedPoint?.pointId
    ) {
      return `${context}:point:${selectedPoint.connectionId}:${selectedPoint.pointId}`;
    }
    if (graph?.selectedConnectionId) {
      return `${context}:connection:${graph.selectedConnectionId}`;
    }
    const selectedNodeIds = [
      ...new Set(
        Array.isArray(graph?.selectedNodeIds)
          ? graph.selectedNodeIds
          : []
      )
    ];
    return `${context}:nodes:${selectedNodeIds.join("\u0000")}:primary:${String(graph?.selectedNodeId || "")}`;
  }

function installGraphInspectorFocusGuard() {
    const host = dom.inspectorContent;
    if (
      !host ||
      host.dataset
        .rmlGraphFocusGuard === "true"
    ) {
      return;
    }
    host.dataset.rmlGraphFocusGuard =
      "true";
    host.addEventListener(
      "focusout",
      () => {
        queueMicrotask(() => {
          if (
            !graphInspectorRenderDeferred ||
            graphInspectorHasActiveEditor()
          ) {
            return;
          }
          graphInspectorRenderDeferred = false;
          renderGraphInspector({ force: true });
        });
      }
    );
  }

function renderGraphInspector(options = {}) {
    if (
      !graph.active ||
      !runtimeGraphViewActive ||
      !dom.inspectorContent
    ) {
      return;
    }

    installGraphInspectorFocusGuard();
    const selectionKey =
      graphInspectorSelectionKey();
    const selectionChanged =
      selectionKey !==
        graphInspectorRenderedSelectionKey;
    if (
      options.force !== true &&
      !selectionChanged &&
      graphInspectorHasActiveEditor()
    ) {
      graphInspectorRenderDeferred = true;
      return;
    }

    graphInspectorRenderDeferred = false;
    graphInspectorRenderedSelectionKey =
      selectionKey;

    dom.inspectorContent.replaceChildren();

    const root =
      document.createElement("div");
    root.className =
      "rml-graph-inspector";

    const selectedPoint =
      selectedWirePointReference();

    if (selectedPoint) {
      root.appendChild(
        wirePointInspectorCard(
          selectedPoint.connection,
          selectedPoint.point
        )
      );
      dom.inspectorContent.appendChild(root);
      return;
    }

    const connection =
      graph.connections.find(
        item =>
          item.id ===
          graph.selectedConnectionId
      );

    if (connection) {
      root.appendChild(
        connectionInspectorCard(
          connection
        )
      );
      dom.inspectorContent.appendChild(root);
      return;
    }

    const selectedNodeIds = [
      ...new Set(
        Array.isArray(graph.selectedNodeIds)
          ? graph.selectedNodeIds
          : []
      )
    ];
    if (selectedNodeIds.length > 1) {
      const selectedNodes =
        selectedNodeIds
          .map(id => findGraphNode(id))
          .filter(Boolean);
      const card =
        document.createElement("section");
      card.className =
        "rml-graph-inspector-card rml-api-composite-selection";
      const heading =
        document.createElement("h2");
      heading.textContent =
        `${selectedNodes.length.toLocaleString("de-DE")} nodes selected`;
      const copy =
        document.createElement("p");
      const allCompositeNodes =
        selectedNodes.length ===
          selectedNodeIds.length &&
        selectedNodes.every(node =>
          node.kind === "operator" &&
          apiCompositeInternalDefinitionAllowed(
            nodeDefinition(node)
          ) &&
          nodeDefinition(node)
            ?.unavailableApiContract !== true &&
          (
            nodeDefinition(node)
              ?.catalogGenerated !== true ||
            portableApiContractForNode(node)
          )
        );
      const includesCatalogNode =
        apiCompositeHasVerifiedCatalogNode(
          selectedNodes
        );
      copy.textContent =
        allCompositeNodes &&
        includesCatalogNode
          ? "The selection contains verified catalog API nodes plus only supported logic/value/flow nodes. Contracts, positions, ports and wire routes will be preserved."
          : "An API Composite requires at least one verified catalog API node; every other selected node must be a supported logic, value, conversion, math, flow or output node.";
      const actions =
        document.createElement("div");
      actions.className =
        "rml-graph-inspector-actions";
      const create = inspectorButton(
        "Create API Composite",
        createApiCompositeFromSelection,
        "primary"
      );
      const canCreateComposite =
        allCompositeNodes &&
        includesCatalogNode &&
        apiCompositeCatalogAvailable();
      setGraphButtonAvailability(
        create,
        canCreateComposite,
        "A verified catalog, at least one generated API node and otherwise only supported logic/value/flow nodes are required."
      );
      create.title = !canCreateComposite
        ? "Create API Composite — unavailable until the selection contains a verified catalog API node and otherwise only supported logic/value/flow nodes."
        : "Create API Composite — combine the selected API and logic nodes into one reversible composite node.";
      actions.appendChild(create);
      card.append(
        heading,
        copy,
        actions
      );
      root.appendChild(card);
      dom.inspectorContent.appendChild(root);
      return;
    }

    const node =
      findGraphNode(
        graph.selectedNodeId
      );

    if (!node) {
      const empty =
        document.createElement("div");
      empty.className =
        "empty-inspector";
      empty.innerHTML =
        `<span>⌁</span>
         <h2>Select a graph node, wire or route point</h2>
         <p>Typed ports, wire routing points and connection details appear here.</p>`;
      dom.inspectorContent.appendChild(
        empty
      );
      return;
    }

    root.appendChild(
      nodeInspectorCard(node)
    );
    dom.inspectorContent.appendChild(root);
    installInspectorOverflowSearch(root);
  }

function installInspectorOverflowSearch(root) {
    if (!root || !dom.inspectorContent) return;
    requestProjectAnimationFrame(() => {
      const host = dom.inspectorContent;
      const overflow = host.scrollHeight > host.clientHeight + 4;
      const existing = root.querySelector(":scope > .rml-graph-inspector-search");
      if (!overflow) {
        existing?.remove();
        return;
      }
      if (existing) return;

      const wrap = document.createElement("label");
      wrap.className = "rml-graph-inspector-search";
      wrap.textContent = "Search inspector";
      const input = document.createElement("input");
      input.type = "search";
      input.placeholder = "Filter visible inspector entries…";
      input.autocomplete = "off";
      wrap.appendChild(input);
      root.insertBefore(wrap, root.firstChild);

      const apply = () => {
        const query = input.value.trim().toLowerCase();
        const entries = root.querySelectorAll(
          ".rml-graph-inspector-card > label, .rml-graph-inspector-type-row, .rml-graph-display-value, .rml-graph-variadic-row, .rml-graph-code-editor-actions, .rml-graph-inspector-actions > button"
        );
        for (const entry of entries) {
          entry.hidden = Boolean(query) && !String(entry.textContent || "").toLowerCase().includes(query);
        }
      };
      input.addEventListener("input", apply);
    });
  }

function searchableSelectWrapper(
    select,
    optionEntries,
    currentValue,
    placeholder = "Search list…",
    forceSearch = false
  ) {
    if (
      !select ||
      !Array.isArray(optionEntries) ||
      optionEntries.length === 0
    ) {
      return select;
    }

    select._rmlGeneratedCustomSelect = true;

    const wrapper =
      document.createElement("div");
    wrapper.className =
      "rml-graph-searchable-select";

    select.classList.add(
      "rml-graph-searchable-native-select"
    );
    select.tabIndex = -1;
    select.setAttribute(
      "aria-hidden",
      "true"
    );

    const normalized = optionEntries.map(
      entry => ({
        value: String(entry.value ?? ""),
        text: String(entry.text ?? entry.value ?? "")
      })
    );

    const trigger =
      document.createElement("button");
    trigger.type = "button";
    trigger.className =
      "rml-graph-searchable-trigger";
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

    const popup =
      document.createElement("div");
    popup.className =
      "rml-graph-searchable-popup";
    popup.hidden = true;

    const search =
      document.createElement("input");
    search.type = "search";
    search.className =
      "rml-graph-searchable-search";
    search.placeholder = placeholder;
    search.autocomplete = "off";
    search.spellcheck = false;
    search.setAttribute(
      "aria-label",
      placeholder
    );
    search.hidden =
      forceSearch !== true &&
      normalized.length <=
        GRAPH_SEARCHABLE_LIST_THRESHOLD;

    const optionsHost =
      document.createElement("div");
    optionsHost.className =
      "rml-graph-searchable-options";
    optionsHost.setAttribute(
      "role",
      "listbox"
    );

    popup.append(
      search,
      optionsHost
    );

    let opened = false;
    let renderedButtons = [];

    const selectedValue = () =>
      String(
        currentValue?.() ??
        select.value ??
        ""
      );

    const selectedEntry = () => {
      const value = selectedValue();
      return (
        normalized.find(
          entry => entry.value === value
        ) ||
        normalized[0] ||
        {
          value: "",
          text: ""
        }
      );
    };

    const updateTriggerText = () => {
      const entry = selectedEntry();
      triggerText.textContent =
        entry.text || entry.value || "Select…";
      trigger.title =
        triggerText.textContent;
    };

    const positionPopup = () => {
      if (!opened) {
        return;
      }

      const rectangle =
        trigger.getBoundingClientRect();
      const viewportWidth =
        window.visualViewport?.width ||
        window.innerWidth;
      const viewportHeight =
        window.visualViewport?.height ||
        window.innerHeight;
      const viewportLeft =
        window.visualViewport?.offsetLeft ||
        0;
      const viewportTop =
        window.visualViewport?.offsetTop ||
        0;
      const margin = 8;
      const gap = 5;
      const desiredWidth =
        Math.max(
          rectangle.width,
          220
        );
      const width =
        Math.min(
          desiredWidth,
          Math.max(
            180,
            viewportWidth - margin * 2
          )
        );

      popup.dataset.rmlPopupWidth =
        String(width);

      window.RMLClassStyles?.sync(popup);
      const measuredHeight =
        popup.offsetHeight || 240;
      const spaceBelow =
        viewportTop +
        viewportHeight -
        rectangle.bottom -
        gap -
        margin;
      const spaceAbove =
        rectangle.top -
        viewportTop -
        gap -
        margin;
      const openAbove =
        spaceBelow <
          Math.min(measuredHeight, 220) &&
        spaceAbove > spaceBelow;

      const left =
        Math.min(
          viewportLeft +
            viewportWidth -
            width -
            margin,
          Math.max(
            viewportLeft + margin,
            rectangle.left
          )
        );

      const top = openAbove
        ? Math.max(
            viewportTop + margin,
            rectangle.top -
              measuredHeight -
              gap
          )
        : Math.min(
            viewportTop +
              viewportHeight -
              measuredHeight -
              margin,
            rectangle.bottom + gap
          );

      popup.dataset.rmlPopupLeft =
        String(Math.round(left));
      popup.dataset.rmlPopupTop =
        String(
          Math.round(
            Math.max(
              viewportTop + margin,
              top
            )
          )
        );
    };

    const focusSelectedOption = () => {
      const selected =
        renderedButtons.find(button =>
          button.classList.contains(
            "selected"
          )
        );
      const target =
        selected ||
        renderedButtons[0];

      target?.focus({
        preventScroll: true
      });
      target?.scrollIntoView({
        block: "nearest"
      });
    };

    const closePopup = (
      restoreTriggerFocus = false
    ) => {
      if (!opened) {
        return;
      }

      opened = false;
      wrapper.classList.remove(
        "open"
      );
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
        onWindowResize
      );
      window.visualViewport
        ?.removeEventListener(
          "resize",
          onWindowResize
        );
      wrapper.closest(".inspector")
        ?.removeEventListener(
          "scroll",
          onInspectorScroll
        );
      document.removeEventListener(
        "scroll",
        onRootScroll,
        true
      );
      window.removeEventListener(
        "scroll",
        onRootScroll,
        true
      );

      if (
        restoreTriggerFocus &&
        trigger.isConnected
      ) {
        trigger.focus({
          preventScroll: true
        });
      }
    };

    const choose = value => {
      const nextValue =
        String(value ?? "");
      const nextEntry =
        normalized.find(
          entry =>
            entry.value === nextValue
        );

      if (!nextEntry) {
        return;
      }

      if (
        !Array.from(
          select.options || []
        ).some(option =>
          option.value === nextValue
        )
      ) {
        const nativeOption =
          document.createElement("option");
        nativeOption.value =
          nextEntry.value;
        nativeOption.textContent =
          nextEntry.text;
        select.appendChild(
          nativeOption
        );
      }

      const changed =
        select.value !== nextValue;

      select.value = nextValue;

      if (changed) {
        select.dispatchEvent(
          new Event(
            "change",
            { bubbles: true }
          )
        );
      }

      updateTriggerText();
      closePopup(true);
    };

    const renderOptions = () => {
      const query =
        search.value
          .trim()
          .toLowerCase();
      const value =
        selectedValue();
      const allMatches = query
        ? normalized.filter(entry =>
            `${entry.text} ${entry.value}`
              .toLowerCase()
              .includes(query)
          )
        : normalized;
      let matches = allMatches;

      if (
        allMatches.length >
          GRAPH_SEARCHABLE_RENDER_LIMIT
      ) {
        matches = allMatches.slice(
          0,
          GRAPH_SEARCHABLE_RENDER_LIMIT
        );
        const selected =
          allMatches.find(entry =>
            entry.value === value
          );

        if (
          selected &&
          !matches.some(entry =>
            entry.value ===
              selected.value
          )
        ) {
          matches[
            matches.length - 1
          ] = selected;
        }
      }

      optionsHost.replaceChildren();
      renderedButtons = [];

      if (matches.length === 0) {
        const empty =
          document.createElement("div");
        empty.className =
          "rml-graph-searchable-empty";
        empty.textContent =
          "No matching entries";
        optionsHost.appendChild(empty);
        positionPopup();
        return;
      }

      for (const entry of matches) {
        const option =
          document.createElement(
            "button"
          );
        option.type = "button";
        option.className =
          "rml-graph-searchable-option";
        option.textContent =
          entry.text;
        option.title =
          entry.text;
        option.dataset.value =
          entry.value;
        option.setAttribute(
          "role",
          "option"
        );

        const selected =
          entry.value === value;
        option.classList.toggle(
          "selected",
          selected
        );
        option.setAttribute(
          "aria-selected",
          selected
            ? "true"
            : "false"
        );

        option.addEventListener(
          "click",
          event => {

            event.preventDefault();
            event.stopPropagation();

            const clickedOption =
              event.currentTarget;

            choose(
              clickedOption instanceof HTMLElement
                ? clickedOption.dataset.value
                : option.dataset.value
            );
          }
        );

        option.addEventListener(
          "keydown",
          event => {
            const index =
              renderedButtons.indexOf(
                option
              );

            if (
              event.key ===
                "ArrowDown" ||
              event.key ===
                "ArrowUp"
            ) {
              event.preventDefault();
              const direction =
                event.key ===
                  "ArrowDown"
                  ? 1
                  : -1;
              const next =
                renderedButtons[
                  Math.max(
                    0,
                    Math.min(
                      renderedButtons.length -
                        1,
                      index + direction
                    )
                  )
                ];
              next?.focus({
                preventScroll: true
              });
              next?.scrollIntoView({
                block: "nearest"
              });
            } else if (
              event.key === "Home"
            ) {
              event.preventDefault();
              renderedButtons[0]
                ?.focus({
                  preventScroll: true
                });
            } else if (
              event.key === "End"
            ) {
              event.preventDefault();
              renderedButtons[
                renderedButtons.length - 1
              ]?.focus({
                preventScroll: true
              });
            } else if (
              event.key === "Enter" ||
              event.key === " "
            ) {
              event.preventDefault();
              choose(entry.value);
            }
          }
        );

        renderedButtons.push(option);
        optionsHost.appendChild(option);
      }

      if (
        allMatches.length >
          matches.length
      ) {
        const remaining =
          document.createElement("div");
        remaining.className =
          "rml-graph-searchable-empty";
        remaining.textContent =
          `Showing ${matches.length.toLocaleString()} of ${allMatches.length.toLocaleString()} entries. Type to narrow the search.`;
        optionsHost.appendChild(
          remaining
        );
      }

      positionPopup();
    };

    const onDocumentPointerDown =
      event => {
        if (
          !wrapper.contains(
            event.target
          ) &&
          !popup.contains(
            event.target
          )
        ) {
          closePopup(false);
        }
      };

    const onWindowResize =
      () => positionPopup();

    const onInspectorScroll =
      () => closePopup(false);

    const onRootScroll = event => {

      if (
        event?.target instanceof Node &&
        popup.contains(event.target)
      ) {
        return;
      }

      closePopup(false);
    };

    const openPopup = (
      focusOptions = false
    ) => {
      if (opened) {
        return;
      }

      opened = true;
      wrapper.classList.add(
        "open"
      );
      trigger.setAttribute(
        "aria-expanded",
        "true"
      );
      search.value = "";
      popup.hidden = false;
      document.body.appendChild(
        popup
      );
      renderOptions();
      positionPopup();

      document.addEventListener(
        "pointerdown",
        onDocumentPointerDown,
        true
      );
      window.addEventListener(
        "resize",
        onWindowResize
      );
      window.visualViewport
        ?.addEventListener(
          "resize",
          onWindowResize
        );
      wrapper.closest(".inspector")
        ?.addEventListener(
          "scroll",
          onInspectorScroll,
          { passive: true }
        );
      document.addEventListener(
        "scroll",
        onRootScroll,
        { capture: true, passive: true }
      );
      window.addEventListener(
        "scroll",
        onRootScroll,
        { capture: true, passive: true }
      );

      requestProjectAnimationFrame(() => {
        positionPopup();

        if (
          focusOptions ||
          search.hidden
        ) {
          focusSelectedOption();
        } else {
          search.focus({
            preventScroll: true
          });
          search.select();
        }
      });
    };

    trigger.addEventListener(
      "click",
      () => {
        if (opened) {
          closePopup(false);
        } else {
          openPopup(false);
        }
      }
    );

    trigger.addEventListener(
      "keydown",
      event => {
        if (
          event.key ===
            "ArrowDown" ||
          event.key ===
            "ArrowUp"
        ) {
          event.preventDefault();
          if (!opened) {
            openPopup(true);
          } else {
            focusSelectedOption();
          }
        } else if (
          event.key === "Escape" &&
          opened
        ) {
          event.preventDefault();
          closePopup(true);
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
        if (
          event.key === "Escape"
        ) {
          event.preventDefault();
          closePopup(true);
        } else if (
          event.key ===
            "ArrowDown" ||
          event.key ===
            "ArrowUp"
        ) {
          event.preventDefault();

          if (
            renderedButtons.length === 0
          ) {
            return;
          }

          const target =
            event.key ===
              "ArrowDown"
              ? renderedButtons[0]
              : renderedButtons[
                  renderedButtons.length - 1
                ];
          target?.focus({
            preventScroll: true
          });
        } else if (
          event.key === "Enter" &&
          renderedButtons.length === 1
        ) {
          event.preventDefault();
          choose(
            renderedButtons[0]
              .dataset.value
          );
        }
      }
    );

    select.addEventListener(
      "change",
      updateTriggerText
    );

    updateTriggerText();
    wrapper.append(
      select,
      trigger
    );

    return wrapper;
  }

function searchableSuggestionWrapper(
    input,
    suggestions,
    placeholder = "Search list…"
  ) {
    if (
      !input ||
      !Array.isArray(suggestions) ||
      suggestions.length === 0
    ) {
      return input;
    }

    const normalized = [];
    const used = new Set();

    for (const suggestion of suggestions) {
      const value = String(
        typeof suggestion === "object" &&
        suggestion !== null
          ? suggestion.value ??
            suggestion.label ??
            ""
          : suggestion ?? ""
      ).trim();

      if (!value || used.has(value)) {
        continue;
      }

      used.add(value);
      normalized.push({
        value,
        text: String(
          typeof suggestion === "object" &&
          suggestion !== null &&
          suggestion.label
            ? suggestion.label
            : value
        )
      });
    }

    if (
      normalized.length <=
      GRAPH_SEARCHABLE_LIST_THRESHOLD
    ) {
      return input;
    }

    const select =
      document.createElement("select");

    for (const entry of normalized) {
      const option =
        document.createElement("option");
      option.value = entry.value;
      option.textContent = entry.text;
      select.appendChild(option);
    }

    const current =
      String(input.value || "").trim();

    if (
      current &&
      !normalized.some(
        entry => entry.value === current
      )
    ) {
      const currentOption =
        document.createElement("option");
      currentOption.value = current;
      currentOption.textContent = current;
      select.insertBefore(
        currentOption,
        select.firstChild
      );
    }

    select.value =
      current ||
      normalized[0]?.value ||
      "";

    const wrapper =
      searchableSelectWrapper(
        select,
        [
          ...(current &&
          !normalized.some(
            entry =>
              entry.value === current
          )
            ? [{
                value: current,
                text: current
              }]
            : []),
          ...normalized
        ],
        () => input.value,
        placeholder
      );

    if (
      wrapper === select
    ) {
      return input;
    }

    input.classList.add(
      "rml-graph-searchable-native-select"
    );
    input.tabIndex = -1;
    input.setAttribute(
      "aria-hidden",
      "true"
    );

    select.addEventListener(
      "change",
      () => {
        const nextValue =
          String(select.value || "");

        if (
          input.value === nextValue
        ) {
          return;
        }

        input.value = nextValue;
        input.dispatchEvent(
          new Event(
            "input",
            { bubbles: true }
          )
        );
        input.dispatchEvent(
          new Event(
            "change",
            { bubbles: true }
          )
        );
      }
    );

    input.addEventListener(
      "input",
      () => {
        const value =
          String(input.value || "");

        if (select.value !== value) {
          select.value = value;
        }
      }
    );

    wrapper.appendChild(input);
    return wrapper;
  }

function compatibilityPortRole(
    specification,
    direction
  ) {
    const explicit =
      String(
        specification?.role ||
        ""
      ).trim();

    if (explicit) {
      return explicit;
    }

    const id =
      String(
        specification?.id ||
        ""
      ).trim();
    const fixed = new Set([
      "call",
      "done",
      "success",
      "exception",
      "target",
      "result",
      "value"
    ]);

    if (fixed.has(id)) {
      return `${direction}:${id}`;
    }

    let match =
      id.match(/^arg(\d+)$/);
    if (match) {
      return `parameter:${match[1]}:input`;
    }

    match = id.match(/^out(\d+)$/);
    if (match) {
      return `parameter:${match[1]}:output`;
    }

    match = id.match(/^generic(\d+)$/);
    if (match) {
      return `generic:${match[1]}:input`;
    }

    return `port:${id}:${direction}`;
  }

function compatibilityContractPorts(
    definition,
    direction
  ) {
    const contract =
      definition?.preservedApiContract ||
      definition?.apiVerification ||
      null;
    const key =
      direction === "input"
        ? "inputPorts"
        : "outputPorts";
    const definitionPorts =
      direction === "input"
        ? definition?.inputs
        : definition?.outputs;
    const contractPorts =
      Array.isArray(contract?.[key])
        ? contract[key]
        : [];
    const byId = new Map(
      contractPorts.map(port => [
        String(port?.id || ""),
        port
      ])
    );

    return (
      Array.isArray(definitionPorts)
        ? definitionPorts
        : []
    ).map(port => {
      const stored =
        byId.get(
          String(port?.id || "")
        ) || {};

      return {
        ...port,
        ...stored,
        id: String(port?.id || stored?.id || ""),
        type: String(port?.type || stored?.type || "object"),
        role: compatibilityPortRole(
          {
            ...port,
            ...stored
          },
          direction
        ),
        optional:
          port?.optional === true ||
          stored?.optional === true
      };
    });
  }

let replacementCandidateIndexCache = null;

const replacementCandidateResultCache =
    new Map();

let replacementCandidateIndexBuilds = 0;

let replacementCandidateCacheHits = 0;

function replacementCandidateIndex() {
    const catalogFingerprint = String(
      window.RMLResoniteApiCatalog
        ?.catalogFingerprint || ""
    );
    const definitionRevision = Number(
      window.__RMLNodeDefinitionRevision || 0
    );
    const key = [
      integratedDefinitionRevision,
      definitionRevision,
      catalogFingerprint,
      Object.keys(
        OPERATOR_DEFINITIONS
      ).length
    ].join(":");

    if (
      replacementCandidateIndexCache?.key ===
        key
    ) {
      return replacementCandidateIndexCache;
    }

    const staticDescriptors = [];
    const dynamicEntries = [];
    const descriptorsByRole = new Map();
    const indexRole = (
      descriptor,
      direction,
      ports
    ) => {
      const keys = new Set(
        ports.map(port =>
          `${direction}:${String(
            port?.role || ""
          )}`
        )
      );
      for (const roleKey of keys) {
        if (!descriptorsByRole.has(roleKey)) {
          descriptorsByRole.set(
            roleKey,
            []
          );
        }
        descriptorsByRole
          .get(roleKey)
          .push(descriptor);
      }
    };

    for (const [operatorId, definition] of
      Object.entries(
        OPERATOR_DEFINITIONS
      )) {
      if (
        definition?.unavailableApiContract === true ||
        definition?.legacyCatalogAlias === true
      ) {
        continue;
      }

      if (
        typeof definition?.resolveDefinition ===
          "function"
      ) {
        dynamicEntries.push({
          operatorId,
          definition
        });
        continue;
      }

      const descriptor = {
        operatorId,
        definition,
        resolvedDefinition: definition,
        catalogGenerated:
          definition?.catalogGenerated === true,
        inputs:
          compatibilityContractPorts(
            definition,
            "input"
          ),
        outputs:
          compatibilityContractPorts(
            definition,
            "output"
          )
      };
      staticDescriptors.push(descriptor);
      indexRole(
        descriptor,
        "input",
        descriptor.inputs
      );
      indexRole(
        descriptor,
        "output",
        descriptor.outputs
      );
    }

    replacementCandidateResultCache.clear();
    replacementCandidateIndexBuilds += 1;
    replacementCandidateIndexCache = {
      key,
      staticDescriptors,
      dynamicEntries,
      descriptorsByRole
    };
    return replacementCandidateIndexCache;
  }

function replacementCandidateCacheKey(
    indexKey,
    oldInputs,
    oldOutputs,
    options
  ) {
    return JSON.stringify({
      indexKey,
      catalogGeneratedOnly:
        options.catalogGeneratedOnly === true,
      requireResoniteCatalog:
        options.requireResoniteCatalog === true,
      matchMode:
        String(options.matchMode || "strict"),
      candidateParameters:
        stableIntegratedContractValue(
          options.candidateParameters || {}
        ),
      replacementIdentity:
        stableIntegratedContractValue(
          options.replacementIdentity || {}
        ),
      inputs:
        stableIntegratedContractValue(
          oldInputs
        ),
      outputs:
        stableIntegratedContractValue(
          oldOutputs
        )
    });
  }

function unavailableReplacementCandidates(
    unavailableDefinition,
    {
      catalogGeneratedOnly = true,
      requireResoniteCatalog = true,
      candidateParameters = {}
    } = {}
  ) {
    if (
      unavailableDefinition?.unavailableApiContract !== true ||
      (
        requireResoniteCatalog &&
        !window.RMLResoniteApiCatalog
      )
    ) {
      return [];
    }

    const oldInputs =
      compatibilityContractPorts(
        unavailableDefinition,
        "input"
      );
    const oldOutputs =
      compatibilityContractPorts(
        unavailableDefinition,
        "output"
      );
    const candidateIndex =
      replacementCandidateIndex();
    const cacheKey =
      replacementCandidateCacheKey(
        candidateIndex.key,
        oldInputs,
        oldOutputs,
        {
          catalogGeneratedOnly,
          requireResoniteCatalog,
          candidateParameters
        }
      );
    const cachedCandidates =
      replacementCandidateResultCache.get(
        cacheKey
      );
    if (cachedCandidates) {
      replacementCandidateCacheHits += 1;
      return cachedCandidates.map(
        candidate => ({
          ...candidate,
          inputMap: {
            ...candidate.inputMap
          },
          outputMap: {
            ...candidate.outputMap
          }
        })
      );
    }
    const candidates = [];
    const requiredRoleKeys = [
      ...oldInputs.map(port =>
        `input:${String(
          port?.role || ""
        )}`
      ),
      ...oldOutputs.map(port =>
        `output:${String(
          port?.role || ""
        )}`
      )
    ];
    const indexedPools =
      requiredRoleKeys
        .map(roleKey =>
          candidateIndex.descriptorsByRole
            .get(roleKey) || []
        )
        .sort((left, right) =>
          left.length - right.length
        );
    const staticPool =
      indexedPools.length > 0
        ? indexedPools[0]
        : candidateIndex.staticDescriptors;
    const descriptors = staticPool
      .filter(descriptor =>
        !catalogGeneratedOnly ||
        descriptor.catalogGenerated === true
      );

    for (const entry of
      candidateIndex.dynamicEntries) {
      if (
        catalogGeneratedOnly &&
        entry.definition
          ?.catalogGenerated !== true
      ) {
        continue;
      }
      const resolvedDefinition =
        resolveNodeDefinition({
          kind: "operator",
          operatorId:
            entry.operatorId,
          parameters:
            nodeGraphClone(
              candidateParameters || {}
            )
        });
      descriptors.push({
        operatorId:
          entry.operatorId,
        definition:
          entry.definition,
        resolvedDefinition,
        catalogGenerated:
          entry.definition
            ?.catalogGenerated === true,
        inputs:
          compatibilityContractPorts(
            resolvedDefinition,
            "input"
          ),
        outputs:
          compatibilityContractPorts(
            resolvedDefinition,
            "output"
          )
      });
    }

    for (const descriptor of
      descriptors) {
      const operatorId =
        descriptor.operatorId;
      const candidate =
        descriptor.definition;
      const resolvedCandidate =
        descriptor.resolvedDefinition;
      const candidateInputs =
        descriptor.inputs;
      const candidateOutputs =
        descriptor.outputs;
      const inputMap = {};
      const outputMap = {};
      const usedInputs = new Set();
      const usedOutputs = new Set();

      const matchPorts = (
        oldPorts,
        newPorts,
        used,
        target,
        direction
      ) => {
        for (const oldPort of oldPorts) {
          const matches =
            newPorts.filter(newPort => {
              if (
                used.has(newPort.id) ||
                newPort.role !== oldPort.role
              ) {
                return false;
              }

              return direction === "input"
                ? connectionTypesCompatible(
                    oldPort.type,
                    newPort.type
                  )
                : connectionTypesCompatible(
                    newPort.type,
                    oldPort.type
                  );
            });

          if (matches.length !== 1) {
            return false;
          }

          used.add(matches[0].id);
          target[oldPort.id] =
            matches[0].id;
        }

        return true;
      };

      if (
        !matchPorts(
          oldInputs,
          candidateInputs,
          usedInputs,
          inputMap,
          "input"
        ) ||
        !matchPorts(
          oldOutputs,
          candidateOutputs,
          usedOutputs,
          outputMap,
          "output"
        ) ||
        candidateInputs.some(port =>
          !usedInputs.has(port.id) &&
          port.optional !== true
        )
      ) {
        continue;
      }

      candidates.push({
        operatorId,
        title:
          String(
            resolvedCandidate?.title ||
            candidate.title ||
            operatorId
          ),
        symbol:
          String(
            resolvedCandidate?.symbol ||
            candidate.symbol ||
            "API"
          ),
        group:
          String(
            resolvedCandidate?.group ||
            candidate.group ||
            "Resonite API"
          ),
        description:
          String(
            resolvedCandidate
              ?.description ||
            candidate.description || ""
          ),
        paletteIcon:
          nodePaletteIconDescriptor(
            resolvedCandidate ||
              candidate
          ),
        apiContract:
          nodeGraphClone(
            resolvedCandidate
              ?.apiVerification ||
            candidate?.apiVerification ||
            {}
          ),
        inputMap,
        outputMap
      });
    }

    const sortedCandidates =
      candidates.sort((left, right) =>
      left.title.localeCompare(
        right.title,
        undefined,
        { sensitivity: "base" }
      )
    );
    replacementCandidateResultCache.set(
      cacheKey,
      sortedCandidates.map(candidate => ({
        ...candidate,
        inputMap: {
          ...candidate.inputMap
        },
        outputMap: {
          ...candidate.outputMap
        }
      }))
    );
    if (
      replacementCandidateResultCache.size >
        64
    ) {
      replacementCandidateResultCache.delete(
        replacementCandidateResultCache
          .keys()
          .next().value
      );
    }
    return sortedCandidates;
  }

function manualReplacementTokens(value) {
    const words = String(value || "")
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .toLocaleLowerCase()
      .split(/[^a-z0-9]+/)
      .filter(word =>
        word.length > 1 &&
        ![
          "api",
          "resonite",
          "frooxengine",
          "system",
          "call",
          "static",
          "node"
        ].includes(word)
      );
    const synonyms = Object.freeze({
      add: ["attach", "create", "new", "insert"],
      attach: ["add", "create"],
      create: ["add", "attach", "new"],
      destroy: ["delete", "remove"],
      delete: ["destroy", "remove"],
      find: ["get", "search", "lookup"],
      get: ["find", "read"],
      read: ["get"],
      write: ["set"],
      set: ["write"],
      valid: ["check", "null", "exists"],
      validity: ["valid", "check", "null"],
      blendmode: ["blend", "mode"]
    });
    const result = new Set(words);
    for (const word of words) {
      for (const synonym of
        Object.prototype.hasOwnProperty.call(
          synonyms,
          word
        )
          ? synonyms[word]
          : []) {
        result.add(synonym);
      }
    }
    return result;
  }

function manualReplacementIdentityProof(
    requirement,
    candidate
  ) {
    const normalizeType = value =>
      String(value || "System.Object")
        .replace(/^global::/, "")
        .replace(/\s+/g, "")
        .replace(/&$/, "");
    const semanticKey = contract => {
      if (
        !contract ||
        typeof contract !== "object" ||
        Array.isArray(contract) ||
        !String(contract.ownerType || "").trim() ||
        !String(contract.kind || "").trim()
      ) {
        return "";
      }
      return JSON.stringify({
        kind: String(contract.kind),
        ownerType:
          normalizeType(contract.ownerType),
        memberName:
          String(contract.memberName || ""),
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
                parameter?.isByRef === true ||
                parameter?.isOut === true,
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
    };
    const sourceContract =
      requirement?.apiContract;
    const candidateContract =
      candidate?.apiContract ||
      candidate?.apiVerification ||
      null;
    const sourceSemanticKey =
      semanticKey(sourceContract);
    const candidateSemanticKey =
      semanticKey(candidateContract);
    const exactSemanticContract = Boolean(
      sourceSemanticKey &&
      sourceSemanticKey ===
        candidateSemanticKey
    );
    const literalLabelTokens = new Set(
      (Array.isArray(requirement?.nodeLabels)
        ? requirement.nodeLabels
        : [])
        .flatMap(label =>
          String(label || "")
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .toLocaleLowerCase()
            .split(/[^a-z0-9]+/)
            .filter(Boolean)
        )
    );
    const candidateMemberName = String(
      candidateContract?.memberName ||
      candidate?.catalogMember ||
      ""
    ).trim();
    const normalizedMemberName =
      candidateMemberName
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .toLocaleLowerCase()
        .split(/[^a-z0-9]+/)
        .filter(Boolean);
    const exactOperationName = Boolean(
      normalizedMemberName.length > 0 &&
      normalizedMemberName.every(token =>
        literalLabelTokens.has(token)
      )
    );
    const requiredOperatorId = String(
      requirement?.operatorId || ""
    );
    const requiredKind =
      requiredOperatorId.startsWith(
        "api.method."
      )
        ? "method"
        : requiredOperatorId.startsWith(
              "api.ctor."
            )
          ? "constructor"
          : requiredOperatorId.startsWith(
                "api.property.get."
              )
            ? "property-get"
            : requiredOperatorId.startsWith(
                  "api.property.set."
                )
              ? "property-set"
              : requiredOperatorId.startsWith(
                    "api.field.get."
                  )
                ? "field-get"
                : requiredOperatorId.startsWith(
                      "api.field.set."
                    )
                  ? "field-set"
                  : requiredOperatorId.startsWith(
                        "api.event."
                      )
                    ? "event"
                    : "";
    const candidateKind = String(
      candidateContract?.kind ||
      candidate?.apiMemberKind ||
      ""
    );
    const kindMatches =
      !requiredKind ||
      candidateKind === requiredKind;
    const provenByName = Boolean(
      !sourceSemanticKey &&
      exactOperationName &&
      kindMatches
    );

    return Object.freeze({
      matchedTokens:
        exactSemanticContract
          ? 100
          : provenByName
            ? normalizedMemberName.length
            : 0,
      exactOperationName,
      exactSemanticContract,
      mode:
        exactSemanticContract
          ? "exact-contract"
          : provenByName
            ? "exact-name"
            : "none",
      score:
        exactSemanticContract
          ? 100000
          : provenByName
            ? 10000
            : 0,
      proven:
        exactSemanticContract ||
        provenByName
    });
  }

function manualReplacementPortFamily(
    specification,
    direction
  ) {
    const id = String(
      specification?.id || ""
    ).toLocaleLowerCase();
    const role = String(
      specification?.role || ""
    ).toLocaleLowerCase();
    const combined = `${id} ${role}`;

    if (
      [
        "call",
        "done",
        "success",
        "exception"
      ].includes(id)
    ) {
      return id;
    }
    if (/generic:\d+/.test(role)) {
      return "generic";
    }
    if (/parameter:\d+/.test(role)) {
      return "parameter";
    }
    if (
      /(?:^|\s|:)(?:target|parent|root|slot|component|owner|instance|object|source)(?:$|\s|:)/
        .test(combined)
    ) {
      return direction === "input"
        ? "target"
        : "result";
    }
    if (
      /(?:^|\s|:)(?:result|value|item|found|valid)(?:$|\s|:)/
        .test(combined)
    ) {
      return direction === "output"
        ? "result"
        : "parameter";
    }
    return "parameter";
  }

function manualReplacementTypesCompatible(
    oldPort,
    newPort,
    direction
  ) {
    const oldType = String(
      oldPort?.type || "object"
    );
    const newType = String(
      newPort?.type || "object"
    );
    const oldImpulse =
      oldType === "impulse";
    const newImpulse =
      newType === "impulse";

    if (oldImpulse || newImpulse) {
      return oldImpulse && newImpulse;
    }
    if (
      oldType === "object" ||
      newType === "object"
    ) {
      return true;
    }

    return direction === "input"
      ? connectionTypesCompatible(
          oldType,
          newType
        )
      : connectionTypesCompatible(
          newType,
          oldType
        );
  }

function manualReplacementPortScore(
    oldPort,
    newPort,
    direction
  ) {
    if (
      !manualReplacementTypesCompatible(
        oldPort,
        newPort,
        direction
      )
    ) {
      return -1;
    }

    const oldId = String(
      oldPort?.id || ""
    ).toLocaleLowerCase();
    const newId = String(
      newPort?.id || ""
    ).toLocaleLowerCase();
    const oldRole = String(
      oldPort?.role || ""
    );
    const newRole = String(
      newPort?.role || ""
    );
    const oldFamily =
      manualReplacementPortFamily(
        oldPort,
        direction
      );
    const newFamily =
      manualReplacementPortFamily(
        newPort,
        direction
      );
    const fixedFlow = new Set([
      "call",
      "done",
      "success",
      "exception"
    ]);

    if (
      fixedFlow.has(oldFamily) ||
      fixedFlow.has(newFamily)
    ) {
      return oldFamily === newFamily
        ? 500
        : -1;
    }

    let score = 0;
    if (oldId && oldId === newId) {
      score += 420;
    }
    if (oldRole && oldRole === newRole) {
      score += 360;
    }
    if (oldFamily === newFamily) {
      score += 170;
    } else if (
      [oldFamily, newFamily]
        .every(family =>
          ["target", "parameter"].includes(
            family
          )
        )
    ) {
      score += 45;
    } else {
      return -1;
    }

    const oldTokens =
      manualReplacementTokens(
        `${oldId} ${oldPort?.label || ""}`
      );
    const newTokens =
      manualReplacementTokens(
        `${newId} ${newPort?.label || ""}`
      );
    for (const token of oldTokens) {
      if (newTokens.has(token)) {
        score += 85;
      }
    }

    const oldType = String(
      oldPort?.type || "object"
    );
    const newType = String(
      newPort?.type || "object"
    );
    if (
      oldType !== "object" &&
      oldType === newType
    ) {
      score += 110;
    }
    return score;
  }

function manualReplacementPortMapping(
    oldPorts,
    newPorts,
    direction
  ) {
    if (oldPorts.length > newPorts.length) {
      return null;
    }

    const options = oldPorts.map(
      oldPort => ({
        oldPort,
        matches: newPorts
          .map(newPort => ({
            newPort,
            score:
              manualReplacementPortScore(
                oldPort,
                newPort,
                direction
              )
          }))
          .filter(match =>
            match.score >= 0
          )
          .sort((left, right) =>
            right.score - left.score ||
            String(left.newPort.id)
              .localeCompare(
                String(right.newPort.id)
              )
          )
          .slice(0, 8)
      })
    ).sort((left, right) =>
      left.matches.length -
        right.matches.length
    );

    if (options.some(option =>
      option.matches.length === 0
    )) {
      return null;
    }

    let best = null;
    const visit = (
      optionIndex,
      used,
      mapping,
      score
    ) => {
      if (optionIndex >= options.length) {
        if (!best || score > best.score) {
          best = {
            score,
            mapping: {
              ...mapping
            },
            used: new Set(used)
          };
        }
        return;
      }

      const option = options[optionIndex];
      for (const match of option.matches) {
        const newId = String(
          match.newPort.id || ""
        );
        if (used.has(newId)) {
          continue;
        }
        used.add(newId);
        mapping[
          String(option.oldPort.id || "")
        ] = newId;
        visit(
          optionIndex + 1,
          used,
          mapping,
          score + match.score
        );
        delete mapping[
          String(option.oldPort.id || "")
        ];
        used.delete(newId);
      }
    };
    visit(0, new Set(), {}, 0);
    return best;
  }

function manualStructuralReplacementCandidates(
    unavailableDefinition,
    requirement,
    {
      catalogGeneratedOnly = true,
      requireResoniteCatalog = true,
      candidateParameters = {}
    } = {}
  ) {
    if (
      unavailableDefinition?.unavailableApiContract !== true ||
      (
        requireResoniteCatalog &&
        !window.RMLResoniteApiCatalog
      )
    ) {
      return [];
    }

    const oldInputs =
      compatibilityContractPorts(
        unavailableDefinition,
        "input"
      );
    const oldOutputs =
      compatibilityContractPorts(
        unavailableDefinition,
        "output"
      );
    const candidateIndex =
      replacementCandidateIndex();
    const cacheKey =
      replacementCandidateCacheKey(
        candidateIndex.key,
        oldInputs,
        oldOutputs,
        {
          catalogGeneratedOnly,
          requireResoniteCatalog,
          candidateParameters,
          matchMode:
            "manual-structural",
          replacementIdentity: {
            operatorId:
              String(
                requirement?.operatorId || ""
              ),
            apiContract:
              requirement?.apiContract || null,
            nodeLabels:
              Array.isArray(
                requirement?.nodeLabels
              )
                ? requirement.nodeLabels
                : []
          }
        }
      );
    const cached =
      replacementCandidateResultCache.get(
        cacheKey
      );
    if (cached) {
      replacementCandidateCacheHits += 1;
      return cached.map(candidate => ({
        ...candidate,
        inputMap: {
          ...candidate.inputMap
        },
        outputMap: {
          ...candidate.outputMap
        },
        unmappedRequiredInputs: [
          ...(candidate
            .unmappedRequiredInputs || [])
        ]
      }));
    }

    const descriptors =
      candidateIndex.staticDescriptors
        .filter(descriptor =>
          !catalogGeneratedOnly ||
          descriptor.catalogGenerated ===
            true
        );
    for (const entry of
      candidateIndex.dynamicEntries) {
      if (
        catalogGeneratedOnly &&
        entry.definition
          ?.catalogGenerated !== true
      ) {
        continue;
      }
      const resolvedDefinition =
        resolveNodeDefinition({
          kind: "operator",
          operatorId: entry.operatorId,
          parameters:
            nodeGraphClone(
              candidateParameters || {}
            )
        });
      descriptors.push({
        operatorId: entry.operatorId,
        definition: entry.definition,
        resolvedDefinition,
        catalogGenerated:
          entry.definition
            ?.catalogGenerated === true,
        inputs:
          compatibilityContractPorts(
            resolvedDefinition,
            "input"
          ),
        outputs:
          compatibilityContractPorts(
            resolvedDefinition,
            "output"
          )
      });
    }

    const candidates = [];

    for (const descriptor of
      descriptors) {
      const inputMatch =
        manualReplacementPortMapping(
          oldInputs,
          descriptor.inputs,
          "input"
        );
      if (!inputMatch) {
        continue;
      }
      const outputMatch =
        manualReplacementPortMapping(
          oldOutputs,
          descriptor.outputs,
          "output"
        );
      if (!outputMatch) {
        continue;
      }

      const candidate =
        descriptor.definition;
      const resolvedCandidate =
        descriptor.resolvedDefinition;
      const identityProof =
        manualReplacementIdentityProof(
          requirement,
          {
            ...candidate,
            ...resolvedCandidate,
            operatorId:
              descriptor.operatorId,
            title:
              resolvedCandidate?.title ||
              candidate?.title,
            description:
              resolvedCandidate
                ?.description ||
              candidate?.description,
            group:
              resolvedCandidate?.group ||
              candidate?.group
          }
        );
      const identityScore =
        identityProof.score;
      const unmappedRequiredInputs =
        descriptor.inputs
          .filter(port =>
            port.optional !== true &&
            !inputMatch.used.has(
              String(port.id || "")
            )
          )
          .map(port => ({
            id: String(port.id || ""),
            label: String(
              port.label || port.id || ""
            ),
            type: String(
              port.type || "object"
            )
          }));
      const score =
        identityScore +
        inputMatch.score +
        outputMatch.score -
        160 *
          unmappedRequiredInputs.length -
        5 * Math.max(
          0,
          descriptor.outputs.length -
            oldOutputs.length
        );

      if (
        !identityProof.proven ||
        unmappedRequiredInputs.length > 0
      ) {
        continue;
      }

      candidates.push({
        operatorId:
          descriptor.operatorId,
        title: String(
          resolvedCandidate?.title ||
          candidate?.title ||
          descriptor.operatorId
        ),
        symbol: String(
          resolvedCandidate?.symbol ||
          candidate?.symbol ||
          "API"
        ),
        group: String(
          resolvedCandidate?.group ||
          candidate?.group ||
          "Resonite API"
        ),
        description: String(
          resolvedCandidate?.description ||
          candidate?.description || ""
        ),
        paletteIcon:
          nodePaletteIconDescriptor(
            resolvedCandidate ||
              candidate
          ),
        inputMap:
          inputMatch.mapping,
        outputMap:
          outputMatch.mapping,
        matchMode:
          "manual-structural",
        identityScore,
        identityMatchedTokens:
          identityProof.matchedTokens,
        exactOperationName:
          identityProof
            .exactOperationName,
        semanticProof:
          identityProof.mode,
        score,
        unmappedRequiredInputs
      });
    }

    const sorted = candidates
      .sort((left, right) =>
        right.score - left.score ||
        left.unmappedRequiredInputs.length -
          right.unmappedRequiredInputs.length ||
        left.title.localeCompare(
          right.title,
          undefined,
          { sensitivity: "base" }
        )
      );
    replacementCandidateResultCache.set(
      cacheKey,
      sorted.map(candidate => ({
        ...candidate,
        inputMap: {
          ...candidate.inputMap
        },
        outputMap: {
          ...candidate.outputMap
        },
        unmappedRequiredInputs: [
          ...candidate
            .unmappedRequiredInputs
        ]
      }))
    );
    if (
      replacementCandidateResultCache.size >
        64
    ) {
      replacementCandidateResultCache.delete(
        replacementCandidateResultCache
          .keys().next().value
      );
    }
    return sorted;
  }

function genericMissingCatalogDefinition(
    requirement = {}
  ) {
    const contract =
      requirement?.apiContract &&
      typeof requirement.apiContract ===
        "object" &&
      !Array.isArray(
        requirement.apiContract
      )
        ? nodeGraphClone(
            requirement.apiContract
          )
        : {};
    const buildPorts = direction => {
      const key =
        direction === "input"
          ? "inputPorts"
          : "outputPorts";
      const referenced =
        direction === "input"
          ? requirement?.inputPorts
          : requirement?.outputPorts;
      const stored =
        Array.isArray(contract[key])
          ? contract[key]
          : [];
      const byId =
        new Map(
          stored
            .filter(port =>
              String(
                port?.id || ""
              )
            )
            .map(port => [
              String(port.id),
              nodeGraphClone(port)
            ])
        );

      for (const value of
        Array.isArray(referenced)
          ? referenced
          : []) {
        const id = String(
          value || ""
        );
        if (!id || byId.has(id)) {
          continue;
        }
        const type =
          [
            "call",
            "done",
            "true",
            "false",
            "reset"
          ].includes(id)
            ? "impulse"
            : id === "success"
              ? "bool"
              : id === "exception"
                ? "exception"
                : "object";
        byId.set(id, {
          id,
          label: id,
          type,
          optional: false,
          role:
            compatibilityPortRole(
              { id },
              direction
            )
        });
      }

      return [...byId.values()]
        .map(port => ({
          ...port,
          id:
            String(port.id || ""),
          type:
            String(
              port.type || "object"
            ),
          role:
            String(
              port.role ||
              compatibilityPortRole(
                port,
                direction
              )
            )
        }));
    };
    const inputs =
      buildPorts("input");
    const outputs =
      buildPorts("output");

    return {
      unavailableApiContract: true,
      preservedApiContract: {
        ...contract,
        inputPorts:
          inputs.map(port => ({
            ...port
          })),
        outputPorts:
          outputs.map(port => ({
            ...port
          }))
      },
      inputs,
      outputs
    };
  }

function compatibleImportReplacementCandidates(
    requirement = {}
  ) {
    const operatorId = String(
      requirement?.operatorId || ""
    ).trim();
    const allCatalogObjects =
      requirement?.catalogScope ===
        "all";
    const controller =
      window.RMLApiNodeFactoryController;
    const unavailableOperatorId =
      allCatalogObjects
        ? ""
        : controller
            ?.ensureUnavailableOperator?.(
              operatorId,
              requirement?.apiContract,
              requirement
            ) || "";
    const unavailableDefinition =
      allCatalogObjects
        ? genericMissingCatalogDefinition(
            requirement
          )
        : OPERATOR_DEFINITIONS[
            unavailableOperatorId
          ];
    let candidates =
      unavailableReplacementCandidates(
        unavailableDefinition,
        {
          catalogGeneratedOnly: true,
          requireResoniteCatalog: true,
          candidateParameters:
            requirement
              ?.nodeParameters || {}
        }
      );
    let matchMode = "strict";
    candidates = candidates
      .map(candidate => ({
        ...candidate,
        identityProof:
          manualReplacementIdentityProof(
            requirement,
            candidate
          )
      }))
      .filter(candidate =>
        candidate.identityProof.proven
      )
      .map(candidate => ({
        ...candidate,
        semanticProof:
          candidate.identityProof.mode
      }));
    if (candidates.length === 0) {
      candidates =
        manualStructuralReplacementCandidates(
          unavailableDefinition,
          requirement,
          {
            catalogGeneratedOnly: true,
            requireResoniteCatalog: true,
            candidateParameters:
              requirement
                ?.nodeParameters || {}
          }
        );
      matchMode = "manual-structural";
    }
    candidates = candidates.map(candidate =>
        Object.freeze({
          operatorId:
            candidate.operatorId,
          title: candidate.title,
          symbol: candidate.symbol,
          group: candidate.group,
          description:
            candidate.description,
          paletteIcon:
            Object.freeze({
              ...(
                candidate.paletteIcon ||
                nodePaletteIconDescriptor({
                  symbol:
                    candidate.symbol
                })
              )
            }),
          matchMode:
            String(
              candidate.matchMode ||
              matchMode
            ),
          score:
            Number(candidate.score) || 0,
          semanticProof:
            String(
              candidate.semanticProof ||
              "none"
            ),
          unmappedRequiredInputs:
            Object.freeze(
              (Array.isArray(
                candidate
                  .unmappedRequiredInputs
              )
                ? candidate
                    .unmappedRequiredInputs
                : [])
                .map(port =>
                  Object.freeze({
                    ...port
                  })
                )
            ),
          inputMap:
            Object.freeze({
              ...candidate.inputMap
            }),
          outputMap:
            Object.freeze({
              ...candidate.outputMap
            })
        })
      );

    return Object.freeze({
      operatorId,
      unavailableOperatorId:
        String(
          unavailableOperatorId || ""
        ),
      matchMode,
      candidates:
        Object.freeze(candidates)
    });
  }

function nodeInspectorCard(node) {
    const definition =
      nodeDefinition(node);
    const card =
      document.createElement("section");
    card.className =
      "rml-graph-inspector-card";

    const heading =
      document.createElement("h3");
    heading.textContent =
      node.label ||
      definition.title;

    const description =
      document.createElement("p");
    description.textContent =
      definition.description || "";

    card.append(
      heading,
      description
    );

    if (
      definition?.unavailableApiContract === true
    ) {
      const notice =
        document.createElement("p");
      notice.className =
        "rml-graph-unavailable-notice";
      notice.textContent =
        "This preserved node cannot execute with the current catalog. Replacement choices are intentionally available only before a JSON import is installed; this inspector never changes the node contract.";
      card.appendChild(notice);
    }

    if (
      definition?.displaysValue ||
      definition?.displaysImpulse
    ) {
      const presentation =
        runtimeMonitorPresentation(
          node
        );
      const live =
        document.createElement("div");
      live.className =
        `rml-graph-display-value${
          presentation.live
            ? " live-runtime"
            : ""
        }${
          presentation.known
            ? ""
            : " unknown"
        }${
          presentation.multiline
            ? " multiline"
            : ""
        }`;
      live.dataset
        .runtimeMonitorId =
        node.id;
      const liveLabel =
        document.createElement("span");
      liveLabel.textContent =
        presentation.label;
      const liveOutput =
        document.createElement("output");
      liveOutput.textContent =
        presentation.text;
      liveOutput.title =
        presentation.title ||
        presentation.text;
      live.title =
        presentation.title || "";
      live.append(
        liveLabel,
        liveOutput
      );
      card.appendChild(live);
    }

    if (node.kind === "operator") {
      const label =
        document.createElement("label");
      label.textContent =
        "Custom node label";
      const input =
        document.createElement("input");
      input.value =
        node.label || "";
      input.placeholder =
        definition.title;
      input.addEventListener(
        "input",
        () => {
          node.label =
            input.value.slice(0, 120);
          const title =
            dom.nodesHost?.querySelector(
              `[data-graph-node-id="${CSS.escape(node.id)}"] .rml-graph-node-title strong`
            );
          if (title) {
            title.textContent =
              node.label ||
              definition.title;
          }
          scheduleRenderedNodeResizeLimitRefresh();
          persistGraph();
        }
      );
      label.appendChild(input);
      card.appendChild(label);
    }

    if (
      definition.configurableTypeVar
    ) {
      const label =
        document.createElement("label");
      label.textContent =
        definition.typeSelectorLabel ||
        "Generic value type";
      const select =
        document.createElement("select");
      const typeOptions = [];

      if (
        definitionAllowsAutoType(
          definition
        )
      ) {
        const automatic =
          document.createElement(
            "option"
          );
        automatic.value = "auto";
        automatic.textContent =
          "Auto · infer safely from wires";
        automatic.selected =
          node.parameters.valueType ===
            "auto";
        select.appendChild(
          automatic
        );
        typeOptions.push({
          value: "auto",
          text: "Auto · infer safely from wires"
        });
      }

      for (
        const type of
        definition.configurableTypes ||
        VALUE_TYPES
      ) {
        const option =
          document.createElement("option");
        option.value = type;
        option.textContent =
          typeLabel(type);
        option.selected =
          node.parameters.valueType ===
          type;
        select.appendChild(option);
        typeOptions.push({
          value: type,
          text: typeLabel(type)
        });
      }

      select.addEventListener(
        "change",
        () => {
          node.parameters.valueType =
            select.value;
          normalizeGraphNodeParameters(
            node,
            OPERATOR_DEFINITIONS[
              node.operatorId
            ] || definition
          );
          pruneConnections();
          persistGraph(true);
          renderGraphNodesAndWires();
          renderGraphInspector();
          showGraphMessage(
            "Node type updated. Incompatible wires were removed.",
            "success"
          );
        }
      );
      label.appendChild(
        searchableSelectWrapper(
          select,
          typeOptions,
          () => node.parameters.valueType,
          "Search generic value types…"
        )
      );
      card.appendChild(label);

      if (
        node.parameters.valueType ===
          "auto"
      ) {
        const automaticStatus =
          document.createElement("small");
        automaticStatus.className =
          "rml-graph-auto-type-status";
        const analysis =
          currentAnalysis ||
          analyzeConnections(
            graph.connections
          );
        let resolved;

        if (
          isAutoVectorOperator(node)
        ) {
          resolved =
            effectiveAutoVectorType(
              node
            );
        } else {
          resolved =
            analysis.bindings
              .get(node.id)?.[
                definition
                  .configurableTypeVar
              ] || null;
        }

        automaticStatus.textContent =
          resolved
            ? `Currently resolved as ${typeLabel(resolved)}.`
            : "Waiting for compatible wire evidence.";
        card.appendChild(
          automaticStatus
        );
      }
    }

    appendParameterControl(
      card,
      node,
      definition
    );

    if (definition.variadicInputs || definition.variadicOutputs) {
      const variadic = document.createElement("div");
      variadic.className = "rml-graph-variadic-controls";

      const addControl = (direction, descriptor) => {
        if (!descriptor) return;
        const key = direction === "input"
          ? "variadicInputCount"
          : "variadicOutputCount";
        const count = variadicCount(node, direction, descriptor);
        const minimum = Math.max(2, Number(descriptor.minimum) || 2);
        const maximum = Math.max(minimum, Number(descriptor.maximum) || 64);
        const row = document.createElement("div");
        row.className = "rml-graph-variadic-row";
        const label = document.createElement("span");
        label.textContent = `${direction === "input" ? "Inputs" : "Outputs"}: ${count}`;
        const minus = inspectorButton("−", () => {
          node.parameters[key] = Math.max(minimum, count - 1);
          pruneConnections();
          persistGraph(true);
          renderGraphNodesAndWires();
          renderGraphInspector();
        });
        setGraphButtonAvailability(
          minus,
          count > minimum,
          `This node already has the minimum of ${minimum.toLocaleString("de-DE")} ${direction}s.`
        );
        const plus = inspectorButton("+", () => {
          node.parameters[key] = Math.min(maximum, count + 1);
          persistGraph(true);
          renderGraphNodesAndWires();
          renderGraphInspector();
        }, "primary");
        setGraphButtonAvailability(
          plus,
          count < maximum,
          `This node already has the maximum of ${maximum.toLocaleString("de-DE")} ${direction}s.`
        );
        row.append(label, minus, plus);
        variadic.appendChild(row);
      };

      addControl("input", definition.variadicInputs);
      addControl("output", definition.variadicOutputs);
      card.appendChild(variadic);
    }

    const typeList =
      document.createElement("div");
    typeList.className =
      "rml-graph-inspector-type-list";

    const analysis =
      currentAnalysis ||
      analyzeConnections(
        graph.connections
      );

    for (
      const [direction, ports] of [
        ["Input", definition.inputs || []],
        ["Output", definition.outputs || []]
      ]
    ) {
      for (const spec of ports) {
        const concrete =
          spec.type ||
          analysis.bindings
            .get(node.id)?.[
              spec.typeVar
            ] || null;
        const row =
          document.createElement("div");
        row.className =
          "rml-graph-inspector-type-row";
        row.dataset.rmlTypeColor =
          typeInfo(concrete).color;
        const dot =
          document.createElement("i");
        const name =
          document.createElement("span");
        name.textContent =
          `${direction}: ${spec.label}`;
        const type =
          document.createElement("b");
        type.textContent =
          concrete
            ? typeLabel(concrete)
            : `${spec.typeVar || "T"}`;
        row.append(dot, name, type);
        typeList.appendChild(row);
      }
    }

    if (typeList.children.length) {
      card.appendChild(typeList);
    }

    const actions =
      document.createElement("div");
    actions.className =
      "rml-graph-inspector-actions";

    if (node.kind === "configuration") {
      actions.appendChild(
        inspectorButton(
          "Edit Configuration Outline",
          unpackToOutline,
          "primary"
        )
      );
    } else {
      if (
        apiCompositeEditor &&
        apiCompositeInternalDefinitionAllowed(
          definition
        ) &&
        apiCompositeNodeHasExposablePorts(
          node.id
        )
      ) {
        actions.appendChild(
          inspectorButton(
            "Expose unconnected ports",
            () =>
              exposeApiCompositeNodePorts(
                node.id
              ),
            "primary"
          )
        );
      }
      if (
        definition.catalogGenerated ===
          true &&
        !customCSharpEditor &&
        !apiCompositeEditor
      ) {
        actions.appendChild(
          inspectorButton(
            "Select connected API chain",
            () =>
              selectConnectedApiNodes(
                node.id
              ),
            "primary"
          )
        );
      }
      if (
        definition.apiCompositeContainer ===
          true &&
        !customCSharpEditor &&
        !apiCompositeEditor
      ) {
        const open = inspectorButton(
          "Edit Internal API & Logic Graph",
          () =>
            openApiCompositeGraph(
              node.id
            ),
          "primary"
        );
        const canOpenComposite =
          apiCompositeCatalogAvailable();
        setGraphButtonAvailability(
          open,
          canOpenComposite,
          "A verified live or cached API catalog is required."
        );
        open.title = !canOpenComposite
          ? "Edit Internal API & Logic Graph — a verified live or cached API catalog is required."
          : "Edit Internal API & Logic Graph — edit preserved internal API and logic nodes; unconnected ports of new nodes are exposed on the outer Composite automatically.";
        actions.appendChild(open);
        actions.appendChild(
          inspectorButton(
            "Unpack API Composite",
            () => {
              try {
                unpackApiCompositeNode(
                  node.id
                );
              } catch (error) {
                showGraphMessage(
                  error instanceof Error
                    ? error.message
                    : String(error),
                  "error"
                );
              }
            }
          )
        );
        const savedTemplateId = String(
          node.parameters
            ?.savedApiCompositeId || ""
        );
        const linkedTemplate =
          savedApiCompositeTemplates.get(
            savedTemplateId
          );
        actions.dataset
          .savedApiCompositeNodeActionsFor =
          node.id;
        synchronizeApiCompositeInspectorSaveAction(
          actions,
          node,
          linkedTemplate
        );
        if (linkedTemplate) {
          const saveNew = inspectorButton(
            "Save New",
            () =>
              saveApiCompositeNode(
                node.id,
                { asNew: true }
              ).catch(error =>
                showGraphMessage(
                  error instanceof Error
                    ? error.message
                    : String(error),
                  "error"
                )
              )
          );
          saveNew.dataset
            .savedApiCompositeSaveNew =
            "true";
          actions.appendChild(saveNew);
        }
        if (linkedTemplate) {
          const deleteSaved =
            inspectorButton(
              "Delete Saved Composite",
              () =>
                removeSavedApiComposite(
                  linkedTemplate.id
                )
          );
          deleteSaved.dataset
            .savedApiCompositeDelete =
            "true";
          actions.appendChild(
            deleteSaved
          );
        }
      }
      if (
        definition.customCSharpFile === true &&
        !customCSharpEditor
      ) {
        const openButton = inspectorButton(
          customCSharpFileNeedsOptimization(node)
              ? "Optimize & Open Node Graph"
              : "Open Node Graph",
          () =>
            openCustomCSharpFileGraphSynced(
              node.id
            ),
          "primary"
        );
        openButton.setAttribute(
          CUSTOM_CSHARP_ACTION_NODE_ATTRIBUTE,
          String(node.id)
        );
        applyCustomCSharpSynchronizationControl(
          openButton,
          node
        );
        actions.appendChild(openButton);
      }
      if (
        definition.apiCompositeContainer !==
          true
      ) {
        actions.appendChild(
          inspectorButton(
            "Duplicate",
            () => duplicateGraphNode(node)
          )
        );
      }
    }

    if (
      Number.isFinite(node.width) ||
      Number.isFinite(node.height)
    ) {
      actions.appendChild(
        inspectorButton(
          "Reset size",
          () => resetNodeSize(node.id)
        )
      );
    }

    actions.appendChild(
      inspectorButton(
        definition?.unavailableApiContract === true
          ? "Discard unavailable node"
          : "Delete",
        () => deleteGraphNode(node.id)
      )
    );

    card.appendChild(actions);
    return card;
  }

function appendColorXParameterControl(
    card,
    node,
    specification
  ) {
    const editorAppearance =
      specification.editorAppearance === true;

    if (!editorAppearance) {
      normalizeColorConstantParameters(
        node.parameters
      );
    }

    const createEditor =
      bridge?.createColorXEditor;

    if (
      typeof createEditor !==
        "function"
    ) {
      return false;
    }

    let editor = null;
    editor = createEditor.call(
        bridge,
        {
          label:
            specification.label ||
            "Color value",
          expression:
            editorAppearance
              ? normalizedCustomCSharpEditorColor(
                  node.parameters[
                    specification.key
                  ] ?? specification.default,
                  String(
                    specification.default ||
                      "#7f7f7f"
                  )
                )
              : node.parameters[
                    specification.key
                  ] ||
                "colorX.White",
          profile:
            editorAppearance
              ? "srgb"
              : node.parameters
                    .colorProfile ||
                "linear",
          strength:
            editorAppearance
              ? 1
              : node.parameters
                    .colorStrength ||
                1,
          onChange: state => {
            if (editorAppearance) {
              const pickerHex =
                editor?.querySelector(
                  "[data-color-hex]"
                )?.value;
              const next =
                normalizedCustomCSharpEditorColor(
                  pickerHex,
                  normalizedCustomCSharpEditorColor(
                    node.parameters[
                      specification.key
                    ],
                    String(
                      specification.default ||
                        "#7f7f7f"
                    )
                  )
                );
              node.parameters[
                specification.key
              ] = next;
              refreshCustomCSharpEditorAppearance(
                node
              );
              persistGraph();
              refreshDisplayValueNodes();
              return;
            }
            node.parameters[
              specification.key
            ] = state.expression;
            node.parameters
              .colorProfile =
              state.profile;
            node.parameters
              .colorStrength =
              state.strength;

            persistGraph();
            refreshDisplayValueNodes();
          }
        }
      );

    if (!(editor instanceof HTMLElement)) {
      return false;
    }

    editor.classList.add(
      "rml-graph-colorx-editor"
    );

    if (editorAppearance) {
      editor.classList.add(
        "rml-graph-editor-appearance-color"
      );
      for (const selector of [
        ".custom-color-profile-tabs",
        ".alpha-control",
        ".strength-control"
      ]) {
        const element =
          editor.querySelector(selector);
        if (element) element.hidden = true;
      }
      const expressionInput =
        editor.querySelector(
          "[data-color-expression]"
        );
      const expressionLabel =
        expressionInput?.closest("label");
      if (expressionLabel) {
        expressionLabel.hidden = true;
      }
    }

    if (specification.help) {
      const help =
        document.createElement("small");
      help.className =
        "rml-graph-colorx-help";
      help.textContent =
        specification.help;
      editor.appendChild(help);
    }

    card.appendChild(editor);
    return true;
  }

function appendNumericVectorParameterControl(
    card,
    node,
    definition,
    specification
  ) {
    const configuredType =
      specification.vectorType ||
      specification.valueType ||
      node.parameters?.valueType;

    let vectorType =
      numericVectorInfo(configuredType)
        ? configuredType
        : null;

    if (
      !vectorType &&
      node.parameters?.valueType === "auto" &&
      definition?.configurableTypeVar
    ) {
      const analysis =
        currentAnalysis ||
        analyzeConnections(
          graph.connections
        );
      const inferredType =
        analysis.bindings
          .get(node.id)?.[
            definition.configurableTypeVar
          ] || null;

      if (numericVectorInfo(inferredType)) {
        vectorType = inferredType;
      }
    }

    if (
      !vectorType &&
      isAutoVectorOperator(node)
    ) {
      const inferredType =
        effectiveAutoVectorType(node);

      if (numericVectorInfo(inferredType)) {
        vectorType = inferredType;
      }
    }

    if (!vectorType) {
      const fallbackType =
        definition?.autoFallbackType ||
        fallbackTypeForDefinition(
          definition || {}
        );

      if (numericVectorInfo(fallbackType)) {
        vectorType = fallbackType;
      }
    }

    const information =
      numericVectorInfo(vectorType);

    if (!information) {
      return false;
    }

    const normalized =
      validateNumericVectorValue(
        node.parameters?.[specification.key] ||
          Array.from(
            { length: information.componentCount },
            () => "0"
          ).join(", "),
        vectorType,
        { coerce: true }
      );

    const components =
      normalized.valid
        ? [...normalized.components]
        : Array.from(
            { length: information.componentCount },
            () => "0"
          );

    node.parameters[specification.key] =
      components.join(", " );

    const editor =
      document.createElement("fieldset");
    editor.className =
      "vector-default-editor rml-graph-vector-editor";

    const title =
      document.createElement("legend");
    title.textContent =
      specification.label ||
      specification.key ||
      "Vector";

    const fields =
      document.createElement("div");
    fields.className =
      `vector-fields vector-fields-${information.componentCount}`;

    const componentNames =
      ["X", "Y", "Z", "W"];

    const commitComponents = () => {
      node.parameters[specification.key] =
        components.join(", " );
      persistGraph(
        specification.commitImmediately === true
      );
      refreshDisplayValueNodes();
    };

    for (
      let index = 0;
      index < information.componentCount;
      index += 1
    ) {
      const componentLabel =
        document.createElement("label");
      componentLabel.className =
        "vector-component";
      componentLabel.textContent =
        componentNames[index];

      const input =
        document.createElement("input");
      input.type = "number";
      input.step =
        information.scalarType === "int"
          ? "1"
          : "any";
      input.value = components[index];
      input.inputMode = "decimal";

      input.addEventListener(
        "input",
        () => {
          const result =
            validateNumericValue(
              input.value,
              information.scalarType,
              { coerce: false }
            );

          input.setCustomValidity(
            result.valid
              ? ""
              : result.reason
          );

          if (!result.valid) {
            return;
          }

          components[index] =
            result.value;
          commitComponents();
        }
      );

      input.addEventListener(
        "change",
        () => {
          const result =
            validateNumericValue(
              input.value,
              information.scalarType,
              { coerce: true }
            );
          components[index] =
            result.value;
          input.value =
            result.value;
          input.setCustomValidity("");
          commitComponents();
        }
      );

      componentLabel.appendChild(input);
      fields.appendChild(componentLabel);
    }

    editor.append(
      title,
      fields
    );

    if (specification.help) {
      const help =
        document.createElement("small");
      help.textContent =
        specification.help;
      editor.appendChild(help);
    }

    card.appendChild(editor);
    return true;
  }

const CUSTOM_CSHARP_EDITOR_COLORS =
    Object.freeze({
      workbench: "#181818",
      background: "#000000",
      gutter: "#000000",
      panel: "#181818",
      overlay: "#252526",
      status: "#68217a",
      selection: "#264f78",
      text: "#ffffff",
      uiText: "#cccccc",
      gutterText: "#858585",
      statusText: "#ffffff",
      accent: "#b789ff",
      caret: "#ffffff"
    });

const CUSTOM_CSHARP_INSPECTOR_COLORS =
    Object.freeze({
      background: "#000000",
      text: "#ffffff",
      caret: "#ffffff"
    });

const CUSTOM_CSHARP_CODE_NODE_ATTRIBUTE =
    "data-rml-custom-csharp-code-node";

const CUSTOM_CSHARP_CODE_PARAMETER_ATTRIBUTE =
    "data-rml-custom-csharp-code-parameter";

const CUSTOM_CSHARP_ACTION_NODE_ATTRIBUTE =
    "data-rml-custom-csharp-action-node";

function appendParameterControl(
    card,
    node,
    definition
  ) {
    const specifications = [];

    if (definition.parameterKind) {
      specifications.push({
        key: "value",
        label: "Value",
        kind:
          definition.parameterKind ===
            "color"
            ? "color"
            : definition.parameterKind ===
              "bool"
              ? "bool"
              : "text"
      });
    }

    for (
      const specification of
      Array.isArray(definition.parameters)
        ? definition.parameters
        : []
    ) {
      if (
        specification &&
        typeof specification.key ===
          "string"
      ) {
        specifications.push(
          specification
        );
      }
    }

    for (const specification of specifications) {
      if (specification.inspectorHidden === true) {
        continue;
      }
      const kind =
        specification.kind ||
        "text";

      if (
        kind === "vector" &&
        appendNumericVectorParameterControl(
          card,
          node,
          definition,
          specification
        )
      ) {
        continue;
      }

      if (
        kind === "color" ||
        kind === "colorX"
      ) {
        if (
          appendColorXParameterControl(
            card,
            node,
            specification
          )
        ) {
          continue;
        }
      }

      const label =
        document.createElement("label");
      label.textContent =
        specification.label ||
        specification.key;

      let control;
      let selectEntries = null;

      if (kind === "bool") {
        control =
          document.createElement("select");
        selectEntries = [];

        for (const [value, text] of [
          ["true", "True"],
          ["false", "False"]
        ]) {
          const option =
            document.createElement(
              "option"
            );
          option.value = value;
          option.textContent = text;
          option.selected =
            Boolean(
              node.parameters[
                specification.key
              ]
            ) ===
            (value === "true");
          control.appendChild(option);
          selectEntries.push({
            value: option.value,
            text: option.textContent
          });
        }
      } else if (kind === "select") {
        control =
          document.createElement("select");
        selectEntries = [];
        const sourceOptions =
          typeof specification.options ===
            "function"
            ? specification.options(
                node,
                definition
              )
            : specification.options || [];

        for (const sourceOption of sourceOptions) {
          const value =
            Array.isArray(sourceOption)
              ? sourceOption[0]
              : typeof sourceOption ===
                    "object" &&
                  sourceOption !== null
                ? sourceOption.value
                : sourceOption;
          const text =
            Array.isArray(sourceOption)
              ? sourceOption[1]
              : typeof sourceOption ===
                    "object" &&
                  sourceOption !== null
                ? sourceOption.label ??
                  sourceOption.value
                : sourceOption;
          const option =
            document.createElement(
              "option"
            );
          option.value = String(
            value ?? ""
          );
          option.textContent = String(
            text ?? value ?? ""
          );
          option.selected =
            String(
              node.parameters[
                specification.key
              ] ?? ""
            ) === option.value;
          control.appendChild(option);
          selectEntries.push({
            value: option.value,
            text: option.textContent
          });
        }
      } else if (
        kind === "textarea" ||
        kind === "code" ||
        kind === "multiline"
      ) {
        control =
          document.createElement(
            "textarea"
          );
        control.rows = Math.max(
          2,
          Number(
            specification.rows
          ) ||
            (kind === "code"
              ? 8
              : 4)
        );
        control.value = String(
          node.parameters[
            specification.key
          ] ??
            specification.default ??
            ""
        );
        control.spellcheck =
          specification.spellcheck ===
          true;
        control.autocomplete = "off";
        control.setAttribute(
          "autocapitalize",
          kind === "code" ? "off" : "sentences"
        );
        control.setAttribute(
          "autocorrect",
          kind === "code" ? "off" : "on"
        );
        control.classList.toggle(
          "rml-graph-code-input",
          kind === "code" ||
            specification.monospace ===
              true
        );
      } else {
        control =
          document.createElement("input");
        control.type =
          kind === "color"
            ? "color"
            : kind === "number"
              ? "number"
              : specification.inputType ||
                "text";
        control.value = String(
          node.parameters[
            specification.key
          ] ??
            specification.default ??
            ""
        );
        control.spellcheck =
          specification.spellcheck ===
          true;
        if (
          control.type === "text" ||
          control.type === "search" ||
          control.type === "url"
        ) {
          control.autocomplete = "off";
        }
        control.classList.toggle(
          "rml-graph-code-input",
          specification.monospace ===
            true
        );
      }

      const customCSharpCodeControl =
        definition.customCSharpNode ===
          true &&
        kind === "code";
      const customCSharpSourceControl =
        customCSharpCodeControl &&
        definition.customCSharpFile ===
          true &&
        specification.key === "source" &&
        !customCSharpEditor;
      if (customCSharpCodeControl) {
        const editorBoundValue =
          customCSharpEditorCurrentValue(
            node.id,
            specification.key,
            control.value
          );
        node.parameters[
          specification.key
        ] = editorBoundValue;
        control.value = editorBoundValue;
        control.setAttribute(
          CUSTOM_CSHARP_CODE_NODE_ATTRIBUTE,
          String(node.id)
        );
        control.setAttribute(
          CUSTOM_CSHARP_CODE_PARAMETER_ATTRIBUTE,
          String(specification.key)
        );
        applyCustomCSharpEditorAppearance(
          control,
          node
        );
      }

      if (specification.placeholder) {
        control.placeholder =
          specification.placeholder;
      }

      if (
        Number.isFinite(
          Number(
            specification.maxLength
          )
        )
      ) {
        control.maxLength =
          Number(
            specification.maxLength
          );
      }

      const update = () => {
        let value;
        const dropdownChange =
          kind === "bool" ||
          kind === "select";

        if (kind === "bool") {
          value =
            control.value === "true";
        } else if (
          kind === "number" &&
          specification.storeAsNumber ===
            true
        ) {
          const parsed =
            Number(control.value);
          value = Number.isFinite(parsed)
            ? parsed
            : Number(
                specification.default
              ) || 0;
        } else {
          value = control.value;
        }

        node.parameters[
          specification.key
        ] = value;

        if (
          specification.editorAppearance ===
            true &&
          definition.customCSharpNode ===
            true
        ) {
          refreshCustomCSharpEditorAppearance(
            node
          );
        }

        if (customCSharpCodeControl) {
          const detached =
            customCSharpDetachedEditors.get(
              customCSharpDetachedEditorKey(
                node.id,
                specification.key
              )
            );
          if (
            customCSharpEditorRecordActive(detached) &&
            typeof detached.setValue ===
              "function"
          ) {
            rememberCustomCSharpEditorDraft(
              node.id,
              specification.key,
              value
            );
            detached.setValue(
              String(value)
            );
          } else {
            customCSharpEditorDraftValues.delete(
              customCSharpDetachedEditorKey(
                node.id,
                specification.key
              )
            );
          }
          scheduleCustomCSharpLiveDiagnostics(
            node,
            specification,
            String(value)
          );
        }

        if (
          customCSharpSourceControl
        ) {
          graph.customCSharpFiles =
            graph.customCSharpFiles &&
            typeof graph.customCSharpFiles === "object"
              ? graph.customCSharpFiles
              : {};
          const customGraph =
            graph.customCSharpFiles[node.id] ||
            createEmptyCustomCSharpFileGraph(node);
          customGraph.sourceEditedInInspector = true;
          customGraph.sourceHash = "";
          graph.customCSharpFiles[node.id] = customGraph;
          updateCustomCSharpSynchronizationControl(
            node.id
          );
        }

        if (
          specification.affectsPorts ===
          true
        ) {
          graphNodeDefinitionCache = new WeakMap();
          currentAnalysis = null;
          const previousConnectionIds = new Set(
            graph.connections
              .filter(connection => connection.fromNode === node.id || connection.toNode === node.id)
              .map(connection => connection.id)
          );
          pruneConnections();
          const remainingConnectionIds = new Set(graph.connections.map(connection => connection.id));
          const removedConnectionCount = [...previousConnectionIds]
            .filter(connectionId => !remainingConnectionIds.has(connectionId))
            .length;
          if (removedConnectionCount > 0) {
            showGraphMessage(
              `${removedConnectionCount.toLocaleString()} incompatible connection${removedConnectionCount === 1 ? " was" : "s were"} removed because ${specification.label || specification.key} changed the node's port contract.`,
              "warning"
            );
          }
        } else if (
          specification.affectsNode ===
            true ||
          dropdownChange
        ) {
          graphNodeDefinitionCache = new WeakMap();
          currentAnalysis = null;
        }

        persistGraph(
          specification.commitImmediately ===
            true
        );

        if (
          specification.affectsPorts ===
            true ||
          specification.affectsNode ===
            true ||
          dropdownChange
        ) {
          renderGraphNodesAndWires();
        }

        refreshDisplayValueNodes();

        if (
          dropdownChange &&
          graph.selectedNodeId === node.id
        ) {
          renderGraphInspector();
        }
      };

      control.addEventListener(
        kind === "bool" ||
        kind === "select"
          ? "change"
          : "input",
        update
      );
      if (control.type === "color") {
        control.addEventListener(
          "change",
          update
        );
      }

      if (
        customCSharpSourceControl
      ) {
        let composing = false;
        const synchronizeSource = () => {
          const pending = customCSharpSourceSyncTimers.get(node.id);
          if (pending) window.clearTimeout(pending);
          customCSharpSourceSyncTimers.delete(node.id);
          if (
            composing ||
            document.activeElement === control
          ) {
            return;
          }
          void openCustomCSharpFileGraphSynced(node.id, {
            openAfterSync: false,
            quiet: true
          });
        };
        control.addEventListener("compositionstart", () => {
          composing = true;
        });
        control.addEventListener("compositionend", () => {
          composing = false;
        });
        control.addEventListener(
          "blur",
          () => queueMicrotask(synchronizeSource)
        );
      }

      if (
        (kind === "bool" || kind === "select") &&
        Array.isArray(selectEntries)
      ) {
        label.appendChild(
          searchableSelectWrapper(
            control,
            selectEntries,
            () => node.parameters[
              specification.key
            ],
            `Search ${String(
              specification.label ||
              specification.key
            ).toLowerCase()}…`
          )
        );
      } else if (
        control.tagName === "INPUT" &&
        Array.isArray(
          specification.suggestions
        ) &&
        specification.suggestions.length > 0
      ) {
        label.appendChild(
          searchableSuggestionWrapper(
            control,
            specification.suggestions,
            `Search ${String(
              specification.label ||
              specification.key
            ).toLowerCase()}…`
          )
        );
      } else {
        label.appendChild(control);
      }

      if (specification.help) {
        const help =
          document.createElement("small");
        help.textContent =
          specification.help;
        label.appendChild(help);
      }

      card.appendChild(label);
      if (customCSharpCodeControl) {
        const openDetached =
          inspectorButton(
            "Open code editor",
            event => {
              event?.preventDefault?.();
              event?.stopPropagation?.();
              openCustomCSharpDetachedEditor(
                node,
                specification,
                control
              );
            }
          );
        openDetached.title =
          `Open code editor — edit ${String(specification.label || specification.key)} here instead of the graph, then move the synchronized editor to a separate window if needed.`;
        const contextualActions =
          document.createElement("div");
        contextualActions.className =
          "rml-graph-code-editor-actions";
        contextualActions.dataset.parameterKey =
          String(specification.key || "code");
        contextualActions.appendChild(openDetached);
        card.appendChild(contextualActions);
      }
    }
  }

function inspectorButtonIconMarkup(text) {
    const label = String(text || "")
      .trim()
      .toLowerCase();
    const svg = paths =>
      `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;

    if (label === "+") {
      return svg(
        `<path d="M12 5v14M5 12h14"></path>`
      );
    }
    if (label === "−" || label === "-") {
      return svg(
        `<path d="M5 12h14"></path>`
      );
    }
    if (label.includes("open code editor")) {
      return svg(
        `<path d="M8 6 3 12l5 6M16 6l5 6-5 6M14 4l-4 16"></path>`
      );
    }
    if (
      label.includes("new window")
    ) {
      return svg(
        `<path d="M14 4h6v6M20 4l-9 9"></path><path d="M18 13v6H5V6h6"></path>`
      );
    }
    if (label.includes("delete saved composite")) {
      return svg(
        `<path d="M5 4h11l3 3v13H5zM8 4v6h7V4"></path><path d="M10 14l5 5M15 14l-5 5"></path>`
      );
    }
    if (label.includes("delete point")) {
      return svg(
        `<path d="M3 12h5M16 12h5"></path><circle cx="12" cy="12" r="4"></circle><path d="M10.5 10.5l3 3M13.5 10.5l-3 3"></path>`
      );
    }
    if (label.includes("delete wire")) {
      return svg(
        `<path d="M3 7h5l3 5-3 5H3M21 7h-5l-1.2 2"></path><path d="M14 13l5 5M19 13l-5 5"></path>`
      );
    }
    if (label.includes("delete") || label.includes("discard")) {
      return svg(
        `<path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5"></path>`
      );
    }
    if (label.includes("duplicate")) {
      return svg(
        `<rect x="8" y="8" width="11" height="11" rx="2"></rect><path d="M16 8V5H5v11h3"></path>`
      );
    }
    if (label === "update") {
      return svg(
        `<path d="M20 7v5h-5M4 17v-5h5"></path><path d="M6.2 8a7 7 0 0 1 11.5-1.5L20 9M4 15l2.3 2.5A7 7 0 0 0 18 16"></path>`
      );
    }
    if (label === "save new") {
      return svg(
        `<path d="M6 3h8l4 4v14H6zM14 3v5h5"></path><path d="M12 12v6M9 15h6"></path>`
      );
    }
    if (label.includes("save")) {
      return svg(
        `<path d="M5 4h12l2 2v14H5z"></path><path d="M8 4v6h8V4M8 20v-6h8v6"></path>`
      );
    }
    if (
      label.includes("open node graph") ||
      label.includes("optimize & open")
    ) {
      if (label.includes("optimize")) {
        return svg(
          `<circle cx="6" cy="8" r="2"></circle><circle cx="13" cy="17" r="2"></circle><path d="M8 9.5l4 5M8 8h6"></path><path d="M18 3l.7 2.3L21 6l-2.3.7L18 9l-.7-2.3L15 6l2.3-.7z"></path>`
        );
      }
      return svg(
        `<circle cx="6" cy="7" r="2"></circle><circle cx="18" cy="7" r="2"></circle><circle cx="12" cy="17" r="2"></circle><path d="M8 8.5l3 6M16 8.5l-3 6M8 7h8"></path>`
      );
    }
    if (label.includes("edit internal api")) {
      return svg(
        `<circle cx="5" cy="7" r="2"></circle><circle cx="12" cy="17" r="2"></circle><path d="M7 8.5l4 6M7 7h6"></path><path d="M15 5l2-2 4 4-8.5 8.5-3 .5.5-3z"></path>`
      );
    }
    if (label.includes("create api composite")) {
      return svg(
        `<rect x="3" y="5" width="6" height="5" rx="1"></rect><rect x="3" y="14" width="6" height="5" rx="1"></rect><path d="M9 7.5h4M9 16.5h4M13 7.5v9"></path><rect x="13" y="9" width="8" height="6" rx="1.5"></rect>`
      );
    }
    if (
      label.includes("select connected") ||
      label.includes("select whole wire")
    ) {
      return svg(
        `<path d="M8.5 14.5l-2 2a3 3 0 0 0 4.2 4.2l3-3a3 3 0 0 0 0-4.2"></path><path d="M15.5 9.5l2-2a3 3 0 0 0-4.2-4.2l-3 3a3 3 0 0 0 0 4.2M9 15l6-6"></path>`
      );
    }
    if (label.includes("expose unconnected ports")) {
      return svg(
        `<rect x="6" y="5" width="8" height="14" rx="2"></rect><path d="M14 9h4M14 15h4M20 6v6M17 9h6"></path>`
      );
    }
    if (
      label.includes("detach")
    ) {
      return svg(
        `<path d="M8 16l-1.5 1.5a3 3 0 0 0 4.2 4.2l2.3-2.3M16 8l1.5-1.5a3 3 0 0 0-4.2-4.2L11 4.6M8 8l8 8M4 12H1M23 12h-3"></path>`
      );
    }
    if (label.includes("unpack")) {
      return svg(
        `<path d="M12 12L5 5M5 5h5M5 5v5M12 12l7-7M19 5h-5M19 5v5M12 12l7 7M19 19h-5M19 19v-5M12 12l-7 7M5 19h5M5 19v-5"></path>`
      );
    }
    if (
      label.includes("reset") ||
      label.includes("straighten")
    ) {
      return svg(
        `<path d="M4 7v5h5"></path><path d="M5.5 16a8 8 0 1 0 .5-9L4 9"></path>`
      );
    }
    if (
      label.includes("edit configuration")
    ) {
      return svg(
        `<path d="M4 20l4.5-1 10-10-3.5-3.5-10 10zM13.5 7l3.5 3.5"></path>`
      );
    }
    if (label.includes("select")) {
      return svg(
        `<path d="M5 4l12 8-5 1.5L10.5 19z"></path><path d="M14 16l4 4"></path>`
      );
    }
    if (
      label === "abbrechen" ||
      label.includes("cancel")
    ) {
      return svg(
        `<circle cx="12" cy="12" r="9"></circle><path d="M9 9l6 6M15 9l-6 6"></path>`
      );
    }
    return svg(
      `<circle cx="6" cy="12" r="1"></circle><circle cx="12" cy="12" r="1"></circle><circle cx="18" cy="12" r="1"></circle>`
    );
  }

function inspectorButtonTone(text) {
    const label = String(text || "")
      .trim()
      .toLowerCase();
    if (label === "+" || label === "−" || label === "-") return "adjust";
    if (label.includes("delete saved composite")) return "saved-remove";
    if (label.includes("delete wire") || label.includes("delete point")) return "connection-remove";
    if (label.includes("delete") || label.includes("discard") || label.includes("cancel")) return "remove";
    if (label.includes("open code editor")) return "code";
    if (label.includes("edit internal api") || label.includes("open node graph") || label.includes("optimize & open") || label.includes("edit configuration")) return "graph";
    if (label.includes("expose") || label.includes("detach")) return "ports";
    if (label.includes("select")) return "select";
    if (label.includes("create")) return "create";
    if (label === "update") return "update";
    if (label.includes("save")) return "save";
    if (label.includes("unpack")) return "unpack";
    if (label.includes("duplicate")) return "duplicate";
    if (label.includes("reset") || label.includes("straighten")) return "reset";
    return "default";
  }

function setInspectorButtonContent(
    button,
    text
  ) {
    const label = String(text || "");
    const icon =
      inspectorButtonIconMarkup(label);
    const presentationChanged =
      button.dataset.actionLabel !== label;
    let content = null;
    if (presentationChanged) {
      content =
        document.createDocumentFragment();
      const template =
        document.createElement("template");
      template.innerHTML = icon;
      content.appendChild(
        template.content
      );
      const accessibleLabel =
        document.createElement("span");
      accessibleLabel.className =
        "rml-graph-inspector-button-label";
      accessibleLabel.textContent = label;
      content.appendChild(accessibleLabel);
    }
    button.title = label;
    button.setAttribute(
      "aria-label",
      label
    );
    button.dataset.help = label;
    button.dataset.helpKicker =
      "Node action";
    button.dataset.actionLabel = label;
    button.classList.add(
      "rml-graph-inspector-icon-button"
    );
    button.dataset.actionTone =
      inspectorButtonTone(label);
    if (content) {
      button.replaceChildren(content);
    }
    return presentationChanged;
  }

function inspectorButton(
    text,
    handler,
    kind = "secondary"
  ) {
    const button =
      document.createElement("button");
    button.type = "button";
    button.className =
      `button ${kind}`;
    setInspectorButtonContent(
      button,
      text
    );
    button.addEventListener(
      "click",
      async event => {
        try {
          await handler(event);
        } finally {
          renderGraphInspector({
            force: true
          });
        }
      }
    );
    return button;
  }

function duplicateGraphNode(node) {
    if (node.kind !== "operator") {
      return;
    }

    const copy = {
      ...nodeGraphClone(node),
      id: makeId("graph-node"),
      x: nodeGraphClamp(
        node.x + 34,
        -GRAPH_COORDINATE_LIMIT,
        GRAPH_COORDINATE_LIMIT
      ),
      y: nodeGraphClamp(
        node.y + 34,
        -GRAPH_COORDINATE_LIMIT,
        GRAPH_COORDINATE_LIMIT
      )
    };

    graph.nodes.push(copy);
    if (
      !customCSharpEditor &&
      node.operatorId === "csharp.file" &&
      graph.customCSharpFiles?.[node.id]
    ) {
      graph.customCSharpFiles[copy.id] = nodeGraphClone(
        graph.customCSharpFiles[node.id]
      );
    }
    graph.selectedNodeId = copy.id;
    graph.selectedNodeIds = [copy.id];
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();
  }

function selectGraphConnectionForInteraction(
    connectionId
  ) {
    graph.selectedNodeId = null;
    graph.selectedNodeIds = [];
    graph.selectedConnectionId =
      connectionId;
    clearSelectedWirePoint();
    persistGraphView();
    updateSelectionClasses();

    dom.wires
      ?.querySelectorAll(
        ".rml-graph-wire"
      )
      .forEach(path => {
        path.classList.toggle(
          "selected",
          path.dataset.connectionId ===
            connectionId
        );
      });

    renderGraphInspector();
  }

function insertWirePoint(
    connection,
    segmentIndex,
    position
  ) {
    connection.points =
      Array.isArray(connection.points)
        ? connection.points
        : [];

    const point = {
      id: makeId("wire-point"),
      x: nodeGraphClamp(
        finiteNumber(position?.x, 0),
        -GRAPH_COORDINATE_LIMIT,
        GRAPH_COORDINATE_LIMIT
      ),
      y: nodeGraphClamp(
        finiteNumber(position?.y, 0),
        -GRAPH_COORDINATE_LIMIT,
        GRAPH_COORDINATE_LIMIT
      )
    };
    const index = nodeGraphClamp(
      Math.trunc(
        finiteNumber(
          segmentIndex,
          connection.points.length
        )
      ),
      0,
      connection.points.length
    );

    connection.points.splice(
      index,
      0,
      point
    );
    return point;
  }

function ensureWireJunctionPoint(
    connection,
    segmentIndex,
    position
  ) {
    connection.points =
      Array.isArray(connection.points)
        ? connection.points
        : [];
    const tolerance =
      GRAPH_WIRE_POINT_REUSE_DISTANCE /
      Math.max(
        graph.viewport.scale,
        GRAPH_MIN_ZOOM
      );
    const existing =
      connection.points.find(point =>
        Math.hypot(
          point.x - position.x,
          point.y - position.y
        ) <= tolerance
      );

    return existing ||
      insertWirePoint(
        connection,
        segmentIndex,
        position
      );
  }

function detachBranchesFromPoint(
    connectionId,
    pointId
  ) {
    let count = 0;

    for (const connection of graph.connections) {
      if (
        connection.branchFrom
          ?.connectionId ===
            connectionId &&
        connection.branchFrom
          ?.pointId === pointId
      ) {
        connection.branchFrom = null;
        count += 1;
      }
    }

    return count;
  }

function removeWirePoint(
    connectionId,
    pointId
  ) {
    const connection =
      graphConnectionById(
        connectionId
      );

    if (!connection) {
      return;
    }

    const detached =
      detachBranchesFromPoint(
        connectionId,
        pointId
      );
    connection.points =
      (connection.points || [])
        .filter(point =>
          point.id !== pointId
        );

    if (
      graph.selectedWirePoint
        ?.connectionId ===
          connectionId &&
      graph.selectedWirePoint
        ?.pointId === pointId
    ) {
      clearSelectedWirePoint();
      graph.selectedNodeId = null;
      graph.selectedNodeIds = [];
      graph.selectedConnectionId =
        connectionId;
    }

    normalizeConnectionRouting(
      graph.connections
    );
    persistGraph(true);
    renderGraphWires();
    renderGraphInspector();

    showGraphMessage(
      detached > 0
        ? `Junction removed. ${detached} branch${detached === 1 ? "" : "es"} now start directly at the original output.`
        : "Wire bend removed.",
      "success"
    );
  }

function straightenWire(
    connectionId
  ) {
    const connection =
      graphConnectionById(
        connectionId
      );

    if (!connection) {
      return;
    }

    let detached = 0;

    for (const point of connection.points || []) {
      detached +=
        detachBranchesFromPoint(
          connection.id,
          point.id
        );
    }

    connection.points = [];

    if (
      graph.selectedWirePoint
        ?.connectionId ===
          connectionId
    ) {
      clearSelectedWirePoint();
      graph.selectedNodeId = null;
      graph.selectedNodeIds = [];
      graph.selectedConnectionId =
        connectionId;
    }

    normalizeConnectionRouting(
      graph.connections
    );
    persistGraph(true);
    renderGraphWires();
    renderGraphInspector();

    showGraphMessage(
      detached > 0
        ? `Wire straightened. ${detached} branch${detached === 1 ? "" : "es"} were detached from their junctions but remain connected.`
        : "Wire routing reset to automatic.",
      "success"
    );
  }

function detachWireBranch(
    connectionId
  ) {
    const connection =
      graphConnectionById(
        connectionId
      );

    if (!connection?.branchFrom) {
      return;
    }

    connection.branchFrom = null;
    persistGraph(true);
    renderGraphWires();
    renderGraphInspector();
    showGraphMessage(
      "Branch detached from its junction and routed directly from the original output.",
      "success"
    );
  }

function addWirePointAtPath(
    connectionId,
    segmentIndex,
    path,
    clientX,
    clientY
  ) {
    const connection =
      graphConnectionById(
        connectionId
      );

    if (!connection) {
      return null;
    }

    const point =
      insertWirePoint(
        connection,
        segmentIndex,
        nearestGraphPointOnSvgPath(
          path,
          clientX,
          clientY
        )
      );

    graph.selectedNodeId = null;
    graph.selectedNodeIds = [];
    graph.selectedConnectionId =
      connection.id;
    graph.selectedWirePoint = {
      connectionId:
        connection.id,
      pointId: point.id
    };
    persistGraph(true);
    renderGraphWires();
    renderGraphInspector();
    return point;
  }

function beginWireSegmentDrag(
    event,
    connectionId,
    segmentIndex,
    path
  ) {
    if (
      event.button !== 0 ||
      activeInteraction
    ) {
      return;
    }

    const connection =
      graphConnectionById(
        connectionId
      );

    if (!connection) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();
    const previous =
      lastWireSegmentPress;
    const doublePress = Boolean(
      previous &&
      previous.connectionId ===
        connectionId &&
      previous.segmentIndex ===
        segmentIndex &&
      now - previous.time <=
        WIRE_DOUBLE_CLICK_MS &&
      Math.hypot(
        event.clientX - previous.clientX,
        event.clientY - previous.clientY
      ) <= WIRE_DOUBLE_CLICK_DISTANCE
    );

    if (doublePress) {
      lastWireSegmentPress = null;
      addWirePointAtPath(
        connectionId,
        segmentIndex,
        path,
        event.clientX,
        event.clientY
      );
      return;
    }

    lastWireSegmentPress = {
      connectionId,
      segmentIndex,
      time: now,
      clientX: event.clientX,
      clientY: event.clientY
    };

    selectGraphConnectionForInteraction(
      connectionId
    );

    activeInteraction = {
      kind: "wire-segment",
      pointerId: event.pointerId,
      connectionId,
      segmentIndex,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      anchor:
        nearestGraphPointOnSvgPath(
          path,
          event.clientX,
          event.clientY
        ),
      originalPoints:
        nodeGraphClone(connection.points || []),
      connectionIds:
        relatedGraphConnectionIds(
          connectionId
        ),
      dragging: false,
      pointId: null
    };

    try {
      dom.viewport?.setPointerCapture(
        event.pointerId
      );
    } catch {
    }

    startAutoPan(
      event.clientX,
      event.clientY,
      () => {
        if (
          activeInteraction?.kind ===
            "wire-segment" &&
          activeInteraction.dragging
        ) {
          updateWireSegmentDrag(
            activeInteraction.clientX,
            activeInteraction.clientY
          );
        }
      }
    );
  }

function updateWireSegmentDrag(
    clientX,
    clientY
  ) {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !==
        "wire-segment"
    ) {
      return;
    }

    interaction.clientX = clientX;
    interaction.clientY = clientY;

    const connection =
      graphConnectionById(
        interaction.connectionId
      );

    if (!connection) {
      return;
    }

    if (!interaction.dragging) {
      const distance =
        Math.hypot(
          clientX - interaction.startX,
          clientY - interaction.startY
        );

      if (
        distance <
          GRAPH_WIRE_DRAG_THRESHOLD
      ) {
        return;
      }

      const point =
        insertWirePoint(
          connection,
          interaction.segmentIndex,
          interaction.anchor
        );
      interaction.pointId =
        point.id;
      interaction.dragging = true;
      graph.selectedNodeId = null;
      graph.selectedNodeIds = [];
      graph.selectedConnectionId =
        connection.id;
      graph.selectedWirePoint = {
        connectionId:
          connection.id,
        pointId: point.id
      };
    }

    const point =
      wirePointById(
        connection,
        interaction.pointId
      );

    if (!point) {
      return;
    }

    const position =
      clientToGraph(
        clientX,
        clientY
      );
    point.x = nodeGraphClamp(
      position.x,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );
    point.y = nodeGraphClamp(
      position.y,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );

    updateAutoPanPointer(
      clientX,
      clientY
    );
    scheduleGraphWireRender(
      interaction.connectionIds
    );
  }

function finishWireSegmentDrag(
    commit,
    restoreOriginal = false
  ) {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !==
        "wire-segment"
    ) {
      return;
    }

    const connection =
      graphConnectionById(
        interaction.connectionId
      );

    if (connection) {
      if (!commit || restoreOriginal) {
        connection.points =
          nodeGraphClone(
            interaction.originalPoints
          );
      } else if (
        interaction.dragging &&
        interaction.pointId
      ) {
        const point =
          wirePointById(
            connection,
            interaction.pointId
          );

        if (point) {
          point.x =
            Math.round(
              point.x /
                GRAPH_WIRE_POINT_SNAP
            ) *
            GRAPH_WIRE_POINT_SNAP;
          point.y =
            Math.round(
              point.y /
                GRAPH_WIRE_POINT_SNAP
            ) *
            GRAPH_WIRE_POINT_SNAP;
        }
      }
    }

    activeInteraction = null;
    stopAutoPan();
    normalizeConnectionRouting(
      graph.connections
    );
    normalizeSelectedWirePoint();
    persistGraphView(
      false,
      commit === true &&
        interaction.dragging === true
    );
    renderGraphWires();
    renderGraphInspector();
  }

function beginWirePointDrag(event) {
    if (
      event.button !== 0 ||
      activeInteraction
    ) {
      return;
    }

    const handle =
      event.currentTarget;
    const connectionId =
      handle.dataset.connectionId;
    const pointId =
      handle.dataset.pointId;
    const connection =
      graphConnectionById(
        connectionId
      );
    const point =
      wirePointById(
        connection,
        pointId
      );

    if (!connection || !point) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const now = performance.now();
    const previous =
      lastWirePointPress;
    const doublePress = Boolean(
      previous &&
      previous.connectionId ===
        connectionId &&
      previous.pointId === pointId &&
      now - previous.time <=
        WIRE_DOUBLE_CLICK_MS &&
      Math.hypot(
        event.clientX - previous.clientX,
        event.clientY - previous.clientY
      ) <= WIRE_DOUBLE_CLICK_DISTANCE
    );

    if (doublePress) {
      lastWirePointPress = null;
      removeWirePoint(
        connectionId,
        pointId
      );
      return;
    }

    lastWirePointPress = {
      connectionId,
      pointId,
      time: now,
      clientX: event.clientX,
      clientY: event.clientY
    };

    selectGraphWirePoint(
      connectionId,
      pointId,
      false
    );

    activeInteraction = {
      kind: "wire-point",
      pointerId: event.pointerId,
      connectionId,
      pointId,
      clientX: event.clientX,
      clientY: event.clientY,
      originalX: point.x,
      originalY: point.y,
      connectionIds:
        relatedGraphConnectionIds(
          connectionId
        )
    };

    try {
      dom.viewport?.setPointerCapture(
        event.pointerId
      );
    } catch {
    }

    startAutoPan(
      event.clientX,
      event.clientY,
      () => {
        if (
          activeInteraction?.kind ===
            "wire-point"
        ) {
          updateWirePointDrag(
            activeInteraction.clientX,
            activeInteraction.clientY
          );
        }
      }
    );
  }

function updateWirePointDrag(
    clientX,
    clientY
  ) {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !==
        "wire-point"
    ) {
      return;
    }

    interaction.clientX = clientX;
    interaction.clientY = clientY;

    const connection =
      graphConnectionById(
        interaction.connectionId
      );
    const point =
      wirePointById(
        connection,
        interaction.pointId
      );

    if (!point) {
      return;
    }

    const position =
      clientToGraph(
        clientX,
        clientY
      );
    point.x = nodeGraphClamp(
      position.x,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );
    point.y = nodeGraphClamp(
      position.y,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );

    updateAutoPanPointer(
      clientX,
      clientY
    );
    scheduleGraphWireRender(
      interaction.connectionIds
    );
  }

function finishWirePointDrag(
    commit,
    restoreOriginal = false
  ) {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !==
        "wire-point"
    ) {
      return;
    }

    const connection =
      graphConnectionById(
        interaction.connectionId
      );
    const point =
      wirePointById(
        connection,
        interaction.pointId
      );

    if (point) {
      if (!commit || restoreOriginal) {
        point.x =
          interaction.originalX;
        point.y =
          interaction.originalY;
      } else {
        point.x =
          Math.round(
            point.x /
              GRAPH_WIRE_POINT_SNAP
          ) *
          GRAPH_WIRE_POINT_SNAP;
        point.y =
          Math.round(
            point.y /
              GRAPH_WIRE_POINT_SNAP
          ) *
          GRAPH_WIRE_POINT_SNAP;
      }
    }

    activeInteraction = null;
    stopAutoPan();
    normalizeConnectionRouting(
      graph.connections
    );
    persistGraphView(
      false,
      commit === true
    );
    renderGraphWires();
    renderGraphInspector();
  }

function detachWirePointBranches(
    connectionId,
    pointId
  ) {
    const connection =
      graphConnectionById(
        connectionId
      );
    const point =
      wirePointById(
        connection,
        pointId
      );

    if (!connection || !point) {
      return;
    }

    const detached =
      detachBranchesFromPoint(
        connectionId,
        pointId
      );

    normalizeConnectionRouting(
      graph.connections
    );
    persistGraph(true);
    renderGraphWires();
    renderGraphInspector();

    showGraphMessage(
      detached > 0
        ? `${detached} branch${detached === 1 ? "" : "es"} detached. The manual route point remains.`
        : "This route point has no attached branches.",
      detached > 0
        ? "success"
        : "error"
    );
  }

function wirePointInspectorCard(
    connection,
    point
  ) {
    const card =
      document.createElement("section");
    card.className =
      "rml-graph-inspector-card";

    const branchCount =
      branchPointUsageCount(
        connection.id,
        point.id
      );
    const junction = branchCount > 0;
    const fromNode =
      findGraphNode(
        connection.fromNode
      );
    const toNode =
      findGraphNode(
        connection.toNode
      );
    const fromSpec =
      findPortSpec(
        connection.fromNode,
        connection.fromPort,
        "output"
      );
    const toSpec =
      findPortSpec(
        connection.toNode,
        connection.toPort,
        "input"
      );
    const concrete =
      resolvePortType(
        fromSpec,
        currentAnalysis?.bindings ||
          new Map()
      );

    const heading =
      document.createElement("h3");
    heading.textContent = junction
      ? "Typed wire junction"
      : "Manual wire bend";

    const description =
      document.createElement("p");
    description.textContent =
      `${
        nodeDefinition(fromNode)?.title ||
        "Source"
      } · ${fromSpec?.spec.label || "Output"} → ${
        nodeDefinition(toNode)?.title ||
        "Target"
      } · ${toSpec?.spec.label || "Input"}`;

    const type =
      document.createElement("p");
    type.textContent =
      `Type: ${typeLabel(concrete)}`;

    const coordinates =
      document.createElement("p");
    coordinates.textContent =
      `Position: X ${Math.round(point.x)} · Y ${Math.round(point.y)}${
        junction
          ? ` · ${branchCount} attached branch${branchCount === 1 ? "" : "es"}`
          : ""
      }`;

    const help =
      document.createElement("p");
    help.textContent = junction
      ? "This selected point routes the parent wire and is also the visual origin of typed branches. Deleting it keeps every branch semantically connected to the original output."
      : "This selected point only changes the visual route. Drag it freely, press Delete/Backspace, double-click it, or use Delete point below.";

    const actions =
      document.createElement("div");
    actions.className =
      "rml-graph-inspector-actions";

    actions.appendChild(
      inspectorButton(
        "Select whole wire",
        () =>
          selectGraphConnection(
            connection.id
          )
      )
    );

    if (junction) {
      actions.appendChild(
        inspectorButton(
          "Detach branches",
          () =>
            detachWirePointBranches(
              connection.id,
              point.id
            )
        )
      );
    }

    actions.appendChild(
      inspectorButton(
        "Delete point",
        () =>
          removeWirePoint(
            connection.id,
            point.id
          )
      )
    );

    card.append(
      heading,
      description,
      type,
      coordinates,
      help,
      actions
    );

    return card;
  }

function connectionInspectorCard(
    connection
  ) {
    const card =
      document.createElement("section");
    card.className =
      "rml-graph-inspector-card";

    const fromNode =
      findGraphNode(
        connection.fromNode
      );
    const toNode =
      findGraphNode(
        connection.toNode
      );
    const fromSpec =
      findPortSpec(
        connection.fromNode,
        connection.fromPort,
        "output"
      );
    const toSpec =
      findPortSpec(
        connection.toNode,
        connection.toPort,
        "input"
      );
    const concrete =
      resolvePortType(
        fromSpec,
        currentAnalysis?.bindings ||
          new Map()
      );

    const heading =
      document.createElement("h3");
    heading.textContent =
      "Typed wire";

    const description =
      document.createElement("p");
    description.textContent =
      `${
        nodeDefinition(fromNode)?.title ||
        "Source"
      } · ${fromSpec?.spec.label || "Output"} → ${
        nodeDefinition(toNode)?.title ||
        "Target"
      } · ${toSpec?.spec.label || "Input"}`;

    const type =
      document.createElement("p");
    type.textContent =
      `Type: ${typeLabel(concrete)}`;

    const routing =
      document.createElement("p");
    const branchCount =
      graph.connections.filter(
        candidate =>
          candidate.branchFrom
            ?.connectionId ===
            connection.id
      ).length;
    routing.textContent =
      `${(connection.points || []).length} manual bend${
        (connection.points || []).length === 1
          ? ""
          : "s"
      } · ${branchCount} attached branch${
        branchCount === 1
          ? ""
          : "es"
      }${
        connection.branchFrom
          ? " · starts at a draggable junction"
          : ""
      }`;

    const help =
      document.createElement("p");
    help.textContent =
      "Drag a wire segment to add a bend. Every manual bend and junction is independently selectable and removable with Delete/Backspace. Drag an input socket onto a compatible wire to create a typed branch. A crossing without a junction marker remains purely visual.";

    const actions =
      document.createElement("div");
    actions.className =
      "rml-graph-inspector-actions";

    if (connection.branchFrom) {
      actions.appendChild(
        inspectorButton(
          "Detach from junction",
          () =>
            detachWireBranch(
              connection.id
            )
        )
      );
    }

    if (
      (connection.points || [])
        .length > 0
    ) {
      actions.appendChild(
        inspectorButton(
          "Straighten wire",
          () =>
            straightenWire(
              connection.id
            )
        )
      );
    }

    actions.appendChild(
      inspectorButton(
        "Delete wire",
        deleteSelectedGraphItem
      )
    );

    card.append(
      heading,
      description,
      type,
      routing,
      help,
      actions
    );
    return card;
  }

function beginViewportPan(event) {
    if (
      event.button !== 0 &&
      event.button !== 1
    ) {
      return;
    }

    customCSharpActiveEditorKey = "";

    if (
      event.target.closest(
        ".rml-graph-node, .rml-graph-wire-hit, .rml-graph-wire-point"
      )
    ) {
      return;
    }

    if (graphHybridActive()) {
      const gpuNode =
        graphHybridRenderer?.pickNode?.(
          event.clientX,
          event.clientY
        );
      if (gpuNode?.nodeId) {
        graphForcedNodeIds.add(
          gpuNode.nodeId
        );
        renderGraphNodes();
        if (gpuNode.header) {
          beginNodeDrag(
            event,
            gpuNode.nodeId
          );
        } else {
          event.preventDefault();
          event.stopPropagation();
          selectGraphNode(
            gpuNode.nodeId
          );
        }
        return;
      }

      const gpuWire =
        graphHybridRenderer?.pickWire?.(
          event.clientX,
          event.clientY,
          12
        );
      if (gpuWire) {
        beginWireSegmentDrag(
          event,
          gpuWire.connectionId,
          gpuWire.segmentIndex,
          gpuWire.path
        );
        return;
      }
    }

    event.preventDefault();
    event.stopPropagation();

    const previousConnectionId =
      graph.selectedConnectionId;
    graph.selectedNodeId = null;
    graph.selectedNodeIds = [];
    graph.selectedConnectionId = null;
    if (graphGpuOverviewActive()) {
      graphForcedNodeIds.clear();
      graphNodeVirtualizationSignature = "";
    }
    clearSelectedWirePoint();
    updateSelectionClasses();
    refreshGraphSelectionWires(
      previousConnectionId
    );
    synchronizeGpuOverviewNodes();
    renderGraphInspector();
    scheduleGraphNodeVirtualization();

    activeInteraction = {
      kind: "pan",
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originalX: graph.viewport.x,
      originalY: graph.viewport.y
    };

    dom.viewport.classList.add(
      "panning"
    );

    try {
      dom.viewport.setPointerCapture(
        event.pointerId
      );
    } catch {
    }
  }

function beginNodeDrag(
    event,
    nodeId
  ) {
    if (
      event.button !== 0 ||
      event.target.closest("button")
    ) {
      return;
    }

    const node =
      findGraphNode(nodeId);

    if (!node) {
      return;
    }

    customCSharpActiveEditorKey = "";

    event.preventDefault();
    event.stopPropagation();

    selectGraphNode(nodeId);

    const pointer =
      clientToGraph(
        event.clientX,
        event.clientY
      );

    activeInteraction = {
      kind: "node",
      pointerId: event.pointerId,
      nodeId,
      grabX: pointer.x - node.x,
      grabY: pointer.y - node.y,
      originalX: node.x,
      originalY: node.y,
      clientX: event.clientX,
      clientY: event.clientY,
      startClientX: event.clientX,
      startClientY: event.clientY,
      dragging: false,
      connectionIds:
        incidentGraphConnectionIds(
          nodeId
        )
    };

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        );
    } catch {
    }

  }

function updateNodeDragPosition(
    clientX,
    clientY
  ) {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !== "node"
    ) {
      return;
    }

    interaction.clientX = clientX;
    interaction.clientY = clientY;

    if (!interaction.dragging) {
      const screenDistance =
        Math.hypot(
          clientX -
            interaction.startClientX,
          clientY -
            interaction.startClientY
        );
      if (
        screenDistance <
          GRAPH_NODE_DRAG_THRESHOLD
      ) {
        return;
      }
      interaction.dragging = true;
      startAutoPan(
        clientX,
        clientY,
        () => {
          if (
            activeInteraction?.kind ===
              "node" &&
            activeInteraction.dragging
          ) {
            updateNodeDragPosition(
              activeInteraction.clientX,
              activeInteraction.clientY
            );
          }
        }
      );
    }

    const node =
      findGraphNode(
        interaction.nodeId
      );

    if (!node) {
      return;
    }

    const pointer =
      clientToGraph(
        clientX,
        clientY
      );

    node.x = nodeGraphClamp(
      pointer.x - interaction.grabX,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );
    node.y = nodeGraphClamp(
      pointer.y - interaction.grabY,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );
    invalidateGraphNodeViewportSpatialIndex(
      node.id
    );

    const element =
      dom.nodesHost?.querySelector(
        `[data-graph-node-id="${CSS.escape(node.id)}"]`
      );

    if (element) {
      element.dataset.rmlNodeX =
        String(node.x);
      element.dataset.rmlNodeY =
        String(node.y);
    }

    scheduleGraphWireRender(
      interaction.connectionIds
    );
    updateAutoPanPointer(
      clientX,
      clientY
    );
  }

function beginConnectionDrag(event) {
    if (event.button !== 0) {
      return;
    }

    customCSharpActiveEditorKey = "";

    event.preventDefault();
    event.stopPropagation();

    const socket =
      event.currentTarget;
    const startRef = {
      nodeId:
        socket.dataset.nodeId,
      portId:
        socket.dataset.portId,
      direction:
        socket.dataset.direction,
      side:
        socket.dataset.side ||
        (socket.dataset.direction ===
          "input"
          ? "left"
          : "right")
    };
    const analysisBeforeDetach =
      currentAnalysis ||
      analyzeConnections(
        graph.connections
      );
    const startPortRef =
      findPortSpec(
        startRef.nodeId,
        startRef.portId,
        startRef.direction
      );
    const startType =
      resolvePortType(
        startPortRef,
        analysisBeforeDetach.bindings ||
          new Map()
      ) ||
      fallbackConcreteTypeForPort(
        startPortRef
      );

    let detachedConnection = null;
    let effectiveStart = startRef;

    if (startRef.direction === "input") {
      detachedConnection =
        graph.connections.find(
          connection =>
            connection.toNode ===
              startRef.nodeId &&
            connection.toPort ===
              startRef.portId
        ) || null;

      if (detachedConnection) {
        graph.connections =
          graph.connections.filter(
            connection =>
              connection.id !==
              detachedConnection.id
          );

        effectiveStart = startRef;
      }
    }

    activeInteraction = {
      kind: "connection",
      pointerId: event.pointerId,
      automaticNodeCreationSuppressed:
        guidedAutomaticNodeCreationSuppressed,
      start: effectiveStart,
      originalStart: startRef,
      startType,
      detachedConnection,
      hoveredTargetElement: null,
      hoveredTargetKey: "",
      clientX: event.clientX,
      clientY: event.clientY
    };

    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    currentAnalysis = analysisBeforeDetach;
    graphConnectionDragTelemetry = {
      eagerTargets: 0,
      hoveredTargets: 0,
      previewBackend: "none"
    };

    const eagerTargets =
      updateConnectionTargets();
    if (eagerTargets) {
      renderGraphWires();
    } else {
      renderConnectionPreview();
    }

    try {
      socket.setPointerCapture(
        event.pointerId
      );
    } catch {
    }

    startAutoPan(
      event.clientX,
      event.clientY,
      () => {
        if (
          activeInteraction?.kind ===
          "connection"
        ) {
          updateHoveredConnectionTarget(
            activeInteraction.clientX,
            activeInteraction.clientY
          );
          renderConnectionPreview();
        }
      }
    );
  }

function clearConnectionPreview() {
    graphConnectionPreviewPath?.remove();
    graphConnectionPreviewPath = null;
    graphHybridRenderer?.setPreview?.(
      null
    );
    graphConnectionDragTelemetry
      .previewBackend = "none";
  }

function renderConnectionPreview() {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !==
      "connection"
    ) {
      return;
    }

    const start =
      socketGraphCenter(
        interaction.start.nodeId,
        interaction.start.portId,
        interaction.start.direction
      );

    if (!start) {
      return;
    }

    let rawPointer =
      clientToGraph(
        interaction.clientX,
        interaction.clientY
      );

    if (
      interaction.start.direction ===
        "input"
    ) {
      const wireTarget =
        wireTargetAtPoint(
          interaction.clientX,
          interaction.clientY,
          interaction.detachedConnection
            ?.id || null
        );

      if (wireTarget) {
        rawPointer =
          nearestGraphPointOnSvgPath(
            wireTarget.path,
            interaction.clientX,
            interaction.clientY
          );
      }
    }

    const oppositeSide =
      interaction.start.side === "left"
        ? "right"
        : "left";
    const pointer = {
      ...rawPointer,
      side: oppositeSide
    };

    const from =
      interaction.start.direction ===
      "output"
        ? start
        : pointer;
    const to =
      interaction.start.direction ===
      "output"
        ? pointer
        : start;

    const startPort =
      findPortSpec(
        interaction.start.nodeId,
        interaction.start.portId,
        interaction.start.direction
      );
    const type =
      resolvePortType(
        startPort,
        currentAnalysis?.bindings ||
          new Map()
      ) || "generic";
    const color = typeInfo(type).color;
    const impulse =
      type === "impulse";

    if (
      graphHybridActive() &&
      !forceSvgWireVisuals() &&
      graphHybridRenderer?.setPreview
    ) {
      graphConnectionPreviewPath?.remove();
      graphConnectionPreviewPath = null;
      graphHybridRenderer.setPreview({
        connectionId:
          "__rml-wire-preview__",
        segmentIndex: 0,
        from,
        to,
        color,
        impulse,
        selected: true
      });
      graphConnectionDragTelemetry
        .previewBackend = "webgl2";
      return;
    }

    graphHybridRenderer?.setPreview?.(
      null
    );
    if (
      !graphConnectionPreviewPath ||
      !graphConnectionPreviewPath
        .isConnected
    ) {
      graphConnectionPreviewPath =
        svgPath(
          "rml-graph-wire-preview",
          ""
        );
      dom.wires?.appendChild(
        graphConnectionPreviewPath
      );
    }
    graphConnectionPreviewPath.setAttribute(
      "d",
      wirePath(from, to)
    );
    graphConnectionPreviewPath.dataset
      .rmlWireColor = color;
    graphConnectionDragTelemetry
      .previewBackend = "svg-single-path";
  }

function socketRefFromElement(element) {
    const socket =
      element?.closest?.(
        ".rml-graph-socket"
      );

    if (!socket) {
      return null;
    }

    return {
      nodeId:
        socket.dataset.nodeId,
      portId:
        socket.dataset.portId,
      direction:
        socket.dataset.direction,
      side:
        socket.dataset.side ||
        (socket.dataset.direction ===
          "input"
          ? "left"
          : "right")
    };
  }

function quickConnectionTargetState(
    first,
    second
  ) {
    const endpoints =
      normalizedEndpoints(
        first,
        second
      );

    if (!endpoints) {
      return "invalid";
    }
    if (
      endpoints.from.nodeId ===
        endpoints.to.nodeId
    ) {
      return "invalid";
    }

    const sourcePort = findPortSpec(
      endpoints.from.nodeId,
      endpoints.from.portId,
      "output"
    );
    const targetPort = findPortSpec(
      endpoints.to.nodeId,
      endpoints.to.portId,
      "input"
    );
    if (!sourcePort || !targetPort) {
      return "invalid";
    }

    const bindings =
      currentAnalysis?.bindings ||
      new Map();
    const sourceType =
      (
        activeInteraction?.kind ===
          "connection" &&
        activeInteraction.start
          .direction === "output" &&
        activeInteraction.start.nodeId ===
          endpoints.from.nodeId &&
        activeInteraction.start.portId ===
          endpoints.from.portId
      )
        ? activeInteraction.startType
        : resolvePortType(
            sourcePort,
            bindings
          ) ||
          fallbackConcreteTypeForPort(
            sourcePort
          );
    const targetType =
      (
        activeInteraction?.kind ===
          "connection" &&
        activeInteraction.start
          .direction === "input" &&
        activeInteraction.start.nodeId ===
          endpoints.to.nodeId &&
        activeInteraction.start.portId ===
          endpoints.to.portId
      )
        ? activeInteraction.startType
        : resolvePortType(
            targetPort,
            bindings
          ) ||
          fallbackConcreteTypeForPort(
            targetPort
          );

    if (
      !isConfigurationReactionConnection(
        sourcePort,
        targetPort
      ) &&
      sourceType &&
      targetType &&
      !connectionTypesCompatible(
        sourceType,
        targetType
      )
    ) {
      return "invalid";
    }

    return "valid";
  }

function connectionSocketElementAtPoint(
    clientX,
    clientY
  ) {
    const elements =
      typeof document.elementsFromPoint ===
        "function"
        ? document.elementsFromPoint(
            clientX,
            clientY
          )
        : [
            document.elementFromPoint(
              clientX,
              clientY
            )
          ];

    for (const element of elements) {
      const socket =
        element?.closest?.(
          ".rml-graph-socket"
        );
      if (socket) {
        return socket;
      }
    }

    return null;
  }

function updateHoveredConnectionTarget(
    clientX,
    clientY
  ) {
    const interaction =
      activeInteraction;
    if (
      interaction?.kind !==
        "connection" ||
      interaction.eagerTargetClassification ===
        true
    ) {
      return;
    }

    const socket =
      connectionSocketElementAtPoint(
        clientX,
        clientY
      );
    const target =
      socketRefFromElement(socket);
    const key = target
      ? `${target.nodeId}\u0000${target.portId}\u0000${target.direction}`
      : "";

    if (
      interaction.hoveredTargetKey ===
        key
    ) {
      return;
    }

    interaction.hoveredTargetElement
      ?.classList.remove(
        "valid-target",
        "invalid-target"
      );
    interaction.hoveredTargetElement =
      null;
    interaction.hoveredTargetKey = key;

    if (
      !socket ||
      !target ||
      target.direction ===
        interaction.start.direction ||
      (
        target.nodeId ===
          interaction.start.nodeId &&
        target.portId ===
          interaction.start.portId
      )
    ) {
      return;
    }

    const state =
      quickConnectionTargetState(
        interaction.start,
        target
      );
    socket.classList.add(
      state === "valid"
        ? "valid-target"
        : "invalid-target"
    );
    interaction.hoveredTargetElement =
      socket;
    graphConnectionDragTelemetry
      .hoveredTargets += 1;
  }

function updateConnectionTargets() {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !==
      "connection"
    ) {
      return;
    }

    const sockets = [
      ...dom.nodesHost
        ?.querySelectorAll(
          ".rml-graph-socket"
        ) || []
    ];
    for (const socket of sockets) {
      socket.classList.remove(
        "valid-target",
        "invalid-target"
      );
    }

    const eager = Boolean(
      graph.nodes.length <=
        GRAPH_EAGER_CONNECTION_TARGET_NODE_LIMIT &&
      graph.connections.length <=
        GRAPH_EAGER_CONNECTION_TARGET_WIRE_LIMIT
    );
    interaction.eagerTargetClassification =
      eager;
    if (!eager) {
      return false;
    }

    for (const socket of sockets) {
        const target =
          socketRefFromElement(socket);

        if (
          !target ||
          target.direction ===
          interaction.start.direction ||
          (
            target.nodeId ===
              interaction.start.nodeId &&
            target.portId ===
              interaction.start.portId
          )
        ) {
          continue;
        }

        const proposal =
          connectionProposal(
            interaction.start,
            target,
            graph.connections
          );

        socket.classList.add(
          proposal.valid
            ? "valid-target"
            : "invalid-target"
        );
        graphConnectionDragTelemetry
          .eagerTargets += 1;
    }

    return true;
  }

function clearConnectionTargetStates() {
    if (
      activeInteraction?.kind ===
        "connection"
    ) {
      activeInteraction.hoveredTargetElement =
        null;
      activeInteraction.hoveredTargetKey =
        "";
    }
    dom.nodesHost
      ?.querySelectorAll(
        ".rml-graph-socket"
      )
      .forEach(socket =>
        socket.classList.remove(
          "valid-target",
          "invalid-target"
        )
      );
  }

function socketRefAtPoint(
    clientX,
    clientY,
    excluded = null
  ) {
    const elements =
      typeof document.elementsFromPoint ===
        "function"
        ? document.elementsFromPoint(
            clientX,
            clientY
          )
        : [
            document.elementFromPoint(
              clientX,
              clientY
            )
          ];

    for (const element of elements) {
      const candidate =
        socketRefFromElement(element);

      if (!candidate) {
        continue;
      }

      if (
        excluded &&
        candidate.nodeId ===
          excluded.nodeId &&
        candidate.portId ===
          excluded.portId &&
        candidate.direction ===
          excluded.direction
      ) {
        continue;
      }

      return candidate;
    }

    return null;
  }

function connectInputToWire(
    interaction,
    wireTarget,
    clientX,
    clientY
  ) {
    const parent =
      graphConnectionById(
        wireTarget.connectionId
      );

    if (!parent) {
      return {
        connected: false,
        reason:
          "The target wire no longer exists."
      };
    }

    const source =
      sourceSocketRefForConnection(
        parent
      );
    const proposal =
      connectionProposal(
        source,
        interaction.start,
        graph.connections
      );

    if (!proposal.valid) {
      return {
        connected: false,
        reason: proposal.reason
      };
    }

    const position =
      nearestGraphPointOnSvgPath(
        wireTarget.path,
        clientX,
        clientY
      );
    const junction =
      ensureWireJunctionPoint(
        parent,
        wireTarget.segmentIndex,
        position
      );
    const branch =
      proposal.nextConnections.find(
        connection =>
          connection.id ===
            proposal.candidate.id
      );

    if (!branch) {
      return {
        connected: false,
        reason:
          "The typed branch could not be created."
      };
    }

    branch.branchFrom = {
      connectionId: parent.id,
      pointId: junction.id
    };
    branch.points =
      Array.isArray(branch.points)
        ? branch.points
        : [];

    applyAutoVectorUpdates(
      proposal.autoVectorUpdates
    );
    graph.connections =
      proposal.nextConnections;
    normalizeConnectionRouting(
      graph.connections
    );
    graph.selectedConnectionId =
      branch.id;
    graph.selectedNodeId = null;
    graph.selectedNodeIds = [];
    clearSelectedWirePoint();
    currentAnalysis =
      proposal.analysis;

    return {
      connected: true,
      reason: "",
      connection: branch,
      junction
    };
  }

function finishConnectionDrag(
    commit,
    clientX,
    clientY,
    forcedWireTarget = null
  ) {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !==
      "connection"
    ) {
      return;
    }

    let connected = false;
    let failureReason = "";
    let successMessage = "";

    if (commit) {
      const target =
        socketRefAtPoint(
          clientX,
          clientY,
          interaction.originalStart
        );

      if (target) {
        const proposal =
          connectionProposal(
            interaction.start,
            target,
            graph.connections
          );

        if (proposal.valid) {
          applyAutoVectorUpdates(
            proposal.autoVectorUpdates
          );
          graph.connections =
            proposal.nextConnections;
          graph.selectedConnectionId =
            proposal.candidate.id;
          graph.selectedNodeId = null;
          graph.selectedNodeIds = [];
          clearSelectedWirePoint();
          currentAnalysis =
            proposal.analysis;
          connected = true;
        } else {
          failureReason =
            proposal.reason;
        }
      } else {
        const wireTarget =
          forcedWireTarget ||
          wireTargetAtPoint(
            clientX,
            clientY,
            interaction.detachedConnection
              ?.id || null
          );

        if (
          wireTarget &&
          interaction.start.direction ===
            "input"
        ) {
          const result =
            connectInputToWire(
              interaction,
              wireTarget,
              clientX,
              clientY
            );
          connected = result.connected;
          failureReason = result.reason;
        } else if (wireTarget) {
          failureReason =
            "A wire is a value source. Drag an input socket onto it; two outputs cannot be merged implicitly.";
        } else if (
          interaction
            .automaticNodeCreationSuppressed ===
          true
        ) {
          failureReason =
            "The guided connection did not resolve a native socket or wire target. Automatic canvas-helper creation was intentionally suppressed so the owning assistant can apply its deterministic connection fallback without adding a second node.";
        } else {
          const automatic =
            interaction.start.direction ===
              "input"
              ? createAutomaticSourceForInput(
                  interaction,
                  clientX,
                  clientY
                )
              : createAutomaticMonitorForOutput(
                  interaction,
                  clientX,
                  clientY
                );

          if (automatic.attempted) {
            connected =
              automatic.connected;
            failureReason =
              automatic.reason;
            successMessage =
              automatic.message || "";
          } else {
            failureReason =
              "Drop the wire on a compatible socket, on a compatible wire, or on empty graph space to create a typed helper node automatically.";
          }
        }
      }
    }

    if (
      !connected &&
      interaction.detachedConnection
    ) {
      graph.connections.push(
        interaction.detachedConnection
      );
    }

    stopAutoPan();
    clearConnectionPreview();
    clearConnectionTargetStates();
    activeInteraction = null;
    pruneConnections();
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();

    if (
      commit &&
      connected &&
      successMessage
    ) {
      showGraphMessage(
        successMessage,
        "success"
      );
    } else if (
      commit &&
      !connected &&
      failureReason
    ) {
      showGraphMessage(
        failureReason,
        "error"
      );
    }
  }

function beginPalettePointerDrag(
    event,
    operatorId,
    isConfiguration,
    definition
  ) {
    if (
      event.button !== 0 ||
      event.currentTarget.disabled ||
      event.currentTarget.getAttribute(
        "aria-disabled"
      ) === "true"
    ) {
      return;
    }

    if (event.pointerType === "touch") {
      return;
    }

    const touchScrollPending = false;

    if (!touchScrollPending) {
      event.preventDefault();
    }
    event.stopPropagation();

    paletteClickSuppression = null;
    consumedPalettePointerSources.delete(
      event.currentTarget
    );

    activeInteraction = {
      kind: "palette",
      transactionId:
        ++nodeGraphPalettePointerTransactionSequence,
      sourceButton: event.currentTarget,
      pointerId: event.pointerId,
      operatorId,
      isConfiguration,
      definition,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      touchScrollPending,
      dragging: false,
      ghost: null
    };

    if (!touchScrollPending) {
      try {
        event.currentTarget
          .setPointerCapture(
            event.pointerId
          );
      } catch {
      }
    }
  }

function ensurePaletteGhost() {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !== "palette" ||
      interaction.ghost
    ) {
      return;
    }

    const ghost =
      document.createElement("div");
    ghost.className =
      "rml-graph-palette-ghost";
    const symbol =
      document.createElement("span");
    symbol.textContent =
      interaction.definition.symbol;
    const title =
      document.createElement("strong");
    title.textContent =
      interaction.definition.title;
    ghost.append(symbol, title);
    document.body.appendChild(ghost);
    interaction.ghost = ghost;
  }

function movePaletteGhost(
    clientX,
    clientY
  ) {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !== "palette"
    ) {
      return;
    }

    interaction.clientX = clientX;
    interaction.clientY = clientY;

    const distance =
      Math.hypot(
        clientX - interaction.startX,
        clientY - interaction.startY
      );

    if (
      !interaction.dragging &&
      distance >= 5
    ) {
      interaction.dragging = true;
      ensurePaletteGhost();
      startAutoPan(
        clientX,
        clientY,
        () => {}
      );
    }

    if (interaction.ghost) {
      interaction.ghost.dataset.rmlGhostX =
        String(clientX + 14);
      interaction.ghost.dataset.rmlGhostY =
        String(clientY + 14);
    }

    updateAutoPanPointer(
      clientX,
      clientY
    );
  }

function finishPaletteDrag(
    commit,
    clientX,
    clientY
  ) {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !== "palette"
    ) {
      return;
    }

    const wasDragging =
      interaction.dragging;
    const guided =
      guidedInteractionAutoPanSuppressed;

    if (interaction.sourceButton instanceof HTMLElement) {
      consumedPalettePointerSources.add(
        interaction.sourceButton
      );
    }
    paletteClickSuppression = {
      transactionId:
        interaction.transactionId || 0,
      pointerId: interaction.pointerId,
      operatorId: interaction.operatorId,
      wasDragging,
      committed: commit === true
    };

    interaction.ghost?.remove();
    activeInteraction = null;
    stopAutoPan();

    if (!commit) {
      if (guided) {
        lastGuidedPaletteDropState = {
          ok: false,
          reason: "pointer-cancelled",
          operatorId: interaction.operatorId,
          pointerId: interaction.pointerId
        };
      }
      return;
    }

    if (!wasDragging) {
      const editorDropTarget = !guided
        ? activeCustomCSharpDropEditor()
        : null;
      if (editorDropTarget) {
        const resolved =
          customCSharpNodeDropSnippet(
            {
              version: 1,
              operatorId:
                interaction.operatorId,
              title:
                interaction.definition?.title ||
                ""
            },
            editorDropTarget.specification,
            interaction.definition
          );
        if (
          resolved &&
          editorDropTarget.insertNodeSnippet?.(
            resolved
          )
        ) {
          customCSharpActiveEditorKey =
            editorDropTarget.editorKey || "";
          bringCustomCSharpOverlayToFront(
            editorDropTarget.overlay
          );
          paletteDragSuppressClickUntil =
            performance.now() + 300;
          showGraphMessage(
            `${interaction.definition?.title || "Node"} inserted into the active C# editor.`,
            "success"
          );
          return;
        }
        showGraphMessage(
          "The active code editor is still loading. Try again in a moment.",
          "error"
        );
        return;
      }
      addPaletteNodeAtCenter(
        interaction.operatorId,
        interaction.isConfiguration
      );
      paletteDragSuppressClickUntil =
        performance.now() + 300;
      if (guided) {
        lastGuidedPaletteDropState = {
          ok: true,
          reason: "palette-click-created-at-center",
          operatorId: interaction.operatorId,
          pointerId: interaction.pointerId,
          wasDragging: false
        };
      }
      return;
    }

    const {
      target,
      editor: editorDropTarget
    } = customCSharpEditorDropTargetAt(
      clientX,
      clientY
    );
    if (editorDropTarget) {
      const resolved =
        customCSharpNodeDropSnippet(
          {
            version: 1,
            operatorId:
              interaction.operatorId,
            title:
              interaction.definition?.title ||
              ""
          },
          editorDropTarget.specification,
          interaction.definition
        );
      if (
        resolved &&
        editorDropTarget.insertNodeSnippet?.(
          resolved
        )
      ) {
        customCSharpActiveEditorKey =
          editorDropTarget.editorKey || "";
        bringCustomCSharpOverlayToFront(
          editorDropTarget.overlay
        );
        paletteDragSuppressClickUntil =
          performance.now() + 300;
        if (guided) {
          lastGuidedPaletteDropState = {
            ok: true,
            reason: "palette-node-inserted-as-csharp",
            operatorId:
              interaction.operatorId,
            pointerId:
              interaction.pointerId,
            wasDragging: true
          };
        }
        showGraphMessage(
          `${interaction.definition?.title || "Node"} inserted into the C# editor.`,
          "success"
        );
        return;
      }
      showGraphMessage(
        "The code editor is still loading. Try the drop again in a moment.",
        "error"
      );
      return;
    }

    const viewportRectangle =
      dom.viewport?.getBoundingClientRect?.();
    const guidedGeometricDrop = Boolean(
      guided &&
      viewportRectangle &&
      clientX >= viewportRectangle.left &&
      clientX <= viewportRectangle.right &&
      clientY >= viewportRectangle.top &&
      clientY <= viewportRectangle.bottom
    );

    if (
      !target?.closest?.(
        ".rml-graph-viewport"
      ) &&
      !guidedGeometricDrop
    ) {
      if (guided) {
        lastGuidedPaletteDropState = {
          ok: false,
          reason: "release-outside-runtime-viewport",
          operatorId: interaction.operatorId,
          pointerId: interaction.pointerId,
          clientX,
          clientY,
          directViewportHit: false,
          guidedGeometricDrop: false
        };
      }
      showGraphMessage(
        "Drop the node inside the graph canvas.",
        "error"
      );
      return;
    }

    const point =
      clientToGraph(
        clientX,
        clientY
      );

    let createdNode = null;
    if (
      String(
        interaction.operatorId
      ).startsWith(
        SAVED_API_COMPOSITE_PALETTE_PREFIX
      )
    ) {
      void instantiateSavedApiCompositeAt(
        String(
          interaction.operatorId
        ).slice(
          SAVED_API_COMPOSITE_PALETTE_PREFIX.length
        ),
        point.x - 130,
        point.y - 35
      );
    } else if (interaction.isConfiguration) {
      createdNode = addConfigurationNode(
        point.x - 190,
        point.y - 35
      );
    } else {
      createdNode = addOperatorNode(
        interaction.operatorId,
        point.x - 130,
        point.y - 35
      );
    }

    paletteDragSuppressClickUntil =
      performance.now() + 300;
    if (guided) {
      lastGuidedPaletteDropState = {
        ok: true,
        reason: "native-palette-drop-committed",
        operatorId: interaction.operatorId,
        pointerId: interaction.pointerId,
        clientX,
        clientY,
        wasDragging: true,
        nodeId: createdNode?.id || "",
        nodeKind: createdNode?.kind || "",
        directViewportHit: Boolean(
          target?.closest?.(".rml-graph-viewport")
        ),
        guidedGeometricDrop
      };
    }
  }

function startAutoPan(
    clientX,
    clientY,
    callback
  ) {
    if (guidedInteractionAutoPanSuppressed) {
      stopAutoPan();
      return;
    }

    autoPanState = {
      clientX,
      clientY,
      callback
    };

    if (!autoPanFrame) {
      autoPanFrame =
        requestProjectAnimationFrame(
          runAutoPan
        );
    }
  }

function updateAutoPanPointer(
    clientX,
    clientY
  ) {
    if (
      guidedInteractionAutoPanSuppressed ||
      !autoPanState
    ) {
      return;
    }

    autoPanState.clientX = clientX;
    autoPanState.clientY = clientY;
  }

function runAutoPan() {
    autoPanFrame = 0;

    if (
      guidedInteractionAutoPanSuppressed ||
      !autoPanState ||
      !dom.viewport
    ) {
      if (guidedInteractionAutoPanSuppressed) {
        autoPanState = null;
      }
      return;
    }

    const rectangle =
      dom.viewport.getBoundingClientRect();
    const x =
      autoPanState.clientX;
    const y =
      autoPanState.clientY;
    let moveX = 0;
    let moveY = 0;

    const hoveredSocket =
      document
        .elementFromPoint(x, y)
        ?.closest?.(
          ".rml-graph-socket"
        );

    if (
      !hoveredSocket &&
      x >= rectangle.left &&
      x <= rectangle.right &&
      y >= rectangle.top &&
      y <= rectangle.bottom
    ) {
      if (
        x < rectangle.left +
        GRAPH_AUTOPAN_EDGE
      ) {
        const strength =
          1 -
          (x - rectangle.left) /
            GRAPH_AUTOPAN_EDGE;
        moveX =
          GRAPH_AUTOPAN_MAX_SPEED *
          strength * strength;
      } else if (
        x > rectangle.right -
        GRAPH_AUTOPAN_EDGE
      ) {
        const strength =
          1 -
          (rectangle.right - x) /
            GRAPH_AUTOPAN_EDGE;
        moveX =
          -GRAPH_AUTOPAN_MAX_SPEED *
          strength * strength;
      }

      if (
        y < rectangle.top +
        GRAPH_AUTOPAN_EDGE
      ) {
        const strength =
          1 -
          (y - rectangle.top) /
            GRAPH_AUTOPAN_EDGE;
        moveY =
          GRAPH_AUTOPAN_MAX_SPEED *
          strength * strength;
      } else if (
        y > rectangle.bottom -
        GRAPH_AUTOPAN_EDGE
      ) {
        const strength =
          1 -
          (rectangle.bottom - y) /
            GRAPH_AUTOPAN_EDGE;
        moveY =
          -GRAPH_AUTOPAN_MAX_SPEED *
          strength * strength;
      }
    }

    if (
      moveX !== 0 ||
      moveY !== 0
    ) {
      graph.viewport.x += moveX;
      graph.viewport.y += moveY;
      applyViewportTransform();
      autoPanState.callback?.();
    }

    autoPanFrame =
      requestProjectAnimationFrame(
        runAutoPan
      );
  }

function stopAutoPan() {
    autoPanState = null;

    if (autoPanFrame) {
      cancelAnimationFrame(
        autoPanFrame
      );
      autoPanFrame = 0;
    }
  }

function applyGraphInteractionMotion(
    motion
  ) {
    if (
      !motion ||
      !activeInteraction ||
      motion.pointerId !==
        activeInteraction.pointerId
    ) {
      return;
    }
    const clientX = motion.clientX;
    const clientY = motion.clientY;

    if (activeInteraction.kind === "pan") {
      graph.viewport.x =
        activeInteraction.originalX +
        clientX -
        activeInteraction.startX;
      graph.viewport.y =
        activeInteraction.originalY +
        clientY -
        activeInteraction.startY;
      applyViewportTransform();
    } else if (activeInteraction.kind === "node") {
      updateNodeDragPosition(
        clientX,
        clientY
      );
    } else if (
      activeInteraction.kind ===
        "node-resize"
    ) {
      updateNodeResize(
        clientX,
        clientY
      );
    } else if (
      activeInteraction.kind ===
        "wire-segment"
    ) {
      updateWireSegmentDrag(
        clientX,
        clientY
      );
    } else if (
      activeInteraction.kind ===
        "wire-point"
    ) {
      updateWirePointDrag(
        clientX,
        clientY
      );
    } else if (
      activeInteraction.kind ===
        "connection"
    ) {
      activeInteraction.clientX = clientX;
      activeInteraction.clientY = clientY;
      updateAutoPanPointer(
        clientX,
        clientY
      );
      updateHoveredConnectionTarget(
        clientX,
        clientY
      );
      renderConnectionPreview();
    }
  }

function queueGraphInteractionMotion(
    pointerId,
    clientX,
    clientY
  ) {
    graphPendingInteractionMotion = {
      pointerId,
      clientX,
      clientY
    };
    if (graphInteractionMotionFrame) {
      return;
    }
    graphInteractionMotionFrame =
      requestProjectAnimationFrame(() => {
        graphInteractionMotionFrame = 0;
        const motion =
          graphPendingInteractionMotion;
        graphPendingInteractionMotion = null;
        applyGraphInteractionMotion(
          motion
        );
      });
  }

function flushGraphInteractionMotion(
    pointerId = null
  ) {
    if (
      graphInteractionMotionFrame
    ) {
      cancelAnimationFrame(
        graphInteractionMotionFrame
      );
      graphInteractionMotionFrame = 0;
    }
    const motion =
      graphPendingInteractionMotion;
    graphPendingInteractionMotion = null;
    if (
      motion &&
      (
        pointerId === null ||
        motion.pointerId === pointerId
      )
    ) {
      applyGraphInteractionMotion(
        motion
      );
    }
  }

function handleDocumentPointerMove(event) {
    if (!activeInteraction) {
      return;
    }

    if (
      event.pointerId !==
      activeInteraction.pointerId
    ) {
      return;
    }

    if (
      activeInteraction.kind ===
        "palette" &&
      activeInteraction.touchScrollPending
    ) {
      const deltaX =
        event.clientX -
        activeInteraction.startX;
      const deltaY =
        event.clientY -
        activeInteraction.startY;
      const horizontalDistance =
        Math.abs(deltaX);
      const verticalDistance =
        Math.abs(deltaY);

      if (
        verticalDistance >= 6 &&
        verticalDistance >
          horizontalDistance
      ) {
        activeInteraction = null;
        return;
      }

      if (horizontalDistance < 7) {
        return;
      }

      activeInteraction.touchScrollPending =
        false;

      try {
        activeInteraction.sourceButton
          ?.setPointerCapture?.(
            event.pointerId
          );
      } catch {
      }
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (
      activeInteraction.kind ===
      "palette"
    ) {
      movePaletteGhost(
        event.clientX,
        event.clientY
      );
    } else {
      queueGraphInteractionMotion(
        event.pointerId,
        event.clientX,
        event.clientY
      );
    }
  }

function handleDocumentPointerUp(event) {
    if (
      !activeInteraction ||
      event.pointerId !==
        activeInteraction.pointerId
    ) {
      return;
    }

    if (
      activeInteraction.kind ===
        "palette" &&
      activeInteraction.touchScrollPending
    ) {
      activeInteraction = null;
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();
    flushGraphInteractionMotion(
      event.pointerId
    );

    if (
      activeInteraction.kind ===
      "pan"
    ) {
      dom.viewport?.classList.remove(
        "panning"
      );
      activeInteraction = null;
      persistGraphView();
      if (graphGpuOverviewActive()) {
        graphForcedNodeIds.clear();
        graphNodeVirtualizationSignature = "";
        synchronizeGpuOverviewNodes();
      }
      scheduleGraphNodeVirtualization();
      if (fallbackGraphVirtualizationActive()) {
        scheduleGraphWireRender();
      }
    } else if (
      activeInteraction.kind ===
      "node"
    ) {
      const nodeInteraction =
        activeInteraction;
      const node =
        findGraphNode(
          nodeInteraction.nodeId
        );

      const editorDropTarget =
        nodeInteraction.dragging
          ? customCSharpEditorDropTargetAt(
              event.clientX,
              event.clientY
            ).editor
          : null;
      if (node && editorDropTarget) {
        const definition =
          nodeDefinition(node);
        const resolved =
          customCSharpNodeDropSnippet(
            {
              version: 1,
              operatorId:
                node.operatorId,
              title:
                node.label ||
                definition?.title ||
                "Node"
            },
            editorDropTarget.specification,
            definition,
            node
          );
        if (
          resolved &&
          editorDropTarget.insertNodeSnippet?.(
            resolved
          )
        ) {
          customCSharpActiveEditorKey =
            editorDropTarget.editorKey || "";
          node.x = nodeInteraction.originalX;
          node.y = nodeInteraction.originalY;
          invalidateGraphNodeViewportSpatialIndex(
            node.id
          );
          const element =
            dom.nodesHost?.querySelector(
              `[data-graph-node-id="${CSS.escape(node.id)}"]`
            );
          if (element) {
            element.dataset.rmlNodeX =
              String(node.x);
            element.dataset.rmlNodeY =
              String(node.y);
            cacheGraphNodeGeometry(
              node,
              element
            );
          }
          const connectionIds =
            nodeInteraction.connectionIds;
          activeInteraction = null;
          stopAutoPan();
          scheduleGraphWireRender(
            connectionIds
          );
          bringCustomCSharpOverlayToFront(
            editorDropTarget.overlay
          );
          renderGraphInspector();
          showGraphMessage(
            `${node.label || definition?.title || "Node"} inserted into the C# editor.`,
            "success"
          );
          return;
        }
        node.x = nodeInteraction.originalX;
        node.y = nodeInteraction.originalY;
        invalidateGraphNodeViewportSpatialIndex(
          node.id
        );
        activeInteraction = null;
        stopAutoPan();
        renderGraphNodesAndWires();
        showGraphMessage(
          "The code editor is still loading. Try the drop again in a moment.",
          "error"
        );
        return;
      }

      if (
        node &&
        nodeInteraction.dragging
      ) {
        node.x =
          Math.round(
            node.x / GRAPH_GRID
          ) * GRAPH_GRID;
        node.y =
          Math.round(
            node.y / GRAPH_GRID
          ) * GRAPH_GRID;
        invalidateGraphNodeViewportSpatialIndex(
          node.id
        );

        const element =
          dom.nodesHost?.querySelector(
            `[data-graph-node-id="${CSS.escape(node.id)}"]`
          );
        if (element) {
          element.dataset.rmlNodeX =
            String(node.x);
          element.dataset.rmlNodeY =
            String(node.y);
          cacheGraphNodeGeometry(
            node,
            element
          );
        }
      }

      const connectionIds =
        nodeInteraction.connectionIds;
      activeInteraction = null;
      stopAutoPan();
      persistGraphView(
        false,
        nodeInteraction.dragging === true
      );
      scheduleGraphWireRender(
        connectionIds
      );
      renderGraphInspector();
    } else if (
      activeInteraction.kind ===
      "node-resize"
    ) {
      finishNodeResize(true);
    } else if (
      activeInteraction.kind ===
      "wire-segment"
    ) {
      finishWireSegmentDrag(true);
    } else if (
      activeInteraction.kind ===
      "wire-point"
    ) {
      finishWirePointDrag(true);
    } else if (
      activeInteraction.kind ===
      "connection"
    ) {
      finishConnectionDrag(
        true,
        event.clientX,
        event.clientY
      );
    } else if (
      activeInteraction.kind ===
      "palette"
    ) {
      finishPaletteDrag(
        true,
        event.clientX,
        event.clientY
      );
    }
  }

function cancelInteraction(
    restoreOriginal
  ) {
    if (graphInteractionMotionFrame) {
      cancelAnimationFrame(
        graphInteractionMotionFrame
      );
      graphInteractionMotionFrame = 0;
    }
    graphPendingInteractionMotion = null;
    if (!activeInteraction) {
      return false;
    }

    const interaction =
      activeInteraction;

    if (
      interaction.kind === "pan"
    ) {
      if (restoreOriginal) {
        graph.viewport.x =
          interaction.originalX;
        graph.viewport.y =
          interaction.originalY;
        applyViewportTransform();
      }
      dom.viewport?.classList.remove(
        "panning"
      );
      activeInteraction = null;
    } else if (
      interaction.kind === "node"
    ) {
      if (restoreOriginal) {
        const node =
          findGraphNode(
            interaction.nodeId
          );
        if (node) {
          node.x =
            interaction.originalX;
          node.y =
            interaction.originalY;
          invalidateGraphNodeViewportSpatialIndex(
            node.id
          );
        }
      }
      activeInteraction = null;
      renderGraphNodesAndWires();
    } else if (
      interaction.kind ===
      "node-resize"
    ) {
      finishNodeResize(
        false,
        restoreOriginal
      );
    } else if (
      interaction.kind ===
      "wire-segment"
    ) {
      finishWireSegmentDrag(
        false,
        restoreOriginal
      );
    } else if (
      interaction.kind ===
      "wire-point"
    ) {
      finishWirePointDrag(
        false,
        restoreOriginal
      );
    } else if (
      interaction.kind ===
      "connection"
    ) {
      finishConnectionDrag(
        false,
        interaction.clientX,
        interaction.clientY
      );
    } else if (
      interaction.kind ===
      "palette"
    ) {
      interaction.ghost?.remove();
      activeInteraction = null;
    }

    stopAutoPan();
    clearConnectionTargetStates();
    persistGraph();
    return true;
  }

function handleGraphKeyDown(event) {
    if (
      !graph?.active ||
      !runtimeGraphViewActive
    ) {
      return;
    }

    if (event.key === "Escape") {
      if (cancelInteraction(true)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      const searchOverlayOpen =
        Boolean(
          dom.root?.querySelector(
            ":scope > .rml-graph-search-overlay:not([hidden])"
          )
        );
      const nestedEditorOpen =
        Boolean(
          event.target?.closest?.(
            ".rml-graph-searchable-select.open"
          )
        );
      const dialogOpen =
        Boolean(
          document.querySelector(
            "dialog[open]"
          )
        );

      if (
        graphEditModeActive() &&
        !searchOverlayOpen &&
        !nestedEditorOpen &&
        !dialogOpen
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setGraphEditMode(false);
      }
      return;
    }

    const active =
      document.activeElement;

    if (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      active?.isContentEditable
    ) {
      return;
    }

    if (
      event.key === "Delete" ||
      event.key === "Backspace"
    ) {
      if (
        graph.selectedNodeId ||
        graph.selectedConnectionId ||
        graph.selectedWirePoint
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        deleteSelectedGraphItem();
      }
      return;
    }

    if (
      (event.ctrlKey || event.metaKey) &&
      event.key === "0"
    ) {
      event.preventDefault();
      centerGraph();
    }
  }

function handleBuilderRendered(event) {
    if (!bridge) {
      return;
    }

    const renderedProjectEpoch =
      Number(
        event?.detail?.projectEpoch
      ) || 0;
    if (
      renderedProjectEpoch > 0 &&
      builderProjectEpoch > 0 &&
      renderedProjectEpoch !==
        builderProjectEpoch
    ) {
      return;
    }
    if (renderedProjectEpoch > 0) {
      builderProjectEpoch =
        renderedProjectEpoch;
    }

    const incoming =
      bridge.getExtensionStateReference
        ? bridge.getExtensionStateReference(
            EXTENSION_NAME
          )
        : bridge.getExtensionState(
            EXTENSION_NAME
          );

    if (
      incoming !== graph &&
      incoming !==
        lastPersistedGraphReference &&
      !activeInteraction
    ) {
      graph = sanitizeGraphState(incoming);
      openGraphCatalogReconciliationCompletedKey =
        "";
      graph.lastOpenPage =
        savedPresentationPage();

      
      runtimeGraphViewActive = false;
      updateGraphCatalogReadiness();
      resetGraphRenderCaches();
      pruneConnections();
      graphCodegenRevision += 1;
      if (incoming === null) {
        lastPersistedGraphReference = null;
        typedGraphCodegenCacheKey = "";
        typedGraphCodegenCache = null;
      } else {
        persistGraph(true);
      }
      void scheduleOpenGraphCatalogReconciliation()
        .finally(() => {
          void scheduleSavedApiCompositeCatalogReconciliation();
        });
    }

    cacheDom();
    ensurePackButton();

    if (hasPackedRuntimeProgram()) {
      synchronizePackedSnapshot(false);
    }

    if (
      graph.active &&
      savedPresentationPage() === "runtime-graph" &&
      graphCatalogReadiness === "ready"
    ) {
      activateGraphMode();
    } else {
      deactivateGraphMode();
      updatePackButton();
    }
  }

function initializeNodeGraphHost() {
    if (graphHostInitialized) {
      return true;
    }

    bridge =
      window.RMLBuilderBridge;

    if (!bridge) {
      return false;
    }

    builderProjectEpoch =
      Number(
        bridge.getProjectEpoch?.()
      ) || 0;

    graphHostInitialized = true;

    cacheDom();

    const initialExtensionState =
      bridge.getExtensionStateReference
        ? bridge.getExtensionStateReference(
            EXTENSION_NAME
          )
        : bridge.getExtensionState(
            EXTENSION_NAME
          );
    graph = sanitizeGraphState(
      initialExtensionState
    );
    graph.lastOpenPage =
      savedPresentationPage();
    updateGraphCatalogReadiness();
    runtimeGraphViewActive =
      graph.active === true &&
      savedPresentationPage() === "runtime-graph" &&
      graphCatalogReadiness === "ready";
    if (
      graph.active === true &&
      graphUsesCatalogOperators(graph) &&
      apiCompositeCatalogAvailable() &&
      !graphHasCurrentCatalogFingerprint(
        graph,
        currentApiCompositeCatalogIdentity()
      )
    ) {
      graphCatalogReadiness = "pending";
      graphCatalogReadinessMessage =
        "Checking the restored Runtime Graph and every placed API Composite against the current catalog…";
      runtimeGraphViewActive = false;
    }
    resetGraphRenderCaches();

    loadGraphPaletteUiState();
    void loadSavedApiCompositeLibrary()
      .then(() => {
        if (
          graph?.active &&
          runtimeGraphViewActive
        ) {
          renderGraphPalette();
          renderGraphInspector();
        }
        void scheduleOpenGraphCatalogReconciliation()
          .finally(() => {
            void scheduleSavedApiCompositeCatalogReconciliation();
          });
      });

    window.addEventListener(
      "pagehide",
      event => {
        flushGraphViewPersistence(true);
        captureGraphPaletteUiState();
        persistGraphPaletteUiState(true);
        if (event.persisted !== true) {
          releaseGraphToolbarResizeTracking();
          disposeGraphHybridRenderer();
        }
      },
      { capture: true }
    );

    window.addEventListener(
      "resize",
      applyGraphPanelLayout,
      { passive: true }
    );

    window.addEventListener(
      "resize",
      updateGraphEditViewportMetrics,
      { passive: true }
    );

    window.addEventListener(
      "orientationchange",
      updateGraphEditViewportMetrics,
      { passive: true }
    );

    synchronizeRuntimeBridgeSubscription();
    pruneConnections();
    if (initialExtensionState === null) {
      lastPersistedGraphReference = null;
      typedGraphCodegenCacheKey = "";
      typedGraphCodegenCache = null;
    } else {
      persistGraph(true);
    }

    ensurePackButton();
    loadGraphPanelLayout();
    ensureGraphPanelToggles();
    void scheduleOpenGraphCatalogReconciliation()
      .finally(() => {
        void scheduleSavedApiCompositeCatalogReconciliation();
      });

    document.addEventListener(
      "rml-builder:rendered",
      handleBuilderRendered
    );

    document.addEventListener(
      "rml-builder:project-replacement",
      handleProjectReplacement
    );

    document.addEventListener(
      "pointermove",
      handleDocumentPointerMove,
      {
        capture: true,
        passive: false
      }
    );

    document.addEventListener(
      "pointerup",
      handleDocumentPointerUp,
      {
        capture: true,
        passive: false
      }
    );

    document.addEventListener(
      "pointercancel",
      event => {
        if (
          activeInteraction &&
          event.pointerId ===
            activeInteraction.pointerId
        ) {
          event.preventDefault();
          cancelInteraction(true);
        }
      },
      {
        capture: true,
        passive: false
      }
    );

    if (window.RMLScrollManager?.registerWheelHandler) {
      window.RMLScrollManager.registerWheelHandler(
        "typed-node-graph-scroll",
        event => {
          const before = event.defaultPrevented;
          handleGraphWheel(event);
          return !before && event.defaultPrevented;
        },
        200
      );
    } else {
      window.addEventListener(
        "wheel",
        handleGraphWheel,
        {
          capture: true,
          passive: false
        }
      );
    }

    document.addEventListener(
      "keydown",
      handleGraphScrollLayerCancelKeyDown,
      {
        capture: true
      }
    );

    document.addEventListener(
      "keydown",
      handleGraphKeyDown,
      {
        capture: true
      }
    );

    document.addEventListener(
      "keyup",
      handleGraphModifierKeyUp,
      {
        capture: true
      }
    );

    document.addEventListener(
      "pointerdown",
      handleGraphScrollLayerCancelClick,
      {
        capture: true
      }
    );

    document.addEventListener(
      "click",
      handleGraphScrollLayerCancelClick,
      {
        capture: true
      }
    );

    document.addEventListener(
      "scroll",
      scheduleGraphScrollLayerVisualRefresh,
      {
        capture: true,
        passive: true
      }
    );

    window.addEventListener(
      "resize",
      scheduleGraphScrollLayerVisualRefresh,
      {
        passive: true
      }
    );

    window.addEventListener(
      "blur",
      () => {
        if (graphScrollLayerSession) {
          commitGraphScrollLayerSelection();
        }
      }
    );

    window.visualViewport
      ?.addEventListener(
        "resize",
        scheduleGraphScrollLayerVisualRefresh,
        {
          passive: true
        }
      );

    window.visualViewport
      ?.addEventListener(
        "resize",
        updateGraphEditViewportMetrics,
        {
          passive: true
        }
      );

    window.visualViewport
      ?.addEventListener(
        "scroll",
        scheduleGraphScrollLayerVisualRefresh,
        {
          passive: true
        }
      );

    window.visualViewport
      ?.addEventListener(
        "scroll",
        updateGraphEditViewportMetrics,
        {
          passive: true
        }
      );

    document.addEventListener(
      "input",
      event => {
        if (
          event.target.closest(
            ".identity"
          )
        ) {
          if (hasPackedRuntimeProgram()) {
            schedulePackedSnapshotSync();
          }

          if (graph?.active) {
            requestProjectAnimationFrame(
              () =>
                synchronizeRuntimeBridgeSubscription(
                  true
                )
            );
          } else {
            requestProjectAnimationFrame(
              updateSourceBadge
            );
          }
        }

        if (
          event.target.closest(
            "#settings-preview-dialog"
          )
        ) {
          requestProjectAnimationFrame(() => {
            requestProjectAnimationFrame(
              refreshDisplayValueNodes
            );
          });
        }
      },
      true
    );

    document.addEventListener(
      "click",
      event => {
        if (
          event.target.closest(
            "#settings-preview-dialog"
          )
        ) {
          requestProjectAnimationFrame(() => {
            requestProjectAnimationFrame(
              refreshDisplayValueNodes
            );
          });
        }
      },
      true
    );

    if (hasPackedRuntimeProgram()) {
      synchronizePackedSnapshot(false);
    }

    if (
      graph.active &&
      runtimeGraphViewActive
    ) {
      activateGraphMode();
    }

    bridge
      .requestGeneratedOutputRefresh
      ?.();

    return true;
  }

function graphUsesCatalogOperators(
    value = graph
  ) {
    const operatorNodes =
      graphOperatorNodesIncludingCustomCSharp(
        value
      );
    return Boolean(
      operatorNodes.some(node => {
        if (node?.kind !== "operator") {
          return false;
        }
        const contract =
          node.apiContract ||
          OPERATOR_DEFINITIONS[
            node.operatorId
          ]?.preservedApiContract;
        return String(
          node.operatorId || ""
        ).startsWith("api.") ||
          Boolean(
            String(contract?.ownerType || "").trim() &&
            String(contract?.kind || "").trim()
          );
      })
    );
  }

function missingGraphCatalogOperatorIds(
    value = graph
  ) {
    const operatorNodes =
      graphOperatorNodesIncludingCustomCSharp(
        value
      );

    return [
      ...new Set(
        operatorNodes
          .filter(node =>
            node?.kind === "operator" &&
            String(
              node.operatorId || ""
            ).startsWith("api.") &&
            !OPERATOR_DEFINITIONS[
              node.operatorId
            ]
          )
          .map(node =>
            String(node.operatorId)
          )
      )
    ].sort();
  }

function graphCatalogDefinitionsReady(
    value = graph
  ) {
    const catalog =
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null;
    const report =
      window.RMLApiNodeFactoryReport ||
      null;
    const factoryMatchesCatalog =
      catalogFactoryIdentityMatches(
        catalog,
        report
      );

    return !graphUsesCatalogOperators(value) ||
      (
        factoryMatchesCatalog &&
        missingGraphCatalogOperatorIds(
          value
        ).length === 0
      );
  }

function graphCatalogContractIssues(
    value = graph
  ) {
    const issues = [];
    const visited = new Set();
    const append = (
      candidate,
      path = "runtime-root",
      insideApiComposite = false
    ) => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate) ||
        visited.has(candidate) ||
        !Array.isArray(candidate.nodes)
      ) {
        return;
      }
      visited.add(candidate);
      for (const node of candidate.nodes) {
        if (node?.kind !== "operator") {
          continue;
        }
        const operatorId = String(
          node.operatorId || ""
        );
        const definition =
          OPERATOR_DEFINITIONS[
            operatorId
          ];
        const storedContract =
          node.apiContract &&
          typeof node.apiContract ===
            "object" &&
          !Array.isArray(node.apiContract)
            ? node.apiContract
            : null;
        const currentContract =
          portableApiContract(
            definition
          );
        const catalogNode =
          operatorId.startsWith("api.") ||
          definition?.catalogGenerated ===
            true ||
          Boolean(storedContract);
        if (!catalogNode) {
          continue;
        }
        if (
          definition?.catalogGenerated !==
            true ||
          !storedContract ||
          !currentContract ||
          savedApiContractSemanticKey(
            storedContract
          ) !==
            savedApiContractSemanticKey(
              currentContract
            )
        ) {
          issues.push({
            nodeId: String(node.id || ""),
            operatorId,
            path,
            insideApiComposite
          });
        }
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
          `${path}/custom-csharp:${String(ownerId || "<unnamed>")}`,
          insideApiComposite
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
          `${path}/api-composite:${String(ownerId || "<unnamed>")}`,
          true
        );
      }
    };
    append(value);
    return issues;
  }

function runtimeGraphCatalogGeometrySignature(
    value
  ) {
    const views = [];
    const visited = new Set();
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
      views.push({
        path,
        nodes: candidate.nodes.map(node => ({
          id: String(node?.id || ""),
          x: finiteNumber(node?.x, 0),
          y: finiteNumber(node?.y, 0),
          width:
            node?.width == null
              ? null
              : finiteNumber(node.width, 0),
          height:
            node?.height == null
              ? null
              : finiteNumber(node.height, 0)
        })),
        connections:
          candidate.connections.map(
            connection => {
              const {
                fromPort: _fromPort,
                toPort: _toPort,
                ...routing
              } = connection || {};
              return nodeGraphClone(routing);
            }
          )
      });
      for (const [ownerId, customGraph] of
        Object.entries(
          candidate.customCSharpFiles || {}
        )) {
        append(
          customGraph,
          `${path}/custom-csharp:${String(ownerId || "<unnamed>")}`
        );
      }
      for (const [ownerId, composite] of
        Object.entries(
          candidate.apiCompositeGraphs || {}
        )) {
        append(
          composite,
          `${path}/api-composite:${String(ownerId || "<unnamed>")}`
        );
      }
    };
    append(value);
    return JSON.stringify(views);
  }

function graphHasCurrentCatalogFingerprint(
    value,
    identity
  ) {
    return Boolean(
      identity.fingerprint &&
      Array.isArray(
        value?.apiCompatibility?.history
      ) &&
      value.apiCompatibility.history.some(
        entry =>
          String(
            entry?.catalogFingerprint ||
            ""
          ) === identity.fingerprint &&
          String(
            entry?.engineVersion || ""
          ) === identity.engineVersion &&
          ["verified", "migrated"]
            .includes(
              String(entry?.status || "")
            )
      )
    );
  }

function stampGraphCurrentCatalogFingerprint(
    value,
    identity
  ) {
    const history = Array.isArray(
      value?.apiCompatibility?.history
    )
      ? value.apiCompatibility.history
          .map(entry => nodeGraphClone(entry))
      : [];
    if (
      !graphHasCurrentCatalogFingerprint(
        value,
        identity
      )
    ) {
      history.push({
        schemaVersion: 1,
        catalogFingerprint:
          identity.fingerprint,
        engineVersion:
          identity.engineVersion,
        catalogRevision: String(
          window.RMLResoniteApiCatalog
            ?.contractRevision ||
          identity.fingerprint
        ),
        operatorMigrations: {},
        portMigrations: {},
        unresolvedApiNodes: [],
        status: "verified"
      });
    }
    value.apiCompatibility = {
      schemaVersion: 1,
      history: history.slice(-32)
    };
    const visited = new Set();
    const stampComposites = candidate => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        visited.has(candidate)
      ) {
        return;
      }
      visited.add(candidate);
      for (const nested of Object.values(
        candidate.customCSharpFiles || {}
      )) {
        stampComposites(nested);
      }
      for (const composite of Object.values(
        candidate.apiCompositeGraphs || {}
      )) {
        composite.createdCatalogFingerprint =
          identity.fingerprint;
        composite.createdEngineVersion =
          identity.engineVersion;
        stampComposites(composite);
      }
    };
    stampComposites(value);
    return value;
  }

async function confirmOpenGraphCatalogUpdate(
    issues
  ) {
    const confirm =
      window.RMLBuilderDialog?.confirm;
    if (typeof confirm !== "function") {
      return false;
    }
    const compositeCount =
      issues.filter(
        issue => issue.insideApiComposite
      ).length;
    return Boolean(
      await confirm({
        tone: "warning",
        kicker:
          "Runtime Graph catalog update",
        title:
          "Apply compatible API replacements?",
        message:
          "The current catalog requires real operator or port changes in the open Runtime Graph. The resolved copy is applied only after this confirmation.",
        details:
          `${issues.length.toLocaleString("de-DE")} incompatible catalog node${issues.length === 1 ? "" : "s"} were resolved, including ${compositeCount.toLocaleString("de-DE")} inside placed API Composite${compositeCount === 1 ? "" : "s"}. Node positions and all stored wire-routing geometry must remain identical; otherwise the update is rejected atomically.`,
        confirmLabel:
          "Update Runtime Graph",
        cancelLabel:
          "Keep Current Graph"
      })
    );
  }

async function reconcileOpenGraphForCatalog(
    catalogKey
  ) {
    if (
      !graph?.active ||
      !graphUsesCatalogOperators(graph)
    ) {
      return {
        stale: false,
        skipped: true,
        catalogKey
      };
    }
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
    if (
      graphHasCurrentCatalogFingerprint(
        graph,
        identity
      ) &&
      missingGraphCatalogOperatorIds(
        graph
      ).length === 0
    ) {
      updateGraphCatalogReadiness();
      return {
        stale: false,
        verified: true,
        catalogKey
      };
    }
    const issues =
      graphCatalogContractIssues(graph);
    if (issues.length === 0) {
      stampGraphCurrentCatalogFingerprint(
        graph,
        identity
      );
      persistGraph(true, false);
      updateGraphCatalogReadiness();
      restoreSavedPresentationIfReady();
      return {
        stale: false,
        metadataRefreshed: true,
        catalogKey
      };
    }

    const resolver =
      window.RMLSavedApiCompositeResolver
        ?.resolveGraph;
    if (typeof resolver !== "function") {
      throw new Error(
        "The deterministic catalog replacement resolver is unavailable."
      );
    }
    const sourceGraph = graph;
    const sourceProjectEpoch =
      builderProjectEpoch;
    const sourceSnapshot =
      JSON.stringify(nodeGraphClone(sourceGraph));
    const sourceGeometry =
      runtimeGraphCatalogGeometrySignature(
        sourceGraph
      );
    const resolvedGraph = await resolver(
      nodeGraphClone(sourceGraph),
      {
        name:
          "Current Runtime Graph and placed API Composites",
        context:
          "open-runtime-graph"
      }
    );
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
      graph !== sourceGraph ||
      builderProjectEpoch !==
        sourceProjectEpoch ||
      JSON.stringify(nodeGraphClone(graph)) !==
        sourceSnapshot
    ) {
      throw new Error(
        "The project changed while catalog replacements were being prepared. The resolved copy was discarded."
      );
    }
    const candidate =
      sanitizeGraphState(resolvedGraph);
    candidate.lastOpenPage =
      sourceGraph.lastOpenPage;
    if (
      runtimeGraphCatalogGeometrySignature(
        candidate
      ) !== sourceGeometry
    ) {
      throw new Error(
        "The resolved catalog update changed node placement, node identity or stored wire-routing geometry. The current graph was preserved unchanged."
      );
    }
    const remainingIssues =
      graphCatalogContractIssues(candidate);
    if (remainingIssues.length > 0) {
      throw new Error(
        `The resolved graph still contains ${remainingIssues.length.toLocaleString("de-DE")} incompatible catalog node${remainingIssues.length === 1 ? "" : "s"}. The current graph was preserved unchanged.`
      );
    }
    if (
      !(await confirmOpenGraphCatalogUpdate(
        issues
      ))
    ) {
      graphCatalogReadiness = "failed";
      graphCatalogReadinessMessage =
        "The compatible catalog update was not applied. Click the Runtime Graph button to review the replacements again.";
      updatePackButton();
      return {
        stale: false,
        declined: true,
        catalogKey
      };
    }
    if (
      graph !== sourceGraph ||
      builderProjectEpoch !==
        sourceProjectEpoch ||
      JSON.stringify(nodeGraphClone(graph)) !==
        sourceSnapshot
    ) {
      throw new Error(
        "The project changed before the catalog update could be committed. The resolved copy was discarded."
      );
    }
    stampGraphCurrentCatalogFingerprint(
      candidate,
      identity
    );
    graph = candidate;
    currentAnalysis = null;
    graphNodeDefinitionCache =
      new WeakMap();
    resetGraphRenderCaches();
    pruneConnections();
    persistGraph(true);
    updateGraphCatalogReadiness();
    restoreSavedPresentationIfReady();
    if (runtimeGraphViewActive) {
      renderGraphNodesAndWires();
      renderGraphInspector();
      renderGraphPalette();
    }
    showGraphMessage(
      `Updated ${issues.length.toLocaleString("de-DE")} catalog node${issues.length === 1 ? "" : "s"}, including ${issues.filter(issue => issue.insideApiComposite).length.toLocaleString("de-DE")} inside placed API Composites. Node placement and wire routing were preserved.`,
      "success"
    );
    return {
      stale: false,
      updated: true,
      issueCount: issues.length,
      catalogKey
    };
  }

function scheduleOpenGraphCatalogReconciliation(
    { force = false } = {}
  ) {
    const catalogKey =
      savedApiCompositeCatalogKey();
    if (
      !catalogKey ||
      !graph?.active ||
      !graphUsesCatalogOperators(graph)
    ) {
      return Promise.resolve(null);
    }
    if (force === true) {
      openGraphCatalogReconciliationCompletedKey =
        "";
    }
    if (
      openGraphCatalogReconciliationPromise
    ) {
      return openGraphCatalogReconciliationPromise;
    }
    if (
      !force &&
      openGraphCatalogReconciliationCompletedKey ===
        catalogKey
    ) {
      return Promise.resolve(null);
    }
    if (savedApiCompositeReconciliationPromise) {
      return savedApiCompositeReconciliationPromise
        .then(() =>
          scheduleOpenGraphCatalogReconciliation({
            force
          })
        );
    }
    savedApiCompositeOperations.add(
      "open-graph-catalog-reconciliation"
    );
    graphCatalogReadiness = "pending";
    graphCatalogReadinessMessage =
      "Checking the open Runtime Graph and every placed API Composite against the updated catalog…";
    updatePackButton();
    openGraphCatalogReconciliationPromise =
      reconcileOpenGraphForCatalog(
        catalogKey
      )
        .then(result => {
          if (
            result?.stale !== true &&
            catalogKey ===
              savedApiCompositeCatalogKey()
          ) {
            openGraphCatalogReconciliationCompletedKey =
              catalogKey;
          }
          return result;
        })
        .catch(error => {
          graphCatalogReadiness = "failed";
          graphCatalogReadinessMessage =
            `${error instanceof Error ? error.message : String(error)} Click the Runtime Graph button to retry the deterministic replacement flow.`;
          updatePackButton();
          openGraphCatalogReconciliationCompletedKey =
            catalogKey;
          console.warn(
            "The open Runtime Graph catalog update was not committed.",
            error
          );
          return {
            stale: false,
            failed: true,
            catalogKey,
            reason:
              error instanceof Error
                ? error.message
                : String(error)
          };
        })
        .finally(() => {
          savedApiCompositeOperations.delete(
            "open-graph-catalog-reconciliation"
          );
          openGraphCatalogReconciliationPromise =
            null;
          const currentKey =
            savedApiCompositeCatalogKey();
          if (
            currentKey &&
            currentKey !== catalogKey
          ) {
            queueMicrotask(() => {
              void scheduleOpenGraphCatalogReconciliation({
                force: true
              });
            });
          } else {
            void scheduleSavedApiCompositeCatalogReconciliation();
          }
        });
    return openGraphCatalogReconciliationPromise;
  }

function catalogFactoryIdentityMatches(
    catalog,
    report
  ) {
    if (
      !catalog ||
      !report ||
      report.verificationPassed !== true
    ) {
      return false;
    }

    const catalogFingerprint = String(
      catalog.catalogFingerprint || ""
    );
    const reportFingerprint = String(
      report.catalogFingerprint || ""
    );
    const catalogEngineVersion = String(
      catalog.engineVersion || ""
    );
    const reportEngineVersion = String(
      report.engineVersion || ""
    );

    return Boolean(
      catalogFingerprint &&
      catalogFingerprint ===
        reportFingerprint &&
      catalogEngineVersion ===
        reportEngineVersion
    );
  }

function updateGraphCatalogReadiness(
    error = graphCatalogGateError
  ) {
    if (!graphUsesCatalogOperators()) {
      graphCatalogReadiness = "ready";
      graphCatalogReadinessMessage = "";
      updatePackButton();
      return true;
    }

    const missing =
      missingGraphCatalogOperatorIds();

    if (graphCatalogDefinitionsReady()) {
      graphCatalogReadiness = "ready";
      graphCatalogReadinessMessage = "";
      updatePackButton();
      return true;
    }

    if (!graphCatalogGateSettled && !error) {
      graphCatalogReadiness = "pending";
      graphCatalogReadinessMessage =
        "Restoring the catalog-generated API definitions required by this Runtime Graph…";
      updatePackButton();
      return false;
    }

    graphCatalogReadiness = "failed";
    graphCatalogReadinessMessage = error
      ? `The API node factory failed: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
      : `The available API catalog does not provide ${missing.length} required Runtime Graph operator${missing.length === 1 ? "" : "s"}: ${missing.slice(0, 4).join(", ")}${missing.length > 4 ? ", …" : ""}`;
    updatePackButton();
    return false;
  }

function restoreSavedPresentationIfReady() {
    if (
      !graphHostInitialized ||
      !bridge ||
      !graph ||
      graph.active !== true ||
      savedPresentationPage() !== "runtime-graph" ||
      graphCatalogReadiness !== "ready" ||
      runtimeGraphViewActive
    ) {
      return false;
    }

    activateGraphMode();
    return true;
  }

function handleApiNodeFactoryReady() {
    graphCatalogGateSettled = true;
    graphCatalogGateError = null;

    if (!updateGraphCatalogReadiness()) {
      void scheduleOpenGraphCatalogReconciliation()
        .finally(() => {
          void scheduleSavedApiCompositeCatalogReconciliation();
        });
      return;
    }


    

    const revision = Number(
      window.__RMLNodeDefinitionRevision
    ) || 0;

    if (
      revision !==
        lastGraphCatalogRefreshRevision
    ) {
      lastGraphCatalogRefreshRevision =
        revision;
      refreshAfterNodeModulesReady();
    }


    
    restoreSavedPresentationIfReady();
    void scheduleOpenGraphCatalogReconciliation()
      .finally(() => {
        void scheduleSavedApiCompositeCatalogReconciliation();
      });
  }

function handleGraphCatalogLoaded() {
    if (
      !graphUsesCatalogOperators() ||
      graphCatalogDefinitionsReady()
    ) {
      if (updateGraphCatalogReadiness()) {
        restoreSavedPresentationIfReady();
      }
      return;
    }

    graphCatalogGateSettled = false;
    graphCatalogGateError = null;
    graphCatalogReadiness = "pending";
    graphCatalogReadinessMessage =
      "The API catalog changed. Rebuilding the required Runtime Graph node factory in this session…";

    if (runtimeGraphViewActive) {
      runtimeGraphViewActive = false;
      deactivateGraphMode();
      bridge?.requestPaletteRender?.();
      bridge?.requestRender?.();
    }

    updatePackButton();
  }

function handleVisualCSharpReady() {
    if (!graph || customCSharpEditor) return;
    const wasActive = graph.active === true;
    graph = sanitizeGraphState(graphSerializableState());
    graph.active = wasActive;
    resetGraphRenderCaches();
    pruneConnections();
    persistGraph(true);
    if (runtimeGraphViewActive) {
      renderGraphPalette();
      renderGraphNodesAndWires();
      renderGraphInspector();
    }
  }

function refreshAfterNodeModulesReady() {
    if (!bridge || !graph) {
      return;
    }
    if (
      (customCSharpEditor ||
        apiCompositeEditor) &&
      !customCSharpRootOperation
    ) {
      return withRuntimeRootGraph(
        refreshAfterNodeModulesReady
      );
    }


    

    if (!graphUsesCatalogOperators()) {
      if (
        graph.active &&
        runtimeGraphViewActive
      ) {
        renderGraphPalette();
      }
      return;
    }

    typedGraphCodegenCacheKey = "";
    typedGraphCodegenCache = null;

    const wasActive =
      graph.active === true;

    graph = sanitizeGraphState(
      graphSerializableState()
    );
    resetGraphRenderCaches();
    graph.active = wasActive;

    pruneConnections();
    persistGraph(true);

    if (
      graph.active &&
      runtimeGraphViewActive
    ) {
      renderGraphPalette();
      renderGraphNodesAndWires();
      renderGraphInspector();
    }

    bridge
      .requestGeneratedOutputRefresh
      ?.();
  }

async function initializeImmediately() {

    

    cacheDom();
    ensurePackButton();

    const initializeFromBridgeEvent =
      () => {
        if (
          !graphBaseModulesReady ||
          graphHostError
        ) {
          updatePackButton();
          return;
        }

        if (initializeNodeGraphHost()) {
          document.removeEventListener(
            "rml-builder:bridge-ready",
            initializeFromBridgeEvent
          );
          document.removeEventListener(
            "rml-builder:ready",
            initializeFromBridgeEvent
          );
        } else {
          updatePackButton();
        }
      };

    document.addEventListener(
      "rml-builder:bridge-ready",
      initializeFromBridgeEvent
    );
    document.addEventListener(
      "rml-builder:ready",
      initializeFromBridgeEvent
    );

    try {
      await Promise.resolve(
        window.RMLBaseModNodesReady ||
        window.RMLModNodesReady
      );

      graphBaseModulesReady = true;

    } catch (error) {
      graphHostError = error;
      console.error(
        "Typed mod-node initialization failed.",
        error
      );
    }

    initializeFromBridgeEvent();

    window.addEventListener(
      "rml-api-node-factory-ready",
      handleApiNodeFactoryReady
    );
    window.addEventListener(
      "rml-visual-csharp-ready",
      handleVisualCSharpReady
    );
    document.addEventListener(
      "rml-catalog:loaded",
      handleGraphCatalogLoaded
    );


    Promise.resolve(
      window.RMLModNodesReady
    )
      .then(() => {
        graphCatalogGateSettled = true;
        graphCatalogGateError = null;
        const catalogReady =
          updateGraphCatalogReadiness();
        if (
          catalogReady &&
          graphUsesCatalogOperators()
        ) {
          const revision = Number(
            window.__RMLNodeDefinitionRevision
          ) || 0;
          if (
            revision !==
              lastGraphCatalogRefreshRevision
          ) {
            lastGraphCatalogRefreshRevision =
              revision;
            refreshAfterNodeModulesReady();
          }
        }
        if (catalogReady) {

          

          restoreSavedPresentationIfReady();
          void scheduleOpenGraphCatalogReconciliation()
            .finally(() => {
              void scheduleSavedApiCompositeCatalogReconciliation();
            });
        }
      })
      .catch(error => {
        graphCatalogGateSettled = true;
        graphCatalogGateError = error;
        updateGraphCatalogReadiness(error);
      });
  }
