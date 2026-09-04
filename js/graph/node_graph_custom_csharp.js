"use strict";

// Custom C# graph integration and editor behavior.

const customCSharpSourceSyncTimers = new Map();

const customCSharpLiveDiagnosticTimers = new Map();

const customCSharpLiveDiagnosticRevisions = new Map();

const customCSharpDetachedEditors = new Map();

const customCSharpEditorDraftValues = new Map();

let customCSharpInlineEditorKey = "";

let customCSharpActiveEditorKey = "";

let customCSharpEditorOverlayZ = 2147482200;

let customCSharpDetachedEditorModulePromise = null;

const customCSharpBuildWorkers = new Map();

const customCSharpSynchronizations = new Set();

const customCSharpSynchronizationStatus = new Map();

const customCSharpSynchronizationControllers = new Map();

const customCSharpSynchronizationTasks = new Map();

const customCSharpForegroundSynchronizationTokens = new Map();

const customCSharpDiagnostics = new Map();

const customCSharpDebugOutput = new Map();

let customCSharpBuildRequestSequence = 0;

let customCSharpProjectEpoch = 0;

let customCSharpDiagnosticClockEpoch = 0;

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

function openCustomCSharpFileGraph(fileNodeId) {
    if (!graph || customCSharpEditor) {
      return false;
    }
    const fileNode = findGraphNode(fileNodeId);
    const definition = fileNode ? nodeDefinition(fileNode) : null;
    if (!fileNode || definition?.customCSharpFile !== true) return false;
    const previousPresentation =
      closeEmbeddedEditorForGraphReplacement();

    graph.customCSharpFiles = graph.customCSharpFiles && typeof graph.customCSharpFiles === "object"
      ? graph.customCSharpFiles
      : {};
    let customGraph = graph.customCSharpFiles[fileNodeId];
    if (!customGraph) {
      customGraph = createEmptyCustomCSharpFileGraph(fileNode);
      graph.customCSharpFiles[fileNodeId] = customGraph;
    }
    customCSharpEditor = {
      fileNodeId,
      fileName: String(fileNode.parameters?.fileName || "Custom C# File"),
      previousPresentation,
      mainView: graphViewFrom(graph)
    };
    applyGraphView(graphViewFrom(customGraph));
    resetGraphRenderCaches();
    pruneConnections();
    persistGraph(true);
    activateGraphMode();
    const projectEpoch =
      builderProjectEpoch;
    requestProjectAnimationFrame(() => requestProjectAnimationFrame(() => {
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
    }));
    showGraphMessage(`Opened ${customCSharpEditor.fileName} in its separate C# graph.`, "success");
    return true;
  }

