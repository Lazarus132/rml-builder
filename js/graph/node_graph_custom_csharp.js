"use strict";
// Custom C# graph and editor integration.



const customCSharpSourceSyncTimers = new Map();
const customCSharpLiveDiagnosticTimers = new Map();
const customCSharpLiveDiagnosticRevisions = new Map();
const customCSharpLiveDiagnosticJobs = new Map();
const customCSharpLiveValidatedValues = new Map();
const customCSharpLivePendingNodes = new Set();
let customCSharpLiveDiagnosticRunning = null;
let customCSharpEditorPersistenceTimer = 0;
let customCSharpEditorPersistenceDirty = false;
const CUSTOM_CSHARP_LIVE_INTERVAL_MS = 100;
const CUSTOM_CSHARP_SOURCE_GRAPH_SYNC_IDLE_MS = 450;
const CUSTOM_CSHARP_PERSIST_IDLE_MS = 320;
const customCSharpDetachedEditors = new Map();
const customCSharpEditorDraftValues = new Map();

let customCSharpInlineEditorKey = "";
let customCSharpActiveEditorKey = "";
let customCSharpEditorOverlayZ = 2147482200;
let customCSharpDetachedEditorModulePromise = null;
const CUSTOM_CSHARP_SHORTCUT_BOOTSTRAP_VERSION = 18;
const CUSTOM_CSHARP_CATALOG_SCAN_SLICE_MS = 1.25;
const CUSTOM_CSHARP_CATALOG_SOURCE_CHUNK = 16 * 1024;

const customCSharpBuildWorkers = new Map();
const customCSharpSynchronizations = new Set();
const customCSharpSynchronizationStatus = new Map();
const customCSharpSynchronizationControllers = new Map();
const customCSharpSynchronizationTasks = new Map();
const customCSharpForegroundSynchronizationTokens = new Map();
const customCSharpDiagnostics = new Map();
const customCSharpDebugOutput = new Map();
const customCSharpPresentedNodeSets = new WeakSet();
const customCSharpInitialViewportPendingNodeSets =
  new WeakSet();
const customCSharpReopenIdentityByNodes =
  new WeakMap();
const customCSharpValidatedSourceNodeSets =
  new WeakSet();
const customCSharpPendingOpenPreparations =
  new Map();

function customCSharpOpenPreparationKey(
    fileNodeId,
    ownerPath =
      typeof apiCompositeEditorOwnerPath ===
        "function"
        ? apiCompositeEditorOwnerPath()
        : []
  ) {
    return [
      ...(Array.isArray(ownerPath)
        ? ownerPath
        : []),
      String(fileNodeId || "")
    ].map(value => {
      const text = String(value || "");
      return `${text.length}:${text}`;
    }).join("|");
  }

let customCSharpBuildRequestSequence = 0;

let customCSharpProjectEpoch = 0;
let customCSharpDiagnosticClockEpoch = 0;
const customCSharpDiagnosticClockFormatter = new Intl.DateTimeFormat([], {
  hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3
});

function createEmptyCustomCSharpFileGraph(fileNode) {
    const outputNodeId = makeId("custom-csharp-output");
    return {
      version: 1,
      fileName: String(fileNode?.parameters?.fileName || "VisualProgram.cs"),
      projectId: String(fileNode?.parameters?.projectId || "main"),
      parser: "Visual C#",
      languageVersion: "14.0",
      optimizerVersion: 0,
      importedSource: false,
      sourceEditedInInspector: false,
      coordinateSpaceVersion:
        CUSTOM_CSHARP_COORDINATE_SPACE_VERSION,
      sourceHash: "",
      outputNodeId,
      rootSyntaxNodeId: "",
      nodes: [
        {
          id: outputNodeId,
          kind: "operator",
          operatorId: "csharp.customFileOutput",
          x: 720,
          y: 260,
          width: null,
          height: null,
          label: `Output · ${String(fileNode?.parameters?.fileName || "Custom C# File")}`,
          parameters: {}
        }
      ],
      connections: [],
      viewport: { x: 56, y: 54, scale: 0.9 },
      selectedNodeId: outputNodeId,
      selectedConnectionId: null,
      selectedWirePoint: null,
      nextSequence: 2
    };
  }

function customCSharpContentMutationIdentity() {
    try {
      return typeof graphContentMutationSequence === "number"
        ? graphContentMutationSequence
        : null;
    } catch {
      return null;
    }
  }

function customCSharpEditorOwner(
    editor = customCSharpEditor
  ) {
    return editor?.mainView?.nodes?.find(
      node => node.id === editor.fileNodeId
    ) || null;
  }

function customCSharpCatalogStampMatches(
    first,
    second
  ) {
    return Boolean(
      first &&
      second &&
      first.fingerprint === second.fingerprint &&
      first.engineVersion === second.engineVersion &&
      first.source === second.source &&
      first.definitionRevision ===
        second.definitionRevision
    );
  }

function createCustomCSharpReopenIdentity(
    owner,
    stored,
    nodes,
    connections
  ) {
    const contentMutationIdentity =
      customCSharpContentMutationIdentity();
    if (
      !owner ||
      !stored ||
      !Array.isArray(nodes) ||
      !Array.isArray(connections) ||
      stored.nodes !== nodes ||
      stored.connections !== connections ||
      contentMutationIdentity === null
    ) {
      return null;
    }
    return {
      customProjectEpoch: customCSharpProjectEpoch,
      builderProjectEpoch,
      fileNodeId: String(owner.id || ""),
      nodes,
      connections,
      contentMutationIdentity,
      source: String(owner.parameters?.source || ""),
      sourceHash: String(stored.sourceHash || ""),
      optimizerVersion: Number(
        stored.optimizerVersion || 0
      ),
      importedSource:
        stored.importedSource === true,
      sourceEditedInInspector:
        stored.sourceEditedInInspector === true,
      outputNodeId: String(
        stored.outputNodeId || ""
      ),
      rootSyntaxNodeId: String(
        stored.rootSyntaxNodeId || ""
      ),
      directSourceNodeId: String(
        stored.directSourceNodeId || ""
      ),
      sourceValidated:
        stored.importedSource !== true ||
        customCSharpValidatedSourceNodeSets.has(
          nodes
        ),
      catalog: currentCustomCSharpCatalogStamp()
    };
  }

function customCSharpReopenIdentityMatchesStoredGraph(
    identity,
    fileNodeId,
    stored,
    nodes,
    connections,
    {
      requireSourceValidation = false
    } = {}
  ) {
    const contentMutationIdentity =
      customCSharpContentMutationIdentity();
    return Boolean(
      identity &&
      stored &&
      Array.isArray(nodes) &&
      Array.isArray(connections) &&
      stored.nodes === nodes &&
      stored.connections === connections &&
      contentMutationIdentity !== null &&
      identity.customProjectEpoch ===
        customCSharpProjectEpoch &&
      identity.builderProjectEpoch ===
        builderProjectEpoch &&
      identity.fileNodeId ===
        String(fileNodeId || "") &&
      identity.nodes === nodes &&
      identity.connections === connections &&
      identity.contentMutationIdentity ===
        contentMutationIdentity &&
      identity.sourceHash ===
        String(stored.sourceHash || "") &&
      identity.optimizerVersion ===
        Number(stored.optimizerVersion || 0) &&
      identity.importedSource ===
        (stored.importedSource === true) &&
      identity.sourceEditedInInspector ===
        (stored.sourceEditedInInspector === true) &&
      identity.outputNodeId ===
        String(stored.outputNodeId || "") &&
      identity.rootSyntaxNodeId ===
        String(stored.rootSyntaxNodeId || "") &&
      identity.directSourceNodeId ===
        String(stored.directSourceNodeId || "") &&
      (
        !requireSourceValidation ||
        identity.sourceValidated === true
      ) &&
      customCSharpCatalogStampMatches(
        identity.catalog,
        currentCustomCSharpCatalogStamp()
      )
    );
  }

function transportCustomCSharpReopenIdentity(
    fileNodeId,
    sourceGraph,
    clonedGraph,
    capability
  ) {
    let capabilityMatches = false;
    try {
      capabilityMatches =
        typeof customCSharpReopenCloneCapability !==
          "undefined" &&
        capability ===
          customCSharpReopenCloneCapability;
    } catch {}
    if (
      !capabilityMatches ||
      !sourceGraph ||
      !clonedGraph ||
      sourceGraph === clonedGraph ||
      !Array.isArray(sourceGraph.nodes) ||
      !Array.isArray(sourceGraph.connections) ||
      !Array.isArray(clonedGraph.nodes) ||
      !Array.isArray(clonedGraph.connections) ||
      sourceGraph.nodes === clonedGraph.nodes ||
      sourceGraph.connections ===
        clonedGraph.connections
    ) {
      return false;
    }
    const transportInitialViewport =
      customCSharpInitialViewportPendingNodeSets
        .has(sourceGraph.nodes);
    if (transportInitialViewport) {
      customCSharpInitialViewportPendingNodeSets
        .add(clonedGraph.nodes);
    }
    const identity =
      customCSharpReopenIdentityByNodes.get(
        sourceGraph.nodes
      );
    if (!customCSharpReopenIdentityMatchesStoredGraph(
      identity,
      fileNodeId,
      sourceGraph,
      sourceGraph.nodes,
      sourceGraph.connections,
      { requireSourceValidation: true }
    )) {
      return transportInitialViewport;
    }
    for (const key of [
      "sourceHash",
      "optimizerVersion",
      "importedSource",
      "sourceEditedInInspector",
      "outputNodeId",
      "rootSyntaxNodeId",
      "directSourceNodeId"
    ]) {
      if (
        String(clonedGraph[key] ?? "") !==
          String(sourceGraph[key] ?? "")
      ) {
        return false;
      }
    }
    const transported = {
      ...identity,
      nodes: clonedGraph.nodes,
      connections: clonedGraph.connections
    };
    customCSharpValidatedSourceNodeSets.add(
      clonedGraph.nodes
    );
    customCSharpReopenIdentityByNodes.set(
      clonedGraph.nodes,
      transported
    );
    return true;
  }

function customCSharpReopenIdentityMatchesGraph(
    identity,
    owner,
    stored,
    nodes,
    connections,
    {
      requireSourceValidation = false
    } = {}
  ) {
    return Boolean(
      identity?.source ===
        String(owner?.parameters?.source || "") &&
      identity &&
      owner &&
      stored &&
      customCSharpReopenIdentityMatchesStoredGraph(
        identity,
        owner.id,
        stored,
        nodes,
        connections,
        { requireSourceValidation }
      )
    );
  }

function rememberStoredCustomCSharpReopenIdentity(
    fileNodeId,
    owner = null,
    {
      sourceValidated = false
    } = {}
  ) {
    const normalizedFileNodeId =
      String(fileNodeId || "");
    const resolvedOwner = owner ||
      findGraphNode(normalizedFileNodeId);
    const stored =
      activeGraphCustomCSharpFileRegistry()[
        normalizedFileNodeId
      ];
    if (
      sourceValidated &&
      Array.isArray(stored?.nodes)
    ) {
      customCSharpValidatedSourceNodeSets.add(
        stored.nodes
      );
    }
    const identity =
      createCustomCSharpReopenIdentity(
        resolvedOwner,
        stored,
        stored?.nodes,
        stored?.connections
      );
    if (!identity) return false;
    customCSharpReopenIdentityByNodes.set(
      identity.nodes,
      identity
    );
    return true;
  }

function customCSharpStoredGraphReopenIdentityMatches(
    fileNodeOrId
  ) {
    const owner =
      fileNodeOrId &&
      typeof fileNodeOrId === "object"
        ? fileNodeOrId
        : findGraphNode(String(fileNodeOrId || ""));
    const stored =
      activeGraphCustomCSharpFileRegistry()[
        owner?.id
      ];
    if (!Array.isArray(stored?.nodes)) {
      return false;
    }
    const directIdentity =
      customCSharpReopenIdentityByNodes.get(
        stored.nodes
      );
    if (customCSharpReopenIdentityMatchesGraph(
      directIdentity,
      owner,
      stored,
      stored.nodes,
      stored.connections,
      { requireSourceValidation: true }
    )) {
      return true;
    }
    return false;
  }

function rememberCustomCSharpReopenIdentity(
    editor = customCSharpEditor
  ) {
    const owner = customCSharpEditorOwner(editor);
    const stored =
      activeGraphCustomCSharpFileRegistry()[
        editor?.fileNodeId
      ];
    const identity = createCustomCSharpReopenIdentity(
      owner,
      stored,
      graph?.nodes,
      graph?.connections
    );
    if (!editor || !identity) {
      if (editor) {
        editor.reopenIdentity = null;
        editor.reopenIdentityReady = false;
      }
      return false;
    }
    editor.reopenIdentity = identity;
    editor.reopenIdentityReady = true;
    customCSharpReopenIdentityByNodes.set(
      identity.nodes,
      identity
    );
    return true;
  }

function customCSharpReopenIdentityMatches(
    editor = customCSharpEditor
  ) {
    const identity = editor?.reopenIdentity;
    const owner = customCSharpEditorOwner(editor);
    const stored =
      activeGraphCustomCSharpFileRegistry()[
        editor?.fileNodeId
      ];
    return Boolean(
      editor?.reopenIdentityReady === true &&
      editor.topologyChangedDuringPreparation !== true &&
      customCSharpReopenIdentityMatchesGraph(
        identity,
        owner,
        stored,
        graph?.nodes,
        graph?.connections
      )
    );
  }

function customCSharpOpenPreparationViewState() {
    return {
      viewport: {
        x: graph?.viewport?.x,
        y: graph?.viewport?.y,
        scale: graph?.viewport?.scale
      },
      selectedNodeId:
        graph?.selectedNodeId || null,
      selectedNodeIds:
        Array.isArray(graph?.selectedNodeIds)
          ? [...graph.selectedNodeIds]
          : [],
      selectedConnectionId:
        graph?.selectedConnectionId || null,
      selectedWirePoint:
        graph?.selectedWirePoint
          ? {
              connectionId:
                graph.selectedWirePoint
                  .connectionId,
              pointId:
                graph.selectedWirePoint
                  .pointId
            }
          : null,
      nextSequence: graph?.nextSequence
    };
  }

