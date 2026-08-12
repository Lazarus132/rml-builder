(() => {
  "use strict";

  const EXTENSION_NAME = "typedNodeGraph";
  const GRAPH_SCHEMA_VERSION = 15;
  const GRAPH_STAGE_WIDTH = 5200;
  const GRAPH_STAGE_HEIGHT = 3400;
  const GRAPH_MIN_ZOOM = 0.005;
  const GRAPH_MAX_ZOOM = 1.65;
  const GRAPH_GRID = 12;
  const GRAPH_AUTOPAN_EDGE = 54;
  const GRAPH_AUTOPAN_MAX_SPEED = 24;
  const GRAPH_COORDINATE_LIMIT = 100000;
  const GRAPH_NODE_MIN_WIDTH = 250;
  const GRAPH_NODE_MIN_HEIGHT = 96;
  const GRAPH_NODE_MIN_BODY_HEIGHT = 48;
  const GRAPH_NODE_MAX_WIDTH =
    GRAPH_STAGE_WIDTH - 120;
  const GRAPH_NODE_MAX_HEIGHT =
    GRAPH_STAGE_HEIGHT - 120;
  const GRAPH_WIRE_DRAG_THRESHOLD = 4;
  const GRAPH_WIRE_POINT_SNAP = 6;
  const GRAPH_WIRE_POINT_REUSE_DISTANCE = 18;
  const GRAPH_WIRE_PATH_SAMPLES = 36;

  const VALUE_TYPES = [
    "bool",
    "string",
    "Uri",
    "int",
    "float",
    "double",
    "int2",
    "int3",
    "int4",
    "float2",
    "float3",
    "float4",
    "double2",
    "double3",
    "double4",
    "colorX"
  ];

  const TYPE_INFO = {
    impulse: {
      label: "Impulse",
      short: "IMP",
      color: "#f6f7fb"
    },
    bool: {
      label: "Boolean",
      short: "BOOL",
      color: "#6ce89b"
    },
    string: {
      label: "String",
      short: "TXT",
      color: "#ff83bd"
    },
    Uri: {
      label: "URI",
      short: "URI",
      color: "#5be3cf"
    },
    enum: {
      label: "Enum",
      short: "ENUM",
      color: "#ffd181"
    },
    int: {
      label: "Integer",
      short: "INT",
      color: "#ff956f"
    },
    float: {
      label: "Float",
      short: "F32",
      color: "#59b7ff"
    },
    double: {
      label: "Double",
      short: "F64",
      color: "#b994ff"
    },
    int2: {
      label: "Integer 2",
      short: "I2",
      color: "#ffae70"
    },
    int3: {
      label: "Integer 3",
      short: "I3",
      color: "#ffae70"
    },
    int4: {
      label: "Integer 4",
      short: "I4",
      color: "#ffae70"
    },
    float2: {
      label: "Float 2",
      short: "F2",
      color: "#58d2ff"
    },
    float3: {
      label: "Float 3",
      short: "F3",
      color: "#58d2ff"
    },
    float4: {
      label: "Float 4",
      short: "F4",
      color: "#58d2ff"
    },
    double2: {
      label: "Double 2",
      short: "D2",
      color: "#c5a2ff"
    },
    double3: {
      label: "Double 3",
      short: "D3",
      color: "#c5a2ff"
    },
    double4: {
      label: "Double 4",
      short: "D4",
      color: "#c5a2ff"
    },
    colorX: {
      label: "HDR color",
      short: "CLR",
      color: "#ff67dc"
    },
    generic: {
      label: "Generic",
      short: "T",
      color: "#9da8b4"
    }
  };

  const RUNTIME_BEHAVIORS = {
    stored: {
      label: "Stored value",
      symbol: "●",
      shape: "circle"
    },
    startup: {
      label: "Read on startup",
      symbol: "▶",
      shape: "triangle"
    },
    saved: {
      label: "React when settings are saved",
      symbol: "■",
      shape: "square"
    },
    "startup-saved": {
      label: "Startup and saved reaction",
      symbol: "◆",
      shape: "diamond"
    }
  };

  function runtimeBehaviorIncludesStartup(
    reaction
  ) {
    return (
      reaction === "startup" ||
      reaction === "startup-saved"
    );
  }

  function runtimeBehaviorIncludesSaved(
    reaction
  ) {
    return (
      reaction === "saved" ||
      reaction === "startup-saved"
    );
  }

  function runtimeBehaviorEmitsImpulse(
    reaction
  ) {
    return (
      runtimeBehaviorIncludesStartup(
        reaction
      ) ||
      runtimeBehaviorIncludesSaved(
        reaction
      )
    );
  }

  const port = (
    id,
    label,
    type,
    extra = {}
  ) => ({
    id,
    label,
    type,
    ...extra
  });

  const genericPort = (
    id,
    label,
    typeVar,
    constraint = "value",
    extra = {}
  ) => ({
    id,
    label,
    typeVar,
    constraint,
    ...extra
  });

  const OPERATOR_DEFINITIONS = {
    "constant.number": {
      title: "Number Constant",
      group: "Values",
      symbol: "#",
      description:
        "An intelligent scalar number. Auto infers int, float or double from connected sockets; explicit modes remain available.",
      configurableTypeVar: "T",
      configurableTypes: ["int", "float", "double"],
      allowAutoType: true,
      defaultType: "auto",
      autoFallbackType: "float",
      parameterKind: "number",
      outputs: [
        genericPort(
          "value",
          "Value",
          "T",
          "scalar"
        )
      ]
    },
    "constant.bool": {
      title: "Boolean Constant",
      group: "Values",
      symbol: "B",
      description:
        "A true or false value.",
      parameterKind: "bool",
      outputs: [
        port("value", "Value", "bool")
      ]
    },
    "constant.string": {
      title: "String Constant",
      group: "Values",
      symbol: "T",
      description:
        "A text value.",
      parameterKind: "string",
      outputs: [
        port("value", "Value", "string")
      ]
    },
    "constant.color": {
      title: "ColorX Constant",
      group: "Values",
      symbol: "C",
      description:
        "A full HDR colorX constant with the same profile, strength, preview feed and custom color picker used by the Configuration Outline.",
      parameterKind: "color",
      outputs: [
        port("value", "Value", "colorX")
      ]
    },
    "constant.typedDefault": {
      title: "Typed Default",
      group: "Values",
      symbol: "T∅",
      description:
        "An exact typed fallback source for values that do not have a dedicated editable constant node.",
      hiddenFromPalette: true,
      outputs: [
        port("value", "Value", "object")
      ],
      codegenExpression(api) {
        return api.csDefault(
          api.type ||
          api.node.parameters?.valueType ||
          "object"
        );
      },
      previewEvaluate({
        type,
        defaultValue
      }) {
        return defaultValue(type);
      }
    },

    "math.add": {
      title: "Add",
      group: "Math",
      symbol: "+",
      description:
        "Adds two or more values of the same numeric or vector type. Select the node and use + / − in the inspector to change the input count.",
      inputs: [
        genericPort("a", "A", "T", "arithmetic"),
        genericPort("b", "B", "T", "arithmetic")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: genericPort("a", "A", "T", "arithmetic")
      },
      outputs: [
        genericPort("result", "Result", "T", "arithmetic")
      ]
    },
    "math.subtract": {
      title: "Subtract",
      group: "Math",
      symbol: "−",
      description:
        "Subtracts B from A. Both ports must resolve to the same type.",
      inputs: [
        genericPort("a", "A", "T", "arithmetic"),
        genericPort("b", "B", "T", "arithmetic")
      ],
      outputs: [
        genericPort("result", "Result", "T", "arithmetic")
      ]
    },
    "math.multiply": {
      title: "Multiply",
      group: "Math",
      symbol: "×",
      description:
        "Multiplies two or more values of the same arithmetic type. Select the node and use + / − in the inspector to change the input count.",
      inputs: [
        genericPort("a", "A", "T", "arithmetic"),
        genericPort("b", "B", "T", "arithmetic")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: genericPort("a", "A", "T", "arithmetic")
      },
      outputs: [
        genericPort("result", "Result", "T", "arithmetic")
      ]
    },
    "math.divide": {
      title: "Divide",
      group: "Math",
      symbol: "÷",
      description:
        "Divides A by B. Both ports must resolve to the same arithmetic type.",
      inputs: [
        genericPort("a", "A", "T", "arithmetic"),
        genericPort("b", "B", "T", "arithmetic")
      ],
      outputs: [
        genericPort("result", "Result", "T", "arithmetic")
      ]
    },
    "math.minimum": {
      title: "Minimum",
      group: "Math",
      symbol: "min",
      description:
        "Returns the minimum of two or more scalar numeric values. Select the node and use + / − in the inspector to change the input count.",
      inputs: [
        genericPort("a", "A", "T", "scalar"),
        genericPort("b", "B", "T", "scalar")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: genericPort("a", "A", "T", "scalar")
      },
      outputs: [
        genericPort("result", "Result", "T", "scalar")
      ]
    },
    "math.maximum": {
      title: "Maximum",
      group: "Math",
      symbol: "max",
      description:
        "Returns the maximum of two or more scalar numeric values. Select the node and use + / − in the inspector to change the input count.",
      inputs: [
        genericPort("a", "A", "T", "scalar"),
        genericPort("b", "B", "T", "scalar")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: genericPort("a", "A", "T", "scalar")
      },
      outputs: [
        genericPort("result", "Result", "T", "scalar")
      ]
    },
    "math.clamp": {
      title: "Clamp",
      group: "Math",
      symbol: "↔",
      description:
        "Constrains a scalar numeric value between minimum and maximum.",
      inputs: [
        genericPort("value", "Value", "T", "scalar"),
        genericPort("min", "Minimum", "T", "scalar"),
        genericPort("max", "Maximum", "T", "scalar")
      ],
      outputs: [
        genericPort("result", "Result", "T", "scalar")
      ]
    },
    "math.negate": {
      title: "Negate",
      group: "Math",
      symbol: "±",
      description:
        "Inverts the sign of a numeric or vector value.",
      inputs: [
        genericPort("value", "Value", "T", "arithmetic")
      ],
      outputs: [
        genericPort("result", "Result", "T", "arithmetic")
      ]
    },
    "math.absolute": {
      title: "Absolute",
      group: "Math",
      symbol: "|x|",
      description:
        "Returns the absolute value of a scalar number.",
      inputs: [
        genericPort("value", "Value", "T", "scalar")
      ],
      outputs: [
        genericPort("result", "Result", "T", "scalar")
      ]
    },
    "math.lerp": {
      title: "Lerp",
      group: "Math",
      symbol: "L",
      description:
        "Interpolates between A and B using a float factor.",
      inputs: [
        genericPort("a", "A", "T", "interpolatable"),
        genericPort("b", "B", "T", "interpolatable"),
        port("t", "Factor", "float")
      ],
      outputs: [
        genericPort("result", "Result", "T", "interpolatable")
      ]
    },

    "logic.and": {
      title: "AND",
      group: "Logic",
      symbol: "∧",
      description:
        "True only when every Boolean input is true. Select the node and use + / − in the inspector to change the input count.",
      inputs: [
        port("a", "A", "bool"),
        port("b", "B", "bool")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: port("a", "A", "bool")
      },
      outputs: [
        port("result", "Result", "bool")
      ]
    },
    "logic.or": {
      title: "OR",
      group: "Logic",
      symbol: "∨",
      description:
        "True when at least one Boolean input is true. Select the node and use + / − in the inspector to change the input count.",
      inputs: [
        port("a", "A", "bool"),
        port("b", "B", "bool")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: port("a", "A", "bool")
      },
      outputs: [
        port("result", "Result", "bool")
      ]
    },
    "logic.not": {
      title: "NOT",
      group: "Logic",
      symbol: "¬",
      description:
        "Inverts a Boolean value.",
      inputs: [
        port("value", "Value", "bool")
      ],
      outputs: [
        port("result", "Result", "bool")
      ]
    },
    "logic.equal": {
      title: "Equal",
      group: "Logic",
      symbol: "=",
      description:
        "Compares two values. Both inputs must have exactly the same concrete type.",
      inputs: [
        genericPort("a", "A", "T", "value"),
        genericPort("b", "B", "T", "value")
      ],
      outputs: [
        port("result", "Result", "bool")
      ]
    },
    "logic.greater": {
      title: "Greater Than",
      group: "Logic",
      symbol: ">",
      description:
        "Compares two scalar numbers of the same type.",
      inputs: [
        genericPort("a", "A", "T", "ordered"),
        genericPort("b", "B", "T", "ordered")
      ],
      outputs: [
        port("result", "Result", "bool")
      ]
    },
    "logic.less": {
      title: "Less Than",
      group: "Logic",
      symbol: "<",
      description:
        "Compares two scalar numbers of the same type.",
      inputs: [
        genericPort("a", "A", "T", "ordered"),
        genericPort("b", "B", "T", "ordered")
      ],
      outputs: [
        port("result", "Result", "bool")
      ]
    },
    "logic.select": {
      title: "Select",
      group: "Logic",
      symbol: "?",
      description:
        "Selects one of two equally typed values using a Boolean condition.",
      inputs: [
        port("condition", "Condition", "bool"),
        genericPort("true", "True", "T", "value"),
        genericPort("false", "False", "T", "value")
      ],
      outputs: [
        genericPort("result", "Result", "T", "value")
      ]
    },

    "cast.doubleToFloat": {
      title: "Double To Float",
      group: "Conversions",
      symbol: "D→F",
      description:
        "Explicitly converts a double to a float.",
      inputs: [port("value", "Value", "double")],
      outputs: [port("result", "Result", "float")]
    },
    "cast.floatToInt": {
      title: "Float To Int",
      group: "Conversions",
      symbol: "F→I",
      description:
        "Explicitly converts a float to an int.",
      inputs: [port("value", "Value", "float")],
      outputs: [port("result", "Result", "int")]
    },
    "cast.toString": {
      title: "To String",
      group: "Conversions",
      symbol: "→T",
      description:
        "Converts a concrete value to text.",
      inputs: [
        genericPort("value", "Value", "T", "value")
      ],
      outputs: [port("result", "Result", "string")]
    },

    "resonite.onStart": {
      title: "On Engine Init",
      group: "Lifecycle",
      symbol: "▶",
      description:
        "Fires once from the generated mod's OnEngineInit method.",
      outputs: [port("impulse", "Impulse", "impulse")]
    },
    "resonite.impulseRelay": {
      title: "Impulse Reroute",
      group: "Flow",
      symbol: "↯",
      description:
        "Passes an impulse through without changing its type.",
      inputs: [port("in", "In", "impulse")],
      outputs: [port("out", "Out", "impulse")]
    },
    "resonite.valueRelay": {
      title: "Value Reroute",
      group: "Flow",
      symbol: "⇢",
      description:
        "Relays one concrete value type. The first connection binds the generic type.",
      inputs: [genericPort("value", "Value", "T", "value")],
      outputs: [genericPort("result", "Result", "T", "value")]
    },
    "resonite.displayValue": {
      title: "Display Value",
      group: "Debug & Output",
      symbol: "▣",
      description:
        "Displays the current typed value live. It is a terminal monitor with one input; branch it directly from an existing typed wire when the same value is needed elsewhere.",
      inputs: [genericPort("value", "Value", "T", "value")],
      outputs: [],
      displaysValue: true
    },
    "debug.displayImpulse": {
      title: "Display Impulse",
      group: "Debug & Output",
      symbol: "↯#",
      description:
        "A terminal impulse monitor. Every runtime call increments and publishes its counter.",
      inputs: [port("call", "Impulse", "impulse")],
      outputs: [],
      displaysImpulse: true,
      codegenCollect(api) {
        const token = api.token(api.node.id);
        api.addField(
          `${api.node.id}.impulseCount`,
          `private static long _impulseCount${token};`
        );
      },
      codegenAction(api) {
        const token = api.token(api.node.id);
        const label =
          api.node.label ||
          "Display Impulse";

        return `_impulseCount${token}++;\nPublishDisplay("${api.escapeString(label)}", _impulseCount${token});`;
      }
    },
    "resonite.store": {
      title: "Local State Store",
      group: "Flow",
      symbol: "S",
      description:
        "A local ProtoFlux-style mutable store with an explicitly selected value type.",
      configurableTypeVar: "T",
      configurableTypes: VALUE_TYPES,
      defaultType: "float",
      inputs: [
        port("write", "Write", "impulse"),
        genericPort("value", "Value", "T", "value")
      ],
      outputs: [
        port("written", "On Written", "impulse"),
        genericPort("current", "Current", "T", "value")
      ]
    },
    "resonite.packColorX": {
      title: "Pack ColorX",
      group: "Values",
      symbol: "CLR",
      description:
        "Packs RGBA float channels into colorX.",
      inputs: [
        port("r", "R", "float"),
        port("g", "G", "float"),
        port("b", "B", "float"),
        port("a", "A", "float")
      ],
      outputs: [port("value", "Color", "colorX")]
    },
    "resonite.unpackColorX": {
      title: "Unpack ColorX",
      group: "Values",
      symbol: "RGB",
      description:
        "Splits colorX into RGBA float channels.",
      inputs: [port("value", "Color", "colorX")],
      outputs: [
        port("r", "R", "float"),
        port("g", "G", "float"),
        port("b", "B", "float"),
        port("a", "A", "float")
      ]
    }
  };

  const OPERATOR_GROUP_ORDER = [
    "Values",
    "Math",
    "Logic",
    "Conversions",
    "Flow",
    "Lifecycle",
    "Debug & Output"
  ];

  const GRAPH_CODEGEN_PLUGINS = [];

  function registerGraphType(
    type,
    information = {}
  ) {
    const id = String(type || "").trim();

    if (!id) {
      throw new TypeError(
        "Graph type id must be a non-empty string."
      );
    }

    TYPE_INFO[id] = {
      label:
        information.label || id,
      short:
        information.short || id.slice(0, 4).toUpperCase(),
      color:
        information.color || "#9da8b4",
      ...information
    };

    if (
        information.valueType === true &&
        information.globalGenericCandidate !== false &&
        !VALUE_TYPES.includes(id)
    ) {
        VALUE_TYPES.push(id);
    }
  }

  function registerGraphGroup(
    group,
    options = {}
  ) {
    const name = String(group || "").trim();

    if (
      !name ||
      OPERATOR_GROUP_ORDER.includes(name)
    ) {
      return;
    }

    const before = String(
      options.before || ""
    ).trim();
    const after = String(
      options.after || ""
    ).trim();

    if (
      before &&
      OPERATOR_GROUP_ORDER.includes(before)
    ) {
      OPERATOR_GROUP_ORDER.splice(
        OPERATOR_GROUP_ORDER.indexOf(before),
        0,
        name
      );
      return;
    }

    if (
      after &&
      OPERATOR_GROUP_ORDER.includes(after)
    ) {
      OPERATOR_GROUP_ORDER.splice(
        OPERATOR_GROUP_ORDER.indexOf(after) + 1,
        0,
        name
      );
      return;
    }

    OPERATOR_GROUP_ORDER.push(name);
  }

  function registerGraphNode(
    operatorId,
    definition
  ) {
    const id = String(operatorId || "").trim();

    if (
      !id ||
      !definition ||
      typeof definition !== "object" ||
      Array.isArray(definition)
    ) {
      throw new TypeError(
        "A graph node requires an id and a definition object."
      );
    }

    OPERATOR_DEFINITIONS[id] =
      definition;

    const group =
      OPERATOR_DEFINITIONS[id].group;

    if (
      group &&
      !OPERATOR_GROUP_ORDER.includes(group)
    ) {
      registerGraphGroup(group);
    }
  }

  function registerGraphCodegenPlugin(
    plugin
  ) {
    if (
      !plugin ||
      typeof plugin !== "object" ||
      Array.isArray(plugin)
    ) {
      throw new TypeError(
        "A graph code-generation plugin must be an object."
      );
    }

    GRAPH_CODEGEN_PLUGINS.push(plugin);
  }

  Object.defineProperty(
    window,
    "RMLModNodeRegistry",
    {
      value: Object.freeze({
        version: 3,
        port,
        genericPort,
        registerType:
          registerGraphType,
        registerGroup:
          registerGraphGroup,
        registerNode:
          registerGraphNode,
        registerCodegenPlugin:
          registerGraphCodegenPlugin,
        getNodeDefinition(
          operatorId
        ) {
          return OPERATOR_DEFINITIONS[
            operatorId
          ] || null;
        },
        getTypeInformation(type) {
          return TYPE_INFO[
            typeBase(type)
          ] || null;
        },
        getNodeDefinitions() {
          return OPERATOR_DEFINITIONS;
        },
        getTypeDefinitions() {
          return TYPE_INFO;
        },
        getValueTypes() {
          return VALUE_TYPES;
        }
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  window.__rmlResolveNodeRegistryReady?.(
    window.RMLModNodeRegistry
  );

  let bridge = null;
  let graph = null;
  let currentAnalysis = null;
  let lastPersistedGraphJson = "";
  let persistTimer = 0;
  let graphMessageTimer = 0;
  let graphNodeSearchQuery = "";
  let graphNodeSearchIndex = -1;
  const GRAPH_SEARCHABLE_LIST_THRESHOLD = 8;
  const GRAPH_PANEL_LAYOUT_STORAGE_KEY =
    "rml-node-graph-panel-layout-v1";
  let graphLeftPanelCollapsed = false;
  let graphRightPanelCollapsed = false;
  let autoPanFrame = 0;
  let autoPanState = null;
  let activeInteraction = null;
  let paletteDragSuppressClickUntil = 0;
  let packedSnapshotSyncTimer = 0;
  const nodeBodyScrollPositions =
    new Map();
  let nodeBodyWireRefreshFrame = 0;
  let nodeResizeLimitRefreshFrame = 0;
  let lastNodeResizePress = null;
  const NODE_RESIZE_DOUBLE_CLICK_MS = 450;
  const NODE_RESIZE_DOUBLE_CLICK_DISTANCE = 8;
  let lastWirePointPress = null;
  let lastWireSegmentPress = null;
  const WIRE_DOUBLE_CLICK_MS = 450;
  const WIRE_DOUBLE_CLICK_DISTANCE = 8;

  const GRAPH_SCROLL_LAYER_CYCLE_THRESHOLD = 40;
  const GRAPH_SCROLL_LAYER_CYCLE_COOLDOWN_MS = 140;
  let graphScrollLayerSelection = null;
  let graphScrollLayerSelectionCandidates = null;
  let graphScrollLayerSession = null;
  let graphScrollLayerCycleAccumulator = 0;
  let graphScrollLayerCycleDirection = 0;
  let graphScrollLayerLastCycleAt = 0;
  let graphScrollLayerVisualFrame = 0;
  let graphScrollLayerVisualFollowFrame = 0;
  let graphScrollLayerIndicatorTimer = 0;
  let graphScrollLayerOutline = null;
  let graphScrollLayerIndicator = null;
  let graphRevealAnimationFrame = 0;

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
    toolbar: null,
    viewport: null,
    stage: null,
    wires: null,
    nodesHost: null,
    toast: null,
    sourceBadge: null,
    leftPanelToggle: null,
    rightPanelToggle: null
  };

  function clone(value) {
    return JSON.parse(
      JSON.stringify(value)
    );
  }

  function clamp(
    value,
    minimum,
    maximum
  ) {
    return Math.min(
      maximum,
      Math.max(minimum, value)
    );
  }

  function finiteNumber(
    value,
    fallback = 0
  ) {
    const number = Number(value);
    return Number.isFinite(number)
      ? number
      : fallback;
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;
  }

  function typeBase(type) {
    if (
      typeof type === "string" &&
      type.startsWith("enum:")
    ) {
      return "enum";
    }

    return type || "generic";
  }

  function typeInfo(type) {
    return (
      TYPE_INFO[typeBase(type)] ||
      TYPE_INFO.generic
    );
  }

  function typeLabel(type) {
    if (!type) {
      return "Unbound generic";
    }

    if (type.startsWith("enum:")) {
      return `Enum<${type.slice(5)}>`;
    }

    return typeInfo(type).label;
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
      serializable: "Serializable value"
    };

    return labels[constraint] || "Generic";
  }

  const SCALAR_NUMERIC_TYPES = Object.freeze([
    "int",
    "float",
    "double"
  ]);

  const NUMERIC_TYPE_RANK = Object.freeze({
    int: 0,
    float: 1,
    double: 2
  });

  const GRAPH_INT32_MIN = -2147483648;
  const GRAPH_INT32_MAX = 2147483647;
  const GRAPH_FLOAT32_MAX = 3.4028234663852886e38;

  function isScalarNumericType(type) {
    return Object.hasOwn(
      NUMERIC_TYPE_RANK,
      type
    );
  }

  function scalarNumericRank(type) {
    return isScalarNumericType(type)
      ? NUMERIC_TYPE_RANK[type]
      : -1;
  }

  function scalarNumericTypeAtRank(rank) {
    return SCALAR_NUMERIC_TYPES[
      clamp(
        Math.trunc(rank),
        0,
        SCALAR_NUMERIC_TYPES.length - 1
      )
    ];
  }

  function canImplicitlyConvertScalarNumber(
    fromType,
    toType
  ) {
    return (
      isScalarNumericType(fromType) &&
      isScalarNumericType(toType) &&
      scalarNumericRank(fromType) <=
        scalarNumericRank(toType)
    );
  }

  function promotedScalarNumericType(types) {
    const numeric = types.filter(
      isScalarNumericType
    );

    if (numeric.length === 0) {
      return null;
    }

    return scalarNumericTypeAtRank(
      Math.max(
        ...numeric.map(
          scalarNumericRank
        )
      )
    );
  }

  function definitionAllowsAutoType(
    definition
  ) {
    return Boolean(
      definition?.configurableTypeVar &&
      definition.allowAutoType !== false
    );
  }

  function graphNumberText(value) {
    let text = String(value ?? "")
      .trim()
      .replace(/[fFdD]$/, "");

    if (
      /^[+-]?\d+,\d+(?:[eE][+-]?\d+)?$/.test(
        text
      )
    ) {
      text = text.replace(",", ".");
    }

    return text;
  }

  function validateNumericValue(
    rawValue,
    type,
    options = {}
  ) {
    const coerce =
      options.coerce === true;
    const text =
      graphNumberText(rawValue);
    const pattern =
      /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/;

    if (!text || !pattern.test(text)) {
      return {
        valid: false,
        value: "0",
        number: 0,
        reason:
          "Enter one finite decimal number."
      };
    }

    let number = Number(text);

    if (!Number.isFinite(number)) {
      return {
        valid: false,
        value: "0",
        number: 0,
        reason:
          "The number must be finite."
      };
    }

    if (type === "int") {
      if (coerce) {
        number = clamp(
          Math.trunc(number),
          GRAPH_INT32_MIN,
          GRAPH_INT32_MAX
        );
      }

      if (
        !Number.isInteger(number) ||
        number < GRAPH_INT32_MIN ||
        number > GRAPH_INT32_MAX
      ) {
        return {
          valid: false,
          value: String(
            clamp(
              Math.trunc(number || 0),
              GRAPH_INT32_MIN,
              GRAPH_INT32_MAX
            )
          ),
          number,
          reason:
            "Integer values cannot contain decimal places and must fit in System.Int32."
        };
      }
    } else if (type === "float") {
      if (Math.abs(number) > GRAPH_FLOAT32_MAX) {
        return {
          valid: false,
          value: "0",
          number,
          reason:
            "The value is outside the System.Single range."
        };
      }
    } else if (type !== "double") {
      return {
        valid: false,
        value: "0",
        number,
        reason:
          `${typeLabel(type)} is not a scalar number type.`
      };
    }

    if (Object.is(number, -0)) {
      number = 0;
    }

    return {
      valid: true,
      value: String(number),
      number,
      reason: ""
    };
  }

  function numericVectorInfo(type) {
    const match = String(type || "").match(
      /^(int|float|double)([234])$/
    );

    return match
      ? {
          scalarType: match[1],
          componentCount:
            Number(match[2])
        }
      : null;
  }

  const AUTO_VECTOR_OPERATOR_IDS =
    Object.freeze([
      "vector.compose",
      "vector.decompose"
    ]);

  function isAutoVectorOperator(
    node
  ) {
    return Boolean(
      node?.kind === "operator" &&
      AUTO_VECTOR_OPERATOR_IDS.includes(
        node.operatorId
      ) &&
      node.parameters?.valueType ===
        "auto"
    );
  }

  function effectiveAutoVectorType(
    node
  ) {
    const configured =
      node?.parameters?.valueType;

    if (numericVectorInfo(configured)) {
      return configured;
    }

    const inferred =
      node?.parameters?.autoVectorType;

    if (numericVectorInfo(inferred)) {
      return inferred;
    }

    const definition =
      OPERATOR_DEFINITIONS[
        node?.operatorId
      ];
    const fallback =
      definition?.autoFallbackType ||
      fallbackTypeForDefinition(
        definition || {}
      );

    return numericVectorInfo(fallback)
      ? fallback
      : "float3";
  }

  function vectorComponentIndex(
    portId
  ) {
    return ["x", "y", "z", "w"]
      .indexOf(
        String(portId || "")
          .toLowerCase()
      );
  }

  function validateNumericVectorValue(
    rawValue,
    type,
    options = {}
  ) {
    const information =
      numericVectorInfo(type);

    if (!information) {
      return {
        valid: false,
        value: "0, 0",
        components: [],
        reason:
          `${typeLabel(type)} is not a supported numeric vector.`
      };
    }

    const rawComponents = String(rawValue ?? "")
      .split(",")
      .map(part => part.trim());

    if (
      rawComponents.length > information.componentCount &&
      options.coerce !== true
    ) {
      return {
        valid: false,
        value: String(rawValue ?? ""),
        components: [],
        reason:
          `${typeLabel(type)} accepts at most ${information.componentCount} components.`
      };
    }

    const components = rawComponents.slice(
      0,
      information.componentCount
    );

    while (components.length < information.componentCount) {
      components.push("0");
    }

    const normalized = [];

    for (const component of components) {
      const result = validateNumericValue(
        component || "0",
        information.scalarType,
        options
      );

      if (!result.valid) {
        return {
          valid: false,
          value: String(rawValue ?? ""),
          components: [],
          reason:
            `${typeLabel(type)}: ${result.reason}`
        };
      }

      normalized.push(result.value);
    }

    return {
      valid: true,
      value: normalized.join(", "),
      components: normalized,
      reason: ""
    };
  }

  function fallbackTypeForDefinition(definition) {
    const allowed =
      definition?.configurableTypes ||
      VALUE_TYPES;
    const fallback =
      definition?.autoFallbackType ||
      (definition?.defaultType &&
       definition.defaultType !== "auto"
        ? definition.defaultType
        : allowed[0]);

    return allowed.includes(fallback)
      ? fallback
      : allowed[0] || "float";
  }

  function normalizeGraphColorProfile(
    profile
  ) {
    return String(profile || "")
      .toLowerCase() === "srgb"
      ? "srgb"
      : "linear";
  }

  function graphEditorFloatLiteral(
    value
  ) {
    const number =
      Number.isFinite(Number(value))
        ? Number(value)
        : 0;
    const text = String(number);

    return /[.eE]/.test(text)
      ? `${text}f`
      : `${text}.0f`;
  }

  function graphColorXExpressionFromChannels(
    channels,
    profile = "linear",
    strength = 1
  ) {
    const safeStrength = clamp(
      Number(strength) || 1,
      1,
      10
    );
    const values =
      Array.isArray(channels)
        ? channels
        : [1, 1, 1, 1];
    const red =
      finiteNumber(values[0], 1) *
      safeStrength;
    const green =
      finiteNumber(values[1], 1) *
      safeStrength;
    const blue =
      finiteNumber(values[2], 1) *
      safeStrength;
    const alpha = clamp(
      finiteNumber(values[3], 1),
      0,
      1
    );
    const colorProfile =
      normalizeGraphColorProfile(profile) ===
        "srgb"
        ? "ColorProfile.sRGB"
        : "ColorProfile.Linear";

    return (
      "new colorX(new color(" +
      [red, green, blue, alpha]
        .map(graphEditorFloatLiteral)
        .join(", ") +
      `), ${colorProfile})`
    );
  }

  function normalizeColorConstantParameters(
    parameters
  ) {
    if (!parameters) {
      return parameters;
    }

    let value = String(
      parameters.value ||
        "colorX.White"
    ).trim();
    const hasProfile =
      typeof parameters.colorProfile ===
        "string";
    const profileMatch =
      value.match(
        /ColorProfile\.(sRGB|Linear)/
      );
    let profile = hasProfile
      ? normalizeGraphColorProfile(
          parameters.colorProfile
        )
      : profileMatch?.[1] === "sRGB"
        ? "srgb"
        : "linear";
    const hasStrength =
      Number.isFinite(
        Number(
          parameters.colorStrength
        )
      );
    let strength = hasStrength
      ? clamp(
          Number(
            parameters.colorStrength
          ),
          1,
          10
        )
      : 1;

    if (/^#[0-9a-fA-F]{6,8}$/.test(value)) {
      const channels =
        previewColorChannels(value);

      if (!hasProfile) {
        profile = "srgb";
      }

      value =
        graphColorXExpressionFromChannels(
          channels,
          profile,
          strength
        );
    } else if (!hasStrength) {
      const channels =
        previewColorChannels(value);
      strength = clamp(
        Math.max(
          1,
          Math.abs(
            finiteNumber(channels[0], 0)
          ),
          Math.abs(
            finiteNumber(channels[1], 0)
          ),
          Math.abs(
            finiteNumber(channels[2], 0)
          )
        ),
        1,
        10
      );
    }

    parameters.value =
      value || "colorX.White";
    parameters.colorProfile =
      profile;
    parameters.colorStrength =
      strength;

    return parameters;
  }

  function normalizeNodeParametersObject(
    parameters,
    definition,
    operatorId = "",
    coerce = true
  ) {
    if (
      !parameters ||
      typeof parameters !== "object" ||
      !definition
    ) {
      return parameters;
    }

    if (definition.configurableTypeVar) {
      const allowed =
        definition.configurableTypes ||
        VALUE_TYPES;
      const candidate = parameters.valueType;

      if (
        candidate === "auto" &&
        definitionAllowsAutoType(definition)
      ) {
        parameters.valueType = "auto";
      } else if (!allowed.includes(candidate)) {
        parameters.valueType =
          definition.defaultType === "auto" &&
          definitionAllowsAutoType(definition)
            ? "auto"
            : fallbackTypeForDefinition(definition);
      }
    }

    if (definition.parameterKind === "number") {
      const configured = parameters.valueType;
      const numericType = isScalarNumericType(configured)
        ? configured
        : fallbackTypeForDefinition(definition);
      const result = validateNumericValue(
        parameters.value ?? "0",
        numericType,
        {
          coerce:
            coerce && configured !== "auto"
        }
      );

      parameters.value = result.valid
        ? result.value
        : validateNumericValue(
            parameters.value ?? "0",
            "double",
            { coerce: true }
          ).value;
    }

    if (operatorId === "constant.vector") {
      const configured = parameters.valueType;
      const vectorType = numericVectorInfo(configured)
        ? configured
        : fallbackTypeForDefinition(definition);
      const result = validateNumericVectorValue(
        parameters.components || "0, 0, 0",
        vectorType,
        {
          coerce:
            coerce && configured !== "auto"
        }
      );

      if (result.valid) {
        parameters.components = result.value;
      }
    }

    if (operatorId === "constant.color") {
      normalizeColorConstantParameters(
        parameters
      );
    }

    if (
      AUTO_VECTOR_OPERATOR_IDS.includes(
        operatorId
      )
    ) {
      if (parameters.valueType === "auto") {
        const fallback =
          definition.autoFallbackType ||
          fallbackTypeForDefinition(
            definition
          );

        parameters.autoVectorType =
          numericVectorInfo(
            parameters.autoVectorType
          )
            ? parameters.autoVectorType
            : numericVectorInfo(fallback)
              ? fallback
              : "float3";
      } else {
        delete parameters.autoVectorType;
      }
    }

    for (
      const specification of
      Array.isArray(definition.parameters)
        ? definition.parameters
        : []
    ) {
      if (
        !specification ||
        specification.kind !== "number" ||
        typeof specification.key !== "string"
      ) {
        continue;
      }

      const numericType =
        specification.integer === true ||
        specification.numericType === "int"
          ? "int"
          : specification.numericType === "float"
            ? "float"
            : "double";
      const result = validateNumericValue(
        parameters[specification.key] ??
          specification.default ?? 0,
        numericType,
        { coerce }
      );
      let number = result.number;

      if (Number.isFinite(Number(specification.min))) {
        number = Math.max(number, Number(specification.min));
      }
      if (Number.isFinite(Number(specification.max))) {
        number = Math.min(number, Number(specification.max));
      }
      if (numericType === "int") {
        number = Math.trunc(number);
      }

      parameters[specification.key] =
        specification.storeAsNumber === true
          ? number
          : String(number);
    }

    return parameters;
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

  function nodeAllowsConcreteType(
    node,
    definition,
    type
  ) {
    if (node?.operatorId === "constant.number") {
      return validateNumericValue(
        node.parameters?.value ?? "0",
        type,
        { coerce: false }
      ).valid;
    }

    if (node?.operatorId === "constant.vector") {
      return validateNumericVectorValue(
        node.parameters?.components || "0, 0, 0",
        type,
        { coerce: false }
      ).valid;
    }

    return true;
  }

  function typeMatchesConstraint(
    type,
    constraint
  ) {
    if (!type) {
      return false;
    }

    const base = typeBase(type);
    const information =
      TYPE_INFO[base] || {};

    if (
      Array.isArray(
        information.constraints
      ) &&
      information.constraints.includes(
        constraint
      )
    ) {
      return true;
    }

    if (constraint === "enumOrString") {
        return (
            base === "string" ||
            base === "enum" ||
            String(type).startsWith("apiEnum:") ||
            information.enumType === true
        );
    }

    if (
      constraint === "value" ||
      constraint === "anyValue" ||
      constraint === "serializable"
    ) {
      return type !== "impulse";
    }

    if (constraint === "reference") {
      return Boolean(
        information.referenceType ||
        [
          "string",
          "Uri",
          "object"
        ].includes(base)
      );
    }

    if (
      constraint ===
        "reflectionMember"
    ) {
      return [
        "memberInfo",
        "methodInfo",
        "methodBase",
        "fieldInfo",
        "propertyInfo"
      ].includes(base);
    }

    if (
      constraint === "scalar" ||
      constraint === "ordered"
    ) {
      return [
        "int",
        "float",
        "double"
      ].includes(type);
    }

    if (constraint === "arithmetic") {
      return /^(?:int|float|double)(?:[234])?$/.test(
        type
      );
    }

    if (constraint === "interpolatable") {
      return [
        "float",
        "double",
        "float2",
        "float3",
        "float4",
        "double2",
        "double3",
        "double4",
        "colorX"
      ].includes(type);
    }

    return false;
  }

  function connectionTypesCompatible(
    fromType,
    toType
  ) {
    if (!fromType || !toType) {
      return false;
    }

    if (fromType === toType) {
      return true;
    }

    if (
      canImplicitlyConvertScalarNumber(
        fromType,
        toType
      )
    ) {
      return true;
    }

    const fromBase = typeBase(fromType);
    const toBase = typeBase(toType);
    const fromInformation = TYPE_INFO[fromBase] || {};
    const toInformation = TYPE_INFO[toBase] || {};

    if (
      toBase === "object" &&
      fromType !== "impulse"
    ) {
      return true;
    }

    if (
      toInformation.acceptsAnyValue === true &&
      fromType !== "impulse"
    ) {
      return true;
    }

    if (
      Array.isArray(fromInformation.assignableTo) &&
      (
        fromInformation.assignableTo.includes(toType) ||
        fromInformation.assignableTo.includes(toBase)
      )
    ) {
      return true;
    }

    if (
      Array.isArray(toInformation.acceptsTypes) &&
      (
        toInformation.acceptsTypes.includes(fromType) ||
        toInformation.acceptsTypes.includes(fromBase)
      )
    ) {
      return true;
    }

    return false;
  }

  function defaultGraphState() {
    return {
      version: GRAPH_SCHEMA_VERSION,
      active: false,
      sourceSignature: "",
      showAdvancedNodes: false,
      configSnapshot: null,
      nodes: [],
      connections: [],
      viewport: {
        x: 56,
        y: 54,
        scale: 0.9
      },
      selectedNodeId: null,
      selectedConnectionId: null,
      selectedWirePoint: null,
      nextSequence: 1
    };
  }


  function sanitizeWirePoints(
    rawPoints,
    connectionId
  ) {
    const points = [];
    const usedIds = new Set();

    for (
      const [index, source] of
      (Array.isArray(rawPoints)
        ? rawPoints
        : []).entries()
    ) {
      if (
        !source ||
        typeof source !== "object" ||
        Array.isArray(source)
      ) {
        continue;
      }

      let id =
        typeof source.id === "string" &&
        source.id.trim()
          ? source.id.trim()
          : `${connectionId}-point-${index + 1}`;

      while (usedIds.has(id)) {
        id = `${id}-${usedIds.size + 1}`;
      }

      usedIds.add(id);
      points.push({
        id,
        x: clamp(
          finiteNumber(source.x, 0),
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        ),
        y: clamp(
          finiteNumber(source.y, 0),
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        )
      });
    }

    return points;
  }

  function sanitizeBranchReference(source) {
    const branch = source?.branchFrom;

    if (
      !branch ||
      typeof branch !== "object" ||
      Array.isArray(branch) ||
      typeof branch.connectionId !== "string" ||
      typeof branch.pointId !== "string"
    ) {
      return null;
    }

    return {
      connectionId:
        branch.connectionId,
      pointId:
        branch.pointId
    };
  }

  function wirePointById(
    connection,
    pointId
  ) {
    return (
      Array.isArray(connection?.points)
        ? connection.points
        : []
    ).find(point =>
      point.id === pointId
    ) || null;
  }

  function selectedWirePointReference() {
    const selection =
      graph?.selectedWirePoint;

    if (
      !selection ||
      typeof selection.connectionId !==
        "string" ||
      typeof selection.pointId !==
        "string"
    ) {
      return null;
    }

    const connection =
      graphConnectionById(
        selection.connectionId
      );
    const point =
      wirePointById(
        connection,
        selection.pointId
      );

    return connection && point
      ? { connection, point }
      : null;
  }

  function clearSelectedWirePoint() {
    if (graph) {
      graph.selectedWirePoint = null;
    }
  }

  function normalizeSelectedWirePoint() {
    if (!graph?.selectedWirePoint) {
      return;
    }

    const selected =
      selectedWirePointReference();

    if (!selected) {
      graph.selectedWirePoint = null;
      return;
    }

    graph.selectedNodeId = null;
    graph.selectedConnectionId =
      selected.connection.id;
  }

  function branchReferenceCreatesCycle(
    connection,
    connectionsById
  ) {
    const visited = new Set([
      connection.id
    ]);
    let current = connection;

    while (current?.branchFrom) {
      const parent = connectionsById.get(
        current.branchFrom.connectionId
      );

      if (!parent) {
        return false;
      }

      if (visited.has(parent.id)) {
        return true;
      }

      visited.add(parent.id);
      current = parent;
    }

    return false;
  }

  function normalizeConnectionRouting(
    connections
  ) {
    const list = Array.isArray(connections)
      ? connections
      : [];
    const connectionsById = new Map(
      list.map(connection => [
        connection.id,
        connection
      ])
    );

    for (const connection of list) {
      connection.points =
        sanitizeWirePoints(
          connection.points,
          connection.id
        );

      const branch =
        sanitizeBranchReference(
          connection
        );

      if (!branch) {
        connection.branchFrom = null;
        continue;
      }

      const parent =
        connectionsById.get(
          branch.connectionId
        );
      const point =
        wirePointById(
          parent,
          branch.pointId
        );
      const sameSemanticSource =
        parent &&
        parent.fromNode ===
          connection.fromNode &&
        parent.fromPort ===
          connection.fromPort;

      connection.branchFrom =
        parent &&
        parent.id !== connection.id &&
        point &&
        sameSemanticSource
          ? branch
          : null;
    }

    for (const connection of list) {
      if (
        connection.branchFrom &&
        branchReferenceCreatesCycle(
          connection,
          connectionsById
        )
      ) {
        connection.branchFrom = null;
      }
    }

    return list;
  }

  function sanitizeGraphState(raw) {
    const result = defaultGraphState();

    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      return result;
    }

    result.active =
      raw.active === true;

    result.sourceSignature =
      typeof raw.sourceSignature === "string"
        ? raw.sourceSignature
        : "";

    result.showAdvancedNodes =
      raw.showAdvancedNodes === true;

    if (
      raw.configSnapshot &&
      typeof raw.configSnapshot === "object" &&
      !Array.isArray(raw.configSnapshot) &&
      Array.isArray(raw.configSnapshot.nodes)
    ) {
      result.configSnapshot = {
        metadata:
          raw.configSnapshot.metadata &&
          typeof raw.configSnapshot.metadata === "object"
            ? clone(raw.configSnapshot.metadata)
            : {},
        nodes:
          clone(raw.configSnapshot.nodes)
      };
    }

    const rawNodes =
      Array.isArray(raw.nodes)
        ? raw.nodes
        : [];

    const usedNodeIds = new Set();

    for (const source of rawNodes) {
      if (
        !source ||
        typeof source !== "object" ||
        Array.isArray(source) ||
        typeof source.id !== "string" ||
        usedNodeIds.has(source.id)
      ) {
        continue;
      }

      const kind =
        source.kind === "configuration"
          ? "configuration"
          : "operator";
      const parameters =
        source.parameters &&
        typeof source.parameters === "object" &&
        !Array.isArray(source.parameters)
          ? clone(source.parameters)
          : {};
      const operatorId =
        kind === "operator"
          ? source.operatorId
          : undefined;

      usedNodeIds.add(source.id);

      const definition =
        kind === "operator"
          ? OPERATOR_DEFINITIONS[
              operatorId
            ]
          : null;

      if (
        definition?.configurableTypeVar
      ) {
        const allowed =
          definition.configurableTypes ||
          VALUE_TYPES;
        const candidate = parameters.valueType;

        if (
          candidate === "auto" &&
          definitionAllowsAutoType(definition)
        ) {
          parameters.valueType = "auto";
        } else if (!allowed.includes(candidate)) {
          parameters.valueType =
            definition.defaultType === "auto" &&
            definitionAllowsAutoType(definition)
              ? "auto"
              : fallbackTypeForDefinition(definition);
        }
      }

      normalizePortLayoutParameter(
        parameters,
        definition,
        kind === "configuration"
      );

      normalizeNodeParametersObject(
        parameters,
        definition,
        operatorId || "",
        true
      );

      result.nodes.push({
        id: source.id,
        kind,
        operatorId:
          kind === "operator"
            ? operatorId
            : undefined,
        x: clamp(
          finiteNumber(source.x, 120),
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        ),
        y: clamp(
          finiteNumber(source.y, 100),
          -GRAPH_COORDINATE_LIMIT,
          GRAPH_COORDINATE_LIMIT
        ),
        width:
          Number.isFinite(Number(source.width)) &&
          Number(source.width) > 0
            ? clamp(
                Number(source.width),
                GRAPH_NODE_MIN_WIDTH,
                GRAPH_NODE_MAX_WIDTH
              )
            : null,
        height:
          Number.isFinite(Number(source.height)) &&
          Number(source.height) > 0
            ? clamp(
                Number(source.height),
                GRAPH_NODE_MIN_HEIGHT,
                GRAPH_NODE_MAX_HEIGHT
              )
            : null,
        label:
          typeof source.label === "string"
            ? source.label.slice(0, 120)
            : "",
        parameters
      });
    }

    const rawConnections =
      Array.isArray(raw.connections)
        ? raw.connections
        : [];

    const usedConnectionIds = new Set();

    for (const source of rawConnections) {
      if (
        !source ||
        typeof source !== "object" ||
        typeof source.id !== "string" ||
        usedConnectionIds.has(source.id) ||
        !usedNodeIds.has(source.fromNode) ||
        !usedNodeIds.has(source.toNode) ||
        typeof source.fromPort !== "string" ||
        typeof source.toPort !== "string"
      ) {
        continue;
      }

      usedConnectionIds.add(source.id);
      result.connections.push({
        id: source.id,
        fromNode: source.fromNode,
        fromPort: source.fromPort,
        toNode: source.toNode,
        toPort: source.toPort,
        points:
          sanitizeWirePoints(
            source.points,
            source.id
          ),
        branchFrom:
          sanitizeBranchReference(
            source
          )
      });
    }

    for (const node of result.nodes) {
      if (node.kind !== "operator") continue;
      const definition = OPERATOR_DEFINITIONS[node.operatorId];

      const inferLegacyVariadicCount = (direction, descriptor) => {
        if (!descriptor) return;
        const key = direction === "input"
          ? "variadicInputCount"
          : "variadicOutputCount";
        if (Number.isFinite(Number(node.parameters?.[key]))) {
          return;
        }

        let required = Number(descriptor.defaultCount) ||
          Number(descriptor.minimum) || 2;
        const legacyIds = Array.isArray(descriptor.ids)
          ? descriptor.ids.map(value => String(value || ""))
          : [];

        for (const connection of result.connections) {
          const applies = direction === "input"
            ? connection.toNode === node.id
            : connection.fromNode === node.id;
          if (!applies) continue;

          const portId = String(
            direction === "input"
              ? connection.toPort
              : connection.fromPort
          );
          const legacyIndex = legacyIds.indexOf(portId);
          if (legacyIndex >= 0) {
            required = Math.max(required, legacyIndex + 1);
            continue;
          }

          if (direction === "input") {
            if (/^[a-z]$/.test(portId)) {
              required = Math.max(required, portId.charCodeAt(0) - 96);
              continue;
            }
            const match = /^input(\d+)$/.exec(portId);
            if (match) required = Math.max(required, Number(match[1]));
          } else {
            const prefix = String(descriptor.idPrefix || "output");
            const match = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\d+)$`).exec(portId);
            if (match) required = Math.max(required, Number(match[1]));
          }
        }

        node.parameters[key] = clamp(
          required,
          Math.max(2, Number(descriptor.minimum) || 2),
          Math.max(2, Number(descriptor.maximum) || 64)
        );
      };

      inferLegacyVariadicCount("input", definition?.variadicInputs);
      inferLegacyVariadicCount("output", definition?.variadicOutputs);
    }

    normalizeConnectionRouting(
      result.connections
    );

    const availableConnectionIds =
      new Set(
        result.connections.map(
          connection =>
            connection.id
        )
      );

    const view =
      raw.viewport &&
      typeof raw.viewport === "object"
        ? raw.viewport
        : {};

    result.viewport = {
      x: finiteNumber(view.x, 56),
      y: finiteNumber(view.y, 54),
      scale: clamp(
        finiteNumber(view.scale, 0.9),
        GRAPH_MIN_ZOOM,
        GRAPH_MAX_ZOOM
      )
    };

    result.selectedNodeId =
      usedNodeIds.has(raw.selectedNodeId)
        ? raw.selectedNodeId
        : null;

    result.selectedConnectionId =
      availableConnectionIds.has(
        raw.selectedConnectionId
      )
        ? raw.selectedConnectionId
        : null;

    const selectedWirePoint =
      raw.selectedWirePoint;

    if (
      selectedWirePoint &&
      typeof selectedWirePoint ===
        "object" &&
      !Array.isArray(
        selectedWirePoint
      ) &&
      typeof selectedWirePoint
        .connectionId === "string" &&
      typeof selectedWirePoint
        .pointId === "string"
    ) {
      const selectedConnection =
        result.connections.find(
          connection =>
            connection.id ===
              selectedWirePoint
                .connectionId
        );
      const selectedPoint =
        wirePointById(
          selectedConnection,
          selectedWirePoint.pointId
        );

      if (selectedConnection && selectedPoint) {
        result.selectedWirePoint = {
          connectionId:
            selectedConnection.id,
          pointId: selectedPoint.id
        };
        result.selectedNodeId = null;
        result.selectedConnectionId =
          selectedConnection.id;
      }
    }

    result.nextSequence = Math.max(
      1,
      Math.trunc(
        finiteNumber(
          raw.nextSequence,
          result.nodes.length + 1
        )
      )
    );

    return result;
  }

  function graphSerializableState() {
    return {
      version: GRAPH_SCHEMA_VERSION,
      active: graph.active,
      sourceSignature:
        graph.sourceSignature,
      showAdvancedNodes:
        graph.showAdvancedNodes === true,
      configSnapshot:
        graph.configSnapshot
          ? clone(graph.configSnapshot)
          : null,
      nodes: graph.nodes.map(node => ({
        id: node.id,
        kind: node.kind,
        ...(node.kind === "operator"
          ? {
              operatorId:
                node.operatorId
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
        graph.connections.map(
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
        ...graph.viewport
      },
      selectedNodeId:
        graph.selectedNodeId,
      selectedConnectionId:
        graph.selectedConnectionId,
      selectedWirePoint:
        graph.selectedWirePoint
          ? {
              connectionId:
                graph.selectedWirePoint
                  .connectionId,
              pointId:
                graph.selectedWirePoint
                  .pointId
            }
          : null,
      nextSequence:
        graph.nextSequence
    };
  }

  function persistGraph(
    immediate = false
  ) {
    clearTimeout(persistTimer);

    const commit = () => {
      persistTimer = 0;
      typedGraphCodegenCacheKey = "";
      typedGraphCodegenCache = null;

      const value =
        graphSerializableState();

      lastPersistedGraphJson =
        JSON.stringify(value);

      bridge.setExtensionState(
        EXTENSION_NAME,
        value
      );

      bridge
        .requestGeneratedOutputRefresh
        ?.();
    };

    if (immediate) {
      commit();
    } else {
      persistTimer = window.setTimeout(
        commit,
        80
      );
    }
  }

  function hashText(value) {
    let hash = 2166136261;

    for (
      let index = 0;
      index < value.length;
      index += 1
    ) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(
        hash,
        16777619
      );
    }

    return (
      hash >>> 0
    )
      .toString(16)
      .padStart(8, "0");
  }

  function snapshotFromBuilder() {
    const state =
      bridge.getStateSnapshot();

    return {
      metadata:
        clone(state.metadata || {}),
      nodes:
        clone(state.nodes || [])
    };
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

  function flattenConfiguration(
    nodes,
    path = []
  ) {
    const entries = [];

    for (const node of nodes || []) {
      entries.push({
        node,
        path
      });

      if (node.kind === "controller") {
        for (const option of node.options || []) {
          entries.push(
            ...flattenConfiguration(
              option.children || [],
              [
                ...path,
                option.name || "Section"
              ]
            )
          );
        }
      }
    }

    return entries;
  }

  function configurationValueType(node) {
    if (node.kind === "controller") {
      return `enum:${
        node.enumName ||
        "SettingsPage"
      }`;
    }

    if (node.valueType === "enum") {
      return `enum:${
        node.enumName ||
        "SettingOption"
      }`;
    }

    return node.valueType || "string";
  }

  function configurationDefinition() {
    const snapshot =
      graph.configSnapshot ||
      snapshotFromBuilder();

    const metadata =
      snapshot.metadata || {};

    const outputs = [];

    for (
      const entry of
      flattenConfiguration(
        snapshot.nodes || []
      )
    ) {
      const node = entry.node;
      const path =
        entry.path.length > 0
          ? entry.path.join(" / ")
          : "Always visible";

      outputs.push(
        port(
          `config-${node.id}`,
          node.fieldName ||
            node.keyName ||
            "Setting",
          configurationValueType(node),
          {
            reaction:
              RUNTIME_BEHAVIORS[
                node.reaction
              ]
                ? node.reaction
                : "stored",
            detail:
              `${path} · ${
                node.keyName ||
                "configuration key"
              }`,
            sourceNodeId:
              node.id
          }
        )
      );
    }

    return {
      title:
        `Start · ${
          metadata.modName ||
          "Packed Configuration"
        }`,
      group: "Packed Configuration",
      symbol: "§",
      description:
        "Each configuration key is exposed exactly once as a typed reactive output. Connect it to value inputs to read the current value; Startup/Saved sockets can also connect directly to impulse inputs.",
      inputs: [],
      outputs,
      width: 390
    };
  }

  function isConfigurationReactionConnection(
    fromRef,
    toRef
  ) {
    return Boolean(
      fromRef?.direction === "output" &&
      fromRef.node?.kind ===
        "configuration" &&
      runtimeBehaviorEmitsImpulse(
        fromRef.spec?.reaction
      ) &&
      toRef?.direction === "input" &&
      toRef.spec?.type === "impulse"
    );
  }

  function nodeDefinition(node) {
    if (node.kind === "configuration") {
      return configurationDefinition();
    }

    const definition =
      OPERATOR_DEFINITIONS[
        node.operatorId
      ];

    if (
      node.operatorId ===
        "constant.typedDefault"
    ) {
      const valueType =
        String(
          node.parameters?.valueType ||
          "object"
        );

      return {
        ...definition,
        title:
          `Default · ${typeLabel(valueType)}`,
        description:
          `Exact ${typeLabel(valueType)} fallback value. Replace it with a real source whenever runtime data is required.`,
        outputs: [
          port(
            "value",
            "Value",
            valueType,
            {
              detail:
                `Exact default(${graphCsType(valueType)})`
            }
          )
        ]
      };
    }

    if (
      typeof definition?.resolveDefinition ===
        "function"
    ) {
      try {
        const resolved =
          definition.resolveDefinition(
            node
          );

        if (
          resolved &&
          typeof resolved === "object" &&
          !Array.isArray(resolved)
        ) {
          return {
            ...definition,
            ...resolved
          };
        }
      } catch (error) {
        console.error(
          `Dynamic node definition failed for ${node.operatorId}.`,
          error
        );
      }
    }

    return expandVariadicDefinition(node, definition);
  }

  function variadicCount(node, direction, descriptor) {
    const key = direction === "input"
      ? "variadicInputCount"
      : "variadicOutputCount";
    const minimum = Math.max(2, Number(descriptor?.minimum) || 2);
    const maximum = Math.max(minimum, Number(descriptor?.maximum) || 64);
    const fallback = Math.max(minimum, Number(descriptor?.defaultCount) || minimum);
    return clamp(
      Math.trunc(Number(node?.parameters?.[key]) || fallback),
      minimum,
      maximum
    );
  }

  function variadicPortLabel(index) {
    return index < 26
      ? String.fromCharCode(65 + index)
      : `Input ${index + 1}`;
  }

  function variadicPortId(index) {
    return index < 26
      ? String.fromCharCode(97 + index)
      : `input${index + 1}`;
  }

  function expandVariadicDefinition(node, definition) {
    if (!definition || node?.kind !== "operator") {
      return definition;
    }

    let inputs = definition.inputs || [];
    let outputs = definition.outputs || [];

    const inputDescriptor = definition.variadicInputs;
    if (inputDescriptor) {
      const count = variadicCount(node, "input", inputDescriptor);
      const template = inputDescriptor.template || inputs[0] || port("a", "A", "object");
      const preserved = Number(inputDescriptor.preserved || 0);
      const fixed = inputs.slice(0, preserved);
      const repeated = [];
      for (let index = 0; index < count; index += 1) {
        const id = inputDescriptor.idPrefix
          ? `${inputDescriptor.idPrefix}${index + 1}`
          : variadicPortId(index);
        const label = inputDescriptor.labelMode === "number"
          ? `${inputDescriptor.label || "Input"} ${index + 1}`
          : variadicPortLabel(index);
        repeated.push({
          ...template,
          id,
          label
        });
      }
      inputs = [...fixed, ...repeated];
    }

    const outputDescriptor = definition.variadicOutputs;
    if (outputDescriptor) {
      const count = variadicCount(node, "output", outputDescriptor);
      const template = outputDescriptor.template || outputs[0] || port("out1", "Output 1", "impulse");
      const preserved = Number(outputDescriptor.preserved || 0);
      const fixed = outputs.slice(0, preserved);
      const repeated = [];
      const configuredIds = Array.isArray(outputDescriptor.ids)
        ? outputDescriptor.ids
        : [];
      const configuredLabels = Array.isArray(outputDescriptor.labels)
        ? outputDescriptor.labels
        : [];
      for (let index = 0; index < count; index += 1) {
        repeated.push({
          ...template,
          id: configuredIds[index] ||
            `${outputDescriptor.idPrefix || "output"}${index + 1}`,
          label: configuredLabels[index] ||
            `${outputDescriptor.label || "Output"} ${index + 1}`
        });
      }
      outputs = [...fixed, ...repeated];
    }

    return {
      ...definition,
      inputs,
      outputs
    };
  }

  function variadicInputIds(node) {
    const definition = nodeDefinition(node);
    return (definition?.inputs || []).map(spec => spec.id);
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

  function variadicReduceCode(node, input, helperName, csType) {
    const ids = variadicInputIds(node);
    if (ids.length === 0) {
      return graphCsDefault("float");
    }
    let code = input(ids[0]).code;
    for (let index = 1; index < ids.length; index += 1) {
      code = `${helperName}<${csType}>(${code}, ${input(ids[index]).code})`;
    }
    return code;
  }

  function definitionHasSockets(
    definition
  ) {
    return Boolean(
      (definition?.inputs?.length || 0) > 0 ||
      (definition?.outputs?.length || 0) > 0
    );
  }

  function normalizePortLayoutParameter(
    parameters,
    definition,
    forceSupported = false
  ) {
    if (
      !parameters ||
      typeof parameters !== "object"
    ) {
      return parameters;
    }

    if (
      forceSupported ||
      definitionHasSockets(definition)
    ) {
      parameters.portLayout =
        parameters.portLayout === "mirrored"
          ? "mirrored"
          : "standard";
    } else {
      delete parameters.portLayout;
    }

    return parameters;
  }

  function serializableNodeParameters(
    node
  ) {
    const parameters =
      clone(node?.parameters || {});

    return normalizePortLayoutParameter(
      parameters,
      nodeDefinition(node),
      node?.kind === "configuration"
    );
  }

  function findGraphNode(nodeId) {
    return graph.nodes.find(
      node => node.id === nodeId
    ) || null;
  }

  function findPortSpec(
    nodeId,
    portId,
    direction
  ) {
    const node =
      findGraphNode(nodeId);

    if (!node) {
      return null;
    }

    const definition =
      nodeDefinition(node);

    const list =
      direction === "input"
        ? definition?.inputs || []
        : definition?.outputs || [];

    const spec =
      list.find(
        candidate =>
          candidate.id === portId
      );

    return spec
      ? {
          node,
          definition,
          spec,
          direction
        }
      : null;
  }

  function genericVariableKey(
    nodeId,
    typeVar
  ) {
    return `${nodeId}\u0000${typeVar}`;
  }

  function graphConcreteTypes() {
      const result = new Set(
          VALUE_TYPES
      );

      for (const node of graph.nodes) {
          const definition =
              nodeDefinition(node);

          for (const spec of [
              ...(definition?.inputs || []),
              ...(definition?.outputs || [])
          ]) {
              if (
                  spec.type &&
                  spec.type !== "generic" &&
                  spec.type !== "auto"
              ) {
                  result.add(spec.type);
              }
          }
      }

      return [...result];
  }

  function genericVariableDefault(variable) {
    const constraints = variable.specs.map(
      spec => spec.constraint || "value"
    );

    if (
      constraints.some(constraint =>
        [
          "scalar",
          "ordered",
          "arithmetic",
          "interpolatable"
        ].includes(constraint)
      )
    ) {
      return "float";
    }

    if (variable.domain.has("object")) {
      return "object";
    }

    return variable.domain.has("string")
      ? "string"
      : [...variable.domain][0] || null;
  }

  function numericPreferenceFromConstant(variable) {
    if (variable.node.operatorId === "constant.number") {
      const parsed = validateNumericValue(
        variable.node.parameters?.value ?? "0",
        "double",
        { coerce: false }
      );

      if (!parsed.valid) {
        return [];
      }

      return Number.isInteger(parsed.number) &&
        parsed.number >= GRAPH_INT32_MIN &&
        parsed.number <= GRAPH_INT32_MAX
          ? ["int", "float", "double"]
          : ["float", "double"];
    }

    if (variable.node.operatorId === "constant.vector") {
      const raw = String(
        variable.node.parameters?.components || "0, 0, 0"
      );
      const componentCount = clamp(
        raw.split(",").length,
        2,
        4
      );
      const allIntegers = raw
        .split(",")
        .map(part => part.trim())
        .every(part =>
          validateNumericValue(
            part || "0",
            "int",
            { coerce: false }
          ).valid
        );
      const families = allIntegers
        ? ["int", "float", "double"]
        : ["float", "double"];

      return families.map(
        family => `${family}${componentCount}`
      );
    }

    return [];
  }

  function typeSortValue(type) {
    const scalarRank = scalarNumericRank(type);
    if (scalarRank >= 0) {
      return scalarRank;
    }

    const vector = numericVectorInfo(type);
    if (vector) {
      return 10 +
        vector.componentCount * 3 +
        scalarNumericRank(vector.scalarType);
    }

    const preferred = [
      "bool",
      "string",
      "Uri",
      "colorX",
      "object"
    ];
    const index = preferred.indexOf(type);
    return index >= 0
      ? 100 + index
      : 1000;
  }

  function variableCandidateOrder(variable) {
    const ordered = [];
    const add = value => {
      if (
        value &&
        variable.domain.has(value) &&
        !ordered.includes(value)
      ) {
        ordered.push(value);
      }
    };

    add(variable.explicitType);

    const incomingPromotion = promotedScalarNumericType(
      variable.incomingFixed
    );
    add(incomingPromotion);
    for (const type of variable.incomingFixed) {
      add(type);
    }

    const outgoingNumeric = variable.outgoingFixed.filter(
      isScalarNumericType
    );
    if (outgoingNumeric.length > 0) {
      add(
        scalarNumericTypeAtRank(
          Math.min(
            ...outgoingNumeric.map(scalarNumericRank)
          )
        )
      );
    }
    for (const type of variable.outgoingFixed) {
      add(type);
    }

    const hasFixedEvidence =
      variable.incomingFixed.length > 0 ||
      variable.outgoingFixed.length > 0;

    if (!hasFixedEvidence) {
      add(variable.fallbackType);
    }

    for (const type of numericPreferenceFromConstant(variable)) {
      add(type);
    }

    add(variable.fallbackType);
    add(genericVariableDefault(variable));

    for (
      const type of [...variable.domain].sort(
        (left, right) =>
          typeSortValue(left) - typeSortValue(right) ||
          typeLabel(left).localeCompare(typeLabel(right))
      )
    ) {
      add(type);
    }

    return ordered;
  }

  function analyzeConnections(connections) {
    const concreteTypes = graphConcreteTypes();
    const variables = new Map();

    for (const node of graph.nodes) {
      const definition = nodeDefinition(node);
      const grouped = new Map();

      for (const spec of [
        ...(definition?.inputs || []),
        ...(definition?.outputs || [])
      ]) {
        if (!spec.typeVar) {
          continue;
        }
        const list = grouped.get(spec.typeVar) || [];
        list.push(spec);
        grouped.set(spec.typeVar, list);
      }

      for (const [typeVar, specs] of grouped) {
        const key = genericVariableKey(node.id, typeVar);
        const configurable =
          definition?.configurableTypeVar === typeVar;
        const allowed = configurable
          ? definition.configurableTypes || VALUE_TYPES
          : concreteTypes;
        const configured = configurable
          ? node.parameters?.valueType
          : null;
        const explicitType =
          configured &&
          configured !== "auto" &&
          allowed.includes(configured)
            ? configured
            : null;
        const domain = new Set(
          (explicitType ? [explicitType] : allowed).filter(
            type =>
              type &&
              type !== "generic" &&
              type !== "auto" &&
              specs.every(spec =>
                typeMatchesConstraint(
                  type,
                  spec.constraint || "value"
                )
              ) &&
              nodeAllowsConcreteType(
                node,
                definition,
                type
              )
          )
        );

        if (domain.size === 0) {
          return {
            valid: false,
            reason:
              node.operatorId === "constant.number"
                ? `Number Constant value ${String(node.parameters?.value ?? "")} is not valid for the selected numeric type.`
                : node.operatorId === "constant.vector"
                  ? "Vector Constant components are not valid for the selected vector type."
                  : `${definition?.title || "Node"} has no valid concrete type for generic ${typeVar}.`,
            bindings: new Map()
          };
        }

        variables.set(key, {
          key,
          node,
          definition,
          typeVar,
          specs,
          domain,
          explicitType,
          fallbackType:
            configurable
              ? fallbackTypeForDefinition(definition)
              : null,
          incomingFixed: [],
          outgoingFixed: []
        });
      }
    }

    const termFor = portRef => {
      if (portRef.spec.type) {
        return {
          fixed: true,
          type: portRef.spec.type,
          portRef
        };
      }

      if (portRef.spec.typeVar) {
        const key = genericVariableKey(
          portRef.node.id,
          portRef.spec.typeVar
        );
        return {
          fixed: false,
          key,
          variable: variables.get(key),
          portRef
        };
      }

      return null;
    };

    const edges = [];

    for (const connection of connections) {
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

      if (!fromRef || !toRef) {
        return {
          valid: false,
          reason:
            "A connection references a missing node or port.",
          bindings: new Map()
        };
      }

      const targetIsImpulse =
        toRef.spec?.type ===
          "impulse";
      const sourceIsConfiguration =
        fromRef.node?.kind ===
          "configuration";
      const reactiveConfigurationEdge =
        isConfigurationReactionConnection(
          fromRef,
          toRef
        );

      if (
        sourceIsConfiguration &&
        targetIsImpulse &&
        !reactiveConfigurationEdge
      ) {
        return {
          valid: false,
          reason:
            `${fromRef.definition.title} · ${fromRef.spec.label} is Stored only and cannot trigger an impulse. Select Startup, Saved or Startup + Saved in the Configuration Outline.`,
          bindings: new Map()
        };
      }

      const from =
        reactiveConfigurationEdge
          ? {
              fixed: true,
              type: "impulse",
              portRef: fromRef
            }
          : termFor(fromRef);
      const to = termFor(toRef);
      if (!from || !to) {
        return {
          valid: false,
          reason:
            "A connection references an unresolved port type.",
          bindings: new Map()
        };
      }

      const edge = {
        connection,
        from,
        to,
        reactiveConfigurationEdge
      };
      edges.push(edge);

      if (!from.fixed && to.fixed) {
        from.variable?.outgoingFixed.push(to.type);
      }
      if (from.fixed && !to.fixed) {
        to.variable?.incomingFixed.push(from.type);
      }
    }

    const valuesFor = term =>
      term.fixed
        ? [term.type]
        : [...term.variable.domain];

    let changed = true;
    let pass = 0;

    while (changed && pass < 256) {
      changed = false;
      pass += 1;

      for (const edge of edges) {
        const fromValues = valuesFor(edge.from);
        const toValues = valuesFor(edge.to);

        if (
          !fromValues.some(fromType =>
            toValues.some(toType =>
              connectionTypesCompatible(fromType, toType)
            )
          )
        ) {
          return {
            valid: false,
            reason:
              `No safe type can connect ${edge.from.portRef.definition.title} · ${edge.from.portRef.spec.label} to ${edge.to.portRef.definition.title} · ${edge.to.portRef.spec.label}. Narrowing conversions require an explicit conversion node.`,
            bindings: new Map()
          };
        }

        if (!edge.from.fixed) {
          for (const type of fromValues) {
            if (
              !toValues.some(toType =>
                connectionTypesCompatible(type, toType)
              )
            ) {
              edge.from.variable.domain.delete(type);
              changed = true;
            }
          }
        }

        if (!edge.to.fixed) {
          const latestFromValues = valuesFor(edge.from);
          for (const type of toValues) {
            if (
              !latestFromValues.some(fromType =>
                connectionTypesCompatible(fromType, type)
              )
            ) {
              edge.to.variable.domain.delete(type);
              changed = true;
            }
          }
        }

        if (
          (!edge.from.fixed && edge.from.variable.domain.size === 0) ||
          (!edge.to.fixed && edge.to.variable.domain.size === 0)
        ) {
          return {
            valid: false,
            reason:
              `The connection between ${edge.from.portRef.definition.title} and ${edge.to.portRef.definition.title} leaves no valid concrete type.`,
            bindings: new Map()
          };
        }
      }
    }

    const edgesByVariable = new Map();
    for (const key of variables.keys()) {
      edgesByVariable.set(key, []);
    }
    for (const edge of edges) {
      if (!edge.from.fixed) {
        edgesByVariable.get(edge.from.key)?.push(edge);
      }
      if (!edge.to.fixed) {
        edgesByVariable.get(edge.to.key)?.push(edge);
      }
    }

    const assignments = new Map();
    const candidateOrders = new Map(
      [...variables].map(([key, variable]) => [
        key,
        variableCandidateOrder(variable)
      ])
    );
    let solveSteps = 0;

    const termAssignedType = (
      term,
      candidateKey = null,
      candidateType = null
    ) => {
      if (term.fixed) {
        return term.type;
      }
      if (term.key === candidateKey) {
        return candidateType;
      }
      return assignments.get(term.key) || null;
    };

    const candidateFitsAssignedEdges = (key, candidate) => {
      for (const edge of edgesByVariable.get(key) || []) {
        const fromType = termAssignedType(
          edge.from,
          key,
          candidate
        );
        const toType = termAssignedType(
          edge.to,
          key,
          candidate
        );

        if (
          fromType &&
          toType &&
          !connectionTypesCompatible(fromType, toType)
        ) {
          return false;
        }
      }
      return true;
    };

    const everyUnassignedNeighborHasCandidate = key => {
      for (const edge of edgesByVariable.get(key) || []) {
        const other =
          !edge.from.fixed && edge.from.key !== key
            ? edge.from
            : !edge.to.fixed && edge.to.key !== key
              ? edge.to
              : null;

        if (!other || assignments.has(other.key)) {
          continue;
        }

        const possible = candidateOrders.get(other.key)?.some(
          candidate =>
            candidateFitsAssignedEdges(other.key, candidate)
        );

        if (!possible) {
          return false;
        }
      }
      return true;
    };

    const connectedVariableKeys = [...variables.keys()].filter(
      key => (edgesByVariable.get(key) || []).length > 0
    );

    const solve = () => {
      solveSteps += 1;
      if (solveSteps > 200000) {
        return false;
      }

      const remaining = connectedVariableKeys.filter(
        key => !assignments.has(key)
      );
      if (remaining.length === 0) {
        return true;
      }

      let selectedKey = null;
      let selectedCandidates = null;

      for (const key of remaining) {
        const preferred = [];
        const addPreferred = type => {
          if (type && !preferred.includes(type)) {
            preferred.push(type);
          }
        };
        const assignedIncoming = [];
        const assignedOutgoing = [];

        for (const edge of edgesByVariable.get(key) || []) {
          if (!edge.to.fixed && edge.to.key === key) {
            const sourceType = edge.from.fixed
              ? edge.from.type
              : assignments.get(edge.from.key);
            if (sourceType) assignedIncoming.push(sourceType);
          }
          if (!edge.from.fixed && edge.from.key === key) {
            const targetType = edge.to.fixed
              ? edge.to.type
              : assignments.get(edge.to.key);
            if (targetType) assignedOutgoing.push(targetType);
          }
        }

        addPreferred(
          promotedScalarNumericType(assignedIncoming)
        );
        for (const type of assignedIncoming) addPreferred(type);

        const outgoingNumeric = assignedOutgoing.filter(
          isScalarNumericType
        );
        if (outgoingNumeric.length > 0) {
          addPreferred(
            scalarNumericTypeAtRank(
              Math.min(...outgoingNumeric.map(scalarNumericRank))
            )
          );
        }
        for (const type of assignedOutgoing) addPreferred(type);

        const candidates = [
          ...preferred,
          ...(candidateOrders.get(key) || [])
        ]
          .filter(
            (candidate, index, array) =>
              array.indexOf(candidate) === index
          )
          .filter(candidate =>
            candidateFitsAssignedEdges(key, candidate)
          );

        if (candidates.length === 0) {
          return false;
        }

        if (
          !selectedCandidates ||
          candidates.length < selectedCandidates.length
        ) {
          selectedKey = key;
          selectedCandidates = candidates;
        }
      }

      for (const candidate of selectedCandidates || []) {
        assignments.set(selectedKey, candidate);
        if (
          everyUnassignedNeighborHasCandidate(selectedKey) &&
          solve()
        ) {
          return true;
        }
        assignments.delete(selectedKey);
      }

      return false;
    };

    if (!solve()) {
      return {
        valid: false,
        reason:
          "No safe concrete type assignment satisfies all connected generic ports. Add an explicit conversion or select a concrete node type.",
        bindings: new Map()
      };
    }

    for (const [key, variable] of variables) {
      if (!assignments.has(key)) {
        const fallback = variableCandidateOrder(variable)[0];
        if (fallback) assignments.set(key, fallback);
      }
    }

    const bindings = new Map(
      graph.nodes.map(node => [node.id, {}])
    );
    for (const [key, variable] of variables) {
      bindings.get(variable.node.id)[variable.typeVar] =
        assignments.get(key) || null;
    }

    for (const edge of edges) {
      const fromType = edge.from.fixed
        ? edge.from.type
        : assignments.get(edge.from.key);
      const toType = edge.to.fixed
        ? edge.to.type
        : assignments.get(edge.to.key);

      if (!connectionTypesCompatible(fromType, toType)) {
        return {
          valid: false,
          reason:
            `${typeLabel(fromType)} cannot safely connect to ${typeLabel(toType)}.`,
          bindings
        };
      }
    }

    return {
        valid: true,
        reason: "",
        bindings
    };
  }

  function resolvePortType(
    portRef,
    bindings
  ) {
    if (!portRef) {
      return null;
    }
    if (portRef.spec.type) {
      return portRef.spec.type;
    }
    if (portRef.spec.typeVar) {
      return (
        bindings.get(portRef.node.id)?.[
          portRef.spec.typeVar
        ] || null
      );
    }
    return null;
  }

  function concretePortTypeForAnalysis(
    nodeId,
    portId,
    direction,
    analysis
  ) {
    const reference =
      findPortSpec(
        nodeId,
        portId,
        direction
      );

    if (!reference) {
      return null;
    }

    const bound =
      reference.spec.type ||
      analysis?.bindings
        ?.get(reference.node.id)?.[
          reference.spec.typeVar
        ] ||
      null;

    if (bound) {
      return bound;
    }

    if (
      reference.spec.typeVar &&
      reference.definition
        ?.configurableTypeVar ===
          reference.spec.typeVar
    ) {
      const configured =
        reference.node.parameters
          ?.valueType;

      if (
        configured &&
        configured !== "auto"
      ) {
        return configured;
      }

      if (
        isAutoVectorOperator(
          reference.node
        )
      ) {
        return effectiveAutoVectorType(
          reference.node
        );
      }

      const fallback =
        reference.definition
          .autoFallbackType ||
        fallbackTypeForDefinition(
          reference.definition
        );

      return fallback || null;
    }

    return null;
  }

  function inferAutoVectorType(
    node,
    connections,
    analysis = null
  ) {
    if (!isAutoVectorOperator(node)) {
      return null;
    }

    const currentType =
      effectiveAutoVectorType(node);
    const current =
      numericVectorInfo(currentType) ||
      numericVectorInfo("float3");
    const exactVectorTypes = [];
    const scalarInputTypes = [];
    const scalarOutputTypes = [];
    let minimumDimension =
      current.componentCount;

    for (const connection of connections) {
      if (node.operatorId === "vector.compose") {
        if (
          connection.fromNode === node.id &&
          connection.fromPort === "value"
        ) {
          const type =
            concretePortTypeForAnalysis(
              connection.toNode,
              connection.toPort,
              "input",
              analysis
            );

          if (numericVectorInfo(type)) {
            exactVectorTypes.push(type);
          }
        }

        if (connection.toNode === node.id) {
          const index =
            vectorComponentIndex(
              connection.toPort
            );

          if (index >= 0) {
            minimumDimension = Math.max(
              minimumDimension,
              index + 1,
              2
            );

            const type =
              concretePortTypeForAnalysis(
                connection.fromNode,
                connection.fromPort,
                "output",
                analysis
              );

            if (isScalarNumericType(type)) {
              scalarInputTypes.push(type);
            }
          }
        }
      } else if (
        node.operatorId ===
          "vector.decompose"
      ) {
        if (
          connection.toNode === node.id &&
          connection.toPort === "value"
        ) {
          const type =
            concretePortTypeForAnalysis(
              connection.fromNode,
              connection.fromPort,
              "output",
              analysis
            );

          if (numericVectorInfo(type)) {
            exactVectorTypes.push(type);
          }
        }

        if (connection.fromNode === node.id) {
          const index =
            vectorComponentIndex(
              connection.fromPort
            );

          if (index >= 0) {
            minimumDimension = Math.max(
              minimumDimension,
              index + 1,
              2
            );

            const type =
              concretePortTypeForAnalysis(
                connection.toNode,
                connection.toPort,
                "input",
                analysis
              );

            if (isScalarNumericType(type)) {
              scalarOutputTypes.push(type);
            }
          }
        }
      }
    }

    const uniqueExact = [
      ...new Set(exactVectorTypes)
    ];

    if (uniqueExact.length === 1) {
      return uniqueExact[0];
    }

    if (uniqueExact.length > 1) {
      return currentType;
    }

    let scalarType =
      current.scalarType;

    if (
      node.operatorId ===
        "vector.compose" &&
      scalarInputTypes.length > 0
    ) {
      scalarType =
        promotedScalarNumericType(
          scalarInputTypes
        ) || scalarType;
    } else if (
      node.operatorId ===
        "vector.decompose" &&
      scalarOutputTypes.length > 0
    ) {
      scalarType =
        scalarNumericTypeAtRank(
          Math.min(
            ...scalarOutputTypes.map(
              scalarNumericRank
            )
          )
        );
    }

    return `${scalarType}${clamp(
      minimumDimension,
      2,
      4
    )}`;
  }

  function analyzeWithAutoVectors(
    connections,
    seedAnalysis = null
  ) {
    const automaticNodes =
      graph.nodes.filter(
        isAutoVectorOperator
      );
    const snapshots =
      new Map(
        automaticNodes.map(node => [
          node.id,
          {
            hadValue:
              Object.hasOwn(
                node.parameters,
                "autoVectorType"
              ),
            value:
              node.parameters
                .autoVectorType
          }
        ])
      );
    let analysis =
      seedAnalysis?.valid
        ? seedAnalysis
        : null;

    try {
      for (
        let pass = 0;
        pass < 8;
        pass += 1
      ) {
        let changed = false;

        for (const node of automaticNodes) {
          const inferred =
            inferAutoVectorType(
              node,
              connections,
              analysis
            );

          if (
            inferred &&
            inferred !==
              node.parameters
                .autoVectorType
          ) {
            node.parameters
              .autoVectorType =
              inferred;
            changed = true;
          }
        }

        analysis =
          analyzeConnections(
            connections
          );

        if (!changed) {
          break;
        }
      }

      const updates =
        new Map(
          automaticNodes.map(node => [
            node.id,
            effectiveAutoVectorType(node)
          ])
        );

      return {
        analysis:
          analysis ||
          analyzeConnections(
            connections
          ),
        updates
      };
    } finally {
      for (const node of automaticNodes) {
        const snapshot =
          snapshots.get(node.id);

        if (snapshot?.hadValue) {
          node.parameters
            .autoVectorType =
            snapshot.value;
        } else {
          delete node.parameters
            .autoVectorType;
        }
      }
    }
  }

  function applyAutoVectorUpdates(
    updates
  ) {
    if (!(updates instanceof Map)) {
      return;
    }

    for (const [nodeId, type] of updates) {
      const node =
        findGraphNode(nodeId);

      if (
        isAutoVectorOperator(node) &&
        numericVectorInfo(type)
      ) {
        node.parameters.autoVectorType =
          type;
      }
    }
  }

  function synchronizeAutoVectorTypes(
    connections,
    seedAnalysis = null
  ) {
    const result =
      analyzeWithAutoVectors(
        connections,
        seedAnalysis
      );

    applyAutoVectorUpdates(
      result.updates
    );

    return result.analysis;
  }

  function pathExists(
    adjacency,
    start,
    target,
    visited = new Set()
  ) {
    if (start === target) {
      return true;
    }

    if (visited.has(start)) {
      return false;
    }

    visited.add(start);

    for (
      const next of
      adjacency.get(start) || []
    ) {
      if (
        pathExists(
          adjacency,
          next,
          target,
          visited
        )
      ) {
        return true;
      }
    }

    return false;
  }

  function wouldCreateCycle(
    connections,
    candidate
  ) {
    if (
      candidate.fromNode ===
      candidate.toNode
    ) {
      return true;
    }

    const adjacency = new Map();

    for (const connection of [
      ...connections,
      candidate
    ]) {
      const sourceNode =
        graph?.nodes?.find(
          node =>
            node.id ===
            connection.fromNode
        );

      if (
        sourceNode?.kind === "operator" &&
        sourceNode.operatorId ===
          "resonite.store" &&
        connection.fromPort === "current"
      ) {
        continue;
      }

      const list =
        adjacency.get(
          connection.fromNode
        ) || [];
      list.push(
        connection.toNode
      );
      adjacency.set(
        connection.fromNode,
        list
      );
    }

    return pathExists(
      adjacency,
      candidate.toNode,
      candidate.fromNode
    );
  }

  function normalizedEndpoints(
    first,
    second
  ) {
    if (
      first.direction === "output" &&
      second.direction === "input"
    ) {
      return {
        from: first,
        to: second
      };
    }

    if (
      first.direction === "input" &&
      second.direction === "output"
    ) {
      return {
        from: second,
        to: first
      };
    }

    return null;
  }

  function connectionProposal(
    first,
    second,
    baseConnections = graph.connections
  ) {
    const endpoints =
      normalizedEndpoints(
        first,
        second
      );

    if (!endpoints) {
      return {
        valid: false,
        reason:
          "Connect an output socket to an input socket."
      };
    }

    if (
      endpoints.from.nodeId ===
      endpoints.to.nodeId
    ) {
      return {
        valid: false,
        reason:
          "A node cannot connect directly to itself."
      };
    }

    const candidate = {
      id: makeId("wire"),
      fromNode:
        endpoints.from.nodeId,
      fromPort:
        endpoints.from.portId,
      toNode:
        endpoints.to.nodeId,
      toPort:
        endpoints.to.portId
    };

    const withoutCurrentInput =
      baseConnections.filter(
        connection =>
          !(
            connection.toNode ===
              candidate.toNode &&
            connection.toPort ===
              candidate.toPort
          )
      );

    if (
      wouldCreateCycle(
        withoutCurrentInput,
        candidate
      )
    ) {
      return {
        valid: false,
        reason:
          "This wire would create a dependency cycle."
      };
    }

    const nextConnections = [
      ...withoutCurrentInput,
      candidate
    ];

    const inferred =
      analyzeWithAutoVectors(
        nextConnections,
        currentAnalysis
      );
    const analysis =
      inferred.analysis;

    return {
      valid: analysis.valid,
      reason: analysis.reason,
      candidate,
      nextConnections,
      analysis,
      autoVectorUpdates:
        inferred.updates
    };
  }

  function hasMissingOperatorDefinitions() {
    return graph.nodes.some(
      node =>
        node.kind === "operator" &&
        (
          typeof node.operatorId !== "string" ||
          !Object.hasOwn(
            OPERATOR_DEFINITIONS,
            node.operatorId
          )
        )
    );
  }

  function pruneConnections() {
    if (hasMissingOperatorDefinitions()) {
      return;
    }

    if (graph.connections.length === 0) {
      currentAnalysis =
        synchronizeAutoVectorTypes(
          graph.connections,
          currentAnalysis
        );

      return;
    }

    const wholeGraph =
        analyzeWithAutoVectors(
            graph.connections,
            currentAnalysis
        );

    if (wholeGraph.analysis.valid) {
        if (
            Array.isArray(wholeGraph.updates) &&
            wholeGraph.updates.length > 0
        ) {
            for (const update of wholeGraph.updates) {
                if (
                    update?.node &&
                    update.type
                ) {
                    update.node.parameters.autoVectorType =
                        update.type;
                }
            }
        }

        currentAnalysis =
            synchronizeAutoVectorTypes(
                graph.connections,
                wholeGraph.analysis
            );

        normalizeConnectionRouting(
            graph.connections
        );

        if (
            graph.selectedConnectionId &&
            !graph.connections.some(
                connection =>
                    connection.id ===
                    graph.selectedConnectionId
            )
        ) {
            graph.selectedConnectionId = null;
        }

        normalizeSelectedWirePoint();

        return;
    }
    const accepted = [];

    for (const connection of graph.connections) {
      const proposal =
        connectionProposal(
          {
            nodeId:
              connection.fromNode,
            portId:
              connection.fromPort,
            direction: "output"
          },
          {
            nodeId:
              connection.toNode,
            portId:
              connection.toPort,
            direction: "input"
          },
          accepted
        );

      if (proposal.valid) {
        accepted.splice(
          0,
          accepted.length,
          ...proposal.nextConnections.map(
            candidate =>
              candidate.id ===
                proposal.candidate.id
                ? { ...connection }
                : candidate
          )
        );
      }
    }

    graph.connections = accepted;
    normalizeConnectionRouting(
      graph.connections
    );
    currentAnalysis =
      synchronizeAutoVectorTypes(
        graph.connections,
        currentAnalysis
      );

    if (
      graph.selectedConnectionId &&
      !graph.connections.some(
        connection =>
          connection.id ===
          graph.selectedConnectionId
      )
    ) {
      graph.selectedConnectionId = null;
    }

    normalizeSelectedWirePoint();
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

  function previewNumber(value) {
    const number = Number(
      String(value ?? "")
        .trim()
        .replace(/[fFdD]$/, "")
    );

    return Number.isFinite(number)
      ? number
      : 0;
  }

  function previewColorChannels(value) {
    const text =
      String(value || "")
        .trim();
    const named = {
      White: [1, 1, 1, 1],
      Black: [0, 0, 0, 1],
      Red: [1, 0, 0, 1],
      Green: [0, 1, 0, 1],
      Blue: [0, 0, 1, 1],
      Yellow: [1, 1, 0, 1],
      Cyan: [0, 1, 1, 1],
      Magenta: [1, 0, 1, 1],
      Gray: [0.5, 0.5, 0.5, 1],
      Clear: [0, 0, 0, 0]
    };
    const namedMatch =
      text.match(
        /^colorX\.([A-Za-z_][A-Za-z0-9_]*)$/
      );

    if (
      namedMatch &&
      named[namedMatch[1]]
    ) {
      return [
        ...named[namedMatch[1]]
      ];
    }

    if (/^#[0-9a-fA-F]{6,8}$/.test(text)) {
      const raw = text.slice(1);

      return [
        Number.parseInt(raw.slice(0, 2), 16) / 255,
        Number.parseInt(raw.slice(2, 4), 16) / 255,
        Number.parseInt(raw.slice(4, 6), 16) / 255,
        raw.length === 8
          ? Number.parseInt(raw.slice(6, 8), 16) / 255
          : 1
      ];
    }

    const numbers =
      text.match(
        /[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?/g
      );

    if (
      numbers &&
      numbers.length >= 3
    ) {
      return [
        previewNumber(numbers[0]),
        previewNumber(numbers[1]),
        previewNumber(numbers[2]),
        numbers.length >= 4
          ? previewNumber(numbers[3])
          : 1
      ];
    }

    return [0, 0, 0, 1];
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
          const strength = clamp(
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
            !Boolean(
              input("value").value
            )
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
    if (!dom.nodesHost) {
      return;
    }

    let sizeMayHaveChanged = false;

    for (const node of graph.nodes) {
      if (
        node.kind !== "operator" ||
        node.operatorId !==
          "resonite.displayValue"
      ) {
        continue;
      }

      const host =
        dom.nodesHost.querySelector(
          `[data-graph-node-id="${CSS.escape(node.id)}"] .rml-graph-display-value`
        );

      if (!host) {
        continue;
      }

      const preview =
        displayPreviewForNode(node);
      const output =
        host.querySelector("output");

      host.classList.toggle(
        "unknown",
        !preview.known
      );

      if (output) {
        const nextText =
          previewFormatValue(preview);

        if (output.textContent !== nextText) {
          output.textContent = nextText;
          sizeMayHaveChanged = true;
        }

        output.title =
          output.textContent;
      }
    }

    if (sizeMayHaveChanged) {
      scheduleRenderedNodeResizeLimitRefresh();
    }
  }

  let typedGraphCodegenCacheKey = "";
  let typedGraphCodegenCache = null;

  function graphCsEscapeString(value) {
    return String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/\r\n|\r|\n/g, "\\n")
      .replace(/\t/g, "\\t")
      .replace(/\0/g, "\\0")
      .replace(/"/g, '\\"');
  }

  function graphCsIdentifier(
    value,
    fallback = "Value"
  ) {
    const words =
      String(value || "")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .split(/[^A-Za-z0-9_]+/)
        .filter(Boolean);
    let result = words
      .map(word =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
      )
      .join("") || fallback;

    if (/^[0-9]/.test(result)) {
      result = `Value${result}`;
    }

    const reserved = new Set([
      "Class",
      "Namespace",
      "Event",
      "String",
      "Int",
      "Float",
      "Double",
      "Bool",
      "Object",
      "Default",
      "New",
      "Static",
      "Public",
      "Private",
      "Internal",
      "Void"
    ]);

    return reserved.has(result)
      ? `${result}Value`
      : result;
  }

  function graphCsNamespace(value) {
    return String(value || "")
      .split(".")
      .map(part =>
        graphCsIdentifier(
          part,
          "Namespace"
        )
      )
      .join(".") ||
      "YourModNamespace";
  }

  function graphCsType(type) {
    if (
      typeof type === "string" &&
      type.startsWith("enum:")
    ) {
      return graphCsIdentifier(
        type.slice(5),
        "SettingOption"
      );
    }

    const information =
      TYPE_INFO[typeBase(type)] || {};

    if (
      typeof information.csType ===
        "string" &&
      information.csType.trim()
    ) {
      return information.csType.trim();
    }

    return type || "object";
  }

  function graphCsDefault(type) {
    const information =
      TYPE_INFO[typeBase(type)] || {};

    if (
      typeof information.defaultCs ===
        "string" &&
      information.defaultCs.trim()
    ) {
      return information.defaultCs.trim();
    }

    switch (type) {
      case "bool":
        return "false";
      case "int":
        return "0";
      case "float":
        return "0f";
      case "double":
        return "0d";
      case "string":
        return "string.Empty";
      case "Uri":
        return "new Uri(\"about:blank\")";
      default:
        return `default(${graphCsType(type)})`;
    }
  }

  function graphCsNumberLiteral(
    value,
    type
  ) {
    const number =
      previewNumber(value);

    if (type === "int") {
      return String(
        Math.trunc(number)
      );
    }

    const text =
      Number.isFinite(number)
        ? String(number)
        : "0";

    if (type === "double") {
      return /[.eE]/.test(text)
        ? `${text}d`
        : `${text}.0d`;
    }

    return /[.eE]/.test(text)
      ? `${text}f`
      : `${text}.0f`;
  }

  function graphCsColorLiteral(
    value,
    profile = "linear",
    strength = 1
  ) {
    const text =
      String(value || "")
        .trim();
    const normalizedProfile =
      normalizeGraphColorProfile(
        profile
      );
    const safeStrength = clamp(
      Number(strength) || 1,
      1,
      10
    );

    if (!text) {
      return "colorX.White";
    }

    if (/^#[0-9a-fA-F]{6,8}$/.test(text)) {
      return graphColorXExpressionFromChannels(
        previewColorChannels(text),
        normalizedProfile === "linear" &&
          !profile
          ? "srgb"
          : normalizedProfile,
        safeStrength
      );
    }

    if (
      /^colorX\.[A-Za-z_][A-Za-z0-9_]*$/.test(
        text
      )
    ) {
      if (
        safeStrength <= 1.000001 &&
        normalizedProfile === "linear"
      ) {
        return text;
      }

      return graphColorXExpressionFromChannels(
        previewColorChannels(text),
        normalizedProfile,
        safeStrength
      );
    }

    if (
      /^(?:new\s+colorX|\(\s*colorX\s*\)\s*new\s+color)\b/.test(
        text
      )
    ) {
      return text;
    }

    return text;
  }

  function graphCsMethodToken(
    nodeId,
    portId = ""
  ) {
    const nodeToken =
      `N${hashText(String(nodeId))}`;
    const portToken =
      graphCsIdentifier(
        portId,
        "Port"
      );

    return portId
      ? `${nodeToken}_${portToken}`
      : nodeToken;
  }

  function buildTypedNodeGraphCSharpContribution(
    request = {}
  ) {
    if (
      !graph?.configSnapshot
    ) {
      return {
        active: false,
        diagnostics: [],
        warnings: [],
        files: [],
        projects: [],
        applyStatements: {},
        requirements: {
          usesElements: false,
          usesRenderiteShared: false
        }
      };
    }

    const stateSnapshot =
      request.state ||
      bridge?.getStateSnapshot?.() ||
      {};
    const metadata =
      stateSnapshot.metadata ||
      graph.configSnapshot.metadata ||
      {};
    const cacheKey =
      JSON.stringify({
        metadata,
        graph:
          graphSerializableState()
      });

    if (
      typedGraphCodegenCache &&
      typedGraphCodegenCacheKey ===
        cacheKey
    ) {
      return typedGraphCodegenCache;
    }

    const diagnostics = [];
    const warnings = [];
    const extensionUsingLines =
      new Set();
    const extensionFields =
      new Map();
    const extensionMembers =
      new Map();
    const extensionInitializeStatements =
      [];
    const extensionEngineInitStatements =
      [];
    const extensionFiles = [];
    const extensionProjects = [];
    const extensionReferences =
      new Map();
    const extensionPackageReferences =
      new Map();
    const extensionFrameworkReferences =
      new Set();
    const extensionRequirements = {
      usesElements: false,
      usesRenderiteShared: false,
      allowUnsafeBlocks: false,
      useWindowsForms: false
    };

    const addNamedBlock = (
      collection,
      key,
      code
    ) => {
      const normalized =
        String(code || "").trim();

      if (!normalized) {
        return;
      }

      collection.set(
        String(key || normalized),
        normalized
      );
    };

    const addStatement = (
      collection,
      code
    ) => {
      const normalized =
        String(code || "").trim();

      if (
        normalized &&
        !collection.includes(normalized)
      ) {
        collection.push(normalized);
      }
    };

    const analysis =
      analyzeConnections(
        graph.connections
      );

    if (!analysis.valid) {
      diagnostics.push(
        analysis.reason ||
          "The graph contains an invalid typed connection."
      );
    }

    const className =
      graphCsIdentifier(
        metadata.className,
        "YourMod"
      );
    const graphClassName =
      `${className}NodeGraph`;
    const namespaceName =
      graphCsNamespace(
        metadata.namespaceName
      );
    const fileName =
      `${className}.NodeGraph.cs`;
    const configurationEntries =
      flattenConfiguration(
        graph.configSnapshot.nodes || []
      );
    const configurationById =
      new Map(
        configurationEntries.map(
          entry => [
            entry.node.id,
            entry
          ]
        )
      );
    const configurationFields =
      configurationEntries.map(entry => {
        const node = entry.node;
        const type =
          configurationValueType(node);
        const field =
          graphCsIdentifier(
            node.fieldName ||
              node.keyName,
            "Setting"
          );

        return {
          node,
          type,
          csType:
            graphCsType(type),
          field,
          backing:
            `_config${field}`,
          setter:
            `Set${field}`,
          getter:
            `Get${field}`,
          reactor:
            `React${field}`,
          portId:
            `config-${node.id}`,
          reaction:
            RUNTIME_BEHAVIORS[
              node.reaction
            ]
              ? node.reaction
              : "stored"
        };
      });
    const configurationFieldById =
      new Map(
        configurationFields.map(
          item => [
            item.node.id,
            item
          ]
        )
      );
    const nodeById =
      new Map(
        graph.nodes.map(
          node => [node.id, node]
        )
      );
    const incoming =
      new Map(
        graph.connections.map(
          connection => [
            `${connection.toNode}:${connection.toPort}`,
            connection
          ]
        )
      );
    const expressionCache =
      new Map();
    const expressionStack =
      new Set();

    const resolvedType = (
      node,
      spec
    ) =>
      spec?.type ||
      analysis.bindings
        .get(node.id)?.[
          spec?.typeVar
        ] ||
      null;

    const inputExpression = (
      node,
      inputId
    ) => {
      const definition =
        nodeDefinition(node);
      const inputSpec =
        definition?.inputs?.find(
          spec => spec.id === inputId
        );
      const type =
        resolvedType(
          node,
          inputSpec
        );
      const connection =
        incoming.get(
          `${node.id}:${inputId}`
        );

      if (!connection) {
        const explicitDefault =
          typeof inputSpec?.defaultCs === "string" &&
          inputSpec.defaultCs.trim()
            ? inputSpec.defaultCs.trim()
            : null;

        return {
          type,
          code:
            explicitDefault ||
            graphCsDefault(type)
        };
      }

      return outputExpression(
        connection.fromNode,
        connection.fromPort
      );
    };

    const storeFieldName = node =>
      `_store${graphCsMethodToken(node.id)}`;

    let impulseMethodByPort =
      new Map();

    const registerReference =
      reference => {
        if (
          !reference ||
          typeof reference !== "object"
        ) {
          return;
        }

        const include = String(
          reference.include || ""
        ).trim();

        if (!include) {
          return;
        }

        extensionReferences.set(
          include.toLowerCase(),
          {
            include,
            hintPath:
              String(
                reference.hintPath || ""
              ).trim(),
            private:
              reference.private === true
          }
        );
      };

    const registerPackageReference =
      packageReference => {
        if (
          !packageReference ||
          typeof packageReference !==
            "object"
        ) {
          return;
        }

        const include = String(
          packageReference.include || ""
        ).trim();
        const version = String(
          packageReference.version || ""
        ).trim();

        if (!include || !version) {
          return;
        }

        extensionPackageReferences.set(
          include.toLowerCase(),
          {
            include,
            version,
            privateAssets:
              String(
                packageReference.privateAssets ||
                  ""
              ).trim(),
            includeAssets:
              String(
                packageReference.includeAssets ||
                  ""
              ).trim()
          }
        );
      };

    const makeExtensionApi = (
      node,
      definition,
      extra = {}
    ) => ({
      node,
      definition,
      graph,
      metadata,
      stateSnapshot,
      className,
      graphClassName,
      namespaceName,
      analysis,
      resolvedType,
      input: inputId =>
        inputExpression(
          node,
          inputId
        ),
      output: (
        nodeId,
        portId
      ) =>
        outputExpression(
          nodeId,
          portId
        ),
      emitMethod: (
        nodeId,
        portId
      ) =>
        impulseMethodByPort.get(
          `${nodeId}:${portId}`
        ) || "",
      token: graphCsMethodToken,
      identifier: graphCsIdentifier,
      escapeString:
        graphCsEscapeString,
      csType: graphCsType,
      csDefault: graphCsDefault,
      numberLiteral:
        graphCsNumberLiteral,
      colorLiteral:
        graphCsColorLiteral,
      addUsing(value) {
        const normalized =
          String(value || "").trim();
        if (normalized) {
          extensionUsingLines.add(
            normalized
          );
        }
      },
      addField(key, code) {
        addNamedBlock(
          extensionFields,
          key,
          code
        );
      },
      addMember(key, code) {
        addNamedBlock(
          extensionMembers,
          key,
          code
        );
      },
      addInitialize(code) {
        addStatement(
          extensionInitializeStatements,
          code
        );
      },
      addEngineInit(code) {
        addStatement(
          extensionEngineInitStatements,
          code
        );
      },
      addFile(file) {
        if (
          file &&
          typeof file.name === "string" &&
          file.name.trim() &&
          typeof file.content ===
            "string"
        ) {
          extensionFiles.push({
            name: file.name.trim(),
            content: file.content,
            type:
              file.type ||
              "text/plain;charset=utf-8"
          });
        }
      },
      addProject(project) {
        if (
          !project ||
          typeof project !== "object" ||
          Array.isArray(project)
        ) {
          return;
        }

        const id = String(
          project.id ||
          project.name ||
          ""
        ).trim();
        const name = String(
          project.name ||
          project.assemblyName ||
          id
        ).trim();
        const files = Array.isArray(
          project.files
        )
          ? project.files
              .filter(file =>
                file &&
                typeof file.name === "string" &&
                file.name.trim() &&
                typeof file.content === "string"
              )
              .map(file => ({
                name: file.name.trim(),
                content: file.content,
                type:
                  file.type ||
                  "text/plain;charset=utf-8"
              }))
          : [];

        if (!id || !name || files.length === 0) {
          diagnostics.push(
            "A generated auxiliary project requires an id, name and at least one source file."
          );
          return;
        }

        extensionProjects.push({
          ...project,
          id,
          name,
          assemblyName: String(
            project.assemblyName || name
          ).trim(),
          rootNamespace: String(
            project.rootNamespace ||
            namespaceName
          ).trim(),
          folder: String(
            project.folder || name
          ).trim(),
          deployDirectory: String(
            project.deployDirectory ||
            "rml_libs"
          ).trim(),
          files,
          requirements:
            project.requirements &&
            typeof project.requirements === "object" &&
            !Array.isArray(project.requirements)
              ? project.requirements
              : {}
        });
      },
      addReference:
        registerReference,
      addPackageReference:
        registerPackageReference,
      addFrameworkReference(value) {
        const normalized =
          String(value || "").trim();
        if (normalized) {
          extensionFrameworkReferences.add(
            normalized
          );
        }
      },
      require(name, value = true) {
        if (
          Object.hasOwn(
            extensionRequirements,
            name
          )
        ) {
          extensionRequirements[name] =
            extensionRequirements[name] ||
            Boolean(value);
        }
      },
      diagnostic(message) {
        const normalized =
          String(message || "").trim();
        if (normalized) {
          diagnostics.push(normalized);
        }
      },
      warning(message) {
        const normalized =
          String(message || "").trim();
        if (normalized) {
          warnings.push(normalized);
        }
      },
      ...extra
    });

    const outputExpression = (
      nodeId,
      portId
    ) => {
      const key = `${nodeId}:${portId}`;

      if (expressionCache.has(key)) {
        return expressionCache.get(key);
      }

      if (expressionStack.has(key)) {
        const cycle = {
          type: null,
          code: "default(object)"
        };
        diagnostics.push(
          `Expression cycle detected at ${key}.`
        );
        return cycle;
      }

      expressionStack.add(key);

      const node =
        nodeById.get(nodeId);
      const definition =
        node
          ? nodeDefinition(node)
          : null;
      const outputSpec =
        definition?.outputs?.find(
          spec => spec.id === portId
        );
      const type =
        node && outputSpec
          ? resolvedType(
              node,
              outputSpec
            )
          : null;
      const csType =
        graphCsType(type);
      let code =
        graphCsDefault(type);

      if (
        !node ||
        !definition ||
        !outputSpec
      ) {
        diagnostics.push(
          `A generated expression references missing output ${key}.`
        );
      } else if (
        node.kind ===
        "configuration"
      ) {
        if (type !== "impulse") {
          const field =
            configurationFieldById.get(
              outputSpec.sourceNodeId
            );

          code = field
            ? `${field.getter}()`
            : graphCsDefault(type);
        }
      } else {
        const input = id =>
          inputExpression(
            node,
            id
          );

        switch (node.operatorId) {
          case "constant.number":
            code = graphCsNumberLiteral(
              node.parameters?.value,
              type
            );
            break;

          case "constant.bool":
            code = node.parameters?.value
              ? "true"
              : "false";
            break;

          case "constant.string":
            code =
              `"${graphCsEscapeString(
                node.parameters?.value
              )}"`;
            break;

          case "constant.color":
            code = graphCsColorLiteral(
              node.parameters?.value,
              node.parameters?.colorProfile,
              node.parameters?.colorStrength
            );
            break;

          case "constant.typedDefault":
            code = graphCsDefault(type);
            break;

          case "math.add":
            code = variadicReduceCode(node, input, "GraphAdd", csType);
            break;

          case "math.subtract":
            code =
              `GraphSubtract<${csType}>(${input("a").code}, ${input("b").code})`;
            break;

          case "math.multiply":
            code = variadicReduceCode(node, input, "GraphMultiply", csType);
            break;

          case "math.divide":
            code =
              `GraphDivide<${csType}>(${input("a").code}, ${input("b").code})`;
            break;

          case "math.minimum":
            code = variadicReduceCode(node, input, "GraphMinimum", csType);
            break;

          case "math.maximum":
            code = variadicReduceCode(node, input, "GraphMaximum", csType);
            break;

          case "math.clamp":
            code =
              `GraphClamp<${csType}>(${input("value").code}, ${input("min").code}, ${input("max").code})`;
            break;

          case "math.negate":
            code =
              `GraphNegate<${csType}>(${input("value").code})`;
            break;

          case "math.absolute":
            code =
              `GraphAbsolute<${csType}>(${input("value").code})`;
            break;

          case "math.lerp":
            code =
              `GraphLerp<${csType}>(${input("a").code}, ${input("b").code}, ${input("t").code})`;
            break;

          case "logic.and": {
            const ids = variadicInputIds(node);
            code = `(${ids.map(id => input(id).code).join(" && ")})`;
            break;
          }

          case "logic.or": {
            const ids = variadicInputIds(node);
            code = `(${ids.map(id => input(id).code).join(" || ")})`;
            break;
          }

          case "logic.not":
            code =
              `(!${input("value").code})`;
            break;

          case "logic.equal": {
            const valueType =
              graphCsType(
                input("a").type ||
                input("b").type
              );
            code =
              `EqualityComparer<${valueType}>.Default.Equals(${input("a").code}, ${input("b").code})`;
            break;
          }

          case "logic.greater": {
            const valueType =
              graphCsType(
                input("a").type ||
                input("b").type
              );
            code =
              `(Comparer<${valueType}>.Default.Compare(${input("a").code}, ${input("b").code}) > 0)`;
            break;
          }

          case "logic.less": {
            const valueType =
              graphCsType(
                input("a").type ||
                input("b").type
              );
            code =
              `(Comparer<${valueType}>.Default.Compare(${input("a").code}, ${input("b").code}) < 0)`;
            break;
          }

          case "logic.select":
            code =
              `(${input("condition").code} ? ${input("true").code} : ${input("false").code})`;
            break;

          case "cast.doubleToFloat":
            code =
              `((float)${input("value").code})`;
            break;

          case "cast.floatToInt":
            code =
              `((int)${input("value").code})`;
            break;

          case "cast.toString":
            code =
              `FormatValue(${input("value").code})`;
            break;

          case "resonite.valueRelay":
          case "resonite.displayValue":
            code = input("value").code;
            break;

          case "resonite.store":
            code = storeFieldName(node);
            break;

          case "resonite.packColorX":
            code =
              `(colorX)new color(${input("r").code}, ${input("g").code}, ${input("b").code}, ${input("a").code})`;
            break;

          case "resonite.unpackColorX":
            code =
              `ReadFloatComponent(${input("value").code}, "${portId}")`;
            break;

          default: {
            const generator =
              definition.codegenExpression;

            if (
              typeof generator ===
              "function"
            ) {
              try {
                const generated =
                  generator(
                    makeExtensionApi(
                      node,
                      definition,
                      {
                        portId,
                        type,
                        csType,
                        input
                      }
                    )
                  );

                if (
                  typeof generated ===
                  "string"
                ) {
                  code = generated;
                } else if (
                  generated &&
                  typeof generated.code ===
                    "string"
                ) {
                  code = generated.code;
                }
              } catch (error) {
                diagnostics.push(
                  `${definition.title}: C# expression generation failed: ${
                    error instanceof Error
                      ? error.message
                      : String(error)
                  }`
                );
              }
            } else {
              code = graphCsDefault(type);
            }
            break;
          }
        }
      }

      const result = {
        type,
        code
      };
      expressionStack.delete(key);
      expressionCache.set(key, result);
      return result;
    };

    const storeNodes =
      graph.nodes.filter(
        node =>
          node.kind === "operator" &&
          node.operatorId ===
            "resonite.store"
      );
    const storeFields =
      storeNodes.map(node => {
        const definition =
          nodeDefinition(node);
        const currentSpec =
          definition.outputs.find(
            spec =>
              spec.id === "current"
          );
        const type =
          resolvedType(
            node,
            currentSpec
          ) ||
          node.parameters?.valueType ||
          "float";

        return {
          node,
          type,
          csType: graphCsType(type),
          field: storeFieldName(node)
        };
      });

    const impulseOutputs = [];

    for (const node of graph.nodes) {
      const definition =
        nodeDefinition(node);

      for (
        const spec of
        definition?.outputs || []
      ) {
        const concreteType =
          resolvedType(node, spec);
        const reactiveConfiguration =
          node.kind ===
            "configuration" &&
          runtimeBehaviorEmitsImpulse(
            spec.reaction
          );
        const reactiveConfigurationConnected =
          reactiveConfiguration &&
          graph.connections.some(
            connection => {
              if (
                connection.fromNode !==
                  node.id ||
                connection.fromPort !==
                  spec.id
              ) {
                return false;
              }

              return isConfigurationReactionConnection(
                {
                  node,
                  definition,
                  spec,
                  direction: "output"
                },
                findPortSpec(
                  connection.toNode,
                  connection.toPort,
                  "input"
                )
              );
            }
          );

        if (
          concreteType === "impulse" ||
          reactiveConfigurationConnected
        ) {
          impulseOutputs.push({
            node,
            spec,
            reactiveConfiguration,
            method:
              `Emit${graphCsMethodToken(
                node.id,
                spec.id
              )}`
          });
        }
      }
    }

    impulseMethodByPort =
      new Map(
        impulseOutputs.map(
          item => [
            `${item.node.id}:${item.spec.id}`,
            item.method
          ]
        )
      );

    for (const node of graph.nodes) {
      const definition =
        nodeDefinition(node);
      const collector =
        definition?.codegenCollect;

      if (
        typeof collector !==
        "function"
      ) {
        continue;
      }

      try {
        collector(
          makeExtensionApi(
            node,
            definition
          )
        );
      } catch (error) {
        diagnostics.push(
          `${definition.title}: C# runtime collection failed: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        );
      }
    }

    for (const plugin of GRAPH_CODEGEN_PLUGINS) {
      if (
        typeof plugin.collect !==
        "function"
      ) {
        continue;
      }

      try {
        plugin.collect(
          makeExtensionApi(
            null,
            null,
            {
              nodes: graph.nodes,
              definitions:
                OPERATOR_DEFINITIONS,
              nodeById,
              incoming
            }
          )
        );
      } catch (error) {
        diagnostics.push(
          `Mod-node plugin C# generation failed: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`
        );
      }
    }

    const targetAction = connection => {
      const targetNode =
        nodeById.get(
          connection.toNode
        );

      if (
        !targetNode ||
        targetNode.kind !== "operator"
      ) {
        return "";
      }

      const emit = portId => {
        const method =
          impulseMethodByPort.get(
            `${targetNode.id}:${portId}`
          );

        return method || "";
      };

      switch (targetNode.operatorId) {
        case "resonite.impulseRelay": {
          const next = emit("out");
          return next
            ? `${next}();`
            : "";
        }

        case "resonite.store": {
          const field =
            storeFieldName(targetNode);
          const value =
            inputExpression(
              targetNode,
              "value"
            ).code;
          const written =
            emit("written");

          return `${field} = ${value};${written
            ? `\n        ${written}();`
            : ""}`;
        }

        default: {
          const definition =
            nodeDefinition(targetNode);
          const generator =
            definition?.codegenAction;

          if (
            typeof generator !==
            "function"
          ) {
            return "";
          }

          try {
            const generated =
              generator(
                makeExtensionApi(
                  targetNode,
                  definition,
                  {
                    connection,
                    emit,
                    input: inputId =>
                      inputExpression(
                        targetNode,
                        inputId
                      )
                  }
                )
              );

            return typeof generated ===
              "string"
              ? generated
              : generated?.code || "";
          } catch (error) {
            diagnostics.push(
              `${definition.title}: C# action generation failed: ${
                error instanceof Error
                  ? error.message
                  : String(error)
              }`
            );
            return "";
          }
        }
      }
    };

    const impulseMethods =
      impulseOutputs.map(item => {
        const sourceRef = {
          node: item.node,
          definition:
            nodeDefinition(
              item.node
            ),
          spec: item.spec,
          direction: "output"
        };
        const connections =
          graph.connections
            .filter(
              connection =>
                connection.fromNode ===
                  item.node.id &&
                connection.fromPort ===
                  item.spec.id
            )
            .filter(connection => {
              if (
                !item.reactiveConfiguration
              ) {
                return true;
              }

              const targetRef =
                findPortSpec(
                  connection.toNode,
                  connection.toPort,
                  "input"
                );

              return isConfigurationReactionConnection(
                sourceRef,
                targetRef
              );
            });
        const actions =
          connections
            .map(targetAction)
            .filter(Boolean);

        return `    private static void ${item.method}()
    {
${actions.length > 0
  ? actions
      .map(action =>
        action
          .split("\n")
          .map(line => `        ${line}`)
          .join("\n")
      )
      .join("\n")
  : "        // No connected impulse targets."}
    }`;
      }).join("\n\n");

    const configurationNode =
      graph.nodes.find(
        node =>
          node.kind ===
          "configuration"
      ) || null;
    const startupEmitters = [];

    if (configurationNode) {
      for (const item of configurationFields) {
        if (
          !runtimeBehaviorIncludesStartup(
            item.reaction
          )
        ) {
          continue;
        }

        const method =
          impulseMethodByPort.get(
            `${configurationNode.id}:${item.portId}`
          );

        if (method) {
          startupEmitters.push(
            `${method}();`
          );
        }
      }
    }

    for (const node of graph.nodes) {
      if (
        node.kind !== "operator"
      ) {
        continue;
      }

      if (
        node.operatorId ===
        "resonite.onStart"
      ) {
        const method =
          impulseMethodByPort.get(
            `${node.id}:impulse`
          );
        if (method) {
          startupEmitters.push(
            `${method}();`
          );
        }
      }
    }

    const displayNodes =
      graph.nodes.filter(
        node =>
          node.kind === "operator" &&
          nodeDefinition(node)
            ?.displaysValue === true
      );
    const displayStatements =
      displayNodes.map((node, index) => {
        const connection =
          incoming.get(
            `${node.id}:value`
          );
        const label =
          node.label ||
          `Display Value ${index + 1}`;

        if (!connection) {
          return `        PublishDisplay("${graphCsEscapeString(label)}", "<not connected>");`;
        }

        const expression =
          outputExpression(
            connection.fromNode,
            connection.fromPort
          );

        return `        PublishDisplay("${graphCsEscapeString(label)}", ${expression.code});`;
      });

    const applyStatements = {};
    const syncStatements = {};
    const reactionStatements = {};

    for (
      const item of
      configurationFields
    ) {
      const syncStatement =
        `${graphClassName}.${item.setter}(value);`;

      applyStatements[item.node.id] =
        syncStatement;
      syncStatements[item.node.id] =
        syncStatement;

      const reactionEmitter =
        configurationNode
          ? impulseMethodByPort.get(
              `${configurationNode.id}:${item.portId}`
            )
          : "";

      if (reactionEmitter) {
        reactionStatements[
          item.node.id
        ] =
          `${graphClassName}.${item.reactor}();`;
      }
    }

    const usesElements =
      graph.nodes.some(node => {
        const definition =
          nodeDefinition(node);

        return [
          ...(definition?.inputs || []),
          ...(definition?.outputs || [])
        ].some(spec => {
          const type =
            resolvedType(node, spec);
          return (
            type === "colorX" ||
            /^(?:int|float|double)[234]$/.test(
              type || ""
            )
          );
        });
      }) ||
      configurationFields.some(item =>
        item.type === "colorX" ||
        /^(?:int|float|double)[234]$/.test(
          item.type || ""
        )
      ) ||
      extensionRequirements.usesElements ===
        true;
    const usesColorX =
      graph.nodes.some(node => {
        const definition =
          nodeDefinition(node);

        return [
          ...(definition?.inputs || []),
          ...(definition?.outputs || [])
        ].some(spec =>
          resolvedType(node, spec) ===
          "colorX"
        );
      }) ||
      configurationFields.some(
        item =>
          item.type === "colorX"
      ) ||
      extensionRequirements.usesRenderiteShared ===
        true;

    const usingSet = new Set([
      "using System;",
      "using System.Collections.Generic;",
      "using System.Globalization;",
      "using System.Linq;",
      "using System.Reflection;",
      "using System.Threading;"
    ]);

    if (usesElements) {
      usingSet.add(
        "using Elements.Core;"
      );
    }

    if (usesColorX) {
      usingSet.add(
        "using Renderite.Shared;"
      );
    }

    for (const usingLine of extensionUsingLines) {
      const normalized =
        usingLine.startsWith("using ")
          ? usingLine
          : `using ${usingLine};`;
      usingSet.add(
        normalized.endsWith(";")
          ? normalized
          : `${normalized};`
      );
    }

    const usingLines =
      [...usingSet].join("\n");
    const configFieldsCode =
      configurationFields
        .map(item =>
          `    private static ${item.csType} ${item.backing} = default!;`
        )
        .join("\n");
    const setterCode =
      configurationFields
        .map(item =>
          `    public static void ${item.setter}(${item.csType} value)
    {
        lock (_configurationStateLock)
        {
            ${item.backing} = value;
        }
    }

    private static ${item.csType} ${item.getter}()
    {
        lock (_configurationStateLock)
        {
            return ${item.backing};
        }
    }`
        )
        .join("\n\n");
    const reactionCode =
      configurationFields
        .filter(item =>
          Boolean(
            reactionStatements[
              item.node.id
            ]
          )
        )
        .map(item => {
          const emitter =
            impulseMethodByPort.get(
              `${configurationNode.id}:${item.portId}`
            );

          return `    public static void ${item.reactor}()
    {
        DispatchGraphToWorld(() =>
        {
            ${emitter}();
            RefreshDisplays();
        });
    }`;
        })
        .join("\n\n");
    const storeFieldsCode =
      storeFields
        .map(item =>
          `    private static ${item.csType} ${item.field} = ${graphCsDefault(item.type)};`
        )
        .join("\n");
    const extensionFieldsCode =
      [...extensionFields.values()]
        .map(code =>
          code
            .split("\n")
            .map(line =>
              line.length > 0
                ? `    ${line}`
                : ""
            )
            .join("\n")
        )
        .join("\n\n");
    const extensionMembersCode =
      [...extensionMembers.values()]
        .map(code =>
          code
            .split("\n")
            .map(line =>
              line.length > 0
                ? `    ${line}`
                : ""
            )
            .join("\n")
        )
        .join("\n\n");
    const formatExtensionStatements =
      statements =>
        statements
          .flatMap(statement =>
            statement.split("\n")
          )
          .map(line =>
            line.length > 0
              ? `        ${line}`
              : ""
          )
          .join("\n");
    const warningsComment =
      warnings.length > 0
        ? `\n/*\n${warnings
            .map(warning =>
              ` * ${warning}`
            )
            .join("\n")}\n */\n`
        : "\n";

    const guideComment =
      metadata.includeGuide === true
        ? `// RML typed runtime graph\n\n/*\n * Generated by the RML Configuration Builder.\n *\n * STEP 1 - Configuration values\n * The main mod source forwards the current RML configuration values into\n * this generated runtime class through the Set... methods below.\n *\n * STEP 2 - Runtime reactions\n * React... methods are entry points for Configuration sockets configured to\n * react when settings are saved. Startup-capable sockets are emitted from\n * OnEngineInit(). Stored-only sockets remain typed value sources.\n *\n * STEP 3 - Typed graph execution\n * Emit... methods are the generated impulse paths. Value inputs are resolved\n * from their connected typed sources when an impulse path executes.\n *\n * STEP 4 - Runtime state and outputs\n * Generated fields retain node state and action outputs. Display Value and\n * Display Impulse nodes publish through DisplayValues/DisplayValueChanged.\n *\n * This file is generated from the visual graph. Edit the graph rather than\n * editing this generated file manually.\n */\n\n`
        : "";

    const source = `${guideComment}${usingLines}

namespace ${namespaceName};
${warningsComment}
/// <summary>
/// Generated executable runtime for the builder's typed node graph.
/// The main mod source forwards current configuration values into this class.
/// </summary>
internal static partial class ${graphClassName}
{
    private static readonly object _configurationStateLock = new();
    private static Action<string> _display = static _ => { };
    private static readonly Dictionary<string, object?> _displayValues =
        new(StringComparer.Ordinal);

    /// <summary>
    /// Latest values published by Display Value and Display Impulse nodes, keyed by node label.
    /// </summary>
    public static IReadOnlyDictionary<string, object?> DisplayValues =>
        _displayValues;

    /// <summary>
    /// Raised whenever a display or impulse monitor publishes a value.
    /// </summary>
    public static event Action<string, object?>? DisplayValueChanged;

${configFieldsCode || "    // No configuration values."}
${storeFieldsCode ? `\n${storeFieldsCode}` : ""}${extensionFieldsCode ? `\n\n${extensionFieldsCode}` : ""}

    public static void Initialize(Action<string>? display)
    {
        _display = display ?? (static _ => { });${extensionInitializeStatements.length > 0
  ? `\n${formatExtensionStatements(
      extensionInitializeStatements
    )}`
  : ""}
    }

${setterCode || "    // No configuration setters."}${reactionCode ? `

${reactionCode}` : ""}

    public static void OnEngineInit()
    {
${startupEmitters.length > 0
  ? "        BeginStartupWhenWorldReady();"
  : "        // No connected startup impulse paths."}${extensionEngineInitStatements.length > 0
  ? `\n${formatExtensionStatements(
      extensionEngineInitStatements
    )}`
  : ""}

        RefreshDisplays();
    }

    // Graph entry points use the global CoroutineManager only to wait until a
    // usable world exists. Actual graph execution is dispatched through
    // World.RunSynchronously(), FrooxEngine's supported data-model mutation
    // path for background threads and other worlds.
    private static FrooxEngine.World? GraphExecutionWorld()
    {
        return FrooxEngine.Engine.Current?.WorldManager?.FocusedWorld ??
               FrooxEngine.Userspace.UserspaceWorld;
    }

    private static bool GraphWorldReady(FrooxEngine.World? world)
    {
        return world is not null &&
               !world.IsDisposed &&
               world.RootSlot is not null &&
               world.LocalUser is not null;
    }

    private static bool TryDispatchGraphToWorld(Action action)
    {
        FrooxEngine.World? world = GraphExecutionWorld();
        if (!GraphWorldReady(world))
        {
            return false;
        }

        world!.RunSynchronously(
            action,
            immediatellyIfPossible: true);
        return true;
    }

    private static void DispatchGraphToWorld(Action action)
    {
        if (TryDispatchGraphToWorld(action))
        {
            return;
        }

        FrooxEngine.CoroutineManager? manager =
            FrooxEngine.Engine.Current?.GlobalCoroutineManager;

        if (manager is null)
        {
            throw new System.InvalidOperationException(
                "The Resonite GlobalCoroutineManager is not available while waiting for a world-safe graph execution context.");
        }

        _ = manager.StartTask(
            async () =>
            {
                while (!TryDispatchGraphToWorld(action))
                {
                    // Updates is only a wait primitive. World.RunSynchronously
                    // is what grants the valid world mutation context.
                    await new FrooxEngine.Updates(1);
                }
            });
    }
${startupEmitters.length > 0 ? `
    private static int _startupWorldReadyState;

    private static void BeginStartupWhenWorldReady()
    {
        if (System.Threading.Interlocked.CompareExchange(
                ref _startupWorldReadyState, 1, 0) != 0)
        {
            return;
        }

        DispatchGraphToWorld(RunStartupOnce);
    }

    private static void RunStartupOnce()
    {
        if (System.Threading.Interlocked.CompareExchange(
                ref _startupWorldReadyState, 2, 1) != 1)
        {
            return;
        }

${startupEmitters
  .map(call => `        ${call}`)
  .join("\n")}
        RefreshDisplays();
    }
` : ""}

    public static void OnConfigurationSynchronized()
    {
        RefreshDisplays();
    }

    private static void RefreshDisplays()
    {
${displayStatements.length > 0
  ? displayStatements.join("\n")
  : "        // No Display Value nodes are connected."}
    }

${impulseMethods || "    // No impulse outputs are present."}${extensionMembersCode ? `\n\n${extensionMembersCode}` : ""}

    private static T GraphAdd<T>(T left, T right)
    {
        dynamic a = left!;
        dynamic b = right!;
        return (T)(a + b);
    }

    private static T GraphSubtract<T>(T left, T right)
    {
        dynamic a = left!;
        dynamic b = right!;
        return (T)(a - b);
    }

    private static T GraphMultiply<T>(T left, T right)
    {
        dynamic a = left!;
        dynamic b = right!;
        return (T)(a * b);
    }

    private static T GraphDivide<T>(T left, T right)
    {
        dynamic a = left!;
        dynamic b = right!;
        return (T)(a / b);
    }

    private static T GraphNegate<T>(T value)
    {
        dynamic current = value!;
        return (T)(-current);
    }

    private static T GraphMinimum<T>(T left, T right)
    {
        return Comparer<T>.Default.Compare(left, right) <= 0
            ? left
            : right;
    }

    private static T GraphMaximum<T>(T left, T right)
    {
        return Comparer<T>.Default.Compare(left, right) >= 0
            ? left
            : right;
    }

    private static T GraphClamp<T>(T value, T minimum, T maximum)
    {
        return GraphMaximum(minimum, GraphMinimum(value, maximum));
    }

    private static T GraphAbsolute<T>(T value)
    {
        object result = value switch
        {
            int current => Math.Abs(current),
            float current => MathF.Abs(current),
            double current => Math.Abs(current),
            _ => throw new InvalidOperationException(
                $"Absolute is not supported for {typeof(T).FullName}.")
        };

        return (T)result;
    }

    private static T GraphLerp<T>(T left, T right, float factor)
    {
        dynamic a = left!;
        dynamic b = right!;
        dynamic t =
            typeof(T) == typeof(double) ||
            typeof(T).Name.StartsWith("double", StringComparison.Ordinal)
                ? (double)factor
                : factor;

        return (T)(a + (b - a) * t);
    }

    private static float ReadFloatComponent(object? value, string memberName)
    {
        if (value is null)
        {
            return 0f;
        }

        Type type = value.GetType();
        BindingFlags flags =
            BindingFlags.Instance |
            BindingFlags.Public |
            BindingFlags.NonPublic |
            BindingFlags.IgnoreCase;

        FieldInfo? field = type.GetField(memberName, flags);
        if (field is not null)
        {
            return Convert.ToSingle(
                field.GetValue(value),
                CultureInfo.InvariantCulture);
        }

        PropertyInfo? property = type.GetProperty(memberName, flags);
        if (property is not null)
        {
            return Convert.ToSingle(
                property.GetValue(value),
                CultureInfo.InvariantCulture);
        }

        return 0f;
    }

    private static void PublishDisplay(
        string name,
        object? value)
    {
        _displayValues[name] = value;
        DisplayValueChanged?.Invoke(name, value);
        _display($"{name}: {FormatValue(value)}");
    }

    public static bool TryGetDisplayValue(
        string name,
        out object? value)
    {
        return _displayValues.TryGetValue(name, out value);
    }

    private static string FormatValue(object? value)
    {
        return value switch
        {
            null => "<null>",
            bool current => current ? "true" : "false",
            IFormattable current =>
                current.ToString(null, CultureInfo.InvariantCulture) ??
                string.Empty,
            _ => value.ToString() ?? string.Empty
        };
    }
}
`;

    const result = {
      active: true,
      className:
        graphClassName,
      diagnostics,
      warnings,
      files: (() => {
        const files = [
          {
            name: fileName,
            content: source,
            type:
              "text/plain;charset=utf-8"
          },
          ...extensionFiles
        ];
        const usedNames = new Set();

        return files.filter(file => {
          const name =
            String(file.name || "")
              .trim();
          const key =
            name.toLowerCase();

          if (
            !name ||
            usedNames.has(key)
          ) {
            if (name) {
              diagnostics.push(
                `Generated source file '${name}' occurs more than once.`
              );
            }
            return false;
          }

          usedNames.add(key);
          file.name = name;
          return true;
        });
      })(),
      projects: (() => {
        const usedIds = new Set();
        const usedNames = new Set();

        return extensionProjects.filter(project => {
          const id = String(project.id || "")
            .trim()
            .toLowerCase();
          const name = String(
            project.name ||
            project.assemblyName ||
            ""
          )
            .trim()
            .toLowerCase();

          if (
            !id ||
            !name ||
            usedIds.has(id) ||
            usedNames.has(name)
          ) {
            diagnostics.push(
              `Generated auxiliary project '${project.name || project.id || "<unnamed>"}' occurs more than once.`
            );
            return false;
          }

          usedIds.add(id);
          usedNames.add(name);
          return true;
        });
      })(),
      applyStatements,
      syncStatements,
      reactionStatements,
      initializeStatement:
        `${graphClassName}.Initialize(message => Msg(message));`,
      onEngineInitializedStatement:
        `${graphClassName}.OnEngineInit();`,
      onConfigurationSynchronizedStatement:
        `${graphClassName}.OnConfigurationSynchronized();`,
      requirements: {
        usesElements,
        usesRenderiteShared:
          usesColorX,
        allowUnsafeBlocks:
          extensionRequirements.allowUnsafeBlocks,
        useWindowsForms:
          extensionRequirements.useWindowsForms,
        references:
          [...extensionReferences.values()],
        packageReferences:
          [...extensionPackageReferences.values()],
        frameworkReferences:
          [...extensionFrameworkReferences]
      }
    };

    typedGraphCodegenCacheKey =
      cacheKey;
    typedGraphCodegenCache =
      result;

    return result;
  }


  function injectStyles() {
    if (
      document.getElementById(
        "rml-node-graph-styles"
      )
    ) {
      return;
    }

    const style =
      document.createElement("style");
    style.id =
      "rml-node-graph-styles";
    style.textContent = `
      #pack-into-node {
        white-space: nowrap;
      }

      #pack-into-node.graph-active {
        border-color: rgba(88, 191, 255, 0.6);
        background: linear-gradient(145deg, #24445c, #1a3042);
        color: #cdeeff;
        box-shadow: 0 7px 22px rgba(52, 156, 218, 0.18);
      }

      body.rml-node-graph-mode .palette > .help,
      body.rml-node-graph-mode .palette > .structure {
        display: none !important;
      }

      body.rml-node-graph-mode .palette {
        position: relative;
        overflow: hidden;
      }

      body.rml-node-graph-mode #palette-content {
        height: calc(100% - 52px);
        min-height: 0;
        overflow: hidden;
      }

      @media (min-width: 1181px) {
        body.rml-node-graph-mode .workspace {
          height: min(820px, calc(100dvh - 110px));
          min-height: 720px;
          align-items: stretch;
        }

        body.rml-node-graph-mode .workspace > .palette,
        body.rml-node-graph-mode .workspace > .canvas,
        body.rml-node-graph-mode .workspace > .inspector {
          height: 100%;
          min-height: 0;
        }

        body.rml-node-graph-mode #builder-canvas {
          height: 100%;
          min-height: 0;
        }

        body.rml-node-graph-mode #inspector-content {
          height: calc(100% - 52px);
          min-height: 0;
        }

        body.rml-node-graph-mode .rml-graph-root {
          min-height: 0;
        }
      }

      body.rml-node-graph-mode #builder-canvas {
        min-height: 720px;
        padding: 0 !important;
        overflow: hidden !important;
        background: #090b12 !important;
        background-size: auto !important;
      }

      body.rml-node-graph-mode #inspector-content {
        min-height: 640px;
      }

      .rml-graph-palette {
        display: grid;
        height: 100%;
        min-height: 0;
        grid-template-rows: auto auto minmax(0, 1fr) auto;
        background: #0d0c14;
      }

      .rml-graph-palette-search {
        margin: 10px 10px 8px;
      }

      .rml-graph-palette-search input {
        min-height: 34px;
        padding: 7px 9px;
        font-size: 10px;
      }

      .rml-graph-palette-mode {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr);
        align-items: start;
        gap: 8px;
        margin: 0 10px 8px;
        padding: 8px 9px;
        border: 1px solid #2d3440;
        border-radius: 8px;
        background: rgba(18, 21, 29, 0.86);
        color: #c7d0d8;
        cursor: pointer;
        text-transform: none;
      }

      .rml-graph-palette-mode input {
        width: 16px;
        height: 16px;
        min-height: 16px;
        margin: 1px 0 0;
      }

      .rml-graph-palette-mode span,
      .rml-graph-palette-mode strong,
      .rml-graph-palette-mode small {
        display: block;
        min-width: 0;
      }

      .rml-graph-palette-mode strong {
        font-size: 9px;
      }

      .rml-graph-palette-mode small {
        margin-top: 3px;
        color: #7f8b97;
        font-size: 7px;
        font-weight: 500;
        line-height: 1.35;
        letter-spacing: 0;
        text-transform: none;
      }

      .rml-graph-palette-scroll {
        min-height: 0;
        overflow-x: hidden;
        overflow-y: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
      }

      .rml-graph-palette-group {
        margin: 0;
        padding: 7px 9px 0;
      }

      .rml-graph-palette-group > summary {
        display: grid;
        min-height: 29px;
        grid-template-columns: 1fr auto 10px;
        align-items: center;
        gap: 8px;
        padding: 5px 4px;
        border-radius: 6px;
        color: var(--faint);
        font-size: 9px;
        font-weight: 820;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        cursor: pointer;
        list-style: none;
        -webkit-user-select: none;
        user-select: none;
      }

      .rml-graph-palette-group > summary::-webkit-details-marker {
        display: none;
      }

      .rml-graph-palette-group > summary:hover {
        background: rgba(164, 118, 255, 0.08);
        color: #b7a9d4;
      }

      .rml-graph-palette-group > summary:focus-visible {
        outline: 2px solid var(--accent-dark);
        outline-offset: 2px;
      }

      .rml-graph-palette-group > summary b {
        display: grid;
        min-width: 20px;
        height: 20px;
        place-items: center;
        border: 1px solid var(--line);
        border-radius: 6px;
        font-size: 8px;
        letter-spacing: 0;
      }

      .rml-graph-palette-group > summary::after {
        width: 7px;
        height: 7px;
        border-right: 2px solid currentColor;
        border-bottom: 2px solid currentColor;
        content: "";
        transform: rotate(45deg) translate(-1px, -1px);
        transition: transform 0.15s ease;
      }

      .rml-graph-palette-group:not([open]) > summary {
        margin-bottom: 0;
      }

      .rml-graph-palette-group:not([open]) > summary::after {
        transform: rotate(-45deg);
      }

      .rml-graph-palette-list {
        display: grid;
        gap: 6px;
        padding-bottom: 4px;
      }

      .rml-graph-palette-item {
        display: grid;
        width: 100%;
        min-height: 42px;
        grid-template-columns: 34px minmax(0, 1fr) auto;
        align-items: center;
        gap: 8px;
        padding: 4px 7px 4px 4px;
        border: 1px solid var(--line);
        border-radius: 8px;
        background: #171620;
        color: var(--text);
        text-align: left;
        cursor: grab;
        touch-action: none;
      }

      .rml-graph-palette-item:hover:not(:disabled) {
        border-color: #4d86ad;
        background: #1b2430;
      }

      .rml-graph-palette-item.expert {
        border-color: rgba(255, 209, 129, 0.28);
        background: rgba(45, 37, 25, 0.62);
      }

      .rml-graph-palette-item.expert > span {
        color: #ffd181;
      }

      .rml-graph-palette-item:disabled {
        cursor: default;
        opacity: 0.4;
      }

      .rml-graph-palette-item > span {
        display: grid;
        width: 34px;
        height: 32px;
        place-items: center;
        border-radius: 7px;
        background: #0b1119;
        color: #8fdcff;
        font-family: Consolas, monospace;
        font-size: 10px;
        font-weight: 900;
      }

      .rml-graph-palette-item strong {
        overflow: hidden;
        min-width: 0;
        font-size: 10px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rml-graph-palette-item small {
        color: var(--muted);
        font-size: 11px;
      }

      .rml-graph-palette-status {
        margin: 6px 9px;
        color: var(--faint);
        font-size: 8px;
        line-height: 1.3;
      }

      .rml-graph-root {
        position: relative;
        display: grid;
        width: 100%;
        height: 100%;
        min-height: 720px;
        grid-template-rows: 46px minmax(0, 1fr);
        overflow: hidden;
        background: #090b12;
        color: #f4f7fa;
      }

      .rml-graph-toolbar {
        position: relative;
        z-index: 40;
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 7px;
        padding: 6px 8px;
        border-bottom: 1px solid #242b35;
        background: rgba(13, 17, 24, 0.98);
      }

      .rml-graph-toolbar .button {
        min-height: 32px;
        padding-inline: 10px;
        font-size: 9px;
      }

      .rml-graph-compact-search-button {
        display: none;
        width: 32px;
        min-width: 32px;
        padding: 0 !important;
        place-items: center;
        font-size: 19px !important;
        line-height: 1;
      }

      .rml-graph-search-overlay {
        position: absolute;
        z-index: 120;
        inset: 0;
        display: grid;
        place-items: start center;
        padding: 58px 10px 10px;
        background: rgba(4, 5, 9, 0.72);
        -webkit-backdrop-filter: blur(5px);
        backdrop-filter: blur(5px);
      }

      .rml-graph-search-overlay[hidden] {
        display: none !important;
      }

      .rml-graph-search-overlay-card {
        display: grid;
        width: min(430px, 100%);
        gap: 10px;
        padding: 11px;
        border: 1px solid #3a4552;
        border-radius: 10px;
        background: rgba(13, 17, 24, 0.99);
        box-shadow: 0 20px 58px rgba(0, 0, 0, 0.62);
      }

      .rml-graph-search-overlay-head,
      .rml-graph-search-overlay-body {
        display: flex;
        min-width: 0;
        align-items: center;
        gap: 8px;
      }

      .rml-graph-search-overlay-head strong {
        min-width: 0;
        flex: 1 1 auto;
        font-size: 11px;
      }

      .rml-graph-search-overlay-close {
        display: grid;
        width: 30px;
        height: 30px;
        flex: 0 0 30px;
        padding: 0 0 2px;
        place-items: center;
        border: 1px solid #343b47;
        border-radius: 7px;
        background: #181d25;
        color: #c7d0d8;
        font-size: 20px;
        cursor: pointer;
      }

      .rml-graph-search-overlay-body input {
        width: auto;
        min-width: 0;
        min-height: 36px;
        flex: 1 1 auto;
      }

      .rml-graph-search-overlay-next {
        flex: 0 0 auto;
      }

      .rml-graph-root.rml-graph-compact-toolbar .rml-graph-node-search {
        display: none;
      }

      .rml-graph-root.rml-graph-compact-toolbar .rml-graph-compact-search-button {
        display: grid;
      }

      .rml-graph-root.rml-graph-compact-toolbar .rml-graph-source-badge {
        display: none;
      }

      .rml-graph-root.rml-graph-tiny-toolbar .rml-graph-toolbar {
        gap: 4px;
        padding-inline: 5px;
      }

      .rml-graph-root.rml-graph-tiny-toolbar .rml-graph-toolbar .button {
        padding-inline: 7px;
        font-size: 8px;
      }

      .rml-graph-source-badge {
        overflow: hidden;
        min-width: 0;
        margin-left: auto;
        padding: 6px 8px;
        border: 1px solid #2e3945;
        border-radius: 7px;
        color: #a8bac8;
        font-size: 8px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rml-graph-source-badge.outdated {
        border-color: rgba(255, 209, 129, 0.45);
        background: rgba(255, 209, 129, 0.08);
        color: #ffd993;
      }

      .rml-graph-viewport {
        position: relative;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        background:
          linear-gradient(rgba(255, 255, 255, 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(255, 255, 255, 0.025) 1px, transparent 1px),
          linear-gradient(rgba(86, 166, 222, 0.025) 1px, transparent 1px),
          linear-gradient(90deg, rgba(86, 166, 222, 0.025) 1px, transparent 1px),
          #080a10;
        background-size: 18px 18px, 18px 18px, 90px 90px, 90px 90px;
        cursor: grab;
        touch-action: none;
      }

      .rml-graph-viewport.panning {
        cursor: grabbing;
      }

      .rml-graph-stage {
        position: absolute;
        overflow: visible;
        top: 0;
        left: 0;
        width: ${GRAPH_STAGE_WIDTH}px;
        height: ${GRAPH_STAGE_HEIGHT}px;
        transform-origin: 0 0;
        will-change: transform;
      }

      .rml-graph-wires,
      .rml-graph-nodes {
        position: absolute;
        inset: 0;
        width: 100%;
        height: 100%;
      }

      .rml-graph-wires {
        z-index: 1;
        overflow: visible;
        pointer-events: none;
      }

      .rml-graph-nodes {
        z-index: 2;
        overflow: visible;
        pointer-events: none;
      }

      .rml-graph-wire-shadow {
        fill: none;
        stroke: rgba(0, 0, 0, 0.72);
        stroke-width: 8;
        stroke-linecap: round;
        pointer-events: none;
      }

      .rml-graph-wire {
        fill: none;
        stroke-width: 4;
        stroke-linecap: round;
        filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.7));
        pointer-events: none;
      }

      .rml-graph-wire.impulse {
        stroke-dasharray: 10 7;
      }

      .rml-graph-wire.selected {
        stroke-width: 6;
        filter: drop-shadow(0 0 6px currentColor);
      }

      .rml-graph-wire.branch-target-valid {
        stroke-width: 6;
        filter: drop-shadow(0 0 7px currentColor);
      }

      .rml-graph-wire.branch-target-invalid {
        opacity: 0.28;
      }

      .rml-graph-wire-hit {
        fill: none;
        stroke: transparent;
        stroke-width: 20;
        pointer-events: stroke;
        cursor: grab;
        touch-action: none;
      }

      .rml-graph-wire-hit:active {
        cursor: grabbing;
      }

      .rml-graph-wire-hit.branch-target-valid {
        stroke: rgba(108, 232, 155, 0.12);
        cursor: crosshair;
      }

      .rml-graph-wire-hit.branch-target-invalid {
        stroke: rgba(255, 113, 136, 0.08);
        cursor: not-allowed;
      }

      .rml-graph-wire-preview {
        fill: none;
        stroke-width: 4;
        stroke-linecap: round;
        stroke-dasharray: 8 6;
        pointer-events: none;
      }

      .rml-graph-wire-point {
        stroke: rgba(240, 248, 255, 0.96);
        stroke-width: 2;
        filter: drop-shadow(0 2px 5px rgba(0, 0, 0, 0.78));
        pointer-events: all;
        cursor: move;
        touch-action: none;
      }

      .rml-graph-wire-point.bend {
        fill: #111923;
        opacity: 0.58;
      }

      .rml-graph-wire-point.junction {
        opacity: 1;
        stroke-width: 3;
        filter:
          drop-shadow(0 0 5px currentColor)
          drop-shadow(0 2px 5px rgba(0, 0, 0, 0.82));
      }

      .rml-graph-wire-point.selected {
        opacity: 1;
        stroke: #ffffff;
        stroke-width: 4;
        filter:
          drop-shadow(0 0 8px currentColor)
          drop-shadow(0 2px 6px rgba(0, 0, 0, 0.86));
      }

      .rml-graph-wire-point:hover,
      .rml-graph-wire-point.dragging {
        opacity: 1;
        stroke: #ffffff;
        stroke-width: 4;
      }

      .rml-graph-node {
        position: absolute;
        display: grid;
        min-width: ${GRAPH_NODE_MIN_WIDTH}px;
        max-width: none;
        min-height: ${GRAPH_NODE_MIN_HEIGHT}px;
        grid-template-rows: auto auto;
        overflow: visible;
        box-sizing: border-box;
        border: 1px solid #34414f;
        border-radius: 10px;
        background: rgba(19, 23, 31, 0.98);
        box-shadow: 0 15px 42px rgba(0, 0, 0, 0.48);
        pointer-events: auto;
      }

      .rml-graph-node.configuration {
        border-color: rgba(88, 191, 255, 0.62);
        background: rgba(16, 28, 39, 0.99);
      }

      .rml-graph-node.selected {
        border-color: #70cfff;
        box-shadow:
          0 0 0 2px rgba(88, 191, 255, 0.22),
          0 17px 48px rgba(0, 0, 0, 0.56);
      }

      .rml-graph-node-header {
        display: grid;
        min-height: 45px;
        grid-template-columns: 35px minmax(0, 1fr) 27px 27px;
        align-items: center;
        gap: 7px;
        padding: 5px 6px;
        border-bottom: 1px solid #2a3440;
        border-radius: 9px 9px 0 0;
        background: linear-gradient(180deg, #222b36, #171d25);
        cursor: grab;
        touch-action: none;
      }

      .rml-graph-node-header:active {
        cursor: grabbing;
      }

      .rml-graph-node-symbol {
        display: grid;
        width: 34px;
        height: 33px;
        place-items: center;
        border: 1px solid rgba(102, 186, 235, 0.25);
        border-radius: 7px;
        background: #0c131b;
        color: #9de0ff;
        font-family: Consolas, monospace;
        font-size: 10px;
        font-weight: 900;
      }

      .rml-graph-node-title {
        min-width: 0;
      }

      .rml-graph-node-title strong,
      .rml-graph-node-title small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rml-graph-node-title strong {
        font-size: 11px;
      }

      .rml-graph-node-title small {
        margin-top: 2px;
        color: #8f9ba7;
        font-size: 8px;
      }

      .rml-graph-node-flip,
      .rml-graph-node-delete {
        display: grid;
        width: 27px;
        height: 27px;
        padding: 0;
        place-items: center;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: #8e99a4;
        font-size: 17px;
        cursor: pointer;
      }

      .rml-graph-node-flip:hover {
        border-color: rgba(88, 191, 255, 0.42);
        background: rgba(88, 191, 255, 0.1);
        color: #9de0ff;
      }

      .rml-graph-node-delete:hover {
        border-color: rgba(255, 113, 136, 0.35);
        background: rgba(255, 113, 136, 0.08);
        color: #ff8a9b;
      }

      .rml-graph-node-body {
        display: block;
        min-width: 0;
        min-height: 0;
        overflow: hidden;
        overscroll-behavior: contain;
        cursor: default;
        scrollbar-width: thin;
      }

      .rml-graph-node-body-content {
        display: grid;
        width: 100%;
        min-width: 0;
        grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
        gap: 12px;
        padding: 8px 0 9px;
        box-sizing: border-box;
      }

      .rml-graph-node-body-content.outputs-only,
      .rml-graph-node-body-content.inputs-only {
        grid-template-columns: minmax(0, 1fr);
      }

      .rml-graph-node-body-content.outputs-only .outputs {
        grid-column: 1;
      }

      .rml-graph-node.configuration .rml-graph-node-body {
        max-height: 560px;
        overflow: auto;
        overscroll-behavior: contain;
        scrollbar-width: thin;
        touch-action: pan-x pan-y;
      }

      .rml-graph-node.configuration .rml-graph-node-body-content {
        display: block;
      }

      .rml-graph-node.manually-sized-height {
        grid-template-rows: auto minmax(0, 1fr);
      }

      .rml-graph-node.manually-sized-width .rml-graph-node-body,
      .rml-graph-node.manually-sized-height .rml-graph-node-body {
        overflow: auto;
        touch-action: pan-x pan-y;
      }

      .rml-graph-node.configuration.manually-sized-height .rml-graph-node-body {
        max-height: none;
      }

      .rml-graph-node.resizing {
        user-select: none;
      }

      .rml-graph-node-resize-handle {
        position: absolute;
        z-index: 15;
        padding: 0;
        border: 0;
        background: transparent;
        opacity: 0;
        pointer-events: none;
        touch-action: none;
        transition: opacity 100ms ease;
      }

      .rml-graph-node:hover .rml-graph-node-resize-handle,
      .rml-graph-node.selected .rml-graph-node-resize-handle,
      .rml-graph-node.resizing .rml-graph-node-resize-handle {
        opacity: 1;
        pointer-events: auto;
      }

      .rml-graph-node-resize-handle.width {
        top: 45px;
        right: -4px;
        bottom: 11px;
        width: 8px;
        cursor: ew-resize;
      }

      .rml-graph-node-resize-handle.height {
        right: 11px;
        bottom: -4px;
        left: 11px;
        height: 8px;
        cursor: ns-resize;
      }

      .rml-graph-node-resize-handle.both {
        right: -5px;
        bottom: -5px;
        width: 15px;
        height: 15px;
        border-right: 2px solid rgba(112, 207, 255, 0.72);
        border-bottom: 2px solid rgba(112, 207, 255, 0.72);
        border-radius: 0 0 4px 0;
        cursor: nwse-resize;
      }

      .rml-graph-node-resize-handle.width::after,
      .rml-graph-node-resize-handle.height::after {
        position: absolute;
        border-radius: 999px;
        background: rgba(112, 207, 255, 0.58);
        content: "";
      }

      .rml-graph-node-resize-handle.width::after {
        top: 25%;
        right: 2px;
        bottom: 25%;
        width: 2px;
      }

      .rml-graph-node-resize-handle.height::after {
        right: 25%;
        bottom: 2px;
        left: 25%;
        height: 2px;
      }

      .rml-graph-port-column {
        display: grid;
        min-width: 0;
        align-content: start;
        gap: 4px;
      }

      .rml-graph-port-column:empty {
        display: none;
      }

      .rml-graph-port-row {
        position: relative;
        display: grid;
        min-height: 31px;
        align-items: center;
        gap: 5px;
      }

      .rml-graph-port-row.input {
        grid-template-columns: 17px minmax(0, 1fr);
        padding-right: 4px;
      }

      .rml-graph-port-row.output {
        grid-template-columns: minmax(0, 1fr) 17px;
        padding-left: 4px;
      }

      .rml-graph-node.configuration .rml-graph-port-row.output {
        grid-template-columns: minmax(0, 1fr) 19px;
        padding-left: 9px;
      }

      .rml-graph-port-copy {
        min-width: 0;
      }

      .rml-graph-port-copy strong,
      .rml-graph-port-copy small {
        display: block;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rml-graph-port-copy strong {
        color: #e9edf1;
        font-size: 9px;
      }

      .rml-graph-port-copy small {
        margin-top: 2px;
        color: #8794a0;
        font-size: 7px;
      }

      .rml-graph-port-row.output .rml-graph-port-copy {
        text-align: right;
      }

      /* Physical socket side is independent from semantic input/output. */
      .rml-graph-port-row.side-left {
        grid-template-columns: 17px minmax(0, 1fr);
        padding-left: 0;
        padding-right: 4px;
      }

      .rml-graph-port-row.side-right {
        grid-template-columns: minmax(0, 1fr) 17px;
        padding-left: 4px;
        padding-right: 0;
      }

      .rml-graph-node.configuration .rml-graph-port-row.side-left {
        grid-template-columns: 19px minmax(0, 1fr);
        padding-left: 0;
        padding-right: 9px;
      }

      .rml-graph-node.configuration .rml-graph-port-row.side-right {
        grid-template-columns: minmax(0, 1fr) 19px;
        padding-left: 9px;
        padding-right: 0;
      }

      .rml-graph-port-row.side-left .rml-graph-port-copy {
        text-align: left;
      }

      .rml-graph-port-row.side-right .rml-graph-port-copy {
        text-align: right;
      }

      .rml-graph-socket {
        position: relative;
        z-index: 20;
        display: block;
        width: 14px;
        height: 14px;
        padding: 0;
        border: 2px solid #0a0d12;
        border-radius: 50%;
        outline: 1px solid color-mix(in srgb, var(--port-color) 78%, white);
        background: var(--port-color);
        cursor: crosshair;
        touch-action: none;
        box-shadow: 0 0 7px color-mix(in srgb, var(--port-color) 46%, transparent);
      }

      .rml-graph-socket.shape-square {
        border-radius: 2px;
      }

      .rml-graph-socket.shape-triangle {
        border: 0;
        border-radius: 0;
        outline: 0;
        clip-path: polygon(8% 0, 100% 50%, 8% 100%);
      }

      .rml-graph-socket.shape-diamond {
        width: 12px;
        height: 12px;
        border-radius: 2px;
        transform: rotate(45deg);
      }

      .rml-graph-socket:hover,
      .rml-graph-socket.valid-target {
        filter: brightness(1.18);
        box-shadow:
          0 0 0 3px color-mix(in srgb, var(--port-color) 28%, transparent),
          0 0 11px var(--port-color);
      }

      .rml-graph-socket.invalid-target {
        cursor: not-allowed;
        opacity: 0.2;
        filter: grayscale(1);
      }

      .rml-graph-socket.connected::after {
        position: absolute;
        inset: 3px;
        border-radius: inherit;
        background: #0b1016;
        content: "";
      }

      .rml-graph-display-value {
        grid-column: 1 / -1;
        display: grid;
        gap: 4px;
        margin: 3px 8px 0;
        padding: 8px 9px;
        border: 1px solid rgba(89, 183, 255, 0.35);
        border-radius: 7px;
        background: rgba(7, 14, 22, 0.9);
        box-shadow: inset 0 0 18px rgba(89, 183, 255, 0.045);
      }

      .rml-graph-display-value span {
        color: #7fa3ba;
        font-size: 7px;
        font-weight: 800;
        letter-spacing: 0.09em;
        text-transform: uppercase;
      }

      .rml-graph-display-value output {
        overflow: hidden;
        color: #dff5ff;
        font-family: Consolas, "Courier New", monospace;
        font-size: 10px;
        font-weight: 700;
        line-height: 1.35;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rml-graph-display-value.unknown output {
        color: #ffd181;
      }

      .rml-graph-node-footer-note {
        grid-column: 1 / -1;
        margin: 2px 8px 0;
        padding-top: 7px;
        border-top: 1px solid #28323d;
        color: #7f8c98;
        font-size: 7px;
        line-height: 1.4;
      }

      .rml-graph-toast {
        position: absolute;
        z-index: 80;
        right: 12px;
        bottom: 12px;
        max-width: min(430px, calc(100% - 24px));
        padding: 9px 11px;
        border: 1px solid #465766;
        border-radius: 8px;
        background: rgba(14, 21, 29, 0.96);
        color: #dfeaf0;
        font-size: 9px;
        line-height: 1.45;
        box-shadow: 0 10px 34px rgba(0, 0, 0, 0.45);
        pointer-events: none;
      }

      .rml-graph-toast.error {
        border-color: rgba(255, 113, 136, 0.58);
        color: #ffc0ca;
      }

      .rml-graph-toast.success {
        border-color: rgba(108, 232, 155, 0.58);
        color: #b9f4d0;
      }

      .rml-graph-palette-ghost {
        position: fixed;
        z-index: 999999;
        top: 0;
        left: 0;
        display: grid;
        min-width: 190px;
        max-width: 260px;
        grid-template-columns: 34px minmax(0, 1fr);
        align-items: center;
        gap: 8px;
        padding: 7px;
        border: 1px solid #58bfff;
        border-radius: 9px;
        background: rgba(18, 27, 37, 0.96);
        color: #e7f5ff;
        font-size: 10px;
        pointer-events: none;
        opacity: 0.9;
        box-shadow: 0 16px 44px rgba(0, 0, 0, 0.54);
        transform: translate3d(-10000px, -10000px, 0);
      }

      .rml-graph-palette-ghost span {
        display: grid;
        width: 34px;
        height: 32px;
        place-items: center;
        border-radius: 7px;
        background: #0a121b;
        color: #8fdcff;
        font-weight: 900;
      }

      .rml-graph-inspector {
        display: grid;
        align-content: start;
        gap: 11px;
        padding: 12px;
      }

      .rml-graph-inspector-card {
        display: grid;
        gap: 8px;
        padding: 11px;
        border: 1px solid var(--line);
        border-radius: 9px;
        background: rgba(8, 11, 17, 0.48);
      }

      .rml-graph-inspector-card h3 {
        margin: 0;
        font-size: 12px;
      }

      .rml-graph-inspector-card p {
        margin: 0;
        color: var(--muted);
        font-size: 9px;
        line-height: 1.5;
      }

      .rml-graph-inspector-card label {
        font-size: 8px;
      }

      .rml-graph-inspector-card input:not(.custom-color-slider),
      .rml-graph-inspector-card select,
      .rml-graph-inspector-card textarea {
        min-height: 35px;
      }

      .rml-graph-inspector-card textarea {
        width: 100%;
        resize: vertical;
        line-height: 1.45;
      }

      .rml-graph-colorx-editor {
        width: 100%;
        gap: 10px;
        padding: 10px;
        border-color: rgba(255, 103, 220, 0.3);
        background: rgba(16, 10, 19, 0.56);
      }

      .rml-graph-colorx-editor .custom-color-sv {
        min-height: 158px;
      }

      .rml-graph-colorx-editor .custom-color-result {
        max-width: 100%;
      }

      .rml-graph-colorx-editor .custom-color-result strong {
        max-width: none;
      }

      .rml-graph-colorx-editor > label {
        font-size: 8px;
      }

      .rml-graph-colorx-help {
        color: var(--faint);
        font-size: 8px;
        font-weight: 500;
        line-height: 1.45;
        letter-spacing: 0;
        text-transform: none;
      }

      .rml-graph-auto-type-status {
        display: block;
        margin: -4px 0 2px;
        padding: 7px 9px;
        border: 1px solid rgba(89, 183, 255, 0.18);
        border-radius: 7px;
        background: rgba(25, 45, 62, 0.32);
        color: #9fc9e7;
        font-size: 8px;
        font-weight: 550;
        line-height: 1.4;
      }

      .rml-graph-code-input {
        font-family: Consolas, "Courier New", monospace !important;
        font-size: 9px !important;
        tab-size: 4;
        white-space: pre;
      }

      .rml-graph-inspector-type-list {
        display: grid;
        gap: 5px;
      }

      .rml-graph-inspector-type-row {
        display: grid;
        grid-template-columns: 10px minmax(0, 1fr) auto;
        align-items: center;
        gap: 7px;
        color: #b8c2cb;
        font-size: 8px;
      }

      .rml-graph-inspector-type-row i {
        width: 9px;
        height: 9px;
        border-radius: 50%;
        background: var(--type-color);
        box-shadow: 0 0 6px var(--type-color);
      }

      .rml-graph-inspector-actions {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 7px;
      }

      .rml-graph-inspector-actions .button {
        width: 100%;
        min-height: 35px;
        padding-inline: 7px;
        font-size: 9px;
      }

      .rml-workspace-toggle-title {
        display: grid !important;
        grid-template-columns: auto max-content minmax(0, 1fr) max-content auto;
        align-items: center;
        justify-content: stretch !important;
        column-gap: 8px !important;
      }

      .rml-workspace-toggle-title > .rml-graph-panel-toggle-left {
        grid-column: 1;
      }

      .rml-workspace-toggle-title > span {
        grid-column: 2;
        justify-self: start;
      }

      .rml-workspace-toggle-title > em {
        grid-column: 4;
        min-width: 0;
        max-width: none;
        width: auto;
        justify-self: end;
      }

      .rml-workspace-toggle-title > .rml-graph-panel-toggle-right {
        grid-column: 5;
      }

      .rml-graph-panel-toggle {
        display: grid;
        width: 28px;
        height: 28px;
        min-height: 28px;
        flex: 0 0 28px;
        place-items: center;
        padding: 0;
        border: 1px solid rgba(64, 58, 85, 0.72);
        border-radius: 7px;
        background: rgba(13, 12, 19, 0.42);
        color: #bda9eb;
        font-size: 14px;
        font-weight: 900;
        line-height: 1;
        cursor: pointer;
        box-shadow: inset 0 1px rgba(255, 255, 255, 0.025);
        transition:
          border-color 0.12s ease,
          background 0.12s ease,
          color 0.12s ease;
      }

      .rml-graph-panel-toggle:hover {
        border-color: var(--accent-dark);
        background: rgba(164, 118, 255, 0.1);
        color: #eadfff;
      }

      .rml-graph-panel-toggle:focus-visible {
        outline: 2px solid var(--accent-dark);
        outline-offset: 2px;
      }

      body.rml-graph-left-collapsed .workspace > .palette,
      body.rml-graph-right-collapsed .workspace > .inspector {
        display: none !important;
      }

      body.rml-graph-left-collapsed:not(.rml-graph-right-collapsed) .workspace {
        grid-template-columns: minmax(470px, 1fr) 320px;
      }

      body.rml-graph-right-collapsed:not(.rml-graph-left-collapsed) .workspace {
        grid-template-columns: 230px minmax(470px, 1fr);
      }

      body.rml-graph-left-collapsed.rml-graph-right-collapsed .workspace {
        grid-template-columns: minmax(0, 1fr);
      }

      .rml-graph-searchable-select {
        position: relative;
        display: block;
        width: 100%;
        min-width: 0;
      }

      .rml-graph-searchable-native-select {
        position: absolute !important;
        width: 1px !important;
        height: 1px !important;
        min-height: 0 !important;
        margin: -1px !important;
        padding: 0 !important;
        overflow: hidden !important;
        clip: rect(0 0 0 0) !important;
        clip-path: inset(50%) !important;
        border: 0 !important;
        white-space: nowrap !important;
        pointer-events: none !important;
      }

      .rml-graph-searchable-trigger {
        position: relative;
        display: flex;
        width: 100%;
        min-width: 0;
        min-height: 35px;
        align-items: center;
        gap: 8px;
        padding: 8px 34px 8px 10px;
        border: 1px solid var(--line);
        border-radius: 7px;
        outline: none;
        background: var(--panel-deep);
        color: var(--text);
        font-size: 11px;
        font-weight: 520;
        line-height: 1.2;
        text-align: left;
        cursor: pointer;
      }

      .rml-graph-searchable-trigger:hover {
        border-color: var(--line-strong);
        background: #12101a;
      }

      .rml-graph-searchable-trigger:focus-visible,
      .rml-graph-searchable-select.open .rml-graph-searchable-trigger {
        border-color: var(--accent-dark);
        box-shadow: 0 0 0 3px var(--accent-soft);
      }

      .rml-graph-searchable-trigger::after {
        position: absolute;
        top: 50%;
        right: 11px;
        width: 7px;
        height: 7px;
        border-right: 2px solid var(--muted);
        border-bottom: 2px solid var(--muted);
        content: "";
        transform: translateY(-67%) rotate(45deg);
        transition:
          transform 120ms ease,
          border-color 120ms ease;
        pointer-events: none;
      }

      .rml-graph-searchable-select.open .rml-graph-searchable-trigger::after {
        border-color: #d0bbff;
        transform: translateY(-30%) rotate(225deg);
      }

      .rml-graph-searchable-trigger-text {
        display: block;
        min-width: 0;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rml-graph-searchable-popup {
        position: fixed;
        z-index: 100000;
        display: grid;
        min-width: 180px;
        max-width: min(560px, calc(100vw - 16px));
        gap: 6px;
        padding: 7px;
        border: 1px solid var(--line-strong);
        border-radius: 9px;
        background:
          linear-gradient(
            180deg,
            rgba(24, 22, 34, 0.995),
            rgba(13, 12, 19, 0.995)
          );
        box-shadow:
          0 18px 48px rgba(0, 0, 0, 0.58),
          inset 0 1px rgba(255, 255, 255, 0.035);
      }

      .rml-graph-searchable-popup[hidden] {
        display: none;
      }

      .rml-graph-searchable-search {
        width: 100%;
        min-height: 34px;
        padding: 7px 9px;
        border: 1px solid var(--line);
        border-radius: 7px;
        outline: none;
        background: #0b0a11;
        color: var(--text);
        font-size: 10px;
        font-weight: 520;
      }

      .rml-graph-searchable-search:focus {
        border-color: var(--accent-dark);
        box-shadow: 0 0 0 3px var(--accent-soft);
      }

      .rml-graph-searchable-options {
        display: grid;
        max-height: min(280px, 46vh);
        gap: 3px;
        overflow-y: auto;
        overscroll-behavior: contain;
        padding: 1px;
        scrollbar-width: thin;
        scrollbar-color: var(--line-strong) transparent;
      }

      .rml-graph-searchable-options::-webkit-scrollbar {
        width: 8px;
      }

      .rml-graph-searchable-options::-webkit-scrollbar-thumb {
        border: 2px solid transparent;
        border-radius: 8px;
        background: var(--line-strong);
        background-clip: padding-box;
      }

      .rml-graph-searchable-option {
        display: block;
        width: 100%;
        min-height: 30px;
        padding: 7px 9px;
        overflow: hidden;
        border: 1px solid transparent;
        border-radius: 6px;
        background: transparent;
        color: #d9d4e8;
        font-size: 10px;
        font-weight: 520;
        line-height: 1.25;
        text-align: left;
        text-overflow: ellipsis;
        white-space: nowrap;
        cursor: pointer;
      }

      .rml-graph-searchable-option:hover,
      .rml-graph-searchable-option:focus-visible {
        border-color: rgba(164, 118, 255, 0.38);
        outline: none;
        background: rgba(164, 118, 255, 0.10);
        color: #f2edff;
      }

      .rml-graph-searchable-option.selected {
        border-color: rgba(164, 118, 255, 0.64);
        background:
          linear-gradient(
            145deg,
            rgba(164, 118, 255, 0.20),
            rgba(125, 87, 216, 0.11)
          );
        color: #e5d9ff;
      }

      .rml-graph-searchable-option.selected::after {
        float: right;
        margin-left: 8px;
        color: #c6abff;
        content: "✓";
        font-weight: 900;
      }

      .rml-graph-searchable-empty {
        padding: 12px 10px;
        color: var(--faint);
        font-size: 9px;
        line-height: 1.4;
        text-align: center;
      }

      @media (max-width: 1180px) {
        body.rml-node-graph-mode .workspace {
          grid-template-columns: 220px minmax(0, 1fr);
        }

        body.rml-node-graph-mode .inspector {
          grid-column: 1 / -1;
        }

        body.rml-node-graph-mode #inspector-content {
          min-height: 0;
        }
      }

      @media (max-width: 1180px) {
        body.rml-node-graph-mode.rml-graph-left-collapsed:not(.rml-graph-right-collapsed) .workspace {
          grid-template-columns: minmax(0, 1fr);
        }

        body.rml-node-graph-mode.rml-graph-right-collapsed:not(.rml-graph-left-collapsed) .workspace {
          grid-template-columns: 220px minmax(0, 1fr);
        }

        body.rml-node-graph-mode.rml-graph-left-collapsed.rml-graph-right-collapsed .workspace {
          grid-template-columns: minmax(0, 1fr);
        }
      }

      @media (max-width: 780px) {
        #pack-into-node {
          flex: 0 0 auto;
        }

        body.rml-node-graph-mode .workspace {
          display: grid;
          width: 100%;
          height: auto;
          min-height: 0;
          grid-template-columns: minmax(0, 1fr) !important;
        }

        body.rml-node-graph-mode .workspace > .palette,
        body.rml-node-graph-mode .workspace > .canvas,
        body.rml-node-graph-mode .workspace > .inspector {
          grid-column: 1 / -1;
          width: 100%;
          min-width: 0;
        }

        body.rml-node-graph-mode #palette-content {
          min-height: 340px;
          max-height: 480px;
        }

        body.rml-node-graph-mode #builder-canvas,
        .rml-graph-root {
          min-height: 68dvh;
        }

        .rml-graph-toolbar {
          overflow-x: auto;
          scrollbar-width: none;
        }

        .rml-graph-toolbar::-webkit-scrollbar {
          display: none;
        }

        .rml-graph-source-badge {
          flex: 0 0 auto;
          max-width: 190px;
        }
      }
    `;

    document.head.appendChild(style);
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
      button.addEventListener(
        "click",
        togglePackedNodeMode
      );

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

    const active = Boolean(graph?.active);

    dom.packButton.innerHTML = active
      ? `<svg class="rml-pack-back-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 12H5 M10 7l-5 5 5 5"></path></svg><span class="top-action-label">Back to Outline</span>`
      : `<span class="brand-mark rml-pack-brand-mark" aria-hidden="true"><span></span><span></span></span><span class="top-action-label">Pack into Node</span>`;

    dom.packButton.setAttribute(
      "aria-label",
      active ? "Back to Configuration Outline" : "Pack into Node"
    );

    dom.packButton.dataset.help =
      active
        ? "Return to the Configuration Outline. The packed graph is preserved."
        : "Pack the Configuration Outline into the synchronized typed runtime graph.";

    dom.packButton.classList.toggle(
      "graph-active",
      Boolean(graph?.active)
    );

    const sourceNodes =
      bridge?.getStateSnapshot()
        ?.nodes || [];

    dom.packButton.disabled =
      sourceNodes.length === 0;

    dom.packButton.dataset.help =
      sourceNodes.length === 0
        ? "Add at least one configuration item first."
        : graph?.active
          ? "Return to the Configuration Outline. The packed graph is preserved."
          : "Replace the visual outline with an automatically synchronized typed node graph.";
    dom.packButton.removeAttribute("title");
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

    if (!graph?.active) {
      window.alert(text);
      return;
    }

    if (!dom.toast) {
      return;
    }

    dom.toast.textContent = text;
    dom.toast.className =
      `rml-graph-toast${
        tone
          ? ` ${tone}`
          : ""
      }`;
    dom.toast.hidden = false;

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

  function togglePackedNodeMode() {
    if (graph?.active) {
      unpackToOutline();
    } else {
      packIntoNode();
    }
  }

  function synchronizePackedSnapshot(
    render = true
  ) {
    if (!graph?.active) {
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

    graph.configSnapshot =
      snapshot;
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
    return true;
  }

  function schedulePackedSnapshotSync() {
    clearTimeout(
      packedSnapshotSyncTimer
    );

    if (!graph?.active) {
      return;
    }

    packedSnapshotSyncTimer =
      window.setTimeout(() => {
        packedSnapshotSyncTimer = 0;
        synchronizePackedSnapshot(true);
      }, 60);
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
    graph.configSnapshot =
      snapshot;
    graph.sourceSignature =
      snapshotSignature(snapshot);

    const configNode =
      ensureConfigurationNode();

    graph.selectedNodeId =
      configNode.id;
    graph.selectedConnectionId =
      null;
    clearSelectedWirePoint();

    pruneConnections();
    persistGraph(true);
    activateGraphMode();

    requestAnimationFrame(() => {
      centerGraph();
    });

    showGraphMessage(
      "Configuration packed into an automatically synchronized typed start node.",
      "success"
    );
  }

  function unpackToOutline() {
    cancelInteraction(true);
    graph.active = false;
    graph.selectedNodeId = null;
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    persistGraph(true);
    deactivateGraphMode();
    bridge.requestPaletteRender();
    bridge.requestRender();
    updatePackButton();
  }

  function clearGraphOperators() {
    if (
      !window.confirm(
        "Remove all operator nodes and wires, while keeping the packed configuration node?"
      )
    ) {
      return;
    }

    graph.nodes =
      graph.nodes.filter(
        node =>
          node.kind ===
          "configuration"
      );
    graph.connections = [];
    graph.selectedNodeId =
      graph.nodes[0]?.id || null;
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    currentAnalysis =
      analyzeConnections([]);
    persistGraph(true);
    renderGraphCanvas();
    renderGraphPalette();
    renderGraphInspector();
  }

  function loadGraphPanelLayout() {
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
      // Layout persistence is optional.
    }
  }

  function applyGraphPanelLayout() {
    document.body.classList.toggle(
      "rml-graph-left-collapsed",
      graphLeftPanelCollapsed
    );
    document.body.classList.toggle(
      "rml-graph-right-collapsed",
      graphRightPanelCollapsed
    );

    if (dom.leftPanelToggle) {
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

    requestAnimationFrame(() => {
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

  function activateGraphMode() {
    cacheDom();

    document.body.classList.add(
      "rml-node-graph-mode"
    );

    loadGraphPanelLayout();
    ensureGraphPanelToggles();

    if (dom.paletteTitle) {
      dom.paletteTitle.innerHTML =
        "<small>Step 2</small> Node library";
    }

    if (dom.canvasTitle) {
      dom.canvasTitle.innerHTML =
        "<small>Step 3</small> Typed runtime graph";
    }

    if (dom.inspectorTitle) {
      dom.inspectorTitle.innerHTML =
        "<small>Step 4</small> Node inspector";
    }

    if (dom.activeContainerName) {
      dom.activeContainerName.textContent =
        "Exact type matching";
    }

    renderGraphPalette();
    renderGraphCanvas();
    renderGraphInspector();
    updatePackButton();
  }

  function deactivateGraphMode() {
    clearGraphScrollLayerSelection();
    graphScrollLayerOutline?.remove();
    graphScrollLayerIndicator?.remove();
    graphScrollLayerOutline = null;
    graphScrollLayerIndicator = null;

    document.body.classList.remove(
      "rml-node-graph-mode"
    );

    loadGraphPanelLayout();
    ensureGraphPanelToggles();

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

    dom.root = null;
    dom.toolbar = null;
    dom.viewport = null;
    dom.stage = null;
    dom.wires = null;
    dom.nodesHost = null;
    dom.toast = null;
    dom.sourceBadge = null;
  }

  function createPaletteItem(
    operatorId,
    definition,
    isConfiguration = false
  ) {
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

    if (isConfiguration) {
      button.dataset.graphConfiguration =
        "true";
      button.disabled =
        graph.nodes.some(
          node =>
            node.kind ===
            "configuration"
        );
    }

    const symbol =
      document.createElement("span");
    symbol.textContent =
      definition.symbol;

    const title =
      document.createElement("strong");
    title.textContent =
      definition.title;

    const add =
      document.createElement("small");
    add.textContent =
      button.disabled
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
      () => {
        if (
          performance.now() <
          paletteDragSuppressClickUntil
        ) {
          return;
        }

        addPaletteNodeAtCenter(
          operatorId,
          isConfiguration
        );
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

  function renderGraphPalette() {
    if (
      !graph.active ||
      !dom.paletteContent
    ) {
      return;
    }

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
      "Type at least 2 characters for API nodes…";
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

    const scroll =
      document.createElement("div");
    scroll.className =
      "rml-graph-palette-scroll";



    root.append(
      searchWrap,
      modeWrap,
      scroll
    );
    dom.paletteContent.appendChild(root);

    const allEntries =
      Object.entries(
        OPERATOR_DEFINITIONS
      );

    const MAX_SEARCH_RESULTS = 240;
    let searchTimer = 0;

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

    const appendGroup = (
      group,
      entries,
      options = {}
    ) => {
      if (entries.length === 0) {
        return;
      }

      const details =
        document.createElement("details");
      details.className =
        "rml-graph-palette-group";
      details.open =
        options.open !== false;

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

    const appendMessage = text => {
      const message =
        document.createElement("div");
      message.className =
        "rml-graph-palette-status";
      message.textContent = text;
      scroll.appendChild(message);
    };

    const renderEntries = () => {
      scroll.replaceChildren();

      const configGroup =
        document.createElement("details");
      configGroup.className =
        "rml-graph-palette-group";
      configGroup.open = true;

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
      scroll.appendChild(
        configGroup
      );

      const query =
        search.value
          .trim()
          .toLowerCase();

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
            (
              !showAdvanced &&
              definition.expertOnly === true
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

        if (matching.length === 0) {
          appendMessage(
            "No node matches this search."
          );
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
              entries,
              { open: true }
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
            entries,
            { open: true }
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

        return;
      }

      const normalGroups =
        new Map();

      for (
        const entry of allEntries
      ) {
        const [, definition] = entry;

        if (
          definition.hiddenFromPalette === true ||
          definition.catalogGenerated === true ||
          (
            !showAdvanced &&
            definition.expertOnly === true
          )
        ) {
          continue;
        }

        const group =
          definition.group ||
          "Other";

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
          entries,
          {
            open:
              group !== "Conversions" &&
              group !== "Advanced / Raw C#"
          }
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

    };

    modeInput.addEventListener(
      "change",
      () => {
        graph.showAdvancedNodes =
          modeInput.checked;
        persistGraph(true);
        renderEntries();
      }
    );

    search.addEventListener(
      "input",
      () => {
        clearTimeout(searchTimer);

        searchTimer =
          window.setTimeout(
            renderEntries,
            70
          );
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
        clone(
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
    let x = clamp(
      requestedX,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );
    let y = clamp(
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

    if (!definition) {
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
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    currentAnalysis =
      analyzeConnections(
        graph.connections
      );
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();
    renderGraphPalette();

    if (fitAfter) {
      requestAnimationFrame(() => {
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

  function fallbackConcreteTypeForPort(
    portRef
  ) {
    if (portRef?.spec?.type) {
      return portRef.spec.type;
    }

    const configured =
      portRef?.node?.parameters?.valueType;

    if (
      configured &&
      configured !== "auto"
    ) {
      return configured;
    }

    switch (
      portRef?.spec?.constraint ||
      "value"
    ) {
      case "scalar":
      case "ordered":
      case "arithmetic":
      case "interpolatable":
        return "float";

      case "reference":
      case "value":
      case "anyValue":
      case "serializable":
      default:
        return "object";
    }
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

    if (isScalarNumericType(valueType)) {
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
      return {
        operatorId:
          "catalog.enumConstant",
        outputPort: "value"
      };
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
      floatQ: ["transform.quaternionIdentity", "rotation"],
      primitive: ["resonite.primitiveConstant", "value"],
      blendMode: ["material.blendModeConstant", "value"],
      textureWrapMode: ["asset.textureWrapModeConstant", "value"],
      object: ["constant.nullObject", "value"],
      stringArray: ["constant.stringArray", "value"],
      engine: ["resonite.currentEngine", "engine"],
      world: ["resonite.focusedWorld", "world"],
      task: ["task.completedTask", "task"],
      radiantDash: ["resonite.radiantDash", "dash"]
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

      case "catalog.enumConstant":
        node.parameters.enumType =
          valueType.startsWith(
            "apiEnum:"
          )
            ? valueType.slice(
                "apiEnum:".length
              )
            : node.parameters.enumType;
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
      requestedX = clamp(
        requestedX,
        visibleBounds.left + margin,
        Math.max(
          visibleBounds.left + margin,
          visibleBounds.right -
            width -
            margin
        )
      );
      requestedY = clamp(
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
      node.x = clamp(
        node.x,
        visibleBounds.left + margin,
        Math.max(
          visibleBounds.left + margin,
          visibleBounds.right -
            width -
            margin
        )
      );
      node.y = clamp(
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
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();
    renderGraphPalette();

    if (fitAfter) {
      requestAnimationFrame(() => {
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

    if (isConfiguration) {
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
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    renderGraphNodesAndWires();
    renderGraphInspector();

    const element = dom.nodesHost?.querySelector(
      `[data-graph-node-id="${CSS.escape(node.id)}"]`
    );
    const rectangle = dom.viewport?.getBoundingClientRect();
    if (element && rectangle) {
      const width = element.offsetWidth || 280;
      const height = element.offsetHeight || 180;
      graph.viewport.x = rectangle.width / 2 - (node.x + width / 2) * graph.viewport.scale;
      graph.viewport.y = rectangle.height / 2 - (node.y + height / 2) * graph.viewport.scale;
      applyViewportTransform();
      persistGraph();
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
      !dom.builderCanvas
    ) {
      return;
    }

    cancelInteraction(false);
    pruneConnections();

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
      createToolbarButton(
        "Unpack to Outline",
        unpackToOutline
      ),
      createToolbarButton(
        "Center Graph",
        centerGraph
      ),
      createToolbarButton(
        "Clear Operators",
        clearGraphOperators
      )
    );

    const zoomOut =
      createToolbarButton(
        "−",
        () => zoomGraphBy(-0.1)
      );
    zoomOut.title = "Zoom out";
    const zoomIn =
      createToolbarButton(
        "+",
        () => zoomGraphBy(0.1)
      );
    zoomIn.title = "Zoom in";
    toolbar.append(
      zoomOut,
      zoomIn
    );

    const nodeSearch = document.createElement("div");
    nodeSearch.className = "rml-graph-node-search";
    const nodeSearchInput = document.createElement("input");
    nodeSearchInput.type = "search";
    nodeSearchInput.placeholder = "Find node in graph…";
    nodeSearchInput.autocomplete = "off";
    const nodeSearchNext = createToolbarButton("Next", () =>
      focusGraphNodeSearch(nodeSearchInput.value, true)
    );
    nodeSearchNext.title = "Jump to the next matching node";
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
      createToolbarButton("⌕", () => {
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
          requestAnimationFrame(() => {
            input.focus({ preventScroll: true });
            input.select();
          });
        }
      });
    compactSearchButton.classList.add(
      "rml-graph-compact-search-button"
    );
    compactSearchButton.title = "Find node in graph";
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
          <button class="button secondary rml-graph-search-overlay-next" type="button">Next</button>
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
    viewport.appendChild(stage);

    const toast =
      document.createElement("div");
    toast.className =
      "rml-graph-toast";
    toast.hidden = true;
    viewport.appendChild(toast);

    root.append(
      toolbar,
      viewport
    );
    dom.builderCanvas.appendChild(root);

    dom.root = root;
    dom.toolbar = toolbar;
    dom.viewport = viewport;
    dom.stage = stage;
    dom.wires = svg;
    dom.nodesHost = nodesHost;
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
      const toolbarResizeObserver =
        new ResizeObserver(updateToolbarLayout);
      toolbarResizeObserver.observe(root);
    } else {
      window.addEventListener(
        "resize",
        updateToolbarLayout,
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

    applyViewportTransform();
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

    dom.stage.style.transform =
      `translate3d(${graph.viewport.x}px, ${graph.viewport.y}px, 0) ` +
      `scale(${graph.viewport.scale})`;

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
          persistGraphSoon();
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
              requestAnimationFrame(
                animateReveal
              );
          } else {
            graphRevealAnimationFrame = 0;
            persistGraphSoon();
          }
        };

        graphRevealAnimationFrame =
          requestAnimationFrame(
            animateReveal
          );

        return true;
      },
      100
    );
  }

  installGraphRevealProvider();

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
      clamp(
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
      clamp(
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
    persistGraph();
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
    persistGraph();
  }

  function graphDocumentScrollElement() {
    return (
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
        if (
          graphScrollLayerHitTestVisibleAt(
            element,
            x,
            y
          )
        ) {
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

  function graphScrollLayerIsUsable(
    descriptor
  ) {
    const element =
      resolveGraphScrollLayerElement(
        descriptor
      );

    if (!element) {
      return false;
    }

    if (
      descriptor.kind ===
        "html-root" ||
      descriptor.kind ===
        "document-root"
    ) {
      return true;
    }

    if (descriptor.kind === "root") {
      return Boolean(
        graph?.active &&
        dom.viewport
      );
    }

    if (!graphScrollLayerCanScroll(element)) {
      return false;
    }

    const rectangle =
      element.getBoundingClientRect();
    const viewportRectangle =
      graphVisibleViewportRectangle();

    if (!(
      rectangle.right >
        viewportRectangle.left &&
      rectangle.left <
        viewportRectangle.right &&
      rectangle.bottom >
        viewportRectangle.top &&
      rectangle.top <
        viewportRectangle.bottom
    )) {
      return false;
    }

    return graphScrollLayerHasExposedPixels(
      element,
      graphScrollLayerClipRectangle(
        element,
        descriptor
      )
    );
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
    const viewport =
      graphVisibleViewportRectangle();
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
        priority: isGeneratedCode ? -1000 : 0,
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

    return candidates;
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

    const html =
      graphScrollLayerDescriptor(
        document.documentElement
      );

    if (html) {
      const withoutHtml =
        refreshed.filter(
          descriptor =>
            descriptor.kind !==
            "html-root"
        );

      refreshed.length = 0;
      keys.clear();

      for (const descriptor of withoutHtml) {
        add(descriptor);
      }

      add(html);
    }

    return refreshed;
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

    outline.style.left =
      `${left}px`;
    outline.style.top =
      `${top}px`;
    outline.style.width =
      `${width}px`;
    outline.style.height =
      `${height}px`;
    outline.style.borderRadius =
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
    if (graphScrollLayerVisualFrame) {
      return;
    }

    graphScrollLayerVisualFrame =
      requestAnimationFrame(
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
          requestAnimationFrame(tick);
      } else {
        positionGraphScrollLayerVisual();
      }
    };

    graphScrollLayerVisualFollowFrame =
      requestAnimationFrame(tick);
  }

  function clearGraphScrollLayerSelection(
    options = {}
  ) {
    graphScrollLayerSelection = null;
    graphScrollLayerSelectionCandidates = null;
    graphScrollLayerSession = null;
    graphScrollLayerCycleAccumulator = 0;
    graphScrollLayerCycleDirection = 0;
    graphScrollLayerLastCycleAt = 0;

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
    graphScrollLayerCycleAccumulator = 0;
    graphScrollLayerCycleDirection = 0;

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
          document.documentElement
        )
      ].filter(Boolean);
    }

    const selectedIndex =
      candidates.findIndex(
        candidate =>
          candidate.key ===
          previousActiveKey
      );

    if (!graphScrollLayerSession) {
      graphScrollLayerSession = {
        candidates,
        index:
          selectedIndex >= 0
            ? selectedIndex
            : 0,
        modifierLabel:
          event.metaKey &&
          !event.ctrlKey
            ? "COMMAND + WHEEL"
            : "CTRL + WHEEL"
      };
      graphScrollLayerCycleAccumulator = 0;
      graphScrollLayerCycleDirection = 0;
      graphScrollLayerLastCycleAt = 0;
    } else {
      graphScrollLayerSession.candidates =
        candidates;
      graphScrollLayerSession.index =
        selectedIndex >= 0
          ? selectedIndex
          : clamp(
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

    if (direction !== 0) {
      if (
        graphScrollLayerCycleDirection !==
        direction
      ) {
        graphScrollLayerCycleAccumulator =
          0;
        graphScrollLayerCycleDirection =
          direction;
      }

      graphScrollLayerCycleAccumulator +=
        dominant;

      const now = performance.now();

      if (
        Math.abs(
          graphScrollLayerCycleAccumulator
        ) >=
          GRAPH_SCROLL_LAYER_CYCLE_THRESHOLD &&
        now - graphScrollLayerLastCycleAt >=
          GRAPH_SCROLL_LAYER_CYCLE_COOLDOWN_MS
      ) {
        graphScrollLayerSession.index =
          clamp(
            graphScrollLayerSession.index +
              (direction > 0 ? 1 : -1),
            0,
            candidates.length - 1
          );
        graphScrollLayerCycleAccumulator =
          0;
        graphScrollLayerLastCycleAt =
          now;
      }
    }

    const active =
      candidates[
        graphScrollLayerSession.index
      ];

    scheduleGraphScrollLayerVisualRefresh();
    showGraphScrollLayerIndicator(
      `${graphScrollLayerSession.modifierLabel} · GLOBAL OVERRIDE · ↓ OUTER / ↑ INNER`,
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
      scheduleNodeBodyWireRefresh();
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

  function handleGraphScrollLayerCancelClick(
    event
  ) {
    if (
      !graph?.active ||
      event.button !== 0 ||
      (
        !graphScrollLayerSelection &&
        !graphScrollLayerSession
      )
    ) {
      return;
    }

    const previous =
      graphScrollLayerSession
        ?.candidates?.[
          graphScrollLayerSession.index
        ] ||
      graphScrollLayerSelection;

    clearGraphScrollLayerSelection({
      keepIndicator: true
    });

    if (previous) {
      showGraphScrollLayerIndicator(
        "SCROLL LEVEL RELEASED",
        previous,
        {
          variant: "cancelled",
          duration: 900
        }
      );
    }
  }

  function handleGraphModifierKeyUp(
    event
  ) {
    if (
      !graph?.active ||
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
      const width =
        element?.offsetWidth ||
        (node.kind === "configuration"
          ? 390
          : 280);
      const height =
        element?.offsetHeight ||
        180;

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
    const scale = clamp(
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
    persistGraph(true);
  }

  function connectedPortKeys() {
    const keys = new Set();

    for (const connection of graph.connections) {
      keys.add(
        `output:${connection.fromNode}:${connection.fromPort}`
      );
      keys.add(
        `input:${connection.toNode}:${connection.toPort}`
      );
    }

    return keys;
  }

  function scheduleNodeBodyWireRefresh() {
    if (nodeBodyWireRefreshFrame) {
      return;
    }

    nodeBodyWireRefreshFrame =
      requestAnimationFrame(() => {
        nodeBodyWireRefreshFrame = 0;
        renderGraphWires();
      });
  }

  function scheduleRenderedNodeResizeLimitRefresh() {
    if (nodeResizeLimitRefreshFrame) {
      return;
    }

    nodeResizeLimitRefreshFrame =
      requestAnimationFrame(() => {
        nodeResizeLimitRefreshFrame = 0;
        refreshRenderedNodeResizeLimits();
        renderGraphWires();
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

    body.style.overflowY = hasY ? "auto" : "hidden";
    body.style.overflowX = hasX ? "auto" : "hidden";

    if (!hasY) body.scrollTop = 0;
    if (!hasX) body.scrollLeft = 0;

    scheduleNodeBodyWireRefresh();
  }

  function scheduleNodeBodyOverflowSync(article) {
    requestAnimationFrame(() => {
      syncNodeBodyOverflow(article);
      requestAnimationFrame(() =>
        syncNodeBodyOverflow(article)
      );
    });
  }


  function renderGraphNodesAndWires() {
    if (
      !dom.nodesHost ||
      !dom.wires
    ) {
      return;
    }

    pruneConnections();
    renderGraphNodes();

    requestAnimationFrame(() => {
      renderGraphWires();
    });

    if (dom.itemCount) {
      dom.itemCount.textContent =
        String(graph.nodes.length);
    }

    updateSourceBadge();

    requestAnimationFrame(
      refreshDisplayValueNodes
    );

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
    socket.style.setProperty(
      "--port-color",
      info.color
    );
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
    return definition?.width ||
      (node.kind === "configuration"
        ? 390
        : 280);
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

    article.style.width =
      `${manualWidth
        ? node.width
        : nodeDefaultWidth(node, definition)}px`;

    if (manualHeight) {
      article.style.height =
        `${node.height}px`;
    } else {
      article.style.removeProperty(
        "height"
      );
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

    return Math.ceil(
      context.measureText(text).width +
      Math.max(
        0,
        text.length - 1
      ) * letterSpacing
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
    const titleWidth = Math.max(
      intrinsicTextWidth(
        title?.querySelector("strong")
      ),
      intrinsicTextWidth(
        title?.querySelector("small")
      )
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
    const minimumWidth =
      GRAPH_NODE_MIN_WIDTH;
    const maximumWidth = Math.ceil(
      Math.min(
        GRAPH_NODE_MAX_WIDTH,
        Math.max(
          minimumWidth,
          defaultWidth,
          headerWidth + 2,
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
      content.style.minWidth =
        `${bodyIntrinsicWidth}px`;
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
      limits.content.style.minWidth =
        `${limits.bodyIntrinsicWidth}px`;
    } else {
      limits.content.style.removeProperty(
        "min-width"
      );
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

    for (const node of graph.nodes) {
      const article = dom.nodesHost.querySelector(
        `.rml-graph-node[data-graph-node-id="${CSS.escape(node.id)}"]`
      );

      if (!article) {
        continue;
      }

      let limits = measureNodeResizeLimits(
        article,
        node
      );

      if (Number.isFinite(node.width)) {
        const width = clamp(
          node.width,
          limits.minimumWidth,
          limits.maximumWidth
        );
        if (width !== node.width) {
          node.width = width;
          changed = true;
        }
      }

      if (Number.isFinite(node.height)) {
        const height = clamp(
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
      limits = updateNodeResizeLimitData(
        article,
        node,
        limits
      );
      scheduleNodeBodyOverflowSync(article);
    }

    if (changed) {
      persistGraph(true);
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

    persistGraph(true);
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
      node.width = clamp(
        startWidth,
        limits.minimumWidth,
        limits.maximumWidth
      );
    }
    if (axis === "height" || axis === "both") {
      node.height = clamp(
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
      node.width = clamp(
        interaction.startWidth + deltaX,
        interaction.minimumWidth,
        interaction.maximumWidth
      );
    }

    if (
      interaction.axis === "height" ||
      interaction.axis === "both"
    ) {
      node.height = clamp(
        interaction.startHeight + deltaY,
        interaction.minimumHeight,
        interaction.maximumHeight
      );
    }

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
      interaction.content.style.minWidth =
        `${Math.max(
          0,
          interaction.maximumWidth - 2
        )}px`;
    }

    rememberNodeBodyScroll(
      node.id,
      interaction.article.querySelector(
        ".rml-graph-node-body"
      )
    );
    renderGraphWires();
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
          node.width = clamp(
            Math.round(
              node.width / GRAPH_GRID
            ) * GRAPH_GRID,
            interaction.minimumWidth,
            interaction.maximumWidth
          );
        }
        if (Number.isFinite(node.height)) {
          node.height = clamp(
            Math.round(
              node.height / GRAPH_GRID
            ) * GRAPH_GRID,
            interaction.minimumHeight,
            interaction.maximumHeight
          );
        }
      }
    }

    interaction.article?.classList.remove(
      "resizing"
    );
    activeInteraction = null;
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphInspector();
  }

  function createGraphNodeElement(
    node,
    bindings,
    connectedKeys
  ) {
    const definition =
      nodeDefinition(node);
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
    article.className =
      `rml-graph-node ${
        node.kind
      }${mirrored ? " mirrored" : ""}${
        graph.selectedNodeId ===
        node.id
          ? " selected"
          : ""
      }`;
    article.dataset.graphNodeId =
      node.id;
    article.style.left =
      `${node.x}px`;
    article.style.top =
      `${node.y}px`;

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
      definition?.symbol || "?";

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
        scheduleNodeBodyWireRefresh();
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

    if (definition?.displaysValue) {
      const preview =
        displayPreviewForNode(node);
      const display =
        document.createElement("div");
      display.className =
        `rml-graph-display-value${
          preview.known
            ? ""
            : " unknown"
        }`;
      const displayLabel =
        document.createElement("span");
      displayLabel.textContent =
        "Current value";
      const displayOutput =
        document.createElement("output");
      displayOutput.textContent =
        previewFormatValue(preview);
      displayOutput.title =
        displayOutput.textContent;
      display.append(
        displayLabel,
        displayOutput
      );
      bodyContent.appendChild(display);
    }

    if (definition?.displaysImpulse) {
      const display =
        document.createElement("div");
      display.className =
        "rml-graph-display-value unknown";
      const displayLabel =
        document.createElement("span");
      displayLabel.textContent =
        "Runtime calls";
      const displayOutput =
        document.createElement("output");
      displayOutput.textContent =
        "Updates while the mod runs";
      displayOutput.title =
        displayOutput.textContent;
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
        selectGraphNode(node.id);
      }
    );

    return article;
  }

  function renderGraphNodes() {
    if (!dom.nodesHost) {
      return;
    }

    captureRenderedNodeBodyScrolls();
    dom.nodesHost.replaceChildren();
    currentAnalysis =
      analyzeConnections(
        graph.connections
      );

    const bindings =
      currentAnalysis.bindings;
    const connectedKeys =
      connectedPortKeys();

    for (const node of graph.nodes) {
      const element =
        createGraphNodeElement(
          node,
          bindings,
          connectedKeys
        );

      dom.nodesHost.appendChild(
        element
      );

      restoreNodeBodyScroll(
        node.id,
        element.querySelector(
          ".rml-graph-node-body"
        )
      );
      scheduleNodeBodyOverflowSync(element);
    }

    requestAnimationFrame(() => {
      for (const node of graph.nodes) {
        const body =
          dom.nodesHost?.querySelector(
            `.rml-graph-node[data-graph-node-id="${CSS.escape(node.id)}"] ` +
            ".rml-graph-node-body"
          );

        restoreNodeBodyScroll(
          node.id,
          body
        );
        scheduleNodeBodyOverflowSync(
          body?.closest(".rml-graph-node")
        );
      }

      refreshRenderedNodeResizeLimits();
      renderGraphWires();
    });
  }

  function socketElement(
    nodeId,
    portId,
    direction
  ) {
    return dom.nodesHost?.querySelector(
      `.rml-graph-socket[data-node-id="${CSS.escape(nodeId)}"]` +
      `[data-port-id="${CSS.escape(portId)}"]` +
      `[data-direction="${direction}"]`
    ) || null;
  }

  function socketGraphCenter(
    nodeId,
    portId,
    direction
  ) {
    const socket =
      socketElement(
        nodeId,
        portId,
        direction
      );

    if (!socket || !dom.viewport) {
      return null;
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
          clientX = clamp(
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
          ? clamp(
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
    const control = clamp(
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

  function graphConnectionById(
    connectionId
  ) {
    return graph.connections.find(
      connection =>
        connection.id === connectionId
    ) || null;
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
    connection
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

      segments.push({
        index,
        from,
        to,
        d: wirePath(from, to)
      });
    }

    return {
      start,
      end,
      anchors,
      segments
    };
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

    let totalLength = 0;

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
        clamp(
          bestLength - step,
          0,
          totalLength
        ),
        bestLength,
        clamp(
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

    return null;
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
    handle.style.color = color;

    if (junction) {
      handle.style.fill = color;
    }

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

  function renderGraphWires() {
    if (!dom.wires) {
      return;
    }

    dom.wires.replaceChildren();

    currentAnalysis =
      analyzeConnections(
        graph.connections
      );

    const branchUsage =
      branchPointUsageMap();
    const handles = [];
    const inputBranchStart =
      activeInteraction?.kind ===
        "connection" &&
      activeInteraction.start
        ?.direction === "input"
        ? activeInteraction.start
        : null;

    for (const connection of graph.connections) {
      const geometry =
        connectionGeometry(
          connection
        );

      if (!geometry) {
        continue;
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
        const shadow =
          svgPath(
            "rml-graph-wire-shadow",
            segment.d
          );
        const visible =
          svgPath(
            `rml-graph-wire${
              concreteType === "impulse" ||
              reactiveImpulse
                ? " impulse"
                : ""
            }${
              graph.selectedConnectionId ===
              connection.id
                ? " selected"
                : ""
            }${
              targetState
                ? ` branch-target-${targetState}`
                : ""
            }`,
            segment.d
          );
        visible.style.stroke = color;
        visible.style.color = color;
        visible.dataset.connectionId =
          connection.id;
        visible.dataset.segmentIndex =
          String(segment.index);

        const hit =
          svgPath(
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

        dom.wires.append(
          shadow,
          visible,
          hit
        );
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

    dom.wires.append(...handles);

    if (
      activeInteraction?.kind ===
      "connection"
    ) {
      renderConnectionPreview();
    }
  }

  function selectGraphNode(nodeId) {
    graph.selectedNodeId = nodeId;
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    persistGraph();
    updateSelectionClasses();
    renderGraphWires();
    renderGraphInspector();
  }

  function selectGraphConnection(
    connectionId
  ) {
    graph.selectedNodeId = null;
    graph.selectedConnectionId =
      connectionId;
    clearSelectedWirePoint();
    persistGraph();
    updateSelectionClasses();
    renderGraphWires();
    renderGraphInspector();
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
    graph.selectedConnectionId =
      connection.id;
    graph.selectedWirePoint = {
      connectionId:
        connection.id,
      pointId: point.id
    };
    persistGraph();
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
          element.dataset.graphNodeId ===
            graph.selectedNodeId
        );
      });
  }

  function deleteGraphNode(nodeId) {
    const node =
      findGraphNode(nodeId);

    if (!node) {
      return;
    }

    nodeBodyScrollPositions.delete(
      nodeId
    );

    graph.nodes =
      graph.nodes.filter(
        candidate =>
          candidate.id !== nodeId
      );
    graph.connections =
      graph.connections.filter(
        connection =>
          connection.fromNode !==
            nodeId &&
          connection.toNode !==
            nodeId
      );

    if (
      graph.selectedNodeId ===
      nodeId
    ) {
      graph.selectedNodeId = null;
    }

    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    pruneConnections();
    persistGraph(true);
    renderGraphNodesAndWires();
    renderGraphPalette();
    renderGraphInspector();
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
      graph.connections =
        graph.connections.filter(
          connection =>
            connection.id !==
            graph.selectedConnectionId
        );
      graph.selectedConnectionId = null;
      clearSelectedWirePoint();
      pruneConnections();
      persistGraph(true);
      renderGraphNodesAndWires();
      renderGraphInspector();
    }
  }

  function renderGraphInspector() {
    if (
      !graph.active ||
      !dom.inspectorContent
    ) {
      return;
    }

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
    requestAnimationFrame(() => {
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
          ".rml-graph-inspector-card > label, .rml-graph-inspector-type-row, .rml-graph-display-value, .rml-graph-variadic-row, .rml-graph-inspector-actions > button"
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
    placeholder = "Search list…"
  ) {
    if (
      !select ||
      !Array.isArray(optionEntries) ||
      optionEntries.length === 0
    ) {
      return select;
    }

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

      popup.style.width =
        `${width}px`;

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

      popup.style.left =
        `${Math.round(left)}px`;
      popup.style.top =
        `${Math.round(
          Math.max(
            viewportTop + margin,
            top
          )
        )}px`;
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

      if (
        !normalized.some(
          entry =>
            entry.value === nextValue
        )
      ) {
        return;
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
      const matches = query
        ? normalized.filter(entry =>
            `${entry.text} ${entry.value}`
              .toLowerCase()
              .includes(query)
          )
        : normalized;

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

      requestAnimationFrame(() => {
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

    if (definition?.displaysValue) {
      const preview =
        displayPreviewForNode(node);
      const live =
        document.createElement("div");
      live.className =
        `rml-graph-display-value${
          preview.known
            ? ""
            : " unknown"
        }`;
      const liveLabel =
        document.createElement("span");
      liveLabel.textContent =
        "Current graph result";
      const liveOutput =
        document.createElement("output");
      liveOutput.textContent =
        previewFormatValue(preview);
      liveOutput.title =
        liveOutput.textContent;
      live.append(
        liveLabel,
        liveOutput
      );
      card.appendChild(live);
    }

    if (definition?.displaysImpulse) {
      const live =
        document.createElement("div");
      live.className =
        "rml-graph-display-value unknown";
      const liveLabel =
        document.createElement("span");
      liveLabel.textContent =
        "Runtime impulse count";
      const liveOutput =
        document.createElement("output");
      liveOutput.textContent =
        "Published whenever this input is called";
      liveOutput.title =
        liveOutput.textContent;
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
        let resolved = null;

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
        minus.disabled = count <= minimum;
        const plus = inspectorButton("+", () => {
          node.parameters[key] = Math.min(maximum, count + 1);
          persistGraph(true);
          renderGraphNodesAndWires();
          renderGraphInspector();
        }, "primary");
        plus.disabled = count >= maximum;
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
        row.style.setProperty(
          "--type-color",
          typeInfo(concrete).color
        );
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
      actions.appendChild(
        inspectorButton(
          "Duplicate",
          () => duplicateGraphNode(node)
        )
      );
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
        "Delete",
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
    normalizeColorConstantParameters(
      node.parameters
    );

    const createEditor =
      bridge?.createColorXEditor;

    if (
      typeof createEditor !==
        "function"
    ) {
      return false;
    }

    const editor =
      createEditor.call(
        bridge,
        {
          label:
            specification.label ||
            "Color value",
          expression:
            node.parameters[
              specification.key
            ] ||
            "colorX.White",
          profile:
            node.parameters
              .colorProfile ||
            "linear",
          strength:
            node.parameters
              .colorStrength ||
            1,
          onChange: state => {
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
          ] ?? ""
        );
        control.spellcheck =
          specification.spellcheck ===
          true;
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
          ] ?? ""
        );
        control.spellcheck =
          specification.spellcheck ===
          true;
        control.classList.toggle(
          "rml-graph-code-input",
          specification.monospace ===
            true
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
          specification.affectsPorts ===
          true
        ) {
          pruneConnections();
          renderGraphNodesAndWires();
        } else if (
          specification.affectsNode ===
          true
        ) {
          renderGraphNodesAndWires();
        }

        persistGraph(
          specification.commitImmediately ===
            true
        );
        refreshDisplayValueNodes();
      };

      control.addEventListener(
        kind === "bool" ||
        kind === "select"
          ? "change"
          : "input",
        update
      );

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
    }
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
    button.textContent = text;
    button.addEventListener(
      "click",
      handler
    );
    return button;
  }

  function duplicateGraphNode(node) {
    if (node.kind !== "operator") {
      return;
    }

    const copy = {
      ...clone(node),
      id: makeId("graph-node"),
      x: clamp(
        node.x + 34,
        -GRAPH_COORDINATE_LIMIT,
        GRAPH_COORDINATE_LIMIT
      ),
      y: clamp(
        node.y + 34,
        -GRAPH_COORDINATE_LIMIT,
        GRAPH_COORDINATE_LIMIT
      )
    };

    graph.nodes.push(copy);
    graph.selectedNodeId = copy.id;
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
    graph.selectedConnectionId =
      connectionId;
    clearSelectedWirePoint();
    persistGraph();
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
      x: clamp(
        finiteNumber(position?.x, 0),
        -GRAPH_COORDINATE_LIMIT,
        GRAPH_COORDINATE_LIMIT
      ),
      y: clamp(
        finiteNumber(position?.y, 0),
        -GRAPH_COORDINATE_LIMIT,
        GRAPH_COORDINATE_LIMIT
      )
    };
    const index = clamp(
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
        clone(connection.points || []),
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
    point.x = clamp(
      position.x,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );
    point.y = clamp(
      position.y,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );

    updateAutoPanPointer(
      clientX,
      clientY
    );
    renderGraphWires();
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
          clone(
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
    persistGraph(true);
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
      originalY: point.y
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
    point.x = clamp(
      position.x,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );
    point.y = clamp(
      position.y,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );

    updateAutoPanPointer(
      clientX,
      clientY
    );
    renderGraphWires();
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
    persistGraph(true);
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

    if (
      event.target.closest(
        ".rml-graph-node, .rml-graph-wire-hit, .rml-graph-wire-point"
      )
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    graph.selectedNodeId = null;
    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    updateSelectionClasses();
    renderGraphWires();
    renderGraphInspector();

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
      clientY: event.clientY
    };

    try {
      event.currentTarget
        .setPointerCapture(
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
          "node"
        ) {
          updateNodeDragPosition(
            activeInteraction.clientX,
            activeInteraction.clientY
          );
        }
      }
    );
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

    node.x = clamp(
      pointer.x - interaction.grabX,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );
    node.y = clamp(
      pointer.y - interaction.grabY,
      -GRAPH_COORDINATE_LIMIT,
      GRAPH_COORDINATE_LIMIT
    );

    const element =
      dom.nodesHost?.querySelector(
        `[data-graph-node-id="${CSS.escape(node.id)}"]`
      );

    if (element) {
      element.style.left =
        `${node.x}px`;
      element.style.top =
        `${node.y}px`;
    }

    renderGraphWires();
    updateAutoPanPointer(
      clientX,
      clientY
    );
  }

  function beginConnectionDrag(event) {
    if (event.button !== 0) {
      return;
    }

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
      start: effectiveStart,
      originalStart: startRef,
      startType,
      detachedConnection,
      clientX: event.clientX,
      clientY: event.clientY
    };

    graph.selectedConnectionId = null;
    clearSelectedWirePoint();
    currentAnalysis =
      analyzeConnections(
        graph.connections
      );

    updateConnectionTargets();
    renderGraphWires();

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
          renderGraphWires();
        }
      }
    );
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
          interaction.clientY
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
    const path =
      svgPath(
        "rml-graph-wire-preview",
        wirePath(from, to)
      );
    path.style.stroke =
      typeInfo(type).color;
    dom.wires.appendChild(path);
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

  function updateConnectionTargets() {
    const interaction =
      activeInteraction;

    if (
      interaction?.kind !==
      "connection"
    ) {
      return;
    }

    dom.nodesHost
      ?.querySelectorAll(
        ".rml-graph-socket"
      )
      .forEach(socket => {
        socket.classList.remove(
          "valid-target",
          "invalid-target"
        );

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
          return;
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
      });
  }

  function clearConnectionTargetStates() {
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
    clientY
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
          wireTargetAtPoint(
            clientX,
            clientY
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

    activeInteraction = null;
    stopAutoPan();
    clearConnectionTargetStates();
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
      event.currentTarget.disabled
    ) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    activeInteraction = {
      kind: "palette",
      pointerId: event.pointerId,
      operatorId,
      isConfiguration,
      definition,
      startX: event.clientX,
      startY: event.clientY,
      clientX: event.clientX,
      clientY: event.clientY,
      dragging: false,
      ghost: null
    };

    try {
      event.currentTarget
        .setPointerCapture(
          event.pointerId
        );
    } catch {
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
      interaction.ghost.style.transform =
        `translate3d(${clientX + 14}px, ${clientY + 14}px, 0)`;
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

    interaction.ghost?.remove();
    activeInteraction = null;
    stopAutoPan();

    if (!commit) {
      return;
    }

    if (!wasDragging) {
      addPaletteNodeAtCenter(
        interaction.operatorId,
        interaction.isConfiguration
      );
      paletteDragSuppressClickUntil =
        performance.now() + 300;
      return;
    }

    const target =
      document.elementFromPoint(
        clientX,
        clientY
      );

    if (
      !target?.closest?.(
        ".rml-graph-viewport"
      )
    ) {
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

    if (interaction.isConfiguration) {
      addConfigurationNode(
        point.x - 190,
        point.y - 35
      );
    } else {
      addOperatorNode(
        interaction.operatorId,
        point.x - 130,
        point.y - 35
      );
    }

    paletteDragSuppressClickUntil =
      performance.now() + 300;
  }

  function startAutoPan(
    clientX,
    clientY,
    callback
  ) {
    autoPanState = {
      clientX,
      clientY,
      callback
    };

    if (!autoPanFrame) {
      autoPanFrame =
        requestAnimationFrame(
          runAutoPan
        );
    }
  }

  function updateAutoPanPointer(
    clientX,
    clientY
  ) {
    if (!autoPanState) {
      return;
    }

    autoPanState.clientX = clientX;
    autoPanState.clientY = clientY;
  }

  function runAutoPan() {
    autoPanFrame = 0;

    if (
      !autoPanState ||
      !dom.viewport
    ) {
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
      requestAnimationFrame(
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

    event.preventDefault();
    event.stopImmediatePropagation();

    if (
      activeInteraction.kind ===
      "pan"
    ) {
      graph.viewport.x =
        activeInteraction.originalX +
        event.clientX -
        activeInteraction.startX;
      graph.viewport.y =
        activeInteraction.originalY +
        event.clientY -
        activeInteraction.startY;
      applyViewportTransform();
    } else if (
      activeInteraction.kind ===
      "node"
    ) {
      updateNodeDragPosition(
        event.clientX,
        event.clientY
      );
    } else if (
      activeInteraction.kind ===
      "node-resize"
    ) {
      updateNodeResize(
        event.clientX,
        event.clientY
      );
    } else if (
      activeInteraction.kind ===
      "wire-segment"
    ) {
      updateWireSegmentDrag(
        event.clientX,
        event.clientY
      );
    } else if (
      activeInteraction.kind ===
      "wire-point"
    ) {
      updateWirePointDrag(
        event.clientX,
        event.clientY
      );
    } else if (
      activeInteraction.kind ===
      "connection"
    ) {
      activeInteraction.clientX =
        event.clientX;
      activeInteraction.clientY =
        event.clientY;
      updateAutoPanPointer(
        event.clientX,
        event.clientY
      );
      renderGraphWires();
    } else if (
      activeInteraction.kind ===
      "palette"
    ) {
      movePaletteGhost(
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

    event.preventDefault();
    event.stopImmediatePropagation();

    if (
      activeInteraction.kind ===
      "pan"
    ) {
      dom.viewport?.classList.remove(
        "panning"
      );
      activeInteraction = null;
      persistGraph(true);
    } else if (
      activeInteraction.kind ===
      "node"
    ) {
      const node =
        findGraphNode(
          activeInteraction.nodeId
        );

      if (node) {
        node.x =
          Math.round(
            node.x / GRAPH_GRID
          ) * GRAPH_GRID;
        node.y =
          Math.round(
            node.y / GRAPH_GRID
          ) * GRAPH_GRID;
      }

      activeInteraction = null;
      stopAutoPan();
      persistGraph(true);
      renderGraphNodesAndWires();
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
    if (!graph?.active) {
      return;
    }

    if (event.key === "Escape") {
      if (cancelInteraction(true)) {
        event.preventDefault();
        event.stopImmediatePropagation();
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

  function handleBuilderRendered() {
    if (!bridge) {
      return;
    }

    const incoming =
      bridge.getExtensionState(
        EXTENSION_NAME
      );
    const incomingGraph =
      sanitizeGraphState(incoming);
    const incomingJson =
      JSON.stringify(
        graphSerializableFrom(
          incomingGraph
        )
      );

    if (
      incomingJson !==
      lastPersistedGraphJson &&
      !activeInteraction
    ) {
      graph = incomingGraph;
      pruneConnections();
      persistGraph(true);
    }

    cacheDom();
    ensurePackButton();

    if (graph.active) {
      synchronizePackedSnapshot(false);
      activateGraphMode();
    } else {
      deactivateGraphMode();
      updatePackButton();
    }
  }

  function graphSerializableFrom(value) {
    return {
      version: value.version,
      active: value.active,
      sourceSignature:
        value.sourceSignature,
      showAdvancedNodes:
        value.showAdvancedNodes === true,
      configSnapshot:
        value.configSnapshot,
      nodes: value.nodes,
      connections: value.connections,
      viewport: value.viewport,
      selectedNodeId:
        value.selectedNodeId,
      selectedConnectionId:
        value.selectedConnectionId,
      selectedWirePoint:
        value.selectedWirePoint,
      nextSequence:
        value.nextSequence
    };
  }

  Object.defineProperty(
    window,
    "RMLTypedNodeGraphScrollLayers",
    {
      value: Object.freeze({
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
              "<html> · Page ROOT"
          });
        }
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );

  Object.defineProperty(
    window,
    "RMLTypedNodeGraphTourBridge",
    {
      value: Object.freeze({
        ensureConnection(fromNodeId, fromPortId, toNodeId, toPortId) {
          const fromNode = findGraphNode(fromNodeId);
          const toNode = findGraphNode(toNodeId);
          if (!fromNode || !toNode) return false;

          const existing = graph.connections.find(connection =>
            connection.fromNode === fromNodeId &&
            connection.fromPort === fromPortId &&
            connection.toNode === toNodeId &&
            connection.toPort === toPortId
          );
          if (existing) {
            renderGraphNodesAndWires();
            return existing.id;
          }

          const proposal = connectionProposal(
            graphPortReference(fromNode, fromPortId, "output"),
            graphPortReference(toNode, toPortId, "input"),
            graph.connections
          );
          if (!proposal.valid) return false;

          applyAutoVectorUpdates(proposal.autoVectorUpdates);
          graph.connections = proposal.nextConnections;
          normalizeConnectionRouting(graph.connections);
          graph.selectedConnectionId = proposal.candidate.id;
          graph.selectedNodeId = null;
          clearSelectedWirePoint();
          currentAnalysis = proposal.analysis;
          persistGraph(true);
          renderGraphNodesAndWires();
          renderGraphInspector();
          return proposal.candidate.id;
        },
        refresh() {
          renderGraphNodesAndWires();
          renderGraphInspector();
          return true;
        }
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );

  Object.defineProperty(
    window,
    "RMLTypedNodeGraphGenerator",
    {
      value: Object.freeze({
        build:
          buildTypedNodeGraphCSharpContribution
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  function initialize() {
    bridge =
      window.RMLBuilderBridge;

    if (!bridge) {
      return;
    }

    injectStyles();
    cacheDom();

    graph = sanitizeGraphState(
      bridge.getExtensionState(
        EXTENSION_NAME
      )
    );

    graph.active = false;

    pruneConnections();
    persistGraph(true);

    ensurePackButton();
    loadGraphPanelLayout();
    ensureGraphPanelToggles();

    document.addEventListener(
      "rml-builder:rendered",
      handleBuilderRendered
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
        "scroll",
        scheduleGraphScrollLayerVisualRefresh,
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
          if (graph?.active) {
            schedulePackedSnapshotSync();
          } else {
            requestAnimationFrame(
              updateSourceBadge
            );
          }
        }

        if (
          event.target.closest(
            "#settings-preview-dialog"
          )
        ) {
          requestAnimationFrame(() => {
            requestAnimationFrame(
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
          requestAnimationFrame(() => {
            requestAnimationFrame(
              refreshDisplayValueNodes
            );
          });
        }
      },
      true
    );

    if (graph.active) {
      synchronizePackedSnapshot(false);
      activateGraphMode();
    }

    bridge
      .requestGeneratedOutputRefresh
      ?.();
  }

  function refreshAfterNodeModulesReady() {
    if (!bridge || !graph) {
      return;
    }

    if (graph.active) {
      renderGraphPalette();
      renderGraphNodesAndWires();
      renderGraphInspector();
    }

    bridge
      .requestGeneratedOutputRefresh
      ?.();
  }

  async function initializeImmediately() {
    try {
      await Promise.resolve(
        window.RMLModNodesReady
      );
    } catch (error) {
      console.error(
        "Typed mod-node initialization failed.",
        error
      );
    }

    initialize();

    window.addEventListener(
      "rml-api-node-factory-ready",
      refreshAfterNodeModulesReady
    );
  }

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
})();