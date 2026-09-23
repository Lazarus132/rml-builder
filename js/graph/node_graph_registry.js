"use strict";

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
      label: window.RMLI18n.t("ui.auto.1b3f34a2a3e5"),
      short: "IMP",
      color: "#f6f7fb"
    },
    bool: {
      label: window.RMLI18n.t("ui.auto.2aadc0d7ea8d"),
      short: "BOOL",
      color: "#6ce89b"
    },
    string: {
      label: window.RMLI18n.t("ui.auto.5295229445f8"),
      short: "TXT",
      color: "#ff83bd",
      csType: "System.String",
      referenceType: true
    },
    object: {
      label: window.RMLI18n.t("ui.auto.70bd5b4088b4"),
      short: "OBJ",
      color: "#9da8b4",
      csType: "System.Object",
      defaultCs: "null",
      referenceType: true
    },
    Uri: {
      label: window.RMLI18n.t("ui.auto.7b7dd4fb8a81"),
      short: "URI",
      color: "#5be3cf",
      csType: "System.Uri",
      referenceType: true
    },
    enum: {
      label: window.RMLI18n.t("ui.auto.0edf92ad0682"),
      short: "ENUM",
      color: "#ffd181"
    },
    int: {
      label: window.RMLI18n.t("ui.auto.b9048cffec02"),
      short: "INT",
      color: "#ff956f"
    },
    float: {
      label: window.RMLI18n.t("ui.auto.773c92428e84"),
      short: "F32",
      color: "#59b7ff"
    },
    double: {
      label: window.RMLI18n.t("ui.auto.fa1f9976d8d1"),
      short: "F64",
      color: "#b994ff"
    },
    int2: {
      label: window.RMLI18n.t("ui.auto.202cab64468f"),
      short: "I2",
      color: "#ffae70",
      csType: "Elements.Core.int2",
      assembly: "Elements.Core"
    },
    int3: {
      label: window.RMLI18n.t("ui.auto.d057c6f191cd"),
      short: "I3",
      color: "#ffae70",
      csType: "Elements.Core.int3",
      assembly: "Elements.Core"
    },
    int4: {
      label: window.RMLI18n.t("ui.auto.a716cba2f48e"),
      short: "I4",
      color: "#ffae70",
      csType: "Elements.Core.int4",
      assembly: "Elements.Core"
    },
    float2: {
      label: window.RMLI18n.t("ui.auto.480262d5d8fa"),
      short: "F2",
      color: "#58d2ff",
      csType: "Elements.Core.float2",
      assembly: "Elements.Core"
    },
    float3: {
      label: window.RMLI18n.t("ui.auto.f5ccf651140c"),
      short: "F3",
      color: "#58d2ff",
      csType: "Elements.Core.float3",
      assembly: "Elements.Core"
    },
    float4: {
      label: window.RMLI18n.t("ui.auto.25d2c317e92f"),
      short: "F4",
      color: "#58d2ff",
      csType: "Elements.Core.float4",
      assembly: "Elements.Core"
    },
    double2: {
      label: window.RMLI18n.t("ui.auto.137634113758"),
      short: "D2",
      color: "#c5a2ff",
      csType: "Elements.Core.double2",
      assembly: "Elements.Core"
    },
    double3: {
      label: window.RMLI18n.t("ui.auto.571917262119"),
      short: "D3",
      color: "#c5a2ff",
      csType: "Elements.Core.double3",
      assembly: "Elements.Core"
    },
    double4: {
      label: window.RMLI18n.t("ui.auto.8db025eaabf8"),
      short: "D4",
      color: "#c5a2ff",
      csType: "Elements.Core.double4",
      assembly: "Elements.Core"
    },
    colorX: {
      label: window.RMLI18n.t("ui.auto.a7676b1d154b"),
      short: "CLR",
      color: "#ff67dc",
      csType: "Elements.Core.colorX",
      assembly: "Elements.Core"
    },
    generic: {
      label: window.RMLI18n.t("ui.auto.dddd4a4d73e1"),
      short: "T",
      color: "#9da8b4"
    },
    rmlDisplaySlot: {
      label: window.RMLI18n.t("ui.auto.6fe275a47b27"),
      short: "RML",
      color: "#a476ff",
      csType: "string",
      defaultCs: "string.Empty"
    }
  };

const GRAPH_CSHARP_PRIMITIVE_NAMES =
  Object.freeze({
    bool: "System.Boolean",
    byte: "System.Byte",
    sbyte: "System.SByte",
    short: "System.Int16",
    ushort: "System.UInt16",
    int: "System.Int32",
    uint: "System.UInt32",
    long: "System.Int64",
    ulong: "System.UInt64",
    Half: "System.Half",
    half: "System.Half",
    char: "System.Char",
    float: "System.Single",
    double: "System.Double",
    decimal: "System.Decimal",
    string: "System.String",
    object: "System.Object",
    void: "System.Void",
    nint: "System.IntPtr",
    nuint: "System.UIntPtr"
  });