function customCSharpOpenPreparationViewMatches(
    expected
  ) {
    const actual =
      customCSharpOpenPreparationViewState();
    return Boolean(
      expected &&
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

function customCSharpEditorContentUnchangedSinceOpen(
    editor = customCSharpEditor
  ) {
    const ownerPath =
      typeof apiCompositeEditorOwnerPath ===
        "function"
        ? apiCompositeEditorOwnerPath()
        : [];
    const owner =
      customCSharpEditorOwner(editor);
    const ownerDocument =
      ownerPath.length > 0 &&
      typeof apiCompositeEditorDocument ===
        "function"
        ? apiCompositeEditorDocument(
            apiCompositeEditor
          )
        : graph;
    return Boolean(
      editor &&
      owner === editor.openOwner &&
      String(owner?.parameters?.source || "") ===
        editor.openOwnerSource &&
      ownerPath.length ===
        editor.openOwnerPath.length &&
      ownerPath.every(
        (value, index) =>
          value ===
            editor.openOwnerPath[index]
      ) &&
      ownerDocument ===
        editor.openOwnerDocument &&
      (
        ownerPath.length === 0 ||
        ownerDocument?.nodes?.find(node =>
          node?.id === editor.fileNodeId
        ) === owner
      ) &&
      activeGraphCustomCSharpFileRegistry()[
        editor.fileNodeId
      ] === editor.openStoredGraph &&
      graph?.nodes === editor.openNodes &&
      graph?.connections ===
        editor.openConnections &&
      typeof graphViewContentRevision ===
        "function" &&
      graphViewContentRevision(
        graph.nodes
      ) === editor.openContentRevision
    );
  }

function customCSharpEditorCompleteStateUnchangedSinceOpen(
    editor = customCSharpEditor
  ) {
    return Boolean(
      customCSharpEditorContentUnchangedSinceOpen(
        editor
      ) &&
      customCSharpOpenPreparationViewMatches(
        editor?.openViewState
      )
    );
  }

function acknowledgeCustomCSharpGraphDocumentCommit({
    nodes = null,
    ownerPath = []
  } = {}) {
    const editor = customCSharpEditor;
    if (
      !editor ||
      nodes !== graph?.nodes
    ) {
      return false;
    }
    const committedPath =
      (Array.isArray(ownerPath)
        ? ownerPath
        : []).map(value =>
        String(value || "")
      ).filter(Boolean);
    const openPath =
      (Array.isArray(editor.openOwnerPath)
        ? editor.openOwnerPath
        : []).map(value =>
        String(value || "")
      ).filter(Boolean);
    if (
      committedPath.length !==
        openPath.length ||
      committedPath.some(
        (value, index) =>
          value !== openPath[index]
      )
    ) {
      return false;
    }
    const owner =
      customCSharpEditorOwner(editor);
    const registry =
      activeGraphCustomCSharpFileRegistry();
    const stored =
      registry?.[editor.fileNodeId];
    if (
      !owner ||
      !stored ||
      typeof stored !== "object"
    ) {
      return false;
    }
    editor.openOwner = owner;
    editor.openOwnerSource = String(
      owner.parameters?.source || ""
    );
    editor.openOwnerDocument =
      committedPath.length > 0 &&
      typeof apiCompositeEditorDocument ===
        "function"
        ? apiCompositeEditorDocument(
            apiCompositeEditor
          )
        : graph;
    editor.openStoredGraph = stored;
    editor.openNodes = graph.nodes;
    editor.openConnections =
      graph.connections;
    editor.openContentRevision =
      typeof graphViewContentRevision ===
        "function"
        ? graphViewContentRevision(
            graph.nodes
          )
        : null;
    editor.openViewState =
      customCSharpOpenPreparationViewState();
    return true;
  }

function restoreCustomCSharpOpenPreparation(
    preparation
  ) {
    const registryStillOriginal = registry =>
      Boolean(
        registry &&
        typeof registry === "object" &&
        !Array.isArray(registry) &&
        Object.hasOwn(
          registry,
          preparation?.fileNodeId
        ) ===
          Boolean(
            preparation?.hadOriginalGraph
          ) &&
        (
          !preparation?.hadOriginalGraph ||
          registry[preparation.fileNodeId] ===
            preparation.originalGraph
        )
      );
    const ownerRegistryStillOriginal =
      registry =>
        Boolean(
          registry &&
          typeof registry === "object" &&
          !Array.isArray(registry) &&
          Object.hasOwn(
            registry,
            preparation?.fileNodeId
          ) ===
            Boolean(
              preparation
                ?.hadOriginalOwnerGraph
            ) &&
          (
            !preparation
              ?.hadOriginalOwnerGraph ||
            registry[
              preparation.fileNodeId
            ] ===
              preparation.originalOwnerGraph
          )
        );
    const currentOwnerPath =
      typeof apiCompositeEditorOwnerPath ===
        "function"
        ? apiCompositeEditorOwnerPath()
        : [];
    const currentOwnerDocument =
      currentOwnerPath.length > 0 &&
      typeof apiCompositeEditorDocument ===
        "function"
        ? apiCompositeEditorDocument(
            apiCompositeEditor
          )
        : graph;
    if (
      !preparation ||
      preparation.customProjectEpoch !==
        customCSharpProjectEpoch ||
      preparation.builderProjectEpoch !==
        builderProjectEpoch ||
      !registryStillOriginal(
        preparation.registry
      ) ||
      String(
        preparation.owner?.parameters
          ?.source || ""
      ) !== preparation.ownerSource ||
      currentOwnerDocument !==
        preparation.ownerDocument ||
      currentOwnerPath.length !==
        preparation.ownerPath.length ||
      currentOwnerPath.some(
        (value, index) =>
          value !==
            preparation.ownerPath[index]
      ) ||
      preparation.ownerNodes
        ?.find(node =>
          node?.id === preparation.fileNodeId
        ) !== preparation.owner
    ) {
      return false;
    }
    const ownerRegistry =
      preparation.ownerRegistry;
    if (
      ownerRegistry &&
      ownerRegistry !== preparation.registry &&
      !ownerRegistryStillOriginal(
        ownerRegistry
      )
    ) {
      return false;
    }
    return true;
  }

function commitApiCompositeEditorBeforeCustomOpen() {
    if (!apiCompositeEditor) {
      return true;
    }
    if (
      typeof flushActiveGraphDocumentPersistenceBeforeTransition ===
        "function"
    ) {
      flushActiveGraphDocumentPersistenceBeforeTransition();
    }
    const editor = apiCompositeEditor;
    const contentUnchanged =
      typeof apiCompositeEditorContentUnchangedSinceOpen ===
        "function" &&
      apiCompositeEditorContentUnchangedSinceOpen(
        editor
      );
    const completeStateUnchanged =
      contentUnchanged &&
      typeof apiCompositeEditorViewUnchangedSinceOpen ===
        "function" &&
      apiCompositeEditorViewUnchangedSinceOpen(
        editor,
        graph
      );
    if (completeStateUnchanged) return true;
    const captured =
      captureApiCompositeEditorView(
        contentUnchanged
          ? {
              synchronizeBoundaries: false
            }
          : undefined
      );
    if (!captured) return false;
    if (
      typeof markCommittedGraphMutation ===
        "function"
    ) {
      markCommittedGraphMutation({
        nodes: captured.nodes,
        document: captured,
        ownerPath:
          apiCompositeEditorOwnerPath(
            editor
          ),
        mutationClass: contentUnchanged
          ? "view"
          : "topology"
      });
    }
    if (
      typeof apiCompositeEditorViewState ===
        "function"
    ) {
      apiCompositeEditor.openViewState =
        apiCompositeEditorViewState(graph);
    }
    const revision = Number(
      apiCompositeEditor
        .contentMutationRevision
    );
    if (Number.isFinite(revision)) {
      apiCompositeEditor
        .contentMutationRevisionAtOpen =
        revision;
    }
    apiCompositeEditor.boundaryUpdate = {
      added: 0,
      removed: 0
    };
    return true;
  }

function openCustomCSharpFileGraph(fileNodeId) {
    if (!graph || customCSharpEditor) {
      return false;
    }
    if (!commitApiCompositeEditorBeforeCustomOpen()) {
      return false;
    }
    const fileNode = findGraphNode(fileNodeId);
    const definition = fileNode ? nodeDefinition(fileNode) : null;
    if (!fileNode || definition?.customCSharpFile !== true) return false;
    const previousPresentation =
      closeEmbeddedEditorForGraphReplacement();
    const openOwnerPath =
      typeof apiCompositeEditorOwnerPath ===
        "function"
        ? apiCompositeEditorOwnerPath()
        : [];
    const openOwnerDocument =
      openOwnerPath.length > 0 &&
      typeof apiCompositeEditorDocument ===
        "function"
        ? apiCompositeEditorDocument(
            apiCompositeEditor
          )
        : graph;
    const activeRegistry =
      activeGraphCustomCSharpFileRegistry({
        create: true
      });
    const pendingPreparationKey =
      customCSharpOpenPreparationKey(
        fileNodeId,
        openOwnerPath
      );
    const pendingPreparation =
      customCSharpPendingOpenPreparations.get(
        pendingPreparationKey
      );
    customCSharpPendingOpenPreparations.delete(
      pendingPreparationKey
    );
    const pendingPreparationValid = Boolean(
      pendingPreparation?.preparedGraph &&
      pendingPreparation.registry ===
        activeRegistry &&
      pendingPreparation.owner === fileNode &&
      pendingPreparation.ownerDocument ===
        openOwnerDocument &&
      restoreCustomCSharpOpenPreparation(
        pendingPreparation
      )
    );
    if (
      pendingPreparation &&
      !pendingPreparationValid
    ) {
      restoreCustomCSharpOpenPreparation(
        pendingPreparation
      );
      restorePreviousEmbeddedEditor(
        previousPresentation
      );
      return false;
    }
    let customGraph = pendingPreparationValid
      ? pendingPreparation.preparedGraph
      : activeRegistry[fileNodeId];
    const createdGraph = !customGraph;
    if (!customGraph) {
      customGraph = createEmptyCustomCSharpFileGraph(fileNode);
      activeRegistry[fileNodeId] = customGraph;
    }
    const previouslyPresented =
      Array.isArray(customGraph.nodes) &&
      customCSharpPresentedNodeSets.has(
        customGraph.nodes
      );
    const initialViewportPending = Boolean(
      createdGraph ||
      pendingPreparationValid ||
      (
        Array.isArray(customGraph.nodes) &&
        customCSharpInitialViewportPendingNodeSets
          .has(customGraph.nodes)
      )
    );
    if (
      typeof rememberCurrentGraphAnalysis ===
        "function"
    ) {
      rememberCurrentGraphAnalysis();
    }
    customCSharpEditor = {
      fileNodeId,
      fileName: String(fileNode.parameters?.fileName || "Custom C# File"),
      openOwner: fileNode,
      openOwnerSource: String(
        fileNode.parameters?.source || ""
      ),
      openOwnerPath: Object.freeze([
        ...openOwnerPath
      ]),
      openOwnerDocument,
      previousPresentation,
      mainView: graphViewFrom(graph),
      reopenIdentityReady: false,
      topologyChangedDuringPreparation: false,
      openPreparation:
        pendingPreparationValid
          ? pendingPreparation
          : null
    };
    applyGraphView(graphViewFrom(customGraph));
    resetGraphRenderCaches();
    const reusedAnalysis =
      typeof restoreCurrentGraphAnalysis ===
        "function" &&
      restoreCurrentGraphAnalysis();
    if (!reusedAnalysis) {
      currentAnalysis = null;
    }
    activateGraphMode();
    const provisionalOpen = Boolean(
      customCSharpEditor.openPreparation
    );
    if (!provisionalOpen && createdGraph) {
      persistGraphView(true);
    }
    if (
      !provisionalOpen &&
      createdGraph
    ) {
      scheduleAcceptedGraphPersistenceAfterPaint({
        refreshGeneratedOutput: true,
        refreshCompositeActions: true,
        mutationClass: "topology"
      });
    }
    if (Array.isArray(graph.nodes)) {
      customCSharpPresentedNodeSets.add(
        graph.nodes
      );
    }
    const projectEpoch =
      builderProjectEpoch;
    if (
      initialViewportPending &&
      !previouslyPresented
    ) {
      if (Array.isArray(customGraph.nodes)) {
        customCSharpInitialViewportPendingNodeSets
          .delete(customGraph.nodes);
      }
      requestInitialGraphViewport(() => {
      if (
        projectEpoch !==
          builderProjectEpoch ||
        customCSharpEditor?.fileNodeId !==
          fileNodeId
      ) {
        return;
      }
      if (graph.nodes.length <= 40) {
        centerGraph();
        renderGraphWires();
        return;
      }
      const output = graph.nodes.find(node => node.id === customGraph.outputNodeId);
      const rectangle = dom.viewport?.getBoundingClientRect();
      if (!output || !rectangle) return;
      const geometry = estimatedGraphNodeGeometry(output);
      graph.viewport.scale = nodeGraphClamp(0.62, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
      graph.viewport.x = rectangle.width * 0.72 - (output.x + geometry.width / 2) * graph.viewport.scale;
      graph.viewport.y = rectangle.height / 2 - (output.y + geometry.height / 2) * graph.viewport.scale;
      applyViewportTransform();
      persistGraphView();
      renderGraphWires();
      });
    }
    if (customCSharpEditor?.openPreparation) {
      customCSharpEditor
        .openPreparationContentRevision =
        typeof graphViewContentRevision ===
          "function"
          ? graphViewContentRevision(
              graph.nodes
            )
          : null;
      customCSharpEditor
        .openPreparationViewState =
        customCSharpOpenPreparationViewState();
    }
    customCSharpEditor.openStoredGraph =
      activeRegistry[fileNodeId];
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
    customCSharpEditor.openViewState =
      customCSharpOpenPreparationViewState();
    showGraphMessage(`Opened ${customCSharpEditor.fileName} in its separate C# graph.`, "success");
    return true;
  }

async function openCustomCSharpFileGraphReady(
    fileNodeId,
    signal = null
  ) {
    const normalizedFileNodeId =
      String(fileNodeId || "");
    const expectedProjectEpoch =
      builderProjectEpoch;
    if (signal?.aborted) {
      throw signal.reason ||
        new DOMException(
          "Custom C# graph presentation was cancelled.",
          "AbortError"
        );
    }
    let settled = false;
    let timer = 0;
    let cancelPresentationWait = () => {};

    const presentation = new Promise(
      (resolve, reject) => {
        const cleanup = () => {
          if (timer) {
            window.clearTimeout(timer);
          }
          document.removeEventListener(
            "rml-graph:presentation-complete",
            handlePresented
          );
          signal?.removeEventListener?.(
            "abort",
            handleAbort
          );
        };
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
          cleanup();
          callback(value);
        };
        const handlePresented = event => {
          const detail = event?.detail || {};
          if (
            detail.scope !==
              "custom-csharp-file" ||
            String(detail.fileNodeId || "") !==
              normalizedFileNodeId ||
            Number(detail.projectEpoch || 0) !==
              Number(expectedProjectEpoch || 0)
          ) {
            return;
          }
          finish(resolve, true);
        };
        const handleAbort = () =>
          finish(
            reject,
            signal?.reason ||
              new DOMException(
                "Custom C# graph presentation was cancelled.",
                "AbortError"
              )
          );
        cancelPresentationWait = () =>
          finish(resolve, false);

        document.addEventListener(
          "rml-graph:presentation-complete",
          handlePresented
        );
        signal?.addEventListener?.(
          "abort",
          handleAbort,
          { once: true }
        );
        timer = window.setTimeout(
          () =>
            finish(
              reject,
              new Error(
                "The Custom C# Node Graph did not finish rendering within 60 seconds."
              )
            ),
          60000
        );
      }
    );
    setCustomCSharpSynchronizationStatus(
      normalizedFileNodeId,
      "Rendering Custom C# Node Graph…"
    );
    let opened = false;
    try {
      opened = openCustomCSharpFileGraph(
        normalizedFileNodeId
      );
    } catch (error) {
      cancelPresentationWait();
      throw error;
    }
    if (!opened) {
      cancelPresentationWait();
      await presentation;
      return false;
    }
    await presentation;
    rememberCustomCSharpReopenIdentity();
    return true;
  }

function closeCustomCSharpFileGraph({
    restorePreviousPresentation = true,
    commit = true,
    announce = true
  } = {}) {
    if (!customCSharpEditor || !graph) return false;
    const closingEditor =
      customCSharpEditor;
    closeEmbeddedEditorForGraphReplacement();
    if (
      typeof flushActiveGraphDocumentPersistenceBeforeTransition ===
        "function"
    ) {
      flushActiveGraphDocumentPersistenceBeforeTransition();
    }
    const fileName = closingEditor.fileName;
    const contentUnchanged =
      customCSharpEditorContentUnchangedSinceOpen(
        closingEditor
      );
    const viewUnchanged =
      customCSharpOpenPreparationViewMatches(
        closingEditor.openViewState
      );
    const openPreparation =
      closingEditor.openPreparation ||
      null;
    const preparationUnedited = Boolean(
      openPreparation &&
      contentUnchanged &&
        customCSharpOpenPreparationViewMatches(
        closingEditor
          .openPreparationViewState
      )
    );
    const previousPresentation =
      closingEditor.previousPresentation ||
      null;
    if (
      typeof rememberCurrentGraphAnalysis ===
        "function"
    ) {
      rememberCurrentGraphAnalysis();
    }
    const preparationRestored =
      preparationUnedited &&
      restoreCustomCSharpOpenPreparation(
        openPreparation
      );
    const exactUnchanged =
      preparationRestored ||
      (
        !openPreparation &&
        contentUnchanged &&
        viewUnchanged
      );
    const analysisUnchanged =
      contentUnchanged ||
      preparationRestored;
    let captured = null;
    if (!exactUnchanged) {
      captured = captureCustomCSharpEditorView(
        contentUnchanged
          ? { synchronizeSource: false }
          : undefined
      );
      if (
        captured &&
        typeof markCommittedGraphMutation ===
          "function"
      ) {
        markCommittedGraphMutation({
          nodes: captured.nodes,
          document: captured,
          ownerPath:
            closingEditor.openOwnerPath,
          mutationClass: contentUnchanged
            ? "view"
            : "topology"
        });
      }
    }
    const mainView = closingEditor.mainView;
    customCSharpEditor = null;
    applyGraphView(mainView);
    if (commit) {
      resetGraphRenderCaches();
      const restoredAnalysis =
        analysisUnchanged &&
        typeof restoreCurrentGraphAnalysis ===
          "function" &&
        restoreCurrentGraphAnalysis();
      if (!restoredAnalysis) {
        pruneConnections();
      }
      activateGraphMode();
      if (!exactUnchanged) {
        scheduleGraphPersistenceAfterPaint({
          refreshGeneratedOutput:
            !contentUnchanged ||
            Boolean(openPreparation),
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
      showGraphMessage(
        `Returned from ${fileName} to its owning graph.`,
        "success"
      );
    }
    if (restorePreviousPresentation) {
      restorePreviousEmbeddedEditor(
        previousPresentation
      );
    }
    return true;
  }

function customCSharpOutputSource(
    message,
    fallback = "Builder"
  ) {
    const prefix = String(message || "")
      .split(":", 1)[0]
      .trim();
    return /^(?:Roslyn|Worker|Catalog|Codegen)$/i.test(
      prefix
    )
      ? prefix
      : fallback;
  }

function appendCustomCSharpDebugOutput(
    nodeId,
    message,
    {
      tone = "info",
      source = "",
      notify = true
    } = {}
  ) {
    const id = String(nodeId || "");
    const normalizedMessage = String(
      message?.message ||
        message ||
        ""
    ).trim();
    if (!id || !normalizedMessage) return;
    customCSharpDiagnosticClockEpoch =
      Math.max(
        Date.now(),
        customCSharpDiagnosticClockEpoch + 1
      );
    const entry = Object.freeze({
      time: customCSharpDiagnosticClockFormatter.format(customCSharpDiagnosticClockEpoch),
      source:
        String(source || "").trim() ||
        customCSharpOutputSource(
          normalizedMessage
        ),
      message: normalizedMessage,
      tone: String(tone || "info")
    });
    const entries =
      customCSharpDebugOutput.get(id) || [];
    const repeatedIndex =
      entries.findLastIndex(previous =>
        previous?.message === entry.message &&
        previous?.source === entry.source &&
        previous?.tone === entry.tone
      );
    if (repeatedIndex >= 0) {
      entries.splice(repeatedIndex, 1);
    }
    entries.push(entry);
    if (entries.length > 500) {
      entries.splice(0, entries.length - 500);
    }
    customCSharpDebugOutput.set(id, entries);
    if (!notify) return entry;
    for (const editor of
      customCSharpDetachedEditors.values()) {
      if (
        editor?.nodeId === id &&
        customCSharpEditorRecordActive(editor) &&
        typeof editor.appendOutput === "function"
      ) {
        editor.appendOutput(entry);
      }
    }
  }

function customCSharpDiagnosticSourceGroup(
    source
  ) {
    return /roslyn/i.test(String(source || ""))
      ? "Roslyn"
      : "Builder";
  }

function normalizedCustomCSharpDiagnostics(
    diagnostics
  ) {
    return [
      ...new Set(
        (Array.isArray(diagnostics)
          ? diagnostics
          : diagnostics
            ? [diagnostics]
            : [])
          .map(diagnostic =>
            String(
              diagnostic?.message ||
                diagnostic ||
                ""
            ).trim()
          )
          .filter(Boolean)
      )
    ];
  }

function commitCustomCSharpDiagnostics(
    nodeId,
    groupedDiagnostics,
    { output = [] } = {}
  ) {
    const id = String(nodeId || "");
    if (!id) return;
    const grouped = Object.freeze({
      Builder: Object.freeze([
        ...(Array.isArray(groupedDiagnostics?.Builder)
          ? groupedDiagnostics.Builder
          : [])
      ]),
      Roslyn: Object.freeze([
        ...(Array.isArray(groupedDiagnostics?.Roslyn)
          ? groupedDiagnostics.Roslyn
          : [])
      ])
    });
    if (
      grouped.Builder.length > 0 ||
      grouped.Roslyn.length > 0
    ) {
      customCSharpDiagnostics.set(id, grouped);
    } else {
      customCSharpDiagnostics.delete(id);
    }
    const appended = output.map(entry => appendCustomCSharpDebugOutput(
      id, entry.message, { ...entry, notify: false }
    )).filter(Boolean);
    for (const editor of customCSharpDetachedEditors.values()) {
      if (editor?.nodeId !== id || !customCSharpEditorRecordActive(editor)) continue;
      if (typeof editor.applySnapshot === "function") {
        editor.applySnapshot({
          diagnostics: grouped,
          ...(appended.length ? { output: customCSharpDebugOutput.get(id) || [] } : {})
        });
      } else {
        editor.setDiagnostics?.(grouped);
        for (const entry of appended) editor.appendOutput?.(entry);
      }
    }
  }

function setCustomCSharpDiagnostics(
    nodeId,
    diagnostics,
    options = {}
  ) {
    const id = String(nodeId || "");
    if (!id) return;
    const normalized =
      normalizedCustomCSharpDiagnostics(diagnostics);
    const previous =
      customCSharpDiagnostics.get(id);
    const grouped = Array.isArray(previous)
      ? {
          Builder: [],
          Roslyn: [...previous]
        }
      : {
          Builder: Array.isArray(previous?.Builder)
            ? [...previous.Builder]
            : [],
          Roslyn: Array.isArray(previous?.Roslyn)
            ? [...previous.Roslyn]
            : []
        };
    const hasExplicitSource =
      Object.prototype.hasOwnProperty.call(
        options,
        "source"
      );
    if (!hasExplicitSource && normalized.length === 0) {
      grouped.Builder = [];
      grouped.Roslyn = [];
    } else {
      grouped[
        customCSharpDiagnosticSourceGroup(
          options.source
        )
      ] = normalized;
    }
    commitCustomCSharpDiagnostics(id, grouped);
  }

function setCustomCSharpLiveDiagnosticSnapshot(
    nodeId,
    diagnostics,
    { logOutput = false } = {}
  ) {
    const normalized =
      normalizedCustomCSharpDiagnostics(diagnostics);
    const output = !logOutput ? [] : normalized.length
      ? [
          ...normalized.map(message => ({ source: "Roslyn", tone: "error", message })),
          { source: "Builder", tone: "error", message: normalized[0] }
        ]
      : [{ source: "Roslyn", tone: "success", message: "C# 14 syntax check completed: no syntax errors." }];
    commitCustomCSharpDiagnostics(nodeId, {
      Builder: normalized.slice(0, 1),
      Roslyn: normalized
    }, { output });
  }

function customCSharpSupportsLiveDiagnostics(parameterKey) {
    return ["source", "actionCode", "expressionCode", "memberCode"].includes(parameterKey);
  }

async function validateCustomCSharpValueLive(parameterKey, value) {
    if (!customCSharpSupportsLiveDiagnostics(parameterKey)) return null;
    const roslyn = window.RMLCSharp14Roslyn;
    if (typeof roslyn?.validateEditor !== "function") {
      throw new Error("The isolated Roslyn live-diagnostics worker is unavailable. Reload the Builder.");
    }
    return roslyn.validateEditor(parameterKey, value);
  }

function setCustomCSharpLiveValidationPending(nodeId, pending) {
    const id = String(nodeId || "");
    if (pending) customCSharpLivePendingNodes.add(id);
    else customCSharpLivePendingNodes.delete(id);
    for (const editor of customCSharpDetachedEditors.values()) {
      if (editor?.nodeId === id && customCSharpEditorRecordActive(editor)) {
        editor.setValidationPending?.(pending);
      }
    }
  }

function customCSharpLiveJobCurrent(job) {
    return customCSharpProjectEpoch === job.projectEpoch &&
      customCSharpLiveDiagnosticRevisions.get(job.key) === job.revision &&
      String(customCSharpEditorNode(job.nodeId)?.parameters?.[job.parameterKey] ?? "") === job.source;
  }

function drainCustomCSharpLiveDiagnostics() {
    if (customCSharpLiveDiagnosticRunning) return;
    const job = [...customCSharpLiveDiagnosticJobs.values()].find(candidate => candidate.ready);
    if (!job) return;
    customCSharpLiveDiagnosticJobs.delete(job.key);
    if (!customCSharpLiveJobCurrent(job)) {
      drainCustomCSharpLiveDiagnostics();
      return;
    }
    customCSharpLiveDiagnosticRunning = job;
    void validateCustomCSharpValueLive(job.parameterKey, job.source)
      .then(diagnostics => {
        if (diagnostics === null || !customCSharpLiveJobCurrent(job)) return;
        customCSharpLiveValidatedValues.set(job.key, job.source);
        setCustomCSharpLiveDiagnosticSnapshot(job.nodeId, diagnostics, { logOutput: true });
        setCustomCSharpLiveValidationPending(job.nodeId, false);
      })
      .catch(error => {
        if (!customCSharpLiveJobCurrent(job)) return;
        setCustomCSharpLiveDiagnosticSnapshot(job.nodeId, [
          `Roslyn live diagnostics failed: ${error instanceof Error ? error.message : String(error)}`
        ], { logOutput: true });
        setCustomCSharpLiveValidationPending(job.nodeId, false);
      })
      .finally(() => {
        if (customCSharpLiveDiagnosticRunning === job) customCSharpLiveDiagnosticRunning = null;
        drainCustomCSharpLiveDiagnostics();
      });
  }

function cancelCustomCSharpLiveDiagnostics(nodeId, parameterKey) {
    const key = customCSharpDetachedEditorKey(nodeId, parameterKey);
    const timer = customCSharpLiveDiagnosticTimers.get(key);
    if (timer) window.clearTimeout(timer);
    customCSharpLiveDiagnosticTimers.delete(key);
    customCSharpLiveDiagnosticJobs.delete(key);
    customCSharpLiveDiagnosticRevisions.set(key,
      (customCSharpLiveDiagnosticRevisions.get(key) || 0) + 1);
    setCustomCSharpLiveValidationPending(nodeId, false);
  }

function scheduleCustomCSharpLiveDiagnostics(
    node, specification, value, delay = CUSTOM_CSHARP_LIVE_INTERVAL_MS
  ) {
    const parameterKey = String(specification?.key || "code");
    if (!customCSharpSupportsLiveDiagnostics(parameterKey)) return false;
    const nodeId = String(node?.id || "");
    const key = customCSharpDetachedEditorKey(nodeId, parameterKey);
    const revision = (customCSharpLiveDiagnosticRevisions.get(key) || 0) + 1;
    customCSharpLiveDiagnosticRevisions.set(key, revision);
    const previous = customCSharpLiveDiagnosticJobs.get(key);
    customCSharpLiveDiagnosticJobs.set(key, {
      key, nodeId, parameterKey, revision, source: String(value ?? ""),
      projectEpoch: customCSharpProjectEpoch, ready: previous?.ready === true
    });
    setCustomCSharpLiveValidationPending(nodeId, true);
    if (!customCSharpLiveDiagnosticTimers.has(key)) {
      const timer = window.setTimeout(() => {
        customCSharpLiveDiagnosticTimers.delete(key);
        const current = customCSharpLiveDiagnosticJobs.get(key);
        if (current) current.ready = true;
        drainCustomCSharpLiveDiagnostics();
      }, Math.max(0, Number(delay) || 0));
      customCSharpLiveDiagnosticTimers.set(key, timer);
    }
    return true;
  }

function cancelCustomCSharpEditorPersistence() {
    if (customCSharpEditorPersistenceTimer) window.clearTimeout(customCSharpEditorPersistenceTimer);
    customCSharpEditorPersistenceTimer = 0;
    const wasDirty = customCSharpEditorPersistenceDirty;
    customCSharpEditorPersistenceDirty = false;
    return wasDirty;
  }

function flushCustomCSharpEditorPersistence() {
    if (!customCSharpEditorPersistenceDirty) return false;
    cancelCustomCSharpEditorPersistence();
    refreshDisplayValueNodes();
    scheduleGraphPersistenceAfterPaint({
      refreshGeneratedOutput: true,
      refreshCompositeActions: true,
      mutationClass: "parameter",
      acceptedMutation:
        currentAcceptedGraphDocumentMutation(
          "parameter"
        )
    });
    return true;
  }

function markCustomCSharpEditorPersistenceDirty() {
    if (typeof markGraphContentMutation === "function") {
      markGraphContentMutation();
    } else if (typeof graphContentMutationSequence === "number") {
      graphContentMutationSequence += 1;
    }
    if (!customCSharpEditorPersistenceDirty) {
      persistSchedule += 1;
      customCSharpEditorPersistenceDirty = true;
      bridge.markGeneratedOutputPending?.();
    }
  }

function queueCustomCSharpEditorPersistence() {
    if (!customCSharpEditorPersistenceDirty) {
      return false;
    }
    if (customCSharpEditorPersistenceTimer) window.clearTimeout(customCSharpEditorPersistenceTimer);
    const epoch = customCSharpProjectEpoch;
    customCSharpEditorPersistenceTimer = window.setTimeout(() => {
      if (epoch !== customCSharpProjectEpoch) return;
      if (graphParameterGestureActive()) {
        scheduleGraphParameterPersistence();
        return;
      }
      flushCustomCSharpEditorPersistence();
    }, CUSTOM_CSHARP_PERSIST_IDLE_MS);
    return true;
  }

function scheduleCustomCSharpEditorPersistence() {
    markCustomCSharpEditorPersistenceDirty();
    return queueCustomCSharpEditorPersistence();
  }

function setCustomCSharpSynchronizationStatus(
    nodeId,
    status,
    options = {}
  ) {
    const id = String(nodeId || "");
    if (!id) return;
    if (status) {
      customCSharpSynchronizationStatus.set(
        id,
        String(status)
      );
      appendCustomCSharpDebugOutput(
        id,
        status,
        options
      );
    } else {
      customCSharpSynchronizationStatus.delete(id);
    }
    updateCustomCSharpSynchronizationToast(
      id,
      status
    );
    for (const editor of
      customCSharpDetachedEditors.values()) {
      if (
        editor?.nodeId === id &&
        customCSharpEditorRecordActive(editor) &&
        typeof editor.setStatus === "function"
      ) {
        editor.setStatus({
          message: status
            ? `Custom C# · ${String(status)}`
            : "Synchronized with Builder",
          tone: options.tone || "info"
        });
      }
    }
    updateCustomCSharpSynchronizationControl(id);
    updatePackButton();
  }

function updateCustomCSharpSynchronizationControl(
    nodeId
  ) {
    const id = String(nodeId || "");
    if (!id || !dom.inspectorContent) {
      return;
    }

    const buttons =
      dom.inspectorContent.querySelectorAll(
        `[${CUSTOM_CSHARP_ACTION_NODE_ATTRIBUTE}="${CSS.escape(id)}"]`
      );
    if (buttons.length === 0) {
      return;
    }

    const node =
      customCSharpEditorNodeCandidates(
        id
      )[0] || null;
    if (!node) {
      return;
    }

    for (const button of buttons) {
      if (
        button instanceof
          HTMLButtonElement
      ) {
        applyCustomCSharpSynchronizationControl(
          button,
          node
        );
      }
    }
  }

function applyCustomCSharpSynchronizationControl(
    button,
    node
  ) {
    if (
      !(button instanceof HTMLButtonElement) ||
      !node
    ) {
      return false;
    }

    const synchronizing =
      customCSharpSynchronizations.has(
        String(node.id || "")
      );
    const openingAfterSynchronization =
      synchronizing &&
      customCSharpForegroundSynchronizationTokens.has(
        String(node.id || "")
      );
    const needsOptimization =
      customCSharpFileNeedsOptimization(
        node
      );
    const state = synchronizing
      ? openingAfterSynchronization
        ? "opening"
        : "synchronizing"
      : needsOptimization
        ? "dirty"
        : "synchronized";
    const label = synchronizing
      ? openingAfterSynchronization
        ? "Synchronizing & Opening Node Graph…"
        : "Synchronizing Node Graph…"
      : needsOptimization
        ? "Optimize & Open Node Graph"
        : "Open Node Graph";
    if (button.getAttribute("aria-label") !== label) {
      setInspectorButtonContent(button, label);
    }
    button.setAttribute(
      "aria-label",
      label
    );
    button.setAttribute(
      "aria-busy",
      synchronizing ? "true" : "false"
    );
    button.dataset
      .customCSharpSynchronizationState =
      state;
    return true;
  }

function updateCustomCSharpSynchronizationToast(
    nodeId,
    status
  ) {
    if (
      !graph?.active ||
      !runtimeGraphViewActive
    ) {
      return;
    }

    const toast =
      ensureGraphViewportToast();
    const id = String(nodeId || "");
    if (status) {
      clearTimeout(graphMessageTimer);
      graphMessageTimer = 0;
      toast.dataset
        .rmlCustomCSharpOperation = id;
      toast.textContent =
        `Custom C# · ${String(status)}`;
      toast.className =
        "rml-graph-toast progress";
      toast.setAttribute(
        "role",
        "status"
      );
      toast.setAttribute(
        "aria-live",
        "polite"
      );
      toast.hidden = false;
      return;
    }

    if (
      toast.dataset
        .rmlCustomCSharpOperation === id
    ) {
      delete toast.dataset
        .rmlCustomCSharpOperation;
      toast.hidden = true;
    }
  }

function cancelCustomCSharpSynchronization(
    nodeId
  ) {
    const id = String(nodeId || "");
    const controller =
      customCSharpSynchronizationControllers.get(
        id
      );
    if (!controller) return false;

    const error = new DOMException(
      "Custom C# synchronization was cancelled.",
      "AbortError"
    );
    customCSharpForegroundSynchronizationTokens.delete(
      id
    );
    setCustomCSharpSynchronizationStatus(
      id,
      "Abbruch wird ausgeführt…",
      {
        tone: "warning",
        source: "Builder"
      }
    );
    controller.abort(error);
    customCSharpBuildWorkers
      .get(id)
      ?.abort?.(error);

    return true;
  }

function customCSharpCancellable(
    promise,
    signal = null
  ) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        signal?.removeEventListener?.(
          "abort",
          handleAbort
        );
        callback(value);
      };
      const handleAbort = () =>
        finish(
          reject,
          signal?.reason ||
            new DOMException(
              "Custom C# synchronization was cancelled.",
              "AbortError"
            )
        );
      if (signal?.aborted) {
        handleAbort();
        return;
      }
      signal?.addEventListener?.(
        "abort",
        handleAbort,
        { once: true }
      );
      Promise.resolve(promise).then(
        value => finish(resolve, value),
        error => finish(reject, error)
      );
    });
  }

function customCSharpWorkerTransport() {
    const transport =
      window.RMLGraphCodegenTransport;
    if (
      transport?.version !== 1 ||
      typeof transport.stream !== "function" ||
      typeof transport.createDecoder !== "function" ||
      typeof transport.decode !== "function" ||
      typeof transport.finish !== "function" ||
      typeof transport.projectCatalog !== "function"
    ) {
      throw new Error(
        "The bounded graph-codegen Worker transport is unavailable. Reload the Builder without cached files."
      );
    }
    return transport;
  }

async function customCSharpSourceCatalogTokens(
    source,
    isCurrent
  ) {
    const text = String(source || "");
    const identifiers = new Set();
    let hasIndexer = false;
    let sliceStarted = performance.now();
    for (
      let offset = 0;
      offset < text.length;
      offset +=
        CUSTOM_CSHARP_CATALOG_SOURCE_CHUNK
    ) {
      if (!isCurrent()) {
        throw new DOMException(
          "A newer Custom C# synchronization replaced catalog preparation.",
          "AbortError"
        );
      }
      const start = Math.max(0, offset - 256);
      const chunk = text.slice(
        start,
        offset +
          CUSTOM_CSHARP_CATALOG_SOURCE_CHUNK
      );
      hasIndexer = hasIndexer ||
        chunk.includes("[");
      for (const match of chunk.matchAll(
        /@?[\p{L}_][\p{L}\p{N}_]*/gu
      )) {
        identifiers.add(
          String(match[0] || "")
            .replace(/^@/, "")
        );
      }
      if (
        performance.now() - sliceStarted >=
          CUSTOM_CSHARP_CATALOG_SCAN_SLICE_MS
      ) {
        await yieldBuilderTask();
        sliceStarted = performance.now();
      }
    }
    return { identifiers, hasIndexer };
  }

function customCSharpCatalogProjectionSnapshot() {
    const catalog =
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null;
    if (!catalog || typeof catalog !== "object") {
      return null;
    }
    const report =
      window.RMLApiNodeFactoryReport;
    const index =
      window.RMLApiCatalogProjectionIndex;
    const catalogFingerprint = String(
      catalog.catalogFingerprint ||
      catalog.assemblyFingerprint ||
      ""
    );
    const reportFingerprint = String(
      report?.catalogFingerprint || ""
    );
    const indexRevision = Number(
      report?.catalogProjectionRevision
    ) || 0;
    const definitionRevision = Number(
      window.__RMLNodeDefinitionRevision
    ) || 0;
    if (
      report?.verificationPassed !== true ||
      index?.version !== 1 ||
      !Object.isFrozen(index) ||
      index.catalog !== catalog ||
      index.report !== report ||
      !catalogFingerprint ||
      reportFingerprint !== catalogFingerprint ||
      String(index.catalogFingerprint || "") !==
        reportFingerprint ||
      String(index.engineVersion || "") !==
        String(report.engineVersion || "") ||
      indexRevision <= 0 ||
      Number(index.revision) !==
        indexRevision ||
      definitionRevision <= 0 ||
      Number(index.definitionRevision) !==
        definitionRevision ||
      typeof index.customCSharpByIdentifier
        ?.select !== "function" ||
      !Object.isFrozen(
        index.customCSharpByIdentifier
      ) ||
      !Array.isArray(index.catalogTypeNames) ||
      !Object.isFrozen(index.catalogTypeNames)
    ) {
      return null;
    }
    return {
      catalog,
      report,
      index,
      catalogFingerprint,
      indexRevision,
      definitionRevision
    };
  }

function customCSharpCatalogProjectionSnapshotCurrent(
    snapshot,
    isCurrent
  ) {
    if (!isCurrent()) return false;
    const current =
      customCSharpCatalogProjectionSnapshot();
    return Boolean(
      current &&
      current.catalog === snapshot.catalog &&
      current.report === snapshot.report &&
      current.index === snapshot.index &&
      current.catalogFingerprint ===
        snapshot.catalogFingerprint &&
      current.indexRevision ===
        snapshot.indexRevision &&
      current.definitionRevision ===
        snapshot.definitionRevision
    );
  }

function customCSharpCatalogChangedError() {
    return new DOMException(
      "The verified API catalog changed during Custom C# preparation. Retry with the current catalog index.",
      "AbortError"
    );
  }

async function customCSharpWorkerSupport(
    source,
    options,
    isCurrent
  ) {
    if (options?.disableCatalogNodes === true) {
      return {
        catalog: null,
        requirements: [],
        catalogTypeNames: []
      };
    }
    const transport =
      customCSharpWorkerTransport();
    const activeCatalog =
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null;
    if (!activeCatalog) {
      return {
        catalog: null,
        requirements: [],
        catalogTypeNames: []
      };
    }

    const sourceTokens =
      await customCSharpSourceCatalogTokens(
        source,
        isCurrent
      );
    for (let attempt = 0; attempt < 2; attempt += 1) {
      if (!isCurrent()) {
        throw customCSharpCatalogChangedError();
      }
      const snapshot =
        customCSharpCatalogProjectionSnapshot();
      if (!snapshot) {
        if (
          window.RMLApiNodeFactoryReport
            ?.verificationPassed === false
        ) {
          return {
            catalog: null,
            requirements: [],
            catalogTypeNames: []
          };
        }
        if (attempt === 0) {
          await yieldBuilderTask();
          continue;
        }
        if (!window.RMLApiNodeFactoryReport) {
          return {
            catalog: null,
            requirements: [],
            catalogTypeNames: []
          };
        }
        throw customCSharpCatalogChangedError();
      }

      let requirementList;
      try {
        requirementList =
          snapshot.index
            .customCSharpByIdentifier
            .select(
              sourceTokens.identifiers,
              sourceTokens.hasIndexer
            );
        if (
          !Array.isArray(requirementList) ||
          !Object.isFrozen(requirementList)
        ) {
          throw new Error(
            "The prepared Custom C# catalog index returned an invalid requirement list."
          );
        }
      } catch (error) {
        if (
          attempt === 0 &&
          !customCSharpCatalogProjectionSnapshotCurrent(
            snapshot,
            isCurrent
          )
        ) {
          await yieldBuilderTask();
          continue;
        }
        throw error;
      }
      if (
        !customCSharpCatalogProjectionSnapshotCurrent(
          snapshot,
          isCurrent
        )
      ) {
        if (attempt === 0 && isCurrent()) {
          await yieldBuilderTask();
          continue;
        }
        throw customCSharpCatalogChangedError();
      }
      if (requirementList.length === 0) {
        return {
          catalog: null,
          requirements: [],
          catalogTypeNames: []
        };
      }

      let projection;
      try {
        projection =
          await transport.projectCatalog(
            snapshot.catalog,
            requirementList
          );
      } catch (error) {
        if (
          attempt === 0 &&
          isCurrent() &&
          !customCSharpCatalogProjectionSnapshotCurrent(
            snapshot,
            isCurrent
          )
        ) {
          await yieldBuilderTask();
          continue;
        }
        throw error;
      }
      if (
        customCSharpCatalogProjectionSnapshotCurrent(
          snapshot,
          isCurrent
        )
      ) {
        return {
          catalog: projection,
          requirements: requirementList,
          catalogTypeNames:
            snapshot.index.catalogTypeNames
        };
      }
      if (attempt === 0 && isCurrent()) {
        await yieldBuilderTask();
        continue;
      }
      throw customCSharpCatalogChangedError();
    }
    throw customCSharpCatalogChangedError();
  }

function buildCustomCSharpFragmentInWorker(nodeId, source, parseResult, options) {
    if (typeof Worker !== "function") {
      return Promise.reject(
        new Error(
          "Custom C# graph construction requires Web Worker support so it cannot block the Builder UI."
        )
      );
    }
    let transport;
    try {
      transport = customCSharpWorkerTransport();
    } catch (error) {
      return Promise.reject(error);
    }
    const previous = customCSharpBuildWorkers.get(nodeId);
    if (previous) {
      previous.abort(
        new DOMException(
          "A newer Custom C# synchronization replaced this build.",
          "AbortError"
        )
      );
    }
    const worker = new Worker(
      new URL(
        "js/workers/graph_codegen_worker.js?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair",
        document.baseURI
      ),
      { name: "rml-custom-csharp-builder" }
    );
    const requestId = `custom-csharp-${++customCSharpBuildRequestSequence}`;
    return new Promise((resolve, reject) => {
      let settled = false;
      let resultDecoder = null;
      const settle = (callback, value) => {
        if (settled) return;
        settled = true;
        if (customCSharpBuildWorkers.get(nodeId) === record) {
          customCSharpBuildWorkers.delete(nodeId);
        }
        worker.terminate();
        callback(value);
      };
      const record = {
        worker,
        abort(error) {
          settle(reject, error);
        }
      };
      customCSharpBuildWorkers.set(nodeId, record);
      const isCurrent = () => Boolean(
        !settled &&
        customCSharpBuildWorkers.get(nodeId) ===
          record
      );
      const succeed = value => settle(resolve, value);
      const fail = (
        error,
        sourceLabel = "Worker"
      ) => {
        if (error?.name === "AbortError") {
          settle(reject, error);
          return;
        }
        const diagnostics = [
          ...(Array.isArray(
            error?.diagnostics
          )
            ? error.diagnostics
            : []),
          error?.message,
          error?.stack
        ]
          .map(diagnostic =>
            String(
              diagnostic?.message ||
                diagnostic ||
                ""
            ).trim()
          )
          .filter(Boolean);
        const message =
          diagnostics[0] ||
          "The background Custom C# graph build failed.";
        setCustomCSharpDiagnostics(
          nodeId,
          diagnostics.length > 0
            ? diagnostics
            : [message],
          { source: sourceLabel }
        );
        appendCustomCSharpDebugOutput(
          nodeId,
          message,
          {
            tone: "error",
            source: sourceLabel
          }
        );
        settle(reject, new Error(message));
      };
      worker.addEventListener("message", event => {
        const response = event.data || {};
        if (response.id !== requestId) return;
        if (response.progress === true) {
          setCustomCSharpSynchronizationStatus(
            nodeId,
            String(
              response.message ||
                "Worker: optimizing Custom C# graph…"
            ),
            { source: "Worker" }
          );
          return;
        }
        if (response.operation === "resultStart") {
          resultDecoder =
            transport.createDecoder();
          return;
        }
        if (response.operation === "resultChunk") {
          try {
            resultDecoder =
              resultDecoder ||
              transport.createDecoder();
            transport.decode(
              resultDecoder,
              response.tokens
            );
          } catch (error) {
            fail(error);
          }
          return;
        }
        if (response.operation === "resultEnd") {
          try {
            const fragment = transport.finish(
              resultDecoder
            );
            if (fragment?.ok === true) {
              succeed(fragment);
            } else {
              fail({
                message:
                  fragment?.diagnostics?.[0] ||
                  "The background Custom C# graph build failed.",
                diagnostics:
                  fragment?.diagnostics || []
              });
            }
          } catch (error) {
            fail(error);
          }
          return;
        }
        if (
          response.ok === true &&
          response.result?.ok === true
        ) {
          succeed(response.result);
          return;
        }
        fail({
          message:
            response.error?.message ||
            response.result?.diagnostics?.[0] ||
            "The background Custom C# graph build failed.",
          stack: response.error?.stack,
          diagnostics:
            response.result?.diagnostics || []
        });
      });
      worker.addEventListener("error", event => {
        const message =
          event.message ||
          "The background Custom C# worker failed.";
        const location = [
          event.filename,
          Number.isFinite(event.lineno)
            ? `line ${event.lineno}`
            : "",
          Number.isFinite(event.colno)
            ? `column ${event.colno}`
            : ""
        ]
          .filter(Boolean)
          .join(": ");
        fail({
          message,
          diagnostics: location
            ? [message, location]
            : [message]
        });
      });
      worker.addEventListener(
        "messageerror",
        () => {
          fail({
            name: "DataCloneError",
            message:
              "The background Custom C# worker returned data that could not be decoded."
          });
        }
      );
      void (async () => {
        const [payloadTransport, support] =
          await Promise.all([
            transport.stream(
              worker,
              requestId,
              "payload",
              {
                source: String(source || ""),
                parseResult,
                options: options || {}
              },
              { isCurrent }
            ),
            customCSharpWorkerSupport(
              source,
              options || {},
              isCurrent
            )
          ]);
        if (!isCurrent()) {
          throw new DOMException(
            "A newer Custom C# synchronization replaced this build.",
            "AbortError"
          );
        }
        const supportTransport =
          await transport.stream(
            worker,
            requestId,
            "support",
            support,
            { isCurrent }
          );
        if (!isCurrent()) {
          throw new DOMException(
            "A newer Custom C# synchronization replaced this build.",
            "AbortError"
          );
        }
        setCustomCSharpSynchronizationStatus(
          nodeId,
          `Worker: received bounded input (${payloadTransport.chunks + supportTransport.chunks} chunks, ${support.requirements.length.toLocaleString()} candidate API contracts)…`,
          { source: "Worker" }
        );
        worker.postMessage({
          id: requestId,
          operation:
            "customCSharpStreamCommit"
        });
      })().catch(error => fail(error));
    });
  }

function currentCustomCSharpCatalogStamp() {
    const report = window.RMLApiNodeFactoryReport;
    const verified =
      report?.verificationPassed === true &&
      ["scanner", "scanner-cache"].includes(
        String(report?.catalogSource || "")
      );
    return {
      fingerprint: verified
        ? String(report.catalogFingerprint || "")
        : "",
      engineVersion: verified
        ? String(report.engineVersion || "")
        : "",
      source: verified
        ? String(report.catalogSource || "")
        : "",
      definitionRevision: Number(
        window.__RMLNodeDefinitionRevision || 0
      )
    };
  }

function customCSharpStoredGraphMetadataMatches(
    stored,
    sourceHash,
    optimizerVersion,
    catalogStamp
  ) {
    return Boolean(
      stored &&
      stored.importedSource === true &&
      stored.sourceEditedInInspector !== true &&
      String(stored.sourceHash || "") ===
        String(sourceHash || "") &&
      Number(stored.optimizerVersion || 0) ===
        Number(optimizerVersion || 0) &&
      String(stored.catalogFingerprint || "") ===
        String(catalogStamp?.fingerprint || "") &&
      String(stored.catalogEngineVersion || "") ===
        String(catalogStamp?.engineVersion || "") &&
      String(stored.catalogSource || "") ===
        String(catalogStamp?.source || "") &&
      Number(
        stored.catalogDefinitionRevision || 0
      ) === Number(
        catalogStamp?.definitionRevision || 0
      )
    );
  }

function customCSharpFileNeedsOptimization(node) {
    if (
      !node ||
      node.operatorId !== "csharp.file" ||
      !["", "file"].includes(
        String(node.parameters?.mode || "")
      )
    ) {
      return false;
    }
    const source = String(node.parameters?.source || "");
    if (!source.trim()) return false;
    const existing =
      activeGraphCustomCSharpFileRegistry()[
        node.id
      ];
    if (
      existing &&
      existing.importedSource !== true &&
      existing.sourceEditedInInspector !== true
    ) {
      return false;
    }
    if (existing?.sourceEditedInInspector === true) return true;
    const visualCSharp = window.RMLVisualCSharp;
    if (!existing || !visualCSharp) return true;
    return !customCSharpStoredGraphReopenIdentityMatches(
      node
    );
  }

async function openCustomCSharpFileGraphSynced(nodeId, options = {}) {
    const normalizedNodeId = String(nodeId || "");
    const openAfterSync =
      options.openAfterSync !== false;
    const previousTask =
      customCSharpSynchronizationTasks.get(
        normalizedNodeId
      );
    if (previousTask) {
      if (openAfterSync) {
        const promotionToken = Symbol(
          "custom-csharp-open"
        );
        customCSharpForegroundSynchronizationTokens.set(
          normalizedNodeId,
          promotionToken
        );
        updateCustomCSharpSynchronizationControl(
          normalizedNodeId
        );
        try {
          await previousTask;
        } catch {}
        if (
          customCSharpForegroundSynchronizationTokens.get(
            normalizedNodeId
          ) !== promotionToken
        ) {
          return false;
        }
        customCSharpForegroundSynchronizationTokens.delete(
          normalizedNodeId
        );
        updateCustomCSharpSynchronizationControl(
          normalizedNodeId
        );
        if (
          !graph ||
          customCSharpEditor ||
          !findGraphNode(normalizedNodeId)
        ) {
          return false;
        }
        return openCustomCSharpFileGraphSynced(
          normalizedNodeId,
          options
        );
      }
      if (options.quiet === true) {
        if (
          customCSharpForegroundSynchronizationTokens.has(
            normalizedNodeId
          )
        ) {
          return false;
        }
        cancelCustomCSharpSynchronization(
          normalizedNodeId
        );
        try {
          await previousTask;
        } catch {}
      } else {
        return false;
      }
    }

    if (
      graph &&
      !customCSharpEditor &&
      customCSharpStoredGraphReopenIdentityMatches(
        normalizedNodeId
      )
    ) {
      return openAfterSync
        ? await openCustomCSharpFileGraphReady(
            normalizedNodeId
          )
        : true;
    }

    const controller =
      new AbortController();
    const foregroundToken = openAfterSync
      ? Symbol("custom-csharp-open")
      : null;
    if (foregroundToken) {
      customCSharpForegroundSynchronizationTokens.set(
        normalizedNodeId,
        foregroundToken
      );
    }
    customCSharpSynchronizationControllers.set(
      normalizedNodeId,
      controller
    );
    customCSharpSynchronizations.add(
      normalizedNodeId
    );
    const synchronizationEpoch =
      customCSharpProjectEpoch;
    setCustomCSharpDiagnostics(
      normalizedNodeId,
      []
    );
    setCustomCSharpSynchronizationStatus(
      normalizedNodeId,
      "Loading Roslyn…",
      { source: "Builder" }
    );
    const task =
      synchronizeCustomCSharpFileGraph(
        normalizedNodeId,
        options,
        synchronizationEpoch,
        controller.signal
      );
    customCSharpSynchronizationTasks.set(
      normalizedNodeId,
      task
    );
    try {
      return await task;
    } finally {
      if (
        customCSharpSynchronizationTasks.get(
          normalizedNodeId
        ) === task
      ) {
        customCSharpSynchronizationTasks.delete(
          normalizedNodeId
        );
        customCSharpSynchronizationControllers.delete(
          normalizedNodeId
        );
        customCSharpSynchronizations.delete(
          normalizedNodeId
        );
        if (
          foregroundToken &&
          customCSharpForegroundSynchronizationTokens.get(
            normalizedNodeId
          ) === foregroundToken
        ) {
          customCSharpForegroundSynchronizationTokens.delete(
            normalizedNodeId
          );
        }
        setCustomCSharpSynchronizationStatus(
          normalizedNodeId,
          ""
        );
      }
    }
  }

async function synchronizeCustomCSharpFileGraph(
    nodeId,
    options = {},
    synchronizationEpoch = customCSharpProjectEpoch,
    signal = null
  ) {
    const assertCurrentProject = () => {
      if (signal?.aborted) {
        throw signal.reason ||
          new DOMException(
            "Custom C# synchronization was cancelled.",
            "AbortError"
          );
      }
      if (
        synchronizationEpoch !==
        customCSharpProjectEpoch
      ) {
        throw new DOMException(
          "The project changed while the Custom C# graph was being optimized.",
          "AbortError"
        );
      }
    };
    assertCurrentProject();
    if (!graph) return false;
    const openAfterSync =
      options.openAfterSync !== false;
    const requestedOwnerBinding =
      options.ownerBinding || null;
    const ownerLocation =
      requestedOwnerBinding &&
      customCSharpOwnerBindingCurrent(
        requestedOwnerBinding
      )
        ? {
            node:
              requestedOwnerBinding.owner,
            document:
              requestedOwnerBinding.document
          }
        : typeof customCSharpEditorNodeLocations ===
            "function"
          ? customCSharpEditorNodeLocations(
              nodeId
            ).find(location =>
              !customCSharpEditor &&
              findGraphNode(nodeId) ===
                location.node
            )
          : !customCSharpEditor &&
              findGraphNode(nodeId)
            ? {
                node: findGraphNode(nodeId),
                document:
                  typeof apiCompositeEditorOwnerPath ===
                    "function" &&
                  apiCompositeEditorOwnerPath()
                    .length > 0 &&
                  typeof apiCompositeEditorDocument ===
                    "function"
                    ? apiCompositeEditorDocument(
                        apiCompositeEditor
                      )
                    : graph
              }
            : null;
    const owner = ownerLocation?.node || null;
    const synchronizationOwnerDocument =
      ownerLocation?.document || null;
    const activeOwnerCustomEditor = Boolean(
      customCSharpEditor &&
      customCSharpEditor.openOwner === owner &&
      customCSharpEditor.openOwnerDocument ===
        synchronizationOwnerDocument
    );
    if (
      !owner ||
      !synchronizationOwnerDocument ||
      customCSharpEditor &&
        !activeOwnerCustomEditor ||
      activeOwnerCustomEditor &&
        openAfterSync
    ) {
      return false;
    }
    if (
      openAfterSync &&
      !commitApiCompositeEditorBeforeCustomOpen()
    ) {
      return false;
    }
    const quiet = options.quiet === true;
    const definition = owner ? nodeDefinition(owner) : null;
    if (!owner || definition?.customCSharpFile !== true) return false;
    const ownerId = owner.id;
    const currentBoundOwner = () =>
      synchronizationOwnerDocument
        ?.nodes?.find(candidate =>
          candidate === owner
        ) || null;
    const synchronizationOwnerPath =
      requestedOwnerBinding
        ? Object.freeze([
            ...requestedOwnerBinding.ownerPath
          ])
        : typeof apiCompositeEditorOwnerPath ===
            "function"
        ? Object.freeze([
            ...apiCompositeEditorOwnerPath()
          ])
        : Object.freeze([]);
    const originalOwnerRegistryPropertyPresent =
      Object.hasOwn(
        synchronizationOwnerDocument,
        "customCSharpFiles"
      );
    const originalOwnerRegistryPropertyValue =
      synchronizationOwnerDocument
        ?.customCSharpFiles;
    let expectedOwnerRegistryPropertyPresent =
      originalOwnerRegistryPropertyPresent;
    let expectedOwnerRegistryPropertyValue =
      originalOwnerRegistryPropertyValue;
    let ownerRegistry =
      originalOwnerRegistryPropertyValue &&
      typeof originalOwnerRegistryPropertyValue ===
        "object" &&
      !Array.isArray(
        originalOwnerRegistryPropertyValue
      )
        ? originalOwnerRegistryPropertyValue
        : null;
    let ownerRegistryCreated = false;
    const synchronizationOwnerNodes =
      synchronizationOwnerDocument.nodes;
    const synchronizationPreparationKey =
      customCSharpOpenPreparationKey(
        ownerId,
        synchronizationOwnerPath
      );
    const assertCurrentOwnerContext = () => {
      assertCurrentProject();
      const currentOwnerPath =
        requestedOwnerBinding
          ? requestedOwnerBinding.ownerPath
          : typeof apiCompositeEditorOwnerPath ===
              "function"
            ? apiCompositeEditorOwnerPath()
            : [];
      const currentOwnerDocument =
        requestedOwnerBinding
          ? requestedOwnerBinding.document
          : currentOwnerPath.length > 0 &&
              typeof apiCompositeEditorDocument ===
                "function"
            ? apiCompositeEditorDocument(
                apiCompositeEditor
              )
            : graph;
      if (
        currentOwnerDocument?.nodes !==
          synchronizationOwnerNodes ||
        currentOwnerDocument.nodes.find(
          candidate => candidate === owner
        ) !== owner ||
        currentOwnerDocument !==
          synchronizationOwnerDocument ||
        Object.hasOwn(
          synchronizationOwnerDocument,
          "customCSharpFiles"
        ) !==
          expectedOwnerRegistryPropertyPresent ||
        synchronizationOwnerDocument
          ?.customCSharpFiles !==
          expectedOwnerRegistryPropertyValue ||
        currentOwnerPath.length !==
          synchronizationOwnerPath.length ||
        currentOwnerPath.some(
          (value, index) =>
            value !==
              synchronizationOwnerPath[index]
        )
      ) {
        throw new DOMException(
          "The owning graph changed while the Custom C# graph was being optimized.",
          "AbortError"
        );
      }
    };
    const createOwnerRegistry = () => {
      if (ownerRegistry) return ownerRegistry;
      ownerRegistry = {};
      synchronizationOwnerDocument
        .customCSharpFiles = ownerRegistry;
      ownerRegistryCreated = true;
      expectedOwnerRegistryPropertyPresent = true;
      expectedOwnerRegistryPropertyValue =
        ownerRegistry;
      return ownerRegistry;
    };
    const rollbackCreatedOwnerRegistry = () => {
      if (
        !ownerRegistryCreated ||
        synchronizationOwnerDocument
          ?.customCSharpFiles !== ownerRegistry ||
        Object.keys(ownerRegistry).length > 0
      ) {
        return false;
      }
      if (originalOwnerRegistryPropertyPresent) {
        synchronizationOwnerDocument
          .customCSharpFiles =
          originalOwnerRegistryPropertyValue;
      } else {
        delete synchronizationOwnerDocument
          .customCSharpFiles;
      }
      ownerRegistryCreated = false;
      ownerRegistry = null;
      expectedOwnerRegistryPropertyPresent =
        originalOwnerRegistryPropertyPresent;
      expectedOwnerRegistryPropertyValue =
        originalOwnerRegistryPropertyValue;
      return true;
    };
    const commitSynchronizedGraph =
      customGraph => {
        const registry = createOwnerRegistry();
        if (Array.isArray(customGraph.nodes)) {
          customCSharpInitialViewportPendingNodeSets
            .add(customGraph.nodes);
        }
        registry[ownerId] = customGraph;
        if (activeOwnerCustomEditor) {
          applyGraphView(
            graphViewFrom(customGraph)
          );
          customCSharpEditor.openPreparation =
            null;
          customCSharpEditor.openStoredGraph =
            customGraph;
          customCSharpEditor.openOwnerSource =
            String(
              owner.parameters?.source || ""
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
          customCSharpEditor.openViewState =
            customCSharpOpenPreparationViewState();
          customCSharpEditor.reopenIdentity =
            null;
          customCSharpEditor.reopenIdentityReady =
            false;
          customCSharpPresentedNodeSets.add(
            graph.nodes
          );
          resetGraphRenderCaches();
          currentAnalysis = null;
          if (!customCSharpInlineEditorKey) {
            activateGraphMode();
          }
        }
        return customGraph;
      };
    const source = String(owner.parameters?.source || "");
    if (!source.trim()) {
      const existingEmptyGraph =
        ownerRegistry?.[ownerId];
      const sourceReplacedExistingGraph =
        existingEmptyGraph
          ?.sourceEditedInInspector === true;
      const createdGraph =
        !existingEmptyGraph ||
        sourceReplacedExistingGraph;
      if (createdGraph) {
        const emptyGraph =
          createEmptyCustomCSharpFileGraph(
            owner
          );
        emptyGraph.importedSource = true;
        emptyGraph.sourceEditedInInspector =
          false;
        emptyGraph.sourceHash = hashText("");
        emptyGraph.optimizerVersion = Number(
          window.RMLVisualCSharp?.version || 0
        );
        const emptyCatalogStamp =
          currentCustomCSharpCatalogStamp();
        emptyGraph.catalogFingerprint =
          emptyCatalogStamp.fingerprint;
        emptyGraph.catalogEngineVersion =
          emptyCatalogStamp.engineVersion;
        emptyGraph.catalogSource =
          emptyCatalogStamp.source;
        emptyGraph.catalogDefinitionRevision =
          emptyCatalogStamp.definitionRevision;
        customCSharpValidatedSourceNodeSets.add(
          emptyGraph.nodes
        );
        commitSynchronizedGraph(emptyGraph);
      }
      if (createdGraph) {
        scheduleAcceptedGraphPersistenceAfterPaint({
          refreshGeneratedOutput: true,
          refreshCompositeActions: true,
          mutationClass: "topology"
        });
      }
      if (!openAfterSync) return true;
      const opened = await openCustomCSharpFileGraphReady(
        ownerId,
        signal
      );
      if (opened) {
        showGraphMessage("Opened an empty visual C# 14 file graph. Build the complete source with syntax nodes and connect it to Output.", "success");
      }
      return opened;
    }

    const existingGraph =
      ownerRegistry?.[ownerId];
    if (
      existingGraph &&
      existingGraph.importedSource !== true &&
      existingGraph.sourceEditedInInspector !== true
    ) {
      if (!openAfterSync) return true;
      const opened = await openCustomCSharpFileGraphReady(
        ownerId,
        signal
      );
      return opened;
    }

    const roslyn = window.RMLCSharp14Roslyn;
    const visualCSharp = window.RMLVisualCSharp;
    if (
      typeof roslyn?.parse !== "function" ||
      typeof visualCSharp?.createRoslynImportFragment !== "function" ||
      typeof visualCSharp?.createCustomCSharpFileGraphFromFragment !== "function"
    ) {
      if (!quiet) showGraphMessage("The bundled .NET 10 Roslyn converter is unavailable.", "error");
      return false;
    }

    try {
      await window.RMLModNodesReady;
    } catch {}
    assertCurrentOwnerContext();

    const initialCatalogStamp = currentCustomCSharpCatalogStamp();

    const sourceHash =
      visualCSharp.sourceHash?.(source) ||
      hashText(source);
    if (
      existingGraph &&
      customCSharpStoredGraphReopenIdentityMatches(
        owner
      ) &&
      customCSharpStoredGraphMetadataMatches(
        existingGraph,
        sourceHash,
        visualCSharp.version,
        initialCatalogStamp
      )
    ) {
      updateCustomCSharpSynchronizationControl(
        ownerId
      );
      return openAfterSync
        ? await openCustomCSharpFileGraphReady(
            ownerId,
            signal
          )
        : true;
    }

    setCustomCSharpSynchronizationStatus(
      ownerId,
      "Roslyn: parsing C# 14…"
    );
    try {
      const parseResult = await customCSharpCancellable(
        roslyn.parse(source),
        signal
      );
      assertCurrentOwnerContext();
      const currentOwner = currentBoundOwner();
      if (String(currentOwner?.parameters?.source || "") !== source) {
        if (!quiet) showGraphMessage("The source changed during validation. Open Node Graph again to synchronize the latest text.", "warning");
        return false;
      }
      if (parseResult?.ok !== true) {
        const messages = visualCSharp.formatRoslynDiagnostics?.(parseResult?.diagnostics) || [];
        setCustomCSharpLiveDiagnosticSnapshot(
          ownerId,
          messages.length > 0
            ? messages
            : parseResult?.diagnostics
        );
        for (const message of messages) {
          appendCustomCSharpDebugOutput(
            ownerId,
            message,
            {
              tone: "error",
              source: "Roslyn"
            }
          );
        }
        throw new Error(messages[0] || "Roslyn rejected the direct source as invalid C# 14 syntax.");
      }
      if (
        existingGraph &&
        Array.isArray(existingGraph.nodes) &&
        Array.isArray(
          existingGraph.connections
        )
      ) {
        setCustomCSharpSynchronizationStatus(
          ownerId,
          "Roslyn: validating existing graph roundtrip…"
        );
        const roundtripContentMutationIdentity =
          customCSharpContentMutationIdentity();
        const roundtripOwner = currentOwner;
        const roundtripNodes = existingGraph.nodes;
        const roundtripConnections =
          existingGraph.connections;
        const renderedExisting =
          visualCSharp.renderCustomCSharpGraph?.(
            existingGraph
          );
        if (
          renderedExisting?.ok === true &&
          typeof renderedExisting.source ===
            "string"
        ) {
          const renderedValidation =
            renderedExisting.source === source
              ? parseResult
              : await customCSharpCancellable(
                  roslyn.parse(
                    renderedExisting.source
                  ),
                  signal
                );
          assertCurrentOwnerContext();
          const signature =
            visualCSharp.roslynStructuralSignature;
          const roundtripInputStillCurrent =
            roundtripContentMutationIdentity !==
              null &&
            customCSharpContentMutationIdentity() ===
              roundtripContentMutationIdentity &&
            currentBoundOwner() ===
              roundtripOwner &&
            ownerRegistry?.[ownerId] ===
              existingGraph &&
            existingGraph.nodes ===
              roundtripNodes &&
            existingGraph.connections ===
              roundtripConnections;
          if (!roundtripInputStillCurrent) {
            if (!quiet) {
              showGraphMessage(
                "The Custom C# graph changed during validation. Open Node Graph again to validate the current graph.",
                "warning"
              );
            }
            return false;
          }
          const sourceStillCurrent =
            String(
              currentBoundOwner()
                ?.parameters?.source || ""
            ) === source;
          const storedStillCurrent =
            ownerRegistry?.[ownerId] ===
              existingGraph;
          const catalogStillCurrent =
            customCSharpCatalogStampMatches(
              initialCatalogStamp,
              currentCustomCSharpCatalogStamp()
            );
          const roundtripMatches =
            renderedValidation?.ok === true &&
            (
              renderedExisting.source === source ||
              (
                typeof signature === "function" &&
                signature(parseResult.root) ===
                  signature(
                    renderedValidation.root
                  )
              )
            );
          if (
            sourceStillCurrent &&
            storedStillCurrent &&
            catalogStillCurrent &&
            roundtripMatches
          ) {
            const previousSourceHash =
              existingGraph.sourceHash;
            const previousSourceEdited =
              existingGraph.sourceEditedInInspector;
            existingGraph.sourceHash = sourceHash;
            existingGraph.sourceEditedInInspector = false;
            const remembered =
              rememberStoredCustomCSharpReopenIdentity(
                ownerId,
                currentOwner,
                { sourceValidated: true }
              );
            if (!remembered) {
              existingGraph.sourceHash =
                previousSourceHash;
              existingGraph.sourceEditedInInspector =
                previousSourceEdited;
            }
            if (remembered) {
            updateCustomCSharpSynchronizationControl(
              ownerId
            );
            if (!openAfterSync) return true;
            setCustomCSharpSynchronizationStatus(
              ownerId,
              "Opening validated Node Graph…"
            );
            return await openCustomCSharpFileGraphReady(
              ownerId,
              signal
            );
            }
          }
        }
      }
      const fragmentOptions = {
        fileName: String(owner.parameters?.fileName || "VisualProgram.cs"),
        projectId: String(owner.parameters?.projectId || "main"),
        nullable: owner.parameters?.nullable || "inherit",
        autoGeneratedHeader: owner.parameters?.autoGeneratedHeader === true,
        prefix: `custom-csharp-sync-${hashText(`${ownerId}\0${source}`)}`
      };
      setCustomCSharpSynchronizationStatus(
        ownerId,
        "Worker: optimizing syntax nodes…"
      );
      let fragment = await buildCustomCSharpFragmentInWorker(ownerId, source, parseResult, fragmentOptions);
      assertCurrentOwnerContext();
      if (!fragment?.ok) throw new Error(fragment?.diagnostics?.[0] || "The Roslyn Node Graph synchronization failed.");
      const selectedCatalogNodeIds = [...new Set(
        fragment.nodes
          .map(node => String(node?.operatorId || ""))
          .filter(operatorId => operatorId.startsWith("api."))
      )];
      if (selectedCatalogNodeIds.length > 0) {
        setCustomCSharpSynchronizationStatus(
          ownerId,
          `Checking ${selectedCatalogNodeIds.length.toLocaleString()} optimized scanner API node${selectedCatalogNodeIds.length === 1 ? "" : "s"}…`
        );
        const gate = window.RMLCatalogImportGate?.ensureForImport;
        if (typeof gate !== "function") {
          fragment = await buildCustomCSharpFragmentInWorker(ownerId, source, parseResult, {
            ...fragmentOptions,
            prefix: `${fragmentOptions.prefix}-no-unverified-catalog`,
            disableCatalogNodes: true
          });
          assertCurrentOwnerContext();
        } else {
          try {
            await customCSharpCancellable(
              gate({ requiredNodeIds: selectedCatalogNodeIds }),
              signal
            );
            assertCurrentOwnerContext();
            setCustomCSharpSynchronizationStatus(
              ownerId,
              "Worker: applying verified API nodes…"
            );
            fragment = await buildCustomCSharpFragmentInWorker(ownerId, source, parseResult, fragmentOptions);
            assertCurrentOwnerContext();
          } catch (error) {
            if (error?.name === "AbortError") {
              throw error;
            }
            setCustomCSharpSynchronizationStatus(
              ownerId,
              "Worker: building catalog-free fallback…"
            );
            fragment = await buildCustomCSharpFragmentInWorker(ownerId, source, parseResult, {
              ...fragmentOptions,
              prefix: `${fragmentOptions.prefix}-catalog-unavailable`,
              disableCatalogNodes: true
            });
            assertCurrentOwnerContext();
          }
        }
        if (!fragment?.ok) throw new Error(fragment?.diagnostics?.[0] || "The verified catalog fallback graph could not be created.");
      }
      let prepared = visualCSharp.createCustomCSharpFileGraphFromFragment(fragment);
      if (!prepared?.ok) throw new Error(prepared?.diagnostics?.[0] || "The Custom C# File graph could not be created.");

      let preparedGraphValidationFailure = "";
      const validatePreparedGraph = async candidate => {
        setCustomCSharpSynchronizationStatus(
          ownerId,
          "Roslyn: validating graph roundtrip…"
        );
        const rendered = visualCSharp.renderCustomCSharpGraph(candidate.customGraph);
        if (rendered?.ok !== true) {
          const messages =
            Array.isArray(rendered?.diagnostics) &&
            rendered.diagnostics.length > 0
              ? rendered.diagnostics
              : ["The visual graph renderer rejected the synchronized graph."];
          preparedGraphValidationFailure = String(
            messages[0]?.message ||
              messages[0]
          );
          setCustomCSharpDiagnostics(
            ownerId,
            messages,
            { source: "Builder" }
          );
          for (const message of messages) {
            appendCustomCSharpDebugOutput(
              ownerId,
              message,
              {
                tone: "warning",
                source: "Codegen"
              }
            );
          }
          return false;
        }
        const validation = await customCSharpCancellable(
          roslyn.parse(rendered.source),
          signal
        );
        assertCurrentOwnerContext();
        if (validation?.ok !== true) {
          const messages =
            visualCSharp.formatRoslynDiagnostics?.(
              validation?.diagnostics
            ) || [];
          preparedGraphValidationFailure =
            messages[0] ||
            "Roslyn rejected the source rendered from the synchronized graph.";
          setCustomCSharpDiagnostics(
            ownerId,
            messages.length > 0
              ? messages
              : [preparedGraphValidationFailure],
            { source: "Roslyn" }
          );
          for (const message of
            messages.length > 0
              ? messages
              : [preparedGraphValidationFailure]) {
            appendCustomCSharpDebugOutput(
              ownerId,
              message,
              {
                tone: "warning",
                source: "Roslyn"
              }
            );
          }
          return false;
        }
        const signature = visualCSharp.roslynStructuralSignature;
        const matches = typeof signature !== "function" ||
          signature(parseResult.root) === signature(validation.root);
        preparedGraphValidationFailure = matches
          ? ""
          : "The rendered graph changed the Roslyn token or meaningful-trivia structure.";
        if (!matches) {
          setCustomCSharpDiagnostics(
            ownerId,
            [preparedGraphValidationFailure],
            { source: "Roslyn" }
          );
          appendCustomCSharpDebugOutput(
            ownerId,
            preparedGraphValidationFailure,
            {
              tone: "warning",
              source: "Roslyn"
            }
          );
        }
        return matches;
      };
      if (!await validatePreparedGraph(prepared)) {
        fragment = await buildCustomCSharpFragmentInWorker(ownerId, source, parseResult, {
          ...fragmentOptions,
          prefix: `${fragmentOptions.prefix}-semantic`,
          disableCatalogNodes: true
        });
        assertCurrentOwnerContext();
        if (!fragment?.ok) throw new Error(fragment?.diagnostics?.[0] || "The catalog-independent semantic graph could not be created.");
        prepared = visualCSharp.createCustomCSharpFileGraphFromFragment(fragment);
      }
      if (!prepared?.ok || !await validatePreparedGraph(prepared)) {
        setCustomCSharpSynchronizationStatus(
          ownerId,
          "Worker: building exact Roslyn fallback…"
        );
        fragment = await buildCustomCSharpFragmentInWorker(
          ownerId,
          source,
          parseResult,
          {
            ...fragmentOptions,
            prefix: `${fragmentOptions.prefix}-exact`,
            disableCatalogNodes: true,
            semanticOptimization: false
          }
        );
        assertCurrentOwnerContext();
        if (!fragment?.ok) {
          throw new Error(
            fragment?.diagnostics?.[0] ||
              "The exact Roslyn fallback graph could not be created."
          );
        }
        prepared =
          visualCSharp.createCustomCSharpFileGraphFromFragment(
            fragment
          );
      }
      if (!prepared?.ok || !await validatePreparedGraph(prepared)) {
        throw new Error(
          `Roslyn accepted this file as valid C# 14, but even the exact raw Roslyn graph could not reproduce it losslessly. ${preparedGraphValidationFailure || "The exact subtree validator failed without a diagnostic."} This is an internal visual-importer error. The previous valid graph and the original source were preserved.`
        );
      }
      if (String(currentBoundOwner()?.parameters?.source || "") !== source) {
        return false;
      }

      prepared.customGraph.sourceHash = sourceHash;
      prepared.customGraph.optimizerVersion = Number(visualCSharp.version || 0);
      const finalCatalogStamp = currentCustomCSharpCatalogStamp();
      prepared.customGraph.catalogFingerprint = finalCatalogStamp.fingerprint;
      prepared.customGraph.catalogEngineVersion = finalCatalogStamp.engineVersion;
      prepared.customGraph.catalogSource = finalCatalogStamp.source;
      prepared.customGraph.catalogDefinitionRevision = finalCatalogStamp.definitionRevision;
      prepared.customGraph.importedSource = true;
      prepared.customGraph.sourceEditedInInspector = false;
      const preparedRegistry =
        createOwnerRegistry();
      const preparationOwnerPath =
        synchronizationOwnerPath;
      const preparationOwnerDocument =
        synchronizationOwnerDocument;
      const preparationOwnerNodes =
        synchronizationOwnerNodes;
      const preparationOwnerRegistry =
        preparationOwnerDocument
          ?.customCSharpFiles &&
        typeof preparationOwnerDocument
          .customCSharpFiles === "object" &&
        !Array.isArray(
          preparationOwnerDocument
            .customCSharpFiles
        )
          ? preparationOwnerDocument
              .customCSharpFiles
          : preparedRegistry;
      const openPreparation = openAfterSync
        ? {
            fileNodeId: ownerId,
            owner,
            ownerSource: source,
            ownerPath: [
              ...preparationOwnerPath
            ],
            ownerDocument:
              preparationOwnerDocument,
            ownerNodes:
              preparationOwnerNodes,
            ownerRegistry:
              preparationOwnerRegistry,
            hadOriginalOwnerGraph:
              Object.hasOwn(
                preparationOwnerRegistry,
                ownerId
              ),
            originalOwnerGraph:
              preparationOwnerRegistry[
                ownerId
              ],
            registry: preparedRegistry,
            hadOriginalGraph:
              Object.hasOwn(
                preparedRegistry,
                ownerId
              ),
            originalGraph:
              preparedRegistry[ownerId],
            preparedGraph:
              prepared.customGraph,
            customProjectEpoch:
              customCSharpProjectEpoch,
            builderProjectEpoch
          }
        : null;
      if (openPreparation) {
        openPreparation.key =
          synchronizationPreparationKey;
        customCSharpPendingOpenPreparations.set(
          openPreparation.key,
          openPreparation
        );
      }
      if (!openAfterSync) {
        commitSynchronizedGraph(
          prepared.customGraph
        );
      }
      updateCustomCSharpSynchronizationControl(
        ownerId
      );
      setCustomCSharpDiagnostics(
        ownerId,
        []
      );
      if (!openAfterSync) {
        scheduleAcceptedGraphPersistenceAfterPaint({
          refreshGeneratedOutput: true,
          refreshCompositeActions: true,
          mutationClass: "topology"
        });
      }
      if (!openAfterSync) {
        rememberStoredCustomCSharpReopenIdentity(
          ownerId,
          owner,
          { sourceValidated: true }
        );
        return true;
      }
      setCustomCSharpSynchronizationStatus(
        ownerId,
        "Opening optimized Node Graph…"
      );
      const opened = await openCustomCSharpFileGraphReady(
        ownerId,
        signal
      );
      if (!opened) {
        const pending =
          customCSharpPendingOpenPreparations.get(
            openPreparation?.key
          );
        customCSharpPendingOpenPreparations.delete(
          openPreparation?.key
        );
        restoreCustomCSharpOpenPreparation(
          pending
        );
        rollbackCreatedOwnerRegistry();
      }
      if (opened) {
        const synchronizedNodes = prepared.customGraph.nodes || [];
        const usingCount = synchronizedNodes.filter(node => node.operatorId === "csharp.usingDirective").length;
        const catalogCount = synchronizedNodes.filter(node => String(node.operatorId || "").startsWith("api.")).length;
        showGraphMessage(`Opened ${prepared.importedSyntaxNodeCount.toLocaleString()} editable C# nodes: ${usingCount.toLocaleString()} Using Directive and ${catalogCount.toLocaleString()} verified scanner API nodes.`, "success");
        appendCustomCSharpDebugOutput(
          ownerId,
          `Validation completed with ${prepared.importedSyntaxNodeCount.toLocaleString()} editable C# nodes and ${catalogCount.toLocaleString()} verified scanner API nodes.`,
          {
            tone: "success",
            source: "Roslyn"
          }
        );
      }
      return opened;
    } catch (error) {
      const pendingKey =
        synchronizationPreparationKey;
      const pending =
        customCSharpPendingOpenPreparations.get(
          pendingKey
        );
      if (pending) {
        customCSharpPendingOpenPreparations.delete(
          pendingKey
        );
        restoreCustomCSharpOpenPreparation(
          pending
        );
      }
      rollbackCreatedOwnerRegistry();
      if (error?.name === "AbortError") return false;
      const message =
        error instanceof Error
          ? error.message
          : String(error);
      setCustomCSharpDiagnostics(
        ownerId,
        [message],
        { source: "Builder" }
      );
      appendCustomCSharpDebugOutput(
        ownerId,
        message,
        {
          tone: "error",
          source: "Builder"
        }
      );
      setCustomCSharpSynchronizationStatus(
        ownerId,
        message,
        {
          tone: "error",
          source: "Builder"
        }
      );
      if (!quiet) showGraphMessage(message, "error");
      return false;
    }
  }

function serializableCustomCSharpFiles(
    sourceFiles
  ) {
    const result = {};
    for (const [ownerId, customGraph] of
      Object.entries(sourceFiles || {})) {
      const serializedView =
        serializableGraphView(customGraph);
      result[ownerId] = {
        ...serializedView,
        version: 1,
        fileName: String(
          customGraph?.fileName ||
          "VisualProgram.cs"
        ),
        projectId: String(
          customGraph?.projectId || "main"
        ),
        parser: String(
          customGraph?.parser || "Visual C#"
        ),
        languageVersion: String(
          customGraph?.languageVersion ||
          "14.0"
        ),
        optimizerVersion: Math.max(
          0,
          Math.trunc(
            finiteNumber(
              customGraph?.optimizerVersion,
              0
            )
          )
        ),
        catalogFingerprint: String(
          customGraph?.catalogFingerprint ||
          ""
        ),
        catalogEngineVersion: String(
          customGraph
            ?.catalogEngineVersion || ""
        ),
        catalogSource: String(
          customGraph?.catalogSource || ""
        ),
        catalogDefinitionRevision:
          Math.max(
            0,
            Math.trunc(
              finiteNumber(
                customGraph
                  ?.catalogDefinitionRevision,
                0
              )
            )
          ),
        importedSource:
          customGraph?.importedSource ===
          true,
        sourceEditedInInspector:
          customGraph
            ?.sourceEditedInInspector ===
          true,
        coordinateSpaceVersion:
          CUSTOM_CSHARP_COORDINATE_SPACE_VERSION,
        sourceHash: String(
          customGraph?.sourceHash || ""
        ),
        outputNodeId: String(
          customGraph?.outputNodeId || ""
        ),
        rootSyntaxNodeId: String(
          customGraph?.rootSyntaxNodeId ||
          ""
        ),
        directSourceNodeId: String(
          customGraph?.directSourceNodeId ||
          ""
        )
      };
    }
    return result;
  }

function normalizedCustomCSharpEditorColor(
    value,
    fallback
  ) {
    const candidate = String(value || "")
      .trim();
    return /^#[0-9a-f]{6}$/i.test(candidate)
      ? candidate
      : fallback;
  }

const CUSTOM_CSHARP_EDITOR_APPEARANCE_PARAMETERS =
  Object.freeze([
    ["codeWorkbenchBackgroundColor", "workbench"],
    ["codeBoxBackgroundColor", "background"],
    ["codeGutterBackgroundColor", "gutter"],
    ["codePanelBackgroundColor", "panel"],
    ["codeOverlayBackgroundColor", "overlay"],
    ["codeStatusBackgroundColor", "status"],
    ["codeSelectionBackgroundColor", "selection"],
    ["codeBoxTextColor", "text"],
    ["codeInterfaceTextColor", "uiText"],
    ["codeGutterTextColor", "gutterText"],
    ["codeStatusTextColor", "statusText"],
    ["codeAccentColor", "accent"],
    ["codeBoxCaretColor", "caret"]
  ].map(entry => Object.freeze(entry)));

function normalizedCustomCSharpEditorAppearance(
    appearance
  ) {
    return Object.fromEntries(
      CUSTOM_CSHARP_EDITOR_APPEARANCE_PARAMETERS.map(
        ([parameterKey, appearanceKey]) => [
          parameterKey,
          normalizedCustomCSharpEditorColor(
            appearance?.[appearanceKey],
            CUSTOM_CSHARP_EDITOR_COLORS[
              appearanceKey
            ]
          )
        ]
      )
    );
  }

function commitCustomCSharpEditorAppearance(
    node,
    appearance
  ) {
    if (!node) return false;
    const normalized =
      normalizedCustomCSharpEditorAppearance(
        appearance
      );
    const parameters =
      node.parameters &&
      typeof node.parameters === "object" &&
      !Array.isArray(node.parameters)
        ? node.parameters
        : null;
    const unchanged =
      CUSTOM_CSHARP_EDITOR_APPEARANCE_PARAMETERS
        .every(([parameterKey, appearanceKey]) =>
          normalizedCustomCSharpEditorColor(
            parameters?.[parameterKey],
            CUSTOM_CSHARP_EDITOR_COLORS[
              appearanceKey
            ]
          ) === normalized[parameterKey]
        );
    if (unchanged) return false;

    if (!parameters) {
      node.parameters = {};
    }
    Object.assign(node.parameters, normalized);
    return true;
  }

function customCSharpEditorAppearance(node) {
    const appearanceNode =
      node?.parameters &&
      (
        node.parameters
          .codeWorkbenchBackgroundColor ||
        node.parameters
          .codeBoxBackgroundColor ||
        node.parameters.codeGutterBackgroundColor ||
        node.parameters.codePanelBackgroundColor ||
        node.parameters.codeOverlayBackgroundColor ||
        node.parameters.codeStatusBackgroundColor ||
        node.parameters.codeSelectionBackgroundColor ||
        node.parameters.codeBoxTextColor ||
        node.parameters.codeInterfaceTextColor ||
        node.parameters.codeGutterTextColor ||
        node.parameters.codeStatusTextColor ||
        node.parameters.codeAccentColor ||
        node.parameters.codeBoxCaretColor
      )
        ? node
        : customCSharpEditor
          ? customCSharpEditor.mainView
              .nodes.find(candidate =>
                candidate.id ===
                  customCSharpEditor.fileNodeId
              ) || node
          : node;
    return {
      workbench:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeWorkbenchBackgroundColor,
          CUSTOM_CSHARP_EDITOR_COLORS
            .workbench
        ),
      background:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeBoxBackgroundColor,
          CUSTOM_CSHARP_EDITOR_COLORS
            .background
        ),
      gutter:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeGutterBackgroundColor,
          CUSTOM_CSHARP_EDITOR_COLORS.gutter
        ),
      panel:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codePanelBackgroundColor,
          CUSTOM_CSHARP_EDITOR_COLORS.panel
        ),
      overlay:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeOverlayBackgroundColor,
          CUSTOM_CSHARP_EDITOR_COLORS.overlay
        ),
      status:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeStatusBackgroundColor,
          CUSTOM_CSHARP_EDITOR_COLORS.status
        ),
      selection:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeSelectionBackgroundColor,
          CUSTOM_CSHARP_EDITOR_COLORS.selection
        ),
      text:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeBoxTextColor,
          CUSTOM_CSHARP_EDITOR_COLORS.text
        ),
      uiText:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeInterfaceTextColor,
          CUSTOM_CSHARP_EDITOR_COLORS.uiText
        ),
      gutterText:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeGutterTextColor,
          CUSTOM_CSHARP_EDITOR_COLORS.gutterText
        ),
      statusText:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeStatusTextColor,
          CUSTOM_CSHARP_EDITOR_COLORS.statusText
        ),
      accent:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeAccentColor,
          CUSTOM_CSHARP_EDITOR_COLORS.accent
        ),
      caret:
        normalizedCustomCSharpEditorColor(
          appearanceNode?.parameters
            ?.codeBoxCaretColor,
          CUSTOM_CSHARP_EDITOR_COLORS.caret
        )
    };
  }

