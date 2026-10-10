(() => {
  "use strict";

  const registry = window.RMLModNodeRegistry;
  if (
    !registry ||
    typeof registry.port !== "function" ||
    typeof registry.genericPort !== "function" ||
    typeof registry.registerNode !== "function" ||
    typeof registry.registerType !== "function"
  ) {
    console.error(
      "Universal performance nodes require the RML node registry."
    );
    return;
  }

  const {
    port: registryPort,
    genericPort: registryGenericPort,
    registerNode,
    registerType
  } = registry;

  const UNIVERSAL_TEXT_KEYS = Object.freeze({
    "A": "universal.performance.port.a",
    "Add or remove values directly. Each empty type is inferred independently from its wire.": "universal.performance.help.value_types",
    "Array": "universal.performance.port.array",
    "B": "universal.performance.port.b",
    "Cache ID": "universal.performance.parameter.cache_id",
    "Cached Typed Array": "universal.performance.node.cached_array.title",
    "Call": "universal.performance.port.call",
    "Called": "universal.performance.port.called",
    "Capture Value": "universal.performance.node.capture_value.title",
    "Changed": "universal.performance.port.changed",
    "Collections": "universal.performance.group.collections",
    "Constants": "universal.performance.group.constants",
    "Count": "universal.performance.port.count",
    "Creates one shared typed array from literal inputs and reuses it. Treat the result as read-only. Dynamic inputs are rejected because they cannot have stable process-lifetime cache semantics.": "universal.performance.node.cached_array.description",
    "Done": "universal.performance.port.done",
    "Double": "universal.performance.option.double",
    "Emits a strongly typed member of an enum declared by the current Builder project without strings, boxing or reflection.": "universal.performance.node.enum_literal.description",
    "Enable unload tracking when needed. Keeping this disabled gives the direct zero-allocation callback path.": "universal.performance.help.track_graph_scope",
    "Enum Literal": "universal.performance.node.enum_literal.title",
    "Enum name": "universal.performance.parameter.enum_name",
    "Evaluates a value once for the following flow. The captured value is scoped to the current graph execution and restored across nested/reentrant calls.": "universal.performance.node.capture_value.description",
    "Exact graph type, for example bool, colorX, slot or enum:MyEnum.": "universal.performance.help.exact_graph_type",
    "Exact stable scanner hook contract. Scanner-generated api.hook.* nodes store the full portable method contract instead.": "universal.performance.help.scanner_method_contract",
    "Float": "universal.performance.option.float",
    "Flow": "universal.performance.group.flow",
    "Geometry": "universal.performance.group.geometry",
    "Get Typed Array Item At Index": "universal.performance.node.get_array_item.title",
    "Harmony": "universal.performance.group.harmony",
    "Harmony Typed Method Hook": "universal.performance.node.harmony_hook.title",
    "Index": "universal.performance.port.index",
    "Is Finite": "universal.performance.node.is_finite.title",
    "Item": "universal.performance.port.item",
    "Item type": "universal.performance.parameter.item_type",
    "Key": "universal.performance.port.key",
    "Key type": "universal.performance.parameter.key_type",
    "Keyed Snapshot Changed": "universal.performance.node.keyed_snapshot_changed.title",
    "Logic": "universal.performance.group.logic",
    "Member": "universal.performance.parameter.enum_member",
    "Nodes with the same State ID and identical key/value schema intentionally share one typed snapshot dictionary.": "universal.performance.help.state_id",
    "Normalized position": "universal.performance.port.normalized_position",
    "Optional exact graph type for the key. Leave blank to infer it.": "universal.performance.help.key_type",
    "Optional exact graph type. Leave blank for inferred generic behavior.": "universal.performance.help.optional_graph_type",
    "Optional sharing namespace. Equal non-empty IDs, item types and literal definitions share one array; mismatched definitions remain isolated.": "universal.performance.help.cache_id",
    "Patch kind": "universal.performance.parameter.patch_kind",
    "Path": "universal.performance.port.path",
    "Postfix": "universal.performance.option.postfix",
    "Prefix": "universal.performance.option.prefix",
    "Priority": "universal.performance.parameter.priority",
    "Reads a typed array directly without object conversion, boxing or reflection.": "universal.performance.node.get_array_item.description",
    "Relays a value through an explicitly selected graph type. This is useful at reusable graph and composite boundaries and emits no runtime conversion.": "universal.performance.node.typed_value_relay.description",
    "Remember Keyed Snapshot": "universal.performance.node.keyed_snapshot_remember.title",
    "Reports whether a variadic tuple of strongly typed values differs from the last tuple stored for the same key and State ID.": "universal.performance.node.keyed_snapshot_changed.description",
    "Result": "universal.performance.port.result",
    "Returns true only when a floating-point value is neither NaN nor positive or negative infinity.": "universal.performance.node.is_finite.description",
    "Sample 2D Polyline": "universal.performance.node.sample_polyline.title",
    "Samples a float2 polyline by normalized repeated distance. Traversal uses typed locals and allocates nothing.": "universal.performance.node.sample_polyline.description",
    "Scanner method contract": "universal.performance.parameter.scanner_method_contract",
    "Select Typed Array By Index": "universal.performance.node.select_array.title",
    "Selects one typed array by index. The index is evaluated once, only the selected input is evaluated, and an out-of-range index returns an empty typed array.": "universal.performance.node.select_array.description",
    "State": "universal.performance.group.state",
    "State ID": "universal.performance.parameter.state_id",
    "Stores a variadic tuple of strongly typed values as the latest snapshot for the same key and State ID.": "universal.performance.node.keyed_snapshot_remember.description",
    "Success": "universal.performance.port.success",
    "Template for scanner-generated typed API hook nodes. It contains no eager catalog option list.": "universal.performance.node.harmony_hook.description",
    "The enum member to emit.": "universal.performance.help.enum_member",
    "The project-defined enum type name.": "universal.performance.help.enum_name",
    "Track graph execution scope": "universal.performance.parameter.track_graph_scope",
    "Typed Value Relay": "universal.performance.node.typed_value_relay.title",
    "Value": "universal.performance.port.value",
    "Value type": "universal.performance.parameter.value_type",
    "Value types": "universal.performance.parameter.value_types"
  });

  const UNIVERSAL_PRESENTATION = Symbol(
    "rmlUniversalPresentation"
  );
  const UNIVERSAL_NODE_IDS = [];

  function rememberUniversalField(
    target,
    field,
    fallback
  ) {
    if (!target || typeof target !== "object") {
      return target;
    }
    let metadata = target[UNIVERSAL_PRESENTATION];
    if (!metadata) {
      metadata = { fields: Object.create(null) };
      Object.defineProperty(
        target,
        UNIVERSAL_PRESENTATION,
        {
          value: metadata,
          configurable: false,
          enumerable: false,
          writable: false
        }
      );
    }
    metadata.fields[field] = String(fallback ?? "");
    target[field] = universalText(fallback);
    return target;
  }

  function rememberUniversalOptions(
    target,
    options
  ) {
    if (!target || typeof target !== "object") {
      return target;
    }
    let metadata = target[UNIVERSAL_PRESENTATION];
    if (!metadata) {
      metadata = { fields: Object.create(null) };
      Object.defineProperty(
        target,
        UNIVERSAL_PRESENTATION,
        {
          value: metadata,
          configurable: false,
          enumerable: false,
          writable: false
        }
      );
    }
    metadata.options = options;
    target.options = universalSelectOptions(options);
    return target;
  }

  function universalText(value) {
    const fallback = String(value ?? "");
    if (!fallback) return fallback;
    const indexedValue = fallback.match(/^Value (\d+)$/);
    if (indexedValue) {
      const key = "universal.performance.port.value_index";
      const translated = window.RMLI18n?.format?.(
        key,
        { index: indexedValue[1] }
      );
      return translated && translated !== key
        ? String(translated)
        : fallback;
    }
    const key = UNIVERSAL_TEXT_KEYS[fallback];
    if (!key) return fallback;
    const translated = window.RMLI18n?.t?.(key);
    return translated && translated !== key
      ? String(translated)
      : fallback;
  }

  function universalFormat(
    key,
    fallback,
    values = {}
  ) {
    const translated = window.RMLI18n?.format?.(
      key,
      values
    );
    if (translated && translated !== key) {
      return String(translated);
    }
    let result = String(fallback || "");
    for (const [name, value] of Object.entries(values)) {
      result = result.replaceAll(
        `{${name}}`,
        String(value ?? "")
      );
    }
    return result;
  }

  const port = (id, label, type, extra) =>
    rememberUniversalField(
      registryPort(
      id,
      universalText(label),
      type,
      extra
      ),
      "label",
      label
    );

  const genericPort = (
    id,
    label,
    generic,
    constraint,
    extra
  ) => rememberUniversalField(
    registryGenericPort(
      id,
      universalText(label),
      generic,
      constraint,
      extra
    ),
    "label",
    label
  );

  function universalSelectOptions(options) {
    if (!Array.isArray(options)) return options;
    return options.map(option => {
      if (Array.isArray(option)) {
        return option.length > 1
          ? [
              option[0],
              universalText(option[1]),
              ...option.slice(2)
            ]
          : [...option];
      }
      if (
        option &&
        typeof option === "object" &&
        !Array.isArray(option)
      ) {
        return {
          ...option,
          ...(typeof option.label === "string"
            ? { label: universalText(option.label) }
            : {})
        };
      }
      return option;
    });
  }

  const pText = (
    key,
    label,
    defaultValue = "",
    help = "",
    extra = {}
  ) => {
    const parameter = {
      key,
      label: universalText(label),
      kind: "text",
      default: defaultValue,
      help: universalText(help),
      ...extra
    };
    rememberUniversalField(parameter, "label", label);
    rememberUniversalField(parameter, "help", help);
    return parameter;
  };

  const pCode = (
    key,
    label,
    defaultValue = "",
    help = "",
    rows = 8
  ) => {
    const parameter = {
      key,
      label: universalText(label),
      kind: "code",
      default: defaultValue,
      help: universalText(help),
      rows,
      monospace: true,
      spellcheck: false
    };
    rememberUniversalField(parameter, "label", label);
    rememberUniversalField(parameter, "help", help);
    return parameter;
  };

  const pBool = (
    key,
    label,
    defaultValue = false,
    help = ""
  ) => {
    const parameter = {
      key,
      label: universalText(label),
      kind: "bool",
      default: defaultValue,
      help: universalText(help)
    };
    rememberUniversalField(parameter, "label", label);
    rememberUniversalField(parameter, "help", help);
    return parameter;
  };

  const pSelect = (
    key,
    label,
    options,
    defaultValue,
    help = "",
    extra = {}
  ) => {
    const parameter = {
      key,
      label: universalText(label),
      kind: "select",
      options: universalSelectOptions(options),
      default: defaultValue,
      help: universalText(help),
      ...extra
    };
    rememberUniversalField(parameter, "label", label);
    rememberUniversalField(parameter, "help", help);
    rememberUniversalOptions(parameter, options);
    return parameter;
  };

  const pNumber = (
    key,
    label,
    defaultValue = 0,
    help = ""
  ) => {
    const parameter = {
      key,
      label: universalText(label),
      kind: "number",
      default: defaultValue,
      storeAsNumber: true,
      help: universalText(help)
    };
    rememberUniversalField(parameter, "label", label);
    rememberUniversalField(parameter, "help", help);
    return parameter;
  };

  function registerUniversalNode(id, definition) {
    if (!registry.getNodeDefinition(id)) {
      const registered = {
        ...definition,
        title: universalText(definition.title),
        group: universalText(definition.group),
        description: universalText(
          definition.description
        )
      };
      rememberUniversalField(
        registered,
        "title",
        definition.title
      );
      rememberUniversalField(
        registered,
        "group",
        definition.group
      );
      rememberUniversalField(
        registered,
        "description",
        definition.description
      );
      registerNode(id, registered);
      UNIVERSAL_NODE_IDS.push(id);
    }
  }

  function refreshUniversalPresentationObject(
    value,
    seen = new WeakSet()
  ) {
    if (
      !value ||
      typeof value !== "object" ||
      seen.has(value)
    ) {
      return;
    }
    seen.add(value);
    const metadata = value[UNIVERSAL_PRESENTATION];
    if (metadata) {
      for (const [field, fallback] of Object.entries(
        metadata.fields || {}
      )) {
        value[field] = universalText(fallback);
      }
      if (Object.hasOwn(metadata, "options")) {
        value.options = universalSelectOptions(
          metadata.options
        );
      }
    }
    for (const child of Object.values(value)) {
      refreshUniversalPresentationObject(child, seen);
    }
  }

  function refreshUniversalLanguagePresentation() {
    for (const id of UNIVERSAL_NODE_IDS) {
      refreshUniversalPresentationObject(
        registry.getNodeDefinition(id)
      );
    }
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener(
      "rml-language-changed",
      refreshUniversalLanguagePresentation,
      { capture: true }
    );
  }

  function nodeToken(api) {
    return api.token(api.node.id);
  }

  function quote(api, value) {
    return `"${api.escapeString(value ?? "")}"`;
  }

  function generatedOutputIsUsed(
    api,
    outputId
  ) {
    return typeof api?.isOutputConnected ===
      "function"
      ? api.isOutputConnected(outputId)
      : true;
  }

  function generatedActionOutputExpression(
    api,
    expression
  ) {
    return typeof api?.isActionReachable ===
      "function" &&
      !api.isActionReachable()
      ? api.csDefault(api.type)
      : expression;
  }

  function normalVariadicIds(count) {
    return Array.from(
      { length: count },
      (_, index) =>
        index < 26
          ? String.fromCharCode(97 + index)
          : `input${index + 1}`
    );
  }

  function normalTypeInformation(type) {
    return registry.getTypeDefinitions()?.[type] || {
      label: type,
      short: "T",
      color: "#9da8b4",
      csType: type,
      defaultCs: "default!"
    };
  }

  function normalArrayType(type) {
    return `normalArray:${type}`;
  }

  function normalLegacyArrayType(itemType, information) {
    const csType = registry
      .canonicalCsType(
        information?.csType || itemType
      )
      .replace(/^global::/, "");
    return {
      "System.Byte": "byteArray",
      "byte": "byteArray",
      "System.String": "stringArray",
      "string": "stringArray",
      "System.Object": "objectArray",
      "object": "objectArray"
    }[csType] || "";
  }

  function ensureNormalArrayType(type) {
    const id = normalArrayType(type);
    const existing =
      registry.getTypeDefinitions()?.[id];
    if (existing) return id;

    const information =
      normalTypeInformation(type);
    const itemCsType =
      information.csType || type;
    const legacyType = normalLegacyArrayType(
      type,
      information
    );
    registerType(id, {
      label: `${information.label || type}[]`,
      short: `${information.short || "T"}[]`,
      color: information.color || "#9da8b4",
      csType: `${itemCsType}[]`,
      defaultCs:
        `System.Array.Empty<${itemCsType}>()`,
      referenceType: true,
      valueType: true,
      globalGenericCandidate: false,
      collectionType: true,
      syntheticArrayType: true,
      collectorCollection: true,
      enumerableElementType: type,
      enumerableElementCsType: itemCsType,
      assignableTo: [
        "object",
        ...(legacyType ? [legacyType] : [])
      ],
      acceptsTypes:
        legacyType ? [legacyType] : [],
      constraints: [
        "reference",
        "serializable",
        "enumerable"
      ],
      assembly: information.assembly || "",
      assemblies:
        Array.isArray(information.assemblies)
          ? information.assemblies
          : [],
      assemblyReferences:
        Array.isArray(information.assemblyReferences)
          ? information.assemblyReferences
          : []
    });
    return id;
  }

  function normalListValueTypeOptions(node) {
    const definitions =
      registry.getTypeDefinitions?.() || {};
    const values = Object.entries(definitions)
      .filter(([, information]) =>
        information?.valueType === true &&
        information?.collectionType !== true
      )
      .map(([id, information]) => [
        id,
        information.label || id
      ]);
    const selected = String(
      node?.parameters?.itemType || ""
    ).trim();
    if (
      selected &&
      !values.some(option => option[0] === selected)
    ) {
      values.push([selected, selected]);
    }
    return values;
  }

  function normalListNodeParameters() {
    return [
      pSelect(
        "itemType",
        "Item type",
        normalListValueTypeOptions,
        "string",
        "",
        { graphTypeReference: true }
      )
    ];
  }

  function normalArrayNodeType(node) {
    const requested = String(
      node?.parameters?.itemType || "string"
    ).trim();
    const itemType = requested || "string";
    return {
      itemType,
      arrayType: ensureNormalArrayType(itemType)
    };
  }

  function literalEnumGraphType(node) {
    const requested = String(
      node?.parameters?.enumName ||
        "ProjectEnum"
    )
      .trim()
      .replace(/^enum:/i, "");
    return `enum:${requested || "ProjectEnum"}`;
  }

  registerUniversalNode("configuration.enumLiteral", {
    title: "Enum Literal",
    group: "Constants",
    symbol: "ENUM",
    description:
      "Emits a strongly typed member of an enum declared by the current Builder project without strings, boxing or reflection.",
    parameters: [
      pText(
        "enumName",
        "Enum name",
        "ProjectEnum",
        "The project-defined enum type name.",
        {
          affectsPorts: true,
          affectsNode: true,
          commitImmediately: true
        }
      ),
      pText(
        "member",
        "Member",
        "Value",
        "The enum member to emit.",
        {
          affectsNode: true,
          commitImmediately: true
        }
      )
    ],
    inputs: [],
    outputs: [
      port("value", "Value", "enum:ProjectEnum")
    ],
    resolveDefinition(node) {
      return {
        outputs: [
          port(
            "value",
            "Value",
            literalEnumGraphType(node)
          )
        ]
      };
    },
    codegenExpression(api) {
      const enumType = api.csType(
        literalEnumGraphType(api.node)
      );
      const member = api.identifier(
        api.node.parameters?.member,
        "Value"
      );
      return `${enumType}.${member}`;
    }
  });

  function configuredFlowValueType(node) {
    return String(
      node?.parameters?.valueType || ""
    ).trim();
  }

  registerUniversalNode("flow.typedValueRelay", {
    title: "Typed Value Relay",
    group: "Flow",
    symbol: "⇢T",
    description:
      "Relays a value through an explicitly selected graph type. This is useful at reusable graph and composite boundaries and emits no runtime conversion.",
    parameters: [
      pText(
        "valueType",
        "Value type",
        "object",
        "Exact graph type, for example bool, colorX, slot or enum:MyEnum.",
        {
          affectsPorts: true,
          affectsNode: true,
          commitImmediately: true,
          graphTypeReference: true
        }
      )
    ],
    inputs: [port("value", "Value", "object")],
    outputs: [port("result", "Result", "object")],
    resolveDefinition(node) {
      const valueType =
        configuredFlowValueType(node) ||
        "object";
      return {
        inputs: [
          port("value", "Value", valueType)
        ],
        outputs: [
          port("result", "Result", valueType)
        ]
      };
    },
    codegenExpression(api) {
      return api.input("value").code;
    }
  });

  function capturedValueGraphType(api) {
    const specification =
      api.definition.inputs.find(
        input => input.id === "input"
      );
    return (
      api.resolvedType(
        api.node,
        specification
      ) ||
      api.input("input").type ||
      configuredFlowValueType(api.node) ||
      "object"
    );
  }

  function ensureCapturedValueField(
    api,
    graphType
  ) {
    const csType = api.csType(graphType);
    const token = nodeToken(api);
    api.addField(
      `${api.node.id}.capturedValue`,
`[System.ThreadStaticAttribute]
private static ${csType} _capturedValue${token} = default!;`
    );
  }

  registerUniversalNode("flow.captureValue", {
    title: "Capture Value",
    group: "Flow",
    symbol: "=",
    description:
      "Evaluates a value once for the following flow. The captured value is scoped to the current graph execution and restored across nested/reentrant calls.",
    parameters: [
      pText(
        "valueType",
        "Value type",
        "",
        "Optional exact graph type. Leave blank for inferred generic behavior.",
        {
          affectsPorts: true,
          affectsNode: true,
          commitImmediately: true,
          graphTypeReference: true
        }
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      genericPort(
        "input",
        "Value",
        "T",
        "value"
      )
    ],
    outputs: [
      port("done", "Done", "impulse"),
      genericPort(
        "value",
        "Value",
        "T",
        "value"
      )
    ],
    resolveDefinition(node) {
      const valueType =
        configuredFlowValueType(node);
      if (!valueType) return {};
      return {
        inputs: [
          port("call", "Call", "impulse"),
          port("input", "Value", valueType)
        ],
        outputs: [
          port("done", "Done", "impulse"),
          port("value", "Value", valueType)
        ]
      };
    },
    codegenExpression(api) {
      const graphType =
        capturedValueGraphType(api);
      if (
        typeof api.isActionReachable === "function" &&
        !api.isActionReachable()
      ) {
        return api.csDefault(graphType);
      }
      ensureCapturedValueField(
        api,
        graphType
      );
      const token = nodeToken(api);
      return `_capturedValue${token}`;
    },
    codegenAction(api) {
      const graphType =
        capturedValueGraphType(api);
      const csType = api.csType(graphType);
      const token = nodeToken(api);
      const lexical =
        typeof api.lexicalOutputBinding ===
          "function"
          ? api.lexicalOutputBinding(
              "value",
              graphType,
              api.csDefault(graphType)
            )
          : "";
      if (lexical) {
        const next =
          api.inlineMethod(
            api.node.id,
            "done"
          );
        return `{
            ${lexical} = ${api.input("input").code};${next ? `
            ${next}();` : ""}
        }`;
      }
      ensureCapturedValueField(
        api,
        graphType
      );
      const field = `_capturedValue${token}`;
      const previous = `_previousCapture${token}`;
      const next =
        api.inlineMethod(
          api.node.id,
          "done"
        );
      return `{
            ${csType} ${previous} = ${field};
            ${field} = ${api.input("input").code};
            try
            {${next ? `
                ${next}();` : ""}
            }
            finally
            {
                ${field} = ${previous};
            }
        }`;
    }
  });

  const KEYED_SNAPSHOT_MAX_VALUES = 32;

  const KEYED_SNAPSHOT_TYPE_LIST_SPECIFICATION =
    Object.freeze({
      ...pCode(
        "valueTypes",
        "Value types",
        "",
        "Add or remove values directly. Each empty type is inferred independently from its wire.",
        5
      ),
      affectsPorts: true,
      affectsNode: true,
      commitImmediately: true,
      graphTypeList: true,
      structuralList: Object.freeze({
        itemsKey: "valueSlots",
        idPrefix: "value",
        minimum: 1,
        defaultCount: 2,
        maximum:
          KEYED_SNAPSHOT_MAX_VALUES,
        legacyCountKeys: Object.freeze([
          "valueCount",
          "variadicInputCount"
        ]),
        legacyItemPrefix: "value",
        legacyItemSuffix: "Type"
      })
    });

  function keyedSnapshotValueSlots(node) {
    const entries =
      registry.structuralListEntries?.(
        node?.parameters || {},
        KEYED_SNAPSHOT_TYPE_LIST_SPECIFICATION
      );
    if (Array.isArray(entries)) {
      return entries;
    }
    return [
      { id: "value1", type: "" },
      { id: "value2", type: "" }
    ];
  }

  function keyedSnapshotConfiguredValueTypes(
    node
  ) {
    return keyedSnapshotValueSlots(node)
      .map(entry =>
        String(entry?.type || "").trim()
      );
  }

  function keyedSnapshotValueCount(node) {
    return keyedSnapshotValueSlots(node).length;
  }

  function keyedSnapshotValueIds(node) {
    return keyedSnapshotValueSlots(node)
      .map(entry => entry.id);
  }

  function keyedSnapshotConfiguredType(
    node,
    index
  ) {
    const listed =
      keyedSnapshotConfiguredValueTypes(
        node
      );
    return String(listed[index] || "")
      .trim();
  }

  function keyedSnapshotInputs(
    includeCall,
    node
  ) {
    const keyType = String(
      node?.parameters?.keyType || ""
    ).trim();
    const values =
      keyedSnapshotValueIds(node).map(
        (id, index) => {
          const valueType =
            keyedSnapshotConfiguredType(
              node,
              index
            );
          return valueType
            ? port(
                id,
                `Value ${index + 1}`,
                valueType
              )
            : genericPort(
                id,
                `Value ${index + 1}`,
                `TValue${index + 1}`,
                "anyValue"
              );
        }
      );
    return [
      ...(includeCall
        ? [port("call", "Call", "impulse")]
        : []),
      keyType
        ? port("key", "Key", keyType)
        : genericPort(
            "key",
            "Key",
            "TKey",
            "anyValue"
          ),
      ...values
    ];
  }

  function keyedSnapshotHash(value) {
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    const source = String(value || "");
    for (
      let index = 0;
      index < source.length;
      index += 1
    ) {
      const unit = source.charCodeAt(index);
      first = Math.imul(
        first ^ unit,
        0x01000193
      );
      second = Math.imul(
        second ^ unit,
        0x85ebca6b
      );
    }
    return `${(first >>> 0)
      .toString(16)
      .padStart(8, "0")}${(second >>> 0)
      .toString(16)
      .padStart(8, "0")}`;
  }

  function keyedSnapshotSchema(api) {
    const valueIds =
      keyedSnapshotValueIds(api.node);
    const inputIds = ["key", ...valueIds];
    const graphTypes = inputIds.map(
      id => api.input(id).type || "object"
    );
    const csTypes = graphTypes.map(
      type => api.csType(type)
    );
    const stateId =
      String(
        api.node.parameters?.stateId ||
          "default"
      ).trim() || "default";
    const signature =
      `${stateId}\u0000${csTypes.join("\u0000")}`;
    const token =
      `${api.identifier(stateId, "State")}${keyedSnapshotHash(signature)}`;
    return {
      valueIds,
      keyType: csTypes[0],
      valueTypes: csTypes.slice(1),
      token,
      signature,
      snapshotType:
        `NodeKeyedSnapshot${token}`,
      cacheField:
        `_nodeKeyedSnapshots${token}`,
      matchMethod:
        `NodeKeyedSnapshotMatches${token}`,
      rememberMethod:
        `RememberNodeKeyedSnapshot${token}`
    };
  }

  function ensureKeyedSnapshotCache(api) {
    const schema =
      keyedSnapshotSchema(api);
    const parameters = [
      `${schema.keyType} key`,
      ...schema.valueTypes.map(
        (type, index) =>
          `${type} value${index + 1}`
      )
    ].join(",\n    ");
    const fields = schema.valueTypes
      .map(
        (type, index) =>
          `    public ${type} Value${index + 1};`
      )
      .join("\n");
    const comparisons = schema.valueTypes
      .map(
        (type, index) =>
          `        System.Collections.Generic.EqualityComparer<${type}>.Default.Equals(snapshot.Value${index + 1}, value${index + 1})`
      )
      .join(" &&\n");
    const assignments = schema.valueTypes
      .map(
        (_, index) =>
          `        Value${index + 1} = value${index + 1}`
      )
      .join(",\n");

    api.addMember(
      `state.keyedSnapshot:${schema.signature}`,
`private struct ${schema.snapshotType}
{
${fields}
}

private static readonly System.Collections.Generic.Dictionary<${schema.keyType}, ${schema.snapshotType}>
    ${schema.cacheField} = new();

private static bool ${schema.matchMethod}(
    ${parameters})
{
    if (!${schema.cacheField}.TryGetValue(key, out var snapshot))
    {
        return false;
    }

    return
${comparisons};
}

private static void ${schema.rememberMethod}(
    ${parameters})
{
    ${schema.cacheField}[key] = new ${schema.snapshotType}
    {
${assignments}
    };
}`
    );
    return schema;
  }

  function keyedSnapshotArguments(api) {
    return [
      "key",
      ...keyedSnapshotValueIds(api.node)
    ]
      .map(id => api.input(id).code)
      .join(", ");
  }

  function keyedSnapshotParameters() {
    return [
      pText(
        "stateId",
        "State ID",
        "default",
        "Nodes with the same State ID and identical key/value schema intentionally share one typed snapshot dictionary.",
        {
          affectsNode: true,
          commitImmediately: true
        }
      ),
      pText(
        "keyType",
        "Key type",
        "",
        "Optional exact graph type for the key. Leave blank to infer it.",
        {
          affectsPorts: true,
          affectsNode: true,
          commitImmediately: true,
          graphTypeReference: true
        }
      ),
      KEYED_SNAPSHOT_TYPE_LIST_SPECIFICATION
    ];
  }

  registerUniversalNode("state.keyedSnapshotChanged", {
    title: "Keyed Snapshot Changed",
    group: "State",
    symbol: "STATE≠",
    description:
      "Reports whether a variadic tuple of strongly typed values differs from the last tuple stored for the same key and State ID.",
    parameters: keyedSnapshotParameters(),
    inputs: keyedSnapshotInputs(false, null),
    outputs: [port("result", "Changed", "bool")],
    resolveDefinition(node) {
      return {
        inputs:
          keyedSnapshotInputs(false, node)
      };
    },
    codegenCollect(api) {
      ensureKeyedSnapshotCache(api);
    },
    codegenExpression(api) {
      const schema =
        keyedSnapshotSchema(api);
      return `!${schema.matchMethod}(${keyedSnapshotArguments(api)})`;
    }
  });

  registerUniversalNode("state.keyedSnapshotRemember", {
    title: "Remember Keyed Snapshot",
    group: "State",
    symbol: "STATE=",
    description:
      "Stores a variadic tuple of strongly typed values as the latest snapshot for the same key and State ID.",
    parameters: keyedSnapshotParameters(),
    inputs: keyedSnapshotInputs(true, null),
    outputs: [port("done", "Done", "impulse")],
    resolveDefinition(node) {
      return {
        inputs:
          keyedSnapshotInputs(true, node)
      };
    },
    codegenCollect(api) {
      ensureKeyedSnapshotCache(api);
    },
    codegenAction(api) {
      const schema =
        keyedSnapshotSchema(api);
      const next = api.emit("done");
      return `${schema.rememberMethod}(${keyedSnapshotArguments(api)});${next ? `\n        ${next}();` : ""}`;
    }
  });

  function finiteValueType(node) {
    return String(
      node?.parameters?.valueType ||
        "float"
    ) === "double"
      ? "double"
      : "float";
  }

  registerUniversalNode("logic.isFinite", {
    title: "Is Finite",
    group: "Logic",
    symbol: "ℝ?",
    description:
      "Returns true only when a floating-point value is neither NaN nor positive or negative infinity.",
    parameters: [
      pSelect(
        "valueType",
        "Value type",
        [
          ["float", "Float"],
          ["double", "Double"]
        ],
        "float",
        "",
        {
          affectsPorts: true,
          affectsNode: true,
          commitImmediately: true,
          graphTypeReference: true
        }
      )
    ],
    inputs: [port("value", "Value", "float")],
    outputs: [port("result", "Result", "bool")],
    resolveDefinition(node) {
      return {
        inputs: [
          port(
            "value",
            "Value",
            finiteValueType(node)
          )
        ]
      };
    },
    codegenExpression(api) {
      const owner =
        finiteValueType(api.node) ===
        "double"
          ? "System.Double"
          : "System.Single";
      return `${owner}.IsFinite(${api.input("value").code})`;
    },
    previewEvaluate({ input, known, unknown }) {
      const value = input("value");
      return value.known
        ? known(
            "bool",
            Number.isFinite(
              Number(value.value)
            )
          )
        : unknown("bool", value.reason);
    }
  });

  function stableDefinitionValue(value) {
    if (Array.isArray(value)) {
      return value.map(stableDefinitionValue);
    }
    if (
      value &&
      typeof value === "object"
    ) {
      return Object.fromEntries(
        Object.keys(value)
          .filter(key => key !== "portLayout")
          .sort()
          .map(key => [
            key,
            stableDefinitionValue(value[key])
          ])
      );
    }
    return value;
  }

  function cachedArrayCodegenDefinition(api) {
    const { itemType } =
      normalArrayNodeType(api.node);
    const count = Math.max(
      2,
      Math.min(
        64,
        Number(
          api.node.parameters
            ?.variadicInputCount
        ) || 2
      )
    );
    const configuredCacheId =
      String(
        api.node.parameters?.cacheId || ""
      ).trim();
    const cacheId =
      configuredCacheId || api.node.id;
    const inputIds = normalVariadicIds(count);
    const definitions = inputIds.map(id => {
      const connection = api.inputConnection(id);
      if (!connection) {
        return { connected: false };
      }

      const source = api.graph.nodes.find(
        node => node.id === connection.fromNode
      );
      const sourceHasConnectedInputs =
        Boolean(source) &&
        api.graph.connections.some(
          candidate =>
            candidate.toNode === source.id
        );
      const operatorId = String(
        source?.operatorId || ""
      );
      const constant =
        Boolean(source) &&
        !sourceHasConnectedInputs &&
        (
          operatorId.startsWith("constant.") ||
          operatorId.startsWith("api.enum.")
        );
      return {
        connected: true,
        constant,
        operatorId,
        parameters: stableDefinitionValue(
          source?.parameters || {}
        ),
        fromPort: connection.fromPort || ""
      };
    });
    const inputCodes = inputIds.map(
      id => api.input(id).code
    );
    const signature = JSON.stringify({
      itemType,
      count,
      definitions: definitions.map(
        (definition, index) =>
          definition.connected &&
          !definition.constant
            ? {
                ...definition,
                inputCode: inputCodes[index]
              }
            : definition
      )
    });
    return {
      itemType,
      cacheId,
      inputIds,
      definitions,
      inputCodes,
      signature,
      allStatic: definitions.every(
        definition =>
          !definition.connected ||
          definition.constant
      )
    };
  }

  registerUniversalNode("collection.cachedArray", {
    title: "Cached Typed Array",
    group: "Collections",
    symbol: "T[]*",
    description:
      "Creates one shared typed array from literal inputs and reuses it. Treat the result as read-only. Dynamic inputs are rejected because they cannot have stable process-lifetime cache semantics.",
    parameters: [
      ...normalListNodeParameters(),
      pText(
        "cacheId",
        "Cache ID",
        "",
        "Optional sharing namespace. Equal non-empty IDs, item types and literal definitions share one array; mismatched definitions remain isolated."
      )
    ],
    inputs: [
      port("a", "A", "string"),
      port("b", "B", "string")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: port("a", "A", "string")
    },
    outputs: [
      port(
        "value",
        "Value",
        ensureNormalArrayType("string")
      )
    ],
    resolveDefinition(node) {
      const { itemType, arrayType } =
        normalArrayNodeType(node);
      return {
        inputs: [
          port("a", "A", itemType),
          port("b", "B", itemType)
        ],
        outputs: [
          port("value", "Value", arrayType)
        ],
        variadicInputs: {
          minimum: 2,
          defaultCount: 2,
          maximum: 64,
          preserveAB: true,
          template: port("a", "A", itemType)
        }
      };
    },
    codegenCollect(api) {
      if (!generatedOutputIsUsed(api, "value")) {
        return;
      }
      const information =
        cachedArrayCodegenDefinition(api);
      const {
        itemType,
        cacheId,
        inputIds,
        definitions,
        inputCodes,
        signature,
        allStatic
      } = information;

      definitions.forEach(
        (definition, index) => {
          if (
            definition.connected &&
            !definition.constant
          ) {
            api.diagnostic(
              universalFormat(
                "universal.performance.diagnostic.cached_array_dynamic",
                "Cached typed array '{cacheId}' only accepts disconnected defaults or literal constant inputs; input '{input}' is dynamic.",
                {
                  cacheId,
                  input: inputIds[index]
                }
              )
            );
          }
        }
      );
      if (!allStatic) return;

      const cacheToken = api.token(
        `cached-array:${itemType}:${cacheId}:${signature}`
      );
      const itemCsType = api.csType(itemType);
      const field = `_cachedArray${cacheToken}`;
      api.addMember(
        `collection.cachedArray:${itemType}:${cacheId}:${signature}`,
        `private static readonly ${itemCsType}[] ${field} = new ${itemCsType}[] { ${inputCodes.join(", ")} };`
      );
    },
    codegenExpression(api) {
      const information =
        cachedArrayCodegenDefinition(api);
      const {
        itemType,
        cacheId,
        inputCodes,
        signature,
        allStatic
      } = information;
      if (!allStatic) {
        return `new ${api.csType(itemType)}[] { ${inputCodes.join(", ")} }`;
      }
      const cacheToken = api.token(
        `cached-array:${itemType}:${cacheId}:${signature}`
      );
      return `_cachedArray${cacheToken}`;
    }
  });

  registerUniversalNode(
    "collection.getTypedArrayItemAtIndex",
    {
      title: "Get Typed Array Item At Index",
      group: "Collections",
      symbol: "T[i]",
      description:
        "Reads a typed array directly without object conversion, boxing or reflection.",
      parameters: normalListNodeParameters(),
      inputs: [
        port(
          "array",
          "Array",
          ensureNormalArrayType("string")
        ),
        port("index", "Index", "int")
      ],
      outputs: [
        port("item", "Item", "string"),
        port("success", "Success", "bool"),
        port("count", "Count", "int")
      ],
      resolveDefinition(node) {
        const { itemType, arrayType } =
          normalArrayNodeType(node);
        return {
          inputs: [
            port("array", "Array", arrayType),
            port("index", "Index", "int")
          ],
          outputs: [
            port("item", "Item", itemType),
            port("success", "Success", "bool"),
            port("count", "Count", "int")
          ]
        };
      },
      codegenCollect(api) {
        api.addMember(
          "collection.getTypedArrayItemAtIndex.runtime",
`private static T GraphTypedArrayItemAt<T>(T[]? array, int index)
{
    return array != null && (uint)index < (uint)array.Length
        ? array[index]
        : default!;
}

private static bool GraphTypedArrayHasIndex<T>(T[]? array, int index)
{
    return array != null && (uint)index < (uint)array.Length;
}`
        );
      },
      codegenExpression(api) {
        const { itemType } =
          normalArrayNodeType(api.node);
        const itemCsType = api.csType(itemType);
        const array = api.input("array").code;
        const index = api.input("index").code;
        if (api.portId === "success") {
          return `GraphTypedArrayHasIndex<${itemCsType}>(${array}, ${index})`;
        }
        if (api.portId === "count") {
          return `((${array})?.Length ?? 0)`;
        }
        return `GraphTypedArrayItemAt<${itemCsType}>(${array}, ${index})`;
      }
    }
  );

  registerUniversalNode("collection.selectArrayByIndex", {
    title: "Select Typed Array By Index",
    group: "Collections",
    symbol: "T[][i]",
    description:
      "Selects one typed array by index. The index is evaluated once, only the selected input is evaluated, and an out-of-range index returns an empty typed array.",
    parameters: normalListNodeParameters(),
    inputs: [
      port("index", "Index", "int"),
      port(
        "a",
        "A",
        ensureNormalArrayType("string")
      ),
      port(
        "b",
        "B",
        ensureNormalArrayType("string")
      )
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserved: 1,
      preserveAB: true,
      template: port(
        "a",
        "A",
        ensureNormalArrayType("string")
      )
    },
    outputs: [
      port(
        "result",
        "Result",
        ensureNormalArrayType("string")
      )
    ],
    resolveDefinition(node) {
      const { arrayType } =
        normalArrayNodeType(node);
      return {
        inputs: [
          port("index", "Index", "int"),
          port("a", "A", arrayType),
          port("b", "B", arrayType)
        ],
        outputs: [
          port("result", "Result", arrayType)
        ],
        variadicInputs: {
          minimum: 2,
          defaultCount: 2,
          maximum: 64,
          preserved: 1,
          preserveAB: true,
          template: port("a", "A", arrayType)
        }
      };
    },
    codegenExpression(api) {
      const { itemType } =
        normalArrayNodeType(api.node);
      const count = Math.max(
        2,
        Math.min(
          64,
          Number(
            api.node.parameters
              ?.variadicInputCount
          ) || 2
        )
      );
      const branches = normalVariadicIds(count)
        .map(
          (id, index) =>
            `${index} => ${api.input(id).code}`
        )
        .join(", ");
      const fallback =
        `System.Array.Empty<${api.csType(itemType)}>()`;
      return `((${api.input("index").code}) switch { ${branches}, _ => ${fallback} })`;
    }
  });

  ensureNormalArrayType("float2");

  registerUniversalNode("geometry.samplePolyline2D", {
    title: "Sample 2D Polyline",
    group: "Geometry",
    symbol: "PATH@T",
    description:
      "Samples a float2 polyline by normalized repeated distance. Traversal uses typed locals and allocates nothing.",
    inputs: [
      port(
        "path",
        "Path",
        normalArrayType("float2")
      ),
      port(
        "t",
        "Normalized position",
        "float",
        { defaultCs: "0f" }
      )
    ],
    outputs: [port("value", "Value", "float2")],
    codegenCollect(api) {
      ensureNormalArrayType("float2");
      api.addMember(
        "geometry.samplePolyline2D.runtime",
`private static Elements.Core.float2 GraphSamplePolyline2D(
    Elements.Core.float2[]? path,
    float t)
{
    if (path == null || path.Length == 0)
    {
        return Elements.Core.float2.Zero;
    }

    if (path.Length == 1)
    {
        return path[0];
    }

    float totalLength = 0f;
    for (int i = 0; i < path.Length - 1; i++)
    {
        float dx = path[i + 1].x - path[i].x;
        float dy = path[i + 1].y - path[i].y;
        totalLength += MathF.Sqrt(dx * dx + dy * dy);
    }

    float repeated = t - MathF.Floor(t);
    float remaining = repeated * totalLength;
    for (int i = 0; i < path.Length - 1; i++)
    {
        Elements.Core.float2 from = path[i];
        Elements.Core.float2 to = path[i + 1];
        float dx = to.x - from.x;
        float dy = to.y - from.y;
        float segmentLength = MathF.Sqrt(dx * dx + dy * dy);
        if (
            remaining <= segmentLength ||
            i == path.Length - 2)
        {
            float segmentT =
                segmentLength <= 0.00001f
                    ? 0f
                    : remaining / segmentLength;
            return from + (to - from) * segmentT;
        }

        remaining -= segmentLength;
    }

    return path[path.Length - 1];
}`
      );
    },
    codegenExpression(api) {
      return `GraphSamplePolyline2D(${api.input("path").code}, ${api.input("t").code})`;
    }
  });

  function selectedHookMethod(api) {
    const method = api?.definition?.apiHookMethod;
    return method &&
      typeof method === "object" &&
      method.declaringType &&
      method.name
      ? method
      : null;
  }

  function hookValueBindings(api, method) {
    const bindings = [];
    const outputType = portId => {
      const specification =
        api.definition.outputs.find(
          output => output.id === portId
        );
      return (
        specification &&
        api.resolvedType(
          api.node,
          specification
        )
      ) || specification?.type || "object";
    };
    if (
      method.isStatic !== true &&
      generatedOutputIsUsed(api, "instance")
    ) {
      bindings.push({
        nodeId: api.node.id,
        portId: "instance",
        type: outputType("instance"),
        code: "__instance"
      });
    }
    for (const [index, parameter] of
      (method.parameters || []).entries()) {
      const portId = `argument${index}`;
      if (!generatedOutputIsUsed(api, portId)) {
        continue;
      }
      bindings.push({
        nodeId: api.node.id,
        portId,
        type: outputType(portId),
        code: `__${index}`
      });
    }
    if (
      method.returnType &&
      method.returnType !== "System.Void" &&
      method.returnType !== "void" &&
      generatedOutputIsUsed(api, "result")
    ) {
      bindings.push({
        nodeId: api.node.id,
        portId: "result",
        type: outputType("result"),
        code: "__result"
      });
    }
    return bindings;
  }

  function hookCallbackParameters(method) {
    const parameters = [];
    if (method.isStatic !== true) {
      parameters.push(
        `${method.declaringType} __instance`
      );
    }
    for (const [index, parameter] of
      (method.parameters || []).entries()) {
      parameters.push(
        `${parameter?.elementType || parameter?.type || "System.Object"} __${index}`
      );
    }
    if (
      method.returnType &&
      method.returnType !== "System.Void" &&
      method.returnType !== "void"
    ) {
      parameters.push(
        `${method.returnType} __result`
      );
    }
    return parameters;
  }

  function ensureTypedHarmonyRuntime(api) {
    api.addUsing("System.Reflection");
    api.addUsing("HarmonyLib");
    api.addReference({
      include: "0Harmony",
      hintPath:
        "$(ResonitePath)rml_libs/0Harmony.dll",
      private: false
    });
    api.addField(
      "universal.harmony.field",
      `private static readonly Harmony _graphHarmony = _rml.ConfigureHarmony("${api.escapeString(
        `${api.namespaceName}.${api.className}.GeneratedGraph`
      )}");`
    );
  }

  function typedHookField(api, portId) {
    return `_typedHarmonyValue${api.token(
      api.node.id,
      portId
    )}`;
  }

  function ensureTypedHookField(api, binding) {
    const graphType =
      binding?.type || "object";
    const csType = api.csType(graphType);
    const field = typedHookField(
      api,
      binding.portId
    );
    api.addField(
      `${api.node.id}.typed-harmony-value.${binding.portId}`,
`[System.ThreadStaticAttribute]
private static ${csType} ${field} = default!;`
    );
    return {
      ...binding,
      csType,
      field,
      previous:
        `_previous${api.token(
          api.node.id,
          binding.portId
        )}`
    };
  }

  registerUniversalNode("harmony.typedPatchEvent", {
    title: "Harmony Typed Method Hook",
    group: "Harmony",
    symbol: "H<T>",
    description:
      "Template for scanner-generated typed API hook nodes. It contains no eager catalog option list.",
    codegenLexicalImpulseOutputs: [
      "called"
    ],
    hiddenFromPalette: true,
    parameters: [
      pText(
        "hookContract",
        "Scanner method contract",
        "",
        "Exact stable scanner hook contract. Scanner-generated api.hook.* nodes store the full portable method contract instead."
      ),
      pSelect(
        "patchKind",
        "Patch kind",
        [
          ["prefix", "Prefix"],
          ["postfix", "Postfix"]
        ],
        "postfix"
      ),
      pNumber("priority", "Priority", 400),
      pBool(
        "openGraphEntry",
        "Track graph execution scope",
        false,
        "Enable unload tracking when needed. Keeping this disabled gives the direct zero-allocation callback path."
      )
    ],
    outputs: [port("called", "Called", "impulse")],
    codegenCollect(api) {
      const method = selectedHookMethod(api);
      if (!method) {
        api.diagnostic(
          universalFormat(
            "universal.performance.diagnostic.missing_hook_contract",
            "{title}: no scanner hook contract is available.",
            { title: api.definition.title }
          )
        );
        return;
      }

      ensureTypedHarmonyRuntime(api);
      api.requireRuntimeHelper(
        "ReportGraphRuntimeFailure"
      );
      const token = nodeToken(api);
      const callback = `HarmonyTypedCallback${token}`;
      const kind =
        String(
          api.node.parameters?.patchKind ||
          "postfix"
        ).toLowerCase() === "prefix"
          ? "prefix"
          : "postfix";
      const parameters =
        hookCallbackParameters(method);
      const bindings =
        hookValueBindings(api, method)
          .map(binding =>
            ensureTypedHookField(
              api,
              binding
            )
          );
      const scope =
        api.node.parameters
          ?.openGraphEntry === true
          ? "        using GraphExecutionScope scope = OpenGraphEntry();\n        if (!scope.Accepted) return;\n"
          : "";
      const saveValues = bindings
        .map(binding =>
          `        ${binding.csType} ${binding.previous} = ${binding.field};`
        )
        .join("\n");
      const assignValues = bindings
        .map(binding =>
          `        ${binding.field} = ${binding.code};`
        )
        .join("\n");
      const restoreValues = [...bindings]
        .reverse()
        .map(binding =>
          `            ${binding.field} = ${binding.previous};`
        )
        .join("\n");
      const failureSource =
        api.escapeString(
          `Harmony ${kind} ${method.declaringType}.${method.signature || method.name}`
        );
      api.deferCodegen(
        `${api.node.id}.typed-harmony-callback`,
        () => {
          const flow = api.lexicalInlineScope(
            api.node.id,
            "called",
            bindings,
            `HarmonyCallback${token}`
          );
          const locals = flow.locals
            ? `        ${flow.locals}\n\n`
            : "";
          const declarations = flow.declarations
            .split("\n")
            .map(line => `        ${line}`)
            .join("\n");
          api.addMember(
            `${api.node.id}.typed-harmony-callback`,
`private static void ${callback}(${parameters.join(", ")})
{
    try
    {
${scope}${locals}${declarations}

${saveValues}${saveValues ? "\n" : ""}${assignValues}${assignValues ? "\n" : ""}        try
        {
            ${flow.entryMethod}();
        }
        finally
        {
${restoreValues}
        }
    }
    catch (Exception exception)
    {
        ReportGraphRuntimeFailure(
            "${failureSource}",
            exception);
    }
}`
          );
        }
      );

      const targetParameterTypes =
        (method.parameters || []).map(
          parameter =>
            `typeof(${parameter?.elementType || parameter?.type || "System.Object"})`
        );
      const parameterTypesExpression =
        targetParameterTypes.length > 0
          ? `new Type[] { ${targetParameterTypes.join(", ")} }`
          : "Type.EmptyTypes";
      const visibilityFlag =
        method.visibility === "public"
          ? "BindingFlags.Public"
          : "BindingFlags.NonPublic";
      const scopeFlag =
        method.isStatic === true
          ? "BindingFlags.Static"
          : "BindingFlags.Instance";
      const targetVariable =
        `_typedHarmonyTarget${token}`;
      const harmonyMethod =
        `new HarmonyMethod(typeof(${api.graphClassName}), nameof(${callback})) { priority = ${Math.trunc(
          Number(api.node.parameters?.priority) ||
            400
        )} }`;
      api.addEngineInit(
`MethodInfo? ${targetVariable} = typeof(${method.declaringType}).GetMethod(
            ${quote(api, method.name)},
            ${visibilityFlag} | ${scopeFlag} | BindingFlags.DeclaredOnly,
            binder: null,
            types: ${parameterTypesExpression},
            modifiers: null);
        if (${targetVariable} is null)
        {
            throw new MissingMethodException(${quote(
              api,
              method.declaringType
            )}, ${quote(api, method.signature || method.name)});
        }
        _graphHarmony.Patch(
            ${targetVariable},
            prefix: ${kind === "prefix" ? harmonyMethod : "null"},
            postfix: ${kind === "postfix" ? harmonyMethod : "null"});`
      );
    },
    codegenExpression(api) {
      const method = selectedHookMethod(api);
      if (!method) return "default!";
      const binding = hookValueBindings(
        api,
        method
      ).find(item => item.portId === api.portId);
      if (!binding) {
        return "default!";
      }
      ensureTypedHookField(
        api,
        binding
      );
      return typedHookField(
        api,
        binding.portId
      );
    }
  });
})();
