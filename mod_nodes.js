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
    "getTypeDefinitions"
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
      "RML universal mod nodes require a compatible node_graph.js registry with the documented registration and type-discovery capabilities."
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
    "Advanced / Raw C#";

  const NUMERIC_VECTOR_TYPES = [
    "int2",
    "int3",
    "int4",
    "float2",
    "float3",
    "float4",
    "double2",
    "double3",
    "double4"
  ];

  const COMMON_VALUE_TYPES = [
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

  const JSON_CONVERTIBLE_TYPES = [
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
    "colorX",
    "object",
    "byteArray",
    "stringArray",
    "objectArray"
  ];

  const typeDefinitions = {
    object: {
      label: "Object",
      short: "OBJ",
      color: "#bcc7d2",
      csType: "object",
      defaultCs: "null!",
      acceptsAnyValue: true,
      referenceType: true,
      constraints: ["reference", "serializable"]
    },
    byteArray: {
      label: "Byte array",
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
      label: "String array",
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
      label: "Object array",
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
      label: "System.Type",
      short: "TYPE",
      color: "#76c6ff",
      csType: "System.Type",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    memberInfo: {
      label: "MemberInfo",
      short: "MEM",
      color: "#70bce8",
      csType: "System.Reflection.MemberInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    methodBase: {
      label: "MethodBase",
      short: "MBASE",
      color: "#5fb7ee",
      csType: "System.Reflection.MethodBase",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["memberInfo", "object"]
    },
    methodInfo: {
      label: "MethodInfo",
      short: "METH",
      color: "#4eace6",
      csType: "System.Reflection.MethodInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["methodBase", "memberInfo", "object"]
    },
    fieldInfo: {
      label: "FieldInfo",
      short: "FIELD",
      color: "#4fc6c8",
      csType: "System.Reflection.FieldInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["memberInfo", "object"]
    },
    propertyInfo: {
      label: "PropertyInfo",
      short: "PROP",
      color: "#52d2b4",
      csType: "System.Reflection.PropertyInfo",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["memberInfo", "object"]
    },
    exception: {
      label: "Exception",
      short: "EX",
      color: "#ff7188",
      csType: "System.Exception",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    patchContext: {
      label: "Harmony patch context",
      short: "PATCH",
      color: "#ef9e68",
      csType: "PatchContext",
      defaultCs: "new PatchContext()",
      referenceType: true,
      assignableTo: ["object"]
    },
    floatQ: {
      label: "Quaternion",
      short: "QUAT",
      color: "#61d3ff",
      csType: "Elements.Core.floatQ",
      defaultCs: "Elements.Core.floatQ.Identity",
      assembly: "Elements.Core"
    },
    primitive: {
      label: "Primitive",
      short: "PRIM",
      color: "#f2c66d",
      csType: "FrooxEngine.Primitive",
      defaultCs: "FrooxEngine.Primitive.Cube"
    },
    blendMode: {
      label: "Blend mode",
      short: "BLEND",
      color: "#ff9c75",
      csType: "FrooxEngine.BlendMode",
      defaultCs: "FrooxEngine.BlendMode.Opaque"
    },
    textureWrapMode: {
      label: "Texture wrap mode",
      short: "WRAP",
      color: "#ffb86a",
      csType: "Renderite.Shared.TextureWrapMode",
      defaultCs: "Renderite.Shared.TextureWrapMode.Repeat",
      assembly: "Renderite.Shared"
    },
    engine: {
      label: "Resonite Engine",
      short: "ENG",
      color: "#67d6ff",
      csType: "FrooxEngine.Engine",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    world: {
      label: "Resonite World",
      short: "WORLD",
      color: "#62e4c4",
      csType: "FrooxEngine.World",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    user: {
      label: "Resonite User",
      short: "USER",
      color: "#65dcb1",
      csType: "FrooxEngine.User",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    slot: {
      label: "Resonite Slot",
      short: "SLOT",
      color: "#8ae271",
      csType: "FrooxEngine.Slot",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    component: {
      label: "Resonite Component",
      short: "COMP",
      color: "#a4df64",
      csType: "FrooxEngine.Component",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    uiBuilder: {
      label: "UIBuilder",
      short: "UIB",
      color: "#de8cff",
      csType: "FrooxEngine.UIX.UIBuilder",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    uiElement: {
      label: "UI element",
      short: "UI",
      color: "#f18ce6",
      csType: "object",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    asset: {
      label: "Asset provider",
      short: "ASSET",
      color: "#f6c75c",
      csType: "FrooxEngine.IAssetProvider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    texture: {
      label: "Texture 2D provider",
      short: "TEX",
      color: "#ffb655",
      csType: "FrooxEngine.IAssetProvider<FrooxEngine.ITexture2D>",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    material: {
      label: "Material provider",
      short: "MAT",
      color: "#f4a261",
      csType: "FrooxEngine.IAssetProvider<FrooxEngine.Material>",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    commonMaterial: {
      label: "Common material",
      short: "CMAT",
      color: "#f39a64",
      csType: "FrooxEngine.ICommonMaterial",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["material", "asset", "object"]
    },
    pbsMaterial: {
      label: "PBS material",
      short: "PBS",
      color: "#f18c5d",
      csType: "FrooxEngine.PBS_Material",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["commonMaterial", "material", "asset", "component", "object"]
    },
    pbsMetallic: {
      label: "PBS Metallic",
      short: "PBS-M",
      color: "#ef8057",
      csType: "FrooxEngine.PBS_Metallic",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["pbsMaterial", "commonMaterial", "material", "asset", "component", "object"]
    },
    pbsSpecular: {
      label: "PBS Specular",
      short: "PBS-S",
      color: "#ee7c6d",
      csType: "FrooxEngine.PBS_Specular",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["pbsMaterial", "commonMaterial", "material", "asset", "component", "object"]
    },
    unlitMaterial: {
      label: "Unlit material",
      short: "UNLIT",
      color: "#ef9b6c",
      csType: "FrooxEngine.UnlitMaterial",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["commonMaterial", "material", "asset", "component", "object"]
    },
    mesh: {
      label: "Mesh provider",
      short: "MESH",
      color: "#dfbd69",
      csType: "FrooxEngine.IAssetProvider<FrooxEngine.Mesh>",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    audioClip: {
      label: "Audio clip provider",
      short: "AUD",
      color: "#d8d66a",
      csType: "FrooxEngine.IAssetProvider<FrooxEngine.AudioClip>",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "object"]
    },
    meshRenderer: {
      label: "Mesh Renderer",
      short: "RENDER",
      color: "#d5b56a",
      csType: "FrooxEngine.MeshRenderer",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    collider: {
      label: "Collider",
      short: "COL",
      color: "#cfca73",
      csType: "FrooxEngine.Collider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    meshCollider: {
      label: "Mesh Collider",
      short: "MCOL",
      color: "#c9c56a",
      csType: "FrooxEngine.MeshCollider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["collider", "component", "object"]
    },
    boxCollider: {
      label: "Box Collider",
      short: "BCOL",
      color: "#c6c267",
      csType: "FrooxEngine.BoxCollider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["collider", "component", "object"]
    },
    sphereCollider: {
      label: "Sphere Collider",
      short: "SCOL",
      color: "#c4c065",
      csType: "FrooxEngine.SphereCollider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["collider", "component", "object"]
    },
    cylinderCollider: {
      label: "Cylinder Collider",
      short: "CCOL",
      color: "#c2be63",
      csType: "FrooxEngine.CylinderCollider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["collider", "component", "object"]
    },
    quadMesh: {
      label: "Quad Mesh",
      short: "QUAD",
      color: "#e0bf70",
      csType: "FrooxEngine.QuadMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    boxMesh: {
      label: "Box Mesh",
      short: "BOX",
      color: "#dfbb6b",
      csType: "FrooxEngine.BoxMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    sphereMesh: {
      label: "Sphere Mesh",
      short: "SPHERE",
      color: "#ddb767",
      csType: "FrooxEngine.SphereMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    cylinderMesh: {
      label: "Cylinder Mesh",
      short: "CYL",
      color: "#dbb363",
      csType: "FrooxEngine.CylinderMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    arrowMesh: {
      label: "Arrow Mesh",
      short: "ARROW",
      color: "#d9af60",
      csType: "FrooxEngine.ArrowMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    staticTexture2D: {
      label: "Static Texture 2D",
      short: "STEX",
      color: "#ffb35a",
      csType: "FrooxEngine.StaticTexture2D",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["texture", "asset", "component", "object"]
    },
    staticCubemap: {
      label: "Static Cubemap",
      short: "CUBE-T",
      color: "#ffad58",
      csType: "FrooxEngine.StaticCubemap",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "component", "object"]
    },
    spriteProvider: {
      label: "Sprite Provider",
      short: "SPRITE",
      color: "#ffa957",
      csType: "FrooxEngine.SpriteProvider",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "component", "object"]
    },
    staticMesh: {
      label: "Static Mesh",
      short: "SMESH",
      color: "#d8b05f",
      csType: "FrooxEngine.StaticMesh",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["mesh", "asset", "component", "object"]
    },
    staticAudioClip: {
      label: "Static Audio Clip",
      short: "SAUD",
      color: "#d4d366",
      csType: "FrooxEngine.StaticAudioClip",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["audioClip", "asset", "component", "object"]
    },
    staticFont: {
      label: "Static Font",
      short: "FONT",
      color: "#e0cb72",
      csType: "FrooxEngine.StaticFont",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["asset", "component", "object"]
    },
    skybox: {
      label: "Skybox",
      short: "SKY",
      color: "#879bea",
      csType: "FrooxEngine.Skybox",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    grabbable: {
      label: "Grabbable",
      short: "GRAB",
      color: "#8fdf83",
      csType: "FrooxEngine.Grabbable",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    audioOutput: {
      label: "Audio Output",
      short: "AOUT",
      color: "#d0d15f",
      csType: "FrooxEngine.AudioOutput",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    dynamicVariableSpace: {
      label: "Dynamic Variable Space",
      short: "DVS",
      color: "#57d6b8",
      csType: "FrooxEngine.DynamicVariableSpace",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    radiantDash: {
      label: "Radiant Dash",
      short: "DASH",
      color: "#ffbd68",
      csType: "FrooxEngine.RadiantDash",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["component", "object"]
    },
    json: {
      label: "JSON node",
      short: "JSON",
      color: "#e9c26b",
      csType: "System.Text.Json.Nodes.JsonNode",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    httpResponse: {
      label: "HTTP response",
      short: "HTTP",
      color: "#53d4e8",
      csType: "GraphHttpResponse",
      defaultCs: "GraphHttpResponse.Empty",
      referenceType: true,
      assignableTo: ["object"]
    },
    webSocket: {
      label: "WebSocket",
      short: "WS",
      color: "#46cfe2",
      csType: "System.Net.WebSockets.ClientWebSocket",
      defaultCs: "null!",
      referenceType: true,
      assignableTo: ["object"]
    },
    task: {
      label: "Task",
      short: "TASK",
      color: "#b8a2ff",
      csType: "System.Threading.Tasks.Task",
      defaultCs: "System.Threading.Tasks.Task.CompletedTask",
      referenceType: true,
      assignableTo: ["object"]
    },
    cancellationToken: {
      label: "CancellationToken",
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
        short: "ENUM",
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
    ["Configuration Menu", { after: "Flow" }],
    ["Visual C# Language", { after: "Flow" }],
    ["Transforms", { after: "Math" }],
    ["Collections", { after: "Flow" }],
    ["Harmony", { after: "Lifecycle" }],
    ["Reflection", { after: "Harmony" }],
    ["Slots & Components", { after: "Debug & Output" }],
    ["Attach & Create", { after: "Slots & Components" }],
    ["Materials & Rendering", { after: "Attach & Create" }],
    ["UI", { after: "Materials & Rendering" }],
    ["Assets", { after: "UI" }],
    ["Files & JSON", { after: "Assets" }],
    ["Networking", { after: "Files & JSON" }],
    ["Tasks & Threading", { after: "Networking" }],
    [RAW_CSHARP_GROUP, { after: "Tasks & Threading" }]
  ];

  for (const [name, options] of groups) {
    registerGroup(name, options);
  }

  registerType(
    "rmlConfigurationMenu",
    {
      label: "Configuration Menu",
      short: "MENU",
      color: "#b47cff",
      csType:
        "RuntimeConfigurationMenuHandle",
      defaultCs:
        "RuntimeConfigurationMenuHandle.Instance",
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
      label: "Configuration Menu Item",
      short: "ITEM",
      color: "#d09cff",
      csType:
        "RuntimeConfigurationMenuItem",
      defaultCs:
        "RuntimeConfigurationMenuItem.Empty",
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
      label: "Action",
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
      String.raw`
internal sealed class RuntimeConfigurationMenuHandle
{
    private RuntimeConfigurationMenuHandle()
    {
    }

    public static RuntimeConfigurationMenuHandle Instance { get; } =
        new RuntimeConfigurationMenuHandle();
}

internal sealed class RuntimeConfigurationMenuItem
{
    private RuntimeConfigurationMenuItem(string itemId)
    {
        ItemId = itemId ?? string.Empty;
    }

    public string ItemId { get; }

    public static RuntimeConfigurationMenuItem Empty { get; } =
        new RuntimeConfigurationMenuItem(string.Empty);

    public static RuntimeConfigurationMenuItem Create(string itemId) =>
        new RuntimeConfigurationMenuItem(itemId);
}

private static readonly object _runtimeConfigurationMenuLock = new();
private static readonly Dictionary<string, bool>
    _runtimeConfigurationMenuVisibility =
        new(StringComparer.Ordinal);
private static readonly Dictionary<string, int>
    _runtimeConfigurationMenuOrder =
        new(StringComparer.Ordinal);
private static readonly Dictionary<string, bool>
    _runtimeConfigurationMenuHorizontalLayout =
        new(StringComparer.Ordinal);
private static readonly Dictionary<string, float>
    _runtimeConfigurationMenuWidthPercent =
        new(StringComparer.Ordinal);
private static readonly Dictionary<string, bool>
    _runtimeConfigurationMenuLabelVisibility =
        new(StringComparer.Ordinal);
private static Func<string, object?, bool, bool>?
    _runtimeConfigurationMenuValueSetter;
private static Func<bool>?
    _runtimeConfigurationMenuDraftSaver;
private static long _runtimeConfigurationMenuRevision;
private static long _runtimeConfigurationValueRevision;

public static long RuntimeConfigurationMenuRevision =>
    Interlocked.Read(
        ref _runtimeConfigurationMenuRevision);

public static long RuntimeConfigurationValueRevision =>
    Interlocked.Read(
        ref _runtimeConfigurationValueRevision);

public static void BindRuntimeConfigurationMenu(
    Func<string, object?, bool, bool>? valueSetter,
    Func<bool>? draftSaver)
{
    lock (_runtimeConfigurationMenuLock)
    {
        _runtimeConfigurationMenuValueSetter =
            valueSetter;
        _runtimeConfigurationMenuDraftSaver =
            draftSaver;
    }
}

private static bool SaveRuntimeConfigurationMenuSettings()
{
    Func<bool>? saver;

    lock (_runtimeConfigurationMenuLock)
    {
        saver =
            _runtimeConfigurationMenuDraftSaver;
    }

    try
    {
        return saver?.Invoke() == true;
    }
    catch
    {
        return false;
    }
}

public static bool TryGetRuntimeConfigurationMenuVisibility(
    string itemId,
    out bool visible)
{
    lock (_runtimeConfigurationMenuLock)
    {
        return _runtimeConfigurationMenuVisibility.TryGetValue(
            itemId ?? string.Empty,
            out visible);
    }
}

public static bool TryGetRuntimeConfigurationMenuOrder(
    string itemId,
    out int order)
{
    lock (_runtimeConfigurationMenuLock)
    {
        return _runtimeConfigurationMenuOrder.TryGetValue(
            itemId ?? string.Empty,
            out order);
    }
}

public static bool TryGetRuntimeConfigurationMenuHorizontalLayout(
    string itemId,
    out bool horizontal)
{
    lock (_runtimeConfigurationMenuLock)
    {
        return _runtimeConfigurationMenuHorizontalLayout.TryGetValue(
            itemId ?? string.Empty,
            out horizontal);
    }
}

public static bool TryGetRuntimeConfigurationMenuWidthPercent(
    string itemId,
    out float widthPercent)
{
    lock (_runtimeConfigurationMenuLock)
    {
        return _runtimeConfigurationMenuWidthPercent.TryGetValue(
            itemId ?? string.Empty,
            out widthPercent);
    }
}

public static bool TryGetRuntimeConfigurationMenuLabelVisibility(
    string itemId,
    out bool visible)
{
    lock (_runtimeConfigurationMenuLock)
    {
        return _runtimeConfigurationMenuLabelVisibility.TryGetValue(
            itemId ?? string.Empty,
            out visible);
    }
}

private static void SetRuntimeConfigurationMenuVisibility(
    RuntimeConfigurationMenuItem item,
    bool visible)
{
    if (item is null ||
        string.IsNullOrEmpty(item.ItemId))
    {
        return;
    }

    bool changed;
    lock (_runtimeConfigurationMenuLock)
    {
        changed =
            !_runtimeConfigurationMenuVisibility.TryGetValue(
                item.ItemId,
                out bool current) ||
            current != visible;

        _runtimeConfigurationMenuVisibility[item.ItemId] =
            visible;
    }

    if (changed)
    {
        Interlocked.Increment(
            ref _runtimeConfigurationMenuRevision);
    }
}

private static void SetRuntimeConfigurationMenuOrder(
    RuntimeConfigurationMenuItem item,
    int order)
{
    if (item is null ||
        string.IsNullOrEmpty(item.ItemId))
    {
        return;
    }

    bool changed;
    lock (_runtimeConfigurationMenuLock)
    {
        changed =
            !_runtimeConfigurationMenuOrder.TryGetValue(
                item.ItemId,
                out int current) ||
            current != order;

        _runtimeConfigurationMenuOrder[item.ItemId] =
            order;
    }

    if (changed)
    {
        Interlocked.Increment(
            ref _runtimeConfigurationMenuRevision);
    }
}

private static void SetRuntimeConfigurationMenuHorizontalLayout(
    RuntimeConfigurationMenuItem item,
    bool horizontal)
{
    if (item is null ||
        string.IsNullOrEmpty(item.ItemId))
    {
        return;
    }

    bool changed;
    lock (_runtimeConfigurationMenuLock)
    {
        changed =
            !_runtimeConfigurationMenuHorizontalLayout.TryGetValue(
                item.ItemId,
                out bool current) ||
            current != horizontal;

        _runtimeConfigurationMenuHorizontalLayout[item.ItemId] =
            horizontal;
    }

    if (changed)
    {
        Interlocked.Increment(
            ref _runtimeConfigurationMenuRevision);
    }
}

private static void SetRuntimeConfigurationMenuWidthPercent(
    RuntimeConfigurationMenuItem item,
    float widthPercent)
{
    if (item is null ||
        string.IsNullOrEmpty(item.ItemId))
    {
        return;
    }

    float normalized =
        float.IsNaN(widthPercent) ||
        float.IsInfinity(widthPercent)
            ? 1f
            : Math.Max(
                1f,
                Math.Min(
                    100f,
                    widthPercent));
    bool changed;
    lock (_runtimeConfigurationMenuLock)
    {
        changed =
            !_runtimeConfigurationMenuWidthPercent.TryGetValue(
                item.ItemId,
                out float current) ||
            Math.Abs(current - normalized) > 0.0001f;

        _runtimeConfigurationMenuWidthPercent[item.ItemId] =
            normalized;
    }

    if (changed)
    {
        Interlocked.Increment(
            ref _runtimeConfigurationMenuRevision);
    }
}

private static void SetRuntimeConfigurationMenuLabelVisibility(
    RuntimeConfigurationMenuItem item,
    bool visible)
{
    if (item is null ||
        string.IsNullOrEmpty(item.ItemId))
    {
        return;
    }

    bool changed;
    lock (_runtimeConfigurationMenuLock)
    {
        changed =
            !_runtimeConfigurationMenuLabelVisibility.TryGetValue(
                item.ItemId,
                out bool current) ||
            current != visible;

        _runtimeConfigurationMenuLabelVisibility[item.ItemId] =
            visible;
    }

    if (changed)
    {
        Interlocked.Increment(
            ref _runtimeConfigurationMenuRevision);
    }
}

private static void SetRuntimeConfigurationMenuValue(
    RuntimeConfigurationMenuItem item,
    object? value,
    bool save)
{
    if (item is null ||
        string.IsNullOrEmpty(item.ItemId))
    {
        return;
    }

    Func<string, object?, bool, bool>? setter;
    lock (_runtimeConfigurationMenuLock)
    {
        setter =
            _runtimeConfigurationMenuValueSetter;
    }

    if (setter?.Invoke(
            item.ItemId,
            value,
            save) == true)
    {
        Interlocked.Increment(
            ref _runtimeConfigurationValueRevision);
        Interlocked.Increment(
            ref _runtimeConfigurationMenuRevision);
    }
}

private static void ResetRuntimeConfigurationMenuItem(
    RuntimeConfigurationMenuItem item)
{
    if (item is null ||
        string.IsNullOrEmpty(item.ItemId))
    {
        return;
    }

    bool changed;
    lock (_runtimeConfigurationMenuLock)
    {
        changed =
            _runtimeConfigurationMenuVisibility.Remove(
                item.ItemId) |
            _runtimeConfigurationMenuOrder.Remove(
                item.ItemId) |
            _runtimeConfigurationMenuHorizontalLayout.Remove(
                item.ItemId) |
            _runtimeConfigurationMenuWidthPercent.Remove(
                item.ItemId) |
            _runtimeConfigurationMenuLabelVisibility.Remove(
                item.ItemId);
    }

    if (changed)
    {
        Interlocked.Increment(
            ref _runtimeConfigurationMenuRevision);
    }
}

private static void ResetRuntimeConfigurationMenu(
    RuntimeConfigurationMenuHandle menu)
{
    if (menu is null)
    {
        return;
    }

    bool changed;
    lock (_runtimeConfigurationMenuLock)
    {
        changed =
            _runtimeConfigurationMenuVisibility.Count > 0 ||
            _runtimeConfigurationMenuOrder.Count > 0 ||
            _runtimeConfigurationMenuHorizontalLayout.Count > 0 ||
            _runtimeConfigurationMenuWidthPercent.Count > 0 ||
            _runtimeConfigurationMenuLabelVisibility.Count > 0;

        _runtimeConfigurationMenuVisibility.Clear();
        _runtimeConfigurationMenuOrder.Clear();
        _runtimeConfigurationMenuHorizontalLayout.Clear();
        _runtimeConfigurationMenuWidthPercent.Clear();
        _runtimeConfigurationMenuLabelVisibility.Clear();
    }

    if (changed)
    {
        Interlocked.Increment(
            ref _runtimeConfigurationMenuRevision);
    }
}
`
    );
  }

  registerNode(
    "configuration.menuInstance",
    {
      title:
        "Configuration Menu Instance",
      group: "Configuration Menu",
      symbol: "MENU",
      description:
        "Instantiates the generated RML configuration menu as a typed graph handle and exposes one stable Menu Item output for every entry in Configuration Outline. Outputs are synchronized by Outline id, so visibility, order, values, Inline Row widths and label visibility can be changed by runtime logic without string-key wiring.",
      inputs: [],
      outputs: [
        port(
          "menu",
          "Menu",
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
          return "RuntimeConfigurationMenuHandle.Instance";
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
        "Set Configuration Visibility",
      group: "Configuration Menu",
      symbol: "EYE",
      description:
        "Overrides one Configuration Outline item's runtime visibility. Visible can explicitly expose an item originally generated as internal/hidden; false hides it. Reset Configuration Item returns to the static Outline/controller rule. A Preview button impulse applies the same change only inside local Preview and never contacts Resonite.",
      inputs: [
        port("call", "Call", "impulse"),
        port(
          "item",
          "Menu Item",
          "rmlConfigurationMenuItem"
        ),
        port(
          "visible",
          "Visible",
          "bool"
        )
      ],
      outputs: [
        port("done", "Done", "impulse")
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
        "Set Configuration Order",
      group: "Configuration Menu",
      symbol: "#↕",
      description:
        "Overrides the absolute runtime order of one Configuration Outline item. Ordinary settings, dynamic controls and runtime display rows share the same order space.",
      inputs: [
        port("call", "Call", "impulse"),
        port(
          "item",
          "Menu Item",
          "rmlConfigurationMenuItem"
        ),
        port("order", "Order", "int")
      ],
      outputs: [
        port("done", "Done", "impulse")
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
        "Set Configuration Value",
      group: "Configuration Menu",
      symbol: "SET",
      description:
        "Writes a value to the selected Configuration Outline item at runtime and refreshes the open RML menu. Save is optional: false changes the active configuration only, true also persists it. Read-only Runtime Display items reject value writes safely.",
      inputs: [
        port("call", "Call", "impulse"),
        port(
          "item",
          "Menu Item",
          "rmlConfigurationMenuItem"
        ),
        port("value", "Value", "object"),
        port("save", "Save", "bool")
      ],
      outputs: [
        port("done", "Done", "impulse")
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
        "Save Configuration Settings",
      group: "Configuration Menu",
      symbol: "SAVE",
      description:
        "Captures every current editor draft in the open RML configuration menu, validates it and persists the configuration exactly like the visible Save Settings button. Use Done for the action that must run after saving; Failed fires when no compatible menu is open, validation fails or persistence throws. In Preview this saves only the local Preview draft and never contacts Resonite.",
      inputs: [
        port("call", "Call", "impulse")
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port(
          "failed",
          "Failed",
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
        "Set Configuration Layout",
      group: "Configuration Menu",
      symbol: "⇄",
      description:
        "Switches an Inline Row between horizontal side-by-side layout and vertical stacking at runtime. Connect the row's Menu Item output from Configuration Menu Instance. The menu rebuild preserves draft values and remains compatible with visibility and order overrides. Connected Preview button impulses project this layout locally without synchronizing to Resonite.",
      inputs: [
        port("call", "Call", "impulse"),
        port(
          "item",
          "Inline Row",
          "rmlConfigurationMenuItem"
        ),
        port(
          "horizontal",
          "Horizontal",
          "bool"
        )
      ],
      outputs: [
        port("done", "Done", "impulse")
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
        "Set Configuration Width",
      group: "Configuration Menu",
      symbol: "%↔",
      description:
        "Overrides one direct Inline Row child's width at runtime. Width Percent is clamped to 1-100. For exact proportions, the visible children in a row should total 100 percent. The open menu rebuild preserves draft values.",
      inputs: [
        port("call", "Call", "impulse"),
        port(
          "item",
          "Row Item",
          "rmlConfigurationMenuItem"
        ),
        port(
          "width",
          "Width Percent",
          "float"
        )
      ],
      outputs: [
        port("done", "Done", "impulse")
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
        "Set Configuration Label Visibility",
      group: "Configuration Menu",
      symbol: "TXT",
      description:
        "Shows or hides the left-side label of one Inline Row child at runtime without hiding the control itself. False gives the editor, picker, choice or button the complete cell width.",
      inputs: [
        port("call", "Call", "impulse"),
        port(
          "item",
          "Row Item",
          "rmlConfigurationMenuItem"
        ),
        port(
          "visible",
          "Label Visible",
          "bool"
        )
      ],
      outputs: [
        port("done", "Done", "impulse")
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
        "Reset Configuration Item",
      group: "Configuration Menu",
      symbol: "↶1",
      description:
        "Removes the runtime visibility, order, Inline Row layout, width and label overrides for one menu item. Its original Configuration Outline values become active again; the stored value is not changed.",
      inputs: [
        port("call", "Call", "impulse"),
        port(
          "item",
          "Menu Item",
          "rmlConfigurationMenuItem"
        )
      ],
      outputs: [
        port("done", "Done", "impulse")
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
      title: "Reset Configuration Menu",
      group: "Configuration Menu",
      symbol: "↶ALL",
      description:
        "Clears every runtime visibility, order, Inline Row layout, width and label override in one action and restores the complete menu structure defined by Configuration Outline. Configuration values are kept.",
      inputs: [
        port("call", "Call", "impulse"),
        port(
          "menu",
          "Menu",
          "rmlConfigurationMenu"
        )
      ],
      outputs: [
        port("done", "Done", "impulse")
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

    api.addMember("universal.reflection", String.raw`
private const BindingFlags GraphAllMembers =
    BindingFlags.Public |
    BindingFlags.NonPublic |
    BindingFlags.Instance |
    BindingFlags.Static |
    BindingFlags.FlattenHierarchy;

private static readonly System.Collections.Concurrent.ConcurrentDictionary<
    (Type Type, string Name, bool? StaticTarget, bool RequireReadable, bool RequireWritable),
    PropertyInfo> GraphPropertyCache = new();
private static readonly System.Collections.Concurrent.ConcurrentDictionary<
    (Type Type, string Name, bool? StaticTarget, bool RequireWritable),
    FieldInfo> GraphFieldCache = new();
private static readonly System.Collections.Concurrent.ConcurrentDictionary<
    (Type Type, string Name, bool? StaticTarget),
    EventInfo> GraphEventCache = new();
private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, Type>
    GraphTypeCache = new(StringComparer.Ordinal);
private static readonly System.Collections.Concurrent.ConcurrentDictionary<string, string[]>
    GraphMemberPathCache = new(StringComparer.Ordinal);
private static readonly System.Collections.Concurrent.ConcurrentDictionary<
    (Type Type, string MethodName),
    MethodInfo[]> GraphMethodCandidateCache = new();
private static readonly System.Collections.Concurrent.ConcurrentDictionary<
    Type,
    ConstructorInfo[]> GraphConstructorCandidateCache = new();

private static IEnumerable<Type> GraphTypeHierarchy(Type type)
{
    for (Type? current = type; current is not null; current = current.BaseType)
    {
        yield return current;
    }
}

private static bool GraphAccessorMatchesTarget(
    MethodInfo? accessor,
    bool? staticTarget)
{
    return accessor is not null &&
           (!staticTarget.HasValue || accessor.IsStatic == staticTarget.Value);
}

private static PropertyInfo? FindGraphProperty(
    Type? type,
    string? propertyName,
    bool? staticTarget = null,
    bool requireReadable = false,
    bool requireWritable = false)
{
    if (type is null || string.IsNullOrWhiteSpace(propertyName))
    {
        return null;
    }

    var cacheKey = (
        Type: type,
        Name: propertyName,
        StaticTarget: staticTarget,
        RequireReadable: requireReadable,
        RequireWritable: requireWritable);
    if (GraphPropertyCache.TryGetValue(cacheKey, out PropertyInfo? cachedProperty))
    {
        return cachedProperty;
    }

    foreach (Type current in GraphTypeHierarchy(type))
    {
        PropertyInfo? property = current
            .GetProperties(GraphAllMembers | BindingFlags.DeclaredOnly)
            .Where(candidate =>
                string.Equals(candidate.Name, propertyName, StringComparison.Ordinal) &&
                candidate.GetIndexParameters().Length == 0 &&
                (!requireReadable || candidate.GetGetMethod(nonPublic: true) is not null) &&
                (!requireWritable || candidate.GetSetMethod(nonPublic: true) is not null))
            .Where(candidate =>
                GraphAccessorMatchesTarget(
                    candidate.GetGetMethod(nonPublic: true) ??
                    candidate.GetSetMethod(nonPublic: true),
                    staticTarget))
            .OrderByDescending(candidate =>
                candidate.GetGetMethod(nonPublic: true)?.IsPublic == true ||
                candidate.GetSetMethod(nonPublic: true)?.IsPublic == true)
            .ThenBy(candidate => candidate.MetadataToken)
            .FirstOrDefault();

        if (property is not null)
        {
            GraphPropertyCache.TryAdd(cacheKey, property);
            return property;
        }
    }

    foreach (Type interfaceType in type
        .GetInterfaces()
        .OrderBy(candidate => candidate.FullName, StringComparer.Ordinal))
    {
        PropertyInfo? property = interfaceType
            .GetProperties(GraphAllMembers | BindingFlags.DeclaredOnly)
            .Where(candidate =>
                string.Equals(candidate.Name, propertyName, StringComparison.Ordinal) &&
                candidate.GetIndexParameters().Length == 0 &&
                (!requireReadable || candidate.GetGetMethod(nonPublic: true) is not null) &&
                (!requireWritable || candidate.GetSetMethod(nonPublic: true) is not null))
            .Where(candidate =>
                GraphAccessorMatchesTarget(
                    candidate.GetGetMethod(nonPublic: true) ??
                    candidate.GetSetMethod(nonPublic: true),
                    staticTarget))
            .OrderBy(candidate => candidate.MetadataToken)
            .FirstOrDefault();

        if (property is not null)
        {
            GraphPropertyCache.TryAdd(cacheKey, property);
            return property;
        }
    }

    return null;
}

private static FieldInfo? FindGraphField(
    Type? type,
    string? fieldName,
    bool? staticTarget = null,
    bool requireWritable = false)
{
    if (type is null || string.IsNullOrWhiteSpace(fieldName))
    {
        return null;
    }

    var cacheKey = (
        Type: type,
        Name: fieldName,
        StaticTarget: staticTarget,
        RequireWritable: requireWritable);
    if (GraphFieldCache.TryGetValue(cacheKey, out FieldInfo? cachedField))
    {
        return cachedField;
    }

    foreach (Type current in GraphTypeHierarchy(type))
    {
        FieldInfo? field = current
            .GetFields(GraphAllMembers | BindingFlags.DeclaredOnly)
            .Where(candidate =>
                string.Equals(candidate.Name, fieldName, StringComparison.Ordinal) &&
                (!staticTarget.HasValue || candidate.IsStatic == staticTarget.Value) &&
                (!requireWritable || (!candidate.IsInitOnly && !candidate.IsLiteral)))
            .OrderByDescending(candidate => candidate.IsPublic)
            .ThenBy(candidate => candidate.MetadataToken)
            .FirstOrDefault();

        if (field is not null)
        {
            GraphFieldCache.TryAdd(cacheKey, field);
            return field;
        }
    }

    return null;
}

private static EventInfo? FindGraphEvent(
    Type? type,
    string? eventName,
    bool? staticTarget = null)
{
    if (type is null || string.IsNullOrWhiteSpace(eventName))
    {
        return null;
    }

    var cacheKey = (
        Type: type,
        Name: eventName,
        StaticTarget: staticTarget);
    if (GraphEventCache.TryGetValue(cacheKey, out EventInfo? cachedEvent))
    {
        return cachedEvent;
    }

    foreach (Type current in GraphTypeHierarchy(type))
    {
        EventInfo? eventInfo = current
            .GetEvents(GraphAllMembers | BindingFlags.DeclaredOnly)
            .Where(candidate =>
                string.Equals(candidate.Name, eventName, StringComparison.Ordinal))
            .Where(candidate =>
                GraphAccessorMatchesTarget(
                    candidate.GetAddMethod(nonPublic: true) ??
                    candidate.GetRemoveMethod(nonPublic: true),
                    staticTarget))
            .OrderBy(candidate => candidate.MetadataToken)
            .FirstOrDefault();

        if (eventInfo is not null)
        {
            GraphEventCache.TryAdd(cacheKey, eventInfo);
            return eventInfo;
        }
    }

    foreach (Type interfaceType in type
        .GetInterfaces()
        .OrderBy(candidate => candidate.FullName, StringComparer.Ordinal))
    {
        EventInfo? eventInfo = interfaceType
            .GetEvents(GraphAllMembers | BindingFlags.DeclaredOnly)
            .Where(candidate =>
                string.Equals(candidate.Name, eventName, StringComparison.Ordinal))
            .Where(candidate =>
                GraphAccessorMatchesTarget(
                    candidate.GetAddMethod(nonPublic: true) ??
                    candidate.GetRemoveMethod(nonPublic: true),
                    staticTarget))
            .OrderBy(candidate => candidate.MetadataToken)
            .FirstOrDefault();

        if (eventInfo is not null)
        {
            GraphEventCache.TryAdd(cacheKey, eventInfo);
            return eventInfo;
        }
    }

    return null;
}

private static Type? FindType(string? typeName)
{
    if (string.IsNullOrWhiteSpace(typeName))
    {
        return null;
    }

    if (GraphTypeCache.TryGetValue(typeName, out Type? cachedType))
    {
        return cachedType;
    }

    Type? direct = Type.GetType(typeName, throwOnError: false, ignoreCase: false);
    if (direct is not null)
    {
        GraphTypeCache.TryAdd(typeName, direct);
        return direct;
    }

    foreach (Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
    {
        Type? candidate = assembly.GetType(typeName, throwOnError: false, ignoreCase: false);
        if (candidate is not null)
        {
            GraphTypeCache.TryAdd(typeName, candidate);
            return candidate;
        }
    }

    string shortName = typeName.Contains('.')
        ? typeName[(typeName.LastIndexOf('.') + 1)..]
        : typeName;

    foreach (Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
    {
        try
        {
            Type? candidate = assembly
                .GetTypes()
                .FirstOrDefault(type =>
                    string.Equals(type.Name, shortName, StringComparison.Ordinal) ||
                    string.Equals(type.FullName, typeName, StringComparison.Ordinal));

            if (candidate is not null)
            {
                GraphTypeCache.TryAdd(typeName, candidate);
                return candidate;
            }
        }
        catch (ReflectionTypeLoadException exception)
        {
            Type? candidate = exception.Types
                .Where(type => type is not null)
                .FirstOrDefault(type =>
                    string.Equals(type!.Name, shortName, StringComparison.Ordinal) ||
                    string.Equals(type.FullName, typeName, StringComparison.Ordinal));

            if (candidate is not null)
            {
                GraphTypeCache.TryAdd(typeName, candidate);
                return candidate;
            }
        }
    }

    return null;
}

private static Type[] ResolveTypeList(string? commaSeparatedTypeNames)
{
    if (string.IsNullOrWhiteSpace(commaSeparatedTypeNames))
    {
        return Type.EmptyTypes;
    }

    return commaSeparatedTypeNames
        .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
        .Select(name => FindType(name) ?? typeof(object))
        .ToArray();
}

private static object? ReadMember(object? target, string? memberName)
{
    if (target is null || string.IsNullOrWhiteSpace(memberName))
    {
        return null;
    }

    Type type = target is Type staticType
        ? staticType
        : target.GetType();
    object? instance = target is Type ? null : target;

    bool staticTarget = target is Type;
    PropertyInfo? property = FindGraphProperty(
        type,
        memberName,
        staticTarget,
        requireReadable: true);
    if (property is not null)
    {
        return property.GetValue(instance);
    }

    FieldInfo? field = FindGraphField(type, memberName, staticTarget);
    if (field is not null)
    {
        return field.GetValue(instance);
    }

    return null;
}

private static object? ReadMemberPath(object? target, string? memberPath)
{
    object? current = target;
    string path = memberPath ?? string.Empty;
    string[] parts = GraphMemberPathCache.GetOrAdd(
        path,
        static value => value.Split(
            '.',
            StringSplitOptions.RemoveEmptyEntries |
            StringSplitOptions.TrimEntries));

    foreach (string part in parts)
    {
        current = ReadMember(current, part);
        if (current is null)
        {
            break;
        }
    }

    return current;
}

private static bool WriteMember(object? target, string? memberName, object? value)
{
    if (target is null || string.IsNullOrWhiteSpace(memberName))
    {
        return false;
    }

    Type type = target is Type staticType
        ? staticType
        : target.GetType();
    object? instance = target is Type ? null : target;

    bool staticTarget = target is Type;
    PropertyInfo? property = FindGraphProperty(
        type,
        memberName,
        staticTarget,
        requireWritable: true);
    if (property is not null)
    {
        property.SetValue(instance, ConvertGraphValue(value, property.PropertyType));
        return true;
    }

    FieldInfo? field = FindGraphField(
        type,
        memberName,
        staticTarget,
        requireWritable: true);
    if (field is not null)
    {
        field.SetValue(instance, ConvertGraphValue(value, field.FieldType));
        return true;
    }

    return false;
}

private static object? ConvertGraphValue(object? value, Type destinationType)
{
    Type targetType = Nullable.GetUnderlyingType(destinationType) ?? destinationType;

    if (value is null)
    {
        return targetType.IsValueType
            ? Activator.CreateInstance(targetType)
            : null;
    }

    if (targetType.IsInstanceOfType(value))
    {
        return value;
    }

    if (targetType.IsEnum)
    {
        return value is string text
            ? Enum.Parse(targetType, text, ignoreCase: true)
            : Enum.ToObject(targetType, value);
    }

    if (targetType == typeof(Uri))
    {
        return new Uri(Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty,
            UriKind.RelativeOrAbsolute);
    }

    return Convert.ChangeType(value, targetType, CultureInfo.InvariantCulture);
}

private static T ConvertGraphValue<T>(object? value)
{
    object? converted = ConvertGraphValue(value, typeof(T));
    return converted is T typed ? typed : default!;
}

private static bool TryPrepareArguments(
    ParameterInfo[] parameters,
    object?[] supplied,
    out object?[] prepared)
{
    prepared = Array.Empty<object?>();

    int required = parameters.Count(parameter => !parameter.IsOptional);
    if (supplied.Length < required || supplied.Length > parameters.Length)
    {
        return false;
    }

    prepared = new object?[parameters.Length];

    try
    {
        for (int index = 0; index < parameters.Length; index++)
        {
            if (index < supplied.Length)
            {
                prepared[index] = ConvertGraphValue(
                    supplied[index],
                    parameters[index].ParameterType.IsByRef
                        ? parameters[index].ParameterType.GetElementType()!
                        : parameters[index].ParameterType);
            }
            else
            {
                prepared[index] = parameters[index].DefaultValue;
            }
        }

        return true;
    }
    catch
    {
        prepared = Array.Empty<object?>();
        return false;
    }
}

private static MethodInfo? FindMethod(
    Type? type,
    string? methodName,
    Type[]? parameterTypes = null)
{
    if (type is null || string.IsNullOrWhiteSpace(methodName))
    {
        return null;
    }

    foreach (Type current in GraphTypeHierarchy(type))
    {
        IEnumerable<MethodInfo> candidates = current
            .GetMethods(GraphAllMembers | BindingFlags.DeclaredOnly)
            .Where(method =>
                string.Equals(method.Name, methodName, StringComparison.Ordinal));

        if (parameterTypes is { Length: > 0 })
        {
            candidates = candidates.Where(method =>
                method.GetParameters()
                    .Select(parameter => parameter.ParameterType)
                    .SequenceEqual(parameterTypes));
        }

        MethodInfo? match = candidates
            .OrderBy(method => method.GetParameters().Length)
            .ThenBy(method => method.MetadataToken)
            .FirstOrDefault();

        if (match is not null)
        {
            return match;
        }
    }

    foreach (Type interfaceType in type
        .GetInterfaces()
        .OrderBy(candidate => candidate.FullName, StringComparer.Ordinal))
    {
        IEnumerable<MethodInfo> candidates = interfaceType
            .GetMethods(GraphAllMembers | BindingFlags.DeclaredOnly)
            .Where(method =>
                string.Equals(method.Name, methodName, StringComparison.Ordinal));

        if (parameterTypes is { Length: > 0 })
        {
            candidates = candidates.Where(method =>
                method.GetParameters()
                    .Select(parameter => parameter.ParameterType)
                    .SequenceEqual(parameterTypes));
        }

        MethodInfo? match = candidates
            .OrderBy(method => method.GetParameters().Length)
            .ThenBy(method => method.MetadataToken)
            .FirstOrDefault();

        if (match is not null)
        {
            return match;
        }
    }

    return null;
}

private static object? InvokeBest(
    object? target,
    string? methodName,
    params object?[] arguments)
{
    if (target is null || string.IsNullOrWhiteSpace(methodName))
    {
        return null;
    }

    Type type = target is Type staticType
        ? staticType
        : target.GetType();
    object? instance = target is Type ? null : target;

    MethodInfo[] candidates = GraphMethodCandidateCache.GetOrAdd(
        (Type: type, MethodName: methodName),
        static key => key.Type
            .GetMethods(GraphAllMembers)
            .Where(method => string.Equals(
                method.Name,
                key.MethodName,
                StringComparison.Ordinal))
            .OrderBy(method => method.GetParameters().Length)
            .ToArray());

    foreach (MethodInfo method in candidates)
    {
        if (method.ContainsGenericParameters)
        {
            continue;
        }

        if (!TryPrepareArguments(method.GetParameters(), arguments, out object?[] prepared))
        {
            continue;
        }

        return method.Invoke(instance, prepared);
    }

    return null;
}

private static object? InvokeMethodInfo(
    MethodInfo? method,
    object? target,
    object?[]? arguments)
{
    if (method is null)
    {
        return null;
    }

    object?[] supplied = arguments ?? Array.Empty<object?>();
    if (!TryPrepareArguments(method.GetParameters(), supplied, out object?[] prepared))
    {
        throw new ArgumentException($"Arguments do not match {method.DeclaringType?.FullName}.{method.Name}.");
    }

    return method.Invoke(target, prepared);
}

private static object? CreateReflective(Type? type, object?[]? arguments)
{
    if (type is null)
    {
        return null;
    }

    object?[] supplied = arguments ?? Array.Empty<object?>();

    ConstructorInfo[] constructors = GraphConstructorCandidateCache.GetOrAdd(
        type,
        static candidateType => candidateType
            .GetConstructors(GraphAllMembers)
            .OrderBy(constructor => constructor.GetParameters().Length)
            .ToArray());

    foreach (ConstructorInfo constructor in constructors)
    {
        if (!TryPrepareArguments(constructor.GetParameters(), supplied, out object?[] prepared))
        {
            continue;
        }

        return constructor.Invoke(prepared);
    }

    return Activator.CreateInstance(type);
}

private static object?[] ToObjectArray(object? value)
{
    if (value is null)
    {
        return Array.Empty<object?>();
    }

    if (value is object?[] array)
    {
        return array;
    }

    if (value is IEnumerable enumerable && value is not string)
    {
        return enumerable.Cast<object?>().ToArray();
    }

    return new[] { value };
}
`);
  }

  function ensureEventRuntime(api) {
    ensureReflectionRuntime(api);
    api.addUsing("System.Linq.Expressions");
    api.addUsing("System.Threading");
    api.addUsing("System.Threading.Tasks");
    api.addField(
      "universal.event.subscriptions",
      "private static readonly object _graphEventSubscriptionLock = new();\nprivate static readonly List<(object? Target, EventInfo Event, Delegate Handler)> _graphEventSubscriptions = new();\nprivate static readonly HashSet<string> _graphEventSubscriptionKeys = new(StringComparer.Ordinal);\nprivate static readonly CancellationTokenSource _graphEventSubscriptionCancellation = new();"
    );
    api.addRuntimeDrain(
      "UnsubscribeGraphEvents();"
    );
    api.addMember("universal.event.helpers", String.raw`
private static Delegate? SubscribeGraphEvent(
    object? target,
    string? eventName,
    Action<object?[]> callback)
{
    if (target is null || string.IsNullOrWhiteSpace(eventName))
    {
        return null;
    }

    bool staticTarget = target is Type;
    Type targetType = staticTarget
        ? (Type)target
        : target.GetType();
    object? eventTarget = staticTarget
        ? null
        : target;

    EventInfo? eventInfo = FindGraphEvent(
        targetType,
        eventName,
        staticTarget);
    Type? handlerType = eventInfo?.EventHandlerType;
    MethodInfo? invoke = FindMethod(handlerType, "Invoke");

    if (eventInfo is null || handlerType is null || invoke is null)
    {
        return null;
    }

    ParameterExpression[] parameters = invoke
        .GetParameters()
        .Select(parameter => Expression.Parameter(parameter.ParameterType, parameter.Name))
        .ToArray();

    NewArrayExpression values = Expression.NewArrayInit(
        typeof(object),
        parameters.Select(parameter => Expression.Convert(parameter, typeof(object))));

    InvocationExpression body = Expression.Invoke(
        Expression.Constant(callback),
        values);

    Delegate handler = Expression
        .Lambda(handlerType, body, parameters)
        .Compile();

    eventInfo.AddEventHandler(eventTarget, handler);
    lock (_graphEventSubscriptionLock)
    {
        _graphEventSubscriptions.Add((eventTarget, eventInfo, handler));
    }
    return handler;
}

private static void SubscribeGraphEventWhenAvailable(
    string subscriptionKey,
    Func<object?> targetProvider,
    Func<string?> eventNameProvider,
    Action<object?[]> callback)
{
    lock (_graphEventSubscriptionLock)
    {
        if (!_graphEventSubscriptionKeys.Add(subscriptionKey))
        {
            return;
        }
    }

    if (TrySubscribeGraphEventProviders(
        targetProvider,
        eventNameProvider,
        callback))
    {
        return;
    }

    CancellationToken cancellation =
        _graphEventSubscriptionCancellation.Token;

    TrackGraphTask(Task.Run(
        async () =>
        {
            try
            {
                while (!cancellation.IsCancellationRequested)
                {
                    if (TrySubscribeGraphEventProviders(
                        targetProvider,
                        eventNameProvider,
                        callback))
                    {
                        return;
                    }

                    await Task.Delay(50, cancellation)
                        .ConfigureAwait(false);
                }
            }
            catch (OperationCanceledException)
            {
            }
        },
        cancellation));
}

private static bool TrySubscribeGraphEventProviders(
    Func<object?> targetProvider,
    Func<string?> eventNameProvider,
    Action<object?[]> callback)
{
    try
    {
        return SubscribeGraphEvent(
            targetProvider(),
            eventNameProvider(),
            callback) is not null;
    }
    catch
    {
        return false;
    }
}

private static void UnsubscribeGraphEvents()
{
    try
    {
        _graphEventSubscriptionCancellation.Cancel();
    }
    catch
    {
    }

    List<(object? Target, EventInfo Event, Delegate Handler)> subscriptions;
    lock (_graphEventSubscriptionLock)
    {
        subscriptions = new(_graphEventSubscriptions);
        _graphEventSubscriptions.Clear();
        _graphEventSubscriptionKeys.Clear();
    }

    foreach ((object? target, EventInfo eventInfo, Delegate handler) in subscriptions)
    {
        try
        {
            eventInfo.RemoveEventHandler(target, handler);
        }
        catch
        {
        }
    }
}
`);
  }

  function ensureJsonRuntime(api) {
    api.addUsing("System.Text.Json");
    api.addUsing("System.Text.Json.Nodes");
    api.addMember("universal.json.helpers", String.raw`
private static JsonNode? ParseGraphJson(string? text)
{
    return string.IsNullOrWhiteSpace(text)
        ? null
        : JsonNode.Parse(text);
}

private static string SerializeGraphJson(object? value, bool indented = false)
{
    return JsonSerializer.Serialize(
        value,
        new JsonSerializerOptions
        {
            WriteIndented = indented
        });
}

private static JsonNode? ReadGraphJsonProperty(JsonNode? node, string? path)
{
    JsonNode? current = node;

    foreach (string part in (path ?? string.Empty)
        .Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    {
        if (current is JsonObject jsonObject)
        {
            current = jsonObject[part];
        }
        else if (current is JsonArray jsonArray && int.TryParse(part, out int index) &&
                 index >= 0 && index < jsonArray.Count)
        {
            current = jsonArray[index];
        }
        else
        {
            return null;
        }
    }

    return current;
}

private static string GraphJsonAsString(JsonNode? node)
{
    if (node is null)
    {
        return string.Empty;
    }

    try
    {
        return node.GetValue<string>();
    }
    catch
    {
        return node.ToJsonString();
    }
}

private static JsonNode? CloneGraphJsonValue(object? value)
{
    return value is JsonNode json
        ? json.DeepClone()
        : JsonSerializer.SerializeToNode(value);
}

private static bool SetGraphJsonProperty(
    JsonNode? node,
    string? property,
    object? value)
{
    if (node is not JsonObject jsonObject ||
        string.IsNullOrWhiteSpace(property))
    {
        return false;
    }

    jsonObject[property.Trim()] = CloneGraphJsonValue(value);
    return true;
}

private static bool RemoveGraphJsonProperty(
    JsonNode? node,
    string? property)
{
    return node is JsonObject jsonObject &&
           !string.IsNullOrWhiteSpace(property) &&
           jsonObject.Remove(property.Trim());
}

private static bool AddGraphJsonArrayItem(
    JsonNode? node,
    object? value)
{
    if (node is not JsonArray jsonArray)
    {
        return false;
    }

    jsonArray.Add(CloneGraphJsonValue(value));
    return true;
}
`);
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
    api.addField(
      "universal.network.httpClient",
      "private static readonly HttpClient _graphHttpClient = new();"
    );
    api.addMember("universal.network.response", String.raw`
internal sealed record GraphHttpResponse(
    int StatusCode,
    string Body,
    string ContentType,
    bool Success,
    string Error)
{
    public static readonly GraphHttpResponse Empty =
        new(0, string.Empty, string.Empty, false, string.Empty);
}
`);
  }

  function ensureTaskRuntime(api) {
    api.addUsing("System.Threading");
    api.addUsing("System.Threading.Tasks");
    api.addMember("universal.task.helpers", String.raw`
private static void RunGraphBackground(Action action)
{
    TrackGraphTask(Task.Run(action));
}

private static async Task WaitForAnyGraphTask(params Task[] tasks)
{
    if (tasks.Length == 0)
    {
        return;
    }

    Task first = await Task.WhenAny(tasks).ConfigureAwait(false);
    await first.ConfigureAwait(false);
}
`);
  }

  function ensureHarmonyRuntime(api) {
    api.require("usesHarmony", true);
    api.require("runtimeReloadUnsafe", true);
    ensureReflectionRuntime(api);
    api.addUsing("System.Threading");
    api.addUsing("HarmonyLib");
    api.addReference({
      include: "0Harmony",
      hintPath:
        "$(ResonitePath)rml_libs/0Harmony.dll",
      private: false
    });
    api.addField(
      "universal.harmony.field",
      `private static readonly Harmony _graphHarmony = new("${api.escapeString(
        `${api.namespaceName}.${api.className}.GeneratedGraph`
      )}");`
    );
    api.addField(
      "universal.harmony.shutdownState",
      "private static int _graphHarmonyShutdownStarted;"
    );
    api.addMember(
      "universal.harmony.shutdown",
      String.raw`
private static void ShutdownGraphHarmony()
{
    if (Interlocked.Exchange(
            ref _graphHarmonyShutdownStarted,
            1) != 0)
    {
        return;
    }

    try
    {
        _graphHarmony.UnpatchAll(
            _graphHarmony.Id);
    }
    catch
    {
    }
}
`
    );
    api.addInitialize(
      "AppDomain.CurrentDomain.ProcessExit += (_, _) => ShutdownGraphHarmony();"
    );
    api.addRuntimeDrain(
      "ShutdownGraphHarmony();"
    );
    api.addMember("universal.harmony.context", String.raw`
internal sealed class PatchContext
{
    public object? Instance { get; set; }
    public object?[] Arguments { get; set; } = Array.Empty<object?>();
    public MethodBase? OriginalMethod { get; set; }
    public object? Result { get; set; }
    public Exception? Exception { get; set; }
    public bool SkipOriginal { get; set; }
}
`);
    api.addMember(
      "universal.harmony.helpers",
      String.raw`
private static MethodBase? ResolveHarmonyTarget(
    string? typeName,
    string? methodName,
    string? argumentTypeNames)
{
    Type? targetType = FindType(typeName);
    if (targetType is null || string.IsNullOrWhiteSpace(methodName))
    {
        return null;
    }

    Type[] argumentTypes = ResolveTypeList(argumentTypeNames);

    if (methodName is ".ctor" or "ctor")
    {
        return argumentTypes.Length > 0
            ? targetType.GetConstructor(GraphAllMembers, null, argumentTypes, null)
            : targetType.GetConstructors(GraphAllMembers).FirstOrDefault();
    }

    if (methodName is ".cctor" or "cctor")
    {
        return targetType.TypeInitializer;
    }

    return FindMethod(
        targetType,
        methodName,
        argumentTypes.Length > 0 ? argumentTypes : null);
}

private static bool RegisterGeneratedHarmonyPatch(
    string typeName,
    string methodName,
    string argumentTypeNames,
    string patchKind,
    string callbackMethod,
    int priority)
{
    try
    {
        MethodBase? target = ResolveHarmonyTarget(typeName, methodName, argumentTypeNames);
            MethodInfo? callback = FindMethod(
                typeof(__GRAPH_CLASS__),
                callbackMethod);

        if (target is null || callback is null)
        {
            _display(
                $"Harmony target not found: {typeName}.{methodName} / {callbackMethod}");
            return false;
        }

        HarmonyMethod patch = new(callback)
        {
            priority = priority
        };

        switch ((patchKind ?? string.Empty).Trim().ToLowerInvariant())
        {
            case "prefix":
                _graphHarmony.Patch(target, prefix: patch);
                break;
            case "postfix":
                _graphHarmony.Patch(target, postfix: patch);
                break;
            case "finalizer":
                _graphHarmony.Patch(target, finalizer: patch);
                break;
            case "transpiler":
                _graphHarmony.Patch(target, transpiler: patch);
                break;
            default:
                _display($"Unsupported Harmony patch kind: {patchKind}");
                return false;
        }

        return true;
    }
    catch (Exception exception)
    {
        _display(
            $"Harmony patch failed for {typeName}.{methodName}: {exception}");
        return false;
    }
}

private static int _generatedHarmonyAttributePatchesApplied;

private static void RegisterGeneratedHarmonyAttributePatches()
{
    if (System.Threading.Interlocked.Exchange(
            ref _generatedHarmonyAttributePatchesApplied,
            1) != 0)
    {
        return;
    }

    _graphHarmony.PatchAll(
        typeof(__GRAPH_CLASS__).Assembly);
}

private static void CreateGeneratedReversePatch(
    string targetTypeName,
    string targetMethodName,
    string targetArgumentTypeNames,
    string standInTypeName,
    string standInMethodName)
{
    MethodBase? target = ResolveHarmonyTarget(
        targetTypeName,
        targetMethodName,
        targetArgumentTypeNames);
    Type? standInType = FindType(standInTypeName);
    MethodInfo? standIn = FindMethod(standInType, standInMethodName);

    if (target is null || standIn is null)
    {
        throw new MissingMethodException(
            "The reverse-patch target or stand-in method could not be resolved.");
    }

    _graphHarmony
        .CreateReversePatcher(target, new HarmonyMethod(standIn))
        .Patch();
}
`.replaceAll("__GRAPH_CLASS__", api.graphClassName)
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
          "Node"
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

  function replaceInputPlaceholders(
    source,
    api,
    portIds
  ) {
    const values = {};

    for (const portId of portIds) {
      values[portId.toUpperCase()] =
        api.input(portId).code;
    }

    return replaceCodePlaceholders(
      source,
      api,
      values
    );
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


  const MATERIAL_GRAPH_TYPES = new Map([
    ["FrooxEngine.PBS_Metallic", "pbsMetallic"],
    ["PBS_Metallic", "pbsMetallic"],
    ["FrooxEngine.PBS_Specular", "pbsSpecular"],
    ["PBS_Specular", "pbsSpecular"],
    ["FrooxEngine.UnlitMaterial", "unlitMaterial"],
    ["UnlitMaterial", "unlitMaterial"]
  ]);

  const MESH_GRAPH_TYPES = new Map([
    ["FrooxEngine.QuadMesh", "quadMesh"],
    ["QuadMesh", "quadMesh"],
    ["FrooxEngine.BoxMesh", "boxMesh"],
    ["BoxMesh", "boxMesh"],
    ["FrooxEngine.SphereMesh", "sphereMesh"],
    ["SphereMesh", "sphereMesh"],
    ["FrooxEngine.CylinderMesh", "cylinderMesh"],
    ["CylinderMesh", "cylinderMesh"],
    ["FrooxEngine.ArrowMesh", "arrowMesh"],
    ["ArrowMesh", "arrowMesh"],
    ["FrooxEngine.StaticMesh", "staticMesh"],
    ["StaticMesh", "staticMesh"]
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

  function safeQualifiedTypeName(
    api,
    value,
    fallback,
    label = "C# type"
  ) {
    const candidate = String(value || "").trim();

    if (isSafeCSharpTypeExpression(candidate)) {
      return candidate.replace(/\s+/g, "");
    }

    api?.diagnostic?.(
      `${label} '${candidate || "<empty>"}' is not a safe C# type expression. '${fallback}' was used.`
    );

    return fallback;
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

  function catalogGenericShape(
    value,
    genericArity = 0
  ) {
    const normalized =
      normalizedCatalogTypeName(value);
    const parsed =
      catalogGenericTypeParts(normalized);

    if (parsed) {
      const arity =
        Number(genericArity) ||
        parsed.arguments.length;

      return arity > 0
        ? `${parsed.head}${parsed.suffix}|${arity}`
        : "";
    }

    const reflectionStyle =
      normalized.match(/^(.*)`([1-9][0-9]*)$/);

    if (reflectionStyle) {
      return `${reflectionStyle[1]}|${Number(reflectionStyle[2])}`;
    }

    return Number(genericArity) > 0
      ? `${normalized}|${Number(genericArity)}`
      : "";
  }

  let catalogGenericRowsByShapeCache = null;

  function catalogGenericRowsByShape() {
    if (catalogGenericRowsByShapeCache) {
      return catalogGenericRowsByShapeCache;
    }

    const result = new Map();

    for (const row of CATALOG_TYPES) {
      const genericParameters =
        Array.isArray(row?.genericParameters)
          ? row.genericParameters
          : [];
      const shape = catalogGenericShape(
        row?.fullName,
        genericParameters.length
      );

      if (!shape) {
        continue;
      }

      if (!result.has(shape)) {
        result.set(shape, []);
      }

      result.get(shape).push(row);
    }

    catalogGenericRowsByShapeCache = result;
    return result;
  }

  function catalogTypeInformation(value) {
    return CATALOG_TYPE_BY_NAME.get(
      normalizedCatalogTypeName(value)
    ) || null;
  }

  function catalogTypeIsValueType(value) {
    const normalized =
      normalizedCatalogTypeName(value);
    const aliases = new Set([
      "bool", "byte", "sbyte", "short", "ushort",
      "int", "uint", "long", "ulong", "nint", "nuint",
      "char", "float", "double", "decimal",
      "System.Boolean", "System.Byte", "System.SByte",
      "System.Int16", "System.UInt16", "System.Int32",
      "System.UInt32", "System.Int64", "System.UInt64",
      "System.IntPtr", "System.UIntPtr", "System.Char",
      "System.Single", "System.Double", "System.Decimal"
    ]);

    if (aliases.has(normalized)) {
      return true;
    }

    const information =
      catalogTypeInformation(normalized);

    return Boolean(
      information &&
      ["struct", "enum"].includes(
        String(information.kind || "")
          .toLowerCase()
      )
    );
  }

  function substituteCatalogTypeParameters(
    value,
    substitutions
  ) {
    let result = String(value || "");

    for (const [name, replacement] of
      substitutions) {
      const escaped = name.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      result = result.replace(
        new RegExp(
          `(^|[^A-Za-z0-9_])${escaped}(?=$|[^A-Za-z0-9_])`,
          "g"
        ),
        (_match, prefix) =>
          `${prefix}${replacement}`
      );
    }

    return normalizedCatalogTypeName(result);
  }

  function catalogGenericArgumentIsKnown(value) {
    const normalized =
      normalizedCatalogTypeName(value);

    if (!normalized) {
      return false;
    }

    if (normalized.endsWith("[]")) {
      return catalogGenericArgumentIsKnown(
        normalized.slice(0, -2)
      );
    }

    if (
      catalogTypeInformation(normalized) ||
      catalogTypeIsValueType(normalized) ||
      [
        "object", "string", "System.Object",
        "System.String", "System.Type"
      ].includes(normalized)
    ) {
      return true;
    }

    const parsed =
      catalogGenericTypeParts(normalized);

    if (!parsed) {
      return false;
    }

    const rows =
      catalogGenericRowsByShape().get(
        catalogGenericShape(normalized)
      ) || [];

    return Boolean(
      rows.length > 0 &&
      parsed.arguments.every(
        catalogGenericArgumentIsKnown
      )
    );
  }

  function catalogGenericConstraintsAreSatisfied(
    definition,
    argumentsList
  ) {
    const parameters =
      Array.isArray(definition?.genericParameters)
        ? [...definition.genericParameters]
            .sort(
              (left, right) =>
                Number(left?.position) -
                Number(right?.position)
            )
        : [];

    if (
      parameters.length > 0 &&
      parameters.length !== argumentsList.length
    ) {
      return false;
    }

    const substitutions = new Map();

    parameters.forEach((parameter, index) => {
      substitutions.set(
        String(
          parameter?.name || `T${index}`
        ),
        argumentsList[index]
      );
    });

    return parameters.every(
      (parameter, index) => {
        const argument = argumentsList[index];
        const information =
          catalogTypeInformation(argument);
        const isValueType =
          catalogTypeIsValueType(argument);

        if (
          parameter?.valueTypeConstraint === true &&
          !isValueType
        ) {
          return false;
        }

        if (
          parameter?.referenceTypeConstraint === true &&
          isValueType
        ) {
          return false;
        }

        if (
          parameter?.defaultConstructorConstraint === true &&
          !isValueType &&
          information &&
          Array.isArray(information.constructors) &&
          information.constructors.length > 0 &&
          !information.constructors.some(
            constructor =>
              constructor?.isPublic !== false &&
              Array.isArray(
                constructor?.parameters
              ) &&
              constructor.parameters.length === 0
          )
        ) {
          return false;
        }

        const constraints =
          Array.isArray(parameter?.constraints)
            ? parameter.constraints
            : [];

        return constraints.every(value => {
          const constraint =
            substituteCatalogTypeParameters(
              value,
              substitutions
            );

          if (
            constraint === "System.ValueType"
          ) {
            return isValueType;
          }

          if (constraint === "System.Enum") {
            return String(
              information?.kind || ""
            ).toLowerCase() === "enum";
          }

          return catalogTypeSatisfiesConstraint(
            argument,
            constraint
          );
        });
      }
    );
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

  function catalogTypeSatisfiesConstraint(
    candidate,
    constraint,
    visited = new Set()
  ) {
    const candidateName =
      normalizedCatalogTypeName(candidate);
    const constraintName =
      normalizedCatalogTypeName(constraint);

    if (
      !candidateName ||
      !constraintName
    ) {
      return false;
    }

    if (
      candidateName === constraintName ||
      constraintName === "System.Object"
    ) {
      return true;
    }

    if (visited.has(candidateName)) {
      return false;
    }

    visited.add(candidateName);

    const information =
      CATALOG_TYPE_BY_NAME.get(
        candidateName
      );

    if (!information) {
      return false;
    }

    if (
      Array.isArray(information.interfaces) &&
      information.interfaces.some(value =>
        normalizedCatalogTypeName(value) ===
        constraintName
      )
    ) {
      return true;
    }

    return Boolean(
      information.baseType &&
      catalogTypeSatisfiesConstraint(
        information.baseType,
        constraintName,
        visited
      )
    );
  }

  function catalogCsTypeIsNullable(value) {
    return String(value || "")
      .trim()
      .replace(/^global::/, "")
      .startsWith(
        "System.Nullable<"
      );
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
      ["System.Uri", "Uri"],
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
      ["Renderite.Shared.TextureWrapMode", "textureWrapMode"],
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
    title: "URI Constant",
    group: "Values",
    symbol: "URI",
    description:
      "Creates a System.Uri from an absolute or relative string.",
    parameterKind: "string",
    outputs: [port("value", "URI", "Uri")],
    codegenExpression(api) {
      return `new Uri(${quote(api, api.node.parameters.value)}, UriKind.RelativeOrAbsolute)`;
    },
    previewEvaluate({ node, known }) {
      return known(
        "Uri",
        String(node.parameters?.value || "")
      );
    }
  });

  registerNode("constant.nullObject", {
    title: "Null Object",
    group: "Values",
    symbol: "∅",
    description:
      "A null object reference for optional reflection/API arguments.",
    outputs: [port("value", "Null", "object")],
    codegenExpression() {
      return "null!";
    },
    previewEvaluate({ known }) {
      return known("object", null);
    }
  });

  registerNode("constant.stringArray", {
    title: "String Array Constant",
    group: "Values",
    symbol: "T[]",
    description:
      "Splits one line per item into a string array.",
    parameters: [
      pCode(
        "items",
        "Items (one per line)",
        "System.String\nSystem.Int32",
        "Empty lines are ignored.",
        5
      )
    ],
    outputs: [port("value", "Values", "stringArray")],
    codegenCollect(api) {
      const items = String(
        api.node.parameters.items || ""
      )
        .split(/\r?\n/)
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => quote(api, value));
      const field =
        `_constantStringArray${nodeToken(api)}`;
      const initializer =
        items.length > 0
          ? `new string[] { ${items.join(", ")} }`
          : "Array.Empty<string>()";

      api.addField(
        `${api.node.id}.constantStringArray`,
        `private static readonly string[] ${field} = ${initializer};`
      );
    },
    codegenExpression(api) {
      return `_constantStringArray${nodeToken(api)}`;
    }
  });

  registerNode("constant.objectArray", {
    title: "Pack Object Array",
    group: "Values",
    symbol: "OBJ[]",
    description:
      "Packs two or more independently typed values into object?[]. Select the node and use + / − in the inspector to change the item count.",
    inputs: [
      port("a", "A", "object"),
      port("b", "B", "object")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: port("a", "A", "object")
    },
    outputs: [port("value", "Array", "objectArray")],
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
    title: "Vector Constant",
    group: "Values",
    symbol: "VEC",
    description:
      "An intelligent int/float/double 2D, 3D or 4D vector constant. Auto follows compatible connected vector sockets; an explicit type remains available.",
    configurableTypeVar: "T",
    configurableTypes:
      NUMERIC_VECTOR_TYPES,
    defaultType: "auto",
    autoFallbackType: "float3",
    allowAutoType: true,
    typeSelectorLabel: "Vector type",
    parameters: [
      pText(
        "components",
        "Components",
        "0, 0, 0",
        "One numeric field per vector component.",
        { kind: "vector" }
      )
    ],
    outputs: [
      genericPort(
        "value",
        "Value",
        "T",
        "arithmetic"
      )
    ],
    codegenExpression(api) {
      const type =
        NUMERIC_VECTOR_TYPES.includes(
          api.type
        )
          ? api.type
          : numericVectorDescriptor(
              api.node
            ).type;
      const count = Number(type.slice(-1));
      const scalar = type.startsWith("int")
        ? "int"
        : type.startsWith("double")
          ? "double"
          : "float";
      const parts = String(
        api.node.parameters.components || ""
      )
        .split(",")
        .map(value => value.trim())
        .filter(Boolean);
      while (parts.length < count) {
        parts.push("0");
      }
      return `new ${type}(${parts
        .slice(0, count)
        .map(value => api.numberLiteral(value, scalar))
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
          "The vector type is unresolved."
        );
      }

      const raw = String(
        node.parameters?.components ||
          ""
      )
        .split(",")
        .map(value => value.trim());
      const values = [];

      for (
        let index = 0;
        index <
          information.componentCount;
        index += 1
      ) {
        const number = Number(
          raw[index] || "0"
        );

        if (!Number.isFinite(number)) {
          return unknown(
            type,
            "A vector component is not finite."
          );
        }

        values.push(number);
      }

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
    const match = type.match(
      /^(int|float|double)([234])$/
    );

    return {
      type,
      scalarType:
        match?.[1] || "float",
      componentCount:
        Number(match?.[2]) || 3,
      componentIds:
        ["x", "y", "z", "w"].slice(
          0,
          Number(match?.[2]) || 3
        )
    };
  }

  function ensureNumericVectorRuntime(
    api
  ) {
    ensureReflectionRuntime(api);
    api.addMember(
      "universal.vector.components",
      String.raw`
private static T ReadNumericComponent<T>(
    object? value,
    string memberName)
{
    if (value is null)
    {
        return default!;
    }

    object? component = ReadMember(value, memberName);

    if (component is null)
    {
        return default!;
    }

    if (component is T typed)
    {
        return typed;
    }

    Type targetType =
        Nullable.GetUnderlyingType(typeof(T)) ??
        typeof(T);

    return (T)Convert.ChangeType(
        component,
        targetType,
        CultureInfo.InvariantCulture);
}
`
    );
  }

  registerNode("vector.compose", {
    title: "Compose Vector",
    group: "Values",
    symbol: "VEC+",
    description:
      "Builds any int/float/double 2D, 3D or 4D vector. Auto follows connected vector targets and scalar component sources; an explicit type can be locked in the inspector.",
    configurableTypeVar: "T",
    configurableTypes:
      NUMERIC_VECTOR_TYPES,
    defaultType: "auto",
    autoFallbackType: "float3",
    allowAutoType: true,
    typeSelectorLabel: "Vector type",
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
            "Value",
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

      return `new ${information.type}(${information.componentIds
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
          Number(current.value) || 0
        );
      }

      return known(
        information.type,
        values
      );
    }
  });

  registerNode("vector.decompose", {
    title: "Decompose Vector",
    group: "Values",
    symbol: "VEC−",
    description:
      "Splits any int/float/double 2D, 3D or 4D vector. Auto follows the connected vector source and compatible scalar targets; an explicit type can be locked in the inspector.",
    configurableTypeVar: "T",
    configurableTypes:
      NUMERIC_VECTOR_TYPES,
    defaultType: "auto",
    autoFallbackType: "float3",
    allowAutoType: true,
    typeSelectorLabel: "Vector type",
    resolveDefinition(node) {
      const information =
        numericVectorDescriptor(
          node
        );

      return {
        inputs: [
          port(
            "value",
            "Value",
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

      return `ReadNumericComponent<${information.scalarType}>(${api.input("value").code}, "${api.portId}")`;
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
        value.value?.[index] ?? 0
      );
    }
  });

  registerNode("flow.sequence", {
    title: "Sequence",
    group: "Flow",
    symbol: "1→N",
    description:
      "Invokes two or more impulse paths in deterministic order. Select the node and use + / − in the inspector to change the output count.",
    inputs: [port("call", "Call", "impulse")],
    outputs: [
      port("first", "First", "impulse"),
      port("second", "Second", "impulse")
    ],
    variadicOutputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      template: port("first", "First", "impulse"),
      ids: ["first", "second", "third", "fourth"],
      labels: ["First", "Second", "Third", "Fourth"]
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
    title: "Merge Impulses",
    group: "Flow",
    symbol: "↯∨",
    description:
      "Merges two or more independent impulse sources into one typed impulse path. The node starts with two inputs; select it and use + / − in the inspector to extend or shrink the input list.",
    inputs: [
      port("a", "A", "impulse"),
      port("b", "B", "impulse")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: port("a", "A", "impulse")
    },
    outputs: [port("out", "Output", "impulse")],
    codegenAction(api) {
      const next = api.emit("out");
      return next
        ? `${next}();`
        : "";
    }
  });

  registerNode("flow.branch", {
    title: "Branch",
    group: "Flow",
    symbol: "IF",
    description:
      "Routes an impulse through True or False.",
    inputs: [
      port("call", "Call", "impulse"),
      port("condition", "Condition", "bool")
    ],
    outputs: [
      port("true", "True", "impulse"),
      port("false", "False", "impulse")
    ],
    codegenAction(api) {
      const yes = api.emit("true");
      const no = api.emit("false");
      return `if (${api.input("condition").code})\n        {\n            ${yes ? `${yes}();` : "// No True path."}\n        }\n        else\n        {\n            ${no ? `${no}();` : "// No False path."}\n        }`;
    }
  });

  function ensureStructuredFlowRuntime(api) {
    api.addMember(
      "universal.flow.control-signals",
      String.raw`
private sealed class GraphBreakSignal : Exception
{
    public override string StackTrace => string.Empty;
}

private sealed class GraphContinueSignal : Exception
{
    public override string StackTrace => string.Empty;
}

private sealed class GraphReturnSignal : Exception
{
    public override string StackTrace => string.Empty;
}
`
    );
  }

  registerNode("flow.tryCatchFinally", {
    title: "Try / Catch / Finally",
    group: "Flow",
    symbol: "TRY",
    description:
      "Runs the Try branch inline, exposes the caught Exception, always runs Finally, and then continues through Completed.",
    inputs: [
      port("call", "Call", "impulse")
    ],
    outputs: [
      port("try", "Try", "impulse"),
      port("catch", "Catch", "impulse"),
      port("finally", "Finally", "impulse"),
      port("completed", "Completed", "impulse"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
      addStatefulField(
        api,
        "caughtException",
        "Exception?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_caughtException${nodeToken(api)}!`;
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

      return `${field} = null;\n        try\n        {${tryBranch ? `\n            ${tryBranch}();` : ""}\n        }\n        catch (GraphBreakSignal)\n        {\n            throw;\n        }\n        catch (GraphContinueSignal)\n        {\n            throw;\n        }\n        catch (GraphReturnSignal)\n        {\n            throw;\n        }\n        catch (Exception exception)\n        {\n            ${field} = exception;${catchBranch ? `\n            ${catchBranch}();` : ""}\n        }\n        finally\n        {${finallyBranch ? `\n            ${finallyBranch}();` : ""}\n        }${completed ? `\n        ${completed}();` : ""}`;
    }
  });

  registerNode("flow.whileLoop", {
    title: "While Loop",
    group: "Flow",
    symbol: "WHILE",
    description:
      "Runs Body inline while Condition is true. Maximum Iterations prevents an accidental endless update-frame loop; zero means no explicit limit.",
    inputs: [
      port("call", "Call", "impulse"),
      port("condition", "Condition", "bool"),
      port("maximumIterations", "Maximum Iterations", "int", {
        defaultCs: "1000000"
      })
    ],
    outputs: [
      port("body", "Body", "impulse"),
      port("completed", "Completed", "impulse")
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
      return `int ${count} = 0;\n        int ${maximum} = Math.Max(0, ${api.input("maximumIterations").code});\n        while (${api.input("condition").code})\n        {\n            if (${maximum} > 0 && ${count}++ >= ${maximum})\n            {\n                throw new InvalidOperationException("While Loop exceeded Maximum Iterations.");\n            }\n\n            try\n            {${body ? `\n                ${body}();` : ""}\n            }\n            catch (GraphContinueSignal)\n            {\n                continue;\n            }\n            catch (GraphBreakSignal)\n            {\n                break;\n            }\n        }${completed ? `\n        ${completed}();` : ""}`;
    }
  });

  registerNode("flow.doWhileLoop", {
    title: "Do / While Loop",
    group: "Flow",
    symbol: "DO",
    description:
      "Runs Body inline at least once and repeats while Condition is true.",
    inputs: [
      port("call", "Call", "impulse"),
      port("condition", "Condition", "bool"),
      port("maximumIterations", "Maximum Iterations", "int", {
        defaultCs: "1000000"
      })
    ],
    outputs: [
      port("body", "Body", "impulse"),
      port("completed", "Completed", "impulse")
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
      return `int ${count} = 0;\n        int ${maximum} = Math.Max(0, ${api.input("maximumIterations").code});\n        do\n        {\n            if (${maximum} > 0 && ${count}++ >= ${maximum})\n            {\n                throw new InvalidOperationException("Do / While Loop exceeded Maximum Iterations.");\n            }\n\n            try\n            {${body ? `\n                ${body}();` : ""}\n            }\n            catch (GraphContinueSignal)\n            {\n            }\n            catch (GraphBreakSignal)\n            {\n                break;\n            }\n        }\n        while (${api.input("condition").code});${completed ? `\n        ${completed}();` : ""}`;
    }
  });

  registerNode("flow.break", {
    title: "Break",
    group: "Flow",
    symbol: "BREAK",
    description:
      "Breaks the nearest inline While, Do / While or future structured loop.",
    inputs: [port("call", "Break", "impulse")],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
    },
    codegenAction() {
      return "throw new GraphBreakSignal();";
    }
  });

  registerNode("flow.continue", {
    title: "Continue",
    group: "Flow",
    symbol: "CONT",
    description:
      "Continues the nearest inline While, Do / While or future structured loop.",
    inputs: [port("call", "Continue", "impulse")],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
    },
    codegenAction() {
      return "throw new GraphContinueSignal();";
    }
  });

  registerNode("flow.lock", {
    title: "Lock",
    group: "Tasks & Threading",
    symbol: "LOCK",
    description:
      "Runs Body inline inside a C# lock statement and then emits Completed.",
    inputs: [
      port("call", "Call", "impulse"),
      port("syncRoot", "Sync Root", "object")
    ],
    outputs: [
      port("body", "Body", "impulse"),
      port("completed", "Completed", "impulse")
    ],
    codegenAction(api) {
      const body =
        api.inlineMethod(api.node.id, "body");
      const completed = api.emit("completed");
      return `lock (${api.input("syncRoot").code} ?? throw new ArgumentNullException("syncRoot"))\n        {${body ? `\n            ${body}();` : ""}\n        }${completed ? `\n        ${completed}();` : ""}`;
    }
  });

  registerNode("flow.using", {
    title: "Using / Dispose",
    group: "Flow",
    symbol: "USING",
    description:
      "Runs Body inline and disposes the supplied IDisposable in a finally block.",
    inputs: [
      port("call", "Call", "impulse"),
      port("resource", "Resource", "object")
    ],
    outputs: [
      port("body", "Body", "impulse"),
      port("completed", "Completed", "impulse")
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

  function graphUserMethodEntries(
    api,
    requestedName
  ) {
    const name = String(
      requestedName || ""
    ).trim();
    return (api.graph?.nodes || []).filter(
      node =>
        node?.operatorId ===
          "language.methodEntry" &&
        String(
          node?.parameters?.methodName || ""
        ).trim() === name
    );
  }

  function ensureGraphUserMethodRuntime(api) {
    ensureReflectionRuntime(api);
    ensureStructuredFlowRuntime(api);
    api.addUsing("System.Threading");
    api.addUsing("System.Collections.Generic");
    api.addField(
      "universal.language.method-context",
      "private static readonly AsyncLocal<Stack<GraphUserMethodFrame>?> _graphUserMethodFrames = new();"
    );
    api.addMember(
      "universal.language.method-runtime",
      String.raw`
private sealed class GraphUserMethodFrame
{
    public GraphUserMethodFrame(object?[] arguments)
    {
        Arguments = arguments;
    }

    public object?[] Arguments { get; }
    public object? Result { get; set; }
}

private static GraphUserMethodFrame PushGraphUserMethodFrame(object?[]? arguments)
{
    Stack<GraphUserMethodFrame>? stack = _graphUserMethodFrames.Value;

    if (stack is null)
    {
        stack = new Stack<GraphUserMethodFrame>();
        _graphUserMethodFrames.Value = stack;
    }

    GraphUserMethodFrame frame = new(arguments ?? Array.Empty<object?>());
    stack.Push(frame);
    return frame;
}

private static void PopGraphUserMethodFrame(GraphUserMethodFrame expected)
{
    Stack<GraphUserMethodFrame>? stack = _graphUserMethodFrames.Value;

    if (stack is null || stack.Count == 0 || !ReferenceEquals(stack.Peek(), expected))
    {
        throw new InvalidOperationException("Visual method context stack is inconsistent.");
    }

    stack.Pop();
    if (stack.Count == 0)
    {
        _graphUserMethodFrames.Value = null;
    }
}

private static GraphUserMethodFrame CurrentGraphUserMethodFrame()
{
    Stack<GraphUserMethodFrame>? stack = _graphUserMethodFrames.Value;
    return stack is not null && stack.Count > 0
        ? stack.Peek()
        : throw new InvalidOperationException("This node requires an active visual method call.");
}

private static T GraphUserMethodArgument<T>(int index)
{
    object?[] arguments = CurrentGraphUserMethodFrame().Arguments;
    return index >= 0 && index < arguments.Length
        ? ConvertGraphValue<T>(arguments[index])
        : default!;
}
`
    );
  }

  registerNode("language.methodEntry", {
    expertOnly: true,
    title: "Visual Method",
    group: "Visual C# Language",
    symbol: "METHOD",
    description:
      "Declares a reusable visual method. Arguments are supplied as an object array and read with Method Argument nodes; Return exits the method with a typed value.",
    parameters: [
      pText(
        "methodName",
        "Method name",
        "Method",
        "Unique method name used by Call Visual Method."
      )
    ],
    outputs: [
      port("body", "Body", "impulse"),
      port("arguments", "Arguments", "objectArray")
    ],
    codegenCollect(api) {
      ensureGraphUserMethodRuntime(api);
      const methodName = String(
        api.node.parameters?.methodName ||
        "Method"
      ).trim();
      const matches = graphUserMethodEntries(
        api,
        methodName
      );

      if (matches.length !== 1) {
        api.diagnostic(
          `Visual method '${methodName}' must be declared exactly once; found ${matches.length}.`
        );
        return;
      }

      const token = nodeToken(api);
      const body =
        api.inlineMethod(api.node.id, "body");
      api.addMember(
        `${api.node.id}.visual-method`,
        `private static object? UserMethod${token}(object?[]? arguments)\n{\n    GraphUserMethodFrame frame = PushGraphUserMethodFrame(arguments);\n\n    try\n    {${body ? `\n        ${body}();` : ""}\n    }\n    catch (GraphReturnSignal)\n    {\n    }\n    finally\n    {\n        PopGraphUserMethodFrame(frame);\n    }\n\n    return frame.Result;\n}`
      );
    },
    codegenExpression() {
      return "CurrentGraphUserMethodFrame().Arguments";
    }
  });

  registerNode("language.methodArgument", {
    expertOnly: true,
    title: "Method Argument",
    group: "Visual C# Language",
    symbol: "ARG",
    description:
      "Reads one zero-based argument from the active visual method and converts it to the selected graph type.",
    configurableTypeVar: "T",
    configurableTypes:
      COMMON_VALUE_TYPES.filter(type =>
        !["patchContext", "cancellationToken"].includes(type)
      ),
    defaultType: "object",
    inputs: [
      port("index", "Index", "int")
    ],
    outputs: [
      genericPort("value", "Value", "T", "anyValue")
    ],
    codegenCollect(api) {
      ensureGraphUserMethodRuntime(api);
    },
    codegenExpression(api) {
      const type =
        api.node.parameters?.valueType ||
        "object";
      return `GraphUserMethodArgument<${api.csType(type)}>(${api.input("index").code})`;
    }
  });

  registerNode("language.methodReturn", {
    expertOnly: true,
    title: "Return From Method",
    group: "Visual C# Language",
    symbol: "RETURN",
    description:
      "Sets the visual method result and exits its inline body immediately.",
    configurableTypeVar: "T",
    configurableTypes:
      COMMON_VALUE_TYPES.filter(type =>
        !["patchContext", "cancellationToken"].includes(type)
      ),
    defaultType: "object",
    inputs: [
      port("call", "Return", "impulse"),
      genericPort("value", "Value", "T", "anyValue")
    ],
    codegenCollect(api) {
      ensureGraphUserMethodRuntime(api);
    },
    codegenAction(api) {
      return `CurrentGraphUserMethodFrame().Result = ${api.input("value").code};\n        throw new GraphReturnSignal();`;
    }
  });

  registerNode("language.methodReturnVoid", {
    expertOnly: true,
    title: "Return From Method (Void)",
    group: "Visual C# Language",
    symbol: "RETURN",
    description:
      "Exits the active visual method without assigning a result.",
    inputs: [port("call", "Return", "impulse")],
    codegenCollect(api) {
      ensureGraphUserMethodRuntime(api);
    },
    codegenAction() {
      return "throw new GraphReturnSignal();";
    }
  });

  registerNode("language.callMethod", {
    expertOnly: true,
    title: "Call Visual Method",
    group: "Visual C# Language",
    symbol: "CALL",
    description:
      "Calls the unique Visual Method with the configured name. Recursion and nested calls use isolated method frames.",
    configurableTypeVar: "T",
    configurableTypes:
      COMMON_VALUE_TYPES.filter(type =>
        !["patchContext", "cancellationToken"].includes(type)
      ),
    defaultType: "object",
    parameters: [
      pText(
        "methodName",
        "Method name",
        "Method",
        "Must match exactly one Visual Method node."
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("arguments", "Arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("faulted", "Faulted", "impulse"),
      genericPort("result", "Result", "T", "anyValue"),
      port("success", "Success", "bool"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      ensureGraphUserMethodRuntime(api);
      const type =
        api.node.parameters?.valueType ||
        "object";
      addStatefulField(
        api,
        "visualMethodResult",
        api.csType(type),
        api.csDefault(type)
      );
      addStatefulField(
        api,
        "visualMethodSuccess",
        "bool",
        "false"
      );
      addStatefulField(
        api,
        "visualMethodException",
        "Exception?",
        "null"
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      if (api.portId === "success") {
        return `_visualMethodSuccess${token}`;
      }
      if (api.portId === "exception") {
        return `_visualMethodException${token}!`;
      }
      return `_visualMethodResult${token}`;
    },
    codegenAction(api) {
      const methodName = String(
        api.node.parameters?.methodName ||
        "Method"
      ).trim();
      const matches = graphUserMethodEntries(
        api,
        methodName
      );
      if (matches.length !== 1) {
        api.diagnostic(
          `Call Visual Method '${methodName}' requires exactly one declaration; found ${matches.length}.`
        );
        return "";
      }
      const methodToken =
        api.token(matches[0].id);
      const token = nodeToken(api);
      const result = `_visualMethodResult${token}`;
      const success = `_visualMethodSuccess${token}`;
      const exception = `_visualMethodException${token}`;
      const type =
        api.node.parameters?.valueType ||
        "object";
      const done = api.emit("done");
      const faulted = api.emit("faulted");
      return `try\n        {\n            ${exception} = null;\n            ${result} = ConvertGraphValue<${api.csType(type)}>(UserMethod${methodToken}(${api.input("arguments").code}));\n            ${success} = true;${done ? `\n            ${done}();` : ""}\n        }\n        catch (Exception caught)\n        {\n            ${exception} = caught;\n            ${success} = false;${faulted ? `\n            ${faulted}();` : ""}\n        }`;
    }
  });

  registerNode("language.lambdaAction", {
    title: "Create Callback",
    group: "Flow",
    symbol: "CALLBACK",
    description:
      "Turns the connected Body impulse path into a reusable callback. Use it for scanner API inputs such as System.Action without writing C#.",
    outputs: [
      port("body", "Body", "impulse"),
      port("action", "Action", "action")
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
    title: "Run Callback",
    group: "Flow",
    symbol: "RUN CB",
    description:
      "Runs a callback created visually or returned by a scanner API node.",
    inputs: [
      port("call", "Call", "impulse"),
      port("action", "Action", "action")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("action").code}?.Invoke();${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("flow.gate", {
    title: "Gate",
    group: "Flow",
    symbol: "GATE",
    description:
      "Passes the impulse only while Open is true.",
    inputs: [
      port("call", "Call", "impulse"),
      port("open", "Open", "bool")
    ],
    outputs: [port("passed", "Passed", "impulse")],
    codegenAction(api) {
      const next = api.emit("passed");
      return next
        ? `if (${api.input("open").code})\n        {\n            ${next}();\n        }`
        : "";
    }
  });

  registerNode("flow.once", {
    title: "Once",
    group: "Flow",
    symbol: "1×",
    description:
      "Passes only the first impulse until Reset is called.",
    inputs: [
      port("call", "Call", "impulse"),
      port("reset", "Reset", "impulse")
    ],
    outputs: [port("passed", "Passed", "impulse")],
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
    title: "Call Counter",
    group: "Flow",
    symbol: "#",
    description:
      "Increments on Call, resets on Reset and exposes the current count.",
    inputs: [
      port("call", "Call", "impulse"),
      port("reset", "Reset", "impulse")
    ],
    outputs: [
      port("changed", "Changed", "impulse"),
      port("count", "Count", "int")
    ],
    codegenCollect(api) {
      addStatefulField(
        api,
        "counter",
        "int",
        "0"
      );
    },
    codegenExpression(api) {
      return `_counter${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_counter${nodeToken(api)}`;
      const next = api.emit("changed");
      const operation =
        api.connection.toPort === "reset"
          ? `${field} = 0;`
          : `${field}++;`;
      return `${operation}${next ? `\n        ${next}();` : ""}`;
    }
  });

  registerNode("flow.forLoop", {
    title: "For Loop",
    group: "Flow",
    symbol: "FOR",
    description:
      "Runs Body Count times without requiring a graph cycle.",
    inputs: [
      port("call", "Call", "impulse"),
      port("count", "Count", "int")
    ],
    outputs: [
      port("body", "Body", "impulse"),
      port("completed", "Completed", "impulse"),
      port("index", "Index", "int")
    ],
    codegenCollect(api) {
      ensureStructuredFlowRuntime(api);
      addStatefulField(
        api,
        "loopIndex",
        "int",
        "0"
      );
    },
    codegenExpression(api) {
      return `_loopIndex${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_loopIndex${nodeToken(api)}`;
      const body =
        api.inlineMethod(api.node.id, "body");
      const done = api.emit("completed");
      return `for (${field} = 0; ${field} < Math.Max(0, ${api.input("count").code}); ${field}++)\n        {\n            try\n            {\n                ${body ? `${body}();` : "// No Body path."}\n            }\n            catch (GraphContinueSignal)\n            {\n                continue;\n            }\n            catch (GraphBreakSignal)\n            {\n                break;\n            }\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("flow.forEach", {
    title: "For Each",
    group: "Collections",
    symbol: "∀",
    description:
      "Iterates any typed array or System.Collections.IEnumerable collection. The Item output is inferred from the connected collection, Body runs once per element, Index is zero-based and Completed runs after the collection is exhausted (including empty or null collections).",
    inputs: [
      port("call", "Call", "impulse"),
      genericPort(
        "collection",
        "Collection",
        "TCollection",
        "enumerable"
      )
    ],
    outputs: [
      port("body", "Body", "impulse"),
      port("completed", "Completed", "impulse"),
      genericPort(
        "item",
        "Item",
        "TItem",
        "value"
      ),
      port("index", "Index", "int")
    ],
    genericRelations: [
      {
        kind: "enumerableElement",
        collectionTypeVar: "TCollection",
        elementTypeVar: "TItem"
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
      const token = nodeToken(api);

      addStatefulField(
        api,
        "forEachItem",
        api.csType(itemType),
        api.csDefault(itemType)
      );
      addStatefulField(
        api,
        "forEachIndex",
        "int",
        "0"
      );

      api.addUsing("System.Collections");
      api.addMember(
        "collection.foreach.runtime",
        String.raw`
private static System.Collections.IEnumerable GraphEnumerateCollection(object? collection)
{
    if (collection is null)
    {
        return System.Array.Empty<object>();
    }

    if (collection is System.Collections.IEnumerable enumerable)
    {
        return enumerable;
    }

    throw new System.InvalidOperationException(
        $"The runtime value {collection.GetType().FullName} is not enumerable.");
}

private static T GraphCollectionItem<T>(object? value)
{
    if (value is null)
    {
        return default!;
    }

    if (value is T typed)
    {
        return typed;
    }

    System.Type targetType =
        System.Nullable.GetUnderlyingType(typeof(T)) ??
        typeof(T);

    try
    {
        if (targetType.IsEnum)
        {
            object convertedEnum =
                value is string text
                    ? System.Enum.Parse(
                        targetType,
                        text,
                        ignoreCase: true)
                    : System.Enum.ToObject(
                        targetType,
                        value);

            return (T)convertedEnum;
        }

        if (
            value is System.IConvertible &&
            typeof(System.IConvertible)
                .IsAssignableFrom(targetType))
        {
            object? converted =
                System.Convert.ChangeType(
                    value,
                    targetType,
                    System.Globalization.CultureInfo.InvariantCulture);

            if (converted is T convertedTyped)
            {
                return convertedTyped;
            }
        }
    }
    catch (System.Exception exception)
    {
        throw new System.InvalidCastException(
            $"Collection item {value.GetType().FullName} cannot be converted to {typeof(T).FullName}.",
            exception);
    }

    throw new System.InvalidCastException(
        $"Collection item {value.GetType().FullName} cannot be used as {typeof(T).FullName}.");
}
`
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      const output = String(
        api.portId ||
        api.outputPortId ||
        ""
      );

      return output === "index"
        ? `_forEachIndex${token}`
        : `_forEachItem${token}`;
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

      return `${indexField} = 0;\nforeach (object? ${rawItem} in GraphEnumerateCollection(${api.input("collection").code}))\n        {\n            ${itemField} = GraphCollectionItem<${itemCsType}>(${rawItem});\n            try\n            {\n                ${body ? `${body}();` : "// No Body path."}\n            }\n            catch (GraphContinueSignal)\n            {\n                ${indexField}++;\n                continue;\n            }\n            catch (GraphBreakSignal)\n            {\n                break;\n            }\n            ${indexField}++;\n        }${completed ? `\n        ${completed}();` : ""}`;
    },
    previewEvaluate({
      portId,
      type,
      unknown
    }) {
      return unknown(
        type,
        portId === "index"
          ? "Runtime-only collection index"
          : "Runtime-only collection item"
      );
    }
  });


  registerNode("collection.getItemAtIndex", {
    title: "Get Item At Index",
    group: "Collections",
    symbol: "[i]",
    description:
      "Reads one strongly typed item from any synchronous IEnumerable collection. Index is zero-based. Item returns default(T) when the index is invalid; Success reports whether an item exists and Count exposes the collection size.",
    inputs: [
      genericPort(
        "collection",
        "Collection",
        "TCollection",
        "enumerable"
      ),
      port("index", "Index", "int")
    ],
    outputs: [
      genericPort(
        "item",
        "Item",
        "TItem",
        "value"
      ),
      port("success", "Success", "bool"),
      port("count", "Count", "int")
    ],
    genericRelations: [
      {
        kind: "enumerableElement",
        collectionTypeVar:
          "TCollection",
        elementTypeVar: "TItem",
        exact: true
      }
    ],
    codegenCollect(api) {
      api.addUsing("System.Collections");
      api.addUsing("System.Collections.Generic");
      api.addMember(
        "collection.item-at-index.runtime",
        String.raw`
private static int GraphCollectionCount(object? collection)
{
    if (collection is null)
    {
        return 0;
    }

    if (collection is System.Collections.ICollection direct)
    {
        return direct.Count;
    }

    if (collection is not System.Collections.IEnumerable enumerable ||
        collection is string)
    {
        return 0;
    }

    int count = 0;

    foreach (object? _ in enumerable)
    {
        count++;
    }

    return count;
}

private static bool GraphCollectionHasIndex(
    object? collection,
    int index)
{
    if (collection is null ||
        collection is string ||
        index < 0)
    {
        return false;
    }

    if (collection is System.Collections.IList list)
    {
        return index < list.Count;
    }

    if (collection is not System.Collections.IEnumerable enumerable)
    {
        return false;
    }

    int current = 0;

    foreach (object? _ in enumerable)
    {
        if (current == index)
        {
            return true;
        }

        current++;
    }

    return false;
}

private static T GraphCollectionItemAt<T>(
    object? collection,
    int index)
{
    if (collection is null ||
        collection is string ||
        index < 0)
    {
        return default!;
    }

    object? value = null;
    bool found = false;

    if (collection is System.Collections.IList list)
    {
        if (index < list.Count)
        {
            value = list[index];
            found = true;
        }
    }
    else if (collection is System.Collections.IEnumerable enumerable)
    {
        int current = 0;

        foreach (object? item in enumerable)
        {
            if (current == index)
            {
                value = item;
                found = true;
                break;
            }

            current++;
        }
    }

    if (!found)
    {
        return default!;
    }

    if (value is null)
    {
        return default!;
    }

    if (value is T typed)
    {
        return typed;
    }

    System.Type target =
        System.Nullable.GetUnderlyingType(
            typeof(T)) ??
        typeof(T);

    if (
        value is System.IConvertible &&
        typeof(System.IConvertible)
            .IsAssignableFrom(target))
    {
        return (T)System.Convert.ChangeType(
            value,
            target,
            System.Globalization.CultureInfo.InvariantCulture);
    }

    return (T)value;
}
`
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
          ? "Runtime-only collection index validity"
          : portId === "count"
            ? "Runtime-only collection count"
            : "Runtime-only collection item at index"
      );
    }
  });

  registerNode("collection.collectToList", {
    title: "Collect To List",
    group: "Collections",
    symbol: "＋[]",
    description:
      "Maintains a strongly typed List<T>. Reset clears the previous contents, Add appends the connected current Value, List exposes the complete live collection and Count exposes its current size. Value is mandatory whenever Add is triggered; missing Value is reported as a graph diagnostic instead of silently collecting null/default values. Use Reset Done to start a fresh For Each pass and connect For Each.Body to Add.",
    inputs: [
      port("reset", "Reset", "impulse"),
      port("add", "Add", "impulse"),
      genericPort(
        "value",
        "Value",
        "TItem",
        "value"
      )
    ],
    outputs: [
      port(
        "resetDone",
        "Reset Done",
        "impulse"
      ),
      port(
        "added",
        "Added",
        "impulse"
      ),
      genericPort(
        "list",
        "List",
        "TCollection",
        "collectableCollection"
      ),
      port("count", "Count", "int")
    ],
    parameters: [
      pBool(
        "markAsEditable",
        "Mark as Editable",
        false,
        "Exposes one collection-backed Dynamic Choice entry in the Configuration Outline node palette. Nothing is inserted into the outline until you explicitly click or drag that generated node into place."
      ),
      pText(
        "editableLabel",
        "Configuration label",
        "Dynamic Choice",
        "Visible label of the generated collection-backed node in the Configuration Outline palette."
      )
    ],
    genericRelations: [
      {
        kind: "enumerableElement",
        collectionTypeVar:
          "TCollection",
        elementTypeVar: "TItem",
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
            "Collect To List.Value must be connected before Add can execute. The previous graph silently added the type default (null for reference types)."
          );

          return `throw new System.InvalidOperationException("Collect To List.Value is not connected. Connect the per-item value before triggering Add.");`;
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
          ? "Runtime-only collected item count"
          : "Runtime-only collected list"
      );
    }
  });

  registerNode("debug.log", {
    title: "Log Message",
    group: "Debug & Output",
    symbol: "LOG",
    description:
      "Writes a formatted value through the generated mod's Msg logger.",
    inputs: [
      port("call", "Call", "impulse"),
      port("value", "Value", "object")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const next = api.emit("done");
      return `_display(FormatValue(${api.input("value").code}));${next ? `\n        ${next}();` : ""}`;
    }
  });

  registerNode("debug.throw", {
    title: "Throw Exception",
    group: "Debug & Output",
    symbol: "!",
    description:
      "Throws an InvalidOperationException with the supplied message.",
    inputs: [
      port("call", "Call", "impulse"),
      port("message", "Message", "string")
    ],
    codegenAction(api) {
      return `throw new InvalidOperationException(${api.input("message").code});`;
    }
  });

  registerNode("lifecycle.processExit", {
    title: "On Process Exit",
    group: "Lifecycle",
    symbol: "EXIT",
    description:
      "Fires when the .NET process is shutting down.",
    outputs: [port("event", "Event", "impulse")],
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
    title: "On Mod Unload",
    group: "Lifecycle",
    symbol: "MOD−",
    description:
      "Fires synchronously while a builder-generated mod is being deactivated or reloaded, before its AssemblyLoadContext is released. Use it to destroy world objects and other resources created by the graph.",
    outputs: [port("event", "Unload", "impulse")],
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
      api.addUsing("System.Threading");
      api.addField(
        "universal.lifecycle.shutdownState",
        "private static int _graphShutdownStarted;"
      );
      api.addMember(
        "universal.lifecycle.shutdown",
        `public static void Shutdown()
{
    Volatile.Write(
        ref _runtimeDisplayPumpStarted,
        0);

    if (Interlocked.Exchange(
            ref _graphShutdownStarted,
            1) != 0)
    {
        return;
    }

    try
    {
        bool dispatched =
            TryDispatchGraphToWorld(
                () =>
                {
                    ${emit}();
                    RefreshDisplays();
                });

        if (!dispatched)
        {
            _display(
                "Typed graph unload cleanup could not run because no usable Resonite world was available.");
        }
    }
    catch (Exception exception)
    {
        ReportGraphRuntimeFailure(
            "Mod unload cleanup",
            exception);
    }
    finally
    {
        try
        {
            UnsubscribeGraphEvents();
        }
        catch
        {
        }

    }
}`
      );
    }
  });

  registerNode("lifecycle.unhandledException", {
    title: "On Unhandled Exception",
    group: "Lifecycle",
    symbol: "EX!",
    description:
      "Fires for AppDomain unhandled exceptions and exposes the exception object.",
    outputs: [
      port("event", "Event", "impulse"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      const token = nodeToken(api);
      const field = `_unhandled${token}`;
      const emit = api.emitMethod(
        api.node.id,
        "event"
      );
      api.addRuntimeField(
        `${api.node.id}.exception`,
        field,
        "Exception",
        "null!"
      );
      if (emit) {
        api.addInitialize(
          `AppDomain.CurrentDomain.UnhandledException += (_, args) =>\n        {\n            using GraphExecutionScope scope = OpenGraphEntry();\n            ${field} = args.ExceptionObject as Exception ?? new Exception(FormatValue(args.ExceptionObject));\n            ${emit}();\n        };`
        );
      }
    },
    codegenExpression(api) {
      return `_unhandled${nodeToken(api)}`;
    }
  });

  registerNode("lifecycle.subscribeEvent", {
    title: "Subscribe .NET / Resonite Event",
    group: "Lifecycle",
    symbol: "+EV",
    description:
      "Subscribes to any reflected .NET event on Engine, World, Slot, Component or another object.",
    inputs: [
      port("target", "Target", "object"),
      port("eventName", "Event name", "string")
    ],
    outputs: [
      port("event", "Event", "impulse"),
      port("arguments", "Arguments", "objectArray")
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
      api.addRuntimeField(
        `${api.node.id}.args`,
        field,
        "object?[]",
        "Array.Empty<object?>()"
      );
      api.addMember(
        `${api.node.id}.callback`,
        `private static void ${callback}(object?[] arguments)\n{\n    using GraphExecutionScope scope = OpenGraphEntry();\n    ${field} = arguments;${emit ? `\n    ${emit}();` : ""}\n}`
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
    title: "Periodic Timer",
    group: "Lifecycle",
    symbol: "TMR",
    description:
      "Starts and stops a System.Threading.Timer and emits Tick at the requested interval.",
    inputs: [
      port("start", "Start", "impulse"),
      port("stop", "Stop", "impulse"),
      port("interval", "Interval ms", "int")
    ],
    outputs: [port("tick", "Tick", "impulse")],
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
        `private static void StopTimer${token}()\n{\n    Timer? timer = Interlocked.Exchange(ref ${field}, null);\n    if (timer is null)\n    {\n        return;\n    }\n\n    TrackGraphTask(timer.DisposeAsync().AsTask());\n}\n\nprivate static void StartTimer${token}(int interval)\n{\n    int safeInterval = Math.Max(1, interval);\n    StopTimer${token}();\n    ${field} = new Timer(_ => ${emit ? `${emit}()` : "{ }"}, null, safeInterval, safeInterval);\n}`
      );
      api.addRuntimeDrain(
        `StopTimer${token}();`
      );
    },
    codegenAction(api) {
      const token = nodeToken(api);
      if (api.connection.toPort === "stop") {
        return `StopTimer${token}();`;
      }
      return `StartTimer${token}(${api.input("interval").code});`;
    }
  });

  registerNode("harmony.patchEvent", {
    title: "Harmony Patch Event",
    group: "Harmony",
    symbol: "H",
    description:
      "Registers a runtime Prefix, Postfix or Finalizer and exposes its call as an impulse. Exact typed signatures, transpilers and complex result mutation remain available through Harmony Exact Patch Source.",
    parameters: [
      pSelect(
        "patchKind",
        "Patch kind",
        ["prefix", "postfix", "finalizer"],
        "prefix"
      ),
      pText(
        "targetType",
        "Target type",
        "FrooxEngine.Engine",
        "Full or assembly-qualified type name."
      ),
      pText(
        "targetMethod",
        "Target method",
        "OnReady",
        "Use .ctor or .cctor for constructors."
      ),
      pText(
        "argumentTypes",
        "Argument types",
        "",
        "Optional comma-separated full type names used to select an overload."
      ),
      pNumber(
        "priority",
        "Harmony priority",
        400,
        "Harmony Priority.Normal is 400."
      ),
      pBool(
        "captureResult",
        "Capture / replace __result",
        false,
        "Uses ref object __result. For value-type or unusual signatures use Harmony Exact Patch Source instead."
      )
    ],
    outputs: [
      port("called", "Called", "impulse"),
      port("context", "Context", "patchContext")
    ],
    codegenCollect(api) {
      api.require(
        "runtimeReloadUnsafe",
        true
      );
      ensureHarmonyRuntime(api);
      api.requireRuntimeHelper(
        "ReportGraphRuntimeFailure"
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
        "PatchContext",
        "new PatchContext()"
      );

      let callbackCode;

      if (kind === "finalizer") {
        callbackCode = `private static Exception? ${callback}(\n    object? __instance,\n    object?[] __args,\n    MethodBase __originalMethod,\n    Exception? __exception${resultParameter})\n{\n    try\n    {\n        using GraphExecutionScope scope = OpenGraphEntry();\n        ${field} = new PatchContext\n        {\n            Instance = __instance,\n            Arguments = __args,\n            OriginalMethod = __originalMethod,\n            Exception = __exception${resultInitializer}\n        };${emitStatement}${resultCommit}\n        return ${field}.Exception;\n    }\n    catch (Exception exception)\n    {\n        ReportGraphRuntimeFailure(\n            "${failureSource}",\n            exception);\n        return __exception;\n    }\n}`;
      } else if (kind === "postfix") {
        callbackCode = `private static void ${callback}(\n    object? __instance,\n    object?[] __args,\n    MethodBase __originalMethod${resultParameter})\n{\n    try\n    {\n        using GraphExecutionScope scope = OpenGraphEntry();\n        ${field} = new PatchContext\n        {\n            Instance = __instance,\n            Arguments = __args,\n            OriginalMethod = __originalMethod${resultInitializer}\n        };${emitStatement}${resultCommit}\n    }\n    catch (Exception exception)\n    {\n        ReportGraphRuntimeFailure(\n            "${failureSource}",\n            exception);\n    }\n}`;
      } else {
        callbackCode = `private static bool ${callback}(\n    object? __instance,\n    object?[] __args,\n    MethodBase __originalMethod${resultParameter})\n{\n    try\n    {\n        using GraphExecutionScope scope = OpenGraphEntry();\n        ${field} = new PatchContext\n        {\n            Instance = __instance,\n            Arguments = __args,\n            OriginalMethod = __originalMethod${resultInitializer}\n        };${emitStatement}${resultCommit}\n        return !${field}.SkipOriginal;\n    }\n    catch (Exception exception)\n    {\n        ReportGraphRuntimeFailure(\n            "${failureSource}",\n            exception);\n        return true;\n    }\n}`;
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
      group: "Lifecycle",
      symbol,
      description:
        `${description} The target type and method remain editable because internal Resonite names can change between builds.`,
      parameters: [
        pSelect(
          "patchKind",
          "Patch kind",
          ["prefix", "postfix", "finalizer"],
          "postfix"
        ),
        pText(
          "targetType",
          "Target type",
          targetType,
          "Editable full or assembly-qualified type name."
        ),
        pText(
          "targetMethod",
          "Target method",
          targetMethod,
          "Editable target method. Use the exact name from the current Resonite assemblies."
        ),
        pText(
          "argumentTypes",
          "Argument types",
          "",
          "Optional comma-separated type names for overload selection."
        ),
        pNumber(
          "priority",
          "Harmony priority",
          400
        ),
        pBool(
          "captureResult",
          "Capture / replace __result",
          false
        )
      ],
      outputs: [
        port("called", "Called", "impulse"),
        port("context", "Context", "patchContext")
      ],
      codegenCollect:
        harmonyDefinition.codegenCollect,
      codegenExpression:
        harmonyDefinition.codegenExpression
    });
  }

  registerLifecycleHarmonyPreset(
    "lifecycle.worldStart",
    "On World Start",
    "WORLD+",
    "FrooxEngine.World",
    "OnStart",
    "Editable Harmony preset for a world-start callback."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.worldDestroy",
    "On World Destroy",
    "WORLD−",
    "FrooxEngine.World",
    "OnDestroy",
    "Editable Harmony preset for world shutdown/destruction."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.userJoin",
    "On User Join",
    "USER+",
    "FrooxEngine.World",
    "OnUserJoined",
    "Editable Harmony preset for a user joining a world."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.userLeave",
    "On User Leave",
    "USER−",
    "FrooxEngine.World",
    "OnUserLeft",
    "Editable Harmony preset for a user leaving a world."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.componentAttach",
    "On Component Attach",
    "ATTACH",
    "FrooxEngine.Component",
    "OnAttach",
    "Editable Harmony preset for Component.OnAttach."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.componentDestroy",
    "On Component Destroy",
    "DEST",
    "FrooxEngine.Component",
    "OnDestroy",
    "Editable Harmony preset for a component destruction callback."
  );
  registerLifecycleHarmonyPreset(
    "lifecycle.engineUpdate",
    "On Engine Update",
    "UPDATE",
    "FrooxEngine.Engine",
    "Update",
    "Editable Harmony preset for an engine update callback."
  );

  registerNode("harmony.patchArgument", {
    title: "Patch Argument",
    group: "Harmony",
    symbol: "ARG",
    description:
      "Reads one argument from a Harmony Patch Context and converts it to the selected type.",
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
        "Argument index",
        0
      )
    ],
    inputs: [
      port("context", "Context", "patchContext")
    ],
    outputs: [
      genericPort(
        "value",
        "Value",
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
    title: "Patch Result",
    group: "Harmony",
    symbol: "RET",
    description:
      "Reads the captured Harmony result and converts it to the selected type.",
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
    inputs: [port("context", "Context", "patchContext")],
    outputs: [
      genericPort(
        "value",
        "Result",
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
    title: "Patch Exception",
    group: "Harmony",
    symbol: "EX",
    description:
      "Reads the exception visible to a Harmony Finalizer.",
    inputs: [port("context", "Context", "patchContext")],
    outputs: [port("exception", "Exception", "exception")],
    codegenExpression(api) {
      return `${api.input("context").code}.Exception!`;
    }
  });

  registerNode("harmony.setArgument", {
    title: "Set Patch Argument",
    group: "Harmony",
    symbol: "ARG=",
    description:
      "Replaces an entry in __args. Harmony copies supported argument changes back to the original call.",
    parameters: [
      pNumber(
        "index",
        "Argument index",
        0
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("context", "Context", "patchContext"),
      port("value", "Value", "object")
    ],
    outputs: [port("done", "Done", "impulse")],
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
    title: "Set Patch Result",
    group: "Harmony",
    symbol: "RET=",
    description:
      "Updates Patch Context.Result. The Patch Event must have Capture / replace __result enabled.",
    inputs: [
      port("call", "Call", "impulse"),
      port("context", "Context", "patchContext"),
      port("value", "Value", "object")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("context").code}.Result = ${api.input("value").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.skipOriginal", {
    title: "Skip Original",
    group: "Harmony",
    symbol: "SKIP",
    description:
      "Marks a Prefix Patch Context so the generated prefix returns false.",
    inputs: [
      port("call", "Call", "impulse"),
      port("context", "Context", "patchContext")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("context").code}.SkipOriginal = true;${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.setFinalizerException", {
    title: "Set Finalizer Exception",
    group: "Harmony",
    symbol: "EX=",
    description:
      "Replaces or clears the exception returned by a generated Harmony Finalizer.",
    inputs: [
      port("call", "Call", "impulse"),
      port("context", "Context", "patchContext"),
      port("exception", "Exception", "exception")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("context").code}.Exception = ${api.input("exception").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("harmony.reversePatch", {
    title: "Create Reverse Patch",
    group: "Harmony",
    expertOnly: true,
    symbol: "REV",
    description:
      "Creates a Harmony reverse patch between an existing target method and an exact stand-in method supplied in custom C# source.",
    parameters: [
      pText("targetType", "Target type", "FrooxEngine.SomeType"),
      pText("targetMethod", "Target method", "SomeMethod"),
      pText("targetArguments", "Target argument types", ""),
      pText(
        "standInType",
        "Stand-in type",
        "YourModNamespace.YourModReversePatches"
      ),
      pText(
        "standInMethod",
        "Stand-in method",
        "CallOriginal"
      )
    ],
    inputs: [port("call", "Create", "impulse")],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      api.require(
        "runtimeReloadUnsafe",
        true
      );
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
    title: "Unpatch Generated Harmony ID",
    group: "Harmony",
    symbol: "UNH",
    description:
      "Removes every patch created under this generated graph's Harmony ID.",
    inputs: [port("call", "Call", "impulse")],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureHarmonyRuntime(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `_graphHarmony.UnpatchAll(_graphHarmony.Id);${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.findType", {
    title: "Find Type",
    group: "Reflection",
    symbol: "TYPE",
    description:
      "Finds a loaded runtime type by full, assembly-qualified or short name.",
    inputs: [port("name", "Type name", "string")],
    outputs: [port("type", "Type", "type")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindType(${api.input("name").code})!`;
    }
  });

  registerNode("reflection.getMethod", {
    title: "Get MethodInfo",
    group: "Reflection",
    symbol: "M",
    description:
      "Resolves a reflected method, optionally selecting an overload with comma-separated argument types.",
    inputs: [
      port("type", "Type", "type"),
      port("name", "Method name", "string"),
      port("argumentTypes", "Argument types", "string")
    ],
    outputs: [port("method", "Method", "methodInfo")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindMethod(${api.input("type").code}, ${api.input("name").code}, ResolveTypeList(${api.input("argumentTypes").code}))!`;
    }
  });

  registerNode("reflection.getField", {
    title: "Get FieldInfo",
    group: "Reflection",
    symbol: "F",
    description:
      "Gets a public or non-public instance/static field.",
    inputs: [
      port("type", "Type", "type"),
      port("name", "Field name", "string")
    ],
    outputs: [port("field", "Field", "fieldInfo")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindGraphField(${api.input("type").code}, ${api.input("name").code})!`;
    }
  });

  registerNode("reflection.getProperty", {
    title: "Get PropertyInfo",
    group: "Reflection",
    symbol: "P",
    description:
      "Gets a public or non-public instance/static property.",
    inputs: [
      port("type", "Type", "type"),
      port("name", "Property name", "string")
    ],
    outputs: [port("property", "Property", "propertyInfo")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `FindGraphProperty(${api.input("type").code}, ${api.input("name").code})!`;
    }
  });

  registerNode("reflection.readMember", {
    title: "Read Member / Path",
    group: "Reflection",
    symbol: "GET",
    description:
      "Reads a field or property. Dots traverse nested members.",
    inputs: [
      port("target", "Target", "object"),
      port("path", "Member path", "string")
    ],
    outputs: [port("value", "Value", "object")],
    codegenExpression(api) {
      ensureReflectionRuntime(api);
      return `ReadMemberPath(${api.input("target").code}, ${api.input("path").code})!`;
    }
  });

  registerNode("reflection.convertObject", {
    title: "Convert Object",
    group: "Reflection",
    symbol: "CAST",
    description:
      "Converts an object to the selected graph type using reflection-aware conversion.",
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
    inputs: [port("value", "Object", "object")],
    outputs: [
      genericPort(
        "result",
        "Result",
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
    title: "Write Member",
    group: "Reflection",
    symbol: "SET",
    description:
      "Sets a reflected field or property on an object or Type.",
    inputs: [
      port("call", "Call", "impulse"),
      port("target", "Target", "object"),
      port("name", "Member name", "string"),
      port("value", "Value", "object")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      if (generatedOutputIsUsed(api, "success")) {
        addStatefulField(
          api,
          "writeSuccess",
          "bool",
          "false"
        );
      }
    },
    codegenExpression(api) {
      return `_writeSuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_writeSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      const invocation =
        `WriteMember(${api.input("target").code}, ${api.input("name").code}, ${api.input("value").code})`;
      const statement = generatedOutputIsUsed(
        api,
        "success"
      )
        ? `${field} = ${invocation};`
        : `_ = ${invocation};`;
      return `${statement}${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.invokeMethod", {
    title: "Invoke MethodInfo",
    group: "Reflection",
    symbol: "CALL",
    description:
      "Invokes a MethodInfo with an optional target and object argument array.",
    inputs: [
      port("call", "Call", "impulse"),
      port("method", "Method", "methodInfo"),
      port("target", "Target", "object"),
      port("arguments", "Arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("result", "Result", "object"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      const token = nodeToken(api);
      if (generatedOutputIsUsed(api, "result")) {
        api.addRuntimeField(
          `${api.node.id}.result`,
          `_invokeResult${token}`,
          "object?",
          "null"
        );
      }
      if (generatedOutputIsUsed(api, "exception")) {
        api.addRuntimeField(
          `${api.node.id}.error`,
          `_invokeException${token}`,
          "Exception",
          "null!"
        );
      }
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      return api.portId === "exception"
        ? `_invokeException${token}`
        : `_invokeResult${token}!`;
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const done = api.emit("done");
      const keepResult =
        generatedOutputIsUsed(api, "result");
      const keepException =
        generatedOutputIsUsed(api, "exception");
      const invocation =
        `InvokeMethodInfo(${api.input("method").code}, ${api.input("target").code}, ${api.input("arguments").code})`;
      const before = keepException
        ? `_invokeException${token} = null!;\n            `
        : "";
      const execute = keepResult
        ? `_invokeResult${token} = ${invocation};`
        : `_ = ${invocation};`;
      const failure = [
        keepException
          ? `_invokeException${token} = exception;`
          : "",
        keepResult
          ? `_invokeResult${token} = null;`
          : ""
      ].filter(Boolean).join("\n            ");
      const catchDeclaration = keepException
        ? "catch (Exception exception)"
        : "catch (Exception)";
      return `try\n        {\n            ${before}${execute}\n        }\n        ${catchDeclaration}\n        {${failure ? `\n            ${failure}\n        ` : ""}}${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.callByName", {
    title: "Call Method By Name",
    group: "Reflection",
    symbol: "NAME()",
    description:
      "Invokes the best matching instance or static method by name.",
    inputs: [
      port("call", "Call", "impulse"),
      port("target", "Target / Type", "object"),
      port("name", "Method name", "string"),
      port("arguments", "Arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("result", "Result", "object")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      if (generatedOutputIsUsed(api, "result")) {
        const field = `_callResult${nodeToken(api)}`;
        api.addField(
          `${api.node.id}.callResult`,
          `private static object? ${field} { get; set; }`
        );
      }
    },
    codegenExpression(api) {
      return `_callResult${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_callResult${nodeToken(api)}`;
      const done = api.emit("done");
      const invocation =
        `InvokeBest(${api.input("target").code}, ${api.input("name").code}, ${api.input("arguments").code})`;
      const statement = generatedOutputIsUsed(
        api,
        "result"
      )
        ? `${field} = ${invocation};`
        : `_ = ${invocation};`;
      return `${statement}${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("reflection.createInstance", {
    title: "Create Instance",
    group: "Reflection",
    symbol: "NEW",
    description:
      "Constructs a reflected Type with an object argument array.",
    inputs: [
      port("call", "Call", "impulse"),
      port("type", "Type", "type"),
      port("arguments", "Arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("instance", "Instance", "object")
    ],
    codegenCollect(api) {
      ensureReflectionRuntime(api);
      if (generatedOutputIsUsed(api, "instance")) {
        addStatefulField(
          api,
          "createdInstance",
          "object?",
          "null"
        );
      }
    },
    codegenExpression(api) {
      return `_createdInstance${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_createdInstance${nodeToken(api)}`;
      const done = api.emit("done");
      const invocation =
        `CreateReflective(${api.input("type").code}, ${api.input("arguments").code})`;
      const statement = generatedOutputIsUsed(
        api,
        "instance"
      )
        ? `${field} = ${invocation};`
        : `_ = ${invocation};`;
      return `${statement}${done ? `\n        ${done}();` : ""}`;
    }
  });



  registerNode("file.combinePath", {
    title: "Combine Path",
    group: "Files & JSON",
    symbol: "PATH",
    description:
      "Combines two or more filesystem path segments. Select the node and use + / − in the inspector to change the segment count.",
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
    outputs: [port("path", "Path", "string")],
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
    title: "File Exists",
    group: "Files & JSON",
    symbol: "F?",
    description: "Checks File.Exists(path).",
    inputs: [port("path", "Path", "string")],
    outputs: [port("exists", "Exists", "bool")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      return `File.Exists(${api.input("path").code})`;
    }
  });

  registerNode("file.directoryExists", {
    title: "Directory Exists",
    group: "Files & JSON",
    symbol: "D?",
    description: "Checks Directory.Exists(path).",
    inputs: [port("path", "Path", "string")],
    outputs: [port("exists", "Exists", "bool")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      return `Directory.Exists(${api.input("path").code})`;
    }
  });

  registerNode("file.readText", {
    title: "Read Text File",
    group: "Files & JSON",
    symbol: "READ",
    description:
      "Reads UTF-8 text and exposes any exception without crashing the graph path.",
    inputs: [
      port("call", "Call", "impulse"),
      port("path", "Path", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("text", "Text", "string"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      api.addUsing("System.IO");
      const token = nodeToken(api);
      api.addRuntimeField(
        `${api.node.id}.text`,
        `_readText${token}`,
        "string",
        "string.Empty"
      );
      api.addRuntimeField(
        `${api.node.id}.exception`,
        `_readTextException${token}`,
        "Exception",
        "null!"
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      return api.portId === "exception"
        ? `_readTextException${token}`
        : `_readText${token}`;
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const done = api.emit("done");
      return `try\n        {\n            _readTextException${token} = null!;\n            _readText${token} = File.ReadAllText(${api.input("path").code});\n        }\n        catch (Exception exception)\n        {\n            _readTextException${token} = exception;\n            _readText${token} = string.Empty;\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.readBytes", {
    title: "Read Binary File",
    group: "Files & JSON",
    symbol: "BIN←",
    description: "Reads all bytes from a file.",
    inputs: [
      port("call", "Call", "impulse"),
      port("path", "Path", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("bytes", "Bytes", "byteArray")
    ],
    codegenCollect(api) {
      api.addUsing("System.IO");
      addStatefulField(
        api,
        "readBytes",
        "byte[]",
        "Array.Empty<byte>()"
      );
    },
    codegenExpression(api) {
      return `_readBytes${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_readBytes${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = File.ReadAllBytes(${api.input("path").code});${done ? `\n        ${done}();` : ""}`;
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
      group: "Files & JSON",
      symbol,
      description,
      inputs: [
        port("call", "Call", "impulse"),
        port("path", "Path", "string"),
        port("value", "Value", valueType)
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("exception", "Exception", "exception")
      ],
      codegenCollect(api) {
        api.addUsing("System.IO");
        api.addRuntimeField(
          `${api.node.id}.exception`,
          `_fileWriteException${nodeToken(api)}`,
          "Exception",
          "null!"
        );
      },
      codegenExpression(api) {
        return `_fileWriteException${nodeToken(api)}`;
      },
      codegenAction(api) {
        const token = nodeToken(api);
        const done = api.emit("done");
        return `try\n        {\n            _fileWriteException${token} = null!;\n            ${method}(${api.input("path").code}, ${api.input("value").code});\n        }\n        catch (Exception exception)\n        {\n            _fileWriteException${token} = exception;\n        }${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerFileWriteNode(
    "file.writeText",
    "Write Text File",
    "WRITE",
    "File.WriteAllText",
    "string",
    "Overwrites a UTF-8 text file."
  );
  registerFileWriteNode(
    "file.appendText",
    "Append Text File",
    "APPEND",
    "File.AppendAllText",
    "string",
    "Appends UTF-8 text to a file."
  );
  registerFileWriteNode(
    "file.writeBytes",
    "Write Binary File",
    "BIN→",
    "File.WriteAllBytes",
    "byteArray",
    "Writes a complete byte array to a file."
  );

  registerNode("file.createDirectory", {
    title: "Create Directory",
    group: "Files & JSON",
    symbol: "+DIR",
    description:
      "Creates the directory and all missing parents.",
    inputs: [
      port("call", "Call", "impulse"),
      port("path", "Path", "string")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `Directory.CreateDirectory(${api.input("path").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("file.delete", {
    title: "Delete File / Directory",
    group: "Files & JSON",
    symbol: "DEL",
    description:
      "Deletes a file, or recursively deletes a directory when Recursive is enabled.",
    parameters: [
      pBool(
        "recursive",
        "Recursive directory delete",
        false
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("path", "Path", "string")
    ],
    outputs: [port("done", "Done", "impulse")],
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
    title: "Enumerate Files",
    group: "Files & JSON",
    symbol: "FILES",
    description:
      "Returns matching files from a directory.",
    parameters: [
      pSelect(
        "scope",
        "Search scope",
        [
          ["top", "Top directory only"],
          ["all", "All directories"]
        ],
        "top"
      )
    ],
    inputs: [
      port("directory", "Directory", "string"),
      port("pattern", "Pattern", "string")
    ],
    outputs: [port("files", "Files", "stringArray")],
    codegenCollect(api) {
      api.addUsing("System.IO");
    },
    codegenExpression(api) {
      const scope =
        api.node.parameters.scope === "all"
          ? "SearchOption.AllDirectories"
          : "SearchOption.TopDirectoryOnly";
      return `Directory.Exists(${api.input("directory").code}) ? Directory.GetFiles(${api.input("directory").code}, ${api.input("pattern").code}, ${scope}) : Array.Empty<string>()`;
    }
  });

  registerNode("json.parse", {
    title: "Parse JSON",
    group: "Files & JSON",
    symbol: "{}",
    description:
      "Parses text into System.Text.Json.Nodes.JsonNode.",
    inputs: [port("text", "JSON text", "string")],
    outputs: [port("json", "JSON", "json")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `ParseGraphJson(${api.input("text").code})!`;
    }
  });

  registerNode("json.serialize", {
    title: "Serialize JSON",
    group: "Files & JSON",
    symbol: "{}→T",
    description:
      "Serializes any value with System.Text.Json.",
    parameters: [
      pBool(
        "indented",
        "Indented",
        true
      )
    ],
    inputs: [port("value", "Value", "object")],
    outputs: [port("text", "JSON text", "string")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `SerializeGraphJson(${api.input("value").code}, ${api.node.parameters.indented === true ? "true" : "false"})`;
    }
  });

  registerNode("json.property", {
    title: "JSON Property / Path",
    group: "Files & JSON",
    symbol: ".JSON",
    description:
      "Reads nested object properties or array indexes with a dot-separated path.",
    inputs: [
      port("json", "JSON", "json"),
      port("path", "Path", "string")
    ],
    outputs: [port("value", "JSON value", "json")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `ReadGraphJsonProperty(${api.input("json").code}, ${api.input("path").code})!`;
    }
  });

  registerNode("json.asString", {
    title: "JSON As String",
    group: "Files & JSON",
    symbol: "JSON→T",
    description:
      "Reads a JSON string scalar or returns compact JSON text.",
    inputs: [port("json", "JSON", "json")],
    outputs: [port("text", "Text", "string")],
    codegenExpression(api) {
      ensureJsonRuntime(api);
      return `GraphJsonAsString(${api.input("json").code})`;
    }
  });

  registerNode("json.convert", {
    title: "JSON Convert To",
    group: "Files & JSON",
    symbol: "JSON→T",
    description:
      "Deserializes a JsonNode into the selected graph value type.",
    configurableTypeVar: "T",
    configurableTypes: JSON_CONVERTIBLE_TYPES,
    defaultType: "string",
    inputs: [port("json", "JSON", "json")],
    outputs: [
      genericPort(
        "value",
        "Value",
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
    title: "HTTP Request",
    group: "Networking",
    symbol: "HTTP",
    description:
      "Performs an asynchronous HttpClient request and emits Done when the response or error is available.",
    parameters: [
      pSelect(
        "method",
        "HTTP method",
        [
          "GET",
          "POST",
          "PUT",
          "PATCH",
          "DELETE",
          "HEAD"
        ],
        "GET"
      ),
      pText(
        "contentType",
        "Content type",
        "application/json"
      ),
      pCode(
        "headers",
        "Headers",
        "",
        "One Header: Value pair per line.",
        5
      )
    ],
    inputs: [
      port("call", "Send", "impulse"),
      port("url", "URL", "string"),
      port("body", "Body", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("response", "Response", "httpResponse"),
      port("status", "Status code", "int"),
      port("body", "Response body", "string"),
      port("contentType", "Content type", "string"),
      port("success", "Success", "bool"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const emit = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addRuntimeField(
        `${api.node.id}.response`,
        `_httpResponse${token}`,
        "GraphHttpResponse",
        "GraphHttpResponse.Empty"
      );
      api.addMember(
        `${api.node.id}.send`,
        `private static async void SendHttp${token}(string url, string body)\n{\n    try\n    {\n        using HttpRequestMessage request = new(new HttpMethod(${quote(
          api,
          api.node.parameters.method || "GET"
        )}), url);\n\n        if (!string.IsNullOrEmpty(body) && request.Method != HttpMethod.Get && request.Method != HttpMethod.Head)\n        {\n            request.Content = new StringContent(body, Encoding.UTF8, ${quote(
          api,
          api.node.parameters.contentType ||
            "application/json"
        )});\n        }\n\n        foreach (string line in ${quote(
          api,
          api.node.parameters.headers || ""
        )}.Split('\\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))\n        {\n            int separator = line.IndexOf(':');\n            if (separator <= 0) continue;\n            string name = line[..separator].Trim();\n            string value = line[(separator + 1)..].Trim();\n            if (!request.Headers.TryAddWithoutValidation(name, value))\n            {\n                request.Content?.Headers.TryAddWithoutValidation(name, value);\n            }\n        }\n\n        using HttpResponseMessage response = await _graphHttpClient.SendAsync(request).ConfigureAwait(false);\n        string responseBody = await response.Content.ReadAsStringAsync().ConfigureAwait(false);\n        _httpResponse${token} = new GraphHttpResponse(\n            (int)response.StatusCode,\n            responseBody,\n            response.Content.Headers.ContentType?.ToString() ?? string.Empty,\n            response.IsSuccessStatusCode,\n            string.Empty);\n    }\n    catch (Exception exception)\n    {\n        _httpResponse${token} = new GraphHttpResponse(\n            0,\n            string.Empty,\n            string.Empty,\n            false,\n            exception.ToString());\n    }${emit ? `\n\n    ${emit}();` : ""}\n}`
      );
    },
    codegenExpression(api) {
      const field = `_httpResponse${nodeToken(api)}`;
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
    title: "WebSocket Client",
    group: "Networking",
    symbol: "WS",
    description:
      "Connects a ClientWebSocket, receives text/binary messages and exposes connection events.",
    parameters: [
      pCode(
        "headers",
        "Request headers",
        "",
        "One Header: Value pair per line.",
        5
      )
    ],
    inputs: [
      port("connect", "Connect", "impulse"),
      port("close", "Close", "impulse"),
      port("url", "URL", "string")
    ],
    outputs: [
      port("connected", "Connected", "impulse"),
      port("message", "Message", "impulse"),
      port("closed", "Closed", "impulse"),
      port("socket", "Socket", "webSocket"),
      port("text", "Latest text", "string"),
      port("bytes", "Latest bytes", "byteArray"),
      port("isConnected", "Is connected", "bool"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      api.addUsing("System.IO");
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
      api.addField(
        `${api.node.id}.socket`,
        `private static ClientWebSocket? _webSocket${token};`
      );
      api.addField(
        `${api.node.id}.text`,
        `private static string _webSocketText${token} = string.Empty;`
      );
      api.addField(
        `${api.node.id}.bytes`,
        `private static byte[] _webSocketBytes${token} = Array.Empty<byte>();`
      );
      api.addField(
        `${api.node.id}.connected`,
        `private static bool _webSocketConnected${token};`
      );
      api.addField(
        `${api.node.id}.error`,
        `private static string _webSocketError${token} = string.Empty;`
      );
      api.addMember(
        `${api.node.id}.connect`,
        `private static async void ConnectWebSocket${token}(string url)\n{\n    try\n    {\n        if (_webSocket${token} is not null)\n        {\n            _webSocket${token}.Dispose();\n        }\n\n        _webSocket${token} = new ClientWebSocket();\n        _webSocketError${token} = string.Empty;\n\n        foreach (string line in ${quote(
          api,
          api.node.parameters.headers || ""
        )}.Split('\\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))\n        {\n            int separator = line.IndexOf(':');\n            if (separator > 0)\n            {\n                _webSocket${token}.Options.SetRequestHeader(\n                    line[..separator].Trim(),\n                    line[(separator + 1)..].Trim());\n            }\n        }\n\n        await _webSocket${token}.ConnectAsync(new Uri(url), CancellationToken.None).ConfigureAwait(false);\n        _webSocketConnected${token} = true;${connected ? `\n        ${connected}();` : ""}\n\n        byte[] buffer = new byte[64 * 1024];\n\n        while (_webSocket${token}.State == WebSocketState.Open)\n        {\n            using MemoryStream frame = new();\n            WebSocketReceiveResult result;\n\n            do\n            {\n                result = await _webSocket${token}\n                    .ReceiveAsync(buffer, CancellationToken.None)\n                    .ConfigureAwait(false);\n\n                if (result.Count > 0)\n                {\n                    frame.Write(buffer, 0, result.Count);\n                }\n            }\n            while (!result.EndOfMessage);\n\n            if (result.MessageType == WebSocketMessageType.Close)\n            {\n                break;\n            }\n\n            _webSocketBytes${token} = frame.ToArray();\n            _webSocketText${token} = result.MessageType == WebSocketMessageType.Text\n                ? Encoding.UTF8.GetString(_webSocketBytes${token})\n                : string.Empty;${message ? `\n            ${message}();` : ""}\n        }\n    }\n    catch (Exception exception)\n    {\n        _webSocketError${token} = exception.ToString();\n    }\n    finally\n    {\n        _webSocketConnected${token} = false;${closed ? `\n        ${closed}();` : ""}\n    }\n}\n\nprivate static async void CloseWebSocket${token}()\n{\n    try\n    {\n        if (_webSocket${token}?.State == WebSocketState.Open)\n        {\n            await _webSocket${token}\n                .CloseAsync(WebSocketCloseStatus.NormalClosure, "Graph close", CancellationToken.None)\n                .ConfigureAwait(false);\n        }\n    }\n    catch (Exception exception)\n    {\n        _webSocketError${token} = exception.ToString();\n    }\n}`
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
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
    title: "WebSocket Send",
    group: "Networking",
    symbol: "WS→",
    description:
      "Sends a text message over an open ClientWebSocket.",
    inputs: [
      port("call", "Send", "impulse"),
      port("socket", "Socket", "webSocket"),
      port("text", "Text", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addRuntimeField(
        `${api.node.id}.error`,
        `_webSocketSendError${token}`,
        "string",
        "string.Empty"
      );
      api.addMember(
        `${api.node.id}.send`,
        `private static async void SendWebSocket${token}(ClientWebSocket socket, string text)\n{\n    try\n    {\n        _webSocketSendError${token} = string.Empty;\n        byte[] data = Encoding.UTF8.GetBytes(text ?? string.Empty);\n        await socket.SendAsync(data, WebSocketMessageType.Text, true, CancellationToken.None).ConfigureAwait(false);\n    }\n    catch (Exception exception)\n    {\n        _webSocketSendError${token} = exception.ToString();\n    }${done ? `\n\n    ${done}();` : ""}\n}`
      );
    },
    codegenExpression(api) {
      return `_webSocketSendError${nodeToken(api)}`;
    },
    codegenAction(api) {
      return `SendWebSocket${nodeToken(api)}(${api.input("socket").code}, ${api.input("text").code});`;
    }
  });

  registerNode("network.tcpSend", {
    title: "TCP Send Text",
    group: "Networking",
    symbol: "TCP",
    description:
      "Connects to a TCP host, sends UTF-8 text and closes the connection.",
    inputs: [
      port("call", "Send", "impulse"),
      port("host", "Host", "string"),
      port("port", "Port", "int"),
      port("text", "Text", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addRuntimeField(
        `${api.node.id}.error`,
        `_tcpError${token}`,
        "string",
        "string.Empty"
      );
      api.addMember(
        `${api.node.id}.send`,
        `private static async void SendTcp${token}(string host, int port, string text)\n{\n    try\n    {\n        _tcpError${token} = string.Empty;\n        using TcpClient client = new();\n        await client.ConnectAsync(host, port).ConfigureAwait(false);\n        byte[] data = Encoding.UTF8.GetBytes(text ?? string.Empty);\n        await client.GetStream().WriteAsync(data).ConfigureAwait(false);\n    }\n    catch (Exception exception)\n    {\n        _tcpError${token} = exception.ToString();\n    }${done ? `\n\n    ${done}();` : ""}\n}`
      );
    },
    codegenExpression(api) {
      return `_tcpError${nodeToken(api)}`;
    },
    codegenAction(api) {
      return `SendTcp${nodeToken(api)}(${api.input("host").code}, ${api.input("port").code}, ${api.input("text").code});`;
    }
  });

  registerNode("network.udpSend", {
    title: "UDP Send Text",
    group: "Networking",
    symbol: "UDP",
    description:
      "Sends one UTF-8 datagram to a host and port.",
    inputs: [
      port("call", "Send", "impulse"),
      port("host", "Host", "string"),
      port("port", "Port", "int"),
      port("text", "Text", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("error", "Error", "string")
    ],
    codegenCollect(api) {
      ensureNetworkRuntime(api);
      const token = nodeToken(api);
      const done = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addRuntimeField(
        `${api.node.id}.error`,
        `_udpError${token}`,
        "string",
        "string.Empty"
      );
      api.addMember(
        `${api.node.id}.send`,
        `private static async void SendUdp${token}(string host, int port, string text)\n{\n    try\n    {\n        _udpError${token} = string.Empty;\n        using UdpClient client = new();\n        byte[] data = Encoding.UTF8.GetBytes(text ?? string.Empty);\n        await client.SendAsync(data, data.Length, host, port).ConfigureAwait(false);\n    }\n    catch (Exception exception)\n    {\n        _udpError${token} = exception.ToString();\n    }${done ? `\n\n    ${done}();` : ""}\n}`
      );
    },
    codegenExpression(api) {
      return `_udpError${nodeToken(api)}`;
    },
    codegenAction(api) {
      return `SendUdp${nodeToken(api)}(${api.input("host").code}, ${api.input("port").code}, ${api.input("text").code});`;
    }
  });

  registerNode("task.delay", {
    title: "Delay",
    group: "Tasks & Threading",
    symbol: "WAIT",
    description:
      "Waits asynchronously without blocking the Resonite thread, then emits Done.",
    inputs: [
      port("call", "Start", "impulse"),
      port("milliseconds", "Milliseconds", "int")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
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
      return `Delay${nodeToken(api)}(${api.input("milliseconds").code});`;
    }
  });

  registerNode("task.background", {
    title: "Run On ThreadPool",
    group: "Tasks & Threading",
    symbol: "BG",
    description:
      "Emits Background on a Task.Run worker and Completed when that path returns.",
    inputs: [port("call", "Start", "impulse")],
    outputs: [
      port("background", "Background", "impulse"),
      port("completed", "Completed", "impulse")
    ],
    codegenCollect(api) {
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
        `private static void RunBackground${token}()\n{\n    Task completion = Task.Run(() =>\n    {${background ? `\n        ${background}();` : ""}\n    }).ContinueWith(_ =>\n    {${completed ? `\n        ${completed}();` : ""}\n    }, CancellationToken.None, TaskContinuationOptions.None, TaskScheduler.Default);\n    TrackGraphTask(completion);\n}`
      );
    },
    codegenAction(api) {
      return `RunBackground${nodeToken(api)}();`;
    }
  });

  registerNode("task.await", {
    title: "Await Task",
    group: "Tasks & Threading",
    symbol: "AWAIT",
    description:
      "Awaits a Task asynchronously and emits Done or Faulted.",
    inputs: [
      port("call", "Await", "impulse"),
      port("task", "Task", "task")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("faulted", "Faulted", "impulse"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
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
      api.addRuntimeField(
        `${api.node.id}.exception`,
        `_awaitException${token}`,
        "Exception",
        "null!"
      );
      api.addMember(
        `${api.node.id}.await`,
        `private static async void AwaitTask${token}(Task task)\n{\n    try\n    {\n        _awaitException${token} = null!;\n        await task.ConfigureAwait(false);${done ? `\n        ${done}();` : ""}\n    }\n    catch (Exception exception)\n    {\n        _awaitException${token} = exception;${faulted ? `\n        ${faulted}();` : ""}\n    }\n}`
      );
    },
    codegenExpression(api) {
      return `_awaitException${nodeToken(api)}`;
    },
    codegenAction(api) {
      return `AwaitTask${nodeToken(api)}(${api.input("task").code});`;
    }
  });

  registerNode("task.completedTask", {
    title: "Completed Task",
    group: "Tasks & Threading",
    symbol: "TASK",
    description: "Task.CompletedTask.",
    outputs: [port("task", "Task", "task")],
    codegenCollect(api) {
      ensureTaskRuntime(api);
    },
    codegenExpression() {
      return "Task.CompletedTask";
    }
  });

  registerNode("flow.customEvent", {
    title: "Custom Event",
    group: "Flow",
    symbol: "EV",
    description:
      "A named graph event source that can be raised from any impulse path.",
    inputs: [port("raise", "Raise", "impulse")],
    outputs: [port("event", "Event", "impulse")],
    codegenAction(api) {
      const emit = api.emit("event");
      return emit ? `${emit}();` : "";
    }
  });

  
  
  
  

  registerGroup("Text", { after: "Values" });
  registerGroup("Dictionaries", { after: "Collections" });

  const NORMAL_CORE_VALUE_TYPES = [
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
    "colorX",
    "object"
  ];

  const NORMAL_DICTIONARY_KEY_TYPES = [
    "string",
    "Uri",
    "bool",
    "int",
    "float",
    "double"
  ];

  const NORMAL_CONVERTIBLE_TYPES = [
    "bool",
    "string",
    "Uri",
    "int",
    "float",
    "double"
  ];

  function normalSelectedType(
    node,
    key = "valueType",
    fallback = "string",
    allowed = NORMAL_CORE_VALUE_TYPES
  ) {
    const candidate = String(
      node?.parameters?.[key] || fallback
    ).trim();
    return allowed.includes(candidate)
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
    registerType(id, {
      label:
        `Dictionary<${keyInformation.label || keyType}, ${valueInformation.label || valueType}>`,
      short: "MAP",
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
      constraints: ["reference", "serializable"]
    });
    return id;
  }

  for (const type of NORMAL_CORE_VALUE_TYPES) {
    ensureNormalListType(type);
  }
  for (const keyType of NORMAL_DICTIONARY_KEY_TYPES) {
    for (const valueType of NORMAL_CORE_VALUE_TYPES) {
      ensureNormalDictionaryType(
        keyType,
        valueType
      );
    }
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

  function refreshNormalGraphTypeIndex() {
    for (const [graphType, information] of Object.entries(
      registry.getTypeDefinitions()
    )) {
      const csType = normalizedCatalogTypeName(
        information?.csType || ""
      );
      if (csType && !normalGraphTypeByCs.has(csType)) {
        normalGraphTypeByCs.set(csType, graphType);
      }
    }
  }

  refreshNormalGraphTypeIndex();

  function ensureNormalExactGraphType(csType) {
    const normalized = normalizedCatalogTypeName(csType)
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
      short: "CALL",
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
      title: "Create Typed Callback",
      group: "Flow",
      symbol: "CALL<T>",
      description:
        "Creates a strongly typed Action, Func, Predicate or Comparison required by a scanner API node. Closed signatures come directly from the active scanner catalog.",
      parameters: [
        pSelect(
          "delegateType",
          "Callback signature",
          NORMAL_CATALOG_DELEGATES.map(
            signature => signature.csType
          ),
          defaultDelegate
        )
      ],
      inputs: [],
      outputs: [
        port("body", "Body", "impulse"),
        port(
          "callback",
          "Callback",
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
                  "Return Value",
                  ensureNormalExactGraphType(
                    selected.returnCsType
                  )
                )
              ]
            : [],
          outputs: [
            port("body", "Body", "impulse"),
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
              "Callback",
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

  function ensureNormalConversionRuntime(api) {
    api.addUsing("System.Globalization");
    api.addMember(
      "normal-core.conversion.helpers",
      String.raw`
private static bool NormalTryConvert<T>(object? value, out T result)
{
    try
    {
        if (value is T typed)
        {
            result = typed;
            return true;
        }

        Type target = Nullable.GetUnderlyingType(typeof(T)) ?? typeof(T);

        if (value is null)
        {
            result = default!;
            return !target.IsValueType || Nullable.GetUnderlyingType(typeof(T)) is not null;
        }

        if (target == typeof(string))
        {
            result = (T)(object)(Convert.ToString(value, CultureInfo.InvariantCulture) ?? string.Empty);
            return true;
        }

        if (target == typeof(Uri))
        {
            bool valid = Uri.TryCreate(
                Convert.ToString(value, CultureInfo.InvariantCulture),
                UriKind.RelativeOrAbsolute,
                out Uri? uri);
            result = valid ? (T)(object)uri! : default!;
            return valid;
        }

        if (target.IsEnum)
        {
            object convertedEnum = value is string text
                ? Enum.Parse(target, text, ignoreCase: true)
                : Enum.ToObject(target, value);
            result = (T)convertedEnum;
            return true;
        }

        if (target == typeof(bool) && value is string booleanText)
        {
            bool valid = bool.TryParse(booleanText, out bool booleanValue);
            result = valid ? (T)(object)booleanValue : default!;
            return valid;
        }

        if (value is string numericText)
        {
            if (target == typeof(int))
            {
                bool valid = int.TryParse(numericText, NumberStyles.Integer, CultureInfo.InvariantCulture, out int parsed);
                result = valid ? (T)(object)parsed : default!;
                return valid;
            }
            if (target == typeof(float))
            {
                bool valid = float.TryParse(numericText, NumberStyles.Float, CultureInfo.InvariantCulture, out float parsed);
                result = valid ? (T)(object)parsed : default!;
                return valid;
            }
            if (target == typeof(double))
            {
                bool valid = double.TryParse(numericText, NumberStyles.Float, CultureInfo.InvariantCulture, out double parsed);
                result = valid ? (T)(object)parsed : default!;
                return valid;
            }
        }

        object? converted = Convert.ChangeType(
            value,
            target,
            CultureInfo.InvariantCulture);
        result = converted is null
            ? default!
            : (T)converted;
        return converted is not null || !target.IsValueType;
    }
    catch
    {
        result = default!;
        return false;
    }
}

private static bool NormalTryCast<T>(object? value, out T result)
{
    if (value is T typed)
    {
        result = typed;
        return true;
    }

    result = default!;
    return false;
}

private static T NormalCastOrDefault<T>(object? value)
{
    return NormalTryCast<T>(value, out T result)
        ? result
        : default!;
}

private static T NormalConvertOrDefault<T>(object? value)
{
    return NormalTryConvert<T>(value, out T result)
        ? result
        : default!;
}

private static string NormalConversionError<T>(object? value)
{
    return NormalTryConvert<T>(value, out _)
        ? string.Empty
        : "Cannot convert '" +
          (Convert.ToString(value, CultureInfo.InvariantCulture) ?? "null") +
          "' to " + typeof(T).Name + ".";
}
`
    );
  }

  registerNode("normal.isNull", {
    title: "Is Null",
    group: "Logic",
    symbol: "∅?",
    description:
      "True when the connected reference is null. No C# type name is required.",
    inputs: [
      genericPort("value", "Value", "T", "anyValue")
    ],
    outputs: [port("result", "Is Null", "bool")],
    codegenExpression(api) {
      return `(${api.input("value").code} is null)`;
    }
  });

  registerNode("normal.isNotNull", {
    title: "Is Not Null",
    group: "Logic",
    symbol: "∅!",
    description:
      "True when the connected reference contains a value.",
    inputs: [
      genericPort("value", "Value", "T", "anyValue")
    ],
    outputs: [port("result", "Has Value", "bool")],
    codegenExpression(api) {
      return `(${api.input("value").code} is not null)`;
    }
  });

  registerNode("normal.fallbackIfNull", {
    title: "Fallback If Null",
    group: "Logic",
    symbol: "??",
    description:
      "Returns Value unless it is null; otherwise returns Fallback. Both inputs must use the same reference type.",
    inputs: [
      genericPort("value", "Value", "T", "reference"),
      genericPort("fallback", "Fallback", "T", "reference")
    ],
    outputs: [
      genericPort("result", "Result", "T", "reference")
    ],
    codegenExpression(api) {
      return `(${api.input("value").code} ?? ${api.input("fallback").code})`;
    }
  });

  registerNode("normal.tryCast", {
    title: "Try Cast",
    group: "Conversions",
    symbol: "AS?",
    description:
      "Safely checks whether an object already has the selected runtime type. It does not parse or numerically convert; failure returns the selected type's default value.",
    parameters: [
      pSelect(
        "outputType",
        "Output type",
        NORMAL_CORE_VALUE_TYPES,
        "string"
      )
    ],
    inputs: [port("value", "Value", "object")],
    outputs: [
      port("result", "Result", "string"),
      port("success", "Success", "bool")
    ],
    resolveDefinition(node) {
      const type = normalSelectedType(
        node,
        "outputType",
        "string"
      );
      return {
        outputs: [
          port("result", "Result", type),
          port("success", "Success", "bool")
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
      group: "Conversions",
      symbol,
      description:
        "Parses invariant text without throwing. Result is default when Success is false.",
      parameters: [
        pSelect(
          "outputType",
          "Output type",
          types,
          fallback
        )
      ],
      inputs: [port("text", "Text", "string")],
      outputs: [
        port("result", "Result", fallback),
        port("success", "Success", "bool"),
        port("error", "Error", "string")
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
            port("result", "Result", type),
            port("success", "Success", "bool"),
            port("error", "Error", "string")
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
          fallback,
          types
        );
        const value = api.input("text").code;
        return api.portId === "success"
          ? `NormalTryConvert<${csType}>(${value}, out _)`
          : api.portId === "error"
            ? `NormalConversionError<${csType}>(${value})`
          : `NormalConvertOrDefault<${csType}>(${value})`;
      }
    });
  }

  registerNormalTryParse(
    "normal.tryParseNumber",
    "Try Parse Number",
    "#?",
    ["int", "float", "double"],
    "int"
  );
  registerNormalTryParse(
    "normal.tryParseBoolean",
    "Try Parse Boolean",
    "B?",
    ["bool"],
    "bool"
  );

  registerNode("normal.tryConvertValue", {
    title: "Try Convert Value",
    group: "Conversions",
    symbol: "→?",
    description:
      "Converts a normal graph value to a selected type without throwing and reports Success.",
    parameters: [
      pSelect(
        "outputType",
        "Output type",
        NORMAL_CONVERTIBLE_TYPES,
        "string"
      )
    ],
    inputs: [port("value", "Value", "object")],
    outputs: [
      port("result", "Result", "string"),
      port("success", "Success", "bool"),
      port("error", "Error", "string")
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
          port("result", "Result", type),
          port("success", "Success", "bool"),
          port("error", "Error", "string")
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
    title: "Math Operation",
    group: "Math",
    symbol: "±×",
    description: "One typed arithmetic node. Operation selects Add, Subtract, Multiply, Divide, Modulo, Power, Minimum or Maximum.",
    parameters: [
      pSelect("operation", "Operation", [["add", "Add"], ["subtract", "Subtract"], ["multiply", "Multiply"], ["divide", "Divide"], ["modulo", "Modulo"], ["power", "Power"], ["minimum", "Minimum"], ["maximum", "Maximum"]], "add", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })
    ],
    inputs: [
      genericPort("a", "A", "T", "arithmetic"),
      genericPort("b", "B", "T", "arithmetic")
    ],
    outputs: [genericPort("result", "Result", "T", "arithmetic")],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserveAB: true,
      template: genericPort("a", "A", "T", "arithmetic")
    },
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "add");
      const information = {
        add: ["Add", "+", "arithmetic", true],
        subtract: ["Subtract", "−", "arithmetic", false],
        multiply: ["Multiply", "×", "arithmetic", true],
        divide: ["Divide", "÷", "arithmetic", false],
        modulo: ["Modulo", "%", "scalar", false],
        power: ["Power", "xʸ", "double", false],
        minimum: ["Minimum", "min", "scalar", true],
        maximum: ["Maximum", "max", "scalar", true]
      }[operation] || ["Add", "+", "arithmetic", true];
      const constraint = information[2];
      const inputs = constraint === "double"
        ? [port("a", "Value", "double"), port("b", "Exponent", "double")]
        : [genericPort("a", "A", "T", constraint), genericPort("b", "B", "T", constraint)];
      const outputs = constraint === "double"
        ? [port("result", "Result", "double")]
        : [genericPort("result", "Result", "T", constraint)];
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
      return runtimeFamilyReduce(api, { add: "GraphAdd", multiply: "GraphMultiply", minimum: "GraphMinimum", maximum: "GraphMaximum" }[operation] || "GraphAdd");
    },
    previewEvaluate({ node, definition, type, input, known, unknown }) {
      const operation = String(node.parameters?.operation || "add");
      const ids = runtimeFamilyVariadicIds(definition);
      const values = ids.map(id => input(id));
      if (values.some(value => !value.known)) return unknown(type, values.find(value => !value.known)?.reason || "Unknown input");
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
    title: "Unary Math",
    group: "Math",
    symbol: "ƒx",
    parameters: [pSelect("operation", "Operation", [["negate", "Negate"], ["absolute", "Absolute"], ["squareRoot", "Square Root"], ["round", "Round"], ["floor", "Floor"], ["ceiling", "Ceiling"]], "negate", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })],
    inputs: [genericPort("value", "Value", "T", "arithmetic")],
    outputs: [genericPort("result", "Result", "T", "arithmetic")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "negate");
      const information = {
        negate: ["Negate", "±", "arithmetic"], absolute: ["Absolute", "|x|", "scalar"],
        squareRoot: ["Square Root", "√", "double"], round: ["Round", "≈", "double"],
        floor: ["Floor", "⌊x⌋", "double"], ceiling: ["Ceiling", "⌈x⌉", "double"]
      }[operation] || ["Negate", "±", "arithmetic"];
      return information[2] === "double"
        ? { title: `Unary Math · ${information[0]}`, symbol: information[1], inputs: [port("value", "Value", "double")], outputs: [port("result", "Result", "double")] }
        : { title: `Unary Math · ${information[0]}`, symbol: information[1], inputs: [genericPort("value", "Value", "T", information[2])], outputs: [genericPort("result", "Result", "T", information[2])] };
    },
    codegenExpression(api) {
      const operation = String(api.node.parameters?.operation || "negate");
      const value = api.input("value").code;
      if (["squareRoot", "round", "floor", "ceiling"].includes(operation)) {
        return `Math.${{ squareRoot: "Sqrt", round: "Round", floor: "Floor", ceiling: "Ceiling" }[operation]}(${value})`;
      }
      const type = api.csType(api.resolvedType(api.node, api.definition.outputs[0]) || "float");
      return `${operation === "absolute" ? "GraphAbsolute" : "GraphNegate"}<${type}>(${value})`;
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
    title: "Compare",
    group: "Logic",
    symbol: "≶",
    parameters: [pSelect("operation", "Comparison", [["equal", "Equal"], ["notEqual", "Not Equal"], ["greater", "Greater"], ["greaterOrEqual", "Greater or Equal"], ["less", "Less"], ["lessOrEqual", "Less or Equal"]], "equal", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })],
    inputs: [genericPort("a", "A", "T", "value"), genericPort("b", "B", "T", "value")],
    outputs: [port("result", "Result", "bool")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "equal");
      const ordered = !["equal", "notEqual"].includes(operation);
      const info = { equal: ["Equal", "="], notEqual: ["Not Equal", "≠"], greater: ["Greater", ">"], greaterOrEqual: ["Greater or Equal", "≥"], less: ["Less", "<"], lessOrEqual: ["Less or Equal", "≤"] }[operation] || ["Equal", "="];
      return { title: `Compare · ${info[0]}`, symbol: info[1], inputs: [genericPort("a", "A", "T", ordered ? "ordered" : "value"), genericPort("b", "B", "T", ordered ? "ordered" : "value")] };
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
    title: "Boolean Operation",
    group: "Logic",
    symbol: "⊕",
    parameters: [pSelect("operation", "Operation", [["and", "AND"], ["or", "OR"], ["xor", "XOR"], ["not", "NOT"]], "and", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })],
    inputs: [port("a", "A", "bool"), port("b", "B", "bool")],
    outputs: [port("result", "Result", "bool")],
    variadicInputs: { minimum: 2, defaultCount: 2, maximum: 64, preserveAB: true, template: port("a", "A", "bool") },
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "and");
      const info = { and: ["AND", "∧"], or: ["OR", "∨"], xor: ["XOR", "⊕"], not: ["NOT", "¬"] }[operation] || ["AND", "∧"];
      return operation === "not"
        ? { title: `Boolean · ${info[0]}`, symbol: info[1], inputs: [port("value", "Value", "bool")], variadicInputs: null }
        : { title: `Boolean · ${info[0]}`, symbol: info[1], inputs: [port("a", "A", "bool"), port("b", "B", "bool")], variadicInputs: { minimum: 2, defaultCount: 2, maximum: 64, preserveAB: true, template: port("a", "A", "bool") } };
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
    title: "Text Concat",
    group: "Text",
    symbol: "TXT+",
    description:
      "Joins two or more text inputs without a separator.",
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
    outputs: [port("text", "Text", "string")],
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
    title: "Format Text",
    group: "Text",
    symbol: "{0}",
    description:
      "Formats values with invariant culture using placeholders such as {0} and {1}.",
    inputs: [
      port("format", "Format", "string"),
      port("a", "Value A", "object"),
      port("b", "Value B", "object")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 32,
      preserved: 1,
      template: port("a", "Value A", "object")
    },
    outputs: [port("text", "Text", "string")],
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
    title: "Text Length",
    group: "Text",
    symbol: "LEN",
    inputs: [port("text", "Text", "string")],
    outputs: [port("length", "Length", "int")],
    codegenExpression(api) {
      return `(${api.input("text").code} ?? string.Empty).Length`;
    }
  });

  function normalStringComparison(api) {
    const comparison = String(
      api.node.parameters?.comparison || "ordinal"
    );
    return comparison === "ordinalIgnoreCase"
      ? "StringComparison.OrdinalIgnoreCase"
      : "StringComparison.Ordinal";
  }

  registerNode("text.matchOperation", {
    title: "Text Match",
    group: "Text",
    symbol: "TXT?",
    parameters: [
      pSelect("operation", "Operation", [["contains", "Contains"], ["startsWith", "Starts With"], ["endsWith", "Ends With"]], "contains", "", { affectsPorts: true, affectsNode: true, commitImmediately: true }),
      pSelect("comparison", "Comparison", ["ordinal", "ordinalIgnoreCase"], "ordinal")
    ],
    inputs: [port("text", "Text", "string"), port("value", "Search", "string")],
    outputs: [port("result", "Result", "bool")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "contains");
      const info = { contains: ["Contains", "⊃"], startsWith: ["Starts With", "A…"], endsWith: ["Ends With", "…Z"] }[operation] || ["Contains", "⊃"];
      return { title: `Text Match · ${info[0]}`, symbol: info[1] };
    },
    codegenExpression(api) {
      const method = { contains: "Contains", startsWith: "StartsWith", endsWith: "EndsWith" }[api.node.parameters?.operation] || "Contains";
      return `(${api.input("text").code} ?? string.Empty).${method}(${api.input("value").code} ?? string.Empty, ${normalStringComparison(api)})`;
    }
  });

  registerNode("text.transformOperation", {
    title: "Text Transform",
    group: "Text",
    symbol: "TXT→",
    parameters: [
      pSelect("operation", "Operation", [["replace", "Replace"], ["trim", "Trim"], ["trimStart", "Trim Start"], ["trimEnd", "Trim End"], ["upper", "Upper Case"], ["lower", "Lower Case"]], "replace", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })
    ],
    inputs: [port("text", "Text", "string"), port("old", "Find", "string"), port("replacement", "Replacement", "string")],
    outputs: [port("text", "Result", "string")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "replace");
      const info = { replace: ["Replace", "A→B"], trim: ["Trim", "TRIM"], trimStart: ["Trim Start", "▷"], trimEnd: ["Trim End", "◁"], upper: ["Upper Case", "AA"], lower: ["Lower Case", "aa"] }[operation] || ["Replace", "A→B"];
      return {
        title: `Text Transform · ${info[0]}`,
        symbol: info[1],
        inputs: operation === "replace"
          ? [port("text", "Text", "string"), port("old", "Find", "string"), port("replacement", "Replacement", "string")]
          : [port("text", "Text", "string")]
      };
    },
    codegenExpression(api) {
      const operation = String(api.node.parameters?.operation || "replace");
      const text = `(${api.input("text").code} ?? string.Empty)`;
      if (operation === "replace") return `${text}.Replace(${api.input("old").code} ?? string.Empty, ${api.input("replacement").code} ?? string.Empty, StringComparison.Ordinal)`;
      return `${text}.${{ trim: "Trim", trimStart: "TrimStart", trimEnd: "TrimEnd", upper: "ToUpperInvariant", lower: "ToLowerInvariant" }[operation] || "Trim"}()`;
    }
  });

  for (const [id, title, symbol, method] of [
    ["text.contains", "Text Contains", "⊃", "Contains"],
    ["text.startsWith", "Text Starts With", "A…", "StartsWith"],
    ["text.endsWith", "Text Ends With", "…Z", "EndsWith"]
  ]) {
    registerNode(id, {
      title,
      group: "Text",
      symbol,
      hiddenFromPalette: true,
      parameters: [
        pSelect(
          "comparison",
          "Comparison",
          ["ordinal", "ordinalIgnoreCase"],
          "ordinal"
        )
      ],
      inputs: [
        port("text", "Text", "string"),
        port("value", "Search", "string")
      ],
      outputs: [port("result", "Result", "bool")],
      codegenExpression(api) {
        return `(${api.input("text").code} ?? string.Empty).${method}(${api.input("value").code} ?? string.Empty, ${normalStringComparison(api)})`;
      }
    });
  }

  registerNode("text.replace", {
    title: "Replace Text",
    group: "Text",
    symbol: "A→B",
    hiddenFromPalette: true,
    inputs: [
      port("text", "Text", "string"),
      port("old", "Find", "string"),
      port("replacement", "Replacement", "string")
    ],
    outputs: [port("text", "Result", "string")],
    codegenExpression(api) {
      return `(${api.input("text").code} ?? string.Empty).Replace(${api.input("old").code} ?? string.Empty, ${api.input("replacement").code} ?? string.Empty, StringComparison.Ordinal)`;
    }
  });

  registerNode("text.split", {
    title: "Split Text",
    group: "Text",
    symbol: "TXT÷",
    parameters: [
      pBool("removeEmpty", "Remove empty entries", true),
      pBool("trimEntries", "Trim entries", true)
    ],
    inputs: [
      port("text", "Text", "string"),
      port("separator", "Separator", "string")
    ],
    outputs: [port("parts", "Parts", "stringArray")],
    codegenExpression(api) {
      const options = [
        api.node.parameters?.removeEmpty === true
          ? "StringSplitOptions.RemoveEmptyEntries"
          : "StringSplitOptions.None",
        api.node.parameters?.trimEntries === true
          ? "StringSplitOptions.TrimEntries"
          : "StringSplitOptions.None"
      ].join(" | ");
      return `(${api.input("text").code} ?? string.Empty).Split(new[] { ${api.input("separator").code} ?? string.Empty }, ${options})`;
    }
  });

  registerNode("text.join", {
    title: "Join Text",
    group: "Text",
    symbol: "TXT⋈",
    inputs: [
      port("parts", "Parts", "stringArray"),
      port("separator", "Separator", "string")
    ],
    outputs: [port("text", "Text", "string")],
    codegenExpression(api) {
      return `string.Join(${api.input("separator").code} ?? string.Empty, ${api.input("parts").code} ?? Array.Empty<string>())`;
    }
  });

  registerNode("text.trim", {
    title: "Trim Text",
    group: "Text",
    symbol: "TRIM",
    hiddenFromPalette: true,
    parameters: [
      pSelect(
        "mode",
        "Mode",
        ["both", "start", "end"],
        "both"
      )
    ],
    inputs: [port("text", "Text", "string")],
    outputs: [port("text", "Text", "string")],
    codegenExpression(api) {
      const method = {
        start: "TrimStart",
        end: "TrimEnd"
      }[api.node.parameters?.mode] || "Trim";
      return `(${api.input("text").code} ?? string.Empty).${method}()`;
    }
  });

  registerNode("text.changeCase", {
    title: "Text Upper / Lower Case",
    group: "Text",
    symbol: "Aa",
    hiddenFromPalette: true,
    parameters: [
      pSelect(
        "mode",
        "Mode",
        ["upper", "lower"],
        "upper"
      )
    ],
    inputs: [port("text", "Text", "string")],
    outputs: [port("text", "Text", "string")],
    codegenExpression(api) {
      const method = api.node.parameters?.mode === "lower"
        ? "ToLowerInvariant"
        : "ToUpperInvariant";
      return `(${api.input("text").code} ?? string.Empty).${method}()`;
    }
  });

  registerNode("flow.switch", {
    title: "Switch / Multi Branch",
    group: "Flow",
    symbol: "SW",
    description:
      "Routes Call to the first equal case or Default. Change Case count in the inspector.",
    parameters: [
      pNumber("caseCount", "Case count", 3)
    ],
    inputs: [
      port("call", "Call", "impulse"),
      genericPort("value", "Value", "T", "value"),
      genericPort("case1", "Case 1", "T", "value"),
      genericPort("case2", "Case 2", "T", "value")
    ],
    outputs: [
      port("case1", "Case 1", "impulse"),
      port("case2", "Case 2", "impulse"),
      port("default", "Default", "impulse")
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
          port("call", "Call", "impulse"),
          genericPort("value", "Value", "T", "value"),
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
          port("default", "Default", "impulse")
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
    title: "Modulo",
    group: "Math",
    symbol: "%",
    hiddenFromPalette: true,
    inputs: [
      genericPort("a", "A", "T", "scalar"),
      genericPort("b", "B", "T", "scalar")
    ],
    outputs: [
      genericPort("result", "Result", "T", "scalar")
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
    inputs = [port("value", "Value", "double")],
    hiddenFromPalette = true
  ) {
    registerNode(id, {
      title,
      group: "Math",
      symbol,
      hiddenFromPalette,
      inputs,
      outputs: [port("result", "Result", "double")],
      codegenExpression: renderer
    });
  }

  registerDoubleMathNode(
    "math.power",
    "Power",
    "xʸ",
    api => `Math.Pow(${api.input("value").code}, ${api.input("exponent").code})`,
    [
      port("value", "Value", "double"),
      port("exponent", "Exponent", "double")
    ]
  );
  registerDoubleMathNode(
    "math.squareRoot",
    "Square Root",
    "√",
    api => `Math.Sqrt(${api.input("value").code})`
  );
  registerDoubleMathNode(
    "math.round",
    "Round",
    "≈",
    api => `Math.Round(${api.input("value").code})`
  );
  registerDoubleMathNode(
    "math.floor",
    "Floor",
    "⌊x⌋",
    api => `Math.Floor(${api.input("value").code})`
  );
  registerDoubleMathNode(
    "math.ceiling",
    "Ceiling",
    "⌈x⌉",
    api => `Math.Ceiling(${api.input("value").code})`
  );
  registerDoubleMathNode(
    "math.distance",
    "Scalar Distance",
    "↔#",
    api => `Math.Abs(${api.input("a").code} - ${api.input("b").code})`,
    [
      port("a", "A", "double"),
      port("b", "B", "double")
    ],
    false
  );
  registerDoubleMathNode(
    "math.remapRange",
    "Remap Range",
    "MAP",
    api => `(${api.input("outputMin").code} + ((${api.input("value").code} - ${api.input("inputMin").code}) / (${api.input("inputMax").code} - ${api.input("inputMin").code})) * (${api.input("outputMax").code} - ${api.input("outputMin").code}))`,
    [
      port("value", "Value", "double"),
      port("inputMin", "Input Minimum", "double"),
      port("inputMax", "Input Maximum", "double"),
      port("outputMin", "Output Minimum", "double"),
      port("outputMax", "Output Maximum", "double")
    ],
    false
  );

  registerNode("math.randomRange", {
    title: "Random Range",
    group: "Math",
    symbol: "RND",
    parameters: [
      pSelect(
        "valueType",
        "Number type",
        ["int", "float", "double"],
        "int"
      )
    ],
    inputs: [
      port("minimum", "Minimum", "int"),
      port("maximum", "Maximum", "int")
    ],
    outputs: [port("value", "Value", "int")],
    resolveDefinition(node) {
      const type = normalSelectedType(
        node,
        "valueType",
        "int",
        ["int", "float", "double"]
      );
      return {
        inputs: [
          port("minimum", "Minimum", type),
          port("maximum", "Maximum", type)
        ],
        outputs: [port("value", "Value", type)]
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
    title: "Current Time",
    group: "Values",
    symbol: "NOW",
    description:
      "Returns current UTC time as Unix milliseconds and ISO-8601 text.",
    outputs: [
      port("unixMilliseconds", "Unix Milliseconds", "double"),
      port("isoUtc", "ISO UTC", "string")
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
    title: "Stopwatch / Elapsed Time",
    group: "Flow",
    symbol: "⏱",
    inputs: [
      port("start", "Start / Resume", "impulse"),
      port("stop", "Stop", "impulse"),
      port("reset", "Reset", "impulse")
    ],
    outputs: [
      port("changed", "Changed", "impulse"),
      port("elapsedMilliseconds", "Elapsed ms", "double"),
      port("running", "Running", "bool")
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
    allowed = NORMAL_CORE_VALUE_TYPES
  ) {
    return [
      pSelect(
        "itemType",
        "Item type",
        allowed,
        fallback
      )
    ];
  }

  function normalListNodeType(
    node,
    allowed = NORMAL_CORE_VALUE_TYPES,
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
      options.allowed || NORMAL_CORE_VALUE_TYPES,
      options.fallback || "string"
    );
    return {
      inputs: [
        ...(options.action === true
          ? [port("call", "Call", "impulse")]
          : []),
        port("list", "List", information.listType),
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
          ? [port("done", "Done", "impulse")]
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

  registerNode("collection.createList", {
    title: "Create List",
    group: "Collections",
    symbol: "NEW[]",
    description:
      "Creates and owns one strongly typed list. Reset empties the existing list without changing its identity.",
    parameters: normalListNodeParameters(),
    inputs: [port("reset", "Reset", "impulse")],
    outputs: [
      port("resetDone", "Reset Done", "impulse"),
      port("list", "List", normalListType("string")),
      port("count", "Count", "int")
    ],
    resolveDefinition(node) {
      const { listType } = normalListNodeType(node);
      return {
        inputs: [port("reset", "Reset", "impulse")],
        outputs: [
          port("resetDone", "Reset Done", "impulse"),
          port("list", "List", listType),
          port("count", "Count", "int")
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
      group: "Collections",
      symbol,
      description: options.description || "Mutates a strongly typed list and reports the resulting count.",
      parameters: normalListNodeParameters(
        options.fallback || "string",
        options.allowed || NORMAL_CORE_VALUE_TYPES
      ).concat(options.parameters || []),
      inputs: [
        port("call", "Call", "impulse"),
        port("list", "List", normalListType(options.fallback || "string")),
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
        port("done", "Done", "impulse"),
        port("list", "List", normalListType(options.fallback || "string")),
        port("success", "Success", "bool"),
        port("count", "Count", "int")
      ],
      resolveDefinition(node) {
        return normalListResolvedDefinition(
          node,
          extraInputs,
          [
            { id: "list", label: "List", type: "$list" },
            port("success", "Success", "bool"),
            port("count", "Count", "int")
          ],
          {
            action: true,
            fallback: options.fallback || "string",
            allowed: options.allowed || NORMAL_CORE_VALUE_TYPES
          }
        );
      },
      codegenCollect(api) {
        const field =
          `_${id.replace(/[^A-Za-z0-9]/g, "")}Success${nodeToken(api)}`;
        api.addField(
          `${api.node.id}.${id}.success`,
          `private static bool ${field} { get; set; }`
        );
      },
      codegenExpression(api) {
        const token = nodeToken(api);
        const list = api.input("list").code;
        if (api.portId === "success") {
          return `_${id.replace(/[^A-Za-z0-9]/g, "")}Success${token}`;
        }
        if (api.portId === "count") {
          return `${list}.Count`;
        }
        return list;
      },
      codegenAction(api) {
        const token = nodeToken(api);
        const success = `_${id.replace(/[^A-Za-z0-9]/g, "")}Success${token}`;
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
    "Add List Item",
    "+[]",
    [{ id: "value", label: "Value", type: "$item" }],
    (api, list, success) =>
      `lock (${list}) { ${list}.Add(${api.input("value").code}); ${success} = true; }`
  );
  registerNormalListMutation(
    "collection.insertItem",
    "Insert List Item",
    "INS",
    [
      port("index", "Index", "int"),
      { id: "value", label: "Value", type: "$item" }
    ],
    (api, list, success) => {
      const index = api.input("index").code;
      return `lock (${list}) { ${success} = ${index} >= 0 && ${index} <= ${list}.Count; if (${success}) { ${list}.Insert(${index}, ${api.input("value").code}); } }`;
    }
  );
  registerNormalListMutation(
    "collection.removeItem",
    "Remove List Item",
    "−[]",
    [{ id: "value", label: "Value", type: "$item" }],
    (api, list, success) =>
      `lock (${list}) { ${success} = ${list}.Remove(${api.input("value").code}); }`
  );
  registerNormalListMutation(
    "collection.removeAt",
    "Remove List Item At Index",
    "−[i]",
    [port("index", "Index", "int")],
    (api, list, success) => {
      const index = api.input("index").code;
      return `lock (${list}) { ${success} = ${index} >= 0 && ${index} < ${list}.Count; if (${success}) { ${list}.RemoveAt(${index}); } }`;
    }
  );
  registerNormalListMutation(
    "collection.clearList",
    "Clear List",
    "CLR[]",
    [],
    (_api, list, success) =>
      `lock (${list}) { ${list}.Clear(); ${success} = true; }`
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
      group: "Collections",
      symbol,
      parameters: normalListNodeParameters(
        options.fallback || "string",
        options.allowed || NORMAL_CORE_VALUE_TYPES
      ),
      inputs: [
        port("list", "List", normalListType(options.fallback || "string")),
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
            allowed: options.allowed || NORMAL_CORE_VALUE_TYPES
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
    "List Contains",
    "[]?",
    [{ id: "value", label: "Value", type: "$item" }],
    [port("result", "Contains", "bool")],
    api => `${api.input("list").code}.Contains(${api.input("value").code})`
  );
  registerNormalListQuery(
    "collection.indexOf",
    "List Index Of",
    "i?",
    [{ id: "value", label: "Value", type: "$item" }],
    [port("index", "Index", "int")],
    api => `${api.input("list").code}.IndexOf(${api.input("value").code})`
  );
  registerNormalListQuery(
    "collection.listCount",
    "List Count",
    "#[]",
    [],
    [port("count", "Count", "int")],
    api => `${api.input("list").code}.Count`
  );
  registerNormalListQuery(
    "collection.findItem",
    "Find List Item",
    "FIND",
    [{ id: "value", label: "Search Value", type: "$item" }],
    [
      { id: "item", label: "Item", type: "$item" },
      port("index", "Index", "int"),
      port("success", "Success", "bool")
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
    "Filter List By Value",
    "FILTER",
    [{ id: "value", label: "Value", type: "$item" }],
    [{ id: "list", label: "Filtered List", type: "$list" }],
    api => {
      const type = normalSelectedType(
        api.node,
        "itemType",
        "string"
      );
      const csType = api.csType(type);
      return `${api.input("list").code}.Where(item => EqualityComparer<${csType}>.Default.Equals(item, ${api.input("value").code})).ToList()`;
    },
    { linq: true }
  );
  registerNormalListQuery(
    "collection.sortList",
    "Sort List",
    "SORT",
    [],
    [{ id: "list", label: "Sorted List", type: "$list" }],
    api => api.node.parameters?.descending === true
      ? `${api.input("list").code}.OrderByDescending(item => item).ToList()`
      : `${api.input("list").code}.OrderBy(item => item).ToList()`,
    {
      linq: true,
      allowed: ["string", "int", "float", "double"],
      fallback: "string",
      parameters: [
        pBool("descending", "Descending", false)
      ]
    }
  );

  function normalDictionarySelection(node) {
    const keyType = normalSelectedType(
      node,
      "keyType",
      "string",
      NORMAL_DICTIONARY_KEY_TYPES
    );
    const valueType = normalSelectedType(
      node,
      "dictionaryValueType",
      "string"
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
        "Key type",
        NORMAL_DICTIONARY_KEY_TYPES,
        "string"
      ),
      pSelect(
        "dictionaryValueType",
        "Value type",
        NORMAL_CORE_VALUE_TYPES,
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
          ? [port("call", "Call", "impulse")]
          : []),
        ...(options.includeDictionary === false
          ? []
          : [port("dictionary", "Dictionary", selected.dictionaryType)]),
        ...(options.key === true
          ? [port("key", "Key", selected.keyType)]
          : []),
        ...(options.value === true
          ? [port("value", "Value", selected.valueType)]
          : [])
      ],
      outputs: [
        ...(options.action === true
          ? [port("done", "Done", "impulse")]
          : []),
        ...(options.dictionaryOutput === true
          ? [port("dictionary", "Dictionary", selected.dictionaryType)]
          : []),
        ...(options.valueOutput === true
          ? [port("value", "Value", selected.valueType)]
          : []),
        ...(options.keysOutput === true
          ? [port("keys", "Keys", selected.keyListType)]
          : []),
        ...(options.valuesOutput === true
          ? [port("values", "Values", selected.valueListType)]
          : []),
        ...(options.success === true
          ? [port("success", "Success", "bool")]
          : []),
        ...(options.count === true
          ? [port("count", "Count", "int")]
          : [])
      ]
    };
  }

  registerNode("dictionary.create", {
    title: "Create Dictionary",
    group: "Dictionaries",
    symbol: "NEW{}",
    parameters: normalDictionaryParameters(),
    inputs: [port("reset", "Reset", "impulse")],
    outputs: [
      port("resetDone", "Reset Done", "impulse"),
      port("dictionary", "Dictionary", normalDictionaryType("string", "string")),
      port("count", "Count", "int")
    ],
    resolveDefinition(node) {
      const selected = normalDictionarySelection(node);
      return {
        inputs: [port("reset", "Reset", "impulse")],
        outputs: [
          port("resetDone", "Reset Done", "impulse"),
          port("dictionary", "Dictionary", selected.dictionaryType),
          port("count", "Count", "int")
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
      group: "Dictionaries",
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
        if (options.statefulSuccess === true) {
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
          return `_${id.replace(/[^A-Za-z0-9]/g, "")}Success${nodeToken(api)}`;
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
    "Set Dictionary Value",
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
      const success = `_dictionarysetValueSuccess${nodeToken(api)}`;
      const dictionary = api.input("dictionary").code;
      return `try { lock (${dictionary}) { ${dictionary}[${api.input("key").code}] = ${api.input("value").code}; } ${success} = true; } catch { ${success} = false; }`;
    }
  );
  registerNormalDictionaryNode(
    "dictionary.tryGetValue",
    "Try Get Dictionary Value",
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
    "Remove Dictionary Key",
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
      const success = `_dictionaryremoveKeySuccess${nodeToken(api)}`;
      const dictionary = api.input("dictionary").code;
      return `lock (${dictionary}) { ${success} = ${dictionary}.Remove(${api.input("key").code}); }`;
    }
  );
  registerNormalDictionaryNode(
    "dictionary.containsKey",
    "Dictionary Contains Key",
    "K?",
    { key: true, success: true },
    api => `${api.input("dictionary").code}.ContainsKey(${api.input("key").code})`
  );
  registerNormalDictionaryNode(
    "dictionary.keysValues",
    "Dictionary Keys / Values",
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
      group: "Files & JSON",
      symbol,
      description:
        `${title} with optional overwrite and explicit success/exception outputs.`,
      parameters: [
        pBool("overwrite", "Overwrite destination", false)
      ],
      inputs: [
        port("call", "Call", "impulse"),
        port("source", "Source", "string"),
        port("destination", "Destination", "string")
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      ],
      codegenCollect(api) {
        api.addUsing("System.IO");
        addStatefulField(
          api,
          `${id.replace(/[^A-Za-z0-9]/g, "")}Success`,
          "bool",
          "false"
        );
        addStatefulField(
          api,
          `${id.replace(/[^A-Za-z0-9]/g, "")}Exception`,
          "Exception",
          "null!"
        );
      },
      codegenExpression(api) {
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        return api.portId === "exception"
          ? `_${stem}Exception${nodeToken(api)}`
          : `_${stem}Success${nodeToken(api)}`;
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
        return `try\n        {\n            ${exception} = null!;\n            ${method}(${api.input("source").code}, ${api.input("destination").code}, ${overwrite});\n            ${success} = true;\n        }\n        catch (Exception caught)\n        {\n            ${success} = false;\n            ${exception} = caught;\n        }${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerNormalFileTransfer(
    "file.copy",
    "Copy File",
    "COPY",
    "File.Copy"
  );
  registerNormalFileTransfer(
    "file.move",
    "Move File",
    "MOVE",
    "File.Move"
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
      group: "Files & JSON",
      symbol,
      description:
        "Creates and owns a reusable JSON container. Reset clears it without changing the connected object.",
      inputs: [port("reset", "Reset", "impulse")],
      outputs: [
        port("resetDone", "Reset Done", "impulse"),
        port("json", "JSON", "json"),
        port("count", "Count", "int")
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
    "Create JSON Object",
    "NEW{}",
    "JsonObject",
    "normalJsonObject"
  );
  registerNormalJsonContainer(
    "json.createArray",
    "Create JSON Array",
    "NEW[]",
    "JsonArray",
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
      group: "Files & JSON",
      symbol,
      inputs: [
        port("call", "Call", "impulse"),
        port("json", "JSON", "json"),
        ...extraInputs
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("json", "JSON", "json"),
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      ],
      codegenCollect(api) {
        ensureJsonRuntime(api);
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        addStatefulField(
          api,
          `${stem}Success`,
          "bool",
          "false"
        );
        addStatefulField(
          api,
          `${stem}Exception`,
          "Exception",
          "null!"
        );
      },
      codegenExpression(api) {
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        if (api.portId === "success") {
          return `_${stem}Success${nodeToken(api)}`;
        }
        if (api.portId === "exception") {
          return `_${stem}Exception${nodeToken(api)}`;
        }
        return api.input("json").code;
      },
      codegenAction(api) {
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        const token = nodeToken(api);
        const success = `_${stem}Success${token}`;
        const exception = `_${stem}Exception${token}`;
        const done = api.emit("done");
        return `try\n        {\n            ${exception} = null!;\n            ${success} = ${operation(api)};\n        }\n        catch (Exception caught)\n        {\n            ${success} = false;\n            ${exception} = caught;\n        }${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerNormalJsonMutation(
    "json.setProperty",
    "Set JSON Property",
    "{}=",
    [
      port("property", "Property", "string"),
      port("value", "Value", "object")
    ],
    api => `SetGraphJsonProperty(${api.input("json").code}, ${api.input("property").code}, ${api.input("value").code})`
  );
  registerNormalJsonMutation(
    "json.removeProperty",
    "Remove JSON Property",
    "{}−",
    [port("property", "Property", "string")],
    api => `RemoveGraphJsonProperty(${api.input("json").code}, ${api.input("property").code})`
  );
  registerNormalJsonMutation(
    "json.addArrayItem",
    "Add JSON Array Item",
    "+[]",
    [port("value", "Value", "object")],
    api => `AddGraphJsonArrayItem(${api.input("json").code}, ${api.input("value").code})`
  );

  registerNode("task.cancelTask", {
    title: "Cancel Task (Cooperative)",
    group: "Tasks & Threading",
    symbol: "CANCEL",
    description:
      "Creates a CancellationToken and requests cancellation when Cancel is triggered. The receiving operation must support that token; .NET cannot safely force-stop an arbitrary Task.",
    inputs: [
      port("reset", "Create / Reset", "impulse"),
      port("cancel", "Cancel", "impulse")
    ],
    outputs: [
      port("ready", "Ready", "impulse"),
      port("cancelled", "Cancellation Requested", "impulse"),
      port("failed", "Failed", "impulse"),
      port("token", "Cancellation Token", "cancellationToken"),
      port("isCancellationRequested", "Is Cancellation Requested", "bool"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      ensureTaskRuntime(api);
      const token = nodeToken(api);
      api.addField(
        `${api.node.id}.source`,
        `private static CancellationTokenSource _normalCancellation${token} = new();`
      );
      addStatefulField(
        api,
        "normalCancellationException",
        "Exception",
        "null!"
      );
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      if (api.portId === "isCancellationRequested") {
        return `_normalCancellation${token}.IsCancellationRequested`;
      }
      if (api.portId === "exception") {
        return `_normalCancellationException${token}`;
      }
      return `_normalCancellation${token}.Token`;
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const exception = `_normalCancellationException${token}`;
      const failed = api.emit("failed");
      if (api.connection?.toPort === "cancel") {
        const cancelled = api.emit("cancelled");
        return `try\n        {\n            ${exception} = null!;\n            _normalCancellation${token}.Cancel();${cancelled ? `\n            ${cancelled}();` : ""}\n        }\n        catch (Exception caught)\n        {\n            ${exception} = caught;${failed ? `\n            ${failed}();` : ""}\n        }`;
      }
      const ready = api.emit("ready");
      return `try\n        {\n            _normalCancellation${token}.Dispose();\n            _normalCancellation${token} = new CancellationTokenSource();\n            ${exception} = null!;${ready ? `\n            ${ready}();` : ""}\n        }\n        catch (Exception caught)\n        {\n            ${exception} = caught;${failed ? `\n            ${failed}();` : ""}\n        }`;
    }
  });

  registerNode("task.timeout", {
    title: "Task Timeout",
    group: "Tasks & Threading",
    symbol: "TIMEOUT",
    description:
      "Waits for a Task up to the selected duration. A timeout does not forcibly terminate the underlying Task.",
    inputs: [
      port("call", "Start", "impulse"),
      port("task", "Task", "task"),
      port("milliseconds", "Timeout ms", "int")
    ],
    outputs: [
      port("completed", "Completed", "impulse"),
      port("timedOut", "Timed Out", "impulse"),
      port("faulted", "Faulted", "impulse"),
      port("exception", "Exception", "exception")
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
      addStatefulField(
        api,
        "normalTimeoutException",
        "Exception",
        "null!"
      );
      api.addMember(
        `${api.node.id}.timeout`,
        `private static async void WaitWithTimeout${token}(Task task, int milliseconds)\n{\n    try\n    {\n        _normalTimeoutException${token} = null!;\n        Task delay = Task.Delay(Math.Max(0, milliseconds));\n        Task winner = await Task.WhenAny(task, delay).ConfigureAwait(false);\n        if (ReferenceEquals(winner, delay))\n        {${timedOut ? `\n            ${timedOut}();` : ""}\n            return;\n        }\n\n        await task.ConfigureAwait(false);${completed ? `\n        ${completed}();` : ""}\n    }\n    catch (Exception caught)\n    {\n        _normalTimeoutException${token} = caught;${faulted ? `\n        ${faulted}();` : ""}\n    }\n}`
      );
    },
    codegenExpression(api) {
      return `_normalTimeoutException${nodeToken(api)}`;
    },
    codegenAction(api) {
      return `WaitWithTimeout${nodeToken(api)}(${api.input("task").code}, ${api.input("milliseconds").code});`;
    }
  });

  registerNode("task.retry", {
    title: "Retry Flow",
    group: "Tasks & Threading",
    symbol: "RETRY",
    description:
      "Emits Attempt. Route the attempted operation back to Success or Failure; Failure waits and retries until Max Attempts is reached.",
    inputs: [
      port("start", "Start", "impulse"),
      port("success", "Attempt Succeeded", "impulse"),
      port("failure", "Attempt Failed", "impulse"),
      port("maxAttempts", "Max Attempts", "int"),
      port("delayMilliseconds", "Retry Delay ms", "int")
    ],
    outputs: [
      port("attempt", "Attempt", "impulse"),
      port("completed", "Completed", "impulse"),
      port("exhausted", "Retries Exhausted", "impulse"),
      port("attemptNumber", "Attempt Number", "int")
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
        `private static int _normalRetryAttempt${token};\nprivate static int _normalRetryMaximum${token} = 1;\nprivate static int _normalRetryDelay${token};\nprivate static int _normalRetryGeneration${token};`
      );
      api.addMember(
        `${api.node.id}.retry`,
        `private static void StartRetry${token}(int maximum, int delay)\n{\n    _normalRetryGeneration${token}++;\n    _normalRetryMaximum${token} = Math.Max(1, maximum);\n    _normalRetryDelay${token} = Math.Max(0, delay);\n    _normalRetryAttempt${token} = 1;${attempt ? `\n    ${attempt}();` : ""}\n}\n\nprivate static void CompleteRetry${token}()\n{\n    _normalRetryGeneration${token}++;${completed ? `\n    ${completed}();` : ""}\n}\n\nprivate static async void FailRetry${token}()\n{\n    int generation = _normalRetryGeneration${token};\n    if (_normalRetryAttempt${token} >= _normalRetryMaximum${token})\n    {\n        _normalRetryGeneration${token}++;${exhausted ? `\n        ${exhausted}();` : ""}\n        return;\n    }\n\n    if (_normalRetryDelay${token} > 0)\n    {\n        await Task.Delay(_normalRetryDelay${token}).ConfigureAwait(false);\n    }\n\n    if (generation != _normalRetryGeneration${token})\n    {\n        return;\n    }\n\n    _normalRetryAttempt${token}++;${attempt ? `\n    ${attempt}();` : ""}\n}`
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
      group: "Tasks & Threading",
      symbol,
      description:
        `${title}. Select the node and use + / − to change the Task count.`,
      inputs: [
        port("a", "Task A", "task"),
        port("b", "Task B", "task")
      ],
      variadicInputs: {
        minimum: 2,
        defaultCount: 2,
        maximum: 64,
        preserveAB: true,
        template: port("a", "Task", "task")
      },
      outputs: [port("task", "Combined Task", "task")],
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
    "When All Tasks Finish",
    "ALL",
    tasks => `Task.WhenAll(new Task[] { ${tasks.join(", ")} })`
  );
  registerNormalTaskAggregate(
    "task.whenAny",
    "When Any Task Finishes",
    "ANY",
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
      "Microsoft.Win32",
      /\b(?:Registry|RegistryKey)\b|Microsoft\.Win32\./
    ],
    [
      "Newtonsoft.Json",
      /\bJsonConvert\b|Newtonsoft\.Json\./
    ],
    [
      "Newtonsoft.Json.Linq",
      /\b(?:JObject|JArray|JToken|JValue)\b|Newtonsoft\.Json\.Linq\./
    ],
    [
      "Websocket.Client",
      /\bWebsocketClient\b|Websocket\.Client\./
    ]
  ];

  const RAW_CSHARP_PACKAGE_RULES = [
    {
      pattern:
        /\bNewtonsoft\.Json\b|\b(?:JsonConvert|JObject|JArray|JToken|JValue)\b/,
      include: "Newtonsoft.Json",
      version: "13.0.3"
    },
    {
      pattern:
        /\bWebsocket\.Client\b|\bWebsocketClient\b/,
      include: "Websocket.Client",
      version: "5.1.2"
    }
  ];

  const RAW_CSHARP_FRAMEWORK_RULES = [
    {
      pattern:
        /\bMicrosoft\.AspNetCore\b|^\s*using\s+Microsoft\.AspNetCore(?:\.|;)/m,
      include: "Microsoft.AspNetCore.App"
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
      usings.add("Renderite.Shared");
    }
    if (usesHarmony) {
      usings.add("HarmonyLib");
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
      api.require("usesHarmony", true);
      api.require(
        "runtimeReloadUnsafe",
        true
      );
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
    title: "Harmony Exact Patch Source",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "H.CS",
    description:
      "Exports a complete Harmony patch source file into the main mod project. Attribute patches are applied exactly once from the generated mod's OnEngineInit. Use the Early Harmony Patch Library node only when a patch must be active before rml_mods are loaded.",
    parameters: [
      pText(
        "fileName",
        "File name",
        "ExactHarmonyPatches.cs"
      ),
      pCode(
        "content",
        "Complete patch source",
        "using HarmonyLib;\n\nnamespace {NAMESPACE};\n\n[HarmonyPatch]\ninternal static class ExactHarmonyPatches\n{\n    // Add [HarmonyPatch] targets and exact Prefix/Postfix/Finalizer/Transpiler methods here.\n}\n",
        "This file is compiled into the main mod DLL and automatically registered with PatchAll during OnEngineInit.",
        24
      )
    ]
  });

  registerNode("harmony.earlyPatchSource", {
    title: "Early Harmony Patch Library (rml_libs)",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "H.LIB",
    description:
      "Exports exact [HarmonyPatch] source into a separate class-library project. Its DLL is deployed to rml_libs and is discovered and patched immediately before normal rml_mods are loaded. This source is intentionally independent from graph sockets and mod configuration state and may only target assemblies available at that early phase.",
    parameters: [
      pText(
        "fileName",
        "Patch source file",
        "EarlyHarmonyPatches.cs"
      ),
      pNumber(
        "loadOrder",
        "Patch order",
        0,
        "Lower values are applied first when multiple marked rml_libs patch assemblies are present."
      ),
      pCode(
        "content",
        "Complete early patch source",
        "using HarmonyLib;\n\nnamespace {NAMESPACE}.EarlyPatches;\n\n[HarmonyPatch]\ninternal static class EarlyHarmonyPatches\n{\n    // Add exact [HarmonyPatch] declarations here.\n    // This project cannot call graph Emit... methods or read generated mod state.\n}\n",
        "The generated patch project is built separately and copied to rml_libs. It requires the matching custom RML loader with RmlPatchAssemblyAttribute support.",
        24
      )
    ]
  });

  registerNode("csharp.using", {
    title: "Manual Using Override",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "USING",
    description:
      "Expert fallback for a namespace the automatic raw-code dependency detector cannot infer.",
    parameters: [
      pText(
        "namespace",
        "Namespace",
        "System.Diagnostics"
      )
    ]
  });

  registerNode("csharp.buildOptions", {
    title: "Manual Build Option Override",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "BUILD",
    description:
      "Manual override only. Raw C# is scanned automatically for unsafe code and System.Windows.Forms first.",
    parameters: [
      pBool(
        "unsafe",
        "Allow unsafe blocks",
        false
      ),
      pBool(
        "windowsForms",
        "Use Windows Forms",
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
          const options = [...(existing.options || []), ...(parameter.options || [])];
          const seen = new Set();
          existing.options = options.filter(option => {
            const value = String(Array.isArray(option) ? option[0] : option?.value ?? option);
            if (seen.has(value)) return false;
            seen.add(value);
            return true;
          });
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
        pSelect("operation", "Operation", entries.map(entry => [entry[0], entry[2].title || entry[0]]), defaultOperation, "", { affectsPorts: true, affectsNode: true, commitImmediately: true }),
        ...parameterByKey.values()
      ],
      inputs: defaultDefinition.inputs || [],
      outputs: defaultDefinition.outputs || [],
      resolveDefinition(node) {
        const [operation, , definition] = selected(node);
        const resolved = typeof definition.resolveDefinition === "function"
          ? { ...definition, ...definition.resolveDefinition(node) }
          : definition;
        return {
          title: `${title} · ${resolved.title}`,
          symbol: resolved.symbol || symbol,
          description: resolved.description,
          inputs: resolved.inputs || [],
          outputs: resolved.outputs || [],
          variadicInputs: resolved.variadicInputs || null,
          variadicOutputs: resolved.variadicOutputs || null,
          selectedFamilyOperation: operation
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

  registerCompatibleRuntimeFamily("normal.nullCheck", "Null Check", "∅?", {
    isNull: "normal.isNull",
    isNotNull: "normal.isNotNull"
  });
  registerCompatibleRuntimeFamily("file.pathExists", "Path Exists", "PATH?", {
    file: "file.fileExists",
    directory: "file.directoryExists"
  });
  registerCompatibleRuntimeFamily("file.writeOperation", "Write File", "FILE→", {
    overwrite: "file.writeText",
    append: "file.appendText",
    bytes: "file.writeBytes"
  });
  registerCompatibleRuntimeFamily("file.readOperation", "Read File", "FILE←", {
    text: "file.readText",
    bytes: "file.readBytes"
  });
  registerCompatibleRuntimeFamily("file.transfer", "File Transfer", "FILE→", {
    copy: "file.copy",
    move: "file.move"
  });
  registerCompatibleRuntimeFamily("file.pathMutation", "Path Operation", "PATH!", {
    createDirectory: "file.createDirectory",
    delete: "file.delete"
  });
  registerCompatibleRuntimeFamily("json.createContainer", "Create JSON", "NEW JSON", {
    object: "json.createObject",
    array: "json.createArray"
  });
  registerCompatibleRuntimeFamily("task.waitMany", "Wait Tasks", "TASKS", {
    all: "task.whenAll",
    any: "task.whenAny"
  });
  registerCompatibleRuntimeFamily("collection.mutateItem", "List Item", "LIST±", {
    add: "collection.addItem",
    insert: "collection.insertItem",
    remove: "collection.removeItem",
    removeAt: "collection.removeAt",
    clear: "collection.clearList"
  });
  registerCompatibleRuntimeFamily("dictionary.mutate", "Dictionary Operation", "DICT±", {
    set: "dictionary.setValue",
    remove: "dictionary.removeKey"
  });
  registerCompatibleRuntimeFamily("json.mutate", "JSON Operation", "JSON±", {
    setProperty: "json.setProperty",
    removeProperty: "json.removeProperty",
    addArrayItem: "json.addArrayItem"
  });
  registerCompatibleRuntimeFamily("normal.tryParse", "Try Parse", "PARSE?", {
    number: "normal.tryParseNumber",
    boolean: "normal.tryParseBoolean"
  });
  registerCompatibleRuntimeFamily("text.combineOperation", "Combine Text", "TXT+", {
    concat: "text.concat",
    format: "text.format",
    join: "text.join"
  });
  registerNode("cast.operation", {
    title: "Convert Value",
    group: "Conversions",
    symbol: "→",
    parameters: [
      pSelect("operation", "Conversion", [["doubleToFloat", "Double To Float"], ["floatToInt", "Float To Int"], ["toString", "To String"]], "doubleToFloat", "", { affectsPorts: true, affectsNode: true, commitImmediately: true })
    ],
    inputs: [port("value", "Value", "double")],
    outputs: [port("result", "Result", "float")],
    resolveDefinition(node) {
      const operation = String(node.parameters?.operation || "doubleToFloat");
      if (operation === "floatToInt") return { title: "Convert · Float To Int", symbol: "F→I", inputs: [port("value", "Value", "float")], outputs: [port("result", "Result", "int")] };
      if (operation === "toString") return { title: "Convert · To String", symbol: "→T", inputs: [genericPort("value", "Value", "T", "value")], outputs: [port("result", "Result", "string")] };
      return { title: "Convert · Double To Float", symbol: "D→F", inputs: [port("value", "Value", "double")], outputs: [port("result", "Result", "float")] };
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
  registerCompatibleRuntimeFamily("network.socketSend", "Socket Send", "NET→", {
    tcp: "network.tcpSend",
    udp: "network.udpSend"
  });
  registerCompatibleRuntimeFamily("flow.loop", "Conditional Loop", "LOOP", {
    while: "flow.whileLoop",
    doWhile: "flow.doWhileLoop"
  });
  registerCompatibleRuntimeFamily("flow.loopControl", "Loop Control", "↪", {
    break: "flow.break",
    continue: "flow.continue"
  });
  registerCompatibleRuntimeFamily("lifecycle.shutdownEvent", "Shutdown Event", "POWER", {
    processExit: "lifecycle.processExit",
    modUnload: "lifecycle.modUnload"
  });
  registerCompatibleRuntimeFamily("configuration.visibilityOperation", "Configuration Visibility", "CFG◉", {
    item: "configuration.setVisibility",
    label: "configuration.setLabelVisibility"
  });
  registerCompatibleRuntimeFamily("harmony.readPatchValue", "Read Patch Value", "PATCH→", {
    argument: "harmony.patchArgument",
    result: "harmony.patchResult"
  });
  registerCompatibleRuntimeFamily("harmony.writePatchValue", "Write Patch Value", "PATCH=", {
    argument: "harmony.setArgument",
    result: "harmony.setResult"
  });

  {
    const harmonyDefinition = registry.getNodeDefinition("harmony.patchEvent");
    const lifecyclePresets = {
      worldStart: ["On World Start", "WORLD+", "FrooxEngine.World", "OnStart"],
      worldDestroy: ["On World Destroy", "WORLD−", "FrooxEngine.World", "OnDestroy"],
      userJoin: ["On User Join", "USER+", "FrooxEngine.World", "OnUserJoined"],
      userLeave: ["On User Leave", "USER−", "FrooxEngine.World", "OnUserLeft"],
      componentAttach: ["On Component Attach", "ATTACH", "FrooxEngine.Component", "OnAttach"],
      componentDestroy: ["On Component Destroy", "DEST", "FrooxEngine.Component", "OnDestroy"],
      engineUpdate: ["On Engine Update", "UPDATE", "FrooxEngine.Engine", "Update"]
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
      title: "Lifecycle Harmony Event",
      group: "Lifecycle",
      symbol: "LIFE",
      parameters: [
        pSelect("operation", "Event", Object.entries(lifecyclePresets).map(([value, preset]) => [value, preset[0]]), "worldStart", "", { affectsPorts: true, affectsNode: true, commitImmediately: true }),
        pSelect("patchKind", "Patch kind", ["prefix", "postfix", "finalizer"], "postfix"),
        pText("targetTypeOverride", "Target type override", "", "Empty uses the selected event preset."),
        pText("targetMethodOverride", "Target method override", "", "Empty uses the selected event preset."),
        pText("argumentTypes", "Argument types", ""),
        pNumber("priority", "Harmony priority", 400),
        pBool("captureResult", "Capture / replace __result", false)
      ],
      outputs: [port("called", "Called", "impulse"), port("context", "Context", "patchContext")],
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
          "System",
          "ResoniteModLoader"
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
            api.require(
              "runtimeReloadUnsafe",
              true
            );
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
                "ExactHarmonyPatches.cs"
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
            api.require(
              "usesHarmony",
              true
            );
            api.require(
              "runtimeReloadUnsafe",
              true
            );
            const fileName = String(
              node.parameters?.fileName ||
                "EarlyHarmonyPatches.cs"
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
            include: "Renderite.Shared",
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
          folder: "Patches",
          deployDirectory: "rml_libs",
          files: [
            {
              name:
                "GeneratedPatchAssemblyInfo.cs",
              content:
`// Generated registration marker for the matching custom RML loader.
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
          "Early Harmony patch sources are exported as a separate rml_libs project. They are applied immediately before rml_mods and therefore cannot call graph Emit methods, depend on generated mod configuration state, or patch another normal mod assembly that has not been loaded yet. The generated library requires the matching custom ResoniteModLoader build with RmlPatchAssemblyAttribute discovery support."
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
        api.require("usesHarmony", true);
        api.require(
          "runtimeReloadUnsafe",
          true
        );
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
        api.warning(
          "Advanced C# nodes remove the expressiveness ceiling, but their source is intentionally exported verbatim and must be compiled against the target Resonite/RML assemblies."
        );
      }

    }
  });
})();
