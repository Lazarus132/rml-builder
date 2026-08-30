(() => {
  "use strict";

  const FACTORY_VERSION = 21;
  const API_VERIFICATION_SCHEMA_VERSION = 2;
  const ADVANCED_GROUP = "Advanced / Raw C#";
  const UNAVAILABLE_GROUP = "Unavailable API";
  const API_GROUPS = Object.freeze({
    types: "API · Types & Enums",
    constructors: "API · Constructors",
    methods: "API · Methods",
    properties: "API · Properties",
    fields: "API · Fields",
    events: "API · Events"
  });

  let prerequisiteWaitInstalled = false;
  let factoryBuildPromise = null;
  let legacyOperatorResolver = null;
  let factoryReadySettled = false;
  let resolveFactoryReady;

  const factoryReady =
    new Promise(resolve => {
      resolveFactoryReady = resolve;
    });

  Object.defineProperty(
    window,
    "RMLApiNodeFactoryReady",
    {
      value: factoryReady,
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  function completeFactoryReady(report) {
    if (!factoryReadySettled) {
      factoryReadySettled = true;
      resolveFactoryReady?.(report || null);
    }

    return report || null;
  }

  function apiCatalogIdentity(catalog) {
    return [
      String(
        catalog?.catalogFingerprint ||
        catalog?.assemblyFingerprint ||
        ""
      ),
      String(
        catalog?.engineVersion ||
        ""
      )
    ].join("|");
  }

  function portablePortRole(kind, direction, port, parameters = []) {
    const explicit = String(port?.role || port?.roleKey || "").trim();
    if (explicit) return explicit;
    const id = String(port?.id || "").trim();
    const fixed = new Set([
      "call", "done", "success", "exception", "target", "result", "value"
    ]);
    if (fixed.has(id)) return `${direction}:${id}`;
    let match = /^arg(\d+)$/.exec(id);
    if (match) return `parameter:${Number(match[1])}:input`;
    match = /^out(\d+)$/.exec(id);
    if (match) return `parameter:${Number(match[1])}:output`;
    match = /^generic(\d+)$/.exec(id);
    if (match) return `generic:${Number(match[1])}:input`;
    const parameter = parameters.find(value =>
      String(value?.name || "") === id
    );
    if (parameter) {
      return `parameter:${Math.max(0, Number(parameter.position) || 0)}:${direction}`;
    }
    return `${String(kind || "api")}:${direction}:${id}`;
  }

  function stableContractId(contract) {
    if (!contract || typeof contract !== "object") return "";
    const supplied = String(contract.stableContractId || "").trim();
    if (supplied) return supplied;
    const ownerType = String(contract.ownerType || "")
      .replace(/^global::/, "")
      .replace(/\s+/g, "")
      .replace(/&$/, "");
    const kind = String(contract.kind || "").trim();
    if (!ownerType || !kind) return "";
    return `contract.${stableHash(JSON.stringify({
      version: 1,
      ownerType,
      kind,
      memberName: String(contract.memberName || ""),
      isStatic: contract.isStatic === true,
      genericArity: Math.max(0, Number(contract.genericArity) || 0)
    }))}`;
  }

  function registerUnavailableApiOperator(operatorId, apiContract, required = {}) {
    const id = String(operatorId || "").trim();
    const registry = window.RMLModNodeRegistry;
    if (!id || !registry) return "";

    const hasApiContract =
      apiContract &&
      typeof apiContract === "object" &&
      !Array.isArray(apiContract);
    const contract = hasApiContract
      ? structuredClone(apiContract)
      : {};
    contract.schemaVersion = 3;
    contract.stableContractId = stableContractId(contract);
    for (const [direction, key] of [["input", "inputPorts"], ["output", "outputPorts"]]) {
      contract[key] = (Array.isArray(contract[key]) ? contract[key] : []).map(port => ({
        ...port,
        role: portablePortRole(contract.kind, direction, port, contract.parameters)
      }));
    }
    const referencedInputs = Array.isArray(required.inputPorts)
      ? required.inputPorts.map(String)
      : [];
    const referencedOutputs = Array.isArray(required.outputPorts)
      ? required.outputPorts.map(String)
      : [];
    const existing = registry.getNodeDefinition?.(id);
    if (existing?.unavailableApiContract === true) return id;
    if (existing && !hasApiContract) return id;
    if (existing?.catalogGenerated === true && existing.apiVerification) {
      const available = existing.apiVerification;
      const sameStableContract =
        Boolean(stableContractId(contract)) &&
        stableContractId(contract) === stableContractId(available);
      const sameSemanticMember =
        String(contract.kind || "") === String(available.kind || "") &&
        String(contract.ownerType || "").replace(/^global::/, "") ===
          String(available.ownerType || "").replace(/^global::/, "") &&
        String(contract.memberName || "") === String(available.memberName || "") &&
        contract.isStatic === available.isStatic &&
        Math.max(0, Number(contract.genericArity) || 0) ===
          Math.max(0, Number(available.genericArity) || 0);
      const existingInputIds = new Set((existing.inputs || []).map(port => String(port?.id || "")));
      const existingOutputIds = new Set((existing.outputs || []).map(port => String(port?.id || "")));
      if (
        (sameStableContract || sameSemanticMember) &&
        referencedInputs.every(portId => existingInputIds.has(portId)) &&
        referencedOutputs.every(portId => existingOutputIds.has(portId))
      ) {
        return id;
      }
    }

    let registrationId = id;
    if (existing) {
      const collisionIdentity = JSON.stringify({
        id,
        stableContractId: contract.stableContractId,
        inputPorts: referencedInputs,
        outputPorts: referencedOutputs
      });
      registrationId =
        `unavailable.preserved.${stableHash(collisionIdentity)}`;
      const preserved =
        registry.getNodeDefinition?.(
          registrationId
        );
      if (preserved?.unavailableApiContract === true) {
        return registrationId;
      }
      if (preserved) {
        registrationId +=
          `.${stableHash(collisionIdentity + "|collision")}`;
      }
    }
    const makePorts = (direction, declared, referenced) => {
      const rows = Array.isArray(declared) ? declared : [];
      const byId = new Map(rows.map(port => [String(port?.id || ""), port]));
      for (const portId of Array.isArray(referenced) ? referenced : []) {
        if (!byId.has(String(portId))) {
          const inferredType = ["call", "done", "true", "false", "reset"].includes(String(portId))
            ? "impulse"
            : String(portId) === "success"
              ? "bool"
              : String(portId) === "exception"
                ? "exception"
                : "object";
          byId.set(String(portId), { id: String(portId), type: inferredType });
        }
      }
      return [...byId.values()].filter(port => String(port?.id || "")).map(port => {
        const requestedType = String(port?.type || "object");
        let type = requestedType;
        if (!registry.getTypeInformation?.(type)) {
          if (type && type !== "T" && !port?.typeVar) {
            registry.registerType?.(type, {
              label: `Unavailable · ${type}`,
              short: "API?",
              color: "#ff6f91",
              csType: "object",
              defaultCs: "null!",
              referenceType: true,
              valueType: true,
              globalGenericCandidate: false,
              assignableTo: ["object"],
              constraints: ["value", "reference"]
            });
          } else {
            type = "object";
          }
        }
        return registry.port(String(port.id), String(port.label || port.id), type, {
          optional: port.optional === true,
          unavailableApiPort: true,
          semanticRole: portablePortRole(contract.kind, direction, port, contract.parameters)
        });
      });
    };
    const inputs = makePorts("input", contract.inputPorts, referencedInputs);
    const outputs = makePorts("output", contract.outputPorts, referencedOutputs);
    contract.inputPorts = inputs.map(port => ({
      id: port.id,
      type: port.type,
      optional: port.optional === true,
      role: port.semanticRole
    }));
    contract.outputPorts = outputs.map(port => ({
      id: port.id,
      type: port.type,
      optional: port.optional === true,
      role: port.semanticRole
    }));
    const displayName = [contract.ownerType, contract.memberName].filter(Boolean).join(".") || id;
    const isApi = id.startsWith("api.");
    registry.registerGroup?.(UNAVAILABLE_GROUP, { after: ADVANCED_GROUP });
    const registered = registry.registerNode(registrationId, {
      title: `${isApi ? "Unavailable API" : "Unavailable Operator"} · ${displayName}`,
      group: UNAVAILABLE_GROUP,
      symbol: "API?",
      description: `The original ${isApi ? "API contract" : "node contract"} is preserved, but the current Builder has no safely equivalent operator. The project remains editable; only export of this unresolved runtime path is blocked.`,
      hiddenFromPalette: true,
      expertOnly: true,
      unavailableApiContract: true,
      preservedApiContract: contract,
      inputs,
      outputs,
      parameters: [],
      codegenCollect(api) {
        api.diagnostic?.(`Unavailable API contract '${displayName}' (${id}) must be resolved before export.`);
      },
      codegenExpression(api) {
        api.diagnostic?.(`Unavailable API contract '${displayName}' (${id}) must be resolved before export.`);
        return api.csDefault?.(api.type || "object") || "default!";
      },
      codegenAction(api) {
        api.diagnostic?.(`Unavailable API contract '${displayName}' (${id}) must be resolved before export.`);
        return "";
      }
    });
    return registered === false
      ? ""
      : registrationId;
  }

  async function rebuildFactoryForCatalog(
    catalog
  ) {
    const registry =
      window.RMLModNodeRegistry;

    if (
      !catalog ||
      typeof catalog !== "object" ||
      !registry ||
      typeof registry.getNodeDefinitions !==
        "function"
    ) {
      throw new Error(
        "The live API node factory cannot be rebuilt because its catalog or registry is unavailable."
      );
    }

    const definitions = registry.getNodeDefinitions();
    const typeDefinitions = registry.getTypeDefinitions?.() || {};
    const valueTypes = registry.getValueTypes?.() || [];
    const stagedDefinitions = Object.fromEntries(
      Object.entries(definitions).filter(([, definition]) =>
        definition?.catalogGenerated !== true &&
        definition?.unavailableApiContract !== true
      )
    );
    const stagedTypes = structuredClone(typeDefinitions);
    const stagedValueTypes = [...valueTypes];
    const stagedGroups = [];
    const previousReport = window.RMLApiNodeFactoryReport || null;
    const previousFactoryVersion = Number(window.__RMLApiNodeFactoryVersion) || 0;
    const previousLegacyOperatorResolver = legacyOperatorResolver;
    const stagingRegistry = {
      ...registry,
      registerGroup(name, options) {
        stagedGroups.push([name, options]);
      },
      registerNode(id, definition) {
        if (stagedDefinitions[id]) return false;
        stagedDefinitions[id] = definition;
        return true;
      },
      registerType(type, information = {}) {
        const id = String(type || "").trim();
        if (!id) throw new TypeError("Graph type id must be a non-empty string.");
        const assemblyReferences = Array.isArray(information.assemblyReferences)
          ? information.assemblyReferences.filter(reference =>
              reference && typeof reference === "object" && String(reference.include || "").trim()
            ).map(reference => ({
              include: String(reference.include || "").trim(),
              hintPath: String(reference.hintPath || "").trim(),
              private: reference.private === true
            }))
          : [];
        const assemblies = [...new Set([
          ...(Array.isArray(information.assemblies) ? information.assemblies : []),
          information.assembly
        ].map(value => String(value || "").trim()).filter(Boolean))];
        stagedTypes[id] = {
          label: information.label || id,
          short: information.short || id.slice(0, 4).toUpperCase(),
          color: information.color || "#9da8b4",
          ...information,
          assemblies,
          assemblyReferences
        };
        if (information.valueType === true &&
            information.globalGenericCandidate !== false &&
            !stagedValueTypes.includes(id)) {
          stagedValueTypes.push(id);
        }
      },
      getNodeDefinitions: () => stagedDefinitions,
      getTypeDefinitions: () => stagedTypes,
      getTypeInformation(type) {
        const id =
          typeof type === "string" && type.startsWith("enum:")
            ? "enum"
            : type || "generic";
        return stagedTypes[id] || null;
      },
      getValueTypes: () => stagedValueTypes
    };

    try {
      const report = await buildFactory(
        stagingRegistry,
        catalog,
        false
      );
      const stagedLegacyOperatorResolver = legacyOperatorResolver;
      legacyOperatorResolver = previousLegacyOperatorResolver;

      if (
        !report ||
        report.verificationPassed !== true ||
        apiCatalogIdentity(report) !==
          apiCatalogIdentity(catalog)
      ) {
        const details = Array.isArray(report?.verificationErrors)
          ? report.verificationErrors.slice(0, 12).join(" | ")
          : "";
        throw new Error(
          `The live API node factory did not produce a complete verified contract for the current catalog.${details ? ` ${details}` : ""}`
        );
      }

      for (const id of Object.keys(definitions)) {
        if (definitions[id]?.catalogGenerated === true) delete definitions[id];
      }
      for (const [id, definition] of Object.entries(stagedDefinitions)) {
        if (definition?.catalogGenerated === true) {
          if (definitions[id]?.unavailableApiContract === true) delete definitions[id];
          definitions[id] = definition;
        }
      }
      for (const id of Object.keys(typeDefinitions)) delete typeDefinitions[id];
      Object.assign(typeDefinitions, stagedTypes);
      valueTypes.splice(0, valueTypes.length, ...stagedValueTypes);
      for (const [name, options] of stagedGroups) registry.registerGroup(name, options);
      legacyOperatorResolver = stagedLegacyOperatorResolver;
      window.__RMLApiNodeFactoryVersion = FACTORY_VERSION;
      window.RMLApiNodeFactoryReport = report;
      window.__RMLNodeDefinitionRevision =
        (Number(window.__RMLNodeDefinitionRevision) || 0) + 1;
      window.dispatchEvent(
        new CustomEvent("rml-api-node-factory-ready", { detail: report })
      );

      completeFactoryReady(report);
      return report;
    } catch (error) {
      window.__RMLApiNodeFactoryVersion = previousFactoryVersion;
      window.RMLApiNodeFactoryReport = previousReport;
      legacyOperatorResolver = previousLegacyOperatorResolver;

      throw error;
    }
  }

  Object.defineProperty(
    window,
    "RMLApiNodeFactoryController",
    {
      value: Object.freeze({
        version: 4,
        rebuild(catalog) {
          const previous =
            factoryBuildPromise;
          const run = () =>
            rebuildFactoryForCatalog(
              catalog
            );

          factoryBuildPromise = previous
            ? Promise.resolve(previous)
                .then(run, run)
            : run();

          return factoryBuildPromise;
        },
        async resolveRequiredOperators(
          requiredNodes,
          catalog
        ) {
          if (factoryBuildPromise) {
            await factoryBuildPromise;
          }

          const report =
            window.RMLApiNodeFactoryReport;

          if (
            !legacyOperatorResolver ||
            !report ||
            report.verificationPassed !==
              true ||
            apiCatalogIdentity(report) !==
              apiCatalogIdentity(catalog)
          ) {
            return Object.freeze({
              attempted: false,
              resolved: 0,
              unresolved:
                Array.isArray(requiredNodes)
                  ? requiredNodes.length
                  : 0
            });
          }

          return legacyOperatorResolver(
            requiredNodes,
            catalog
          );
        },
        ensureUnavailableOperator(operatorId, apiContract, required) {
          return registerUnavailableApiOperator(operatorId, apiContract, required);
        }
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  let lastCooperativeYieldAt = 0;

  function yieldToBrowser() {
    const now =
      typeof window.performance?.now ===
        "function"
        ? window.performance.now()
        : Date.now();

    if (
      lastCooperativeYieldAt > 0 &&
      now - lastCooperativeYieldAt < 16
    ) {
      return Promise.resolve();
    }

    lastCooperativeYieldAt = now;
    if (
      window.scheduler &&
      typeof window.scheduler.yield ===
        "function"
    ) {
      return window.scheduler.yield();
    }

    return new Promise(resolve => {
      if (
        typeof requestAnimationFrame ===
        "function"
      ) {
        requestAnimationFrame(() =>
          resolve()
        );
      } else {
        window.setTimeout(resolve, 0);
      }
    });
  }

  function boot() {
    if (factoryBuildPromise) {
      return factoryBuildPromise;
    }

    if (
      (window.__RMLApiNodeFactoryVersion || 0) >=
        FACTORY_VERSION &&
      window.RMLApiNodeFactoryReport
    ) {
      completeFactoryReady(
        window.RMLApiNodeFactoryReport
      );
      return factoryReady;
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
      if (!prerequisiteWaitInstalled) {
        prerequisiteWaitInstalled = true;
        Promise.all([
          Promise.resolve(
            window.RMLNodeRegistryReady
          ),
          Promise.resolve(
            window.RMLCatalogReady
          )
        ])
          .then(() => {
            prerequisiteWaitInstalled =
              false;
            if (
              window.RMLModNodeRegistry &&
              (
                window.RMLResoniteApiCatalog ||
                window.RMLFrooxComponentCatalog
              )
            ) {
              boot();
            }
          })
          .catch(error => {
            console.error(
              "RML API Node Factory prerequisites failed.",
              error
            );
            completeFactoryReady(null);
          });
      }
      return factoryReady;
    }

    window.__RMLApiNodeFactoryVersion =
      FACTORY_VERSION;

    factoryBuildPromise =
      buildFactory(
        registry,
        catalog
      )
        .then(completeFactoryReady)
        .catch(error => {
          console.error(
            "RML API Node Factory failed.",
            error
          );
          completeFactoryReady(null);
          return null;
        });

    return factoryBuildPromise;
  }

  async function buildFactory(registry, catalog, publish = true) {
    const {
      port,
      registerType,
      registerGroup,
      registerNode,
      getNodeDefinitions,
      getTypeDefinitions,
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
    const legacyAliasIds = new Set();
    const legacyAliasEntries = [];
    const rejectedGeneratedNodeIds = new Set();
    const verificationErrors = [];
    const catalogSchemaVersion =
      Number(catalog.schemaVersion || 0);
    const engineVersion = String(
      catalog.engineVersion || "unknown"
    );
    const catalogSource = String(
      catalog.catalogSource ||
      window.RMLApiCatalogInfo?.source ||
      window.RMLApiCatalogSource ||
      "unknown"
    );
    const catalogFingerprint = String(
      catalog.catalogFingerprint ||
      catalog.assemblyFingerprint ||
      stableHash(JSON.stringify({
        schemaVersion: catalogSchemaVersion,
        engineVersion,
        assemblies: catalog.assemblies || [],
        types: catalog.types || [],
        enums: catalog.enums || []
      }))
    );
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

    function catalogExactType(value) {
      let text = String(value || "")
        .trim()
        .replace(/^global::/, "")
        .replace(/\s+/g, " ");

      if (!text.endsWith("?")) {
        return text;
      }

      const underlying = text.slice(0, -1);
      const row = typeByName.get(
        normalizeCsType(underlying)
      );
      const valueType = Boolean(
        row?.kind === "struct" ||
        row?.kind === "enum" ||
        row?.isValueType === true ||
        looksLikeValueType(underlying)
      );

      return valueType
        ? `System.Nullable<${underlying}>`
        : underlying;
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
      "System.Action": "action",
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

    for (const [graphType, information] of Object.entries(
      typeof getTypeDefinitions === "function"
        ? getTypeDefinitions()
        : {}
    )) {
      const csType = normalizeCsType(
        information?.csType || ""
      );
      if (!csType || graphTypeByCs.has(csType)) {
        continue;
      }
      graphTypeByCs.set(csType, graphType);
      graphTypeByNormalizedCs.set(
        normalizeTypeForLookup(csType),
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
        apiStableContractId:
          String(row.stableContractId || ""),
        apiMemberKind: "type",
        apiSignature: `typeof(${csType})`,
        apiParameters: [],
        apiReturnType: "System.Type",
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
        ? enumRow.values.filter(value =>
            value &&
            value.name &&
            isCSharpIdentifier(value.name)
          )
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
        apiMemberKind: "enum",
        apiSignature: csType,
        apiParameters: [],
        apiReturnType: csType,
        apiSearchText: `${csType} ${values.map(value => value.name).join(" ")}`
      });
      enumNodeCount += 1;
    }

    const eventTemplate = findDefinitionByTitle(
      definitions,
      title => /subscribe\b.*\bevent/i.test(title)
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
        const definition =
          createConstructorDefinition(
            owner,
            constructor
          );
        if (!definition) {
          skippedCount += 1;
          return;
        }
        const prefix = "api.ctor.";
        const legacyBase =
          `${owner.fullName}|${constructor.signature}`;
        const id = canonicalMemberNodeId(
          prefix,
          definition
        );
        if (registerGeneratedNode(id, definition)) {
          constructorNodeCount += 1;
          registerLegacyMember(
            prefix,
            legacyBase,
            index,
            constructors.length,
            id
          );
        }
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
        if (!definition) {
          skippedCount += 1;
          continue;
        }
        if (definition.runtimeBound) {
          runtimeBoundMethodCount += 1;
        }
        if (registerGeneratedNode(id, definition)) {
          methodNodeCount += 1;
        }
      }

      const properties = Array.isArray(owner.properties)
        ? owner.properties
        : [];
      properties.forEach((property, index) => {
        if (!property || property.isObsolete || !property.name) {
          skippedCount += 1;
          return;
        }
        const legacyBase =
          `${owner.fullName}|${property.name}|${property.type}`;
        if (property.canRead) {
          const prefix =
            "api.property.get.";
          const definition =
            createPropertyGetDefinition(
              owner,
              property
            );
          const id = definition
            ? canonicalMemberNodeId(
                prefix,
                definition
              )
            : "";
          if (
            id &&
            registerGeneratedNode(
              id,
              definition
            )
          ) {
            propertyNodeCount += 1;
            registerLegacyMember(
              prefix,
              legacyBase,
              index,
              properties.length,
              id
            );
          } else {
            skippedCount += 1;
          }
        }
        if (property.canWrite) {
          const prefix =
            "api.property.set.";
          const definition =
            createPropertySetDefinition(
              owner,
              property
            );
          const id = definition
            ? canonicalMemberNodeId(
                prefix,
                definition
              )
            : "";
          if (
            id &&
            registerGeneratedNode(
              id,
              definition
            )
          ) {
            propertyNodeCount += 1;
            registerLegacyMember(
              prefix,
              legacyBase,
              index,
              properties.length,
              id
            );
          } else {
            skippedCount += 1;
          }
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
        const legacyBase =
          `${owner.fullName}|${field.name}|${field.type}`;
        const getPrefix = "api.field.get.";
        const getDefinition =
          createFieldGetDefinition(
            owner,
            field
          );
        const getId = getDefinition
          ? canonicalMemberNodeId(
              getPrefix,
              getDefinition
            )
          : "";
        if (
          getId &&
          registerGeneratedNode(
            getId,
            getDefinition
          )
        ) {
          fieldNodeCount += 1;
          registerLegacyMember(
            getPrefix,
            legacyBase,
            index,
            fields.length,
            getId
          );
        } else {
          skippedCount += 1;
        }

        if (!field.isReadOnly && !field.isConst) {
          const setPrefix =
            "api.field.set.";
          const setDefinition =
            createFieldSetDefinition(
              owner,
              field
            );
          const setId = setDefinition
            ? canonicalMemberNodeId(
                setPrefix,
                setDefinition
              )
            : "";
          if (
            setId &&
            registerGeneratedNode(
              setId,
              setDefinition
            )
          ) {
            fieldNodeCount += 1;
            registerLegacyMember(
              setPrefix,
              legacyBase,
              index,
              fields.length,
              setId
            );
          } else {
            skippedCount += 1;
          }
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

    legacyOperatorResolver =
      async requiredNodes => {
        const requirements =
          (Array.isArray(requiredNodes)
            ? requiredNodes
            : [])
            .filter(value => {
              const id = String(
                typeof value === "string"
                  ? value
                  : value?.operatorId || ""
              ).trim();
              const contract =
                typeof value === "string"
                  ? null
                  : value?.apiContract;
              return id.startsWith("api.") ||
                Boolean(
                  String(contract?.ownerType || "").trim() &&
                  String(contract?.kind || "").trim()
                );
            });
        const requiredIds = new Set(
          requirements
            .map(value =>
              String(
                typeof value === "string"
                  ? value
                  : value?.operatorId || ""
              ).trim()
            )
            .filter(Boolean)
        );
        const requested =
          requiredIds.size;
        let resolved = 0;
        let attempts = 0;
        const migrations = {};
        const portMigrations = {};
        const unresolvedDetails = {};

        const normalizedContractType = value =>
          normalizeCsType(
            String(value || "")
              .replace(/&$/, "")
          );
        const semanticContractKey = contract => {
          if (
            !contract ||
            typeof contract !== "object" ||
            Array.isArray(contract)
          ) {
            return "";
          }

          const ownerType =
            normalizedContractType(
              contract.ownerType
            );
          const kind = String(
            contract.kind || ""
          ).trim();

          if (!ownerType || !kind) {
            return "";
          }

          return JSON.stringify({
            kind,
            ownerType,
            memberName: String(
              contract.memberName || ""
            ),
            parameters:
              (Array.isArray(contract.parameters)
                ? contract.parameters
                : []).map((parameter, index) => ({
                  position: Math.max(
                    0,
                    Number(parameter?.position) || index
                  ),
                  type: normalizedContractType(
                    parameter?.type
                  ),
                  isByRef:
                    parameter?.isByRef === true,
                  isOut:
                    parameter?.isOut === true
                })),
            returnType:
              normalizedContractType(
                contract.returnType ||
                "System.Void"
              ),
            isStatic:
              contract.isStatic === true,
            genericArity: Math.max(
              0,
              Number(contract.genericArity) || 0
            )
          });
        };
        const semanticMemberKey = contract => {
          if (
            !contract ||
            typeof contract !== "object" ||
            Array.isArray(contract)
          ) {
            return "";
          }

          const ownerType =
            normalizedContractType(
              contract.ownerType
            );
          const kind = String(
            contract.kind || ""
          ).trim();

          if (!ownerType || !kind) {
            return "";
          }

          return JSON.stringify({
            kind,
            ownerType,
            memberName: String(
              contract.memberName || ""
            ),
            returnType:
              normalizedContractType(
                contract.returnType ||
                "System.Void"
              ),
            isStatic:
              contract.isStatic === true,
            genericArity: Math.max(
              0,
              Number(contract.genericArity) || 0
            )
          });
        };
        const semanticParameters = contract =>
          (Array.isArray(contract?.parameters)
            ? contract.parameters
            : []).map((parameter, index) => ({
              position: Math.max(
                0,
                Number(parameter?.position) || index
              ),
              type: normalizedContractType(
                parameter?.type
              ),
              isByRef:
                parameter?.isByRef === true,
              isOut:
                parameter?.isOut === true,
              isOptional:
                parameter?.isOptional === true
            }));
        const semanticContractsCompatible = (
          required,
          available
        ) => {
          if (
            !semanticMemberKey(required) ||
            semanticMemberKey(required) !==
              semanticMemberKey(available)
          ) {
            return false;
          }

          const requiredParameters =
            semanticParameters(required);
          const availableParameters =
            semanticParameters(available);

          if (
            requiredParameters.length >
            availableParameters.length
          ) {
            return false;
          }

          for (
            let index = 0;
            index < requiredParameters.length;
            index += 1
          ) {
            const requiredParameter =
              requiredParameters[index];
            const availableParameter =
              availableParameters[index];

            if (
              requiredParameter.position !==
                availableParameter.position ||
              requiredParameter.type !==
                availableParameter.type ||
              requiredParameter.isByRef !==
                availableParameter.isByRef ||
              requiredParameter.isOut !==
                availableParameter.isOut
            ) {
              return false;
            }
          }

          return availableParameters
            .slice(requiredParameters.length)
            .every(parameter =>
              parameter.isOptional === true
            );
        };
        const portRows = (contract, direction) => {
          const key = direction === "input" ? "inputPorts" : "outputPorts";
          return (Array.isArray(contract?.[key]) ? contract[key] : []).map(port => ({
            ...port,
            id: String(port?.id || ""),
            type: String(port?.type || "object"),
            role: portablePortRole(contract?.kind, direction, port, contract?.parameters)
          }));
        };
        const requiredPortMigration = (requiredContract, availableContract, inputIds, outputIds) => {
          const result = { input: {}, output: {} };
          for (const [direction, requiredIds] of [["input", inputIds], ["output", outputIds]]) {
            const oldRows = portRows(requiredContract, direction);
            const newRows = portRows(availableContract, direction);
            const newByRole = new Map();
            for (const row of newRows) {
              if (!newByRole.has(row.role)) newByRole.set(row.role, []);
              newByRole.get(row.role).push(row);
            }
            for (const oldId of requiredIds) {
              const oldRow = oldRows.find(row => row.id === oldId) || {
                id: oldId,
                type: "object",
                role: portablePortRole(requiredContract?.kind, direction, { id: oldId }, requiredContract?.parameters)
              };
              const matches = newByRole.get(oldRow.role) || [];
              if (matches.length !== 1) return null;
              const replacement = matches[0];
              if (
                oldRow.type && replacement.type &&
                oldRow.type !== "object" && replacement.type !== "object" &&
                oldRow.type !== replacement.type
              ) {
                return null;
              }
              result[direction][oldId] = replacement.id;
            }
          }
          return result;
        };
        const semanticIndex = new Map();
        const semanticMemberIndex = new Map();
        const stableContractIndex = new Map();

        for (const [id, definition] of
          Object.entries(definitions)) {
          if (
            definition?.catalogGenerated !== true ||
            definition?.legacyCatalogAlias === true
          ) {
            continue;
          }

          const key = semanticContractKey(
            definition.apiVerification
          );
          if (!key) continue;
          if (!semanticIndex.has(key)) {
            semanticIndex.set(key, []);
          }
          semanticIndex.get(key).push(id);

          const memberKey = semanticMemberKey(
            definition.apiVerification
          );
          if (memberKey) {
            if (!semanticMemberIndex.has(memberKey)) {
              semanticMemberIndex.set(memberKey, []);
            }
            semanticMemberIndex.get(memberKey).push(id);
          }
          const stableId = stableContractId(definition.apiVerification);
          if (stableId) {
            if (!stableContractIndex.has(stableId)) stableContractIndex.set(stableId, []);
            stableContractIndex.get(stableId).push(id);
          }
        }

        const normalizedLegacyName = value =>
          String(value || "")
            .trim()
            .replace(
              /^api\s*[·:|\-]\s*/i,
              ""
            )
            .replace(
              /^(?:get|set|new|construct)\s*[·:|\-]\s*/i,
              ""
            )
            .replace(/\s+/g, "")
            .toLocaleLowerCase();
        const requirementById =
          new Map(
            requirements.map(requirement => [
              String(
                typeof requirement === "string"
                  ? requirement
                  : requirement?.operatorId || ""
              ).trim(),
              requirement
            ])
          );
        const entryNames = entry => {
          const definition =
            definitions[
              entry.canonicalId
            ];
          const owner = shortTypeName(
            definition?.catalogType || ""
          );
          const member = String(
            definition?.catalogMember || ""
          ).trim();
          return new Set(
            [
              definition?.title,
              owner && member
                ? `${owner}.${member}`
                : ""
            ]
              .map(normalizedLegacyName)
              .filter(Boolean)
          );
        };
        const legacyPrefixes = [
          ...new Set(
            legacyAliasEntries.map(
              entry => entry.prefix
            )
          )
        ].sort((left, right) =>
          right.length - left.length
        );
        const legacyEntryHintIndex =
          new Map();
        for (const entry of
          legacyAliasEntries) {
          for (const name of
            entryNames(entry)) {
            const key =
              `${entry.prefix}|${name}`;
            if (
              !legacyEntryHintIndex.has(
                key
              )
            ) {
              legacyEntryHintIndex.set(
                key,
                []
              );
            }
            legacyEntryHintIndex
              .get(key)
              .push(entry);
          }
        }
        const hintedLegacyEntriesById =
          new Map();
        const exactReferencedPortsExist =
          (oldId, entry) => {
            const requirement =
              requirementById.get(oldId);
            const definition =
              definitions[
                entry.canonicalId
              ];
            if (!definition) {
              return false;
            }
            const inputs = new Set(
              (Array.isArray(
                definition.inputs
              )
                ? definition.inputs
                : []).map(port =>
                  String(port?.id || "")
                )
            );
            const outputs = new Set(
              (Array.isArray(
                definition.outputs
              )
                ? definition.outputs
                : []).map(port =>
                  String(port?.id || "")
                )
            );
            return (
              (Array.isArray(
                requirement?.inputPorts
              )
                ? requirement.inputPorts
                : []
              ).every(portId =>
                inputs.has(String(portId))
              ) &&
              (Array.isArray(
                requirement?.outputPorts
              )
                ? requirement.outputPorts
                : []
              ).every(portId =>
                outputs.has(String(portId))
              )
            );
          };

        for (const oldId of requiredIds) {
          const requirement =
            requirementById.get(oldId);
          const labels =
            typeof requirement === "string"
              ? []
              : Array.isArray(
                    requirement?.nodeLabels
                  )
                ? requirement.nodeLabels
                : [];
          const hints = new Set(
            labels
              .map(normalizedLegacyName)
              .filter(Boolean)
          );
          const prefix =
            legacyPrefixes.find(value =>
              oldId.startsWith(
                value
              )
            ) || "";

          if (!prefix || hints.size === 0) {
            hintedLegacyEntriesById.set(
              oldId,
              []
            );
            continue;
          }

          hintedLegacyEntriesById.set(
            oldId,
            [
              ...new Set(
                [...hints].flatMap(hint =>
                  legacyEntryHintIndex.get(
                    `${prefix}|${hint}`
                  ) || []
                )
              )
            ]
          );
        }

        for (const requirement of
          requirements) {
          const oldId = String(
            typeof requirement === "string"
              ? requirement
              : requirement?.operatorId || ""
          ).trim();

          if (!requiredIds.has(oldId)) {
            continue;
          }

          const key = semanticContractKey(
            typeof requirement === "string"
              ? null
              : requirement?.apiContract
          );
          const requiredContract =
            typeof requirement === "string"
              ? null
              : requirement?.apiContract;
          const exactCandidates = key
            ? semanticIndex.get(key) || []
            : [];
          const memberKey = semanticMemberKey(
            requiredContract
          );
          const stableId = stableContractId(requiredContract);
          const stableCandidates = stableId
            ? stableContractIndex.get(stableId) || []
            : [];
          const candidates =
            exactCandidates.length > 0
              ? exactCandidates
              : stableCandidates.length > 0
                ? stableCandidates.filter(candidateId =>
                    semanticContractsCompatible(
                      requiredContract,
                      definitions[candidateId]?.apiVerification
                    )
                  )
              : (memberKey
                  ? semanticMemberIndex.get(
                      memberKey
                    ) || []
                  : []).filter(candidateId =>
                    semanticContractsCompatible(
                      requiredContract,
                      definitions[candidateId]
                        ?.apiVerification
                    )
                  );
          const inputPorts = new Set(
            Array.isArray(requirement?.inputPorts)
              ? requirement.inputPorts.map(String)
              : []
          );
          const outputPorts = new Set(
            Array.isArray(requirement?.outputPorts)
              ? requirement.outputPorts.map(String)
              : []
          );
          const compatible = candidates.map(
            candidateId => {
              const candidate =
                definitions[candidateId];
              const portMigration = requiredPortMigration(
                requiredContract,
                candidate?.apiVerification,
                [...inputPorts],
                [...outputPorts]
              );
              return portMigration ? { candidateId, portMigration } : null;
            }
          ).filter(Boolean);

          if (
            compatible.length === 1 &&
            (
              Boolean(definitions[oldId]) ||
              registerLegacyAlias(
                oldId,
                {
                  canonicalId: compatible[0].candidateId
                }
              )
            )
          ) {
            requiredIds.delete(oldId);
            resolved += 1;
            migrations[oldId] =
              compatible[0].candidateId;
            portMigrations[oldId] =
              compatible[0].portMigration;
          } else if (candidates.length > 0) {
            unresolvedDetails[oldId] =
              compatible.length > 1
                ? `semantic contract is ambiguous (${compatible.length} candidates)`
                : "semantic member exists but its referenced port contract changed";
          } else if (key) {
            unresolvedDetails[oldId] =
              "no structurally identical API member exists in the current catalog";
          }
        }

        const scannedUntil = new Map();
        const scanStages = [
          256,
          512,
          1024,
          2048
        ];

        for (const scanStage of
          scanStages) {
          if (requiredIds.size === 0) {
            break;
          }

          const candidateEntries = [
            ...new Set(
              [...requiredIds].flatMap(id =>
                hintedLegacyEntriesById.get(
                  id
                ) || []
              )
            )
          ];

          for (const entry of
            candidateEntries) {
            if (requiredIds.size === 0) {
              break;
            }

            const relevantIds =
              [...requiredIds].filter(id =>
                (
                  hintedLegacyEntriesById
                    .get(id) || []
                ).includes(entry)
              );
            if (relevantIds.length === 0) {
              continue;
            }

            const start =
              scannedUntil.get(entry) ||
              0;
            const limit = Math.min(
              2048,
              Math.max(
                scanStage,
                entry.groupSize + 128,
                entry.currentIndex + 1
              )
            );

            for (
              let historicalIndex = start;
              historicalIndex < limit;
              historicalIndex += 1
            ) {
              const legacyId =
                `${entry.prefix}${stableHash(`${entry.legacyBase}|${historicalIndex}`)}`;
              attempts += 1;

              if (
                relevantIds.includes(legacyId) &&
                exactReferencedPortsExist(
                  legacyId,
                  entry
                ) &&
                registerLegacyAlias(
                  legacyId,
                  entry
                )
              ) {
                requiredIds.delete(
                  legacyId
                );
                resolved += 1;
                migrations[legacyId] =
                  definitions[legacyId]
                    ?.canonicalOperatorId ||
                  legacyId;
                if (
                  relevantIds.every(id =>
                    !requiredIds.has(id)
                  )
                ) {
                  break;
                }
              }

              if (attempts % 4096 === 0) {
                await yieldToBrowser();
              }
            }

            scannedUntil.set(
              entry,
              limit
            );
          }

          if (requiredIds.size > 0) {
            await yieldToBrowser();
          }
        }

        for (const oldId of requiredIds) {
          if (!unresolvedDetails[oldId]) {
            unresolvedDetails[oldId] =
              (
                hintedLegacyEntriesById
                  .get(oldId) || []
              ).length > 0
                ? "the exact legacy name was found, but its historical hash identity or referenced port contract did not match"
                : "no portable API contract or exact stored API node name is available; manual catalog replacement is required";
          }
        }

        if (resolved > 0) {
          window.__RMLNodeDefinitionRevision =
            (Number(
              window.__RMLNodeDefinitionRevision
            ) || 0) + 1;
          window.dispatchEvent(
            new CustomEvent(
              "rml-api-node-factory-ready",
              {
                detail:
                  window.RMLApiNodeFactoryReport ||
                  null
              }
            )
          );
        }

        return Object.freeze({
          attempted: requested > 0,
          requested,
          resolved,
          unresolved: requiredIds.size,
          attempts,
          migrations:
            Object.freeze({
              ...migrations
            }),
          portMigrations:
            Object.freeze(structuredClone(portMigrations)),
          unresolvedDetails:
            Object.freeze({
              ...unresolvedDetails
            })
        });
      };

    const report = Object.freeze({
      factoryVersion: FACTORY_VERSION,
      verificationSchemaVersion:
        API_VERIFICATION_SCHEMA_VERSION,
      catalogSchemaVersion,
      engineVersion,
      catalogSource,
      catalogFingerprint,
      liveCatalogVerified:
        catalogSource === "scanner" &&
        engineVersion !== "unknown" &&
        catalogSchemaVersion > 0 &&
        Boolean(catalogFingerprint),
      verificationPassed:
        verificationErrors.length === 0,
      verificationErrors:
        Object.freeze([...verificationErrors]),
      rejectedGeneratedNodes:
        rejectedGeneratedNodeIds.size,
      registeredTypes: graphTypeByCs.size,
      typeNodes: typeNodeCount,
      enumNodes: enumNodeCount,
      constructorNodes: constructorNodeCount,
      methodNodes: methodNodeCount,
      runtimeBoundMethods: runtimeBoundMethodCount,
      propertyNodes: propertyNodeCount,
      fieldNodes: fieldNodeCount,
      eventNodes: eventNodeCount,
      legacyAliases:
        legacyAliasIds.size,
      skippedMembers: skippedCount,
      totalGeneratedNodes: generatedNodeIds.size
    });

    if (publish) {
      window.RMLApiNodeFactoryReport = report;
      window.__RMLNodeDefinitionRevision =
        (Number(window.__RMLNodeDefinitionRevision) || 0) + 1;
      window.dispatchEvent(
        new CustomEvent("rml-api-node-factory-ready", { detail: report })
      );
      console.info("RML API Node Factory ready.", report);
    }

    return report;

    function canonicalMemberNodeId(
      prefix,
      definition
    ) {
      const identity = {
        kind: String(
          definition?.apiMemberKind ||
          ""
        ),
        ownerType: normalizeCsType(
          definition?.catalogType || ""
        ),
        memberName: String(
          definition?.catalogMember || ""
        ),
        signature: String(
          definition?.apiSignature || ""
        ),
        isStatic:
          definition?.apiIsStatic === true,
        genericArity: Math.max(
          0,
          Number(
            definition?.apiGenericArity
          ) || 0
        )
      };

      return `${prefix}${stableHash(
        JSON.stringify(identity)
      )}`;
    }

    function registerLegacyMember(
      prefix,
      legacyBase,
      currentIndex,
      groupSize,
      canonicalId
    ) {
      const entry = Object.freeze({
        prefix,
        legacyBase,
        currentIndex: Math.max(
          0,
          Number(currentIndex) || 0
        ),
        groupSize: Math.max(
          0,
          Number(groupSize) || 0
        ),
        canonicalId
      });
      legacyAliasEntries.push(entry);

      return registerLegacyAlias(
        `${prefix}${stableHash(`${legacyBase}|${currentIndex}`)}`,
        entry
      );
    }

    function registerLegacyAlias(
      id,
      entry
    ) {
      const existing = definitions[id];
      if (existing) {
        return (
          id === entry.canonicalId ||
          existing.canonicalOperatorId ===
            entry.canonicalId
        );
      }

      const canonical =
        definitions[entry.canonicalId];
      if (!canonical) {
        return false;
      }

      const aliasDefinition = {
        ...canonical,
        hiddenFromPalette: true,
        legacyCatalogAlias: true,
        canonicalOperatorId:
          entry.canonicalId
      };
      const verification =
        createApiVerificationContract(
          id,
          aliasDefinition
        );

      if (!verification.ok) {
        return false;
      }

      aliasDefinition.apiVerification =
        Object.freeze(
          verification.contract
        );

      const registered =
        registerNode(
          id,
          aliasDefinition
        );
      if (registered === false) {
        return false;
      }

      legacyAliasIds.add(id);
      return true;
    }

    function installCustomCSharpSyntaxContract(definition) {
      const kind = String(definition?.apiMemberKind || "");
      const supported = new Set([
        "method",
        "constructor",
        "property-get",
        "property-set",
        "field-get",
        "field-set",
        "type"
      ]);
      if (!supported.has(kind)) return definition;

      const owner = normalizeCsType(definition.catalogType || "");
      const member = escapeCSharpIdentifier(definition.catalogMember || "");
      const parameters = Array.isArray(definition.apiParameters)
        ? definition.apiParameters
        : [];
      const genericArity = Math.max(0, Number(definition.apiGenericArity) || 0);
      const input = (context, id) => String(context.input(id) || "").trim();
      const argument = (context, parameter) => {
        const position = Math.max(0, Number(parameter?.position) || 0);
        const value = input(context, `arg${position}`) ||
          String(parameter?.defaultValueCSharp || "default");
        if (parameter?.isOut === true) return `out ${value}`;
        if (parameter?.isByRef === true) return `${parameter?.isIn === true ? "in" : "ref"} ${value}`;
        return value;
      };
      const host = context => definition.apiIsStatic === true
        ? String(context.node?.parameters?.customCSharpStaticTarget || owner)
        : input(context, "target");
      const genericSuffix = context => {
        if (genericArity === 0) return "";
        const types = Array.from({ length: genericArity }, (_, index) =>
          input(context, `generic${index}`) || "object"
        );
        return `<${types.join(", ")}>`;
      };

      definition.customCSharpCatalogNode = true;
      definition.customCSharpOutputPort =
        kind === "method"
          ? (definition.outputs || []).some(port => port.id === "result") ? "result" : "done"
          : kind === "constructor" ? "result"
            : kind === "property-get" || kind === "field-get" || kind === "type" ? "value"
              : "done";
      definition.syntaxRender = context => {
        if (kind === "type") return `typeof(${owner})`;
        if (kind === "constructor") {
          const type = String(context.node?.parameters?.customCSharpTypeText || owner);
          return `new ${type}(${parameters.filter(parameter => parameter?.isOut !== true).map(parameter => argument(context, parameter)).join(", ")})`;
        }
        if (kind === "method") {
          const receiver = host(context);
          const callTarget = receiver ? `${receiver}.${member}` : member;
          return `${callTarget}${genericSuffix(context)}(${parameters.map(parameter => argument(context, parameter)).join(", ")})`;
        }
        if (kind === "property-get") {
          const receiver = host(context);
          if (parameters.length > 0) {
            return `${receiver}[${parameters.map(parameter => argument(context, parameter)).join(", ")}]`;
          }
          return `${receiver}.${member}`;
        }
        if (kind === "field-get") return `${host(context)}.${member}`;
        if (kind === "property-set") {
          const receiver = host(context);
          const indexes = parameters.slice(0, -1);
          const access = indexes.length > 0
            ? `${receiver}[${indexes.map(parameter => argument(context, parameter)).join(", ")}]`
            : `${receiver}.${member}`;
          return `${access} = ${input(context, "value") || "default"}`;
        }
        if (kind === "field-set") {
          return `${host(context)}.${member} = ${input(context, "value") || "default"}`;
        }
        return "";
      };
      return definition;
    }

    function registerGeneratedNode(id, definition) {
      if (!definition) {
        rejectedGeneratedNodeIds.add(id);
        return false;
      }

      installCustomCSharpSyntaxContract(definition);

      const verification =
        createApiVerificationContract(
          id,
          definition
        );

      if (!verification.ok) {
        rejectedGeneratedNodeIds.add(id);
        verificationErrors.push(
          `API node '${id}' was rejected: ${verification.errors.join("; ")}`
        );
        return false;
      }

      const existing = definitions[id];
      if (generatedNodeIds.has(id) || existing) {
        const existingContract =
          existing?.catalogGenerated === true
            ? existing.apiVerification
            : null;
        const identical = Boolean(
          existingContract &&
          existingContract.contractFingerprint ===
            verification.contract.contractFingerprint
        );

        if (identical) {
          generatedNodeIds.add(id);
          return true;
        }

        rejectedGeneratedNodeIds.add(id);
        verificationErrors.push(
          `API node id '${id}' represents two different contracts or collides with a non-catalog graph node.`
        );
        return false;
      }

      definition.apiVerification =
        Object.freeze(
          verification.contract
        );

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

      const registered =
        registerNode(id, definition);
      if (registered === false) {
        rejectedGeneratedNodeIds.add(id);
        verificationErrors.push(
          `API node '${id}' was rejected by the central graph registry.`
        );
        return false;
      }
      generatedNodeIds.add(id);
      return true;
    }

    function createApiVerificationContract(
      id,
      definition
    ) {
      const errors = [];
      const ownerType = normalizeCsType(
        definition?.catalogType || ""
      );
      const kind = String(
        definition?.apiMemberKind || ""
      ).trim();
      const signature = String(
        definition?.apiSignature || ""
      ).trim();
      const parameters = Object.freeze(
        Array.isArray(
          definition?.apiParameters
        )
          ? definition.apiParameters.map(
              apiParameterContract
            )
          : []
      );
      const inputs = Array.isArray(
        definition?.inputs
      ) ? definition.inputs : [];
      const outputs = Array.isArray(
        definition?.outputs
      ) ? definition.outputs : [];

      if (!definition?.catalogGenerated) {
        errors.push(
          "catalogGenerated is not true"
        );
      }
      if (!ownerType) {
        errors.push("catalog owner type is empty");
      }
      if (!kind) {
        errors.push("API member kind is empty");
      }
      if (!signature) {
        errors.push("API signature is empty");
      }
      for (
        let index = 0;
        index < parameters.length;
        index += 1
      ) {
        if (parameters[index].position !== index) {
          errors.push(
            `parameter positions are not contiguous at index ${index}`
          );
          break;
        }
      }
      if (
        typeof definition?.codegenExpression !== "function" &&
        typeof definition?.codegenAction !== "function" &&
        typeof definition?.codegenCollect !== "function"
      ) {
        errors.push(
          "no C# code-generation handler is present"
        );
      }
      if (
        inputs.some(port =>
          port?.type === "impulse"
        ) &&
        typeof definition?.codegenAction !== "function"
      ) {
        errors.push(
          "impulse input has no codegenAction handler"
        );
      }
      if (
        outputs.some(port =>
          port?.type !== "impulse"
        ) &&
        typeof definition?.codegenExpression !== "function"
      ) {
        errors.push(
          "value output has no codegenExpression handler"
        );
      }
      if (
        outputs.some(port =>
          port?.type === "impulse"
        ) &&
        typeof definition?.codegenAction !== "function" &&
        typeof definition?.codegenCollect !== "function"
      ) {
        errors.push(
          "impulse output has no action or collection handler"
        );
      }

      for (const [direction, ports] of [
        ["input", inputs],
        ["output", outputs]
      ]) {
        const ids = new Set();
        for (const specification of ports) {
          const portId = String(
            specification?.id || ""
          ).trim();
          const portType = String(
            specification?.type ||
            specification?.typeVar ||
            ""
          ).trim();
          if (!portId || !portType) {
            errors.push(
              `${direction} port has no id or type`
            );
          } else if (ids.has(portId)) {
            errors.push(
              `duplicate ${direction} port '${portId}'`
            );
          }
          if (
            specification?.type &&
            !getTypeInformation(
              specification.type
            )
          ) {
            errors.push(
              `${direction} port '${portId || "<unnamed>"}' uses unregistered graph type '${specification.type}'`
            );
          }
          ids.add(portId);
        }
      }

      const core = {
        schemaVersion:
          API_VERIFICATION_SCHEMA_VERSION,
        factoryVersion: FACTORY_VERSION,
        catalogSchemaVersion,
        engineVersion,
        catalogSource,
        catalogFingerprint,
        nodeId: String(id),
        kind,
        ownerType,
        memberName: String(
          definition?.catalogMember || ""
        ),
        signature,
        parameters,
        returnType: catalogExactType(
          definition?.apiReturnType ||
          "System.Void"
        ),
        isStatic:
          definition?.apiIsStatic === true,
        genericArity: Math.max(
          0,
          Number(
            definition?.apiGenericArity
          ) || 0
        ),
        runtimeBound:
          definition?.runtimeBound === true,
        stableContractId:
          String(
            definition?.apiStableContractId ||
            stableContractId({
              ownerType,
              kind,
              memberName: String(definition?.catalogMember || ""),
              isStatic: definition?.apiIsStatic === true,
              genericArity: Math.max(0, Number(definition?.apiGenericArity) || 0)
            })
          ),
        inputPorts: Object.freeze(inputs.map(specification => ({
          id: String(specification?.id || ""),
          type: String(specification?.type || "object"),
          typeVar: String(specification?.typeVar || ""),
          optional: specification?.optional === true,
          role: portablePortRole(kind, "input", specification, parameters)
        }))),
        outputPorts: Object.freeze(outputs.map(specification => ({
          id: String(specification?.id || ""),
          type: String(specification?.type || "object"),
          typeVar: String(specification?.typeVar || ""),
          optional: specification?.optional === true,
          role: portablePortRole(kind, "output", specification, parameters)
        })))
      };

      return {
        ok: errors.length === 0,
        errors,
        contract: {
          ...core,
          contractFingerprint:
            stableHash(
              JSON.stringify(core)
            )
        }
      };
    }

    function apiParameterContract(
      parameter
    ) {
      return Object.freeze({
        position: Math.max(
          0,
          Number(parameter?.position) || 0
        ),
        type: catalogExactType(
          parameter?.elementType ||
          parameter?.type ||
          "System.Object"
        ),
        isByRef:
          parameter?.isByRef === true ||
          parameter?.isOut === true,
        isOut:
          parameter?.isOut === true,
        isOptional:
          parameter?.isOptional === true
      });
    }

    function createConstructorDefinition(owner, constructor) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const parameters = constructor.parameters || [];
      if (
        owner.isAbstract === true ||
        owner.isInterface === true ||
        constructor.isPublic === false ||
        parameters.some(parameter =>
          !isSupportedApiParameter(parameter)
        )
      ) {
        return null;
      }
      const direct =
        !owner.isAbstract &&
        !owner.isInterface &&
        !owner.isGeneric &&
        canDirectlyReferenceType(ownerCs) &&
        !parameters.some(parameter =>
          parameter.isOptional === true
        ) &&
        parameters.every(canDirectlyPassParameter);
      const inputs = [port("call", "Call", "impulse")];
      for (const parameter of parameters) {
        if (parameter.isOut) continue;
        inputs.push(parameterPort(parameter));
      }
      const outParameters = parameters.filter(parameter =>
        parameter.isOut || parameter.isByRef
      );
      const outputs = [
        port("done", "Done", "impulse"),
        port("result", displayTypeName(owner), direct ? ownerGraph : "object")
      ];
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

      return {
        title: `New · ${displayTypeName(owner)}`,
        group: groupForType(owner, API_GROUPS.constructors),
        symbol: "new",
        description: constructor.signature || `Constructs ${ownerCs}.`,
        inputs,
        outputs,
        catalogGenerated: true,
        catalogType: ownerCs,
        apiStableContractId:
          String(constructor.stableContractId || ""),
        apiMemberKind: "constructor",
        apiSignature:
          constructor.signature ||
          `${ownerCs}(${parameters.map(apiParameterSignature).join(",")})`,
        apiParameters: parameters,
        apiReturnType: ownerCs,
        apiIsStatic: false,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${constructor.signature || "constructor new"}`,
        runtimeBound: !direct,
        codegenCollect(api) {
          collectActionFields(api, {
            resultCs: direct ? ownerCs : "object",
            resultGraph: direct ? ownerGraph : "object",
            outParameters,
            direct
          });
          if (!direct) ensureApiReflectionRuntime(api);
        },
        codegenAction(api) {
          const action = direct
            ? directConstructorAction(api, ownerCs, parameters)
            : reflectiveConstructorAction(api, ownerCs, parameters);
          return actionWithDoneImpulse(api, action);
        },
        codegenExpression(api) {
          return actionOutputExpression(api, {
            resultGraph: direct ? ownerGraph : "object",
            resultCs: direct ? ownerCs : "object",
            outParameters,
            direct
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
      const genericParameters = Array.isArray(
        method.genericParameters
      )
        ? method.genericParameters
        : [];
      if (
        method.isPublic === false ||
        (
          method.isStatic === true &&
          method.isAbstract === true
        ) ||
        (
          method.isGenericMethodDefinition === true
        ) !== (genericParameters.length > 0) ||
        genericParameters.some(
          (parameter, index) =>
            Number(parameter?.position) !== index ||
            !String(parameter?.name || "").trim()
        ) ||
        parameters.some(parameter =>
          !isSupportedApiParameter(parameter)
        ) ||
        !isSupportedApiReturnType(
          method.returnType || "System.Void"
        )
      ) {
        return null;
      }
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
        for (const generic of genericParameters) {
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
        apiStableContractId:
          String(method.stableContractId || ""),
        apiMemberKind: "method",
        apiSignature:
          method.signature ||
          `${ownerCs}.${method.name}(${parameters.map(apiParameterSignature).join(",")})`,
        apiParameters: parameters,
        apiReturnType:
          method.returnType || returnCs,
        apiIsStatic: method.isStatic === true,
        apiGenericArity:
          genericParameters.length,
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
          const action = direct
            ? directMethodAction(api, ownerCs, method, parameters, isVoid)
            : reflectiveMethodAction(api, ownerCs, method, parameters, isVoid);
          return actionWithDoneImpulse(api, action);
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
      if (
        property.getterIsPublic === false ||
        property.isPublic === false ||
        !isCSharpIdentifier(property.name) ||
        !isSupportedApiReturnType(valueCs) ||
        indexes.some(parameter =>
          !isSupportedApiParameter(parameter)
        ) ||
        (indexes.length > 0 &&
          property.name !== "Item" &&
          property.isIndexer !== true)
      ) {
        return null;
      }
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
        apiStableContractId:
          String(property.readContractId || ""),
        apiMemberKind: "property-get",
        apiSignature:
          `${ownerCs}.${property.name}[${indexes.map(apiParameterSignature).join(",")}] -> ${catalogExactType(property.type || valueCs)}`,
        apiParameters: indexes,
        apiReturnType:
          property.type || valueCs,
        apiIsStatic: property.isStatic === true,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${property.name} property get read ${valueCs}`,
        codegenExpression(api) {
          return propertyReadExpression(
            api,
            ownerCs,
            valueCs,
            property,
            indexes
          );
        }
      };
    }

    function createPropertySetDefinition(owner, property) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(property.type || "System.Object");
      const indexes = property.indexParameters || [];
      if (
        property.setterIsPublic === false ||
        property.isPublic === false ||
        !isCSharpIdentifier(property.name) ||
        !isSupportedApiReturnType(valueCs) ||
        indexes.some(parameter =>
          !isSupportedApiParameter(parameter)
        ) ||
        (indexes.length > 0 &&
          property.name !== "Item" &&
          property.isIndexer !== true)
      ) {
        return null;
      }
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
        apiStableContractId:
          String(property.writeContractId || ""),
        apiMemberKind: "property-set",
        apiSignature:
          `${ownerCs}.${property.name}[${indexes.map(apiParameterSignature).join(",")}] <- ${catalogExactType(property.type || valueCs)}`,
        apiParameters: [
          ...indexes,
          {
            position: indexes.length,
            type: property.type || valueCs
          }
        ],
        apiReturnType: "System.Void",
        apiIsStatic: property.isStatic === true,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${property.name} property set write ${valueCs}`,
        codegenCollect(api) {
          collectActionFields(api, { isVoid: true, outParameters: [] });
        },
        codegenAction(api) {
          const fields = actionFieldNames(api);
          const access = propertyAccessExpression(api, ownerCs, property, indexes);
          const action = `try\n{\n    ${access} = ${api.input("value").code};\n    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
          return actionWithDoneImpulse(api, action);
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
      if (
        field.isPublic === false ||
        !isCSharpIdentifier(field.name) ||
        !isSupportedApiReturnType(valueCs)
      ) {
        return null;
      }

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
        apiStableContractId:
          String(field.readContractId || ""),
        apiMemberKind: "field-get",
        apiSignature:
          `${ownerCs}.${field.name} -> ${catalogExactType(field.type || valueCs)}`,
        apiParameters: [],
        apiReturnType:
          field.type || valueCs,
        apiIsStatic: field.isStatic === true,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${field.name} field read get ${valueCs}`,
        codegenExpression(api) {
          const access = host =>
            `${host}.${escapeCSharpIdentifier(field.name)}`;

          return field.isStatic
            ? access(ownerCs)
            : nullSafeInstanceReadExpression(
                api,
                ownerCs,
                valueCs,
                access
              );
        }
      };
    }

    function createFieldSetDefinition(owner, field) {
      const ownerCs = normalizeCsType(owner.fullName);
      const ownerGraph = registerApiType(ownerCs, owner) || "object";
      const valueCs = normalizeCsType(field.type || "System.Object");
      const inputs = [port("call", "Call", "impulse")];
      if (
        field.isPublic === false ||
        !isCSharpIdentifier(field.name) ||
        !isSupportedApiReturnType(valueCs)
      ) {
        return null;
      }
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
        apiStableContractId:
          String(field.writeContractId || ""),
        apiMemberKind: "field-set",
        apiSignature:
          `${ownerCs}.${field.name} <- ${catalogExactType(field.type || valueCs)}`,
        apiParameters: [{ position: 0, type: field.type || valueCs }],
        apiReturnType: "System.Void",
        apiIsStatic: field.isStatic === true,
        apiGenericArity: 0,
        apiSearchText: `${ownerCs} ${field.name} field write set ${valueCs}`,
        codegenCollect(api) {
          collectActionFields(api, { isVoid: true, outParameters: [] });
        },
        codegenAction(api) {
          const fields = actionFieldNames(api);
          const host = field.isStatic
            ? ownerCs
            : `((${ownerCs})(${api.input("target").code}))`;
          const action = `try\n{\n    ${host}.${escapeCSharpIdentifier(field.name)} = ${api.input("value").code};\n    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
          return actionWithDoneImpulse(api, action);
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
        apiStableContractId:
          String(eventInfo.stableContractId || ""),
        apiMemberKind: "event",
        apiSignature:
          `${ownerCs}.${eventInfo.name}:${normalizeCsType(eventInfo.handlerType || "System.Delegate")}`,
        apiParameters: [],
        apiReturnType:
          normalizeCsType(eventInfo.handlerType || "System.Delegate"),
        apiIsStatic: eventInfo.isStatic === true,
        apiGenericArity: 0,
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

    function actionWithDoneImpulse(api, action) {
      const done = api.emit("done");
      return `${String(action || "").trimEnd()}${
        done
          ? `\n${done}();`
          : ""
      }`;
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
        .map(parameter => {
          if (parameter.isOut) {
            return "null";
          }
          const input =
            api.input(`arg${parameter.position}`);
          return (
            parameter.isOptional === true &&
            input.connected !== true
          )
            ? "System.Type.Missing"
            : input.code;
        });
      const outAssignments = parameters
        .filter(parameter => parameter.isOut || parameter.isByRef)
        .map(parameter => `${fields.out(parameter.position)} = apiArguments[${parameter.position}];`)
        .join("\n    ");
      return `try\n{\n    System.Type apiType = ${apiRuntimeTypeExpression(ownerCs)};\n    object?[] apiArguments = new object?[] { ${args.join(", ")} };\n    System.Reflection.ConstructorInfo apiConstructor = ResolveApiCatalogConstructor(apiType, ${apiParameterTypeArray(parameters)}, ${apiParameterBoolArray(parameters, "isByRef")}, ${apiParameterBoolArray(parameters, "isOut")}) ?? throw new System.MissingMethodException(apiType.FullName, ".ctor");\n    ${fields.result} = apiConstructor.Invoke(apiArguments);\n${outAssignments ? `    ${outAssignments}\n` : ""}    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
    }

    function directMethodAction(api, ownerCs, method, parameters, isVoid) {
      const fields = actionFieldNames(api);
      const argumentState = buildDirectArguments(api, parameters);
      const host = method.isStatic
        ? ownerCs
        : `((${ownerCs})(${api.input("target").code}))`;
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
        if (parameter.isOut) {
          supplied.push("null");
          continue;
        }
        const input =
          api.input(`arg${parameter.position}`);
        supplied.push(
          parameter.isOptional === true &&
          input.connected !== true
            ? "System.Type.Missing"
            : input.code
        );
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

      return `try\n{\n    System.Type apiDeclaringType = ${apiRuntimeTypeExpression(ownerCs)};\n    object? apiTarget = ${target};\n    object?[] apiArguments = new object?[] { ${supplied.join(", ")} };\n    System.Reflection.MethodInfo apiMethod = ResolveApiCatalogMethod(apiDeclaringType, "${escapeString(normalizeCsType(method.declaringType || ownerCs))}", "${escapeString(method.name)}", ${apiParameterTypeArray(parameters)}, ${apiParameterBoolArray(parameters, "isByRef")}, ${apiParameterBoolArray(parameters, "isOut")}, ${(method.genericParameters || []).length}, ${method.isStatic ? "true" : "false"}) ?? throw new System.MissingMethodException(apiDeclaringType.FullName, "${escapeString(method.name)}");\n${genericInputs.length > 0 ? `    apiMethod = apiMethod.MakeGenericMethod(new System.Type[] { ${genericInputs.join(", ")} });\n` : ""}    ${resultAssignment}\n${outAssignments ? `    ${outAssignments}\n` : ""}    ${fields.success} = true;\n    ${fields.exception} = null;\n}\ncatch (System.Exception exception)\n{\n    ${fields.success} = false;\n    ${fields.exception} = exception;\n}`;
    }

    function apiRuntimeTypeExpression(csType) {
      return canDirectlyReferenceType(csType)
        ? `typeof(${csType})`
        : `ResolveApiCatalogType("${escapeString(csType)}") ?? throw new System.TypeLoadException("${escapeString(csType)}")`;
    }

    function apiParameterTypeArray(parameters) {
      return `new string[] { ${(parameters || [])
        .map(parameter =>
          `"${escapeString(catalogExactType(parameter.elementType || parameter.type || "System.Object"))}"`
        )
        .join(", ")} }`;
    }

    function apiParameterBoolArray(parameters, property) {
      return `new bool[] { ${(parameters || [])
        .map(parameter =>
          parameter?.[property] === true ||
          (
            property === "isByRef" &&
            parameter?.isOut === true
          )
            ? "true"
            : "false"
        )
        .join(", ")} }`;
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
        : `((${ownerCs})(${api.input("target").code}))`;
      if (indexes.length > 0) {
        const indexValues = indexes.map(parameter =>
          api.input(`arg${parameter.position}`).code
        );
        return `${host}[${indexValues.join(", ")}]`;
      }
      return `${host}.${escapeCSharpIdentifier(property.name)}`;
    }

    function nullSafeInstanceReadExpression(
      api,
      ownerCs,
      valueCs,
      memberAccess
    ) {
      const target =
        api.input("target").code;
      const local =
        `_apiTarget${api.token(api.node.id)}`;

      return `((${target}) is ${ownerCs} ${local} ? ${memberAccess(local)} : default(${valueCs})!)`;
    }

    function propertyReadExpression(
      api,
      ownerCs,
      valueCs,
      property,
      indexes
    ) {
      const access = host => {
        if (indexes.length > 0) {
          const indexValues = indexes.map(
            parameter =>
              api.input(
                `arg${parameter.position}`
              ).code
          );
          return `${host}[${indexValues.join(", ")}]`;
        }

        return `${host}.${escapeCSharpIdentifier(property.name)}`;
      };

      return property.isStatic
        ? access(ownerCs)
        : nullSafeInstanceReadExpression(
            api,
            ownerCs,
            valueCs,
            access
          );
    }

    function collectActionFields(api, descriptor) {
      const fields = actionFieldNames(api);
      api.addRuntimeField(
        `${api.node.id}.apiSuccess`,
        fields.success,
        "bool",
        "false"
      );
      api.addRuntimeField(
        `${api.node.id}.apiException`,
        fields.exception,
        "System.Exception?",
        "null"
      );

      if (!descriptor.isVoid) {
        api.addRuntimeField(
          `${api.node.id}.apiResult`,
          fields.result,
          descriptor.resultCs || "object",
          "default!"
        );
      }

      for (const parameter of descriptor.outParameters || []) {
        const csType = descriptor.direct
          ? normalizeCsType(parameter.elementType || parameter.type || "System.Object")
          : "object";
        api.addRuntimeField(
          `${api.node.id}.apiOut.${parameter.position}`,
          fields.out(parameter.position),
          csType,
          "default!"
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
    string[] parameterTypes,
    bool[] byRef,
    bool[] isOut)
{
    System.Reflection.ConstructorInfo[] matches = declaringType
        .GetConstructors(
            System.Reflection.BindingFlags.Public |
            System.Reflection.BindingFlags.Instance)
        .Where(constructor => ApiCatalogParametersMatch(
            constructor.GetParameters(),
            parameterTypes,
            byRef,
            isOut))
        .ToArray();

    if (matches.Length == 0)
    {
        return null;
    }

    if (matches.Length != 1)
    {
        throw new System.Reflection.AmbiguousMatchException(
            $"Catalog constructor signature is not unique on {declaringType.FullName}.");
    }

    return matches[0];
}

private static System.Reflection.MethodInfo? ResolveApiCatalogMethod(
    System.Type declaringType,
    string expectedDeclaringType,
    string methodName,
    string[] parameterTypes,
    bool[] byRef,
    bool[] isOut,
    int genericParameterCount,
    bool isStatic)
{
    System.Reflection.BindingFlags flags =
        System.Reflection.BindingFlags.Public |
        (isStatic
            ? System.Reflection.BindingFlags.Static
            : System.Reflection.BindingFlags.Instance);

    System.Reflection.MethodInfo[] matches = declaringType
        .GetMethods(flags)
        .Where(method =>
            string.Equals(method.Name, methodName, System.StringComparison.Ordinal) &&
            method.GetGenericArguments().Length == genericParameterCount &&
            ApiCatalogTypeName(method.DeclaringType) == NormalizeApiCatalogTypeName(expectedDeclaringType) &&
            ApiCatalogParametersMatch(
                method.GetParameters(),
                parameterTypes,
                byRef,
                isOut))
        .ToArray();

    if (matches.Length == 0)
    {
        return null;
    }

    if (matches.Length != 1)
    {
        throw new System.Reflection.AmbiguousMatchException(
            $"Catalog method signature is not unique: {expectedDeclaringType}.{methodName}.");
    }

    return matches[0];
}

private static bool ApiCatalogParametersMatch(
    System.Reflection.ParameterInfo[] actual,
    string[] expectedTypes,
    bool[] expectedByRef,
    bool[] expectedOut)
{
    if (
        actual.Length != expectedTypes.Length ||
        actual.Length != expectedByRef.Length ||
        actual.Length != expectedOut.Length)
    {
        return false;
    }

    for (int index = 0; index < actual.Length; index++)
    {
        System.Type parameterType = actual[index].ParameterType;
        bool actualByRef = parameterType.IsByRef;

        if (actualByRef)
        {
            parameterType = parameterType.GetElementType()!;
        }

        if (
            actualByRef != expectedByRef[index] ||
            actual[index].IsOut != expectedOut[index])
        {
            return false;
        }

        string expected = NormalizeApiCatalogTypeName(expectedTypes[index]);
        string actualName = ApiCatalogTypeName(parameterType);

        if (!string.Equals(actualName, expected, System.StringComparison.Ordinal))
        {
            return false;
        }
    }

    return true;
}

private static string NormalizeApiCatalogTypeName(string? value)
{
    return (value ?? string.Empty)
        .Replace("global::", string.Empty, System.StringComparison.Ordinal)
        .Replace("+", ".", System.StringComparison.Ordinal)
        .Replace(" ", string.Empty, System.StringComparison.Ordinal);
}

private static string ApiCatalogTypeName(System.Type? type)
{
    if (type is null)
    {
        return string.Empty;
    }

    if (type.IsByRef || type.IsPointer)
    {
        System.Type? element = type.GetElementType();
        return element is null
            ? string.Empty
            : ApiCatalogTypeName(element);
    }

    if (type.IsArray)
    {
        int rank = type.GetArrayRank();
        return ApiCatalogTypeName(type.GetElementType()) +
            "[" + new string(',', System.Math.Max(0, rank - 1)) + "]";
    }

    if (type.IsGenericParameter)
    {
        return type.Name;
    }

    if (type.IsGenericType)
    {
        System.Type definition = type.GetGenericTypeDefinition();
        string name = definition.FullName ?? definition.Name;
        int tick = name.IndexOf((char)96);
        if (tick >= 0)
        {
            name = name[..tick];
        }
        return NormalizeApiCatalogTypeName(name) +
            "<" +
            string.Join(",", type.GetGenericArguments().Select(ApiCatalogTypeName)) +
            ">";
    }

    return NormalizeApiCatalogTypeName(type.FullName ?? type.Name);
}
`);
    }

    function canDirectlyCallMethod(ownerCs, method, parameters) {
      return (
        canDirectlyReferenceType(ownerCs) &&
        method.isPublic !== false &&
        method.isSpecialName !== true &&
        !method.isGenericMethodDefinition &&
        !parameters.some(parameter =>
          parameter.isOptional === true
        ) &&
        canDirectlyReferenceType(method.returnType || "System.Void") &&
        parameters.every(canDirectlyPassParameter) &&
        /^[A-Za-z_][A-Za-z0-9_]*$/.test(String(method.name || ""))
      );
    }

    function canDirectlyPassParameter(parameter) {
      const type = normalizeCsType(parameter.elementType || parameter.type || "");
      return canDirectlyReferenceType(type);
    }

    function apiParameterSignature(parameter) {
      const type = catalogExactType(
        parameter?.elementType ||
        parameter?.type ||
        "System.Object"
      );
      const modifier = parameter?.isOut
        ? "out "
        : parameter?.isByRef
          ? "ref "
          : "";
      return `${modifier}${type}`;
    }

    function isSupportedApiParameter(parameter) {
      if (!parameter || typeof parameter !== "object") {
        return false;
      }
      if (
        parameter.isPointer === true ||
        parameter.isFunctionPointer === true ||
        parameter.isByRefLike === true
      ) {
        return false;
      }
      return isSupportedApiReturnType(
        parameter.elementType ||
        parameter.type ||
        ""
      );
    }

    function isSupportedApiReturnType(typeName) {
      const type = normalizeCsType(typeName);
      if (!type) return false;
      if (
        !isSafeCSharpTypeExpression(type) ||
        type.includes("*") ||
        type.includes("delegate*") ||
        type.endsWith("&") ||
        type === "System.TypedReference" ||
        type === "System.ArgIterator" ||
        type === "System.RuntimeArgumentHandle"
      ) {
        return false;
      }
      const row = typeByName.get(type);
      return row?.isByRefLike !== true;
    }

    function canDirectlyReferenceType(typeName) {
      const type = normalizeCsType(typeName);
      return Boolean(
        type &&
        isSafeCSharpTypeExpression(type) &&
        !type.includes("*") &&
        !type.endsWith("&") &&
        !isOpenTypeExpression(type) &&
        !isGenericParameterName(type)
      );
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
      if (
        !row ||
        row.isPublic === false ||
        row.isByRefLike === true ||
        !row.fullName
      ) return false;
      if (row.isObsolete || row.isLegacyNamed) return false;
      const fullName = normalizeCsType(row.fullName);
      return Boolean(
        fullName &&
        fullName !== "System.Void" &&
        isSafeCSharpTypeExpression(fullName) &&
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

  function isSafeCSharpTypeExpression(value) {
    let text = String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, "");

    if (!text || /[+`();{}=]/.test(text)) {
      return false;
    }

    if (text.endsWith("?")) {
      return isSafeCSharpTypeExpression(
        text.slice(0, -1)
      );
    }

    const array = text.match(
      /^(.*)\[(?:,*)\]$/
    );
    if (array) {
      return isSafeCSharpTypeExpression(
        array[1]
      );
    }

    const parsed =
      firstGenericTypeParts(text);
    if (parsed) {
      return (
        (
          !parsed.suffix ||
          (
            parsed.suffix.startsWith(".") &&
            isSafeCSharpTypeExpression(
              `Nested${parsed.suffix}`
            )
          )
        ) &&
        isSafeCSharpTypeExpression(
          parsed.head
        ) &&
        parsed.arguments.length > 0 &&
        parsed.arguments.every(
          isSafeCSharpTypeExpression
        )
      );
    }

    const segments = text.split(".");
    return (
      segments.every(segment =>
        /^@?[A-Za-z_][A-Za-z0-9_]*$/.test(segment)
      ) &&
      segments.every(segment =>
        segment.startsWith("@") ||
        !CSHARP_KEYWORDS.has(segment) ||
        (
          segments.length === 1 &&
          CSHARP_TYPE_ALIASES.has(segment)
        )
      )
    );
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

  const CSHARP_TYPE_ALIASES = new Set([
    "bool", "byte", "sbyte", "short", "ushort",
    "int", "uint", "long", "ulong", "nint", "nuint",
    "char", "float", "double", "decimal", "string",
    "object", "void"
  ]);

  function escapeCSharpIdentifier(value) {
    const text = String(value || "_");
    return CSHARP_KEYWORDS.has(text)
      ? `@${text}`
      : text;
  }

  function isCSharpIdentifier(value) {
    return /^[A-Za-z_][A-Za-z0-9_]*$/.test(
      String(value || "")
    );
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