const GRAPH_NUMERIC_SCALAR_METADATA =
  Object.freeze({
    "System.SByte": Object.freeze({
      family: "sbyte",
      integer: true,
      signed: true,
      min: "-128",
      max: "127",
      preference: 0,
      implicitTo: Object.freeze([
        "System.Int16", "System.Int32", "System.Int64",
        "System.Half", "System.Single", "System.Double",
        "System.Decimal"
      ])
    }),
    "System.Byte": Object.freeze({
      family: "byte",
      integer: true,
      signed: false,
      min: "0",
      max: "255",
      preference: 1,
      implicitTo: Object.freeze([
        "System.Int16", "System.UInt16", "System.Int32",
        "System.UInt32", "System.Int64", "System.UInt64",
        "System.Half", "System.Single", "System.Double",
        "System.Decimal"
      ])
    }),
    "System.Int16": Object.freeze({
      family: "short",
      integer: true,
      signed: true,
      min: "-32768",
      max: "32767",
      preference: 2,
      implicitTo: Object.freeze([
        "System.Int32", "System.Int64", "System.Single",
        "System.Double", "System.Decimal"
      ])
    }),
    "System.UInt16": Object.freeze({
      family: "ushort",
      integer: true,
      signed: false,
      min: "0",
      max: "65535",
      preference: 3,
      implicitTo: Object.freeze([
        "System.Int32", "System.UInt32", "System.Int64",
        "System.UInt64", "System.Single", "System.Double",
        "System.Decimal"
      ])
    }),
    "System.Int32": Object.freeze({
      family: "int",
      integer: true,
      signed: true,
      min: "-2147483648",
      max: "2147483647",
      preference: 4,
      implicitTo: Object.freeze([
        "System.Int64", "System.Single", "System.Double",
        "System.Decimal"
      ])
    }),
    "System.UInt32": Object.freeze({
      family: "uint",
      integer: true,
      signed: false,
      min: "0",
      max: "4294967295",
      preference: 5,
      implicitTo: Object.freeze([
        "System.Int64", "System.UInt64", "System.Single",
        "System.Double", "System.Decimal"
      ])
    }),
    "System.Int64": Object.freeze({
      family: "long",
      integer: true,
      signed: true,
      min: "-9223372036854775808",
      max: "9223372036854775807",
      preference: 6,
      implicitTo: Object.freeze([
        "System.Single", "System.Double", "System.Decimal"
      ])
    }),
    "System.UInt64": Object.freeze({
      family: "ulong",
      integer: true,
      signed: false,
      min: "0",
      max: "18446744073709551615",
      preference: 7,
      implicitTo: Object.freeze([
        "System.Single", "System.Double", "System.Decimal"
      ])
    }),
    "System.Half": Object.freeze({
      family: "half",
      floating: true,
      maxFinite: 65504,
      preference: 8,
      implicitTo: Object.freeze([])
    }),
    "System.Single": Object.freeze({
      family: "float",
      floating: true,
      maxFinite: 3.4028234663852886e38,
      preference: 9,
      implicitTo: Object.freeze(["System.Double"])
    }),
    "System.Double": Object.freeze({
      family: "double",
      floating: true,
      maxFinite: Number.MAX_VALUE,
      preference: 10,
      implicitTo: Object.freeze([])
    }),
    "System.Decimal": Object.freeze({
      family: "decimal",
      decimal: true,
      preference: 11,
      implicitTo: Object.freeze([])
    })
  });

const GRAPH_VECTOR_SCALAR_CSHARP_TYPES =
  Object.freeze({
    bool: "System.Boolean",
    byte: "System.Byte",
    sbyte: "System.SByte",
    short: "System.Int16",
    ushort: "System.UInt16",
    int: "System.Int32",
    uint: "System.UInt32",
    long: "System.Int64",
    ulong: "System.UInt64",
    half: "System.Half",
    float: "System.Single",
    double: "System.Double"
  });

const GRAPH_TYPE_BY_CSHARP_TYPE =
  new Map();

function graphNormalizeCsTypeExpression(
    value
  ) {
    const aliases = GRAPH_CSHARP_PRIMITIVE_NAMES;
    return String(value || "")
      .trim()
      .replace(/global::/g, "")
      .replace(/\s+/g, "")
      .replace(
        /\b(bool|byte|sbyte|short|ushort|int|uint|long|ulong|half|char|float|double|decimal|string|object|void|nint|nuint)\b/g,
        alias => aliases[alias] || alias
      )
      .replace(/\?(?=$|[>,\]\[])/g, "");
  }