function applyCustomCSharpEditorAppearance(
    control,
    node
  ) {
    if (!(control instanceof Element)) {
      return;
    }
    control.classList.add(
      "rml-custom-csharp-inspector-control"
    );
  }

function refreshCustomCSharpEditorAppearance(
    node
  ) {
    const selector =
      `[${CUSTOM_CSHARP_CODE_NODE_ATTRIBUTE}="${CSS.escape(node.id)}"]`;
    dom.inspectorContent
      ?.querySelectorAll(selector)
      .forEach(control =>
        applyCustomCSharpEditorAppearance(
          control,
          node
        )
      );
    for (const detached of
      customCSharpDetachedEditors.values()) {
      if (
        detached?.nodeId === node.id &&
        customCSharpEditorRecordActive(detached) &&
        typeof detached.setAppearance ===
          "function"
      ) {
        detached.setAppearance(
          customCSharpEditorAppearance(node)
        );
      }
    }
  }

function customCSharpDetachedEditorKey(
    nodeId,
    parameterKey
  ) {
    return `${String(nodeId || "")}\u0000${String(parameterKey || "code")}`;
  }

function customCSharpEditorRecordActive(
    editor
  ) {
    if (!editor) return false;
    if (
      editor.mode === "inline" ||
      editor.mode === "overlay"
    ) {
      return Boolean(
        editor.frame?.isConnected &&
        (editor.mode !== "overlay" ||
          editor.overlay?.isConnected) &&
        editor.popup?.closed !== true
      );
    }
    return editor.popup?.closed === false;
  }

