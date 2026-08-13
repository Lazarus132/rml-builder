(() => {
  "use strict";

  const FACTORY_VERSION = 5;
  const ADVANCED_GROUP = "Advanced / Raw C#";
  const API_GROUPS = Object.freeze({
    types: "API · Types & Enums",
    constructors: "API · Constructors",
    methods: "API · Methods",
    properties: "API · Properties",
    fields: "API · Fields",
    events: "API · Events"
  });

  let bootAttempts = 0;

  function yieldToBrowser() {
    return new Promise(resolve => {
      if (
        typeof requestAnimationFrame ===
        "function"
      ) {
        requestAnimationFrame(
          () => setTimeout(resolve, 0)
        );
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  function boot() {
    if ((window.__RMLApiNodeFactoryVersion || 0) >= FACTORY_VERSION) {
      return;
    }

    const registry = window.RMLModNodeRegistry;
    const catalog =
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog;

    if (
      !registry ||
      !catalog ||
      typeof registry.registerNode !== "function" ||
      typeof registry.getNodeDefinitions !== "function"
    ) {
      bootAttempts += 1;
      if (bootAttempts < 600) {
        setTimeout(boot, 25);
      } else {
        console.error(
          "RML API Node Factory could not find the catalog/registry."
        );
      }
      return;
    }

    window.__RMLApiNodeFactoryVersion = FACTORY_VERSION;

    void buildFactory(
      registry,
      catalog
    ).catch(error => {
      console.error(
        "RML API Node Factory failed.",
        error
      );
    });
  }

  async function buildFactory(registry, catalog) {
    const {
      port,
      registerType,
      registerGroup,
      registerNode,
      getNodeDefinitions,
      getTypeInformation
    } = registry;

    for (const [name, options] of [
      [API_GROUPS.types, { after: "Values" }],
      [API_GROUPS.constructors, { after: API_GROUPS.types }],
      [API_GROUPS.methods, { after: API_GROUPS.constructors }],
      [API_GROUPS.properties, { after: API_GROUPS.methods }],
      [API_GROUPS.fields, { after: API_GROUPS.properties }],
      [API_GROUPS.events, { after: API_GROUPS.fields }]
    ]) {
      registerGroup(name, options);
    }

    const typeRows = Array.isArray(catalog.types)
      ? catalog.types.filter(Boolean)
      : [];
    const enumRows = Array.isArray(catalog.enums)
      ? catalog.enums.filter(Boolean)
      : [];
    const definitions = getNodeDefinitions();
    const typeByName = new Map();
    const genericTypeRowsByShape = new Map();
    const graphTypeByCs = new Map();
    const graphTypeByNormalizedCs = new Map();
    const generatedNodeIds = new Set();
    const assemblyByName = new Map(
      (Array.isArray(catalog.assemblies)
        ? catalog.assemblies
        : [])
        .filter(Boolean)
        .map(assembly => [
          String(assembly.name || "").trim(),
          assembly
        ])
        .filter(([name]) => Boolean(name))
    );

    for (const row of typeRows) {
      const name = normalizeCsType(row.fullName);
      if (name) {
        typeByName.set(name, row);

        const shape = genericTypeShape(name);
        if (shape && !genericTypeRowsByShape.has(shape)) {
          genericTypeRowsByShape.set(shape, row);
        }
      }
    }

    function catalogTypeNamesInExpression(csType) {
      const normalized =
        normalizeCsType(csType)
          .replace(/global::/g, "");
      const names = new Set();
      const matches = normalized.match(
        /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)+/g
      ) || [];

      if (typeByName.has(normalized)) {
        names.add(normalized);
      }

      for (const candidate of matches) {
        if (typeByName.has(candidate)) {
          names.add(candidate);
        }
      }

      return [...names];
    }

    function assemblyReferencesForCsType(
      csType,
      row = null
    ) {
      const references = new Map();
      const rows = [];

      if (row && typeof row === "object") {
        rows.push(row);
      }

      for (const typeName of
        catalogTypeNamesInExpression(csType)) {
        const information =
          typeByName.get(typeName);
        if (information) rows.push(information);
      }

      for (const information of rows) {
        const include = String(
          information.assembly || ""
        ).trim();

        if (!include) continue;

        const assembly =
          assemblyByName.get(include);
        const location = String(
          assembly?.location || ""
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

    function enrichGraphTypeAssemblies(
      graphType,
      csType,
      row = null
    ) {
      const information =
        getTypeInformation(graphType);

      if (!information) return;

      const references =
        assemblyReferencesForCsType(
          csType,
          row
        );
      const assemblies = [...new Set([
        ...(Array.isArray(information.assemblies)
          ? information.assemblies
          : []),
        ...references.map(reference =>
          reference.include
        )
      ])];
      const mergedReferences = new Map();

      for (const reference of [
        ...(Array.isArray(information.assemblyReferences)
          ? information.assemblyReferences
          : []),
        ...references
      ]) {
        const include = String(
          reference?.include || ""
        ).trim();
        if (!include) continue;
        mergedReferences.set(
          include.toLowerCase(),
          reference
        );
      }

      information.assemblies = assemblies;
      information.assemblyReferences =
        [...mergedReferences.values()];
      information.assembly =
        String(row?.assembly || "").trim() ||
        information.assembly ||
        assemblies[0] ||
        "";
    }

    const knownGraphTypes = new Map(Object.entries({
      "System.Boolean": "bool",
      "bool": "bool",
      "System.String": "string",
      "string": "string",
      "System.Uri": "Uri",
      "System.Int32": "int",
      "int": "int",
      "System.Single": "float",
      "float": "float",
      "System.Double": "double",
      "double": "double",
      "System.Byte[]": "byteArray",
      "byte[]": "byteArray",
      "System.String[]": "stringArray",
      "string[]": "stringArray",
      "System.Object[]": "objectArray",
      "object[]": "objectArray",
      "System.Object": "object",
      "object": "object",
      "System.Type": "type",
      "System.Reflection.MemberInfo": "memberInfo",
      "System.Reflection.MethodBase": "methodBase",
      "System.Reflection.MethodInfo": "methodInfo",
      "System.Reflection.FieldInfo": "fieldInfo",
      "System.Reflection.PropertyInfo": "propertyInfo",
      "System.Exception": "exception",
      "System.Threading.Tasks.Task": "task",
      "System.Threading.CancellationToken": "cancellationToken",
      "System.Net.WebSockets.ClientWebSocket": "webSocket",
      "System.Text.Json.Nodes.JsonNode": "json",
      "Elements.Core.int2": "int2",
      "Elements.Core.int3": "int3",
      "Elements.Core.int4": "int4",
      "Elements.Core.float2": "float2",
      "Elements.Core.float3": "float3",
      "Elements.Core.float4": "float4",
      "Elements.Core.double2": "double2",
      "Elements.Core.double3": "double3",
      "Elements.Core.double4": "double4",
      "Elements.Core.floatQ": "floatQ",
      "Elements.Core.colorX": "colorX",
      "FrooxEngine.Engine": "engine",
      "FrooxEngine.World": "world",
      "FrooxEngine.User": "user",
      "FrooxEngine.Slot": "slot",
      "FrooxEngine.Component": "component",
      "FrooxEngine.UIX.UIBuilder": "uiBuilder",
      "FrooxEngine.Primitive": "primitive",
      "FrooxEngine.BlendMode": "blendMode",
      "Renderite.Shared.TextureWrapMode": "textureWrapMode",
      "FrooxEngine.IAssetProvider": "asset",
      "FrooxEngine.IAssetProvider<FrooxEngine.ITexture2D>": "texture",
      "FrooxEngine.IAssetProvider<FrooxEngine.Material>": "material",
      "FrooxEngine.ICommonMaterial": "commonMaterial",
      "FrooxEngine.PBS_Material": "pbsMaterial",
      "FrooxEngine.PBS_Metallic": "pbsMetallic",
      "FrooxEngine.PBS_Specular": "pbsSpecular",
      "FrooxEngine.UnlitMaterial": "unlitMaterial",
      "FrooxEngine.IAssetProvider<FrooxEngine.Mesh>": "mesh",
      "FrooxEngine.IAssetProvider<FrooxEngine.AudioClip>": "audioClip",
      "FrooxEngine.MeshRenderer": "meshRenderer",
      "FrooxEngine.Collider": "collider",
      "FrooxEngine.MeshCollider": "meshCollider",
      "FrooxEngine.BoxCollider": "boxCollider",
      "FrooxEngine.SphereCollider": "sphereCollider",
      "FrooxEngine.CylinderCollider": "cylinderCollider",
      "FrooxEngine.QuadMesh": "quadMesh",
      "FrooxEngine.BoxMesh": "boxMesh",
      "FrooxEngine.SphereMesh": "sphereMesh",
      "FrooxEngine.CylinderMesh": "cylinderMesh",
      "FrooxEngine.ArrowMesh": "arrowMesh",
      "FrooxEngine.StaticTexture2D": "staticTexture2D",
      "FrooxEngine.StaticCubemap": "staticCubemap",
      "FrooxEngine.SpriteProvider": "spriteProvider",
      "FrooxEngine.StaticMesh": "staticMesh",
      "FrooxEngine.StaticAudioClip": "staticAudioClip",
      "FrooxEngine.StaticFont": "staticFont",
      "FrooxEngine.Skybox": "skybox",
      "FrooxEngine.Grabbable": "grabbable",
      "FrooxEngine.AudioOutput": "audioOutput",
      "FrooxEngine.DynamicVariableSpace": "dynamicVariableSpace",
      "FrooxEngine.RadiantDash": "radiantDash"
    }));

    for (const [csType, graphType] of knownGraphTypes) {
      const normalizedCsType = normalizeCsType(csType);
      graphTypeByCs.set(normalizedCsType, graphType);
      graphTypeByNormalizedCs.set(
        normalizeTypeForLookup(normalizedCsType),
        graphType
      );
    }

    function enumerableElementCsTypeFor(
      fullName,
      row = null,
      visited = new Set()
    ) {
      const csType = normalizeCsType(fullName);

      if (
        !csType ||
        csType === "System.String" ||
        csType === "string"
      ) {
        return null;
      }

      const direct =
        directEnumerableElementCsType(csType);

      if (direct) {
        return normalizeCsType(direct);
      }

      const shape = genericTypeShape(csType);
      const information =
        row?.fullName
          ? row
          : typeByName.get(csType) ||
            genericTypeRowsByShape.get(shape) ||
            null;

      if (!information) {
        return null;
      }

      const visitKey =
        `${csType}|${normalizeCsType(information.fullName)}`;

      if (visited.has(visitKey)) {
        return null;
      }

      visited.add(visitKey);

      const substitutions =
        genericTypeSubstitutions(
          information.fullName,
          csType
        );

      for (const interfaceName of
        Array.isArray(information.interfaces)
          ? information.interfaces
          : []) {
        const closedInterface =
          substituteGenericTypeParameters(
            interfaceName,
            substitutions
          );
        const element =
          directEnumerableElementCsType(
            closedInterface
          ) ||
          enumerableElementCsTypeFor(
            closedInterface,
            null,
            visited
          );

        if (element) {
          return normalizeCsType(element);
        }
      }

      return null;
    }

    function registerApiType(fullName, row = null) {
      const csType = normalizeCsType(fullName);
      if (!csType || csType === "System.Void" || csType === "void") {
        return null;
      }

      const known = graphTypeByCs.get(csType);
      if (known) {
        enrichGraphTypeAssemblies(
          known,
          csType,
          row || typeByName.get(csType) || null
        );
        return known;
      }

      const normalizedLookup =
        normalizeTypeForLookup(csType);
      const existing =
        graphTypeByNormalizedCs.get(
          normalizedLookup
        );
      if (existing) {
        enrichGraphTypeAssemblies(
          existing,
          csType,
          row || typeByName.get(csType) || null
        );
        return existing;
      }

      if (isOpenTypeExpression(csType)) {
        return "object";
      }

      const graphType = apiGraphTypeId(csType);
      const information = row || typeByName.get(csType) || {};
      const referenceType =
        information.kind === "class" ||
        information.kind === "interface" ||
        information.kind === "static-class" ||
        (!information.kind && !looksLikeValueType(csType));
      const label =
        information.name ||
        shortTypeName(csType);
      const color = colorForString(csType);
      const enumerableElementCsType =
        enumerableElementCsTypeFor(
          csType,
          information
        );

      registerType(graphType, {
          label,
          short: shortBadge(label),
          color,
          csType,
          defaultCs: referenceType
              ? "null!"
              : `default(${csType})`,
          referenceType,
          valueType: true,
          globalGenericCandidate: false,

          enumType:
              information.kind === "enum",

          assignableTo: referenceType
              ? ["object"]
              : [],

          constraints:
              information.kind === "enum"
                  ? ["value", "serializable", "enumOrString"]
                  : referenceType
                      ? ["reference", "serializable"]
                      : ["serializable"],

          apiCatalogType: csType,
          assembly:
              String(information.assembly || "").trim(),
          assemblies:
              assemblyReferencesForCsType(
                csType,
                information
              ).map(reference =>
                reference.include
              ),
          assemblyReferences:
              assemblyReferencesForCsType(
                csType,
                information
              )
      });

      graphTypeByCs.set(csType, graphType);
      graphTypeByNormalizedCs.set(
        normalizeTypeForLookup(csType),
        graphType
      );

      if (
        enumerableElementCsType &&
        !isGenericParameterName(
          enumerableElementCsType
        ) &&
        !isOpenTypeExpression(
          enumerableElementCsType
        )
      ) {
        const elementGraphType =
          normalizeTypeForLookup(
            enumerableElementCsType
          ) ===
          normalizeTypeForLookup(csType)
            ? graphType
            : registerApiType(
                enumerableElementCsType,
                typeByName.get(
                  normalizeCsType(
                    enumerableElementCsType
                  )
                ) || null
              ) || "object";
        const registeredInformation =
          getTypeInformation(graphType);

        if (registeredInformation) {
          registeredInformation
            .enumerableElementType =
              elementGraphType;
          registeredInformation
            .enumerableElementCsType =
              enumerableElementCsType;
          registeredInformation
            .collectionType = true;
          registeredInformation.constraints =
            [...new Set([
              ...(registeredInformation.constraints || []),
              "enumerable"
            ])];
        }
      }

      return graphType;
    }

    let cooperativeWork = 0;

    for (const row of typeRows) {
      if ((cooperativeWork += 1) % 120 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogType(row)) {
        continue;
      }
      registerApiType(row.fullName, row);
    }

    for (const row of enumRows) {
      if ((cooperativeWork += 1) % 120 === 0) {
        await yieldToBrowser();
      }
      if (!row || row.isObsolete || !row.fullName) {
        continue;
      }
      registerApiType(row.fullName, {
        fullName: row.fullName,
        name: shortTypeName(row.fullName),
        kind: "enum"
      });
    }

    for (const row of typeRows) {
      if ((cooperativeWork += 1) % 80 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogType(row)) {
        continue;
      }

      const graphType = graphTypeByCs.get(normalizeCsType(row.fullName));
      const information = graphType && getTypeInformation(graphType);
      if (!graphType || !information) {
        continue;
      }

      const assignable = new Set(information.assignableTo || []);
      const queue = [row.baseType, ...(Array.isArray(row.interfaces) ? row.interfaces : [])]
        .filter(Boolean)
        .map(normalizeCsType);
      const visited = new Set();

      while (queue.length > 0) {
        const candidate = queue.shift();
        if (!candidate || visited.has(candidate)) {
          continue;
        }
        visited.add(candidate);

        const targetGraphType = registerApiType(candidate, typeByName.get(candidate));
        if (targetGraphType && targetGraphType !== graphType) {
          assignable.add(targetGraphType);
        }

        const targetRow = typeByName.get(candidate);
        if (targetRow) {
          if (targetRow.baseType) {
            queue.push(normalizeCsType(targetRow.baseType));
          }
          for (const implemented of targetRow.interfaces || []) {
            queue.push(normalizeCsType(implemented));
          }
        }
      }

      if (row.isComponent) assignable.add("component");
      if (row.isMaterial) assignable.add("material");
      if (row.isCommonMaterial) assignable.add("commonMaterial");
      if (row.isMeshProvider) assignable.add("mesh");
      if (row.isTextureProvider) assignable.add("texture");
      if (row.isAudioClipProvider) assignable.add("audioClip");
      if (row.isCollider) assignable.add("collider");
      if (information.referenceType) assignable.add("object");

      information.assignableTo = [...assignable];
    }

    let typeNodeCount = 0;
    let enumNodeCount = 0;
    let constructorNodeCount = 0;
    let methodNodeCount = 0;
    let propertyNodeCount = 0;
    let fieldNodeCount = 0;
    let eventNodeCount = 0;
    let runtimeBoundMethodCount = 0;
    let skippedCount = 0;

    for (const row of typeRows) {
      if ((cooperativeWork += 1) % 120 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogType(row)) {
        continue;
      }
      const csType = normalizeCsType(row.fullName);
      const id = `api.type.${stableHash(csType)}`;
      registerGeneratedNode(id, {
        title: `Type · ${displayTypeName(row)}`,
        group: groupForType(row, API_GROUPS.types),
        symbol: "T",
        description: `Exact System.Type constant for ${csType}.`,
        outputs: [port("value", "Type", "type")],
        codegenExpression() {
          return `typeof(${csType})`;
        },
        catalogGenerated: true,
        catalogType: csType,
        apiSearchText: `${csType} type typeof`
      });
      typeNodeCount += 1;
    }

    for (const enumRow of enumRows) {
      if ((cooperativeWork += 1) % 120 === 0) {
        await yieldToBrowser();
      }
      if (!enumRow || enumRow.isObsolete || !enumRow.fullName) {
        continue;
      }
      const values = Array.isArray(enumRow.values)
        ? enumRow.values.filter(value => value && value.name)
        : [];
      if (values.length === 0) {
        skippedCount += 1;
        continue;
      }

      const csType = normalizeCsType(enumRow.fullName);
      const graphType = registerApiType(csType, {
        fullName: csType,
        name: shortTypeName(csType),
        kind: "enum"
      });
      const id = `api.enum.${stableHash(csType)}`;
      const options = values.map(value => [value.name, value.name]);
      const defaultValue = values[0].name;

      registerGeneratedNode(id, {
        title: `Enum · ${shortTypeName(csType)}`,
        group: groupForType(
          { fullName: csType },
          API_GROUPS.types
        ),
        symbol: "E",
        description: `Typed constant for ${csType}.`,
        parameters: [{
          key: "value",
          label: "Value",
          kind: "select",
          options,
          default: defaultValue,
          help: enumRow.isFlags
            ? "This is a [Flags] enum. This constant selects one declared value."
            : "Select one declared enum value."
        }],
        outputs: [port("value", "Value", graphType || "object")],
        codegenExpression(api) {
          const selected = String(api.node.parameters?.value || defaultValue);
          return `${csType}.${escapeCSharpIdentifier(selected)}`;
        },
        catalogGenerated: true,
        catalogType: csType,
        apiSearchText: `${csType} ${values.map(value => value.name).join(" ")}`
      });
      enumNodeCount += 1;
    }

    const eventTemplate = findDefinitionByTitle(
      definitions,
      title => /subscribe\s+event/i.test(title)
    );

    for (const owner of typeRows) {
      if ((cooperativeWork += 1) % 12 === 0) {
        await yieldToBrowser();
      }
      if (!isUsableCatalogType(owner)) {
        continue;
      }

      const constructors = Array.isArray(owner.constructors)
        ? owner.constructors
        : [];
      constructors.forEach((constructor, index) => {
        if (!constructor || !Array.isArray(constructor.parameters)) {
          skippedCount += 1;
          return;
        }
        const id = `api.ctor.${stableHash(`${owner.fullName}|${constructor.signature}|${index}`)}`;
        registerGeneratedNode(id, createConstructorDefinition(owner, constructor));
        constructorNodeCount += 1;
      });

      const methods = Array.isArray(owner.methods)
        ? owner.methods
        : [];
      for (const method of methods) {
        if (!method || method.isObsolete || !method.name) {
          skippedCount += 1;
          continue;
        }
        const id = `api.method.${method.id || stableHash(`${owner.fullName}|${method.signature}`)}`;
        const definition = createMethodDefinition(owner, method);
        if (definition.runtimeBound) {
          runtimeBoundMethodCount += 1;
        }
        registerGeneratedNode(id, definition);
        methodNodeCount += 1;
      }

      const properties = Array.isArray(owner.properties)
        ? owner.properties
        : [];
      properties.forEach((property, index) => {
        if (!property || property.isObsolete || !property.name) {
          skippedCount += 1;
          return;
        }
        const identity = `${owner.fullName}|${property.name}|${property.type}|${index}`;
        if (property.canRead) {
          registerGeneratedNode(
            `api.property.get.${stableHash(identity)}`,
            createPropertyGetDefinition(owner, property)
          );
          propertyNodeCount += 1;
        }
        if (property.canWrite) {
          registerGeneratedNode(
            `api.property.set.${stableHash(identity)}`,
            createPropertySetDefinition(owner, property)
          );
          propertyNodeCount += 1;
        }
      });

      const fields = Array.isArray(owner.fields)
        ? owner.fields
        : [];
      fields.forEach((field, index) => {
        if (!field || field.isObsolete || !field.name) {
          skippedCount += 1;
          return;
        }
        const identity = `${owner.fullName}|${field.name}|${field.type}|${index}`;
        registerGeneratedNode(
          `api.field.get.${stableHash(identity)}`,
          createFieldGetDefinition(owner, field)
        );
        fieldNodeCount += 1;

        if (!field.isReadOnly && !field.isConst) {
          registerGeneratedNode(
            `api.field.set.${stableHash(identity)}`,
            createFieldSetDefinition(owner, field)
          );
          fieldNodeCount += 1;
        }
      });

      const events = Array.isArray(owner.events)
        ? owner.events
        : [];
      for (const eventInfo of events) {
        if (!eventInfo || eventInfo.isObsolete || !eventInfo.name) {
          skippedCount += 1;
          continue;
        }
        const eventDefinition = createEventDefinition(owner, eventInfo, eventTemplate);
        if (!eventDefinition) {
          skippedCount += 1;
          continue;
        }
        registerGeneratedNode(
          `api.event.${stableHash(`${owner.fullName}|${eventInfo.name}|${eventInfo.handlerType}`)}`,
          eventDefinition
        );
        eventNodeCount += 1;
      }
    }

    cleanupRedundantPaletteNodes(definitions);

    const report = Object.freeze({
      factoryVersion: FACTORY_VERSION,
      catalogSchemaVersion: Number(catalog.schemaVersion || 0),
      engineVersion: String(catalog.engineVersion || "unknown"),
      catalogSource:
        window.RMLApiCatalogInfo?.source ||
        window.RMLApiCatalogSource ||
        "unknown",
      registeredTypes: graphTypeByCs.size,
      typeNodes: typeNodeCount,
      enumNodes: enumNodeCount,
      constructorNodes: constructorNodeCount,
      methodNodes: methodNodeCount,
      runtimeBoundMethods: runtimeBoundMethodCount,
      propertyNodes: propertyNodeCount,
      fieldNodes: fieldNodeCount,
      eventNodes: eventNodeCount,
      skippedMembers: skippedCount,
      totalGeneratedNodes: generatedNodeIds.size
    });

    window.RMLApiNodeFactoryReport = report;
    window.dispatchEvent(
      new CustomEvent("rml-api-node-factory-ready", {
        detail: report
      })
    );
    console.info("RML API Node Factory ready.", report);

    function registerGeneratedNode(id, definition) {
      if (generatedNodeIds.has(id) || definitions[id]) {
        return;
      }

      if (
        isHarmonyCatalogType(
          definition?.catalogType
        )
      ) {
        definition.group = ADVANCED_GROUP;
        definition.harmonyApiNode = true;
        definition.description =
          `${String(
            definition.description ||
            "Low-level Harmony API node."
          )} This scanner-generated node executes as a low-level runtime call in the main mod project. It does not create or deploy an early rml_libs patch assembly automatically.`;
      }

      const dependencyReferences =
        assemblyReferencesForCsType(
          definition?.catalogType || "",
          typeByName.get(
            normalizeCsType(
              definition?.catalogType || ""
            )
          ) || null
        );

      if (dependencyReferences.length > 0) {
        const references = new Map();
        for (const reference of [
          ...(Array.isArray(
            definition.requiredAssemblyReferences
          )
            ? definition.requiredAssemblyReferences
            : []),
          ...dependencyReferences
        ]) {
          const include = String(
            reference?.include || ""
          ).trim();
          if (!include) continue;
          references.set(
            include.toLowerCase(),
            reference
          );
        }
        definition.requiredAssemblyReferences =
          [...references.values()];
      }

      generatedNodeIds.add(id);
      registerNode(id, definition);
    }

    function createConstructorDefinition(owner, constructor) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const parameters = constructor.parameters || [];
      const direct =
        !owner.isAbstract &&
        !owner.isInterface &&
        !owner.isGeneric &&
        canDirectlyReferenceType(ownerCs) &&
        parameters.every(canDirectlyPassParameter);
      const inputs = [port("call", "Call", "impulse")];
      for (const parameter of parameters) {
        if (parameter.isOut) continue;
        inputs.push(parameterPort(parameter));
      }
      const outputs = [
        port("done", "Done", "impulse"),
        port("result", displayTypeName(owner), ownerGraph),
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      ];

      return {
        title: `New · ${displayTypeName(owner)}`,
        group: groupForType(owner, API_GROUPS.constructors),
        symbol: "new",
        description: constructor.signature || `Constructs ${ownerCs}.`,
        inputs,
        outputs,
        catalogGenerated: true,
        catalogType: ownerCs,
        apiSearchText: `${ownerCs} ${constructor.signature || "constructor new"}`,
        runtimeBound: !direct,
        codegenCollect(api) {
          collectActionFields(api, {
            resultCs: direct ? ownerCs : "object",
            resultGraph: direct ? ownerGraph : "object",
            outParameters: []
          });
          if (!direct) ensureApiReflectionRuntime(api);
        },
        codegenAction(api) {
          return direct
            ? directConstructorAction(api, ownerCs, parameters)
            : reflectiveConstructorAction(api, ownerCs, parameters);
        },
        codegenExpression(api) {
          return actionOutputExpression(api, {
            resultGraph: direct ? ownerGraph : "object",
            resultCs: direct ? ownerCs : "object",
            outParameters: []
          });
        }
      };
    }

    function createMethodDefinition(owner, method) {
      const ownerCs = normalizeCsType(owner.fullName || method.declaringType);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const parameters = Array.isArray(method.parameters)
        ? method.parameters
        : [];
      const returnCs = normalizeCsType(method.returnType || "System.Void");
      const isVoid = returnCs === "System.Void" || returnCs === "void";
      const direct = canDirectlyCallMethod(ownerCs, method, parameters);
      const resultCs = direct && !isVoid ? returnCs : "object";
      const resultGraph = !isVoid
        ? (direct ? graphTypeFor(returnCs) : "object")
        : null;
      const inputs = [port("call", "Call", "impulse")];

      if (!method.isStatic) {
        inputs.push(port("target", "Target", ownerGraph));
      }

      if (!direct && method.isGenericMethodDefinition) {
        for (const generic of method.genericParameters || []) {
          inputs.push(port(
            `generic${generic.position}`,
            `Type ${generic.name}`,
            "type",
            {
              help: genericConstraintHelp(generic)
            }
          ));
        }
      }

      for (const parameter of parameters) {
        if (parameter.isOut) continue;
        inputs.push(parameterPort(parameter));
      }

      const outParameters = parameters.filter(parameter =>
        parameter.isOut || parameter.isByRef
      );
      const outputs = [port("done", "Done", "impulse")];
      if (!isVoid) {
        outputs.push(port("result", "Result", resultGraph || "object"));
      }
      for (const parameter of outParameters) {
        outputs.push(port(
          `out${parameter.position}`,
          parameter.name || `Arg ${parameter.position}`,
          direct
            ? graphTypeFor(parameter.elementType || parameter.type)
            : "object"
        ));
      }
      outputs.push(
        port("success", "Success", "bool"),
        port("exception", "Exception", "exception")
      );

      const noisy = isNoisyType(owner) || !direct;
      const group = noisy ? ADVANCED_GROUP : API_GROUPS.methods;
      const titlePrefix = method.isStatic ? "Static" : "Call";

      return {
        title: `${titlePrefix} · ${displayTypeName(owner)}.${method.name}`,
        group,
        symbol: "ƒ",
        description: method.signature || `${ownerCs}.${method.name}`,
        inputs,
        outputs,
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: method.name,
        apiSearchText: `${ownerCs} ${method.name} ${method.signature || ""}`,
        runtimeBound: !direct,
        codegenCollect(api) {
          collectActionFields(api, {
            resultCs,
            resultGraph,
            isVoid,
            outParameters,
            direct
          });
          if (!direct) ensureApiReflectionRuntime(api);
        },
        codegenAction(api) {
          return direct
            ? directMethodAction(api, ownerCs, method, parameters, isVoid)
            : reflectiveMethodAction(api, ownerCs, method, parameters, isVoid);
        },
        codegenExpression(api) {
          return actionOutputExpression(api, {
            resultCs,
            resultGraph,
            isVoid,
            outParameters,
            direct
          });
        }
      };
    }

    function createPropertyGetDefinition(owner, property) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(property.type || "System.Object");
      const valueGraph = graphTypeFor(valueCs);
      const indexes = property.indexParameters || [];
      const inputs = [];
      if (!property.isStatic) {
        inputs.push(port("target", "Target", ownerGraph));
      }
      for (const parameter of indexes) {
        inputs.push(parameterPort(parameter));
      }

      return {
        title: `Get · ${displayTypeName(owner)}.${property.name}`,
        group: groupForType(owner, API_GROUPS.properties),
        symbol: "get",
        description: `Reads ${ownerCs}.${property.name} (${valueCs}).`,
        inputs,
        outputs: [port("value", "Value", valueGraph)],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: property.name,
        apiSearchText: `${ownerCs} ${property.name} property get read ${valueCs}`,
        codegenExpression(api) {
          return propertyAccessExpression(api, ownerCs, property, indexes);
        }
      };
    }

    function createPropertySetDefinition(owner, property) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(property.type || "System.Object");
      const indexes = property.indexParameters || [];
      const inputs = [port("call", "Call", "impulse")];
      if (!property.isStatic) {
        inputs.push(port("target", "Target", ownerGraph));
      }
      for (const parameter of indexes) {
        inputs.push(parameterPort(parameter));
      }
      inputs.push(port("value", "Value", graphTypeFor(valueCs)));

      return {
        title: `Set · ${displayTypeName(owner)}.${property.name}`,
        group: groupForType(owner, API_GROUPS.properties),
        symbol: "set",
        description: `Writes ${ownerCs}.${property.name} (${valueCs}).`,
        inputs,
        outputs: [
          port("done", "Done", "impulse"),
          port("success", "Success", "bool"),
          port("exception", "Exception", "exception")
        ],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: property.name,
        apiSearchText: `${ownerCs} ${property.name} property set write ${valueCs}`,
        codegenCollect(api) {
          collectActionFields(api, { isVoid: true, outParameters: [] });
        },
        codegenAction(api) {
          const fields = actionFieldNames(api);
          const access = propertyAccessExpression(api, ownerCs, property, indexes);
          return `try\n{\n    ${access} = ${api.input("value").code};\n    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
        },
        codegenExpression(api) {
          return actionOutputExpression(api, { isVoid: true, outParameters: [] });
        }
      };
    }

    function createFieldGetDefinition(owner, field) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(field.type || "System.Object");
      const inputs = field.isStatic
        ? []
        : [port("target", "Target", ownerGraph)];

      return {
        title: `Read · ${displayTypeName(owner)}.${field.name}`,
        group: groupForType(owner, API_GROUPS.fields),
        symbol: "fld",
        description: `Reads field ${ownerCs}.${field.name} (${valueCs}).`,
        inputs,
        outputs: [port("value", "Value", graphTypeFor(valueCs))],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: field.name,
        apiSearchText: `${ownerCs} ${field.name} field read get ${valueCs}`,
        codegenExpression(api) {
          const host = field.isStatic
            ? ownerCs
            : `(${api.input("target").code})`;
          return `${host}.${escapeCSharpIdentifier(field.name)}`;
        }
      };
    }

    function createFieldSetDefinition(owner, field) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(field.type || "System.Object");
      const inputs = [port("call", "Call", "impulse")];
      if (!field.isStatic) {
        inputs.push(port("target", "Target", ownerGraph));
      }
      inputs.push(port("value", "Value", graphTypeFor(valueCs)));

      return {
        title: `Write · ${displayTypeName(owner)}.${field.name}`,
        group: groupForType(owner, API_GROUPS.fields),
        symbol: "fld=",
        description: `Writes field ${ownerCs}.${field.name} (${valueCs}).`,
        inputs,
        outputs: [
          port("done", "Done", "impulse"),
          port("success", "Success", "bool"),
          port("exception", "Exception", "exception")
        ],
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: field.name,
        apiSearchText: `${ownerCs} ${field.name} field write set ${valueCs}`,
        codegenCollect(api) {
          collectActionFields(api, { isVoid: true, outParameters: [] });
        },
        codegenAction(api) {
          const fields = actionFieldNames(api);
          const host = field.isStatic
            ? ownerCs
            : `(${api.input("target").code})`;
          return `try\n{\n    ${host}.${escapeCSharpIdentifier(field.name)} = ${api.input("value").code};\n    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
        },
        codegenExpression(api) {
          return actionOutputExpression(api, { isVoid: true, outParameters: [] });
        }
      };
    }

    function createEventDefinition(owner, eventInfo, templateEntry) {
      if (!templateEntry) {
        return null;
      }

      const [templateId, template] = templateEntry;
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const definition = {
        ...template,
        title: `On · ${displayTypeName(owner)}.${eventInfo.name}`,
        group: groupForType(owner, API_GROUPS.events),
        symbol: "evt",
        description: `Typed catalog event wrapper for ${ownerCs}.${eventInfo.name} (${eventInfo.handlerType || "delegate"}).`,
        catalogGenerated: true,
        catalogType: ownerCs,
        catalogMember: eventInfo.name,
        apiSearchText: `${ownerCs} ${eventInfo.name} event ${eventInfo.handlerType || ""}`,
        apiTemplate: templateId
      };

      definition.inputs = (template.inputs || []).map(input => {
        const key = String(input.id || "").toLowerCase();
        if (/target|instance|source|owner/.test(key)) {
          return { ...input, type: eventInfo.isStatic ? "type" : ownerGraph };
        }
        if (/event.*name|name.*event/.test(key) && input.type === "string") {
          return {
            ...input,
            defaultCs: `"${escapeString(eventInfo.name)}"`,
            defaultValue: eventInfo.name
          };
        }
        return { ...input };
      });
      definition.outputs = (template.outputs || []).map(output => ({ ...output }));
      definition.parameters = (template.parameters || []).map(specification => {
        const key = String(specification.key || "").toLowerCase();
        if (key.includes("event")) {
          return {
            ...specification,
            default: eventInfo.name,
            hidden: true
          };
        }
        if (key.includes("type")) {
          return {
            ...specification,
            default: ownerCs,
            hidden: true
          };
        }
        return { ...specification };
      });

      return definition;
    }

    function parameterPort(parameter) {
      const csType = normalizeCsType(parameter.elementType || parameter.type || "System.Object");
      return port(
        `arg${Number(parameter.position || 0)}`,
        parameter.name || `Arg ${Number(parameter.position || 0)}`,
        graphTypeFor(csType),
        {
          optional: parameter.isOptional === true,
          defaultCs: parameter.defaultValueCSharp || undefined,
          apiParameterType: csType,
          help: parameter.hasDefaultValue
            ? `Default: ${parameter.defaultValueCSharp || "default"}`
            : ""
        }
      );
    }

    function graphTypeFor(typeName) {
      const csType = normalizeCsType(typeName);
      if (!csType || csType === "System.Void" || csType === "void") {
        return "object";
      }
      const known = graphTypeByCs.get(csType);
      if (known) return known;
      if (isGenericParameterName(csType) || isOpenTypeExpression(csType)) {
        return "object";
      }
      return registerApiType(csType, typeByName.get(csType)) || "object";
    }

    function directConstructorAction(api, ownerCs, parameters) {
      const fields = actionFieldNames(api);
      const argumentState = buildDirectArguments(api, parameters);
      return `try\n{\n${indent(argumentState.declarations, 4)}    ${fields.result} = new ${ownerCs}(${argumentState.arguments.join(", ")});\n${indent(argumentState.assignments, 4)}    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
    }

    function reflectiveConstructorAction(api, ownerCs, parameters) {
      const fields = actionFieldNames(api);
      const args = parameters
        .filter(parameter => !parameter.isOut)
        .map(parameter => api.input(`arg${parameter.position}`).code);
      return `try\n{\n    System.Type apiType = ResolveApiCatalogType("${escapeString(ownerCs)}") ?? throw new System.TypeLoadException("${escapeString(ownerCs)}");\n    object?[] apiArguments = new object?[] { ${args.join(", ")} };\n    System.Reflection.ConstructorInfo apiConstructor = ResolveApiCatalogConstructor(apiType, ${parameters.length}) ?? throw new System.MissingMethodException(apiType.FullName, ".ctor");\n    ${fields.result} = apiConstructor.Invoke(apiArguments);\n    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
    }

    function directMethodAction(api, ownerCs, method, parameters, isVoid) {
      const fields = actionFieldNames(api);
      const argumentState = buildDirectArguments(api, parameters);
      const host = method.isStatic
        ? ownerCs
        : `(${api.input("target").code})`;
      const call = `${host}.${escapeCSharpIdentifier(method.name)}(${argumentState.arguments.join(", ")})`;
      const invocation = isVoid
        ? `${call};`
        : `${fields.result} = ${call};`;
      return `try\n{\n${indent(argumentState.declarations, 4)}    ${invocation}\n${indent(argumentState.assignments, 4)}    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
    }

    function reflectiveMethodAction(api, ownerCs, method, parameters, isVoid) {
      const fields = actionFieldNames(api);
      const supplied = [];
      for (const parameter of parameters) {
        supplied.push(parameter.isOut
          ? "null"
          : api.input(`arg${parameter.position}`).code);
      }
      const genericInputs = (method.genericParameters || [])
        .map(generic => api.input(`generic${generic.position}`).code);
      const target = method.isStatic
        ? "null"
        : api.input("target").code;
      const outAssignments = parameters
        .filter(parameter => parameter.isOut || parameter.isByRef)
        .map(parameter => `${fields.out(parameter.position)} = apiArguments[${parameter.position}];`)
        .join("\n    ");
      const resultAssignment = isVoid
        ? "_ = apiMethod.Invoke(apiTarget, apiArguments);"
        : `${fields.result} = apiMethod.Invoke(apiTarget, apiArguments);`;

      return `try\n{\n    System.Type apiDeclaringType = ResolveApiCatalogType("${escapeString(ownerCs)}") ?? throw new System.TypeLoadException("${escapeString(ownerCs)}");\n    object? apiTarget = ${target};\n    object?[] apiArguments = new object?[] { ${supplied.join(", ")} };\n    System.Reflection.MethodInfo apiMethod = ResolveApiCatalogMethod(apiDeclaringType, "${escapeString(method.name)}", ${parameters.length}, ${(method.genericParameters || []).length}, ${method.isStatic ? "true" : "false"}) ?? throw new System.MissingMethodException(apiDeclaringType.FullName, "${escapeString(method.name)}");\n${genericInputs.length > 0 ? `    apiMethod = apiMethod.MakeGenericMethod(new System.Type[] { ${genericInputs.join(", ")} });\n` : ""}    ${resultAssignment}\n${outAssignments ? `    ${outAssignments}\n` : ""}    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
    }

    function buildDirectArguments(api, parameters) {
      const token = api.token(api.node.id);
      const declarations = [];
      const assignments = [];
      const argumentsList = [];
      const fields = actionFieldNames(api);

      for (const parameter of parameters) {
        const position = Number(parameter.position || 0);
        const csType = normalizeCsType(parameter.elementType || parameter.type || "System.Object");
        const local = `_apiArg${position}${token}`;
        if (parameter.isOut) {
          declarations.push(`${csType} ${local};`);
          argumentsList.push(`out ${local}`);
          assignments.push(`${fields.out(position)} = ${local};`);
        } else if (parameter.isByRef) {
          declarations.push(`${csType} ${local} = ${api.input(`arg${position}`).code};`);
          argumentsList.push(`ref ${local}`);
          assignments.push(`${fields.out(position)} = ${local};`);
        } else {
          argumentsList.push(api.input(`arg${position}`).code);
        }
      }

      return {
        declarations: declarations.join("\n") + (declarations.length ? "\n" : ""),
        arguments: argumentsList,
        assignments: assignments.join("\n") + (assignments.length ? "\n" : "")
      };
    }

    function propertyAccessExpression(api, ownerCs, property, indexes) {
      const host = property.isStatic
        ? ownerCs
        : `(${api.input("target").code})`;
      if (indexes.length > 0) {
        const indexValues = indexes.map(parameter =>
          api.input(`arg${parameter.position}`).code
        );
        return `${host}[${indexValues.join(", ")}]`;
      }
      return `${host}.${escapeCSharpIdentifier(property.name)}`;
    }

    function collectActionFields(api, descriptor) {
      const fields = actionFieldNames(api);
      api.addField(
        `${api.node.id}.apiSuccess`,
        `private static bool ${fields.success};`
      );
      api.addField(
        `${api.node.id}.apiException`,
        `private static System.Exception? ${fields.exception};`
      );

      if (!descriptor.isVoid) {
        api.addField(
          `${api.node.id}.apiResult`,
          `private static ${descriptor.resultCs || "object"} ${fields.result} = default!;`
        );
      }

      for (const parameter of descriptor.outParameters || []) {
        const csType = descriptor.direct
          ? normalizeCsType(parameter.elementType || parameter.type || "System.Object")
          : "object";
        api.addField(
          `${api.node.id}.apiOut.${parameter.position}`,
          `private static ${csType} ${fields.out(parameter.position)} = default!;`
        );
      }
    }

    function actionOutputExpression(api, descriptor) {
      const fields = actionFieldNames(api);
      const output = outputPortId(api);
      if (output === "success") return fields.success;
      if (output === "exception") return fields.exception;
      if (output === "result" && !descriptor.isVoid) return fields.result;
      const outMatch = /^out(\d+)$/.exec(output);
      if (outMatch) return fields.out(Number(outMatch[1]));
      if (!descriptor.isVoid) return fields.result;
      return "default!";
    }

    function actionFieldNames(api) {
      const token = api.token(api.node.id);
      return {
        result: `_apiResult${token}`,
        success: `_apiSuccess${token}`,
        exception: `_apiException${token}`,
        out(position) {
          return `_apiOut${Number(position)}${token}`;
        }
      };
    }

    function outputPortId(api) {
      return String(
        api.outputPortId ??
        api.outputId ??
        api.portId ??
        api.output?.id ??
        api.port?.id ??
        api.connection?.fromPort ??
        ""
      );
    }

    function ensureApiReflectionRuntime(api) {
      api.addUsing("System.Linq");
      api.addUsing("System.Reflection");
      api.addMember("api.catalog.runtime", String.raw`
private static System.Type? ResolveApiCatalogType(string? fullName)
{
    if (string.IsNullOrWhiteSpace(fullName))
    {
        return null;
    }

    System.Type? direct = System.Type.GetType(
        fullName,
        throwOnError: false,
        ignoreCase: false);

    if (direct is not null)
    {
        return direct;
    }

    foreach (System.Reflection.Assembly assembly in System.AppDomain.CurrentDomain.GetAssemblies())
    {
        try
        {
            System.Type? candidate = assembly.GetType(
                fullName,
                throwOnError: false,
                ignoreCase: false);

            if (candidate is not null)
            {
                return candidate;
            }
        }
        catch
        {
        }
    }

    return null;
}

private static System.Reflection.ConstructorInfo? ResolveApiCatalogConstructor(
    System.Type declaringType,
    int parameterCount)
{
    return declaringType
        .GetConstructors(
            System.Reflection.BindingFlags.Public |
            System.Reflection.BindingFlags.Instance)
        .Where(constructor => constructor.GetParameters().Length == parameterCount)
        .OrderBy(constructor => constructor.MetadataToken)
        .FirstOrDefault();
}

private static System.Reflection.MethodInfo? ResolveApiCatalogMethod(
    System.Type declaringType,
    string methodName,
    int parameterCount,
    int genericParameterCount,
    bool isStatic)
{
    System.Reflection.BindingFlags flags =
        System.Reflection.BindingFlags.Public |
        (isStatic
            ? System.Reflection.BindingFlags.Static
            : System.Reflection.BindingFlags.Instance);

    return declaringType
        .GetMethods(flags)
        .Where(method =>
            string.Equals(method.Name, methodName, System.StringComparison.Ordinal) &&
            method.GetParameters().Length == parameterCount &&
            method.GetGenericArguments().Length == genericParameterCount)
        .OrderBy(method => method.MetadataToken)
        .FirstOrDefault();
}
`);
    }

    function canDirectlyCallMethod(ownerCs, method, parameters) {
      return (
        canDirectlyReferenceType(ownerCs) &&
        !method.isGenericMethodDefinition &&
        canDirectlyReferenceType(method.returnType || "System.Void") &&
        parameters.every(canDirectlyPassParameter) &&
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(method.name || ""))
      );
    }

    function canDirectlyPassParameter(parameter) {
      const type = normalizeCsType(parameter.elementType || parameter.type || "");
      return canDirectlyReferenceType(type);
    }

    function canDirectlyReferenceType(typeName) {
      const type = normalizeCsType(typeName);
      return Boolean(
        type &&
        !type.includes("*") &&
        !type.endsWith("&") &&
        !isOpenTypeExpression(type) &&
        !isGenericParameterName(type)
      );
    }

    function cleanupRedundantPaletteNodes(allDefinitions) {
      const fullyReplaced = new Set([
        "Slot Attach API",
        "API Enum Constant"
      ]);
      const advancedFallbacks = new Set([
        "Find Type",
        "Get MethodInfo",
        "Invoke MethodInfo",
        "Create Instance",
        "Read Slot / Component Member",
        "Write Slot / Component Member",
        "Subscribe Event"
      ]);

      for (const [operatorId, definition] of Object.entries(allDefinitions)) {
        if (!definition || typeof definition !== "object") continue;
        const title = String(definition.title || "");
        if (fullyReplaced.has(title)) {
          delete allDefinitions[operatorId];
        } else if (advancedFallbacks.has(title)) {
          definition.group = ADVANCED_GROUP;
          definition.catalogFallback = true;
        }
      }
    }

    function findDefinitionByTitle(allDefinitions, predicate) {
      for (const entry of Object.entries(allDefinitions)) {
        if (predicate(String(entry[1]?.title || ""))) {
          return entry;
        }
      }
      return null;
    }

    function groupForType(row, normalGroup) {
      return (
        isNoisyType(row) ||
        isHarmonyCatalogType(
          row?.fullName || row
        )
      )
        ? ADVANCED_GROUP
        : normalGroup;
    }

    function isHarmonyCatalogType(value) {
      const fullName = normalizeCsType(
        value?.fullName || value
      );

      return (
        fullName === "HarmonyLib" ||
        fullName.startsWith(
          "HarmonyLib."
        )
      );
    }

    function isNoisyType(row) {
      return Boolean(
        row?.isObsolete ||
        row?.isLegacyNamed ||
        row?.isDebugNamed ||
        row?.isEditorNamed ||
        row?.isToolNamed ||
        row?.isGizmoNamed
      );
    }

    function isUsableCatalogType(row) {
      if (!row || row.isPublic === false || !row.fullName) return false;
      if (row.isObsolete || row.isLegacyNamed) return false;
      const fullName = normalizeCsType(row.fullName);
      return Boolean(
        fullName &&
        fullName !== "System.Void" &&
        !fullName.includes("<>") &&
        !isOpenTypeExpression(fullName)
      );
    }

    function displayTypeName(row) {
      return row?.name || shortTypeName(row?.fullName || "Type");
    }
  }

  function splitTopLevelTypeArguments(value) {
    const text = String(value || "");
    const result = [];
    let start = 0;
    let depth = 0;

    for (let index = 0; index < text.length; index += 1) {
      const character = text[index];

      if (character === "<" || character === "[" || character === "(") {
        depth += 1;
      } else if (character === ">" || character === "]" || character === ")") {
        depth = Math.max(0, depth - 1);
      } else if (character === "," && depth === 0) {
        result.push(text.slice(start, index).trim());
        start = index + 1;
      }
    }

    const tail = text.slice(start).trim();
    if (tail) result.push(tail);
    return result;
  }

  function firstGenericTypeParts(value) {
    const text = normalizeCsType(value);
    const open = text.indexOf("<");

    if (open < 0) {
      return null;
    }

    let depth = 0;
    let close = -1;

    for (let index = open; index < text.length; index += 1) {
      if (text[index] === "<") {
        depth += 1;
      } else if (text[index] === ">") {
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
      head: text.slice(0, open).trim(),
      arguments: splitTopLevelTypeArguments(
        text.slice(open + 1, close)
      ),
      suffix: text.slice(close + 1).trim()
    };
  }

  function genericTypeShape(value) {
    const parsed = firstGenericTypeParts(value);
    if (!parsed) return "";

    return (
      `${parsed.head.replace(/\s+/g, "")}` +
      `${parsed.suffix.replace(/\s+/g, "")}` +
      `|${parsed.arguments.length}`
    );
  }

  function genericTypeSubstitutions(
    templateType,
    actualType
  ) {
    const template =
      firstGenericTypeParts(templateType);
    const actual =
      firstGenericTypeParts(actualType);
    const result = new Map();

    if (
      !template ||
      !actual ||
      genericTypeShape(templateType) !==
        genericTypeShape(actualType) ||
      template.arguments.length !==
        actual.arguments.length
    ) {
      return result;
    }

    for (
      let index = 0;
      index < template.arguments.length;
      index += 1
    ) {
      const parameter =
        normalizeCsType(
          template.arguments[index]
        );

      if (isGenericParameterName(parameter)) {
        result.set(
          parameter,
          normalizeCsType(
            actual.arguments[index]
          )
        );
      }
    }

    return result;
  }

  function substituteGenericTypeParameters(
    value,
    substitutions
  ) {
    let result = normalizeCsType(value);

    for (const [parameter, replacement] of
      substitutions instanceof Map
        ? substitutions
        : []) {
      result = result.replace(
        new RegExp(
          `(^|[^A-Za-z0-9_])${parameter.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=$|[^A-Za-z0-9_])`,
          "g"
        ),
        (_match, prefix) =>
          `${prefix}${replacement}`
      );
    }

    return result;
  }

  function directEnumerableElementCsType(value) {
    const text = normalizeCsType(value);

    if (
      !text ||
      text === "System.String" ||
      text === "string"
    ) {
      return null;
    }

    const array = text.match(
      /^(.*)\[(?:,*)\]$/
    );

    if (array) {
      return normalizeCsType(array[1]);
    }

    if (text === "System.Collections.IEnumerable") {
      return "System.Object";
    }

    const parsed = firstGenericTypeParts(text);
    if (!parsed) return null;

    const head = parsed.head.replace(/\s+/g, "");
    const suffix = parsed.suffix.replace(/\s+/g, "");
    const argumentsList = parsed.arguments;
    const oneElementCollections = new Set([
      "System.Collections.Generic.IEnumerable",
      "System.Collections.Generic.ICollection",
      "System.Collections.Generic.IList",
      "System.Collections.Generic.IReadOnlyCollection",
      "System.Collections.Generic.IReadOnlyList",
      "System.Collections.Generic.ISet",
      "System.Collections.Generic.List",
      "System.Collections.Generic.HashSet",
      "System.Collections.Generic.Queue",
      "System.Collections.Generic.Stack",
      "System.Collections.Generic.LinkedList",
      "System.Collections.ObjectModel.Collection",
      "System.Collections.ObjectModel.ReadOnlyCollection",
      "System.Collections.ObjectModel.ObservableCollection",
      "System.Collections.Concurrent.ConcurrentBag",
      "System.Collections.Concurrent.ConcurrentQueue",
      "System.Collections.Concurrent.ConcurrentStack",
      "System.Collections.Immutable.ImmutableArray",
      "System.Collections.Immutable.ImmutableList",
      "System.Collections.Immutable.ImmutableHashSet"
    ]);

    if (
      !suffix &&
      argumentsList.length === 1 &&
      oneElementCollections.has(head)
    ) {
      return argumentsList[0];
    }

    if (
      head === "System.Linq.IGrouping" &&
      argumentsList.length === 2
    ) {
      return argumentsList[1];
    }

    const dictionaryHeads = new Set([
      "System.Collections.Generic.Dictionary",
      "System.Collections.Generic.IDictionary",
      "System.Collections.Generic.IReadOnlyDictionary",
      "System.Collections.Concurrent.ConcurrentDictionary",
      "System.Collections.Immutable.ImmutableDictionary"
    ]);

    if (
      dictionaryHeads.has(head) &&
      argumentsList.length === 2
    ) {
      if (suffix.endsWith(".ValueCollection")) {
        return argumentsList[1];
      }

      if (suffix.endsWith(".KeyCollection")) {
        return argumentsList[0];
      }

      if (!suffix) {
        return (
          "System.Collections.Generic.KeyValuePair<" +
          `${argumentsList[0]}, ${argumentsList[1]}>`
        );
      }
    }

    return null;
  }

  function normalizeCsType(value) {
    let text = String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, " ");
    if (text.endsWith("?")) {
      text = text.slice(0, -1);
    }
    return text;
  }

  function normalizeTypeForLookup(value) {
    return normalizeCsType(value)
      .replace(/\s+/g, "")
      .replace(/System\.Nullable<(.+)>$/, "$1");
  }

  function isOpenTypeExpression(value) {
    const text = normalizeCsType(value);
    if (!text) return true;
    if (/`\d+/.test(text)) return true;
    const genericBody = text.match(/<(.+)>/g);
    if (!genericBody) return false;
    return /(?:^|[<, ])(?:T|T[A-Z][A-Za-z0-9_]*)(?:[>, ]|$)/.test(text);
  }

  function isGenericParameterName(value) {
    return /^(?:T|T[A-Z][A-Za-z0-9_]*)$/.test(normalizeCsType(value));
  }

  function looksLikeValueType(value) {
    const text = normalizeCsType(value);
    return /^(?:System\.)?(?:Boolean|Byte|SByte|Int16|UInt16|Int32|UInt32|Int64|UInt64|Single|Double|Decimal|Char|DateTime|TimeSpan|Guid)$/.test(text) ||
      /(?:^|\.)(?:int|float|double|byte|sbyte|short|ushort|uint|long|ulong)[234]$/.test(text);
  }

  function apiGraphTypeId(csType) {
    return `api.${slug(shortTypeName(csType))}.${stableHash(csType)}`;
  }

  function shortTypeName(value) {
    const text = normalizeCsType(value);
    const generic = text.lastIndexOf("<");
    const head = generic >= 0 ? text.slice(0, generic) : text;
    const name = head.split(".").pop() || head || "Type";
    return generic >= 0
      ? `${name}${text.slice(generic)}`
      : name;
  }

  function slug(value) {
    const result = String(value || "type")
      .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 42);
    return result || "type";
  }

  function stableHash(value) {
    const text = String(value || "");
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;
    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 0x01000193) >>> 0;
      second ^= code + index;
      second = Math.imul(second, 0x85ebca6b) >>> 0;
    }
    return first.toString(16).padStart(8, "0") +
      second.toString(16).padStart(8, "0");
  }

  function colorForString(value) {
    const hash = parseInt(stableHash(value).slice(0, 8), 16) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue} 62% 64%)`;
  }

  function shortBadge(value) {
    const letters = String(value || "API")
      .replace(/[^A-Za-z0-9]+/g, " ")
      .trim()
      .split(/\s+/)
      .map(word => word[0] || "")
      .join("")
      .toUpperCase();
    return (letters || String(value || "API").slice(0, 4).toUpperCase()).slice(0, 7);
  }

  const CSHARP_KEYWORDS = new Set([
    "abstract", "as", "base", "bool", "break", "byte", "case", "catch",
    "char", "checked", "class", "const", "continue", "decimal", "default",
    "delegate", "do", "double", "else", "enum", "event", "explicit", "extern",
    "false", "finally", "fixed", "float", "for", "foreach", "goto", "if",
    "implicit", "in", "int", "interface", "internal", "is", "lock", "long",
    "namespace", "new", "null", "object", "operator", "out", "override",
    "params", "private", "protected", "public", "readonly", "ref", "return",
    "sbyte", "sealed", "short", "sizeof", "stackalloc", "static", "string",
    "struct", "switch", "this", "throw", "true", "try", "typeof", "uint",
    "ulong", "unchecked", "unsafe", "ushort", "using", "virtual", "void",
    "volatile", "while"
  ]);

  function escapeCSharpIdentifier(value) {
    const text = String(value || "_");
    return CSHARP_KEYWORDS.has(text)
      ? `@${text}`
      : text;
  }

  function escapeString(value) {
    return String(value || "")
      .replace(/\\/g, "\\\\")
      .replace(/\r/g, "\\r")
      .replace(/\n/g, "\\n")
      .replace(/"/g, '\\"');
  }

  function indent(value, spaces) {
    const text = String(value || "");
    if (!text) return "";
    const prefix = " ".repeat(spaces);
    return text
      .split("\n")
      .filter((line, index, lines) => !(index === lines.length - 1 && line === ""))
      .map(line => `${prefix}${line}\n`)
      .join("");
  }

  function genericConstraintHelp(generic) {
    const parts = [];
    if (generic.referenceTypeConstraint) parts.push("class");
    if (generic.valueTypeConstraint) parts.push("struct");
    for (const constraint of generic.constraints || []) parts.push(constraint);
    if (generic.defaultConstructorConstraint) parts.push("new()");
    return parts.length > 0
      ? `Constraints: ${parts.join(", ")}`
      : "Select the concrete generic type argument.";
  }

  window.addEventListener("rml-api-catalog-ready", boot, { once: true });
  window.addEventListener("rml-catalog-ready", boot, { once: true });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  }
  boot();
})();