function graphCanonicalCsType(typeOrCsType) {
  const id = String(typeOrCsType || "").trim();
  const information =
    TYPE_INFO[id] ||
    (
      id.startsWith("enum:")
        ? TYPE_INFO.enum
        : null
    ) ||
    {};
  const declared = String(
    information.csType || id
  )
    .trim()
    .replace(/^global::/, "");

  return graphNormalizeCsTypeExpression(
    declared
  );
}

function indexGraphTypeCsType(type, information) {
  const canonical =
    graphNormalizeCsTypeExpression(
      information?.csType || type
    );

  if (
    canonical &&
    !GRAPH_TYPE_BY_CSHARP_TYPE.has(canonical)
  ) {
    GRAPH_TYPE_BY_CSHARP_TYPE.set(
      canonical,
      type
    );
  }
}

for (const [type, information] of
  Object.entries(TYPE_INFO)) {
  indexGraphTypeCsType(type, information);
}

function defineGraphStaticValueType(
  type,
    information
  ) {
    TYPE_INFO[type] = {
      ...(TYPE_INFO[type] || {}),
      ...information,
      referenceType: false,
      valueType: true
    };
    indexGraphTypeCsType(
      type,
      TYPE_INFO[type]
    );

    if (!VALUE_TYPES.includes(type)) {
      VALUE_TYPES.push(type);
    }
  }

const GRAPH_STATIC_SCALAR_TYPES =
  Object.freeze({
    bool: {
      csType: "System.Boolean",
      defaultCs: "false"
    },
    sbyte: {
      label: window.RMLI18n.t("ui.auto.8e591813da0c"),
      short: "I8",
      color: "#ff9f70",
      csType: "System.SByte",
      defaultCs: "0"
    },
    byte: {
      label: window.RMLI18n.t("ui.auto.1f034645343b"),
      short: "U8",
      color: "#ffb170",
      csType: "System.Byte",
      defaultCs: "0"
    },
    short: {
      label: window.RMLI18n.t("ui.auto.2dbab4093325"),
      short: "I16",
      color: "#ff9b70",
      csType: "System.Int16",
      defaultCs: "0"
    },
    ushort: {
      label: window.RMLI18n.t("ui.auto.50a0a426bf13"),
      short: "U16",
      color: "#ffad70",
      csType: "System.UInt16",
      defaultCs: "0"
    },
    int: {
      csType: "System.Int32",
      defaultCs: "0"
    },
    uint: {
      label: window.RMLI18n.t("ui.auto.de3f32e7d066"),
      short: "U32",
      color: "#ffa970",
      csType: "System.UInt32",
      defaultCs: "0U"
    },
    long: {
      label: window.RMLI18n.t("ui.auto.3fe9f0fe8c3c"),
      short: "I64",
      color: "#ff8f70",
      csType: "System.Int64",
      defaultCs: "0L"
    },
    ulong: {
      label: window.RMLI18n.t("ui.auto.470604928b5c"),
      short: "U64",
      color: "#ffa570",
      csType: "System.UInt64",
      defaultCs: "0UL"
    },
    half: {
      label: window.RMLI18n.t("ui.auto.b406e9e418c7"),
      short: "F16",
      color: "#62c9ff",
      csType: "System.Half",
      defaultCs: "default(System.Half)"
    },
    float: {
      csType: "System.Single",
      defaultCs: "0f"
    },
    double: {
      csType: "System.Double",
      defaultCs: "0d"
    },
    decimal: {
      label: window.RMLI18n.t("ui.auto.3d306cf53608"),
      short: "DEC",
      color: "#c7a1ff",
      csType: "System.Decimal",
      defaultCs: "0m"
    },
    char: {
      label: window.RMLI18n.t("ui.auto.ecd25b09993d"),
      short: "CHAR",
      color: "#ff83bd",
      csType: "System.Char",
      defaultCs: "'\\u0000'"
    },
    guid: {
      label: window.RMLI18n.t("ui.auto.420b8509c9cf"),
      short: "GUID",
      color: "#70d6c8",
      csType: "System.Guid",
      defaultCs: "default(System.Guid)"
    },
    dateTime: {
      label: window.RMLI18n.t("ui.auto.66b76c8b1db8"),
      short: "DATE",
      color: "#78c8e8",
      csType: "System.DateTime",
      defaultCs: "default(System.DateTime)"
    },
    dateTimeOffset: {
      label: window.RMLI18n.t("ui.auto.d92a49869813"),
      short: "DATE±",
      color: "#78b8e8",
      csType: "System.DateTimeOffset",
      defaultCs: "default(System.DateTimeOffset)"
    },
    timeSpan: {
      label: window.RMLI18n.t("ui.auto.9c931561ffc8"),
      short: "SPAN",
      color: "#75c7d8",
      csType: "System.TimeSpan",
      defaultCs: "default(System.TimeSpan)"
    }
  });

