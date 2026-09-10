"use strict";

// Coherent graph modules: Composite contracts, cached/live factory transitions and lazy Runtime Graph handoff stay synchronized.

const GRAPH_BOOTSTRAP_MODULE_ID =
  "1.20.31-universal-presentation-dev23";

function assertGraphBootstrapModuleCoherence() {
  const mismatches = [];
  for (const [name, actual] of [
    [
      "node_graph_codegen.js",
      window.RMLTypedNodeGraphGenerator
        ?.moduleId
    ],
    [
      "node_graph_composites.js",
      window.RMLNodeGraphCompositesModuleId
    ],
    [
      "node_graph_custom_csharp.js",
      window.RMLNodeGraphCustomCSharpModuleId
    ],
    [
      "node_graph_view.js",
      window.RMLNodeGraphViewModuleId
    ]
  ]) {
    if (actual !== GRAPH_BOOTSTRAP_MODULE_ID) {
      mismatches.push(
        `${name} (${String(actual || "missing")})`
      );
    }
  }
  if (mismatches.length > 0) {
    throw new Error(
      `Runtime Graph module version mismatch: ${mismatches.join(", ")}. Reload the Builder without cached files. Project import was stopped before graph reconciliation.`
    );
  }
}

assertGraphBootstrapModuleCoherence();

// Runtime Graph public view contracts and startup.

installGraphRevealProvider();