function loadCustomCSharpDetachedEditorModule() {
    if (
      window.RMLCustomCSharpDetachedEditor?.version >= 37 &&
      typeof window.RMLCustomCSharpDetachedEditor?.mount === "function"
    ) {
      return Promise.resolve(
        window.RMLCustomCSharpDetachedEditor
      );
    }
    if (
      customCSharpDetachedEditorModulePromise
    ) {
      return customCSharpDetachedEditorModulePromise;
    }

    customCSharpDetachedEditorModulePromise =
      new Promise((resolve, reject) => {
        const script =
          document.createElement("script");
        script.src = new URL(
          "js/editor/custom_csharp_editor.js?v=1.8-native-search-shortcut-ownership",
          document.baseURI
        ).href;
        script.async = true;
        script.addEventListener(
          "load",
          () => {
            const editor =
              window.RMLCustomCSharpDetachedEditor;
            if (
              editor?.version >= 37 &&
              typeof editor.mount === "function"
            ) {
              resolve(editor);
            } else {
              reject(
                new Error(
                  "The detached Custom C# editor module loaded without its public editor contract."
                )
              );
            }
          },
          { once: true }
        );
        script.addEventListener(
          "error",
          () => {
            reject(
              new Error(
                "The detached Custom C# editor module could not be loaded."
              )
            );
          },
          { once: true }
        );
        document.head.appendChild(script);
      }).catch(error => {
        customCSharpDetachedEditorModulePromise =
          null;
        throw error;
      });

    return customCSharpDetachedEditorModulePromise;
  }