for (const [type, information] of
  Object.entries(GRAPH_STATIC_SCALAR_TYPES)) {
  defineGraphStaticValueType(
    type,
    information
  );
}

const GRAPH_STATIC_VECTOR_PRESENTATION =
  Object.freeze({
    bool: ["Boolean", "B", "#6ce89b"],
    byte: ["Byte", "U8", "#ffb170"],
    sbyte: ["SByte", "I8", "#ff9f70"],
    short: ["Int16", "I16", "#ff9b70"],
    ushort: ["UInt16", "U16", "#ffad70"],
    int: ["Integer", "I", "#ffae70"],
    uint: ["UInt32", "U32", "#ffa970"],
    long: ["Int64", "I64", "#ff8f70"],
    ulong: ["UInt64", "U64", "#ffa570"],
    half: ["Half", "H", "#62c9ff"],
    float: ["Float", "F", "#58d2ff"],
    double: ["Double", "D", "#c5a2ff"]
  });

for (const [family, presentation] of
  Object.entries(GRAPH_STATIC_VECTOR_PRESENTATION)) {
  for (const dimension of [2, 3, 4]) {
    const type = `${family}${dimension}`;
    defineGraphStaticValueType(type, {
      label: `${presentation[0]} ${dimension}`,
      short: `${presentation[1]}${dimension}`,
      color: presentation[2],
      csType: `Elements.Core.${type}`,
      defaultCs:
        `default(Elements.Core.${type})`,
      assembly: "Elements.Core"
    });
  }
}

const GRAPH_STATIC_STRUCTURED_TYPES =
  Object.freeze({
    float2x2: window.RMLI18n.t("ui.literal.2a4f4d188213"),
    float3x3: window.RMLI18n.t("ui.literal.c323fd5f8c3c"),
    float4x4: window.RMLI18n.t("ui.literal.4de06e4652ff"),
    double2x2: window.RMLI18n.t("ui.literal.eaf76a9a8985"),
    double3x3: window.RMLI18n.t("ui.literal.f599ca260ce3"),
    double4x4: window.RMLI18n.t("ui.literal.83f474ec4812"),
    floatQ: window.RMLI18n.t("ui.literal.00c947a6bd06"),
    doubleQ: window.RMLI18n.t("ui.literal.641b7f76447e"),
    color: window.RMLI18n.t("ui.literal.137b300eeb95"),
    color32: "Color32"
  });

for (const [type, label] of
  Object.entries(GRAPH_STATIC_STRUCTURED_TYPES)) {
  defineGraphStaticValueType(type, {
    label,
    short: type.toUpperCase(),
    color:
      type.startsWith("double")
        ? "#c5a2ff"
        : type.startsWith("color")
          ? "#ff67dc"
          : "#58d2ff",
    csType: `Elements.Core.${type}`,
    defaultCs:
      `default(Elements.Core.${type})`,
    assembly: "Elements.Core"
  });
}

const GRAPH_CONFIGURABLE_NUMBER_TYPES = [
    "sbyte", "byte", "short", "ushort",
    "int", "uint", "long", "ulong",
    "half", "float", "double", "decimal"
  ];

const GRAPH_CONFIGURABLE_VECTOR_TYPES =
  Object.keys(
    GRAPH_STATIC_VECTOR_PRESENTATION
  ).flatMap(family =>
    [2, 3, 4].map(
      dimension => `${family}${dimension}`
    )
  );

function graphTypeForCsType(csType) {
    const canonical = graphCanonicalCsType(csType);

    const indexed =
      GRAPH_TYPE_BY_CSHARP_TYPE.get(
        canonical
      );
    if (
      indexed &&
      TYPE_INFO[indexed] &&
      graphCanonicalCsType(indexed) ===
        canonical
    ) {
      return indexed;
    }

    GRAPH_TYPE_BY_CSHARP_TYPE.delete(
      canonical
    );

    for (const [type, information] of Object.entries(TYPE_INFO)) {
      const declared = String(
        information?.csType || type
      )
        .trim()
        .replace(/^global::/, "");
      if (
        (GRAPH_CSHARP_PRIMITIVE_NAMES[declared] || declared) ===
        canonical
      ) {
        GRAPH_TYPE_BY_CSHARP_TYPE.set(
          canonical,
          type
        );
        return type;
      }
    }

    return null;
  }

