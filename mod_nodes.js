(() => {
  "use strict";

  const registry = window.RMLModNodeRegistry;

  if (!registry || registry.version !== 3) {
    console.error(
      "RML universal mod nodes require the matching node_graph.js registry version 3."
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
      components: Object.freeze([]),
      materials: Object.freeze([]),
      commonMaterials: Object.freeze([]),
      meshes: Object.freeze([]),
      slotAttachOverloads: Object.freeze([]),
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

  function uniqueCatalogNames(values) {
    return [...new Set(
      (Array.isArray(values)
        ? values
        : [])
        .map(value =>
          String(value || "").trim()
        )
        .filter(Boolean)
    )].sort((left, right) =>
      left.localeCompare(right)
    );
  }

  function catalogNames(
    directProperty,
    typeFlag
  ) {
    const direct =
      uniqueCatalogNames(
        componentCatalog[directProperty]
      );

    if (direct.length > 0) {
      return direct;
    }

    const derived =
      uniqueCatalogNames(
        CATALOG_TYPES
          .filter(type =>
            type[typeFlag] === true
          )
          .map(type =>
            type.fullName
          )
      );

    return derived;
  }

  const FROOX_COMPONENT_TYPES =
    catalogNames(
      "components",
      "isAttachableComponent"
    );
  const FROOX_MATERIAL_TYPES =
    catalogNames(
      "materials",
      "isMaterial"
    );
  const FROOX_COMMON_MATERIAL_TYPES =
    catalogNames(
      "commonMaterials",
      "isCommonMaterial"
    );
  const FROOX_MESH_TYPES =
    catalogNames(
      "meshes",
      "isMeshProvider"
    );
  const FROOX_SLOT_ATTACH_OVERLOADS =
    Array.isArray(
      componentCatalog.slotAttachOverloads
    )
      ? componentCatalog.slotAttachOverloads
      : [];

  const FROOX_COMPONENT_TYPE_SET =
    new Set(FROOX_COMPONENT_TYPES);
  const FROOX_MATERIAL_TYPE_SET =
    new Set(FROOX_MATERIAL_TYPES);
  const FROOX_COMMON_MATERIAL_TYPE_SET =
    new Set(FROOX_COMMON_MATERIAL_TYPES);
  const FROOX_MESH_TYPE_SET =
    new Set(FROOX_MESH_TYPES);

  const CATALOG_SOURCE_DESCRIPTION =
    componentCatalog.catalogSource ===
      "scanner"
      ? "live scanner catalog"
      : componentCatalog.catalogSource ===
          "scanner-cache"
        ? "cached live scanner catalog"
        : "currently unavailable API catalog";

  const RAW_CSHARP_GROUP =
    "Advanced / Raw C#";

  const DEFAULT_WORLD_ROOT_SLOT_CS =
    "(FrooxEngine.Engine.Current?.WorldManager?.FocusedWorld ?? FrooxEngine.Userspace.UserspaceWorld)!.RootSlot";

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
      defaultCs: "Elements.Core.floatQ.Identity"
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
      defaultCs: "Renderite.Shared.TextureWrapMode.Repeat"
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

private static Type? FindType(string? typeName)
{
    if (string.IsNullOrWhiteSpace(typeName))
    {
        return null;
    }

    Type? direct = Type.GetType(typeName, throwOnError: false, ignoreCase: false);
    if (direct is not null)
    {
        return direct;
    }

    foreach (Assembly assembly in AppDomain.CurrentDomain.GetAssemblies())
    {
        Type? candidate = assembly.GetType(typeName, throwOnError: false, ignoreCase: false);
        if (candidate is not null)
        {
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

    PropertyInfo? property = type.GetProperty(memberName, GraphAllMembers);
    if (property is not null && property.GetIndexParameters().Length == 0)
    {
        return property.GetValue(instance);
    }

    FieldInfo? field = type.GetField(memberName, GraphAllMembers);
    if (field is not null)
    {
        return field.GetValue(instance);
    }

    return null;
}

private static object? ReadMemberPath(object? target, string? memberPath)
{
    object? current = target;

    foreach (string part in (memberPath ?? string.Empty)
        .Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
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

    PropertyInfo? property = type.GetProperty(memberName, GraphAllMembers);
    if (property?.CanWrite == true)
    {
        property.SetValue(instance, ConvertGraphValue(value, property.PropertyType));
        return true;
    }

    FieldInfo? field = type.GetField(memberName, GraphAllMembers);
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

    if (parameterTypes is { Length: > 0 })
    {
        return type.GetMethod(
            methodName,
            GraphAllMembers,
            binder: null,
            types: parameterTypes,
            modifiers: null);
    }

    return type
        .GetMethods(GraphAllMembers)
        .FirstOrDefault(method =>
            string.Equals(method.Name, methodName, StringComparison.Ordinal));
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

    foreach (MethodInfo method in type
        .GetMethods(GraphAllMembers)
        .Where(method => string.Equals(method.Name, methodName, StringComparison.Ordinal))
        .OrderBy(method => method.GetParameters().Length))
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

    foreach (ConstructorInfo constructor in type
        .GetConstructors(GraphAllMembers)
        .OrderBy(constructor => constructor.GetParameters().Length))
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
    api.addField(
      "universal.event.subscriptions",
      "private static readonly List<(object Target, EventInfo Event, Delegate Handler)> _graphEventSubscriptions = new();"
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

    EventInfo? eventInfo = target
        .GetType()
        .GetEvent(eventName, GraphAllMembers);
    Type? handlerType = eventInfo?.EventHandlerType;
    MethodInfo? invoke = handlerType?.GetMethod("Invoke");

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

    eventInfo.AddEventHandler(target, handler);
    _graphEventSubscriptions.Add((target, eventInfo, handler));
    return handler;
}

private static void UnsubscribeGraphEvents()
{
    foreach ((object target, EventInfo eventInfo, Delegate handler) in _graphEventSubscriptions)
    {
        try
        {
            eventInfo.RemoveEventHandler(target, handler);
        }
        catch
        {
        }
    }

    _graphEventSubscriptions.Clear();
}
`);
  }

  function ensureResoniteRuntime(api) {
    ensureReflectionRuntime(api);
    api.addUsing("FrooxEngine");
    api.addMember("universal.resonite.helpers", String.raw`
private static FrooxEngine.Engine? CurrentEngine()
{
    return FrooxEngine.Engine.Current;
}

private static FrooxEngine.World? CurrentUserspaceWorld()
{
    return FrooxEngine.Userspace.UserspaceWorld;
}

private static FrooxEngine.World? CurrentFocusedWorld()
{
    return FrooxEngine.Engine.Current?.WorldManager?.FocusedWorld ??
           FrooxEngine.Userspace.UserspaceWorld;
}

private static FrooxEngine.User? CurrentLocalUser(object? world)
{
    return world is FrooxEngine.World typed
        ? typed.LocalUser
        : null;
}

private static IEnumerable<object> EnumerateObjects(object? value)
{
    if (value is IEnumerable enumerable && value is not string)
    {
        foreach (object? item in enumerable)
        {
            if (item is not null)
            {
                yield return item;
            }
        }
    }
}

private static object? FindSlotRecursive(object? root, string? nameOrPath)
{
    if (root is null || string.IsNullOrWhiteSpace(nameOrPath))
    {
        return null;
    }

    string requested = nameOrPath.Trim();
    string currentName = Convert.ToString(ReadMember(root, "Name"), CultureInfo.InvariantCulture) ?? string.Empty;

    if (string.Equals(currentName, requested, StringComparison.OrdinalIgnoreCase))
    {
        return root;
    }

    object? direct = InvokeBest(root, "FindChild", requested) ??
                     InvokeBest(root, "FindChild", requested, true);
    if (direct is not null)
    {
        return direct;
    }

    foreach (object child in EnumerateObjects(ReadMember(root, "Children")))
    {
        object? found = FindSlotRecursive(child, requested);
        if (found is not null)
        {
            return found;
        }
    }

    return null;
}

private static object? WorldRootSlot(object? world)
{
    return ReadMember(world, "RootSlot") ??
           ReadMember(world, "Root") ??
           ReadMemberPath(world, "Slots.Root");
}

private static object? AddSlotReflective(object? parent, string? name)
{
    if (parent is null)
    {
        return null;
    }

    return InvokeBest(parent, "AddSlot", name ?? "Slot") ??
           InvokeBest(parent, "AddChild", name ?? "Slot");
}

private static bool DestroyReflective(object? target)
{
    if (target is null)
    {
        return false;
    }

    foreach (string methodName in new[] { "Destroy", "DestroyPersistent", "Dispose" })
    {
        MethodInfo? method = target
            .GetType()
            .GetMethods(GraphAllMembers)
            .FirstOrDefault(candidate =>
                candidate.Name == methodName &&
                candidate.GetParameters().Length == 0);

        if (method is null)
        {
            continue;
        }

        method.Invoke(target, null);
        return true;
    }

    return false;
}

private static object? FindComponentReflective(object? slot, Type? componentType)
{
    if (slot is null || componentType is null)
    {
        return null;
    }

    object? direct = InvokeBest(slot, "GetComponent", componentType);
    if (direct is not null)
    {
        return direct;
    }

    return EnumerateObjects(ReadMember(slot, "Components"))
        .FirstOrDefault(component => componentType.IsInstanceOfType(component));
}

private static object? AttachComponentReflective(object? slot, Type? componentType)
{
    if (slot is null || componentType is null)
    {
        return null;
    }

    object? direct = InvokeBest(slot, "AttachComponent", componentType);
    if (direct is not null)
    {
        return direct;
    }

    MethodInfo? generic = slot
        .GetType()
        .GetMethods(GraphAllMembers)
        .FirstOrDefault(method =>
            method.Name == "AttachComponent" &&
            method.IsGenericMethodDefinition &&
            method.GetGenericArguments().Length == 1 &&
            method.GetParameters().Length == 0);

    return generic?
        .MakeGenericMethod(componentType)
        .Invoke(slot, null);
}

private static object? ReadSyncMember(object? target, string? memberPath)
{
    object? member = ReadMemberPath(target, memberPath);
    return ReadMember(member, "Value") ?? member;
}

private static bool WriteSyncMember(object? target, string? memberPath, object? value)
{
    if (target is null || string.IsNullOrWhiteSpace(memberPath))
    {
        return false;
    }

    string[] parts = memberPath
        .Split('.', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
    object? owner = target;

    for (int index = 0; index < parts.Length - 1; index++)
    {
        owner = ReadMember(owner, parts[index]);
        if (owner is null)
        {
            return false;
        }
    }

    string finalName = parts.Length > 0 ? parts[^1] : memberPath;
    object? member = ReadMember(owner, finalName);

    if (member is not null && WriteMember(member, "Value", value))
    {
        return true;
    }

    return WriteMember(owner, finalName, value);
}

private static object? ReadDynamicVariableReflective(
    object? space,
    string? name)
{
    if (space is null || string.IsNullOrWhiteSpace(name))
    {
        return null;
    }

    foreach (string methodName in new[]
    {
        "ReadValue",
        "GetValue",
        "Read",
        "Get"
    })
    {
        try
        {
            object? value = InvokeBest(space, methodName, name);
            if (value is not null)
            {
                return ReadMember(value, "Value") ?? value;
            }
        }
        catch
        {
        }
    }

    return ReadSyncMember(space, name);
}

private static bool WriteDynamicVariableReflective(
    object? space,
    string? name,
    object? value)
{
    if (space is null || string.IsNullOrWhiteSpace(name))
    {
        return false;
    }

    foreach (string methodName in new[]
    {
        "WriteValue",
        "SetValue",
        "Write",
        "Set"
    })
    {
        try
        {
            object? result = InvokeBest(space, methodName, name, value);
            if (result is bool boolean)
            {
                return boolean;
            }

            if (result is not null)
            {
                return true;
            }
        }
        catch
        {
        }
    }

    return WriteSyncMember(space, name, value);
}

private static object? CurrentRadiantDash()
{
    object? engine = CurrentEngine();
    object? direct =
        ReadMemberPath(engine, "RadiantDash") ??
        ReadMemberPath(engine, "WorldManager.UserspaceWorld.RadiantDash") ??
        ReadMemberPath(engine, "WorldManager.UserspaceWorld.UserspaceRadiantDash");

    if (direct is not null)
    {
        return direct;
    }

    Type? dashType =
        FindType("FrooxEngine.RadiantDash") ??
        FindType("FrooxEngine.UIX.RadiantDash");

    return FindComponentReflective(
        WorldRootSlot(CurrentUserspaceWorld()),
        dashType);
}

private static object? OpenRadiantDashModalReflective(
    object? dash,
    object? size,
    string? title)
{
    object? host = ReadMember(dash, "Slot") ?? dash;
    return InvokeBest(host, "OpenModalOverlay", size, title ?? string.Empty) ??
           InvokeBest(dash, "OpenModalOverlay", size, title ?? string.Empty);
}

private static object? CreateUiBuilderReflective(object? slot)
{
    Type? builderType = FindType("FrooxEngine.UIX.UIBuilder");
    return CreateReflective(builderType, new[] { slot });
}

private static object? CreateUiElementReflective(
    object? builder,
    string? methodName,
    params object?[] arguments)
{
    return InvokeBest(builder, methodName, arguments);
}

private static void DispatchToResonite(Action action)
{
    FrooxEngine.World? world = CurrentFocusedWorld();
    if (world is null || world.IsDisposed)
    {
        throw new InvalidOperationException(
            "No usable Resonite world is available for synchronous execution.");
    }

    // World.RunSynchronously is FrooxEngine's supported bridge for code that
    // needs to mutate the world's data model from another/background thread.
    world.RunSynchronously(
        action,
        immediatellyIfPossible: true);
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
    _ = Task.Run(action);
}
`);
  }

  function ensureHarmonyRuntime(api) {
    ensureReflectionRuntime(api);
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

    return argumentTypes.Length > 0
        ? targetType.GetMethod(methodName, GraphAllMembers, null, argumentTypes, null)
        : targetType.GetMethods(GraphAllMembers)
            .FirstOrDefault(method => method.Name == methodName);
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
        MethodInfo? callback = typeof(__GRAPH_CLASS__)
            .GetMethod(callbackMethod, GraphAllMembers);

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
    MethodInfo? standIn = standInType?.GetMethod(standInMethodName, GraphAllMembers);

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
    api.addField(
      `${api.node.id}.${suffix}`,
      `private static ${csType} ${field} = ${defaultCode};`
    );
    return field;
  }


  const DEFAULT_MATERIAL_TYPE =
    "FrooxEngine.PBS_Metallic";

  const DEFAULT_MESH_TYPE =
    "FrooxEngine.BoxMesh";

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

  function catalogQualifiedTypeName(
    api,
    value,
    allowedTypes,
    fallback,
    label
  ) {
    const candidate =
      safeQualifiedTypeName(
        api,
        value,
        fallback,
        label
      );
    const normalized =
      candidate.startsWith("global::")
        ? candidate.slice(8)
        : candidate;

    if (allowedTypes.has(normalized)) {
      return normalized;
    }

    api?.diagnostic?.(
      `${label} '${normalized}' is not part of the ${CATALOG_SOURCE_DESCRIPTION} for FrooxEngine ${componentCatalog.engineVersion}. '${fallback}' was used.`
    );

    return fallback;
  }

  function materialTypeParameter(
    defaultValue = DEFAULT_MATERIAL_TYPE,
    commonOnly = false
  ) {
    const values = commonOnly
      ? FROOX_COMMON_MATERIAL_TYPES
      : FROOX_MATERIAL_TYPES;

    return pSelect(
      "materialType",
      commonOnly
        ? "Common material component type"
        : "Material component type",
      values,
      values.includes(defaultValue)
        ? defaultValue
        : values[0] ||
          DEFAULT_MATERIAL_TYPE,
      commonOnly
        ? "Verified concrete FrooxEngine component implementing ICommonMaterial and IAssetProvider<Material>."
        : "Verified concrete FrooxEngine component implementing IAssetProvider<Material>.",
      { affectsPorts: true }
    );
  }

  function meshTypeParameter(
    defaultValue = DEFAULT_MESH_TYPE
  ) {
    return pSelect(
      "meshType",
      "Mesh component type",
      FROOX_MESH_TYPES,
      FROOX_MESH_TYPES.includes(
        defaultValue
      )
        ? defaultValue
        : FROOX_MESH_TYPES[0] ||
          DEFAULT_MESH_TYPE,
      "Verified concrete FrooxEngine component implementing IAssetProvider<Mesh>.",
      { affectsPorts: true }
    );
  }

  function directMaterialType(api) {
    return catalogQualifiedTypeName(
      api,
      api.node.parameters?.materialType,
      FROOX_MATERIAL_TYPE_SET,
      DEFAULT_MATERIAL_TYPE,
      "Material component type"
    );
  }

  function directCommonMaterialType(api) {
    return catalogQualifiedTypeName(
      api,
      api.node.parameters?.materialType,
      FROOX_COMMON_MATERIAL_TYPE_SET,
      DEFAULT_MATERIAL_TYPE,
      "Common material component type"
    );
  }

  function directMeshType(api) {
    return catalogQualifiedTypeName(
      api,
      api.node.parameters?.meshType,
      FROOX_MESH_TYPE_SET,
      DEFAULT_MESH_TYPE,
      "Mesh component type"
    );
  }

  function verifiedComponentType(api) {
    return catalogQualifiedTypeName(
      api,
      api.node.parameters?.componentType,
      FROOX_COMPONENT_TYPE_SET,
      "FrooxEngine.Grabbable",
      "Component type"
    );
  }

  function directFieldName(api, suffix) {
    return `_${suffix}${nodeToken(api)}`;
  }

  function ensureDirectResoniteCore(api) {
    api.addUsing("FrooxEngine");
  }

  function ensureDirectResoniteMath(api) {
    ensureDirectResoniteCore(api);
    api.addUsing("Elements.Core");
    api.require("usesElements", true);
  }

  function ensureDirectResoniteRendering(api) {
    ensureDirectResoniteMath(api);
    api.addUsing("Renderite.Shared");
    api.require("usesRenderiteShared", true);
  }

  function attachResultFields(
    api,
    prefix,
    meshCsType = "FrooxEngine.IAssetProvider<FrooxEngine.Mesh>",
    colliderCsType = "FrooxEngine.Collider"
  ) {
    ensureDirectResoniteCore(api);
    const fields = {
      slot: addStatefulField(
        api,
        `${prefix}Slot`,
        "FrooxEngine.Slot?",
        "null"
      ),
      mesh: addStatefulField(
        api,
        `${prefix}Mesh`,
        `${meshCsType}?`,
        "null"
      ),
      material: addStatefulField(
        api,
        `${prefix}Material`,
        "FrooxEngine.IAssetProvider<FrooxEngine.Material>?",
        "null"
      ),
      renderer: addStatefulField(
        api,
        `${prefix}Renderer`,
        "FrooxEngine.MeshRenderer?",
        "null"
      ),
      collider: addStatefulField(
        api,
        `${prefix}Collider`,
        `${colliderCsType}?`,
        "null"
      ),
      success: addStatefulField(
        api,
        `${prefix}Success`,
        "bool",
        "false"
      ),
      exception: addStatefulField(
        api,
        `${prefix}Exception`,
        "System.Exception?",
        "null"
      )
    };

    return fields;
  }

  function attachOutputExpression(
    api,
    prefix,
    extra = {}
  ) {
    const portFields = {
      slot: directFieldName(api, `${prefix}Slot`),
      mesh: directFieldName(api, `${prefix}Mesh`),
      material: directFieldName(api, `${prefix}Material`),
      renderer: directFieldName(api, `${prefix}Renderer`),
      collider: directFieldName(api, `${prefix}Collider`),
      success: directFieldName(api, `${prefix}Success`),
      exception: directFieldName(api, `${prefix}Exception`),
      ...extra
    };

    return portFields[api.portId] || "null!";
  }


  const BUILT_IN_ATTACH_METHOD_NAMES =
    new Set([
      "AttachTexture",
      "AttachCubemap",
      "AttachSprite",
      "AttachStaticMesh",
      "AttachAudioClip",
      "AttachFont",
      "AttachQuad",
      "AttachSphere",
      "AttachBox",
      "AttachArrow",
      "AttachCylinder",
      "AttachMesh",
      "AttachPrimitive",
      "AttachSkybox"
    ]);

  const CATALOG_TYPE_BY_NAME =
    new Map(
      CATALOG_TYPES
        .filter(type =>
          typeof type.fullName === "string"
        )
        .map(type => [
          type.fullName,
          type
        ])
    );

  function normalizedCatalogTypeName(value) {
    return String(value || "")
      .trim()
      .replace(/^global::/, "")
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

    if (FROOX_MATERIAL_TYPE_SET.has(type)) {
      return graphMaterialType(type);
    }

    if (FROOX_MESH_TYPE_SET.has(type)) {
      return graphMeshType(type);
    }

    const catalogType =
      CATALOG_TYPE_BY_NAME.get(type);

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

  function catalogMethodById(methodId) {
    return FROOX_SLOT_ATTACH_OVERLOADS
      .find(method =>
        String(method?.id || "") ===
        String(methodId || "")
      ) || null;
  }

  function genericOptionsForParameter(
    genericParameter
  ) {
    if (
      genericParameter?.valueTypeConstraint ===
      true
    ) {
      return [];
    }

    const constraints =
      (Array.isArray(
        genericParameter?.constraints
      )
        ? genericParameter.constraints
        : [])
        .map(normalizedCatalogTypeName)
        .filter(Boolean);
    const candidates =
      uniqueCatalogNames([
        ...FROOX_COMPONENT_TYPES,
        ...FROOX_MATERIAL_TYPES,
        ...FROOX_MESH_TYPES
      ]);

    const filtered = candidates.filter(
      candidate => {
        const information =
          CATALOG_TYPE_BY_NAME.get(
            candidate
          );

        if (
          genericParameter
            ?.defaultConstructorConstraint ===
            true &&
          information &&
          information.kind !== "struct" &&
          !(
            Array.isArray(
              information.constructors
            ) &&
            information.constructors.some(
              constructor =>
                Array.isArray(
                  constructor.parameters
                ) &&
                constructor.parameters.length ===
                  0
            )
          )
        ) {
          return false;
        }

        return constraints.every(
          constraint =>
            catalogTypeSatisfiesConstraint(
              candidate,
              constraint
            )
        );
      }
    );

    if (filtered.length > 0) {
      return filtered;
    }

    return constraints.length === 0
      ? [...FROOX_COMPONENT_TYPES]
      : [];
  }

  function catalogMethodGenericTypes(
    node,
    method
  ) {
    const result = {};

    for (const genericParameter of
      Array.isArray(method?.genericParameters)
        ? method.genericParameters
        : []) {
      const options =
        genericOptionsForParameter(
          genericParameter
        );
      const key =
        `genericType${genericParameter.position}`;
      const configured = String(
        node?.parameters?.[key] || ""
      ).trim();

      result[genericParameter.name] =
        options.includes(configured)
          ? configured
          : options[0] || "";
    }

    return result;
  }

  function substituteCatalogGenericTypes(
    value,
    genericTypes
  ) {
    let result = String(value || "");

    for (const [name, type] of
      Object.entries(genericTypes)) {
      const escaped = name.replace(
        /[.*+?^${}()|[\]\\]/g,
        "\\$&"
      );

      result = result
        .replaceAll(`@${name}`, type)
        .replace(
          new RegExp(
            `\\b${escaped}\\b`,
            "g"
          ),
          type
        );
    }

    return result;
  }

  function catalogPortId(
    parameter
  ) {
    const safe = String(
      parameter?.name ||
      `arg${parameter?.position ?? 0}`
    )
      .replace(/[^A-Za-z0-9_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();

    return `arg-${parameter?.position ?? 0}-${safe || "value"}`;
  }

  function catalogMethodInputs(
    node,
    method
  ) {
    const genericTypes =
      catalogMethodGenericTypes(
        node,
        method
      );
    const parameters =
      Array.isArray(method?.parameters)
        ? method.parameters
        : [];
    const startIndex =
      method?.isExtensionMethod === true
        ? 1
        : 0;
    const inputs = [
      port("call", "Call", "impulse"),
      port("parent", "Parent Slot", "slot")
    ];

    for (
      let index = startIndex;
      index < parameters.length;
      index += 1
    ) {
      const parameter = parameters[index];

      if (parameter?.isOut === true) {
        continue;
      }

      const substituted =
        substituteCatalogGenericTypes(
          parameter?.elementType ||
          parameter?.type,
          genericTypes
        );
      const graphType =
        catalogGraphType(substituted);

      if (!graphType) {
        return null;
      }

      inputs.push(
        port(
          catalogPortId(parameter),
          parameter?.name ||
            `Argument ${index}`,
          graphType,
          parameter?.hasDefaultValue === true &&
          typeof parameter.defaultValueCSharp === "string"
            ? {
                defaultCs:
                  parameter.defaultValueCSharp
              }
            : {}
        )
      );
    }

    return inputs;
  }

  function catalogMethodOutputs(
    node,
    method
  ) {
    const genericTypes =
      catalogMethodGenericTypes(
        node,
        method
      );
    const outputs = [
      port("done", "Done", "impulse")
    ];
    const returnType =
      substituteCatalogGenericTypes(
        method?.returnType,
        genericTypes
      );

    if (
      returnType &&
      returnType !== "System.Void" &&
      returnType !== "void"
    ) {
      const graphType =
        catalogGraphType(returnType);

      if (!graphType) {
        return null;
      }

      outputs.push(
        port(
          "result",
          "Result",
          graphType
        )
      );
    }

    for (const parameter of
      Array.isArray(method?.parameters)
        ? method.parameters
        : []) {
      if (
        parameter?.isOut !== true &&
        !(
          parameter?.isByRef === true &&
          parameter?.isIn !== true
        )
      ) {
        continue;
      }

      const substituted =
        substituteCatalogGenericTypes(
          parameter?.elementType ||
          parameter?.type,
          genericTypes
        );
      const graphType =
        catalogGraphType(substituted);

      if (!graphType) {
        return null;
      }

      outputs.push(
        port(
          `out-${catalogPortId(parameter)}`,
          parameter?.name || "Out",
          graphType
        )
      );
    }

    outputs.push(
      port("success", "Success", "bool"),
      port("exception", "Exception", "exception")
    );

    return outputs;
  }

  function catalogMethodSupported(method) {
    if (
      !method ||
      typeof method !== "object" ||
      method.isObsolete === true ||
      BUILT_IN_ATTACH_METHOD_NAMES.has(
        method.name
      ) ||
      !Array.isArray(method.parameters) ||
      typeof method.declaringType !== "string" ||
      typeof method.id !== "string"
    ) {
      return false;
    }

    const genericParameters =
      Array.isArray(method.genericParameters)
        ? method.genericParameters
        : [];

    if (
      genericParameters.some(
        genericParameter =>
          genericOptionsForParameter(
            genericParameter
          ).length === 0
      )
    ) {
      return false;
    }

    if (
      method.returnType !== "System.Void" &&
      method.returnType !== "void" &&
      catalogCsTypeIsNullable(
        method.returnType
      )
    ) {
      return false;
    }

    if (
      method.parameters.some(parameter =>
        (parameter?.isOut === true ||
         (parameter?.isByRef === true &&
          parameter?.isIn !== true)) &&
        catalogCsTypeIsNullable(
          parameter?.elementType ||
          parameter?.type
        )
      )
    ) {
      return false;
    }

    const placeholderNode = {
      parameters: {}
    };

    return Boolean(
      catalogMethodInputs(
        placeholderNode,
        method
      ) &&
      catalogMethodOutputs(
        placeholderNode,
        method
      )
    );
  }

  const DISCOVERED_SLOT_ATTACH_METHODS =
    FROOX_SLOT_ATTACH_OVERLOADS
      .filter(catalogMethodSupported);

  function catalogMethodParameters(
    node,
    method
  ) {
    const parameters = [
      pSelect(
        "catalogMethodId",
        "Discovered Slot.Attach method",
        DISCOVERED_SLOT_ATTACH_METHODS.map(
          candidate => ({
            value: candidate.id,
            label: candidate.signature ||
              candidate.name
          })
        ),
        method?.id ||
          DISCOVERED_SLOT_ATTACH_METHODS[0]?.id ||
          "",
        "Methods not already covered by the dedicated Attach nodes. The list comes from the live Resonite API catalog.",
        { affectsPorts: true }
      )
    ];

    for (const genericParameter of
      Array.isArray(method?.genericParameters)
        ? method.genericParameters
        : []) {
      const options =
        genericOptionsForParameter(
          genericParameter
        );

      parameters.push(
        pSelect(
          `genericType${genericParameter.position}`,
          `Generic type ${genericParameter.name}`,
          options,
          options[0] ||
            "FrooxEngine.Grabbable",
          `Satisfies the scanned generic constraints for ${genericParameter.name}.`,
          { affectsPorts: true }
        )
      );
    }

    return parameters;
  }

  function catalogMethodFieldName(
    api,
    suffix
  ) {
    return `_catalogAttach${suffix}${nodeToken(api)}`;
  }

  function catalogMethodResolvedType(
    node,
    method,
    value
  ) {
    return substituteCatalogGenericTypes(
      value,
      catalogMethodGenericTypes(
        node,
        method
      )
    );
  }

  if (
    DISCOVERED_SLOT_ATTACH_METHODS.length > 0
  ) {
    registerGroup(
      "Discovered Resonite API",
      { after: "Attach & Create" }
    );

    registerNode("catalog.slotAttach", {
      title: "Discovered Slot Attach",
      group: "Discovered Resonite API",
      symbol: "+API",
      description:
        "Directly calls a newly discovered public Slot.Attach* API that is not already represented by a dedicated high-level node.",
      parameters: catalogMethodParameters(
        null,
        DISCOVERED_SLOT_ATTACH_METHODS[0]
      ),
      inputs: [
        port("call", "Call", "impulse"),
        port("parent", "Parent Slot", "slot")
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      ],
      resolveDefinition(node) {
        const method =
          catalogMethodById(
            node.parameters?.catalogMethodId
          ) ||
          DISCOVERED_SLOT_ATTACH_METHODS[0];
        const inputs =
          catalogMethodInputs(
            node,
            method
          );
        const outputs =
          catalogMethodOutputs(
            node,
            method
          );

        return {
          title:
            `Attach API · ${method.name}`,
          description:
            method.signature,
          parameters:
            catalogMethodParameters(
              node,
              method
            ),
          inputs: inputs || [],
          outputs: outputs || []
        };
      },
      codegenCollect(api) {
        ensureDirectResoniteCore(api);
        const method =
          catalogMethodById(
            api.node.parameters
              ?.catalogMethodId
          ) ||
          DISCOVERED_SLOT_ATTACH_METHODS[0];
        const genericTypes =
          catalogMethodGenericTypes(
            api.node,
            method
          );
        const returnType =
          substituteCatalogGenericTypes(
            method.returnType,
            genericTypes
          );

        if (
          returnType !== "System.Void" &&
          returnType !== "void"
        ) {
          api.addField(
            `${api.node.id}.catalogResult`,
            `private static ${returnType} ${catalogMethodFieldName(api, "Result")} = default!;`
          );
        }

        for (const parameter of
          method.parameters || []) {
          if (
            parameter.isOut !== true &&
            !(
              parameter.isByRef === true &&
              parameter.isIn !== true
            )
          ) {
            continue;
          }

          const type =
            substituteCatalogGenericTypes(
              parameter.elementType ||
                parameter.type,
              genericTypes
            );
          api.addField(
            `${api.node.id}.catalogOut.${parameter.position}`,
            `private static ${type} ${catalogMethodFieldName(api, `Out${parameter.position}`)} = default!;`
          );
        }

        api.addField(
          `${api.node.id}.catalogSuccess`,
          `private static bool ${catalogMethodFieldName(api, "Success")};`
        );
        api.addField(
          `${api.node.id}.catalogException`,
          `private static System.Exception? ${catalogMethodFieldName(api, "Exception")};`
        );
      },
      codegenExpression(api) {
        const method =
          catalogMethodById(
            api.node.parameters
              ?.catalogMethodId
          ) ||
          DISCOVERED_SLOT_ATTACH_METHODS[0];

        if (api.portId === "result") {
          return catalogMethodFieldName(
            api,
            "Result"
          );
        }

        if (api.portId === "success") {
          return catalogMethodFieldName(
            api,
            "Success"
          );
        }

        if (api.portId === "exception") {
          return `${catalogMethodFieldName(api, "Exception")}!`;
        }

        const outputParameter =
          (method.parameters || [])
            .find(parameter =>
              `out-${catalogPortId(parameter)}` ===
              api.portId
            );

        return outputParameter
          ? catalogMethodFieldName(
              api,
              `Out${outputParameter.position}`
            )
          : "null!";
      },
      codegenAction(api) {
        const method =
          catalogMethodById(
            api.node.parameters
              ?.catalogMethodId
          ) ||
          DISCOVERED_SLOT_ATTACH_METHODS[0];
        const genericTypes =
          catalogMethodGenericTypes(
            api.node,
            method
          );
        const genericArguments =
          (method.genericParameters || [])
            .map(parameter =>
              genericTypes[parameter.name]
            )
            .filter(Boolean);
        const genericSuffix =
          genericArguments.length > 0
            ? `<${genericArguments.join(", ")}>`
            : "";
        const parameters =
          method.parameters || [];
        const startIndex =
          method.isExtensionMethod === true
            ? 1
            : 0;
        const argumentsCode = [];
        const prelude = [];

        if (method.isExtensionMethod === true) {
          argumentsCode.push(
            api.input("parent").code
          );
        }

        for (
          let index = startIndex;
          index < parameters.length;
          index += 1
        ) {
          const parameter = parameters[index];
          const outField =
            catalogMethodFieldName(
              api,
              `Out${parameter.position}`
            );

          if (parameter.isOut === true) {
            argumentsCode.push(
              `out ${outField}`
            );
            continue;
          }

          if (
            parameter.isByRef === true &&
            parameter.isIn === true
          ) {
            argumentsCode.push(
              api.input(
                catalogPortId(parameter)
              ).code
            );
            continue;
          }

          if (parameter.isByRef === true) {
            prelude.push(
              `${outField} = ${api.input(catalogPortId(parameter)).code};`
            );
            argumentsCode.push(
              `ref ${outField}`
            );
            continue;
          }

          argumentsCode.push(
            api.input(
              catalogPortId(parameter)
            ).code
          );
        }

        const declaringType =
          String(method.declaringType || "")
            .replace(/^global::/, "");
        const call =
          method.isExtensionMethod === true ||
          method.isStatic === true
            ? `global::${declaringType}.${method.name}${genericSuffix}(${argumentsCode.join(", ")})`
            : `${api.input("parent").code}.${method.name}${genericSuffix}(${argumentsCode.join(", ")})`;
        const returnType =
          substituteCatalogGenericTypes(
            method.returnType,
            genericTypes
          );
        const successField =
          catalogMethodFieldName(
            api,
            "Success"
          );
        const exceptionField =
          catalogMethodFieldName(
            api,
            "Exception"
          );
        const resultField =
          catalogMethodFieldName(
            api,
            "Result"
          );
        const done = api.emit("done");
        const callStatement =
          returnType === "System.Void" ||
          returnType === "void"
            ? `${call};`
            : `${resultField} = ${call};`;

        return `try\n        {\n            ${exceptionField} = null;${prelude.length > 0 ? `\n            ${prelude.join("\n            ")}` : ""}\n            ${callStatement}\n            ${successField} = true;\n        }\n        catch (System.Exception caught)\n        {\n            ${exceptionField} = caught;\n            ${successField} = false;\n        }${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  if (CATALOG_ENUMS.length > 0) {
    function selectedCatalogEnum(node) {
      return CATALOG_ENUM_BY_NAME.get(
        String(
          node?.parameters?.enumType ||
          ""
        )
      ) || CATALOG_ENUMS[0];
    }

    function catalogEnumParameters(node) {
      const enumInfo =
        selectedCatalogEnum(node);
      const enumNames =
        enumInfo.values.map(value =>
          value.name
        );
      const configuredValue =
        String(
          node?.parameters?.enumValue ||
          ""
        );

      return [
        pSelect(
          "enumType",
          "Resonite enum type",
          CATALOG_ENUMS.map(value => ({
            value: value.fullName,
            label: value.fullName
          })),
          enumInfo.fullName,
          "Enum types are loaded from the live Resonite API catalog.",
          { affectsPorts: true }
        ),
        pSelect(
          "enumValue",
          "Value",
          enumNames,
          enumNames.includes(
            configuredValue
          )
            ? configuredValue
            : enumNames[0],
          enumInfo.isFlags === true
            ? "This is a flags enum. This constant selects one declared flag value. Combine flags through an explicit integer/enum operation when needed."
            : "Declared value from the selected Resonite enum."
        )
      ];
    }

    registerNode(
      "catalog.enumConstant",
      {
        title: "Resonite Enum Constant",
        group: "Values",
        symbol: "E",
        description:
          "A strongly typed enum value discovered from the live Resonite API catalog.",
        parameters:
          catalogEnumParameters(null),
        outputs: [
          port(
            "value",
            "Value",
            catalogEnumGraphType(
              CATALOG_ENUMS[0].fullName
            )
          )
        ],
        resolveDefinition(node) {
          const enumInfo =
            selectedCatalogEnum(node);

          return {
            title:
              `Enum · ${enumInfo.fullName.split(".").pop()}`,
            description:
              `Strongly typed ${enumInfo.fullName} value from the ${CATALOG_SOURCE_DESCRIPTION}.`,
            parameters:
              catalogEnumParameters(node),
            outputs: [
              port(
                "value",
                "Value",
                catalogEnumGraphType(
                  enumInfo.fullName
                )
              )
            ]
          };
        },
        codegenExpression(api) {
          const enumInfo =
            selectedCatalogEnum(
              api.node
            );
          const names =
            enumInfo.values.map(value =>
              value.name
            );
          const configured =
            String(
              api.node.parameters
                ?.enumValue ||
              ""
            );
          const value =
            names.includes(configured)
              ? configured
              : names[0];

          return `global::${enumInfo.fullName}.${csharpIdentifier(value)}`;
        },
        previewEvaluate({
          node,
          known
        }) {
          const enumInfo =
            selectedCatalogEnum(node);
          const names =
            enumInfo.values.map(value =>
              value.name
            );
          const configured =
            String(
              node.parameters?.enumValue ||
              ""
            );

          return known(
            catalogEnumGraphType(
              enumInfo.fullName
            ),
            names.includes(configured)
              ? configured
              : names[0]
          );
        }
      }
    );
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

    const BindingFlags flags =
        BindingFlags.Instance |
        BindingFlags.Public |
        BindingFlags.NonPublic |
        BindingFlags.IgnoreCase;

    Type sourceType = value.GetType();
    object? component =
        sourceType.GetField(memberName, flags)?.GetValue(value) ??
        sourceType.GetProperty(memberName, flags)?.GetValue(value);

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
      const body = api.emit("body");
      const done = api.emit("completed");
      return `for (${field} = 0; ${field} < Math.Max(0, ${api.input("count").code}); ${field}++)\n        {\n            ${body ? `${body}();` : "// No Body path."}\n        }${done ? `\n        ${done}();` : ""}`;
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
      const body = api.emit("body");
      const completed =
        api.emit("completed");

      return `${indexField} = 0;\nforeach (object? ${rawItem} in GraphEnumerateCollection(${api.input("collection").code}))\n        {\n            ${itemField} = GraphCollectionItem<${itemCsType}>(${rawItem});\n            ${body ? `${body}();` : "// No Body path."}\n            ${indexField}++;\n        }${completed ? `\n        ${completed}();` : ""}`;
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

        return `${field}.Clear();${
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

        return `${field}.Add(${valueInput.code});${
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
      const emit = api.emitMethod(
        api.node.id,
        "event"
      );
      if (!emit) return;
      api.addInitialize(
        `AppDomain.CurrentDomain.ProcessExit += (_, _) => ${emit}();`
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
      api.addField(
        `${api.node.id}.exception`,
        `private static Exception ${field} = null!;`
      );
      if (emit) {
        api.addInitialize(
          `AppDomain.CurrentDomain.UnhandledException += (_, args) =>\n        {\n            ${field} = args.ExceptionObject as Exception ?? new Exception(FormatValue(args.ExceptionObject));\n            ${emit}();\n        };`
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
      api.addField(
        `${api.node.id}.args`,
        `private static object?[] ${field} = Array.Empty<object?>();`
      );
      api.addMember(
        `${api.node.id}.callback`,
        `private static void ${callback}(object?[] arguments)\n{\n    ${field} = arguments;${emit ? `\n    ${emit}();` : ""}\n}`
      );
      api.addEngineInit(
        `SubscribeGraphEvent(${api.input("target").code}, ${api.input("eventName").code}, ${callback});`
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
      const emit = api.emitMethod(
        api.node.id,
        "tick"
      );
      api.addField(
        `${api.node.id}.timer`,
        `private static Timer? ${field};`
      );
      api.addMember(
        `${api.node.id}.startTimer`,
        `private static void StartTimer${token}(int interval)\n{\n    int safeInterval = Math.Max(1, interval);\n    ${field}?.Dispose();\n    ${field} = new Timer(_ => ${emit ? `${emit}()` : "{ }"}, null, safeInterval, safeInterval);\n}`
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
      ensureHarmonyRuntime(api);
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
        ? `\n    __result = ${field}.Result;`
        : "";

      api.addField(
        `${api.node.id}.context`,
        `private static PatchContext ${field} = new();`
      );

      let callbackCode;

      if (kind === "finalizer") {
        callbackCode = `private static Exception? ${callback}(\n    object? __instance,\n    object?[] __args,\n    MethodBase __originalMethod,\n    Exception? __exception${resultParameter})\n{\n    ${field} = new PatchContext\n    {\n        Instance = __instance,\n        Arguments = __args,\n        OriginalMethod = __originalMethod,\n        Exception = __exception${resultInitializer}\n    };${emit ? `\n    ${emit}();` : ""}${resultCommit}\n    return ${field}.Exception;\n}`;
      } else if (kind === "postfix") {
        callbackCode = `private static void ${callback}(\n    object? __instance,\n    object?[] __args,\n    MethodBase __originalMethod${resultParameter})\n{\n    ${field} = new PatchContext\n    {\n        Instance = __instance,\n        Arguments = __args,\n        OriginalMethod = __originalMethod${resultInitializer}\n    };${emit ? `\n    ${emit}();` : ""}${resultCommit}\n}`;
      } else {
        callbackCode = `private static bool ${callback}(\n    object? __instance,\n    object?[] __args,\n    MethodBase __originalMethod${resultParameter})\n{\n    ${field} = new PatchContext\n    {\n        Instance = __instance,\n        Arguments = __args,\n        OriginalMethod = __originalMethod${resultInitializer}\n    };${emit ? `\n    ${emit}();` : ""}${resultCommit}\n    return !${field}.SkipOriginal;\n}`;
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
      return `${api.input("type").code}.GetField(${api.input("name").code}, GraphAllMembers)!`;
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
      return `${api.input("type").code}.GetProperty(${api.input("name").code}, GraphAllMembers)!`;
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
      addStatefulField(
        api,
        "writeSuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_writeSuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_writeSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = WriteMember(${api.input("target").code}, ${api.input("name").code}, ${api.input("value").code});${done ? `\n        ${done}();` : ""}`;
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
      api.addField(
        `${api.node.id}.result`,
        `private static object? _invokeResult${token};`
      );
      api.addField(
        `${api.node.id}.error`,
        `private static Exception _invokeException${token} = null!;`
      );
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
      return `try\n        {\n            _invokeException${token} = null!;\n            _invokeResult${token} = InvokeMethodInfo(${api.input("method").code}, ${api.input("target").code}, ${api.input("arguments").code});\n        }\n        catch (Exception exception)\n        {\n            _invokeException${token} = exception;\n            _invokeResult${token} = null;\n        }${done ? `\n        ${done}();` : ""}`;
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
      addStatefulField(
        api,
        "callResult",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_callResult${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_callResult${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = InvokeBest(${api.input("target").code}, ${api.input("name").code}, ${api.input("arguments").code});${done ? `\n        ${done}();` : ""}`;
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
      addStatefulField(
        api,
        "createdInstance",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_createdInstance${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_createdInstance${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = CreateReflective(${api.input("type").code}, ${api.input("arguments").code});${done ? `\n        ${done}();` : ""}`;
    }
  });


  registerNode("resonite.currentEngine", {
    title: "Current Engine",
    group: "Slots & Components",
    symbol: "ENG",
    description:
      "Reads the actual FrooxEngine.Engine.Current instance.",
    outputs: [port("engine", "Engine", "engine")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression() {
      return "FrooxEngine.Engine.Current!";
    }
  });

  registerNode("resonite.userspaceWorld", {
    title: "Userspace World",
    group: "Slots & Components",
    symbol: "USR",
    description:
      "Gets the actual Userspace world from Engine.Current.WorldManager.",
    outputs: [port("world", "World", "world")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression() {
      return "FrooxEngine.Userspace.UserspaceWorld!";
    }
  });

  registerNode("resonite.focusedWorld", {
    title: "Focused World",
    group: "Slots & Components",
    symbol: "WRLD",
    description:
      "Gets the actual focused world, with Userspace as a fallback.",
    outputs: [port("world", "World", "world")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression() {
      return "(FrooxEngine.Engine.Current?.WorldManager?.FocusedWorld ?? FrooxEngine.Userspace.UserspaceWorld)!";
    }
  });

  registerNode("resonite.worldRootSlot", {
    title: "World Root Slot",
    group: "Slots & Components",
    symbol: "ROOT",
    description:
      "Gets World.RootSlot through the real FrooxEngine API.",
    inputs: [port("world", "World", "world")],
    outputs: [port("slot", "Root Slot", "slot")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      return `${api.input("world").code}.RootSlot`;
    }
  });

  registerNode("resonite.localUser", {
    title: "Local User",
    group: "Slots & Components",
    symbol: "ME",
    description:
      "Gets World.LocalUser through the real FrooxEngine API.",
    inputs: [port("world", "World", "world")],
    outputs: [port("user", "User", "user")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      return `${api.input("world").code}.LocalUser!`;
    }
  });

  registerNode("resonite.findSlot", {
    title: "Find Slot",
    group: "Slots & Components",
    symbol: "?S",
    description:
      "Finds a child slot recursively by name/path starting at Root.",
    inputs: [
      port("root", "Root", "slot"),
      port("name", "Name / path", "string")
    ],
    outputs: [port("slot", "Slot", "slot")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `(FrooxEngine.Slot)FindSlotRecursive(${api.input("root").code}, ${api.input("name").code})!`;
    }
  });

  registerNode("resonite.addSlot", {
    title: "Add Slot",
    group: "Slots & Components",
    symbol: "+S",
    description:
      "Creates a child Slot with Slot.AddSlot. With Parent unconnected it uses the focused World.RootSlot; connect a Slot explicitly to override the parent.",
    inputs: [
      port("call", "Call", "impulse"),
      port("parent", "Parent", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS }),
      port("name", "Name", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("slot", "Created Slot", "slot")
    ],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      addStatefulField(
        api,
        "createdSlot",
        "FrooxEngine.Slot?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_createdSlot${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_createdSlot${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = ${api.input("parent").code}.AddSlot(${api.input("name").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.destroyObject", {
    expertOnly: true,
    title: "Destroy Slot / Component",
    group: "Slots & Components",
    symbol: "DEL",
    description:
      "Calls Destroy, DestroyPersistent or Dispose on a reflected Resonite object.",
    inputs: [
      port("call", "Call", "impulse"),
      port("target", "Target", "object")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "destroySuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_destroySuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_destroySuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = DestroyReflective(${api.input("target").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.componentTypeConstant", {
    title: "Component Type Constant",
    group: "Values",
    symbol: "TYPE<C>",
    description:
      `Selects one of ${FROOX_COMPONENT_TYPES.length} concrete component types from the ${CATALOG_SOURCE_DESCRIPTION} for FrooxEngine ${componentCatalog.engineVersion} and emits its System.Type.`,
    parameters: [
      pText(
        "componentType",
        "Component type",
        "FrooxEngine.Grabbable",
        "Choose from the current live scanner catalog or its cached copy. No packaged static API fallback is used.",
        {
          suggestions: FROOX_COMPONENT_TYPES,
          placeholder: "FrooxEngine.Grabbable"
        }
      )
    ],
    outputs: [port("type", "Component Type", "type")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      return `typeof(${verifiedComponentType(api)})`;
    }
  });

  registerNode("resonite.getComponent", {
    title: "Get Component",
    group: "Slots & Components",
    symbol: "GETC",
    description:
      "Calls Slot.GetComponent(Type, exactTypeOnly) directly. It works with every concrete component type without reflection fallback code.",
    inputs: [
      port("slot", "Slot", "slot"),
      port("type", "Component Type", "type"),
      port("exact", "Exact Type Only", "bool", { defaultCs: "false" })
    ],
    outputs: [port("component", "Component", "component")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      return `${api.input("slot").code}.GetComponent(${api.input("type").code}, ${api.input("exact").code})!`;
    }
  });

  registerNode("resonite.getComponentInChildren", {
    title: "Get Component In Children",
    group: "Slots & Components",
    symbol: "GETC↓",
    description:
      "Calls Slot.GetComponentInChildren(Type) directly.",
    inputs: [
      port("slot", "Root Slot", "slot"),
      port("type", "Component Type", "type")
    ],
    outputs: [port("component", "Component", "component")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      return `${api.input("slot").code}.GetComponentInChildren(${api.input("type").code})!`;
    }
  });

  registerNode("resonite.attachComponent", {
    title: "Attach Component",
    group: "Attach & Create",
    symbol: "+C",
    description:
      "Calls Slot.AttachComponent(Type, runOnAttachBehavior) directly and therefore covers every valid concrete FrooxEngine Component type.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS }),
      port("type", "Component Type", "type"),
      port("runOnAttach", "Run OnAttach Behavior", "bool", { defaultCs: "true" })
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("component", "Component", "component"),
      port("success", "Success", "bool"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      addStatefulField(api, "attachedComponent", "FrooxEngine.Component?", "null");
      addStatefulField(api, "attachedComponentSuccess", "bool", "false");
      addStatefulField(api, "attachedComponentException", "System.Exception?", "null");
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      return {
        component: `_attachedComponent${token}!`,
        success: `_attachedComponentSuccess${token}`,
        exception: `_attachedComponentException${token}!`
      }[api.portId] || "null!";
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const component = `_attachedComponent${token}`;
      const success = `_attachedComponentSuccess${token}`;
      const exception = `_attachedComponentException${token}`;
      const done = api.emit("done");
      return `try\n        {\n            ${exception} = null;\n            ${component} = ${api.input("slot").code}.AttachComponent(${api.input("type").code}, ${api.input("runOnAttach").code});\n            ${success} = ${component} is not null;\n        }\n        catch (System.Exception caught)\n        {\n            ${exception} = caught;\n            ${component} = null;\n            ${success} = false;\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.getOrAttachComponent", {
    title: "Get Or Attach Component",
    group: "Attach & Create",
    symbol: "C?+",
    description:
      "Gets an existing component by Type or attaches it directly when missing.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS }),
      port("type", "Component Type", "type"),
      port("exact", "Exact Type Only", "bool", { defaultCs: "false" }),
      port("runOnAttach", "Run OnAttach Behavior", "bool", { defaultCs: "true" })
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("component", "Component", "component"),
      port("attached", "Was Attached", "bool"),
      port("success", "Success", "bool"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      addStatefulField(api, "getOrAttachComponent", "FrooxEngine.Component?", "null");
      addStatefulField(api, "getOrAttachWasAttached", "bool", "false");
      addStatefulField(api, "getOrAttachSuccess", "bool", "false");
      addStatefulField(api, "getOrAttachException", "System.Exception?", "null");
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      return {
        component: `_getOrAttachComponent${token}!`,
        attached: `_getOrAttachWasAttached${token}`,
        success: `_getOrAttachSuccess${token}`,
        exception: `_getOrAttachException${token}!`
      }[api.portId] || "null!";
    },
    codegenAction(api) {
      const token = nodeToken(api);
      const component = `_getOrAttachComponent${token}`;
      const attached = `_getOrAttachWasAttached${token}`;
      const success = `_getOrAttachSuccess${token}`;
      const exception = `_getOrAttachException${token}`;
      const slot = api.input("slot").code;
      const type = api.input("type").code;
      const done = api.emit("done");
      return `try\n        {\n            ${exception} = null;\n            ${component} = ${slot}.GetComponent(${type}, ${api.input("exact").code});\n            ${attached} = ${component} is null;\n            ${component} ??= ${slot}.AttachComponent(${type}, ${api.input("runOnAttach").code});\n            ${success} = ${component} is not null;\n        }\n        catch (System.Exception caught)\n        {\n            ${exception} = caught;\n            ${component} = null;\n            ${attached} = false;\n            ${success} = false;\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  function registerComponentTransferNode(
    id,
    title,
    symbol,
    methodName,
    description
  ) {
    registerNode(id, {
      title,
      group: "Attach & Create",
      symbol,
      description,
      inputs: [
        port("call", "Call", "impulse"),
        port("destination", "Destination Slot", "slot"),
        port("source", "Source Component", "component")
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("component", "Result Component", "component"),
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      ],
      codegenCollect(api) {
        ensureDirectResoniteCore(api);
        addStatefulField(api, `${id.replace(/[^A-Za-z0-9]/g, "")}Result`, "FrooxEngine.Component?", "null");
        addStatefulField(api, `${id.replace(/[^A-Za-z0-9]/g, "")}Success`, "bool", "false");
        addStatefulField(api, `${id.replace(/[^A-Za-z0-9]/g, "")}Exception`, "System.Exception?", "null");
      },
      codegenExpression(api) {
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        const token = nodeToken(api);
        return {
          component: `_${stem}Result${token}!`,
          success: `_${stem}Success${token}`,
          exception: `_${stem}Exception${token}!`
        }[api.portId] || "null!";
      },
      codegenAction(api) {
        const stem = id.replace(/[^A-Za-z0-9]/g, "");
        const token = nodeToken(api);
        const result = `_${stem}Result${token}`;
        const success = `_${stem}Success${token}`;
        const exception = `_${stem}Exception${token}`;
        const done = api.emit("done");
        return `try\n        {\n            ${exception} = null;\n            ${result} = ${api.input("destination").code}.${methodName}(${api.input("source").code});\n            ${success} = ${result} is not null;\n        }\n        catch (System.Exception caught)\n        {\n            ${exception} = caught;\n            ${result} = null;\n            ${success} = false;\n        }${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerComponentTransferNode(
    "resonite.copyComponent",
    "Copy Component",
    "COPY-C",
    "CopyComponent",
    "Copies a component to another Slot through Slot.CopyComponent(Component)."
  );

  registerComponentTransferNode(
    "resonite.moveComponent",
    "Move Component",
    "MOVE-C",
    "MoveComponent",
    "Moves a component to another Slot through Slot.MoveComponent(Component), preserving compatible references."
  );

  function graphComponentType(value) {
    const normalized = String(value || "").trim();
    const exact = new Map([
      ...MATERIAL_GRAPH_TYPES,
      ...MESH_GRAPH_TYPES,
      ["FrooxEngine.MeshRenderer", "meshRenderer"],
      ["MeshRenderer", "meshRenderer"],
      ["FrooxEngine.Collider", "collider"],
      ["Collider", "collider"],
      ["FrooxEngine.MeshCollider", "meshCollider"],
      ["MeshCollider", "meshCollider"],
      ["FrooxEngine.BoxCollider", "boxCollider"],
      ["BoxCollider", "boxCollider"],
      ["FrooxEngine.SphereCollider", "sphereCollider"],
      ["SphereCollider", "sphereCollider"],
      ["FrooxEngine.CylinderCollider", "cylinderCollider"],
      ["CylinderCollider", "cylinderCollider"],
      ["FrooxEngine.StaticTexture2D", "staticTexture2D"],
      ["StaticTexture2D", "staticTexture2D"],
      ["FrooxEngine.StaticCubemap", "staticCubemap"],
      ["StaticCubemap", "staticCubemap"],
      ["FrooxEngine.SpriteProvider", "spriteProvider"],
      ["SpriteProvider", "spriteProvider"],
      ["FrooxEngine.StaticAudioClip", "staticAudioClip"],
      ["StaticAudioClip", "staticAudioClip"],
      ["FrooxEngine.StaticFont", "staticFont"],
      ["StaticFont", "staticFont"],
      ["FrooxEngine.Skybox", "skybox"],
      ["Skybox", "skybox"],
      ["FrooxEngine.Grabbable", "grabbable"],
      ["Grabbable", "grabbable"],
      ["FrooxEngine.AudioOutput", "audioOutput"],
      ["AudioOutput", "audioOutput"],
      ["FrooxEngine.DynamicVariableSpace", "dynamicVariableSpace"],
      ["DynamicVariableSpace", "dynamicVariableSpace"],
      ["FrooxEngine.RadiantDash", "radiantDash"],
      ["RadiantDash", "radiantDash"]
    ]);

    return exact.get(normalized) || "component";
  }

  function ensureRuntimeEnumHelpers(api) {
    ensureDirectResoniteCore(api);
    api.addMember(
      "direct.runtime.enums",
      String.raw`
private static Primitive GraphPrimitiveFromValue(object? value)
{
    if (value is Primitive primitive)
    {
        return primitive;
    }

    return Enum.TryParse(
        Convert.ToString(value, CultureInfo.InvariantCulture),
        ignoreCase: true,
        out Primitive parsed)
            ? parsed
            : Primitive.Cube;
}

private static BlendMode GraphBlendModeFromValue(object? value)
{
    if (value is BlendMode blendMode)
    {
        return blendMode;
    }

    return Enum.TryParse(
        Convert.ToString(value, CultureInfo.InvariantCulture),
        ignoreCase: true,
        out BlendMode parsed)
            ? parsed
            : BlendMode.Opaque;
}
`
    );
  }

  registerNode("resonite.primitiveConstant", {
    title: "Primitive Constant",
    group: "Values",
    symbol: "PRIM",
    description:
      "A real FrooxEngine.Primitive value for Quad, Cube or Sphere.",
    parameters: [
      pSelect(
        "value",
        "Primitive",
        ["Quad", "Cube", "Sphere"],
        "Cube"
      )
    ],
    outputs: [port("value", "Primitive", "primitive")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      const value = ["Quad", "Cube", "Sphere"].includes(
        api.node.parameters?.value
      )
        ? api.node.parameters.value
        : "Cube";
      return `FrooxEngine.Primitive.${value}`;
    },
    previewEvaluate({ node, known }) {
      return known(
        "primitive",
        String(node.parameters?.value || "Cube")
      );
    }
  });

  registerNode("resonite.primitiveFromValue", {
    title: "Value To Primitive",
    group: "Conversions",
    symbol: "→PRIM",
    description:
      "Converts a configuration enum or text value named Quad, Cube or Sphere into the real FrooxEngine.Primitive enum.",
    inputs: [
      genericPort(
        "value",
        "Enum / text",
        "T",
        "enumOrString"
      )
    ],
    outputs: [port("primitive", "Primitive", "primitive")],
    codegenCollect(api) {
      ensureRuntimeEnumHelpers(api);
    },
    codegenExpression(api) {
      return `GraphPrimitiveFromValue(${api.input("value").code})`;
    }
  });

  registerNode("material.blendModeConstant", {
    title: "Blend Mode Constant",
    group: "Values",
    symbol: "BLEND",
    description:
      "A real FrooxEngine.BlendMode value.",
    parameters: [
      pSelect(
        "value",
        "Blend mode",
        [
          "Opaque",
          "Cutout",
          "Alpha",
          "Transparent",
          "Additive",
          "Multiply"
        ],
        "Opaque"
      )
    ],
    outputs: [port("value", "Blend Mode", "blendMode")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      const modes = [
        "Opaque",
        "Cutout",
        "Alpha",
        "Transparent",
        "Additive",
        "Multiply"
      ];
      const value = modes.includes(api.node.parameters?.value)
        ? api.node.parameters.value
        : "Opaque";
      return `FrooxEngine.BlendMode.${value}`;
    }
  });

  registerNode("material.blendModeFromValue", {
    title: "Value To Blend Mode",
    group: "Conversions",
    symbol: "→BLEND",
    description:
      "Converts a configuration enum or text to FrooxEngine.BlendMode.",
    inputs: [
      genericPort(
        "value",
        "Enum / text",
        "T",
        "enumOrString"
      )
    ],
    outputs: [port("blendMode", "Blend Mode", "blendMode")],
    codegenCollect(api) {
      ensureRuntimeEnumHelpers(api);
    },
    codegenExpression(api) {
      return `GraphBlendModeFromValue(${api.input("value").code})`;
    }
  });

  registerNode("asset.textureWrapModeConstant", {
    title: "Texture Wrap Mode Constant",
    group: "Values",
    symbol: "WRAP",
    description:
      "A real Renderite.Shared.TextureWrapMode value.",
    parameters: [
      pSelect(
        "value",
        "Wrap mode",
        ["Repeat", "Clamp"],
        "Repeat"
      )
    ],
    outputs: [
      port("value", "Wrap Mode", "textureWrapMode")
    ],
    codegenCollect(api) {
      api.addUsing("Renderite.Shared");
      api.require("usesRenderiteShared", true);
    },
    codegenExpression(api) {
      const values = ["Repeat", "Clamp"];
      const value = values.includes(api.node.parameters?.value)
        ? api.node.parameters.value
        : "Repeat";
      return `Renderite.Shared.TextureWrapMode.${value}`;
    }
  });

  registerNode("transform.quaternionIdentity", {
    title: "Quaternion Identity",
    group: "Transforms",
    symbol: "Q1",
    description:
      "Elements.Core.floatQ.Identity.",
    outputs: [port("rotation", "Rotation", "floatQ")],
    codegenCollect(api) {
      ensureDirectResoniteMath(api);
    },
    codegenExpression() {
      return "Elements.Core.floatQ.Identity";
    },
    previewEvaluate({ known }) {
      return known("floatQ", "Identity");
    }
  });

  registerNode("transform.rotateVector", {
    title: "Rotate Vector",
    group: "Transforms",
    symbol: "Q×V",
    description:
      "Rotates a float3 by a floatQ using the real Elements.Core operator.",
    inputs: [
      port("rotation", "Rotation", "floatQ"),
      port("vector", "Vector", "float3")
    ],
    outputs: [port("result", "Result", "float3")],
    codegenCollect(api) {
      ensureDirectResoniteMath(api);
    },
    codegenExpression(api) {
      return `(${api.input("rotation").code} * ${api.input("vector").code})`;
    }
  });

  registerNode("transform.multiplyQuaternion", {
    title: "Multiply Quaternions",
    group: "Transforms",
    symbol: "Q×Q",
    description:
      "Combines two floatQ rotations.",
    inputs: [
      port("a", "A", "floatQ"),
      port("b", "B", "floatQ")
    ],
    outputs: [port("result", "Result", "floatQ")],
    codegenCollect(api) {
      ensureDirectResoniteMath(api);
    },
    codegenExpression(api) {
      return `(${api.input("a").code} * ${api.input("b").code})`;
    }
  });

  registerNode("resonite.userRootSlot", {
    title: "User Root Slot",
    group: "Slots & Components",
    symbol: "UROOT",
    description:
      "Returns User.Root.Slot from the actual Resonite User.",
    inputs: [port("user", "User", "user")],
    outputs: [port("slot", "Root Slot", "slot")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      return `(${api.input("user").code}.Root?.Slot ?? null!)`;
    }
  });

  registerNode("resonite.slotWorld", {
    title: "Slot World",
    group: "Slots & Components",
    symbol: "S→W",
    description:
      "Returns Slot.World.",
    inputs: [port("slot", "Slot", "slot")],
    outputs: [port("world", "World", "world")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      return `${api.input("slot").code}.World`;
    }
  });

  registerNode("resonite.slotParent", {
    title: "Slot Parent",
    group: "Slots & Components",
    symbol: "S↑",
    description:
      "Returns Slot.Parent.",
    inputs: [port("slot", "Slot", "slot")],
    outputs: [port("parent", "Parent", "slot")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      return `${api.input("slot").code}.Parent!`;
    }
  });

  registerNode("resonite.isSlotValid", {
    title: "Is Slot Valid",
    group: "Slots & Components",
    symbol: "S?",
    description:
      "True when the Slot exists, is not destroyed and still has a World.",
    inputs: [port("slot", "Slot", "slot")],
    outputs: [port("valid", "Valid", "bool")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      api.addMember(
        "typed.resonite.validity",
        `private static bool IsGraphSlotValid(FrooxEngine.Slot? slot)
{
    return slot is not null && !slot.IsDestroyed && slot.World is not null;
}

private static bool IsGraphComponentValid(FrooxEngine.Component? component)
{
    return component is not null && !component.IsDestroyed;
}`
      );
    },
    codegenExpression(api) {
      return `IsGraphSlotValid(${api.input("slot").code})`;
    }
  });

  registerNode("resonite.isComponentValid", {
    title: "Is Component Valid",
    group: "Slots & Components",
    symbol: "C?",
    description:
      "True when the Component exists and is not destroyed.",
    inputs: [port("component", "Component", "component")],
    outputs: [port("valid", "Valid", "bool")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      api.addMember(
        "typed.resonite.validity",
        `private static bool IsGraphSlotValid(FrooxEngine.Slot? slot)
{
    return slot is not null && !slot.IsDestroyed && slot.World is not null;
}

private static bool IsGraphComponentValid(FrooxEngine.Component? component)
{
    return component is not null && !component.IsDestroyed;
}`
      );
    },
    codegenExpression(api) {
      return `IsGraphComponentValid(${api.input("component").code})`;
    }
  });

  registerNode("resonite.addLocalSlot", {
    title: "Add Local Slot",
    group: "Slots & Components",
    symbol: "+LS",
    description:
      "Creates a local Slot with Slot.AddLocalSlot.",
    inputs: [
      port("call", "Call", "impulse"),
      port("parent", "Parent", "slot"),
      port("name", "Name", "string"),
      port("persistent", "Persistent", "bool", { defaultCs: "false" })
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("slot", "Created Slot", "slot")
    ],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      addStatefulField(
        api,
        "createdLocalSlot",
        "FrooxEngine.Slot?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_createdLocalSlot${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_createdLocalSlot${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = ${api.input("parent").code}.AddLocalSlot(${api.input("name").code}, ${api.input("persistent").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.destroySlot", {
    title: "Destroy Slot",
    group: "Slots & Components",
    symbol: "DEL-S",
    description:
      "Destroys a typed FrooxEngine.Slot directly.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      const slot = api.input("slot").code;
      return `if (${slot} is not null && !${slot}.IsDestroyed)\n        {\n            ${slot}.Destroy();\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.destroyComponent", {
    title: "Destroy Component",
    group: "Slots & Components",
    symbol: "DEL-C",
    description:
      "Destroys a typed FrooxEngine.Component directly.",
    inputs: [
      port("call", "Call", "impulse"),
      port("component", "Component", "component")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      const component = api.input("component").code;
      return `if (${component} is not null && !${component}.IsDestroyed)\n        {\n            ${component}.Destroy();\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.setSlotName", {
    title: "Set Slot Name",
    group: "Slots & Components",
    symbol: "NAME",
    description:
      "Sets Slot.Name directly.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot"),
      port("name", "Name", "string")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("slot").code}.Name = ${api.input("name").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.setSlotActive", {
    title: "Set Slot Active",
    group: "Slots & Components",
    symbol: "ACTIVE",
    description:
      "Sets Slot.ActiveSelf directly.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot"),
      port("active", "Active", "bool")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("slot").code}.ActiveSelf = ${api.input("active").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.setSlotParent", {
    title: "Set Slot Parent",
    group: "Slots & Components",
    symbol: "PARENT",
    description:
      "Calls Slot.SetParent with optional global-transform preservation.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot"),
      port("parent", "New Parent", "slot"),
      port("keepGlobal", "Keep Global Transform", "bool", { defaultCs: "true" })
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("slot").code}.SetParent(${api.input("parent").code}, ${api.input("keepGlobal").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  function registerSlotTransformSetter(
    id,
    title,
    symbol,
    member,
    valueType,
    valueLabel
  ) {
    registerNode(id, {
      title,
      group: "Transforms",
      symbol,
      description:
        `Sets Slot.${member} directly without changing the other transform channels.`,
      inputs: [
        port("call", "Call", "impulse"),
        port("slot", "Slot", "slot"),
        port("value", valueLabel, valueType)
      ],
      outputs: [port("done", "Done", "impulse")],
      codegenCollect(api) {
        ensureDirectResoniteCore(api);
      },
      codegenAction(api) {
        const done = api.emit("done");
        return `${api.input("slot").code}.${member} = ${api.input("value").code};${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerSlotTransformSetter(
    "transform.setLocalPosition",
    "Set Slot Local Position",
    "LPOS=",
    "LocalPosition",
    "float3",
    "Position"
  );
  registerSlotTransformSetter(
    "transform.setLocalRotation",
    "Set Slot Local Rotation",
    "LROT=",
    "LocalRotation",
    "floatQ",
    "Rotation"
  );
  registerSlotTransformSetter(
    "transform.setLocalScale",
    "Set Slot Local Scale",
    "LSCL=",
    "LocalScale",
    "float3",
    "Scale"
  );
  registerSlotTransformSetter(
    "transform.setGlobalPosition",
    "Set Slot Global Position",
    "GPOS=",
    "GlobalPosition",
    "float3",
    "Position"
  );
  registerSlotTransformSetter(
    "transform.setGlobalRotation",
    "Set Slot Global Rotation",
    "GROT=",
    "GlobalRotation",
    "floatQ",
    "Rotation"
  );
  registerSlotTransformSetter(
    "transform.setGlobalScale",
    "Set Slot Global Scale",
    "GSCL=",
    "GlobalScale",
    "float3",
    "Scale"
  );

  function registerSlotTransformReader(
    id,
    title,
    symbol,
    prefix
  ) {
    registerNode(id, {
      title,
      group: "Transforms",
      symbol,
      description:
        `Reads Slot.${prefix}Position, ${prefix}Rotation and ${prefix}Scale.`,
      inputs: [port("slot", "Slot", "slot")],
      outputs: [
        port("position", "Position", "float3", { defaultCs: "Elements.Core.float3.Zero" }),
        port("rotation", "Rotation", "floatQ", { defaultCs: "Elements.Core.floatQ.Identity" }),
        port("scale", "Scale", "float3", { defaultCs: "Elements.Core.float3.One" })
      ],
      codegenCollect(api) {
        ensureDirectResoniteMath(api);
      },
      codegenExpression(api) {
        const member = {
          position: `${prefix}Position`,
          rotation: `${prefix}Rotation`,
          scale: `${prefix}Scale`
        }[api.portId];
        return `${api.input("slot").code}.${member}`;
      }
    });
  }

  registerSlotTransformReader(
    "transform.readLocalSlot",
    "Read Local Slot Transform",
    "L-TRS",
    "Local"
  );

  registerSlotTransformReader(
    "transform.readGlobalSlot",
    "Read Global Slot Transform",
    "G-TRS",
    "Global"
  );

  function registerSlotTransformWriter(
    id,
    title,
    symbol,
    prefix
  ) {
    registerNode(id, {
      title,
      group: "Transforms",
      symbol,
      description:
        `Writes Slot.${prefix}Position, ${prefix}Rotation and ${prefix}Scale directly.`,
      inputs: [
        port("call", "Call", "impulse"),
        port("slot", "Slot", "slot"),
        port("position", "Position", "float3", { defaultCs: "Elements.Core.float3.Zero" }),
        port("rotation", "Rotation", "floatQ", { defaultCs: "Elements.Core.floatQ.Identity" }),
        port("scale", "Scale", "float3", { defaultCs: "Elements.Core.float3.One" })
      ],
      outputs: [port("done", "Done", "impulse")],
      codegenCollect(api) {
        ensureDirectResoniteMath(api);
      },
      codegenAction(api) {
        const done = api.emit("done");
        const slot = api.input("slot").code;
        return `${slot}.${prefix}Position = ${api.input("position").code};\n        ${slot}.${prefix}Rotation = ${api.input("rotation").code};\n        ${slot}.${prefix}Scale = ${api.input("scale").code};${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerSlotTransformWriter(
    "transform.writeLocalSlot",
    "Set Local Slot Transform",
    "→L-TRS",
    "Local"
  );

  registerSlotTransformWriter(
    "transform.writeGlobalSlot",
    "Set Global Slot Transform",
    "→G-TRS",
    "Global"
  );

  registerNode("task.dispatchWorld", {
    title: "Dispatch To World",
    group: "Tasks & Threading",
    symbol: "WORLD↯",
    description:
      "Schedules the connected impulse path on World.Coroutines and awaits ToWorld before mutating Resonite state.",
    inputs: [
      port("call", "Call", "impulse"),
      port("world", "World", "world"),
      port(
        "requireFocused",
        "Require Still Focused",
        "bool",
        { defaultCs: "false" }
      )
    ],
    outputs: [port("done", "On World Thread", "impulse")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      const token = nodeToken(api);
      const world = `world${token}`;
      return `FrooxEngine.World ${world} = ${api.input("world").code};\n        if (${world} is not null && !${world}.IsDisposed)\n        {\n            ${world}.Coroutines.StartTask(\n                async delegate\n                {\n                    await default(FrooxEngine.ToWorld);\n\n                    if (\n                        !${world}.IsDisposed &&\n                        (\n                            !${api.input("requireFocused").code} ||\n                            ReferenceEquals(\n                                FrooxEngine.Engine.Current?.WorldManager?.FocusedWorld,\n                                ${world})\n                        )\n                    )\n                    {${done ? `\n                        ${done}();` : ""}\n                    }\n                });\n        }`;
    }
  });

  registerNode("task.dispatchWorldLatest", {
    title: "Dispatch Latest To World",
    group: "Tasks & Threading",
    symbol: "WORLD↯1",
    description:
      "Coalesces repeated calls, switches to the World thread with ToWorld and runs the newest requested state once more when calls arrived while an update was pending.",
    inputs: [
      port("call", "Call", "impulse"),
      port("world", "World", "world"),
      port(
        "requireFocused",
        "Require Still Focused",
        "bool",
        { defaultCs: "true" }
      )
    ],
    outputs: [port("done", "On World Thread", "impulse")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      api.addUsing("System.Threading");
      const token = nodeToken(api);
      const emit = api.emitMethod(
        api.node.id,
        "done"
      );
      api.addField(
        `${api.node.id}.latestWorld`,
        `private static FrooxEngine.World? _latestWorld${token};`
      );
      api.addField(
        `${api.node.id}.latestRequireFocused`,
        `private static bool _latestRequireFocused${token};`
      );
      api.addField(
        `${api.node.id}.latestVersion`,
        `private static int _latestWorldVersion${token};`
      );
      api.addField(
        `${api.node.id}.latestPending`,
        `private static int _latestWorldPending${token};`
      );
      api.addMember(
        `${api.node.id}.latestDispatcher`,
        `private static void RequestLatestWorld${token}(FrooxEngine.World world, bool requireFocused)\n{\n    _latestWorld${token} = world;\n    _latestRequireFocused${token} = requireFocused;\n    Interlocked.Increment(ref _latestWorldVersion${token});\n    ScheduleLatestWorld${token}();\n}\n\nprivate static void ScheduleLatestWorld${token}()\n{\n    FrooxEngine.World? world = _latestWorld${token};\n\n    if (world is null || world.IsDisposed)\n    {\n        return;\n    }\n\n    if (Interlocked.Exchange(ref _latestWorldPending${token}, 1) != 0)\n    {\n        return;\n    }\n\n    int scheduledVersion = Volatile.Read(ref _latestWorldVersion${token});\n\n    world.Coroutines.StartTask(\n        async delegate\n        {\n            await default(FrooxEngine.ToWorld);\n\n            try\n            {\n                if (\n                    !world.IsDisposed &&\n                    (\n                        !_latestRequireFocused${token} ||\n                        ReferenceEquals(\n                            FrooxEngine.Engine.Current?.WorldManager?.FocusedWorld,\n                            world)\n                    )\n                )\n                {${emit ? `\n                    ${emit}();` : ""}\n                }\n            }\n            finally\n            {\n                Volatile.Write(ref _latestWorldPending${token}, 0);\n\n                if (\n                    scheduledVersion !=\n                    Volatile.Read(ref _latestWorldVersion${token})\n                )\n                {\n                    ScheduleLatestWorld${token}();\n                }\n            }\n        });\n}`
      );
    },
    codegenAction(api) {
      const token = nodeToken(api);
      return `RequestLatestWorld${token}(${api.input("world").code}, ${api.input("requireFocused").code});`;
    }
  });

  registerNode("resonite.getComponentTyped", {
    expertOnly: true,
    title: "Get Component (Typed)",
    group: "Slots & Components",
    symbol: "GET<T>",
    description:
      "Generates Slot.GetComponent<T>() directly. The inspector type name is compile-time C#, not runtime reflection.",
    parameters: [
      pText(
        "componentType",
        "Component type",
        "FrooxEngine.PBS_Metallic",
        "Verified fully-qualified FrooxEngine component type.",
        { suggestions: FROOX_COMPONENT_TYPES }
      )
    ],
    resolveDefinition(node) {
      return {
        outputs: [
          port(
            "component",
            "Component",
            graphComponentType(
              node.parameters?.componentType
            )
          )
        ]
      };
    },
    inputs: [port("slot", "Slot", "slot")],
    outputs: [port("component", "Component", "component")],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
    },
    codegenExpression(api) {
      const componentType = verifiedComponentType(api);
      return `${api.input("slot").code}.GetComponent<${componentType}>()!`;
    }
  });

  registerNode("resonite.attachComponentTyped", {
    expertOnly: true,
    title: "Attach Component (Typed)",
    group: "Attach & Create",
    symbol: "+C<T>",
    description:
      "Generates Slot.AttachComponent<T>() directly and covers every concrete FrooxEngine Component type with a public parameterless constructor.",
    parameters: [
      pText(
        "componentType",
        "Component type",
        "FrooxEngine.Grabbable",
        "Verified fully-qualified FrooxEngine component type.",
        { suggestions: FROOX_COMPONENT_TYPES }
      )
    ],
    resolveDefinition(node) {
      return {
        outputs: [
          port("done", "Done", "impulse"),
          port(
            "component",
            "Component",
            graphComponentType(
              node.parameters?.componentType
            )
          )
        ]
      };
    },
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS })
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("component", "Component", "component")
    ],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      const componentType = verifiedComponentType(api);
      addStatefulField(
        api,
        "typedComponent",
        `${componentType}?`,
        "null"
      );
    },
    codegenExpression(api) {
      return `_typedComponent${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const componentType = verifiedComponentType(api);
      const field = `_typedComponent${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = ${api.input("slot").code}.AttachComponent<${componentType}>();${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.ensureGrabbable", {
    title: "Ensure Grabbable",
    group: "Attach & Create",
    symbol: "GRAB",
    description:
      "Returns an existing Grabbable or attaches one directly.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS })
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("grabbable", "Grabbable", "grabbable")
    ],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      addStatefulField(
        api,
        "grabbable",
        "FrooxEngine.Grabbable?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_grabbable${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_grabbable${nodeToken(api)}`;
      const slot = api.input("slot").code;
      const done = api.emit("done");
      return `${field} = ${slot}.GetComponent<FrooxEngine.Grabbable>() ?? ${slot}.AttachComponent<FrooxEngine.Grabbable>();${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("material.setCommonColor", {
    title: "Set Common Material Color",
    group: "Materials & Rendering",
    symbol: "MAT=C",
    description:
      "Sets ICommonMaterial.Color directly.",
    inputs: [
      port("call", "Call", "impulse"),
      port("material", "Material", "commonMaterial"),
      port("color", "Color", "colorX")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureDirectResoniteRendering(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `${api.input("material").code}.Color = ${api.input("color").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("material.setPbsMetallic", {
    title: "Set PBS Metallic",
    group: "Materials & Rendering",
    symbol: "PBS=",
    description:
      "Sets AlbedoColor, Metallic, Smoothness and BlendMode on a real PBS_Metallic component.",
    inputs: [
      port("call", "Call", "impulse"),
      port("material", "PBS Metallic", "pbsMetallic"),
      port("albedo", "Albedo Color", "colorX", { defaultCs: "colorX.White" }),
      port("metallic", "Metallic", "float", { defaultCs: "0.05f" }),
      port("smoothness", "Smoothness", "float", { defaultCs: "0.65f" }),
      port("blendMode", "Blend Mode", "blendMode", { defaultCs: "FrooxEngine.BlendMode.Opaque" })
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureDirectResoniteRendering(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      const material = api.input("material").code;
      return `${material}.AlbedoColor.Value = ${api.input("albedo").code};\n        ${material}.Metallic.Value = ${api.input("metallic").code};\n        ${material}.Smoothness.Value = ${api.input("smoothness").code};\n        ${material}.BlendMode.Value = ${api.input("blendMode").code};${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("attach.primitive", {
    title: "Attach Primitive",
    group: "Attach & Create",
    symbol: "+PRIM",
    description:
      "Calls Slot.AttachPrimitive<TMaterial>() directly. With Parent unconnected it creates under the focused World.RootSlot; connect a Slot explicitly to override the parent.",
    parameters: [materialTypeParameter(DEFAULT_MATERIAL_TYPE, true)],
    resolveDefinition(node) {
      return {
        outputs: [
          port("done", "Done", "impulse"),
          port("slot", "Created Slot", "slot"),
          port(
            "material",
            "Material",
            graphMaterialType(
              node.parameters?.materialType
            )
          ),
          port("mesh", "Mesh", "mesh"),
          port("renderer", "Renderer", "meshRenderer"),
          port("collider", "Collider", "collider"),
          port("success", "Success", "bool"),
          port("exception", "Exception", "exception")
        ]
      };
    },
    inputs: [
      port("call", "Call", "impulse"),
      port("parent", "Parent", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS }),
      port("primitive", "Primitive", "primitive", { defaultCs: "FrooxEngine.Primitive.Cube" }),
      port("scale", "Scale", "float3", { defaultCs: "Elements.Core.float3.One" }),
      port("color", "Color", "colorX", { defaultCs: "colorX.White" }),
      port("collider", "Collider", "bool", { defaultCs: "true" })
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("slot", "Created Slot", "slot"),
      port("material", "Material", "commonMaterial"),
      port("mesh", "Mesh", "mesh"),
      port("renderer", "Renderer", "meshRenderer"),
      port("collider", "Collider", "collider"),
      port("success", "Success", "bool"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      const materialType = directCommonMaterialType(api);
      attachResultFields(api, "attachPrimitive");
      addStatefulField(
        api,
        "attachPrimitiveMaterialTyped",
        `${materialType}?`,
        "null"
      );
    },
    codegenExpression(api) {
      if (api.portId === "material") {
        return `_attachPrimitiveMaterialTyped${nodeToken(api)}!`;
      }
      return attachOutputExpression(api, "attachPrimitive");
    },
    codegenAction(api) {
      const materialType = directCommonMaterialType(api);
      const token = nodeToken(api);
      const slot = `_attachPrimitiveSlot${token}`;
      const mesh = `_attachPrimitiveMesh${token}`;
      const material = `_attachPrimitiveMaterial${token}`;
      const materialTyped = `_attachPrimitiveMaterialTyped${token}`;
      const renderer = `_attachPrimitiveRenderer${token}`;
      const collider = `_attachPrimitiveCollider${token}`;
      const success = `_attachPrimitiveSuccess${token}`;
      const exception = `_attachPrimitiveException${token}`;
      const parent = api.input("parent").code;
      const primitive = api.input("primitive").code;
      const wantsCollider = api.input("collider").code;
      const done = api.emit("done");
      return `try\n        {\n            ${exception} = null;\n            ${slot} = ${parent}.AttachPrimitive<${materialType}>(\n                ${primitive},\n                ${api.input("scale").code},\n                ${api.input("color").code},\n                collider: ${wantsCollider});\n            ${materialTyped} = ${slot}.GetComponent<${materialType}>();\n            ${material} = ${materialTyped};\n            ${renderer} = ${slot}.GetComponent<FrooxEngine.MeshRenderer>();\n            ${mesh} = ${primitive} switch\n            {\n                FrooxEngine.Primitive.Quad => ${slot}.GetComponent<FrooxEngine.QuadMesh>(),\n                FrooxEngine.Primitive.Cube => ${slot}.GetComponent<FrooxEngine.BoxMesh>(),\n                FrooxEngine.Primitive.Sphere => ${slot}.GetComponent<FrooxEngine.SphereMesh>(),\n                _ => null\n            };\n            ${collider} = ${primitive} switch\n            {\n                FrooxEngine.Primitive.Quad => ${slot}.GetComponent<FrooxEngine.BoxCollider>(),\n                FrooxEngine.Primitive.Cube => ${slot}.GetComponent<FrooxEngine.BoxCollider>(),\n                FrooxEngine.Primitive.Sphere => ${slot}.GetComponent<FrooxEngine.SphereCollider>(),\n                _ => null\n            };\n            ${success} = ${slot} is not null && ${materialTyped} is not null && ${mesh} is not null && ${renderer} is not null && (!${wantsCollider} || ${collider} is not null);\n        }\n        catch (System.Exception caught)\n        {\n            ${exception} = caught;\n            ${slot} = null;\n            ${mesh} = null;\n            ${material} = null;\n            ${materialTyped} = null;\n            ${renderer} = null;\n            ${collider} = null;\n            ${success} = false;\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("attach.mesh", {
    title: "Attach Mesh",
    group: "Attach & Create",
    symbol: "+MESH",
    description:
      "Covers every Slot.AttachMesh overload: existing mesh/material providers, generated mesh/material components, renderer, optional MeshCollider and sorting order.",
    parameters: [
      meshTypeParameter(),
      materialTypeParameter(),
      pBool(
        "applyColor",
        "Apply color when material supports ICommonMaterial",
        false
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS }),
      port("existingMesh", "Existing Mesh (optional)", "mesh"),
      port("existingMaterial", "Existing Material (optional)", "material"),
      port("collider", "Mesh Collider", "bool", { defaultCs: "false" }),
      port("sortingOrder", "Sorting Order", "int", { defaultCs: "0" }),
      port("color", "Color", "colorX", { defaultCs: "colorX.White" })
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("slot", "Slot", "slot"),
      port("mesh", "Mesh", "mesh"),
      port("material", "Material", "material"),
      port("renderer", "Renderer", "meshRenderer"),
      port("collider", "Mesh Collider", "meshCollider"),
      port("success", "Success", "bool"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      attachResultFields(
        api,
        "attachMesh",
        "FrooxEngine.IAssetProvider<FrooxEngine.Mesh>",
        "FrooxEngine.MeshCollider"
      );
    },
    codegenExpression(api) {
      return attachOutputExpression(api, "attachMesh");
    },
    codegenAction(api) {
      const meshType = directMeshType(api);
      const materialType = directMaterialType(api);
      const token = nodeToken(api);
      const slotField = `_attachMeshSlot${token}`;
      const meshField = `_attachMeshMesh${token}`;
      const materialField = `_attachMeshMaterial${token}`;
      const rendererField = `_attachMeshRenderer${token}`;
      const colliderField = `_attachMeshCollider${token}`;
      const successField = `_attachMeshSuccess${token}`;
      const exceptionField = `_attachMeshException${token}`;
      const slot = api.input("slot").code;
      const suppliedMesh = api.input("existingMesh").code;
      const suppliedMaterial = api.input("existingMaterial").code;
      const collider = api.input("collider").code;
      const sortingOrder = api.input("sortingOrder").code;
      const color = api.input("color").code;
      const applyColor = api.node.parameters?.applyColor === true;
      const done = api.emit("done");
      return `try\n        {\n            ${exceptionField} = null;\n            ${slotField} = ${slot};\n            FrooxEngine.IAssetProvider<FrooxEngine.Mesh>? suppliedMesh${token} = ${suppliedMesh};\n            FrooxEngine.IAssetProvider<FrooxEngine.Material>? suppliedMaterial${token} = ${suppliedMaterial};\n\n            if (suppliedMesh${token} is not null && suppliedMaterial${token} is not null)\n            {\n                ${rendererField} = ${slot}.AttachMesh(suppliedMesh${token}, suppliedMaterial${token}, ${sortingOrder});\n                ${meshField} = suppliedMesh${token};\n                ${materialField} = suppliedMaterial${token};\n                if (${collider})\n                {\n                    ${colliderField} = ${slot}.AttachComponent<FrooxEngine.MeshCollider>();\n                    ${colliderField}.Mesh.Target = suppliedMesh${token};\n                }\n                else\n                {\n                    ${colliderField} = null;\n                }\n            }\n            else if (suppliedMaterial${token} is not null)\n            {\n                ${meshType} createdMesh${token} = ${slot}.AttachMesh<${meshType}>(suppliedMaterial${token}, out FrooxEngine.MeshRenderer createdRenderer${token}, ${collider}, ${sortingOrder});\n                ${meshField} = createdMesh${token};\n                ${materialField} = suppliedMaterial${token};\n                ${rendererField} = createdRenderer${token};\n                ${colliderField} = ${slot}.GetComponent<FrooxEngine.MeshCollider>();\n            }\n            else if (suppliedMesh${token} is not null)\n            {\n                ${materialType} createdMaterial${token} = ${slot}.AttachMesh<${materialType}>(suppliedMesh${token}, ${collider}, ${sortingOrder});\n                ${meshField} = suppliedMesh${token};\n                ${materialField} = createdMaterial${token};\n                ${rendererField} = ${slot}.GetComponent<FrooxEngine.MeshRenderer>();\n                ${colliderField} = ${slot}.GetComponent<FrooxEngine.MeshCollider>();\n            }\n            else\n            {\n                FrooxEngine.AttachedModel<${meshType}, ${materialType}> model${token} = ${slot}.AttachMesh<${meshType}, ${materialType}>(${collider}, ${sortingOrder});\n                ${meshField} = model${token}.mesh;\n                ${materialField} = model${token}.material;\n                ${rendererField} = model${token}.renderer;\n                ${colliderField} = model${token}.collider;\n            }\n${applyColor ? `\n            if (${materialField} is FrooxEngine.ICommonMaterial commonMaterial${token})\n            {\n                commonMaterial${token}.Color = ${color};\n            }\n` : ""}\n            ${successField} = ${meshField} is not null && ${materialField} is not null && ${rendererField} is not null && (!${collider} || ${colliderField} is not null);\n        }\n        catch (System.Exception caught)\n        {\n            ${exceptionField} = caught;\n            ${meshField} = null;\n            ${materialField} = null;\n            ${rendererField} = null;\n            ${colliderField} = null;\n            ${successField} = false;\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  function registerShapeAttachNode(specification) {
    registerNode(specification.id, {
      title: specification.title,
      group: "Attach & Create",
      symbol: specification.symbol,
      description: specification.description,
      parameters: [materialTypeParameter()],
      inputs: [
        port("call", "Call", "impulse"),
        port("slot", "Slot", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS }),
        port("material", "Existing Material (optional)", "material"),
        ...specification.inputs,
        ...(specification.supportsCollider
          ? [port("collider", "Collider", "bool", { defaultCs: "true" })]
          : [])
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("slot", "Slot", "slot"),
        port("mesh", "Mesh", specification.meshGraphType),
        port("material", "Material", "material"),
        port("renderer", "Renderer", "meshRenderer"),
        port("collider", "Collider", "collider"),
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      ],
      codegenCollect(api) {
        attachResultFields(
          api,
          specification.fieldPrefix,
          specification.meshCsType
        );
      },
      codegenExpression(api) {
        return attachOutputExpression(
          api,
          specification.fieldPrefix
        );
      },
      codegenAction(api) {
        const materialType = directMaterialType(api);
        const token = nodeToken(api);
        const prefix = specification.fieldPrefix;
        const slotField = `_${prefix}Slot${token}`;
        const meshField = `_${prefix}Mesh${token}`;
        const materialField = `_${prefix}Material${token}`;
        const rendererField = `_${prefix}Renderer${token}`;
        const colliderField = `_${prefix}Collider${token}`;
        const successField = `_${prefix}Success${token}`;
        const exceptionField = `_${prefix}Exception${token}`;
        const slot = api.input("slot").code;
        const suppliedMaterial = api.input("material").code;
        const collider = specification.supportsCollider
          ? api.input("collider").code
          : "false";
        const done = api.emit("done");
        const existingCall = specification.existingCall(
          api,
          slot,
          `suppliedMaterial${token}`,
          collider
        );
        const genericCall = specification.genericCall(
          api,
          slot,
          materialType,
          collider
        );

        return `try\n        {\n            ${exceptionField} = null;\n            ${slotField} = ${slot};\n            FrooxEngine.IAssetProvider<FrooxEngine.Material>? suppliedMaterial${token} = ${suppliedMaterial};\n\n            if (suppliedMaterial${token} is not null)\n            {\n                ${meshField} = ${existingCall};\n                ${materialField} = suppliedMaterial${token};\n            }\n            else\n            {\n                ${meshField} = ${genericCall};\n                ${materialField} = ${slot}.GetComponent<${materialType}>();\n            }\n\n            ${rendererField} = ${slot}.GetComponent<FrooxEngine.MeshRenderer>();\n            ${colliderField} = ${slot}.GetComponent<FrooxEngine.Collider>();\n            ${successField} = ${meshField} is not null && ${materialField} is not null && ${rendererField} is not null && (!${collider} || ${colliderField} is not null);\n        }\n        catch (System.Exception caught)\n        {\n            ${exceptionField} = caught;\n            ${meshField} = null;\n            ${materialField} = null;\n            ${rendererField} = null;\n            ${colliderField} = null;\n            ${successField} = false;\n        }${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerShapeAttachNode({
    id: "attach.quad",
    title: "Attach Quad",
    symbol: "+QUAD",
    description:
      "Covers both Slot.AttachQuad overloads with an existing or newly created material.",
    fieldPrefix: "attachQuad",
    meshGraphType: "quadMesh",
    meshCsType: "FrooxEngine.QuadMesh",
    supportsCollider: true,
    inputs: [port("size", "Size", "float2", { defaultCs: "new Elements.Core.float2(1f, 1f)" })],
    existingCall: (api, slot, material, collider) =>
      `${slot}.AttachQuad(${api.input("size").code}, ${material}, ${collider})`,
    genericCall: (api, slot, materialType, collider) =>
      `${slot}.AttachQuad<${materialType}>(${api.input("size").code}, ${collider})`
  });

  registerShapeAttachNode({
    id: "attach.box",
    title: "Attach Box",
    symbol: "+BOX",
    description:
      "Covers both Slot.AttachBox overloads with an existing or newly created material.",
    fieldPrefix: "attachBox",
    meshGraphType: "boxMesh",
    meshCsType: "FrooxEngine.BoxMesh",
    supportsCollider: true,
    inputs: [port("size", "Size", "float3", { defaultCs: "Elements.Core.float3.One" })],
    existingCall: (api, slot, material, collider) =>
      `${slot}.AttachBox(${api.input("size").code}, ${material}, ${collider})`,
    genericCall: (api, slot, materialType, collider) =>
      `${slot}.AttachBox<${materialType}>(${api.input("size").code}, ${collider})`
  });

  registerShapeAttachNode({
    id: "attach.sphere",
    title: "Attach Sphere",
    symbol: "+SPH",
    description:
      "Covers both Slot.AttachSphere overloads with an existing or newly created material.",
    fieldPrefix: "attachSphere",
    meshGraphType: "sphereMesh",
    meshCsType: "FrooxEngine.SphereMesh",
    supportsCollider: true,
    inputs: [port("radius", "Radius", "float", { defaultCs: "0.5f" })],
    existingCall: (api, slot, material, collider) =>
      `${slot}.AttachSphere(${api.input("radius").code}, ${material}, ${collider})`,
    genericCall: (api, slot, materialType, collider) =>
      `${slot}.AttachSphere<${materialType}>(${api.input("radius").code}, ${collider})`
  });

  registerShapeAttachNode({
    id: "attach.cylinder",
    title: "Attach Cylinder",
    symbol: "+CYL",
    description:
      "Covers both Slot.AttachCylinder overloads with an existing or newly created material.",
    fieldPrefix: "attachCylinder",
    meshGraphType: "cylinderMesh",
    meshCsType: "FrooxEngine.CylinderMesh",
    supportsCollider: true,
    inputs: [
      port("radius", "Radius", "float", { defaultCs: "0.5f" }),
      port("height", "Height", "float", { defaultCs: "1f" })
    ],
    existingCall: (api, slot, material, collider) =>
      `${slot}.AttachCylinder(${api.input("radius").code}, ${api.input("height").code}, ${material}, ${collider})`,
    genericCall: (api, slot, materialType, collider) =>
      `${slot}.AttachCylinder<${materialType}>(${api.input("radius").code}, ${api.input("height").code}, ${collider})`
  });

  registerNode("attach.arrow", {
    title: "Attach Arrow",
    group: "Attach & Create",
    symbol: "+ARR",
    description:
      "Covers Slot.AttachArrow with a generated material or an existing material provider.",
    parameters: [materialTypeParameter()],
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS }),
      port("material", "Existing Material (optional)", "material"),
      port("vector", "Vector", "float3", { defaultCs: "new Elements.Core.float3(0f, 0f, 1f)" }),
      port("color", "Color", "colorX", { defaultCs: "colorX.White" })
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("slot", "Slot", "slot"),
      port("mesh", "Arrow Mesh", "arrowMesh"),
      port("material", "Material", "material"),
      port("renderer", "Renderer", "meshRenderer"),
      port("success", "Success", "bool"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      attachResultFields(
        api,
        "attachArrow",
        "FrooxEngine.ArrowMesh"
      );
    },
    codegenExpression(api) {
      return attachOutputExpression(api, "attachArrow");
    },
    codegenAction(api) {
      const materialType = directMaterialType(api);
      const token = nodeToken(api);
      const slotField = `_attachArrowSlot${token}`;
      const meshField = `_attachArrowMesh${token}`;
      const materialField = `_attachArrowMaterial${token}`;
      const rendererField = `_attachArrowRenderer${token}`;
      const successField = `_attachArrowSuccess${token}`;
      const exceptionField = `_attachArrowException${token}`;
      const slot = api.input("slot").code;
      const suppliedMaterial = api.input("material").code;
      const vector = api.input("vector").code;
      const color = api.input("color").code;
      const done = api.emit("done");
      return `try\n        {\n            ${exceptionField} = null;\n            ${slotField} = ${slot};\n            FrooxEngine.IAssetProvider<FrooxEngine.Material>? suppliedMaterial${token} = ${suppliedMaterial};\n\n            if (suppliedMaterial${token} is not null)\n            {\n                ${meshField} = ${slot}.AttachMesh<FrooxEngine.ArrowMesh>(suppliedMaterial${token});\n                ${meshField}.Vector.Value = ${vector};\n                ${materialField} = suppliedMaterial${token};\n            }\n            else\n            {\n                FrooxEngine.AttachedModel<FrooxEngine.ArrowMesh, ${materialType}> model${token} = ${slot}.AttachArrow<${materialType}>(${vector});\n                ${meshField} = model${token}.mesh;\n                ${materialField} = model${token}.material;\n                ${rendererField} = model${token}.renderer;\n            }\n\n            if (${materialField} is FrooxEngine.ICommonMaterial commonMaterial${token})\n            {\n                commonMaterial${token}.Color = ${color};\n            }\n\n            ${rendererField} ??= ${slot}.GetComponent<FrooxEngine.MeshRenderer>();\n            ${successField} = ${meshField} is not null && ${materialField} is not null && ${rendererField} is not null;\n        }\n        catch (System.Exception caught)\n        {\n            ${exceptionField} = caught;\n            ${meshField} = null;\n            ${materialField} = null;\n            ${rendererField} = null;\n            ${successField} = false;\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  function registerSimpleAttachNode(specification) {
    registerNode(specification.id, {
      title: specification.title,
      group: "Attach & Create",
      symbol: specification.symbol,
      description: specification.description,
      parameters: specification.parameters || [],
      inputs: [
        port("call", "Call", "impulse"),
        port("slot", "Slot", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS }),
        ...specification.inputs
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("asset", specification.outputLabel, specification.outputType),
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      ],
      codegenCollect(api) {
        ensureDirectResoniteCore(api);
        addStatefulField(
          api,
          `${specification.fieldPrefix}Value`,
          `${specification.outputCsType}?`,
          "null"
        );
        addStatefulField(
          api,
          `${specification.fieldPrefix}Success`,
          "bool",
          "false"
        );
        addStatefulField(
          api,
          `${specification.fieldPrefix}Exception`,
          "System.Exception?",
          "null"
        );
      },
      codegenExpression(api) {
        const token = nodeToken(api);
        if (api.portId === "success") {
          return `_${specification.fieldPrefix}Success${token}`;
        }
        if (api.portId === "exception") {
          return `_${specification.fieldPrefix}Exception${token}!`;
        }
        return `_${specification.fieldPrefix}Value${token}!`;
      },
      codegenAction(api) {
        const token = nodeToken(api);
        const value = `_${specification.fieldPrefix}Value${token}`;
        const success = `_${specification.fieldPrefix}Success${token}`;
        const exception = `_${specification.fieldPrefix}Exception${token}`;
        const done = api.emit("done");
        return `try\n        {\n            ${exception} = null;\n            ${value} = ${specification.call(api)};\n            ${success} = ${value} is not null;\n        }\n        catch (System.Exception caught)\n        {\n            ${exception} = caught;\n            ${value} = null;\n            ${success} = false;\n        }${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerSimpleAttachNode({
    id: "attach.texture2D",
    title: "Attach Texture 2D",
    symbol: "+TEX",
    description:
      "Covers both Slot.AttachTexture overloads, including independent U/V wrap modes and optional MaxSize.",
    fieldPrefix: "attachTexture",
    outputLabel: "Static Texture 2D",
    outputType: "staticTexture2D",
    outputCsType: "FrooxEngine.StaticTexture2D",
    inputs: [
      port("uri", "URI", "Uri"),
      port("getExisting", "Get Existing", "bool", { defaultCs: "true" }),
      port("uncompressed", "Uncompressed", "bool", { defaultCs: "false" }),
      port("directLoad", "Direct Load", "bool", { defaultCs: "false" }),
      port("evenNull", "Create Even If Null", "bool", { defaultCs: "false" }),
      port("wrapU", "Wrap U", "textureWrapMode", { defaultCs: "Renderite.Shared.TextureWrapMode.Repeat" }),
      port("wrapV", "Wrap V", "textureWrapMode", { defaultCs: "Renderite.Shared.TextureWrapMode.Repeat" }),
      port("maxSize", "Max Size (0 = none)", "int", { defaultCs: "0" })
    ],
    call: api => {
      const maxSize = api.input("maxSize").code;
      return `${api.input("slot").code}.AttachTexture(${api.input("uri").code}, ${api.input("getExisting").code}, ${api.input("uncompressed").code}, ${api.input("directLoad").code}, ${api.input("evenNull").code}, ${api.input("wrapU").code}, ${api.input("wrapV").code}, ${maxSize} > 0 ? ${maxSize} : (int?)null)`;
    }
  });

  registerSimpleAttachNode({
    id: "attach.cubemap",
    title: "Attach Cubemap",
    symbol: "+CUBE-T",
    description:
      "Calls Slot.AttachCubemap directly.",
    fieldPrefix: "attachCubemap",
    outputLabel: "Static Cubemap",
    outputType: "staticCubemap",
    outputCsType: "FrooxEngine.StaticCubemap",
    inputs: [
      port("uri", "URI", "Uri"),
      port("getExisting", "Get Existing", "bool", { defaultCs: "true" }),
      port("evenNull", "Create Even If Null", "bool", { defaultCs: "false" })
    ],
    call: api =>
      `${api.input("slot").code}.AttachCubemap(${api.input("uri").code}, ${api.input("getExisting").code}, ${api.input("evenNull").code})`
  });

  registerSimpleAttachNode({
    id: "attach.spriteUri",
    title: "Attach Sprite From URI",
    symbol: "+SPR-URI",
    description:
      "Covers the URI overload of Slot.AttachSprite.",
    fieldPrefix: "attachSpriteUri",
    outputLabel: "Sprite Provider",
    outputType: "spriteProvider",
    outputCsType: "FrooxEngine.SpriteProvider",
    inputs: [
      port("uri", "URI", "Uri"),
      port("uncompressed", "Uncompressed", "bool", { defaultCs: "false" }),
      port("evenNull", "Create Even If Null", "bool", { defaultCs: "false" }),
      port("getExisting", "Get Existing", "bool", { defaultCs: "true" }),
      port("maxSize", "Max Size (0 = none)", "int", { defaultCs: "0" })
    ],
    call: api => {
      const maxSize = api.input("maxSize").code;
      return `${api.input("slot").code}.AttachSprite(${api.input("uri").code}, ${api.input("uncompressed").code}, ${api.input("evenNull").code}, ${api.input("getExisting").code}, ${maxSize} > 0 ? ${maxSize} : (int?)null)`;
    }
  });

  registerSimpleAttachNode({
    id: "attach.spriteTexture",
    title: "Attach Sprite From Texture",
    symbol: "+SPR-TEX",
    description:
      "Covers the IAssetProvider<ITexture2D> overload of Slot.AttachSprite.",
    fieldPrefix: "attachSpriteTexture",
    outputLabel: "Sprite Provider",
    outputType: "spriteProvider",
    outputCsType: "FrooxEngine.SpriteProvider",
    inputs: [port("texture", "Texture", "texture")],
    call: api =>
      `${api.input("slot").code}.AttachSprite(${api.input("texture").code})`
  });

  registerSimpleAttachNode({
    id: "attach.staticMesh",
    title: "Attach Static Mesh",
    symbol: "+SMESH",
    description:
      "Calls Slot.AttachStaticMesh directly.",
    fieldPrefix: "attachStaticMesh",
    outputLabel: "Static Mesh",
    outputType: "staticMesh",
    outputCsType: "FrooxEngine.StaticMesh",
    inputs: [
      port("uri", "URI", "Uri"),
      port("getExisting", "Get Existing", "bool", { defaultCs: "true" })
    ],
    call: api =>
      `${api.input("slot").code}.AttachStaticMesh(${api.input("uri").code}, ${api.input("getExisting").code})`
  });

  registerSimpleAttachNode({
    id: "attach.audioClip",
    title: "Attach Audio Clip",
    symbol: "+AUDIO",
    description:
      "Calls Slot.AttachAudioClip directly.",
    fieldPrefix: "attachAudioClip",
    outputLabel: "Static Audio Clip",
    outputType: "staticAudioClip",
    outputCsType: "FrooxEngine.StaticAudioClip",
    inputs: [
      port("uri", "URI", "Uri"),
      port("getExisting", "Get Existing", "bool", { defaultCs: "true" })
    ],
    call: api =>
      `${api.input("slot").code}.AttachAudioClip(${api.input("uri").code}, ${api.input("getExisting").code})`
  });

  registerSimpleAttachNode({
    id: "attach.font",
    title: "Attach Font",
    symbol: "+FONT",
    description:
      "Calls Slot.AttachFont directly.",
    fieldPrefix: "attachFont",
    outputLabel: "Static Font",
    outputType: "staticFont",
    outputCsType: "FrooxEngine.StaticFont",
    inputs: [
      port("uri", "URI", "Uri"),
      port("getExisting", "Get Existing", "bool", { defaultCs: "true" })
    ],
    call: api =>
      `${api.input("slot").code}.AttachFont(${api.input("uri").code}, ${api.input("getExisting").code})`
  });

  registerNode("attach.skybox", {
    title: "Attach Skybox",
    group: "Attach & Create",
    symbol: "+SKY",
    description:
      "Calls Slot.AttachSkybox<TMaterial>() directly and exposes both the Skybox and created material.",
    parameters: [materialTypeParameter()],
    resolveDefinition(node) {
      return {
        outputs: [
          port("done", "Done", "impulse"),
          port("skybox", "Skybox", "skybox"),
          port(
            "material",
            "Material",
            graphMaterialType(
              node.parameters?.materialType
            )
          ),
          port("success", "Success", "bool"),
          port("exception", "Exception", "exception")
        ]
      };
    },
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot", { defaultCs: DEFAULT_WORLD_ROOT_SLOT_CS })
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("skybox", "Skybox", "skybox"),
      port("material", "Material", "commonMaterial"),
      port("success", "Success", "bool"),
      port("exception", "Exception", "exception")
    ],
    codegenCollect(api) {
      ensureDirectResoniteCore(api);
      const materialType = directMaterialType(api);
      addStatefulField(api, "attachSkybox", "FrooxEngine.Skybox?", "null");
      addStatefulField(api, "attachSkyboxMaterial", `${materialType}?`, "null");
      addStatefulField(api, "attachSkyboxSuccess", "bool", "false");
      addStatefulField(api, "attachSkyboxException", "System.Exception?", "null");
    },
    codegenExpression(api) {
      const token = nodeToken(api);
      return {
        skybox: `_attachSkybox${token}!`,
        material: `_attachSkyboxMaterial${token}!`,
        success: `_attachSkyboxSuccess${token}`,
        exception: `_attachSkyboxException${token}!`
      }[api.portId] || "null!";
    },
    codegenAction(api) {
      const materialType = directMaterialType(api);
      const token = nodeToken(api);
      const skybox = `_attachSkybox${token}`;
      const material = `_attachSkyboxMaterial${token}`;
      const success = `_attachSkyboxSuccess${token}`;
      const exception = `_attachSkyboxException${token}`;
      const slot = api.input("slot").code;
      const done = api.emit("done");
      return `try\n        {\n            ${exception} = null;\n            ${material} = ${slot}.AttachSkybox<${materialType}>();\n            ${skybox} = ${slot}.GetComponent<FrooxEngine.Skybox>();\n            ${success} = ${material} is not null && ${skybox} is not null;\n        }\n        catch (System.Exception caught)\n        {\n            ${exception} = caught;\n            ${material} = null;\n            ${skybox} = null;\n            ${success} = false;\n        }${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.readMember", {
    title: "Read Slot / Component Member",
    group: "Slots & Components",
    symbol: "SYNC→",
    description:
      "Reads a normal field/property or the Value of a Sync<T>-style member path, then converts it to the selected type.",
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
    inputs: [
      port("target", "Target", "object"),
      port("path", "Member path", "string")
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
      ensureResoniteRuntime(api);
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(ReadSyncMember(${api.input("target").code}, ${api.input("path").code}))`;
    }
  });

  registerNode("resonite.writeMember", {
    title: "Write Slot / Component Member",
    group: "Slots & Components",
    symbol: "→SYNC",
    description:
      "Writes either member.Value or the member itself through reflection.",
    inputs: [
      port("call", "Call", "impulse"),
      port("target", "Target", "object"),
      port("path", "Member path", "string"),
      port("value", "Value", "object")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "syncWriteSuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_syncWriteSuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_syncWriteSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = WriteSyncMember(${api.input("target").code}, ${api.input("path").code}, ${api.input("value").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.dynamicVariableSpace", {
    title: "Get Dynamic Variable Space",
    group: "Slots & Components",
    symbol: "DVS",
    description:
      "Finds a real DynamicVariableSpace component on a Slot through the current Resonite assemblies.",
    inputs: [port("slot", "Slot", "slot")],
    outputs: [
      port(
        "space",
        "Dynamic Variable Space",
        "dynamicVariableSpace"
      )
    ],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `(FrooxEngine.DynamicVariableSpace)FindComponentReflective(${api.input("slot").code}, typeof(FrooxEngine.DynamicVariableSpace))!`;
    }
  });

  registerNode("resonite.attachDynamicVariableSpace", {
    title: "Attach Dynamic Variable Space",
    group: "Slots & Components",
    symbol: "+DVS",
    description:
      "Attaches a real DynamicVariableSpace component by reflected type name.",
    inputs: [
      port("call", "Call", "impulse"),
      port("slot", "Slot", "slot")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port(
        "space",
        "Dynamic Variable Space",
        "dynamicVariableSpace"
      )
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "dynamicSpace",
        "FrooxEngine.DynamicVariableSpace?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_dynamicSpace${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_dynamicSpace${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = (FrooxEngine.DynamicVariableSpace?)AttachComponentReflective(${api.input("slot").code}, typeof(FrooxEngine.DynamicVariableSpace));${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.readDynamicVariable", {
    title: "Read Dynamic Variable",
    group: "Slots & Components",
    symbol: "DYN→",
    description:
      "Reads a real dynamic variable from a DynamicVariableSpace using reflected ReadValue/GetValue fallbacks.",
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
    inputs: [
      port(
        "space",
        "Dynamic Variable Space",
        "dynamicVariableSpace"
      ),
      port("name", "Variable name", "string")
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
      ensureResoniteRuntime(api);
      return `ConvertGraphValue<${api.csType(
        api.node.parameters.valueType
      )}>(ReadDynamicVariableReflective(${api.input("space").code}, ${api.input("name").code}))`;
    }
  });

  registerNode("resonite.writeDynamicVariable", {
    title: "Write Dynamic Variable",
    group: "Slots & Components",
    symbol: "→DYN",
    description:
      "Writes a real dynamic variable through WriteValue/SetValue reflection fallbacks.",
    inputs: [
      port("call", "Call", "impulse"),
      port(
        "space",
        "Dynamic Variable Space",
        "dynamicVariableSpace"
      ),
      port("name", "Variable name", "string"),
      port("value", "Value", "object")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "dynamicWriteSuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_dynamicWriteSuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_dynamicWriteSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = WriteDynamicVariableReflective(${api.input("space").code}, ${api.input("name").code}, ${api.input("value").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.radiantDash", {
    title: "Current Radiant Dash",
    group: "Slots & Components",
    symbol: "DASH",
    description:
      "Finds the current Userspace RadiantDash through member paths and component fallback.",
    outputs: [
      port("dash", "Radiant Dash", "radiantDash")
    ],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `(FrooxEngine.RadiantDash)CurrentRadiantDash()!`;
    }
  });

  registerNode("resonite.setRadiantDashOpen", {
    title: "Set Radiant Dash Open",
    group: "Slots & Components",
    symbol: "DASH=",
    description:
      "Sets the reflected RadiantDash.Open member.",
    inputs: [
      port("call", "Call", "impulse"),
      port("dash", "Radiant Dash", "radiantDash"),
      port("open", "Open", "bool")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("success", "Success", "bool")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "dashOpenSuccess",
        "bool",
        "false"
      );
    },
    codegenExpression(api) {
      return `_dashOpenSuccess${nodeToken(api)}`;
    },
    codegenAction(api) {
      const field = `_dashOpenSuccess${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = WriteMember(${api.input("dash").code}, "Open", ${api.input("open").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("resonite.openModalOverlay", {
    title: "Open Radiant Dash Modal",
    group: "UI",
    symbol: "MODAL",
    description:
      "Calls OpenModalOverlay on RadiantDash.Slot or the dash itself and returns the created modal root.",
    inputs: [
      port("call", "Call", "impulse"),
      port("dash", "Radiant Dash", "radiantDash"),
      port("size", "Size", "float2"),
      port("title", "Title", "string")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("root", "Modal root", "slot")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "modalRoot",
        "FrooxEngine.Slot?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_modalRoot${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_modalRoot${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = (FrooxEngine.Slot?)OpenRadiantDashModalReflective(${api.input("dash").code}, ${api.input("size").code}, ${api.input("title").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("ui.createBuilder", {
    title: "Create UIBuilder",
    group: "UI",
    symbol: "UIB",
    description:
      "Constructs FrooxEngine.UIX.UIBuilder for a target Slot through reflection.",
    inputs: [port("slot", "Slot", "slot")],
    outputs: [port("builder", "UIBuilder", "uiBuilder")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `(FrooxEngine.UIX.UIBuilder)CreateUiBuilderReflective(${api.input("slot").code})!`;
    }
  });

  function registerUiElementNode(
    id,
    title,
    symbol,
    methodName,
    inputPorts,
    argumentIds,
    description
  ) {
    registerNode(id, {
      title,
      group: "UI",
      symbol,
      description,
      inputs: [
        port("call", "Call", "impulse"),
        port("builder", "UIBuilder", "uiBuilder"),
        ...inputPorts
      ],
      outputs: [
        port("done", "Done", "impulse"),
        port("element", "Element", "uiElement")
      ],
      codegenCollect(api) {
        ensureResoniteRuntime(api);
        addStatefulField(
          api,
          "uiElement",
          "object?",
          "null"
        );
      },
      codegenExpression(api) {
        return `_uiElement${nodeToken(api)}!`;
      },
      codegenAction(api) {
        const field = `_uiElement${nodeToken(api)}`;
        const done = api.emit("done");
        const args = argumentIds
          .map(argument =>
            api.input(argument).code
          )
          .join(", ");
        return `${field} = CreateUiElementReflective(${api.input("builder").code}, ${quote(api, methodName)}${args ? `, ${args}` : ""});${done ? `\n        ${done}();` : ""}`;
      }
    });
  }

  registerUiElementNode(
    "ui.panel",
    "UI Panel",
    "PNL",
    "Panel",
    [],
    [],
    "Creates a panel/container with UIBuilder.Panel()."
  );
  registerUiElementNode(
    "ui.text",
    "UI Text",
    "TXT",
    "Text",
    [port("text", "Text", "string")],
    ["text"],
    "Creates a text element through UIBuilder.Text()."
  );
  registerUiElementNode(
    "ui.button",
    "UI Button",
    "BTN",
    "Button",
    [port("text", "Text", "string")],
    ["text"],
    "Creates a button. Subscribe to its reflected event/member to react to presses."
  );
  registerUiElementNode(
    "ui.slider",
    "UI Slider",
    "SLD",
    "Slider",
    [
      port("minimum", "Minimum", "float"),
      port("maximum", "Maximum", "float"),
      port("value", "Value", "float")
    ],
    ["minimum", "maximum", "value"],
    "Creates a slider using the best matching UIBuilder.Slider overload."
  );
  registerUiElementNode(
    "ui.checkbox",
    "UI Checkbox",
    "CHK",
    "Checkbox",
    [port("value", "Value", "bool")],
    ["value"],
    "Creates a checkbox using the best matching UIBuilder.Checkbox overload."
  );
  registerUiElementNode(
    "ui.image",
    "UI Image",
    "IMG",
    "Image",
    [port("source", "Source", "object")],
    ["source"],
    "Creates an image using the best matching UIBuilder.Image overload."
  );

  registerNode("ui.callBuilderMethod", {
    title: "Call UIBuilder Method",
    group: "UI",
    symbol: "UI()",
    description:
      "Universal UIBuilder escape hatch for methods not covered by a dedicated node.",
    inputs: [
      port("call", "Call", "impulse"),
      port("builder", "UIBuilder", "uiBuilder"),
      port("method", "Method", "string"),
      port("arguments", "Arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("element", "Result", "uiElement")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "uiCallResult",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_uiCallResult${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_uiCallResult${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = InvokeBest(${api.input("builder").code}, ${api.input("method").code}, ${api.input("arguments").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("ui.setMember", {
    title: "Set UI Member",
    group: "UI",
    symbol: "UI=",
    description:
      "Sets any UI element/component field, property or Sync<T> path.",
    inputs: [
      port("call", "Call", "impulse"),
      port("element", "Element", "uiElement"),
      port("path", "Member path", "string"),
      port("value", "Value", "object")
    ],
    outputs: [port("done", "Done", "impulse")],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
    },
    codegenAction(api) {
      const done = api.emit("done");
      return `WriteSyncMember(${api.input("element").code}, ${api.input("path").code}, ${api.input("value").code});${done ? `\n        ${done}();` : ""}`;
    }
  });

  registerNode("asset.manager", {
    title: "Get Engine Asset Manager",
    group: "Assets",
    symbol: "AM",
    description:
      "Reads an Engine member path such as AssetManager, LocalDB or WorldManager.",
    parameters: [
      pText(
        "memberPath",
        "Engine member path",
        "AssetManager"
      )
    ],
    outputs: [port("manager", "Manager", "object")],
    codegenExpression(api) {
      ensureResoniteRuntime(api);
      return `ReadMemberPath(CurrentEngine(), ${quote(api, api.node.parameters.memberPath)})!`;
    }
  });

  registerNode("asset.request", {
    title: "Request / Load Asset",
    group: "Assets",
    symbol: "LOAD",
    description:
      "Invokes an asset manager method with URI and optional arguments. Use Method name to match the current Resonite API.",
    parameters: [
      pText(
        "methodName",
        "Manager method",
        "RequestAsset"
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("manager", "Manager", "object"),
      port("uri", "URI", "Uri"),
      port("arguments", "Extra arguments", "objectArray")
    ],
    outputs: [
      port("done", "Done", "impulse"),
      port("asset", "Result / request", "object")
    ],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
      addStatefulField(
        api,
        "assetResult",
        "object?",
        "null"
      );
    },
    codegenExpression(api) {
      return `_assetResult${nodeToken(api)}!`;
    },
    codegenAction(api) {
      const field = `_assetResult${nodeToken(api)}`;
      const done = api.emit("done");
      return `${field} = InvokeBest(${api.input("manager").code}, ${quote(api, api.node.parameters.methodName)}, new object?[] { ${api.input("uri").code} }.Concat(${api.input("arguments").code}).ToArray());${done ? `\n        ${done}();` : ""}`;
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
      api.addField(
        `${api.node.id}.text`,
        `private static string _readText${token} = string.Empty;`
      );
      api.addField(
        `${api.node.id}.exception`,
        `private static Exception _readTextException${token} = null!;`
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
        api.addField(
          `${api.node.id}.exception`,
          `private static Exception _fileWriteException${nodeToken(api)} = null!;`
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
      api.addField(
        `${api.node.id}.response`,
        `private static GraphHttpResponse _httpResponse${token} = GraphHttpResponse.Empty;`
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
      const connected = api.emitMethod(
        api.node.id,
        "connected"
      );
      const message = api.emitMethod(
        api.node.id,
        "message"
      );
      const closed = api.emitMethod(
        api.node.id,
        "closed"
      );
      api.addField(
        `${api.node.id}.socket`,
        `private static ClientWebSocket _webSocket${token} = null!;`
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
      api.addField(
        `${api.node.id}.error`,
        `private static string _webSocketSendError${token} = string.Empty;`
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
      api.addField(
        `${api.node.id}.error`,
        `private static string _tcpError${token} = string.Empty;`
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
      api.addField(
        `${api.node.id}.error`,
        `private static string _udpError${token} = string.Empty;`
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
        `private static void RunBackground${token}()\n{\n    _ = Task.Run(() =>\n    {${background ? `\n        ${background}();` : ""}\n    }).ContinueWith(_ =>\n    {${completed ? `\n        ${completed}();` : ""}\n    }, TaskScheduler.Default);\n}`
      );
    },
    codegenAction(api) {
      return `RunBackground${nodeToken(api)}();`;
    }
  });

  registerNode("task.dispatchResonite", {
    expertOnly: true,
    title: "Dispatch To World Update",
    group: "Tasks & Threading",
    symbol: "MAIN",
    description:
      "Dispatches the impulse through World.RunSynchronously so Resonite data-model mutations execute in the target world update context.",
    inputs: [port("call", "Dispatch", "impulse")],
    outputs: [port("run", "Run", "impulse")],
    codegenCollect(api) {
      ensureResoniteRuntime(api);
    },
    codegenAction(api) {
      const run = api.emit("run");
      return run
        ? `DispatchToResonite(() => ${run}());`
        : "";
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
      api.addField(
        `${api.node.id}.exception`,
        `private static Exception _awaitException${token} = null!;`
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

  registerNode("csharp.expression", {
    title: "C# Expression",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "C#=",
    description:
      "Universal typed expression escape hatch. Starts with {A} and {B}; add more object inputs in the inspector. Placeholders {A}…{Z}, then {INPUT27}… plus {MOD}, {GRAPH}, {NAMESPACE} and {NODE} are replaced during export.",
    configurableTypeVar: "T",
    configurableTypes: COMMON_VALUE_TYPES,
    defaultType: "object",
    parameters: [
      pCode(
        "code",
        "Expression",
        "{A}",
        "Enter one valid C# expression without a trailing semicolon.",
        8
      )
    ],
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
    outputs: [
      genericPort(
        "result",
        "Result",
        "T",
        "anyValue"
      )
    ],
    codegenExpression(api) {
      api.warning(
        "C# Expression nodes are exported verbatim and cannot be fully type-checked by the browser."
      );
      const count = Math.max(
        2,
        Math.min(64, Number(api.node.parameters?.variadicInputCount) || 2)
      );
      const ids = Array.from({ length: count }, (_, index) =>
        index < 26
          ? String.fromCharCode(97 + index)
          : `input${index + 1}`
      );
      const code = replaceInputPlaceholders(
        api.node.parameters.code,
        api,
        ids
      ).trim();
      return code || api.csDefault(
        api.node.parameters.valueType
      );
    }
  });

  registerNode("csharp.action", {
    title: "C# Action",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "C#;",
    description:
      "Universal statement escape hatch. Starts with {A} and {B}; add more object inputs in the inspector. {A}…{Z}, then {INPUT27}… are input expressions; {NEXT} calls Done.",
    parameters: [
      pCode(
        "code",
        "Statements",
        "_display(FormatValue({A}));",
        "Statements are inserted inside the generated impulse method.",
        12
      )
    ],
    inputs: [
      port("call", "Call", "impulse"),
      port("a", "A", "object"),
      port("b", "B", "object")
    ],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 64,
      preserved: 1,
      template: port("a", "A", "object")
    },
    outputs: [port("done", "Done", "impulse")],
    codegenAction(api) {
      api.warning(
        "C# Action nodes are exported verbatim and can call any referenced API."
      );
      const nextMethod = api.emit("done");
      const next = nextMethod
        ? `${nextMethod}();`
        : "";
      const count = Math.max(
        2,
        Math.min(64, Number(api.node.parameters?.variadicInputCount) || 2)
      );
      const ids = Array.from({ length: count }, (_, index) =>
        index < 26
          ? String.fromCharCode(97 + index)
          : `input${index + 1}`
      );
      let code = replaceInputPlaceholders(
        api.node.parameters.code,
        api,
        ids
      );
      const containedNext =
        code.includes("{NEXT}");
      code = replaceCodePlaceholders(
        code,
        api,
        {
          NEXT: next
        }
      ).trim();
      if (!containedNext && next) {
        code = `${code}${code ? "\n" : ""}${next}`;
      }
      return code;
    }
  });

  registerNode("csharp.runtimeMember", {
    title: "C# Graph Runtime Member",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "MEM",
    description:
      "Adds fields, methods, nested types or properties directly inside the generated static NodeGraph class.",
    parameters: [
      pCode(
        "code",
        "Class member code",
        "private static object? CustomState;",
        "Do not include an outer class or namespace declaration.",
        14
      )
    ],
    codegenCollect(api) {
      const code = replaceCodePlaceholders(
        api.node.parameters.code,
        api
      ).trim();
      if (code) {
        api.addMember(
          `${api.node.id}.rawRuntimeMember`,
          code
        );
        api.warning(
          "A C# Graph Runtime Member is included verbatim."
        );
      }
    }
  });

  registerNode("csharp.mainMember", {
    title: "C# Main Mod Member",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "MOD",
    description:
      "Adds fields, helpers or nested types inside the generated public partial ResoniteMod class.",
    parameters: [
      pCode(
        "code",
        "Partial class member code",
        "private static void CustomHelper()\n{\n}\n",
        "Do not include an outer class or namespace declaration.",
        16
      )
    ]
  });

  registerNode("csharp.additionalSource", {
    title: "Additional C# Source File",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: ".CS",
    description:
      "Exports a complete additional source file. This makes arbitrary classes, services, exact API adapters and platform code possible.",
    parameters: [
      pText(
        "fileName",
        "File name",
        "AdditionalRuntime.cs"
      ),
      pCode(
        "content",
        "Complete C# source",
        "using System;\n\nnamespace {NAMESPACE};\n\ninternal static class AdditionalRuntime\n{\n}\n",
        "The complete file is exported verbatim after placeholder replacement.",
        20
      )
    ]
  });

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

  registerNode("csharp.assemblyReference", {
    title: "Manual Assembly Reference",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "DLL",
    description:
      "Expert fallback for an external assembly that no visual node can declare automatically.",
    parameters: [
      pText(
        "include",
        "Assembly include",
        "MyLibrary"
      ),
      pText(
        "hintPath",
        "HintPath",
        "$(ResonitePath)Libraries/MyLibrary.dll"
      ),
      pBool(
        "copyLocal",
        "Copy local",
        false
      )
    ]
  });

  registerNode("csharp.packageReference", {
    title: "Manual NuGet Package Reference",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "NUGET",
    description:
      "Expert fallback for an external NuGet package that no visual node can declare automatically.",
    parameters: [
      pText(
        "include",
        "Package",
        "Newtonsoft.Json"
      ),
      pText(
        "version",
        "Version",
        "13.0.3"
      ),
      pText(
        "privateAssets",
        "PrivateAssets",
        ""
      ),
      pText(
        "includeAssets",
        "IncludeAssets",
        ""
      )
    ]
  });

  registerNode("csharp.frameworkReference", {
    title: "Manual Framework Reference",
    group: RAW_CSHARP_GROUP,
    expertOnly: true,
    symbol: "FX",
    description:
      "Expert fallback for a framework reference that no visual node can declare automatically.",
    parameters: [
      pText(
        "include",
        "Framework",
        "Microsoft.AspNetCore.App"
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
            node.operatorId ===
              "csharp.assemblyReference"
          )
          .map(node => ({
            include: String(
              node.parameters?.include || ""
            ).trim(),
            hintPath: String(
              node.parameters?.hintPath || ""
            ).trim(),
            private:
              node.parameters?.copyLocal ===
              true
          }))
          .filter(reference =>
            reference.include
          );

      const manualProjectPackages =
        nodes
          .filter(node =>
            node?.kind === "operator" &&
            node.operatorId ===
              "csharp.packageReference"
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
            node.operatorId ===
              "csharp.frameworkReference"
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
          node.operatorId === "csharp.expression" ||
          node.operatorId === "csharp.action" ||
          node.operatorId === "csharp.runtimeMember" ||
          node.operatorId === "csharp.mainMember"
            ? node.parameters?.code
            : node.operatorId === "csharp.additionalSource" ||
                node.operatorId === "harmony.exactPatchSource" ||
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
            node.operatorId !== "csharp.additionalSource" &&
            node.operatorId !== "harmony.exactPatchSource" &&
            node.operatorId !== "harmony.earlyPatchSource" &&
            node.operatorId !== "csharp.mainMember";

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
            node.operatorId ===
              "csharp.mainMember"
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

          case "csharp.assemblyReference":
            api.addReference({
              include:
                node.parameters?.include,
              hintPath:
                node.parameters?.hintPath,
              private:
                node.parameters?.copyLocal ===
                true
            });
            break;

          case "csharp.packageReference":
            api.addPackageReference({
              include:
                node.parameters?.include,
              version:
                node.parameters?.version,
              privateAssets:
                node.parameters?.privateAssets,
              includeAssets:
                node.parameters?.includeAssets
            });
            break;

          case "csharp.frameworkReference":
            api.addFrameworkReference(
              node.parameters?.include
            );
            break;

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

          case "csharp.mainMember": {
            const code = replaceCodePlaceholders(
              node.parameters?.code,
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
              advancedCodeUsed = true;
            }
            break;
          }

          case "csharp.additionalSource": {
            const fileName = String(
              node.parameters?.fileName ||
                "AdditionalRuntime.cs"
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
            advancedCodeUsed = true;
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

          case "csharp.expression":
          case "csharp.action":
          case "csharp.runtimeMember":
            advancedCodeUsed = true;
            break;
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