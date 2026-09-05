(() => {
  "use strict";

  const VERSION = 13;
  const WIRE_CULL_CELL_SIZE = 960;
  const NODE_CELL_SIZE = 360;
  const WIRE_LINEAR_PICK_LIMIT = 512;
  const MAX_CULL_QUERY_CELLS = 4096;
  const MAX_WIRE_CULL_RECORD_CELLS = 256;
  const SPATIAL_KEY_STRIDE = 2000003;
  const WIRE_CULL_MARGIN_PIXELS = 24;
  const NODE_CULL_MARGIN_PIXELS = 8;
  const GPU_CURVE_STEPS = 32;
  const GPU_MAX_CURVE_STEPS = 64;
  const FLOATS_PER_WIRE_INSTANCE = 15;
  const WIRE_LAYERS_PER_SEGMENT = 1;
  const FLOATS_PER_NODE_INSTANCE = 6;
  const WEBGPU_WORKGROUP_SIZE = 128;
  const WEBGPU_CULL_OVERSCAN_PIXELS = 384;
  const WEBGPU_CULL_SCALE_REUSE_RATIO = 1.125;
  const WEBGPU_ASYNC_INDEX_THRESHOLD = 20000;
  const WEBGPU_INDEX_BATCH_SIZE = 1024;
  const RENDERER_BACKEND_STORAGE_KEY =
    "rml.graph.rendererBackend";
  const RENDERER_BACKENDS = new Set([
    "auto",
    "wgsl",
    "glsl",
    "svg"
  ]);

  function normalizeRendererBackend(value) {
    const normalized = String(value || "auto")
      .trim()
      .toLowerCase();
    if (normalized === "webgpu") {
      return "wgsl";
    }
    if (
      normalized === "webgl" ||
      normalized === "webgl2"
    ) {
      return "glsl";
    }
    return RENDERER_BACKENDS.has(normalized)
      ? normalized
      : null;
  }

  function storedRendererBackend() {
    try {
      return normalizeRendererBackend(
        window.localStorage?.getItem(
          RENDERER_BACKEND_STORAGE_KEY
        )
      ) || "auto";
    } catch {
      return "auto";
    }
  }

  function persistRendererBackend(value) {
    try {
      if (value === "auto") {
        window.localStorage?.removeItem(
          RENDERER_BACKEND_STORAGE_KEY
        );
      } else {
        window.localStorage?.setItem(
          RENDERER_BACKEND_STORAGE_KEY,
          value
        );
      }
    } catch {}
  }

  function curveStepsForScale(
    scale,
    maximumCurveLength = 0
  ) {
    const zoom = Math.max(
      0.0001,
      finite(scale, 1)
    );
    let steps = GPU_CURVE_STEPS;
    if (zoom <= 0.12) {
      steps = 8;
    } else if (zoom <= 0.35) {
      steps = 16;
    } else if (zoom <= 0.75) {
      steps = 24;
    }
    const projectedLength =
      Number.isFinite(maximumCurveLength)
        ? Math.max(0, maximumCurveLength) * zoom
        : Infinity;
    if (projectedLength >= 1800) {
      return GPU_MAX_CURVE_STEPS;
    }
    if (projectedLength >= 900) {
      return Math.max(steps, 48);
    }
    if (projectedLength >= 420) {
      return Math.max(steps, 32);
    }
    if (projectedLength >= 200) {
      return Math.max(steps, 24);
    }
    if (projectedLength >= 80) {
      return Math.max(steps, 16);
    }
    return steps;
  }

  function curveControlPolygonLength(curve) {
    if (!curve) return 0;
    return (
      Math.hypot(
        curve.p1.x - curve.p0.x,
        curve.p1.y - curve.p0.y
      ) +
      Math.hypot(
        curve.p2.x - curve.p1.x,
        curve.p2.y - curve.p1.y
      ) +
      Math.hypot(
        curve.p3.x - curve.p2.x,
        curve.p3.y - curve.p2.y
      )
    );
  }

  function maximumCurveControlPolygonLength(
    records
  ) {
    let maximum = 0;
    for (const record of records || []) {
      maximum = Math.max(
        maximum,
        curveControlPolygonLength(record?.curve)
      );
      if (!Number.isFinite(maximum)) {
        return Infinity;
      }
    }
    return maximum;
  }

  function webGpuAdapterOptions() {
    const platform = String(
      navigator.userAgentData?.platform ||
      navigator.platform ||
      ""
    );
    return /windows|win32|win64/i.test(platform)
      ? undefined
      : { powerPreference: "high-performance" };
  }

  let rendererBackendPreference =
    storedRendererBackend();
  let activeRendererBackend = "none";

  const webGpuRuntime = {
    adapter: null,
    device: null,
    format: null,
    pipelines: null,
    error: null,
    ready: null
  };

  webGpuRuntime.ready = (async () => {
    if (
      rendererBackendPreference === "glsl" ||
      rendererBackendPreference === "svg" ||
      typeof navigator === "undefined" ||
      !navigator.gpu
    ) {
      return false;
    }
    try {
      const adapter =
        await navigator.gpu.requestAdapter(
          webGpuAdapterOptions()
        );
      if (!adapter) {
        return false;
      }
      const device =
        await adapter.requestDevice();
      const format =
        navigator.gpu.getPreferredCanvasFormat();
      device.pushErrorScope("validation");
      const pipelineHolder = {
        gpuDevice: device,
        gpuFormat: format,
        gpuPipelines: Object.create(null)
      };
      await GraphWebGpuRenderer.prototype
        .createWebGpuPipelines.call(
          pipelineHolder
        );
      const validationError =
        await device.popErrorScope();
      if (validationError) {
        throw validationError;
      }
      webGpuRuntime.adapter = adapter;
      webGpuRuntime.device = device;
      webGpuRuntime.format = format;
      webGpuRuntime.pipelines =
        pipelineHolder.gpuPipelines;
      return true;
    } catch (error) {
      webGpuRuntime.error = error;
      console.warn(
        "RML graph WebGPU initialization failed; WebGL2 remains active.",
        error
      );
      return false;
    }
  })();

  function grownCapacity(current, required, minimum = 64) {
    let capacity = Math.max(
      minimum,
      Number.isFinite(current) ? current : 0
    );
    while (capacity < required) {
      capacity *= 2;
    }
    return capacity;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, value));
  }

  function finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function writeColorComponents(
    value,
    alpha,
    target,
    offset
  ) {
    const text = String(value || "#9da8b4").trim();
    const match = text.match(
      /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})?$/i
    );

    if (!match) {
      target[offset] = 0.616;
      target[offset + 1] = 0.659;
      target[offset + 2] = 0.706;
      target[offset + 3] = alpha;
      return;
    }

    target[offset] =
      Number.parseInt(match[1], 16) / 255;
    target[offset + 1] =
      Number.parseInt(match[2], 16) / 255;
    target[offset + 2] =
      Number.parseInt(match[3], 16) / 255;
    target[offset + 3] =
      alpha * (
        match[4]
          ? Number.parseInt(match[4], 16) / 255
          : 1
      );
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

  function cubicCoordinate(
    p0,
    p1,
    p2,
    p3,
    t
  ) {
    const inverse = 1 - t;
    const inverse2 = inverse * inverse;
    const t2 = t * t;
    return (
      inverse2 * inverse * p0 +
      3 * inverse2 * t * p1 +
      3 * inverse * t2 * p2 +
      t2 * t * p3
    );
  }

  function approximateCubicLength(
    curve,
    steps
  ) {
    let length = 0;
    let previousX = curve.p0.x;
    let previousY = curve.p0.y;
    for (let index = 1; index <= steps; index += 1) {
      const t = index / steps;
      const x = cubicCoordinate(
        curve.p0.x,
        curve.p1.x,
        curve.p2.x,
        curve.p3.x,
        t
      );
      const y = cubicCoordinate(
        curve.p0.y,
        curve.p1.y,
        curve.p2.y,
        curve.p3.y,
        t
      );
      length += Math.hypot(
        x - previousX,
        y - previousY
      );
      previousX = x;
      previousY = y;
    }
    return length;
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
    return {
      left: Math.min(
        curve.p0.x,
        curve.p1.x,
        curve.p2.x,
        curve.p3.x
      ),
      top: Math.min(
        curve.p0.y,
        curve.p1.y,
        curve.p2.y,
        curve.p3.y
      ),
      right: Math.max(
        curve.p0.x,
        curve.p1.x,
        curve.p2.x,
        curve.p3.x
      ),
      bottom: Math.max(
        curve.p0.y,
        curve.p1.y,
        curve.p2.y,
        curve.p3.y
      )
    };
  }

  function sameCurve(a, b) {
    return Boolean(
      a &&
      b &&
      a.p0.x === b.p0.x &&
      a.p0.y === b.p0.y &&
      a.p1.x === b.p1.x &&
      a.p1.y === b.p1.y &&
      a.p2.x === b.p2.x &&
      a.p2.y === b.p2.y &&
      a.p3.x === b.p3.x &&
      a.p3.y === b.p3.y
    );
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

  function spatialKey(x, y) {
    return y * SPATIAL_KEY_STRIDE + x;
  }

  function addToSpatialIndex(index, bounds, cellSize, value, padding = 0) {
    const range = cellRange(bounds, cellSize, padding);
    const keys = [];
    for (let y = range.minimumY; y <= range.maximumY; y += 1) {
      for (let x = range.minimumX; x <= range.maximumX; x += 1) {
        const key = spatialKey(x, y);
        const values = index.get(key) || [];
        values.push(value);
        index.set(key, values);
        keys.push(key);
      }
    }
    return keys;
  }

  function removeFromSpatialIndex(index, keys, value) {
    if (!Array.isArray(keys)) {
      return;
    }
    for (const key of keys) {
      const values = index.get(key);
      if (!values) {
        continue;
      }
      const position = values.indexOf(value);
      if (position >= 0) {
        values.splice(position, 1);
      }
      if (values.length === 0) {
        index.delete(key);
      }
    }
  }

  function intersectsBounds(record, bounds) {
    return !(
      record.right < bounds.left ||
      record.left > bounds.right ||
      record.bottom < bounds.top ||
      record.top > bounds.bottom
    );
  }

  function containsBounds(outer, inner) {
    return Boolean(
      outer &&
      inner &&
      outer.left <= inner.left &&
      outer.top <= inner.top &&
      outer.right >= inner.right &&
      outer.bottom >= inner.bottom
    );
  }

  function spatialQueryCellCount(bounds, cellSize) {
    const range = cellRange(bounds, cellSize);
    const columns = Math.max(
      0,
      range.maximumX - range.minimumX + 1
    );
    const rows = Math.max(
      0,
      range.maximumY - range.minimumY + 1
    );
    return columns * rows;
  }

  function sameRecordOrder(previous, records) {
    if (previous.length !== records.length) {
      return false;
    }
    for (let index = 0; index < records.length; index += 1) {
      if (previous[index] !== records[index]) {
        return false;
      }
    }
    return true;
  }

  function spatialRecordsInBounds(
    index,
    records,
    bounds,
    cellSize,
    accept = () => true,
    overflowRecords = []
  ) {
    const range = cellRange(bounds, cellSize);
    const columns =
      range.maximumX - range.minimumX + 1;
    const rows =
      range.maximumY - range.minimumY + 1;
    const result = [];

    if (
      columns <= 0 ||
      rows <= 0
    ) {
      return result;
    }

    if (
      columns * rows >
        MAX_CULL_QUERY_CELLS
    ) {
      for (const record of records) {
        if (
          accept(record) &&
          intersectsBounds(
            record.bounds || record,
            bounds
          )
        ) {
          result.push(record);
        }
      }
      return result;
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
          index.get(spatialKey(x, y)) || []) {
          candidates.add(record);
        }
      }
    }

    for (const record of candidates) {
      if (
        accept(record) &&
        intersectsBounds(
          record.bounds || record,
          bounds
        )
      ) {
        result.push(record);
      }
    }
    for (const record of overflowRecords) {
      if (
        !candidates.has(record) &&
        accept(record) &&
        intersectsBounds(
          record.bounds || record,
          bounds
        )
      ) {
        result.push(record);
      }
    }
    result.sort((a, b) => a.order - b.order);
    return result;
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
      this.nodeInstanceBuffer = null;
      this.wireRecords = [];
      this.wireCullSpatialIndex = new Map();
      this.wireCullOverflowRecords = [];
      this.wireRecordIndexByKey = new Map();
      this.wireInstanceData = new Float32Array(0);
      this.wireInstanceCapacity = 0;
      this.visibleWireInstanceData = new Float32Array(0);
      this.visibleWireInstanceCapacity = 0;
      this.visibleWireRecords = [];
      this.maximumWireCurveLength = 0;
      this.wireDataRevision = 0;
      this.visibleWireDataRevision = -1;
      this.visibleWireSelectionDirty = true;
      this.wireBufferBytes = 0;
      this.wireScratchData = new Float32Array(
        FLOATS_PER_WIRE_INSTANCE
      );
      this.previewInstanceData = new Float32Array(
        FLOATS_PER_WIRE_INSTANCE
      );
      this.previewSegment = null;
      this.previewInstanceCount = 0;
      this.nodeRecords = [];
      this.nodeRecordIndexById = new Map();
      this.nodeSpatialIndex = new Map();
      this.nodeExcludedIds = new Set();
      this.wireCullSpatialIndexDirty = true;
      this.nodeSpatialIndexDirty = true;
      this.wireVertexCount = 0;
      this.wireInstanceCount = 0;
      this.nodeInstanceData = new Float32Array(0);
      this.nodeInstanceCapacity = 0;
      this.visibleNodeInstanceData = new Float32Array(0);
      this.visibleNodeInstanceCapacity = 0;
      this.visibleNodeRecords = [];
      this.nodeDataRevision = 0;
      this.visibleNodeDataRevision = -1;
      this.visibleNodeSelectionDirty = true;
      this.nodeBufferBytes = 0;
      this.nodeInstanceCount = 0;
      this.nodeVertexCount = 0;
      this.stats = {
        renderer: "svg-fallback",
        segments: 0,
        nodes: 0,
        wireVertices: 0,
        wireInstances: 0,
        visibleSegments: 0,
        culledSegments: 0,
        nodeVertices: 0,
        nodeInstances: 0,
        visibleNodes: 0,
        culledNodes: 0,
        drawCalls: 0,
        curveSteps: GPU_CURVE_STEPS,
        lastDrawMilliseconds: 0,
        averageDrawMilliseconds: 0,
        maximumDrawMilliseconds: 0,
        wireIndexMilliseconds: 0,
        wireCullIndexMilliseconds: 0,
        nodeIndexMilliseconds: 0,
        lastWirePickMilliseconds: 0,
        lastWirePickCandidates: 0,
        hiddenConnections: 0,
        reusedWireGeometries: 0,
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
        this.setScene(this.scene, true);
        this.setPreview(
          this.previewSegment
        );
      };
      if (!options.deferGraphics) {
        this.canvas.addEventListener(
          "webglcontextlost",
          this.handleContextLost
        );
        this.canvas.addEventListener(
          "webglcontextrestored",
          this.handleContextRestored
        );
        this.initialize();
      }
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
      activeRendererBackend = next
        ? "webgl2-glsl"
        : "svg-fallback";
      this.onAvailabilityChange?.(next);
    }

    initialize() {
      if (this.contextLost || this.disposed) {
        return false;
      }

      let gl;
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

      this.canvas.width = 1;
      this.canvas.height = 1;
      this.canvas.dataset.rmlCssWidth = "1";
      this.canvas.dataset.rmlCssHeight = "1";
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
      this.wireCullSpatialIndex.clear();
      this.wireCullOverflowRecords = [];
      this.nodeSpatialIndex.clear();
      this.wireRecordIndexByKey.clear();
      this.nodeRecordIndexById.clear();
      this.wireInstanceData = new Float32Array(0);
      this.wireInstanceCapacity = 0;
      this.visibleWireInstanceData = new Float32Array(0);
      this.visibleWireInstanceCapacity = 0;
      this.visibleWireRecords = [];
      this.maximumWireCurveLength = 0;
      this.wireDataRevision += 1;
      this.visibleWireDataRevision = -1;
      this.visibleWireSelectionDirty = true;
      this.wireBufferBytes = 0;
      this.wireCullSpatialIndexDirty = false;
      this.nodeSpatialIndexDirty = false;
      this.wireVertexCount = 0;
      this.wireInstanceCount = 0;
      this.nodeInstanceData = new Float32Array(0);
      this.nodeInstanceCapacity = 0;
      this.visibleNodeInstanceData = new Float32Array(0);
      this.visibleNodeInstanceCapacity = 0;
      this.visibleNodeRecords = [];
      this.nodeExcludedIds.clear();
      this.nodeDataRevision += 1;
      this.visibleNodeDataRevision = -1;
      this.visibleNodeSelectionDirty = true;
      this.nodeBufferBytes = 0;
      this.nodeInstanceCount = 0;
      this.nodeVertexCount = 0;
      this.stats.segments = 0;
      this.stats.nodes = 0;
      this.stats.wireVertices = 0;
      this.stats.wireInstances = 0;
      this.stats.visibleSegments = 0;
      this.stats.culledSegments = 0;
      this.stats.nodeVertices = 0;
      this.stats.nodeInstances = 0;
      this.stats.visibleNodes = 0;
      this.stats.culledNodes = 0;
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
          this.nodeInstanceBuffer
        );
        gl.bufferData(
          gl.ARRAY_BUFFER,
          0,
          gl.DYNAMIC_DRAW
        );
        gl.bindBuffer(gl.ARRAY_BUFFER, null);
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
          this.nodeInstanceBuffer
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
      this.nodeInstanceBuffer = null;
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
          float phase = mod(pixel, spacing);
          float distanceToLine = min(
            phase,
            spacing - phase
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
        uniform float uCurveSteps;
        flat out vec4 vColor;
        out float vEdgePixels;
        flat out float vCoreHalfPixels;
        out float vDistance;
        flat out float vDash;
        flat out float vStyle;
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
          int pointIndex = gl_VertexID / 2;
          float side = (gl_VertexID & 1) == 0
            ? -1.0
            : 1.0;
          float activeSteps = max(1.0, uCurveSteps);
          float t = clamp(
            float(pointIndex) / activeSteps,
            0.0,
            1.0
          );
          vec2 position = cubicPoint(t);
          float derivativeStep =
            0.5 / activeSteps;
          vec2 incomingDerivative =
            cubicDerivative(
              max(0.0, t - derivativeStep)
            );
          vec2 outgoingDerivative =
            cubicDerivative(
              min(1.0, t + derivativeStep)
            );
          float incomingLength =
            length(incomingDerivative);
          float outgoingLength =
            length(outgoingDerivative);
          vec2 fallbackDirection = aP3 - aP0;
          float fallbackLength = length(fallbackDirection);
          if (fallbackLength <= 0.000001) {
            fallbackDirection = vec2(1.0, 0.0);
            fallbackLength = 1.0;
          }
          vec2 incomingDirection =
            incomingLength > 0.000001
              ? incomingDerivative / incomingLength
              : vec2(0.0);
          vec2 outgoingDirection =
            outgoingLength > 0.000001
              ? outgoingDerivative / outgoingLength
              : vec2(0.0);
          if (pointIndex == 0) {
            incomingDirection = outgoingDirection;
          }
          if (pointIndex == int(activeSteps)) {
            outgoingDirection = incomingDirection;
          }
          vec2 joinedDirection =
            incomingDirection + outgoingDirection;
          float joinedLength =
            length(joinedDirection);
          vec2 tangent = joinedLength > 0.000001
            ? joinedDirection / joinedLength
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
        flat in vec4 vColor;
        in float vEdgePixels;
        flat in float vCoreHalfPixels;
        in float vDistance;
        flat in float vDash;
        flat in float vStyle;
        out vec4 outputColor;
        float coverage(
          float edgeDistance,
          float halfWidth
        ) {
          return 1.0 - smoothstep(
            halfWidth,
            halfWidth + 1.25,
            edgeDistance
          );
        }
        vec4 overPremultiplied(
          vec4 under,
          vec3 upperColor,
          float upperAlpha
        ) {
          float inverse = 1.0 - upperAlpha;
          return vec4(
            upperColor * upperAlpha + under.rgb * inverse,
            upperAlpha + under.a * inverse
          );
        }
        void main() {
          bool selected = mod(vStyle, 2.0) >= 1.0;
          bool valid = mod(floor(vStyle / 2.0), 2.0) >= 1.0;
          bool invalid = floor(vStyle / 4.0) >= 1.0;
          float scaleEstimate = max(
            0.0001,
            vCoreHalfPixels / 2.0
          );
          float edgeDistance = abs(vEdgePixels);
          vec4 result = vec4(0.0);
          result = overPremultiplied(
            result,
            vec3(0.0),
            0.10 * coverage(edgeDistance, 7.0 * scaleEstimate)
          );
          result = overPremultiplied(
            result,
            vec3(0.0),
            0.20 * coverage(edgeDistance, 5.0 * scaleEstimate)
          );
          result = overPremultiplied(
            result,
            vec3(0.0),
            0.72 * coverage(edgeDistance, 4.0 * scaleEstimate)
          );
          if (selected || valid) {
            float glowHalf = (selected ? 7.0 : 6.5) * scaleEstimate;
            float glowAlpha = invalid ? 0.06 : 0.22;
            result = overPremultiplied(
              result,
              vColor.rgb,
              glowAlpha * coverage(edgeDistance, glowHalf)
            );
          }
          float dashMask =
            vDash > 0.5 && mod(vDistance, 17.0) > 10.0
              ? 0.0
              : 1.0;
          float coreHalf = (selected || valid ? 3.0 : 2.0) * scaleEstimate;
          result = overPremultiplied(
            result,
            vColor.rgb,
            vColor.a * coverage(edgeDistance, coreHalf) * dashMask
          );
          if (result.a <= 0.001) {
            discard;
          }
          outputColor = vec4(
            result.rgb / result.a,
            result.a
          );
        }`
      );

      this.nodeProgram = program(
        gl,
        `#version 300 es
        precision highp float;
        layout(location = 0) in vec4 aBounds;
        layout(location = 1) in float aConfiguration;
        layout(location = 2) in float aSelected;
        uniform vec2 uResolution;
        uniform vec2 uPan;
        uniform float uScale;
        out vec2 vLocal;
        flat out vec2 vSize;
        flat out float vConfiguration;
        flat out float vSelected;
        void main() {
          vec2 corner = vec2(
            float(gl_VertexID & 1),
            float(gl_VertexID >> 1)
          );
          vec2 local = corner * aBounds.zw;
          vec2 position = aBounds.xy + local;
          vec2 screenPosition = position * uScale + uPan;
          vec2 clipPosition = vec2(
            screenPosition.x / uResolution.x * 2.0 - 1.0,
            1.0 - screenPosition.y / uResolution.y * 2.0
          );
          gl_Position = vec4(clipPosition, 0.0, 1.0);
          vLocal = local;
          vSize = aBounds.zw;
          vConfiguration = aConfiguration;
          vSelected = aSelected;
        }`,
        `#version 300 es
        precision highp float;
        uniform float uScale;
        in vec2 vLocal;
        flat in vec2 vSize;
        flat in float vConfiguration;
        flat in float vSelected;
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
          scale: gl.getUniformLocation(this.wireProgram, "uScale"),
          curveSteps: gl.getUniformLocation(
            this.wireProgram,
            "uCurveSteps"
          )
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
      this.wireBufferBytes = 0;
      this.nodeBufferBytes = 0;
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
      this.nodeInstanceBuffer = gl.createBuffer();
      gl.bindVertexArray(this.nodeVertexArray);
      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        this.nodeInstanceBuffer
      );
      const nodeStride =
        FLOATS_PER_NODE_INSTANCE * 4;
      const nodeAttributes = [
        [0, 4, 0],
        [1, 1, 4],
        [2, 1, 5]
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
        gl.vertexAttribDivisor(
          location,
          1
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
        this.canvas.dataset.rmlCssWidth =
          String(width);
        this.canvas.dataset.rmlCssHeight =
          String(height);
        this.visibleWireSelectionDirty = true;
        this.visibleNodeSelectionDirty = true;
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
      this.visibleWireSelectionDirty = true;
      this.visibleNodeSelectionDirty = true;
      this.scheduleDraw();
    }

    setScene(scene = {}, force = false) {
      const segments = Array.isArray(scene.segments)
        ? scene.segments
        : [];
      const nodes = Array.isArray(scene.nodes)
        ? scene.nodes
        : [];
      const segmentsChanged =
        force || this.scene.segments !== segments;
      const nodesChanged =
        force || this.scene.nodes !== nodes;
      this.scene = { segments, nodes };
      if (segmentsChanged) {
        this.prepareWireRecords();
      }
      if (nodesChanged) {
        this.prepareNodeRecords();
      }
      if (this.available && segmentsChanged) {
        this.rebuildWireBuffers();
      }
      if (this.available && nodesChanged) {
        this.rebuildNodeBuffers();
      }
      this.scheduleDraw();
      return segmentsChanged || nodesChanged;
    }

    setNodes(nodes = []) {
      const next = Array.isArray(nodes) ? nodes : [];
      if (
        this.scene.nodes === next &&
        this.nodeRecords.length === next.length
      ) {
        return false;
      }
      this.scene.nodes = next;
      this.prepareNodeRecords();
      if (this.available) {
        this.rebuildNodeBuffers();
      }
      this.scheduleDraw();
      return true;
    }

    setNodeExclusions(nodeIds = []) {
      const next = new Set(
        Array.isArray(nodeIds) ||
        nodeIds instanceof Set
          ? nodeIds
          : [nodeIds]
      );
      next.delete("");
      next.delete(null);
      next.delete(undefined);
      if (
        next.size === this.nodeExcludedIds.size &&
        [...next].every(nodeId =>
          this.nodeExcludedIds.has(nodeId)
        )
      ) {
        return false;
      }
      this.nodeExcludedIds = next;
      this.visibleNodeSelectionDirty = true;
      this.scheduleDraw();
      return true;
    }

    updateNodes(nodes = []) {
      if (
        !Array.isArray(nodes) ||
        nodes.length === 0
      ) {
        return false;
      }
      const updates = [];
      for (const node of nodes) {
        const index =
          this.nodeRecordIndexById.get(
            node?.nodeId
          );
        if (!Number.isInteger(index)) {
          return false;
        }
        updates.push({
          index,
          node,
          record:
            this.prepareNodeRecord(
              node,
              index
            )
        });
      }
      for (const update of updates) {
        const previous =
          this.nodeRecords[update.index];
        if (!this.nodeSpatialIndexDirty) {
          removeFromSpatialIndex(
            this.nodeSpatialIndex,
            previous.spatialKeys,
            previous
          );
        }
        this.scene.nodes[update.index] =
          update.node;
        this.nodeRecords[update.index] =
          update.record;
        if (!this.nodeSpatialIndexDirty) {
          update.record.spatialKeys =
            addToSpatialIndex(
              this.nodeSpatialIndex,
              update.record,
              NODE_CELL_SIZE,
              update.record
            );
        }
        const offset =
          update.index *
          FLOATS_PER_NODE_INSTANCE;
        const record = update.record;
        this.nodeInstanceData[offset] =
          record.left;
        this.nodeInstanceData[offset + 1] =
          record.top;
        this.nodeInstanceData[offset + 2] =
          Math.max(
            1,
            record.right - record.left
          );
        this.nodeInstanceData[offset + 3] =
          Math.max(
            1,
            record.bottom - record.top
          );
        this.nodeInstanceData[offset + 4] =
          record.configuration === true
            ? 1
            : 0;
        this.nodeInstanceData[offset + 5] =
          record.selected === true ? 1 : 0;
      }
      this.nodeDataRevision += 1;
      this.visibleNodeSelectionDirty = true;
      this.scheduleDraw();
      return true;
    }

    setPreview(segment = null) {
      this.previewSegment =
        segment && typeof segment === "object"
          ? segment
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

      const record = this.prepareWireRecord(
        this.previewSegment
      );
      record.connectionId =
        this.previewSegment.connectionId ||
        "__rml-wire-preview__";
      record.segmentIndex = 0;
      record.selected = true;
      this.writeWireLayerData(
        record,
        this.previewInstanceData,
        0
      );

      this.gl.bindBuffer(
        this.gl.ARRAY_BUFFER,
        this.previewVertexBuffer
      );
      this.gl.bufferSubData(
        this.gl.ARRAY_BUFFER,
        0,
        this.previewInstanceData
      );
      this.previewInstanceCount = 1;
      this.stats.previewInstances = 1;
      this.scheduleDraw();
      return true;
    }

    prepareWireRecords() {
      const previousRecords = new Map();
      for (const record of this.wireRecords) {
        previousRecords.set(
          this.wireRecordKey(record),
          record
        );
      }
      this.wireRecords = [];
      this.wireRecordIndexByKey.clear();
      let reusedWireGeometries = 0;
      let maximumCurveLength = 0;
      const hiddenConnectionIds = new Set();
      for (
        let index = 0;
        index < this.scene.segments.length;
        index += 1
      ) {
        const segment =
          this.scene.segments[index];
        const key = this.wireRecordKey(
          segment
        );
        const record =
          this.prepareWireRecord(
            segment,
            previousRecords.get(key)
          );
        record.order = index;
        if (record.geometryReused) {
          reusedWireGeometries += 1;
        }
        if (record.hidden === true) {
          hiddenConnectionIds.add(
            record.connectionId
          );
        }
        this.wireRecords.push(record);
        maximumCurveLength = Math.max(
          maximumCurveLength,
          curveControlPolygonLength(
            record.curve
          )
        );
        this.wireRecordIndexByKey.set(
          this.wireRecordKey(record),
          index
        );
      }

      this.wireCullSpatialIndexDirty = true;
      this.maximumWireCurveLength =
        maximumCurveLength;
      this.visibleWireSelectionDirty = true;
      this.stats.segments = this.wireRecords.length;
      this.stats.hiddenConnections =
        hiddenConnectionIds.size;
      this.stats.reusedWireGeometries =
        reusedWireGeometries;
    }

    prepareNodeRecord(node, index) {
      const left = finite(node.x, 0);
      const top = finite(node.y, 0);
      return {
        nodeId: node.nodeId,
        order: index,
        left,
        top,
        right:
          left + Math.max(
            1,
            finite(node.width, 280)
          ),
        bottom:
          top + Math.max(
            1,
            finite(node.height, 180)
          ),
        configuration:
          node.configuration === true,
        selected:
          node.selected === true,
        spatialKeys: null
      };
    }

    prepareNodeRecords() {
      this.nodeRecords = [];
      this.nodeRecordIndexById.clear();
      for (
        let index = 0;
        index < this.scene.nodes.length;
        index += 1
      ) {
        const node = this.scene.nodes[index];
        const record =
          this.prepareNodeRecord(
            node,
            index
          );
        this.nodeRecords.push(record);
        this.nodeRecordIndexById.set(
          record.nodeId,
          index
        );
      }
      this.nodeSpatialIndexDirty = true;
      this.visibleNodeSelectionDirty = true;
      this.stats.nodes = this.nodeRecords.length;
    }

    wireRecordKey(record) {
      return `${record.connectionId}\u0000${record.segmentIndex}`;
    }

    countHiddenConnections() {
      const connectionIds = new Set();
      for (const record of this.wireRecords) {
        if (record.hidden === true) {
          connectionIds.add(
            record.connectionId
          );
        }
      }
      return connectionIds.size;
    }

    prepareWireRecord(segment, previous = null) {
      const candidateCurve =
        curveFromSegment(segment);
      const geometryReused =
        sameCurve(
          candidateCurve,
          previous?.curve
        );
      const curve = geometryReused
        ? previous.curve
        : candidateCurve;
      const length =
        this.computeWireLength(
          curve,
          previous,
          geometryReused
        );
      return {
        connectionId:
          segment.connectionId,
        segmentIndex:
          segment.segmentIndex,
        color: segment.color,
        impulse:
          segment.impulse === true,
        selected:
          segment.selected === true,
        targetState:
          segment.targetState || null,
        hidden:
          segment.hidden === true,
        curve,
        length,
        bounds: geometryReused
          ? previous.bounds
          : curveBounds(curve),
        geometryReused,
        spatialKeys: null,
        spatialOverflow: false
      };
    }

    computeWireLength(
      curve,
      previous,
      geometryReused
    ) {
      return geometryReused
        ? previous.length
        : approximateCubicLength(
            curve,
            12
          );
    }

    writeWireLayerData(
      record,
      target,
      offset = 0
    ) {
      if (record.hidden === true) {
        target.fill(
          0,
          offset,
          offset + FLOATS_PER_WIRE_INSTANCE
        );
        for (let index = 0; index < 8; index += 1) {
          target[offset + index] = -1000000;
        }
        return target;
      }
      const invalid =
        record.targetState === "invalid";
      const selected =
        record.selected === true;
      const valid =
        record.targetState === "valid";
      const curve = record.curve;
      target[offset] = curve.p0.x;
      target[offset + 1] = curve.p0.y;
      target[offset + 2] = curve.p1.x;
      target[offset + 3] = curve.p1.y;
      target[offset + 4] = curve.p2.x;
      target[offset + 5] = curve.p2.y;
      target[offset + 6] = curve.p3.x;
      target[offset + 7] = curve.p3.y;
      writeColorComponents(
        record.color,
        invalid ? 0.28 : 1,
        target,
        offset + 8
      );
      target[offset + 12] =
        (selected ? 1 : 0) +
        (valid ? 2 : 0) +
        (invalid ? 4 : 0);
      target[offset + 13] =
        record.impulse === true ? 1 : 0;
      target[offset + 14] = record.length;
      return target;
    }

    buildWireCullSpatialIndex() {
      if (!this.wireCullSpatialIndexDirty) {
        return;
      }
      const started = performance.now();
      this.wireCullSpatialIndex.clear();
      this.wireCullOverflowRecords = [];
      for (const record of this.wireRecords) {
        this.addWireCullRecord(record);
      }
      this.wireCullSpatialIndexDirty = false;
      this.stats.wireCullIndexMilliseconds =
        performance.now() - started;
    }

    addWireCullRecord(record) {
      const range = cellRange(
        record.bounds,
        WIRE_CULL_CELL_SIZE
      );
      const columns =
        range.maximumX - range.minimumX + 1;
      const rows =
        range.maximumY - range.minimumY + 1;
      if (
        columns * rows >
          MAX_WIRE_CULL_RECORD_CELLS
      ) {
        record.spatialKeys = null;
        record.spatialOverflow = true;
        this.wireCullOverflowRecords.push(record);
        return;
      }
      record.spatialOverflow = false;
      record.spatialKeys = addToSpatialIndex(
        this.wireCullSpatialIndex,
        record.bounds,
        WIRE_CULL_CELL_SIZE,
        record
      );
    }

    removeWireCullRecord(record) {
      if (record.spatialOverflow) {
        const position =
          this.wireCullOverflowRecords.indexOf(
            record
          );
        if (position >= 0) {
          this.wireCullOverflowRecords.splice(
            position,
            1
          );
        }
      } else {
        removeFromSpatialIndex(
          this.wireCullSpatialIndex,
          record.spatialKeys,
          record
        );
      }
      record.spatialKeys = null;
      record.spatialOverflow = false;
    }

    buildNodeSpatialIndex() {
      if (!this.nodeSpatialIndexDirty) {
        return;
      }
      const started = performance.now();
      this.nodeSpatialIndex.clear();
      for (const record of this.nodeRecords) {
        record.spatialKeys = addToSpatialIndex(
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

    viewportGraphBounds(marginPixels = 0) {
      const scale = Math.max(
        0.0001,
        this.camera.scale
      );
      const margin = Math.max(
        0,
        marginPixels
      ) / scale;
      return {
        left: -this.camera.x / scale - margin,
        top: -this.camera.y / scale - margin,
        right:
          (this.cssWidth - this.camera.x) / scale +
          margin,
        bottom:
          (this.cssHeight - this.camera.y) / scale +
          margin
      };
    }

    visibleWireRecordsForCamera() {
      if (this.wireRecords.length === 0) {
        return [];
      }
      this.buildWireCullSpatialIndex();
      return spatialRecordsInBounds(
        this.wireCullSpatialIndex,
        this.wireRecords,
        this.viewportGraphBounds(
          WIRE_CULL_MARGIN_PIXELS
        ),
        WIRE_CULL_CELL_SIZE,
        record => record.hidden !== true,
        this.wireCullOverflowRecords
      );
    }

    visibleNodeRecordsForCamera() {
      if (this.nodeRecords.length === 0) {
        return [];
      }
      this.buildNodeSpatialIndex();
      return spatialRecordsInBounds(
        this.nodeSpatialIndex,
        this.nodeRecords,
        this.viewportGraphBounds(
          NODE_CULL_MARGIN_PIXELS
        ),
        NODE_CELL_SIZE,
        record =>
          !this.nodeExcludedIds.has(
            record.nodeId
          )
      );
    }

    uploadVisibleWireInstances() {
      if (
        !this.visibleWireSelectionDirty &&
        this.visibleWireDataRevision ===
          this.wireDataRevision
      ) {
        return;
      }
      const records =
        this.visibleWireRecordsForCamera();
      const selectionChanged =
        !sameRecordOrder(
          this.visibleWireRecords,
          records
        );
      const dataChanged =
        this.visibleWireDataRevision !==
        this.wireDataRevision;
      this.visibleWireSelectionDirty = false;
      if (!selectionChanged && !dataChanged) {
        return;
      }

      this.visibleWireRecords = records;
      const requiredInstances =
        records.length *
        WIRE_LAYERS_PER_SEGMENT;
      if (
        requiredInstances >
          this.visibleWireInstanceCapacity
      ) {
        this.visibleWireInstanceCapacity =
          grownCapacity(
            this.visibleWireInstanceCapacity,
            requiredInstances
          );
        this.visibleWireInstanceData =
          new Float32Array(
            this.visibleWireInstanceCapacity *
              FLOATS_PER_WIRE_INSTANCE
          );
      }

      for (
        let index = 0;
        index < records.length;
        index += 1
      ) {
        const sourceOffset =
          records[index].order *
          FLOATS_PER_WIRE_INSTANCE;
        this.visibleWireInstanceData.set(
          this.wireInstanceData.subarray(
            sourceOffset,
            sourceOffset +
              FLOATS_PER_WIRE_INSTANCE
          ),
          index * FLOATS_PER_WIRE_INSTANCE
        );
      }

      const gl = this.gl;
      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        this.wireVertexBuffer
      );
      if (
        this.wireBufferBytes !==
          this.visibleWireInstanceData.byteLength
      ) {
        gl.bufferData(
          gl.ARRAY_BUFFER,
          this.visibleWireInstanceData.byteLength,
          gl.DYNAMIC_DRAW
        );
        this.wireBufferBytes =
          this.visibleWireInstanceData.byteLength;
      }
      const requiredFloats =
        requiredInstances *
        FLOATS_PER_WIRE_INSTANCE;
      if (requiredFloats > 0) {
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          0,
          this.visibleWireInstanceData,
          0,
          requiredFloats
        );
      }
      this.wireInstanceCount = requiredInstances;
      this.wireVertexCount =
        requiredInstances *
        (GPU_CURVE_STEPS + 1) * 2;
      this.stats.wireVertices =
        this.wireVertexCount;
      this.stats.wireInstances =
        requiredInstances;
      this.stats.visibleSegments = records.length;
      this.stats.culledSegments = Math.max(
        0,
        this.wireRecords.length - records.length
      );
      this.visibleWireDataRevision =
        this.wireDataRevision;
    }

    uploadVisibleNodeInstances() {
      if (
        !this.visibleNodeSelectionDirty &&
        this.visibleNodeDataRevision ===
          this.nodeDataRevision
      ) {
        return;
      }
      const records =
        this.visibleNodeRecordsForCamera();
      const selectionChanged =
        !sameRecordOrder(
          this.visibleNodeRecords,
          records
        );
      const dataChanged =
        this.visibleNodeDataRevision !==
        this.nodeDataRevision;
      this.visibleNodeSelectionDirty = false;
      if (!selectionChanged && !dataChanged) {
        return;
      }

      this.visibleNodeRecords = records;
      const requiredInstances = records.length;
      if (
        requiredInstances >
          this.visibleNodeInstanceCapacity
      ) {
        this.visibleNodeInstanceCapacity =
          grownCapacity(
            this.visibleNodeInstanceCapacity,
            requiredInstances
          );
        this.visibleNodeInstanceData =
          new Float32Array(
            this.visibleNodeInstanceCapacity *
              FLOATS_PER_NODE_INSTANCE
          );
      }

      for (
        let index = 0;
        index < records.length;
        index += 1
      ) {
        const sourceOffset =
          records[index].order *
          FLOATS_PER_NODE_INSTANCE;
        this.visibleNodeInstanceData.set(
          this.nodeInstanceData.subarray(
            sourceOffset,
            sourceOffset +
              FLOATS_PER_NODE_INSTANCE
          ),
          index * FLOATS_PER_NODE_INSTANCE
        );
      }

      const gl = this.gl;
      gl.bindBuffer(
        gl.ARRAY_BUFFER,
        this.nodeInstanceBuffer
      );
      if (
        this.nodeBufferBytes !==
          this.visibleNodeInstanceData.byteLength
      ) {
        gl.bufferData(
          gl.ARRAY_BUFFER,
          this.visibleNodeInstanceData.byteLength,
          gl.DYNAMIC_DRAW
        );
        this.nodeBufferBytes =
          this.visibleNodeInstanceData.byteLength;
      }
      const requiredFloats =
        requiredInstances *
        FLOATS_PER_NODE_INSTANCE;
      if (requiredFloats > 0) {
        gl.bufferSubData(
          gl.ARRAY_BUFFER,
          0,
          this.visibleNodeInstanceData,
          0,
          requiredFloats
        );
      }
      this.nodeInstanceCount = requiredInstances;
      this.nodeVertexCount = requiredInstances * 4;
      this.stats.nodeVertices =
        this.nodeVertexCount;
      this.stats.nodeInstances = requiredInstances;
      this.stats.visibleNodes = records.length;
      this.stats.culledNodes = Math.max(
        0,
        this.nodeRecords.length - records.length
      );
      this.visibleNodeDataRevision =
        this.nodeDataRevision;
    }

    prepareVisibleInstances() {
      this.uploadVisibleWireInstances();
      this.uploadVisibleNodeInstances();
    }

    rebuildWireBuffers() {
      const requiredInstances =
        this.wireRecords.length *
          WIRE_LAYERS_PER_SEGMENT;
      if (
        requiredInstances >
          this.wireInstanceCapacity
      ) {
        this.wireInstanceCapacity =
          grownCapacity(
            this.wireInstanceCapacity,
            requiredInstances
          );
        this.wireInstanceData =
          new Float32Array(
            this.wireInstanceCapacity *
              FLOATS_PER_WIRE_INSTANCE
          );
      }

      for (
        let index = 0;
        index < this.wireRecords.length;
        index += 1
      ) {
        this.writeWireLayerData(
          this.wireRecords[index],
          this.wireInstanceData,
          index * FLOATS_PER_WIRE_INSTANCE
        );
      }

      this.wireDataRevision += 1;
      this.visibleWireSelectionDirty = true;
    }

    updateSegments(segments = []) {
      if (
        !this.available ||
        !Array.isArray(segments) ||
        segments.length === 0
      ) {
        return false;
      }

      const prepared = [];
      for (const segment of segments) {
        const key =
          this.wireRecordKey(segment);
        const index =
          this.wireRecordIndexByKey.get(
            key
          );
        if (!Number.isInteger(index)) {
          return false;
        }
        const record =
          this.prepareWireRecord(
            segment,
            this.wireRecords[index]
          );
        prepared.push({
          index,
          record,
          segment
        });
      }

      for (const update of prepared) {
        const previous =
          this.wireRecords[update.index];
        if (!this.wireCullSpatialIndexDirty) {
          this.removeWireCullRecord(previous);
        }
        update.record.order = update.index;
        const floatOffset =
          update.index *
          WIRE_LAYERS_PER_SEGMENT *
          FLOATS_PER_WIRE_INSTANCE;
        this.wireRecords[
          update.index
        ] = update.record;
        if (!this.wireCullSpatialIndexDirty) {
          this.addWireCullRecord(
            update.record
          );
        }
        this.scene.segments[
          update.index
        ] = update.segment;
        this.writeWireLayerData(
          update.record,
          this.wireScratchData,
          0
        );
        this.wireInstanceData.set(
          this.wireScratchData,
          floatOffset
        );
      }
      for (const update of prepared) {
        this.maximumWireCurveLength = Math.max(
          this.maximumWireCurveLength,
          curveControlPolygonLength(
            update.record.curve
          )
        );
      }
      this.wireDataRevision += 1;
      this.visibleWireSelectionDirty = true;
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
        updates.push({
          index,
          previous,
          record,
          segment
        });
      }

      if (updates.length === 0) {
        return 0;
      }

      for (const update of updates) {
        if (!this.wireCullSpatialIndexDirty) {
          this.removeWireCullRecord(
            update.previous
          );
        }
        this.wireRecords[update.index] =
          update.record;
        this.scene.segments[update.index] =
          update.segment;
        if (!this.wireCullSpatialIndexDirty) {
          this.addWireCullRecord(
            update.record
          );
        }
        const floatOffset =
          update.index *
          WIRE_LAYERS_PER_SEGMENT *
          FLOATS_PER_WIRE_INSTANCE;
        this.writeWireLayerData(
          update.record,
          this.wireScratchData,
          0
        );
        this.wireInstanceData.set(
          this.wireScratchData,
          floatOffset
        );
      }

      this.wireDataRevision += 1;
      this.visibleWireSelectionDirty = true;
      this.stats.hiddenConnections =
        this.countHiddenConnections();
      this.scheduleDraw();
      return new Set(
        updates.map(
          update => update.record.connectionId
        )
      ).size;
    }

    rebuildNodeBuffers() {
      const requiredInstances =
        this.nodeRecords.length;
      if (
        requiredInstances >
          this.nodeInstanceCapacity
      ) {
        this.nodeInstanceCapacity =
          grownCapacity(
            this.nodeInstanceCapacity,
            requiredInstances
          );
        this.nodeInstanceData =
          new Float32Array(
            this.nodeInstanceCapacity *
              FLOATS_PER_NODE_INSTANCE
          );
      }

      for (
        let index = 0;
        index < requiredInstances;
        index += 1
      ) {
        const node = this.nodeRecords[index];
        const offset =
          index * FLOATS_PER_NODE_INSTANCE;
        this.nodeInstanceData[offset] =
          node.left;
        this.nodeInstanceData[offset + 1] =
          node.top;
        this.nodeInstanceData[offset + 2] =
          Math.max(1, node.right - node.left);
        this.nodeInstanceData[offset + 3] =
          Math.max(1, node.bottom - node.top);
        this.nodeInstanceData[offset + 4] =
          node.configuration === true ? 1 : 0;
        this.nodeInstanceData[offset + 5] =
          node.selected === true ? 1 : 0;
      }

      this.nodeDataRevision += 1;
      this.visibleNodeSelectionDirty = true;
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

    whenSubmittedWorkDone() {
      return Promise.resolve(true);
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
      this.prepareVisibleInstances();
      const curveSteps = curveStepsForScale(
        this.camera.scale,
        maximumCurveControlPolygonLength(
          this.visibleWireRecords
        )
      );
      const wireVertexCount =
        (curveSteps + 1) * 2;
      this.stats.curveSteps = curveSteps;
      this.wireVertexCount =
        this.wireInstanceCount * wireVertexCount;
      this.stats.wireVertices =
        this.wireVertexCount;
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
        gl.uniform1f(
          this.uniforms.wire.curveSteps,
          curveSteps
        );
        gl.bindVertexArray(this.wireVertexArray);
        gl.drawArraysInstanced(
          gl.TRIANGLE_STRIP,
          0,
          wireVertexCount,
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
        gl.uniform1f(
          this.uniforms.wire.curveSteps,
          curveSteps
        );
        gl.bindVertexArray(
          this.previewVertexArray
        );
        gl.drawArraysInstanced(
          gl.TRIANGLE_STRIP,
          0,
          wireVertexCount,
          this.previewInstanceCount
        );
        drawCalls += 1;
      }

      if (this.nodeInstanceCount > 0) {
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
        gl.drawArraysInstanced(
          gl.TRIANGLE_STRIP,
          0,
          4,
          this.nodeInstanceCount
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
        this.buildWireCullSpatialIndex();
        const range = cellRange(
          bounds,
          WIRE_CULL_CELL_SIZE
        );
        for (let y = range.minimumY; y <= range.maximumY; y += 1) {
          for (let x = range.minimumX; x <= range.maximumX; x += 1) {
            for (const record of this.wireCullSpatialIndex.get(spatialKey(x, y)) || []) {
              candidates.add(record);
            }
          }
        }
        for (const record of
          this.wireCullOverflowRecords) {
          if (
            intersectsBounds(
              record.bounds,
              bounds
            )
          ) {
            candidates.add(record);
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
      const candidates = this.nodeSpatialIndex.get(spatialKey(cellX, cellY)) || [];
      for (let index = candidates.length - 1; index >= 0; index -= 1) {
        const record = candidates[index];
        if (
          this.nodeExcludedIds.has(
            record.nodeId
          )
        ) {
          continue;
        }
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

  class GraphWebGpuRenderer extends GraphHybridRenderer {
    constructor(options = {}, runtime) {
      super({
        ...options,
        deferGraphics: true
      });
      this.gpuAdapter = runtime.adapter;
      this.gpuDevice = runtime.device;
      this.gpuContext = null;
      this.gpuFormat = runtime.format;
      this.gpuBuffers = Object.create(null);
      this.gpuBufferSizes = Object.create(null);
      this.gpuPipelines = {
        ...runtime.pipelines
      };
      this.gpuBindGroups = Object.create(null);
      this.wireCandidateData = new Uint32Array(0);
      this.nodeCandidateData = new Uint32Array(0);
      this.renderUniformData = new Float32Array(8);
      this.cullUniformData = new ArrayBuffer(32);
      this.cullUniformFloats =
        new Float32Array(
          this.cullUniformData,
          0,
          4
        );
      this.cullUniformIntegers =
        new Uint32Array(
          this.cullUniformData,
          16,
          4
        );
      this.wireIndirectData =
        new Uint32Array([
          (GPU_CURVE_STEPS + 1) * 2,
          0,
          0,
          0
        ]);
      this.nodeIndirectData =
        new Uint32Array([4, 0, 0, 0]);
      this.activeCurveSteps = GPU_CURVE_STEPS;
      this.gpuCullBounds = null;
      this.gpuCullScale = 0;
      this.gpuCullDirty = true;
      this.gpuCullReady = false;
      this.gpuWireCandidateCount = 0;
      this.gpuNodeCandidateCount = 0;
      this.gpuWireCandidateMode = "empty";
      this.gpuNodeCandidateMode = "empty";
      this.gpuCandidateMaximumCurveLength = 0;
      this.gpuSpatialBuildTasks = {
        wire: null,
        node: null
      };
      this.stats.gpuCullPasses = 0;
      this.stats.gpuCullReusedFrames = 0;
      this.stats.gpuWireCandidates = 0;
      this.stats.gpuNodeCandidates = 0;
      this.stats.gpuWireCandidateMode = "empty";
      this.stats.gpuNodeCandidateMode = "empty";
      this.stats.gpuCullOverscanPixels =
        WEBGPU_CULL_OVERSCAN_PIXELS;
      this.stats.gpuLastCullMilliseconds = 0;
      this.stats.gpuSpatialIndexBuilding = false;
      this.gpuResourcesReady = false;
      this.initializeWebGpu();
    }

    setAvailability(value) {
      const next = value === true;
      if (this.available === next) {
        return;
      }
      this.available = next;
      this.canvas.classList.toggle(
        "available",
        next
      );
      this.stats.renderer = next
        ? "webgpu-wgsl"
        : "svg-fallback";
      activeRendererBackend = next
        ? "webgpu-wgsl"
        : "svg-fallback";
      this.stats.gpuComputeCulling = next;
      this.onAvailabilityChange?.(next);
    }

    initializeWebGpu() {
      if (
        !this.gpuDevice ||
        !navigator.gpu ||
        this.disposed
      ) {
        this.setAvailability(false);
        return false;
      }
      try {
        this.gpuContext =
          this.canvas.getContext("webgpu");
        if (!this.gpuContext) {
          this.setAvailability(false);
          return false;
        }
        this.gpuContext.configure({
          device: this.gpuDevice,
          format: this.gpuFormat,
          alphaMode: "premultiplied"
        });
        if (!this.gpuPipelines.compute) {
          throw new Error(
            "Validated WebGPU graph pipelines are unavailable."
          );
        }
        this.ensureWebGpuBuffers();
        this.gpuResourcesReady = true;
        this.gpuDevice.lost.then(info => {
          if (this.disposed) {
            return;
          }
          console.warn(
            "RML graph WebGPU device was lost; switching to the SVG fallback.",
            info
          );
          this.contextLost = true;
          this.setAvailability(false);
        });
        this.setAvailability(true);
        this.resize();
        this.scheduleDraw();
        return true;
      } catch (error) {
        console.warn(
          "RML graph WebGPU renderer failed; switching to the SVG fallback.",
          error
        );
        this.deleteGpuResources();
        this.setAvailability(false);
        return false;
      }
    }

    async createWebGpuPipelines() {
      const device = this.gpuDevice;
      const format = this.gpuFormat;
      const computeModule =
        device.createShaderModule({
          label: "RML graph WGSL culling",
          code: `
            struct CullUniforms {
              bounds: vec4<f32>,
              wireCount: u32,
              nodeCount: u32,
              wireCandidateMode: u32,
              nodeCandidateMode: u32,
            };
            struct FloatData {
              values: array<f32>,
            };
            struct UintData {
              values: array<u32>,
            };
            struct DrawIndirect {
              vertexCount: u32,
              instanceCount: atomic<u32>,
              firstVertex: u32,
              firstInstance: u32,
            };
            @group(0) @binding(0)
            var<uniform> cull: CullUniforms;
            @group(0) @binding(1)
            var<storage, read> masterWires: FloatData;
            @group(0) @binding(2)
            var<storage, read_write> visibleWires: FloatData;
            @group(0) @binding(3)
            var<storage, read_write> wireDraw: DrawIndirect;
            @group(0) @binding(4)
            var<storage, read> masterNodes: FloatData;
            @group(0) @binding(5)
            var<storage, read_write> visibleNodes: FloatData;
            @group(0) @binding(6)
            var<storage, read_write> nodeDraw: DrawIndirect;
            @group(0) @binding(7)
            var<storage, read> wireCandidates: UintData;
            @group(0) @binding(8)
            var<storage, read> nodeCandidates: UintData;

            fn intersects(
              left: f32,
              top: f32,
              right: f32,
              bottom: f32
            ) -> bool {
              return !(
                right < cull.bounds.x ||
                left > cull.bounds.z ||
                bottom < cull.bounds.y ||
                top > cull.bounds.w
              );
            }

            @compute @workgroup_size(${WEBGPU_WORKGROUP_SIZE})
            fn main(
              @builtin(global_invocation_id) invocation: vec3<u32>
            ) {
              let index = invocation.x;
              if (index < cull.wireCount) {
                var sourceIndex = index;
                if (cull.wireCandidateMode != 0u) {
                  sourceIndex = wireCandidates.values[index];
                }
                let sourceOffset =
                  sourceIndex * ${FLOATS_PER_WIRE_INSTANCE}u;
                let minimumX = min(
                  min(
                    masterWires.values[sourceOffset],
                    masterWires.values[sourceOffset + 2u]
                  ),
                  min(
                    masterWires.values[sourceOffset + 4u],
                    masterWires.values[sourceOffset + 6u]
                  )
                );
                let minimumY = min(
                  min(
                    masterWires.values[sourceOffset + 1u],
                    masterWires.values[sourceOffset + 3u]
                  ),
                  min(
                    masterWires.values[sourceOffset + 5u],
                    masterWires.values[sourceOffset + 7u]
                  )
                );
                let maximumX = max(
                  max(
                    masterWires.values[sourceOffset],
                    masterWires.values[sourceOffset + 2u]
                  ),
                  max(
                    masterWires.values[sourceOffset + 4u],
                    masterWires.values[sourceOffset + 6u]
                  )
                );
                let maximumY = max(
                  max(
                    masterWires.values[sourceOffset + 1u],
                    masterWires.values[sourceOffset + 3u]
                  ),
                  max(
                    masterWires.values[sourceOffset + 5u],
                    masterWires.values[sourceOffset + 7u]
                  )
                );
                if (
                  masterWires.values[sourceOffset + 11u] > 0.0001 &&
                  intersects(
                    minimumX,
                    minimumY,
                    maximumX,
                    maximumY
                  )
                ) {
                  let destination =
                    atomicAdd(&wireDraw.instanceCount, 1u);
                  let destinationOffset =
                    destination * ${FLOATS_PER_WIRE_INSTANCE}u;
                  for (
                    var component = 0u;
                    component < ${FLOATS_PER_WIRE_INSTANCE}u;
                    component += 1u
                  ) {
                    visibleWires.values[
                      destinationOffset + component
                    ] = masterWires.values[
                      sourceOffset + component
                    ];
                  }
                  let p0 = vec2<f32>(
                    masterWires.values[sourceOffset],
                    masterWires.values[sourceOffset + 1u]
                  );
                  let p1 = vec2<f32>(
                    masterWires.values[sourceOffset + 2u],
                    masterWires.values[sourceOffset + 3u]
                  );
                  let p2 = vec2<f32>(
                    masterWires.values[sourceOffset + 4u],
                    masterWires.values[sourceOffset + 5u]
                  );
                  let p3 = vec2<f32>(
                    masterWires.values[sourceOffset + 6u],
                    masterWires.values[sourceOffset + 7u]
                  );
                  visibleWires.values[
                    destinationOffset + 14u
                  ] = distance(p0, p1) +
                    distance(p1, p2) +
                    distance(p2, p3);
                }
              }

              if (index < cull.nodeCount) {
                var sourceIndex = index;
                if (cull.nodeCandidateMode != 0u) {
                  sourceIndex = nodeCandidates.values[index];
                }
                let sourceOffset =
                  sourceIndex * ${FLOATS_PER_NODE_INSTANCE}u;
                let left = masterNodes.values[sourceOffset];
                let top = masterNodes.values[sourceOffset + 1u];
                let right =
                  left + masterNodes.values[sourceOffset + 2u];
                let bottom =
                  top + masterNodes.values[sourceOffset + 3u];
                if (
                  intersects(left, top, right, bottom)
                ) {
                  let destination =
                    atomicAdd(&nodeDraw.instanceCount, 1u);
                  let destinationOffset =
                    destination * ${FLOATS_PER_NODE_INSTANCE}u;
                  for (
                    var component = 0u;
                    component < ${FLOATS_PER_NODE_INSTANCE}u;
                    component += 1u
                  ) {
                    visibleNodes.values[
                      destinationOffset + component
                    ] = masterNodes.values[
                      sourceOffset + component
                    ];
                  }
                }
              }
            }
          `
        });

      const gridModule =
        device.createShaderModule({
          label: "RML graph WGSL grid",
          code: `
            struct RenderUniforms {
              resolution: vec2<f32>,
              pan: vec2<f32>,
              scale: f32,
              pixelRatio: f32,
              curveSteps: f32,
              padding: f32,
            };
            @group(0) @binding(0)
            var<uniform> scene: RenderUniforms;
            @vertex
            fn vertexMain(
              @builtin(vertex_index) index: u32
            ) -> @builtin(position) vec4<f32> {
              let x = select(-1.0, 3.0, index == 1u);
              let y = select(-1.0, 3.0, index == 2u);
              return vec4<f32>(x, y, 0.0, 1.0);
            }
            fn lineMask(coordinate: f32, spacing: f32) -> f32 {
              let pixel = coordinate / scene.pixelRatio;
              let phase = pixel % spacing;
              let distanceToLine = min(phase, spacing - phase);
              return 1.0 - smoothstep(0.45, 1.15, distanceToLine);
            }
            @fragment
            fn fragmentMain(
              @builtin(position) position: vec4<f32>
            ) -> @location(0) vec4<f32> {
              let minor = max(
                lineMask(position.x, 18.0),
                lineMask(position.y, 18.0)
              );
              let major = max(
                lineMask(position.x, 90.0),
                lineMask(position.y, 90.0)
              );
              let base = vec3<f32>(0.0314, 0.0392, 0.0627);
              var color = mix(base, vec3<f32>(1.0), minor * 0.025);
              color = mix(
                color,
                vec3<f32>(0.337, 0.651, 0.871),
                major * 0.025
              );
              return vec4<f32>(color, 1.0);
            }
          `
        });

      const wireModule =
        device.createShaderModule({
          label: "RML graph WGSL wires",
          code: `
            struct RenderUniforms {
              resolution: vec2<f32>,
              pan: vec2<f32>,
              scale: f32,
              pixelRatio: f32,
              curveSteps: f32,
              padding: f32,
            };
            struct FloatData {
              values: array<f32>,
            };
            struct WireOutput {
              @builtin(position) position: vec4<f32>,
              @location(0) @interpolate(flat) color: vec4<f32>,
              @location(1) edgePixels: f32,
              @location(2) @interpolate(flat) coreHalfPixels: f32,
              @location(3) distance: f32,
              @location(4) @interpolate(flat) dash: f32,
              @location(5) @interpolate(flat) style: f32,
            };
            @group(0) @binding(0)
            var<uniform> scene: RenderUniforms;
            @group(0) @binding(1)
            var<storage, read> wires: FloatData;

            fn wireValue(instance: u32, component: u32) -> f32 {
              return wires.values[
                instance * ${FLOATS_PER_WIRE_INSTANCE}u + component
              ];
            }
            fn cubic(
              p0: vec2<f32>,
              p1: vec2<f32>,
              p2: vec2<f32>,
              p3: vec2<f32>,
              t: f32
            ) -> vec2<f32> {
              let inverse = 1.0 - t;
              let inverse2 = inverse * inverse;
              let t2 = t * t;
              return inverse2 * inverse * p0 +
                3.0 * inverse2 * t * p1 +
                3.0 * inverse * t2 * p2 +
                t2 * t * p3;
            }
            fn cubicDerivative(
              p0: vec2<f32>,
              p1: vec2<f32>,
              p2: vec2<f32>,
              p3: vec2<f32>,
              t: f32
            ) -> vec2<f32> {
              let inverse = 1.0 - t;
              return 3.0 * inverse * inverse * (p1 - p0) +
                6.0 * inverse * t * (p2 - p1) +
                3.0 * t * t * (p3 - p2);
            }
            @vertex
            fn vertexMain(
              @builtin(vertex_index) vertex: u32,
              @builtin(instance_index) instance: u32
            ) -> WireOutput {
              let p0 = vec2<f32>(
                wireValue(instance, 0u),
                wireValue(instance, 1u)
              );
              let p1 = vec2<f32>(
                wireValue(instance, 2u),
                wireValue(instance, 3u)
              );
              let p2 = vec2<f32>(
                wireValue(instance, 4u),
                wireValue(instance, 5u)
              );
              let p3 = vec2<f32>(
                wireValue(instance, 6u),
                wireValue(instance, 7u)
              );
              let pointIndex = vertex / 2u;
              let side = select(-1.0, 1.0, vertex % 2u == 1u);
              let t = clamp(
                f32(pointIndex) / max(1.0, scene.curveSteps),
                0.0,
                1.0
              );
              let position = cubic(p0, p1, p2, p3, t);
              let derivativeStep =
                0.5 / max(1.0, scene.curveSteps);
              let incomingDerivative = cubicDerivative(
                p0,
                p1,
                p2,
                p3,
                max(0.0, t - derivativeStep)
              );
              let outgoingDerivative = cubicDerivative(
                p0,
                p1,
                p2,
                p3,
                min(1.0, t + derivativeStep)
              );
              let incomingLength =
                length(incomingDerivative);
              let outgoingLength =
                length(outgoingDerivative);
              var incomingDirection = vec2<f32>(0.0);
              var outgoingDirection = vec2<f32>(0.0);
              if (incomingLength > 0.000001) {
                incomingDirection =
                  incomingDerivative / incomingLength;
              }
              if (outgoingLength > 0.000001) {
                outgoingDirection =
                  outgoingDerivative / outgoingLength;
              }
              if (pointIndex == 0u) {
                incomingDirection = outgoingDirection;
              }
              if (
                pointIndex ==
                  u32(max(1.0, scene.curveSteps))
              ) {
                outgoingDirection = incomingDirection;
              }
              let joinedDirection =
                incomingDirection + outgoingDirection;
              let joinedLength =
                length(joinedDirection);
              var tangent = p3 - p0;
              let fallbackLength = length(tangent);
              if (joinedLength > 0.000001) {
                tangent =
                  joinedDirection / joinedLength;
              } else if (fallbackLength < 0.000001) {
                tangent = vec2<f32>(1.0, 0.0);
              } else {
                tangent /= fallbackLength;
              }
              let normal = vec2<f32>(-tangent.y, tangent.x);
              let reversalDot = dot(
                incomingDirection,
                outgoingDirection
              );
              let joinWidthFactor = smoothstep(
                -0.985,
                -0.90,
                reversalDot
              );
              let safeScale = max(scene.scale, 0.0001);
              let extrusion =
                (7.0 + 1.25 / safeScale) *
                joinWidthFactor;
              let graphPosition =
                position + normal * side * extrusion;
              let screenPosition =
                graphPosition * scene.scale + scene.pan;
              let clip = vec2<f32>(
                screenPosition.x / scene.resolution.x * 2.0 - 1.0,
                1.0 - screenPosition.y / scene.resolution.y * 2.0
              );
              var output: WireOutput;
              output.position = vec4<f32>(clip, 0.0, 1.0);
              output.color = vec4<f32>(
                wireValue(instance, 8u),
                wireValue(instance, 9u),
                wireValue(instance, 10u),
                wireValue(instance, 11u)
              );
              output.edgePixels = side * extrusion * scene.scale;
              output.coreHalfPixels = max(0.05, 2.0 * scene.scale);
              output.distance = t * wireValue(instance, 14u);
              output.dash = wireValue(instance, 13u);
              output.style = wireValue(instance, 12u);
              return output;
            }
            fn coverage(edgeDistance: f32, halfWidth: f32) -> f32 {
              return 1.0 - smoothstep(
                halfWidth,
                halfWidth + 1.25,
                edgeDistance
              );
            }
            fn overPremultiplied(
              under: vec4<f32>,
              upperColor: vec3<f32>,
              upperAlpha: f32
            ) -> vec4<f32> {
              let inverse = 1.0 - upperAlpha;
              return vec4<f32>(
                upperColor * upperAlpha + under.rgb * inverse,
                upperAlpha + under.a * inverse
              );
            }
            @fragment
            fn fragmentMain(input: WireOutput) -> @location(0) vec4<f32> {
              let selected = input.style % 2.0 >= 1.0;
              let valid = floor(input.style / 2.0) % 2.0 >= 1.0;
              let invalid = floor(input.style / 4.0) >= 1.0;
              let scaleEstimate = max(
                0.0001,
                input.coreHalfPixels / 2.0
              );
              let edgeDistance = abs(input.edgePixels);
              var result = vec4<f32>(0.0);
              result = overPremultiplied(
                result,
                vec3<f32>(0.0),
                0.72 * coverage(
                  edgeDistance,
                  4.0 * scaleEstimate
                )
              );
              if (selected || valid) {
                let glowHalf = select(6.5, 7.0, selected) * scaleEstimate;
                let glowAlpha = select(0.22, 0.06, invalid);
                result = overPremultiplied(
                  result,
                  input.color.rgb,
                  glowAlpha * coverage(
                    edgeDistance,
                    glowHalf
                  )
                );
              }
              let dashMask = select(
                1.0,
                0.0,
                input.dash > 0.5 && input.distance % 17.0 > 10.0
              );
              let coreHalf = select(2.0, 3.0, selected || valid) * scaleEstimate;
              result = overPremultiplied(
                result,
                input.color.rgb,
                input.color.a *
                  coverage(edgeDistance, coreHalf) *
                  dashMask
              );
              if (result.a <= 0.001) {
                discard;
              }
              return vec4<f32>(
                result.rgb / result.a,
                result.a
              );
            }
          `
        });

      const nodeModule =
        device.createShaderModule({
          label: "RML graph WGSL nodes",
          code: `
            struct RenderUniforms {
              resolution: vec2<f32>,
              pan: vec2<f32>,
              scale: f32,
              pixelRatio: f32,
              curveSteps: f32,
              padding: f32,
            };
            struct FloatData {
              values: array<f32>,
            };
            struct NodeOutput {
              @builtin(position) position: vec4<f32>,
              @location(0) local: vec2<f32>,
              @location(1) @interpolate(flat) size: vec2<f32>,
              @location(2) @interpolate(flat) configuration: f32,
              @location(3) @interpolate(flat) selected: f32,
            };
            @group(0) @binding(0)
            var<uniform> scene: RenderUniforms;
            @group(0) @binding(1)
            var<storage, read> nodes: FloatData;
            fn nodeValue(instance: u32, component: u32) -> f32 {
              return nodes.values[
                instance * ${FLOATS_PER_NODE_INSTANCE}u + component
              ];
            }
            @vertex
            fn vertexMain(
              @builtin(vertex_index) vertex: u32,
              @builtin(instance_index) instance: u32
            ) -> NodeOutput {
              let corner = vec2<f32>(
                f32(vertex % 2u),
                f32(vertex / 2u)
              );
              let origin = vec2<f32>(
                nodeValue(instance, 0u),
                nodeValue(instance, 1u)
              );
              let size = vec2<f32>(
                nodeValue(instance, 2u),
                nodeValue(instance, 3u)
              );
              let local = corner * size;
              let screenPosition =
                (origin + local) * scene.scale + scene.pan;
              let clip = vec2<f32>(
                screenPosition.x / scene.resolution.x * 2.0 - 1.0,
                1.0 - screenPosition.y / scene.resolution.y * 2.0
              );
              var output: NodeOutput;
              output.position = vec4<f32>(clip, 0.0, 1.0);
              output.local = local;
              output.size = size;
              output.configuration = nodeValue(instance, 4u);
              output.selected = nodeValue(instance, 5u);
              return output;
            }
            fn roundedDistance(
              point: vec2<f32>,
              size: vec2<f32>,
              radius: f32
            ) -> f32 {
              let q = abs(point - size * 0.5) -
                (size * 0.5 - vec2<f32>(radius));
              return length(max(q, vec2<f32>(0.0))) +
                min(max(q.x, q.y), 0.0) - radius;
            }
            @fragment
            fn fragmentMain(input: NodeOutput) -> @location(0) vec4<f32> {
              let distance = roundedDistance(
                input.local,
                input.size,
                10.0
              );
              let antialiasGraph =
                1.15 / max(scene.scale, 0.0001);
              let alpha = 1.0 - smoothstep(
                0.0,
                antialiasGraph,
                distance
              );
              if (alpha <= 0.001) {
                discard;
              }
              let header = input.local.y <= min(45.0, input.size.y);
              let body = select(
                vec3<f32>(0.0745, 0.0902, 0.1216),
                vec3<f32>(0.0627, 0.1098, 0.1529),
                input.configuration > 0.5
              );
              let headerMix = clamp(input.local.y / 45.0, 0.0, 1.0);
              let headerColor = mix(
                vec3<f32>(0.1333, 0.1686, 0.2118),
                vec3<f32>(0.0902, 0.1137, 0.1451),
                headerMix
              );
              var color = select(body, headerColor, header);
              let borderWidth = 1.0 / max(scene.scale, 0.0001);
              let border = select(
                select(
                  vec3<f32>(0.2039, 0.2549, 0.3098),
                  vec3<f32>(0.3451, 0.7490, 1.0),
                  input.configuration > 0.5
                ),
                vec3<f32>(0.4392, 0.8118, 1.0),
                input.selected > 0.5
              );
              let borderMask = 1.0 - smoothstep(
                borderWidth,
                borderWidth + antialiasGraph,
                abs(distance)
              );
              color = mix(color, border, borderMask);
              return vec4<f32>(color, alpha * 0.99);
            }
          `
        });

      const blend = {
        color: {
          srcFactor: "src-alpha",
          dstFactor: "one-minus-src-alpha",
          operation: "add"
        },
        alpha: {
          srcFactor: "one",
          dstFactor: "one-minus-src-alpha",
          operation: "add"
        }
      };
      const computeDescriptor = {
          label: "RML graph compute culling",
          layout: "auto",
          compute: {
            module: computeModule,
            entryPoint: "main"
          }
        };
      const gridDescriptor = {
          label: "RML graph grid",
          layout: "auto",
          vertex: {
            module: gridModule,
            entryPoint: "vertexMain"
          },
          fragment: {
            module: gridModule,
            entryPoint: "fragmentMain",
            targets: [{ format }]
          },
          primitive: { topology: "triangle-list" }
        };
      const wireDescriptor = {
          label: "RML graph wires",
          layout: "auto",
          vertex: {
            module: wireModule,
            entryPoint: "vertexMain"
          },
          fragment: {
            module: wireModule,
            entryPoint: "fragmentMain",
            targets: [{ format, blend }]
          },
          primitive: { topology: "triangle-strip" }
        };
      const nodeDescriptor = {
          label: "RML graph nodes",
          layout: "auto",
          vertex: {
            module: nodeModule,
            entryPoint: "vertexMain"
          },
          fragment: {
            module: nodeModule,
            entryPoint: "fragmentMain",
            targets: [{ format, blend }]
          },
          primitive: { topology: "triangle-strip" }
        };
      const createCompute = descriptor =>
        typeof device.createComputePipelineAsync ===
          "function"
          ? device.createComputePipelineAsync(
              descriptor
            )
          : Promise.resolve(
              device.createComputePipeline(
                descriptor
              )
            );
      const createRender = descriptor =>
        typeof device.createRenderPipelineAsync ===
          "function"
          ? device.createRenderPipelineAsync(
              descriptor
            )
          : Promise.resolve(
              device.createRenderPipeline(
                descriptor
              )
            );
      [
        this.gpuPipelines.compute,
        this.gpuPipelines.grid,
        this.gpuPipelines.wire,
        this.gpuPipelines.node
      ] = await Promise.all([
        createCompute(computeDescriptor),
        createRender(gridDescriptor),
        createRender(wireDescriptor),
        createRender(nodeDescriptor)
      ]);
    }

    ensureBuffer(name, requiredBytes, usage) {
      const size = Math.max(
        4,
        Math.ceil(requiredBytes / 4) * 4
      );
      if (
        this.gpuBuffers[name] &&
        this.gpuBufferSizes[name] >= size
      ) {
        return false;
      }
      this.gpuBuffers[name]?.destroy?.();
      this.gpuBuffers[name] =
        this.gpuDevice.createBuffer({
          label: `RML graph ${name}`,
          size: grownCapacity(
            this.gpuBufferSizes[name] || 0,
            size,
            256
          ),
          usage
        });
      this.gpuBufferSizes[name] =
        this.gpuBuffers[name].size;
      return true;
    }

    invalidateGpuCulling() {
      this.gpuCullDirty = true;
      this.gpuCullReady = false;
      this.gpuCullBounds = null;
      this.gpuCullScale = 0;
    }

    scheduleGpuSpatialIndexBuild(kind) {
      const isWire = kind === "wire";
      const records = isWire
        ? this.wireRecords
        : this.nodeRecords;
      const revision = isWire
        ? this.wireDataRevision
        : this.nodeDataRevision;
      const existing =
        this.gpuSpatialBuildTasks[kind];
      if (
        existing &&
        existing.records === records &&
        existing.revision === revision
      ) {
        return;
      }
      const task = {
        records,
        revision,
        position: 0,
        commitPosition: 0,
        indexComplete: false,
        index: new Map(),
        overflow: [],
        spatialKeys: new Array(records.length),
        workMilliseconds: 0
      };
      this.gpuSpatialBuildTasks[kind] = task;
      this.stats.gpuSpatialIndexBuilding = true;

      const schedule = callback => {
        if (
          typeof globalThis.requestIdleCallback ===
          "function"
        ) {
          globalThis.requestIdleCallback(
            callback,
            { timeout: 80 }
          );
          return;
        }
        globalThis.setTimeout(
          () => callback({
            timeRemaining: () => 4
          }),
          0
        );
      };
      const runBatch = deadline => {
        if (
          this.disposed ||
          this.gpuSpatialBuildTasks[kind] !== task ||
          task.records !== (
            isWire
              ? this.wireRecords
              : this.nodeRecords
          ) ||
          task.revision !== (
            isWire
              ? this.wireDataRevision
              : this.nodeDataRevision
          ) ||
          (isWire
            ? !this.wireCullSpatialIndexDirty
            : !this.nodeSpatialIndexDirty)
        ) {
          if (
            this.gpuSpatialBuildTasks[kind] ===
            task
          ) {
            this.gpuSpatialBuildTasks[kind] = null;
          }
          this.stats.gpuSpatialIndexBuilding =
            Boolean(
              this.gpuSpatialBuildTasks.wire ||
              this.gpuSpatialBuildTasks.node
            );
          return;
        }
        const started = performance.now();
        if (!task.indexComplete) {
          const batchEnd = Math.min(
            records.length,
            task.position + WEBGPU_INDEX_BATCH_SIZE
          );
          let processed = 0;
          while (
            task.position < batchEnd &&
            (
              processed < 64 ||
              deadline.timeRemaining() > 1
            )
          ) {
            const record = records[task.position];
            if (isWire) {
              const range = cellRange(
                record.bounds,
                WIRE_CULL_CELL_SIZE
              );
              const columns =
                range.maximumX - range.minimumX + 1;
              const rows =
                range.maximumY - range.minimumY + 1;
              if (
                columns * rows >
                  MAX_WIRE_CULL_RECORD_CELLS
              ) {
                task.spatialKeys[task.position] = null;
                task.overflow.push(record);
              } else {
                task.spatialKeys[task.position] =
                  addToSpatialIndex(
                    task.index,
                    record.bounds,
                    WIRE_CULL_CELL_SIZE,
                    record
                  );
              }
            } else {
              task.spatialKeys[task.position] =
                addToSpatialIndex(
                  task.index,
                  record,
                  NODE_CELL_SIZE,
                  record
                );
            }
            task.position += 1;
            processed += 1;
          }
          task.workMilliseconds +=
            performance.now() - started;
          if (task.position < records.length) {
            schedule(runBatch);
            return;
          }
          task.indexComplete = true;
          schedule(runBatch);
          return;
        }
        const commitEnd = Math.min(
          records.length,
          task.commitPosition + WEBGPU_INDEX_BATCH_SIZE
        );
        let committed = 0;
        while (
          task.commitPosition < commitEnd &&
          (
            committed < 64 ||
            deadline.timeRemaining() > 1
          )
        ) {
          const index = task.commitPosition;
          records[index].spatialKeys = task.spatialKeys[index];
          if (isWire) {
            records[index].spatialOverflow =
              task.spatialKeys[index] === null;
          }
          task.commitPosition += 1;
          committed += 1;
        }
        task.workMilliseconds +=
          performance.now() - started;
        if (task.commitPosition < records.length) {
          schedule(runBatch);
          return;
        }
        if (isWire) {
          this.wireCullSpatialIndex = task.index;
          this.wireCullOverflowRecords =
            task.overflow;
          this.wireCullSpatialIndexDirty = false;
          this.stats.wireCullIndexMilliseconds =
            task.workMilliseconds;
        } else {
          this.nodeSpatialIndex = task.index;
          this.nodeSpatialIndexDirty = false;
          this.stats.nodeIndexMilliseconds =
            task.workMilliseconds;
        }
        this.gpuSpatialBuildTasks[kind] = null;
        this.stats.gpuSpatialIndexBuilding =
          Boolean(
            this.gpuSpatialBuildTasks.wire ||
            this.gpuSpatialBuildTasks.node
          );
      };
      schedule(runBatch);
    }

    gpuWireCullPlan(bounds) {
      const total = this.wireRecords.length;
      if (total === 0) {
        return {
          mode: "empty",
          records: [],
          count: 0
        };
      }
      if (
        total < WEBGPU_WORKGROUP_SIZE * 4 ||
        spatialQueryCellCount(
          bounds,
          WIRE_CULL_CELL_SIZE
        ) > MAX_CULL_QUERY_CELLS
      ) {
        return {
          mode: "full",
          records: null,
          count: total
        };
      }
      if (
        this.wireCullSpatialIndexDirty &&
        total >= WEBGPU_ASYNC_INDEX_THRESHOLD
      ) {
        this.scheduleGpuSpatialIndexBuild("wire");
        return {
          mode: "full",
          records: null,
          count: total
        };
      }
      this.buildWireCullSpatialIndex();
      const records = spatialRecordsInBounds(
        this.wireCullSpatialIndex,
        this.wireRecords,
        bounds,
        WIRE_CULL_CELL_SIZE,
        record => record.hidden !== true,
        this.wireCullOverflowRecords
      );
      return {
        mode: "tiles",
        records,
        count: records.length
      };
    }

    gpuNodeCullPlan(bounds) {
      const total = this.nodeRecords.length;
      if (total === 0) {
        return {
          mode: "empty",
          records: [],
          count: 0
        };
      }
      if (
        this.nodeExcludedIds.size === 0 &&
        (
          total < WEBGPU_WORKGROUP_SIZE * 4 ||
          spatialQueryCellCount(
            bounds,
            NODE_CELL_SIZE
          ) > MAX_CULL_QUERY_CELLS
        )
      ) {
        return {
          mode: "full",
          records: null,
          count: total
        };
      }
      if (
        this.nodeSpatialIndexDirty &&
        total >= WEBGPU_ASYNC_INDEX_THRESHOLD
      ) {
        this.scheduleGpuSpatialIndexBuild("node");
        if (this.nodeExcludedIds.size === 0) {
          return {
            mode: "full",
            records: null,
            count: total
          };
        }
        const records = this.nodeRecords.filter(
          record =>
            !this.nodeExcludedIds.has(
              record.nodeId
            )
        );
        return {
          mode: "tiles",
          records,
          count: records.length
        };
      }
      this.buildNodeSpatialIndex();
      const records = spatialRecordsInBounds(
        this.nodeSpatialIndex,
        this.nodeRecords,
        bounds,
        NODE_CELL_SIZE,
        record =>
          !this.nodeExcludedIds.has(
            record.nodeId
          )
      );
      return {
        mode: "tiles",
        records,
        count: records.length
      };
    }

    uploadGpuCandidateIndices(
      name,
      records
    ) {
      if (!records || records.length === 0) {
        return;
      }
      const property = name === "wire"
        ? "wireCandidateData"
        : "nodeCandidateData";
      if (
        this[property].length < records.length
      ) {
        this[property] = new Uint32Array(
          grownCapacity(
            this[property].length,
            records.length
          )
        );
      }
      const data = this[property];
      for (
        let index = 0;
        index < records.length;
        index += 1
      ) {
        data[index] = records[index].order;
      }
      this.gpuDevice.queue.writeBuffer(
        this.gpuBuffers[
          name === "wire"
            ? "wireCandidates"
            : "nodeCandidates"
        ],
        0,
        data.subarray(0, records.length)
      );
    }

    prepareGpuCulling(bounds) {
      const started = performance.now();
      const wirePlan =
        this.gpuWireCullPlan(bounds);
      const nodePlan =
        this.gpuNodeCullPlan(bounds);
      const curveRecords = wirePlan.records ||
        (
          wirePlan.count <=
            WEBGPU_WORKGROUP_SIZE * 16
            ? this.wireRecords
            : null
        );
      this.gpuCandidateMaximumCurveLength =
        curveRecords
          ? maximumCurveControlPolygonLength(
              curveRecords
            )
          : wirePlan.count > 0
            ? this.maximumWireCurveLength
            : 0;
      this.uploadGpuCandidateIndices(
        "wire",
        wirePlan.records
      );
      this.uploadGpuCandidateIndices(
        "node",
        nodePlan.records
      );
      this.cullUniformFloats[0] = bounds.left;
      this.cullUniformFloats[1] = bounds.top;
      this.cullUniformFloats[2] = bounds.right;
      this.cullUniformFloats[3] = bounds.bottom;
      this.cullUniformIntegers[0] =
        wirePlan.count;
      this.cullUniformIntegers[1] =
        nodePlan.count;
      this.cullUniformIntegers[2] =
        wirePlan.mode === "tiles" ? 1 : 0;
      this.cullUniformIntegers[3] =
        nodePlan.mode === "tiles" ? 1 : 0;
      this.gpuDevice.queue.writeBuffer(
        this.gpuBuffers.cullUniform,
        0,
        this.cullUniformData
      );
      this.gpuWireCandidateCount =
        wirePlan.count;
      this.gpuNodeCandidateCount =
        nodePlan.count;
      this.gpuWireCandidateMode =
        wirePlan.mode;
      this.gpuNodeCandidateMode =
        nodePlan.mode;
      this.stats.gpuWireCandidates =
        wirePlan.count;
      this.stats.gpuNodeCandidates =
        nodePlan.count;
      this.stats.gpuWireCandidateMode =
        wirePlan.mode;
      this.stats.gpuNodeCandidateMode =
        nodePlan.mode;
      this.stats.gpuLastCullMilliseconds =
        performance.now() - started;
      return Math.max(
        wirePlan.count,
        nodePlan.count
      );
    }

    ensureWebGpuBuffers() {
      const storageCopy =
        GPUBufferUsage.STORAGE |
        GPUBufferUsage.COPY_DST;
      let changed = false;
      changed = this.ensureBuffer(
        "renderUniform",
        32,
        GPUBufferUsage.UNIFORM |
          GPUBufferUsage.COPY_DST
      ) || changed;
      changed = this.ensureBuffer(
        "cullUniform",
        32,
        GPUBufferUsage.UNIFORM |
          GPUBufferUsage.COPY_DST
      ) || changed;
      changed = this.ensureBuffer(
        "wireMaster",
        this.wireInstanceCapacity *
          FLOATS_PER_WIRE_INSTANCE * 4,
        storageCopy
      ) || changed;
      changed = this.ensureBuffer(
        "wireCandidates",
        this.wireInstanceCapacity * 4,
        storageCopy
      ) || changed;
      changed = this.ensureBuffer(
        "wireVisible",
        this.wireInstanceCapacity *
          FLOATS_PER_WIRE_INSTANCE * 4,
        GPUBufferUsage.STORAGE
      ) || changed;
      changed = this.ensureBuffer(
        "wireIndirect",
        16,
        GPUBufferUsage.STORAGE |
          GPUBufferUsage.INDIRECT |
          GPUBufferUsage.COPY_DST
      ) || changed;
      changed = this.ensureBuffer(
        "nodeMaster",
        this.nodeInstanceCapacity *
          FLOATS_PER_NODE_INSTANCE * 4,
        storageCopy
      ) || changed;
      changed = this.ensureBuffer(
        "nodeCandidates",
        this.nodeInstanceCapacity * 4,
        storageCopy
      ) || changed;
      changed = this.ensureBuffer(
        "nodeVisible",
        this.nodeInstanceCapacity *
          FLOATS_PER_NODE_INSTANCE * 4,
        GPUBufferUsage.STORAGE
      ) || changed;
      changed = this.ensureBuffer(
        "nodeIndirect",
        16,
        GPUBufferUsage.STORAGE |
          GPUBufferUsage.INDIRECT |
          GPUBufferUsage.COPY_DST
      ) || changed;
      changed = this.ensureBuffer(
        "preview",
        FLOATS_PER_WIRE_INSTANCE * 4,
        storageCopy
      ) || changed;
      if (changed) {
        this.invalidateGpuCulling();
        this.createWebGpuBindGroups();
        this.gpuDevice.queue.writeBuffer(
          this.gpuBuffers.wireIndirect,
          0,
          this.wireIndirectData
        );
        this.gpuDevice.queue.writeBuffer(
          this.gpuBuffers.nodeIndirect,
          0,
          this.nodeIndirectData
        );
      }
    }

    createWebGpuBindGroups() {
      const device = this.gpuDevice;
      const buffers = this.gpuBuffers;
      if (
        !buffers.renderUniform ||
        !this.gpuPipelines.compute
      ) {
        return;
      }
      this.gpuBindGroups.compute =
        device.createBindGroup({
          layout:
            this.gpuPipelines.compute
              .getBindGroupLayout(0),
          entries: [
            [0, buffers.cullUniform],
            [1, buffers.wireMaster],
            [2, buffers.wireVisible],
            [3, buffers.wireIndirect],
            [4, buffers.nodeMaster],
            [5, buffers.nodeVisible],
            [6, buffers.nodeIndirect],
            [7, buffers.wireCandidates],
            [8, buffers.nodeCandidates]
          ].map(([binding, buffer]) => ({
            binding,
            resource: { buffer }
          }))
        });
      const renderGroup = (
        pipeline,
        dataBuffer
      ) => device.createBindGroup({
        layout:
          pipeline.getBindGroupLayout(0),
        entries: [
          {
            binding: 0,
            resource: {
              buffer: buffers.renderUniform
            }
          },
          ...(dataBuffer
            ? [{
                binding: 1,
                resource: {
                  buffer: dataBuffer
                }
              }]
            : [])
        ]
      });
      this.gpuBindGroups.grid =
        renderGroup(
          this.gpuPipelines.grid,
          null
        );
      this.gpuBindGroups.wire =
        renderGroup(
          this.gpuPipelines.wire,
          buffers.wireVisible
        );
      this.gpuBindGroups.preview =
        renderGroup(
          this.gpuPipelines.wire,
          buffers.preview
        );
      this.gpuBindGroups.node =
        renderGroup(
          this.gpuPipelines.node,
          buffers.nodeVisible
        );
    }

    rebuildWireBuffers() {
      super.rebuildWireBuffers();
      if (!this.gpuResourcesReady) {
        return;
      }
      this.ensureWebGpuBuffers();
      const count = this.wireRecords.length;
      if (count > 0) {
        this.gpuDevice.queue.writeBuffer(
          this.gpuBuffers.wireMaster,
          0,
          this.wireInstanceData.subarray(
            0,
            count * FLOATS_PER_WIRE_INSTANCE
          )
        );
      }
      this.invalidateGpuCulling();
    }

    computeWireLength(
      curve,
      previous,
      geometryReused
    ) {
      return geometryReused
        ? previous.length
        : 0;
    }

    rebuildNodeBuffers() {
      super.rebuildNodeBuffers();
      if (!this.gpuResourcesReady) {
        return;
      }
      this.ensureWebGpuBuffers();
      const count = this.nodeRecords.length;
      if (count > 0) {
        this.gpuDevice.queue.writeBuffer(
          this.gpuBuffers.nodeMaster,
          0,
          this.nodeInstanceData.subarray(
            0,
            count * FLOATS_PER_NODE_INSTANCE
          )
        );
      }
      this.invalidateGpuCulling();
    }

    updateSegments(segments = []) {
      const indices = segments.map(segment =>
        this.wireRecordIndexByKey.get(
          this.wireRecordKey(segment)
        )
      );
      const updated = super.updateSegments(
        segments
      );
      if (!updated) {
        return false;
      }
      for (const index of indices) {
        const dataOffset =
          index * FLOATS_PER_WIRE_INSTANCE;
        this.gpuDevice.queue.writeBuffer(
          this.gpuBuffers.wireMaster,
          dataOffset * 4,
          this.wireInstanceData.subarray(
            dataOffset,
            dataOffset + FLOATS_PER_WIRE_INSTANCE
          )
        );
      }
      this.invalidateGpuCulling();
      return true;
    }

    updateNodes(nodes = []) {
      const indices = nodes.map(node =>
        this.nodeRecordIndexById.get(
          node?.nodeId
        )
      );
      const updated = super.updateNodes(nodes);
      if (!updated) {
        return false;
      }
      for (const index of indices) {
        const offset =
          index * FLOATS_PER_NODE_INSTANCE;
        this.gpuDevice.queue.writeBuffer(
          this.gpuBuffers.nodeMaster,
          offset * 4,
          this.nodeInstanceData.subarray(
            offset,
            offset + FLOATS_PER_NODE_INSTANCE
          )
        );
      }
      this.invalidateGpuCulling();
      return true;
    }

    hideConnections(connectionIds = []) {
      const ids = new Set(
        Array.isArray(connectionIds) ||
        connectionIds instanceof Set
          ? connectionIds
          : [connectionIds]
      );
      const indices = [];
      for (
        let index = 0;
        index < this.wireRecords.length;
        index += 1
      ) {
        if (
          ids.has(
            this.wireRecords[index]
              .connectionId
          )
        ) {
          indices.push(index);
        }
      }
      const hidden =
        super.hideConnections(connectionIds);
      if (!hidden) {
        return hidden;
      }
      for (const index of indices) {
        const offset =
          index * FLOATS_PER_WIRE_INSTANCE;
        this.gpuDevice.queue.writeBuffer(
          this.gpuBuffers.wireMaster,
          offset * 4,
          this.wireInstanceData.subarray(
            offset,
            offset + FLOATS_PER_WIRE_INSTANCE
          )
        );
      }
      this.invalidateGpuCulling();
      return hidden;
    }

    setNodeExclusions(nodeIds = []) {
      const changed =
        super.setNodeExclusions(nodeIds);
      if (!changed) {
        return false;
      }
      this.invalidateGpuCulling();
      return true;
    }

    setPreview(segment = null) {
      this.previewSegment =
        segment && typeof segment === "object"
          ? segment
          : null;
      if (!this.previewSegment) {
        this.previewInstanceCount = 0;
        this.stats.previewInstances = 0;
        this.scheduleDraw();
        return true;
      }
      const record = this.prepareWireRecord(
        this.previewSegment
      );
      record.selected = true;
      record.length = approximateCubicLength(
        record.curve,
        12
      );
      this.writeWireLayerData(
        record,
        this.previewInstanceData,
        0
      );
      this.gpuDevice.queue.writeBuffer(
        this.gpuBuffers.preview,
        0,
        this.previewInstanceData
      );
      this.previewInstanceCount = 1;
      this.stats.previewInstances = 1;
      this.scheduleDraw();
      return true;
    }

    draw() {
      if (
        !this.available ||
        !this.gpuResourcesReady ||
        this.contextLost ||
        !this.viewport ||
        this.disposed
      ) {
        return;
      }
      const started = performance.now();
      const device = this.gpuDevice;
      const viewportBounds = this.viewportGraphBounds(
        WIRE_CULL_MARGIN_PIXELS
      );
      const scaleReuseRatio =
        Math.max(
          this.camera.scale,
          this.gpuCullScale || this.camera.scale
        ) /
        Math.max(
          0.0001,
          Math.min(
            this.camera.scale,
            this.gpuCullScale || this.camera.scale
          )
        );
      const needsCull =
        this.gpuCullDirty ||
        !this.gpuCullReady ||
        scaleReuseRatio >=
          WEBGPU_CULL_SCALE_REUSE_RATIO ||
        !containsBounds(
          this.gpuCullBounds,
          viewportBounds
        );
      let cullBounds = null;
      let maximumCount = 0;
      if (needsCull) {
        cullBounds =
          this.viewportGraphBounds(
            WEBGPU_CULL_OVERSCAN_PIXELS
          );
        maximumCount =
          this.prepareGpuCulling(cullBounds);
      }
      const curveSteps = curveStepsForScale(
        this.camera.scale,
        this.gpuCandidateMaximumCurveLength
      );
      if (curveSteps !== this.activeCurveSteps) {
        this.activeCurveSteps = curveSteps;
        this.wireIndirectData[0] =
          (curveSteps + 1) * 2;
        device.queue.writeBuffer(
          this.gpuBuffers.wireIndirect,
          0,
          this.wireIndirectData.subarray(0, 1)
        );
      }
      this.stats.curveSteps = curveSteps;
      this.renderUniformData[0] = this.cssWidth;
      this.renderUniformData[1] = this.cssHeight;
      this.renderUniformData[2] = this.camera.x;
      this.renderUniformData[3] = this.camera.y;
      this.renderUniformData[4] = this.camera.scale;
      this.renderUniformData[5] = this.pixelRatio;
      this.renderUniformData[6] = curveSteps;
      device.queue.writeBuffer(
        this.gpuBuffers.renderUniform,
        0,
        this.renderUniformData
      );
      const encoder =
        device.createCommandEncoder({
          label: "RML graph frame"
        });
      if (needsCull) {
        encoder.clearBuffer(
          this.gpuBuffers.wireIndirect,
          4,
          4
        );
        encoder.clearBuffer(
          this.gpuBuffers.nodeIndirect,
          4,
          4
        );
        if (maximumCount > 0) {
          const compute =
            encoder.beginComputePass({
              label: "RML graph visibility"
            });
          compute.setPipeline(
            this.gpuPipelines.compute
          );
          compute.setBindGroup(
            0,
            this.gpuBindGroups.compute
          );
          compute.dispatchWorkgroups(
            Math.ceil(
              maximumCount /
                WEBGPU_WORKGROUP_SIZE
            )
          );
          compute.end();
        }
        this.gpuCullBounds = cullBounds;
        this.gpuCullScale = this.camera.scale;
        this.gpuCullDirty = false;
        this.gpuCullReady = true;
        this.stats.gpuCullPasses += 1;
      } else {
        this.stats.gpuCullReusedFrames += 1;
      }

      const render = encoder.beginRenderPass({
        label: "RML graph render",
        colorAttachments: [{
          view:
            this.gpuContext
              .getCurrentTexture()
              .createView(),
          clearValue: {
            r: 0.0314,
            g: 0.0392,
            b: 0.0627,
            a: 1
          },
          loadOp: "clear",
          storeOp: "store"
        }]
      });
      let drawCalls = 0;
      render.setPipeline(
        this.gpuPipelines.grid
      );
      render.setBindGroup(
        0,
        this.gpuBindGroups.grid
      );
      render.draw(3);
      drawCalls += 1;
      if (this.wireRecords.length > 0) {
        render.setPipeline(
          this.gpuPipelines.wire
        );
        render.setBindGroup(
          0,
          this.gpuBindGroups.wire
        );
        render.drawIndirect(
          this.gpuBuffers.wireIndirect,
          0
        );
        drawCalls += 1;
      }
      if (this.previewInstanceCount > 0) {
        render.setPipeline(
          this.gpuPipelines.wire
        );
        render.setBindGroup(
          0,
          this.gpuBindGroups.preview
        );
        render.draw(
          (curveSteps + 1) * 2,
          1
        );
        drawCalls += 1;
      }
      if (this.nodeRecords.length > 0) {
        render.setPipeline(
          this.gpuPipelines.node
        );
        render.setBindGroup(
          0,
          this.gpuBindGroups.node
        );
        render.drawIndirect(
          this.gpuBuffers.nodeIndirect,
          0
        );
        drawCalls += 1;
      }
      render.end();
      device.queue.submit([encoder.finish()]);

      this.stats.drawCalls = drawCalls;
      this.stats.wireInstances = null;
      this.stats.nodeInstances = null;
      this.stats.visibleSegments = null;
      this.stats.visibleNodes = null;
      this.stats.culledSegments = null;
      this.stats.culledNodes = null;
      this.stats.gpuSubmittedSegments =
        this.gpuWireCandidateCount;
      this.stats.gpuSubmittedNodes =
        this.gpuNodeCandidateCount;
      this.stats.gpuMasterSegments =
        this.wireRecords.length;
      this.stats.gpuMasterNodes =
        this.nodeRecords.length;
      this.stats.gpuCullReused = !needsCull;
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

    whenSubmittedWorkDone() {
      return this.gpuDevice?.queue
        ?.onSubmittedWorkDone?.() ||
        Promise.resolve(true);
    }

    clearScene() {
      super.clearScene();
      this.invalidateGpuCulling();
      this.gpuWireCandidateCount = 0;
      this.gpuNodeCandidateCount = 0;
      this.gpuWireCandidateMode = "empty";
      this.gpuNodeCandidateMode = "empty";
      this.gpuCandidateMaximumCurveLength = 0;
      if (
        this.gpuResourcesReady &&
        this.gpuBuffers.wireIndirect
      ) {
        this.gpuDevice.queue.writeBuffer(
          this.gpuBuffers.wireIndirect,
          0,
          this.wireIndirectData
        );
        this.gpuDevice.queue.writeBuffer(
          this.gpuBuffers.nodeIndirect,
          0,
          this.nodeIndirectData
        );
      }
    }

    deleteGpuResources() {
      if (this.gpuBuffers) {
        for (const buffer of
          Object.values(this.gpuBuffers)) {
          buffer?.destroy?.();
        }
      }
      this.gpuBuffers = Object.create(null);
      this.gpuBufferSizes = Object.create(null);
      this.gpuBindGroups = Object.create(null);
      this.gpuResourcesReady = false;
      this.gpuSpatialBuildTasks = {
        wire: null,
        node: null
      };
      this.stats.gpuSpatialIndexBuilding = false;
      this.invalidateGpuCulling();
    }
  }

  function rendererBackendStatus() {
    return Object.freeze({
      preference: rendererBackendPreference,
      active: activeRendererBackend,
      webGpuAvailable: Boolean(
        webGpuRuntime.device
      ),
      webGpuInitializationError:
        webGpuRuntime.error || null
    });
  }

  function setRendererBackend(
    value,
    reload = true
  ) {
    const normalized =
      normalizeRendererBackend(value);
    if (!normalized) {
      throw new TypeError(
        "Unknown graph renderer backend. Use auto, wgsl, glsl or svg."
      );
    }
    rendererBackendPreference = normalized;
    persistRendererBackend(normalized);
    console.info(
      `[RML Graph] Renderer backend set to ${normalized}.`
    );
    if (
      reload !== false &&
      typeof window.location?.reload ===
        "function"
    ) {
      window.location.reload();
    }
    return rendererBackendStatus();
  }

  Object.defineProperty(
    window,
    "RMLGraphHybridRenderer",
    {
      value: Object.freeze({
        version: VERSION,
        ready: webGpuRuntime.ready,
        getBackend: rendererBackendStatus,
        setBackend: setRendererBackend,
        create(options) {
          if (
            rendererBackendPreference !== "glsl" &&
            rendererBackendPreference !== "svg" &&
            webGpuRuntime.device
          ) {
            const renderer =
              new GraphWebGpuRenderer(
                options,
                webGpuRuntime
              );
            if (renderer.available) {
              activeRendererBackend =
                "webgpu-wgsl";
              return renderer;
            }
            renderer.dispose();
          }
          const renderer =
            new GraphHybridRenderer(
              rendererBackendPreference === "svg"
                ? {
                    ...options,
                    deferGraphics: true
                  }
                : options
            );
          activeRendererBackend =
            renderer.available
              ? "webgl2-glsl"
              : "svg-fallback";
          return renderer;
        }
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