function canonicalGraphType(typeOrCsType) {
    const id = String(
      typeOrCsType || ""
    ).trim();
    if (!id) return id;
    if (id.startsWith("enum:")) {
      return id;
    }

    const information = TYPE_INFO[id];
    if (
      information &&
      !id.startsWith("normalExact:")
    ) {
      return id;
    }

    return (
      graphTypeForCsType(
        information?.csType || id
      ) || id
    );
  }

function graphNumericScalarDescriptor(type) {
    const csType = graphCanonicalCsType(type);
    const metadata = GRAPH_NUMERIC_SCALAR_METADATA[csType];

    return metadata
      ? {
          ...metadata,
          type: typeBase(type),
          csType
        }
      : null;
  }

function graphVectorDescriptor(type) {
    const graphType = typeBase(type);
    const csType = graphCanonicalCsType(graphType);
    const match = csType.match(
      /^Elements\.Core\.(bool|byte|sbyte|short|ushort|int|uint|long|ulong|half|float|double)([234])$/
    );

    if (!match) {
      return null;
    }

    const scalarCsType =
      GRAPH_VECTOR_SCALAR_CSHARP_TYPES[match[1]];
    return {
      type: graphType,
      csType,
      family: match[1],
      scalarCsType,
      scalarType:
        graphTypeForCsType(scalarCsType),
      componentCount: Number(match[2]),
      componentIds:
        ["x", "y", "z", "w"].slice(0, Number(match[2])),
      boolean: match[1] === "bool",
      numeric: match[1] !== "bool"
    };
  }

function graphConfigurableTypeSort(left, right) {
    const leftScalar = graphNumericScalarDescriptor(left);
    const rightScalar = graphNumericScalarDescriptor(right);
    if (leftScalar && rightScalar) {
      return leftScalar.preference - rightScalar.preference;
    }

    const families = Object.keys(GRAPH_VECTOR_SCALAR_CSHARP_TYPES);
    const leftVector = graphVectorDescriptor(left);
    const rightVector = graphVectorDescriptor(right);
    if (leftVector && rightVector) {
      return (
        families.indexOf(leftVector.family) -
          families.indexOf(rightVector.family) ||
        leftVector.componentCount - rightVector.componentCount
      );
    }

    return String(left).localeCompare(String(right));
  }

function registerGraphConfigurableValueType(type) {
    if (
      graphNumericScalarDescriptor(type) &&
      !GRAPH_CONFIGURABLE_NUMBER_TYPES.includes(type)
    ) {
      GRAPH_CONFIGURABLE_NUMBER_TYPES.push(type);
      GRAPH_CONFIGURABLE_NUMBER_TYPES.sort(
        graphConfigurableTypeSort
      );
    }

    if (
      graphVectorDescriptor(type) &&
      !GRAPH_CONFIGURABLE_VECTOR_TYPES.includes(type)
    ) {
      GRAPH_CONFIGURABLE_VECTOR_TYPES.push(type);
      GRAPH_CONFIGURABLE_VECTOR_TYPES.sort(
        graphConfigurableTypeSort
      );
    }
  }