Object.defineProperty(
    window,
    "RMLTypedNodeGraphScrollLayers",
    {
      value: Object.freeze({
        getViewportLayer() {
          return sharedGraphScrollLayerDescriptor(dom.viewport);
        },
        describeLayer: sharedGraphScrollLayerDescriptor,
        resolveLayer: resolveSharedGraphScrollLayer,
        getLayerAxes(descriptor) {
          const element = resolveSharedGraphScrollLayer(descriptor);
          return !element ? { x: false, y: false }
            : descriptor.kind === "root" ? { x: true, y: true }
            : graphScrollLayerAxes(element);
        },
        scrollLayer(event, descriptor) {
          const element = resolveSharedGraphScrollLayer(descriptor);
          return element
            ? scrollGraphLayerWithWheel(event, descriptor, element)
            : { moved: false, empty: true };
        },
        clear() {
          clearGraphScrollLayerSelection();
          return true;
        },
        commit() {
          return Boolean(
            commitGraphScrollLayerSelection()
          );
        },
        refresh() {
          scheduleGraphScrollLayerVisualRefresh();
          return true;
        },
        getState() {
          const preview =
            graphScrollLayerSession
              ?.candidates?.[
                graphScrollLayerSession.index
              ] || null;

          return Object.freeze({
            active:
              Boolean(
                graphScrollLayerSelection ||
                graphScrollLayerSession
              ),
            cycling:
              Boolean(
                graphScrollLayerSession
              ),
            preview:
              preview?.label || "",
            previewKey:
              preview?.key || "",
            selected:
              graphScrollLayerSelection
                ?.label || "",
            selectedKey:
              graphScrollLayerSelection
                ?.key || "",
            globalOverride:
              Boolean(
                graphScrollLayerSelection
              ),
            outermost:
              "<html> · Page ROOT",
            candidateOrder:
              Object.freeze(
                (
                  graphScrollLayerSession
                    ?.candidates ||
                  graphScrollLayerSelectionCandidates ||
                  []
                ).map(descriptor => ({
                  key: descriptor.key,
                  label: descriptor.label,
                  kind: descriptor.kind
                }))
              )
          });
        }
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );

if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initializeImmediately,
      {
        once: true
      }
    );
} else {
    initializeImmediately();
  }

  function commitAcceptedGraphDocumentMutation({
    refreshGeneratedOutput = true,
    refreshCompositeActions = true,
    mutationClass = "topology",
    analysisChanged = null
  } = {}) {
    // Every public host writer converges here.  The accepted document
    // revision is minted before the shared persistence scheduler snapshots
    // the complete active graph, including nested Composite and Custom C#
    // registries.
    return scheduleAcceptedGraphPersistenceAfterPaint({
      refreshGeneratedOutput:
        refreshGeneratedOutput === true,
      refreshCompositeActions:
        refreshCompositeActions === true,
      mutationClass,
      analysisChanged,
      contentChanged: true,
      documentChanged: true
    });
  }

  function commitGraphDocumentMutationIfChanged(
    documentChanged,
    options = {}
  ) {
    if (documentChanged === true) {
      return commitAcceptedGraphDocumentMutation(options);
    }
    if (options.persistViewWhenUnchanged === true) {
      persistGraphView(
        options.persistViewImmediately === true,
        false
      );
    }
    return null;
  }

  function graphAnalysisChangedBindingNodeIds(
    previousAnalysis,
    nextAnalysis
  ) {
    const previousBindings =
      previousAnalysis?.bindings;
    const nextBindings = nextAnalysis?.bindings;
    const changed = new Set();
    if (
      !(previousBindings instanceof Map) ||
      !(nextBindings instanceof Map) ||
      previousBindings === nextBindings
    ) {
      return changed;
    }
    const recordsEqual = (previous, next) => {
      if (previous === next) {
        return true;
      }
      const previousKeys =
        Object.keys(previous || {});
      const nextKeys = Object.keys(next || {});
      return (
        previousKeys.length ===
          nextKeys.length &&
        previousKeys.every(key =>
          previous[key] === next[key]
        )
      );
    };
    for (const [nodeId, previous] of
      previousBindings) {
      const next =
        nextBindings.get(nodeId) || {};
      if (
        !recordsEqual(previous || {}, next)
      ) {
        changed.add(nodeId);
      }
    }
    for (const [nodeId, next] of
      nextBindings) {
      if (
        !previousBindings.has(nodeId) &&
        !recordsEqual({}, next || {})
      ) {
        changed.add(nodeId);
      }
    }
    return changed;
  }

  function addCachedIncidentConnectionIds(
    target,
    nodeIds
  ) {
    for (const nodeId of nodeIds) {
      for (const connectionId of
        graphIncidentConnectionLookupCache.get(
          nodeId
        ) || []) {
        target.add(connectionId);
      }
    }
    return target;
  }

Object.defineProperty(window, "RMLDynamicGraphHost", {
    value: Object.freeze({
      version: 73,
      moduleId:
        GRAPH_BOOTSTRAP_MODULE_ID,
      getState() { return graph; },
      whenViewReady: whenGraphViewReady,
      hasPendingEditorEdits() {
        return customCSharpEditorPersistenceDirty || graphParameterPersistenceDirty;
      },
      flushPendingEditorEdits() {
        // A single commit consumes both sources; avoid duplicate full snapshots.
        return flushGraphParameterPersistence() || flushCustomCSharpEditorPersistence();
      },
      hasUncommittedGraphChanges() {
        return Boolean(activeInteraction) || customCSharpEditorPersistenceDirty || graphParameterPersistenceDirty;
      },
      prepareForExport() {
        if (!graph || !graphHostInitialized || !bridge) return false;
        if (activeInteraction) cancelInteraction(true);
        // One commit captures pending node parameters / Custom C# and composite
        // views, cancels queued commits and refreshes code caches for this click.
        persistGraph(true);
        return true;
      },
      getCSharpImportTarget() {
        if (
          !graph ||
          !Array.isArray(graph.nodes) ||
          !Array.isArray(graph.connections)
        ) {
          return Object.freeze({
            available: false,
            reason:
              "The Runtime Graph is not ready."
          });
        }
        if (customCSharpEditor) {
          return Object.freeze({
            available: false,
            reason:
              "Finish or close the current Custom C# File graph before importing another C# file."
          });
        }
        const composite = Boolean(
          apiCompositeEditor
        );
        const ownerPath = composite
          ? apiCompositeEditorOwnerPath(
              apiCompositeEditor
            )
          : [];
        const ownerId = composite
          ? String(
              ownerPath.at(-1) ||
                apiCompositeEditor
                  .containerNodeId ||
                ""
            )
          : "";
        const title = composite
          ? String(
              apiCompositeEditor.title ||
              "API Composite"
            )
          : "Runtime Graph";
        return Object.freeze({
          available: true,
          key: composite
            ? `project:${builderProjectEpoch}:api-composite:${ownerPath.map(value => encodeURIComponent(value)).join("/")}`
            : `project:${builderProjectEpoch}:runtime-root`,
          kind: composite
            ? "api-composite"
            : "runtime-root",
          label: composite
            ? `API Composite ‘${title}’`
            : title,
          ownerId,
          ownerPath: Object.freeze([
            ...ownerPath
          ]),
          state: graph
        });
      },
      getGraphIdentitySets() {
        const identities =
          graphIdentitySetsForSavedComposite();
        return Object.freeze({
          nodeIds: new Set(
            identities.nodeIds
          ),
          connectionIds: new Set(
            identities.connectionIds
          )
        });
      },
      getProjectEpoch() {
        return builderProjectEpoch;
      },
      getNodePaletteIcon(
        operatorId,
        parameters = {}
      ) {
        const definition =
          resolveNodeDefinition({
            kind: "operator",
            operatorId: String(
              operatorId || ""
            ),
            parameters:
              parameters &&
              typeof parameters ===
                "object"
                ? nodeGraphClone(parameters)
                : {}
          });
        return Object.freeze({
          ...nodePaletteIconDescriptor(
            definition
          )
        });
      },
      synchronizeProjectState(
        projectEpoch,
        {
          importedDocument = false,
          graphNormalizationChanged = false
        } = {}
      ) {
        const requestedProjectEpoch =
          Number(projectEpoch) || 0;
        const currentProjectEpoch =
          Number(
            bridge?.getProjectEpoch?.()
          ) || 0;
        if (
          requestedProjectEpoch <= 0 ||
          requestedProjectEpoch !==
            currentProjectEpoch
        ) {
          return false;
        }
        builderProjectEpoch =
          requestedProjectEpoch;
        handleBuilderRendered({
          detail: {
            projectEpoch:
              requestedProjectEpoch,
            importedDocument:
              importedDocument === true,
            graphNormalizationChanged:
              graphNormalizationChanged ===
                true
          }
        });
        return (
          builderProjectEpoch ===
            requestedProjectEpoch
        );
      },
      migrateLegacyOperatorsForImport(
        graphDocument
      ) {
        return migrateLegacyOperatorsForImport(
          graphDocument
        );
      },
      planPreservedCatalogOperatorsForImport(
        graphDocument,
        unresolvedRequirements
      ) {
        return planPreservedCatalogOperatorsForImport(
          graphDocument,
          unresolvedRequirements
        );
      },
      createPreservedCatalogInstallTransaction(
        plan,
        admissionToken
      ) {
        const controller =
          window.RMLApiNodeFactoryController;
        if (
          typeof controller
            ?.createUnavailableOperatorTransaction !==
            "function"
        ) {
          throw new Error(
            "The portable API contract installer is unavailable."
          );
        }
        return controller
          .createUnavailableOperatorTransaction(
            plan?.entries || [],
            {
              token: admissionToken,
              planKey: String(
                plan?.planKey || ""
              )
            }
          );
      },
      createPreservedCatalogAdmissionToken(
        plan
      ) {
        const controller =
          window.RMLApiNodeFactoryController;
        if (
          typeof controller
            ?.createUnavailableOperatorAdmissionToken !==
              "function"
        ) {
          throw new Error(
            "The portable API contract admission gate is unavailable."
          );
        }
        return controller
          .createUnavailableOperatorAdmissionToken(
            String(plan?.planKey || "")
          );
      },
      verifyPreservedCatalogOperatorsForImport(
        graphDocument,
        plan
      ) {
        return verifyPreservedCatalogOperatorsForImport(
          graphDocument,
          plan
        );
      },
      compatibleImportReplacementCandidates(
        requirement
      ) {
        return compatibleImportReplacementCandidates(
          requirement
        );
      },
      catalogFactoryIdentityMatches(
        catalog,
        report
      ) {
        return catalogFactoryIdentityMatches(
          catalog,
          report
        );
      },
      getReplacementCandidateIndexStats() {
        return Object.freeze({
          indexBuilds:
            replacementCandidateIndexBuilds,
          cacheHits:
            replacementCandidateCacheHits,
          cachedContracts:
            replacementCandidateResultCache
              .size,
          indexedStaticDefinitions:
            replacementCandidateIndexCache
              ?.staticDescriptors?.length ||
            0,
          indexedDynamicDefinitions:
            replacementCandidateIndexCache
              ?.dynamicEntries?.length ||
            0,
          indexKey:
            replacementCandidateIndexCache
              ?.key || ""
        });
      },
      applyCatalogMigrationsPreservingGeometry(
        graphDocument,
        migrations,
        portMigrations,
        nodeMigrations = []
      ) {
        return applyCatalogMigrationsPreservingGeometry(
          graphDocument,
          migrations,
          portMigrations,
          nodeMigrations
        );
      },
      getRootState() {
        if (
          !customCSharpEditor &&
          !apiCompositeEditor
        ) {
          return graph;
        }
        return {
          ...graph,
          ...rootRuntimeGraphView()
        };
      },
      getCustomCSharpEditorState() {
        return Object.freeze({
          active: Boolean(customCSharpEditor),
          fileNodeId: customCSharpEditor?.fileNodeId || "",
          fileName: customCSharpEditor?.fileName || ""
        });
      },
      openCustomCSharpFile(fileNodeId) {
        return {
          ok: openCustomCSharpFileGraph(String(fileNodeId || "")),
          fileNodeId: String(fileNodeId || "")
        };
      },
      closeCustomCSharpFile() {
        return { ok: closeCustomCSharpFileGraph() };
      },
      getApiCompositeEditorState() {
        const ownerPath =
          apiCompositeEditorOwnerPath(
            apiCompositeEditor
          );
        return Object.freeze({
          active: Boolean(
            apiCompositeEditor
          ),
          containerNodeId:
            apiCompositeEditor
              ?.containerNodeId || "",
          title:
            apiCompositeEditor?.title ||
            "",
          depth: ownerPath.length,
          ownerPath: Object.freeze([
            ...ownerPath
          ])
        });
      },
      createApiComposite(nodeIds = []) {
        graph.selectedNodeIds = [
          ...new Set(
            (Array.isArray(nodeIds)
              ? nodeIds
              : [])
              .map(value =>
                String(value || "")
              )
              .filter(Boolean)
          )
        ];
        graph.selectedNodeId =
          graph.selectedNodeIds.at(-1) ||
          null;
        return {
          ok:
            createApiCompositeFromSelection()
        };
      },
      openApiComposite(containerNodeId) {
        return {
          ok: openApiCompositeGraph(
            String(containerNodeId || "")
          )
        };
      },
      closeApiComposite() {
        return {
          ok: closeApiCompositeGraph()
        };
      },
      unpackApiComposite(containerNodeId) {
        try {
          return {
            ok: unpackApiCompositeNode(
              String(containerNodeId || "")
            )
          };
        } catch (error) {
          return {
            ok: false,
            reason:
              error instanceof Error
                ? error.message
                : String(error)
          };
        }
      },
      expandApiCompositeGraph(
        graphDocument
      ) {
        return expandApiCompositeGraphDocument(
          graphDocument
        );
      },
      getSavedApiComposites() {
        return Object.freeze(
          [...savedApiCompositeTemplates.values()]
            .map(record =>
              Object.freeze(nodeGraphClone(record))
            )
        );
      },
      getSavedApiCompositeCompatibilityIssues() {
        return Object.freeze(
          [...savedApiCompositeCompatibilityIssues]
            .map(([id, reason]) =>
              Object.freeze({
                id,
                reason
              })
            )
        );
      },
      reconcileSavedApiComposites(
        { force = false } = {}
      ) {
        if (force === true) {
          savedApiCompositeReconciliationCompletedKey =
            "";
        }
        return scheduleSavedApiCompositeCatalogReconciliation();
      },
      getOpenGraphCatalogIssues() {
        return Object.freeze(
          graphCatalogContractIssues(graph)
            .map(issue =>
              Object.freeze({
                ...issue
              })
            )
        );
      },
      reconcileOpenGraphCatalog(
        { force = false } = {}
      ) {
        return scheduleOpenGraphCatalogReconciliation({
          force: force === true
        });
      },
      sanitizeSavedApiComposite(
        record,
        options = {}
      ) {
        return sanitizeSavedApiCompositeRecord(
          record,
          options
        );
      },
      buildSavedApiCompositeExportPayload(
        records
      ) {
        return savedApiCompositeExportPayload(
          Array.isArray(records)
            ? records
            : []
        );
      },
      parseSavedApiCompositeJson(
        payload
      ) {
        return savedApiCompositeRecordsFromJson(
          payload
        );
      },
      prepareSavedApiCompositeInstance(
        record,
        existingGraph,
        x = 0,
        y = 0
      ) {
        const previousGraph = graph;
        try {
          graph = sanitizeGraphState(
            existingGraph || {
              active: true,
              nodes: [],
              connections: [],
              apiCompositeGraphs: {}
            }
          );
          const normalized =
            sanitizeSavedApiCompositeRecord(
              record
            );
          const containerId =
            uniqueSavedCompositeGraphId(
              "api-composite",
              graphIdentitySetsForSavedComposite()
                .nodeIds
            );
          return remapSavedApiCompositeInstance(
            normalized,
            containerId,
            finiteNumber(x, 0),
            finiteNumber(y, 0)
          );
        } finally {
          graph = previousGraph;
        }
      },
      importSavedApiComposites(
        payload
      ) {
        return importSavedApiCompositePayload(
          payload
        );
      },
      instantiateSavedApiComposite(
        templateId,
        x = 0,
        y = 0
      ) {
        return instantiateSavedApiCompositeAt(
          String(templateId || ""),
          finiteNumber(x, 0),
          finiteNumber(y, 0)
        );
      },
      getRendererStats() {
        return {
          ...(
            graphHybridRenderer
              ?.getStats?.() ||
            {
              renderer: "svg-fallback",
              available: false
            }
          ),
          totalNodes:
            graph?.nodes?.length || 0,
          renderedDomNodes:
            dom.nodesHost
              ?.querySelectorAll(
                ":scope > .rml-graph-node"
              ).length || 0,
          totalConnections:
            graph?.connections?.length || 0,
          svgCompatibilityPaths:
            dom.wires
              ?.querySelectorAll(
                ".rml-graph-wire-hit"
              ).length || 0,
          overview:
            graphGpuOverviewActive(),
          connectionDrag: {
            ...graphConnectionDragTelemetry,
            active:
              activeInteraction?.kind ===
              "connection"
          }
        };
      },
      graphPointToClient(x, y) {
        return graphToClient(
          guidedStep11Finite(x, 0),
          guidedStep11Finite(y, 0)
        );
      },
      clientPointToGraph(x, y) {
        return clientToGraph(
          guidedStep11Finite(x, 0),
          guidedStep11Finite(y, 0)
        );
      },
      planGuidedStep11Layout(request = {}) {
        return guidedStep11Plan(request);
      },
      evaluateGuidedStep11Layout(request = {}) {
        return guidedStep11EvaluateLive(request);
      },
      getGuidedConnectionGeometry(connectionId) {
        const connection = graphConnectionById(connectionId);
        const geometry = connection ? connectionGeometry(connection) : null;
        return geometry
          ? {
              connectionId,
              anchors: geometry.anchors.map(anchor => ({
                x: anchor.x,
                y: anchor.y,
                side: anchor.side || null,
                endpoint: anchor.endpoint || "",
                pointId: anchor.point?.id || ""
              })),
              segments: geometry.segments.map(segment => ({
                index: segment.index,
                from: { ...segment.from },
                to: { ...segment.to },
                d: segment.d
              }))
            }
          : null;
      },
      getGuidedWirePoint(connectionId, pointId) {
        const point = wirePointById(
          graphConnectionById(connectionId),
          pointId
        );
        return point ? { ...point } : null;
      },
      getGuidedNodeGeometry(nodeId) {
        const node = findGraphNode(nodeId);
        if (!node) return null;
        const record = guidedStep11NodeRecord(node);
        const limits = guidedStep11NodeResizeLimits(node);
        return {
          nodeId,
          x: record.x,
          y: record.y,
          width: record.width,
          height: record.height,
          rect: { ...record.rect },
          explicitWidth:
            Number.isFinite(node.width)
              ? node.width
              : null,
          explicitHeight:
            Number.isFinite(node.height)
              ? node.height
              : null,
          resizeLimits: limits
        };
      },
      getGuidedInteractionState() {
        if (!activeInteraction) return null;
        return {
          kind: activeInteraction.kind || "",
          pointerId: activeInteraction.pointerId ?? null,
          operatorId: activeInteraction.operatorId || "",
          dragging: activeInteraction.dragging === true,
          ghostVisible: Boolean(
            activeInteraction.ghost?.isConnected
          ),
          clientX: Number.isFinite(activeInteraction.clientX)
            ? activeInteraction.clientX
            : null,
          clientY: Number.isFinite(activeInteraction.clientY)
            ? activeInteraction.clientY
            : null,
          start: activeInteraction.start
            ? { ...activeInteraction.start }
            : null,
          originalStart: activeInteraction.originalStart
            ? { ...activeInteraction.originalStart }
            : null
        };
      },
      refreshGuidedWires() {
        renderGraphWires();
        const wireCount = dom.wires?.querySelectorAll(
          ".rml-graph-wire"
        ).length || 0;
        const hitCount = dom.wires?.querySelectorAll(
          ".rml-graph-wire-hit"
        ).length || 0;
        return {
          ok: Boolean(dom.wires),
          wireCount,
          hitCount,
          connectionCount: graph.connections.length
        };
      },
      materializeGuidedConnection(connectionId) {
        const connection = graphConnectionById(connectionId);
        if (!connection || !dom.nodesHost || !dom.wires) {
          return {
            ok: false,
            reason: connection
              ? "The graph render hosts are unavailable."
              : "The requested graph connection does not exist."
          };
        }

        let output = socketElement(
          connection.fromNode,
          connection.fromPort,
          "output"
        );
        let input = socketElement(
          connection.toNode,
          connection.toPort,
          "input"
        );

        if (!output || !input) {
          forceGraphNodesRendered(
            connection.fromNode,
            connection.toNode
          );
          output = socketElement(
            connection.fromNode,
            connection.fromPort,
            "output"
          );
          input = socketElement(
            connection.toNode,
            connection.toPort,
            "input"
          );
        }

        refreshRenderedNodeResizeLimits();
        renderGraphWires();

        const geometry = connectionGeometry(connection);
        const selector =
          `[data-connection-id="${CSS.escape(connection.id)}"]`;
        const wireCount = dom.wires.querySelectorAll(
          `.rml-graph-wire${selector}`
        ).length;
        const hitCount = dom.wires.querySelectorAll(
          `.rml-graph-wire-hit${selector}`
        ).length;

        return {
          ok: Boolean(
            output &&
            input &&
            geometry?.segments?.length &&
            wireCount > 0 &&
            hitCount > 0
          ),
          connectionId: connection.id,
          outputRendered: Boolean(output),
          inputRendered: Boolean(input),
          geometryAvailable: Boolean(geometry),
          segmentCount: geometry?.segments?.length || 0,
          wireCount,
          hitCount
        };
      },
      beginGuidedConnectionDrag(
        endpoint,
        pointerId,
        clientX,
        clientY
      ) {
        if (activeInteraction) {
          return {
            ok: false,
            reason: `Another graph interaction is active: ${activeInteraction.kind || "unknown"}`
          };
        }
        const nodeId = String(endpoint?.nodeId || "");
        const portId = String(endpoint?.portId || "");
        const direction = String(endpoint?.direction || "");
        const socket = dom.nodesHost?.querySelector(
          `.rml-graph-socket[data-node-id="${CSS.escape(nodeId)}"]` +
          `[data-port-id="${CSS.escape(portId)}"]` +
          `[data-direction="${CSS.escape(direction)}"]`
        );
        if (!(socket instanceof HTMLElement)) {
          return {
            ok: false,
            reason: "The requested guided graph socket is not rendered."
          };
        }
        beginConnectionDrag({
          button: 0,
          pointerId,
          clientX: finiteNumber(clientX, 0),
          clientY: finiteNumber(clientY, 0),
          currentTarget: socket,
          preventDefault() {},
          stopPropagation() {}
        });
        const preview = dom.wires?.querySelector(
          ".rml-graph-wire-preview"
        ) || null;
        return {
          ok: Boolean(
            activeInteraction?.kind === "connection" &&
            activeInteraction.pointerId === pointerId
          ),
          pointerId,
          previewVisible: Boolean(preview),
          interaction: activeInteraction?.kind === "connection"
            ? {
                kind: activeInteraction.kind,
                pointerId: activeInteraction.pointerId,
                start: { ...activeInteraction.start }
              }
            : null
        };
      },
      moveGuidedConnectionDrag(
        pointerId,
        clientX,
        clientY
      ) {
        if (
          activeInteraction?.kind !== "connection" ||
          activeInteraction.pointerId !== pointerId
        ) {
          return {
            ok: false,
            reason: "The guided connection interaction is not active."
          };
        }
        activeInteraction.clientX = finiteNumber(
          clientX,
          activeInteraction.clientX
        );
        activeInteraction.clientY = finiteNumber(
          clientY,
          activeInteraction.clientY
        );
        updateAutoPanPointer(
          activeInteraction.clientX,
          activeInteraction.clientY
        );
        renderGraphWires();
        const preview = dom.wires?.querySelector(
          ".rml-graph-wire-preview"
        ) || null;
        let previewLength = 0;
        try {
          previewLength = Number(preview?.getTotalLength?.()) || 0;
        } catch {
        }
        return {
          ok: true,
          pointerId,
          clientX: activeInteraction.clientX,
          clientY: activeInteraction.clientY,
          previewVisible: Boolean(
            preview instanceof SVGElement &&
            preview.isConnected &&
            previewLength > 1
          ),
          previewLength
        };
      },
      finishGuidedConnectionDrag(
        pointerId,
        clientX,
        clientY,
        preferredConnectionId = null,
        preferredSegmentIndex = null
      ) {
        if (
          activeInteraction?.kind !== "connection" ||
          activeInteraction.pointerId !== pointerId
        ) {
          return {
            ok: false,
            reason: "The guided connection interaction is not active."
          };
        }
        const beforeIds = new Set(
          graph.connections.map(connection => connection.id)
        );
        const normalizedSegmentIndex = Number.isInteger(
          preferredSegmentIndex
        )
          ? Math.max(0, preferredSegmentIndex)
          : null;
        const forcedPath = preferredConnectionId
          ? [
              ...dom.wires?.querySelectorAll(
                `.rml-graph-wire-hit[data-connection-id="${CSS.escape(preferredConnectionId)}"]`
              ) || []
            ].find(path =>
              normalizedSegmentIndex === null ||
              Number(path.dataset.segmentIndex || 0) === normalizedSegmentIndex
            ) || null
          : null;
        const finishClientX = finiteNumber(
          clientX,
          activeInteraction.clientX
        );
        const finishClientY = finiteNumber(
          clientY,
          activeInteraction.clientY
        );
        const viewportRectangle = dom.viewport?.getBoundingClientRect();
        const targetInsideViewport = Boolean(
          viewportRectangle &&
          finishClientX >= viewportRectangle.left &&
          finishClientX <= viewportRectangle.right &&
          finishClientY >= viewportRectangle.top &&
          finishClientY <= viewportRectangle.bottom
        );
        const nearest = forcedPath
          ? nearestGraphPointOnSvgPath(
              forcedPath,
              finishClientX,
              finishClientY
            )
          : null;
        const targetGraphPoint = clientToGraph(
          finishClientX,
          finishClientY
        );
        const forcedDistanceClient = nearest
          ? Math.hypot(
              nearest.x - targetGraphPoint.x,
              nearest.y - targetGraphPoint.y
            ) * Math.max(.001, finiteNumber(graph.viewport.scale, 1))
          : Infinity;
        const forcedWireTarget =
          forcedPath?.isConnected &&
          targetInsideViewport &&
          forcedDistanceClient <= 14
            ? {
                connectionId: preferredConnectionId,
                segmentIndex: Number(forcedPath.dataset.segmentIndex || 0),
                path: forcedPath
              }
            : null;
        finishConnectionDrag(
          true,
          finishClientX,
          finishClientY,
          forcedWireTarget
        );
        const created = graph.connections.find(
          connection => !beforeIds.has(connection.id)
        ) || null;
        return {
          ok: activeInteraction === null,
          pointerId,
          committed: Boolean(created),
          connectionId: created?.id || "",
          forcedWireTargetUsed: Boolean(forcedWireTarget),
          preferredConnectionId: preferredConnectionId || "",
          preferredSegmentIndex: normalizedSegmentIndex,
          targetInsideViewport,
          forcedDistanceClient,
          connectionCountBefore: beforeIds.size,
          connectionCountAfter: graph.connections.length
        };
      },
      cancelGuidedConnectionDrag(pointerId) {
        if (
          activeInteraction?.kind !== "connection" ||
          activeInteraction.pointerId !== pointerId
        ) {
          return {
            ok: false,
            reason: "The guided connection interaction is not active."
          };
        }
        const clientX = activeInteraction.clientX;
        const clientY = activeInteraction.clientY;
        finishConnectionDrag(false, clientX, clientY);
        return {
          ok: activeInteraction === null,
          pointerId
        };
      },
      getGuidedPaletteDropState() {
        return lastGuidedPaletteDropState
          ? { ...lastGuidedPaletteDropState }
          : null;
      },
      inspectGuidedConnectionPoint(
        startEndpoint,
        clientX,
        clientY,
        excludedConnectionId = null,
        preferredConnectionId = null,
        preferredSegmentIndex = null
      ) {
        const snapshot = connectionPointSnapshot(
          finiteNumber(clientX, 0),
          finiteNumber(clientY, 0),
          startEndpoint,
          excludedConnectionId
        );
        if (
          !snapshot.socket &&
          preferredConnectionId &&
          snapshot.wire?.connectionId !== preferredConnectionId
        ) {
          const normalizedSegmentIndex = Number.isInteger(
            preferredSegmentIndex
          )
            ? Math.max(0, preferredSegmentIndex)
            : null;
          const preferredPath = [
            ...dom.wires?.querySelectorAll(
              `.rml-graph-wire-hit[data-connection-id="${CSS.escape(preferredConnectionId)}"]`
            ) || []
          ].find(path =>
            normalizedSegmentIndex === null ||
            Number(path.dataset.segmentIndex || 0) === normalizedSegmentIndex
          ) || null;
          const viewportRectangle = dom.viewport?.getBoundingClientRect();
          const insideViewport = Boolean(
            viewportRectangle &&
            clientX >= viewportRectangle.left &&
            clientX <= viewportRectangle.right &&
            clientY >= viewportRectangle.top &&
            clientY <= viewportRectangle.bottom
          );
          if (preferredPath?.isConnected && insideViewport) {
            const nearest = nearestGraphPointOnSvgPath(
              preferredPath,
              finiteNumber(clientX, 0),
              finiteNumber(clientY, 0)
            );
            const target = clientToGraph(
              finiteNumber(clientX, 0),
              finiteNumber(clientY, 0)
            );
            const distanceClient = Math.hypot(
              nearest.x - target.x,
              nearest.y - target.y
            ) * Math.max(.001, finiteNumber(graph.viewport.scale, 1));
            if (distanceClient <= 14) {
              snapshot.wire = {
                connectionId: preferredConnectionId,
                segmentIndex: Number(
                  preferredPath.dataset.segmentIndex || 0
                ),
                connected: true,
                explicitGuidedTarget: true,
                distanceClient
              };
            }
          }
        }
        let proposal = null;
        if (snapshot.socket && startEndpoint) {
          const tested = connectionProposal(
            startEndpoint,
            snapshot.socket,
            graph.connections
          );
          proposal = {
            targetKind: "socket",
            valid: tested.valid === true,
            reason: tested.reason || "",
            candidateConnectionId:
              tested.candidate?.id || ""
          };
        } else if (
          snapshot.wire &&
          startEndpoint?.direction === "input"
        ) {
          const parent = graphConnectionById(
            snapshot.wire.connectionId
          );
          const tested = parent
            ? connectionProposal(
                sourceSocketRefForConnection(parent),
                startEndpoint,
                graph.connections
              )
            : null;
          proposal = {
            targetKind: "wire",
            parentFound: Boolean(parent),
            valid: tested?.valid === true,
            reason:
              tested?.reason ||
              (parent ? "" : "The parent wire is missing."),
            candidateConnectionId:
              tested?.candidate?.id || ""
          };
        }
        return {
          snapshot,
          proposal,
          activeInteraction:
            activeInteraction?.kind === "connection"
              ? {
                  kind: activeInteraction.kind,
                  pointerId: activeInteraction.pointerId,
                  start: { ...activeInteraction.start },
                  originalStart: {
                    ...activeInteraction.originalStart
                  }
                }
              : null
        };
      },
      isReady() {
        return Boolean(
          graph &&
          Array.isArray(graph.nodes) &&
          Array.isArray(graph.connections)
        );
      },
      ensureActiveMode(options = {}) {
        let documentChanged = false;
        if (graph?.active !== true) {
          if (options.activateIfNeeded !== true) {
            return {
              ok: false,
              reason: "The Runtime Graph product state is not active."
            };
          }
          const snapshot = snapshotFromBuilder();
          graph.active = true;
          graph.configSnapshot = snapshot;
          graph.sourceSignature = snapshotSignature(snapshot);
          if (Array.isArray(snapshot.nodes) && snapshot.nodes.length > 0) {
            ensureConfigurationNode();
          }
          pruneConnections();
          documentChanged = true;
        }
        commitGraphDocumentMutationIfChanged(
          documentChanged,
          {
            refreshGeneratedOutput: true,
            refreshCompositeActions: true,
            mutationClass: "topology"
          }
        );
        commitPresentationPage(
          "runtime-graph",
          "runtime-graph-api-open"
        );
        persistGraphView(true);
        activateGraphMode();
        return {
          ok: document.body.classList.contains(
            "rml-node-graph-mode"
          ),
          graphActive: graph.active === true,
          graphViewActive:
            runtimeGraphViewActive === true,
          documentMutationAccepted:
            documentChanged === true
        };
      },
      showConfigurationOutline() {
        if (graph?.active !== true) {
          return {
            ok: false,
            reason: "The Runtime Graph product state is not active."
          };
        }
        unpackToOutline();
        return {
          ok: true,
          graphActive:
            graph.active === true,
          graphViewActive:
            runtimeGraphViewActive === true
        };
      },
      getPresentationState() {
        const renderBlocked = graphSvgViewBlocked();
        return Object.freeze({
          graphExportActive:
            graph?.active === true,
          graphViewActive:
            runtimeGraphViewActive === true,
          viewReady: graphViewPreparationCurrent() && !graphViewPreparation?.pending &&
            dom.root?.dataset.rmlGraphPhase === "ready",
          viewFailed:
            dom.root?.dataset
              .rmlGraphPhase === "failed",
          viewError:
            String(
              graphViewPreparation?.error ||
              ""
            ),
          renderBlocked,
          renderingBlocked: renderBlocked,
          renderingBlockReason: renderBlocked ? "svg-capacity" : "",
          preparing: graphViewPreparing(),
          savedPage:
            savedPresentationPage(),
          page:
            runtimeGraphViewActive
              ? "runtime-graph"
              : "configuration-outline"
        });
      },
      getOperatorPlacementMetrics(operatorId) {
        const definition =
          OPERATOR_DEFINITIONS[operatorId];
        if (!definition) {
          return {
            ok: false,
            operatorId,
            reason: `Unknown operator: ${operatorId}`
          };
        }
        const scale = nodeGraphClamp(
          finiteNumber(graph?.viewport?.scale, 1),
          GRAPH_MIN_ZOOM,
          GRAPH_MAX_ZOOM
        );
        const width = definition.width || 280;
        const height = 190;
        const pointerOffsetX =
          GRAPH_PALETTE_POINTER_OFFSET_X;
        const pointerOffsetY =
          GRAPH_PALETTE_POINTER_OFFSET_Y;
        return {
          ok: true,
          operatorId,
          width,
          height,
          pointerOffsetX,
          pointerOffsetY,
          scale,
          clientWidth: width * scale,
          clientHeight: height * scale,
          clientPointerOffsetX:
            pointerOffsetX * scale,
          clientPointerOffsetY:
            pointerOffsetY * scale
        };
      },
      previewConfigurationImpulse(
        outlineNodeId
      ) {
        return previewConfigurationImpulse(
          outlineNodeId
        );
      },
      previewConfigurationPhase(
        phase,
        outlineNodeId = ""
      ) {
        return previewConfigurationPhase(
          phase,
          outlineNodeId
        );
      },
      setGuidedAutomaticNodeCreationSuppressed(
        value
      ) {
        guidedAutomaticNodeCreationSuppressed =
          value === true;
        return guidedAutomaticNodeCreationSuppressed;
      },
      setGuidedAutoPanSuppressed(value) {
        guidedInteractionAutoPanSuppressed =
          value === true;
        if (guidedInteractionAutoPanSuppressed) {
          lastGuidedPaletteDropState = null;
        }
        if (guidedInteractionAutoPanSuppressed) {
          stopAutoPan();
        }
        return guidedInteractionAutoPanSuppressed;
      },
      ensureOperatorNode(
        operatorId,
        options = {}
      ) {
        const existing =
          graph?.nodes?.find(
            node =>
              node.kind === "operator" &&
              node.operatorId === operatorId
          ) || null;

        if (
          existing &&
          options.allowDuplicate !== true
        ) {
          return {
            ok: true,
            created: false,
            nodeId: existing.id
          };
        }

        if (!OPERATOR_DEFINITIONS[operatorId]) {
          return {
            ok: false,
            created: false,
            nodeId: "",
            reason: `Unknown operator: ${operatorId}`
          };
        }

        const viewportRect =
          dom.viewport?.getBoundingClientRect();
        const center = viewportRect
          ? clientToGraph(
              viewportRect.left + viewportRect.width / 2,
              viewportRect.top + viewportRect.height / 2
            )
          : { x: 0, y: 0 };
        const node = addOperatorNode(
          operatorId,
          Number.isFinite(options.x)
            ? options.x
            : center.x - 140,
          Number.isFinite(options.y)
            ? options.y
            : center.y - 90,
          false
        );

        return node
          ? {
              ok: true,
              created: true,
              nodeId: node.id
            }
          : {
              ok: false,
              created: false,
              nodeId: "",
              reason: `Could not create operator: ${operatorId}`
            };
      },
      ensureConnection(first, second) {
        const normalizeEndpoint = endpoint => {
          const node = findGraphNode(endpoint?.nodeId);
          if (!node || !endpoint?.portId || !endpoint?.direction) {
            return null;
          }
          const reference = graphPortReference(
            node,
            endpoint.portId,
            endpoint.direction
          );
          return {
            ...reference,
            ...endpoint,
            side:
              endpoint.side ||
              reference.side
          };
        };
        const a = normalizeEndpoint(first);
        const b = normalizeEndpoint(second);

        if (!a || !b) {
          return {
            ok: false,
            created: false,
            connectionId: "",
            reason: "A graph endpoint is missing."
          };
        }

        const output =
          a.direction === "output" ? a : b;
        const input =
          a.direction === "input" ? a : b;
        const existing =
          graph.connections.find(
            connection =>
              connection.fromNode === output.nodeId &&
              connection.fromPort === output.portId &&
              connection.toNode === input.nodeId &&
              connection.toPort === input.portId
          ) || null;

        if (existing) {
          return {
            ok: true,
            created: false,
            connectionId: existing.id
          };
        }

        const previousConnections =
          graph.connections;
        const replacedInputConnection =
          previousConnections.find(
            connection =>
              connection.toNode ===
                input.nodeId &&
              connection.toPort ===
                input.portId
          ) || null;
        const previousSelection =
          graphMutationSelectionSnapshot();
        const previousAnalysis =
          currentAnalysis;
        ensureGraphConnectionLookups();

        const proposal = connectionProposal(
          a,
          b,
          graph.connections
        );

        if (!proposal.valid) {
          return {
            ok: false,
            created: false,
            connectionId: "",
            reason: proposal.reason
          };
        }

        const autoVectorNodeIds = new Set(
          proposal.autoVectorUpdates instanceof Map
            ? [...proposal.autoVectorUpdates]
                .filter(([nodeId, type]) =>
                  findGraphNode(nodeId)
                    ?.parameters
                    ?.autoVectorType !== type
                )
                .map(([nodeId]) => nodeId)
            : []
        );
        applyAutoVectorUpdates(
          proposal.autoVectorUpdates
        );
        const appendedWithoutReplacement =
          proposal.nextConnections.length ===
          previousConnections.length + 1;
        if (appendedWithoutReplacement) {
          proposal.candidate.points = [];
          proposal.candidate.branchFrom = null;
          previousConnections.push(
            proposal.candidate
          );
        } else {
          graph.connections =
            proposal.nextConnections;
          normalizeConnectionRouting(
            graph.connections
          );
        }
        graph.selectedConnectionId =
          proposal.candidate.id;
        graph.selectedNodeId = null;
        graph.selectedNodeIds = [];
        clearSelectedWirePoint();
        currentAnalysis = proposal.analysis;
        const contentNodeIds =
          graphAnalysisChangedBindingNodeIds(
            previousAnalysis,
            currentAnalysis
          );
        contentNodeIds.add(output.nodeId);
        contentNodeIds.add(input.nodeId);
        for (const nodeId of
          autoVectorNodeIds) {
          contentNodeIds.add(nodeId);
        }
        const affectedConnectionIds =
          new Set(
            previousSelection.connectionIds
          );
        addCachedIncidentConnectionIds(
          affectedConnectionIds,
          contentNodeIds
        );
        affectedConnectionIds.add(
          proposal.candidate.id
        );
        if (replacedInputConnection) {
          affectedConnectionIds.add(
            replacedInputConnection.id
          );
        }
        renderGraphMutationDelta({
          nodeIds:
            previousSelection.nodeIds,
          nodeContentIds: contentNodeIds,
          connectionIds:
            affectedConnectionIds
        });
        renderGraphInspector();
        commitAcceptedGraphDocumentMutation({
          refreshGeneratedOutput: true,
          refreshCompositeActions: true,
          mutationClass: "topology"
        });

        return {
          ok: true,
          created: true,
          connectionId:
            proposal.candidate.id
        };
      },
      ensureBranch(
        parentConnectionId,
        inputEndpoint,
        clientX,
        clientY,
        preferredSegmentIndex = null
      ) {
        const parent =
          graphConnectionById(
            parentConnectionId
          );
        const targetNode =
          findGraphNode(
            inputEndpoint?.nodeId
          );
        if (
          !parent ||
          !targetNode ||
          inputEndpoint?.direction !== "input"
        ) {
          return {
            ok: false,
            reason: "The parent wire or branch input is missing."
          };
        }
        const targetReference =
          graphPortReference(
            targetNode,
            inputEndpoint.portId,
            "input"
          );
        const target = {
          ...targetReference,
          ...inputEndpoint,
          direction: "input",
          side:
            inputEndpoint.side ||
            targetReference.side
        };
        const existing =
          graph.connections.find(
            connection =>
              connection.toNode === target.nodeId &&
              connection.toPort === target.portId &&
              connection.branchFrom
                ?.connectionId === parent.id
          ) || null;
        if (existing) {
          return {
            ok: true,
            created: false,
            connectionId: existing.id,
            pointId:
              existing.branchFrom?.pointId || ""
          };
        }

        const previousConnections =
          graph.connections;
        const replacedInputConnection =
          previousConnections.find(
            connection =>
              connection.toNode ===
                target.nodeId &&
              connection.toPort ===
                target.portId
          ) || null;
        const previousSelection =
          graphMutationSelectionSnapshot();
        const previousAnalysis =
          currentAnalysis;

        const proposal = connectionProposal(
          sourceSocketRefForConnection(parent),
          target,
          graph.connections
        );
        if (!proposal.valid) {
          return {
            ok: false,
            reason: proposal.reason
          };
        }

        const allPaths = [
          ...dom.wires?.querySelectorAll(
            `.rml-graph-wire-hit[data-connection-id="${CSS.escape(parent.id)}"]`
          ) || []
        ].filter(path =>
          path.isConnected &&
          dom.wires?.contains(path)
        );
        const normalizedPreferredSegment =
          Number.isInteger(preferredSegmentIndex)
            ? Math.max(0, preferredSegmentIndex)
            : null;
        const preferredPaths =
          normalizedPreferredSegment === null
            ? []
            : allPaths.filter(path =>
                Math.max(
                  0,
                  Math.trunc(
                    finiteNumber(
                      path.dataset.segmentIndex,
                      0
                    )
                  )
                ) === normalizedPreferredSegment
              );
        const paths = preferredPaths.length
          ? preferredPaths
          : allPaths;
        const targetPosition =
          clientToGraph(
            finiteNumber(clientX, 0),
            finiteNumber(clientY, 0)
          );
        const nearestSegment = paths
          .map(path => {
            const position =
              nearestGraphPointOnSvgPath(
                path,
                finiteNumber(clientX, 0),
                finiteNumber(clientY, 0)
              );
            return {
              path,
              position,
              distance: Math.hypot(
                position.x - targetPosition.x,
                position.y - targetPosition.y
              )
            };
          })
          .sort((a, b) =>
            a.distance - b.distance
          )[0] || null;
        const segmentDistance =
          nearestSegment?.distance ?? null;
        const segmentDistanceClient =
          Number.isFinite(segmentDistance)
            ? segmentDistance * Math.max(
                .001,
                finiteNumber(
                  graph.viewport.scale,
                  1
                )
              )
            : null;
        const viewportRectangle =
          dom.viewport?.getBoundingClientRect();
        const targetInsideViewport = Boolean(
          viewportRectangle &&
          clientX >= viewportRectangle.left &&
          clientX <= viewportRectangle.right &&
          clientY >= viewportRectangle.top &&
          clientY <= viewportRectangle.bottom
        );
        if (
          !nearestSegment ||
          !nearestSegment.path?.isConnected ||
          targetInsideViewport !== true ||
          !Number.isFinite(segmentDistanceClient) ||
          segmentDistanceClient > 12
        ) {
          return {
            ok: false,
            created: false,
            connectionId: "",
            reason:
              "The deterministic branch target is not on a live visible segment of the parent wire.",
            preferredSegmentIndex:
              normalizedPreferredSegment,
            segmentIndex:
              nearestSegment?.path
                ? Math.max(
                    0,
                    Math.trunc(
                      finiteNumber(
                        nearestSegment.path.dataset.segmentIndex,
                        0
                      )
                    )
                  )
                : null,
            segmentDistance,
            segmentDistanceClient,
            targetInsideViewport
          };
        }
        const path = nearestSegment?.path || null;
        const segmentIndex = Math.max(
          0,
          Math.trunc(
            finiteNumber(
              path?.dataset.segmentIndex,
              0
            )
          )
        );
        const position =
          nearestSegment?.position ||
          targetPosition;
        const junction =
          ensureWireJunctionPoint(
            parent,
            segmentIndex,
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
            ok: false,
            reason: "The typed branch record was not created."
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
        const autoVectorNodeIds = new Set(
          proposal.autoVectorUpdates instanceof Map
            ? [...proposal.autoVectorUpdates]
                .filter(([nodeId, type]) =>
                  findGraphNode(nodeId)
                    ?.parameters
                    ?.autoVectorType !== type
                )
                .map(([nodeId]) => nodeId)
            : []
        );
        applyAutoVectorUpdates(
          proposal.autoVectorUpdates
        );
        const appendedWithoutReplacement =
          proposal.nextConnections.length ===
          previousConnections.length + 1;
        if (appendedWithoutReplacement) {
          previousConnections.push(branch);
        } else {
          graph.connections =
            proposal.nextConnections;
          normalizeConnectionRouting(
            graph.connections
          );
        }
        graph.selectedConnectionId =
          branch.id;
        graph.selectedNodeId = null;
        graph.selectedNodeIds = [];
        clearSelectedWirePoint();
        currentAnalysis = proposal.analysis;
        const contentNodeIds =
          graphAnalysisChangedBindingNodeIds(
            previousAnalysis,
            currentAnalysis
          );
        contentNodeIds.add(parent.fromNode);
        contentNodeIds.add(target.nodeId);
        for (const nodeId of
          autoVectorNodeIds) {
          contentNodeIds.add(nodeId);
        }
        const affectedConnectionIds =
          new Set(
            previousSelection.connectionIds
          );
        addCachedIncidentConnectionIds(
          affectedConnectionIds,
          contentNodeIds
        );
        for (const connectionId of
          relatedGraphConnectionIds(
            parent.id
          )) {
          affectedConnectionIds.add(
            connectionId
          );
        }
        affectedConnectionIds.add(branch.id);
        if (replacedInputConnection) {
          affectedConnectionIds.add(
            replacedInputConnection.id
          );
        }
        renderGraphMutationDelta({
          nodeIds:
            previousSelection.nodeIds,
          nodeContentIds: contentNodeIds,
          connectionIds:
            affectedConnectionIds
        });
        renderGraphInspector();
        commitAcceptedGraphDocumentMutation({
          refreshGeneratedOutput: true,
          refreshCompositeActions: true,
          mutationClass: "topology"
        });
        return {
          ok: true,
          created: true,
          connectionId: branch.id,
          pointId: junction.id,
          segmentIndex,
          segmentDistance,
          segmentDistanceClient,
          preferredSegmentIndex:
            normalizedPreferredSegment
        };
      },
      ensureWirePoint(
        connectionId,
        clientX,
        clientY
      ) {
        const connection =
          graphConnectionById(connectionId);
        if (!connection) {
          return {
            ok: false,
            reason: "The wire no longer exists."
          };
        }
        const path =
          dom.wires?.querySelector(
            `.rml-graph-wire-hit[data-connection-id="${CSS.escape(connectionId)}"]`
          ) || null;
        const position =
          nearestGraphPointOnSvgPath(
            path,
            finiteNumber(clientX, 0),
            finiteNumber(clientY, 0)
          );
        const point = insertWirePoint(
          connection,
          Math.max(
            0,
            Math.trunc(
              finiteNumber(
                path?.dataset.segmentIndex,
                connection.points?.length || 0
              )
            )
          ),
          position
        );
        graph.selectedNodeId = null;
        graph.selectedNodeIds = [];
        graph.selectedConnectionId =
          connection.id;
        graph.selectedWirePoint = {
          connectionId: connection.id,
          pointId: point.id
        };
        renderGraphWireConnectionsImmediately(
          relatedGraphConnectionIds(
            connection.id
          )
        );
        renderGraphInspector();
        commitAcceptedGraphDocumentMutation({
          refreshGeneratedOutput: false,
          refreshCompositeActions: false,
          mutationClass: "geometry"
        });
        return {
          ok: true,
          pointId: point.id
        };
      },
      setWirePointClientPosition(
        connectionId,
        pointId,
        clientX,
        clientY
      ) {
        const connection =
          graphConnectionById(connectionId);
        const point = wirePointById(
          connection,
          pointId
        );
        if (!connection || !point) {
          return {
            ok: false,
            reason: "The requested real wire point no longer exists."
          };
        }
        const position = clientToGraph(
          finiteNumber(clientX, 0),
          finiteNumber(clientY, 0)
        );
        const nextPointX = nodeGraphClamp(
          Math.round(position.x / GRAPH_WIRE_POINT_SNAP) *
            GRAPH_WIRE_POINT_SNAP,
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        );
        const nextPointY = nodeGraphClamp(
          Math.round(position.y / GRAPH_WIRE_POINT_SNAP) *
            GRAPH_WIRE_POINT_SNAP,
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        );
        const geometryChanged =
          point.x !== nextPointX ||
          point.y !== nextPointY;
        const selectionChanged =
          graph.selectedNodeId !== null ||
          (graph.selectedNodeIds || []).length > 0 ||
          graph.selectedConnectionId !== connection.id ||
          graph.selectedWirePoint?.connectionId !==
            connection.id ||
          graph.selectedWirePoint?.pointId !== point.id;
        if (geometryChanged) {
          point.x = nextPointX;
          point.y = nextPointY;
        }
        graph.selectedNodeId = null;
        graph.selectedNodeIds = [];
        graph.selectedConnectionId = connection.id;
        graph.selectedWirePoint = {
          connectionId: connection.id,
          pointId: point.id
        };
        if (geometryChanged || selectionChanged) {
          renderGraphWireConnectionsImmediately(
            relatedGraphConnectionIds(
              connection.id
            )
          );
          renderGraphInspector();
        }
        commitGraphDocumentMutationIfChanged(
          geometryChanged,
          {
            refreshGeneratedOutput: false,
            refreshCompositeActions: false,
            mutationClass: "geometry",
            persistViewWhenUnchanged:
              selectionChanged
          }
        );
        return {
          ok: true,
          connectionId: connection.id,
          pointId: point.id,
          graphPosition: {
            x: point.x,
            y: point.y
          },
          requestedClientPosition: {
            x: finiteNumber(clientX, 0),
            y: finiteNumber(clientY, 0)
          },
          changed: geometryChanged
        };
      },
      ensureAutomaticHelper(
        endpoint,
        clientX,
        clientY
      ) {
        const node =
          findGraphNode(endpoint?.nodeId);
        if (
          !node ||
          !endpoint?.portId ||
          !endpoint?.direction
        ) {
          return {
            ok: false,
            reason: "The helper endpoint is missing."
          };
        }

        const start = {
          ...graphPortReference(
            node,
            endpoint.portId,
            endpoint.direction
          ),
          ...endpoint
        };
        const portRef = findPortSpec(
          start.nodeId,
          start.portId,
          start.direction
        );
        const previousSelection =
          graphMutationSelectionSnapshot();
        const previousAnalysis =
          currentAnalysis;
        ensureGraphConnectionLookups();
        const interaction = {
          kind: "connection",
          start,
          originalStart: start,
          startType:
            resolvePortType(
              portRef,
              currentAnalysis?.bindings || new Map()
            ) ||
            fallbackConcreteTypeForPort(portRef)
        };
        const result =
          start.direction === "input"
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

        if (!result.connected) {
          return {
            ok: false,
            reason: result.reason ||
              "The typed helper could not be created."
          };
        }

        const contentNodeIds =
          graphAnalysisChangedBindingNodeIds(
            previousAnalysis,
            currentAnalysis
          );
        contentNodeIds.add(start.nodeId);
        if (result.node?.id) {
          contentNodeIds.add(result.node.id);
        }
        for (const nodeId of
          result.autoVectorNodeIds || []) {
          contentNodeIds.add(nodeId);
        }
        const affectedConnectionIds =
          new Set(
            previousSelection.connectionIds
          );
        addCachedIncidentConnectionIds(
          affectedConnectionIds,
          contentNodeIds
        );
        if (result.connection?.id) {
          affectedConnectionIds.add(
            result.connection.id
          );
        }
        renderGraphMutationDelta({
          nodeIds:
            previousSelection.nodeIds,
          nodeContentIds: contentNodeIds,
          connectionIds:
            affectedConnectionIds
        });
        renderGraphInspector();
        commitAcceptedGraphDocumentMutation({
          refreshGeneratedOutput: true,
          refreshCompositeActions: true,
          mutationClass: "topology"
        });
        return {
          ok: true,
          nodeId: result.node?.id || "",
          message: result.message || ""
        };
      },
      setNodeClientCenter(nodeId, clientX, clientY) {
        const node = findGraphNode(nodeId);
        if (!node || !dom.viewport) {
          return {
            ok: false,
            reason: "The graph node or viewport is unavailable."
          };
        }
        const point = clientToGraph(
          finiteNumber(clientX, 0),
          finiteNumber(clientY, 0)
        );
        const element =
          dom.nodesHost?.querySelector(
            `[data-graph-node-id="${CSS.escape(node.id)}"]`
          );
        const width =
          element?.offsetWidth ||
          (node.kind === "configuration" ? 390 : 280);
        const height =
          element?.offsetHeight || 180;
        const nextNodeX = point.x - width / 2;
        const nextNodeY = point.y - height / 2;
        const positionChanged =
          node.x !== nextNodeX ||
          node.y !== nextNodeY;
        if (positionChanged) {
          node.x = nextNodeX;
          node.y = nextNodeY;
          renderGraphMutationDelta({
            nodeIds: [node.id],
            connectionIds:
              incidentGraphConnectionIds(
                node.id
              )
          });
          renderGraphInspector();
        }
        commitGraphDocumentMutationIfChanged(
          positionChanged,
          {
            refreshGeneratedOutput: false,
            refreshCompositeActions: false,
            mutationClass: "geometry"
          }
        );
        return {
          ok: true,
          nodeId: node.id,
          x: node.x,
          y: node.y,
          changed: positionChanged
        };
      },
      setNodePosition(nodeId, x, y) {
        const node = findGraphNode(nodeId);
        if (!node) {
          return {
            ok: false,
            reason: "The graph node is unavailable."
          };
        }
        const nextNodeX = finiteNumber(x, node.x);
        const nextNodeY = finiteNumber(y, node.y);
        const positionChanged =
          node.x !== nextNodeX ||
          node.y !== nextNodeY;
        if (positionChanged) {
          node.x = nextNodeX;
          node.y = nextNodeY;
          renderGraphMutationDelta({
            nodeIds: [node.id],
            connectionIds:
              incidentGraphConnectionIds(
                node.id
              )
          });
          renderGraphInspector();
        }
        commitGraphDocumentMutationIfChanged(
          positionChanged,
          {
            refreshGeneratedOutput: false,
            refreshCompositeActions: false,
            mutationClass: "geometry"
          }
        );
        return {
          ok: true,
          nodeId: node.id,
          x: node.x,
          y: node.y,
          changed: positionChanged
        };
      },
      setNodePortLayout(nodeId, layout) {
        const node = findGraphNode(nodeId);
        const definition = node
          ? nodeDefinition(node)
          : null;
        if (
          !node ||
          !definitionHasSockets(definition)
        ) {
          return {
            ok: false,
            reason: "This node has no switchable sockets."
          };
        }
        const nextPortLayout =
          layout === "mirrored"
            ? "mirrored"
            : "standard";
        const layoutChanged =
          node.parameters?.portLayout !==
          nextPortLayout;
        if (layoutChanged) {
          node.parameters =
            node.parameters || {};
          node.parameters.portLayout =
            nextPortLayout;
          renderGraphMutationDelta({
            nodeContentIds: [node.id],
            connectionIds:
              incidentGraphConnectionIds(
                node.id
              )
          });
          renderGraphInspector();
        }
        commitGraphDocumentMutationIfChanged(
          layoutChanged,
          {
            refreshGeneratedOutput: true,
            refreshCompositeActions: true,
            mutationClass: "parameter"
          }
        );
        return {
          ok: true,
          layout: node.parameters?.portLayout ||
            nextPortLayout,
          changed: layoutChanged
        };
      },
      fitNodesToClientRect(
        nodeIds,
        requestedRect,
        options = {}
      ) {
        if (!dom.viewport) {
          return {
            ok: false,
            reason: "The graph viewport is unavailable."
          };
        }
        const ids = new Set(
          Array.isArray(nodeIds)
            ? nodeIds.filter(Boolean)
            : []
        );
        const nodes = graph.nodes.filter(
          node => ids.size === 0 || ids.has(node.id)
        );
        if (nodes.length === 0) {
          return {
            ok: false,
            reason: "No teaching nodes are available."
          };
        }

        let minimumX = Infinity;
        let minimumY = Infinity;
        let maximumX = -Infinity;
        let maximumY = -Infinity;
        for (const node of nodes) {
          const element =
            dom.nodesHost?.querySelector(
              `[data-graph-node-id="${CSS.escape(node.id)}"]`
            );
          const width =
            element?.offsetWidth ||
            (node.kind === "configuration" ? 390 : 280);
          const height =
            element?.offsetHeight || 180;
          minimumX = Math.min(minimumX, node.x);
          minimumY = Math.min(minimumY, node.y);
          maximumX = Math.max(maximumX, node.x + width);
          maximumY = Math.max(maximumY, node.y + height);
        }

        const viewportRect =
          dom.viewport.getBoundingClientRect();
        const left = nodeGraphClamp(
          finiteNumber(
            requestedRect?.left,
            viewportRect.left
          ),
          viewportRect.left,
          viewportRect.right
        );
        const top = nodeGraphClamp(
          finiteNumber(
            requestedRect?.top,
            viewportRect.top
          ),
          viewportRect.top,
          viewportRect.bottom
        );
        const right = nodeGraphClamp(
          finiteNumber(
            requestedRect?.right,
            viewportRect.right
          ),
          left,
          viewportRect.right
        );
        const bottom = nodeGraphClamp(
          finiteNumber(
            requestedRect?.bottom,
            viewportRect.bottom
          ),
          top,
          viewportRect.bottom
        );
        const padding = Math.max(
          8,
          finiteNumber(options.padding, 34)
        );
        const areaWidth = Math.max(1, right - left);
        const areaHeight = Math.max(1, bottom - top);
        const contentWidth = Math.max(1, maximumX - minimumX);
        const contentHeight = Math.max(1, maximumY - minimumY);
        const scale = nodeGraphClamp(
          Math.min(
            Math.max(1, areaWidth - padding * 2) / contentWidth,
            Math.max(1, areaHeight - padding * 2) / contentHeight,
            finiteNumber(options.maxScale, 1.08)
          ),
          GRAPH_MIN_ZOOM,
          GRAPH_MAX_ZOOM
        );

        const fittedViewport = {
          scale,
          x:
          left - viewportRect.left +
          (areaWidth - contentWidth * scale) / 2 -
          minimumX * scale,
          y:
          top - viewportRect.top +
          (areaHeight - contentHeight * scale) / 2 -
          minimumY * scale
        };

        if (options.apply === false) {
          return {
            ok: true,
            applied: false,
            scale,
            viewport: fittedViewport
          };
        }

        graph.viewport.scale = fittedViewport.scale;
        graph.viewport.x = fittedViewport.x;
        graph.viewport.y = fittedViewport.y;
        applyViewportTransform();
        renderGraphWires();
        persistGraphView(true);

        return {
          ok: true,
          applied: true,
          scale,
          viewport: { ...graph.viewport }
        };
      },
      setViewportState(
        requestedViewport,
        options = {}
      ) {
        if (!dom.viewport || !requestedViewport) {
          return {
            ok: false,
            reason: "The graph viewport is unavailable."
          };
        }
        graph.viewport.x = finiteNumber(
          requestedViewport.x,
          graph.viewport.x
        );
        graph.viewport.y = finiteNumber(
          requestedViewport.y,
          graph.viewport.y
        );
        graph.viewport.scale = nodeGraphClamp(
          finiteNumber(
            requestedViewport.scale,
            graph.viewport.scale
          ),
          GRAPH_MIN_ZOOM,
          GRAPH_MAX_ZOOM
        );
        applyViewportTransform();
        renderGraphWires();
        if (options.persist !== false) {
          persistGraphView(true);
        }
        return {
          ok: true,
          viewport: { ...graph.viewport }
        };
      },
      getViewportState() {
        const rectangle =
          dom.viewport?.getBoundingClientRect();
        return {
          viewport: graph?.viewport
            ? { ...graph.viewport }
            : null,
          rectangle: rectangle
            ? {
                left: rectangle.left,
                top: rectangle.top,
                right: rectangle.right,
                bottom: rectangle.bottom,
                width: rectangle.width,
                height: rectangle.height
              }
            : null
        };
      },
      getLayoutConstraints() {
        return Object.freeze({
          zoom: Object.freeze({
            available: true,
            minimum: GRAPH_MIN_ZOOM,
            maximum: GRAPH_MAX_ZOOM,
            current: nodeGraphClamp(
              finiteNumber(graph?.viewport?.scale, 1),
              GRAPH_MIN_ZOOM,
              GRAPH_MAX_ZOOM
            )
          }),
          node: Object.freeze({
            minimumWidth: GRAPH_NODE_MIN_WIDTH,
            minimumHeight: GRAPH_NODE_MIN_HEIGHT,
            minimumBodyHeight: GRAPH_NODE_MIN_BODY_HEIGHT,
            maximumWidth: GRAPH_NODE_MAX_WIDTH,
            maximumHeight: GRAPH_NODE_MAX_HEIGHT
          }),
          stage: Object.freeze({
            width: GRAPH_STAGE_WIDTH,
            height: GRAPH_STAGE_HEIGHT
          })
        });
      },
      commit(options = {}) {
        try { window.normalizeGraph?.(); } catch {}
        try { window.normalizeState?.(); } catch {}
        try { window.render?.(); } catch {}
        try { window.renderGraph?.(); } catch {}
        try { window.scheduleRender?.(); } catch {}
        try { window.save?.(); } catch {}
        try { window.saveState?.(); } catch {}
        try {
          commitGraphDocumentMutationIfChanged(
            options.documentChanged === true,
            {
              refreshGeneratedOutput:
                options.refreshGeneratedOutput !== false,
              refreshCompositeActions:
                options.refreshCompositeActions !== false,
              mutationClass:
                options.mutationClass || "topology",
              analysisChanged:
                options.analysisChanged == null
                  ? null
                  : options.analysisChanged === true,
              persistViewWhenUnchanged:
                options.persistViewWhenUnchanged === true
            }
          );
        } catch {}
        try { window.emitChange?.(); } catch {}
        window.dispatchEvent(new CustomEvent("rml-dynamic-graph-commit"));
      }
    }),
    writable: false,
    enumerable: false,
    configurable: true
  });
