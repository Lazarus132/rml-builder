(function (root, factory) {
  "use strict";

  const api = factory(root);

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }

  if (root && typeof root === "object") {
    Object.defineProperty(root, "RMLCSharpLanguageNodes", {
      value: Object.freeze(api),
      writable: false,
      enumerable: true,
      configurable: true
    });

    if (root.RMLModNodeRegistry && root.RMLCSharpContracts) {
      api.install(root.RMLModNodeRegistry, root.RMLCSharpContracts);
    }
  }
})(
  typeof window !== "undefined"
    ? window
    : typeof globalThis !== "undefined"
      ? globalThis
      : this,
  function createCSharpLanguageNodes(root) {
    "use strict";

    const VERSION = 2;
    const GROUP = "C# Language";
    const EXACT_TYPE_PREFIX = "csharpExact:";
    const installedRegistries = new WeakSet();

    function uiText(key, fallback) {
      const translate = root?.RMLI18n?.t;
      if (typeof translate !== "function") return fallback;
      const translated = String(translate.call(root.RMLI18n, key) ?? "");
      return translated && translated !== key ? translated : fallback;
    }

    const CORE_ASSEMBLIES = new Set([
      "mscorlib",
      "netstandard",
      "System.Private.CoreLib",
      "System.Runtime"
    ]);

    const defaultTypeRef = Object.freeze({
      schemaVersion: 1,
      kind: "named",
      assemblyName: "System.Private.CoreLib",
      namespace: "System",
      names: Object.freeze([
        Object.freeze({ name: "Object", arity: 0 })
      ]),
      genericArguments: Object.freeze([])
    });

    const int32TypeRef = Object.freeze({
      schemaVersion: 1,
      kind: "named",
      assemblyName: "System.Private.CoreLib",
      namespace: "System",
      names: Object.freeze([
        Object.freeze({ name: "Int32", arity: 0 })
      ]),
      genericArguments: Object.freeze([])
    });

    const boolTypeRef = Object.freeze({
      schemaVersion: 1,
      kind: "named",
      assemblyName: "System.Private.CoreLib",
      namespace: "System",
      names: Object.freeze([
        Object.freeze({ name: "Boolean", arity: 0 })
      ]),
      genericArguments: Object.freeze([])
    });

    const stringTypeRef = Object.freeze({
      schemaVersion: 1,
      kind: "named",
      assemblyName: "System.Private.CoreLib",
      namespace: "System",
      names: Object.freeze([
        Object.freeze({ name: "String", arity: 0 })
      ]),
      genericArguments: Object.freeze([])
    });

    const stringBuilderTypeRef = Object.freeze({
      schemaVersion: 1,
      kind: "named",
      assemblyName: "System.Runtime",
      namespace: "System.Text",
      names: Object.freeze([
        Object.freeze({ name: "StringBuilder", arity: 0 })
      ]),
      genericArguments: Object.freeze([])
    });

    const defaultGetterRef = Object.freeze({
      schemaVersion: 1,
      kind: "property",
      access: "get",
      declaringType: stringTypeRef,
      name: "Length",
      isStatic: false,
      parameters: Object.freeze([]),
      returnType: int32TypeRef,
      genericArguments: Object.freeze([]),
      assemblyReferences: Object.freeze([])
    });

    const defaultSetterRef = Object.freeze({
      schemaVersion: 1,
      kind: "property",
      access: "set",
      declaringType: stringBuilderTypeRef,
      name: "Capacity",
      isStatic: false,
      parameters: Object.freeze([]),
      valueType: int32TypeRef,
      returnType: null,
      genericArguments: Object.freeze([]),
      assemblyReferences: Object.freeze([])
    });

    const defaultMethodRef = Object.freeze({
      schemaVersion: 1,
      kind: "method",
      access: "call",
      declaringType: stringTypeRef,
      name: "Contains",
      isStatic: false,
      parameters: Object.freeze([
        Object.freeze({
          position: 0,
          name: "value",
          type: stringTypeRef,
          refKind: "none",
          optional: false,
          hasDefaultValue: false,
          portId: "arg0"
        })
      ]),
      returnType: boolTypeRef,
      genericArguments: Object.freeze([]),
      assemblyReferences: Object.freeze([])
    });

    function parseStoredJson(value, label = "contract") {
      if (value && typeof value === "object" && !Array.isArray(value)) {
        return value;
      }

      if (typeof value !== "string") {
        throw new TypeError(`${label} must be a JSON object or JSON string.`);
      }

      const text = value.trim();
      if (!text) {
        throw new TypeError(`${label} is empty.`);
      }

      try {
        return JSON.parse(text);
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        throw new TypeError(`${label} is not valid JSON: ${reason}`);
      }
    }

    function parseOptionalStoredJson(value, label = "contract") {
      if (value === null || value === undefined || value === "") {
        return null;
      }
      return parseStoredJson(value, label);
    }

    function storedParameter(node, key, fallback) {
      if (
        node?.parameters &&
        Object.prototype.hasOwnProperty.call(node.parameters, key)
      ) {
        return node.parameters[key];
      }
      if (Object.prototype.hasOwnProperty.call(node || {}, key)) {
        return node[key];
      }
      return fallback;
    }

    function normalizeTypeRefInput(value, contracts) {
      const parsed = parseStoredJson(value, "typeRef");
      const candidate = typeof parsed === "string"
        ? contracts.parseTypeRef(parsed)
        : parsed;
      return contracts.normalizeTypeRef(candidate);
    }

    function editableTypeText(value, contracts) {
      return String(
        contracts.emitTypeSyntax(
          contracts.normalizeTypeRef(value),
          { global: false }
        )
      );
    }

    function clonedContractValue(value, serialize) {
      return JSON.parse(serialize(value));
    }

    function createTypeEditorModel(value, contracts) {
      if (
        !contracts ||
        typeof contracts.normalizeTypeRef !== "function" ||
        typeof contracts.serializeTypeRef !== "function" ||
        typeof contracts.emitTypeSyntax !== "function"
      ) {
        throw new TypeError(
          "A complete RMLCSharpContracts API is required to edit a TypeRef."
        );
      }
      const typeRef = contracts.normalizeTypeRef(value);
      const typeText = editableTypeText(typeRef, contracts);
      return {
        typeText,
        sourceTypeText: typeText,
        sourceTypeRef: clonedContractValue(
          typeRef,
          contracts.serializeTypeRef
        ),
        sourceAssemblyName: String(typeRef.assemblyName || ""),
        sourcePublicKeyToken: String(typeRef.publicKeyToken || ""),
        sourceAssemblyReferences: (typeRef.assemblyReferences || []).map(
          reference => ({ ...reference })
        )
      };
    }

    function editorTypeRef(model, contracts) {
      const source = model && typeof model === "object"
        ? model
        : { typeText: model };
      const typeText = String(source.typeText || "").trim();
      if (!typeText) {
        throw new TypeError("The C# type is empty.");
      }
      const parsed = contracts.parseTypeRef(typeText);
      const parsedText = editableTypeText(parsed, contracts);
      if (source.sourceTypeRef) {
        const preserved = contracts.normalizeTypeRef(source.sourceTypeRef);
        const preservedText = editableTypeText(preserved, contracts);
        if (parsedText === preservedText) return preserved;
      }
      return contracts.normalizeTypeRef(parsed);
    }

    function serializeTypeEditorModel(model, contracts) {
      if (
        !contracts ||
        typeof contracts.parseTypeRef !== "function" ||
        typeof contracts.normalizeTypeRef !== "function" ||
        typeof contracts.serializeTypeRef !== "function"
      ) {
        throw new TypeError(
          "A complete RMLCSharpContracts API is required to save a TypeRef."
        );
      }
      return contracts.serializeTypeRef(
        editorTypeRef(model, contracts)
      );
    }

    function memberModeMatches(memberRef, expectedMode = "") {
      const mode = String(expectedMode || "");
      return Boolean(
        !mode ||
        (mode === "get" &&
          memberRef.access === "get" &&
          ["field", "property"].includes(memberRef.kind)) ||
        (mode === "set" &&
          memberRef.access === "set" &&
          ["field", "property"].includes(memberRef.kind)) ||
        (mode === "call" &&
          memberRef.access === "call" &&
          memberRef.kind === "method")
      );
    }

    function requireMemberMode(memberRef, expectedMode = "") {
      const mode = String(expectedMode || "");
      if (!memberModeMatches(memberRef, mode)) {
        throw new TypeError(
          `MemberRef '${memberRef.kind}:${memberRef.access}' cannot be used by the '${mode}' C# shell.`
        );
      }
      return memberRef;
    }

    function createMemberTypeEditorRow(value, contracts) {
      const model = createTypeEditorModel(value, contracts);
      return {
        typeText: model.typeText,
        sourceTypeText: model.sourceTypeText,
        sourceTypeRef: model.sourceTypeRef
      };
    }

    function createMemberEditorModel(
      value,
      contracts,
      expectedMode = ""
    ) {
      if (
        !contracts ||
        typeof contracts.normalizeMemberRef !== "function" ||
        typeof contracts.serializeMemberRef !== "function" ||
        typeof contracts.emitConstantSyntax !== "function"
      ) {
        throw new TypeError(
          "A complete RMLCSharpContracts API is required to edit a MemberRef."
        );
      }
      const memberRef = requireMemberMode(
        contracts.normalizeMemberRef(value),
        expectedMode
      );
      const declaringType = createTypeEditorModel(
        memberRef.declaringType,
        contracts
      );
      const resultType = createTypeEditorModel(
        memberRef.returnType,
        contracts
      );
      const valueType = memberRef.valueType
        ? createTypeEditorModel(memberRef.valueType, contracts)
        : null;
      const sourceMemberRef = { ...memberRef };
      delete sourceMemberRef.stableContractId;
      return {
        kind: memberRef.kind,
        access: memberRef.access,
        isStatic: memberRef.isStatic === true,
        declaringTypeText: declaringType.typeText,
        sourceDeclaringTypeText: declaringType.sourceTypeText,
        sourceDeclaringTypeRef: declaringType.sourceTypeRef,
        name: memberRef.name,
        resultTypeText: resultType.typeText,
        sourceResultTypeText: resultType.sourceTypeText,
        sourceResultTypeRef: resultType.sourceTypeRef,
        valueTypeText: valueType?.typeText || "",
        sourceValueTypeText: valueType?.sourceTypeText || "",
        sourceValueTypeRef: valueType?.sourceTypeRef || null,
        parameters: memberRef.parameters.map(parameter => {
          const type = createMemberTypeEditorRow(
            parameter.typeRef,
            contracts
          );
          const defaultValueText = parameter.hasDefaultValue
            ? contracts.emitConstantSyntax(
                parameter.defaultValue,
                parameter.typeRef
              )
            : "";
          return {
            name: parameter.name,
            typeText: type.typeText,
            refKind: parameter.refKind,
            optional: parameter.optional === true,
            hasDefaultValue: parameter.hasDefaultValue === true,
            defaultValueText,
            sourceTypeText: type.sourceTypeText,
            sourceTypeRef: type.sourceTypeRef,
            sourceDefaultValueText: defaultValueText,
            sourceDefaultValue: parameter.hasDefaultValue
              ? structuredClone(parameter.defaultValue)
              : null
          };
        }),
        ownerGenericArguments: memberRef.ownerGenericArguments.map(
          argument => createMemberTypeEditorRow(argument, contracts)
        ),
        genericArguments: memberRef.genericArguments.map(
          argument => createMemberTypeEditorRow(argument, contracts)
        ),
        assemblyReferences: memberRef.assemblyReferences.map(
          reference => ({ ...reference })
        ),
        sourceMemberRef: clonedContractValue(
          sourceMemberRef,
          contracts.serializeMemberRef
        )
      };
    }

    function editorTypeRefFromFields(
      typeText,
      sourceTypeText,
      sourceTypeRef,
      contracts
    ) {
      return editorTypeRef(
        { typeText, sourceTypeText, sourceTypeRef },
        contracts
      );
    }

    function editorTypeRefFromRow(row, contracts) {
      const source = row && typeof row === "object"
        ? row
        : { typeText: row };
      return editorTypeRefFromFields(
        source.typeText,
        source.sourceTypeText,
        source.sourceTypeRef,
        contracts
      );
    }

    function serializeMemberEditorModel(
      model,
      contracts,
      expectedMode = ""
    ) {
      if (!model || typeof model !== "object" || Array.isArray(model)) {
        throw new TypeError("The structured C# member editor model is invalid.");
      }
      if (
        !contracts ||
        typeof contracts.normalizeMemberRef !== "function" ||
        typeof contracts.serializeMemberRef !== "function"
      ) {
        throw new TypeError(
          "A complete RMLCSharpContracts API is required to save a MemberRef."
        );
      }
      const mode = String(expectedMode || model.access || "");
      const access = mode === "call" ? "call" : mode;
      const kind = access === "call"
        ? "method"
        : String(model.kind || "property");
      const parameters = (Array.isArray(model.parameters)
        ? model.parameters
        : []).map((parameter, index) => {
          const optional = parameter?.optional === true;
          const hasDefaultValue = parameter?.hasDefaultValue === true;
          const row = {
            position: index,
            name: String(parameter?.name || `argument${index}`),
            typeRef: editorTypeRefFromRow(parameter, contracts),
            refKind: String(parameter?.refKind || "none"),
            optional,
            hasDefaultValue
          };
          if (hasDefaultValue) {
            const defaultValueText = String(
              parameter?.defaultValueText ?? ""
            ).trim();
            if (
              parameter?.sourceDefaultValue &&
              defaultValueText ===
                String(parameter.sourceDefaultValueText || "").trim()
            ) {
              row.defaultValue = structuredClone(
                parameter.sourceDefaultValue
              );
            } else {
              row.defaultValue = defaultValueText;
            }
          }
          return row;
        });
      const candidate = {
        schemaVersion: 1,
        kind,
        access,
        declaringType: editorTypeRefFromFields(
          model.declaringTypeText,
          model.sourceDeclaringTypeText,
          model.sourceDeclaringTypeRef,
          contracts
        ),
        name: String(model.name || ""),
        isStatic: model.isStatic === true,
        parameters,
        returnType: editorTypeRefFromFields(
          model.resultTypeText || "System.Void",
          model.sourceResultTypeText,
          model.sourceResultTypeRef,
          contracts
        ),
        ownerGenericArguments: (Array.isArray(model.ownerGenericArguments)
          ? model.ownerGenericArguments
          : []).map(row => editorTypeRefFromRow(row, contracts)),
        genericArguments: (Array.isArray(model.genericArguments)
          ? model.genericArguments
          : []).map(row => editorTypeRefFromRow(row, contracts)),
        assemblyReferences: (Array.isArray(model.assemblyReferences)
          ? model.assemblyReferences
          : []).map(reference => ({
            include: String(reference?.include || ""),
            hintPath: String(reference?.hintPath || ""),
            private: reference?.private === true
          }))
      };
      if (access === "set") {
        candidate.valueType = editorTypeRefFromFields(
          model.valueTypeText,
          model.sourceValueTypeText,
          model.sourceValueTypeRef,
          contracts
        );
      }
      const memberRef = requireMemberMode(
        contracts.normalizeMemberRef(candidate),
        expectedMode
      );
      const storedMemberRef = { ...memberRef };
      delete storedMemberRef.stableContractId;
      return contracts.serializeMemberRef(storedMemberRef);
    }

    function resolveStoredTypeContract(node, contracts) {
      try {
        const typeRef = normalizeTypeRefInput(
          storedParameter(node, "typeRef", JSON.stringify(defaultTypeRef)),
          contracts
        );
        const portContract = parseOptionalStoredJson(
          storedParameter(node, "portContract", null),
          "portContract"
        );
        return { ok: true, typeRef, portContract, error: null };
      } catch (error) {
        return {
          ok: false,
          typeRef: null,
          portContract: null,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    function resolveStoredMemberContract(node, contracts, expectedMode = "") {
      try {
        const memberRef = contracts.normalizeMemberRef(
          parseStoredJson(
            storedParameter(node, "memberRef", JSON.stringify(defaultGetterRef)),
            "memberRef"
          )
        );
        const portContract = parseOptionalStoredJson(
          storedParameter(node, "portContract", null),
          "portContract"
        );
        const mode = String(expectedMode || "");
        const matchesMode =
          !mode ||
          (mode === "get" &&
            memberRef.access === "get" &&
            ["field", "property"].includes(memberRef.kind)) ||
          (mode === "set" &&
            memberRef.access === "set" &&
            ["field", "property"].includes(memberRef.kind)) ||
          (mode === "call" &&
            memberRef.access === "call" &&
            memberRef.kind === "method");
        if (!matchesMode) {
          throw new TypeError(
            `MemberRef '${memberRef.kind}:${memberRef.access}' cannot be used by the '${mode}' C# shell.`
          );
        }
        return { ok: true, memberRef, portContract, error: null };
      } catch (error) {
        return {
          ok: false,
          memberRef: null,
          portContract: null,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    function readableAssemblyNames(memberRef) {
      return [
        ...new Set(
          (Array.isArray(memberRef?.assemblyReferences)
            ? memberRef.assemblyReferences
            : [])
            .map(reference => String(reference?.include || "").trim())
            .filter(Boolean)
        )
      ];
    }

    function readableParameterSyntax(parameter, contracts) {
      const modifier = String(parameter?.refKind || "none") === "none"
        ? ""
        : `${String(parameter.refKind)} `;
      const type = contracts.emitTypeSyntax(
        parameter?.typeRef || parameter?.type
      );
      const name = contracts.escapeIdentifier(
        String(parameter?.name || `argument${Number(parameter?.position) || 0}`)
      );
      return `${modifier}${type} ${name}`;
    }

    function describeMemberRef(value, contracts, expectedMode = "") {
      try {
        const memberRef = contracts.normalizeMemberRef(
          parseStoredJson(value, "memberRef")
        );
        const mode = String(expectedMode || "");
        const matchesMode =
          !mode ||
          (mode === "get" &&
            memberRef.access === "get" &&
            ["field", "property"].includes(memberRef.kind)) ||
          (mode === "set" &&
            memberRef.access === "set" &&
            ["field", "property"].includes(memberRef.kind)) ||
          (mode === "call" &&
            memberRef.access === "call" &&
            memberRef.kind === "method");
        if (!matchesMode) {
          throw new TypeError(
            `MemberRef '${memberRef.kind}:${memberRef.access}' does not match '${mode}'.`
          );
        }

        const owner = contracts.emitTypeSyntax(memberRef.declaringType);
        const memberName = contracts.emitMemberNameSyntax(memberRef);
        const readableMemberName = memberName.replaceAll("global::", "");
        const target = memberRef.isStatic === true ? owner : "target";
        const parameters = memberRef.parameters
          .map(parameter => readableParameterSyntax(parameter, contracts));
        const argumentsList = memberRef.parameters
          .map(parameter => {
            const modifier = String(parameter.refKind || "none") === "none"
              ? ""
              : `${String(parameter.refKind)} `;
            return `${modifier}${contracts.escapeIdentifier(parameter.name)}`;
          });
        const returnType = contracts.emitTypeSyntax(
          memberRef.access === "set"
            ? memberRef.valueType
            : memberRef.returnType
        );
        const prefix = memberRef.isStatic === true ? "static " : "instance ";
        let signature;
        let expression;

        if (memberRef.access === "call") {
          signature = `${prefix}${contracts.emitTypeSyntax(memberRef.returnType)} ${owner}.${readableMemberName}(${parameters.join(", ")})`;
          expression = `${target}.${memberName}(${argumentsList.join(", ")})`;
        } else if (memberRef.kind === "property") {
          signature = `${prefix}${returnType} ${owner}.${readableMemberName} { ${memberRef.access}; }`;
          expression = memberRef.access === "get"
            ? `${target}.${memberName}`
            : `${target}.${memberName} = value`;
        } else {
          signature = `${prefix}${returnType} ${owner}.${readableMemberName}`;
          expression = memberRef.access === "get"
            ? `${target}.${memberName}`
            : `${target}.${memberName} = value`;
        }

        const assemblies = readableAssemblyNames(memberRef);
        const readableSignature = signature.replaceAll("global::", "");
        const operation = [
          uiText(
            memberRef.isStatic === true
              ? "csharp.contract.scope.static"
              : "csharp.contract.scope.instance",
            memberRef.isStatic === true ? "static" : "instance"
          ),
          uiText(
            `csharp.contract.kind.${memberRef.kind}`,
            memberRef.kind
          ),
          uiText(
            `csharp.contract.access.${memberRef.access}`,
            memberRef.access
          )
        ].join(" ");
        return Object.freeze({
          ok: true,
          title:
            memberRef.access === "call"
              ? uiText("csharp.contract.title.method_call", "C# method call")
              : memberRef.access === "set"
                ? uiText("csharp.contract.title.member_write", "C# member write")
                : uiText("csharp.contract.title.member_read", "C# member read"),
          signature: readableSignature,
          expression,
          fields: Object.freeze([
            Object.freeze({
              label: uiText("csharp.contract.label.declaring_type", "Declaring type"),
              value: owner.replaceAll("global::", "")
            }),
            Object.freeze({
              label: uiText("csharp.contract.label.member", "Member"),
              value: readableMemberName
            }),
            Object.freeze({
              label: uiText("csharp.contract.label.operation", "Operation"),
              value: operation
            }),
            Object.freeze({
              label: memberRef.access === "set"
                ? uiText("csharp.contract.label.value_type", "Value type")
                : uiText("csharp.contract.label.return_type", "Return type"),
              value: returnType.replaceAll("global::", "")
            }),
            Object.freeze({
              label: uiText("csharp.contract.label.assembly", "Assembly"),
              value: assemblies.length > 0
                ? assemblies.join(", ")
                : uiText("csharp.contract.value.core_runtime", "Core runtime")
            })
          ]),
          note: uiText(
            "csharp.contract.note.identity_hidden",
            "Internal scanner identities are intentionally hidden; they are not C# syntax."
          )
        });
      } catch (error) {
        return Object.freeze({
          ok: false,
          title: uiText(
            "csharp.contract.title.invalid_member",
            "Invalid C# member contract"
          ),
          signature: "",
          expression: "",
          fields: Object.freeze([]),
          note: error instanceof Error ? error.message : String(error)
        });
      }
    }

    function describeTypeRef(value, contracts) {
      try {
        const typeRef = normalizeTypeRefInput(value, contracts);
        const syntax = contracts.emitTypeSyntax(typeRef);
        const readableSyntax = syntax.replaceAll("global::", "");
        return Object.freeze({
          ok: true,
          title: uiText("csharp.contract.title.type_literal", "C# type literal"),
          signature: `typeof(${readableSyntax})`,
          expression: `typeof(${syntax})`,
          fields: Object.freeze([
            Object.freeze({
              label: uiText("csharp.contract.label.type", "Type"),
              value: readableSyntax
            })
          ]),
          note: uiText(
            "csharp.contract.note.type_ref_internal",
            "The structured TypeRef is stored internally; the generated C# is shown here."
          )
        });
      } catch (error) {
        return Object.freeze({
          ok: false,
          title: uiText(
            "csharp.contract.title.invalid_type",
            "Invalid C# type contract"
          ),
          signature: "",
          expression: "",
          fields: Object.freeze([]),
          note: error instanceof Error ? error.message : String(error)
        });
      }
    }

    function stableHash(value) {
      const text = String(value ?? "");
      let hash = 0x811c9dc5;
      for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193) >>> 0;
      }
      return hash.toString(16).padStart(8, "0");
    }

    function normalizedCsType(value) {
      return String(value || "")
        .trim()
        .replaceAll("global::", "")
        .replace(/\s+/g, "")
        .replace(/&$/, "");
    }

    function normalizedReference(value) {
      if (typeof value === "string") {
        const include = value.trim();
        return include ? { include, hintPath: "", private: false } : null;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
      }
      const include = String(
        value.include || value.assemblyName || value.name || ""
      ).trim();
      if (!include) return null;
      return {
        include,
        hintPath: String(value.hintPath || "").trim(),
        private: value.private === true
      };
    }

    function collectReferences(contracts, ...values) {
      const references = new Map();
      const add = value => {
        const reference = normalizedReference(value);
        if (!reference || CORE_ASSEMBLIES.has(reference.include)) return;
        const key = reference.include.toLowerCase();
        const previous = references.get(key);
        references.set(key, {
          include: reference.include,
          hintPath: reference.hintPath || previous?.hintPath || "",
          private: reference.private === true || previous?.private === true
        });
      };

      for (const value of values) {
        if (!value) continue;
        try {
          const collected = contracts.collectAssemblyReferences(value);
          if (Array.isArray(collected)) collected.forEach(add);
        } catch {
          // Normalization already validates the executable contract. A missing
          // optional reference projection must not turn into raw code fallback.
        }
        const explicit = [
          ...(Array.isArray(value.assemblyReferences)
            ? value.assemblyReferences
            : []),
          ...(Array.isArray(value.requiredAssemblyReferences)
            ? value.requiredAssemblyReferences
            : [])
        ];
        explicit.forEach(add);
      }

      return [...references.values()];
    }

    function graphTypeDefinitions(registry) {
      return registry.getTypeDefinitions?.() || {};
    }

    function graphTypeForCsType(registry, csType) {
      const expected = normalizedCsType(csType);
      if (!expected) return "";
      for (const [graphType, information] of Object.entries(
        graphTypeDefinitions(registry)
      )) {
        if (
          normalizedCsType(
            registry.canonicalCsType(information?.csType || graphType)
          ) === expected
        ) {
          return graphType;
        }
      }
      return "";
    }

    function exactTypeLabel(csType) {
      const text = String(csType || "")
        .replaceAll("global::", "")
        .replace(/^System\./, "");
      const generic = text.indexOf("<");
      const head = generic >= 0 ? text.slice(0, generic) : text;
      const tail = head.split(/[.+]/).at(-1) || "T";
      return generic >= 0 ? `${tail}${text.slice(generic)}` : tail;
    }

    function csTypeLooksLikeValueType(csType) {
      return new Set([
        "System.Boolean", "System.Byte", "System.SByte", "System.Int16",
        "System.UInt16", "System.Int32", "System.UInt32", "System.Int64",
        "System.UInt64", "System.IntPtr", "System.UIntPtr", "System.Half",
        "System.Single", "System.Double", "System.Decimal", "System.Char",
        "System.DateTime", "System.DateTimeOffset", "System.TimeSpan",
        "System.Guid"
      ]).has(normalizedCsType(csType));
    }

    function ensureExactGraphType(
      registry,
      csType,
      references = [],
      preferredGraphType = "",
      metadata = {}
    ) {
      const normalized = normalizedCsType(csType);
      if (!normalized) {
        const preferred = String(preferredGraphType || "").trim();
        return preferred && graphTypeDefinitions(registry)[preferred]
          ? preferred
          : "object";
      }

      const preferred = String(preferredGraphType || "").trim();
      if (preferred && graphTypeDefinitions(registry)[preferred]) {
        return preferred;
      }

      const canonical = registry.canonicalType?.(normalized) || "";
      if (canonical && graphTypeDefinitions(registry)[canonical]) {
        return canonical;
      }

      const indexed = graphTypeForCsType(registry, normalized);
      if (indexed) return indexed;

      const id = preferred || `${EXACT_TYPE_PREFIX}${stableHash(normalized)}`;
      const assemblyReferences = references
        .map(normalizedReference)
        .filter(Boolean);
      const valueType = metadata.valueType === true ||
        metadata.isValueType === true ||
        csTypeLooksLikeValueType(normalized);

      registry.registerType(id, {
        label: String(metadata.label || exactTypeLabel(normalized)),
        short: String(metadata.short || "C#").slice(0, 8),
        color: String(metadata.color || "#91b9dd"),
        csType: normalized,
        defaultCs: valueType ? `default(${normalized})` : "default!",
        referenceType: !valueType,
        valueType,
        globalGenericCandidate: false,
        csharpExactType: true,
        assignableTo: ["object"],
        constraints: valueType
          ? ["value", "serializable"]
          : ["reference", "serializable"],
        assembly: assemblyReferences[0]?.include || "",
        assemblies: assemblyReferences.map(reference => reference.include),
        assemblyReferences
      });

      return id;
    }

    function normalizedPortRows(value, direction) {
      const direct = direction === "input"
        ? value?.inputs || value?.inputPorts
        : value?.outputs || value?.outputPorts;
      return Array.isArray(direct) ? direct : [];
    }

    function hasExplicitPortRows(value, direction) {
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        return false;
      }
      return direction === "input"
        ? Array.isArray(value.inputs) || Array.isArray(value.inputPorts)
        : Array.isArray(value.outputs) || Array.isArray(value.outputPorts);
    }

    function deriveShellPortRows(contracts, reference, portContract) {
      let derived = null;
      try {
        derived = contracts.deriveShellPorts(reference, portContract || null);
      } catch {
        derived = null;
      }
      return {
        inputs: normalizedPortRows(derived, "input").length > 0
          ? normalizedPortRows(derived, "input")
          : normalizedPortRows(portContract, "input"),
        outputs: normalizedPortRows(derived, "output").length > 0
          ? normalizedPortRows(derived, "output")
          : normalizedPortRows(portContract, "output")
      };
    }

    function semanticRole(port, direction, contracts) {
      const existing = String(
        port?.role || port?.semanticRole || ""
      ).trim();
      if (existing) return existing;
      try {
        return String(contracts.portablePortRole(
          "csharp-shell",
          direction,
          port,
          []
        ) || "");
      } catch {
        return `${direction}:${String(port?.id || "value")}`;
      }
    }

    function builtInPortType(port, direction, role) {
      const id = String(port?.id || "");
      const text = `${role}|${id}`.toLowerCase();
      if (text.includes("call") || text.includes("done")) return "impulse";
      if (text.includes("success")) return "bool";
      if (text.includes("exception")) return "exception";
      if (text.includes("generic:") || /^generic\d+$/.test(id) || /^ownergeneric\d+$/.test(id)) {
        return "type";
      }
      if (direction === "output" && id === "value" && normalizedCsType(port?.csType) === "System.Type") {
        return "type";
      }
      return "";
    }

    function runtimePort(
      registry,
      contracts,
      reference,
      direction,
      row,
      references
    ) {
      const id = String(row?.id || "").trim();
      if (!id) return null;
      const label = String(row?.label || row?.name || id);
      const role = semanticRole(row, direction, contracts);
      let csType = String(row?.csType || row?.csharpType || "").trim();
      if (!csType && (row?.typeRef || row?.bindingTypeRef)) {
        csType = emitType(
          contracts,
          row.typeRef || row.bindingTypeRef
        );
      }
      const savedType = String(row?.type || row?.graphType || "").trim();
      const builtIn = builtInPortType(row, direction, role);
      const graphType = builtIn || ensureExactGraphType(
        registry,
        csType,
        references,
        savedType,
        row
      );
      const extra = {
        optional: row?.optional === true,
        semanticRole: role,
        apiCsType: csType,
        csharpShellPort: true
      };

      if (row?.generic === true && row?.typeVar && !savedType && !csType) {
        return registry.genericPort(
          id,
          label,
          String(row.typeVar),
          String(row.constraint || "value"),
          extra
        );
      }
      return registry.port(id, label, graphType, extra);
    }

    function deriveRuntimePorts(
      registry,
      contracts,
      reference,
      portContract,
      fallback = { inputs: [], outputs: [] }
    ) {
      const rows = deriveShellPortRows(contracts, reference, portContract);
      const references = collectReferences(contracts, reference);
      const inputRows =
        hasExplicitPortRows(portContract, "input") || rows.inputs.length > 0
          ? rows.inputs
          : fallback.inputs || [];
      const outputRows =
        hasExplicitPortRows(portContract, "output") || rows.outputs.length > 0
          ? rows.outputs
          : fallback.outputs || [];
      const inputs = inputRows
        .map(row => runtimePort(
          registry,
          contracts,
          reference,
          "input",
          row,
          references
        ))
        .filter(Boolean);
      const outputs = outputRows
        .map(row => runtimePort(
          registry,
          contracts,
          reference,
          "output",
          row,
          references
        ))
        .filter(Boolean);
      return { inputs, outputs, inputRows, outputRows };
    }

    function emitType(contracts, typeRef) {
      return String(contracts.emitTypeSyntax(typeRef)).trim();
    }

    function emitMemberName(contracts, memberRef) {
      try {
        const emitted = String(contracts.emitMemberNameSyntax(memberRef)).trim();
        if (emitted) return emitted;
      } catch {
        // Fall through to the independently validated identifier projection.
      }
      return contracts.escapeIdentifier(String(memberRef?.name || ""));
    }

    function emitTypeOfExpression(typeRef, contracts) {
      return `typeof(${emitType(contracts, typeRef)})`;
    }

    function memberDeclaringType(memberRef) {
      return memberRef?.declaringType || memberRef?.ownerType || memberRef?.type;
    }

    function memberReturnType(memberRef) {
      return memberRef?.returnType || memberRef?.resultType || null;
    }

    function memberParameters(memberRef) {
      return Array.isArray(memberRef?.parameters)
        ? [...memberRef.parameters].sort(
            (left, right) =>
              (Number(left?.position) || 0) - (Number(right?.position) || 0)
          )
        : [];
    }

    function parameterType(parameter) {
      return parameter?.typeRef || parameter?.elementType || parameter?.type;
    }

    function parameterRefKind(parameter) {
      const explicit = String(parameter?.refKind || "").toLowerCase();
      if (["ref", "out", "in", "none"].includes(explicit)) return explicit;
      if (parameter?.isOut === true) return "out";
      if (parameter?.isByRef === true) return parameter?.isIn === true ? "in" : "ref";
      return "none";
    }

    function roleContains(row, value) {
      return String(row?.role || row?.semanticRole || "")
        .toLowerCase()
        .includes(String(value || "").toLowerCase());
    }

    function findPortRow(rows, candidates, fallbackId = "") {
      for (const candidate of candidates) {
        const exact = rows.find(row =>
          String(row?.id || "") === candidate ||
          String(row?.role || row?.semanticRole || "") === candidate
        );
        if (exact) return exact;
      }
      for (const candidate of candidates) {
        const partial = rows.find(row => roleContains(row, candidate));
        if (partial) return partial;
      }
      return rows.find(row => String(row?.id || "") === fallbackId) || null;
    }

    function parameterInputId(parameter, index, inputRows) {
      const explicit = String(
        parameter?.portId || parameter?.inputPortId || ""
      ).trim();
      if (explicit) return explicit;
      const position = Math.max(0, Number(parameter?.position) || index);
      const byRole = inputRows.find(row => {
        const role = String(row?.role || row?.semanticRole || "").toLowerCase();
        return role.includes(`parameter:${position}:input`);
      });
      return String(byRole?.id || `arg${position}`);
    }

    function parameterOutputId(parameter, index, outputRows) {
      const explicit = String(
        parameter?.outputPortId || ""
      ).trim();
      if (explicit) return explicit;
      const position = Math.max(0, Number(parameter?.position) || index);
      const byRole = outputRows.find(row => {
        const role = String(row?.role || row?.semanticRole || "").toLowerCase();
        return role.includes(`parameter:${position}:output`) ||
          role.includes(`out:${position}`);
      });
      return String(byRole?.id || `out${position}`);
    }

    function nodePortRows(contracts, reference, portContract) {
      return deriveShellPortRows(contracts, reference, portContract);
    }

    function targetInputId(inputRows) {
      return String(
        findPortRow(inputRows, ["input:target", "target"], "target")?.id ||
        "target"
      );
    }

    function valueInputId(inputRows) {
      return String(
        findPortRow(inputRows, ["input:value", "value"], "value")?.id ||
        "value"
      );
    }

    function outputId(outputRows, role, fallback) {
      return String(
        findPortRow(outputRows, [`output:${role}`, role], fallback)?.id || fallback
      );
    }

    function inputIsConnected(api, id) {
      if (typeof api?.isInputConnected === "function") {
        return api.isInputConnected(id);
      }
      return api.input(id)?.connected === true;
    }

    function outputIsUsed(api, id) {
      if (!id) return false;
      if (
        typeof api?.isActionReachable === "function" &&
        !api.isActionReachable()
      ) {
        return false;
      }
      return typeof api?.isOutputConnected === "function"
        ? api.isOutputConnected(id)
        : true;
    }

    function outputPortId(api) {
      return String(
        api?.outputPortId ??
        api?.outputId ??
        api?.portId ??
        api?.output?.id ??
        api?.port?.id ??
        api?.connection?.fromPort ??
        ""
      );
    }

    function actionFields(api) {
      const token = api.token(api.node.id);
      return {
        result: `_csharpResult${token}`,
        success: `_csharpSuccess${token}`,
        exception: `_csharpException${token}`,
        out(position) {
          return `_csharpOut${Number(position)}${token}`;
        }
      };
    }

    function collectNodeReferences(api, contracts, reference) {
      for (const assemblyReference of collectReferences(contracts, reference)) {
        api.addReference(assemblyReference);
      }
    }

    function isVoidType(typeRef, contracts) {
      if (!typeRef) return true;
      return normalizedCsType(emitType(contracts, typeRef)) === "System.Void";
    }

    function collectActionFields(api, contracts, memberRef, portContract) {
      collectNodeReferences(api, contracts, memberRef);
      const rows = nodePortRows(contracts, memberRef, portContract);
      const fields = actionFields(api);
      const successId = outputId(rows.outputs, "success", "success");
      const exceptionId = outputId(rows.outputs, "exception", "exception");
      const resultId = outputId(rows.outputs, "result", "result");

      if (outputIsUsed(api, successId)) {
        api.addRuntimeField(
          `${api.node.id}.csharp.success`,
          fields.success,
          "bool",
          "false"
        );
      }
      if (outputIsUsed(api, exceptionId)) {
        api.addRuntimeField(
          `${api.node.id}.csharp.exception`,
          fields.exception,
          "System.Exception?",
          "null"
        );
      }

      const returnType = memberReturnType(memberRef);
      if (
        !isVoidType(returnType, contracts) &&
        outputIsUsed(api, resultId)
      ) {
        api.addRuntimeField(
          `${api.node.id}.csharp.result`,
          fields.result,
          emitType(contracts, returnType),
          "default!"
        );
      }

      memberParameters(memberRef).forEach((parameter, index) => {
        const kind = parameterRefKind(parameter);
        if (!["ref", "out"].includes(kind)) return;
        const id = parameterOutputId(parameter, index, rows.outputs);
        if (!outputIsUsed(api, id)) return;
        const position = Math.max(0, Number(parameter?.position) || index);
        api.addRuntimeField(
          `${api.node.id}.csharp.out.${position}`,
          fields.out(position),
          emitType(contracts, parameterType(parameter)),
          "default!"
        );
      });
    }

    function emitConstant(contracts, parameter) {
      const typeRef = parameterType(parameter);
      const raw = parameter?.defaultValue ??
        parameter?.defaultConstant ??
        parameter?.constant ??
        parameter?.defaultValueCSharp;

      if (raw !== undefined && raw !== null && raw !== "") {
        try {
          const parsed = contracts.parsePortableConstant(raw, typeRef);
          const emitted = String(
            contracts.emitConstantSyntax(parsed, typeRef)
          ).trim();
          if (emitted) return emitted;
        } catch {
          // Never inject the scanner's raw C# text. The typed default below is
          // the safe failure value for an invalid hand-edited contract.
        }
      }
      return `default(${emitType(contracts, typeRef)})`;
    }

    function castInput(api, id, typeRef, contracts) {
      const csType = emitType(contracts, typeRef);
      return `((${csType})(${api.input(id).code}))`;
    }

    function emitHost(api, contracts, memberRef, inputRows) {
      const declaringType = emitType(contracts, memberDeclaringType(memberRef));
      if (memberRef?.isStatic === true) return declaringType;
      return castInput(
        api,
        targetInputId(inputRows),
        memberDeclaringType(memberRef),
        contracts
      );
    }

    function propertyIndexParameters(memberRef, inputRows) {
      const valueId = valueInputId(inputRows);
      return memberParameters(memberRef).filter((parameter, index) =>
        parameterInputId(parameter, index, inputRows) !== valueId &&
        parameter?.isValue !== true &&
        String(parameter?.role || "") !== "value"
      );
    }

    function emitMemberAccess(api, contracts, memberRef, portContract) {
      const rows = nodePortRows(contracts, memberRef, portContract);
      const host = emitHost(api, contracts, memberRef, rows.inputs);
      const name = emitMemberName(contracts, memberRef);
      const indexParameters = propertyIndexParameters(memberRef, rows.inputs);
      const isIndexer = memberRef?.isIndexer === true ||
        (String(memberRef?.kind || "") === "property" &&
          name.replace(/^@/, "") === "Item" && indexParameters.length > 0);

      if (isIndexer) {
        const indexes = indexParameters.map((parameter, index) =>
          castInput(
            api,
            parameterInputId(parameter, index, rows.inputs),
            parameterType(parameter),
            contracts
          )
        );
        return `${host}[${indexes.join(", ")}]`;
      }
      return `${host}.${name}`;
    }

    function emitMemberGetExpression(api, contracts, memberRef, portContract) {
      return emitMemberAccess(api, contracts, memberRef, portContract);
    }

    function buildMethodArguments(api, contracts, memberRef, portContract) {
      const rows = nodePortRows(contracts, memberRef, portContract);
      const parameters = memberParameters(memberRef);
      const token = api.token(api.node.id);
      const fields = actionFields(api);
      const declarations = [];
      const argumentsList = [];
      const assignments = [];
      const entries = parameters.map((parameter, index) => {
        const id = parameterInputId(parameter, index, rows.inputs);
        const kind = parameterRefKind(parameter);
        const optional = parameter?.optional === true || parameter?.isOptional === true;
        return {
          parameter,
          index,
          id,
          kind,
          optional,
          connected: kind === "out" ? true : inputIsConnected(api, id)
        };
      });

      let lastIncluded = entries.length - 1;
      while (
        lastIncluded >= 0 &&
        entries[lastIncluded].optional &&
        !entries[lastIncluded].connected &&
        entries[lastIncluded].kind === "none"
      ) {
        lastIncluded -= 1;
      }

      for (let entryIndex = 0; entryIndex <= lastIncluded; entryIndex += 1) {
        const entry = entries[entryIndex];
        const parameter = entry.parameter;
        const position = Math.max(0, Number(parameter?.position) || entry.index);
        const typeSyntax = emitType(contracts, parameterType(parameter));
        const local = `_csharpArg${position}${token}`;

        if (entry.kind === "out") {
          declarations.push(`${typeSyntax} ${local};`);
          argumentsList.push(`out ${local}`);
        } else if (["ref", "in"].includes(entry.kind)) {
          declarations.push(
            `${typeSyntax} ${local} = ${castInput(
              api,
              entry.id,
              parameterType(parameter),
              contracts
            )};`
          );
          argumentsList.push(`${entry.kind} ${local}`);
        } else if (entry.optional && !entry.connected) {
          argumentsList.push(emitConstant(contracts, parameter));
        } else {
          argumentsList.push(
            castInput(api, entry.id, parameterType(parameter), contracts)
          );
        }

        if (["ref", "out"].includes(entry.kind)) {
          const id = parameterOutputId(parameter, entry.index, rows.outputs);
          if (outputIsUsed(api, id)) {
            assignments.push(`${fields.out(position)} = ${local};`);
          }
        }
      }

      return { declarations, arguments: argumentsList, assignments, rows };
    }

    function wrapAction(api, rows, body) {
      const fields = actionFields(api);
      const successId = outputId(rows.outputs, "success", "success");
      const exceptionId = outputId(rows.outputs, "exception", "exception");
      const keepSuccess = outputIsUsed(api, successId);
      const keepException = outputIsUsed(api, exceptionId);
      const success = [
        keepSuccess ? `    ${fields.success} = true;` : "",
        keepException ? `    ${fields.exception} = null;` : ""
      ].filter(Boolean).join("\n");
      const failure = [
        keepSuccess ? `    ${fields.success} = false;` : "",
        keepException ? `    ${fields.exception} = exception;` : ""
      ].filter(Boolean).join("\n");

      return (
        `try\n{\n${String(body || "").trimEnd()}` +
        `${success ? `\n${success}` : ""}\n}\n` +
        "catch (System.Exception exception)\n{\n" +
        `${keepException ? failure : "    throw;"}\n}`
      );
    }

    function appendDone(api, rows, action) {
      const doneId = outputId(rows.outputs, "done", "done");
      const next = api.emit(doneId);
      return `${String(action || "").trimEnd()}${next ? `\n${next}();` : ""}`;
    }

    function buildMemberAction(api, contracts, memberRef, portContract) {
      const access = String(memberRef?.access || "").toLowerCase();
      const kind = String(memberRef?.kind || "").toLowerCase();
      const fields = actionFields(api);
      let body = "";
      let rows;

      if (kind === "method" || access === "call") {
        const built = buildMethodArguments(
          api,
          contracts,
          memberRef,
          portContract
        );
        rows = built.rows;
        const host = emitHost(api, contracts, memberRef, rows.inputs);
        const invocation = `${host}.${emitMemberName(
          contracts,
          memberRef
        )}(${built.arguments.join(", ")})`;
        const resultId = outputId(rows.outputs, "result", "result");
        const assignment = isVoidType(memberReturnType(memberRef), contracts)
          ? `${invocation};`
          : `${outputIsUsed(api, resultId) ? fields.result : "_"} = ${invocation};`;
        body = [
          ...built.declarations,
          assignment,
          ...built.assignments
        ].map(line => `    ${line}`).join("\n");
      } else if (access === "set") {
        rows = nodePortRows(contracts, memberRef, portContract);
        const valueRow = findPortRow(
          rows.inputs,
          ["input:value", "value"],
          "value"
        );
        const valueType = memberRef?.valueType ||
          valueRow?.typeRef ||
          valueRow?.csTypeRef ||
          memberParameters(memberRef).find((parameter, index) =>
            parameterInputId(parameter, index, rows.inputs) === valueInputId(rows.inputs)
          )?.type ||
          memberReturnType(memberRef);
        if (!valueType) {
          throw new TypeError("The member setter has no typed value contract.");
        }
        body = `    ${emitMemberAccess(
          api,
          contracts,
          memberRef,
          portContract
        )} = ${castInput(
          api,
          valueInputId(rows.inputs),
          valueType,
          contracts
        )};`;
      } else {
        throw new TypeError("Only direct method calls and member setters are actions.");
      }

      return appendDone(api, rows, wrapAction(api, rows, body));
    }

    function actionOutputExpression(api, contracts, memberRef, portContract) {
      if (
        typeof api?.isActionReachable === "function" &&
        !api.isActionReachable()
      ) {
        return "default!";
      }
      const rows = nodePortRows(contracts, memberRef, portContract);
      const fields = actionFields(api);
      const id = outputPortId(api);
      if (id === outputId(rows.outputs, "success", "success")) return fields.success;
      if (id === outputId(rows.outputs, "exception", "exception")) return fields.exception;
      if (id === outputId(rows.outputs, "result", "result")) return fields.result;

      const parameters = memberParameters(memberRef);
      for (let index = 0; index < parameters.length; index += 1) {
        if (id !== parameterOutputId(parameters[index], index, rows.outputs)) continue;
        const position = Math.max(0, Number(parameters[index]?.position) || index);
        return fields.out(position);
      }
      return "default!";
    }

    function reportInvalid(api, kind, result) {
      api.diagnostic?.(
        `${kind} contains an invalid structured C# contract: ${result.error || "unknown error"}`
      );
    }

    function typedEditorPortRow(
      registry,
      contracts,
      reference,
      {
        id,
        role,
        label,
        typeRef,
        optional = false,
        binding = false
      }
    ) {
      const normalizedTypeRef = contracts.normalizeTypeRef(typeRef);
      const references = collectReferences(
        contracts,
        reference,
        normalizedTypeRef
      );
      const graphType = ensureExactGraphType(
        registry,
        contracts.emitTypeSyntax(normalizedTypeRef),
        references,
        "",
        { label }
      );
      return {
        id,
        role,
        graphType,
        optional: optional === true,
        ...(label ? { label: String(label) } : {}),
        [binding ? "bindingTypeRef" : "typeRef"]: normalizedTypeRef
      };
    }

    function fixedEditorPortRow(id, role, graphType, label) {
      return {
        id,
        role,
        graphType,
        optional: false,
        ...(label ? { label } : {})
      };
    }

    function nestedTypeArguments(typeRef, contracts) {
      const result = [];
      const visit = value => {
        const normalized = contracts.normalizeTypeRef(value);
        if (normalized.kind === "named") {
          for (const segment of normalized.segments) {
            for (const argument of segment.genericArguments || []) {
              result.push(argument);
              visit(argument);
            }
          }
        } else if (normalized.elementType) {
          visit(normalized.elementType);
        }
      };
      visit(typeRef);
      return result;
    }

    function deriveTypeEditorPortContract(registry, contracts, typeRef) {
      const normalized = contracts.normalizeTypeRef(typeRef);
      const inputs = nestedTypeArguments(normalized, contracts).map(
        (argument, index) => ({
          id: `generic${index}`,
          role: `generic:${index}:input`,
          graphType: "type",
          optional: true,
          bindingTypeRef: argument
        })
      );
      const outputs = [typedEditorPortRow(
        registry,
        contracts,
        normalized,
        {
          id: "value",
          role: "output:value",
          label: "Type",
          typeRef: "System.Type"
        }
      )];
      return contracts.serializePortContract({
        schemaVersion: 1,
        inputs,
        outputs
      });
    }

    function deriveMemberEditorPortContract(
      registry,
      contracts,
      memberRef
    ) {
      const member = contracts.normalizeMemberRef(memberRef);
      const inputs = [];
      const outputs = [];
      const typed = (configuration) => typedEditorPortRow(
        registry,
        contracts,
        member,
        configuration
      );

      if (member.access === "set" || member.kind === "method") {
        inputs.push(fixedEditorPortRow(
          "call",
          "input:call",
          "impulse",
          "Call"
        ));
      }
      member.ownerGenericArguments.forEach((argument, index) => {
        inputs.push({
          id: `ownerGeneric${index}`,
          role: `owner-generic:${index}:input`,
          graphType: "type",
          optional: true,
          bindingTypeRef: argument
        });
      });
      member.genericArguments.forEach((argument, index) => {
        inputs.push({
          id: `generic${index}`,
          role: `generic:${index}:input`,
          graphType: "type",
          optional: true,
          bindingTypeRef: argument
        });
      });
      if (!member.isStatic) {
        inputs.push(typed({
          id: "target",
          role: "input:target",
          label: "Target",
          typeRef: member.declaringType
        }));
      }
      member.parameters.forEach((parameter, index) => {
        if (parameter.refKind === "out") return;
        const position = Math.max(0, Number(parameter.position) || index);
        inputs.push(typed({
          id: `arg${position}`,
          role: `parameter:${position}:input`,
          label: parameter.name || `arg${position}`,
          typeRef: parameter.typeRef,
          optional: parameter.optional === true
        }));
      });
      if (member.access === "set") {
        inputs.push(typed({
          id: "value",
          role: "input:value",
          label: "Value",
          typeRef: member.valueType
        }));
      }

      if (member.access === "get") {
        outputs.push(typed({
          id: "value",
          role: "output:value",
          label: "Value",
          typeRef: member.returnType
        }));
      } else {
        outputs.push(fixedEditorPortRow(
          "done",
          "output:done",
          "impulse",
          "Done"
        ));
        if (
          member.kind === "method" &&
          contracts.typeRefSemanticKey(member.returnType) !==
            contracts.typeRefSemanticKey("System.Void")
        ) {
          outputs.push(typed({
            id: "result",
            role: "output:result",
            label: "Result",
            typeRef: member.returnType
          }));
        }
        member.parameters.forEach((parameter, index) => {
          if (!["ref", "out"].includes(parameter.refKind)) return;
          const position = Math.max(0, Number(parameter.position) || index);
          outputs.push(typed({
            id: `out${position}`,
            role: `parameter:${position}:output`,
            label: parameter.name || `out${position}`,
            typeRef: parameter.typeRef
          }));
        });
        outputs.push(
          fixedEditorPortRow(
            "success",
            "output:success",
            "bool",
            "Success"
          ),
          fixedEditorPortRow(
            "exception",
            "output:exception",
            "exception",
            "Exception"
          )
        );
      }

      return contracts.serializePortContract({
        schemaVersion: 1,
        inputs,
        outputs
      });
    }

    function validateTypeEditorValue(value, registry, contracts) {
      try {
        const typeRef = normalizeTypeRefInput(value, contracts);
        return {
          ok: true,
          parameterUpdates: {
            typeRef: contracts.serializeTypeRef(typeRef),
            portContract: deriveTypeEditorPortContract(
              registry,
              contracts,
              typeRef
            )
          }
        };
      } catch (error) {
        return {
          ok: false,
          error: error instanceof Error ? error.message : String(error)
        };
      }
    }

    function validateMemberEditorValue(
      value,
      node,
      registry,
      contracts,
      expectedMode
    ) {
      const candidate = resolveStoredMemberContract(
        {
          ...node,
          parameters: {
            ...(node?.parameters || {}),
            memberRef: value
          }
        },
        contracts,
        expectedMode
      );
      if (!candidate.ok) {
        return { ok: false, error: candidate.error };
      }
      const storedMemberRef = { ...candidate.memberRef };
      delete storedMemberRef.stableContractId;
      return {
        ok: true,
        parameterUpdates: {
          memberRef: contracts.serializeMemberRef(storedMemberRef),
          portContract: deriveMemberEditorPortContract(
            registry,
            contracts,
            candidate.memberRef
          )
        }
      };
    }

    function structuredEditorParameter(
      key,
      label,
      kind,
      defaultValue,
      options = {}
    ) {
      if (!["csharpTypeRef", "csharpMemberRef"].includes(kind)) {
        throw new TypeError(`Unsupported structured C# editor kind '${kind}'.`);
      }
      return {
        key,
        label,
        kind,
        default: String(options.serializeDefault(defaultValue)),
        structuredEditor: true,
        ...(options.memberMode
          ? { memberMode: String(options.memberMode) }
          : {}),
        help: options.help || uiText(
          "csharp.contract.help.structured_editor",
          "Edit the C# contract with structured fields. Ports update automatically."
        ),
        affectsPorts: options.affectsPorts !== false,
        affectsNode: true,
        commitImmediately: true,
        presentation:
          typeof options.presentation === "function"
            ? options.presentation
            : null,
        validateEditorValue:
          typeof options.validateEditorValue === "function"
            ? options.validateEditorValue
            : null,
        createEditorModel:
          typeof options.createEditorModel === "function"
            ? options.createEditorModel
            : null,
        serializeEditorModel:
          typeof options.serializeEditorModel === "function"
            ? options.serializeEditorModel
            : null
      };
    }

    function hiddenPortContractParameter(
      label,
      defaultValue,
      contracts
    ) {
      return {
        key: "portContract",
        label,
        kind: "hidden",
        default: contracts.serializePortContract(defaultValue),
        inspectorHidden: true,
        affectsPorts: true,
        affectsNode: true,
        commitImmediately: true
      };
    }

    function typePortFallback() {
      return {
        inputs: [],
        outputs: [
          { id: "value", label: "Type", type: "type", csType: "System.Type", role: "output:value" }
        ]
      };
    }

    function getterPortFallback() {
      return {
        inputs: [
          { id: "target", label: "Target", type: "object", csType: "System.String", role: "input:target" }
        ],
        outputs: [
          { id: "value", label: "Value", type: "int", csType: "System.Int32", role: "output:value" }
        ]
      };
    }

    function setterPortFallback() {
      return {
        inputs: [
          { id: "call", label: "Call", type: "impulse", role: "input:call" },
          { id: "target", label: "Target", type: "object", csType: "System.Text.StringBuilder", role: "input:target" },
          { id: "value", label: "Value", type: "int", csType: "System.Int32", role: "input:value" }
        ],
        outputs: [
          { id: "done", label: "Done", type: "impulse", role: "output:done" },
          { id: "success", label: "Success", type: "bool", role: "output:success" },
          { id: "exception", label: "Exception", type: "exception", role: "output:exception" }
        ]
      };
    }

    function methodPortFallback() {
      return {
        inputs: [
          { id: "call", label: "Call", type: "impulse", role: "input:call" },
          { id: "target", label: "Target", type: "string", csType: "System.String", role: "input:target" },
          { id: "arg0", label: "value", type: "string", csType: "System.String", role: "parameter:0:input" }
        ],
        outputs: [
          { id: "done", label: "Done", type: "impulse", role: "output:done" },
          { id: "result", label: "Result", type: "bool", csType: "System.Boolean", role: "output:result" },
          { id: "success", label: "Success", type: "bool", role: "output:success" },
          { id: "exception", label: "Exception", type: "exception", role: "output:exception" }
        ]
      };
    }

    function materializeFallbackPorts(registry, rows) {
      return {
        inputs: rows.inputs.map(row => registry.port(
          row.id,
          row.label,
          row.type,
          {
            optional: row.optional === true,
            semanticRole: row.role,
            apiCsType: row.csType || "",
            csharpShellPort: true
          }
        )),
        outputs: rows.outputs.map(row => registry.port(
          row.id,
          row.label,
          row.type,
          {
            optional: row.optional === true,
            semanticRole: row.role,
            apiCsType: row.csType || "",
            csharpShellPort: true
          }
        ))
      };
    }

    function install(registry, contracts) {
      if (!registry || !contracts || installedRegistries.has(registry)) {
        return false;
      }

      const requiredRegistryFunctions = [
        "port", "genericPort", "registerType", "registerGroup", "registerNode",
        "getTypeDefinitions", "canonicalType", "canonicalCsType"
      ];
      const requiredContractFunctions = [
        "parseTypeRef", "normalizeTypeRef", "normalizeMemberRef",
        "serializeTypeRef", "serializeMemberRef", "serializePortContract",
        "typeRefSemanticKey",
        "escapeIdentifier", "emitTypeSyntax", "emitMemberNameSyntax",
        "parsePortableConstant", "emitConstantSyntax",
        "collectAssemblyReferences", "portablePortRole", "deriveShellPorts"
      ];
      if (
        requiredRegistryFunctions.some(name => typeof registry[name] !== "function") ||
        requiredContractFunctions.some(name => typeof contracts[name] !== "function")
      ) {
        throw new TypeError(
          "The C# language nodes require the complete graph registry and RMLCSharpContracts APIs."
        );
      }

      registry.registerGroup(GROUP);

      const typeFallbackRows = typePortFallback();
      const getterFallbackRows = getterPortFallback();
      const setterFallbackRows = setterPortFallback();
      const methodFallbackRows = methodPortFallback();
      const typeFallback = materializeFallbackPorts(registry, typeFallbackRows);
      const getterFallback = materializeFallbackPorts(registry, getterFallbackRows);
      const setterFallback = materializeFallbackPorts(registry, setterFallbackRows);
      const methodFallback = materializeFallbackPorts(registry, methodFallbackRows);

      registry.registerNode("csharp.typeOf", {
        title: uiText("csharp.node.title.typeof", "C# · typeof"),
        group: GROUP,
        symbol: "typeof",
        description: uiText(
          "csharp.node.description.typeof",
          "Emits a compile-time C# typeof expression from a structured TypeRef. No reflection or API catalog lookup is used."
        ),
        expertOnly: true,
        inputs: typeFallback.inputs,
        outputs: typeFallback.outputs,
        parameters: [
          structuredEditorParameter(
            "typeRef",
            uiText("csharp.editor.label.type", "C# type"),
            "csharpTypeRef",
            defaultTypeRef,
            {
              serializeDefault: value =>
                contracts.serializeTypeRef(value),
              createEditorModel: value =>
                createTypeEditorModel(value, contracts),
              serializeEditorModel: model =>
                serializeTypeEditorModel(model, contracts),
              presentation: node => describeTypeRef(
                storedParameter(
                  node,
                  "typeRef",
                  contracts.serializeTypeRef(defaultTypeRef)
                ),
                contracts
              ),
              validateEditorValue: value =>
                validateTypeEditorValue(value, registry, contracts),
              help: uiText(
                "csharp.editor.help.typeof",
                "Choose or enter a C# type. The typeof output and generic type ports update automatically."
              )
            }
          ),
          hiddenPortContractParameter(
            uiText("csharp.editor.label.port_contract", "Port contract"),
            { inputs: [], outputs: typeFallbackRows.outputs },
            contracts
          )
        ],
        resolveDefinition(node) {
          const resolved = resolveStoredTypeContract(node, contracts);
          if (!resolved.ok) return {};
          return deriveRuntimePorts(
            registry,
            contracts,
            resolved.typeRef,
            resolved.portContract,
            typeFallbackRows
          );
        },
        codegenCollect(api) {
          const resolved = resolveStoredTypeContract(api.node, contracts);
          if (!resolved.ok) {
            reportInvalid(api, "csharp.typeOf", resolved);
            return;
          }
          collectNodeReferences(api, contracts, resolved.typeRef);
        },
        codegenExpression(api) {
          const resolved = resolveStoredTypeContract(api.node, contracts);
          if (!resolved.ok) {
            reportInvalid(api, "csharp.typeOf", resolved);
            return "typeof(object)";
          }
          return emitTypeOfExpression(resolved.typeRef, contracts);
        }
      });

      registry.registerNode("csharp.member.get", {
        title: uiText("csharp.node.title.member_get", "C# · Member Get"),
        group: GROUP,
        symbol: ".get",
        description: uiText(
          "csharp.node.description.member_get",
          "Reads a C# field, property or indexer through a validated MemberRef and emits direct C# member access."
        ),
        expertOnly: true,
        inputs: getterFallback.inputs,
        outputs: getterFallback.outputs,
        parameters: [
          structuredEditorParameter("memberRef", uiText("csharp.editor.label.member", "C# member"), "csharpMemberRef", defaultGetterRef, {
            memberMode: "get",
            serializeDefault: value =>
              contracts.serializeMemberRef(value),
            createEditorModel: value =>
              createMemberEditorModel(value, contracts, "get"),
            serializeEditorModel: model =>
              serializeMemberEditorModel(model, contracts, "get"),
            presentation: node => describeMemberRef(
              storedParameter(
                node,
                "memberRef",
                contracts.serializeMemberRef(defaultGetterRef)
              ),
              contracts,
              "get"
            ),
            validateEditorValue: (value, node) =>
              validateMemberEditorValue(
                value,
                node,
                registry,
                contracts,
                "get"
            ),
            help: uiText(
              "csharp.editor.help.member_get",
              "Choose or enter the declaring type and readable member fields. The target and value ports update automatically."
            )
          }),
          hiddenPortContractParameter(
            uiText("csharp.editor.label.port_contract", "Port contract"),
            getterFallbackRows,
            contracts
          )
        ],
        resolveDefinition(node) {
          const resolved = resolveStoredMemberContract(node, contracts, "get");
          if (!resolved.ok) return {};
          return deriveRuntimePorts(
            registry,
            contracts,
            resolved.memberRef,
            resolved.portContract,
            getterFallbackRows
          );
        },
        codegenCollect(api) {
          const resolved = resolveStoredMemberContract(api.node, contracts, "get");
          if (!resolved.ok) {
            reportInvalid(api, "csharp.member.get", resolved);
            return;
          }
          collectNodeReferences(api, contracts, resolved.memberRef);
        },
        codegenExpression(api) {
          const resolved = resolveStoredMemberContract(api.node, contracts, "get");
          if (!resolved.ok) {
            reportInvalid(api, "csharp.member.get", resolved);
            return "default!";
          }
          return emitMemberGetExpression(
            api,
            contracts,
            resolved.memberRef,
            resolved.portContract
          );
        }
      });

      registry.registerNode("csharp.member.set", {
        title: uiText("csharp.node.title.member_set", "C# · Member Set"),
        group: GROUP,
        symbol: ".set",
        description: uiText(
          "csharp.node.description.member_set",
          "Writes a C# field, property or indexer through a validated MemberRef and emits direct C# assignment."
        ),
        expertOnly: true,
        inputs: setterFallback.inputs,
        outputs: setterFallback.outputs,
        parameters: [
          structuredEditorParameter("memberRef", uiText("csharp.editor.label.member", "C# member"), "csharpMemberRef", defaultSetterRef, {
            memberMode: "set",
            serializeDefault: value =>
              contracts.serializeMemberRef(value),
            createEditorModel: value =>
              createMemberEditorModel(value, contracts, "set"),
            serializeEditorModel: model =>
              serializeMemberEditorModel(model, contracts, "set"),
            presentation: node => describeMemberRef(
              storedParameter(
                node,
                "memberRef",
                contracts.serializeMemberRef(defaultSetterRef)
              ),
              contracts,
              "set"
            ),
            validateEditorValue: (value, node) =>
              validateMemberEditorValue(
                value,
                node,
                registry,
                contracts,
                "set"
            ),
            help: uiText(
              "csharp.editor.help.member_set",
              "Choose or enter the declaring type and readable member fields. Call, target and value ports update automatically."
            )
          }),
          hiddenPortContractParameter(
            uiText("csharp.editor.label.port_contract", "Port contract"),
            setterFallbackRows,
            contracts
          )
        ],
        resolveDefinition(node) {
          const resolved = resolveStoredMemberContract(node, contracts, "set");
          if (!resolved.ok) return {};
          return deriveRuntimePorts(
            registry,
            contracts,
            resolved.memberRef,
            resolved.portContract,
            setterFallbackRows
          );
        },
        codegenCollect(api) {
          const resolved = resolveStoredMemberContract(api.node, contracts, "set");
          if (!resolved.ok) {
            reportInvalid(api, "csharp.member.set", resolved);
            return;
          }
          collectActionFields(
            api,
            contracts,
            resolved.memberRef,
            resolved.portContract
          );
        },
        codegenAction(api) {
          const resolved = resolveStoredMemberContract(api.node, contracts, "set");
          if (!resolved.ok) {
            reportInvalid(api, "csharp.member.set", resolved);
            return "";
          }
          try {
            return buildMemberAction(
              api,
              contracts,
              resolved.memberRef,
              resolved.portContract
            );
          } catch (error) {
            api.diagnostic?.(
              `csharp.member.set cannot emit its validated direct assignment: ${error instanceof Error ? error.message : String(error)}`
            );
            return "";
          }
        },
        codegenExpression(api) {
          const resolved = resolveStoredMemberContract(api.node, contracts, "set");
          if (!resolved.ok) return "default!";
          return actionOutputExpression(
            api,
            contracts,
            resolved.memberRef,
            resolved.portContract
          );
        }
      });

      registry.registerNode("csharp.method.call", {
        title: uiText("csharp.node.title.method_call", "C# · Method Call"),
        group: GROUP,
        symbol: ".call",
        description: uiText(
          "csharp.node.description.method_call",
          "Calls a C# method through a validated MemberRef and emits a direct typed invocation, including generic, optional, ref and out arguments."
        ),
        expertOnly: true,
        inputs: methodFallback.inputs,
        outputs: methodFallback.outputs,
        parameters: [
          structuredEditorParameter("memberRef", uiText("csharp.editor.label.member", "C# member"), "csharpMemberRef", defaultMethodRef, {
            memberMode: "call",
            serializeDefault: value =>
              contracts.serializeMemberRef(value),
            createEditorModel: value =>
              createMemberEditorModel(value, contracts, "call"),
            serializeEditorModel: model =>
              serializeMemberEditorModel(model, contracts, "call"),
            presentation: node => describeMemberRef(
              storedParameter(
                node,
                "memberRef",
                contracts.serializeMemberRef(defaultMethodRef)
              ),
              contracts,
              "call"
            ),
            validateEditorValue: (value, node) =>
              validateMemberEditorValue(
                value,
                node,
                registry,
                contracts,
                "call"
            ),
            help: uiText(
              "csharp.editor.help.method_call",
              "Choose or enter the method, types and parameters. Call, result and ref/out ports update automatically."
            )
          }),
          hiddenPortContractParameter(
            uiText("csharp.editor.label.port_contract", "Port contract"),
            methodFallbackRows,
            contracts
          )
        ],
        resolveDefinition(node) {
          const resolved = resolveStoredMemberContract(node, contracts, "call");
          if (!resolved.ok) return {};
          return deriveRuntimePorts(
            registry,
            contracts,
            resolved.memberRef,
            resolved.portContract,
            methodFallbackRows
          );
        },
        codegenCollect(api) {
          const resolved = resolveStoredMemberContract(api.node, contracts, "call");
          if (!resolved.ok) {
            reportInvalid(api, "csharp.method.call", resolved);
            return;
          }
          collectActionFields(
            api,
            contracts,
            resolved.memberRef,
            resolved.portContract
          );
        },
        codegenAction(api) {
          const resolved = resolveStoredMemberContract(api.node, contracts, "call");
          if (!resolved.ok) {
            reportInvalid(api, "csharp.method.call", resolved);
            return "";
          }
          try {
            return buildMemberAction(
              api,
              contracts,
              resolved.memberRef,
              resolved.portContract
            );
          } catch (error) {
            api.diagnostic?.(
              `csharp.method.call cannot emit its validated direct invocation: ${error instanceof Error ? error.message : String(error)}`
            );
            return "";
          }
        },
        codegenExpression(api) {
          const resolved = resolveStoredMemberContract(api.node, contracts, "call");
          if (!resolved.ok) return "default!";
          return actionOutputExpression(
            api,
            contracts,
            resolved.memberRef,
            resolved.portContract
          );
        }
      });

      installedRegistries.add(registry);
      return true;
    }

    return {
      version: VERSION,
      group: GROUP,
      parseStoredJson,
      resolveStoredTypeContract,
      resolveStoredMemberContract,
      createTypeEditorModel,
      serializeTypeEditorModel,
      createMemberEditorModel,
      serializeMemberEditorModel,
      describeTypeRef,
      describeMemberRef,
      stableHash,
      collectReferences,
      ensureExactGraphType,
      deriveRuntimePorts,
      emitTypeOfExpression,
      emitMemberGetExpression,
      buildMemberAction,
      actionOutputExpression,
      install
    };
  }
);