const RUNTIME_BEHAVIORS = {
    stored: {
      label: window.RMLI18n.t("ui.auto.67133b18e12d"),
      symbol: "●",
      shape: "circle"
    },
    startup: {
      label: window.RMLI18n.t("ui.auto.836ea4d2abc9"),
      symbol: "▶",
      shape: "triangle"
    },
    saved: {
      label: window.RMLI18n.t("ui.auto.fc4865d8467c"),
      symbol: "■",
      shape: "square"
    },
    "startup-saved": {
      label: window.RMLI18n.t("ui.auto.15eafdd2e98d"),
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
    type: canonicalGraphType(type),
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
      title: window.RMLI18n.t("ui.auto.bf5b188fa598"),
      group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
      symbol: "#",
      description:
        window.RMLI18n.t("ui.auto.e5e8099656c1"),
      configurableTypeVar: "T",
      configurableTypes:
        GRAPH_CONFIGURABLE_NUMBER_TYPES,
      allowAutoType: true,
      defaultType: "auto",
      autoFallbackType: "float",
      parameterKind: "number",
      outputs: [
        genericPort(
          "value",
          window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
          "T",
          "scalar"
        )
      ]
    },
    "constant.bool": {
      title: window.RMLI18n.t("ui.auto.c6bcdc7072ee"),
      group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
      symbol: "B",
      description:
        window.RMLI18n.t("ui.auto.d35dc0e0a390"),
      parameterKind: "bool",
      outputs: [
        port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "bool")
      ]
    },
    "constant.string": {
      title: window.RMLI18n.t("ui.auto.5ee2a5b26ffc"),
      group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
      symbol: "T",
      description:
        window.RMLI18n.t("ui.auto.95859f76dfc8"),
      parameterKind: "string",
      outputs: [
        port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "string")
      ]
    },
    "constant.color": {
      title: window.RMLI18n.t("ui.auto.4922c9d1dfb5"),
      group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
      symbol: "C",
      description:
        window.RMLI18n.t("ui.auto.d8230cbb6ecb"),
      parameterKind: "color",
      outputs: [
        port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "colorX")
      ]
    },
    "constant.typedDefault": {
      title: window.RMLI18n.t("ui.auto.ec6f48045418"),
      group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
      symbol: "T∅",
      description:
        window.RMLI18n.t("ui.auto.804099e00c09"),
      hiddenFromPalette: true,
      outputs: [
        port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")
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
      title: window.RMLI18n.t("ui.auto.0889f8cb2970"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "+",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.7c1631d59441"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "arithmetic"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "arithmetic")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "arithmetic")
      },
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "arithmetic")
      ]
    },
    "math.subtract": {
      title: window.RMLI18n.t("ui.auto.dadd70539398"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "−",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.94a10cf64af3"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "arithmetic"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "arithmetic")
      ],
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "arithmetic")
      ]
    },
    "math.multiply": {
      title: window.RMLI18n.t("ui.auto.c7edc88b8ac6"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "×",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.3bea3f007cf8"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "arithmetic"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "arithmetic")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "arithmetic")
      },
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "arithmetic")
      ]
    },
    "math.divide": {
      title: window.RMLI18n.t("ui.auto.8a3e0ae3d320"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "÷",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.430f5fac9e8d"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "arithmetic"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "arithmetic")
      ],
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "arithmetic")
      ]
    },
    "math.minimum": {
      title: window.RMLI18n.t("ui.auto.0662023736a9"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "min",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.9e5dbb3bf1d5"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "scalar"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "scalar")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "scalar")
      },
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "scalar")
      ]
    },
    "math.maximum": {
      title: window.RMLI18n.t("ui.auto.5942fa7b274b"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "max",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.caf1484a93cb"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "scalar"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "scalar")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "scalar")
      },
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "scalar")
      ]
    },
    "math.clamp": {
      title: window.RMLI18n.t("ui.auto.436dd592a4fd"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "↔",
      description:
        window.RMLI18n.t("ui.auto.5d8221a9b989"),
      inputs: [
        genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "scalar"),
        genericPort("min", window.RMLI18n.t("ui.auto.0662023736a9"), "T", "scalar"),
        genericPort("max", window.RMLI18n.t("ui.auto.5942fa7b274b"), "T", "scalar")
      ],
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "scalar")
      ]
    },
    "math.negate": {
      title: window.RMLI18n.t("ui.auto.f5150d45f664"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "±",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.ad4f81e15f18"),
      inputs: [
        genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "arithmetic")
      ],
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "arithmetic")
      ]
    },
    "math.absolute": {
      title: window.RMLI18n.t("ui.auto.f9bd979c38ca"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "|x|",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.af189cf4dd14"),
      inputs: [
        genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "scalar")
      ],
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "scalar")
      ]
    },
    "math.lerp": {
      title: window.RMLI18n.t("ui.auto.37a34548c575"),
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol: "L",
      description:
        window.RMLI18n.t("ui.auto.169bf66c2312"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "interpolatable"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "interpolatable"),
        port("t", window.RMLI18n.t("ui.auto.028200c2fc6b"), "float")
      ],
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "interpolatable")
      ]
    },

    "logic.and": {
      title: window.RMLI18n.t("ui.auto.ac4af5684ec1"),
      group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
      symbol: "∧",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.862dd180196f"),
      inputs: [
        port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "bool"),
        port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "bool")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "bool")
      },
      outputs: [
        port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")
      ]
    },
    "logic.or": {
      title: window.RMLI18n.t("ui.auto.2214832058fe"),
      group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
      symbol: "∨",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.83073faaf450"),
      inputs: [
        port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "bool"),
        port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "bool")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "bool")
      },
      outputs: [
        port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")
      ]
    },
    "logic.not": {
      title: window.RMLI18n.t("ui.auto.8ab204a0ee16"),
      group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
      symbol: "¬",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.28bc7099dd5c"),
      inputs: [
        port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "bool")
      ],
      outputs: [
        port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")
      ]
    },
    "logic.equal": {
      title: window.RMLI18n.t("ui.auto.ec574012f30c"),
      group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
      symbol: "=",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.c62c0b5c8902"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "value"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "value")
      ],
      outputs: [
        port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")
      ]
    },
    "logic.greater": {
      title: window.RMLI18n.t("ui.auto.5d29e7958493"),
      group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
      symbol: ">",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.31145f565f50"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "ordered"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "ordered")
      ],
      outputs: [
        port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")
      ]
    },
    "logic.less": {
      title: window.RMLI18n.t("ui.auto.081294121c78"),
      group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
      symbol: "<",
      hiddenFromPalette: true,
      description:
        window.RMLI18n.t("ui.auto.31145f565f50"),
      inputs: [
        genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "ordered"),
        genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "ordered")
      ],
      outputs: [
        port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")
      ]
    },
    "logic.select": {
      title: window.RMLI18n.t("ui.auto.38c5006a2538"),
      group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
      symbol: "?",
      description:
        window.RMLI18n.t("ui.auto.1e5c37e72859"),
      inputs: [
        port("condition", window.RMLI18n.t("ui.auto.6756b63c2646"), "bool"),
        genericPort("true", window.RMLI18n.t("ui.auto.2bafb66af5d9"), "T", "value"),
        genericPort("false", window.RMLI18n.t("ui.text.97cdbdc7feff"), "T", "value")
      ],
      outputs: [
        genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "value")
      ]
    },

    "cast.doubleToFloat": {
      title: window.RMLI18n.t("ui.auto.ffb7ecf059a9"),
      group: window.RMLI18n.t("ui.literal.b08eaadf77cf"),
      symbol: "D→F",
      description:
        window.RMLI18n.t("ui.auto.d081bce51543"),
      inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "double")],
      outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "float")]
    },
    "cast.floatToInt": {
      title: window.RMLI18n.t("ui.auto.23bc1d7848f1"),
      group: window.RMLI18n.t("ui.literal.b08eaadf77cf"),
      symbol: "F→I",
      description:
        window.RMLI18n.t("ui.auto.22d9661ca55f"),
      inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "float")],
      outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "int")]
    },
    "cast.toString": {
      title: window.RMLI18n.t("ui.auto.163c64f80b92"),
      group: window.RMLI18n.t("ui.literal.b08eaadf77cf"),
      symbol: "→T",
      description:
        window.RMLI18n.t("ui.auto.eb8d1aac533a"),
      inputs: [
        genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "value")
      ],
      outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "string")]
    },

    "resonite.onStart": {
      title: window.RMLI18n.t("ui.auto.45fd53d641ef"),
      group: window.RMLI18n.t("ui.literal.033df3d297c2"),
      symbol: "▶",
      description:
        window.RMLI18n.t("ui.auto.f8f8b671294d"),
      outputs: [port("impulse", window.RMLI18n.t("ui.auto.1b3f34a2a3e5"), "impulse")]
    },
    "resonite.impulseRelay": {
      title: window.RMLI18n.t("ui.auto.bbb4a377aa9c"),
      group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
      symbol: "↯",
      description:
        window.RMLI18n.t("ui.auto.72b26f61fe51"),
      inputs: [port("in", window.RMLI18n.t("ui.text.aef36502d67b"), "impulse")],
      outputs: [port("out", window.RMLI18n.t("ui.text.220e06ba2fee"), "impulse")]
    },
    "resonite.valueRelay": {
      title: window.RMLI18n.t("ui.auto.ecd455901f58"),
      group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
      symbol: "⇢",
      description:
        window.RMLI18n.t("ui.auto.d7424d0ae540"),
      inputs: [genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "value")],
      outputs: [genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "value")]
    },
    "resonite.displayValue": {
      title: window.RMLI18n.t("ui.auto.cab95ae29ff4"),
      group: window.RMLI18n.t("ui.literal.a89564705d12"),
      symbol: "▣",
      description:
        window.RMLI18n.t("ui.auto.6dc86c7bef65"),
      inputs: [
        genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "value"),
        port(
          "rmlMenu",
          window.RMLI18n.t("ui.auto.daad88084ebc"),
          "rmlDisplaySlot",
          {
            detail:
              window.RMLI18n.t("ui.literal.4b0c6e96f2db")
          }
        )
      ],
      outputs: [],
      displaysValue: true
    },
    "debug.displayImpulse": {
      title: window.RMLI18n.t("ui.auto.72d01e0e8d35"),
      group: window.RMLI18n.t("ui.literal.a89564705d12"),
      symbol: "↯#",
      description:
        window.RMLI18n.t("ui.auto.59746e1c0fb3"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.1b3f34a2a3e5"), "impulse"),
        port(
          "rmlMenu",
          window.RMLI18n.t("ui.auto.daad88084ebc"),
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
          window.RMLI18n.t("ui.auto.72d01e0e8d35");

        return `System.Threading.Interlocked.Increment(ref _impulseCount${token});\nPublishDisplay("${api.escapeString(api.node.id)}", "${api.escapeString(label)}", "impulse", System.Threading.Interlocked.Read(ref _impulseCount${token}));`;
      }
    },
    "resonite.store": {
      title: window.RMLI18n.t("ui.auto.1dd2499dd26f"),
      group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
      symbol: "S",
      description:
        window.RMLI18n.t("ui.auto.df3a3d58c27e"),
      configurableTypeVar: "T",
      configurableTypes: VALUE_TYPES,
      defaultType: "float",
      inputs: [
        port("write", window.RMLI18n.t("ui.auto.c23a796415e2"), "impulse"),
        genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "value")
      ],
      outputs: [
        port("written", window.RMLI18n.t("ui.auto.07c97140f98b"), "impulse"),
        genericPort("current", window.RMLI18n.t("ui.auto.1bdec8cdac77"), "T", "value")
      ]
    },
    "resonite.executionStore": {
      title: window.RMLI18n.t("ui.auto.098329d441f6"),
      group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
      symbol: "Sƒ",
      description:
        window.RMLI18n.t("ui.auto.1b8d42d21f09"),
      configurableTypeVar: "T",
      configurableTypes: VALUE_TYPES,
      defaultType: "float",
      inputs: [
        port("write", window.RMLI18n.t("ui.auto.c23a796415e2"), "impulse"),
        genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "value")
      ],
      outputs: [
        port("written", window.RMLI18n.t("ui.auto.07c97140f98b"), "impulse"),
        genericPort("current", window.RMLI18n.t("ui.auto.1bdec8cdac77"), "T", "value")
      ]
    },
    "resonite.packColorX": {
      title: window.RMLI18n.t("ui.auto.15bd40f02d3e"),
      group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
      symbol: "CLR",
      description:
        window.RMLI18n.t("ui.auto.edb2ecde106e"),
      inputs: [
        port("r", window.RMLI18n.t("ui.auto.ec0b702a8de7"), "float"),
        port("g", window.RMLI18n.t("index.text.01d2675591a7"), "float"),
        port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "float"),
        port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "float")
      ],
      outputs: [port("value", window.RMLI18n.t("index.text.e914de5f0fb9"), "colorX")]
    },
    "resonite.unpackColorX": {
      title: window.RMLI18n.t("ui.auto.e437743b5471"),
      group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
      symbol: "RGB",
      description:
        window.RMLI18n.t("ui.auto.261635054513"),
      inputs: [port("value", window.RMLI18n.t("index.text.e914de5f0fb9"), "colorX")],
      outputs: [
        port("r", window.RMLI18n.t("ui.auto.ec0b702a8de7"), "float"),
        port("g", window.RMLI18n.t("index.text.01d2675591a7"), "float"),
        port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "float"),
        port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "float")
      ]
    },
    "container.apiComposite": {
      title: window.RMLI18n.t("ui.text.e4f5f8cbde11"),
      group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
      symbol: "API",
      iconTone: "gold",
      hiddenFromPalette: true,
      apiCompositeContainer: true,
      description:
        window.RMLI18n.t("ui.auto.e2cf037e7f97"),
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
              window.RMLI18n.t("ui.text.e4f5f8cbde11")
            ).slice(0, 120),
          inputs,
          outputs,
          width: 320
        };
      }
    }
  };

