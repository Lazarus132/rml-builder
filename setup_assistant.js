(() => {
  "use strict";

  const SCRIPT_BASE = document.currentScript?.src || window.location.href;
  const TEMPLATE_URL = new URL("setup_template.html?v=11", SCRIPT_BASE).href;
  const TEMPLATE_SCRIPT_URL = new URL("setup_template.js?v=11", SCRIPT_BASE).href;
  let templatePromise = null;
  let snapshot = null;
  let stepSnapshots = new Map();
  let originalTourUiState = null;
  let stepIndex = 0;
  let currentTarget = null;
  let firstRunSession = false;
  let demoRunId = 0;
  let demoTimers = [];
  const DEMO_REPEAT_PAUSE_MS = 900;
  const DEMO_COMPLEX_REPEAT_PAUSE_MS = 1250;

  const TOUR_SCROLL_TIMING = Object.freeze({
    wheelInterval: 145,
    layerStepPause: 390,
    modifierLeadIn: 330,
    modifierReleasePause: 380,
    gestureLeadIn: 260,
    gestureSettle: 420,
    autoScrollInterval: 105,
    returnScrollInterval: 105,
    pageScrollDuration: 1050
  });
  let viewportRestartTimer = 0;

  let demoWireCanvas = null;
  let demoWireCanvasContext = null;
  let demoWireCanvasFrame = 0;
  const demoCanvasWires = new Map();

  function ensureDemoWireCanvas() {
    if (demoWireCanvas?.isConnected && demoWireCanvasContext) {
      return demoWireCanvas;
    }

    demoWireCanvas = document.createElement("canvas");
    demoWireCanvas.className = "rml-setup-demo-wire-canvas";
    demoWireCanvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(demoWireCanvas);
    demoWireCanvasContext = demoWireCanvas.getContext("2d");
    resizeDemoWireCanvas();
    return demoWireCanvas;
  }

  function resizeDemoWireCanvas() {
    if (!demoWireCanvas || !demoWireCanvasContext) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    demoWireCanvas.width = Math.round(width * dpr);
    demoWireCanvas.height = Math.round(height * dpr);
    demoWireCanvas.style.width = `${width}px`;
    demoWireCanvas.style.height = `${height}px`;
    demoWireCanvasContext.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawDemoCanvasWires();
  }

  function demoWireColor(path, fallback = "#6ce89b") {
    return path?.style?.stroke || fallback;
  }

  function setDemoCanvasWire(path, from, to, bend = 0, options = {}) {
    if (!path || !from || !to) return;
    ensureDemoWireCanvas();
    demoCanvasWires.set(path, {
      kind: options.kind || "bezier",
      from: { ...from },
      to: { ...to },
      bend,
      control: options.control ? { ...options.control } : null,
      color: options.color || demoWireColor(path),
      dashed: options.dashed === true,
      width: options.width || 5,
      visible: options.visible !== false
    });
    drawDemoCanvasWires();
  }

  function hideDemoCanvasWire(path) {
    const wire = demoCanvasWires.get(path);
    if (wire) wire.visible = false;
    drawDemoCanvasWires();
  }

  function clearDemoCanvasWires() {
    demoCanvasWires.clear();
    if (demoWireCanvasFrame) {
      cancelAnimationFrame(demoWireCanvasFrame);
      demoWireCanvasFrame = 0;
    }
    drawDemoCanvasWires();
  }

  function suppressNativeGraphWirePreview(suppressed) {
    const styleId = "rml-setup-native-wire-preview-suppression";
    let style = document.getElementById(styleId);

    if (!style) {
      style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        html.rml-setup-hide-native-wire-preview .rml-graph-wire-preview {
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
        }
      `;
      document.head.appendChild(style);
    }

    document.documentElement.classList.toggle(
      "rml-setup-hide-native-wire-preview",
      suppressed === true
    );
  }

  function scheduleDemoCanvasWireAnimation() {
    if (demoWireCanvasFrame) return;
    const tick = () => {
      demoWireCanvasFrame = 0;
      const animated = [...demoCanvasWires.values()].some(wire =>
        wire.visible && wire.dashed
      );
      if (!animated) return;
      drawDemoCanvasWires();
      demoWireCanvasFrame = requestAnimationFrame(tick);
    };
    demoWireCanvasFrame = requestAnimationFrame(tick);
  }

  function drawDemoCanvasWires() {
    if (!demoWireCanvasContext || !demoWireCanvas) return;
    const ctx = demoWireCanvasContext;
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

    for (const wire of demoCanvasWires.values()) {
      if (!wire.visible) continue;
      ctx.save();
      ctx.lineWidth = wire.width;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.strokeStyle = wire.color;
      ctx.shadowColor = wire.color;
      ctx.shadowBlur = 10;
      ctx.setLineDash(wire.dashed ? [14, 9] : []);
      if (wire.dashed) {
        ctx.lineDashOffset = -((performance.now() / 18) % 23);
      }
      const wireDistance = Math.hypot(
        wire.to.x - wire.from.x,
        wire.to.y - wire.from.y
      );

      if (wireDistance < 1.5) {
        ctx.restore();
        continue;
      }

      ctx.beginPath();
      ctx.moveTo(wire.from.x, wire.from.y);
      if (wire.kind === "quadratic" && wire.control) {
        ctx.quadraticCurveTo(
          wire.control.x, wire.control.y,
          wire.to.x, wire.to.y
        );
      } else {
        const dx = Math.max(70, Math.abs(wire.to.x - wire.from.x) * .45);
        ctx.bezierCurveTo(
          wire.from.x + dx, wire.from.y + wire.bend,
          wire.to.x - dx, wire.to.y - wire.bend,
          wire.to.x, wire.to.y
        );
      }
      ctx.stroke();
      ctx.restore();
    }

    if ([...demoCanvasWires.values()].some(wire => wire.visible && wire.dashed)) {
      scheduleDemoCanvasWireAnimation();
    }
  }

  const wait = milliseconds => new Promise(resolve => {
    const timer = window.setTimeout(resolve, milliseconds);
    demoTimers.push(timer);
  });

  const steps = [
    {
      title: "Welcome to the Universal Mod Builder",
      text: "This live assistant demonstrates the complete basic workflow. The builder is snapshotted before the tour and restored exactly when you finish or skip it.",
      hint: "The animated mouse shows the gestures automatically."
    },
    {
      target: "#mod-name",
      title: "1. Describe your mod",
      text: "Start with the identity fields. <strong>Mod name</strong>, author, version, namespace, class and description are used by the generated project.",
      hint: "You can edit these fields at any time.",
      demo: "point"
    },
    {
      target: '[data-palette="bool"]',
      title: "2. Choose a setting",
      text: "The left palette contains the available configuration types. You can click a type, or drag it directly into the exact place you want.",
      hint: "The tour now demonstrates real drag direction visually.",
      demo: "outline-palette"
    },
    {
      target: "#builder-canvas",
      title: "3. Drag into Configuration Outline",
      text: "Drag a setting from the palette into the <strong>Configuration Outline</strong>. The insertion position is highlighted while you move. Dropping on the root keeps it at root level.",
      hint: "Esc cancels an active drag and restores the original scroll position.",
      demo: "outline-root-drag"
    },
    {
      target: "#builder-canvas",
      title: "4. Reorder and auto-scroll",
      text: "Existing items can be dragged above or below other items. The bright insertion line shows the exact landing position while you drag. When the pointer reaches an edge, the outline auto-scrolls without losing that target.",
      hint: "Watch the highlighted mouse wheel and the blue landing line while the dragged item moves through the outline.",
      demo: "outline-reorder-scroll"
    },
    {
      target: "#builder-canvas",
      title: "5. Drag into nested Section enums",
      text: "Section enums are real nested containers. You can drag settings into a section, move complete sections, and place another Section enum inside a section. While a section is held, the mouse wheel can move its insertion position left or right across the horizontal section lanes.",
      hint: "The assistant demonstrates both the nested drop target and wheel-controlled left/right section placement.",
      demo: "outline-nested"
    },
    {
      target: ".inspector",
      title: "6. Configure Properties",
      text: "Select any setting or Section enum and edit it here. Defaults, validation, sliders, enum values, runtime reactions and specialized editors are kept type-safe.",
      hint: "The inspector always follows the current selection.",
      demo: "point"
    },
    {
      target: ".rml-pack-button",
      mode: "outline",
      title: "7. Pack into the runtime graph",
      text: "<strong>Pack into Node</strong> switches from Configuration Outline to the typed runtime graph. Your settings become typed sockets that can drive runtime logic.",
      hint: "The next steps build and connect runtime nodes visually.",
      demo: "point"
    },
    {
      target: ".palette",
      mode: "graph",
      title: "8. Create runtime nodes",
      text: "Runtime nodes come from the Node library. Drag a node from the palette into the graph or click it to create it near the center. Built-in and catalog-backed nodes use the same graph interaction model.",
      hint: "The animation moves a node from the library into the graph.",
      demo: "graph-create-node"
    },
    {
      target: ".rml-graph-viewport",
      mode: "graph",
      title: "9. Connect typed sockets",
      text: "Create a wire by dragging from one socket to another. Compatible sockets light up, incompatible sockets are rejected, and wire color communicates the concrete value type. You can also drop a wire on empty graph space: an output creates a typed Display monitor automatically, while a compatible value input creates a safe typed source such as a constant/context helper. When the matching generated mod and scanner are running, Display Value shows the actual Resonite runtime value; otherwise it remains in the explicit Runtime Only fallback. Display Value also has an optional RML Menu input: connect a Display Value (RML Menu) output from the packed Start node there. The same Start display output can fan out to multiple Display Value monitors; those values stay side by side in one single RML row by default, and their left-to-right order is set from the Outline item's Properties. A separate Stack values vertically toggle is available only when a deliberate top-to-bottom layout is wanted. Impulse inputs and inputs that cannot be safely synthesized still require an explicit connection.",
      hint: "The animation shows socket-to-socket wiring first, then REAL output → empty-space and input → empty-space drops. The automatically created helper nodes appear live in safe visible graph positions.",
      demo: "graph-wire"
    },
    {
      target: ".rml-graph-viewport",
      mode: "graph",
      title: "10. Switch input / output sides",
      text: "Every graph node with sockets has a <strong>⇄</strong> button. Clicking it mirrors the visible socket layout: inputs move to the opposite side and outputs move with them. Clicking it again restores the original layout.",
      hint: "This step only teaches ⇄. Watch the real node flip and the socket markers move clearly from one side to the other.",
      demo: "graph-flip"
    },
    {
      target: ".rml-graph-viewport",
      mode: "graph",
      title: "11. Choose the scroll level",
      text: "First use normal Wheel inside the real Node body, then hold Shift and use Wheel for its horizontal axis. The global layer override is demonstrated only after those ordinary gestures: Ctrl (Command on macOS) + Wheel starts at the <strong>outermost currently visible</strong> real scroll layer. From there the selector follows the real visual layout like reading a page: parent before descendants; sibling regions top to bottom and, when they share a row, left to right. Each region is completed depth-first before a later sibling region is visited. Further Wheel down advances through that order and Wheel up moves backward. The hierarchy has no hard beginning or end: continuing in the same direction wraps around and repeats. Releasing Ctrl locks the glowing level, and ordinary Wheel scrolls only that selected level. Shift remains allowed only when that exact selected level actually has a horizontal scroll axis; otherwise Shift releases the selection/lock like any other non-Ctrl/Command key. Any other key or any pointer press also releases it without consuming that input.",
      hint: "Rule: Ctrl/Command + Wheel starts outside, then follows the real page layout: parent → descendants, sibling regions top → bottom, same-row siblings left → right, depth-first per region. Keep scrolling in one direction to wrap around endlessly. Release Ctrl/Command to lock. Shift + Wheel keeps the lock only for a genuinely horizontally scrollable selected level; otherwise Shift cancels it. Any other key or pointer press cancels it.",
      demo: "graph-pan"
    },
    {
      target: ".rml-graph-viewport",
      mode: "graph",
      title: "12. Move nodes and route wires",
      text: "Drag node headers to reorganize the graph. Drag an input onto an existing wire to create a branch, and pull a wire segment to create a movable bend point.",
      hint: "This step focuses only on routing: node movement, a branch/junction and a bend point.",
      demo: "graph-route"
    },
    {
      target: ".inspector",
      mode: "graph",
      title: "13. Configure graph nodes",
      text: "Select a graph node to edit its parameters in the <strong>Node inspector</strong>. Generic numeric/vector nodes infer concrete types where possible, while invalid configurations are blocked.",
      hint: "Variadic nodes can add or remove same-type inputs from the inspector.",
      demo: "point"
    },
    {
      target: "#preview-open",
      mode: "outline",
      title: "14. Preview the settings UI",
      text: "Preview shows how the generated settings page behaves, including enums, sliders, vectors and the Full Color Picker.",
      hint: "Preview changes stay session-local until applied/saved.",
      demo: "point"
    },
    {
      target: "#project-manager",
      mode: "outline",
      title: "15. Save a portable project",
      text: "Autosave stays in this browser. Use <strong>Project</strong> to save or restore a portable JSON project when you want an explicit backup.",
      hint: "No project data is uploaded by the builder.",
      demo: "point"
    },
    {
      target: "#download-code",
      mode: "outline",
      title: "16. Export the generated mod",
      text: "Export creates the selected generated project files. The C# source updates continuously while you edit both the Configuration Outline and Typed Runtime Graph.",
      hint: "Use Help → Shortcuts for every keyboard control.",
      demo: "point"
    },
    {
      title: "Tour complete",
      text: "That is the full workflow: <strong>Identity → Configuration Outline → nested dragging → Properties → Typed Runtime Graph → node creation → typed wires → graph navigation → Preview → Export</strong>.",
      hint: "Your original builder state is restored when you finish."
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
      title: root?.querySelector("[data-setup-title]"),
      text: root?.querySelector("[data-setup-text]"),
      hint: root?.querySelector("[data-setup-hint]"),
      progress: root?.querySelector("[data-setup-progress]"),
      back: root?.querySelector("[data-setup-back]"),
      next: root?.querySelector("[data-setup-next]"),
      skip: root?.querySelector("[data-setup-skip]"),
      mouse: root?.querySelector("[data-setup-mouse]"),
      mouseWheel: root?.querySelector("[data-setup-mouse-wheel]"),
      dragGhost: root?.querySelector("[data-setup-drag-ghost]"),
      wire: root?.querySelector("[data-setup-demo-wire]"),
      wireSecondary: root?.querySelector("[data-setup-demo-wire-secondary]"),
      wireTertiary: root?.querySelector("[data-setup-demo-wire-tertiary]"),
      crossing: root?.querySelector("[data-setup-demo-crossing]"),
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

  function ensureTourMode(step) {
    const wantsGraph = step?.mode === "graph";
    const wantsOutline = step?.mode === "outline";
    const graphActive = document.body.classList.contains("rml-node-graph-mode");
    const packButton = document.querySelector(".rml-pack-button");
    if (wantsGraph && !graphActive) {
      if (!document.querySelector(".node-card")) {
        document.querySelector('[data-palette="bool"]')?.click();
      }
      if (!document.body.classList.contains("rml-node-graph-mode")) packButton?.click();
    } else if (wantsOutline && graphActive) {
      packButton?.click();
    }

    if (wantsGraph) {
      ensureTourGraphSidebarsVisible();
    }
  }

  function tourViewport() {
    const visual = window.visualViewport;
    return {
      left: visual?.offsetLeft || 0,
      top: visual?.offsetTop || 0,
      width: Math.max(1, visual?.width || window.innerWidth || document.documentElement.clientWidth),
      height: Math.max(1, visual?.height || window.innerHeight || document.documentElement.clientHeight),
      right: (visual?.offsetLeft || 0) + Math.max(1, visual?.width || window.innerWidth || document.documentElement.clientWidth),
      bottom: (visual?.offsetTop || 0) + Math.max(1, visual?.height || window.innerHeight || document.documentElement.clientHeight)
    };
  }

  function positionShades(target) {
    const root = document.getElementById("rml-setup-assistant");
    const shades = [...(root?.querySelectorAll("[data-setup-shade]") || [])];
    if (shades.length !== 4) return;
    const byName = name => shades.find(item => item.dataset.setupShade === name);
    const viewport = tourViewport();
    const gap = 9;
    if (!target) {
      byName("top").style.cssText = `display:block;left:${viewport.left}px;top:${viewport.top}px;width:${viewport.width}px;height:${viewport.height}px`;
      for (const name of ["left", "right", "bottom"]) byName(name).style.cssText = "display:none";
      return;
    }
    for (const shade of shades) shade.style.display = "block";
    const rect = target.getBoundingClientRect();
    const left = Math.max(viewport.left, rect.left - gap);
    const right = Math.min(viewport.right, rect.right + gap);
    const topY = Math.max(viewport.top, rect.top - gap);
    const bottomY = Math.min(viewport.bottom, rect.bottom + gap);
    byName("top").style.cssText = `display:block;left:${viewport.left}px;top:${viewport.top}px;width:${viewport.width}px;height:${Math.max(0, topY - viewport.top)}px`;
    byName("bottom").style.cssText = `display:block;left:${viewport.left}px;top:${bottomY}px;width:${viewport.width}px;height:${Math.max(0, viewport.bottom-bottomY)}px`;
    byName("left").style.cssText = `display:block;left:${viewport.left}px;top:${topY}px;width:${Math.max(0,left-viewport.left)}px;height:${Math.max(0,bottomY-topY)}px`;
    byName("right").style.cssText = `display:block;left:${right}px;top:${topY}px;width:${Math.max(0,viewport.right-right)}px;height:${Math.max(0,bottomY-topY)}px`;
  }

  function positionCard(target) {
    const { card } = elements();
    if (!card) return;
    const viewport = tourViewport();
    const margin = 12;
    card.style.transform = "none";
    const cardRect = card.getBoundingClientRect();
    const cardWidth = Math.min(cardRect.width, Math.max(1, viewport.width - margin * 2));
    const cardHeight = Math.min(cardRect.height, Math.max(1, viewport.height - margin * 2));

    if (!target) {
      card.style.left = `${viewport.left + Math.max(margin, (viewport.width - cardWidth) / 2)}px`;
      card.style.top = `${viewport.top + Math.max(margin, (viewport.height - cardHeight) / 2)}px`;
      return;
    }

    const rect = target.getBoundingClientRect();
    let left = Math.min(viewport.right - cardWidth - margin, Math.max(viewport.left + margin, rect.left));
    let top = rect.bottom + 16;
    if (top + cardHeight > viewport.bottom - margin) top = rect.top - cardHeight - 16;
    if (top < viewport.top + margin) top = viewport.bottom - cardHeight - margin;
    left = Math.max(viewport.left + margin, Math.min(left, viewport.right - cardWidth - margin));
    top = Math.max(viewport.top + margin, Math.min(top, viewport.bottom - cardHeight - margin));
    card.style.left = `${left}px`;
    card.style.top = `${top}px`;
  }

  function clearDemoVisuals() {
    const ui = elements();

    ui.mouse?.classList.remove(
      "active",
      "pressed",
      "scrolling",
      "horizontal-wheel"
    );

    if (ui.dragGhost) {
      ui.dragGhost.hidden = true;
      ui.dragGhost.className = "rml-setup-drag-ghost";
    }

    for (const wire of [
      ui.wire,
      ui.wireSecondary,
      ui.wireTertiary
    ]) {
      if (!wire) continue;
      wire.hidden = true;
      wire.classList.remove(
        "dragging",
        "drawing",
        "crossing-wire"
      );
      wire.setAttribute("d", "");
      wire.style.removeProperty("stroke");
      wire.style.removeProperty("stroke-dasharray");
      wire.style.removeProperty("stroke-dashoffset");
    }

    clearDemoCanvasWires();
    suppressNativeGraphWirePreview(false);

    if (ui.crossing) {
      ui.crossing.hidden = true;
      ui.crossing.classList.remove("active");
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
      ".rml-setup-demo-pulse, .rml-setup-demo-drop, .rml-setup-demo-node, .rml-setup-demo-bend, .rml-setup-demo-landing, .rml-setup-port-travel"
    ).forEach(element => element.remove());
    document.querySelectorAll(".rml-graph-node.rml-setup-flip-active")
      .forEach(element => element.classList.remove("rml-setup-flip-active"));
    document.querySelectorAll(".rml-setup-control-highlight")
      .forEach(element => element.classList.remove("rml-setup-control-highlight"));
    clearRealPortGlows();
    window.RMLTypedNodeGraphScrollLayers
      ?.clear?.();
  }

  function cancelDemo() {
    demoRunId += 1;
    for (const timer of demoTimers) clearTimeout(timer);
    demoTimers = [];
    clearDemoVisuals();
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

  function bestVerticalOutlineHost() {
    const candidates = [
      document.querySelector("#builder-canvas"),
      ...document.querySelectorAll(".drop-zone")
    ].filter(Boolean);

    return candidates
      .map(host => ({
        host,
        count: directChildrenWithClass(host, "node-card").length
      }))
      .sort((left, right) => right.count - left.count)[0]?.host || null;
  }

  function horizontalSectionSlots(host) {
    if (!host) return [];
    const lanes = directChildrenWithClass(host, "option-lane");
    if (lanes.length === 0) return [];

    const rects = lanes.map(lane => lane.getBoundingClientRect());
    const slots = [];

    for (let index = 0; index <= rects.length; index += 1) {
      const before = index > 0 ? rects[index - 1] : null;
      const after = index < rects.length ? rects[index] : null;
      const left =
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
        left,
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

  function syncDemoWireViewport() {
    ensureDemoWireCanvas();
    resizeDemoWireCanvas();
    const {
      wire,
      wireSecondary,
      wireTertiary
    } = elements();

    const layer =
      wire?.ownerSVGElement ||
      wireSecondary?.ownerSVGElement ||
      wireTertiary?.ownerSVGElement;

    if (!layer) return;

    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    layer.setAttribute("viewBox", `0 0 ${width} ${height}`);
    layer.setAttribute("width", String(width));
    layer.setAttribute("height", String(height));
    layer.setAttribute("preserveAspectRatio", "none");
  }

  async function ensureOutlineBeforeTour() {
    if (!document.body.classList.contains("rml-node-graph-mode")) {
      return;
    }

    const packButton =
      document.querySelector(".rml-pack-button") ||
      document.querySelector("#pack-into-node");

    packButton?.click();

    for (let attempt = 0; attempt < 20; attempt += 1) {
      if (!document.body.classList.contains("rml-node-graph-mode")) {
        break;
      }
      await new Promise(resolve => window.setTimeout(resolve, 25));
    }

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
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
    mouse.style.setProperty("--mouse-duration", `${duration}ms`);
    const ghost = elements().dragGhost;
    if (ghost && !ghost.hidden) {
      ghost.style.transition = `left ${duration}ms cubic-bezier(.22,.75,.2,1), top ${duration}ms cubic-bezier(.22,.75,.2,1)`;
      ghost.style.left = `${point.x + 16}px`;
      ghost.style.top = `${point.y + 12}px`;
    }
    await wait(duration + 50);
    return runId === demoRunId;
  }

  async function clickMouse(runId = demoRunId) {
    const { mouse } = elements();
    if (!mouse || runId !== demoRunId) return;
    mouse.classList.add("pressed");
    await wait(170);
    mouse.classList.remove("pressed");
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

      document.dispatchEvent(
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

    document.dispatchEvent(
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

  function hideGhost() {
    const { dragGhost } = elements();
    if (dragGhost) dragGhost.hidden = true;
  }

  function pulseAt(element, className = "rml-setup-demo-pulse") {
    const rect = element?.getBoundingClientRect();
    if (!rect) return null;
    const pulse = document.createElement("div");
    pulse.className = className;
    pulse.style.left = `${rect.left}px`;
    pulse.style.top = `${rect.top}px`;
    pulse.style.width = `${rect.width}px`;
    pulse.style.height = `${rect.height}px`;
    document.body.appendChild(pulse);
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
      element.classList.toggle("rml-setup-control-highlight", active === true);
    }
  }

  function showDemoLabel(text, point) {
    const { demoLabel } = elements();
    if (!demoLabel) return;
    demoLabel.hidden = false;
    demoLabel.textContent = text;
    demoLabel.style.left = `${Math.min(window.innerWidth - 220, Math.max(10, point.x + 24))}px`;
    demoLabel.style.top = `${Math.min(window.innerHeight - 48, Math.max(10, point.y - 18))}px`;
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

    const fallback = {
      x: window.innerWidth * .5,
      y: window.innerHeight * .72
    };

    const location =
      point || fallback;

    holder.style.left =
      `${Math.min(
        window.innerWidth - 120,
        Math.max(12, location.x + 34)
      )}px`;

    holder.style.top =
      `${Math.min(
        window.innerHeight - 60,
        Math.max(12, location.y + 24)
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

  function showCrossing(point) {
    const { crossing } = elements();
    if (!crossing) return;

    crossing.style.left = `${point.x}px`;
    crossing.style.top = `${point.y}px`;
    crossing.hidden = false;
    crossing.classList.add("active");
  }

  async function animatePathDrawing(
    path,
    from,
    to,
    duration,
    runId,
    bend = 0,
    options = {}
  ) {
    if (!path || runId !== demoRunId) {
      return false;
    }

    path.hidden = false;
    path.classList.add(
      options.className || "drawing"
    );

    const started =
      performance.now();

    while (runId === demoRunId) {
      const raw =
        Math.min(
          1,
          (performance.now() - started) /
          Math.max(1, duration)
        );

      const eased =
        1 -
        Math.pow(
          1 - raw,
          2.05
        );

      const point = {
        x:
          from.x +
          (to.x - from.x) *
          eased,
        y:
          from.y +
          (to.y - from.y) *
          eased
      };

      path.setAttribute(
        "d",
        bezierPath(
          from,
          point,
          bend *
          Math.sin(
            eased *
            Math.PI
          )
        )
      );

      setDemoCanvasWire(
        path,
        from,
        point,
        bend * Math.sin(eased * Math.PI),
        {
          color: demoWireColor(path),
          dashed: options.dashed === true,
          width: 5
        }
      );

      if (options.followMouse) {
        const { mouse } = elements();

        mouse?.classList.add("active");

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
      }

      if (raw >= 1) {
        break;
      }

      await new Promise(resolve =>
        requestAnimationFrame(resolve)
      );
    }

    if (runId !== demoRunId) {
      return false;
    }

    path.setAttribute(
      "d",
      bezierPath(from, to, bend)
    );
    setDemoCanvasWire(path, from, to, bend, {
      color: demoWireColor(path),
      dashed: options.dashed === true,
      width: 5
    });

    return true;
  }

  function bezierPath(a, b, bend = 0) {
    const dx = Math.max(70, Math.abs(b.x - a.x) * .45);
    return `M ${a.x} ${a.y} C ${a.x + dx} ${a.y + bend}, ${b.x - dx} ${b.y - bend}, ${b.x} ${b.y}`;
  }

  async function runPointDemo(target, runId) {
    if (!target || runId !== demoRunId) return;
    hideMouse();
    pulseAt(target);
    await wait(650);
  }

  async function runOutlinePaletteDemo(runId) {
    const palette = document.querySelector('[data-palette="bool"]');
    const canvas = document.querySelector("#builder-canvas");
    if (!palette || !canvas) return;
    const from = centerOf(palette, .5, .5);
    const requested = centerOf(canvas, .5, .28);
    const slot = nearestVerticalSlot(canvas, requested);
    const to = slot
      ? { x: slot.left + slot.width * .5, y: slot.top }
      : requested;
    showGhost("Boolean", from);
    showDemoLabel("Drag a setting", from);
    showLandingGuide(slot, "Root insertion position");
    await dragMouse(from, to, 1100, runId);
    pulseAt(canvas, "rml-setup-demo-drop");
    hideGhost();
    removeLandingGuides();
    hideMouse();
  }

  async function runOutlineRootDrag(runId) {
    const source =
      document.querySelector(".node-card[data-node-id]") ||
      document.querySelector('[data-palette="bool"]');
    const canvas = document.querySelector("#builder-canvas");
    if (!source || !canvas) return;

    const sourcePoint = centerOf(source, .45, .35);
    const slots = verticalInsertionSlots(canvas);
    const slot = slots[Math.min(1, slots.length - 1)] || slots[0];
    const targetPoint = slot
      ? { x: slot.left + slot.width * .5, y: slot.top }
      : centerOf(canvas, .5, .25);

    showGhost(source.querySelector("strong")?.textContent || "Setting", sourcePoint);
    showDemoLabel("Move to Root", targetPoint);
    showLandingGuide(slot, "Exact root landing position");
    await dragMouse(sourcePoint, targetPoint, 1150, runId);
    pulseAt(canvas, "rml-setup-demo-drop");
    hideGhost();
    removeLandingGuides();
    hideMouse();
  }

  async function runOutlineScrollDemo(runId) {
    const host = bestVerticalOutlineHost();
    const source =
      host?.querySelector(":scope > .node-card[data-node-id]") ||
      document.querySelector(".node-card[data-node-id]");
    if (!host || !source) return;

    const initialSlots = verticalInsertionSlots(host);
    if (!initialSlots.length) return;

    const from = centerOf(source, .45, .4);
    let slotIndex = Math.min(1, initialSlots.length - 1);
    let currentSlot = initialSlots[slotIndex];
    const startPoint = {
      x: currentSlot.left + currentSlot.width * .55,
      y: currentSlot.top
    };

    showGhost(source.querySelector("strong")?.textContent || "Setting", from);
    showLandingGuide(currentSlot, "Exact insertion gap");
    await moveMouse(from, 420, runId);
    if (runId !== demoRunId) return;

    const { mouse } = elements();
    mouse?.classList.add("pressed");
    await moveMouse(startPoint, 650, runId);
    if (runId !== demoRunId) return;

    showDemoLabel("Blue line stays between nodes", startPoint);
    await wait(360);
    mouse?.classList.add("scrolling");

    for (let phase = 0; phase < 5 && runId === demoRunId; phase += 1) {
      let slots = verticalInsertionSlots(host);
      if (!slots.length) break;

      slotIndex = Math.min(slots.length - 1, slotIndex + 1);
      currentSlot = slots[slotIndex];
      let target = {
        x: currentSlot.left + currentSlot.width * .56,
        y: Math.min(window.innerHeight - 34, Math.max(34, currentSlot.top))
      };

      showLandingGuide(currentSlot, "Wheel moves the landing position");
      showDemoLabel(
        phase < 2
          ? "Wheel ↓ → next insertion gap"
          : "Auto-scroll keeps the gap visible",
        target
      );
      await moveMouse(target, 260, runId);
      if (runId !== demoRunId) return;

      if (currentSlot.top > window.innerHeight - 92) {
        window.scrollBy({
          top: Math.max(48, window.innerHeight * .07),
          left: 0,
          behavior: "auto"
        });
        await wait(TOUR_SCROLL_TIMING.autoScrollInterval + 55);
        slots = verticalInsertionSlots(host);
        currentSlot = slots[Math.min(slotIndex, slots.length - 1)] || currentSlot;
        showLandingGuide(currentSlot, "Same insertion gap after scroll");
      }
      await wait(280);
    }

    for (let phase = 0; phase < 2 && runId === demoRunId; phase += 1) {
      const slots = verticalInsertionSlots(host);
      slotIndex = Math.max(0, slotIndex - 1);
      currentSlot = slots[slotIndex];
      const target = {
        x: currentSlot.left + currentSlot.width * .56,
        y: currentSlot.top
      };
      showLandingGuide(currentSlot, "Previous insertion gap");
      showDemoLabel("Wheel ↑ → previous insertion gap", target);
      await moveMouse(target, 240, runId);
      await wait(260);
    }

    mouse?.classList.remove("scrolling", "pressed");
    hideGhost();
    removeLandingGuides();
    hideMouse();
  }

  async function runOutlineNestedDemo(runId) {
    const lanes = [...document.querySelectorAll(".option-lane[data-container]")];
    const source =
      document.querySelector(".node-card.setting[data-node-id]") ||
      document.querySelector(".node-card[data-node-id]");
    const targetLane = lanes[lanes.length > 1 ? 1 : 0];

    if (!source || !targetLane) {
      return runOutlineRootDrag(runId);
    }

    const dropZone = targetLane.querySelector(":scope > .drop-zone") || targetLane;
    const nestedSlots = verticalInsertionSlots(dropZone);
    const nestedSlot = nestedSlots[Math.min(1, nestedSlots.length - 1)] || nestedSlots[0];
    const from = centerOf(source, .42, .36);
    const to = nestedSlot
      ? { x: nestedSlot.left + nestedSlot.width * .55, y: nestedSlot.top }
      : centerOf(dropZone, .55, .55);

    showGhost(source.querySelector("strong")?.textContent || "Setting", from);
    showDemoLabel("Drop inside nested section", to);
    showLandingGuide(nestedSlot, "Nested insertion gap");
    await dragMouse(from, to, 1150, runId);
    pulseAt(dropZone, "rml-setup-demo-drop");
    hideGhost();
    removeLandingGuides();
    hideMouse();
    await wait(380);

    const sectionHost = [...document.querySelectorAll(".controller-options")]
      .find(host =>
        directChildrenWithClass(host, "option-lane").length >= 2 &&
        !host.closest(".option-pointer-ghost")
      );

    const sectionLanes = sectionHost
      ? directChildrenWithClass(sectionHost, "option-lane")
      : [];

    if (!sectionHost || sectionLanes.length < 2 || runId !== demoRunId) return;

    const draggedLane = sectionLanes[Math.min(1, sectionLanes.length - 1)];
    const handle = draggedLane.querySelector(".option-heading") || draggedLane;
    const start = centerOf(handle, .5, .5);

    showGhost(
      handle.textContent?.trim().replace(/\s+/g, " ").slice(0, 48) || "Section",
      start,
      "setting"
    );
    await moveMouse(start, 420, runId);
    if (runId !== demoRunId) return;

    const { mouse } = elements();
    mouse?.classList.add("pressed", "scrolling", "horizontal-wheel");

    let slots = horizontalSectionSlots(sectionHost);
    let index = Math.min(1, slots.length - 1);

    for (let phase = 0; phase < Math.min(3, slots.length) && runId === demoRunId; phase += 1) {
      slots = horizontalSectionSlots(sectionHost);
      index = Math.min(slots.length - 1, index + (phase > 0 ? 1 : 0));
      const slot = slots[index];
      showLandingGuide(slot, "Wheel → next horizontal position");
      const point = { x: slot.left, y: slot.top + slot.height * .48 };
      showDemoLabel("Wheel ↓ / → moves section right", point);
      await moveMouse({
        x: Math.min(window.innerWidth - 36, Math.max(36, point.x - 20)),
        y: point.y
      }, 300, runId);
      await wait(300);
    }

    if (runId === demoRunId) {
      slots = horizontalSectionSlots(sectionHost);
      index = Math.max(0, index - 1);
      const slot = slots[index];
      showLandingGuide(slot, "Wheel → previous horizontal position");
      const point = { x: slot.left, y: slot.top + slot.height * .48 };
      showDemoLabel("Wheel ↑ / ← moves section left", point);
      await moveMouse({
        x: Math.min(window.innerWidth - 36, Math.max(36, point.x + 20)),
        y: point.y
      }, 320, runId);
      await wait(520);
    }

    mouse?.classList.remove("pressed", "scrolling", "horizontal-wheel");
    hideGhost();
    removeLandingGuides();
    hideMouse();
  }

  function graphDemoError(message, details = null) {
    const error = new Error(`[RML Tour · Graph demo] ${message}`);
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

  async function ensureGraphDemoNodes(runId = demoRunId) {
    const paletteBoolean = document.querySelector('[data-graph-operator="constant.bool"]');
    const paletteNot = document.querySelector('[data-graph-operator="logic.not"]');

    if (!graphDemoFindNode(/(?:^|\s)Boolean Constant(?:\s|$)/i)) {
      if (!paletteBoolean) graphDemoError("Boolean Constant is missing and its palette entry was not found.");
      paletteBoolean.click();
    }

    if (!graphDemoFindNode(/(?:^|\s)NOT(?:\s|$)/i)) {
      if (!paletteNot) graphDemoError("NOT is missing and its palette entry was not found.");
      paletteNot.click();
    }

    for (let attempt = 0; attempt < 40 && runId === demoRunId; attempt += 1) {
      const pair = graphDemoSocketPair(false);
      if (pair.output && pair.input) return pair;
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

    graphDemoError("Could not resolve a visible Boolean Constant output and NOT input after 40 render frames.", nodes);
  }

  async function runGraphCreateDemo(runId) {
    await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;
    await wait(180);
    const palette = document.querySelector('[data-graph-operator="constant.bool"]') || document.querySelector(".rml-graph-palette-item");
    const viewport = document.querySelector(".rml-graph-viewport");
    if (!palette || !viewport) return;
    const from = centerOf(palette);
    const rect = viewport.getBoundingClientRect();
    const to = { x: rect.left + rect.width * .58, y: rect.top + rect.height * .42 };
    showGhost("Boolean Constant", from, "graph-node");
    showDemoLabel("Drag node into graph", to);
    await dragMouse(from, to, 1200, runId);
    hideGhost();
    pulseAt(viewport, "rml-setup-demo-drop");
    hideMouse();
  }

  function graphDemoSocketPair(throwOnFailure = true) {
    const boolNode = graphDemoFindNode(/(?:^|\s)Boolean Constant(?:\s|$)/i);
    const notNode = graphDemoFindNode(/(?:^|\s)NOT(?:\s|$)/i);

    const chooseSocket = (node, direction, preferredPortIds) => {
      if (!node) return null;
      const sockets = [...node.querySelectorAll(`.rml-graph-socket[data-direction="${direction}"]`)];
      return (
        preferredPortIds
          .map(portId => sockets.find(socket => socket.dataset.portId === portId && graphDemoVisible(socket)))
          .find(Boolean) ||
        sockets.find(socket => socket.dataset.concreteType === "bool" && graphDemoVisible(socket)) ||
        sockets.find(graphDemoVisible) ||
        null
      );
    };

    const output = chooseSocket(boolNode, "output", ["value", "result"]);
    const input = chooseSocket(notNode, "input", ["value", "input", "a"]);

    if ((!boolNode || !notNode || !output || !input) && throwOnFailure) {
      graphDemoError("Socket lookup failed.", {
        booleanNodeFound: Boolean(boolNode),
        notNodeFound: Boolean(notNode),
        outputFound: Boolean(output),
        inputFound: Boolean(input),
        booleanTitle: graphDemoNodeTitle(boolNode),
        notTitle: graphDemoNodeTitle(notNode)
      });
    }

    return { boolNode, notNode, output, input };
  }


  async function nativeGraphPointerDrag(
    source,
    target,
    duration,
    runId,
    label = "Drag graph wire"
  ) {
    if (!source || !target || runId !== demoRunId) {
      return false;
    }

    const from = centerOf(source);
    const to = centerOf(target);

    const ui = elements();
    const mouse = ui.mouse;

    const wireKey =
      ui.wire ||
      ui.wireSecondary ||
      ui.wireTertiary;

    if (!wireKey) {
      return false;
    }

    ensureDemoWireCanvas();
    resizeDemoWireCanvas();

    const color =
      getComputedStyle(source)
        .getPropertyValue("--port-color")
        .trim() ||
      source.style.getPropertyValue("--port-color") ||
      "#6ce89b";

    showDemoLabel(label, {
      x: (from.x + to.x) / 2,
      y: (from.y + to.y) / 2
    });

    await moveMouse(
      from,
      420,
      runId
    );

    if (runId !== demoRunId) {
      return false;
    }

    mouse?.classList.add(
      "active",
      "pressed"
    );

    setDemoCanvasWire(
      wireKey,
      from,
      from,
      0,
      {
        color,
        dashed: false,
        width: 5,
        visible: true
      }
    );

    const started =
      performance.now();

    while (runId === demoRunId) {
      const raw =
        Math.min(
          1,
          (
            performance.now() -
            started
          ) /
          Math.max(
            1,
            duration
          )
        );

      const eased =
        raw < 0.5
          ? 2 * raw * raw
          : 1 -
            Math.pow(
              -2 * raw + 2,
              2
            ) / 2;

      const point = {
        x:
          from.x +
          (
            to.x -
            from.x
          ) *
          eased,

        y:
          from.y +
          (
            to.y -
            from.y
          ) *
          eased
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

      setDemoCanvasWire(
        wireKey,
        from,
        point,
        0,
        {
          color,
          dashed: false,
          width: 5,
          visible: true
        }
      );

      if (raw >= 1) {
        break;
      }

      await new Promise(
        resolve =>
          requestAnimationFrame(
            resolve
          )
      );
    }

    if (runId !== demoRunId) {
      return false;
    }

    setDemoCanvasWire(
      wireKey,
      from,
      to,
      0,
      {
        color,
        dashed: false,
        width: 5,
        visible: true
      }
    );

    mouse?.classList.remove(
      "pressed"
    );

    pulseAt(
      target,
      "rml-setup-demo-drop"
    );

    await wait(650);

    return runId === demoRunId;
  }

  async function nativeGraphNodeDrag(article, targetPoint, duration, runId) {
    const header = article?.querySelector(".rml-graph-node-header") || article;
    if (!header || !targetPoint || runId !== demoRunId) return false;
    const from = centerOf(header);
    const pointerId = 9108;
    await moveMouse(from, 260, runId);
    if (runId !== demoRunId) return false;
    header.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 1, clientX: from.x, clientY: from.y
    }));
    const started = performance.now();
    const { mouse } = elements();
    mouse?.classList.add("pressed");
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
      document.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
        isPrimary: true, button: -1, buttons: 1, clientX: point.x, clientY: point.y
      }));
      if (raw >= 1) break;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    document.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 0,
      clientX: targetPoint.x, clientY: targetPoint.y
    }));
    mouse?.classList.remove("pressed");
    return runId === demoRunId;
  }


  async function nativeGraphPointerDrag(startElement, targetPoint, duration, runId, pointerId = 9110) {
    if (!startElement || !targetPoint || runId !== demoRunId) return false;

    if (
      !startElement.isConnected ||
      !graphDemoVisible(startElement)
    ) {
      graphDemoError(
        "Pointer drag was asked to start from a stale or invisible graph socket.",
        {
          connected: Boolean(startElement.isConnected),
          visible: graphDemoVisible(startElement),
          nodeId: startElement.dataset?.nodeId || "",
          portId: startElement.dataset?.portId || "",
          direction: startElement.dataset?.direction || ""
        }
      );
    }

    const from = centerOf(startElement);

    pulseAt(startElement);
    showDemoLabel(
      `Start on the real ${String(startElement.dataset.direction || "socket").toUpperCase()} port`,
      from
    );

    await moveMouse(from, 360, runId);
    if (runId !== demoRunId) return false;

    await wait(180);
    if (runId !== demoRunId) return false;

    startElement.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 1, clientX: from.x, clientY: from.y
    }));

    const { mouse } = elements();
    mouse?.classList.add("pressed");

    await wait(100);
    if (runId !== demoRunId) return false;

    const started = performance.now();

    while (runId === demoRunId) {
      const raw = Math.min(1, (performance.now() - started) / Math.max(1, duration));
      const eased = 1 - Math.pow(1 - raw, 2.4);
      const point = {
        x: from.x + (targetPoint.x - from.x) * eased,
        y: from.y + (targetPoint.y - from.y) * eased
      };

      mouse?.style.setProperty("--mouse-x", `${point.x}px`);
      mouse?.style.setProperty("--mouse-y", `${point.y}px`);
      mouse?.style.setProperty("--mouse-duration", "0ms");

      document.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
        isPrimary: true, button: -1, buttons: 1, clientX: point.x, clientY: point.y
      }));

      if (raw >= 1) break;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }

    document.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 0, clientX: targetPoint.x, clientY: targetPoint.y
    }));

    mouse?.classList.remove("pressed");

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

    return runId === demoRunId;
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

  function graphDemoSafeEmptyDropPoint(
    viewport,
    sourcePoint,
    {
      prefer = "right",
      reserveWidth = 300,
      reserveHeight = 190
    } = {}
  ) {
    const viewportRect =
      viewport?.getBoundingClientRect();

    if (!viewportRect) {
      return sourcePoint;
    }

    const cardRect =
      elements().card?.getBoundingClientRect();

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

    const visibleNodes =
      [...document.querySelectorAll(
        ".rml-graph-node"
      )]
        .filter(graphDemoVisible);

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

    if (viewportTooSmall) {
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

        const createdNodeOverlaps =
          placementBlockedRects.some(rect =>
            pointToRectOverlap(
              point,
              rect,
              24
            )
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

        if (
          createdNodeOverlaps ||
          dragPathBlocked
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

        return point;
      }
    }

    graphDemoError(
      "Step 9 could not find a fully visible free drop area for the automatic helper node at the current viewport size.",
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

    const ok =
      await nativeGraphPointerDrag(
        socket,
        dropPoint,
        700,
        runId,
        pointerId
      );

    if (
      !ok ||
      runId !== demoRunId
    ) {
      return null;
    }

    const created =
      await graphDemoWaitForNewNode(
        beforeIds,
        runId,
        expectedTitle
      );

    if (!created) {
      graphDemoError(
        `Dropping ${socket.dataset.direction || "socket"} on empty graph did not create the expected automatic helper node.`,
        {
          socket:
            socket.dataset,
          dropPoint,
          expectedTitle:
            expectedTitle?.source ||
            null
        }
      );
    }

    created.scrollIntoView?.({
      block: "nearest",
      inline: "nearest",
      behavior: "auto"
    });

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

    pulseAt(
      created,
      "rml-setup-demo-drop"
    );

    return created;
  }

  async function runGraphWireDemo(runId) {
    console.info("[RML Tour · Step 9] Starting typed socket animation.", { runId });

    const ensuredPair = await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;
    await wait(120);

    const { output, input } = ensuredPair || graphDemoSocketPair(true);

    if (!graphDemoVisible(output) || !graphDemoVisible(input)) {
      graphDemoError("Resolved sockets exist but are not visibly rendered.", {
        output: output?.dataset,
        input: input?.dataset
      });
    }

    syncDemoWireViewport();

    const a =
      centerOf(output);

    const b =
      centerOf(input);

    const ui =
      elements();

    if (!ui.root) graphDemoError("Tour root #rml-setup-assistant is missing.");
    if (!ui.mouse) graphDemoError("Animated tour mouse [data-setup-mouse] is missing.");
    if (!ui.wire) graphDemoError("Primary tour wire [data-setup-demo-wire] is missing.");
    if (!ui.wireSecondary) graphDemoError("Secondary tour wire [data-setup-demo-wire-secondary] is missing.");
    if (!ui.wireTertiary) graphDemoError("Tertiary tour wire [data-setup-demo-wire-tertiary] is missing.");

    const canvas = ensureDemoWireCanvas();
    if (!canvas || !demoWireCanvasContext) {
      graphDemoError("Tour wire canvas or its 2D rendering context could not be created.");
    }

    pulseAt(output);
    pulseAt(input);

    showDemoLabel(
      "1 · Move to output socket",
      a
    );

    await moveMouse(
      a,
      300,
      runId
    );

    if (runId !== demoRunId) return;

    ui.mouse?.classList.add("pressed");
    await wait(90);

    if (ui.wire) {
      ui.wire.style.stroke =
        getComputedStyle(output)
          .getPropertyValue(
            "--port-color"
          )
          .trim() ||
        "#6ce89b";

      ui.wire.hidden = false;
      ui.wire.classList.add(
        "dragging"
      );
    }

    showDemoLabel(
      "2 · Hold and drag — endpoint follows the mouse",
      {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      }
    );

    ui.wire.hidden = false;
    ui.wire.style.setProperty(
      "display",
      "block",
      "important"
    );
    ui.wire.style.setProperty(
      "visibility",
      "visible",
      "important"
    );
    ui.wire.style.setProperty(
      "opacity",
      "1",
      "important"
    );
    ui.wire.style.setProperty(
      "stroke",
      getComputedStyle(output)
        .getPropertyValue("--port-color")
        .trim() || "#6ce89b",
      "important"
    );
    ui.wire.style.setProperty(
      "stroke-width",
      "6",
      "important"
    );
    ui.wire.style.setProperty(
      "fill",
      "none",
      "important"
    );

    ui.mouse?.classList.add(
      "active",
      "pressed"
    );

    const connected =
      await animatePathDrawing(
        ui.wire,
        a,
        b,
        720,
        runId,
        0,
        {
          followMouse: true,
          className: "drawing"
        }
      );

    if (runId !== demoRunId) return;
    if (!connected) {
      graphDemoError("Primary socket-to-socket animation returned false unexpectedly.");
    }

    pulseAt(
      input,
      "rml-setup-demo-drop"
    );

    showDemoLabel(
      "3 · Release on compatible input",
      b
    );

    await wait(180);

    ui.mouse?.classList.remove(
      "pressed"
    );

    ui.wire?.classList.remove(
      "dragging"
    );

    ui.wire?.classList.add(
      "connected"
    );

    await wait(320);

    ui.wire?.classList.remove(
      "connected"
    );

    if (runId !== demoRunId) return;

    showDemoLabel("3 · The demonstrated line is now a real graph wire", b);
    const tourBridge = window.RMLTypedNodeGraphTourBridge;
    const committedWireId = tourBridge?.ensureConnection?.(
      output.dataset.nodeId, output.dataset.portId,
      input.dataset.nodeId, input.dataset.portId
    );
    if (!committedWireId) {
      await nativeGraphPointerDrag(output, b, 360, runId, 9111);
    }
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (runId !== demoRunId) return;
    ui.wire.hidden = true;
    ui.wire.setAttribute("d", "");
    hideDemoCanvasWire(ui.wire);
    await wait(180);

    const livePairAfterConnection =
      graphDemoSocketPair(true);

    const liveOutput =
      livePairAfterConnection.output;

    if (
      !liveOutput ||
      !liveOutput.isConnected ||
      !graphDemoVisible(liveOutput)
    ) {
      graphDemoError(
        "Step 9 could not re-resolve the live output socket after committing the first wire."
      );
    }

    const liveOutputPoint =
      centerOf(liveOutput);

    const viewport =
      document.querySelector(
        ".rml-graph-viewport"
      );

    if (!viewport) {
      graphDemoError(
        "Graph viewport .rml-graph-viewport disappeared during Step 9."
      );
    }

    let outputDropPoint =
      graphDemoSafeEmptyDropPoint(
        viewport,
        liveOutputPoint,
        {
          prefer: "right",
          reserveWidth: 300,
          reserveHeight: 185
        }
      );

    showDemoLabel(
      "4 · Start at the REAL OUTPUT port, then drag into empty space",
      liveOutputPoint
    );

    outputDropPoint =
      graphDemoSafeEmptyDropPoint(
        viewport,
        centerOf(liveOutput),
        {
          prefer: "right",
          reserveWidth: 300,
          reserveHeight: 185
        }
      );

    const createdDisplay =
      await graphDemoRealDropToEmpty(
        liveOutput,
        outputDropPoint,
        runId,
        {
          pointerId: 9114,
          expectedTitle:
            /^Display Value$/i,
          label:
            "Release here — safely away from the Help card and viewport edges"
        }
      );

    if (
      runId !== demoRunId
    ) {
      return;
    }

    showDemoLabel(
      "Display Value appeared automatically and is already connected",
      centerOf(createdDisplay)
    );

    await wait(760);

    if (
      runId !== demoRunId
    ) {
      return;
    }

    const refreshedPairAfterDisplay =
      graphDemoSocketPair(true);

    const refreshedInput =
      refreshedPairAfterDisplay.input;

    if (
      !refreshedInput ||
      !refreshedInput.isConnected ||
      !graphDemoVisible(refreshedInput)
    ) {
      graphDemoError(
        "Step 9 could not re-resolve the live input socket after creating Display Value."
      );
    }

    const refreshedInputPoint =
      centerOf(refreshedInput);

    let inputDropPoint =
      graphDemoSafeEmptyDropPoint(
        viewport,
        refreshedInputPoint,
        {
          prefer: "left",
          reserveWidth: 300,
          reserveHeight: 185
        }
      );

    showDemoLabel(
      "5 · Start at the REAL VALUE INPUT port, then drag into empty space",
      refreshedInputPoint
    );

    inputDropPoint =
      graphDemoSafeEmptyDropPoint(
        viewport,
        centerOf(refreshedInput),
        {
          prefer: "left",
          reserveWidth: 300,
          reserveHeight: 185
        }
      );

    const createdSource =
      await graphDemoRealDropToEmpty(
        refreshedInput,
        inputDropPoint,
        runId,
        {
          pointerId: 9115,
          expectedTitle:
            /^Boolean Constant$/i,
          label:
            "Release here — the real typed source will appear at this position"
        }
      );

    if (
      runId !== demoRunId
    ) {
      return;
    }

    showDemoLabel(
      `${graphDemoNodeTitle(createdSource) || "Typed source"} appeared automatically and is connected`,
      centerOf(createdSource)
    );

    await wait(760);

    showDemoLabel(
      "Impulse / unsafe inputs still need an explicit compatible source",
      b
    );
    await wait(320);

    hideMouse();
    console.info("[RML Tour · Step 9] Typed socket animation completed successfully.", { runId });
  }


  function setRealPortGlow(socket, active) {
    if (!(socket instanceof Element)) return;

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

  async function runGraphPortFlipDemo(runId) {
    await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;

    let article =
      [...document.querySelectorAll(".rml-graph-node")].find(node =>
        /^NOT$/i.test(graphDemoNodeTitle(node)) &&
        node.querySelector(".rml-graph-node-flip")
      ) ||
      [...document.querySelectorAll(".rml-graph-node")].find(node =>
        node.querySelector(".rml-graph-node-flip")
      );

    if (!article) return;

    const nodeId = article.dataset.graphNodeId;
    let flip = article.querySelector(".rml-graph-node-flip");
    let beforeInput =
      article.querySelector(
        '.rml-graph-socket[data-direction="input"]'
      );
    let beforeOutput =
      article.querySelector(
        '.rml-graph-socket[data-direction="output"]'
      );

    if (!flip || !beforeInput || !beforeOutput) return;

    const flipPoint = centerOf(flip);

    clearRealPortGlows();
    setRealPortGlow(beforeInput, true);
    setRealPortGlow(beforeOutput, true);

    showDemoLabel(
      "These REAL input / output ports will switch sides",
      centerOf(article)
    );

    await wait(620);
    if (runId !== demoRunId) return;

    showDemoLabel(
      "Click ⇄ — watch the real named ports move",
      flipPoint
    );

    await moveMouse(
      flipPoint,
      430,
      runId
    );

    if (runId !== demoRunId) return;

    await wait(180);
    await clickMouse(runId);
    clearRealPortGlows();
    flip.click();

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

    if (runId !== demoRunId) return;

    article =
      document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
      );

    if (!article) return;

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
      `${inputName} / ${outputName} — real ports are now on the opposite sides`,
      centerOf(article)
    );

    pulseAt(afterInput);
    pulseAt(afterOutput);

    await wait(900);
    if (runId !== demoRunId) return;

    flip =
      article.querySelector(
        ".rml-graph-node-flip"
      );

    if (!flip) return;

    const restorePoint =
      centerOf(flip);

    showDemoLabel(
      "Click ⇄ again → restore the real ports",
      restorePoint
    );

    await moveMouse(
      restorePoint,
      430,
      runId
    );

    if (runId !== demoRunId) return;

    await wait(180);
    await clickMouse(runId);

    clearRealPortGlows();
    flip.click();

    await new Promise(resolve =>
      requestAnimationFrame(() =>
        requestAnimationFrame(resolve)
      )
    );

    if (runId !== demoRunId) return;

    const restored =
      document.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`
      );

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
      "Original sides restored — glow is on the REAL named ports",
      centerOf(restored || article)
    );

    await wait(720);

    clearRealPortGlows();
    restored?.classList.remove(
      "rml-setup-flip-active"
    );
    article?.classList.remove(
      "rml-setup-flip-active"
    );
    hideMouse();
  }

  async function runGraphRouteDemo(runId) {
    const viewport = document.querySelector(".rml-graph-viewport");
    if (!viewport || runId !== demoRunId) return;

    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const ui = elements();
    const realHits = () => [...document.querySelectorAll(".rml-graph-wire-hit")].filter(graphDemoVisible);
    const pair = await ensureGraphDemoNodes(runId);
    if (runId !== demoRunId) return;
    const output = pair?.output || graphDemoSocketPair(false).output;
    const input = pair?.input || graphDemoSocketPair(false).input;
    const tourBridge = window.RMLTypedNodeGraphTourBridge;
    let baseWireId = null;

    if (output && input && tourBridge?.ensureConnection) {
      baseWireId = tourBridge.ensureConnection(
        output.dataset.nodeId, output.dataset.portId,
        input.dataset.nodeId, input.dataset.portId
      );
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    }

    let parentHit = baseWireId
      ? realHits().find(hit => hit.dataset.connectionId === baseWireId) || null
      : null;

    if (!parentHit && output && input) {
      await nativeGraphPointerDrag(output, centerOf(input), 520, runId, 9111);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      parentHit = realHits()[0] || null;
    }

    if (!parentHit) {
      console.warn("[RML Tour · Graph demo] Routing step could not create its base wire; the assistant remains usable.");
      showDemoLabel("Base wire is temporarily unavailable — resize/re-enter this step to retry", centerOf(viewport));
      await wait(850);
      return;
    }

    let branchNode = document.querySelector('.rml-graph-node[data-rml-tour-step10-branch="true"]');
    if (!branchNode) {
      const paletteNot = document.querySelector('[data-graph-operator="logic.not"]');
      if (!paletteNot) graphDemoError("Routing step needs the NOT node palette entry.");

      const beforeIds = new Set(
        [...document.querySelectorAll(".rml-graph-node")].map(node => node.dataset.graphNodeId)
      );
      paletteNot.click();
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      if (runId !== demoRunId) return;

      branchNode = [...document.querySelectorAll(".rml-graph-node")].find(
        node => !beforeIds.has(node.dataset.graphNodeId) && /^NOT$/i.test(graphDemoNodeTitle(node))
      );
      if (!branchNode) graphDemoError("Routing step could not create its single branch NOT node.");
      branchNode.dataset.rmlTourStep10Branch = "true";
    }

    const vr = viewport.getBoundingClientRect();
    const primaryNot = [...document.querySelectorAll(".rml-graph-node")].find(
      node => node !== branchNode && /^NOT$/i.test(graphDemoNodeTitle(node))
    );
    const primaryRect = primaryNot?.getBoundingClientRect();
    const branchRect = branchNode.getBoundingClientRect();
    const desiredBranchCenter = {
      x: Math.min(
        vr.right - Math.max(90, branchRect.width * .55),
        Math.max(
          vr.left + vr.width * .72,
          (primaryRect?.right || vr.left + vr.width * .48) + Math.max(170, branchRect.width * .70)
        )
      ),
      y: Math.min(
        vr.bottom - Math.max(70, branchRect.height * .60),
        Math.max(
          vr.top + vr.height * .74,
          (primaryRect?.bottom || vr.top + vr.height * .48) + Math.max(125, branchRect.height * .85)
        )
      )
    };

    showDemoLabel("Move the second NOT away so both routes stay visible", centerOf(branchNode));
    await nativeGraphNodeDrag(branchNode, desiredBranchCenter, 560, runId);
    if (runId !== demoRunId) return;

    const branchId = branchNode.dataset.graphNodeId;
    branchNode = document.querySelector(`.rml-graph-node[data-graph-node-id="${CSS.escape(branchId)}"]`) || branchNode;
    branchNode.dataset.rmlTourStep10Branch = "true";
    const branchInput = [...branchNode.querySelectorAll('.rml-graph-socket[data-direction="input"]')].find(graphDemoVisible);
    if (!branchInput) graphDemoError("Routing step branch node has no visible input socket.");

    parentHit = realHits()[0] || parentHit;
    const junctionTarget = graphSvgPathPoint(parentHit, .52);
    const inputPoint = centerOf(branchInput);
    const previewKey = ui.wire || ui.wireSecondary || ui.wireTertiary;
    const previewColor = getComputedStyle(branchInput).getPropertyValue("--port-color").trim() || "#6ce89b";
    showDemoLabel("Drag this INPUT onto the existing line → junction", inputPoint);
    await moveMouse(inputPoint, 300, runId);
    if (runId !== demoRunId) return;

    suppressNativeGraphWirePreview(true);

    const pointerId = 9112;
    branchInput.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 1,
      clientX: inputPoint.x, clientY: inputPoint.y
    }));
    ui.mouse?.classList.add("pressed");

    const started = performance.now();
    const duration = 760;
    while (runId === demoRunId) {
      const raw = Math.min(1, (performance.now() - started) / duration);
      const eased = 1 - Math.pow(1 - raw, 2.2);
      const point = {
        x: inputPoint.x + (junctionTarget.x - inputPoint.x) * eased,
        y: inputPoint.y + (junctionTarget.y - inputPoint.y) * eased
      };
      ui.mouse?.style.setProperty("--mouse-x", `${point.x}px`);
      ui.mouse?.style.setProperty("--mouse-y", `${point.y}px`);
      ui.mouse?.style.setProperty("--mouse-duration", "0ms");
      if (previewKey) {
        const previewDistance = Math.hypot(
          point.x - inputPoint.x,
          point.y - inputPoint.y
        );

        if (previewDistance >= 10) {
          setDemoCanvasWire(previewKey, inputPoint, point, 0, {
            color: previewColor,
            dashed: false,
            width: 5,
            visible: true
          });
        } else {
          hideDemoCanvasWire(previewKey);
        }
      }
      document.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
        isPrimary: true, button: -1, buttons: 1,
        clientX: point.x, clientY: point.y
      }));
      if (raw >= 1) break;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }

    document.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 0,
      clientX: junctionTarget.x, clientY: junctionTarget.y
    }));
    ui.mouse?.classList.remove("pressed");
    suppressNativeGraphWirePreview(false);
    if (previewKey) hideDemoCanvasWire(previewKey);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (runId !== demoRunId) return;

    const junctions = [...document.querySelectorAll(".rml-graph-wire-point")].filter(graphDemoVisible);
    const junction = junctions.find(point => {
      const r = point.getBoundingClientRect();
      const c = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      return Math.hypot(c.x - junctionTarget.x, c.y - junctionTarget.y) < 45;
    }) || junctions[0] || null;

    if (!junction) {
      graphDemoError("Routing step could not create a real junction.");
    }
    pulseAt(junction);
    showDemoLabel("REAL junction / crossing created", centerOf(junction));
    await wait(520);

    const segment = realHits().find(hit => hit.dataset.connectionId === parentHit.dataset.connectionId) || realHits()[0];
    if (!segment) graphDemoError("Routing step could not find a real wire segment to bend.");
    const segmentStart = graphSvgPathPoint(segment, .68);
    const bendTarget = {
      x: Math.min(vr.right - 80, segmentStart.x + 90),
      y: Math.max(vr.top + 80, segmentStart.y - 115)
    };

    showDemoLabel("Drag the REAL line → create bend point", segmentStart);
    await moveMouse(segmentStart, 320, runId);
    if (runId !== demoRunId) return;

    const bendPointerId = 9113;
    segment.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, pointerId: bendPointerId, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 1,
      clientX: segmentStart.x, clientY: segmentStart.y
    }));
    ui.mouse?.classList.add("pressed");

    const bendStarted = performance.now();
    const bendDuration = 760;
    while (runId === demoRunId) {
      const raw = Math.min(1, (performance.now() - bendStarted) / bendDuration);
      const eased = 1 - Math.pow(1 - raw, 2.15);
      const point = {
        x: segmentStart.x + (bendTarget.x - segmentStart.x) * eased,
        y: segmentStart.y + (bendTarget.y - segmentStart.y) * eased
      };
      ui.mouse?.style.setProperty("--mouse-x", `${point.x}px`);
      ui.mouse?.style.setProperty("--mouse-y", `${point.y}px`);
      ui.mouse?.style.setProperty("--mouse-duration", "0ms");
      document.dispatchEvent(new PointerEvent("pointermove", {
        bubbles: true, cancelable: true, pointerId: bendPointerId, pointerType: "mouse",
        isPrimary: true, button: -1, buttons: 1,
        clientX: point.x, clientY: point.y
      }));
      if (raw >= 1) break;
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    document.dispatchEvent(new PointerEvent("pointerup", {
      bubbles: true, cancelable: true, pointerId: bendPointerId, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 0,
      clientX: bendTarget.x, clientY: bendTarget.y
    }));
    ui.mouse?.classList.remove("pressed");
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (runId !== demoRunId) return;

    const pointsAfter = [...document.querySelectorAll(".rml-graph-wire-point")].filter(graphDemoVisible);
    const bendPoint = pointsAfter.find(point => {
      const c = centerOf(point);
      return Math.hypot(c.x - bendTarget.x, c.y - bendTarget.y) < 55;
    }) || pointsAfter[pointsAfter.length - 1] || null;

    if (!bendPoint || pointsAfter.length <= junctions.length) {
      console.warn("[RML Tour · Graph demo] The real bend point was not created; skipping the final highlight without aborting the tour.");
      showDemoLabel("Bend point was not accepted — the tour stays active", bendTarget);
      await wait(650);
      return;
    }
    pulseAt(bendPoint);
    showDemoLabel("REAL movable bend point created", centerOf(bendPoint));
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
    if (!target) return;

    target.dispatchEvent(
      new WheelEvent(
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
      )
    );
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
            Math.max(1, duration)
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
    const style = getComputedStyle(element);
    return (
      rect.width > 2 &&
      rect.height > 2 &&
      style.display !== "none" &&
      style.visibility !== "hidden"
    );
  }

  function tourClickFirstVisible(selectors) {
    for (const selector of selectors) {
      const control = [...document.querySelectorAll(selector)]
        .find(tourElementActuallyVisible);
      if (control) {
        control.click();
        return true;
      }
    }
    return false;
  }

  function ensureTourGraphSidebarsVisible() {
    const body = document.body;

    const leftCollapsed = [
      "rml-graph-left-collapsed",
      "rml-outline-left-collapsed",
      "rml-builder-left-collapsed",
      "rml-left-collapsed",
      "palette-collapsed"
    ].some(name => body.classList.contains(name));

    const rightCollapsed = [
      "rml-graph-right-collapsed",
      "rml-outline-right-collapsed",
      "rml-builder-right-collapsed",
      "rml-right-collapsed",
      "inspector-collapsed"
    ].some(name => body.classList.contains(name));

    const leftPanels = [
      document.querySelector(".rml-graph-palette"),
      document.querySelector(".palette"),
      document.querySelector('[data-panel="palette"]'),
      document.querySelector('[data-rml-panel="left"]')
    ].filter(Boolean);

    const rightPanels = [
      document.querySelector(".rml-graph-inspector"),
      document.querySelector(".inspector"),
      document.querySelector('[data-panel="inspector"]'),
      document.querySelector('[data-rml-panel="right"]')
    ].filter(Boolean);

    const leftHidden =
      leftCollapsed ||
      (leftPanels.length > 0 && leftPanels.every(panel => !tourElementActuallyVisible(panel)));

    const rightHidden =
      rightCollapsed ||
      (rightPanels.length > 0 && rightPanels.every(panel => !tourElementActuallyVisible(panel)));

    if (leftHidden) {
      tourClickFirstVisible([
        ".rml-graph-panel-toggle-left",
        "[data-rml-graph-toggle-left]",
        "[data-panel-toggle='left']",
        "[data-rml-panel-toggle='left']",
        ".palette-toggle",
        ".left-panel-toggle"
      ]);
    }

    if (rightHidden) {
      tourClickFirstVisible([
        ".rml-graph-panel-toggle-right",
        "[data-rml-graph-toggle-right]",
        "[data-panel-toggle='right']",
        "[data-rml-panel-toggle='right']",
        ".inspector-toggle",
        ".right-panel-toggle"
      ]);
    }

    requestAnimationFrame(() => requestAnimationFrame(() => {
      const graphLeftStillCollapsed = body.classList.contains("rml-graph-left-collapsed");
      const graphRightStillCollapsed = body.classList.contains("rml-graph-right-collapsed");
      if (graphLeftStillCollapsed) {
        tourClickFirstVisible([".rml-graph-panel-toggle-left", "[data-rml-graph-toggle-left]"]);
      }
      if (graphRightStillCollapsed) {
        tourClickFirstVisible([".rml-graph-panel-toggle-right", "[data-rml-graph-toggle-right]"]);
      }
    }));
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

    const desiredViewportTop =
      rect.height <= availableHeight
        ? usefulTop + (availableHeight - rect.height) * .5
        : usefulTop;

    const currentTop = scroller.scrollTop;
    const absoluteTargetTop = currentTop + rect.top;

    const desiredScrollTop = Math.max(
      0,
      Math.min(
        maxTop,
        absoluteTargetTop - desiredViewportTop
      )
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
      desiredViewportTop,
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

    const rect = target.getBoundingClientRect();
    const viewport = tourViewport();
    const top = tourHeaderBottom() + 14;
    const bottom = viewport.bottom - 14;
    const left = viewport.left + 14;
    const right = viewport.right - 14;
    const availableHeight = Math.max(1, bottom - top);
    const availableWidth = Math.max(1, right - left);

    const verticalOk =
      rect.height <= availableHeight
        ? rect.top >= top && rect.bottom <= bottom
        : Math.abs(rect.top - top) <= 18;

    const horizontalOk =
      rect.width <= availableWidth
        ? rect.left >= left && rect.right <= right
        : rect.left <= left + 18 && rect.right >= right - 18;

    return verticalOk && horizontalOk;
  }

  async function nativeTourScrollTargetIntoView(target, runId = demoRunId) {
    if (!target || runId !== demoRunId) return false;

    ensureTourGraphSidebarsVisible();
    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    if (runId !== demoRunId) return false;

    if (tourTargetComfortablyVisible(target)) return true;

    if (!tourPageRootCanHelpTarget(target)) {
      return true;
    }

    window.RMLTypedNodeGraphScrollLayers?.clear?.();
    window.RMLUniversalScrollLayers?.clear?.();

    const viewport = tourViewport();

    const anchor = document.elementFromPoint(
      viewport.left + Math.min(viewport.width - 24, Math.max(24, viewport.width * .5)),
      tourHeaderBottom() + Math.min(
        Math.max(36, (viewport.bottom - tourHeaderBottom()) * .42),
        Math.max(36, viewport.bottom - tourHeaderBottom() - 24)
      )
    ) || document.body;
    const anchorPoint = centerOf(anchor);

    showKeys(["Ctrl"], anchorPoint);
    showDemoLabel(
      "Assistant uses the real Ctrl + Wheel layer selector to bring this step into view",
      anchorPoint
    );

    const foundHtml = await cycleTourScrollLayerUntil(
      anchor,
      /<html>|Page ROOT/i,
      runId,
      20,
      150
    );

    if (runId !== demoRunId) return false;

    releaseTourScrollModifier();
    hideKeys();

    if (!foundHtml) {
      console.error(
        "[RML Tour] Page ROOT can scroll for this target, but the native <html> layer could not be selected.",
        {
          stepIndex,
          target,
          root: tourPageRootScrollState(),
          state: scrollLayerState()
        }
      );
      return false;
    }

    const mouse = elements().mouse;
    mouse?.classList.add("scrolling");

    for (let attempt = 0; attempt < 72 && runId === demoRunId; attempt += 1) {
      ensureTourGraphSidebarsVisible();

      if (tourTargetComfortablyVisible(target)) break;

      const plan =
        tourPageRootCenteringPlan(target);

      if (!plan.useful) {
        break;
      }

      const deltaY =
        Math.sign(plan.delta) *
        Math.min(
          220,
          Math.max(28, Math.abs(plan.delta))
        );

      dispatchTourWheel(anchor, { deltaY });
      await wait(TOUR_SCROLL_TIMING.autoScrollInterval);
    }

    mouse?.classList.remove("scrolling");

    const ok =
      tourTargetComfortablyVisible(target);

    const finalPlan =
      tourPageRootCenteringPlan(target);

    if (!ok && finalPlan.useful) {
      console.error(
        "[RML Tour] Native Ctrl+Wheel positioning stopped before reaching the best available page position.",
        {
          stepIndex,
          targetRect: target.getBoundingClientRect(),
          viewport: tourViewport(),
          plan: finalPlan,
          state: scrollLayerState()
        }
      );
    }

    window.RMLTypedNodeGraphScrollLayers?.clear?.();
    window.RMLUniversalScrollLayers?.clear?.();

    return ok || !finalPlan.useful;
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

  async function runGraphPanDemo(runId) {
    const viewport =
      document.querySelector(".rml-graph-viewport");
    if (!viewport) return;

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

      for (
        let burst = 0;
        burst < 22 &&
        runId === demoRunId;
        burst += 1
      ) {
        const rect =
          codePanel.getBoundingClientRect();
        const topMargin = 18;
        const bottomMargin = 18;
        const canFit =
          rect.height <=
          window.innerHeight -
            topMargin -
            bottomMargin;
        const fullyVisible = canFit
          ? (
              rect.top >= topMargin &&
              rect.bottom <=
                window.innerHeight - bottomMargin
            )
          : (
              rect.top <= topMargin + 10 &&
              rect.bottom >=
                window.innerHeight - bottomMargin
            );

        if (fullyVisible) break;

        dispatchTourWheel(
          scrollDemo.body,
          { deltaY: 150 }
        );
        await wait(TOUR_SCROLL_TIMING.autoScrollInterval);
      }

      if (runId !== demoRunId) return;

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
        positionShades(codePanel || codeScroller);
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
        for (let burst = 0; burst < 36 && runId === demoRunId; burst += 1) {
          if (tourTargetComfortablyVisible(viewport)) break;
          dispatchTourWheel(returnTarget, { deltaY: -150 });
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
      ensureTourGraphSidebarsVisible();
      positionShades(currentTarget || viewport);
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
      case "outline-palette":
        return runOutlinePaletteDemo(runId);
      case "outline-root-drag":
        return runOutlineRootDrag(runId);
      case "outline-reorder-scroll":
        return runOutlineScrollDemo(runId);
      case "outline-nested":
        return runOutlineNestedDemo(runId);
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
      case "point":
        return runPointDemo(target, runId);
      default:
        return undefined;
    }
  }

  function isComplexDemo(step) {
    return new Set([
      "outline-reorder-scroll",
      "outline-nested",
      "graph-wire",
      "graph-route",
      "graph-pan"
    ]).has(step?.demo);
  }

  async function runDemo(step, target) {
    cancelDemo();
    const runId = demoRunId;
    await wait(240);
    if (runId !== demoRunId) return;

    const runSafely = async () => {
      try {
        clearDemoVisuals();
        await runDemoOnce(step, target, runId);
        return true;
      } catch (error) {
        if (runId === demoRunId) {
          console.warn("[RML Tour] Demo recovered without aborting the assistant.", error);
          const fallback = currentTarget || document.querySelector(".rml-graph-viewport") || document.body;
          showDemoLabel("Demo reset safely — press Back/Next or resize to retry", centerOf(fallback));
        }
        return false;
      }
    };

    const mutatingGraphDemo =
      step?.demo === "graph-route" ||
      step?.demo === "graph-wire" ||
      step?.demo === "graph-pan";

    while (runId === demoRunId) {
      const ok = await runSafely();
      if (runId !== demoRunId || !ok) return;

      if (step?.demo === "graph-pan") {
        restoreTourState(
          stepSnapshots.get(stepIndex)
        );
        ensureTourMode(step);

        await new Promise(resolve =>
          requestAnimationFrame(() =>
            requestAnimationFrame(resolve)
          )
        );

        if (runId !== demoRunId) return;

        const refreshedTarget =
          findTarget(step);

        if (refreshedTarget) {
          clearTarget();
          refreshedTarget.classList.add(
            "rml-setup-target"
          );
          currentTarget =
            refreshedTarget;
          positionShades(
            refreshedTarget
          );
          positionCard(
            refreshedTarget
          );
          target =
            refreshedTarget;
        }

        const freshBody =
          document.querySelector(
            ".rml-graph-node.configuration .rml-graph-node-body, .rml-graph-node .rml-graph-node-body"
          );
        if (freshBody) {
          const freshPoint =
            centerOf(freshBody, .58, .52);
          const mouse = elements().mouse;
          mouse?.classList.add("active");
          mouse?.style.setProperty(
            "--mouse-x",
            `${freshPoint.x}px`
          );
          mouse?.style.setProperty(
            "--mouse-y",
            `${freshPoint.y}px`
          );
          mouse?.style.setProperty(
            "--mouse-duration",
            "0ms"
          );
        }
      }

      const pause =
        isComplexDemo(step)
          ? DEMO_COMPLEX_REPEAT_PAUSE_MS
          : DEMO_REPEAT_PAUSE_MS;

      await wait(pause);
      if (runId !== demoRunId) return;

      if (mutatingGraphDemo && step?.demo !== "graph-pan") {
        restoreTourState(
          stepSnapshots.get(stepIndex)
        );
        ensureTourMode(step);

        await new Promise(resolve =>
          requestAnimationFrame(() =>
            requestAnimationFrame(resolve)
          )
        );

        if (runId !== demoRunId) return;

        const refreshedTarget =
          findTarget(step);

        if (refreshedTarget) {
          clearTarget();
          refreshedTarget.classList.add(
            "rml-setup-target"
          );
          currentTarget =
            refreshedTarget;
          positionShades(
            refreshedTarget
          );
          positionCard(
            refreshedTarget
          );
          target =
            refreshedTarget;
        }
      }
    }
  }

  function captureTourState() {
    return window.RMLBuilderSetupBridge?.capture?.() || null;
  }

  function restoreTourState(value) {
    if (!value) return;
    window.RMLBuilderSetupBridge?.restore?.(value);
  }

  function showStep(index, options = {}) {
    const ui = elements();
    const step = steps[index];
    if (!ui.root || !step) return;
    cancelDemo();
    clearTarget();

    if (options.restoreEntry === true) {
      restoreTourState(stepSnapshots.get(index));
    } else if (options.captureEntry !== false) {
      stepSnapshots.set(index, captureTourState());
    }

    stepIndex = index;
    ensureTourMode(step);
    window.setTimeout(() => {
      if (stepIndex !== index) return;
      let target = findTarget(step);
      if (target) {
        target.classList.add("rml-setup-target");
        currentTarget = target;
      }
      ensureTourGraphSidebarsVisible();
      ui.title.textContent = step.title;
      ui.text.innerHTML = step.text;
      ui.hint.textContent = step.hint || "";
      ui.progress.style.width = `${((index + 1) / steps.length) * 100}%`;
      ui.back.disabled = index === 0;
      ui.next.textContent = index === steps.length - 1 ? "Finish" : "Next";
      requestAnimationFrame(async () => {
        ensureTourGraphSidebarsVisible();

        await new Promise(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        if (stepIndex !== index) return;

        const visualSubject =
          tourVisualSubjectForStep(step, target);

        const mayAutoScroll =
          index > 11 &&
          visualSubject &&
          !tourTargetComfortablyVisible(visualSubject) &&
          tourPageRootCanHelpTarget(visualSubject);

        if (mayAutoScroll) {
          await nativeTourScrollTargetIntoView(
            visualSubject,
            demoRunId
          );
          if (stepIndex !== index) return;
        }

        ensureTourGraphSidebarsVisible();
        await new Promise(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        if (stepIndex !== index) return;

        target = findTarget(step) || target;
        if (target) {
          clearTarget();
          target.classList.add("rml-setup-target");
          currentTarget = target;
        }

        positionShades(target);
        positionCard(target);
        void runDemo(step, target);
      });
    }, step.mode ? 120 : 0);
  }

  function restoreAndClose(markComplete = true) {
    const ui = elements();
    cancelDemo();
    clearTarget();
    document.documentElement.classList.remove("rml-setup-tour-active");
    if (snapshot) window.RMLBuilderSetupBridge?.restore?.(snapshot);

    if (originalTourUiState) {
      const wantsGraph = originalTourUiState.graphMode === true;
      const graphActive = document.body.classList.contains("rml-node-graph-mode");
      if (wantsGraph !== graphActive) {
        (document.querySelector(".rml-pack-button") || document.querySelector("#pack-into-node"))?.click();
      }
      window.scrollTo(originalTourUiState.scrollX, originalTourUiState.scrollY);
    }

    snapshot = null;
    stepSnapshots.clear();
    originalTourUiState = null;
    if (markComplete || firstRunSession) window.RMLBuilderSetupBridge?.markComplete?.();
    firstRunSession = false;
    if (ui.root) ui.root.hidden = true;
  }

  function bindEvents() {
    const ui = elements();
    if (!ui.root || ui.root.dataset.bound === "true") return;
    ui.root.dataset.bound = "true";
    ui.next?.addEventListener("click", () => {
      if (stepIndex >= steps.length - 1) restoreAndClose(true);
      else showStep(stepIndex + 1, { captureEntry: true });
    });
    ui.back?.addEventListener("click", () => {
      if (stepIndex <= 0) return;
      showStep(stepIndex - 1, { restoreEntry: true, captureEntry: false });
    });
    ui.skip?.addEventListener("click", () => restoreAndClose(true));
    const handleViewportChange = () => {
      if (ui.root.hidden) return;
      cancelDemo();
      syncDemoWireViewport();
      positionShades(currentTarget);
      positionCard(currentTarget);
      clearTimeout(viewportRestartTimer);
      viewportRestartTimer = window.setTimeout(() => {
        if (ui.root.hidden) return;
        showStep(stepIndex, { restoreEntry: true, captureEntry: false });
      }, 180);
    };
    window.addEventListener("resize", handleViewportChange, { passive: true });
    window.addEventListener("orientationchange", handleViewportChange, { passive: true });
    window.visualViewport?.addEventListener("resize", handleViewportChange, { passive: true });
    document.addEventListener("keydown", event => {
      if (ui.root.hidden) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        restoreAndClose(true);
      } else if (event.key === "ArrowRight" && !event.shiftKey) {
        event.preventDefault();
        if (stepIndex < steps.length - 1) showStep(stepIndex + 1, { captureEntry: true });
      } else if (event.key === "ArrowLeft" && !event.shiftKey) {
        event.preventDefault();
        if (stepIndex > 0) showStep(stepIndex - 1, { restoreEntry: true, captureEntry: false });
      }
    }, true);
  }

  async function start(options = {}) {
    await ensureTemplate();
    const ui = elements();
    if (!ui.root || !window.RMLBuilderSetupBridge || !ui.root.hidden) return;

    firstRunSession = options.firstRun === true;
    snapshot = window.RMLBuilderSetupBridge.capture();
    originalTourUiState = {
      graphMode: document.body.classList.contains("rml-node-graph-mode"),
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };
    stepSnapshots.clear();

    await ensureOutlineBeforeTour();

    ensureTourGraphSidebarsVisible();
    window.RMLBuilderSetupBridge.prepareTourDemo?.();
    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );
    ensureTourGraphSidebarsVisible();

    window.RMLTypedNodeGraphScrollLayers?.clear?.();
    window.RMLUniversalScrollLayers?.clear?.();

    const tourStartScroller =
      document.scrollingElement ||
      document.documentElement;

    if (tourStartScroller) {
      tourStartScroller.scrollLeft = 0;
      tourStartScroller.scrollTop = 0;
    }

    window.scrollTo({
      left: 0,
      top: 0,
      behavior: "auto"
    });

    await new Promise(resolve =>
      requestAnimationFrame(() => requestAnimationFrame(resolve))
    );

    ui.root.hidden = false;
    document.documentElement.classList.add("rml-setup-tour-active");
    showStep(0, { captureEntry: true });
  }

  Object.defineProperty(window, "RMLBuilderSetupAssistant", {
    value: Object.freeze({ start }),
    configurable: true
  });
})();