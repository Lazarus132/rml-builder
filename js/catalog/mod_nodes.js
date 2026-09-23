(() => {
  "use strict";

  const registry = window.RMLModNodeRegistry;
  const requiredRegistryCapabilities = [
    "port",
    "genericPort",
    "registerType",
    "registerGroup",
    "registerNode",
    "registerCodegenPlugin",
    "getNodeDefinition",
    "getNodeDefinitions",
    "getTypeDefinitions",
    "canonicalType",
    "canonicalCsType"
  ];

  if (
    !registry ||
    requiredRegistryCapabilities.some(
      capability =>
        typeof registry[capability] !==
        "function"
    )
  ) {
    console.error(
      window.RMLI18n.t("ui.literal.7a21d259ee6d")
    );
    return;
  }

  const {
    port,
    genericPort,
    registerType,
    registerGroup,
    registerNode,
    registerCodegenPlugin
  } = registry;

  const generatedGuidance = (
    api,
    key
  ) => {
    if (api?.includeGuideComments !== true && api?.metadata?.includeGuide !== true) return "";
    const value = window.RMLGuidance.text("runtime", key);
    if (
      typeof api?.guidanceComment ===
        "function"
    ) {
      return api.guidanceComment(value);
    }
    return api?.metadata?.includeGuide === true
      ? String(value || "")
      : "";
  };

  const reportGuidance = (
    api,
    key
  ) => {
    const message = generatedGuidance(api, key);
    if (!message) return;
    if (typeof api?.guidance === "function") {
      api.guidance(message);
      return;
    }
    if (
      api?.metadata?.includeGuide === true &&
      typeof api?.warning === "function"
    ) {
      api.warning(message);
    }
  };

  const pText = (
    key,
    label,
    defaultValue = "",
    help = "",
    extra = {}
  ) => ({
    key,
    label,
    kind: "text",
    default: defaultValue,
    help,
    ...extra
  });

  const pCode = (
    key,
    label,
    defaultValue = "",
    help = "",
    rows = 8
  ) => ({
    key,
    label,
    kind: "code",
    default: defaultValue,
    help,
    rows,
    monospace: true,
    spellcheck: false
  });

  const pBool = (
    key,
    label,
    defaultValue = false,
    help = ""
  ) => ({
    key,
    label,
    kind: "bool",
    default: defaultValue,
    help
  });

  const pSelect = (
    key,
    label,
    options,
    defaultValue,
    help = "",
    extra = {}
  ) => ({
    key,
    label,
    kind: "select",
    options,
    default: defaultValue,
    help,
    ...extra
  });

  const pNumber = (
    key,
    label,
    defaultValue = 0,
    help = ""
  ) => ({
    key,
    label,
    kind: "number",
    default: defaultValue,
    storeAsNumber: true,
    help
  });

  const CSHARP_IDENTIFIER_KEYWORDS =
    new Set([
      "abstract", "as", "base", "bool", "break", "byte",
      "case", "catch", "char", "checked", "class", "const",
      "continue", "decimal", "default", "delegate", "do",
      "double", "else", "enum", "event", "explicit", "extern",
      "false", "finally", "fixed", "float", "for", "foreach",
      "goto", "if", "implicit", "in", "int", "interface",
      "internal", "is", "lock", "long", "namespace", "new",
      "null", "object", "operator", "out", "override", "params",
      "private", "protected", "public", "readonly", "ref",
      "return", "sbyte", "sealed", "short", "sizeof", "stackalloc",
      "static", "string", "struct", "switch", "this", "throw",
      "true", "try", "typeof", "uint", "ulong", "unchecked",
      "unsafe", "ushort", "using", "virtual", "void", "volatile",
      "while", "add", "alias", "and", "ascending", "async",
      "await", "by", "descending", "dynamic", "equals", "file",
      "from", "get", "global", "group", "init", "into", "join",
      "let", "managed", "nameof", "nint", "not", "notnull",
      "nuint", "on", "or", "orderby", "partial", "record",
      "remove", "required", "scoped", "select", "set", "unmanaged",
      "value", "var", "when", "where", "with", "yield"
    ]);

  function csharpIdentifier(value) {
    const identifier = String(value || "");

    return CSHARP_IDENTIFIER_KEYWORDS.has(
      identifier
    )
      ? `@${identifier}`
      : identifier;
  }

  const componentCatalog =
    window.RMLResoniteApiCatalog ||
    window.RMLFrooxComponentCatalog ||
    Object.freeze({
      schemaVersion: 3,
      catalogSource: "unavailable",
      engineVersion: "unknown",
      types: Object.freeze([]),
      enums: Object.freeze([])
    });

  const CATALOG_TYPES =
    Array.isArray(componentCatalog.types)
      ? componentCatalog.types.filter(
          value =>
            value &&
            typeof value === "object"
        )
      : [];

  const CATALOG_ENUMS =
    Array.isArray(componentCatalog.enums)
      ? componentCatalog.enums.filter(
          value =>
            value &&
            typeof value === "object" &&
            typeof value.fullName === "string" &&
            Array.isArray(value.values) &&
            value.values.length > 0 &&
            value.isObsolete !== true
        )
      : [];

  const CATALOG_ENUM_BY_NAME =
    new Map(
      CATALOG_ENUMS.map(value => [
        value.fullName,
        value
      ])
    );

  const CATALOG_ENUM_TYPE_PREFIX =
    "apiEnum:";

  function catalogEnumGraphType(
    fullName
  ) {
    return `${CATALOG_ENUM_TYPE_PREFIX}${fullName}`;
  }

  const RAW_CSHARP_GROUP =
    window.RMLI18n.t("js.presentation.493e463115c3");

  const NUMERIC_VECTOR_TYPES =
    GRAPH_CONFIGURABLE_VECTOR_TYPES;

  const COMMON_VALUE_TYPES = [
    "bool",
    "string",
    window.RMLI18n.t("ui.literal.7784ac6f7e85"),
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

  const JSON_CONVERTIBLE_TYPES = [
    "bool",
    "string",
    window.RMLI18n.t("ui.literal.7784ac6f7e85"),
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
    "colorX",
    "object",
    "byteArray",
    "stringArray",
    "objectArray"
  ];

  const typeDefinitions = {
    object: {
      label: window.RMLI18n.t("ui.auto.70bd5b4088b4"),
      short: "OBJ",
      color: "#bcc7d2",
      csType: "object",
      defaultCs: "null!",
      acceptsAnyValue: true,
      referenceType: true,
      constraints: ["reference", "serializable"]
    },
    byteArray: {
      label: window.RMLI18n.t("ui.auto.b3564bb6b30f"),
      short: "BIN",
      color: "#d1ad73",
      csType: "byte[]",
      defaultCs: "Array.Empty<byte>()",
      referenceType: true,
      collectionType: true,
      enumerableElementType: "int",
      enumerableElementCsType: "System.Byte",
      constraints: ["reference", "serializable", "enumerable"]
    },
    stringArray: {
      label: window.RMLI18n.t("ui.auto.23054497c9cd"),
      short: "TXT[]",
      color: "#ff96c9",
      csType: "string[]",
      defaultCs: "Array.Empty<string>()",
      referenceType: true,
      collectionType: true,
      enumerableElementType: "string",
      enumerableElementCsType: "System.String",
      constraints: ["reference", "serializable", "enumerable"]
    },
    objectArray: {
      label: window.RMLI18n.t("ui.auto.9944db56fd61"),
      short: "OBJ[]",
      color: "#aab5c0",
      csType: "object?[]",
      defaultCs: "Array.Empty<object?>()",
      referenceType: true,
      collectionType: true,
      enumerableElementType: "object",
      enumerableElementCsType: "System.Object",
      constraints: ["reference", "serializable", "enumerable"]
    },
    type: {
      label: window.RMLI18n.t("ui.auto.494abb3299aa"),
      short: "TYPE",
      color: "#76c6ff",
      csType: "System.Type",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    memberInfo: {
      label: window.RMLI18n.t("ui.auto.2dd10d844955"),
      short: "MEM",
      color: "#70bce8",
      csType: "System.Reflection.MemberInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    methodBase: {
      label: window.RMLI18n.t("ui.auto.b5ba5ee47cb7"),
      short: "MBASE",
      color: "#5fb7ee",
      csType: "System.Reflection.MethodBase",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["memberInfo", "object"]
    },
    methodInfo: {
      label: window.RMLI18n.t("ui.auto.2cd8c93057cd"),
      short: "METH",
      color: "#4eace6",
      csType: "System.Reflection.MethodInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["methodBase", "memberInfo", "object"]
    },
    fieldInfo: {
      label: window.RMLI18n.t("ui.auto.449af3528b8c"),
      short: "FIELD",
      color: "#4fc6c8",
      csType: "System.Reflection.FieldInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["memberInfo", "object"]
    },
    propertyInfo: {
      label: window.RMLI18n.t("ui.auto.b0d345d85eba"),
      short: "PROP",
      color: "#52d2b4",
      csType: "System.Reflection.PropertyInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["memberInfo", "object"]
    },
    exception: {
      label: window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
      short: "EX",
      color: "#ff7188",
      csType: "System.Exception",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    patchContext: {
      label: window.RMLI18n.t("ui.auto.d8f3e464e2b2"),
      short: "PATCH",
      color: "#ef9e68",
      csType: window.RMLI18n.t("ui.literal.7ba3c71580fe"),
      defaultCs: "new PatchContext()",
      referenceType: true,
      assignableTo: ["object"]
    },
    floatQ: {
      label: window.RMLI18n.t("ui.auto.66d9f01db53b"),
      short: "QUAT",
      color: "#61d3ff",
      csType: "Elements.Core.floatQ",
      defaultCs: "Elements.Core.floatQ.Identity",
      assembly: "Elements.Core"
    },
    primitive: {
      label: window.RMLI18n.t("ui.auto.d2f5d254475c"),
      short: "PRIM",
      color: "#f2c66d",
      csType: "FrooxEngine.Primitive",
      defaultCs: "FrooxEngine.Primitive.Cube"
    },
    blendMode: {
      label: window.RMLI18n.t("ui.auto.a00719baf539"),
      short: "BLEND",
      color: "#ff9c75",
      csType: "FrooxEngine.BlendMode",
      defaultCs: "FrooxEngine.BlendMode.Opaque"
    },
    textureWrapMode: {
      label: window.RMLI18n.t("ui.auto.d46976e7cfaf"),
      short: "WRAP",
      color: "#ffb86a",
      csType: window.RMLI18n.t("ui.literal.d697178425b0"),
      defaultCs: window.RMLI18n.t("ui.literal.ff719d771154"),
      assembly: window.RMLI18n.t("ui.literal.38b9a2fd4ae5")
    },
    engine: {
      label: window.RMLI18n.t("ui.auto.519d9d9e0110"),
      short: "ENG",
      color: "#67d6ff",
      csType: "FrooxEngine.Engine",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    world: {
      label: window.RMLI18n.t("ui.auto.a1575930d6c6"),
      short: "WORLD",
      color: "#62e4c4",
      csType: "FrooxEngine.World",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    user: {
      label: window.RMLI18n.t("ui.auto.33df9bcc7378"),
      short: "USER",
      color: "#65dcb1",
      csType: "FrooxEngine.User",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    slot: {
      label: window.RMLI18n.t("ui.auto.5c646319a3a5"),
      short: "SLOT",
      color: "#8ae271",
      csType: "FrooxEngine.Slot",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    component: {
      label: window.RMLI18n.t("ui.auto.4394abfea2eb"),
      short: "COMP",
      color: "#a4df64",
      csType: "FrooxEngine.Component",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    uiBuilder: {
      label: window.RMLI18n.t("ui.auto.a35d8d91f682"),
      short: "UIB",
      color: "#de8cff",
      csType: "FrooxEngine.UIX.UIBuilder",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    uiElement: {
      label: window.RMLI18n.t("ui.auto.b826f0c94256"),
      short: "UI",
      color: "#f18ce6",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    asset: {
      label: window.RMLI18n.t("ui.auto.075f36905922"),
      short: "ASSET",
      color: "#f6c75c",
      csType: "FrooxEngine.IAssetProvider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    texture: {
      label: window.RMLI18n.t("ui.auto.a206d6341a45"),
      short: "TEX",
      color: "#ffb655",
      csType: "FrooxEngine.IAssetProvider<FrooxEngine.ITexture2D>",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    material: {
      label: window.RMLI18n.t("ui.auto.9f9320abfa60"),
      short: "MAT",
      color: "#f4a261",
      csType: "FrooxEngine.IAssetProvider<FrooxEngine.Material>",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    commonMaterial: {
      label: window.RMLI18n.t("ui.auto.3eb0edce115b"),
      short: "CMAT",
      color: "#f39a64",
      csType: "FrooxEngine.ICommonMaterial",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["material", "asset", "object"]
    },
    pbsMaterial: {
      label: window.RMLI18n.t("ui.auto.a87e7fda9a6f"),
      short: "PBS",
      color: "#f18c5d",
      csType: "FrooxEngine.PBS_Material",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["commonMaterial", "material", "asset", "component", "object"]
    },
    pbsMetallic: {
      label: window.RMLI18n.t("ui.auto.a31d531fd00c"),
      short: "PBS-M",
      color: "#ef8057",
      csType: "FrooxEngine.PBS_Metallic",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["pbsMaterial", "commonMaterial", "material", "asset", "component", "object"]
    },
    pbsSpecular: {
      label: window.RMLI18n.t("ui.auto.385e865a28ec"),
      short: "PBS-S",
      color: "#ee7c6d",
      csType: "FrooxEngine.PBS_Specular",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["pbsMaterial", "commonMaterial", "material", "asset", "component", "object"]
    },
    unlitMaterial: {
      label: window.RMLI18n.t("ui.auto.029f0f79c066"),
      short: "UNLIT",
      color: "#ef9b6c",
      csType: "FrooxEngine.UnlitMaterial",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["commonMaterial", "material", "asset", "component", "object"]
    },
    mesh: {
      label: window.RMLI18n.t("ui.auto.ff830ef7872e"),
      short: "MESH",
      color: "#dfbd69",
      csType: "FrooxEngine.IAssetProvider<FrooxEngine.Mesh>",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    audioClip: {
      label: window.RMLI18n.t("ui.auto.00ee9511bb70"),
      short: "AUD",
      color: "#d8d66a",
      csType: "FrooxEngine.IAssetProvider<FrooxEngine.AudioClip>",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    meshRenderer: {
      label: window.RMLI18n.t("ui.auto.deb54d36f649"),
      short: "RENDER",
      color: "#d5b56a",
      csType: "FrooxEngine.MeshRenderer",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    collider: {
      label: window.RMLI18n.t("ui.auto.3ef4579d666c"),
      short: "COL",
      color: "#cfca73",
      csType: "FrooxEngine.Collider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    meshCollider: {
      label: window.RMLI18n.t("ui.auto.0485b124cc91"),
      short: "MCOL",
      color: "#c9c56a",
      csType: "FrooxEngine.MeshCollider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["collider", "component", "object"]
    },
    boxCollider: {
      label: window.RMLI18n.t("ui.auto.1c64606412af"),
      short: "BCOL",
      color: "#c6c267",
      csType: "FrooxEngine.BoxCollider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["collider", "component", "object"]
    },
    sphereCollider: {
      label: window.RMLI18n.t("ui.auto.acdc0f461d7c"),
      short: "SCOL",
      color: "#c4c065",
      csType: "FrooxEngine.SphereCollider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["collider", "component", "object"]
    },
    cylinderCollider: {
      label: window.RMLI18n.t("ui.auto.3a57e36178f0"),
      short: "CCOL",
      color: "#c2be63",
      csType: "FrooxEngine.CylinderCollider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["collider", "component", "object"]
    },
    quadMesh: {
      label: window.RMLI18n.t("ui.auto.811ba25a606b"),
      short: "QUAD",
      color: "#e0bf70",
      csType: "FrooxEngine.QuadMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    boxMesh: {
      label: window.RMLI18n.t("ui.auto.cd4540589dd7"),
      short: "BOX",
      color: "#dfbb6b",
      csType: "FrooxEngine.BoxMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    sphereMesh: {
      label: window.RMLI18n.t("ui.auto.727adb2bfc86"),
      short: "SPHERE",
      color: "#ddb767",
      csType: "FrooxEngine.SphereMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    cylinderMesh: {
      label: window.RMLI18n.t("ui.auto.e41b60615060"),
      short: "CYL",
      color: "#dbb363",
      csType: "FrooxEngine.CylinderMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    arrowMesh: {
      label: window.RMLI18n.t("ui.auto.d4dc2c69f137"),
      short: "ARROW",
      color: "#d9af60",
      csType: "FrooxEngine.ArrowMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    staticTexture2D: {
      label: window.RMLI18n.t("ui.auto.a61482adab41"),
      short: "STEX",
      color: "#ffb35a",
      csType: "FrooxEngine.StaticTexture2D",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["texture", "asset", "component", "object"]
    },
    staticCubemap: {
      label: window.RMLI18n.t("ui.auto.f24bde7c3aef"),
      short: "CUBE-T",
      color: "#ffad58",
      csType: "FrooxEngine.StaticCubemap",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "component", "object"]
    },
    spriteProvider: {
      label: window.RMLI18n.t("ui.auto.608e654bf604"),
      short: "SPRITE",
      color: "#ffa957",
      csType: "FrooxEngine.SpriteProvider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "component", "object"]
    },
    staticMesh: {
      label: window.RMLI18n.t("ui.auto.2fa6dc7af506"),
      short: "SMESH",
      color: "#d8b05f",
      csType: "FrooxEngine.StaticMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    staticAudioClip: {
      label: window.RMLI18n.t("ui.auto.f9d5e335a642"),
      short: "SAUD",
      color: "#d4d366",
      csType: "FrooxEngine.StaticAudioClip",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["audioClip", "asset", "component", "object"]
    },
    staticFont: {
      label: window.RMLI18n.t("ui.auto.09f6f30a7d2f"),
      short: "FONT",
      color: "#e0cb72",
      csType: "FrooxEngine.StaticFont",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "component", "object"]
    },
    skybox: {
      label: window.RMLI18n.t("ui.auto.ca2725e6ae98"),
      short: "SKY",
      color: "#879bea",
      csType: "FrooxEngine.Skybox",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    grabbable: {
      label: window.RMLI18n.t("ui.auto.d7b93646c241"),
      short: "GRAB",
      color: "#8fdf83",
      csType: "FrooxEngine.Grabbable",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    audioOutput: {
      label: window.RMLI18n.t("ui.auto.298c18c975df"),
      short: "AOUT",
      color: "#d0d15f",
      csType: "FrooxEngine.AudioOutput",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    dynamicVariableSpace: {
      label: window.RMLI18n.t("ui.auto.fe55a429181e"),
      short: "DVS",
      color: "#57d6b8",
      csType: "FrooxEngine.DynamicVariableSpace",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    radiantDash: {
      label: window.RMLI18n.t("ui.auto.f0ff54d0e3de"),
      short: "DASH",
      color: "#ffbd68",
      csType: "FrooxEngine.RadiantDash",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    json: {
      label: window.RMLI18n.t("ui.auto.485c603d6cff"),
      short: "JSON",
      color: "#e9c26b",
      csType: "System.Text.Json.Nodes.JsonNode",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    httpResponse: {
      label: window.RMLI18n.t("ui.auto.220cca5196f2"),
      short: "HTTP",
      color: "#53d4e8",
      csType: window.RMLI18n.t("ui.literal.8b67e5e34605"),
      defaultCs: window.RMLI18n.t("ui.literal.41708101ba15"),
      referenceType: true,
      assignableTo: ["object"]
    },
    webSocket: {
      label: window.RMLI18n.t("ui.auto.30cc3b2b809b"),
      short: "WS",
      color: "#46cfe2",
      csType: "System.Net.WebSockets.ClientWebSocket",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    task: {
      label: window.RMLI18n.t("ui.auto.3eec9366cd84"),
      short: "TASK",
      color: "#b8a2ff",
      csType: "System.Threading.Tasks.Task",
      defaultCs: "System.Threading.Tasks.Task.CompletedTask",
      referenceType: true,
      assignableTo: ["object"]
    },
    cancellationToken: {
      label: window.RMLI18n.t("ui.auto.6e45c9606ab3"),
      short: "CANCEL",
      color: "#a395e8",
      csType: "System.Threading.CancellationToken",
      defaultCs: "System.Threading.CancellationToken.None"
    }
  };

  const CATALOG_TYPE_BY_CS = new Map(
    CATALOG_TYPES
      .filter(type =>
        typeof type.fullName === "string" &&
        type.fullName.trim()
      )
      .map(type => [
        String(type.fullName).trim(),
        type
      ])
  );
  const CATALOG_ASSEMBLY_BY_NAME = new Map(
    (Array.isArray(componentCatalog.assemblies)
      ? componentCatalog.assemblies
      : [])
      .filter(Boolean)
      .map(assembly => [
        String(assembly.name || "").trim(),
        assembly
      ])
      .filter(([name]) => Boolean(name))
  );

  function catalogAssemblyReferencesForCsType(csType) {
    const normalized =
      String(csType || "")
        .replace(/global::/g, "")
        .trim();
    const names = new Set();
    const direct =
      CATALOG_TYPE_BY_CS.get(normalized);

    if (direct) names.add(normalized);

    for (const candidate of
      normalized.match(
        /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+/g
      ) || []) {
      if (CATALOG_TYPE_BY_CS.has(candidate)) {
        names.add(candidate);
      }
    }

    const references = new Map();

    for (const name of names) {
      const row = CATALOG_TYPE_BY_CS.get(name);
      const include = String(
        row?.assembly || ""
      ).trim();
      if (!include) continue;

      const location = String(
        CATALOG_ASSEMBLY_BY_NAME.get(include)
          ?.location || ""
      )
        .trim()
        .replace(/\\/g, "/")
        .replace(/^\.\//, "");

      references.set(
        include.toLowerCase(),
        {
          include,
          hintPath: location
            ? `$(ResonitePath)${location}`
            : `$(ResonitePath)${include}.dll`,
          private: false
        }
      );
    }

    return [...references.values()];
  }

  for (const [type, information] of Object.entries(typeDefinitions)) {
    const assemblyReferences =
      catalogAssemblyReferencesForCsType(
        information.csType
      );
    const storeableInformation = {
      valueType: information.valueType !== false,
      ...information,
      assembly:
        information.assembly ||
        assemblyReferences[0]?.include ||
        "",
      assemblies: [...new Set([
        ...(Array.isArray(information.assemblies)
          ? information.assemblies
          : []),
        ...assemblyReferences.map(reference =>
          reference.include
        )
      ])],
      assemblyReferences: [
        ...(Array.isArray(information.assemblyReferences)
          ? information.assemblyReferences
          : []),
        ...assemblyReferences
      ]
    };

    registerType(type, storeableInformation);

    if (
      storeableInformation.valueType === true &&
      !COMMON_VALUE_TYPES.includes(type)
    ) {
      COMMON_VALUE_TYPES.push(type);
    }
  }

  for (const enumInfo of CATALOG_ENUMS) {
    const firstValue =
      enumInfo.values[0]?.name ||
      "0";

    registerType(
      catalogEnumGraphType(
        enumInfo.fullName
      ),
      {
        label:
          enumInfo.fullName
            .split(".")
            .pop() ||
          enumInfo.fullName,
        short: window.RMLI18n.t("ui.literal.507ccbdaf83a"),
        color: "#ffd181",
        csType: enumInfo.fullName,
        defaultCs:
          `global::${enumInfo.fullName}.${csharpIdentifier(firstValue)}`,
        valueType: false,
        assembly:
          CATALOG_TYPE_BY_CS.get(
            enumInfo.fullName
          )?.assembly || "",
        assemblies:
          catalogAssemblyReferencesForCsType(
            enumInfo.fullName
          ).map(reference =>
            reference.include
          ),
        assemblyReferences:
          catalogAssemblyReferencesForCsType(
            enumInfo.fullName
          ),
        constraints: [
          "value",
          "serializable"
        ]
      }
    );
  }

  const groups = [
    [window.RMLI18n.t("ui.auto.5578a51dba94"), { after: window.RMLI18n.t("ui.literal.86eff8eb789b") }],
    [window.RMLI18n.t("ui.literal.6a455a999dee"), { after: window.RMLI18n.t("ui.literal.86eff8eb789b") }],
    [window.RMLI18n.t("ui.literal.0cef4df4d340"), { after: window.RMLI18n.t("ui.literal.3edf0df49942") }],
    [window.RMLI18n.t("ui.literal.4bbb632f02fd"), { after: window.RMLI18n.t("ui.literal.86eff8eb789b") }],
    [window.RMLI18n.t("ui.literal.09b6aa6507d0"), { after: window.RMLI18n.t("ui.literal.033df3d297c2") }],
    [window.RMLI18n.t("ui.literal.fda05af620d8"), { after: window.RMLI18n.t("ui.literal.09b6aa6507d0") }],
    [window.RMLI18n.t("ui.literal.e0a3f9595d1e"), { after: window.RMLI18n.t("ui.literal.a89564705d12") }],
    [window.RMLI18n.t("ui.literal.338a24d2c0b4"), { after: window.RMLI18n.t("ui.literal.e0a3f9595d1e") }],
    [window.RMLI18n.t("ui.literal.5a24bc037931"), { after: window.RMLI18n.t("ui.literal.338a24d2c0b4") }],
    [window.RMLI18n.t("ui.externalized.9d57875196c6"), { after: window.RMLI18n.t("ui.literal.5a24bc037931") }],
    [window.RMLI18n.t("ui.literal.20e338624cee"), { after: window.RMLI18n.t("ui.externalized.9d57875196c6") }],
    [window.RMLI18n.t("ui.literal.a513560b7e42"), { after: window.RMLI18n.t("ui.literal.20e338624cee") }],
    [window.RMLI18n.t("ui.literal.1e9174855701"), { after: window.RMLI18n.t("ui.literal.a513560b7e42") }],
    [window.RMLI18n.t("ui.literal.6aa5e4a6e67c"), { after: window.RMLI18n.t("ui.literal.1e9174855701") }],
    [RAW_CSHARP_GROUP, { after: window.RMLI18n.t("ui.literal.6aa5e4a6e67c") }]
  ];

  for (const [name, options] of groups) {
    registerGroup(name, options);
  }

  registerType(
    "rmlConfigurationMenu",
    {
      label: window.RMLI18n.t("ui.auto.5578a51dba94"),
      short: "MENU",
      color: "#b47cff",
      csType:
        window.RMLI18n.t("ui.literal.dba28684a64c"),
      defaultCs:
        window.RMLI18n.t("ui.literal.b153353c185f"),
      referenceType: true,
      valueType: false,
      globalGenericCandidate: false,
      constraints: [
        "value",
        "reference"
      ]
    }
  );

  registerType(
    "rmlConfigurationMenuItem",
    {
      label: window.RMLI18n.t("ui.auto.a4f8b7d9af23"),
      short: "ITEM",
      color: "#d09cff",
      csType:
        window.RMLI18n.t("ui.literal.d5b327b58de6"),
      defaultCs:
        window.RMLI18n.t("ui.literal.2dbcbc6251ba"),
      referenceType: true,
      valueType: false,
      globalGenericCandidate: false,
      constraints: [
        "value",
        "reference"
      ]
    }
  );

  registerType(
    "action",
    {
      label: window.RMLI18n.t("ui.auto.c3c93182883a"),
      short: "ACT",
      color: "#e4a7ff",
      csType: "System.Action",
      defaultCs: "delegate { }",
      referenceType: true,
      valueType: false,
      globalGenericCandidate: false,
      constraints: [
        "value",
        "reference",
        "delegate"
      ]
    }
  );

  function ensureRuntimeConfigurationMenu(
    api
  ) {
    api.require(
      "usesRuntimeConfigurationMenu"
    );
    api.addUsing("System.Threading");
    api.addMember(
      "configuration.runtimeMenu",
      globalThis.RMLCodeTemplates.text("nodes", window.RMLI18n.t("ui.literal.0f32d1f8a061"), [])
    );
  }

  registerNode(
    "configuration.menuInstance",
    {
      title:
        window.RMLI18n.t("ui.auto.516cb18c5431"),
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: window.RMLI18n.t("ui.literal.c8910b26f572"),
      description:
        window.RMLI18n.t("ui.auto.442594a8efdf"),
      inputs: [],
      outputs: [
        port(
          "menu",
          window.RMLI18n.t("ui.auto.dba5e9226b12"),
          "rmlConfigurationMenu"
        )
      ],
      width: 320,
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenExpression(api) {
        if (api.portId === "menu") {
          return window.RMLI18n.t("ui.literal.b153353c185f");
        }

        const itemId =
          String(api.portId || "")
            .startsWith("item-")
            ? String(api.portId)
                .slice("item-".length)
            : "";

        return `RuntimeConfigurationMenuItem.Create("${api.escapeString(itemId)}")`;
      },
      previewEvaluate({
        portId,
        type,
        known
      }) {
        return known(
          type,
          portId === "menu"
            ? {
                kind:
                  "configuration-menu"
              }
            : {
                kind:
                  "configuration-menu-item",
                itemId:
                  String(portId || "")
                    .replace(
                      /^item-/,
                      ""
                    )
              }
        );
      }
    }
  );

  registerNode(
    "configuration.setVisibility",
    {
      title:
        window.RMLI18n.t("ui.auto.c17c913e0a52"),
      presentationTitleKey: "ui.auto.c17c913e0a52",
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: window.RMLI18n.t("ui.literal.41dc182533ef"),
      description:
        window.RMLI18n.t("ui.auto.159365f6d8df"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port(
          "item",
          window.RMLI18n.t("ui.auto.1a9e29912a35"),
          "rmlConfigurationMenuItem"
        ),
        port(
          "visible",
          window.RMLI18n.t("ui.auto.e91726345405"),
          "bool"
        )
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")
      ],
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenAction(api) {
        const next = api.emit("done");
        return `SetRuntimeConfigurationMenuVisibility(${api.input("item").code}, ${api.input("visible").code});${next ? `\n        ${next}();` : ""}`;
      }
    }
  );

  registerNode(
    "configuration.setOrder",
    {
      title:
        window.RMLI18n.t("ui.auto.e1844ec59ef9"),
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: "#↕",
      description:
        window.RMLI18n.t("ui.auto.6fa2beb36f00"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port(
          "item",
          window.RMLI18n.t("ui.auto.1a9e29912a35"),
          "rmlConfigurationMenuItem"
        ),
        port("order", window.RMLI18n.t("ui.auto.633c046f7929"), "int")
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")
      ],
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenAction(api) {
        const next = api.emit("done");
        return `SetRuntimeConfigurationMenuOrder(${api.input("item").code}, ${api.input("order").code});${next ? `\n        ${next}();` : ""}`;
      }
    }
  );

  registerNode(
    "configuration.setValue",
    {
      title:
        window.RMLI18n.t("ui.auto.c7e0105bb28d"),
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: window.RMLI18n.t("ui.literal.55c5d81017a3"),
      description:
        window.RMLI18n.t("ui.auto.8d7434bb058a"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port(
          "item",
          window.RMLI18n.t("ui.auto.1a9e29912a35"),
          "rmlConfigurationMenuItem"
        ),
        port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object"),
        port("save", window.RMLI18n.t("ui.auto.98bfbbcb32cb"), "bool")
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")
      ],
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenAction(api) {
        const next = api.emit("done");
        return `SetRuntimeConfigurationMenuValue(${api.input("item").code}, ${api.input("value").code}, ${api.input("save").code});${next ? `\n        ${next}();` : ""}`;
      }
    }
  );

  registerNode(
    "configuration.saveSettings",
    {
      title:
        window.RMLI18n.t("ui.auto.c26698e06316"),
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: window.RMLI18n.t("ui.literal.508156a39b09"),
      description:
        window.RMLI18n.t("ui.auto.a67e4c2bde30"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse")
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
        port(
          "failed",
          window.RMLI18n.t("ui.auto.ab96e7f19dcd"),
          "impulse"
        )
      ],
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenAction(api) {
        const done = api.emit("done");
        const failed =
          api.emit("failed");
        return `if (SaveRuntimeConfigurationMenuSettings())
        {
            ${done ? `${done}();` : ""}
        }
        else
        {
            ${failed ? `${failed}();` : ""}
        }`;
      }
    }
  );

  registerNode(
    "configuration.setLayout",
    {
      title:
        window.RMLI18n.t("ui.auto.1828ed2ee3e3"),
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: "⇄",
      description:
        window.RMLI18n.t("ui.auto.7e4655b3a067"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port(
          "item",
          window.RMLI18n.t("ui.auto.b56dbc9f6381"),
          "rmlConfigurationMenuItem"
        ),
        port(
          "horizontal",
          window.RMLI18n.t("ui.auto.de2b5be8b7ab"),
          "bool"
        )
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")
      ],
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenAction(api) {
        const next = api.emit("done");
        return `SetRuntimeConfigurationMenuHorizontalLayout(${api.input("item").code}, ${api.input("horizontal").code});${next ? `\n        ${next}();` : ""}`;
      }
    }
  );

  registerNode(
    "configuration.setWidth",
    {
      title:
        window.RMLI18n.t("ui.auto.816e592ca6d0"),
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: "%↔",
      description:
        window.RMLI18n.t("ui.auto.8aa7b256b4d9"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port(
          "item",
          window.RMLI18n.t("ui.auto.d2baa39ab23b"),
          "rmlConfigurationMenuItem"
        ),
        port(
          "width",
          window.RMLI18n.t("ui.auto.82044bb7d215"),
          "float"
        )
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")
      ],
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenAction(api) {
        const next = api.emit("done");
        return `SetRuntimeConfigurationMenuWidthPercent(${api.input("item").code}, ${api.input("width").code});${next ? `\n        ${next}();` : ""}`;
      }
    }
  );

  registerNode(
    "configuration.setLabelVisibility",
    {
      title:
        window.RMLI18n.t("ui.auto.db81b5534faa"),
      presentationTitleKey: "ui.auto.db81b5534faa",
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: window.RMLI18n.t("ui.literal.7475c2bd1230"),
      description:
        window.RMLI18n.t("ui.auto.734c0c50937d"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port(
          "item",
          window.RMLI18n.t("ui.auto.d2baa39ab23b"),
          "rmlConfigurationMenuItem"
        ),
        port(
          "visible",
          window.RMLI18n.t("ui.auto.b6ac8fb5ce04"),
          "bool"
        )
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")
      ],
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenAction(api) {
        const next = api.emit("done");
        return `SetRuntimeConfigurationMenuLabelVisibility(${api.input("item").code}, ${api.input("visible").code});${next ? `\n        ${next}();` : ""}`;
      }
    }
  );

  registerNode(
    "configuration.resetItem",
    {
      title:
        window.RMLI18n.t("ui.auto.1b9be2138464"),
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: "↶1",
      description:
        window.RMLI18n.t("ui.auto.3a9b0ed70f07"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port(
          "item",
          window.RMLI18n.t("ui.auto.1a9e29912a35"),
          "rmlConfigurationMenuItem"
        )
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")
      ],
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenAction(api) {
        const next = api.emit("done");
        return `ResetRuntimeConfigurationMenuItem(${api.input("item").code});${next ? `\n        ${next}();` : ""}`;
      }
    }
  );

  registerNode(
    "configuration.resetMenu",
    {
      title: window.RMLI18n.t("ui.auto.72fef20c3cad"),
      group: window.RMLI18n.t("ui.auto.5578a51dba94"),
      symbol: "↶ALL",
      description:
        window.RMLI18n.t("ui.auto.745e426d967c"),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port(
          "menu",
          window.RMLI18n.t("ui.auto.dba5e9226b12"),
          "rmlConfigurationMenu"
        )
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")
      ],
      codegenCollect(api) {
        ensureRuntimeConfigurationMenu(
          api
        );
      },
      codegenAction(api) {
        const next = api.emit("done");
        return `ResetRuntimeConfigurationMenu(${api.input("menu").code});${next ? `\n        ${next}();` : ""}`;
      }
    }
  );

  function ensureReflectionRuntime(api) {
    api.addUsing("System.Collections");
    api.addUsing("System.Linq");

    api.addMember("universal.reflection", globalThis.RMLCodeTemplates.text("nodes", window.RMLI18n.t("ui.literal.facfbb978f99"), []));
  }

  function ensureEventRuntime(api) {
    ensureReflectionRuntime(api);
    api.addUsing("System.Linq.Expressions");
    api.addUsing("System.Threading");
    api.addUsing("System.Threading.Tasks");
    api.addMember("universal.event.helpers", globalThis.RMLCodeTemplates.text("nodes", window.RMLI18n.t("ui.literal.6f90b986c59c"), []));
  }

  function ensureJsonRuntime(api) {
    api.addUsing("System.Text.Json");
    api.addUsing("System.Text.Json.Nodes");
    api.addMember("universal.json.helpers", globalThis.RMLCodeTemplates.text("nodes", window.RMLI18n.t("ui.literal.3120302f40f7"), []));
  }

  function ensureNetworkRuntime(api) {
    api.addUsing("System.Net");
    api.addUsing("System.Net.Http");
    api.addUsing("System.Net.Http.Headers");
    api.addUsing("System.Net.Sockets");
    api.addUsing("System.Net.WebSockets");
    api.addUsing("System.Text");
    api.addUsing("System.Threading");
    api.addUsing("System.Threading.Tasks");
  }

  function ensureHttpRuntime(
    api,
    includeResponseType = true
  ) {
    ensureNetworkRuntime(api);
    api.addField(
      "universal.network.httpClient",
      "private static readonly HttpClient _graphHttpClient = new();"
    );
    if (includeResponseType) {
      api.addMember("universal.network.response", globalThis.RMLCodeTemplates.text("nodes", "source_019", []));
    }
  }

  function ensureTaskRuntime(api) {
    api.addUsing("System.Threading");
    api.addUsing("System.Threading.Tasks");
    api.addMember("universal.task.helpers", globalThis.RMLCodeTemplates.text("nodes", "source_020", []));
  }

  function ensureHarmonyRuntime(api) {
    ensureReflectionRuntime(api);
    api.addUsing(window.RMLI18n.t("ui.literal.d8806e74e794"));
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
    api.addMember("universal.harmony.context", globalThis.RMLCodeTemplates.text("nodes", "source_021", []));
    api.addMember(
      "universal.harmony.helpers",
      globalThis.RMLCodeTemplates.text("nodes", window.RMLI18n.t("ui.literal.900440c5e072"), []).replaceAll("__GRAPH_CLASS__", api.graphClassName)
    );
  }

  function nodeToken(api) {
    return api.token(api.node.id);
  }

  function quote(api, value) {
    return `"${api.escapeString(value ?? "")}"`;
  }

  function replaceCodePlaceholders(
    source,
    api,
    extra = {}
  ) {
    let code = String(source || "");
    const replacements = {
      MOD: api.className,
      GRAPH: api.graphClassName,
      NAMESPACE: api.namespaceName,
      NODE: api.identifier(
        api.node?.label ||
          api.definition?.title ||
          window.RMLI18n.t("ui.literal.260f7a8cd4f6")
      ),
      ...extra
    };

    for (const [name, value] of Object.entries(replacements)) {
      code = code.replaceAll(
        `{${name}}`,
        String(value ?? "")
      );
    }

    return code;
  }

  function addStatefulField(
    api,
    suffix,
    csType,
    defaultCode
  ) {
    const token = nodeToken(api);
    const field = `_${suffix}${token}`;
    api.addPersistentRuntimeField(
      `${api.node.id}.${suffix}`,
      field,
      csType,
      defaultCode
    );
    return field;
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

  function generatedActionOutputIsUsed(
    api,
    outputId
  ) {
    const reachable =
      typeof api?.isActionReachable ===
        "function"
        ? api.isActionReachable()
        : true;
    return (
      reachable &&
      generatedOutputIsUsed(api, outputId)
    );
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

  const MATERIAL_GRAPH_TYPES = new Map([
    ["FrooxEngine.PBS_Metallic", "pbsMetallic"],
    [window.RMLI18n.t("ui.literal.8b533a09a505"), "pbsMetallic"],
    ["FrooxEngine.PBS_Specular", "pbsSpecular"],
    [window.RMLI18n.t("ui.literal.7e9ddfaeae77"), "pbsSpecular"],
    ["FrooxEngine.UnlitMaterial", "unlitMaterial"],
    [window.RMLI18n.t("ui.literal.34de54aa2e55"), "unlitMaterial"]
  ]);

  const MESH_GRAPH_TYPES = new Map([
    ["FrooxEngine.QuadMesh", "quadMesh"],
    [window.RMLI18n.t("ui.literal.05713980a5cf"), "quadMesh"],
    ["FrooxEngine.BoxMesh", "boxMesh"],
    [window.RMLI18n.t("ui.literal.2510fa0bceaf"), "boxMesh"],
    ["FrooxEngine.SphereMesh", "sphereMesh"],
    [window.RMLI18n.t("ui.literal.fbd124feda26"), "sphereMesh"],
    ["FrooxEngine.CylinderMesh", "cylinderMesh"],
    [window.RMLI18n.t("ui.literal.73e87be24611"), "cylinderMesh"],
    ["FrooxEngine.ArrowMesh", "arrowMesh"],
    [window.RMLI18n.t("ui.literal.6c9d35b19c9c"), "arrowMesh"],
    ["FrooxEngine.StaticMesh", "staticMesh"],
    [window.RMLI18n.t("ui.literal.1c5147dd603c"), "staticMesh"]
  ]);

  function isSafeCSharpTypeExpression(value) {
    const source = String(value || "").replace(/\s+/g, "");
    let index = 0;

    const identifier = () => {
      if (source[index] === "@") {
        index += 1;
      }

      const match = source
        .slice(index)
        .match(/^[A-Za-z_][A-Za-z0-9_]*/);

      if (!match) {
        return false;
      }

      index += match[0].length;
      return true;
    };

    const type = () => {
      if (source.startsWith("global::", index)) {
        index += "global::".length;
      }

      if (!identifier()) {
        return false;
      }

      while (source[index] === ".") {
        index += 1;
        if (!identifier()) {
          return false;
        }
      }

      if (source[index] === "<") {
        index += 1;

        if (!type()) {
          return false;
        }

        while (source[index] === ",") {
          index += 1;
          if (!type()) {
            return false;
          }
        }

        if (source[index] !== ">") {
          return false;
        }

        index += 1;
      }

      while (
        source[index] === "[" &&
        source[index + 1] === "]"
      ) {
        index += 2;
      }

      return true;
    };

    return Boolean(source && type() && index === source.length);
  }

  function graphMaterialType(value) {
    return MATERIAL_GRAPH_TYPES.get(
      String(value || "").trim()
    ) || "commonMaterial";
  }

  function graphMeshType(value) {
    return MESH_GRAPH_TYPES.get(
      String(value || "").trim()
    ) || "mesh";
  }

  function splitCatalogGenericArguments(value) {
    const source = String(value || "");
    const result = [];
    let depth = 0;
    let start = 0;

    for (
      let index = 0;
      index < source.length;
      index += 1
    ) {
      const character = source[index];

      if (character === "<" || character === "[") {
        depth += 1;
      } else if (
        character === ">" ||
        character === "]"
      ) {
        depth = Math.max(0, depth - 1);
      } else if (
        character === "," &&
        depth === 0
      ) {
        result.push(
          source.slice(start, index)
        );
        start = index + 1;
      }
    }

    const tail = source.slice(start);

    if (tail) {
      result.push(tail);
    }

    return result
      .map(argument =>
        normalizedCatalogTypeName(argument)
      )
      .filter(Boolean);
  }

  function catalogGenericTypeParts(value) {
    const source =
      normalizedCatalogTypeName(value);
    const open = source.indexOf("<");

    if (open < 1) {
      return null;
    }

    let depth = 0;
    let close = -1;

    for (
      let index = open;
      index < source.length;
      index += 1
    ) {
      if (source[index] === "<") {
        depth += 1;
      } else if (source[index] === ">") {
        depth -= 1;

        if (depth === 0) {
          close = index;
          break;
        }
      }
    }

    if (close < 0) {
      return null;
    }

    return {
      head: source.slice(0, open),
      arguments:
        splitCatalogGenericArguments(
          source.slice(open + 1, close)
        ),
      suffix: source.slice(close + 1)
    };
  }

  const CATALOG_TYPE_BY_NAME =
    new Map(
      CATALOG_TYPES
        .filter(type =>
          typeof type.fullName === "string"
        )
        .map(type => [
          normalizedCatalogTypeName(
            type.fullName
          ),
          type
        ])
    );

  function normalizedCatalogTypeName(value) {
    return String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, "")
      .replace(/&$/, "");
  }

  function normalizedCatalogCsType(value) {
    let type = String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/&$/, "");

    if (
      type.startsWith("System.Nullable<") &&
      type.endsWith(">")
    ) {
      type = type.slice(
        "System.Nullable<".length,
        -1
      );
    }

    return type;
  }

  function catalogGraphType(value) {
    const type =
      normalizedCatalogCsType(value);
    const direct = new Map([
      ["System.Boolean", "bool"],
      ["bool", "bool"],
      ["System.String", "string"],
      ["string", "string"],
      ["System.Uri", window.RMLI18n.t("ui.literal.7784ac6f7e85")],
      ["System.Int32", "int"],
      ["int", "int"],
      ["System.Single", "float"],
      ["float", "float"],
      ["System.Double", "double"],
      ["double", "double"],
      ["System.Byte[]", "byteArray"],
      ["byte[]", "byteArray"],
      ["System.String[]", "stringArray"],
      ["string[]", "stringArray"],
      ["System.Object[]", "objectArray"],
      ["object[]", "objectArray"],
      ["System.Type", "type"],
      ["System.Exception", "exception"],
      ["System.Threading.CancellationToken", "cancellationToken"],
      ["Elements.Core.int2", "int2"],
      ["Elements.Core.int3", "int3"],
      ["Elements.Core.int4", "int4"],
      ["Elements.Core.float2", "float2"],
      ["Elements.Core.float3", "float3"],
      ["Elements.Core.float4", "float4"],
      ["Elements.Core.double2", "double2"],
      ["Elements.Core.double3", "double3"],
      ["Elements.Core.double4", "double4"],
      ["Elements.Core.colorX", "colorX"],
      ["Elements.Core.floatQ", "floatQ"],
      ["FrooxEngine.Primitive", "primitive"],
      ["FrooxEngine.BlendMode", "blendMode"],
      [window.RMLI18n.t("ui.literal.d697178425b0"), "textureWrapMode"],
      ["FrooxEngine.Engine", "engine"],
      ["FrooxEngine.World", "world"],
      ["FrooxEngine.User", "user"],
      ["FrooxEngine.Slot", "slot"],
      ["FrooxEngine.Component", "component"],
      ["FrooxEngine.MeshRenderer", "meshRenderer"],
      ["FrooxEngine.Collider", "collider"],
      ["FrooxEngine.MeshCollider", "meshCollider"],
      ["FrooxEngine.BoxCollider", "boxCollider"],
      ["FrooxEngine.SphereCollider", "sphereCollider"],
      ["FrooxEngine.CylinderCollider", "cylinderCollider"],
      ["FrooxEngine.PBS_Metallic", "pbsMetallic"],
      ["FrooxEngine.PBS_Specular", "pbsSpecular"],
      ["FrooxEngine.UnlitMaterial", "unlitMaterial"],
      ["FrooxEngine.ICommonMaterial", "commonMaterial"],
      ["FrooxEngine.IAssetProvider<FrooxEngine.Material>", "material"],
      ["FrooxEngine.IAssetProvider<FrooxEngine.Mesh>", "mesh"],
      ["FrooxEngine.IAssetProvider<FrooxEngine.ITexture2D>", "texture"],
      ["FrooxEngine.IAssetProvider<FrooxEngine.AudioClip>", "audioClip"]
    ]);

    if (direct.has(type)) {
      return direct.get(type);
    }

    if (
      /^FrooxEngine\.IAssetProvider<.*Material>$/.test(type)
    ) {
      return "material";
    }

    if (
      /^FrooxEngine\.IAssetProvider<.*Mesh>$/.test(type)
    ) {
      return "mesh";
    }

    const catalogType =
      CATALOG_TYPE_BY_NAME.get(type);

    if (
      catalogType?.isMaterial === true ||
      catalogType?.isCommonMaterial === true
    ) {
      return graphMaterialType(type);
    }

    if (catalogType?.isMeshProvider === true) {
      return graphMeshType(type);
    }

    if (catalogType?.isCollider === true) {
      return "collider";
    }

    if (catalogType?.isComponent === true) {
      return "component";
    }

    if (
      catalogType?.kind === "enum" ||
      CATALOG_ENUM_BY_NAME.has(type)
    ) {
      return catalogEnumGraphType(type);
    }

    return null;
  }

  registerNode("constant.uri", {
    title: window.RMLI18n.t("ui.auto.42145f7721f0"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "URI",
    description:
      window.RMLI18n.t("ui.auto.c182f191e6fc"),
    parameterKind: "string",
    outputs: [port("value", window.RMLI18n.t("ui.auto.7b7dd4fb8a81"), "Uri")],
    codegenExpression(api) {
      return `new Uri(${quote(api, api.node.parameters.value)}, UriKind.RelativeOrAbsolute)`;
    },
    previewEvaluate({ node, known }) {
      return known(
        window.RMLI18n.t("ui.literal.7784ac6f7e85"),
        String(node.parameters?.value || "")
      );
    }
  });

  registerNode("constant.nullObject", {
    title: window.RMLI18n.t("ui.auto.e078b36f10bb"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "∅",
    description:
      window.RMLI18n.t("ui.auto.e83035d9b11b"),
    outputs: [port("value", window.RMLI18n.t("ui.auto.b8d321e653c6"), "object")],
    codegenExpression() {
      return "null!";
    },
    previewEvaluate({ known }) {
      return known("object", null);
    }
  });

  registerNode("constant.stringArray", {
    title: window.RMLI18n.t("ui.auto.9c36affd4dd0"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "T[]",
    description:
      window.RMLI18n.t("ui.auto.63ae9764cebb"),
    parameters: [
      pCode(
        "items",
        window.RMLI18n.t("ui.literal.165a3035d5d1"),
        "System.String\nSystem.Int32",
        window.RMLI18n.t("ui.literal.eed96839135f"),
        5
      )
    ],
    outputs: [port("value", window.RMLI18n.t("ui.auto.cb9729d42e95"), "stringArray")],
    codegenExpression(api) {
      const items = String(
        api.node.parameters.items || ""
      )
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => quote(api, value));
      return `new string[] { ${items.join(", ")} }`;
    }
  });

  registerNode("constant.objectArray", {
    title: window.RMLI18n.t("ui.auto.e3c11623b564"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "OBJ[]",
    description:
      window.RMLI18n.t("ui.auto.c940b8ca7523"),
    inputs: [
      port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "object"),
      port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "object")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "object")
    },
    outputs: [port("value", window.RMLI18n.t("ui.auto.b482cd0622c5"), "objectArray")],
    codegenExpression(api) {
      const count = Math.max(
        2,
        Math.min(64, Number(api.node.parameters?.variadicInputCount) || 2)
      );
      const ids = Array.from({ length: count }, (_, index) =>
        index < 26
          ? String.fromCharCode(97 + index)
          : `input${index + 1}`
      );
      return `new object?[] { ${ids.map(id => api.input(id).code).join(", ")} }`;
    }
  });

  registerNode("constant.vector", {
    title: window.RMLI18n.t("ui.auto.b892e1391e52"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "VEC",
    description:
      window.RMLI18n.t("ui.auto.3e78521f46c5"),
    configurableTypeVar: "T",
    configurableTypes:
      NUMERIC_VECTOR_TYPES,
    defaultType: "auto",
    autoFallbackType: "float3",
    allowAutoType: true,
    typeSelectorLabel: window.RMLI18n.t("ui.literal.ecad07db519b"),
    parameters: [
      pText(
        "components",
        window.RMLI18n.t("ui.literal.9289473eeeda"),
        "0, 0, 0",
        window.RMLI18n.t("ui.literal.7805bed08bfb"),
        { kind: "vector" }
      )
    ],
    outputs: [
      genericPort(
        "value",
        window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
        "T",
        "value"
      )
    ],
    codegenExpression(api) {
      const information =
        numericVectorDescriptor(
          NUMERIC_VECTOR_TYPES.includes(api.type)
            ? api.type
            : api.node
        );
      const parts = String(
        api.node.parameters.components || ""
      )
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      while (parts.length < information.componentCount) {
        parts.push(information.boolean ? "false" : "0");
      }
      return `new ${api.csType(information.type)}(${parts
        .slice(0, information.componentCount)
        .map(value => information.boolean
          ? (String(value).trim().toLowerCase() === "true"
              ? "true"
              : "false")
          : api.numberLiteral(value, information.scalarType))
        .join(", ")})`;
    },
    previewEvaluate({
      node,
      type,
      known,
      unknown
    }) {
      const information =
        numericVectorDescriptor(type);

      if (!information) {
        return unknown(
          type,
          window.RMLI18n.t("ui.literal.3a768fa58588")
        );
      }

      const parsed =
        validateNumericVectorValue(
          node.parameters?.components ||
            (information.boolean
              ? "false, false"
              : "0, 0"),
          information.type,
          { coerce: false }
        );

      if (!parsed.valid) {
        return unknown(type, parsed.reason);
      }

      const values = parsed.components.map(value =>
        information.boolean
          ? value === "true"
          : (graphNumericScalarDescriptor(
                information.scalarType
              )?.integer &&
              ["long", "ulong"].includes(
                graphNumericScalarDescriptor(
                  information.scalarType
                )?.family
              )
              ? value
              : Number(value))
      );

      return known(type, values);
    }
  });

  function numericVectorDescriptor(
    requested
  ) {
    const parameters =
      requested &&
      typeof requested === "object" &&
      !Array.isArray(requested)
        ? requested.parameters || requested
        : null;
    const requestedType = parameters
      ? parameters.valueType === "auto"
        ? parameters.autoVectorType
        : parameters.valueType
      : requested;
    const type =
      NUMERIC_VECTOR_TYPES.includes(
        requestedType
      )
        ? requestedType
        : "float3";
    return (
      graphVectorDescriptor(type) ||
      graphVectorDescriptor("float3")
    );
  }

  function ensureNumericVectorRuntime(
    api
  ) {
    ensureReflectionRuntime(api);
    api.addMember(
      "universal.vector.components",
      globalThis.RMLCodeTemplates.text("nodes", "source_022", [])
    );
  }

  registerNode("vector.compose", {
    title: window.RMLI18n.t("ui.auto.caa00883aad0"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "VEC+",
    description:
      window.RMLI18n.t("ui.auto.9e2d5847e3f9"),
    configurableTypeVar: "T",
    configurableTypes:
      NUMERIC_VECTOR_TYPES,
    defaultType: "auto",
    autoFallbackType: "float3",
    allowAutoType: true,
    typeSelectorLabel: window.RMLI18n.t("ui.literal.ecad07db519b"),
    resolveDefinition(node) {
      const information =
        numericVectorDescriptor(
          node
        );

      return {
        inputs:
          information.componentIds.map(
            id =>
              port(
                id,
                id.toUpperCase(),
                information.scalarType
              )
          ),
        outputs: [
          port(
            "value",
            window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
            information.type
          )
        ]
      };
    },
    codegenExpression(api) {
      const information =
        numericVectorDescriptor(
          api.node
        );

      return `new ${api.csType(information.type)}(${information.componentIds
        .map(id => api.input(id).code)
        .join(", ")})`;
    },
    previewEvaluate({
      node,
      input,
      known,
      unknown
    }) {
      const information =
        numericVectorDescriptor(
          node
        );
      const values = [];

      for (const id of information.componentIds) {
        const current = input(id);

        if (!current.known) {
          return unknown(
            information.type,
            current.reason
          );
        }

        values.push(
          information.boolean
            ? Boolean(current.value)
            : current.value
        );
      }

      return known(
        information.type,
        values
      );
    }
  });

  registerNode("vector.decompose", {
    title: window.RMLI18n.t("ui.auto.2fc90f64013a"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "VEC−",
    description:
      window.RMLI18n.t("ui.auto.974456a5bac1"),
    configurableTypeVar: "T",
    configurableTypes:
      NUMERIC_VECTOR_TYPES,
    defaultType: "auto",
    autoFallbackType: "float3",
    allowAutoType: true,
    typeSelectorLabel: window.RMLI18n.t("ui.literal.ecad07db519b"),
    resolveDefinition(node) {
      const information =
        numericVectorDescriptor(
          node
        );

      return {
        inputs: [
          port(
            "value",
            window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
            information.type
          )
        ],
        outputs:
          information.componentIds.map(
            id =>
              port(
                id,
                id.toUpperCase(),
                information.scalarType
              )
          )
      };
    },
    codegenCollect(api) {
      ensureNumericVectorRuntime(api);
    },
    codegenExpression(api) {
      const information =
        numericVectorDescriptor(
          api.node
        );

      return `ReadNumericComponent<${api.csType(information.scalarType)}>(${api.input("value").code}, "${api.portId}")`;
    },
    previewEvaluate({
      node,
      portId,
      input,
      known,
      unknown
    }) {
      const information =
        numericVectorDescriptor(
          node
        );
      const value = input("value");
      const index =
        information.componentIds.indexOf(
          portId
        );

      if (!value.known) {
        return unknown(
          information.scalarType,
          value.reason
        );
      }

      return known(
        information.scalarType,
        value.value?.[index] ??
          (information.boolean ? false : 0)
      );
    }
  });

  registerNode("flow.sequence", {
    title: window.RMLI18n.t("ui.auto.ec1aaa3bfe1b"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "1→N",
    description:
      window.RMLI18n.t("ui.auto.b4790e8c0cb6"),
    inputs: [port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse")],
    outputs: [
      port("first", window.RMLI18n.t("ui.auto.ee9a66e88d05"), "impulse"),
      port("second", window.RMLI18n.t("ui.auto.93b9e4f9d271"), "impulse")
    ],
    variadicOutputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      template: port("first", window.RMLI18n.t("ui.auto.ee9a66e88d05"), "impulse"),
      ids: ["first", "second", "third", "fourth"],
      labels: [window.RMLI18n.t("ui.auto.ee9a66e88d05"), window.RMLI18n.t("ui.auto.93b9e4f9d271"), window.RMLI18n.t("ui.literal.efb3a3216290"), window.RMLI18n.t("ui.literal.7a3a4a42216f")]
    },
    codegenAction(api) {
      const count = Math.max(
        2,
        Math.min(64, Number(api.node.parameters?.variadicOutputCount) || 2)
      );
      const legacy = ["first", "second", "third", "fourth"];
      const ids = Array.from({ length: count }, (_, index) =>
        legacy[index] || `output${index + 1}`
      );
      return ids
        .map(api.emit)
        .filter(Boolean)
        .map(method => `${method}();`)
        .join("\n");
    }
  });

  registerNode("flow.impulseMerge", {
    title: window.RMLI18n.t("ui.auto.6431e47cb720"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "↯∨",
    description:
      window.RMLI18n.t("ui.auto.de272a0ce004"),
    inputs: [
      port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "impulse"),
      port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "impulse")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "impulse")
    },
    outputs: [port("out", window.RMLI18n.t("ui.auto.549310313b9c"), "impulse")],
    codegenAction(api) {
      const next = api.emit("out");
      return next
        ? `${next}();`
        : "";
    }
  });

  registerNode("flow.branch", {
    title: window.RMLI18n.t("ui.auto.68ea96a3ce98"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "IF",
    description:
      window.RMLI18n.t("ui.auto.29cd30a71a55"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("condition", window.RMLI18n.t("ui.auto.6756b63c2646"), "bool")
    ],
    outputs: [
      port("true", window.RMLI18n.t("ui.auto.2bafb66af5d9"), "impulse"),
      port("false", window.RMLI18n.t("ui.text.97cdbdc7feff"), "impulse")
    ],
    codegenAction(api) {
      const yes = api.emit("true");
      const no = api.emit("false");
      return `if (${api.input("condition").code})\n        {\n            ${yes ? `${yes}();` : generatedGuidance(api, "noTruePath")}\n        }\n        else\n        {\n            ${no ? `${no}();` : generatedGuidance(api, "noFalsePath")}\n        }`;
    }
  });

  function ensureStructuredFlowRuntime(api) {
    api.addMember(
      "universal.flow.control-signals",
      globalThis.RMLCodeTemplates.text("nodes", "source_023", [])
    );
  }

  registerNode("flow.tryCatchFinally", {
    title: window.RMLI18n.t("ui.auto.ca3d4ff841bd"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "TRY",
    description:
      window.RMLI18n.t("ui.auto.5649a5db5c3b"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse")
    ],
    outputs: [
      port("try", window.RMLI18n.t("ui.auto.7a0eef646703"), "impulse"),
      port("catch", window.RMLI18n.t("ui.auto.b7b34a5aaab3"), "impulse"),
      port("finally", window.RMLI18n.t("ui.auto.19d2c63707cf"), "impulse"),
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse"),
      port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
    ],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
      if (
        generatedActionOutputIsUsed(
          api,
          "exception"
        )
      ) {
        addStatefulField(
          api,
          "caughtException",
          window.RMLI18n.t("ui.literal.6c6c874d2c2e"),
          "null"
        );
      }
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_caughtException${nodeToken(api)}!`
      );
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const field = `_caughtException${token}`;
      const tryBranch =
        api.inlineMethod(api.node.id, "try");
      const catchBranch =
        api.inlineMethod(api.node.id, "catch");
      const finallyBranch =
        api.inlineMethod(api.node.id, "finally");
      const completed =
        api.emit("completed");
      const keepException =
        generatedActionOutputIsUsed(
          api,
          "exception"
        );
      const resetException = keepException
        ? `${field} = null;\n        `
        : "";
      const exceptionCatch = keepException
        ? "catch (Exception exception)"
        : "catch (Exception)";
      const storeException = keepException
        ? `${field} = exception;`
        : "";

      return `${resetException}try\n        {${tryBranch ? `\n            ${tryBranch}();` : ""}\n        }\n        catch (GraphBreakSignal)\n        {\n            throw;\n        }\n        catch (GraphContinueSignal)\n        {\n            throw;\n        }\n        catch (GraphReturnSignal)\n        {\n            throw;\n        }\n        ${exceptionCatch}\n        {${storeException ? `\n            ${storeException}` : ""}${catchBranch ? `\n            ${catchBranch}();` : ""}\n        }\n        finally\n        {${finallyBranch ? `\n            ${finallyBranch}();` : ""}\n        }${completed ? `\n        ${completed}();` : ""}`;
    }
  });

  registerNode("flow.whileLoop", {
    title: window.RMLI18n.t("ui.auto.4f7c33ad37a6"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "WHILE",
    description:
      window.RMLI18n.t("ui.auto.7b5d1aafb833"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("condition", window.RMLI18n.t("ui.auto.6756b63c2646"), "bool"),
      port("maximumIterations", window.RMLI18n.t("ui.auto.a1051b76282f"), "int", {
        defaultCs: "1000000"
      })
    ],
    outputs: [
      port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"),
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse")
    ],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
    },
    codegenAction(api) {
      const body =
        api.inlineMethod(api.node.id, "body");
      const completed = api.emit("completed");
      const token = nodeToken(api);
      const count = `_whileCount${token}`;
      const maximum = `_whileMaximum${token}`;
      return `int ${count} = 0;\n        int ${maximum} = Math.Max(0, ${api.input("maximumIterations").code});\n        while (${api.input("condition").code})\n        {\n            if (${maximum} > 0 && ${count}++ >= ${maximum})\n            {\n                throw new InvalidOperationException(window.RMLI18n.t("ui.literal.75591e268bf9"));\n            }\n\n            try\n            {${body ? `\n                ${body}();` : ""}\n            }\n            catch (GraphContinueSignal)\n            {\n                continue;\n            }\n            catch (GraphBreakSignal)\n            {\n                break;\n            }\n        }${completed ? `\n        ${completed}();` : ""}`;
    }
  });

  registerNode("flow.doWhileLoop", {
    title: window.RMLI18n.t("ui.auto.bd5206d3f084"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "DO",
    description:
      window.RMLI18n.t("ui.auto.7dce3b1add5e"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("condition", window.RMLI18n.t("ui.auto.6756b63c2646"), "bool"),
      port("maximumIterations", window.RMLI18n.t("ui.auto.a1051b76282f"), "int", {
        defaultCs: "1000000"
      })
    ],
    outputs: [
      port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"),
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse")
    ],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
    },
    codegenAction(api) {
      const body =
        api.inlineMethod(api.node.id, "body");
      const completed = api.emit("completed");
      const token = nodeToken(api);
      const count = `_doCount${token}`;
      const maximum = `_doMaximum${token}`;
      return `int ${count} = 0;\n        int ${maximum} = Math.Max(0, ${api.input("maximumIterations").code});\n        do\n        {\n            if (${maximum} > 0 && ${count}++ >= ${maximum})\n            {\n                throw new InvalidOperationException(window.RMLI18n.t("ui.literal.43755826e244"));\n            }\n\n            try\n            {${body ? `\n                ${body}();` : ""}\n            }\n            catch (GraphContinueSignal)\n            {\n            }\n            catch (GraphBreakSignal)\n            {\n                break;\n            }\n        }\n        while (${api.input("condition").code});${completed ? `\n        ${completed}();` : ""}`;
    }
  });

  registerNode("flow.break", {
    title: window.RMLI18n.t("ui.auto.3e3bb518da4d"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "BREAK",
    description:
      window.RMLI18n.t("ui.auto.ccabfc5a1bf7"),
    inputs: [port("call", window.RMLI18n.t("ui.auto.3e3bb518da4d"), "impulse")],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
    },
    codegenAction() {
      return "throw new GraphBreakSignal();";
    }
  });

  registerNode("flow.continue", {
    title: window.RMLI18n.t("index.text.9d9b264625a1"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "CONT",
    description:
      window.RMLI18n.t("ui.auto.8f1d18f3148f"),
    inputs: [port("call", window.RMLI18n.t("index.text.9d9b264625a1"), "impulse")],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
    },
    codegenAction() {
      return "throw new GraphContinueSignal();";
    }
  });

  registerNode("flow.lock", {
    title: window.RMLI18n.t("ui.auto.b057d11887e4"),
    group: window.RMLI18n.t("ui.literal.6aa5e4a6e67c"),
    symbol: "LOCK",
    description:
      window.RMLI18n.t("ui.auto.ef273ad1a4f9"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("syncRoot", window.RMLI18n.t("ui.auto.aae4a296e882"), "object")
    ],
    outputs: [
      port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"),
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse")
    ],
    codegenAction(api) {
      const body =
        api.inlineMethod(api.node.id, "body");
      const completed = api.emit("completed");
      return `lock (${api.input("syncRoot").code} ?? throw new ArgumentNullException("syncRoot"))\n        {${body ? `\n            ${body}();` : ""}\n        }${completed ? `\n        ${completed}();` : ""}`;
    }
  });

  registerNode("flow.using", {
    title: window.RMLI18n.t("ui.auto.896302de8d7d"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "USING",
    description:
      window.RMLI18n.t("ui.auto.6a89f55b9b8e"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("resource", window.RMLI18n.t("ui.auto.c49701255529"), "object")
    ],
    outputs: [
      port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"),
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse")
    ],
    codegenAction(api) {
      const body =
        api.inlineMethod(api.node.id, "body");
      const completed = api.emit("completed");
      const token = nodeToken(api);
      const resource = `_usingResource${token}`;
      return `IDisposable? ${resource} = ${api.input("resource").code} as IDisposable;\n        try\n        {${body ? `\n            ${body}();` : ""}\n        }\n        finally\n        {\n            ${resource}?.Dispose();\n        }${completed ? `\n        ${completed}();` : ""}`;
    }
  });

  function graphUserMethodEntries(api, requestedName) {
    const name = String(requestedName || "").trim();
    return (api.graph?.nodes || []).filter(node =>
      node?.operatorId === "language.methodEntry" &&
      String(node?.parameters?.methodName || "").trim() === name
    );
  }

  function visualMethodSignature(node) {
    const visualParameters = Array.isArray(node?.parameters?.functionParameters)
      ? node.parameters.functionParameters
      : null;
    const parameters = [];
    const used = new Set();
    if (visualParameters) {
      for (let index = 0; index < visualParameters.length; index += 1) {
        const item = visualParameters[index] || {};
        const rawName = String(item.name || `arg${index + 1}`).trim();
        const name = /^[A-Za-z_][A-Za-z0-9_]*$/.test(rawName) ? rawName : `arg${index + 1}`;
        const rawType = String(item.type || "object").trim() || "object";
        const graphType = visualMethodGraphType(rawType);
        let id = String(item.id || `arg-${index + 1}`).trim() || `arg-${index + 1}`;
        while (used.has(id)) id = `${id}-2`;
        used.add(id);
        parameters.push({ id, name, sourceType: rawType, graphType });
      }
    } else {
      const lines = String(node?.parameters?.signature || "").split(/\\r?\\n/).map(value => value.trim()).filter(Boolean);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        const separator = line.indexOf(":");
        const rawName = separator >= 0 ? line.slice(0, separator).trim() : `arg${index + 1}`;
        const rawType = separator >= 0 ? line.slice(separator + 1).trim() : line;
        const name = /^[A-Za-z_][A-Za-z0-9_]*$/.test(rawName) ? rawName : `arg${index + 1}`;
        const graphType = visualMethodGraphType(rawType || "System.Object");
        let id = `arg-${name}`; let suffix = 2;
        while (used.has(id)) id = `arg-${name}-${suffix++}`;
        used.add(id);
        parameters.push({ id, name, sourceType: rawType || "System.Object", graphType });
      }
    }
    const rawReturn = String(node?.parameters?.returnGraphType ?? node?.parameters?.returnType ?? "void").trim();
    const isVoid = !rawReturn || rawReturn.toLowerCase() === "void" || rawReturn === "System.Void";
    return { parameters, isVoid, returnGraphType: isVoid ? null : visualMethodGraphType(rawReturn) };
  }

  function visualMethodGraphType(value) {
    const canonical = registry.canonicalType(
      String(value || "System.Object").trim() ||
      "System.Object"
    );
    return registry.getTypeDefinitions()?.[canonical]
      ? canonical
      : ensureNormalExactGraphType(value);
  }

  function visualMethodSignatureKey(signature) {
    return JSON.stringify({ parameters: signature.parameters.map(parameter => [parameter.name, parameter.graphType]), returnType: signature.isVoid ? "void" : signature.returnGraphType });
  }

  function visualMethodParameters(call = false) {
    if (call) {
      return [{
        key: "methodName",
        label: window.RMLI18n.t("ui.auto.060d61447a76"),
        kind: "visualFunctionMethod",
        default: window.RMLI18n.t("ui.auto.138927ca2c78"),
        help: window.RMLI18n.t("ui.literal.1fff36e957fd"),
        affectsPorts: true,
        affectsNode: true,
        commitImmediately: true
      }];
    }
    return [
      pText("methodName", window.RMLI18n.t("ui.auto.060d61447a76"), window.RMLI18n.t("ui.auto.138927ca2c78"), window.RMLI18n.t("ui.literal.1fff36e957fd"), { affectsNode: true, commitImmediately: true }),
      { key: "functionParameters", label: window.RMLI18n.t("ui.visualFunctions.parameters"), kind: "visualFunctionParameters", default: [], help: window.RMLI18n.t("ui.visualFunctions.signatureHelp"), affectsPorts: true, affectsNode: true, commitImmediately: true },
      { key: "returnGraphType", label: window.RMLI18n.t("ui.visualFunctions.returnType"), kind: "visualFunctionReturnType", default: "void", help: window.RMLI18n.t("ui.visualFunctions.returnHelp"), affectsPorts: true, affectsNode: true, commitImmediately: true }
    ];
  }

  function ensureGraphUserMethodRuntime(api) {
    ensureReflectionRuntime(api); ensureStructuredFlowRuntime(api);
    api.addUsing("System.Threading"); api.addUsing("System.Collections.Generic");
    api.addMember("universal.language.method-runtime", globalThis.RMLCodeTemplates.text("nodes", window.RMLI18n.t("ui.literal.94b9505a4f7b"), []));
  }

  registerNode("language.methodEntry", {
    expertOnly: false, title: window.RMLI18n.t("ui.auto.8be668e1cd7d"), group: window.RMLI18n.t("ui.visualFunctions.group"), symbol: "ƒ",
    description: window.RMLI18n.t("ui.visualFunctions.entryDescription"),
    parameters: visualMethodParameters(), outputs: [port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse")],
    resolveDefinition(node) {
      const signature = visualMethodSignature(node);
      return { title: `Visual Function · ${String(node?.parameters?.methodName || "Method").trim() || "Method"}`, outputs: [port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"), ...signature.parameters.map(parameter => port(parameter.id, parameter.name, parameter.graphType))] };
    },
    codegenCollect(api) {
      ensureGraphUserMethodRuntime(api);
      const methodName = String(api.node.parameters?.methodName || window.RMLI18n.t("ui.auto.138927ca2c78")).trim();
      const matches = graphUserMethodEntries(api, methodName);
      if (matches.length !== 1) { api.diagnostic(`Visual function '${methodName}' must be declared exactly once; found ${matches.length}.`); return; }
      const token = nodeToken(api); const body = api.inlineMethod(api.node.id, "body");
      api.addMember(`${api.node.id}.visual-method`, globalThis.RMLCodeTemplates.text("nodes", "source_024", [token, body ? `\\n        ${body}();` : ""]));
    },
    codegenExpression(api) {
      const signature = visualMethodSignature(api.node);
      const index = signature.parameters.findIndex(parameter => parameter.id === api.portId);
      if (index >= 0) { const parameter = signature.parameters[index]; return `GraphUserMethodArgument<${api.csType(parameter.graphType)}>(${index})`; }
      return "CurrentGraphUserMethodFrame().Arguments";
    }
  });

  registerNode("language.methodArgument", {
    expertOnly: true, hiddenFromPalette: true, title: window.RMLI18n.t("ui.auto.2887ef76258d"), group: window.RMLI18n.t("ui.visualFunctions.legacyGroup"), symbol: "ARG",
    description: window.RMLI18n.t("ui.auto.88a807234532"), configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(type => !["patchContext", "cancellationToken"].includes(type)), defaultType: "object",
    inputs: [port("index", window.RMLI18n.t("ui.auto.3909ec65b935"), "int")], outputs: [genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "anyValue")],
    codegenCollect(api) { ensureGraphUserMethodRuntime(api); },
    codegenExpression(api) { const type = api.node.parameters?.valueType || "object"; return `GraphUserMethodArgument<${api.csType(type)}>(${api.input("index").code})`; }
  });

  function visualMethodReturnParameters() {
    return visualMethodParameters(true);
  }

  registerNode("language.methodReturn", {
    expertOnly: false, title: window.RMLI18n.t("ui.auto.8c89c1dbebb7"), group: window.RMLI18n.t("ui.visualFunctions.group"), symbol: "RETURN", description: window.RMLI18n.t("ui.auto.7ab3588d40b6"),
    parameters: visualMethodReturnParameters(),
    inputs: [port("call", window.RMLI18n.t("ui.auto.41a300724d29"), "impulse")],
    resolveDefinition(node) {
      const signature = visualMethodSignature(node);
      return {
        title: `Return · ${String(node?.parameters?.methodName || "Method").trim() || "Method"}`,
        inputs: [
          port("call", window.RMLI18n.t("ui.auto.41a300724d29"), "impulse"),
          ...(signature.isVoid ? [] : [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), signature.returnGraphType)])
        ]
      };
    },
    codegenCollect(api) { ensureGraphUserMethodRuntime(api); },
    codegenAction(api) {
      const methodName = String(api.node.parameters?.methodName || "").trim();
      const matches = graphUserMethodEntries(api, methodName);
      if (matches.length !== 1) { api.diagnostic(`Return Visual Function '${methodName}' requires exactly one declaration; found ${matches.length}.`); return ""; }
      const signature = visualMethodSignature(matches[0]);
      if (signature.isVoid) return "throw new GraphReturnSignal();";
      return `CurrentGraphUserMethodFrame().Result = ${api.input("value").code};\n        throw new GraphReturnSignal();`;
    }
  });

  registerNode("language.methodReturnVoid", {
    expertOnly: true, hiddenFromPalette: true, title: window.RMLI18n.t("ui.auto.1bbd5fae7785"), group: window.RMLI18n.t("ui.visualFunctions.legacyGroup"), symbol: "RETURN", description: window.RMLI18n.t("ui.auto.150c3517aca5"),
    parameters: visualMethodReturnParameters(), inputs: [port("call", window.RMLI18n.t("ui.auto.41a300724d29"), "impulse")],
    resolveDefinition(node) { return { title: `Return · ${String(node?.parameters?.methodName || "Method").trim() || "Method"}` }; },
    codegenCollect(api) { ensureGraphUserMethodRuntime(api); },
    codegenAction(api) {
      const methodName = String(api.node.parameters?.methodName || "").trim();
      const matches = graphUserMethodEntries(api, methodName);
      if (matches.length !== 1) { api.diagnostic(`Return Visual Function '${methodName}' requires exactly one declaration; found ${matches.length}.`); return ""; }
      if (!visualMethodSignature(matches[0]).isVoid) { api.diagnostic(`Legacy void return '${methodName}' cannot target a function with a value return type.`); return ""; }
      return "throw new GraphReturnSignal();";
    }
  });

  registerNode("language.callMethod", {
    expertOnly: false, title: window.RMLI18n.t("ui.auto.3cdaf43bb634"), group: window.RMLI18n.t("ui.visualFunctions.group"), symbol: "CALL",
    description: window.RMLI18n.t("ui.visualFunctions.callDescription"),
    parameters: visualMethodParameters(true), inputs: [port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse")],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"), port("faulted", window.RMLI18n.t("ui.auto.d48b9bb3f79e"), "impulse"), port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"), port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")],
    resolveDefinition(node) {
      const signature = visualMethodSignature(node);
      return {
        title: `Call · ${String(node?.parameters?.methodName || "Method").trim() || "Method"}`,
        inputs: [port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"), ...signature.parameters.map(parameter => port(parameter.id, parameter.name, parameter.graphType))],
        outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"), port("faulted", window.RMLI18n.t("ui.auto.d48b9bb3f79e"), "impulse"), ...(signature.isVoid ? [] : [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), signature.returnGraphType)]), port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"), port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")]
      };
    },
    codegenCollect(api) {
      ensureGraphUserMethodRuntime(api); const signature = visualMethodSignature(api.node);
      if (!signature.isVoid && generatedActionOutputIsUsed(api, "result")) addStatefulField(api, "visualMethodResult", api.csType(signature.returnGraphType), api.csDefault(signature.returnGraphType));
      if (generatedActionOutputIsUsed(api, "success")) addStatefulField(api, "visualMethodSuccess", "bool", "false");
      if (generatedActionOutputIsUsed(api, "exception")) addStatefulField(api, "visualMethodException", window.RMLI18n.t("ui.literal.6c6c874d2c2e"), "null");
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      if (api.portId === "success") return generatedActionOutputExpression(api, `_visualMethodSuccess${token}`);
      if (api.portId === "exception") return generatedActionOutputExpression(api, `_visualMethodException${token}!`);
      return generatedActionOutputExpression(api, `_visualMethodResult${token}`);
    },
    codegenAction(api) {
      const methodName = String(api.node.parameters?.methodName || window.RMLI18n.t("ui.auto.138927ca2c78")).trim();
      const matches = graphUserMethodEntries(api, methodName);
      if (matches.length !== 1) { api.diagnostic(`Call Visual Function '${methodName}' requires exactly one declaration; found ${matches.length}.`); return ""; }
      const callSignature = visualMethodSignature(api.node); const declarationSignature = visualMethodSignature(matches[0]);
      if (visualMethodSignatureKey(callSignature) !== visualMethodSignatureKey(declarationSignature)) { api.diagnostic(`Call Visual Function '${methodName}' signature does not match its declaration.`); return ""; }
      const methodToken = api.token(matches[0].id); const token = nodeToken(api);
      const result = `_visualMethodResult${token}`; const success = `_visualMethodSuccess${token}`; const exception = `_visualMethodException${token}`;
      const done = api.emit("done"); const faulted = api.emit("faulted");
      const keepResult = !callSignature.isVoid && generatedActionOutputIsUsed(api, "result");
      const keepSuccess = generatedActionOutputIsUsed(api, "success"); const keepException = generatedActionOutputIsUsed(api, "exception");
      const argumentsCode = `new object?[] { ${callSignature.parameters.map(parameter => api.input(parameter.id).code).join(", ")} }`;
      const rawCall = `UserMethod${methodToken}(${argumentsCode})`;
      const call = callSignature.isVoid ? rawCall : `ConvertGraphValue<${api.csType(callSignature.returnGraphType)}>(${rawCall})`;
      const successLines = [keepException ? `${exception} = null;` : "", keepResult ? `${result} = ${call};` : `_ = ${call};`, keepSuccess ? `${success} = true;` : ""].filter(Boolean).join("\\n            ");
      const failureLines = [keepException ? `${exception} = caught;` : "", keepSuccess ? `${success} = false;` : ""].filter(Boolean).join("\\n            ");
      const catchClause = keepException ? "catch (Exception caught)" : "catch (Exception)";
      return `try\\n        {\\n            ${successLines}${done ? `\\n            ${done}();` : ""}\\n        }\\n        ${catchClause}\\n        {${failureLines ? `\\n            ${failureLines}` : ""}${faulted ? `\\n            ${faulted}();` : ""}\\n        }`;
    }
  });

  registerNode("language.lambdaAction", {
    title: window.RMLI18n.t("ui.auto.f42e98c6ee24"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "CB",
    description:
      window.RMLI18n.t("ui.auto.0dbd55fc77e5"),
    outputs: [
      port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"),
      port("action", window.RMLI18n.t("ui.auto.c3c93182883a"), "action")
    ],
    codegenExpression(api) {
      const body =
        api.inlineMethod(api.node.id, "body");
      return body
        ? `new System.Action(${body})`
        : "new System.Action(delegate { })";
    }
  });

  registerNode("language.invokeAction", {
    title: window.RMLI18n.t("ui.auto.53d275566329"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "RUN CB",
    description:
      window.RMLI18n.t("ui.auto.1f2d9ae1458a"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("action", window.RMLI18n.t("ui.auto.c3c93182883a"), "action")
    ],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("action").code}?.Invoke();${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("flow.gate", {
    title: window.RMLI18n.t("ui.auto.e59cdbaed539"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "GATE",
    description:
      window.RMLI18n.t("ui.auto.1f633955b945"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("open", window.RMLI18n.t("ui.auto.9f9d781861bc"), "bool")
    ],
    outputs: [port("passed", window.RMLI18n.t("ui.auto.a7a08b6b06b7"), "impulse")],
    codegenAction(api) {
      const next = api.emit("passed");
      return next
        ? `if (${api.input("open").code})\n        {\n            ${next}();\n        }`
        : "";
    }
  });

  registerNode("flow.once", {
    title: window.RMLI18n.t("ui.auto.7abb81074c01"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "1×",
    description:
      window.RMLI18n.t("ui.auto.62c8501aa32a"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("reset", window.RMLI18n.t("ui.auto.37d17c56d708"), "impulse")
    ],
    outputs: [port("passed", window.RMLI18n.t("ui.auto.a7a08b6b06b7"), "impulse")],
    codegenCollect(api) {
      addStatefulField(
        api,
        "once",
        "bool",
        "false"
      );
    },
    codegenAction(api) {
      const field = `_${"once"}${nodeToken(api)}`;
      if (api.connection.toPort === "reset") {
        return `${field} = false;`;
      }
      const next = api.emit("passed");
      return `if (!${field})\n        {\n            ${field} = true;${next ? `\n            ${next}();` : ""}\n        }`;
    }
  });

  registerNode("flow.counter", {
    title: window.RMLI18n.t("ui.auto.9ee9adbb4442"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "#",
    description:
      window.RMLI18n.t("ui.auto.6702fcd12d80"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("reset", window.RMLI18n.t("ui.auto.37d17c56d708"), "impulse")
    ],
    outputs: [
      port("changed", window.RMLI18n.t("ui.auto.a1009bcfc203"), "impulse"),
      port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
    ],
    codegenCollect(api) {
      if (
        generatedActionOutputIsUsed(
          api,
          "count"
        )
      ) {
        addStatefulField(
          api,
          "counter",
          "int",
          "0"
        );
      }
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_counter${nodeToken(api)}`
      );
    },
    codegenAction(api) {
      const field = `_counter${nodeToken(api)}`;
      const next = api.emit("changed");
      const keepCount =
        generatedActionOutputIsUsed(
          api,
          "count"
        );
      const operation = keepCount
        ? api.connection.toPort === "reset"
          ? `${field} = 0;`
          : `${field}++;`
        : "";
      return `${operation}${next ? `\n        ${next}();` : ""}`;
    }
  });

  registerNode("flow.forLoop", {
    title: window.RMLI18n.t("ui.auto.769b9c16adf3"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "FOR",
    description:
      window.RMLI18n.t("ui.auto.4879453aaba8"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
    ],
    outputs: [
      port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"),
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse"),
      port("index", window.RMLI18n.t("ui.auto.3909ec65b935"), "int")
    ],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
      if (
        generatedActionOutputIsUsed(
          api,
          "index"
        )
      ) {
        addStatefulField(
          api,
          "loopIndex",
          "int",
          "0"
        );
      }
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_loopIndex${nodeToken(api)}`
      );
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const field = `_loopIndex${token}`;
      const keepIndex =
        generatedActionOutputIsUsed(
          api,
          "index"
        );
      const declaration = keepIndex
        ? ""
        : "int ";
      const body =
        api.inlineMethod(api.node.id, "body");
      const done = api.emit("completed");
      return `for (${declaration}${field} = 0; ${field} < Math.Max(0, ${api.input("count").code}); ${field}++)\n        {\n            try\n            {\n                ${body ? `${body}();` : generatedGuidance(api, "noBodyPath")}\n            }\n            catch (GraphContinueSignal)\n            {\n                continue;\n            }\n            catch (GraphBreakSignal)\n            {\n                break;\n            }\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("flow.forEach", {
    title: window.RMLI18n.t("ui.auto.062195eba4cc"),
    group: window.RMLI18n.t("ui.literal.4bbb632f02fd"),
    symbol: "∀",
    description:
      window.RMLI18n.t("ui.auto.b9e35a637192"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      genericPort(
        "collection",
        window.RMLI18n.t("ui.auto.09e5b7facc8d"),
        "TCollection",
        "enumerable"
      )
    ],
    outputs: [
      port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"),
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse"),
      genericPort(
        "item",
        window.RMLI18n.t("ui.auto.be2f2387e7ac"),
        "TItem",
        "value"
      ),
      port("index", window.RMLI18n.t("ui.auto.3909ec65b935"), "int")
    ],
    genericRelations: [
      {
        kind: "enumerableElement",
        collectionTypeVar: window.RMLI18n.t("ui.literal.3ab947cf02f2"),
        elementTypeVar: window.RMLI18n.t("ui.literal.786ef3089c72")
      }
    ],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
      const itemSpec =
        api.definition.outputs.find(
          specification =>
            specification.id === "item"
        );
      const itemType =
        api.resolvedType(
          api.node,
          itemSpec
        ) || "object";
      if (
        generatedActionOutputIsUsed(
          api,
          "item"
        )
      ) {
        addStatefulField(
          api,
          "forEachItem",
          api.csType(itemType),
          api.csDefault(itemType)
        );
      }
      if (
        generatedActionOutputIsUsed(
          api,
          "index"
        )
      ) {
        addStatefulField(
          api,
          "forEachIndex",
          "int",
          "0"
        );
      }

      api.addUsing("System.Collections");
      api.addMember(
        "collection.foreach.runtime",
        globalThis.RMLCodeTemplates.text("nodes", window.RMLI18n.t("ui.literal.646cbe41a249"), [])
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      const output = String(
        api.portId ||
        api.outputPortId ||
        ""
      );

      return generatedActionOutputExpression(
        api,
        output === "index"
          ? `_forEachIndex${token}`
          : `_forEachItem${token}`
      );
    },
    codegenAction(api) {
      const itemSpec =
        api.definition.outputs.find(
          specification =>
            specification.id === "item"
        );
      const itemType =
        api.resolvedType(
          api.node,
          itemSpec
        ) || "object";
      const itemCsType =
        api.csType(itemType);
      const token = nodeToken(api);
      const itemField =
        `_forEachItem${token}`;
      const indexField =
        `_forEachIndex${token}`;
      const rawItem =
        `_forEachRaw${token}`;
      const body =
        api.inlineMethod(api.node.id, "body");
      const completed =
        api.emit("completed");
      const keepItem =
        generatedActionOutputIsUsed(
          api,
          "item"
        );
      const keepIndex =
        generatedActionOutputIsUsed(
          api,
          "index"
        );
      const initializeIndex = keepIndex
        ? `${indexField} = 0;\n`
        : "";
      const assignItem = keepItem
        ? `${itemField} = GraphCollectionItem<${itemCsType}>(${rawItem});`
        : `_ = GraphCollectionItem<${itemCsType}>(${rawItem});`;
      const incrementIndex = keepIndex
        ? `\n                ${indexField}++;`
        : "";
      const incrementAfterBody = keepIndex
        ? `\n            ${indexField}++;`
        : "";

      return `${initializeIndex}foreach (object? ${rawItem} in GraphEnumerateCollection(${api.input("collection").code}))\n        {\n            ${assignItem}\n            try\n            {\n                ${body ? `${body}();` : generatedGuidance(api, "noBodyPath")}\n            }\n            catch (GraphContinueSignal)\n            {${incrementIndex}\n                continue;\n            }\n            catch (GraphBreakSignal)\n            {\n                break;\n            }${incrementAfterBody}\n        }${completed ? `\n        ${completed}();` : ""}`;
    },
    previewEvaluate({
      portId,
      type,
      unknown
    }) {
      return unknown(
        type,
        portId === "index"
          ? window.RMLI18n.t("ui.literal.f6f25f9908f9")
          : window.RMLI18n.t("ui.literal.531c190da168")
      );
    }
  });

  registerNode("collection.getItemAtIndex", {
    title: window.RMLI18n.t("ui.auto.75ccf5afadb8"),
    group: window.RMLI18n.t("ui.literal.4bbb632f02fd"),
    symbol: "[i]",
    description:
      window.RMLI18n.t("ui.auto.93116669c375"),
    inputs: [
      genericPort(
        "collection",
        window.RMLI18n.t("ui.auto.09e5b7facc8d"),
        "TCollection",
        "enumerable"
      ),
      port("index", window.RMLI18n.t("ui.auto.3909ec65b935"), "int")
    ],
    outputs: [
      genericPort(
        "item",
        window.RMLI18n.t("ui.auto.be2f2387e7ac"),
        "TItem",
        "value"
      ),
      port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
      port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
    ],
    genericRelations: [
      {
        kind: "enumerableElement",
        collectionTypeVar:
          window.RMLI18n.t("ui.literal.3ab947cf02f2"),
        elementTypeVar: window.RMLI18n.t("ui.literal.786ef3089c72"),
        exact: true
      }
    ],
    codegenCollect(api) {
      api.addUsing("System.Collections");
      api.addUsing("System.Collections.Generic");
      api.addMember(
        "collection.item-at-index.runtime",
        globalThis.RMLCodeTemplates.text("nodes", window.RMLI18n.t("ui.literal.6422d2d01f1c"), [])
      );
    },
    codegenExpression(api) {
      const itemSpec =
        api.definition.outputs.find(
          specification =>
            specification.id === "item"
        );
      const itemType =
        api.resolvedType(
          api.node,
          itemSpec
        ) || "object";
      const itemCsType =
        api.csType(itemType);
      const collection =
        api.input("collection").code;
      const index =
        api.input("index").code;

      if (api.portId === "success") {
        return `GraphCollectionHasIndex(${collection}, ${index})`;
      }

      if (api.portId === "count") {
        return `GraphCollectionCount(${collection})`;
      }

      return `GraphCollectionItemAt<${itemCsType}>(${collection}, ${index})`;
    },
    previewEvaluate({
      portId,
      type,
      unknown
    }) {
      return unknown(
        type,
        portId === "success"
          ? window.RMLI18n.t("ui.literal.0ae6bb8eada3")
          : portId === "count"
            ? window.RMLI18n.t("ui.literal.cb8422589926")
            : window.RMLI18n.t("ui.literal.79b49a8d2b6f")
      );
    }
  });

  registerNode("collection.collectToList", {
    title: window.RMLI18n.t("ui.auto.cf5207837395"),
    group: window.RMLI18n.t("ui.literal.4bbb632f02fd"),
    symbol: "＋[]",
    description:
      window.RMLI18n.t("ui.auto.b784e28c5b4c"),
    inputs: [
      port("reset", window.RMLI18n.t("ui.auto.37d17c56d708"), "impulse"),
      port("add", window.RMLI18n.t("ui.auto.0889f8cb2970"), "impulse"),
      genericPort(
        "value",
        window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
        "TItem",
        "value"
      )
    ],
    outputs: [
      port(
        "resetDone",
        window.RMLI18n.t("ui.auto.8d7896c46763"),
        "impulse"
      ),
      port(
        "added",
        window.RMLI18n.t("ui.auto.9bcebe2f51b9"),
        "impulse"
      ),
      genericPort(
        "list",
        window.RMLI18n.t("ui.auto.171d403bb4b3"),
        "TCollection",
        "collectableCollection"
      ),
      port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
    ],
    parameters: [
      pBool(
        "markAsEditable",
        window.RMLI18n.t("ui.literal.e2150a19e6b6"),
        false,
        window.RMLI18n.t("ui.literal.ff6a2551bd94")
      ),
      pText(
        "editableLabel",
        window.RMLI18n.t("ui.literal.d6baeaf2742b"),
        window.RMLI18n.t("ui.literal.eec87e5bce33"),
        window.RMLI18n.t("ui.literal.3599f4018161")
      )
    ],
    genericRelations: [
      {
        kind: "enumerableElement",
        collectionTypeVar:
          window.RMLI18n.t("ui.literal.3ab947cf02f2"),
        elementTypeVar: window.RMLI18n.t("ui.literal.786ef3089c72"),
        exact: true
      }
    ],
    impulseRoutes: {
      reset: ["resetDone"],
      add: ["added"]
    },
    codegenCollect(api) {
      const valueSpec =
        api.definition.inputs.find(
          specification =>
            specification.id === "value"
        );
      const listSpec =
        api.definition.outputs.find(
          specification =>
            specification.id === "list"
        );
      const itemType =
        api.resolvedType(
          api.node,
          valueSpec
        ) || "object";
      const collectionType =
        api.resolvedType(
          api.node,
          listSpec
        );
      const itemCsType =
        api.csType(itemType);
      const collectionCsType =
        collectionType
          ? api.csType(collectionType)
          : `System.Collections.Generic.List<${itemCsType}>`;

      addStatefulField(
        api,
        "collectedItems",
        collectionCsType,
        `new ${collectionCsType}()`
      );
    },
    codegenExpression(api) {
      const field =
        `_collectedItems${nodeToken(api)}`;

      return api.portId === "count"
        ? `${field}.Count`
        : field;
    },
    codegenAction(api) {
      const field =
        `_collectedItems${nodeToken(api)}`;
      const inputPort = String(
        api.connection?.toPort || ""
      );

      if (inputPort === "reset") {
        const resetDone =
          api.emit("resetDone");
        const editable =
          api.node?.parameters?.markAsEditable === true ||
          api.node?.parameters?.markAsEditable === "true" ||
          api.node?.parameters?.markAsEditable === 1;
        const publish =
          editable
            ? `\n        PublishDynamicCollectionSource("${api.escapeString(api.node.id)}", "${api.escapeString(api.node?.parameters?.editableLabel || api.node?.label || "Dynamic Choice")}", ${field});`
            : "";

        return `lock (${field}) { ${field}.Clear(); }${publish}${
          resetDone
            ? `\n        ${resetDone}();`
            : ""
        }`;
      }

      if (inputPort === "add") {
        const added =
          api.emit("added");
        const valueInput =
          api.input("value");

        if (
          valueInput?.connected !== true &&
          api.isInputConnected?.("value") !== true
        ) {
          api.diagnostic(
            window.RMLI18n.t("ui.literal.13d9d80f4d55")
          );

          return `throw new System.InvalidOperationException(window.RMLI18n.t("ui.literal.cb7284e6ba3e"));`;
        }

        const editable =
          api.node?.parameters?.markAsEditable === true ||
          api.node?.parameters?.markAsEditable === "true" ||
          api.node?.parameters?.markAsEditable === 1;
        const publish =
          editable
            ? `\n        PublishDynamicCollectionSource("${api.escapeString(api.node.id)}", "${api.escapeString(api.node?.parameters?.editableLabel || api.node?.label || "Dynamic Choice")}", ${field});`
            : "";

        return `lock (${field}) { ${field}.Add(${valueInput.code}); }${publish}${
          added
            ? `\n        ${added}();`
            : ""
        }`;
      }

      return "";
    },
    previewEvaluate({
      portId,
      type,
      unknown
    }) {
      return unknown(
        type,
        portId === "count"
          ? window.RMLI18n.t("ui.literal.0159858cdcec")
          : window.RMLI18n.t("ui.literal.3bc6c39d7dee")
      );
    }
  });

  registerNode("debug.log", {
    title: window.RMLI18n.t("ui.auto.48166198aa0c"),
    group: window.RMLI18n.t("ui.literal.a89564705d12"),
    symbol: "LOG",
    description:
      window.RMLI18n.t("ui.auto.71f568fb5de2"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")
    ],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenAction(api) {
      const next = api.emit("done");
      return `_display(FormatValue(${api.input("value").code}));${next ? `\n        ${next}();` : ""}`;
    }
  });

  registerNode("debug.throw", {
    title: window.RMLI18n.t("ui.auto.a3178e140d5b"),
    group: window.RMLI18n.t("ui.literal.a89564705d12"),
    symbol: "!",
    description:
      window.RMLI18n.t("ui.auto.05f5cd8f2756"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("message", window.RMLI18n.t("ui.auto.a6f75acc1be9"), "string")
    ],
    codegenAction(api) {
      return `throw new InvalidOperationException(${api.input("message").code});`;
    }
  });

  registerNode("lifecycle.processExit", {
    title: window.RMLI18n.t("ui.auto.056b06b63892"),
    group: window.RMLI18n.t("ui.literal.033df3d297c2"),
    symbol: "EXIT",
    description:
      window.RMLI18n.t("ui.auto.3e0dbcc1b385"),
    outputs: [port("event", window.RMLI18n.t("ui.auto.9162bc274ebc"), "impulse")],
    codegenCollect(api) {
      const emit = api.entryMethod(
        api.node.id,
        "event"
      );
      if (!emit) return;
      api.addInitialize(
        `AppDomain.CurrentDomain.ProcessExit += (_, _) => ${emit}();`
      );
    }
  });

  registerNode("lifecycle.modUnload", {
    title: window.RMLI18n.t("ui.auto.1b978a52eae9"),
    group: window.RMLI18n.t("ui.literal.033df3d297c2"),
    symbol: "MOD−",
    description:
      window.RMLI18n.t("ui.auto.b1253183b1f1"),
    outputs: [port("event", window.RMLI18n.t("ui.auto.1787197b34be"), "impulse")],
    codegenCollect(api) {
      const emit = api.entryMethod(
        api.node.id,
        "event"
      );
      if (!emit) return;

      api.require(
        "usesModUnloadLifecycle",
        true
      );
      ensureEventRuntime(api);
      ensureHarmonyRuntime(api);
      api.addUsing("System.Threading");
      api.addField(
        "universal.lifecycle.shutdownState",
        "private static int _graphShutdownStarted;"
      );
      api.addMember(
        "universal.lifecycle.shutdown",
        globalThis.RMLCodeTemplates.text("nodes", "source_025", [emit])
      );
    }
  });

  registerNode("lifecycle.unhandledException", {
    title: window.RMLI18n.t("ui.auto.a54ba442fb1d"),
    group: window.RMLI18n.t("ui.literal.033df3d297c2"),
    symbol: "EX!",
    description:
      window.RMLI18n.t("ui.auto.3371660b746f"),
    outputs: [
      port("event", window.RMLI18n.t("ui.auto.9162bc274ebc"), "impulse"),
      port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
    ],
    codegenCollect(api) {
      const token = nodeToken(api);
      const field = `_unhandled${token}`;
      const emit = api.emitMethod(
        api.node.id,
        "event"
      );
      const keepException =
        generatedOutputIsUsed(
          api,
          "exception"
        );
      if (keepException) {
        api.addRuntimeField(
          `${api.node.id}.exception`,
          field,
          window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
          "null!"
        );
      }
      if (emit) {
        api.addInitialize(
          `AppDomain.CurrentDomain.UnhandledException += (_, args) =>\n        {\n            using GraphExecutionScope scope = OpenGraphEntry();${keepException ? `\n            ${field} = args.ExceptionObject as Exception ?? new Exception(FormatValue(args.ExceptionObject));` : ""}\n            ${emit}();\n        };`
        );
      }
    },
    codegenExpression(api) {
      return `_unhandled${nodeToken(api)}`;
    }
  });

  registerNode("lifecycle.subscribeEvent", {
    title: window.RMLI18n.t("ui.auto.97d437938c64"),
    group: window.RMLI18n.t("ui.literal.033df3d297c2"),
    symbol: "+EV",
    description:
      window.RMLI18n.t("ui.auto.b3e7c23dc91d"),
    inputs: [
      port("target", window.RMLI18n.t("ui.auto.ba52d97729b9"), "object"),
      port("eventName", window.RMLI18n.t("ui.auto.eb53d213e540"), "string")
    ],
    outputs: [
      port("event", window.RMLI18n.t("ui.auto.9162bc274ebc"), "impulse"),
      port("arguments", window.RMLI18n.t("ui.auto.cda21d9622e7"), "objectArray")
    ],
    codegenCollect(api) {
      ensureEventRuntime(api);
      const token = nodeToken(api);
      const field = `_eventArguments${token}`;
      const callback = `ReceiveEvent${token}`;
      const emit = api.emitMethod(
        api.node.id,
        "event"
      );
      const keepArguments =
        generatedOutputIsUsed(
          api,
          "arguments"
        );
      if (keepArguments) {
        api.addRuntimeField(
          `${api.node.id}.args`,
          field,
          "object?[]",
          "Array.Empty<object?>()"
        );
      }
      api.addMember(
        `${api.node.id}.callback`,
        `private static void ${callback}(object?[] arguments)\n{\n    using GraphExecutionScope scope = OpenGraphEntry();${keepArguments ? `\n    ${field} = arguments;` : ""}${emit ? `\n    ${emit}();` : ""}\n}`
      );
      api.addEngineInit(
        `SubscribeGraphEventWhenAvailable(${quote(api, api.node.id)}, () => (object?)(${api.input("target").code}), () => (string?)(${api.input("eventName").code}), ${callback});`
      );
    },
    codegenExpression(api) {
      return `_eventArguments${nodeToken(api)}`;
    }
  });

  registerNode("lifecycle.timer", {
    title: window.RMLI18n.t("ui.auto.75285902bd0b"),
    group: window.RMLI18n.t("ui.literal.033df3d297c2"),
    symbol: "TMR",
    description:
      window.RMLI18n.t("ui.auto.46a09acb04c2"),
    inputs: [
      port("start", window.RMLI18n.t("ui.auto.603e48dee5e5"), "impulse"),
      port("stop", window.RMLI18n.t("ui.auto.a7d79d1d05da"), "impulse"),
      port("interval", window.RMLI18n.t("ui.auto.721886321b84"), "int")
    ],
    outputs: [port("tick", window.RMLI18n.t("ui.auto.6477501ee01c"), "impulse")],
    codegenCollect(api) {
      api.addUsing("System.Threading");
      const token = nodeToken(api);
      const field = `_timer${token}`;
      const emit = api.entryMethod(
        api.node.id,
        "tick"
      );
      api.addField(
        `${api.node.id}.timer`,
        `private static Timer? ${field};`
      );
      api.addMember(
        `${api.node.id}.startTimer`,
        globalThis.RMLCodeTemplates.text("nodes", "source_026", [token,
field,
field,
emit ? `${emit}()` : "{ }"])
      );
    },
    codegenAction(api) {
      const token = nodeToken(api);
      if (api.connection.toPort === "stop") {
        return `_timer${token}?.Dispose();\n        _timer${token} = null;`;
      }
      return `StartTimer${token}(${api.input("interval").code});`;
    }
  });

  registerNode("harmony.patchEvent", {
    title: window.RMLI18n.t("ui.auto.6bc5b9076214"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    symbol: "H",
    description:
      window.RMLI18n.t("ui.auto.76e1152b029a"),
    parameters: [
      pSelect(
        "patchKind",
        window.RMLI18n.t("ui.literal.610d75ebc6c6"),
        ["prefix", "postfix", "finalizer"],
        "prefix"
      ),
      pText(
        "targetType",
        window.RMLI18n.t("ui.literal.a45f8055dba4"),
        "FrooxEngine.Engine",
        window.RMLI18n.t("ui.literal.6f69bcf6791c")
      ),
      pText(
        "targetMethod",
        window.RMLI18n.t("ui.literal.e0fc2b617c9e"),
        window.RMLI18n.t("ui.literal.aa15d6e5885c"),
        window.RMLI18n.t("ui.literal.c3dd233540d6")
      ),
      pText(
        "argumentTypes",
        window.RMLI18n.t("ui.auto.631184b96d50"),
        "",
        window.RMLI18n.t("ui.literal.8f8f13771731")
      ),
      pNumber(
        "priority",
        window.RMLI18n.t("ui.literal.0d5118820149"),
        400,
        window.RMLI18n.t("ui.literal.e60fac3e0ff2")
      ),
      pBool(
        "captureResult",
        window.RMLI18n.t("ui.literal.e7288b2c2cc7"),
        false,
        window.RMLI18n.t("ui.literal.c6f0dcbd8597")
      )
    ],
    outputs: [
      port("called", window.RMLI18n.t("ui.auto.6e8b938b82e2"), "impulse"),
      port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext")
    ],
    codegenCollect(api) {
      ensureHarmonyRuntime(api);
      api.requireRuntimeHelper(
        window.RMLI18n.t("ui.literal.0685ff7ba1f5")
      );
      const token = nodeToken(api);
      const field = `_patchContext${token}`;
      const callback = `HarmonyCallback${token}`;
      const emit = api.emitMethod(
        api.node.id,
        "called"
      );
      const kind = String(
        api.node.parameters.patchKind ||
          "prefix"
      ).toLowerCase();
      const captureResult =
        api.node.parameters.captureResult ===
        true;
      const resultParameter = captureResult
        ? ", ref object? __result"
        : "";
      const resultInitializer = captureResult
        ? ",\n        Result = __result"
        : "";
      const resultCommit = captureResult
        ? `\n        __result = ${field}.Result;`
        : "";
      const emitStatement = emit
        ? `\n        ${emit}();`
        : "";
      const failureSource =
        api.escapeString(
          `Harmony ${kind} ${String(
            api.node.parameters.targetType ||
              "<unknown type>"
          )}.${String(
            api.node.parameters.targetMethod ||
              "<unknown method>"
          )}`
        );

      api.addRuntimeField(
        `${api.node.id}.context`,
        field,
        window.RMLI18n.t("ui.literal.7ba3c71580fe"),
        "new PatchContext()"
      );

      let callbackCode;

      if (kind === "finalizer") {
        callbackCode = globalThis.RMLCodeTemplates.text("nodes", "source_027", [callback,
resultParameter,
field,
resultInitializer,
emitStatement,
resultCommit,
field,
failureSource]);
      } else if (kind === "postfix") {
        callbackCode = globalThis.RMLCodeTemplates.text("nodes", "source_028", [callback,
resultParameter,
field,
resultInitializer,
emitStatement,
resultCommit,
failureSource]);
      } else {
        callbackCode = globalThis.RMLCodeTemplates.text("nodes", "source_029", [callback,
resultParameter,
field,
resultInitializer,
emitStatement,
resultCommit,
field,
failureSource]);
      }

      api.addMember(
        `${api.node.id}.callback`,
        callbackCode
      );
      api.addEngineInit(
        `RegisterGeneratedHarmonyPatch(${quote(
          api,
          api.node.parameters.targetType
        )}, ${quote(
          api,
          api.node.parameters.targetMethod
        )}, ${quote(
          api,
          api.node.parameters.argumentTypes
        )}, ${quote(api, kind)}, nameof(${callback}), ${Math.trunc(
          Number(api.node.parameters.priority) ||
            400
        )});`
      );

      if (captureResult) {
        api.warning(
          `${api.definition.title}: generic ref object __result is convenient but not valid for every value-type signature. Use Harmony Exact Patch Source for a fully exact method signature.`
        );
      }
    },
    codegenExpression(api) {
      return `_patchContext${nodeToken(api)}`;
    }
  });

  function registerLifecycleHarmonyPreset(
    id,
    title,
    symbol,
    targetType,
    targetMethod,
    description
  ) {
    const harmonyDefinition =
      registry.getNodeDefinition(
        "harmony.patchEvent"
      );

    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.033df3d297c2"),
      symbol,
      description:
        `${description} The target type and method remain editable because internal Resonite names can change between builds.`,
      parameters: [
        pSelect(
          "patchKind",
          window.RMLI18n.t("ui.literal.610d75ebc6c6"),
          ["prefix", "postfix", "finalizer"],
          "postfix"
        ),
        pText(
          "targetType",
          window.RMLI18n.t("ui.literal.a45f8055dba4"),
          targetType,
          window.RMLI18n.t("ui.literal.9823faed7e30")
        ),
        pText(
          "targetMethod",
          window.RMLI18n.t("ui.literal.e0fc2b617c9e"),
          targetMethod,
          window.RMLI18n.t("ui.literal.c3bb456b3556")
        ),
        pText(
          "argumentTypes",
          window.RMLI18n.t("ui.auto.631184b96d50"),
          "",
          window.RMLI18n.t("ui.literal.8691ff4ab349")
        ),
        pNumber(
          "priority",
          window.RMLI18n.t("ui.literal.0d5118820149"),
          400
        ),
        pBool(
          "captureResult",
          window.RMLI18n.t("ui.literal.e7288b2c2cc7"),
          false
        )
      ],
      outputs: [
        port("called", window.RMLI18n.t("ui.auto.6e8b938b82e2"), "impulse"),
        port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext")
      ],
      codegenCollect:
        harmonyDefinition.codegenCollect,
      codegenExpression:
        harmonyDefinition.codegenExpression
    });
  }

  registerLifecycleHarmonyPreset(
    "lifecycle.worldStart",
    window.RMLI18n.t("ui.literal.9ac6dd7e519a"),
    window.RMLI18n.t("ui.literal.231b3fc8d429"),
    "FrooxEngine.World",
    window.RMLI18n.t("ui.literal.0bd1faf074d7"),
    window.RMLI18n.t("ui.literal.1b5e56a6c9a1")
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.worldDestroy",
    window.RMLI18n.t("ui.literal.4318495b28e5"),
    window.RMLI18n.t("ui.literal.83a86dd559cb"),
    "FrooxEngine.World",
    window.RMLI18n.t("ui.literal.9d34c39bf776"),
    window.RMLI18n.t("ui.literal.b94126360d17")
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.userJoin",
    window.RMLI18n.t("ui.literal.fb5fcfccb0bf"),
    window.RMLI18n.t("ui.literal.9de39be68f15"),
    "FrooxEngine.World",
    window.RMLI18n.t("ui.literal.fc1192ea5901"),
    window.RMLI18n.t("ui.literal.3ec412ab9320")
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.userLeave",
    window.RMLI18n.t("ui.literal.c245ef87bfc5"),
    window.RMLI18n.t("ui.literal.e57b26fceb81"),
    "FrooxEngine.World",
    window.RMLI18n.t("ui.literal.7edcd4e55626"),
    window.RMLI18n.t("ui.literal.cd5bd9b80fe1")
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.componentAttach",
    window.RMLI18n.t("ui.literal.9a005008703e"),
    window.RMLI18n.t("ui.literal.8a5ebc115bc7"),
    "FrooxEngine.Component",
    window.RMLI18n.t("ui.literal.175f4a81f6c8"),
    window.RMLI18n.t("ui.literal.3ffbc6f80244")
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.componentDestroy",
    window.RMLI18n.t("ui.literal.2c3ffdb1abb5"),
    window.RMLI18n.t("ui.literal.a46c36996215"),
    "FrooxEngine.Component",
    window.RMLI18n.t("ui.literal.9d34c39bf776"),
    window.RMLI18n.t("ui.literal.b98cfe9ca008")
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.engineUpdate",
    window.RMLI18n.t("ui.literal.3c90d35f073e"),
    window.RMLI18n.t("ui.literal.52c6c1812015"),
    "FrooxEngine.Engine",
    window.RMLI18n.t("ui.literal.fb91e24fa52d"),
    window.RMLI18n.t("ui.literal.0acebe062529")
  );

  registerNode("harmony.patchArgument", {
    title: window.RMLI18n.t("ui.auto.2d373316f88c"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    symbol: "ARG",
    description:
      window.RMLI18n.t("ui.auto.803d5ce8b469"),
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(
      type =>
        ![
          "patchContext",
          "task",
          "cancellationToken"
        ].includes(type)
    ),
    defaultType: "object",
    parameters: [
      pNumber(
        "index",
        window.RMLI18n.t("ui.literal.4c2404c50542"),
        0
      )
    ],
    inputs: [
      port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext")
    ],
    outputs: [
      genericPort(
        "value",
        window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      const index = Math.max(
        0,
        Math.trunc(
          Number(api.node.parameters.index) || 0
        )
      );
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(${api.input("context").code}.Arguments.Length > ${index} ? ${api.input("context").code}.Arguments[${index}] : null)`;
    }
  });

  registerNode("harmony.patchResult", {
    title: window.RMLI18n.t("ui.auto.f803c7b6f1bd"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    symbol: "RET",
    description:
      window.RMLI18n.t("ui.auto.dad59e0579e4"),
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(
      type =>
        ![
          "patchContext",
          "task",
          "cancellationToken"
        ].includes(type)
    ),
    defaultType: "object",
    inputs: [port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext")],
    outputs: [
      genericPort(
        "value",
        window.RMLI18n.t("ui.auto.ca8a16007fd8"),
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(${api.input("context").code}.Result)`;
    }
  });

  registerNode("harmony.patchException", {
    title: window.RMLI18n.t("ui.auto.f19acb9d8ee3"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    symbol: "EX",
    description:
      window.RMLI18n.t("ui.auto.2cf25692e24e"),
    inputs: [port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext")],
    outputs: [port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")],
    codegenExpression(api) {
      return `${api.input("context").code}.Exception!`;
    }
  });

  registerNode("harmony.setArgument", {
    title: window.RMLI18n.t("ui.auto.8d76dc3810a3"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    symbol: "ARG=",
    description:
      window.RMLI18n.t("ui.auto.611433144d57"),
    parameters: [
      pNumber(
        "index",
        window.RMLI18n.t("ui.literal.4c2404c50542"),
        0
      )
    ],
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext"),
      port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")
    ],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenAction(api) {
      const index = Math.max(
        0,
        Math.trunc(
          Number(api.node.parameters.index) || 0
        )
      );
      const context = api.input("context").code;
      const done = api.emit("done");
      return `if (${context}.Arguments.Length > ${index})\n        {\n            ${context}.Arguments[${index}] = ${api.input("value").code};\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.setResult", {
    title: window.RMLI18n.t("ui.auto.43ef2cb36307"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    symbol: "RET=",
    description:
      window.RMLI18n.t("ui.auto.6ac956771de5"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext"),
      port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")
    ],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("context").code}.Result = ${api.input("value").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.skipOriginal", {
    title: window.RMLI18n.t("ui.auto.1715a9ea5d8f"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    symbol: "SKIP",
    description:
      window.RMLI18n.t("ui.auto.47f64630e7af"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext")
    ],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("context").code}.SkipOriginal = true;${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.setFinalizerException", {
    title: window.RMLI18n.t("ui.auto.3242637c3d49"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    symbol: "EX=",
    description:
      window.RMLI18n.t("ui.auto.8667abed4dfc"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext"),
      port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
    ],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("context").code}.Exception = ${api.input("exception").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.reversePatch", {
    title: window.RMLI18n.t("ui.auto.c60fa605bbc9"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    expertOnly: true,
    symbol: window.RMLI18n.t("ui.literal.920f46b048fd"),
    description:
      window.RMLI18n.t("ui.auto.d055cab326ae"),
    parameters: [
      pText("targetType", window.RMLI18n.t("ui.literal.a45f8055dba4"), "FrooxEngine.SomeType"),
      pText("targetMethod", window.RMLI18n.t("ui.literal.e0fc2b617c9e"), window.RMLI18n.t("ui.literal.04ad15ba1756")),
      pText("targetArguments", window.RMLI18n.t("ui.literal.d364cd5224a2"), ""),
      pText(
        "standInType",
        window.RMLI18n.t("ui.literal.ce71f5383b78"),
        window.RMLI18n.t("ui.literal.f091ab4a13ed")
      ),
      pText(
        "standInMethod",
        window.RMLI18n.t("ui.literal.1e2ab6a95e31"),
        window.RMLI18n.t("ui.literal.9709c34d81c6")
      )
    ],
    inputs: [port("call", window.RMLI18n.t("ui.auto.35d0f97a80af"), "impulse")],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenCollect(api) {
      ensureHarmonyRuntime(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `CreateGeneratedReversePatch(${quote(
        api,
        api.node.parameters.targetType
      )}, ${quote(
        api,
        api.node.parameters.targetMethod
      )}, ${quote(
        api,
        api.node.parameters.targetArguments
      )}, ${quote(
        api,
        api.node.parameters.standInType
      )}, ${quote(
        api,
        api.node.parameters.standInMethod
      )});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.unpatchAll", {
    title: window.RMLI18n.t("ui.auto.c50836302e16"),
    group: window.RMLI18n.t("ui.literal.09b6aa6507d0"),
    symbol: "UNH",
    description:
      window.RMLI18n.t("ui.auto.71d59e0db0bc"),
    inputs: [port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse")],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenCollect(api) {
      ensureHarmonyRuntime(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `_graphHarmony.UnpatchAll(_graphHarmony.Id);${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.findType", {
    title: window.RMLI18n.t("ui.auto.d58956ff4113"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "TYPE",
    description:
      window.RMLI18n.t("ui.auto.cb1f26371405"),
    inputs: [port("name", window.RMLI18n.t("ui.auto.0d1b1696d604"), "string")],
    outputs: [port("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "type")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindType(${api.input("name").code})!`;
    }
  });

  registerNode("reflection.getMethod", {
    title: window.RMLI18n.t("ui.auto.ec16a21fc605"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "M",
    description:
      window.RMLI18n.t("ui.auto.89d04fb33953"),
    inputs: [
      port("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "type"),
      port("name", window.RMLI18n.t("ui.auto.060d61447a76"), "string"),
      port("argumentTypes", window.RMLI18n.t("ui.auto.631184b96d50"), "string")
    ],
    outputs: [port("method", window.RMLI18n.t("ui.auto.138927ca2c78"), "methodInfo")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindMethod(${api.input("type").code}, ${api.input("name").code}, ResolveTypeList(${api.input("argumentTypes").code}))!`;
    }
  });

  registerNode("reflection.getField", {
    title: window.RMLI18n.t("ui.auto.c4700d498e68"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "F",
    description:
      window.RMLI18n.t("ui.auto.0fdf7102dbc1"),
    inputs: [
      port("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "type"),
      port("name", window.RMLI18n.t("ui.auto.e2e4a3ff4c8f"), "string")
    ],
    outputs: [port("field", window.RMLI18n.t("ui.auto.137db44b500c"), "fieldInfo")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindGraphField(${api.input("type").code}, ${api.input("name").code})!`;
    }
  });

  registerNode("reflection.getProperty", {
    title: window.RMLI18n.t("ui.auto.b96a0af7110e"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "P",
    description:
      window.RMLI18n.t("ui.auto.ac30e9909d55"),
    inputs: [
      port("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "type"),
      port("name", window.RMLI18n.t("ui.auto.da9d268d32f5"), "string")
    ],
    outputs: [port("property", window.RMLI18n.t("ui.auto.54774b910e64"), "propertyInfo")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindGraphProperty(${api.input("type").code}, ${api.input("name").code})!`;
    }
  });

  registerNode("reflection.readMember", {
    title: window.RMLI18n.t("ui.auto.9eef9f043f40"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "GET",
    description:
      window.RMLI18n.t("ui.auto.1f02a2efea27"),
    inputs: [
      port("target", window.RMLI18n.t("ui.auto.ba52d97729b9"), "object"),
      port("path", window.RMLI18n.t("ui.auto.d998cbe123c5"), "string")
    ],
    outputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `ReadMemberPath(${api.input("target").code}, ${api.input("path").code})!`;
    }
  });

  registerNode("reflection.convertObject", {
    title: window.RMLI18n.t("ui.auto.7b449d4d5565"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "CAST",
    description:
      window.RMLI18n.t("ui.auto.603dfa9837f7"),
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES.filter(
      type =>
        ![
          "patchContext",
          "task",
          "cancellationToken"
        ].includes(type)
    ),
    defaultType: "string",
    inputs: [port("value", window.RMLI18n.t("ui.auto.70bd5b4088b4"), "object")],
    outputs: [
      genericPort(
        "result",
        window.RMLI18n.t("ui.auto.ca8a16007fd8"),
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(${api.input("value").code})`;
    }
  });

  registerNode("reflection.writeMember", {
    title: window.RMLI18n.t("ui.auto.4acc63910482"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "SET",
    description:
      window.RMLI18n.t("ui.auto.9c0f886e393f"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("target", window.RMLI18n.t("ui.auto.ba52d97729b9"), "object"),
      port("name", window.RMLI18n.t("ui.auto.a2f0764fec62"), "string"),
      port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      if (
        generatedActionOutputIsUsed(
          api,
          "success"
        )
      ) {
        addStatefulField(
          api,
          "writeSuccess",
          "bool",
          "false"
        );
      }
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_writeSuccess${nodeToken(api)}`
      );
    },
    codegenAction(api) {
      const field = `_writeSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      const call = `WriteMember(${api.input("target").code}, ${api.input("name").code}, ${api.input("value").code})`;
      const write = generatedActionOutputIsUsed(
        api,
        "success"
      )
        ? `${field} = ${call};`
        : `${call};`;
      return `${write}${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.invokeMethod", {
    title: window.RMLI18n.t("ui.auto.c0a75ef98c0d"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "CALL",
    description:
      window.RMLI18n.t("ui.auto.d77e1d4dc20c"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("method", window.RMLI18n.t("ui.auto.138927ca2c78"), "methodInfo"),
      port("target", window.RMLI18n.t("ui.auto.ba52d97729b9"), "object"),
      port("arguments", window.RMLI18n.t("ui.auto.cda21d9622e7"), "objectArray")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "object"),
      port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      const token = nodeToken(api);
      if (generatedActionOutputIsUsed(api, "result")) {
        api.addRuntimeField(
          `${api.node.id}.result`,
          `_invokeResult${token}`,
          "object?",
          "null"
        );
      }
      if (
        generatedActionOutputIsUsed(
          api,
          "exception"
        )
      ) {
        api.addRuntimeField(
          `${api.node.id}.error`,
          `_invokeException${token}`,
          window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
          "null!"
        );
      }
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      return generatedActionOutputExpression(
        api,
        api.portId === "exception"
        ? `_invokeException${token}`
        : `_invokeResult${token}!`
      );
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const done = api.emit("done");
      const keepResult =
        generatedActionOutputIsUsed(api, "result");
      const keepException =
        generatedActionOutputIsUsed(
          api,
          "exception"
        );
      const call = `InvokeMethodInfo(${api.input("method").code}, ${api.input("target").code}, ${api.input("arguments").code})`;
      const resultLine = keepResult
        ? `_invokeResult${token} = ${call};`
        : `${call};`;
      const resetLine = keepException
        ? `_invokeException${token} = null!;\n            `
        : "";
      const catchClause = keepException
        ? "catch (Exception exception)"
        : "catch (Exception)";
      const catchLines = [
        keepException
          ? `_invokeException${token} = exception;`
          : "",
        keepResult
          ? `_invokeResult${token} = null;`
          : ""
      ].filter(Boolean).join("\n            ");
      return `try\n        {\n            ${resetLine}${resultLine}\n        }\n        ${catchClause}\n        {${catchLines ? `\n            ${catchLines}\n        ` : ""}}${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.callByName", {
    title: window.RMLI18n.t("ui.auto.b81cd42b1a1c"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "NAME()",
    description:
      window.RMLI18n.t("ui.auto.e61ba043e2da"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("target", window.RMLI18n.t("ui.auto.bb86da6511cb"), "object"),
      port("name", window.RMLI18n.t("ui.auto.060d61447a76"), "string"),
      port("arguments", window.RMLI18n.t("ui.auto.cda21d9622e7"), "objectArray")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "object")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      if (
        generatedActionOutputIsUsed(
          api,
          "result"
        )
      ) {
        addStatefulField(
          api,
          "callResult",
          "object?",
          "null"
        );
      }
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_callResult${nodeToken(api)}!`
      );
    },
    codegenAction(api) {
      const field = `_callResult${nodeToken(api)}`;
      const done = api.emit("done");
      const call = `InvokeBest(${api.input("target").code}, ${api.input("name").code}, ${api.input("arguments").code})`;
      const invoke = generatedActionOutputIsUsed(
        api,
        "result"
      )
        ? `${field} = ${call};`
        : `${call};`;
      return `${invoke}${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.createInstance", {
    title: window.RMLI18n.t("ui.auto.83f9621f09e8"),
    group: window.RMLI18n.t("ui.literal.fda05af620d8"),
    symbol: "NEW",
    description:
      window.RMLI18n.t("ui.auto.4355c34abecd"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "type"),
      port("arguments", window.RMLI18n.t("ui.auto.cda21d9622e7"), "objectArray")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("instance", window.RMLI18n.t("ui.auto.e286402547d9"), "object")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      if (
        generatedActionOutputIsUsed(
          api,
          "instance"
        )
      ) {
        addStatefulField(
          api,
          "createdInstance",
          "object?",
          "null"
        );
      }
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_createdInstance${nodeToken(api)}!`
      );
    },
    codegenAction(api) {
      const field = `_createdInstance${nodeToken(api)}`;
      const done = api.emit("done");
      const call = `CreateReflective(${api.input("type").code}, ${api.input("arguments").code})`;
      const create = generatedActionOutputIsUsed(
        api,
        "instance"
      )
        ? `${field} = ${call};`
        : `${call};`;
      return `${create}${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.combinePath", {
    title: window.RMLI18n.t("ui.auto.9ed8cc86d07f"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "PATH",
    description:
      window.RMLI18n.t("ui.auto.8a1290cc922e"),
    inputs: [
      port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "string"),
      port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "string")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "string")
    },
    outputs: [port("path", window.RMLI18n.t("ui.auto.8d45ff098322"), "string")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      const count = Math.max(
        2,
        Math.min(64, Number(api.node.parameters?.variadicInputCount) || 2)
      );
      const ids = Array.from({ length: count }, (_, index) =>
        index < 26
          ? String.fromCharCode(97 + index)
          : `input${index + 1}`
      );
      return `Path.Combine(${ids.map(id => api.input(id).code).join(", ")})`;
    }
  });

  registerNode("file.fileExists", {
    title: window.RMLI18n.t("ui.auto.91b2a8b7d5a7"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "F?",
    description: window.RMLI18n.t("ui.auto.0355bce2d866"),
    inputs: [port("path", window.RMLI18n.t("ui.auto.8d45ff098322"), "string")],
    outputs: [port("exists", window.RMLI18n.t("ui.auto.cfebf05e0968"), "bool")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      return `File.Exists(${api.input("path").code})`;
    }
  });

  registerNode("file.directoryExists", {
    title: window.RMLI18n.t("ui.auto.2ced063157f2"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "D?",
    description: window.RMLI18n.t("ui.auto.1413eecda44f"),
    inputs: [port("path", window.RMLI18n.t("ui.auto.8d45ff098322"), "string")],
    outputs: [port("exists", window.RMLI18n.t("ui.auto.cfebf05e0968"), "bool")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      return `Directory.Exists(${api.input("path").code})`;
    }
  });

  registerNode("file.readText", {
    title: window.RMLI18n.t("ui.auto.9c29fd90efcf"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "READ",
    description:
      window.RMLI18n.t("ui.auto.f2a4403c6f44"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("path", window.RMLI18n.t("ui.auto.8d45ff098322"), "string")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string"),
      port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
    ],
    codegenCollect(api) {
      api.addUsing("System.IO");
      const token = nodeToken(api);
      if (generatedActionOutputIsUsed(api, "text")) {
        api.addRuntimeField(
          `${api.node.id}.text`,
          `_readText${token}`,
          "string",
          "string.Empty"
        );
      }
      if (
        generatedActionOutputIsUsed(
          api,
          "exception"
        )
      ) {
        api.addRuntimeField(
          `${api.node.id}.exception`,
          `_readTextException${token}`,
          window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
          "null!"
        );
      }
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      return generatedActionOutputExpression(
        api,
        api.portId === "exception"
          ? `_readTextException${token}`
          : `_readText${token}`
      );
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const done = api.emit("done");
      const keepText =
        generatedActionOutputIsUsed(api, "text");
      const keepException =
        generatedActionOutputIsUsed(
          api,
          "exception"
        );
      const resetException = keepException
        ? `_readTextException${token} = null!;\n            `
        : "";
      const read = keepText
        ? `_readText${token} = File.ReadAllText(${api.input("path").code});`
        : `File.ReadAllText(${api.input("path").code});`;
      const catchClause = keepException
        ? "catch (Exception exception)"
        : "catch (Exception)";
      const catchLines = [
        keepException
          ? `_readTextException${token} = exception;`
          : "",
        keepText
          ? `_readText${token} = string.Empty;`
          : ""
      ].filter(Boolean).join("\n            ");
      return `try\n        {\n            ${resetException}${read}\n        }\n        ${catchClause}\n        {${catchLines ? `\n            ${catchLines}\n        ` : ""}}${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.readBytes", {
    title: window.RMLI18n.t("ui.auto.fed472eaff09"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "BIN←",
    description: window.RMLI18n.t("ui.auto.b17025202ba5"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("path", window.RMLI18n.t("ui.auto.8d45ff098322"), "string")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("bytes", window.RMLI18n.t("ui.auto.82566c0a8a2e"), "byteArray")
    ],
    codegenCollect(api) {
      api.addUsing("System.IO");
      if (
        generatedActionOutputIsUsed(
          api,
          "bytes"
        )
      ) {
        addStatefulField(
          api,
          "readBytes",
          "byte[]",
          "Array.Empty<byte>()"
        );
      }
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_readBytes${nodeToken(api)}`
      );
    },
    codegenAction(api) {
      const field = `_readBytes${nodeToken(api)}`;
      const done = api.emit("done");
      const read = generatedActionOutputIsUsed(
        api,
        "bytes"
      )
        ? `${field} = File.ReadAllBytes(${api.input("path").code});`
        : `File.ReadAllBytes(${api.input("path").code});`;
      return `${read}${done ? `\n        ${done}();` : ""}`;
    }
  });

  function registerFileWriteNode(
    id,
    title,
    symbol,
    method,
    valueType,
    description
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.a513560b7e42"),
      symbol,
      description,
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port("path", window.RMLI18n.t("ui.auto.8d45ff098322"), "string"),
        port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), valueType)
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
        port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
      ],
      codegenCollect(api) {
        api.addUsing("System.IO");
        if (
          generatedActionOutputIsUsed(
            api,
            "exception"
          )
        ) {
          api.addRuntimeField(
            `${api.node.id}.exception`,
            `_fileWriteException${nodeToken(api)}`,
            window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
            "null!"
          );
        }
      },
      codegenExpression(api) {
        return generatedActionOutputExpression(
          api,
          `_fileWriteException${nodeToken(api)}`
        );
      },
      codegenAction(api) {
        const token = nodeToken(api);
        const done = api.emit("done");
        const keepException =
          generatedActionOutputIsUsed(
            api,
            "exception"
          );
        const reset = keepException
          ? `_fileWriteException${token} = null!;\n            `
          : "";
        const catchClause = keepException
          ? "catch (Exception exception)"
          : "catch (Exception)";
        const store = keepException
          ? `\n            _fileWriteException${token} = exception;\n        `
          : "";
        return `try\n        {\n            ${reset}${method}(${api.input("path").code}, ${api.input("value").code});\n        }\n        ${catchClause}\n        {${store}}${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerFileWriteNode(
    "file.writeText",
    window.RMLI18n.t("ui.literal.f5b5e904b142"),
    window.RMLI18n.t("ui.literal.27ad330619a7"),
    window.RMLI18n.t("ui.literal.1be27b158663"),
    "string",
    window.RMLI18n.t("ui.literal.a5b9d6f0582e")
  );
  registerFileWriteNode(
    "file.appendText",
    window.RMLI18n.t("ui.literal.f3e7137830e2"),
    window.RMLI18n.t("ui.literal.025e07020e93"),
    window.RMLI18n.t("ui.literal.2d29d9ecc7fd"),
    "string",
    window.RMLI18n.t("ui.literal.36b23af13387")
  );
  registerFileWriteNode(
    "file.writeBytes",
    window.RMLI18n.t("ui.literal.e1f0c6c36d87"),
    window.RMLI18n.t("ui.literal.9a8733980c4c"),
    window.RMLI18n.t("ui.literal.4b0ce9f352d5"),
    "byteArray",
    window.RMLI18n.t("ui.literal.3deeb1e02f52")
  );

  registerNode("file.createDirectory", {
    title: window.RMLI18n.t("ui.auto.772eac6140b1"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "+DIR",
    description:
      window.RMLI18n.t("ui.auto.1c50049c89ca"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("path", window.RMLI18n.t("ui.auto.8d45ff098322"), "string")
    ],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `Directory.CreateDirectory(${api.input("path").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.delete", {
    title: window.RMLI18n.t("ui.auto.19daa1ce3667"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "DEL",
    description:
      window.RMLI18n.t("ui.auto.c2aa1734f82a"),
    parameters: [
      pBool(
        "recursive",
        window.RMLI18n.t("ui.literal.0ce48003eb40"),
        false
      )
    ],
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      port("path", window.RMLI18n.t("ui.auto.8d45ff098322"), "string")
    ],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenAction(api) {
      const path = api.input("path").code;
      const recursive =
        api.node.parameters.recursive === true
          ? "true"
          : "false";
      const done = api.emit("done");
      return `if (File.Exists(${path}))\n        {\n            File.Delete(${path});\n        }\n        else if (Directory.Exists(${path}))\n        {\n            Directory.Delete(${path}, ${recursive});\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.enumerateFiles", {
    title: window.RMLI18n.t("ui.auto.0d9ab120dd61"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "FILES",
    description:
      window.RMLI18n.t("ui.auto.0da947561791"),
    parameters: [
      pSelect(
        "scope",
        window.RMLI18n.t("ui.literal.8dbe84870666"),
        [
          ["top", window.RMLI18n.t("ui.literal.5fe17d3081f5")],
          ["all", window.RMLI18n.t("ui.literal.ae88d6e48aaf")]
        ],
        "top"
      )
    ],
    inputs: [
      port("directory", window.RMLI18n.t("ui.auto.7127600b9350"), "string"),
      port("pattern", window.RMLI18n.t("ui.auto.a2666c4fda5d"), "string")
    ],
    outputs: [port("files", window.RMLI18n.t("ui.auto.46de40b91f72"), "stringArray")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      const scope =
        api.node.parameters.scope === "all"
          ? window.RMLI18n.t("ui.literal.1ed3f610d4eb")
          : window.RMLI18n.t("ui.literal.605e91d71ee1");
      return `Directory.Exists(${api.input("directory").code}) ? Directory.GetFiles(${api.input("directory").code}, ${api.input("pattern").code}, ${scope}) : Array.Empty<string>()`;
    }
  });

  registerNode("json.parse", {
    title: window.RMLI18n.t("ui.auto.6cf3490a803c"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "{}",
    description:
      window.RMLI18n.t("ui.auto.720b236c1fd7"),
    inputs: [port("text", window.RMLI18n.t("ui.auto.999980b0e960"), "string")],
    outputs: [port("json", window.RMLI18n.t("ui.auto.fe3dd3a4e154"), "json")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      const token = nodeToken(api);
      api.addField(
        `${api.node.id}.jsonParseCache`,
        `private static readonly object _jsonParseLock${token} = new();
private static string? _jsonParseText${token};
private static JsonNode? _jsonParseValue${token};
private static bool _jsonParseHasValue${token};`
      );
      api.addMember(
        `${api.node.id}.jsonParseCached`,
        `private static JsonNode? ParseGraphJsonCached${token}(string? text)
{
    string normalized = text ?? string.Empty;
    lock (_jsonParseLock${token})
    {
        if (_jsonParseHasValue${token} &&
            string.Equals(_jsonParseText${token}, normalized, StringComparison.Ordinal))
        {
            return _jsonParseValue${token};
        }

        JsonNode? parsed = ParseGraphJson(normalized);
        _jsonParseText${token} = normalized;
        _jsonParseValue${token} = parsed;
        _jsonParseHasValue${token} = true;
        return parsed;
    }
}`
      );
      return `ParseGraphJsonCached${token}(${api.input("text").code})!`;
    }
  });

  registerNode("json.serialize", {
    title: window.RMLI18n.t("ui.auto.cd9a3cf418ae"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "{}→T",
    description:
      window.RMLI18n.t("ui.auto.30ba5a26e1de"),
    parameters: [
      pBool(
        "indented",
        window.RMLI18n.t("ui.literal.02a586186ad2"),
        true
      )
    ],
    inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
    outputs: [port("text", window.RMLI18n.t("ui.auto.999980b0e960"), "string")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `SerializeGraphJson(${api.input("value").code}, ${api.node.parameters.indented === true ? "true" : "false"})`;
    }
  });

  registerNode("json.property", {
    title: window.RMLI18n.t("ui.auto.590a47106d7f"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: ".JSON",
    description:
      window.RMLI18n.t("ui.auto.ece4493419d5"),
    inputs: [
      port("json", window.RMLI18n.t("ui.auto.fe3dd3a4e154"), "json"),
      port("path", window.RMLI18n.t("ui.auto.8d45ff098322"), "string")
    ],
    outputs: [port("value", window.RMLI18n.t("ui.auto.b79a83fed1f7"), "json")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `ReadGraphJsonProperty(${api.input("json").code}, ${api.input("path").code})!`;
    }
  });

  registerNode("json.asString", {
    title: window.RMLI18n.t("ui.auto.fd5197b58463"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "J→T",
    description:
      window.RMLI18n.t("ui.auto.f91dfcd40b74"),
    inputs: [port("json", window.RMLI18n.t("ui.auto.fe3dd3a4e154"), "json")],
    outputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `GraphJsonAsString(${api.input("json").code})`;
    }
  });

  registerNode("json.convert", {
    title: window.RMLI18n.t("ui.auto.753b1801df41"),
    group: window.RMLI18n.t("ui.literal.a513560b7e42"),
    symbol: "J→T",
    description:
      window.RMLI18n.t("ui.auto.5a612c3c22c0"),
    configurableTypeVar: "T",
    configurableTypes: JSON_CONVERTIBLE_TYPES,
    defaultType: "string",
    inputs: [port("json", window.RMLI18n.t("ui.auto.fe3dd3a4e154"), "json")],
    outputs: [
      genericPort(
        "value",
        window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `${api.input("json").code}.Deserialize<${api.csType(
        api.node.parameters.valueType
      )}>()!`;
    }
  });

  registerNode("network.httpRequest", {
    title: window.RMLI18n.t("ui.auto.d4ce05a95fe7"),
    group: window.RMLI18n.t("ui.literal.1e9174855701"),
    symbol: "HTTP",
    description:
      window.RMLI18n.t("ui.auto.43ef1a64582c"),
    parameters: [
      pSelect(
        "method",
        window.RMLI18n.t("ui.literal.337ba610aa0d"),
        [
          "GET",
          "POST",
          window.RMLI18n.t("ui.literal.091b0ce42eb0"),
          window.RMLI18n.t("ui.literal.9fbe29d4d76e"),
          window.RMLI18n.t("ui.literal.d6f5636098cd"),
          window.RMLI18n.t("ui.literal.7138a5166194")
        ],
        "GET"
      ),
      pText(
        "contentType",
        window.RMLI18n.t("ui.auto.a879b09f8c57"),
        "application/json"
      ),
      pCode(
        "headers",
        window.RMLI18n.t("ui.literal.520de7443d00"),
        "",
        window.RMLI18n.t("ui.literal.6431006881cb"),
        5
      )
    ],
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.a114150b5219"), "impulse"),
      port("url", window.RMLI18n.t("ui.auto.0b3b86dcdb32"), "string"),
      port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "string")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("response", window.RMLI18n.t("ui.auto.422d0d9f4213"), "httpResponse"),
      port("status", window.RMLI18n.t("ui.auto.a6bfd4f0b33f"), "int"),
      port("body", window.RMLI18n.t("ui.auto.62148718c6a0"), "string"),
      port("contentType", window.RMLI18n.t("ui.auto.a879b09f8c57"), "string"),
      port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
      port("error", window.RMLI18n.t("ui.auto.c61dcc959d06"), "string")
    ],
    codegenCollect(api) {
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return;
      }
      const token = nodeToken(api);
      const emit = api.emitMethod(
        api.node.id,
        "done"
      );
      const keepResponse = [
        "response",
        "status",
        "body",
        "contentType",
        "success",
        "error"
      ].some(outputId =>
        generatedActionOutputIsUsed(
          api,
          outputId
        )
      );
      ensureHttpRuntime(
        api,
        keepResponse
      );
      if (keepResponse) {
        api.addRuntimeField(
          `${api.node.id}.response`,
          `_httpResponse${token}`,
          window.RMLI18n.t("ui.literal.8b67e5e34605"),
          window.RMLI18n.t("ui.literal.41708101ba15")
        );
      }
      api.addMember(
        `${api.node.id}.send`,
        globalThis.RMLCodeTemplates.text("nodes", "source_030", [token,
quote(
          api,
          api.node.parameters.method || "GET"
        ),
quote(
          api,
          api.node.parameters.contentType ||
            "application/json"
        ),
quote(
          api,
          api.node.parameters.headers || ""
        ),
keepResponse ? `\n        string responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);` : `\n        _ = await response.Content.ReadAsStringAsync().ConfigureAwait(false);`,
keepResponse ? `\n        _httpResponse${token} = new GraphHttpResponse(\n            (int)response.StatusCode,\n            responseBody,\n            response.Content.Headers.ContentType?.ToString() ?? string.Empty,\n            response.IsSuccessStatusCode,\n            string.Empty);` : "",
keepResponse ? `\n        _httpResponse${token} = new GraphHttpResponse(\n            0,\n            string.Empty,\n            string.Empty,\n            false,\n            exception.ToString());` : `\n        _ = exception;`,
emit ? `\n\n    ${emit}();` : ""])
      );
    },
    codegenExpression(api) {
      const field = `_httpResponse${nodeToken(api)}`;
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return api.csDefault(api.type);
      }
      switch (api.portId) {
        case "status":
          return `${field}.StatusCode`;
        case "body":
          return `${field}.Body`;
        case "contentType":
          return `${field}.ContentType`;
        case "success":
          return `${field}.Success`;
        case "error":
          return `${field}.Error`;
        default:
          return field;
      }
    },
    codegenAction(api) {
      return `SendHttp${nodeToken(api)}(${api.input("url").code}, ${api.input("body").code});`;
    }
  });

  registerNode("network.webSocket", {
    title: window.RMLI18n.t("ui.auto.e012b5d7978b"),
    group: window.RMLI18n.t("ui.literal.1e9174855701"),
    symbol: "WS",
    description:
      window.RMLI18n.t("ui.auto.3fb3305a8df3"),
    parameters: [
      pCode(
        "headers",
        window.RMLI18n.t("ui.literal.a30742cd8b79"),
        "",
        window.RMLI18n.t("ui.literal.6431006881cb"),
        5
      )
    ],
    inputs: [
      port("connect", window.RMLI18n.t("ui.auto.5650bfb869c6"), "impulse"),
      port("close", window.RMLI18n.t("ui.auto.cd498abacaca"), "impulse"),
      port("url", window.RMLI18n.t("ui.auto.0b3b86dcdb32"), "string")
    ],
    outputs: [
      port("connected", window.RMLI18n.t("ui.auto.ac272c3ffbff"), "impulse"),
      port("message", window.RMLI18n.t("ui.auto.a6f75acc1be9"), "impulse"),
      port("closed", window.RMLI18n.t("ui.auto.9420c712b87c"), "impulse"),
      port("socket", window.RMLI18n.t("ui.auto.8a4b8308c0ac"), "webSocket"),
      port("text", window.RMLI18n.t("ui.auto.aaa9ba610e69"), "string"),
      port("bytes", window.RMLI18n.t("ui.auto.a6f67c2c496f"), "byteArray"),
      port("isConnected", window.RMLI18n.t("ui.auto.44ff86cb84da"), "bool"),
      port("error", window.RMLI18n.t("ui.auto.c61dcc959d06"), "string")
    ],
    codegenCollect(api) {
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return;
      }
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const connected = api.entryMethod(
        api.node.id,
        "connected"
      );
      const message = api.entryMethod(
        api.node.id,
        "message"
      );
      const closed = api.entryMethod(
        api.node.id,
        "closed"
      );
      const keepText =
        generatedOutputIsUsed(api, "text");
      const keepBytes =
        generatedOutputIsUsed(api, "bytes");
      const keepConnected =
        generatedOutputIsUsed(
          api,
          "isConnected"
        );
      const keepError =
        generatedOutputIsUsed(api, "error");
      if (keepText || keepBytes) {
        api.addUsing("System.IO");
      }
      api.addField(
        `${api.node.id}.socket`,
        `private static ClientWebSocket? _webSocket${token};`
      );
      if (keepText) {
        api.addField(
          `${api.node.id}.text`,
          `private static string _webSocketText${token} = string.Empty;`
        );
      }
      if (keepBytes) {
        api.addField(
          `${api.node.id}.bytes`,
          `private static byte[] _webSocketBytes${token} = Array.Empty<byte>();`
        );
      }
      if (keepConnected) {
        api.addField(
          `${api.node.id}.connected`,
          `private static bool _webSocketConnected${token};`
        );
      }
      if (keepError) {
        api.addField(
          `${api.node.id}.error`,
          `private static string _webSocketError${token} = string.Empty;`
        );
      }
      api.addMember(
        `${api.node.id}.connect`,
        globalThis.RMLCodeTemplates.text("nodes", "source_031", [token,
token,
token,
token,
keepError ? `\n        _webSocketError${token} = string.Empty;` : "",
quote(
          api,
          api.node.parameters.headers || ""
        ),
token,
token,
keepConnected ? `\n        _webSocketConnected${token} = true;` : "",
connected ? `\n        ${connected}();` : "",
token,
keepText || keepBytes ? `\n            using MemoryStream frame = new();` : "",
token,
keepText || keepBytes ? `\n                if (result.Count > 0)\n                {\n                    frame.Write(buffer, 0, result.Count);\n                }` : "",
keepText || keepBytes ? `\n            byte[] messageBytes = frame.ToArray();` : "",
keepBytes ? `\n            _webSocketBytes${token} = messageBytes;` : "",
keepText ? `\n            _webSocketText${token} = result.MessageType == WebSocketMessageType.Text\n                ? Encoding.UTF8.GetString(messageBytes)\n                : string.Empty;` : "",
message ? `\n            ${message}();` : "",
keepError ? `\n        _webSocketError${token} = exception.ToString();` : `\n        _ = exception;`,
keepConnected ? `\n        _webSocketConnected${token} = false;` : "",
closed ? `\n        ${closed}();` : "",
token,
token,
token,
keepError ? `\n        _webSocketError${token} = exception.ToString();` : `\n        _ = exception;`])
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return api.csDefault(api.type);
      }
      switch (api.portId) {
        case "text":
          return `_webSocketText${token}`;
        case "bytes":
          return `_webSocketBytes${token}`;
        case "isConnected":
          return `_webSocketConnected${token}`;
        case "error":
          return `_webSocketError${token}`;
        default:
          return `_webSocket${token}`;
      }
    },
    codegenAction(api) {
      return api.connection.toPort === "close"
        ? `CloseWebSocket${nodeToken(api)}();`
        : `ConnectWebSocket${nodeToken(api)}(${api.input("url").code});`;
    }
  });

  registerNode("network.webSocketSend", {
    title: window.RMLI18n.t("ui.auto.028e9aa4525d"),
    group: window.RMLI18n.t("ui.literal.1e9174855701"),
    symbol: "WS→",
    description:
      window.RMLI18n.t("ui.auto.6dc7a71c04f6"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.a114150b5219"), "impulse"),
      port("socket", window.RMLI18n.t("ui.auto.8a4b8308c0ac"), "webSocket"),
      port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("error", window.RMLI18n.t("ui.auto.c61dcc959d06"), "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      const keepError =
        generatedActionOutputIsUsed(
          api,
          "error"
        );
      if (keepError) {
        api.addRuntimeField(
          `${api.node.id}.error`,
          `_webSocketSendError${token}`,
          "string",
          "string.Empty"
        );
      }
      api.addMember(
        `${api.node.id}.send`,
        globalThis.RMLCodeTemplates.text("nodes", "source_032", [token,
keepError ? `\n        _webSocketSendError${token} = string.Empty;` : "",
keepError ? `\n        _webSocketSendError${token} = exception.ToString();` : `\n        _ = exception;`,
done ? `\n\n    ${done}();` : ""])
      );
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_webSocketSendError${nodeToken(api)}`
      );
    },
    codegenAction(api) {
      return `SendWebSocket${nodeToken(api)}(${api.input("socket").code}, ${api.input("text").code});`;
    }
  });

  registerNode("network.tcpSend", {
    title: window.RMLI18n.t("ui.auto.c9e0a2806742"),
    group: window.RMLI18n.t("ui.literal.1e9174855701"),
    symbol: "TCP",
    description:
      window.RMLI18n.t("ui.auto.1e650f075d72"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.a114150b5219"), "impulse"),
      port("host", window.RMLI18n.t("ui.auto.b172e379f9a5"), "string"),
      port("port", window.RMLI18n.t("ui.auto.324222af5514"), "int"),
      port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("error", window.RMLI18n.t("ui.auto.c61dcc959d06"), "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      const keepError =
        generatedActionOutputIsUsed(
          api,
          "error"
        );
      if (keepError) {
        api.addRuntimeField(
          `${api.node.id}.error`,
          `_tcpError${token}`,
          "string",
          "string.Empty"
        );
      }
      api.addMember(
        `${api.node.id}.send`,
        globalThis.RMLCodeTemplates.text("nodes", "source_033", [token,
keepError ? `\n        _tcpError${token} = string.Empty;` : "",
keepError ? `\n        _tcpError${token} = exception.ToString();` : `\n        _ = exception;`,
done ? `\n\n    ${done}();` : ""])
      );
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_tcpError${nodeToken(api)}`
      );
    },
    codegenAction(api) {
      return `SendTcp${nodeToken(api)}(${api.input("host").code}, ${api.input("port").code}, ${api.input("text").code});`;
    }
  });

  registerNode("network.udpSend", {
    title: window.RMLI18n.t("ui.auto.cce3234f1b73"),
    group: window.RMLI18n.t("ui.literal.1e9174855701"),
    symbol: "UDP",
    description:
      window.RMLI18n.t("ui.auto.9ed3f354f9ae"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.a114150b5219"), "impulse"),
      port("host", window.RMLI18n.t("ui.auto.b172e379f9a5"), "string"),
      port("port", window.RMLI18n.t("ui.auto.324222af5514"), "int"),
      port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("error", window.RMLI18n.t("ui.auto.c61dcc959d06"), "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      const keepError =
        generatedActionOutputIsUsed(
          api,
          "error"
        );
      if (keepError) {
        api.addRuntimeField(
          `${api.node.id}.error`,
          `_udpError${token}`,
          "string",
          "string.Empty"
        );
      }
      api.addMember(
        `${api.node.id}.send`,
        globalThis.RMLCodeTemplates.text("nodes", "source_034", [token,
keepError ? `\n        _udpError${token} = string.Empty;` : "",
keepError ? `\n        _udpError${token} = exception.ToString();` : `\n        _ = exception;`,
done ? `\n\n    ${done}();` : ""])
      );
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_udpError${nodeToken(api)}`
      );
    },
    codegenAction(api) {
      return `SendUdp${nodeToken(api)}(${api.input("host").code}, ${api.input("port").code}, ${api.input("text").code});`;
    }
  });

  registerNode("task.delay", {
    title: window.RMLI18n.t("ui.auto.7516f8f7675b"),
    group: window.RMLI18n.t("ui.literal.6aa5e4a6e67c"),
    symbol: "WAIT",
    description:
      window.RMLI18n.t("ui.auto.82e7bd4dc812"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.603e48dee5e5"), "impulse"),
      port("milliseconds", window.RMLI18n.t("ui.auto.5e89e6c22d7f"), "int")
    ],
    outputs: [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")],
    codegenCollect(api) {
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return;
      }
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addMember(
        `${api.node.id}.delay`,
        `private static async void Delay${token}(int milliseconds)\n{\n    await Task.Delay(Math.Max(0, milliseconds)).ConfigureAwait(false);${done ? `\n    ${done}();` : ""}\n}`
      );
    },
    codegenAction(api) {
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return "";
      }
      return `Delay${nodeToken(api)}(${api.input("milliseconds").code});`;
    }
  });

  registerNode("task.background", {
    title: window.RMLI18n.t("ui.auto.431a918dccd8"),
    group: window.RMLI18n.t("ui.literal.6aa5e4a6e67c"),
    symbol: "BG",
    description:
      window.RMLI18n.t("ui.auto.3e5a1d60671a"),
    inputs: [port("call", window.RMLI18n.t("ui.auto.603e48dee5e5"), "impulse")],
    outputs: [
      port("background", window.RMLI18n.t("ui.auto.d8b7db475509"), "impulse"),
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse")
    ],
    codegenCollect(api) {
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return;
      }
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      const background = api.emitMethod(
        api.node.id,
        "background"
      );
      const completed = api.emitMethod(
        api.node.id,
        "completed"
      );
      api.addMember(
        `${api.node.id}.run`,
        `private static void RunBackground${token}()\n{\n    _ = Task.Run(() =>\n    {${background ? `\n        ${background}();` : ""}\n    }).ContinueWith(_ =>\n    {${completed ? `\n        ${completed}();` : ""}\n    }, TaskScheduler.Default);\n}`
      );
    },
    codegenAction(api) {
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return "";
      }
      return `RunBackground${nodeToken(api)}();`;
    }
  });

  registerNode("task.await", {
    title: window.RMLI18n.t("ui.auto.a67addbc7426"),
    group: window.RMLI18n.t("ui.literal.6aa5e4a6e67c"),
    symbol: "AWAIT",
    description:
      window.RMLI18n.t("ui.auto.90116431f421"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.170a30ff0503"), "impulse"),
      port("task", window.RMLI18n.t("ui.auto.3eec9366cd84"), "task")
    ],
    outputs: [
      port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
      port("faulted", window.RMLI18n.t("ui.auto.d48b9bb3f79e"), "impulse"),
      port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
    ],
    codegenCollect(api) {
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return;
      }
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      const faulted = api.emitMethod(
        api.node.id,
        "faulted"
      );
      const keepException =
        generatedActionOutputIsUsed(
          api,
          "exception"
        );
      if (keepException) {
        api.addRuntimeField(
          `${api.node.id}.exception`,
          `_awaitException${token}`,
          window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
          "null!"
        );
      }
      api.addMember(
        `${api.node.id}.await`,
        globalThis.RMLCodeTemplates.text("nodes", "source_035", [token,
keepException ? `\n        _awaitException${token} = null!;` : "",
done ? `\n        ${done}();` : "",
keepException ? `\n        _awaitException${token} = exception;` : `\n        _ = exception;`,
faulted ? `\n        ${faulted}();` : ""])
      );
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_awaitException${nodeToken(api)}`
      );
    },
    codegenAction(api) {
      if (
        typeof api.isActionReachable ===
          "function" &&
        !api.isActionReachable()
      ) {
        return "";
      }
      return `AwaitTask${nodeToken(api)}(${api.input("task").code});`;
    }
  });

  registerNode("task.completedTask", {
    title: window.RMLI18n.t("ui.auto.300ff68a7983"),
    group: window.RMLI18n.t("ui.literal.6aa5e4a6e67c"),
    symbol: "TASK",
    description: window.RMLI18n.t("ui.auto.2e42818bab25"),
    outputs: [port("task", window.RMLI18n.t("ui.auto.3eec9366cd84"), "task")],
    codegenCollect(api) {
      ensureTaskRuntime(api);
    },
    codegenExpression() {
      return window.RMLI18n.t("ui.literal.669264487aa2");
    }
  });

  registerNode("flow.customEvent", {
    title: window.RMLI18n.t("ui.auto.5ae74bdfe256"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "EV",
    description:
      window.RMLI18n.t("ui.auto.6ddd774925b3"),
    inputs: [port("raise", window.RMLI18n.t("ui.auto.26521c13f3ed"), "impulse")],
    outputs: [port("event", window.RMLI18n.t("ui.auto.9162bc274ebc"), "impulse")],
    codegenAction(api) {
      const emit = api.emit("event");
      return emit ? `${emit}();` : "";
    }
  });

  registerGroup(window.RMLI18n.t("ui.auto.e50d5c54736a"), { after: window.RMLI18n.t("ui.auto.cb9729d42e95") });
  registerGroup(window.RMLI18n.t("ui.literal.51b0613ac049"), { after: window.RMLI18n.t("ui.literal.4bbb632f02fd") });

  const NORMAL_CORE_VALUE_TYPES = [
    "bool",
    "string",
    window.RMLI18n.t("ui.literal.7784ac6f7e85"),
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
    "colorX",
    "object"
  ];

  const NORMAL_DICTIONARY_KEY_TYPES = [
    "string",
    window.RMLI18n.t("ui.literal.7784ac6f7e85"),
    "bool",
    "int",
    "float",
    "double"
  ];

  const NORMAL_CONVERTIBLE_TYPES = [
    "bool",
    "string",
    window.RMLI18n.t("ui.literal.7784ac6f7e85"),
    "int",
    "float",
    "double"
  ];

  const NORMAL_COLLECTION_EXCLUDED_TYPES =
    new Set([
      "impulse",
      "generic",
      "auto",
      "enum",
      "rmlDisplaySlot",
      "rmlConfigurationMenu",
      "rmlConfigurationMenuItem",
      "action"
    ]);

  const NORMAL_COLLECTION_CS_ALIASES =
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
      nint: "System.IntPtr",
      nuint: "System.UIntPtr",
      char: "System.Char",
      float: "System.Single",
      double: "System.Double",
      decimal: "System.Decimal",
      string: "System.String",
      object: "System.Object",
      Uri: "System.Uri"
    });

  const NORMAL_COLLECTION_CS_ALIAS_PATTERN =
    new RegExp(
      `(^|[<,])(${Object.keys(
        NORMAL_COLLECTION_CS_ALIASES
      ).join("|")})(?=$|[>,\\[])`,
      "g"
    );

  let normalCollectionTypeOptionsCache = null;

  function normalSelectOptionValue(option) {
    if (Array.isArray(option)) {
      return String(option[0] ?? "");
    }
    if (
      option &&
      typeof option === "object"
    ) {
      return String(option.value ?? "");
    }
    return String(option ?? "");
  }

  function normalAllowedTypeValues(
    allowed,
    node
  ) {
    const options =
      typeof allowed === "function"
        ? allowed(node)
        : allowed;
    return (Array.isArray(options) ? options : [])
      .map(normalSelectOptionValue)
      .filter(Boolean);
  }

  function normalCollectionCsType(
    type,
    information
  ) {
    return String(
      information?.csType || type || ""
    ).trim();
  }

  function normalCollectionCsTypeKey(value) {
    const source = String(value || "")
      .replace(/global::/g, "")
      .replace(/\s+/g, "")
      .replace(/\?/g, "");
    return source.replace(
      NORMAL_COLLECTION_CS_ALIAS_PATTERN,
      (_match, prefix, alias) =>
        `${prefix}${NORMAL_COLLECTION_CS_ALIASES[alias]}`
    );
  }

  function normalClosedCollectionCsType(value) {
    const source = String(value || "").trim();
    const normalized = source
      .replace(/global::/g, "")
      .replace(/\s+/g, "");
    return Boolean(
      normalized &&
      normalized !== "void" &&
      normalized !== "System.Void" &&
      !/[&*`(){};=]/.test(normalized) &&
      !/(?:^|[<,])(?:T|T[A-Z][A-Za-z0-9_]*)(?=$|[>,\[])/.test(
        normalized
      )
    );
  }

  function normalCollectionEnumType(
    type,
    information
  ) {
    return Boolean(
      information?.enumType === true ||
      String(type || "").startsWith(
        CATALOG_ENUM_TYPE_PREFIX
      ) ||
      (Array.isArray(information?.constraints) &&
        information.constraints.includes(
          "enumOrString"
        ))
    );
  }

  function normalCollectionControlType(
    type,
    information
  ) {
    const csType = normalCollectionCsType(
      type,
      information
    );
    return Boolean(
      NORMAL_COLLECTION_EXCLUDED_TYPES.has(type) ||
      information?.controlType === true ||
      information?.catalogStaticClass === true ||
      information?.genericType === true ||
      information?.openGenericType === true ||
      (Array.isArray(information?.constraints) &&
        information.constraints.includes("delegate")) ||
      /^System\.(?:ReadOnly)?Span</.test(
        csType
      ) ||
      /^(?:System\.)?(?:Action|Func|Predicate|Comparison)(?:<|$)/.test(
        csType
      )
    );
  }

  function normalRegisteredCollectionType(
    type,
    information,
    { preserveUnavailable = false } = {}
  ) {
    if (
      !type ||
      !information ||
      normalCollectionControlType(
        type,
        information
      ) ||
      information.syntheticCollectionType ===
        true ||
      information.syntheticArrayType === true ||
      information.dictionaryType === true ||
      String(type).startsWith("collectList:") ||
      String(type).startsWith("normalArray:") ||
      String(type).startsWith(
        "normalDictionary:"
      ) ||
      (
        information.unavailableApiType ===
          true &&
        !preserveUnavailable
      )
    ) {
      return false;
    }

    const isEnum = normalCollectionEnumType(
      type,
      information
    );
    if (
      information.valueType !== true &&
      !isEnum &&
      !NORMAL_CORE_VALUE_TYPES.includes(type)
    ) {
      return false;
    }

    return normalClosedCollectionCsType(
      normalCollectionCsType(
        type,
        information
      )
    );
  }

  function normalStableDictionaryKeyType(
    type,
    information
  ) {
    if (type === "string" || type === window.RMLI18n.t("ui.literal.7784ac6f7e85")) {
      return true;
    }
    if (
      NORMAL_CORE_VALUE_TYPES.includes(type)
    ) {
      return type !== "object";
    }
    return Boolean(
      normalCollectionEnumType(
        type,
        information
      ) ||
      (
        information?.valueType === true &&
        information?.referenceType !== true &&
        information?.collectionType !== true
      )
    );
  }

  function normalCollectionTypeOption(
    type,
    information,
    existing = false
  ) {
    const csType = normalCollectionCsType(
      type,
      information
    );
    const label = String(
      information?.label || type
    );
    const detail =
      label === csType
        ? label
        : `${label} — ${csType}`;
    return {
      value: type,
      label: existing
        ? `${detail} (existing selection)`
        : detail
    };
  }

  function normalCollectionTypeOptions() {
    const definitions =
      registry.getTypeDefinitions?.() || {};
    const revision = Number(
      window.__RMLNodeDefinitionRevision
    ) || 0;
    const factoryVersion = Number(
      window.__RMLApiNodeFactoryVersion
    ) || 0;

    if (
      normalCollectionTypeOptionsCache &&
      normalCollectionTypeOptionsCache
        .definitions === definitions &&
      normalCollectionTypeOptionsCache
        .revision === revision &&
      normalCollectionTypeOptionsCache
        .factoryVersion === factoryVersion
    ) {
      return normalCollectionTypeOptionsCache;
    }

    const values = [];
    const keys = [];
    const valueCsTypes = new Set();
    const keyCsTypes = new Set();
    const add = (
      target,
      seen,
      type,
      information
    ) => {
      const key = normalCollectionCsTypeKey(
        normalCollectionCsType(
          type,
          information
        )
      );
      if (!key || seen.has(key)) return;
      seen.add(key);
      target.push(
        normalCollectionTypeOption(
          type,
          information
        )
      );
    };

    for (const type of NORMAL_CORE_VALUE_TYPES) {
      const information = definitions[type] || {
        label: type,
        csType: type,
        valueType: true
      };
      add(values, valueCsTypes, type, information);
      if (
        normalStableDictionaryKeyType(
          type,
          information
        )
      ) {
        add(keys, keyCsTypes, type, information);
      }
    }
    for (const type of NORMAL_DICTIONARY_KEY_TYPES) {
      const information = definitions[type] || {
        label: type,
        csType: type,
        valueType: true
      };
      add(keys, keyCsTypes, type, information);
    }

    const registered = Object.entries(definitions)
      .filter(([type, information]) =>
        !NORMAL_CORE_VALUE_TYPES.includes(type) &&
        normalRegisteredCollectionType(
          type,
          information
        )
      )
      .sort((left, right) => {
        const leftGenerated =
          left[1]?.catalogGenerated === true
            ? 1
            : 0;
        const rightGenerated =
          right[1]?.catalogGenerated === true
            ? 1
            : 0;
        return (
          leftGenerated - rightGenerated ||
          normalCollectionCsType(
            left[0],
            left[1]
          ).localeCompare(
            normalCollectionCsType(
              right[0],
              right[1]
            )
          )
        );
      });

    for (const [type, information] of registered) {
      add(values, valueCsTypes, type, information);
      if (
        normalStableDictionaryKeyType(
          type,
          information
        )
      ) {
        add(keys, keyCsTypes, type, information);
      }
    }

    normalCollectionTypeOptionsCache = {
      definitions,
      revision,
      factoryVersion,
      values: Object.freeze(values),
      keys: Object.freeze(keys)
    };
    return normalCollectionTypeOptionsCache;
  }

  function normalCollectionOptionsWithSelection(
    options,
    node,
    key
  ) {
    const selected = String(
      node?.parameters?.[key] || ""
    ).trim();
    if (
      !selected ||
      options.some(
        option =>
          normalSelectOptionValue(option) ===
          selected
      )
    ) {
      return options;
    }

    const information =
      registry.getTypeDefinitions?.()?.[
        selected
      ];
    if (
      !normalRegisteredCollectionType(
        selected,
        information,
        { preserveUnavailable: true }
      )
    ) {
      return options;
    }

    return [
      ...options,
      normalCollectionTypeOption(
        selected,
        information,
        true
      )
    ];
  }

  function normalListValueTypeOptions(node) {
    return normalCollectionOptionsWithSelection(
      normalCollectionTypeOptions().values,
      node,
      "itemType"
    );
  }

  function normalDictionaryKeyTypeOptions(node) {
    return normalCollectionOptionsWithSelection(
      normalCollectionTypeOptions().keys,
      node,
      "keyType"
    );
  }

  function normalDictionaryValueTypeOptions(node) {
    return normalCollectionOptionsWithSelection(
      normalCollectionTypeOptions().values,
      node,
      "dictionaryValueType"
    );
  }

  function normalSelectedType(
    node,
    key = "valueType",
    fallback = "string",
    allowed = NORMAL_CORE_VALUE_TYPES
  ) {
    const candidate = String(
      node?.parameters?.[key] || fallback
    ).trim();
    if (
      typeof allowed === "function" &&
      (
        allowed === normalListValueTypeOptions ||
        allowed ===
          normalDictionaryValueTypeOptions ||
        allowed === normalDictionaryKeyTypeOptions
      )
    ) {
      const information =
        registry.getTypeDefinitions?.()?.[
          candidate
        ];
      const valueAllowed =
        normalRegisteredCollectionType(
          candidate,
          information,
          { preserveUnavailable: true }
        );
      return valueAllowed &&
        (
          allowed !==
            normalDictionaryKeyTypeOptions ||
          normalStableDictionaryKeyType(
            candidate,
            information
          )
        )
          ? candidate
          : fallback;
    }
    const allowedValues =
      normalAllowedTypeValues(
        allowed,
        node
      );
    return allowedValues.includes(candidate)
      ? candidate
      : fallback;
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

  function normalListType(type) {
    return `collectList:${type}`;
  }

  function ensureNormalListType(type) {
    const id = normalListType(type);
    const existing =
      registry.getTypeDefinitions()?.[id];
    if (existing) return id;
    const information =
      normalTypeInformation(type);
    const itemCsType =
      information.csType || type;
    registerType(id, {
      label: `List<${information.label || type}>`,
      short: `${information.short || "T"}[]`,
      color: information.color || "#9da8b4",
      csType:
        `System.Collections.Generic.List<${itemCsType}>`,
      defaultCs:
        `new System.Collections.Generic.List<${itemCsType}>()`,
      referenceType: true,
      valueType: true,
      globalGenericCandidate: false,
      collectionType: true,
      collectorCollection: true,
      syntheticCollectionType: true,
      enumerableElementType: type,
      enumerableElementCsType: itemCsType,
      assignableTo: ["object"],
      constraints: [
        "reference",
        "serializable",
        "enumerable",
        "collectableCollection"
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

  function normalArrayType(type) {
    return `normalArray:${type}`;
  }

  function normalLegacyArrayType(
    itemType,
    information
  ) {
    const key = normalCollectionCsTypeKey(
      normalCollectionCsType(
        itemType,
        information
      )
    );
    return {
      "System.Byte": "byteArray",
      "System.String": "stringArray",
      "System.Object": "objectArray"
    }[key] || "";
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

  function normalMergedAssemblyMetadata(
    ...types
  ) {
    const references = new Map();
    const assemblies = new Map();

    for (const information of types) {
      for (const assembly of [
        ...(Array.isArray(information?.assemblies)
          ? information.assemblies
          : []),
        information?.assembly
      ]) {
        const include = String(
          assembly || ""
        ).trim();
        if (include) {
          assemblies.set(
            include.toLowerCase(),
            include
          );
        }
      }

      for (const reference of
        Array.isArray(
          information?.assemblyReferences
        )
          ? information.assemblyReferences
          : []) {
        const include = String(
          reference?.include || ""
        ).trim();
        if (!include) continue;
        const key = include.toLowerCase();
        const previous = references.get(key);
        references.set(key, {
          include,
          hintPath:
            String(
              reference?.hintPath || ""
            ).trim() ||
            previous?.hintPath ||
            "",
          private:
            reference?.private === true ||
            previous?.private === true
        });
        assemblies.set(key, include);
      }
    }

    return {
      assembly: [...assemblies.values()][0] || "",
      assemblies: [...assemblies.values()],
      assemblyReferences:
        [...references.values()]
    };
  }

  function normalDictionaryType(
    keyType,
    valueType
  ) {
    return `normalDictionary:${keyType}:${valueType}`;
  }

  function ensureNormalDictionaryType(
    keyType,
    valueType
  ) {
    const id = normalDictionaryType(
      keyType,
      valueType
    );
    const existing =
      registry.getTypeDefinitions()?.[id];
    if (existing) return id;
    const keyInformation =
      normalTypeInformation(keyType);
    const valueInformation =
      normalTypeInformation(valueType);
    const keyCsType =
      keyInformation.csType || keyType;
    const valueCsType =
      valueInformation.csType || valueType;
    const assemblyMetadata =
      normalMergedAssemblyMetadata(
        keyInformation,
        valueInformation
      );
    registerType(id, {
      label:
        `Dictionary<${keyInformation.label || keyType}, ${valueInformation.label || valueType}>`,
      short: window.RMLI18n.t("ui.literal.c2aa3e47600d"),
      color: "#7fd6b2",
      csType:
        `System.Collections.Generic.Dictionary<${keyCsType}, ${valueCsType}>`,
      defaultCs:
        `new System.Collections.Generic.Dictionary<${keyCsType}, ${valueCsType}>()`,
      referenceType: true,
      valueType: true,
      globalGenericCandidate: false,
      dictionaryType: true,
      dictionaryKeyType: keyType,
      dictionaryValueType: valueType,
      assignableTo: ["object"],
      constraints: ["reference", "serializable"],
      ...assemblyMetadata
    });
    return id;
  }

  ensureNormalListType("string");
  ensureNormalArrayType("string");
  ensureNormalDictionaryType(
    "string",
    "string"
  );

  function normalVariadicIds(count) {
    return Array.from(
      { length: count },
      (_, index) =>
        index < 26
          ? String.fromCharCode(97 + index)
          : `input${index + 1}`
    );
  }

  function normalStableHash(value) {
    const text = String(value || "");
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }

  const normalGraphTypeByCs = new Map();
  let normalGraphTypeIndexDefinitions = null;
  let normalGraphTypeIndexRevision = -1;
  let normalGraphTypeIndexFactoryVersion = -1;

  function refreshNormalGraphTypeIndex() {
    const definitions =
      registry.getTypeDefinitions();
    const revision = Number(
      window.__RMLNodeDefinitionRevision
    ) || 0;
    const factoryVersion = Number(
      window.__RMLApiNodeFactoryVersion
    ) || 0;

    if (
      definitions ===
        normalGraphTypeIndexDefinitions &&
      revision ===
        normalGraphTypeIndexRevision &&
      factoryVersion ===
        normalGraphTypeIndexFactoryVersion
    ) {
      return;
    }

    normalGraphTypeByCs.clear();
    for (const [graphType, information] of Object.entries(
      definitions
    )) {
      const csType = registry.canonicalCsType(
        information?.csType || ""
      );
      if (csType && !normalGraphTypeByCs.has(csType)) {
        normalGraphTypeByCs.set(csType, graphType);
      }
    }
    normalGraphTypeIndexDefinitions =
      definitions;
    normalGraphTypeIndexRevision =
      revision;
    normalGraphTypeIndexFactoryVersion =
      factoryVersion;
  }

  refreshNormalGraphTypeIndex();

  function ensureNormalExactGraphType(csType) {
    const canonical = registry.canonicalType(csType);
    if (
      canonical &&
      registry.getTypeDefinitions()?.[canonical]
    ) {
      return canonical;
    }
    const normalized = registry.canonicalCsType(csType)
      .replace(/&$/, "");
    refreshNormalGraphTypeIndex();
    if (normalGraphTypeByCs.has(normalized)) {
      return normalGraphTypeByCs.get(normalized);
    }

    const broadType = catalogGraphType(normalized);
    if (broadType) {
      const broadInformation =
        registry.getTypeDefinitions()?.[broadType];
      if (
        normalizedCatalogTypeName(
          broadInformation?.csType || ""
        ) === normalized
      ) {
        normalGraphTypeByCs.set(normalized, broadType);
        return broadType;
      }
    }

    const information =
      CATALOG_TYPE_BY_CS.get(normalized) || null;
    const id = `normalExact:${normalStableHash(normalized)}`;
    const valueType = Boolean(
      information &&
      ["struct", "enum"].includes(
        String(information.kind || "").toLowerCase()
      )
    );
    const references =
      catalogAssemblyReferencesForCsType(normalized);
    registerType(id, {
      label: normalized
        .replace(/^System\./, "")
        .split(".")
        .pop(),
      short: "T",
      color: "#91b9dd",
      csType: normalized,
      defaultCs: "default!",
      referenceType: !valueType,
      valueType: true,
      globalGenericCandidate: false,
      assignableTo: [
        ...(broadType ? [broadType] : []),
        "object"
      ],
      constraints: valueType
        ? ["value", "serializable"]
        : ["reference", "serializable"],
      assembly:
        information?.assembly ||
        references[0]?.include ||
        "",
      assemblies: references.map(reference =>
        reference.include
      ),
      assemblyReferences: references
    });
    normalGraphTypeByCs.set(normalized, id);
    return id;
  }

  function normalClosedDelegateSignature(value) {
    const normalized = normalizedCatalogTypeName(value)
      .replace(/&$/, "");
    if (normalized === "System.Action") {
      return {
        csType: normalized,
        kind: "action",
        argumentCsTypes: [],
        returnCsType: null
      };
    }

    const parsed = catalogGenericTypeParts(normalized);
    if (!parsed || parsed.suffix) return null;
    const supportedHeads = new Set([
      "System.Action",
      "System.Func",
      "System.Predicate",
      "System.Comparison"
    ]);
    if (!supportedHeads.has(parsed.head)) return null;

    const closed = parsed.arguments.every(argument => {
      if (!argument || /&$/.test(argument)) return false;
      if (/^[A-Z][A-Za-z0-9_]*$/.test(argument)) {
        return false;
      }
      return isSafeCSharpTypeExpression(argument);
    });
    if (!closed) return null;

    if (parsed.head === "System.Action") {
      return {
        csType: normalized,
        kind: "action",
        argumentCsTypes: parsed.arguments,
        returnCsType: null
      };
    }
    if (
      parsed.head === "System.Predicate" &&
      parsed.arguments.length === 1
    ) {
      return {
        csType: normalized,
        kind: "predicate",
        argumentCsTypes: parsed.arguments,
        returnCsType: "System.Boolean"
      };
    }
    if (
      parsed.head === "System.Comparison" &&
      parsed.arguments.length === 1
    ) {
      return {
        csType: normalized,
        kind: "comparison",
        argumentCsTypes: [
          parsed.arguments[0],
          parsed.arguments[0]
        ],
        returnCsType: "System.Int32"
      };
    }
    if (
      parsed.head === "System.Func" &&
      parsed.arguments.length >= 1
    ) {
      return {
        csType: normalized,
        kind: "function",
        argumentCsTypes: parsed.arguments.slice(0, -1),
        returnCsType: parsed.arguments.at(-1)
      };
    }
    return null;
  }

  function normalCatalogDelegateSignatures() {
    const values = [];
    const add = value => {
      if (typeof value === "string") values.push(value);
    };
    for (const row of CATALOG_TYPES) {
      for (const constructor of row.constructors || []) {
        for (const parameter of constructor.parameters || []) {
          add(parameter.type);
        }
      }
      for (const method of row.methods || []) {
        add(method.returnType);
        for (const parameter of method.parameters || []) {
          add(parameter.type);
        }
      }
      for (const property of row.properties || []) add(property.type);
      for (const field of row.fields || []) add(field.type);
      for (const event of row.events || []) add(event.handlerType);
    }
    return [...new Map(
      values
        .map(normalClosedDelegateSignature)
        .filter(Boolean)
        .map(signature => [signature.csType, signature])
    ).values()].sort((left, right) =>
      left.csType.localeCompare(right.csType)
    );
  }

  const NORMAL_CATALOG_DELEGATES =
    normalCatalogDelegateSignatures();
  const NORMAL_CATALOG_DELEGATE_BY_CS = new Map(
    NORMAL_CATALOG_DELEGATES.map(signature => [
      signature.csType,
      signature
    ])
  );

  function ensureNormalDelegateGraphType(signature) {
    refreshNormalGraphTypeIndex();
    if (normalGraphTypeByCs.has(signature.csType)) {
      return normalGraphTypeByCs.get(signature.csType);
    }
    const id = `normalDelegate:${normalStableHash(signature.csType)}`;
    registerType(id, {
      label: signature.csType.replace(/^System\./, ""),
      short: window.RMLI18n.t("ui.literal.1b3cb4846951"),
      color: "#e4a7ff",
      csType: signature.csType,
      defaultCs: "null!",
      referenceType: true,
      valueType: false,
      globalGenericCandidate: false,
      assignableTo: ["object"],
      constraints: ["value", "reference", "delegate"]
    });
    normalGraphTypeByCs.set(signature.csType, id);
    return id;
  }

  for (const signature of NORMAL_CATALOG_DELEGATES) {
    for (const argument of signature.argumentCsTypes) {
      ensureNormalExactGraphType(argument);
    }
    if (signature.returnCsType) {
      ensureNormalExactGraphType(signature.returnCsType);
    }
    ensureNormalDelegateGraphType(signature);
  }

  if (NORMAL_CATALOG_DELEGATES.length > 0) {
    const defaultDelegate =
      NORMAL_CATALOG_DELEGATE_BY_CS.has(
        "System.Action<System.String>"
      )
        ? "System.Action<System.String>"
        : NORMAL_CATALOG_DELEGATES[0].csType;

    registerNode("flow.typedCallback", {
      title: window.RMLI18n.t("ui.auto.f5a1e9789893"),
      group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
      symbol: "CALL",
      description:
        window.RMLI18n.t("ui.auto.e4862e614184"),
      parameters: [
        pSelect(
          "delegateType",
          window.RMLI18n.t("ui.literal.4865e901eb5c"),
          NORMAL_CATALOG_DELEGATES.map(
            signature => signature.csType
          ),
          defaultDelegate
        )
      ],
      inputs: [],
      outputs: [
        port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"),
        port(
          "callback",
          window.RMLI18n.t("ui.auto.6e0631a52877"),
          ensureNormalDelegateGraphType(
            NORMAL_CATALOG_DELEGATE_BY_CS.get(defaultDelegate)
          )
        )
      ],
      resolveDefinition(node) {
        const selected =
          NORMAL_CATALOG_DELEGATE_BY_CS.get(
            String(node.parameters?.delegateType || "")
          ) ||
          NORMAL_CATALOG_DELEGATE_BY_CS.get(defaultDelegate);
        return {
          inputs: selected.returnCsType
            ? [
                port(
                  "result",
                  window.RMLI18n.t("ui.auto.54c601d015ec"),
                  ensureNormalExactGraphType(
                    selected.returnCsType
                  )
                )
              ]
            : [],
          outputs: [
            port("body", window.RMLI18n.t("ui.auto.ec672784079b"), "impulse"),
            ...selected.argumentCsTypes.map(
              (argument, index) =>
                port(
                  `argument${index}`,
                  `Argument ${index + 1}`,
                  ensureNormalExactGraphType(argument)
                )
            ),
            port(
              "callback",
              window.RMLI18n.t("ui.auto.6e0631a52877"),
              ensureNormalDelegateGraphType(selected)
            )
          ]
        };
      },
      codegenExpression(api) {
        const selected =
          NORMAL_CATALOG_DELEGATE_BY_CS.get(
            String(api.node.parameters?.delegateType || "")
          ) ||
          NORMAL_CATALOG_DELEGATE_BY_CS.get(defaultDelegate);
        const token = nodeToken(api);
        const argumentIndex =
          String(api.portId || "").match(
            /^argument([0-9]+)$/
          );
        if (argumentIndex) {
          const index = Number(argumentIndex[1]);
          const graphType = ensureNormalExactGraphType(
            selected.argumentCsTypes[index]
          );
          const information = normalTypeInformation(graphType);
          return `ReadGraphExecutionValue<${api.csType(graphType)}>("normal-callback:${token}:${index}", ${information.defaultCs || "default!"})`;
        }

        const body = api.inlineMethod(
          api.node.id,
          "body"
        );
        const parameters = selected.argumentCsTypes.map(
          (argument, index) =>
            `${argument} argument${index}`
        );
        const writes = selected.argumentCsTypes.map(
          (_argument, index) =>
            `WriteGraphExecutionValue("normal-callback:${token}:${index}", argument${index});`
        );
        const statements = [
          "using GraphExecutionScope scope = OpenGraphEntry();",
          ...writes,
          ...(body ? [`${body}();`] : [])
        ];
        if (selected.returnCsType) {
          statements.push(
            `return ${api.input("result").code};`
          );
        }
        return `new ${selected.csType}((${parameters.join(", ")}) =>\n        {\n            ${statements.join("\n            ")}\n        })`;
      }
    });
  }

  function normalSelectedCsType(
    api,
    key = "valueType",
    fallback = "string",
    allowed = NORMAL_CORE_VALUE_TYPES
  ) {
    return api.csType(
      normalSelectedType(
        api.node,
        key,
        fallback,
        allowed
      )
    );
  }

  function normalExactValuePort(
    id,
    label,
    csType
  ) {
    return port(
      id,
      label,
      ensureNormalExactGraphType(csType)
    );
  }

  function normalTextConstant(
    id,
    title,
    symbol,
    csType,
    defaultValue,
    expression,
    help
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
      symbol,
      description: help,
      parameters: [
        pText(
          "value",
          window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
          defaultValue,
          help
        )
      ],
      outputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
      resolveDefinition() {
        return {
          outputs: [
            normalExactValuePort(
              "value",
              window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
              csType
            )
          ]
        };
      },
      codegenExpression(api) {
        return expression(
          api,
          String(
            api.node.parameters?.value ??
              defaultValue
          )
        );
      }
    });
  }

  function normalCharLiteral(value) {
    const character = String(value || "\0").charAt(0);
    return `'\\u${character
      .charCodeAt(0)
      .toString(16)
      .padStart(4, "0")}'`;
  }

  normalTextConstant(
    "constant.character",
    window.RMLI18n.t("ui.literal.4adb5c165cc7"),
    window.RMLI18n.t("ui.literal.49279edf0487"),
    "System.Char",
    "A",
    (_api, value) => normalCharLiteral(value),
    window.RMLI18n.t("ui.literal.4c6998fcc1b8")
  );
  normalTextConstant(
    "constant.guid",
    window.RMLI18n.t("ui.literal.ea9d1f8aab40"),
    window.RMLI18n.t("ui.auto.420b8509c9cf"),
    "System.Guid",
    "00000000-0000-0000-0000-000000000000",
    (api, value) =>
      `new System.Guid("${api.escapeString(value)}")`,
    window.RMLI18n.t("ui.literal.2931e9b76899")
  );
  normalTextConstant(
    "constant.dateTime",
    window.RMLI18n.t("ui.literal.057a210bc0ec"),
    window.RMLI18n.t("ui.literal.8c76abdec41a"),
    "System.DateTime",
    "1970-01-01T00:00:00.0000000Z",
    (api, value) =>
      `System.DateTime.Parse("${api.escapeString(value)}", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind)`,
    window.RMLI18n.t("ui.literal.350e331c21d5")
  );
  normalTextConstant(
    "constant.dateTimeOffset",
    window.RMLI18n.t("ui.literal.f148887eb17c"),
    window.RMLI18n.t("ui.literal.af2693ac1996"),
    "System.DateTimeOffset",
    "1970-01-01T00:00:00.0000000+00:00",
    (api, value) =>
      `System.DateTimeOffset.Parse("${api.escapeString(value)}", System.Globalization.CultureInfo.InvariantCulture, System.Globalization.DateTimeStyles.RoundtripKind)`,
    window.RMLI18n.t("ui.literal.b1a0fc52c90c")
  );
  normalTextConstant(
    "constant.timeSpan",
    window.RMLI18n.t("ui.literal.0e29ea1e8330"),
    window.RMLI18n.t("ui.literal.5820932c51b9"),
    "System.TimeSpan",
    "00:00:00",
    (api, value) =>
      `System.TimeSpan.Parse("${api.escapeString(value)}", System.Globalization.CultureInfo.InvariantCulture)`,
    window.RMLI18n.t("ui.literal.342616f380f4")
  );

  const NORMAL_MATRIX_TYPES = Object.freeze([
    { csType: "Elements.Core.float2x2", label: window.RMLI18n.t("ui.auto.6d63bce18200"), scalarType: "float", dimension: 2 },
    { csType: "Elements.Core.float3x3", label: window.RMLI18n.t("ui.auto.6278636eb592"), scalarType: "float", dimension: 3 },
    { csType: "Elements.Core.float4x4", label: window.RMLI18n.t("ui.auto.a784b2de8fed"), scalarType: "float", dimension: 4 },
    { csType: "Elements.Core.double2x2", label: window.RMLI18n.t("ui.auto.a8882e3879f2"), scalarType: "double", dimension: 2 },
    { csType: "Elements.Core.double3x3", label: window.RMLI18n.t("ui.auto.c509acf61b24"), scalarType: "double", dimension: 3 },
    { csType: "Elements.Core.double4x4", label: window.RMLI18n.t("ui.auto.b37370e79279"), scalarType: "double", dimension: 4 }
  ]);

  const NORMAL_QUATERNION_TYPES = Object.freeze([
    { csType: "Elements.Core.floatQ", label: window.RMLI18n.t("ui.auto.1d23c758957e"), scalarType: "float" },
    { csType: "Elements.Core.doubleQ", label: window.RMLI18n.t("ui.auto.3f1f8ae5f9ea"), scalarType: "double" }
  ]);

  const NORMAL_COLOR_TYPES = Object.freeze([
    { csType: "Elements.Core.color", label: window.RMLI18n.t("ui.auto.22e919e5416d"), scalarCsType: "System.Single", alphaDefault: "1.0f" },
    { csType: "Elements.Core.color32", label: window.RMLI18n.t("ui.auto.88f74913fd63"), scalarCsType: "System.Byte", alphaDefault: "255" }
  ]);

  function normalStructuredOptions(descriptors) {
    return descriptors.map(descriptor => [
      descriptor.csType,
      descriptor.label
    ]);
  }

  function normalStructuredDescriptor(
    node,
    key,
    descriptors
  ) {
    const candidate = String(
      node?.parameters?.[key] || ""
    );
    return descriptors.find(
      descriptor =>
        descriptor.csType === candidate
    ) || descriptors[0];
  }

  function normalMatrixComponents(descriptor) {
    return Array.from(
      { length: descriptor.dimension ** 2 },
      (_, index) => {
        const row = Math.floor(
          index / descriptor.dimension
        );
        const column =
          index % descriptor.dimension;
        return `m${row}${column}`;
      }
    );
  }

  registerNode("value.composeMatrix", {
    title: window.RMLI18n.t("ui.auto.8c0c80a268f1"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "MAT+",
    description:
      window.RMLI18n.t("ui.auto.b0ced20d1e3f"),
    selfContainedSource: true,
    parameters: [
      pSelect(
        "matrixType",
        window.RMLI18n.t("ui.literal.47adefc07b1e"),
        normalStructuredOptions(
          NORMAL_MATRIX_TYPES
        ),
        NORMAL_MATRIX_TYPES[0].csType,
        window.RMLI18n.t("ui.literal.9df944789781"),
        { affectsPorts: true }
      )
    ],
    inputs: [],
    outputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
    resolveDefinition(node) {
      const descriptor =
        normalStructuredDescriptor(
          node,
          "matrixType",
          NORMAL_MATRIX_TYPES
        );
      const components =
        normalMatrixComponents(descriptor);
      return {
        inputs: components.map(component =>
          port(
            component,
            component.toUpperCase(),
            descriptor.scalarType
          )
        ),
        outputs: [
          normalExactValuePort(
            "value",
            window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
            descriptor.csType
          )
        ]
      };
    },
    codegenExpression(api) {
      const descriptor =
        normalStructuredDescriptor(
          api.node,
          "matrixType",
          NORMAL_MATRIX_TYPES
        );
      return `new ${descriptor.csType}(${normalMatrixComponents(descriptor)
        .map(component =>
          api.input(component).code
        )
        .join(", ")})`;
    }
  });

  registerNode("value.decomposeMatrix", {
    title: window.RMLI18n.t("ui.auto.edb47c4c3979"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "MAT−",
    description:
      window.RMLI18n.t("ui.auto.aefa07eb7b00"),
    parameters: [
      pSelect(
        "matrixType",
        window.RMLI18n.t("ui.literal.47adefc07b1e"),
        normalStructuredOptions(
          NORMAL_MATRIX_TYPES
        ),
        NORMAL_MATRIX_TYPES[0].csType,
        window.RMLI18n.t("ui.literal.9df944789781"),
        { affectsPorts: true }
      )
    ],
    inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
    outputs: [],
    resolveDefinition(node) {
      const descriptor =
        normalStructuredDescriptor(
          node,
          "matrixType",
          NORMAL_MATRIX_TYPES
        );
      return {
        inputs: [
          normalExactValuePort(
            "value",
            window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
            descriptor.csType
          )
        ],
        outputs: normalMatrixComponents(
          descriptor
        ).map(component =>
          port(
            component,
            component.toUpperCase(),
            descriptor.scalarType
          )
        )
      };
    },
    codegenCollect(api) {
      ensureNumericVectorRuntime(api);
    },
    codegenExpression(api) {
      const descriptor =
        normalStructuredDescriptor(
          api.node,
          "matrixType",
          NORMAL_MATRIX_TYPES
        );
      return `ReadNumericComponent<${api.csType(descriptor.scalarType)}>(${api.input("value").code}, "${api.portId}")`;
    }
  });

  registerNode("value.composeQuaternion", {
    title: window.RMLI18n.t("ui.auto.4dcb9569c86e"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "QUAT+",
    description:
      window.RMLI18n.t("ui.auto.4a48735b903d"),
    selfContainedSource: true,
    parameters: [
      pSelect(
        "quaternionType",
        window.RMLI18n.t("ui.literal.dbef43256fb7"),
        normalStructuredOptions(
          NORMAL_QUATERNION_TYPES
        ),
        NORMAL_QUATERNION_TYPES[0].csType,
        window.RMLI18n.t("ui.literal.0590cbd9da44"),
        { affectsPorts: true }
      )
    ],
    inputs: [],
    outputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "floatQ")],
    resolveDefinition(node) {
      const descriptor =
        normalStructuredDescriptor(
          node,
          "quaternionType",
          NORMAL_QUATERNION_TYPES
        );
      return {
        inputs: ["x", "y", "z", "w"].map(
          component =>
            port(
              component,
              component.toUpperCase(),
              descriptor.scalarType,
              component === "w"
                ? {
                    defaultCs:
                      descriptor.scalarType === "float"
                        ? "1.0f"
                        : "1.0d"
                  }
                : {}
            )
        ),
        outputs: [
          normalExactValuePort(
            "value",
            window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
            descriptor.csType
          )
        ]
      };
    },
    codegenExpression(api) {
      const descriptor =
        normalStructuredDescriptor(
          api.node,
          "quaternionType",
          NORMAL_QUATERNION_TYPES
        );
      return `new ${descriptor.csType}(${["x", "y", "z", "w"]
        .map(component =>
          api.input(component).code
        )
        .join(", ")})`;
    }
  });

  registerNode("value.decomposeQuaternion", {
    title: window.RMLI18n.t("ui.auto.4f1ec6ca02a6"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "Q−",
    description:
      window.RMLI18n.t("ui.auto.c44889202312"),
    parameters: [
      pSelect(
        "quaternionType",
        window.RMLI18n.t("ui.literal.dbef43256fb7"),
        normalStructuredOptions(
          NORMAL_QUATERNION_TYPES
        ),
        NORMAL_QUATERNION_TYPES[0].csType,
        window.RMLI18n.t("ui.literal.0590cbd9da44"),
        { affectsPorts: true }
      )
    ],
    inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "floatQ")],
    outputs: [],
    resolveDefinition(node) {
      const descriptor =
        normalStructuredDescriptor(
          node,
          "quaternionType",
          NORMAL_QUATERNION_TYPES
        );
      return {
        inputs: [
          normalExactValuePort(
            "value",
            window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
            descriptor.csType
          )
        ],
        outputs: ["x", "y", "z", "w"].map(
          component =>
            port(
              component,
              component.toUpperCase(),
              descriptor.scalarType
            )
        )
      };
    },
    codegenCollect(api) {
      ensureNumericVectorRuntime(api);
    },
    codegenExpression(api) {
      const descriptor =
        normalStructuredDescriptor(
          api.node,
          "quaternionType",
          NORMAL_QUATERNION_TYPES
        );
      return `ReadNumericComponent<${api.csType(descriptor.scalarType)}>(${api.input("value").code}, "${api.portId}")`;
    }
  });

  registerNode("value.composeColor", {
    title: window.RMLI18n.t("ui.auto.d22916bfcbeb"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "RGBA",
    description:
      window.RMLI18n.t("ui.auto.aa9867b575cf"),
    selfContainedSource: true,
    parameters: [
      pSelect(
        "colorType",
        window.RMLI18n.t("ui.literal.be3736c0b48b"),
        normalStructuredOptions(
          NORMAL_COLOR_TYPES
        ),
        NORMAL_COLOR_TYPES[0].csType,
        window.RMLI18n.t("ui.literal.7bb5f22cf8bb"),
        { affectsPorts: true }
      )
    ],
    inputs: [],
    outputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
    resolveDefinition(node) {
      const descriptor =
        normalStructuredDescriptor(
          node,
          "colorType",
          NORMAL_COLOR_TYPES
        );
      const scalarType =
        ensureNormalExactGraphType(
          descriptor.scalarCsType
        );
      return {
        inputs: ["r", "g", "b", "a"].map(
          component =>
            port(
              component,
              component.toUpperCase(),
              scalarType,
              component === "a"
                ? { defaultCs: descriptor.alphaDefault }
                : {}
            )
        ),
        outputs: [
          normalExactValuePort(
            "value",
            window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
            descriptor.csType
          )
        ]
      };
    },
    codegenExpression(api) {
      const descriptor =
        normalStructuredDescriptor(
          api.node,
          "colorType",
          NORMAL_COLOR_TYPES
        );
      return `new ${descriptor.csType}(${["r", "g", "b", "a"]
        .map(component =>
          api.input(component).code
        )
        .join(", ")})`;
    }
  });

  registerNode("value.decomposeColor", {
    title: window.RMLI18n.t("ui.auto.b59ba260e390"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "C−",
    description:
      window.RMLI18n.t("ui.auto.210f02d666b5"),
    parameters: [
      pSelect(
        "colorType",
        window.RMLI18n.t("ui.literal.be3736c0b48b"),
        normalStructuredOptions(
          NORMAL_COLOR_TYPES
        ),
        NORMAL_COLOR_TYPES[0].csType,
        window.RMLI18n.t("ui.literal.7bb5f22cf8bb"),
        { affectsPorts: true }
      )
    ],
    inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
    outputs: [],
    resolveDefinition(node) {
      const descriptor =
        normalStructuredDescriptor(
          node,
          "colorType",
          NORMAL_COLOR_TYPES
        );
      const scalarType =
        ensureNormalExactGraphType(
          descriptor.scalarCsType
        );
      return {
        inputs: [
          normalExactValuePort(
            "value",
            window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
            descriptor.csType
          )
        ],
        outputs: ["r", "g", "b", "a"].map(
          component =>
            port(
              component,
              component.toUpperCase(),
              scalarType
            )
        )
      };
    },
    codegenCollect(api) {
      ensureNumericVectorRuntime(api);
    },
    codegenExpression(api) {
      const descriptor =
        normalStructuredDescriptor(
          api.node,
          "colorType",
          NORMAL_COLOR_TYPES
        );
      return `ReadNumericComponent<${descriptor.scalarCsType}>(${api.input("value").code}, "${api.portId}")`;
    }
  });

  function ensureNormalConversionRuntime(api) {
    api.addUsing("System.Globalization");
    api.addMember(
      "normal-core.conversion.helpers",
      globalThis.RMLCodeTemplates.text("nodes", window.RMLI18n.t("ui.literal.8f1b098ccf89"), [])
    );
  }

  let normalNumericTypeOptionsCache = null;

  function normalNumericTypeOptions() {
    const definitions =
      registry.getTypeDefinitions();
    const revision = Number(
      window.__RMLNodeDefinitionRevision
    ) || 0;
    if (
      normalNumericTypeOptionsCache &&
      normalNumericTypeOptionsCache
        .definitions === definitions &&
      normalNumericTypeOptionsCache
        .revision === revision
    ) {
      return normalNumericTypeOptionsCache
        .options;
    }
    const options = Object.entries(
      definitions
    )
      .filter(([type]) =>
        nodeGraphIsScalarNumericType(type)
      )
      .sort((left, right) =>
        typeLabel(left[0]).localeCompare(
          typeLabel(right[0])
        )
      )
      .map(([type, information]) => [
        type,
        `${information.label || type} — ${information.csType || type}`
      ]);
    normalNumericTypeOptionsCache = {
      definitions,
      revision,
      options: Object.freeze(options)
    };
    return normalNumericTypeOptionsCache.options;
  }

  function normalSelectedNumericType(
    node,
    key,
    fallback = "float"
  ) {
    const candidate = String(
      node?.parameters?.[key] || fallback
    );
    return nodeGraphIsScalarNumericType(
      candidate
    )
      ? candidate
      : fallback;
  }

  registerNode("normal.convertNumeric", {
    title: window.RMLI18n.t("ui.auto.ea1fd04f2eec"),
    group: window.RMLI18n.t("ui.literal.b08eaadf77cf"),
    symbol: "#→#",
    description:
      window.RMLI18n.t("ui.auto.31ea7574d496"),
    parameters: [
      pSelect(
        "inputType",
        window.RMLI18n.t("ui.literal.61bbcbfa889d"),
        normalNumericTypeOptions,
        "float",
        window.RMLI18n.t("ui.literal.ff4c31979e72"),
        { affectsPorts: true }
      ),
      pSelect(
        "outputType",
        window.RMLI18n.t("ui.literal.82fb4ce1cc57"),
        normalNumericTypeOptions,
        "float",
        window.RMLI18n.t("ui.literal.cbab07d2890f"),
        { affectsPorts: true }
      ),
      pSelect(
        "overflowMode",
        window.RMLI18n.t("ui.literal.4da7bc9200c7"),
        [
          ["checked", window.RMLI18n.t("ui.literal.24402ce5ddea")],
          ["unchecked", window.RMLI18n.t("ui.literal.2f24c3c7a14d")]
        ],
        "checked"
      )
    ],
    inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "float")],
    outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "float")],
    resolveDefinition(node) {
      return {
        inputs: [
          port(
            "value",
            window.RMLI18n.t("ui.auto.3b53ce63a0cc"),
            normalSelectedNumericType(
              node,
              "inputType"
            )
          )
        ],
        outputs: [
          port(
            "result",
            window.RMLI18n.t("ui.auto.ca8a16007fd8"),
            normalSelectedNumericType(
              node,
              "outputType"
            )
          )
        ]
      };
    },
    codegenExpression(api) {
      const outputType =
        normalSelectedNumericType(
          api.node,
          "outputType"
        );
      const operation =
        api.node.parameters?.overflowMode ===
          "unchecked"
          ? "unchecked"
          : "checked";
      return `${operation}((${api.csType(outputType)})(${api.input("value").code}))`;
    }
  });

  registerNode("normal.isNull", {
    title: window.RMLI18n.t("ui.auto.ba7f40e40893"),
    group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
    symbol: "∅?",
    description:
      window.RMLI18n.t("ui.auto.1f3367c475fb"),
    inputs: [
      genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "anyValue")
    ],
    outputs: [port("result", window.RMLI18n.t("ui.auto.ba7f40e40893"), "bool")],
    codegenExpression(api) {
      return `(${api.input("value").code} is null)`;
    }
  });

  registerNode("normal.isNotNull", {
    title: window.RMLI18n.t("ui.auto.253c5f296fae"),
    group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
    symbol: "∅!",
    description:
      window.RMLI18n.t("ui.auto.944230da566b"),
    inputs: [
      genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "anyValue")
    ],
    outputs: [port("result", window.RMLI18n.t("ui.auto.4d82da9c1e82"), "bool")],
    codegenExpression(api) {
      return `(${api.input("value").code} is not null)`;
    }
  });

  registerNode("normal.fallbackIfNull", {
    title: window.RMLI18n.t("ui.auto.40fa7a37eb2b"),
    group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
    symbol: "??",
    description:
      window.RMLI18n.t("ui.auto.f80d377ed57b"),
    inputs: [
      genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "reference"),
      genericPort("fallback", window.RMLI18n.t("ui.auto.b2e86b3198d4"), "T", "reference")
    ],
    outputs: [
      genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "reference")
    ],
    codegenExpression(api) {
      return `(${api.input("value").code} ?? ${api.input("fallback").code})`;
    }
  });

  registerNode("normal.tryCast", {
    title: window.RMLI18n.t("ui.auto.c69d58541ee5"),
    group: window.RMLI18n.t("ui.literal.b08eaadf77cf"),
    symbol: "AS?",
    description:
      window.RMLI18n.t("ui.auto.2ad8cabfb3bb"),
    parameters: [
      pSelect(
        "outputType",
        window.RMLI18n.t("ui.literal.82fb4ce1cc57"),
        NORMAL_CORE_VALUE_TYPES,
        "string"
      )
    ],
    inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
    outputs: [
      port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "string"),
      port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool")
    ],
    resolveDefinition(node) {
      const type = normalSelectedType(
        node,
        "outputType",
        "string"
      );
      return {
        outputs: [
          port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), type),
          port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool")
        ]
      };
    },
    codegenCollect(api) {
      ensureNormalConversionRuntime(api);
    },
    codegenExpression(api) {
      const csType = normalSelectedCsType(
        api,
        "outputType",
        "string"
      );
      const value = api.input("value").code;
      return api.portId === "success"
        ? `NormalTryCast<${csType}>(${value}, out _)`
        : `NormalCastOrDefault<${csType}>(${value})`;
    }
  });

  function registerNormalTryParse(
    id,
    title,
    symbol,
    types,
    fallback
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.b08eaadf77cf"),
      symbol,
      description:
        window.RMLI18n.t("ui.auto.70ce3241fb00"),
      parameters: [
        pSelect(
          "outputType",
          window.RMLI18n.t("ui.literal.82fb4ce1cc57"),
          types,
          fallback
        )
      ],
      inputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
      outputs: [
        port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), fallback),
        port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
        port("error", window.RMLI18n.t("ui.auto.c61dcc959d06"), "string")
      ],
      resolveDefinition(node) {
        const type = normalSelectedType(
          node,
          "outputType",
          fallback,
          types
        );
        return {
          outputs: [
            port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), type),
            port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
            port("error", window.RMLI18n.t("ui.auto.c61dcc959d06"), "string")
          ]
        };
      },
      codegenCollect(api) {
        ensureNormalConversionRuntime(api);
        const csType = normalSelectedCsType(
          api,
          "outputType",
          fallback,
          types
        );
        const token = nodeToken(api);
        api.addField(
          `${api.node.id}.tryParseCache`,
          `private static readonly object _normalTryParseLock${token} = new();
private static string? _normalTryParseText${token};
private static ${csType} _normalTryParseResult${token} = default!;
private static bool _normalTryParseSuccess${token};
private static string _normalTryParseError${token} = string.Empty;
private static bool _normalTryParseHasValue${token};`
        );
        api.addMember(
          `${api.node.id}.tryParseCached`,
          `private static void EnsureNormalTryParse${token}(string? text)
{
    string normalized = text ?? string.Empty;
    lock (_normalTryParseLock${token})
    {
        if (_normalTryParseHasValue${token} &&
            string.Equals(_normalTryParseText${token}, normalized, StringComparison.Ordinal))
        {
            return;
        }

        _normalTryParseSuccess${token} = NormalTryConvert<${csType}>(normalized, out _normalTryParseResult${token});
        _normalTryParseError${token} = _normalTryParseSuccess${token}
            ? string.Empty
            : NormalConversionError<${csType}>(normalized);
        _normalTryParseText${token} = normalized;
        _normalTryParseHasValue${token} = true;
    }
}
private static ${csType} GetNormalTryParseResult${token}(string? text)
{
    EnsureNormalTryParse${token}(text);
    return _normalTryParseResult${token};
}
private static bool GetNormalTryParseSuccess${token}(string? text)
{
    EnsureNormalTryParse${token}(text);
    return _normalTryParseSuccess${token};
}
private static string GetNormalTryParseError${token}(string? text)
{
    EnsureNormalTryParse${token}(text);
    return _normalTryParseError${token};
}`
        );
      },
      codegenExpression(api) {
        const token = nodeToken(api);
        const value = api.input("text").code;
        const selected = api.portId === "success"
          ? `_normalTryParseSuccess${token}`
          : api.portId === "error"
            ? `_normalTryParseError${token}`
            : `_normalTryParseResult${token}`;
        const getter = api.portId === "success"
          ? `GetNormalTryParseSuccess${token}`
          : api.portId === "error"
            ? `GetNormalTryParseError${token}`
            : `GetNormalTryParseResult${token}`;
        return `${getter}(${value})`;
      }
    });
  }

  registerNormalTryParse(
    "normal.tryParseNumber",
    window.RMLI18n.t("ui.literal.8783300ec213"),
    "#?",
    ["int", "float", "double"],
    "int"
  );
  registerNormalTryParse(
    "normal.tryParseBoolean",
    window.RMLI18n.t("ui.literal.45d83b57e1c2"),
    "B?",
    ["bool"],
    "bool"
  );

  registerNode("normal.tryConvertValue", {
    title: window.RMLI18n.t("ui.auto.c3fb8b01c1dd"),
    group: window.RMLI18n.t("ui.literal.b08eaadf77cf"),
    symbol: "→?",
    description:
      window.RMLI18n.t("ui.auto.2d4751eac6aa"),
    parameters: [
      pSelect(
        "outputType",
        window.RMLI18n.t("ui.literal.82fb4ce1cc57"),
        NORMAL_CONVERTIBLE_TYPES,
        "string"
      )
    ],
    inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
    outputs: [
      port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "string"),
      port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
      port("error", window.RMLI18n.t("ui.auto.c61dcc959d06"), "string")
    ],
    resolveDefinition(node) {
      const type = normalSelectedType(
        node,
        "outputType",
        "string",
        NORMAL_CONVERTIBLE_TYPES
      );
      return {
        outputs: [
          port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), type),
          port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
          port("error", window.RMLI18n.t("ui.auto.c61dcc959d06"), "string")
        ]
      };
    },
    codegenCollect(api) {
      ensureNormalConversionRuntime(api);
    },
    codegenExpression(api) {
      const csType = normalSelectedCsType(
        api,
        "outputType",
        "string",
        NORMAL_CONVERTIBLE_TYPES
      );
      const value = api.input("value").code;
      return api.portId === "success"
        ? `NormalTryConvert<${csType}>(${value}, out _)`
        : api.portId === "error"
          ? `NormalConversionError<${csType}>(${value})`
        : `NormalConvertOrDefault<${csType}>(${value})`;
    }
  });

  const runtimeFamilyVariadicIds = definition =>
    (definition?.inputs || []).map(specification => specification.id);

  const runtimeFamilyReduce = (api, helper) => {
    const ids = runtimeFamilyVariadicIds(api.definition);
    let expression = api.input(ids[0]).code;
    for (let index = 1; index < ids.length; index += 1) {
      expression = `${helper}<${api.csType(api.resolvedType(api.node, api.definition.outputs[0]) || "float")}>(${expression}, ${api.input(ids[index]).code})`;
    }
    return expression;
  };

  registerNode("math.operation", {
    title: window.RMLI18n.t("ui.auto.24014e09696d"),
    group: window.RMLI18n.t("ui.literal.3edf0df49942"),
    symbol: "±×",
    description: window.RMLI18n.t("ui.auto.f020b2fb933b"),
    parameters: [
      pSelect("operation", "Operation", [["add", window.RMLI18n.t("ui.auto.0889f8cb2970")], ["subtract", window.RMLI18n.t("ui.auto.dadd70539398")], ["multiply", window.RMLI18n.t("ui.auto.c7edc88b8ac6")], ["divide", window.RMLI18n.t("ui.auto.8a3e0ae3d320")], ["modulo", window.RMLI18n.t("ui.auto.2d36fe43e175")], ["power", window.RMLI18n.t("ui.literal.7548ab52c3d1")], ["minimum", window.RMLI18n.t("ui.auto.0662023736a9")], ["maximum", window.RMLI18n.t("ui.auto.5942fa7b274b")]], "add", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })
    ],
    inputs: [
      genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "arithmetic"),
      genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "arithmetic")
    ],
    outputs: [genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "arithmetic")],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "arithmetic")
    },
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "add");
      const information = {
        add: [window.RMLI18n.t("ui.auto.0889f8cb2970"), "+", "arithmetic", true],
        subtract: [window.RMLI18n.t("ui.auto.dadd70539398"), "−", "arithmetic", false],
        multiply: [window.RMLI18n.t("ui.auto.c7edc88b8ac6"), "×", "arithmetic", true],
        divide: [window.RMLI18n.t("ui.auto.8a3e0ae3d320"), "÷", "arithmetic", false],
        modulo: [window.RMLI18n.t("ui.auto.2d36fe43e175"), "%", "scalar", false],
        power: [window.RMLI18n.t("ui.literal.7548ab52c3d1"), "xʸ", "double", false],
        minimum: [window.RMLI18n.t("ui.auto.0662023736a9"), "min", "scalar", true],
        maximum: [window.RMLI18n.t("ui.auto.5942fa7b274b"), "max", "scalar", true]
      }[operation] || [window.RMLI18n.t("ui.auto.0889f8cb2970"), "+", "arithmetic", true];
      const constraint = information[2];
      const inputs = constraint === "double"
        ? [port("a", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "double"), port("b", window.RMLI18n.t("ui.auto.cf32d61433d2"), "double")]
        : [genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", constraint), genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", constraint)];
      const outputs = constraint === "double"
        ? [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "double")]
        : [genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", constraint)];
      return {
        title: `Math · ${information[0]}`,
        symbol: information[1],
        inputs,
        outputs,
        variadicInputs: information[3]
          ? { minimum: 2, defaultCount: 2, maximum: 64, preserveAB: true, template: inputs[0] }
          : null
      };
    },
    codegenExpression(api) {
      const operation = String(api.node.parameters?.operation || "add");
      if (operation === "power") return `Math.Pow(${api.input("a").code}, ${api.input("b").code})`;
      if (operation === "modulo") return `(${api.input("a").code} % ${api.input("b").code})`;
      if (operation === "subtract") return `GraphSubtract<${api.csType(api.resolvedType(api.node, api.definition.outputs[0]) || "float")}>(${api.input("a").code}, ${api.input("b").code})`;
      if (operation === "divide") return `GraphDivide<${api.csType(api.resolvedType(api.node, api.definition.outputs[0]) || "float")}>(${api.input("a").code}, ${api.input("b").code})`;
      return runtimeFamilyReduce(api, { add: window.RMLI18n.t("ui.literal.22e565ba78e0"), multiply: window.RMLI18n.t("ui.literal.ed798eb4ed83"), minimum: window.RMLI18n.t("ui.literal.b6c728c15171"), maximum: window.RMLI18n.t("ui.literal.d3ec433b7de8") }[operation] || window.RMLI18n.t("ui.literal.22e565ba78e0"));
    },
    previewEvaluate({ node, definition, type, input, known, unknown }) {
      const operation = String(node.parameters?.operation || "add");
      const ids = runtimeFamilyVariadicIds(definition);
      const values = ids.map(id => input(id));
      if (values.some(value => !value.known)) return unknown(type, values.find(value => !value.known)?.reason || window.RMLI18n.t("ui.literal.03ecf1df6293"));
      const apply = (left, right, callback) => Array.isArray(left)
        ? left.map((value, index) => callback(value, Array.isArray(right) ? right[index] : right))
        : callback(left, right);
      const callback = {
        add: (a, b) => a + b, subtract: (a, b) => a - b,
        multiply: (a, b) => a * b, divide: (a, b) => b === 0 ? Number.NaN : a / b,
        modulo: (a, b) => a % b, power: Math.pow, minimum: Math.min, maximum: Math.max
      }[operation] || ((a, b) => a + b);
      return known(type, values.slice(1).reduce((result, value) => apply(result, value.value, callback), values[0].value));
    }
  });

  registerNode("math.unaryOperation", {
    title: window.RMLI18n.t("ui.auto.3ed00d977115"),
    group: window.RMLI18n.t("ui.literal.3edf0df49942"),
    symbol: "ƒx",
    parameters: [pSelect("operation", window.RMLI18n.t("ui.literal.430d32076eb2"), [["negate", window.RMLI18n.t("ui.auto.f5150d45f664")], ["absolute", window.RMLI18n.t("ui.auto.f9bd979c38ca")], ["squareRoot", window.RMLI18n.t("ui.literal.8743ae2bde50")], ["round", window.RMLI18n.t("ui.literal.ec7b59833520")], ["floor", window.RMLI18n.t("ui.literal.7db82f74092f")], ["ceiling", window.RMLI18n.t("ui.literal.e29db923e25b")]], "negate", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })],
    inputs: [genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "arithmetic")],
    outputs: [genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "arithmetic")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "negate");
      const information = {
        negate: [window.RMLI18n.t("ui.auto.f5150d45f664"), "±", "arithmetic"], absolute: [window.RMLI18n.t("ui.auto.f9bd979c38ca"), "|x|", "scalar"],
        squareRoot: [window.RMLI18n.t("ui.literal.8743ae2bde50"), "√", "double"], round: [window.RMLI18n.t("ui.literal.ec7b59833520"), "≈", "double"],
        floor: [window.RMLI18n.t("ui.literal.7db82f74092f"), "⌊x⌋", "double"], ceiling: [window.RMLI18n.t("ui.literal.e29db923e25b"), "⌈x⌉", "double"]
      }[operation] || [window.RMLI18n.t("ui.auto.f5150d45f664"), "±", "arithmetic"];
      return information[2] === "double"
        ? { title: `Unary Math · ${information[0]}`, symbol: information[1], inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "double")], outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "double")] }
        : { title: `Unary Math · ${information[0]}`, symbol: information[1], inputs: [genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", information[2])], outputs: [genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", information[2])] };
    },
    codegenExpression(api) {
      const operation = String(api.node.parameters?.operation || "negate");
      const value = api.input("value").code;
      if (["squareRoot", "round", "floor", "ceiling"].includes(operation)) {
        return `Math.${{ squareRoot: window.RMLI18n.t("ui.literal.6bbb118b3601"), round: window.RMLI18n.t("ui.literal.ec7b59833520"), floor: window.RMLI18n.t("ui.literal.7db82f74092f"), ceiling: window.RMLI18n.t("ui.literal.e29db923e25b") }[operation]}(${value})`;
      }
      const type = api.csType(api.resolvedType(api.node, api.definition.outputs[0]) || "float");
      return `${operation === "absolute" ? window.RMLI18n.t("ui.literal.31dcac50081c") : window.RMLI18n.t("ui.literal.16ae669e1905")}<${type}>(${value})`;
    },
    previewEvaluate({ node, type, input, known, unknown }) {
      const value = input("value");
      if (!value.known) return unknown(type, value.reason);
      const operation = String(node.parameters?.operation || "negate");
      const callback = { negate: value => -value, absolute: Math.abs, squareRoot: Math.sqrt, round: Math.round, floor: Math.floor, ceiling: Math.ceil }[operation] || (value => -value);
      return known(type, Array.isArray(value.value) ? value.value.map(callback) : callback(value.value));
    }
  });

  registerNode("logic.compare", {
    title: window.RMLI18n.t("ui.auto.a5a20db782e6"),
    group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
    symbol: "≶",
    parameters: [pSelect("operation", window.RMLI18n.t("ui.literal.2dfcf898a3bd"), [["equal", window.RMLI18n.t("ui.auto.ec574012f30c")], ["notEqual", window.RMLI18n.t("ui.literal.7531cdd8037e")], ["greater", window.RMLI18n.t("ui.literal.c0c7d8111372")], ["greaterOrEqual", window.RMLI18n.t("ui.literal.233c5f00740e")], ["less", window.RMLI18n.t("ui.literal.526cb7425ab8")], ["lessOrEqual", window.RMLI18n.t("ui.literal.ab5e1b057dbc")]], "equal", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })],
    inputs: [genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "value"), genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "value")],
    outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "equal");
      const ordered = !["equal", "notEqual"].includes(operation);
      const info = { equal: [window.RMLI18n.t("ui.auto.ec574012f30c"), "="], notEqual: ["Not Equal", "≠"], greater: ["Greater", ">"], greaterOrEqual: ["Greater or Equal", "≥"], less: ["Less", "<"], lessOrEqual: ["Less or Equal", "≤"] }[operation] || ["Equal", "="];
      return { title: `Compare · ${info[0]}`, symbol: info[1], inputs: [genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", ordered ? "ordered" : "value"), genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", ordered ? "ordered" : "value")] };
    },
    codegenCollect(api) { api.addUsing("System.Collections.Generic"); },
    codegenExpression(api) {
      const operation = String(api.node.parameters?.operation || "equal");
      const a = api.input("a").code;
      const b = api.input("b").code;
      if (["equal", "notEqual"].includes(operation)) {
        const type = api.csType(api.resolvedType(api.node, api.definition.inputs[0]) || "object");
        const equal = `EqualityComparer<${type}>.Default.Equals(${a}, ${b})`;
        return operation === "notEqual" ? `!${equal}` : equal;
      }
      return `(${a} ${{ greater: ">", greaterOrEqual: ">=", less: "<", lessOrEqual: "<=" }[operation]} ${b})`;
    },
    previewEvaluate({ node, input, known, unknown }) {
      const a = input("a"), b = input("b");
      if (!a.known || !b.known) return unknown("bool", a.reason || b.reason);
      const operation = String(node.parameters?.operation || "equal");
      return known("bool", { equal: () => a.value === b.value, notEqual: () => a.value !== b.value, greater: () => a.value > b.value, greaterOrEqual: () => a.value >= b.value, less: () => a.value < b.value, lessOrEqual: () => a.value <= b.value }[operation]());
    }
  });

  registerNode("logic.booleanOperation", {
    title: window.RMLI18n.t("ui.auto.f789ce8543f8"),
    group: window.RMLI18n.t("ui.literal.3d52a6d8fedc"),
    symbol: "⊕",
    parameters: [pSelect("operation", window.RMLI18n.t("ui.literal.430d32076eb2"), [["and", window.RMLI18n.t("ui.auto.ac4af5684ec1")], ["or", "OR"], ["xor", window.RMLI18n.t("ui.literal.04e41391d608")], ["not", window.RMLI18n.t("ui.auto.8ab204a0ee16")]], "and", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })],
    inputs: [port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "bool"), port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "bool")],
    outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")],
    variadicInputs: { minimum: 2, defaultCount: 2, maximum: 64, preserveAB: true, template: port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "bool") },
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "and");
      const info = { and: [window.RMLI18n.t("ui.auto.ac4af5684ec1"), "∧"], or: ["OR", "∨"], xor: ["XOR", "⊕"], not: ["NOT", "¬"] }[operation] || ["AND", "∧"];
      return operation === "not"
        ? { title: `Boolean · ${info[0]}`, symbol: info[1], inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "bool")], variadicInputs: null }
        : { title: `Boolean · ${info[0]}`, symbol: info[1], inputs: [port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "bool"), port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "bool")], variadicInputs: { minimum: 2, defaultCount: 2, maximum: 64, preserveAB: true, template: port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "bool") } };
    },
    codegenExpression(api) {
      const operation = String(api.node.parameters?.operation || "and");
      if (operation === "not") return `(!${api.input("value").code})`;
      const separator = { and: " && ", or: " || ", xor: " ^ " }[operation] || " && ";
      return `(${runtimeFamilyVariadicIds(api.definition).map(id => api.input(id).code).join(separator)})`;
    },
    previewEvaluate({ node, definition, input, known, unknown }) {
      const operation = String(node.parameters?.operation || "and");
      if (operation === "not") { const value = input("value"); return value.known ? known("bool", !value.value) : unknown("bool", value.reason); }
      const values = runtimeFamilyVariadicIds(definition).map(id => input(id));
      if (values.some(value => !value.known)) return unknown("bool", values.find(value => !value.known)?.reason);
      return known("bool", operation === "and" ? values.every(value => Boolean(value.value)) : operation === "or" ? values.some(value => Boolean(value.value)) : values.reduce((result, value) => result !== Boolean(value.value), false));
    }
  });

  registerNode("text.concat", {
    title: window.RMLI18n.t("ui.auto.0ed4c804276f"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "TXT+",
    description:
      window.RMLI18n.t("ui.auto.0f22d7fe9c55"),
    inputs: [
      port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "string"),
      port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "string")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "string")
    },
    outputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
    codegenExpression(api) {
      const count = Math.max(
        2,
        Math.min(
          64,
          Number(api.node.parameters?.variadicInputCount) || 2
        )
      );
      return `string.Concat(${normalVariadicIds(count).map(id => api.input(id).code).join(", ")})`;
    }
  });

  registerNode("text.format", {
    title: window.RMLI18n.t("ui.auto.df473fd5d0f0"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "{0}",
    description:
      window.RMLI18n.t("ui.auto.8ac937704418"),
    inputs: [
      port("format", window.RMLI18n.t("ui.auto.50e8889a5713"), "string"),
      port("a", window.RMLI18n.t("ui.auto.0d8770f3e86e"), "object"),
      port("b", window.RMLI18n.t("ui.auto.eeb0547595bc"), "object")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 32,
      preserved: 1,
      template: port("a", window.RMLI18n.t("ui.auto.0d8770f3e86e"), "object")
    },
    outputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
    codegenCollect(api) {
      api.addUsing("System.Globalization");
    },
    codegenExpression(api) {
      const count = Math.max(
        2,
        Math.min(
          32,
          Number(api.node.parameters?.variadicInputCount) || 2
        )
      );
      const values = normalVariadicIds(count)
        .map(id => api.input(id).code)
        .join(", ");
      return `string.Format(CultureInfo.InvariantCulture, ${api.input("format").code}, new object?[] { ${values} })`;
    }
  });

  registerNode("text.length", {
    title: window.RMLI18n.t("ui.auto.22a362db82fe"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "LEN",
    inputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
    outputs: [port("length", window.RMLI18n.t("ui.auto.615131be5809"), "int")],
    codegenExpression(api) {
      return `(${api.input("text").code} ?? string.Empty).Length`;
    }
  });

  function normalStringComparison(api) {
    const comparison = String(
      api.node.parameters?.comparison || "ordinal"
    );
    return comparison === "ordinalIgnoreCase"
      ? window.RMLI18n.t("ui.literal.a5b18903ef5d")
      : window.RMLI18n.t("ui.literal.08b6726fb8fa");
  }

  registerNode("text.matchOperation", {
    title: window.RMLI18n.t("ui.auto.75d180d51272"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "TXT?",
    parameters: [
      pSelect("operation", window.RMLI18n.t("ui.literal.430d32076eb2"), [["contains", window.RMLI18n.t("ui.auto.cd3e9820f872")], ["startsWith", window.RMLI18n.t("ui.literal.88f9201d41bb")], ["endsWith", window.RMLI18n.t("ui.literal.a30da6d526aa")]], "contains", "", { affectsPorts: true, affectsNode: true, commitImmediately: true }),
      pSelect("comparison", window.RMLI18n.t("ui.literal.2dfcf898a3bd"), ["ordinal", "ordinalIgnoreCase"], "ordinal")
    ],
    inputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string"), port("value", window.RMLI18n.t("ui.auto.442c5c6daf52"), "string")],
    outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "contains");
      const info = { contains: [window.RMLI18n.t("ui.auto.cd3e9820f872"), "⊃"], startsWith: ["Starts With", "A…"], endsWith: ["Ends With", "…Z"] }[operation] || ["Contains", "⊃"];
      return { title: `Text Match · ${info[0]}`, symbol: info[1] };
    },
    codegenExpression(api) {
      const method = { contains: window.RMLI18n.t("ui.auto.cd3e9820f872"), startsWith: window.RMLI18n.t("ui.literal.68a6abdcd006"), endsWith: window.RMLI18n.t("ui.literal.eb2ea672f91d") }[api.node.parameters?.operation] || window.RMLI18n.t("ui.auto.cd3e9820f872");
      return `(${api.input("text").code} ?? string.Empty).${method}(${api.input("value").code} ?? string.Empty, ${normalStringComparison(api)})`;
    }
  });

  registerNode("text.transformOperation", {
    title: window.RMLI18n.t("ui.auto.c80f4fb41f6f"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "TXT→",
    parameters: [
      pSelect("operation", window.RMLI18n.t("ui.literal.430d32076eb2"), [["replace", window.RMLI18n.t("js.presentation.a7cf7b25a703")], ["trim", window.RMLI18n.t("ui.literal.0266abd25371")], ["trimStart", window.RMLI18n.t("ui.literal.ca1a78565a88")], ["trimEnd", window.RMLI18n.t("ui.literal.a75568bb33c9")], ["upper", window.RMLI18n.t("ui.literal.2039134eb09b")], ["lower", window.RMLI18n.t("ui.literal.7dc5d27e866e")]], "replace", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })
    ],
    inputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string"), port("old", window.RMLI18n.t("js.presentation.df251b06eefd"), "string"), port("replacement", window.RMLI18n.t("ui.auto.7f746634850a"), "string")],
    outputs: [port("text", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "string")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "replace");
      const info = { replace: [window.RMLI18n.t("js.presentation.a7cf7b25a703"), "A→B"], trim: [window.RMLI18n.t("ui.literal.0266abd25371"), window.RMLI18n.t("ui.literal.ba3e011804ea")], trimStart: [window.RMLI18n.t("ui.literal.ca1a78565a88"), "▷"], trimEnd: ["Trim End", "◁"], upper: ["Upper Case", "AA"], lower: ["Lower Case", "aa"] }[operation] || ["Replace", "A→B"];
      return {
        title: `Text Transform · ${info[0]}`,
        symbol: info[1],
        inputs: operation === "replace"
          ? [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string"), port("old", window.RMLI18n.t("js.presentation.df251b06eefd"), "string"), port("replacement", window.RMLI18n.t("ui.auto.7f746634850a"), "string")]
          : [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")]
      };
    },
    codegenExpression(api) {
      const operation = String(api.node.parameters?.operation || "replace");
      const text = `(${api.input("text").code} ?? string.Empty)`;
      if (operation === "replace") return `${text}.Replace(${api.input("old").code} ?? string.Empty, ${api.input("replacement").code} ?? string.Empty, StringComparison.Ordinal)`;
      return `${text}.${{ trim: window.RMLI18n.t("ui.literal.0266abd25371"), trimStart: window.RMLI18n.t("ui.literal.0863eeaf5815"), trimEnd: window.RMLI18n.t("ui.literal.788434a4b524"), upper: window.RMLI18n.t("ui.literal.ea1202f20b4d"), lower: window.RMLI18n.t("ui.literal.96a7a9b92475") }[operation] || window.RMLI18n.t("ui.literal.0266abd25371")}()`;
    }
  });

  for (const [id, title, symbol, method] of [
    ["text.contains", window.RMLI18n.t("ui.literal.05c06a319b5d"), "⊃", window.RMLI18n.t("ui.auto.cd3e9820f872")],
    ["text.startsWith", window.RMLI18n.t("ui.literal.cdff11cab5e9"), "A…", window.RMLI18n.t("ui.literal.68a6abdcd006")],
    ["text.endsWith", window.RMLI18n.t("ui.literal.b7de8777e317"), "…Z", window.RMLI18n.t("ui.literal.eb2ea672f91d")]
  ]) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
      symbol,
      hiddenFromPalette: true,
      parameters: [
        pSelect(
          "comparison",
          window.RMLI18n.t("ui.literal.2dfcf898a3bd"),
          ["ordinal", "ordinalIgnoreCase"],
          "ordinal"
        )
      ],
      inputs: [
        port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string"),
        port("value", window.RMLI18n.t("ui.auto.442c5c6daf52"), "string")
      ],
      outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "bool")],
      codegenExpression(api) {
        return `(${api.input("text").code} ?? string.Empty).${method}(${api.input("value").code} ?? string.Empty, ${normalStringComparison(api)})`;
      }
    });
  }

  registerNode("text.replace", {
    title: window.RMLI18n.t("ui.auto.bc173825d984"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "A→B",
    hiddenFromPalette: true,
    inputs: [
      port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string"),
      port("old", window.RMLI18n.t("js.presentation.df251b06eefd"), "string"),
      port("replacement", window.RMLI18n.t("ui.auto.7f746634850a"), "string")
    ],
    outputs: [port("text", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "string")],
    codegenExpression(api) {
      return `(${api.input("text").code} ?? string.Empty).Replace(${api.input("old").code} ?? string.Empty, ${api.input("replacement").code} ?? string.Empty, StringComparison.Ordinal)`;
    }
  });

  registerNode("text.split", {
    title: window.RMLI18n.t("ui.auto.8512936d26d1"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "TXT÷",
    parameters: [
      pBool("removeEmpty", window.RMLI18n.t("ui.literal.7a3990671994"), true),
      pBool("trimEntries", window.RMLI18n.t("ui.literal.a58e2cfa58ad"), true)
    ],
    inputs: [
      port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string"),
      port("separator", window.RMLI18n.t("ui.auto.487ce11fc936"), "string")
    ],
    outputs: [port("parts", window.RMLI18n.t("ui.auto.68458b173f2a"), "stringArray")],
    codegenCollect(api) {
      const token = nodeToken(api);
      const options = [
        api.node.parameters?.removeEmpty === true
          ? window.RMLI18n.t("ui.literal.d00c074348ed")
          : window.RMLI18n.t("ui.literal.58fee5ae0184"),
        api.node.parameters?.trimEntries === true
          ? window.RMLI18n.t("ui.literal.14df5060901f")
          : window.RMLI18n.t("ui.literal.58fee5ae0184")
      ].join(" | ");
      api.addField(`${api.node.id}.splitCache`, `private static readonly object _textSplitLock${token} = new();
private static string? _textSplitText${token};
private static string? _textSplitSeparator${token};
private static string[] _textSplitValue${token} = Array.Empty<string>();
private static bool _textSplitHasValue${token};`);
      api.addMember(`${api.node.id}.splitCached`, `private static string[] SplitTextCached${token}(string? text, string? separator)
{
    string normalizedText = text ?? string.Empty;
    string normalizedSeparator = separator ?? string.Empty;
    lock (_textSplitLock${token})
    {
        if (_textSplitHasValue${token} &&
            string.Equals(_textSplitText${token}, normalizedText, StringComparison.Ordinal) &&
            string.Equals(_textSplitSeparator${token}, normalizedSeparator, StringComparison.Ordinal))
        {
            return _textSplitValue${token};
        }
        _textSplitValue${token} = normalizedText.Split(new[] { normalizedSeparator }, ${options});
        _textSplitText${token} = normalizedText;
        _textSplitSeparator${token} = normalizedSeparator;
        _textSplitHasValue${token} = true;
        return _textSplitValue${token};
    }
}`);
    },
    codegenExpression(api) {
      return `SplitTextCached${nodeToken(api)}(${api.input("text").code}, ${api.input("separator").code})`;
    }
  });

  registerNode("text.join", {
    title: window.RMLI18n.t("ui.auto.3f1c11bd7d7c"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "TXT⋈",
    inputs: [
      port("parts", window.RMLI18n.t("ui.auto.68458b173f2a"), "stringArray"),
      port("separator", window.RMLI18n.t("ui.auto.487ce11fc936"), "string")
    ],
    outputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
    codegenExpression(api) {
      return `string.Join(${api.input("separator").code} ?? string.Empty, ${api.input("parts").code} ?? Array.Empty<string>())`;
    }
  });

  registerNode("text.trim", {
    title: window.RMLI18n.t("ui.auto.d8783726d5e2"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "TRIM",
    hiddenFromPalette: true,
    parameters: [
      pSelect(
        "mode",
        window.RMLI18n.t("ui.auto.af377ede2324"),
        ["both", "start", "end"],
        "both"
      )
    ],
    inputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
    outputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
    codegenExpression(api) {
      const method = {
        start: window.RMLI18n.t("ui.literal.0863eeaf5815"),
        end: window.RMLI18n.t("ui.literal.788434a4b524")
      }[api.node.parameters?.mode] || window.RMLI18n.t("ui.literal.0266abd25371");
      return `(${api.input("text").code} ?? string.Empty).${method}()`;
    }
  });

  registerNode("text.changeCase", {
    title: window.RMLI18n.t("ui.auto.f66f1b10be52"),
    group: window.RMLI18n.t("ui.auto.e50d5c54736a"),
    symbol: "Aa",
    hiddenFromPalette: true,
    parameters: [
      pSelect(
        "mode",
        window.RMLI18n.t("ui.auto.af377ede2324"),
        ["upper", "lower"],
        "upper"
      )
    ],
    inputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
    outputs: [port("text", window.RMLI18n.t("ui.auto.e50d5c54736a"), "string")],
    codegenExpression(api) {
      const method = api.node.parameters?.mode === "lower"
        ? window.RMLI18n.t("ui.literal.96a7a9b92475")
        : window.RMLI18n.t("ui.literal.ea1202f20b4d");
      return `(${api.input("text").code} ?? string.Empty).${method}()`;
    }
  });

  registerNode("flow.switch", {
    title: window.RMLI18n.t("ui.auto.1ff2dc5dcee2"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "SW",
    description:
      window.RMLI18n.t("ui.auto.77f4536f4373"),
    parameters: [
      pNumber("caseCount", window.RMLI18n.t("ui.literal.8efcb6fe47ae"), 3)
    ],
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
      genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "value"),
      genericPort("case1", window.RMLI18n.t("ui.auto.3187b85b4360"), "T", "value"),
      genericPort("case2", window.RMLI18n.t("ui.auto.96ce7cca6cec"), "T", "value")
    ],
    outputs: [
      port("case1", window.RMLI18n.t("ui.auto.3187b85b4360"), "impulse"),
      port("case2", window.RMLI18n.t("ui.auto.96ce7cca6cec"), "impulse"),
      port("default", window.RMLI18n.t("ui.auto.942c1e1b2cef"), "impulse")
    ],
    resolveDefinition(node) {
      const count = Math.max(
        2,
        Math.min(
          16,
          Math.trunc(
            Number(node.parameters?.caseCount) || 3
          )
        )
      );
      return {
        inputs: [
          port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
          genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "value"),
          ...Array.from(
            { length: count },
            (_, index) =>
              genericPort(
                `case${index + 1}`,
                `Case ${index + 1}`,
                "T",
                "value"
              )
          )
        ],
        outputs: [
          ...Array.from(
            { length: count },
            (_, index) =>
              port(
                `case${index + 1}`,
                `Case ${index + 1}`,
                "impulse"
              )
          ),
          port("default", window.RMLI18n.t("ui.auto.942c1e1b2cef"), "impulse")
        ]
      };
    },
    codegenCollect(api) {
      api.addUsing("System.Collections.Generic");
    },
    codegenAction(api) {
      const count = Math.max(
        2,
        Math.min(
          16,
          Math.trunc(
            Number(api.node.parameters?.caseCount) || 3
          )
        )
      );
      const valueSpec = api.definition.inputs.find(
        specification => specification.id === "value"
      );
      const valueType = api.resolvedType(
        api.node,
        valueSpec
      ) || "object";
      const csType = api.csType(valueType);
      const selector = api.input("value").code;
      const branches = [];
      for (let index = 0; index < count; index += 1) {
        const id = `case${index + 1}`;
        const emit = api.emit(id);
        if (!emit) continue;
        branches.push(
          `${branches.length === 0 ? "if" : "else if"} (EqualityComparer<${csType}>.Default.Equals(${selector}, ${api.input(id).code}))\n        {\n            ${emit}();\n        }`
        );
      }
      const fallback = api.emit("default");
      if (fallback) {
        branches.push(
          `${branches.length === 0 ? "" : "else "}{\n            ${fallback}();\n        }`
        );
      }
      return branches.join("\n        ");
    }
  });

  registerNode("math.modulo", {
    title: window.RMLI18n.t("ui.auto.2d36fe43e175"),
    group: window.RMLI18n.t("ui.literal.3edf0df49942"),
    symbol: "%",
    hiddenFromPalette: true,
    inputs: [
      genericPort("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "T", "scalar"),
      genericPort("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "T", "scalar")
    ],
    outputs: [
      genericPort("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "T", "scalar")
    ],
    codegenExpression(api) {
      return `(${api.input("a").code} % ${api.input("b").code})`;
    }
  });

  function registerDoubleMathNode(
    id,
    title,
    symbol,
    renderer,
    inputs = [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "double")],
    hiddenFromPalette = true
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.3edf0df49942"),
      symbol,
      hiddenFromPalette,
      inputs,
      outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "double")],
      codegenExpression: renderer
    });
  }

  registerDoubleMathNode(
    "math.power",
    window.RMLI18n.t("ui.literal.7548ab52c3d1"),
    "xʸ",
    api => `Math.Pow(${api.input("value").code}, ${api.input("exponent").code})`,
    [
      port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "double"),
      port("exponent", window.RMLI18n.t("ui.auto.cf32d61433d2"), "double")
    ]
  );
  registerDoubleMathNode(
    "math.squareRoot",
    window.RMLI18n.t("ui.literal.8743ae2bde50"),
    "√",
    api => `Math.Sqrt(${api.input("value").code})`
  );
  registerDoubleMathNode(
    "math.round",
    window.RMLI18n.t("ui.literal.ec7b59833520"),
    "≈",
    api => `Math.Round(${api.input("value").code})`
  );
  registerDoubleMathNode(
    "math.floor",
    window.RMLI18n.t("ui.literal.7db82f74092f"),
    "⌊x⌋",
    api => `Math.Floor(${api.input("value").code})`
  );
  registerDoubleMathNode(
    "math.ceiling",
    window.RMLI18n.t("ui.literal.e29db923e25b"),
    "⌈x⌉",
    api => `Math.Ceiling(${api.input("value").code})`
  );
  registerDoubleMathNode(
    "math.distance",
    window.RMLI18n.t("ui.literal.03ba461806c7"),
    "↔#",
    api => `Math.Abs(${api.input("a").code} - ${api.input("b").code})`,
    [
      port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "double"),
      port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "double")
    ],
    false
  );
  registerDoubleMathNode(
    "math.remapRange",
    window.RMLI18n.t("ui.literal.6f4e8ed6d571"),
    window.RMLI18n.t("ui.literal.c2aa3e47600d"),
    api => `(${api.input("outputMin").code} + ((${api.input("value").code} - ${api.input("inputMin").code}) / (${api.input("inputMax").code} - ${api.input("inputMin").code})) * (${api.input("outputMax").code} - ${api.input("outputMin").code}))`,
    [
      port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "double"),
      port("inputMin", window.RMLI18n.t("ui.auto.00d790b6d3a7"), "double"),
      port("inputMax", window.RMLI18n.t("ui.auto.2ad7ebc9d40b"), "double"),
      port("outputMin", window.RMLI18n.t("ui.auto.a83d4c9bd1ea"), "double"),
      port("outputMax", window.RMLI18n.t("ui.auto.a0e6843012fb"), "double")
    ],
    false
  );

  registerNode("math.randomRange", {
    title: window.RMLI18n.t("ui.auto.ead6c862bbbc"),
    group: window.RMLI18n.t("ui.literal.3edf0df49942"),
    symbol: "RND",
    parameters: [
      pSelect(
        "valueType",
        window.RMLI18n.t("ui.literal.f451b1b40aae"),
        ["int", "float", "double"],
        "int"
      )
    ],
    inputs: [
      port("minimum", window.RMLI18n.t("ui.auto.0662023736a9"), "int"),
      port("maximum", window.RMLI18n.t("ui.auto.5942fa7b274b"), "int")
    ],
    outputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "int")],
    resolveDefinition(node) {
      const type = normalSelectedType(
        node,
        "valueType",
        "int",
        ["int", "float", "double"]
      );
      return {
        inputs: [
          port("minimum", window.RMLI18n.t("ui.auto.0662023736a9"), type),
          port("maximum", window.RMLI18n.t("ui.auto.5942fa7b274b"), type)
        ],
        outputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), type)]
      };
    },
    codegenExpression(api) {
      const type = normalSelectedType(
        api.node,
        "valueType",
        "int",
        ["int", "float", "double"]
      );
      const minimum = api.input("minimum").code;
      const maximum = api.input("maximum").code;
      if (type === "int") {
        return `(${minimum} >= ${maximum} ? ${minimum} : Random.Shared.Next(${minimum}, ${maximum}))`;
      }
      const expression = `(${minimum} + Random.Shared.NextDouble() * (${maximum} - ${minimum}))`;
      return type === "float"
        ? `(${minimum} >= ${maximum} ? ${minimum} : (float)${expression})`
        : `(${minimum} >= ${maximum} ? ${minimum} : ${expression})`;
    }
  });

  registerNode("time.current", {
    title: window.RMLI18n.t("ui.auto.6144b65852ce"),
    group: window.RMLI18n.t("ui.auto.cb9729d42e95"),
    symbol: "NOW",
    description:
      window.RMLI18n.t("ui.auto.969b5f5b6476"),
    outputs: [
      port("unixMilliseconds", window.RMLI18n.t("ui.auto.bb8bd4c9ac3f"), "double"),
      port("isoUtc", window.RMLI18n.t("ui.auto.817e5e6a7d83"), "string")
    ],
    codegenExpression(api) {
      return api.portId === "isoUtc"
        ? `DateTimeOffset.UtcNow.ToString("O", CultureInfo.InvariantCulture)`
        : `(double)DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()`;
    },
    codegenCollect(api) {
      api.addUsing("System.Globalization");
    }
  });

  registerNode("time.stopwatch", {
    title: window.RMLI18n.t("ui.auto.813f555959b3"),
    group: window.RMLI18n.t("ui.literal.86eff8eb789b"),
    symbol: "⏱",
    inputs: [
      port("start", window.RMLI18n.t("ui.auto.132058a2fda6"), "impulse"),
      port("stop", window.RMLI18n.t("ui.auto.a7d79d1d05da"), "impulse"),
      port("reset", window.RMLI18n.t("ui.auto.37d17c56d708"), "impulse")
    ],
    outputs: [
      port("changed", window.RMLI18n.t("ui.auto.a1009bcfc203"), "impulse"),
      port("elapsedMilliseconds", window.RMLI18n.t("ui.auto.8d35905d3b13"), "double"),
      port("running", window.RMLI18n.t("ui.auto.bb802a61659c"), "bool")
    ],
    codegenCollect(api) {
      api.addUsing("System.Diagnostics");
      const token = nodeToken(api);
      api.addField(
        `${api.node.id}.stopwatch`,
        `private static readonly Stopwatch _normalStopwatch${token} = new();`
      );
    },
    codegenExpression(api) {
      const field = `_normalStopwatch${nodeToken(api)}`;
      return api.portId === "running"
        ? `${field}.IsRunning`
        : `${field}.Elapsed.TotalMilliseconds`;
    },
    codegenAction(api) {
      const field = `_normalStopwatch${nodeToken(api)}`;
      const portId = api.connection?.toPort;
      const operation = portId === "stop"
        ? `${field}.Stop();`
        : portId === "reset"
          ? `${field}.Reset();`
          : `${field}.Start();`;
      const changed = api.emit("changed");
      return `${operation}${changed ? `\n        ${changed}();` : ""}`;
    }
  });

  function normalListNodeParameters(
    fallback = "string",
    allowed = normalListValueTypeOptions
  ) {
    return [
      pSelect(
        "itemType",
        window.RMLI18n.t("ui.literal.9ddc15fd7655"),
        allowed,
        fallback
      )
    ];
  }

  function normalListNodeType(
    node,
    allowed = normalListValueTypeOptions,
    fallback = "string"
  ) {
    const itemType = normalSelectedType(
      node,
      "itemType",
      fallback,
      allowed
    );
    return {
      itemType,
      listType: ensureNormalListType(itemType)
    };
  }

  function normalListResolvedDefinition(
    node,
    extraInputs = [],
    extraOutputs = [],
    options = {}
  ) {
    const information = normalListNodeType(
      node,
      options.allowed || normalListValueTypeOptions,
      options.fallback || "string"
    );
    return {
      inputs: [
        ...(options.action === true
          ? [port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse")]
          : []),
        port("list", window.RMLI18n.t("ui.auto.171d403bb4b3"), information.listType),
        ...extraInputs.map(specification =>
          specification.type === "$item"
            ? port(
                specification.id,
                specification.label,
                information.itemType,
                specification.extra || {}
              )
            : specification
        )
      ],
      outputs: [
        ...(options.action === true
          ? [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")]
          : []),
        ...extraOutputs.map(specification => {
          if (specification.type === "$item") {
            return port(
              specification.id,
              specification.label,
              information.itemType,
              specification.extra || {}
            );
          }
          if (specification.type === "$list") {
            return port(
              specification.id,
              specification.label,
              information.listType,
              specification.extra || {}
            );
          }
          return specification;
        })
      ]
    };
  }

  function normalArrayNodeType(node) {
    const itemType = normalSelectedType(
      node,
      "itemType",
      "string",
      normalListValueTypeOptions
    );
    return {
      itemType,
      arrayType: ensureNormalArrayType(itemType)
    };
  }

  registerNode("collection.createArray", {
    title: window.RMLI18n.t("ui.auto.300f2d836105"),
    group: window.RMLI18n.t("ui.literal.4bbb632f02fd"),
    symbol: "T[]",
    description:
      window.RMLI18n.t("ui.auto.b90fc10c99a5"),
    parameters: normalListNodeParameters(),
    inputs: [
      port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "string"),
      port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), "string")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), "string")
    },
    outputs: [
      port(
        "value",
        window.RMLI18n.t("ui.auto.b482cd0622c5"),
        normalArrayType("string")
      )
    ],
    resolveDefinition(node) {
      const { itemType, arrayType } =
        normalArrayNodeType(node);
      return {
        inputs: [
          port("a", window.RMLI18n.t("ui.auto.33a84c726bd4"), itemType),
          port("b", window.RMLI18n.t("ui.auto.47a451f273f8"), itemType)
        ],
        outputs: [
          port("value", window.RMLI18n.t("ui.auto.b482cd0622c5"), arrayType)
        ],
        variadicInputs: {
          minimum: 2,
          defaultCount: 2,
          maximum: 64,
          preserveAB: true,
          template: port(
            "a",
            window.RMLI18n.t("ui.auto.33a84c726bd4"),
            itemType
          )
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
      const values = normalVariadicIds(count)
        .map(id => api.input(id).code)
        .join(", ");
      return `new ${api.csType(itemType)}[] { ${values} }`;
    }
  });

  registerNode("collection.createList", {
    title: window.RMLI18n.t("ui.auto.58b8ebe8026c"),
    group: window.RMLI18n.t("ui.literal.4bbb632f02fd"),
    symbol: "NEW[]",
    description:
      window.RMLI18n.t("ui.auto.03f93d8d1024"),
    parameters: normalListNodeParameters(),
    inputs: [port("reset", window.RMLI18n.t("ui.auto.37d17c56d708"), "impulse")],
    outputs: [
      port("resetDone", window.RMLI18n.t("ui.auto.8d7896c46763"), "impulse"),
      port("list", window.RMLI18n.t("ui.auto.171d403bb4b3"), normalListType("string")),
      port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
    ],
    resolveDefinition(node) {
      const { listType } = normalListNodeType(node);
      return {
        inputs: [port("reset", window.RMLI18n.t("ui.auto.37d17c56d708"), "impulse")],
        outputs: [
          port("resetDone", window.RMLI18n.t("ui.auto.8d7896c46763"), "impulse"),
          port("list", window.RMLI18n.t("ui.auto.171d403bb4b3"), listType),
          port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
        ]
      };
    },
    codegenCollect(api) {
      const { listType } = normalListNodeType(api.node);
      const csType = api.csType(listType);
      addStatefulField(
        api,
        "normalCreatedList",
        csType,
        `new ${csType}()`
      );
    },
    codegenExpression(api) {
      const field = `_normalCreatedList${nodeToken(api)}`;
      return api.portId === "count"
        ? `${field}.Count`
        : field;
    },
    codegenAction(api) {
      const field = `_normalCreatedList${nodeToken(api)}`;
      const done = api.emit("resetDone");
      return `lock (${field}) { ${field}.Clear(); }${done ? `\n        ${done}();` : ""}`;
    }
  });

  function registerNormalListMutation(
    id,
    title,
    symbol,
    extraInputs,
    actionRenderer,
    options = {}
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.4bbb632f02fd"),
      symbol,
      description: options.description || window.RMLI18n.t("ui.literal.b72565a25e9f"),
      parameters: normalListNodeParameters(
        options.fallback || "string",
        options.allowed || normalListValueTypeOptions
      ).concat(options.parameters || []),
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port("list", window.RMLI18n.t("ui.auto.171d403bb4b3"), normalListType(options.fallback || "string")),
        ...extraInputs.map(specification =>
          specification.type === "$item"
            ? port(
                specification.id,
                specification.label,
                options.fallback || "string"
              )
            : specification
        )
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
        port("list", window.RMLI18n.t("ui.auto.171d403bb4b3"), normalListType(options.fallback || "string")),
        port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
        port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
      ],
      resolveDefinition(node) {
        return normalListResolvedDefinition(
          node,
          extraInputs,
          [
            { id: "list", label: window.RMLI18n.t("ui.auto.171d403bb4b3"), type: "$list" },
            port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
            port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
          ],
          {
            action: true,
            fallback: options.fallback || "string",
            allowed: options.allowed || normalListValueTypeOptions
          }
        );
      },
      codegenCollect(api) {
        if (
          generatedActionOutputIsUsed(
            api,
            "success"
          )
        ) {
          addStatefulField(
            api,
            `${id.replace(/[^A-Za-z0-9]/g, "")}Success`,
            "bool",
            "false"
          );
        }
      },
      codegenExpression(api) {
        const token = nodeToken(api);
        const list = api.input("list").code;
        if (api.portId === "success") {
          return generatedActionOutputExpression(
            api,
            `_${id.replace(/[^A-Za-z0-9]/g, "")}Success${token}`
          );
        }
        if (api.portId === "count") {
          return `${list}.Count`;
        }
        return list;
      },
      codegenAction(api) {
        const token = nodeToken(api);
        const success =
          generatedActionOutputIsUsed(
            api,
            "success"
          )
            ? `_${id.replace(/[^A-Za-z0-9]/g, "")}Success${token}`
            : "";
        const list = api.input("list").code;
        const action = actionRenderer(
          api,
          list,
          success
        );
        const done = api.emit("done");
        return `${action}${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerNormalListMutation(
    "collection.addItem",
    window.RMLI18n.t("ui.literal.b34b55b94101"),
    "+[]",
    [{ id: "value", label: window.RMLI18n.t("ui.auto.3b53ce63a0cc"), type: "$item" }],
    (api, list, success) =>
      `lock (${list}) { ${list}.Add(${api.input("value").code});${success ? ` ${success} = true;` : ""} }`
  );
  registerNormalListMutation(
    "collection.insertItem",
    window.RMLI18n.t("ui.literal.52722918a021"),
    window.RMLI18n.t("ui.literal.91ae56551b0b"),
    [
      port("index", window.RMLI18n.t("ui.auto.3909ec65b935"), "int"),
      { id: "value", label: window.RMLI18n.t("ui.auto.3b53ce63a0cc"), type: "$item" }
    ],
    (api, list, success) => {
      const index = api.input("index").code;
      const condition = `${index} >= 0 && ${index} <= ${list}.Count`;
      return success
        ? `lock (${list}) { ${success} = ${condition}; if (${success}) { ${list}.Insert(${index}, ${api.input("value").code}); } }`
        : `lock (${list}) { if (${condition}) { ${list}.Insert(${index}, ${api.input("value").code}); } }`;
    }
  );
  registerNormalListMutation(
    "collection.removeItem",
    window.RMLI18n.t("ui.literal.5899ad6363c0"),
    "−[]",
    [{ id: "value", label: window.RMLI18n.t("ui.auto.3b53ce63a0cc"), type: "$item" }],
    (api, list, success) =>
      `lock (${list}) { ${success ? `${success} = ` : ""}${list}.Remove(${api.input("value").code}); }`
  );
  registerNormalListMutation(
    "collection.removeAt",
    window.RMLI18n.t("ui.literal.1c4d0f125808"),
    "−[i]",
    [port("index", window.RMLI18n.t("ui.auto.3909ec65b935"), "int")],
    (api, list, success) => {
      const index = api.input("index").code;
      const condition = `${index} >= 0 && ${index} < ${list}.Count`;
      return success
        ? `lock (${list}) { ${success} = ${condition}; if (${success}) { ${list}.RemoveAt(${index}); } }`
        : `lock (${list}) { if (${condition}) { ${list}.RemoveAt(${index}); } }`;
    }
  );
  registerNormalListMutation(
    "collection.clearList",
    window.RMLI18n.t("ui.literal.0469cb7e9bca"),
    window.RMLI18n.t("ui.literal.116a20a3dc93"),
    [],
    (_api, list, success) =>
      `lock (${list}) { ${list}.Clear();${success ? ` ${success} = true;` : ""} }`
  );

  function registerNormalListQuery(
    id,
    title,
    symbol,
    extraInputs,
    outputs,
    renderer,
    options = {}
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.4bbb632f02fd"),
      symbol,
      parameters: normalListNodeParameters(
        options.fallback || "string",
        options.allowed || normalListValueTypeOptions
      ),
      inputs: [
        port("list", window.RMLI18n.t("ui.auto.171d403bb4b3"), normalListType(options.fallback || "string")),
        ...extraInputs.map(specification =>
          specification.type === "$item"
            ? port(
                specification.id,
                specification.label,
                options.fallback || "string"
              )
            : specification
        )
      ],
      outputs: outputs.map(specification =>
        specification.type === "$item"
          ? port(
              specification.id,
              specification.label,
              options.fallback || "string"
            )
          : specification.type === "$list"
            ? port(
                specification.id,
                specification.label,
                normalListType(options.fallback || "string")
              )
            : specification
      ),
      resolveDefinition(node) {
        return normalListResolvedDefinition(
          node,
          extraInputs,
          outputs,
          {
            fallback: options.fallback || "string",
            allowed: options.allowed || normalListValueTypeOptions
          }
        );
      },
      codegenCollect(api) {
        if (options.linq === true) {
          api.addUsing("System.Linq");
          api.addUsing("System.Collections.Generic");
        }
      },
      codegenExpression: renderer
    });
  }

  registerNormalListQuery(
    "collection.listContains",
    window.RMLI18n.t("ui.literal.e15304b85e6c"),
    "[]?",
    [{ id: "value", label: window.RMLI18n.t("ui.auto.3b53ce63a0cc"), type: "$item" }],
    [port("result", window.RMLI18n.t("ui.auto.cd3e9820f872"), "bool")],
    api => `${api.input("list").code}.Contains(${api.input("value").code})`
  );
  registerNormalListQuery(
    "collection.indexOf",
    window.RMLI18n.t("ui.literal.fda0334638af"),
    "i?",
    [{ id: "value", label: window.RMLI18n.t("ui.auto.3b53ce63a0cc"), type: "$item" }],
    [port("index", window.RMLI18n.t("ui.auto.3909ec65b935"), "int")],
    api => `${api.input("list").code}.IndexOf(${api.input("value").code})`
  );
  registerNormalListQuery(
    "collection.listCount",
    window.RMLI18n.t("ui.literal.cd726f30d37a"),
    "#[]",
    [],
    [port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")],
    api => `${api.input("list").code}.Count`
  );
  registerNormalListQuery(
    "collection.findItem",
    window.RMLI18n.t("ui.literal.e27f26409580"),
    window.RMLI18n.t("ui.literal.29e8adfc80c4"),
    [{ id: "value", label: window.RMLI18n.t("ui.auto.e5e00eff67aa"), type: "$item" }],
    [
      { id: "item", label: window.RMLI18n.t("ui.auto.be2f2387e7ac"), type: "$item" },
      port("index", window.RMLI18n.t("ui.auto.3909ec65b935"), "int"),
      port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool")
    ],
    api => {
      const list = api.input("list").code;
      const value = api.input("value").code;
      if (api.portId === "index") return `${list}.IndexOf(${value})`;
      if (api.portId === "success") return `${list}.Contains(${value})`;
      return `(${list}.Contains(${value}) ? ${value} : default!)`;
    }
  );
  registerNormalListQuery(
    "collection.filterList",
    window.RMLI18n.t("ui.literal.319899b71cd0"),
    window.RMLI18n.t("ui.literal.edc5934c34a6"),
    [{ id: "value", label: window.RMLI18n.t("ui.auto.3b53ce63a0cc"), type: "$item" }],
    [{ id: "list", label: window.RMLI18n.t("ui.auto.41b959f04c56"), type: "$list" }],
    api => {
      const type = normalSelectedType(
        api.node,
        "itemType",
        "string",
        normalListValueTypeOptions
      );
      const csType = api.csType(type);
      return `${api.input("list").code}.Where(item => EqualityComparer<${csType}>.Default.Equals(item, ${api.input("value").code})).ToList()`;
    },
    { linq: true }
  );
  registerNormalListQuery(
    "collection.sortList",
    window.RMLI18n.t("ui.literal.fdaaf7cfa51d"),
    window.RMLI18n.t("ui.literal.2434fe1de87e"),
    [],
    [{ id: "list", label: window.RMLI18n.t("ui.auto.77ce11e1075b"), type: "$list" }],
    api => api.node.parameters?.descending === true
      ? `${api.input("list").code}.OrderByDescending(item => item).ToList()`
      : `${api.input("list").code}.OrderBy(item => item).ToList()`,
    {
      linq: true,
      allowed: ["string", "int", "float", "double"],
      fallback: "string",
      parameters: [
        pBool("descending", window.RMLI18n.t("ui.literal.36377adf4398"), false)
      ]
    }
  );

  function normalDictionarySelection(node) {
    const keyType = normalSelectedType(
      node,
      "keyType",
      "string",
      normalDictionaryKeyTypeOptions
    );
    const valueType = normalSelectedType(
      node,
      "dictionaryValueType",
      "string",
      normalDictionaryValueTypeOptions
    );
    return {
      keyType,
      valueType,
      dictionaryType:
        ensureNormalDictionaryType(
          keyType,
          valueType
        ),
      keyListType: ensureNormalListType(keyType),
      valueListType: ensureNormalListType(valueType)
    };
  }

  function normalDictionaryParameters() {
    return [
      pSelect(
        "keyType",
        window.RMLI18n.t("ui.literal.3b13fb6c977a"),
        normalDictionaryKeyTypeOptions,
        "string"
      ),
      pSelect(
        "dictionaryValueType",
        window.RMLI18n.t("ui.literal.a956485e60c2"),
        normalDictionaryValueTypeOptions,
        "string"
      )
    ];
  }

  function normalDictionaryPorts(
    node,
    options = {}
  ) {
    const selected = normalDictionarySelection(node);
    return {
      inputs: [
        ...(options.action === true
          ? [port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse")]
          : []),
        ...(options.includeDictionary === false
          ? []
          : [port("dictionary", window.RMLI18n.t("ui.auto.b8f34f6f5325"), selected.dictionaryType)]),
        ...(options.key === true
          ? [port("key", window.RMLI18n.t("ui.auto.7955e30a4fd4"), selected.keyType)]
          : []),
        ...(options.value === true
          ? [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), selected.valueType)]
          : [])
      ],
      outputs: [
        ...(options.action === true
          ? [port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse")]
          : []),
        ...(options.dictionaryOutput === true
          ? [port("dictionary", window.RMLI18n.t("ui.auto.b8f34f6f5325"), selected.dictionaryType)]
          : []),
        ...(options.valueOutput === true
          ? [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), selected.valueType)]
          : []),
        ...(options.keysOutput === true
          ? [port("keys", window.RMLI18n.t("ui.auto.1047d7bc070b"), selected.keyListType)]
          : []),
        ...(options.valuesOutput === true
          ? [port("values", window.RMLI18n.t("ui.auto.cb9729d42e95"), selected.valueListType)]
          : []),
        ...(options.success === true
          ? [port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool")]
          : []),
        ...(options.count === true
          ? [port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")]
          : [])
      ]
    };
  }

  registerNode("dictionary.create", {
    title: window.RMLI18n.t("ui.auto.2649436fb4ea"),
    group: window.RMLI18n.t("ui.literal.51b0613ac049"),
    symbol: "NEW{}",
    parameters: normalDictionaryParameters(),
    inputs: [port("reset", window.RMLI18n.t("ui.auto.37d17c56d708"), "impulse")],
    outputs: [
      port("resetDone", window.RMLI18n.t("ui.auto.8d7896c46763"), "impulse"),
      port("dictionary", window.RMLI18n.t("ui.auto.b8f34f6f5325"), normalDictionaryType("string", "string")),
      port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
    ],
    resolveDefinition(node) {
      const selected = normalDictionarySelection(node);
      return {
        inputs: [port("reset", window.RMLI18n.t("ui.auto.37d17c56d708"), "impulse")],
        outputs: [
          port("resetDone", window.RMLI18n.t("ui.auto.8d7896c46763"), "impulse"),
          port("dictionary", window.RMLI18n.t("ui.auto.b8f34f6f5325"), selected.dictionaryType),
          port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
        ]
      };
    },
    codegenCollect(api) {
      const selected = normalDictionarySelection(api.node);
      const csType = api.csType(selected.dictionaryType);
      addStatefulField(
        api,
        "normalDictionary",
        csType,
        `new ${csType}()`
      );
    },
    codegenExpression(api) {
      const field = `_normalDictionary${nodeToken(api)}`;
      return api.portId === "count"
        ? `${field}.Count`
        : field;
    },
    codegenAction(api) {
      const field = `_normalDictionary${nodeToken(api)}`;
      const done = api.emit("resetDone");
      return `lock (${field}) { ${field}.Clear(); }${done ? `\n        ${done}();` : ""}`;
    }
  });

  function registerNormalDictionaryNode(
    id,
    title,
    symbol,
    options,
    expression,
    action
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.51b0613ac049"),
      symbol,
      parameters: normalDictionaryParameters(),
      ...normalDictionaryPorts(
        { parameters: { keyType: "string", dictionaryValueType: "string" } },
        options
      ),
      resolveDefinition(node) {
        return normalDictionaryPorts(
          node,
          options
        );
      },
      codegenCollect(api) {
        if (
          options.statefulSuccess === true &&
          generatedActionOutputIsUsed(
            api,
            "success"
          )
        ) {
          addStatefulField(
            api,
            `${id.replace(/[^A-Za-z0-9]/g, "")}Success`,
            "bool",
            "false"
          );
        }
        if (
          options.keysOutput === true ||
          options.valuesOutput === true
        ) {
          api.addUsing("System.Linq");
        }
      },
      codegenExpression(api) {
        if (
          options.statefulSuccess === true &&
          api.portId === "success"
        ) {
          return generatedActionOutputExpression(
            api,
            `_${id.replace(/[^A-Za-z0-9]/g, "")}Success${nodeToken(api)}`
          );
        }
        return expression ? expression(api) : "default!";
      },
      codegenAction(api) {
        const body = action ? action(api) : "";
        const done = api.emit("done");
        return `${body}${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerNormalDictionaryNode(
    "dictionary.setValue",
    window.RMLI18n.t("ui.literal.b15e6187e77a"),
    "{}=",
    {
      action: true,
      key: true,
      value: true,
      dictionaryOutput: true,
      success: true,
      count: true,
      statefulSuccess: true
    },
    api => api.portId === "count"
      ? `${api.input("dictionary").code}.Count`
      : api.input("dictionary").code,
    api => {
      const success =
        generatedActionOutputIsUsed(
          api,
          "success"
        )
          ? `_dictionarysetValueSuccess${nodeToken(api)}`
          : "";
      const dictionary = api.input("dictionary").code;
      return `try { lock (${dictionary}) { ${dictionary}[${api.input("key").code}] = ${api.input("value").code}; }${success ? ` ${success} = true;` : ""} } catch {${success ? ` ${success} = false;` : ""} }`;
    }
  );
  registerNormalDictionaryNode(
    "dictionary.tryGetValue",
    window.RMLI18n.t("ui.literal.d32f247ad658"),
    "{}?",
    {
      key: true,
      valueOutput: true,
      success: true
    },
    api => {
      const selected = normalDictionarySelection(api.node);
      const valueCsType = api.csType(selected.valueType);
      const dictionary = api.input("dictionary").code;
      const key = api.input("key").code;
      return api.portId === "success"
        ? `${dictionary}.ContainsKey(${key})`
        : `(${dictionary}.TryGetValue(${key}, out ${valueCsType} normalValue${nodeToken(api)}) ? normalValue${nodeToken(api)} : default!)`;
    }
  );
  registerNormalDictionaryNode(
    "dictionary.removeKey",
    window.RMLI18n.t("ui.literal.232817d42fc9"),
    "{}−",
    {
      action: true,
      key: true,
      dictionaryOutput: true,
      success: true,
      count: true,
      statefulSuccess: true
    },
    api => api.portId === "count"
      ? `${api.input("dictionary").code}.Count`
      : api.input("dictionary").code,
    api => {
      const success =
        generatedActionOutputIsUsed(
          api,
          "success"
        )
          ? `_dictionaryremoveKeySuccess${nodeToken(api)}`
          : "";
      const dictionary = api.input("dictionary").code;
      return `lock (${dictionary}) { ${success ? `${success} = ` : ""}${dictionary}.Remove(${api.input("key").code}); }`;
    }
  );
  registerNormalDictionaryNode(
    "dictionary.containsKey",
    window.RMLI18n.t("ui.literal.763f0f6c27fd"),
    "K?",
    { key: true, success: true },
    api => `${api.input("dictionary").code}.ContainsKey(${api.input("key").code})`
  );
  registerNormalDictionaryNode(
    "dictionary.keysValues",
    window.RMLI18n.t("ui.literal.dcc5e374b43f"),
    "K/V",
    {
      keysOutput: true,
      valuesOutput: true,
      count: true
    },
    api => {
      const dictionary = api.input("dictionary").code;
      if (api.portId === "keys") return `${dictionary}.Keys.ToList()`;
      if (api.portId === "values") return `${dictionary}.Values.ToList()`;
      return `${dictionary}.Count`;
    }
  );

  function registerNormalFileTransfer(
    id,
    title,
    symbol,
    method
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.a513560b7e42"),
      symbol,
      description:
        `${title} with optional overwrite and explicit success/exception outputs.`,
      parameters: [
        pBool("overwrite", window.RMLI18n.t("ui.literal.5740416c66c5"), false)
      ],
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port("source", window.RMLI18n.t("ui.auto.7deb1d3ecd27"), "string"),
        port("destination", window.RMLI18n.t("ui.auto.d949f872cbf5"), "string")
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
        port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
        port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
      ],
      codegenCollect(api) {
        api.addUsing("System.IO");
        if (generatedActionOutputIsUsed(api, "success")) {
          addStatefulField(
            api,
            `${id.replace(/[^A-Za-z0-9]/g, "")}Success`,
            "bool",
            "false"
          );
        }
        if (
          generatedActionOutputIsUsed(
            api,
            "exception"
          )
        ) {
          addStatefulField(
            api,
            `${id.replace(/[^A-Za-z0-9]/g, "")}Exception`,
            window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
            "null!"
          );
        }
      },
      codegenExpression(api) {
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        return generatedActionOutputExpression(
          api,
          api.portId === "exception"
            ? `_${stem}Exception${nodeToken(api)}`
            : `_${stem}Success${nodeToken(api)}`
        );
      },
      codegenAction(api) {
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        const token = nodeToken(api);
        const success = `_${stem}Success${token}`;
        const exception = `_${stem}Exception${token}`;
        const overwrite = api.node.parameters?.overwrite === true
          ? "true"
          : "false";
        const done = api.emit("done");
        const keepSuccess =
          generatedActionOutputIsUsed(api, "success");
        const keepException =
          generatedActionOutputIsUsed(api, "exception");
        const before = keepException
          ? `${exception} = null!;\n            `
          : "";
        const after = keepSuccess
          ? `\n            ${success} = true;`
          : "";
        const catchClause = keepException
          ? "catch (Exception caught)"
          : "catch (Exception)";
        const failure = [
          keepSuccess ? `${success} = false;` : "",
          keepException ? `${exception} = caught;` : ""
        ].filter(Boolean).join("\n            ");
        return `try\n        {\n            ${before}${method}(${api.input("source").code}, ${api.input("destination").code}, ${overwrite});${after}\n        }\n        ${catchClause}\n        {${failure ? `\n            ${failure}\n        ` : ""}}${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerNormalFileTransfer(
    "file.copy",
    window.RMLI18n.t("ui.literal.e1199d6a758f"),
    window.RMLI18n.t("ui.literal.aecf0292da85"),
    window.RMLI18n.t("ui.literal.7b7cd2564a02")
  );
  registerNormalFileTransfer(
    "file.move",
    window.RMLI18n.t("ui.literal.4686a9b00456"),
    window.RMLI18n.t("ui.literal.3bf08a84f15b"),
    window.RMLI18n.t("ui.literal.4a2f17fda64e")
  );

  function registerNormalJsonContainer(
    id,
    title,
    symbol,
    csType,
    fieldStem
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.a513560b7e42"),
      symbol,
      description:
        window.RMLI18n.t("ui.auto.1e06dbf90c92"),
      inputs: [port("reset", window.RMLI18n.t("ui.auto.37d17c56d708"), "impulse")],
      outputs: [
        port("resetDone", window.RMLI18n.t("ui.auto.8d7896c46763"), "impulse"),
        port("json", window.RMLI18n.t("ui.auto.fe3dd3a4e154"), "json"),
        port("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), "int")
      ],
      codegenCollect(api) {
        ensureJsonRuntime(api);
        addStatefulField(
          api,
          fieldStem,
          csType,
          `new ${csType}()`
        );
      },
      codegenExpression(api) {
        const field = `_${fieldStem}${nodeToken(api)}`;
        return api.portId === "count"
          ? `${field}.Count`
          : field;
      },
      codegenAction(api) {
        const field = `_${fieldStem}${nodeToken(api)}`;
        const done = api.emit("resetDone");
        return `${field}.Clear();${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerNormalJsonContainer(
    "json.createObject",
    window.RMLI18n.t("ui.literal.e7ce20c91225"),
    window.RMLI18n.t("ui.literal.716ce6d39f24"),
    window.RMLI18n.t("ui.literal.00d5a5e7b196"),
    "normalJsonObject"
  );
  registerNormalJsonContainer(
    "json.createArray",
    window.RMLI18n.t("ui.literal.d109e89c26cf"),
    window.RMLI18n.t("ui.literal.b082171edef6"),
    window.RMLI18n.t("ui.literal.ac13be6f1b70"),
    "normalJsonArray"
  );

  function registerNormalJsonMutation(
    id,
    title,
    symbol,
    extraInputs,
    operation
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.a513560b7e42"),
      symbol,
      inputs: [
        port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
        port("json", window.RMLI18n.t("ui.auto.fe3dd3a4e154"), "json"),
        ...extraInputs
      ],
      outputs: [
        port("done", window.RMLI18n.t("index.text.ae785de0d909"), "impulse"),
        port("json", window.RMLI18n.t("ui.auto.fe3dd3a4e154"), "json"),
        port("success", window.RMLI18n.t("ui.auto.c053e4f819dd"), "bool"),
        port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
      ],
      codegenCollect(api) {
        ensureJsonRuntime(api);
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        if (generatedActionOutputIsUsed(api, "success")) {
          addStatefulField(
            api,
            `${stem}Success`,
            "bool",
            "false"
          );
        }
        if (
          generatedActionOutputIsUsed(
            api,
            "exception"
          )
        ) {
          addStatefulField(
            api,
            `${stem}Exception`,
            window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
            "null!"
          );
        }
      },
      codegenExpression(api) {
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        if (api.portId === "success") {
          return generatedActionOutputExpression(
            api,
            `_${stem}Success${nodeToken(api)}`
          );
        }
        if (api.portId === "exception") {
          return generatedActionOutputExpression(
            api,
            `_${stem}Exception${nodeToken(api)}`
          );
        }
        return api.input("json").code;
      },
      codegenAction(api) {
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        const token = nodeToken(api);
        const success = `_${stem}Success${token}`;
        const exception = `_${stem}Exception${token}`;
        const done = api.emit("done");
        const keepSuccess =
          generatedActionOutputIsUsed(api, "success");
        const keepException =
          generatedActionOutputIsUsed(api, "exception");
        const before = keepException
          ? `${exception} = null!;\n            `
          : "";
        const mutate = keepSuccess
          ? `${success} = ${operation(api)};`
          : `_ = ${operation(api)};`;
        const catchClause = keepException
          ? "catch (Exception caught)"
          : "catch (Exception)";
        const failure = [
          keepSuccess ? `${success} = false;` : "",
          keepException ? `${exception} = caught;` : ""
        ].filter(Boolean).join("\n            ");
        return `try\n        {\n            ${before}${mutate}\n        }\n        ${catchClause}\n        {${failure ? `\n            ${failure}\n        ` : ""}}${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerNormalJsonMutation(
    "json.setProperty",
    window.RMLI18n.t("ui.literal.e3c9511a8f2f"),
    "{}=",
    [
      port("property", window.RMLI18n.t("ui.auto.54774b910e64"), "string"),
      port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")
    ],
    api => `SetGraphJsonProperty(${api.input("json").code}, ${api.input("property").code}, ${api.input("value").code})`
  );
  registerNormalJsonMutation(
    "json.removeProperty",
    window.RMLI18n.t("ui.literal.9b3845bd68e4"),
    "{}−",
    [port("property", window.RMLI18n.t("ui.auto.54774b910e64"), "string")],
    api => `RemoveGraphJsonProperty(${api.input("json").code}, ${api.input("property").code})`
  );
  registerNormalJsonMutation(
    "json.addArrayItem",
    window.RMLI18n.t("ui.literal.922b01771ecf"),
    "+[]",
    [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "object")],
    api => `AddGraphJsonArrayItem(${api.input("json").code}, ${api.input("value").code})`
  );

  registerNode("task.cancelTask", {
    title: window.RMLI18n.t("ui.auto.8b62866e2454"),
    group: window.RMLI18n.t("ui.literal.6aa5e4a6e67c"),
    symbol: "CANCEL",
    description:
      window.RMLI18n.t("ui.auto.003432c62673"),
    inputs: [
      port("reset", window.RMLI18n.t("ui.auto.1079ece42ed3"), "impulse"),
      port("cancel", window.RMLI18n.t("index.text.02bc50efcb1e"), "impulse")
    ],
    outputs: [
      port("ready", window.RMLI18n.t("ui.auto.4df851e8dac5"), "impulse"),
      port("cancelled", window.RMLI18n.t("ui.auto.12700e48f58c"), "impulse"),
      port("failed", window.RMLI18n.t("ui.auto.ab96e7f19dcd"), "impulse"),
      port("token", window.RMLI18n.t("ui.auto.b627800048d7"), "cancellationToken"),
      port("isCancellationRequested", window.RMLI18n.t("ui.auto.20f31ceba6d6"), "bool"),
      port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
    ],
    codegenCollect(api) {
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      const actionReachable =
        typeof api.isActionReachable ===
          "function"
          ? api.isActionReachable()
          : true;
      if (
        actionReachable ||
        generatedOutputIsUsed(api, "token") ||
        generatedOutputIsUsed(
          api,
          "isCancellationRequested"
        )
      ) {
        api.addField(
          `${api.node.id}.source`,
          `private static CancellationTokenSource _normalCancellation${token} = new();`
        );
      }
      if (
        generatedActionOutputIsUsed(
          api,
          "exception"
        )
      ) {
        addStatefulField(
          api,
          "normalCancellationException",
          window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
          "null!"
        );
      }
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      if (api.portId === "isCancellationRequested") {
        return `_normalCancellation${token}.IsCancellationRequested`;
      }
      if (api.portId === "exception") {
        return generatedActionOutputExpression(
          api,
          `_normalCancellationException${token}`
        );
      }
      return `_normalCancellation${token}.Token`;
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const exception = `_normalCancellationException${token}`;
      const failed = api.emit("failed");
      const keepException =
        generatedActionOutputIsUsed(
          api,
          "exception"
        );
      if (api.connection?.toPort === "cancel") {
        const cancelled = api.emit("cancelled");
        const catchClause = keepException
          ? "catch (Exception caught)"
          : "catch (Exception)";
        return `try\n        {${keepException ? `\n            ${exception} = null!;` : ""}\n            _normalCancellation${token}.Cancel();${cancelled ? `\n            ${cancelled}();` : ""}\n        }\n        ${catchClause}\n        {${keepException ? `\n            ${exception} = caught;` : ""}${failed ? `\n            ${failed}();` : ""}\n        }`;
      }
      const ready = api.emit("ready");
      const catchClause = keepException
        ? "catch (Exception caught)"
        : "catch (Exception)";
      return `try\n        {\n            _normalCancellation${token}.Dispose();\n            _normalCancellation${token} = new CancellationTokenSource();${keepException ? `\n            ${exception} = null!;` : ""}${ready ? `\n            ${ready}();` : ""}\n        }\n        ${catchClause}\n        {${keepException ? `\n            ${exception} = caught;` : ""}${failed ? `\n            ${failed}();` : ""}\n        }`;
    }
  });

  registerNode("task.timeout", {
    title: window.RMLI18n.t("ui.auto.435a85e88690"),
    group: window.RMLI18n.t("ui.literal.6aa5e4a6e67c"),
    symbol: "T/O",
    description:
      window.RMLI18n.t("ui.auto.e5f04b398b89"),
    inputs: [
      port("call", window.RMLI18n.t("ui.auto.603e48dee5e5"), "impulse"),
      port("task", window.RMLI18n.t("ui.auto.3eec9366cd84"), "task"),
      port("milliseconds", window.RMLI18n.t("ui.auto.55a460b81f66"), "int")
    ],
    outputs: [
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse"),
      port("timedOut", window.RMLI18n.t("ui.auto.43fe1a0ab977"), "impulse"),
      port("faulted", window.RMLI18n.t("ui.auto.d48b9bb3f79e"), "impulse"),
      port("exception", window.RMLI18n.t("ui.auto.c2fc0d913a4a"), "exception")
    ],
    codegenCollect(api) {
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      const completed = api.emitMethod(
        api.node.id,
        "completed"
      );
      const timedOut = api.emitMethod(
        api.node.id,
        "timedOut"
      );
      const faulted = api.emitMethod(
        api.node.id,
        "faulted"
      );
      if (
        generatedActionOutputIsUsed(
          api,
          "exception"
        )
      ) {
        addStatefulField(
          api,
          "normalTimeoutException",
          window.RMLI18n.t("ui.auto.c2fc0d913a4a"),
          "null!"
        );
      }
      const keepException =
        generatedActionOutputIsUsed(
          api,
          "exception"
        );
      const catchClause = keepException
        ? "catch (Exception caught)"
        : "catch (Exception)";
      api.addMember(
        `${api.node.id}.timeout`,
        globalThis.RMLCodeTemplates.text("nodes", "source_036", [token,
keepException ? `\n        _normalTimeoutException${token} = null!;` : "",
timedOut ? `\n            ${timedOut}();` : "",
completed ? `\n        ${completed}();` : "",
catchClause,
keepException ? `\n        _normalTimeoutException${token} = caught;` : "",
faulted ? `\n        ${faulted}();` : ""])
      );
    },
    codegenExpression(api) {
      return generatedActionOutputExpression(
        api,
        `_normalTimeoutException${nodeToken(api)}`
      );
    },
    codegenAction(api) {
      return `WaitWithTimeout${nodeToken(api)}(${api.input("task").code}, ${api.input("milliseconds").code});`;
    }
  });

  registerNode("task.retry", {
    title: window.RMLI18n.t("ui.auto.6e4cf76ad90b"),
    group: window.RMLI18n.t("ui.literal.6aa5e4a6e67c"),
    symbol: "RETRY",
    description:
      window.RMLI18n.t("ui.auto.85a2f512cf99"),
    inputs: [
      port("start", window.RMLI18n.t("ui.auto.603e48dee5e5"), "impulse"),
      port("success", window.RMLI18n.t("ui.auto.edbf2182dc74"), "impulse"),
      port("failure", window.RMLI18n.t("ui.auto.5da994e93d13"), "impulse"),
      port("maxAttempts", window.RMLI18n.t("ui.auto.543e6202edd8"), "int"),
      port("delayMilliseconds", window.RMLI18n.t("ui.auto.18e042f2ee3a"), "int")
    ],
    outputs: [
      port("attempt", window.RMLI18n.t("ui.auto.6df5b3821a7e"), "impulse"),
      port("completed", window.RMLI18n.t("ui.auto.f3eee5c87430"), "impulse"),
      port("exhausted", window.RMLI18n.t("ui.auto.d7f72251f5f3"), "impulse"),
      port("attemptNumber", window.RMLI18n.t("ui.auto.e019f2856867"), "int")
    ],
    codegenCollect(api) {
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      const attempt = api.emitMethod(
        api.node.id,
        "attempt"
      );
      const completed = api.emitMethod(
        api.node.id,
        "completed"
      );
      const exhausted = api.emitMethod(
        api.node.id,
        "exhausted"
      );
      api.addField(
        `${api.node.id}.state`,
        globalThis.RMLCodeTemplates.text("nodes", "source_037", [token,
token,
token,
token])
      );
      api.addMember(
        `${api.node.id}.retry`,
        globalThis.RMLCodeTemplates.text("nodes", "source_038", [token,
token,
token,
token,
token,
attempt ? `\n    ${attempt}();` : "",
token,
token,
completed ? `\n    ${completed}();` : "",
token,
token,
token,
token,
token,
exhausted ? `\n        ${exhausted}();` : "",
token,
token,
token,
token,
attempt ? `\n    ${attempt}();` : ""])
      );
    },
    codegenExpression(api) {
      return `_normalRetryAttempt${nodeToken(api)}`;
    },
    codegenAction(api) {
      const token = nodeToken(api);
      if (api.connection?.toPort === "success") {
        return `CompleteRetry${token}();`;
      }
      if (api.connection?.toPort === "failure") {
        return `FailRetry${token}();`;
      }
      return `StartRetry${token}(${api.input("maxAttempts").code}, ${api.input("delayMilliseconds").code});`;
    }
  });

  function registerNormalTaskAggregate(
    id,
    title,
    symbol,
    renderer
  ) {
    registerNode(id, {
      title,
      group: window.RMLI18n.t("ui.literal.6aa5e4a6e67c"),
      symbol,
      description:
        `${title}. Select the node and use + / − to change the Task count.`,
      inputs: [
        port("a", window.RMLI18n.t("ui.auto.3da047312685"), "task"),
        port("b", window.RMLI18n.t("ui.auto.5be8f675c8ef"), "task")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: port("a", window.RMLI18n.t("ui.auto.3eec9366cd84"), "task")
      },
      outputs: [port("task", window.RMLI18n.t("ui.auto.fa76bd6533a6"), "task")],
      codegenCollect(api) {
        ensureTaskRuntime(api);
      },
      codegenExpression(api) {
        const count = Math.max(
          2,
          Math.min(
            64,
            Math.trunc(
              Number(api.node.parameters?.variadicInputCount) || 2
            )
          )
        );
        return renderer(
          normalVariadicIds(count).map(
            id => api.input(id).code
          )
        );
      }
    });
  }

  registerNormalTaskAggregate(
    "task.whenAll",
    window.RMLI18n.t("ui.literal.35ce66b8bee4"),
    window.RMLI18n.t("ui.literal.6b42874e3cd2"),
    tasks => `Task.WhenAll(new Task[] { ${tasks.join(", ")} })`
  );
  registerNormalTaskAggregate(
    "task.whenAny",
    window.RMLI18n.t("ui.literal.77415b6e27e2"),
    window.RMLI18n.t("ui.literal.113a97cdab92"),
    tasks => `WaitForAnyGraphTask(new Task[] { ${tasks.join(", ")} })`
  );

  const RAW_CSHARP_USING_RULES = [
    [
      "System.Diagnostics",
      /\b(?:Process|ProcessStartInfo|Stopwatch|Debug|Trace)\b|System\.Diagnostics\./
    ],
    [
      "System.IO",
      /\b(?:File|Directory|Path|FileInfo|DirectoryInfo|FileStream|MemoryStream|StreamReader|StreamWriter|BinaryReader|BinaryWriter)\b|System\.IO\./
    ],
    [
      "System.Linq",
      /\b(?:Enumerable|Queryable)\b|\.(?:Select|Where|OrderBy|OrderByDescending|FirstOrDefault|SingleOrDefault|ToArray|ToList|Any|All|Concat)\s*\(/
    ],
    [
      "System.Net.Http",
      /\b(?:HttpClient|HttpRequestMessage|HttpResponseMessage|HttpContent|StringContent)\b|System\.Net\.Http\./
    ],
    [
      "System.Net.WebSockets",
      /\b(?:ClientWebSocket|WebSocketMessageType|WebSocketReceiveResult)\b|System\.Net\.WebSockets\./
    ],
    [
      "System.Text.Json",
      /\b(?:JsonSerializer|JsonDocument|JsonElement|JsonSerializerOptions)\b|System\.Text\.Json\./
    ],
    [
      "System.Text.Json.Nodes",
      /\b(?:JsonNode|JsonObject|JsonArray|JsonValue)\b|System\.Text\.Json\.Nodes\./
    ],
    [
      "System.Text",
      /\b(?:StringBuilder|Encoding|UTF8Encoding)\b|System\.Text\./
    ],
    [
      "System.Threading",
      /\b(?:CancellationToken|CancellationTokenSource|SemaphoreSlim|Interlocked|Volatile|Mutex|Monitor)\b|System\.Threading\./
    ],
    [
      "System.Threading.Tasks",
      /\b(?:Task|ValueTask|TaskCompletionSource|TaskScheduler)\b|System\.Threading\.Tasks\./
    ],
    [
      "System.Collections.Concurrent",
      /\b(?:ConcurrentDictionary|ConcurrentQueue|ConcurrentBag|BlockingCollection)\b|System\.Collections\.Concurrent\./
    ],
    [
      "System.Collections.Generic",
      /\b(?:List|Dictionary|HashSet|Queue|Stack|IEnumerable|IReadOnlyList)\s*</
    ],
    [
      "System.Reflection",
      /\b(?:BindingFlags|MethodInfo|MethodBase|FieldInfo|PropertyInfo|Assembly)\b|System\.Reflection\./
    ],
    [
      "System.Globalization",
      /\b(?:CultureInfo|NumberStyles)\b|System\.Globalization\./
    ],
    [
      "System.Runtime.InteropServices",
      /\b(?:DllImport|LibraryImport|Marshal|StructLayout|UnmanagedFunctionPointer|GCHandle)\b|System\.Runtime\.InteropServices\./
    ],
    [
      "System.Runtime.CompilerServices",
      /\b(?:MethodImpl|MethodImplOptions|CallerMemberName|CallerFilePath|CallerLineNumber|RuntimeHelpers|Unsafe)\b|System\.Runtime\.CompilerServices\./
    ],
    [
      "System.Buffers",
      /\b(?:ArrayPool|MemoryPool|ReadOnlySequence|SequenceReader)\b|System\.Buffers\./
    ],
    [
      "System.Text.RegularExpressions",
      /\b(?:Regex|Match|MatchCollection|RegexOptions)\b|System\.Text\.RegularExpressions\./
    ],
    [
      "System.Security.Cryptography",
      /\b(?:SHA256|SHA512|MD5|RandomNumberGenerator|Aes|RSA|CryptographicOperations)\b|System\.Security\.Cryptography\./
    ],
    [
      window.RMLI18n.t("ui.literal.ba72b710185f"),
      /\b(?:Registry|RegistryKey)\b|Microsoft\.Win32\./
    ],
    [
      window.RMLI18n.t("ui.literal.920334256608"),
      /\bJsonConvert\b|Newtonsoft\.Json\./
    ],
    [
      window.RMLI18n.t("ui.literal.9664bedcfcab"),
      /\b(?:JObject|JArray|JToken|JValue)\b|Newtonsoft\.Json\.Linq\./
    ],
    [
      window.RMLI18n.t("ui.literal.4165d80f0f1d"),
      /\bWebsocketClient\b|Websocket\.Client\./
    ]
  ];

  const RAW_CSHARP_PACKAGE_RULES = [
    {
      pattern:
        /\bNewtonsoft\.Json\b|\b(?:JsonConvert|JObject|JArray|JToken|JValue)\b/,
      include: window.RMLI18n.t("ui.literal.920334256608"),
      version: "13.0.3"
    },
    {
      pattern:
        /\bWebsocket\.Client\b|\bWebsocketClient\b/,
      include: window.RMLI18n.t("ui.literal.4165d80f0f1d"),
      version: "5.1.2"
    }
  ];

  const RAW_CSHARP_FRAMEWORK_RULES = [
    {
      pattern:
        /\bMicrosoft\.AspNetCore\b|^\s*using\s+Microsoft\.AspNetCore(?:\.|;)/m,
      include: window.RMLI18n.t("ui.literal.1f4ac8a07e36")
    }
  ];

  function analyzeRawCSharpDependencies(
    source
  ) {
    const code = String(source || "");
    const usings = new Set();
    const usingPattern =
      /^\s*using\s+(?:static\s+)?([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*;/gm;
    let match;

    while ((match = usingPattern.exec(code))) {
      usings.add(match[1]);
    }

    for (const [namespaceName, pattern] of
      RAW_CSHARP_USING_RULES) {
      if (pattern.test(code)) {
        usings.add(namespaceName);
      }
    }

    const useWindowsForms =
      /\bSystem\.Windows\.Forms\b|^\s*using\s+System\.Windows\.Forms\s*;/m.test(
        code
      ) ||
      /\b(?:MessageBox\.Show|NotifyIcon|OpenFileDialog|SaveFileDialog|FolderBrowserDialog)\b/.test(
        code
      ) ||
      (/\bApplication\.Run\s*\(/.test(code) &&
        /\bForm\b/.test(code));
    const allowUnsafeBlocks =
      /\bunsafe\b|\bstackalloc\b|\bfixed\s*\(|delegate\s*\*|->|\b(?:void|byte|sbyte|short|ushort|int|uint|long|ulong|char|float|double|nint|nuint|[A-Za-z_][A-Za-z0-9_<>]*)\s*\*+\s*[A-Za-z_(]/.test(
        code
      );
    const usesElements =
      /\b(?:int2|int3|int4|float2|float3|float4|double2|double3|double4|colorX)\b|\bnew\s+color\s*\(|Elements\.Core\./.test(
        code
      );
    const usesRenderiteShared =
      /\bColorProfile\b|Renderite\.Shared\./.test(
        code
      );
    const usesHarmony =
      /\bHarmonyLib\b|\[\s*HarmonyPatch\b|\bHarmonyMethod\b|\bnew\s+Harmony\s*\(/.test(
        code
      );

    if (useWindowsForms) {
      usings.add("System.Windows.Forms");
    }
    if (usesElements) {
      usings.add("Elements.Core");
    }
    if (usesRenderiteShared) {
      usings.add(window.RMLI18n.t("ui.literal.38b9a2fd4ae5"));
    }
    if (usesHarmony) {
      usings.add(window.RMLI18n.t("ui.literal.d8806e74e794"));
    }

    const packageReferences =
      RAW_CSHARP_PACKAGE_RULES
        .filter(rule =>
          rule.pattern.test(code)
        )
        .map(rule => ({
          include: rule.include,
          version: rule.version,
          privateAssets: "",
          includeAssets: ""
        }));
    const frameworkReferences =
      RAW_CSHARP_FRAMEWORK_RULES
        .filter(rule =>
          rule.pattern.test(code)
        )
        .map(rule => rule.include);

    return {
      usings,
      packageReferences,
      frameworkReferences,
      allowUnsafeBlocks,
      useWindowsForms,
      usesElements,
      usesRenderiteShared,
      usesHarmony
    };
  }

  function applyRawCSharpDependencies(
    api,
    source,
    options = {}
  ) {
    const information =
      analyzeRawCSharpDependencies(
        source
      );

    if (options.addUsings !== false) {
      for (const namespaceName of
        information.usings) {
        api.addUsing(namespaceName);
      }
    }

    api.require(
      "allowUnsafeBlocks",
      information.allowUnsafeBlocks
    );
    api.require(
      "useWindowsForms",
      information.useWindowsForms
    );
    api.require(
      "usesElements",
      information.usesElements
    );
    api.require(
      "usesRenderiteShared",
      information.usesRenderiteShared
    );

    if (information.usesHarmony) {
      api.addReference({
        include: "0Harmony",
        hintPath:
          "$(ResonitePath)rml_libs/0Harmony.dll",
        private: false
      });
    }

    for (const packageReference of
      information.packageReferences) {
      api.addPackageReference(
        packageReference
      );
    }

    for (const frameworkReference of
      information.frameworkReferences) {
      api.addFrameworkReference(
        frameworkReference
      );
    }

    return information;
  }

  registerNode("harmony.exactPatchSource", {
    paletteHidden: true,
    hiddenFromPalette: true,
    legacyMigrationOnly: true,
    title: window.RMLI18n.t("ui.auto.d9ed7bb394c6"),
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "H.CS",
    description:
      window.RMLI18n.t("ui.auto.829ea454bfe3"),
    parameters: [
      pText(
        "fileName",
        window.RMLI18n.t("ui.auto.e8a60be6b168"),
        window.RMLI18n.t("ui.literal.569b5ecc50e3")
      ),
      pCode(
        "content",
        window.RMLI18n.t("ui.literal.1cf3fa17f4a4"),
        "using HarmonyLib;\n\nnamespace {NAMESPACE};\n\n[HarmonyPatch]\ninternal static class ExactHarmonyPatches\n{\n    // Add [HarmonyPatch] targets and exact Prefix/Postfix/Finalizer/Transpiler methods here.\n}\n",
        window.RMLI18n.t("ui.literal.54c9697e9336"),
        24
      )
    ]
  });

  registerNode("harmony.earlyPatchSource", {
    paletteHidden: true,
    hiddenFromPalette: true,
    legacyMigrationOnly: true,
    title: window.RMLI18n.t("ui.auto.32a06d125699"),
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "H.LIB",
    description:
      window.RMLI18n.t("ui.auto.c6b7766aead3"),
    parameters: [
      pText(
        "fileName",
        window.RMLI18n.t("ui.literal.3c73fd88f377"),
        window.RMLI18n.t("ui.literal.b902374d9e55")
      ),
      pNumber(
        "loadOrder",
        window.RMLI18n.t("ui.literal.56db0fe7de3a"),
        0,
        window.RMLI18n.t("ui.literal.56fc384d4204")
      ),
      pCode(
        "content",
        window.RMLI18n.t("ui.literal.56acb9e85a58"),
        "using HarmonyLib;\n\nnamespace {NAMESPACE}.EarlyPatches;\n\n[HarmonyPatch]\ninternal static class EarlyHarmonyPatches\n{\n    // Add exact [HarmonyPatch] declarations here.\n    // This project cannot call graph Emit... methods or read generated mod state.\n}\n",
        window.RMLI18n.t("ui.literal.3e767db36a0f"),
        24
      )
    ]
  });

  registerNode("csharp.using", {
    title: window.RMLI18n.t("ui.auto.337a58973fe5"),
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: window.RMLI18n.t("ui.literal.b0138e4f9dc0"),
    description:
      window.RMLI18n.t("ui.auto.23b8ea8ab75d"),
    parameters: [
      pText(
        "namespace",
        window.RMLI18n.t("index.text.43c7d869d357"),
        "System.Diagnostics"
      )
    ]
  });

  registerNode("csharp.buildOptions", {
    title: window.RMLI18n.t("ui.auto.bd04a3658e4b"),
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: window.RMLI18n.t("ui.literal.9b8dfdff736c"),
    description:
      window.RMLI18n.t("ui.auto.d7ba80fd8808"),
    parameters: [
      pBool(
        "unsafe",
        window.RMLI18n.t("ui.literal.0794ff4f07d1"),
        false
      ),
      pBool(
        "windowsForms",
        window.RMLI18n.t("ui.literal.07908ef929da"),
        false
      )
    ]
  });

  function registerCompatibleRuntimeFamily(
    id,
    title,
    symbol,
    members
  ) {
    const definitions = registry.getNodeDefinitions();
    const entries = Object.entries(members)
      .map(([operation, memberId]) => [operation, memberId, definitions[memberId]])
      .filter(([, , definition]) => definition);
    if (entries.length === 0) return;
    const defaultOperation = entries[0][0];
    const defaultDefinition = entries[0][2];
    const parameterByKey = new Map();
    for (const [, , definition] of entries) {
      for (const parameter of definition.parameters || []) {
        if (!parameterByKey.has(parameter.key)) {
          parameterByKey.set(parameter.key, { ...parameter });
        } else if (parameter.kind === "select") {
          const existing = parameterByKey.get(parameter.key);
          const previousOptions = existing.options;
          const nextOptions = parameter.options;
          const mergeOptions = (node, resolvedDefinition) => {
            const resolve = source =>
              typeof source === "function"
                ? source(node, resolvedDefinition)
                : source || [];
            const options = [
              ...resolve(previousOptions),
              ...resolve(nextOptions)
            ];
            const seen = new Set();
            return options.filter(option => {
              const value = normalSelectOptionValue(option);
              if (seen.has(value)) return false;
              seen.add(value);
              return true;
            });
          };
          existing.options =
            typeof previousOptions === "function" ||
            typeof nextOptions === "function"
              ? mergeOptions
              : mergeOptions(null, null);
        }
      }
      definition.hiddenFromPalette = true;
    }
    const selected = node => {
      const operation = String(node.parameters?.operation || defaultOperation);
      return entries.find(entry => entry[0] === operation) || entries[0];
    };
    const delegatedApi = (api, definition) => ({ ...api, definition });
    registerNode(id, {
      title,
      group: defaultDefinition.group,
      symbol,
      description: `Selects one compatible ${title.toLowerCase()} behavior without requiring separate palette nodes.`,
      configurableTypeVar: defaultDefinition.configurableTypeVar,
      configurableTypes: defaultDefinition.configurableTypes,
      defaultType: defaultDefinition.defaultType,
      parameters: [
        pSelect(
          "operation",
          window.RMLI18n.t("ui.literal.430d32076eb2"),
          () => entries.map(entry => [
            entry[0],
            entry[2].presentationTitleKey
              ? window.RMLI18n.t(entry[2].presentationTitleKey)
              : entry[2].title || entry[0]
          ]),
          defaultOperation,
          "",
          { affectsPorts: true, affectsNode: true, commitImmediately: true }
        ),
        ...parameterByKey.values()
      ],
      inputs: defaultDefinition.inputs || [],
      outputs: defaultDefinition.outputs || [],
      resolveDefinition(node) {
        const [operation, , definition] = selected(node);
        const resolved = typeof definition.resolveDefinition === "function"
          ? { ...definition, ...definition.resolveDefinition(node) }
          : definition;
        const localizedMemberTitle =
          resolved.presentationTitleKey
            ? window.RMLI18n.t(resolved.presentationTitleKey)
            : resolved.title;
        return {
          title: `${title} · ${localizedMemberTitle}`,
          symbol: resolved.symbol || symbol,
          description: resolved.description,
          inputs: resolved.inputs || [],
          outputs: resolved.outputs || [],
          variadicInputs: resolved.variadicInputs || null,
          variadicOutputs: resolved.variadicOutputs || null,
          selectedFamilyOperation: operation,

          selectedFamilyMemberId: selected(node)[1]
        };
      },
      codegenCollect(api) {
        const [, , definition] = selected(api.node);
        return definition.codegenCollect?.(delegatedApi(api, api.definition));
      },
      codegenExpression(api) {
        const [, , definition] = selected(api.node);
        return definition.codegenExpression?.(delegatedApi(api, api.definition));
      },
      codegenAction(api) {
        const [, , definition] = selected(api.node);
        return definition.codegenAction?.(delegatedApi(api, api.definition));
      },
      previewEvaluate(api) {
        const [, , definition] = selected(api.node);
        return definition.previewEvaluate?.(api);
      }
    });
  }

  registerCompatibleRuntimeFamily("normal.nullCheck", window.RMLI18n.t("ui.literal.0732aa325a77"), "∅?", {
    isNull: "normal.isNull",
    isNotNull: "normal.isNotNull"
  });
  registerCompatibleRuntimeFamily("file.pathExists", window.RMLI18n.t("ui.literal.da3d6dcb41ad"), window.RMLI18n.t("ui.literal.111884ecbc70"), {
    file: "file.fileExists",
    directory: "file.directoryExists"
  });
  registerCompatibleRuntimeFamily("file.writeOperation", window.RMLI18n.t("ui.literal.263c1d8b7848"), window.RMLI18n.t("ui.literal.3cb003e25074"), {
    overwrite: "file.writeText",
    append: "file.appendText",
    bytes: "file.writeBytes"
  });
  registerCompatibleRuntimeFamily("file.readOperation", window.RMLI18n.t("ui.literal.3d2beb8d0640"), window.RMLI18n.t("ui.literal.8713f250981b"), {
    text: "file.readText",
    bytes: "file.readBytes"
  });
  registerCompatibleRuntimeFamily("file.transfer", window.RMLI18n.t("ui.literal.b36594e5a932"), window.RMLI18n.t("ui.literal.3cb003e25074"), {
    copy: "file.copy",
    move: "file.move"
  });
  registerCompatibleRuntimeFamily("file.pathMutation", window.RMLI18n.t("ui.literal.a09b511f2421"), window.RMLI18n.t("ui.literal.3b678b770cc8"), {
    createDirectory: "file.createDirectory",
    delete: "file.delete"
  });
  registerCompatibleRuntimeFamily("json.createContainer", window.RMLI18n.t("ui.literal.51cddb4a1870"), window.RMLI18n.t("ui.literal.4b8162a8d731"), {
    object: "json.createObject",
    array: "json.createArray"
  });
  registerCompatibleRuntimeFamily("task.waitMany", window.RMLI18n.t("ui.literal.d63e4c677738"), window.RMLI18n.t("ui.literal.48138eaada0d"), {
    all: "task.whenAll",
    any: "task.whenAny"
  });
  registerCompatibleRuntimeFamily("collection.mutateItem", window.RMLI18n.t("ui.literal.b6f3b2d1e680"), window.RMLI18n.t("ui.literal.1d63dc5b8497"), {
    add: "collection.addItem",
    insert: "collection.insertItem",
    remove: "collection.removeItem",
    removeAt: "collection.removeAt",
    clear: "collection.clearList"
  });
  registerCompatibleRuntimeFamily("dictionary.mutate", window.RMLI18n.t("ui.literal.1ee36da653c7"), window.RMLI18n.t("ui.literal.61e2a1c303c2"), {
    set: "dictionary.setValue",
    remove: "dictionary.removeKey"
  });
  registerCompatibleRuntimeFamily("json.mutate", window.RMLI18n.t("ui.literal.ff1a4be28966"), window.RMLI18n.t("ui.literal.b9c6b032ed1f"), {
    setProperty: "json.setProperty",
    removeProperty: "json.removeProperty",
    addArrayItem: "json.addArrayItem"
  });
  registerCompatibleRuntimeFamily("normal.tryParse", window.RMLI18n.t("ui.literal.8a314e6811a0"), window.RMLI18n.t("ui.literal.a060c827642e"), {
    number: "normal.tryParseNumber",
    boolean: "normal.tryParseBoolean"
  });
  registerCompatibleRuntimeFamily("text.combineOperation", window.RMLI18n.t("ui.literal.497da095ff65"), window.RMLI18n.t("ui.literal.0a5dff6cb956"), {
    concat: "text.concat",
    format: "text.format",
    join: "text.join"
  });
  registerNode("cast.operation", {
    title: window.RMLI18n.t("ui.auto.0edf2bf711e0"),
    group: window.RMLI18n.t("ui.literal.b08eaadf77cf"),
    symbol: "→",
    parameters: [
      pSelect("operation", window.RMLI18n.t("ui.literal.9151f8433f79"), [["doubleToFloat", window.RMLI18n.t("ui.auto.ffb7ecf059a9")], ["floatToInt", window.RMLI18n.t("ui.auto.23bc1d7848f1")], ["toString", window.RMLI18n.t("ui.auto.163c64f80b92")]], "doubleToFloat", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })
    ],
    inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "double")],
    outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "float")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "doubleToFloat");
      if (operation === "floatToInt") return { title: window.RMLI18n.t("ui.auto.810fd8cf7a4b"), symbol: "F→I", inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "float")], outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "int")] };
      if (operation === "toString") return { title: window.RMLI18n.t("ui.auto.9f58b37f2a51"), symbol: "→T", inputs: [genericPort("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "T", "value")], outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "string")] };
      return { title: window.RMLI18n.t("ui.auto.0e6e70188a52"), symbol: "D→F", inputs: [port("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "double")], outputs: [port("result", window.RMLI18n.t("ui.auto.ca8a16007fd8"), "float")] };
    },
    codegenExpression(api) {
      const value = api.input("value").code;
      return api.node.parameters?.operation === "floatToInt"
        ? `((int)${value})`
        : api.node.parameters?.operation === "toString"
          ? `FormatValue(${value})`
          : `((float)${value})`;
    },
    previewEvaluate({ node, type, input, known, unknown, format }) {
      const value = input("value");
      if (!value.known) return unknown(type, value.reason);
      return node.parameters?.operation === "toString"
        ? known("string", format(value))
        : known(type, node.parameters?.operation === "floatToInt" ? Math.trunc(value.value) : Number(value.value));
    }
  });
  registerCompatibleRuntimeFamily("network.socketSend", window.RMLI18n.t("ui.literal.788865ffbd9a"), window.RMLI18n.t("ui.literal.180b7d18521a"), {
    tcp: "network.tcpSend",
    udp: "network.udpSend"
  });
  registerCompatibleRuntimeFamily("flow.loop", window.RMLI18n.t("ui.literal.46fba98b3e5a"), window.RMLI18n.t("ui.literal.300a061f8ce5"), {
    while: "flow.whileLoop",
    doWhile: "flow.doWhileLoop"
  });
  registerCompatibleRuntimeFamily("flow.loopControl", window.RMLI18n.t("ui.literal.cfef537fd285"), "↪", {
    break: "flow.break",
    continue: "flow.continue"
  });
  registerCompatibleRuntimeFamily("lifecycle.shutdownEvent", window.RMLI18n.t("ui.literal.29c76d5b7567"), window.RMLI18n.t("ui.literal.c2b6b521a777"), {
    processExit: "lifecycle.processExit",
    modUnload: "lifecycle.modUnload"
  });
  registerCompatibleRuntimeFamily("configuration.visibilityOperation", window.RMLI18n.t("ui.literal.251184d1c538"), window.RMLI18n.t("ui.literal.04058e6b3e28"), {
    item: "configuration.setVisibility",
    label: window.RMLI18n.t("ui.literal.db777089c617")
  });
  registerCompatibleRuntimeFamily("harmony.readPatchValue", window.RMLI18n.t("ui.literal.a5e1c0efff26"), window.RMLI18n.t("ui.literal.5354d4f0f798"), {
    argument: "harmony.patchArgument",
    result: "harmony.patchResult"
  });
  registerCompatibleRuntimeFamily("harmony.writePatchValue", window.RMLI18n.t("ui.literal.c401f7eaa63c"), window.RMLI18n.t("ui.literal.36d74c69c3f3"), {
    argument: "harmony.setArgument",
    result: "harmony.setResult"
  });

  {
    const harmonyDefinition = registry.getNodeDefinition("harmony.patchEvent");
    const lifecyclePresets = {
      worldStart: [window.RMLI18n.t("ui.literal.9ac6dd7e519a"), window.RMLI18n.t("ui.literal.231b3fc8d429"), "FrooxEngine.World", window.RMLI18n.t("ui.literal.0bd1faf074d7")],
      worldDestroy: [window.RMLI18n.t("ui.literal.4318495b28e5"), window.RMLI18n.t("ui.literal.83a86dd559cb"), "FrooxEngine.World", window.RMLI18n.t("ui.literal.9d34c39bf776")],
      userJoin: [window.RMLI18n.t("ui.literal.fb5fcfccb0bf"), window.RMLI18n.t("ui.literal.9de39be68f15"), "FrooxEngine.World", window.RMLI18n.t("ui.literal.fc1192ea5901")],
      userLeave: [window.RMLI18n.t("ui.literal.c245ef87bfc5"), window.RMLI18n.t("ui.literal.e57b26fceb81"), "FrooxEngine.World", window.RMLI18n.t("ui.literal.7edcd4e55626")],
      componentAttach: [window.RMLI18n.t("ui.literal.9a005008703e"), window.RMLI18n.t("ui.literal.8a5ebc115bc7"), "FrooxEngine.Component", window.RMLI18n.t("ui.literal.175f4a81f6c8")],
      componentDestroy: [window.RMLI18n.t("ui.literal.2c3ffdb1abb5"), window.RMLI18n.t("ui.literal.a46c36996215"), "FrooxEngine.Component", window.RMLI18n.t("ui.literal.9d34c39bf776")],
      engineUpdate: [window.RMLI18n.t("ui.literal.3c90d35f073e"), window.RMLI18n.t("ui.literal.52c6c1812015"), "FrooxEngine.Engine", window.RMLI18n.t("ui.literal.fb91e24fa52d")]
    };
    const legacyLifecycleIds = {
      worldStart: "lifecycle.worldStart", worldDestroy: "lifecycle.worldDestroy",
      userJoin: "lifecycle.userJoin", userLeave: "lifecycle.userLeave",
      componentAttach: "lifecycle.componentAttach", componentDestroy: "lifecycle.componentDestroy",
      engineUpdate: "lifecycle.engineUpdate"
    };
    for (const legacyId of Object.values(legacyLifecycleIds)) {
      const definition = registry.getNodeDefinition(legacyId);
      if (definition) definition.hiddenFromPalette = true;
    }
    registerNode("lifecycle.harmonyEvent", {
      title: window.RMLI18n.t("ui.auto.b18fd8a950d5"),
      group: window.RMLI18n.t("ui.literal.033df3d297c2"),
      symbol: "LIFE",
      parameters: [
        pSelect("operation", window.RMLI18n.t("ui.auto.9162bc274ebc"), Object.entries(lifecyclePresets).map(([value, preset]) => [value, preset[0]]), "worldStart", "", { affectsPorts: true, affectsNode: true, commitImmediately: true }),
        pSelect("patchKind", window.RMLI18n.t("ui.literal.610d75ebc6c6"), ["prefix", "postfix", "finalizer"], "postfix"),
        pText("targetTypeOverride", window.RMLI18n.t("ui.literal.996744e99386"), "", window.RMLI18n.t("ui.literal.3776b33e6ca0")),
        pText("targetMethodOverride", window.RMLI18n.t("ui.literal.826408e978f7"), "", window.RMLI18n.t("ui.literal.3776b33e6ca0")),
        pText("argumentTypes", window.RMLI18n.t("ui.auto.631184b96d50"), ""),
        pNumber("priority", window.RMLI18n.t("ui.literal.0d5118820149"), 400),
        pBool("captureResult", window.RMLI18n.t("ui.literal.e7288b2c2cc7"), false)
      ],
      outputs: [port("called", window.RMLI18n.t("ui.auto.6e8b938b82e2"), "impulse"), port("context", window.RMLI18n.t("ui.auto.ada776fb609f"), "patchContext")],
      resolveDefinition(node) {
        const preset = lifecyclePresets[node.parameters?.operation] || lifecyclePresets.worldStart;
        return { title: `Lifecycle · ${preset[0]}`, symbol: preset[1] };
      },
      codegenCollect(api) {
        const preset = lifecyclePresets[api.node.parameters?.operation] || lifecyclePresets.worldStart;
        const node = {
          ...api.node,
          parameters: {
            ...api.node.parameters,
            targetType: String(api.node.parameters?.targetTypeOverride || "").trim() || preset[2],
            targetMethod: String(api.node.parameters?.targetMethodOverride || "").trim() || preset[3]
          }
        };
        return harmonyDefinition.codegenCollect({ ...api, node });
      },
      codegenExpression(api) {
        return harmonyDefinition.codegenExpression(api);
      }
    });
  }

  for (const legacyId of [
    "math.add", "math.subtract", "math.multiply", "math.divide", "math.modulo", "math.power", "math.minimum", "math.maximum",
    "math.negate", "math.absolute", "math.squareRoot", "math.round", "math.floor", "math.ceiling",
    "logic.and", "logic.or", "logic.not", "logic.equal", "logic.greater", "logic.less",
    "text.contains", "text.startsWith", "text.endsWith", "text.replace", "text.trim", "text.changeCase",
    "normal.isNull", "normal.isNotNull", "normal.tryParseNumber", "normal.tryParseBoolean", "file.fileExists", "file.directoryExists", "file.readText", "file.readBytes", "file.writeText", "file.appendText", "file.writeBytes",
    "file.copy", "file.move", "file.createDirectory", "file.delete", "json.createObject", "json.createArray",
    "task.whenAll", "task.whenAny", "collection.addItem", "collection.insertItem", "collection.removeItem", "collection.removeAt", "collection.clearList", "dictionary.setValue", "dictionary.removeKey", "json.setProperty", "json.removeProperty", "json.addArrayItem", "text.concat", "text.format", "text.join", "cast.doubleToFloat", "cast.floatToInt", "cast.toString", "network.tcpSend", "network.udpSend",
    "flow.whileLoop", "flow.doWhileLoop", "flow.break", "flow.continue", "lifecycle.processExit", "lifecycle.modUnload",
    "configuration.setVisibility", "configuration.setLabelVisibility", "harmony.patchArgument", "harmony.patchResult",
    "harmony.setArgument", "harmony.setResult", "lifecycle.worldStart", "lifecycle.worldDestroy", "lifecycle.userJoin",
    "lifecycle.userLeave", "lifecycle.componentAttach", "lifecycle.componentDestroy", "lifecycle.engineUpdate"
  ]) {
    const definition = registry.getNodeDefinition(legacyId);
    if (definition) {
      definition.hiddenFromPalette = true;
      definition.internalFamilyImplementation = true;
    }
  }

  for (const [id, definition] of Object.entries(
    registry.getNodeDefinitions()
  )) {
    if (id.startsWith("reflection.")) {
      definition.expertOnly = true;
    }
  }

  registerCodegenPlugin({
    collect(api) {
      const nodes = Array.isArray(api.nodes)
        ? api.nodes
        : [];

      const selectedRuntimeTypes = new Set();

      for (const node of nodes) {
        const configuredType =
          node?.kind === "operator"
            ? node.parameters?.valueType
            : null;

        if (
          typeof configuredType === "string" &&
          configuredType &&
          configuredType !== "auto"
        ) {
          selectedRuntimeTypes.add(
            configuredType
          );
        }
      }

      if (
        selectedRuntimeTypes.has(
          "httpResponse"
        )
      ) {
        ensureNetworkRuntime(api);
      }

      if (
        selectedRuntimeTypes.has(
          "patchContext"
        )
      ) {
        ensureHarmonyRuntime(api);
      }

      const mainMembers = [];
      const mainMemberUsings =
        new Set([
          window.RMLI18n.t("ui.literal.bc0792d8dc81"),
          window.RMLI18n.t("ui.literal.49700a21b323")
        ]);
      let advancedCodeUsed = false;
      const earlyPatchFiles = [];
      const earlyPatchOrders = new Set();
      const earlyPatchPackageReferences =
        new Map();
      const earlyPatchFrameworkReferences =
        new Set();
      const earlyPatchRequirements = {
        allowUnsafeBlocks: false,
        useWindowsForms: false,
        usesElements: false,
        usesRenderiteShared: false
      };

      const manualProjectReferences =
        nodes
          .filter(node =>
            node?.kind === "operator" &&
            node.operatorId === "csharp.reference" &&
            String(node.parameters?.projectId || "main") === "main" &&
            String(node.parameters?.referenceKind || "assembly") === "assembly"
          )
          .map(node => ({
            include: String(
              node.parameters?.include || ""
            ).trim(),
            hintPath: String(
              node.parameters?.hintPath || ""
            ).trim(),
            private:
              node.parameters?.private ===
              true
          }))
          .filter(reference =>
            reference.include
          );

      const manualProjectPackages =
        nodes
          .filter(node =>
            node?.kind === "operator" &&
            node.operatorId === "csharp.reference" &&
            String(node.parameters?.projectId || "main") === "main" &&
            String(node.parameters?.referenceKind || "assembly") === "package"
          )
          .map(node => ({
            include: String(
              node.parameters?.include || ""
            ).trim(),
            version: String(
              node.parameters?.version || ""
            ).trim(),
            privateAssets: String(
              node.parameters?.privateAssets || ""
            ).trim(),
            includeAssets: String(
              node.parameters?.includeAssets || ""
            ).trim()
          }))
          .filter(packageReference =>
            packageReference.include &&
            packageReference.version
          );

      const manualProjectFrameworks =
        nodes
          .filter(node =>
            node?.kind === "operator" &&
            node.operatorId === "csharp.reference" &&
            String(node.parameters?.projectId || "main") === "main" &&
            String(node.parameters?.referenceKind || "assembly") === "framework"
          )
          .map(node =>
            String(
              node.parameters?.include || ""
            ).trim()
          )
          .filter(Boolean);

      for (const node of nodes) {
        if (
          !node ||
          node.kind !== "operator"
        ) {
          continue;
        }

        const rawSource =
          node.operatorId === "csharp.file" && ["action", "expression", "runtimeMember", "mainMember"].includes(node.parameters?.mode)
            ? node.operatorId === "csharp.file"
              ? node.parameters?.mode === "expression"
                ? node.parameters?.expressionCode
                : ["runtimeMember", "mainMember"].includes(node.parameters?.mode)
                  ? node.parameters?.memberCode
                  : node.parameters?.actionCode
              : node.parameters?.code
            : node.operatorId === "harmony.exactPatchSource" ||
                node.operatorId === "harmony.earlyPatchSource"
              ? node.parameters?.content
              : "";

        let rawDependencies = null;

        if (rawSource) {
          const nodeApi = {
            ...api,
            node,
            definition:
              api.definitions?.[
                node.operatorId
              ]
          };
          const earlyPatchSource =
            node.operatorId ===
              "harmony.earlyPatchSource";
          const addUsings =
            node.operatorId !== "harmony.exactPatchSource" &&
            node.operatorId !== "harmony.earlyPatchSource" &&
            !(node.operatorId === "csharp.file" && node.parameters?.mode === "mainMember");

          rawDependencies =
            earlyPatchSource
              ? analyzeRawCSharpDependencies(
                  rawSource
                )
              : applyRawCSharpDependencies(
                  nodeApi,
                  rawSource,
                  { addUsings }
                );

          if (
            node.operatorId === "csharp.file" &&
            node.parameters?.mode === "mainMember"
          ) {
            for (const namespaceName of
              rawDependencies.usings) {
              mainMemberUsings.add(
                namespaceName
              );
            }
          }
        }

        switch (node.operatorId) {
          case "csharp.using": {
            const value = String(
              node.parameters?.namespace || ""
            ).trim();
            if (value) {
              api.addUsing(value);
            }
            break;
          }

          case "csharp.buildOptions":
            api.require(
              "allowUnsafeBlocks",
              node.parameters?.unsafe === true
            );
            api.require(
              "useWindowsForms",
              node.parameters?.windowsForms ===
                true
            );
            break;

          case "csharp.file": {
            const mode = node.parameters?.mode;
            if (mode === "mainMember") {
              const code = replaceCodePlaceholders(
                node.parameters?.memberCode,
                {
                  ...api,
                  node,
                  definition:
                    api.definitions?.[
                      node.operatorId
                    ]
                }
              ).trim();
              if (code) {
                mainMembers.push(code);
              }
            }
            if (["action", "expression", "runtimeMember", "mainMember"].includes(mode)) {
              advancedCodeUsed = true;
            }
            break;
          }

          case "harmony.exactPatchSource": {
            ensureHarmonyRuntime({
              ...api,
              node,
              definition:
                api.definitions?.[
                  node.operatorId
                ]
            });
            const fileName = String(
              node.parameters?.fileName ||
                window.RMLI18n.t("ui.literal.569b5ecc50e3")
            ).trim();
            const content =
              replaceCodePlaceholders(
                node.parameters?.content,
                {
                  ...api,
                  node,
                  definition:
                    api.definitions?.[
                      node.operatorId
                    ]
                }
              );
            api.addFile({
              name: fileName,
              content
            });
            api.addEngineInit(
              "RegisterGeneratedHarmonyAttributePatches();"
            );
            advancedCodeUsed = true;
            break;
          }

          case "harmony.earlyPatchSource": {
            const fileName = String(
              node.parameters?.fileName ||
                window.RMLI18n.t("ui.literal.b902374d9e55")
            ).trim();
            const content =
              replaceCodePlaceholders(
                node.parameters?.content,
                {
                  ...api,
                  node,
                  definition:
                    api.definitions?.[
                      node.operatorId
                    ]
                }
              );

            earlyPatchFiles.push({
              name: fileName,
              content
            });
            earlyPatchOrders.add(
              Number.isFinite(
                Number(
                  node.parameters?.loadOrder
                )
              )
                ? Math.trunc(
                    Number(
                      node.parameters?.loadOrder
                    )
                  )
                : 0
            );

            if (rawDependencies) {
              earlyPatchRequirements
                .allowUnsafeBlocks ||=
                  rawDependencies
                    .allowUnsafeBlocks;
              earlyPatchRequirements
                .useWindowsForms ||=
                  rawDependencies
                    .useWindowsForms;
              earlyPatchRequirements
                .usesElements ||=
                  rawDependencies
                    .usesElements;
              earlyPatchRequirements
                .usesRenderiteShared ||=
                  rawDependencies
                    .usesRenderiteShared;

              for (const packageReference of
                rawDependencies
                  .packageReferences || []) {
                earlyPatchPackageReferences.set(
                  String(
                    packageReference.include ||
                    ""
                  ).toLowerCase(),
                  packageReference
                );
              }

              for (const frameworkReference of
                rawDependencies
                  .frameworkReferences || []) {
                earlyPatchFrameworkReferences.add(
                  frameworkReference
                );
              }
            }

            advancedCodeUsed = true;
            break;
          }
        }
      }

      if (earlyPatchFiles.length > 0) {
        const projectName =
          `${api.className}.HarmonyPatches`;
        const harmonyId =
          `${api.namespaceName}.${projectName}`;
        const loadOrder =
          Math.min(...earlyPatchOrders);

        if (earlyPatchOrders.size > 1) {
          api.warning(
            `All Early Harmony Patch Source nodes are compiled into one rml_libs assembly. Their differing patch orders were reduced to the earliest value (${loadOrder}).`
          );
        }

        for (const packageReference of
          manualProjectPackages) {
          earlyPatchPackageReferences.set(
            packageReference.include
              .toLowerCase(),
            packageReference
          );
        }

        for (const frameworkReference of
          manualProjectFrameworks) {
          earlyPatchFrameworkReferences.add(
            frameworkReference
          );
        }

        const buildOptions =
          nodes.find(node =>
            node?.kind === "operator" &&
            node.operatorId ===
              "csharp.buildOptions"
          );

        earlyPatchRequirements
          .allowUnsafeBlocks ||=
            buildOptions?.parameters?.unsafe ===
            true;
        earlyPatchRequirements
          .useWindowsForms ||=
            buildOptions?.parameters
              ?.windowsForms === true;

        const references = [
          {
            include: "0Harmony",
            hintPath:
              "$(ResonitePath)rml_libs/0Harmony.dll",
            private: false
          },
          ...manualProjectReferences
        ];

        if (
          earlyPatchRequirements.usesElements
        ) {
          references.push({
            include: "Elements.Core",
            hintPath:
              "$(ResonitePath)Elements.Core.dll",
            private: false
          });
        }

        if (
          earlyPatchRequirements
            .usesRenderiteShared
        ) {
          references.push({
            include: window.RMLI18n.t("ui.literal.38b9a2fd4ae5"),
            hintPath:
              "$(ResonitePath)Renderite.Shared.dll",
            private: false
          });
        }

        api.addProject({
          id: "generated-early-harmony-patches",
          role: "rml-lib-harmony-patches",
          name: projectName,
          assemblyName: projectName,
          rootNamespace:
            `${api.namespaceName}.EarlyPatches`,
          folder: window.RMLI18n.t("ui.literal.1441985a96b3"),
          deployDirectory: "rml_libs",
          files: [
            {
              name:
                window.RMLI18n.t("ui.literal.c895369b58ee"),
              content:
`${generatedGuidance(
  api,
  "patchRegistration"
)}
[assembly: ResoniteModLoader.RmlPatchAssembly(
    "${api.escapeString(harmonyId)}",
    ${loadOrder})]
`
            },
            ...earlyPatchFiles
          ],
          requirements: {
            ...earlyPatchRequirements,
            references,
            packageReferences:
              [...earlyPatchPackageReferences
                .values()],
            frameworkReferences:
              [...earlyPatchFrameworkReferences]
          }
        });

        api.warning(
          window.RMLI18n.t("ui.literal.5b48154c14c8")
        );
      }

      const scannedHarmonyApiNodes =
        nodes.filter(node =>
          node?.kind === "operator" &&
          api.definitions?.[
            node.operatorId
          ]?.harmonyApiNode === true
        );

      if (scannedHarmonyApiNodes.length > 0) {
        api.addReference({
          include: "0Harmony",
          hintPath:
            "$(ResonitePath)rml_libs/0Harmony.dll",
          private: false
        });

        api.warning(
          `${scannedHarmonyApiNodes.length} scanner-generated HarmonyLib API node${scannedHarmonyApiNodes.length === 1 ? " is" : "s are"} used as low-level runtime calls in the main mod project. They are not automatically converted into early rml_libs patches; use Harmony Patch Event for graph callbacks or Early Harmony Patch Library for pre-mod attribute patches.`
        );
      }

      if (mainMembers.length > 0) {
        const indented = mainMembers
          .map(member =>
            member
              .split("\n")
              .map(line =>
                line.length > 0
                  ? `    ${line}`
                  : ""
              )
              .join("\n")
          )
          .join("\n\n");

        const usingLines =
          [...mainMemberUsings]
            .sort((left, right) =>
              left.localeCompare(right)
            )
            .map(namespaceName =>
              `using ${namespaceName};`
            )
            .join("\n");

        api.addFile({
          name:
            `${api.className}.Custom.cs`,
          content:
`${usingLines}

namespace ${api.namespaceName};

public sealed partial class ${api.className}
{
${indented}
}
`
        });
      }

      if (advancedCodeUsed) {
        reportGuidance(
          api,
          "advancedSource"
        );
      }

    }
  });
})();
