"use strict";

// Runtime Graph registry, fixed node definitions and extension contract.

const API_EXPORT_VERIFICATION_SCHEMA_VERSION = 3;

const INTEGRATED_NODE_CONTRACT_SCHEMA_VERSION = 1;

const INTEGRATED_NODE_CONTRACT_ALGORITHM =
    "fnv1a64-semantic-integrated-nodes-v1";

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
      color: "#ffae70",
      csType: "Elements.Core.int2",
      assembly: "Elements.Core"
    },
    int3: {
      label: "Integer 3",
      short: "I3",
      color: "#ffae70",
      csType: "Elements.Core.int3",
      assembly: "Elements.Core"
    },
    int4: {
      label: "Integer 4",
      short: "I4",
      color: "#ffae70",
      csType: "Elements.Core.int4",
      assembly: "Elements.Core"
    },
    float2: {
      label: "Float 2",
      short: "F2",
      color: "#58d2ff",
      csType: "Elements.Core.float2",
      assembly: "Elements.Core"
    },
    float3: {
      label: "Float 3",
      short: "F3",
      color: "#58d2ff",
      csType: "Elements.Core.float3",
      assembly: "Elements.Core"
    },
    float4: {
      label: "Float 4",
      short: "F4",
      color: "#58d2ff",
      csType: "Elements.Core.float4",
      assembly: "Elements.Core"
    },
    double2: {
      label: "Double 2",
      short: "D2",
      color: "#c5a2ff",
      csType: "Elements.Core.double2",
      assembly: "Elements.Core"
    },
    double3: {
      label: "Double 3",
      short: "D3",
      color: "#c5a2ff",
      csType: "Elements.Core.double3",
      assembly: "Elements.Core"
    },
    double4: {
      label: "Double 4",
      short: "D4",
      color: "#c5a2ff",
      csType: "Elements.Core.double4",
      assembly: "Elements.Core"
    },
    colorX: {
      label: "HDR color",
      short: "CLR",
      color: "#ff67dc",
      csType: "Elements.Core.colorX",
      assembly: "Elements.Core"
    },
    generic: {
      label: "Generic",
      short: "T",
      color: "#9da8b4"
    },
    rmlDisplaySlot: {
      label: "RML Menu Display",
      short: "RML",
      color: "#a476ff",
      csType: "string",
      defaultCs: "string.Empty"
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

function apiCompositeProxyPort(
    boundary,
    index = 0
  ) {
    const id = String(
      boundary?.id ||
      `proxy-${index + 1}`
    );
    const label = String(
      boundary?.label ||
      boundary?.internalPortId ||
      `Port ${index + 1}`
    ).slice(0, 160);
    const type = String(
      boundary?.type || ""
    ).trim();
    const typeVar = String(
      boundary?.typeVar || ""
    ).trim();
    const constraint = String(
      boundary?.constraint || "value"
    ).trim();
    const extra = {
      detail:
        `API Composite boundary · ${String(boundary?.internalNodeId || "node")}.${String(boundary?.internalPortId || "port")}`,
      apiCompositeProxy: true,
      internalNodeId:
        String(boundary?.internalNodeId || ""),
      internalPortId:
        String(boundary?.internalPortId || "")
    };

    return type
      ? port(id, label, type, extra)
      : genericPort(
          id,
          label,
          typeVar || `C${index + 1}`,
          constraint,
          extra
        );
  }

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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
      hiddenFromPalette: true,
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
        "Displays the actual runtime value through the local scanner bridge. Connect an RML Menu Display output from the Start node to the second input when this monitor should also contribute to that read-only row in the RML mod menu. One Start display output can fan out to multiple Display Value monitors.",
      inputs: [
        genericPort("value", "Value", "T", "value"),
        port(
          "rmlMenu",
          "RML Menu",
          "rmlDisplaySlot",
          {
            detail:
              "Optional binding to one Display Value (RML Menu) item from Configuration Outline. Multiple Display Value monitors may share the same RML Menu Display output."
          }
        )
      ],
      outputs: [],
      displaysValue: true
    },
    "debug.displayImpulse": {
      title: "Display Impulse",
      group: "Debug & Output",
      symbol: "↯#",
      description:
        "A terminal impulse monitor. Every runtime call increments and publishes its counter. Connect an RML Menu Display output from the Start node to the optional RML Menu input to expose the live pulse count in that read-only RML menu row.",
      inputs: [
        port("call", "Impulse", "impulse"),
        port(
          "rmlMenu",
          "RML Menu",
          "rmlDisplaySlot",
          {
            detail:
              "Optional binding to one Display Value (RML Menu) item from Configuration Outline. The displayed value is this monitor's live pulse count."
          }
        )
      ],
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

        return `System.Threading.Interlocked.Increment(ref _impulseCount${token});\nPublishDisplay("${api.escapeString(api.node.id)}", "${api.escapeString(label)}", "impulse", System.Threading.Interlocked.Read(ref _impulseCount${token}));`;
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
    "resonite.executionStore": {
      title: "Execution Frame Store",
      group: "Flow",
      symbol: "Sƒ",
      description:
        "Stores a value only inside the current graph execution frame. Concurrent or nested entries cannot overwrite each other's transient value, and the value is discarded when that execution finishes.",
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
    },
    "container.apiComposite": {
      title: "API Composite",
      group: "Flow",
      symbol: "API",
      iconTone: "gold",
      hiddenFromPalette: true,
      apiCompositeContainer: true,
      description:
        "A stable visual container for verified catalog API nodes combined with supported logic/value/flow nodes and owned Custom C#, C# Project or C# Reference nodes. Internal contracts, Custom C# File Graphs, exposed ports and routing are preserved and expanded deterministically for validation, save/import, unpacking and code generation.",
      resolveDefinition(node) {
        const boundaries = Array.isArray(
          node?.parameters?.boundaryPorts
        )
          ? node.parameters.boundaryPorts
          : [];
        const inputs = [];
        const outputs = [];

        boundaries.forEach((boundary, index) => {
          const specification =
            apiCompositeProxyPort(
              boundary,
              index
            );
          if (
            boundary?.direction ===
              "output"
          ) {
            outputs.push(specification);
          } else {
            inputs.push(specification);
          }
        });

        return {
          title:
            String(
              node?.parameters?.title ||
              "API Composite"
            ).slice(0, 120),
          inputs,
          outputs,
          width: 320
        };
      }
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

let integratedDefinitionRevision = 1;

let integratedNodeContractCache = null;

function stableIntegratedContractValue(
    value
  ) {
    if (typeof value === "function") {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(
        stableIntegratedContractValue
      );
    }
    if (
      value &&
      typeof value === "object"
    ) {
      return Object.fromEntries(
        Object.keys(value)
          .sort((left, right) =>
            left.localeCompare(right)
          )
          .map(key => [
            key,
            stableIntegratedContractValue(
              value[key]
            )
          ])
      );
    }
    return value ?? null;
  }

function integratedDefinitionContract(
    operatorId,
    definition
  ) {
    const portContract = portValue => ({
      id: String(portValue?.id || ""),
      type: String(portValue?.type || ""),
      typeVar: String(
        portValue?.typeVar || ""
      ),
      constraint: String(
        portValue?.constraint || ""
      ),
      role: String(portValue?.role || ""),
      optional:
        portValue?.optional === true,
      generic:
        portValue?.generic === true
    });
    const parameterContract = value => ({
      key: String(value?.key || ""),
      kind: String(value?.kind || ""),
      default:
        value?.default ?? null,
      affectsPorts:
        value?.affectsPorts === true,
      affectsNode:
        value?.affectsNode === true,
      options:
        Array.isArray(value?.options)
          ? value.options.map(option => ({
              value:
                option?.value ?? null,
              label:
                String(
                  option?.label || ""
                )
            }))
          : []
    });

    return stableIntegratedContractValue({
      operatorId,
      inputs:
        (Array.isArray(definition?.inputs)
          ? definition.inputs
          : []).map(portContract),
      outputs:
        (Array.isArray(definition?.outputs)
          ? definition.outputs
          : []).map(portContract),
      parameters:
        (Array.isArray(
          definition?.parameters
        )
          ? definition.parameters
          : []).map(parameterContract),
      configurableTypeVar:
        String(
          definition?.configurableTypeVar ||
          ""
        ),
      configurableTypes:
        Array.isArray(
          definition?.configurableTypes
        )
          ? definition.configurableTypes.map(
              value => String(value || "")
            )
          : [],
      variadicInputs:
        definition?.variadicInputs || null,
      variadicOutputs:
        definition?.variadicOutputs || null,
      resolveDefinition:
        definition?.resolveDefinition || null,
      codegenValue:
        definition?.codegenValue || null,
      codegenAction:
        definition?.codegenAction || null,
      codegenCollect:
        definition?.codegenCollect || null,
      syntaxRender:
        definition?.syntaxRender || null
    });
  }

function integratedNodeContractHash(
    text
  ) {
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;

    for (
      let index = 0;
      index < text.length;
      index += 1
    ) {
      const code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(
        first,
        0x01000193
      ) >>> 0;
      second ^= code + index;
      second = Math.imul(
        second,
        0x85ebca6b
      ) >>> 0;
    }

    return (
      first.toString(16).padStart(8, "0") +
      second.toString(16).padStart(8, "0")
    );
  }

function currentIntegratedNodeContract() {
    if (
      integratedNodeContractCache?.revision ===
        integratedDefinitionRevision
    ) {
      return integratedNodeContractCache.value;
    }

    const definitions = Object.entries(
      OPERATOR_DEFINITIONS
    )
      .filter(([, definition]) =>
        definition?.catalogGenerated !== true &&
        definition?.unavailableApiContract !== true &&
        definition?.legacyCatalogAlias !== true
      )
      .sort(([left], [right]) =>
        left.localeCompare(right)
      )
      .map(([operatorId, definition]) =>
        integratedDefinitionContract(
          operatorId,
          definition
        )
      );
    const fingerprint =
      integratedNodeContractHash(
        JSON.stringify(definitions)
      );
    const value = Object.freeze({
      schemaVersion:
        INTEGRATED_NODE_CONTRACT_SCHEMA_VERSION,
      algorithm:
        INTEGRATED_NODE_CONTRACT_ALGORITHM,
      fingerprint,
      definitionCount:
        definitions.length
    });

    integratedNodeContractCache = {
      revision:
        integratedDefinitionRevision,
      value
    };
    return value;
  }

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

    const assemblyReferences =
      Array.isArray(information.assemblyReferences)
        ? information.assemblyReferences
            .filter(reference =>
              reference &&
              typeof reference === "object" &&
              String(reference.include || "").trim()
            )
            .map(reference => ({
              include: String(reference.include || "").trim(),
              hintPath: String(reference.hintPath || "").trim(),
              private: reference.private === true
            }))
        : [];

    const assemblies = [...new Set([
      ...(Array.isArray(information.assemblies)
        ? information.assemblies
        : []),
      information.assembly
    ]
      .map(value => String(value || "").trim())
      .filter(Boolean))];

    TYPE_INFO[id] = {
      label:
        information.label || id,
      short:
        information.short || id.slice(0, 4).toUpperCase(),
      color:
        information.color || "#9da8b4",
      ...information,
      assemblies,
      assemblyReferences
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

    if (definition.catalogGenerated === true) {
      const contract =
        definition.apiVerification;
      const validContract = Boolean(
        contract &&
        typeof contract === "object" &&
        Number(contract.schemaVersion) ===
          API_EXPORT_VERIFICATION_SCHEMA_VERSION &&
        String(contract.nodeId || "") === id &&
        String(contract.catalogFingerprint || "").trim() &&
        String(contract.contractFingerprint || "").trim()
      );

      if (!validContract) {
        console.error(
          `Catalog API node '${id}' was not registered because its verification contract is missing or invalid.`
        );
        return false;
      }

      if (
        contract.catalogSource !== "scanner"
      ) {
        definition.catalogVerificationUnavailable = true;
      }
    }

    OPERATOR_DEFINITIONS[id] =
      definition;

    if (
      definition.catalogGenerated !== true &&
      definition.unavailableApiContract !== true &&
      definition.legacyCatalogAlias !== true
    ) {
      integratedDefinitionRevision += 1;
      integratedNodeContractCache = null;
    }

    const group =
      OPERATOR_DEFINITIONS[id].group;

    if (
      group &&
      !OPERATOR_GROUP_ORDER.includes(group)
    ) {
      registerGraphGroup(group);
    }

    return true;
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
        version: 8,
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
        isIntegratedNode(operatorId) {
          const definition =
            OPERATOR_DEFINITIONS[
              String(operatorId || "")
            ];
          return Boolean(
            definition &&
            definition.catalogGenerated !== true &&
            definition.unavailableApiContract !== true &&
            definition.legacyCatalogAlias !== true
          );
        },
        getIntegratedNodeContract() {
          return currentIntegratedNodeContract();
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

function typeBase(type) {
    if (
      typeof type === "string" &&
      type.startsWith("enum:")
    ) {
      return "enum";
    }

    return type || "generic";
  }