function customCSharpEditorNode(
    nodeId
  ) {
    return (
      customCSharpEditorNodeCandidates(
        nodeId
      )[0] || null
    );
  }

function customCSharpEditorNodeLocations(
    nodeId
  ) {
    const id = String(nodeId || "");
    const locations = [];
    const seenNodes = new Set();
    const addLocation = (
      node,
      documentValue
    ) => {
      if (
        !node ||
        !documentValue ||
        seenNodes.has(node)
      ) {
        return;
      }
      seenNodes.add(node);
      locations.push({ node, document: documentValue });
    };
    const visitedDocuments = new WeakSet();
    const appendDocument = (
      documentValue,
      depth = 0
    ) => {
      if (
        !documentValue ||
        typeof documentValue !== "object" ||
        Array.isArray(documentValue) ||
        visitedDocuments.has(documentValue) ||
        depth > API_COMPOSITE_MAX_NESTING_DEPTH
      ) {
        return;
      }
      visitedDocuments.add(documentValue);
      const node = documentValue.nodes?.find(
        candidate => candidate?.id === id
      );
      addLocation(node, documentValue);
      for (const nested of Object.values(
        documentValue.apiCompositeGraphs || {}
      )) {
        appendDocument(nested, depth + 1);
      }
    };
    const customOwner =
      customCSharpEditor?.mainView?.nodes?.find(
        candidate => candidate?.id === id
      );
    addLocation(
      customOwner,
      customCSharpEditor?.openOwnerDocument ||
        graph
    );
    const visibleDocument =
      !customCSharpEditor &&
      apiCompositeEditor &&
      typeof apiCompositeEditorDocument ===
        "function"
        ? apiCompositeEditorDocument(
            apiCompositeEditor
          )
        : !customCSharpEditor
          ? graph
          : null;
    addLocation(
      visibleDocument?.nodes?.find(
        candidate => candidate?.id === id
      ),
      visibleDocument
    );
    appendDocument(visibleDocument);
    appendDocument(graph);
    for (const frame of apiCompositeEditorChain(
      apiCompositeEditor,
      { outermostFirst: true }
    )) {
      const frameOwner =
        frame?.mainView?.nodes?.find(
          candidate => candidate?.id === id
        );
      addLocation(
        frameOwner,
        typeof apiCompositeEditorDocument ===
          "function"
          ? apiCompositeEditorDocument(frame)
          : frame?.mainView
      );
      appendDocument(
        typeof apiCompositeEditorDocument ===
          "function"
          ? apiCompositeEditorDocument(frame)
          : frame?.mainView
      );
    }
    return locations;
  }

