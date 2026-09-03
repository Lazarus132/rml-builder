(() => {
  "use strict";

  const VERSION = 7;
  const WIRE_CELL_SIZE = 240;
  const NODE_CELL_SIZE = 360;
  const WIRE_LINEAR_PICK_LIMIT = 512;
  const GPU_CURVE_STEPS = 32;
  const FLOATS_PER_WIRE_INSTANCE = 15;
  const WIRE_LAYERS_PER_SEGMENT = 1;
  const FLOATS_PER_NODE_VERTEX = 9;

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function colorComponents(value, alpha = 1) {
    const text = String(value || "#9da8b4").trim();
    const match = text.match(
      /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i
    );

    if (!match) {
      return [0.616, 0.659, 0.706, alpha];
    }

    return [
      Number.parseInt(match[1], 16) / 255,
      Number.parseInt(match[2], 16) / 255,
      Number.parseInt(match[3], 16) / 255,
      alpha * (
        match[4]
          ? Number.parseInt(match[4], 16) / 255
          : 1
      )
    ];
  }

  function cubicPoint(curve, t) {
    const inverse = 1 - t;
    const inverse2 = inverse * inverse;
    const t2 = t * t;
    return {
      x:
        inverse2 * inverse * curve.p0.x +
        3 * inverse2 * t * curve.p1.x +
        3 * inverse * t2 * curve.p2.x +
        t2 * t * curve.p3.x,
      y:
        inverse2 * inverse * curve.p0.y +
        3 * inverse2 * t * curve.p1.y +
        3 * inverse * t2 * curve.p2.y +
        t2 * t * curve.p3.y
    };
  }

  function cubicDerivative(curve, t) {
    const inverse = 1 - t;
    return {
      x:
        3 * inverse * inverse * (curve.p1.x - curve.p0.x) +
        6 * inverse * t * (curve.p2.x - curve.p1.x) +
        3 * t * t * (curve.p3.x - curve.p2.x),
      y:
        3 * inverse * inverse * (curve.p1.y - curve.p0.y) +
        6 * inverse * t * (curve.p2.y - curve.p1.y) +
        3 * t * t * (curve.p3.y - curve.p2.y)
    };
  }

  function curveFromSegment(segment) {
    if (segment?.curve?.p0) {
      return segment.curve;
    }

    const from = segment?.from || { x: 0, y: 0, side: "right" };
    const to = segment?.to || { x: 0, y: 0, side: "left" };
    const horizontal = Math.abs(to.x - from.x);
    const vertical = Math.abs(to.y - from.y);
    const control = clamp(
      Math.max(horizontal * 0.48, vertical * 0.24),
      36,
      260
    );
    const fromDirection = from.side === "left" ? -1 : 1;
    const toDirection = to.side === "right" ? 1 : -1;

    return {
      p0: { x: from.x, y: from.y },
      p1: {
        x: from.x + control * fromDirection,
        y: from.y
      },
      p2: {
        x: to.x + control * toDirection,
        y: to.y
      },
      p3: { x: to.x, y: to.y }
    };
  }

  function curveBounds(curve) {
    const xs = [
      curve.p0.x,
      curve.p1.x,
      curve.p2.x,
      curve.p3.x
    ];
    const ys = [
      curve.p0.y,
      curve.p1.y,
      curve.p2.y,
      curve.p3.y
    ];
    return {
      left: Math.min(...xs),
      top: Math.min(...ys),
      right: Math.max(...xs),
      bottom: Math.max(...ys)
    };
  }

  function squaredDistanceToSegment(point, a, b) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared <= 1e-9) {
      const px = point.x - a.x;
      const py = point.y - a.y;
      return {
        distanceSquared: px * px + py * py,
        t: 0,
        point: { x: a.x, y: a.y }
      };
    }

    const t = clamp(
      (
        (point.x - a.x) * dx +
        (point.y - a.y) * dy
      ) / lengthSquared,
      0,
      1
    );
    const x = a.x + dx * t;
    const y = a.y + dy * t;
    const px = point.x - x;
    const py = point.y - y;
    return {
      distanceSquared: px * px + py * py,
      t,
      point: { x, y }
    };
  }

  function nearestPointOnCurve(curve, target) {
    const coarseSteps = 32;
    let bestT = 0;
    let bestDistanceSquared = Infinity;
    let previous = cubicPoint(curve, 0);

    for (let index = 1; index <= coarseSteps; index += 1) {
      const endT = index / coarseSteps;
      const current = cubicPoint(curve, endT);
      const candidate = squaredDistanceToSegment(
        target,
        previous,
        current
      );
      if (candidate.distanceSquared < bestDistanceSquared) {
        bestDistanceSquared = candidate.distanceSquared;
        bestT = (index - 1 + candidate.t) / coarseSteps;
      }
      previous = current;
    }

    let radius = 1 / coarseSteps;
    for (let pass = 0; pass < 7; pass += 1) {
      const candidates = [
        clamp(bestT - radius, 0, 1),
        bestT,
        clamp(bestT + radius, 0, 1)
      ];
      for (const t of candidates) {
        const point = cubicPoint(curve, t);
        const dx = point.x - target.x;
        const dy = point.y - target.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < bestDistanceSquared) {
          bestDistanceSquared = distanceSquared;
          bestT = t;
        }
      }
      radius *= 0.5;
    }

    return {
      ...cubicPoint(curve, bestT),
      t: bestT,
      distanceSquared: bestDistanceSquared
    };
  }

  function shader(gl, type, source) {
    const value = gl.createShader(type);
    gl.shaderSource(value, source);
    gl.compileShader(value);
    if (!gl.getShaderParameter(value, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(value) || "Unknown shader error";
      gl.deleteShader(value);
      throw new Error(message);
    }
    return value;
  }

  function program(gl, vertexSource, fragmentSource) {
    const value = gl.createProgram();
    const vertex = shader(gl, gl.VERTEX_SHADER, vertexSource);
    const fragment = shader(gl, gl.FRAGMENT_SHADER, fragmentSource);
    gl.attachShader(value, vertex);
    gl.attachShader(value, fragment);
    gl.linkProgram(value);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    if (!gl.getProgramParameter(value, gl.LINK_STATUS)) {
      const message = gl.getProgramInfoLog(value) || "Unknown program error";
      gl.deleteProgram(value);
      throw new Error(message);
    }
    return value;
  }

  function cellRange(bounds, cellSize, padding = 0) {
    return {
      minimumX: Math.floor((bounds.left - padding) / cellSize),
      maximumX: Math.floor((bounds.right + padding) / cellSize),
      minimumY: Math.floor((bounds.top - padding) / cellSize),
      maximumY: Math.floor((bounds.bottom + padding) / cellSize)
    };
  }

  function addToSpatialIndex(index, bounds, cellSize, value, padding = 0) {
    const range = cellRange(bounds, cellSize, padding);
    for (let y = range.minimumY; y <= range.maximumY; y += 1) {
      for (let x = range.minimumX; x <= range.maximumX; x += 1) {
        const key = `${x}:${y}`;
        const values = index.get(key) || [];
        values.push(value);
        index.set(key, values);
      }
    }
  }

  function addWireToSpatialIndex(index, record, cellSize, padding = 0) {
    const curve = record.curve;
    const approximateLength = Math.max(1, finite(record.length, 1));
    const steps = clamp(
      Math.ceil(approximateLength / Math.max(1, cellSize * 0.65)),
      12,
      160
    );
    const occupied = new Set();
    let previous = cubicPoint(curve, 0);

    for (let step = 1; step <= steps; step += 1) {
      const current = cubicPoint(curve, step / steps);
      const range = cellRange(
        {
          left: Math.min(previous.x, current.x),
          top: Math.min(previous.y, current.y),
          right: Math.max(previous.x, current.x),
          bottom: Math.max(previous.y, current.y)
        },
        cellSize,
        padding
      );
      for (let y = range.minimumY; y <= range.maximumY; y += 1) {
        for (let x = range.minimumX; x <= range.maximumX; x += 1) {
          occupied.add(`${x}:${y}`);
        }
      }
      previous = current;
    }

    for (const key of occupied) {
      const values = index.get(key) || [];
      values.push(record);
      index.set(key, values);
    }
  }

  class GraphHybridRenderer {
    constructor(options = {}) {
      this.viewport = null;
      this.onAvailabilityChange = null;
      this.canvas = document.createElement("canvas");
      this.canvas.className = "rml-graph-gpu-canvas";
      this.canvas.setAttribute("aria-hidden", "true");
      this.canvas.tabIndex = -1;
      this.scene = {
        segments: [],
        nodes: []
      };
      this.camera = {
        x: 0,
        y: 0,
        scale: 1
      };
      this.cssWidth = 1;
      this.cssHeight = 1;
      this.pixelRatio = 1;
      this.available = false;
      this.contextLost = false;
      this.disposed = false;
      this.frame = 0;
      this.resizeObserver = null;
      this.gridProgram = null;
      this.wireProgram = null;
      this.nodeProgram = null;
      this.uniforms = null;
      this.wireVertexArray = null;
      this.wireVertexBuffer = null;
      this.previewVertexArray = null;
      this.previewVertexBuffer = null;
      this.nodeVertexArray = null;
      this.nodeVertexBuffer = null;
      this.nodeIndexBuffer = null;
      this.wireRecords = [];
      this.wireSpatialIndex = new Map();
      this.wireLayerCache = new Map();
      this.wireRecordIndexByKey = new Map();
      this.wireInstanceData = new Float32Array(0);
      this.previewSegment = null;
      this.previewInstanceCount = 0;
      this.nodeRecords = [];
      this.nodeSpatialIndex = new Map();
      this.wireSpatialIndexDirty = true;
      this.nodeSpatialIndexDirty = true;
      this.wireVertexCount = 0;
      this.wireInstanceCount = 0;
      this.nodeVertexCount = 0;
      this.nodeIndexCount = 0;
      this.stats = {
        renderer: "svg-fallback",
        segments: 0,
        nodes: 0,
        wireVertices: 0,
        wireInstances: 0,
        nodeVertices: 0,
        drawCalls: 0,
        curveSteps: GPU_CURVE_STEPS,
        lastDrawMilliseconds: 0,
        averageDrawMilliseconds: 0,
        maximumDrawMilliseconds: 0,
        wireIndexMilliseconds: 0,
        nodeIndexMilliseconds: 0,
        lastWirePickMilliseconds: 0,
        lastWirePickCandidates: 0,
        hiddenConnections: 0,
        previewInstances: 0,
        lastNodePickMilliseconds: 0
      };
      this.drawSamples = 0;

      this.handleContextLost = event => {
        event.preventDefault();
        if (this.disposed) return;
        this.contextLost = true;
        this.setAvailability(false);
      };
      this.handleContextRestored = () => {
        if (this.disposed) return;
        this.contextLost = false;
        this.initialize();
        this.setScene(this.scene);
        this.setPreview(
          this.previewSegment
        );
      };
      this.canvas.addEventListener(
        "webglcontextlost",
        this.handleContextLost
      );
      this.canvas.addEventListener(
        "webglcontextrestored",
        this.handleContextRestored
      );

      this.initialize();
      this.attach(options);
    }

    setAvailability(value) {
      const next = value === true;
      if (this.available === next) {
        return;
      }
      this.available = next;
      this.canvas.classList.toggle("available", next);
      this.stats.renderer = next ? "webgl2" : "svg-fallback";
      this.onAvailabilityChange?.(next);
    }

    initialize() {
      if (this.contextLost || this.disposed) {
        return false;
      }

      let gl = null;
      try {
        gl = this.canvas.getContext("webgl2", {
          alpha: true,
          antialias: true,
          depth: false,
          stencil: false,
          premultipliedAlpha: true,
          preserveDrawingBuffer: false,
          powerPreference: "high-performance",
          desynchronized: true
        });
      } catch {
        gl = null;
      }

      if (!gl) {
        this.gl = null;
        this.setAvailability(false);
        return false;
      }

      try {
        this.gl = gl;
        this.deleteGpuResources();
        this.createPrograms();
        this.createBuffers();
        gl.disable(gl.DEPTH_TEST);
        gl.disable(gl.CULL_FACE);
        gl.enable(gl.BLEND);
        gl.blendFunc(
          gl.SRC_ALPHA,
          gl.ONE_MINUS_SRC_ALPHA
        );
        this.setAvailability(true);
        return true;
      } catch (error) {
        console.error("RML graph WebGL initialization failed.", error);
        this.deleteGpuResources();
        this.gl = null;
        this.setAvailability(false);
        return false;
      }
    }

    attach(options = {}) {
      if (this.disposed) {
        return false;
      }

      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.viewport = options.viewport || null;
      this.onAvailabilityChange =
        typeof options.onAvailabilityChange === "function"
          ? options.onAvailabilityChange
          : null;

      if (
        typeof ResizeObserver === "function" &&
        this.viewport
      ) {
        this.resizeObserver =
          new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.viewport);
      }

      this.onAvailabilityChange?.(
        this.available
      );
      this.resize();
      this.scheduleDraw();
      return true;
    }

    detach() {
      if (this.disposed) {
        return false;
      }
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.viewport = null;
      this.onAvailabilityChange = null;
      this.clearScene();
      this.canvas.remove();

      // Keep the one reusable WebGL context, but release its large drawing
      // surface while no graph viewport is mounted.
      this.canvas.width = 1;
      this.canvas.height = 1;
      this.canvas.style.width = "1px";
      this.canvas.style.height = "1px";
      this.cssWidth = 1;
      this.cssHeight = 1;
      return true;
    }

    clearScene() {
      this.scene = {
        segments: [],
        nodes: []
      };
      this.previewSegment = null;
      this.previewInstanceCount = 0;
      this.wireRecords = [];
      this.nodeRecords = [];
      this.wireSpatialIndex.clear();
      this.nodeSpatialIndex.clear();
      this.wireLayerCache.clear();
      this.wireRecordIndexByKey.clear();
      this.wireInstanceData = new Float32Array(0);
      this.wireSpatialIndexDirty = false;
      this.nodeSpatialIndexDirty = false;
      this.wireVertexCount = 0;
      this.wireInstanceCount = 0;
      this.nodeVertexCount = 0;
      this.nodeIndexCount = 0;
      this.stats.segments = 0;
      this.stats.nodes = 0;
      this.stats.wireVertices = 0;
      this.stats.wireInstances = 0;
      this.stats.nodeVertices = 0;
      this.stats.hiddenConnections = 0;
      this.stats.previewInstances = 0;

      const gl = this.gl;
      if (
        gl &&
        this.available &&
        !this.contextLost
      ) {
        gl.bindBuffer(
          gl.ARRAY_BUFFER,
          this.wireVertexBuffer
        );
        gl.bufferData(
          gl.ARRAY_BUFFER,
          0,
          gl.DYNAMIC_DRAW
        );
        gl.bindBuffer(
          gl.ARRAY_BUFFER,
          this.nodeVertexBuffer
        );
        gl.bufferData(
          gl.ARRAY_BUFFER,
          0,
          gl.DYNAMIC_DRAW
        );
        gl.bindBuffer(
          gl.ELEMENT_ARRAY_BUFFER,
          this.nodeIndexBuffer
        );
        gl.bufferData(
          gl.ELEMENT_ARRAY_BUFFER,
          0,
          gl.DYNAMIC_DRAW
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
        gl.bindBuffer(
          gl.ELEMENT_ARRAY_BUFFER,
          null
        );
      }
    }

    deleteGpuResources() {
      const gl = this.gl;
      if (gl) {
        gl.bindVertexArray?.(null);
        gl.bindBuffer?.(gl.ARRAY_BUFFER, null);
        gl.bindBuffer?.(
          gl.ELEMENT_ARRAY_BUFFER,
          null
        );
        gl.useProgram?.(null);

        for (const buffer of [
          this.wireVertexBuffer,
          this.previewVertexBuffer,
          this.nodeVertexBuffer,
          this.nodeIndexBuffer
        ]) {
          if (buffer) gl.deleteBuffer?.(buffer);
        }
        for (const vertexArray of [
          this.wireVertexArray,
          this.previewVertexArray,
          this.nodeVertexArray
        ]) {
          if (vertexArray) {
            gl.deleteVertexArray?.(vertexArray);
          }
        }
        for (const shaderProgram of [
          this.gridProgram,
          this.wireProgram,
          this.nodeProgram
        ]) {
          if (shaderProgram) {
            gl.deleteProgram?.(shaderProgram);
          }
        }
      }

      this.gridProgram = null;
      this.wireProgram = null;
      this.nodeProgram = null;
      this.uniforms = null;
      this.wireVertexArray = null;
      this.wireVertexBuffer = null;
      this.previewVertexArray = null;
      this.previewVertexBuffer = null;
      this.nodeVertexArray = null;
      this.nodeVertexBuffer = null;
      this.nodeIndexBuffer = null;
    }

    createPrograms() {
      const gl = this.gl;
      this.gridProgram = program(
        gl,
        `#version 300 es
        precision highp float;
        out vec2 vPosition;
        void main() {
          vec2 position = vec2(
            gl_VertexID == 1 ? 3.0 : -1.0,
            gl_VertexID == 2 ? 3.0 : -1.0
          );
          vPosition = position;
          gl_Position = vec4(position, 0.0, 1.0);
        }`,
        `#version 300 es
        precision highp float;
        uniform vec2 uResolution;
        uniform float uPixelRatio;
        out vec4 outputColor;
        float lineMask(float coordinate, float spacing) {
          float pixel = coordinate / uPixelRatio;
          float distanceToLine = min(
            mod(pixel, spacing),
            spacing - mod(pixel, spacing)
          );
          return 1.0 - smoothstep(0.45, 1.15, distanceToLine);
        }
        void main() {
          float minor = max(
            lineMask(gl_FragCoord.x, 18.0),
            lineMask(gl_FragCoord.y, 18.0)
          );
          float major = max(
            lineMask(gl_FragCoord.x, 90.0),
            lineMask(gl_FragCoord.y, 90.0)
          );
          vec3 base = vec3(0.0314, 0.0392, 0.0627);
          vec3 minorColor = vec3(1.0);
          vec3 majorColor = vec3(0.337, 0.651, 0.871);
          vec3 color = mix(base, minorColor, minor * 0.025);
          color = mix(color, majorColor, major * 0.025);
          outputColor = vec4(color, 1.0);
        }`
      );

      this.wireProgram = program(
        gl,
        `#version 300 es
        precision highp float;
        layout(location = 0) in vec2 aP0;
        layout(location = 1) in vec2 aP1;
        layout(location = 2) in vec2 aP2;
        layout(location = 3) in vec2 aP3;
        layout(location = 4) in vec4 aColor;
        layout(location = 5) in float aStyle;
        layout(location = 6) in float aDash;
        layout(location = 7) in float aLength;
        uniform vec2 uResolution;
        uniform vec2 uPan;
        uniform float uScale;
        out vec4 vColor;
        out float vEdgePixels;
        out float vCoreHalfPixels;
        out float vDistance;
        out float vDash;
        out float vStyle;
        vec2 cubicPoint(float t) {
          float inverse = 1.0 - t;
          float inverse2 = inverse * inverse;
          float t2 = t * t;
          return
            inverse2 * inverse * aP0 +
            3.0 * inverse2 * t * aP1 +
            3.0 * inverse * t2 * aP2 +
            t2 * t * aP3;
        }
        vec2 cubicDerivative(float t) {
          float inverse = 1.0 - t;
          return
            3.0 * inverse * inverse * (aP1 - aP0) +
            6.0 * inverse * t * (aP2 - aP1) +
            3.0 * t * t * (aP3 - aP2);
        }
        void main() {
          const float STEPS = ${GPU_CURVE_STEPS}.0;
          int pointIndex = gl_VertexID / 2;
          float side = mod(float(gl_VertexID), 2.0) < 0.5
            ? -1.0
            : 1.0;
          float t = clamp(float(pointIndex) / STEPS, 0.0, 1.0);
          vec2 position = cubicPoint(t);
          float stepSize = 1.0 / STEPS;
          vec2 previousPosition = cubicPoint(max(0.0, t - stepSize));
          vec2 nextPosition = cubicPoint(min(1.0, t + stepSize));
          vec2 incoming = position - previousPosition;
          vec2 outgoing = nextPosition - position;
          float incomingLength = length(incoming);
          float outgoingLength = length(outgoing);
          vec2 incomingDirection = incomingLength > 0.000001
            ? incoming / incomingLength
            : vec2(0.0);
          vec2 outgoingDirection = outgoingLength > 0.000001
            ? outgoing / outgoingLength
            : vec2(0.0);
          if (pointIndex == 0) {
            incomingDirection = outgoingDirection;
          }
          if (pointIndex == int(STEPS)) {
            outgoingDirection = incomingDirection;
          }
          vec2 joinedDirection =
            incomingDirection + outgoingDirection;
          float joinLength = length(joinedDirection);
          vec2 fallbackDirection = aP3 - aP0;
          float fallbackLength = length(fallbackDirection);
          if (fallbackLength <= 0.000001) {
            fallbackDirection = vec2(1.0, 0.0);
            fallbackLength = 1.0;
          }
          vec2 tangent = joinLength > 0.000001
            ? joinedDirection / joinLength
            : fallbackDirection / fallbackLength;
          vec2 normal = vec2(-tangent.y, tangent.x);
          float reversalDot = dot(
            incomingDirection,
            outgoingDirection
          );
          float joinWidthFactor = smoothstep(
            -0.985,
            -0.90,
            reversalDot
          );
          float safeScale = max(uScale, 0.0001);
          float antialiasGraph = 1.25 / safeScale;
          float totalHalfWidth = 7.0 + antialiasGraph;
          float extrusionHalfWidth =
            totalHalfWidth * joinWidthFactor;
          vec2 graphPosition =
            position + normal * side * extrusionHalfWidth;
          vec2 screenPosition =
            graphPosition * uScale + uPan;
          vec2 clipPosition = vec2(
            screenPosition.x / uResolution.x * 2.0 - 1.0,
            1.0 - screenPosition.y / uResolution.y * 2.0
          );
          gl_Position = vec4(clipPosition, 0.0, 1.0);
          vColor = aColor;
          vEdgePixels = side * extrusionHalfWidth * uScale;
          vCoreHalfPixels = max(0.05, 2.0 * uScale);
          vDistance = t * aLength;
          vDash = aDash;
          vStyle = aStyle;
        }`,
        `#version 300 es
        precision highp float;
        in vec4 vColor;
        in float vEdgePixels;
        in float vCoreHalfPixels;
        in float vDistance;
        in float vDash;
        in float vStyle;
        out vec4 outputColor;
        float coverage(float halfWidth) {
          return 1.0 - smoothstep(
            halfWidth,
            halfWidth + 1.25,
            abs(vEdgePixels)
          );
        }
        vec4 over(vec4 under, vec4 upper) {
          float alpha = upper.a + under.a * (1.0 - upper.a);
          if (alpha <= 0.00001) {
            return vec4(0.0);
          }
          vec3 premultiplied =
            upper.rgb * upper.a +
            under.rgb * under.a * (1.0 - upper.a);
          return vec4(premultiplied / alpha, alpha);
        }
        void main() {
          bool selected = mod(vStyle, 2.0) >= 1.0;
          bool valid = mod(floor(vStyle / 2.0), 2.0) >= 1.0;
          bool invalid = floor(vStyle / 4.0) >= 1.0;
          float scaleEstimate = max(
            0.0001,
            vCoreHalfPixels / 2.0
          );
          vec4 result = vec4(0.0);
          result = over(
            result,
            vec4(0.0, 0.0, 0.0, 0.10 * coverage(7.0 * scaleEstimate))
          );
          result = over(
            result,
            vec4(0.0, 0.0, 0.0, 0.20 * coverage(5.0 * scaleEstimate))
          );
          result = over(
            result,
            vec4(0.0, 0.0, 0.0, 0.72 * coverage(4.0 * scaleEstimate))
          );
          if (selected || valid) {
            float glowHalf = (selected ? 7.0 : 6.5) * scaleEstimate;
            float glowAlpha = invalid ? 0.06 : 0.22;
            result = over(
              result,
              vec4(vColor.rgb, glowAlpha * coverage(glowHalf))
            );
          }
          float dashMask =
            vDash > 0.5 && mod(vDistance, 17.0) > 10.0
              ? 0.0
              : 1.0;
          float coreHalf = (selected || valid ? 3.0 : 2.0) * scaleEstimate;
          result = over(
            result,
            vec4(
              vColor.rgb,
              vColor.a * coverage(coreHalf) * dashMask
            )
          );
          if (result.a <= 0.001) {
            discard;
          }
          outputColor = result;
        }`
      );

      this.nodeProgram = program(
        gl,
        `#version 300 es
        precision highp float;
        layout(location = 0) in vec2 aPosition;
        layout(location = 1) in vec2 aLocal;
        layout(location = 2) in vec2 aSize;
        layout(location = 3) in float aConfiguration;
        layout(location = 4) in float aSelected;
        layout(location = 5) in float aHeader;
        uniform vec2 uResolution;
        uniform vec2 uPan;
        uniform float uScale;
        out vec2 vLocal;
        out vec2 vSize;
        out float vConfiguration;
        out float vSelected;
        out float vHeader;
        void main() {
          vec2 screenPosition = aPosition * uScale + uPan;
          vec2 clipPosition = vec2(
            screenPosition.x / uResolution.x * 2.0 - 1.0,
            1.0 - screenPosition.y / uResolution.y * 2.0
          );
          gl_Position = vec4(clipPosition, 0.0, 1.0);
          vLocal = aLocal;
          vSize = aSize;
          vConfiguration = aConfiguration;
          vSelected = aSelected;
          vHeader = aHeader;
        }`,
        `#version 300 es
        precision highp float;
        uniform float uScale;
        in vec2 vLocal;
        in vec2 vSize;
        in float vConfiguration;
        in float vSelected;
        in float vHeader;
        out vec4 outputColor;
        float roundedDistance(vec2 point, vec2 size, float radius) {
          vec2 q = abs(point - size * 0.5) -
            (size * 0.5 - vec2(radius));
          return length(max(q, 0.0)) +
            min(max(q.x, q.y), 0.0) - radius;
        }
        void main() {
          float distance = roundedDistance(vLocal, vSize, 10.0);
          float antialiasGraph = 1.15 / max(uScale, 0.0001);
          float coverage = 1.0 - smoothstep(
            0.0,
            antialiasGraph,
            distance
          );
          if (coverage <= 0.001) {
            discard;
          }
          bool header = vLocal.y <= min(45.0, vSize.y);
          vec3 body = vConfiguration > 0.5
            ? vec3(0.0627, 0.1098, 0.1529)
            : vec3(0.0745, 0.0902, 0.1216);
          vec3 headerTop = vec3(0.1333, 0.1686, 0.2118);
          vec3 headerBottom = vec3(0.0902, 0.1137, 0.1451);
          float headerMix = clamp(vLocal.y / 45.0, 0.0, 1.0);
          vec3 color = header
            ? mix(headerTop, headerBottom, headerMix)
            : body;
          float edge = abs(distance);
          float borderWidth = 1.0 / max(uScale, 0.0001);
          vec3 border = vSelected > 0.5
            ? vec3(0.4392, 0.8118, 1.0)
            : vConfiguration > 0.5
              ? vec3(0.3451, 0.7490, 1.0)
              : vec3(0.2039, 0.2549, 0.3098);
          float borderMask = 1.0 - smoothstep(
            borderWidth,
            borderWidth + antialiasGraph,
            edge
          );
          color = mix(color, border, borderMask);
          float dividerDistance = abs(vLocal.y - 45.0);
          float divider = header
            ? 0.0
            : 1.0 - smoothstep(
                borderWidth,
                borderWidth + antialiasGraph,
                dividerDistance
              );
          color = mix(color, vec3(0.1647, 0.2039, 0.2510), divider);
          outputColor = vec4(color, coverage * 0.99);
        }`
      );

      this.uniforms = {
        grid: {
          resolution: gl.getUniformLocation(this.gridProgram, "uResolution"),
          pixelRatio: gl.getUniformLocation(this.gridProgram, "uPixelRatio")
        },
        wire: {
          resolution: gl.getUniformLocation(this.wireProgram, "uResolution"),
          pan: gl.getUniformLocation(this.wireProgram, "uPan"),
          scale: gl.getUniformLocation(this.wireProgram, "uScale")
        },
        node: {
          resolution: gl.getUniformLocation(this.nodeProgram, "uResolution"),
          pan: gl.getUniformLocation(this.nodeProgram, "uPan"),
          scale: gl.getUniformLocation(this.nodeProgram, "uScale")
        }
      };
    }

    createBuffers() {
      const gl = this.gl;
      this.wireVertexArray = gl.createVertexArray();
      this.wireVertexBuffer = gl.createBuffer();
      gl.bindVertexArray(this.wireVertexArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.wireVertexBuffer);
      const wireStride = FLOATS_PER_WIRE_INSTANCE * 4;
      const wireAttributes = [
        [0, 2, 0],
        [1, 2, 2],
        [2, 2, 4],
        [3, 2, 6],
        [4, 4, 8],
        [5, 1, 12],
        [6, 1, 13],
        [7, 1, 14]
      ];
      for (const [location, size, offset] of wireAttributes) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          size,
          gl.FLOAT,
          false,
          wireStride,
          offset * 4
        );
        gl.vertexAttribDivisor(
          location,
          1
        );
      }
      this.previewVertexArray = gl.createVertexArray();
      this.previewVertexBuffer = gl.createBuffer();
      gl.bindVertexArray(this.previewVertexArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.previewVertexBuffer);
      for (const [location, size, offset] of wireAttributes) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          size,
          gl.FLOAT,
          false,
          wireStride,
          offset * 4
        );
        gl.vertexAttribDivisor(
          location,
          1
        );
      }
      gl.bufferData(
        gl.ARRAY_BUFFER,
        FLOATS_PER_WIRE_INSTANCE * 4,
        gl.DYNAMIC_DRAW
      );

      this.nodeVertexArray = gl.createVertexArray();
      this.nodeVertexBuffer = gl.createBuffer();
      this.nodeIndexBuffer = gl.createBuffer();
      gl.bindVertexArray(this.nodeVertexArray);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeVertexBuffer);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.nodeIndexBuffer);
      const nodeStride = FLOATS_PER_NODE_VERTEX * 4;
      const nodeAttributes = [
        [0, 2, 0],
        [1, 2, 2],
        [2, 2, 4],
        [3, 1, 6],
        [4, 1, 7],
        [5, 1, 8]
      ];
      for (const [location, size, offset] of nodeAttributes) {
        gl.enableVertexAttribArray(location);
        gl.vertexAttribPointer(
          location,
          size,
          gl.FLOAT,
          false,
          nodeStride,
          offset * 4
        );
      }
      gl.bindVertexArray(null);
    }

    resize() {
      if (!this.viewport || this.disposed) {
        return;
      }
      const rectangle = this.viewport.getBoundingClientRect();
      const width = Math.max(1, Math.round(rectangle.width));
      const height = Math.max(1, Math.round(rectangle.height));
      const ratio = Math.max(1, finite(window.devicePixelRatio, 1));
      const pixelWidth = Math.max(1, Math.round(width * ratio));
      const pixelHeight = Math.max(1, Math.round(height * ratio));
      const changed =
        this.cssWidth !== width ||
        this.cssHeight !== height ||
        this.pixelRatio !== ratio ||
        this.canvas.width !== pixelWidth ||
        this.canvas.height !== pixelHeight;

      this.cssWidth = width;
      this.cssHeight = height;
      this.pixelRatio = ratio;
      if (changed) {
        this.canvas.width = pixelWidth;
        this.canvas.height = pixelHeight;
        this.canvas.style.width = `${width}px`;
        this.canvas.style.height = `${height}px`;
        this.scheduleDraw();
      }
    }

    setCamera(camera = {}) {
      const x = finite(camera.x, 0);
      const y = finite(camera.y, 0);
      const scale = Math.max(0.0001, finite(camera.scale, 1));
      if (
        this.camera.x === x &&
        this.camera.y === y &&
        this.camera.scale === scale
      ) {
        return;
      }
      this.camera.x = x;
      this.camera.y = y;
      this.camera.scale = scale;
      this.scheduleDraw();
    }

    setScene(scene = {}) {
      this.scene = {
        segments: Array.isArray(scene.segments)
          ? scene.segments.slice()
          : [],
        nodes: Array.isArray(scene.nodes)
          ? scene.nodes.slice()
          : []
      };
      this.prepareSceneRecords();
      if (this.available) {
        this.rebuildWireBuffers();
        this.rebuildNodeBuffers();
      }
      this.scheduleDraw();
    }

    setNodes(nodes = []) {
      this.scene.nodes = Array.isArray(nodes) ? nodes : [];
      this.prepareNodeRecords();
      if (this.available) {
        this.rebuildNodeBuffers();
      }
      this.scheduleDraw();
    }

    setPreview(segment = null) {
      this.previewSegment =
        segment && typeof segment === "object"
          ? { ...segment }
          : null;
      this.previewInstanceCount = 0;
      this.stats.previewInstances = 0;

      if (
        !this.available ||
        !this.gl ||
        !this.previewSegment
      ) {
        this.scheduleDraw();
        return this.previewSegment === null;
      }

      const record = this.prepareWireRecord({
        ...this.previewSegment,
        connectionId:
          this.previewSegment.connectionId ||
          "__rml-wire-preview__",
        segmentIndex: 0,
        selected: true
      });
      const data = new Float32Array(
        this.createWireLayerData(record)
      );

      this.gl.bindBuffer(
        this.gl.ARRAY_BUFFER,
        this.previewVertexBuffer
      );
      this.gl.bufferSubData(
        this.gl.ARRAY_BUFFER,
        0,
        data
      );
      this.previewInstanceCount = 1;
      this.stats.previewInstances = 1;
      this.scheduleDraw();
      return true;
    }

    prepareSceneRecords() {
      this.wireRecords = [];
      this.wireRecordIndexByKey.clear();
      for (
        let index = 0;
        index < this.scene.segments.length;
        index += 1
      ) {
        const segment =
          this.scene.segments[index];
        const record =
          this.prepareWireRecord(
            segment
          );
        this.wireRecords.push(record);
        this.wireRecordIndexByKey.set(
          this.wireRecordKey(record),
          index
        );
      }

      this.prepareNodeRecords();
      this.wireSpatialIndexDirty = true;
      this.stats.segments = this.wireRecords.length;
      this.stats.hiddenConnections =
        new Set(
          this.wireRecords
            .filter(record => record.hidden === true)
            .map(record => record.connectionId)
        ).size;
    }

    prepareNodeRecords() {
      this.nodeRecords = this.scene.nodes.map(node => ({
        ...node,
        left: finite(node.x, 0),
        top: finite(node.y, 0),
        right: finite(node.x, 0) + Math.max(1, finite(node.width, 280)),
        bottom: finite(node.y, 0) + Math.max(1, finite(node.height, 180))
      }));
      this.nodeSpatialIndexDirty = true;
      this.stats.nodes = this.nodeRecords.length;
    }

    wireRecordKey(record) {
      return `${record.connectionId}\u0000${record.segmentIndex}`;
    }

    prepareWireRecord(segment) {
      const curve =
        curveFromSegment(segment);
      let length = 0;
      let previous = cubicPoint(curve, 0);
      for (let index = 1; index <= 12; index += 1) {
        const point = cubicPoint(curve, index / 12);
        length += Math.hypot(
          point.x - previous.x,
          point.y - previous.y
        );
        previous = point;
      }
      return {
        ...segment,
        curve,
        length,
        bounds: curveBounds(curve)
      };
    }

    wireLayerSignature(record) {
      const curve = record.curve;
      return [
        curve.p0.x,
        curve.p0.y,
        curve.p1.x,
        curve.p1.y,
        curve.p2.x,
        curve.p2.y,
        curve.p3.x,
        curve.p3.y,
        record.color,
        record.impulse === true ? 1 : 0,
        record.selected === true ? 1 : 0,
        record.targetState === "valid" ? 1 : 0,
        record.targetState === "invalid" ? 1 : 0,
        record.hidden === true ? 1 : 0
      ].join("|");
    }

    createWireLayerData(record) {
      if (record.hidden === true) {
        
        
        
        return [
          -1000000, -1000000,
          -1000000, -1000000,
          -1000000, -1000000,
          -1000000, -1000000,
          0, 0, 0, 0,
          0, 0, 0
        ];
      }
      const invalid =
        record.targetState === "invalid";
      const selected =
        record.selected === true;
      const valid =
        record.targetState === "valid";
      const curve = record.curve;
      const baseColor = colorComponents(
        record.color,
        invalid ? 0.28 : 1
      );
      const style =
        (selected ? 1 : 0) +
        (valid ? 2 : 0) +
        (invalid ? 4 : 0);
      return [
        curve.p0.x,
        curve.p0.y,
        curve.p1.x,
        curve.p1.y,
        curve.p2.x,
        curve.p2.y,
        curve.p3.x,
        curve.p3.y,
        baseColor[0],
        baseColor[1],
        baseColor[2],
        baseColor[3],
        style,
        record.impulse === true ? 1 : 0,
        record.length
      ];
    }

    buildWireSpatialIndex() {
      if (!this.wireSpatialIndexDirty) {
        return;
      }
      const started = performance.now();
      this.wireSpatialIndex.clear();
      for (const record of this.wireRecords) {
        addWireToSpatialIndex(
          this.wireSpatialIndex,
          record,
          WIRE_CELL_SIZE,
          24
        );
      }
      this.wireSpatialIndexDirty = false;
      this.stats.wireIndexMilliseconds =
        performance.now() - started;
    }

    buildNodeSpatialIndex() {
      if (!this.nodeSpatialIndexDirty) {
        return;
      }
      const started = performance.now();
      this.nodeSpatialIndex.clear();
      for (const record of this.nodeRecords) {
        addToSpatialIndex(
          this.nodeSpatialIndex,
          record,
          NODE_CELL_SIZE,
          record
        );
      }
      this.nodeSpatialIndexDirty = false;
      this.stats.nodeIndexMilliseconds =
        performance.now() - started;
    }

    rebuildWireBuffers() {
      const gl = this.gl;
      if (!gl) {
        return;
      }

      const instances = [];
      const nextCache = new Map();

      for (const record of this.wireRecords) {
        const cacheKey =
          this.wireRecordKey(record);
        const signature =
          this.wireLayerSignature(
            record
          );
        const cached =
          this.wireLayerCache.get(
            cacheKey
          );
        let layerData =
          cached?.signature === signature
            ? cached.data
            : null;

        if (!layerData) {
          layerData =
            this.createWireLayerData(
              record
            );
        }
        nextCache.set(cacheKey, {
          signature,
          data: layerData
        });
        instances.push(...layerData);
      }

      this.wireLayerCache = nextCache;

      const instanceData = new Float32Array(instances);
      this.wireInstanceData = instanceData;
      gl.bindBuffer(gl.ARRAY_BUFFER, this.wireVertexBuffer);
      gl.bufferData(
        gl.ARRAY_BUFFER,
        instanceData,
        gl.DYNAMIC_DRAW
      );
      this.wireInstanceCount =
        instanceData.length /
        FLOATS_PER_WIRE_INSTANCE;
      this.wireVertexCount =
        this.wireInstanceCount *
        (GPU_CURVE_STEPS + 1) * 2;
      this.stats.wireVertices = this.wireVertexCount;
      this.stats.wireInstances =
        this.wireInstanceCount;
    }

    updateSegments(segments = []) {
      const gl = this.gl;
      if (
        !gl ||
        !this.available ||
        !Array.isArray(segments) ||
        segments.length === 0
      ) {
        return false;
      }

      const prepared = [];
      for (const segment of segments) {
        const record =
          this.prepareWireRecord(
            segment
          );
        const key =
          this.wireRecordKey(record);
        const index =
          this.wireRecordIndexByKey.get(
            key
          );
        if (!Number.isInteger(index)) {
          return false;
        }
        const data = new Float32Array(
          this.createWireLayerData(
            record
          )
        );
        if (
          data.length !==
          WIRE_LAYERS_PER_SEGMENT *
            FLOATS_PER_WIRE_INSTANCE
        ) {
          return false;
        }
        prepared.push({
          key,
          index,
          record,
          segment,
          data
        });
      }

      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        this.wireVertexBuffer
      );
      for (const update of prepared) {
        const floatOffset =
          update.index *
          WIRE_LAYERS_PER_SEGMENT *
          FLOATS_PER_WIRE_INSTANCE;
        this.wireRecords[
          update.index
        ] = update.record;
        this.scene.segments[
          update.index
        ] = { ...update.segment };
        this.wireInstanceData.set(
          update.data,
          floatOffset
        );
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          floatOffset * 4,
          update.data
        );
        this.wireLayerCache.set(
          update.key,
          {
            signature:
              this.wireLayerSignature(
                update.record
              ),
            data: [
              ...update.data
            ]
          }
        );
      }
      this.wireSpatialIndexDirty = true;
      this.scheduleDraw();
      return true;
    }

    hideConnections(connectionIds = []) {
      const ids = new Set(
        Array.isArray(connectionIds) ||
        connectionIds instanceof Set
          ? connectionIds
          : [connectionIds]
      );
      ids.delete("");
      ids.delete(null);
      ids.delete(undefined);
      if (ids.size === 0) {
        return 0;
      }

      const updates = [];
      for (
        let index = 0;
        index < this.wireRecords.length;
        index += 1
      ) {
        const previous = this.wireRecords[index];
        if (
          previous.hidden === true ||
          !ids.has(previous.connectionId)
        ) {
          continue;
        }
        const record = {
          ...previous,
          hidden: true
        };
        const segment = {
          ...(this.scene.segments[index] || {}),
          hidden: true
        };
        const data = new Float32Array(
          this.createWireLayerData(record)
        );
        this.wireRecords[index] = record;
        this.scene.segments[index] = segment;
        updates.push({ index, record, data });
      }

      if (updates.length === 0) {
        return 0;
      }

      if (
        this.available &&
        this.gl &&
        this.wireInstanceData.length > 0
      ) {
        this.gl.bindBuffer(
          this.gl.ARRAY_BUFFER,
          this.wireVertexBuffer
        );
        for (const update of updates) {
          const floatOffset =
            update.index *
            WIRE_LAYERS_PER_SEGMENT *
            FLOATS_PER_WIRE_INSTANCE;
          this.wireInstanceData.set(
            update.data,
            floatOffset
          );
          this.gl.bufferSubData(
            this.gl.ARRAY_BUFFER,
            floatOffset * 4,
            update.data
          );
          this.wireLayerCache.set(
            this.wireRecordKey(update.record),
            {
              signature:
                this.wireLayerSignature(
                  update.record
                ),
              data: [...update.data]
            }
          );
        }
      }

      this.wireSpatialIndexDirty = true;
      this.stats.hiddenConnections =
        new Set(
          this.wireRecords
            .filter(record => record.hidden === true)
            .map(record => record.connectionId)
        ).size;
      this.scheduleDraw();
      return new Set(
        updates.map(
          update => update.record.connectionId
        )
      ).size;
    }

    rebuildNodeBuffers() {
      const gl = this.gl;
      if (!gl) {
        return;
      }
      const vertices = [];
      const indices = [];
      for (const node of this.nodeRecords) {
        const x = node.left;
        const y = node.top;
        const width = Math.max(1, node.right - node.left);
        const height = Math.max(1, node.bottom - node.top);
        const start = vertices.length / FLOATS_PER_NODE_VERTEX;
        const configuration = node.configuration === true ? 1 : 0;
        const selected = node.selected === true ? 1 : 0;
        const corners = [
          [x, y, 0, 0],
          [x + width, y, width, 0],
          [x, y + height, 0, height],
          [x + width, y + height, width, height]
        ];
        for (const corner of corners) {
          vertices.push(
            corner[0],
            corner[1],
            corner[2],
            corner[3],
            width,
            height,
            configuration,
            selected,
            corner[3] <= 45 ? 1 : 0
          );
        }
        indices.push(
          start,
          start + 1,
          start + 2,
          start + 2,
          start + 1,
          start + 3
        );
      }
      const vertexData = new Float32Array(vertices);
      const indexData = new Uint32Array(indices);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.nodeVertexBuffer);
      gl.bufferData(gl.ARRAY_BUFFER, vertexData, gl.DYNAMIC_DRAW);
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.nodeIndexBuffer);
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indexData, gl.DYNAMIC_DRAW);
      this.nodeVertexCount =
        vertexData.length / FLOATS_PER_NODE_VERTEX;
      this.nodeIndexCount = indexData.length;
      this.stats.nodeVertices = this.nodeVertexCount;
    }

    scheduleDraw() {
      if (
        this.frame ||
        !this.available ||
        !this.viewport ||
        this.disposed
      ) {
        return;
      }
      this.frame = requestAnimationFrame(() => {
        this.frame = 0;
        this.draw();
      });
    }

    drawNow() {
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
      this.draw();
    }

    draw() {
      const gl = this.gl;
      if (
        !gl ||
        !this.available ||
        this.contextLost ||
        !this.viewport ||
        this.disposed
      ) {
        return;
      }
      const started = performance.now();
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
      gl.clearColor(0.0314, 0.0392, 0.0627, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      let drawCalls = 0;

      gl.useProgram(this.gridProgram);
      gl.uniform2f(
        this.uniforms.grid.resolution,
        this.canvas.width,
        this.canvas.height
      );
      gl.uniform1f(
        this.uniforms.grid.pixelRatio,
        this.pixelRatio
      );
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      drawCalls += 1;

      if (this.wireInstanceCount > 0) {
        gl.useProgram(this.wireProgram);
        gl.uniform2f(
          this.uniforms.wire.resolution,
          this.cssWidth,
          this.cssHeight
        );
        gl.uniform2f(
          this.uniforms.wire.pan,
          this.camera.x,
          this.camera.y
        );
        gl.uniform1f(
          this.uniforms.wire.scale,
          this.camera.scale
        );
        gl.bindVertexArray(this.wireVertexArray);
        gl.drawArraysInstanced(
          gl.TRIANGLE_STRIP,
          0,
          (GPU_CURVE_STEPS + 1) * 2,
          this.wireInstanceCount
        );
        drawCalls += 1;
      }

      if (this.previewInstanceCount > 0) {
        gl.useProgram(this.wireProgram);
        gl.uniform2f(
          this.uniforms.wire.resolution,
          this.cssWidth,
          this.cssHeight
        );
        gl.uniform2f(
          this.uniforms.wire.pan,
          this.camera.x,
          this.camera.y
        );
        gl.uniform1f(
          this.uniforms.wire.scale,
          this.camera.scale
        );
        gl.bindVertexArray(
          this.previewVertexArray
        );
        gl.drawArraysInstanced(
          gl.TRIANGLE_STRIP,
          0,
          (GPU_CURVE_STEPS + 1) * 2,
          this.previewInstanceCount
        );
        drawCalls += 1;
      }

      if (this.nodeIndexCount > 0) {
        gl.useProgram(this.nodeProgram);
        gl.uniform2f(
          this.uniforms.node.resolution,
          this.cssWidth,
          this.cssHeight
        );
        gl.uniform2f(
          this.uniforms.node.pan,
          this.camera.x,
          this.camera.y
        );
        gl.uniform1f(
          this.uniforms.node.scale,
          this.camera.scale
        );
        gl.bindVertexArray(this.nodeVertexArray);
        gl.drawElements(
          gl.TRIANGLES,
          this.nodeIndexCount,
          gl.UNSIGNED_INT,
          0
        );
        drawCalls += 1;
      }

      gl.bindVertexArray(null);
      this.stats.drawCalls = drawCalls;
      const elapsed = performance.now() - started;
      this.drawSamples += 1;
      this.stats.lastDrawMilliseconds = elapsed;
      this.stats.maximumDrawMilliseconds = Math.max(
        this.stats.maximumDrawMilliseconds,
        elapsed
      );
      this.stats.averageDrawMilliseconds +=
        (elapsed - this.stats.averageDrawMilliseconds) /
        this.drawSamples;
    }

    clientToGraph(clientX, clientY) {
      const rectangle = this.viewport?.getBoundingClientRect();
      if (!rectangle) {
        return { x: 0, y: 0 };
      }
      return {
        x:
          (
            clientX - rectangle.left - this.camera.x
          ) / this.camera.scale,
        y:
          (
            clientY - rectangle.top - this.camera.y
          ) / this.camera.scale
      };
    }

    virtualPath(record) {
      const curve = record.curve;
      const approximateLength = (() => {
        let length = 0;
        let previous = cubicPoint(curve, 0);
        for (let index = 1; index <= 36; index += 1) {
          const point = cubicPoint(curve, index / 36);
          length += Math.hypot(
            point.x - previous.x,
            point.y - previous.y
          );
          previous = point;
        }
        return length;
      })();
      return {
        dataset: {
          connectionId: String(record.connectionId || ""),
          segmentIndex: String(record.segmentIndex ?? 0)
        },
        isConnected: true,
        _rmlGraphSegment: record,
        getTotalLength() {
          return approximateLength;
        },
        getPointAtLength(length) {
          const t = approximateLength > 0
            ? clamp(length / approximateLength, 0, 1)
            : 0;
          return cubicPoint(curve, t);
        }
      };
    }

    pickWire(clientX, clientY, radiusPixels = 12, excludedConnectionId = null) {
      if (!this.wireRecords.length) {
        return null;
      }
      const started = performance.now();
      const target = this.clientToGraph(clientX, clientY);
      const radius = Math.max(1, radiusPixels / this.camera.scale);
      const bounds = {
        left: target.x - radius,
        top: target.y - radius,
        right: target.x + radius,
        bottom: target.y + radius
      };
      const candidates = new Set();
      if (
        this.wireRecords.length <=
          WIRE_LINEAR_PICK_LIMIT
      ) {
        for (const record of this.wireRecords) {
          if (
            record.bounds.right >= bounds.left &&
            record.bounds.left <= bounds.right &&
            record.bounds.bottom >= bounds.top &&
            record.bounds.top <= bounds.bottom
          ) {
            candidates.add(record);
          }
        }
      } else {
        this.buildWireSpatialIndex();
        const range = cellRange(bounds, WIRE_CELL_SIZE);
        for (let y = range.minimumY; y <= range.maximumY; y += 1) {
          for (let x = range.minimumX; x <= range.maximumX; x += 1) {
            for (const record of this.wireSpatialIndex.get(`${x}:${y}`) || []) {
              candidates.add(record);
            }
          }
        }
      }
      let best = null;
      this.stats.lastWirePickCandidates =
        candidates.size;
      for (const record of candidates) {
        if (record.hidden === true) {
          continue;
        }
        if (
          excludedConnectionId &&
          record.connectionId === excludedConnectionId
        ) {
          continue;
        }
        const nearest = nearestPointOnCurve(record.curve, target);
        if (
          nearest.distanceSquared <= radius * radius &&
          (!best || nearest.distanceSquared < best.nearest.distanceSquared)
        ) {
          best = { record, nearest };
        }
      }
      if (!best) {
        this.stats.lastWirePickMilliseconds =
          performance.now() - started;
        return null;
      }
      this.stats.lastWirePickMilliseconds =
        performance.now() - started;
      return {
        connectionId: best.record.connectionId,
        segmentIndex: best.record.segmentIndex,
        point: {
          x: best.nearest.x,
          y: best.nearest.y
        },
        distancePixels:
          Math.sqrt(best.nearest.distanceSquared) * this.camera.scale,
        path: this.virtualPath(best.record)
      };
    }

    pickNode(clientX, clientY) {
      if (!this.nodeRecords.length) {
        return null;
      }
      const started = performance.now();
      this.buildNodeSpatialIndex();
      const target = this.clientToGraph(clientX, clientY);
      const cellX = Math.floor(target.x / NODE_CELL_SIZE);
      const cellY = Math.floor(target.y / NODE_CELL_SIZE);
      const candidates = this.nodeSpatialIndex.get(`${cellX}:${cellY}`) || [];
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        const record = candidates[index];
        if (
          target.x >= record.left &&
          target.x <= record.right &&
          target.y >= record.top &&
          target.y <= record.bottom
        ) {
          this.stats.lastNodePickMilliseconds =
            performance.now() - started;
          return {
            nodeId: record.nodeId,
            header: target.y <= record.top + Math.min(45, record.bottom - record.top),
            graphX: target.x,
            graphY: target.y
          };
        }
      }
      this.stats.lastNodePickMilliseconds =
        performance.now() - started;
      return null;
    }

    nearestGraphPoint(pathOrRecord, clientX, clientY) {
      const record =
        pathOrRecord?._rmlGraphSegment ||
        pathOrRecord?.curve
          ? pathOrRecord._rmlGraphSegment || pathOrRecord
          : null;
      if (!record) {
        return this.clientToGraph(clientX, clientY);
      }
      const target = this.clientToGraph(clientX, clientY);
      const nearest = nearestPointOnCurve(record.curve, target);
      return {
        x: nearest.x,
        y: nearest.y
      };
    }

    getStats() {
      return {
        ...this.stats,
        available: this.available,
        contextLost: this.contextLost,
        pixelRatio: this.pixelRatio,
        width: this.cssWidth,
        height: this.cssHeight
      };
    }

    dispose() {
      if (this.disposed) {
        return;
      }
      if (this.frame) {
        cancelAnimationFrame(this.frame);
        this.frame = 0;
      }
      this.resizeObserver?.disconnect();
      this.resizeObserver = null;
      this.clearScene();
      this.deleteGpuResources();
      this.canvas.remove();
      this.setAvailability(false);
      this.canvas.removeEventListener(
        "webglcontextlost",
        this.handleContextLost
      );
      this.canvas.removeEventListener(
        "webglcontextrestored",
        this.handleContextRestored
      );
      this.viewport = null;
      this.onAvailabilityChange = null;
      this.gl = null;
      this.disposed = true;
    }
  }

  Object.defineProperty(
    window,
    "RMLGraphHybridRenderer",
    {
      value: Object.freeze({
        version: VERSION,
        create(options) {
          return new GraphHybridRenderer(options);
        }
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