function closeCustomCSharpFileGraph({
    restorePreviousPresentation = true
  } = {}) {
    if (!customCSharpEditor || !graph) return false;
    closeEmbeddedEditorForGraphReplacement();
    const fileName = customCSharpEditor.fileName;
    const previousPresentation =
      customCSharpEditor.previousPresentation ||
      null;
    captureCustomCSharpEditorView();
    const mainView = customCSharpEditor.mainView;
    customCSharpEditor = null;
    applyGraphView(mainView);
    resetGraphRenderCaches();
    pruneConnections();
    persistGraph(true);
    activateGraphMode();
    showGraphMessage(`Returned from ${fileName} to the previous graph.`, "success");
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
      source = ""
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
      time: new Date(
        customCSharpDiagnosticClockEpoch
      ).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3
      }),
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
    groupedDiagnostics
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
    for (const editor of
      customCSharpDetachedEditors.values()) {
      if (
        editor?.nodeId === id &&
        customCSharpEditorRecordActive(editor) &&
        typeof editor.setDiagnostics === "function"
      ) {
        editor.setDiagnostics(grouped);
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
    diagnostics
  ) {
    const normalized =
      normalizedCustomCSharpDiagnostics(diagnostics);
    commitCustomCSharpDiagnostics(nodeId, {
      Builder: normalized.slice(0, 1),
      Roslyn: normalized
    });
  }

function customCSharpLiveValidationEnvelope(
    parameterKey,
    value
  ) {
    const key = String(parameterKey || "");
    const raw = String(value || "");
    const placeholders = raw.replace(
      /\{([A-Z][A-Z0-9_]*)\}/g,
      (_token, name) =>
        name === "NEXT"
          ? "__Next();"
          : "default(object)"
    );
    if (key === "source") {
      return { source: raw, lineOffset: 0 };
    }
    if (key === "actionCode") {
      return {
        source:
          "class __RmlLiveValidation\n{\n  void __Action()\n  {\n" +
          placeholders +
          "\n  }\n  void __Next() {}\n}",
        lineOffset: 4
      };
    }
    if (key === "expressionCode") {
      return {
        source:
          "class __RmlLiveValidation\n{\n  object __Expression() =>\n" +
          placeholders +
          ";\n}",
        lineOffset: 3
      };
    }
    if (key === "memberCode") {
      return {
        source:
          "class __RmlLiveValidation\n{\n" +
          placeholders +
          "\n}",
        lineOffset: 2
      };
    }
    return null;
  }

function formatCustomCSharpLiveDiagnostics(
    diagnostics,
    lineOffset = 0
  ) {
    return (Array.isArray(diagnostics)
      ? diagnostics
      : [])
      .map(diagnostic => {
        const physicalLine = Number(
          diagnostic?.startLine
        );
        const line = physicalLine > 0
          ? Math.max(
              1,
              physicalLine -
                Math.max(0, Number(lineOffset) || 0)
            )
          : 0;
        const location = line > 0
          ? `line ${line}, column ${Number(diagnostic?.startColumn) || 1}`
          : "unknown location";
        return `${diagnostic?.id || "C#14"} at ${location}: ${diagnostic?.message || "Invalid C# 14 syntax."}`;
      })
      .filter(Boolean);
  }

async function validateCustomCSharpValueLive(
    parameterKey,
    value
  ) {
    const envelope =
      customCSharpLiveValidationEnvelope(
        parameterKey,
        value
      );
    if (!envelope) return null;
    const roslyn = window.RMLCSharp14Roslyn;
    if (typeof roslyn?.parse !== "function") {
      return [
        "Roslyn live diagnostics are unavailable."
      ];
    }
    const result = await roslyn.parse(
      envelope.source
    );
    const messages =
      formatCustomCSharpLiveDiagnostics(
        result?.diagnostics,
        envelope.lineOffset
      );
    if (
      result?.ok !== true &&
      messages.length === 0
    ) {
      messages.push(
        "C#14 at unknown location: Roslyn rejected the current source."
      );
    }
    return messages;
  }

function cancelCustomCSharpLiveDiagnostics(
    nodeId,
    parameterKey
  ) {
    const key = customCSharpDetachedEditorKey(
      nodeId,
      parameterKey
    );
    const timer =
      customCSharpLiveDiagnosticTimers.get(key);
    if (timer) window.clearTimeout(timer);
    customCSharpLiveDiagnosticTimers.delete(key);
    customCSharpLiveDiagnosticRevisions.set(
      key,
      (customCSharpLiveDiagnosticRevisions.get(key) || 0) + 1
    );
  }

function scheduleCustomCSharpLiveDiagnostics(
    node,
    specification,
    value,
    delay = 0
  ) {
    const parameterKey = String(
      specification?.key || "code"
    );
    const envelope =
      customCSharpLiveValidationEnvelope(
        parameterKey,
        value
      );
    if (!envelope) return false;
    const nodeId = String(node?.id || "");
    const key = customCSharpDetachedEditorKey(
      nodeId,
      parameterKey
    );
    const previousTimer =
      customCSharpLiveDiagnosticTimers.get(key);
    if (previousTimer) {
      window.clearTimeout(previousTimer);
    }
    const revision =
      (customCSharpLiveDiagnosticRevisions.get(key) || 0) + 1;
    customCSharpLiveDiagnosticRevisions.set(
      key,
      revision
    );
    setCustomCSharpLiveDiagnosticSnapshot(
      nodeId,
      []
    );
    const source = String(value || "");
    const projectEpoch = customCSharpProjectEpoch;
    const timer = window.setTimeout(() => {
      customCSharpLiveDiagnosticTimers.delete(key);
      void validateCustomCSharpValueLive(
        parameterKey,
        source
      )
        .then(diagnostics => {
          if (
            diagnostics === null ||
            customCSharpLiveDiagnosticRevisions.get(key) !== revision ||
            customCSharpProjectEpoch !== projectEpoch ||
            String(node?.parameters?.[parameterKey] ?? "") !== source
          ) {
            return;
          }
          setCustomCSharpLiveDiagnosticSnapshot(
            nodeId,
            diagnostics
          );
        })
        .catch(error => {
          if (
            customCSharpLiveDiagnosticRevisions.get(key) !== revision ||
            customCSharpProjectEpoch !== projectEpoch ||
            String(node?.parameters?.[parameterKey] ?? "") !== source
          ) {
            return;
          }
          setCustomCSharpLiveDiagnosticSnapshot(
            nodeId,
            [
              `Roslyn live diagnostics failed: ${error instanceof Error ? error.message : String(error)}`
            ]
          );
        });
    }, Math.max(0, Number(delay) || 0));
    customCSharpLiveDiagnosticTimers.set(
      key,
      timer
    );
    return true;
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
    const label =
      customCSharpFileNeedsOptimization(node)
        ? "Optimize & Open Node Graph"
        : "Open Node Graph";
    setInspectorButtonContent(
      button,
      label
    );
    button.setAttribute(
      "aria-label",
      label
    );
    button.setAttribute(
      "aria-busy",
      synchronizing ? "true" : "false"
    );
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
    nodeId,
    { announce = true } = {}
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

    if (announce) {
      showGraphMessage(
        "Custom C# generation cancelled. The previous valid file graph was preserved."
      );
    }
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

function buildCustomCSharpFragmentInWorker(nodeId, source, parseResult, options) {
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
        "js/workers/graph_codegen_worker.js?v=138-max-graph-performance-v755",
        document.baseURI
      ),
      { name: "rml-custom-csharp-builder" }
    );
    const requestId = `custom-csharp-${++customCSharpBuildRequestSequence}`;
    return new Promise((resolve, reject) => {
      let settled = false;
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
      const succeed = value => settle(resolve, value);
      const fail = error => settle(reject, error);
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
        if (response.ok === true && response.result?.ok === true) {
          succeed(response.result);
        } else {
          const diagnostics = [
            ...(Array.isArray(
              response.result?.diagnostics
            )
              ? response.result.diagnostics
              : []),
            response.error?.message,
            response.error?.stack
          ]
            .map(diagnostic =>
              String(
                diagnostic?.message ||
                  diagnostic ||
                  ""
              ).trim()
            )
            .filter(Boolean);
          setCustomCSharpDiagnostics(
            nodeId,
            diagnostics,
            { source: "Builder" }
          );
          appendCustomCSharpDebugOutput(
            nodeId,
            diagnostics[0] ||
              "The background Custom C# graph build failed.",
            {
              tone: "error",
              source: "Worker"
            }
          );
          fail(new Error(diagnostics[0] || "The background Custom C# graph build failed."));
        }
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
        setCustomCSharpDiagnostics(
          nodeId,
          location
            ? [message, location]
            : [message],
          { source: "Builder" }
        );
        appendCustomCSharpDebugOutput(
          nodeId,
          message,
          {
            tone: "error",
            source: "Worker"
          }
        );
        fail(new Error(message));
      });
      worker.postMessage({
        id: requestId,
        operation: "buildCustomCSharp",
        catalog: window.RMLResoniteApiCatalog || window.RMLFrooxComponentCatalog || null,
        source,
        parseResult,
        options
      });
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
    const existing = graph?.customCSharpFiles?.[node.id];
    if (
      existing &&
      existing.importedSource !== true &&
      existing.sourceEditedInInspector !== true
    ) {
      return false;
    }
    const visualCSharp = window.RMLVisualCSharp;
    if (!existing || !visualCSharp) return true;
    const stamp = currentCustomCSharpCatalogStamp();
    const sourceHash =
      visualCSharp.sourceHash?.(source) ||
      hashText(source);
    return !(
      existing.sourceEditedInInspector !== true &&
      existing.sourceHash === sourceHash &&
      Number(existing.optimizerVersion || 0) ===
        Number(visualCSharp.version || 0) &&
      String(existing.catalogFingerprint || "") ===
        stamp.fingerprint &&
      String(existing.catalogEngineVersion || "") ===
        stamp.engineVersion &&
      String(existing.catalogSource || "") ===
        stamp.source &&
      Number(existing.catalogDefinitionRevision || 0) ===
        stamp.definitionRevision
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
          normalizedNodeId,
          { announce: false }
        );
        try {
          await previousTask;
        } catch {}
      } else {
        return false;
      }
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
    if (!graph || customCSharpEditor) return false;
    const openAfterSync = options.openAfterSync !== false;
    const quiet = options.quiet === true;
    const owner = findGraphNode(nodeId);
    const definition = owner ? nodeDefinition(owner) : null;
    if (!owner || definition?.customCSharpFile !== true) return false;
    const ownerId = owner.id;
    graph.customCSharpFiles =
      graph.customCSharpFiles &&
      typeof graph.customCSharpFiles === "object"
        ? graph.customCSharpFiles
        : {};
    const source = String(owner.parameters?.source || "");
    if (!source.trim()) {
      graph.customCSharpFiles[ownerId] = graph.customCSharpFiles[ownerId]
        || createEmptyCustomCSharpFileGraph(owner);
      persistGraph(true);
      if (!openAfterSync) return true;
      const opened = openCustomCSharpFileGraph(ownerId);
      if (opened) {
        showGraphMessage("Opened an empty visual C# 14 file graph. Build the complete source with syntax nodes and connect it to Output.", "success");
      }
      return opened;
    }

    const existingGraph =
      graph.customCSharpFiles?.[ownerId];
    if (
      existingGraph &&
      existingGraph.importedSource !== true &&
      existingGraph.sourceEditedInInspector !== true
    ) {
      graph.customCSharpFiles[ownerId] =
        existingGraph ||
        createEmptyCustomCSharpFileGraph(owner);
      persistGraph(true);
      if (!openAfterSync) return true;
      const opened = openCustomCSharpFileGraph(ownerId);
      if (opened && !existingGraph) {
        showGraphMessage(
          "Opened an empty visual C# 14 file graph. This manually created Custom C# File is graph-authoritative, so its persistent Source field does not overwrite its nodes.",
          "success"
        );
      }
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
    assertCurrentProject();

    const initialCatalogStamp = currentCustomCSharpCatalogStamp();

    const sourceHash =
      visualCSharp.sourceHash?.(source) ||
      hashText(source);
    if (
      existingGraph &&
      existingGraph.sourceEditedInInspector !== true &&
      existingGraph.sourceHash === sourceHash &&
      Number(existingGraph.optimizerVersion || 0) === Number(visualCSharp.version || 0) &&
      String(existingGraph.catalogFingerprint || "") === initialCatalogStamp.fingerprint &&
      String(existingGraph.catalogEngineVersion || "") === initialCatalogStamp.engineVersion &&
      String(existingGraph.catalogSource || "") === initialCatalogStamp.source &&
      Number(existingGraph.catalogDefinitionRevision || 0) === initialCatalogStamp.definitionRevision
    ) {
      existingGraph.sourceEditedInInspector = false;
      updateCustomCSharpSynchronizationControl(
        ownerId
      );
      persistGraph(true);
      return openAfterSync ? openCustomCSharpFileGraph(ownerId) : true;
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
      assertCurrentProject();
      const currentOwner = findGraphNode(ownerId);
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
      assertCurrentProject();
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
          assertCurrentProject();
        } else {
          try {
            await customCSharpCancellable(
              gate({ requiredNodeIds: selectedCatalogNodeIds }),
              signal
            );
            assertCurrentProject();
            setCustomCSharpSynchronizationStatus(
              ownerId,
              "Worker: applying verified API nodes…"
            );
            fragment = await buildCustomCSharpFragmentInWorker(ownerId, source, parseResult, fragmentOptions);
            assertCurrentProject();
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
            assertCurrentProject();
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
        assertCurrentProject();
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
        assertCurrentProject();
        if (!fragment?.ok) throw new Error(fragment?.diagnostics?.[0] || "The catalog-independent semantic graph could not be created.");
        prepared = visualCSharp.createCustomCSharpFileGraphFromFragment(fragment);
      }
      if (!prepared?.ok || !await validatePreparedGraph(prepared)) {
        throw new Error(`The locally optimized Node Graph did not reproduce valid live-checked C# 14 source. ${preparedGraphValidationFailure || "The local subtree validator failed without a diagnostic."} The previous valid graph was preserved; it was not replaced by a whole-file Raw Roslyn graph.`);
      }
      if (String(findGraphNode(ownerId)?.parameters?.source || "") !== source) {
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
      graph.customCSharpFiles[ownerId] = prepared.customGraph;
      updateCustomCSharpSynchronizationControl(
        ownerId
      );
      setCustomCSharpDiagnostics(
        ownerId,
        []
      );
      persistGraph(true);
      if (!openAfterSync) return true;
      setCustomCSharpSynchronizationStatus(
        ownerId,
        "Opening optimized Node Graph…"
      );
      const opened = openCustomCSharpFileGraph(ownerId);
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
      result[ownerId] = {
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
        ),
        ...serializableGraphView(customGraph)
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
      window.RMLCustomCSharpDetachedEditor
        ?.mount
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
          "js/editor/custom_csharp_editor.js?v=53-max-graph-performance-v755",
          document.baseURI
        ).href;
        script.async = true;
        script.addEventListener(
          "load",
          () => {
            const editor =
              window.RMLCustomCSharpDetachedEditor;
            if (typeof editor?.mount === "function") {
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

function customCSharpEditorNodeCandidates(
    nodeId
  ) {
    const id = String(nodeId || "");
    const candidates = [];
    const seen = new Set();
    const add = candidate => {
      if (
        !candidate ||
        seen.has(candidate)
      ) {
        return;
      }
      seen.add(candidate);
      candidates.push(candidate);
    };
    add(
      graph?.nodes?.find(
        candidate => candidate?.id === id
      )
    );
    add(
      customCSharpEditor?.mainView?.nodes?.find(
        candidate => candidate?.id === id
      )
    );
    add(
      apiCompositeEditor?.mainView?.nodes?.find(
        candidate => candidate?.id === id
      )
    );
    for (const composite of Object.values(
      graph?.apiCompositeGraphs || {}
    )) {
      add(
        composite?.nodes?.find(
          candidate =>
            candidate?.id === id
        )
      );
    }
    return candidates;
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
    const controls = dom.inspectorContent?.querySelectorAll(
      `[${CUSTOM_CSHARP_CODE_NODE_ATTRIBUTE}="${CSS.escape(String(nodeId || ""))}"]` +
      `[${CUSTOM_CSHARP_CODE_PARAMETER_ATTRIBUTE}="${CSS.escape(String(parameterKey || "code"))}"]`
    ) || [];
    for (const control of controls) {
      if (
        !(control instanceof HTMLTextAreaElement) ||
        control.value === value
      ) {
        continue;
      }
      const selectionStart =
        control.selectionStart;
      const selectionEnd =
        control.selectionEnd;
      const selectionDirection =
        control.selectionDirection ||
        "forward";
      control.value = value;
      if (
        document.activeElement === control &&
        Number.isFinite(selectionStart) &&
        Number.isFinite(selectionEnd)
      ) {
        const maximum = control.value.length;
        control.setSelectionRange(
          Math.min(selectionStart, maximum),
          Math.min(selectionEnd, maximum),
          selectionDirection
        );
      }
    }
  }

function commitCustomCSharpEditorValue(
    nodeId,
    specification,
    value
  ) {
    const parameterKey = String(
      specification?.key || "code"
    );
    const next = rememberCustomCSharpEditorDraft(
      nodeId,
      parameterKey,
      value
    );
    const nodes =
      customCSharpEditorNodeCandidates(nodeId);
    if (nodes.length === 0) return false;
    for (const candidate of nodes) {
      candidate.parameters =
        candidate.parameters &&
        typeof candidate.parameters === "object"
          ? candidate.parameters
          : {};
      candidate.parameters[parameterKey] = next;
    }
    const node = nodes[0];
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
    if (
      parameterKey === "source" &&
      nodeDefinition(node)?.customCSharpFile === true &&
      !customCSharpEditor
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
      updateCustomCSharpSynchronizationControl(node.id);
    }
    persistGraph(
      specification?.commitImmediately === true
    );
    refreshDisplayValueNodes();
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
        } catch {
          // Pointer capture is optional in embedded browsers.
        }
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
      } catch {
        // The pointer may already have been released.
      }
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

function prepareCustomCSharpEditorHost(
    hostWindow,
    title
  ) {
    hostWindow.document.title = title;
    hostWindow.document.body.replaceChildren();
    window.RMLClassStyles?.observe(
      hostWindow.document
    );
    const stylesheet =
      hostWindow.document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = new URL(
      "styles/features/styles.runtime-graph.css?v=4-max-graph-performance-v755",
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
    } catch {
      // The blocked-window message below is the actionable result.
    }
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
    prepareCustomCSharpEditorHost(
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
      }
    };
    customCSharpDetachedEditors.set(
      editorKey,
      pendingRecord
    );

    void loadCustomCSharpDetachedEditorModule()
      .then(editorModule => {
        if (
          hostWindow.closed ||
          (mode === "inline" ||
            mode === "overlay") &&
            !frame?.isConnected ||
          customCSharpDetachedEditors.get(
            editorKey
          ) !== pendingRecord
        ) {
          return;
        }
        const node = customCSharpEditorNode(nodeId);
        if (!node) {
          throw new Error(
            "The Custom C# node no longer exists."
          );
        }
        let record;
        const mounted = editorModule.mount({
          popup: hostWindow,
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
            if (!liveNode) return;
            for (const [key, sourceKey] of [
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
            ]) {
              liveNode.parameters[key] =
                normalizedCustomCSharpEditorColor(
                  appearance?.[sourceKey],
                  CUSTOM_CSHARP_EDITOR_COLORS[sourceKey]
                );
            }
            persistGraph(true);
            refreshCustomCSharpEditorAppearance(
              liveNode
            );
          },
          onInput(value) {
            commitCustomCSharpEditorValue(
              nodeId,
              specification,
              value
            );
          },
          onBlur() {
            const liveNode =
              customCSharpEditorNode(nodeId);
            if (
              !liveNode ||
              specification?.key !== "source" ||
              nodeDefinition(liveNode)
                ?.customCSharpFile !== true ||
              customCSharpEditor
            ) {
              return;
            }
            queueMicrotask(() => {
              void openCustomCSharpFileGraphSynced(
                nodeId,
                {
                  openAfterSync: false,
                  quiet: true
                }
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
              current.popup !== hostWindow
            ) {
              return;
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
        if (!mounted) {
          throw new Error(
            "The Custom C# editor could not initialize its host."
          );
        }
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
          record.getValue()
        );
      })
      .catch(error => {
        if (
          customCSharpDetachedEditors.get(
            editorKey
          ) === pendingRecord
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
      value
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