const OPERATOR_GROUP_ORDER = [
    window.RMLI18n.t("ui.auto.cb9729d42e95"),
    window.RMLI18n.t("ui.literal.3edf0df49942"),
    window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
    window.RMLI18n.t("ui.literal.b08eaadf77cf"),
    window.RMLI18n.t("ui.literal.86eff8eb789b"),
    window.RMLI18n.t("ui.literal.033df3d297c2"),
    window.RMLI18n.t("ui.literal.a89564705d12")
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
        window.RMLI18n.t("ui.literal.93f32401cb41")
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

    indexGraphTypeCsType(
      id,
      TYPE_INFO[id]
    );

    registerGraphConfigurableValueType(id);

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
        window.RMLI18n.t("ui.literal.aa7c73a05229")
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
        window.RMLI18n.t("ui.literal.00132c7e31b6")
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
        canonicalType(type) {
          return canonicalGraphType(type);
        },
        canonicalCsType(type) {
          return graphCanonicalCsType(type);
        },
        getNodeDefinitions() {
          return OPERATOR_DEFINITIONS;
        },
        refreshLanguagePresentation() {
          return {
            definitions: window.RMLI18n.relocalize(OPERATOR_DEFINITIONS),
            types: window.RMLI18n.relocalize(TYPE_INFO),
            groups: window.RMLI18n.relocalize(OPERATOR_GROUP_ORDER),
            runtimeBehaviors: window.RMLI18n.relocalize(RUNTIME_BEHAVIORS)
          };
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
    const canonical =
      canonicalGraphType(type);
    if (
      typeof canonical === "string" &&
      canonical.startsWith("enum:")
    ) {
      return "enum";
    }

    return canonical || "generic";
  }