function customCSharpEditorNodeCandidates(
    nodeId
  ) {
    return customCSharpEditorNodeLocations(
      nodeId
    ).map(location => location.node);
  }

function markCustomCSharpSourceAuthoritative(
    locations,
    source
  ) {
    const value = String(source ?? "");
    const markedGraphs = new Set();
    let marked = false;
    for (const location of
      Array.isArray(locations) ? locations : []) {
      const node = location?.node;
      const documentValue = location?.document;
      if (
        !node ||
        !documentValue ||
        nodeDefinition(node)?.customCSharpFile !== true
      ) {
        continue;
      }
      let registry =
        documentValue.customCSharpFiles;
      if (
        !registry ||
        typeof registry !== "object" ||
        Array.isArray(registry)
      ) {
        registry = {};
        documentValue.customCSharpFiles = registry;
      }
      const customGraph =
        registry[node.id] ||
        createEmptyCustomCSharpFileGraph(node);
      if (!markedGraphs.has(customGraph)) {
        markedGraphs.add(customGraph);
        customGraph.sourceEditedInInspector = true;
        customGraph.sourceHash = "";
      }
      registry[node.id] = customGraph;
      marked = true;
    }
    if (marked) {
      updateCustomCSharpSynchronizationControl(
        locations[0]?.node?.id
      );
    }
    return marked;
  }

function markCustomCSharpGraphAuthoritative(
    mutationClass = "topology"
  ) {
    if (
      !customCSharpEditor ||
      !["parameter", "topology"].includes(
        String(mutationClass)
      )
    ) {
      return false;
    }

    const owner =
      customCSharpEditor.openOwner;
    const ownerDocument =
      customCSharpEditor.openOwnerDocument;

    const stored =
      customCSharpEditor.openPreparation
        ?.preparedGraph ||
      ownerDocument?.customCSharpFiles?.[
        owner?.id
      ] ||
      customCSharpEditor.openStoredGraph;

    if (
      !owner ||
      !stored ||
      typeof stored !== "object"
    ) {
      return false;
    }

    cancelCustomCSharpSourceGraphSynchronization(
      owner
    );

    const running =
      customCSharpSynchronizationControllers.get(
        String(owner.id || "")
      );

    if (
      running &&
      !running.signal.aborted
    ) {
      running.abort(
        new DOMException(
          "The Custom C# graph changed after the source synchronization started.",
          "AbortError"
        )
      );
    }

    stored.sourceEditedInInspector = false;
    stored.sourceHash = "";

    if (customCSharpEditor.openPreparation) {
      customCSharpEditor
        .topologyChangedDuringPreparation = true;
    }

    updateCustomCSharpSynchronizationControl(
      owner.id
    );
    return true;
  }

function customCSharpVisibleOwnerBinding(
    locations,
    source
  ) {
    const values = Array.isArray(locations)
      ? locations
      : [];
    const activeCustomOwner =
      customCSharpEditor?.openOwner || null;
    const activeCustomDocument =
      customCSharpEditor?.openOwnerDocument ||
      null;
    let location = activeCustomOwner
      ? values.find(candidate =>
          candidate.node === activeCustomOwner &&
          candidate.document === activeCustomDocument
        )
      : null;
    if (!location && !customCSharpEditor) {
      const visibleDocument =
        apiCompositeEditor &&
        typeof apiCompositeEditorDocument ===
          "function"
          ? apiCompositeEditorDocument(
              apiCompositeEditor
            )
          : graph;
      location = values.find(candidate =>
        candidate.document === visibleDocument &&
        findGraphNode(candidate.node?.id) ===
          candidate.node
      );
    }
    if (!location) return null;
    return Object.freeze({
      owner: location.node,
      document: location.document,
      ownerPath: Object.freeze([
        ...(
          customCSharpEditor?.openOwner ===
            location.node
            ? customCSharpEditor
                .openOwnerPath || []
            : typeof apiCompositeEditorOwnerPath ===
                "function"
              ? apiCompositeEditorOwnerPath()
              : []
        )
      ]),
      source: String(source ?? ""),
      projectEpoch: customCSharpProjectEpoch,
      builderProjectEpoch
    });
  }

function customCSharpOwnerBindingCurrent(
    binding
  ) {
    if (
      !binding ||
      binding.projectEpoch !==
        customCSharpProjectEpoch ||
      binding.builderProjectEpoch !==
        builderProjectEpoch ||
      String(
        binding.owner?.parameters?.source ?? ""
      ) !== binding.source
    ) {
      return false;
    }
    const current =
      customCSharpEditorNodeLocations(
        binding.owner.id
      ).some(location =>
        location.node === binding.owner &&
        location.document === binding.document
      );
    if (!current) return false;
    if (customCSharpEditor) {
      return Boolean(
        customCSharpEditor.openOwner ===
          binding.owner &&
        customCSharpEditor.openOwnerDocument ===
          binding.document &&
        customCSharpEditor.openOwnerPath.length ===
          binding.ownerPath.length &&
        customCSharpEditor.openOwnerPath.every(
          (value, index) =>
            value === binding.ownerPath[index]
        )
      );
    }
    const visibleDocument =
      apiCompositeEditor &&
      typeof apiCompositeEditorDocument ===
        "function"
        ? apiCompositeEditorDocument(
            apiCompositeEditor
          )
        : graph;
    return Boolean(
      visibleDocument === binding.document &&
      findGraphNode(binding.owner.id) ===
        binding.owner
    );
  }

function cancelCustomCSharpSourceGraphSynchronization(
    ownerOrId = null
  ) {
    let cancelled = false;
    for (const [owner, timer] of
      customCSharpSourceSyncTimers) {
      if (
        ownerOrId &&
        owner !== ownerOrId &&
        String(owner?.id || "") !==
          String(ownerOrId || "")
      ) {
        continue;
      }
      window.clearTimeout(timer);
      customCSharpSourceSyncTimers.delete(owner);
      cancelled = true;
    }
    return cancelled;
  }

function startCustomCSharpSourceGraphSynchronization(
    binding
  ) {
    if (!customCSharpOwnerBindingCurrent(binding)) {
      return Promise.resolve(false);
    }







    return openCustomCSharpFileGraphSynced(
      binding.owner.id,
      {
        openAfterSync: false,
        quiet: true,
        ownerBinding: binding
      }
    ).catch(error => {
      if (error?.name !== "AbortError") {
        setCustomCSharpDiagnostics(
          binding.owner.id,
          [
            error instanceof Error
              ? error.message
              : String(error)
          ],
          { source: "Builder" }
        );
      }
      return false;
    }).finally(() => {
      queueCustomCSharpEditorPersistence();
    });
  }

function scheduleCustomCSharpSourceGraphSynchronization(
    locations,
    source
  ) {
    const binding =
      customCSharpVisibleOwnerBinding(
        locations,
        source
      );
    if (!binding) return false;
    cancelCustomCSharpSourceGraphSynchronization(
      binding.owner
    );
    const timer = window.setTimeout(() => {
      if (
        customCSharpSourceSyncTimers.get(
          binding.owner
        ) !== timer
      ) {
        return;
      }
      customCSharpSourceSyncTimers.delete(
        binding.owner
      );
      void startCustomCSharpSourceGraphSynchronization(
        binding
      );
    }, CUSTOM_CSHARP_SOURCE_GRAPH_SYNC_IDLE_MS);
    customCSharpSourceSyncTimers.set(
      binding.owner,
      timer
    );
    return true;
  }

function flushCustomCSharpSourceGraphSynchronization(
    ownerOrId
  ) {
    const locations =
      customCSharpEditorNodeLocations(
        typeof ownerOrId === "object"
          ? ownerOrId?.id
          : ownerOrId
      ).filter(location =>
        typeof ownerOrId !== "object" ||
        location.node === ownerOrId
      );
    const owner = locations[0]?.node;
    const binding =
      customCSharpVisibleOwnerBinding(
        locations,
        owner?.parameters?.source || ""
      );
    if (!binding) return Promise.resolve(false);
    cancelCustomCSharpSourceGraphSynchronization(
      binding.owner
    );
    return startCustomCSharpSourceGraphSynchronization(
      binding
    );
  }

function rememberCustomCSharpEditorDraft(
    nodeId,
    parameterKey,
    value
  ) {
    const key = customCSharpDetachedEditorKey(
      nodeId,
      parameterKey
    );
    const next = String(value ?? "");
    customCSharpEditorDraftValues.set(
      key,
      next
    );
    return next;
  }

function customCSharpEditorCurrentValue(
    nodeId,
    parameterKey,
    fallback = ""
  ) {
    const editorKey =
      customCSharpDetachedEditorKey(
        nodeId,
        parameterKey
      );
    if (
      customCSharpEditorDraftValues.has(
        editorKey
      )
    ) {
      return customCSharpEditorDraftValues.get(
        editorKey
      );
    }
    const node = customCSharpEditorNode(nodeId);
    return String(
      node?.parameters?.[parameterKey] ??
        fallback ??
        ""
    );
  }

function synchronizeCustomCSharpInspectorValue(
    nodeId,
    parameterKey,
    value
  ) {
    const id = String(nodeId || "");
    const key = String(parameterKey || "code");
    const next = String(value ?? "");
    const editorKey =
      customCSharpDetachedEditorKey(id, key);
    const record =
      customCSharpDetachedEditors.get(editorKey);

    if (
      customCSharpEditorDraftValues.has(editorKey) ||
      customCSharpEditorRecordActive(record)
    ) {
      rememberCustomCSharpEditorDraft(
        id,
        key,
        next
      );
    }

    if (
      customCSharpEditorRecordActive(record) &&
      record.getValue?.() !== next
    ) {
      record.setValue?.(next);
    }

    const previous =
      customCSharpEditor?.previousPresentation;
    if (
      previous?.nodeId === id &&
      String(previous.parameterKey || "code") === key
    ) {
      previous.value = next;
    }

    const controls =
      dom.inspectorContent?.querySelectorAll(
        `[${CUSTOM_CSHARP_CODE_NODE_ATTRIBUTE}="${CSS.escape(id)}"]` +
        `[${CUSTOM_CSHARP_CODE_PARAMETER_ATTRIBUTE}="${CSS.escape(key)}"]`
      ) || [];

    for (const control of controls) {
      if (
        !(control instanceof HTMLTextAreaElement) ||
        control.value === next
      ) {
        continue;
      }

      const active =
        document.activeElement === control;
      const start =
        active ? control.selectionStart : null;
      const end =
        active ? control.selectionEnd : null;
      const direction =
        active
          ? control.selectionDirection || "forward"
          : "forward";

      control.value = next;

      if (
        active &&
        Number.isFinite(start) &&
        Number.isFinite(end)
      ) {
        const maximum = control.value.length;
        control.setSelectionRange(
          Math.min(start, maximum),
          Math.min(end, maximum),
          direction
        );
      }
    }

    return next;
  }

function commitCustomCSharpEditorValue(
    nodeId,
    specification,
    value,
    { validateUnchanged = true } = {}
  ) {
    const parameterKey = String(
      specification?.key || "code"
    );
    const next = rememberCustomCSharpEditorDraft(
      nodeId,
      parameterKey,
      value
    );
    const locations =
      customCSharpEditorNodeLocations(nodeId);
    const nodes = locations.map(
      location => location.node
    );
    if (nodes.length === 0) return false;
    if (!validateUnchanged && nodes.every(candidate =>
      String(candidate.parameters?.[parameterKey] ?? "") === next)) {
      synchronizeCustomCSharpInspectorValue(nodeId, parameterKey, next);
      return true;
    }
    for (const candidate of nodes) {
      candidate.parameters =
        candidate.parameters &&
        typeof candidate.parameters === "object"
          ? candidate.parameters
          : {};
      candidate.parameters[parameterKey] = next;
    }
    const node = nodes[0];
    const synchronization = customCSharpSynchronizationControllers.get(String(nodeId));
    if (synchronization && !synchronization.signal.aborted) {
      synchronization.abort(new DOMException("The source changed while its graph was being synchronized.", "AbortError"));
    }
    synchronizeCustomCSharpInspectorValue(
      node.id,
      parameterKey,
      next
    );
    scheduleCustomCSharpLiveDiagnostics(
      node,
      specification,
      next
    );
    let sourceGraphSynchronizationScheduled =
      false;

    const editsOwnerSource =
      parameterKey === "source" &&
      nodeDefinition(node)?.customCSharpFile === true;

    if (editsOwnerSource) {
      markCustomCSharpSourceAuthoritative(
        locations,
        next
      );

      sourceGraphSynchronizationScheduled =
        scheduleCustomCSharpSourceGraphSynchronization(
          locations,
          next
        );
    } else if (
      customCSharpEditor &&
      graph.nodes?.includes(node)
    ) {
      markCustomCSharpGraphAuthoritative(
        "parameter"
      );
    }
    if (sourceGraphSynchronizationScheduled) {
      markCustomCSharpEditorPersistenceDirty();
    } else {
      scheduleCustomCSharpEditorPersistence();
    }
    return true;
  }

