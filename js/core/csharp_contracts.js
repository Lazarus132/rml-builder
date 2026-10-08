(() => {
  "use strict";

  const MODULE_VERSION = 1;
  const CONTRACT_SCHEMA_VERSION = 1;
  const MAX_TYPE_TEXT_LENGTH = 4096;
  const MAX_TYPE_DEPTH = 32;
  const MAX_GENERIC_ARGUMENTS = 128;
  const MAX_PARAMETERS = 256;

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

  const csharpKeywords = new Set([
    "abstract", "as", "base", "bool", "break", "byte", "case", "catch",
    "char", "checked", "class", "const", "continue", "decimal", "default",
    "delegate", "do", "double", "else", "enum", "event", "explicit",
    "extern", "false", "finally", "fixed", "float", "for", "foreach",
    "goto", "if", "implicit", "in", "int", "interface", "internal", "is",
    "lock", "long", "namespace", "new", "null", "object", "operator",
    "out", "override", "params", "private", "protected", "public",
    "readonly", "ref", "return", "sbyte", "sealed", "short", "sizeof",
    "stackalloc", "static", "string", "struct", "switch", "this", "throw",
    "true", "try", "typeof", "uint", "ulong", "unchecked", "unsafe",
    "ushort", "using", "virtual", "void", "volatile", "while", "add",
    "alias", "and", "ascending", "async", "await", "by", "descending",
    "dynamic", "equals", "file", "from", "get", "global", "group", "init",
    "into", "join", "let", "managed", "nameof", "nint", "not", "notnull",
    "nuint", "on", "or", "orderby", "partial", "record", "remove",
    "required", "scoped", "select", "set", "unmanaged", "value", "var",
    "when", "where", "with", "yield"
  ]);

  function contractError(code, message) {
    const error = new TypeError(String(message || code || "Invalid C# contract."));
    error.code = String(code || "invalid-contract");
    return error;
  }

  function isPlainObject(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }
    const prototype = Object.getPrototypeOf(value);
    return prototype === Object.prototype || prototype === null;
  }

  function parseJsonObject(value, label) {
    if (isPlainObject(value)) return value;
    if (typeof value !== "string") {
      throw contractError(
        "invalid-json-object",
        String(label || "Value") + " must be an object or a JSON object string."
      );
    }
    const text = value.trim();
    if (!text || text.charAt(0) !== "{") {
      throw contractError(
        "invalid-json-object",
        String(label || "Value") + " is not a JSON object string."
      );
    }
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw contractError(
        "invalid-json-object",
        String(label || "Value") + " contains invalid JSON."
      );
    }
    if (!isPlainObject(parsed)) {
      throw contractError(
        "invalid-json-object",
        String(label || "Value") + " must contain a JSON object."
      );
    }
    return parsed;
  }

  function cloneJson(value) {
    if (Array.isArray(value)) return value.map(cloneJson);
    if (isPlainObject(value)) {
      const result = {};
      for (const key of Object.keys(value)) {
        result[key] = cloneJson(value[key]);
      }
      return result;
    }
    return value;
  }

  function freezeDeep(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    for (const key of Object.keys(value)) {
      freezeDeep(value[key]);
    }
    return Object.freeze(value);
  }

  function canonicalJsonValue(value, seen) {
    if (value === null || typeof value === "string" || typeof value === "boolean") {
      return value;
    }
    if (typeof value === "number") {
      if (!Number.isFinite(value)) {
        throw contractError("non-finite-number", "Canonical JSON cannot contain a non-finite number.");
      }
      return value;
    }
    if (Array.isArray(value)) {
      return value.map(item => canonicalJsonValue(item, seen));
    }
    if (!isPlainObject(value)) {
      throw contractError("non-json-value", "Canonical JSON only accepts plain JSON values.");
    }
    if (seen.has(value)) {
      throw contractError("cyclic-json", "Canonical JSON cannot contain a cycle.");
    }
    seen.add(value);
    const result = {};
    for (const key of Object.keys(value).sort()) {
      const item = value[key];
      if (typeof item === "undefined") continue;
      result[key] = canonicalJsonValue(item, seen);
    }
    seen.delete(value);
    return result;
  }

  function canonicalJson(value) {
    return JSON.stringify(canonicalJsonValue(value, new Set()));
  }

  function normalizeIdentifier(value, label) {
    const text = String(value || "").trim();
    const raw = text.charAt(0) === "@" ? text.slice(1) : text;
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(raw)) {
      throw contractError(
        "invalid-identifier",
        String(label || "C# identifier") + " is invalid."
      );
    }
    return raw;
  }

  function escapeIdentifier(value) {
    const identifier = normalizeIdentifier(value, "C# identifier");
    return csharpKeywords.has(identifier) ? "@" + identifier : identifier;
  }

  function normalizeAssemblyName(value) {
    const text = String(value || "").trim().replace(/\.dll$/i, "");
    if (!text) return "";
    if (!/^[A-Za-z0-9_.-]+$/.test(text)) {
      throw contractError("invalid-assembly-name", "Assembly name contains unsafe characters.");
    }
    return text;
  }

  function normalizePublicKeyToken(value) {
    const text = String(value || "").trim().toLowerCase();
    if (!text) return "";
    if (!/^[0-9a-f]{16}$/.test(text)) {
      throw contractError("invalid-public-key-token", "Public key token is invalid.");
    }
    return text;
  }

  function normalizeAssemblyReference(value) {
    if (!isPlainObject(value)) {
      throw contractError("invalid-assembly-reference", "Assembly reference must be an object.");
    }
    const include = normalizeAssemblyName(value.include || value.name || value.assemblyName);
    if (!include) {
      throw contractError("invalid-assembly-reference", "Assembly reference has no include name.");
    }
    const hintPath = String(value.hintPath || "").trim().replace(/\\/g, "/");
    if (hintPath) {
      if (
        hintPath.length > 1024 ||
        /[<>"';&|`\r\n]/.test(hintPath) ||
        !/^[A-Za-z0-9_.$(){}\[\]\/ +:@-]+$/.test(hintPath)
      ) {
        throw contractError("invalid-assembly-hint", "Assembly hint path contains unsafe characters.");
      }
      const properties = hintPath.match(/\$\([A-Za-z_][A-Za-z0-9_.-]*\)/g) || [];
      const withoutProperties = properties.reduce(
        (text, property) => text.replace(property, ""),
        hintPath
      );
      if (withoutProperties.includes("$(") || withoutProperties.includes("$")) {
        throw contractError("invalid-assembly-hint", "Assembly hint path has an invalid property reference.");
      }
      if (hintPath.split("/").some(segment => segment === "." || segment === "..")) {
        throw contractError("invalid-assembly-hint", "Assembly hint path contains traversal segments.");
      }
    }
    return freezeDeep({
      include,
      hintPath,
      private: value.private === true
    });
  }

  function normalizeAssemblyReferences(value) {
    const references = new Map();
    for (const item of Array.isArray(value) ? value : []) {
      const reference = normalizeAssemblyReference(item);
      const key = reference.include.toLowerCase() + "\u0000" + reference.hintPath;
      references.set(key, reference);
    }
    return freezeDeep(
      [...references.values()].sort((left, right) =>
        left.include.localeCompare(right.include) ||
        left.hintPath.localeCompare(right.hintPath)
      )
    );
  }

  function aliasSegments(alias) {
    return String(primitiveAliases[alias] || alias)
      .split(".")
      .map(name => ({ name, genericArguments: [] }));
  }

  class TypeExpressionParser {
    constructor(text, options) {
      this.text = String(text || "");
      this.index = 0;
      this.options = options || {};
      this.substitutions = this.options.substitutions instanceof Map
        ? this.options.substitutions
        : new Map();
      this.openGenericNames = this.options.openGenericNames instanceof Set
        ? this.options.openGenericNames
        : new Set();
    }

    skipWhitespace() {
      while (/\s/.test(this.text.charAt(this.index))) this.index += 1;
    }

    consume(value) {
      this.skipWhitespace();
      if (this.text.slice(this.index, this.index + value.length) !== value) {
        return false;
      }
      this.index += value.length;
      return true;
    }

    parseIdentifier() {
      this.skipWhitespace();
      const start = this.index;
      if (this.text.charAt(this.index) === "@") this.index += 1;
      if (!/[A-Za-z_]/.test(this.text.charAt(this.index))) {
        this.index = start;
        throw contractError("invalid-type-syntax", "Expected a C# type identifier.");
      }
      this.index += 1;
      while (/[A-Za-z0-9_]/.test(this.text.charAt(this.index))) {
        this.index += 1;
      }
      return normalizeIdentifier(this.text.slice(start, this.index), "C# type identifier");
    }

    parseGenericArguments(depth) {
      if (!this.consume("<")) return [];
      const result = [];
      for (;;) {
        if (result.length >= MAX_GENERIC_ARGUMENTS) {
          throw contractError("too-many-generic-arguments", "C# type has too many generic arguments.");
        }
        result.push(this.parseType(depth + 1));
        this.skipWhitespace();
        if (this.consume(">")) break;
        if (!this.consume(",")) {
          throw contractError("invalid-type-syntax", "Expected a comma or closing generic bracket.");
        }
      }
      return result;
    }

    parseType(depth) {
      if (depth > MAX_TYPE_DEPTH) {
        throw contractError("type-too-deep", "C# type nesting is too deep.");
      }
      this.skipWhitespace();
      this.consume("global::");
      const segments = [];
      for (;;) {
        const name = this.parseIdentifier();
        const genericArguments = this.parseGenericArguments(depth);
        segments.push({ name, genericArguments });
        this.skipWhitespace();
        if (!this.consume(".")) break;
      }

      let result;
      if (segments.length === 1 && segments[0].genericArguments.length === 0) {
        const name = segments[0].name;
        if (this.substitutions.has(name)) {
          result = cloneJson(this.substitutions.get(name));
        } else if (this.openGenericNames.has(name)) {
          throw contractError("unbound-generic-parameter", "Generic parameter '" + name + "' has no closed binding.");
        } else if (primitiveAliases[name]) {
          result = {
            schemaVersion: CONTRACT_SCHEMA_VERSION,
            kind: "named",
            segments: aliasSegments(name),
            assemblyName: "",
            publicKeyToken: ""
          };
        }
      }
      if (!result) {
        result = {
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          kind: "named",
          segments,
          assemblyName: "",
          publicKeyToken: ""
        };
      }

      for (;;) {
        this.skipWhitespace();
        if (this.consume("?")) {
          result = {
            schemaVersion: CONTRACT_SCHEMA_VERSION,
            kind: "nullable",
            elementType: result
          };
          continue;
        }
        if (this.consume("*")) {
          result = {
            schemaVersion: CONTRACT_SCHEMA_VERSION,
            kind: "pointer",
            elementType: result
          };
          continue;
        }
        if (this.consume("[")) {
          let rank = 1;
          this.skipWhitespace();
          while (this.consume(",")) rank += 1;
          if (!this.consume("]") || rank > 32) {
            throw contractError("invalid-array-rank", "C# array rank is invalid.");
          }
          result = {
            schemaVersion: CONTRACT_SCHEMA_VERSION,
            kind: "array",
            elementType: result,
            rank
          };
          continue;
        }
        break;
      }
      return result;
    }

    parse() {
      if (!this.text.trim() || this.text.length > MAX_TYPE_TEXT_LENGTH) {
        throw contractError("invalid-type-syntax", "C# type expression is empty or too long.");
      }
      if (/[;{}='"|&\r\n]/.test(this.text)) {
        throw contractError("unsafe-type-syntax", "C# type expression contains unsafe syntax.");
      }
      const result = this.parseType(0);
      this.skipWhitespace();
      if (this.index !== this.text.length) {
        throw contractError("invalid-type-syntax", "C# type expression has trailing syntax.");
      }
      return result;
    }
  }

  function normalizedSubstitutions(value) {
    if (!value) return new Map();
    if (value instanceof Map) return value;
    if (!isPlainObject(value)) {
      throw contractError("invalid-substitutions", "Type substitutions must be a map or object.");
    }
    const result = new Map();
    for (const [name, type] of Object.entries(value)) {
      result.set(normalizeIdentifier(name, "Generic parameter name"), normalizeTypeRef(type));
    }
    return result;
  }

  function parseTypeRef(value, options = {}) {
    if (typeof value !== "string") {
      throw contractError("invalid-type-syntax", "C# type expression must be text.");
    }
    const parser = new TypeExpressionParser(value, {
      substitutions: normalizedSubstitutions(options.substitutions),
      openGenericNames: options.openGenericNames instanceof Set
        ? options.openGenericNames
        : new Set(Array.isArray(options.openGenericNames) ? options.openGenericNames : [])
    });
    const parsed = parser.parse();
    const withMetadata = cloneJson(parsed);
    if (options.assemblyName) {
      withMetadata.assemblyName = normalizeAssemblyName(options.assemblyName);
    }
    if (options.publicKeyToken) {
      withMetadata.publicKeyToken = normalizePublicKeyToken(options.publicKeyToken);
    }
    if (options.assemblyReferences) {
      withMetadata.assemblyReferences = normalizeAssemblyReferences(options.assemblyReferences);
    }
    return normalizeTypeRef(withMetadata, options);
  }

  function normalizeNamedSegments(source, options) {
    let sourceSegments = null;
    if (Array.isArray(source.segments)) {
      sourceSegments = source.segments;
    } else if (Array.isArray(source.names)) {
      const namespaceSegments = String(source.namespace || "")
        .split(".")
        .filter(Boolean)
        .map(name => ({ name, genericArguments: [] }));
      sourceSegments = namespaceSegments.concat(source.names);
    }
    if (!sourceSegments || sourceSegments.length === 0) {
      if (typeof source.name === "string" && source.name.trim()) {
        const parsed = parseTypeRef(source.name, options);
        if (parsed.kind !== "named") {
          throw contractError("invalid-named-type", "Named type resolved to a non-named type.");
        }
        return parsed.segments;
      }
      throw contractError("invalid-named-type", "Named type has no name segments.");
    }
    return sourceSegments.map((segment, index) => {
      const row = typeof segment === "string" ? { name: segment } : segment;
      if (!isPlainObject(row)) {
        throw contractError("invalid-type-segment", "C# type name segment is invalid.");
      }
      const name = normalizeIdentifier(row.name, "C# type name segment");
      const genericArguments = (Array.isArray(row.genericArguments)
        ? row.genericArguments
        : []).map(argument => normalizeTypeRef(argument, options));
      if (genericArguments.length > MAX_GENERIC_ARGUMENTS) {
        throw contractError("too-many-generic-arguments", "C# type segment has too many generic arguments.");
      }
      if (
        typeof row.arity !== "undefined" &&
        Math.max(0, Number(row.arity) || 0) !== genericArguments.length
      ) {
        throw contractError("generic-arity-mismatch", "C# type segment generic arity does not match its arguments.");
      }
      if (index < sourceSegments.length - 1 && primitiveAliases[name]) {
        throw contractError("invalid-qualified-alias", "A C# primitive alias cannot be a qualified name segment.");
      }
      return { name, genericArguments };
    });
  }

  function normalizeTypeRef(value, options = {}) {
    if (typeof value === "string") {
      const text = value.trim();
      if (text.charAt(0) === "{") {
        return normalizeTypeRef(parseJsonObject(text, "TypeRef"), options);
      }
      return parseTypeRef(text, options);
    }
    if (!isPlainObject(value)) {
      throw contractError("invalid-type-ref", "TypeRef must be an object, JSON object string, or C# type expression.");
    }
    const kind = String(value.kind || "named").trim();
    let result;
    if (kind === "named") {
      let segments = normalizeNamedSegments(value, options);
      if (
        segments.length === 1 &&
        segments[0].genericArguments.length === 0 &&
        primitiveAliases[segments[0].name]
      ) {
        segments = aliasSegments(segments[0].name);
      }
      result = {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind: "named",
        segments,
        assemblyName: normalizeAssemblyName(value.assemblyName),
        publicKeyToken: normalizePublicKeyToken(value.publicKeyToken)
      };
    } else if (kind === "array") {
      const rank = Math.trunc(Number(value.rank) || 1);
      if (rank < 1 || rank > 32) {
        throw contractError("invalid-array-rank", "TypeRef array rank must be between 1 and 32.");
      }
      result = {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind: "array",
        elementType: normalizeTypeRef(value.elementType, options),
        rank
      };
    } else if (kind === "pointer" || kind === "nullable") {
      result = {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind,
        elementType: normalizeTypeRef(value.elementType, options)
      };
    } else if (kind === "genericParameter") {
      if (options.allowOpen !== true) {
        throw contractError("open-generic-type", "Open generic TypeRef is not allowed here.");
      }
      const scope = String(value.scope || "type");
      if (!["type", "method"].includes(scope)) {
        throw contractError("invalid-generic-scope", "Generic parameter scope is invalid.");
      }
      result = {
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind,
        name: normalizeIdentifier(value.name, "Generic parameter name"),
        scope,
        position: Math.max(0, Math.trunc(Number(value.position) || 0))
      };
    } else {
      throw contractError("unsupported-type-kind", "Unsupported TypeRef kind '" + kind + "'.");
    }
    if (value.assemblyReferences) {
      result.assemblyReferences = normalizeAssemblyReferences(value.assemblyReferences);
    }
    return freezeDeep(result);
  }

  function semanticTypeValue(value) {
    const type = normalizeTypeRef(value);
    if (type.kind === "named") {
      return {
        kind: "named",
        segments: type.segments.map(segment => ({
          name: segment.name,
          genericArguments: segment.genericArguments.map(semanticTypeValue)
        })),
        assemblyName: type.assemblyName,
        publicKeyToken: type.publicKeyToken
      };
    }
    if (type.kind === "array") {
      return { kind: "array", elementType: semanticTypeValue(type.elementType), rank: type.rank };
    }
    if (type.kind === "pointer" || type.kind === "nullable") {
      return { kind: type.kind, elementType: semanticTypeValue(type.elementType) };
    }
    return {
      kind: "genericParameter",
      name: type.name,
      scope: type.scope,
      position: type.position
    };
  }

  function typeRefSemanticKey(value) {
    return canonicalJson(semanticTypeValue(value));
  }

  function emitTypeSyntax(value, options = {}) {
    const type = normalizeTypeRef(value, { allowOpen: options.allowOpen === true });
    if (type.kind === "genericParameter") {
      return escapeIdentifier(type.name);
    }
    if (type.kind === "array") {
      return emitTypeSyntax(type.elementType, options) + "[" + ",".repeat(type.rank - 1) + "]";
    }
    if (type.kind === "pointer") {
      return emitTypeSyntax(type.elementType, options) + "*";
    }
    if (type.kind === "nullable") {
      return "global::System.Nullable<" + emitTypeSyntax(type.elementType, options) + ">";
    }
    const body = type.segments.map(segment => {
      const name = escapeIdentifier(segment.name);
      if (segment.genericArguments.length === 0) return name;
      return name + "<" + segment.genericArguments
        .map(argument => emitTypeSyntax(argument, options))
        .join(", ") + ">";
    }).join(".");
    return options.global === false ? body : "global::" + body;
  }

  function serializeTypeRef(value) {
    return canonicalJson(normalizeTypeRef(value));
  }

  function validQuotedLiteral(text, quote) {
    if (
      text.length < 2 ||
      text.charAt(0) !== quote ||
      text.charAt(text.length - 1) !== quote ||
      /[\r\n]/.test(text)
    ) {
      return false;
    }
    let index = 1;
    let scalarCount = 0;
    while (index < text.length - 1) {
      const character = text.charAt(index);
      if (character === quote) return false;
      if (character !== "\\") {
        scalarCount += 1;
        index += 1;
        continue;
      }
      index += 1;
      const escape = text.charAt(index);
      if (!escape) return false;
      if (/['"\\0abfnrtv]/.test(escape)) {
        scalarCount += 1;
        index += 1;
        continue;
      }
      if (escape === "u") {
        if (!/^[0-9A-Fa-f]{4}$/.test(text.slice(index + 1, index + 5))) return false;
        scalarCount += 1;
        index += 5;
        continue;
      }
      if (escape === "U") {
        if (!/^[0-9A-Fa-f]{8}$/.test(text.slice(index + 1, index + 9))) return false;
        scalarCount += 1;
        index += 9;
        continue;
      }
      if (escape === "x") {
        const match = /^[0-9A-Fa-f]{1,4}/.exec(text.slice(index + 1));
        if (!match) return false;
        scalarCount += 1;
        index += 1 + match[0].length;
        continue;
      }
      return false;
    }
    return quote !== "'" || scalarCount === 1;
  }

  function normalizeConstantPath(value) {
    const parts = Array.isArray(value)
      ? value
      : String(value || "").split(".");
    if (parts.length < 2 || parts.length > 128) {
      throw contractError("invalid-constant-path", "Named constant path is incomplete.");
    }
    const normalized = parts.map(part => normalizeIdentifier(part, "Named constant path segment"));
    if (primitiveAliases[normalized[0]]) {
      return String(primitiveAliases[normalized[0]]).split(".").concat(normalized.slice(1));
    }
    return normalized;
  }

  function parsePortableConstant(value) {
    if (isPlainObject(value)) {
      const kind = String(value.kind || "");
      if (kind === "null" || kind === "default") {
        return freezeDeep({ schemaVersion: CONTRACT_SCHEMA_VERSION, kind });
      }
      if (kind === "boolean") {
        if (typeof value.value !== "boolean") {
          throw contractError("invalid-constant", "Boolean constant has no Boolean value.");
        }
        return freezeDeep({
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          kind,
          value: value.value
        });
      }
      if (kind === "numeric" || kind === "string" || kind === "char") {
        return parsePortableConstant(value.token);
      }
      if (kind === "defaultOf") {
        return freezeDeep({
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          kind,
          typeRef: normalizeTypeRef(value.typeRef)
        });
      }
      if (kind === "named") {
        return freezeDeep({
          schemaVersion: CONTRACT_SCHEMA_VERSION,
          kind,
          path: normalizeConstantPath(value.path)
        });
      }
      throw contractError("invalid-constant", "Unsupported structured constant kind.");
    }

    const text = String(value || "").trim();
    if (!text || text.length > MAX_TYPE_TEXT_LENGTH) {
      throw contractError("invalid-constant", "Portable default value is empty or too long.");
    }
    if (text === "null" || text === "default") {
      return freezeDeep({ schemaVersion: CONTRACT_SCHEMA_VERSION, kind: text });
    }
    if (text === "true" || text === "false") {
      return freezeDeep({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind: "boolean",
        value: text === "true"
      });
    }

    const decimalNumeric =
      /^[+-]?(?:(?:0|[1-9][0-9]*)(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?(?:[fFdDmM])?$/.test(text);
    const integerNumeric =
      /^[+-]?(?:0|[1-9][0-9]*)(?:(?:[uU](?:[lL])?)|(?:[lL](?:[uU])?))?$/.test(text);
    const hexNumeric =
      /^0[xX][0-9A-Fa-f]+(?:(?:[uU](?:[lL])?)|(?:[lL](?:[uU])?))?$/.test(text);
    if (decimalNumeric || integerNumeric || hexNumeric) {
      return freezeDeep({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind: "numeric",
        token: text
      });
    }
    if (text.charAt(0) === "\"" && validQuotedLiteral(text, "\"")) {
      return freezeDeep({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind: "string",
        token: text
      });
    }
    if (text.charAt(0) === "'" && validQuotedLiteral(text, "'")) {
      return freezeDeep({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind: "char",
        token: text
      });
    }
    const defaultMatch = /^default\s*\((.*)\)$/.exec(text);
    if (defaultMatch) {
      return freezeDeep({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind: "defaultOf",
        typeRef: parseTypeRef(defaultMatch[1])
      });
    }
    if (/^(?:@?[A-Za-z_][A-Za-z0-9_]*\.)+@?[A-Za-z_][A-Za-z0-9_]*$/.test(text)) {
      return freezeDeep({
        schemaVersion: CONTRACT_SCHEMA_VERSION,
        kind: "named",
        path: normalizeConstantPath(text)
      });
    }
    throw contractError("unsafe-default-value", "Portable default value is not a supported safe C# constant.");
  }

  function emitConstantSyntax(value) {
    const constant = parsePortableConstant(value);
    if (constant.kind === "null" || constant.kind === "default") return constant.kind;
    if (constant.kind === "boolean") return constant.value ? "true" : "false";
    if (
      constant.kind === "numeric" ||
      constant.kind === "string" ||
      constant.kind === "char"
    ) {
      return constant.token;
    }
    if (constant.kind === "defaultOf") {
      return "default(" + emitTypeSyntax(constant.typeRef) + ")";
    }
    if (constant.kind === "named") {
      return "global::" + constant.path.map(escapeIdentifier).join(".");
    }
    throw contractError("invalid-constant", "Unsupported safe C# constant.");
  }

  function genericRows(contract, key) {
    const source = Array.isArray(contract?.[key]) ? contract[key] : [];
    if (source.length > MAX_GENERIC_ARGUMENTS) {
      throw contractError("too-many-generic-parameters", "Portable contract has too many generic parameters.");
    }
    const names = new Set();
    return source.map((row, index) => {
      if (!isPlainObject(row)) {
        throw contractError("invalid-generic-parameter", "Portable generic parameter row is invalid.");
      }
      const position = Math.max(0, Math.trunc(Number(row.position) || 0));
      if (position !== index) {
        throw contractError(
          "non-contiguous-generic-parameters",
          "Portable generic parameter positions are not contiguous."
        );
      }
      const name = normalizeIdentifier(row.name, "Portable generic parameter name");
      if (names.has(name)) {
        throw contractError("duplicate-generic-parameter", "Portable generic parameter name is duplicated.");
      }
      names.add(name);
      return { name, position };
    });
  }

  function portableBindingText(contract, nodeParameters, prefix, position) {
    const contractBindings = isPlainObject(contract?.genericBindings)
      ? contract.genericBindings
      : {};
    const parameterBindings = isPlainObject(nodeParameters) ? nodeParameters : {};
    const directKey = prefix + position;
    const parameterKey =
      "api" + prefix.charAt(0).toUpperCase() + prefix.slice(1) + position;
    return String(
      contractBindings[directKey] ||
      parameterBindings[parameterKey] ||
      ""
    ).trim();
  }

  function genericBindingsFromPortableContract(contractValue, options = {}) {
    const contract = parseJsonObject(contractValue, "Portable API contract");
    const ownerRows = genericRows(contract, "ownerGenericParameters");
    const methodRows = genericRows(contract, "methodGenericParameters");

    const bindRows = (rows, prefix) => rows.map(row => {
      const text = portableBindingText(
        contract,
        options.nodeParameters,
        prefix,
        row.position
      );
      if (!text) {
        throw contractError(
          "missing-generic-binding",
          "Portable generic parameter '" + row.name + "' has no closed binding."
        );
      }
      return freezeDeep({
        scope: prefix === "ownerGeneric" ? "type" : "method",
        name: row.name,
        position: row.position,
        portId: prefix + row.position,
        typeRef: parseTypeRef(text)
      });
    });

    return freezeDeep({
      owner: bindRows(ownerRows, "ownerGeneric"),
      method: bindRows(methodRows, "generic")
    });
  }

  function substitutionMap(records) {
    return new Map(records.map(record => [record.name, record.typeRef]));
  }

  function combinedSubstitutionMap(ownerRecords, methodRecords) {
    const result = substitutionMap(ownerRecords);
    for (const record of methodRecords) result.set(record.name, record.typeRef);
    return result;
  }

  function portableAssemblyReferences(contract) {
    const primary = Array.isArray(contract?.requiredAssemblyReferences)
      ? contract.requiredAssemblyReferences
      : contract?.baseAssemblyReferences;
    return normalizeAssemblyReferences(primary);
  }

  function withAssemblyReferences(typeRef, references) {
    const result = cloneJson(normalizeTypeRef(typeRef));
    if (references.length > 0) result.assemblyReferences = references;
    return normalizeTypeRef(result);
  }

  function typeRefFromPortableContract(contractValue, options = {}) {
    const contract = parseJsonObject(contractValue, "Portable API contract");
    if (String(contract.kind || "") !== "type") {
      throw contractError("portable-kind-mismatch", "Portable API contract is not a type contract.");
    }
    const bindings = genericBindingsFromPortableContract(contract, options);
    const allRecords = bindings.owner.concat(bindings.method);
    const openNames = new Set(allRecords.map(record => record.name));
    const ownerType = String(contract.ownerType || "").trim();
    if (!ownerType) {
      throw contractError("missing-owner-type", "Portable type contract has no owner type.");
    }
    const typeRef = parseTypeRef(ownerType, {
      substitutions: combinedSubstitutionMap(bindings.owner, bindings.method),
      openGenericNames: openNames
    });
    return withAssemblyReferences(typeRef, portableAssemblyReferences(contract));
  }

  function normalizeParameterRef(value, index) {
    if (!isPlainObject(value)) {
      throw contractError("invalid-member-parameter", "Member parameter must be an object.");
    }
    const position = Math.max(0, Math.trunc(Number(value.position) || 0));
    if (position !== index) {
      throw contractError(
        "non-contiguous-member-parameters",
        "Member parameter positions are not contiguous."
      );
    }
    const refKind = String(value.refKind || "none");
    if (!["none", "in", "ref", "out"].includes(refKind)) {
      throw contractError("invalid-ref-kind", "Member parameter ref kind is invalid.");
    }
    const optional = value.optional === true;
    const hasDefaultValue = value.hasDefaultValue === true;
    if (optional !== hasDefaultValue) {
      throw contractError(
        "invalid-optional-parameter",
        "Optional parameters require an explicit safe default value."
      );
    }
    const result = {
      position,
      name: normalizeIdentifier(value.name || "argument" + index, "Member parameter name"),
      typeRef: normalizeTypeRef(value.typeRef || value.type),
      refKind,
      optional,
      hasDefaultValue
    };
    if (hasDefaultValue) {
      result.defaultValue = parsePortableConstant(value.defaultValue);
    }
    return freezeDeep(result);
  }

  function normalizeMemberRef(value) {
    const source = typeof value === "string"
      ? parseJsonObject(value, "MemberRef")
      : value;
    if (!isPlainObject(source)) {
      throw contractError("invalid-member-ref", "MemberRef must be an object or JSON object string.");
    }
    const kind = String(source.kind || "");
    const access = String(source.access || "");
    const allowed = {
      method: new Set(["call"]),
      property: new Set(["get", "set"]),
      field: new Set(["get", "set"])
    };
    if (!allowed[kind] || !allowed[kind].has(access)) {
      throw contractError("invalid-member-kind", "MemberRef kind and access are inconsistent.");
    }
    const parameters = (Array.isArray(source.parameters) ? source.parameters : [])
      .map(normalizeParameterRef);
    if (parameters.length > MAX_PARAMETERS) {
      throw contractError("too-many-member-parameters", "MemberRef has too many parameters.");
    }
    const returnType = normalizeTypeRef(source.returnType || "System.Void");
    const result = {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      kind,
      access,
      declaringType: normalizeTypeRef(source.declaringType),
      name: normalizeIdentifier(source.name, "Member name"),
      isStatic: source.isStatic === true,
      parameters,
      returnType,
      ownerGenericArguments: (Array.isArray(source.ownerGenericArguments)
        ? source.ownerGenericArguments
        : []).map(argument => normalizeTypeRef(argument)),
      genericArguments: (Array.isArray(source.genericArguments)
        ? source.genericArguments
        : []).map(argument => normalizeTypeRef(argument)),
      assemblyReferences: normalizeAssemblyReferences(source.assemblyReferences)
    };
    const stableContractId = String(source.stableContractId || "").trim();
    if (stableContractId) result.stableContractId = stableContractId;
    if (access === "set") {
      result.valueType = normalizeTypeRef(source.valueType);
    } else if (source.valueType) {
      throw contractError("unexpected-value-type", "Getter and method MemberRef cannot have a setter value type.");
    }
    if (kind !== "method" && result.genericArguments.length > 0) {
      throw contractError("unexpected-method-generics", "Only methods can have method generic arguments.");
    }
    if (kind === "field" && parameters.length > 0) {
      throw contractError("field-parameters", "Field MemberRef cannot have index parameters.");
    }
    const voidKey = typeRefSemanticKey("System.Void");
    if (access === "set" && typeRefSemanticKey(returnType) !== voidKey) {
      throw contractError("setter-return-type", "Setter MemberRef must return System.Void.");
    }
    if (access === "get" && typeRefSemanticKey(returnType) === voidKey) {
      throw contractError("getter-return-type", "Getter MemberRef cannot return System.Void.");
    }
    if (access === "set" && typeRefSemanticKey(result.valueType) === voidKey) {
      throw contractError("setter-value-type", "Setter MemberRef value cannot be System.Void.");
    }
    return freezeDeep(result);
  }

  function portableParameterRef(parameter, index, substitutions, openNames) {
    if (!isPlainObject(parameter)) {
      throw contractError("invalid-portable-parameter", "Portable member parameter is invalid.");
    }
    const position = Math.max(0, Math.trunc(Number(parameter.position) || 0));
    if (position !== index) {
      throw contractError(
        "non-contiguous-member-parameters",
        "Portable member parameter positions are not contiguous."
      );
    }
    const isOut = parameter.isOut === true;
    const isByRef = parameter.isByRef === true || isOut;
    const isIn = parameter.isIn === true;
    const optional = parameter.isOptional === true;
    const hasDefaultValue = parameter.hasDefaultValue === true;
    if (optional && !hasDefaultValue) {
      throw contractError(
        "missing-optional-default",
        "Portable optional parameter has no explicit default value."
      );
    }
    const result = {
      position,
      name: normalizeIdentifier(parameter.name || "argument" + index, "Portable parameter name"),
      typeRef: parseTypeRef(parameter.elementType || parameter.type || "", {
        substitutions,
        openGenericNames: openNames
      }),
      refKind: isOut ? "out" : isByRef ? (isIn ? "in" : "ref") : (isIn ? "in" : "none"),
      optional,
      hasDefaultValue
    };
    if (hasDefaultValue) {
      result.defaultValue = parsePortableConstant(parameter.defaultValueCSharp);
    }
    return result;
  }

  function memberRefFromPortableContract(contractValue, options = {}) {
    const contract = parseJsonObject(contractValue, "Portable API contract");
    const portableKind = String(contract.kind || "");
    const mapping = Object.assign(Object.create(null), {
      method: ["method", "call"],
      "property-get": ["property", "get"],
      "property-set": ["property", "set"],
      "field-get": ["field", "get"],
      "field-set": ["field", "set"]
    });
    if (!Object.prototype.hasOwnProperty.call(mapping, portableKind)) {
      throw contractError(
        "non-migratable-portable-kind",
        "Portable hooks, events, constructors, enums and unknown members are not C# shell members."
      );
    }
    if (options.requireDirect !== false && contract.directExecutable !== true) {
      throw contractError(
        "not-direct-executable",
        "Portable member contract is not proven directly executable."
      );
    }

    const bindings = genericBindingsFromPortableContract(contract, options);
    const ownerSubstitutions = substitutionMap(bindings.owner);
    const substitutions = combinedSubstitutionMap(bindings.owner, bindings.method);
    const ownerOpenNames = new Set(bindings.owner.map(record => record.name));
    const allOpenNames = new Set(
      bindings.owner.concat(bindings.method).map(record => record.name)
    );
    const ownerType = String(contract.ownerType || "").trim();
    if (!ownerType) {
      throw contractError("missing-owner-type", "Portable member contract has no owner type.");
    }
    const declaringType = parseTypeRef(ownerType, {
      substitutions: ownerSubstitutions,
      openGenericNames: ownerOpenNames
    });
    const sourceParameters = Array.isArray(contract.parameters)
      ? contract.parameters
      : [];
    if (sourceParameters.length > MAX_PARAMETERS) {
      throw contractError("too-many-member-parameters", "Portable member has too many parameters.");
    }
    let parameters = sourceParameters.map((parameter, index) =>
      portableParameterRef(parameter, index, substitutions, allOpenNames)
    );
    const [kind, access] = mapping[portableKind];
    const returnType = parseTypeRef(contract.returnType || "System.Void", {
      substitutions,
      openGenericNames: allOpenNames
    });
    const result = {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      kind,
      access,
      declaringType,
      name: normalizeIdentifier(contract.memberName, "Portable member name"),
      isStatic: contract.isStatic === true,
      parameters,
      returnType,
      ownerGenericArguments: bindings.owner.map(record => record.typeRef),
      genericArguments: bindings.method.map(record => record.typeRef),
      stableContractId: String(contract.stableContractId || "").trim(),
      assemblyReferences: portableAssemblyReferences(contract)
    };

    if (portableKind === "property-set" || portableKind === "field-set") {
      if (parameters.length === 0) {
        throw contractError("missing-setter-value", "Portable setter has no value parameter.");
      }
      const valueParameter = parameters[parameters.length - 1];
      if (
        valueParameter.refKind !== "none" ||
        valueParameter.optional ||
        (portableKind === "field-set" && parameters.length !== 1)
      ) {
        throw contractError("invalid-setter-value", "Portable setter value parameter is invalid.");
      }
      result.valueType = valueParameter.typeRef;
      parameters = parameters.slice(0, -1).map((parameter, index) => ({
        ...parameter,
        position: index
      }));
      result.parameters = parameters;
    }
    if (
      portableKind !== "method" &&
      Math.max(0, Number(contract.genericArity) || 0) !== 0
    ) {
      throw contractError("unexpected-generic-arity", "Non-method portable member has method generic arity.");
    }
    if (
      portableKind === "method" &&
      Math.max(0, Number(contract.genericArity) || 0) !== bindings.method.length
    ) {
      throw contractError("generic-arity-mismatch", "Portable method generic arity does not match bindings.");
    }
    return normalizeMemberRef(result);
  }

  function semanticMemberValue(value) {
    const member = normalizeMemberRef(value);
    return {
      kind: member.kind,
      access: member.access,
      declaringType: semanticTypeValue(member.declaringType),
      name: member.name,
      isStatic: member.isStatic,
      parameters: member.parameters.map(parameter => ({
        position: parameter.position,
        typeRef: semanticTypeValue(parameter.typeRef),
        refKind: parameter.refKind,
        optional: parameter.optional,
        hasDefaultValue: parameter.hasDefaultValue,
        defaultValue: parameter.hasDefaultValue ? parameter.defaultValue : null
      })),
      returnType: semanticTypeValue(member.returnType),
      valueType: member.valueType ? semanticTypeValue(member.valueType) : null,
      ownerGenericArguments: member.ownerGenericArguments.map(semanticTypeValue),
      genericArguments: member.genericArguments.map(semanticTypeValue)
    };
  }

  function memberRefSemanticKey(value) {
    return canonicalJson(semanticMemberValue(value));
  }

  function emitMemberNameSyntax(value) {
    const member = normalizeMemberRef(value);
    const genericSuffix = member.genericArguments.length > 0
      ? "<" + member.genericArguments.map(emitTypeSyntax).join(", ") + ">"
      : "";
    return escapeIdentifier(member.name) + genericSuffix;
  }

  function serializeMemberRef(value) {
    return canonicalJson(normalizeMemberRef(value));
  }

  function portablePortRole(kind, direction, port, parameters = []) {
    const explicit = String(port?.role || port?.roleKey || "").trim();
    if (explicit) return explicit;
    const id = String(port?.id || "").trim();
    const fixed = new Set([
      "call", "done", "success", "exception", "target", "result", "value"
    ]);
    if (fixed.has(id)) return direction + ":" + id;
    let match = /^arg(\d+)$/.exec(id);
    if (match) return "parameter:" + Number(match[1]) + ":input";
    match = /^out(\d+)$/.exec(id);
    if (match) return "parameter:" + Number(match[1]) + ":output";
    match = /^generic(\d+)$/.exec(id);
    if (match) return "generic:" + Number(match[1]) + ":input";
    match = /^ownerGeneric(\d+)$/.exec(id);
    if (match) return "owner-generic:" + Number(match[1]) + ":input";
    const parameter = parameters.find(value =>
      String(value?.name || "") === id
    );
    if (parameter) {
      return "parameter:" +
        Math.max(0, Math.trunc(Number(parameter.position) || 0)) +
        ":" + direction;
    }
    return String(kind || "api") + ":" + direction + ":" + id;
  }

  function expectedPortRoles(reference, portableContract, options = {}) {
    const kind = String(portableContract?.kind || "");
    const inputs = [];
    const outputs = [];
    const bindings = genericBindingsFromPortableContract(portableContract, options);
    const addBindingRoles = () => {
      for (const binding of bindings.owner) {
        inputs.push("owner-generic:" + binding.position + ":input");
      }
      for (const binding of bindings.method) {
        inputs.push("generic:" + binding.position + ":input");
      }
    };

    if (kind === "type") {
      addBindingRoles();
      outputs.push("output:value");
      return { inputs, outputs, bindings };
    }

    const member = normalizeMemberRef(reference);
    if (member.access === "set" || member.kind === "method") {
      inputs.push("input:call");
    }
    addBindingRoles();
    if (!member.isStatic) inputs.push("input:target");
    for (const parameter of member.parameters) {
      if (parameter.refKind !== "out") {
        inputs.push("parameter:" + parameter.position + ":input");
      }
    }
    if (member.access === "set") inputs.push("input:value");

    if (member.access === "get") {
      outputs.push("output:value");
    } else {
      outputs.push("output:done");
      if (
        member.kind === "method" &&
        typeRefSemanticKey(member.returnType) !== typeRefSemanticKey("System.Void")
      ) {
        outputs.push("output:result");
      }
      for (const parameter of member.parameters) {
        if (parameter.refKind === "out" || parameter.refKind === "ref") {
          outputs.push("parameter:" + parameter.position + ":output");
        }
      }
      outputs.push("output:success", "output:exception");
    }
    return { inputs, outputs, bindings };
  }

  function canonicalPortId(role) {
    const fixed = {
      "input:call": "call",
      "input:target": "target",
      "input:value": "value",
      "output:done": "done",
      "output:value": "value",
      "output:result": "result",
      "output:success": "success",
      "output:exception": "exception"
    };
    if (fixed[role]) return fixed[role];
    let match = /^parameter:(\d+):input$/.exec(role);
    if (match) return "arg" + Number(match[1]);
    match = /^parameter:(\d+):output$/.exec(role);
    if (match) return "out" + Number(match[1]);
    match = /^generic:(\d+):input$/.exec(role);
    if (match) return "generic" + Number(match[1]);
    match = /^owner-generic:(\d+):input$/.exec(role);
    if (match) return "ownerGeneric" + Number(match[1]);
    return "";
  }

  function expectedTypeForRole(reference, role, bindings) {
    const bindingMatch = /^(owner-generic|generic):(\d+):input$/.exec(role);
    if (bindingMatch) {
      const collection = bindingMatch[1] === "owner-generic"
        ? bindings.owner
        : bindings.method;
      return collection[Number(bindingMatch[2])]?.typeRef || null;
    }
    if (!reference) {
      return role === "output:value" ? normalizeTypeRef("System.Type") : null;
    }
    const member = normalizeMemberRef(reference);
    if (role === "input:target") return member.declaringType;
    if (role === "input:value") return member.valueType || null;
    if (role === "output:value" || role === "output:result") return member.returnType;
    const parameterMatch = /^parameter:(\d+):(input|output)$/.exec(role);
    if (parameterMatch) {
      return member.parameters[Number(parameterMatch[1])]?.typeRef || null;
    }
    return null;
  }

  function normalizePortRow(row, direction, kind, parameters, expected, reference) {
    if (!isPlainObject(row)) {
      throw contractError("invalid-port-contract", "Portable port row is invalid.");
    }
    const id = String(row.id || "").trim();
    if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(id)) {
      throw contractError("invalid-port-id", "Portable port id is invalid.");
    }
    const role = portablePortRole(kind, direction, row, parameters);
    if (!expected.has(role)) {
      throw contractError(
        "unexpected-port-role",
        "Portable port role '" + role + "' is not part of the C# shell contract."
      );
    }
    const expectedId = canonicalPortId(role);
    if (!expectedId || id !== expectedId) {
      throw contractError(
        "non-canonical-port-id",
        "Portable port id '" + id + "' cannot be preserved by the C# shell."
      );
    }
    const graphType = String(row.type || row.graphType || "").trim();
    if (!graphType || !/^[A-Za-z0-9_.:-]+$/.test(graphType)) {
      throw contractError("invalid-graph-port-type", "Portable graph port type is invalid.");
    }
    const result = {
      id,
      role,
      graphType,
      optional: row.optional === true
    };
    const label = String(row.label || row.name || "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .trim()
      .slice(0, 160);
    if (label) result.label = label;
    const expectedType = expectedTypeForRole(reference, role, expected.bindings);
    const csTypeText = String(row.csType || "").trim();
    if (csTypeText) {
      const portTypeRef = parseTypeRef(csTypeText);
      if (
        expectedType &&
        typeRefSemanticKey(portTypeRef) !== typeRefSemanticKey(expectedType)
      ) {
        throw contractError(
          "port-csharp-type-mismatch",
          "Portable port C# type does not match its member role."
        );
      }
      result.typeRef = portTypeRef;
    } else if (expectedType && /^(?:owner-)?generic:/.test(role)) {
      result.bindingTypeRef = expectedType;
    }
    return freezeDeep(result);
  }

  function normalizePortContract(value, options = {}) {
    const source = typeof value === "string"
      ? parseJsonObject(value, "Port contract")
      : value;
    if (!isPlainObject(source)) {
      throw contractError("invalid-port-contract", "Port contract must be an object or JSON object string.");
    }
    const inputsSource = Array.isArray(source.inputs)
      ? source.inputs
      : Array.isArray(source.inputPorts)
        ? source.inputPorts
        : [];
    const outputsSource = Array.isArray(source.outputs)
      ? source.outputs
      : Array.isArray(source.outputPorts)
        ? source.outputPorts
        : [];
    const normalizeStoredRow = (row, direction) => {
      if (!isPlainObject(row)) {
        throw contractError("invalid-port-contract", "Stored port row is invalid.");
      }
      const id = String(row.id || "").trim();
      const role = String(row.role || "").trim();
      const graphType = String(row.graphType || row.type || "").trim();
      if (
        !/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(id) ||
        !canonicalPortId(role) ||
        canonicalPortId(role) !== id ||
        !/^[A-Za-z0-9_.:-]+$/.test(graphType)
      ) {
        throw contractError("invalid-port-contract", "Stored port row is not canonical.");
      }
      const result = {
        id,
        role,
        graphType,
        optional: row.optional === true
      };
      const label = String(row.label || row.name || "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .trim()
        .slice(0, 160);
      if (label) result.label = label;
      if (row.typeRef) result.typeRef = normalizeTypeRef(row.typeRef);
      if (row.bindingTypeRef) result.bindingTypeRef = normalizeTypeRef(row.bindingTypeRef);
      if (!role.endsWith(":" + direction) && !role.startsWith(direction + ":")) {
        throw contractError("invalid-port-direction", "Stored port role has the wrong direction.");
      }
      return result;
    };
    const inputs = inputsSource.map(row => normalizeStoredRow(row, "input"));
    const outputs = outputsSource.map(row => normalizeStoredRow(row, "output"));
    const assertUnique = (rows, direction) => {
      const ids = new Set();
      const roles = new Set();
      for (const row of rows) {
        if (ids.has(row.id) || roles.has(row.role)) {
          throw contractError(
            "duplicate-port-contract",
            "Stored " + direction + " port ids or roles are duplicated."
          );
        }
        ids.add(row.id);
        roles.add(row.role);
      }
    };
    assertUnique(inputs, "input");
    assertUnique(outputs, "output");
    const result = {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      inputs,
      outputs
    };
    if (options.reference && options.portableContract) {
      const expected = expectedPortRoles(
        options.reference,
        options.portableContract,
        options
      );
      const sameRoles = (rows, roles) =>
        rows.length === roles.length &&
        roles.every(role => rows.some(row => row.role === role));
      if (!sameRoles(inputs, expected.inputs) || !sameRoles(outputs, expected.outputs)) {
        throw contractError(
          "port-contract-role-mismatch",
          "Stored port contract does not exactly match the C# shell reference."
        );
      }
    }
    return freezeDeep(result);
  }

  function portContractFromPortableContract(contractValue, referenceValue, options = {}) {
    const contract = parseJsonObject(contractValue, "Portable API contract");
    const kind = String(contract.kind || "");
    let reference = referenceValue || null;
    if (!reference) {
      reference = kind === "type"
        ? typeRefFromPortableContract(contract, options)
        : memberRefFromPortableContract(contract, options);
    } else {
      reference = kind === "type"
        ? normalizeTypeRef(reference)
        : normalizeMemberRef(reference);
    }
    const expected = expectedPortRoles(reference, contract, options);
    const expectedInputs = new Set(expected.inputs);
    const expectedOutputs = new Set(expected.outputs);
    expectedInputs.bindings = expected.bindings;
    expectedOutputs.bindings = expected.bindings;
    const parameters = Array.isArray(contract.parameters) ? contract.parameters : [];
    const normalizeRows = (rows, direction, expectedSet) => {
      const result = (Array.isArray(rows) ? rows : []).map(row =>
        normalizePortRow(
          row,
          direction,
          kind,
          parameters,
          expectedSet,
          kind === "type" ? null : reference
        )
      );
      const ids = new Set();
      const roles = new Set();
      for (const row of result) {
        if (ids.has(row.id) || roles.has(row.role)) {
          throw contractError(
            "duplicate-port-contract",
            "Portable " + direction + " port ids or roles are duplicated."
          );
        }
        ids.add(row.id);
        roles.add(row.role);
      }
      if (
        result.length !== expectedSet.size ||
        [...expectedSet].some(role => !roles.has(role))
      ) {
        throw contractError(
          "lossy-port-contract",
          "Portable port contract cannot be represented losslessly by the C# shell."
        );
      }
      return result;
    };
    const result = {
      schemaVersion: CONTRACT_SCHEMA_VERSION,
      inputs: normalizeRows(contract.inputPorts, "input", expectedInputs),
      outputs: normalizeRows(contract.outputPorts, "output", expectedOutputs)
    };
    return normalizePortContract(result, {
      ...options,
      reference,
      portableContract: contract
    });
  }

  function serializePortContract(value) {
    return canonicalJson(normalizePortContract(value));
  }

  function deriveShellPorts(reference, portContractValue) {
    const portContract = normalizePortContract(portContractValue);
    if (reference) {
      const isMember =
        (typeof reference === "string" && reference.trim().includes("\"declaringType\"")) ||
        (isPlainObject(reference) && Object.prototype.hasOwnProperty.call(reference, "declaringType"));
      if (isMember) normalizeMemberRef(reference);
      else normalizeTypeRef(reference);
    }
    return freezeDeep({
      inputs: portContract.inputs.map(cloneJson),
      outputs: portContract.outputs.map(cloneJson)
    });
  }

  function collectAssemblyReferences(value) {
    const references = new Map();
    const add = reference => {
      const normalized = normalizeAssemblyReference(reference);
      const key = normalized.include.toLowerCase() + "\u0000" + normalized.hintPath;
      references.set(key, normalized);
    };
    const visitType = typeValue => {
      const type = normalizeTypeRef(typeValue, { allowOpen: true });
      for (const reference of type.assemblyReferences || []) add(reference);
      if (type.kind === "named") {
        for (const segment of type.segments) {
          for (const argument of segment.genericArguments) visitType(argument);
        }
      } else if (type.elementType) {
        visitType(type.elementType);
      }
    };
    const isMember =
      (typeof value === "string" && value.trim().includes("\"declaringType\"")) ||
      (isPlainObject(value) && Object.prototype.hasOwnProperty.call(value, "declaringType"));
    if (isMember) {
      const member = normalizeMemberRef(value);
      for (const reference of member.assemblyReferences) add(reference);
      visitType(member.declaringType);
      visitType(member.returnType);
      if (member.valueType) visitType(member.valueType);
      for (const parameter of member.parameters) visitType(parameter.typeRef);
      for (const argument of member.ownerGenericArguments) visitType(argument);
      for (const argument of member.genericArguments) visitType(argument);
    } else {
      visitType(value);
    }
    return freezeDeep(
      [...references.values()].sort((left, right) =>
        left.include.localeCompare(right.include) ||
        left.hintPath.localeCompare(right.hintPath)
      )
    );
  }

  const api = Object.freeze({
    version: MODULE_VERSION,
    schemaVersion: CONTRACT_SCHEMA_VERSION,
    canonicalJson,
    parseTypeRef,
    normalizeTypeRef,
    serializeTypeRef,
    typeRefFromPortableContract,
    typeRefSemanticKey,
    normalizeMemberRef,
    serializeMemberRef,
    memberRefFromPortableContract,
    memberRefSemanticKey,
    escapeIdentifier,
    emitTypeSyntax,
    emitMemberNameSyntax,
    parsePortableConstant,
    emitConstantSyntax,
    collectAssemblyReferences,
    genericBindingsFromPortableContract,
    portablePortRole,
    normalizePortContract,
    portContractFromPortableContract,
    serializePortContract,
    deriveShellPorts
  });

  if (typeof module === "object" && module?.exports) {
    module.exports = api;
  }
  if (typeof window === "object") {
    Object.defineProperty(window, "RMLCSharpContracts", {
      value: api,
      writable: false,
      enumerable: true,
      configurable: true
    });
  }
})();
