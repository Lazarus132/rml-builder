(() => {
  "use strict";

  const SCRIPT_BASE = document.currentScript?.src || window.location.href;
  const TEMPLATE_URL = new URL("setup_template.html?v=9", SCRIPT_BASE).href;
  const TEMPLATE_SCRIPT_URL = new URL("setup_template.js?v=9", SCRIPT_BASE).href;
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
      text: "Create a wire by dragging from one socket to another. Compatible sockets light up, incompatible sockets are rejected, and wire color communicates the concrete value type. You can also drop a wire on empty graph space: an output creates a typed Display monitor automatically, while a compatible value input creates a safe typed source such as a constant/context helper. Impulse inputs and inputs that cannot be safely synthesized still require an explicit connection.",
      hint: "The animation shows socket-to-socket wiring first, then output → empty space and value input → empty space so the automatic helper behavior is visible.",
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
      title: "11. Move nodes and route wires",
      text: "Drag node headers to reorganize the graph. Drag an input onto an existing wire to create a branch, and pull a wire segment to create a movable bend point.",
      hint: "This step focuses only on routing: node movement, a branch/junction and a bend point.",
      demo: "graph-route"
    },
    {
      target: ".rml-graph-viewport",
      mode: "graph",
      title: "12. Navigate large graphs",
      text: "The packed Start/configuration node is expanded in this demonstration so its own vertical and horizontal scrollbars are visible. Wheel over the node scrolls inside it, Shift + Wheel scrolls that node horizontally, and Ctrl + Wheel bypasses the node and pans the graph root. Dragging empty graph space pans the root directly.",
      hint: "Watch the Start-node scrollbars move while the Shift and Ctrl keycaps are shown live; Center Graph then fits the structure again.",
      demo: "graph-pan"
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
        await wait(120);
        slots = verticalInsertionSlots(host);
        currentSlot = slots[Math.min(slotIndex, slots.length - 1)] || currentSlot;
        showLandingGuide(currentSlot, "Same insertion gap after scroll");
      }
      await wait(180);
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
      await wait(160);
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

    targetLane.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
    await wait(120);

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
      await wait(200);
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
      await wait(420);
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
    // Read ONLY the actual title. The complete header also contains the subtitle,
    // flip button and delete button without guaranteed whitespace between them
    // (e.g. "Boolean ConstantValue⇄×"), which made exact title matching fail.
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
    const from = centerOf(startElement);
    await moveMouse(from, 220, runId);
    if (runId !== demoRunId) return false;
    startElement.dispatchEvent(new PointerEvent("pointerdown", {
      bubbles: true, cancelable: true, pointerId, pointerType: "mouse",
      isPrimary: true, button: 0, buttons: 1, clientX: from.x, clientY: from.y
    }));
    const { mouse } = elements();
    mouse?.classList.add("pressed");
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
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
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

    // Commit the demonstrated socket-to-socket connection to the REAL graph.
    // Prefer the internal tour bridge so browser pointer-event quirks and a
    // changed aspect ratio cannot make the educational step nondeterministic.
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

    // 4) Output -> empty graph space: the real graph creates a typed monitor.
    const viewport =
      document.querySelector(
        ".rml-graph-viewport"
      );
    if (!viewport) graphDemoError("Graph viewport .rml-graph-viewport disappeared during Step 9.");
    const viewportRect = viewport.getBoundingClientRect();

    {
      const emptyOutputPoint = {
        x: Math.min(
          viewportRect.right - 72,
          Math.max(
            viewportRect.left + 72,
            a.x + viewportRect.width * .28
          )
        ),
        y: Math.min(
          viewportRect.bottom - 72,
          Math.max(
            viewportRect.top + 72,
            a.y + 128
          )
        )
      };

      ui.wireSecondary.style.stroke =
        ui.wire?.style.stroke ||
        "#6ce89b";

      showDemoLabel(
        "4 · Drop OUTPUT on empty graph → auto-create typed Display monitor",
        emptyOutputPoint
      );

      await moveMouse(a, 260, runId);
      if (runId !== demoRunId) return;
      ui.mouse?.classList.add("pressed");

      await animatePathDrawing(
        ui.wireSecondary,
        a,
        emptyOutputPoint,
        620,
        runId,
        28,
        {
          followMouse: true,
          className: "dragging"
        }
      );

      ui.mouse?.classList.remove("pressed");
      if (runId !== demoRunId) return;

      showGhost(
        "Display Value · auto-created",
        emptyOutputPoint,
        "graph-node"
      );
      pulseAt(viewport, "rml-setup-demo-drop");
      await wait(380);
      hideGhost();
      ui.wireSecondary.hidden = true;
      ui.wireSecondary.setAttribute("d", "");
      hideDemoCanvasWire(ui.wireSecondary);
    }

    if (runId !== demoRunId) return;

    // 5) Value input -> empty graph space: a safe typed source is synthesized.
    {
      const emptyInputPoint = {
        x: Math.min(
          viewportRect.right - 72,
          Math.max(
            viewportRect.left + 72,
            b.x - viewportRect.width * .30
          )
        ),
        y: Math.min(
          viewportRect.bottom - 72,
          Math.max(
            viewportRect.top + 72,
            b.y + 176
          )
        )
      };

      ui.wireTertiary.style.stroke =
        getComputedStyle(input)
          .getPropertyValue(
            "--port-color"
          )
          .trim() ||
        "#6ce89b";

      showDemoLabel(
        "5 · Drag VALUE INPUT to empty graph → auto-create compatible typed source",
        emptyInputPoint
      );

      await moveMouse(b, 260, runId);
      if (runId !== demoRunId) return;
      ui.mouse?.classList.add("pressed");

      await animatePathDrawing(
        ui.wireTertiary,
        b,
        emptyInputPoint,
        620,
        runId,
        -26,
        {
          followMouse: true,
          className: "dragging"
        }
      );

      ui.mouse?.classList.remove("pressed");
      if (runId !== demoRunId) return;

      showGhost(
        "Typed constant / context source",
        emptyInputPoint,
        "graph-node"
      );
      await wait(380);
      hideGhost();
      ui.wireTertiary.hidden = true;
      ui.wireTertiary.setAttribute("d", "");
      hideDemoCanvasWire(ui.wireTertiary);
    }

    showDemoLabel(
      "Impulse / unsafe inputs still need an explicit compatible source",
      b
    );
    await wait(320);

    hideMouse();
    console.info("[RML Tour · Step 9] Typed socket animation completed successfully.", { runId });
  }

  function createPortTravelMarker(point, direction, color) {
    const marker = document.createElement("div");
    marker.className = `rml-setup-port-travel ${direction}`;
    marker.dataset.direction = direction;
    marker.style.setProperty("--travel-color", color);
    marker.style.left = `${point.x}px`;
    marker.style.top = `${point.y}px`;
    marker.innerHTML = `<span></span><b>${direction === "input" ? "INPUT" : "OUTPUT"}</b>`;
    document.body.appendChild(marker);
    return marker;
  }

  async function travelPortMarker(marker, point, duration, runId) {
    if (!marker || runId !== demoRunId) return false;
    marker.style.setProperty("--travel-duration", `${duration}ms`);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    marker.style.left = `${point.x}px`;
    marker.style.top = `${point.y}px`;
    await wait(duration + 70);
    return runId === demoRunId;
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
    let beforeInput = article.querySelector('.rml-graph-socket[data-direction="input"]');
    let beforeOutput = article.querySelector('.rml-graph-socket[data-direction="output"]');
    if (!flip || !beforeInput || !beforeOutput) return;

    const inputA = centerOf(beforeInput);
    const outputA = centerOf(beforeOutput);
    const inputColor = getComputedStyle(beforeInput).getPropertyValue("--port-color").trim() || "#59b7ff";
    const outputColor = getComputedStyle(beforeOutput).getPropertyValue("--port-color").trim() || "#6ce89b";
    const flipPoint = centerOf(flip);

    showDemoLabel("⇄ mirrors the socket layout", flipPoint);
    await moveMouse(flipPoint, 430, runId);
    if (runId !== demoRunId) return;
    await wait(220);
    showDemoLabel("Click ⇄", flipPoint);
    await clickMouse(runId);

    const inputMarker = createPortTravelMarker(inputA, "input", inputColor);
    const outputMarker = createPortTravelMarker(outputA, "output", outputColor);
    flip.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (runId !== demoRunId) return;

    article = document.querySelector(`.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`);
    if (!article) return;
    article.classList.add("rml-setup-flip-active");
    let afterInput = article.querySelector('.rml-graph-socket[data-direction="input"]');
    let afterOutput = article.querySelector('.rml-graph-socket[data-direction="output"]');
    if (!afterInput || !afterOutput) return;
    const inputB = centerOf(afterInput);
    const outputB = centerOf(afterOutput);

    showDemoLabel("INPUT → opposite side   ·   OUTPUT → opposite side", centerOf(article));
    await Promise.all([
      travelPortMarker(inputMarker, inputB, 700, runId),
      travelPortMarker(outputMarker, outputB, 700, runId)
    ]);
    if (runId !== demoRunId) return;
    pulseAt(afterInput);
    pulseAt(afterOutput);
    await wait(650);

    flip = article.querySelector(".rml-graph-node-flip");
    if (!flip || runId !== demoRunId) return;
    const restorePoint = centerOf(flip);
    showDemoLabel("Click ⇄ again → restore", restorePoint);
    await moveMouse(restorePoint, 430, runId);
    await wait(220);
    await clickMouse(runId);

    inputMarker.style.left = `${inputB.x}px`;
    inputMarker.style.top = `${inputB.y}px`;
    outputMarker.style.left = `${outputB.x}px`;
    outputMarker.style.top = `${outputB.y}px`;
    flip.click();
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (runId !== demoRunId) return;

    const restored = document.querySelector(`.rml-graph-node[data-graph-node-id="${CSS.escape(nodeId)}"]`);
    restored?.classList.add("rml-setup-flip-active");
    const restoredInput = restored?.querySelector('.rml-graph-socket[data-direction="input"]');
    const restoredOutput = restored?.querySelector('.rml-graph-socket[data-direction="output"]');
    const inputRestore = restoredInput ? centerOf(restoredInput) : inputA;
    const outputRestore = restoredOutput ? centerOf(restoredOutput) : outputA;

    showDemoLabel("Original socket sides restored", centerOf(restored || article));
    await Promise.all([
      travelPortMarker(inputMarker, inputRestore, 700, runId),
      travelPortMarker(outputMarker, outputRestore, 700, runId)
    ]);
    await wait(420);
    inputMarker.remove();
    outputMarker.remove();
    restored?.classList.remove("rml-setup-flip-active");
    article?.classList.remove("rml-setup-flip-active");
    hideMouse();
  }

  async function runGraphRouteDemo(runId) {
    // EXACT Step-10 sequence:
    //   A) reuse the REAL Boolean -> NOT wire committed by Step 9;
    //   B) create/reuse ONE second NOT node;
    //   C) visibly drag that node's INPUT onto the existing REAL wire;
    //   D) let node_graph.js create the REAL junction/branch;
    //   E) visibly drag a REAL wire segment so node_graph.js creates a REAL bend.
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

    // Never create another demo node merely because Step 10 is revisited.
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

    // Keep the Step-10 branch node deliberately well separated from the first
    // NOT node. This leaves the branch, junction and later bend fully visible.
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

    // Re-query after the real node drag because the graph may have rerendered.
    const branchId = branchNode.dataset.graphNodeId;
    branchNode = document.querySelector(`.rml-graph-node[data-graph-node-id="${CSS.escape(branchId)}"]`) || branchNode;
    branchNode.dataset.rmlTourStep10Branch = "true";
    const branchInput = [...branchNode.querySelectorAll('.rml-graph-socket[data-direction="input"]')].find(graphDemoVisible);
    if (!branchInput) graphDemoError("Routing step branch node has no visible input socket.");

    parentHit = realHits()[0] || parentHit;
    const junctionTarget = graphSvgPathPoint(parentHit, .52);
    const inputPoint = centerOf(branchInput);

    // Make the gesture unmissable: draw the same solid type-colored preview that
    // a real connection drag shows, while the REAL synthetic pointer drag runs.
    const previewKey = ui.wire || ui.wireSecondary || ui.wireTertiary;
    const previewColor = getComputedStyle(branchInput).getPropertyValue("--port-color").trim() || "#6ce89b";
    if (previewKey) {
      setDemoCanvasWire(previewKey, junctionTarget, junctionTarget, 0, {
        color: previewColor, dashed: false, width: 5, visible: true
      });
    }

    showDemoLabel("Drag this INPUT onto the existing line → junction", inputPoint);
    await moveMouse(inputPoint, 300, runId);
    if (runId !== demoRunId) return;

    // Start the REAL graph interaction on the socket.
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
        setDemoCanvasWire(previewKey, point, junctionTarget, 0, {
          color: previewColor, dashed: false, width: 5, visible: true
        });
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
    if (previewKey) hideDemoCanvasWire(previewKey);
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    if (runId !== demoRunId) return;

    // A REAL branch creates a junction handle. Require it instead of pretending success.
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

    // Bend a REAL segment. Use an actual point ON the SVG path for pointerdown;
    // using the path element's bounding-box center is not guaranteed to hit the line.
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
      for (let index = 1; index <= 14; index += 1) {
        const row = document.createElement("div");
        row.innerHTML = `<span>Demo socket ${index}</span><b>${index % 2 ? "INPUT" : "OUTPUT"}</b>`;
        filler.appendChild(row);
      }
      content.appendChild(filler);
    }

    body.style.overflow = "auto";
    body.scrollTop = 0;
    body.scrollLeft = 0;
    return { article, body, filler };
  }

  function cleanupStartNodeScrollDemo(demo) {
    if (!demo) return;
    demo.filler?.remove();
    demo.article?.classList.remove("rml-setup-scroll-demo-node");
    demo.body?.classList.remove("rml-setup-scroll-demo-body");
    demo.body?.style.removeProperty("overflow");
    if (demo.body) {
      demo.body.scrollTop = 0;
      demo.body.scrollLeft = 0;
    }
  }

  async function runGraphPanDemo(runId) {
    const viewport = document.querySelector(".rml-graph-viewport");
    if (!viewport) return;

    const scrollDemo = prepareStartNodeScrollDemo();
    await wait(100);
    const rect = viewport.getBoundingClientRect();
    const emptyPoint = {
      x: rect.left + rect.width * .76,
      y: rect.top + rect.height * .76
    };

    try {
      if (scrollDemo?.body) {
        const nodePoint = centerOf(scrollDemo.body, .55, .42);
        await moveMouse(nodePoint, 600, runId);
        if (runId !== demoRunId) return;

        elements().mouse?.classList.add("scrolling");
        hideKeys();
        showDemoLabel("Wheel INSIDE the Start node → scroll its own contents", nodePoint);
        await wheelBurst(scrollDemo.body, { deltaY: 42 }, 9, 105, runId);
        await wait(420);

        if (runId !== demoRunId) return;
        showKeys(["Shift"], nodePoint);
        elements().mouse?.classList.add("horizontal-wheel");
        showDemoLabel("Shift + Wheel INSIDE node → horizontal node scroll", nodePoint);
        await wheelBurst(scrollDemo.body, { deltaY: 42, shiftKey: true }, 9, 105, runId);
        await wait(420);
        elements().mouse?.classList.remove("horizontal-wheel");

        if (runId !== demoRunId) return;
        showKeys(["Ctrl"], nodePoint);
        showDemoLabel("Ctrl + Wheel over node → bypass node scrollbar and pan ROOT", nodePoint);
        await wheelBurst(scrollDemo.body, { deltaY: 34, ctrlKey: true }, 7, 110, runId);
        await wait(180);
        await wheelBurst(scrollDemo.body, { deltaY: -34, ctrlKey: true }, 7, 60, runId);
        elements().mouse?.classList.remove("scrolling");
        hideKeys();
      }

      if (runId !== demoRunId) return;
      showDemoLabel("Drag empty ROOT canvas → pan", emptyPoint);
      await dragMouse(
        emptyPoint,
        { x: rect.left + rect.width * .50, y: rect.top + rect.height * .54 },
        1150,
        runId
      );
      hideMouse();
      await wait(280);

      const centerButton = [...document.querySelectorAll(".rml-graph-toolbar .button")].find(button =>
        /Center Graph/i.test(button.textContent || "")
      );
      if (centerButton && runId === demoRunId) {
        await moveMouse(centerOf(centerButton), 620, runId);
        showDemoLabel("Center Graph → fit everything again", centerOf(centerButton));
        await clickMouse(runId);
      }
      hideMouse();
    } finally {
      cleanupStartNodeScrollDemo(scrollDemo);
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
      step?.demo === "graph-wire";

    while (runId === demoRunId) {
      const ok = await runSafely();
      if (runId !== demoRunId || !ok) return;

      const pause =
        isComplexDemo(step)
          ? DEMO_COMPLEX_REPEAT_PAUSE_MS
          : DEMO_REPEAT_PAUSE_MS;

      await wait(pause);
      if (runId !== demoRunId) return;

      // Every visible tour animation repeats automatically.
      // Mutating graph demos are reset to the exact state from when this step
      // was entered before the next cycle, so repetitions cannot accumulate
      // extra nodes, wires, junctions or bend points.
      if (mutatingGraphDemo) {
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
        target.scrollIntoView({ block: "center", inline: "nearest", behavior: "auto" });
        target.classList.add("rml-setup-target");
        currentTarget = target;
      }
      ui.title.textContent = step.title;
      ui.text.innerHTML = step.text;
      ui.hint.textContent = step.hint || "";
      ui.progress.style.width = `${((index + 1) / steps.length) * 100}%`;
      ui.back.disabled = index === 0;
      ui.next.textContent = index === steps.length - 1 ? "Finish" : "Next";
      requestAnimationFrame(() => {
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

    // Restore the exact UI mode and viewport that existed before the tour.
    // The assistant is a sandbox: closing it must leave no graph/outline or scroll trace.
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
        // Aspect-ratio changes can invalidate graph DOM geometry. Restore the
        // current step's clean entry state and rebuild the demonstration from it.
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

    // Capture BEFORE changing mode or preparing demo data. This is the immutable
    // sandbox baseline used whenever the assistant is closed/skipped/finished.
    firstRunSession = options.firstRun === true;
    snapshot = window.RMLBuilderSetupBridge.capture();
    originalTourUiState = {
      graphMode: document.body.classList.contains("rml-node-graph-mode"),
      scrollX: window.scrollX,
      scrollY: window.scrollY
    };
    stepSnapshots.clear();

    // The tour itself starts in Configuration Outline, but this temporary mode
    // change is now also undone when the sandbox closes.
    await ensureOutlineBeforeTour();

    window.RMLBuilderSetupBridge.prepareTourDemo?.();
    ui.root.hidden = false;
    document.documentElement.classList.add("rml-setup-tour-active");
    showStep(0, { captureEntry: true });
  }

  Object.defineProperty(window, "RMLBuilderSetupAssistant", {
    value: Object.freeze({ start }),
    configurable: true
  });
})();
