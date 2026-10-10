(() => {
  "use strict";

  const MODULE_VERSION = 1;

  const primitiveAliases = Object.freeze({
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
    half: "System.Half",
    char: "System.Char",
    float: "System.Single",
    double: "System.Double",
    decimal: "System.Decimal",
    string: "System.String",
    object: "System.Object",
    void: "System.Void"
  });

  function normalizeCsType(value) {
    return String(value || "")
      .trim()
      .replace(/global::/g, "")
      .replace(/\s+/g, "")
      .replace(
        /\b(bool|byte|sbyte|short|ushort|int|uint|long|ulong|nint|nuint|half|char|float|double|decimal|string|object|void)\b/g,
        alias => primitiveAliases[alias] || alias
      )
      .replace(/\?(?=$|[>,\]\[])/g, "");
  }

  function stableHash(value) {
    const text = String(value || "");
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
    return first.toString(16).padStart(8, "0") +
      second.toString(16).padStart(8, "0");
  }

  function shortTypeName(value) {
    const text = normalizeCsType(value);
    const generic = text.lastIndexOf("<");
    const head = generic >= 0
      ? text.slice(0, generic)
      : text;
    const name = head.split(".").pop() ||
      head || "Type";
    return generic >= 0
      ? `${name}${text.slice(generic)}`
      : name;
  }

  function typeSlug(value) {
    return String(value || "type")
      .replace(
        /([a-z0-9])([A-Z])/g,
        "$1-$2"
      )
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase()
      .slice(0, 42) || "type";
  }

  function legacyApiGraphTypeId(csType) {
    const normalized = normalizeCsType(csType);
    if (!safeClosedCsType(normalized)) {
      return "";
    }
    return `api.${typeSlug(
      shortTypeName(normalized)
    )}.${stableHash(normalized)}`;
  }

  function safeClosedCsType(value) {
    const text = normalizeCsType(value);
    if (
      !text ||
      /[`;'"{}=+|&\r\n]/.test(text) ||
      /(^|[<,])(T|T[A-Z][A-Za-z0-9_]*)(?=[>,\[]|$)/.test(text)
    ) {
      return false;
    }
    return /^[A-Za-z_][A-Za-z0-9_.]*(?:<[A-Za-z0-9_.,<>\[\]*?]+>)?(?:\[[,]*\])?$/.test(text);
  }

  function normalizedAssemblyReferences(value) {
    const result = new Map();
    const frameworkAssemblies = new Set([
      "mscorlib",
      "netstandard",
      "system.private.corelib",
      "system.runtime",
      "system.console",
      "system.collections",
      "system.linq"
    ]);
    for (const reference of
      Array.isArray(value) ? value : []) {
      const include = String(
        reference?.include || ""
      ).trim();
      if (!/^[A-Za-z0-9_.-]+$/.test(include)) {
        continue;
      }
      if (
        frameworkAssemblies.has(
          include.replace(/\.dll$/i, "")
            .toLowerCase()
        )
      ) {
        continue;
      }
      const hintPath = String(
        reference?.hintPath || ""
      ).trim().replace(/\\/g, "/");
      const resonitePrefix =
        "$(ResonitePath)";
      const relativeHintPath =
        hintPath.startsWith(resonitePrefix)
          ? hintPath.slice(
              resonitePrefix.length
            )
          : "";
      if (
        hintPath &&
        (
          /[<>"';&|`\r\n]/.test(hintPath) ||
          !/^[A-Za-z0-9_.$()\/ +:-]+$/.test(
            hintPath
          ) ||
          !relativeHintPath ||
          relativeHintPath.startsWith("/") ||
          relativeHintPath.includes("$(") ||
          relativeHintPath.includes(":") ||
          relativeHintPath
            .split("/")
            .some(segment =>
              segment === ".." ||
              segment === "."
            )
        )
      ) {
        continue;
      }
      result.set(include.toLowerCase(), {
        include,
        hintPath,
        private: reference?.private === true
      });
    }
    return [...result.values()].sort(
      (left, right) =>
        left.include.localeCompare(right.include)
    );
  }

  function assemblyReferencesFromTypeInformation(
    information
  ) {
    const references = Array.isArray(
      information?.assemblyReferences
    )
      ? [...information.assemblyReferences]
      : [];
    for (const value of [
      ...(Array.isArray(information?.assemblies)
        ? information.assemblies
        : []),
      information?.assembly
    ]) {
      const include = String(value || "").trim();
      if (
        !include ||
        references.some(reference =>
          String(reference?.include || "")
            .trim()
            .toLowerCase() ===
          include.toLowerCase()
        )
      ) {
        continue;
      }
      references.push({
        include,
        hintPath:
          `$(ResonitePath)${include}.dll`,
        private: false
      });
    }
    return references;
  }

  function normalizeTypeContract(value) {
    if (
      !value ||
      typeof value !== "object" ||
      Array.isArray(value)
    ) {
      return null;
    }
    const graphType = String(
      value.graphType || ""
    ).trim();
    const csType = normalizeCsType(
      value.csType || ""
    );
    const hasExplicitTypeAuthority =
      Object.prototype.hasOwnProperty.call(
        value,
        "typeAuthority"
      );
    const requestedTypeAuthority = String(
      value.typeAuthority || ""
    ).trim();
    const legacyLanguageExactType = Boolean(
      !hasExplicitTypeAuthority &&
      (
        graphType.startsWith("normalExact:") ||
        graphType.startsWith("csharpExact:")
      )
    );
    const typeAuthority =
      requestedTypeAuthority === "language-exact" ||
      legacyLanguageExactType
        ? "language-exact"
        : "";
    if (
      !graphType ||
      !safeClosedCsType(csType) ||
      (
        requestedTypeAuthority &&
        requestedTypeAuthority !==
          "language-exact"
      ) ||
      (
        typeAuthority === "language-exact" &&
        /^(?:api[.:]|apiEnum[.:])/i.test(
          graphType
        )
      )
    ) {
      return null;
    }
    const assignableToCsTypes = [
      ...new Set(
        (Array.isArray(
          value.assignableToCsTypes
        )
          ? value.assignableToCsTypes
          : [])
          .map(normalizeCsType)
          .filter(type =>
            type !== csType &&
            safeClosedCsType(type)
          )
      )
    ].sort();
    return Object.freeze({
      graphType,
      csType,
      typeAuthority,
      referenceType:
        value.referenceType === true,
      valueType:
        value.valueType === true,
      assignableToCsTypes:
        Object.freeze(assignableToCsTypes),
      assemblyReferences: Object.freeze(
        normalizedAssemblyReferences(
          value.assemblyReferences
        ).map(reference =>
          Object.freeze(reference)
        )
      )
    });
  }

  function typeContractCompatibility(
    contract,
    information
  ) {
    const expectedCsType = normalizeCsType(
      contract?.csType || ""
    );
    const installedCsType = normalizeCsType(
      information?.csType || ""
    );
    const identityMatches = Boolean(
      expectedCsType &&
      installedCsType &&
      expectedCsType === installedCsType
    );
    const referenceKindMatches =
      (contract?.referenceType === true) ===
      (information?.referenceType === true);

    return Object.freeze({
      compatible:
        identityMatches &&
        referenceKindMatches,
      identityMatches,
      referenceKindMatches,
      valueCapabilityMatches:
        (contract?.valueType === true) ===
        (information?.valueType === true)
    });
  }

  function normalizedTypeContracts(value) {
    const byGraphType = new Map();
    const conflicts = [];
    for (const candidate of
      Array.isArray(value) ? value : []) {
      const contract =
        normalizeTypeContract(candidate);
      if (!contract) {
        conflicts.push(
          "A portable graph type contract is incomplete or unsafe."
        );
        continue;
      }
      const previous = byGraphType.get(
        contract.graphType
      );
      if (
        previous &&
        JSON.stringify(previous) !==
          JSON.stringify(contract)
      ) {
        conflicts.push(
          `Portable graph type '${contract.graphType}' has conflicting contracts.`
        );
        continue;
      }
      byGraphType.set(
        contract.graphType,
        contract
      );
    }
    return Object.freeze({
      contracts: Object.freeze(
        [...byGraphType.values()].sort(
          (left, right) =>
            left.graphType.localeCompare(
              right.graphType
            )
        )
      ),
      conflicts: Object.freeze(
        [...new Set(conflicts)].sort()
      )
    });
  }

  function typeContractFromRegistry(
    graphType,
    registry
  ) {
    const id = String(graphType || "").trim();
    const definitions =
      registry?.getTypeDefinitions?.() || {};
    const information = definitions[id];
    if (!id || !information) return null;
    const csType = normalizeCsType(
      information.csType || ""
    );
    if (!safeClosedCsType(csType)) {
      return null;
    }
    const assignableToCsTypes = [];
    for (const targetId of
      Array.isArray(information.assignableTo)
        ? information.assignableTo
        : []) {
      const target = definitions[
        String(targetId || "")
      ];
      const targetCsType = normalizeCsType(
        target?.csType || ""
      );
      if (
        targetCsType !== csType &&
        safeClosedCsType(targetCsType)
      ) {
        assignableToCsTypes.push(
          targetCsType
        );
      }
    }
    return normalizeTypeContract({
      graphType: id,
      csType,
      typeAuthority:
        information.catalogGenerated !== true &&
        (
          information.languageExactType === true ||
          information.normalExactType === true ||
          information.csharpExactType === true ||
          id.startsWith("normalExact:") ||
          id.startsWith("csharpExact:")
        )
          ? "language-exact"
          : "",
      referenceType:
        information.referenceType === true,
      valueType:
        information.valueType === true,
      assignableToCsTypes,
      assemblyReferences:
        assemblyReferencesFromTypeInformation(
          information
        )
    });
  }

  function graphViews(root) {
    const result = [];
    const visited = new Set();
    const visit = value => {
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        visited.has(value) ||
        !Array.isArray(value.nodes)
      ) {
        return;
      }
      visited.add(value);
      result.push(value);
      for (const collection of [
        value.customCSharpFiles,
        value.apiCompositeGraphs
      ]) {
        if (
          collection &&
          typeof collection === "object" &&
          !Array.isArray(collection)
        ) {
          for (const nested of
            Object.values(collection)) {
            visit(nested);
          }
        }
      }
    };
    visit(root);
    return result;
  }

  function explicitGraphTypeParameterKeys(
    definition
  ) {
    const keys = new Map(
      (Array.isArray(definition?.parameters)
        ? definition.parameters
        : [])
        .filter(parameter =>
          parameter?.graphTypeReference ===
            true ||
          parameter?.graphTypeList === true ||
          parameter?.graphTypeStructuredList ===
            true ||
          String(parameter?.kind || "") ===
            "visualFunctionReturnType" ||
          String(parameter?.kind || "") ===
            "visualFunctionParameters"
        )
        .map(parameter => [
          String(parameter.key || ""),
          parameter?.graphTypeList === true
            ? "list"
            : parameter
                ?.graphTypeStructuredList ===
                  true ||
              String(parameter?.kind || "") ===
                "visualFunctionParameters"
              ? "structured-list"
            : "single"
        ])
        .filter(([key]) => key)
    );
    if (definition?.configurableTypeVar) {
      keys.set("valueType", "single");
      if (definition.allowAutoType !== false) {
        keys.set(
          "autoVectorType",
          "single"
        );
      }
    }
    return keys;
  }

  function splitTypeList(value) {
    return String(value || "")
      .split(/([,\r\n]+)/);
  }

  function mappedParameterValue(
    value,
    mode,
    aliases
  ) {
    if (mode === "single") {
      return aliases.get(String(value || "")) ||
        value;
    }
    if (mode === "structured-list") {
      if (!Array.isArray(value)) return value;
      let changed = false;
      const mapped = value.map(row => {
        if (
          !row ||
          typeof row !== "object" ||
          Array.isArray(row)
        ) {
          return row;
        }
        const replacement = aliases.get(
          String(row.type || row.graphType || "")
        );
        if (!replacement) return row;
        changed = true;
        return {
          ...row,
          ...(Object.prototype.hasOwnProperty.call(
            row,
            "type"
          )
            ? { type: replacement }
            : { graphType: replacement })
        };
      });
      return changed ? mapped : value;
    }
    const parts = splitTypeList(value);
    let changed = false;
    const mapped = parts.map(part => {
      if (/^[,\r\n]+$/.test(part)) {
        return part;
      }
      const leading = part.match(/^\s*/)?.[0] || "";
      const trailing = part.match(/\s*$/)?.[0] || "";
      const token = part.trim();
      const replacement = aliases.get(token);
      if (!replacement) return part;
      changed = true;
      return `${leading}${replacement}${trailing}`;
    });
    return changed ? mapped.join("") : value;
  }

  function referencedParameterTypes(
    value,
    mode
  ) {
    if (mode === "single") {
      const type = String(value || "").trim();
      return type ? [type] : [];
    }
    if (mode === "structured-list") {
      return (Array.isArray(value) ? value : [])
        .map(row => String(
          row?.type || row?.graphType || ""
        ).trim())
        .filter(Boolean);
    }
    return splitTypeList(value)
      .filter(part =>
        !/^[,\r\n]+$/.test(part)
      )
      .map(part => part.trim())
      .filter(Boolean);
  }

  function referencedGraphTypes(
    documentValue,
    registry
  ) {
    const result = new Set();
    const add = value => {
      const type = String(value || "").trim();
      if (type) result.add(type);
    };
    const definitions =
      registry?.getNodeDefinitions?.() || {};

    for (const contract of
      Array.isArray(
        documentValue?.portableTypeContracts
      )
        ? documentValue.portableTypeContracts
        : []) {
      add(contract?.graphType);
    }
    for (const view of graphViews(documentValue)) {
      for (const node of view.nodes) {
        const definition = definitions[
          String(node?.operatorId || "")
        ];
        const parameterKeys =
          explicitGraphTypeParameterKeys(
            definition
          );
        for (const [key, mode] of parameterKeys) {
          if (
            !node?.parameters ||
            !Object.prototype.hasOwnProperty.call(
              node.parameters,
              key
            )
          ) {
            continue;
          }
          for (const type of
            referencedParameterTypes(
              node.parameters[key],
              mode
            )) {
            add(type);
          }
        }
        if (
          [...parameterKeys.values()]
            .includes("list")
        ) {
          for (const key of Object.keys(
            node?.parameters || {}
          )) {
            if (/^value\d+Type$/.test(key)) {
              add(node.parameters[key]);
            }
          }
        }
        for (const contract of [
          node?.apiContract,
          node?.importRecovery
            ?.originalApiContract
        ]) {
          for (const key of [
            "inputPorts",
            "outputPorts"
          ]) {
            for (const port of
              Array.isArray(contract?.[key])
                ? contract[key]
                : []) {
              add(port?.type);
            }
          }
        }
        for (const boundary of
          Array.isArray(
            node?.parameters?.boundaryPorts
          )
            ? node.parameters.boundaryPorts
            : []) {
          add(boundary?.type);
        }
      }
      for (const boundary of
        Array.isArray(view.boundaryPorts)
          ? view.boundaryPorts
          : []) {
        add(boundary?.type);
      }
    }
    return result;
  }

  function liveTypeIndex(registry) {
    const byCsType = new Map();
    for (const [id, information] of
      Object.entries(
        registry?.getTypeDefinitions?.() || {}
      )) {
      const csType = normalizeCsType(
        information?.csType || ""
      );
      if (!safeClosedCsType(csType)) {
        continue;
      }
      const canonical = String(
        registry?.canonicalType?.(id) || id
      ).trim();
      const canonicalInformation =
        registry?.getTypeDefinitions?.()?.[
          canonical
        ];
      const candidate =
        canonicalInformation &&
        normalizeCsType(
          canonicalInformation.csType || ""
        ) === csType
          ? canonical
          : id;
      const ids = byCsType.get(csType) ||
        new Set();
      ids.add(candidate);
      byCsType.set(csType, ids);
    }
    return byCsType;
  }

  function actualAssignableCsTypes(
    graphType,
    registry
  ) {
    const definitions =
      registry?.getTypeDefinitions?.() || {};
    const result = new Set();
    const visited = new Set([
      String(graphType || "")
    ]);
    const pending = [
      ...(Array.isArray(
        definitions[graphType]?.assignableTo
      )
        ? definitions[graphType].assignableTo
        : [])
    ];
    while (pending.length > 0) {
      const id = String(
        pending.shift() || ""
      );
      if (!id || visited.has(id)) {
        continue;
      }
      visited.add(id);
      const information = definitions[id];
      const csType = normalizeCsType(
        information?.csType || ""
      );
      if (safeClosedCsType(csType)) {
        result.add(csType);
      }
      for (const base of
        Array.isArray(information?.assignableTo)
          ? information.assignableTo
          : []) {
        if (!visited.has(String(base || ""))) {
          pending.push(base);
        }
      }
    }
    return result;
  }

  function aliasPlan(documentValue, registry) {
    const evidence = new Map();
    const addEvidence = (graphType, csType) => {
      const id = String(graphType || "").trim();
      const canonical = normalizeCsType(csType);
      if (
        !id ||
        !safeClosedCsType(canonical)
      ) {
        return;
      }
      const values = evidence.get(id) ||
        new Set();
      values.add(canonical);
      evidence.set(id, values);
    };

    const normalized = normalizedTypeContracts(
      documentValue?.portableTypeContracts
    );
    for (const contract of normalized.contracts) {
      addEvidence(
        contract.graphType,
        contract.csType
      );
    }
    for (const view of graphViews(documentValue)) {
      for (const node of view.nodes) {
        for (const contract of [
          node?.apiContract,
          node?.importRecovery
            ?.originalApiContract
        ]) {
          for (const key of [
            "inputPorts",
            "outputPorts"
          ]) {
            for (const port of
              Array.isArray(contract?.[key])
                ? contract[key]
                : []) {
              addEvidence(
                port?.type,
                port?.csType
              );
            }
          }
        }
      }
    }

    const definitions =
      registry?.getTypeDefinitions?.() || {};
    const byCsType = liveTypeIndex(registry);
    const referencedTypes =
      referencedGraphTypes(
        documentValue,
        registry
      );
    for (const [csType, candidates] of
      byCsType) {
      if (candidates.size !== 1) {
        continue;
      }
      const historicalId =
        legacyApiGraphTypeId(csType);
      if (
        historicalId &&
        referencedTypes.has(historicalId)
      ) {
        addEvidence(
          historicalId,
          csType
        );
      }
    }
    const contractsByType = new Map(
      normalized.contracts.map(contract => [
        contract.graphType,
        contract
      ])
    );
    const aliases = new Map();
    const ambiguous = [];
    const missing = [];
    const hierarchyConflicts = [];
    const identityConflicts = [];
    for (const [source, values] of evidence) {
      if (values.size !== 1) {
        ambiguous.push(source);
        continue;
      }
      const [csType] = values;
      const stored = contractsByType.get(source);
      const existing = definitions[source];
      if (existing) {
        if (
          normalizeCsType(existing.csType) ===
            csType
        ) {
          continue;
        }
        identityConflicts.push(source);
        continue;
      }
      if (
        stored?.typeAuthority ===
          "language-exact"
      ) {
        continue;
      }
      const candidates = [
        ...(byCsType.get(csType) || [])
      ];
      if (candidates.length !== 1) {
        (candidates.length > 1
          ? ambiguous
          : missing).push(source);
        continue;
      }
      const target = candidates[0];
      if (stored) {
        const liveInformation = definitions[target];
        const compatibility =
          typeContractCompatibility(
            stored,
            liveInformation
          );
        if (
          !compatibility.compatible
        ) {
          hierarchyConflicts.push(source);
          continue;
        }
        const actual = actualAssignableCsTypes(
          target,
          registry
        );
        if (
          stored.assignableToCsTypes.some(
            base =>
              !/^System(?:\.|$)/.test(base) &&
              !actual.has(base)
          )
        ) {
          hierarchyConflicts.push(source);
          continue;
        }
      }
      aliases.set(source, target);
    }
    return Object.freeze({
      aliases,
      typeContracts:
        normalized.contracts,
      conflicts: Object.freeze([
        ...normalized.conflicts,
        ...identityConflicts.map(type =>
          `Portable graph type '${type}' conflicts with the installed C# type identity.`
        ),
        ...hierarchyConflicts.map(type =>
          `Portable graph type '${type}' conflicts with the live inheritance contract.`
        )
      ]),
      ambiguous: Object.freeze(
        [...new Set(ambiguous)].sort()
      ),
      missing: Object.freeze(
        [...new Set(missing)].sort()
      )
    });
  }

  function migrate(
    documentValue,
    registry
  ) {
    const plan = aliasPlan(
      documentValue,
      registry
    );
    if (plan.conflicts.length > 0) {
      throw new Error(plan.conflicts[0]);
    }
    let parameterCount = 0;
    let boundaryCount = 0;
    let contractPortCount = 0;
    let typeContractCount = 0;
    const patches = [];
    const patchesByTarget = new WeakMap();
    const queuePatch = (
      target,
      key,
      value,
      category
    ) => {
      if (
        !target ||
        typeof target !== "object" ||
        target[key] === value
      ) {
        return;
      }
      let byKey = patchesByTarget.get(target);
      if (!byKey) {
        byKey = new Map();
        patchesByTarget.set(target, byKey);
      }
      if (byKey.has(key)) {
        if (byKey.get(key).value !== value) {
          throw new Error(
            "Graph type migration produced conflicting writes."
          );
        }
        return;
      }
      const patch = {
        target,
        key,
        value,
        category,
        previous: target[key],
        hadOwn: Object.prototype
          .hasOwnProperty.call(target, key)
      };
      byKey.set(key, patch);
      patches.push(patch);
      if (category === "parameter") {
        parameterCount += 1;
      } else if (category === "boundary") {
        boundaryCount += 1;
      } else if (category === "contract-port") {
        contractPortCount += 1;
      } else if (category === "type-contract") {
        typeContractCount += 1;
      }
    };
    const definitions =
      registry?.getNodeDefinitions?.() || {};
    for (const view of graphViews(documentValue)) {
      for (const node of view.nodes) {
        const definition = definitions[
          String(node?.operatorId || "")
        ];
        const parameterKeys =
          explicitGraphTypeParameterKeys(
            definition
          );
        for (const [key, mode] of parameterKeys) {
          if (
            !node?.parameters ||
            !Object.prototype.hasOwnProperty.call(
              node.parameters,
              key
            )
          ) {
            continue;
          }
          const previous = node.parameters[key];
          const next = mappedParameterValue(
            previous,
            mode,
            plan.aliases
          );
          if (next !== previous) {
            queuePatch(
              node.parameters,
              key,
              next,
              "parameter"
            );
          }
        }
        if (
          [...parameterKeys.values()]
            .includes("list")
        ) {
          for (const key of Object.keys(
            node?.parameters || {}
          )) {
            if (!/^value\d+Type$/.test(key)) {
              continue;
            }
            const previous =
              node.parameters[key];
            const next =
              mappedParameterValue(
                previous,
                "single",
                plan.aliases
              );
            if (next !== previous) {
              queuePatch(
                node.parameters,
                key,
                next,
                "parameter"
              );
            }
          }
        }
        for (const contract of [
          node?.apiContract,
          node?.importRecovery
            ?.originalApiContract
        ]) {
          for (const key of [
            "inputPorts",
            "outputPorts"
          ]) {
            for (const port of
              Array.isArray(contract?.[key])
                ? contract[key]
                : []) {
              const next = plan.aliases.get(
                String(port?.type || "")
              );
              if (next) {
                queuePatch(
                  port,
                  "type",
                  next,
                  "contract-port"
                );
              }
            }
          }
        }
      }
      for (const boundary of
        Array.isArray(view.boundaryPorts)
          ? view.boundaryPorts
          : []) {
        const next = plan.aliases.get(
          String(boundary?.type || "")
        );
        if (next) {
          queuePatch(
            boundary,
            "type",
            next,
            "boundary"
          );
        }
      }
      for (const node of view.nodes) {
        for (const boundary of
          Array.isArray(
            node?.parameters?.boundaryPorts
          )
            ? node.parameters.boundaryPorts
            : []) {
          const next = plan.aliases.get(
            String(boundary?.type || "")
          );
          if (next) {
            queuePatch(
              boundary,
              "type",
              next,
              "boundary"
            );
          }
        }
      }
    }
    if (
      Array.isArray(
        documentValue?.portableTypeContracts
      )
    ) {
      for (const contract of
        documentValue.portableTypeContracts) {
        const next = plan.aliases.get(
          String(contract?.graphType || "")
        );
        if (next) {
          queuePatch(
            contract,
            "graphType",
            next,
            "type-contract"
          );
        }
      }
    }

    let committed = 0;
    try {
      for (const patch of patches) {
        patch.target[patch.key] = patch.value;
        committed += 1;
      }
    } catch (error) {
      for (
        let index = committed - 1;
        index >= 0;
        index -= 1
      ) {
        const patch = patches[index];
        try {
          if (patch.hadOwn) {
            patch.target[patch.key] =
              patch.previous;
          } else {
            delete patch.target[patch.key];
          }
        } catch {
        }
      }
      throw error;
    }
    return Object.freeze({
      changed: patches.length > 0,
      aliasCount: plan.aliases.size,
      parameterCount,
      boundaryCount,
      contractPortCount,
      typeContractCount,
      ambiguous: plan.ambiguous,
      missing: plan.missing
    });
  }

  const api = Object.freeze({
    version: MODULE_VERSION,
    normalizeCsType,
    normalizeTypeContract,
    normalizedTypeContracts,
    typeContractCompatibility,
    typeContractFromRegistry,
    legacyApiGraphTypeId,
    aliasPlan,
    migrate
  });

  if (
    typeof module === "object" &&
    module?.exports
  ) {
    module.exports = api;
  }
  if (typeof window === "object") {
    Object.defineProperty(
      window,
      "RMLGraphTypeImportMigrations",
      {
        value: api,
        writable: false,
        enumerable: true,
        configurable: true
      }
    );
  }
})();