function clearGraphCanvasForCustomCSharpEditor() {
    cancelInteraction(false);
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
    dom.builderCanvas?.replaceChildren();
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

function createCustomCSharpInlineFrame(
    editorKey,
    title
  ) {
    customCSharpInlineEditorKey = editorKey;
    clearGraphCanvasForCustomCSharpEditor();
    const frame = document.createElement("iframe");
    frame.className =
      "rml-custom-csharp-inline-editor";
    frame.src = "about:blank";
    frame.title = String(
      title || "Custom C# code editor"
    );
    frame.setAttribute(
      "aria-label",
      frame.title
    );
    frame.setAttribute("scrolling", "no");
    const shell =
      document.createElement("div");
    shell.className =
      "rml-custom-csharp-inline-shell";
    const navigationTrail =
      createGraphNavigationTrail({
        inlineEditorKey: editorKey,
        inlineEditorTitle: title
      });
    shell.append(
      navigationTrail,
      frame
    );
    dom.builderCanvas?.appendChild(shell);
    dom.navigationTrail =
      navigationTrail;
    if (dom.canvasTitle) {
      dom.canvasTitle.innerHTML =
        "<small>Custom C#</small> Embedded code editor";
    }
    if (dom.activeContainerName) {
      dom.activeContainerName.textContent =
        "Editor · synchronized with node";
    }
    updatePackButton();
    return frame;
  }

function bringCustomCSharpOverlayToFront(
    overlay
  ) {
    if (!overlay?.isConnected) return;
    if (
      customCSharpEditorOverlayZ >=
      2147482950
    ) {
      customCSharpEditorOverlayZ =
        2147482200;
      const overlays = [
        ...document.querySelectorAll(
          ".rml-custom-csharp-editor-overlay"
        )
      ].sort(
        (left, right) =>
          (Number(left.dataset.rmlOverlayZ) || 0) -
          (Number(right.dataset.rmlOverlayZ) || 0)
      );
      for (const candidate of overlays) {
        customCSharpEditorOverlayZ += 1;
        candidate.dataset.rmlOverlayZ = String(
          customCSharpEditorOverlayZ
        );
      }
    }
    customCSharpEditorOverlayZ += 1;
    overlay.dataset.rmlOverlayZ = String(
      customCSharpEditorOverlayZ
    );
  }

function createCustomCSharpOverlayFrame(
    editorKey,
    title
  ) {
    const overlay =
      document.createElement("section");
    overlay.className =
      "rml-custom-csharp-editor-overlay";
    overlay.dataset.editorKey =
      hashText(editorKey);
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute(
      "aria-label",
      String(title || "Custom C# code editor")
    );
    const refreshScrollLayerVisual = () =>
      window.RMLUniversalScrollLayers
        ?.refresh?.();

    const titlebar =
      document.createElement("div");
    titlebar.className =
      "rml-custom-csharp-overlay-titlebar";
    const heading =
      document.createElement("strong");
    heading.textContent = String(
      title || "Custom C# code editor"
    );
    const actions =
      document.createElement("div");
    actions.className =
      "rml-custom-csharp-overlay-window-actions";
    const windowIcon = paths =>
      `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
    const returnIcon = windowIcon(
      '<path d="M9 7 4 12l5 5"></path><path d="M4 12h10a6 6 0 0 1 6 6"></path>'
    );
    const minimizeIcon = windowIcon(
      '<path d="M6 16h12"></path>'
    );
    const maximizeIcon = windowIcon(
      '<rect x="6" y="6" width="12" height="12" rx="1"></rect>'
    );
    const restoreIcon = windowIcon(
      '<path d="M9 8V6h9v9h-2"></path><rect x="6" y="9" width="9" height="9" rx="1"></rect>'
    );
    const closeIcon = windowIcon(
      '<path d="m7 7 10 10M17 7 7 17"></path>'
    );
    const windowButton = (
      label,
      icon,
      handler
    ) => {
      const button =
        document.createElement("button");
      button.type = "button";
      button.innerHTML = icon;
      button.title = label;
      button.setAttribute(
        "aria-label",
        label
      );
      button.addEventListener(
        "click",
        event => {
          event.stopPropagation();
          handler(button);
        }
      );
      return button;
    };
    const returnToEditor = windowButton(
      "Return to embedded editor",
      returnIcon,
      () =>
        moveCustomCSharpEditorToInline(
          editorKey
        )
    );
    const minimize = windowButton(
      "Minimize editor overlay",
      minimizeIcon,
      button => {
        const minimized =
          overlay.classList.toggle(
            "minimized"
          );
        if (minimized) {
          overlay.classList.remove(
            "maximized"
          );
          maximize.innerHTML = maximizeIcon;
          maximize.setAttribute(
            "aria-label",
            "Maximize editor overlay"
          );
          maximize.title =
            "Maximize editor overlay";
        }
        button.setAttribute(
          "aria-label",
          minimized
            ? "Restore editor overlay"
            : "Minimize editor overlay"
        );
        button.title =
          button.getAttribute("aria-label");
        bringCustomCSharpOverlayToFront(
          overlay
        );
        refreshScrollLayerVisual();
      }
    );
    const maximize = windowButton(
      "Maximize editor overlay",
      maximizeIcon,
      button => {
        overlay.classList.remove(
          "minimized"
        );
        minimize.setAttribute(
          "aria-label",
          "Minimize editor overlay"
        );
        minimize.title =
          "Minimize editor overlay";
        const maximized =
          overlay.classList.toggle(
            "maximized"
          );
        button.innerHTML =
          maximized ? restoreIcon : maximizeIcon;
        button.setAttribute(
          "aria-label",
          maximized
            ? "Restore editor overlay"
            : "Maximize editor overlay"
        );
        button.title =
          button.getAttribute("aria-label");
        bringCustomCSharpOverlayToFront(
          overlay
        );
        refreshScrollLayerVisual();
      }
    );
    const close = windowButton(
      "Close editor overlay",
      closeIcon,
      () =>
        closeCustomCSharpEditorRecord(
          editorKey
        )
    );
    actions.append(
      returnToEditor,
      minimize,
      maximize,
      close
    );
    titlebar.append(
      heading,
      actions
    );

    const frame =
      document.createElement("iframe");
    frame.className =
      "rml-custom-csharp-overlay-frame";
    frame.src = "about:blank";
    frame.title = String(
      title || "Custom C# code editor"
    );
    frame.setAttribute(
      "aria-label",
      frame.title
    );
    frame.setAttribute("scrolling", "no");
    overlay.append(
      titlebar,
      frame
    );
    document.body.appendChild(overlay);
    bringCustomCSharpOverlayToFront(
      overlay
    );

    let drag = null;
    titlebar.addEventListener(
      "pointerdown",
      event => {
        if (
          event.button !== 0 ||
          event.target?.closest?.("button") ||
          overlay.classList.contains(
            "maximized"
          )
        ) {
          return;
        }
        const rectangle =
          overlay.getBoundingClientRect();
        drag = {
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          left: rectangle.left,
          top: rectangle.top
        };
        bringCustomCSharpOverlayToFront(
          overlay
        );
        try {
          titlebar.setPointerCapture?.(
            event.pointerId
          );
        } catch {}
        event.preventDefault();
      }
    );
    titlebar.addEventListener(
      "pointermove",
      event => {
        if (
          !drag ||
          drag.pointerId !== event.pointerId
        ) {
          return;
        }
        const rectangle =
          overlay.getBoundingClientRect();
        const left = nodeGraphClamp(
          drag.left +
            event.clientX - drag.startX,
          0,
          Math.max(
            0,
            window.innerWidth -
              Math.min(80, rectangle.width)
          )
        );
        const top = nodeGraphClamp(
          drag.top +
            event.clientY - drag.startY,
          0,
          Math.max(
            0,
            window.innerHeight - 38
          )
        );
        overlay.dataset.rmlOverlayLeft =
          String(left);
        overlay.dataset.rmlOverlayTop =
          String(top);
        refreshScrollLayerVisual();
        event.preventDefault();
      }
    );
    const finishDrag = event => {
      if (
        !drag ||
        drag.pointerId !== event.pointerId
      ) {
        return;
      }
      drag = null;
      try {
        titlebar.releasePointerCapture?.(
          event.pointerId
        );
      } catch {}
      refreshScrollLayerVisual();
    };
    titlebar.addEventListener(
      "pointerup",
      finishDrag
    );
    titlebar.addEventListener(
      "pointercancel",
      finishDrag
    );
    titlebar.addEventListener(
      "dblclick",
      event => {
        if (!event.target?.closest?.("button")) {
          maximize.click();
        }
      }
    );
    overlay.addEventListener(
      "pointerdown",
      () =>
        bringCustomCSharpOverlayToFront(
          overlay
        ),
      true
    );

    return { overlay, frame };
  }

function restoreGraphAfterCustomCSharpInlineEditor(
    editorKey
  ) {
    if (customCSharpInlineEditorKey !== editorKey) {
      return;
    }
    customCSharpInlineEditorKey = "";
    if (dom.canvasTitle) {
      dom.canvasTitle.innerHTML =
        customCSharpEditor
          ? "<small>File graph</small> Custom C# File"
          : apiCompositeEditor
            ? "<small>Composite graph</small> API &amp; Logic structure"
            : "<small>Step 3</small> Typed runtime graph";
    }
    if (dom.activeContainerName) {
      dom.activeContainerName.textContent =
        customCSharpEditor
          ? `Isolated · ${customCSharpEditor.fileName}`
          : apiCompositeEditor
            ? `Composite · ${apiCompositeEditor.title}`
            : "Exact type matching";
    }
    if (
      graph?.active &&
      runtimeGraphViewActive &&
      dom.builderCanvas
    ) {
      renderGraphCanvas();
    }
    updatePackButton();
  }

function closeCustomCSharpEditorRecord(
    editorKey,
    { restoreGraph = true } = {}
  ) {
    const record =
      customCSharpDetachedEditors.get(editorKey);
    if (!record) return;
    customCSharpDetachedEditors.delete(editorKey);
    record.dispose?.();
    if (
      customCSharpActiveEditorKey === editorKey
    ) {
      customCSharpActiveEditorKey = "";
    }
    customCSharpEditorDraftValues.delete(
      editorKey
    );
    cancelCustomCSharpLiveDiagnostics(
      record.nodeId,
      record.parameterKey
    );
    if (record.mode === "inline") {
      record.frame?.remove();
      if (restoreGraph) {
        restoreGraphAfterCustomCSharpInlineEditor(
          editorKey
        );
      } else if (
        customCSharpInlineEditorKey === editorKey
      ) {
        customCSharpInlineEditorKey = "";
      }
      return;
    }
    if (record.mode === "overlay") {
      record.overlay?.remove();
      return;
    }
    if (record.popup?.closed === false) {
      record.popup.close();
    }
  }

function customCSharpFindNavigationDirection(
    event
  ) {
    const key = String(event?.key || "").toLowerCase();
    const code = String(event?.code || "").toLowerCase();
    const legacy = Number(event?.keyCode) || 0;
    const f3 = key === "f3" || code === "f3" || legacy === 114;
    const g = key === "g" || code === "keyg" || legacy === 71;
    if (
      f3 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      return event.shiftKey ? -1 : 1;
    }
    if (
      g &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey
    ) {
      return event.shiftKey ? -1 : 1;
    }
    return 0;
  }

function installCustomCSharpShortcutBootstrap(
    hostWindow
  ) {
    const property =
      "RMLCustomCSharpSearchShortcutBootstrap";
    const previous = hostWindow?.[property];
    previous?.dispose?.();

    const claimedKeys = new Set();
    const pendingDirections = [];
    let delegate = null;
    let disposed = false;
    let broker = null;

    const shortcutKey = event =>
      String(
        event.code ||
        event.key ||
        event.keyCode ||
        ""
      ).toLowerCase();
    const claim = event => {
      if (event.cancelable) {
        event.preventDefault();
      }
      try {
        event.returnValue = false;
      } catch {}
      event.stopImmediatePropagation();
    };
    const enqueue = (
      direction,
      event = null
    ) => {
      const normalized = direction < 0 ? -1 : 1;
      if (typeof delegate === "function") {
        delegate(normalized, event);
        return true;
      }
      if (
        event?.repeat !== true &&
        event?.isComposing !== true
      ) {
        pendingDirections.push(normalized);
        if (pendingDirections.length > 8) {
          pendingDirections.shift();
        }
      }
      return true;
    };
    const handleKeyDown = event => {
      const direction =
        customCSharpFindNavigationDirection(event);
      if (direction === 0) return;
      claim(event);
      claimedKeys.add(shortcutKey(event));
      if (!event.isComposing) {
        enqueue(direction, event);
      }
    };
    const handleKeyUp = event => {
      if (!claimedKeys.delete(shortcutKey(event))) {
        return;
      }
      claim(event);
    };
    const clearClaims = () => claimedKeys.clear();
    const listenerOptions = {
      capture: true,
      passive: false
    };

    hostWindow.addEventListener(
      "keydown",
      handleKeyDown,
      listenerOptions
    );
    hostWindow.addEventListener(
      "keyup",
      handleKeyUp,
      listenerOptions
    );
    hostWindow.addEventListener(
      "blur",
      clearClaims
    );

    broker = Object.freeze({
      version:
        CUSTOM_CSHARP_SHORTCUT_BOOTSTRAP_VERSION,
      enqueue,
      activate(callback) {
        if (disposed) return false;
        delegate =
          typeof callback === "function"
            ? callback
            : null;
        if (!delegate) return false;
        const queued = pendingDirections.splice(0);
        for (const direction of queued) {
          delegate(direction, null);
        }
        return true;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        delegate = null;
        pendingDirections.length = 0;
        claimedKeys.clear();
        hostWindow.removeEventListener(
          "keydown",
          handleKeyDown,
          true
        );
        hostWindow.removeEventListener(
          "keyup",
          handleKeyUp,
          true
        );
        hostWindow.removeEventListener(
          "blur",
          clearClaims
        );
        if (hostWindow[property] === broker) {
          try {
            delete hostWindow[property];
          } catch {}
        }
      }
    });

    Object.defineProperty(
      hostWindow,
      property,
      {
        value: broker,
        writable: false,
        enumerable: false,
        configurable: true
      }
    );
    return broker;
  }

function prepareCustomCSharpEditorHost(
    hostWindow,
    title
  ) {
    const shortcutBootstrap =
      installCustomCSharpShortcutBootstrap(
        hostWindow
      );
    hostWindow.document.title = title;
    hostWindow.document.body.replaceChildren();
    window.RMLClassStyles?.observe(
      hostWindow.document
    );
    const stylesheet =
      hostWindow.document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = new URL(
      "styles/features/styles.runtime-graph.css?v=1.20.31-universal-presentation-dev39-clean-stale-api-repair",
      window.location.href
    ).href;
    hostWindow.document.head.appendChild(
      stylesheet
    );
    const loading =
      hostWindow.document.createElement("p");
    loading.className =
      "rml-custom-csharp-loading";
    loading.textContent =
      "Loading Custom C# editor…";
    hostWindow.document.body.appendChild(loading);
    return shortcutBootstrap;
  }

async function createCustomCSharpExternalHost(
    editorKey,
    title
  ) {
    const sourceScreen = window.screen || {};
    const availableLeft =
      Number(sourceScreen.availLeft) || 0;
    const availableTop =
      Number(sourceScreen.availTop) || 0;
    const availableWidth = Math.max(
      640,
      Number(sourceScreen.availWidth) || 1440
    );
    const availableHeight = Math.max(
      480,
      Number(sourceScreen.availHeight) || 900
    );
    const popupWidth =
      Math.min(1040, availableWidth);
    const popupHeight =
      Math.min(760, availableHeight);
    const popupLeft =
      availableLeft +
      Math.max(0, (availableWidth - popupWidth) / 2);
    const popupTop =
      availableTop +
      Math.max(0, (availableHeight - popupHeight) / 2);
    const popupFeatures = [
      "popup=yes",
      `left=${Math.round(popupLeft)}`,
      `top=${Math.round(popupTop)}`,
      `width=${Math.round(popupWidth)}`,
      `height=${Math.round(popupHeight)}`,
      "resizable=yes",
      "scrollbars=no",
      "toolbar=no",
      "location=no",
      "menubar=no",
      "status=no"
    ].join(",");
    const popupName =
      `rml-custom-csharp-${hashText(editorKey)}`;
    let hostWindow = null;
    try {
      hostWindow = window.open(
        "",
        popupName,
        popupFeatures
      );
    } catch {}
    if (!hostWindow) {
      showGraphMessage(
        "The native separate code-editor window was blocked. Allow pop-ups for this Builder and try again.",
        "error"
      );
      return null;
    }
    hostWindow.document.title = String(
      title || "Custom C# code editor"
    );
    hostWindow.focus?.();
    return { hostWindow };
  }

function customCSharpNodeDropType(
    value,
    fallback = "object"
  ) {
    const type = String(
      value || fallback
    )
      .trim()
      .replace(/^global::/, "")
      .replace(/&$/, "")
      .replace(/\+/g, ".");
    if (!type || /[`!]/.test(type)) {
      return fallback;
    }
    return type;
  }

function customCSharpNodeDropQualifiedType(
    value,
    fallback = "object"
  ) {
    const type = customCSharpNodeDropType(
      value,
      fallback
    );
    if (
      type === "object" ||
      type === "void" ||
      /^[a-z][A-Za-z0-9_?]*$/.test(type)
    ) {
      return type;
    }
    return `global::${type}`;
  }

function customCSharpNodeDropDefault(
    value
  ) {
    const type = customCSharpNodeDropQualifiedType(
      value
    );
    return `default(${type})`;
  }

function customCSharpApiNodeDropRepresentation(
    definition
  ) {
    const contract =
      definition?.apiVerification;
    if (
      definition?.catalogGenerated !== true ||
      !contract ||
      typeof contract !== "object"
    ) {
      return null;
    }
    const kind = String(
      contract.kind ||
      definition.apiMemberKind ||
      "method"
    );
    const owner =
      customCSharpNodeDropQualifiedType(
        contract.ownerType ||
          definition.catalogType,
        "object"
      );
    const member = String(
      contract.memberName ||
        definition.catalogMember ||
        "Member"
    );
    const parameters = Array.isArray(
      contract.parameters
    )
      ? contract.parameters
      : [];
    const argumentsList = parameters.map(
      (parameter, index) => {
        const name = graphCsIdentifier(
          parameter?.name ||
            `argument${index + 1}`,
          `Argument${index + 1}`
        );
        if (parameter?.isOut === true) {
          return `/* ${name} */ out _`;
        }
        const value = customCSharpNodeDropDefault(
          parameter?.elementType ||
            parameter?.type ||
            "object"
        );
        if (parameter?.isByRef === true) {
          const type =
            customCSharpNodeDropQualifiedType(
              parameter?.elementType ||
                parameter?.type ||
                "object"
            );
          return `/* ref ${name} */ ref global::System.Runtime.CompilerServices.Unsafe.NullRef<${type}>()`;
        }
        return `/* ${name} */ ${value}`;
      }
    );
    const target = contract.isStatic === true
      ? owner
      : `default(${owner})!`;
    const returnType =
      customCSharpNodeDropQualifiedType(
        contract.returnType ||
          (kind === "constructor"
            ? contract.ownerType
            : "void"),
        kind === "constructor"
          ? owner
          : "void"
      );
    const callArguments =
      argumentsList.join(", ");
    let expression = "";
    let statement = "";

    if (kind === "type") {
      expression = `typeof(${owner})`;
    } else if (kind === "constructor") {
      expression =
        `new ${owner}(${callArguments})`;
    } else if (kind === "property-get") {
      expression = parameters.length
        ? `${target}[${callArguments}]`
        : `${target}.${member}`;
    } else if (kind === "property-set") {
      const value = argumentsList.at(-1) ||
        customCSharpNodeDropDefault("object");
      const indexes = argumentsList.slice(
        0,
        -1
      );
      statement = indexes.length
        ? `${target}[${indexes.join(", ")}] = ${value};`
        : `${target}.${member} = ${value};`;
    } else if (kind === "field-get") {
      expression = `${target}.${member}`;
    } else if (kind === "field-set") {
      statement =
        `${target}.${member} = ${argumentsList[0] || customCSharpNodeDropDefault(contract.returnType)};`;
    } else if (kind === "event") {
      statement =
        `${target}.${member} += ${customCSharpNodeDropDefault(contract.returnType)}!;`;
    } else {
      expression =
        `${target}.${member}(${callArguments})`;
      if (
        returnType === "void" ||
        returnType === "global::System.Void"
      ) {
        statement = `${expression};`;
        expression = "";
      }
    }

    return {
      expression,
      statement,
      returnType,
      signature:
        `${customCSharpNodeDropType(contract.ownerType)}.${member}`
    };
  }

function customCSharpNodeDropPortType(
    definition,
    node,
    direction,
    portId,
    fallback = "object"
  ) {
    const ports = direction === "input"
      ? definition?.inputs
      : definition?.outputs;
    const specification =
      (Array.isArray(ports) ? ports : [])
        .find(port => port?.id === portId) ||
      (Array.isArray(ports) ? ports : [])
        .find(port => port?.type !== "impulse");
    const configured = String(
      node?.parameters?.valueType || ""
    );
    const type =
      specification?.type ||
      (
        specification?.typeVar &&
        configured &&
        configured !== "auto"
          ? configured
          : fallback
      );
    return customCSharpNodeDropQualifiedType(
      type,
      fallback
    );
  }

function customCSharpSyntaxNodeDropRepresentation(
    definition,
    node
  ) {
    if (
      typeof definition?.syntaxRender !==
      "function"
    ) {
      return null;
    }
    const renderNode = node || {
      id: "dropped-csharp-node",
      operatorId: "",
      parameters: {}
    };
    const input = id => {
      const specification =
        definition.inputs?.find(
          port => port?.id === id
        );
      if (
        specification?.type ===
          "csharpSyntax"
      ) {
        return "";
      }
      const type =
        customCSharpNodeDropPortType(
          definition,
          renderNode,
          "input",
          id
        );
      return `/* ${graphCsIdentifier(specification?.label || id, "Value")} */ default(${type})`;
    };
    const context = {
      node: renderNode,
      title:
        definition.title ||
        renderNode.operatorId ||
        "C# node",
      input,
      graphValue: input,
      variadic: () =>
        (definition.inputs || []).map(
          port => input(port.id)
        ),
      diagnostic() {},
      requireUnsafe() {}
    };
    try {
      const rendered = String(
        definition.syntaxRender(context) || ""
      ).trim();
      return rendered
        ? {
            expression: rendered,
            statement: "",
            returnType: "object",
            exactSyntax: true
          }
        : null;
    } catch {
      return null;
    }
  }

function customCSharpBuiltInNodeDropRepresentation(
    operatorId,
    definition,
    node
  ) {
    const renderNode = node || {
      id: "dropped-builder-node",
      operatorId,
      parameters: {}
    };
    const valueType =
      customCSharpNodeDropPortType(
        definition,
        renderNode,
        "output",
        "",
        /^(?:math\.|cast\.)/.test(operatorId)
          ? "double"
          : "object"
      );
    const input = (
      id,
      fallback = valueType
    ) => {
      const type =
        customCSharpNodeDropPortType(
          definition,
          renderNode,
          "input",
          id,
          fallback
        );
      const label =
        definition.inputs?.find(
          port => port?.id === id
        )?.label || id;
      return `/* ${graphCsIdentifier(label, "Value")} */ default(${type})`;
    };
    const variadic = () => {
      const ids =
        definition?.variadicInputs
          ? variadicInputIds(renderNode)
          : (definition?.inputs || [])
              .filter(port =>
                port?.type !== "impulse"
              )
              .map(port => port.id);
      return ids.map(id => input(id));
    };
    let expression = "";
    let statement = "";
    let returnType = valueType;

    switch (operatorId) {
      case "constant.number": {
        const type = String(
          renderNode.parameters?.valueType ||
            "float"
        );
        returnType =
          customCSharpNodeDropQualifiedType(
            type === "auto" ? "float" : type
          );
        expression = graphCsNumberLiteral(
          renderNode.parameters?.value ?? 0,
          type === "auto" ? "float" : type
        );
        break;
      }
      case "constant.bool":
        returnType = "bool";
        expression =
          renderNode.parameters?.value === true
            ? "true"
            : "false";
        break;
      case "constant.string":
        returnType = "string";
        expression =
          `"${graphCsEscapeString(renderNode.parameters?.value || "")}"`;
        break;
      case "constant.color":
        returnType = "colorX";
        expression = graphCsColorLiteral(
          renderNode.parameters?.value,
          renderNode.parameters?.colorProfile,
          renderNode.parameters?.colorStrength
        );
        break;
      case "constant.typedDefault":
        returnType =
          customCSharpNodeDropQualifiedType(
            renderNode.parameters?.valueType ||
              valueType
          );
        expression = `default(${returnType})`;
        break;
      case "math.add":
        expression = `(${variadic().join(" + ")})`;
        break;
      case "math.subtract":
        expression =
          `(${input("a")} - ${input("b")})`;
        break;
      case "math.multiply":
        expression = `(${variadic().join(" * ")})`;
        break;
      case "math.divide":
        expression =
          `(${input("a")} / ${input("b")})`;
        break;
      case "math.minimum":
      case "math.maximum": {
        const method =
          operatorId === "math.minimum"
            ? "Min"
            : "Max";
        expression = variadic().reduce(
          (left, right) =>
            left
              ? `global::System.Math.${method}(${left}, ${right})`
              : right,
          ""
        );
        break;
      }
      case "math.clamp":
        expression =
          `global::System.Math.Clamp(${input("value")}, ${input("min")}, ${input("max")})`;
        break;
      case "math.negate":
        expression = `(-${input("value")})`;
        break;
      case "math.absolute":
        expression =
          `global::System.Math.Abs(${input("value")})`;
        break;
      case "math.lerp":
        expression =
          `(${input("a")} + (${input("b")} - ${input("a")}) * ${input("t", "float")})`;
        break;
      case "logic.and":
        returnType = "bool";
        expression = `(${variadic().join(" && ")})`;
        break;
      case "logic.or":
        returnType = "bool";
        expression = `(${variadic().join(" || ")})`;
        break;
      case "logic.not":
        returnType = "bool";
        expression =
          `(!${input("value", "bool")})`;
        break;
      case "logic.equal":
        returnType = "bool";
        expression =
          `global::System.Collections.Generic.EqualityComparer<object>.Default.Equals(${input("a", "object")}, ${input("b", "object")})`;
        break;
      case "logic.greater":
      case "logic.less":
        returnType = "bool";
        expression =
          `(${input("a", "double")} ${operatorId === "logic.greater" ? ">" : "<"} ${input("b", "double")})`;
        break;
      case "logic.select":
        expression =
          `(${input("condition", "bool")} ? ${input("true")} : ${input("false")})`;
        break;
      case "cast.doubleToFloat":
        returnType = "float";
        expression =
          `((float)${input("value", "double")})`;
        break;
      case "cast.floatToInt":
        returnType = "int";
        expression =
          `((int)${input("value", "float")})`;
        break;
      case "cast.toString":
        returnType = "string";
        expression =
          `global::System.Convert.ToString(${input("value", "object")}) ?? string.Empty`;
        break;
      case "resonite.valueRelay":
      case "resonite.displayValue":
        expression = input("value");
        break;
      case "flow.branch":
        returnType = "void";
        statement =
          `if (${input("condition", "bool")})\n{\n    // True path\n}\nelse\n{\n    // False path\n}`;
        break;
      case "flow.gate":
        returnType = "void";
        statement =
          `if (${input("open", "bool")})\n{\n    // Passed path\n}`;
        break;
      default: {
        const simpleApi = {
          node: renderNode,
          definition,
          type: valueType,
          className: "GeneratedMod",
          graphClassName: "GeneratedNodeGraph",
          namespaceName: "GeneratedNamespace",
          input: id => ({
            code: input(id),
            type: valueType
          }),
          emit: () => "",
          token: graphCsMethodToken,
          identifier: graphCsIdentifier,
          escapeString: graphCsEscapeString,
          csType: graphCsType,
          csDefault: graphCsDefault,
          addField() {},
          addMember() {},
          addUsing() {},
          require() {},
          diagnostic() {}
        };
        try {
          if (
            typeof definition?.codegenExpression ===
              "function"
          ) {
            expression = String(
              definition.codegenExpression(
                simpleApi
              ) || ""
            );
          } else if (
            typeof definition?.codegenAction ===
              "function"
          ) {
            returnType = "void";
            statement = String(
              definition.codegenAction(
                simpleApi
              ) || ""
            );
          }
        } catch {
          expression = "";
          statement = "";
        }
        break;
      }
    }

    if (!expression && !statement) {
      const valueOutput =
        definition?.outputs?.find(
          port => port?.type !== "impulse"
        );
      if (valueOutput) {
        returnType =
          customCSharpNodeDropPortType(
            definition,
            renderNode,
            "output",
            valueOutput.id
          );
        expression = `default(${returnType})`;
      } else {
        returnType = "void";
        statement =
          "// TODO: connect the Builder node inputs and continuation here.";
      }
    }
    return {
      expression,
      statement,
      returnType,
      exactSyntax: false
    };
  }

