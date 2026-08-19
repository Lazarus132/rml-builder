(() => {
  "use strict";

  const SCRIPT_BASE = document.currentScript?.src || window.location.href;
  const TEMPLATE_URL = new URL("setup_template.html?v=74-immediate-ready-repeat-previous-v272", SCRIPT_BASE).href;
  const TEMPLATE_SCRIPT_URL = new URL("setup_template.js?v=74-immediate-ready-repeat-previous-v272", SCRIPT_BASE).href;
  let templatePromise = null;
  let snapshot = null;
  let snapshotFingerprint = "";
  let stepSnapshots = new Map();
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
  let stableTourViewport = null;
  let outlineNestedPreparationHelperIds = [];
  let startPromise = null;
  let mobileTopbarPreparedForNarration = false;
  let mobilePackPreparedForNarration = false;
  let outlineNestedTransactionSerial = 0;
  let graphPaletteRevealState = null;
  let graphCreateNodePreparedDropPlan = null;
  let graphTeachingSceneHandoff = null;
  const tourInteractionCapabilities = new Map();
  const enteredStepIndexes = new Set();
  const narratedStepIndexes = new Set();
  const attemptedDemonstrationIndexes = new Set();
  let blockedRepeatCount = 0;

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
    build: "stable-tour-step4-build259-plus-vertical-live-wheel-20260819-v272",
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
    const timer = window.setTimeout(resolve, milliseconds);
    demoTimers.push(timer);
  });

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
      text: "Drag a connection from a matching output on the Start node to the input on the NOT node. Ports that belong together can connect, while unsuitable combinations are refused. No additional nodes are needed for this step.",
      hint: "The existing nodes are reused to create one clear connection between them.",
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
      text: "Drag a node by its title to move it. Connecting another input to an existing line creates a branch, while pulling part of the line creates a bend that can be repositioned. A suitable existing node is reused whenever possible.",
      hint: "The graph remains tidy, and another node is added only when the branch truly requires one.",
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

  function narrationSegmentsForStep(step) {
    const allIdentityFields = ids => () => ids
      .map(id => document.getElementById(id)?.closest("label"))
      .filter(Boolean);
    const visibleController = () => [...document.querySelectorAll(
      ".node-card.controller[data-node-id]"
    )].find(card => card.querySelector(":scope > .controller-options"));
    const visibleGraphNode = () => [...document.querySelectorAll(
      ".rml-graph-node"
    )].find(tourElementActuallyVisible);
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
        text: "Tour opens this guided walkthrough. Because the walkthrough is already active, pressing the button keeps the current tour open instead of starting another one."
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
          targets: visibleGraphNode,
          text: "A matching output on the Start node provides the beginning of the connection."
        },
        {
          targets: ".rml-graph-viewport",
          text: "That output connects to the input on the existing NOT node. No additional nodes are created."
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
          text: "Dragging a node by its title changes its position. Existing lines can accept another connection or be shaped with a movable bend. Suitable existing nodes are reused whenever possible."
        }
      ],
      "graph-inspector": [
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

  function addNarrationOutline(targets) {
    const visible = tourVisibleTargets(targets);
    activeNarrationTargets = visible;
    if (!visible.length) return null;
    const element = document.createElement("div");
    element.className = "rml-setup-narration-outline is-entering";
    element.setAttribute("aria-hidden", "true");
    document.getElementById("rml-setup-assistant")?.appendChild(element);
    narrationOutlineGroups.push({ element, targets: visible });
    updateNarrationOutlines();
    requestAnimationFrame(() => element.classList.remove("is-entering"));
    return element;
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
    if (
      segment?.afterNarrationAction !== "open-responsive-topbar" ||
      runId !== demoRunId
    ) {
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
      let visibleTargets = tourVisibleTargets(segment.targets);
      let compactMenuHandoff = null;
      if (
        mobileTopbarPreparedForNarration &&
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
      addNarrationOutline(visibleTargets);
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
          throw new Error(
            "[RML Tour · Step 1] Narration did not resume on the first visible compact-menu action after opening the Hamburger."
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
        narrationReadingMetrics.typedCharacters ===
          expectedTypedCharacterCount &&
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
        behavior:
          "human-readable character pacing with punctuation pauses and one reading pause per automatic line scroll"
      }
    );
    tourDebugAssert(
      `tour-step-${index}-full-preparation-and-natural-narration-complete`,
      completedSegments === segments.length &&
        highlightedSegments === segments.length &&
        interactionAdvancedSegments === 0 &&
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

  function setSemanticSceneState(state = "armed") {
    if (!activeSemanticScene) return;
    activeSemanticScene.state = state;
    const root = document.getElementById("rml-setup-assistant");
    if (root) root.dataset.setupSceneState = state;
    for (const element of activeSemanticScene.elements) {
      element.dataset.setupSceneState = state;
    }
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

    const ranked = candidates.map(candidate => {
      const rectangle = {
        left: candidate.left,
        top: candidate.top,
        right: candidate.left + width,
        bottom: candidate.top + height
      };
      return {
        candidate,
        overlap: rectangleIntersectionArea(rectangle, scene.rect)
      };
    }).sort((a, b) => a.overlap - b.overlap);

    const best = ranked[0];
    if (!best || best.overlap > 1) {
      card.classList.add("rml-setup-card-hidden-during-scene");
      return;
    }

    card.style.left = `${best.candidate.left}px`;
    card.style.top = `${best.candidate.top}px`;
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

    if (!target) {
      card.style.left = `${viewport.left + (viewport.width - cardWidth) / 2}px`;
      card.style.top = `${viewport.top + (viewport.height - cardHeight) / 2}px`;
      return;
    }

    const rect = tourRect(target);
    if (!rect) return positionCard(null);
    let left = Math.min(
      viewport.right - cardWidth - horizontalMargin,
      Math.max(viewport.left + horizontalMargin, rect.left)
    );
    let top = rect.bottom + 16;
    if (top + cardHeight > viewport.bottom - verticalMargin) top = rect.top - cardHeight - 16;
    if (top < viewport.top + verticalMargin) top = viewport.bottom - cardHeight - verticalMargin;
    left = Math.max(
      viewport.left + horizontalMargin,
      Math.min(left, viewport.right - cardWidth - horizontalMargin)
    );
    top = Math.max(
      viewport.top + verticalMargin,
      Math.min(top, viewport.bottom - cardHeight - verticalMargin)
    );
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
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

  function positionNarrationCardAwayFromTargets() {
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
    const focus = narrationOutlineRect(
      activeNarrationTargets.filter(tourElementActuallyVisible)
    );
    if (!focus) {
      positionCard(null, { force: true });
      return {
        key: "center",
        left: card.getBoundingClientRect().left,
        top: card.getBoundingClientRect().top,
        overlap: 0,
        distance: 0
      };
    }
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
    const candidates = [];
    for (const [row, top] of tops.entries()) {
      for (const [column, left] of lefts.entries()) {
        const rect = {
          left,
          top,
          right: left + width,
          bottom: top + height
        };
        const overlap = rectangleIntersectionArea(rect, focus);
        const cardCenter = {
          x: left + width / 2,
          y: top + height / 2
        };
        const focusCenter = focus
          ? {
              x: (focus.left + focus.right) / 2,
              y: (focus.top + focus.bottom) / 2
            }
          : {
              x: viewport.left + viewport.width / 2,
              y: viewport.top + viewport.height / 2
            };
        candidates.push({
          key: `${row}-${column}`,
          left,
          top,
          overlap,
          distance: Math.hypot(
            cardCenter.x - focusCenter.x,
            cardCenter.y - focusCenter.y
          )
        });
      }
    }
    candidates.sort((a, b) =>
      a.overlap - b.overlap ||
      b.distance - a.distance ||
      a.key.localeCompare(b.key)
    );
    const best = candidates[0];
    if (!best) return null;
    card.style.transform = "none";
    card.style.left = `${best.left}px`;
    card.style.top = `${best.top}px`;
    return best;
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
    const maximumWidth = Math.min(
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
    const minimumWidth = viewport.width <= 520
      ? maximumWidth
      : Math.min(
          maximumWidth,
          Math.max(340, Math.min(480, viewport.width * .27))
        );
    const characterCount = text.textContent?.length || 0;
    const widthProgress = 1 - Math.exp(-characterCount / 260);
    const contentDesiredWidth = Math.min(
      maximumWidth,
      minimumWidth + (maximumWidth - minimumWidth) * widthProgress
    );
    const priorRequestedWidth =
      narrationCardMetrics?.requestedWidth || 0;
    const requestedWidth = Math.min(
      maximumWidth,
      Math.max(
        contentDesiredWidth,
        Math.min(maximumWidth, priorRequestedWidth)
      )
    );
    const viewportBoundHeight = Math.max(
      1,
      viewport.height - margin * 2
    );
    const maximumHeight = viewport.width <= 780
      ? viewportBoundHeight
      : Math.min(720, viewportBoundHeight);

    card.style.setProperty(
      "--rml-setup-adaptive-card-width",
      `${Math.round(requestedWidth)}px`
    );
    card.style.setProperty(
      "--rml-setup-adaptive-card-max-width",
      `${Math.round(maximumWidth)}px`
    );
    ui.root?.classList.add("rml-setup-adaptive-narration-card");

    const textStyle = getComputedStyle(text);
    const computedFontSize =
      Number.parseFloat(textStyle.fontSize) || 15;
    const computedLineHeight =
      Number.parseFloat(textStyle.lineHeight) ||
      computedFontSize * 1.56;
    const minimumFirstLineHeight = Math.ceil(
      computedLineHeight + 2
    );
    card.style.setProperty(
      "--rml-setup-adaptive-text-min-height",
      `${minimumFirstLineHeight}px`
    );

    const previousScrollTop = text.scrollTop;
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
      minimumFirstLineHeight,
      text.scrollHeight
    );
    const chromeHeight = Math.max(
      0,
      naturalHeight - naturalTextHeight
    );
    const priorRequestedHeight = narrationCardMetrics?.requestedHeight || 0;
    const requestedHeight = Math.min(
      maximumHeight,
      Math.max(
        naturalHeight,
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

    const placement = positionNarrationCardAwayFromTargets();
    updateNarrationOutlines();
    const cardRect = card.getBoundingClientRect();
    const overflowing = text.scrollHeight > text.clientHeight + 1;
    const lineFollow = followText && overflowing
      ? followNarrationActiveLine(text, computedLineHeight)
      : { autoScrolled: false, activeLineVisible: true };
    const fontSize = computedFontSize;
    const visibility = narrationSurfaceVisibility();
    const firstLine = narrationFirstLineGeometry();

    if (reset || !narrationCardMetrics) {
      narrationCardMetrics = {
        initialWidth: cardRect.width,
        initialHeight: cardRect.height,
        minimumWidth,
        maximumWidth,
        maximumHeight,
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
        finalGlowCount: visibility.glowCount,
        firstLineMeasured: firstLine.measured,
        firstLineAlwaysClearOfTitle:
          !firstLine.measured ||
          (firstLine.clearOfTitle && firstLine.firstGlyphFullyVisible),
        firstLineGeometry: firstLine
      };
    } else {
      if (
        cardRect.width < narrationCardMetrics.lastObservedWidth - 1
      ) {
        narrationCardMetrics.widthRegressionCount += 1;
      }
      if (
        cardRect.height < narrationCardMetrics.lastObservedHeight - 1
      ) {
        narrationCardMetrics.heightRegressionCount += 1;
      }
      narrationCardMetrics.lastObservedWidth = cardRect.width;
      narrationCardMetrics.lastObservedHeight = cardRect.height;
      narrationCardMetrics.minimumWidth = minimumWidth;
      narrationCardMetrics.maximumWidth = maximumWidth;
      narrationCardMetrics.maximumHeight = maximumHeight;
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
      narrationCardMetrics.finalGlowCount = visibility.glowCount;
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
    return tourDebugAssert(
      `tour-step-${index}-adaptive-narration-card-growth-and-scroll`,
      Boolean(metrics) &&
        (widthAlreadyAtLimit || widthGrew) &&
        heightGrew &&
        metrics.maxObservedWidth <= metrics.maximumWidth + 2 &&
        metrics.maxObservedHeight <= metrics.maximumHeight + 2 &&
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
    const { root, mouse, liveControls } = elements();
    if (
      !(dialog instanceof HTMLDialogElement) ||
      !dialog.open ||
      !(mouse instanceof HTMLElement)
    ) {
      return false;
    }
    const mouseRect = mouse.getBoundingClientRect();
    const dialogRect = dialog.getBoundingClientRect();
    const style = getComputedStyle(mouse);
    const center = {
      x: mouseRect.left + mouseRect.width * .5,
      y: mouseRect.top + mouseRect.height * .5
    };
    const targetRect = target?.getBoundingClientRect?.() || null;
    const insideDialog =
      center.x >= dialogRect.left && center.x <= dialogRect.right &&
      center.y >= dialogRect.top && center.y <= dialogRect.bottom;
    const overlapsTarget = !targetRect || (
      center.x >= targetRect.left - mouseRect.width &&
      center.x <= targetRect.right + mouseRect.width &&
      center.y >= targetRect.top - mouseRect.height &&
      center.y <= targetRect.bottom + mouseRect.height
    );
    return Boolean(
      dialog.contains(root) &&
      dialog.contains(mouse) &&
      dialog.contains(liveControls) &&
      mouse.classList.contains("active") &&
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      Number.parseFloat(style.opacity || "0") >= .9 &&
      mouseRect.width > 20 &&
      mouseRect.height > 28 &&
      insideDialog &&
      overlapsTarget
    );
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

  function clearDemoVisuals() {
    const ui = elements();

    clearNarrationOutlines();

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
    clearTimeout(autoAdvanceTimer);
    autoAdvanceTimer = 0;
    for (const timer of demoTimers) clearTimeout(timer);
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
      9231
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

  function bestVisibleVerticalReleaseSlot(preferredHost, preferredY) {
    const viewport = tourViewport();
    const visibleTop = tourHeaderBottom() + 52;
    const visibleBottom = viewport.bottom - 64;
    const hosts = [
      preferredHost,
      ...document.querySelectorAll(".drop-zone:not(.layout-row-drop-zone)"),
      document.querySelector("#builder-canvas")
    ].filter(
      (host, index, all) =>
        host instanceof HTMLElement &&
        all.indexOf(host) === index &&
        !host.closest(".node-pointer-ghost") &&
        !host.closest(".node-pointer-source")
    );

    const candidates = hosts.flatMap(host =>
      verticalInsertionSlots(host)
        .filter(slot =>
          slot.top >= visibleTop &&
          slot.top <= visibleBottom &&
          slot.left + slot.width >= viewport.left + 16 &&
          slot.left <= viewport.right - 16 &&
          !verticalSlotCrossesLiveContent(host, slot)
        )
        .map(slot => ({ host, slot }))
    );

    candidates.sort((left, right) => {
      const leftPreferred = left.host === preferredHost ? 0 : 1;
      const rightPreferred = right.host === preferredHost ? 0 : 1;
      return (
        leftPreferred - rightPreferred ||
        Math.abs(left.slot.top - preferredY) -
          Math.abs(right.slot.top - preferredY) ||
        left.slot.width - right.slot.width
      );
    });
    return candidates[0] || null;
  }

  function nativeVerticalReleaseMarkerSafety(
    expectedHost = null,
    expectedSlot = null
  ) {
    const marker = document.querySelector(".drag-reorder-placeholder");
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
    const viewport = tourViewport();
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
    const liveSlot = verticalInsertionSlots(host)
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
      rectangle.top >= tourHeaderBottom() + 40 &&
      rectangle.bottom <= viewport.bottom - 52 &&
      rectangle.left >= viewport.left + 4 &&
      rectangle.right <= viewport.right - 4
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

  function bestVerticalOutlineScene() {
    const candidates = [
      document.querySelector("#builder-canvas"),
      ...document.querySelectorAll(".drop-zone")
    ].filter(Boolean);
    const viewport = tourViewport();
    const viewportCenterY = viewport.top + viewport.height * .5;

    const scenes = candidates.flatMap(host => {
      const cards = directChildrenWithClass(host, "node-card")
        .filter(card => !card.classList.contains("node-pointer-ghost"));
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
      await new Promise(resolve => requestAnimationFrame(resolve));
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
    mouse.classList.add("active");
    mouse.style.setProperty("--mouse-x", `${point.x}px`);
    mouse.style.setProperty("--mouse-y", `${point.y}px`);
    const effectiveDuration = tourPresentationDuration(duration);
    mouse.style.setProperty("--mouse-duration", `${effectiveDuration}ms`);
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
    if (options.keepFocusVisible === true) {
      positionCardAwayFromPath(
        centerOf(focus, .08, .08),
        centerOf(focus, .92, .92)
      );
    } else {
      positionCard(focus);
    }
    const point = centerOf(element);
    setTourControlHighlight(element, true);
    if (label) showDemoLabel(label, point, element);

    try {
      if (!(await moveMouse(point, 440, runId))) {
        return false;
      }

      const activeDialog = element.closest("dialog[open]");
      if (activeDialog instanceof HTMLDialogElement) {
        const visibleAboveOverlay = tourDebugAssert(
          "teacher-mouse-visible-above-product-overlay",
          teacherMouseVisibleAboveDialog(activeDialog, element),
          {
            dialogId: activeDialog.id || "",
            target: tourPerceptionElementLabel(element),
            mouseRect: tourDebugRect(elements().mouse),
            targetRect: tourDebugRect(element),
            assistantMountedInsideDialog:
              activeDialog.contains(elements().root),
            liveSkipControlsInsideDialog:
              activeDialog.contains(elements().liveControls)
          }
        );
        if (!visibleAboveOverlay) {
          throw new Error(
            `[RML Tour] The teacher mouse was not visibly mounted above ${activeDialog.id || "the open product dialog"}.`
          );
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

      await new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
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
        const visibleAboveOverlay = tourDebugAssert(
          "teacher-mouse-visible-above-product-overlay",
          teacherMouseVisibleAboveDialog(activeDialog, element),
          {
            dialogId: activeDialog.id || "",
            target: tourPerceptionElementLabel(element),
            mouseRect: tourDebugRect(elements().mouse),
            targetRect: tourDebugRect(element),
            assistantMountedInsideDialog:
              activeDialog.contains(elements().root),
            interaction: "point-only"
          }
        );
        if (!visibleAboveOverlay) {
          throw new Error(
            `[RML Tour] The teacher mouse was not visibly mounted above ${activeDialog.id || "the open product dialog"}.`
          );
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
        await new Promise(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
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
        state.actions.scrollTo({ left: 0, behavior: "auto" });
        recentered = true;
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

    mobileTopbarPreparedForNarration =
      observation.passed === true;
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
    const after = responsiveTopActionsState(packButton);
    mobilePackPreparedForNarration = Boolean(
      opened.required &&
      after.open &&
      tourElementActuallyVisible(packButton)
    );
    const prepared = tourDebugAssert(
      "mobile-pack-hamburger-opened-before-pack-narration",
      mobilePackPreparedForNarration,
      {
        openedByTeacher: opened.openedByTeacher === true,
        actionsOpen: after.open,
        ariaExpanded: after.toggle?.getAttribute("aria-expanded") || "false",
        packButtonVisible: tourElementActuallyVisible(packButton),
        openedBeforeNarration: true
      }
    );
    if (!prepared) {
      throw new Error(
        "[RML Tour · Step 6] The compact Hamburger did not reveal Pack into Node before narration."
      );
    }
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
      mouse?.style.setProperty("--mouse-x", point.x + "px");
      mouse?.style.setProperty("--mouse-y", point.y + "px");
      mouse?.style.setProperty("--mouse-duration", "0ms");
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
      if (now - lastDragVectorAt >= 80) {
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
        await new Promise(resolve => requestAnimationFrame(resolve));
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
      if (!(await animateRoute(route, initialDuration))) return false;

      if (runId !== demoRunId) return false;

      const edgeHoldMs = Math.max(0, Number(options.edgeHoldMs) || 0);
      if (edgeHoldMs > 0) {
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
          await new Promise(resolve => requestAnimationFrame(resolve));
        }
        options.onEdgeHoldEnd?.();
      }

      if (runId !== demoRunId) return false;

      if (typeof options.afterEdgeHold === "function") {
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
        await new Promise(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
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
      await new Promise(resolve =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );
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

      mouse?.style.setProperty(
        "--mouse-x",
        `${point.x}px`
      );
      mouse?.style.setProperty(
        "--mouse-y",
        `${point.y}px`
      );
      mouse?.style.setProperty(
        "--mouse-duration",
        "0ms"
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

      await new Promise(resolve =>
        requestAnimationFrame(resolve)
      );
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
          "Tour",
          "Preview",
          "Project",
          "Export"
        ],
        reason:
          "There is no second point-only sweep. Only controls with a real Step 1 action are visited after narration."
      }
    );

    if (runId !== demoRunId) return;
    await runHelpWorkflowDemo(runId, { fromTopbar: true });
    if (runId !== demoRunId) return;
    await runGuideButtonWorkflowDemo(runId);
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

  async function teacherTypeInput(input, value, label, runId) {
    if (
      !(
        input instanceof HTMLInputElement ||
        input instanceof HTMLTextAreaElement
      ) ||
      runId !== demoRunId
    ) return;
    await nativeTourScrollTargetIntoView(input, runId);
    if (runId !== demoRunId) return;
    focusDemonstration(input.closest("label") || input, 14);
    positionCard(input.closest("label") || input);
    await teacherClickElement(input, label, runId);
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

  async function runGraphInspectorDemo(runId) {
    await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;
    const node = graphDemoFindNode(/(?:^|\s)NOT(?:\s|$)/i) ||
      document.querySelector(".rml-graph-node");
    if (!node) return;
    await teacherClickElement(
      node,
      "Select the real runtime node",
      runId
    );
    if (runId !== demoRunId) return;
    const inspector = document.querySelector(".rml-graph-inspector");
    const labelInput = inspector?.querySelector(".rml-graph-inspector-card input");
    if (labelInput) {
      await teacherTypeInput(
        labelInput,
        "Demo NOT",
        "Change the existing NOT node label in the real Node inspector",
        runId
      );
    }
    hideMouse();
  }

  async function runModeSwitchGraphDemo(runId) {
    await teacherSwitchGraphMode(true, runId);
    hideMouse();
  }

  async function runGuideButtonWorkflowDemo(runId) {
    const trigger = document.querySelector("#setup-guide-open");
    if (!trigger || runId !== demoRunId) return;
    const menu = await teacherEnsureResponsiveTopActionsOpen(
      trigger,
      "Open the responsive Hamburger menu before choosing Tour",
      runId
    );
    if (menu.required && !menu.open) return;
    if (!tourElementActuallyVisible(trigger)) return;

    const rootBefore = document.getElementById("rml-setup-assistant");
    const stepBefore = stepIndex;
    await teacherClickElement(
      trigger,
      "Use the real Tour button without starting a second assistant",
      runId
    );
    await wait(320);
    if (runId !== demoRunId) return;

    const rootAfter = document.getElementById("rml-setup-assistant");
    const reusedSafely = tourDebugAssert(
      "topbar-tour-button-demonstrated-inline-idempotently",
      rootBefore === rootAfter &&
        rootAfter?.hidden === false &&
        stepIndex === stepBefore &&
        stepPhase === "demonstrating",
      {
        openedInStepOne: true,
        sameAssistantRoot: rootBefore === rootAfter,
        stepBefore,
        stepAfter: stepIndex,
        phaseAfter: stepPhase
      }
    );
    if (!reusedSafely) {
      throw new Error(
        "[RML Tour · Step 1] The real Tour button did not safely reuse the already-running assistant."
      );
    }
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
        await teacherClickElement(
          shortcuts,
          "Shortcuts documents keyboard, mouse, Wheel and modifier gestures",
          runId
        );
        if (runId !== demoRunId) return;
        await wait(380);
      }

      if (nodes) {
        await teacherClickElement(
          nodes,
          "Nodes opens both Configuration Outline and Runtime Graph references",
          runId
        );
        if (runId !== demoRunId) return;
        await wait(420);
      }

      if (close) {
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
      (markerHost === canvas || canvas.contains(markerHost))
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
      typeof state.targetContainerId === "string" &&
      state.targetContainerId.length > 0 &&
      state.marker?.visible === true &&
      state.marker?.insideBuilderCanvas === true &&
      canvas instanceof HTMLElement &&
      canvas.contains(
        document.querySelector(
          ".drag-reorder-placeholder"
        )
      )
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
      await new Promise(resolve =>
        requestAnimationFrame(resolve)
      );
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
        onBeforeRelease: async ({ point }) => {
          const refreshed = outlinePaletteVisibleDropPoint(canvas, point);
          if (!refreshed) return null;
          if (Math.hypot(refreshed.x - point.x, refreshed.y - point.y) < 2) {
            return null;
          }
          return {
            point: refreshed,
            duration: 420
          };
        },
        releaseReady: point => {
          const contract = outlinePaletteReleaseContract(canvas, point);
          const controller =
            outlinePaletteAuthoritativeControllerState(
              canvas,
              9201
            );
          const releaseReady =
            contract.pointInViewport === true &&
            contract.pointInCanvas === true;
          tourDebugAssert(
            "outline-palette-release-point-resolved-before-commit",
            releaseReady,
            {
              requiresResponsiveScroll,
              point,
              controller: controller.state,
              domContractPassed: contract.passed,
              policy:
                "the visible release point must remain inside the real Outline canvas; controller arming is diagnostic because synthetic pointer capture is not a browser platform gesture"
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
    let nativeMarkerSampleCount = 0;
    let unsafeNativeMarkerSampleCount = 0;
    const nativeMarkerConstraintProofs = [];
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
    if (!tourTargetComfortablyVisible(source)) {
      throw new Error(
        "[RML Tour · Step 3] The prepared compact reorder source was no longer inside the visible page window."
      );
    }

    const hostRect = host.getBoundingClientRect();
    const pageScroller = document.scrollingElement || document.documentElement;
    const beforeScrollTop = pageScroller.scrollTop;
    const canScrollDown =
      beforeScrollTop < pageScroller.scrollHeight - pageScroller.clientHeight - 8;
    const viewport = tourViewport();
    const targetPoint = {
      x: hostRect.right - Math.max(38, Math.min(86, hostRect.width * .08)),
      y: canScrollDown
        ? viewport.bottom - 70
        : tourHeaderBottom() + 70
    };
    const preEdgePoint = {
      x: Math.max(
        hostRect.left + 34,
        Math.min(hostRect.right - 34, targetPoint.x)
      ),
      y: canScrollDown
        ? viewport.bottom - 128
        : tourHeaderBottom() + 128
    };
    const edgeScrollLimit = Math.max(
      96,
      Math.min(176, viewport.height * .18)
    );
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

    showDemoLabel(
      canScrollDown
        ? "Carry the real card through the Outline, then hold inside the glowing LOWER EDGE zone"
        : "Carry the real card through the Outline, then hold inside the glowing UPPER EDGE zone",
      targetPoint
    );
    await nativeUserPointerDrag(
      source,
      targetPoint,
      820,
      runId,
      9203,
      {
        pathPoints,
        stageFocusTarget: host,
        stageTarget: edgeStage,
        stageLabel: "EDGE AUTO-SCROLL · HOLD HERE",
        edgeHoldMs: 1100,
        edgeHoldMinMs: 160,
        onEdgeHoldStart: () => {
          elements().mouse?.classList.add("scrolling");
          showDemoLabel(
            canScrollDown
              ? "The animated wheel now marks a real LOWER-EDGE hold — the card remains grabbed"
              : "The animated wheel now marks a real UPPER-EDGE hold — the card remains grabbed",
            targetPoint
          );
        },
        onEdgeHoldEnd: () => {
          clampEdgeScrollPosition();
          edgeHoldScrollDelta = Math.abs(
            pageScroller.scrollTop - beforeScrollTop
          );
          elements().mouse?.classList.remove("scrolling");
        },
        onEdgeHoldFrame: clampEdgeScrollPosition,
        onPointerMarkerSample: sample => {
          if (sample.geometry?.orientation !== "horizontal") return;
          nativeMarkerSampleCount += 1;
          if (sample.clearOfControls !== true) {
            unsafeNativeMarkerSampleCount += 1;
            const proof = outlineMarkerCorridorProof(
              sample.host,
              sample.geometry
            );
            if (proof) nativeMarkerConstraintProofs.push(proof);
          }
        },
        edgeHoldUntil: () =>
          Math.abs(pageScroller.scrollTop - beforeScrollTop) >= 56,
        afterEdgeHold: async (edgePoint, dragContext) => {
          const liveViewport = tourViewport();
          const retreatPoint = {
            x: insideX,
            y: canScrollDown
              ? liveViewport.bottom - 138
              : tourHeaderBottom() + 138
          };
          dragContext?.dispatchMove?.(retreatPoint);
          await nextTwoFrames();

          let release = bestVisibleVerticalReleaseSlot(
            host,
            liveViewport.top + liveViewport.height * .62
          );

          if (!release) {
            const allSlots = verticalInsertionSlots(host);
            const desiredY = Math.max(
              tourHeaderBottom() + 84,
              Math.min(
                liveViewport.bottom - 96,
                liveViewport.top + liveViewport.height * .58
              )
            );
            const closest = allSlots.reduce(
              (best, current) =>
                !best || Math.abs(current.top - desiredY) < Math.abs(best.top - desiredY)
                  ? current
                  : best,
              null
            );
            if (closest) {
              pageScroller.scrollTop = Math.max(
                0,
                Math.min(
                  pageScroller.scrollHeight - pageScroller.clientHeight,
                  pageScroller.scrollTop + closest.top - desiredY
                )
              );
              dragContext?.dispatchMove?.(retreatPoint);
              await nextTwoFrames();
              release = bestVisibleVerticalReleaseSlot(host, desiredY);
            }
          }

          if (!release) {
            throw new Error(
              "[RML Tour · Step 3] No visible card-free Outline insertion gap remained after the bounded edge scroll."
            );
          }
          const finalSlot = release.slot;
          chosenReleaseHost = release.host;
          chosenReleaseSlot = {
            ...finalSlot,
            hostId: release.host.id || "",
            hostClasses: release.host.className || "",
            clearBeforeRelease: !verticalSlotCrossesLiveContent(
              release.host,
              finalSlot
            )
          };

          const point = {
            x: finalSlot.left + finalSlot.width * .5,
            y: finalSlot.top
          };
          const liveHostRect = release.host.getBoundingClientRect();
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
          let releasePoint = point;
          dispatchMove(releasePoint);
          await nextTwoFrames();
          let markerState = nativeVerticalReleaseMarkerSafety(
            chosenReleaseHost,
            chosenReleaseSlot
          );

          if (markerState.liveSlotRebased && markerState.effectiveSlot) {
            const rebasedSlot = markerState.effectiveSlot;
            releasePoint = {
              x: rebasedSlot.left + rebasedSlot.width * .5,
              y: rebasedSlot.top + Math.max(4, rebasedSlot.height || 4) * .5
            };
            chosenReleaseSlot = {
              ...rebasedSlot,
              hostId: chosenReleaseHost?.id || "",
              hostClasses: chosenReleaseHost?.className || "",
              clearBeforeRelease: true
            };
            dispatchMove(releasePoint);
            await nextTwoFrames();
            markerState = nativeVerticalReleaseMarkerSafety(
              chosenReleaseHost,
              chosenReleaseSlot
            );
          }

          if (!markerState.safe) {
            const rescue = bestVisibleVerticalReleaseSlot(
              chosenReleaseHost || host,
              point.y
            );
            if (rescue) {
              const rescuePoint = {
                x: rescue.slot.left + rescue.slot.width * .5,
                y: rescue.slot.top
              };
              chosenReleaseHost = rescue.host;
              chosenReleaseSlot = {
                ...rescue.slot,
                hostId: rescue.host.id || "",
                hostClasses: rescue.host.className || "",
                clearBeforeRelease: true
              };
              dispatchMove(rescuePoint);
              await nextTwoFrames();
              markerState = nativeVerticalReleaseMarkerSafety(
                rescue.host,
                rescue.slot
              );
              if (markerState.safe) {
                nativeReleaseVerified = true;
                nativeReleaseMarker = markerState.markerRect;
                nativeReleaseDetails = {
                  reason: markerState.reason,
                  hostId: markerState.hostId,
                  hostClasses: markerState.hostClasses,
                  expectedHostId: markerState.expectedHostId,
                  expectedHostClasses: markerState.expectedHostClasses,
                  centerDelta: markerState.centerDelta,
                  widthDelta: markerState.widthDelta,
                  hostMatched: markerState.hostMatched,
                  centerMatched: markerState.centerMatched,
                  widthMatched: markerState.widthMatched,
                  withinViewport: markerState.withinViewport,
                  clearOfControls: markerState.clearOfControls
                };
                chosenReleaseSlot.nativeMarker = markerState.markerRect;
                return { startPoint: rescuePoint };
              }
            }
          }

          nativeReleaseVerified = markerState.safe;
          nativeReleaseMarker = markerState.markerRect;
          nativeReleaseDetails = {
            reason: markerState.reason,
            hostId: markerState.hostId,
            hostClasses: markerState.hostClasses,
            expectedHostId: markerState.expectedHostId,
            expectedHostClasses: markerState.expectedHostClasses,
            centerDelta: markerState.centerDelta,
            widthDelta: markerState.widthDelta,
            hostMatched: markerState.hostMatched,
            centerMatched: markerState.centerMatched,
            widthMatched: markerState.widthMatched,
            withinViewport: markerState.withinViewport,
            clearOfControls: markerState.clearOfControls
          };
          if (chosenReleaseSlot) {
            chosenReleaseSlot.nativeMarker = markerState.markerRect;
          }
          return { startPoint: releasePoint };
        },
        commitHoldMs: 440
      }
    );
    elements().mouse?.classList.remove("scrolling");
    const cleanNativeMarkerTrajectory = tourDebugAssert(
      "outline-reorder-native-line-never-crossed-controls",
      nativeMarkerSampleCount >= 2 &&
        unsafeNativeMarkerSampleCount === 0,
      {
        sampleCount: nativeMarkerSampleCount,
        unsafeSampleCount: unsafeNativeMarkerSampleCount,
        constraintProofs: nativeMarkerConstraintProofs
      }
    );
    const boundedEdgeScroll = tourDebugAssert(
      "outline-reorder-bounded-edge-scroll",
      edgeHoldScrollDelta >= 32 &&
        edgeHoldScrollDelta <= edgeScrollLimit + 2,
      {
        delta: Math.round(edgeHoldScrollDelta),
        limit: Math.round(edgeScrollLimit),
        from: beforeScrollTop,
        current: pageScroller.scrollTop
      }
    );
    const releaseLineSafe = Boolean(
      chosenReleaseSlot &&
      chosenReleaseSlot.clearBeforeRelease === true &&
      nativeReleaseVerified === true
    );
    const releaseConstraintProof =
      !releaseLineSafe &&
      nativeReleaseDetails?.reason === "native-marker-crosses-control"
      ? outlineMarkerCorridorProof(
          chosenReleaseHost,
          nativeReleaseMarker
            ? {
                ...nativeReleaseMarker,
                orientation: "horizontal"
              }
            : null
        )
      : null;
    const releaseLineAccepted = tourDebugAssert(
      "outline-reorder-release-line-clear-of-controls",
      releaseLineSafe,
      {
        sampleCount: 1,
        unsafeSampleCount: releaseLineSafe ? 0 : 1,
        constraintProofs: releaseConstraintProof
          ? [releaseConstraintProof]
          : [],
        releaseSlot: chosenReleaseSlot,
        nativeMarkerRect: nativeReleaseMarker,
        nativeMarkerDetails: nativeReleaseDetails,
        hostRect: tourDebugRect(chosenReleaseHost || host)
      }
    );
    if (
      !cleanNativeMarkerTrajectory ||
      !boundedEdgeScroll ||
      !releaseLineAccepted
    ) {
      throw new Error(
        "[RML Tour · Step 3] The bounded edge scroll or its native release line violated the visible teaching contract."
      );
    }
    pulseAt(
      document.querySelector(".node-card.selected") || host,
      "rml-setup-demo-drop"
    );
    const scrollDelta = Math.round(pageScroller.scrollTop - beforeScrollTop);
    showDemoLabel(
      scrollDelta === 0
        ? "The item still returned from the edge zone to a concrete live insertion line"
        : `The real engine auto-scrolled ${Math.abs(scrollDelta)} px; the teacher then returned to the visible insertion line before releasing`,
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
      mouse?.style.setProperty("--mouse-x", `${point.x}px`);
      mouse?.style.setProperty("--mouse-y", `${point.y}px`);
      mouse?.style.setProperty("--mouse-duration", "0ms");
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
      generalChildren.join("|") === "Enabled|Scale" &&
        advancedChildren.join("|") === "Quality|DetailSection",
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
        releasedGeneralChildren.join("|") === "Enabled|Scale" &&
        releasedAdvancedChildren.join("|") === "Quality|DetailSection",
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
    runId
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
    for (let attempt = 0; attempt < 5 && runId === demoRunId; attempt += 1) {
      const before =
        window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(host);
      if (before?.accepted === true && before.index === desiredIndex) {
        await wait(150);
        return {
          reached: true,
          inspection: before,
          state: nativeSectionDragVisualState(general, host, heldPoint),
          attempts
        };
      }
      if (before?.accepted !== true || !Number.isFinite(before.index)) {
        dispatchNativeSectionPointer(
          sourceHeading,
          "pointermove",
          heldPoint,
          pointerId
        );
        await nextTwoFrames();
        attempts.push({ before, correctedByPerception: true });
        continue;
      }
      const direction = desiredIndex > before.index ? 1 : -1;
      const consumed = dispatchNativeHeldSectionWheel(
        host,
        heldPoint,
        direction
      );
      transaction.wheelDispatches += 1;
      transaction.wheelDirections.push(direction);
      await wait(220);
      const after =
        window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(host);
      if (
        after?.accepted === true &&
        Number.isFinite(after.index) &&
        after.index !== before.index
      ) {
        transaction.wheelTransitions.push(direction);
      }
      attempts.push({
        beforeIndex: before.index,
        direction,
        consumed,
        afterIndex: after?.index ?? null
      });
    }
    const inspection =
      window.RMLBuilderSetupBridge?.inspectHeldOptionHorizontal?.(host);
    return {
      reached: inspection?.accepted === true && inspection.index === desiredIndex,
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
      wheelDirections: [],
      wheelTransitions: [],
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
      generalChildren.join("|") === "Enabled|Scale" &&
        advancedChildren.join("|") === "Quality|DetailSection",
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
    if (!referenceUntouched || !perceptionReady) {
      throw new Error(
        "[RML Tour · Step 4] Live perception found no safe native controller target before PointerDown."
      );
    }

    const headingRect = sourceHeading.getBoundingClientRect();
    const startPoint = {
      x: headingRect.left + Math.min(92, headingRect.width * .28),
      y: headingRect.top + headingRect.height * .5
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
        outlineOptionDirectChildNames(releasedGeneral).join("|") === "Enabled|Scale" &&
        outlineOptionDirectChildNames(releasedAdvanced).join("|") === "Quality|DetailSection",
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

    const viewport = tourViewport();
    const targetFactors = [.22, .32, .5, .68, .78];
    const targetCandidates = targetFactors.map(factor => {
      const point = {
        x: middleSlot.left + middleSlot.width * factor,
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
        point.x >= viewport.left + 8 &&
        point.x <= viewport.right - 8 &&
        point.y >= tourHeaderBottom() + 40 &&
        point.y <= viewport.bottom - 52;
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
      targetCandidates
    };
  }

  async function frameOutlineNestedVerticalScene(runId) {
    let scene = outlineNestedVerticalScene();
    if (!scene) return null;

    const scroller = document.scrollingElement || document.documentElement;
    for (let attempt = 0; attempt < 4 && runId === demoRunId; attempt += 1) {
      scene = outlineNestedVerticalScene();
      if (!scene) return null;
      const viewport = tourViewport();
      const safeTop = tourHeaderBottom() + 44;
      const safeBottom = viewport.bottom - 56;
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
        return { ...scene, framed: true, attempts: attempt };
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
    const viewport = tourViewport();
    const headingRect = scene.sourceHeading.getBoundingClientRect();
    const allSlotsVisible = scene.slots.every(slot =>
      slot.top >= tourHeaderBottom() + 40 &&
      slot.top + Math.max(4, slot.height || 4) <= viewport.bottom - 52
    );
    return {
      ...scene,
      framed: Boolean(
        scene.target?.visible === true &&
        headingRect.top >= tourHeaderBottom() + 1 &&
        headingRect.bottom <= viewport.bottom - 1 &&
        allSlotsVisible
      ),
      attempts: 4
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
    runId,
    trace
  }) {
    for (let attempt = 0; attempt < 4 && runId === demoRunId; attempt += 1) {
      const before =
        window.RMLBuilderSetupBridge?.inspectHeldOptionContainer?.(
          scene.advancedDropZone
        );
      if (before?.accepted === true && before.index === desiredIndex) {
        await wait(150);
        const safety = nativeVerticalReleaseMarkerSafety(
          scene.advancedDropZone,
          scene.slots[desiredIndex]
        );
        const state = outlineNestedVerticalNativeState(scene, heldPoint);
        trace.push({ desiredIndex, attempt, before, after: before, safety, state });
        if (safety.safe) {
          return { reached: true, inspection: before, safety, state };
        }
        await nextTwoFrames();
        continue;
      }

      if (before?.accepted !== true || !Number.isFinite(before.index)) {
        window.RMLBuilderSetupBridge?.armHeldOptionContainer?.(
          scene.advancedDropZone,
          heldPoint.x,
          heldPoint.y
        );
        await nextTwoFrames();
        continue;
      }

      const direction = desiredIndex > before.index ? 1 : -1;
      const consumed = dispatchNativeHeldSectionWheel(
        scene.advancedDropZone,
        heldPoint,
        direction
      );
      await wait(230);
      await nextTwoFrames();
      const after =
        window.RMLBuilderSetupBridge?.inspectHeldOptionContainer?.(
          scene.advancedDropZone
        );
      const safety = nativeVerticalReleaseMarkerSafety(
        scene.advancedDropZone,
        scene.slots[desiredIndex]
      );
      const state = outlineNestedVerticalNativeState(scene, heldPoint);
      trace.push({
        desiredIndex,
        attempt,
        before,
        after,
        direction,
        consumed,
        safety,
        state
      });
      if (
        consumed &&
        after?.accepted === true &&
        after.index === desiredIndex &&
        safety.safe
      ) {
        return { reached: true, inspection: after, safety, state };
      }
    }

    const inspection =
      window.RMLBuilderSetupBridge?.inspectHeldOptionContainer?.(
        scene.advancedDropZone
      );
    return {
      reached: false,
      inspection,
      safety: nativeVerticalReleaseMarkerSafety(
        scene.advancedDropZone,
        scene.slots[desiredIndex]
      ),
      state: outlineNestedVerticalNativeState(scene, heldPoint)
    };
  }

  async function runOutlineVerticalAfterBuild259Horizontal(runId) {
    let scene = await frameOutlineNestedVerticalScene(runId);
    if (runId !== demoRunId) return false;

    const prepared = tourDebugAssert(
      "outline-nested-vertical-same-general-section-reacquired",
      Boolean(
        scene?.framed === true &&
        scene.lanes.map(outlineOptionLaneName).join("|") === "Advanced|General" &&
        outlineOptionDirectChildNames(scene.general).join("|") === "Enabled|Scale" &&
        outlineOptionDirectChildNames(scene.advanced).join("|") ===
          "Quality|DetailSection"
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
        scene?.target?.insideTarget === true &&
        scene.target.clearOfControl === true &&
        scene.target.visible === true &&
        scene.slots.indexOf(scene.middleSlot) === 1
      ),
      {
        target: scene?.target || null,
        middleSlot: scene?.middleSlot || null,
        slots: scene?.slots || [],
        candidates: scene?.targetCandidates || []
      }
    );
    if (!prepared || !arrowGapResolved) {
      throw new Error(
        "[RML Tour · Step 4] Live perception could not frame General and the real Quality/DetailSection insertion gap together."
      );
    }

    releaseSemanticScene();
    document.querySelectorAll("[data-setup-shade]").forEach(
      shade => shade.style.display = "none"
    );
    document.querySelectorAll(".rml-setup-demo-landing").forEach(
      guide => guide.remove()
    );
    if (elements().demoLabel) elements().demoLabel.hidden = true;

    scene = outlineNestedVerticalScene();
    if (!scene?.target) {
      throw new Error(
        "[RML Tour · Step 4] The live vertical target changed before PointerDown."
      );
    }
    const headingRect = scene.sourceHeading.getBoundingClientRect();
    const startPoint = {
      x: headingRect.left + Math.min(92, headingRect.width * .28),
      y: headingRect.top + headingRect.height * .5
    };
    const thresholdPoint = { x: startPoint.x + 8, y: startPoint.y };
    const heldPoint = { ...scene.target.point };
    const halfwayPoint = {
      x: startPoint.x + (heldPoint.x - startPoint.x) * .58,
      y: startPoint.y + (heldPoint.y - startPoint.y) * .58
    };
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

      let armed = null;
      for (let frame = 0; frame < 14 && runId === demoRunId; frame += 1) {
        dispatchNativeSectionPointer(
          scene.sourceHeading,
          "pointermove",
          heldPoint,
          pointerId
        );
        armed = window.RMLBuilderSetupBridge?.armHeldOptionContainer?.(
          scene.advancedDropZone,
          heldPoint.x,
          heldPoint.y
        );
        await waitForAnimationFrames(1);
        if (armed?.accepted === true && armed.index === 1) break;
      }
      await wait(150);
      await nextTwoFrames();

      const initialInspection =
        window.RMLBuilderSetupBridge?.inspectHeldOptionContainer?.(
          scene.advancedDropZone
        );
      const initialSafety = nativeVerticalReleaseMarkerSafety(
        scene.advancedDropZone,
        scene.middleSlot
      );
      const initialState = outlineNestedVerticalNativeState(scene, heldPoint);
      const nativeTargetArmed = tourDebugAssert(
        "outline-nested-vertical-native-arrow-target-armed",
        Boolean(
          armed?.accepted === true &&
          initialInspection?.accepted === true &&
          initialInspection.index === 1 &&
          initialSafety.safe &&
          initialState.ghost instanceof HTMLElement &&
          initialState.marker instanceof HTMLElement &&
          initialState.tourLandingGuideCount === 0
        ),
        { armed, initialInspection, initialSafety, initialState }
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
        runId,
        trace
      });
      await wait(620);
      const middleFromBelow = await outlineNestedWheelToVerticalIndex({
        desiredIndex: 1,
        scene,
        heldPoint,
        runId,
        trace
      });
      await wait(720);
      const up = await outlineNestedWheelToVerticalIndex({
        desiredIndex: 0,
        scene,
        heldPoint,
        runId,
        trace
      });
      await wait(620);
      const middleFromAbove = await outlineNestedWheelToVerticalIndex({
        desiredIndex: 1,
        scene,
        heldPoint,
        runId,
        trace
      });
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
          middleFromAbove.reached &&
          [down, middleFromBelow, up, middleFromAbove]
            .every(item => item.safety?.safe === true)
        ),
        { trace, down, middleFromBelow, up, middleFromAbove }
      );
      const pointerStationary = tourDebugAssert(
        "outline-nested-vertical-pointer-stationary-during-wheel",
        Boolean(
          mouseBeforeWheel &&
          mouseAfterWheel &&
          ghostBeforeWheel &&
          finalState.ghostRect &&
          Math.abs(mouseAfterWheel.x - mouseBeforeWheel.x) < .5 &&
          Math.abs(mouseAfterWheel.y - mouseBeforeWheel.y) < .5 &&
          Math.abs(finalState.ghostRect.left - ghostBeforeWheel.left) < .5 &&
          Math.abs(finalState.ghostRect.top - ghostBeforeWheel.top) < .5
        ),
        {
          heldPoint,
          mouseBeforeWheel,
          mouseAfterWheel,
          ghostBeforeWheel,
          ghostAfterWheel: finalState.ghostRect
        }
      );
      const nativeLineSafe = tourDebugAssert(
        "outline-nested-vertical-native-lines-card-free-without-endpoints",
        Boolean(
          trace.length >= 4 &&
          trace.every(item =>
            item.safety?.safe === true &&
            item.state?.markerRect?.width >= 24 &&
            item.state?.markerRect?.height <= 6 &&
            ["none", "normal", "\"\""].includes(
              item.state?.markerBeforeContent
            ) &&
            ["none", "normal", "\"\""].includes(
              item.state?.markerAfterContent
            ) &&
            item.state?.tourLandingGuideCount === 0
          )
        ),
        { trace }
      );

      completed = journeyComplete && pointerStationary && nativeLineSafe;
      if (!completed) {
        throw new Error(
          "[RML Tour · Step 4] The native vertical wheel journey, stationary pointer or line safety contract failed."
        );
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
          heldPoint,
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
        outlineOptionDirectChildNames(restoredScene.general).join("|") ===
          "Enabled|Scale" &&
        outlineOptionDirectChildNames(restoredScene.advanced).join("|") ===
          "Quality|DetailSection" &&
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

  function graphDemoError(message, details = null) {
    const error = new Error(`[RML Tour · Graph demo] ${message}`);
    error.details = details;
    if (details !== null) {
      console.warn(error.message, details);
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

    if (!source?.geometricVisible && tourPageRootCanHelpTarget(item)) {
      graphPaletteRevealState.phase = "reveal-palette-in-page";
      pageScrollRepaired = await nativeTourScrollTargetIntoView(item, runId);
      await nextTwoFrames();
      if (runId !== demoRunId) return null;
      item = paletteRoot.querySelector(selector);
      source = graphPaletteSourceHitPoint(item, scroll, 3);
    }
    const scrollTopBefore = scroll.scrollTop;
    let wheelSteps = 0;
    let directScrollRepairs = 0;

    if (!source?.geometricVisible) {
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
        tourDebugRecord("graph-create-node-reveal-progress", {
          operatorId,
          step: index,
          steps,
          requestedTop,
          actualTop: scroll.scrollTop,
          directHit: source?.directHit === true,
          geometricVisible: source?.geometricVisible === true
        });
        if (source?.geometricVisible === true) break;
      }
      elements().mouse?.classList.remove("scrolling");
    }

    item = paletteRoot.querySelector(selector);
    source = graphPaletteSourceHitPoint(item, scroll, 2);
    const elapsedMs = Math.round(performance.now() - revealStarted);
    const complete = Boolean(
      item &&
      !item.disabled &&
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
      itemRect: tourDebugRect(item)
    };
    const revealComplete = tourDebugAssert(
      "graph-create-node-reveal-state-machine-complete",
      complete && elapsedMs < 2600,
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
      await new Promise(resolve => requestAnimationFrame(resolve));
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
        mouse?.style.setProperty("--mouse-x", `${point.x}px`);
        mouse?.style.setProperty("--mouse-y", `${point.y}px`);
        mouse?.style.setProperty("--mouse-duration", "0ms");
        header.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
          isPrimary: true, button: -1, buttons: 1, clientX: point.x, clientY: point.y
        }));
        if (raw >= 1) break;
        await new Promise(resolve => requestAnimationFrame(resolve));
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
      mouse?.style.setProperty("--mouse-x", `${point.x}px`);
      mouse?.style.setProperty("--mouse-y", `${point.y}px`);
      mouse?.style.setProperty("--mouse-duration", "0ms");
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
      await new Promise(resolve => requestAnimationFrame(resolve));
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

    const resolveTargetPoint = () =>
      targetTarget instanceof Element
        ? centerOf(targetTarget)
        : targetTarget;
    const initialTargetPoint =
      resolveTargetPoint();
    const from = centerOf(startElement);
    const { mouse } = elements();
    let pointerIsDown = false;
    let previewObserved = false;
    let guidedConnectionDropState = null;
    const graphHost =
      window.RMLDynamicGraphHost;

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

    await moveMouse(from, 360, runId);
    if (runId !== demoRunId) return false;

    await wait(180);
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
      mouse?.classList.add(
        "active",
        "pressed"
      );

      await wait(100);
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
          resolveTargetPoint();
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

        mouse?.style.setProperty(
          "--mouse-x",
          `${point.x}px`
        );
        mouse?.style.setProperty(
          "--mouse-y",
          `${point.y}px`
        );
        mouse?.style.setProperty(
          "--mouse-duration",
          "0ms"
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
        await new Promise(resolve =>
          requestAnimationFrame(resolve)
        );
      }

      if (runId !== demoRunId) {
        return false;
      }

      const finalTargetPoint =
        resolveTargetPoint();

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
      await new Promise(resolve =>
        requestAnimationFrame(() =>
          requestAnimationFrame(resolve)
        )
      );

      guidedConnectionDropState =
        graphHost
          ?.getGuidedConnectionDropState?.() ||
        null;
      tourDebugRecord(
        "graph-guided-connection-drop-result",
        {
          pointerId,
          graphHostVersion:
            Number(graphHost?.version || 0),
          previewObserved,
          guidedConnectionDropState
        }
      );

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
      nodePadding = 10,
      pointClearance = 22,
      endpointNodeAllowance = 28
    } = {}
  ) {
    const ignoredPathSet = new Set(ignoredPaths.filter(Boolean));
    const ignoredPointSet = new Set(ignoredPoints.filter(Boolean));
    const nodes = [...document.querySelectorAll(".rml-graph-node")]
      .filter(graphDemoVisible);
    const routePoints = [...document.querySelectorAll(".rml-graph-wire-point")]
      .filter(routePoint =>
        graphDemoVisible(routePoint) &&
        !ignoredPointSet.has(routePoint)
      );
    const distance = Math.hypot(to.x - from.x, to.y - from.y);
    const samples = Math.max(28, Math.ceil(distance / 8));
    let nodeBlocked = false;

    for (const node of nodes) {
      const rect = node.getBoundingClientRect();
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
        while (first <= last && inside[first]) first += 1;
        const leadingDistance = distance * (first / samples);
        if (leadingDistance > endpointNodeAllowance) {
          nodeBlocked = true;
          break;
        }
      }
      if (last === samples) {
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
      requiredPointClearance: pointClearance
    };
  }

  function graphDemoPathNodeOcclusion(
    path,
    {
      nodePadding = 6,
      endpointNodeAllowance = 28
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
    for (const node of [...document.querySelectorAll(".rml-graph-node")]
      .filter(graphDemoVisible)) {
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
        while (first <= last && inside[first]) first += 1;
        if (length * (first / samples) > endpointNodeAllowance) {
          blockedNodeIds.push(node.dataset.graphNodeId || "");
          continue;
        }
      }
      if (last === samples) {
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
      endpointNodeAllowance
    };
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
            sourceNode ? [sourceNode] : []
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
    const ignoredPaths = [
      path,
      ...ignoredElements.filter(element =>
        element?.matches?.(".rml-graph-wire-hit")
      )
    ].filter(Boolean);

    for (let fraction = .12; fraction <= .88; fraction += .02) {
      const point = graphSvgPathPoint(path, fraction);
      const pointAnalysis = graphDemoPointRouteAnalysis(
        point,
        { ignoredPaths }
      );
      const routeAnalysis = graphDemoRouteSegmentAnalysis(
        targetPoint,
        point,
        { ignoredPaths }
      );
      const priority = graphDemoRouteCandidateTier(
        pointAnalysis,
        [routeAnalysis]
      );
      const distance = Math.hypot(
        point.x - targetPoint.x,
        point.y - targetPoint.y
      );

      candidates.push({
        point,
        fraction,
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

    candidates.sort((a, b) =>
      a.priority.tier - b.priority.tier ||
      b.score - a.score
    );
    const best = candidates[0];
    const fallback = graphSvgPathPoint(path, .55);
    const result = best?.point || fallback;
    result.tourRouteAnalysis = {
      kind: "junction",
      candidateCount: candidates.length,
      selectedFraction: best?.fraction ?? .55,
      selectedTier: best?.priority.tier ?? 4,
      selectedPriority: best?.priority || null,
      pointAnalysis: best?.pointAnalysis || null,
      routeAnalysis: best?.routeAnalysis || null,
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
      )
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

      await new Promise(resolve =>
        requestAnimationFrame(resolve)
      );
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
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    return null;
  }

  function graphNativeWireHit(connectionId) {
    if (!connectionId) return null;
    return [...document.querySelectorAll(".rml-graph-wire-hit")].find(
      hit => {
        if (
          hit.dataset.connectionId !==
          connectionId ||
          typeof hit.getTotalLength !==
            "function"
        ) {
          return false;
        }
        let length = 0;
        try {
          length = hit.getTotalLength();
        } catch {
          return false;
        }
        if (length <= 2) return false;
        const visible =
          visibleGraphClientRect(2);
        const point =
          graphSvgPathPoint(hit, .5);
        return Boolean(
          visible &&
          point.x >= visible.left &&
          point.x <= visible.right &&
          point.y >= visible.top &&
          point.y <= visible.bottom
        );
      }
    ) || null;
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
      await new Promise(resolve =>
        requestAnimationFrame(resolve)
      );
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
      window.RMLDynamicGraphHost
        ?.fitNodesToClientRect?.(
          nodeIds,
          visible,
          {
            padding: 36,
            maxScale: 1.05
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

    const usable = () => {
      const visible =
        visibleGraphClientRect(0);
      return Boolean(
        visible &&
        visible.width >= 280 &&
        visible.height >=
          graphLessonMinimumVisibleHeight()
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
    const visible = visibleGraphClientRect(
      Number.isFinite(options.inset) ? options.inset : 24
    );
    if (!visible || visible.width < 120 || visible.height < 120) {
      return false;
    }
    const fitted = window.RMLDynamicGraphHost
      ?.fitNodesToClientRect?.(
        [...new Set((nodeIds || []).filter(Boolean))],
        visible,
        {
          padding: Number.isFinite(options.padding) ? options.padding : 34,
          maxScale: Number.isFinite(options.maxScale) ? options.maxScale : 1.05
        }
      );
    return fitted?.ok === true;
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

    const planned = host.fitNodesToClientRect?.(
      [...new Set((nodeIds || []).filter(Boolean))],
      visible,
      {
        padding: Number.isFinite(options.padding) ? options.padding : 30,
        maxScale: Number.isFinite(options.maxScale) ? options.maxScale : 1.02,
        apply: false
      }
    );
    const to = planned?.viewport || null;
    if (planned?.ok !== true || !to) return false;

    const distance = Math.max(
      Math.abs(Number(to.x) - Number(from.x)),
      Math.abs(Number(to.y) - Number(from.y)),
      Math.abs(Number(to.scale) - Number(from.scale)) * 420
    );
    if (distance <= .02) {
      return host.setViewportState?.(to)?.ok === true;
    }

    const duration = Math.max(
      260,
      Math.min(900, Number(options.duration) || 620)
    );
    const started = performance.now();
    tourDebugRecord("graph-natural-frame-animation-start", {
      nodeIds,
      from,
      to,
      duration
    });

    await new Promise(resolve => {
      const frame = now => {
        if (runId !== demoRunId) {
          resolve();
          return;
        }
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
        if (raw >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    });

    if (runId !== demoRunId) return false;
    const committed = host.setViewportState?.(to, { persist: true });
    await nextTwoFrames();
    tourDebugRecord("graph-natural-frame-animation-end", {
      nodeIds,
      committed,
      viewport: host.getViewportState?.()?.viewport || null
    });
    return committed?.ok === true;
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
    let pair = graphDemoSocketPair(false);
    if (!pair.output || !pair.input) return pair;

    if (!graphTeachingPairCompletelyVisible(pair, 18)) {
      quietlyFitGraphNodes(
        [
          pair.boolNode?.dataset.graphNodeId,
          pair.notNode?.dataset.graphNodeId
        ],
        { inset: 24, padding: 34, maxScale: 1.05 }
      );
      await nextTwoFrames();
      pair = graphDemoSocketPair(false);
    }

    if (
      !pair.output ||
      !pair.input ||
      !graphTeachingElementInsideViewport(pair.output, 12) ||
      !graphTeachingElementInsideViewport(pair.input, 12)
    ) {
      graphDemoError(
        "The complete cable scene cannot be made visible without hiding an endpoint."
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

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

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

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

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

  async function runGraphRouteDemo(runId) {
    const viewport =
      document.querySelector(
        ".rml-graph-viewport"
      );
    const graphHost =
      window.RMLDynamicGraphHost;

    if (!viewport || runId !== demoRunId) {
      return;
    }

    const guidedGraphHostReady = tourDebugAssert(
      "graph-route-guided-automatic-helper-suppression-available",
      Number(graphHost?.version || 0) >= 14 &&
        typeof graphHost
          ?.setGuidedAutomaticNodeCreationSuppressed ===
          "function" &&
        typeof graphHost
          ?.getGuidedConnectionDropState ===
          "function",
      {
        graphHostVersion:
          Number(graphHost?.version || 0),
        suppressionSetterAvailable:
          typeof graphHost
            ?.setGuidedAutomaticNodeCreationSuppressed ===
          "function",
        dropStateAvailable:
          typeof graphHost
            ?.getGuidedConnectionDropState ===
          "function"
      }
    );
    if (!guidedGraphHostReady) {
      graphDemoError(
        "Routing step requires Runtime Graph host version 14 with guided automatic-helper suppression."
      );
    }

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

    const realHits = () =>
      [...document.querySelectorAll(
        ".rml-graph-wire-hit"
      )].filter(graphDemoVisible);

    const pair =
      await ensureGraphDemoNodes(runId);

    if (runId !== demoRunId) return;

    await ensureGraphTeachingPairVisible(runId);
    if (runId !== demoRunId) return;

    const freshPair = graphDemoSocketPair(false);
    const output =
      freshPair?.output ||
      pair?.output ||
      graphDemoSocketPair(false).output;
    const input =
      freshPair?.input ||
      pair?.input ||
      graphDemoSocketPair(false).input;

    let baseConnection =
      graphDemoConnectionFor(
        output,
        input
      );

    if (!baseConnection && output && input) {
      showDemoLabel(
        "Create the base wire through the normal Graph Engine",
        centerOf(output)
      );

      await nativeGraphPointerDrag(
        output,
        input,
        1180,
        runId,
        9111
      );

      if (runId !== demoRunId) return;

      const guaranteed =
        await ensureGraphConnectionDeterministic(
          output,
          input,
          runId
        );
      baseConnection =
        guaranteed?.connection || null;
    }

    if (!baseConnection) {
      console.warn(
        "[RML Tour · Graph demo] The normal Graph Engine could not create the base wire; the assistant remains usable."
      );
      showDemoLabel(
        "Base wire is temporarily unavailable; this lesson will continue forward without repeating",
        centerOf(viewport)
      );
      await wait(850);
      return;
    }

    let parentHit =
      graphNativeWireHit(
        baseConnection.id
      );

    if (!parentHit) {
      await new Promise(resolve =>
        requestAnimationFrame(() =>
          requestAnimationFrame(resolve)
        )
      );
      parentHit =
        graphNativeWireHit(
          baseConnection.id
        );
    }

    if (!parentHit) {
      graphDemoError(
        "Routing step could not find the real base-wire hit path after native creation."
      );
    }

    const outputType = String(output?.dataset.concreteType || "")
      .trim()
      .toLowerCase();
    const baseTargetId = input?.dataset.nodeId || "";
    const graphState = window.RMLDynamicGraphHost?.getState?.();
    const occupiedInputs = new Set(
      (graphState?.connections || []).map(connection =>
        `${connection.toNode}:${connection.toPort}`
      )
    );
    const reusableBranchNode = [
      ...document.querySelectorAll(".rml-graph-node")
    ].find(node => {
      const nodeId = node.dataset.graphNodeId || "";
      if (
        !nodeId ||
        nodeId === baseTargetId ||
        !/(?:^|\s)NOT(?:\s|$)/i.test(graphDemoNodeTitle(node))
      ) return false;
      return [...node.querySelectorAll(
        '.rml-graph-socket[data-direction="input"]'
      )].some(socket =>
        graphDemoVisible(socket) &&
        String(socket.dataset.concreteType || "").trim().toLowerCase() === outputType &&
        !occupiedInputs.has(`${nodeId}:${socket.dataset.portId || ""}`)
      );
    }) || null;

    let branchNode =
      document.querySelector(
        '.rml-graph-node[data-rml-tour-step10-branch="true"]'
      ) || reusableBranchNode;

    if (branchNode === reusableBranchNode && branchNode) {
      branchNode.dataset.rmlTourStep10Branch = "true";
      showDemoLabel(
        "Reuse this existing compatible branch target — no duplicate node needed",
        centerOf(branchNode)
      );
      await wait(520);
      if (runId !== demoRunId) return;
    }

    if (!branchNode) {
      const paletteNot =
        await teacherRevealRuntimeGraphPaletteItem("logic.not", runId);

      const beforeIds = new Set([
        ...[...document.querySelectorAll(
          ".rml-graph-node"
        )].map(
          node =>
            node.dataset.graphNodeId
        ),
        ...(window.RMLDynamicGraphHost
          ?.getState?.()
          ?.nodes || []).map(node => node.id)
      ].filter(Boolean));

      const branchDropPoint =
        graphDemoSafeEmptyDropPoint(
          viewport,
          paletteNot
            ? centerOf(paletteNot)
            : centerOf(viewport),
          {
            prefer: "right",
            reserveWidth: 310,
            reserveHeight: 190
          }
        );

      if (paletteNot) {
        showDemoLabel(
          "Create the branch node through the normal palette engine",
          centerOf(paletteNot)
        );

        await nativeUserPointerDrag(
          paletteNot,
          branchDropPoint,
          1050,
          runId,
          9213
        );
      }

      const nativeCommitState =
        window.RMLDynamicGraphHost
          ?.getGuidedPaletteDropState?.() || null;
      const committedNodeId =
        nativeCommitState?.ok === true &&
        nativeCommitState?.operatorId === "logic.not" &&
        nativeCommitState?.pointerId === 9213 &&
        nativeCommitState?.wasDragging === true
          ? nativeCommitState.nodeId || ""
          : "";

      const resolveStateBranchId = () => {
        if (committedNodeId) return committedNodeId;
        const state =
          window.RMLDynamicGraphHost
            ?.getState?.();
        return state?.nodes?.find(
          node =>
            !beforeIds.has(node.id) &&
            node.kind === "operator" &&
            node.operatorId === "logic.not"
        )?.id || "";
      };

      let stateBranchId = "";
      for (let frame = 0; frame < 40; frame += 1) {
        await new Promise(resolve =>
          requestAnimationFrame(resolve)
        );
        if (runId !== demoRunId) return;

        stateBranchId = resolveStateBranchId();
        branchNode = stateBranchId
          ? document.querySelector(
              `.rml-graph-node[data-graph-node-id="${CSS.escape(stateBranchId)}"]`
            )
          : null;
        branchNode ||= [...document.querySelectorAll(
          ".rml-graph-node"
        )].find(
          node =>
            !beforeIds.has(
              node.dataset.graphNodeId
            ) &&
            /^NOT$/i.test(
              graphDemoNodeTitle(node)
            )
        ) || null;
        if (branchNode) break;
      }

      if (!branchNode && stateBranchId) {
        graphDemoError(
          "The palette-created branch node exists in graph state but is not rendered.",
          {
            nodeId: stateBranchId,
            nativeCommitState
          }
        );
      }

      if (!branchNode) {
        const state =
          window.RMLDynamicGraphHost
            ?.getState?.();
        const graphViewport =
          state?.viewport || {
            x: 0,
            y: 0,
            scale: 1
          };
        const viewportRect =
          viewport.getBoundingClientRect();
        const graphPoint = {
          x:
            (branchDropPoint.x -
              viewportRect.left -
              graphViewport.x) /
            Math.max(.001, graphViewport.scale),
          y:
            (branchDropPoint.y -
              viewportRect.top -
              graphViewport.y) /
            Math.max(.001, graphViewport.scale)
        };
        const forced =
          window.RMLDynamicGraphHost
            ?.ensureOperatorNode?.(
              "logic.not",
              {
                allowDuplicate: true,
                x: graphPoint.x - 140,
                y: graphPoint.y - 90
              }
            );
        if (!forced?.ok) {
          graphDemoError(
            "Routing step could not create its branch NOT node through either engine path.",
            forced
          );
        }
        await nextTwoFrames();
        branchNode =
          document.querySelector(
            `.rml-graph-node[data-graph-node-id="${CSS.escape(forced.nodeId)}"]`
          );
      }

      if (!branchNode) {
        graphDemoError(
          "The branch node exists in graph state but is not rendered."
        );
      }

      branchNode.dataset.rmlTourStep10Branch =
        "true";
    }

    const routePlacementSource =
      graphSvgPathPoint(parentHit, .58);
    let branchRect =
      branchNode.getBoundingClientRect();
    let desiredBranchCenter =
      graphDemoSafeEmptyDropPoint(
        viewport,
        routePlacementSource,
        {
          prefer: "right",
          reserveWidth:
            Math.max(310, branchRect.width + 54),
          reserveHeight:
            Math.max(190, branchRect.height + 48),
          allowOccupiedFallback: false,
          ignoredNodes: [branchNode],
          returnNullWhenUnavailable: true
        }
      );

    let resizedForPlacement = false;
    if (!desiredBranchCenter) {
      resizedForPlacement =
        await nativeGraphNodeResizeTowardMinimum(
          branchNode,
          runId
        );
      if (runId !== demoRunId) return;
      if (resizedForPlacement) {
        const resizedId = branchNode.dataset.graphNodeId || "";
        branchNode = document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(resizedId)}"]`
        ) || branchNode;
        branchNode.dataset.rmlTourStep10Branch = "true";
        branchRect = branchNode.getBoundingClientRect();
        desiredBranchCenter = graphDemoSafeEmptyDropPoint(
          viewport,
          routePlacementSource,
          {
            prefer: "right",
            reserveWidth: Math.max(310, branchRect.width + 54),
            reserveHeight: Math.max(190, branchRect.height + 48),
            allowOccupiedFallback: false,
            ignoredNodes: [branchNode],
            returnNullWhenUnavailable: true
          }
        );
      }
    }

    if (!desiredBranchCenter) {
      desiredBranchCenter = graphDemoSafeEmptyDropPoint(
        viewport,
        routePlacementSource,
        {
          prefer: "right",
          reserveWidth: Math.max(310, branchRect.width + 54),
          reserveHeight: Math.max(190, branchRect.height + 48),
          ignoredNodes: [branchNode]
        }
      );
    }

    showDemoLabel(
      "Move the second NOT with the normal node-drag engine",
      centerOf(branchNode)
    );

    await nativeGraphNodeDrag(
      branchNode,
      desiredBranchCenter,
      560,
      runId
    );

    if (runId !== demoRunId) return;

    const branchId =
      branchNode.dataset.graphNodeId;

    branchNode =
      document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(branchId)}"]`
      ) || branchNode;

    branchNode.dataset.rmlTourStep10Branch =
      "true";

    if (!graphTeachingElementInsideViewport(branchNode, 10)) {
      const corrected =
        window.RMLDynamicGraphHost
          ?.setNodeClientCenter?.(
            branchId,
            desiredBranchCenter.x,
            desiredBranchCenter.y
          );
      if (!corrected?.ok) {
        graphDemoError(
          "Routing step could not keep its branch node inside the visible graph viewport.",
          corrected
        );
      }
      await nextTwoFrames();
      branchNode =
        document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(branchId)}"]`
        ) || branchNode;
      branchNode.dataset.rmlTourStep10Branch =
        "true";
    }

    if (!graphTeachingElementInsideViewport(branchNode, 6)) {
      graphDemoError(
        "Routing step branch node remained outside the usable graph viewport after verified placement.",
        {
          node: tourDebugRect(branchNode),
          visibleGraph: visibleGraphClientRect(0),
          desiredBranchCenter
        }
      );
    }

    parentHit = graphNativeWireHit(baseConnection.id) || parentHit;
    let placedWireAnalysis = graphDemoRectWireAnalysis(
      branchNode.getBoundingClientRect(),
      {
        clearance: 16,
        paths: parentHit ? [parentHit] : []
      }
    );
    let wireClearAlternative = graphDemoSafeEmptyDropPoint(
      viewport,
      routePlacementSource,
      {
        prefer: "right",
        reserveWidth: Math.max(
          310,
          branchNode.getBoundingClientRect().width + 54
        ),
        reserveHeight: Math.max(
          190,
          branchNode.getBoundingClientRect().height + 48
        ),
        allowOccupiedFallback: false,
        ignoredNodes: [branchNode],
        returnNullWhenUnavailable: true
      }
    );

    if (placedWireAnalysis.blocked && wireClearAlternative) {
      const corrected = window.RMLDynamicGraphHost?.setNodeClientCenter?.(
        branchId,
        wireClearAlternative.x,
        wireClearAlternative.y
      );
      if (!corrected?.ok) {
        graphDemoError(
          "Routing step found a wire-clear placement but could not commit it after responsive reflow.",
          corrected
        );
      }
      await nextTwoFrames();
      branchNode = document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(branchId)}"]`
      ) || branchNode;
      branchNode.dataset.rmlTourStep10Branch = "true";
      parentHit = graphNativeWireHit(baseConnection.id) || parentHit;
      placedWireAnalysis = graphDemoRectWireAnalysis(
        branchNode.getBoundingClientRect(),
        {
          clearance: 16,
          paths: parentHit ? [parentHit] : []
        }
      );
    }

    const unavoidableWireOverlap = Boolean(
      placedWireAnalysis.blocked && !wireClearAlternative
    );
    const wireClearPlacementVerified = tourDebugAssert(
      "graph-route-node-body-clear-of-existing-wire-when-space-available",
      placedWireAnalysis.blocked === false || unavoidableWireOverlap,
      {
        nodeId: branchId,
        nodeRect: tourDebugRect(branchNode),
        existingWireId: baseConnection.id,
        wireAnalysis: placedWireAnalysis,
        wireClearAlternativeAvailable: Boolean(wireClearAlternative),
        resizedForPlacement,
        unavoidableAtCurrentMinimumGeometry: unavoidableWireOverlap,
        policy:
          "the complete rendered node rectangle, not only its pointer centre, must keep a 16px clearance from every pre-existing wire whenever a fully visible collision-free placement exists"
      }
    );
    if (!wireClearPlacementVerified) {
      graphDemoError(
        "Routing step placed a node body on an existing wire although a collision-free position was available.",
        {
          node: tourDebugRect(branchNode),
          wireAnalysis: placedWireAnalysis,
          wireClearAlternative
        }
      );
    }

    const resolveLiveBranchInput = () => {
      branchNode =
        document.querySelector(
          `.rml-graph-node[data-graph-node-id="${CSS.escape(branchId)}"]`
        ) || branchNode;
      branchNode.dataset.rmlTourStep10Branch =
        "true";
      const inputs =
        [...branchNode.querySelectorAll(
          '.rml-graph-socket[data-direction="input"]'
        )];
      return (
        inputs.find(socket =>
          graphDemoVisible(socket) &&
          graphTeachingElementInsideViewport(
            socket,
            2
          )
        ) ||
        inputs.find(graphDemoVisible) ||
        null
      );
    };

    let branchInput =
      resolveLiveBranchInput();

    if (!branchInput) {
      graphDemoError(
        "Routing step branch node has no visible input socket."
      );
    }

    parentHit =
      graphNativeWireHit(
        baseConnection.id
      ) || parentHit;

    const routeAnchor =
      graphSvgPathPoint(parentHit, .58);
    const liveBranchRect =
      branchNode.getBoundingClientRect();
    const currentInputPoint =
      centerOf(branchInput);
    const inputOnWrongSide =
      (
        routeAnchor.x < liveBranchRect.left &&
        currentInputPoint.x > liveBranchRect.left + liveBranchRect.width * .5
      ) ||
      (
        routeAnchor.x > liveBranchRect.right &&
        currentInputPoint.x < liveBranchRect.left + liveBranchRect.width * .5
      );

    if (inputOnWrongSide) {
      const flip =
        branchNode.querySelector(".rml-graph-node-flip");
      if (flip) {
        await teacherClickElement(
          flip,
          "Flip the real ports so the new branch does not run behind its node",
          runId
        );
        if (runId !== demoRunId) return;

        branchNode =
          document.querySelector(
            '.rml-graph-node[data-rml-tour-step10-branch="true"]'
          ) || branchNode;
        await nextTwoFrames();
        branchInput =
          resolveLiveBranchInput();
      }
    }

    await nextTwoFrames();
    branchInput = resolveLiveBranchInput();
    parentHit =
      graphNativeWireHit(
        baseConnection.id
      ) || parentHit;

    if (
      !branchInput ||
      !graphTeachingElementInsideViewport(
        branchInput,
        2
      ) ||
      !parentHit
    ) {
      quietlyFitGraphNodes(
        [
          ...graphTeachingNodeIdsFromState(),
          branchId
        ],
        {
          inset: 20,
          padding: 24,
          maxScale:
            window.innerWidth < 820
              ? .82
              : 1.02
        }
      );
      await nextTwoFrames();
      branchInput =
        resolveLiveBranchInput();
      parentHit =
        graphNativeWireHit(
          baseConnection.id
        );
    }

    if (
      !branchInput ||
      !branchInput.isConnected ||
      !graphTeachingElementInsideViewport(
        branchInput,
        2
      ) ||
      !parentHit
    ) {
      graphDemoError(
        "Routing step could not resolve a live, visible branch input and base wire immediately before pointerdown.",
        {
          branchNode:
            tourDebugRect(branchNode),
          branchInput:
            tourDebugRect(branchInput),
          connected:
            Boolean(branchInput?.isConnected),
          visibleGraph:
            visibleGraphClientRect(0),
          baseWireVisible:
            Boolean(parentHit)
        }
      );
    }

    const inputPoint =
      centerOf(branchInput);
    const junctionTarget =
      graphDemoBestWirePoint(
        parentHit,
        inputPoint,
        [branchNode]
      );
    const junctionPlan =
      junctionTarget.tourRouteAnalysis || {};
    const junctionPlanVerified = tourDebugAssert(
      "graph-route-junction-target-prioritizes-visible-points-before-line-overlap",
      (
        junctionPlan.perfectAvailable !== true ||
        junctionPlan.selectedTier === 0
      ) &&
      (
        junctionPlan.pointProtectedAvailable !== true ||
        junctionPlan.selectedPriority?.pointProtected === true
      ) &&
      (
        junctionPlan.nodeClearPointAvailable !== true ||
        junctionPlan.selectedPriority?.pointNodeClear === true
      ) &&
      (
        junctionPlan.pointProtectedNodeClearRouteAvailable !== true ||
        (
          junctionPlan.selectedPriority?.pointProtected === true &&
          junctionPlan.selectedPriority?.routeNodeBlocked === false
        )
      ),
      {
        junctionTarget,
        junctionPlan,
        policy:
          "choose a fully clear junction first; if every line route conflicts, keep the visible junction point clear; allow a point below a node only when no node-clear point exists"
      }
    );
    if (!junctionPlanVerified) {
      graphDemoError(
        "Routing step did not choose the highest available visibility class for the junction.",
        { junctionTarget, junctionPlan }
      );
    }

    showDemoLabel(
      "Drag this REAL input onto the REAL existing wire",
      inputPoint
    );

    const branchEndpoint =
      graphSocketEndpoint(branchInput);
    const branchPointerObserved =
      await nativeGraphPointerDrag(
        branchInput,
        junctionTarget,
        760,
        runId,
        9112
      );

    if (runId !== demoRunId) return;

    const branchDropState =
      graphHost
        ?.getGuidedConnectionDropState?.() ||
      null;
    const automaticHelperIsolationPassed =
      tourDebugAssert(
        "graph-route-guided-branch-drag-created-no-automatic-helper-node",
        Boolean(branchDropState) &&
          branchDropState
            .automaticNodeCreationAttempted !==
            true &&
          branchDropState.nodeCountAfter ===
            branchDropState.nodeCountBefore,
        {
          graphHostVersion:
            Number(graphHost?.version || 0),
          branchPointerObserved,
          branchDropState,
          policy:
            "The assistant owns the deterministic branch fallback, so the product's empty-canvas automatic helper must never run during this guided socket-to-wire gesture."
        }
      );
    if (!automaticHelperIsolationPassed) {
      graphDemoError(
        "The guided branch gesture allowed the empty-canvas automatic helper to add a competing node.",
        branchDropState
      );
    }

    let branchConnection = null;

    for (
      let attempt = 0;
      attempt < 40 &&
      runId === demoRunId;
      attempt += 1
    ) {
      branchConnection =
        window.RMLDynamicGraphHost
          ?.getState?.()
          ?.connections?.find(
            connection =>
              connection.toNode ===
                branchEndpoint.nodeId &&
              connection.toPort ===
                branchEndpoint.portId &&
              connection.branchFrom
          ) || null;

      if (branchConnection) break;

      await new Promise(resolve =>
        requestAnimationFrame(resolve)
      );
    }

    if (!branchConnection) {
      const forced =
        window.RMLDynamicGraphHost
          ?.ensureBranch?.(
            baseConnection.id,
            branchEndpoint,
            junctionTarget.x,
            junctionTarget.y
          );
      if (!forced?.ok) {
        graphDemoError(
          "The graph engine did not create the requested branch connection.",
          {
            branchPointerObserved,
            deterministicFallback: forced
          }
        );
      }
      await nextTwoFrames();
      branchConnection =
        window.RMLDynamicGraphHost
          ?.getState?.()
          ?.connections?.find(
            connection =>
              connection.id ===
              forced.connectionId
          ) || null;
    }

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

    if (runId !== demoRunId) return;

    const junctions =
      [...document.querySelectorAll(
        ".rml-graph-wire-point"
      )].filter(graphDemoVisible);

    const junction =
      junctions.find(point => {
        const rect =
          point.getBoundingClientRect();
        const center = {
          x:
            rect.left +
            rect.width / 2,
          y:
            rect.top +
            rect.height / 2
        };

        return Math.hypot(
          center.x - junctionTarget.x,
          center.y - junctionTarget.y
        ) < 45;
      }) ||
      junctions[0] ||
      null;

    if (!junction) {
      graphDemoError(
        "Routing step could not resolve the junction created by the native Graph Engine."
      );
    }

    const branchPath = graphNativeWireHit(
      branchConnection?.id || ""
    );
    const junctionPointAnalysis = graphDemoPointRouteAnalysis(
      centerOf(junction),
      {
        ignoredPoints: [junction],
        ignoredPaths: [parentHit, branchPath].filter(Boolean),
        nodeClearance: 10,
        pointClearance: 22
      }
    );
    const junctionPathOcclusion = graphDemoPathNodeOcclusion(
      branchPath
    );
    const junctionVisibilityVerified = tourDebugAssert(
      "graph-route-committed-junction-and-branch-remain-visible-outside-node-bodies",
      (
        junctionPointAnalysis.nodeCovered === false ||
        junctionPlan.nodeClearPointAvailable === false
      ) &&
      (
        junctionPointAnalysis.pointBlocked === false ||
        junctionPlan.pointProtectedAvailable === false
      ) &&
      (
        junctionPathOcclusion.blocked === false ||
        junctionPlan.pointProtectedNodeClearRouteAvailable === false
      ),
      {
        junction: tourDebugRect(junction),
        branchConnectionId: branchConnection?.id || "",
        junctionPointAnalysis,
        junctionPathOcclusion,
        junctionPlan,
        policy:
          "the real junction marker and branch line stay outside node bodies whenever the measured graph offers such a route; marker visibility outranks unavoidable line overlap"
      }
    );
    if (!junctionVisibilityVerified) {
      graphDemoError(
        "The committed branch obscured a junction point or line although a clearer route was available.",
        {
          junctionPointAnalysis,
          junctionPathOcclusion,
          junctionPlan
        }
      );
    }

    pulseAt(junction);
    showDemoLabel(
      "REAL junction created by the normal Graph Engine",
      centerOf(junction)
    );
    await wait(520);

    const segment =
      realHits().find(
        hit =>
          hit.dataset.connectionId ===
            baseConnection.id
      ) ||
      graphNativeWireHit(
        baseConnection.id
      );

    if (!segment) {
      graphDemoError(
        "Routing step could not find a real wire segment to bend."
      );
    }

    const segmentStart =
      graphSvgPathPoint(
        segment,
        .68
      );
    const bendTarget =
      graphDemoSafeBendPoint(
        viewport,
        segmentStart,
        segment
      );
    const bendPlan = bendTarget.tourRouteAnalysis || {};
    const bendPlanVerified = tourDebugAssert(
      "graph-route-bend-target-prioritizes-visible-points-before-line-overlap",
      (
        bendPlan.perfectAvailable !== true ||
        bendPlan.selectedTier === 0
      ) &&
      (
        bendPlan.pointProtectedAvailable !== true ||
        bendPlan.selectedPriority?.pointProtected === true
      ) &&
      (
        bendPlan.nodeClearPointAvailable !== true ||
        bendPlan.selectedPriority?.pointNodeClear === true
      ) &&
      (
        bendPlan.pointProtectedNodeClearRouteAvailable !== true ||
        (
          bendPlan.selectedPriority?.pointProtected === true &&
          bendPlan.selectedPriority?.routeNodeBlocked === false
        )
      ),
      {
        segmentStart,
        bendTarget,
        bendPlan,
        policy:
          "choose a completely clear bend first; preserve the bend marker before accepting an unavoidable line overlap; use node-covered space only as the final geometry fallback"
      }
    );
    if (!bendPlanVerified) {
      graphDemoError(
        "Routing step did not choose the highest available visibility class for the bend.",
        { segmentStart, bendTarget, bendPlan }
      );
    }

    showDemoLabel(
      "Drag the REAL line with the normal routing engine",
      segmentStart
    );
    await moveMouse(
      segmentStart,
      320,
      runId
    );

    if (runId !== demoRunId) return;

    const bendPointerId = 9113;
    const { mouse } = elements();
    let bendPointerDown = false;

    try {
      segment.dispatchEvent(
        new PointerEvent(
          "pointerdown",
          {
            bubbles: true,
            cancelable: true,
            pointerId: bendPointerId,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons: 1,
            clientX: segmentStart.x,
            clientY: segmentStart.y
          }
        )
      );

      bendPointerDown = true;
      mouse?.classList.add("pressed");

      const bendStarted =
        performance.now();
      const bendDuration = 760;

      while (runId === demoRunId) {
        const raw = Math.min(
          1,
          (performance.now() - bendStarted) /
            bendDuration
        );
        const eased =
          1 - Math.pow(1 - raw, 2.15);
        const point = {
          x:
            segmentStart.x +
            (bendTarget.x - segmentStart.x) * eased,
          y:
            segmentStart.y +
            (bendTarget.y - segmentStart.y) * eased
        };
        mouse?.style.setProperty(
          "--mouse-x",
          `${point.x}px`
        );
        mouse?.style.setProperty(
          "--mouse-y",
          `${point.y}px`
        );
        mouse?.style.setProperty(
          "--mouse-duration",
          "0ms"
        );

        document.dispatchEvent(
          new PointerEvent(
            "pointermove",
            {
              bubbles: true,
              cancelable: true,
              pointerId: bendPointerId,
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
        await new Promise(resolve =>
          requestAnimationFrame(resolve)
        );
      }

      if (runId !== demoRunId) return;

      document.dispatchEvent(
        new PointerEvent(
          "pointerup",
          {
            bubbles: true,
            cancelable: true,
            pointerId: bendPointerId,
            pointerType: "mouse",
            isPrimary: true,
            button: 0,
            buttons: 0,
            clientX: bendTarget.x,
            clientY: bendTarget.y
          }
        )
      );
      bendPointerDown = false;
      await wait(220);
    } finally {
      if (bendPointerDown) {
        document.dispatchEvent(
          new PointerEvent(
            "pointercancel",
            {
              bubbles: true,
              cancelable: true,
              pointerId: bendPointerId,
              pointerType: "mouse",
              isPrimary: true,
              button: 0,
              buttons: 0,
              clientX: segmentStart.x,
              clientY: segmentStart.y
            }
          )
        );
      }
      mouse?.classList.remove("pressed");
    }

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

    if (runId !== demoRunId) return;

    const pointsAfter =
      [...document.querySelectorAll(
        ".rml-graph-wire-point"
      )].filter(graphDemoVisible);

    const bendPoint =
      pointsAfter.find(point => {
        const center = centerOf(point);
        return Math.hypot(
          center.x - bendTarget.x,
          center.y - bendTarget.y
        ) < 55;
      }) ||
      pointsAfter[
        pointsAfter.length - 1
      ] ||
      null;

    const requestedBendDistance = Math.hypot(
      bendTarget.x - segmentStart.x,
      bendTarget.y - segmentStart.y
    );
    const committedBendCenter = bendPoint
      ? centerOf(bendPoint)
      : null;
    const committedBendDistance = committedBendCenter
      ? Math.hypot(
          committedBendCenter.x - segmentStart.x,
          committedBendCenter.y - segmentStart.y
        )
      : 0;
    const realLineMovedFullDistance = tourDebugAssert(
      "graph-route-existing-line-moved-full-distance-without-follower-line",
      Boolean(bendPoint) &&
        Math.hypot(
          committedBendCenter.x - bendTarget.x,
          committedBendCenter.y - bendTarget.y
        ) < 55 &&
        committedBendDistance >= requestedBendDistance * .72 &&
        !document.querySelector(
          ".rml-setup-demo-wire-layer, .rml-setup-demo-bend"
        ),
      {
        requestedDistance: requestedBendDistance,
        committedDistance: committedBendDistance,
        start: segmentStart,
        target: bendTarget,
        committed: committedBendCenter,
        artificialFollowerLineCount: document.querySelectorAll(
          ".rml-setup-demo-wire-layer, .rml-setup-demo-bend"
        ).length
      }
    );
    if (bendPoint && !realLineMovedFullDistance) {
      graphDemoError(
        "The existing wire did not follow the held pointer for the full bend gesture."
      );
    }

    const verifyCommittedBendVisibility = point => {
      const committedPath = graphNativeWireHit(baseConnection.id);
      const committedCenter = point ? centerOf(point) : null;
      const pointAnalysis = point
        ? graphDemoPointRouteAnalysis(
            committedCenter,
            {
              ignoredPoints: [point],
              ignoredPaths: committedPath ? [committedPath] : [],
              nodeClearance: 10,
              pointClearance: 22
            }
          )
        : null;
      const pathOcclusion = graphDemoPathNodeOcclusion(committedPath);
      const verified = tourDebugAssert(
        "graph-route-committed-bend-point-and-line-remain-visible-outside-node-bodies",
        Boolean(pointAnalysis) &&
        (
          pointAnalysis.nodeCovered === false ||
          bendPlan.nodeClearPointAvailable === false
        ) &&
        (
          pointAnalysis.pointBlocked === false ||
          bendPlan.pointProtectedAvailable === false
        ) &&
        (
          pathOcclusion.blocked === false ||
          bendPlan.pointProtectedNodeClearRouteAvailable === false
        ),
        {
          bendPoint: tourDebugRect(point),
          bendPointAnalysis: pointAnalysis,
          bendPathOcclusion: pathOcclusion,
          bendPlan,
          policy:
            "the committed bend marker and routed line remain visible outside node bodies whenever a measured alternative exists; the marker is protected before the line"
        }
      );
      if (!verified) {
        graphDemoError(
          "The committed bend obscured a route point or line although a clearer target was available.",
          {
            bendPointAnalysis: pointAnalysis,
            bendPathOcclusion: pathOcclusion,
            bendPlan
          }
        );
      }
      return verified;
    };

    if (
      !bendPoint ||
      pointsAfter.length <=
        junctions.length
    ) {
      const forced =
        window.RMLDynamicGraphHost
          ?.ensureWirePoint?.(
            baseConnection.id,
            bendTarget.x,
            bendTarget.y
          );
      if (!forced?.ok) {
        graphDemoError(
          "Neither the visible pointer gesture nor the deterministic routing engine created a bend point.",
          forced
        );
      }
      await nextTwoFrames();
      const guaranteedPoint =
        document.querySelector(
          `.rml-graph-wire-point[data-connection-id="${CSS.escape(baseConnection.id)}"]` +
          `[data-point-id="${CSS.escape(forced.pointId)}"]`
        );
      if (!guaranteedPoint) {
        graphDemoError(
          "The bend point exists in graph state but its real handle is not rendered."
        );
      }
      verifyCommittedBendVisibility(guaranteedPoint);
      pulseAt(guaranteedPoint);
      showDemoLabel(
        "REAL movable bend point committed and verified by the routing engine",
        centerOf(guaranteedPoint)
      );
      await wait(850);
      hideMouse();
      return;
    }

    verifyCommittedBendVisibility(bendPoint);
    pulseAt(bendPoint);
    showDemoLabel(
      "REAL movable bend point created by the normal routing engine",
      centerOf(bendPoint)
    );
    await wait(850);
    hideMouse();
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

    await new Promise(resolve => {
      const frame = now => {
        if (runId !== demoRunId) {
          resolve();
          return;
        }

        const raw = Math.min(
          1,
          (now - start) /
            effectiveDuration
        );
        const eased =
          raw < .5
            ? 4 * raw * raw * raw
            : 1 - Math.pow(-2 * raw + 2, 3) / 2;

        scroller.scrollTop =
          from + (to - from) * eased;

        if (raw >= 1) {
          resolve();
          return;
        }

        requestAnimationFrame(frame);
      };

      requestAnimationFrame(frame);
    });
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
    const targetReady = handoff.toDemo === "graph-create-node"
      ? Boolean(
          graphCreateNodePreparedDropPlan?.complete === true &&
          graphCreateNodePreparedDropHit("logic.not")
            ?.fullFootprintInside === true
        )
      : graphTeachingPairCompletelyVisible(pair, 10);
    return {
      handoff,
      opening,
      comparison,
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
      const pairReady = toDemo === "graph-create-node" ||
        graphTeachingPairCompletelyVisible(graphDemoSocketPair(false), 10);
      return Boolean(
        graphStepHasPreparedPanels(targetStep) &&
        visible &&
        visible.width >= 280 &&
        visible.height >= graphLessonMinimumVisibleHeight() &&
        nodesVisible &&
        graphCreateReady &&
        pairReady
      );
    };

    const before = graphTeachingSceneSnapshot(
      `${step.demo}-completion-before-${toDemo}`
    );
    if (!sceneReady()) {
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
    tourDebugRecord("graph-scene-natural-completion-frame", {
      fromDemo: step.demo,
      toDemo,
      adjusted: compareGraphTeachingScenes(before, after).exact !== true,
      assistantNoticeVisible: false,
      before,
      after,
      ready
    });
    const verified = tourDebugAssert(
      `${step.demo}-finished-in-${toDemo}-ready-scene`,
      ready,
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
        "graph-route"
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

  function normalizeGraphTeachingPairSpacing() {
    const pair = graphDemoSocketPair(false);
    const boolId = pair?.boolNode?.dataset.graphNodeId || "";
    const notId = pair?.notNode?.dataset.graphNodeId || "";
    if (!boolId || !notId) return false;

    const state = window.RMLDynamicGraphHost?.getState?.();
    const boolNode = state?.nodes?.find(node => node.id === boolId);
    const notNode = state?.nodes?.find(node => node.id === notId);
    if (!boolNode || !notNode) return false;

    const distance = Math.hypot(
      Number(boolNode.x || 0) - Number(notNode.x || 0),
      Number(boolNode.y || 0) - Number(notNode.y || 0)
    );
    if (distance >= 240 && distance <= 920) return false;

    const anchorX =
      (Number(boolNode.x || 0) + Number(notNode.x || 0)) / 2;
    const anchorY =
      (Number(boolNode.y || 0) + Number(notNode.y || 0)) / 2;
    const first =
      window.RMLDynamicGraphHost?.setNodePosition?.(
        boolId,
        anchorX - 330,
        anchorY - 20
      );
    const second =
      window.RMLDynamicGraphHost?.setNodePosition?.(
        notId,
        anchorX + 40,
        anchorY + 20
      );
    return first?.ok === true && second?.ok === true;
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
      await new Promise(resolve => requestAnimationFrame(resolve));
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

    if (graphNeedsCentering()) return true;
    if (graphStepUsesTeachingPair(step)) {
      const pair = graphDemoSocketPair(false);
      return !graphTeachingPairCompletelyVisible(pair, 18);
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
      const fitted = nodeIds.length > 0
        ? window.RMLDynamicGraphHost?.fitNodesToClientRect?.(
            nodeIds,
            regions.existingArea,
            {
              padding: 16,
              maxScale: orientation === "horizontal" ? .68 : .72
            }
          ) || null
        : { ok: true, scale: graphState?.viewport?.scale || 1 };
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
        const center = graphToolbarButton("Center Graph");
        if (center instanceof HTMLElement) {
          center.click();
          await nextTwoFrames();
        }

        const allNodeIds = (window.RMLDynamicGraphHost?.getState?.()?.nodes || [])
          .map(node => node.id)
          .filter(Boolean);
        quietlyFitGraphNodes(allNodeIds, {
          inset: 24,
          padding: Math.max(22, Math.min(42, window.innerWidth * .025)),
          maxScale: window.innerWidth < 820 ? .86 : 1.02
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
        generalChildren.join("|") === "Enabled|Scale" &&
        advancedChildren.join("|") === "Quality|DetailSection"
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
      await new Promise(resolve => requestAnimationFrame(resolve));
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
      const pair = graphDemoSocketPair(false);
      if (!graphTeachingPairCompletelyVisible(pair, 10)) {
        quietlyFitGraphNodes(
          graphTeachingNodeIdsFromState(),
          { inset: 20, padding: 30, maxScale: 1.02 }
        );
        await nextTwoFrames();
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

    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
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

  async function runGraphPanDemo(runId) {
    const viewport =
      document.querySelector(".rml-graph-viewport");
    if (!viewport) return;

    await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;

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
      centerOf(scrollDemo.body, .58, .52);
    const immediateMouse = elements().mouse;
    immediateMouse?.classList.add("active");
    immediateMouse?.style.setProperty(
      "--mouse-x",
      `${immediateNodePoint.x}px`
    );
    immediateMouse?.style.setProperty(
      "--mouse-y",
      `${immediateNodePoint.y}px`
    );
    immediateMouse?.style.setProperty(
      "--mouse-duration",
      "0ms"
    );

    let keepMouseVisible = false;

    const selectedWheel = async (
      target,
      options,
      repeat,
      interval,
      label,
      point
    ) => {
      hideKeys();
      elements().mouse?.classList.add("scrolling");
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
      elements().mouse?.classList.remove(
        "scrolling",
        "horizontal-wheel"
      );
      showKeys(["Ctrl"], point);
      showDemoLabel(label, point);
      await wait(TOUR_SCROLL_TIMING.modifierLeadIn);

      const found =
        await cycleTourScrollLayerUntil(
          target,
          matcher,
          runId,
          maxAttempts,
          deltaY
        );

      if (runId !== demoRunId) {
        return false;
      }

      releaseTourScrollModifier();
      hideKeys();
      await wait(TOUR_SCROLL_TIMING.modifierReleasePause);
      return found;
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
        centerOf(scrollDemo.body, .58, .52);
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

      showKeys(["Shift"], nodePoint);
      elements().mouse?.classList.add(
        "scrolling",
        "horizontal-wheel"
      );
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
      elements().mouse?.classList.add("scrolling");
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
          centerOf(codeScroller, .55, .42);
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
        ? centerOf(codeScroller, .55, .42)
        : centerOf(codePanel || viewport, .55, .42);
      const returnTarget =
        document.elementFromPoint(returnPoint.x, returnPoint.y) ||
        codeScroller ||
        codePanel ||
        document.body;

      showKeys(["Ctrl"], returnPoint);
      showDemoLabel(
        "Finally: Ctrl + Wheel selects <html> again → Wheel returns to the graph",
        returnPoint
      );
      const foundReturnHtml = await cycleTourScrollLayerUntil(
        returnTarget,
        /<html>|Page ROOT/i,
        runId,
        12,
        150
      );
      if (runId !== demoRunId) return;
      releaseTourScrollModifier();
      hideKeys();

      if (foundReturnHtml) {
        elements().mouse?.classList.add("scrolling");
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
      transitionSemanticScene(viewport, "Typed Runtime Graph section");
      nodePoint = centerOf(scrollDemo.body, .58, .52);
      await moveMouse(nodePoint, 420, runId);
      hideKeys();
      elements().mouse?.classList.remove(
        "pressed",
        "scrolling",
        "horizontal-wheel"
      );
      showDemoLabel(
        "Back at the graph → Step 11 can repeat from the same visible place",
        nodePoint
      );
      keepMouseVisible = true;
      await wait(520);
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
        return runGraphRouteDemo(runId);
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
    if (ui.liveControls) {
      ui.liveControls.hidden = phase !== "demonstrating";
    }
    if (ui.liveSkipDemo) {
      ui.liveSkipDemo.disabled = phase !== "demonstrating";
    }
    if (ui.liveSkipTour) {
      ui.liveSkipTour.disabled = phase !== "demonstrating";
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
    const expectedGraphHandoff = Boolean(
      options.restoreEntry !== true &&
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

    if (options.restoreEntry === true) {
      restoreTourState(stepSnapshots.get(index));
      await nextTwoFrames();
    } else if (options.captureEntry !== false) {
      stepSnapshots.set(index, captureTourState());
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
      step.demo === "topbar-identity-workflow" &&
      responsiveTopActionsState().responsive;
    const compactPackPreparationNeeded =
      step.demo === "mode-switch-graph" &&
      responsiveTopActionsState(
        document.querySelector(".rml-pack-button") ||
        document.querySelector("#pack-into-node")
      ).responsive;
    const preparationNeeded = Boolean(
      canActuallyScroll ||
      graphPreparationNeeded ||
      outlinePalettePreparationNeeded ||
      outlineReorderPreparationNeeded ||
      outlineNestedPreparationNeeded ||
      topbarPreparationNeeded ||
      compactPackPreparationNeeded
    );
    let preparationRanWithoutAssistantNotice = false;
    let naturalPreparationBefore = null;
    let naturalPreparationAfter = null;

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
          await prepareTopbarBeforeNarration(runId);
          if (runId !== demoRunId) return false;
          if (canActuallyScroll) {
            await animateTourPageScroll(
              plan.desiredScrollTop,
              TOUR_SCROLL_TIMING.pageScrollDuration,
              runId
            );
          }
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
        if (!constraintCertificate) throw error;
        tourDebugRecord("layout-constraint-noise-filtered", {
          stage: "preparation",
          preparedStepIndex: index,
          preparedDemo: step.demo || "",
          rawError: error?.message || String(error || ""),
          constraintCertificate
        });
        console.info(
          "[RML Tour] An unavoidable, mathematically certified layout constraint was recorded as viewport noise.",
          constraintCertificate
        );
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
        after: naturalPreparationAfter
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

  async function returnFromControlledRepeat(index) {
    const returned = await transitionToStep(index, {
      captureEntry: false,
      controlledReentry: true,
      deferNarration: true,
      repeatReturn: true
    });
    if (!returned) return false;
    if (steps[index]?.demo) {
      return revealReadyStepWithoutNarration(index);
    }
    return true;
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
      if (!inputLockReady) {
        throw new Error(
          `[RML Tour · Step ${stepIndex}] The trusted user-input lock or its live skip controls were not ready before the demonstration.`
        );
      }
      clearDemoVisuals();
      assertActionOnlyDemonstration("before-action");
      tourDebugRecord("tour-live-perception-before-demonstration", {
        demo: step.demo,
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
      target =
        await teacherPrepareStep(
          step,
          target,
          runId
        );

      if (runId !== demoRunId) return false;

      target = await tourPerceiveAndRepairStepTarget(
        step,
        target,
        runId
      );
      if (runId !== demoRunId) return false;

      const graphNodesBefore = graphDemoNodeCount();
      await runDemoOnce(step, target, runId);
      if (runId !== demoRunId) return false;
      await finalizeGraphSceneForNextLesson(step, runId);
      if (runId !== demoRunId) return false;
      assertActionOnlyDemonstration("after-action");
      verifyGraphDemoNodeBudget(step, graphNodesBefore);

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
        await returnFromControlledRepeat(
          repeatReturnStepIndex
        );
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
            repeatReturnStepIndex
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
        tourDebugRecord("demonstration-error", {
          failedStepIndex,
          failedStepTitle: step?.title || "",
          failedDemo: step?.demo || "",
          errorName: error?.name || "Error",
          message:
            error?.message ||
            String(error || "Unknown demonstration error"),
          stack: String(error?.stack || ""),
          details:
            error?.details || null
        });
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
      return JSON.stringify(value || null);
    } catch {
      return "";
    }
  }

  function restoreTourState(value) {
    if (!value) return;
    window.RMLBuilderSetupBridge?.restore?.(cloneTourState(value));
  }

  async function nextTwoFrames() {
    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
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
      } else if (options.captureEntry !== false) {
        stepSnapshots.set(index, captureTourState());
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
    const skippingLiveDemonstration = Boolean(
      step?.demo &&
      demoInFlight &&
      stepPhase === "demonstrating"
    );
    if (
      !step?.demo ||
      (!skippingLiveDemonstration && stepPhase !== "ready")
    ) {
      return false;
    }

    if (skippingLiveDemonstration) {
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
      await nextTwoFrames();
    }

    tourDebugRecord("single-demonstration-skipped", {
      skippedStepIndex: skippedIndex,
      skippedStepTitle: step.title || "",
      skippedDemo: step.demo,
      skippedWhileRunning: skippingLiveDemonstration
    });

    if (skippedIndex >= steps.length - 1) {
      await restoreAndClose(true);
    } else {
      await transitionToStep(skippedIndex + 1, {
        captureEntry: true
      });
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
    const repeatSnapshot = stepSnapshots.get(repeatStepIndex);

    if (
      repeatPreviousInFlight ||
      demoInFlight ||
      restoreInFlight ||
      repeatStepIndex < 0 ||
      !repeatAllowedFromCurrentPhase ||
      !repeatSnapshot
    ) {
      tourDebugRecord("controlled-repeat-previous-rejected", {
        returnStepIndex,
        repeatStepIndex,
        phase: stepPhase,
        repeatPreviousInFlight,
        demoInFlight,
        restoreInFlight,
        snapshotAvailable: Boolean(repeatSnapshot),
        policy:
          "Repeat is available only from the next ready dialog and uses the previous lesson's immutable entry snapshot."
      });
      return false;
    }

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
      snapshotRestored: true
    });

    try {
      const opened = await transitionToStep(repeatStepIndex, {
        restoreEntry: true,
        captureEntry: false,
        controlledReentry: true,
        deferNarration: true,
        directDemonstration: true
      });
      if (!opened) {
        if (stepIndex !== returnStepIndex) {
          await returnFromControlledRepeat(returnStepIndex);
        }
        return false;
      }

      const repeated = await runDemo(
        steps[repeatStepIndex],
        findTarget(steps[repeatStepIndex]),
        {
          controlledRepeat: true,
          repeatReturnStepIndex: returnStepIndex
        }
      );
      tourDebugRecord("controlled-repeat-previous-complete", {
        transaction: controlledRepeatCount,
        repeatStepIndex,
        returnStepIndex,
        returnedToRequestedDialog: stepIndex === returnStepIndex,
        previousNarrationRepeated: false,
        demonstrationCompleted: repeated
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
        await returnFromControlledRepeat(returnStepIndex);
      }
      return false;
    } finally {
      repeatPreviousInFlight = false;
      const currentUi = elements();
      if (!currentUi.root?.hidden && !demoInFlight) {
        setStepPhase(stepPhase);
        fitNarrationCardToContent({ followText: false });
      }
    }
  }

  async function restoreAndClose(markComplete = true) {
    if (restoreInFlight) return;
    restoreInFlight = true;
    const ui = elements();
    try {
      cancelDemo();
      clearTarget();
      document.documentElement.classList.remove("rml-setup-tour-active");
      if (ui.root) ui.root.hidden = true;

      await restoreSandboxSnapshot();

      if (originalTourUiState) {
        window.scrollTo(
          originalTourUiState.scrollX,
          originalTourUiState.scrollY
        );
      }

      if (markComplete || firstRunSession) {
        window.RMLBuilderSetupBridge?.markComplete?.();
      }
    } finally {
      snapshot = null;
      snapshotFingerprint = "";
      stepSnapshots.clear();
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
      snapshot = captureTourState();
      snapshotFingerprint = tourStateFingerprint(snapshot);
      originalTourUiState = {
        graphMode: document.body.classList.contains("rml-node-graph-mode"),
        scrollX: window.scrollX,
        scrollY: window.scrollY
      };
      stepSnapshots.clear();

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