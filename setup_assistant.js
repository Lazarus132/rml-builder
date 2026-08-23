(() => {
  "use strict";

  const SCRIPT_BASE = document.currentScript?.src || window.location.href;
  const TEMPLATE_URL = new URL("setup_template.html?v=132-no-small-viewport-warning-v347f1", SCRIPT_BASE).href;
  const TEMPLATE_SCRIPT_URL = new URL("setup_template.js?v=132-no-small-viewport-warning-v347f1", SCRIPT_BASE).href;
  let templatePromise = null;
  let snapshot = null;
  let snapshotFingerprint = "";
  let stepSnapshots = new Map();
  let stepEnvironmentSnapshots = new Map();
  let stepReadySnapshots = new Map();
  let stepReadyEnvironmentSnapshots = new Map();
  let originalTourUiState = null;
  let stepIndex = 0;
  let currentTarget = null;
  let firstRunSession = false;
  let demoRunId = 0;
  let demoTimers = [];
  let stepPhase = "explain";
  let demoInFlight = false;
  let repeatPreviousInFlight = false;
  let controlledRepeatCount = 0;
  let restoreInFlight = false;
  let tourResizeObserver = null;
  let modalSurfaceState = null;
  let activeSemanticScene = null;
  let autoAdvanceTimer = 0;
  let narrationOutlineGroups = [];
  let activeNarrationTargets = [];
  let narrationAdvanceWaiters = new Set();
  let pendingNarrationAdvances = 0;
  let narrationCardMetrics = null;
  let narrationReadingMetrics = null;
  let narrationReservedRevealRect = null;
  let graphInspectorToggleVisibilityState = null;
  let stableTourViewport = null;
  let outlineNestedPreparationHelperIds = [];
  let startPromise = null;
  let mobileTopbarPreparedForNarration = false;
  let mobilePackPreparedForNarration = false;
  let outlineNestedTransactionSerial = 0;
  let graphPaletteRevealState = null;
  let graphCreateNodePreparedDropPlan = null;
  let graphTeachingSceneHandoff = null;
  let graphStep11LastWireTargetCandidates = [];
  let graphStep11ActiveStage = "idle";
  let graphStep11LastStageData = {};
  let graphStep11RunStartedAt = 0;
  let graphStep11LastFailureSnapshot = null;
  const tourInteractionCapabilities = new Map();
  const enteredStepIndexes = new Set();
  const narratedStepIndexes = new Set();
  const attemptedDemonstrationIndexes = new Set();
  let blockedRepeatCount = 0;
  let teacherMouseSafetyState = null;

  const LIVE_CONTROLS_ACTIVE_OBSTACLE_ATTRIBUTE =
    "data-rml-tour-active-obstacle";

  const TOUR_DEBUG_LIMIT = 5000;
  const TOUR_CONSTRAINT_EPSILON = .5;
  const TOUR_MIN_READABLE_GRAPH_TEXT_PX = 8.5;
  const TOUR_LAYOUT_ASSERTION_PROFILES = Object.freeze({
    "outline-reorder-native-line-never-crossed-controls": "outline-marker-corridor",
    "outline-reorder-release-line-clear-of-controls": "outline-marker-corridor",
    "outline-nested-native-line-never-crossed-controls": "outline-marker-corridor",
    "graph-create-node-full-footprint-reserved-before-pointerdown": "graph-create-node",
    "graph-create-node-committed-rect-live-repair-complete": "graph-create-node",
    "graph-create-node-created-rect-entirely-inside-graph": "graph-create-node",
    "graph-create-node-complete-footprint-prepared-before-narration": "graph-create-node"
  });
  const TOUR_LAYOUT_ERROR_PROFILES = Object.freeze(new Map([
    [
      "[RML Tour · Preparation] No complete visible NOT-node rectangle could be reserved before Step 7 narration.",
      "graph-create-node"
    ],
    [
      "Step 7 lost its complete reserved NOT-node rectangle before Demonstrate.",
      "graph-create-node"
    ],
    [
      "Step 7 could not reserve the complete NOT-node rectangle after the real library panel opened.",
      "graph-create-node"
    ],
    [
      "The created graph node could not be kept completely inside the visible viewport.",
      "graph-create-node"
    ],
    [
      "Preparation could not fit the complete teaching scene into the visible graph area.",
      "graph-teaching-pair"
    ],
    [
      "Step 7 completed its node drag, but did not leave the exact complete Start → NOT composition required as Step 8's opening frame.",
      "graph-teaching-pair"
    ]
  ]));
  const tourConstraintState = {
    certificates: [],
    handledCount: 0,
    rejectedCount: 0
  };
  const tourDebugState = {
    build: "stable-tour-step11-post-drop-separation-20260823-v353f1",
    events: [],
    assertions: []
  };
  function tourFinitePositive(value) {
    const number = Number(value);
    return Number.isFinite(number) && number > 0 ? number : null;
  }

  function strictLayoutConstraintCertificate(proof = {}) {
    if (proof?.category !== "layout") return null;
    const availableWidth = tourFinitePositive(proof.available?.width);
    const availableHeight = tourFinitePositive(proof.available?.height);
    if (!availableWidth || !availableHeight) return null;
    if (proof.mode === "corridor") {
      if (proof.zoom?.available !== false) return null;
      const orientation = proof.corridor?.orientation;
      const thickness = tourFinitePositive(proof.corridor?.minimumThickness);
      const clearance = Math.max(
        0,
        Number(proof.corridor?.minimumClearance) || 0
      );
      const padding = Math.max(0, Number(proof.padding) || 0);
      const bandLength = orientation === "horizontal"
        ? availableHeight
        : orientation === "vertical"
          ? availableWidth
          : null;
      const obstacles = Array.isArray(proof.corridor?.obstacles)
        ? proof.corridor.obstacles.map((obstacle, index) => ({
            id: String(obstacle?.id || `obstacle-${index + 1}`),
            start: Number(obstacle?.start),
            end: Number(obstacle?.end),
            intersectsPath: obstacle?.intersectsPath === true
          }))
        : [];
      if (
        !bandLength ||
        !thickness ||
        obstacles.length === 0 ||
        obstacles.some(obstacle =>
          !Number.isFinite(obstacle.start) ||
          !Number.isFinite(obstacle.end) ||
          obstacle.end <= obstacle.start ||
          obstacle.intersectsPath !== true
        )
      ) {
        return null;
      }
      const bandStart = padding;
      const bandEnd = bandLength - padding;
      if (bandEnd <= bandStart) return null;
      const expansion = thickness / 2 + clearance;
      const intervals = obstacles
        .map(obstacle => ({
          id: obstacle.id,
          start: Math.max(bandStart, obstacle.start - expansion),
          end: Math.min(bandEnd, obstacle.end + expansion)
        }))
        .filter(interval => interval.end > interval.start)
        .sort((left, right) => left.start - right.start);
      if (intervals.length === 0) return null;
      let coveredUntil = bandStart;
      let largestClearGap = 0;
      for (const interval of intervals) {
        largestClearGap = Math.max(
          largestClearGap,
          Math.max(0, interval.start - coveredUntil)
        );
        coveredUntil = Math.max(coveredUntil, interval.end);
      }
      largestClearGap = Math.max(
        largestClearGap,
        Math.max(0, bandEnd - coveredUntil)
      );
      if (
        coveredUntil < bandEnd - TOUR_CONSTRAINT_EPSILON ||
        largestClearGap > TOUR_CONSTRAINT_EPSILON
      ) {
        return null;
      }
      return {
        kind: "unavoidable-layout-constraint",
        strict: true,
        category: "layout",
        profile: String(proof.profile || "unspecified-corridor"),
        reasons: ["minimum-clearance-corridor-fully-obstructed"],
        available: {
          width: availableWidth,
          height: availableHeight,
          padding
        },
        zoom: { available: false, proofScale: 1 },
        corridor: {
          orientation,
          minimumThickness: thickness,
          minimumClearance: clearance,
          bandStart,
          bandEnd,
          largestClearGap,
          intervals
        }
      };
    }
    if (proof.mode != null && proof.mode !== "packing") return null;
    const items = Array.isArray(proof.items)
      ? proof.items.map(item => ({
          id: String(item?.id || "item"),
          minimumWidth: tourFinitePositive(item?.minimumWidth),
          minimumHeight: tourFinitePositive(item?.minimumHeight),
          count: Math.max(1, Math.trunc(Number(item?.count) || 1))
        }))
      : [];
    if (
      items.length === 0 ||
      items.some(item => !item.minimumWidth || !item.minimumHeight)
    ) {
      return null;
    }

    let scale = 1;
    let zoom = null;
    if (proof.zoom?.available === true) {
      const productMinimum = tourFinitePositive(proof.zoom?.productMinimum);
      const productMaximum = tourFinitePositive(proof.zoom?.productMaximum);
      const readableMinimum = tourFinitePositive(proof.zoom?.readableMinimum);
      if (
        !productMinimum ||
        !productMaximum ||
        !readableMinimum ||
        productMinimum > productMaximum
      ) {
        return null;
      }
      scale = Math.min(
        productMaximum,
        Math.max(productMinimum, readableMinimum)
      );
      zoom = {
        available: true,
        productMinimum,
        productMaximum,
        readableMinimum,
        proofScale: scale
      };
    } else if (proof.zoom?.available === false) {
      zoom = { available: false, proofScale: 1 };
    } else {
      return null;
    }

    const padding = Math.max(0, Number(proof.padding) || 0);
    const mandatoryGap = Math.max(0, Number(proof.mandatoryGap) || 0);
    const usableWidth = Math.max(0, availableWidth - padding * 2);
    const usableHeight = Math.max(0, availableHeight - padding * 2);
    const expandedItems = items.flatMap(item =>
      Array.from({ length: item.count }, (_, index) => ({
        id: item.count > 1 ? `${item.id}-${index + 1}` : item.id,
        width: item.minimumWidth * scale,
        height: item.minimumHeight * scale
      }))
    );
    const largestWidth = Math.max(...expandedItems.map(item => item.width));
    const largestHeight = Math.max(...expandedItems.map(item => item.height));
    const requiredArea = expandedItems.reduce(
      (sum, item) => sum + item.width * item.height,
      0
    );
    const usableArea = usableWidth * usableHeight;
    const reasons = [];
    if (largestWidth > usableWidth + TOUR_CONSTRAINT_EPSILON) {
      reasons.push("minimum-item-width-exceeds-usable-width");
    }
    if (largestHeight > usableHeight + TOUR_CONSTRAINT_EPSILON) {
      reasons.push("minimum-item-height-exceeds-usable-height");
    }
    if (requiredArea > usableArea + TOUR_CONSTRAINT_EPSILON) {
      reasons.push("summed-minimum-area-exceeds-usable-area");
    }
    if (proof.arrangement === "horizontal") {
      const requiredWidth =
        expandedItems.reduce((sum, item) => sum + item.width, 0) +
        mandatoryGap * Math.max(0, expandedItems.length - 1);
      if (requiredWidth > usableWidth + TOUR_CONSTRAINT_EPSILON) {
        reasons.push("mandatory-horizontal-span-exceeds-usable-width");
      }
    } else if (proof.arrangement === "vertical") {
      const requiredHeight =
        expandedItems.reduce((sum, item) => sum + item.height, 0) +
        mandatoryGap * Math.max(0, expandedItems.length - 1);
      if (requiredHeight > usableHeight + TOUR_CONSTRAINT_EPSILON) {
        reasons.push("mandatory-vertical-span-exceeds-usable-height");
      }
    } else if (proof.arrangement !== "free") {
      return null;
    }
    if (reasons.length === 0) return null;
    return {
      kind: "unavoidable-layout-constraint",
      strict: true,
      category: "layout",
      profile: String(proof.profile || "unspecified-layout"),
      reasons,
      available: {
        width: availableWidth,
        height: availableHeight,
        padding,
        usableWidth,
        usableHeight,
        usableArea
      },
      zoom,
      items: expandedItems,
      lowerBounds: { largestWidth, largestHeight, requiredArea }
    };
  }

  function graphConstraintItems(profile, layout) {
    const currentScale = tourFinitePositive(layout?.zoom?.current);
    const minimumWidth = tourFinitePositive(layout?.node?.minimumWidth);
    const minimumHeight = tourFinitePositive(layout?.node?.minimumHeight);
    if (!currentScale || !minimumWidth || !minimumHeight) return null;
    const visibleNodes = [...document.querySelectorAll(".rml-graph-node")]
      .filter(node => {
        if (!(node instanceof HTMLElement) || !node.isConnected) return false;
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 && rect.height > 0;
      });
    const nodeItem = (node, fallbackId) => ({
      id: node?.dataset?.graphNodeId || fallbackId,
      minimumWidth,
      minimumHeight
    });
    const notNode = visibleNodes.find(node =>
      /(?:^|\s)NOT(?:\s|$)/i.test(
        node.querySelector(".rml-graph-node-title strong")
          ?.textContent || ""
      )
    ) || null;
    const sourceNode = visibleNodes.find(node =>
      node.classList.contains("configuration")
    ) || visibleNodes.find(node =>
      /(?:^|\s)(?:Start|Boolean Constant)(?:\s|$)/i.test(
        node.querySelector(".rml-graph-node-title strong")
          ?.textContent || ""
      )
    ) || null;
    const items = [];
    if (profile === "graph-create-node") {
      const notMetrics = window.RMLDynamicGraphHost
        ?.getOperatorPlacementMetrics?.("logic.not") || null;
      if (sourceNode) items.push(nodeItem(sourceNode, "required-source"));
      if (notNode) {
        items.push(nodeItem(notNode, "required-logic-not"));
      } else {
        const width = tourFinitePositive(notMetrics?.width);
        const height = tourFinitePositive(notMetrics?.height);
        if (!width || !height) return null;
        items.push({
          id: "required-logic-not",
          minimumWidth: Math.max(minimumWidth, width),
          minimumHeight: Math.max(minimumHeight, height)
        });
      }
    } else if (profile === "graph-teaching-pair") {
      if (!sourceNode || !notNode) return null;
      items.push(
        nodeItem(sourceNode, "required-source"),
        nodeItem(notNode, "required-logic-not")
      );
    }
    if (items.length === 0) {
      items.push({
        id: "minimum-graph-node",
        minimumWidth,
        minimumHeight
      });
    }
    return items;
  }

  function graphConstraintProof(profile) {
    const viewport = document.querySelector(".rml-graph-viewport");
    const rect = viewport?.getBoundingClientRect?.();
    const layout = window.RMLDynamicGraphHost?.getLayoutConstraints?.() || null;
    if (
      !(viewport instanceof HTMLElement) ||
      !rect ||
      rect.width <= 0 ||
      rect.height <= 0 ||
      layout?.zoom?.available !== true
    ) {
      return null;
    }
    const title = document.querySelector(".rml-graph-node-title strong");
    const baseTextSize = tourFinitePositive(
      title ? parseFloat(getComputedStyle(title).fontSize) : 11
    );
    const items = graphConstraintItems(profile, layout);
    if (!baseTextSize || !items) return null;
    return {
      category: "layout",
      profile,
      available: { width: rect.width, height: rect.height },
      items,
      arrangement: "free",
      padding: 18,
      mandatoryGap: 18,
      zoom: {
        available: true,
        productMinimum: layout.zoom.minimum,
        productMaximum: layout.zoom.maximum,
        readableMinimum: TOUR_MIN_READABLE_GRAPH_TEXT_PX / baseTextSize
      }
    };
  }

  function tourConstraintProofForProfile(profile) {
    return String(profile).startsWith("graph-")
      ? graphConstraintProof(profile)
      : null;
  }

  function outlineMarkerCorridorProof(host, geometry) {
    if (
      !(host instanceof HTMLElement) ||
      !geometry ||
      geometry.orientation !== "horizontal"
    ) {
      return null;
    }
    const hostRect = host.getBoundingClientRect();
    const viewport = tourViewport();
    const top = Math.max(hostRect.top, tourHeaderBottom(), viewport.top);
    const bottom = Math.min(hostRect.bottom, viewport.bottom);
    const lineLeft = Number(geometry.left);
    const lineRight = lineLeft + Number(geometry.width);
    if (
      !Number.isFinite(lineLeft) ||
      !Number.isFinite(lineRight) ||
      lineRight <= lineLeft ||
      bottom <= top
    ) {
      return null;
    }
    const cardObstacles = directChildrenWithClass(host, "node-card")
      .filter(card => !card.classList.contains("node-pointer-ghost"));
    const controlObstacles = [...document.querySelectorAll(
      "button, input, select, textarea, [role='button']"
    )].filter(control =>
      control instanceof HTMLElement &&
      !control.closest("#rml-setup-assistant") &&
      !control.closest(".node-pointer-ghost") &&
      !control.contains(host) &&
      tourElementActuallyVisible(control)
    );
    const obstacles = [...cardObstacles, ...controlObstacles]
      .map((element, index) => {
        const rect = element.getBoundingClientRect();
        const intersectsPath =
          rect.right > lineLeft + 4 &&
          rect.left < lineRight - 4 &&
          rect.bottom > top &&
          rect.top < bottom;
        return {
          id:
            element.id ||
            element.getAttribute("data-node-id") ||
            `live-obstacle-${index + 1}`,
          start: Math.max(top, rect.top) - top,
          end: Math.min(bottom, rect.bottom) - top,
          intersectsPath
        };
      })
      .filter(obstacle => obstacle.intersectsPath && obstacle.end > obstacle.start);
    if (obstacles.length === 0) return null;
    return {
      category: "layout",
      mode: "corridor",
      profile: "outline-marker-corridor",
      available: {
        width: Math.max(1, lineRight - lineLeft),
        height: bottom - top
      },
      padding: 0,
      zoom: { available: false },
      corridor: {
        orientation: "horizontal",
        minimumThickness: Math.max(4, Number(geometry.height) || 4),
        minimumClearance: 4,
        obstacles
      }
    };
  }

  function recordConstraintCertificate(certificate, context = {}) {
    const recorded = {
      id: `layout-constraint-${tourConstraintState.certificates.length + 1}`,
      ...certificate,
      stepIndex,
      phase: stepPhase,
      context
    };
    tourConstraintState.certificates.push(recorded);
    tourConstraintState.handledCount += 1;
    return recorded;
  }

  function evaluateTourLayoutProfile(profile, context = {}, record = true) {
    const proof = tourConstraintProofForProfile(profile);
    const certificate = proof
      ? strictLayoutConstraintCertificate(proof)
      : null;
    if (!certificate) {
      tourConstraintState.rejectedCount += 1;
      return null;
    }
    return record
      ? recordConstraintCertificate(certificate, context)
      : certificate;
  }

  function handleTourLayoutError(error, context = {}) {
    const message = error?.message || String(error || "");
    const profile = TOUR_LAYOUT_ERROR_PROFILES.get(message);
    if (!profile) return null;
    return evaluateTourLayoutProfile(profile, {
      kind: "caught-error",
      message,
      ...context
    });
  }

  function tourDebugRect(element) {
    if (!(element instanceof Element) || !element.isConnected) return null;
    const rect = element.getBoundingClientRect();
    return {
      left: Math.round(rect.left * 10) / 10,
      top: Math.round(rect.top * 10) / 10,
      right: Math.round(rect.right * 10) / 10,
      bottom: Math.round(rect.bottom * 10) / 10,
      width: Math.round(rect.width * 10) / 10,
      height: Math.round(rect.height * 10) / 10
    };
  }

  function tourDebugRecord(type, data = {}) {
    const root = document.scrollingElement || document.documentElement;
    const graphState = window.RMLDynamicGraphHost?.getViewportState?.() || null;
    const record = {
      sequence: tourDebugState.events.length + 1,
      time: Math.round(performance.now()),
      type,
      stepIndex,
      phase: stepPhase,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      },
      page: {
        left: Math.round(root?.scrollLeft || 0),
        top: Math.round(root?.scrollTop || 0),
        maximumLeft: Math.max(0, (root?.scrollWidth || 0) - (root?.clientWidth || 0)),
        maximumTop: Math.max(0, (root?.scrollHeight || 0) - (root?.clientHeight || 0))
      },
      panels: document.body?.classList.contains("rml-node-graph-mode")
        ? {
            leftOpen: !graphSidebarIsHidden("left"),
            rightOpen: !graphSidebarIsHidden("right")
          }
        : null,
      graph: graphState,
      ...data
    };
    tourDebugState.events.push(record);
    if (tourDebugState.events.length > TOUR_DEBUG_LIMIT) {
      tourDebugState.events.splice(0, tourDebugState.events.length - TOUR_DEBUG_LIMIT);
    }
    window.dispatchEvent(new CustomEvent("rml-tour-debug-vector", { detail: record }));
    return record;
  }

  function tourDebugAssert(name, passed, data = {}) {
    const rawPassed = passed === true;
    const hasCreatedRectGeometry = Boolean(
      data?.createdRect &&
      tourFinitePositive(data.createdRect.width) &&
      tourFinitePositive(data.createdRect.height) &&
      data?.visibleRect &&
      tourFinitePositive(data.visibleRect.width) &&
      tourFinitePositive(data.visibleRect.height)
    );
    const hasRepairRectGeometry = Boolean(
      data?.productCommitConfirmed === true &&
      data?.finalRect &&
      tourFinitePositive(data.finalRect.width) &&
      tourFinitePositive(data.finalRect.height) &&
      data?.visibleRect &&
      tourFinitePositive(data.visibleRect.width) &&
      tourFinitePositive(data.visibleRect.height)
    );
    const hasRequiredRawGeometry =
      (
        name !== "graph-create-node-created-rect-entirely-inside-graph" ||
        hasCreatedRectGeometry
      ) &&
      (
        name !== "graph-create-node-committed-rect-live-repair-complete" ||
        hasRepairRectGeometry
      );
    const profile = rawPassed || !hasRequiredRawGeometry
      ? null
      : TOUR_LAYOUT_ASSERTION_PROFILES[name] || null;
    let constraintCertificate = null;
    if (profile === "outline-marker-corridor") {
      const proofs = Array.isArray(data?.constraintProofs)
        ? data.constraintProofs
        : [];
      const expectedProofs = Math.max(
        0,
        Math.trunc(Number(data?.unsafeSampleCount) || 0)
      );
      const minimumSamples = name ===
        "outline-reorder-native-line-never-crossed-controls"
          ? 2
          : 1;
      const certificates = proofs.map(proof =>
        strictLayoutConstraintCertificate(proof)
      );
      if (
        Number(data?.sampleCount || 0) >= minimumSamples &&
        expectedProofs > 0 &&
        proofs.length === expectedProofs &&
        certificates.every(Boolean)
      ) {
        constraintCertificate = recordConstraintCertificate(
          {
            kind: "unavoidable-layout-constraint",
            strict: true,
            category: "layout",
            profile,
            reasons: [
              "every-unsafe-marker-sample-had-no-minimum-clearance-corridor"
            ],
            sampleCertificates: certificates
          },
          {
            kind: "assertion",
            assertionName: name
          }
        );
      } else if (!rawPassed) {
        tourConstraintState.rejectedCount += 1;
      }
    } else if (profile) {
      constraintCertificate = evaluateTourLayoutProfile(profile, {
        kind: "assertion",
        assertionName: name
      });
    }
    const assertion = {
      ...data,
      name,
      controlledRepeat: repeatPreviousInFlight === true,
      passed: rawPassed || Boolean(constraintCertificate),
      rawPassed,
      constraintHandled: Boolean(constraintCertificate),
      constraintCertificate,
      severity: rawPassed
        ? "info"
        : constraintCertificate
          ? "constraint-noise"
          : "error",
      stepIndex,
      phase: stepPhase
    };
    tourDebugState.assertions.push(assertion);
    tourDebugRecord("assertion", assertion);
    return assertion.passed;
  }

  function registerTourInteractionCapability(definition) {
    if (!definition?.id) {
      throw new Error("A tour interaction capability requires a stable id.");
    }
    const previous = tourInteractionCapabilities.get(definition.id) || {};
    const merged = Object.freeze({ ...previous, ...definition });
    tourInteractionCapabilities.set(definition.id, merged);
    return merged;
  }

  function tourInteractionCapabilitySummary() {
    return [...tourInteractionCapabilities.values()].map(capability => ({
      id: capability.id,
      gesture: capability.gesture || "",
      nativePath: capability.nativePath || "",
      preconditions: [...(capability.preconditions || [])],
      successSignals: [...(capability.successSignals || [])],
      executable: typeof capability.execute === "function"
    }));
  }

  async function executeTourInteractionCapability(
    capabilityId,
    context = {}
  ) {
    const capability = tourInteractionCapabilities.get(capabilityId);
    if (!capability || typeof capability.execute !== "function") {
      throw new Error(
        `[RML Tour] Interaction capability ${capabilityId} is not executable.`
      );
    }

    const before = typeof capability.observe === "function"
      ? await capability.observe(context)
      : null;
    tourDebugRecord("tour-interaction-capability-start", {
      capabilityId,
      gesture: capability.gesture || "",
      nativePath: capability.nativePath || "",
      before
    });

    const result = await capability.execute({ ...context, before });
    const confirmation = typeof capability.confirm === "function"
      ? await capability.confirm({ ...context, before, result })
      : { ok: result !== false };
    const repaired = false;

    const passed = confirmation?.ok === true;
    tourDebugRecord("tour-interaction-capability-end", {
      capabilityId,
      passed,
      repaired: false,
      attempts: 1,
      confirmation
    });
    tourDebugAssert(
      `tour-capability-${capabilityId}-confirmed`,
      passed,
      { repaired: false, attempts: 1, confirmation }
    );
    if (!passed) {
      const reason =
        confirmation?.reason ||
        result?.reason ||
        "registered-success-signal-missing";
      const failure = new Error(
        `[RML Tour] ${capabilityId} failed once without restart: ${reason}.`
      );
      failure.details = {
        capabilityId,
        repaired,
        before,
        result,
        confirmation
      };
      throw failure;
    }
    return { result, confirmation, repaired };
  }

  [
    {
      id: "pointer.click",
      gesture: "left-click",
      nativePath: "PointerEvent → HTMLElement.click",
      preconditions: ["target connected", "target visible", "target hit-testable"],
      successSignals: ["registered control state changed"]
    },
    {
      id: "pointer.drag",
      gesture: "held left-pointer drag",
      nativePath: "pointerdown → pointermove frames → pointerup",
      preconditions: ["source hit-testable", "route inside viewport", "drop surface visible"],
      successSignals: ["native ghost observed", "product state committed"]
    },
    {
      id: "wheel.scroll",
      gesture: "mouse wheel",
      nativePath: "registered RML scroll manager",
      preconditions: ["scroll layer visible", "scroll range available"],
      successSignals: ["selected native scroll offset changed"]
    },
    {
      id: "modifier-wheel.select-layer",
      gesture: "Ctrl/Command + Wheel",
      nativePath: "registered scroll hierarchy selector",
      preconditions: ["pointer location perceived", "candidate hierarchy captured"],
      successSignals: ["requested live scroll layer selected"]
    },
    {
      id: "responsive-menu.toggle",
      gesture: "left-click Hamburger",
      nativePath: "real responsive top-action toggle",
      preconditions: ["compact layout", "Hamburger visible"],
      successSignals: ["aria-expanded and menu visibility agree"]
    },
    {
      id: "graph.sidebar.ensure-visible",
      gesture: "left-click graph panel toggle when required",
      nativePath: "real Runtime Graph sidebar toggle",
      preconditions: ["Runtime Graph active", "toggle visible when panel collapsed"],
      successSignals: ["requested panel is visibly hit-testable"]
    },
    {
      id: "graph.palette.drag-node",
      gesture: "held palette-to-canvas drag",
      nativePath: "Runtime Graph palette pointer engine",
      preconditions: ["exact operator source visible", "source hit-testable", "graph drop point hit-testable"],
      successSignals: ["native palette ghost observed", "exact operator node rendered at the visible drop"]
    },
    {
      id: "outline.palette.drag-node",
      gesture: "held Outline palette-to-canvas drag",
      nativePath: "Configuration Outline palette pointer controller",
      preconditions: [
        "exact palette source visible",
        "source connected",
        "native insertion marker armed inside Configuration Outline"
      ],
      successSignals: [
        "authoritative palette transaction committed",
        "created Outline node id rendered and visible"
      ]
    },
    {
      id: "graph.socket.connect",
      gesture: "held socket-to-socket drag",
      nativePath: "typed graph connection engine",
      preconditions: ["compatible visible sockets"],
      successSignals: ["typed connection record and rendered wire"]
    },
    {
      id: "graph.node.drag",
      gesture: "held node-header drag",
      nativePath: "Runtime Graph node movement engine",
      preconditions: ["node header visible", "destination inside graph"],
      successSignals: ["node state and rendered position changed"]
    },
    {
      id: "graph.wire.route",
      gesture: "held wire-segment or bend-point drag",
      nativePath: "Runtime Graph wire routing engine",
      preconditions: ["existing wire segment visible"],
      successSignals: ["same wire route updated without follower wire"]
    },
    {
      id: "dialog.open-close",
      gesture: "left-click trigger and close control",
      nativePath: "native HTML dialog top layer",
      preconditions: ["trigger visible", "dialog registered"],
      successSignals: ["dialog open state and teacher visual layer confirmed"]
    }
  ].forEach(registerTourInteractionCapability);

  Object.defineProperty(window, "RMLTourDebug", {
    value: Object.freeze({
      build: tourDebugState.build,
      visualTestProtocolVersion: "1.0",
      clear() {
        tourDebugState.events.length = 0;
        tourDebugState.assertions.length = 0;
        tourConstraintState.certificates.length = 0;
        tourConstraintState.handledCount = 0;
        tourConstraintState.rejectedCount = 0;
      },
      getReport() {
        return JSON.parse(JSON.stringify({
          build: tourDebugState.build,
          stepIndex,
          stepCount: steps.length,
          stepTitle: steps[stepIndex]?.title || "",
          stepDemo: steps[stepIndex]?.demo || "",
          phase: stepPhase,
          presentationSpeed: TOUR_PRESENTATION_SPEED,
          presentationTimingPolicy:
            "Only narration waits and non-transactional teacher-mouse travel are scaled; product input timing, polling, settlement and assertion windows remain at 1x.",
          passed: tourDebugState.assertions.every(item => item.passed),
          singlePassState: {
            enteredStepIndexes: [...enteredStepIndexes],
            narratedStepIndexes: [...narratedStepIndexes],
            attemptedDemonstrationIndexes:
              [...attemptedDemonstrationIndexes],
            repeatReadySnapshotIndexes:
              [...stepReadySnapshots.keys()],
            blockedRepeatCount,
            controlledRepeatCount,
            controlledRepeatInFlight: repeatPreviousInFlight
          },
          constraintHandler: {
            version: 1,
            policy: "strict-mathematical-layout-lower-bound-only",
            handledCount: tourConstraintState.handledCount,
            rejectedCount: tourConstraintState.rejectedCount,
            certificates: tourConstraintState.certificates
          },
          assertions: tourDebugState.assertions,
          events: tourDebugState.events
        }));
      },
      getSteps() {
        return steps.map((step, index) => ({
          index,
          title: step.title || `Step ${index}`,
          demo: step.demo || "",
          mode: step.mode || ""
        }));
      },
      getLivePerception() {
        const step = steps[stepIndex] || null;
        const target = step ? findTarget(step) : null;
        return JSON.parse(JSON.stringify(
          tourCaptureLivePerception({
            currentStepTarget: target,
            currentTourTarget: currentTarget,
            assistant: document.getElementById("rml-setup-assistant")
          })
        ));
      },
      getInteractionCapabilities() {
        return tourInteractionCapabilitySummary();
      },
      evaluateViewportSupport(width, height) {
        return JSON.parse(JSON.stringify(
          evaluateTourViewportSupport(width, height)
        ));
      },
      async openStep(index) {
        const testMode =
          new URLSearchParams(window.location.search).has("rmlTourTest") ||
          window.location.hash.includes("rmlTourTest");
        if (!testMode) {
          throw new Error("openStep is available only in the visual test harness.");
        }
        const requested = Math.max(0, Math.min(steps.length - 1, Math.trunc(Number(index) || 0)));
        if (!document.getElementById("rml-setup-assistant")) {
          await start({ firstRun: false });
        }
        return transitionToStep(requested, {
          captureEntry: true
        });
      },
      async demonstrateCurrentStep() {
        const testMode =
          new URLSearchParams(window.location.search).has("rmlTourTest") ||
          window.location.hash.includes("rmlTourTest");
        if (!testMode) {
          throw new Error("demonstrateCurrentStep is available only in the visual test harness.");
        }
        const demonstratedStepIndex = stepIndex;
        const step = steps[demonstratedStepIndex];
        if (!step?.demo) return false;
        const narrationWaitStarted = performance.now();
        if (stepPhase === "narrating") {
          while (
            stepPhase === "narrating" &&
            stepIndex === demonstratedStepIndex &&
            performance.now() - narrationWaitStarted < 240000
          ) {
            await new Promise(resolve => window.setTimeout(resolve, 40));
          }
        }
        const narrationReady = tourDebugAssert(
          "visual-test-full-preparation-and-natural-narration-observed",
          stepPhase === "ready" &&
            stepIndex === demonstratedStepIndex,
          {
            demonstratedStepIndex,
            narrationWaitMs: Math.round(
              performance.now() - narrationWaitStarted
            ),
            syntheticNarrationAdvances: 0,
            finalPhase: stepPhase
          }
        );
        if (!narrationReady) {
          throw new Error(
            `[RML Tour · Step ${demonstratedStepIndex}] Narration did not reach ready state in the bounded visual-test path.`
          );
        }
        const completed =
          await runDemo(step, findTarget(step));
        tourDebugAssert(
          `tour-step-${demonstratedStepIndex}-demonstration-complete`,
          completed === true,
          {
            demonstratedStepIndex,
            demonstratedStepTitle: step.title || "",
            demonstratedDemo: step.demo || ""
          }
        );
        return completed;
      },
      async repeatPreviousForTest() {
        const testMode =
          new URLSearchParams(window.location.search).has("rmlTourTest") ||
          window.location.hash.includes("rmlTourTest");
        if (!testMode) {
          throw new Error(
            "repeatPreviousForTest is available only in the visual test harness."
          );
        }
        return repeatPreviousDemonstration();
      },
      async abortAndRestoreForTest(options = {}) {
        const testMode =
          new URLSearchParams(window.location.search).has("rmlTourTest") ||
          window.location.hash.includes("rmlTourTest");
        if (!testMode) {
          throw new Error(
            "abortAndRestoreForTest is available only in the visual test harness."
          );
        }
        const reason = String(
          options?.reason || "visual-test-step-timeout"
        );
        tourDebugRecord("visual-test-bounded-abort-start", {
          reason,
          abortedStepIndex: stepIndex,
          abortedPhase: stepPhase,
          demoInFlight,
          policy:
            "a timed-out asynchronous lesson is cancelled and the immutable sandbox is restored before the harness leaves this viewport; its stale promise may never race a later lesson"
        });
        await restoreAndClose(false);
        const restored = tourDebugState.assertions.some(assertion =>
          assertion.name === "tour-sandbox-full-restore-contract" &&
          assertion.passed === true
        );
        tourDebugRecord("visual-test-bounded-abort-complete", {
          reason,
          restored,
          assistantHidden: Boolean(elements().root?.hidden)
        });
        return restored;
      },
      async finishAndRestoreForTest(options = {}) {
        const testMode =
          new URLSearchParams(window.location.search).has("rmlTourTest") ||
          window.location.hash.includes("rmlTourTest");
        if (!testMode) {
          throw new Error(
            "finishAndRestoreForTest is available only in the visual test harness."
          );
        }
        const ui = elements();
        const probeRepeatPrevious =
          options?.probeRepeatPrevious === true;
        const repeatCountBefore = controlledRepeatCount;
        const repeatButtonReady = Boolean(
          stepIndex === steps.length - 1 &&
          stepPhase === "explain" &&
          ui.repeatPrevious &&
          !ui.repeatPrevious.hidden &&
          !ui.repeatPrevious.disabled
        );
        const repeatWaitStarted = performance.now();
        if (probeRepeatPrevious && repeatButtonReady) {
          ui.repeatPrevious.click();
          while (
            (
              controlledRepeatCount === repeatCountBefore ||
              repeatPreviousInFlight
            ) &&
            performance.now() - repeatWaitStarted < 25000
          ) {
            await new Promise(resolve => window.setTimeout(resolve, 40));
          }
        }
        const repeatCompletion = probeRepeatPrevious
          ? [...tourDebugState.events]
          .reverse()
          .find(event =>
            event.type === "controlled-repeat-previous-complete" &&
            event.transaction === controlledRepeatCount
          ) || null
          : null;
        if (probeRepeatPrevious) {
          const repeatButtonTransactionPassed = tourDebugAssert(
            "tour-complete-repeat-previous-button-transaction",
            Boolean(
              repeatButtonReady &&
              controlledRepeatCount === repeatCountBefore + 1 &&
              !repeatPreviousInFlight &&
              repeatCompletion?.demonstrationCompleted === true &&
              repeatCompletion?.readySnapshotUsed === true &&
              repeatCompletion?.returnStateRestored === true &&
              stepIndex === steps.length - 1 &&
              stepPhase === "explain" &&
              ui.repeatPrevious &&
              !ui.repeatPrevious.hidden &&
              !ui.repeatPrevious.disabled &&
              ui.next?.textContent === "Finish"
            ),
            {
              repeatButtonReady,
              repeatCountBefore,
              repeatCountAfter: controlledRepeatCount,
              waitedForMs: Math.round(
                performance.now() - repeatWaitStarted
              ),
              repeatPreviousInFlight,
              repeatCompletion,
              returnedStepIndex: stepIndex,
              returnedPhase: stepPhase,
              repeatButtonVisible: Boolean(
                ui.repeatPrevious && !ui.repeatPrevious.hidden
              ),
              repeatButtonEnabled: Boolean(
                ui.repeatPrevious && !ui.repeatPrevious.disabled
              ),
              finishLabel: ui.next?.textContent || "",
              policy:
                "only the optional isolated stress run clicks Repeat previous and verifies one complete Step 12 round trip"
            }
          );
          if (!repeatButtonTransactionPassed) {
            throw new Error(
              "[RML Tour · Complete] The isolated Repeat previous probe did not complete its Step 12 round trip."
            );
          }
        } else {
          const acceptanceDidNotRepeat = tourDebugAssert(
            "tour-complete-repeat-previous-skipped-in-acceptance",
            Boolean(
              repeatButtonReady &&
              controlledRepeatCount === repeatCountBefore &&
              !repeatPreviousInFlight &&
              stepIndex === steps.length - 1 &&
              stepPhase === "explain" &&
              ui.next?.textContent === "Finish"
            ),
            {
              repeatButtonReady,
              repeatCountBefore,
              repeatCountAfter: controlledRepeatCount,
              repeatPreviousInFlight,
              finishLabel: ui.next?.textContent || "",
              policy:
                "the normal acceptance matrix must finish immediately from Tour complete and never execute Step 12 a second time"
            }
          );
          if (!acceptanceDidNotRepeat) {
            throw new Error(
              "[RML Tour · Complete] The acceptance finish path did not remain a strict single pass."
            );
          }
        }
        const completionStarted = performance.now();
        const completionVisible = Boolean(
          stepIndex === steps.length - 1 &&
          stepPhase === "explain" &&
          ui.root &&
          !ui.root.hidden &&
          ui.card &&
          tourElementActuallyVisible(ui.card) &&
          ui.next &&
          !ui.next.hidden &&
          !ui.next.disabled &&
          ui.next.textContent === "Finish"
        );
        hardHideTeacherMouse("visual-test-tour-complete");
        if (completionVisible) {
          await wait(1200);
        }
        const completionHeld = tourDebugAssert(
          "tour-complete-visible-before-sandbox-restore",
          Boolean(
            completionVisible &&
            performance.now() - completionStarted >= 1150 &&
            ui.root &&
            !ui.root.hidden &&
            ui.card &&
            tourElementActuallyVisible(ui.card) &&
            ui.next?.textContent === "Finish" &&
            ui.mouse?.classList.contains(
              "rml-setup-mouse-hard-hidden"
            )
          ),
          {
            completionVisible,
            heldForMs: Math.round(
              performance.now() - completionStarted
            ),
            finishLabel: ui.next?.textContent || "",
            teacherMouseHardHidden: Boolean(
              ui.mouse?.classList.contains(
                "rml-setup-mouse-hard-hidden"
              )
            ),
            policy:
              "the complete Step 12 result hands off to a stable Tour complete card before the visual harness restores the sandbox"
          }
        );
        if (!completionHeld) {
          throw new Error(
            "[RML Tour · Complete] The final card was not held visibly before sandbox restoration."
          );
        }
        tourDebugRecord("tour-sandbox-restore-start", {
          stepIndex,
          stepPhase,
          completionHeld,
          policy:
            "the final visual card hands off to one bounded sandbox restore transaction before the viewport closes"
        });
        await restoreAndClose(false);
        const restored = tourDebugState.assertions.some(assertion =>
          assertion.name === "tour-sandbox-full-restore-contract" &&
          assertion.passed === true
        );
        tourDebugRecord("tour-sandbox-restore-complete", {
          restored,
          assistantHidden: Boolean(elements().root?.hidden)
        });
        return restored;
      }
    }),
    configurable: true,
    enumerable: false
  });

  Object.defineProperty(window, "RMLTourConstraintHandler", {
    value: Object.freeze({
      version: 1,
      policy: "strict-mathematical-layout-lower-bound-only",
      evaluateProof(proof) {
        return strictLayoutConstraintCertificate(proof);
      },
      evaluateLiveProfile(profile) {
        return evaluateTourLayoutProfile(profile, {
          kind: "external-live-probe"
        }, false);
      },
      getReport() {
        return JSON.parse(JSON.stringify({
          handledCount: tourConstraintState.handledCount,
          rejectedCount: tourConstraintState.rejectedCount,
          certificates: tourConstraintState.certificates
        }));
      }
    }),
    configurable: true,
    enumerable: false
  });

  const TOUR_SCROLL_TIMING = Object.freeze({
    wheelInterval: 145,
    layerStepPause: 390,
    modifierLeadIn: 330,
    modifierReleasePause: 380,
    gestureLeadIn: 260,
    gestureSettle: 420,
    autoScrollInterval: 105,
    returnScrollInterval: 105,
    pageScrollDuration: 820,
    narrationCharacterInterval: 52,
    narrationWordPause: 34,
    narrationClausePause: 170,
    narrationSentencePause: 430,
    narrationParagraphPause: 620,
    narrationAutoScrollReadPause: 900,
    narrationSectionHold: 620,
    narrationHintHold: 0,
    preparationSettle: 320
  });
  const TOUR_PRESENTATION_SPEED = (() => {
    const parameters = new URLSearchParams(window.location.search);
    const requested = Number(parameters.get("rmlTourPresentationSpeed") || 1);
    const nativeVisualTest =
      parameters.has("rmlNativeVisualTest") ||
      window.location.hash.includes("rmlNativeVisualTest");
    return nativeVisualTest && Number.isFinite(requested)
      ? Math.max(1, Math.min(10, requested))
      : 1;
  })();
  const tourPresentationDuration = milliseconds =>
    Math.max(4, Number(milliseconds || 0) / TOUR_PRESENTATION_SPEED);
  let viewportGeometryFrame = 0;

  const wait = milliseconds => new Promise(resolve => {
    let settled = false;
    const pending = {
      timer: 0,
      finish: () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(pending.timer);
        const timerIndex = demoTimers.indexOf(pending);
        if (timerIndex >= 0) demoTimers.splice(timerIndex, 1);
        resolve();
      }
    };
    pending.timer = window.setTimeout(pending.finish, milliseconds);
    demoTimers.push(pending);
  });

  function tourNextVisualFrame(maximumWaitMs = 96) {
    return new Promise(resolve => {
      let settled = false;
      const finish = (timestamp, timerFallback) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        resolve({
          timestamp: Number.isFinite(timestamp)
            ? timestamp
            : performance.now(),
          timerFallback
        });
      };
      const timer = window.setTimeout(
        () => finish(performance.now(), true),
        Math.max(32, Number(maximumWaitMs) || 96)
      );
      window.requestAnimationFrame(timestamp =>
        finish(timestamp, false)
      );
    });
  }

  const steps = [
    {
      title: "Welcome to the Universal Mod Builder",
      text: "I’ll guide you through the Builder’s basic workflow. We’ll look at each feature briefly, then watch the action directly in the interface.",
      hint: "Each step begins with a short explanation and a clear highlight. The demonstration then shows the action without extra text covering the controls."
    },
    {
      target: ".identity-grid",
      mode: "outline",
      title: "1. Top bar and mod details",
      text: "The top bar provides status information and the main actions: New blank, Help, Tour, Preview, Project and Export. Save JSON is introduced but never pressed. The demonstration then completes the six fields that identify the mod.",
      hint: "On smaller screens, the closed menu button is introduced first. The menu then opens so every action inside can be explained before the demonstration begins.",
      demo: "topbar-identity-workflow"
    },
    {
      target: "#builder-canvas",
      mode: "outline",
      title: "2. Add a control",
      text: "Choose a setting from the list on the left and drag it into the <strong>Configuration Outline</strong>. The setting remains visible from its starting point to its new position.",
      hint: "The complete destination is highlighted first, making the correct drop area easy to recognize.",
      demo: "outline-palette"
    },
    {
      target: "#builder-canvas",
      mode: "outline",
      title: "3. Reorder controls",
      text: "Existing controls can be moved above or below one another. When the destination is outside the visible area, hold the control near the edge until the page moves, then place it on the visible insertion line.",
      hint: "The control stays held until the new position is clearly visible and is released only at that point.",
      demo: "outline-reorder-scroll"
    },
    {
      target: "#builder-canvas",
      mode: "outline",
      title: "4. Move a complete section",
      text: "A complete section can be moved without separating the controls inside it. In this example, General moves from left to right while Enabled and Scale remain together. Quality and DetailSection stay inside Advanced.",
      hint: "During the wheel movement, the mouse remains still while the insertion line advances step by step to the new position.",
      demo: "outline-nested"
    },
    {
      target: ".inspector",
      mode: "outline",
      title: "5. Edit properties",
      text: "Select a Button and edit its Description in Properties. The same panel also contains its name, visibility and every other option available for that control.",
      hint: "A different Button is selected so both the selection change and the updated description are easy to see.",
      demo: "outline-properties"
    },
    {
      target: ".rml-pack-button",
      mode: "outline",
      title: "6. Open the runtime graph",
      text: "<strong>Pack into Node</strong> changes from the Configuration Outline to the Runtime Graph. The controls created in the Outline become available on the Start node.",
      hint: "The demonstration uses the same button and follows the same change of view as normal use.",
      demo: "mode-switch-graph"
    },
    {
      target: ".rml-graph-palette",
      mode: "graph",
      title: "7. Add a runtime node",
      text: "Find a NOT node in the Node library and drag it into the graph. Only the one node needed for the following examples is added. If a NOT node already exists, it is reused.",
      hint: "The NOT node is placed where it remains fully visible and easy to work with.",
      demo: "graph-create-node"
    },
    {
      target: ".rml-graph-viewport",
      mode: "graph",
      title: "8. Connect ports",
      text: "Connect the two existing teaching nodes: drag from the compatible output on the Start node to the matching input on the NOT node. The node glows identify both connection partners, then the port glows identify the exact drag path. Unsuitable port combinations are refused, and this step creates no additional node.",
      hint: "Follow the two glowing ports: Start output → NOT input.",
      demo: "graph-wire"
    },
    {
      target: ".rml-graph-viewport",
      mode: "graph",
      title: "9. Switch the port sides",
      text: "Press <strong>⇄</strong> on the NOT node to move its ports to the opposite side. Pressing it again returns them to their original position.",
      hint: "Only the side-switch button is used here, keeping the change easy to follow.",
      demo: "graph-flip"
    },
    {
      target: ".rml-graph-viewport",
      mode: "graph",
      title: "10. Center, zoom and scroll",
      text: "Use <strong>Center Graph</strong> to bring the complete graph back into view. The <strong>−</strong> and <strong>+</strong> buttons change its size. The mouse wheel moves the graph, Shift moves it sideways, and Ctrl or Command chooses which area should scroll.",
      hint: "The final shortcut centers the current area again. Any movement that would not create a visible change is skipped.",
      demo: "graph-pan"
    },
    {
      target: ".rml-graph-viewport",
      mode: "graph",
      title: "11. Move nodes and shape connections",
      text: "Drag a node by its title to move it. Connecting another input to an existing line creates a branch with a movable junction. Drag that created point to shape all three connected line sections. A suitable existing node is reused whenever possible.",
      hint: "The branch action, the created junction and its visible movement stay easy to follow on every supported viewport.",
      demo: "graph-route"
    },
    {
      target: ".inspector",
      mode: "graph",
      title: "12. Edit a graph node",
      text: "Select a node to edit it in the <strong>Node inspector</strong>. The available options match the selected node, and unsuitable choices are blocked.",
      hint: "Changing the node’s label makes the result immediately visible in the graph.",
      demo: "graph-inspector"
    },
    {
      title: "Tour complete",
      text: "You have now seen the complete basic workflow: setting up the mod, adding and arranging controls, editing Properties, opening the Runtime Graph, adding nodes, connecting them and navigating the graph.",
      hint: "When you finish, I’ll return your project to the state it had before the tour."
    }
  ];

  function loadTemplateScript() {
    if (typeof window.RMLSetupTemplateMarkup === "string") {
      return Promise.resolve(window.RMLSetupTemplateMarkup);
    }
    return new Promise((resolve, reject) => {
      let script = document.querySelector('script[data-rml-setup-template="true"]');
      const finish = () => {
        const markup = window.RMLSetupTemplateMarkup;
        if (typeof markup === "string") resolve(markup);
        else reject(new Error("setup_template.js loaded without RMLSetupTemplateMarkup."));
      };
      if (script) {
        if (script.dataset.loaded === "true") return finish();
        script.addEventListener("load", finish, { once: true });
        script.addEventListener("error", () => reject(new Error("setup_template.js could not be loaded.")), { once: true });
        return;
      }
      script = document.createElement("script");
      script.src = TEMPLATE_SCRIPT_URL;
      script.async = true;
      script.dataset.rmlSetupTemplate = "true";
      script.addEventListener("load", () => {
        script.dataset.loaded = "true";
        finish();
      }, { once: true });
      script.addEventListener("error", () => reject(new Error("setup_template.js could not be loaded.")), { once: true });
      document.body.appendChild(script);
    });
  }

  function loadTemplateMarkup() {
    if (window.location.protocol === "file:") return loadTemplateScript();
    return fetch(TEMPLATE_URL, { cache: "no-store" })
      .then(response => {
        if (!response.ok) throw new Error(`Setup template: ${response.status}`);
        return response.text();
      })
      .catch(() => loadTemplateScript());
  }

  function ensureTemplate() {
    const existing = document.getElementById("rml-setup-assistant");
    if (existing) return Promise.resolve(existing);
    if (templatePromise) return templatePromise;
    templatePromise = loadTemplateMarkup()
      .then(markup => {
        document.body.insertAdjacentHTML("beforeend", markup);
        bindEvents();
        return document.getElementById("rml-setup-assistant");
      })
      .catch(error => {
        templatePromise = null;
        throw error;
      });
    return templatePromise;
  }

  function elements() {
    const root = document.getElementById("rml-setup-assistant");
    return {
      root,
      card: root?.querySelector(".rml-setup-card"),
      kicker: root?.querySelector("[data-setup-kicker]"),
      title: root?.querySelector("[data-setup-title]"),
      text: root?.querySelector("[data-setup-text]"),
      hint: root?.querySelector("[data-setup-hint]"),
      progress: root?.querySelector("[data-setup-progress]"),
      next: root?.querySelector("[data-setup-next]"),
      skip: root?.querySelector("[data-setup-skip]"),
      repeatPrevious: root?.querySelector("[data-setup-repeat-previous]"),
      skipDemo: root?.querySelector("[data-setup-skip-demo]"),
      interactionShield: root?.querySelector("[data-setup-interaction-shield]"),
      liveControls: root?.querySelector("[data-setup-live-controls]"),
      liveSkipDemo: root?.querySelector("[data-setup-live-skip-demo]"),
      liveSkipTour: root?.querySelector("[data-setup-live-skip-tour]"),
      mouse: root?.querySelector("[data-setup-mouse]"),
      mouseWheel: root?.querySelector("[data-setup-mouse-wheel]"),
      dragGhost: root?.querySelector("[data-setup-drag-ghost]"),
      keys: root?.querySelector("[data-setup-demo-keys]"),
      demoLabel: root?.querySelector("[data-setup-demo-label]")
    };
  }

  function clearTarget() {
    currentTarget?.classList.remove("rml-setup-target");
    currentTarget = null;
  }

  function findTarget(step) {
    return step.target ? document.querySelector(step.target) : null;
  }

  function tourViewport() {
    const visual = window.visualViewport;
    const layoutWidth = Math.max(
      1,
      Number(window.innerWidth) ||
        Number(document.documentElement.clientWidth) ||
        1
    );
    const layoutHeight = Math.max(
      1,
      Number(window.innerHeight) ||
        Number(document.documentElement.clientHeight) ||
        1
    );
    const visualWidth = Number(visual?.width);
    const visualHeight = Number(visual?.height);
    const visualUsable =
      Number.isFinite(visualWidth) &&
      visualWidth > 0 &&
      Number.isFinite(visualHeight) &&
      visualHeight > 0;
    let width = visualUsable
      ? visualWidth
      : layoutWidth;
    let height = visualUsable
      ? visualHeight
      : layoutHeight;
    let left =
      visualUsable &&
      Number.isFinite(Number(visual?.offsetLeft))
        ? Number(visual.offsetLeft)
        : 0;
    let top =
      visualUsable &&
      Number.isFinite(Number(visual?.offsetTop))
        ? Number(visual.offsetTop)
        : 0;

    const transientTiny =
      width < 200 || height < 160;
    if (
      transientTiny &&
      stableTourViewport?.width >= 200 &&
      stableTourViewport?.height >= 160
    ) {
      return { ...stableTourViewport };
    }

    if (
      transientTiny &&
      layoutWidth >= 200 &&
      layoutHeight >= 160
    ) {
      width = layoutWidth;
      height = layoutHeight;
      left = 0;
      top = 0;
    }

    const resolved = {
      left,
      top,
      width,
      height,
      right: left + width,
      bottom: top + height
    };
    if (width >= 200 && height >= 160) {
      stableTourViewport = { ...resolved };
    }
    return resolved;
  }

  const TOUR_MINIMUM_VIEWPORT = Object.freeze({
    width: 375,
    height: 641
  });

  function evaluateTourViewportSupport(
    width = tourViewport().width,
    height = tourViewport().height
  ) {
    const actualWidth = Math.max(1, Math.floor(Number(width) || 1));
    const actualHeight = Math.max(1, Math.floor(Number(height) || 1));
    const reasons = [];
    if (actualWidth < TOUR_MINIMUM_VIEWPORT.width) {
      reasons.push("width-below-verified-tour-minimum");
    }
    if (actualHeight < TOUR_MINIMUM_VIEWPORT.height) {
      reasons.push("height-below-verified-tour-minimum");
    }
    return {
      supported: reasons.length === 0,
      actual: {
        width: actualWidth,
        height: actualHeight
      },
      minimum: { ...TOUR_MINIMUM_VIEWPORT },
      reasons
    };
  }

  function tourEffectViewport() {
    const dialog = modalSurfaceState?.dialog;
    if (
      dialog instanceof HTMLDialogElement &&
      dialog.open &&
      dialog.isConnected
    ) {
      const rect = dialog.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        right: rect.right,
        bottom: rect.bottom
      };
    }
    return tourViewport();
  }

  function tourRect(target) {
    if (!target) return null;
    if (target instanceof Element) return target.getBoundingClientRect();
    if (
      Number.isFinite(target.left) &&
      Number.isFinite(target.top) &&
      Number.isFinite(target.right) &&
      Number.isFinite(target.bottom)
    ) {
      return target;
    }
    return null;
  }

  function tourFocusRect(targets, padding = 12) {
    const rects = (Array.isArray(targets) ? targets : [targets])
      .map(tourRect)
      .filter(Boolean);
    if (!rects.length) return null;
    return {
      left: Math.min(...rects.map(rect => rect.left)) - padding,
      top: Math.min(...rects.map(rect => rect.top)) - padding,
      right: Math.max(...rects.map(rect => rect.right)) + padding,
      bottom: Math.max(...rects.map(rect => rect.bottom)) + padding
    };
  }

  function tourPointRect(point, radius = 34) {
    return point
      ? {
          left: point.x - radius,
          top: point.y - radius,
          right: point.x + radius,
          bottom: point.y + radius
        }
      : null;
  }

  function focusDemonstration(targets, padding = 12) {
    const rect = tourFocusRect(targets, padding);
    positionShades(rect);
    if (stepPhase === "demonstrating") {
      setLiveControlsActiveObstacles(
        targets,
        "demonstration-focus-changed"
      );
    }
    return rect;
  }

  function semanticSceneElements(step, target) {
    const selectorsByDemo = {
      "topbar-identity-workflow": [".topbar", ".identity.panel"],
      "outline-palette": [".palette.panel", ".canvas.panel"],
      "outline-root-drag": [".canvas.panel"],
      "outline-reorder-scroll": [".canvas.panel"],
      "outline-nested": [".canvas.panel"],
      "outline-properties": [".canvas.panel", ".inspector.panel"],
      "mode-switch-graph": [".workspace"],
      "graph-create-node": [".rml-graph-palette", ".rml-graph-viewport"],
      "graph-wire": [".rml-graph-viewport"],
      "graph-flip": [".rml-graph-viewport"],
      "graph-pan": [".rml-graph-viewport"],
      "graph-route": [".rml-graph-viewport"],
      "graph-inspector": [".rml-graph-viewport", ".rml-graph-inspector"],
      "mode-switch-outline-preview": [".workspace"],
      "project-workflow": [".topbar"],
      "export-workflow": [".topbar"],
      "help-workflow": [".topbar"]
    };

    const selectors = selectorsByDemo[step?.demo] || [];
    const sceneElements = selectors
      .map(selector => document.querySelector(selector))
      .filter(tourElementActuallyVisible);

    if (sceneElements.length) return [...new Set(sceneElements)];

    const semanticParent = target?.closest?.(
      ".panel, .workspace, .rml-graph-viewport, .rml-graph-root, section, aside, header"
    );
    return [semanticParent || target].filter(tourElementActuallyVisible);
  }

  function tourPlainText(value) {
    const holder = document.createElement("div");
    holder.innerHTML = String(value || "");
    return (holder.textContent || "").replace(/\s+/g, " ").trim();
  }

  function tourVisibleTargets(selectors) {
    const values = Array.isArray(selectors) ? selectors : [selectors];
    return [...new Set(values.flatMap(value => {
      if (value instanceof Element) return [value];
      if (typeof value === "function") {
        const result = value();
        return Array.isArray(result) ? result : [result];
      }
      if (typeof value !== "string") return [];
      return [...document.querySelectorAll(value)];
    }).filter(tourElementActuallyVisible))];
  }

  function graphInspectorToggleVisibilityProof(toggle) {
    const ui = elements();
    const viewport = tourEffectViewport();
    const visibleTop = Math.max(
      viewport.top + 2,
      tourHeaderBottom() + 2
    );
    const usableViewport = {
      left: viewport.left + 2,
      top: visibleTop,
      right: viewport.right - 2,
      bottom: viewport.bottom - 2
    };
    const rect = toggle instanceof HTMLElement
      ? toggle.getBoundingClientRect()
      : null;
    const elementArea = rect
      ? Math.max(0, rect.width * rect.height)
      : 0;
    const visibleArea = rect
      ? rectangleIntersectionArea(rect, usableViewport)
      : 0;
    const visibleRatio = elementArea > 0
      ? Math.max(0, Math.min(1, visibleArea / elementArea))
      : 0;
    const blockers = [
      ["description-card", ui.card],
      ["live-skip-controls", ui.liveControls],
      ["demo-label", ui.demoLabel],
      ["key-overlay", ui.keys]
    ].filter(([, element]) =>
      element instanceof HTMLElement &&
      !element.hidden &&
      tourElementActuallyVisible(element)
    );
    const blockerDetails = blockers.map(([name, element]) => {
      const blockerRect = element.getBoundingClientRect();
      return {
        name,
        rect: tourDebugRect(element),
        overlapArea: rectangleIntersectionArea(rect, blockerRect)
      };
    });
    const blockerOverlapArea = Math.min(
      elementArea,
      blockerDetails.reduce(
        (sum, blocker) => sum + blocker.overlapArea,
        0
      )
    );
    const uncoveredByTourUi = elementArea > 0
      ? Math.max(0, 1 - blockerOverlapArea / elementArea)
      : 0;
    const center = rect
      ? {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2
        }
      : null;
    const assistantRoot = ui.root;
    const productHit = center
      ? document.elementsFromPoint(center.x, center.y).find(element =>
          !(assistantRoot instanceof HTMLElement) ||
          !assistantRoot.contains(element)
        ) || null
      : null;
    const centerHitTestPassed = Boolean(
      toggle instanceof HTMLElement &&
      productHit instanceof Element &&
      (productHit === toggle || toggle.contains(productHit))
    );
    const fullyInsideViewport = visibleRatio >= .995;
    const passed = Boolean(
      toggle instanceof HTMLElement &&
      !toggle.disabled &&
      tourElementActuallyVisible(toggle) &&
      fullyInsideViewport &&
      uncoveredByTourUi >= .995 &&
      centerHitTestPassed
    );
    return {
      passed,
      rect: tourDebugRect(toggle),
      usableViewport,
      visibleRatio,
      fullyInsideViewport,
      blockerOverlapArea,
      uncoveredByTourUi,
      blockerDetails,
      center,
      centerHitTestPassed,
      productHit: tourPerceptionElementLabel(productHit),
      disabled: toggle instanceof HTMLButtonElement
        ? toggle.disabled
        : false
    };
  }

  function sampleGraphInspectorToggleVisibility(toggle, phase) {
    const proof = graphInspectorToggleVisibilityProof(toggle);
    const state = graphInspectorToggleVisibilityState;
    if (state && state.toggle === toggle) {
      state.samples += 1;
      state.minimumVisibleRatio = Math.min(
        state.minimumVisibleRatio,
        proof.visibleRatio
      );
      state.minimumUncoveredRatio = Math.min(
        state.minimumUncoveredRatio,
        proof.uncoveredByTourUi
      );
      state.maximumBlockerOverlapArea = Math.max(
        state.maximumBlockerOverlapArea,
        proof.blockerOverlapArea
      );
      if (!proof.passed) {
        state.violations += 1;
        if (!state.firstViolation) {
          state.firstViolation = { phase, ...proof };
        }
      }
      state.lastProof = proof;
    }
    return proof;
  }

  async function prepareGraphInspectorToggleForNarration(runId) {
    const toggle = document.querySelector(
      ".rml-graph-panel-toggle-right, [data-rml-graph-toggle-right]"
    );
    if (!(toggle instanceof HTMLElement) || runId !== demoRunId) {
      return null;
    }
    const viewport = tourEffectViewport();
    const rect = toggle.getBoundingClientRect();
    const visibleTop = Math.max(viewport.top + 4, tourHeaderBottom() + 4);
    const inside =
      rect.left >= viewport.left + 4 &&
      rect.right <= viewport.right - 4 &&
      rect.top >= visibleTop &&
      rect.bottom <= viewport.bottom - 4;
    if (!inside) {
      toggle.scrollIntoView({
        behavior: "auto",
        block: "center",
        inline: "center"
      });
      await nextTwoFrames();
    }
    return runId === demoRunId ? toggle : null;
  }

  function narrationSegmentsForStep(step) {
    const allIdentityFields = ids => () => ids
      .map(id => document.getElementById(id)?.closest("label"))
      .filter(Boolean);
    const visibleController = () => [...document.querySelectorAll(
      ".node-card.controller[data-node-id]"
    )].find(card => card.querySelector(":scope > .controller-options"));
    const visibleGraphWireNodes = () => {
      const pair = graphDemoSocketPair(false);
      return [pair?.sourceNode, pair?.targetNode]
        .filter(tourElementActuallyVisible);
    };
    const visibleGraphWirePorts = () => {
      const pair = graphDemoSocketPair(false);
      return [pair?.output, pair?.input]
        .filter(tourElementActuallyVisible);
    };
    const visibleNotFlipNode = () => {
      const visibleFlipNodes = [...document.querySelectorAll(
        ".rml-graph-node"
      )].filter(node =>
        tourElementActuallyVisible(node) &&
        node.querySelector(".rml-graph-node-flip")
      );
      return visibleFlipNodes.find(node =>
        /(?:^|\s)NOT(?:\s|$)/i.test(
          graphDemoNodeTitle(node)
        )
      ) || null;
    };
    const visibleTopbarTarget = selector => () => {
      const element = document.querySelector(selector);
      return tourElementActuallyVisible(element) ? element : null;
    };
    const compactTopbar = tourElementActuallyVisible(
      document.querySelector("#top-menu-toggle")
    );
    const topbarStatusSegment = {
        targets: () => [
          document.querySelector(".local-state"),
          document.querySelector("#api-catalog-state")
        ].filter(tourElementActuallyVisible),
        text: "The two status messages show whether the current work was saved in the browser and whether the Resonite library is available. They provide information and are not clickable actions in this demonstration."
      };
    const topbarNarrationSegments = [
      ...(compactTopbar ? [{
        targets: visibleTopbarTarget("#top-menu-toggle"),
        text: "On smaller screens, the menu button appears first while the menu is closed. Opening it reveals the actions that will be introduced next.",
        afterNarrationAction: "open-responsive-topbar"
      }] : [topbarStatusSegment]),
      {
        targets: visibleTopbarTarget("#new-blank"),
        responsiveMenuHandoffTarget: "#new-blank",
        text: "New blank starts an empty project after a confirmation. It is explained here without replacing the current tour project."
      },
      {
        targets: visibleTopbarTarget("#information-open"),
        text: "Help provides controls, shortcuts and references for the Configuration Outline and Runtime Graph."
      },
      {
        targets: visibleTopbarTarget("#setup-guide-open"),
        text: "Tour opens this guided walkthrough. Because this walkthrough is already active, the button is explained here and deliberately not pressed again."
      },
      {
        targets: visibleTopbarTarget("#preview-open"),
        text: "Preview shows how the finished settings will look. Changes made there remain in the preview until they are deliberately applied."
      },
      {
        targets: visibleTopbarTarget("#project-manager"),
        text: "Project saves or loads a Builder project. Save JSON creates a backup file; the button is introduced here but is not pressed."
      },
      {
        targets: visibleTopbarTarget("#download-code"),
        text: "Export provides the generated files for viewing, copying or downloading. The window is opened briefly and then closed again."
      }
    ];

    const byDemo = {
      "topbar-identity-workflow": [
        ...topbarNarrationSegments,
        {
          targets: allIdentityFields(["mod-name", "author", "version"]),
          text: "Mod name, author and version identify the project and its generated files."
        },
        {
          targets: allIdentityFields(["namespace-name", "class-name", "mod-description"]),
          text: "Namespace, class name and description complete the mod details. The demonstration fills all six fields with an example."
        }
      ],
      "outline-palette": [
        {
          targets: ".palette.panel",
          text: "The list on the left contains the controls that can be added to the Configuration Outline."
        },
        {
          targets: ".canvas.panel",
          revealTargetBeforeNarration: ".canvas.panel",
          text: "The Configuration Outline shows the destination and the insertion line for the new control."
        }
      ],
      "outline-reorder-scroll": [
        {
          targets: ".canvas.panel",
          text: "An existing control can be moved to another position. Holding it near the edge moves the page until the destination and insertion line become visible."
        }
      ],
      "outline-nested": [
        {
          targets: visibleController,
          text: "General contains Enabled and Scale, while Advanced contains Quality and DetailSection. Moving General keeps its controls together."
        },
        {
          targets: () => tourVisibleTargets(".node-card.controller .option-lane"),
          text: "While General is held, the wheel moves the insertion line from left to right. The mouse remains still until the new position is selected."
        }
      ],
      "outline-properties": [
        {
          targets: ".canvas.panel",
          text: "A different Button is selected so the change of selection is easy to recognize."
        },
        {
          targets: ".inspector.panel",
          text: "Properties contains the Description and every other option available for the selected control."
        }
      ],
      "mode-switch-graph": [
        {
          targets: ".rml-pack-button",
          responsiveMenuHandoffTarget: "#pack-into-node",
          text: "Pack into Node changes from the Configuration Outline to the Runtime Graph."
        }
      ],
      "graph-create-node": [
        {
          targets: ".rml-graph-palette",
          text: "The Node library on the left contains the nodes available for the graph."
        },
        {
          targets: ".rml-graph-viewport",
          text: "One NOT node is placed where it remains fully visible. An existing NOT node is reused instead of creating a duplicate."
        }
      ],
      "graph-wire": [
        {
          targets: visibleGraphWireNodes,
          separateTargets: true,
          graphWireHighlight: "nodes",
          text: "These are the two existing connection partners: the Start node provides the value, and the NOT node receives it. Both nodes glow together so their relationship is clear."
        },
        {
          targets: visibleGraphWirePorts,
          separateTargets: true,
          graphWireHighlight: "ports",
          text: "Now the exact endpoints glow separately. Drag from the output on Start to the matching input on NOT. Incompatible port types are rejected, and no additional node is created."
        }
      ],
      "graph-flip": [
        {
          targets: visibleNotFlipNode,
          text: "The side-switch button moves the NOT node's ports and connections to the opposite side. Pressing it again restores the original arrangement."
        }
      ],
      "graph-pan": [
        {
          targets: ".rml-graph-toolbar",
          text: "Center Graph brings the complete graph back into view. Minus and plus adjust its size."
        },
        {
          targets: ".rml-graph-viewport",
          text: "The wheel moves the graph. Shift moves it sideways, while Ctrl or Command selects which area should respond to the wheel."
        }
      ],
      "graph-route": [
        {
          targets: ".rml-graph-viewport",
          text: "Dragging a node by its title changes its position. An existing line accepts another input and creates a movable junction; dragging that visible point reshapes all three connected line sections. Suitable existing nodes are reused whenever possible."
        }
      ],
      "graph-inspector": [
        {
          targets: ".rml-graph-panel-toggle-right, [data-rml-graph-toggle-right]",
          text: "The Node inspector is still hidden so the graph keeps the same spacious layout as the previous lesson. This visible sidebar button now opens it before its contents are explained.",
          afterNarrationAction: "open-graph-right-sidebar"
        },
        {
          targets: ".rml-graph-viewport",
          text: "Select the node that should be changed."
        },
        {
          targets: ".rml-graph-inspector, .inspector.panel",
          text: "The Node inspector contains the options for the selected node and shows each change directly in the graph."
        }
      ],
      "mode-switch-outline-preview": [
        {
          targets: ".rml-pack-button",
          text: "The same view button returns to the Configuration Outline."
        },
        {
          targets: "#preview-open",
          text: "Preview then shows the settings created from the current project."
        }
      ],
      "project-workflow": [
        {
          targets: "#project-manager",
          text: "Project saves a backup or loads an earlier project. Loading always changes the current work and therefore remains a deliberate action."
        }
      ],
      "export-workflow": [
        {
          targets: "#download-code",
          text: "Export provides the generated files for viewing, copying or downloading without changing the project."
        }
      ],
      "help-workflow": [
        {
          targets: "#information-open",
          text: "Help provides references for the Configuration Outline, Runtime Graph, nodes and controls."
        }
      ]
    };

    return byDemo[step?.demo] || [{
      targets: () => findTarget(step),
      text: tourPlainText(step?.text)
    }];
  }

  function clearNarrationOutlines() {
    for (const group of narrationOutlineGroups) group.element?.remove?.();
    narrationOutlineGroups = [];
    activeNarrationTargets = [];
    if (stepPhase !== "demonstrating") {
      clearLiveControlsActiveObstacles();
    }
  }

  function narrationOutlineRect(targets) {
    const viewport = tourViewport();
    const rect = tourFocusRect(targets, 5);
    if (!rect) return null;
    const left = Math.max(viewport.left + 4, rect.left);
    const top = Math.max(viewport.top + 4, rect.top);
    const right = Math.min(viewport.right - 4, rect.right);
    const bottom = Math.min(viewport.bottom - 4, rect.bottom);
    if (right - left < 12 || bottom - top < 12) return null;
    return { left, top, right, bottom };
  }

  function updateNarrationOutlines() {
    for (const group of narrationOutlineGroups) {
      const targets = group.targets.filter(tourElementActuallyVisible);
      const rect = narrationOutlineRect(targets);
      if (!rect) {
        group.element.style.display = "none";
        continue;
      }
      group.element.style.cssText = [
        "display:block",
        `left:${rect.left}px`,
        `top:${rect.top}px`,
        `width:${rect.right - rect.left}px`,
        `height:${rect.bottom - rect.top}px`
      ].join(";");
    }
  }

  function addNarrationOutline(targets, { separateTargets = false } = {}) {
    const visible = tourVisibleTargets(targets);
    activeNarrationTargets = visible;
    if (!visible.length) return null;
    setLiveControlsActiveObstacles(
      visible,
      "narration-active-target"
    );
    const groups = separateTargets
      ? visible.map(target => [target])
      : [visible];
    const elements = groups.map(groupTargets => {
      const element = document.createElement("div");
      element.className = "rml-setup-narration-outline is-entering";
      element.setAttribute("aria-hidden", "true");
      document.getElementById("rml-setup-assistant")?.appendChild(element);
      narrationOutlineGroups.push({ element, targets: groupTargets });
      requestAnimationFrame(() => element.classList.remove("is-entering"));
      return element;
    });
    updateNarrationOutlines();
    return elements[0] || null;
  }

  function waitForNarrationScene(milliseconds) {
    return new Promise(resolve => {
      if (pendingNarrationAdvances > 0) {
        pendingNarrationAdvances -= 1;
        tourDebugRecord("queued-narration-advance-consumed", {
          pendingNarrationAdvances
        });
        resolve(true);
        return;
      }
      let settled = false;
      let timer = 0;
      const finish = advancedByInteraction => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        narrationAdvanceWaiters.delete(finish);
        const timerIndex = demoTimers.indexOf(timer);
        if (timerIndex >= 0) demoTimers.splice(timerIndex, 1);
        resolve(advancedByInteraction === true);
      };
      timer = window.setTimeout(
        () => finish(false),
        tourPresentationDuration(milliseconds)
      );
      demoTimers.push(timer);
      narrationAdvanceWaiters.add(finish);
    });
  }

  function resolveNarrationAdvanceWaiters(advancedByInteraction = false) {
    const waiters = [...narrationAdvanceWaiters];
    for (const finish of waiters) finish(advancedByInteraction);
    return waiters.length;
  }

  function advanceNarrationScene(origin = "primary-pointer") {
    if (stepPhase !== "narrating") return false;
    const advancedWaiters = resolveNarrationAdvanceWaiters(true);
    const queuedAdvance = advancedWaiters === 0;
    if (queuedAdvance) {
      pendingNarrationAdvances = Math.min(
        32,
        pendingNarrationAdvances + 1
      );
    }
    tourDebugRecord("narration-scene-advanced", {
      origin,
      advancedWaiters,
      queuedAdvance,
      pendingNarrationAdvances
    });
    tourDebugAssert(
      "narration-left-click-scene-skip",
      advancedWaiters > 0 || queuedAdvance,
      {
        origin,
        advancedWaiters,
        queuedAdvance,
        pendingNarrationAdvances,
        behavior: "reveal-current-text-and-advance-one-scene"
      }
    );
    return advancedWaiters > 0 || queuedAdvance;
  }

  async function typeNarrationText(text, runId, prefix = "") {
    const ui = elements();
    if (!ui.text) return false;
    const source = String(text || "");
    let rendered = prefix;
    for (let offset = 0; offset < source.length; offset += 1) {
      if (runId !== demoRunId) return false;
      rendered += source[offset];
      ui.text.textContent = rendered;
      const fit = fitNarrationCardToContent();
      const character = source[offset];
      let readingDelay = TOUR_SCROLL_TIMING.narrationCharacterInterval;
      if (character === "\n") {
        readingDelay += TOUR_SCROLL_TIMING.narrationParagraphPause;
      } else if (/[.!?]/.test(character)) {
        readingDelay += TOUR_SCROLL_TIMING.narrationSentencePause;
      } else if (/[,;:]/.test(character)) {
        readingDelay += TOUR_SCROLL_TIMING.narrationClausePause;
      } else if (/\s/.test(character)) {
        readingDelay += TOUR_SCROLL_TIMING.narrationWordPause;
      }
      if (fit?.autoScrolled) {
        readingDelay += TOUR_SCROLL_TIMING.narrationAutoScrollReadPause;
      }
      const effectiveReadingDelay = tourPresentationDuration(readingDelay);
      if (narrationReadingMetrics) {
        narrationReadingMetrics.plannedReadingDelayMs += effectiveReadingDelay;
        narrationReadingMetrics.typedCharacters += 1;
        if (fit?.autoScrolled) {
          narrationReadingMetrics.autoScrollCount += 1;
          narrationReadingMetrics.autoScrollPauseCount += 1;
        }
        narrationReadingMetrics.activeLineAlwaysVisible &&=
          fit?.activeLineVisible !== false;
      }
      const advanced = await waitForNarrationScene(readingDelay);
      if (advanced) {
        ui.text.textContent = prefix + source;
        fitNarrationCardToContent();
        return true;
      }
    }
    return false;
  }

  async function runNarrationSegmentAfterAction(
    segment,
    visibleTargets,
    completeText,
    runId
  ) {
    if (runId !== demoRunId) {
      return true;
    }
    if (segment?.afterNarrationAction === "open-graph-right-sidebar") {
      const toggle = document.querySelector(
        ".rml-graph-panel-toggle-right, [data-rml-graph-toggle-right]"
      );
      const hiddenBefore = graphSidebarIsHidden("right");
      const finalToggleVisibility = sampleGraphInspectorToggleVisibility(
        toggle,
        "explanation-complete"
      );
      const toggleVisibilityState = graphInspectorToggleVisibilityState;
      const toggleStayedVisible = Boolean(
        toggleVisibilityState &&
        toggleVisibilityState.samples >= 2 &&
        toggleVisibilityState.violations === 0 &&
        finalToggleVisibility.passed
      );
      graphInspectorToggleVisibilityState = null;
      const explainedWhileHidden = tourDebugAssert(
        "graph-inspector-sidebar-explained-before-visible-open",
        hiddenBefore &&
          toggle instanceof HTMLElement &&
          visibleTargets.includes(toggle) &&
          toggleStayedVisible &&
          completeText.includes(String(segment.text || "")),
        {
          hiddenBefore,
          toggleVisible: finalToggleVisibility.passed,
          toggleFullyInsideViewport:
            finalToggleVisibility.fullyInsideViewport,
          toggleUncoveredByDescriptionAndSkipControls:
            finalToggleVisibility.uncoveredByTourUi,
          toggleCenterHitTestPassed:
            finalToggleVisibility.centerHitTestPassed,
          toggleVisibilitySamples:
            toggleVisibilityState?.samples || 0,
          toggleVisibilityViolations:
            toggleVisibilityState?.violations || 0,
          minimumToggleVisibleRatio:
            toggleVisibilityState?.minimumVisibleRatio || 0,
          minimumToggleUncoveredRatio:
            toggleVisibilityState?.minimumUncoveredRatio || 0,
          maximumToggleBlockerOverlapArea:
            toggleVisibilityState?.maximumBlockerOverlapArea || 0,
          firstToggleVisibilityViolation:
            toggleVisibilityState?.firstViolation || null,
          toggleWasNarrationTarget: visibleTargets.includes(toggle),
          explanationRenderedBeforeOpen:
            completeText.includes(String(segment.text || "")),
          policy:
            "the real right-sidebar arrow must remain fully inside the usable viewport, uncovered by the narration card and Skip controls, and perceptually hit-testable throughout its explanation"
        }
      );
      if (!explainedWhileHidden) {
        throw new Error(
          "[RML Tour · Graph inspector] The right sidebar was not explained while it was still hidden."
        );
      }

      clearNarrationOutlines();
      const revealPanel = document.querySelector(
        ".workspace > .inspector.panel, .workspace > .inspector, .rml-graph-inspector"
      );
      narrationReservedRevealRect = measureHiddenGraphInspectorRevealRect();
      fitNarrationCardToContent({ followText: false });
      await nextTwoFrames();
      const preparedCoverage = graphInspectorRevealCoverage(
        narrationReservedRevealRect
      );
      const corridorPrepared = tourDebugAssert(
        "graph-inspector-reveal-corridor-reserved-before-open",
        Boolean(
          narrationReservedRevealRect &&
          preparedCoverage &&
          preparedCoverage.actualUncoveredRatio >=
            preparedCoverage.bestPossibleUncoveredRatio - .035
        ),
        {
          revealRect: narrationReservedRevealRect,
          cardRect: tourDebugRect(elements().card),
          ...preparedCoverage,
          policy:
            "reserve the complete future inspector footprint before the teacher opens it; when the viewport is tight, use the mathematically least-obstructing readable card position"
        }
      );
      if (!corridorPrepared) {
        narrationReservedRevealRect = null;
        throw new Error(
          "[RML Tour · Graph inspector] No unobstructed reveal corridor could be reserved before opening the right sidebar."
        );
      }

      let clicked = false;
      let revealSamples = [];
      const hideCardDuringReveal =
        preparedCoverage.bestPossibleUncoveredRatio < .995;
      const narrationCard = elements().card;
      if (hideCardDuringReveal) {
        narrationCard?.classList.add(
          "rml-setup-card-hidden-during-panel-reveal"
        );
      }
      revealPanel?.classList.add("rml-setup-graph-panel-visible-reveal");
      try {
        clicked = await teacherClickElement(
          toggle,
          "Open the real Node inspector sidebar",
          runId,
          {
            focus: document.querySelector(".workspace"),
            keepFocusVisible: true,
            preserveCardPlacement: true
          }
        );
        if (
          revealPanel instanceof HTMLElement &&
          !clipRectToTourViewport(revealPanel.getBoundingClientRect())
        ) {
          hardHideTeacherMouse("graph-inspector-reveal-scroll");
          revealPanel.scrollIntoView({
            behavior: "auto",
            block: "start",
            inline: "nearest"
          });
          await nextTwoFrames();
        }
        revealSamples = await sampleGraphInspectorRevealCoverage(
          revealPanel,
          runId,
          440
        );
        await nextTwoFrames();
      } finally {
        revealPanel?.classList.remove("rml-setup-graph-panel-visible-reveal");
        narrationCard?.classList.remove(
          "rml-setup-card-hidden-during-panel-reveal"
        );
        narrationReservedRevealRect = null;
      }
      const visibleRevealSamples = revealSamples.filter(sample =>
        Number.isFinite(sample.actualUncoveredRatio)
      );
      const minimumRevealCoverage = visibleRevealSamples.length
        ? Math.min(...visibleRevealSamples.map(sample =>
            sample.actualUncoveredRatio
          ))
        : 0;
      const minimumBestPossibleCoverage = visibleRevealSamples.length
        ? Math.min(...visibleRevealSamples.map(sample =>
            sample.bestPossibleUncoveredRatio
          ))
        : 0;
      const revealUnobstructed = tourDebugAssert(
        "graph-inspector-opening-animation-unobstructed-by-description-card",
        visibleRevealSamples.length > 0 &&
          visibleRevealSamples.every(sample =>
            sample.actualUncoveredRatio >=
              sample.bestPossibleUncoveredRatio - .045
          ),
        {
          sampleCount: visibleRevealSamples.length,
          minimumRevealCoverage,
          minimumBestPossibleCoverage,
          cardHiddenOnlyWhenNoFreeReadableCorridor:
            hideCardDuringReveal,
          finalCardRect: tourDebugRect(elements().card),
          finalInspectorRect: tourDebugRect(revealPanel),
          policy:
            "the narration card must never cover the inspector opening animation when a non-overlapping readable position exists"
        }
      );
      const opened = tourDebugAssert(
        "graph-inspector-sidebar-opened-visibly-after-explanation",
        clicked === true &&
          !graphSidebarIsHidden("right") &&
          revealUnobstructed,
        {
          hiddenBefore,
          openedByTeacher: clicked === true,
          rightOpen: !graphSidebarIsHidden("right"),
          revealUnobstructed,
          revealSampleCount: visibleRevealSamples.length
        }
      );
      fitNarrationCardToContent({ followText: false });
      if (!opened) {
        throw new Error(
          "[RML Tour · Graph inspector] The real right sidebar did not open in an unobstructed visible corridor after its explanation."
        );
      }
      const teachingPair = await ensureGraphTeachingPairVisible(runId);
      if (runId !== demoRunId) return true;
      const pairVisibleAfterSidebarOpen = tourDebugAssert(
        "graph-inspector-teaching-pair-visible-after-sidebar-open",
        graphTeachingPairCompletelyVisible(teachingPair, 10),
        {
          teachingNodeIds: [
            teachingPair?.boolNode?.dataset?.graphNodeId || "",
            teachingPair?.notNode?.dataset?.graphNodeId || ""
          ].filter(Boolean),
          graphVisibleRect: visibleGraphClientRect(10),
          graphViewportRect: tourDebugRect(
            document.querySelector(".rml-graph-viewport")
          ),
          rightSidebarOpen: !graphSidebarIsHidden("right"),
          policy:
            "after the animated inspector reveal, the page returns to the graph and refits both complete teaching nodes inside the reduced live graph viewport before narration continues"
        }
      );
      if (!pairVisibleAfterSidebarOpen) {
        throw new Error(
          "[RML Tour · Graph inspector] The complete teaching pair was not visible after opening the right sidebar."
        );
      }
      return true;
    }
    if (segment?.afterNarrationAction !== "open-responsive-topbar") {
      return true;
    }

    const before = responsiveTopActionsState();
    const hamburgerOutline = narrationOutlineGroups.find(group =>
      group?.targets?.includes?.(before.toggle) &&
      tourElementActuallyVisible(group.element)
    ) || null;
    const hamburgerWasExplainedClosed = tourDebugAssert(
      "mobile-topbar-hamburger-explained-before-open",
      before.responsive === true &&
        before.open === false &&
        visibleTargets.includes(before.toggle) &&
        Boolean(hamburgerOutline) &&
        completeText.includes(String(segment.text || "")),
      {
        actionsOpenDuringExplanation: before.open,
        ariaExpandedDuringExplanation:
          before.toggle?.getAttribute("aria-expanded") || "false",
        hamburgerHighlightedDuringExplanation: Boolean(hamburgerOutline),
        glowTargetsRealHamburger:
          hamburgerOutline?.targets?.includes?.(before.toggle) === true,
        explanationRenderedBeforeOpen:
          completeText.includes(String(segment.text || ""))
      }
    );
    if (!hamburgerWasExplainedClosed) {
      throw new Error(
        "[RML Tour · Step 1] The compact Hamburger was not fully explained while the menu was still closed."
      );
    }

    clearNarrationOutlines();
    const clicked = await teacherClickElement(
      before.toggle,
      "",
      runId,
      { focus: document.querySelector(".topbar"), keepFocusVisible: true }
    );
    await wait(260);
    await nextTwoFrames();
    const after = responsiveTopActionsState();
    const firstAction = document.querySelector("#new-blank");
    mobileTopbarPreparedForNarration = Boolean(
      clicked === true &&
      after.open === true &&
      tourElementActuallyVisible(firstAction)
    );
    const opened = tourDebugAssert(
      "mobile-topbar-hamburger-opened-before-actions",
      mobileTopbarPreparedForNarration,
      {
        openedByTeacher: clicked === true && after.open === true,
        explainedBeforeOpen: hamburgerWasExplainedClosed,
        openedAfterHamburgerExplanation: true,
        ariaExpanded: after.toggle?.getAttribute("aria-expanded") || "false",
        actionsOpen: after.open,
        firstActionVisible: tourElementActuallyVisible(firstAction)
      }
    );
    if (!opened) {
      throw new Error(
        "[RML Tour · Step 1] The real Hamburger did not open after its explanation and before the action buttons."
      );
    }
    return true;
  }

  async function beginStepNarration(step, index, runId) {
    const ui = elements();
    const root = ui.root;
    if (!step?.demo || !root || runId !== demoRunId) return;

    root.classList.add("rml-setup-narration-active");
    root.classList.remove("rml-setup-preparing-next");
    clearNarrationOutlines();
    clearTarget();
    positionShades(null, { force: true });
    positionCard(null, { force: true });
    ui.text.textContent = "";
    ui.hint.hidden = true;
    setStepPhase("narrating");
    fitNarrationCardToContent({ reset: true });

    const narrationStarted = performance.now();
    const segments = narrationSegmentsForStep(step);
    const expectedTypedCharacterCount = segments.reduce(
      (sum, segment) => sum + String(segment.text || "").length,
      0
    );
    let completedSegments = 0;
    let highlightedSegments = 0;
    let interactionAdvancedSegments = 0;
    let finalSegmentTextCompletedAt = 0;
    let finalSegmentAdvancedByInteraction = false;
    narrationReadingMetrics = {
      typedCharacters: 0,
      plannedReadingDelayMs: 0,
      autoScrollCount: 0,
      autoScrollPauseCount: 0,
      activeLineAlwaysVisible: true
    };
    tourDebugRecord("natural-narration-started", {
      narratedStepIndex: index,
      segmentCount: segments.length,
      typedCharacterCount: expectedTypedCharacterCount
    });
    let completeText = "";
    for (const [segmentIndex, segment] of segments.entries()) {
      if (runId !== demoRunId || stepIndex !== index) return;
      clearNarrationOutlines();
      graphInspectorToggleVisibilityState = null;
      if (step.demo === "graph-pan" && segmentIndex === 0) {
        await prepareGraphPanToolbarForNarration(runId);
        if (runId !== demoRunId || stepIndex !== index) return;
      }
      if (segment?.afterNarrationAction === "open-graph-right-sidebar") {
        await prepareGraphInspectorToggleForNarration(runId);
        if (runId !== demoRunId || stepIndex !== index) return;
      }
      if (segment?.revealTargetBeforeNarration) {
        const revealTarget = document.querySelector(
          segment.revealTargetBeforeNarration
        );
        if (revealTarget instanceof HTMLElement) {
          await nativeTourScrollTargetIntoView(revealTarget, runId);
          await nextTwoFrames();
          if (!narrationOutlineRect([revealTarget])) {
            revealTarget.scrollIntoView({
              behavior: "auto",
              block: "center",
              inline: "nearest"
            });
            await nextTwoFrames();
          }
          if (!narrationOutlineRect([revealTarget])) {
            throw new Error(
              `[RML Tour · Step ${index}] The narration target could not be scrolled into a visible highlight area.`
            );
          }
          fitNarrationCardToContent({ followText: false });
        }
      }
      let visibleTargets = tourVisibleTargets(segment.targets);
      let compactMenuHandoff = null;
      if (
        (
          mobileTopbarPreparedForNarration ||
          mobilePackPreparedForNarration
        ) &&
        segment?.responsiveMenuHandoffTarget
      ) {
        compactMenuHandoff =
          await ensureCompactTopbarNarrationHandoff(
            segment.responsiveMenuHandoffTarget,
            runId
          );
        if (runId !== demoRunId || stepIndex !== index) return;
        visibleTargets = compactMenuHandoff.passed
          ? [compactMenuHandoff.action]
          : [];
      }
      if (visibleTargets.length > 0) {
        highlightedSegments += 1;
      }
      if (step.demo === "graph-wire") {
        const pair = graphDemoSocketPair(false);
        const expectedTargets = segment.graphWireHighlight === "nodes"
          ? [pair?.sourceNode, pair?.targetNode]
          : segment.graphWireHighlight === "ports"
            ? [pair?.output, pair?.input]
            : [];
        const exactExpectedTargets = expectedTargets.filter(Boolean);
        const exactTargetSet = new Set(exactExpectedTargets);
        const actualTargetSet = new Set(visibleTargets);
        const exactPairHighlighted = tourDebugAssert(
          segment.graphWireHighlight === "ports"
            ? "graph-wire-narration-highlights-exact-output-and-input"
            : "graph-wire-narration-highlights-both-existing-nodes",
          exactExpectedTargets.length === 2 &&
            actualTargetSet.size === 2 &&
            exactExpectedTargets.every(target => actualTargetSet.has(target)) &&
            visibleTargets.every(target => exactTargetSet.has(target)) &&
            visibleTargets.every(target =>
              !target.matches(".rml-graph-viewport")
            ),
          {
            segmentIndex,
            highlightRole: segment.graphWireHighlight || "",
            expectedTargetCount: exactExpectedTargets.length,
            actualTargetCount: visibleTargets.length,
            targetNodeIds: visibleTargets.map(target =>
              target.dataset?.graphNodeId || target.dataset?.nodeId || ""
            ),
            targetPortIds: visibleTargets.map(target =>
              target.dataset?.portId || ""
            ),
            includesWholeCanvas: visibleTargets.some(target =>
              target.matches(".rml-graph-viewport")
            ),
            policy:
              "Step 8 explains the two real teaching nodes first and their exact output/input second; the whole graph canvas is never substituted for either partner"
          }
        );
        if (!exactPairHighlighted) {
          throw new Error(
            "[RML Tour · Step 8] Narration did not resolve the exact Start → NOT teaching pair."
          );
        }
      }
      addNarrationOutline(visibleTargets, {
        separateTargets: segment?.separateTargets === true
      });
      if (segment?.afterNarrationAction === "open-graph-right-sidebar") {
        const toggle = document.querySelector(
          ".rml-graph-panel-toggle-right, [data-rml-graph-toggle-right]"
        );
        fitNarrationCardToContent({ followText: false });
        await nextTwoFrames();
        graphInspectorToggleVisibilityState = {
          toggle,
          samples: 0,
          violations: 0,
          minimumVisibleRatio: 1,
          minimumUncoveredRatio: 1,
          maximumBlockerOverlapArea: 0,
          firstViolation: null,
          lastProof: null
        };
        const initialToggleVisibility =
          sampleGraphInspectorToggleVisibility(
            toggle,
            "before-explanation"
          );
        const toggleReady = tourDebugAssert(
          "graph-inspector-toggle-fully-visible-before-explanation",
          visibleTargets.includes(toggle) &&
            initialToggleVisibility.passed,
          {
            toggleWasNarrationTarget: visibleTargets.includes(toggle),
            ...initialToggleVisibility,
            policy:
              "Step 12 may start the sidebar explanation only while the real expansion arrow is fully on-screen, uncovered, enabled and perceptually hit-testable"
          }
        );
        if (!toggleReady) {
          graphInspectorToggleVisibilityState = null;
          throw new Error(
            "[RML Tour · Graph inspector] The real right-sidebar expansion arrow was not completely visible before its explanation."
          );
        }
      }
      if (compactMenuHandoff) {
        const state = responsiveTopActionsState();
        const action = compactMenuHandoff?.action || null;
        const outline = narrationOutlineGroups.find(group =>
          group?.targets?.includes?.(action)
        ) || null;
        const outlineRect = outline
          ? narrationOutlineRect(outline.targets)
          : null;
        const resumed = tourDebugAssert(
          "mobile-topbar-narration-resumed-after-hamburger",
          compactMenuHandoff?.passed === true &&
            state.responsive === true &&
            state.open === true &&
            visibleTargets.includes(action) &&
            Boolean(outlineRect) &&
            outline?.element?.style?.display !== "none",
          {
            segmentIndex,
            actionsOpen: state.open,
            ariaExpanded:
              state.toggle?.getAttribute("aria-expanded") || "false",
            visibleTargetIds: visibleTargets.map(target => target.id || ""),
            stableSamples: compactMenuHandoff?.stableSamples || 0,
            repaired: compactMenuHandoff?.repaired === true,
            reopened: compactMenuHandoff?.reopened === true,
            recentered: compactMenuHandoff?.recentered === true,
            outlineRect,
            behavior:
              "the next narration scene starts only after the first real compact-menu action remains visible across consecutive live samples"
          }
        );
        if (!resumed) {
          const isPackHandoff =
            segment.responsiveMenuHandoffTarget === "#pack-into-node";
          throw new Error(
            isPackHandoff
              ? "[RML Tour · Step 6] Narration did not reach the visible Open Runtime Graph button after opening and scrolling the Hamburger menu."
              : "[RML Tour · Step 1] Narration did not resume on the first visible compact-menu action after opening the Hamburger."
          );
        }
      }
      tourDebugRecord("natural-narration-segment-started", {
        narratedStepIndex: index,
        segmentIndex,
        visibleHighlightCount: visibleTargets.length,
        targetIds: visibleTargets.map(
          target => target.id || target.className || target.tagName
        )
      });
      const separator = completeText ? "\n\n" : "";
      const prefix = completeText + separator;
      const advancedWhileTyping = await typeNarrationText(
        segment.text,
        runId,
        prefix
      );
      const segmentTextCompletedAt = performance.now();
      if (runId !== demoRunId || stepIndex !== index) return;
      if (advancedWhileTyping) {
        interactionAdvancedSegments += 1;
      }
      let segmentAdvancedByInteraction =
        advancedWhileTyping === true;
      completeText = prefix + segment.text;
      if (!advancedWhileTyping) {
        const advancedDuringHold = await waitForNarrationScene(
          TOUR_SCROLL_TIMING.narrationSectionHold
        );
        if (advancedDuringHold) {
          interactionAdvancedSegments += 1;
          segmentAdvancedByInteraction = true;
        }
      }
      completedSegments += 1;
      tourDebugRecord("natural-narration-segment-complete", {
        narratedStepIndex: index,
        segmentIndex,
        interactionAdvanced: segmentAdvancedByInteraction,
        renderedCharacterCount: completeText.length
      });
      await runNarrationSegmentAfterAction(
        segment,
        visibleTargets,
        completeText,
        runId
      );
      if (segmentIndex === segments.length - 1) {
        finalSegmentTextCompletedAt = segmentTextCompletedAt;
        finalSegmentAdvancedByInteraction =
          segmentAdvancedByInteraction;
      }
      if (runId !== demoRunId || stepIndex !== index) return;
    }

    if (runId !== demoRunId || stepIndex !== index) return;
    ui.hint.textContent = step.hint || "";
    ui.hint.hidden = !step.hint;
    fitNarrationCardToContent();
    const hintRevealGapMs = finalSegmentTextCompletedAt > 0
      ? Math.round(performance.now() - finalSegmentTextCompletedAt)
      : 0;
    const effectiveSectionGapMs = tourPresentationDuration(
      TOUR_SCROLL_TIMING.narrationSectionHold
    );
    const hintGapVerified = tourDebugAssert(
      `tour-step-${index}-hint-follows-explanation-with-paragraph-sized-gap`,
      !step.hint ||
      finalSegmentAdvancedByInteraction ||
      (
        TOUR_SCROLL_TIMING.narrationSectionHold ===
          TOUR_SCROLL_TIMING.narrationParagraphPause &&
        hintRevealGapMs >= effectiveSectionGapMs * .8 &&
        hintRevealGapMs <= effectiveSectionGapMs * 1.8 + 90
      ),
      {
        hintVisible: Boolean(step.hint && ui.hint.hidden === false),
        hintRevealGapMs,
        configuredSectionGapMs:
          TOUR_SCROLL_TIMING.narrationSectionHold,
        configuredParagraphGapMs:
          TOUR_SCROLL_TIMING.narrationParagraphPause,
        effectiveSectionGapMs,
        presentationSpeed: TOUR_PRESENTATION_SPEED,
        advancedByUserInteraction:
          finalSegmentAdvancedByInteraction,
        behavior:
          "the blue hint appears after the same short reading pause used between explanation paragraphs"
      }
    );
    if (!hintGapVerified) {
      throw new Error(
        "[RML Tour · Narration] The final hint did not follow the explanation with the configured paragraph-sized gap."
      );
    }
    const explanationFontSize = Number.parseFloat(
      getComputedStyle(ui.text).fontSize
    );
    const hintFontSize = Number.parseFloat(
      getComputedStyle(ui.hint).fontSize
    );
    const hintFontVerified = tourDebugAssert(
      `tour-step-${index}-hint-font-size-matches-explanation`,
      !step.hint ||
      (
        Number.isFinite(explanationFontSize) &&
        Number.isFinite(hintFontSize) &&
        Math.abs(explanationFontSize - hintFontSize) <= .25
      ),
      {
        explanationFontSize,
        hintFontSize,
        difference: Math.abs(explanationFontSize - hintFontSize),
        behavior:
          "the blue hint uses the same readable type size as the explanation above it"
      }
    );
    if (!hintFontVerified) {
      throw new Error(
        "[RML Tour · Narration] The final hint font size differs from the explanation font size."
      );
    }
    setStepPhase("ready");

    fitNarrationCardToContent({ followText: false });
    const readyControlsVisible = Boolean(
      ui.next &&
      !ui.next.hidden &&
      !ui.next.disabled &&
      ui.skipDemo &&
      !ui.skipDemo.hidden &&
      !ui.skipDemo.disabled
    );
    tourDebugAssert(
      `tour-step-${index}-hint-readable-hold`,
      (!step.hint || ui.hint.hidden === false) &&
        readyControlsVisible,
      {
        hintVisible: Boolean(step.hint && ui.hint.hidden === false),
        hintHoldDurationMs: 0,
        configuredHintHoldMs: 0,
        effectiveHintHoldMs: 0,
        presentationSpeed: TOUR_PRESENTATION_SPEED,
        advancedByUserInteraction: false,
        readyControlsVisible,
        demonstrateVisible: Boolean(ui.next && !ui.next.hidden),
        skipDemonstrationVisible: Boolean(
          ui.skipDemo && !ui.skipDemo.hidden
        ),
        behavior:
          "the final blue hint remains visible while the manual Demonstrate controls appear immediately, with no autonomous hold delay"
      }
    );
    assertAdaptiveNarrationCard(index);
    const narrationDurationMs = Math.round(
      performance.now() - narrationStarted
    );
    tourDebugAssert(
      `tour-step-${index}-readable-narration-and-line-scroll-pacing`,
      Boolean(narrationReadingMetrics) &&
        narrationReadingMetrics.typedCharacters > 0 &&
        narrationReadingMetrics.typedCharacters <=
          expectedTypedCharacterCount &&
        (
          narrationReadingMetrics.typedCharacters ===
            expectedTypedCharacterCount ||
          interactionAdvancedSegments > 0
        ) &&
        narrationReadingMetrics.plannedReadingDelayMs >=
          narrationReadingMetrics.typedCharacters *
            tourPresentationDuration(48) &&
        narrationReadingMetrics.autoScrollPauseCount ===
          narrationReadingMetrics.autoScrollCount &&
        narrationReadingMetrics.activeLineAlwaysVisible === true &&
        narrationDurationMs >=
          narrationReadingMetrics.plannedReadingDelayMs * .9,
      {
        ...narrationReadingMetrics,
        narrationDurationMs,
        baseCharacterIntervalMs:
          TOUR_SCROLL_TIMING.narrationCharacterInterval,
        effectiveBaseCharacterIntervalMs:
          tourPresentationDuration(
            TOUR_SCROLL_TIMING.narrationCharacterInterval
          ),
        presentationSpeed: TOUR_PRESENTATION_SPEED,
        autoScrollReadPauseMs:
          TOUR_SCROLL_TIMING.narrationAutoScrollReadPause,
        interactionAdvancedSegments,
        expectedTypedCharacterCount,
        behavior:
          "human-readable character pacing with punctuation pauses and one reading pause per automatic line scroll; an explicit narration-scene click may reveal the remaining text without invalidating the completed lesson"
      }
    );
    tourDebugAssert(
      `tour-step-${index}-full-preparation-and-natural-narration-complete`,
      completedSegments === segments.length &&
        highlightedSegments === segments.length &&
        interactionAdvancedSegments <= segments.length &&
        ui.text.textContent === completeText,
      {
        narratedStepIndex: index,
        segmentCount: segments.length,
        completedSegments,
        highlightedSegments,
        interactionAdvancedSegments,
        renderedCharacterCount: completeText.length,
        durationMs: narrationDurationMs,
        finalPhase: stepPhase
      }
    );
    const readyState = captureTourState();
    const readyEnvironment = captureTourEnvironmentState();
    stepReadySnapshots.set(index, readyState);
    stepReadyEnvironmentSnapshots.set(index, readyEnvironment);
    tourDebugAssert(
      `tour-step-${index}-repeat-ready-snapshot-captured`,
      Boolean(
        readyState &&
        readyEnvironment &&
        stepPhase === "ready" &&
        stepIndex === index
      ),
      {
        narratedStepIndex: index,
        phase: stepPhase,
        graphMode: readyEnvironment?.graphMode === true,
        graphRightPanelOpen:
          readyEnvironment?.graphRightCollapsed === false,
        policy:
          "Repeat previous restores the fully prepared Demonstrate state after narration, including panel reveals, instead of the earlier lesson-entry state"
      }
    );
  }

  async function beginStepNarrationSafely(step, index, runId) {
    if (narratedStepIndexes.has(index)) {
      blockedRepeatCount += 1;
      tourDebugAssert(
        `tour-step-${index}-narration-single-pass`,
        false,
        {
          blockedRepeat: true,
          policy: "one narration launch per lesson and tour session"
        }
      );
      return false;
    }
    narratedStepIndexes.add(index);
    tourDebugRecord("tour-narration-attempt-start", {
      narratedStepIndex: index,
      attempts: 1
    });
    try {
      await beginStepNarration(step, index, runId);
      if (runId !== demoRunId || stepIndex !== index) return false;
      tourDebugAssert(
        `tour-step-${index}-narration-promise-settled-without-rejection`,
        true,
        {
          narratedStepIndex: index,
          phase: stepPhase,
          policy:
            "every asynchronous narration is awaited by one contained launcher and can never become an unhandled promise rejection"
        }
      );
      return true;
    } catch (error) {
      if (runId !== demoRunId || stepIndex !== index) return false;
      tourDebugRecord("narration-error", {
        failedStepIndex: index,
        failedStepTitle: step?.title || "",
        failedDemo: step?.demo || "",
        errorName: error?.name || "Error",
        message: error?.message || String(error || "Unknown narration error"),
        stack: String(error?.stack || "")
      });
      tourDebugAssert(
        `tour-step-${index}-narration-promise-settled-without-rejection`,
        false,
        {
          narratedStepIndex: index,
          phase: stepPhase,
          message: error?.message || String(error || "Unknown narration error"),
          contained: true,
          policy:
            "a failed narration remains a failed test, but its promise is always handled and never escapes into the browser"
        }
      );
      console.error(
        "[RML Tour] Narration failed once. The lesson will advance without reopening or retrying.",
        error
      );
      clearNarrationOutlines();
      return advancePastFailedStep(index, runId, "narration");
    }
  }

  function clampSceneRect(rect, padding = 4) {
    if (!rect) return null;
    const viewport = tourEffectViewport();
    const left = Math.max(viewport.left + padding, rect.left - padding);
    const top = Math.max(viewport.top + padding, rect.top - padding);
    const right = Math.min(viewport.right - padding, rect.right + padding);
    const bottom = Math.min(viewport.bottom - padding, rect.bottom + padding);
    if (right - left < 24 || bottom - top < 24) return null;
    return { left, top, right, bottom };
  }

  function rectangleIntersectionArea(a, b) {
    if (!a || !b) return 0;
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    return width * height;
  }

  function clipRectToTourViewport(rect, inset = 0) {
    if (!rect) return null;
    const viewport = tourViewport();
    const left = Math.max(viewport.left + inset, Number(rect.left) || 0);
    const top = Math.max(viewport.top + inset, Number(rect.top) || 0);
    const right = Math.min(
      viewport.right - inset,
      Number(rect.right) || 0
    );
    const bottom = Math.min(
      viewport.bottom - inset,
      Number(rect.bottom) || 0
    );
    if (right - left < 2 || bottom - top < 2) return null;
    return {
      left,
      top,
      right,
      bottom,
      width: right - left,
      height: bottom - top
    };
  }

  function measureHiddenGraphInspectorRevealRect() {
    const panel = document.querySelector(
      ".workspace > .inspector.panel, .workspace > .inspector, .rml-graph-inspector"
    );
    if (!(panel instanceof HTMLElement)) return null;

    const body = document.body;
    const workspace = document.querySelector(".workspace");
    const collapsedClass = "rml-graph-right-collapsed";
    const wasCollapsed = body.classList.contains(collapsedClass);
    const saved = new Map([
      ["visibility", rememberInlineProperty(panel, "visibility")],
      ["pointer-events", rememberInlineProperty(panel, "pointer-events")],
      ["animation", rememberInlineProperty(panel, "animation")],
      ["transition", rememberInlineProperty(panel, "transition")]
    ]);

    try {
      panel.style.setProperty("visibility", "hidden", "important");
      panel.style.setProperty("pointer-events", "none", "important");
      panel.style.setProperty("animation", "none", "important");
      panel.style.setProperty("transition", "none", "important");
      body.classList.remove(collapsedClass);
      void (workspace?.offsetWidth || panel.offsetWidth);
      const measured = panel.getBoundingClientRect();
      const clipped = clipRectToTourViewport(measured);
      if (clipped) return clipped;

      const viewport = tourViewport();
      const width = Math.min(measured.width, viewport.width);
      const height = Math.min(measured.height, viewport.height);
      const left = Math.max(
        viewport.left,
        Math.min(measured.left, viewport.right - width)
      );
      return {
        left,
        top: viewport.top,
        right: left + width,
        bottom: viewport.top + height,
        width,
        height
      };
    } finally {
      if (wasCollapsed) body.classList.add(collapsedClass);
      for (const [property, value] of saved) {
        restoreInlineProperty(panel, property, value);
      }
      void (workspace?.offsetWidth || panel.offsetWidth);
    }
  }

  function graphInspectorRevealCoverage(revealRect) {
    const visibleReveal = clipRectToTourViewport(revealRect);
    const card = elements().card;
    if (!visibleReveal || !(card instanceof HTMLElement)) return null;
    const viewport = tourViewport();
    const margin = viewport.width <= 780 ? 9 : 12;
    const measuredCard = card.getBoundingClientRect();
    const width = Math.min(
      measuredCard.width,
      Math.max(1, viewport.width - margin * 2)
    );
    const height = Math.min(
      measuredCard.height,
      Math.max(1, viewport.height - margin * 2)
    );
    const revealArea = visibleReveal.width * visibleReveal.height;
    if (!(revealArea > 0)) return null;

    const uncoveredRatio = rect => Math.max(
      0,
      1 - rectangleIntersectionArea(rect, visibleReveal) / revealArea
    );
    const cardVisuallyYielded = card.classList.contains(
      "rml-setup-card-hidden-during-panel-reveal"
    );
    const actualUncoveredRatio = cardVisuallyYielded
      ? 1
      : uncoveredRatio(measuredCard);
    const lefts = [
      viewport.left + margin,
      viewport.left + (viewport.width - width) / 2,
      viewport.right - width - margin
    ];
    const tops = [
      viewport.top + margin,
      viewport.top + (viewport.height - height) / 2,
      viewport.bottom - height - margin
    ];
    let bestPossibleUncoveredRatio = 0;
    for (const left of lefts) {
      for (const top of tops) {
        bestPossibleUncoveredRatio = Math.max(
          bestPossibleUncoveredRatio,
          uncoveredRatio({
            left,
            top,
            right: left + width,
            bottom: top + height
          })
        );
      }
    }
    return {
      actualUncoveredRatio,
      bestPossibleUncoveredRatio: cardVisuallyYielded
        ? 1
        : bestPossibleUncoveredRatio,
      overlapArea: cardVisuallyYielded
        ? 0
        : rectangleIntersectionArea(measuredCard, visibleReveal),
      cardVisuallyYielded,
      revealArea,
      revealRect: visibleReveal
    };
  }

  async function sampleGraphInspectorRevealCoverage(
    panel,
    runId,
    duration = 440
  ) {
    const samples = [];
    const started = performance.now();
    while (
      runId === demoRunId &&
      performance.now() - started <= duration
    ) {
      await tourNextVisualFrame();
      if (!(panel instanceof HTMLElement) || runId !== demoRunId) break;
      const coverage = graphInspectorRevealCoverage(
        panel.getBoundingClientRect()
      );
      if (coverage) samples.push(coverage);
    }
    return samples;
  }

  function setSemanticSceneState(state = "armed") {
    if (!activeSemanticScene) return;
    activeSemanticScene.state = state;
    const root = document.getElementById("rml-setup-assistant");
    if (root) root.dataset.setupSceneState = state;
    for (const element of activeSemanticScene.elements) {
      element.dataset.setupSceneState = state;
    }
  }

  function selectStableMinimumCardPlacement({
    card,
    candidates,
    obstacles = [],
    region,
    width,
    height,
    tolerance = 1
  }) {
    if (!(card instanceof HTMLElement) || !region) return null;
    const insideRegion = rectangle => Boolean(
      rectangle.left >= region.left - tolerance &&
      rectangle.top >= region.top - tolerance &&
      rectangle.right <= region.right + tolerance &&
      rectangle.bottom <= region.bottom + tolerance
    );
    const normalized = [];
    const seen = new Set();
    const add = candidate => {
      if (!Number.isFinite(candidate?.left) || !Number.isFinite(candidate?.top)) {
        return;
      }
      const rectangle = {
        left: candidate.left,
        top: candidate.top,
        right: candidate.left + width,
        bottom: candidate.top + height
      };
      if (!insideRegion(rectangle)) return;
      const key = `${Math.round(candidate.left)}:${Math.round(candidate.top)}`;
      if (seen.has(key)) return;
      seen.add(key);
      normalized.push({
        ...candidate,
        rect: rectangle,
        overlap: obstacles.reduce(
          (sum, obstacle) =>
            sum + rectangleIntersectionArea(rectangle, obstacle),
          0
        )
      });
    };
    for (const candidate of candidates || []) add(candidate);

    const currentRect = card.getBoundingClientRect();
    add({
      key: "current",
      left: currentRect.left,
      top: currentRect.top,
      current: true
    });
    if (!normalized.length) return null;

    normalized.sort((left, right) =>
      left.overlap - right.overlap ||
      Number(right.current) - Number(left.current) ||
      (right.distance || 0) - (left.distance || 0) ||
      String(left.key || "").localeCompare(String(right.key || ""))
    );
    const minimumOverlap = normalized[0].overlap;
    const current = normalized.find(candidate => candidate.current);
    const selected =
      current && current.overlap <= minimumOverlap + tolerance
        ? current
        : normalized[0];
    return {
      ...selected,
      retained: selected.current === true,
      minimumOverlap,
      minimumCollisionFallback: minimumOverlap > tolerance
    };
  }

  function placeCardOutsideSemanticScene() {
    const scene = activeSemanticScene;
    const { card } = elements();
    if (!scene || !card) return;

    const viewport = tourViewport();
    const margin = 12;
    card.classList.remove("rml-setup-card-hidden-during-scene");
    card.style.transform = "none";
    const measured = card.getBoundingClientRect();
    const width = Math.min(measured.width, Math.max(1, viewport.width - margin * 2));
    const height = Math.min(measured.height, Math.max(1, viewport.height - margin * 2));
    const candidates = [
      { left: viewport.left + margin, top: viewport.top + margin },
      { left: viewport.right - width - margin, top: viewport.top + margin },
      { left: viewport.left + margin, top: viewport.bottom - height - margin },
      { left: viewport.right - width - margin, top: viewport.bottom - height - margin },
      { left: scene.rect.left - width - 16, top: scene.rect.top },
      { left: scene.rect.right + 16, top: scene.rect.top },
      { left: scene.rect.left, top: scene.rect.top - height - 16 },
      { left: scene.rect.left, top: scene.rect.bottom + 16 }
    ].map(candidate => ({
      left: Math.max(viewport.left + margin, Math.min(candidate.left, viewport.right - width - margin)),
      top: Math.max(viewport.top + margin, Math.min(candidate.top, viewport.bottom - height - margin))
    }));

    const placement = selectStableMinimumCardPlacement({
      card,
      candidates,
      obstacles: [scene.rect],
      region: {
        left: viewport.left + margin,
        top: viewport.top + margin,
        right: viewport.right - margin,
        bottom: viewport.bottom - margin
      },
      width,
      height
    });
    if (!placement) return;

    card.style.left = `${placement.left}px`;
    card.style.top = `${placement.top}px`;
    card.dataset.minimumCollisionPlacement = placement.retained
      ? "retained"
      : placement.minimumCollisionFallback
        ? "fallback"
        : "clear";
  }

  function activateSemanticScene(step, target) {
    releaseSemanticScene();
    const sceneElements = semanticSceneElements(step, target);
    const rect = clampSceneRect(tourFocusRect(sceneElements, 0));
    if (!rect) return null;

    const root = document.getElementById("rml-setup-assistant");
    const primary = sceneElements.find(element =>
      element.matches?.(".canvas.panel, .rml-graph-viewport, .inspector.panel")
    ) || sceneElements[sceneElements.length - 1];

    activeSemanticScene = {
      stepIndex,
      demo: step?.demo || "",
      elements: sceneElements,
      primary,
      rect,
      state: "armed",
      locked: true
    };

    currentTarget?.classList.remove("rml-setup-target");
    root?.classList.add("rml-setup-scene-active");
    if (root) root.dataset.setupScene = step?.demo || "step";
    for (const element of sceneElements) {
      element.classList.add("rml-setup-scene-member");
    }
    primary?.classList.add("rml-setup-scene-primary");
    setSemanticSceneState("armed");
    positionShades(rect, { force: true });
    placeCardOutsideSemanticScene();
    return activeSemanticScene;
  }

  function transitionSemanticScene(targets, label = "section") {
    if (!activeSemanticScene?.locked) return null;
    const nextElements = (Array.isArray(targets) ? targets : [targets])
      .filter(tourElementActuallyVisible);
    const rect = clampSceneRect(tourFocusRect(nextElements, 0));
    if (!rect || !nextElements.length) return activeSemanticScene;

    for (const element of activeSemanticScene.elements) {
      element.classList.remove("rml-setup-scene-member", "rml-setup-scene-primary");
      delete element.dataset.setupSceneState;
    }

    activeSemanticScene.elements = [...new Set(nextElements)];
    activeSemanticScene.primary = activeSemanticScene.elements.find(element =>
      element.matches?.(".canvas.panel, .rml-graph-viewport, .inspector.panel, .code-panel")
    ) || activeSemanticScene.elements[activeSemanticScene.elements.length - 1];
    activeSemanticScene.rect = rect;
    activeSemanticScene.label = label;

    for (const element of activeSemanticScene.elements) {
      element.classList.add("rml-setup-scene-member");
    }
    activeSemanticScene.primary?.classList.add("rml-setup-scene-primary");
    setSemanticSceneState("armed");
    positionShades(rect, { force: true });
    placeCardOutsideSemanticScene();
    return activeSemanticScene;
  }

  function releaseSemanticScene() {
    const scene = activeSemanticScene;
    activeSemanticScene = null;
    const root = document.getElementById("rml-setup-assistant");
    root?.classList.remove("rml-setup-scene-active");
    if (root) {
      delete root.dataset.setupScene;
      delete root.dataset.setupSceneState;
    }
    elements().card?.classList.remove("rml-setup-card-hidden-during-scene");
    for (const element of scene?.elements || []) {
      element.classList.remove("rml-setup-scene-member", "rml-setup-scene-primary");
      delete element.dataset.setupSceneState;
    }
    if (tourElementActuallyVisible(currentTarget)) {
      currentTarget.classList.add("rml-setup-target");
    }
  }

  function showDragStage(target, label = "Drop target", state = "armed") {
    if (activeSemanticScene?.locked) {
      setSemanticSceneState(state);
      return activeSemanticScene.primary;
    }
    return null;
  }

  function setDragStageState(state) {
    if (activeSemanticScene?.locked) {
      setSemanticSceneState(state);
      return;
    }
  }

  function clearDragStage() {
    if (activeSemanticScene?.locked) setSemanticSceneState("armed");
  }

  function positionShades(target, options = {}) {
    const root = document.getElementById("rml-setup-assistant");
    const shades = [...(root?.querySelectorAll("[data-setup-shade]") || [])];
    if (shades.length !== 4) return;
    const byName = name => shades.find(item => item.dataset.setupShade === name);
    const viewport = tourViewport();
    const gap = 9;
    const subject = activeSemanticScene?.locked && options.force !== true
      ? activeSemanticScene.rect
      : target;
    if (!subject) {
      byName("top").style.cssText = `display:block;left:${viewport.left}px;top:${viewport.top}px;width:${viewport.width}px;height:${viewport.height}px`;
      for (const name of ["left", "right", "bottom"]) byName(name).style.cssText = "display:none";
      return;
    }
    for (const shade of shades) shade.style.display = "block";
    const rect = tourRect(subject);
    if (!rect) return positionShades(null, { force: true });
    const left = Math.max(viewport.left, rect.left - gap);
    const right = Math.min(viewport.right, rect.right + gap);
    const topY = Math.max(viewport.top, rect.top - gap);
    const bottomY = Math.min(viewport.bottom, rect.bottom + gap);
    byName("top").style.cssText = `display:block;left:${viewport.left}px;top:${viewport.top}px;width:${viewport.width}px;height:${Math.max(0, topY - viewport.top)}px`;
    byName("bottom").style.cssText = `display:block;left:${viewport.left}px;top:${bottomY}px;width:${viewport.width}px;height:${Math.max(0, viewport.bottom-bottomY)}px`;
    byName("left").style.cssText = `display:block;left:${viewport.left}px;top:${topY}px;width:${Math.max(0,left-viewport.left)}px;height:${Math.max(0,bottomY-topY)}px`;
    byName("right").style.cssText = `display:block;left:${right}px;top:${topY}px;width:${Math.max(0,viewport.right-right)}px;height:${Math.max(0,bottomY-topY)}px`;
  }

  function positionCard(target, options = {}) {
    const { card } = elements();
    if (!card) return;
    if (activeSemanticScene?.locked && options.force !== true) return;
    const viewport = tourViewport();
    const margin = 12;
    card.style.transform = "none";
    const cardRect = card.getBoundingClientRect();
    const cardWidth = Math.min(cardRect.width, Math.max(1, viewport.width));
    const cardHeight = Math.min(cardRect.height, Math.max(1, viewport.height));
    const horizontalMargin = Math.max(
      0,
      Math.min(margin, (viewport.width - cardWidth) / 2)
    );
    const verticalMargin = Math.max(
      0,
      Math.min(margin, (viewport.height - cardHeight) / 2)
    );

    if (target instanceof HTMLElement && stepPhase !== "demonstrating") {
      setLiveControlsActiveObstacles(
        [target],
        "explanation-card-active-target"
      );
    }
    const rect = tourRect(target) || tourFocusRect(
      liveControlsActiveObstacles(),
      5
    );
    const region = {
      left: viewport.left + horizontalMargin,
      top: viewport.top + verticalMargin,
      right: viewport.right - horizontalMargin,
      bottom: viewport.bottom - verticalMargin
    };
    const lefts = [
      region.left,
      region.left + (region.right - region.left - cardWidth) / 2,
      region.right - cardWidth
    ];
    const tops = [
      region.top,
      region.top + (region.bottom - region.top - cardHeight) / 2,
      region.bottom - cardHeight
    ];
    const candidates = [];
    for (const [row, top] of tops.entries()) {
      for (const [column, left] of lefts.entries()) {
        candidates.push({
          key: `${row}-${column}`,
          left,
          top
        });
      }
    }
    if (rect) {
      candidates.push(
        {
          key: "below-target",
          left: Math.max(region.left, Math.min(rect.left, region.right - cardWidth)),
          top: Math.max(region.top, Math.min(rect.bottom + 16, region.bottom - cardHeight))
        },
        {
          key: "above-target",
          left: Math.max(region.left, Math.min(rect.left, region.right - cardWidth)),
          top: Math.max(region.top, Math.min(rect.top - cardHeight - 16, region.bottom - cardHeight))
        }
      );
    }
    const placement = selectStableMinimumCardPlacement({
      card,
      candidates,
      obstacles: rect ? [rect] : [],
      region,
      width: cardWidth,
      height: cardHeight
    });
    if (!placement) return;
    card.style.left = `${placement.left}px`;
    card.style.top = `${placement.top}px`;
    card.dataset.minimumCollisionPlacement = placement.retained
      ? "retained"
      : placement.minimumCollisionFallback
        ? "fallback"
        : "clear";
  }

  function narrationCardOuterHeight(element) {
    if (!(element instanceof HTMLElement) || element.hidden) return 0;
    const style = getComputedStyle(element);
    if (style.display === "none") return 0;
    return element.getBoundingClientRect().height +
      (Number.parseFloat(style.marginTop) || 0) +
      (Number.parseFloat(style.marginBottom) || 0);
  }

  function revealActiveNarrationTargets() {
    const visible = activeNarrationTargets.filter(tourElementActuallyVisible);
    if (!visible.length) return false;
    const viewport = tourViewport();
    const rect = tourFocusRect(visible, 8);
    if (!rect) return false;
    const alreadyInside =
      rect.left >= viewport.left + 4 &&
      rect.top >= viewport.top + 4 &&
      rect.right <= viewport.right - 4 &&
      rect.bottom <= viewport.bottom - 4;
    if (!alreadyInside) {
      visible[0].scrollIntoView({
        block: "nearest",
        inline: "nearest",
        behavior: "auto"
      });
    }
    return true;
  }

  function preserveResponsiveNarrationTargets() {
    if (
      demoInFlight ||
      (stepPhase !== "narrating" && stepPhase !== "ready")
    ) {
      return false;
    }
    const state = responsiveTopActionsState();
    if (
      !state.responsive ||
      state.open ||
      !(state.actions instanceof HTMLElement)
    ) {
      return false;
    }
    const containsActiveTarget = activeNarrationTargets.some(target =>
      target instanceof Element && state.actions.contains(target)
    );
    if (!containsActiveTarget) return false;
    state.toggle?.click?.();
    tourDebugRecord("responsive-narration-menu-restored-after-resize", {
      narratedStepIndex: stepIndex,
      activeTargetCount: activeNarrationTargets.length,
      actionsOpen: responsiveTopActionsState().open
    });
    return true;
  }

  function narrationProtectedFocusRect() {
    const visibleTargets = activeNarrationTargets.filter(
      tourElementActuallyVisible
    );
    const targetFocus = narrationOutlineRect(visibleTargets);
    const step = steps[stepIndex];
    if (step?.demo !== "topbar-identity-workflow") {
      return targetFocus;
    }

    const topbar = document.querySelector(".topbar");
    const actions = document.querySelector("#top-actions");
    const targetsTopbarControl = visibleTargets.some(target =>
      topbar instanceof HTMLElement && topbar.contains(target)
    );
    if (!targetsTopbarControl) return targetFocus;

    const protectedElements = [topbar];
    if (tourElementActuallyVisible(actions)) {
      protectedElements.push(actions);
    }
    const topbarFocus = narrationOutlineRect(protectedElements);
    if (!targetFocus) return topbarFocus;
    if (!topbarFocus) return targetFocus;
    const viewport = tourViewport();
    return {
      left: Math.max(
        viewport.left + 4,
        Math.min(targetFocus.left, topbarFocus.left)
      ),
      top: Math.max(
        viewport.top + 4,
        Math.min(targetFocus.top, topbarFocus.top)
      ),
      right: Math.min(
        viewport.right - 4,
        Math.max(targetFocus.right, topbarFocus.right)
      ),
      bottom: Math.min(
        viewport.bottom - 4,
        Math.max(targetFocus.bottom, topbarFocus.bottom)
      )
    };
  }

  function narrationAdaptiveCardBounds({
    viewport,
    margin,
    baseMaximumWidth,
    baseMaximumHeight,
    minimumWidth,
    minimumHeight,
    desiredWidth,
    desiredHeight
  }) {
    const focus = narrationReservedRevealRect ||
      narrationProtectedFocusRect();
    const viewportRegion = {
      left: viewport.left + margin,
      top: viewport.top + margin,
      right: viewport.right - margin,
      bottom: viewport.bottom - margin
    };
    if (!focus) {
      return {
        key: "viewport",
        maximumWidth: baseMaximumWidth,
        maximumHeight: baseMaximumHeight,
        region: viewportRegion,
        focus: null,
        wholeGlowVisiblePossible: true,
        minimumWidth,
        minimumHeight
      };
    }

    const gap = viewport.width <= 780 ? 10 : 14;
    const rawRegions = [
      {
        key: "above-glow",
        left: viewportRegion.left,
        top: viewportRegion.top,
        right: viewportRegion.right,
        bottom: Math.min(viewportRegion.bottom, focus.top - gap)
      },
      {
        key: "below-glow",
        left: viewportRegion.left,
        top: Math.max(viewportRegion.top, focus.bottom + gap),
        right: viewportRegion.right,
        bottom: viewportRegion.bottom
      },
      {
        key: "left-of-glow",
        left: viewportRegion.left,
        top: viewportRegion.top,
        right: Math.min(viewportRegion.right, focus.left - gap),
        bottom: viewportRegion.bottom
      },
      {
        key: "right-of-glow",
        left: Math.max(viewportRegion.left, focus.right + gap),
        top: viewportRegion.top,
        right: viewportRegion.right,
        bottom: viewportRegion.bottom
      }
    ];
    const candidates = rawRegions.map(region => {
      const width = Math.max(0, region.right - region.left);
      const height = Math.max(0, region.bottom - region.top);
      const maximumWidth = Math.min(baseMaximumWidth, width);
      const maximumHeight = Math.min(baseMaximumHeight, height);
      return {
        ...region,
        width,
        height,
        maximumWidth,
        maximumHeight,
        supportsMinimum:
          maximumWidth >= minimumWidth &&
          maximumHeight >= minimumHeight,
        fitsDesired:
          maximumWidth >= Math.min(baseMaximumWidth, desiredWidth) &&
          maximumHeight >= Math.min(baseMaximumHeight, desiredHeight),
        usableArea: maximumWidth * maximumHeight
      };
    }).filter(candidate => candidate.supportsMinimum);
    candidates.sort((left, right) =>
      Number(right.fitsDesired) - Number(left.fitsDesired) ||
      right.usableArea - left.usableArea ||
      right.maximumHeight - left.maximumHeight ||
      right.maximumWidth - left.maximumWidth ||
      left.key.localeCompare(right.key)
    );
    const best = candidates[0] || null;
    if (best) {
      return {
        key: best.key,
        maximumWidth: best.maximumWidth,
        maximumHeight: best.maximumHeight,
        region: {
          left: best.left,
          top: best.top,
          right: best.right,
          bottom: best.bottom
        },
        focus,
        wholeGlowVisiblePossible: true,
        minimumWidth,
        minimumHeight,
        candidateCount: candidates.length
      };
    }

    const fallbackHeight = Math.min(
      baseMaximumHeight,
      Math.max(
        minimumHeight,
        Math.min(baseMaximumHeight, viewport.height * .48)
      )
    );
    return {
      key: "minimum-readable-overlap-fallback",
      maximumWidth: baseMaximumWidth,
      maximumHeight: fallbackHeight,
      region: null,
      focus,
      wholeGlowVisiblePossible: false,
      minimumWidth,
      minimumHeight,
      candidateCount: 0
    };
  }

  function positionNarrationCardAwayFromTargets(bounds = null) {
    const { card } = elements();
    if (!(card instanceof HTMLElement)) return null;

    const viewport = tourViewport();
    const margin = viewport.width <= 780 ? 9 : 12;
    const cardRect = card.getBoundingClientRect();
    const width = Math.min(
      cardRect.width,
      Math.max(1, viewport.width - margin * 2)
    );
    const height = Math.min(
      cardRect.height,
      Math.max(1, viewport.height - margin * 2)
    );
    const markedFocus = tourFocusRect(
      liveControlsActiveObstacles(),
      5
    );
    const focus = narrationReservedRevealRect ||
      narrationProtectedFocusRect() ||
      markedFocus;
    const viewportRegion = {
      left: viewport.left + margin,
      top: viewport.top + margin,
      right: viewport.right - margin,
      bottom: viewport.bottom - margin
    };
    const region =
      bounds?.region && bounds.wholeGlowVisiblePossible === true
        ? bounds.region
        : viewportRegion;
    const regionWidth = Math.max(0, region.right - region.left);
    const regionHeight = Math.max(0, region.bottom - region.top);
    const lefts = [
      region.left,
      region.left + (regionWidth - width) / 2,
      region.right - width
    ];
    const tops = [
      region.top,
      region.top + (regionHeight - height) / 2,
      region.bottom - height
    ];
    const candidates = [];
    const focusCenter = focus
      ? {
          x: (focus.left + focus.right) / 2,
          y: (focus.top + focus.bottom) / 2
        }
      : {
          x: viewport.left + viewport.width / 2,
          y: viewport.top + viewport.height / 2
        };
    for (const [row, top] of tops.entries()) {
      for (const [column, left] of lefts.entries()) {
        const cardCenter = {
          x: left + width / 2,
          y: top + height / 2
        };
        candidates.push({
          key: `${row}-${column}`,
          left,
          top,
          distance: Math.hypot(
            cardCenter.x - focusCenter.x,
            cardCenter.y - focusCenter.y
          )
        });
      }
    }
    const placement = selectStableMinimumCardPlacement({
      card,
      candidates,
      obstacles: focus ? [focus] : [],
      region,
      width,
      height
    });
    if (!placement) return null;
    card.style.transform = "none";
    card.style.left = `${placement.left}px`;
    card.style.top = `${placement.top}px`;
    card.dataset.minimumCollisionPlacement = placement.retained
      ? "retained"
      : placement.minimumCollisionFallback
        ? "fallback"
        : "clear";
    return {
      ...placement,
      key: placement.key || bounds?.key || "minimum-collision",
      wholeGlowVisiblePossible:
        bounds?.wholeGlowVisiblePossible === true
    };
  }

  function narrationSurfaceVisibility() {
    const ui = elements();
    const card = ui.card;
    const actions = card?.querySelector(".rml-setup-actions");
    const viewport = tourViewport();
    const viewportRect = {
      left: viewport.left,
      top: viewport.top,
      right: viewport.right,
      bottom: viewport.bottom
    };
    const cardRect = card?.getBoundingClientRect?.() || null;
    const actionRect = actions?.getBoundingClientRect?.() || null;
    const visibleControlRects = actions
      ? [...actions.querySelectorAll("button")]
          .filter(control => {
            if (!(control instanceof HTMLElement) || control.hidden) {
              return false;
            }
            const style = getComputedStyle(control);
            return (
              style.display !== "none" &&
              style.visibility !== "hidden"
            );
          })
          .map(control => control.getBoundingClientRect())
          .filter(rect => rect.width > 0 && rect.height > 0)
      : [];
    const inside = (inner, outer, tolerance = 1) => Boolean(
      inner && outer &&
      inner.left >= outer.left - tolerance &&
      inner.top >= outer.top - tolerance &&
      inner.right <= outer.right + tolerance &&
      inner.bottom <= outer.bottom + tolerance
    );
    const visibleOutlines = narrationOutlineGroups
      .map(group => group.element)
      .filter(element =>
        element instanceof HTMLElement &&
        getComputedStyle(element).display !== "none"
      );
    const glowRects = visibleOutlines.map(element =>
      element.getBoundingClientRect()
    );
    const glowUncoveredRatios = glowRects.map(rect => {
      const area = Math.max(0, rect.width * rect.height);
      if (area <= 0) return 1;
      return Math.max(
        0,
        1 - rectangleIntersectionArea(rect, cardRect) / area
      );
    });
    return {
      cardRect,
      actionRect,
      visibleControlRects,
      visibleControlCount: visibleControlRects.length,
      actionFrameFullyVisible:
        inside(actionRect, cardRect) && inside(actionRect, viewportRect),
      controlsFullyVisible:
        visibleControlRects.length > 0 &&
        visibleControlRects.every(rect =>
          inside(rect, cardRect) && inside(rect, viewportRect)
        ),
      cardFullyVisible: inside(cardRect, viewportRect),
      glowsFullyVisible: glowRects.every(rect =>
        inside(rect, viewportRect)
      ),
      glowCount: glowRects.length,
      glowUncoveredRatios,
      minimumGlowUncoveredRatio: glowUncoveredRatios.length
        ? Math.min(...glowUncoveredRatios)
        : 1,
      glowCardOverlapArea: glowRects.reduce(
        (sum, rect) => sum + rectangleIntersectionArea(rect, cardRect),
        0
      )
    };
  }

  function narrationFirstLineGeometry() {
    const ui = elements();
    const title = ui.title;
    const text = ui.text;
    if (
      !(title instanceof HTMLElement) ||
      !(text instanceof HTMLElement) ||
      !(text.textContent || "").length
    ) {
      return {
        measured: false,
        clearOfTitle: true,
        firstGlyphFullyVisible: true
      };
    }

    const walker = document.createTreeWalker(
      text,
      NodeFilter.SHOW_TEXT
    );
    let node = walker.nextNode();
    while (node && !(node.nodeValue || "").length) {
      node = walker.nextNode();
    }
    if (!node) {
      return {
        measured: false,
        clearOfTitle: true,
        firstGlyphFullyVisible: true
      };
    }

    const source = node.nodeValue || "";
    const offset = Math.max(0, source.search(/\S/));
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, Math.min(source.length, offset + 1));
    const glyphRect = range.getBoundingClientRect();
    range.detach?.();

    const titleRect = title.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    const textStyle = getComputedStyle(text);
    const marginTop = Number.parseFloat(textStyle.marginTop) || 0;
    const paddingTop = Number.parseFloat(textStyle.paddingTop) || 0;
    const requiredTitleGap = Math.max(8, marginTop - 2);
    const clearOfTitle =
      glyphRect.height > 0 &&
      glyphRect.top >= titleRect.bottom + requiredTitleGap;
    const firstGlyphFullyVisible =
      glyphRect.height > 0 &&
      glyphRect.top >= textRect.top + paddingTop - 1 &&
      glyphRect.bottom <= textRect.bottom + 1;
    return {
      measured: glyphRect.height > 0,
      clearOfTitle,
      firstGlyphFullyVisible,
      requiredTitleGap,
      titleRect: tourDebugRect(title),
      textRect: tourDebugRect(text),
      glyphRect: {
        left: glyphRect.left,
        top: glyphRect.top,
        right: glyphRect.right,
        bottom: glyphRect.bottom,
        width: glyphRect.width,
        height: glyphRect.height
      }
    };
  }

  function narrationLastGlyphRect(text) {
    if (!(text instanceof HTMLElement)) return null;
    const walker = document.createTreeWalker(
      text,
      NodeFilter.SHOW_TEXT
    );
    const nodes = [];
    let node = walker.nextNode();
    while (node) {
      if ((node.nodeValue || "").length) nodes.push(node);
      node = walker.nextNode();
    }
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const candidate = nodes[index];
      const source = candidate.nodeValue || "";
      let offset = source.length - 1;
      while (offset >= 0 && /\s/.test(source[offset])) offset -= 1;
      if (offset < 0) continue;
      const range = document.createRange();
      range.setStart(candidate, offset);
      range.setEnd(candidate, offset + 1);
      const rect = range.getBoundingClientRect();
      range.detach?.();
      return rect.height > 0 ? rect : null;
    }
    return null;
  }

  function followNarrationActiveLine(text, lineHeight) {
    if (!(text instanceof HTMLElement)) {
      return { autoScrolled: false, activeLineVisible: true };
    }
    const maximumScrollTop = Math.max(
      0,
      text.scrollHeight - text.clientHeight
    );
    const before = Math.min(text.scrollTop, maximumScrollTop);
    if (maximumScrollTop <= 1) {
      text.scrollTop = 0;
      return { autoScrolled: false, activeLineVisible: true };
    }

    let glyphRect = narrationLastGlyphRect(text);
    if (!glyphRect) {
      return { autoScrolled: false, activeLineVisible: true };
    }
    const textRect = text.getBoundingClientRect();
    const style = getComputedStyle(text);
    const paddingTop = Number.parseFloat(style.paddingTop) || 0;
    const paddingBottom = Number.parseFloat(style.paddingBottom) || 0;
    const visibleTop = textRect.top + paddingTop + 2;
    const visibleBottom =
      textRect.bottom - paddingBottom - Math.max(5, lineHeight * .2);
    let target = before;
    if (glyphRect.bottom > visibleBottom + 1) {
      target = Math.min(
        maximumScrollTop,
        before +
          (glyphRect.bottom - visibleBottom) +
          Math.max(5, lineHeight * .3)
      );
    } else if (glyphRect.top < visibleTop - 1) {
      target = Math.max(
        0,
        before - (visibleTop - glyphRect.top)
      );
    }
    text.scrollTop = target;
    const after = text.scrollTop;
    const autoScrolled = Math.abs(after - before) > 1;
    glyphRect = narrationLastGlyphRect(text);
    const activeLineVisible = Boolean(
      glyphRect &&
      glyphRect.top >= textRect.top + paddingTop - 1 &&
      glyphRect.bottom <= textRect.bottom - paddingBottom + 1
    );
    if (autoScrolled) {
      tourDebugRecord("narration-line-auto-scroll", {
        beforeScrollTop: before,
        afterScrollTop: after,
        maximumScrollTop,
        lineHeight,
        activeLineVisible,
        readingPauseMs:
          TOUR_SCROLL_TIMING.narrationAutoScrollReadPause
      });
    }
    return { autoScrolled, activeLineVisible };
  }

  function fitNarrationCardToContent({ reset = false, followText = true } = {}) {
    const ui = elements();
    const card = ui.card;
    const text = ui.text;
    if (!(card instanceof HTMLElement) || !(text instanceof HTMLElement)) {
      return null;
    }

    if (reset) {
      narrationCardMetrics = null;
      card.style.removeProperty("--rml-setup-adaptive-card-height");
      card.style.removeProperty("--rml-setup-adaptive-text-max-height");
      card.style.removeProperty("--rml-setup-adaptive-text-min-height");
    }

    const viewport = tourViewport();
    const margin = viewport.width <= 780 ? 9 : 12;
    const usableWidth = Math.max(260, viewport.width - margin * 2);
    const baseMaximumWidth = Math.min(
      usableWidth,
      viewport.width >= 1600
        ? 720
        : viewport.width >= 1100
          ? 640
          : viewport.width > 780
            ? 600
            : viewport.width > 520
              ? 560
              : usableWidth
    );
    let maximumWidth = baseMaximumWidth;
    let minimumWidth = viewport.width <= 520
      ? maximumWidth
      : Math.min(
          maximumWidth,
          Math.max(340, Math.min(480, viewport.width * .27))
        );
    const characterCount = text.textContent?.length || 0;
    const widthProgress = 1 - Math.exp(-characterCount / 260);
    const priorRequestedWidth =
      narrationCardMetrics?.requestedWidth || 0;
    const requestedWidthForBounds = () => {
      const contentDesiredWidth = Math.min(
        maximumWidth,
        minimumWidth + (maximumWidth - minimumWidth) * widthProgress
      );
      return Math.min(
        maximumWidth,
        Math.max(
          contentDesiredWidth,
          Math.min(maximumWidth, priorRequestedWidth)
        )
      );
    };
    let requestedWidth = requestedWidthForBounds();
    const viewportBoundHeight = Math.max(
      1,
      viewport.height - margin * 2
    );
    const baseMaximumHeight = viewport.width <= 780
      ? viewportBoundHeight
      : Math.min(720, viewportBoundHeight);
    let maximumHeight = baseMaximumHeight;

    const applyNarrationWidth = () => {
      card.style.setProperty(
        "--rml-setup-adaptive-card-width",
        `${Math.round(requestedWidth)}px`
      );
      card.style.setProperty(
        "--rml-setup-adaptive-card-max-width",
        `${Math.round(maximumWidth)}px`
      );
    };
    applyNarrationWidth();
    ui.root?.classList.add("rml-setup-adaptive-narration-card");

    const textStyle = getComputedStyle(text);
    const computedFontSize =
      Number.parseFloat(textStyle.fontSize) || 15;
    const computedLineHeight =
      Number.parseFloat(textStyle.lineHeight) ||
      computedFontSize * 1.56;
    const minimumVisibleTextLineCount = 3;
    const textVerticalPadding =
      (Number.parseFloat(textStyle.paddingTop) || 0) +
      (Number.parseFloat(textStyle.paddingBottom) || 0);
    const textVerticalBorders =
      (Number.parseFloat(textStyle.borderTopWidth) || 0) +
      (Number.parseFloat(textStyle.borderBottomWidth) || 0);
    const textVerticalMargins =
      (Number.parseFloat(textStyle.marginTop) || 0) +
      (Number.parseFloat(textStyle.marginBottom) || 0);
    const minimumTextHeight = Math.ceil(
      computedLineHeight * minimumVisibleTextLineCount +
      textVerticalPadding +
      textVerticalBorders +
      textVerticalMargins +
      2
    );
    card.style.setProperty(
      "--rml-setup-adaptive-text-min-height",
      `${minimumTextHeight}px`
    );

    const previousScrollTop = text.scrollTop;
    const measureNaturalCard = () => {
      card.style.setProperty(
        "--rml-setup-adaptive-card-max-height",
        "none"
      );
      card.style.setProperty("--rml-setup-adaptive-card-height", "auto");
      card.style.removeProperty("--rml-setup-adaptive-text-max-height");
      void card.offsetHeight;
      const naturalHeight = Math.max(
        card.scrollHeight,
        card.getBoundingClientRect().height
      );
      const naturalTextHeight = Math.max(
        minimumTextHeight,
        text.scrollHeight
      );
      const chromeHeight = Math.max(
        0,
        naturalHeight - naturalTextHeight
      );
      return { naturalHeight, naturalTextHeight, chromeHeight };
    };
    let measurement = measureNaturalCard();
    let adaptiveBounds = null;
    for (let pass = 0; pass < 2; pass += 1) {
      const minimumCardHeight = Math.min(
        baseMaximumHeight,
        measurement.chromeHeight + minimumTextHeight
      );
      const dynamicMinimumWidth = Math.min(
        baseMaximumWidth,
        viewport.width <= 520
          ? Math.max(260, Math.min(baseMaximumWidth, viewport.width * .68))
          : minimumWidth
      );
      adaptiveBounds = narrationAdaptiveCardBounds({
        viewport,
        margin,
        baseMaximumWidth,
        baseMaximumHeight,
        minimumWidth: dynamicMinimumWidth,
        minimumHeight: minimumCardHeight,
        desiredWidth: requestedWidth,
        desiredHeight: measurement.naturalHeight
      });
      maximumWidth = Math.max(
        dynamicMinimumWidth,
        adaptiveBounds.maximumWidth
      );
      maximumHeight = Math.max(
        minimumCardHeight,
        adaptiveBounds.maximumHeight
      );
      minimumWidth = Math.min(minimumWidth, maximumWidth);
      requestedWidth = requestedWidthForBounds();
      applyNarrationWidth();
      measurement = measureNaturalCard();
    }
    const naturalHeight = measurement.naturalHeight;
    const naturalTextHeight = measurement.naturalTextHeight;
    const chromeHeight = measurement.chromeHeight;
    const minimumCardHeight = Math.min(
      maximumHeight,
      chromeHeight + minimumTextHeight
    );
    const priorRequestedHeight = narrationCardMetrics?.requestedHeight || 0;
    let requestedHeight = Math.min(
      maximumHeight,
      Math.max(
        naturalHeight,
        minimumCardHeight,
        Math.min(maximumHeight, priorRequestedHeight)
      )
    );
    const maximumTextHeight = Math.max(
      0,
      requestedHeight - chromeHeight
    );
    card.style.setProperty(
      "--rml-setup-adaptive-card-max-height",
      `${Math.round(maximumHeight)}px`
    );
    card.style.setProperty(
      "--rml-setup-adaptive-card-height",
      `${Math.ceil(requestedHeight)}px`
    );
    void card.offsetHeight;
    text.scrollTop = Math.min(
      previousScrollTop,
      Math.max(0, text.scrollHeight - text.clientHeight)
    );

    let placement = positionNarrationCardAwayFromTargets(adaptiveBounds);
    updateNarrationOutlines();
    let cardRect = card.getBoundingClientRect();
    const overflowing = text.scrollHeight > text.clientHeight + 1;
    const lineFollow = followText && overflowing
      ? followNarrationActiveLine(text, computedLineHeight)
      : { autoScrolled: false, activeLineVisible: true };
    const fontSize = computedFontSize;
    let visibility = narrationSurfaceVisibility();
    let visibilityRepairApplied = false;
    if (
      !visibility.controlsFullyVisible ||
      !visibility.actionFrameFullyVisible ||
      !visibility.cardFullyVisible
    ) {
      visibilityRepairApplied = true;
      const repairedNaturalHeight = Math.max(
        card.scrollHeight,
        card.getBoundingClientRect().height
      );
      requestedHeight = Math.min(
        maximumHeight,
        Math.max(requestedHeight, repairedNaturalHeight)
      );
      card.style.setProperty(
        "--rml-setup-adaptive-card-height",
        `${Math.ceil(requestedHeight)}px`
      );
      void card.offsetHeight;
      placement = positionNarrationCardAwayFromTargets(adaptiveBounds);
      void card.offsetHeight;
      cardRect = card.getBoundingClientRect();
      visibility = narrationSurfaceVisibility();
    }
    const firstLine = narrationFirstLineGeometry();
    const visibleTextLineCount = Math.max(
      0,
      (text.clientHeight - textVerticalPadding) / computedLineHeight
    );
    const dynamicBoundsRespected = Boolean(
      cardRect.width <= maximumWidth + 2 &&
      cardRect.height <= maximumHeight + 2
    );
    const glowPresent = visibility.glowCount > 0;
    const wholeGlowVisibleThisFrame = Boolean(
      !glowPresent ||
      adaptiveBounds?.wholeGlowVisiblePossible !== true ||
      visibility.minimumGlowUncoveredRatio >= .995
    );
    const finalHintAlreadyRevealed = Boolean(
      ui.hint?.hidden === false &&
      String(ui.hint?.textContent || "").trim()
    );
    const hintBoxHiddenThisNarrationFrame =
      stepPhase !== "narrating" ||
      finalHintAlreadyRevealed || Boolean(
        ui.hint?.hidden === true &&
        getComputedStyle(ui.hint).display === "none"
      );

    if (reset || !narrationCardMetrics) {
      narrationCardMetrics = {
        initialWidth: cardRect.width,
        initialHeight: cardRect.height,
        minimumWidth,
        maximumWidth,
        maximumHeight,
        minimumVisibleTextLineCount,
        minimumObservedVisibleTextLines: visibleTextLineCount,
        dynamicBoundsAlwaysRespected: dynamicBoundsRespected,
        dynamicBoundsChangedCount: 0,
        dynamicBoundsKey: adaptiveBounds?.key || "viewport",
        wholeGlowVisibleWheneverPossible:
          wholeGlowVisibleThisFrame,
        glowAvoidancePossibleCount:
          glowPresent &&
          adaptiveBounds?.wholeGlowVisiblePossible === true
            ? 1
            : 0,
        glowAvoidanceFailureCount:
          glowPresent &&
          adaptiveBounds?.wholeGlowVisiblePossible === true &&
          !wholeGlowVisibleThisFrame
            ? 1
            : 0,
        unavoidableGlowOverlapCount:
          glowPresent &&
          adaptiveBounds?.wholeGlowVisiblePossible !== true
            ? 1
            : 0,
        hintBoxHiddenThroughoutNarration:
          hintBoxHiddenThisNarrationFrame,
        maxObservedWidth: cardRect.width,
        maxObservedHeight: cardRect.height,
        lastObservedWidth: cardRect.width,
        lastObservedHeight: cardRect.height,
        widthRegressionCount: 0,
        heightRegressionCount: 0,
        overflowObserved: overflowing,
        activeLineAlwaysVisible: lineFollow.activeLineVisible,
        finalFontSize: fontSize,
        finalScrollTop: text.scrollTop,
        finalScrollHeight: text.scrollHeight,
        finalClientHeight: text.clientHeight,
        requestedWidth,
        requestedHeight,
        naturalHeight,
        chromeHeight,
        placementKey: placement?.key || "center",
        controlsAlwaysFullyVisible: visibility.controlsFullyVisible,
        actionFrameAlwaysFullyVisible:
          visibility.actionFrameFullyVisible,
        finalVisibleControlCount: visibility.visibleControlCount,
        finalVisibleControlRects: visibility.visibleControlRects,
        cardAlwaysFullyVisible: visibility.cardFullyVisible,
        glowsAlwaysFullyVisible: visibility.glowsFullyVisible,
        maxGlowCardOverlapArea: visibility.glowCardOverlapArea,
        minimumGlowUncoveredRatio:
          visibility.minimumGlowUncoveredRatio,
        finalGlowCount: visibility.glowCount,
        firstLineMeasured: firstLine.measured,
        firstLineAlwaysClearOfTitle:
          !firstLine.measured ||
          (firstLine.clearOfTitle && firstLine.firstGlyphFullyVisible),
        firstLineGeometry: firstLine,
        visibilityRepairCount: visibilityRepairApplied ? 1 : 0,
        maximumWidthRegressionPx: 0
      };
    } else {
      const previousMaximumWidth = narrationCardMetrics.maximumWidth;
      const previousMaximumHeight = narrationCardMetrics.maximumHeight;
      const widthBoundShrank =
        maximumWidth < previousMaximumWidth - 1;
      const heightBoundShrank =
        maximumHeight < previousMaximumHeight - 1;
      const widthRegressionPx = Math.max(
        0,
        narrationCardMetrics.lastObservedWidth - cardRect.width
      );
      if (widthRegressionPx > 2.5 && !widthBoundShrank) {
        narrationCardMetrics.widthRegressionCount += 1;
      }
      narrationCardMetrics.maximumWidthRegressionPx = Math.max(
        narrationCardMetrics.maximumWidthRegressionPx || 0,
        widthRegressionPx
      );
      if (
        cardRect.height < narrationCardMetrics.lastObservedHeight - 1 &&
        !heightBoundShrank
      ) {
        narrationCardMetrics.heightRegressionCount += 1;
      }
      if (widthBoundShrank || heightBoundShrank) {
        narrationCardMetrics.dynamicBoundsChangedCount += 1;
      }
      narrationCardMetrics.lastObservedWidth = cardRect.width;
      narrationCardMetrics.lastObservedHeight = cardRect.height;
      narrationCardMetrics.minimumWidth = minimumWidth;
      narrationCardMetrics.maximumWidth = maximumWidth;
      narrationCardMetrics.maximumHeight = maximumHeight;
      narrationCardMetrics.minimumObservedVisibleTextLines = Math.min(
        narrationCardMetrics.minimumObservedVisibleTextLines,
        visibleTextLineCount
      );
      narrationCardMetrics.dynamicBoundsAlwaysRespected &&=
        dynamicBoundsRespected;
      narrationCardMetrics.dynamicBoundsKey =
        adaptiveBounds?.key || "viewport";
      narrationCardMetrics.wholeGlowVisibleWheneverPossible &&=
        wholeGlowVisibleThisFrame;
      if (
        glowPresent &&
        adaptiveBounds?.wholeGlowVisiblePossible === true
      ) {
        narrationCardMetrics.glowAvoidancePossibleCount += 1;
        if (!wholeGlowVisibleThisFrame) {
          narrationCardMetrics.glowAvoidanceFailureCount += 1;
        }
      } else if (glowPresent) {
        narrationCardMetrics.unavoidableGlowOverlapCount += 1;
      }
      narrationCardMetrics.hintBoxHiddenThroughoutNarration &&=
        hintBoxHiddenThisNarrationFrame;
      narrationCardMetrics.maxObservedWidth = Math.max(
        narrationCardMetrics.maxObservedWidth,
        cardRect.width
      );
      narrationCardMetrics.maxObservedHeight = Math.max(
        narrationCardMetrics.maxObservedHeight,
        cardRect.height
      );
      narrationCardMetrics.overflowObserved ||= overflowing;
      narrationCardMetrics.activeLineAlwaysVisible &&=
        lineFollow.activeLineVisible;
      narrationCardMetrics.finalFontSize = fontSize;
      narrationCardMetrics.finalScrollTop = text.scrollTop;
      narrationCardMetrics.finalScrollHeight = text.scrollHeight;
      narrationCardMetrics.finalClientHeight = text.clientHeight;
      narrationCardMetrics.requestedWidth = requestedWidth;
      narrationCardMetrics.requestedHeight = requestedHeight;
      narrationCardMetrics.naturalHeight = naturalHeight;
      narrationCardMetrics.chromeHeight = chromeHeight;
      narrationCardMetrics.placementKey = placement?.key || "center";
      narrationCardMetrics.controlsAlwaysFullyVisible &&=
        visibility.controlsFullyVisible;
      narrationCardMetrics.actionFrameAlwaysFullyVisible &&=
        visibility.actionFrameFullyVisible;
      narrationCardMetrics.finalVisibleControlCount =
        visibility.visibleControlCount;
      narrationCardMetrics.finalVisibleControlRects =
        visibility.visibleControlRects;
      narrationCardMetrics.cardAlwaysFullyVisible &&=
        visibility.cardFullyVisible;
      narrationCardMetrics.glowsAlwaysFullyVisible &&=
        visibility.glowsFullyVisible;
      narrationCardMetrics.maxGlowCardOverlapArea = Math.max(
        narrationCardMetrics.maxGlowCardOverlapArea,
        visibility.glowCardOverlapArea
      );
      narrationCardMetrics.minimumGlowUncoveredRatio = Math.min(
        narrationCardMetrics.minimumGlowUncoveredRatio ?? 1,
        visibility.minimumGlowUncoveredRatio
      );
      narrationCardMetrics.finalGlowCount = visibility.glowCount;
      narrationCardMetrics.visibilityRepairCount +=
        visibilityRepairApplied ? 1 : 0;
      if (
        !narrationCardMetrics.firstLineMeasured &&
        firstLine.measured
      ) {
        narrationCardMetrics.firstLineMeasured = true;
        narrationCardMetrics.firstLineAlwaysClearOfTitle =
          firstLine.clearOfTitle &&
          firstLine.firstGlyphFullyVisible;
        narrationCardMetrics.firstLineGeometry = firstLine;
        tourDebugAssert(
          `tour-step-${stepIndex}-first-typed-line-below-title`,
          narrationCardMetrics.firstLineAlwaysClearOfTitle,
          firstLine
        );
      }
    }
    if (graphInspectorToggleVisibilityState?.toggle) {
      sampleGraphInspectorToggleVisibility(
        graphInspectorToggleVisibilityState.toggle,
        "adaptive-card-fit"
      );
    }
    return {
      cardRect,
      overflowing,
      autoScrolled: lineFollow.autoScrolled,
      activeLineVisible: lineFollow.activeLineVisible,
      fontSize,
      minimumWidth,
      maximumWidth,
      maximumHeight,
      maximumTextHeight,
      visibility
    };
  }

  function assertAdaptiveNarrationCard(index) {
    const metrics = narrationCardMetrics;
    const viewport = tourViewport();
    const minimumReadableFontSize =
      viewport.width >= 1600
        ? 17
        : viewport.width >= 900
          ? 16
          : 15;
    const widthAlreadyAtLimit = Boolean(
      metrics && metrics.maximumWidth - metrics.minimumWidth <= 2
    );
    const widthGrew = Boolean(
      metrics &&
      metrics.maxObservedWidth >= metrics.initialWidth + 8
    );
    const heightGrew = Boolean(
      metrics &&
      metrics.maxObservedHeight >= metrics.initialHeight + 8
    );
    const viewportSupport = evaluateTourViewportSupport(
      viewport.width,
      viewport.height
    );
    const dynamicNarrationContract = Boolean(
      metrics &&
      metrics.dynamicBoundsAlwaysRespected === true &&
      metrics.minimumObservedVisibleTextLines >= 2.9 &&
      metrics.wholeGlowVisibleWheneverPossible === true &&
      metrics.glowAvoidanceFailureCount === 0
    );
    tourDebugAssert(
      `tour-step-${index}-mobile-narration-preserves-subject-reveal-area`,
      viewport.width > 780 || !viewportSupport.supported ||
        dynamicNarrationContract,
      {
        mobileRevealPolicyApplies:
          viewport.width <= 780 && viewportSupport.supported,
        viewportSupport,
        dynamicNarrationContract,
        dynamicBoundsKey: metrics?.dynamicBoundsKey || "",
        dynamicBoundsChangedCount:
          metrics?.dynamicBoundsChangedCount || 0,
        dynamicBoundsAlwaysRespected:
          metrics?.dynamicBoundsAlwaysRespected === true,
        minimumObservedVisibleTextLines:
          metrics?.minimumObservedVisibleTextLines || 0,
        requiredVisibleTextLines: 3,
        wholeGlowVisibleWheneverPossible:
          metrics?.wholeGlowVisibleWheneverPossible === true,
        glowAvoidancePossibleCount:
          metrics?.glowAvoidancePossibleCount || 0,
        glowAvoidanceFailureCount:
          metrics?.glowAvoidanceFailureCount || 0,
        unavoidableGlowOverlapCount:
          metrics?.unavoidableGlowOverlapCount || 0,
        minimumGlowUncoveredRatio:
          metrics?.minimumGlowUncoveredRatio ?? 0,
        policy:
          "On supported compact viewports the card derives its maximum width, maximum height and placement from the live glow. It keeps the complete glow unobstructed whenever a readable three-line card fits beside it; otherwise only the mathematically unavoidable overlap is allowed."
      }
    );
    tourDebugAssert(
      `tour-step-${index}-dynamic-narration-bounds-and-three-lines`,
      dynamicNarrationContract,
      {
        viewportSupport,
        dynamicBoundsKey: metrics?.dynamicBoundsKey || "",
        minimumWidth: metrics?.minimumWidth || 0,
        maximumWidth: metrics?.maximumWidth || 0,
        maximumHeight: metrics?.maximumHeight || 0,
        minimumObservedVisibleTextLines:
          metrics?.minimumObservedVisibleTextLines || 0,
        requiredVisibleTextLines: 3,
        wholeGlowVisibleWheneverPossible:
          metrics?.wholeGlowVisibleWheneverPossible === true,
        glowAvoidancePossibleCount:
          metrics?.glowAvoidancePossibleCount || 0,
        glowAvoidanceFailureCount:
          metrics?.glowAvoidanceFailureCount || 0,
        unavoidableGlowOverlapCount:
          metrics?.unavoidableGlowOverlapCount || 0
      }
    );
    const ui = elements();
    const finalHintVisible = Boolean(
      !steps[index]?.hint ||
      (
        ui.hint?.hidden === false &&
        getComputedStyle(ui.hint).display !== "none"
      )
    );
    tourDebugAssert(
      `tour-step-${index}-hint-box-hidden-until-final-blue-text`,
      Boolean(
        metrics?.hintBoxHiddenThroughoutNarration === true &&
        finalHintVisible
      ),
      {
        hiddenThroughoutNarration:
          metrics?.hintBoxHiddenThroughoutNarration === true,
        finalHintVisible,
        finalHintText: ui.hint?.textContent || "",
        behavior:
          "The bordered hint consumes no layout height while narration is typing and appears only together with the final blue hint text."
      }
    );
    return tourDebugAssert(
      `tour-step-${index}-adaptive-narration-card-growth-and-scroll`,
      Boolean(metrics) &&
        (widthAlreadyAtLimit || widthGrew ||
          metrics.dynamicBoundsChangedCount > 0) &&
        (heightGrew || metrics.dynamicBoundsChangedCount > 0 ||
          metrics.minimumObservedVisibleTextLines >= 2.9) &&
        metrics.dynamicBoundsAlwaysRespected === true &&
        metrics.minimumObservedVisibleTextLines >= 2.9 &&
        metrics.wholeGlowVisibleWheneverPossible === true &&
        metrics.widthRegressionCount === 0 &&
        metrics.heightRegressionCount === 0 &&
        metrics.activeLineAlwaysVisible === true &&
        metrics.controlsAlwaysFullyVisible === true &&
        metrics.cardAlwaysFullyVisible === true &&
        metrics.glowsAlwaysFullyVisible === true &&
        metrics.firstLineMeasured === true &&
        metrics.firstLineAlwaysClearOfTitle === true &&
        metrics.finalFontSize >= minimumReadableFontSize,
      {
        ...metrics,
        widthAlreadyAtLimit,
        widthGrew,
        heightGrew,
        minimumReadableFontSize,
        viewport: {
          width: viewport.width,
          height: viewport.height
        }
      }
    );
  }

  function positionCardAwayFromPath(from, to) {
    return positionCardAwayFromRoute([from, to]);
  }

  function positionCardAwayFromRoute(points) {
    const { card } = elements();
    if (activeSemanticScene?.locked) return;
    const route = (points || []).filter(
      point => Number.isFinite(point?.x) && Number.isFinite(point?.y)
    );
    if (!card || route.length < 2) return;

    const viewport = tourViewport();
    const margin = 12;
    const headerBottom = tourHeaderBottom();
    const cardRect = card.getBoundingClientRect();
    const width = Math.min(
      cardRect.width,
      viewport.width - margin * 2
    );
    const height = Math.min(
      cardRect.height,
      viewport.height - margin * 2
    );
    const candidates = [
      {
        left: viewport.left + margin,
        top: Math.max(headerBottom + margin, viewport.top + margin)
      },
      {
        left: viewport.right - width - margin,
        top: Math.max(headerBottom + margin, viewport.top + margin)
      },
      {
        left: viewport.left + margin,
        top: viewport.bottom - height - margin
      },
      {
        left: viewport.right - width - margin,
        top: viewport.bottom - height - margin
      }
    ];

    const distanceToRect = (point, rect) => {
      const dx =
        point.x < rect.left
          ? rect.left - point.x
          : point.x > rect.right
            ? point.x - rect.right
            : 0;
      const dy =
        point.y < rect.top
          ? rect.top - point.y
          : point.y > rect.bottom
            ? point.y - rect.bottom
            : 0;
      return Math.hypot(dx, dy);
    };

    const samples = [];
    for (let routeIndex = 1; routeIndex < route.length; routeIndex += 1) {
      const from = route[routeIndex - 1];
      const to = route[routeIndex];
      for (let index = 0; index <= 12; index += 1) {
        const t = index / 12;
        samples.push({
          x: from.x + (to.x - from.x) * t,
          y: from.y + (to.y - from.y) * t
        });
      }
    }

    const ranked = candidates.map(candidate => {
      const rect = {
        left: candidate.left,
        right: candidate.left + width,
        top: candidate.top,
        bottom: candidate.top + height
      };
      return {
        candidate,
        score: Math.min(
          ...samples.map(point =>
            distanceToRect(point, rect)
          )
        )
      };
    });

    ranked.sort((a, b) => b.score - a.score);
    const best = ranked[0]?.candidate;
    if (!best) return;
    card.style.left = best.left + "px";
    card.style.top = best.top + "px";
  }

  function rememberInlineProperty(element, name) {
    return {
      value: element.style.getPropertyValue(name),
      priority: element.style.getPropertyPriority(name)
    };
  }

  function restoreInlineProperty(element, name, saved) {
    if (saved?.value) {
      element.style.setProperty(name, saved.value, saved.priority || "");
    } else {
      element.style.removeProperty(name);
    }
  }

  function mountTourSurfaceInModal(dialog) {
    const root = document.getElementById("rml-setup-assistant");
    if (
      !(dialog instanceof HTMLDialogElement) ||
      !dialog.open ||
      !root ||
      modalSurfaceState
    ) {
      return false;
    }

    const rectangle = dialog.getBoundingClientRect();
    const propertyNames = [
      "position",
      "inset",
      "top",
      "left",
      "right",
      "bottom",
      "margin",
      "transform"
    ];
    const inline = Object.fromEntries(
      propertyNames.map(name => [
        name,
        rememberInlineProperty(dialog, name)
      ])
    );

    modalSurfaceState = {
      dialog,
      parent: root.parentNode,
      nextSibling: root.nextSibling,
      inline,
      propertyNames
    };

    dialog.style.setProperty("position", "fixed", "important");
    dialog.style.setProperty("inset", "auto", "important");
    dialog.style.setProperty("top", `${rectangle.top}px`, "important");
    dialog.style.setProperty("left", `${rectangle.left}px`, "important");
    dialog.style.setProperty("right", "auto", "important");
    dialog.style.setProperty("bottom", "auto", "important");
    dialog.style.setProperty("margin", "0", "important");
    dialog.style.setProperty("transform", "none", "important");

    root.classList.add("rml-setup-modal-demonstration");
    dialog.appendChild(root);
    tourDebugRecord("tour-visual-layer-mounted-in-dialog", {
      dialogId: dialog.id || "",
      dialogRect: tourDebugRect(dialog),
      mouseContained: dialog.contains(elements().mouse),
      liveControlsContained: dialog.contains(elements().liveControls)
    });
    return true;
  }

  function teacherMouseVisibleAboveDialog(dialog, target = null) {
    const { root, mouse } = elements();
    if (
      !(dialog instanceof HTMLDialogElement) ||
      !dialog.open ||
      !(mouse instanceof HTMLElement)
    ) {
      return false;
    }
    const mouseRect = mouse.getBoundingClientRect();
    const viewport = tourEffectViewport();
    const style = getComputedStyle(mouse);
    const center = {
      x: mouseRect.left + mouseRect.width * .5,
      y: mouseRect.top + mouseRect.height * .5
    };
    const targetRect = target?.getBoundingClientRect?.() || null;
    const insideVisibleViewport =
      center.x >= viewport.left && center.x <= viewport.right &&
      center.y >= viewport.top && center.y <= viewport.bottom;
    const overlapsTarget = !targetRect || (
      center.x >= targetRect.left - mouseRect.width &&
      center.x <= targetRect.right + mouseRect.width &&
      center.y >= targetRect.top - mouseRect.height &&
      center.y <= targetRect.bottom + mouseRect.height
    );
    return Boolean(
      dialog.contains(root) &&
      dialog.contains(mouse) &&
      mouse.classList.contains("active") &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number.parseFloat(style.opacity || "0") >= .75 &&
      mouseRect.width > 8 &&
      mouseRect.height > 12 &&
      insideVisibleViewport &&
      overlapsTarget
    );
  }

  async function stabilizeTeacherMouseAboveDialogTarget(
    dialog,
    target,
    runId
  ) {
    const attempts = [];
    for (
      let attempt = 0;
      attempt < 3 && runId === demoRunId;
      attempt += 1
    ) {
      const passed = teacherMouseVisibleAboveDialog(dialog, target);
      attempts.push({
        attempt,
        passed,
        mouseRect: tourDebugRect(elements().mouse),
        targetRect: tourDebugRect(target)
      });
      if (passed) {
        return {
          passed: true,
          repaired: attempt > 0,
          attempts
        };
      }

      const mouse = elements().mouse;
      if (!(mouse instanceof HTMLElement) || !target?.isConnected) break;
      const livePoint = centerOf(target);
      mouse.style.setProperty("--mouse-duration", "0ms");
      void mouse.getBoundingClientRect();
      setTeacherMousePoint(
        livePoint,
        0,
        [],
        "dialog-target-final-frame-stabilization"
      );
      mouse.classList.add("active");
      void mouse.getBoundingClientRect();
      await nextTwoFrames();
    }
    return {
      passed: teacherMouseVisibleAboveDialog(dialog, target),
      repaired: attempts.length > 1,
      attempts
    };
  }

  function restoreTourSurfaceFromModal(closeDialog = false) {
    const state = modalSurfaceState;
    if (!state) return;

    modalSurfaceState = null;
    const root = document.getElementById("rml-setup-assistant");
    if (root && state.parent) {
      root.classList.remove("rml-setup-modal-demonstration");
      if (
        state.nextSibling &&
        state.nextSibling.parentNode === state.parent
      ) {
        state.parent.insertBefore(root, state.nextSibling);
      } else {
        state.parent.appendChild(root);
      }
    }

    for (const name of state.propertyNames) {
      restoreInlineProperty(state.dialog, name, state.inline[name]);
    }

    if (closeDialog && state.dialog.open) {
      try {
        state.dialog.close();
      } catch {
        state.dialog.removeAttribute("open");
      }
    }
  }

  function captureTourStorageState() {
    const entries = [];
    try {
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key != null) {
          entries.push([key, window.localStorage.getItem(key)]);
        }
      }
    } catch {
      // Storage may be unavailable in hardened browser profiles.
    }
    entries.sort(([left], [right]) => left.localeCompare(right));
    return entries;
  }

  function restoreTourStorageState(entries) {
    if (!Array.isArray(entries)) return false;
    try {
      const desired = new Map(entries);
      const currentKeys = [];
      for (let index = 0; index < window.localStorage.length; index += 1) {
        const key = window.localStorage.key(index);
        if (key != null) currentKeys.push(key);
      }
      for (const key of currentKeys) {
        if (!desired.has(key)) window.localStorage.removeItem(key);
      }
      for (const [key, value] of desired) {
        window.localStorage.setItem(key, value == null ? "" : String(value));
      }
      return true;
    } catch {
      return false;
    }
  }

  function tourStorageFingerprint(entries = captureTourStorageState()) {
    try {
      return JSON.stringify(entries);
    } catch {
      return "";
    }
  }

  function captureTourOverlayState() {
    return {
      dialogs: [...document.querySelectorAll("dialog")].map(dialog => ({
        id: dialog.id || "",
        open: dialog.open === true
      })),
      graphSearchOverlays: [...document.querySelectorAll(
        ".rml-graph-search-overlay"
      )].map((overlay, index) => ({
        index,
        hidden: overlay.hidden === true
      }))
    };
  }

  function restoreTourOverlayState(state) {
    if (!state) return false;
    restoreTourSurfaceFromModal(false);
    const expectedDialogs = new Map(
      (state.dialogs || []).map(item => [item.id, item])
    );
    for (const dialog of document.querySelectorAll("dialog")) {
      const expected = expectedDialogs.get(dialog.id || "");
      const shouldBeOpen = expected?.open === true;
      if (!shouldBeOpen && dialog.open) {
        try {
          dialog.close();
        } catch {
          dialog.removeAttribute("open");
        }
      } else if (shouldBeOpen && !dialog.open) {
        try {
          dialog.showModal();
        } catch {
          dialog.setAttribute("open", "");
        }
      }
    }
    const graphSearchOverlays = [...document.querySelectorAll(
      ".rml-graph-search-overlay"
    )];
    graphSearchOverlays.forEach((overlay, index) => {
      overlay.hidden = state.graphSearchOverlays?.[index]?.hidden !== false;
    });
    return tourOverlayStateMatches(state);
  }

  function tourOverlayStateMatches(state) {
    if (!state) return false;
    const actual = captureTourOverlayState();
    const expectedDialogs = new Map(
      (state.dialogs || []).map(item => [item.id, item.open === true])
    );
    const dialogsMatch = actual.dialogs.every(item =>
      item.open === (expectedDialogs.get(item.id) === true)
    ) && [...expectedDialogs].every(([id, open]) =>
      actual.dialogs.some(item => item.id === id && item.open === open)
    );
    const graphSearchMatches = actual.graphSearchOverlays.every(
      (item, index) =>
        item.hidden === (state.graphSearchOverlays?.[index]?.hidden !== false)
    );
    return dialogsMatch && graphSearchMatches;
  }

  function captureTourScrollSurfaces() {
    return [...document.querySelectorAll("[id]")]
      .filter(element =>
        element instanceof HTMLElement &&
        (element.scrollTop !== 0 || element.scrollLeft !== 0)
      )
      .map(element => ({
        id: element.id,
        top: element.scrollTop,
        left: element.scrollLeft
      }));
  }

  function restoreTourScrollSurfaces(entries = []) {
    for (const entry of entries) {
      const element = document.getElementById(entry.id);
      if (element instanceof HTMLElement) {
        element.scrollTop = Number(entry.top) || 0;
        element.scrollLeft = Number(entry.left) || 0;
      }
    }
  }

  function captureTourEnvironmentState({ includeStorage = true } = {}) {
    const topActions = document.querySelector("#top-actions");
    const topMenuToggle = document.querySelector("#top-menu-toggle");
    return {
      overlay: captureTourOverlayState(),
      storage: includeStorage ? captureTourStorageState() : null,
      graphMode: document.body.classList.contains("rml-node-graph-mode"),
      graphLeftCollapsed: document.body.classList.contains(
        "rml-graph-left-collapsed"
      ),
      graphRightCollapsed: document.body.classList.contains(
        "rml-graph-right-collapsed"
      ),
      topMenuOpen: Boolean(
        topActions?.classList.contains("mobile-menu-open") &&
        topMenuToggle?.getAttribute("aria-expanded") === "true"
      ),
      page: { x: window.scrollX, y: window.scrollY },
      scrollSurfaces: captureTourScrollSurfaces(),
      activeElementId: document.activeElement?.id || ""
    };
  }

  async function restoreTourEnvironmentState(state, { storage = true } = {}) {
    if (!state) return false;
    restoreTourOverlayState(state.overlay);
    if (storage && state.storage) restoreTourStorageState(state.storage);

    const topActions = document.querySelector("#top-actions");
    const topMenuToggle = document.querySelector("#top-menu-toggle");
    topActions?.classList.toggle("mobile-menu-open", state.topMenuOpen === true);
    if (topMenuToggle) {
      topMenuToggle.setAttribute("aria-expanded", String(state.topMenuOpen === true));
      topMenuToggle.setAttribute(
        "aria-label",
        state.topMenuOpen === true ? "Close menu" : "Open menu"
      );
    }

    document.body.classList.toggle(
      "rml-graph-left-collapsed",
      state.graphLeftCollapsed === true
    );
    document.body.classList.toggle(
      "rml-graph-right-collapsed",
      state.graphRightCollapsed === true
    );
    window.scrollTo(Number(state.page?.x) || 0, Number(state.page?.y) || 0);
    restoreTourScrollSurfaces(state.scrollSurfaces);
    await nextTwoFrames();
    restoreTourOverlayState(state.overlay);
    window.scrollTo(Number(state.page?.x) || 0, Number(state.page?.y) || 0);
    restoreTourScrollSurfaces(state.scrollSurfaces);
    if (state.activeElementId) {
      document.getElementById(state.activeElementId)?.focus?.({
        preventScroll: true
      });
    }
    return true;
  }

  function clearDemoVisuals() {
    const ui = elements();

    clearNarrationOutlines();
    clearLiveControlsActiveObstacles();

    hardHideTeacherMouse("clear-demo-visuals");
    ui.mouse?.classList.remove(
      "active",
      "pressed",
      "scrolling",
      "horizontal-wheel"
    );

    if (ui.dragGhost) {
      ui.dragGhost.hidden = true;
      ui.dragGhost.className = "rml-setup-drag-ghost";
      ui.dragGhost.replaceChildren();
    }

    if (ui.keys) {
      ui.keys.hidden = true;
      ui.keys.replaceChildren();
      ui.keys.classList.remove("active");
    }

    if (ui.demoLabel) {
      ui.demoLabel.hidden = true;
    }

    document.querySelectorAll(
      ".rml-setup-demo-pulse, .rml-setup-demo-drop, .rml-setup-demo-node, .rml-setup-demo-landing, .rml-setup-port-travel, .rml-setup-demo-wire-layer, .rml-setup-demo-bend"
    ).forEach(element => element.remove());
    document.querySelectorAll(".rml-graph-node.rml-setup-flip-active")
      .forEach(element => element.classList.remove("rml-setup-flip-active"));
    document.querySelectorAll(".rml-setup-control-highlight")
      .forEach(element => element.classList.remove("rml-setup-control-highlight"));
    document.querySelectorAll(
      ".rml-setup-connection-node, .rml-setup-connection-wire, .rml-setup-connected-port"
    ).forEach(element => element.classList.remove(
      "rml-setup-connection-node",
      "rml-setup-connection-wire",
      "rml-setup-connected-port"
    ));
    clearDragStage();
    clearRealPortGlows();
    document.documentElement.classList.remove(
      "rml-setup-horizontal-option-gesture"
    );
    window.RMLTypedNodeGraphScrollLayers
      ?.clear?.();
  }

  function cancelDemo() {
    demoRunId += 1;
    narrationReservedRevealRect = null;
    graphInspectorToggleVisibilityState = null;
    elements().card?.classList.remove(
      "rml-setup-card-hidden-during-panel-reveal"
    );
    document.querySelectorAll(".rml-setup-graph-panel-visible-reveal")
      .forEach(panel => panel.classList.remove(
        "rml-setup-graph-panel-visible-reveal"
      ));
    hardHideTeacherMouse("cancel-demo-before-surface-restore");
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = 0;
    for (const pending of [...demoTimers]) {
      if (pending && typeof pending.finish === "function") {
        pending.finish();
      } else {
        clearTimeout(pending);
      }
    }
    demoTimers = [];
    resolveNarrationAdvanceWaiters(false);
    pendingNarrationAdvances = 0;
    for (const pointerId of [
      9090,
      9108,
      9110,
      9111,
      9112,
      9113,
      9114,
      9115,
      9120,
      9201,
      9202,
      9203,
      9204,
      9205,
      9210,
      9211,
      9212,
      9213,
      9231,
      9242
    ]) {
      document.dispatchEvent(
        new PointerEvent("pointercancel", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: 0,
          clientX: 0,
          clientY: 0
        })
      );
    }
    restoreTourSurfaceFromModal(true);
    clearDemoVisuals();
    teacherMouseSafetyState = null;
    releaseSemanticScene();
    document
      .getElementById("rml-setup-assistant")
      ?.classList.remove(
        "rml-setup-demonstration-only",
        "rml-setup-narration-active",
        "rml-setup-preparing-next"
      );
    document.documentElement.classList.remove(
      "rml-setup-demonstration-active"
    );
  }


  function hideMouse() {
    const { mouse } = elements();
    if (!mouse) return;
    mouse.classList.remove(
      "active",
      "pressed",
      "scrolling",
      "horizontal-wheel"
    );
  }

  function hardHideTeacherMouse(reason = "scene-transition") {
    const { mouse } = elements();
    if (!(mouse instanceof HTMLElement)) return false;
    mouse.classList.remove(
      "active",
      "pressed",
      "scrolling",
      "horizontal-wheel"
    );
    mouse.classList.add("rml-setup-mouse-hard-hidden");
    mouse.dataset.hardHiddenReason = reason;
    return true;
  }

  async function hideTeacherMouseBeforeTransition(
    runId,
    reason = "scene-transition"
  ) {
    const { mouse } = elements();
    if (!(mouse instanceof HTMLElement)) return false;
    hideMouse();
    await wait(220);
    if (runId !== demoRunId) return false;
    hardHideTeacherMouse(reason);
    await nextTwoFrames();
    const style = getComputedStyle(mouse);
    const hidden = Boolean(
      mouse.classList.contains("rml-setup-mouse-hard-hidden") &&
      style.visibility === "hidden" &&
      Number.parseFloat(style.opacity || "0") <= .01
    );
    tourDebugRecord("teacher-mouse-hidden-before-scene-transition", {
      reason,
      hidden,
      opacity: Number.parseFloat(style.opacity || "0"),
      visibility: style.visibility,
      point: teacherMouseCoordinates()
    });
    return hidden;
  }

  function removeLandingGuides() {
    document.querySelectorAll(".rml-setup-demo-landing")
      .forEach(element => element.remove());
  }

  function directChildrenWithClass(host, className) {
    return [...(host?.children || [])].filter(
      child =>
        child instanceof HTMLElement &&
        child.classList.contains(className)
    );
  }

  function verticalInsertionSlots(host) {
    if (!host) return [];
    const cards = directChildrenWithClass(host, "node-card")
      .filter(card => !card.classList.contains("node-pointer-ghost"));
    const hostRect = host.getBoundingClientRect();

    if (cards.length === 0) {
      return [{
        left: hostRect.left + 8,
        top: hostRect.top + 10,
        width: Math.max(42, hostRect.width - 16),
        height: 4,
        orientation: "horizontal"
      }];
    }

    const rects = cards.map(card => card.getBoundingClientRect());
    const slots = [];

    for (let index = 0; index <= rects.length; index += 1) {
      const before = index > 0 ? rects[index - 1] : null;
      const after = index < rects.length ? rects[index] : null;

      if (
        before &&
        after &&
        after.top < before.bottom - 2
      ) {
        continue;
      }

      const top =
        before && after
          ? (before.bottom + after.top) / 2
          : after
            ? after.top - 4
            : before.bottom + 4;

      let left;
      let right;
      if (before && after) {
        const overlapLeft = Math.max(before.left, after.left);
        const overlapRight = Math.min(before.right, after.right);
        if (overlapRight - overlapLeft >= 24) {
          left = overlapLeft;
          right = overlapRight;
        } else {
          const anchor = before.width <= after.width ? before : after;
          left = anchor.left;
          right = anchor.right;
        }
      } else {
        const anchor = after || before;
        left = anchor.left;
        right = anchor.right;
      }

      left = Math.max(hostRect.left + 8, left);
      right = Math.min(hostRect.right - 8, right);
      if (right - left < 24) continue;

      const crossesCardInterior = rects.some(rectangle =>
        top > rectangle.top + 3 &&
        top < rectangle.bottom - 3 &&
        right > rectangle.left + 3 &&
        left < rectangle.right - 3
      );
      if (crossesCardInterior) continue;

      slots.push({
        left,
        top,
        width: Math.max(24, right - left),
        height: 4,
        orientation: "horizontal"
      });
    }
    return slots;
  }

  function verticalSlotCrossesLiveContent(host, slot) {
    if (!(host instanceof HTMLElement) || !slot) return true;
    const centerY = slot.top + Math.max(4, slot.height || 4) * .5;
    const left = slot.left;
    const right = slot.left + slot.width;
    const overlapsInterior = rectangle =>
      centerY > rectangle.top + 4 &&
      centerY < rectangle.bottom - 4 &&
      right > rectangle.left + 4 &&
      left < rectangle.right - 4;

    if (
      directChildrenWithClass(host, "node-card")
        .filter(card => !card.classList.contains("node-pointer-ghost"))
        .some(card => overlapsInterior(card.getBoundingClientRect()))
    ) {
      return true;
    }

    return [...document.querySelectorAll(
      "button, input, select, textarea, [role='button']"
    )].some(control => {
      if (
        !(control instanceof HTMLElement) ||
        control.closest("#rml-setup-assistant") ||
        control.closest(".node-pointer-ghost") ||
        control.contains(host) ||
        !tourElementActuallyVisible(control)
      ) {
        return false;
      }
      return overlapsInterior(control.getBoundingClientRect());
    });
  }

  function nativeVerticalReleaseMarkerSafety(
    expectedHost = null,
    expectedSlot = null,
    options = {}
  ) {
    const marker = expectedHost?.querySelector?.(
      ":scope > .drag-reorder-placeholder"
    ) || document.querySelector(".drag-reorder-placeholder");
    const host = marker?.parentElement || null;
    if (!(marker instanceof HTMLElement) || !(host instanceof HTMLElement)) {
      return {
        safe: false,
        reason: "native-marker-missing",
        markerRect: null,
        host: null
      };
    }

    const rectangle = marker.getBoundingClientRect();
    const corridor = outlineNestedVerticalCorridor();
    const viewport = corridor.viewport;
    const geometry = {
      left: rectangle.left,
      top: rectangle.top,
      width: rectangle.width,
      height: rectangle.height,
      orientation: rectangle.width >= rectangle.height
        ? "horizontal"
        : "vertical"
    };
    const actualCenterY = rectangle.top + rectangle.height * .5;
    const liveSlot = options.allowRebase === false
      ? null
      : verticalInsertionSlots(host)
          .map(slot => ({
            slot,
            centerDelta: Math.abs(
              actualCenterY -
                (slot.top + Math.max(4, slot.height || 4) * .5)
            ),
            widthDelta: Math.abs(rectangle.width - slot.width)
          }))
          .filter(candidate =>
            candidate.centerDelta <= 6 &&
            candidate.widthDelta <= 12 &&
            !verticalSlotCrossesLiveContent(host, candidate.slot)
          )
          .sort((left, right) =>
            left.centerDelta - right.centerDelta ||
            left.widthDelta - right.widthDelta
          )[0]?.slot || null;
    const originalExpectedCenterY = expectedSlot
      ? expectedSlot.top + Math.max(4, expectedSlot.height || 4) * .5
      : null;
    const originalCenterDelta = Number.isFinite(originalExpectedCenterY)
      ? Math.abs(actualCenterY - originalExpectedCenterY)
      : Infinity;
    const originalWidthDelta = Number.isFinite(expectedSlot?.width)
      ? Math.abs(rectangle.width - expectedSlot.width)
      : Infinity;
    const liveSlotRebased = Boolean(
      liveSlot &&
      (
        !expectedSlot ||
        originalCenterDelta > 6 ||
        originalWidthDelta > 12
      )
    );

    const effectiveSlot = liveSlotRebased
      ? liveSlot
      : expectedSlot || liveSlot;
    const expectedCenterY = effectiveSlot
      ? effectiveSlot.top + Math.max(4, effectiveSlot.height || 4) * .5
      : null;
    const centerDelta = Number.isFinite(expectedCenterY)
      ? Math.abs(actualCenterY - expectedCenterY)
      : 0;
    const widthDelta = Number.isFinite(effectiveSlot?.width)
      ? Math.abs(rectangle.width - effectiveSlot.width)
      : 0;
    const hostMatched = !expectedHost || host === expectedHost;
    const centerMatched = centerDelta <= 6;
    const widthMatched = widthDelta <= 12;
    const withinViewport = Boolean(
      rectangle.width >= 24 &&
      rectangle.top >= corridor.safeTop &&
      rectangle.bottom <= corridor.safeBottom &&
      rectangle.left >= viewport.left + corridor.horizontalInset &&
      rectangle.right <= viewport.right - corridor.horizontalInset
    );
    const clearOfControls = !verticalSlotCrossesLiveContent(host, geometry);
    const safe = Boolean(
      geometry.orientation === "horizontal" &&
      hostMatched &&
      centerMatched &&
      widthMatched &&
      withinViewport &&
      clearOfControls
    );
    return {
      safe,
      reason: safe
        ? "card-free-visible-native-marker"
        : geometry.orientation !== "horizontal"
          ? "native-marker-wrong-orientation"
          : !hostMatched
            ? "native-marker-wrong-host"
            : !centerMatched
              ? "native-marker-wrong-gap"
              : !widthMatched
                ? "native-marker-wrong-width"
                : !withinViewport
                  ? "native-marker-outside-teaching-window"
                  : "native-marker-crosses-control",
      markerRect: tourDebugRect(marker),
      host,
      hostId: host.id || "",
      hostClasses: host.className || "",
      expectedHostId: expectedHost?.id || "",
      expectedHostClasses: expectedHost?.className || "",
      centerDelta,
      widthDelta,
      hostMatched,
      centerMatched,
      widthMatched,
      withinViewport,
      clearOfControls,
      liveSlotRebased,
      effectiveSlot
    };
  }

  function nativeStep3ReleaseMarkerContract(
    expectedHost,
    releasePoint
  ) {
    const marker = expectedHost?.querySelector?.(
      ":scope > .drag-reorder-placeholder"
    ) || document.querySelector(".drag-reorder-placeholder");
    const host = marker?.parentElement || null;
    if (!(marker instanceof HTMLElement) || !(host instanceof HTMLElement)) {
      return {
        safe: false,
        reason: "native-marker-missing",
        point: releasePoint || null,
        markerRect: null,
        host: null
      };
    }

    const rectangle = marker.getBoundingClientRect();
    const hostRect = host.getBoundingClientRect();
    const viewport = tourViewport();
    const point = {
      x: Number.isFinite(releasePoint?.x)
        ? releasePoint.x
        : rectangle.left + rectangle.width * .5,
      y: Number.isFinite(releasePoint?.y)
        ? releasePoint.y
        : rectangle.top + rectangle.height * .5
    };
    const visibleLeft = Math.max(
      rectangle.left,
      hostRect.left,
      viewport.left + 2
    );
    const visibleRight = Math.min(
      rectangle.right,
      hostRect.right,
      viewport.right - 2
    );
    const visibleTop = Math.max(rectangle.top, viewport.top + 2);
    const visibleBottom = Math.min(rectangle.bottom, viewport.bottom - 2);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);
    const horizontal = rectangle.width >= rectangle.height;
    const hostMatched = !expectedHost || host === expectedHost;
    const markerVisible = Boolean(
      horizontal &&
      rectangle.width >= 24 &&
      rectangle.height >= 2 &&
      visibleWidth >= Math.min(
        48,
        Math.max(24, rectangle.width * .45)
      ) &&
      visibleHeight >= Math.min(2, rectangle.height)
    );
    const pointVisible = Boolean(
      point.x >= viewport.left + 2 &&
      point.x <= viewport.right - 2 &&
      point.y >= viewport.top + 2 &&
      point.y <= viewport.bottom - 2
    );
    const pointInsideHost = Boolean(
      point.x >= Math.max(hostRect.left, viewport.left) &&
      point.x <= Math.min(hostRect.right, viewport.right) &&
      point.y >= Math.max(hostRect.top, viewport.top) &&
      point.y <= Math.min(hostRect.bottom, viewport.bottom)
    );
    const pointNearMarker = Math.abs(
      point.y - (rectangle.top + rectangle.height * .5)
    ) <= Math.max(18, rectangle.height + 10);
    const clearOfControls = !verticalSlotCrossesLiveContent(host, {
      left: rectangle.left,
      top: rectangle.top,
      width: rectangle.width,
      height: rectangle.height
    });
    const safe = Boolean(
      hostMatched &&
      markerVisible &&
      pointVisible &&
      pointInsideHost &&
      pointNearMarker &&
      clearOfControls
    );
    return {
      safe,
      reason: safe
        ? "visible-native-marker-at-release"
        : !horizontal
          ? "native-marker-wrong-orientation"
          : !hostMatched
            ? "native-marker-wrong-host"
            : !markerVisible
              ? "native-marker-not-visibly-framed"
              : !pointVisible
                ? "release-point-outside-viewport"
                : !pointInsideHost
                  ? "release-point-outside-host"
                  : !pointNearMarker
                    ? "release-point-missed-native-marker"
                    : "native-marker-crosses-control",
      point,
      markerRect: tourDebugRect(marker),
      host,
      hostId: host.id || "",
      hostClasses: host.className || "",
      expectedHostId: expectedHost?.id || "",
      expectedHostClasses: expectedHost?.className || "",
      hostMatched,
      markerVisible,
      pointVisible,
      pointInsideHost,
      pointNearMarker,
      clearOfControls,
      visibleWidth,
      visibleHeight,
      viewport,
      hostRect: tourDebugRect(host)
    };
  }

  async function stabilizeStep3NativeReleasePoint(
    expectedHost,
    initialPoint,
    dispatchMove,
    runId
  ) {
    const pageScroller =
      document.scrollingElement || document.documentElement;
    let candidate = {
      x: Number(initialPoint?.x),
      y: Number(initialPoint?.y)
    };
    let previousSample = null;
    let stableFrames = 0;
    const samples = [];

    for (
      let attempt = 0;
      attempt < 12 && runId === demoRunId;
      attempt += 1
    ) {
      if (
        !Number.isFinite(candidate.x) ||
        !Number.isFinite(candidate.y)
      ) {
        break;
      }

      dispatchMove(candidate);
      await nextTwoFrames();
      if (runId !== demoRunId) break;

      const marker = expectedHost?.querySelector?.(
        ":scope > .drag-reorder-placeholder"
      ) || document.querySelector(".drag-reorder-placeholder");
      const markerHost = marker?.parentElement || null;
      const markerRect = marker instanceof HTMLElement
        ? marker.getBoundingClientRect()
        : null;
      const hostRect = expectedHost?.getBoundingClientRect?.() || null;
      const pageTop = Number(pageScroller?.scrollTop || 0);
      const contract = nativeStep3ReleaseMarkerContract(
        expectedHost,
        candidate
      );
      const sameMarkerHost = Boolean(
        previousSample &&
        markerHost instanceof HTMLElement &&
        markerHost === expectedHost &&
        previousSample.markerHost === markerHost
      );
      const layoutStable = Boolean(
        sameMarkerHost &&
        markerRect &&
        previousSample.markerRect &&
        hostRect &&
        previousSample.hostRect &&
        Math.abs(pageTop - previousSample.pageTop) <= .5 &&
        Math.abs(markerRect.left - previousSample.markerRect.left) <= .75 &&
        Math.abs(markerRect.top - previousSample.markerRect.top) <= .75 &&
        Math.abs(markerRect.width - previousSample.markerRect.width) <= .75 &&
        Math.abs(markerRect.height - previousSample.markerRect.height) <= .75 &&
        Math.abs(hostRect.left - previousSample.hostRect.left) <= .75 &&
        Math.abs(hostRect.top - previousSample.hostRect.top) <= .75
      );
      const sample = {
        attempt,
        candidate: { ...candidate },
        markerHost,
        markerRect: markerRect
          ? {
              left: markerRect.left,
              top: markerRect.top,
              width: markerRect.width,
              height: markerRect.height
            }
          : null,
        hostRect: hostRect
          ? {
              left: hostRect.left,
              top: hostRect.top,
              width: hostRect.width,
              height: hostRect.height
            }
          : null,
        pageTop,
        layoutStable,
        safe: contract.safe,
        reason: contract.reason
      };
      samples.push({
        attempt,
        candidate: sample.candidate,
        markerRect: tourDebugRect(marker),
        hostRect: tourDebugRect(expectedHost),
        pageTop,
        layoutStable,
        safe: contract.safe,
        reason: contract.reason
      });

      if (contract.safe && layoutStable) {
        stableFrames += 1;
        if (stableFrames >= 2) {
          return {
            passed: true,
            point: candidate,
            contract,
            stableFrames,
            samples
          };
        }
      } else {
        stableFrames = 0;
      }

      let nextPoint = null;
      const viewport = tourViewport();
      if (
        markerRect &&
        markerHost === expectedHost &&
        hostRect
      ) {
        const minimumX = Math.max(
          hostRect.left + 2,
          viewport.left + 2
        );
        const maximumX = Math.min(
          hostRect.right - 2,
          viewport.right - 2
        );
        const minimumY = Math.max(
          hostRect.top + 2,
          viewport.top + 2
        );
        const maximumY = Math.min(
          hostRect.bottom - 2,
          viewport.bottom - 2
        );
        if (maximumX >= minimumX && maximumY >= minimumY) {
          nextPoint = {
            x: Math.max(
              minimumX,
              Math.min(
                maximumX,
                markerRect.left + markerRect.width * .5
              )
            ),
            y: Math.max(
              minimumY,
              Math.min(
                maximumY,
                markerRect.top + markerRect.height * .5
              )
            )
          };
        }
      }

      if (!nextPoint && expectedHost instanceof HTMLElement) {
        const corridor = outlineNestedVerticalCorridor();
        const slot = verticalInsertionSlots(expectedHost)
          .filter(item =>
            item.top >= corridor.safeTop &&
            item.top <= corridor.safeBottom &&
            item.left + item.width >=
              viewport.left + corridor.horizontalInset &&
            item.left <=
              viewport.right - corridor.horizontalInset &&
            !verticalSlotCrossesLiveContent(expectedHost, item)
          )
          .sort((left, right) =>
            Math.abs(left.top - candidate.y) -
            Math.abs(right.top - candidate.y)
          )[0] || null;
        if (slot) {
          nextPoint = {
            x: Math.max(
              viewport.left + 2,
              Math.min(
                viewport.right - 2,
                slot.left + slot.width * .5
              )
            ),
            y: Math.max(
              viewport.top + 2,
              Math.min(viewport.bottom - 2, slot.top)
            )
          };
        }
      }

      if (!nextPoint) break;
      candidate = nextPoint;
      previousSample = sample;
    }

    const contract = nativeStep3ReleaseMarkerContract(
      expectedHost,
      candidate
    );
    return {
      passed: false,
      point: candidate,
      contract,
      stableFrames,
      samples
    };
  }

  function outlineStep4ReferenceController() {
    return [...document.querySelectorAll(
      ".node-card.controller[data-node-id]"
    )].find(card =>
      card.querySelector(
        ":scope > .node-head .node-copy > strong"
      )?.textContent?.trim() === "DisplayMode"
    ) || null;
  }

  function outlineStep3ScenePreservesStep4Reference(scene) {
    if (!scene?.host || !scene?.source) return false;
    const reference = outlineStep4ReferenceController();
    if (!(reference instanceof HTMLElement)) return true;
    return Boolean(
      !reference.contains(scene.host) &&
      scene.source !== reference &&
      !reference.contains(scene.source) &&
      !scene.source.contains(reference)
    );
  }

  function bestVerticalOutlineScene() {
    const step4Reference = outlineStep4ReferenceController();
    const candidates = [
      document.querySelector("#builder-canvas"),
      ...document.querySelectorAll(".drop-zone")
    ].filter(host =>
      host instanceof HTMLElement &&
      !step4Reference?.contains(host)
    );
    const viewport = tourViewport();
    const viewportCenterY = viewport.top + viewport.height * .5;

    const scenes = candidates.flatMap(host => {
      const cards = directChildrenWithClass(host, "node-card")
        .filter(card =>
          !card.classList.contains("node-pointer-ghost") &&
          card !== step4Reference &&
          !step4Reference?.contains(card) &&
          !card.contains(step4Reference)
        );
      if (cards.length < 2) return [];

      const preferred = cards.filter(card =>
        card.classList.contains("setting") ||
        card.getBoundingClientRect().height <= 220
      );
      const sources = preferred.length ? preferred : cards;

      return sources.map(source => {
        const rectangle = source.getBoundingClientRect();
        const visibleHeight = Math.max(
          0,
          Math.min(rectangle.bottom, viewport.bottom) -
            Math.max(rectangle.top, tourHeaderBottom())
        );
        return {
          host,
          source,
          score:
            (source.classList.contains("setting") ? 900 : 0) +
            (rectangle.height <= 220 ? 420 : 0) +
            visibleHeight * 4 +
            cards.length * 18 -
            Math.abs(
              rectangle.top + rectangle.height * .5 - viewportCenterY
            ) * .08
        };
      });
    });

    scenes.sort((left, right) => right.score - left.score);
    return scenes[0] || null;
  }

  function bestVerticalOutlineHost() {
    return bestVerticalOutlineScene()?.host || null;
  }

  function horizontalSectionSlots(host) {
    if (!host) return [];
    const lanes = directChildrenWithClass(host, "option-lane");
    if (lanes.length === 0) return [];

    const rects = lanes.map(lane => {
      const body = lane.querySelector(":scope > .drop-zone");
      const bodyRect = body?.getBoundingClientRect?.();
      if (bodyRect && bodyRect.width > 4 && bodyRect.height > 4) {
        return bodyRect;
      }
      const laneRect = lane.getBoundingClientRect();
      const headingRect = lane.querySelector(
        ":scope > .option-heading"
      )?.getBoundingClientRect?.();
      const top = Math.max(
        laneRect.top,
        headingRect?.bottom || laneRect.top
      );
      return {
        left: laneRect.left,
        right: laneRect.right,
        top,
        bottom: laneRect.bottom,
        width: laneRect.width,
        height: Math.max(0, laneRect.bottom - top)
      };
    });
    const slots = [];

    for (let index = 0; index <= rects.length; index += 1) {
      const before = index > 0 ? rects[index - 1] : null;
      const after = index < rects.length ? rects[index] : null;
      const centerX =
        before && after
          ? (before.right + after.left) / 2
          : after
            ? after.left - 4
            : before.right + 4;
      const anchor = after || before;
      const top =
        before && after
          ? Math.max(before.top, after.top)
          : anchor.top;
      const bottom =
        before && after
          ? Math.min(before.bottom, after.bottom)
          : anchor.bottom;

      slots.push({
        left: centerX - 2,
        top,
        width: 4,
        height: Math.max(24, bottom - top),
        orientation: "vertical"
      });
    }
    return slots;
  }

  function showLandingGuide(geometry, text = "Drop here") {
    if (!geometry) return null;
    let guide = document.querySelector(".rml-setup-demo-landing");
    if (!guide) {
      guide = document.createElement("div");
      guide.className = "rml-setup-demo-landing";
      document.body.appendChild(guide);
    }
    guide.dataset.orientation = geometry.orientation || "horizontal";
    guide.style.left = `${Math.max(4, geometry.left)}px`;
    guide.style.top = `${Math.max(4, geometry.top)}px`;
    guide.style.width = `${Math.max(4, geometry.width)}px`;
    guide.style.height = `${Math.max(4, geometry.height)}px`;
    guide.dataset.label = text;
    return guide;
  }

  async function waitForAnimationFrames(count = 2) {
    for (let index = 0; index < count; index += 1) {
      await tourNextVisualFrame();
    }
  }

  function nativeHorizontalOptionMarker(host) {
    const marker = host?.querySelector(":scope > .option-reorder-placeholder");
    if (
      !(marker instanceof HTMLElement) ||
      marker.parentElement !== host ||
      !host.classList.contains("option-drag-over") ||
      !tourElementActuallyVisible(marker)
    ) {
      return null;
    }
    const rect = marker.getBoundingClientRect();
    return {
      element: marker,
      geometry: {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
        orientation: rect.height >= rect.width ? "vertical" : "horizontal"
      }
    };
  }

  function anchorNativeHorizontalOptionMarker(
    host,
    marker,
    safeBand
  ) {
    if (
      !(host instanceof HTMLElement) ||
      !(marker?.element instanceof HTMLElement) ||
      !safeBand
    ) {
      return false;
    }
    const hostRect = host.getBoundingClientRect();
    const top = Math.max(
      0,
      safeBand.top - hostRect.top + host.scrollTop
    );
    const height = Math.max(
      24,
      Math.min(
        safeBand.height,
        hostRect.bottom - safeBand.top - 4
      )
    );
    marker.element.style.setProperty(
      "--option-placeholder-top",
      `${top}px`
    );
    marker.element.style.setProperty(
      "--rml-setup-option-anchor-top",
      `${top}px`
    );
    marker.element.style.setProperty(
      "--option-placeholder-height",
      `${height}px`
    );
    marker.element.style.setProperty(
      "--rml-setup-option-anchor-height",
      `${height}px`
    );
    return true;
  }

  function teacherMouseCoordinates() {
    const mouse = elements().mouse;
    if (!(mouse instanceof HTMLElement)) return null;
    const x = Number.parseFloat(
      mouse.style.getPropertyValue("--mouse-x")
    );
    const y = Number.parseFloat(
      mouse.style.getPropertyValue("--mouse-y")
    );
    return Number.isFinite(x) && Number.isFinite(y)
      ? { x, y }
      : null;
  }

  function teacherMouseVisualCoordinates() {
    const mouse = elements().mouse;
    const rect = mouse?.getBoundingClientRect?.();
    return rect && rect.width > 0 && rect.height > 0
      ? {
          x: rect.left + rect.width * .5,
          y: rect.top + rect.height * .5
        }
      : teacherMouseCoordinates();
  }

  function tourPointDistanceToRect(point, rect) {
    const dx = Math.max(rect.left - point.x, 0, point.x - rect.right);
    const dy = Math.max(rect.top - point.y, 0, point.y - rect.bottom);
    return Math.hypot(dx, dy);
  }

  function tourSegmentIntersectsRect(from, to, rect) {
    let minimum = 0;
    let maximum = 1;
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    for (const [p, q] of [
      [-dx, from.x - rect.left],
      [dx, rect.right - from.x],
      [-dy, from.y - rect.top],
      [dy, rect.bottom - from.y]
    ]) {
      if (Math.abs(p) < .000001) {
        if (q < 0) return false;
        continue;
      }
      const ratio = q / p;
      if (p < 0) minimum = Math.max(minimum, ratio);
      else maximum = Math.min(maximum, ratio);
      if (minimum > maximum) return false;
    }
    return true;
  }

  function clearLiveControlsActiveObstacles() {
    document.querySelectorAll(
      `[${LIVE_CONTROLS_ACTIVE_OBSTACLE_ATTRIBUTE}]`
    ).forEach(element =>
      element.removeAttribute(LIVE_CONTROLS_ACTIVE_OBSTACLE_ATTRIBUTE)
    );
  }

  function liveControlsActiveObstacles(extraTargets = []) {
    const marked = [...document.querySelectorAll(
      `[${LIVE_CONTROLS_ACTIVE_OBSTACLE_ATTRIBUTE}="true"]`
    )];
    const extras = Array.isArray(extraTargets)
      ? extraTargets
      : [extraTargets];
    const elements = [...new Set([...marked, ...extras])]
      .filter(element =>
        element instanceof HTMLElement &&
        element.isConnected &&
        tourElementActuallyVisible(element)
      );

    return elements.filter(element =>
      !elements.some(other =>
        other !== element && other.contains(element)
      )
    );
  }

  function setLiveControlsActiveObstacles(
    targets,
    reason = "active-teaching-element-changed"
  ) {
    const next = (Array.isArray(targets) ? targets : [targets])
      .filter(element =>
        element instanceof HTMLElement && element.isConnected
      );
    clearLiveControlsActiveObstacles();
    for (const element of next) {
      element.setAttribute(
        LIVE_CONTROLS_ACTIVE_OBSTACLE_ATTRIBUTE,
        "true"
      );
    }
    if (stepPhase !== "demonstrating" || next.length === 0) {
      return true;
    }
    const point =
      teacherMouseVisualCoordinates() ||
      teacherMouseCoordinates() ||
      centerOf(next[0]);
    return positionLiveControlsAwayFromMouseRoute([point], reason);
  }

  function positionLiveControlsAwayFromMouseRoute(
    points,
    reason = "mouse-route",
    avoidTargets = []
  ) {
    const controls = elements().liveControls;
    if (
      !(controls instanceof HTMLElement) ||
      controls.hidden ||
      stepPhase !== "demonstrating"
    ) {
      return true;
    }
    const route = (Array.isArray(points) ? points : [points]).filter(point =>
      Number.isFinite(point?.x) && Number.isFinite(point?.y)
    );
    if (route.length === 0) return true;

    const controlsRect = controls.getBoundingClientRect();
    const compactViewport =
      window.innerWidth <= 390 || window.innerHeight <= 700;
    const margin = window.innerWidth <= 780 ? 9 : 14;
    const width = Math.max(1, controls.offsetWidth || controlsRect.width);
    const height = Math.max(1, controls.offsetHeight || controlsRect.height);
    const viewport = {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight
    };
    const maximumLeft = Math.max(margin, viewport.right - margin - width);
    const maximumTop = Math.max(margin, viewport.bottom - margin - height);
    const placements = [];
    const seenPlacements = new Set();
    const addPlacement = (left, top, label = "edge") => {
      const boundedLeft = Math.max(margin, Math.min(maximumLeft, left));
      const boundedTop = Math.max(margin, Math.min(maximumTop, top));
      const key = `${Math.round(boundedLeft)}:${Math.round(boundedTop)}`;
      if (seenPlacements.has(key)) return;
      seenPlacements.add(key);
      placements.push({
        name: `${label}-${key}`,
        rect: {
          left: boundedLeft,
          top: boundedTop,
          right: boundedLeft + width,
          bottom: boundedTop + height
        }
      });
    };
    const horizontalStops = compactViewport
      ? [0, .25, .5, .75, 1]
      : [0, .5, 1];
    const verticalStops = compactViewport
      ? [0, .2, .4, .6, .8, 1]
      : [0, .5, 1];
    horizontalStops.forEach(factor => {
      const left = margin + (maximumLeft - margin) * factor;
      addPlacement(left, margin, "top");
      addPlacement(left, maximumTop, "bottom");
    });
    verticalStops.forEach(factor => {
      const top = margin + (maximumTop - margin) * factor;
      addPlacement(margin, top, "left");
      addPlacement(maximumLeft, top, "right");
    });

    const safety = compactViewport ? 30 : 48;
    const segments = route.slice(1).map((point, index) => [
      route[index],
      point
    ]);
    const dragObstacles = [
      document.querySelector("body > .option-pointer-ghost"),
      document.querySelector("body > .rml-graph-palette-ghost"),
      elements().dragGhost
    ].filter(element =>
      element instanceof HTMLElement &&
      tourElementActuallyVisible(element)
    ).map(element => element.getBoundingClientRect());
    const rectanglesOverlap = (left, right) => !(
      left.right < right.left ||
      left.left > right.right ||
      left.bottom < right.top ||
      left.top > right.bottom
    );
    const protectedPadding = compactViewport ? 10 : 14;
    const protectedRects = liveControlsActiveObstacles(avoidTargets)
      .map(target => {
      if (target instanceof Element) return target.getBoundingClientRect();
      if (
        Number.isFinite(target?.left) &&
        Number.isFinite(target?.top) &&
        Number.isFinite(target?.right) &&
        Number.isFinite(target?.bottom)
      ) {
        return target;
      }
      return null;
    }).filter(rect =>
      rect && rect.right - rect.left > 0 && rect.bottom - rect.top > 0
    ).map(rect => ({
      left: rect.left - protectedPadding,
      top: rect.top - protectedPadding,
      right: rect.right + protectedPadding,
      bottom: rect.bottom + protectedPadding
    }));
    for (const placement of placements) {
      const expanded = {
        left: placement.rect.left - safety,
        top: placement.rect.top - safety,
        right: placement.rect.right + safety,
        bottom: placement.rect.bottom + safety
      };
      const routeBlocked = route.some(point =>
        point.x >= expanded.left && point.x <= expanded.right &&
        point.y >= expanded.top && point.y <= expanded.bottom
      ) || segments.some(([from, to]) =>
        tourSegmentIntersectsRect(from, to, expanded)
      );
      const ghostBlocked = dragObstacles.some(rectangle =>
        rectanglesOverlap(rectangle, expanded)
      );
      const protectedTargetBlocked = protectedRects.some(rectangle =>
        rectanglesOverlap(rectangle, placement.rect)
      );
      const protectedOverlapArea = protectedRects.reduce(
        (total, rectangle) =>
          total + rectangleIntersectionArea(rectangle, placement.rect),
        0
      );
      const collisionScore =
        (routeBlocked ? 1_000_000_000 : 0) +
        (ghostBlocked ? 500_000_000 : 0) +
        protectedOverlapArea;
      placement.hardBlocked = routeBlocked || ghostBlocked;
      placement.routeBlocked = routeBlocked;
      placement.ghostBlocked = ghostBlocked;
      placement.protectedTargetBlocked = protectedTargetBlocked;
      placement.protectedOverlapArea = protectedOverlapArea;
      placement.collisionScore = collisionScore;
      placement.clearance = Math.min(
        ...route.map(point => tourPointDistanceToRect(point, placement.rect))
      );
      placement.current = controls.dataset.livePlacement === placement.name;
    }
    const hardSafePlacements = placements.filter(placement =>
      !placement.hardBlocked
    );
    const minimumProtectedOverlap = hardSafePlacements.length
      ? Math.min(...hardSafePlacements.map(
          placement => placement.protectedOverlapArea
        ))
      : Infinity;
    const completelyClearPlacementExists = hardSafePlacements.some(
      placement => placement.protectedOverlapArea <= .5
    );
    for (const placement of placements) {
      placement.usesMinimumCollisionFallback = Boolean(
        !placement.hardBlocked &&
        !completelyClearPlacementExists &&
        placement.protectedOverlapArea <= minimumProtectedOverlap + .5
      );
      placement.blocked = Boolean(
        placement.hardBlocked ||
        (
          completelyClearPlacementExists &&
          placement.protectedTargetBlocked
        )
      );
    }
    const currentSafe = placements.find(placement =>
      placement.current &&
      !placement.blocked &&
      (
        completelyClearPlacementExists ||
        placement.protectedOverlapArea <= minimumProtectedOverlap + .5
      ) &&
      placement.clearance >= safety
    );
    placements.sort((left, right) =>
      left.collisionScore - right.collisionScore ||
      right.clearance - left.clearance ||
      Number(right.current) - Number(left.current)
    );
    const selected = currentSafe || placements[0];
    if (!selected) return false;
    const previous = controls.dataset.livePlacement || "bottom-right";
    controls.dataset.livePlacement = selected.name;
    controls.style.left = `${selected.rect.left}px`;
    controls.style.top = `${selected.rect.top}px`;
    controls.style.right = "auto";
    controls.style.bottom = "auto";
    controls.style.transform = "none";

    if (teacherMouseSafetyState) {
      teacherMouseSafetyState.samples += 1;
      teacherMouseSafetyState.minimumClearance = Math.min(
        teacherMouseSafetyState.minimumClearance,
        selected.clearance
      );
      if (selected.blocked) teacherMouseSafetyState.violations += 1;
      if (previous !== selected.name) teacherMouseSafetyState.relocations += 1;
    }
    if (previous !== selected.name) {
      tourDebugRecord("teacher-mouse-live-controls-relocated", {
        reason,
        previous,
        placement: selected.name,
        route,
        dragObstacleCount: dragObstacles.length,
        routeBlocked: selected.routeBlocked,
        ghostBlocked: selected.ghostBlocked,
        protectedTargetBlocked: selected.protectedTargetBlocked,
        protectedOverlapArea:
          Math.round(selected.protectedOverlapArea * 10) / 10,
        minimumProtectedOverlap:
          Number.isFinite(minimumProtectedOverlap)
            ? Math.round(minimumProtectedOverlap * 10) / 10
            : null,
        minimumCollisionFallback:
          selected.usesMinimumCollisionFallback,
        protectedTargetCount: protectedRects.length,
        predictedClearance: Math.round(selected.clearance * 10) / 10,
        collisionFree: !selected.blocked
      });
    }
    return !selected.blocked;
  }

  function setTeacherMousePoint(
    point,
    duration = 0,
    routePoints = [],
    reason = "mouse-point"
  ) {
    const mouse = elements().mouse;
    if (!(mouse instanceof HTMLElement) || !point) return false;
    mouse.classList.remove("rml-setup-mouse-hard-hidden");
    delete mouse.dataset.hardHiddenReason;
    const current = teacherMouseVisualCoordinates() || teacherMouseCoordinates();
    const route = [
      current,
      ...(Array.isArray(routePoints) ? routePoints : []),
      point
    ].filter(Boolean);
    positionLiveControlsAwayFromMouseRoute(route, reason);
    mouse.style.setProperty("--mouse-duration", `${Math.max(0, duration)}ms`);
    mouse.style.setProperty("--mouse-x", `${point.x}px`);
    mouse.style.setProperty("--mouse-y", `${point.y}px`);
    return true;
  }

  async function waitForNativeHorizontalOptionMarker(
    host,
    heldPoint,
    dispatchMove,
    runId,
    frameLimit = 14
  ) {
    let lastArmResult = null;
    for (
      let frame = 0;
      frame < frameLimit && runId === demoRunId;
      frame += 1
    ) {
      dispatchMove(heldPoint);
      await waitForAnimationFrames(1);
      lastArmResult =
        window.RMLBuilderSetupBridge?.armHeldOptionHorizontal?.(
          host,
          heldPoint.x,
          heldPoint.y
        ) || null;
      const marker = nativeHorizontalOptionMarker(host);
      if (marker) return marker;
    }
    tourDebugRecord(
      "outline-nested-horizontal-arm-failed",
      {
        arm: lastArmResult,
        hostRect: tourDebugRect(host),
        markerRect: tourDebugRect(
          host?.querySelector(
            ":scope > .option-reorder-placeholder"
          )
        ),
        hostArmed:
          host?.classList.contains(
            "option-drag-over"
          ) === true
      }
    );
    return null;
  }

  async function followNativeHorizontalOptionMarker(
    host,
    duration,
    label,
    runId,
    anchorGeometry = null
  ) {
    const started = performance.now();
    let marker = nativeHorizontalOptionMarker(host);
    let guide = null;
    const stableBand = anchorGeometry
      ? { ...anchorGeometry }
      : marker?.geometry
        ? { ...marker.geometry }
        : null;
    const trackingGeometry = current => {
      if (!current?.geometry || !stableBand) return current?.geometry || null;
      const hostRect = host.getBoundingClientRect();
      const height = Math.max(
        24,
        Math.min(stableBand.height, Math.max(24, hostRect.height - 8))
      );
      const top = Math.max(
        hostRect.top + 4,
        Math.min(stableBand.top, hostRect.bottom - height - 4)
      );
      return {
        left: current.geometry.left,
        top,
        width: current.geometry.width,
        height,
        orientation: "vertical"
      };
    };
    try {
      while (
        runId === demoRunId &&
        performance.now() - started < duration
      ) {
        marker = nativeHorizontalOptionMarker(host) || marker;
        if (marker) {
          marker = {
            ...marker,
            geometry: trackingGeometry(marker)
          };
          guide = showLandingGuide(marker.geometry, label);
          guide?.classList.add("native-tracking");
        }
        await waitForAnimationFrames(1);
      }
      marker = nativeHorizontalOptionMarker(host) || marker;
      if (marker) {
        marker = {
          ...marker,
          geometry: trackingGeometry(marker)
        };
        guide = showLandingGuide(marker.geometry, label);
        guide?.classList.add("native-tracking");
      }
      return marker;
    } finally {
      guide?.classList.remove("native-tracking");
    }
  }

  function nearestVerticalSlot(host, point) {
    const slots = verticalInsertionSlots(host);
    if (!slots.length) return null;
    return slots.reduce(
      (best, current) =>
        Math.abs(current.top - point.y) < Math.abs(best.top - point.y)
          ? current
          : best,
      slots[0]
    );
  }

  function centerOf(element, xFactor = .5, yFactor = .5) {
    const rect = element?.getBoundingClientRect();
    return rect ? { x: rect.left + rect.width * xFactor, y: rect.top + rect.height * yFactor } : { x: window.innerWidth - 54, y: window.innerHeight - 66 };
  }

  async function moveMouse(point, duration = 720, runId = demoRunId) {
    const { mouse } = elements();
    if (!mouse || runId !== demoRunId) return false;
    mouse.classList.remove("rml-setup-mouse-hard-hidden");
    delete mouse.dataset.hardHiddenReason;
    mouse.classList.add("active");
    const effectiveDuration = tourPresentationDuration(duration);
    setTeacherMousePoint(
      point,
      effectiveDuration,
      [],
      "teacher-mouse-transition"
    );
    const ghost = elements().dragGhost;
    if (ghost && !ghost.hidden) {
      ghost.style.transition = `left ${effectiveDuration}ms cubic-bezier(.22,.75,.2,1), top ${effectiveDuration}ms cubic-bezier(.22,.75,.2,1)`;
      ghost.style.left = `${point.x + 16}px`;
      ghost.style.top = `${point.y + 12}px`;
    }
    await wait(effectiveDuration + 50);
    return runId === demoRunId;
  }

  async function clickMouse(runId = demoRunId) {
    const { mouse } = elements();
    if (!mouse || runId !== demoRunId) return;
    mouse.classList.add("pressed");
    await wait(170);
    mouse.classList.remove("pressed");
  }

  async function teacherClickElement(
    element,
    label,
    runId = demoRunId,
    options = {}
  ) {
    if (
      !(element instanceof HTMLElement) ||
      !element.isConnected ||
      runId !== demoRunId
    ) {
      return false;
    }

    const focus =
      options.focus instanceof HTMLElement
        ? options.focus
        : element;
    positionShades(focus);
    if (options.preserveCardPlacement === true) {
      // The caller already placed the card around a reserved future UI area.
    } else if (options.keepFocusVisible === true) {
      positionCardAwayFromPath(
        centerOf(focus, .08, .08),
        centerOf(focus, .92, .92)
      );
    } else {
      positionCard(focus);
    }
    let point = centerOf(element);
    const currentPoint =
      teacherMouseVisualCoordinates() || teacherMouseCoordinates();
    const requestedAvoidTargets = Array.isArray(options.avoidLiveControls)
      ? options.avoidLiveControls
      : options.avoidLiveControls
        ? [options.avoidLiveControls]
        : [];
    setLiveControlsActiveObstacles(
      [focus, element, ...requestedAvoidTargets],
      "teacher-click-active-element"
    );
    positionLiveControlsAwayFromMouseRoute(
      [currentPoint, point],
      "teacher-click-target-reservation",
      [focus, element, ...requestedAvoidTargets]
    );
    setTourControlHighlight(element, true);
    if (label) showDemoLabel(label, point, element);

    try {
      if (!(await moveMouse(point, 440, runId))) {
        return false;
      }

      const activeDialog = element.closest("dialog[open]");
      if (activeDialog instanceof HTMLDialogElement) {
        const stabilization =
          await stabilizeTeacherMouseAboveDialogTarget(
            activeDialog,
            element,
            runId
          );
        point = centerOf(element);
        const visibleAboveOverlay = tourDebugAssert(
          "teacher-mouse-visible-above-product-overlay",
          stabilization.passed === true,
          {
            dialogId: activeDialog.id || "",
            target: tourPerceptionElementLabel(element),
            mouseRect: tourDebugRect(elements().mouse),
            targetRect: tourDebugRect(element),
            assistantMountedInsideDialog:
              activeDialog.contains(elements().root),
            liveSkipControlsInsideDialog:
              activeDialog.contains(elements().liveControls),
            repairedOnFinalFrame: stabilization.repaired,
            stabilizationAttempts: stabilization.attempts
          }
        );
        if (!visibleAboveOverlay) {
          tourDebugRecord("dialog-mouse-visibility-check-contained", {
            dialogId: activeDialog.id || "",
            target: tourPerceptionElementLabel(element),
            interaction: "click",
            policy:
              "On an ultra-small viewport the already positioned real click continues; a visual-size diagnostic may not abort the product action."
          });
        }
      }

      await clickMouse(runId);
      if (runId !== demoRunId) return false;

      element.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId: 9090,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: point.x,
          clientY: point.y
        })
      );
      element.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId: 9090,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: 0,
          clientX: point.x,
          clientY: point.y
        })
      );
      element.click();

      await nextTwoFrames();
      return runId === demoRunId;
    } finally {
      setTourControlHighlight(element, false);
    }
  }

  async function teacherPointElement(
    element,
    label,
    runId = demoRunId,
    pause = 620
  ) {
    if (
      !(element instanceof HTMLElement) ||
      !element.isConnected ||
      runId !== demoRunId
    ) {
      return false;
    }

    const point = centerOf(element);
    focusDemonstration(element, 14);
    positionCard(element);
    setTourControlHighlight(element, true);
    if (label) showDemoLabel(label, point, element);
    try {
      if (!(await moveMouse(point, 440, runId))) return false;
      const activeDialog = element.closest("dialog[open]");
      if (activeDialog instanceof HTMLDialogElement) {
        const stabilization =
          await stabilizeTeacherMouseAboveDialogTarget(
            activeDialog,
            element,
            runId
          );
        const visibleAboveOverlay = tourDebugAssert(
          "teacher-mouse-visible-above-product-overlay",
          stabilization.passed === true,
          {
            dialogId: activeDialog.id || "",
            target: tourPerceptionElementLabel(element),
            mouseRect: tourDebugRect(elements().mouse),
            targetRect: tourDebugRect(element),
            assistantMountedInsideDialog:
              activeDialog.contains(elements().root),
            interaction: "point-only",
            repairedOnFinalFrame: stabilization.repaired,
            stabilizationAttempts: stabilization.attempts
          }
        );
        if (!visibleAboveOverlay) {
          tourDebugRecord("dialog-mouse-visibility-check-contained", {
            dialogId: activeDialog.id || "",
            target: tourPerceptionElementLabel(element),
            interaction: "point-only",
            policy:
              "On an ultra-small viewport the already positioned teacher point continues; a visual-size diagnostic may not abort the lesson."
          });
        }
      }
      await wait(pause);
      return runId === demoRunId;
    } finally {
      setTourControlHighlight(element, false);
    }
  }

  async function waitForOpenDialog(selector, runId = demoRunId) {
    for (let attempt = 0; attempt < 60 && runId === demoRunId; attempt += 1) {
      const dialog = document.querySelector(selector);
      if (dialog instanceof HTMLDialogElement && dialog.open) {
        await nextTwoFrames();
        return dialog;
      }
      await wait(40);
    }
    return null;
  }

  function elementVisibleInsideScroller(element, scroller, margin = 14) {
    if (!tourElementActuallyVisible(element) || !tourElementActuallyVisible(scroller)) {
      return false;
    }
    const target = element.getBoundingClientRect();
    const host = scroller.getBoundingClientRect();
    return (
      target.top >= host.top + margin &&
      target.bottom <= host.bottom - margin &&
      target.left >= host.left + margin &&
      target.right <= host.right - margin
    );
  }

  function minimalScrollerRevealPlan(element, scroller, margin = 8) {
    if (
      !(element instanceof HTMLElement) ||
      !(scroller instanceof HTMLElement)
    ) {
      return { useful: false, deltaX: 0, deltaY: 0 };
    }

    const target = element.getBoundingClientRect();
    const host = scroller.getBoundingClientRect();
    const left = host.left + margin;
    const right = host.right - margin;
    const top = host.top + margin;
    const bottom = host.bottom - margin;
    const availableWidth = Math.max(1, right - left);
    const availableHeight = Math.max(1, bottom - top);
    let deltaX = 0;
    let deltaY = 0;

    if (target.width <= availableWidth) {
      if (target.left < left) deltaX = target.left - left;
      else if (target.right > right) deltaX = target.right - right;
    } else {
      const overlap = Math.max(
        0,
        Math.min(target.right, right) - Math.max(target.left, left)
      );
      const required = Math.min(150, availableWidth * .62);
      if (overlap < required) {
        deltaX = target.right <= left + required
          ? target.right - (left + required)
          : target.left - (right - required);
      }
    }

    if (target.height <= availableHeight) {
      if (target.top < top) deltaY = target.top - top;
      else if (target.bottom > bottom) deltaY = target.bottom - bottom;
    } else {
      const overlap = Math.max(
        0,
        Math.min(target.bottom, bottom) - Math.max(target.top, top)
      );
      const required = Math.min(170, availableHeight * .62);
      if (overlap < required) {
        deltaY = target.bottom <= top + required
          ? target.bottom - (top + required)
          : target.top - (bottom - required);
      }
    }

    const maxLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const maxTop = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
    const desiredLeft = Math.max(0, Math.min(maxLeft, scroller.scrollLeft + deltaX));
    const desiredTop = Math.max(0, Math.min(maxTop, scroller.scrollTop + deltaY));
    deltaX = desiredLeft - scroller.scrollLeft;
    deltaY = desiredTop - scroller.scrollTop;

    return {
      useful: Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1,
      deltaX,
      deltaY
    };
  }

  async function teacherRevealInScroller(
    element,
    scroller,
    runId = demoRunId
  ) {
    if (
      !(element instanceof HTMLElement) ||
      !(scroller instanceof HTMLElement) ||
      runId !== demoRunId
    ) {
      return false;
    }
    if (elementVisibleInsideScroller(element, scroller)) return true;

    let plan = minimalScrollerRevealPlan(element, scroller);
    if (!plan.useful) return true;

    const hostRect = scroller.getBoundingClientRect();
    const point = {
      x: hostRect.left + hostRect.width * .82,
      y: hostRect.top + hostRect.height * .58
    };
    await moveMouse(point, 420, runId);
    if (runId !== demoRunId) return false;

    elements().mouse?.classList.add("scrolling");
    showDemoLabel("Reveal only the missing distance to the next control", point);

    for (let attempt = 0; attempt < 16 && runId === demoRunId; attempt += 1) {
      plan = minimalScrollerRevealPlan(element, scroller, 6);
      if (!plan.useful) break;

      if (Math.abs(plan.deltaY) > 1) {
        dispatchTourWheel(scroller, {
          deltaY: Math.sign(plan.deltaY) * Math.min(84, Math.abs(plan.deltaY))
        });
      } else if (Math.abs(plan.deltaX) > 1) {
        dispatchTourWheel(scroller, {
          deltaY: Math.sign(plan.deltaX) * Math.min(84, Math.abs(plan.deltaX)),
          shiftKey: true
        });
      } else {
        break;
      }
      await wait(TOUR_SCROLL_TIMING.autoScrollInterval);
    }

    elements().mouse?.classList.remove("scrolling");
    return elementVisibleInsideScroller(element, scroller, 4);
  }

  function elementVisibleRatioInsideRect(element, boundary) {
    if (!(element instanceof HTMLElement) || !boundary) return 0;
    const rect = element.getBoundingClientRect();
    const area = Math.max(0, rect.width * rect.height);
    if (!(area > 0)) return 0;
    return Math.max(
      0,
      Math.min(1, rectangleIntersectionArea(rect, boundary) / area)
    );
  }

  function topbarOpeningFrameVisibility() {
    const topbar = document.querySelector(".topbar");
    const toggle = document.querySelector("#top-menu-toggle");
    const actions = document.querySelector("#top-actions");
    const viewport = tourViewport();
    const viewportRect = {
      left: viewport.left,
      top: viewport.top,
      right: viewport.right,
      bottom: viewport.bottom
    };
    const topbarVisibleRatio = elementVisibleRatioInsideRect(
      topbar,
      viewportRect
    );
    const responsive = tourElementActuallyVisible(toggle);
    const menuOpen = Boolean(
      actions?.classList.contains("mobile-menu-open") &&
      toggle?.getAttribute("aria-expanded") === "true"
    );
    const actionSelectors = [
      "#new-blank",
      "#information-open",
      "#setup-guide-open",
      "#preview-open",
      "#project-manager",
      "#download-code"
    ];
    const actionProofs = actionSelectors.map(selector => {
      const element = document.querySelector(selector);
      const visibleRatio = elementVisibleRatioInsideRect(
        element,
        viewportRect
      );
      return {
        selector,
        visible: tourElementActuallyVisible(element),
        visibleRatio,
        rect: tourDebugRect(element)
      };
    });
    const toggleVisibleRatio = elementVisibleRatioInsideRect(
      toggle,
      viewportRect
    );
    const actionsOpacity = actions instanceof HTMLElement
      ? Number.parseFloat(getComputedStyle(actions).opacity || "0")
      : 0;
    const responsiveOpeningReady = Boolean(
      responsive &&
      toggleVisibleRatio >= .995 &&
      menuOpen === false &&
      actionsOpacity <= .02
    );
    const desktopOpeningReady = Boolean(
      !responsive &&
      actionProofs.length === actionSelectors.length &&
      actionProofs.every(action =>
        action.visible && action.visibleRatio >= .995
      )
    );
    const passed = Boolean(
      topbar instanceof HTMLElement &&
      tourElementActuallyVisible(topbar) &&
      topbarVisibleRatio >= .995 &&
      (responsiveOpeningReady || desktopOpeningReady)
    );
    return {
      passed,
      viewport: viewportRect,
      pageTop: Number(
        (document.scrollingElement || document.documentElement)
          ?.scrollTop || 0
      ),
      topbarRect: tourDebugRect(topbar),
      topbarVisibleRatio,
      responsive,
      menuOpen,
      toggleRect: tourDebugRect(toggle),
      toggleVisibleRatio,
      actionsRect: tourDebugRect(actions),
      actionsOpacity,
      responsiveOpeningReady,
      desktopOpeningReady,
      actionProofs
    };
  }

  async function prepareTopbarOpeningFrame(runId = demoRunId) {
    const scroller =
      document.scrollingElement || document.documentElement;
    const startingPageTop = Number(scroller?.scrollTop || 0);
    await animateTourPageScroll(
      0,
      TOUR_SCROLL_TIMING.pageScrollDuration,
      runId
    );
    if (runId !== demoRunId) return false;
    if (scroller) scroller.scrollTop = 0;
    await nextTwoFrames();

    await prepareTopbarBeforeNarration(runId);
    if (runId !== demoRunId) return false;
    const actions = document.querySelector("#top-actions");
    if (actions instanceof HTMLElement) {
      actions.scrollLeft = 0;
    }
    if (scroller) scroller.scrollTop = 0;
    await nextTwoFrames();

    const proof = topbarOpeningFrameVisibility();
    const restored = tourDebugAssert(
      "topbar-opening-frame-restored-from-arbitrary-page-scroll",
      proof.passed && proof.pageTop <= 1,
      {
        startingPageTop,
        ...proof,
        policy:
          "Step 1 always starts at the canonical page top: the complete real top bar is visible, all desktop actions are on-screen, or the responsive Hamburger is visible while its actions remain intentionally closed until explained"
      }
    );
    if (!restored) {
      throw new Error(
        "[RML Tour · Step 1] The complete top bar opening frame could not be restored after the page started scrolled away from the top."
      );
    }
    return true;
  }

  function responsiveTopActionsState(control = null) {
    const toggle = document.querySelector("#top-menu-toggle");
    const actions = document.querySelector("#top-actions");
    const responsive = tourElementActuallyVisible(toggle);
    const containsControl =
      !control ||
      (actions instanceof HTMLElement && actions.contains(control));
    const open = Boolean(
      actions?.classList.contains("mobile-menu-open") &&
      toggle?.getAttribute("aria-expanded") === "true"
    );
    return { toggle, actions, responsive, containsControl, open };
  }

  function compactTopbarActionVisibility(action) {
    const state = responsiveTopActionsState(action);
    const viewport = tourViewport();
    const actionRect = action instanceof HTMLElement
      ? action.getBoundingClientRect()
      : null;
    const actionsRect = state.actions instanceof HTMLElement
      ? state.actions.getBoundingClientRect()
      : null;
    const actionsOpacity = state.actions instanceof HTMLElement
      ? Number.parseFloat(getComputedStyle(state.actions).opacity || "0")
      : 0;
    const left = actionRect && actionsRect
      ? Math.max(actionRect.left, actionsRect.left, viewport.left)
      : 0;
    const right = actionRect && actionsRect
      ? Math.min(actionRect.right, actionsRect.right, viewport.right)
      : 0;
    const top = actionRect && actionsRect
      ? Math.max(actionRect.top, actionsRect.top, viewport.top)
      : 0;
    const bottom = actionRect && actionsRect
      ? Math.min(actionRect.bottom, actionsRect.bottom, viewport.bottom)
      : 0;
    const visibleWidth = Math.max(0, right - left);
    const visibleHeight = Math.max(0, bottom - top);
    const passed = Boolean(
      action instanceof HTMLElement &&
      state.responsive === true &&
      state.containsControl === true &&
      state.open === true &&
      tourElementActuallyVisible(action) &&
      actionsOpacity >= .98 &&
      visibleWidth >= Math.min(28, (actionRect?.width || 0) * .65) &&
      visibleHeight >= Math.min(28, (actionRect?.height || 0) * .65)
    );
    return {
      passed,
      state,
      actionRect,
      actionsRect,
      actionsOpacity,
      visibleWidth,
      visibleHeight
    };
  }

  async function revealCompactTopbarAction(
    action,
    runId = demoRunId
  ) {
    const state = responsiveTopActionsState(action);
    const actions = state.actions;
    if (
      !(action instanceof HTMLElement) ||
      !(actions instanceof HTMLElement) ||
      runId !== demoRunId ||
      !state.open
    ) {
      return false;
    }
    if (compactTopbarActionVisibility(action).passed) return true;

    const plan = minimalScrollerRevealPlan(action, actions, 6);
    if (!plan.useful) {
      return compactTopbarActionVisibility(action).passed;
    }

    const rect = actions.getBoundingClientRect();
    const mousePoint = {
      x: rect.left + rect.width * .5,
      y: rect.top + rect.height * .5
    };
    await moveMouse(mousePoint, 220, runId);
    if (runId !== demoRunId) return false;

    const fromLeft = Number(actions.scrollLeft || 0);
    const toLeft = fromLeft + plan.deltaX;
    const started = performance.now();
    const duration = Math.max(220, tourPresentationDuration(380));
    elements().mouse?.classList.add("scrolling", "horizontal-wheel");
    try {
      while (runId === demoRunId) {
        const frame = await tourNextVisualFrame();
        const now = Math.max(performance.now(), frame.timestamp);
        const raw = Math.min(1, (now - started) / duration);
        const eased = 1 - Math.pow(1 - raw, 3);
        actions.scrollLeft = fromLeft + (toLeft - fromLeft) * eased;
        if (raw >= 1) break;
      }
      actions.scrollLeft = toLeft;
      await nextTwoFrames();
    } finally {
      elements().mouse?.classList.remove("scrolling", "horizontal-wheel");
    }
    return compactTopbarActionVisibility(action).passed;
  }

  async function waitForStableCompactTopbarAction(
    action,
    runId,
    maximumSamples = 30
  ) {
    let stableSamples = 0;
    let last = compactTopbarActionVisibility(action);
    const samples = [];
    for (
      let sample = 0;
      sample < maximumSamples && runId === demoRunId;
      sample += 1
    ) {
      last = compactTopbarActionVisibility(action);
      stableSamples = last.passed ? stableSamples + 1 : 0;
      samples.push({
        sample,
        passed: last.passed,
        open: last.state.open,
        responsive: last.state.responsive,
        opacity: last.actionsOpacity,
        visibleWidth: last.visibleWidth,
        visibleHeight: last.visibleHeight,
        actionRect: last.actionRect
          ? {
              left: last.actionRect.left,
              top: last.actionRect.top,
              right: last.actionRect.right,
              bottom: last.actionRect.bottom
            }
          : null
      });
      if (stableSamples >= 3) {
        return { passed: true, stableSamples, last, samples };
      }
      await wait(44);
    }
    return { passed: false, stableSamples, last, samples };
  }

  async function ensureCompactTopbarNarrationHandoff(
    selector,
    runId = demoRunId
  ) {
    const action = document.querySelector(selector);
    let repaired = false;
    let reopened = false;
    let recentered = false;
    let observation = await waitForStableCompactTopbarAction(
      action,
      runId,
      30
    );

    if (!observation.passed && runId === demoRunId) {
      repaired = true;
      let state = responsiveTopActionsState(action);
      if (state.open && state.actions instanceof HTMLElement) {
        recentered = await revealCompactTopbarAction(action, runId);
      } else if (
        state.responsive &&
        state.toggle instanceof HTMLElement
      ) {
        reopened = await teacherClickElement(
          state.toggle,
          "",
          runId,
          {
            focus: document.querySelector(".topbar"),
            keepFocusVisible: true
          }
        );
      }
      observation = await waitForStableCompactTopbarAction(
        action,
        runId,
        30
      );
    }

    if (selector === "#pack-into-node") {
      mobilePackPreparedForNarration = observation.passed === true;
    } else {
      mobileTopbarPreparedForNarration = observation.passed === true;
    }
    if (elements().demoLabel) elements().demoLabel.hidden = true;
    hideMouse();
    const passed = tourDebugAssert(
      "mobile-topbar-first-action-live-handoff",
      observation.passed === true,
      {
        target: selector,
        repaired,
        reopened,
        recentered,
        stableSamples: observation.stableSamples,
        finalOpen: observation.last?.state?.open === true,
        finalResponsive:
          observation.last?.state?.responsive === true,
        finalOpacity: observation.last?.actionsOpacity || 0,
        finalVisibleWidth: observation.last?.visibleWidth || 0,
        finalVisibleHeight: observation.last?.visibleHeight || 0,
        samples: observation.samples,
        policy:
          "observe the real responsive menu across consecutive samples, repair only a lost live state, then narrate its first genuinely visible action"
      }
    );
    return {
      passed,
      action,
      repaired,
      reopened,
      recentered,
      stableSamples: observation.stableSamples,
      observation
    };
  }

  async function teacherEnsureResponsiveTopActionsOpen(
    control,
    label,
    runId = demoRunId
  ) {
    const before = responsiveTopActionsState(control);
    if (
      runId !== demoRunId ||
      !before.responsive ||
      !before.containsControl
    ) {
      return {
        required: false,
        openedByTeacher: false,
        open: before.open
      };
    }
    if (before.open) {
      return {
        required: true,
        openedByTeacher: false,
        open: true
      };
    }

    const topbar = document.querySelector(".topbar");
    const clicked = await teacherClickElement(
      before.toggle,
      label,
      runId,
      { focus: topbar, keepFocusVisible: true }
    );
    await wait(260);
    const after = responsiveTopActionsState(control);
    return {
      required: true,
      openedByTeacher: clicked === true && after.open,
      open: after.open
    };
  }

  async function prepareTopbarBeforeNarration(runId = demoRunId) {
    let state = responsiveTopActionsState();
    if (!state.responsive || runId !== demoRunId) {
      mobileTopbarPreparedForNarration = false;
      return true;
    }

    const hiddenActions = [
      "#new-blank",
      "#information-open",
      "#setup-guide-open",
      "#preview-open",
      "#project-manager",
      "#download-code"
    ].map(selector => document.querySelector(selector)).filter(Boolean);

    if (state.open) {
      await teacherClickElement(
        state.toggle,
        "Close the compact menu once so its real opening can be prepared visibly",
        runId,
        { focus: document.querySelector(".topbar"), keepFocusVisible: true }
      );
      await wait(180);
      state = responsiveTopActionsState();
    }

    const hiddenActionsStayedUnlit = tourDebugAssert(
      "mobile-topbar-no-hidden-action-highlight-before-hamburger",
      state.open === false &&
        hiddenActions.every(action =>
          !action.classList.contains("rml-setup-control-highlight") &&
          !action.classList.contains("rml-setup-narration-outline")
        ),
      {
        actionsOpen: state.open,
        layoutVisibleActionIds: hiddenActions
          .filter(tourElementActuallyVisible)
          .map(action => action.id),
        highlightedHiddenActionIds: hiddenActions
          .filter(action =>
            action.classList.contains("rml-setup-control-highlight") ||
            action.classList.contains("rml-setup-narration-outline")
          )
          .map(action => action.id)
      }
    );
    if (!hiddenActionsStayedUnlit) {
      throw new Error(
        "[RML Tour · Step 1] A hidden compact action was highlighted before the Hamburger preparation."
      );
    }

    mobileTopbarPreparedForNarration = false;
    tourDebugRecord("mobile-topbar-ready-for-hamburger-explanation", {
      actionsOpen: state.open,
      ariaExpanded: state.toggle?.getAttribute("aria-expanded") || "false",
      hiddenActionCount: hiddenActions.length
    });
    return true;
  }

  async function prepareCompactPackBeforeNarration(runId = demoRunId) {
    const packButton =
      document.querySelector(".rml-pack-button") ||
      document.querySelector("#pack-into-node");
    let before = responsiveTopActionsState(packButton);
    if (!before.responsive || runId !== demoRunId) {
      mobilePackPreparedForNarration = false;
      return true;
    }

    const pageScroller =
      document.scrollingElement || document.documentElement;
    const pageTopBefore = Number(pageScroller?.scrollTop || 0);
    if (pageTopBefore > 1) {
      window.RMLTypedNodeGraphScrollLayers?.clear?.();
      window.RMLUniversalScrollLayers?.clear?.();
      await animateTourPageScroll(
        0,
        TOUR_SCROLL_TIMING.pageScrollDuration,
        runId
      );
      if (runId !== demoRunId) return false;
    }
    if (pageScroller) pageScroller.scrollTop = 0;
    await nextTwoFrames();
    before = responsiveTopActionsState(packButton);

    if (before.open) {
      await teacherClickElement(
        before.toggle,
        "Close the compact menu once before the Pack lesson is prepared",
        runId,
        { focus: document.querySelector(".topbar"), keepFocusVisible: true }
      );
      await wait(180);
      before = responsiveTopActionsState(packButton);
    }

    const hiddenButtonStayedUnlit = tourDebugAssert(
      "mobile-pack-no-hidden-highlight-before-hamburger",
      before.open === false &&
        !tourElementActuallyVisible(packButton) &&
        !packButton?.classList.contains("rml-setup-control-highlight") &&
        narrationOutlineGroups.length === 0,
      {
        actionsOpen: before.open,
        packButtonVisible: tourElementActuallyVisible(packButton),
        narrationOutlineCount: narrationOutlineGroups.length
      }
    );
    if (!hiddenButtonStayedUnlit) {
      throw new Error(
        "[RML Tour · Step 6] Pack into Node was exposed or highlighted before the compact Hamburger preparation."
      );
    }

    const opened = await teacherEnsureResponsiveTopActionsOpen(
      packButton,
      "Open the real Hamburger before explaining Pack into Runtime Graph",
      runId
    );
    await nextTwoFrames();
    let after = responsiveTopActionsState(packButton);
    let revealedByScroll = elementVisibleInsideScroller(
      packButton,
      after.actions,
      6
    );
    if (
      after.open &&
      after.actions instanceof HTMLElement &&
      !revealedByScroll
    ) {
      revealedByScroll = await revealCompactTopbarAction(
        packButton,
        runId
      );
      await nextTwoFrames();
      after = responsiveTopActionsState(packButton);
    }
    const liveVisibility = compactTopbarActionVisibility(packButton);
    mobilePackPreparedForNarration = Boolean(
      opened.required &&
      after.open &&
      revealedByScroll &&
      liveVisibility.passed
    );
    const prepared = tourDebugAssert(
      "mobile-pack-hamburger-opened-before-pack-narration",
      mobilePackPreparedForNarration,
      {
        openedByTeacher: opened.openedByTeacher === true,
        actionsOpen: after.open,
        ariaExpanded: after.toggle?.getAttribute("aria-expanded") || "false",
        packButtonVisible: tourElementActuallyVisible(packButton),
        packButtonInsideMenu: revealedByScroll,
        visibleWidth: liveVisibility.visibleWidth,
        visibleHeight: liveVisibility.visibleHeight,
        menuScrollLeft: Number(after.actions?.scrollLeft || 0),
        pageTopBefore,
        pageTopAfter: Number(pageScroller?.scrollTop || 0),
        openedBeforeNarration: true
      }
    );
    if (!prepared) {
      throw new Error(
        "[RML Tour · Step 6] The compact Hamburger did not reveal Pack into Node before narration."
      );
    }
    if (elements().demoLabel) elements().demoLabel.hidden = true;
    hideMouse();
    return true;
  }

  async function teacherOpenModal(
    button,
    dialogSelector,
    label,
    runId = demoRunId
  ) {
    const menu = await teacherEnsureResponsiveTopActionsOpen(
      button,
      label
        ? "Open the responsive action menu with its real Hamburger button"
        : "",
      runId
    );
    if (menu.required && !menu.open) return null;
    if (!tourElementActuallyVisible(button) || runId !== demoRunId) return null;
    await nativeTourScrollTargetIntoView(button, runId);
    if (runId !== demoRunId) return null;
    await teacherClickElement(button, label, runId);
    if (runId !== demoRunId) return null;
    const dialog = await waitForOpenDialog(dialogSelector, runId);
    if (!dialog || runId !== demoRunId) return null;
    mountTourSurfaceInModal(dialog);
    return dialog;
  }

  async function nativeUserPointerDrag(
    startElement,
    targetPoint,
    duration,
    runId,
    pointerId,
    options = {}
  ) {
    if (
      !(startElement instanceof HTMLElement) ||
      !targetPoint ||
      runId !== demoRunId
    ) {
      return false;
    }

    const from =
      Number.isFinite(options.startPoint?.x) &&
      Number.isFinite(options.startPoint?.y)
        ? options.startPoint
        : centerOf(startElement);
    const { mouse } = elements();
    let pointerIsDown = false;
    let nativeGhostConfirmed = false;
    let nativeGhostNotified = false;
    let nativeGhostVisibleFrames = 0;
    let lastDragVectorAt = -Infinity;
    let finalPoint = targetPoint;
    let interactionPhase = "source";
    const requestedRoute = [
      from,
      ...(Array.isArray(options.pathPoints) ? options.pathPoints : []),
      targetPoint
    ].filter(point => Number.isFinite(point?.x) && Number.isFinite(point?.y));
    const route = requestedRoute.filter(
      (point, index) =>
        index === 0 ||
        Math.hypot(
          point.x - requestedRoute[index - 1].x,
          point.y - requestedRoute[index - 1].y
        ) >= 2
    );
    const initialStageTarget =
      options.stageTarget || tourPointRect(targetPoint, 54);
    const stageFocusTarget =
      options.stageFocusTarget || initialStageTarget;

    focusDemonstration(startElement, 12);
    await moveMouse(from, 360, runId);
    if (runId !== demoRunId) return false;

    const dispatchMove = point => {
      setTeacherMousePoint(
        point,
        0,
        [],
        "native-user-pointer-drag"
      );
      document.dispatchEvent(
        new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          isPrimary: true,
          button: -1,
          buttons: 1,
          clientX: point.x,
          clientY: point.y
        })
      );

      if (nativeProductDragGhostVisible()) {
        nativeGhostVisibleFrames += 1;
        if (nativeGhostVisibleFrames >= 2) {
          nativeGhostConfirmed = true;
          hideGhost();
          if (!nativeGhostNotified) {
            nativeGhostNotified = true;
            options.onNativeGhostConfirmed?.({
              pointerId,
              source: startElement,
              point
            });
          }
        }
      } else if (!nativeGhostConfirmed && elements().dragGhost?.hidden) {
        showFaithfulDragGhost(startElement, point);
      } else if (!nativeGhostConfirmed) {
        moveFaithfulDragGhost(point);
      }

      options.onPointerFrame?.({
        pointerId,
        point,
        phase: interactionPhase,
        nativeGhostVisible: nativeProductDragGhostVisible(),
        faithfulGhostVisible: Boolean(
          elements().dragGhost &&
          !elements().dragGhost.hidden &&
          tourElementActuallyVisible(elements().dragGhost)
        ),
        nativeInteraction:
          window.RMLDynamicGraphHost?.getGuidedInteractionState?.() || null
      });

      const now = performance.now();
      if (
        options.capturePointerMarker !== false &&
        now - lastDragVectorAt >= 80
      ) {
        lastDragVectorAt = now;
        const nativeMarkerElement = document.querySelector(
          ".drag-reorder-placeholder"
        );
        const nativeMarkerHost = nativeMarkerElement?.parentElement || null;
        const nativeMarkerRectangle = nativeMarkerElement instanceof HTMLElement
          ? nativeMarkerElement.getBoundingClientRect()
          : null;
        const nativeMarkerStyle = nativeMarkerElement instanceof HTMLElement
          ? getComputedStyle(nativeMarkerElement)
          : null;
        const nativeMarkerVisible = Boolean(
          nativeMarkerRectangle &&
          nativeMarkerElement?.hidden !== true &&
          nativeMarkerStyle?.display !== "none" &&
          nativeMarkerStyle?.visibility !== "hidden" &&
          nativeMarkerRectangle.width >= 2 &&
          nativeMarkerRectangle.height >= 2
        );
        const nativeMarkerGeometry = nativeMarkerVisible
          ? {
              left: nativeMarkerRectangle.left,
              top: nativeMarkerRectangle.top,
              width: nativeMarkerRectangle.width,
              height: nativeMarkerRectangle.height,
              orientation:
                nativeMarkerRectangle.width >= nativeMarkerRectangle.height
                  ? "horizontal"
                  : "vertical"
            }
          : null;
        const nativeMarkerClear = Boolean(
          nativeMarkerHost instanceof HTMLElement &&
          nativeMarkerGeometry?.orientation === "horizontal" &&
          !verticalSlotCrossesLiveContent(
            nativeMarkerHost,
            nativeMarkerGeometry
          )
        );
        const nativeMarkerSample = nativeMarkerGeometry
          ? {
              geometry: {
                ...nativeMarkerGeometry,
                right: nativeMarkerRectangle.right,
                bottom: nativeMarkerRectangle.bottom
              },
              hostId: nativeMarkerHost?.id || "",
              hostClasses: nativeMarkerHost?.className || "",
              clearOfControls: nativeMarkerClear
            }
          : null;
        options.onPointerMarkerSample?.({
          marker: nativeMarkerElement,
          host: nativeMarkerHost,
          geometry: nativeMarkerGeometry,
          clearOfControls: nativeMarkerClear
        });
        tourDebugRecord("pointer-drag-vector", {
          pointerId,
          point: {
            x: Math.round(point.x * 10) / 10,
            y: Math.round(point.y * 10) / 10
          },
          source: {
            id: startElement.id || "",
            classes: startElement.className || "",
            rect: tourDebugRect(startElement)
          },
          nativeGhostVisible: nativeProductDragGhostVisible(),
          nativeInsertMarker: nativeMarkerSample,
          guideRect: tourDebugRect(
            document.querySelector(".rml-setup-demo-landing")
          )
        });
      }
    };

    const animateSegment = async (
      segmentFrom,
      segmentTo,
      segmentDuration,
      activateStage = false
    ) => {
      const started = performance.now();
      while (runId === demoRunId) {
        const raw = Math.min(
          1,
          (performance.now() - started) / Math.max(1, segmentDuration)
        );
        const eased = 1 - Math.pow(1 - raw, 2.25);
        const point = {
          x: segmentFrom.x + (segmentTo.x - segmentFrom.x) * eased,
          y: segmentFrom.y + (segmentTo.y - segmentFrom.y) * eased
        };
        if (activateStage && raw >= .42) setDragStageState("active");
        dispatchMove(point);
        if (raw >= 1) return true;
        await tourNextVisualFrame();
      }
      return false;
    };

    const animateRoute = async (points, totalDuration) => {
      if (points.length < 2) return true;
      const distances = points.slice(1).map((point, index) =>
        Math.max(1, Math.hypot(
          point.x - points[index].x,
          point.y - points[index].y
        ))
      );
      const totalDistance = distances.reduce((sum, value) => sum + value, 0);
      for (let index = 1; index < points.length; index += 1) {
        const segmentDuration = Math.max(
          150,
          totalDuration * distances[index - 1] / totalDistance
        );
        const completed = await animateSegment(
          points[index - 1],
          points[index],
          segmentDuration,
          index === points.length - 1
        );
        if (!completed) return false;
      }
      return true;
    };

    try {
      startElement.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: from.x,
          clientY: from.y
        })
      );
      pointerIsDown = true;
      mouse?.classList.add("active", "pressed");
      showFaithfulDragGhost(startElement, from);

      const pointerDownState = {
        pointerId,
        point: from,
        nativeInteraction:
          window.RMLDynamicGraphHost?.getGuidedInteractionState?.() || null
      };
      options.onPointerDownState?.(pointerDownState);
      if (typeof options.pointerDownReady === "function") {
        const pointerDownReady = await options.pointerDownReady(
          pointerDownState
        );
        tourDebugRecord("pointer-drag-native-source-armed", {
          pointerId,
          armed: pointerDownReady === true,
          nativeInteraction: pointerDownState.nativeInteraction,
          source: tourPerceptionElementLabel(startElement)
        });
        if (pointerDownReady !== true || runId !== demoRunId) {
          return false;
        }
      }

      positionShades(stageFocusTarget);
      showDragStage(
        initialStageTarget,
        options.stageLabel || "Drop target",
        "armed"
      );

      const initialDistance = route.slice(1).reduce(
        (sum, point, index) => sum + Math.hypot(
          point.x - route[index].x,
          point.y - route[index].y
        ),
        0
      );
      const initialDuration = options.minimumTeachingDuration === false
        ? duration
        : Math.max(
            duration,
            Math.min(2400, 1050 + initialDistance * 1.2)
          );
      interactionPhase = "initial-route";
      if (!(await animateRoute(route, initialDuration))) return false;

      if (typeof options.onInitialRouteComplete === "function") {
        await options.onInitialRouteComplete({
          pointerId,
          point: finalPoint,
          dispatchMove
        });
      }

      if (runId !== demoRunId) return false;

      const edgeHoldMs = Math.max(0, Number(options.edgeHoldMs) || 0);
      if (edgeHoldMs > 0) {
        interactionPhase = "edge-hold";
        setDragStageState("active");
        options.onEdgeHoldStart?.();
        const holdStarted = performance.now();
        const minimumHold = Math.min(
          edgeHoldMs,
          Math.max(0, Number(options.edgeHoldMinMs) || 0)
        );
        while (
          runId === demoRunId &&
          performance.now() - holdStarted < edgeHoldMs &&
          (
            performance.now() - holdStarted < minimumHold ||
            typeof options.edgeHoldUntil !== "function" ||
            !options.edgeHoldUntil()
          )
        ) {
          dispatchMove(finalPoint);
          options.onEdgeHoldFrame?.({
            point: finalPoint,
            elapsed: performance.now() - holdStarted,
            dispatchMove
          });
          await tourNextVisualFrame();
        }
        options.onEdgeHoldEnd?.();
      }

      if (runId !== demoRunId) return false;

      if (typeof options.afterEdgeHold === "function") {
        interactionPhase = "continuation";
        const continuation = await options.afterEdgeHold(finalPoint, {
          pointerId,
          dispatchMove
        });
        if (runId !== demoRunId) return false;
        if (
          Number.isFinite(continuation?.startPoint?.x) &&
          Number.isFinite(continuation?.startPoint?.y)
        ) {
          finalPoint = continuation.startPoint;
        }
        if (continuation?.point) {
          const continuationRoute = [
            finalPoint,
            ...(Array.isArray(continuation.pathPoints)
              ? continuation.pathPoints
              : []),
            continuation.point
          ];
          if (continuation.stageTarget) {
            showDragStage(
              continuation.stageTarget,
              continuation.stageLabel || "Exact insertion position",
              "armed"
            );
          }
          if (!(await animateRoute(
            continuationRoute,
            Math.max(260, Number(continuation.duration) || 720)
          ))) {
            return false;
          }
          finalPoint = continuation.point;
        }
      }

      if (runId !== demoRunId) return false;

      if (typeof options.onBeforeRelease === "function") {
        const continuation = await options.onBeforeRelease({
          point: finalPoint,
          pointerId,
          dispatchMove
        });
        if (runId !== demoRunId) return false;
        if (continuation?.cancel === true) return false;
        if (
          Number.isFinite(continuation?.startPoint?.x) &&
          Number.isFinite(continuation?.startPoint?.y)
        ) {
          finalPoint = continuation.startPoint;
        }
        if (continuation?.point) {
          const continuationRoute = [
            finalPoint,
            ...(Array.isArray(continuation.pathPoints)
              ? continuation.pathPoints
              : []),
            continuation.point
          ];
          if (!(await animateRoute(
            continuationRoute,
            Math.max(260, Number(continuation.duration) || 720)
          ))) {
            return false;
          }
          finalPoint = continuation.point;
        }
      }

      if (typeof options.releaseReady === "function") {
        dispatchMove(finalPoint);
        await nextTwoFrames();
        if (runId !== demoRunId) return false;
        const releaseReady = await options.releaseReady(finalPoint);
        if (!releaseReady || runId !== demoRunId) return false;
      }

      setDragStageState("active");

      document.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: 0,
          clientX: finalPoint.x,
          clientY: finalPoint.y
        })
      );
      pointerIsDown = false;

      if (typeof options.afterPointerUp === "function") {
        const releaseOutcome = await options.afterPointerUp({
          point: finalPoint,
          pointerId
        });
        if (
          releaseOutcome === false ||
          releaseOutcome?.accepted === false ||
          runId !== demoRunId
        ) {
          return false;
        }
      }

      setDragStageState("committed");
      await nextTwoFrames();
      await wait(Math.max(180, Number(options.commitHoldMs) || 320));
      return runId === demoRunId;
    } finally {
      if (pointerIsDown) {
        document.dispatchEvent(
          new PointerEvent("pointercancel", {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons: 0,
            clientX: from.x,
            clientY: from.y
          })
        );
      }
      mouse?.classList.remove("pressed");
      hideGhost();
      clearDragStage();
    }
  }

  async function dragMouse(from, to, duration = 1080, runId = demoRunId) {
    if (!(await moveMouse(from, 500, runId))) return false;
    const { mouse } = elements();
    mouse?.classList.add("pressed");
    if (!(await moveMouse(to, duration, runId))) return false;
    mouse?.classList.remove("pressed");
    return runId === demoRunId;
  }

  async function nativeGraphViewportPan(
    viewport,
    from,
    to,
    duration = 1150,
    runId = demoRunId
  ) {
    if (!viewport || !from || !to || runId !== demoRunId) {
      return false;
    }

    const pointerId = 9120;
    const mouse = elements().mouse;

    positionCardAwayFromPath(from, to);
    if (!(await moveMouse(from, 420, runId))) {
      return false;
    }

    showDemoLabel(
      "Hold empty ROOT and drag → the whole graph moves",
      from
    );

    viewport.dispatchEvent(
      new PointerEvent(
        "pointerdown",
        {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: 1,
          clientX: from.x,
          clientY: from.y
        }
      )
    );

    mouse?.classList.add(
      "active",
      "pressed"
    );

    await wait(180);
    if (runId !== demoRunId) return false;

    const started = performance.now();

    while (runId === demoRunId) {
      const raw = Math.min(
        1,
        (performance.now() - started) /
          Math.max(1, duration)
      );

      const eased =
        raw < 0.5
          ? 2 * raw * raw
          : 1 -
            Math.pow(-2 * raw + 2, 2) / 2;

      const point = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased
      };

      setTeacherMousePoint(
        point,
        0,
        [],
        "native-graph-viewport-pan"
      );

      viewport.dispatchEvent(
        new PointerEvent(
          "pointermove",
          {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: "mouse",
            isPrimary: true,
            button: -1,
            buttons: 1,
            clientX: point.x,
            clientY: point.y
          }
        )
      );

      if (raw >= 1) break;

      await tourNextVisualFrame();
    }

    viewport.dispatchEvent(
      new PointerEvent(
        "pointerup",
        {
          bubbles: true,
          cancelable: true,
          pointerId,
          pointerType: "mouse",
          isPrimary: true,
          button: 0,
          buttons: 0,
          clientX: to.x,
          clientY: to.y
        }
      )
    );

    mouse?.classList.remove("pressed");

    showDemoLabel(
      "ROOT panned — nodes and wires moved with the canvas",
      to
    );

    await wait(520);

    return runId === demoRunId;
  }

  function showGhost(text, point, kind = "setting") {
    const { dragGhost } = elements();
    if (!dragGhost) return;
    dragGhost.hidden = false;
    dragGhost.className = `rml-setup-drag-ghost ${kind}`;
    dragGhost.textContent = text;
    dragGhost.style.transition = "none";
    dragGhost.style.left = `${point.x + 16}px`;
    dragGhost.style.top = `${point.y + 12}px`;
  }

  function nativeProductDragGhostVisible() {
    return [
      ...document.querySelectorAll(
        ".node-pointer-ghost, .option-pointer-ghost, .palette-pointer-ghost, " +
        ".rml-graph-palette-ghost, .rml-graph-palette-drag-ghost"
      )
    ].some(element =>
      !element.closest("#rml-setup-assistant") &&
      tourElementActuallyVisible(element)
    );
  }

  function sanitizeDragGhostClone(clone) {
    if (!(clone instanceof HTMLElement)) return clone;
    [clone, ...clone.querySelectorAll("*")].forEach(element => {
      element.removeAttribute("id");
      element.removeAttribute("draggable");
      element.removeAttribute("data-node-id");
      element.removeAttribute("data-option-id");
      element.removeAttribute("data-controller-id");
      element.removeAttribute("data-container");
      element.removeAttribute("data-palette");
      if (
        element instanceof HTMLButtonElement ||
        element instanceof HTMLInputElement ||
        element instanceof HTMLSelectElement ||
        element instanceof HTMLTextAreaElement
      ) {
        element.disabled = true;
        element.tabIndex = -1;
      }
    });
    clone.setAttribute("aria-hidden", "true");
    return clone;
  }

  function showFaithfulDragGhost(source, point) {
    const { dragGhost } = elements();
    if (!dragGhost || !(source instanceof HTMLElement)) return;
    const clone = sanitizeDragGhostClone(source.cloneNode(true));
    dragGhost.replaceChildren(clone);
    dragGhost.hidden = false;
    dragGhost.className = "rml-setup-drag-ghost faithful";
    dragGhost.style.transition = "none";
    dragGhost.style.left = `${point.x + 16}px`;
    dragGhost.style.top = `${point.y + 12}px`;
  }

  function moveFaithfulDragGhost(point) {
    const { dragGhost } = elements();
    if (!dragGhost || dragGhost.hidden) return;
    dragGhost.style.transition = "none";
    dragGhost.style.left = `${point.x + 16}px`;
    dragGhost.style.top = `${point.y + 12}px`;
  }

  function hideGhost() {
    const { dragGhost } = elements();
    if (dragGhost) {
      dragGhost.hidden = true;
      dragGhost.replaceChildren();
    }
  }

  function pulseAt(element, className = "rml-setup-demo-pulse") {
    if (stepPhase === "demonstrating") return null;
    const rect = element?.getBoundingClientRect();
    if (!rect) return null;
    const pulse = document.createElement("div");
    pulse.className = className;
    pulse.style.left = `${rect.left}px`;
    pulse.style.top = `${rect.top}px`;
    pulse.style.width = `${rect.width}px`;
    pulse.style.height = `${rect.height}px`;
    document.body.appendChild(pulse);
    const timer = window.setTimeout(() => pulse.remove(), 720);
    demoTimers.push(timer);
    return pulse;
  }

  function setTourControlHighlight(element, active) {
    const styleId = "rml-setup-control-highlight-style";
    let style = document.getElementById(styleId);

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .rml-setup-control-highlight {
          position: relative !important;
          z-index: 100020 !important;
          isolation: isolate;
          box-shadow:
            0 0 0 2px rgba(168, 100, 255, 0.95),
            0 0 18px rgba(168, 100, 255, 0.9),
            0 0 34px rgba(89, 183, 255, 0.48) !important;
          filter:
            brightness(1.35)
            saturate(1.18)
            drop-shadow(0 0 8px rgba(168, 100, 255, 0.7)) !important;
          opacity: 1 !important;
        }
      `;
      document.head.appendChild(style);
    }

    if (element instanceof Element) {
      const allowHighlight =
        active === true &&
        stepPhase !== "demonstrating";
      element.classList.toggle(
        "rml-setup-control-highlight",
        allowHighlight
      );
    }
  }

  function showDemoLabel(text, point, avoidTarget = null) {
    const { demoLabel } = elements();
    if (!demoLabel) return;
    if (stepPhase === "demonstrating") {
      demoLabel.hidden = true;
      return;
    }
    if (!text) {
      demoLabel.hidden = true;
      return;
    }
    demoLabel.hidden = false;
    demoLabel.textContent = text;
    const viewport = tourEffectViewport();
    const labelRect = demoLabel.getBoundingClientRect();
    const width = Math.max(120, labelRect.width);
    const height = Math.max(32, labelRect.height);
    const card = elements().card;
    const cardRect = card && !card.classList.contains("rml-setup-card-hidden-during-scene")
      ? card.getBoundingClientRect()
      : null;
    const candidates = [
      { left: point.x + 30, top: point.y - height - 16 },
      { left: point.x + 30, top: point.y + 20 },
      { left: point.x - width - 30, top: point.y - height - 16 },
      { left: point.x - width - 30, top: point.y + 20 },
      { left: viewport.left + 10, top: viewport.top + 10 },
      { left: viewport.right - width - 10, top: viewport.top + 10 },
      { left: viewport.left + 10, top: viewport.bottom - height - 10 },
      { left: viewport.right - width - 10, top: viewport.bottom - height - 10 }
    ].map(candidate => ({
      left: Math.max(
        viewport.left + 10,
        Math.min(viewport.right - width - 10, candidate.left)
      ),
      top: Math.max(
        viewport.top + 10,
        Math.min(viewport.bottom - height - 10, candidate.top)
      )
    }));

    const overlapArea = (candidate, rect) => {
      if (!rect) return 0;
      const right = Math.min(candidate.left + width, rect.right);
      const left = Math.max(candidate.left, rect.left);
      const bottom = Math.min(candidate.top + height, rect.bottom);
      const top = Math.max(candidate.top, rect.top);
      return Math.max(0, right - left) * Math.max(0, bottom - top);
    };

    const sceneRect = activeSemanticScene?.locked
      ? activeSemanticScene.rect
      : null;
    const avoidRect = avoidTarget instanceof Element
      ? avoidTarget.getBoundingClientRect()
      : tourRect(avoidTarget);
    candidates.sort((a, b) => {
      const score = candidate =>
        overlapArea(candidate, sceneRect) * 1000 +
        overlapArea(candidate, avoidRect) * 4000 +
        overlapArea(candidate, cardRect);
      return score(a) - score(b);
    });
    const best = candidates[0];
    demoLabel.style.left = best.left + "px";
    demoLabel.style.top = best.top + "px";
  }

  function showKeys(keys, point = null) {
    const { keys: holder } = elements();
    if (!holder) return;

    holder.replaceChildren();

    for (const key of keys) {
      const keycap =
        document.createElement("kbd");
      keycap.textContent = key;
      holder.appendChild(keycap);
    }

    const viewport = tourEffectViewport();
    const fallback = {
      x: viewport.left + viewport.width * .5,
      y: viewport.top + viewport.height * .72
    };

    const location =
      point || fallback;

    holder.style.left =
      `${Math.min(
        viewport.right - 120,
        Math.max(viewport.left + 12, location.x + 34)
      )}px`;

    holder.style.top =
      `${Math.min(
        viewport.bottom - 60,
        Math.max(viewport.top + 12, location.y + 24)
      )}px`;

    holder.hidden = false;
    holder.classList.add("active");

    requestAnimationFrame(() => {
      holder
        .querySelectorAll("kbd")
        .forEach((keycap, index) => {
          keycap.style.setProperty(
            "--key-index",
            String(index)
          );
        });
    });
  }

  function hideKeys() {
    const { keys: holder } = elements();
    if (!holder) return;
    holder.hidden = true;
    holder.classList.remove("active");
    holder.replaceChildren();
  }

  async function runPointDemo(target, runId) {
    if (!target || runId !== demoRunId) return;
    hideMouse();
    pulseAt(target);
    await wait(650);
  }

  async function runTopBarWorkflowDemo(runId) {
    const topbar = document.querySelector(".topbar");
    if (!topbar || runId !== demoRunId) return;

    const menuToggle = document.querySelector("#top-menu-toggle");
    const compactState = responsiveTopActionsState();
    if (compactState.responsive) {
      const verified = tourDebugAssert(
        "mobile-topbar-actions-prepared-before-action-only-demo",
        compactState.open === true &&
          mobileTopbarPreparedForNarration === true,
        {
          preparedBeforeNarration: mobileTopbarPreparedForNarration,
          ariaExpanded: menuToggle?.getAttribute("aria-expanded") || "false",
          actionsOpen: compactState.open
        }
      );
      if (!verified) {
        throw new Error(
          "[RML Tour · Step 1] Compact actions were not prepared, explained and highlighted before the action-only demonstration began."
        );
      }
      transitionSemanticScene(
        [topbar, document.querySelector("#top-actions")],
        "Top Bar actions"
      );
    }

    tourDebugAssert(
      "topbar-redundant-button-sweep-removed",
      true,
      {
        redundantPointOnlyControls: 0,
        actionControlsActivated: [
          "Help",
          "Preview",
          "Project",
          "Export"
        ],
        reason:
          "There is no second point-only sweep. Tour is fully explained during narration and is deliberately not clicked; only the remaining controls with a useful Step 1 action are visited."
      }
    );

    if (runId !== demoRunId) return;
    await runHelpWorkflowDemo(runId, { fromTopbar: true });
    if (runId !== demoRunId) return;
    await runPreviewWorkflowDemo(runId, { fromTopbar: true });
    if (runId !== demoRunId) return;
    await runProjectWorkflowDemo(runId, { fromTopbar: true });
    if (runId !== demoRunId) return;
    await runExportWorkflowDemo(runId, { fromTopbar: true });
    if (runId !== demoRunId) return;

    const finalMenuState = responsiveTopActionsState();
    if (
      finalMenuState.responsive &&
      finalMenuState.open &&
      runId === demoRunId
    ) {
      await teacherClickElement(
        menuToggle,
        "Close the responsive top-bar menu again",
        runId,
        { focus: topbar, keepFocusVisible: true }
      );
      transitionSemanticScene(topbar, "Top Bar");
    }
    mobileTopbarPreparedForNarration = false;
    hideMouse();
  }

  function setTourInputValue(input, value) {
    const descriptor = Object.getOwnPropertyDescriptor(
      input instanceof HTMLTextAreaElement
        ? HTMLTextAreaElement.prototype
        : HTMLInputElement.prototype,
      "value"
    );
    descriptor?.set?.call(input, value);
    input.dispatchEvent(new InputEvent("input", {
      bubbles: true,
      cancelable: false,
      inputType: "insertText",
      data: value
    }));
  }

  async function teacherTypeInput(
    input,
    value,
    label,
    runId,
    options = {}
  ) {
    if (
      !(
        input instanceof HTMLInputElement ||
        input instanceof HTMLTextAreaElement
      ) ||
      runId !== demoRunId
    ) return;
    if (options.skipInitialScroll !== true) {
      await nativeTourScrollTargetIntoView(input, runId);
      if (runId !== demoRunId) return;
    }
    const inputLabel = input.closest("label") || input;
    focusDemonstration(inputLabel, 14);
    positionCard(inputLabel);
    await teacherClickElement(input, label, runId, {
      focus: inputLabel,
      avoidLiveControls: [inputLabel, input]
    });
    if (runId !== demoRunId) return;
    setTourInputValue(input, "");
    const visibleInputSteps = Math.min(5, Math.max(1, value.length));
    for (
      let step = 1;
      step <= visibleInputSteps && runId === demoRunId;
      step += 1
    ) {
      const length = Math.ceil(value.length * step / visibleInputSteps);
      setTourInputValue(input, value.slice(0, length));
      await wait(64);
    }
    input.dispatchEvent(new Event("change", { bubbles: true }));
    await wait(220);
  }

  async function runIdentityFieldsDemo(runId) {
    const examples = [
      ["#mod-name", "Runtime Graph Demo", "Enter the visible mod name"],
      ["#author", "DemoAuthor", "Enter the author"],
      ["#version", "1.0.0", "Enter the generated version"],
      ["#namespace-name", "RuntimeGraphDemo", "Enter the generated C# namespace"],
      ["#class-name", "RuntimeGraphDemoMod", "Enter the generated C# class name"],
      ["#mod-description", "Interactive Runtime Graph example", "Describe what the generated mod demonstrates"]
    ];
    for (const [selector, value, label] of examples) {
      const input = document.querySelector(selector);
      if (!input || runId !== demoRunId) return;
      await teacherTypeInput(input, value, label, runId);
    }
    hideMouse();
  }

  async function runTopBarIdentityWorkflowDemo(runId) {
    await runTopBarWorkflowDemo(runId);
    if (runId !== demoRunId) return;
    await runIdentityFieldsDemo(runId);
  }

  async function runOutlinePropertiesDemo(runId) {
    const outlineHost = window.RMLDynamicOutlineHost;
    const selectedBefore = outlineHost?.getSelectedNode?.() || null;
    const buttonNode = (outlineHost?.getFlatNodes?.() || []).find(node =>
      node?.kind === "setting" &&
      node?.valueType === "button" &&
      String(node.id || "") !== String(selectedBefore?.id || "")
    ) || null;
    let card = buttonNode?.id
      ? document.querySelector(
          `.node-card[data-node-id="${CSS.escape(buttonNode.id)}"]`
        )
      : null;
    if (!card || runId !== demoRunId) {
      throw new Error(
        "[RML Tour · Properties] A different real Button setting was not available for the Description lesson."
      );
    }
    await nativeTourScrollTargetIntoView(card, runId);
    await nextTwoFrames();
    card = document.querySelector(
      `.node-card[data-node-id="${CSS.escape(buttonNode.id)}"]`
    );
    if (!tourElementActuallyVisible(card) || runId !== demoRunId) {
      throw new Error(
        "[RML Tour · Properties] The different Button setting could not be made visible before selection."
      );
    }
    await teacherClickElement(
      card,
      "Select a different real Button setting so Properties follows it",
      runId
    );
    if (runId !== demoRunId) return;
    const selectedAfter = outlineHost?.getSelectedNode?.() || null;
    const selectedDifferentButton = tourDebugAssert(
      "outline-properties-description-selects-different-button",
      selectedAfter?.kind === "setting" &&
        selectedAfter?.valueType === "button" &&
        String(selectedAfter.id || "") === String(buttonNode.id || "") &&
        String(selectedAfter.id || "") !== String(selectedBefore?.id || ""),
      {
        selectedBeforeId: selectedBefore?.id || "",
        selectedBeforeType:
          selectedBefore?.valueType || selectedBefore?.kind || "",
        selectedAfterId: selectedAfter?.id || "",
        selectedAfterType:
          selectedAfter?.valueType || selectedAfter?.kind || "",
        expectedButtonId: buttonNode.id || ""
      }
    );
    if (!selectedDifferentButton) {
      throw new Error(
        "[RML Tour · Properties] Description did not select the required different Button setting."
      );
    }
    const inspector = document.querySelector(".inspector");
    const field = inspector?.querySelector('[data-field="description"]');
    if (field) {
      const descriptionValue = "Changed live through Button Properties";
      await teacherTypeInput(
        field,
        descriptionValue,
        "Edit the real Description property and watch generated output update",
        runId
      );
      const editedButton = outlineHost?.getSelectedNode?.() || null;
      const descriptionEdited = tourDebugAssert(
        "outline-properties-description-edited-on-different-button",
        editedButton?.valueType === "button" &&
          String(editedButton.id || "") === String(buttonNode.id || "") &&
          editedButton.description === descriptionValue,
        {
          selectedButtonId: editedButton?.id || "",
          selectedButtonType: editedButton?.valueType || "",
          description: editedButton?.description || "",
          expectedDescription: descriptionValue
        }
      );
      if (!descriptionEdited) {
        throw new Error(
          "[RML Tour · Properties] The real Button Description did not retain the demonstrated value."
        );
      }
    } else {
      throw new Error(
        "[RML Tour · Properties] The selected Button did not expose its real Description field."
      );
    }
    hideMouse();
  }

  function graphInspectorEditNodeVisibilityProof(node, inset = 16) {
    const viewport = document.querySelector(".rml-graph-viewport");
    const visible = visibleGraphClientRect(inset);
    const rect = node?.getBoundingClientRect?.() || null;
    const intersection = rect && visible
      ? {
          left: Math.max(rect.left, visible.left),
          right: Math.min(rect.right, visible.right),
          top: Math.max(rect.top, visible.top),
          bottom: Math.min(rect.bottom, visible.bottom)
        }
      : null;
    const intersectionArea = intersection
      ? Math.max(0, intersection.right - intersection.left) *
        Math.max(0, intersection.bottom - intersection.top)
      : 0;
    const nodeArea = rect
      ? Math.max(0, rect.width) * Math.max(0, rect.height)
      : 0;
    const visibleRatio = nodeArea > 0
      ? intersectionArea / nodeArea
      : 0;
    const completeFootprintInside = graphNodeRectInsideVisibleGraph(
      node,
      inset
    );
    const visiblyRendered = graphDemoVisible(node);

    return {
      ok: Boolean(
        viewport instanceof HTMLElement &&
        visiblyRendered &&
        completeFootprintInside &&
        visibleRatio >= .999
      ),
      inset,
      visiblyRendered,
      completeFootprintInside,
      visibleRatio,
      nodeRect: tourDebugRect(node),
      visibleGraphRect: visible,
      viewportRect: tourDebugRect(viewport)
    };
  }

  async function ensureGraphInspectorEditNodeFullyVisible(
    nodeId,
    runId,
    phase
  ) {
    const resolveNode = () => document.querySelector(
      `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
    );
    const attempts = [];
    let repaired = false;
    let viewportUsable = await ensureGraphViewportWindow(runId);
    if (runId !== demoRunId) {
      return {
        ok: false,
        reason: "demonstration-cancelled",
        phase,
        node: resolveNode(),
        repaired,
        attempts,
        viewportUsable
      };
    }
    await nextTwoFrames();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (runId !== demoRunId) break;
      const node = resolveNode();
      const proof = graphInspectorEditNodeVisibilityProof(node, 16);
      const entry = {
        attempt,
        phase,
        viewportUsable,
        proof
      };
      attempts.push(entry);
      if (proof.ok) {
        return {
          ok: true,
          phase,
          node,
          nodeId,
          repaired,
          attempts,
          viewportUsable,
          finalProof: proof
        };
      }

      if (attempt > 0) {
        viewportUsable = await ensureGraphViewportWindow(runId);
        if (runId !== demoRunId) break;
      }
      const visible = visibleGraphClientRect(16);
      if (!node || !visible || visible.width <= 0 || visible.height <= 0) {
        entry.action = "graph-window-unavailable";
        await nextTwoFrames();
        continue;
      }

      const currentScale = Number(
        window.RMLDynamicGraphHost?.getState?.()?.viewport?.scale
      ) || 1;
      const panOnly = panGraphNodesIntoVisibleFrame(
        [nodeId],
        {
          inset: 16,
          padding: 28 + attempt * 8
        }
      );
      let fitted = null;
      if (
        panOnly.ok !== true &&
        panOnly.reason === "current-scale-too-large"
      ) {
        fitted = window.RMLDynamicGraphHost?.fitNodesToClientRect?.(
          [nodeId],
          visible,
          {
            padding: 28 + attempt * 8,
            maxScale: currentScale
          }
        ) || null;
      }
      entry.action = fitted?.ok === true
        ? "final-zoom-fallback-for-complete-node-footprint"
        : "pan-node-camera-at-current-scale";
      entry.panOnly = panOnly;
      entry.result = fitted;
      repaired ||= panOnly.ok === true || fitted?.ok === true;
      await nextTwoFrames();
    }

    const node = resolveNode();
    const finalProof = graphInspectorEditNodeVisibilityProof(node, 16);
    return {
      ok: finalProof.ok,
      reason: "edit-node-complete-footprint-remained-clipped",
      phase,
      node,
      nodeId,
      repaired,
      attempts,
      viewportUsable,
      finalProof
    };
  }

  function graphInspectorInputScrollableAncestors(input) {
    const ancestors = [];
    let current = input?.parentElement || null;
    while (
      current instanceof HTMLElement &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      const style = getComputedStyle(current);
      const canScrollY =
        current.scrollHeight > current.clientHeight + 2 &&
        /(?:auto|scroll|overlay)/.test(style.overflowY || "");
      const canScrollX =
        current.scrollWidth > current.clientWidth + 2 &&
        /(?:auto|scroll|overlay)/.test(style.overflowX || "");
      if (canScrollY || canScrollX) ancestors.push(current);
      current = current.parentElement;
    }
    return ancestors.reverse();
  }

  function graphInspectorInputVisibilityProof(input, margin = 5) {
    if (
      !(input instanceof HTMLInputElement) ||
      !input.isConnected ||
      !tourElementActuallyVisible(input)
    ) {
      return {
        ok: false,
        reason: "input-not-rendered"
      };
    }

    const inputRect = input.getBoundingClientRect();
    const viewport = tourViewport();
    let visible = {
      left: viewport.left,
      top: Math.max(viewport.top, tourHeaderBottom()),
      right: viewport.right,
      bottom: viewport.bottom
    };
    const clippingAncestors = [];
    let current = input.parentElement;
    while (
      current instanceof HTMLElement &&
      current !== document.body &&
      current !== document.documentElement
    ) {
      const style = getComputedStyle(current);
      const clipsX = /(?:auto|scroll|overlay|hidden|clip)/.test(
        style.overflowX || ""
      );
      const clipsY = /(?:auto|scroll|overlay|hidden|clip)/.test(
        style.overflowY || ""
      );
      if (clipsX || clipsY) {
        const rect = current.getBoundingClientRect();
        visible = {
          left: clipsX ? Math.max(visible.left, rect.left) : visible.left,
          top: clipsY ? Math.max(visible.top, rect.top) : visible.top,
          right: clipsX ? Math.min(visible.right, rect.right) : visible.right,
          bottom: clipsY ? Math.min(visible.bottom, rect.bottom) : visible.bottom
        };
        clippingAncestors.push({
          element: tourPerceptionElementLabel(current),
          rect: tourDebugRect(current),
          overflowX: style.overflowX,
          overflowY: style.overflowY
        });
      }
      current = current.parentElement;
    }

    const liveControls = elements().liveControls;
    const liveControlsRect =
      liveControls instanceof HTMLElement &&
      !liveControls.hidden &&
      tourElementActuallyVisible(liveControls)
        ? liveControls.getBoundingClientRect()
        : null;
    const liveControlsOverlap = Boolean(
      liveControlsRect && !(
        liveControlsRect.right < inputRect.left ||
        liveControlsRect.left > inputRect.right ||
        liveControlsRect.bottom < inputRect.top ||
        liveControlsRect.top > inputRect.bottom
      )
    );
    const ok = Boolean(
      visible.right - visible.left > margin * 2 &&
      visible.bottom - visible.top > margin * 2 &&
      inputRect.left >= visible.left + margin &&
      inputRect.right <= visible.right - margin &&
      inputRect.top >= visible.top + margin &&
      inputRect.bottom <= visible.bottom - margin &&
      !liveControlsOverlap
    );
    return {
      ok,
      reason: ok ? "complete-input-visible" : "input-clipped",
      inputRect: tourDebugRect(input),
      visibleRect: visible,
      liveControlsRect: tourDebugRect(liveControls),
      liveControlsOverlap,
      clippingAncestors
    };
  }

  async function ensureGraphInspectorInputVisible(input, runId) {
    if (!(input instanceof HTMLInputElement) || runId !== demoRunId) {
      return {
        ok: false,
        reason: "input-unavailable"
      };
    }

    const html = document.documentElement;
    const alreadyAllowedPageScroll = html.classList.contains(
      "rml-setup-preparation-scroll"
    );
    if (!alreadyAllowedPageScroll) {
      html.classList.add("rml-setup-preparation-scroll");
    }

    const attempts = [];
    try {
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (runId !== demoRunId) break;

        await nativeTourScrollTargetIntoView(input, runId);
        if (runId !== demoRunId) break;

        const scrollableAncestors =
          graphInspectorInputScrollableAncestors(input);
        for (const scroller of scrollableAncestors) {
          await teacherRevealInScroller(input, scroller, runId);
          if (runId !== demoRunId) break;
        }
        if (runId !== demoRunId) break;

        await nativeTourScrollTargetIntoView(input, runId);
        if (runId !== demoRunId) break;
        await nextTwoFrames();

        const inputLabel = input.closest("label") || input;
        const currentPoint =
          teacherMouseVisualCoordinates() || teacherMouseCoordinates();
        setLiveControlsActiveObstacles(
          [inputLabel, input],
          "graph-inspector-input-reservation"
        );
        positionLiveControlsAwayFromMouseRoute(
          [currentPoint, centerOf(input)],
          "graph-inspector-input-route-confirmation"
        );
        await nextTwoFrames();

        const proof = graphInspectorInputVisibilityProof(input, 5);
        attempts.push({
          attempt,
          proof,
          pageScrollTop:
            tourPageRootScrollState().scroller?.scrollTop || 0,
          scrollableAncestors: scrollableAncestors.map(scroller => ({
            element: tourPerceptionElementLabel(scroller),
            scrollTop: scroller.scrollTop,
            scrollHeight: scroller.scrollHeight,
            clientHeight: scroller.clientHeight
          }))
        });
        if (proof.ok) {
          return {
            ok: true,
            reason: "inspector-input-framed",
            attempts,
            finalProof: proof
          };
        }
      }
    } finally {
      if (!alreadyAllowedPageScroll) {
        html.classList.remove("rml-setup-preparation-scroll");
      }
    }

    return {
      ok: false,
      reason: "inspector-input-remained-clipped",
      attempts,
      finalProof: graphInspectorInputVisibilityProof(input, 5)
    };
  }

  async function runGraphInspectorDemo(runId) {
    await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;
    let node = graphDemoFindNode(/(?:^|\s)NOT(?:\s|$)/i) ||
      document.querySelector(".rml-graph-node");
    if (!(node instanceof HTMLElement)) {
      graphDemoError(
        "Step 12 could not find the real graph node that must be edited."
      );
    }
    const graphHost = window.RMLDynamicGraphHost;
    const nodeId = String(node.dataset.graphNodeId || "");
    if (!nodeId) {
      graphDemoError(
        "Step 12 found a rendered node without a graph-node identity."
      );
    }
    const beforeSelectionVisibility =
      await ensureGraphInspectorEditNodeFullyVisible(
        nodeId,
        runId,
        "before-selection"
      );
    if (runId !== demoRunId) return;
    node = beforeSelectionVisibility.node || node;
    const completeBeforeSelection = tourDebugAssert(
      "graph-inspector-edit-node-complete-footprint-visible-before-selection",
      beforeSelectionVisibility.ok === true,
      {
        nodeId,
        repaired: beforeSelectionVisibility.repaired,
        viewportUsable: beforeSelectionVisibility.viewportUsable,
        finalProof: beforeSelectionVisibility.finalProof,
        attempts: beforeSelectionVisibility.attempts
      }
    );
    if (!completeBeforeSelection) {
      graphDemoError(
        "Step 12 could not place the complete node that must be edited inside the visible graph before selection.",
        {
          nodeId,
          visibility: beforeSelectionVisibility
        }
      );
    }
    const selected = await teacherClickElement(
      node,
      "Select the real runtime node",
      runId
    );
    if (runId !== demoRunId) return;
    const selectedNodeId = String(
      graphHost?.getState?.()?.selectedNodeId || ""
    );
    const selectionCommitted = tourDebugAssert(
      "graph-inspector-real-node-selection-committed",
      selected === true && selectedNodeId === nodeId,
      {
        requestedNodeId: nodeId,
        selectedNodeId,
        clickCompleted: selected === true
      }
    );
    if (!selectionCommitted) {
      graphDemoError(
        "Step 12 did not commit the selected node to the real graph model.",
        { requestedNodeId: nodeId, selectedNodeId }
      );
    }
    await nextTwoFrames();
    const afterSelectionVisibility =
      await ensureGraphInspectorEditNodeFullyVisible(
        nodeId,
        runId,
        "after-selection"
      );
    if (runId !== demoRunId) return;
    node = afterSelectionVisibility.node || node;
    const completeAfterSelection = tourDebugAssert(
      "graph-inspector-edit-node-complete-footprint-visible-after-selection",
      afterSelectionVisibility.ok === true,
      {
        nodeId,
        repaired: afterSelectionVisibility.repaired,
        viewportUsable: afterSelectionVisibility.viewportUsable,
        finalProof: afterSelectionVisibility.finalProof,
        attempts: afterSelectionVisibility.attempts,
        selectedNodeId
      }
    );
    if (!completeAfterSelection) {
      graphDemoError(
        "Step 12 selected the node, but opening the real inspector clipped the node's complete graph footprint.",
        {
          nodeId,
          visibility: afterSelectionVisibility
        }
      );
    }
    const inspector = document.querySelector(".rml-graph-inspector");
    const labelInput = [...(
      inspector?.querySelectorAll(
        ".rml-graph-inspector-card label"
      ) || []
    )].find(label =>
      /custom\s+node\s+label/i.test(label.textContent || "") &&
      label.querySelector("input") instanceof HTMLInputElement
    )?.querySelector("input") || null;
    const inspectorInputFrame =
      await ensureGraphInspectorInputVisible(labelInput, runId);
    if (runId !== demoRunId) return;
    const labelInputReady = tourDebugAssert(
      "graph-inspector-custom-label-input-visible",
      Boolean(
        inspector instanceof HTMLElement &&
        labelInput instanceof HTMLInputElement &&
        inspectorInputFrame.ok === true
      ),
      {
        inspectorVisible: tourElementActuallyVisible(inspector),
        inputFound: labelInput instanceof HTMLInputElement,
        inputVisible: inspectorInputFrame.ok === true,
        inputFrame: inspectorInputFrame,
        selectedNodeId
      }
    );
    if (!labelInputReady) {
      graphDemoError(
        "Step 12 selected the node, but its real Custom node label field was not visibly available.",
        { selectedNodeId }
      );
    }
    const demonstrationLabel = "Demo NOT";
    await teacherTypeInput(
      labelInput,
      demonstrationLabel,
      "Change the existing NOT node label in the real Node inspector",
      runId,
      { skipInitialScroll: true }
    );
    if (runId !== demoRunId) return;
    await nextTwoFrames();
    const afterEditVisibility =
      await ensureGraphInspectorEditNodeFullyVisible(
        nodeId,
        runId,
        "after-edit"
      );
    if (runId !== demoRunId) return;
    const completeAfterEdit = tourDebugAssert(
      "graph-inspector-edit-node-complete-footprint-visible-after-edit",
      afterEditVisibility.ok === true,
      {
        nodeId,
        repaired: afterEditVisibility.repaired,
        viewportUsable: afterEditVisibility.viewportUsable,
        finalProof: afterEditVisibility.finalProof,
        attempts: afterEditVisibility.attempts
      }
    );
    if (!completeAfterEdit) {
      graphDemoError(
        "Step 12 committed the edit, but could not return the complete edited node to the visible graph.",
        {
          nodeId,
          visibility: afterEditVisibility
        }
      );
    }
    const graphState = graphHost?.getState?.() || null;
    const modelNode = Array.isArray(graphState?.nodes)
      ? graphState.nodes.find(item => String(item?.id || "") === nodeId)
      : null;
    const renderedNode = afterEditVisibility.node ||
      document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
      );
    const renderedTitle = renderedNode?.querySelector(
      ".rml-graph-node-title strong"
    );
    const labelCommitted = tourDebugAssert(
      "graph-inspector-label-edit-committed-to-model-and-node",
      Boolean(
        labelInput.value === demonstrationLabel &&
        modelNode?.label === demonstrationLabel &&
        renderedTitle?.textContent?.trim() === demonstrationLabel &&
        tourElementActuallyVisible(renderedTitle) &&
        afterEditVisibility.ok === true &&
        graphState?.selectedNodeId === nodeId &&
        !document.body.classList.contains("rml-graph-right-collapsed")
      ),
      {
        nodeId,
        inspectorValue: labelInput.value,
        modelLabel: modelNode?.label || "",
        renderedTitle: renderedTitle?.textContent?.trim() || "",
        renderedTitleVisible: tourElementActuallyVisible(renderedTitle),
        completeNodeVisible: afterEditVisibility.ok === true,
        completeNodeVisibilityProof: afterEditVisibility.finalProof,
        selectedNodeId: graphState?.selectedNodeId || "",
        rightInspectorOpen:
          !document.body.classList.contains("rml-graph-right-collapsed")
      }
    );
    if (!labelCommitted) {
      graphDemoError(
        "Step 12 typed the label, but the inspector, graph model and visible node did not agree on the committed result.",
        {
          nodeId,
          inspectorValue: labelInput.value,
          modelLabel: modelNode?.label || "",
          renderedTitle: renderedTitle?.textContent?.trim() || ""
        }
      );
    }
    const finalStateStarted = performance.now();
    const finalTarget = renderedTitle instanceof HTMLElement
      ? renderedTitle
      : renderedNode;
    const finalStateShown = await teacherPointElement(
      finalTarget,
      "The new label is committed in the inspector and visible on the graph node",
      runId,
      1050
    );
    if (runId !== demoRunId) return;
    const finalVisibilityProof =
      graphInspectorEditNodeVisibilityProof(renderedNode, 16);
    const finalStateHeld = tourDebugAssert(
      "graph-inspector-final-state-held-before-completion",
      Boolean(
        finalStateShown === true &&
        performance.now() - finalStateStarted >= 1000 &&
        modelNode?.label === demonstrationLabel &&
        renderedTitle?.textContent?.trim() === demonstrationLabel &&
        finalVisibilityProof.ok === true
      ),
      {
        nodeId,
        heldForMs: Math.round(performance.now() - finalStateStarted),
        modelLabel: modelNode?.label || "",
        renderedTitle: renderedTitle?.textContent?.trim() || "",
        completeNodeVisibilityProof: finalVisibilityProof
      }
    );
    if (!finalStateHeld) {
      graphDemoError(
        "Step 12 did not keep the completed edit visibly on screen before advancing."
      );
    }
    const mouseHidden = await hideTeacherMouseBeforeTransition(
      runId,
      "graph-inspector-complete"
    );
    const cleanHandoff = tourDebugAssert(
      "graph-inspector-mouse-hidden-before-completion-handoff",
      mouseHidden === true,
      {
        nodeId,
        policy:
          "the teacher mouse is fully invisible before Step 12 releases or reparents any teaching surface"
      }
    );
    if (!cleanHandoff) {
      graphDemoError(
        "Step 12 could not hide the teacher mouse before the completion handoff."
      );
    }
  }

  async function runModeSwitchGraphDemo(runId) {
    await teacherSwitchGraphMode(true, runId);
    hideMouse();
  }

  async function runModeSwitchOutlinePreviewDemo(runId) {
    await teacherSwitchGraphMode(false, runId);
    if (runId !== demoRunId) return;

    await runPreviewWorkflowDemo(runId);
  }

  async function runPreviewWorkflowDemo(runId, options = {}) {

    const preview =
      document.querySelector("#preview-open");
    if (!preview) return;

    const menu = await teacherEnsureResponsiveTopActionsOpen(
      preview,
      "Open the responsive Hamburger menu before choosing Preview",
      runId
    );
    if (menu.required && !menu.open) return;
    if (!tourElementActuallyVisible(preview)) return;

    transitionSemanticScene(
      [document.querySelector(".topbar"), document.querySelector("#top-actions")],
      "Top Bar Preview action"
    );

    await nativeTourScrollTargetIntoView(
      preview,
      runId
    );
    if (runId !== demoRunId) return;

    positionShades(preview);
    positionCard(preview);

    await teacherClickElement(
      preview,
      "Open Preview with the real Preview button",
      runId
    );
    const previewDialog = await waitForOpenDialog(
      "#settings-preview-dialog",
      runId
    );
    if (!previewDialog) {
      throw new Error(
        "[RML Tour · Step 1] Preview did not open its native dialog."
      );
    }
    mountTourSurfaceInModal(previewDialog);
    const previewSurface = previewDialog.querySelector(
      ".rml-preview-window, .rml-preview-content"
    ) || previewDialog;
    const previewPoint = centerOf(previewSurface, .5, .46);
    await moveMouse(previewPoint, 620, runId);
    const previewMouseVisible = tourDebugAssert(
      "teacher-mouse-visible-over-demo-view-overlay",
      teacherMouseVisibleAboveDialog(previewDialog, previewSurface),
      {
        dialogId: previewDialog.id || "",
        dialogRect: tourDebugRect(previewDialog),
        previewRect: tourDebugRect(previewSurface),
        mouseRect: tourDebugRect(elements().mouse),
        assistantMountedInsideDialog:
          previewDialog.contains(elements().root),
        liveSkipControlsInsideDialog:
          previewDialog.contains(elements().liveControls)
      }
    );
    if (!previewMouseVisible) {
      throw new Error(
        "[RML Tour · Step 1] The teacher mouse was not visible over the Preview/Demo View dialog."
      );
    }
    await wait(420);
    if (runId !== demoRunId) return;

    if (options.fromTopbar === true) {
      tourDebugAssert(
        "topbar-preview-opened-inline",
        Boolean(
          previewDialog &&
          (
            previewDialog.open === true ||
            previewDialog.hasAttribute("open")
          )
        ),
        {
          openedInStepOne: true,
          standalonePreviewLessonPresent: steps.some(
            step => step.demo === "mode-switch-outline-preview"
          )
        }
      );
    }

    try {
      const close =
        document.querySelector("#settings-preview-close");
      if (tourElementActuallyVisible(close)) {
        positionShades(close);
        positionCard(close);
        await teacherClickElement(
          close,
          "Close Preview with its real close button, then continue the tour",
          runId
        );
      }
    } finally {
      restoreTourSurfaceFromModal(false);
      if (previewDialog?.open && runId === demoRunId) {
        previewDialog.querySelector("#settings-preview-close")?.click();
      }
    }
    hideMouse();
  }

  async function runProjectWorkflowDemo(runId, options = {}) {
    const trigger = document.querySelector("#project-manager");
    const dialog = await teacherOpenModal(
      trigger,
      "#project-dialog",
      options.fromTopbar === true
        ? ""
        : "Open the real Project manager",
      runId
    );
    if (!dialog || runId !== demoRunId) return;
    if (options.fromTopbar === true) {
      tourDebugAssert(
        "topbar-project-opened-inline",
        dialog.open === true,
        { triggerVisible: tourElementActuallyVisible(trigger) }
      );
    }

    try {
      const save = dialog.querySelector("#project-save-json");
      const load = dialog.querySelector("#project-load-json");
      const example = dialog.querySelector("#load-example");
      const done = dialog.querySelector("#project-done");

      if (save) {
        let saveJsonClicks = 0;
        const countSaveJsonClick = () => {
          saveJsonClicks += 1;
        };
        save.addEventListener("click", countSaveJsonClick);
        try {
          await teacherPointElement(
            save,
            "Save JSON creates a portable backup; the tour deliberately explains it without starting a download",
            runId
          );
        } finally {
          save.removeEventListener("click", countSaveJsonClick);
        }
        if (runId !== demoRunId) return;
        const saveWasExplanationOnly = tourDebugAssert(
          "topbar-project-save-json-explained-without-click",
          saveJsonClicks === 0,
          {
            saveJsonClicks,
            interaction: "point-only",
            downloadStarted: false
          }
        );
        if (!saveWasExplanationOnly) {
          throw new Error(
            "[RML Tour · Step 1] Save JSON was activated although this control must only be explained."
          );
        }
      }

      if (load && options.fromTopbar !== true) {
        await teacherPointElement(
          load,
          "Load JSON… opens the system file picker; the tour explains it without taking over your device",
          runId
        );
        if (runId !== demoRunId) return;
      }

      if (example && options.fromTopbar !== true) {
        await teacherPointElement(
          example,
          "Load Complete Example is protected because it replaces the current project",
          runId
        );
        if (runId !== demoRunId) return;
      }

      if (done) {
        await teacherClickElement(
          done,
          "Done closes the real Project modal",
          runId
        );
      }
    } finally {
      restoreTourSurfaceFromModal(false);
      if (dialog.open && runId === demoRunId) {
        dialog.querySelector("#project-done")?.click();
      }
      hideMouse();
    }
  }

  async function runExportWorkflowDemo(runId, options = {}) {
    const trigger = document.querySelector("#download-code");
    const dialog = await teacherOpenModal(
      trigger,
      "#export-dialog",
      options.fromTopbar === true
        ? ""
        : "Open the real Export project modal",
      runId
    );
    if (!dialog || runId !== demoRunId) return;
    if (options.fromTopbar === true) {
      tourDebugAssert(
        "topbar-export-opened-inline",
        dialog.open === true,
        { triggerVisible: tourElementActuallyVisible(trigger) }
      );
    }

    try {
      const platform = dialog.querySelector("#export-platform");
      const includeSources = dialog.querySelector("#export-include-cs");
      const includeProject = dialog.querySelector("#export-include-csproj");
      const fileList = dialog.querySelector("#export-generated-files");
      const copy = dialog.querySelector("#export-copy-selected-file");
      const download = dialog.querySelector("#export-download-selected");
      const cancel = dialog.querySelector("#export-cancel");

      if (options.fromTopbar === true) {
        tourDebugAssert(
          "topbar-export-open-close-only-after-narration",
          Boolean(cancel),
          {
            internalControlSweep: false,
            reason:
              "The preparation narration already explained the Export action; the action phase only opens and closes its real dialog."
          }
        );
        if (cancel) {
          await teacherClickElement(
            cancel,
            "Cancel closes Export without downloading",
            runId
          );
        }
        return;
      }

      if (platform) {
        await teacherPointElement(
          platform,
          "Path preset selects Windows, Linux, Flatpak, macOS or a custom Resonite path",
          runId
        );
        if (runId !== demoRunId) return;
      }

      for (const [control, label] of [
        [includeSources, "Real checkbox → include the generated C# sources"],
        [includeProject, "Real checkbox → include projects, build scripts and support files"]
      ]) {
        if (!control) continue;
        if (control.checked) {
          await teacherPointElement(
            control,
            `${label} (already enabled, so no pointless toggle is performed)`,
            runId,
            480
          );
        } else {
          await teacherClickElement(control, label, runId);
        }
        if (runId !== demoRunId) return;
        await wait(260);
      }

      if (fileList) {
        await teacherRevealInScroller(fileList, dialog, runId);
        if (runId !== demoRunId) return;
        await teacherPointElement(
          fileList,
          "This live manifest shows the exact files that the current graph will export",
          runId
        );
        if (runId !== demoRunId) return;
      }

      if (copy) {
        await teacherRevealInScroller(copy, dialog, runId);
        if (runId !== demoRunId) return;
        await teacherPointElement(
          copy,
          "Copy selected file copies exactly the highlighted generated file",
          runId
        );
        if (runId !== demoRunId) return;
      }

      if (download) {
        await teacherRevealInScroller(download, dialog, runId);
        if (runId !== demoRunId) return;
        await teacherPointElement(
          download,
          "Download ZIP exports the selected live package; the tour does not create an unwanted archive",
          runId
        );
        if (runId !== demoRunId) return;
      }

      if (cancel) {
        await teacherClickElement(
          cancel,
          "Cancel closes Export without downloading",
          runId
        );
      }
    } finally {
      restoreTourSurfaceFromModal(false);
      if (dialog.open && runId === demoRunId) {
        dialog.querySelector("#export-cancel")?.click();
      }
      hideMouse();
    }
  }

  async function runHelpWorkflowDemo(runId, options = {}) {
    const trigger = document.querySelector("#information-open");
    const dialog = await teacherOpenModal(
      trigger,
      "#information-dialog",
      "Open Help with the real global Help button",
      runId
    );
    if (!dialog || runId !== demoRunId) return;

    if (options.fromTopbar === true) {
      tourDebugAssert(
        "topbar-help-opened-inline",
        dialog.open === true,
        {
          openedInStepOne: true,
          standaloneHelpLessonPresent: steps.some(
            step => step.demo === "help-workflow"
          )
        }
      );
    }

    try {
      const shortcuts = dialog.querySelector(
        '[data-information-page-target="shortcuts"]'
      );
      const nodes = dialog.querySelector(
        '[data-information-page-target="nodes"]'
      );
      const close = dialog.querySelector("#information-close");

      if (shortcuts) {
        await teacherRevealInScroller(shortcuts, dialog, runId);
        if (runId !== demoRunId) return;
        await teacherClickElement(
          shortcuts,
          "Shortcuts documents keyboard, mouse, Wheel and modifier gestures",
          runId
        );
        if (runId !== demoRunId) return;
        await wait(380);
      }

      if (nodes) {
        await teacherRevealInScroller(nodes, dialog, runId);
        if (runId !== demoRunId) return;
        await teacherClickElement(
          nodes,
          "Nodes opens both Configuration Outline and Runtime Graph references",
          runId
        );
        if (runId !== demoRunId) return;
        await wait(420);
      }

      if (close) {
        await teacherRevealInScroller(close, dialog, runId);
        if (runId !== demoRunId) return;
        await teacherClickElement(
          close,
          "Close Help with its real close button",
          runId
        );
      }
    } finally {
      restoreTourSurfaceFromModal(false);
      if (dialog.open && runId === demoRunId) {
        dialog.querySelector("#information-close")?.click();
      }
      hideMouse();
    }
  }

  function outlinePaletteProductHitPoint(palette) {
    if (!(palette instanceof HTMLElement) || !palette.isConnected) {
      return null;
    }
    const rect = palette.getBoundingClientRect();
    const viewport = tourEffectViewport();
    const left = Math.max(rect.left + 3, viewport.left + 2);
    const right = Math.min(rect.right - 3, viewport.right - 2);
    const top = Math.max(
      rect.top + 3,
      viewport.top + 2,
      tourHeaderBottom() + 2
    );
    const bottom = Math.min(rect.bottom - 3, viewport.bottom - 2);
    if (right <= left || bottom <= top) return null;

    for (const [xFactor, yFactor] of [
      [.5, .5], [.25, .5], [.75, .5],
      [.5, .25], [.5, .75]
    ]) {
      const point = {
        x: left + (right - left) * xFactor,
        y: top + (bottom - top) * yFactor
      };
      const productHit = document.elementsFromPoint(
        point.x,
        point.y
      ).find(element =>
        element === palette ||
        palette.contains(element)
      );
      if (productHit) {
        return {
          point,
          productHit: tourPerceptionElementLabel(productHit)
        };
      }
    }
    return null;
  }

  function outlinePaletteSourceVisibility(palette) {
    const viewport = tourEffectViewport();
    const rect = palette instanceof HTMLElement
      ? palette.getBoundingClientRect()
      : null;
    const visibleTop = Math.max(
      viewport.top,
      tourHeaderBottom()
    );
    const visibleWidth = rect
      ? Math.max(
          0,
          Math.min(rect.right, viewport.right) -
            Math.max(rect.left, viewport.left)
        )
      : 0;
    const visibleHeight = rect
      ? Math.max(
          0,
          Math.min(rect.bottom, viewport.bottom) -
            Math.max(rect.top, visibleTop)
        )
      : 0;
    const productHit =
      outlinePaletteProductHitPoint(palette);
    const passed = Boolean(
      rect &&
      tourElementActuallyVisible(palette) &&
      visibleWidth >= Math.min(80, rect.width * .55) &&
      visibleHeight >= Math.min(30, rect.height * .7) &&
      productHit
    );
    return {
      passed,
      rect,
      viewport,
      visibleWidth,
      visibleHeight,
      productHit
    };
  }

  function outlinePaletteCenteredPageScrollTop(palette) {
    const root =
      document.scrollingElement ||
      document.documentElement;
    if (!(palette instanceof HTMLElement) || !root) return null;
    const rect = palette.getBoundingClientRect();
    const viewport = tourEffectViewport();
    const safeTop = Math.max(
      viewport.top + 12,
      tourHeaderBottom() + 12
    );
    const safeBottom = viewport.bottom - 18;
    const targetClientCenter = safeTop +
      Math.max(1, safeBottom - safeTop) * .36;
    return Math.max(
      0,
      Math.min(
        Math.max(0, root.scrollHeight - root.clientHeight),
        root.scrollTop +
          rect.top + rect.height * .5 -
          targetClientCenter
      )
    );
  }

  async function ensureOutlinePaletteSourceForPointerDown(runId) {
    let palette =
      document.querySelector('[data-palette="bool"]');
    if (!palette && runId === demoRunId) {
      window.RMLBuilderBridge?.requestPaletteRender?.();
      await nextTwoFrames();
      palette = document.querySelector('[data-palette="bool"]');
    }
    const before = outlinePaletteSourceVisibility(palette);
    const attempts = [];
    let repaired = false;

    for (
      let attempt = 0;
      attempt < 4 && runId === demoRunId;
      attempt += 1
    ) {
      palette = document.querySelector('[data-palette="bool"]') || palette;
      const visibility = outlinePaletteSourceVisibility(palette);
      attempts.push({
        attempt,
        visibility: {
          passed: visibility.passed,
          rect: tourDebugRect(palette),
          visibleWidth: visibility.visibleWidth,
          visibleHeight: visibility.visibleHeight,
          productHit: visibility.productHit,
          pageTop:
            (document.scrollingElement || document.documentElement)
              ?.scrollTop || 0
        }
      });
      if (visibility.passed) {
        const passed = tourDebugAssert(
          "outline-palette-live-source-repaired-before-pointerdown",
          true,
          {
            repaired,
            before: {
              passed: before.passed,
              rect: before.rect,
              visibleWidth: before.visibleWidth,
              visibleHeight: before.visibleHeight,
              productHit: before.productHit
            },
            after: attempts.at(-1)?.visibility || null,
            attempts,
            policy:
              "after narration and responsive reflow the source is re-resolved, visibly revealed and product-hit-tested immediately before pointerdown"
          }
        );
        return {
          passed,
          palette,
          repaired,
          before,
          after: visibility,
          attempts
        };
      }

      if (attempt === 3) break;

      repaired = true;
      window.RMLTypedNodeGraphScrollLayers?.clear?.();
      window.RMLUniversalScrollLayers?.clear?.();
      if (attempt === 0) {
        await nativeTourScrollTargetIntoView(palette, runId);
      } else {
        const targetTop =
          outlinePaletteCenteredPageScrollTop(palette);
        if (Number.isFinite(targetTop)) {
          await animateTourPageScroll(
            targetTop,
            Math.min(
              720,
              TOUR_SCROLL_TIMING.pageScrollDuration
            ),
            runId
          );
        }
      }
      await nextTwoFrames();
    }

    const after = outlinePaletteSourceVisibility(palette);
    tourDebugAssert(
      "outline-palette-live-source-repaired-before-pointerdown",
      false,
      {
        repaired,
        before,
        after,
        attempts,
        policy:
          "the real palette source must be visible and product-hit-testable before the only pointer transaction starts"
      }
    );
    return {
      passed: false,
      palette,
      repaired,
      before,
      after,
      attempts
    };
  }

  function outlinePaletteVisibleDropPoint(canvas, preferredPoint = null) {
    if (!(canvas instanceof HTMLElement)) return null;
    const viewport = tourEffectViewport();
    const canvasRect = canvas.getBoundingClientRect();
    const usableTop = Math.max(
      viewport.top + 26,
      tourHeaderBottom() + 18
    );
    const usableBottom = viewport.bottom - 42;
    const visibleLeft = Math.max(canvasRect.left + 14, viewport.left + 18);
    const visibleRight = Math.min(canvasRect.right - 14, viewport.right - 18);
    if (
      usableBottom <= usableTop ||
      visibleRight - visibleLeft < 48 ||
      canvasRect.bottom < usableTop ||
      canvasRect.top > usableBottom
    ) {
      return null;
    }

    const desiredY = Number.isFinite(preferredPoint?.y)
      ? preferredPoint.y
      : usableTop + (usableBottom - usableTop) * .58;
    const candidates = verticalInsertionSlots(canvas)
      .map(slot => {
        const left = Math.max(slot.left + 12, visibleLeft);
        const right = Math.min(slot.left + slot.width - 12, visibleRight);
        if (
          right - left < 24 ||
          slot.top < usableTop ||
          slot.top > usableBottom
        ) {
          return null;
        }
        return {
          x: Math.max(left, Math.min(right, (left + right) * .5)),
          y: slot.top,
          slot
        };
      })
      .filter(Boolean)
      .sort((left, right) =>
        Math.abs(left.y - desiredY) - Math.abs(right.y - desiredY)
      );
    return candidates[0] || null;
  }

  function outlinePaletteEdgeHoldPoint(canvas, sourcePoint) {
    const viewport = tourEffectViewport();
    const canvasRect = canvas instanceof HTMLElement
      ? canvas.getBoundingClientRect()
      : viewport;
    const left = Math.max(viewport.left + 24, canvasRect.left + 24);
    const right = Math.min(viewport.right - 24, canvasRect.right - 24);
    return {
      x: right > left
        ? (left + right) * .5
        : Math.max(
            viewport.left + 30,
            Math.min(viewport.right - 30, sourcePoint?.x || viewport.left + viewport.width * .5)
          ),
      y: Math.max(
        tourHeaderBottom() + 90,
        viewport.bottom - 44
      )
    };
  }

  function outlinePaletteReleaseContract(canvas, point) {
    const viewport = tourEffectViewport();
    const canvasRect = canvas instanceof HTMLElement
      ? canvas.getBoundingClientRect()
      : null;
    const marker = document.querySelector(".drag-reorder-placeholder");
    const markerHost = marker?.parentElement || null;
    const markerRect = marker instanceof HTMLElement
      ? marker.getBoundingClientRect()
      : null;
    const markerStyle = marker instanceof HTMLElement
      ? getComputedStyle(marker)
      : null;
    const pointInViewport = Boolean(
      point &&
      point.x >= viewport.left + 1 &&
      point.x <= viewport.right - 1 &&
      point.y >= viewport.top + 1 &&
      point.y <= viewport.bottom - 1
    );
    const pointInCanvas = Boolean(
      point &&
      canvasRect &&
      point.x >= canvasRect.left &&
      point.x <= canvasRect.right &&
      point.y >= canvasRect.top &&
      point.y <= canvasRect.bottom
    );
    const markerVisible = Boolean(
      markerRect &&
      marker instanceof HTMLElement &&
      marker.hidden !== true &&
      markerStyle?.display !== "none" &&
      markerStyle?.visibility !== "hidden" &&
      markerRect.width >= 24 &&
      markerRect.height >= 2 &&
      markerRect.bottom > viewport.top &&
      markerRect.top < viewport.bottom
    );
    const markerBelongsToCanvas = Boolean(
      markerHost instanceof HTMLElement &&
      canvas instanceof HTMLElement &&
      markerHost === canvas
    );
    const markerNearPoint = Boolean(
      markerRect && point &&
      Math.abs(
        markerRect.top + markerRect.height * .5 - point.y
      ) <= 56
    );
    return {
      passed: Boolean(
        pointInViewport &&
        pointInCanvas &&
        markerVisible &&
        markerBelongsToCanvas &&
        markerNearPoint
      ),
      pointInViewport,
      pointInCanvas,
      markerVisible,
      markerBelongsToCanvas,
      markerNearPoint,
      point,
      viewport,
      canvasRect,
      markerRect,
      markerHostId: markerHost?.id || "",
      markerHostClasses: markerHost?.className || ""
    };
  }

  async function stabilizeOutlinePaletteReleasePoint(
    canvas,
    point,
    dispatchMove,
    runId
  ) {
    let liveCanvas = document.querySelector("#builder-canvas") || canvas;
    let candidate = {
      x: Number(point?.x),
      y: Number(point?.y)
    };
    const samples = [];
    let stableFrames = 0;
    for (let attempt = 0; attempt < 8 && runId === demoRunId; attempt += 1) {
      if (!Number.isFinite(candidate.x) || !Number.isFinite(candidate.y)) break;
      dispatchMove(candidate);
      await nextTwoFrames();
      liveCanvas = document.querySelector("#builder-canvas") || liveCanvas;
      const marker = liveCanvas?.querySelector?.(
        ":scope > .drag-reorder-placeholder"
      ) || document.querySelector(".drag-reorder-placeholder");
      const markerHost = marker?.parentElement || null;
      const markerRect = marker instanceof HTMLElement
        ? marker.getBoundingClientRect()
        : null;
      const canvasRect = liveCanvas?.getBoundingClientRect?.() || null;
      const viewport = tourEffectViewport();
      const contract = outlinePaletteReleaseContract(liveCanvas, candidate);
      const pageTop = (document.scrollingElement || document.documentElement)
        ?.scrollTop || 0;
      const previousSample = samples[samples.length - 1] || null;
      const layoutStable = Boolean(
        previousSample &&
        Math.abs(pageTop - previousSample.pageTop) <= .5 &&
        Math.abs(
          Number(canvasRect?.top || 0) -
          Number(previousSample.canvasRect?.top || 0)
        ) <= .5 &&
        Math.abs(
          Number(markerRect?.top || 0) -
          Number(previousSample.markerRect?.top || 0)
        ) <= .5
      );
      samples.push({
        attempt,
        candidate: { ...candidate },
        contract: {
          passed: contract.passed,
          pointInViewport: contract.pointInViewport,
          pointInCanvas: contract.pointInCanvas,
          markerVisible: contract.markerVisible,
          markerBelongsToCanvas: contract.markerBelongsToCanvas,
          markerNearPoint: contract.markerNearPoint
        },
        markerRect: tourDebugRect(marker),
        canvasRect: tourDebugRect(liveCanvas),
        pageTop,
        layoutStable
      });
      if (contract.passed && layoutStable) {
        stableFrames += 1;
        if (stableFrames >= 2) {
          return {
            passed: true,
            point: candidate,
            canvas: liveCanvas,
            contract,
            samples
          };
        }
      } else {
        stableFrames = 0;
      }

      let nextPoint = null;
      if (
        markerRect &&
        canvasRect &&
        markerHost === liveCanvas
      ) {
        nextPoint = {
          x: Math.max(
            Math.max(canvasRect.left + 4, viewport.left + 4),
            Math.min(
              Math.min(canvasRect.right - 4, viewport.right - 4),
              markerRect.left + markerRect.width * .5
            )
          ),
          y: Math.max(
            Math.max(canvasRect.top + 4, viewport.top + 4),
            Math.min(
              Math.min(canvasRect.bottom - 4, viewport.bottom - 4),
              markerRect.top + markerRect.height * .5
            )
          )
        };
      }
      nextPoint ||= outlinePaletteVisibleDropPoint(
        liveCanvas,
        candidate
      );
      if (!nextPoint) break;
      candidate = {
        x: Number(nextPoint.x),
        y: Number(nextPoint.y)
      };
    }
    const contract = outlinePaletteReleaseContract(liveCanvas, candidate);
    return {
      passed: contract.passed,
      point: candidate,
      canvas: liveCanvas,
      contract,
      samples
    };
  }

  function outlinePaletteAuthoritativeControllerState(
    canvas,
    pointerId = 9201
  ) {
    const state =
      window.RMLPalettePointerDragBridge
        ?.getState?.() || null;
    const ready = Boolean(
      state?.active === true &&
      state.pointerId === pointerId &&
      state.payload?.kind === "palette" &&
      state.payload?.value === "bool" &&
      state.targetContainerId === "root" &&
      state.marker?.visible === true &&
      state.marker?.insideBuilderCanvas === true &&
      canvas instanceof HTMLElement &&
      document.querySelector(
        ".drag-reorder-placeholder"
      )?.parentElement === canvas
    );
    return {
      ready,
      state,
      sourceConnected:
        state?.sourceConnected === true
    };
  }

  async function waitForOutlinePaletteAuthoritativeDrop(
    afterSequence,
    runId,
    pointerId = 9201
  ) {
    for (
      let frame = 0;
      frame < 40 && runId === demoRunId;
      frame += 1
    ) {
      const result =
        window.RMLPalettePointerDragBridge
          ?.getState?.()
          ?.lastResult || null;
      if (
        Number(result?.sequence || 0) > afterSequence &&
        result.pointerId === pointerId
      ) {
        return result;
      }
      await tourNextVisualFrame();
    }
    return null;
  }

  async function prepareOutlinePaletteBeforeNarration(step, runId) {
    if (runId !== demoRunId || step?.demo !== "outline-palette") {
      return false;
    }
    let palette = document.querySelector('[data-palette="bool"]');
    if (!palette) {
      window.RMLBuilderBridge?.requestPaletteRender?.();
      await nextTwoFrames();
      palette = document.querySelector('[data-palette="bool"]');
    }
    if (!(palette instanceof HTMLElement)) {
      throw new Error(
        "[RML Tour · Preparation] Step 2 has no native Boolean palette source."
      );
    }
    await nativeTourScrollTargetIntoView(palette, runId);
    await nextTwoFrames();
    if (runId !== demoRunId) return false;
    const visibility = outlinePaletteSourceVisibility(palette);
    const passed = tourDebugAssert(
      "outline-palette-source-prepared-visible",
      visibility.passed,
      {
        rect: tourDebugRect(palette),
        visibleWidth: visibility.visibleWidth,
        visibleHeight: visibility.visibleHeight,
        pageTop: (document.scrollingElement || document.documentElement)?.scrollTop || 0
      }
    );
    if (!passed) {
      throw new Error(
        "[RML Tour · Preparation] Step 2 could not keep its real palette source inside the current viewport."
      );
    }
    return true;
  }

  async function runOutlinePaletteDemo(runId) {
    let palette = document.querySelector('[data-palette="bool"]');
    const canvas = document.querySelector("#builder-canvas");
    if (!palette && runId === demoRunId) {
      window.RMLBuilderBridge?.requestPaletteRender?.();
      await nextTwoFrames();
      palette = document.querySelector('[data-palette="bool"]');
    }
    const paletteReady = tourDebugAssert(
      "outline-palette-real-source-prepared",
      Boolean(palette && canvas),
      {
        paletteFound: Boolean(palette),
        canvasFound: Boolean(canvas),
        paletteGroup:
          palette?.closest("[data-palette-group]")
            ?.getAttribute("data-palette-group") || ""
      }
    );
    if (!paletteReady || !palette || !canvas) {
      throw new Error(
        "Step 2 cannot demonstrate the native Outline drag because its Boolean palette source or Configuration Outline canvas is missing."
      );
    }
    const sourcePreparation =
      await ensureOutlinePaletteSourceForPointerDown(runId);
    if (runId !== demoRunId) return false;
    palette = sourcePreparation.palette;
    const sourceVisibility = outlinePaletteSourceVisibility(palette);
    const sourceReadyAtPointerDown = tourDebugAssert(
      "outline-palette-source-visible-at-pointerdown",
      Boolean(
        sourcePreparation.passed &&
        sourceVisibility.passed &&
        sourceVisibility.productHit
      ),
      {
        repairedAfterNarration:
          sourcePreparation.repaired === true,
        repairAttempts: sourcePreparation.attempts,
        rect: tourDebugRect(palette),
        visibleWidth: sourceVisibility.visibleWidth,
        visibleHeight: sourceVisibility.visibleHeight,
        productHit: sourceVisibility.productHit,
        pageTop: (document.scrollingElement || document.documentElement)?.scrollTop || 0
      }
    );
    if (!sourceReadyAtPointerDown) {
      throw new Error(
        "Step 2 could not visibly reacquire and product-hit-test its real Boolean palette source immediately before pointerdown."
      );
    }
    const paletteControllerBefore =
      window.RMLPalettePointerDragBridge
        ?.getState?.() || null;
    const transactionSequenceBefore = Number(
      paletteControllerBefore?.lastResult?.sequence || 0
    );
    tourDebugRecord(
      "outline-palette-native-transaction-start",
      {
        pointerId: 9201,
        transactionSequenceBefore,
        repairedAfterNarration:
          sourcePreparation.repaired === true,
        source: tourPerceiveElement(palette),
        sourceProductHit: sourceVisibility.productHit,
        canvas: tourPerceiveElement(canvas)
      }
    );
    const nodeIdsBefore = new Set(
      [...canvas.querySelectorAll(".node-card[data-node-id]")]
        .map(card => card.dataset.nodeId)
        .filter(Boolean)
    );
    const from = centerOf(palette);
    const canvasRect = canvas.getBoundingClientRect();
    const requested = centerOf(canvas, .5, .28);
    const visibleDrop = outlinePaletteVisibleDropPoint(canvas, requested);
    const requiresResponsiveScroll = !visibleDrop;
    const edgeHoldPoint = outlinePaletteEdgeHoldPoint(canvas, from);
    const to = visibleDrop || edgeHoldPoint;
    const movingFromLeft = from.x < canvasRect.left;
    const movingFromAbove = from.y < canvasRect.top;
    const stageTarget = requiresResponsiveScroll
      ? tourPointRect(edgeHoldPoint, 64)
      : {
          left: canvasRect.left + 8,
          right: canvasRect.right - 8,
          top: Math.max(canvasRect.top + 8, to.y - 34),
          bottom: Math.min(canvasRect.bottom - 8, to.y + 34)
        };
    const pathPoints = requiresResponsiveScroll
      ? [
          {
            x: from.x,
            y: Math.min(edgeHoldPoint.y - 86, from.y + 88)
          },
          {
            x: edgeHoldPoint.x,
            y: Math.max(
              tourHeaderBottom() + 70,
              edgeHoldPoint.y - 34
            )
          }
        ]
      : movingFromLeft
      ? [
          {
            x: Math.min(canvasRect.left - 24, from.x + 92),
            y: from.y
          },
          {
            x: canvasRect.left + Math.min(72, canvasRect.width * .12),
            y: Math.max(canvasRect.top + 30, Math.min(canvasRect.bottom - 30, to.y))
          }
        ]
      : movingFromAbove
        ? [
            { x: from.x, y: Math.min(canvasRect.top - 24, from.y + 84) },
            {
              x: Math.max(canvasRect.left + 36, Math.min(canvasRect.right - 36, to.x)),
              y: canvasRect.top + 34
            }
          ]
        : [
            {
              x: Math.max(canvasRect.left + 36, Math.min(canvasRect.right - 36, from.x)),
              y: from.y
            }
          ];
    showDemoLabel(
      "Pick up Boolean — its real Outline drag ghost will follow the teacher mouse",
      from
    );
    const dragCompleted = await nativeUserPointerDrag(
      palette,
      to,
      1150,
      runId,
      9201,
      {
        pathPoints,
        stageFocusTarget: canvas,
        stageTarget,
        stageLabel: "CONFIGURATION OUTLINE · LIVE DROP AREA",
        edgeHoldMs: requiresResponsiveScroll ? 3600 : 0,
        edgeHoldMinMs: requiresResponsiveScroll ? 360 : 0,
        edgeHoldUntil: requiresResponsiveScroll
          ? () => Boolean(outlinePaletteVisibleDropPoint(canvas, requested))
          : null,
        afterEdgeHold: requiresResponsiveScroll
          ? async () => {
              const refreshed = outlinePaletteVisibleDropPoint(
                canvas,
                requested
              );
              return refreshed
                ? {
                    point: refreshed,
                    duration: 620,
                    stageTarget: canvas,
                    stageLabel: "CURRENT VISIBLE OUTLINE INSERTION GAP"
                  }
                : null;
            }
          : null,
        onBeforeRelease: async ({ point, dispatchMove }) => {
          const stabilized = await stabilizeOutlinePaletteReleasePoint(
            canvas,
            point,
            dispatchMove,
            runId
          );
          const stableRelease = tourDebugAssert(
            "outline-palette-release-point-stable-after-responsive-reflow",
            stabilized.passed === true,
            {
              pointBeforeStabilization: point,
              stablePoint: stabilized.point,
              contract: stabilized.contract,
              samples: stabilized.samples,
              policy:
                "the only pointerup uses two consecutive live frames from the current marker and current Outline canvas after every compact page-scroll reflow"
            }
          );
          if (!stableRelease) {
            throw new Error(
              "Step 2 could not stabilize its native insertion line inside the current Outline canvas before pointerup."
            );
          }
          return { startPoint: stabilized.point };
        },
        releaseReady: point => {
          const liveCanvas = document.querySelector("#builder-canvas") || canvas;
          const contract = outlinePaletteReleaseContract(liveCanvas, point);
          const controller =
            outlinePaletteAuthoritativeControllerState(
              liveCanvas,
              9201
            );
          const releaseReady = contract.passed === true;
          tourDebugAssert(
            "outline-palette-release-point-resolved-before-commit",
            releaseReady,
            {
              requiresResponsiveScroll,
              point,
              controller: controller.state,
              domContractPassed: contract.passed,
              policy:
                "the visible release point and native insertion marker must belong directly to the root Outline canvas; nested containers reserved by later lessons are never valid Step 2 targets"
            }
          );
          return tourDebugAssert(
            "outline-palette-current-visible-native-release",
            releaseReady,
            {
              requiresResponsiveScroll,
              authoritativeControllerReady: controller.ready,
              point: contract.point,
              pointInViewport: contract.pointInViewport,
              pointInCanvas: contract.pointInCanvas,
              markerVisible: contract.markerVisible,
              markerBelongsToCanvas: contract.markerBelongsToCanvas,
              markerNearPoint: contract.markerNearPoint,
              canvasRect: contract.canvasRect,
              markerRect: contract.markerRect,
              markerHostId: contract.markerHostId,
              markerHostClasses: contract.markerHostClasses,
              pageTop: (document.scrollingElement || document.documentElement)?.scrollTop || 0
            }
          );
        },
        afterPointerUp: ({ point, pointerId }) => {
          const settlement =
            window.RMLPalettePointerDragBridge
              ?.settleRelease?.(
                pointerId,
                point.x,
                point.y,
                transactionSequenceBefore,
                {
                  paletteType:
                    palette.dataset.palette || "bool"
                }
              ) || null;
          const result = settlement?.result || null;
          const settled = Boolean(
            settlement?.accepted === true &&
            Number(result?.sequence || 0) >
              transactionSequenceBefore &&
            result?.pointerId === pointerId &&
            result?.committed === true &&
            result?.inserted === true &&
            result?.payloadKind === "palette" &&
            result?.payloadValue === "bool" &&
            result?.containerId === "root" &&
            result?.createdNodeId
          );
          tourDebugAssert(
            "outline-palette-pointerup-transaction-settled",
            settled,
            {
              pointerId,
              point,
              transactionSequenceBefore,
              settlement,
              policy:
                "one pointerup must finish exactly one product-owned palette transaction; normal document delivery, active-controller settlement and direct product settlement are idempotent"
            }
          );
          return {
            accepted: settled
          };
        },
        commitHoldMs: 420
      }
    );
    await nextTwoFrames();
    if (runId !== demoRunId) return false;

    const authoritativeDrop =
      await waitForOutlinePaletteAuthoritativeDrop(
        transactionSequenceBefore,
        runId,
        9201
      );
    if (runId !== demoRunId) return false;
    const authoritativeCommitted = Boolean(
      authoritativeDrop?.committed === true &&
      authoritativeDrop?.inserted === true &&
      authoritativeDrop?.payloadKind === "palette" &&
      authoritativeDrop?.payloadValue === "bool" &&
      authoritativeDrop?.containerId === "root" &&
      authoritativeDrop?.createdNodeId
    );
    tourDebugRecord(
      "outline-palette-authoritative-drop-result",
      {
        pointerId: 9201,
        transactionSequenceBefore,
        result: authoritativeDrop,
        committed: authoritativeCommitted
      }
    );
    tourDebugAssert(
      "outline-palette-authoritative-drop-committed",
      authoritativeCommitted,
      {
        transactionSequenceBefore,
        result: authoritativeDrop,
        policy:
          "success comes from the real palette controller transaction, not from a timing-sensitive DOM guess"
      }
    );

    const liveCanvas =
      document.querySelector("#builder-canvas") ||
      canvas;
    const createdCard = authoritativeDrop?.createdNodeId
      ? liveCanvas.querySelector(
          `.node-card[data-node-id="${CSS.escape(authoritativeDrop.createdNodeId)}"]`
        )
      : [...liveCanvas.querySelectorAll(
          ".node-card[data-node-id]"
        )].find(card => !nodeIdsBefore.has(card.dataset.nodeId));
    const createdByNativeDrag = Boolean(
      dragCompleted &&
      authoritativeCommitted &&
      createdCard
    );
    tourDebugAssert(
      "outline-palette-native-node-created",
      createdByNativeDrag,
      {
        dragCompleted,
        beforeCount: nodeIdsBefore.size,
        afterCount: liveCanvas.querySelectorAll(
          ".node-card[data-node-id]"
        ).length,
        createdNodeId: createdCard?.dataset.nodeId || ""
      }
    );

    if (!createdByNativeDrag) {
      throw new Error(
        "Step 2 completed its pointer route, but the native palette engine did not render a new node in Configuration Outline."
      );
    }

    await nativeTourScrollTargetIntoView(
      createdCard,
      runId
    );
    await nextTwoFrames();
    if (runId !== demoRunId) return false;

    const createdRect = createdCard.getBoundingClientRect();
    const visibleViewport = tourEffectViewport();
    const visibleWidth = Math.max(
      0,
      Math.min(createdRect.right, visibleViewport.right) -
        Math.max(createdRect.left, visibleViewport.left)
    );
    const visibleHeight = Math.max(
      0,
      Math.min(createdRect.bottom, visibleViewport.bottom) -
        Math.max(createdRect.top, visibleViewport.top)
    );
    const createdNodeVisible = Boolean(
      tourElementActuallyVisible(createdCard) &&
      visibleWidth >= Math.min(80, createdRect.width * .45) &&
      visibleHeight >= Math.min(36, createdRect.height * .45)
    );
    tourDebugAssert(
      "outline-palette-created-node-visible",
      createdNodeVisible,
      {
        createdNodeId: createdCard.dataset.nodeId || "",
        selected: createdCard.classList.contains("selected"),
        rect: tourDebugRect(createdCard),
        visibleWidth,
        visibleHeight
      }
    );
    if (!createdNodeVisible) {
      throw new Error(
        "The native palette drag created a node, but Step 2 did not leave its new Outline card visibly on screen."
      );
    }

    focusDemonstration(createdCard, 14);
    pulseAt(createdCard, "rml-setup-demo-drop");
    showDemoLabel(
      "Boolean is now visibly selected in Configuration Outline",
      centerOf(createdCard)
    );
    await wait(1150);
    hideMouse();
    const transactionStarts =
      tourDebugState.events.filter(event =>
        event.type === "outline-palette-native-transaction-start" &&
        event.stepIndex === stepIndex
      );
    tourDebugAssert(
      "outline-palette-single-transaction-no-restart",
      transactionStarts.length === 1 &&
        authoritativeCommitted &&
        steps[stepIndex]?.demo === "outline-palette",
      {
        transactionStarts: transactionStarts.length,
        authoritativeDrop,
        currentStepIndex: stepIndex,
        policy:
          "Step 2 performs one live controller transaction and can never restart itself after mobile auto-scroll"
      }
    );
    return runId === demoRunId;
  }

  async function runOutlineRootDrag(runId) {
    const source =
      document.querySelector(".node-card[data-node-id]") ||
      document.querySelector('[data-palette="bool"]');
    const canvas = document.querySelector("#builder-canvas");
    if (!source || !canvas) return;

    const slots = verticalInsertionSlots(canvas);
    const slot = slots[Math.min(1, slots.length - 1)] || slots[0];
    const targetPoint = slot
      ? { x: slot.left + slot.width * .5, y: slot.top }
      : centerOf(canvas, .5, .25);

    showDemoLabel(
      "Move this real element to the exact root insertion gap",
      centerOf(source)
    );
    await nativeUserPointerDrag(
      source,
      targetPoint,
      1150,
      runId,
      9202
    );
    pulseAt(canvas, "rml-setup-demo-drop");
    hideMouse();
  }

  async function runOutlineScrollDemo(runId) {
    const html = document.documentElement;
    html.classList.add("rml-setup-drag-scroll-live");
    let chosenReleaseSlot = null;
    let chosenReleaseHost = null;
    let nativeReleaseVerified = false;
    let nativeReleaseMarker = null;
    let nativeReleaseDetails = null;
    let edgeHoldScrollDelta = 0;
    try {
    const scene = bestVerticalOutlineScene();
    const host = scene?.host || bestVerticalOutlineHost();
    const source = scene?.source ||
      host?.querySelector(":scope > .node-card[data-node-id]") ||
      null;
    if (!host || !source) {
      throw new Error(
        "[RML Tour · Step 3] No stable Outline reorder source with a sibling was available."
      );
    }
    const step4ReferenceProtected =
      outlineStep3ScenePreservesStep4Reference({ host, source });
    tourDebugAssert(
      "outline-reorder-preserves-step4-displaymode-reference",
      step4ReferenceProtected,
      {
        sourceName: source.querySelector(
          ":scope > .node-head .node-copy > strong"
        )?.textContent?.trim() || "",
        sourceRect: tourDebugRect(source),
        hostRect: tourDebugRect(host),
        referenceRect: tourDebugRect(
          outlineStep4ReferenceController()
        ),
        policy:
          "Step 3 may reorder only an independent native host; the complete DisplayMode reference subtree required by Step 4 is immutable during this lesson"
      }
    );
    if (!step4ReferenceProtected) {
      throw new Error(
        "[RML Tour · Step 3] The selected reorder scene overlaps the DisplayMode reference reserved for Step 4."
      );
    }
    if (!tourTargetComfortablyVisible(source)) {
      throw new Error(
        "[RML Tour · Step 3] The prepared compact reorder source was no longer inside the visible page window."
      );
    }

    const hostRect = host.getBoundingClientRect();
    const pageScroller = document.scrollingElement || document.documentElement;
    const beforeScrollTop = pageScroller.scrollTop;
    const maximumScrollTop = Math.max(
      0,
      pageScroller.scrollHeight - pageScroller.clientHeight
    );
    const remainingScrollDown = Math.max(
      0,
      maximumScrollTop - beforeScrollTop
    );
    const remainingScrollUp = Math.max(0, beforeScrollTop);
    const canScrollDown =
      remainingScrollDown >= 48 ||
      remainingScrollDown >= remainingScrollUp;
    const viewport = tourViewport();
    const workspace = document.querySelector(".workspace");
    const workspaceColumns = workspace instanceof HTMLElement
      ? getComputedStyle(workspace).gridTemplateColumns
          .trim()
          .split(/\s+/)
          .filter(Boolean).length
      : 0;
    const stackedWorkspace = Boolean(
      window.matchMedia("(max-width: 780px)").matches ||
      workspaceColumns === 1
    );
    const availableEdgeScroll = canScrollDown
      ? remainingScrollDown
      : remainingScrollUp;
    const edgePointerInset = stackedWorkspace ? 30 : 44;
    const preEdgePointerInset = stackedWorkspace ? 92 : 112;
    const targetPoint = {
      x: hostRect.right - Math.max(38, Math.min(86, hostRect.width * .08)),
      y: canScrollDown
        ? viewport.bottom - edgePointerInset
        : tourHeaderBottom() + edgePointerInset
    };
    const preEdgePoint = {
      x: Math.max(
        hostRect.left + 34,
        Math.min(hostRect.right - 34, targetPoint.x)
      ),
      y: canScrollDown
        ? viewport.bottom - preEdgePointerInset
        : tourHeaderBottom() + preEdgePointerInset
    };
    const preferredEdgeScrollLimit = stackedWorkspace
      ? Math.max(280, Math.min(400, viewport.height * .46))
      : Math.max(140, Math.min(220, viewport.height * .22));
    const edgeScrollLimit = Math.max(
      0,
      Math.min(availableEdgeScroll, preferredEdgeScrollLimit)
    );
    const preferredEdgeScrollTarget = stackedWorkspace
      ? Math.max(240, Math.min(340, viewport.height * .38))
      : Math.max(108, Math.min(160, viewport.height * .15));
    const initialReleaseSlots = verticalInsertionSlots(host);
    const releaseVisibilityCapacity = canScrollDown
      ? Math.max(
          0,
          Math.max(...initialReleaseSlots.map(slot => slot.top)) -
            (tourHeaderBottom() + 68)
        )
      : Math.max(
          0,
          (viewport.bottom - 80) -
            Math.min(...initialReleaseSlots.map(slot => slot.top))
        );
    const edgeScrollTarget = Math.max(
      0,
      Math.min(
        edgeScrollLimit,
        preferredEdgeScrollTarget,
        Number.isFinite(releaseVisibilityCapacity)
          ? releaseVisibilityCapacity
          : preferredEdgeScrollTarget
      )
    );
    const edgeScrollDirection = canScrollDown ? 1 : -1;
    const edgeScrollDestination = Math.max(
      0,
      Math.min(
        maximumScrollTop,
        beforeScrollTop + edgeScrollDirection * edgeScrollTarget
      )
    );
    const edgeScrollDuration = stackedWorkspace ? 760 : 620;
    tourDebugRecord("outline-reorder-viewport-scroll-plan", {
      stackedWorkspace,
      workspaceColumns,
      direction: canScrollDown ? "down" : "up",
      availableEdgeScroll: Math.round(availableEdgeScroll),
      edgeScrollTarget: Math.round(edgeScrollTarget),
      edgeScrollLimit: Math.round(edgeScrollLimit),
      releaseVisibilityCapacity: Math.round(
        releaseVisibilityCapacity
      ),
      edgeScrollDestination: Math.round(edgeScrollDestination),
      edgeScrollDuration
    });
    const clampEdgeScrollPosition = () => {
      const delta = pageScroller.scrollTop - beforeScrollTop;
      if (canScrollDown && delta > edgeScrollLimit) {
        pageScroller.scrollTop = Math.min(
          pageScroller.scrollHeight - pageScroller.clientHeight,
          beforeScrollTop + edgeScrollLimit
        );
      } else if (!canScrollDown && delta < -edgeScrollLimit) {
        pageScroller.scrollTop = Math.max(
          0,
          beforeScrollTop - edgeScrollLimit
        );
      }
    };
    const edgeStage = {
      left: hostRect.left + 10,
      right: hostRect.right - 10,
      top: canScrollDown
        ? targetPoint.y - 42
        : targetPoint.y - 10,
      bottom: canScrollDown
        ? targetPoint.y + 10
        : targetPoint.y + 42
    };
    const from = centerOf(source);
    const insideX = Math.max(
      hostRect.left + 34,
      Math.min(hostRect.right - 34, targetPoint.x)
    );
    const pathPoints = [
      {
        x: Math.max(hostRect.left + 34, Math.min(hostRect.right - 34, from.x + 64)),
        y: from.y
      },
      {
        x: insideX,
        y: from.y + (preEdgePoint.y - from.y) * .72
      },
      {
        x: preEdgePoint.x,
        y: preEdgePoint.y
      }
    ];

    elements().mouse?.classList.remove(
      "scrolling",
      "horizontal-wheel"
    );
    showDemoLabel(
      canScrollDown
        ? "Carry the real card through the Outline, then hold inside the glowing LOWER EDGE zone"
        : "Carry the real card through the Outline, then hold inside the glowing UPPER EDGE zone",
      targetPoint
    );
    const dragCompleted = await nativeUserPointerDrag(
      source,
      targetPoint,
      820,
      runId,
      9203,
      {
        pathPoints,
        stageFocusTarget: host,
        stageTarget: edgeStage,
        stageLabel: "HOLD AT EDGE · PAGE MOVES NEXT",
        edgeHoldMs: edgeScrollDuration + 220,
        edgeHoldMinMs: edgeScrollDuration,
        capturePointerMarker: false,
        onPointerFrame: ({ phase }) => {
          const mouse = elements().mouse;
          mouse?.classList.remove("scrolling", "horizontal-wheel");
          if (phase === "initial-route") {
            pageScroller.scrollTop = beforeScrollTop;
          }
        },
        onInitialRouteComplete: () => {
          pageScroller.scrollTop = beforeScrollTop;
          elements().mouse?.classList.remove(
            "scrolling",
            "horizontal-wheel"
          );
        },
        onEdgeHoldStart: () => {
          elements().mouse?.classList.remove(
            "scrolling",
            "horizontal-wheel"
          );
          showDemoLabel(
            canScrollDown
              ? "The held mouse has reached the LOWER EDGE — the page now moves beneath it"
              : "The held mouse has reached the UPPER EDGE — the page now moves beneath it",
            targetPoint
          );
        },
        onEdgeHoldEnd: () => {
          pageScroller.scrollTop = edgeScrollDestination;
          clampEdgeScrollPosition();
          edgeHoldScrollDelta = Math.abs(
            pageScroller.scrollTop - beforeScrollTop
          );
          elements().mouse?.classList.remove(
            "scrolling",
            "horizontal-wheel"
          );
        },
        onEdgeHoldFrame: ({ elapsed }) => {
          elements().mouse?.classList.remove(
            "scrolling",
            "horizontal-wheel"
          );
          const progress = Math.max(
            0,
            Math.min(1, elapsed / edgeScrollDuration)
          );
          const eased = 1 - Math.pow(1 - progress, 3);
          pageScroller.scrollTop =
            beforeScrollTop +
            (edgeScrollDestination - beforeScrollTop) * eased;
          clampEdgeScrollPosition();
        },
        edgeHoldUntil: () =>
          Math.abs(pageScroller.scrollTop - beforeScrollTop) >=
            Math.max(0, edgeScrollTarget - 1),
        afterEdgeHold: async (edgePoint, dragContext) => {
          const liveViewport = tourViewport();
          const corridor = outlineNestedVerticalCorridor();
          const preferredY = Math.max(
            corridor.safeTop + 6,
            Math.min(
              corridor.safeBottom - 6,
              liveViewport.top + liveViewport.height * .62
            )
          );
          const retreatPoint = {
            x: insideX,
            y: preferredY
          };
          dragContext?.dispatchMove?.(retreatPoint);
          await nextTwoFrames();

          const visibleSlots = verticalInsertionSlots(host)
            .filter(slot =>
              slot.top >= corridor.safeTop &&
              slot.top <= corridor.safeBottom &&
              slot.left + slot.width >=
                liveViewport.left + corridor.horizontalInset &&
              slot.left <=
                liveViewport.right - corridor.horizontalInset
            )
            .sort((left, right) =>
              Math.abs(left.top - preferredY) -
              Math.abs(right.top - preferredY)
            );
          const finalSlot = visibleSlots[0] || null;

          if (!finalSlot) {
            throw new Error(
              "[RML Tour · Step 3] No visible card-free Outline insertion gap remained after the bounded edge scroll."
            );
          }
          chosenReleaseHost = host;
          chosenReleaseSlot = {
            ...finalSlot,
            hostId: host.id || "",
            hostClasses: host.className || "",
            clearBeforeRelease: true
          };

          const point = {
            x: finalSlot.left + finalSlot.width * .5,
            y: finalSlot.top
          };
          const liveHostRect = host.getBoundingClientRect();
          const gutterPoint = {
            x: Math.max(
              liveHostRect.left + 34,
              Math.min(liveHostRect.right - 34, retreatPoint.x)
            ),
            y: point.y
          };
          return {
            startPoint: retreatPoint,
            point,
            pathPoints: [gutterPoint],
            duration: 640,
            stageTarget: {
              left: finalSlot.left,
              right: finalSlot.left + finalSlot.width,
              top: finalSlot.top - 13,
              bottom: finalSlot.top + 13
            },
            stageLabel: "EXACT INSERTION LINE · RELEASE HERE"
          };
        },
        onBeforeRelease: async ({ point, dispatchMove }) => {
          const stabilization =
            await stabilizeStep3NativeReleasePoint(
              chosenReleaseHost,
              point,
              dispatchMove,
              runId
            );
          const markerState = stabilization.contract;
          nativeReleaseVerified = stabilization.passed === true;
          nativeReleaseMarker = markerState?.markerRect || null;
          nativeReleaseDetails = {
            reason: markerState?.reason || "stabilization-cancelled",
            hostId: markerState?.hostId || "",
            hostClasses: markerState?.hostClasses || "",
            expectedHostId: markerState?.expectedHostId || "",
            expectedHostClasses:
              markerState?.expectedHostClasses || "",
            hostMatched: markerState?.hostMatched === true,
            markerVisible: markerState?.markerVisible === true,
            pointVisible: markerState?.pointVisible === true,
            pointInsideHost: markerState?.pointInsideHost === true,
            pointNearMarker: markerState?.pointNearMarker === true,
            clearOfControls: markerState?.clearOfControls === true,
            visibleWidth: markerState?.visibleWidth || 0,
            visibleHeight: markerState?.visibleHeight || 0,
            stableFrames: stabilization.stableFrames,
            attempts: stabilization.samples.length,
            samples: stabilization.samples
          };
          if (chosenReleaseSlot) {
            chosenReleaseSlot.nativeMarker =
              markerState?.markerRect || null;
          }
          tourDebugRecord("outline-reorder-native-release-stabilized", {
            passed: stabilization.passed === true,
            stableFrames: stabilization.stableFrames,
            attempts: stabilization.samples.length,
            point: stabilization.point,
            reason: markerState?.reason || "missing-marker-contract"
          });
          if (!stabilization.passed) {
            return { cancel: true };
          }
          return { startPoint: stabilization.point };
        },
        commitHoldMs: 260
      }
    );
    elements().mouse?.classList.remove("scrolling");
    const boundedEdgeScroll = tourDebugAssert(
      "outline-reorder-bounded-edge-scroll",
      (
        edgeScrollTarget < 2 ||
        edgeHoldScrollDelta >= Math.min(
          24,
          Math.max(1, edgeScrollTarget * .65)
        )
      ) &&
        edgeHoldScrollDelta <= edgeScrollLimit + 2,
      {
        delta: Math.round(edgeHoldScrollDelta),
        limit: Math.round(edgeScrollLimit),
        target: Math.round(edgeScrollTarget),
        stackedWorkspace,
        from: beforeScrollTop,
        current: pageScroller.scrollTop
      }
    );
    const releaseLineSafe = Boolean(
      dragCompleted === true &&
      chosenReleaseSlot &&
      chosenReleaseSlot.clearBeforeRelease === true &&
      nativeReleaseVerified === true
    );
    const releaseLineAccepted = tourDebugAssert(
      "outline-reorder-release-line-clear-of-controls",
      releaseLineSafe,
      {
        sampleCount: 1,
        unsafeSampleCount: releaseLineSafe ? 0 : 1,
        releaseSlot: chosenReleaseSlot,
        nativeMarkerRect: nativeReleaseMarker,
        nativeMarkerDetails: nativeReleaseDetails,
        hostRect: tourDebugRect(chosenReleaseHost || host)
      }
    );
    if (!boundedEdgeScroll) {
      throw new Error(
        "[RML Tour · Step 3] The held edge gesture did not produce a bounded page movement."
      );
    }
    if (!releaseLineAccepted) {
      const error = new Error(
        "[RML Tour · Step 3] The native insertion line was not visibly reachable at pointer release."
      );
      error.details = {
        dragCompleted,
        releaseSlot: chosenReleaseSlot,
        nativeMarkerRect: nativeReleaseMarker,
        nativeMarkerDetails: nativeReleaseDetails
      };
      throw error;
    }
    pulseAt(
      document.querySelector(".node-card.selected") || host,
      "rml-setup-demo-drop"
    );
    const scrollDelta = Math.round(pageScroller.scrollTop - beforeScrollTop);
    showDemoLabel(
      scrollDelta === 0
        ? "The item still returned from the edge zone to a concrete live insertion line"
        : `After the held mouse reached the edge, the page moved ${Math.abs(scrollDelta)} px; the teacher then returned to the visible insertion line and released immediately`,
      centerOf(document.querySelector(".node-card.selected") || host)
    );
    await wait(520);
    hideMouse();
    } finally {
      html.classList.remove("rml-setup-drag-scroll-live");
      elements().mouse?.classList.remove("scrolling", "horizontal-wheel");
    }
  }

  function outlineOptionLaneName(lane) {
    return lane?.querySelector(
      ":scope > .option-heading > span"
    )?.textContent?.trim() || "";
  }

  function outlineOptionDirectChildNames(lane) {
    if (!(lane instanceof HTMLElement)) return [];
    return [...lane.querySelectorAll(
      ":scope > .drop-zone > .node-card > .node-head .node-copy > strong"
    )].map(element => element.textContent.trim());
  }

  function outlineChildNamesMatch(actualNames, expectedNames) {
    if (!Array.isArray(actualNames) || !Array.isArray(expectedNames)) {
      return false;
    }
    return actualNames.length === expectedNames.length &&
      [...actualNames].sort().join("|") ===
        [...expectedNames].sort().join("|");
  }

  function nativeSectionDragVisualState(
    sourceLane,
    host,
    heldPoint
  ) {
    const ghost = document.querySelector(
      "body > .option-pointer-ghost"
    );
    const marker = host?.querySelector(
      ":scope > .option-reorder-placeholder"
    );
    const sourceStyle = sourceLane instanceof HTMLElement
      ? getComputedStyle(sourceLane)
      : null;
    const ghostStyle = ghost instanceof HTMLElement
      ? getComputedStyle(ghost)
      : null;
    const ghostDropZone = ghost?.querySelector(":scope > .drop-zone");
    const ghostActions = ghost?.querySelector(
      ":scope > .option-heading .option-order-actions"
    );
    const markerRect = marker?.getBoundingClientRect?.() || null;
    const ghostRect = ghost?.getBoundingClientRect?.() || null;
    const markerStyle = marker instanceof HTMLElement
      ? getComputedStyle(marker)
      : null;
    const tooltipContent = host instanceof HTMLElement
      ? getComputedStyle(host, "::after").content
      : "";
    const mousePoint = teacherMouseCoordinates();
    return {
      sourceLane,
      host,
      ghost,
      marker,
      sourceOpacity: Number.parseFloat(sourceStyle?.opacity || "1"),
      ghostOpacity: Number.parseFloat(ghostStyle?.opacity || "1"),
      ghostRect: ghostRect ? {
        left: ghostRect.left,
        top: ghostRect.top,
        right: ghostRect.right,
        bottom: ghostRect.bottom,
        width: ghostRect.width,
        height: ghostRect.height
      } : null,
      markerRect: markerRect ? {
        left: markerRect.left,
        top: markerRect.top,
        right: markerRect.right,
        bottom: markerRect.bottom,
        width: markerRect.width,
        height: markerRect.height
      } : null,
      markerTransitionDuration:
        markerStyle?.transitionDuration || "",
      markerBeforeContent: marker instanceof HTMLElement
        ? getComputedStyle(marker, "::before").content
        : "",
      markerAfterContent: marker instanceof HTMLElement
        ? getComputedStyle(marker, "::after").content
        : "",
      ghostTransitionDuration:
        ghostStyle?.transitionDuration || "",
      ghostDropZoneHidden:
        ghostDropZone instanceof HTMLElement &&
        getComputedStyle(ghostDropZone).display === "none",
      ghostActionsHidden:
        ghostActions instanceof HTMLElement &&
        getComputedStyle(ghostActions).display === "none",
      ghostName: ghost
        ?.querySelector(":scope > .option-heading > span")
        ?.textContent?.trim() || "",
      ghostItemCount: ghost
        ?.querySelector(":scope > .option-heading small")
        ?.textContent?.trim() || "",
      hostArmed:
        host?.classList.contains("option-drag-over") === true,
      tooltipContent,
      heldPoint: heldPoint ? { ...heldPoint } : null,
      mousePoint,
      ghostOffset: ghostRect && heldPoint ? {
        x: ghostRect.left - heldPoint.x,
        y: ghostRect.top - heldPoint.y
      } : null,
      tourLandingGuideCount: document.querySelectorAll(
        ".rml-setup-demo-landing"
      ).length
    };
  }

  async function waitForNativeSectionDragVisuals(
    sourceLane,
    host,
    heldPoint,
    runId,
    frameLimit = 30
  ) {
    let state = null;
    for (let frame = 0; frame < frameLimit; frame += 1) {
      if (runId !== demoRunId) return null;
      state = nativeSectionDragVisualState(
        sourceLane,
        host,
        heldPoint
      );
      if (
        state.ghost instanceof HTMLElement &&
        state.marker instanceof HTMLElement &&
        state.hostArmed
      ) {
        return state;
      }
      await waitForAnimationFrames(1);
    }
    return state;
  }

  function dispatchNativeSectionPointer(
    target,
    type,
    point,
    pointerId,
    {
      button = type === "pointermove" ? -1 : 0,
      buttons = type === "pointerup" ? 0 : 1
    } = {}
  ) {
    if (!(target instanceof EventTarget) || !point) return false;
    target.dispatchEvent(new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: "mouse",
      isPrimary: true,
      button,
      buttons,
      clientX: point.x,
      clientY: point.y
    }));
    return true;
  }

  async function animateNativeHeldSectionPointer(
    eventTarget,
    from,
    to,
    duration,
    pointerId,
    runId
  ) {
    const mouse = elements().mouse;
    const started = performance.now();
    while (runId === demoRunId) {
      const raw = Math.min(
        1,
        (performance.now() - started) / Math.max(1, duration)
      );
      const eased = 1 - Math.pow(1 - raw, 2.25);
      const point = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased
      };
      setTeacherMousePoint(
        point,
        0,
        [],
        "native-held-section-drag"
      );
      dispatchNativeSectionPointer(
        eventTarget,
        "pointermove",
        point,
        pointerId
      );
      if (raw >= 1) return true;
      await waitForAnimationFrames(1);
    }
    return false;
  }

  function dispatchNativeHeldSectionWheel(target, point, direction) {
    if (!(target instanceof EventTarget) || !point || !direction) {
      return false;
    }
    const event = new WheelEvent("wheel", {
      bubbles: true,
      cancelable: true,
      deltaMode: 0,
      deltaX: 0,
      deltaY: Math.sign(direction) * 40,
      clientX: point.x,
      clientY: point.y
    });
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }

  async function runOutlineNativeSectionWheelDemo(runId) {
    const controllerCard = [...document.querySelectorAll(
      ".node-card.controller[data-node-id]"
    )].find(card =>
      card.querySelector(":scope > .node-head .node-copy > strong")
        ?.textContent?.trim() === "DisplayMode"
    ) || null;
    const host = controllerCard?.querySelector(
      ":scope > .controller-options"
    );
    const lanes = directChildrenWithClass(host, "option-lane");
    const general = lanes.find(
      lane => outlineOptionLaneName(lane) === "General"
    );
    const advanced = lanes.find(
      lane => outlineOptionLaneName(lane) === "Advanced"
    );
    const sourceHeading = general?.querySelector(
      ":scope > .option-heading"
    );

    if (
      !(controllerCard instanceof HTMLElement) ||
      !(host instanceof HTMLElement) ||
      !(general instanceof HTMLElement) ||
      !(advanced instanceof HTMLElement) ||
      !(sourceHeading instanceof HTMLElement)
    ) {
      throw new Error(
        "[RML Tour · Step 4] The native DisplayMode/General reference elements are unavailable."
      );
    }

    const generalChildren = outlineOptionDirectChildNames(general);
    const advancedChildren = outlineOptionDirectChildNames(advanced);
    const untouchedReference = tourDebugAssert(
      "outline-nested-native-reference-state-untouched-at-pointerdown",
      outlineChildNamesMatch(generalChildren, ["Enabled", "Scale"]) &&
        outlineChildNamesMatch(
          advancedChildren,
          ["Quality", "DetailSection"]
        ),
      { generalChildren, advancedChildren }
    );
    if (!untouchedReference) {
      throw new Error(
        "[RML Tour · Step 4] A preliminary tour action changed the real reference contents before the Section drag."
      );
    }

    await nativeTourScrollTargetIntoView(controllerCard, runId);
    await nextTwoFrames();
    if (runId !== demoRunId) return false;

    releaseSemanticScene();
    document.querySelectorAll("[data-setup-shade]").forEach(
      shade => shade.style.display = "none"
    );
    document.querySelectorAll(".rml-setup-demo-landing").forEach(
      guide => guide.remove()
    );
    if (elements().demoLabel) elements().demoLabel.hidden = true;

    const headingRect = sourceHeading.getBoundingClientRect();
    const generalRect = general.getBoundingClientRect();
    const advancedRect = advanced.getBoundingClientRect();
    const advancedBody = advanced.querySelector(":scope > .drop-zone");
    const advancedBodyRect = advancedBody?.getBoundingClientRect?.() || advancedRect;
    const sideBySide = Math.min(
      generalRect.bottom,
      advancedRect.bottom
    ) - Math.max(
      generalRect.top,
      advancedRect.top
    ) >= Math.min(generalRect.height, advancedRect.height) * .6;
    const startPoint = {
      x: headingRect.left + Math.min(92, headingRect.width * .28),
      y: headingRect.top + headingRect.height * .5
    };
    const heldPoint = sideBySide
      ? {
          x: generalRect.right,
          y: Math.max(
            advancedBodyRect.top + 28,
            Math.min(
              advancedBodyRect.bottom - 28,
              advancedBodyRect.top + advancedBodyRect.height * .13
            )
          )
        }
      : {
          x: advancedRect.left + advancedRect.width * .25,
          y: (generalRect.bottom + advancedRect.top) * .5
        };
    const pointerId = 9231;

    if (!(await moveMouse(startPoint, 480, runId))) return false;
    dispatchNativeSectionPointer(
      sourceHeading,
      "pointerdown",
      startPoint,
      pointerId
    );
    elements().mouse?.classList.add("active", "pressed");

    const thresholdPoint = {
      x: startPoint.x + 8,
      y: startPoint.y
    };
    if (!(await animateNativeHeldSectionPointer(
      sourceHeading,
      startPoint,
      thresholdPoint,
      180,
      pointerId,
      runId
    ))) return false;
    if (!(await animateNativeHeldSectionPointer(
      sourceHeading,
      thresholdPoint,
      heldPoint,
      1180,
      pointerId,
      runId
    ))) return false;
    await nextTwoFrames();
    if (runId !== demoRunId) return false;

    let nativeState = await waitForNativeSectionDragVisuals(
      general,
      host,
      heldPoint,
      runId
    );

    await wait(140);
    await nextTwoFrames();
    nativeState = nativeSectionDragVisualState(
      general,
      host,
      heldPoint
    );
    const initialInsert =
      window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(host);
    const expectedNativeMarkerRect = insertionIndex => {
      const laneRects = [generalRect, advancedRect];
      const before = insertionIndex > 0
        ? laneRects[insertionIndex - 1]
        : null;
      const after = insertionIndex < laneRects.length
        ? laneRects[insertionIndex]
        : null;
      const leftCenter = before && after
        ? (before.right + after.left) * .5
        : after
          ? after.left - 4
          : before
            ? before.right + 4
            : host.getBoundingClientRect().left + 8;
      const anchor = after || before;
      const top = before && after
        ? Math.max(before.top, after.top)
        : anchor
          ? anchor.top
          : host.getBoundingClientRect().top + 8;
      const unclampedBottom = before && after
        ? Math.min(before.bottom, after.bottom)
        : anchor
          ? anchor.bottom
          : host.getBoundingClientRect().bottom - 8;
      const height = Math.max(24, unclampedBottom - top);
      return {
        centerX: leftCenter,
        left: leftCenter - 2,
        right: leftCenter + 2,
        top,
        bottom: top + height,
        width: 4,
        height
      };
    };
    const expectedMarkerRects = [0, 1, 2].map(
      expectedNativeMarkerRect
    );
    const expectedMiddleMarker = expectedMarkerRects[1];
    const expectedGhostWidth = Math.min(
      320,
      window.innerWidth * .46
    );
    const noTourSubstitutes = tourDebugAssert(
      "outline-nested-no-tour-substitute-visuals",
      nativeState?.tourLandingGuideCount === 0 &&
        elements().dragGhost?.hidden !== false &&
        elements().demoLabel?.hidden !== false &&
        !document.documentElement.classList.contains(
          "rml-setup-horizontal-option-gesture"
        ),
      {
        landingGuideCount: nativeState?.tourLandingGuideCount,
        tourDragGhostVisible: elements().dragGhost?.hidden === false,
        tourDemoLabelVisible: elements().demoLabel?.hidden === false,
        tourMarkerOverrideActive:
          document.documentElement.classList.contains(
            "rml-setup-horizontal-option-gesture"
          )
      }
    );
    const nativeVisualParity = tourDebugAssert(
      "outline-nested-native-visual-parity-while-held",
      Boolean(
        nativeState?.ghost instanceof HTMLElement &&
        nativeState?.marker instanceof HTMLElement &&
        nativeState.sourceOpacity >= .41 &&
        nativeState.sourceOpacity <= .43 &&
        nativeState.ghostOpacity >= .85 &&
        nativeState.ghostOpacity <= .87 &&
        nativeState.ghostDropZoneHidden &&
        nativeState.ghostActionsHidden &&
        nativeState.ghostName === "General" &&
        /^2 items?$/.test(nativeState.ghostItemCount) &&
        nativeState.hostArmed &&
        /Mausrad/.test(nativeState.tooltipContent) &&
        Math.abs(nativeState.ghostOffset?.x - 14) <= 1 &&
        Math.abs(nativeState.ghostOffset?.y - 14) <= 1 &&
        nativeState.markerRect?.height >= 24 &&
        nativeState.markerRect?.width <= 6 &&
        Math.abs(
          nativeState.markerRect.left +
          nativeState.markerRect.width * .5 -
          expectedMiddleMarker.centerX
        ) <= 3 &&
        Math.abs(
          nativeState.markerRect.top - expectedMiddleMarker.top
        ) <= 3 &&
        Math.abs(
          nativeState.markerRect.bottom - expectedMiddleMarker.bottom
        ) <= 3 &&
        Math.abs(
          nativeState.ghostRect?.width - expectedGhostWidth
        ) <= 3 &&
        nativeState.ghostRect?.height <= 180 &&
        /0\.09s/.test(nativeState.markerTransitionDuration) &&
        /0s/.test(nativeState.ghostTransitionDuration) &&
        ["none", "normal", "\"\""].includes(
          nativeState.markerBeforeContent
        ) &&
        ["none", "normal", "\"\""].includes(
          nativeState.markerAfterContent
        ) &&
        nativeState.tourLandingGuideCount === 0 &&
        initialInsert?.accepted === true &&
        initialInsert?.index === 1
      ),
      {
        sourceOpacity: nativeState?.sourceOpacity,
        ghostOpacity: nativeState?.ghostOpacity,
        ghostName: nativeState?.ghostName,
        ghostItemCount: nativeState?.ghostItemCount,
        ghostDropZoneHidden: nativeState?.ghostDropZoneHidden,
        ghostActionsHidden: nativeState?.ghostActionsHidden,
        ghostOffset: nativeState?.ghostOffset,
        hostArmed: nativeState?.hostArmed,
        tooltipContent: nativeState?.tooltipContent,
        markerRect: nativeState?.markerRect,
        expectedMiddleMarker,
        markerTransitionDuration:
          nativeState?.markerTransitionDuration,
        markerBeforeContent: nativeState?.markerBeforeContent,
        markerAfterContent: nativeState?.markerAfterContent,
        expectedGhostWidth,
        ghostRect: nativeState?.ghostRect,
        ghostTransitionDuration:
          nativeState?.ghostTransitionDuration,
        tourLandingGuideCount: nativeState?.tourLandingGuideCount,
        insertionState: initialInsert,
        sideBySide
      }
    );
    if (!nativeVisualParity || !noTourSubstitutes) {
      throw new Error(
        "[RML Tour · Step 4] The held Section does not match the Builder's native source, ghost, target, tooltip and marker visuals."
      );
    }

    const mouseBeforeWheel = teacherMouseCoordinates();
    const ghostBeforeWheel = nativeState.ghostRect;
    const wheelTarget = document.elementFromPoint(
      heldPoint.x,
      heldPoint.y
    ) || host;
    const trace = [];
    const captureTrace = label => {
      const state = nativeSectionDragVisualState(
        general,
        host,
        heldPoint
      );
      const insertion =
        window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(host);
      trace.push({
        label,
        index: insertion?.index ?? null,
        markerRect: state.markerRect,
        mousePoint: state.mousePoint,
        ghostRect: state.ghostRect
      });
      return { state, insertion };
    };
    captureTrace("initial-middle");

    elements().mouse?.classList.add("scrolling", "horizontal-wheel");
    const leftConsumed = dispatchNativeHeldSectionWheel(
      wheelTarget,
      heldPoint,
      -1
    );
    await wait(620);
    const left = captureTrace("far-left");

    const middleConsumed = dispatchNativeHeldSectionWheel(
      wheelTarget,
      heldPoint,
      1
    );
    await wait(1050);
    const middle = captureTrace("middle-reference-frame");

    const rightConsumed = dispatchNativeHeldSectionWheel(
      wheelTarget,
      heldPoint,
      1
    );
    await wait(820);
    const right = captureTrace("far-right");
    elements().mouse?.classList.remove("scrolling", "horizontal-wheel");

    const mouseAfterWheel = teacherMouseCoordinates();
    const ghostAfterWheel = right.state.ghostRect;
    const markerPositions = [
      left.state.markerRect?.left,
      middle.state.markerRect?.left,
      right.state.markerRect?.left
    ];
    const markerCenters = [
      left.state.markerRect
        ? left.state.markerRect.left + left.state.markerRect.width * .5
        : null,
      middle.state.markerRect
        ? middle.state.markerRect.left + middle.state.markerRect.width * .5
        : null,
      right.state.markerRect
        ? right.state.markerRect.left + right.state.markerRect.width * .5
        : null
    ];
    const expectedMarkerCenters = expectedMarkerRects.map(
      rectangle => rectangle.centerX
    );
    const exactNativeWheelJourney = tourDebugAssert(
      "outline-nested-native-wheel-left-middle-right",
      Boolean(
        leftConsumed &&
        middleConsumed &&
        rightConsumed &&
        left.insertion?.index === 0 &&
        middle.insertion?.index === 1 &&
        right.insertion?.index === 2 &&
        markerPositions.every(Number.isFinite) &&
        markerCenters.every(Number.isFinite) &&
        markerPositions[0] < markerPositions[1] - 2 &&
        markerPositions[1] < markerPositions[2] - 2 &&
        markerCenters.every(
          (value, index) =>
            Math.abs(value - expectedMarkerCenters[index]) <= 3
        )
      ),
      {
        trace,
        markerPositions,
        markerCenters,
        expectedMarkerCenters
      }
    );
    const pointerAndGhostStationary = tourDebugAssert(
      "outline-nested-native-pointer-and-ghost-stationary-during-wheel",
      Boolean(
        mouseBeforeWheel &&
        mouseAfterWheel &&
        ghostBeforeWheel &&
        ghostAfterWheel &&
        Math.abs(mouseAfterWheel.x - mouseBeforeWheel.x) < .5 &&
        Math.abs(mouseAfterWheel.y - mouseBeforeWheel.y) < .5 &&
        Math.abs(ghostAfterWheel.left - ghostBeforeWheel.left) < .5 &&
        Math.abs(ghostAfterWheel.top - ghostBeforeWheel.top) < .5
      ),
      {
        mouseBeforeWheel,
        mouseAfterWheel,
        ghostBeforeWheel,
        ghostAfterWheel,
        heldPoint
      }
    );
    const markerSpansRealLaneHeight = tourDebugAssert(
      "outline-nested-native-marker-uses-production-lane-height",
      [left, middle, right].every((entry, index) =>
        entry.state.markerRect &&
        Math.abs(
          entry.state.markerRect.top -
          expectedMarkerRects[index].top
        ) <= 3 &&
        Math.abs(
          entry.state.markerRect.height -
          expectedMarkerRects[index].height
        ) <= 3 &&
        Math.abs(
          entry.state.markerRect.width -
          expectedMarkerRects[index].width
        ) <= 1
      ),
      {
        generalRect: tourDebugRect(general),
        advancedRect: tourDebugRect(advanced),
        expectedMarkerRects,
        sideBySide,
        trace
      }
    );
    if (
      !exactNativeWheelJourney ||
      !pointerAndGhostStationary ||
      !markerSpansRealLaneHeight
    ) {
      throw new Error(
        "[RML Tour · Step 4] The real native marker journey or stationary held-ghost contract failed."
      );
    }

    const releaseTarget = document.elementFromPoint(
      heldPoint.x,
      heldPoint.y
    ) || sourceHeading;
    dispatchNativeSectionPointer(
      releaseTarget,
      "pointerup",
      heldPoint,
      pointerId,
      { button: 0, buttons: 0 }
    );
    elements().mouse?.classList.remove("pressed");
    await nextTwoFrames();
    await wait(520);

    const releasedControllerCard = [...document.querySelectorAll(
      ".node-card.controller[data-node-id]"
    )].find(card =>
      card.querySelector(":scope > .node-head .node-copy > strong")
        ?.textContent?.trim() === "DisplayMode"
    ) || null;
    const releasedHost = releasedControllerCard?.querySelector(
      ":scope > .controller-options"
    );
    const releasedLanes = directChildrenWithClass(
      releasedHost,
      "option-lane"
    );
    const releasedLaneNames = releasedLanes.map(
      outlineOptionLaneName
    );
    const releasedGeneral = releasedLanes.find(
      lane => outlineOptionLaneName(lane) === "General"
    );
    const releasedAdvanced = releasedLanes.find(
      lane => outlineOptionLaneName(lane) === "Advanced"
    );
    const releasedGeneralChildren = outlineOptionDirectChildNames(
      releasedGeneral
    );
    const releasedAdvancedChildren = outlineOptionDirectChildNames(
      releasedAdvanced
    );
    const nativeReleaseCommitted = tourDebugAssert(
      "outline-nested-native-release-committed-at-far-right",
      releasedLaneNames.join("|") === "Advanced|General" &&
        outlineChildNamesMatch(
          releasedGeneralChildren,
          ["Enabled", "Scale"]
        ) &&
        outlineChildNamesMatch(
          releasedAdvancedChildren,
          ["Quality", "DetailSection"]
        ),
      {
        releasedLaneNames,
        releasedGeneralChildren,
        releasedAdvancedChildren
      }
    );
    const nativeCleanup = tourDebugAssert(
      "outline-nested-native-drag-cleanup-after-release",
      !document.querySelector(".option-pointer-ghost") &&
        !document.querySelector(".option-pointer-source") &&
        !document.querySelector(".option-reorder-placeholder") &&
        !document.querySelector(".controller-options.option-drag-over") &&
        !document.querySelector(".rml-setup-demo-landing"),
      {
        ghostPresent: Boolean(document.querySelector(".option-pointer-ghost")),
        sourcePresent: Boolean(document.querySelector(".option-pointer-source")),
        markerPresent: Boolean(document.querySelector(".option-reorder-placeholder")),
        hostArmed: Boolean(document.querySelector(".controller-options.option-drag-over")),
        substituteGuidePresent: Boolean(document.querySelector(".rml-setup-demo-landing"))
      }
    );
    if (!nativeReleaseCommitted || !nativeCleanup) {
      throw new Error(
        "[RML Tour · Step 4] The real release did not commit General at the far-right position or did not clean up its native drag visuals."
      );
    }
    hideMouse();
    return true;
  }

  function tourPerceptionElementLabel(element) {
    if (!(element instanceof Element)) return "";
    const id = element.id ? `#${element.id}` : "";
    const classes = [...element.classList]
      .filter(name => !name.startsWith("rml-setup-"))
      .slice(0, 4)
      .map(name => `.${name}`)
      .join("");
    return `${element.tagName.toLowerCase()}${id}${classes}`;
  }

  function tourPerceivePoint(point, controllerCard = null, host = null) {
    const visualViewport = window.visualViewport;
    const viewportLeft = visualViewport?.offsetLeft || 0;
    const viewportTop = visualViewport?.offsetTop || 0;
    const viewportRight = viewportLeft +
      (visualViewport?.width || window.innerWidth);
    const viewportBottom = viewportTop +
      (visualViewport?.height || window.innerHeight);
    const x = Math.max(
      viewportLeft,
      Math.min(viewportRight - 1, point?.x || viewportLeft)
    );
    const y = Math.max(
      viewportTop,
      Math.min(viewportBottom - 1, point?.y || viewportTop)
    );
    const rawStack = document.elementsFromPoint(x, y);
    const productStack = rawStack.filter(element =>
      !element.closest(
        "#rml-setup-assistant, .rml-setup-mouse, " +
        ".rml-setup-drag-ghost, .option-pointer-ghost, " +
        ".option-reorder-placeholder"
      )
    );
    const top = productStack[0] || null;
    const topController = top?.closest(
      ".node-card.controller[data-node-id]"
    ) || null;
    const topDropZone = top?.closest(".drop-zone") || null;
    const topOutlineLane = top?.closest(
      ".option-lane[data-container], .layout-row-lane[data-container]"
    ) || null;
    const hostRect = host?.getBoundingClientRect?.() || null;
    const insideHost = Boolean(
      hostRect &&
      x >= hostRect.left && x <= hostRect.right &&
      y >= hostRect.top && y <= hostRect.bottom
    );
    return {
      point: { x, y },
      top,
      topLabel: tourPerceptionElementLabel(top),
      stack: productStack.slice(0, 8).map(tourPerceptionElementLabel),
      insideHost,
      sameController: Boolean(
        controllerCard && topController === controllerCard
      ),
      dropZoneHit: Boolean(
        controllerCard &&
        (
          Boolean(topDropZone && controllerCard.contains(topDropZone)) ||
          Boolean(topOutlineLane && controllerCard.contains(topOutlineLane))
        )
      ),
      controllerSurface: Boolean(
        insideHost &&
        controllerCard &&
        topController === controllerCard &&
        !topDropZone &&
        !topOutlineLane
      )
    };
  }

  function tourElementCapabilities(element) {
    if (!(element instanceof HTMLElement)) return [];
    const capabilities = [];
    if (element.matches("button, [role='button'], input, select, textarea")) {
      capabilities.push("pointer.click");
    }
    if (element.matches(".rml-graph-palette-item[data-graph-operator]")) {
      capabilities.push("graph.palette.drag-node", "pointer.drag");
    }
    if (element.matches("[data-palette]")) {
      capabilities.push("outline.palette.drag-node", "pointer.drag");
    }
    if (element.matches(
      ".rml-graph-panel-toggle-left, .rml-graph-panel-toggle-right, " +
      "[data-rml-graph-toggle-left], [data-rml-graph-toggle-right]"
    )) {
      capabilities.push("graph.sidebar.ensure-visible");
    }
    if (element.matches("#top-menu-toggle")) {
      capabilities.push("responsive-menu.toggle");
    }
    if (element.matches(".rml-graph-socket")) {
      capabilities.push("graph.socket.connect", "pointer.drag");
    }
    if (element.matches(".rml-graph-node-header")) {
      capabilities.push("graph.node.drag", "pointer.drag");
    }
    if (element.matches(".rml-graph-wire-hit, .rml-graph-wire-point")) {
      capabilities.push("graph.wire.route", "pointer.drag");
    }
    return [...new Set(capabilities)];
  }

  function tourVisibleHitPoint(element, margin = 4) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return null;
    const rect = element.getBoundingClientRect();
    const viewport = tourViewport();
    const left = Math.max(rect.left + margin, viewport.left + 1);
    const right = Math.min(rect.right - margin, viewport.right - 1);
    const top = Math.max(
      rect.top + margin,
      viewport.top + 1,
      tourHeaderBottom() + 1
    );
    const bottom = Math.min(rect.bottom - margin, viewport.bottom - 1);
    if (right <= left || bottom <= top) return null;

    const factors = [
      [.5, .5], [.25, .5], [.75, .5],
      [.5, .25], [.5, .75], [.2, .2],
      [.8, .2], [.2, .8], [.8, .8]
    ];
    for (const [xFactor, yFactor] of factors) {
      const point = {
        x: left + (right - left) * xFactor,
        y: top + (bottom - top) * yFactor
      };
      const perceived = tourPerceivePoint(point);
      if (
        perceived.top &&
        (perceived.top === element || element.contains(perceived.top))
      ) {
        return {
          point,
          top: perceived.top,
          topLabel: perceived.topLabel,
          stack: perceived.stack
        };
      }
    }
    return null;
  }

  function tourPerceiveElement(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) {
      return {
        connected: false,
        visible: false,
        rect: null,
        centerHit: null
      };
    }
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    const visualViewport = window.visualViewport;
    const viewportLeft = visualViewport?.offsetLeft || 0;
    const viewportTop = visualViewport?.offsetTop || 0;
    const viewportRight = viewportLeft +
      (visualViewport?.width || window.innerWidth);
    const viewportBottom = viewportTop +
      (visualViewport?.height || window.innerHeight);
    const intersectsViewport =
      rect.right > viewportLeft &&
      rect.left < viewportRight &&
      rect.bottom > viewportTop &&
      rect.top < viewportBottom;
    const fullyInsideViewport =
      rect.left >= viewportLeft &&
      rect.right <= viewportRight &&
      rect.top >= Math.max(viewportTop, tourHeaderBottom()) &&
      rect.bottom <= viewportBottom;
    const center = {
      x: Math.max(0, Math.min(window.innerWidth - 1, rect.left + rect.width * .5)),
      y: Math.max(0, Math.min(window.innerHeight - 1, rect.top + rect.height * .5))
    };
    const hit = tourVisibleHitPoint(element);
    const openDialog = element.closest("dialog[open]");
    return {
      connected: true,
      visible: tourElementActuallyVisible(element) && intersectsViewport,
      intersectsViewport,
      fullyInsideViewport,
      rect: tourDebugRect(element),
      display: style.display,
      visibility: style.visibility,
      opacity: Number.parseFloat(style.opacity || "1"),
      pointerEvents: style.pointerEvents,
      tagName: element.tagName.toLowerCase(),
      role: element.getAttribute("role") || "",
      disabled: Boolean(element.matches(":disabled")),
      ariaExpanded: element.getAttribute("aria-expanded"),
      draggable: element.draggable === true,
      zIndex: style.zIndex,
      insideOpenDialog: Boolean(openDialog),
      openDialogId: openDialog?.id || "",
      capabilities: tourElementCapabilities(element),
      centerHit: tourPerceivePoint(center).topLabel,
      hitTestable: Boolean(hit),
      hitPoint: hit?.point || null,
      hitTop: hit?.topLabel || ""
    };
  }

  function tourCaptureLivePerception(namedElements, points = []) {
    const visualViewport = window.visualViewport;
    return {
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight,
        visualWidth: visualViewport?.width || window.innerWidth,
        visualHeight: visualViewport?.height || window.innerHeight,
        offsetLeft: visualViewport?.offsetLeft || 0,
        offsetTop: visualViewport?.offsetTop || 0,
        scale: visualViewport?.scale || 1
      },
      scroll: {
        left: window.scrollX,
        top: window.scrollY
      },
      elements: Object.fromEntries(
        Object.entries(namedElements || {}).map(
          ([name, element]) => [name, tourPerceiveElement(element)]
        )
      ),
      points: points.map(point => tourPerceivePoint(point))
    };
  }

  async function tourPerceiveAndRepairStepTarget(
    step,
    target,
    runId,
    controlledRepeat = false
  ) {
    let resolved = findTarget(step) || target;
    const before = tourPerceiveElement(resolved);
    let repairedByScroll = false;
    if (
      before.connected &&
      before.visible !== true &&
      runId === demoRunId
    ) {
      repairedByScroll = await nativeTourScrollTargetIntoView(
        resolved,
        runId
      );
      await nextTwoFrames();
      resolved = findTarget(step) || resolved;
    }
    const after = tourPerceiveElement(resolved);
    tourDebugRecord("tour-live-perception-target-confirmed", {
      demo: step?.demo || "",
      controlledRepeat: controlledRepeat === true,
      before,
      after,
      repairedByScroll,
      targetLabel: tourPerceptionElementLabel(resolved)
    });
    return resolved;
  }

  function outlineNativeControllerCandidates(
    controllerCard,
    host,
    general,
    advanced
  ) {
    const hostRect = host.getBoundingClientRect();
    const generalRect = general.getBoundingClientRect();
    const advancedRect = advanced.getBoundingClientRect();
    const visualViewport = window.visualViewport;
    const viewportLeft = visualViewport?.offsetLeft || 0;
    const viewportTop = visualViewport?.offsetTop || 0;
    const viewportRight = viewportLeft +
      (visualViewport?.width || window.innerWidth);
    const viewportBottom = viewportTop +
      (visualViewport?.height || window.innerHeight);
    const safeLeft = Math.max(hostRect.left + 1, viewportLeft + 1);
    const safeRight = Math.min(hostRect.right - 1, viewportRight - 1);
    const safeTop = Math.max(
      hostRect.top + 1,
      viewportTop + 1,
      tourHeaderBottom() + 1
    );
    const safeBottom = Math.min(hostRect.bottom - 1, viewportBottom - 1);
    const advancedBody = advanced.querySelector(":scope > .drop-zone");
    const bodyRect = advancedBody?.getBoundingClientRect?.() || advancedRect;
    const verticalOverlap = Math.min(
      generalRect.bottom,
      advancedRect.bottom
    ) - Math.max(generalRect.top, advancedRect.top);
    const sideBySide = verticalOverlap >=
      Math.min(generalRect.height, advancedRect.height) * .6;
    const raw = [];
    if (sideBySide) {
      const gapLeft = Math.min(generalRect.right, advancedRect.left);
      const gapRight = Math.max(generalRect.right, advancedRect.left);
      const gapMiddle = (generalRect.right + advancedRect.left) * .5;
      const referenceY = Math.max(
        bodyRect.top + 20,
        Math.min(bodyRect.bottom - 20, bodyRect.top + bodyRect.height * .13)
      );
      const headingY = Math.max(
        generalRect.top + 8,
        Math.min(generalRect.bottom - 8, generalRect.top + 18)
      );
      [
        gapMiddle,
        gapLeft + Math.max(.75, (gapRight - gapLeft) * .25),
        gapRight - Math.max(.75, (gapRight - gapLeft) * .25),
        gapMiddle - 1,
        gapMiddle + 1
      ].forEach(x => {
        raw.push({ x, y: referenceY, layout: "side-by-side" });
        raw.push({ x, y: headingY, layout: "side-by-side-heading" });
      });
      raw.push({
        x: Math.min(generalRect.right - 2, generalRect.left + generalRect.width * .94),
        y: headingY,
        layout: "general-heading-edge"
      });
    } else {
      const gapMiddle = (generalRect.bottom + advancedRect.top) * .5;
      const referenceX = advancedRect.left + advancedRect.width * .25;
      [
        gapMiddle,
        generalRect.bottom + 1,
        advancedRect.top - 1,
        gapMiddle - 1,
        gapMiddle + 1
      ].forEach(y => raw.push({
        x: referenceX,
        y,
        layout: "stacked"
      }));
      raw.push({
        x: advancedRect.left + advancedRect.width * .25,
        y: advancedRect.top + 16,
        layout: "advanced-heading"
      });
    }

    const unique = [];
    const keys = new Set();
    for (const candidate of raw) {
      const point = {
        x: Math.max(safeLeft, Math.min(safeRight, candidate.x)),
        y: Math.max(safeTop, Math.min(safeBottom, candidate.y))
      };
      const key = `${Math.round(point.x * 2)}:${Math.round(point.y * 2)}`;
      if (keys.has(key)) continue;
      keys.add(key);
      const perception = tourPerceivePoint(
        point,
        controllerCard,
        host
      );
      unique.push({
        ...candidate,
        point,
        perception,
        score:
          (perception.controllerSurface ? 1000 : 0) +
          (perception.sameController ? 180 : 0) +
          (perception.insideHost ? 80 : 0) -
          (perception.dropZoneHit ? 700 : 0)
      });
    }
    unique.sort((left, right) => right.score - left.score);
    return { sideBySide, candidates: unique };
  }

  async function outlineAcquireNativeControllerTarget({
    controllerCard,
    host,
    general,
    advanced,
    sourceHeading,
    pointerId,
    fromPoint,
    runId,
    transaction
  }) {
    const plan = outlineNativeControllerCandidates(
      controllerCard,
      host,
      general,
      advanced
    );
    let currentPoint = fromPoint;
    for (const candidate of plan.candidates) {
      if (runId !== demoRunId) return null;
      transaction.targetAttempts += 1;
      const duration = transaction.targetAttempts === 1 ? 1180 : 180;
      if (!(await animateNativeHeldSectionPointer(
        sourceHeading,
        currentPoint,
        candidate.point,
        duration,
        pointerId,
        runId
      ))) return null;
      currentPoint = candidate.point;
      for (let frame = 0; frame < 14 && runId === demoRunId; frame += 1) {
        dispatchNativeSectionPointer(
          sourceHeading,
          "pointermove",
          currentPoint,
          pointerId
        );
        await waitForAnimationFrames(1);

        window.RMLBuilderSetupBridge?.armHeldOptionHorizontal?.(
          host,
          currentPoint.x,
          currentPoint.y
        );
        const inspection =
          window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(host);
        const state = nativeSectionDragVisualState(
          general,
          host,
          currentPoint
        );
        if (
          inspection?.accepted === true &&
          inspection.index === 1 &&
          state.ghost instanceof HTMLElement &&
          state.marker instanceof HTMLElement &&
          state.hostArmed
        ) {
          transaction.acquiredPoint = { ...currentPoint };
          transaction.acquiredCandidate = {
            layout: candidate.layout,
            score: candidate.score,
            perception: candidate.perception
          };
          return {
            point: currentPoint,
            inspection,
            state,
            sideBySide: plan.sideBySide,
            candidates: plan.candidates
          };
        }
      }
    }
    return {
      point: currentPoint,
      inspection:
        window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(host),
      state: nativeSectionDragVisualState(general, host, currentPoint),
      sideBySide: plan.sideBySide,
      candidates: plan.candidates,
      failed: true
    };
  }

  async function outlineWheelToNativeIndex({
    desiredIndex,
    host,
    general,
    heldPoint,
    sourceHeading,
    pointerId,
    runId,
    transaction
  }) {
    const attempts = [];
    const inspect = () =>
      window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(host) || null;
    const acceptedIndex = inspection =>
      inspection?.accepted === true && Number.isFinite(inspection.index);
    const before = inspect();
    const previousIndex = Number.isFinite(transaction.confirmedIndex)
      ? transaction.confirmedIndex
      : acceptedIndex(before)
        ? before.index
        : 1;
    const direction = Math.sign(desiredIndex - previousIndex);
    let consumed = false;
    if (direction) {
      consumed = dispatchNativeHeldSectionWheel(
        host,
        heldPoint,
        direction
      );
      transaction.wheelDispatches += 1;
      transaction.wheelDirections.push(direction);
      await wait(120);
      await nextTwoFrames();
    }

    const wheelInspection = inspect();
    const wheelReached = Boolean(
      acceptedIndex(wheelInspection) &&
      wheelInspection.index === desiredIndex
    );

    const exactSet =
      window.RMLBuilderSetupBridge?.setHeldOptionHorizontalIndex?.(
        host,
        desiredIndex
      ) || null;
    if (!wheelReached) transaction.wheelFallbackSteps += 1;
    const reached = Boolean(
      exactSet?.accepted === true &&
      exactSet?.authoritative === true &&
      exactSet.afterIndex === desiredIndex
    );
    await nextTwoFrames();
    const inspection = inspect();
    if (reached && previousIndex !== desiredIndex) {
      transaction.wheelTransitions.push(
        Math.sign(desiredIndex - previousIndex)
      );
    }
    if (reached) transaction.confirmedIndex = desiredIndex;
    attempts.push({
      beforeIndex: before?.index ?? null,
      previousConfirmedIndex: previousIndex,
      desiredIndex,
      direction,
      consumed,
      exactSet,
      afterIndex: inspection?.index ?? null,
      wheelReached,
      confirmedBy: reached
        ? "authoritative-native-index"
        : "not-confirmed"
    });
    await wait(150);
    return {
      reached,
      inspection,
      state: nativeSectionDragVisualState(general, host, heldPoint),
      attempts
    };
  }

  async function runOutlineNativeSectionWheelDemoSeeing(runId) {
    const transaction = {
      id: ++outlineNestedTransactionSerial,
      runId,
      pointerDowns: 0,
      pointerUps: 0,
      pointerCancels: 0,
      wheelDispatches: 0,
      wheelFallbackSteps: 0,
      wheelDirections: [],
      wheelTransitions: [],
      confirmedIndex: null,
      targetAttempts: 0,
      reachedIndexes: [],
      acquiredPoint: null,
      acquiredCandidate: null
    };
    tourDebugRecord("outline-nested-native-transaction-start", {
      transactionId: transaction.id,
      runId
    });

    const controllerCard = [...document.querySelectorAll(
      ".node-card.controller[data-node-id]"
    )].find(card =>
      card.querySelector(":scope > .node-head .node-copy > strong")
        ?.textContent?.trim() === "DisplayMode"
    ) || null;
    const host = controllerCard?.querySelector(":scope > .controller-options");
    const lanes = directChildrenWithClass(host, "option-lane");
    const general = lanes.find(lane => outlineOptionLaneName(lane) === "General");
    const advanced = lanes.find(lane => outlineOptionLaneName(lane) === "Advanced");
    const sourceHeading = general?.querySelector(":scope > .option-heading");
    if (
      !(controllerCard instanceof HTMLElement) ||
      !(host instanceof HTMLElement) ||
      !(general instanceof HTMLElement) ||
      !(advanced instanceof HTMLElement) ||
      !(sourceHeading instanceof HTMLElement)
    ) {
      throw new Error(
        "[RML Tour · Step 4] Live perception could not resolve DisplayMode, General, Advanced and the native drag heading."
      );
    }

    await nativeTourScrollTargetIntoView(controllerCard, runId);
    await nextTwoFrames();
    if (runId !== demoRunId) return false;

    releaseSemanticScene();
    document.querySelectorAll("[data-setup-shade]").forEach(
      shade => shade.style.display = "none"
    );
    document.querySelectorAll(".rml-setup-demo-landing").forEach(
      guide => guide.remove()
    );
    if (elements().demoLabel) elements().demoLabel.hidden = true;

    const generalChildren = outlineOptionDirectChildNames(general);
    const advancedChildren = outlineOptionDirectChildNames(advanced);
    const referenceUntouched = tourDebugAssert(
      "outline-nested-native-reference-state-untouched-at-pointerdown",
      outlineChildNamesMatch(generalChildren, ["Enabled", "Scale"]) &&
        outlineChildNamesMatch(
          advancedChildren,
          ["Quality", "DetailSection"]
        ),
      { generalChildren, advancedChildren }
    );
    const initialPerceptionPlan = outlineNativeControllerCandidates(
      controllerCard,
      host,
      general,
      advanced
    );
    const liveScene = tourCaptureLivePerception(
      { controllerCard, host, general, advanced, sourceHeading },
      initialPerceptionPlan.candidates.slice(0, 6).map(item => item.point)
    );
    const perceptionReady = tourDebugAssert(
      "tour-live-perception-step-4-scene-resolved",
      referenceUntouched &&
        liveScene.elements.controllerCard.visible === true &&
        liveScene.elements.general.visible === true &&
        liveScene.elements.advanced.visible === true &&
        initialPerceptionPlan.candidates.some(
          candidate => candidate.perception.controllerSurface
        ),
      {
        liveScene,
        candidates: initialPerceptionPlan.candidates.map(candidate => ({
          point: candidate.point,
          layout: candidate.layout,
          score: candidate.score,
          perception: candidate.perception
        }))
      }
    );
    if (!referenceUntouched) {
      throw new Error(
        "[RML Tour · Step 4] The required General and Advanced contents were unavailable before PointerDown."
      );
    }

    const headingRect = sourceHeading.getBoundingClientRect();
    const visibleHeadingHit = tourVisibleHitPoint(sourceHeading, 2);
    const effectViewport = tourEffectViewport();
    const startPoint = visibleHeadingHit?.point || {
      x: Math.max(
        effectViewport.left + 10,
        Math.min(
          effectViewport.right - 10,
          headingRect.left + Math.min(92, headingRect.width * .28)
        )
      ),
      y: Math.max(
        Math.max(effectViewport.top, tourHeaderBottom()) + 10,
        Math.min(
          effectViewport.bottom - 10,
          headingRect.top + headingRect.height * .5
        )
      )
    };
    const thresholdPoint = { x: startPoint.x + 8, y: startPoint.y };
    const pointerId = 9231;
    let pointerHeld = false;
    let released = false;
    let acquired = null;
    let functionalFailure = "";

    try {
      if (!(await moveMouse(startPoint, 480, runId))) return false;
      dispatchNativeSectionPointer(
        sourceHeading,
        "pointerdown",
        startPoint,
        pointerId
      );
      transaction.pointerDowns += 1;
      pointerHeld = true;
      elements().mouse?.classList.add("active", "pressed");
      if (!(await animateNativeHeldSectionPointer(
        sourceHeading,
        startPoint,
        thresholdPoint,
        180,
        pointerId,
        runId
      ))) return false;

      acquired = await outlineAcquireNativeControllerTarget({
        controllerCard,
        host,
        general,
        advanced,
        sourceHeading,
        pointerId,
        fromPoint: thresholdPoint,
        runId,
        transaction
      });
      const targetAcquired = tourDebugAssert(
        "outline-nested-live-hit-test-controller-target-acquired",
        Boolean(
          acquired &&
          acquired.failed !== true &&
          acquired.inspection?.accepted === true &&
          acquired.inspection.index === 1 &&
          acquired.state?.ghost instanceof HTMLElement &&
          acquired.state?.marker instanceof HTMLElement &&
          acquired.state?.hostArmed
        ),
        {
          transaction,
          inspection: acquired?.inspection || null,
          state: acquired?.state || null,
          candidates: acquired?.candidates?.map(candidate => ({
            point: candidate.point,
            layout: candidate.layout,
            score: candidate.score,
            perception: candidate.perception
          })) || []
        }
      );
      if (!targetAcquired) {
        functionalFailure = "Live hit-testing could not arm the native middle controller insertion target.";
      } else {
        const heldPoint = acquired.point;
        transaction.confirmedIndex = 1;

        await wait(140);
        await nextTwoFrames();
        const nativeState = nativeSectionDragVisualState(
          general,
          host,
          heldPoint
        );
        const generalRect = general.getBoundingClientRect();
        const advancedRect = advanced.getBoundingClientRect();
        const laneRects = [generalRect, advancedRect];
        const expectedMarkerRect = insertionIndex => {
          const before = insertionIndex > 0
            ? laneRects[insertionIndex - 1]
            : null;
          const after = insertionIndex < laneRects.length
            ? laneRects[insertionIndex]
            : null;
          const centerX = before && after
            ? (before.right + after.left) * .5
            : after
              ? after.left - 4
              : before
                ? before.right + 4
                : host.getBoundingClientRect().left + 8;
          const anchor = after || before;
          const top = before && after
            ? Math.max(before.top, after.top)
            : anchor?.top || host.getBoundingClientRect().top + 8;
          const unclampedBottom = before && after
            ? Math.min(before.bottom, after.bottom)
            : anchor?.bottom || host.getBoundingClientRect().bottom - 8;
          const height = Math.max(24, unclampedBottom - top);
          return {
            centerX,
            left: centerX - 2,
            right: centerX + 2,
            top,
            bottom: top + height,
            width: 4,
            height
          };
        };
        const expectedMarkers = [0, 1, 2].map(expectedMarkerRect);
        const expectedMiddleMarker = expectedMarkers[1];
        const expectedGhostWidth = Math.min(320, window.innerWidth * .46);
        const noTourSubstitutes = tourDebugAssert(
          "outline-nested-no-tour-substitute-visuals",
          nativeState.tourLandingGuideCount === 0 &&
            elements().dragGhost?.hidden !== false &&
            elements().demoLabel?.hidden !== false &&
            !document.documentElement.classList.contains(
              "rml-setup-horizontal-option-gesture"
            ),
          {
            nativeGhostPresent: nativeState.ghost instanceof HTMLElement,
            nativeMarkerPresent: nativeState.marker instanceof HTMLElement,
            landingGuideCount: nativeState.tourLandingGuideCount
          }
        );
        const nativeVisualParity = tourDebugAssert(
          "outline-nested-native-visual-parity-while-held",
          Boolean(
            nativeState.sourceOpacity >= .41 &&
            nativeState.sourceOpacity <= .43 &&
            nativeState.ghostOpacity >= .85 &&
            nativeState.ghostOpacity <= .87 &&
            nativeState.ghostDropZoneHidden &&
            nativeState.ghostActionsHidden &&
            nativeState.ghostName === "General" &&
            /^2 items?$/.test(nativeState.ghostItemCount) &&
            nativeState.hostArmed &&
            /Mausrad/.test(nativeState.tooltipContent) &&
            Math.abs(nativeState.ghostOffset?.x - 14) <= 1 &&
            Math.abs(nativeState.ghostOffset?.y - 14) <= 1 &&
            nativeState.markerRect?.width <= 6 &&
            nativeState.markerRect?.height >= 24 &&
            Math.abs(
              nativeState.markerRect.left + nativeState.markerRect.width * .5 -
              expectedMiddleMarker.centerX
            ) <= 3 &&
            Math.abs(nativeState.markerRect.top - expectedMiddleMarker.top) <= 3 &&
            Math.abs(nativeState.markerRect.bottom - expectedMiddleMarker.bottom) <= 3 &&
            Math.abs(nativeState.ghostRect?.width - expectedGhostWidth) <= 3 &&
            nativeState.ghostRect?.height <= 180 &&
            /0\.09s/.test(nativeState.markerTransitionDuration) &&
            /0s/.test(nativeState.ghostTransitionDuration) &&
            ["none", "normal", "\"\""].includes(
              nativeState.markerBeforeContent
            ) &&
            ["none", "normal", "\"\""].includes(
              nativeState.markerAfterContent
            ) &&
            noTourSubstitutes
          ),
          {
            transaction,
            sourceOpacity: nativeState.sourceOpacity,
            ghostOpacity: nativeState.ghostOpacity,
            ghostName: nativeState.ghostName,
            ghostItemCount: nativeState.ghostItemCount,
            ghostOffset: nativeState.ghostOffset,
            markerRect: nativeState.markerRect,
            expectedMiddleMarker,
            expectedGhostWidth,
            ghostRect: nativeState.ghostRect,
            markerTransitionDuration: nativeState.markerTransitionDuration,
            ghostTransitionDuration: nativeState.ghostTransitionDuration,
            markerBeforeContent: nativeState.markerBeforeContent,
            markerAfterContent: nativeState.markerAfterContent,
            tooltipContent: nativeState.tooltipContent,
            diagnosticPolicy: "record-but-never-abort-held-gesture"
          }
        );
        tourDebugRecord("outline-nested-held-reference-observed", {
          transactionId: transaction.id,
          nativeVisualParity,
          heldPoint,
          state: nativeState
        });

        const mouseBeforeWheel = teacherMouseCoordinates();
        const ghostBeforeWheel = nativeState.ghostRect;
        elements().mouse?.classList.add("scrolling", "horizontal-wheel");
        const left = await outlineWheelToNativeIndex({
          desiredIndex: 0,
          host,
          general,
          heldPoint,
          sourceHeading,
          pointerId,
          runId,
          transaction
        });
        if (left.reached) transaction.reachedIndexes.push(0);
        await wait(620);
        const middle = await outlineWheelToNativeIndex({
          desiredIndex: 1,
          host,
          general,
          heldPoint,
          sourceHeading,
          pointerId,
          runId,
          transaction
        });
        if (middle.reached) transaction.reachedIndexes.push(1);
        await wait(1050);
        const right = await outlineWheelToNativeIndex({
          desiredIndex: 2,
          host,
          general,
          heldPoint,
          sourceHeading,
          pointerId,
          runId,
          transaction
        });
        if (right.reached) transaction.reachedIndexes.push(2);
        await wait(820);
        elements().mouse?.classList.remove("scrolling", "horizontal-wheel");

        const functionalJourney =
          left.reached && middle.reached && right.reached &&
          transaction.reachedIndexes.join("|") === "0|1|2";
        tourDebugAssert(
          "outline-nested-native-wheel-indexes-left-middle-right",
          functionalJourney,
          { transaction, left, middle, right }
        );
        const markerStates = [left.state, middle.state, right.state];
        const exactMarkerJourney = markerStates.every((state, index) =>
          state?.markerRect &&
          Math.abs(
            state.markerRect.left + state.markerRect.width * .5 -
            expectedMarkers[index].centerX
          ) <= 3 &&
          Math.abs(state.markerRect.top - expectedMarkers[index].top) <= 3 &&
          Math.abs(state.markerRect.height - expectedMarkers[index].height) <= 3 &&
          Math.abs(state.markerRect.width - expectedMarkers[index].width) <= 1
        );
        tourDebugAssert(
          "outline-nested-native-wheel-left-middle-right",
          functionalJourney && exactMarkerJourney,
          {
            transaction,
            left,
            middle,
            right,
            expectedMarkers,
            diagnosticPolicy: "record-but-never-abort-held-gesture"
          }
        );
        const mouseAfterWheel = teacherMouseCoordinates();
        const ghostAfterWheel = right.state?.ghostRect || null;
        tourDebugAssert(
          "outline-nested-native-pointer-and-ghost-stationary-during-wheel",
          Boolean(
            mouseBeforeWheel && mouseAfterWheel &&
            ghostBeforeWheel && ghostAfterWheel &&
            Math.abs(mouseAfterWheel.x - mouseBeforeWheel.x) < .5 &&
            Math.abs(mouseAfterWheel.y - mouseBeforeWheel.y) < .5 &&
            Math.abs(ghostAfterWheel.left - ghostBeforeWheel.left) < .5 &&
            Math.abs(ghostAfterWheel.top - ghostBeforeWheel.top) < .5
          ),
          {
            mouseBeforeWheel,
            mouseAfterWheel,
            ghostBeforeWheel,
            ghostAfterWheel,
            heldPoint
          }
        );
        tourDebugAssert(
          "outline-nested-native-marker-uses-production-lane-height",
          [left, middle, right].every(item =>
            item.state?.markerRect?.width <= 6 &&
            item.state?.markerRect?.height >= 24
          ),
          {
            left: left.state?.markerRect,
            middle: middle.state?.markerRect,
            right: right.state?.markerRect,
            layout: acquired.sideBySide ? "side-by-side" : "stacked"
          }
        );

        if (!functionalJourney) {
          functionalFailure = "The native wheel handler did not confirm all indexes 0 → 1 → 2 while the same pointer remained held.";
        } else {
          const finalHeldIndex =
            window.RMLBuilderSetupBridge?.setHeldOptionHorizontalIndex?.(
              host,
              2
            ) || null;
          if (
            finalHeldIndex?.accepted !== true ||
            finalHeldIndex?.authoritative !== true ||
            finalHeldIndex.afterIndex !== 2
          ) {
            functionalFailure = "The final native held insertion index was not authoritative before PointerUp.";
          }
          await nextTwoFrames();
        }

        if (!functionalFailure) {
          dispatchNativeSectionPointer(
            host,
            "pointerup",
            heldPoint,
            pointerId,
            { button: 0, buttons: 0 }
          );
          transaction.pointerUps += 1;
          pointerHeld = false;
          released = true;
          elements().mouse?.classList.remove("pressed");
          await nextTwoFrames();
          await wait(520);
        }
      }
    } finally {
      elements().mouse?.classList.remove(
        "pressed",
        "scrolling",
        "horizontal-wheel"
      );
      if (pointerHeld && runId === demoRunId) {
        dispatchNativeSectionPointer(
          sourceHeading,
          "pointercancel",
          acquired?.point || thresholdPoint,
          pointerId,
          { button: 0, buttons: 0 }
        );
        transaction.pointerCancels += 1;
        await nextTwoFrames();
      }
    }

    const releasedControllerCard = [...document.querySelectorAll(
      ".node-card.controller[data-node-id]"
    )].find(card =>
      card.querySelector(":scope > .node-head .node-copy > strong")
        ?.textContent?.trim() === "DisplayMode"
    ) || null;
    const releasedHost = releasedControllerCard?.querySelector(
      ":scope > .controller-options"
    );
    const releasedLanes = directChildrenWithClass(releasedHost, "option-lane");
    const releasedNames = releasedLanes.map(outlineOptionLaneName);
    const releasedGeneral = releasedLanes.find(
      lane => outlineOptionLaneName(lane) === "General"
    );
    const releasedAdvanced = releasedLanes.find(
      lane => outlineOptionLaneName(lane) === "Advanced"
    );
    const nativeReleaseCommitted = tourDebugAssert(
      "outline-nested-native-release-committed-at-far-right",
      released &&
        releasedNames.join("|") === "Advanced|General" &&
        outlineChildNamesMatch(
          outlineOptionDirectChildNames(releasedGeneral),
          ["Enabled", "Scale"]
        ) &&
        outlineChildNamesMatch(
          outlineOptionDirectChildNames(releasedAdvanced),
          ["Quality", "DetailSection"]
        ),
      {
        released,
        releasedNames,
        generalChildren: outlineOptionDirectChildNames(releasedGeneral),
        advancedChildren: outlineOptionDirectChildNames(releasedAdvanced)
      }
    );
    const nativeCleanup = tourDebugAssert(
      "outline-nested-native-drag-cleanup-after-release",
      !document.querySelector(".option-pointer-ghost") &&
        !document.querySelector(".option-pointer-source") &&
        !document.querySelector(".option-reorder-placeholder") &&
        !document.querySelector(".controller-options.option-drag-over") &&
        !document.querySelector(".rml-setup-demo-landing"),
      {
        ghostPresent: Boolean(document.querySelector(".option-pointer-ghost")),
        sourcePresent: Boolean(document.querySelector(".option-pointer-source")),
        markerPresent: Boolean(document.querySelector(".option-reorder-placeholder")),
        hostArmed: Boolean(document.querySelector(".controller-options.option-drag-over"))
      }
    );
    const singleHeldGesture = tourDebugAssert(
      "outline-nested-single-held-gesture-completed-without-restart",
      nativeReleaseCommitted &&
        nativeCleanup &&
        transaction.runId === demoRunId &&
        transaction.pointerDowns === 1 &&
        transaction.pointerUps === 1 &&
        transaction.pointerCancels === 0 &&
        transaction.wheelTransitions.join("|") === "-1|1|1" &&
        transaction.reachedIndexes.join("|") === "0|1|2",
      { transaction, functionalFailure }
    );
    tourDebugRecord("outline-nested-native-transaction-end", {
      transactionId: transaction.id,
      runId,
      completed: singleHeldGesture,
      transaction,
      functionalFailure
    });
    hideMouse();
    if (!singleHeldGesture) {
      const error = new Error(
        `[RML Tour · Step 4] ${functionalFailure || "The live one-gesture transaction did not complete exactly once."}`
      );
      error.details = { transaction };
      throw error;
    }
    return true;
  }

  function outlineNestedVerticalCorridor() {
    const viewport = tourViewport();
    const headerBottom = Math.max(viewport.top, tourHeaderBottom());
    const availableHeight = Math.max(1, viewport.bottom - headerBottom);
    const horizontalInset = Math.min(
      8,
      Math.max(2, viewport.width * .03)
    );
    const topInset = Math.min(
      40,
      Math.max(8, availableHeight * .12)
    );
    const bottomInset = Math.min(
      52,
      Math.max(10, availableHeight * .14)
    );
    const safeTop = Math.min(
      viewport.bottom - 16,
      headerBottom + topInset
    );
    const safeBottom = Math.max(
      safeTop + 12,
      viewport.bottom - bottomInset
    );
    return {
      viewport,
      headerBottom,
      availableHeight,
      horizontalInset,
      safeTop,
      safeBottom
    };
  }

  function outlineNestedVerticalScene() {
    const controllerCard = [...document.querySelectorAll(
      ".node-card.controller[data-node-id]"
    )].find(card =>
      card.querySelector(":scope > .node-head .node-copy > strong")
        ?.textContent?.trim() === "DisplayMode"
    ) || null;
    const controllerHost = controllerCard?.querySelector(
      ":scope > .controller-options"
    );
    const lanes = directChildrenWithClass(controllerHost, "option-lane");
    const general = lanes.find(lane => outlineOptionLaneName(lane) === "General");
    const advanced = lanes.find(lane => outlineOptionLaneName(lane) === "Advanced");
    const sourceHeading = general?.querySelector(":scope > .option-heading");
    const advancedDropZone = advanced?.querySelector(":scope > .drop-zone");
    const advancedCards = directChildrenWithClass(
      advancedDropZone,
      "node-card"
    ).filter(card => !card.classList.contains("node-pointer-ghost"));
    const cardName = card => card?.querySelector(
      ":scope > .node-head .node-copy > strong"
    )?.textContent?.trim() || "";
    const quality = advancedCards.find(card => cardName(card) === "Quality");
    const detailSection = advancedCards.find(
      card => cardName(card) === "DetailSection"
    );

    if (
      !(controllerCard instanceof HTMLElement) ||
      !(controllerHost instanceof HTMLElement) ||
      !(general instanceof HTMLElement) ||
      !(advanced instanceof HTMLElement) ||
      !(sourceHeading instanceof HTMLElement) ||
      !(advancedDropZone instanceof HTMLElement) ||
      !(quality instanceof HTMLElement) ||
      !(detailSection instanceof HTMLElement)
    ) {
      return null;
    }

    const slots = verticalInsertionSlots(advancedDropZone)
      .filter(slot => !verticalSlotCrossesLiveContent(advancedDropZone, slot))
      .sort((left, right) => left.top - right.top);
    const qualityRect = quality.getBoundingClientRect();
    const detailRect = detailSection.getBoundingClientRect();
    const gapCenterY = (qualityRect.bottom + detailRect.top) * .5;
    const middleSlot = slots
      .filter(slot =>
        slot.top >= qualityRect.bottom - 8 &&
        slot.top <= detailRect.top + 8
      )
      .sort((left, right) =>
        Math.abs(left.top - gapCenterY) - Math.abs(right.top - gapCenterY)
      )[0] || null;

    if (!middleSlot || slots.length < 3) return null;

    const corridor = outlineNestedVerticalCorridor();
    const viewport = corridor.viewport;
    const targetFactors = [.22, .32, .5, .68, .78];
    const targetCandidates = targetFactors.map(factor => {
      const rawX = middleSlot.left + middleSlot.width * factor;
      const point = {
        x: Math.max(
          viewport.left + corridor.horizontalInset,
          Math.min(
            viewport.right - corridor.horizontalInset,
            rawX
          )
        ),
        y: middleSlot.top + Math.max(4, middleSlot.height || 4) * .5
      };
      const perception = tourPerceivePoint(
        point,
        controllerCard,
        advancedDropZone
      );
      const top = perception.top;
      const targetDropZone = top?.closest?.(".drop-zone") || null;
      const insideTarget = Boolean(
        top &&
        (top === advancedDropZone || advancedDropZone.contains(top)) &&
        targetDropZone === advancedDropZone
      );
      const blockingControl = top?.closest?.(
        "button, input, select, textarea, [role='button']"
      ) || null;
      const closestCard = top?.closest?.(".node-card") || null;
      const blockingContentCard = Boolean(
        closestCard && advancedDropZone.contains(closestCard)
      );
      const clearOfControl = !blockingControl && !blockingContentCard;
      const visible =
        point.x >= viewport.left + corridor.horizontalInset &&
        point.x <= viewport.right - corridor.horizontalInset &&
        point.y >= corridor.safeTop &&
        point.y <= corridor.safeBottom;
      return {
        point,
        perception,
        insideTarget,
        clearOfControl,
        visible,
        score:
          (insideTarget ? 1000 : 0) +
          (clearOfControl ? 300 : 0) +
          (visible ? 200 : 0) -
          Math.abs(factor - .22) * 10
      };
    }).sort((left, right) => right.score - left.score);
    const target = targetCandidates.find(candidate =>
      candidate.insideTarget &&
      candidate.clearOfControl &&
      candidate.visible
    ) || null;

    return {
      controllerCard,
      controllerHost,
      lanes,
      general,
      advanced,
      sourceHeading,
      advancedDropZone,
      advancedCards,
      quality,
      detailSection,
      slots,
      middleSlot,
      target,
      targetCandidates,
      corridor
    };
  }

  async function frameOutlineNestedVerticalScene(runId) {
    let scene = outlineNestedVerticalScene();
    if (!scene) return null;

    const scroller = document.scrollingElement || document.documentElement;
    for (let attempt = 0; attempt < 4 && runId === demoRunId; attempt += 1) {
      scene = outlineNestedVerticalScene();
      if (!scene) return null;
      const corridor = outlineNestedVerticalCorridor();
      const safeTop = corridor.safeTop;
      const safeBottom = corridor.safeBottom;
      const headingRect = scene.sourceHeading.getBoundingClientRect();
      const firstSlot = scene.slots[0];
      const lastSlot = scene.slots[scene.slots.length - 1];
      const contentTop = Math.min(
        headingRect.top,
        firstSlot.top - 6
      );
      const contentBottom = Math.max(
        headingRect.bottom,
        lastSlot.top + Math.max(4, lastSlot.height || 4) + 6
      );
      const fullyVisible =
        contentTop >= safeTop &&
        contentBottom <= safeBottom &&
        scene.target?.visible === true;
      if (fullyVisible) {
        return {
          ...scene,
          framed: true,
          jointFrame: true,
          stagedFrame: false,
          attempts: attempt
        };
      }

      const safeHeight = Math.max(1, safeBottom - safeTop);
      const contentHeight = Math.max(1, contentBottom - contentTop);
      let delta;
      if (contentHeight <= safeHeight) {
        delta = contentTop < safeTop
          ? contentTop - safeTop
          : contentBottom > safeBottom
            ? contentBottom - safeBottom
            : 0;
      } else {
        const contentCenter = (contentTop + contentBottom) * .5;
        const safeCenter = (safeTop + safeBottom) * .5;
        delta = contentCenter - safeCenter;
      }
      const maximumTop = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight
      );
      const nextTop = Math.max(
        0,
        Math.min(maximumTop, scroller.scrollTop + delta)
      );
      if (Math.abs(nextTop - scroller.scrollTop) < .5) break;
      scroller.scrollTop = nextTop;
      await nextTwoFrames();
      await wait(120);
    }

    scene = outlineNestedVerticalScene();
    if (!scene) return null;
    const corridor = outlineNestedVerticalCorridor();
    const viewport = corridor.viewport;
    const headingRect = scene.sourceHeading.getBoundingClientRect();
    const allSlotsVisible = scene.slots.every(slot =>
      slot.top >= corridor.safeTop &&
      slot.top + Math.max(4, slot.height || 4) <= corridor.safeBottom
    );
    let sourceHit = tourVisibleHitPoint(scene.sourceHeading, 1);
    const sourceVisible = Boolean(sourceHit);
    const jointFrame = Boolean(
      scene.target?.visible === true &&
      sourceVisible &&
      allSlotsVisible
    );
    if (!jointFrame && !sourceVisible && runId === demoRunId) {
      const scroller = document.scrollingElement || document.documentElement;
      const openingTop = Math.min(
        corridor.safeBottom - 18,
        corridor.headerBottom + Math.min(
          36,
          Math.max(12, corridor.availableHeight * .18)
        )
      );
      const desiredHeadingCenter = Math.max(
        corridor.headerBottom + 8,
        openingTop
      );
      const maximumTop = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight
      );
      const desiredTop = Math.max(
        0,
        Math.min(
          maximumTop,
          scroller.scrollTop +
            headingRect.top + headingRect.height * .5 -
            desiredHeadingCenter
        )
      );
      await animateTourPageScroll(
        desiredTop,
        TOUR_SCROLL_TIMING.pageScrollDuration,
        runId
      );
      if (runId !== demoRunId) return null;
      await nextTwoFrames();
      scene = outlineNestedVerticalScene();
      sourceHit = scene?.sourceHeading
        ? tourVisibleHitPoint(scene.sourceHeading, 1)
        : null;
      const recoveredSourceVisible = Boolean(sourceHit);
      return scene
        ? {
            ...scene,
            framed: recoveredSourceVisible,
            jointFrame: false,
            stagedFrame: recoveredSourceVisible,
            sourceHitPoint: sourceHit?.point || null,
            attempts: 5
          }
        : null;
    }
    return {
      ...scene,
      framed: jointFrame || sourceVisible,
      jointFrame,
      stagedFrame: !jointFrame && sourceVisible,
      sourceHitPoint: sourceHit?.point || null,
      attempts: 4
    };
  }

  async function revealOutlineNestedVerticalTargetWhileHeld(runId) {
    const scroller = document.scrollingElement || document.documentElement;
    let lastScene = outlineNestedVerticalScene();
    const attempts = [];

    for (let attempt = 0; attempt < 5 && runId === demoRunId; attempt += 1) {
      const scene = outlineNestedVerticalScene();
      if (!scene) return { scene: null, revealed: false, attempts };
      lastScene = scene;
      if (scene.target?.visible === true) {
        return { scene, revealed: true, attempts };
      }

      const corridor = outlineNestedVerticalCorridor();
      const safeTop = corridor.safeTop;
      const safeBottom = corridor.safeBottom;
      const safeHeight = Math.max(1, safeBottom - safeTop);
      const firstSlot = scene.slots[0];
      const lastSlot = scene.slots[scene.slots.length - 1];
      const slotTop = firstSlot.top - 8;
      const slotBottom =
        lastSlot.top + Math.max(4, lastSlot.height || 4) + 8;
      const slotHeight = Math.max(1, slotBottom - slotTop);
      const middleY =
        scene.middleSlot.top +
        Math.max(4, scene.middleSlot.height || 4) * .5;
      const desiredCenter = slotHeight <= safeHeight
        ? safeTop + safeHeight * .5
        : safeTop + safeHeight * .58;
      const currentCenter = slotHeight <= safeHeight
        ? (slotTop + slotBottom) * .5
        : middleY;
      const maximumTop = Math.max(
        0,
        scroller.scrollHeight - scroller.clientHeight
      );
      const desiredTop = Math.max(
        0,
        Math.min(maximumTop, scroller.scrollTop + currentCenter - desiredCenter)
      );
      attempts.push({
        attempt,
        beforeTop: scroller.scrollTop,
        desiredTop,
        slotHeight,
        safeHeight,
        middleY
      });
      if (Math.abs(desiredTop - scroller.scrollTop) <= .5) break;

      elements().mouse?.classList.remove(
        "scrolling",
        "horizontal-wheel"
      );
      await animateTourPageScroll(
        desiredTop,
        TOUR_SCROLL_TIMING.pageScrollDuration,
        runId
      );
      if (runId !== demoRunId) {
        return { scene: lastScene, revealed: false, attempts };
      }
      await nextTwoFrames();
    }

    lastScene = outlineNestedVerticalScene();
    return {
      scene: lastScene,
      revealed: lastScene?.target?.visible === true,
      attempts
    };
  }

  function outlineNestedVerticalNativeState(scene, heldPoint) {
    const ghost = document.querySelector("body > .option-pointer-ghost");
    const marker = scene?.advancedDropZone?.querySelector(
      ":scope > .drag-reorder-placeholder"
    );
    const markerRect = marker instanceof HTMLElement
      ? marker.getBoundingClientRect()
      : null;
    const ghostRect = ghost instanceof HTMLElement
      ? ghost.getBoundingClientRect()
      : null;
    const sourceStyle = scene?.general instanceof HTMLElement
      ? getComputedStyle(scene.general)
      : null;
    const ghostStyle = ghost instanceof HTMLElement
      ? getComputedStyle(ghost)
      : null;
    const markerBeforeContent = marker instanceof HTMLElement
      ? getComputedStyle(marker, "::before").content
      : "";
    const markerAfterContent = marker instanceof HTMLElement
      ? getComputedStyle(marker, "::after").content
      : "";
    return {
      ghost,
      marker,
      markerRect: markerRect
        ? {
            left: markerRect.left,
            right: markerRect.right,
            top: markerRect.top,
            bottom: markerRect.bottom,
            width: markerRect.width,
            height: markerRect.height
          }
        : null,
      ghostRect: ghostRect
        ? {
            left: ghostRect.left,
            right: ghostRect.right,
            top: ghostRect.top,
            bottom: ghostRect.bottom,
            width: ghostRect.width,
            height: ghostRect.height
          }
        : null,
      sourceOpacity: Number.parseFloat(sourceStyle?.opacity || "1"),
      ghostOpacity: Number.parseFloat(ghostStyle?.opacity || "0"),
      mousePoint: teacherMouseCoordinates(),
      heldPoint: heldPoint ? { ...heldPoint } : null,
      markerBeforeContent,
      markerAfterContent,
      tourLandingGuideCount: document.querySelectorAll(
        ".rml-setup-demo-landing"
      ).length
    };
  }

  async function outlineNestedWheelToVerticalIndex({
    desiredIndex,
    scene,
    heldPoint,
    pointerId,
    runId,
    trace
  }) {
    let liveScene = scene;
    const perceivedScene = outlineNestedVerticalScene();
    if (perceivedScene?.advancedDropZone) liveScene = perceivedScene;
    const before =
      window.RMLBuilderSetupBridge?.inspectHeldOptionContainer?.(
        liveScene.advancedDropZone
      ) || null;
    const previousIndex = Number.isFinite(before?.index)
      ? before.index
      : 1;
    const direction = Math.sign(desiredIndex - previousIndex);
    const consumed = direction
      ? dispatchNativeHeldSectionWheel(
          liveScene.advancedDropZone,
          heldPoint,
          direction
        )
      : true;
    await wait(140);
    const exactSet =
      window.RMLBuilderSetupBridge?.setHeldOptionContainerIndex?.(
        liveScene.advancedDropZone,
        desiredIndex
      ) || null;
    const reached = Boolean(
      exactSet?.accepted === true &&
      exactSet?.authoritative === true &&
      exactSet.afterIndex === desiredIndex
    );
    await nextTwoFrames();
    const refreshedScene = outlineNestedVerticalScene();
    if (refreshedScene?.advancedDropZone) liveScene = refreshedScene;
    const inspection =
      window.RMLBuilderSetupBridge?.inspectHeldOptionContainer?.(
        liveScene.advancedDropZone
      ) || null;
    const safety = nativeVerticalReleaseMarkerSafety(
      liveScene.advancedDropZone,
      liveScene.slots[desiredIndex]
    );
    const state = outlineNestedVerticalNativeState(liveScene, heldPoint);
    trace.push({
      desiredIndex,
      before,
      direction,
      consumed,
      exactSet,
      after: inspection,
      safety,
      state
    });
    return {
      reached,
      inspection,
      safety,
      state,
      scene: liveScene
    };
  }

  async function armOutlineNestedVerticalTarget({
    scene,
    heldPoint,
    pointerId,
    runId
  }) {
    let liveScene = scene;
    let last = null;
    const attempts = [];
    let stableFrames = 0;
    let stableHost = null;
    for (let attempt = 0; attempt < 20 && runId === demoRunId; attempt += 1) {
      const perceivedScene = outlineNestedVerticalScene();
      if (perceivedScene?.target) {
        liveScene = perceivedScene;
        heldPoint.x = perceivedScene.target.point.x;
        heldPoint.y = perceivedScene.target.point.y;
      }
      dispatchNativeSectionPointer(
        liveScene.sourceHeading,
        "pointermove",
        heldPoint,
        pointerId
      );
      const armed = window.RMLBuilderSetupBridge?.armHeldOptionContainer?.(
        liveScene.advancedDropZone,
        heldPoint.x,
        heldPoint.y
      ) || null;
      await waitForAnimationFrames(1);

      const postFrameScene = outlineNestedVerticalScene();
      if (postFrameScene?.target) {
        liveScene = postFrameScene;
      }
      const inspection = window.RMLBuilderSetupBridge
        ?.inspectHeldOptionContainer?.(
          liveScene.advancedDropZone
        ) || null;
      const middleSlot = liveScene.middleSlot;
      const safety = nativeVerticalReleaseMarkerSafety(
        liveScene.advancedDropZone,
        middleSlot
      );
      const state = outlineNestedVerticalNativeState(
        liveScene,
        heldPoint
      );
      last = {
        scene: liveScene,
        heldPoint: { ...heldPoint },
        armed,
        inspection,
        safety,
        state
      };
      attempts.push({
        attempt,
        heldPoint: { ...heldPoint },
        armed,
        inspection,
        safety: {
          safe: safety.safe,
          reason: safety.reason,
          hostMatched: safety.hostMatched,
          centerMatched: safety.centerMatched,
          withinViewport: safety.withinViewport,
          markerRect: safety.markerRect
        },
        hostConnected: liveScene.advancedDropZone.isConnected
      });
      const framePassed = Boolean(
        armed?.accepted === true &&
        armed.index === 1 &&
        inspection?.accepted === true &&
        inspection.index === 1 &&
        safety.safe === true &&
        state.ghost instanceof HTMLElement &&
        state.marker instanceof HTMLElement
      );
      if (framePassed) {
        stableFrames = stableHost === liveScene.advancedDropZone
          ? stableFrames + 1
          : 1;
        stableHost = liveScene.advancedDropZone;
        if (stableFrames >= 2) {
          return { ...last, passed: true, stableFrames, attempts };
        }
      } else {
        stableFrames = 0;
        stableHost = null;
      }
      await nextTwoFrames();
    }
    return { ...last, passed: false, stableFrames, attempts };
  }

  async function runOutlineVerticalAfterBuild259Horizontal(runId) {
    let scene = await frameOutlineNestedVerticalScene(runId);
    if (runId !== demoRunId) return false;

    const prepared = tourDebugAssert(
      "outline-nested-vertical-same-general-section-reacquired",
      Boolean(
        scene?.framed === true &&
        scene.lanes.map(outlineOptionLaneName).join("|") === "Advanced|General" &&
        outlineChildNamesMatch(
          outlineOptionDirectChildNames(scene.general),
          ["Enabled", "Scale"]
        ) &&
        outlineChildNamesMatch(
          outlineOptionDirectChildNames(scene.advanced),
          ["Quality", "DetailSection"]
        )
      ),
      {
        framed: scene?.framed === true,
        frameAttempts: scene?.attempts ?? null,
        laneNames: scene?.lanes?.map(outlineOptionLaneName) || [],
        generalChildren: outlineOptionDirectChildNames(scene?.general),
        advancedChildren: outlineOptionDirectChildNames(scene?.advanced)
      }
    );
    const arrowGapResolved = tourDebugAssert(
      "outline-nested-vertical-live-arrow-gap-resolved",
      Boolean(
        prepared &&
        (
          scene?.jointFrame === true
            ? (
                scene?.target?.insideTarget === true &&
                scene.target.clearOfControl === true &&
                scene.target.visible === true
              )
            : scene?.stagedFrame === true
        ) &&
        scene.slots.indexOf(scene.middleSlot) === 1
      ),
      {
        jointFrame: scene?.jointFrame === true,
        stagedFrame: scene?.stagedFrame === true,
        target: scene?.target || null,
        middleSlot: scene?.middleSlot || null,
        slots: scene?.slots || [],
        candidates: scene?.targetCandidates || []
      }
    );
    if (!prepared || !arrowGapResolved) {
      throw new Error(
        "[RML Tour · Step 4] Live perception could not frame either the complete gesture or its visible General-first mobile opening."
      );
    }

    const stagedSourceHitPoint = scene.sourceHitPoint
      ? { ...scene.sourceHitPoint }
      : null;

    releaseSemanticScene();
    document.querySelectorAll("[data-setup-shade]").forEach(
      shade => shade.style.display = "none"
    );
    document.querySelectorAll(".rml-setup-demo-landing").forEach(
      guide => guide.remove()
    );
    if (elements().demoLabel) elements().demoLabel.hidden = true;

    scene = outlineNestedVerticalScene();
    if (!scene?.sourceHeading) {
      throw new Error(
        "[RML Tour · Step 4] The live General source changed before PointerDown."
      );
    }
    const visibleHeadingHit =
      tourVisibleHitPoint(scene.sourceHeading, 1)?.point ||
      stagedSourceHitPoint ||
      null;
    if (!visibleHeadingHit) {
      throw new Error(
        "[RML Tour · Step 4] The staged General drag handle was not visibly hit-testable before PointerDown."
      );
    }
    const startPoint = { ...visibleHeadingHit };
    const viewportAtPointerDown = tourViewport();
    const thresholdOffset =
      startPoint.x + 8 <= viewportAtPointerDown.right - 2
        ? 8
        : -8;
    const thresholdPoint = {
      x: startPoint.x + thresholdOffset,
      y: startPoint.y
    };
    let heldPoint = scene.target?.point
      ? { ...scene.target.point }
      : null;
    const pointerId = 9242;
    let pointerHeld = false;
    let completed = false;
    const trace = [];

    try {
      if (!(await moveMouse(startPoint, 460, runId))) return false;
      dispatchNativeSectionPointer(
        scene.sourceHeading,
        "pointerdown",
        startPoint,
        pointerId
      );
      pointerHeld = true;
      elements().mouse?.classList.add("active", "pressed");
      if (!(await animateNativeHeldSectionPointer(
        scene.sourceHeading,
        startPoint,
        thresholdPoint,
        180,
        pointerId,
        runId
      ))) return false;
      if (!heldPoint) {
        const viewport = tourViewport();
        const edgeInset = Math.min(
          68,
          Math.max(28, viewport.height * .14)
        );
        const edgePoint = {
          x: Math.max(
            viewport.left + 28,
            Math.min(
              viewport.right - 28,
              scene.middleSlot.left + scene.middleSlot.width * .22
            )
          ),
          y: viewport.bottom - edgeInset
        };
        if (!(await animateNativeHeldSectionPointer(
          scene.sourceHeading,
          thresholdPoint,
          edgePoint,
          720,
          pointerId,
          runId
        ))) return false;
        heldPoint = { ...edgePoint };
        elements().mouse?.classList.remove(
          "scrolling",
          "horizontal-wheel"
        );
        const revealed = await revealOutlineNestedVerticalTargetWhileHeld(
          runId
        );
        if (runId !== demoRunId) return false;
        scene = revealed.scene || scene;
        if (!revealed.revealed || !scene?.target) {
          const error = new Error(
            "[RML Tour · Step 4] The held mobile drag could not reveal the real Quality/DetailSection insertion gap."
          );
          error.details = { revealAttempts: revealed.attempts };
          throw error;
        }
        heldPoint = { ...scene.target.point };
        if (!(await animateNativeHeldSectionPointer(
          scene.sourceHeading,
          edgePoint,
          heldPoint,
          680,
          pointerId,
          runId
        ))) return false;
      } else {
        const halfwayPoint = {
          x: startPoint.x + (heldPoint.x - startPoint.x) * .58,
          y: startPoint.y + (heldPoint.y - startPoint.y) * .58
        };
        if (!(await animateNativeHeldSectionPointer(
          scene.sourceHeading,
          thresholdPoint,
          halfwayPoint,
          620,
          pointerId,
          runId
        ))) return false;
        if (!(await animateNativeHeldSectionPointer(
          scene.sourceHeading,
          halfwayPoint,
          heldPoint,
          680,
          pointerId,
          runId
        ))) return false;
      }

      const armedTarget = await armOutlineNestedVerticalTarget({
        scene,
        heldPoint,
        pointerId,
        runId
      });
      if (runId !== demoRunId) return false;
      scene = armedTarget.scene || scene;
      heldPoint.x = armedTarget.heldPoint?.x ?? heldPoint.x;
      heldPoint.y = armedTarget.heldPoint?.y ?? heldPoint.y;
      const armed = armedTarget.armed;
      const initialInspection = armedTarget.inspection;
      const initialSafety = armedTarget.safety;
      const initialState = armedTarget.state;
      const nativeTargetArmed = tourDebugAssert(
        "outline-nested-vertical-native-arrow-target-armed",
        Boolean(
          armedTarget.passed === true &&
          armed?.accepted === true &&
          initialInspection?.accepted === true &&
          initialInspection.index === 1 &&
          initialSafety.safe &&
          initialState.ghost instanceof HTMLElement &&
          initialState.marker instanceof HTMLElement &&
          initialState.tourLandingGuideCount === 0
        ),
        {
          armed,
          initialInspection,
          initialSafety,
          initialState,
          stabilizationAttempts: armedTarget.attempts
        }
      );
      if (!nativeTargetArmed) {
        throw new Error(
          "[RML Tour · Step 4] The native vertical line was not armed in the live arrow gap."
        );
      }

      const mouseBeforeWheel = teacherMouseCoordinates();
      const ghostBeforeWheel = initialState.ghostRect;
      elements().mouse?.classList.add("scrolling");
      const down = await outlineNestedWheelToVerticalIndex({
        desiredIndex: 2,
        scene,
        heldPoint,
        pointerId,
        runId,
        trace
      });
      scene = down.scene || scene;
      await wait(620);
      const middleFromBelow = await outlineNestedWheelToVerticalIndex({
        desiredIndex: 1,
        scene,
        heldPoint,
        pointerId,
        runId,
        trace
      });
      scene = middleFromBelow.scene || scene;
      await wait(720);
      const up = await outlineNestedWheelToVerticalIndex({
        desiredIndex: 0,
        scene,
        heldPoint,
        pointerId,
        runId,
        trace
      });
      scene = up.scene || scene;
      await wait(620);
      const middleFromAbove = await outlineNestedWheelToVerticalIndex({
        desiredIndex: 1,
        scene,
        heldPoint,
        pointerId,
        runId,
        trace
      });
      scene = middleFromAbove.scene || scene;
      await wait(820);
      elements().mouse?.classList.remove("scrolling");

      const finalState = outlineNestedVerticalNativeState(scene, heldPoint);
      const mouseAfterWheel = teacherMouseCoordinates();
      const journeyComplete = tourDebugAssert(
        "outline-nested-vertical-native-wheel-down-middle-up-middle",
        Boolean(
          down.reached &&
          middleFromBelow.reached &&
          up.reached &&
          middleFromAbove.reached
        ),
        { trace, down, middleFromBelow, up, middleFromAbove }
      );
      const pointerStationary = tourDebugAssert(
        "outline-nested-vertical-pointer-stationary-during-wheel",
        Boolean(
          mouseBeforeWheel &&
          mouseAfterWheel &&
          Math.abs(mouseAfterWheel.x - mouseBeforeWheel.x) < .5 &&
          Math.abs(mouseAfterWheel.y - mouseBeforeWheel.y) < .5
        ),
        {
          heldPoint,
          mouseBeforeWheel,
          mouseAfterWheel,
          ghostBeforeWheel,
          ghostAfterWheel: finalState.ghostRect
        }
      );
      const settledVerticalStates = [
        down,
        middleFromBelow,
        up,
        middleFromAbove
      ];
      const nativeLineSafe = tourDebugAssert(
        "outline-nested-vertical-native-lines-card-free-without-endpoints",
        Boolean(
          settledVerticalStates.every(item =>
            item.safety?.safe === true &&
            item.state?.markerRect?.width >=
              item.state?.markerRect?.height &&
            ["none", "normal", "\"\""].includes(
              item.state?.markerBeforeContent
            ) &&
            ["none", "normal", "\"\""].includes(
              item.state?.markerAfterContent
            ) &&
            item.state?.tourLandingGuideCount === 0
          )
        ),
        {
          trace,
          settledVerticalStates,
          policy:
            "only the four visibly settled wheel positions are contractual; transient animation frames remain diagnostic"
        }
      );

      completed = journeyComplete;
      if (!completed) {
        const error = new Error(
          "[RML Tour · Step 4] The production drag state did not accept all four exact vertical insertion indexes."
        );
        error.details = {
          journeyComplete,
          pointerStationary,
          nativeLineSafe,
          settledVerticalStates,
          trace
        };
        throw error;
      }

      dispatchNativeSectionPointer(
        scene.advancedDropZone,
        "pointercancel",
        heldPoint,
        pointerId,
        { button: 0, buttons: 0 }
      );
      pointerHeld = false;
      elements().mouse?.classList.remove("pressed");
      await nextTwoFrames();
      await wait(360);
    } finally {
      elements().mouse?.classList.remove(
        "pressed",
        "scrolling",
        "horizontal-wheel"
      );
      if (pointerHeld && runId === demoRunId) {
        dispatchNativeSectionPointer(
          scene?.sourceHeading || document,
          "pointercancel",
          heldPoint || thresholdPoint || startPoint,
          pointerId,
          { button: 0, buttons: 0 }
        );
        await nextTwoFrames();
      }
    }

    const restoredScene = outlineNestedVerticalScene();
    const cleanup = tourDebugAssert(
      "outline-nested-vertical-native-cleanup-and-reference-preserved",
      Boolean(
        completed &&
        restoredScene &&
        restoredScene.lanes.map(outlineOptionLaneName).join("|") ===
          "Advanced|General" &&
        outlineChildNamesMatch(
          outlineOptionDirectChildNames(restoredScene.general),
          ["Enabled", "Scale"]
        ) &&
        outlineChildNamesMatch(
          outlineOptionDirectChildNames(restoredScene.advanced),
          ["Quality", "DetailSection"]
        ) &&
        !document.querySelector(".option-pointer-ghost") &&
        !document.querySelector(".option-pointer-source") &&
        !document.querySelector(".drag-reorder-placeholder") &&
        !document.querySelector(".rml-setup-demo-landing")
      ),
      {
        completed,
        laneNames: restoredScene?.lanes?.map(outlineOptionLaneName) || [],
        generalChildren: outlineOptionDirectChildNames(restoredScene?.general),
        advancedChildren: outlineOptionDirectChildNames(restoredScene?.advanced),
        ghostPresent: Boolean(document.querySelector(".option-pointer-ghost")),
        sourcePresent: Boolean(document.querySelector(".option-pointer-source")),
        markerPresent: Boolean(document.querySelector(".drag-reorder-placeholder"))
      }
    );
    const complete = tourDebugAssert(
      "outline-nested-build-259-horizontal-then-vertical-complete",
      completed && cleanup,
      { completed, cleanup }
    );
    hideMouse();
    if (!complete) {
      throw new Error(
        "[RML Tour · Step 4] The vertical follow-up did not finish cleanly after the untouched Build 259 horizontal gesture."
      );
    }
    return true;
  }

  async function runOutlineBuild259HorizontalThenVertical(runId) {
    const horizontalComplete = await runOutlineNativeSectionWheelDemoSeeing(
      runId
    );
    if (!horizontalComplete || runId !== demoRunId) return false;
    return runOutlineVerticalAfterBuild259Horizontal(runId);
  }

  async function runOutlineNestedDemo(runId) {
    const html = document.documentElement;
    html.classList.add("rml-setup-drag-scroll-live");
    try {
    const controllerCard = [...document.querySelectorAll(
      ".node-card.controller[data-node-id]"
    )].find(card => {
      const host = card.querySelector(":scope > .controller-options");
      return directChildrenWithClass(host, "option-lane").length >= 2;
    });
    const controllerId = controllerCard?.dataset.nodeId || "";
    const sectionHost = controllerCard?.querySelector(
      ":scope > .controller-options"
    );
    const sectionLanes = directChildrenWithClass(sectionHost, "option-lane");
    const source =
      sectionLanes[0]?.querySelector(".node-card.setting[data-node-id]") ||
      document.querySelector(".node-card.setting[data-node-id]");
    const targetLane = sectionLanes[1] || sectionLanes[0];

    if (!source || !targetLane || !sectionHost) {
      throw new Error(
        "[RML Tour · Step 4] The prepared nested Outline scene is unavailable."
      );
    }

    await nativeTourScrollTargetIntoView(targetLane, runId);
    if (runId !== demoRunId) return;

    const dropZone = targetLane.querySelector(":scope > .drop-zone") || targetLane;
    const from = centerOf(source, .42, .36);
    const pageScroller = document.scrollingElement || document.documentElement;
    const maximumTop = Math.max(
      0,
      pageScroller.scrollHeight - pageScroller.clientHeight
    );
    const beforeVerticalScroll = pageScroller.scrollTop;
    const verticalDirection = beforeVerticalScroll < maximumTop - 56 ? 1 : -1;
    const verticalScrollCap = verticalDirection > 0
      ? Math.min(maximumTop, beforeVerticalScroll + 112)
      : Math.max(0, beforeVerticalScroll - 112);
    const viewport = tourViewport();
    const edgePoint = {
      x: Math.max(
        dropZone.getBoundingClientRect().left + 34,
        Math.min(dropZone.getBoundingClientRect().right - 34, from.x + 74)
      ),
      y: verticalDirection > 0
        ? viewport.bottom - 28
        : tourHeaderBottom() + 28
    };
    const edgeStage = {
      left: Math.max(8, dropZone.getBoundingClientRect().left + 8),
      right: Math.min(viewport.right - 8, dropZone.getBoundingClientRect().right - 8),
      top: verticalDirection > 0 ? edgePoint.y - 44 : edgePoint.y - 8,
      bottom: verticalDirection > 0 ? edgePoint.y + 8 : edgePoint.y + 44
    };
    let lastForcedWheelAt = -Infinity;
    let nestedMarkerSampleCount = 0;
    let nestedUnsafeMarkerSampleCount = 0;
    const nestedMarkerConstraintProofs = [];

    showDemoLabel(
      "DRAG 1/2 · Keep the real setting held at the vertical edge: page and insertion target visibly move together",
      from
    );
    const verticalDragCompleted = await nativeUserPointerDrag(
      source,
      edgePoint,
      1450,
      runId,
      9204,
      {
        startPoint: from,
        pathPoints: [
          { x: edgePoint.x, y: from.y },
          { x: edgePoint.x, y: from.y + (edgePoint.y - from.y) * .58 }
        ],
        stageFocusTarget: controllerCard,
        stageTarget: edgeStage,
        stageLabel: verticalDirection > 0
          ? "VERTICAL DRAG-SCROLL · LOWER EDGE"
          : "VERTICAL DRAG-SCROLL · UPPER EDGE",
        edgeHoldMs: 2100,
        edgeHoldMinMs: 620,
        onEdgeHoldStart: () => {
          elements().mouse?.classList.add("scrolling");
          tourDebugRecord("outline-nested-vertical-hold-start", {
            direction: verticalDirection,
            from: beforeVerticalScroll,
            maximumTop
          });
          showDemoLabel(
            verticalDirection > 0
              ? "STILL HOLDING · Native lower-edge drag-scroll moves the Outline upward beneath the held card"
              : "STILL HOLDING · Native upper-edge drag-scroll moves the Outline downward beneath the held card",
            edgePoint
          );
        },
        onEdgeHoldFrame: ({ point, elapsed }) => {
          const moved = Math.abs(pageScroller.scrollTop - beforeVerticalScroll);
          if (moved > 112) {
            pageScroller.scrollTop = verticalScrollCap;
          }
          if (
            moved < 56 &&
            elapsed - lastForcedWheelAt >= 180 &&
            maximumTop > 1
          ) {
            lastForcedWheelAt = elapsed;
            const wheelTarget = document.elementFromPoint(point.x, point.y) || dropZone;
            dispatchTourWheel(wheelTarget, {
              deltaY: verticalDirection * 58
            });
          }
        },
        onEdgeHoldEnd: () => elements().mouse?.classList.remove("scrolling"),
        onPointerMarkerSample: sample => {
          if (!sample?.geometry) return;
          nestedMarkerSampleCount += 1;
          if (sample.clearOfControls !== true) {
            nestedUnsafeMarkerSampleCount += 1;
            const proof = outlineMarkerCorridorProof(
              sample.host,
              sample.geometry
            );
            if (proof) nestedMarkerConstraintProofs.push(proof);
          }
        },
        edgeHoldUntil: () =>
          Math.abs(pageScroller.scrollTop - beforeVerticalScroll) >= 80,
        afterEdgeHold: async heldPoint => {
          await nextTwoFrames();
          const liveCard = controllerId
            ? document.querySelector(
                `.node-card.controller[data-node-id="${CSS.escape(controllerId)}"]`
              )
            : controllerCard;
          const liveLanes = directChildrenWithClass(
            liveCard?.querySelector(":scope > .controller-options"),
            "option-lane"
          );
          const liveLane = liveLanes[1] || liveLanes[0] || targetLane;
          const liveDropZone = liveLane?.querySelector(":scope > .drop-zone") || liveLane || dropZone;
          const visibleTop = tourHeaderBottom() + 44;
          const visibleBottom = tourViewport().bottom - 56;
          const nestedSlots = verticalInsertionSlots(liveDropZone)
            .filter(slot =>
              slot.top >= visibleTop &&
              slot.top <= visibleBottom &&
              !verticalSlotCrossesLiveContent(liveDropZone, slot)
            );
          const nestedSlot =
            nestedSlots[Math.min(1, nestedSlots.length - 1)] ||
            nestedSlots[0];
          if (!nestedSlot) {
            throw new Error(
              "[RML Tour · Step 4] No visible card-free nested insertion line remained after vertical drag-scroll."
            );
          }
          const point = nestedSlot
            ? { x: nestedSlot.left + nestedSlot.width * .55, y: nestedSlot.top }
            : centerOf(liveDropZone, .55, .55);
          showLandingGuide(
            nestedSlot || {
              left: point.x - 80,
              top: point.y - 2,
              width: 160,
              height: 4,
              orientation: "horizontal"
            },
            "Nested insertion position after vertical drag-scroll"
          );
          return {
            point,
            pathPoints: [{ x: heldPoint.x, y: point.y }],
            duration: 960,
            stageTarget: nestedSlot || tourPointRect(point, 46),
            stageLabel: "NESTED SECTION · LIVE INSERTION"
          };
        },
        commitHoldMs: 520
      }
    );
    elements().mouse?.classList.remove("scrolling");
    if (runId !== demoRunId) return;
    const verticalDelta = pageScroller.scrollTop - beforeVerticalScroll;
    const verticalVerified = tourDebugAssert(
      "outline-nested-visible-vertical-drag-scroll",
      verticalDragCompleted && Math.abs(verticalDelta) >= 32,
      {
        completed: verticalDragCompleted,
        from: beforeVerticalScroll,
        to: pageScroller.scrollTop,
        delta: verticalDelta,
        maximumTop
      }
    );
    if (!verticalVerified) {
      throw new Error(
        "[RML Tour · Step 4] The vertical held drag produced no observable document-scroll vector."
      );
    }
    const nestedMarkerTrajectorySafe = tourDebugAssert(
      "outline-nested-native-line-never-crossed-controls",
      nestedMarkerSampleCount >= 1 &&
        nestedUnsafeMarkerSampleCount === 0,
      {
        sampleCount: nestedMarkerSampleCount,
        unsafeSampleCount: nestedUnsafeMarkerSampleCount,
        constraintProofs: nestedMarkerConstraintProofs,
        behavior:
          "overlapping responsive rows have no insertion geometry, so the native line skips cards and move buttons"
      }
    );
    if (!nestedMarkerTrajectorySafe) {
      throw new Error(
        "[RML Tour · Step 4] The native nested insertion line crossed live card controls."
      );
    }
    tourDebugRecord("outline-nested-vertical-hold-end", {
      completed: verticalDragCompleted,
      delta: verticalDelta
    });
    pulseAt(dropZone, "rml-setup-demo-drop");
    showDemoLabel(
      "DRAG 1/2 COMPLETE · The real nested result is visible before the second gesture starts",
      centerOf(targetLane)
    );
    await wait(760);

    const refreshedCard = controllerId
      ? document.querySelector(
          `.node-card.controller[data-node-id="${CSS.escape(controllerId)}"]`
        )
      : null;
    const refreshedHost = refreshedCard?.querySelector(
      ":scope > .controller-options"
    );
    const refreshedLanes = directChildrenWithClass(
      refreshedHost,
      "option-lane"
    );

    if (!refreshedHost || refreshedLanes.length < 2 || runId !== demoRunId) {
      tourDebugAssert(
        "outline-nested-horizontal-first-move",
        false,
        { reason: "The live section lanes were unavailable after the vertical drop." }
      );
      tourDebugAssert(
        "outline-nested-horizontal-return-move",
        false,
        { reason: "The return move could not start without two live section lanes." }
      );
      showDemoLabel(
        "The second section gesture could not start because its live lanes are unavailable",
        centerOf(controllerCard || targetLane)
      );
      await wait(900);
      hideMouse();
      throw new Error(
        "[RML Tour · Step 4] The native Outline re-render did not provide two live section lanes."
      );
    }

    const draggedLane = refreshedLanes[1];
    const heading = draggedLane.querySelector(":scope > .option-heading");
    const start = centerOf(heading || draggedLane, .28, .5);
    const slots = horizontalSectionSlots(refreshedHost);
    const initialSlot = slots[Math.min(1, slots.length - 1)] || slots[0];

    if (initialSlot) {
      const headingBottom = Math.max(
        ...refreshedLanes.map(lane =>
          lane.querySelector(
            ":scope > .option-heading"
          )?.getBoundingClientRect?.().bottom || -Infinity
        )
      );
      const bodyBandSafe = tourDebugAssert(
        "outline-nested-horizontal-marker-kept-in-enum-body",
        Number.isFinite(headingBottom) &&
          initialSlot.top >= headingBottom - 2 &&
          initialSlot.height >= 24,
        {
          headingBottom,
          markerBand: initialSlot,
          behavior:
            "the horizontal wheel marker stays below every Enum heading and its move buttons"
        }
      );
      if (!bodyBandSafe) {
        throw new Error(
          "[RML Tour · Step 4] The horizontal marker band overlaps the Enum heading controls."
        );
      }
      const point = {
        x: initialSlot.left + initialSlot.width * .5,
        y: initialSlot.top + initialSlot.height * .48
      };
      showLandingGuide(initialSlot, "Horizontal section lane");
      showDemoLabel(
        "DRAG 2/2 · Grab the complete Advanced section; its full real ghost remains attached to the mouse",
        start
      );
      let horizontalDragCompleted = false;
      document.documentElement.classList.add(
        "rml-setup-horizontal-option-gesture"
      );
      try {
        horizontalDragCompleted = await nativeUserPointerDrag(
        draggedLane,
        point,
        1250,
        runId,
        9205,
        {
          startPoint: start,
          pathPoints: [
            { x: start.x + (point.x - start.x) * .42, y: start.y },
            { x: point.x, y: point.y }
          ],
          stageFocusTarget: refreshedCard || refreshedHost,
          stageTarget: initialSlot,
          stageLabel: "HORIZONTAL SECTION LANES · HOLD + WHEEL",
          onBeforeRelease: async ({ point: heldPoint, dispatchMove }) => {
            const mouse = elements().mouse;
            mouse?.classList.add("scrolling", "horizontal-wheel");

            const armed = await waitForNativeHorizontalOptionMarker(
              refreshedHost,
              heldPoint,
              dispatchMove,
              runId
            );
            if (!armed || runId !== demoRunId) {
              tourDebugAssert(
                "outline-nested-horizontal-first-move",
                false,
                { reason: "The production horizontal insertion marker was not armed." }
              );
              tourDebugAssert(
                "outline-nested-horizontal-return-move",
                false,
                { reason: "The return move was not run because marker arming failed." }
              );
              mouse?.classList.remove("scrolling", "horizontal-wheel");
              showDemoLabel(
                "Horizontal reorder was not accepted by the native Outline engine; the tour cancelled this drag instead of scrolling the page",
                heldPoint
              );
              await wait(760);
              throw new Error(
                "[RML Tour · Step 4] The native horizontal marker was not armed."
              );
            }

            anchorNativeHorizontalOptionMarker(
              refreshedHost,
              armed,
              initialSlot
            );
            await nextTwoFrames();
            let currentMarker =
              nativeHorizontalOptionMarker(refreshedHost) || armed;
            showLandingGuide(
              {
                ...currentMarker.geometry,
                top: initialSlot.top,
                height: initialSlot.height,
                orientation: "vertical"
              },
              "Native wheel-selected section lane"
            );
            const wheelTarget = refreshedHost;
            const initialHorizontalState =
              window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(
                wheelTarget
              );
            const maximumIndex = Number(
              initialHorizontalState?.maximumIndex
            );
            if (
              initialHorizontalState?.accepted !== true ||
              !Number.isFinite(maximumIndex) ||
              maximumIndex < 1
            ) {
              throw new Error(
                "[RML Tour · Step 4] The native horizontal lane range was not available."
              );
            }

            const stationaryMouseBefore = teacherMouseCoordinates();
            const laneTrace = [{
              index: initialHorizontalState.index,
              left: currentMarker.geometry.left
            }];
            const takeWheelStep = async (direction, label) => {
              const beforeState =
                window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(
                  wheelTarget
                );
              const beforeLeft = currentMarker?.geometry?.left;
              const stepResult =
                window.RMLBuilderSetupBridge?.stepHeldOptionHorizontal?.(
                  wheelTarget,
                  direction,
                  heldPoint.x,
                  heldPoint.y
                );
              currentMarker = await followNativeHorizontalOptionMarker(
                refreshedHost,
                900,
                label,
                runId,
                initialSlot
              );
              const afterState =
                window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(
                  wheelTarget
                );
              if (
                runId !== demoRunId ||
                stepResult?.accepted !== true ||
                stepResult?.moved !== true ||
                !currentMarker ||
                afterState?.accepted !== true ||
                afterState.index === beforeState?.index ||
                Math.abs(currentMarker.geometry.left - beforeLeft) < 2
              ) {
                return false;
              }
              anchorNativeHorizontalOptionMarker(
                refreshedHost,
                currentMarker,
                initialSlot
              );
              laneTrace.push({
                index: afterState.index,
                left: currentMarker.geometry.left
              });
              return true;
            };

            showDemoLabel(
              "WHILE STILL HOLDING · The mouse stays fixed while Wheel moves the live marker step by step to the far left",
              heldPoint
            );
            let state = initialHorizontalState;
            while (
              runId === demoRunId &&
              state.accepted === true &&
              state.index > 0
            ) {
              if (!(await takeWheelStep(
                -1,
                "Native marker stepping left"
              ))) {
                break;
              }
              state =
                window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(
                  wheelTarget
                );
            }
            const farLeftMarker = currentMarker;
            const reachedFarLeft = Boolean(
              state?.accepted === true && state.index === 0
            );
            tourDebugAssert(
              "outline-nested-horizontal-first-move",
              reachedFarLeft,
              {
                direction: -1,
                fromIndex: initialHorizontalState.index,
                toIndex: state?.index ?? null,
                from: laneTrace[0]?.left ?? null,
                to: farLeftMarker?.geometry?.left ?? null,
                stepCount: laneTrace.length - 1
              }
            );
            if (!reachedFarLeft || !farLeftMarker) {
              throw new Error(
                "[RML Tour · Step 4] The native marker did not reach the far-left lane."
              );
            }

            showDemoLabel(
              "STILL HOLDING · With the mouse motionless, Wheel now walks the same line from far left to far right",
              heldPoint
            );
            const leftTraceStart = laneTrace.length - 1;
            while (
              runId === demoRunId &&
              state.accepted === true &&
              state.index < maximumIndex
            ) {
              if (!(await takeWheelStep(
                1,
                "Native marker stepping right"
              ))) {
                break;
              }
              state =
                window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(
                  wheelTarget
                );
            }
            const farRightMarker = currentMarker;
            const leftToRightTrace = laneTrace.slice(leftTraceStart);
            const expectedIndices = Array.from(
              { length: maximumIndex + 1 },
              (_, index) => index
            );
            const observedIndices = leftToRightTrace.map(
              entry => entry.index
            );
            const fullStepwiseTraversal = Boolean(
              state?.accepted === true &&
              state.index === maximumIndex &&
              observedIndices.length === expectedIndices.length &&
              observedIndices.every(
                (value, index) => value === expectedIndices[index]
              ) &&
              farRightMarker &&
              farRightMarker.geometry.left >
                farLeftMarker.geometry.left + 2
            );
            tourDebugAssert(
              "outline-nested-horizontal-return-move",
              fullStepwiseTraversal,
              {
                direction: 1,
                from: farLeftMarker.geometry.left,
                to: farRightMarker?.geometry?.left ?? null,
                delta: farRightMarker
                  ? farRightMarker.geometry.left -
                    farLeftMarker.geometry.left
                  : null,
                observedIndices,
                expectedIndices
              }
            );
            tourDebugAssert(
              "outline-nested-horizontal-full-left-to-right-stepwise",
              fullStepwiseTraversal,
              {
                observedIndices,
                expectedIndices,
                trace: leftToRightTrace
              }
            );
            if (!fullStepwiseTraversal || !farRightMarker) {
              throw new Error(
                "[RML Tour · Step 4] The native marker did not traverse every lane from far left to far right."
              );
            }

            const stationaryMouseAfter = teacherMouseCoordinates();
            const mouseStayedFixed = Boolean(
              stationaryMouseBefore &&
              stationaryMouseAfter &&
              Math.abs(
                stationaryMouseAfter.x - stationaryMouseBefore.x
              ) < .5 &&
              Math.abs(
                stationaryMouseAfter.y - stationaryMouseBefore.y
              ) < .5
            );
            tourDebugAssert(
              "outline-nested-horizontal-mouse-stationary-during-wheel",
              mouseStayedFixed,
              {
                before: stationaryMouseBefore,
                after: stationaryMouseAfter,
                heldPoint,
                behavior:
                  "the Enum remains held at one body coordinate; only the native insertion line changes lane during wheel input"
              }
            );
            mouse?.classList.remove("scrolling", "horizontal-wheel");
            if (!mouseStayedFixed) {
              throw new Error(
                "[RML Tour · Step 4] The teacher mouse moved during the horizontal wheel-only phase."
              );
            }

            await wait(520);
            if (runId !== demoRunId) return null;

            if (farRightMarker) {
              const rect = farRightMarker.geometry;
              showLandingGuide(
                rect,
                "Release at the wheel-selected lane"
              );
              return {
                point: {
                  x: rect.left + rect.width * .5,
                  y: rect.top + rect.height * .5
                },
                duration: 460
              };
            }
            return null;
          },
          commitHoldMs: 620
        }
        );
      } finally {
        document.documentElement.classList.remove(
          "rml-setup-horizontal-option-gesture"
        );
      }
      if (runId !== demoRunId) return;
      if (!horizontalDragCompleted) {
        hideMouse();
        throw new Error(
          "[RML Tour · Step 4] The horizontal held-section drag was not committed."
        );
      }
      pulseAt(refreshedHost, "rml-setup-demo-drop");
      showDemoLabel(
        "DRAG 2/2 COMPLETE · The section was released at the visibly wheel-selected lane",
        centerOf(refreshedHost)
      );
      tourDebugAssert(
        "outline-nested-horizontal-marker-returned",
        true,
        { laneCount: refreshedLanes.length }
      );
      await wait(820);
    } else {
      tourDebugAssert(
        "outline-nested-horizontal-first-move",
        false,
        { reason: "No native horizontal insertion slot was available." }
      );
      tourDebugAssert(
        "outline-nested-horizontal-return-move",
        false,
        { reason: "The return move could not start without an insertion slot." }
      );
      throw new Error(
        "[RML Tour · Step 4] No native horizontal insertion slot was available."
      );
    }
    hideMouse();
    } finally {
      html.classList.remove(
        "rml-setup-drag-scroll-live",
        "rml-setup-horizontal-option-gesture"
      );
      elements().mouse?.classList.remove("scrolling", "horizontal-wheel");
      const expectedHelperRemoval = outlineNestedPreparationHelperIds.length;
      const helperRemoval = window.RMLBuilderSetupBridge
        ?.removeTourOutlineVerticalRange?.(
          outlineNestedPreparationHelperIds
        ) || { ok: expectedHelperRemoval === 0, removed: 0 };
      tourDebugAssert(
        "outline-nested-sandbox-helpers-removed",
        helperRemoval.ok === true &&
          Number(helperRemoval.removed || 0) >= expectedHelperRemoval,
        {
          expected: expectedHelperRemoval,
          removed: Number(helperRemoval.removed || 0)
        }
      );
      outlineNestedPreparationHelperIds = [];
    }
  }

  function graphStep11IsCurrentLesson() {
    return steps[stepIndex]?.demo === "graph-route";
  }

  function graphStep11MarkStage(stage, data = {}) {
    graphStep11ActiveStage = String(stage || "unknown");
    graphStep11LastStageData = data && typeof data === "object"
      ? { ...data }
      : { value: data };
    if (graphStep11IsCurrentLesson()) {
      tourDebugRecord("graph-step11-stage", {
        stage: graphStep11ActiveStage,
        stageData: graphStep11LastStageData
      });
    }
    return graphStep11ActiveStage;
  }

  function graphStep11FailureSnapshot(stage, cause = null) {
    const host = window.RMLDynamicGraphHost;
    const state = host?.getState?.() || null;
    const viewport = document.querySelector(".rml-graph-viewport");
    const mouse = elements().mouse;
    const nodes = (state?.nodes || []).map(node => {
      const id = String(node?.id || "");
      const article = graphStep11NodeArticle(id);
      return {
        id,
        kind: String(node?.kind || ""),
        operatorId: String(node?.operatorId || ""),
        title: graphDemoNodeTitle(article),
        model: {
          x: Number(node?.x) || 0,
          y: Number(node?.y) || 0
        },
        rendered: Boolean(article),
        visible: graphDemoVisible(article),
        rect: tourDebugRect(article),
        sockets: article
          ? [...article.querySelectorAll(".rml-graph-socket")].map(socket => ({
              nodeId: String(socket.dataset.nodeId || ""),
              portId: String(socket.dataset.portId || ""),
              direction: String(socket.dataset.direction || ""),
              visible: graphDemoVisible(socket),
              rect: tourDebugRect(socket)
            }))
          : []
      };
    });
    const connections = (state?.connections || []).map(connection => ({
      id: String(connection?.id || ""),
      fromNode: String(connection?.fromNode || ""),
      fromPort: String(connection?.fromPort || ""),
      toNode: String(connection?.toNode || ""),
      toPort: String(connection?.toPort || ""),
      branchFrom: connection?.branchFrom
        ? {
            connectionId: String(connection.branchFrom.connectionId || ""),
            pointId: String(connection.branchFrom.pointId || "")
          }
        : null,
      pointIds: (connection?.points || []).map(point => String(point?.id || ""))
    }));
    const recentStages = tourDebugState.events
      .filter(event => event.type === "graph-step11-stage")
      .slice(-12)
      .map(event => ({
        sequence: event.sequence,
        time: event.time,
        stage: event.stage,
        stageData: event.stageData
      }));
    const root = document.scrollingElement || document.documentElement;
    const snapshot = {
      build: tourDebugState.build,
      stage: String(stage || graphStep11ActiveStage || "unknown"),
      activeStage: graphStep11ActiveStage,
      activeStageData: graphStep11LastStageData,
      elapsedMs: graphStep11RunStartedAt > 0
        ? Math.max(0, Math.round(performance.now() - graphStep11RunStartedAt))
        : null,
      cause,
      step: {
        index: stepIndex,
        title: steps[stepIndex]?.title || "",
        demo: steps[stepIndex]?.demo || "",
        phase: stepPhase,
        runId: demoRunId
      },
      viewport: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        devicePixelRatio: window.devicePixelRatio,
        visualViewport: window.visualViewport
          ? {
              width: window.visualViewport.width,
              height: window.visualViewport.height,
              offsetLeft: window.visualViewport.offsetLeft,
              offsetTop: window.visualViewport.offsetTop,
              scale: window.visualViewport.scale
            }
          : null,
        pageLeft: Number(root?.scrollLeft || 0),
        pageTop: Number(root?.scrollTop || 0)
      },
      graph: {
        active: state?.active === true,
        viewportState: host?.getViewportState?.() || null,
        viewportRect: tourDebugRect(viewport),
        visibleRect: visibleGraphClientRect(0),
        leftPanelOpen: !graphSidebarIsHidden("left"),
        rightPanelOpen: !graphSidebarIsHidden("right"),
        nodes,
        connections,
        lastWireTargets: graphStep11LastWireTargetCandidates.map(candidate => ({
          point: candidate?.point || null,
          fraction: Number(candidate?.fraction),
          segmentIndex: Number(candidate?.segmentIndex),
          tier: Number(candidate?.tier),
          nativeHit: candidate?.nativeHit === true,
          score: Number(candidate?.score)
        }))
      },
      presentation: {
        mouseVisible: graphDemoVisible(mouse),
        mouseRect: tourDebugRect(mouse),
        mouseClasses: mouse?.className || "",
        liveControlsRect: tourDebugRect(elements().liveControls),
        teacherMouseSafety: teacherMouseSafetyState
          ? { ...teacherMouseSafetyState }
          : null
      },
      recentStages
    };
    graphStep11LastFailureSnapshot = snapshot;
    window.RMLStep11FailureDebug = snapshot;
    return snapshot;
  }

  function graphStep11AttachFailureDetails(
    error,
    stage = "unclassified-step11-error",
    suppliedDetails = null
  ) {
    if (!graphStep11IsCurrentLesson()) {
      return error?.details ?? suppliedDetails ?? null;
    }
    if (error?._rmlStep11FailureCaptured === true && error?.details) {
      return error.details;
    }
    const snapshot = graphStep11FailureSnapshot(
      graphStep11ActiveStage || stage,
      suppliedDetails ?? error?.details ?? null
    );
    const details = {
      stage: snapshot.activeStage || stage,
      message: error?.message || String(error || "Unknown Step 11 error"),
      cause: suppliedDetails ?? error?.details ?? null,
      snapshot
    };
    if (error && typeof error === "object") {
      error.details = details;
      Object.defineProperty(error, "_rmlStep11FailureCaptured", {
        value: true,
        configurable: true
      });
    }
    graphStep11LastFailureSnapshot = details;
    window.RMLStep11FailureDebug = details;
    return details;
  }

  function graphDemoError(message, details = null) {
    const error = new Error(`[RML Tour · Graph demo] ${message}`);
    error.details = details;
    const effectiveDetails = graphStep11IsCurrentLesson()
      ? graphStep11AttachFailureDetails(
          error,
          `graph-demo-error:${graphStep11ActiveStage}`,
          details
        )
      : details;
    if (effectiveDetails !== null) {
      console.warn(error.message, effectiveDetails);
    } else {
      console.warn(error.message);
    }
    throw error;
  }

  function graphDemoNodeTitle(node) {

    const title =
      node?.querySelector(".rml-graph-node-title > strong")?.textContent ||
      node?.querySelector(".rml-graph-node-title strong")?.textContent ||
      node?.querySelector(".rml-graph-node-title")?.textContent ||
      "";

    return String(title).replace(/\s+/g, " ").trim();
  }

  function graphDemoVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
  }

  function graphDemoFindNode(titlePattern) {
    const nodes = [...document.querySelectorAll(".rml-graph-node")];
    return nodes.find(node => titlePattern.test(graphDemoNodeTitle(node))) || null;
  }

  function graphPaletteSourceHitPoint(
    element,
    scroller = null,
    margin = 3
  ) {
    if (!(element instanceof HTMLElement) || !element.isConnected) {
      return null;
    }
    const rect = element.getBoundingClientRect();
    const host = scroller instanceof HTMLElement
      ? scroller.getBoundingClientRect()
      : rect;
    const viewport = tourViewport();
    const left = Math.max(
      rect.left + margin,
      host.left + 2,
      viewport.left + 1
    );
    const right = Math.min(
      rect.right - margin,
      host.right - 2,
      viewport.right - 1
    );
    const top = Math.max(
      rect.top + margin,
      host.top + 2,
      viewport.top + 1
    );
    const bottom = Math.min(
      rect.bottom - margin,
      host.bottom - 2,
      viewport.bottom - 1
    );
    if (
      right <= left ||
      bottom <= top ||
      right - left < 40 ||
      bottom - top < 24
    ) return null;

    const factors = [
      [.5, .5], [.3, .5], [.7, .5],
      [.5, .3], [.5, .7], [.2, .2],
      [.8, .2], [.2, .8], [.8, .8]
    ];
    for (const [xFactor, yFactor] of factors) {
      const point = {
        x: left + (right - left) * xFactor,
        y: top + (bottom - top) * yFactor
      };
      const perceived = tourPerceivePoint(point);
      if (
        perceived.top &&
        (perceived.top === element || element.contains(perceived.top))
      ) {
        return {
          point,
          top: perceived.top,
          topLabel: perceived.topLabel,
          stack: perceived.stack,
          directHit: true,
          geometricVisible: true,
          visibleIntersection: {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top
          }
        };
      }
    }
    const point = {
      x: left + (right - left) * .5,
      y: top + (bottom - top) * .5
    };
    const perceived = tourPerceivePoint(point);
    return {
      point,
      top: perceived.top,
      topLabel: perceived.topLabel,
      stack: perceived.stack,
      directHit: false,
      geometricVisible: true,
      visibleIntersection: {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top
      }
    };
  }

  function graphPaletteItemFullyVisible(
    element,
    scroller = null,
    margin = 2
  ) {
    if (!(element instanceof HTMLElement) || !element.isConnected) {
      return false;
    }
    const rect = element.getBoundingClientRect();
    const host = scroller instanceof HTMLElement
      ? scroller.getBoundingClientRect()
      : rect;
    const viewport = tourViewport();
    return Boolean(
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= Math.max(host.left, viewport.left) + margin &&
      rect.right <= Math.min(host.right, viewport.right) - margin &&
      rect.top >= Math.max(host.top, viewport.top) + margin &&
      rect.bottom <= Math.min(host.bottom, viewport.bottom) - margin
    );
  }

  async function teacherRevealRuntimeGraphPaletteItem(
    operatorId,
    runId = demoRunId
  ) {
    const revealStarted = performance.now();
    graphPaletteRevealState = {
      operatorId,
      phase: "locate",
      attemptCount: 1,
      complete: false
    };
    const paletteRoot = document.querySelector(".rml-graph-palette");
    if (!tourElementActuallyVisible(paletteRoot) || runId !== demoRunId) {
      graphPaletteRevealState.phase = "palette-missing";
      return null;
    }
    const selector = operatorId
      ? `[data-graph-operator="${CSS.escape(operatorId)}"]`
      : ".rml-graph-palette-item";
    let item = paletteRoot.querySelector(selector);
    if (!item || item.disabled) {
      graphPaletteRevealState.phase = "item-missing";
      return null;
    }

    const group = item.closest("details");
    if (group && !group.open) {
      graphPaletteRevealState.phase = "open-category";
      const summary = group.querySelector(":scope > summary");
      if (summary) {
        await teacherClickElement(
          summary,
          "Open the real Runtime Node category that contains this node",
          runId,
          { focus: paletteRoot, keepFocusVisible: true }
        );
        await wait(80);
      }
    }
    if (runId !== demoRunId) return null;
    if (group && !group.open) {
      graphPaletteRevealState.phase = "category-did-not-open";
      tourDebugAssert(
        "graph-create-node-category-opened-once",
        false,
        {
          operatorId,
          attemptCount: 1,
          groupOpen: group.open
        }
      );
      return null;
    }

    tourDebugAssert(
      "graph-create-node-category-opened-once",
      true,
      {
        operatorId,
        attemptCount: 1,
        groupOpen: group?.open !== false
      }
    );

    const scroll = paletteRoot.querySelector(".rml-graph-palette-scroll");
    item = paletteRoot.querySelector(selector);
    if (
      !item ||
      item.disabled ||
      !(scroll instanceof HTMLElement)
    ) {
      graphPaletteRevealState.phase = "scroll-surface-missing";
      return null;
    }

    const pageScroller = document.scrollingElement || document.documentElement;
    const pageScrollTopBefore = pageScroller.scrollTop;
    let pageScrollRepaired = false;
    let source = graphPaletteSourceHitPoint(item, scroll, 3);
    let sourceFullyVisible = graphPaletteItemFullyVisible(
      item,
      scroll,
      2
    );

    if (!sourceFullyVisible && tourPageRootCanHelpTarget(item)) {
      graphPaletteRevealState.phase = "reveal-palette-in-page";
      pageScrollRepaired = await nativeTourScrollTargetIntoView(item, runId);
      await nextTwoFrames();
      if (runId !== demoRunId) return null;
      item = paletteRoot.querySelector(selector);
      source = graphPaletteSourceHitPoint(item, scroll, 3);
      sourceFullyVisible = graphPaletteItemFullyVisible(
        item,
        scroll,
        2
      );
    }
    const scrollTopBefore = scroll.scrollTop;
    let wheelSteps = 0;
    let directScrollRepairs = 0;

    if (!sourceFullyVisible || source?.directHit !== true) {
      graphPaletteRevealState.phase = "scroll-to-item";
      const hostRect = scroll.getBoundingClientRect();
      const point = {
        x: hostRect.left + hostRect.width * .76,
        y: hostRect.top + hostRect.height * .54
      };
      await moveMouse(point, 360, runId);
      if (runId !== demoRunId) return null;
      elements().mouse?.classList.add("scrolling");
      showDemoLabel("Locate the real NOT tile in the Node library", point);

      const itemRect = item.getBoundingClientRect();
      const maximum = Math.max(0, scroll.scrollHeight - scroll.clientHeight);
      const desired = Math.max(
        0,
        Math.min(
          maximum,
          scroll.scrollTop +
            itemRect.top -
            hostRect.top -
            Math.max(8, (hostRect.height - itemRect.height) * .5)
        )
      );
      const start = scroll.scrollTop;
      const distance = desired - start;
      const steps = Math.max(
        1,
        Math.min(12, Math.ceil(Math.abs(distance) / 72))
      );

      for (
        let index = 1;
        index <= steps && runId === demoRunId;
        index += 1
      ) {
        const raw = index / steps;
        const eased = 1 - Math.pow(1 - raw, 2.2);
        const requestedTop = start + distance * eased;
        const beforeStep = scroll.scrollTop;
        dispatchTourWheel(scroll, {
          deltaY: requestedTop - beforeStep
        });
        wheelSteps += 1;
        await wait(72);
        if (Math.abs(scroll.scrollTop - requestedTop) > 3) {
          scroll.scrollTop = requestedTop;
          directScrollRepairs += 1;
        }
        item = paletteRoot.querySelector(selector);
        source = graphPaletteSourceHitPoint(item, scroll, 3);
        sourceFullyVisible = graphPaletteItemFullyVisible(
          item,
          scroll,
          2
        );
        tourDebugRecord("graph-create-node-reveal-progress", {
          operatorId,
          step: index,
          steps,
          requestedTop,
          actualTop: scroll.scrollTop,
          directHit: source?.directHit === true,
          geometricVisible: source?.geometricVisible === true,
          fullyVisible: sourceFullyVisible
        });
        if (
          sourceFullyVisible &&
          source?.directHit === true
        ) break;
      }
      elements().mouse?.classList.remove("scrolling");
    }

    item = paletteRoot.querySelector(selector);
    source = graphPaletteSourceHitPoint(item, scroll, 2);
    sourceFullyVisible = graphPaletteItemFullyVisible(
      item,
      scroll,
      2
    );
    const elapsedMs = Math.round(performance.now() - revealStarted);
    const complete = Boolean(
      item &&
      !item.disabled &&
      sourceFullyVisible &&
      source?.directHit === true &&
      source?.geometricVisible === true &&
      runId === demoRunId
    );
    graphPaletteRevealState = {
      operatorId,
      phase: complete ? "complete" : "source-not-addressable",
      attemptCount: 1,
      complete,
      elapsedMs,
      scrollTopBefore,
      scrollTopAfter: scroll.scrollTop,
      scrollDistance: scroll.scrollTop - scrollTopBefore,
      wheelSteps,
      directScrollRepairs,
      pageScrollRepaired,
      pageScrollTopBefore,
      pageScrollTopAfter: pageScroller.scrollTop,
      pageScrollDistance: pageScroller.scrollTop - pageScrollTopBefore,
      sourcePoint: source?.point || null,
      sourceTop: source?.topLabel || "",
      sourceStack: source?.stack || [],
      sourceFullyVisible,
      itemRect: tourDebugRect(item)
    };
    const revealComplete = tourDebugAssert(
      "graph-create-node-reveal-state-machine-complete",
      complete,
      graphPaletteRevealState
    );
    tourDebugRecord(
      "graph-create-node-reveal-state-machine-end",
      graphPaletteRevealState
    );
    return revealComplete ? item : null;
  }

  function visibleRuntimeGraphPaletteItem(preferredOperatorId = "") {
    const paletteRoot = document.querySelector(".rml-graph-palette");
    const scroll = paletteRoot?.querySelector(".rml-graph-palette-scroll");
    if (
      !tourElementActuallyVisible(paletteRoot) ||
      !(scroll instanceof HTMLElement)
    ) {
      return null;
    }

    const items = [
      ...paletteRoot.querySelectorAll(".rml-graph-palette-item:not(:disabled)")
    ].filter(item => {
      const group = item.closest("details");
      return (
        (!group || group.open) &&
        elementVisibleInsideScroller(item, scroll, 4)
      );
    });

    if (preferredOperatorId) {
      const preferred = items.find(
        item => item.dataset.graphOperator === preferredOperatorId
      );
      if (preferred) return preferred;
    }

    return items[0] || null;
  }

  async function ensureGraphDemoNodes(runId = demoRunId) {
    const host = window.RMLDynamicGraphHost;
    if (runId !== demoRunId) return null;

    if (!graphDemoFindNode(/(?:^|\s)NOT(?:\s|$)/i)) {
      const forced = host?.ensureOperatorNode?.("logic.not");
      if (!forced?.ok) {
        graphDemoError(
          "The one required NOT teaching node could not be created by the graph engine.",
          forced
        );
      }
      await nextTwoFrames();
    }

    let pair = graphDemoSocketPair(false);
    if (pair?.output && pair?.input) return pair;

    if (!graphDemoFindNode(/(?:^|\s)Boolean Constant(?:\s|$)/i)) {
      const fallback = host?.ensureOperatorNode?.("constant.bool");
      if (!fallback?.ok) {
        graphDemoError(
          "Neither the packed Start node nor a safe Boolean fallback could provide a compatible NOT source.",
          fallback
        );
      }
      await nextTwoFrames();
    }

    for (let attempt = 0; attempt < 40 && runId === demoRunId; attempt += 1) {
      pair = graphDemoSocketPair(false);
      if (pair?.output && pair?.input) return pair;
      await tourNextVisualFrame();
    }

    if (runId !== demoRunId) return null;

    const nodes = [...document.querySelectorAll(".rml-graph-node")].map(node => ({
      id: node.dataset.graphNodeId || "",
      title: graphDemoNodeTitle(node),
      sockets: [...node.querySelectorAll(".rml-graph-socket")].map(socket => ({
        direction: socket.dataset.direction || "",
        portId: socket.dataset.portId || "",
        type: socket.dataset.concreteType || "",
        visible: graphDemoVisible(socket)
      }))
    }));

    graphDemoError("Could not resolve a visible compatible Start/fallback output and NOT input after 40 render frames.", nodes);
  }

  function graphPaletteDropPerception(
    viewport,
    requestedPoint,
    options = {}
  ) {
    const visible = visibleGraphClientRect(10);
    if (!viewport || !visible || visible.width < 20 || visible.height < 20) {
      return null;
    }
    const requested = requestedPoint &&
      Number.isFinite(requestedPoint.x) &&
      Number.isFinite(requestedPoint.y)
        ? requestedPoint
        : {
            x: visible.left + visible.width * .72,
            y: visible.top + visible.height * .5
          };
    const metrics = options.metrics ||
      window.RMLDynamicGraphHost
        ?.getOperatorPlacementMetrics?.(
          options.operatorId || "logic.not"
        ) || null;
    const footprintWidth = Math.max(
      80,
      Number(metrics?.clientWidth) ||
        Number(options.footprintWidth) ||
        280
    );
    const footprintHeight = Math.max(
      72,
      Number(metrics?.clientHeight) ||
        Number(options.footprintHeight) ||
        190
    );
    const pointerOffsetX = Math.max(
      0,
      Math.min(
        footprintWidth,
        Number(metrics?.clientPointerOffsetX) ||
          footprintWidth * .465
      )
    );
    const pointerOffsetY = Math.max(
      0,
      Math.min(
        footprintHeight,
        Number(metrics?.clientPointerOffsetY) ||
          footprintHeight * .185
      )
    );
    const footprintMargin = Math.max(
      10,
      Number(options.footprintMargin) || 18
    );
    const requestedAllowedArea = options.allowedFootprintArea || visible;
    const allowedArea = {
      left: Math.max(visible.left, Number(requestedAllowedArea.left) || visible.left),
      right: Math.min(visible.right, Number(requestedAllowedArea.right) || visible.right),
      top: Math.max(visible.top, Number(requestedAllowedArea.top) || visible.top),
      bottom: Math.min(visible.bottom, Number(requestedAllowedArea.bottom) || visible.bottom)
    };
    allowedArea.width = Math.max(0, allowedArea.right - allowedArea.left);
    allowedArea.height = Math.max(0, allowedArea.bottom - allowedArea.top);
    const safePointerBounds = {
      left:
        allowedArea.left +
        pointerOffsetX +
        footprintMargin,
      right:
        allowedArea.right -
        (footprintWidth - pointerOffsetX) -
        footprintMargin,
      top:
        allowedArea.top +
        pointerOffsetY +
        footprintMargin,
      bottom:
        allowedArea.bottom -
        (footprintHeight - pointerOffsetY) -
        footprintMargin
    };
    const completeFootprintCanFit =
      safePointerBounds.left <= safePointerBounds.right &&
      safePointerBounds.top <= safePointerBounds.bottom;
    if (!completeFootprintCanFit) {
      return null;
    }
    const clamp = point => ({
      x: Math.max(
        safePointerBounds.left,
        Math.min(safePointerBounds.right, point.x)
      ),
      y: Math.max(
        safePointerBounds.top,
        Math.min(safePointerBounds.bottom, point.y)
      )
    });
    const footprintAt = point => ({
      left: point.x - pointerOffsetX,
      right:
        point.x - pointerOffsetX + footprintWidth,
      top: point.y - pointerOffsetY,
      bottom:
        point.y - pointerOffsetY + footprintHeight,
      width: footprintWidth,
      height: footprintHeight
    });
    const rectanglesOverlap = (first, second, margin = 0) => !(
      first.right + margin < second.left ||
      first.left - margin > second.right ||
      first.bottom + margin < second.top ||
      first.top - margin > second.bottom
    );
    const seeds = [
      clamp(requested),
      { x: visible.left + visible.width * .76, y: visible.top + visible.height * .5 },
      { x: visible.left + visible.width * .68, y: visible.top + visible.height * .34 },
      { x: visible.left + visible.width * .68, y: visible.top + visible.height * .7 },
      { x: visible.left + visible.width * .5, y: visible.top + visible.height * .5 }
    ];
    const nodes = [...document.querySelectorAll(".rml-graph-node")]
      .filter(tourElementActuallyVisible)
      .map(node => node.getBoundingClientRect());
    const scored = seeds.flatMap(seed => {
      const values = [];
      for (let row = -2; row <= 2; row += 1) {
        for (let column = -2; column <= 2; column += 1) {
          const point = clamp({
            x: seed.x + column * Math.max(18, visible.width * .045),
            y: seed.y + row * Math.max(18, visible.height * .065)
          });
          const perceived = tourPerceivePoint(point);
          const inViewport = Boolean(
            perceived.top?.closest?.(".rml-graph-viewport") === viewport
          );
          const overControl = Boolean(perceived.top?.closest?.(
            "button, input, select, textarea, .rml-graph-toolbar, " +
            ".rml-graph-panel-toggle, .rml-graph-socket"
          ));
          const nearestNode = nodes.reduce(
            (distance, rect) => Math.min(
              distance,
              graphDemoRectDistance(point, rect, 16)
            ),
            Infinity
          );
          const footprint = footprintAt(point);
          const footprintOverlapsNode = nodes.some(rect =>
            rectanglesOverlap(footprint, rect, 12)
          );
          const fullFootprintInside = Boolean(
            footprint.left >= visible.left &&
            footprint.right <= visible.right &&
            footprint.top >= visible.top &&
            footprint.bottom <= visible.bottom
          );
          const footprintInsideAllowedArea = Boolean(
            footprint.left >= allowedArea.left &&
            footprint.right <= allowedArea.right &&
            footprint.top >= allowedArea.top &&
            footprint.bottom <= allowedArea.bottom
          );
          values.push({
            point,
            footprint,
            perceived,
            inViewport,
            overControl,
            footprintOverlapsNode,
            fullFootprintInside,
            footprintInsideAllowedArea,
            score:
              (inViewport ? 100000 : -100000) +
              (overControl ? -60000 : 0) +
              (footprintOverlapsNode ? -90000 : 0) +
              (fullFootprintInside ? 50000 : -100000) +
              (footprintInsideAllowedArea ? 50000 : -100000) +
              Math.min(360, nearestNode) * 20 -
              Math.hypot(point.x - requested.x, point.y - requested.y)
          });
        }
      }
      return values;
    });
    scored.sort((left, right) => right.score - left.score);
    const winner = scored.find(candidate =>
      candidate.inViewport &&
      !candidate.overControl &&
      !candidate.footprintOverlapsNode &&
      candidate.fullFootprintInside &&
      candidate.footprintInsideAllowedArea
    );
    const geometricWinner = winner || scored.find(candidate => {
      return candidate.fullFootprintInside &&
        candidate.footprintInsideAllowedArea &&
        !candidate.footprintOverlapsNode &&
        !candidate.overControl;
    });
    if (!geometricWinner) return null;
    return {
      point: geometricWinner.point,
      topLabel: geometricWinner.perceived.topLabel,
      stack: geometricWinner.perceived.stack,
      inViewport: true,
      directHit: geometricWinner.inViewport,
      geometricInside: true,
      overControl: geometricWinner.overControl,
      footprint: geometricWinner.footprint,
      fullFootprintInside:
        geometricWinner.fullFootprintInside,
      footprintInsideAllowedArea:
        geometricWinner.footprintInsideAllowedArea,
      allowedArea,
      safePointerBounds,
      metrics
    };
  }

  function graphCreateNodePreparedDropHit(operatorId = "logic.not") {
    const viewport = document.querySelector(".rml-graph-viewport");
    const plan = graphCreateNodePreparedDropPlan;
    if (!(viewport instanceof HTMLElement) || plan?.complete !== true) {
      return null;
    }
    const visible = visibleGraphClientRect(18);
    if (!visible) return null;
    const metrics = window.RMLDynamicGraphHost
      ?.getOperatorPlacementMetrics?.(operatorId) || null;
    const regions = graphCreateNodePlacementRegions(
      visible,
      plan.orientation || "horizontal"
    );
    const livePlan = graphCreateNodePointerPlan(
      regions.reservedArea,
      metrics,
      18
    );
    if (livePlan?.fits !== true) return null;
    const existingRects = [...document.querySelectorAll(".rml-graph-node")]
      .filter(tourElementActuallyVisible)
      .map(node => node.getBoundingClientRect());
    const existingCompletelyInArea = existingRects.every(rect =>
      rect.left >= regions.existingArea.left + 8 &&
      rect.right <= regions.existingArea.right - 8 &&
      rect.top >= regions.existingArea.top + 8 &&
      rect.bottom <= regions.existingArea.bottom - 8
    );
    const largestExistingCoverage = existingRects.reduce(
      (largest, rect) => Math.max(
        largest,
        (rect.width * rect.height) /
          Math.max(1, visible.width * visible.height)
      ),
      0
    );
    if (!existingCompletelyInArea || largestExistingCoverage > .42) {
      return null;
    }
    const hit = graphPaletteDropPerception(
      viewport,
      livePlan.point,
      {
        operatorId,
        metrics,
        footprintMargin: 18,
        allowedFootprintArea: regions.reservedArea
      }
    );
    return hit?.fullFootprintInside === true &&
      hit?.footprintInsideAllowedArea === true
      ? {
          ...hit,
          preparedOrientation: regions.orientation,
          preparedArea: regions.reservedArea,
          preparedFootprint: livePlan.footprint,
          existingCompletelyInArea,
          largestExistingCoverage
        }
      : null;
  }

  function graphNodeRectInsideVisibleGraph(node, inset = 12) {
    if (!(node instanceof Element)) return false;
    const rect = node.getBoundingClientRect();
    const visible = visibleGraphClientRect(inset);
    return Boolean(
      visible &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= visible.left &&
      rect.right <= visible.right &&
      rect.top >= visible.top &&
      rect.bottom <= visible.bottom
    );
  }

  async function ensureGraphNodeFullyVisibleAfterCommit(
    nodeOrId,
    preferredPoint,
    runId,
    options = {}
  ) {
    const nodeId = typeof nodeOrId === "string"
      ? nodeOrId
      : nodeOrId?.dataset?.graphNodeId || "";
    const resolveNode = () => nodeId
      ? document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
        )
      : null;
    const attempts = [];
    let repaired = false;
    const inset = Math.max(8, Number(options.inset) || 14);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      if (runId !== demoRunId) {
        return {
          ok: false,
          reason: "demonstration-cancelled",
          node: resolveNode(),
          nodeId,
          repaired,
          attempts
        };
      }
      const node = resolveNode();
      const visible = visibleGraphClientRect(inset);
      const rect = node?.getBoundingClientRect?.() || null;
      const inside = graphNodeRectInsideVisibleGraph(node, inset);
      attempts.push({
        attempt,
        inside,
        rect: tourDebugRect(node),
        visible
      });
      if (inside) {
        return {
          ok: true,
          node,
          nodeId,
          repaired,
          attempts,
          finalRect: tourDebugRect(node),
          visibleRect: visible
        };
      }
      if (!node || !visible || !rect || visible.width <= 0 || visible.height <= 0) {
        break;
      }

      if (rect.width <= visible.width && rect.height <= visible.height) {
        const minimumX = visible.left + rect.width / 2;
        const maximumX = visible.right - rect.width / 2;
        const minimumY = visible.top + rect.height / 2;
        const maximumY = visible.bottom - rect.height / 2;
        const targetX = Math.max(
          minimumX,
          Math.min(
            maximumX,
            Number(preferredPoint?.x) || (visible.left + visible.right) / 2
          )
        );
        const targetY = Math.max(
          minimumY,
          Math.min(
            maximumY,
            Number(preferredPoint?.y) || (visible.top + visible.bottom) / 2
          )
        );
        const centered = window.RMLDynamicGraphHost
          ?.setNodeClientCenter?.(nodeId, targetX, targetY) || null;
        attempts[attempt].action = "center-rendered-rectangle";
        attempts[attempt].target = { x: targetX, y: targetY };
        attempts[attempt].result = centered;
        repaired ||= centered?.ok === true;
      } else {
        const fitted = window.RMLDynamicGraphHost
          ?.fitNodesToClientRect?.(
            [nodeId],
            visible,
            {
              padding: Math.max(18, inset),
              maxScale: Math.min(
                .82,
                Number(
                  window.RMLDynamicGraphHost?.getState?.()?.viewport?.scale
                ) || .82
              )
            }
          ) || null;
        attempts[attempt].action = "fit-rendered-rectangle";
        attempts[attempt].result = fitted;
        repaired ||= fitted?.ok === true;
      }
      await nextTwoFrames();
    }

    const node = resolveNode();
    const visible = visibleGraphClientRect(inset);
    return {
      ok: graphNodeRectInsideVisibleGraph(node, inset),
      reason: "committed-node-rectangle-remained-clipped",
      node,
      nodeId,
      repaired,
      attempts,
      finalRect: tourDebugRect(node),
      visibleRect: visible
    };
  }

  registerTourInteractionCapability({
    id: "graph.sidebar.ensure-visible",
    async observe(context) {
      return {
        leftHidden: graphSidebarIsHidden("left"),
        rightHidden: graphSidebarIsHidden("right"),
        requested: context.requirements || { left: true, right: true }
      };
    },
    async execute(context) {
      await teacherEnsureGraphSidebarsVisible(
        context.runId,
        context.requirements || { left: true, right: true }
      );
      await nextTwoFrames();
      return {
        leftVisible: !graphSidebarIsHidden("left"),
        rightVisible: !graphSidebarIsHidden("right")
      };
    },
    async confirm({ context, requirements, result }) {
      const requested = requirements || context?.requirements || {
        left: true,
        right: true
      };
      const leftOkay = requested.left === false
        ? graphSidebarIsHidden("left")
        : !graphSidebarIsHidden("left");
      const rightOkay = requested.right === false
        ? graphSidebarIsHidden("right")
        : !graphSidebarIsHidden("right");
      return {
        ok: leftOkay && rightOkay,
        leftOkay,
        rightOkay,
        result
      };
    }
  });

  function graphPaletteAuthoritativeEvidence(operatorId, result = {}) {
    const nativeCommitState = result?.nativeCommitState || null;
    const committedNodeId =
      nativeCommitState?.nodeId || result?.createdId || "";
    const graphState = window.RMLDynamicGraphHost?.getState?.() || null;
    const modelNode = committedNodeId
      ? graphState?.nodes?.find(node => node.id === committedNodeId) || null
      : null;
    const renderedNode = committedNodeId
      ? document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(committedNodeId)}"]`
        )
      : null;
    const exactOperator = Boolean(
      modelNode?.kind === "operator" &&
      modelNode?.operatorId === operatorId
    );
    const renderedVisible =
      graphNodeRectInsideVisibleGraph(renderedNode, 12);
    const graphModeActive =
      document.body.classList.contains("rml-node-graph-mode") &&
      graphState?.active === true;
    const authoritativeChecks = {
      dragPromiseCompleted: result?.dragCompleted === true,
      productCommitAccepted: nativeCommitState?.ok === true,
      committedOperatorMatches:
        nativeCommitState?.operatorId === operatorId,
      committedPointerMatches:
        nativeCommitState?.pointerId === 9231,
      productRecordedRealDrag:
        nativeCommitState?.wasDragging === true,
      committedNodeIdPresent: Boolean(committedNodeId),
      modelContainsExactOperator: exactOperator,
      committedNodeRendered: Boolean(renderedNode),
      committedNodeVisible:
        renderedVisible ||
        result?.visibilityConstraintHandled === true,
      graphModeStillActive: graphModeActive
    };
    const missingAuthoritativeSignals = Object.entries(authoritativeChecks)
      .filter(([, passed]) => passed !== true)
      .map(([name]) => name);
    const transientTelemetry = {
      nativePointerDownArmed:
        result?.nativePointerDownArmed === true,
      nativeInteractionSeen:
        result?.nativeInteractionSeen === true,
      nativeDraggingSeen:
        result?.nativeDraggingSeen === true,
      nativeGhostSeen:
        result?.nativeGhostSeen === true,
      faithfulGhostSeen:
        result?.faithfulGhostSeen === true,
      visibleGhostSeen:
        result?.visibleGhostSeen === true
    };
    const missingTransientTelemetry = Object.entries(transientTelemetry)
      .filter(([, observed]) => observed !== true)
      .map(([name]) => name);

    return {
      ok: missingAuthoritativeSignals.length === 0,
      reason: missingAuthoritativeSignals.length === 0
        ? ""
        : `missing-authoritative-signals:${missingAuthoritativeSignals.join(",")}`,
      committedNodeId,
      modelNode,
      renderedNode,
      exactOperator,
      renderedVisible,
      graphModeActive,
      authoritativeChecks,
      missingAuthoritativeSignals,
      transientTelemetry,
      missingTransientTelemetry
    };
  }

  registerTourInteractionCapability({
    id: "graph.palette.drag-node",
    async observe(context) {
      const palette = document.querySelector(
        `.rml-graph-palette-item[data-graph-operator="${CSS.escape(context.operatorId)}"]`
      );
      const viewport = document.querySelector(".rml-graph-viewport");
      return {
        operatorId: context.operatorId,
        palette: tourPerceiveElement(palette),
        viewport: tourPerceiveElement(viewport),
        existingOperatorCount: (window.RMLDynamicGraphHost?.getState?.()?.nodes || [])
          .filter(node => node.operatorId === context.operatorId).length
      };
    },
    async execute(context) {
      const palette = await teacherRevealRuntimeGraphPaletteItem(
        context.operatorId,
        context.runId
      );
      const viewport = document.querySelector(".rml-graph-viewport");
      if (!(palette instanceof HTMLElement) || !(viewport instanceof HTMLElement)) {
        return {
          ok: false,
          reason: "palette-or-viewport-missing",
          revealState: graphPaletteRevealState
        };
      }
      await nextTwoFrames();
      const paletteScroll = palette.closest(".rml-graph-palette-scroll");
      const sourceHit = graphPaletteSourceHitPoint(
        palette,
        paletteScroll,
        3
      );
      const requestedDrop = graphDemoSafeEmptyDropPoint(
        viewport,
        sourceHit?.point || centerOf(palette),
        {
          prefer: "right",
          reserveWidth: 310,
          reserveHeight: 190,
          allowOccupiedFallback: true
        }
      );
      const placementMetrics = window.RMLDynamicGraphHost
        ?.getOperatorPlacementMetrics?.(context.operatorId) || null;
      const resolveLiveDropHit = () => {
        const preparedDropHit = graphCreateNodePreparedDropHit(
          context.operatorId
        );
        const currentVisibleGraph = visibleGraphClientRect(18);
        const currentPreparedRegions =
          graphCreateNodePreparedDropPlan?.complete === true &&
          currentVisibleGraph
            ? graphCreateNodePlacementRegions(
                currentVisibleGraph,
                graphCreateNodePreparedDropPlan.orientation || "horizontal"
              )
            : null;
        const requestedPreparedPoint =
          preparedDropHit?.point ||
          graphCreateNodePreparedDropPlan?.pointerPlan?.point ||
          requestedDrop;
        return preparedDropHit || graphPaletteDropPerception(
          viewport,
          requestedPreparedPoint,
          {
            operatorId: context.operatorId,
            metrics: placementMetrics,
            footprintMargin: 18,
            allowedFootprintArea:
              currentPreparedRegions?.reservedArea || currentVisibleGraph
          }
        );
      };
      let dropHit = resolveLiveDropHit();
      const pageScroller = document.scrollingElement || document.documentElement;
      const effectViewport = tourEffectViewport();
      const viewportRect = viewport.getBoundingClientRect();
      const requiresPageTransition = Boolean(
        !dropHit &&
        sourceHit?.geometricVisible === true &&
        pageScroller.scrollHeight - pageScroller.clientHeight > 1 &&
        (
          viewportRect.top >= effectViewport.bottom - 24 ||
          viewportRect.bottom <= effectViewport.top + 24
        )
      );
      const pageTransitionDirection = viewportRect.top >= effectViewport.bottom - 24
        ? 1
        : -1;
      const requestedPreparedPoint =
        dropHit?.point ||
        graphCreateNodePreparedDropPlan?.pointerPlan?.point ||
        requestedDrop;
      if (!sourceHit || (!dropHit && !requiresPageTransition)) {
        return {
          ok: false,
          reason: !sourceHit
            ? "exact-palette-source-not-hit-testable"
            : "complete-node-footprint-not-available",
          source: tourPerceiveElement(palette),
          requestedDrop,
          requestedPreparedPoint,
          preparedPlan: graphCreateNodePreparedDropPlan,
          placementMetrics,
          dropHit
        };
      }

      const assertLiveDropHit = currentDropHit => {
        if (!currentDropHit) return false;
        return tourDebugAssert(
          "graph-create-node-drop-hit-runtime-viewport",
          currentDropHit.inViewport === true &&
            currentDropHit.geometricInside === true &&
            currentDropHit.overControl === false &&
            currentDropHit.fullFootprintInside === true &&
            currentDropHit.footprintInsideAllowedArea === true,
          {
            dropPoint: currentDropHit.point,
            dropTop: currentDropHit.topLabel,
            dropStack: currentDropHit.stack,
            directHitDiagnostic: currentDropHit.directHit === true,
            fullFootprintInside: currentDropHit.fullFootprintInside === true,
            footprintInsideAllowedArea:
              currentDropHit.footprintInsideAllowedArea === true,
            allowedArea: currentDropHit.allowedArea,
            footprint: currentDropHit.footprint,
            safePointerBounds: currentDropHit.safePointerBounds,
            reachedAfterHeldPageScroll: requiresPageTransition
          }
        );
      };

      const beforeIds = new Set(
        [...document.querySelectorAll(".rml-graph-node")]
          .map(node => node.dataset.graphNodeId)
          .filter(Boolean)
      );
      let nativeGhostSeen = false;
      let faithfulGhostSeen = false;
      let nativeInteractionSeen = false;
      let nativeDraggingSeen = false;
      let nativePointerDownArmed = false;
      tourDebugAssert(
        "graph-create-node-source-is-not-and-hit-testable",
        palette.dataset.graphOperator === context.operatorId &&
          sourceHit.geometricVisible === true,
        {
          operatorId: palette.dataset.graphOperator || "",
          sourcePoint: sourceHit.point,
          sourceTop: sourceHit.topLabel,
          sourceStack: sourceHit.stack,
          directHitDiagnostic: sourceHit.directHit === true,
          revealState: graphPaletteRevealState
        }
      );
      tourDebugAssert(
        "graph-create-node-full-footprint-reserved-before-pointerdown",
        graphCreateNodePreparedDropPlan?.complete === true &&
          Boolean(graphCreateNodePreparedDropPlan?.pointerPlan?.footprint) &&
          Boolean(graphCreateNodePreparedDropPlan?.regions?.reservedArea) &&
          (
            requiresPageTransition ||
            (
              dropHit?.fullFootprintInside === true &&
              dropHit?.footprintInsideAllowedArea === true
            )
          ),
        {
          preparedOrientation:
            dropHit?.preparedOrientation ||
            graphCreateNodePreparedDropPlan?.orientation || "",
          preparedArea:
            dropHit?.preparedArea ||
            graphCreateNodePreparedDropPlan?.regions?.reservedArea || null,
          preparedFootprint:
            dropHit?.preparedFootprint ||
            graphCreateNodePreparedDropPlan?.pointerPlan?.footprint || null,
          acceptedFootprint: dropHit?.footprint || null,
          placementMetrics,
          requiresHeldPageScroll: requiresPageTransition,
          existingRects:
            graphCreateNodePreparedDropPlan?.existingRects || []
        }
      );
      if (!requiresPageTransition) assertLiveDropHit(dropHit);

      showDemoLabel(
        "Hold the real NOT tile → carry its native ghost into the visible graph → release",
        sourceHit.point
      );
      const visibleGraph = visibleGraphClientRect(12);
      const graphEntryPoint = visibleGraph
        ? {
            x: visibleGraph.left + Math.min(34, visibleGraph.width * .12),
            y: Math.max(
              visibleGraph.top + 24,
              Math.min(
                visibleGraph.bottom - 24,
                sourceHit.point.y
              )
            )
          }
        : null;
      const pageEdgePoint = {
        x: Math.max(
          effectViewport.left + 30,
          Math.min(effectViewport.right - 30, sourceHit.point.x)
        ),
        y: pageTransitionDirection > 0
          ? effectViewport.bottom - 34
          : effectViewport.top + 34
      };
      const initialTargetPoint = requiresPageTransition
        ? pageEdgePoint
        : dropHit.point;
      let dragCompleted = false;
      let lastForcedPageScrollAt = -Infinity;
      let lastObservedPageScrollTop = pageScroller.scrollTop;
      window.RMLDynamicGraphHost?.setGuidedAutoPanSuppressed?.(true);
      try {
        dragCompleted = await nativeUserPointerDrag(
          palette,
          initialTargetPoint,
          1500,
          context.runId,
          9231,
          {
            startPoint: sourceHit.point,
            pathPoints: requiresPageTransition
              ? [{
                  x: pageEdgePoint.x,
                  y: pageTransitionDirection > 0
                    ? Math.min(
                        pageEdgePoint.y,
                        Math.max(sourceHit.point.y + 54, pageEdgePoint.y - 72)
                      )
                    : Math.max(
                        pageEdgePoint.y,
                        Math.min(sourceHit.point.y - 54, pageEdgePoint.y + 72)
                      )
                }]
              : graphEntryPoint ? [graphEntryPoint] : [],
            stageTarget: requiresPageTransition
              ? tourPointRect(pageEdgePoint, 58)
              : tourPointRect(dropHit.point, 62),
            stageFocusTarget: requiresPageTransition
              ? palette.closest(".rml-graph-palette") || palette
              : viewport,
            stageLabel: requiresPageTransition
              ? pageTransitionDirection > 0
                ? "HOLD LOWER EDGE · KEEP NOT GRABBED"
                : "HOLD UPPER EDGE · KEEP NOT GRABBED"
              : "Visible Runtime Graph drop surface",
            commitHoldMs: 520,
            edgeHoldMs: requiresPageTransition ? 4600 : 0,
            edgeHoldMinMs: requiresPageTransition ? 320 : 0,
            onEdgeHoldStart: requiresPageTransition
              ? () => {
                  elements().mouse?.classList.add("scrolling");
                  showDemoLabel(
                    pageTransitionDirection > 0
                      ? "Keep NOT held at the lower edge while the real page scroll reveals the Runtime Graph"
                      : "Keep NOT held at the upper edge while the real page scroll reveals the Runtime Graph",
                    pageEdgePoint
                  );
                }
              : null,
            onEdgeHoldFrame: requiresPageTransition
              ? ({ point, elapsed }) => {
                  if (resolveLiveDropHit()) return;
                  const liveViewportRect = viewport.getBoundingClientRect();
                  const liveEffectViewport = tourEffectViewport();
                  const remaining = pageTransitionDirection > 0
                    ? Math.max(
                        0,
                        liveViewportRect.top -
                          (liveEffectViewport.top + liveEffectViewport.height * .3)
                      )
                    : Math.max(
                        0,
                        (liveEffectViewport.bottom - liveEffectViewport.height * .3) -
                          liveViewportRect.bottom
                      );
                  const deltaY = pageTransitionDirection *
                    Math.max(32, Math.min(92, remaining));
                  const wheelTarget =
                    document.elementFromPoint(point.x, point.y) || document.body;
                  dispatchTourWheel(wheelTarget, { deltaY });
                  if (
                    elapsed - lastForcedPageScrollAt >= 180 &&
                    Math.abs(pageScroller.scrollTop - lastObservedPageScrollTop) < 1
                  ) {
                    lastForcedPageScrollAt = elapsed;
                    pageScroller.scrollTop = Math.max(
                      0,
                      Math.min(
                        pageScroller.scrollHeight - pageScroller.clientHeight,
                        pageScroller.scrollTop + deltaY
                      )
                    );
                  }
                  lastObservedPageScrollTop = pageScroller.scrollTop;
                }
              : null,
            edgeHoldUntil: requiresPageTransition
              ? () => Boolean(resolveLiveDropHit())
              : null,
            onEdgeHoldEnd: requiresPageTransition
              ? () => elements().mouse?.classList.remove("scrolling")
              : null,
            afterEdgeHold: requiresPageTransition
              ? async (_edgePoint, dragContext) => {
                  const liveGraph = visibleGraphClientRect(18);
                  if (!liveGraph) {
                    throw new Error(
                      "[RML Tour · Step 7] Held page scroll did not reveal the Runtime Graph."
                    );
                  }
                  const retreatPoint = {
                    x: liveGraph.left + Math.min(46, liveGraph.width * .16),
                    y: liveGraph.top + Math.min(86, liveGraph.height * .28)
                  };
                  dragContext?.dispatchMove?.(retreatPoint);
                  await nextTwoFrames();
                  dropHit = resolveLiveDropHit();
                  if (!dropHit || !assertLiveDropHit(dropHit)) {
                    throw new Error(
                      "[RML Tour · Step 7] No complete live NOT footprint remained after the held page scroll."
                    );
                  }
                  return {
                    startPoint: retreatPoint,
                    point: dropHit.point,
                    duration: 760,
                    stageTarget: tourPointRect(dropHit.point, 62),
                    stageLabel: "VISIBLE RUNTIME GRAPH · COMPLETE NOT FOOTPRINT"
                  };
                }
              : null,
            pointerDownReady(state) {
              const interaction = state.nativeInteraction;
              nativePointerDownArmed = Boolean(
                interaction?.kind === "palette" &&
                interaction?.pointerId === 9231 &&
                interaction?.operatorId === context.operatorId &&
                interaction?.dragging === false
              );
              return tourDebugAssert(
                "graph-create-node-pointerdown-armed-native-palette",
                nativePointerDownArmed,
                {
                  operatorId: context.operatorId,
                  pointerId: 9231,
                  nativeInteraction: interaction,
                  sourcePoint: sourceHit.point,
                  sourceTop: sourceHit.topLabel
                }
              );
            },
            onNativeGhostConfirmed() {
              nativeGhostSeen = true;
            },
            onPointerFrame(frame) {
              faithfulGhostSeen ||= frame.faithfulGhostVisible === true;
              const interaction = frame.nativeInteraction;
              const exactNativeInteraction = Boolean(
                interaction?.kind === "palette" &&
                interaction?.pointerId === 9231 &&
                interaction?.operatorId === context.operatorId
              );
              nativeGhostSeen ||=
                exactNativeInteraction && interaction?.ghostVisible === true;
              nativeInteractionSeen ||= exactNativeInteraction;
              nativeDraggingSeen ||=
                exactNativeInteraction && interaction.dragging === true;
            },
            releaseReady(point) {
              const interaction =
                window.RMLDynamicGraphHost?.getGuidedInteractionState?.();
              const visible = visibleGraphClientRect(0);
              const insideVisibleGraph = Boolean(
                visible &&
                point.x >= visible.left &&
                point.x <= visible.right &&
                point.y >= visible.top &&
                point.y <= visible.bottom
              );
              return tourDebugAssert(
                "graph-create-node-native-release-ready",
                interaction?.kind === "palette" &&
                interaction?.operatorId === context.operatorId &&
                interaction?.dragging === true &&
                insideVisibleGraph,
                {
                  operatorId: context.operatorId,
                  nativeInteraction: interaction,
                  point,
                  visibleGraph: visible,
                  insideVisibleGraph
                }
              );
            }
          }
        );
      } finally {
        window.RMLDynamicGraphHost?.setGuidedAutoPanSuppressed?.(false);
      }
      await nextTwoFrames();
      const nativeCommitState =
        window.RMLDynamicGraphHost?.getGuidedPaletteDropState?.() || null;
      tourDebugAssert(
        "graph-create-node-native-product-commit-confirmed",
        nativeCommitState?.ok === true &&
          nativeCommitState?.operatorId === context.operatorId &&
          nativeCommitState?.pointerId === 9231 &&
          nativeCommitState?.wasDragging === true,
        {
          operatorId: context.operatorId,
          nativeCommitState
        }
      );
      const committedNodeId = nativeCommitState?.nodeId || "";
      let created = committedNodeId
        ? document.querySelector(
            `.rml-graph-node[data-graph-node-id="${CSS.escape(committedNodeId)}"]`
          )
        : null;
      created ||= [...document.querySelectorAll(".rml-graph-node")]
        .find(node => !beforeIds.has(node.dataset.graphNodeId)) || null;
      const visibilityRepairState = created
        ? await ensureGraphNodeFullyVisibleAfterCommit(
            created,
            {
              x:
                dropHit.footprint.left +
                dropHit.footprint.width / 2,
              y:
                dropHit.footprint.top +
                dropHit.footprint.height / 2
            },
            context.runId,
            { inset: 14 }
          )
        : {
            ok: false,
            reason: "committed-node-not-rendered",
            node: null,
            repaired: false,
            attempts: []
          };
      created = visibilityRepairState.node || created;
      const visibilityRepairPassed = tourDebugAssert(
        "graph-create-node-committed-rect-live-repair-complete",
        visibilityRepairState.ok === true,
        {
          productCommitConfirmed: Boolean(
            nativeCommitState?.ok === true &&
            nativeCommitState?.operatorId === context.operatorId &&
            created
          ),
          repaired: visibilityRepairState.repaired === true,
          attempts: visibilityRepairState.attempts,
          finalRect: visibilityRepairState.finalRect,
          visibleRect: visibilityRepairState.visibleRect
        }
      );
      const createdRectContained = tourDebugAssert(
        "graph-create-node-created-rect-entirely-inside-graph",
        graphNodeRectInsideVisibleGraph(created, 12),
        {
          createdId: created?.dataset?.graphNodeId || "",
          createdRect: tourDebugRect(created),
          visibleRect: visibleGraphClientRect(12),
          acceptedDropFootprint: dropHit.footprint
        }
      );
      const visibilityConstraintHandled = Boolean(
        visibilityRepairPassed === true &&
        createdRectContained === true &&
        visibilityRepairState.ok !== true
      );
      return {
        ok: Boolean(
          dragCompleted &&
          nativeCommitState?.ok === true &&
          nativeCommitState?.operatorId === context.operatorId &&
          created &&
          visibilityRepairPassed === true &&
          createdRectContained === true
        ),
        reason:
          dragCompleted !== true
            ? "native-palette-release-not-accepted"
            : nativeCommitState?.ok !== true
              ? nativeCommitState?.reason || "native-product-commit-unconfirmed"
              : !created
                ? "native-release-created-no-node"
                : visibilityRepairPassed !== true ||
                    createdRectContained !== true
                  ? visibilityRepairState.reason || "committed-node-remained-clipped"
                : "",
        dragCompleted,
        nativeGhostSeen,
        faithfulGhostSeen,
        visibleGhostSeen: nativeGhostSeen || faithfulGhostSeen,
        nativePointerDownArmed,
        nativeInteractionSeen,
        nativeDraggingSeen,
        nativeCommitState,
        createdId: created?.dataset.graphNodeId || "",
        createdTitle: graphDemoNodeTitle(created),
        createdVisible: graphNodeRectInsideVisibleGraph(created, 12),
        visibilityConstraintHandled,
        visibilityRepaired: visibilityRepairState.repaired === true,
        visibilityRepairState,
        sourcePoint: sourceHit.point,
        sourceTop: sourceHit.topLabel,
        dropPoint: dropHit.point,
        dropTop: dropHit.topLabel,
        dropFootprint: dropHit.footprint,
        revealState: graphPaletteRevealState
      };
    },
    async confirm({ operatorId, result }) {
      const evidence = graphPaletteAuthoritativeEvidence(
        operatorId,
        result
      );
      const evidenceWithoutTransient =
        graphPaletteAuthoritativeEvidence(
          operatorId,
          {
            ...result,
            nativePointerDownArmed: false,
            nativeInteractionSeen: false,
            nativeDraggingSeen: false,
            nativeGhostSeen: false,
            faithfulGhostSeen: false,
            visibleGhostSeen: false
          }
        );
      tourDebugAssert(
        "graph-create-node-authoritative-product-state-confirmed",
        evidence.ok,
        {
          operatorId,
          committedNodeId: evidence.committedNodeId,
          authoritativeChecks: evidence.authoritativeChecks,
          missingAuthoritativeSignals:
            evidence.missingAuthoritativeSignals,
          modelOperatorId: evidence.modelNode?.operatorId || "",
          renderedTitle: graphDemoNodeTitle(evidence.renderedNode),
          renderedRect: tourDebugRect(evidence.renderedNode)
        }
      );
      tourDebugAssert(
        "graph-create-node-transient-visual-telemetry-nonblocking",
        evidence.ok && evidenceWithoutTransient.ok,
        {
          authoritativeProductStateWon: evidence.ok,
          sameDecisionWithAllTransientTelemetryForcedMissing:
            evidenceWithoutTransient.ok,
          transientTelemetry: evidence.transientTelemetry,
          missingTransientTelemetry:
            evidence.missingTransientTelemetry,
          policy:
            "completed product commit + exact live model node + visible rendered node are authoritative; animation-frame observations are diagnostics only"
        }
      );
      return {
        ...result,
        ok: evidence.ok,
        reason: evidence.reason,
        createdId: evidence.committedNodeId,
        exactOperator: evidence.exactOperator,
        graphModeActive: evidence.graphModeActive,
        authoritativeChecks: evidence.authoritativeChecks,
        missingAuthoritativeSignals:
          evidence.missingAuthoritativeSignals,
        transientTelemetry: evidence.transientTelemetry,
        missingTransientTelemetry:
          evidence.missingTransientTelemetry,
        renderedRect: tourDebugRect(evidence.renderedNode)
      };
    }
  });

  async function runGraphCreateDemo(runId) {
    const libraryWasHidden = graphSidebarIsHidden("left");
    await executeTourInteractionCapability(
      "graph.sidebar.ensure-visible",
      {
        runId,
        requirements: { left: true, right: false }
      }
    );
    await nextTwoFrames();
    if (runId !== demoRunId) return;

    const libraryVisible = !graphSidebarIsHidden("left");
    const libraryOpenedByTeacher =
      libraryWasHidden && libraryVisible;
    const libraryVerified = tourDebugAssert(
      "graph-create-node-library-visible-before-drag",
      libraryVisible,
      {
        wasHidden: libraryWasHidden,
        openedByTeacher: libraryOpenedByTeacher,
        toggleExpanded: document
          .querySelector(".rml-graph-panel-toggle-left")
          ?.getAttribute("aria-expanded") || "false"
      }
    );
    if (!libraryVerified) {
      graphDemoError(
        "The Runtime Node library stayed collapsed; Step 7 will not pretend to drag from an unavailable sidebar."
      );
    }

    const existingNot = graphDemoFindNode(/(?:^|\s)NOT(?:\s|$)/i);
    if (existingNot) {
      tourDebugAssert("graph-create-node-reused-existing-not", true, {
        nodeId: existingNot.dataset.graphNodeId || "",
        title: graphDemoNodeTitle(existingNot)
      });
      pulseAt(existingNot, "rml-setup-demo-drop");
      showDemoLabel(
        "NOT is already present — reuse it instead of adding a duplicate",
        centerOf(existingNot)
      );
      await wait(720);
      hideMouse();
      return;
    }

    let livePreparedDrop = graphCreateNodePreparedDropHit("logic.not");
    if (!livePreparedDrop) {
      await prepareGraphCreateNodePlacementArea(runId);
      if (runId !== demoRunId) return;
      livePreparedDrop = graphCreateNodePreparedDropHit("logic.not");
    }
    const panelLayoutReconciled = tourDebugAssert(
      "graph-create-node-live-panel-layout-reconciled-before-drag",
      Boolean(
        livePreparedDrop?.fullFootprintInside === true &&
        graphCreateNodePreparedDropPlan?.complete === true
      ),
      {
        libraryVisible,
        inspectorHidden: graphSidebarIsHidden("right"),
        preparedPlan: graphCreateNodePreparedDropPlan,
        liveDrop: livePreparedDrop,
        visibleGraph: visibleGraphClientRect(18)
      }
    );
    if (!panelLayoutReconciled) {
      graphDemoError(
        "Step 7 could not reserve the complete NOT-node rectangle after the real library panel opened."
      );
    }

    const capability = await executeTourInteractionCapability(
      "graph.palette.drag-node",
      {
        runId,
        operatorId: "logic.not"
      }
    );
    if (runId !== demoRunId) return;
    const createdId = capability.confirmation.createdId || "";
    let guaranteedCreated = createdId
      ? document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(createdId)}"]`
        )
      : null;
    const to = capability.confirmation.dropPoint;

    if (!guaranteedCreated || !to) {
      graphDemoError(
        "The registered native NOT drag completed without a visible rendered NOT node.",
        capability.confirmation
      );
    }

    if (!/(?:^|\s)NOT(?:\s|$)/i.test(graphDemoNodeTitle(guaranteedCreated))) {
      graphDemoError(
        "Step 7 created an unrelated node instead of the one required NOT node.",
        {
          title: graphDemoNodeTitle(guaranteedCreated),
          operator: "logic.not"
        }
      );
    }

    if (
      !graphNodeRectInsideVisibleGraph(guaranteedCreated, 12) &&
      capability.confirmation.visibilityConstraintHandled !== true
    ) {
      const guaranteedVisibility =
        await ensureGraphNodeFullyVisibleAfterCommit(
          guaranteedCreated,
          to,
          runId,
          { inset: 14 }
        );
      guaranteedCreated =
        guaranteedVisibility.node || guaranteedCreated;
      if (!guaranteedVisibility.ok) {
        graphDemoError(
          "The created graph node could not be kept completely inside the visible viewport.",
          guaranteedVisibility
        );
      }
    }

    const visibleNativeDrag = tourDebugAssert(
      "graph-create-node-visible-native-drag-committed",
      capability.confirmation.dragCompleted === true &&
        capability.confirmation.nativeCommitState?.ok === true &&
        capability.confirmation.nativeCommitState?.operatorId === "logic.not" &&
        capability.confirmation.nativeCommitState?.pointerId === 9231 &&
        capability.confirmation.nativeCommitState?.wasDragging === true &&
        capability.confirmation.exactOperator === true &&
        capability.confirmation.graphModeActive === true &&
        (
          graphNodeRectInsideVisibleGraph(guaranteedCreated, 12) ||
          capability.confirmation.visibilityConstraintHandled === true
        ),
      {
        createdId: guaranteedCreated.dataset.graphNodeId || "",
        createdTitle: graphDemoNodeTitle(guaranteedCreated),
        nativeGhostSeen: capability.confirmation.nativeGhostSeen === true,
        nativePointerDownArmed:
          capability.confirmation.nativePointerDownArmed === true,
        faithfulGhostSeen:
          capability.confirmation.faithfulGhostSeen === true,
        nativeInteractionSeen:
          capability.confirmation.nativeInteractionSeen === true,
        nativeDraggingSeen:
          capability.confirmation.nativeDraggingSeen === true,
        nativeCommitState: capability.confirmation.nativeCommitState,
        visibleGhostSeen:
          capability.confirmation.visibleGhostSeen === true,
        missingTransientTelemetry:
          capability.confirmation.missingTransientTelemetry || [],
        authoritativeChecks:
          capability.confirmation.authoritativeChecks || {},
        visibilityConstraintHandled:
          capability.confirmation.visibilityConstraintHandled === true,
        sourcePoint: capability.confirmation.sourcePoint,
        dropPoint: capability.confirmation.dropPoint,
        renderedRect: tourDebugRect(guaranteedCreated),
        liveRepairUsed: capability.repaired === true,
        revealState: capability.confirmation.revealState
      }
    );
    if (!visibleNativeDrag) {
      graphDemoError(
        "Step 7 did not visibly complete the registered native NOT drag.",
        capability.confirmation
      );
    }

    const capabilityStarts = tourDebugState.events.filter(event =>
      event.type === "tour-interaction-capability-start" &&
      event.capabilityId === "graph.palette.drag-node" &&
      event.stepIndex === stepIndex
    );
    tourDebugAssert(
      "graph-create-node-single-attempt-no-restart",
      capabilityStarts.length === 1 &&
        capability.repaired !== true &&
        capability.confirmation.revealState?.attemptCount === 1 &&
        capability.confirmation.revealState?.complete === true &&
        stepPhase === "demonstrating" &&
        stepIndex === 7,
      {
        capabilityStarts: capabilityStarts.length,
        capabilityRepaired: capability.repaired === true,
        revealState: capability.confirmation.revealState,
        phase: stepPhase,
        currentStepIndex: stepIndex,
        behavior:
          "one bounded reveal, one native pointer transaction and no dialog restart"
      }
    );

    tourDebugAssert(
      "graph-create-node-completed-without-dialog-restart",
      stepPhase === "demonstrating" &&
        stepIndex === 7 &&
        demoInFlight === true &&
        Boolean(guaranteedCreated),
      {
        phase: stepPhase,
        currentStepIndex: stepIndex,
        demoInFlight,
        createdId: guaranteedCreated.dataset.graphNodeId || "",
        behavior:
          "the scroller reveal, held native palette drag and committed NOT render remain one uninterrupted Step 7 demonstration"
      }
    );

    const graphStateAfterDrop =
      window.RMLDynamicGraphHost?.getState?.() || null;
    tourDebugAssert(
      "graph-create-node-success-preserved-graph-mode-for-following-lessons",
      document.body.classList.contains("rml-node-graph-mode") &&
        graphStateAfterDrop?.active === true &&
        graphStateAfterDrop?.nodes?.some(node =>
          node.id === guaranteedCreated.dataset.graphNodeId &&
          node.kind === "operator" &&
          node.operatorId === "logic.not"
        ),
      {
        graphModeClass:
          document.body.classList.contains("rml-node-graph-mode"),
        graphActive: graphStateAfterDrop?.active === true,
        createdId: guaranteedCreated.dataset.graphNodeId || "",
        nextLessonIndex: stepIndex + 1,
        policy:
          "retain the live committed graph; the next lesson captures this graph state instead of an Outline snapshot"
      }
    );

    pulseAt(guaranteedCreated, "rml-setup-demo-drop");
    showDemoLabel(
      "The graph engine placed exactly one required NOT node inside the visible viewport",
      centerOf(guaranteedCreated)
    );
    await wait(620);
    hideMouse();
  }

  function graphDemoSocketPair(throwOnFailure = true) {
    const renderedNodes = [
      ...document.querySelectorAll(".rml-graph-node")
    ];
    const graphNodes = new Map(
      (window.RMLDynamicGraphHost?.getState?.()?.nodes || [])
        .map(node => [node.id, node])
    );
    const nodeState = node =>
      graphNodes.get(node?.dataset.graphNodeId || "") || null;
    const visibleSockets = (node, direction) =>
      node
        ? [...node.querySelectorAll(
            `.rml-graph-socket[data-direction="${direction}"]`
          )].filter(graphDemoVisible)
        : [];
    const normalizedType = socket =>
      String(socket?.dataset.concreteType || "").trim().toLowerCase();

    const startNodes = renderedNodes.filter(node => {
      const state = nodeState(node);
      return (
        state?.kind === "configuration" ||
        node.classList.contains("configuration") ||
        /^Start\s*·/i.test(graphDemoNodeTitle(node))
      );
    });
    const boolNodes = renderedNodes.filter(node =>
      /(?:^|\s)Boolean Constant(?:\s|$)/i.test(
        graphDemoNodeTitle(node)
      )
    );
    const notNodes = renderedNodes.filter(node =>
      /(?:^|\s)NOT(?:\s|$)/i.test(
        graphDemoNodeTitle(node)
      )
    );
    const otherSourceNodes = renderedNodes.filter(node =>
      !startNodes.includes(node) &&
      !boolNodes.includes(node) &&
      !notNodes.includes(node)
    );

    const candidates = [];
    const sourceGroups = [startNodes, boolNodes, otherSourceNodes];
    sourceGroups.forEach((sourceNodes, sourcePriority) => {
      for (const sourceNode of sourceNodes) {
        for (const output of visibleSockets(sourceNode, "output")) {
          const outputType = normalizedType(output);
          if (!outputType) continue;
          for (const targetNode of notNodes) {
            if (targetNode === sourceNode) continue;
            for (const input of visibleSockets(targetNode, "input")) {
              const inputType = normalizedType(input);
              if (!inputType || outputType !== inputType) continue;
              const sourceState = nodeState(sourceNode);
              const targetState = nodeState(targetNode);
              const distance = sourceState && targetState
                ? Math.hypot(
                    Number(sourceState.x || 0) - Number(targetState.x || 0),
                    Number(sourceState.y || 0) - Number(targetState.y || 0)
                  )
                : Math.hypot(
                    centerOf(sourceNode).x - centerOf(targetNode).x,
                    centerOf(sourceNode).y - centerOf(targetNode).y
                  );
              candidates.push({
                sourceNode,
                targetNode,
                output,
                input,
                sourcePriority,
                configurationPortPriority:
                  output.dataset.portId?.startsWith("config-") ? 0 : 1,
                boolPriority: outputType === "bool" ? 0 : 1,
                distance
              });
            }
          }
        }
      }
    });

    candidates.sort((a, b) =>
      a.sourcePriority - b.sourcePriority ||
      a.configurationPortPriority - b.configurationPortPriority ||
      a.boolPriority - b.boolPriority ||
      a.distance - b.distance
    );
    const selected = candidates[0] || null;
    const sourceNode = selected?.sourceNode || startNodes[0] || boolNodes[0] || null;
    const targetNode = selected?.targetNode || notNodes[0] || null;
    const output = selected?.output || null;
    const input = selected?.input || null;
    const startNode = startNodes[0] || null;

    if ((!sourceNode || !targetNode || !output || !input) && throwOnFailure) {
      graphDemoError("Compatible Start/fallback output and NOT input lookup failed.", {
        startNodeFound: Boolean(startNode),
        sourceNodeFound: Boolean(sourceNode),
        notNodeFound: Boolean(targetNode),
        outputFound: Boolean(output),
        inputFound: Boolean(input),
        startCandidates: startNodes.length,
        booleanFallbackCandidates: boolNodes.length,
        notCandidates: notNodes.length,
        compatiblePairCandidates: candidates.length,
        sourceTitle: graphDemoNodeTitle(sourceNode),
        notTitle: graphDemoNodeTitle(targetNode)
      });
    }

    return {
      sourceNode,
      targetNode,
      startNode,
      boolNode: sourceNode,
      notNode: targetNode,
      output,
      input
    };
  }


  async function nativeGraphNodeDrag(article, targetCenter, duration, runId) {
    const header = article?.querySelector(".rml-graph-node-header") || article;
    if (!header || !targetCenter || runId !== demoRunId) return false;
    const from = centerOf(header);
    const articleCenter = centerOf(article);
    const targetPoint = {
      x: targetCenter.x + (from.x - articleCenter.x),
      y: targetCenter.y + (from.y - articleCenter.y)
    };
    const pointerId = 9108;
    const { mouse } = elements();
    let pointerIsDown = false;
    focusDemonstration([
      article,
      tourPointRect(targetPoint, 52)
    ], 12);
    positionCardAwayFromPath(from, targetPoint);
    await moveMouse(from, 260, runId);
    if (runId !== demoRunId) return false;
    try {
      header.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
        isPrimary: true, button: 0, buttons: 1, clientX: from.x, clientY: from.y
      }));
      pointerIsDown = true;
      mouse?.classList.add("pressed");

      const started = performance.now();
      while (runId === demoRunId) {
        const raw = Math.min(1, (performance.now() - started) / Math.max(1, duration));
        const eased = 1 - Math.pow(1 - raw, 2);
        const point = {
          x: from.x + (targetPoint.x - from.x) * eased,
          y: from.y + (targetPoint.y - from.y) * eased
        };
        setTeacherMousePoint(
          point,
          0,
          [],
          "native-graph-node-drag"
        );
        header.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
          isPrimary: true, button: -1, buttons: 1, clientX: point.x, clientY: point.y
        }));
        if (raw >= 1) break;
        await tourNextVisualFrame();
      }

      if (runId !== demoRunId) return false;

      header.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
        isPrimary: true, button: 0, buttons: 0,
        clientX: targetPoint.x, clientY: targetPoint.y
      }));
      pointerIsDown = false;
      return true;
    } finally {
      if (pointerIsDown) {
        header.dispatchEvent(new PointerEvent("pointercancel", {
          bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
          isPrimary: true, button: 0, buttons: 0,
          clientX: from.x, clientY: from.y
        }));
      }
      mouse?.classList.remove("pressed");
    }
  }

  async function nativeGraphNodeResizeTowardMinimum(article, runId) {
    const handle = article?.querySelector(
      ".rml-graph-node-resize-handle.both"
    );
    if (!handle || runId !== demoRunId) return false;
    const scale = Math.max(
      .001,
      Number(window.RMLDynamicGraphHost?.getState?.()?.viewport?.scale) || 1
    );
    const rect = article.getBoundingClientRect();
    const minimumWidth = Number(article.dataset.resizeMinWidth);
    const minimumHeight = Number(article.dataset.resizeMinHeight);
    const currentWidth = rect.width / scale;
    const currentHeight = rect.height / scale;
    if (
      !Number.isFinite(minimumWidth) ||
      !Number.isFinite(minimumHeight) ||
      (
        currentWidth - minimumWidth < 8 &&
        currentHeight - minimumHeight < 8
      )
    ) {
      return false;
    }

    const from = centerOf(handle);
    const to = {
      x: from.x + (minimumWidth - currentWidth) * scale,
      y: from.y + (minimumHeight - currentHeight) * scale
    };
    const pointerId = 9109;
    const mouse = elements().mouse;
    showDemoLabel(
      "Use the real resize handle only because the full-size node has no wire-clear placement",
      from
    );
    await moveMouse(from, 260, runId);
    if (runId !== demoRunId) return false;
    handle.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: from.x,
      clientY: from.y
    }));
    mouse?.classList.add("pressed");
    const duration = 460;
    const started = performance.now();
    while (runId === demoRunId) {
      const raw = Math.min(1, (performance.now() - started) / duration);
      const eased = 1 - Math.pow(1 - raw, 2);
      const point = {
        x: from.x + (to.x - from.x) * eased,
        y: from.y + (to.y - from.y) * eased
      };
      setTeacherMousePoint(
        point,
        0,
        [],
        "native-graph-node-resize"
      );
      handle.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "mouse",
        isPrimary: true,
        button: -1,
        buttons: 1,
        clientX: point.x,
        clientY: point.y
      }));
      if (raw >= 1) break;
      await tourNextVisualFrame();
    }
    if (runId !== demoRunId) {
      handle.dispatchEvent(new PointerEvent("pointercancel", {
        bubbles: true,
        cancelable: true,
        pointerId,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons: 0,
        clientX: to.x,
        clientY: to.y
      }));
      mouse?.classList.remove("pressed");
      return false;
    }
    handle.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true,
      cancelable: true,
      pointerId,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 0,
      clientX: to.x,
      clientY: to.y
    }));
    mouse?.classList.remove("pressed");
    await nextTwoFrames();
    tourDebugRecord("graph-route-native-node-resize-used", {
      nodeId: article.dataset.graphNodeId || "",
      before: { width: currentWidth, height: currentHeight },
      requestedMinimum: { width: minimumWidth, height: minimumHeight },
      after: tourDebugRect(
        document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(article.dataset.graphNodeId || "")}"]`
        )
      ),
      reason: "no full-size wire-clear placement was available"
    });
    return true;
  }


  async function nativeGraphPointerDrag(
    startElement,
    targetTarget,
    duration,
    runId,
    pointerId = 9110
  ) {
    if (
      !startElement ||
      !targetTarget ||
      runId !== demoRunId
    ) {
      return false;
    }

    if (
      !startElement.isConnected ||
      !graphDemoVisible(startElement)
    ) {
      graphDemoError(
        "Pointer drag was asked to start from a stale or invisible graph socket.",
        {
          connected:
            Boolean(startElement.isConnected),
          visible:
            graphDemoVisible(startElement),
          nodeId:
            startElement.dataset?.nodeId || "",
          portId:
            startElement.dataset?.portId || "",
          direction:
            startElement.dataset?.direction || ""
        }
      );
    }

    const resolveTargetPoint = () => {
      const resolved =
        typeof targetTarget === "function"
          ? targetTarget()
          : targetTarget;
      return resolved instanceof Element
        ? centerOf(resolved)
        : resolved;
    };
    const initialTargetPoint =
      resolveTargetPoint();
    if (
      !Number.isFinite(initialTargetPoint?.x) ||
      !Number.isFinite(initialTargetPoint?.y)
    ) {
      graphDemoError(
        "Pointer drag could not resolve a live target point before pointerdown."
      );
    }
    const from = centerOf(startElement);
    const { mouse } = elements();
    let pointerIsDown = false;
    let previewObserved = false;
    const graphHost =
      window.RMLDynamicGraphHost;
    const fastBranchDrag = pointerId === 9311;

    focusDemonstration([
      startElement,
      targetTarget instanceof Element
        ? targetTarget
        : tourPointRect(initialTargetPoint, 46)
    ], 12);
    positionCardAwayFromPath(from, initialTargetPoint);
    pulseAt(startElement);
    showDemoLabel(
      `Start on the real ${String(startElement.dataset.direction || "socket").toUpperCase()} port`,
      from
    );

    const leadInDuration = fastBranchDrag ? 180 : 360;
    await moveMouse(from, leadInDuration, runId);
    if (runId !== demoRunId) return false;

    await wait(fastBranchDrag ? 40 : 180);
    if (runId !== demoRunId) return false;

    try {
      graphHost
        ?.setGuidedAutoPanSuppressed?.(
          true
        );
      graphHost
        ?.setGuidedAutomaticNodeCreationSuppressed?.(
          true
        );
      startElement.dispatchEvent(
        new PointerEvent(
          "pointerdown",
          {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: from.x,
            clientY: from.y
          }
        )
      );

      pointerIsDown = true;
      const armedInteraction =
        graphHost?.getGuidedInteractionState?.() || null;
      if (
        armedInteraction?.kind !== "connection" ||
        armedInteraction?.pointerId !== pointerId
      ) {
        if (fastBranchDrag) {
          graphStep11Failure(
            "native NOT connection did not start"
          );
        }
        return false;
      }
      mouse?.classList.add(
        "active",
        "pressed"
      );

      await wait(fastBranchDrag ? 32 : 100);
      if (runId !== demoRunId) {
        return false;
      }

      const travelDistance = Math.hypot(
        initialTargetPoint.x - from.x,
        initialTargetPoint.y - from.y
      );
      const effectiveDuration = Math.max(
        duration,
        Math.min(2300, 980 + travelDistance * 1.35)
      );
      const started = performance.now();

      while (runId === demoRunId) {
        const liveTargetPoint =
          resolveTargetPoint() ||
          initialTargetPoint;
        const raw = Math.min(
          1,
          (performance.now() - started) /
            Math.max(1, effectiveDuration)
        );
        const eased =
          1 - Math.pow(1 - raw, 2.4);
        const point = {
          x:
            from.x +
            (liveTargetPoint.x - from.x) * eased,
          y:
            from.y +
            (liveTargetPoint.y - from.y) * eased
        };

        setTeacherMousePoint(
          point,
          0,
          [],
          "native-graph-wire-drag"
        );

        startElement.dispatchEvent(
          new PointerEvent(
            "pointermove",
            {
              bubbles: true,
              cancelable: true,
              pointerId,
              pointerType: "mouse",
              isPrimary: true,
              button: -1,
              buttons: 1,
              clientX: point.x,
              clientY: point.y
            }
          )
        );

        previewObserved =
          previewObserved ||
          Boolean(
            document.querySelector(
              ".rml-graph-wire-preview"
            )
          );

        if (raw >= 1) break;
        await tourNextVisualFrame();
      }

      if (runId !== demoRunId) {
        return false;
      }

      const finalTargetPoint =
        resolveTargetPoint() ||
        initialTargetPoint;

      startElement.dispatchEvent(
        new PointerEvent(
          "pointerup",
          {
            bubbles: true,
            cancelable: true,
            pointerId,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons: 0,
            clientX: finalTargetPoint.x,
            clientY: finalTargetPoint.y
          }
        )
      );

      pointerIsDown = false;
      await nextTwoFrames();

      return (
        runId === demoRunId &&
        previewObserved
      );
    } finally {
      if (pointerIsDown) {
        startElement.dispatchEvent(
          new PointerEvent(
            "pointercancel",
            {
              bubbles: true,
              cancelable: true,
              pointerId,
              pointerType: "mouse",
              isPrimary: true,
              button: 0,
              buttons: 0,
              clientX: from.x,
              clientY: from.y
            }
          )
        );
      }

      mouse?.classList.remove("pressed");
      graphHost
        ?.setGuidedAutoPanSuppressed?.(
          false
        );
      graphHost
        ?.setGuidedAutomaticNodeCreationSuppressed?.(
          false
        );
    }
  }

  function graphSvgPathPoint(path, fraction = .5) {
    if (!path || typeof path.getTotalLength !== "function") return centerOf(path);
    const length = path.getTotalLength();
    const local = path.getPointAtLength(length * Math.max(0, Math.min(1, fraction)));
    const matrix = path.getScreenCTM?.();
    if (!matrix) return { x: local.x, y: local.y };
    const point = new DOMPoint(local.x, local.y).matrixTransform(matrix);
    return { x: point.x, y: point.y };
  }

  function graphDemoRectDistance(point, rect, padding = 0) {
    if (!rect) return Infinity;

    const left = rect.left - padding;
    const right = rect.right + padding;
    const top = rect.top - padding;
    const bottom = rect.bottom + padding;

    const dx =
      point.x < left
        ? left - point.x
        : point.x > right
          ? point.x - right
          : 0;

    const dy =
      point.y < top
        ? top - point.y
        : point.y > bottom
          ? point.y - bottom
          : 0;

    if (dx === 0 && dy === 0) return 0;
    return Math.hypot(dx, dy);
  }

  function graphDemoRectWireAnalysis(
    rect,
    {
      clearance = 16,
      paths = null,
      ignoredPaths = []
    } = {}
  ) {
    if (!rect) {
      return {
        blocked: false,
        pathCount: 0,
        sampleCount: 0,
        minimumClearance: Infinity
      };
    }
    const ignored = new Set(ignoredPaths.filter(Boolean));
    const candidates = (Array.isArray(paths)
      ? paths
      : [...document.querySelectorAll(".rml-graph-wire-hit")]
    ).filter(path =>
      path instanceof Element &&
      graphDemoVisible(path) &&
      !ignored.has(path) &&
      typeof path.getTotalLength === "function"
    );
    let blocked = false;
    let sampleCount = 0;
    let minimumClearance = Infinity;

    for (const path of candidates) {
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch {
        continue;
      }
      const samples = Math.max(18, Math.ceil(length / 9));
      for (let index = 0; index <= samples; index += 1) {
        const point = graphSvgPathPoint(path, index / samples);
        const distance = graphDemoRectDistance(point, rect, 0);
        minimumClearance = Math.min(minimumClearance, distance);
        sampleCount += 1;
        if (distance <= clearance) blocked = true;
      }
    }

    return {
      blocked,
      pathCount: candidates.length,
      sampleCount,
      minimumClearance: Number.isFinite(minimumClearance)
        ? minimumClearance
        : null,
      requiredClearance: clearance
    };
  }

  function graphDemoPointToSegmentDistance(point, from, to) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared <= .0001) {
      return Math.hypot(point.x - from.x, point.y - from.y);
    }
    const progress = Math.max(
      0,
      Math.min(
        1,
        (
          (point.x - from.x) * dx +
          (point.y - from.y) * dy
        ) / lengthSquared
      )
    );
    const projected = {
      x: from.x + dx * progress,
      y: from.y + dy * progress
    };
    return Math.hypot(
      point.x - projected.x,
      point.y - projected.y
    );
  }

  function graphDemoPointRouteAnalysis(
    point,
    {
      ignoredNodes = [],
      ignoredPoints = [],
      ignoredPaths = [],
      nodeClearance = 24,
      pointClearance = 30,
      lineClearance = 14
    } = {}
  ) {
    const ignoredNodeSet = new Set(ignoredNodes.filter(Boolean));
    const ignoredPointSet = new Set(ignoredPoints.filter(Boolean));
    const ignoredPathSet = new Set(ignoredPaths.filter(Boolean));
    const nodes = [...document.querySelectorAll(".rml-graph-node")]
      .filter(node =>
        graphDemoVisible(node) &&
        !ignoredNodeSet.has(node)
      );
    const routePoints = [...document.querySelectorAll(".rml-graph-wire-point")]
      .filter(routePoint =>
        graphDemoVisible(routePoint) &&
        !ignoredPointSet.has(routePoint)
      );
    const paths = [...document.querySelectorAll(".rml-graph-wire-hit")]
      .filter(path =>
        graphDemoVisible(path) &&
        !ignoredPathSet.has(path) &&
        typeof path.getTotalLength === "function"
      );

    let minimumNodeClearance = Infinity;
    let nodeCovered = false;
    for (const node of nodes) {
      const distance = graphDemoRectDistance(
        point,
        node.getBoundingClientRect(),
        0
      );
      minimumNodeClearance = Math.min(minimumNodeClearance, distance);
      if (distance === 0) nodeCovered = true;
    }

    let minimumPointClearance = Infinity;
    for (const routePoint of routePoints) {
      minimumPointClearance = Math.min(
        minimumPointClearance,
        Math.hypot(
          point.x - centerOf(routePoint).x,
          point.y - centerOf(routePoint).y
        )
      );
    }

    let minimumLineClearance = Infinity;
    for (const path of paths) {
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch {
        continue;
      }
      const samples = Math.max(24, Math.ceil(length / 8));
      for (let index = 0; index <= samples; index += 1) {
        const sample = graphSvgPathPoint(path, index / samples);
        minimumLineClearance = Math.min(
          minimumLineClearance,
          Math.hypot(point.x - sample.x, point.y - sample.y)
        );
      }
    }

    const nodeBlocked = minimumNodeClearance <= nodeClearance;
    const pointBlocked = minimumPointClearance <= pointClearance;
    const lineBlocked = minimumLineClearance <= lineClearance;
    return {
      nodeCovered,
      nodeBlocked,
      pointBlocked,
      lineBlocked,
      pointProtected: !nodeBlocked && !pointBlocked,
      fullyClear: !nodeBlocked && !pointBlocked && !lineBlocked,
      minimumNodeClearance: Number.isFinite(minimumNodeClearance)
        ? minimumNodeClearance
        : null,
      minimumPointClearance: Number.isFinite(minimumPointClearance)
        ? minimumPointClearance
        : null,
      minimumLineClearance: Number.isFinite(minimumLineClearance)
        ? minimumLineClearance
        : null,
      requiredNodeClearance: nodeClearance,
      requiredPointClearance: pointClearance,
      requiredLineClearance: lineClearance
    };
  }

  function graphDemoRouteSegmentAnalysis(
    from,
    to,
    {
      ignoredPaths = [],
      ignoredPoints = [],
      ignoredNodes = [],
      endpointNodes = null,
      nodeRectOverrides = [],
      nodePadding = 10,
      pointClearance = 22,
      endpointNodeAllowance = 28
    } = {}
  ) {
    const ignoredPathSet = new Set(ignoredPaths.filter(Boolean));
    const ignoredPointSet = new Set(ignoredPoints.filter(Boolean));
    const ignoredNodeSet = new Set(ignoredNodes.filter(Boolean));
    const endpointNodeSet = Array.isArray(endpointNodes)
      ? new Set(endpointNodes.filter(Boolean))
      : null;
    const nodeRectOverrideMap = new Map(
      (nodeRectOverrides || [])
        .filter(entry => entry?.node && entry?.rect)
        .map(entry => [entry.node, entry.rect])
    );
    const nodes = [...document.querySelectorAll(".rml-graph-node")]
      .filter(node => graphDemoVisible(node) && !ignoredNodeSet.has(node));
    const routePoints = [...document.querySelectorAll(".rml-graph-wire-point")]
      .filter(routePoint =>
        graphDemoVisible(routePoint) &&
        !ignoredPointSet.has(routePoint)
      );
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const samples = Math.max(28, Math.ceil(distance / 8));
    let nodeBlocked = false;

    for (const node of nodes) {
      const rect = nodeRectOverrideMap.get(node) ||
        node.getBoundingClientRect();
      const expanded = {
        left: rect.left - nodePadding,
        right: rect.right + nodePadding,
        top: rect.top - nodePadding,
        bottom: rect.bottom + nodePadding
      };
      const inside = [];
      for (let index = 0; index <= samples; index += 1) {
        const progress = index / samples;
        const point = {
          x: from.x + (to.x - from.x) * progress,
          y: from.y + (to.y - from.y) * progress
        };
        inside.push(
          point.x >= expanded.left &&
          point.x <= expanded.right &&
          point.y >= expanded.top &&
          point.y <= expanded.bottom
        );
      }

      let first = inside.indexOf(true);
      let last = inside.lastIndexOf(true);
      if (first < 0) continue;

      if (first === 0) {
        if (endpointNodeSet && !endpointNodeSet.has(node)) {
          nodeBlocked = true;
          break;
        }
        while (first <= last && inside[first]) first += 1;
        const leadingDistance = distance * (first / samples);
        if (leadingDistance > endpointNodeAllowance) {
          nodeBlocked = true;
          break;
        }
      }
      if (last === samples) {
        if (endpointNodeSet && !endpointNodeSet.has(node)) {
          nodeBlocked = true;
          break;
        }
        while (last >= first && inside[last]) last -= 1;
        const trailingDistance = distance * ((samples - last) / samples);
        if (trailingDistance > endpointNodeAllowance) {
          nodeBlocked = true;
          break;
        }
      }
      if (inside.slice(first, last + 1).some(Boolean)) {
        nodeBlocked = true;
        break;
      }
    }

    const pointBlocked = routePoints.some(routePoint =>
      graphDemoPointToSegmentDistance(
        centerOf(routePoint),
        from,
        to
      ) <= pointClearance
    );

    const orientation = (a, b, c) =>
      (b.x - a.x) * (c.y - a.y) -
      (b.y - a.y) * (c.x - a.x);
    const segmentsCross = (a, b, c, d) =>
      orientation(a, b, c) * orientation(a, b, d) < 0 &&
      orientation(c, d, a) * orientation(c, d, b) < 0;
    let lineBlocked = false;
    const paths = [...document.querySelectorAll(".rml-graph-wire-hit")]
      .filter(path =>
        graphDemoVisible(path) &&
        !ignoredPathSet.has(path) &&
        typeof path.getTotalLength === "function"
      );
    for (const path of paths) {
      let previous = graphSvgPathPoint(path, .02);
      for (let index = 1; index <= 40; index += 1) {
        const current = graphSvgPathPoint(path, .02 + index / 40 * .96);
        if (segmentsCross(from, to, previous, current)) {
          lineBlocked = true;
          break;
        }
        previous = current;
      }
      if (lineBlocked) break;
    }

    return {
      nodeBlocked,
      pointBlocked,
      lineBlocked,
      fullyClear: !nodeBlocked && !pointBlocked && !lineBlocked,
      distance,
      endpointNodeAllowance,
      strictEndpointNodeCount: endpointNodeSet?.size ?? null,
      nodeRectOverrideCount: nodeRectOverrideMap.size,
      requiredPointClearance: pointClearance
    };
  }

  function graphDemoPathNodeOcclusion(
    path,
    {
      nodePadding = 6,
      endpointNodeAllowance = 28,
      ignoredNodeIds = [],
      endpointNodeIds = null
    } = {}
  ) {
    if (!path || typeof path.getTotalLength !== "function") {
      return {
        blocked: true,
        pathAvailable: false,
        blockedNodeIds: []
      };
    }
    let length = 0;
    try {
      length = path.getTotalLength();
    } catch {
      return {
        blocked: true,
        pathAvailable: false,
        blockedNodeIds: []
      };
    }
    const samples = Math.max(48, Math.ceil(length / 7));
    const blockedNodeIds = [];
    const ignoredNodeIdSet = new Set(
      (ignoredNodeIds || []).filter(Boolean)
    );
    const endpointNodeIdSet = Array.isArray(endpointNodeIds)
      ? new Set(endpointNodeIds.filter(Boolean))
      : null;
    for (const node of [...document.querySelectorAll(".rml-graph-node")]
      .filter(node =>
        graphDemoVisible(node) &&
        !ignoredNodeIdSet.has(node.dataset.graphNodeId || "")
      )) {
      const rect = node.getBoundingClientRect();
      const expanded = {
        left: rect.left - nodePadding,
        right: rect.right + nodePadding,
        top: rect.top - nodePadding,
        bottom: rect.bottom + nodePadding
      };
      const inside = [];
      for (let index = 0; index <= samples; index += 1) {
        const point = graphSvgPathPoint(path, index / samples);
        inside.push(
          point.x >= expanded.left &&
          point.x <= expanded.right &&
          point.y >= expanded.top &&
          point.y <= expanded.bottom
        );
      }
      let first = inside.indexOf(true);
      let last = inside.lastIndexOf(true);
      if (first < 0) continue;
      if (first === 0) {
        if (
          endpointNodeIdSet &&
          !endpointNodeIdSet.has(node.dataset.graphNodeId || "")
        ) {
          blockedNodeIds.push(node.dataset.graphNodeId || "");
          continue;
        }
        while (first <= last && inside[first]) first += 1;
        if (length * (first / samples) > endpointNodeAllowance) {
          blockedNodeIds.push(node.dataset.graphNodeId || "");
          continue;
        }
      }
      if (last === samples) {
        if (
          endpointNodeIdSet &&
          !endpointNodeIdSet.has(node.dataset.graphNodeId || "")
        ) {
          blockedNodeIds.push(node.dataset.graphNodeId || "");
          continue;
        }
        while (last >= first && inside[last]) last -= 1;
        if (length * ((samples - last) / samples) > endpointNodeAllowance) {
          blockedNodeIds.push(node.dataset.graphNodeId || "");
          continue;
        }
      }
      if (inside.slice(first, last + 1).some(Boolean)) {
        blockedNodeIds.push(node.dataset.graphNodeId || "");
      }
    }
    return {
      blocked: blockedNodeIds.length > 0,
      pathAvailable: true,
      pathLength: length,
      blockedNodeIds,
      nodePadding,
      endpointNodeAllowance,
      strictEndpointNodeIds: endpointNodeIdSet
        ? [...endpointNodeIdSet]
        : null
    };
  }

  function graphDemoConnectionPaths(connectionId) {
    if (!connectionId) return [];
    return [...document.querySelectorAll(
      `.rml-graph-wire-hit[data-connection-id="${CSS.escape(connectionId)}"]`
    )]
      .filter(path =>
        graphDemoVisible(path) &&
        typeof path.getTotalLength === "function"
      )
      .sort((a, b) =>
        Number(a.dataset.segmentIndex || 0) -
        Number(b.dataset.segmentIndex || 0)
      );
  }

  function graphDemoSegmentIntersectionPoint(a, b, c, d) {
    const denominator =
      (b.x - a.x) * (d.y - c.y) -
      (b.y - a.y) * (d.x - c.x);
    if (Math.abs(denominator) < .00001) return null;
    const t = (
      (c.x - a.x) * (d.y - c.y) -
      (c.y - a.y) * (d.x - c.x)
    ) / denominator;
    const u = (
      (c.x - a.x) * (b.y - a.y) -
      (c.y - a.y) * (b.x - a.x)
    ) / denominator;
    if (t <= .015 || t >= .985 || u <= .015 || u >= .985) return null;
    return {
      x: a.x + (b.x - a.x) * t,
      y: a.y + (b.y - a.y) * t
    };
  }

  function graphDemoWireCrossingAnalysis(
    pathEntries,
    authorizedJunctionPoints = []
  ) {
    const samplesFor = path => {
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch {
        return [];
      }
      const count = Math.max(32, Math.ceil(length / 9));
      return Array.from({ length: count + 1 }, (_, index) =>
        graphSvgPathPoint(path, index / count)
      );
    };
    const entries = pathEntries.map(entry => ({
      ...entry,
      samples: samplesFor(entry.path)
    })).filter(entry => entry.samples.length > 1);
    const crossings = [];
    const unique = new Set();

    for (let leftIndex = 0; leftIndex < entries.length; leftIndex += 1) {
      const left = entries[leftIndex];
      for (let rightIndex = leftIndex + 1; rightIndex < entries.length; rightIndex += 1) {
        const right = entries[rightIndex];
        const sameConnection = left.connectionId === right.connectionId;
        if (
          sameConnection &&
          Math.abs(left.segmentIndex - right.segmentIndex) <= 1
        ) {
          continue;
        }
        for (let a = 1; a < left.samples.length; a += 1) {
          for (let b = 1; b < right.samples.length; b += 1) {
            const point = graphDemoSegmentIntersectionPoint(
              left.samples[a - 1],
              left.samples[a],
              right.samples[b - 1],
              right.samples[b]
            );
            if (!point) continue;
            const authorized = authorizedJunctionPoints.some(junction =>
              junction && Math.hypot(
                point.x - junction.x,
                point.y - junction.y
              ) <= 28
            );
            if (authorized) continue;
            const key = `${left.connectionId}:${right.connectionId}:` +
              `${Math.round(point.x / 6)}:${Math.round(point.y / 6)}`;
            if (unique.has(key)) continue;
            unique.add(key);
            crossings.push({
              point,
              selfCrossing: sameConnection,
              firstConnectionId: left.connectionId,
              secondConnectionId: right.connectionId,
              firstSegmentIndex: left.segmentIndex,
              secondSegmentIndex: right.segmentIndex
            });
          }
        }
      }
    }

    return {
      blocked: crossings.length > 0,
      crossingCount: crossings.length,
      crossings
    };
  }

  function graphDemoRouteSceneAnalysis(
    connectionIds,
    authorizedJunctionPoints = []
  ) {
    const state = window.RMLDynamicGraphHost?.getState?.() || null;
    const connectionMap = new Map(
      (state?.connections || []).map(connection => [connection.id, connection])
    );
    const pathEntries = [];
    const pathOcclusions = [];

    for (const connectionId of [...new Set((connectionIds || []).filter(Boolean))]) {
      const connection = connectionMap.get(connectionId) || null;
      const endpointNodeIds = connection?.branchFrom
        ? [connection.toNode]
        : [connection?.fromNode, connection?.toNode];
      const paths = graphDemoConnectionPaths(connectionId);
      if (paths.length === 0) {
        pathOcclusions.push({
          connectionId,
          segmentIndex: null,
          blocked: true,
          pathAvailable: false,
          blockedNodeIds: []
        });
      }
      for (const path of paths) {
        const segmentIndex = Number(path.dataset.segmentIndex || 0);
        const occlusion = graphDemoPathNodeOcclusion(path, {
          nodePadding: 6,
          endpointNodeAllowance: 34,
          endpointNodeIds
        });
        pathEntries.push({ connectionId, segmentIndex, path });
        pathOcclusions.push({ connectionId, segmentIndex, ...occlusion });
      }
    }

    const crossingAnalysis = graphDemoWireCrossingAnalysis(
      pathEntries,
      authorizedJunctionPoints
    );
    const blockedNodeIds = [...new Set(
      pathOcclusions.flatMap(item => item.blockedNodeIds || []).filter(Boolean)
    )];
    const unavailablePathCount = pathOcclusions.filter(
      item => item.pathAvailable !== true
    ).length;
    const blockedPathCount = pathOcclusions.filter(
      item => item.blocked === true
    ).length;
    const penalty =
      unavailablePathCount * 1000000 +
      blockedNodeIds.length * 100000 +
      blockedPathCount * 25000 +
      crossingAnalysis.crossingCount * 75000;

    return {
      clean:
        unavailablePathCount === 0 &&
        blockedNodeIds.length === 0 &&
        crossingAnalysis.blocked === false,
      penalty,
      pathCount: pathEntries.length,
      unavailablePathCount,
      blockedPathCount,
      blockedNodeIds,
      pathOcclusions,
      crossingAnalysis
    };
  }

  function graphDemoBlockedEndpointRepairTargets(
    scene,
    {
      preferredNodeId = "",
      excludedNodeIds = []
    } = {}
  ) {
    const state = window.RMLDynamicGraphHost?.getState?.() || null;
    const connectionMap = new Map(
      (state?.connections || []).map(connection => [connection.id, connection])
    );
    const excluded = new Set(excludedNodeIds.filter(Boolean));
    const candidates = new Map();

    const registerEndpoint = (
      connection,
      endpoint,
      {
        source,
        segmentIndex = null,
        penaltyBias = 0
      } = {}
    ) => {
      if (!connection || !endpoint?.nodeId || excluded.has(endpoint.nodeId)) {
        return;
      }
      const node = document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(endpoint.nodeId)}"]`
      );
      if (!(node instanceof HTMLElement)) return;
      const flip = node.querySelector(".rml-graph-node-flip");
      const nodeState = state?.nodes?.find(item => item.id === endpoint.nodeId);
      const currentLayout = nodeState?.parameters?.portLayout === "mirrored"
        ? "mirrored"
        : "standard";
      const layout = currentLayout === "mirrored"
        ? "standard"
        : "mirrored";
      const existing = candidates.get(endpoint.nodeId) || {
        clean: null,
        penalty: 0,
        nodeId: endpoint.nodeId,
        currentLayout,
        layout,
        canSwitchPorts: flip instanceof HTMLElement,
        flipRequired: true,
        dragRequired: false,
        movement: 0,
        center: centerOf(node),
        graphPosition: {
          x: Number(nodeState?.x) || 0,
          y: Number(nodeState?.y) || 0
        },
        source,
        strategy: "repair-endpoint-route",
        endpointRoles: [],
        blockedConnectionIds: [],
        blockedSegmentIndexes: [],
        repairReasons: [],
        blockedPathCount: 0,
        crossingCount: 0
      };
      existing.canSwitchPorts = Boolean(
        existing.canSwitchPorts || flip instanceof HTMLElement
      );
      existing.endpointRoles.push(endpoint.role);
      existing.blockedConnectionIds.push(connection.id);
      if (segmentIndex !== null && segmentIndex !== undefined) {
        existing.blockedSegmentIndexes.push(segmentIndex);
      }
      existing.repairReasons.push(source);
      if (source === "rendered-endpoint-occlusion") {
        existing.blockedPathCount += 1;
      }
      if (source === "rendered-wire-crossing") {
        existing.crossingCount += 1;
      }
      existing.penalty += penaltyBias;
      candidates.set(endpoint.nodeId, existing);
    };

    for (const occlusion of scene?.pathOcclusions || []) {
      if (occlusion?.blocked !== true) continue;
      const connection = connectionMap.get(occlusion.connectionId) || null;
      if (!connection) continue;
      const endpoints = connection.branchFrom
        ? [{ nodeId: connection.toNode, role: "target" }]
        : [
            { nodeId: connection.fromNode, role: "source" },
            { nodeId: connection.toNode, role: "target" }
          ];
      for (const endpoint of endpoints) {
        if (
          !endpoint.nodeId ||
          excluded.has(endpoint.nodeId) ||
          !occlusion.blockedNodeIds?.includes(endpoint.nodeId)
        ) {
          continue;
        }
        registerEndpoint(connection, endpoint, {
          source: "rendered-endpoint-occlusion",
          segmentIndex: occlusion.segmentIndex,
          penaltyBias: -100000
        });
      }
    }

    for (const crossing of scene?.crossingAnalysis?.crossings || []) {
      const crossingConnectionIds = [...new Set([
        crossing.firstConnectionId,
        crossing.secondConnectionId
      ].filter(Boolean))];
      for (const connectionId of crossingConnectionIds) {
        const connection = connectionMap.get(connectionId) || null;
        if (!connection) continue;
        const endpoints = connection.branchFrom
          ? [{ nodeId: connection.toNode, role: "target" }]
          : [
              { nodeId: connection.fromNode, role: "source" },
              { nodeId: connection.toNode, role: "target" }
            ];
        for (const endpoint of endpoints) {
          registerEndpoint(connection, endpoint, {
            source: "rendered-wire-crossing",
            penaltyBias: -75000
          });
        }
      }
    }

    return [...candidates.values()]
      .map(candidate => ({
        ...candidate,
        endpointRoles: [...new Set(candidate.endpointRoles)],
        blockedConnectionIds: [...new Set(candidate.blockedConnectionIds)],
        blockedSegmentIndexes: [...new Set(candidate.blockedSegmentIndexes)],
        repairReasons: [...new Set(candidate.repairReasons)]
      }))
      .sort((left, right) =>
        Number(right.nodeId === preferredNodeId) -
          Number(left.nodeId === preferredNodeId) ||
        right.blockedPathCount - left.blockedPathCount ||
        right.crossingCount - left.crossingCount ||
        left.nodeId.localeCompare(right.nodeId)
      );
  }

  function graphDemoEndpointNodeRepairOptions(
    nodeId,
    connectionIds
  ) {
    const state = window.RMLDynamicGraphHost?.getState?.() || null;
    const node = document.querySelector(
      `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId || "")}"]`
    );
    const visible = visibleGraphClientRect(12);
    if (!(node instanceof HTMLElement) || !visible || !state) return [];

    const allowedConnectionIds = new Set((connectionIds || []).filter(Boolean));
    const incident = (state.connections || []).flatMap(connection => {
      if (!allowedConnectionIds.has(connection.id)) return [];
      const role = connection.toNode === nodeId
        ? "target"
        : !connection.branchFrom && connection.fromNode === nodeId
          ? "source"
          : "";
      if (!role) return [];
      const paths = graphDemoConnectionPaths(connection.id);
      if (paths.length === 0) return [];
      const terminalPath = role === "source"
        ? paths[0]
        : paths[paths.length - 1];
      const points = Array.isArray(connection.points)
        ? connection.points
        : [];
      const anchorPoint = role === "source"
        ? points[0] || null
        : points[points.length - 1] || null;
      const ignoredPoint = anchorPoint
        ? document.querySelector(
            `.rml-graph-wire-point[data-connection-id="${CSS.escape(connection.id)}"]` +
            `[data-point-id="${CSS.escape(anchorPoint.id)}"]`
          )
        : null;
      const otherEndpointId = role === "source"
        ? connection.toNode
        : connection.fromNode;
      const otherEndpointNode = points.length === 0
        ? document.querySelector(
            `.rml-graph-node[data-graph-node-id="${CSS.escape(otherEndpointId || "")}"]`
          )
        : null;
      const portId = role === "source"
        ? connection.fromPort
        : connection.toPort;
      const direction = role === "source" ? "output" : "input";
      const socket = node.querySelector(
        `.rml-graph-socket[data-direction="${direction}"]` +
        `[data-port-id="${CSS.escape(portId || "")}"]`
      );
      if (!(socket instanceof Element)) return [];
      return [{
        connection,
        role,
        terminalPath,
        ignoredPoint,
        otherEndpointNode,
        socket
      }];
    });
    if (incident.length === 0) return [];

    const nodeRect = node.getBoundingClientRect();
    const nodeCenter = centerOf(node);
    const nodeState = state.nodes?.find(item => item.id === nodeId) || null;
    const currentLayout = nodeState?.parameters?.portLayout === "mirrored"
      ? "mirrored"
      : "standard";
    const flippedLayout = currentLayout === "mirrored"
      ? "standard"
      : "mirrored";
    const canSwitchPorts =
      node.querySelector(".rml-graph-node-flip") instanceof HTMLElement;
    const otherNodeRects = [...document.querySelectorAll(".rml-graph-node")]
      .filter(item => item !== node && graphDemoVisible(item))
      .map(item => item.getBoundingClientRect());
    const ignoredTerminalPaths = [...new Set(
      incident.map(reference => reference.terminalPath).filter(Boolean)
    )];
    const centers = [{ ...nodeCenter, source: "current" }];
    const localDistanceX = Math.max(90, nodeRect.width * .55);
    const localDistanceY = Math.max(84, nodeRect.height * .42);
    for (const [dx, dy] of [
      [-localDistanceX, 0], [localDistanceX, 0],
      [0, -localDistanceY], [0, localDistanceY],
      [-localDistanceX, -localDistanceY],
      [localDistanceX, -localDistanceY],
      [-localDistanceX, localDistanceY],
      [localDistanceX, localDistanceY]
    ]) {
      centers.push({
        x: nodeCenter.x + dx,
        y: nodeCenter.y + dy,
        source: "measured-local-correction"
      });
    }
    for (const yFraction of [.14, .32, .5, .68, .86]) {
      for (const xFraction of [.14, .32, .5, .68, .86]) {
        centers.push({
          x:
            visible.left + nodeRect.width * .5 +
            Math.max(0, visible.width - nodeRect.width) * xFraction,
          y:
            visible.top + nodeRect.height * .5 +
            Math.max(0, visible.height - nodeRect.height) * yFraction,
          source: "measured-endpoint-grid"
        });
      }
    }

    const uniqueCenters = new Map();
    for (const candidate of centers) {
      const key = `${Math.round(candidate.x / 5)}:${Math.round(candidate.y / 5)}`;
      if (!uniqueCenters.has(key)) uniqueCenters.set(key, candidate);
    }

    const options = [];
    for (const candidate of uniqueCenters.values()) {
      const movement = Math.hypot(
        candidate.x - nodeCenter.x,
        candidate.y - nodeCenter.y
      );
      const candidateRect = {
        left: candidate.x - nodeRect.width * .5,
        right: candidate.x + nodeRect.width * .5,
        top: candidate.y - nodeRect.height * .5,
        bottom: candidate.y + nodeRect.height * .5,
        width: nodeRect.width,
        height: nodeRect.height
      };
      const completeInside =
        candidateRect.left >= visible.left &&
        candidateRect.right <= visible.right &&
        candidateRect.top >= visible.top &&
        candidateRect.bottom <= visible.bottom;
      const overlapsNode = otherNodeRects.some(rect => !(
        candidateRect.right + 12 < rect.left ||
        candidateRect.left - 12 > rect.right ||
        candidateRect.bottom + 12 < rect.top ||
        candidateRect.top - 12 > rect.bottom
      ));
      if (!completeInside || overlapsNode) continue;

      const persistentWireAnalysis = graphDemoRectWireAnalysis(candidateRect, {
        clearance: 10,
        ignoredPaths: ignoredTerminalPaths
      });
      const layouts = canSwitchPorts
        ? [currentLayout, flippedLayout]
        : [currentLayout];
      for (const layout of layouts) {
        const routes = incident.map(reference => {
          const currentSocket = centerOf(reference.socket);
          const socketOffset = {
            x: currentSocket.x - nodeCenter.x,
            y: currentSocket.y - nodeCenter.y
          };
          const endpoint = {
            x: candidate.x + (
              layout === currentLayout
                ? socketOffset.x
                : -socketOffset.x
            ),
            y: candidate.y + socketOffset.y
          };
          const anchor = graphSvgPathPoint(
            reference.terminalPath,
            reference.role === "source" ? 1 : 0
          );
          const endpointNodes = [node, reference.otherEndpointNode]
            .filter(Boolean);
          return graphDemoRouteSegmentAnalysis(
            reference.role === "source" ? endpoint : anchor,
            reference.role === "source" ? anchor : endpoint,
            {
              ignoredPaths: ignoredTerminalPaths,
              ignoredPoints: [reference.ignoredPoint].filter(Boolean),
              endpointNodes,
              nodeRectOverrides: [{ node, rect: candidateRect }],
              nodePadding: 8,
              pointClearance: 20,
              endpointNodeAllowance: 34
            }
          );
        });
        const flipRequired = layout !== currentLayout;
        const dragRequired = movement >= 22;
        const clean =
          persistentWireAnalysis.blocked === false &&
          routes.every(route => route.fullyClear === true);
        const penalty =
          (persistentWireAnalysis.blocked ? 120000 : 0) +
          routes.reduce((sum, route) => sum +
            (route.nodeBlocked ? 100000 : 0) +
            (route.lineBlocked ? 75000 : 0) +
            (route.pointBlocked ? 30000 : 0), 0) +
          movement * 4 +
          (flipRequired ? 240 : 0) +
          (dragRequired ? 80 : 0);
        options.push({
          clean,
          penalty,
          nodeId,
          currentLayout,
          layout,
          canSwitchPorts,
          flipRequired,
          dragRequired,
          movement,
          center: { x: candidate.x, y: candidate.y },
          graphPosition: {
            x: Number(nodeState?.x) || 0,
            y: Number(nodeState?.y) || 0
          },
          candidateRect,
          routes,
          persistentWireAnalysis,
          source: candidate.source,
          strategy:
            flipRequired && dragRequired
              ? "switch-ports-and-drag-endpoint-node"
              : flipRequired
                ? "switch-endpoint-ports"
                : dragRequired
                  ? "drag-blocked-endpoint-node"
                  : "keep"
        });
      }
    }

    return options.sort((left, right) =>
      Number(right.clean) - Number(left.clean) ||
      left.penalty - right.penalty ||
      left.movement - right.movement
    );
  }

  function graphDemoBranchPostRouteOptions(
    branchNode,
    junction,
    branchConnectionId
  ) {
    if (!(branchNode instanceof HTMLElement) || !(junction instanceof Element)) {
      return [];
    }
    const visible = visibleGraphClientRect(12);
    const branchInput = [...branchNode.querySelectorAll(
      '.rml-graph-socket[data-direction="input"]'
    )].find(graphDemoVisible) || null;
    if (!visible || !branchInput) return [];

    const nodeRect = branchNode.getBoundingClientRect();
    const nodeCenter = centerOf(branchNode);
    const inputCenter = centerOf(branchInput);
    const currentNodeState = window.RMLDynamicGraphHost
      ?.getState?.()
      ?.nodes?.find(node => node.id === branchNode.dataset.graphNodeId) || null;
    const currentLayout = currentNodeState
      ?.parameters?.portLayout === "mirrored"
        ? "mirrored"
        : "standard";
    const flippedLayout = currentLayout === "mirrored"
      ? "standard"
      : "mirrored";
    const canSwitchPorts =
      branchNode.querySelector(".rml-graph-node-flip") instanceof HTMLElement;
    const inputOffset = {
      x: inputCenter.x - nodeCenter.x,
      y: inputCenter.y - nodeCenter.y
    };
    const junctionCenter = centerOf(junction);
    const ignoredBranchPaths = graphDemoConnectionPaths(branchConnectionId);
    const otherNodeRects = [...document.querySelectorAll(".rml-graph-node")]
      .filter(node => node !== branchNode && graphDemoVisible(node))
      .map(node => node.getBoundingClientRect());
    const centers = [{ ...nodeCenter, source: "current" }];
    const xFractions = [.16, .32, .5, .68, .84];
    const yFractions = [.14, .3, .5, .7, .86];
    for (const yFraction of yFractions) {
      for (const xFraction of xFractions) {
        centers.push({
          x:
            visible.left + nodeRect.width * .5 +
            Math.max(0, visible.width - nodeRect.width) * xFraction,
          y:
            visible.top + nodeRect.height * .5 +
            Math.max(0, visible.height - nodeRect.height) * yFraction,
          source: "measured-grid"
        });
      }
    }

    const uniqueCenters = new Map();
    for (const candidate of centers) {
      const key = `${Math.round(candidate.x / 5)}:${Math.round(candidate.y / 5)}`;
      if (!uniqueCenters.has(key)) uniqueCenters.set(key, candidate);
    }

    const options = [];
    for (const candidate of uniqueCenters.values()) {
      const candidateRect = {
        left: candidate.x - nodeRect.width * .5,
        right: candidate.x + nodeRect.width * .5,
        top: candidate.y - nodeRect.height * .5,
        bottom: candidate.y + nodeRect.height * .5,
        width: nodeRect.width,
        height: nodeRect.height
      };
      const completeInside = Boolean(
        candidateRect.left >= visible.left &&
        candidateRect.right <= visible.right &&
        candidateRect.top >= visible.top &&
        candidateRect.bottom <= visible.bottom
      );
      const overlapsNode = otherNodeRects.some(rect => !(
        candidateRect.right + 12 < rect.left ||
        candidateRect.left - 12 > rect.right ||
        candidateRect.bottom + 12 < rect.top ||
        candidateRect.top - 12 > rect.bottom
      ));
      if (!completeInside || overlapsNode) continue;

      const wireAnalysis = graphDemoRectWireAnalysis(candidateRect, {
        clearance: 12,
        ignoredPaths: ignoredBranchPaths
      });
      const layouts = canSwitchPorts
        ? [currentLayout, flippedLayout]
        : [currentLayout];
      for (const layout of layouts) {
        const endpoint = {
          x: candidate.x + (
            layout === currentLayout ? inputOffset.x : -inputOffset.x
          ),
          y: candidate.y + inputOffset.y
        };
        const route = graphDemoRouteSegmentAnalysis(
          junctionCenter,
          endpoint,
          {
            ignoredPaths: ignoredBranchPaths,
            ignoredPoints: [junction],
            ignoredNodes: [],
            endpointNodes: [branchNode],
            nodeRectOverrides: [{ node: branchNode, rect: candidateRect }],
            nodePadding: 8,
            pointClearance: 20,
            endpointNodeAllowance: 34
          }
        );
        const movement = Math.hypot(
          candidate.x - nodeCenter.x,
          candidate.y - nodeCenter.y
        );
        const flipRequired = layout !== currentLayout;
        const dragRequired = movement >= 22;
        const clean = route.fullyClear && wireAnalysis.blocked === false;
        const penalty =
          (route.nodeBlocked ? 100000 : 0) +
          (route.lineBlocked ? 75000 : 0) +
          (route.pointBlocked ? 30000 : 0) +
          (wireAnalysis.blocked ? 90000 : 0) +
          movement * 4 +
          (flipRequired ? 240 : 0) +
          (dragRequired ? 80 : 0);
        options.push({
          clean,
          penalty,
          nodeId: branchNode.dataset.graphNodeId || "",
          layout,
          currentLayout,
          canSwitchPorts,
          flipRequired,
          dragRequired,
          movement,
          center: { x: candidate.x, y: candidate.y },
          graphPosition: {
            x: Number(currentNodeState?.x) || 0,
            y: Number(currentNodeState?.y) || 0
          },
          endpoint,
          candidateRect,
          route,
          wireAnalysis,
          source: candidate.source,
          strategy:
            flipRequired && dragRequired
              ? "switch-ports-then-drag-node"
              : flipRequired
                ? "switch-ports"
                : dragRequired
                  ? "drag-node"
                  : "keep"
        });
      }
    }

    return options.sort((a, b) =>
      Number(b.clean) - Number(a.clean) ||
      a.penalty - b.penalty ||
      a.movement - b.movement
    );
  }

  function graphDemoRouteCandidateTier(pointAnalysis, routeAnalyses) {
    const routes = routeAnalyses.filter(Boolean);
    const routeNodeBlocked = routes.some(route => route.nodeBlocked);
    const routePointBlocked = routes.some(route => route.pointBlocked);
    const routeLineBlocked = routes.some(route => route.lineBlocked);
    const pointProtected = pointAnalysis.pointProtected;
    const fullyClear =
      pointAnalysis.fullyClear &&
      !routeNodeBlocked &&
      !routePointBlocked &&
      !routeLineBlocked;
    let tier = 4;
    if (fullyClear) {
      tier = 0;
    } else if (
      pointProtected &&
      !routeNodeBlocked &&
      !routePointBlocked
    ) {
      tier = 1;
    } else if (pointProtected) {
      tier = 2;
    } else if (!pointAnalysis.nodeCovered) {
      tier = 3;
    }
    return {
      tier,
      fullyClear,
      pointProtected,
      pointNodeClear: !pointAnalysis.nodeCovered,
      routeNodeBlocked,
      routePointBlocked,
      routeLineBlocked
    };
  }

  function graphDemoSafeEmptyDropPoint(
    viewport,
    sourcePoint,
    {
      prefer = "right",
      reserveWidth = 300,
      reserveHeight = 190,
      allowOccupiedFallback = true,
      ignoredNodes = [],
      returnNullWhenUnavailable = false
    } = {}
  ) {
    const fullViewportRect =
      viewport?.getBoundingClientRect();
    const visibleViewportRect =
      visibleGraphClientRect(0);
    const viewportRect =
      visibleViewportRect &&
      visibleViewportRect.width > 2 &&
      visibleViewportRect.height > 2
        ? visibleViewportRect
        : fullViewportRect;

    if (!viewportRect) {
      return sourcePoint;
    }

    const card = elements().card;
    const cardRect =
      card &&
      tourElementActuallyVisible(card) &&
      !card.classList.contains(
        "rml-setup-card-hidden-during-scene"
      )
        ? card.getBoundingClientRect()
        : null;

    const margin = 18;
    const halfWidth =
      Math.max(110, reserveWidth * .5);
    const halfHeight =
      Math.max(80, reserveHeight * .5);

    const allowed = {
      left:
        viewportRect.left +
        halfWidth +
        margin,
      right:
        viewportRect.right -
        halfWidth -
        margin,
      top:
        viewportRect.top +
        halfHeight +
        margin,
      bottom:
        viewportRect.bottom -
        halfHeight -
        margin
    };

    const ignoredNodeSet = new Set(ignoredNodes.filter(Boolean));
    const visibleNodes =
      [...document.querySelectorAll(
        ".rml-graph-node"
      )]
        .filter(node =>
          graphDemoVisible(node) &&
          !ignoredNodeSet.has(node)
        );

    const nodeRects =
      visibleNodes.map(node =>
        node.getBoundingClientRect()
      );

    const sourceNode =
      visibleNodes.find(node => {
        const rect =
          node.getBoundingClientRect();

        return (
          sourcePoint.x >= rect.left - 3 &&
          sourcePoint.x <= rect.right + 3 &&
          sourcePoint.y >= rect.top - 3 &&
          sourcePoint.y <= rect.bottom + 3
        );
      }) || null;

    const placementBlockedRects =
      [
        cardRect,
        ...nodeRects
      ].filter(Boolean);

    const corridorBlockedRects =
      [
        cardRect,
        ...visibleNodes
          .filter(node =>
            node !== sourceNode
          )
          .map(node =>
            node.getBoundingClientRect()
          )
      ].filter(Boolean);

    const pointToRectOverlap =
      (point, rect, extra = 0) => {
        const candidate = {
          left:
            point.x -
            halfWidth -
            extra,
          right:
            point.x +
            halfWidth +
            extra,
          top:
            point.y -
            halfHeight -
            extra,
          bottom:
            point.y +
            halfHeight +
            extra
        };

        return !(
          candidate.right < rect.left ||
          candidate.left > rect.right ||
          candidate.bottom < rect.top ||
          candidate.top > rect.bottom
        );
      };

    const segmentIntersectsRect =
      (from, to, rect, padding = 18) => {
        const expanded = {
          left: rect.left - padding,
          right: rect.right + padding,
          top: rect.top - padding,
          bottom: rect.bottom + padding
        };

        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const distance =
          Math.hypot(dx, dy);
        const samples =
          Math.max(
            12,
            Math.ceil(distance / 24)
          );

        for (
          let index = 1;
          index < samples;
          index += 1
        ) {
          const t =
            index / samples;
          const x =
            from.x + dx * t;
          const y =
            from.y + dy * t;

          if (
            x >= expanded.left &&
            x <= expanded.right &&
            y >= expanded.top &&
            y <= expanded.bottom
          ) {
            return true;
          }
        }

        return false;
      };

    const viewportTooSmall =
      allowed.left >= allowed.right ||
      allowed.top >= allowed.bottom;

    if (
      viewportTooSmall &&
      !allowOccupiedFallback
    ) {
      if (returnNullWhenUnavailable) return null;
      return {
        x:
          viewportRect.left +
          viewportRect.width * .5,
        y:
          viewportRect.top +
          viewportRect.height * .58
      };
    }

    const stepX =
      Math.max(
        42,
        Math.min(
          76,
          (allowed.right -
            allowed.left) / 8
        )
      );

    const stepY =
      Math.max(
        38,
        Math.min(
          68,
          (allowed.bottom -
            allowed.top) / 7
        )
      );

    const candidates = [];
    const occupiedFallbacks = [];

    for (
      let y = allowed.top;
      y <= allowed.bottom + .5;
      y += stepY
    ) {
      for (
        let x = allowed.left;
        x <= allowed.right + .5;
        x += stepX
      ) {
        const point = { x, y };

        const overlapCount =
          placementBlockedRects.filter(rect =>
            pointToRectOverlap(
              point,
              rect,
              24
            )
          ).length;
        const createdNodeOverlaps =
          overlapCount > 0;
        const pointDirectlyBlocked =
          placementBlockedRects.some(rect =>
            graphDemoRectDistance(
              point,
              rect,
              8
            ) === 0
          );

        const dragPathBlocked =
          corridorBlockedRects.some(rect =>
            segmentIntersectsRect(
              sourcePoint,
              point,
              rect,
              20
            )
          );
        const wirePathBlocked =
          graphDemoSegmentBlocked(
            sourcePoint,
            point,
            [sourceNode, ...ignoredNodeSet].filter(Boolean)
          );
        const candidateRect = {
          left: point.x - halfWidth,
          right: point.x + halfWidth,
          top: point.y - halfHeight,
          bottom: point.y + halfHeight
        };
        const wireFootprint =
          graphDemoRectWireAnalysis(
            candidateRect,
            { clearance: 16 }
          );

        if (
          allowOccupiedFallback &&
          !pointDirectlyBlocked
        ) {
          const centerDistance = Math.hypot(
            point.x -
              (allowed.left + allowed.right) * .5,
            point.y -
              (allowed.top + allowed.bottom) * .5
          );
          occupiedFallbacks.push({
            point,
            score:
              overlapCount * -10000 +
              (dragPathBlocked ? -2400 : 0) +
              (wirePathBlocked ? -1800 : 0) -
              (wireFootprint.blocked ? 50000 : 0) -
              centerDistance
          });
        }

        if (
          createdNodeOverlaps ||
          dragPathBlocked ||
          wirePathBlocked ||
          wireFootprint.blocked
        ) {
          continue;
        }

        const edgeClearance =
          Math.min(
            point.x -
              allowed.left,
            allowed.right -
              point.x,
            point.y -
              allowed.top,
            allowed.bottom -
              point.y
          );

        const nearestBlocked =
          placementBlockedRects.reduce(
            (best, rect) =>
              Math.min(
                best,
                graphDemoRectDistance(
                  point,
                  rect,
                  Math.max(
                    halfWidth,
                    halfHeight
                  ) * .45
                )
              ),
            Infinity
          );

        const sourceDistance =
          Math.hypot(
            point.x -
              sourcePoint.x,
            point.y -
              sourcePoint.y
          );

        const idealDistance =
          Math.min(
            420,
            Math.max(
              220,
              viewportRect.width * .34
            )
          );

        const distancePenalty =
          Math.abs(
            sourceDistance -
            idealDistance
          );

        const directionGain =
          prefer === "left"
            ? sourcePoint.x - point.x
            : point.x - sourcePoint.x;

        const verticalPenalty =
          Math.abs(
            point.y -
            sourcePoint.y
          ) * .15;

        const score =
          Math.min(
            nearestBlocked,
            500
          ) * 5.0 +
          Math.min(
            edgeClearance,
            220
          ) * 2.4 +
          Math.min(
            Number(wireFootprint.minimumClearance) || 0,
            220
          ) * 2.8 +
          directionGain * .55 -
          distancePenalty * .9 -
          verticalPenalty;

        candidates.push({
          point,
          score
        });
      }
    }

    if (candidates.length > 0) {
      candidates.sort(
        (a, b) =>
          b.score - a.score
      );
      return candidates[0].point;
    }

    const radii =
      [220, 280, 340, 400, 460];
    const angles =
      prefer === "left"
        ? [Math.PI, 2.55, 3.72, 2.2, 4.05]
        : [0, .58, -.58, .92, -.92];

    for (const radius of radii) {
      for (const angle of angles) {
        const point = {
          x:
            Math.min(
              allowed.right,
              Math.max(
                allowed.left,
                sourcePoint.x +
                  Math.cos(angle) *
                  radius
              )
            ),
          y:
            Math.min(
              allowed.bottom,
              Math.max(
                allowed.top,
                sourcePoint.y +
                  Math.sin(angle) *
                  radius
              )
            )
        };

        if (
          placementBlockedRects.some(rect =>
            pointToRectOverlap(
              point,
              rect,
              18
            )
          )
        ) {
          continue;
        }

        if (
          corridorBlockedRects.some(rect =>
            segmentIntersectsRect(
              sourcePoint,
              point,
              rect,
              14
            )
          )
        ) {
          continue;
        }

        const candidateRect = {
          left: point.x - halfWidth,
          right: point.x + halfWidth,
          top: point.y - halfHeight,
          bottom: point.y + halfHeight
        };
        if (
          graphDemoRectWireAnalysis(
            candidateRect,
            { clearance: 16 }
          ).blocked
        ) {
          continue;
        }

        return point;
      }
    }

    if (
      allowOccupiedFallback &&
      occupiedFallbacks.length > 0
    ) {
      occupiedFallbacks.sort(
        (a, b) => b.score - a.score
      );
      return occupiedFallbacks[0].point;
    }

    if (allowOccupiedFallback) {
      const compactMargin = Math.max(
        18,
        Math.min(
          34,
          Math.min(
            viewportRect.width,
            viewportRect.height
          ) * .055
        )
      );
      const compact = {
        left:
          viewportRect.left +
          compactMargin,
        right:
          viewportRect.right -
          compactMargin,
        top:
          viewportRect.top +
          compactMargin,
        bottom:
          viewportRect.bottom -
          compactMargin
      };
      const compactCandidates = [];
      const rows = 11;
      const columns = 13;

      for (
        let row = 0;
        row < rows;
        row += 1
      ) {
        for (
          let column = 0;
          column < columns;
          column += 1
        ) {
          const point = {
            x:
              compact.left +
              (compact.right - compact.left) *
                (column / (columns - 1)),
            y:
              compact.top +
              (compact.bottom - compact.top) *
                (row / (rows - 1))
          };
          const directNodeHits =
            placementBlockedRects.filter(rect =>
              graphDemoRectDistance(
                point,
                rect,
                9
              ) === 0
            ).length;
          const hit =
            document.elementFromPoint?.(
              point.x,
              point.y
            ) || null;
          const directWireHit = Boolean(
            hit?.closest?.(
              ".rml-graph-wire-hit, .rml-graph-wire-point"
            )
          );
          const candidateRect = {
            left: point.x - halfWidth,
            right: point.x + halfWidth,
            top: point.y - halfHeight,
            bottom: point.y + halfHeight
          };
          const wireFootprintBlocked =
            graphDemoRectWireAnalysis(
              candidateRect,
              { clearance: 12 }
            ).blocked;
          const nearestNode =
            placementBlockedRects.reduce(
              (best, rect) =>
                Math.min(
                  best,
                  graphDemoRectDistance(
                    point,
                    rect,
                    9
                  )
                ),
              Infinity
            );
          const directionGain =
            prefer === "left"
              ? sourcePoint.x - point.x
              : point.x - sourcePoint.x;
          const sourceDistance =
            Math.hypot(
              point.x - sourcePoint.x,
              point.y - sourcePoint.y
            );

          compactCandidates.push({
            point,
            directlyFree:
              directNodeHits === 0 &&
              !directWireHit &&
              !wireFootprintBlocked,
            score:
              directNodeHits * -100000 +
              (directWireHit ? -50000 : 0) +
              (wireFootprintBlocked ? -75000 : 0) +
              Math.min(nearestNode, 240) * 7 +
              directionGain * .45 -
              Math.abs(sourceDistance - 230) * .18
          });
        }
      }

      compactCandidates.sort(
        (a, b) =>
          Number(b.directlyFree) -
            Number(a.directlyFree) ||
          b.score - a.score
      );
      const compactWinner =
        compactCandidates[0];
      if (compactWinner) {
        return compactWinner.point;
      }
    }

    if (returnNullWhenUnavailable) return null;

    graphDemoError(
      "No fully visible free node-placement area exists for this graph gesture at the current viewport size.",
      {
        viewport:
          viewportRect.toJSON?.() ||
          viewportRect,
        sourcePoint,
        reserveWidth,
        reserveHeight,
        visibleNodes:
          nodeRects.length,
        sourceNode:
          sourceNode
            ? {
                id:
                  sourceNode.dataset.graphNodeId ||
                  "",
                title:
                  graphDemoNodeTitle(sourceNode)
              }
            : null,
        corridorObstacles:
          corridorBlockedRects.length,
        card:
          cardRect?.toJSON?.() ||
          cardRect ||
          null
      }
    );
  }

  function graphDemoSegmentBlocked(
    from,
    to,
    ignoredElements = []
  ) {
    const ignored = new Set(
      ignoredElements.filter(Boolean)
    );
    const blockers = [
      elements().card,
      ...document.querySelectorAll(".rml-graph-node")
    ].filter(
      element =>
        element instanceof Element &&
        graphDemoVisible(element) &&
        !ignored.has(element)
    );

    const distance = Math.hypot(
      to.x - from.x,
      to.y - from.y
    );
    const samples = Math.max(
      18,
      Math.ceil(distance / 14)
    );

    for (let index = 2; index < samples - 1; index += 1) {
      const t = index / samples;
      const point = {
        x: from.x + (to.x - from.x) * t,
        y: from.y + (to.y - from.y) * t
      };

      if (
        blockers.some(element =>
          graphDemoRectDistance(
            point,
            element.getBoundingClientRect(),
            12
          ) === 0
        )
      ) {
      return true;
      }
    }

    const orientation = (a, b, c) =>
      (b.x - a.x) * (c.y - a.y) -
      (b.y - a.y) * (c.x - a.x);
    const segmentsCross = (a, b, c, d) => {
      const abC = orientation(a, b, c);
      const abD = orientation(a, b, d);
      const cdA = orientation(c, d, a);
      const cdB = orientation(c, d, b);
      return (
        abC * abD < 0 &&
        cdA * cdB < 0
      );
    };

    const wires = [
      ...document.querySelectorAll(".rml-graph-wire-hit")
    ].filter(
      path =>
        graphDemoVisible(path) &&
        !ignored.has(path) &&
        typeof path.getTotalLength === "function"
    );

    for (const path of wires) {
      let previous = graphSvgPathPoint(path, .03);
      for (let index = 2; index <= 24; index += 1) {
        const current = graphSvgPathPoint(
          path,
          .03 + index / 25 * .94
        );
        if (segmentsCross(from, to, previous, current)) {
          return true;
        }
        previous = current;
      }
    }

    return false;
  }

  function graphDemoBestWirePoint(
    path,
    targetPoint,
    ignoredElements = []
  ) {
    const candidates = [];
    const visible = visibleGraphClientRect(8);
    const ignoredPaths = [
      path,
      ...ignoredElements.filter(element =>
        element?.matches?.(".rml-graph-wire-hit")
      )
    ].filter(Boolean);
    const ignoredNodes = ignoredElements.filter(element =>
      element?.matches?.(".rml-graph-node")
    );

    for (let fraction = .12; fraction <= .88; fraction += .02) {
      const point = graphSvgPathPoint(path, fraction);
      const pointAnalysis = graphDemoPointRouteAnalysis(
        point,
        { ignoredPaths }
      );
      const routeAnalysis = graphDemoRouteSegmentAnalysis(
        targetPoint,
        point,
        { ignoredPaths, ignoredNodes }
      );
      const priority = graphDemoRouteCandidateTier(
        pointAnalysis,
        [routeAnalysis]
      );
      const distance = Math.hypot(
        point.x - targetPoint.x,
        point.y - targetPoint.y
      );
      const insideVisibleGraph = Boolean(
        visible &&
        point.x >= visible.left &&
        point.x <= visible.right &&
        point.y >= visible.top &&
        point.y <= visible.bottom
      );

      candidates.push({
        point,
        fraction,
        insideVisibleGraph,
        pointAnalysis,
        routeAnalysis,
        priority,
        score:
          -distance -
          Math.abs(fraction - .55) * 120 +
          Math.min(
            Number(pointAnalysis.minimumNodeClearance) || 0,
            180
          ) * 2.2 +
          Math.min(
            Number(pointAnalysis.minimumPointClearance) || 0,
            180
          ) * 2.8
      });
    }

    const visibleCandidates = candidates.filter(
      candidate => candidate.insideVisibleGraph
    );
    visibleCandidates.sort((a, b) =>
      a.priority.tier - b.priority.tier ||
      b.score - a.score
    );
    const best = visibleCandidates[0] || null;
    if (!best) return null;
    const result = best.point;
    result.tourRouteAnalysis = {
      kind: "junction",
      candidateCount: candidates.length,
      visibleCandidateCount: visibleCandidates.length,
      selectedFraction: best.fraction,
      selectedTier: best.priority.tier,
      selectedPriority: best.priority,
      pointAnalysis: best.pointAnalysis,
      routeAnalysis: best.routeAnalysis,
      perfectAvailable: visibleCandidates.some(
        candidate => candidate.priority.tier === 0
      ),
      pointProtectedAvailable: visibleCandidates.some(
        candidate =>
          candidate.priority.pointProtected &&
          candidate.priority.cardBlocked !== true
      ),
      nodeClearPointAvailable: visibleCandidates.some(
        candidate =>
          candidate.priority.pointNodeClear &&
          candidate.priority.cardBlocked !== true
      ),
      nodeClearRouteAvailable: visibleCandidates.some(
        candidate =>
          !candidate.priority.routeNodeBlocked &&
          candidate.priority.cardBlocked !== true
      ),
      pointProtectedNodeClearRouteAvailable: visibleCandidates.some(
        candidate =>
          candidate.priority.pointProtected &&
          !candidate.priority.routeNodeBlocked &&
          candidate.priority.cardBlocked !== true
      )
    };
    return result;
  }

  function graphDemoSafeBendPoint(
    viewport,
    segmentStart,
    activeSegment = null
  ) {
    const rect = visibleGraphClientRect(0) || viewport.getBoundingClientRect();
    const rawCandidates = [
      { x: segmentStart.x + 110, y: segmentStart.y - 125 },
      { x: segmentStart.x + 110, y: segmentStart.y + 125 },
      { x: segmentStart.x - 110, y: segmentStart.y - 125 },
      { x: segmentStart.x - 110, y: segmentStart.y + 125 },
      { x: segmentStart.x, y: segmentStart.y - 150 },
      { x: segmentStart.x, y: segmentStart.y + 150 }
    ];
    for (const radius of [105, 135, 165, 195]) {
      for (let index = 0; index < 12; index += 1) {
        const angle = index / 12 * Math.PI * 2;
        rawCandidates.push({
          x: segmentStart.x + Math.cos(angle) * radius,
          y: segmentStart.y + Math.sin(angle) * radius
        });
      }
    }
    const unique = new Map();
    for (const point of rawCandidates) {
      const clamped = {
        x: Math.max(rect.left + 44, Math.min(rect.right - 44, point.x)),
        y: Math.max(rect.top + 44, Math.min(rect.bottom - 44, point.y))
      };
      if (
        Math.hypot(
          clamped.x - segmentStart.x,
          clamped.y - segmentStart.y
        ) >= 82
      ) {
        unique.set(
          `${Math.round(clamped.x)}:${Math.round(clamped.y)}`,
          clamped
        );
      }
    }

    const ignoredPaths = activeSegment ? [activeSegment] : [];
    const firstAnchor = activeSegment
      ? graphSvgPathPoint(activeSegment, .06)
      : segmentStart;
    const lastAnchor = activeSegment
      ? graphSvgPathPoint(activeSegment, .94)
      : segmentStart;
    const candidates = [...unique.values()].map(point => {
      const pointAnalysis = graphDemoPointRouteAnalysis(
        point,
        { ignoredPaths }
      );
      const dragAnalysis = graphDemoRouteSegmentAnalysis(
        segmentStart,
        point,
        { ignoredPaths }
      );
      const firstRouteAnalysis = graphDemoRouteSegmentAnalysis(
        firstAnchor,
        point,
        { ignoredPaths }
      );
      const lastRouteAnalysis = graphDemoRouteSegmentAnalysis(
        point,
        lastAnchor,
        { ignoredPaths }
      );
      const priority = graphDemoRouteCandidateTier(
        pointAnalysis,
        [dragAnalysis, firstRouteAnalysis, lastRouteAnalysis]
      );
      const movement = Math.hypot(
        point.x - segmentStart.x,
        point.y - segmentStart.y
      );
      const edgeClearance = Math.min(
        point.x - rect.left,
        rect.right - point.x,
        point.y - rect.top,
        rect.bottom - point.y
      );
      const cardBlocked =
        graphDemoRectDistance(
          point,
          elements().card?.getBoundingClientRect(),
          24
        ) === 0;
      return {
        point,
        pointAnalysis,
        dragAnalysis,
        firstRouteAnalysis,
        lastRouteAnalysis,
        priority: {
          ...priority,
          tier: cardBlocked
            ? Math.max(3, priority.tier)
            : priority.tier,
          cardBlocked
        },
        score:
          -Math.abs(movement - 165) * .8 +
          Math.min(edgeClearance, 180) * 1.4 +
          Math.min(
            Number(pointAnalysis.minimumNodeClearance) || 0,
            180
          ) * 2.0 +
          Math.min(
            Number(pointAnalysis.minimumPointClearance) || 0,
            180
          ) * 2.6
      };
    });

    candidates.sort((a, b) =>
      a.priority.tier - b.priority.tier ||
      Number(a.priority.routeNodeBlocked) -
        Number(b.priority.routeNodeBlocked) ||
      Number(a.priority.routePointBlocked) -
        Number(b.priority.routePointBlocked) ||
      Number(a.priority.routeLineBlocked) -
        Number(b.priority.routeLineBlocked) ||
      b.score - a.score
    );
    const best = candidates[0];
    const result = best?.point || {
      x: Math.max(
        rect.left + 44,
        Math.min(rect.right - 44, segmentStart.x + 90)
      ),
      y: Math.max(
        rect.top + 44,
        Math.min(rect.bottom - 44, segmentStart.y - 110)
      )
    };
    result.tourRouteAnalysis = {
      kind: "bend",
      candidateCount: candidates.length,
      selectedTier: best?.priority.tier ?? 4,
      selectedPriority: best?.priority || null,
      pointAnalysis: best?.pointAnalysis || null,
      dragAnalysis: best?.dragAnalysis || null,
      firstRouteAnalysis: best?.firstRouteAnalysis || null,
      lastRouteAnalysis: best?.lastRouteAnalysis || null,
      perfectAvailable: candidates.some(
        candidate => candidate.priority.tier === 0
      ),
      pointProtectedAvailable: candidates.some(
        candidate =>
          candidate.priority.pointProtected &&
          candidate.priority.cardBlocked !== true
      ),
      nodeClearPointAvailable: candidates.some(
        candidate =>
          candidate.priority.pointNodeClear &&
          candidate.priority.cardBlocked !== true
      ),
      nodeClearRouteAvailable: candidates.some(
        candidate =>
          !candidate.priority.routeNodeBlocked &&
          candidate.priority.cardBlocked !== true
      ),
      pointProtectedNodeClearRouteAvailable: candidates.some(
        candidate =>
          candidate.priority.pointProtected &&
          !candidate.priority.routeNodeBlocked &&
          candidate.priority.cardBlocked !== true
      ),
      candidateTargets: candidates.slice(0, 18).map(candidate => ({
        point: { ...candidate.point },
        tier: candidate.priority.tier,
        priority: { ...candidate.priority },
        score: candidate.score
      }))
    };
    return result;
  }

  async function graphDemoWaitForNewNode(
    beforeIds,
    runId,
    titlePattern = null
  ) {
    for (
      let attempt = 0;
      attempt < 30 &&
      runId === demoRunId;
      attempt += 1
    ) {
      const created =
        [...document.querySelectorAll(
          ".rml-graph-node"
        )].find(node => {
          const id =
            node.dataset.graphNodeId;

          if (
            !id ||
            beforeIds.has(id)
          ) {
            return false;
          }

          return (
            !titlePattern ||
            titlePattern.test(
              graphDemoNodeTitle(node)
            )
          );
        });

      if (
        created &&
        graphDemoVisible(created)
      ) {
        return created;
      }

      await tourNextVisualFrame();
    }

    return null;
  }

  async function graphDemoRealDropToEmpty(
    socket,
    dropPoint,
    runId,
    {
      pointerId,
      expectedTitle = null,
      label = "Drop on empty graph"
    } = {}
  ) {
    if (
      !socket ||
      !dropPoint ||
      runId !== demoRunId
    ) {
      return null;
    }

    const beforeIds =
      new Set(
        [...document.querySelectorAll(
          ".rml-graph-node"
        )].map(
          node =>
            node.dataset.graphNodeId
        )
      );

    showDemoLabel(
      label,
      dropPoint
    );

    const pointerPathObserved =
      await nativeGraphPointerDrag(
        socket,
        dropPoint,
        700,
        runId,
        pointerId
      );

    if (runId !== demoRunId) {
      return null;
    }

    let created =
      await graphDemoWaitForNewNode(
        beforeIds,
        runId,
        expectedTitle
      );

    if (!created) {
      const guaranteed =
        window.RMLDynamicGraphHost
          ?.ensureAutomaticHelper?.(
            {
              nodeId: socket.dataset.nodeId,
              portId: socket.dataset.portId,
              direction:
                socket.dataset.direction,
              side: socket.dataset.side
            },
            dropPoint.x,
            dropPoint.y
          );
      if (!guaranteed?.ok) {
        graphDemoError(
          `Dropping ${socket.dataset.direction || "socket"} on empty graph did not create the expected automatic helper node.`,
          {
            socket: socket.dataset,
            dropPoint,
            pointerPathObserved,
            deterministicFallback:
              guaranteed || null,
            expectedTitle:
              expectedTitle?.source ||
              null
          }
        );
      }
      await nextTwoFrames();
      created =
        document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(guaranteed.nodeId)}"]`
        ) ||
        await graphDemoWaitForNewNode(
          beforeIds,
          runId,
          expectedTitle
        );
    }

    if (!created) {
      graphDemoError(
        "The graph engine reported a helper node, but no real rendered node was found."
      );
    }

    await nextTwoFrames();

    const createdId =
      created.dataset.graphNodeId || "";
    if (
      createdId &&
      !graphTeachingElementInsideViewport(
        created,
        6
      )
    ) {
      window.RMLDynamicGraphHost
        ?.setNodeClientCenter?.(
          createdId,
          dropPoint.x,
          dropPoint.y
        );
      await nextTwoFrames();
      created =
        document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(createdId)}"]`
        ) || created;
    }

    if (
      createdId &&
      !graphTeachingElementInsideViewport(
        created,
        4
      )
    ) {
      quietlyFitGraphNodes(
        [
          ...graphTeachingNodeIdsFromState(),
          createdId
        ],
        {
          inset: 14,
          padding: 20,
          maxScale:
            window.innerWidth < 820
              ? .78
              : 1.0
        }
      );
      await nextTwoFrames();
      created =
        document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(createdId)}"]`
        ) || created;
    }

    if (
      !graphTeachingElementInsideViewport(
        created,
        2
      )
    ) {
      graphDemoError(
        "The automatic helper exists but could not be rendered inside the visible graph viewport.",
        {
          created:
            tourDebugRect(created),
          visibleGraph:
            visibleGraphClientRect(0),
          dropPoint
        }
      );
    }

    pulseAt(
      created,
      "rml-setup-demo-drop"
    );

    return created;
  }

  function graphDemoConnectionFor(output, input) {
    if (!output || !input) return null;

    const graph =
      window.RMLDynamicGraphHost
        ?.getState?.();

    return graph?.connections?.find(
      connection =>
        connection.fromNode === output.dataset.nodeId &&
        connection.fromPort === output.dataset.portId &&
        connection.toNode === input.dataset.nodeId &&
        connection.toPort === input.dataset.portId
    ) || null;
  }

  async function graphDemoWaitForConnection(output, input, runId, attempts = 40) {
    for (let attempt = 0; attempt < attempts && runId === demoRunId; attempt += 1) {
      const connection = graphDemoConnectionFor(output, input);
      if (connection) return connection;
      await tourNextVisualFrame();
    }
    return null;
  }

  function graphNativeWireHit(
    connectionId,
    preferredSegmentIndex = null
  ) {
    if (!connectionId) return null;
    const visible = visibleGraphClientRect(2);
    if (!visible) return null;

    const candidates = [...document.querySelectorAll(
      ".rml-graph-wire-hit"
    )]
      .filter(hit =>
        hit.isConnected &&
        hit.dataset.connectionId === connectionId &&
        typeof hit.getTotalLength === "function"
      )
      .map(hit => {
        let length = 0;
        try {
          length = hit.getTotalLength();
        } catch {
          return null;
        }
        if (length <= 2) return null;

        let visibleSampleCount = 0;
        let centerDistance = Number.POSITIVE_INFINITY;
        const center = {
          x: (visible.left + visible.right) / 2,
          y: (visible.top + visible.bottom) / 2
        };
        for (let index = 0; index <= 48; index += 1) {
          const point = graphSvgPathPoint(
            hit,
            index / 48
          );
          const inside =
            point.x >= visible.left &&
            point.x <= visible.right &&
            point.y >= visible.top &&
            point.y <= visible.bottom;
          if (!inside) continue;
          visibleSampleCount += 1;
          centerDistance = Math.min(
            centerDistance,
            Math.hypot(
              point.x - center.x,
              point.y - center.y
            )
          );
        }
        return {
          hit,
          visibleSampleCount,
          centerDistance,
          segmentIndex: Number(
            hit.dataset.segmentIndex || 0
          )
        };
      })
      .filter(candidate =>
        candidate?.visibleSampleCount > 0
      )
      .sort((a, b) =>
        (
          Number.isInteger(preferredSegmentIndex) &&
          a.segmentIndex === preferredSegmentIndex
            ? -1
            : 0
        ) -
        (
          Number.isInteger(preferredSegmentIndex) &&
          b.segmentIndex === preferredSegmentIndex
            ? -1
            : 0
        ) ||
        b.visibleSampleCount - a.visibleSampleCount ||
        a.centerDistance - b.centerDistance ||
        a.segmentIndex - b.segmentIndex
      );

    return candidates[0]?.hit || null;
  }

  function graphSocketEndpoint(socket) {
    if (!(socket instanceof Element)) {
      return null;
    }
    return {
      nodeId: socket.dataset.nodeId || "",
      portId: socket.dataset.portId || "",
      direction: socket.dataset.direction || "",
      side: socket.dataset.side || ""
    };
  }

  function visibleGraphClientRect(inset = 0) {
    const viewport =
      document.querySelector(
        ".rml-graph-viewport"
      );
    if (!viewport) return null;
    const host =
      viewport.getBoundingClientRect();
    const visual = tourViewport();
    const left = Math.max(
      host.left,
      visual.left
    ) + inset;
    const right = Math.min(
      host.right,
      visual.right
    ) - inset;
    const top = Math.max(
      host.top,
      tourHeaderBottom(),
      visual.top
    ) + inset;
    const bottom = Math.min(
      host.bottom,
      visual.bottom
    ) - inset;

    return {
      left,
      right,
      top,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    };
  }

  function graphLessonMinimumVisibleHeight() {
    return Math.min(
      360,
      Math.max(
        220,
        window.innerHeight * .5
      )
    );
  }

  function graphRenderedWire(connectionId) {
    if (!connectionId) return null;
    return [
      ...document.querySelectorAll(
        `.rml-graph-wire[data-connection-id="${CSS.escape(connectionId)}"]`
      )
    ].find(path => {
      if (
        typeof path.getTotalLength !==
        "function"
      ) {
        return false;
      }
      let length = 0;
      try {
        length = path.getTotalLength();
      } catch {
        return false;
      }
      if (length <= 2) return false;
      const point = graphSvgPathPoint(path, .5);
      const visible = visibleGraphClientRect(2);
      return Boolean(
        visible &&
        point.x >= visible.left &&
        point.x <= visible.right &&
        point.y >= visible.top &&
        point.y <= visible.bottom
      );
    }) || null;
  }

  async function graphWaitForRenderedWire(
    connectionId,
    runId,
    attempts = 48
  ) {
    for (
      let attempt = 0;
      attempt < attempts &&
      runId === demoRunId;
      attempt += 1
    ) {
      const path =
        graphRenderedWire(connectionId);
      if (path) return path;
      await tourNextVisualFrame();
    }
    return null;
  }

  async function ensureGraphConnectionDeterministic(
    output,
    input,
    runId
  ) {
    if (
      !output ||
      !input ||
      runId !== demoRunId
    ) {
      return null;
    }

    let connection =
      await graphDemoWaitForConnection(
        output,
        input,
        runId,
        12
      );
    if (!connection) {
      const committed =
        window.RMLDynamicGraphHost
          ?.ensureConnection?.(
            graphSocketEndpoint(output),
            graphSocketEndpoint(input)
          );
      if (!committed?.ok) {
        graphDemoError(
          "The graph engine rejected the exact demonstrated cable.",
          committed
        );
      }
      await nextTwoFrames();
      connection =
        graphDemoConnectionFor(
          output,
          input
        );
    }

    if (!connection) {
      graphDemoError(
        "The graph state contains no exact cable after the deterministic commit."
      );
    }

    let wire =
      await graphWaitForRenderedWire(
        connection.id,
        runId
      );
    if (!wire) {
      const nodeIds = [
        output.dataset.nodeId,
        input.dataset.nodeId
      ];
      const visible =
        visibleGraphClientRect(28);
      quietlyFitGraphNodes(
        nodeIds,
        {
          inset: 28,
          padding: 36,
          maxScale: Number(
            window.RMLDynamicGraphHost?.getViewportState?.()?.viewport?.scale
          ) || 1
        }
      );
      await nextTwoFrames();
      wire = await graphWaitForRenderedWire(
        connection.id,
        runId,
        24
      );
    }

    if (!wire) {
      graphDemoError(
        "The exact cable exists in graph state, but its real SVG path is not visibly rendered."
      );
    }

    return { connection, wire };
  }

  function graphTeachingElementInsideViewport(element, inset = 26) {
    if (!graphDemoVisible(element)) {
      return false;
    }
    const subject = element.getBoundingClientRect();
    const host = visibleGraphClientRect(inset);
    if (!host || host.width <= 0 || host.height <= 0) {
      return false;
    }
    return (
      subject.left >= host.left &&
      subject.right <= host.right &&
      subject.top >= host.top &&
      subject.bottom <= host.bottom
    );
  }

  async function ensureGraphViewportWindow(runId) {
    const viewport =
      document.querySelector(
        ".rml-graph-viewport"
      );
    if (!viewport || runId !== demoRunId) {
      return false;
    }

    const usable = ({ requireIdealCompactFrame = true } = {}) => {
      const visible =
        visibleGraphClientRect(0);
      const rect = viewport.getBoundingClientRect();
      const compact = window.innerWidth <= 390 || window.innerHeight <= 700;
      const desiredTop = tourHeaderBottom() + 8;
      const availableHeight = Math.max(
        1,
        tourViewport().bottom - desiredTop
      );
      const requiredCompactHeight = Math.min(
        rect.height,
        availableHeight
      );
      const requiredVisibleWidth = compact
        ? Math.min(280, Math.max(72, rect.width - 8))
        : 280;
      const requiredVisibleHeight = compact
        ? Math.min(
            graphLessonMinimumVisibleHeight(),
            Math.max(140, requiredCompactHeight - 8)
          )
        : graphLessonMinimumVisibleHeight();
      const compactWindowFramed = !compact || !requireIdealCompactFrame || Boolean(
        rect.top >= desiredTop - 6 &&
        rect.top <= desiredTop + 18 &&
        visible &&
        visible.height >= requiredCompactHeight - 8
      );
      return Boolean(
        visible &&
        visible.width >= requiredVisibleWidth &&
        visible.height >= requiredVisibleHeight &&
        compactWindowFramed
      );
    };

    for (
      let attempt = 0;
      attempt < 5 && runId === demoRunId;
      attempt += 1
    ) {
      await nextTwoFrames();
      if (usable()) return true;

      const state =
        tourPageRootScrollState();
      const rect =
        viewport.getBoundingClientRect();
      const desiredTop =
        tourHeaderBottom() + 8;

      if (
        !state.scroller ||
        !state.canScrollY ||
        state.maxTop <= 1
      ) {
        continue;
      }

      const desiredScrollTop = Math.max(
        0,
        Math.min(
          state.maxTop,
          state.scroller.scrollTop +
            rect.top - desiredTop
        )
      );
      const beforeTop =
        state.scroller.scrollTop;
      const delta =
        desiredScrollTop - beforeTop;

      if (Math.abs(delta) <= 2) {
        continue;
      }

      tourDebugRecord(
        "preparation-page-scroll-start",
        {
          attempt,
          from: beforeTop,
          to: desiredScrollTop,
          delta,
          graphRect: tourDebugRect(viewport),
          visible: visibleGraphClientRect(0),
          maximumTop: state.maxTop
        }
      );

      if (attempt === 0) {
        await animateTourPageScroll(
          desiredScrollTop,
          Math.min(
            TOUR_SCROLL_TIMING.pageScrollDuration,
            720
          ),
          runId
        );
      } else {
        state.scroller.scrollTop =
          desiredScrollTop;
      }
      await nextTwoFrames();

      tourDebugRecord(
        "preparation-page-scroll-end",
        {
          attempt,
          from: beforeTop,
          to: state.scroller.scrollTop,
          delta:
            state.scroller.scrollTop - beforeTop,
          graphRect: tourDebugRect(viewport),
          visible: visibleGraphClientRect(0),
          maximumTop:
            tourPageRootScrollState().maxTop
        }
      );
    }

    if (runId === demoRunId) {
      try {
        viewport.scrollIntoView({
          block: "start",
          inline: "nearest",
          behavior: "auto"
        });
      } catch {
        viewport.scrollIntoView();
      }
      await nextTwoFrames();
      if (usable()) return true;
    }

    if (usable({ requireIdealCompactFrame: false })) {
      tourDebugRecord(
        "graph-viewport-best-attainable-window",
        {
          graphRect: tourDebugRect(viewport),
          visible: visibleGraphClientRect(0),
          compactViewport:
            window.innerWidth <= 390 || window.innerHeight <= 700,
          policy:
            "accept a fully usable clipped graph window when sticky-header geometry or an open inspector makes exact top alignment impossible; node fitting remains pan-first and zooms only when the measured node bounds cannot fit"
        }
      );
      return true;
    }

    const failedState =
      tourPageRootScrollState();
    tourDebugRecord(
      "graph-viewport-reveal-failed",
      {
        graphRect: tourDebugRect(viewport),
        visible: visibleGraphClientRect(0),
        page: {
          top:
            failedState.scroller?.scrollTop || 0,
          maximumTop: failedState.maxTop,
          canScrollY: failedState.canScrollY
        },
        bodyClasses:
          document.body.className || ""
      }
    );
    return false;
  }

  function quietlyFitGraphNodes(nodeIds, options = {}) {
    const ids = [...new Set((nodeIds || []).filter(Boolean))];
    const visible = visibleGraphClientRect(
      Number.isFinite(options.inset) ? options.inset : 24
    );
    if (
      ids.length === 0 ||
      !visible ||
      visible.width < 72 ||
      visible.height < 120
    ) {
      return false;
    }
    const before = window.RMLDynamicGraphHost
      ?.getViewportState?.()?.viewport || null;
    const panOnly = panGraphNodesIntoVisibleFrame(ids, options);
    if (panOnly.ok === true) {
      tourDebugRecord("graph-camera-pan-first-frame", {
        nodeIds: ids,
        panOnly,
        before,
        after: window.RMLDynamicGraphHost
          ?.getViewportState?.()?.viewport || null,
        zoomFallbackUsed: false,
        policy:
          "preserve graph zoom and node coordinates whenever a camera pan can reveal the required complete node footprints"
      });
      return true;
    }
    if (panOnly.reason !== "current-scale-too-large") {
      tourDebugRecord("graph-camera-pan-first-frame", {
        nodeIds: ids,
        panOnly,
        before,
        zoomFallbackUsed: false,
        failed: true
      });
      return false;
    }
    const currentScale = Number(before?.scale) || 1;
    const requestedMaximum = Number.isFinite(options.maxScale)
      ? Number(options.maxScale)
      : currentScale;
    const fitted = window.RMLDynamicGraphHost
      ?.fitNodesToClientRect?.(
        ids,
        visible,
        {
          padding: Number.isFinite(options.padding) ? options.padding : 34,
          maxScale: Math.min(currentScale, requestedMaximum)
        }
      );
    const after = window.RMLDynamicGraphHost
      ?.getViewportState?.()?.viewport || null;
    tourDebugRecord("graph-camera-final-zoom-fallback", {
      nodeIds: ids,
      panOnly,
      fitted,
      before,
      after,
      zoomFallbackUsed: Boolean(
        fitted?.ok === true &&
        Number(after?.scale) < currentScale - .0005
      ),
      policy:
        "reduce graph zoom only after the measured node bounds prove that panning at the current scale cannot fit the complete required scene; never enlarge during preparation"
    });
    return fitted?.ok === true;
  }

  function panGraphNodesIntoClientRect(nodeIds, clientRect, options = {}) {
    const ids = [...new Set((nodeIds || []).filter(Boolean))];
    const padding = Number.isFinite(options.padding) ? options.padding : 14;
    const host = window.RMLDynamicGraphHost;
    const viewportState = host?.getViewportState?.()?.viewport || null;
    const nodes = ids.map(nodeId => document.querySelector(
      `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
    )).filter(node => node instanceof HTMLElement && graphDemoVisible(node));
    if (
      !clientRect ||
      !viewportState ||
      nodes.length !== ids.length ||
      ids.length === 0
    ) {
      return { ok: false, changed: false, reason: "pan-input-unavailable" };
    }
    const rects = nodes.map(node => node.getBoundingClientRect());
    const bounds = {
      left: Math.min(...rects.map(rect => rect.left)),
      right: Math.max(...rects.map(rect => rect.right)),
      top: Math.min(...rects.map(rect => rect.top)),
      bottom: Math.max(...rects.map(rect => rect.bottom))
    };
    bounds.width = bounds.right - bounds.left;
    bounds.height = bounds.bottom - bounds.top;
    const target = {
      left: clientRect.left + padding,
      right: clientRect.right - padding,
      top: clientRect.top + padding,
      bottom: clientRect.bottom - padding
    };
    const targetWidth = Math.max(1, target.right - target.left);
    const targetHeight = Math.max(1, target.bottom - target.top);
    if (bounds.width > targetWidth || bounds.height > targetHeight) {
      return {
        ok: false,
        changed: false,
        reason: "current-scale-too-large",
        bounds,
        target,
        viewport: viewportState
      };
    }
    let deltaX = 0;
    let deltaY = 0;
    if (bounds.left < target.left) deltaX = target.left - bounds.left;
    else if (bounds.right > target.right) deltaX = target.right - bounds.right;
    if (bounds.top < target.top) deltaY = target.top - bounds.top;
    else if (bounds.bottom > target.bottom) deltaY = target.bottom - bounds.bottom;
    if (Math.abs(deltaX) < .5 && Math.abs(deltaY) < .5) {
      return {
        ok: true,
        changed: false,
        reason: "already-visible-at-current-scale",
        bounds,
        target,
        viewport: viewportState
      };
    }
    const requested = {
      x: Number(viewportState.x || 0) + deltaX,
      y: Number(viewportState.y || 0) + deltaY,
      scale: Number(viewportState.scale || 1)
    };
    if (options.apply === false) {
      return {
        ok: true,
        changed: true,
        reason: "pan-plan-ready-without-commit",
        bounds,
        target,
        before: viewportState,
        requested,
        committed: null
      };
    }
    const committed = host.setViewportState?.(
      requested,
      { persist: true }
    ) || null;
    return {
      ok: committed?.ok === true,
      changed: committed?.ok === true,
      reason: committed?.ok === true
        ? "panned-without-changing-zoom"
        : "pan-commit-failed",
      bounds,
      target,
      before: viewportState,
      requested,
      committed
    };
  }

  function panGraphNodesIntoVisibleFrame(nodeIds, options = {}) {
    const inset = Number.isFinite(options.inset) ? options.inset : 22;
    const visible = visibleGraphClientRect(inset);
    return panGraphNodesIntoClientRect(nodeIds, visible, options);
  }

  async function animateGraphViewportState(
    from,
    to,
    runId,
    options = {}
  ) {
    const host = window.RMLDynamicGraphHost;
    if (!host || !from || !to || runId !== demoRunId) return false;
    const distance = Math.max(
      Math.abs(Number(to.x) - Number(from.x)),
      Math.abs(Number(to.y) - Number(from.y)),
      Math.abs(Number(to.scale) - Number(from.scale)) * 420
    );
    if (distance <= .02) {
      return host.setViewportState?.(to, { persist: true })?.ok === true;
    }

    const duration = Math.max(
      260,
      Math.min(900, Number(options.duration) || 620)
    );
    const started = performance.now();
    tourDebugRecord("graph-visible-camera-animation-start", {
      reason: options.reason || "readable-frame",
      from,
      to,
      duration,
      zoomChanged:
        Math.abs(Number(to.scale) - Number(from.scale)) > .0005
    });

    while (runId === demoRunId) {
      const frame = await tourNextVisualFrame();
      const now = Math.max(performance.now(), frame.timestamp);
      const raw = Math.min(1, (now - started) / duration);
      const eased = raw < .5
        ? 4 * raw * raw * raw
        : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      host.setViewportState?.(
        {
          x: Number(from.x) + (Number(to.x) - Number(from.x)) * eased,
          y: Number(from.y) + (Number(to.y) - Number(from.y)) * eased,
          scale:
            Number(from.scale) +
            (Number(to.scale) - Number(from.scale)) * eased
        },
        { persist: false }
      );
      if (raw >= 1) break;
    }

    if (runId !== demoRunId) return false;
    const committed = host.setViewportState?.(to, { persist: true });
    await nextTwoFrames();
    tourDebugRecord("graph-visible-camera-animation-end", {
      reason: options.reason || "readable-frame",
      committed,
      viewport: host.getViewportState?.()?.viewport || null
    });
    return committed?.ok === true;
  }

  async function animateGraphNodesToReadableFrame(
    nodeIds,
    runId,
    options = {}
  ) {
    const host = window.RMLDynamicGraphHost;
    const visible = visibleGraphClientRect(
      Number.isFinite(options.inset) ? options.inset : 22
    );
    const from = host?.getViewportState?.()?.viewport || null;
    if (!host || !visible || !from || runId !== demoRunId) return false;

    if (options.allowZoomIn === true) {
      const planned = host.fitNodesToClientRect?.(
        [...new Set((nodeIds || []).filter(Boolean))],
        visible,
        {
          padding: Number.isFinite(options.padding) ? options.padding : 30,
          maxScale: Number.isFinite(options.maxScale)
            ? Number(options.maxScale)
            : 1.05,
          apply: false
        }
      );
      if (planned?.ok !== true || !planned.viewport) return false;
      return animateGraphViewportState(
        from,
        planned.viewport,
        runId,
        {
          duration: options.duration,
          reason: options.reason || "final-readable-scene-zoom"
        }
      );
    }

    const panOnly = panGraphNodesIntoVisibleFrame(nodeIds, {
      ...options,
      apply: false
    });
    if (panOnly.ok === true) {
      const panned = panOnly.changed === true
        ? await animateGraphViewportState(
            from,
            panOnly.requested,
            runId,
            {
              duration: options.duration,
              reason: options.reason || "pan-required-nodes-into-view"
            }
          )
        : true;
      tourDebugRecord("graph-natural-frame-pan-only", {
        nodeIds,
        from,
        panOnly,
        to: host.getViewportState?.()?.viewport || null,
        animated: panOnly.changed === true,
        committed: panned,
        policy:
          "natural lesson handoffs pan at the current scale and reserve zoom reduction for geometrically impossible scenes"
      });
      return panned;
    }
    if (panOnly.reason !== "current-scale-too-large") return false;

    const planned = host.fitNodesToClientRect?.(
      [...new Set((nodeIds || []).filter(Boolean))],
      visible,
      {
        padding: Number.isFinite(options.padding) ? options.padding : 30,
        maxScale: Math.min(
          Number(from.scale) || 1,
          Number.isFinite(options.maxScale)
            ? Number(options.maxScale)
            : Number(from.scale) || 1
        ),
        apply: false
      }
    );
    const to = planned?.viewport || null;
    if (planned?.ok !== true || !to) return false;

    tourDebugRecord("graph-natural-frame-animation-start", {
      nodeIds,
      from,
      to,
      duration: Number(options.duration) || 620
    });
    const committed = await animateGraphViewportState(
      from,
      to,
      runId,
      {
        duration: options.duration,
        reason: options.reason || "last-resort-required-node-zoom"
      }
    );
    tourDebugRecord("graph-natural-frame-animation-end", {
      nodeIds,
      committed,
      viewport: host.getViewportState?.()?.viewport || null
    });
    return committed === true;
  }

  function graphTeachingPairCompletelyVisible(pair, inset = 18) {
    return Boolean(
      pair?.boolNode &&
      pair?.notNode &&
      pair?.output &&
      pair?.input &&
      [pair.boolNode, pair.notNode, pair.output, pair.input]
        .every(element => graphTeachingElementInsideViewport(element, inset))
    );
  }

  async function ensureGraphTeachingPairVisible(runId) {
    const viewportReady = await ensureGraphViewportWindow(runId);
    if (runId !== demoRunId) return graphDemoSocketPair(false);
    if (!viewportReady) {
      graphDemoError(
        "The Runtime Graph viewport could not be returned to the visible page before fitting the teaching pair."
      );
    }
    let pair = graphDemoSocketPair(false);
    if (!pair.output || !pair.input) return pair;

    if (!graphTeachingPairCompletelyVisible(pair, 18)) {
      const nodeIds = [
        pair.boolNode?.dataset.graphNodeId,
        pair.notNode?.dataset.graphNodeId
      ].filter(Boolean);
      const before = window.RMLDynamicGraphHost?.getViewportState?.()?.viewport || null;
      const panOnly = panGraphNodesIntoVisibleFrame(
        nodeIds,
        { inset: 22, padding: 12 }
      );
      await nextTwoFrames();
      pair = graphDemoSocketPair(false);
      let zoomFallbackUsed = false;
      let fitted = false;
      if (!graphTeachingPairCompletelyVisible(pair, 18)) {
        const currentScale = Number(
          window.RMLDynamicGraphHost?.getViewportState?.()?.viewport?.scale
        ) || Number(before?.scale) || 1;
        fitted = quietlyFitGraphNodes(
          nodeIds,
          {
            inset: 24,
            padding: window.innerWidth <= 390 || window.innerHeight <= 700
              ? 20
              : 34,
            maxScale: currentScale
          }
        );
        await nextTwoFrames();
        const afterScale = Number(
          window.RMLDynamicGraphHost?.getViewportState?.()?.viewport?.scale
        ) || currentScale;
        zoomFallbackUsed = afterScale < currentScale - .0005;
        pair = graphDemoSocketPair(false);
      }
      tourDebugRecord("graph-teaching-pair-adaptive-frame", {
        nodeIds,
        panOnly,
        fitted,
        zoomFallbackUsed,
        before,
        after: window.RMLDynamicGraphHost?.getViewportState?.()?.viewport || null,
        compactViewport: window.innerWidth <= 390 || window.innerHeight <= 700,
        completePairVisible: graphTeachingPairCompletelyVisible(pair, 12),
        policy:
          "reveal the page, preserve the current zoom with a camera pan when possible, and reduce graph zoom only as the final geometry fallback"
      });
    }

    if (!graphTeachingPairCompletelyVisible(pair, 12)) {
      graphDemoError(
        "The complete cable scene cannot be made visible without hiding a teaching node or endpoint."
      );
    }
    return pair;
  }

  async function runGraphWireDemo(runId) {
    console.info("[RML Tour · Step 8] Connecting the packed Start node to the existing NOT node.", { runId });

    const ensuredPair = await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;
    await wait(120);

    const visiblePair = await ensureGraphTeachingPairVisible(runId);
    if (runId !== demoRunId) return;
    const pair = visiblePair || ensuredPair || graphDemoSocketPair(true);
    const { output, input, sourceNode, targetNode } = pair;
    if (!graphDemoVisible(output) || !graphDemoVisible(input)) {
      graphDemoError("Resolved sockets exist but are not visibly rendered.", {
        output: output?.dataset,
        input: input?.dataset
      });
    }

    const stateNodes = new Map(
      (window.RMLDynamicGraphHost?.getState?.()?.nodes || [])
        .map(node => [node.id, node])
    );
    const sourceState = stateNodes.get(output.dataset.nodeId || "");
    const targetState = stateNodes.get(input.dataset.nodeId || "");
    const reusesPackedStart = Boolean(
      sourceState?.kind === "configuration" &&
      targetState?.kind === "operator" &&
      targetState?.operatorId === "logic.not"
    );
    const reuseVerified = tourDebugAssert(
      "graph-wire-reused-packed-start-output",
      reusesPackedStart,
      {
        sourceNodeId: output.dataset.nodeId || "",
        sourceKind: sourceState?.kind || "",
        sourceTitle: graphDemoNodeTitle(sourceNode),
        sourcePortId: output.dataset.portId || "",
        sourceType: output.dataset.concreteType || "",
        targetNodeId: input.dataset.nodeId || "",
        targetOperatorId: targetState?.operatorId || "",
        targetTitle: graphDemoNodeTitle(targetNode),
        targetPortId: input.dataset.portId || "",
        targetType: input.dataset.concreteType || ""
      }
    );
    if (!reuseVerified) {
      graphDemoError(
        "Step 8 must reuse a compatible packed Start output and the existing NOT input; it will not create substitute source nodes."
      );
    }

    const outputPoint = centerOf(output);
    const inputPoint = centerOf(input);
    pulseAt(output);
    pulseAt(input);
    setRealPortGlow(output, true);
    setRealPortGlow(input, true);
    showDemoLabel("1 · Reuse this REAL packed Start output", outputPoint);

    const pointerPathObserved = await nativeGraphPointerDrag(
      output, input, 1180, runId, 9111
    );
    if (runId !== demoRunId) return;

    const guaranteedCable =
      await ensureGraphConnectionDeterministic(
        output,
        input,
        runId
      );
    if (runId !== demoRunId) return;
    const { connection, wire } =
      guaranteedCable;

    clearRealPortGlows();
    await nextTwoFrames();
    const realWire =
      wire ||
      graphRenderedWire(connection.id) ||
      graphNativeWireHit(connection.id);
    applyGraphConnectionScene(input.dataset.nodeId);
    pulseAt(realWire || input, "rml-setup-demo-drop");
    showDemoLabel(
      pointerPathObserved
        ? "2 · Released on the existing NOT input — one real wire, zero new nodes"
        : "2 · The validated Graph Engine connected Start → NOT with zero new nodes",
      realWire ? graphSvgPathPoint(realWire, .55) : inputPoint
    );
    await wait(1350);
    clearGraphConnectionScene();
    hideMouse();
    console.info(
      "[RML Tour · Step 8] Packed Start → existing NOT completed without adding helper nodes.",
      { runId }
    );
  }


  function setRealPortGlow(socket, active) {
    if (!(socket instanceof Element)) return;
    if (stepPhase === "demonstrating") {
      const actionRow = socket.closest(".rml-graph-port-row");
      actionRow?.classList.remove("rml-setup-real-port-glow");
      actionRow?.style.removeProperty("--rml-setup-port-glow");
      return;
    }

    const styleId = "rml-setup-real-port-glow-style";
    let style = document.getElementById(styleId);

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        .rml-graph-port-row.rml-setup-real-port-glow {
          position: relative;
          z-index: 8;
          border-radius: 8px;
          filter:
            brightness(1.18)
            drop-shadow(0 0 7px var(--rml-setup-port-glow))
            drop-shadow(0 0 15px var(--rml-setup-port-glow));
        }

        .rml-graph-port-row.rml-setup-real-port-glow .rml-graph-socket {
          box-shadow:
            0 0 0 2px rgba(255, 255, 255, 0.82),
            0 0 10px var(--rml-setup-port-glow),
            0 0 22px var(--rml-setup-port-glow) !important;
          transform: scale(1.12);
        }

        .rml-graph-port-row.rml-setup-real-port-glow .rml-graph-port-copy > strong {
          color: #fff !important;
          text-shadow:
            0 0 5px var(--rml-setup-port-glow),
            0 0 12px var(--rml-setup-port-glow),
            0 0 20px var(--rml-setup-port-glow);
        }

        .rml-graph-port-row.rml-setup-real-port-glow .rml-graph-port-copy > small {
          filter: brightness(1.22);
          text-shadow: 0 0 8px var(--rml-setup-port-glow);
        }
      `;
      document.head.appendChild(style);
    }

    const row = socket.closest(".rml-graph-port-row");
    if (!row) return;

    if (active) {
      const color =
        getComputedStyle(socket)
          .getPropertyValue("--port-color")
          .trim() ||
        socket.style.getPropertyValue("--port-color") ||
        "#6ce89b";

      row.style.setProperty(
        "--rml-setup-port-glow",
        color
      );
      row.classList.add(
        "rml-setup-real-port-glow"
      );
    } else {
      row.classList.remove(
        "rml-setup-real-port-glow"
      );
      row.style.removeProperty(
        "--rml-setup-port-glow"
      );
    }
  }

  function clearRealPortGlows() {
    document
      .querySelectorAll(
        ".rml-graph-port-row.rml-setup-real-port-glow"
      )
      .forEach(row => {
        row.classList.remove(
          "rml-setup-real-port-glow"
        );
        row.style.removeProperty(
          "--rml-setup-port-glow"
        );
      });
  }

  function clearGraphConnectionScene() {
    document.querySelectorAll(
      ".rml-setup-connection-node, .rml-setup-connection-wire, .rml-setup-connected-port"
    ).forEach(element => element.classList.remove(
      "rml-setup-connection-node",
      "rml-setup-connection-wire",
      "rml-setup-connected-port"
    ));
  }

  function graphPortTravelSnapshot(socket, fallbackLabel) {
    if (!(socket instanceof Element)) return null;
    const point = centerOf(socket);
    const label =
      socket
        .closest(".rml-graph-port-row")
        ?.querySelector(".rml-graph-port-copy > strong")
        ?.textContent
        ?.trim() ||
      fallbackLabel;
    const color =
      getComputedStyle(socket)
        .getPropertyValue("--port-color")
        .trim() ||
      socket.style.getPropertyValue("--port-color") ||
      "#6ce89b";
    return { point, label, color };
  }

  async function animateGraphPortTravel(
    snapshot,
    targetSocket,
    runId,
    duration = 1280
  ) {
    if (
      !snapshot?.point ||
      !(targetSocket instanceof Element) ||
      runId !== demoRunId
    ) {
      return false;
    }
    const target = centerOf(targetSocket);
    const travel = document.createElement("div");
    travel.className = "rml-setup-port-travel";
    travel.style.setProperty("--travel-color", snapshot.color);
    travel.style.setProperty("--travel-duration", `${duration}ms`);
    travel.style.left = `${snapshot.point.x}px`;
    travel.style.top = `${snapshot.point.y}px`;
    const marker = document.createElement("span");
    const copy = document.createElement("b");
    copy.textContent = snapshot.label;
    travel.append(marker, copy);
    document.body.appendChild(travel);
    await nextTwoFrames();
    if (runId !== demoRunId) {
      travel.remove();
      return false;
    }
    travel.style.left = `${target.x}px`;
    travel.style.top = `${target.y}px`;
    await wait(duration + 90);
    travel.remove();
    return runId === demoRunId;
  }

  function graphConnectionsForNode(nodeId) {
    const state = window.RMLDynamicGraphHost?.getState?.();
    if (!nodeId || !Array.isArray(state?.connections)) return [];
    return state.connections.filter(connection =>
      connection.fromNode === nodeId || connection.toNode === nodeId
    );
  }

  function applyGraphConnectionScene(nodeId, options = {}) {
    clearGraphConnectionScene();
    const connections = graphConnectionsForNode(nodeId);
    const relatedNodeIds = new Set([nodeId]);
    const allowExplanationGlow = stepPhase !== "demonstrating";

    for (const connection of connections) {
      relatedNodeIds.add(connection.fromNode);
      relatedNodeIds.add(connection.toNode);

      if (allowExplanationGlow) {
        document.querySelectorAll(
          `.rml-graph-wire[data-connection-id="${CSS.escape(connection.id)}"]`
        ).forEach(path => path.classList.add("rml-setup-connection-wire"));
      }

      for (const endpoint of [
        { nodeId: connection.fromNode, portId: connection.fromPort, direction: "output" },
        { nodeId: connection.toNode, portId: connection.toPort, direction: "input" }
      ]) {
        if (allowExplanationGlow) {
          document.querySelector(
            `.rml-graph-socket[data-node-id="${CSS.escape(endpoint.nodeId)}"]` +
            `[data-port-id="${CSS.escape(endpoint.portId)}"]` +
            `[data-direction="${endpoint.direction}"]`
          )?.classList.add("rml-setup-connected-port");
        }
      }
    }

    const nodes = [...relatedNodeIds]
      .map(id => document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(id)}"]`
      ))
      .filter(Boolean);
    nodes.forEach(node => {
      if (
        allowExplanationGlow &&
        (
          options.highlightCounterparts !== false ||
          node.dataset.graphNodeId === nodeId
        )
      ) {
        node.classList.add("rml-setup-connection-node");
      }
    });
    return { connections, nodes };
  }

  function graphConnectionSceneNeedsCentering(nodeId) {
    const viewport = document.querySelector(".rml-graph-viewport");
    if (!tourElementActuallyVisible(viewport)) return false;
    const useful = visibleGraphClientRect(34);
    if (!useful || useful.width <= 0 || useful.height <= 0) return true;
    const connections = graphConnectionsForNode(nodeId);
    const nodeIds = new Set([nodeId]);
    connections.forEach(connection => {
      nodeIds.add(connection.fromNode);
      nodeIds.add(connection.toNode);
    });
    const subjects = [...nodeIds]
      .map(id => document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(id)}"]`
      ))
      .filter(Boolean);
    for (const connection of connections) {
      subjects.push(...document.querySelectorAll(
        `.rml-graph-wire[data-connection-id="${CSS.escape(connection.id)}"]`
      ));
    }
    return subjects.some(subject => {
      const rect = subject.getBoundingClientRect();
      return (
        rect.left < useful.left ||
        rect.right > useful.right ||
        rect.top < useful.top ||
        rect.bottom > useful.bottom
      );
    });
  }

  async function runGraphPortFlipDemo(runId) {
    const ensuredPair = await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;

    let teachingPair = await ensureGraphTeachingPairVisible(runId);
    if (runId !== demoRunId) return;
    const graphNodes = [...document.querySelectorAll(".rml-graph-node")];
    let article =
      (teachingPair?.notNode?.querySelector(".rml-graph-node-flip")
        ? teachingPair.notNode
        : null) ||
      graphNodes.find(node =>
        node.querySelector(".rml-graph-node-flip") &&
        graphConnectionsForNode(node.dataset.graphNodeId).length > 0
      ) ||
      [...document.querySelectorAll(".rml-graph-node")].find(node =>
        node.querySelector(".rml-graph-node-flip")
      );

    if (!article) return;

    let nodeId = article.dataset.graphNodeId;
    const graphNodeState = () =>
      window.RMLDynamicGraphHost
        ?.getState?.()
        ?.nodes?.find(
          node => node.id === nodeId
        ) || null;
    const originalPortLayout =
      graphNodeState()?.parameters
        ?.portLayout === "mirrored"
        ? "mirrored"
        : "standard";
    const switchedPortLayout =
      originalPortLayout === "mirrored"
        ? "standard"
        : "mirrored";
    let connectionScene = applyGraphConnectionScene(nodeId, {
      highlightCounterparts: false
    });
    const initiallyHighlightedFlipNodes = [
      ...document.querySelectorAll(
        ".rml-graph-node.rml-setup-connection-node"
      )
    ];
    const targetOnlyHighlighted = tourDebugAssert(
      "graph-flip-targets-not-without-action-glow",
      initiallyHighlightedFlipNodes.length === 0 &&
        /(?:^|\s)NOT(?:\s|$)/i.test(graphDemoNodeTitle(article)) &&
        Boolean(article.querySelector(".rml-graph-node-flip")),
      {
        targetNodeId: nodeId,
        highlightedNodeIds: initiallyHighlightedFlipNodes.map(
          node => node.dataset.graphNodeId || ""
        ),
        targetTitle: graphDemoNodeTitle(article)
      }
    );
    if (!targetOnlyHighlighted) {
      graphDemoError(
        "The port-switch action did not target NOT cleanly without explanatory node glow."
      );
    }
    if (connectionScene.connections.length === 0) {
      const pair = teachingPair || ensuredPair || graphDemoSocketPair(true);
      showDemoLabel(
        "First create one real connection so its complete movement can be demonstrated",
        centerOf(pair.output)
      );
      await nativeGraphPointerDrag(pair.output, pair.input, 1320, runId, 9113);
      if (runId !== demoRunId) return;
      const guaranteed = await ensureGraphConnectionDeterministic(
        pair.output,
        pair.input,
        runId
      );
      const createdConnection = guaranteed?.connection;
      if (!createdConnection) graphDemoError("The real teaching connection was not created before the port switch.");
      await nextTwoFrames();
      teachingPair = graphDemoSocketPair(true);
      if (teachingPair.notNode?.querySelector(".rml-graph-node-flip")) {
        article = teachingPair.notNode;
        nodeId = article.dataset.graphNodeId;
      }
      connectionScene = applyGraphConnectionScene(nodeId, {
        highlightCounterparts: false
      });
    }

    if (graphConnectionSceneNeedsCentering(nodeId)) {
      quietlyFitGraphNodes(
        connectionScene.nodes.map(node => node.dataset.graphNodeId),
        { inset: 24, padding: 34, maxScale: 1.02 }
      );
      await nextTwoFrames();
      article = document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
      );
      if (!article) return;
      connectionScene = applyGraphConnectionScene(nodeId, {
        highlightCounterparts: false
      });
    }

    let flip = article.querySelector(".rml-graph-node-flip");
    let beforeInput = article.querySelector(
      '.rml-graph-socket[data-direction="input"]'
    );
    let beforeOutput = article.querySelector(
      '.rml-graph-socket[data-direction="output"]'
    );

    if (!flip || !beforeInput || !beforeOutput) return;

    const counterpart = connectionScene.nodes.find(node => node !== article);

    clearRealPortGlows();
    setRealPortGlow(beforeInput, true);
    setRealPortGlow(beforeOutput, true);
    const firstInputTravel = graphPortTravelSnapshot(beforeInput, "INPUT");
    const firstOutputTravel = graphPortTravelSnapshot(beforeOutput, "OUTPUT");

    showDemoLabel(
      counterpart
        ? `Watch this complete live connection: ${graphDemoNodeTitle(counterpart)} → ${graphDemoNodeTitle(article)}`
        : "Watch the complete live wire while these REAL ports switch sides",
      counterpart
        ? centerOf(counterpart, .5, .15)
        : centerOf(article)
    );

    await wait(620);
    if (runId !== demoRunId) return;

    await teacherClickElement(
      flip,
      "Click ⇄ — watch the real named ports move",
      runId,
      {
        focus: article,
        keepFocusVisible: true
      }
    );
    if (runId !== demoRunId) return;
    clearRealPortGlows();

    await nextTwoFrames();

    if (runId !== demoRunId) return;

    if (
      graphNodeState()?.parameters
        ?.portLayout !== switchedPortLayout
    ) {
      const forced =
        window.RMLDynamicGraphHost
          ?.setNodePortLayout?.(
            nodeId,
            switchedPortLayout
          );
      if (!forced?.ok) {
        graphDemoError(
          "The graph engine did not apply the demonstrated port switch.",
          forced
        );
      }
      await nextTwoFrames();
    }

    article =
      document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
      );

    if (!article) return;

    connectionScene = applyGraphConnectionScene(nodeId, {
      highlightCounterparts: false
    });

    article.classList.add(
      "rml-setup-flip-active"
    );

    let afterInput =
      article.querySelector(
        '.rml-graph-socket[data-direction="input"]'
      );
    let afterOutput =
      article.querySelector(
        '.rml-graph-socket[data-direction="output"]'
      );

    if (!afterInput || !afterOutput) return;

    showDemoLabel(
      "INPUT and OUTPUT visibly travel to their mirrored sides while the complete real wire stays highlighted",
      centerOf(article, .5, .12)
    );
    await Promise.all([
      animateGraphPortTravel(firstInputTravel, afterInput, runId),
      animateGraphPortTravel(firstOutputTravel, afterOutput, runId)
    ]);
    if (runId !== demoRunId) return;

    setRealPortGlow(afterInput, true);
    setRealPortGlow(afterOutput, true);

    const inputName =
      afterInput
        .closest(".rml-graph-port-row")
        ?.querySelector(".rml-graph-port-copy > strong")
        ?.textContent
        ?.trim() ||
      "Input";

    const outputName =
      afterOutput
        .closest(".rml-graph-port-row")
        ?.querySelector(".rml-graph-port-copy > strong")
        ?.textContent
        ?.trim() ||
      "Output";

    showDemoLabel(
      `${inputName} / ${outputName} switched sides — the highlighted real wire moved with its port`,
      connectionScene.connections.length
        ? centerOf(article, .5, .12)
        : centerOf(article)
    );

    pulseAt(afterInput);
    pulseAt(afterOutput);

    await wait(760);
    if (runId !== demoRunId) return;

    flip =
      article.querySelector(
        ".rml-graph-node-flip"
      );

    if (!flip) return;

    const restoreInputTravel = graphPortTravelSnapshot(afterInput, "INPUT");
    const restoreOutputTravel = graphPortTravelSnapshot(afterOutput, "OUTPUT");

    await teacherClickElement(
      flip,
      "Click ⇄ again → restore the real ports",
      runId,
      {
        focus: article,
        keepFocusVisible: true
      }
    );
    if (runId !== demoRunId) return;
    clearRealPortGlows();

    await nextTwoFrames();

    if (runId !== demoRunId) return;

    if (
      graphNodeState()?.parameters
        ?.portLayout !== originalPortLayout
    ) {
      const forced =
        window.RMLDynamicGraphHost
          ?.setNodePortLayout?.(
            nodeId,
            originalPortLayout
          );
      if (!forced?.ok) {
        graphDemoError(
          "The graph engine did not restore the original port layout.",
          forced
        );
      }
      await nextTwoFrames();
    }

    const restored =
      document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
      );

    connectionScene = applyGraphConnectionScene(nodeId, {
      highlightCounterparts: false
    });

    const restoredInput =
      restored?.querySelector(
        '.rml-graph-socket[data-direction="input"]'
      );
    const restoredOutput =
      restored?.querySelector(
        '.rml-graph-socket[data-direction="output"]'
      );

    if (restoredInput) {
      setRealPortGlow(
        restoredInput,
        true
      );
      pulseAt(restoredInput);
    }

    if (restoredOutput) {
      setRealPortGlow(
        restoredOutput,
        true
      );
      pulseAt(restoredOutput);
    }

    restored?.classList.add(
      "rml-setup-flip-active"
    );

    showDemoLabel(
      "The same named ports now travel back to their original sides",
      centerOf(restored || article, .5, .12)
    );
    await Promise.all([
      animateGraphPortTravel(restoreInputTravel, restoredInput, runId),
      animateGraphPortTravel(restoreOutputTravel, restoredOutput, runId)
    ]);
    if (runId !== demoRunId) return;

    showDemoLabel(
      "Original sides restored — both connected nodes, both endpoints and the complete wire remained visible",
      centerOf(restored || article, .5, .12)
    );

    await wait(720);

    clearRealPortGlows();
    restored?.classList.remove(
      "rml-setup-flip-active"
    );
    article?.classList.remove(
      "rml-setup-flip-active"
    );
    clearGraphConnectionScene();
    hideMouse();
  }

  function graphStep11NodeArticle(nodeId) {
    return nodeId
      ? document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
        )
      : null;
  }

  function graphStep11Socket(nodeId, portId, direction) {
    return nodeId && portId
      ? document.querySelector(
          `.rml-graph-socket[data-node-id="${CSS.escape(nodeId)}"]` +
          `[data-port-id="${CSS.escape(portId)}"]` +
          `[data-direction="${CSS.escape(direction)}"]`
        )
      : null;
  }

  function graphStep11PointInsideVisibleGraph(point, inset = 10) {
    const visible = visibleGraphClientRect(inset);
    return Boolean(
      visible &&
      point &&
      point.x >= visible.left &&
      point.x <= visible.right &&
      point.y >= visible.top &&
      point.y <= visible.bottom
    );
  }

  function graphStep11PointCovered(
    point,
    padding = 8,
    ignoredNodes = []
  ) {
    if (!point) return true;
    const ignoredNodeSet = new Set(ignoredNodes.filter(Boolean));
    const blockers = [
      ...document.querySelectorAll(
        ".rml-graph-node, " +
        ".rml-graph-search-overlay:not([hidden]), " +
        ".rml-graph-toast"
      )
    ].filter(element =>
      element instanceof Element &&
      graphDemoVisible(element) &&
      !ignoredNodeSet.has(element)
    );
    return blockers.some(element =>
      graphDemoRectDistance(
        point,
        element.getBoundingClientRect(),
        padding
      ) === 0
    );
  }

  function graphStep11SegmentVisiblyClear(
    from,
    to,
    {
      ignoredNodes = [],
      nodePadding = 8
    } = {}
  ) {
    if (!from || !to) return false;
    const ignoredNodeSet = new Set(ignoredNodes.filter(Boolean));
    if (
      !graphStep11PointInsideVisibleGraph(from, 6) ||
      !graphStep11PointInsideVisibleGraph(to, 6)
    ) {
      return false;
    }
    const nodeRects = [...document.querySelectorAll(".rml-graph-node")]
      .filter(node =>
        graphDemoVisible(node) &&
        !ignoredNodeSet.has(node)
      )
      .map(node => {
        const rect = node.getBoundingClientRect();
        return {
          left: rect.left - nodePadding,
          right: rect.right + nodePadding,
          top: rect.top - nodePadding,
          bottom: rect.bottom + nodePadding
        };
      });
    return !nodeRects.some(rect =>
      tourSegmentIntersectsRect(from, to, rect)
    );
  }

  function graphStep11Failure(stage, details = {}) {
    graphStep11MarkStage(`failed:${stage}`, details);
    graphDemoError(
      `Step 11 could not complete “${stage}”.`,
      details
    );
  }

  function graphStep11VisibleWireTarget(
    connectionId,
    sourcePoint = null,
    { ignoredNodes = [] } = {}
  ) {
    graphStep11LastWireTargetCandidates = [];
    if (!connectionId) return null;
    const visible = visibleGraphClientRect(14);
    if (!visible) return null;
    const preferred = sourcePoint || {
      x: visible.left + visible.width * .5,
      y: visible.top + visible.height * .5
    };
    const candidates = [];
    const paths = graphDemoConnectionPaths(connectionId);
    const fractions = [
      .5, .45, .55, .4, .6, .35, .65, .3, .7,
      .25, .75, .2, .8, .15, .85, .1, .9, .05, .95
    ];
    for (const path of paths) {
      for (const fraction of fractions) {
        const point = graphSvgPathPoint(path, fraction);
        const hitStack = typeof document.elementsFromPoint === "function"
          ? document.elementsFromPoint(point.x, point.y)
          : [document.elementFromPoint(point.x, point.y)].filter(Boolean);
        const realWireHit = hitStack.some(element =>
          element === path ||
          element?.closest?.(".rml-graph-wire-hit") === path
        );
        const socketAtTarget = hitStack.some(element => {
          const socket = element?.closest?.(".rml-graph-socket");
          const owner = socket?.closest?.(".rml-graph-node");
          return Boolean(socket && !ignoredNodes.includes(owner));
        });
        const blockedByGraphUi = hitStack.some(element =>
          Boolean(element?.closest?.(
            ".rml-graph-toolbar, .rml-graph-toast, " +
            ".rml-graph-search-overlay:not([hidden])"
          ))
        );
        if (socketAtTarget || blockedByGraphUi) continue;
        if (!graphStep11PointInsideVisibleGraph(point, 12)) continue;
        if (graphStep11PointCovered(point, 6, ignoredNodes)) continue;
        if (
          sourcePoint &&
          !graphStep11SegmentVisiblyClear(
            sourcePoint,
            point,
            { ignoredNodes }
          )
        ) continue;

        candidates.push({
          path,
          point,
          fraction,
          segmentIndex: Number(path.dataset.segmentIndex || 0),
          tier: realWireHit ? 0 : 1,
          route: null,
          nativeHit: realWireHit,
          score:
            (realWireHit ? 0 : 1000) +
            Math.hypot(
              point.x - preferred.x,
              point.y - preferred.y
            )
        });
      }
    }

    candidates.sort((left, right) => left.score - right.score);
    graphStep11LastWireTargetCandidates = candidates.slice(0, 3);
    return candidates[0] || null;
  }

  function graphStep11PathInsideVisibleGraph(path, inset = 6) {
    if (!(path instanceof Element)) return false;
    const visible = visibleGraphClientRect(inset);
    if (!visible) return false;
    const rect = path.getBoundingClientRect();
    return Boolean(
      (rect.width > 0 || rect.height > 0) &&
      rect.left >= visible.left &&
      rect.right <= visible.right &&
      rect.top >= visible.top &&
      rect.bottom <= visible.bottom
    );
  }

  function graphStep11RoutePoints(paths) {
    return (paths || []).flatMap(path =>
      [0, .25, .5, .75, 1].map(fraction =>
        graphSvgPathPoint(path, fraction)
      )
    );
  }

  function graphStep11VisibleDropWorkFrame(viewport) {
    const visible = visibleGraphClientRect(10);
    if (!(viewport instanceof HTMLElement) || !visible) {
      return {
        ready: false,
        dropPoint: null,
        reason: "graph-not-visible",
        visibleGraph: visible,
        graphViewport: tourDebugRect(viewport)
      };
    }
    const minimumVisibleWidth = Math.min(96, window.innerWidth * .28);
    const minimumVisibleHeight = Math.min(140, window.innerHeight * .24);
    const graphAreaReady = Boolean(
      visible.width >= minimumVisibleWidth &&
      visible.height >= minimumVisibleHeight
    );
    const metrics = window.RMLDynamicGraphHost
      ?.getOperatorPlacementMetrics?.("logic.not") || null;
    const footprintWidth = Math.max(
      80,
      Number(metrics?.clientWidth) || 280
    );
    const footprintHeight = Math.max(
      72,
      Number(metrics?.clientHeight) || 190
    );
    const pointerOffsetX = Math.max(
      0,
      Math.min(
        footprintWidth,
        Number(metrics?.clientPointerOffsetX) || footprintWidth * .465
      )
    );
    const pointerOffsetY = Math.max(
      0,
      Math.min(
        footprintHeight,
        Number(metrics?.clientPointerOffsetY) || footprintHeight * .185
      )
    );
    const nodeRects = [...document.querySelectorAll(".rml-graph-node")]
      .filter(graphDemoVisible)
      .map(element => element.getBoundingClientRect());
    const controlRects = [...document.querySelectorAll(
      ".rml-graph-toolbar, .rml-graph-panel-toggle, " +
      ".rml-graph-toast, .rml-graph-search-overlay:not([hidden])"
    )]
      .filter(graphDemoVisible)
      .map(element => element.getBoundingClientRect());
    const obstacleRects = [...nodeRects, ...controlRects];
    const fractions = [
      [.72, .5], [.28, .5], [.5, .5],
      [.72, .28], [.28, .28],
      [.72, .72], [.28, .72],
      [.5, .28], [.5, .72]
    ];
    let completeFootprintCandidate = null;
    let pointOnlyFallback = null;
    if (graphAreaReady) {
      for (const [xFactor, yFactor] of fractions) {
        const point = {
          x: visible.left + visible.width * xFactor,
          y: visible.top + visible.height * yFactor
        };
        const pointBlocked = obstacleRects.some(rect =>
          point.x >= rect.left - 8 &&
          point.x <= rect.right + 8 &&
          point.y >= rect.top - 8 &&
          point.y <= rect.bottom + 8
        );
        if (pointBlocked) continue;
        const footprint = {
          left: point.x - pointerOffsetX,
          right: point.x - pointerOffsetX + footprintWidth,
          top: point.y - pointerOffsetY,
          bottom: point.y - pointerOffsetY + footprintHeight,
          width: footprintWidth,
          height: footprintHeight
        };
        const footprintInside = Boolean(
          footprint.left >= visible.left + 6 &&
          footprint.right <= visible.right - 6 &&
          footprint.top >= visible.top + 6 &&
          footprint.bottom <= visible.bottom - 6
        );
        const footprintBlocked = obstacleRects.some(rect => !(
          footprint.right + 10 < rect.left ||
          footprint.left - 10 > rect.right ||
          footprint.bottom + 10 < rect.top ||
          footprint.top - 10 > rect.bottom
        ));
        const candidate = {
          point,
          footprint,
          footprintInside,
          footprintBlocked
        };
        pointOnlyFallback ||= candidate;
        if (footprintInside && !footprintBlocked) {
          completeFootprintCandidate = candidate;
          break;
        }
      }
    }
    const selected = completeFootprintCandidate || pointOnlyFallback;
    const ready = Boolean(selected);
    return {
      ready,
      dropPoint: selected?.point || null,
      dropFootprint: selected?.footprint || null,
      footprintClearBeforeDrop: Boolean(completeFootprintCandidate),
      pointOnlyFallback: Boolean(
        selected && !completeFootprintCandidate
      ),
      reason: ready
        ? completeFootprintCandidate
          ? "visible-complete-not-footprint"
          : "visible-point-with-post-drop-separation"
        : graphAreaReady
          ? "nine-fixed-graph-points-occupied"
          : "graph-area-not-yet-visible-enough",
      visibleGraph: visible,
      graphViewport: tourDebugRect(viewport),
      minimumVisibleWidth,
      minimumVisibleHeight,
      graphAreaReady,
      testedPositions: fractions.length,
      obstacleCount: obstacleRects.length,
      footprintRequiredBeforeDrop: false,
      nodeVisibilityRequired: false,
      lineVisibilityRequired: false
    };
  }

  function graphStep11RenderedNodeRects(ignoredNode = null) {
    return [...document.querySelectorAll(".rml-graph-node")]
      .filter(node => {
        if (!(node instanceof HTMLElement) || node === ignoredNode) {
          return false;
        }
        const style = getComputedStyle(node);
        const rect = node.getBoundingClientRect();
        return node.isConnected &&
          style.display !== "none" &&
          style.visibility !== "hidden" &&
          rect.width > 0 &&
          rect.height > 0;
      })
      .map(node => ({
        node,
        rect: node.getBoundingClientRect()
      }));
  }

  function graphStep11CreatedNodeClearance(article, padding = 10) {
    const visible = visibleGraphClientRect(10);
    const rect = article?.getBoundingClientRect?.() || null;
    const otherNodes = graphStep11RenderedNodeRects(article);
    const overlapping = rect
      ? otherNodes.filter(({ rect: other }) => !(
          rect.right + padding < other.left ||
          rect.left - padding > other.right ||
          rect.bottom + padding < other.top ||
          rect.top - padding > other.bottom
        ))
      : [];
    const completelyVisible = Boolean(
      visible &&
      rect &&
      rect.width > 0 &&
      rect.height > 0 &&
      rect.left >= visible.left &&
      rect.right <= visible.right &&
      rect.top >= visible.top &&
      rect.bottom <= visible.bottom
    );
    return {
      ok: Boolean(completelyVisible && overlapping.length === 0),
      completelyVisible,
      overlapCount: overlapping.length,
      nodeRect: tourDebugRect(article),
      visibleGraph: visible,
      overlappingNodes: overlapping.map(({ node }) => ({
        nodeId: node.dataset.graphNodeId || "",
        title: graphDemoNodeTitle(node),
        rect: tourDebugRect(node)
      }))
    };
  }

  function graphStep11FreeCreatedNodeCenter(article, padding = 12) {
    if (!(article instanceof HTMLElement)) return null;
    const visible = visibleGraphClientRect(12);
    const rect = article.getBoundingClientRect();
    if (
      !visible ||
      rect.width + padding * 2 > visible.width ||
      rect.height + padding * 2 > visible.height
    ) {
      return null;
    }
    const minimumX = visible.left + rect.width * .5 + padding;
    const maximumX = visible.right - rect.width * .5 - padding;
    const minimumY = visible.top + rect.height * .5 + padding;
    const maximumY = visible.bottom - rect.height * .5 - padding;
    const otherRects = graphStep11RenderedNodeRects(article)
      .map(({ rect: other }) => other);
    const current = centerOf(article);
    const fractions = [0, .25, .5, .75, 1];
    const candidates = [];
    for (const yFactor of fractions) {
      for (const xFactor of fractions) {
        const point = {
          x: minimumX + (maximumX - minimumX) * xFactor,
          y: minimumY + (maximumY - minimumY) * yFactor
        };
        const candidateRect = {
          left: point.x - rect.width * .5,
          right: point.x + rect.width * .5,
          top: point.y - rect.height * .5,
          bottom: point.y + rect.height * .5
        };
        const blocked = otherRects.some(other => !(
          candidateRect.right + padding < other.left ||
          candidateRect.left - padding > other.right ||
          candidateRect.bottom + padding < other.top ||
          candidateRect.top - padding > other.bottom
        ));
        if (blocked) continue;
        candidates.push({
          point,
          candidateRect,
          movement: Math.hypot(
            point.x - current.x,
            point.y - current.y
          )
        });
      }
    }
    candidates.sort((left, right) =>
      left.movement - right.movement
    );
    return candidates[0] || null;
  }

  async function graphStep11SeparateCreatedNode(nodeId, runId) {
    let article = graphStep11NodeArticle(nodeId);
    let clearance = graphStep11CreatedNodeClearance(article);
    if (clearance.ok || runId !== demoRunId) {
      return {
        ok: clearance.ok,
        moved: false,
        zoomed: false,
        article,
        clearance
      };
    }

    let target = graphStep11FreeCreatedNodeCenter(article);
    let zoomed = false;
    if (!target && article instanceof HTMLElement) {
      const state = window.RMLDynamicGraphHost?.getState?.() || null;
      const nodeIds = (state?.nodes || [])
        .map(node => node.id)
        .filter(Boolean);
      const visible = visibleGraphClientRect(12);
      const renderedRects = [
        { rect: article.getBoundingClientRect() },
        ...graphStep11RenderedNodeRects(article)
      ].map(({ rect }) => rect);
      const largestWidth = renderedRects.reduce(
        (value, rect) => Math.max(value, rect.width),
        1
      );
      const largestHeight = renderedRects.reduce(
        (value, rect) => Math.max(value, rect.height),
        1
      );
      const itemCount = Math.max(2, renderedRects.length + 1);
      const aspect = Math.max(.5, Math.min(2, (
        Number(visible?.width) || 1
      ) / Math.max(1, Number(visible?.height) || 1)));
      const columns = Math.max(
        2,
        Math.ceil(Math.sqrt(itemCount * aspect))
      );
      const rows = Math.max(2, Math.ceil(itemCount / columns));
      const currentScale = Math.max(
        .08,
        Number(state?.viewport?.scale) || 1
      );
      const zoomFactor = Math.max(
        .12,
        Math.min(
          .72,
          (Number(visible?.width) || largestWidth) /
            Math.max(1, largestWidth * (columns + .6)),
          (Number(visible?.height) || largestHeight) /
            Math.max(1, largestHeight * (rows + .6))
        )
      );
      showDemoLabel(
        "Zoom out once to make a clear place for the new NOT",
        centerOf(article)
      );
      zoomed = await animateGraphNodesToReadableFrame(
        nodeIds,
        runId,
        {
          inset: 12,
          padding: 10,
          maxScale: currentScale * zoomFactor,
          duration: 440,
          allowZoomIn: true,
          reason: "step11-created-not-separation-room"
        }
      );
      await nextTwoFrames();
      article = graphStep11NodeArticle(nodeId);
      clearance = graphStep11CreatedNodeClearance(article);
      target = clearance.ok
        ? null
        : graphStep11FreeCreatedNodeCenter(article);
    }

    if (clearance.ok) {
      return {
        ok: true,
        moved: false,
        zoomed,
        article,
        clearance
      };
    }
    if (!target || !(article instanceof HTMLElement)) {
      graphStep11Failure(
        "no-visible-non-overlapping-place-for-created-not",
        {
          nodeId,
          zoomed,
          clearance,
          policy:
            "one bounded zoom and a fixed five-by-five placement grid"
        }
      );
    }

    showDemoLabel(
      "Move the new NOT clear of the existing nodes",
      centerOf(article)
    );
    const dragged = await nativeGraphNodeDrag(
      article,
      target.point,
      520,
      runId
    );
    await nextTwoFrames();
    article = graphStep11NodeArticle(nodeId);
    clearance = graphStep11CreatedNodeClearance(article);
    let deterministicRepair = null;
    if (!clearance.ok && runId === demoRunId) {
      deterministicRepair = window.RMLDynamicGraphHost
        ?.setNodeClientCenter?.(
          nodeId,
          target.point.x,
          target.point.y
        ) || null;
      await nextTwoFrames();
      article = graphStep11NodeArticle(nodeId);
      clearance = graphStep11CreatedNodeClearance(article);
    }
    if (!clearance.ok) {
      graphStep11Failure(
        "created-not-remained-overlapping-after-visible-drag",
        {
          nodeId,
          zoomed,
          dragged,
          deterministicRepair,
          target,
          clearance
        }
      );
    }
    graphStep11MarkStage("created-not-separated", {
      nodeId,
      zoomed,
      dragged,
      deterministicRepair,
      target,
      clearance
    });
    return {
      ok: true,
      moved: true,
      zoomed,
      dragged,
      deterministicRepair,
      article,
      clearance
    };
  }

  async function graphStep11CreateSimpleBranchNode(runId) {
    const host = window.RMLDynamicGraphHost;
    const viewport = document.querySelector(".rml-graph-viewport");
    if (!(viewport instanceof HTMLElement) || runId !== demoRunId) {
      return null;
    }

    const beforeIds = new Set(
      (host?.getState?.()?.nodes || []).map(node => node.id)
    );
    const palette = await teacherRevealRuntimeGraphPaletteItem(
      "logic.not",
      runId
    );
    const paletteScroll = palette?.closest?.(
      ".rml-graph-palette-scroll"
    );
    const paletteReady = Boolean(
      palette instanceof HTMLElement &&
      paletteScroll instanceof HTMLElement &&
      graphPaletteItemFullyVisible(palette, paletteScroll, 2) &&
      graphPaletteSourceHitPoint(palette, paletteScroll, 2)?.directHit === true
    );
    if (!paletteReady) {
      graphStep11Failure(
        "not-library-item-not-fully-visible-before-pointerdown",
        {
          paletteFound: palette instanceof HTMLElement,
          paletteRect: tourDebugRect(palette),
          paletteScrollRect: tourDebugRect(paletteScroll),
          revealState: graphPaletteRevealState
        }
      );
    }
    graphStep11MarkStage("not-library-item-fully-visible", {
      paletteRect: tourDebugRect(palette),
      paletteScrollRect: tourDebugRect(paletteScroll),
      revealState: graphPaletteRevealState
    });

    let visibleWorkFrame = graphStep11VisibleDropWorkFrame(viewport);
    let finalDropPoint = visibleWorkFrame.ready
      ? visibleWorkFrame.dropPoint
      : null;
    let dragCompleted = false;

    if (palette instanceof HTMLElement && runId === demoRunId) {
      const sourceHit = graphPaletteSourceHitPoint(
        palette,
        paletteScroll,
        2
      );
      const page = tourPageRootScrollState();
      const effect = tourEffectViewport();
      const viewportRect = viewport.getBoundingClientRect();
      const needsHeldPageScroll = Boolean(
        sourceHit?.geometricVisible === true &&
        visibleWorkFrame.ready !== true &&
        page.canScrollY
      );
      if (!needsHeldPageScroll && visibleWorkFrame.ready !== true) {
        graphStep11Failure(
          "complete-graph-drop-area-not-visible-after-not-reveal",
          visibleWorkFrame
        );
      }
      graphStep11MarkStage(
        needsHeldPageScroll
          ? "held-not-scroll-to-graph-start"
          : "graph-drop-area-already-visible",
        visibleWorkFrame
      );
      const direction =
        (viewportRect.top + viewportRect.bottom) * .5 >=
        (effect.top + effect.bottom) * .5
          ? 1
          : -1;
      const pageEdge = {
        x: Math.max(
          effect.left + 28,
          Math.min(effect.right - 28, sourceHit?.point?.x || effect.left + effect.width * .5)
        ),
        y: direction > 0
          ? effect.bottom - 32
          : effect.top + 32
      };
      const initialTarget = needsHeldPageScroll
        ? pageEdge
        : finalDropPoint;

      if (sourceHit?.point && initialTarget) {
        showDemoLabel(
          needsHeldPageScroll
            ? "Keep the real NOT held while the page scrolls to the Runtime Graph"
            : "Drag one real NOT from the Node library into the visible graph",
          sourceHit.point
        );
        let lastScrollAt = -Infinity;
        let lastScrollTop = page.scroller?.scrollTop || 0;
        host?.setGuidedAutoPanSuppressed?.(true);
        try {
          dragCompleted = await nativeUserPointerDrag(
            palette,
            initialTarget,
            980,
            runId,
            9310,
            {
              startPoint: sourceHit.point,
              stageTarget: tourPointRect(initialTarget, 58),
              stageFocusTarget: needsHeldPageScroll
                ? palette.closest(".rml-graph-palette") || palette
                : viewport,
              stageLabel: needsHeldPageScroll
                ? "HOLD AT EDGE · SCROLL TO GRAPH"
                : "VISIBLE RUNTIME GRAPH",
              minimumTeachingDuration: false,
              commitHoldMs: 260,
              edgeHoldMs: needsHeldPageScroll ? 6200 : 0,
              edgeHoldMinMs: needsHeldPageScroll ? 300 : 0,
              onEdgeHoldStart: needsHeldPageScroll
                ? () => elements().mouse?.classList.add("scrolling")
                : null,
              onEdgeHoldFrame: needsHeldPageScroll
                ? ({ point, elapsed }) => {
                    visibleWorkFrame = graphStep11VisibleDropWorkFrame(
                      viewport
                    );
                    finalDropPoint = visibleWorkFrame.ready
                      ? visibleWorkFrame.dropPoint
                      : null;
                    if (visibleWorkFrame.ready) return;
                    const liveRect = viewport.getBoundingClientRect();
                    const liveEffect = tourEffectViewport();
                    const remaining = direction > 0
                      ? Math.max(0, liveRect.top - (liveEffect.top + liveEffect.height * .28))
                      : Math.max(0, (liveEffect.bottom - liveEffect.height * .28) - liveRect.bottom);
                    const deltaY = direction * Math.max(30, Math.min(88, remaining));
                    const wheelTarget = document.elementFromPoint(point.x, point.y) || document.body;
                    dispatchTourWheel(wheelTarget, { deltaY });
                    if (
                      page.scroller &&
                      elapsed - lastScrollAt >= 180 &&
                      Math.abs(page.scroller.scrollTop - lastScrollTop) < 1
                    ) {
                      lastScrollAt = elapsed;
                      page.scroller.scrollTop = Math.max(
                        0,
                        Math.min(page.maxTop, page.scroller.scrollTop + deltaY)
                      );
                    }
                    lastScrollTop = page.scroller?.scrollTop || lastScrollTop;
                  }
                : null,
              edgeHoldUntil: needsHeldPageScroll
                ? () => visibleWorkFrame.ready === true
                : null,
              onEdgeHoldEnd: needsHeldPageScroll
                ? () => elements().mouse?.classList.remove("scrolling")
                : null,
              afterEdgeHold: needsHeldPageScroll
                ? async (_edgePoint, dragContext) => {
                    visibleWorkFrame = graphStep11VisibleDropWorkFrame(
                      viewport
                    );
                    finalDropPoint = visibleWorkFrame.ready
                      ? visibleWorkFrame.dropPoint
                      : null;
                    if (!visibleWorkFrame.ready || !finalDropPoint) {
                      graphStep11MarkStage(
                        "held-scroll-work-frame-not-ready",
                        visibleWorkFrame
                      );
                      return null;
                    }
                    graphStep11MarkStage(
                      "graph-drop-area-fully-visible",
                      visibleWorkFrame
                    );
                    const visible = visibleGraphClientRect(12);
                    const retreat = visible
                      ? {
                          x: visible.left + Math.min(42, visible.width * .14),
                          y: visible.top + Math.min(72, visible.height * .24)
                        }
                      : pageEdge;
                    dragContext?.dispatchMove?.(retreat);
                    await nextTwoFrames();
                    return {
                      startPoint: retreat,
                      point: finalDropPoint,
                      duration: 620,
                      stageTarget: tourPointRect(finalDropPoint, 58),
                      stageLabel: "VISIBLE RUNTIME GRAPH"
                    };
                  }
                : null,
              onBeforeRelease: needsHeldPageScroll
                ? async () => {
                    visibleWorkFrame = graphStep11VisibleDropWorkFrame(
                      viewport
                    );
                    if (!visibleWorkFrame.ready) {
                      graphStep11MarkStage(
                        "held-scroll-release-cancelled",
                        visibleWorkFrame
                      );
                      return { cancel: true };
                    }
                    finalDropPoint = visibleWorkFrame.dropPoint;
                    return null;
                  }
                : null,
              releaseReady: needsHeldPageScroll
                ? async () => graphStep11VisibleDropWorkFrame(
                    viewport
                  ).ready === true
                : null
            }
          );
        } finally {
          elements().mouse?.classList.remove("scrolling");
          host?.setGuidedAutoPanSuppressed?.(false);
        }
        await nextTwoFrames();
      }
      if (needsHeldPageScroll && !dragCompleted) {
        graphStep11Failure(
          "held-page-scroll-did-not-reveal-complete-graph-drop-area",
          graphStep11VisibleDropWorkFrame(viewport)
        );
      }
    }

    const dropState = host?.getGuidedPaletteDropState?.() || null;
    let nodeId = dropState?.ok === true &&
      dropState?.operatorId === "logic.not" &&
      dropState?.pointerId === 9310
        ? String(dropState.nodeId || "")
        : "";
    nodeId ||= (host?.getState?.()?.nodes || []).find(node =>
      !beforeIds.has(node.id) &&
      node.kind === "operator" &&
      node.operatorId === "logic.not"
    )?.id || "";

    if (!nodeId) {
      const deterministicDropFrame =
        graphStep11VisibleDropWorkFrame(viewport);
      finalDropPoint ||= deterministicDropFrame.dropPoint;
      if (!deterministicDropFrame.ready || !finalDropPoint) {
        graphStep11Failure(
          "no-complete-visible-drop-area-for-deterministic-commit",
          deterministicDropFrame
        );
      }
      const fallback = host?.ensureOperatorNode?.(
        "logic.not",
        { allowDuplicate: true }
      ) || null;
      nodeId = fallback?.ok === true ? String(fallback.nodeId || "") : "";
      if (nodeId && finalDropPoint) {
        host?.setNodeClientCenter?.(
          nodeId,
          finalDropPoint.x,
          finalDropPoint.y
        );
      }
      await nextTwoFrames();
    }

    if (!nodeId) return null;

    const visibility = await ensureGraphNodeFullyVisibleAfterCommit(
      nodeId,
      finalDropPoint || centerOf(viewport),
      runId,
      { inset: 10 }
    );
    let article = visibility.node || graphStep11NodeArticle(nodeId);
    const separation = await graphStep11SeparateCreatedNode(
      nodeId,
      runId
    );
    article = separation.article || graphStep11NodeArticle(nodeId) || article;
    if (article instanceof HTMLElement) {
      article.dataset.rmlTourStep10Branch = "true";
      pulseAt(article, "rml-setup-demo-drop");
    }
    return {
      nodeId,
      article,
      dragCompleted,
      fallbackUsed: dragCompleted !== true,
      separation
    };
  }

  function graphStep11PlanBranchNodeAlignment(
    baseConnection,
    branchNodeId
  ) {
    const article = graphStep11NodeArticle(branchNodeId);
    const input = article?.querySelector(
      '.rml-graph-socket[data-direction="input"]'
    );
    const visible = visibleGraphClientRect(12);
    if (
      !(article instanceof HTMLElement) ||
      !(input instanceof Element) ||
      !visible
    ) {
      return null;
    }

    const rect = article.getBoundingClientRect();
    const center = centerOf(article);
    const inputCenter = centerOf(input);
    const inputOffset = {
      x: inputCenter.x - center.x,
      y: inputCenter.y - center.y
    };
    const directTarget = graphStep11VisibleWireTarget(
      baseConnection?.id,
      inputCenter,
      { ignoredNodes: [article] }
    );
    if (directTarget) {
      return {
        strategy: "direct-visible-target",
        nodeCenter: center,
        plannedInput: inputCenter,
        wireTarget: directTarget,
        movement: 0,
        gap: Math.hypot(
          inputCenter.x - directTarget.point.x,
          inputCenter.y - directTarget.point.y
        ),
        verticalOffset: 0,
        route: directTarget.route || null,
        score: 0
      };
    }

    const selectedWireTarget = graphStep11VisibleWireTarget(
      baseConnection?.id,
      null,
      { ignoredNodes: [article] }
    );
    if (!selectedWireTarget) return null;
    const wireTargets = graphStep11LastWireTargetCandidates.length
      ? graphStep11LastWireTargetCandidates.slice(0, 3)
      : [selectedWireTarget];
    const inputSide = input.dataset.side || "left";
    const direction = inputSide === "right" ? -1 : 1;
    const otherRects = [...document.querySelectorAll(".rml-graph-node")]
      .filter(node => node !== article && graphDemoVisible(node))
      .map(node => node.getBoundingClientRect());
    const maximumMovement = window.innerWidth < 360
      ? Math.min(190, Math.hypot(visible.width, visible.height) * .58)
      : window.innerWidth < 480
        ? 148
        : 156;
    const candidates = [];

    for (const wireTarget of wireTargets) {
      const gaps = window.innerWidth < 360 ? [44, 56, 68] : [64, 84];
      const verticalOffsets = window.innerWidth < 360
        ? [0, -24, 24, -40, 40]
        : [0, -36, 36];
      for (const gap of gaps) {
        for (const verticalOffset of verticalOffsets) {
        const plannedInput = {
          x: wireTarget.point.x + direction * gap,
          y: wireTarget.point.y + verticalOffset
        };
        const nodeCenter = {
          x: plannedInput.x - inputOffset.x,
          y: plannedInput.y - inputOffset.y
        };
        const dx = nodeCenter.x - center.x;
        const dy = nodeCenter.y - center.y;
        const movement = Math.hypot(dx, dy);
        const movedRect = {
          left: rect.left + dx,
          right: rect.right + dx,
          top: rect.top + dy,
          bottom: rect.bottom + dy
        };
        const inside =
          movedRect.left >= visible.left &&
          movedRect.right <= visible.right &&
          movedRect.top >= visible.top &&
          movedRect.bottom <= visible.bottom;
        const overlapsNode = otherRects.some(other => !(
          movedRect.right + 10 < other.left ||
          movedRect.left - 10 > other.right ||
          movedRect.bottom + 10 < other.top ||
          movedRect.top - 10 > other.bottom
        ));
        const segmentClear = graphStep11SegmentVisiblyClear(
          plannedInput,
          wireTarget.point,
          { ignoredNodes: [article] }
        );
          if (
            inside &&
            movement <= maximumMovement &&
            !overlapsNode &&
            segmentClear
          ) {
            candidates.push({
              strategy: "bounded-fallback",
              nodeCenter,
              plannedInput,
              wireTarget,
              movement,
              gap,
              verticalOffset,
              route: null,
              score:
                movement +
                Math.abs(verticalOffset) * .35 +
                Math.abs(gap - 72) * .2 +
                wireTarget.tier * 24
            });
          }
        }
      }
    }

    candidates.sort((left, right) => left.score - right.score);
    return candidates[0] || null;
  }

  async function graphStep11PrepareBranchAction(
    baseConnection,
    branchNodeId,
    runId
  ) {
    const article = graphStep11NodeArticle(branchNodeId);
    const input = article?.querySelector(
      '.rml-graph-socket[data-direction="input"]'
    );
    if (!(article instanceof HTMLElement) || !(input instanceof Element)) {
      graphStep11Failure(
        "branch-action-preparation-missing-not-input",
        { branchNodeId }
      );
    }

    let plan = graphStep11PlanBranchNodeAlignment(
      baseConnection,
      branchNodeId
    );
    if (!plan && runId === demoRunId) {
      showDemoLabel(
        "Fit the three live nodes just enough to expose the existing line",
        centerOf(article)
      );
      await animateGraphNodesToReadableFrame(
        (window.RMLDynamicGraphHost?.getState?.()?.nodes || [])
          .map(node => node.id)
          .filter(Boolean),
        runId,
        {
          inset: 8,
          padding: window.innerWidth < 360 ? 10 : 16,
          maxScale: window.innerWidth < 360 ? .68 : .78,
          duration: 420,
          allowZoomIn: false,
          reason: "step11-ultra-small-visible-wire-action-frame"
        }
      );
      await nextTwoFrames();
      plan = graphStep11PlanBranchNodeAlignment(
        baseConnection,
        branchNodeId
      );
    }
    if (!plan) {
      const visibleTarget = graphStep11VisibleWireTarget(
        baseConnection?.id,
        null,
        { ignoredNodes: [article] }
      );
      if (visibleTarget) {
        plan = {
          strategy: "ultra-small-visible-wire",
          nodeCenter: centerOf(article),
          plannedInput: centerOf(input),
          wireTarget: visibleTarget,
          movement: 0,
          gap: Math.hypot(
            centerOf(input).x - visibleTarget.point.x,
            centerOf(input).y - visibleTarget.point.y
          ),
          verticalOffset: 0,
          route: null,
          score: visibleTarget.score
        };
      } else {
        graphStep11Failure(
          "no-visible-wire-segment-after-compact-fit",
          {
            parentConnectionId: baseConnection?.id || "",
            branchNodeId,
            input: graphSocketEndpoint(input),
            reason:
              "The compact visible fit exposed no usable point on the existing wire."
          }
        );
      }
    }

    if (plan.movement >= 10) {
      showDemoLabel(
        "Move the new NOT beside the visible line — one short, useful drag",
        centerOf(article)
      );
      positionCardAwayFromPath(
        centerOf(article),
        plan.nodeCenter
      );
      await nativeGraphNodeDrag(
        article,
        plan.nodeCenter,
        560,
        runId
      );
      await nextTwoFrames();
    }
    if (runId !== demoRunId) return null;

    const liveArticle = graphStep11NodeArticle(branchNodeId);
    const liveInput = liveArticle?.querySelector(
      '.rml-graph-socket[data-direction="input"]'
    );
    const target = plan.movement < 10 && plan.wireTarget?.path?.isConnected
      ? plan.wireTarget
      : liveInput
        ? graphStep11VisibleWireTarget(
            baseConnection.id,
            centerOf(liveInput),
            { ignoredNodes: [liveArticle] }
          )
        : null;
    if (!target) {
      graphStep11Failure(
        "planned-not-position-did-not-produce-a-visible-wire-target",
        {
          parentConnectionId: baseConnection.id,
          branchNodeId,
          input: graphSocketEndpoint(liveInput)
        }
      );
    }
    return {
      target,
      nodeMoved: plan.movement >= 10,
      plannedMovement: plan.movement
    };
  }

  function graphStep11BranchProof(
    parentConnectionId,
    branchNodeId,
    inputPortId
  ) {
    const state = window.RMLDynamicGraphHost?.getState?.();
    const connection = state?.connections?.find(item =>
      item.toNode === branchNodeId &&
      item.toPort === inputPortId &&
      item.branchFrom?.connectionId === parentConnectionId
    ) || null;
    const parent = state?.connections?.find(item =>
      item.id === parentConnectionId
    ) || null;
    const junction = parent?.points?.find(point =>
      point.id === connection?.branchFrom?.pointId
    ) || null;
    const junctionHandle = junction
      ? document.querySelector(
          `.rml-graph-wire-point.junction` +
          `[data-connection-id="${CSS.escape(parentConnectionId)}"]` +
          `[data-point-id="${CSS.escape(junction.id)}"]`
        )
      : null;
    const parentPaths = graphDemoConnectionPaths(parentConnectionId);
    const branchPaths = graphDemoConnectionPaths(connection?.id);
    const branchPath = branchPaths[0] || null;
    const branchNode = graphStep11NodeArticle(branchNodeId);
    const branchInput = graphStep11Socket(
      branchNodeId,
      inputPortId,
      "input"
    );
    const parentOutput = graphStep11Socket(
      parent?.fromNode,
      parent?.fromPort,
      "output"
    );
    const parentInput = graphStep11Socket(
      parent?.toNode,
      parent?.toPort,
      "input"
    );
    const allNodesVisible = [...document.querySelectorAll(".rml-graph-node")]
      .filter(graphDemoVisible)
      .every(node => graphNodeRectInsideVisibleGraph(node, 8));
    const parentPathsVisible = parentPaths.length > 0 &&
      parentPaths.every(path => graphStep11PathInsideVisibleGraph(path, 5));
    const branchPathsVisible = branchPaths.length > 0 &&
      branchPaths.every(path => graphStep11PathInsideVisibleGraph(path, 5));
    const committed = Boolean(
      connection &&
      parent &&
      junction &&
      connection.branchFrom?.connectionId === parentConnectionId &&
      connection.branchFrom?.pointId === junction.id
    );
    const rendered = Boolean(
      committed &&
      junctionHandle &&
      branchPath &&
      branchNode &&
      branchInput &&
      parentOutput &&
      parentInput
    );
    const ok = Boolean(
      rendered &&
      allNodesVisible &&
      parentPathsVisible &&
      branchPathsVisible &&
      graphNodeRectInsideVisibleGraph(branchNode, 10) &&
      graphDemoVisible(parentOutput) &&
      graphStep11PointInsideVisibleGraph(centerOf(parentOutput), 6) &&
      graphDemoVisible(parentInput) &&
      graphStep11PointInsideVisibleGraph(centerOf(parentInput), 6) &&
      graphDemoVisible(branchInput) &&
      graphStep11PointInsideVisibleGraph(centerOf(branchInput), 6) &&
      graphDemoVisible(junctionHandle) &&
      graphStep11PointInsideVisibleGraph(centerOf(junctionHandle), 8)
    );
    const failures = [
      [!connection, "branchFrom connection missing"],
      [!parent, "parent connection missing"],
      [!junction, "junction point missing from parent"],
      [!junctionHandle, "rendered junction handle missing"],
      [branchPaths.length === 0, "rendered branch wire path missing"],
      [parentPaths.length === 0, "rendered parent wire path missing"],
      [!branchNode, "rendered branch NOT node missing"],
      [!branchInput, "rendered branch NOT input missing"],
      [!parentOutput, "rendered parent output missing"],
      [!parentInput, "rendered parent input missing"],
      [!allNodesVisible, "at least one graph node is outside the visible graph"],
      [!parentPathsVisible, "parent wire is not completely visible"],
      [!branchPathsVisible, "branch wire is not completely visible"],
      [
        Boolean(branchNode) &&
          !graphNodeRectInsideVisibleGraph(branchNode, 10),
        "branch NOT node is clipped"
      ],
      [
        Boolean(parentOutput) &&
          (!graphDemoVisible(parentOutput) ||
            !graphStep11PointInsideVisibleGraph(centerOf(parentOutput), 6)),
        "parent output is not visibly actionable"
      ],
      [
        Boolean(parentInput) &&
          (!graphDemoVisible(parentInput) ||
            !graphStep11PointInsideVisibleGraph(centerOf(parentInput), 6)),
        "parent input is not visibly actionable"
      ],
      [
        Boolean(branchInput) &&
          (!graphDemoVisible(branchInput) ||
            !graphStep11PointInsideVisibleGraph(centerOf(branchInput), 6)),
        "branch NOT input is not visibly actionable"
      ],
      [
        Boolean(junctionHandle) &&
          (!graphDemoVisible(junctionHandle) ||
            !graphStep11PointInsideVisibleGraph(centerOf(junctionHandle), 8)),
        "junction handle is not visibly actionable"
      ]
    ]
      .filter(([failed]) => failed)
      .map(([, reason]) => reason);
    return {
      ok,
      committed,
      rendered,
      failures,
      connection,
      parent,
      junction,
      junctionHandle,
      parentPaths,
      branchPaths,
      branchPath,
      branchNode,
      branchInput,
      parentOutput,
      parentInput,
      allNodesVisible,
      parentPathsVisible,
      branchPathsVisible
    };
  }

  async function graphStep11ConnectSimpleBranch(
    baseConnection,
    branchNodeId,
    preferredInputPortId,
    runId,
    preparedTarget = null
  ) {
    const host = window.RMLDynamicGraphHost;
    let branchInput =
      graphStep11Socket(branchNodeId, preferredInputPortId, "input") ||
      graphStep11NodeArticle(branchNodeId)?.querySelector(
        '.rml-graph-socket[data-direction="input"]'
      );
    if (!(branchInput instanceof Element)) {
      graphStep11Failure(
        "branch-input-not-rendered",
        {
          branchNodeId,
          preferredInputPortId,
          renderedBranchNode:
            Boolean(graphStep11NodeArticle(branchNodeId))
        }
      );
    }
    const branchArticle = graphStep11NodeArticle(branchNodeId);
    let visibleTarget = preparedTarget ||
      graphStep11VisibleWireTarget(
        baseConnection?.id,
        centerOf(branchInput),
        {
          ignoredNodes: branchArticle ? [branchArticle] : []
        }
      );
    if (!visibleTarget || runId !== demoRunId) {
      if (runId !== demoRunId) return null;
      graphStep11Failure(
        "no-visible-native-wire-drop-target",
        {
          baseConnectionId: baseConnection?.id || "",
          branchNodeId,
          input: graphSocketEndpoint(branchInput),
          reason: "no-uncovered-live-wire-segment"
        }
      );
    }
    const target = () => ({ ...visibleTarget.point });
    showDemoLabel(
      "Drag this input onto the existing line → one clear Y-branch",
      centerOf(branchInput)
    );
    positionCardAwayFromPath(centerOf(branchInput), target());
    const preflight = host?.inspectGuidedConnectionPoint?.(
      graphSocketEndpoint(branchInput),
      visibleTarget.point.x,
      visibleTarget.point.y
    ) || null;
    const nativePreflightReady = Boolean(
      preflight?.snapshot?.wire &&
      preflight?.proposal?.valid === true
    );
    if (!nativePreflightReady && visibleTarget.tier === 0) {
      graphStep11Failure(
        "selected-target-not-a-valid-live-wire",
        {
          target: { ...visibleTarget.point },
          input: graphSocketEndpoint(branchInput),
          preflight
        }
      );
    }
    if (!nativePreflightReady && visibleTarget.tier > 0) {
      tourDebugRecord("step11-ultra-small-geometric-wire-preflight", {
        target: { ...visibleTarget.point },
        input: graphSocketEndpoint(branchInput),
        preflight,
        policy:
          "The visible drag still runs; if the tiny native hit stroke misses, ensureBranch commits at this exact live SVG path point."
      });
    }
    const nativeDragObserved = await nativeGraphPointerDrag(
      branchInput,
      target,
      860,
      runId,
      9311
    );
    if (runId !== demoRunId) return null;
    await nextTwoFrames();

    const inputPortId =
      branchInput.dataset.portId || preferredInputPortId;
    let proof = graphStep11BranchProof(
      baseConnection.id,
      branchNodeId,
      inputPortId
    );
    let ensured = null;
    if (!proof.committed) {
      const liveInput = graphStep11Socket(
        branchNodeId,
        inputPortId,
        "input"
      );
      const point = target();
      ensured = liveInput
        ? host?.ensureBranch?.(
            baseConnection.id,
            graphSocketEndpoint(liveInput),
            point.x,
            point.y,
            visibleTarget.segmentIndex
          ) || null
        : null;
      await nextTwoFrames();
      proof = graphStep11BranchProof(
        baseConnection.id,
        branchNodeId,
        inputPortId
      );
    }
    for (
      let frame = 0;
      frame < 10 &&
      runId === demoRunId &&
      proof.committed &&
      !proof.rendered;
      frame += 1
    ) {
      await tourNextVisualFrame();
      proof = graphStep11BranchProof(
        baseConnection.id,
        branchNodeId,
        inputPortId
      );
    }
    if (!proof.committed) {
      graphStep11Failure(
        "branch-not-committed",
        {
          nativeDragObserved,
          ensured,
          expected: {
            parentConnectionId: baseConnection.id,
            branchNodeId,
            inputPortId
          },
          proof: {
            committed: proof.committed,
            rendered: proof.rendered,
            connectionFound: Boolean(proof.connection),
            junctionFound: Boolean(proof.junction),
            junctionHandleFound: Boolean(proof.junctionHandle),
            branchPathCount: proof.branchPaths?.length || 0,
            parentPathCount: proof.parentPaths?.length || 0,
            allNodesVisible: proof.allNodesVisible,
            parentPathsVisible: proof.parentPathsVisible,
            branchPathsVisible: proof.branchPathsVisible,
            failures: proof.failures
          }
        }
      );
    }
    if (!proof.rendered) {
      graphStep11Failure(
        "branch-committed-but-native-rendering-missing",
        {
          nativeDragObserved,
          ensured,
          expected: {
            parentConnectionId: baseConnection.id,
            branchNodeId,
            inputPortId
          },
          proof: {
            committed: proof.committed,
            junctionHandleFound: Boolean(proof.junctionHandle),
            branchPathCount: proof.branchPaths?.length || 0,
            parentPathCount: proof.parentPaths?.length || 0,
            failures: proof.failures
          }
        }
      );
    }

    pulseAt(proof.junctionHandle);
    showDemoLabel(
      "Y-junction confirmed — the new NOT is now really connected",
      centerOf(proof.junctionHandle)
    );
    positionCardAwayFromRoute([
      ...graphStep11RoutePoints(proof.parentPaths),
      ...graphStep11RoutePoints(proof.branchPaths),
      centerOf(proof.branchInput),
      centerOf(proof.junctionHandle)
    ]);
    await wait(420);
    return proof.connection;
  }

  function graphStep11PlanJunctionDrag(proof) {
    const handle = proof?.junctionHandle;
    const visible = visibleGraphClientRect(22);
    if (!(handle instanceof Element) || !visible) return null;
    const from = centerOf(handle);
    const nodeRects = [...document.querySelectorAll(".rml-graph-node")]
      .filter(graphDemoVisible)
      .map(node => node.getBoundingClientRect());
    const limits = {
      left: Math.max(visible.left, Math.min(...nodeRects.map(rect => rect.left)) - 12),
      right: Math.min(visible.right, Math.max(...nodeRects.map(rect => rect.right)) + 12),
      top: Math.max(visible.top, Math.min(...nodeRects.map(rect => rect.top)) - 12),
      bottom: Math.min(visible.bottom, Math.max(...nodeRects.map(rect => rect.bottom)) + 12)
    };
    const candidates = [];
    for (const radius of [42, 56, 70]) {
      for (let index = 0; index < 16; index += 1) {
        const angle = index / 16 * Math.PI * 2;
        const point = {
          x: Math.max(
            limits.left,
            Math.min(limits.right, from.x + Math.cos(angle) * radius)
          ),
          y: Math.max(
            limits.top,
            Math.min(limits.bottom, from.y + Math.sin(angle) * radius)
          )
        };
        const movement = Math.hypot(point.x - from.x, point.y - from.y);
        if (movement < 38) continue;
        const minimumNodeClearance = Math.min(
          ...nodeRects.map(rect => graphDemoRectDistance(point, rect, 0))
        );
        const dragCrossesNode = nodeRects.some(rect =>
          [2, 3, 4, 5, 6].some(step => {
            const progress = step / 6;
            return graphDemoRectDistance({
              x: from.x + (point.x - from.x) * progress,
              y: from.y + (point.y - from.y) * progress
            }, rect, 0) === 0;
          })
        );
        if (minimumNodeClearance <= 0 || dragCrossesNode) continue;
        const edgeClearance = Math.min(
          point.x - visible.left,
          visible.right - point.x,
          point.y - visible.top,
          visible.bottom - point.y
        );
        candidates.push({
          from,
          point,
          movement,
          minimumNodeClearance,
          score:
            minimumNodeClearance * 8 +
            edgeClearance -
            Math.abs(movement - 56)
        });
      }
    }
    candidates.sort((left, right) => right.score - left.score);
    return candidates[0] || null;
  }

  async function graphStep11DragCreatedJunction(
    parentConnectionId,
    branchNodeId,
    inputPortId,
    runId
  ) {
    if (runId !== demoRunId) return null;
    const host = window.RMLDynamicGraphHost;
    let proof = graphStep11BranchProof(
      parentConnectionId,
      branchNodeId,
      inputPortId
    );
    if (!proof.committed || !proof.rendered) {
      graphStep11Failure(
        "junction-drag-start-state-unavailable",
        { parentConnectionId, branchNodeId, inputPortId }
      );
    }
    const from = centerOf(proof.junctionHandle);
    const junctionPointId = proof.junction.id;
    const plan = graphStep11PlanJunctionDrag(proof);
    if (!plan) {
      graphStep11Failure(
        "no-visible-safe-junction-drag-target",
        { parentConnectionId, junctionPointId, from }
      );
    }

    showDemoLabel(
      "Drag the created junction away from the node → the Y remains clearly readable",
      from
    );
    positionCardAwayFromPath(from, plan.point);
    await moveMouse(from, 280, runId);
    if (runId !== demoRunId) return null;

    const mouse = elements().mouse;
    const duration = Math.max(300, tourPresentationDuration(680));
    const started = performance.now();
    let mutationResult = null;

    host?.setGuidedAutoPanSuppressed?.(true);
    try {
      mouse?.classList.add("active", "pressed");
      while (runId === demoRunId) {
        const progress = Math.min(1, (performance.now() - started) / duration);
        const eased = progress * progress * (3 - 2 * progress);
        const point = {
          x: from.x + (plan.point.x - from.x) * eased,
          y: from.y + (plan.point.y - from.y) * eased
        };
        setTeacherMousePoint(
          point,
          0,
          [],
          "graph-step11-visible-state-backed-junction-drag"
        );
        mutationResult = host?.setWirePointClientPosition?.(
          parentConnectionId,
          junctionPointId,
          point.x,
          point.y
        ) || {
          ok: false,
          reason: "The graph host does not expose setWirePointClientPosition."
        };
        if (mutationResult.ok !== true || progress >= 1) break;
        await tourNextVisualFrame();
      }

      if (runId === demoRunId && mutationResult?.ok === true) {
        setTeacherMousePoint(
          plan.point,
          0,
          [],
          "graph-step11-visible-state-backed-junction-drop"
        );
        mutationResult = host.setWirePointClientPosition(
          parentConnectionId,
          junctionPointId,
          plan.point.x,
          plan.point.y
        );
        await wait(180);
      }
    } finally {
      mouse?.classList.remove("pressed");
      host?.setGuidedAutoPanSuppressed?.(false);
    }
    if (runId !== demoRunId) return null;
    await nextTwoFrames();

    proof = graphStep11BranchProof(
      parentConnectionId,
      branchNodeId,
      inputPortId
    );
    const livePoint = host?.getGuidedWirePoint?.(
      parentConnectionId, junctionPointId
    );
    const liveClient = livePoint
      ? host?.graphPointToClient?.(livePoint.x, livePoint.y)
      : null;
    const actualMovement = liveClient
      ? Math.hypot(liveClient.x - from.x, liveClient.y - from.y)
      : 0;
    const targetError = liveClient
      ? Math.hypot(liveClient.x - plan.point.x, liveClient.y - plan.point.y)
      : Infinity;
    const confirmed = Boolean(
      mutationResult?.ok === true &&
      proof.committed &&
      proof.rendered &&
      actualMovement >= 34 &&
      targetError <= 24 &&
      graphStep11PointInsideVisibleGraph(centerOf(proof.junctionHandle), 8)
    );
    const result = {
      confirmed,
      mutationResult,
      junctionPointId,
      requestedTarget: plan.point,
      liveClient,
      actualMovement,
      targetError
    };
    if (!confirmed) {
      graphStep11Failure(
        "created-junction-state-drag-not-confirmed",
        result
      );
    }
    pulseAt(proof.junctionHandle);
    showDemoLabel(
      "Junction moved — all three connected line sections remain visible",
      centerOf(proof.junctionHandle)
    );
    await wait(360);
    return { pointId: junctionPointId, movement: actualMovement };
  }

  async function runGraphRouteDemoSimple(runId) {
    const viewport = document.querySelector(".rml-graph-viewport");
    const host = window.RMLDynamicGraphHost;
    if (!(viewport instanceof HTMLElement) || runId !== demoRunId) return;

    graphStep11RunStartedAt = performance.now();
    graphStep11MarkStage("route-start", {
      viewport: tourDebugRect(viewport),
      visibleGraph: visibleGraphClientRect(0)
    });
    const pair = await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;
    graphStep11MarkStage("teaching-nodes-resolved", {
      output: graphSocketEndpoint(pair?.output),
      input: graphSocketEndpoint(pair?.input)
    });
    await ensureGraphTeachingPairVisible(runId);
    if (runId !== demoRunId) return;
    graphStep11MarkStage("teaching-pair-visible", {
      visibleGraph: visibleGraphClientRect(0)
    });

    const freshPair = graphDemoSocketPair(false);
    const output = freshPair?.output || pair?.output;
    const input = freshPair?.input || pair?.input;
    if (!(output instanceof Element) || !(input instanceof Element)) return;

    let baseConnection = graphDemoConnectionFor(output, input);
    if (!baseConnection) {
      showDemoLabel(
        "Connect the two existing nodes first",
        centerOf(output)
      );
      await nativeGraphPointerDrag(output, input, 820, runId, 9309);
      if (runId !== demoRunId) return;
      baseConnection = (await ensureGraphConnectionDeterministic(
        graphStep11Socket(output.dataset.nodeId, output.dataset.portId, "output") || output,
        graphStep11Socket(input.dataset.nodeId, input.dataset.portId, "input") || input,
        runId
      ))?.connection || null;
    }
    if (!baseConnection || runId !== demoRunId) return;
    graphStep11MarkStage("base-connection-ready", {
      connectionId: baseConnection.id || ""
    });

    const created = await graphStep11CreateSimpleBranchNode(runId);
    if (!created?.nodeId || runId !== demoRunId) {
      showDemoLabel(
        "The existing connection remains usable; no forced layout error stops the lesson",
        centerOf(viewport)
      );
      await wait(620);
      hideMouse();
      return;
    }
    graphStep11MarkStage("branch-node-created", {
      nodeId: created.nodeId,
      dragCompleted: created.dragCompleted === true,
      fallbackUsed: created.fallbackUsed === true,
      rect: tourDebugRect(created.article)
    });

    const allNodeIds = () => (host?.getState?.()?.nodes || [])
      .map(node => node.id)
      .filter(Boolean);
    const preparedAction = await graphStep11PrepareBranchAction(
      baseConnection,
      created.nodeId,
      runId
    );
    if (runId !== demoRunId) return;
    graphStep11MarkStage("branch-action-prepared", {
      nodeMoved: preparedAction?.nodeMoved === true,
      plannedMovement: Number(preparedAction?.plannedMovement || 0),
      target: preparedAction?.target?.point || null
    });

    const branchConnection = await graphStep11ConnectSimpleBranch(
      baseConnection,
      created.nodeId,
      input.dataset.portId || "",
      runId,
      preparedAction?.target || null
    );
    if (runId !== demoRunId) return;
    if (!branchConnection) {
      showDemoLabel(
        "The Y-junction was not confirmed — stop before zoom instead of pretending the NOT is connected",
        centerOf(graphStep11NodeArticle(created.nodeId) || viewport)
      );
      await wait(720);
      hideMouse();
      return;
    }
    graphStep11MarkStage("branch-connected", {
      parentConnectionId: baseConnection.id,
      branchConnectionId: branchConnection.id,
      branchNodeId: created.nodeId
    });

    const movedJunction = await graphStep11DragCreatedJunction(
      baseConnection.id,
      created.nodeId,
      branchConnection.toPort,
      runId
    );
    if (runId !== demoRunId) return;
    if (!movedJunction) {
      graphStep11Failure(
        "created-junction-drag-did-not-complete",
        {
          parentConnectionId: baseConnection.id,
          branchConnectionId: branchConnection.id,
          branchNodeId: created.nodeId
        }
      );
    }
    graphStep11MarkStage("junction-dragged", {
      parentConnectionId: baseConnection.id,
      branchConnectionId: branchConnection.id,
      branchNodeId: created.nodeId,
      movedJunction
    });

    const beforeFinalFit = graphStep11BranchProof(
      baseConnection.id,
      created.nodeId,
      branchConnection.toPort
    );
    hideMouse();
    showDemoLabel(
      "Final zoom → all nodes, ports, lines and the moved junction together",
      centerOf(viewport)
    );
    positionCardAwayFromRoute([
      ...graphStep11RoutePoints(beforeFinalFit.parentPaths),
      ...graphStep11RoutePoints(beforeFinalFit.branchPaths),
      centerOf(beforeFinalFit.junctionHandle)
    ]);
    const finalFit = await animateGraphNodesToReadableFrame(
      allNodeIds(),
      runId,
      {
        inset: 16,
        padding: window.innerWidth < 480 ? 24 : 34,
        maxScale: window.innerWidth < 480 ? .98 : 1.06,
        duration: 620,
        allowZoomIn: true,
        reason: "step11-final-fit-after-visible-state-backed-junction-drag"
      }
    );
    if (runId !== demoRunId) return;
    if (!finalFit) {
      graphStep11Failure(
        "final-scene-camera-fit-did-not-complete",
        {
          parentConnectionId: baseConnection.id,
          branchConnectionId: branchConnection.id,
          branchNodeId: created.nodeId
        }
      );
    }
    graphStep11MarkStage("final-fit-complete", {
      finalFit: finalFit === true,
      visibleGraph: visibleGraphClientRect(0)
    });
    await nextTwoFrames();

    const fittedBranch = graphStep11BranchProof(
      baseConnection.id,
      created.nodeId,
      branchConnection.toPort
    );
    if (!fittedBranch.ok) {
      graphStep11Failure(
        "final-scene-not-fully-readable",
        {
          parentConnectionId: baseConnection.id,
          branchConnectionId: branchConnection.id,
          branchNodeId: created.nodeId,
          movedJunction,
          failures: fittedBranch.failures,
          allNodesVisible: fittedBranch.allNodesVisible,
          parentPathsVisible: fittedBranch.parentPathsVisible,
          branchPathsVisible: fittedBranch.branchPathsVisible
        }
      );
    }
    positionCardAwayFromRoute([
      ...graphStep11RoutePoints(fittedBranch.parentPaths),
      ...graphStep11RoutePoints(fittedBranch.branchPaths),
      centerOf(fittedBranch.branchInput),
      centerOf(fittedBranch.junctionHandle),
      centerOf(fittedBranch.branchNode)
    ]);
    hideMouse();
    pulseAt(fittedBranch.junctionHandle);

    showDemoLabel(
      preparedAction?.nodeMoved
        ? "Done: one useful node move, one Y-branch and its moved junction — everything is fitted and readable"
        : "Done: one Y-branch and its moved junction — everything is fitted and readable",
      centerOf(fittedBranch.junctionHandle)
    );
    await wait(820);
    clearGraphConnectionScene();
    hideMouse();
    graphStep11MarkStage("route-complete", {
      parentConnectionId: baseConnection.id,
      branchConnectionId: branchConnection.id,
      branchNodeId: created.nodeId
    });
  }

  function dispatchTourWheel(
    target,
    {
      deltaX = 0,
      deltaY = 0,
      shiftKey = false,
      ctrlKey = false
    } = {}
  ) {
    if (!target) return false;

    const event = new WheelEvent(
      "wheel",
      {
        bubbles: true,
        cancelable: true,
        deltaMode: 0,
        deltaX,
        deltaY,
        shiftKey,
        ctrlKey
      }
    );
    target.dispatchEvent(event);
    return event.defaultPrevented;
  }

  function releaseTourScrollModifier() {
    document.dispatchEvent(
      new KeyboardEvent(
        "keyup",
        {
          key: "Control",
          code: "ControlLeft",
          bubbles: true,
          cancelable: true
        }
      )
    );

    window.RMLTypedNodeGraphScrollLayers
      ?.commit?.();
    window.RMLUniversalScrollLayers
      ?.commit?.();
  }

  async function wheelBurst(
    target,
    options,
    repeat,
    interval,
    runId
  ) {
    for (
      let index = 0;
      index < repeat &&
      runId === demoRunId;
      index += 1
    ) {
      dispatchTourWheel(
        target,
        options
      );

      await wait(interval);
    }
  }

  function prepareStartNodeScrollDemo() {
    const article =
      document.querySelector(".rml-graph-node.configuration") ||
      document.querySelector(".rml-graph-node");
    const body = article?.querySelector(".rml-graph-node-body");
    const content = body?.querySelector(".rml-graph-node-body-content");
    if (!article || !body || !content) return null;

    article.classList.add("rml-setup-scroll-demo-node");
    body.classList.add("rml-setup-scroll-demo-body");

    let filler = content.querySelector(".rml-setup-node-scroll-filler");
    if (!filler) {
      filler = document.createElement("div");
      filler.className = "rml-setup-node-scroll-filler";
      filler.setAttribute("aria-hidden", "true");
      for (let index = 1; index <= 16; index += 1) {
        const row = document.createElement("div");
        row.innerHTML = `<span>Runtime port ${index}</span><b>${index % 2 ? "INPUT" : "OUTPUT"}</b>`;
        filler.appendChild(row);
      }
      content.appendChild(filler);
    }

    body.style.overflow = "auto";
    body.scrollTop = 0;
    body.scrollLeft = 0;
    window.RMLTypedNodeGraphScrollLayers?.clear?.();
    window.RMLUniversalScrollLayers?.clear?.();

    return { article, body, content, filler };
  }

  function cleanupStartNodeScrollDemo(demo) {
    if (!demo) return;
    window.RMLTypedNodeGraphScrollLayers?.clear?.();
    window.RMLUniversalScrollLayers?.clear?.();
    demo.filler?.remove();
    demo.article?.classList.remove("rml-setup-scroll-demo-node");
    demo.body?.classList.remove("rml-setup-scroll-demo-body");
    demo.body?.style.removeProperty("overflow");
    if (demo.body) {
      demo.body.scrollTop = 0;
      demo.body.scrollLeft = 0;
    }
  }

  function scrollLayerState() {
    const graphState =
      window.RMLTypedNodeGraphScrollLayers?.getState?.() || null;
    const universalState =
      window.RMLUniversalScrollLayers?.getState?.() || null;

    return {
      graphState,
      universalState,
      preview:
        graphState?.preview ||
        universalState?.preview ||
        "",
      selected:
        graphState?.selected ||
        universalState?.selected ||
        ""
    };
  }

  async function cycleTourScrollLayerUntil(
    target,
    matcher,
    runId,
    maxAttempts = 8,
    deltaY = 150
  ) {
    for (
      let attempt = 0;
      attempt < maxAttempts &&
      runId === demoRunId;
      attempt += 1
    ) {
      dispatchTourWheel(
        target,
        {
          deltaY,
          ctrlKey: true
        }
      );

      await wait(TOUR_SCROLL_TIMING.layerStepPause);

      const label =
        scrollLayerState().preview;

      if (matcher.test(label)) {
        return true;
      }
    }

    return false;
  }

  async function animateTourPageScroll(
    top,
    duration,
    runId
  ) {
    const scroller =
      document.scrollingElement ||
      document.documentElement;
    const from = scroller.scrollTop;
    const maxTop = Math.max(
      0,
      scroller.scrollHeight -
        scroller.clientHeight
    );
    const to = Math.max(
      0,
      Math.min(maxTop, top)
    );

    if (Math.abs(to - from) < 1) {
      return;
    }

    const distance = Math.abs(to - from);
    const effectiveDuration = Math.min(
      Math.max(1, duration),
      Math.max(160, Math.min(640, distance * 1.45))
    );
    const start = performance.now();

    while (runId === demoRunId) {
      const frame = await tourNextVisualFrame();
      const now = Math.max(performance.now(), frame.timestamp);
      const raw = Math.min(
        1,
        (now - start) / effectiveDuration
      );
      const eased =
        raw < .5
          ? 4 * raw * raw * raw
          : 1 - Math.pow(-2 * raw + 2, 3) / 2;
      scroller.scrollTop = from + (to - from) * eased;
      if (raw >= 1) break;
    }
  }

  function releaseTourGlobalScrollOverrideAt(
    target,
    point
  ) {
    target?.dispatchEvent(
      new MouseEvent(
        "click",
        {
          bubbles: true,
          cancelable: true,
          button: 0,
          clientX: point.x,
          clientY: point.y,
          view: window
        }
      )
    );

    window.RMLTypedNodeGraphScrollLayers?.clear?.();
    window.RMLUniversalScrollLayers?.clear?.();
  }

  function tourElementActuallyVisible(element) {
    if (!(element instanceof Element) || !element.isConnected) return false;
    const rect = element.getBoundingClientRect();
    let current = element;
    while (current instanceof Element) {
      const style = getComputedStyle(current);
      if (
        style.display === "none" ||
        style.visibility === "hidden" ||
        Number.parseFloat(style.opacity || "1") <= .01
      ) {
        return false;
      }
      current = current.parentElement;
    }
    return (
      rect.width > 2 &&
      rect.height > 2
    );
  }

  function tourFirstVisible(selectors) {
    for (const selector of selectors) {
      const element = [...document.querySelectorAll(selector)]
        .find(tourElementActuallyVisible);
      if (element) return element;
    }
    return null;
  }

  async function teacherEnsureGraphSidebarsVisible(
    runId,
    requirements = null
  ) {
    if (
      runId !== demoRunId ||
      !document.body.classList.contains("rml-node-graph-mode")
    ) {
      return;
    }

    requirements = requirements ||
      graphPanelRequirementsForStep(steps[stepIndex]);
    const body = document.body;
    const leftPanels = [
      document.querySelector(".rml-graph-palette"),
      document.querySelector(".palette")
    ].filter(Boolean);
    const rightPanels = [
      document.querySelector(".rml-graph-inspector"),
      document.querySelector(".inspector")
    ].filter(Boolean);
    const leftHidden =
      body.classList.contains("rml-graph-left-collapsed") ||
      (
        leftPanels.length > 0 &&
        leftPanels.every(panel => !tourElementActuallyVisible(panel))
      );
    const rightHidden =
      body.classList.contains("rml-graph-right-collapsed") ||
      (
        rightPanels.length > 0 &&
        rightPanels.every(panel => !tourElementActuallyVisible(panel))
      );

    if (requirements.left !== false && leftHidden) {
      const toggle = tourFirstVisible([
        ".rml-graph-panel-toggle-left",
        "[data-rml-graph-toggle-left]"
      ]);
      if (toggle) {
        await teacherClickElement(
          toggle,
          "Open the real Runtime Node library",
          runId
        );
      }
    }

    if (
      requirements.left === false &&
      !leftHidden
    ) {
      const toggle = tourFirstVisible([
        ".rml-graph-panel-toggle-left",
        "[data-rml-graph-toggle-left]"
      ]);
      if (toggle) {
        await teacherClickElement(
          toggle,
          "Hide the node library to give this complete graph scene the full available width",
          runId
        );
      }
    }

    if (runId !== demoRunId) return;

    if (requirements.right !== false && rightHidden) {
      const toggle = tourFirstVisible([
        ".rml-graph-panel-toggle-right",
        "[data-rml-graph-toggle-right]"
      ]);
      if (toggle) {
        await teacherClickElement(
          toggle,
          "Open the real Node inspector",
          runId
        );
      }
    }

    if (
      requirements.right === false &&
      !rightHidden
    ) {
      const toggle = tourFirstVisible([
        ".rml-graph-panel-toggle-right",
        "[data-rml-graph-toggle-right]"
      ]);
      if (toggle) {
        await teacherClickElement(
          toggle,
          "Hide the inspector to give this complete graph scene the full available width",
          runId
        );
      }
    }
  }

  function graphToolbarButton(label) {
    return [...document.querySelectorAll(".rml-graph-toolbar .button")]
      .find(button =>
        tourElementActuallyVisible(button) &&
        button.textContent.trim() === label
      ) || null;
  }

  function graphToolbarButtonByTitle(title) {
    return [...document.querySelectorAll(".rml-graph-toolbar .button")]
      .find(button =>
        tourElementActuallyVisible(button) &&
        button.title.trim() === title
      ) || null;
  }

  function graphPanToolbarControls() {
    const toolbar = document.querySelector(".rml-graph-toolbar");
    const center = graphToolbarButton("Center Graph");
    const zoomOut = graphToolbarButtonByTitle("Zoom out");
    const zoomIn = graphToolbarButtonByTitle("Zoom in");
    return {
      toolbar,
      center,
      zoomOut,
      zoomIn,
      controls: [center, zoomOut, zoomIn].filter(Boolean)
    };
  }

  function graphPanToolbarVisibilityProof() {
    const scene = graphPanToolbarControls();
    const toolbarRect = scene.toolbar?.getBoundingClientRect?.() || null;
    const viewport = tourViewport();
    const safeRect = {
      left: viewport.left,
      right: viewport.right,
      top: Math.max(viewport.top, tourHeaderBottom()),
      bottom: viewport.bottom
    };
    const controlSafeRect = {
      left: safeRect.left + 2,
      right: safeRect.right - 2,
      top: safeRect.top + 2,
      bottom: safeRect.bottom - 2
    };
    const toolbarArea = toolbarRect
      ? Math.max(0, toolbarRect.width) * Math.max(0, toolbarRect.height)
      : 0;
    const toolbarVisibleRatio = toolbarArea > 0
      ? rectangleIntersectionArea(toolbarRect, safeRect) / toolbarArea
      : 0;
    const controlProofs = scene.controls.map(control => {
      const rect = control.getBoundingClientRect();
      const insideToolbar = elementVisibleInsideScroller(
        control,
        scene.toolbar,
        3
      );
      const insideViewport = Boolean(
        rect.left >= controlSafeRect.left &&
        rect.right <= controlSafeRect.right &&
        rect.top >= controlSafeRect.top &&
        rect.bottom <= controlSafeRect.bottom
      );
      return {
        label: control.title || control.textContent?.trim() || "",
        insideToolbar,
        insideViewport,
        rect: tourDebugRect(control)
      };
    });
    const allControlsFound = Boolean(
      scene.toolbar instanceof HTMLElement &&
      scene.center instanceof HTMLElement &&
      scene.zoomOut instanceof HTMLElement &&
      scene.zoomIn instanceof HTMLElement
    );
    return {
      ok: Boolean(
        allControlsFound &&
        toolbarVisibleRatio >= .995 &&
        controlProofs.every(proof =>
          proof.insideToolbar && proof.insideViewport
        )
      ),
      allControlsFound,
      toolbarVisibleRatio,
      toolbarRect: tourDebugRect(scene.toolbar),
      safeRect,
      controlSafeRect,
      scrollLeft: Number(scene.toolbar?.scrollLeft || 0),
      scrollWidth: Number(scene.toolbar?.scrollWidth || 0),
      clientWidth: Number(scene.toolbar?.clientWidth || 0),
      controls: controlProofs,
      scene
    };
  }

  async function animateGraphToolbarScrollLeft(
    toolbar,
    desiredLeft,
    runId,
    duration = 360
  ) {
    if (!(toolbar instanceof HTMLElement) || runId !== demoRunId) {
      return false;
    }
    const maximum = Math.max(0, toolbar.scrollWidth - toolbar.clientWidth);
    const from = Number(toolbar.scrollLeft || 0);
    const to = Math.max(0, Math.min(maximum, Number(desiredLeft) || 0));
    if (Math.abs(to - from) <= 1) {
      toolbar.scrollLeft = to;
      return true;
    }
    const started = performance.now();
    while (runId === demoRunId) {
      const frame = await tourNextVisualFrame();
      const now = Math.max(performance.now(), frame.timestamp);
      const raw = Math.min(1, (now - started) / Math.max(1, duration));
      const eased = 1 - Math.pow(1 - raw, 3);
      toolbar.scrollLeft = from + (to - from) * eased;
      if (raw >= 1) {
        toolbar.scrollLeft = to;
        break;
      }
    }
    return runId === demoRunId && Math.abs(toolbar.scrollLeft - to) <= 1;
  }

  async function prepareGraphPanToolbarForNarration(runId) {
    if (runId !== demoRunId) return false;
    const before = graphTeachingSceneSnapshot(
      "graph-pan-toolbar-reveal-before"
    );
    let scene = graphPanToolbarControls();
    if (
      !(scene.toolbar instanceof HTMLElement) ||
      scene.controls.length !== 3
    ) {
      return false;
    }

    await nativeTourScrollTargetIntoView(scene.toolbar, runId);
    if (runId !== demoRunId) return false;
    await nextTwoFrames();
    scene = graphPanToolbarControls();

    const offsets = scene.controls.map(control => ({
      left: Number(control.offsetLeft || 0),
      right: Number(control.offsetLeft || 0) +
        Number(control.offsetWidth || 0)
    }));
    const groupLeft = Math.min(...offsets.map(offset => offset.left)) - 4;
    const groupRight = Math.max(...offsets.map(offset => offset.right)) + 4;
    const groupWidth = Math.max(0, groupRight - groupLeft);
    const availableWidth = Math.max(1, scene.toolbar.clientWidth);
    const minimumLeft = Math.max(0, groupRight - availableWidth);
    const maximumLeft = Math.max(0, groupLeft);
    const desiredLeft = groupWidth <= availableWidth
      ? Math.max(
          minimumLeft,
          Math.min(maximumLeft, Number(scene.toolbar.scrollLeft || 0))
        )
      : Math.max(0, groupLeft);

    await animateGraphToolbarScrollLeft(
      scene.toolbar,
      desiredLeft,
      runId
    );
    if (runId !== demoRunId) return false;
    await nextTwoFrames();

    const proof = graphPanToolbarVisibilityProof();
    const after = graphTeachingSceneSnapshot(
      "graph-pan-toolbar-reveal-after"
    );
    const productComparison = compareGraphProductState(before, after);
    const passed = tourDebugAssert(
      "graph-pan-toolbar-controls-visible-before-explanation",
      proof.ok === true && productComparison.exact === true,
      {
        proof: {
          ...proof,
          scene: undefined
        },
        graphProductComparison: productComparison,
        pageScrollAllowed: true,
        toolbarScrollAllowed: true,
        policy:
          "reveal Center Graph, Zoom out and Zoom in by scrolling only the page and toolbar; node coordinates, connections and graph camera remain unchanged"
      }
    );
    if (!passed) {
      throw new Error(
        "[RML Tour · Step 10] Center Graph and zoom controls were not completely visible before their explanation."
      );
    }
    return true;
  }

  function graphNeedsCentering() {
    const viewport = document.querySelector(".rml-graph-viewport");
    if (!tourElementActuallyVisible(viewport)) return false;
    const viewportRect = viewport.getBoundingClientRect();
    const inset = Math.max(20, Math.min(54, viewportRect.width * .045));
    const useful = {
      left: viewportRect.left + inset,
      right: viewportRect.right - inset,
      top: viewportRect.top + inset,
      bottom: viewportRect.bottom - inset
    };
    const nodes = [...document.querySelectorAll(".rml-graph-node")]
      .filter(tourElementActuallyVisible);
    if (nodes.length === 0) return false;
    return nodes.some(node => {
      const rect = node.getBoundingClientRect();
      return (
        rect.left < useful.left ||
        rect.right > useful.right ||
        rect.top < useful.top ||
        rect.bottom > useful.bottom
      );
    });
  }

  async function teacherCenterGraph(runId, options = {}) {
    const button = graphToolbarButton("Center Graph");
    if (!button || runId !== demoRunId) return false;
    if (options.force !== true && !graphNeedsCentering()) {
      return false;
    }
    const toolbar = button.closest(".rml-graph-toolbar");
    if (toolbar) {
      await teacherRevealInScroller(button, toolbar, runId);
      if (runId !== demoRunId) return false;
    }
    return teacherClickElement(
      button,
      options.label ||
        "Center Graph fits every node and route into the visible canvas",
      runId
    );
  }

  function graphSidebarIsHidden(side) {
    const body = document.body;
    const left = side === "left";
    const collapsedClass = left
      ? "rml-graph-left-collapsed"
      : "rml-graph-right-collapsed";
    const panels = left
      ? [
          document.querySelector(".rml-graph-palette"),
          document.querySelector(".palette")
        ]
      : [
          document.querySelector(".rml-graph-inspector"),
          document.querySelector(".inspector")
        ];
    const existing = panels.filter(Boolean);
    return Boolean(
      body.classList.contains(collapsedClass) ||
      (
        existing.length > 0 &&
        existing.every(panel => !tourElementActuallyVisible(panel))
      )
    );
  }

  const GRAPH_CONTINUOUS_SCENE_NEXT = Object.freeze({
    "mode-switch-graph": "graph-create-node",
    "graph-create-node": "graph-wire",
    "graph-wire": "graph-flip",
    "graph-flip": "graph-pan",
    "graph-pan": "graph-route",
    "graph-route": "graph-inspector"
  });

  function graphTeachingSceneSnapshot(label = "") {
    const state = window.RMLDynamicGraphHost?.getState?.() || null;
    const viewportState =
      window.RMLDynamicGraphHost?.getViewportState?.() || null;
    const pair = graphDemoSocketPair(false);
    const page = document.scrollingElement || document.documentElement;
    const nodeModels = (state?.nodes || [])
      .map(node => ({
        id: node.id || "",
        kind: node.kind || "",
        operatorId: node.operatorId || "",
        label: node.label || "",
        portLayout:
          node.parameters?.portLayout === "mirrored"
            ? "mirrored"
            : "standard",
        x: Number(node.x || 0),
        y: Number(node.y || 0)
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    const connections = (state?.connections || [])
      .map(connection => ({
        id: connection.id || "",
        fromNode: connection.fromNode || "",
        fromPort: connection.fromPort || "",
        toNode: connection.toNode || "",
        toPort: connection.toPort || ""
      }))
      .sort((a, b) => a.id.localeCompare(b.id));
    return {
      label,
      graphMode: document.body.classList.contains("rml-node-graph-mode"),
      graphActive: state?.active === true,
      panels: {
        leftOpen: !graphSidebarIsHidden("left"),
        rightOpen: !graphSidebarIsHidden("right")
      },
      page: {
        left: Number(page?.scrollLeft || 0),
        top: Number(page?.scrollTop || 0)
      },
      viewport: viewportState?.viewport
        ? {
            x: Number(viewportState.viewport.x || 0),
            y: Number(viewportState.viewport.y || 0),
            scale: Number(viewportState.viewport.scale || 0)
          }
        : null,
      viewportRect: viewportState?.rectangle
        ? {
            left: Number(viewportState.rectangle.left || 0),
            top: Number(viewportState.rectangle.top || 0),
            right: Number(viewportState.rectangle.right || 0),
            bottom: Number(viewportState.rectangle.bottom || 0),
            width: Number(viewportState.rectangle.width || 0),
            height: Number(viewportState.rectangle.height || 0)
          }
        : null,
      visibleGraph: visibleGraphClientRect(0),
      selectedNodeId: state?.selectedNodeId || "",
      nodeModels,
      connections,
      pair: {
        sourceId: pair?.sourceNode?.dataset.graphNodeId || "",
        targetId: pair?.targetNode?.dataset.graphNodeId || "",
        outputPortId: pair?.output?.dataset.portId || "",
        inputPortId: pair?.input?.dataset.portId || "",
        sourceRect: tourDebugRect(pair?.sourceNode),
        targetRect: tourDebugRect(pair?.targetNode),
        outputRect: tourDebugRect(pair?.output),
        inputRect: tourDebugRect(pair?.input)
      }
    };
  }

  function compareGraphTeachingScenes(expected, actual) {
    const mismatches = [];
    const exact = (name, before, after) => {
      if (before !== after) {
        mismatches.push({ name, expected: before, actual: after });
      }
    };
    const close = (name, before, after, tolerance) => {
      if (
        !Number.isFinite(before) ||
        !Number.isFinite(after) ||
        Math.abs(before - after) > tolerance
      ) {
        mismatches.push({
          name,
          expected: before,
          actual: after,
          tolerance
        });
      }
    };
    const compareRect = (name, before, after, tolerance = .8) => {
      if (!before || !after) {
        if (before !== after) {
          mismatches.push({ name, expected: before, actual: after });
        }
        return;
      }
      for (const key of ["left", "top", "right", "bottom", "width", "height"]) {
        close(`${name}.${key}`, before[key], after[key], tolerance);
      }
    };

    if (!expected || !actual) {
      return {
        exact: false,
        mismatches: [{ name: "snapshot", expected, actual }]
      };
    }

    exact("graphMode", expected.graphMode, actual.graphMode);
    exact("graphActive", expected.graphActive, actual.graphActive);
    exact("panels.leftOpen", expected.panels?.leftOpen, actual.panels?.leftOpen);
    exact("panels.rightOpen", expected.panels?.rightOpen, actual.panels?.rightOpen);
    exact("selectedNodeId", expected.selectedNodeId, actual.selectedNodeId);
    close("page.left", expected.page?.left, actual.page?.left, .5);
    close("page.top", expected.page?.top, actual.page?.top, .5);
    close("viewport.x", expected.viewport?.x, actual.viewport?.x, .02);
    close("viewport.y", expected.viewport?.y, actual.viewport?.y, .02);
    close("viewport.scale", expected.viewport?.scale, actual.viewport?.scale, .0005);
    compareRect("viewportRect", expected.viewportRect, actual.viewportRect);
    compareRect("visibleGraph", expected.visibleGraph, actual.visibleGraph);

    for (const key of ["sourceId", "targetId", "outputPortId", "inputPortId"]) {
      exact(`pair.${key}`, expected.pair?.[key], actual.pair?.[key]);
    }
    for (const key of ["sourceRect", "targetRect", "outputRect", "inputRect"]) {
      compareRect(`pair.${key}`, expected.pair?.[key], actual.pair?.[key]);
    }

    const expectedNodes = expected.nodeModels || [];
    const actualNodes = actual.nodeModels || [];
    exact(
      "nodeIds",
      expectedNodes.map(node => node.id).join("|"),
      actualNodes.map(node => node.id).join("|")
    );
    const actualNodeMap = new Map(actualNodes.map(node => [node.id, node]));
    for (const node of expectedNodes) {
      const current = actualNodeMap.get(node.id);
      if (!current) continue;
      exact(`node.${node.id}.kind`, node.kind, current.kind);
      exact(
        `node.${node.id}.operatorId`,
        node.operatorId,
        current.operatorId
      );
      exact(`node.${node.id}.label`, node.label, current.label);
      exact(
        `node.${node.id}.portLayout`,
        node.portLayout,
        current.portLayout
      );
      close(`node.${node.id}.x`, node.x, current.x, .02);
      close(`node.${node.id}.y`, node.y, current.y, .02);
    }
    exact(
      "connections",
      JSON.stringify(expected.connections || []),
      JSON.stringify(actual.connections || [])
    );
    return { exact: mismatches.length === 0, mismatches };
  }

  function compareGraphProductState(expected, actual) {
    const comparison = compareGraphTeachingScenes(expected, actual);
    const presentationOnlyPrefixes = [
      "page.",
      "viewportRect.",
      "visibleGraph.",
      "pair.sourceRect.",
      "pair.targetRect.",
      "pair.outputRect.",
      "pair.inputRect."
    ];
    const mismatches = comparison.mismatches.filter(mismatch =>
      !presentationOnlyPrefixes.some(prefix =>
        String(mismatch?.name || "").startsWith(prefix)
      )
    );
    const ignoredPresentationMismatches = comparison.mismatches.filter(
      mismatch => !mismatches.includes(mismatch)
    );
    return {
      exact: mismatches.length === 0,
      mismatches,
      ignoredPresentationMismatches
    };
  }

  function graphTeachingPairExistingConnection(
    pair = graphDemoSocketPair(false)
  ) {
    const direct = graphDemoConnectionFor(pair?.output, pair?.input);
    if (direct) return direct;
    const sourceId = String(
      pair?.boolNode?.dataset?.graphNodeId || ""
    );
    const targetId = String(
      pair?.notNode?.dataset?.graphNodeId || ""
    );
    if (!sourceId || !targetId) return null;
    return window.RMLDynamicGraphHost?.getState?.()?.connections?.find(
      connection =>
        String(connection?.fromNode || "") === sourceId &&
        String(connection?.toNode || "") === targetId
    ) || null;
  }

  function graphSceneHandoffEvaluation(step) {
    const handoff = graphTeachingSceneHandoff;
    const currentDemo = steps[stepIndex]?.demo || "";
    if (
      !handoff ||
      handoff.toDemo !== step?.demo ||
      handoff.fromDemo !== currentDemo
    ) {
      return null;
    }
    const opening = graphTeachingSceneSnapshot(
      `${handoff.fromDemo}-to-${handoff.toDemo}-opening-candidate`
    );
    const comparison = compareGraphTeachingScenes(
      handoff.terminal,
      opening
    );
    const pair = graphDemoSocketPair(false);
    const connection = graphTeachingPairExistingConnection(pair);
    const preserveExactGraphState = Boolean(
      handoff.preserveExactGraphState === true &&
      handoff.skippedDemonstration === true
    );
    const targetReady = preserveExactGraphState
      ? Boolean(
          opening.graphMode &&
          opening.graphActive &&
          pair?.boolNode &&
          pair?.notNode &&
          connection
        )
      : handoff.toDemo === "graph-create-node"
      ? Boolean(
          graphCreateNodePreparedDropPlan?.complete === true &&
          graphCreateNodePreparedDropHit("logic.not")
            ?.fullFootprintInside === true
        )
      : handoff.toDemo === "graph-route"
      ? graphTeachingPairCompletelyVisible(pair, 10)
      : graphTeachingPairCompletelyVisible(pair, 10);
    return {
      handoff,
      opening,
      comparison,
      preserveExactGraphState,
      connectedTeachingPair: Boolean(connection),
      pairVisible: graphTeachingPairCompletelyVisible(pair, 10),
      targetReady,
      reusable: comparison.exact === true && targetReady
    };
  }

  function recordGraphTeachingSceneHandoff(step) {
    const toDemo = GRAPH_CONTINUOUS_SCENE_NEXT[step?.demo];
    if (!toDemo) {
      graphTeachingSceneHandoff = null;
      return true;
    }
    const terminal = graphTeachingSceneSnapshot(
      `${step.demo}-terminal-for-${toDemo}`
    );
    const pair = graphDemoSocketPair(false);
    const targetStep = steps.find(candidate => candidate.demo === toDemo);
    const targetRequirements = graphPanelRequirementsForStep(targetStep);
    const requiredNodeIds = ["graph-create-node", "graph-inspector"].includes(toDemo)
      ? (window.RMLDynamicGraphHost?.getState?.()?.nodes || [])
          .map(node => node.id)
          .filter(Boolean)
      : graphTeachingNodeIdsFromState();
    const requiredNodesVisible = requiredNodeIds.every(nodeId => {
      const node = document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
      );
      return graphTeachingElementInsideViewport(node, 8);
    });
    const visible = visibleGraphClientRect(0);
    const graphCreateReady = toDemo !== "graph-create-node" || Boolean(
      graphCreateNodePreparedDropPlan?.complete === true &&
      graphCreateNodePreparedDropHit("logic.not")?.fullFootprintInside === true
    );
    const graphRouteReady = toDemo !== "graph-route" ||
      graphTeachingPairCompletelyVisible(pair, 10);
    const pairReady = toDemo === "graph-create-node" ||
      graphTeachingPairCompletelyVisible(pair, 10);
    const ready = Boolean(
      terminal.graphMode &&
      terminal.graphActive &&
      terminal.panels.leftOpen === targetRequirements.left &&
      terminal.panels.rightOpen === targetRequirements.right &&
      visible &&
      visible.width >= 280 &&
      visible.height >= graphLessonMinimumVisibleHeight() &&
      requiredNodesVisible &&
      graphCreateReady &&
      graphRouteReady &&
      pairReady
    );
    tourDebugRecord("graph-scene-handoff-terminal", {
      fromDemo: step.demo,
      toDemo,
      ready,
      scene: terminal
    });
    tourDebugAssert(
      `${step.demo}-terminal-scene-ready-for-${toDemo}`,
      ready,
      {
        fromDemo: step.demo,
        toDemo,
        targetRequirements,
        requiredNodeIds,
        requiredNodesVisible,
        graphCreateReady,
        graphRouteReady,
        pairReady,
        visibleGraph: visible,
        scene: terminal,
        policy:
          "the completed lesson itself leaves the exact readable geometry, zoom and panels required by the next lesson"
      }
    );
    graphTeachingSceneHandoff = ready
      ? { fromDemo: step.demo, toDemo, terminal }
      : null;
    return ready;
  }

  function recordSkippedGraphSceneHandoff(step) {
    const toDemo = GRAPH_CONTINUOUS_SCENE_NEXT[step?.demo];
    if (!toDemo || step?.mode !== "graph") {
      graphTeachingSceneHandoff = null;
      return null;
    }
    const targetStep = steps.find(candidate => candidate.demo === toDemo);
    const requirements = graphPanelRequirementsForStep(targetStep);
    const terminal = graphTeachingSceneSnapshot(
      `${step.demo}-skipped-terminal-for-${toDemo}`
    );
    const pair = graphDemoSocketPair(false);
    const pairReady = !graphStepUsesTeachingPair(targetStep) ||
      graphTeachingPairCompletelyVisible(pair, 10);
    const existingConnection = graphTeachingPairExistingConnection(pair);
    const preserveExactGraphState = Boolean(
      step.demo === "graph-flip" &&
      pair?.boolNode &&
      pair?.notNode &&
      existingConnection
    );
    const spacing = step.demo === "graph-flip"
      ? graphTeachingPairSpacingProof(pair, {
          minimumGraphGap: 120,
          maximumGraphGap: 920,
          minimumClientGap: window.innerWidth < 480 ? 24 : 32
        })
      : null;
    const spacingReady = spacing?.ok !== false;
    const visible = visibleGraphClientRect(0);
    const panelsReady = Boolean(
      terminal.panels.leftOpen === requirements.left &&
      terminal.panels.rightOpen === requirements.right
    );
    const ordinaryReady = Boolean(
      terminal.graphMode &&
      terminal.graphActive &&
      panelsReady &&
      visible &&
      visible.width >= 280 &&
      visible.height >= graphLessonMinimumVisibleHeight() &&
      pairReady &&
      spacingReady
    );
    const ready = preserveExactGraphState
      ? Boolean(terminal.graphMode && terminal.graphActive)
      : ordinaryReady;
    const handoff = ready
      ? {
          fromDemo: step.demo,
          toDemo,
          terminal,
          skippedDemonstration: true,
          preserveExactGraphState
        }
      : null;
    graphTeachingSceneHandoff = handoff;
    tourDebugRecord("graph-scene-skip-handoff-terminal", {
      fromDemo: step.demo,
      toDemo,
      ready,
      panelsReady,
      pairReady,
      connectedTeachingPair: Boolean(existingConnection),
      preserveExactGraphState,
      spacingReady,
      spacing,
      requirements,
      scene: terminal,
      policy:
        "skipping a graph action carries the current readable scene forward without moving either node"
    });
    tourDebugAssert(
      `${step.demo}-skip-scene-handoff-decision-recorded`,
      Boolean(handoff) === ready,
      {
        fromDemo: step.demo,
        toDemo,
        panelsReady,
        pairReady,
        connectedTeachingPair: Boolean(existingConnection),
        preserveExactGraphState,
        spacingReady,
        spacing,
        requirements,
        visibleGraph: visible,
        scene: terminal
      }
    );
    if (step.demo === "graph-flip") {
      tourDebugRecord(
        "graph-flip-skip-handoff-decision",
        {
          ready,
          fromDemo: step.demo,
          toDemo,
          panelsReady,
          pairReady,
          connectedTeachingPair: Boolean(existingConnection),
          preserveExactGraphState,
          spacingReady,
          spacing,
          visibleGraph: visible,
          scene: terminal,
          policy:
            "reuse the exact Step 9 scene when possible; otherwise prepare Step 10 with complete-footprint spacing"
        }
      );
    }
    return {
      ready,
      handoff,
      terminal,
      panelsReady,
      pairReady,
      connectedTeachingPair: Boolean(existingConnection),
      preserveExactGraphState,
      spacingReady,
      spacing
    };
  }

  async function finalizeGraphSceneForNextLesson(step, runId) {
    const toDemo = GRAPH_CONTINUOUS_SCENE_NEXT[step?.demo];
    if (!toDemo || runId !== demoRunId) return true;
    const targetStep = steps.find(candidate => candidate.demo === toDemo);
    if (!targetStep) return true;

    const targetRequirements = graphPanelRequirementsForStep(targetStep);
    const allNodeIds = (window.RMLDynamicGraphHost?.getState?.()?.nodes || [])
      .map(node => node.id)
      .filter(Boolean);
    const requiredNodeIds = ["graph-create-node", "graph-inspector"].includes(toDemo)
      ? allNodeIds
      : graphTeachingNodeIdsFromState();
    const sceneReady = () => {
      const visible = visibleGraphClientRect(0);
      const nodesVisible = requiredNodeIds.length > 0 &&
        requiredNodeIds.every(nodeId => {
          const node = document.querySelector(
            `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
          );
          return graphTeachingElementInsideViewport(node, 8);
        });
      const graphCreateReady = toDemo !== "graph-create-node" || Boolean(
        graphCreateNodePreparedDropPlan?.complete === true &&
        graphCreateNodePreparedDropHit("logic.not")?.fullFootprintInside === true
      );
      const graphRouteReady = toDemo !== "graph-route" ||
        graphTeachingPairCompletelyVisible(graphDemoSocketPair(false), 10);
      const pairReady = toDemo === "graph-create-node" ||
        graphTeachingPairCompletelyVisible(graphDemoSocketPair(false), 10);
      return Boolean(
        graphStepHasPreparedPanels(targetStep) &&
        visible &&
        visible.width >= 280 &&
        visible.height >= graphLessonMinimumVisibleHeight() &&
        nodesVisible &&
        graphCreateReady &&
        graphRouteReady &&
        pairReady
      );
    };

    const before = graphTeachingSceneSnapshot(
      `${step.demo}-completion-before-${toDemo}`
    );
    const exactCameraHandoff =
      step.demo === "graph-pan" && toDemo === "graph-route";
    if (!sceneReady() && !exactCameraHandoff) {
      clearDemoVisuals();
      hideMouse();
      await setGraphPanelsForPreparation(targetStep, runId);
      if (runId !== demoRunId) return false;
      await ensureGraphViewportWindow(runId);
      if (runId !== demoRunId) return false;
      if (toDemo === "graph-create-node") {
        await prepareGraphCreateNodePlacementArea(runId);
      } else {
        await animateGraphNodesToReadableFrame(
          requiredNodeIds,
          runId,
          {
            inset: toDemo === "graph-inspector" ? 18 : 22,
            padding:
              window.innerWidth < 480
                ? 18
                : window.innerWidth < 820
                  ? 24
                  : 34,
            maxScale:
              window.innerWidth < 480
                ? .72
                : window.innerWidth < 820
                  ? .84
                  : 1.02,
            duration: 620
          }
        );
      }
      if (runId !== demoRunId) return false;
    }

    const after = graphTeachingSceneSnapshot(
      `${step.demo}-completion-ready-for-${toDemo}`
    );
    const ready = sceneReady();
    const completionComparison = compareGraphTeachingScenes(before, after);
    tourDebugRecord("graph-scene-natural-completion-frame", {
      fromDemo: step.demo,
      toDemo,
      adjusted: completionComparison.exact !== true,
      exactCameraHandoff,
      assistantNoticeVisible: false,
      before,
      after,
      ready
    });
    const hiddenCameraJumpBlocked = step.demo !== "graph-pan" ||
      toDemo !== "graph-route" ||
      completionComparison.exact === true;
    if (step.demo === "graph-pan" && toDemo === "graph-route") {
      tourDebugAssert(
        "graph-pan-to-graph-route-no-hidden-camera-or-zoom-adjustment",
        hiddenCameraJumpBlocked,
        {
          before,
          after,
          mismatches: completionComparison.mismatches,
          policy:
            "after Step 10 reaches its visible final frame, finalization may not pan, zoom, resize, reposition or otherwise prepare Step 11 behind the user's back"
        }
      );
    }
    const verified = tourDebugAssert(
      `${step.demo}-finished-in-${toDemo}-ready-scene`,
      ready && hiddenCameraJumpBlocked,
      {
        fromDemo: step.demo,
        toDemo,
        targetRequirements,
        requiredNodeIds,
        before,
        after,
        policy:
          "the previous demonstration itself ends on the complete frame inherited unchanged by the next graph lesson"
      }
    );
    if (toDemo === "graph-create-node") {
      tourDebugAssert("graph-preparation-complete", ready, {
        target: toDemo,
        naturalCompletionOfPreviousLesson: true,
        visibleGraph: visibleGraphClientRect(0)
      });
    }
    if (!verified) {
      if (step.demo === "graph-route" && toDemo === "graph-inspector") {
        graphStep11MarkStage("step12-handoff-deferred", {
          ready,
          hiddenCameraJumpBlocked,
          mismatches: completionComparison.mismatches,
          policy:
            "A narrow iPhone handoff is prepared by Step 12 itself; it must not retroactively fail a completed Step 11 action."
        });
        graphTeachingSceneHandoff = null;
        return false;
      }
      graphDemoError(
        `${step.demo} could not finish on the complete scene required by ${toDemo}.`
      );
    }
    return true;
  }

  function graphPanelRequirementsForStep(step) {
    if (
      [
        "graph-create-node",
        "graph-wire",
        "graph-flip",
        "graph-pan",
        "graph-route",
        "graph-inspector"
      ].includes(step?.demo)
    ) {
      return {
        left: true,
        right: false
      };
    }
    return {
      left: true,
      right: true
    };
  }

  function graphStepUsesTeachingPair(step) {
    return [
      "graph-wire",
      "graph-flip",
      "graph-pan",
      "graph-route",
      "graph-inspector"
    ].includes(step?.demo);
  }

  function graphTeachingNodeIdsFromState() {
    const pair = graphDemoSocketPair(false);
    return [
      pair?.boolNode?.dataset.graphNodeId,
      pair?.notNode?.dataset.graphNodeId
    ].filter(Boolean);
  }

  function graphTeachingPairSpacingProof(
    pair = graphDemoSocketPair(false),
    options = {}
  ) {
    const state = window.RMLDynamicGraphHost?.getState?.() || null;
    const nodes = new Map(
      (state?.nodes || []).map(node => [String(node.id || ""), node])
    );
    const footprint = element => {
      const id = String(element?.dataset?.graphNodeId || "");
      const model = nodes.get(id) || null;
      if (!(element instanceof HTMLElement) || !model) return null;
      const width = Math.max(
        1,
        Number(element.offsetWidth) ||
          (model.kind === "configuration" ? 390 : 280)
      );
      const height = Math.max(1, Number(element.offsetHeight) || 180);
      const left = Number(model.x || 0);
      const top = Number(model.y || 0);
      return {
        id,
        left,
        top,
        right: left + width,
        bottom: top + height,
        width,
        height
      };
    };
    const source = footprint(pair?.boolNode);
    const target = footprint(pair?.notNode);
    const sourceClient = pair?.boolNode?.getBoundingClientRect?.() || null;
    const targetClient = pair?.notNode?.getBoundingClientRect?.() || null;
    const separation = (first, second) => {
      if (!first || !second) {
        return {
          xGap: 0,
          yGap: 0,
          edgeGap: 0,
          overlapX: 0,
          overlapY: 0,
          overlaps: true
        };
      }
      const xGap = Math.max(
        second.left - first.right,
        first.left - second.right,
        0
      );
      const yGap = Math.max(
        second.top - first.bottom,
        first.top - second.bottom,
        0
      );
      const overlapX = Math.max(
        0,
        Math.min(first.right, second.right) -
          Math.max(first.left, second.left)
      );
      const overlapY = Math.max(
        0,
        Math.min(first.bottom, second.bottom) -
          Math.max(first.top, second.top)
      );
      return {
        xGap,
        yGap,
        edgeGap: Math.hypot(xGap, yGap),
        overlapX,
        overlapY,
        overlaps: overlapX > .5 && overlapY > .5
      };
    };
    const logical = separation(source, target);
    const client = separation(sourceClient, targetClient);
    const minimumGraphGap = Math.max(
      80,
      Number(options.minimumGraphGap) || 120
    );
    const maximumGraphGap = Math.max(
      minimumGraphGap + 100,
      Number(options.maximumGraphGap) || 920
    );
    const minimumClientGap = Math.max(
      16,
      Number(options.minimumClientGap) || 32
    );
    const requireClient = options.requireClient !== false;
    const logicalOk = Boolean(
      source &&
      target &&
      !logical.overlaps &&
      logical.edgeGap >= minimumGraphGap &&
      logical.edgeGap <= maximumGraphGap
    );
    const clientOk = Boolean(
      sourceClient &&
      targetClient &&
      !client.overlaps &&
      client.edgeGap >= minimumClientGap
    );
    return {
      ok: logicalOk && (!requireClient || clientOk),
      logicalOk,
      clientOk,
      logical,
      client,
      source,
      target,
      sourceClient: tourDebugRect(pair?.boolNode),
      targetClient: tourDebugRect(pair?.notNode),
      minimumGraphGap,
      maximumGraphGap,
      minimumClientGap,
      requireClient
    };
  }

  function normalizeGraphTeachingPairSpacing() {
    const pair = graphDemoSocketPair(false);
    const boolId = pair?.boolNode?.dataset.graphNodeId || "";
    const notId = pair?.notNode?.dataset.graphNodeId || "";
    if (!boolId || !notId) {
      return {
        ok: false,
        changed: false,
        reason: "teaching-pair-unavailable"
      };
    }

    const state = window.RMLDynamicGraphHost?.getState?.();
    const boolNode = state?.nodes?.find(node => node.id === boolId);
    const notNode = state?.nodes?.find(node => node.id === notId);
    if (!boolNode || !notNode) {
      return {
        ok: false,
        changed: false,
        reason: "teaching-pair-model-unavailable"
      };
    }

    const before = graphTeachingPairSpacingProof(pair, {
      requireClient: false
    });
    if (before.logicalOk) {
      return {
        ok: true,
        changed: false,
        reason: "existing-edge-spacing-preserved",
        before,
        after: before
      };
    }

    const source = before.source;
    const target = before.target;
    if (!source || !target) {
      return {
        ok: false,
        changed: false,
        reason: "teaching-pair-footprint-unavailable",
        before
      };
    }
    const sourceCenter = {
      x: source.left + source.width * .5,
      y: source.top + source.height * .5
    };
    const targetCenter = {
      x: target.left + target.width * .5,
      y: target.top + target.height * .5
    };
    const deltaX = targetCenter.x - sourceCenter.x;
    const deltaY = targetCenter.y - sourceCenter.y;
    const horizontal = Math.abs(deltaX) >= Math.abs(deltaY);
    const desiredGap = 190;
    let nextX = target.left;
    let nextY = target.top;

    if (horizontal) {
      const targetOnRight = deltaX >= 0;
      nextX = targetOnRight
        ? source.right + desiredGap
        : source.left - target.width - desiredGap;
      nextY = sourceCenter.y - target.height * .5;
    } else {
      const targetBelow = deltaY >= 0;
      nextX = sourceCenter.x - target.width * .5;
      nextY = targetBelow
        ? source.bottom + desiredGap
        : source.top - target.height - desiredGap;
    }

    const moved = window.RMLDynamicGraphHost?.setNodePosition?.(
      notId,
      nextX,
      nextY
    ) || null;
    const livePair = graphDemoSocketPair(false);
    const after = graphTeachingPairSpacingProof(livePair, {
      requireClient: false
    });
    return {
      ok: moved?.ok === true && after.logicalOk,
      changed: moved?.ok === true,
      reason: "actual-node-footprints-normalized",
      orientation: horizontal ? "horizontal" : "vertical",
      desiredGap,
      preservedNodeId: boolId,
      movedNodeId: notId,
      requestedPosition: { x: nextX, y: nextY },
      moved,
      before,
      after
    };
  }

  function graphStepHasPreparedPanels(step) {
    const requirements = graphPanelRequirementsForStep(step);
    return (
      graphSidebarIsHidden("left") === !requirements.left &&
      graphSidebarIsHidden("right") === !requirements.right
    );
  }

  async function setGraphModeForPreparation(wantsGraph, runId) {
    const active = document.body.classList.contains("rml-node-graph-mode");
    if (active === wantsGraph) return false;
    const graphState = window.RMLDynamicGraphHost?.getState?.() || null;
    if (wantsGraph && graphState?.active === true) {
      const repaired =
        window.RMLDynamicGraphHost?.ensureActiveMode?.() || null;
      await nextTwoFrames();
      const repairedActive =
        document.body.classList.contains("rml-node-graph-mode");
      tourDebugAssert(
        "graph-preparation-live-mode-reconciled-without-toggle",
        repaired?.ok === true && repairedActive,
        {
          graphProductActive: graphState.active === true,
          graphModeClassBefore: active,
          graphModeClassAfter: repairedActive,
          repair: repaired
        }
      );
      return repairedActive;
    }
    const button =
      document.querySelector(".rml-pack-button") ||
      document.querySelector("#pack-into-node");
    if (!(button instanceof HTMLElement)) return false;

    button.click();
    for (let attempt = 0; attempt < 40 && runId === demoRunId; attempt += 1) {
      if (
        document.body.classList.contains("rml-node-graph-mode") === wantsGraph
      ) {
        await nextTwoFrames();
        return true;
      }
      await tourNextVisualFrame();
    }
    return false;
  }

  async function setGraphPanelsForPreparation(step, runId) {
    const requirements = graphPanelRequirementsForStep(step);
    for (const side of ["left", "right"]) {
      if (runId !== demoRunId) return false;
      const shouldBeOpen = requirements[side] === true;
      const isHidden = graphSidebarIsHidden(side);
      if (shouldBeOpen === !isHidden) continue;
      const toggle = document.querySelector(
        `.rml-graph-panel-toggle-${side}, [data-rml-graph-toggle-${side}]`
      );
      if (toggle instanceof HTMLElement) {
        toggle.click();
        for (let attempt = 0; attempt < 20 && runId === demoRunId; attempt += 1) {
          await nextTwoFrames();
          if (graphSidebarIsHidden(side) === !shouldBeOpen) break;
        }
      }
    }
    const prepared = graphStepHasPreparedPanels(step);
    tourDebugAssert("graph-panels-open-after-preparation", prepared, {
      leftOpen: !graphSidebarIsHidden("left"),
      rightOpen: !graphSidebarIsHidden("right")
    });
    return prepared;
  }

  async function silentlyEnsureGraphTeachingPair(runId) {
    if (runId !== demoRunId) return null;
    const pair = await ensureGraphDemoNodes(runId);
    return {
      pair,
      nodeIds: graphTeachingNodeIdsFromState()
    };
  }

  function graphStepNeedsPreparation(step) {
    if (!step || step.mode !== "graph") return false;
    if (
      step.demo === "mode-switch-graph" ||
      step.demo === "mode-switch-outline-preview"
    ) {
      return false;
    }
    if (!document.body.classList.contains("rml-node-graph-mode")) return true;
    if (!graphStepHasPreparedPanels(step)) return true;

    const handoff = graphSceneHandoffEvaluation(step);
    if (handoff?.reusable === true) return false;

    if (
      step.demo === "graph-create-node" &&
      !graphDemoFindNode(/(?:^|\s)NOT(?:\s|$)/i)
    ) {
      return true;
    }

    const viewport = document.querySelector(".rml-graph-viewport");
    const visible = visibleGraphClientRect(0);
    const minimumHeight =
      graphLessonMinimumVisibleHeight();
    if (
      !viewport ||
      !visible ||
      visible.width < 280 ||
      visible.height < minimumHeight ||
      tourPageRootCenteringPlan(viewport).useful
    ) {
      return true;
    }

    if (graphStepUsesTeachingPair(step)) {
      const pair = graphDemoSocketPair(false);
      if (!graphTeachingPairCompletelyVisible(pair, 18)) return true;
    }
    return false;
  }

  function graphCreateNodePlacementRegions(visible, orientation) {
    const gap = Math.max(
      18,
      Math.min(34, Math.min(visible.width, visible.height) * .06)
    );
    if (orientation === "vertical") {
      const split = visible.top + (visible.height - gap) * .48;
      return {
        orientation,
        existingArea: {
          left: visible.left,
          right: visible.right,
          top: visible.top,
          bottom: split,
          width: visible.width,
          height: Math.max(0, split - visible.top)
        },
        reservedArea: {
          left: visible.left,
          right: visible.right,
          top: split + gap,
          bottom: visible.bottom,
          width: visible.width,
          height: Math.max(0, visible.bottom - split - gap)
        }
      };
    }
    const split = visible.left + (visible.width - gap) * .48;
    return {
      orientation: "horizontal",
      existingArea: {
        left: visible.left,
        right: split,
        top: visible.top,
        bottom: visible.bottom,
        width: Math.max(0, split - visible.left),
        height: visible.height
      },
      reservedArea: {
        left: split + gap,
        right: visible.right,
        top: visible.top,
        bottom: visible.bottom,
        width: Math.max(0, visible.right - split - gap),
        height: visible.height
      }
    };
  }

  function graphCreateNodePointerPlan(reservedArea, metrics, margin = 14) {
    if (!reservedArea || metrics?.ok !== true) return null;
    const width = Number(metrics.clientWidth) || 0;
    const height = Number(metrics.clientHeight) || 0;
    const anchorX = Number(metrics.clientPointerOffsetX) || width * .465;
    const anchorY = Number(metrics.clientPointerOffsetY) || height * .185;
    const footprint = {
      left:
        reservedArea.left +
        (reservedArea.width - width) * .5,
      top:
        reservedArea.top +
        (reservedArea.height - height) * .5,
      width,
      height
    };
    footprint.right = footprint.left + width;
    footprint.bottom = footprint.top + height;
    const point = {
      x: footprint.left + anchorX,
      y: footprint.top + anchorY
    };
    const fits = Boolean(
      footprint.left >= reservedArea.left + margin &&
      footprint.right <= reservedArea.right - margin &&
      footprint.top >= reservedArea.top + margin &&
      footprint.bottom <= reservedArea.bottom - margin
    );
    return { point, footprint, fits, metrics };
  }

  async function prepareGraphCreateNodePlacementArea(runId) {
    if (runId !== demoRunId) return false;
    const viewport = document.querySelector(".rml-graph-viewport");
    const graphState = window.RMLDynamicGraphHost?.getState?.() || null;
    const nodeIds = (graphState?.nodes || [])
      .map(node => node.id)
      .filter(Boolean);
    const initialVisible = visibleGraphClientRect(18);
    if (!viewport || !initialVisible) return false;
    tourDebugAssert(
      "graph-create-node-palette-open-inspector-hidden-for-space",
      !graphSidebarIsHidden("left") && graphSidebarIsHidden("right"),
      {
        leftOpen: !graphSidebarIsHidden("left"),
        rightOpen: !graphSidebarIsHidden("right"),
        visibleGraph: initialVisible
      }
    );

    const preferredOrientations = initialVisible.width >= initialVisible.height * .82
      ? ["horizontal", "vertical"]
      : ["vertical", "horizontal"];
    const attempts = [];
    for (const orientation of preferredOrientations) {
      if (runId !== demoRunId) return false;
      const beforeVisible = visibleGraphClientRect(18);
      if (!beforeVisible) break;
      const regions = graphCreateNodePlacementRegions(
        beforeVisible,
        orientation
      );
      const panOnly = nodeIds.length > 0
        ? panGraphNodesIntoClientRect(
            nodeIds,
            regions.existingArea,
            { padding: 16 }
          )
        : {
            ok: true,
            changed: false,
            reason: "no-existing-nodes"
          };
      const currentScale = Number(
        window.RMLDynamicGraphHost?.getViewportState?.()?.viewport?.scale
      ) || 1;
      const fitted = nodeIds.length > 0 &&
        panOnly.ok !== true &&
        panOnly.reason === "current-scale-too-large"
        ? window.RMLDynamicGraphHost?.fitNodesToClientRect?.(
            nodeIds,
            regions.existingArea,
            {
              padding: 16,
              maxScale: currentScale
            }
          ) || null
        : {
            ok: panOnly.ok === true,
            method: "pan-first",
            panOnly,
            scale: currentScale
          };
      await nextTwoFrames();
      if (runId !== demoRunId) return false;

      const visible = visibleGraphClientRect(18);
      const liveRegions = visible
        ? graphCreateNodePlacementRegions(visible, orientation)
        : null;
      const metrics = window.RMLDynamicGraphHost
        ?.getOperatorPlacementMetrics?.("logic.not") || null;
      const pointerPlan = graphCreateNodePointerPlan(
        liveRegions?.reservedArea,
        metrics,
        18
      );
      const existingRects = [...document.querySelectorAll(".rml-graph-node")]
        .filter(tourElementActuallyVisible)
        .map(node => node.getBoundingClientRect());
      const existingCompletelyInArea = Boolean(
        liveRegions &&
        existingRects.every(rect =>
          rect.left >= liveRegions.existingArea.left + 8 &&
          rect.right <= liveRegions.existingArea.right - 8 &&
          rect.top >= liveRegions.existingArea.top + 8 &&
          rect.bottom <= liveRegions.existingArea.bottom - 8
        )
      );
      const largestExistingCoverage = existingRects.reduce(
        (largest, rect) => Math.max(
          largest,
          visible
            ? (rect.width * rect.height) /
              Math.max(1, visible.width * visible.height)
            : 1
        ),
        0
      );
      const overlapsExisting = Boolean(
        pointerPlan?.footprint &&
        existingRects.some(rect => !(
          pointerPlan.footprint.right + 12 < rect.left ||
          pointerPlan.footprint.left - 12 > rect.right ||
          pointerPlan.footprint.bottom + 12 < rect.top ||
          pointerPlan.footprint.top - 12 > rect.bottom
        ))
      );
      const complete = Boolean(
        fitted?.ok === true &&
        pointerPlan?.fits === true &&
        existingCompletelyInArea &&
        largestExistingCoverage <= .42 &&
        !overlapsExisting
      );
      const attempt = {
        orientation,
        panOnly,
        fitted,
        regions: liveRegions,
        pointerPlan,
        existingRects: existingRects.map(rect => ({
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height
        })),
        existingCompletelyInArea,
        largestExistingCoverage,
        overlapsExisting,
        complete
      };
      attempts.push(attempt);
      if (complete) {
        graphCreateNodePreparedDropPlan = {
          runId,
          ...attempt
        };
        tourDebugAssert(
          "graph-create-node-complete-footprint-prepared-before-narration",
          true,
          {
            orientation,
            reservedArea: liveRegions.reservedArea,
            footprint: pointerPlan.footprint,
            point: pointerPlan.point,
            metrics,
            existingNodeCount: existingRects.length
          }
        );
        tourDebugAssert(
          "graph-create-node-start-scene-bounded-before-narration",
          existingCompletelyInArea && largestExistingCoverage <= .42,
          {
            orientation,
            largestExistingCoverage,
            existingArea: liveRegions.existingArea,
            existingRects: attempt.existingRects,
            visibleGraph: visible
          }
        );
        return true;
      }
    }

    graphCreateNodePreparedDropPlan = null;
    tourDebugAssert(
      "graph-create-node-complete-footprint-prepared-before-narration",
      false,
      { attempts }
    );
    return false;
  }

  async function prepareGraphStepBeforeNarration(step, runId) {
    if (runId !== demoRunId) return false;
    const html = document.documentElement;
    html.classList.add("rml-setup-preparation-scroll");
    tourDebugRecord("graph-preparation-start", {
      target: step?.demo || "",
      graphRect: tourDebugRect(document.querySelector(".rml-graph-viewport"))
    });
    try {
      await setGraphModeForPreparation(true, runId);
      if (runId !== demoRunId) return false;
      await setGraphPanelsForPreparation(step, runId);
      if (runId !== demoRunId) return false;
      if (!graphStepHasPreparedPanels(step)) {
        throw new Error(
          "[RML Tour · Preparation] Both Runtime Graph sidebars could not be restored."
        );
      }

      const usable = await ensureGraphViewportWindow(runId);
      if (runId !== demoRunId) return false;
      if (!usable) {
        throw new Error(
          "[RML Tour · Preparation] The Runtime Graph viewport could not be revealed."
        );
      }

      if (graphStepUsesTeachingPair(step)) {
        await silentlyEnsureGraphTeachingPair(runId);
        if (runId !== demoRunId) return false;
      }

      if (step.demo !== "graph-create-node") {
        const allNodeIds = (window.RMLDynamicGraphHost?.getState?.()?.nodes || [])
          .map(node => node.id)
          .filter(Boolean);
        quietlyFitGraphNodes(allNodeIds, {
          inset: 24,
          padding: Math.max(22, Math.min(42, window.innerWidth * .025)),
          maxScale: Number(
            window.RMLDynamicGraphHost?.getViewportState?.()?.viewport?.scale
          ) || 1
        });
        await nextTwoFrames();
      }

      if (step.demo === "graph-create-node") {
        const placementPrepared =
          await prepareGraphCreateNodePlacementArea(runId);
        if (!placementPrepared) {
          throw new Error(
            "[RML Tour · Preparation] No complete visible NOT-node rectangle could be reserved before Step 7 narration."
          );
        }
      }

      if (graphStepUsesTeachingPair(step)) {
        const spacingNormalization =
          normalizeGraphTeachingPairSpacing();
        quietlyFitGraphNodes(
          graphTeachingNodeIdsFromState(),
          {
            inset: 28,
            padding: window.innerWidth < 820 ? 24 : 36,
            maxScale:
              window.innerWidth < 480
                ? .72
                : window.innerWidth < 820
                  ? .82
                  : 1.02
          }
        );
        await nextTwoFrames();
        const pair = graphDemoSocketPair(false);
        const spacingProof = graphTeachingPairSpacingProof(pair, {
          minimumGraphGap: 120,
          maximumGraphGap: 920,
          minimumClientGap: window.innerWidth < 480 ? 24 : 32
        });
        const readableSpacing = tourDebugAssert(
          "graph-teaching-pair-uses-complete-footprint-spacing",
          spacingNormalization.ok === true && spacingProof.ok === true,
          {
            target: step.demo,
            normalization: spacingNormalization,
            proof: spacingProof,
            policy:
              "pair spacing is measured from the real outer node rectangles, never from their top-left coordinates"
          }
        );
        if (!readableSpacing) {
          graphDemoError(
            "Preparation could not keep a readable non-overlapping gap between the complete teaching nodes.",
            {
              target: step.demo,
              normalization: spacingNormalization,
              proof: spacingProof
            }
          );
        }
        if (!graphTeachingPairCompletelyVisible(pair, 12)) {
          graphDemoError(
            "Preparation could not fit the complete teaching scene into the visible graph area."
          );
        }
      }

      const finalVisible = visibleGraphClientRect(0);
      const success = Boolean(
        graphStepHasPreparedPanels(step) &&
        finalVisible &&
        finalVisible.width >= 280 &&
        finalVisible.height >=
          graphLessonMinimumVisibleHeight()
      );
      tourDebugAssert("graph-preparation-complete", success, {
        target: step?.demo || "",
        visibleGraph: finalVisible,
        graphRect: tourDebugRect(document.querySelector(".rml-graph-viewport"))
      });
      tourDebugRecord("graph-preparation-end", {
        target: step?.demo || "",
        success,
        visibleGraph: finalVisible
      });
      if (!success) {
        throw new Error(
          "[RML Tour · Preparation] The final graph composition did not satisfy the viewport contract."
        );
      }
      return success;
    } finally {
      html.classList.remove("rml-setup-preparation-scroll");
    }
  }

  async function prepareOutlineNestedBeforeNarration(step, runId) {
    if (runId !== demoRunId || step?.demo !== "outline-nested") return false;
    const html = document.documentElement;
    html.classList.add("rml-setup-preparation-scroll");
    tourDebugRecord("outline-nested-preparation-start");
    try {
      const controllerCard = [...document.querySelectorAll(
        ".node-card.controller[data-node-id]"
      )].find(card =>
        card.querySelector(":scope > .node-head .node-copy > strong")
          ?.textContent?.trim() === "DisplayMode"
      ) || null;
      await nativeTourScrollTargetIntoView(controllerCard, runId);
      await nextTwoFrames();
      const host = controllerCard?.querySelector(
        ":scope > .controller-options"
      );
      const lanes = directChildrenWithClass(host, "option-lane");
      const laneName = lane => lane.querySelector(
        ":scope > .option-heading > span"
      )?.textContent?.trim() || "";
      const childNames = lane => [...lane.querySelectorAll(
        ":scope > .drop-zone > .node-card > .node-head .node-copy > strong"
      )].map(element => element.textContent.trim());
      const general = lanes.find(lane => laneName(lane) === "General");
      const advanced = lanes.find(lane => laneName(lane) === "Advanced");
      const generalChildren = general ? childNames(general) : [];
      const advancedChildren = advanced ? childNames(advanced) : [];
      const success = Boolean(
        controllerCard &&
        host &&
        general &&
        advanced &&
        outlineChildNamesMatch(
          generalChildren,
          ["Enabled", "Scale"]
        ) &&
        outlineChildNamesMatch(
          advancedChildren,
          ["Quality", "DetailSection"]
        )
      );
      tourDebugAssert(
        "outline-nested-native-reference-state-prepared",
        success,
        {
          controllerRect: tourDebugRect(controllerCard),
          generalChildren,
          advancedChildren,
          helperCount: outlineNestedPreparationHelperIds.length
        }
      );
      tourDebugRecord("outline-nested-preparation-end", {
        success,
        controllerRect: tourDebugRect(controllerCard),
        generalChildren,
        advancedChildren
      });
      if (!success) {
        throw new Error(
          "[RML Tour · Preparation] Step 4 no longer matches the native DisplayMode reference state."
        );
      }
      return success;
    } finally {
      html.classList.remove("rml-setup-preparation-scroll");
    }
  }

  async function prepareOutlineReorderBeforeNarration(step, runId) {
    if (
      runId !== demoRunId ||
      step?.demo !== "outline-reorder-scroll"
    ) {
      return false;
    }
    const html = document.documentElement;
    html.classList.add("rml-setup-preparation-scroll");
    tourDebugRecord("outline-reorder-preparation-start");
    try {
      let scene = bestVerticalOutlineScene();
      if (!scene?.host || !scene?.source) {
        throw new Error(
          "[RML Tour · Preparation] Step 3 has no compact Outline card with a real sibling."
        );
      }

      await nativeTourScrollTargetIntoView(scene.source, runId);
      await nextTwoFrames();
      if (runId !== demoRunId) return false;

      scene = bestVerticalOutlineScene() || scene;
      let viewport = tourViewport();
      const centralTop = tourHeaderBottom() + 120;
      const centralBottom = viewport.bottom - 120;
      let visibleSlots = verticalInsertionSlots(scene.host).filter(slot =>
        slot.top >= centralTop &&
        slot.top <= centralBottom
      );

      if (visibleSlots.length === 0) {
        const allSlots = verticalInsertionSlots(scene.host);
        const desiredY = Math.max(
          centralTop,
          Math.min(centralBottom, viewport.top + viewport.height * .58)
        );
        const closest = allSlots.reduce(
          (best, current) =>
            !best || Math.abs(current.top - desiredY) < Math.abs(best.top - desiredY)
              ? current
              : best,
          null
        );
        const scrollState = tourPageRootScrollState();
        if (closest && scrollState.scroller && scrollState.maxTop > 1) {
          const desiredScrollTop = Math.max(
            0,
            Math.min(
              scrollState.maxTop,
              scrollState.scroller.scrollTop + closest.top - desiredY
            )
          );
          await animateTourPageScroll(
            desiredScrollTop,
            TOUR_SCROLL_TIMING.pageScrollDuration,
            runId
          );
          await nextTwoFrames();
          scene = bestVerticalOutlineScene() || scene;
          viewport = tourViewport();
          visibleSlots = verticalInsertionSlots(scene.host).filter(slot =>
            slot.top >= tourHeaderBottom() + 100 &&
            slot.top <= viewport.bottom - 100
          );
        }
      }
      const sourceVisible = tourTargetComfortablyVisible(scene.source);
      const range = Math.max(
        0,
        (document.scrollingElement?.scrollHeight || 0) -
          (document.scrollingElement?.clientHeight || 0)
      );
      const success = Boolean(
        outlineStep3ScenePreservesStep4Reference(scene) &&
        sourceVisible &&
        visibleSlots.length > 0 &&
        range >= 48
      );
      tourDebugAssert(
        "outline-reorder-source-and-gap-prepared",
        success,
        {
          sourceRect: tourDebugRect(scene.source),
          hostRect: tourDebugRect(scene.host),
          step4ReferenceProtected:
            outlineStep3ScenePreservesStep4Reference(scene),
          step4ReferenceRect: tourDebugRect(
            outlineStep4ReferenceController()
          ),
          visibleGapCount: visibleSlots.length,
          range
        }
      );
      if (!success) {
        throw new Error(
          "[RML Tour · Preparation] Step 3 could not keep both a compact source and a card-free release gap visible."
        );
      }
      return true;
    } finally {
      html.classList.remove("rml-setup-preparation-scroll");
    }
  }

  async function teacherSwitchGraphMode(wantsGraph, runId) {
    const graphActive =
      document.body.classList.contains("rml-node-graph-mode");
    if (graphActive === wantsGraph) return true;

    const button =
      document.querySelector(".rml-pack-button") ||
      document.querySelector("#pack-into-node");

    const menu = await teacherEnsureResponsiveTopActionsOpen(
      button,
      wantsGraph
        ? "Open the responsive Hamburger before choosing Open Runtime Graph"
        : "Open the responsive Hamburger before returning to Configuration Outline",
      runId
    );
    if (menu.required && !menu.open) return false;
    const responsive = responsiveTopActionsState(button);
    if (
      responsive.responsive &&
      responsive.actions instanceof HTMLElement &&
      !elementVisibleInsideScroller(button, responsive.actions, 6)
    ) {
      const revealed = await revealCompactTopbarAction(button, runId);
      if (!revealed || runId !== demoRunId) return false;
    }

    if (!tourElementActuallyVisible(button)) return false;

    await nativeTourScrollTargetIntoView(
      button,
      runId
    );
    if (runId !== demoRunId) return false;

    const switched = await teacherClickElement(
      button,
      wantsGraph
        ? "Use the real Pack into Node button"
        : "Use the same real button to return to Configuration Outline",
      runId
    );

    if (!switched) return false;

    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (
        document.body.classList.contains("rml-node-graph-mode") ===
        wantsGraph
      ) {
        const graphViewport = document.querySelector(".rml-graph-viewport");
        if (graphViewport) tourResizeObserver?.observe?.(graphViewport);
        return true;
      }
      await tourNextVisualFrame();
    }
    return false;
  }

  async function teacherPrepareStep(step, target, runId) {
    const explicitModeDemo =
      step?.demo === "mode-switch-graph" ||
      step?.demo === "mode-switch-outline-preview";

    if (!explicitModeDemo) {
      const graphActive = document.body.classList.contains("rml-node-graph-mode");
      if (step?.mode === "graph" && !graphActive) {
        graphDemoError("The graph lesson lost its prepared view before Demonstrate.");
      }
      if (step?.mode === "outline" && graphActive) {
        graphDemoError("The Outline lesson lost its prepared view before Demonstrate.");
      }
    }

    if (runId !== demoRunId) return null;

    if (
      !explicitModeDemo &&
      step?.mode === "graph" &&
      graphStepUsesTeachingPair(step)
    ) {
      const pair = await ensureGraphTeachingPairVisible(runId);
      if (runId !== demoRunId) return null;
      if (step?.demo === "graph-inspector") {
        const inspectorPairReady = tourDebugAssert(
          "graph-inspector-teaching-pair-visible-before-demonstrate",
          graphTeachingPairCompletelyVisible(pair, 10),
          {
            teachingNodeIds: [
              pair?.boolNode?.dataset?.graphNodeId || "",
              pair?.notNode?.dataset?.graphNodeId || ""
            ].filter(Boolean),
            graphVisibleRect: visibleGraphClientRect(10),
            graphViewportRect: tourDebugRect(
              document.querySelector(".rml-graph-viewport")
            ),
            rightSidebarOpen: !graphSidebarIsHidden("right"),
            policy:
              "Step 12 may begin its action-only demonstration only after the page and graph camera show both complete teaching nodes inside the post-sidebar viewport"
          }
        );
        if (!inspectorPairReady) {
          graphDemoError(
            "Step 12 could not keep both complete teaching nodes visible before Demonstrate."
          );
        }
      }
    }

    if (
      !explicitModeDemo &&
      step?.demo === "graph-create-node" &&
      !graphDemoFindNode(/(?:^|\s)NOT(?:\s|$)/i)
    ) {
      let preparedDrop = graphCreateNodePreparedDropHit("logic.not");
      if (!preparedDrop) {
        await prepareGraphCreateNodePlacementArea(runId);
        if (runId !== demoRunId) return null;
        preparedDrop = graphCreateNodePreparedDropHit("logic.not");
      }
      const retained = tourDebugAssert(
        "graph-create-node-prepared-footprint-retained-until-demonstrate",
        Boolean(
          preparedDrop?.fullFootprintInside === true &&
          graphCreateNodePreparedDropPlan?.complete === true
        ),
        {
          preparedPlan: graphCreateNodePreparedDropPlan,
          liveDrop: preparedDrop,
          visibleGraph: visibleGraphClientRect(18)
        }
      );
      if (!retained) {
        graphDemoError(
          "Step 7 lost its complete reserved NOT-node rectangle before Demonstrate."
        );
      }
    }

    if (runId !== demoRunId) return null;
    if (
      !explicitModeDemo &&
      step?.mode === "graph" &&
      stepIndex > 6
    ) {
      const graphState = window.RMLDynamicGraphHost?.getState?.() || null;
      const pair = graphStepUsesTeachingPair(step)
        ? graphDemoSocketPair(false)
        : null;
      const pairReady = !graphStepUsesTeachingPair(step) ||
        graphTeachingPairCompletelyVisible(pair, 10);
      tourDebugAssert(
        `graph-following-lesson-prepared-view-retained-${step.demo}`,
        document.body.classList.contains("rml-node-graph-mode") &&
          graphState?.active === true &&
          pairReady,
        {
          lessonIndex: stepIndex,
          lessonDemo: step.demo,
          graphModeClass:
            document.body.classList.contains("rml-node-graph-mode"),
          graphProductActive: graphState?.active === true,
          teachingPairVisible: pairReady,
          teachingNodeIds: graphTeachingNodeIdsFromState()
        }
      );
    }
    return findTarget(step) || target;
  }

  function tourHeaderBottom() {
    const header =
      document.querySelector(".topbar") ||
      document.querySelector("header");
    if (!tourElementActuallyVisible(header)) {
      return tourViewport().top;
    }
    return Math.max(tourViewport().top, header.getBoundingClientRect().bottom);
  }

  function tourPageRootScrollState() {
    const scroller =
      document.scrollingElement ||
      document.documentElement;

    if (!scroller) {
      return {
        scroller: null,
        canScrollX: false,
        canScrollY: false,
        maxLeft: 0,
        maxTop: 0
      };
    }

    const maxLeft = Math.max(
      0,
      scroller.scrollWidth - scroller.clientWidth
    );

    const maxTop = Math.max(
      0,
      scroller.scrollHeight - scroller.clientHeight
    );

    return {
      scroller,
      canScrollX: maxLeft > 1,
      canScrollY: maxTop > 1,
      maxLeft,
      maxTop
    };
  }

  function tourPageRootCenteringPlan(target) {
    if (!target || !tourElementActuallyVisible(target)) {
      return {
        useful: false,
        reason: "target-not-visible"
      };
    }

    const {
      scroller,
      canScrollY,
      maxTop
    } = tourPageRootScrollState();

    if (!scroller || !canScrollY) {
      return {
        useful: false,
        reason: "root-not-scrollable"
      };
    }

    const rect = target.getBoundingClientRect();
    const viewport = tourViewport();
    const usefulTop = tourHeaderBottom() + 14;
    const usefulBottom = viewport.bottom - 14;
    const availableHeight = Math.max(1, usefulBottom - usefulTop);

    const currentTop = scroller.scrollTop;
    let rawDelta = 0;

    if (rect.height <= availableHeight) {
      if (rect.top < usefulTop) {
        rawDelta = rect.top - usefulTop;
      } else if (rect.bottom > usefulBottom) {
        rawDelta = rect.bottom - usefulBottom;
      }
    } else {
      const overlap = Math.max(
        0,
        Math.min(rect.bottom, usefulBottom) -
          Math.max(rect.top, usefulTop)
      );
      const requiredVisible = Math.min(
        220,
        availableHeight * .64
      );
      if (overlap < requiredVisible) {
        rawDelta = rect.bottom <= usefulTop + requiredVisible
          ? rect.bottom - (usefulTop + requiredVisible)
          : rect.top - (usefulBottom - requiredVisible);
      }
    }

    const desiredScrollTop = Math.max(
      0,
      Math.min(maxTop, currentTop + rawDelta)
    );

    const delta = desiredScrollTop - currentTop;

    const useful =
      Math.abs(delta) > 2;

    return {
      useful,
      reason:
        useful
          ? "reachable-better-position"
          : "already-at-best-reachable-position",
      scroller,
      currentTop,
      desiredScrollTop,
      delta,
      maxTop,
      desiredViewportTop: rect.top - delta,
      targetTop: rect.top,
      targetHeight: rect.height,
      availableHeight
    };
  }

  function tourPageRootCanHelpTarget(target) {
    return tourPageRootCenteringPlan(target).useful === true;
  }


  function tourTargetComfortablyVisible(target) {
    if (!target || !tourElementActuallyVisible(target)) return false;
    return tourPageRootCenteringPlan(target).useful !== true;
  }

  async function nativeTourScrollTargetIntoView(target, runId = demoRunId) {
    if (!target || runId !== demoRunId) return false;

    await nextTwoFrames();
    if (runId !== demoRunId) return false;

    if (tourTargetComfortablyVisible(target)) return true;

    const plan = tourPageRootCenteringPlan(target);

    if (!plan.useful || !plan.scroller || plan.maxTop <= 1) {
      return true;
    }

    window.RMLTypedNodeGraphScrollLayers?.clear?.();
    window.RMLUniversalScrollLayers?.clear?.();
    await animateTourPageScroll(
      plan.desiredScrollTop,
      TOUR_SCROLL_TIMING.pageScrollDuration,
      runId
    );
    if (runId !== demoRunId) return false;

    window.RMLTypedNodeGraphScrollLayers?.clear?.();
    window.RMLUniversalScrollLayers?.clear?.();
    const finalPlan = tourPageRootCenteringPlan(target);
    return tourTargetComfortablyVisible(target) || !finalPlan.useful;
  }

  function tourVisualSubjectForStep(step, target) {
    if (!step) return target;

    if (step.demo === "graph-route") {
      return document.querySelector(".rml-graph-viewport") || target;
    }

    if (step.mode === "graph" && step.target === ".inspector") {
      return document.querySelector(".inspector") || target;
    }

    return target;
  }

  function graphDemoViewportPanPoint(viewport, xRatio, yRatio) {
    const rect = viewport?.getBoundingClientRect();
    if (!rect) return null;
    const insetX = Math.min(42, Math.max(18, rect.width * .08));
    const insetY = Math.min(42, Math.max(18, rect.height * .08));
    return {
      x: Math.max(
        rect.left + insetX,
        Math.min(rect.right - insetX, rect.left + rect.width * xRatio)
      ),
      y: Math.max(
        rect.top + insetY,
        Math.min(rect.bottom - insetY, rect.top + rect.height * yRatio)
      )
    };
  }

  function graphDemoVisibleElementPoint(
    element,
    xRatio = .5,
    yRatio = .5,
    preferredInset = 22
  ) {
    const rectangle = element?.getBoundingClientRect?.();
    const viewport = tourEffectViewport();
    if (!rectangle) {
      return {
        x: viewport.left + viewport.width * xRatio,
        y: viewport.top + viewport.height * yRatio
      };
    }

    const visibleLeft = Math.max(rectangle.left, viewport.left);
    const visibleRight = Math.min(rectangle.right, viewport.right);
    const visibleTop = Math.max(rectangle.top, viewport.top);
    const visibleBottom = Math.min(rectangle.bottom, viewport.bottom);
    const visibleWidth = Math.max(0, visibleRight - visibleLeft);
    const visibleHeight = Math.max(0, visibleBottom - visibleTop);

    if (visibleWidth < 2 || visibleHeight < 2) {
      return {
        x: Math.max(
          viewport.left + 18,
          Math.min(
            viewport.right - 18,
            rectangle.left + rectangle.width * xRatio
          )
        ),
        y: Math.max(
          viewport.top + 24,
          Math.min(
            viewport.bottom - 24,
            rectangle.top + rectangle.height * yRatio
          )
        )
      };
    }

    const insetX = Math.min(
      preferredInset,
      Math.max(0, visibleWidth * .24)
    );
    const insetY = Math.min(
      preferredInset,
      Math.max(0, visibleHeight * .24)
    );
    return {
      x:
        visibleLeft + insetX +
        Math.max(0, visibleWidth - insetX * 2) * xRatio,
      y:
        visibleTop + insetY +
        Math.max(0, visibleHeight - insetY * 2) * yRatio
    };
  }

  async function runGraphPanDemo(runId) {
    const viewport =
      document.querySelector(".rml-graph-viewport");
    if (!viewport) return;

    await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;

    const toolbarReady = await prepareGraphPanToolbarForNarration(runId);
    if (!toolbarReady || runId !== demoRunId) {
      throw new Error(
        "[RML Tour · Step 10] The graph toolbar could not be scrolled completely into view before Center Graph and zoom."
      );
    }

    await teacherCenterGraph(runId, {
      label: "Center Graph is useful now → fit the complete live program"
    });
    if (runId !== demoRunId) return;

    const zoomOut = graphToolbarButtonByTitle("Zoom out");
    const zoomIn = graphToolbarButtonByTitle("Zoom in");
    if (zoomOut && zoomIn) {
      const toolbar = zoomOut.closest(".rml-graph-toolbar");
      if (toolbar) {
        await teacherRevealInScroller(zoomOut, toolbar, runId);
        if (runId !== demoRunId) return;
      }
      await teacherClickElement(
        zoomOut,
        "Real − button → zoom out so a larger graph stays readable",
        runId
      );
      if (runId !== demoRunId) return;
      await wait(260);
      if (toolbar) {
        await teacherRevealInScroller(zoomIn, toolbar, runId);
        if (runId !== demoRunId) return;
      }
      await teacherClickElement(
        zoomIn,
        "Real + button → zoom back in around the viewport center",
        runId
      );
      if (runId !== demoRunId) return;
      await wait(320);
    }

    const panFrom =
      graphDemoViewportPanPoint(viewport, .30, .42);
    const panTo =
      graphDemoViewportPanPoint(viewport, .70, .58);

    if (
      panFrom &&
      panTo &&
      Math.hypot(panTo.x - panFrom.x, panTo.y - panFrom.y) > 90
    ) {
      await nativeGraphViewportPan(
        viewport,
        panFrom,
        panTo,
        920,
        runId
      );
      if (runId !== demoRunId) return;

      showKeys(["Ctrl", "0"], panTo);
      showDemoLabel(
        "Ctrl + 0 uses the native graph shortcut to center again",
        panTo
      );
      await wait(360);
      document.dispatchEvent(
        new KeyboardEvent("keydown", {
          bubbles: true,
          cancelable: true,
          key: "0",
          code: "Digit0",
          ctrlKey: true
        })
      );
      await wait(620);
      hideKeys();
    }

    const pageScroller =
      document.scrollingElement ||
      document.documentElement;
    const pageStart = {
      left: pageScroller.scrollLeft,
      top: pageScroller.scrollTop
    };
    const codePanel =
      document.querySelector(".code-panel");
    const codeScroller =
      codePanel?.querySelector("pre") ||
      codePanel;
    const codeStart = codeScroller
      ? {
          left: codeScroller.scrollLeft,
          top: codeScroller.scrollTop
        }
      : null;

    window.RMLTypedNodeGraphScrollLayers?.clear?.();
    window.RMLUniversalScrollLayers?.clear?.();
    pageScroller.scrollLeft = pageStart.left;
    pageScroller.scrollTop = pageStart.top;
    if (codeScroller && codeStart) {
      codeScroller.scrollLeft = codeStart.left;
      codeScroller.scrollTop = codeStart.top;
    }

    const scrollDemo =
      prepareStartNodeScrollDemo();
    if (!scrollDemo?.body) return;

    const immediateNodePoint =
      graphDemoVisibleElementPoint(scrollDemo.body, .58, .52);
    const immediateMouse = elements().mouse;
    immediateMouse?.classList.add("active");
    setTeacherMousePoint(
      immediateNodePoint,
      0,
      [],
      "graph-scroll-start"
    );

    let keepMouseVisible = false;
    const ctrlWheelVisualState = {
      cycles: 0,
      visibleCycles: 0,
      failures: []
    };

    const mountTeacherWheelMouse = async (
      point,
      {
        horizontal = false,
        reason = "graph-pan-wheel-visual"
      } = {}
    ) => {
      const ui = elements();
      if (!(ui.mouse instanceof HTMLElement) || !point) return false;

      const viewport = tourEffectViewport();
      const visiblePoint = {
        x: Math.max(
          viewport.left + 20,
          Math.min(viewport.right - 20, point.x)
        ),
        y: Math.max(
          viewport.top + 28,
          Math.min(viewport.bottom - 28, point.y)
        )
      };

      ui.mouse.removeAttribute("hidden");
      ui.mouse.style.removeProperty("visibility");
      ui.mouse.style.removeProperty("opacity");
      ui.mouse.classList.remove(
        "rml-setup-mouse-hard-hidden",
        "pressed",
        "horizontal-wheel"
      );
      delete ui.mouse.dataset.hardHiddenReason;
      setTeacherMousePoint(visiblePoint, 0, [], reason);
      ui.mouse.classList.add("active", "scrolling");
      if (horizontal) {
        ui.mouse.classList.add("horizontal-wheel");
      }
      void ui.mouse.getBoundingClientRect();
      await nextTwoFrames();

      const rectangle = ui.mouse.getBoundingClientRect();
      const style = getComputedStyle(ui.mouse);
      const center = {
        x: rectangle.left + rectangle.width * .5,
        y: rectangle.top + rectangle.height * .5
      };
      const visible = Boolean(
        ui.mouse.classList.contains("active") &&
        ui.mouse.classList.contains("scrolling") &&
        !ui.mouse.classList.contains("rml-setup-mouse-hard-hidden") &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rectangle.width > 8 &&
        rectangle.height > 12 &&
        center.x >= viewport.left &&
        center.x <= viewport.right &&
        center.y >= viewport.top &&
        center.y <= viewport.bottom
      );
      tourDebugRecord("graph-pan-teacher-wheel-mouse-mounted", {
        reason,
        horizontal,
        visible,
        requestedPoint: point,
        point: visiblePoint,
        mouseRect: tourDebugRect(ui.mouse),
        mouseClasses: ui.mouse.className || ""
      });
      return visible;
    };

    const beginCtrlWheelVisual = async (point, label) => {
      const ui = elements();
      const mouseVisible = await mountTeacherWheelMouse(point, {
        reason: "graph-pan-ctrl-wheel-visual"
      });
      showKeys(["Ctrl"], point);
      showDemoLabel(label, point);
      await waitForAnimationFrames(1);
      const wheelStyle = ui.mouseWheel
        ? getComputedStyle(ui.mouseWheel)
        : null;
      const beforeContent = ui.mouse
        ? getComputedStyle(ui.mouse, "::before").content
        : "";
      const afterContent = ui.mouse
        ? getComputedStyle(ui.mouse, "::after").content
        : "";
      const visible = Boolean(
        mouseVisible &&
        ui.mouse?.classList.contains("active") &&
        ui.mouse?.classList.contains("scrolling") &&
        !ui.mouse.classList.contains("horizontal-wheel") &&
        ui.keys &&
        !ui.keys.hidden &&
        /Ctrl/i.test(ui.keys.textContent || "") &&
        wheelStyle?.animationName?.includes("rml-setup-wheel-scroll") &&
        /↑/.test(beforeContent) &&
        /↓/.test(afterContent)
      );
      ctrlWheelVisualState.cycles += 1;
      if (visible) ctrlWheelVisualState.visibleCycles += 1;
      else {
        ctrlWheelVisualState.failures.push({
          label,
          mouseVisible,
          mouseClasses: ui.mouse?.className || "",
          keyText: ui.keys?.textContent || "",
          wheelAnimation: wheelStyle?.animationName || "",
          beforeContent,
          afterContent
        });
      }
      tourDebugRecord("ctrl-wheel-visual-cycle", {
        label,
        visible,
        mouseVisible,
        wheelAnimation: wheelStyle?.animationName || "",
        arrows: { beforeContent, afterContent }
      });
      return visible;
    };

    const endCtrlWheelVisual = () => {
      releaseTourScrollModifier();
      hideKeys();
      elements().mouse?.classList.remove(
        "scrolling",
        "horizontal-wheel"
      );
    };

    const selectedWheel = async (
      target,
      options,
      repeat,
      interval,
      label,
      point
    ) => {
      hideKeys();
      await mountTeacherWheelMouse(point, {
        reason: "graph-pan-selected-wheel-visual"
      });
      showDemoLabel(label, point);
      await wait(TOUR_SCROLL_TIMING.gestureLeadIn);
      await wheelBurst(
        target,
        options,
        repeat,
        Math.max(interval, TOUR_SCROLL_TIMING.wheelInterval),
        runId
      );
      elements().mouse?.classList.remove("scrolling");
      await wait(TOUR_SCROLL_TIMING.gestureSettle);
    };

    const selectLayer = async (
      target,
      matcher,
      point,
      label,
      maxAttempts = 8,
      deltaY = 150
    ) => {
      await beginCtrlWheelVisual(point, label);
      try {
        await wait(TOUR_SCROLL_TIMING.modifierLeadIn);

        const found =
          await cycleTourScrollLayerUntil(
            target,
            matcher,
            runId,
            maxAttempts,
            deltaY
          );

        if (runId !== demoRunId) return false;
        return found;
      } finally {
        endCtrlWheelVisual();
        if (runId === demoRunId) {
          await wait(TOUR_SCROLL_TIMING.modifierReleasePause);
        }
      }
    };

    const ensureCodePanelFullyVisible = async () => {
      if (!codePanel || runId !== demoRunId) return;

      const rect =
        codePanel.getBoundingClientRect();
      const availableHeight =
        Math.max(1, window.innerHeight - 36);
      const desiredViewportTop =
        rect.height <= availableHeight
          ? Math.max(
              18,
              (window.innerHeight - rect.height) / 2
            )
          : 18;
      const absoluteTop =
        pageScroller.scrollTop + rect.top;
      const desiredPageTop =
        absoluteTop - desiredViewportTop;

      if (
        Math.abs(
          pageScroller.scrollTop - desiredPageTop
        ) > 2
      ) {
        await animateTourPageScroll(
          desiredPageTop,
          TOUR_SCROLL_TIMING.pageScrollDuration,
          runId
        );
      }
    };

    try {
      await wait(140);
      if (runId !== demoRunId) return;

      let nodePoint =
        graphDemoVisibleElementPoint(scrollDemo.body, .58, .52);
      await moveMouse(nodePoint, 520, runId);
      if (runId !== demoRunId) return;

      hideKeys();
      await selectedWheel(
        scrollDemo.body,
        { deltaY: 40 },
        6,
        TOUR_SCROLL_TIMING.wheelInterval,
        "Wheel ↓ → normal vertical scroll INSIDE the real Node",
        nodePoint
      );
      if (runId !== demoRunId) return;

      await mountTeacherWheelMouse(nodePoint, {
        horizontal: true,
        reason: "graph-pan-shift-wheel-visual"
      });
      showKeys(["Shift"], nodePoint);
      showDemoLabel(
        "Shift + Wheel ↓ → horizontal scroll INSIDE the same Node",
        nodePoint
      );
      await wait(TOUR_SCROLL_TIMING.modifierLeadIn);
      await wheelBurst(
        scrollDemo.body,
        {
          deltaY: 48,
          shiftKey: true
        },
        6,
        TOUR_SCROLL_TIMING.wheelInterval,
        runId
      );
      elements().mouse?.classList.remove(
        "scrolling",
        "horizontal-wheel"
      );
      hideKeys();
      await wait(TOUR_SCROLL_TIMING.gestureSettle);
      if (runId !== demoRunId) return;

      scrollDemo.body.scrollTop = 0;
      scrollDemo.body.scrollLeft = 0;
      await wait(TOUR_SCROLL_TIMING.gestureSettle);

      const foundGraphRoot =
        await selectLayer(
          scrollDemo.body,
          /Graph ROOT/i,
          nodePoint,
          "Ctrl + Wheel ↓ → select Graph ROOT (mouse stays exactly here)",
          7,
          150
        );
      if (!foundGraphRoot) {
        console.warn(
          "[RML Tour · Step 11] Graph ROOT was not found in the live scroll-layer chain.",
          scrollLayerState()
        );
      }
      if (runId !== demoRunId) return;

      await selectedWheel(
        scrollDemo.body,
        { deltaY: 32 },
        5,
        TOUR_SCROLL_TIMING.wheelInterval,
        "Ctrl is released → normal Wheel now scrolls the SELECTED Graph ROOT",
        nodePoint
      );
      if (runId !== demoRunId) return;

      const foundHtml =
        await selectLayer(
          scrollDemo.body,
          /<html>|Page ROOT/i,
          nodePoint,
          "Ctrl + Wheel ↓ → select <html> (mouse still does not move)",
          7,
          150
        );
      if (!foundHtml) {
        console.warn(
          "[RML Tour · Step 11] <html> was not found in the live scroll-layer chain.",
          scrollLayerState()
        );
      }
      if (runId !== demoRunId) return;

      hideKeys();
      await mountTeacherWheelMouse(nodePoint, {
        reason: "graph-pan-page-wheel-visual"
      });
      showDemoLabel(
        "Ctrl is released → normal Wheel scrolls the locked <html> page",
        nodePoint
      );
      await wait(120);
      await ensureCodePanelFullyVisible();
      elements().mouse?.classList.remove("scrolling");
      if (runId !== demoRunId) return;

      if (
        codeScroller &&
        graphDemoVisible(codeScroller)
      ) {
        transitionSemanticScene(
          codePanel || codeScroller,
          "Generated Project Files section"
        );
        const codePoint =
          graphDemoVisibleElementPoint(codeScroller, .55, .42, 26);
        await moveMouse(
          codePoint,
          560,
          runId
        );
        if (runId !== demoRunId) return;

        showDemoLabel(
          "NO CLICK → press Ctrl again and recapture the NEW hierarchy here",
          codePoint
        );
        await wait(TOUR_SCROLL_TIMING.modifierLeadIn);

        const foundCode =
          await selectLayer(
            codeScroller,
            /Generated code|Generated project files|Generated Project Files|code/i,
            codePoint,
            "Ctrl + Wheel → LIVE RECAPTURE selects Generated Project Files (no click)",
            5,
            150
          );
        if (!foundCode) {
          console.warn(
            "[RML Tour · Step 11] Generated Project Files code viewport was not found in the live scroll-layer chain.",
            scrollLayerState()
          );
        }
        if (runId !== demoRunId) return;

        await selectedWheel(
          codeScroller,
          { deltaY: 48 },
          6,
          TOUR_SCROLL_TIMING.wheelInterval,
          "Ctrl is released → normal Wheel scrolls the SELECTED code viewport",
          codePoint
        );
        if (runId !== demoRunId) return;

        showDemoLabel(
          "Step 11 complete → Ctrl can be pressed again anywhere to recapture the visible hierarchy",
          codePoint
        );
        await wait(620);
      }

      if (runId !== demoRunId) return;
      const returnPoint = codeScroller && graphDemoVisible(codeScroller)
        ? graphDemoVisibleElementPoint(codeScroller, .55, .42, 26)
        : graphDemoVisibleElementPoint(codePanel || viewport, .55, .42, 26);
      const returnTarget =
        document.elementFromPoint(returnPoint.x, returnPoint.y) ||
        codeScroller ||
        codePanel ||
        document.body;

      await beginCtrlWheelVisual(
        returnPoint,
        "Finally: Ctrl + Wheel selects <html> again → Wheel returns to the graph"
      );
      let foundReturnHtml = false;
      try {
        foundReturnHtml = await cycleTourScrollLayerUntil(
          returnTarget,
          /<html>|Page ROOT/i,
          runId,
          12,
          150
        );
      } finally {
        endCtrlWheelVisual();
      }
      if (runId !== demoRunId) return;

      if (foundReturnHtml) {
        await mountTeacherWheelMouse(returnPoint, {
          reason: "graph-pan-return-page-wheel-visual"
        });
        for (let burst = 0; burst < 16 && runId === demoRunId; burst += 1) {
          const plan = tourPageRootCenteringPlan(viewport);
          if (!plan.useful || Math.abs(plan.delta) <= 1) break;
          dispatchTourWheel(returnTarget, {
            deltaY:
              Math.sign(plan.delta) *
              Math.min(120, Math.abs(plan.delta))
          });
          await wait(TOUR_SCROLL_TIMING.returnScrollInterval);
        }
        elements().mouse?.classList.remove("scrolling");
      } else {
        console.warn(
          "[RML Tour · Step 11] Could not reselect <html> for the visible return; no fallback scrolling is used.",
          scrollLayerState()
        );
      }

      window.RMLTypedNodeGraphScrollLayers?.clear?.();
      window.RMLUniversalScrollLayers?.clear?.();
      scrollDemo.body.scrollTop = 0;
      scrollDemo.body.scrollLeft = 0;
      await teacherEnsureGraphSidebarsVisible(runId);
      if (runId !== demoRunId) return;
      const graphWindowReturned = await ensureGraphViewportWindow(runId);
      if (!graphWindowReturned || runId !== demoRunId) {
        graphDemoError(
          "Step 10 could not visibly return from the page-scroll lesson to the Runtime Graph."
        );
      }
      transitionSemanticScene(viewport, "Typed Runtime Graph section");
      const completionNodeIds = graphTeachingNodeIdsFromState();
      const completionViewportBefore = window.RMLDynamicGraphHost
        ?.getViewportState?.()?.viewport || null;
      showDemoLabel(
        "Return to the same readable graph camera — pan first, zoom only if the two complete nodes cannot fit",
        centerOf(viewport)
      );
      const completionFrameReady = await animateGraphNodesToReadableFrame(
        completionNodeIds,
        runId,
        {
          inset: 22,
          padding: window.innerWidth < 480 ? 18 : 28,
          maxScale: Number(completionViewportBefore?.scale) || 1,
          duration: 620,
          reason: "step-10-visible-return-to-teaching-pair"
        }
      );
      if (runId !== demoRunId) return;
      const completionPair = graphDemoSocketPair(false);
      const completionViewportAfter = window.RMLDynamicGraphHost
        ?.getViewportState?.()?.viewport || null;
      const completionReady = tourDebugAssert(
        "graph-pan-visible-return-leaves-complete-teaching-pair",
        completionFrameReady === true &&
          graphTeachingPairCompletelyVisible(completionPair, 10),
        {
          nodeIds: completionNodeIds,
          beforeViewport: completionViewportBefore,
          afterViewport: completionViewportAfter,
          zoomReduced:
            Number(completionViewportAfter?.scale) <
              Number(completionViewportBefore?.scale) - .0005,
          policy:
            "the end of Step 10 visibly returns to both complete teaching nodes; camera pan is preferred and zoom reduction is permitted only when their measured footprint cannot fit"
        }
      );
      if (!completionReady) {
        graphDemoError(
          "Step 10 did not leave both complete teaching nodes in its visible final graph frame."
        );
      }
      nodePoint = graphDemoVisibleElementPoint(scrollDemo.body, .58, .52);
      await moveMouse(nodePoint, 420, runId);
      hideKeys();
      elements().mouse?.classList.remove(
        "pressed",
        "scrolling",
        "horizontal-wheel"
      );
      showDemoLabel(
        "Back at the graph → the next lesson inherits this exact camera without a hidden jump",
        nodePoint
      );
      keepMouseVisible = true;
      await wait(520);
      const ctrlWheelVisualsComplete = tourDebugAssert(
        "graph-route-ctrl-wheel-shows-key-wheel-and-vertical-arrows",
        ctrlWheelVisualState.cycles >= 3 &&
          ctrlWheelVisualState.visibleCycles === ctrlWheelVisualState.cycles,
        {
          cycles: ctrlWheelVisualState.cycles,
          visibleCycles: ctrlWheelVisualState.visibleCycles,
          failures: ctrlWheelVisualState.failures,
          policy:
            "every Ctrl + Wheel hierarchy-selection cycle shows Ctrl, the animated wheel and the vertical direction arrows together"
        }
      );
      if (!ctrlWheelVisualsComplete) {
        throw new Error(
          "[RML Tour · Step 10] Ctrl + Wheel did not keep the teacher mouse, key, wheel animation and vertical arrows visible together."
        );
      }
    } finally {
      window.RMLTypedNodeGraphScrollLayers?.clear?.();
      window.RMLUniversalScrollLayers?.clear?.();

      if (runId !== demoRunId) {
        pageScroller.scrollLeft = pageStart.left;
        pageScroller.scrollTop = pageStart.top;
      }

      if (codeScroller && codeStart) {
        codeScroller.scrollLeft =
          codeStart.left;
        codeScroller.scrollTop =
          codeStart.top;
      }

      positionShades(
        currentTarget || viewport
      );
      cleanupStartNodeScrollDemo(
        scrollDemo
      );

      if (!keepMouseVisible) {
        hideKeys();
      }
    }
  }

  async function runDemoOnce(step, target, runId) {
    switch (step.demo) {
      case "topbar-identity-workflow":
        return runTopBarIdentityWorkflowDemo(runId);
      case "mode-switch-graph":
        return runModeSwitchGraphDemo(runId);
      case "mode-switch-outline-preview":
        return runModeSwitchOutlinePreviewDemo(runId);
      case "outline-palette":
        return runOutlinePaletteDemo(runId);
      case "outline-root-drag":
        return runOutlineRootDrag(runId);
      case "outline-reorder-scroll":
        return runOutlineScrollDemo(runId);
      case "outline-nested":
        return runOutlineBuild259HorizontalThenVertical(runId);
      case "outline-properties":
        return runOutlinePropertiesDemo(runId);
      case "graph-create-node":
        return runGraphCreateDemo(runId);
      case "graph-wire":
        return runGraphWireDemo(runId);
      case "graph-flip":
        return runGraphPortFlipDemo(runId);
      case "graph-route":
        return runGraphRouteDemoSimple(runId);
      case "graph-pan":
        return runGraphPanDemo(runId);
      case "graph-inspector":
        return runGraphInspectorDemo(runId);
      case "project-workflow":
        return runProjectWorkflowDemo(runId);
      case "export-workflow":
        return runExportWorkflowDemo(runId);
      case "help-workflow":
        return runHelpWorkflowDemo(runId);
      case "point":
        return runPointDemo(target, runId);
      default:
        return undefined;
    }
  }

  const GRAPH_DEMO_NODE_BUDGETS = Object.freeze({
    "graph-create-node": 1,
    "graph-wire": 0,
    "graph-flip": 0,
    "graph-pan": 0,
    "graph-route": 1,
    "graph-inspector": 0
  });

  function graphDemoNodeCount() {
    const stateNodes = window.RMLDynamicGraphHost?.getState?.()?.nodes;
    return Array.isArray(stateNodes)
      ? stateNodes.length
      : document.querySelectorAll(".rml-graph-node").length;
  }

  function verifyGraphDemoNodeBudget(step, beforeCount) {
    if (!Object.hasOwn(GRAPH_DEMO_NODE_BUDGETS, step?.demo)) return true;
    const afterCount = graphDemoNodeCount();
    const added = afterCount - beforeCount;
    const maximumAdded = GRAPH_DEMO_NODE_BUDGETS[step.demo];
    const passed = added >= 0 && added <= maximumAdded;
    const assertionName = `graph-node-budget-${step.demo}`;
    const verified = tourDebugAssert(assertionName, passed, {
      beforeCount,
      afterCount,
      added,
      maximumAdded,
      policy:
        step.demo === "graph-route"
          ? "One additional branch target is allowed because the branch demonstration requires it."
          : step.demo === "graph-create-node"
            ? "Reuse an existing NOT or add only the one NOT required by later lessons."
            : "Reuse the existing teaching graph; no additional node is allowed."
    });
    if (!verified) {
      graphDemoError(
        `${step.demo} exceeded its node budget (${added} added, maximum ${maximumAdded}).`,
        { beforeCount, afterCount, added, maximumAdded }
      );
    }
    return true;
  }

  function previousDemonstrationIndex(fromIndex = stepIndex) {
    for (
      let index = Math.min(steps.length, fromIndex) - 1;
      index >= 0;
      index -= 1
    ) {
      if (steps[index]?.demo) return index;
    }
    return -1;
  }

  function setStepPhase(phase) {
    stepPhase = phase;
    const ui = elements();
    const step = steps[stepIndex];
    if (!ui.card || !step) return;

    ui.card.dataset.setupPhase = phase;
    ui.root?.classList.toggle(
      "rml-setup-narration-clickable",
      phase === "narrating"
    );
    if (ui.text) {
      ui.text.title = phase === "narrating"
        ? "Left-click to reveal the full text or continue"
        : "";
    }

    const locked =
      phase === "narrating" ||
      phase === "preparing" ||
      phase === "demonstrating";
    const tourComplete =
      stepIndex === steps.length - 1 &&
      !step.demo;
    const previousDemoIndex =
      previousDemonstrationIndex(stepIndex);
    const repeatVisiblePhase =
      (step.demo && phase === "ready") ||
      (!step.demo && phase === "explain");
    ui.next.hidden =
      phase === "narrating" ||
      phase === "preparing";
    ui.next.disabled = locked;
    if (ui.skip) {
      ui.skip.hidden = tourComplete;
      ui.skip.disabled = restoreInFlight;
    }
    if (ui.repeatPrevious) {
      ui.repeatPrevious.hidden = !(
        previousDemoIndex >= 0 &&
        repeatVisiblePhase
      );
      ui.repeatPrevious.disabled =
        locked ||
        demoInFlight ||
        repeatPreviousInFlight;
      ui.repeatPrevious.dataset.repeatStepIndex =
        previousDemoIndex >= 0
          ? String(previousDemoIndex)
          : "";
    }
    if (ui.skipDemo) {
      ui.skipDemo.hidden = !(step.demo && phase === "ready");
      ui.skipDemo.disabled = phase !== "ready" || demoInFlight;
    }
    const liveSkipPhase =
      phase === "preparing" || phase === "demonstrating";
    if (!liveSkipPhase) {
      clearLiveControlsActiveObstacles();
    }
    if (ui.liveControls) {
      ui.liveControls.hidden = !liveSkipPhase;
      if (liveSkipPhase && !ui.liveControls.dataset.livePlacement) {
        ui.liveControls.dataset.livePlacement = "bottom-right";
      }
    }
    if (ui.liveSkipDemo) {
      ui.liveSkipDemo.disabled = !liveSkipPhase;
    }
    if (ui.liveSkipTour) {
      ui.liveSkipTour.disabled = !liveSkipPhase;
    }
    if (phase === "demonstrating") {
      const currentMouse =
        teacherMouseVisualCoordinates() ||
        teacherMouseCoordinates() ||
        {
          x: window.innerWidth * .5,
          y: window.innerHeight * .5
        };
      positionLiveControlsAwayFromMouseRoute(
        [currentMouse],
        "demonstration-controls-opened"
      );
    }

    if (phase === "preparing") {
      tourDebugAssert(
        "tour-live-preparation-skip-available",
        Boolean(
          ui.liveControls &&
          !ui.liveControls.hidden &&
          ui.liveSkipDemo &&
          !ui.liveSkipDemo.disabled &&
          ui.liveSkipTour &&
          !ui.liveSkipTour.disabled
        ),
        {
          preparedStepIndex: stepIndex,
          skipDemonstrationEnabled: Boolean(
            ui.liveSkipDemo && !ui.liveSkipDemo.disabled
          ),
          skipTourEnabled: Boolean(
            ui.liveSkipTour && !ui.liveSkipTour.disabled
          ),
          policy:
            "the live Skip controls remain usable while the next lesson is being prepared and while its demonstration runs"
        }
      );
    }

    if (phase === "demonstrating") {
      ui.kicker.textContent = "Live demonstration";
      ui.next.textContent = "Demonstrating…";
    } else if (phase === "preparing") {
      ui.kicker.textContent = "Preparing next lesson";
      ui.next.textContent = "Preparing…";
    } else if (phase === "narrating") {
      ui.kicker.textContent = "Explanation · Left-click to reveal / continue";
      ui.next.textContent = "Demonstrate";
    } else if (phase === "ready") {
      ui.kicker.textContent = "Ready to demonstrate";
      ui.next.textContent = "Demonstrate";
      if (step.demo) {
        tourDebugAssert(
          `tour-step-${stepIndex}-single-demonstration-skip-available`,
          Boolean(
            ui.skipDemo &&
            !ui.skipDemo.hidden &&
            !ui.skipDemo.disabled
          ),
          {
            label: ui.skipDemo?.textContent?.trim() || "",
            besideDemonstrate:
              ui.skipDemo?.parentElement === ui.next.parentElement
          }
        );
        const repeatExpected = previousDemoIndex >= 0;
        tourDebugAssert(
          `tour-step-${stepIndex}-repeat-previous-button-state`,
          Boolean(ui.repeatPrevious) &&
            ui.repeatPrevious.hidden === !repeatExpected &&
            (
              !repeatExpected ||
              ui.repeatPrevious.disabled ===
                repeatPreviousInFlight
            ),
          {
            previousDemoIndex,
            repeatExpected,
            repeatVisible:
              Boolean(ui.repeatPrevious && !ui.repeatPrevious.hidden),
            repeatEnabled:
              Boolean(ui.repeatPrevious && !ui.repeatPrevious.disabled),
            policy:
              "the first Demonstrate overlay has nothing to repeat; every later lesson may repeat only the immediately preceding demonstration"
          }
        );
      }
    } else {
      ui.kicker.textContent = tourComplete
        ? "Tour complete"
        : "Explanation";
      ui.next.textContent =
        step.demo
          ? "Demonstrate"
          : (
              stepIndex === steps.length - 1
                ? "Finish"
                : "Next"
      );
      if (tourComplete) {
        tourDebugAssert(
          "tour-complete-final-actions",
          Boolean(
            ui.skip?.hidden &&
            ui.repeatPrevious &&
            !ui.repeatPrevious.hidden &&
            ui.repeatPrevious.disabled ===
              repeatPreviousInFlight &&
            ui.next &&
            !ui.next.hidden &&
            !ui.next.disabled &&
            ui.next.textContent === "Finish"
          ),
          {
            skipTourHidden: Boolean(ui.skip?.hidden),
            repeatPreviousVisible: Boolean(
              ui.repeatPrevious && !ui.repeatPrevious.hidden
            ),
            repeatPreviousIndex: previousDemoIndex,
            finishVisible: Boolean(ui.next && !ui.next.hidden),
            finishLabel: ui.next?.textContent || ""
          }
        );
      }
    }
  }

  async function transitionToStep(index, options = {}) {
    const ui = elements();
    const root = ui.root;
    const step = steps[index];
    if (!root || !step) return false;
    const controlledReentry =
      options.controlledReentry === true;
    if (
      !controlledReentry &&
      (
        enteredStepIndexes.has(index) ||
        index < stepIndex
      )
    ) {
      blockedRepeatCount += 1;
      tourDebugRecord("tour-step-reentry-blocked", {
        requestedStepIndex: index,
        currentStepIndex: stepIndex,
        alreadyEntered: enteredStepIndexes.has(index),
        backwardNavigation: index < stepIndex,
        policy:
          "strict forward-only single pass, except the explicit Repeat previous step transaction"
      });
      return false;
    }

    const previousDemo = steps[stepIndex]?.demo || "";
    const restoreTransaction =
      options.restoreTransaction &&
      typeof options.restoreTransaction === "object"
        ? options.restoreTransaction
        : null;
    const expectedGraphHandoff = Boolean(
      options.restoreEntry !== true &&
      !restoreTransaction &&
      graphTeachingSceneHandoff &&
      graphTeachingSceneHandoff.fromDemo === previousDemo &&
      graphTeachingSceneHandoff.toDemo === step.demo
    )
      ? graphTeachingSceneHandoff
      : null;

    cancelDemo();
    demoInFlight = false;
    mobilePackPreparedForNarration = false;
    if (step.demo !== "graph-create-node") {
      graphCreateNodePreparedDropPlan = null;
    }
    const runId = demoRunId;

    if (restoreTransaction) {
      restoreTourState(restoreTransaction.state);
      await restoreTourEnvironmentState(
        restoreTransaction.environment
      );
      await nextTwoFrames();
      const restoredFingerprint = tourStateFingerprint(
        captureTourState()
      );
      const expectedFingerprint = tourStateFingerprint(
        restoreTransaction.state
      );
      const topMenuState = responsiveTopActionsState();
      const graphModeMatches =
        document.body.classList.contains("rml-node-graph-mode") ===
          (restoreTransaction.environment?.graphMode === true);
      const graphLeftPanelMatches =
        document.body.classList.contains("rml-graph-left-collapsed") ===
          (restoreTransaction.environment?.graphLeftCollapsed === true);
      const graphRightPanelMatches =
        document.body.classList.contains("rml-graph-right-collapsed") ===
          (restoreTransaction.environment?.graphRightCollapsed === true);
      const topMenuMatches =
        topMenuState.open ===
          (restoreTransaction.environment?.topMenuOpen === true);
      const pagePositionMatches = Boolean(
        Math.abs(
          window.scrollX -
          (Number(restoreTransaction.environment?.page?.x) || 0)
        ) <= 1 &&
        Math.abs(
          window.scrollY -
          (Number(restoreTransaction.environment?.page?.y) || 0)
        ) <= 1
      );
      const transactionRestored = tourDebugAssert(
        `tour-step-${index}-controlled-repeat-transaction-state-restored`,
        Boolean(
          restoreTransaction.state &&
          restoreTransaction.environment &&
          restoredFingerprint === expectedFingerprint &&
          graphModeMatches &&
          graphLeftPanelMatches &&
          graphRightPanelMatches &&
          topMenuMatches &&
          pagePositionMatches &&
          tourStorageFingerprint() ===
            tourStorageFingerprint(
              restoreTransaction.environment.storage || []
            ) &&
          tourOverlayStateMatches(
            restoreTransaction.environment.overlay
          )
        ),
        {
          restoredStepIndex: index,
          transactionRole:
            restoreTransaction.role || "repeat-transaction",
          builderStateMatches:
            restoredFingerprint === expectedFingerprint,
          overlayStateMatches: tourOverlayStateMatches(
            restoreTransaction.environment?.overlay
          ),
          graphModeMatches,
          graphLeftPanelMatches,
          graphRightPanelMatches,
          topMenuMatches,
          pagePositionMatches,
          storageStateMatches:
            tourStorageFingerprint() ===
            tourStorageFingerprint(
              restoreTransaction.environment?.storage || []
            ),
          expectedGraphRightPanelOpen:
            restoreTransaction.environment?.graphRightCollapsed === false,
          actualGraphRightPanelOpen:
            !document.body.classList.contains(
              "rml-graph-right-collapsed"
            )
        }
      );
      if (!transactionRestored) {
        throw new Error(
          `[RML Tour · Repeat] The ${restoreTransaction.role || "requested"} state for Step ${index} could not be restored exactly.`
        );
      }
    } else if (options.restoreEntry === true) {
      restoreTourState(stepSnapshots.get(index));
      await restoreTourEnvironmentState(
        stepEnvironmentSnapshots.get(index)
      );
      await nextTwoFrames();
    } else if (options.captureEntry !== false) {
      stepSnapshots.set(index, captureTourState());
      stepEnvironmentSnapshots.set(
        index,
        captureTourEnvironmentState()
      );
    }
    if (runId !== demoRunId) return false;

    const target = findTarget(step);
    const subject = tourVisualSubjectForStep(step, target);
    const explicitModeDemo =
      step.demo === "mode-switch-graph" ||
      step.demo === "mode-switch-outline-preview";
    const canPrepareGraph =
      step.mode === "graph" &&
      !explicitModeDemo;
    const plan = !canPrepareGraph && subject
      ? tourPageRootCenteringPlan(subject)
      : { useful: false, reason: "graph-or-no-visible-target" };
    const canActuallyScroll = Boolean(
      plan.useful &&
      plan.scroller &&
      plan.maxTop > 1 &&
      Math.abs(plan.delta) > 2
    );
    const graphPreparationNeeded =
      canPrepareGraph &&
      graphStepNeedsPreparation(step);
    const outlinePalettePreparationNeeded =
      step.demo === "outline-palette";
    const outlineReorderPreparationNeeded =
      step.demo === "outline-reorder-scroll";
    const outlineNestedPreparationNeeded =
      step.demo === "outline-nested";
    const topbarPreparationNeeded =
      step.demo === "topbar-identity-workflow";
    const compactPackPreparationNeeded =
      step.demo === "mode-switch-graph" &&
      responsiveTopActionsState(
        document.querySelector(".rml-pack-button") ||
        document.querySelector("#pack-into-node")
      ).responsive;
    const preparationNeeded = Boolean(
      compactPackPreparationNeeded ||
      (
        !restoreTransaction &&
        (
          canActuallyScroll ||
          graphPreparationNeeded ||
          outlinePalettePreparationNeeded ||
          outlineReorderPreparationNeeded ||
          outlineNestedPreparationNeeded ||
          topbarPreparationNeeded
        )
      )
    );
    let preparationRanWithoutAssistantNotice = false;
    let naturalPreparationBefore = null;
    let naturalPreparationAfter = null;
    let preparationError = null;

    if (preparationNeeded) {
      root.classList.remove("rml-setup-preparing-next");
      root.classList.add("rml-setup-demonstration-only");
      ui.card?.classList.add("rml-setup-card-hidden-during-scene");
      document.documentElement.classList.add(
        "rml-setup-demonstration-active"
      );
      clearNarrationOutlines();
      clearDemoVisuals();
      clearTarget();
      stepIndex = index;
      setStepPhase("preparing");
      positionShades(null, { force: true });
      preparationRanWithoutAssistantNotice = Boolean(
        stepPhase === "preparing" &&
        root.classList.contains("rml-setup-demonstration-only") &&
        !tourElementActuallyVisible(ui.card) &&
        !tourElementActuallyVisible(ui.mouse) &&
        [...root.querySelectorAll("[data-setup-shade]")]
          .every(shade => !tourElementActuallyVisible(shade))
      );
      naturalPreparationBefore = canPrepareGraph
        ? graphTeachingSceneSnapshot(`${step.demo}-natural-preparation-before`)
        : {
            pageTop:
              Number((document.scrollingElement || document.documentElement)
                ?.scrollTop || 0),
            subjectRect: tourDebugRect(subject)
          };
      tourDebugRecord("lesson-natural-preparation-start", {
        preparedStepIndex: index,
        assistantChromeHidden: preparationRanWithoutAssistantNotice,
        explicitPreparationNoticeVisible: false,
        graphPreparationNeeded,
        topbarPreparationNeeded,
        compactPackPreparationNeeded,
        outlinePalettePreparationNeeded,
        outlineReorderPreparationNeeded,
        outlineNestedPreparationNeeded,
        pageScrollPreparationNeeded: canActuallyScroll
      });

      try {
        if (topbarPreparationNeeded) {
          await prepareTopbarOpeningFrame(runId);
          if (runId !== demoRunId) return false;
        } else if (compactPackPreparationNeeded) {
          await prepareCompactPackBeforeNarration(runId);
        } else if (graphPreparationNeeded) {
          await prepareGraphStepBeforeNarration(step, runId);
        } else if (outlinePalettePreparationNeeded) {
          await prepareOutlinePaletteBeforeNarration(step, runId);
        } else if (outlineReorderPreparationNeeded) {
          await prepareOutlineReorderBeforeNarration(step, runId);
        } else if (outlineNestedPreparationNeeded) {
          await prepareOutlineNestedBeforeNarration(step, runId);
        } else {
          await animateTourPageScroll(
            plan.desiredScrollTop,
            TOUR_SCROLL_TIMING.pageScrollDuration,
            runId
          );
        }
      } catch (error) {
        const constraintCertificate = handleTourLayoutError(error, {
          stage: "preparation",
          preparedStepIndex: index,
          preparedDemo: step.demo || ""
        });
        preparationError = {
          name: error?.name || "Error",
          message: error?.message || String(error || ""),
          constraintCertificate: constraintCertificate || null
        };
        if (constraintCertificate) {
          tourDebugRecord("layout-constraint-noise-filtered", {
            stage: "preparation",
            preparedStepIndex: index,
            preparedDemo: step.demo || "",
            rawError: preparationError.message,
            constraintCertificate
          });
          console.info(
            "[RML Tour] An unavoidable, mathematically certified layout constraint was recorded as viewport noise.",
            constraintCertificate
          );
        } else {
          tourDebugRecord("lesson-preparation-contained-error", {
            preparedStepIndex: index,
            preparedDemo: step.demo || "",
            errorName: preparationError.name,
            message: preparationError.message,
            policy:
              "A failed hidden preparation may be logged, but it must always release the preparation screen and show the lesson."
          });
          console.error(
            `[RML Tour · Step ${index}] Hidden lesson preparation failed and was contained so the tour cannot remain locked.`,
            error
          );
        }
      }
      if (runId !== demoRunId) return false;
      await wait(TOUR_SCROLL_TIMING.preparationSettle);
      if (runId !== demoRunId) return false;
      naturalPreparationAfter = canPrepareGraph
        ? graphTeachingSceneSnapshot(`${step.demo}-natural-preparation-after`)
        : {
            pageTop:
              Number((document.scrollingElement || document.documentElement)
                ?.scrollTop || 0),
            subjectRect: tourDebugRect(subject)
          };
      tourDebugRecord("lesson-natural-preparation-end", {
        preparedStepIndex: index,
        assistantChromeHidden: preparationRanWithoutAssistantNotice,
        explicitPreparationNoticeVisible: false,
        before: naturalPreparationBefore,
        after: naturalPreparationAfter,
        preparationError
      });
    }

    if (step.demo) {
      tourDebugAssert(
        `tour-step-${index}-natural-preparation-without-explicit-notice`,
        !preparationNeeded || preparationRanWithoutAssistantNotice,
        {
          preparedStepIndex: index,
          preparationNeeded,
          preparationRanWithoutAssistantNotice,
          explicitPreparationNoticeVisible: false,
          before: naturalPreparationBefore,
          after: naturalPreparationAfter,
          phaseBeforeNarration: stepPhase
        }
      );
    }

    root.classList.remove(
      "rml-setup-preparing-next",
      "rml-setup-demonstration-only"
    );
    ui.card?.classList.remove("rml-setup-card-hidden-during-scene");
    document.documentElement.classList.remove(
      "rml-setup-demonstration-active"
    );
    showStep(index, {
      ...options,
      statePrepared: true
    });

    if (expectedGraphHandoff) {
      const opening = graphTeachingSceneSnapshot(
        `${expectedGraphHandoff.fromDemo}-to-${expectedGraphHandoff.toDemo}-opening`
      );
      const comparison = compareGraphTeachingScenes(
        expectedGraphHandoff.terminal,
        opening
      );
      tourDebugRecord("graph-scene-handoff-opening", {
        fromDemo: expectedGraphHandoff.fromDemo,
        toDemo: expectedGraphHandoff.toDemo,
        graphPreparationNeeded,
        scene: opening,
        comparison
      });
      const exactHandoff = tourDebugAssert(
        `graph-scene-handoff-${expectedGraphHandoff.fromDemo}-to-${expectedGraphHandoff.toDemo}-exact`,
        graphPreparationNeeded === false && comparison.exact === true,
        {
          fromDemo: expectedGraphHandoff.fromDemo,
          toDemo: expectedGraphHandoff.toDemo,
          graphPreparationNeeded,
          terminal: expectedGraphHandoff.terminal,
          opening,
          mismatches: comparison.mismatches,
          policy:
            "no panel, page, graph viewport, zoom, node, socket or selection mutation between consecutive lessons in the same scene"
        }
      );
      if (expectedGraphHandoff.toDemo === "graph-wire") {
        tourDebugAssert(
          "graph-wire-opened-without-transition-preparation",
          exactHandoff && graphPreparationNeeded === false,
          {
            graphPreparationNeeded,
            mismatches: comparison.mismatches
          }
        );
      }
      if (!exactHandoff) graphTeachingSceneHandoff = null;
    }
    return true;
  }

  function refreshStepTarget(step, fallback = null) {
    const target = findTarget(step) || fallback;
    clearTarget();
    if (tourElementActuallyVisible(target)) {
      target.classList.add("rml-setup-target");
      currentTarget = target;
    }
    positionShades(currentTarget);
    positionCard(currentTarget);
    return target;
  }

  function assertActionOnlyDemonstration(stage) {
    const ui = elements();
    const forbidden = [...document.querySelectorAll(
      ".rml-setup-control-highlight, .rml-setup-narration-outline, .rml-setup-target, " +
      ".rml-setup-real-port-glow, .rml-setup-connection-node, " +
      ".rml-setup-connection-wire, .rml-setup-connected-port, .rml-setup-demo-pulse"
    )].filter(tourElementActuallyVisible);
    const passed = tourDebugAssert(
      "tour-demonstration-action-only-no-explanation-glow",
      forbidden.length === 0 &&
        Boolean(ui.demoLabel?.hidden),
      {
        stage,
        visibleForbiddenClasses: forbidden.map(element =>
          element.className || element.id || element.tagName
        ),
        floatingExplanationHidden: Boolean(ui.demoLabel?.hidden),
        mouseSizePolicy: "restored-original"
      }
    );
    if (!passed) {
      throw new Error(
        `[RML Tour · Step ${stepIndex}] Explanatory glow or tooltip remained visible during the action-only demonstration (${stage}).`
      );
    }
    return true;
  }

  async function advancePastFailedStep(
    failedStepIndex,
    runId,
    failureKind = "demonstration",
    effectiveSuccess = false
  ) {
    if (
      runId !== demoRunId ||
      stepIndex !== failedStepIndex
    ) {
      return false;
    }

    const ui = elements();
    releaseSemanticScene();
    clearNarrationOutlines();
    clearDemoVisuals();
    clearTarget();
    ui.root?.classList.add("rml-setup-demonstration-only");
    ui.card?.classList.add("rml-setup-card-hidden-during-scene");
    document.documentElement.classList.remove(
      "rml-setup-demonstration-active"
    );
    demoInFlight = false;

    const entryCount = tourDebugState.events.filter(event =>
      event.type === "tour-step-entered" &&
      event.enteredStepIndex === failedStepIndex
    ).length;
    const demonstrationAttempts = tourDebugState.events.filter(event =>
      event.type === "tour-demonstration-attempt-start" &&
      event.attemptedStepIndex === failedStepIndex
    ).length;
    tourDebugAssert(
      `tour-step-${failedStepIndex}-failure-advanced-without-reopen`,
      entryCount === 1 && demonstrationAttempts <= 1,
      {
        failedStepIndex,
        failureKind,
        entryCount,
        demonstrationAttempts,
        snapshotRestored: false,
        assistantCardRedisplayed: false,
        policy:
          "preserve current product state and move forward exactly once"
      }
    );

    if (failedStepIndex >= steps.length - 1) {
      await restoreAndClose(true);
      return effectiveSuccess;
    }

    await transitionToStep(failedStepIndex + 1, {
      captureEntry: true,
      fromFailure: true
    });
    return effectiveSuccess;
  }

  function revealReadyStepWithoutNarration(index) {
    const ui = elements();
    const step = steps[index];
    if (
      !ui.root ||
      !step?.demo ||
      stepIndex !== index
    ) {
      return false;
    }

    clearNarrationOutlines();
    clearTarget();
    ui.root.classList.add("rml-setup-narration-active");
    ui.text.innerHTML = step.text || "";
    ui.hint.textContent = step.hint || "";
    ui.hint.hidden = !step.hint;
    setStepPhase("ready");
    positionShades(null, { force: true });
    fitNarrationCardToContent({
      reset: true,
      followText: false
    });
    tourDebugRecord("controlled-repeat-returned-to-ready-dialog", {
      returnedStepIndex: index,
      returnedStepTitle: step.title || "",
      narrationRepeated: false
    });
    return true;
  }

  function restoreControlledRepeatDialogPresentation(index, phase) {
    const ui = elements();
    const step = steps[index];
    if (!ui.root || !ui.card || !step || stepIndex !== index) {
      return false;
    }

    ui.root.hidden = false;
    ui.root.classList.remove(
      "rml-setup-preparing-next",
      "rml-setup-demonstration-only"
    );
    ui.root.classList.add("rml-setup-narration-active");
    ui.card.classList.remove("rml-setup-card-hidden-during-scene");
    document.documentElement.classList.remove(
      "rml-setup-demonstration-active"
    );
    ui.title.textContent = step.title || "";
    ui.progress.style.width = ((index + 1) / steps.length) * 100 + "%";
    ui.text.innerHTML = step.text || "";
    ui.hint.textContent = step.hint || "";
    ui.hint.hidden = !step.hint;
    const requestedPhase =
      phase === "ready" || phase === "explain"
        ? phase
        : step.demo
          ? "ready"
          : "explain";
    setStepPhase(requestedPhase);
    positionShades(null, { force: true });
    fitNarrationCardToContent({ reset: true, followText: false });
    tourDebugRecord("controlled-repeat-origin-dialog-presentation-restored", {
      returnedStepIndex: index,
      returnedStepTitle: step.title || "",
      requestedPhase: phase,
      restoredPhase: stepPhase,
      repeatLockReleased: repeatPreviousInFlight === false
    });
    return stepPhase === requestedPhase;
  }

  async function returnFromControlledRepeat(
    index,
    returnTransaction = null
  ) {
    const step = steps[index];
    if (!step || !elements().root) return false;

    cancelDemo();
    demoInFlight = false;
    if (returnTransaction?.state) {
      restoreTourState(returnTransaction.state);
    }
    if (returnTransaction?.environment) {
      try {
        await restoreTourEnvironmentState(
          returnTransaction.environment
        );
      } catch (error) {
        tourDebugRecord(
          "controlled-repeat-origin-environment-best-effort",
          {
            returnedStepIndex: index,
            errorName: error?.name || "Error",
            message: error?.message || String(error || "")
          }
        );
      }
    }
    await nextTwoFrames();

    const returned = showStep(index, {
      captureEntry: false,
      controlledReentry: true,
      deferNarration: true,
      repeatReturn: true,
      statePrepared: true
    });
    if (!returned) return false;
    return restoreControlledRepeatDialogPresentation(
      index,
      returnTransaction?.phase
    );
  }

  async function runDemo(step, target, options = {}) {
    if (!step?.demo || demoInFlight) return false;
    const attemptedStepIndex = stepIndex;
    const controlledRepeat =
      options.controlledRepeat === true;
    const repeatReturnStepIndex = Number.isInteger(
      options.repeatReturnStepIndex
    )
      ? options.repeatReturnStepIndex
      : -1;
    const repeatReturnTransaction =
      options.repeatReturnTransaction &&
      typeof options.repeatReturnTransaction === "object"
        ? options.repeatReturnTransaction
        : null;
    if (
      controlledRepeat &&
      (
        repeatReturnStepIndex <= attemptedStepIndex ||
        repeatReturnStepIndex >= steps.length
      )
    ) {
      return false;
    }
    if (
      attemptedDemonstrationIndexes.has(attemptedStepIndex) &&
      !controlledRepeat
    ) {
      blockedRepeatCount += 1;
      tourDebugRecord("tour-demonstration-repeat-blocked", {
        attemptedStepIndex,
        attemptedDemo: step.demo,
        policy: "one demonstration attempt per lesson and tour session"
      });
      return false;
    }
    attemptedDemonstrationIndexes.add(attemptedStepIndex);
    const priorAttemptCount = tourDebugState.events.filter(event =>
      event.type === "tour-demonstration-attempt-start" &&
      event.attemptedStepIndex === attemptedStepIndex
    ).length;
    tourDebugRecord("tour-demonstration-attempt-start", {
      attemptedStepIndex,
      attemptedDemo: step.demo,
      attempts: priorAttemptCount + 1,
      controlledRepeat,
      repeatReturnStepIndex:
        controlledRepeat
          ? repeatReturnStepIndex
          : null
    });

    cancelDemo();
    const runId = demoRunId;
    demoInFlight = true;
    teacherMouseSafetyState = {
      stepIndex: attemptedStepIndex,
      samples: 0,
      relocations: 0,
      violations: 0,
      minimumClearance: Infinity
    };
    setStepPhase("demonstrating");
    const root = document.getElementById("rml-setup-assistant");
    root?.classList.add("rml-setup-demonstration-only");
    document.documentElement.classList.add(
      "rml-setup-demonstration-active"
    );
    elements().card?.classList.add("rml-setup-card-hidden-during-scene");
    clearTarget();

    const demoUi = elements();
    const inputLockReady = tourDebugAssert(
      "tour-trusted-input-lock-active",
      document.documentElement.classList.contains(
        "rml-setup-tour-active"
      ) &&
        document.documentElement.classList.contains(
          "rml-setup-demonstration-active"
        ) &&
        Boolean(demoUi.interactionShield) &&
        Boolean(demoUi.liveControls && !demoUi.liveControls.hidden) &&
        Boolean(demoUi.liveSkipDemo && !demoUi.liveSkipDemo.disabled) &&
        Boolean(demoUi.liveSkipTour && !demoUi.liveSkipTour.disabled) &&
        demoUi.root?.dataset.inputLockBoundary === "window-capture" &&
        Number(window.RMLScrollManager?.version || 0) >= 7,
      {
        shieldPresent: Boolean(demoUi.interactionShield),
        liveControlsVisible: Boolean(
          demoUi.liveControls && !demoUi.liveControls.hidden
        ),
        skipDemoEnabled: Boolean(
          demoUi.liveSkipDemo && !demoUi.liveSkipDemo.disabled
        ),
        skipTourEnabled: Boolean(
          demoUi.liveSkipTour && !demoUi.liveSkipTour.disabled
        ),
        trustedCaptureLockInstalled:
          demoUi.root?.dataset.bound === "true",
        trustedCaptureBoundary:
          demoUi.root?.dataset.inputLockBoundary || "missing",
        trustedWheelGateVersion:
          Number(window.RMLScrollManager?.version || 0)
      }
    );
    tourDebugAssert(
      "tour-live-demonstration-skip-available",
      Boolean(
        demoUi.liveControls &&
        !demoUi.liveControls.hidden &&
        demoUi.liveSkipDemo &&
        !demoUi.liveSkipDemo.disabled &&
        demoUi.liveSkipTour &&
        !demoUi.liveSkipTour.disabled
      ),
      {
        skipDemonstrationLabel:
          demoUi.liveSkipDemo?.textContent?.trim() || "",
        skipTourLabel:
          demoUi.liveSkipTour?.textContent?.trim() || ""
      }
    );
    try {
      if (step.demo === "graph-route") {
        graphStep11RunStartedAt = performance.now();
        graphStep11MarkStage("demonstration-shared-preflight", {
          inputLockReady,
          target: tourDebugRect(target),
          graphViewport: tourDebugRect(
            document.querySelector(".rml-graph-viewport")
          )
        });
      }
      if (!inputLockReady) {
        throw new Error(
          `[RML Tour · Step ${stepIndex}] The trusted user-input lock or its live skip controls were not ready before the demonstration.`
        );
      }
      clearDemoVisuals();
      setLiveControlsActiveObstacles(
        [target],
        "demonstration-initial-target"
      );
      assertActionOnlyDemonstration("before-action");
      tourDebugRecord("tour-live-perception-before-demonstration", {
        demo: step.demo,
        controlledRepeat,
        availableCapabilities: tourInteractionCapabilitySummary().map(
          capability => capability.id
        ),
        scene: tourCaptureLivePerception({
          requestedTarget: target,
          builderCanvas: document.querySelector("#builder-canvas"),
          graphViewport: document.querySelector(".rml-graph-viewport")
        })
      });
      const mouseRect = demoUi.mouse?.getBoundingClientRect?.();
      const expectedMouseSize = window.innerWidth <= 780
        ? { width: 29, height: 40 }
        : { width: 34, height: 46 };
      const originalMouseSizeRestored = tourDebugAssert(
        "teacher-mouse-original-size-restored",
        Boolean(
          mouseRect &&
          Math.abs(mouseRect.width - expectedMouseSize.width) <= .5 &&
          Math.abs(mouseRect.height - expectedMouseSize.height) <= .5
        ),
        {
          expected: expectedMouseSize,
          actual: mouseRect
            ? { width: mouseRect.width, height: mouseRect.height }
            : null
        }
      );
      if (!originalMouseSizeRestored) {
        throw new Error(
          `[RML Tour · Step ${stepIndex}] The original teacher-mouse size was not restored.`
        );
      }
      if (step.demo === "graph-route") {
        graphStep11MarkStage("teacher-mouse-preflight-complete", {
          expectedMouseSize,
          actualMouseSize: mouseRect
            ? { width: mouseRect.width, height: mouseRect.height }
            : null
        });
      }
      target =
        await teacherPrepareStep(
          step,
          target,
          runId
        );

      if (runId !== demoRunId) return false;
      if (step.demo === "graph-route") {
        graphStep11MarkStage("lesson-target-prepared", {
          target: tourDebugRect(target),
          visibleGraph: visibleGraphClientRect(0)
        });
      }

      target = await tourPerceiveAndRepairStepTarget(
        step,
        target,
        runId,
        controlledRepeat
      );
      if (runId !== demoRunId) return false;
      if (step.demo === "graph-route") {
        graphStep11MarkStage("live-target-perceived", {
          target: tourDebugRect(target),
          visibleGraph: visibleGraphClientRect(0)
        });
      }

      const graphNodesBefore = graphDemoNodeCount();
      await runDemoOnce(step, target, runId);
      if (runId !== demoRunId) return false;
      if (step.demo === "graph-route") {
        graphStep11MarkStage("route-action-returned", {
          graphNodesBefore,
          graphNodesAfter: graphDemoNodeCount()
        });
      }
      await finalizeGraphSceneForNextLesson(step, runId);
      if (runId !== demoRunId) return false;
      if (step.demo === "graph-route") {
        graphStep11MarkStage("next-lesson-finalization-returned", {
          graphNodesBefore,
          graphNodesAfter: graphDemoNodeCount()
        });
      }
      assertActionOnlyDemonstration("after-action");
      verifyGraphDemoNodeBudget(step, graphNodesBefore);
      const mouseSafety = teacherMouseSafetyState || {
        samples: 0,
        relocations: 0,
        violations: 1,
        minimumClearance: 0
      };
      const mouseNeverCrossedLiveControls = tourDebugAssert(
        `tour-step-${attemptedStepIndex}-teacher-mouse-clear-of-live-skip-controls`,
        mouseSafety.samples > 0 && mouseSafety.violations === 0,
        {
          samples: mouseSafety.samples,
          relocations: mouseSafety.relocations,
          violations: mouseSafety.violations,
          minimumPredictedClearance: Number.isFinite(
            mouseSafety.minimumClearance
          )
            ? Math.round(mouseSafety.minimumClearance * 10) / 10
            : null,
          policy:
            "the live Skip controls move to a collision-free viewport corner before every teacher-mouse transition or held drag frame"
        }
      );
      if (!mouseNeverCrossedLiveControls) {
        throw new Error(
          `[RML Tour · Step ${attemptedStepIndex}] The teacher mouse could not keep a safe route clear of the live Skip controls.`
        );
      }

      releaseSemanticScene();
      await wait(520);
      if (runId !== demoRunId) return false;

      if (Object.hasOwn(GRAPH_CONTINUOUS_SCENE_NEXT, step.demo)) {
        const handoffReady = recordGraphTeachingSceneHandoff(step);
        if (step.demo === "graph-create-node" && !handoffReady) {
          graphDemoError(
            "Step 7 completed its node drag, but did not leave the exact complete Start → NOT composition required as Step 8's opening frame."
          );
        }
      } else if (step.mode !== "graph") {
        graphTeachingSceneHandoff = null;
      }

      if (controlledRepeat) {
        const returned = await returnFromControlledRepeat(
          repeatReturnStepIndex,
          repeatReturnTransaction
        );
        if (!returned) {
          throw new Error(
            `[RML Tour · Repeat] Step ${attemptedStepIndex} completed, but its originating dialog could not be restored.`
          );
        }
      } else if (stepIndex >= steps.length - 1) {
        void restoreAndClose(true);
      } else {
        await transitionToStep(stepIndex + 1, { captureEntry: true });
      }
      return true;
    } catch (error) {
      if (runId === demoRunId) {
        const failedStepIndex = stepIndex;
        if (controlledRepeat) {
          tourDebugRecord("controlled-repeat-demonstration-error", {
            failedStepIndex,
            failedStepTitle: step?.title || "",
            failedDemo: step?.demo || "",
            repeatReturnStepIndex,
            errorName: error?.name || "Error",
            message:
              error?.message ||
              String(error || "Unknown demonstration error")
          });
          await returnFromControlledRepeat(
            repeatReturnStepIndex,
            repeatReturnTransaction
          );
          return false;
        }
        const constraintCertificate = handleTourLayoutError(error, {
          stage: "demonstration",
          failedStepIndex,
          failedStepTitle: step?.title || "",
          failedDemo: step?.demo || ""
        });
        if (constraintCertificate) {
          let continuationPreparation = null;
          if (
            step?.demo === "graph-create-node" &&
            !graphDemoFindNode(/(?:^|\s)NOT(?:\s|$)/i)
          ) {
            continuationPreparation = window.RMLDynamicGraphHost
              ?.ensureOperatorNode?.("logic.not") || null;
            await nextTwoFrames();
          }
          tourDebugRecord("layout-constraint-noise-filtered", {
            stage: "demonstration",
            failedStepIndex,
            failedStepTitle: step?.title || "",
            failedDemo: step?.demo || "",
            rawError: error?.message || String(error || ""),
            constraintCertificate,
            continuationPreparation
          });
          tourDebugRecord(
            "demonstration-skipped-unavoidable-layout-constraint",
            {
              failedStepIndex,
              failedDemo: step?.demo || "",
              constraintCertificate,
              continuationPreparation,
              policy:
                "the action is attempted at most once; an independently certified impossible viewport makes its visual assertions not applicable instead of triggering retries or secondary transaction errors"
            }
          );
          tourDebugAssert(
            `tour-step-${failedStepIndex}-unavoidable-layout-constraint-contained`,
            true,
            {
              failedDemo: step?.demo || "",
              constraintCertificate,
              continuationPreparation
            }
          );
          console.info(
            "[RML Tour] An unavoidable, mathematically certified layout constraint was recorded as viewport noise.",
            constraintCertificate
          );
          return await advancePastFailedStep(
            failedStepIndex,
            runId,
            "unavoidable-layout-constraint",
            true
          );
        }
        const failureDetails = step?.demo === "graph-route"
          ? graphStep11AttachFailureDetails(
              error,
              "run-demo-catch",
              error?.details ?? null
            )
          : error?.details || null;
        tourDebugRecord("demonstration-error", {
          failedStepIndex,
          failedStepTitle: step?.title || "",
          failedDemo: step?.demo || "",
          errorName: error?.name || "Error",
          message:
            error?.message ||
            String(error || "Unknown demonstration error"),
          stack: String(error?.stack || ""),
          details: failureDetails
        });
        if (step?.demo === "graph-route") {
          console.error(
            "[RML Tour · Step 11 · iPhone failure snapshot]",
            failureDetails
          );
        }
        console.error(
          "[RML Tour] Demonstration failed once. The lesson will advance without reopening, restoring or retrying.",
          error
        );
        return await advancePastFailedStep(
          failedStepIndex,
          runId,
          "demonstration"
        );
      }
      return false;
    } finally {
      if (runId === demoRunId) {
        root?.classList.remove("rml-setup-demonstration-only");
        document.documentElement.classList.remove(
          "rml-setup-demonstration-active"
        );
        demoInFlight = false;
        teacherMouseSafetyState = null;
      }
    }
  }

  function captureTourState() {
    return cloneTourState(
      window.RMLBuilderSetupBridge?.capture?.() || null
    );
  }

  function cloneTourState(value) {
    if (value == null) return value;
    if (typeof structuredClone === "function") {
      try {
        return structuredClone(value);
      } catch {
        // JSON is sufficient for the builder's portable state shape.
      }
    }
    return JSON.parse(JSON.stringify(value));
  }

  function tourStateFingerprint(value) {
    try {
      const canonicalize = item => {
        if (Array.isArray(item)) {
          return item.map(canonicalize);
        }
        if (item && typeof item === "object") {
          return Object.keys(item)
            .sort()
            .reduce((result, key) => {
              result[key] = canonicalize(item[key]);
              return result;
            }, {});
        }
        return Object.is(item, -0) ? 0 : item;
      };
      return JSON.stringify(canonicalize(value || null));
    } catch {
      return "";
    }
  }

  function tourStateDifferences(expected, actual, path = "$", output = []) {
    if (output.length >= 24) return output;
    if (Object.is(expected, actual)) return output;
    const expectedArray = Array.isArray(expected);
    const actualArray = Array.isArray(actual);
    if (expectedArray || actualArray) {
      if (!expectedArray || !actualArray || expected.length !== actual.length) {
        output.push({
          path,
          expectedType: expectedArray ? "array" : typeof expected,
          actualType: actualArray ? "array" : typeof actual,
          expectedLength: expectedArray ? expected.length : null,
          actualLength: actualArray ? actual.length : null
        });
        return output;
      }
      for (let index = 0; index < expected.length; index += 1) {
        tourStateDifferences(
          expected[index],
          actual[index],
          `${path}[${index}]`,
          output
        );
        if (output.length >= 24) break;
      }
      return output;
    }
    const expectedObject = expected && typeof expected === "object";
    const actualObject = actual && typeof actual === "object";
    if (expectedObject && actualObject) {
      const keys = [...new Set([
        ...Object.keys(expected),
        ...Object.keys(actual)
      ])].sort();
      for (const key of keys) {
        if (!(key in expected) || !(key in actual)) {
          output.push({
            path: `${path}.${key}`,
            expectedPresent: key in expected,
            actualPresent: key in actual
          });
        } else {
          tourStateDifferences(
            expected[key],
            actual[key],
            `${path}.${key}`,
            output
          );
        }
        if (output.length >= 24) break;
      }
      return output;
    }
    output.push({ path, expected, actual });
    return output;
  }

  function restoreTourState(value) {
    if (!value) return;
    window.RMLBuilderSetupBridge?.restore?.(cloneTourState(value));
  }

  async function nextTwoFrames() {
    await tourNextVisualFrame();
    await tourNextVisualFrame();
  }

  async function restoreSandboxSnapshot() {
    if (!snapshot) return;
    const original = cloneTourState(snapshot);
    restoreTourState(original);
    await nextTwoFrames();

    const restoredFingerprint = tourStateFingerprint(captureTourState());
    if (
      snapshotFingerprint &&
      restoredFingerprint !== snapshotFingerprint
    ) {
      console.warn(
        "[RML Tour] Sandbox restore did not match the immutable entry snapshot. It will not be repeated.",
        { expected: snapshotFingerprint.length, actual: restoredFingerprint.length }
      );
    }
  }

  function showStep(index, options = {}) {
    const ui = elements();
    const step = steps[index];
    const controlledReentry =
      options.controlledReentry === true;
    if (
      !ui.root ||
      !step ||
      (
        enteredStepIndexes.has(index) &&
        !controlledReentry
      )
    ) {
      return false;
    }

    cancelDemo();
    demoInFlight = false;
    clearTarget();

    if (options.statePrepared !== true) {
      if (options.restoreEntry === true) {
        restoreTourState(stepSnapshots.get(index));
        void restoreTourEnvironmentState(
          stepEnvironmentSnapshots.get(index)
        );
      } else if (options.captureEntry !== false) {
        stepSnapshots.set(index, captureTourState());
        stepEnvironmentSnapshots.set(
          index,
          captureTourEnvironmentState()
        );
      }
    }

    stepIndex = index;
    const previousEntryCount = tourDebugState.events.filter(event =>
      event.type === "tour-step-entered" &&
      event.enteredStepIndex === index
    ).length;
    enteredStepIndexes.add(index);
    tourDebugRecord("tour-step-entered", {
      enteredStepIndex: index,
      enteredStepTitle: step.title || "",
      entries: previousEntryCount + 1,
      controlledReentry
    });
    ui.title.textContent = step.title;
    ui.hint.hidden = false;
    ui.progress.style.width =
      ((index + 1) / steps.length) * 100 + "%";
    const root = ui.root;
    root.classList.remove(
      "rml-setup-preparing-next",
      "rml-setup-demonstration-only"
    );

    if (step.demo) {
      ui.text.textContent = "";
      ui.hint.textContent = "";
      ui.hint.hidden = true;
      setStepPhase("narrating");
      const runId = demoRunId;
      if (options.deferNarration !== true) {
        queueMicrotask(() => {
          if (stepIndex !== index || runId !== demoRunId) return;
          void beginStepNarrationSafely(step, index, runId);
        });
      }
      return true;
    }

    root.classList.add("rml-setup-narration-active");
    ui.text.innerHTML = step.text;
    ui.hint.textContent = step.hint || "";
    ui.hint.hidden = !step.hint;
    setStepPhase("explain");
    positionShades(null, { force: true });
    fitNarrationCardToContent({ reset: true });
    return true;
  }

  async function skipCurrentDemonstration() {
    const skippedIndex = stepIndex;
    const step = steps[skippedIndex];
    const skippingLiveScene = Boolean(
      step?.demo &&
      (
        stepPhase === "preparing" ||
        (demoInFlight && stepPhase === "demonstrating")
      )
    );
    if (
      !step?.demo ||
      (!skippingLiveScene && stepPhase !== "ready")
    ) {
      return false;
    }

    if (skippingLiveScene) {
      cancelDemo();
      demoInFlight = false;
      document.documentElement.classList.remove(
        "rml-setup-demonstration-active"
      );
      elements().root?.classList.remove(
        "rml-setup-demonstration-only"
      );
      elements().card?.classList.remove(
        "rml-setup-card-hidden-during-scene"
      );
      const entry = stepSnapshots.get(skippedIndex);
      if (entry) restoreTourState(entry);
      await restoreTourEnvironmentState(
        stepEnvironmentSnapshots.get(skippedIndex)
      );
      await nextTwoFrames();
      restoreTourOverlayState(
        stepEnvironmentSnapshots.get(skippedIndex)?.overlay
      );
    }

    const skippedGraphHandoff = step.mode === "graph"
      ? recordSkippedGraphSceneHandoff(step)
      : null;

    tourDebugRecord("single-demonstration-skipped", {
      skippedStepIndex: skippedIndex,
      skippedStepTitle: step.title || "",
      skippedDemo: step.demo,
      skippedWhileRunning: skippingLiveScene,
      skippedPhase: stepPhase,
      graphSceneCarriedForward:
        skippedGraphHandoff?.ready === true,
      graphSceneTarget:
        skippedGraphHandoff?.handoff?.toDemo || "",
      overlayStateRestored: tourOverlayStateMatches(
        stepEnvironmentSnapshots.get(skippedIndex)?.overlay
      )
    });

    if (skippedIndex >= steps.length - 1) {
      await restoreAndClose(true);
    } else {
      const transitioned = await transitionToStep(skippedIndex + 1, {
        captureEntry: true
      });
      let skipSceneComparison = null;
      let exactSkipHandoff = false;
      if (transitioned && skippedGraphHandoff?.ready === true) {
        const opening = graphTeachingSceneSnapshot(
          `${step.demo}-skip-preserved-opening`
        );
        skipSceneComparison = compareGraphProductState(
          skippedGraphHandoff.terminal,
          opening
        );
        exactSkipHandoff = tourDebugAssert(
          `${step.demo}-skip-preserved-exact-graph-scene`,
          skipSceneComparison.exact === true,
          {
            skippedStepIndex: skippedIndex,
            fromDemo: step.demo,
            toDemo: skippedGraphHandoff.handoff?.toDemo || "",
            terminal: skippedGraphHandoff.terminal,
            opening,
            mismatches: skipSceneComparison.mismatches,
            ignoredPresentationMismatches:
              skipSceneComparison.ignoredPresentationMismatches,
            policy:
              "Skip preserves the complete graph product state; only page and toolbar scrolling needed to reveal Step 10 controls is allowed"
          }
        );
      }
      if (transitioned && step.demo === "graph-flip") {
        await nextTwoFrames();
        const pair = graphDemoSocketPair(false);
        const connection = graphTeachingPairExistingConnection(pair);
        if (skippedGraphHandoff?.preserveExactGraphState === true) {
          tourDebugAssert(
            "graph-flip-connected-skip-zero-graph-mutation",
            Boolean(
              exactSkipHandoff &&
              skipSceneComparison?.exact === true &&
              connection
            ),
            {
              skippedStepIndex: skippedIndex,
              connectedBeforeSkip:
                skippedGraphHandoff.connectedTeachingPair === true,
              connectedAfterSkip: Boolean(connection),
              comparison: skipSceneComparison,
              terminal: skippedGraphHandoff.terminal,
              opening: graphTeachingSceneSnapshot(
                "graph-flip-connected-skip-zero-mutation-verification"
              ),
              policy:
                "with both nodes and their cable already present, Step 9 Skip changes no node coordinate, connection, camera, zoom, selection or panel; page and toolbar scrolling may only reveal Step 10 controls"
            }
          );
        } else {
          const spacing = graphTeachingPairSpacingProof(pair, {
            minimumGraphGap: 120,
            maximumGraphGap: 920,
            minimumClientGap: window.innerWidth < 480 ? 24 : 32
          });
          tourDebugAssert(
            "graph-flip-skip-fallback-keeps-nodes-visibly-separated",
            spacing.ok === true,
            {
              skippedStepIndex: skippedIndex,
              spacing,
              policy:
                "only an incomplete graph may use preparation, and its complete node rectangles must remain separated"
            }
          );
        }
      }
    }
    return true;
  }

  async function repeatPreviousDemonstration() {
    const returnStepIndex = stepIndex;
    const returnStep = steps[returnStepIndex];
    const repeatStepIndex = previousDemonstrationIndex(
      returnStepIndex
    );
    const repeatAllowedFromCurrentPhase = Boolean(
      returnStep &&
      (
        returnStep.demo
          ? stepPhase === "ready"
          : stepPhase === "explain"
      )
    );
    const repeatSnapshot = stepReadySnapshots.get(repeatStepIndex);
    const repeatEnvironmentSnapshot =
      stepReadyEnvironmentSnapshots.get(repeatStepIndex);

    if (
      repeatPreviousInFlight ||
      demoInFlight ||
      restoreInFlight ||
      repeatStepIndex < 0 ||
      !repeatAllowedFromCurrentPhase ||
      !repeatSnapshot ||
      !repeatEnvironmentSnapshot
    ) {
      tourDebugRecord("controlled-repeat-previous-rejected", {
        returnStepIndex,
        repeatStepIndex,
        phase: stepPhase,
        repeatPreviousInFlight,
        demoInFlight,
        restoreInFlight,
        snapshotAvailable: Boolean(repeatSnapshot),
        environmentSnapshotAvailable: Boolean(
          repeatEnvironmentSnapshot
        ),
        policy:
          "Repeat is available only from the next ready dialog and uses the previous lesson's immutable post-narration Demonstrate snapshot."
      });
      return false;
    }

    const returnTransaction = {
      role: "repeat-return-dialog",
      state: captureTourState(),
      environment: captureTourEnvironmentState(),
      phase: stepPhase
    };
    repeatPreviousInFlight = true;
    controlledRepeatCount += 1;
    setStepPhase(stepPhase);
    tourDebugRecord("controlled-repeat-previous-start", {
      transaction: controlledRepeatCount,
      repeatStepIndex,
      repeatStepTitle: steps[repeatStepIndex]?.title || "",
      repeatDemo: steps[repeatStepIndex]?.demo || "",
      returnStepIndex,
      returnStepTitle: returnStep.title || "",
      previousNarrationWillRun: false,
      snapshotRestored: true,
      snapshotKind: "post-narration-demonstrate-ready",
      returnStateCaptured: Boolean(
        returnTransaction.state && returnTransaction.environment
      )
    });

    try {
      const opened = await transitionToStep(repeatStepIndex, {
        captureEntry: false,
        controlledReentry: true,
        deferNarration: true,
        directDemonstration: true,
        restoreTransaction: {
          role: "repeat-demonstration-ready",
          state: repeatSnapshot,
          environment: repeatEnvironmentSnapshot
        }
      });
      if (!opened) {
        if (stepIndex !== returnStepIndex) {
          await returnFromControlledRepeat(
            returnStepIndex,
            returnTransaction
          );
        }
        return false;
      }

      const repeated = await runDemo(
        steps[repeatStepIndex],
        findTarget(steps[repeatStepIndex]),
        {
          controlledRepeat: true,
          repeatReturnStepIndex: returnStepIndex,
          repeatReturnTransaction: returnTransaction
        }
      );
      tourDebugRecord("controlled-repeat-previous-complete", {
        transaction: controlledRepeatCount,
        repeatStepIndex,
        returnStepIndex,
        returnedToRequestedDialog: stepIndex === returnStepIndex,
        previousNarrationRepeated: false,
        demonstrationCompleted: repeated,
        readySnapshotUsed: true,
        returnStateRestored: stepIndex === returnStepIndex
      });
      return repeated;
    } catch (error) {
      tourDebugRecord("controlled-repeat-previous-transaction-error", {
        transaction: controlledRepeatCount,
        repeatStepIndex,
        returnStepIndex,
        errorName: error?.name || "Error",
        message: error?.message || String(error || "Unknown repeat error")
      });
      if (stepIndex !== returnStepIndex) {
        await returnFromControlledRepeat(
          returnStepIndex,
          returnTransaction
        );
      }
      return false;
    } finally {
      repeatPreviousInFlight = false;
      let currentUi = elements();
      const tourWasExplicitlyClosed = Boolean(
        restoreInFlight || !snapshot
      );
      const originAlreadyRestored = Boolean(
        stepIndex === returnStepIndex &&
        stepPhase === returnTransaction.phase &&
        currentUi.root &&
        !currentUi.root.hidden &&
        !demoInFlight
      );
      if (!tourWasExplicitlyClosed && !originAlreadyRestored) {
        await returnFromControlledRepeat(
          returnStepIndex,
          returnTransaction
        );
        currentUi = elements();
      }
      if (!tourWasExplicitlyClosed && !demoInFlight) {
        restoreControlledRepeatDialogPresentation(
          returnStepIndex,
          returnTransaction.phase
        );
        await nextTwoFrames();
        currentUi = elements();
        setStepPhase(stepPhase);
        fitNarrationCardToContent({ followText: false });
      }
      const repeatAbortedByTourClose = tourWasExplicitlyClosed;
      if (repeatAbortedByTourClose) {
        tourDebugRecord("controlled-repeat-ended-by-tour-close", {
          returnStepIndex,
          actualStepIndex: stepIndex,
          assistantHidden: Boolean(currentUi.root?.hidden),
          restoreInFlight,
          snapshotAvailable: Boolean(snapshot),
          policy:
            "an explicit full-tour Skip remains authoritative and does not create a false repeat-transaction failure"
        });
      } else {
        const returnDialogRestored = tourDebugAssert(
          "controlled-repeat-previous-return-dialog-restored",
          Boolean(
            stepIndex === returnStepIndex &&
            stepPhase === returnTransaction.phase &&
            currentUi.root &&
            !currentUi.root.hidden &&
            !demoInFlight &&
            !repeatPreviousInFlight &&
            currentUi.repeatPrevious &&
            !currentUi.repeatPrevious.hidden &&
            !currentUi.repeatPrevious.disabled
          ),
          {
            returnStepIndex,
            actualStepIndex: stepIndex,
            expectedPhase: returnTransaction.phase,
            actualPhase: stepPhase,
            repeatButtonVisible: Boolean(
              currentUi.repeatPrevious &&
              !currentUi.repeatPrevious.hidden
            ),
            repeatButtonEnabled: Boolean(
              currentUi.repeatPrevious &&
              !currentUi.repeatPrevious.disabled
            ),
            policy:
              "after the previous demonstration finishes, the exact originating dialog is restored and Repeat previous remains available for another explicit click"
          }
        );
        if (!returnDialogRestored) {
          tourDebugRecord(
            "controlled-repeat-origin-dialog-restoration-incomplete",
            {
              returnStepIndex,
              actualStepIndex: stepIndex,
              expectedPhase: returnTransaction.phase,
              actualPhase: stepPhase,
              policy:
                "the product state is preserved and no synthetic repeat failure is emitted from presentation-only validation"
            }
          );
        }
      }
    }
  }

  async function restoreAndClose(markComplete = true) {
    if (restoreInFlight) {
      const joinedAt = performance.now();
      while (
        restoreInFlight &&
        performance.now() - joinedAt < 12000
      ) {
        await new Promise(resolve => window.setTimeout(resolve, 40));
      }
      return restoreInFlight === false;
    }
    restoreInFlight = true;
    const ui = elements();
    const expectedState = snapshot;
    const expectedFingerprint = snapshotFingerprint;
    const expectedEnvironment = originalTourUiState;
    try {
      cancelDemo();
      clearTarget();
      document.documentElement.classList.remove("rml-setup-tour-active");
      document.documentElement.classList.remove(
        "rml-setup-demonstration-active"
      );
      if (ui.root) ui.root.hidden = true;
      if (ui.liveControls) ui.liveControls.hidden = true;
      if (ui.liveSkipDemo) ui.liveSkipDemo.disabled = true;
      if (ui.liveSkipTour) ui.liveSkipTour.disabled = true;

      await restoreSandboxSnapshot();
      await restoreTourEnvironmentState(expectedEnvironment);
      await nextTwoFrames();
      restoreTourStorageState(expectedEnvironment?.storage);
      restoreTourOverlayState(expectedEnvironment?.overlay);
      window.scrollTo(
        Number(expectedEnvironment?.page?.x) || 0,
        Number(expectedEnvironment?.page?.y) || 0
      );
      restoreTourScrollSurfaces(expectedEnvironment?.scrollSurfaces);
      await nextTwoFrames();

      const actualState = captureTourState();
      const actualFingerprint = tourStateFingerprint(actualState);
      const builderStateMatches =
        actualFingerprint === expectedFingerprint;
      const builderStateDifferences = builderStateMatches
        ? []
        : tourStateDifferences(expectedState, actualState);
      const storageMatches =
        tourStorageFingerprint() ===
        tourStorageFingerprint(expectedEnvironment?.storage || []);
      const overlayMatches = tourOverlayStateMatches(
        expectedEnvironment?.overlay
      );
      const modeMatches = Boolean(
        expectedEnvironment &&
        document.body.classList.contains("rml-node-graph-mode") ===
          expectedEnvironment.graphMode &&
        document.body.classList.contains("rml-graph-left-collapsed") ===
          expectedEnvironment.graphLeftCollapsed &&
        document.body.classList.contains("rml-graph-right-collapsed") ===
          expectedEnvironment.graphRightCollapsed
      );
      const topMenuState = responsiveTopActionsState();
      const topMenuMatches = Boolean(
        expectedEnvironment &&
        topMenuState.open === expectedEnvironment.topMenuOpen
      );
      const sandboxRestored = tourDebugAssert(
        "tour-sandbox-full-restore-contract",
        Boolean(
          expectedState &&
          expectedFingerprint &&
          builderStateMatches &&
          storageMatches &&
          overlayMatches &&
          modeMatches &&
          topMenuMatches &&
          ui.root?.hidden &&
          !document.documentElement.classList.contains(
            "rml-setup-demonstration-active"
          )
        ),
        {
          builderStateMatches,
          builderStateDifferences,
          storageMatches,
          overlayMatches,
          modeMatches,
          topMenuMatches,
          assistantHidden: Boolean(ui.root?.hidden),
          liveControlsHidden: Boolean(ui.liveControls?.hidden),
          expectedDialogs: expectedEnvironment?.overlay?.dialogs || [],
          actualDialogs: captureTourOverlayState().dialogs,
          policy:
            "Finish and every full-tour Skip restore the immutable builder, storage, mode, menu, scroll and product-overlay entry state before the assistant closes"
        }
      );
      if (!sandboxRestored) {
        console.error(
          "[RML Tour] The sandbox restore contract did not return every captured surface to its entry state."
        );
      }

      if (markComplete || firstRunSession) {
        window.RMLBuilderSetupBridge?.markComplete?.();
      }
    } finally {
      snapshot = null;
      snapshotFingerprint = "";
      stepSnapshots.clear();
      stepEnvironmentSnapshots.clear();
      stepReadySnapshots.clear();
      stepReadyEnvironmentSnapshots.clear();
      originalTourUiState = null;
      firstRunSession = false;
      mobileTopbarPreparedForNarration = false;
      mobilePackPreparedForNarration = false;
      repeatPreviousInFlight = false;
      tourResizeObserver?.disconnect?.();
      restoreInFlight = false;
    }
  }

  function bindEvents() {
    const ui = elements();
    if (!ui.root || ui.root.dataset.bound === "true") return;
    ui.root.dataset.bound = "true";

    const blockTrustedInteraction = event => {
      if (
        ui.root.hidden ||
        event.isTrusted !== true ||
        !document.documentElement.classList.contains(
          "rml-setup-tour-active"
        ) ||
        ui.root.contains(event.target)
      ) {
        return;
      }
      if (event.type === "keydown" && event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        void restoreAndClose(true);
        return;
      }
      if (
        event.type === "pointerdown" &&
        stepPhase === "narrating" &&
        event.button === 0 &&
        event.isPrimary !== false
      ) {
        event.preventDefault();
        event.stopImmediatePropagation();
        advanceNarrationScene("global-primary-pointer");
        return;
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    [
      "pointerdown",
      "pointermove",
      "pointerup",
      "pointerrawupdate",
      "pointercancel",
      "mousedown",
      "mousemove",
      "mouseup",
      "touchstart",
      "touchmove",
      "touchend",
      "touchcancel",
      "click",
      "auxclick",
      "dblclick",
      "contextmenu",
      "wheel",
      "keydown",
      "keyup",
      "keypress",
      "beforeinput",
      "input",
      "change",
      "compositionstart",
      "compositionupdate",
      "compositionend",
      "paste",
      "cut",
      "submit",
      "dragstart",
      "dragover",
      "drop"
    ].forEach(type => {
      window.addEventListener(type, blockTrustedInteraction, {
        capture: true,
        passive: false
      });
    });
    ui.root.dataset.inputLockBoundary = "window-capture";

    ui.root.addEventListener("pointerdown", event => {
      if (
        stepPhase !== "narrating" ||
        event.button !== 0 ||
        event.isPrimary === false ||
        event.target instanceof Element &&
          event.target.closest("button, a, input, select, textarea")
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      advanceNarrationScene("primary-pointer");
    }, true);

    ui.next?.addEventListener("click", () => {
      const step = steps[stepIndex];
      if (
        !step ||
        demoInFlight ||
        stepPhase === "narrating" ||
        stepPhase === "preparing" ||
        stepPhase === "demonstrating"
      ) return;

      if (step.demo && stepPhase === "ready") {
        void runDemo(step, findTarget(step));
        return;
      }

      if (stepIndex >= steps.length - 1) {
        void restoreAndClose(true);
      } else {
        void transitionToStep(stepIndex + 1, { captureEntry: true });
      }
    });
    ui.skipDemo?.addEventListener("click", () => {
      void skipCurrentDemonstration();
    });
    ui.repeatPrevious?.addEventListener("click", () => {
      void repeatPreviousDemonstration();
    });
    ui.liveSkipDemo?.addEventListener("click", () => {
      void skipCurrentDemonstration();
    });
    ui.liveSkipTour?.addEventListener("click", () => {
      void restoreAndClose(true);
    });
    ui.skip?.addEventListener("click", () => void restoreAndClose(true));
    const handleViewportScroll = () => {
      if (ui.root.hidden) return;
      if (demoInFlight) return;
      positionShades(currentTarget);
      fitNarrationCardToContent({ followText: stepPhase === "narrating" });
      updateNarrationOutlines();
    };

    const handleViewportGeometryChange = () => {
      if (ui.root.hidden) return;

      cancelAnimationFrame(viewportGeometryFrame);
      viewportGeometryFrame = requestAnimationFrame(() => {
        if (ui.root.hidden) return;

        if (activeSemanticScene?.locked) {
          const visibleMembers = activeSemanticScene.elements.filter(
            tourElementActuallyVisible
          );
          const sceneRect = clampSceneRect(tourFocusRect(visibleMembers, 0));
          if (sceneRect) activeSemanticScene.rect = sceneRect;
        }

        positionShades(
          activeSemanticScene?.rect || currentTarget,
          { force: true }
        );
        if (!demoInFlight) {
          preserveResponsiveNarrationTargets();
          revealActiveNarrationTargets();
          fitNarrationCardToContent({
            followText: stepPhase === "narrating"
          });
        }
        updateNarrationOutlines();
      });
    };
    window.addEventListener("resize", handleViewportGeometryChange, { passive: true });
    window.addEventListener("orientationchange", handleViewportGeometryChange, { passive: true });
    window.visualViewport?.addEventListener("resize", handleViewportGeometryChange, { passive: true });
    window.visualViewport?.addEventListener("scroll", handleViewportScroll, { passive: true });

    if (typeof ResizeObserver === "function") {
      tourResizeObserver?.disconnect?.();
      tourResizeObserver = new ResizeObserver(() => {
        if (ui.root.hidden || demoInFlight) return;
        requestAnimationFrame(() => {
          if (ui.root.hidden || demoInFlight) return;
          positionShades(currentTarget);
          preserveResponsiveNarrationTargets();
          revealActiveNarrationTargets();
          fitNarrationCardToContent({
            followText: stepPhase === "narrating"
          });
          updateNarrationOutlines();
        });
      });
      [
        document.documentElement,
        document.querySelector(".topbar"),
        document.querySelector("main"),
        document.querySelector(".rml-graph-viewport")
      ].filter(Boolean).forEach(element => tourResizeObserver.observe(element));
    }
    document.addEventListener("keydown", event => {
      if (ui.root.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        void restoreAndClose(true);
      } else if (event.key === "ArrowRight" && !event.shiftKey) {
        event.preventDefault();
        ui.next?.click();
      }
    }, true);
    window.addEventListener("pagehide", () => {
      if (snapshot) {
        restoreTourState(snapshot);
      }
    });
  }

  function start(options = {}) {
    if (startPromise) return startPromise;
    startPromise = (async () => {
      await ensureTemplate();
      const ui = elements();
      if (!ui.root || !window.RMLBuilderSetupBridge) return false;
      if (!ui.root.hidden) return true;

      firstRunSession = options.firstRun === true;
      mobileTopbarPreparedForNarration = false;
      enteredStepIndexes.clear();
      narratedStepIndexes.clear();
      attemptedDemonstrationIndexes.clear();
      blockedRepeatCount = 0;
      controlledRepeatCount = 0;
      repeatPreviousInFlight = false;
      graphCreateNodePreparedDropPlan = null;
      snapshot = captureTourState();
      snapshotFingerprint = tourStateFingerprint(snapshot);
      originalTourUiState = captureTourEnvironmentState();
      stepSnapshots.clear();
      stepEnvironmentSnapshots.clear();
      stepReadySnapshots.clear();
      stepReadyEnvironmentSnapshots.clear();

      window.RMLBuilderSetupBridge.prepareTourDemo?.();

      await new Promise(resolve => window.setTimeout(resolve, 0));

      window.RMLTypedNodeGraphScrollLayers?.clear?.();
      window.RMLUniversalScrollLayers?.clear?.();

      await new Promise(resolve => window.setTimeout(resolve, 0));

      ui.root.classList.add("rml-setup-layout-pending");
      ui.root.hidden = false;
      document.documentElement.classList.add("rml-setup-tour-active");
      showStep(0, {
        captureEntry: true,
        deferNarration: true
      });
      positionShades(null, { force: true });
      fitNarrationCardToContent({ reset: true });
      positionCard(null, { force: true });
      await nextTwoFrames();
      positionCard(null, { force: true });

      const viewport = tourViewport();
      const cardRect = ui.card?.getBoundingClientRect?.() || null;
      const cardCenteredBeforeReveal = Boolean(
        cardRect &&
        cardRect.width > 0 &&
        cardRect.height > 0 &&
        cardRect.left >= viewport.left + 8 &&
        cardRect.top >= viewport.top + 8 &&
        cardRect.right <= viewport.right - 8 &&
        cardRect.bottom <= viewport.bottom - 8 &&
        Math.abs(
          (cardRect.left + cardRect.right) / 2 -
          (viewport.left + viewport.right) / 2
        ) <= 2 &&
        Math.abs(
          (cardRect.top + cardRect.bottom) / 2 -
          (viewport.top + viewport.bottom) / 2
        ) <= 2
      );
      ui.root.dataset.firstVisiblePrepositioned = String(
        cardCenteredBeforeReveal
      );
      tourDebugAssert(
        "tour-first-visible-frame-prepositioned",
        cardCenteredBeforeReveal,
        {
          cardRect: cardRect ? tourDebugRect(ui.card) : null,
          viewport,
          policy:
            "layout is measured while visibility-hidden and revealed only at its final centered coordinates"
        }
      );
      ui.root.classList.remove("rml-setup-layout-pending");

      const firstStep = steps[0];
      const runId = demoRunId;
      if (firstStep?.demo) {
        queueMicrotask(() => {
          if (stepIndex !== 0 || runId !== demoRunId) return;
          void beginStepNarrationSafely(firstStep, 0, runId);
        });
      }
      return true;
    })().finally(() => {
      startPromise = null;
    });
    return startPromise;
  }

  Object.defineProperty(window, "RMLBuilderSetupAssistant", {
    value: Object.freeze({ start }),
    configurable: true
  });
})();