function customCSharpNodeDropSnippet(
    payload,
    specification,
    resolvedDefinition = null,
    resolvedNode = null
  ) {
    const operatorId = String(
      payload?.operatorId || ""
    );
    if (!operatorId) return null;
    const definition =
      resolvedDefinition ||
      OPERATOR_DEFINITIONS[operatorId];
    if (!definition) return null;
    const title = String(
      definition.title ||
        payload?.title ||
        operatorId
    );
    const methodName =
      `Node_${graphCsIdentifier(title, "Node")}`;
    const parameterKey = String(
      specification?.key || "code"
    );
    const api =
      customCSharpApiNodeDropRepresentation(
        definition
      );
    const syntax = !api
      ? customCSharpSyntaxNodeDropRepresentation(
          definition,
          resolvedNode
        )
      : null;
    const builtIn = !api && !syntax
      ? customCSharpBuiltInNodeDropRepresentation(
          operatorId,
          definition,
          resolvedNode
        )
      : null;
    const representation =
      api || syntax || builtIn;
    const comment =
      `// Builder node: ${title} (${operatorId})`;
    let snippet;

    if (representation) {
      if (representation.exactSyntax) {
        snippet =
          `${comment}\n${representation.expression}`;
      } else if (parameterKey === "expressionCode") {
        snippet = representation.expression ||
          `default(object) /* ${graphCsEscapeString(title)} is an action node */`;
      } else if (parameterKey === "actionCode") {
        const action = representation.statement ||
          `_ = ${representation.expression};`;
        snippet = `${comment}\n${action}`;
      } else {
        const returnsVoid =
          representation.returnType === "void" ||
          representation.returnType ===
            "global::System.Void" ||
          Boolean(representation.statement);
        snippet = returnsVoid
          ? `${comment}\nprivate static void ${methodName}()\n{\n${String(representation.statement || `${representation.expression};`).split("\n").map(line => `    ${line}`).join("\n")}\n}`
          : `${comment}\nprivate static ${representation.returnType} ${methodName}()\n{\n    return ${representation.expression};\n}`;
      }
    } else {
      if (parameterKey === "expressionCode") {
        snippet = `default(object) /* TODO: map ${graphCsEscapeString(title)} */`;
      } else if (parameterKey === "actionCode") {
        snippet =
          `${comment}\n// TODO: map this node action.\n{NEXT}`;
      } else {
        snippet =
          `${comment}\nprivate static object? ${methodName}()\n{\n    // TODO: map this node's runtime inputs.\n    return default;\n}`;
      }
    }

    return {
      snippet,
      status:
        `${title} was inserted as C# at the cursor.`
    };
  }

function mountCustomCSharpEditorPresentation({
    nodeId,
    specification,
    mode,
    hostWindow,
    frame = null,
    overlay = null,
    editorState = null,
    initialValue = ""
  }) {
    const parameterKey = String(
      specification?.key || "code"
    );
    const editorKey =
      customCSharpDetachedEditorKey(
        nodeId,
        parameterKey
      );
    rememberCustomCSharpEditorDraft(
      nodeId,
      parameterKey,
      initialValue
    );
    const title =
      `${String(specification?.label || "Custom C#")} · Code editor`;
    const shortcutBootstrap = prepareCustomCSharpEditorHost(
      hostWindow,
      title
    );
    const pendingRecord = {
      editorKey,
      popup: hostWindow,
      frame,
      overlay,
      mode,
      nodeId,
      parameterKey,
      specification,
      getValue() {
        return customCSharpEditorCurrentValue(
          nodeId,
          parameterKey,
          initialValue
        );
      },
      setValue() {},
      setAppearance() {},
      setStatus() {},
      appendOutput() {},
      setDiagnostics() {},
      setPageAreasHidden() {},
      runSearchShortcut(direction) {
        shortcutBootstrap?.enqueue?.(direction);
        hostWindow.focus?.();
        return true;
      },
      insertNodeSnippet() {
        return false;
      },
      focus() {
        customCSharpActiveEditorKey =
          editorKey;
        bringCustomCSharpOverlayToFront(
          overlay
        );
        hostWindow.focus?.();
      },
      close(options) {
        closeCustomCSharpEditorRecord(
          editorKey,
          options
        );
      },
      dispose() {
        shortcutBootstrap?.dispose?.();
      }
    };
    customCSharpDetachedEditors.set(
      editorKey,
      pendingRecord
    );

    void loadCustomCSharpDetachedEditorModule()
      .then(async editorModule => {
        if (
          hostWindow.closed ||
          (mode === "inline" ||
            mode === "overlay") &&
            !frame?.isConnected ||
          customCSharpDetachedEditors.get(
            editorKey
          ) !== pendingRecord
        ) {
          shortcutBootstrap?.dispose?.();
          return;
        }
        const node = customCSharpEditorNode(nodeId);
        if (!node) {
          throw new Error(
            "The Custom C# node no longer exists."
          );
        }
        let record;
        const mounted = await editorModule.mount({
          popup: hostWindow,
          hostElement: frame,
          presentationMode: mode,
          initialSelection:
            editorState?.selection || null,
          initialScroll:
            editorState?.scroll || null,
          pageAreasHidden:
            graphEditModeActive(),
          language:
            document.documentElement.lang || "en",
          documentTitle: title,
          tabTitle:
            `${node.label || nodeDefinition(node)?.title || "Custom C#"} · ${String(specification?.label || parameterKey)}`,
          ariaLabel: String(
            specification?.label || "C# 14 source"
          ),
          scrollLayerKey:
            `custom-csharp:${editorKey}`,
          scrollLayerLabel:
            `${String(specification?.label || "Custom C#")} code and line numbers`,
          value: customCSharpEditorCurrentValue(
            nodeId,
            parameterKey,
            initialValue
          ),
          appearance:
            customCSharpEditorAppearance(node),
          styleUrls: Array.from(
            document.querySelectorAll(
              'link[rel="stylesheet"][href]'
            ),
            link => link.href
          ),
          createAppearanceColorEditor({
            label,
            value,
            onChange
          } = {}) {
            if (
              typeof bridge?.createColorXEditor !==
              "function"
            ) {
              return null;
            }
            let colorEditor = null;
            colorEditor = bridge.createColorXEditor({
              label: String(label || "Editor color"),
              expression: normalizedCustomCSharpEditorColor(
                value,
                "#7f7f7f"
              ),
              profile: "srgb",
              strength: 1,
              onChange: () => {
                const pickerHex =
                  colorEditor?.querySelector(
                    "[data-color-hex]"
                  )?.value;
                onChange?.(
                  normalizedCustomCSharpEditorColor(
                    pickerHex,
                    normalizedCustomCSharpEditorColor(
                      value,
                      "#7f7f7f"
                    )
                  )
                );
              }
            });
            if (!(colorEditor instanceof HTMLElement)) {
              return null;
            }
            colorEditor.classList.add(
              "rml-detached-editor-color-picker"
            );
            for (const selector of [
              ".custom-color-profile-tabs",
              ".alpha-control",
              ".strength-control"
            ]) {
              const element =
                colorEditor.querySelector(selector);
              if (element) element.hidden = true;
            }
            const expressionInput =
              colorEditor.querySelector(
                "[data-color-expression]"
              );
            const expressionLabel =
              expressionInput?.closest("label");
            if (expressionLabel) {
              expressionLabel.hidden = true;
            }
            return colorEditor;
          },
          status:
            customCSharpSynchronizationStatus.get(
              nodeId
            ) || "Synchronized with Builder",
          output:
            customCSharpDebugOutput.get(nodeId) || [],
          diagnostics:
            customCSharpDiagnostics.get(nodeId) || [],
          enableNodeDrop: true,
          onNodeDrop(payload) {
            return customCSharpNodeDropSnippet(
              payload,
              specification
            );
          },
          onRequestForeground() {
            customCSharpActiveEditorKey =
              editorKey;
            bringCustomCSharpOverlayToFront(
              overlay
            );
            if (mode === "external") {
              hostWindow.focus?.();
            }
          },
          onAppearanceChange(appearance) {
            const liveNode =
              customCSharpEditorNode(nodeId);
            if (!commitCustomCSharpEditorAppearance(
              liveNode,
              appearance
            )) return;
            refreshCustomCSharpEditorAppearance(
              liveNode
            );
            scheduleAcceptedGraphPersistenceAfterPaint({
              refreshGeneratedOutput: true,
              refreshCompositeActions: true,
              mutationClass: "parameter"
            });
          },
          onInput(value) {
            commitCustomCSharpEditorValue(
              nodeId,
              specification,
              value
            );
          },
          onBlur() {
            if (record?.presentationTransition ||
                customCSharpDetachedEditors.get(editorKey) !== record) return;
            const liveNode =
              customCSharpEditorNode(nodeId);
            if (
              !liveNode ||
              specification?.key !== "source" ||
              nodeDefinition(liveNode)
                ?.customCSharpFile !== true
            ) {
              return;
            }
            queueMicrotask(() => {
              if (record?.presentationTransition ||
                  customCSharpDetachedEditors.get(editorKey) !== record ||
                  !customCSharpEditorRecordActive(record)) return;
              void flushCustomCSharpSourceGraphSynchronization(
                liveNode
              );
            });
          },
          onRequestPresentation(
            requestedMode
          ) {
            return moveCustomCSharpEditorToMode(
              editorKey,
              requestedMode
            );
          },
          onTogglePageAreas(hidden) {
            return setGraphEditMode(hidden);
          },
          onClosed() {
            const current =
              customCSharpDetachedEditors.get(
                editorKey
              );
            if (
              !current ||
              (current !== pendingRecord && current !== record)
            ) {
              return;
            }
            const closingNode =
              customCSharpEditorNode(nodeId);
            if (
              specification?.key === "source" &&
              nodeDefinition(closingNode)
                ?.customCSharpFile === true
            ) {
              void flushCustomCSharpSourceGraphSynchronization(
                closingNode
              );
            }
            customCSharpDetachedEditors.delete(
              editorKey
            );
            if (
              customCSharpActiveEditorKey ===
              editorKey
            ) {
              customCSharpActiveEditorKey = "";
            }
            customCSharpEditorDraftValues.delete(
              editorKey
            );
            cancelCustomCSharpLiveDiagnostics(
              nodeId,
              parameterKey
            );
            if (mode === "inline") {
              restoreGraphAfterCustomCSharpInlineEditor(
                editorKey
              );
            } else if (mode === "overlay") {
              overlay?.remove();
            }
          }
        });
        if (customCSharpDetachedEditors.get(editorKey) !== pendingRecord ||
            hostWindow.closed || ((mode === "inline" || mode === "overlay") && !frame?.isConnected)) {
          mounted?.dispose?.();
          return;
        }
        if (!mounted) {
          throw new Error(
            "The Custom C# editor could not initialize its host."
          );
        }

        const latestNode = customCSharpEditorNode(nodeId);
        mounted.applySnapshot?.({
          value: customCSharpEditorCurrentValue(nodeId, parameterKey, initialValue),
          appearance: customCSharpEditorAppearance(latestNode || node),
          status: customCSharpSynchronizationStatus.get(nodeId) || "Synchronized with Builder",
          output: customCSharpDebugOutput.get(nodeId) || [],
          diagnostics: customCSharpDiagnostics.get(nodeId) || []
        });
        record = {
          ...mounted,
          editorKey,
          popup: hostWindow,
          frame,
          overlay,
          mode,
          nodeId,
          parameterKey,
          specification,
          focus() {
            customCSharpActiveEditorKey =
              editorKey;
            bringCustomCSharpOverlayToFront(
              overlay
            );
            mounted.focus?.();
          },
          close(options) {
            closeCustomCSharpEditorRecord(
              editorKey,
              options
            );
          }
        };
        customCSharpDetachedEditors.set(
          editorKey,
          record
        );
        commitCustomCSharpEditorValue(
          nodeId,
          specification,
          record.getValue(),
          { validateUnchanged: false }
        );
        record.setValidationPending?.(customCSharpLivePendingNodes.has(nodeId));
        if (customCSharpLiveValidatedValues.get(editorKey) !== record.getValue() &&
            !customCSharpLiveDiagnosticTimers.has(editorKey) &&
            !customCSharpLiveDiagnosticJobs.has(editorKey)) {
          scheduleCustomCSharpLiveDiagnostics(
            customCSharpEditorNode(nodeId), specification, record.getValue()
          );
        }
      })
      .catch(error => {
        shortcutBootstrap?.dispose?.();
        const current = customCSharpDetachedEditors.get(editorKey);
        if (current !== pendingRecord && current?.popup !== hostWindow) return;
        if (
          current === pendingRecord
        ) {
          customCSharpDetachedEditors.delete(
            editorKey
          );
          customCSharpEditorDraftValues.delete(
            editorKey
          );
        }
        if (mode === "inline") {
          frame?.remove();
          restoreGraphAfterCustomCSharpInlineEditor(
            editorKey
          );
        } else if (mode === "overlay") {
          overlay?.remove();
        } else if (!hostWindow.closed) {
          hostWindow.close();
        }
        showGraphMessage(
          error instanceof Error
            ? error.message
            : String(error),
          "error"
        );
      });
  }

function disposeCustomCSharpPresentation(
    record,
    editorKey
  ) {
    record?.dispose?.();
    if (record?.mode === "inline") {
      record.frame?.remove();
      restoreGraphAfterCustomCSharpInlineEditor(
        editorKey
      );
      return;
    }
    if (record?.mode === "overlay") {
      record.overlay?.remove();
      return;
    }
    if (record?.popup?.closed === false) {
      record.popup.close();
    }
  }

function customCSharpEditorViewState(record) {
    const textarea = record?.textarea;
    if (!textarea) return null;
    return {
      selection: {
        start:
          Number(textarea.selectionStart) || 0,
        end:
          Number(textarea.selectionEnd) || 0,
        direction:
          String(textarea.selectionDirection || "forward")
      },
      scroll: {
        top: Number(textarea.scrollTop) || 0,
        left: Number(textarea.scrollLeft) || 0
      }
    };
  }

async function moveCustomCSharpEditorToMode(
    editorKey,
    requestedMode
  ) {
    const targetMode = String(
      requestedMode || ""
    );
    if (
      !["inline", "overlay", "external"].includes(
        targetMode
      )
    ) {
      return false;
    }
    const existing =
      customCSharpDetachedEditors.get(editorKey);
    if (
      !customCSharpEditorRecordActive(existing)
    ) {
      return false;
    }
    if (existing.mode === targetMode) {
      existing.focus?.();
      return true;
    }
    if (
      targetMode === "inline" &&
      !dom.builderCanvas
    ) {
      return false;
    }

    existing.presentationTransition = true;
    try {
      const title =
        `${String(existing.specification?.label || "Custom C#")} · Code editor`;
      let externalHost = null;
      if (targetMode === "external") {
        externalHost =
          await createCustomCSharpExternalHost(
            editorKey,
            title
          );
        if (!externalHost) return false;
        if (
          customCSharpDetachedEditors.get(
            editorKey
          ) !== existing ||
          !customCSharpEditorRecordActive(
            existing
          )
        ) {
          externalHost.hostWindow.close?.();
          return false;
        }
      }

      if (
        targetMode === "inline" &&
        customCSharpInlineEditorKey &&
        customCSharpInlineEditorKey !== editorKey
      ) {
        closeCustomCSharpEditorRecord(
          customCSharpInlineEditorKey,
          { restoreGraph: false }
        );
      }

      const value = existing.getValue?.() || "";
      const editorState =
        customCSharpEditorViewState(existing);
      commitCustomCSharpEditorValue(
        existing.nodeId,
        existing.specification,
        value,
        { validateUnchanged: false }
      );

      let frame = null;
      let overlay = null;
      let hostWindow;
      if (targetMode === "inline") {
        const liveNode =
          customCSharpEditorNode(existing.nodeId);
        if (
          liveNode === findGraphNode(existing.nodeId)
        ) {
          graph.selectedNodeId = existing.nodeId;
          graph.selectedNodeIds = [existing.nodeId];
          graph.selectedConnectionId = null;
          clearSelectedWirePoint();
          renderGraphInspector({ force: true });
        }
        frame = createCustomCSharpInlineFrame(
          editorKey,
          title
        );
        hostWindow = frame.contentWindow;
      } else if (targetMode === "overlay") {
        const overlayPresentation =
          createCustomCSharpOverlayFrame(
            editorKey,
            title
          );
        overlay = overlayPresentation.overlay;
        frame = overlayPresentation.frame;
        hostWindow = frame.contentWindow;
      } else {
        hostWindow = externalHost.hostWindow;
      }

      mountCustomCSharpEditorPresentation({
        nodeId: existing.nodeId,
        specification: existing.specification,
        mode: targetMode,
        hostWindow,
        frame,
        overlay,
        editorState,
        initialValue: value
      });
      disposeCustomCSharpPresentation(
        existing,
        editorKey
      );

      if (targetMode === "external") {
        showGraphMessage(
          "Custom C# editor opened in a native separate browser window. Use its operating-system title bar to minimize, maximize, restore or close it.",
          "success"
        );
      }
      return true;
    } finally {
      existing.presentationTransition = false;
    }
  }

function moveCustomCSharpEditorToInline(
    editorKey
  ) {
    return moveCustomCSharpEditorToMode(
      editorKey,
      "inline"
    );
  }

function openCustomCSharpDetachedEditor(
    node,
    specification,
    codeControl
  ) {
    const parameterKey = String(
      specification?.key || "code"
    );
    const editorKey =
      customCSharpDetachedEditorKey(
        node.id,
        parameterKey
      );
    const existing =
      customCSharpDetachedEditors.get(editorKey);
    if (customCSharpEditorRecordActive(existing)) {
      existing.setValue?.(
        customCSharpEditorCurrentValue(
          node.id,
          parameterKey,
          codeControl?.value
        )
      );
      existing.setAppearance?.(
        customCSharpEditorAppearance(node)
      );
      existing.focus?.();
      return;
    }
    if (existing) {
      customCSharpDetachedEditors.delete(
        editorKey
      );
    }
    if (
      customCSharpInlineEditorKey &&
      customCSharpInlineEditorKey !== editorKey
    ) {
      closeCustomCSharpEditorRecord(
        customCSharpInlineEditorKey,
        { restoreGraph: false }
      );
    }
    const frame = createCustomCSharpInlineFrame(
      editorKey,
      `${String(specification?.label || "Custom C#")} · Code editor`
    );
    mountCustomCSharpEditorPresentation({
      nodeId: node.id,
      specification,
      mode: "inline",
      hostWindow: frame.contentWindow,
      frame,
      initialValue:
        customCSharpEditorCurrentValue(
          node.id,
          parameterKey,
          codeControl?.value
        )
    });
  }

function customCSharpEditorDropTargetAt(
    clientX,
    clientY
  ) {
    const target =
      document.elementFromPoint(
        clientX,
        clientY
      );
    const editor = [
      ...customCSharpDetachedEditors.values()
    ].find(candidate =>
      customCSharpEditorRecordActive(candidate) &&
      candidate.frame?.isConnected &&
      target === candidate.frame
    );
    return { target, editor };
  }

function activeCustomCSharpDropEditor() {
    if (!customCSharpActiveEditorKey) {
      return null;
    }
    const editor =
      customCSharpDetachedEditors.get(
        customCSharpActiveEditorKey
      );
    if (!customCSharpEditorRecordActive(editor)) {
      customCSharpActiveEditorKey = "";
      return null;
    }
    return editor;
  }

function graphOperatorNodesIncludingCustomCSharp(
    value = graph
  ) {
    const nodes = [];
    const visited = new Set();
    const append = candidate => {
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
      nodes.push(...candidate.nodes);
      const customFiles =
        candidate.customCSharpFiles &&
        typeof candidate.customCSharpFiles === "object" &&
        !Array.isArray(candidate.customCSharpFiles)
          ? candidate.customCSharpFiles
          : {};
      for (const customGraph of
        Object.values(customFiles)) {
        append(customGraph);
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
      for (const compositeGraph of
        Object.values(apiComposites)) {
        append(compositeGraph);
      }
    };

    append(value);

    return nodes;
  }

Object.defineProperty(
  window,
  "RMLNodeGraphCustomCSharpModuleId",
  {
    value:
      "1.20.31-universal-presentation-dev39-clean-stale-api-repair",
    writable: false,
    enumerable: true,
    configurable: true
  }
);
