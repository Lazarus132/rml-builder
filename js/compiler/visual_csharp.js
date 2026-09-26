(() => {
  "use strict";

  const registry = window.RMLModNodeRegistry;
  if (!registry) {
    console.error(window.RMLI18n.t("ui.literal.252454d0863b"));
    return;
  }

  const {
    port,
    genericPort,
    registerType,
    registerGroup,
    registerNode,
    registerCodegenPlugin,
    getNodeDefinition,
    getNodeDefinitions,
    getTypeDefinitions
  } = registry;

  const VERSION = 24;
  const CUSTOM_CSHARP_COORDINATE_SPACE_VERSION = 2;
  const SYNTAX_TYPE = "csharpSyntax";
  const GROUPS = {
    project: window.RMLI18n.t("js.presentation.493e463115c3"),
    declarations: window.RMLI18n.t("ui.literal.0d953f6cf53a"),
    statements: window.RMLI18n.t("ui.literal.4653e03b4efa"),
    expressions: window.RMLI18n.t("ui.literal.f259b7bfccd8"),
    syntax: window.RMLI18n.t("ui.literal.be73a4b879b0")
  };

  const text = (key, label, defaultValue = "", help = "", extra = {}) => ({
    key,
    label,
    kind: "text",
    default: defaultValue,
    help,
    ...extra
  });
  const code = (key, label, defaultValue = "", help = "", rows = 5) => ({
    key,
    label,
    kind: "code",
    default: defaultValue,
    help,
    rows,
    monospace: true,
    spellcheck: false
  });
  const bool = (key, label, defaultValue = false, help = "") => ({
    key,
    label,
    kind: "bool",
    default: defaultValue,
    help
  });
  const select = (key, label, options, defaultValue, help = "") => ({
    key,
    label,
    kind: "select",
    options,
    default: defaultValue,
    help
  });
  const number = (key, label, defaultValue = 0, help = "", extra = {}) => ({
    key,
    label,
    kind: "number",
    default: defaultValue,
    storeAsNumber: true,
    help,
    ...extra
  });

  registerType(SYNTAX_TYPE, {
    label: window.RMLI18n.t("ui.auto.e365339ea2ea"),
    short: "C#",
    color: "#b789ff",
    valueType: false,
    globalGenericCandidate: false,
    csType: "object",
    defaultCs: "default(object)"
  });

  registerGroup(GROUPS.project, { after: window.RMLI18n.t("ui.literal.6a455a999dee") });
  registerGroup(GROUPS.declarations, { after: GROUPS.project });
  registerGroup(GROUPS.statements, { after: GROUPS.declarations });
  registerGroup(GROUPS.expressions, { after: GROUPS.statements });
  registerGroup(GROUPS.syntax, { after: GROUPS.expressions });

  const syntaxInput = (id, label, extra = {}) =>
    port(id, label, SYNTAX_TYPE, extra);
  const syntaxOutput = () => port("syntax", window.RMLI18n.t("ui.literal.17c7ba7676ad"), SYNTAX_TYPE);
  const normalize = value => String(value ?? "").replace(/\r\n?/g, "\n");
  const parameter = (node, key, fallback = "") => {
    const value = node?.parameters?.[key];
    return value === undefined || value === null ? fallback : value;
  };
  const indent = (value, spaces = 4) => {
    const prefix = " ".repeat(spaces);
    return normalize(value)
      .split("\n")
      .map(line => line.length > 0 ? `${prefix}${line}` : "")
      .join("\n");
  };
  const block = body => `\n{\n${indent(body)}\n}`;
  const statement = value => {
    const source = normalize(value).trim();
    return !source || /[;}]$/.test(source) ? source : `${source};`;
  };

  const KEYWORDS = new Set((
    "abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while add alias allows and args ascending async await by descending dynamic equals extension field file from get global group init into join let managed nameof nint not notnull nuint on or orderby partial record remove required scoped select set unmanaged value var when where with yield"
  ).split(/\s+/));
  const RESERVED_KEYWORDS = new Set((
    "abstract as base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using virtual void volatile while"
  ).split(/\s+/));
  const PUNCTUATORS = new Set([
    "{", "}", "[", "]", "(", ")", ".", ",", ":", ";", "?", "::",
    "+", "-", "*", "/", "%", "&", "|", "^", "!", "~", "=", "<", ">",
    "++", "--", "&&", "||", "->", "??", "?.", "?[", "=>", "==", "!=",
    "<=", ">=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<",
    ">>", ">>>", "<<=", ">>=", ">>>=", "??=", "..", "...", "<>", "#"
  ]);
  const IDENTIFIER_ESCAPE = "(?:\\\\u[0-9a-fA-F]{4}|\\\\U[0-9a-fA-F]{8})";
  const IDENTIFIER_START = `(?:[_\\p{L}]|${IDENTIFIER_ESCAPE})`;
  const IDENTIFIER_PART = `(?:[_\\p{L}\\p{N}\\p{Mn}\\p{Mc}\\p{Pc}\\p{Cf}]|${IDENTIFIER_ESCAPE})`;
  const IDENTIFIER = new RegExp(`^@?${IDENTIFIER_START}${IDENTIFIER_PART}*$`, "u");
  const QUALIFIED_NAME = new RegExp(`^(?:global::)?@?${IDENTIFIER_START}${IDENTIFIER_PART}*(?:(?:::|\\.)@?${IDENTIFIER_START}${IDENTIFIER_PART}*)*$`, "u");
  const NUMBER_LITERAL = /^(?:0[xX][0-9a-fA-F_]+(?:[uU](?:[lL])?|[lL](?:[uU])?)?|0[bB][01_]+(?:[uU](?:[lL])?|[lL](?:[uU])?)?|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]+)(?:[eE][+-]?\d[\d_]*)?(?:[fFdDmM]|[uU](?:[lL])?|[lL](?:[uU])?)?)$/;
  const MODIFIER = /^(?:(?:new|public|protected|internal|private|file|static|abstract|sealed|virtual|override|readonly|extern|unsafe|volatile|async|partial|required|ref|scoped)\s*)*$/;
  const TYPE_TEXT = /^(?:global::)?[A-Za-z_@][A-Za-z0-9_@.]*(?:\s*<[^{};=]+>)?(?:\s*(?:\?|\*|\[,*\]))*$/;

  function csharpStringLexemeEnd(source, start = 0) {
    const input = String(source || "");
    let cursor = start;
    let dollars = 0;
    while (input[cursor] === "$") { dollars += 1; cursor += 1; }
    let verbatim = false;
    if (input[cursor] === "@") { verbatim = true; cursor += 1; }
    if (input[cursor] === "$" && dollars === 0) { dollars = 1; cursor += 1; }
    if (input[cursor] !== '"') return -1;

    let quoteCount = 0;
    while (input[cursor + quoteCount] === '"') quoteCount += 1;
    if (quoteCount >= 3) {
      cursor += quoteCount;
      while (cursor < input.length) {
        let closing = 0;
        while (input[cursor + closing] === '"') closing += 1;
        if (closing >= quoteCount) return cursor + quoteCount;
        cursor += Math.max(1, closing);
      }
      return -1;
    }

    cursor += 1;
    let interpolationDepth = 0;
    while (cursor < input.length) {
      const current = input[cursor];
      if (!verbatim && current === "\\") { cursor += 2; continue; }
      if (verbatim && current === '"' && input[cursor + 1] === '"') { cursor += 2; continue; }
      if (dollars > 0 && current === "{" && input[cursor + 1] !== "{") { interpolationDepth += 1; cursor += 1; continue; }
      if (dollars > 0 && current === "}" && input[cursor + 1] !== "}" && interpolationDepth > 0) { interpolationDepth -= 1; cursor += 1; continue; }
      if (current === '"' && interpolationDepth === 0) return cursor + 1;
      cursor += 1;
    }
    return -1;
  }

  function isCompleteCSharpStringLexeme(value) {
    const candidate = String(value || "");
    return csharpStringLexemeEnd(candidate, 0) === candidate.length;
  }

  function isCompleteCSharpCharLexeme(value) {
    const candidate = String(value || "");
    if (!candidate.startsWith("'") || !candidate.endsWith("'") || candidate.length < 3) return false;
    const body = candidate.slice(1, -1);
    if (/^\\(?:[0abefnrtv\\'"]|x[0-9a-fA-F]{1,4}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8})$/.test(body)) return true;
    return !/[\\'\r\n]/.test(body) && Array.from(body).length === 1;
  }

  const escapeString = value => normalize(value)
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\u0000/g, "\\0")
    .replace(/\u0007/g, "\\a")
    .replace(/\u0008/g, "\\b")
    .replace(/\u000c/g, "\\f")
    .replace(/\u001b/g, "\\e")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    .replace(/\u000b/g, "\\v");
  const escapeChar = value => escapeString(Array.from(normalize(value))[0] ?? "\0")
    .replace(/'/g, "\\'");

  function requireIdentifier(ctx, value, label = "identifier") {
    const candidate = String(value || "").trim();
    if (!IDENTIFIER.test(candidate) || RESERVED_KEYWORDS.has(candidate.replace(/^@/, "")) && !candidate.startsWith("@")) {
      ctx.diagnostic(`${ctx.title}: '${candidate}' is not a valid C# ${label}.`);
      return "__invalid";
    }
    return candidate;
  }

  function requireQualifiedName(ctx, value, label = "name") {
    const candidate = String(value || "").trim();
    if (!QUALIFIED_NAME.test(candidate)) {
      ctx.diagnostic(`${ctx.title}: '${candidate}' is not a valid qualified C# ${label}.`);
      return window.RMLI18n.t("ui.literal.c2fd96c953f9");
    }
    return candidate;
  }

  function requireModifiers(ctx, value) {
    const candidate = String(value || "").trim().replace(/\s+/g, " ");
    if (candidate && !MODIFIER.test(`${candidate} `)) {
      ctx.diagnostic(`${ctx.title}: '${candidate}' contains an unsupported declaration modifier.`);
      return "";
    }
    return candidate;
  }

  function requireType(ctx, value) {
    const candidate = String(value || "").trim();
    if (!TYPE_TEXT.test(candidate)) {
      ctx.diagnostic(`${ctx.title}: '${candidate}' is not a valid standalone C# type syntax. Compose complex types with Exact Syntax nodes.`);
      return "object";
    }
    if (candidate.includes("*")) ctx.requireUnsafe?.();
    return candidate;
  }

  function registerSyntaxNode(id, definition) {
    registerNode(id, {
      expertOnly: true,
      customCSharpNode: true,
      customCSharpSyntaxNode: true,
      ...definition,
      outputs: definition.outputs || [syntaxOutput()]
    });
  }

  registerNode("csharp.project", {
    expertOnly: true,
    customCSharpNode: true,
    apiCompositeCustomCSharp: true,
    title: window.RMLI18n.t("ui.auto.5c4136841bc0"),
    group: GROUPS.project,
    symbol: "CSPROJ",
    description: window.RMLI18n.t("ui.auto.b3101ec2f02c"),
    parameters: [
      text("projectId", window.RMLI18n.t("ui.auto.7f16f0d44ba9"), "main", "Use 'main' for the normal generated mod project."),
      text("assemblyName", window.RMLI18n.t("ui.auto.82b30572427c"), "GeneratedVisualMod"),
      text("rootNamespace", window.RMLI18n.t("ui.auto.bc35cfbb0c0d"), "GeneratedVisualMod"),
      select("deployDirectory", window.RMLI18n.t("ui.auto.bd67e8655e1f"), ["rml_mods", "rml_libs"], "rml_mods"),
      bool("allowUnsafeBlocks", window.RMLI18n.t("ui.auto.f460987d965a"), false),
      bool("useWindowsForms", window.RMLI18n.t("ui.auto.098493c5f136"), false),
      bool("usesElements", window.RMLI18n.t("ui.auto.a0067e5e9eba"), true),
      bool("usesRenderiteShared", window.RMLI18n.t("ui.auto.9eb2153839e7"), false)
    ],
    inputs: [],
    outputs: []
  });

  const CUSTOM_CSHARP_RUNTIME_MODES = new Set([
    "action",
    "expression",
    "runtimeMember",
    "mainMember"
  ]);

  const customCSharpModeParameter = () => ({
    ...select(
      "mode",
      window.RMLI18n.t("ui.auto.af377ede2324"),
      [
        { value: "file", label: window.RMLI18n.t("ui.auto.e6c8f0190b3e") },
        { value: "action", label: window.RMLI18n.t("ui.auto.c3c93182883a") },
        { value: "expression", label: window.RMLI18n.t("ui.auto.0822f96b587d") },
        { value: "runtimeMember", label: window.RMLI18n.t("ui.auto.ad2ffe12d7f3") },
        { value: "mainMember", label: window.RMLI18n.t("ui.auto.4a2f648b5509") }
      ],
      "file",
      window.RMLI18n.t("ui.literal.bc4ca563cfed")
    ),
    affectsPorts: true,
    affectsNode: true,
    commitImmediately: true
  });

  const editorColor = (
    key,
    label,
    defaultValue
  ) => ({
    key,
    label,
    kind: "color",
    default: defaultValue,
    help:
      window.RMLI18n.t("ui.auto.91cc0e0a1806"),
    editorAppearance: true,
    inspectorHidden: true,
    commitImmediately: true
  });

  const customCSharpEditorParameters = () => [
    editorColor(
      "codeWorkbenchBackgroundColor",
      window.RMLI18n.t("ui.auto.dd7220d711ea"),
      "#181818"
    ),
    editorColor(
      "codeBoxBackgroundColor",
      window.RMLI18n.t("ui.auto.56a19e4205d9"),
      "#000000"
    ),
    editorColor(
      "codeGutterBackgroundColor",
      window.RMLI18n.t("ui.auto.37e731d71398"),
      "#000000"
    ),
    editorColor(
      "codePanelBackgroundColor",
      window.RMLI18n.t("ui.auto.e5c97b4a026d"),
      "#181818"
    ),
    editorColor(
      "codeOverlayBackgroundColor",
      window.RMLI18n.t("ui.auto.a8e700a8f4bb"),
      "#252526"
    ),
    editorColor(
      "codeStatusBackgroundColor",
      window.RMLI18n.t("ui.auto.2167d70d8a33"),
      "#68217a"
    ),
    editorColor(
      "codeSelectionBackgroundColor",
      window.RMLI18n.t("ui.auto.cb0b7a8b8bcd"),
      "#264f78"
    ),
    editorColor(
      "codeBoxTextColor",
      window.RMLI18n.t("ui.auto.7f4cdcf50d8f"),
      "#ffffff"
    ),
    editorColor(
      "codeInterfaceTextColor",
      window.RMLI18n.t("ui.auto.a5589df705ab"),
      "#cccccc"
    ),
    editorColor(
      "codeGutterTextColor",
      window.RMLI18n.t("ui.auto.5bc5026eb74c"),
      "#858585"
    ),
    editorColor(
      "codeStatusTextColor",
      window.RMLI18n.t("ui.auto.9651a250c8b9"),
      "#ffffff"
    ),
    editorColor(
      "codeAccentColor",
      window.RMLI18n.t("ui.auto.f07c6656e719"),
      "#b789ff"
    ),
    editorColor(
      "codeBoxCaretColor",
      window.RMLI18n.t("ui.auto.7cec4afe2f8e"),
      "#ffffff"
    )
  ];

  const customCSharpFilePresetParameter = () => ({
    ...select(
      "filePreset",
      window.RMLI18n.t("ui.dev327.filePreset"),
      [
        { value: "blank", label: window.RMLI18n.t("ui.dev327.blankCustom") },
        { value: "harmonyExact", label: window.RMLI18n.t("ui.dev327.harmonyExact") },
        { value: "harmonyEarly", label: window.RMLI18n.t("ui.dev327.harmonyEarly") }
      ],
      "blank",
      window.RMLI18n.t("ui.dev327.filePresetHelp")
    ),
    affectsNode: true,
    commitImmediately: true
  });

  const customCSharpFileParameters = () => [
    customCSharpModeParameter(),
    customCSharpFilePresetParameter(),
    text("fileName", window.RMLI18n.t("ui.auto.e8a60be6b168"), "VisualProgram.cs"),
    text("projectId", window.RMLI18n.t("ui.auto.7f16f0d44ba9"), "main"),
    number("harmonyPatchOrder", window.RMLI18n.t("ui.dev327.harmonyOrder"), 0, window.RMLI18n.t("ui.dev327.harmonyOrderHelp")),
    select("nullable", window.RMLI18n.t("ui.auto.949c5b54cc93"), ["inherit", "enable", "disable", "annotations", "warnings"], "inherit"),
    bool("autoGeneratedHeader", window.RMLI18n.t("ui.auto.ce17ab5c9181"), true),
    ...customCSharpEditorParameters(),
    code("source", window.RMLI18n.t("ui.auto.ec4bfc434347"), "", window.RMLI18n.t("ui.literal.8e3e427c7cc1"), 22)
  ];

  const customCSharpAllParameters = () => [
    ...customCSharpFileParameters(),
    number("variadicInputCount", window.RMLI18n.t("ui.auto.c749851b2a47"), 0, "", { inspectorHidden: true }),
    code("actionCode", window.RMLI18n.t("ui.auto.580fc6e91d3d"), "{NEXT}", window.RMLI18n.t("ui.literal.0061fb14bd00"), 14),
    code("expressionCode", window.RMLI18n.t("ui.auto.13e016950392"), "default", window.RMLI18n.t("ui.literal.a578a4b7f2c3"), 10),
    code("memberCode", window.RMLI18n.t("ui.auto.8e022ce8b9af"), "", window.RMLI18n.t("ui.literal.3096dd6a14d8"), 18)
  ];

  function customCSharpReferencedValueInputCount(node) {
    const mode = String(node?.parameters?.mode || "file");
    const source = mode === "action"
      ? node?.parameters?.actionCode
      : mode === "expression"
        ? node?.parameters?.expressionCode
        : "";
    let highest = 0;
    const tokenPattern = /\{\s*([A-Za-z]|input\s*\d+)\s*\}/gi;
    for (const match of String(source || "").matchAll(tokenPattern)) {
      const token = String(match[1] || "").replace(/\s+/g, "").toLowerCase();
      let index = 0;
      if (/^[a-z]$/.test(token)) index = token.charCodeAt(0) - 96;
      else {
        const numbered = /^input(\d+)$/.exec(token);
        if (numbered) index = Number(numbered[1]);
      }
      if (Number.isFinite(index) && index >= 1 && index <= 64) highest = Math.max(highest, index);
    }
    return highest;
  }

  function legacyRuntimeFileInputIds(node) {
    const mode = String(node?.parameters?.mode || "file");
    if (mode === "action" || mode === "expression") {
      const reserved = new Set([window.RMLI18n.t("ui.literal.1992d5e8d57e"), window.RMLI18n.t("ui.literal.ec4b11bad0ed"), window.RMLI18n.t("ui.literal.e7bd56e1ecb6"), window.RMLI18n.t("ui.literal.7b79c7adb62c"), window.RMLI18n.t("ui.literal.0c1fb64dcd9b")]);
      const storedIds = Array.isArray(node?.parameters?.customCSharpValueInputIds)
        ? node.parameters.customCSharpValueInputIds
            .map(value => String(value || "").trim())
            .filter(id => id && !reserved.has(id.toUpperCase()))
        : [];
      if (storedIds.length > 0) return [...new Set(storedIds)].slice(0, 64);

      const source = String(mode === "action"
        ? node?.parameters?.actionCode || ""
        : node?.parameters?.expressionCode || "");
      const result = [];
      const seen = new Set();
      for (const match of source.matchAll(/\{\s*([^{}\r\n]+?)\s*\}/g)) {
        const id = String(match[1] || "").trim();
        if (!id || reserved.has(id.toUpperCase()) || seen.has(id)) continue;
        seen.add(id);
        result.push(id);
        if (result.length >= 64) break;
      }
      return result;
    }

    const storedRaw = Number(node?.parameters?.variadicInputCount);
    const count = Number.isFinite(storedRaw)
      ? Math.max(0, Math.min(64, Math.trunc(storedRaw)))
      : 0;
    return Array.from({ length: count }, (_, index) =>
      index < 26 ? String.fromCharCode(97 + index) : `input${index + 1}`
    );
  }

  function renderLegacyRuntimeCode(
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
    for (const [name, value] of
      Object.entries(replacements)) {
      code = code.replaceAll(
        `{${name}}`,
        String(value ?? "")
      );
    }
    return code;
  }

  function customCSharpRuntimeDefinition(node) {
    const mode = String(
      node?.parameters?.mode || "file"
    );
    if (!CUSTOM_CSHARP_RUNTIME_MODES.has(mode)) {
      return null;
    }

    const inputIds =
      legacyRuntimeFileInputIds(node);
    const typeHints = node?.parameters?.customCSharpValueInputTypes && typeof node.parameters.customCSharpValueInputTypes === "object"
      ? node.parameters.customCSharpValueInputTypes : {};
    const typeDefinitions = getTypeDefinitions();

    const primitiveAliases = new Map([
      ["bool", "bool"], ["System.Boolean", "bool"],
      ["byte", "byte"], ["System.Byte", "byte"],
      ["sbyte", "sbyte"], ["System.SByte", "sbyte"],
      ["short", "short"], ["System.Int16", "short"],
      ["ushort", "ushort"], ["System.UInt16", "ushort"],
      ["int", "int"], ["System.Int32", "int"],
      ["uint", "uint"], ["System.UInt32", "uint"],
      ["long", "long"], ["System.Int64", "long"],
      ["ulong", "ulong"], ["System.UInt64", "ulong"],
      ["float", "float"], ["System.Single", "float"],
      ["double", "double"], ["System.Double", "double"],
      ["decimal", "decimal"], ["System.Decimal", "decimal"],
      ["char", "char"], ["System.Char", "char"],
      ["string", "string"], ["System.String", "string"],
      ["object", "object"], ["System.Object", "object"]
    ]);
    const normalizeCatalogType = value => String(value || "")
      .replace(/global::/g, "")
      .replace(/\s+/g, "")
      .replace(/\?$/, "")
      .trim();
    const catalogProjectionIndex =
      window.RMLApiCatalogProjectionIndex || null;
    const catalogHasExactType = raw => {
      if (!catalogProjectionIndex) return false;
      if (catalogProjectionIndex.typeByName?.has?.(raw)) return true;
      if (catalogProjectionIndex.enumByName?.has?.(raw)) return true;
      const open = raw.indexOf("<");
      if (open < 0) return false;
      let depth = 0;
      let close = -1;
      let argumentCount = 1;
      for (let index = open; index < raw.length; index += 1) {
        const character = raw[index];
        if (character === "<") depth += 1;
        else if (character === ">") {
          depth -= 1;
          if (depth === 0) { close = index; break; }
        } else if (character === "," && depth === 1) {
          argumentCount += 1;
        }
      }
      if (close < 0) return false;
      const shape = [
        raw.slice(0, open).replace(/\s+/g, ""),
        raw.slice(close + 1).replace(/\s+/g, ""),
        argumentCount
      ].join("|");
      return Boolean(
        shape &&
        catalogProjectionIndex.genericTypeByShape?.has?.(shape)
      );
    };
    const declaredCustomCSharpTypes = new Set(
      Array.isArray(window.RMLCustomCSharpDeclaredSystemTypes)
        ? window.RMLCustomCSharpDeclaredSystemTypes.map(normalizeCatalogType).filter(Boolean)
        : []
    );
    const resolveHint = hint => {
      const raw = normalizeCatalogType(hint);
      if (!raw) return "";

      
      const primitive = primitiveAliases.get(raw);
      if (primitive && typeDefinitions?.[primitive]) return primitive;

      
      
      
      
      if (typeDefinitions?.[raw]) return raw;

      const graphCandidates = [
        raw,
        raw.startsWith("Elements.Core.") ? "" : `Elements.Core.${raw}`
      ].filter(Boolean);
      for (const candidate of graphCandidates) {
        const canonicalGraphType =
          typeof graphTypeForCsType === "function"
            ? graphTypeForCsType(candidate)
            : null;
        if (
          canonicalGraphType &&
          typeDefinitions?.[canonicalGraphType]
        ) {
          return canonicalGraphType;
        }
      }

      
      const registeredMatches =
        Object.entries(typeDefinitions || {})
          .filter(([, definition]) => {
            const csType =
              normalizeCatalogType(
                definition?.csType
              );
            const apiType =
              normalizeCatalogType(
                definition?.apiCatalogType
              );
            return (
              csType === raw ||
              apiType === raw ||
              csType === `Elements.Core.${raw}` ||
              apiType === `Elements.Core.${raw}`
            );
          });
      if (registeredMatches.length === 1) {
        return registeredMatches[0][0];
      }

      
      
      
      const provenByScanner =
        catalogHasExactType(raw);
      const provenByCustomCSharp =
        declaredCustomCSharpTypes.has(raw);
      if (
        provenByScanner ||
        provenByCustomCSharp
      ) {
        return raw;
      }

      return "";
    };
    const valueInputs = inputIds.map((id, index) => {
      const label = String(id);
      const concreteType = resolveHint(typeHints[id]);
      return concreteType
        ? port(id, label, concreteType)
        : genericPort(id, label, `T${index + 1}`, "anyValue", {

            customCSharpUnresolvedType: true
          });
    });
    const base = {
      title: window.RMLI18n.t("ui.text.ba090b5e07cf"),
      group: GROUPS.project,
      symbol: "C#",
      expertOnly: true,
      customCSharpNode: true,
      apiCompositeCustomCSharp: true,
      customCSharpFile: false,
      customCSharpLegacyRuntimeNode: true
    };

    if (mode === "action") {
      return {
        ...base,
        description:
          window.RMLI18n.t("ui.auto.d4d8c34f67ff"),
        parameters: [
          customCSharpModeParameter(),
          ...customCSharpEditorParameters(),
          number(
            "variadicInputCount",
            window.RMLI18n.t("ui.auto.c749851b2a47"),
            0,
            window.RMLI18n.t("ui.literal.4f45ccb08d7a"),
            { inspectorHidden: true }
          ),
          code(
            "actionCode",
            window.RMLI18n.t("ui.auto.580fc6e91d3d"),
            "{NEXT}",
            window.RMLI18n.t("ui.literal.0061fb14bd00"),
            14
          )
        ],
        inputs: [
          port("call", window.RMLI18n.t("ui.auto.305e019445e3"), "impulse"),
          ...valueInputs
        ],
        outputs: /\{\s*NEXT\s*\}/i.test(String(node?.parameters?.actionCode || ""))
          ? [port("next", window.RMLI18n.t("ui.text.bc981983e7f5"), "impulse")]
          : [],
        codegenAction(api) {
          const replacements = {};
          for (const id of inputIds) {
            replacements[id] =
              api.input(id).code;
          }
          const next = api.emit?.("next");
          replacements.NEXT = next
            ? `${next}();`
            : "";
          return renderLegacyRuntimeCode(
            api.node.parameters?.actionCode,
            api,
            replacements
          );
        },
        codegenCollect(api) {

          if (api.isInputConnected?.("call") || api.isActionReachable?.()) return;

          const replacements = {};
          for (const id of inputIds) {
            replacements[id] = api.input(id).code;
          }

          replacements.NEXT = "";
          const body = renderLegacyRuntimeCode(
            api.node.parameters?.actionCode,
            api,
            replacements
          );
          const methodName =
            `ValidateCustomCSharpAction${api.identifier(api.node.id)}`;
          api.addMember(
            `${api.node.id}.unreachableCustomCSharpAction`,
            `    private static void ${methodName}()\n    {\n${String(body || "").split("\n").map(line => `        ${line}`).join("\n")}\n    }`
          );
        }
      };
    }

    if (mode === "expression") {
      return {
        ...base,
        description:
          window.RMLI18n.t("ui.auto.cc9f4088c79a"),
        parameters: [
          customCSharpModeParameter(),
          ...customCSharpEditorParameters(),
          number(
            "variadicInputCount",
            window.RMLI18n.t("ui.auto.c749851b2a47"),
            0,
            window.RMLI18n.t("ui.literal.4f45ccb08d7a"),
            { inspectorHidden: true }
          ),
          code(
            "expressionCode",
            window.RMLI18n.t("ui.auto.13e016950392"),
            "default",
            window.RMLI18n.t("ui.literal.a578a4b7f2c3"),
            10
          )
        ],
        inputs: valueInputs,
        outputs: [
          genericPort(
            "result",
            window.RMLI18n.t("ui.auto.ca8a16007fd8"),
            window.RMLI18n.t("ui.literal.942c5cd39b91"),
            "anyValue"
          )
        ],
        codegenExpression(api) {
          const replacements = {};
          for (const id of inputIds) {
            replacements[id] =
              api.input(id).code;
          }
          return renderLegacyRuntimeCode(
            api.node.parameters?.expressionCode,
            api,
            replacements
          );
        }
      };
    }

    const mainMember =
      mode === "mainMember";
    return {
      ...base,
      description: mainMember
        ? window.RMLI18n.t("ui.literal.3295ad5bf38a")
        : window.RMLI18n.t("ui.literal.6fad75884e65"),
      parameters: [
        customCSharpModeParameter(),
        ...customCSharpEditorParameters(),
        code(
          "memberCode",
          window.RMLI18n.t("ui.auto.8e022ce8b9af"),
          "",
          window.RMLI18n.t("ui.literal.3096dd6a14d8"),
          18
        )
      ],
      inputs: [],
      outputs: [],
      codegenCollect: mainMember
        ? undefined
        : api => {
            const member =
              renderLegacyRuntimeCode(
                api.node.parameters?.memberCode,
                api
              ).trim();
            if (member) {
              api.addMember(
                `${api.node.id}.legacyRuntimeMember`,
                member
              );
            }
          }
    };
  }

  const HARMONY_EXACT_PRESET_SOURCE = `using HarmonyLib;

namespace {NAMESPACE};

[HarmonyPatch]
internal static class ExactHarmonyPatches
{
    // Add [HarmonyPatch] targets and exact Prefix/Postfix/Finalizer/Transpiler methods here.
}
`;
  const HARMONY_EARLY_PRESET_SOURCE = `using HarmonyLib;

namespace {NAMESPACE}.EarlyPatches;

[HarmonyPatch]
internal static class EarlyHarmonyPatches
{
    // Add exact [HarmonyPatch] declarations here.
    // This project cannot call graph Emit... methods or read generated mod state.
}
`;

  function customCSharpPresetSource(node) {
    const preset = String(node?.parameters?.filePreset || "blank");
    const stored = String(node?.parameters?.source || "");
    if (stored.trim()) return stored;
    if (preset === "harmonyExact") return HARMONY_EXACT_PRESET_SOURCE;
    if (preset === "harmonyEarly") return HARMONY_EARLY_PRESET_SOURCE;
    return stored;
  }

  function customCSharpPresetFileName(node) {
    const preset = String(node?.parameters?.filePreset || "blank");
    const stored = String(node?.parameters?.fileName || "").trim();
    if (stored && stored !== "VisualProgram.cs") return stored;
    if (preset === "harmonyExact") return "ExactHarmonyPatches.cs";
    if (preset === "harmonyEarly") return "EarlyHarmonyPatches.cs";
    return stored || "VisualProgram.cs";
  }

  registerNode("csharp.file", {
    title: window.RMLI18n.t("ui.text.ba090b5e07cf"),
    group: GROUPS.project,
    symbol: "C#",
    expertOnly: true,
    customCSharpNode: true,
    apiCompositeCustomCSharp: true,
    customCSharpFile: true,
    description: window.RMLI18n.t("ui.auto.b5aef72b8415"),
    parameters: customCSharpAllParameters(),
    inputs: [],
    resolveDefinition(node) {
      const runtimeDefinition =
        customCSharpRuntimeDefinition(node);
      if (runtimeDefinition) {
        return runtimeDefinition;
      }
      return {
        title: window.RMLI18n.t("ui.text.ba090b5e07cf"),
        symbol: "C#",
        group: GROUPS.project,
        expertOnly: true,
        customCSharpNode: true,
        apiCompositeCustomCSharp: true,
        customCSharpFile: true,
        customCSharpLegacyRuntimeNode: false,
        description: window.RMLI18n.t("ui.auto.54de1b5e6de8"),
        parameters: customCSharpFileParameters(),
        inputs: node?.parameters?.legacyInlineContent === true
          ? [syntaxInput("content", window.RMLI18n.t("ui.literal.e9c86a414929"))]
          : []
      };
    },
    outputs: []
  });

  registerNode("csharp.customFileOutput", {
    expertOnly: true,
    customCSharpNode: true,
    customCSharpSubgraphOnly: true,
    title: window.RMLI18n.t("ui.auto.a23d993e463a"),
    group: GROUPS.project,
    symbol: "OUT",
    description: window.RMLI18n.t("ui.auto.9745a98c2b1e"),
    parameters: [],
    inputs: [syntaxInput("content", window.RMLI18n.t("ui.literal.ee3b2768eeba"))],
    outputs: []
  });

  const csharpReferenceKindParameter = () => ({
    ...select(
      "referenceKind",
      window.RMLI18n.t("ui.auto.a1617f0a4914"),
      [
        { value: "assembly", label: window.RMLI18n.t("ui.auto.d0c2a80133d6") },
        { value: "package", label: window.RMLI18n.t("ui.auto.d6030ff22084") },
        { value: "framework", label: window.RMLI18n.t("ui.auto.8b13018cf7f7") }
      ],
      "assembly",
      window.RMLI18n.t("ui.literal.000538283da1")
    ),
    affectsPorts: true,
    affectsNode: true,
    commitImmediately: true
  });

  const csharpReferenceParameters = referenceKind => {
    const common = [
      csharpReferenceKindParameter(),
      text("projectId", window.RMLI18n.t("ui.auto.7f16f0d44ba9"), "main")
    ];
    if (referenceKind === "package") {
      return [
        ...common,
        text("include", window.RMLI18n.t("ui.auto.b08a4f90a2bd"), "Package.Name"),
        text("version", window.RMLI18n.t("index.text.0cc55e55f3e8"), "1.0.0"),
        text("privateAssets", window.RMLI18n.t("ui.auto.edfc55182948"), ""),
        text("includeAssets", window.RMLI18n.t("ui.auto.6eb15090586a"), "")
      ];
    }
    if (referenceKind === "framework") {
      return [
        ...common,
        text("include", window.RMLI18n.t("ui.auto.8b13018cf7f7"), "Microsoft.AspNetCore.App")
      ];
    }
    return [
      ...common,
      text("include", window.RMLI18n.t("ui.auto.d0c2a80133d6"), "Assembly.Name"),
      text("hintPath", window.RMLI18n.t("ui.auto.26e4296e69c0"), ""),
      bool("private", window.RMLI18n.t("ui.auto.5e2ff2f254c4"), false)
    ];
  };

  registerNode("csharp.reference", {
    expertOnly: true,
    customCSharpNode: true,
    apiCompositeCustomCSharp: true,
    title: window.RMLI18n.t("ui.auto.ff27a68629ca"),
    group: GROUPS.project,
    symbol: "REF",
    description: window.RMLI18n.t("ui.auto.980b5aa9c7bb"),
    parameters: csharpReferenceParameters("assembly"),
    inputs: [],
    outputs: [],
    resolveDefinition(node) {
      const referenceKind = String(
        node?.parameters?.referenceKind || "assembly"
      );
      if (referenceKind === "package") {
        return {
          title: window.RMLI18n.t("ui.auto.ecc13ba5ea60"),
          symbol: "NUGET",
          parameters: csharpReferenceParameters("package")
        };
      }
      if (referenceKind === "framework") {
        return {
          title: window.RMLI18n.t("ui.auto.298c6e8a70bb"),
          symbol: "FX",
          parameters: csharpReferenceParameters("framework")
        };
      }
      return {
        title: window.RMLI18n.t("ui.auto.a550c0a52eb7"),
        symbol: "DLL",
        parameters: csharpReferenceParameters("assembly")
      };
    }
  });

  registerSyntaxNode("csharp.sequence", {
    title: window.RMLI18n.t("ui.auto.25532368db05"),
    group: GROUPS.syntax,
    symbol: "A…Z",
    description: window.RMLI18n.t("ui.auto.eca12e82bfac"),
    parameters: [
      select("separator", window.RMLI18n.t("ui.auto.487ce11fc936"), ["automatic", "none", "space", "newline", "blankLine", "comma", "commaSpace"], "newline"),
      number("variadicInputCount", window.RMLI18n.t("ui.auto.5b01663a3ec3"), 2)
    ],
    inputs: [syntaxInput("a", window.RMLI18n.t("ui.auto.33a84c726bd4")), syntaxInput("b", window.RMLI18n.t("ui.auto.47a451f273f8"))],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 512,
      template: syntaxInput("a", window.RMLI18n.t("ui.auto.33a84c726bd4"))
    },
    syntaxRender(ctx) {
      const separator = {
        none: "",
        space: " ",
        newline: "\n",
        blankLine: "\n\n",
        comma: ",",
        commaSpace: ", "
      }[parameter(ctx.node, "separator", "newline")];
      const rawValues = ctx.variadic(ctx.renderMode);
      if (parameter(ctx.node, "separator", "newline") === "none") {
        return rawValues.join("");
      }
      const values = rawValues.map(value => value.trim()).filter(Boolean);
      if (separator !== undefined) return values.join(separator);
      return values.reduce((result, value) => {
        if (!result) return value;
        const tightLeft = /^[,;.:)\]}?]/.test(value);
        const tightRight = /[([{.?:]$/.test(result);
        return `${result}${tightLeft || tightRight ? "" : " "}${value}`;
      }, "");
    }
  });

  registerSyntaxNode("csharp.trivia", {
    title: window.RMLI18n.t("ui.auto.e263df26d757"),
    group: GROUPS.syntax,
    symbol: "WS",
    parameters: [
      select("kind", window.RMLI18n.t("ui.auto.c70e585618c8"), ["space", "newline", "blankLine", "indent", "tab", "exact"], "space"),
      number("count", window.RMLI18n.t("ui.auto.cd6db24e1acf"), 1),
      text("value", window.RMLI18n.t("ui.auto.8b1c198742b9"), " ", window.RMLI18n.t("ui.literal.b2f280306724"))
    ],
    syntaxRender(ctx) {
      const count = Math.max(1, Math.min(32, Number(parameter(ctx.node, "count", 1)) || 1));
      switch (parameter(ctx.node, "kind", "space")) {
        case "newline": return "\n".repeat(count);
        case "blankLine": return "\n".repeat(count + 1);
        case "indent": return "    ".repeat(count);
        case "tab": return "\t".repeat(count);
        case "exact": {
          const value = normalize(parameter(ctx.node, "value", ""));
          if (!/^\s*$/.test(value)) {
            ctx.diagnostic(`${ctx.title}: Exact whitespace contains a non-whitespace character.`);
            return "";
          }
          return value;
        }
        default: return " ".repeat(count);
      }
    }
  });

  registerSyntaxNode("csharp.token", {
    title: window.RMLI18n.t("ui.auto.bf77c3f45730"),
    group: GROUPS.syntax,
    symbol: "TOK",
    description: window.RMLI18n.t("ui.auto.f1f022d08c57"),
    parameters: [
      select("kind", window.RMLI18n.t("ui.auto.8f379c0ef82f"), ["identifier", "keyword", "punctuation", "string", "char", "number", "lineComment", "blockComment", "directive", "stringLexeme", "charLexeme"], "identifier"),
      code("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "value", window.RMLI18n.t("ui.literal.4f4cf9bceb8c"), 3)
    ],
    syntaxRender(ctx) {
      const kind = parameter(ctx.node, "kind", "identifier");
      const value = normalize(parameter(ctx.node, "value", ""));
      switch (kind) {
        case "identifier": return requireIdentifier(ctx, value);
        case "keyword": {
          const candidate = value.trim();
          if (!KEYWORDS.has(candidate)) {
            ctx.diagnostic(`${ctx.title}: '${candidate}' is not a recognized C# keyword.`);
            return "__invalid_keyword";
          }
          if (["unsafe", "fixed", "stackalloc"].includes(candidate)) ctx.requireUnsafe();
          return candidate;
        }
        case "punctuation": {
          const candidate = value.trim();
          if (!PUNCTUATORS.has(candidate)) {
            ctx.diagnostic(`${ctx.title}: '${candidate}' is not a recognized C# punctuator/operator.`);
            return ";";
          }
          if (["*", "&", "->"].includes(candidate)) ctx.requireUnsafe();
          return candidate;
        }
        case "string": return `"${escapeString(value)}"`;
        case "char": return `'${escapeChar(value)}'`;
        case "number": {
          const candidate = value.trim();
          if (!NUMBER_LITERAL.test(candidate)) {
            ctx.diagnostic(`${ctx.title}: '${candidate}' is not a valid C# numeric literal.`);
            return "0";
          }
          return candidate;
        }
        case "lineComment": return `//${value.replace(/[\r\n]/g, " ")}`;
        case "blockComment": return `/*${value.replace(/\*\//g, "* /")}*/`;
        case "stringLexeme": {
          const candidate = value;
          if (!isCompleteCSharpStringLexeme(candidate)) {
            ctx.diagnostic(`${ctx.title}: the supplied exact string is not one complete C# string literal.`);
            return "\"\"";
          }
          return candidate;
        }
        case "charLexeme": {
          const candidate = value;
          if (!isCompleteCSharpCharLexeme(candidate)) {
            ctx.diagnostic(`${ctx.title}: the supplied exact character is not one complete C# character literal.`);
            return "'\\0'";
          }
          return candidate;
        }
        case "directive": {
          const candidate = value.trim();
          if (!/^(?:#[A-Za-z]+(?:[ \t]+[^\r\n]*)?|#![^\r\n]*|#:[^\r\n]*)$/.test(candidate)) {
            ctx.diagnostic(`${ctx.title}: directive must be one valid C# 14 directive line beginning with '#', '#!' or '#:'.`);
            return "#error Invalid_directive";
          }
          return candidate;
        }
        default:
          ctx.diagnostic(`${ctx.title}: unknown token kind '${kind}'.`);
          return "";
      }
    }
  });

  registerSyntaxNode("csharp.roslynNode", {
    title: window.RMLI18n.t("ui.auto.65e0f236deca"),
    group: GROUPS.syntax,
    symbol: "AST",
    description: window.RMLI18n.t("ui.auto.a19b3657738f"),
    parameters: [
      text("syntaxKind", window.RMLI18n.t("ui.auto.981cd458bd81"), "CompilationUnit"),
      text("languageVersion", window.RMLI18n.t("ui.auto.33f53ec08c73"), "14.0"),
      number("variadicInputCount", window.RMLI18n.t("ui.auto.953429054f6e"), 2)
    ],
    inputs: [syntaxInput("a", window.RMLI18n.t("ui.literal.172e3d7563be")), syntaxInput("b", window.RMLI18n.t("ui.literal.b53f6a7d141a"))],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 512,
      template: syntaxInput("a", window.RMLI18n.t("ui.literal.172e3d7563be"))
    },
    syntaxRender(ctx) {
      const kind = String(parameter(ctx.node, "syntaxKind", "")).trim();
      if (parameter(ctx.node, "languageVersion", "") !== "14.0") {
        ctx.diagnostic(`${ctx.title}: only the fixed C# 14 grammar contract is accepted.`);
      }
      if (!/^[A-Za-z][A-Za-z0-9]*$/.test(kind)) {
        ctx.diagnostic(`${ctx.title}: '${kind}' is not a valid Roslyn SyntaxKind name.`);
      }
      return ctx.variadic().join("");
    }
  });

  registerSyntaxNode("csharp.roslynToken", {
    title: window.RMLI18n.t("ui.auto.245f1a2ea4b4"),
    group: GROUPS.syntax,
    symbol: "RTOK",
    description: window.RMLI18n.t("ui.auto.6b3573ce18a9"),
    parameters: [
      text("syntaxKind", window.RMLI18n.t("ui.auto.981cd458bd81"), "IdentifierToken"),
      code("value", window.RMLI18n.t("ui.auto.d1c749eb2191"), "value", window.RMLI18n.t("ui.literal.4aafdbde336c"), 2),
      text("signature", window.RMLI18n.t("ui.auto.5a0de1ffd785"), "")
    ],
    syntaxRender(ctx) {
      const kind = String(parameter(ctx.node, "syntaxKind", ""));
      const value = String(parameter(ctx.node, "value", ""));
      const signature = String(parameter(ctx.node, "signature", ""));
      if (signature !== stableHash(`token\0${kind}\0${value}`)) {
        ctx.diagnostic(`${ctx.title}: token text or SyntaxKind changed after Roslyn validation. Reimport or revalidate the C# 14 source.`);
        return "";
      }
      return value;
    }
  });

  registerSyntaxNode("csharp.roslynTrivia", {
    title: window.RMLI18n.t("ui.auto.903f74d3df74"),
    group: GROUPS.syntax,
    symbol: "RTRIV",
    description: window.RMLI18n.t("ui.auto.dfdbaa883ba0"),
    parameters: [
      text("syntaxKind", window.RMLI18n.t("ui.auto.981cd458bd81"), "WhitespaceTrivia"),
      code("value", window.RMLI18n.t("ui.auto.78b83ec3dbb6"), " ", window.RMLI18n.t("ui.literal.f39545a7ae1c"), 2),
      text("signature", window.RMLI18n.t("ui.auto.5a0de1ffd785"), "")
    ],
    syntaxRender(ctx) {
      const kind = String(parameter(ctx.node, "syntaxKind", ""));
      const value = String(parameter(ctx.node, "value", ""));
      const signature = String(parameter(ctx.node, "signature", ""));
      if (signature !== stableHash(`trivia\0${kind}\0${value}`)) {
        ctx.diagnostic(`${ctx.title}: trivia text or SyntaxKind changed after Roslyn validation. Reimport or revalidate the C# 14 source.`);
        return "";
      }
      return value;
    }
  });

  registerSyntaxNode("csharp.delimited", {
    title: window.RMLI18n.t("ui.auto.bac4ee6d7d45"),
    group: GROUPS.syntax,
    symbol: "(…)",
    parameters: [
      select("delimiter", window.RMLI18n.t("ui.auto.1c1122e77f3b"), ["parentheses", "brackets", "braces", "angles"], "parentheses"),
      select("layout", window.RMLI18n.t("ui.auto.338dedb9e4fc"), ["inline", "block"], "inline"),
      select("suffix", window.RMLI18n.t("ui.auto.59654b5126ca"), ["none", "semicolon", "comma"], "none")
    ],
    inputs: [syntaxInput("content", window.RMLI18n.t("ui.literal.4f9be057f0ea"))],
    syntaxRender(ctx) {
      const [open, close] = {
        parentheses: ["(", ")"], brackets: ["[", "]"], braces: ["{", "}"], angles: ["<", ">"]
      }[parameter(ctx.node, "delimiter", "parentheses")];
      const content = ctx.input("content");
      const body = parameter(ctx.node, "layout", "inline") === "block"
        ? `${open}\n${indent(content)}\n${close}`
        : `${open}${content}${close}`;
      return body + ({ semicolon: ";", comma: "," }[parameter(ctx.node, "suffix", "none")] || "");
    }
  });

  registerSyntaxNode("csharp.identifier", {
    title: window.RMLI18n.t("ui.auto.5f7a46681c03"),
    group: GROUPS.expressions,
    symbol: "ID",
    parameters: [text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "value")],
    syntaxRender(ctx) { return requireIdentifier(ctx, parameter(ctx.node, "name", "value")); }
  });

  registerSyntaxNode("csharp.type", {
    title: window.RMLI18n.t("ui.auto.80caeaa8575d"),
    group: GROUPS.declarations,
    symbol: "TYPE",
    parameters: [text("name", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "object", window.RMLI18n.t("ui.literal.f3f9d927fc6b"))],
    syntaxRender(ctx) { return requireType(ctx, parameter(ctx.node, "name", "object")); }
  });

  registerSyntaxNode("csharp.literal", {
    title: window.RMLI18n.t("ui.auto.19f17c7c7517"),
    group: GROUPS.expressions,
    symbol: "LIT",
    parameters: [
      select("kind", window.RMLI18n.t("ui.auto.c70e585618c8"), ["string", "char", "integer", "real", "true", "false", "null", "default"], "string"),
      text("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"), "")
    ],
    syntaxRender(ctx) {
      const kind = parameter(ctx.node, "kind", "string");
      const value = String(parameter(ctx.node, "value", ""));
      if (kind === "string") return `"${escapeString(value)}"`;
      if (kind === "char") return `'${escapeChar(value)}'`;
      if (["true", "false", "null", "default"].includes(kind)) return kind;
      if (!NUMBER_LITERAL.test(value.trim())) {
        ctx.diagnostic(`${ctx.title}: '${value}' is not a valid numeric literal.`);
        return "0";
      }
      return value.trim();
    }
  });

  registerSyntaxNode("csharp.graphValueExpression", {
    title: window.RMLI18n.t("ui.auto.c85c30d75a30"),
    group: GROUPS.expressions,
    symbol: "C#",
    description: window.RMLI18n.t("ui.auto.68ca2ea8bd68"),
    inputs: [genericPort("value", window.RMLI18n.t("ui.literal.45de4c36ac79"), "T", "anyValue")],
    syntaxRender(ctx) {
      return ctx.graphValue("value");
    }
  });

  registerSyntaxNode("csharp.usingDirective", {
    title: window.RMLI18n.t("ui.auto.9f98c27de221"),
    group: GROUPS.declarations,
    symbol: "USING",
    parameters: [
      text("name", window.RMLI18n.t("ui.auto.dfa6e34e6690"), "System"),
      text("alias", window.RMLI18n.t("ui.auto.3bb7d26aa322"), ""),
      bool("global", window.RMLI18n.t("ui.auto.79b451055d79"), false),
      bool("static", window.RMLI18n.t("ui.auto.890f8103bb11"), false),
      code("exactSource", window.RMLI18n.t("ui.auto.9a90b3a5463e"), "", window.RMLI18n.t("ui.literal.22d95c601c23"), 3),
      code("leadingTrivia", window.RMLI18n.t("ui.auto.767ee0507ead"), "", window.RMLI18n.t("ui.literal.fb9c20887a19"), 2),
      code("trailingTrivia", window.RMLI18n.t("ui.auto.d9370952f50c"), "", window.RMLI18n.t("ui.literal.fb9c20887a19"), 2),
      text("validationSignature", window.RMLI18n.t("ui.auto.bcc7e7c3ce89"), "")
    ],
    syntaxRender(ctx) {
      const exactSource = String(parameter(ctx.node, "exactSource", ""));
      const signature = String(parameter(ctx.node, "validationSignature", ""));
      if (exactSource) {
        if (signature && signature !== stableHash(`using-exact\0${exactSource}`)) {
          ctx.diagnostic(`${ctx.title}: the exact imported using directive no longer matches its Roslyn validation signature.`);
          return "";
        }
        return exactSource;
      }
      const name = requireQualifiedName(ctx, parameter(ctx.node, "name", window.RMLI18n.t("ui.literal.bc0792d8dc81")), "namespace/type name");
      const aliasRaw = String(parameter(ctx.node, "alias", "")).trim();
      const alias = aliasRaw ? `${requireIdentifier(ctx, aliasRaw, "alias")} = ` : "";
      const result = `${String(parameter(ctx.node, "leadingTrivia", ""))}${parameter(ctx.node, "global", false) ? "global " : ""}using ${parameter(ctx.node, "static", false) ? "static " : ""}${alias}${name};${String(parameter(ctx.node, "trailingTrivia", ""))}`;
      if (signature && signature !== stableHash(`using\0${result}`)) {
        ctx.diagnostic(`${ctx.title}: the imported using directive changed after Roslyn validation. Reopen the graph to validate it again.`);
        return "";
      }
      return result;
    }
  });

  registerSyntaxNode("csharp.namespace", {
    title: window.RMLI18n.t("index.text.43c7d869d357"),
    group: GROUPS.declarations,
    symbol: "NS",
    parameters: [
      text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "Generated"),
      select("style", window.RMLI18n.t("ui.auto.d6bd50f52149"), ["fileScoped", "block"], "fileScoped")
    ],
    inputs: [syntaxInput("members", window.RMLI18n.t("ui.literal.1cb449c11266"))],
    syntaxRender(ctx) {
      const name = requireQualifiedName(ctx, parameter(ctx.node, "name", window.RMLI18n.t("ui.literal.8eefdd52ad2d")), "namespace");
      const members = ctx.input("members");
      return parameter(ctx.node, "style", "fileScoped") === "block"
        ? `namespace ${name}${block(members)}`
        : `namespace ${name};\n\n${members}`;
    }
  });

  registerSyntaxNode("csharp.attribute", {
    title: window.RMLI18n.t("ui.auto.6544e4e266db"),
    group: GROUPS.declarations,
    symbol: "ATTR",
    parameters: [
      text("name", window.RMLI18n.t("ui.auto.0e6f0d5b5455"), "System.Obsolete"),
      select("target", window.RMLI18n.t("ui.auto.ba52d97729b9"), ["none", "assembly", "module", "field", "event", "method", "param", "property", "return", "type"], "none")
    ],
    inputs: [syntaxInput("arguments", window.RMLI18n.t("ui.auto.cda21d9622e7"))],
    syntaxRender(ctx) {
      const target = parameter(ctx.node, "target", "none");
      const argumentsSyntax = ctx.input("arguments").trim();
      return `[${target === "none" ? "" : `${target}: `}${requireType(ctx, parameter(ctx.node, "name", "System.Obsolete"))}${argumentsSyntax ? `(${argumentsSyntax})` : ""}]`;
    }
  });

  registerSyntaxNode("csharp.genericParameter", {
    title: window.RMLI18n.t("ui.auto.a713ad683e46"),
    group: GROUPS.declarations,
    symbol: "<T>",
    parameters: [
      text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "T"),
      select("variance", window.RMLI18n.t("ui.auto.c84783c67775"), ["none", "in", "out"], "none")
    ],
    inputs: [syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7"))],
    syntaxRender(ctx) {
      const variance = parameter(ctx.node, "variance", "none");
      return `${ctx.input("attributes").trim()}${ctx.input("attributes").trim() ? " " : ""}${variance === "none" ? "" : `${variance} `}${requireIdentifier(ctx, parameter(ctx.node, "name", "T"))}`;
    }
  });

  registerSyntaxNode("csharp.constraint", {
    title: window.RMLI18n.t("ui.auto.7267db7d53fd"),
    group: GROUPS.declarations,
    symbol: "WHERE",
    parameters: [text("parameter", window.RMLI18n.t("ui.auto.b950c67155be"), "T")],
    inputs: [syntaxInput("constraints", window.RMLI18n.t("ui.literal.52e68a873a2b"))],
    syntaxRender(ctx) {
      return `where ${requireIdentifier(ctx, parameter(ctx.node, "parameter", "T"))} : ${ctx.input("constraints") || "notnull"}`;
    }
  });

  registerSyntaxNode("csharp.parameter", {
    title: window.RMLI18n.t("ui.auto.8e63222113d8"),
    group: GROUPS.declarations,
    symbol: "PARAM",
    parameters: [
      text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "value"),
      text("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "object"),
      select("modifier", window.RMLI18n.t("ui.auto.e414b0062d6d"), ["none", "this", "ref", "out", "in", "params", "scoped", "scoped ref", "ref readonly"], "none")
    ],
    inputs: [syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")), syntaxInput("default", window.RMLI18n.t("ui.text.bdffe654f855"))],
    syntaxRender(ctx) {
      const attributes = ctx.input("attributes").trim();
      const modifier = parameter(ctx.node, "modifier", "none");
      const fallback = ctx.input("default").trim();
      return `${attributes ? `${attributes} ` : ""}${modifier === "none" ? "" : `${modifier} `}${requireType(ctx, parameter(ctx.node, "type", "object"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "value"))}${fallback ? ` = ${fallback}` : ""}`;
    }
  });

  registerSyntaxNode("csharp.typeDeclaration", {
    title: window.RMLI18n.t("ui.auto.19ff1870f4b2"),
    group: GROUPS.declarations,
    symbol: "TYPE{}",
    parameters: [
      select("kind", window.RMLI18n.t("ui.auto.c70e585618c8"), ["class", "struct", "interface", "record", "record class", "record struct", "enum", "ref struct", "readonly struct"], "class"),
      text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "GeneratedType"),
      text("modifiers", window.RMLI18n.t("ui.auto.4a10025a59cb"), "internal sealed partial")
    ],
    inputs: [
      syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")),
      syntaxInput("typeParameters", window.RMLI18n.t("ui.literal.c9a3646a7ac5")),
      syntaxInput("primaryConstructor", window.RMLI18n.t("ui.literal.ac81030c5dc1")),
      syntaxInput("baseTypes", window.RMLI18n.t("ui.literal.e0882ab28f25")),
      syntaxInput("constraints", window.RMLI18n.t("ui.literal.52e68a873a2b")),
      syntaxInput("members", window.RMLI18n.t("ui.literal.1cb449c11266"))
    ],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "internal sealed partial"));
      const kind = parameter(ctx.node, "kind", "class");
      const name = requireIdentifier(ctx, parameter(ctx.node, "name", window.RMLI18n.t("ui.literal.d623f6f1bce4")), "type name");
      const typeParameters = ctx.input("typeParameters").trim();
      const primaryConstructor = ctx.input("primaryConstructor").trim();
      const bases = ctx.input("baseTypes").trim();
      const constraints = ctx.input("constraints").trim();
      const members = ctx.input("members");
      return `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${kind} ${name}${typeParameters ? `<${typeParameters}>` : ""}${primaryConstructor ? `(${primaryConstructor})` : ""}${bases ? ` : ${bases}` : ""}${constraints ? `\n${constraints}` : ""}${block(members)}`;
    }
  });

  registerSyntaxNode("csharp.method", {
    title: window.RMLI18n.t("ui.auto.a5662fe78026"),
    group: GROUPS.declarations,
    symbol: "METHOD",
    parameters: [
      text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "Method"),
      text("returnType", window.RMLI18n.t("ui.auto.bf84982b1cb6"), "void"),
      text("modifiers", window.RMLI18n.t("ui.auto.4a10025a59cb"), "private static"),
      select("bodyStyle", window.RMLI18n.t("ui.auto.ec672784079b"), ["block", "expression", "semicolon"], "block")
    ],
    inputs: [
      syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")), syntaxInput("typeParameters", window.RMLI18n.t("ui.literal.c9a3646a7ac5")),
      syntaxInput("parameters", window.RMLI18n.t("ui.literal.a975eea30db9")), syntaxInput("constraints", window.RMLI18n.t("ui.literal.52e68a873a2b")),
      syntaxInput("body", window.RMLI18n.t("ui.literal.c447a4158eaf"))
    ],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "private static"));
      const returnType = parameter(ctx.node, "returnType", "void").trim() === "void" ? "void" : requireType(ctx, parameter(ctx.node, "returnType", "void"));
      const name = requireIdentifier(ctx, parameter(ctx.node, "name", window.RMLI18n.t("ui.auto.138927ca2c78")), "method name");
      const typeParameters = ctx.input("typeParameters").trim();
      const parameters = ctx.input("parameters").trim();
      const constraints = ctx.input("constraints").trim();
      const body = ctx.input("body");
      const signature = `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${returnType} ${name}${typeParameters ? `<${typeParameters}>` : ""}(${parameters})${constraints ? `\n${constraints}` : ""}`;
      const style = parameter(ctx.node, "bodyStyle", "block");
      if (style === "semicolon") return `${signature};`;
      if (style === "expression") return `${signature} => ${body || "default"};`;
      return `${signature}${block(body)}`;
    }
  });

  registerSyntaxNode("csharp.constructor", {
    title: window.RMLI18n.t("ui.auto.001f9d4bacde"),
    group: GROUPS.declarations,
    symbol: "CTOR",
    parameters: [
      text("name", window.RMLI18n.t("ui.auto.0d1b1696d604"), "GeneratedType"),
      text("modifiers", window.RMLI18n.t("ui.auto.4a10025a59cb"), "public"),
      bool("destructor", window.RMLI18n.t("ui.auto.b18ae9b6a2f5"), false),
      select("initializer", window.RMLI18n.t("ui.auto.bb8835da9f7c"), ["none", "base", "this"], "none")
    ],
    inputs: [syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")), syntaxInput("parameters", window.RMLI18n.t("ui.literal.a975eea30db9")), syntaxInput("initializerArguments", window.RMLI18n.t("ui.literal.1e958593220c")), syntaxInput("body", window.RMLI18n.t("ui.auto.ec672784079b"))],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const name = requireIdentifier(ctx, parameter(ctx.node, "name", window.RMLI18n.t("ui.literal.d623f6f1bce4")), "type name");
      const destructor = parameter(ctx.node, "destructor", false);
      const mods = destructor ? "" : requireModifiers(ctx, parameter(ctx.node, "modifiers", "public"));
      const init = destructor ? "none" : parameter(ctx.node, "initializer", "none");
      return `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${destructor ? "~" : ""}${name}(${destructor ? "" : ctx.input("parameters").trim()})${init === "none" ? "" : ` : ${init}(${ctx.input("initializerArguments").trim()})`}${block(ctx.input("body"))}`;
    }
  });

  registerSyntaxNode("csharp.field", {
    title: window.RMLI18n.t("ui.auto.a4ca6c4409fa"),
    group: GROUPS.declarations,
    symbol: "FIELD",
    parameters: [
      text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "_value"), text("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "object"),
      text("modifiers", window.RMLI18n.t("ui.auto.4a10025a59cb"), "private static"), bool("constant", window.RMLI18n.t("ui.auto.5c545273204d"), false)
    ],
    inputs: [syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")), syntaxInput("initializer", window.RMLI18n.t("ui.auto.bb8835da9f7c"))],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "private static"));
      const initializer = ctx.input("initializer").trim();
      return `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${parameter(ctx.node, "constant", false) ? "const " : ""}${requireType(ctx, parameter(ctx.node, "type", "object"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "_value"), "field name")}${initializer ? ` = ${initializer}` : ""};`;
    }
  });

  registerSyntaxNode("csharp.property", {
    title: window.RMLI18n.t("ui.auto.10a65cb1e08b"),
    group: GROUPS.declarations,
    symbol: "PROP",
    parameters: [
      text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "Value"), text("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "object"),
      text("modifiers", window.RMLI18n.t("ui.auto.4a10025a59cb"), "public"), bool("indexer", window.RMLI18n.t("ui.auto.fb6f088ade22"), false),
      select("bodyStyle", window.RMLI18n.t("ui.auto.ec672784079b"), ["accessors", "expression"], "accessors")
    ],
    inputs: [syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")), syntaxInput("parameters", window.RMLI18n.t("ui.literal.e93cc0beb002")), syntaxInput("body", window.RMLI18n.t("ui.literal.2c797e13c66f")), syntaxInput("initializer", window.RMLI18n.t("ui.auto.bb8835da9f7c"))],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "public"));
      const name = parameter(ctx.node, "indexer", false) ? `this[${ctx.input("parameters").trim()}]` : requireIdentifier(ctx, parameter(ctx.node, "name", window.RMLI18n.t("ui.auto.3b53ce63a0cc")), "property name");
      const header = `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${requireType(ctx, parameter(ctx.node, "type", "object"))} ${name}`;
      const initializer = ctx.input("initializer").trim();
      if (parameter(ctx.node, "bodyStyle", "accessors") === "expression") return `${header} => ${ctx.input("body") || "default"};`;
      return `${header}${block(ctx.input("body") || "get;\nset;")}${initializer ? ` = ${initializer};` : ""}`;
    }
  });

  registerSyntaxNode("csharp.accessor", {
    title: window.RMLI18n.t("ui.auto.9798ec3fa4b2"),
    group: GROUPS.declarations,
    symbol: "GET",
    parameters: [
      select("kind", window.RMLI18n.t("ui.auto.c70e585618c8"), ["get", "set", "init", "add", "remove"], "get"),
      text("modifiers", window.RMLI18n.t("ui.auto.4a10025a59cb"), ""),
      select("bodyStyle", window.RMLI18n.t("ui.auto.ec672784079b"), ["semicolon", "block", "expression"], "semicolon")
    ],
    inputs: [syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")), syntaxInput("body", window.RMLI18n.t("ui.literal.c447a4158eaf"))],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", ""));
      const head = `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${parameter(ctx.node, "kind", "get")}`;
      const style = parameter(ctx.node, "bodyStyle", "semicolon");
      if (style === "semicolon") return `${head};`;
      if (style === "expression") return `${head} => ${ctx.input("body") || "default"};`;
      return `${head}${block(ctx.input("body"))}`;
    }
  });

  registerSyntaxNode("csharp.event", {
    title: window.RMLI18n.t("ui.auto.9162bc274ebc"),
    group: GROUPS.declarations,
    symbol: "EVENT",
    parameters: [text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "Changed"), text("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "System.Action"), text("modifiers", window.RMLI18n.t("ui.auto.4a10025a59cb"), "public")],
    inputs: [syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")), syntaxInput("accessors", window.RMLI18n.t("ui.literal.f5b0e226ed89")), syntaxInput("initializer", window.RMLI18n.t("ui.auto.bb8835da9f7c"))],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "public"));
      const header = `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}event ${requireType(ctx, parameter(ctx.node, "type", "System.Action"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", window.RMLI18n.t("ui.auto.a1009bcfc203")), "event name")}`;
      const accessors = ctx.input("accessors").trim();
      const initializer = ctx.input("initializer").trim();
      return accessors ? `${header}${block(accessors)}` : `${header}${initializer ? ` = ${initializer}` : ""};`;
    }
  });

  registerSyntaxNode("csharp.delegate", {
    title: window.RMLI18n.t("ui.auto.3876b13ca14e"),
    group: GROUPS.declarations,
    symbol: "λ",
    parameters: [text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "Handler"), text("returnType", window.RMLI18n.t("ui.auto.bf84982b1cb6"), "void"), text("modifiers", window.RMLI18n.t("ui.auto.4a10025a59cb"), "public")],
    inputs: [syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")), syntaxInput("typeParameters", window.RMLI18n.t("ui.literal.c9a3646a7ac5")), syntaxInput("parameters", window.RMLI18n.t("ui.literal.a975eea30db9")), syntaxInput("constraints", window.RMLI18n.t("ui.literal.52e68a873a2b"))],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "public"));
      const returnType = parameter(ctx.node, "returnType", "void") === "void" ? "void" : requireType(ctx, parameter(ctx.node, "returnType", "void"));
      const types = ctx.input("typeParameters").trim();
      const constraints = ctx.input("constraints").trim();
      return `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}delegate ${returnType} ${requireIdentifier(ctx, parameter(ctx.node, "name", window.RMLI18n.t("ui.literal.be0212bf3331")), "delegate name")}${types ? `<${types}>` : ""}(${ctx.input("parameters").trim()})${constraints ? `\n${constraints}` : ""};`;
    }
  });

  registerSyntaxNode("csharp.enumMember", {
    title: window.RMLI18n.t("ui.auto.b2e1ad09f477"),
    group: GROUPS.declarations,
    symbol: "ENUM",
    parameters: [text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "Value")],
    inputs: [syntaxInput("attributes", window.RMLI18n.t("ui.literal.a6652617f2c7")), syntaxInput("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"))],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const value = ctx.input("value").trim();
      return `${attrs ? `${attrs}\n` : ""}${requireIdentifier(ctx, parameter(ctx.node, "name", window.RMLI18n.t("ui.auto.3b53ce63a0cc")), "enum member")}${value ? ` = ${value}` : ""}`;
    }
  });

  const expressionNode = (id, title, symbol, parameters, inputs, renderer) =>
    registerSyntaxNode(id, { title, group: GROUPS.expressions, symbol, parameters, inputs, syntaxRender: renderer });

  registerSyntaxNode("csharp.qualifiedAccess", {
    title: window.RMLI18n.t("ui.auto.1c2c9b4199b9"),
    group: GROUPS.expressions,
    symbol: "A.B",
    parameters: [text("path", window.RMLI18n.t("ui.auto.1adc174a2266"), "value.Member")],
    syntaxRender(ctx) {
      return requireQualifiedName(ctx, parameter(ctx.node, "path", "value.Member"), "qualified member path");
    }
  });
  registerSyntaxNode("csharp.compactInvocation", {
    title: window.RMLI18n.t("ui.auto.9863e1a07cec"),
    group: GROUPS.expressions,
    symbol: "CALL",
    parameters: [
      text("target", window.RMLI18n.t("ui.auto.7ea28c27275e"), "Method"),
      number("variadicInputCount", window.RMLI18n.t("ui.auto.8fb10588ee18"), 2)
    ],
    inputs: [syntaxInput("a", window.RMLI18n.t("ui.literal.ab58190a60e6")), syntaxInput("b", window.RMLI18n.t("ui.literal.f5f180cc7638"))],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 512,
      template: syntaxInput("a", window.RMLI18n.t("ui.literal.ab58190a60e6"))
    },
    syntaxRender(ctx) {
      const target = String(parameter(ctx.node, "target", window.RMLI18n.t("ui.auto.138927ca2c78"))).trim();
      if (!TYPE_TEXT.test(target)) {
        ctx.diagnostic(`${ctx.title}: '${target}' is not a valid qualified or generic invocation target.`);
        return "__invalid_call()";
      }
      const argumentsList = ctx.variadic().map(value => value.trim()).filter(Boolean);
      return `${target}(${argumentsList.join(", ")})`;
    }
  });
  registerSyntaxNode("csharp.conditionalInvocation", {
    title: window.RMLI18n.t("ui.auto.5ef665e1847f"),
    group: GROUPS.expressions,
    symbol: "?.()",
    parameters: [
      text("target", window.RMLI18n.t("ui.auto.4f075fc786b5"), "value"),
      text("member", window.RMLI18n.t("ui.auto.69a1eabe6e5f"), "Method"),
      number("variadicInputCount", window.RMLI18n.t("ui.auto.8fb10588ee18"), 2)
    ],
    inputs: [syntaxInput("a", window.RMLI18n.t("ui.literal.ab58190a60e6")), syntaxInput("b", window.RMLI18n.t("ui.literal.f5f180cc7638"))],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 512,
      template: syntaxInput("a", window.RMLI18n.t("ui.literal.ab58190a60e6"))
    },
    syntaxRender(ctx) {
      const target = requireQualifiedName(ctx, parameter(ctx.node, "target", "value"), "conditional target");
      const member = requireIdentifier(ctx, parameter(ctx.node, "member", window.RMLI18n.t("ui.auto.138927ca2c78")), "conditional member");
      const argumentsList = ctx.variadic().map(value => value.trim()).filter(Boolean);
      return `${target}?.${member}(${argumentsList.join(", ")})`;
    }
  });
  expressionNode("csharp.memberAccess", window.RMLI18n.t("ui.literal.42082a8a3faf"), ".", [], [syntaxInput("target", window.RMLI18n.t("ui.auto.ba52d97729b9")) , syntaxInput("member", window.RMLI18n.t("ui.auto.69a1eabe6e5f"))], ctx => `${ctx.input("target")}.${ctx.input("member")}`);
  expressionNode("csharp.conditionalAccess", window.RMLI18n.t("ui.literal.83ba963918b3"), "?.", [], [syntaxInput("target", window.RMLI18n.t("ui.auto.ba52d97729b9")), syntaxInput("access", window.RMLI18n.t("ui.literal.2f81a22de0af"))], ctx => `${ctx.input("target")}?.${ctx.input("access")}`);
  expressionNode("csharp.invocation", window.RMLI18n.t("ui.literal.6a9b44369c96"), "()", [], [syntaxInput("target", window.RMLI18n.t("ui.auto.ba52d97729b9")), syntaxInput("typeArguments", window.RMLI18n.t("ui.literal.e35e3a28b52f")), syntaxInput("arguments", window.RMLI18n.t("ui.auto.cda21d9622e7"))], ctx => `${ctx.input("target")}${ctx.input("typeArguments").trim() ? `<${ctx.input("typeArguments").trim()}>` : ""}(${ctx.input("arguments")})`);
  expressionNode("csharp.argument", window.RMLI18n.t("ui.literal.ce5e5792e97f"), window.RMLI18n.t("ui.literal.8bf4bfe19973"), [select("modifier", window.RMLI18n.t("ui.auto.e414b0062d6d"), ["none", "ref", "out", "in"], "none"), text("name", window.RMLI18n.t("ui.auto.3794a77dd242"), "")], [syntaxInput("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"))], ctx => `${String(parameter(ctx.node, "name", "")).trim() ? `${requireIdentifier(ctx, parameter(ctx.node, "name", ""), "argument name")}: ` : ""}${parameter(ctx.node, "modifier", "none") === "none" ? "" : `${parameter(ctx.node, "modifier")} `}${ctx.input("value")}`);
  expressionNode("csharp.objectCreation", window.RMLI18n.t("ui.literal.08eb3d45be71"), window.RMLI18n.t("ui.literal.66aabd91fc41"), [text("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "object"), select("kind", window.RMLI18n.t("ui.auto.c70e585618c8"), ["object", "implicitObject", "array", "implicitArray", "stackalloc"], "object")], [syntaxInput("arguments", window.RMLI18n.t("ui.literal.798f7fca9ed7")), syntaxInput("initializer", window.RMLI18n.t("ui.auto.bb8835da9f7c"))], ctx => {
    const kind = parameter(ctx.node, "kind", "object");
    const args = ctx.input("arguments");
    const init = ctx.input("initializer").trim();
    if (kind === "implicitObject") return `new(${args})${init ? ` { ${init} }` : ""}`;
    if (kind === "implicitArray") return `new[]${init ? ` { ${init} }` : " { }"}`;
    if (kind === "stackalloc") { ctx.requireUnsafe(); return `stackalloc ${requireType(ctx, parameter(ctx.node, "type", "object"))}[${args}]${init ? ` { ${init} }` : ""}`; }
    if (kind === "array") return `new ${requireType(ctx, parameter(ctx.node, "type", "object"))}[${args}]${init ? ` { ${init} }` : ""}`;
    return `new ${requireType(ctx, parameter(ctx.node, "type", "object"))}(${args})${init ? ` { ${init} }` : ""}`;
  });
  expressionNode("csharp.elementAccess", window.RMLI18n.t("ui.literal.cb087a6bd22b"), "[]", [], [syntaxInput("target", window.RMLI18n.t("ui.auto.ba52d97729b9")), syntaxInput("arguments", window.RMLI18n.t("ui.auto.cda21d9622e7"))], ctx => `${ctx.input("target")}[${ctx.input("arguments")}]`);
  expressionNode("csharp.binary", window.RMLI18n.t("ui.literal.3116d6f1f590"), "A+B", [select("operator", window.RMLI18n.t("ui.auto.47de07e127ff"), ["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "&&", "||", "&", "|", "^", "<<", ">>", "??", "is", "as", "and", "or", ".."], "+")], [syntaxInput("left", window.RMLI18n.t("ui.literal.8ae1c34bd37f")), syntaxInput("right", window.RMLI18n.t("ui.literal.954daa8b0033"))], ctx => `(${ctx.input("left")} ${parameter(ctx.node, "operator", "+")} ${ctx.input("right")})`);
  expressionNode("csharp.unary", window.RMLI18n.t("ui.literal.ab66f5b52c39"), "!A", [select("operator", window.RMLI18n.t("ui.auto.47de07e127ff"), ["+", "-", "!", "~", "++pre", "--pre", "++post", "--post", "&", "*", "^", "not", "await", "checked", "unchecked"], "!")], [syntaxInput("operand", window.RMLI18n.t("ui.literal.ff04060b9cdf"))], ctx => {
    const op = parameter(ctx.node, "operator", "!");
    const statementExpression = ctx.renderMode === "statementExpression";
    if (["&", "*"].includes(op)) ctx.requireUnsafe();
    if (op.endsWith("post")) return statementExpression ? `${ctx.input("operand")}${op.slice(0, 2)}` : `(${ctx.input("operand")}${op.slice(0, 2)})`;
    if (op.endsWith("pre")) return statementExpression ? `${op.slice(0, 2)}${ctx.input("operand")}` : `(${op.slice(0, 2)}${ctx.input("operand")})`;
    if (op === "await") return statementExpression ? `await ${ctx.input("operand")}` : `(await ${ctx.input("operand")})`;
    if (op === "not") return `(not ${ctx.input("operand")})`;
    if (["checked", "unchecked"].includes(op)) return `${op}(${ctx.input("operand")})`;
    return `(${op}${ctx.input("operand")})`;
  });
  expressionNode("csharp.assignment", window.RMLI18n.t("ui.literal.e55df441e895"), "=", [select("operator", window.RMLI18n.t("ui.auto.47de07e127ff"), ["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>=", "??="], "=")], [syntaxInput("target", window.RMLI18n.t("ui.auto.ba52d97729b9")), syntaxInput("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"))], ctx => `${ctx.input("target")} ${parameter(ctx.node, "operator", "=")} ${ctx.input("value")}`);
  expressionNode("csharp.conditional", window.RMLI18n.t("ui.literal.43cbd1cdde9b"), "?:", [], [syntaxInput("condition", window.RMLI18n.t("ui.auto.6756b63c2646")), syntaxInput("true", window.RMLI18n.t("ui.auto.2bafb66af5d9")), syntaxInput("false", window.RMLI18n.t("ui.text.97cdbdc7feff"))], ctx => `(${ctx.input("condition")} ? ${ctx.input("true")} : ${ctx.input("false")})`);
  expressionNode("csharp.cast", window.RMLI18n.t("ui.literal.60745aef336b"), "(T)", [text("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "object")], [syntaxInput("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc"))], ctx => `((${requireType(ctx, parameter(ctx.node, "type", "object"))})${ctx.input("value")})`);
  expressionNode("csharp.keywordExpression", window.RMLI18n.t("ui.literal.4c272a2a95d2"), "KW", [select("keyword", window.RMLI18n.t("ui.auto.63263ecca916"), ["typeof", "nameof", "sizeof", "default", "checked", "unchecked"], "typeof")], [syntaxInput("value", window.RMLI18n.t("ui.literal.8ad8cf91e37d"))], ctx => {
    if (parameter(ctx.node, "keyword", "typeof") === "sizeof") ctx.requireUnsafe();
    return `${parameter(ctx.node, "keyword", "typeof")}(${ctx.input("value")})`;
  });
  expressionNode("csharp.lambda", window.RMLI18n.t("ui.literal.4f4b916bb713"), "λ", [select("kind", window.RMLI18n.t("ui.auto.c70e585618c8"), ["lambda", "anonymous"], "lambda"), text("modifiers", window.RMLI18n.t("ui.auto.4a10025a59cb"), ""), bool("expressionBody", window.RMLI18n.t("ui.auto.2bf5c1862105"), false)], [syntaxInput("parameters", window.RMLI18n.t("ui.literal.a975eea30db9")), syntaxInput("body", window.RMLI18n.t("ui.auto.ec672784079b"))], ctx => {
    const modifiers = String(parameter(ctx.node, "modifiers", "")).trim();
    const body = ctx.input("body");
    if (parameter(ctx.node, "kind", "lambda") === "anonymous") return `${modifiers ? `${modifiers} ` : ""}delegate(${ctx.input("parameters")})${block(body)}`;
    return `${modifiers ? `${modifiers} ` : ""}(${ctx.input("parameters")}) => ${parameter(ctx.node, "expressionBody", false) ? body : block(body)}`;
  });
  expressionNode("csharp.interpolatedString", window.RMLI18n.t("ui.literal.c05b4410b362"), "$\"\"", [text("format", window.RMLI18n.t("ui.auto.baba06537c16"), "Value: {0}")], [syntaxInput("arguments", window.RMLI18n.t("ui.literal.ee4bef192471"))], ctx => `string.Format(System.Globalization.CultureInfo.InvariantCulture, "${escapeString(parameter(ctx.node, "format", ""))}", ${ctx.input("arguments")})`);

  const statementNode = (id, title, symbol, parameters, inputs, renderer) =>
    registerSyntaxNode(id, { title, group: GROUPS.statements, symbol, parameters, inputs, syntaxRender: renderer });

  statementNode("csharp.block", window.RMLI18n.t("ui.literal.82dd2cdf36f9"), "{}", [], [syntaxInput("statements", window.RMLI18n.t("ui.literal.5653cebc057d"))], ctx => `{\n${indent(ctx.input("statements"))}\n}`);
  statementNode("csharp.expressionStatement", window.RMLI18n.t("ui.literal.d9c4f2202566"), window.RMLI18n.t("ui.literal.8da01525e240"), [], [syntaxInput("expression", window.RMLI18n.t("ui.auto.0822f96b587d"))], ctx => statement(ctx.input("expression", "statementExpression")));
  statementNode("csharp.localDeclaration", window.RMLI18n.t("ui.literal.ac6a378359d9"), window.RMLI18n.t("ui.literal.41fdf9c71f9b"), [text("type", window.RMLI18n.t("ui.auto.c9b8f9dc7b1e"), "var"), text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "value"), select("modifier", window.RMLI18n.t("ui.auto.e414b0062d6d"), ["none", "const", "using", "await using", "ref", "ref readonly", "scoped", "scoped ref"], "none"), bool("omitSemicolon", window.RMLI18n.t("ui.auto.59dc6598ce8a"), false)], [syntaxInput("initializer", window.RMLI18n.t("ui.auto.bb8835da9f7c"))], ctx => `${parameter(ctx.node, "modifier", "none") === "none" ? "" : `${parameter(ctx.node, "modifier")} `}${parameter(ctx.node, "type", "var") === "var" ? "var" : requireType(ctx, parameter(ctx.node, "type", "object"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "value"), "local name")}${ctx.input("initializer").trim() ? ` = ${ctx.input("initializer")}` : ""}${parameter(ctx.node, "omitSemicolon", false) ? "" : ";"}`);
  statementNode("csharp.jump", window.RMLI18n.t("ui.literal.9b21187b25dd"), window.RMLI18n.t("ui.literal.bb0d79b578ec"), [select("kind", window.RMLI18n.t("ui.auto.c70e585618c8"), ["return", "yield return", "yield break", "throw", "break", "continue", "goto", "goto case", "goto default"], "return")], [syntaxInput("value", window.RMLI18n.t("ui.literal.f80a3547f8cd"))], ctx => {
    const kind = parameter(ctx.node, "kind", "return");
    const value = ctx.input("value").trim();
    if (["break", "continue", "yield break", "goto default"].includes(kind)) return `${kind};`;
    return `${kind}${value ? ` ${value}` : ""};`;
  });
  statementNode("csharp.if", window.RMLI18n.t("ui.literal.f6c2455d6057"), "IF", [], [syntaxInput("condition", window.RMLI18n.t("ui.auto.6756b63c2646")), syntaxInput("then", window.RMLI18n.t("ui.literal.b7d93209feaa")), syntaxInput("else", window.RMLI18n.t("ui.literal.a9c075ef1bb9"))], ctx => `if (${ctx.input("condition")})${block(ctx.input("then"))}${ctx.input("else").trim() ? `\nelse${block(ctx.input("else"))}` : ""}`);
  statementNode("csharp.switch", window.RMLI18n.t("ui.literal.58396edf12d2"), window.RMLI18n.t("ui.literal.b02cbd93fe45"), [bool("expression", window.RMLI18n.t("ui.auto.3fd6e1d60d9d"), false)], [syntaxInput("value", window.RMLI18n.t("ui.auto.3b53ce63a0cc")), syntaxInput("sections", window.RMLI18n.t("ui.literal.ce8035fdd075"))], ctx => parameter(ctx.node, "expression", false) ? `${ctx.input("value")} switch\n{\n${indent(ctx.input("sections"))}\n}` : `switch (${ctx.input("value")})${block(ctx.input("sections"))}`);
  statementNode("csharp.switchSection", window.RMLI18n.t("ui.literal.269bb672c92a"), window.RMLI18n.t("ui.literal.55c417bda058"), [bool("expressionArm", window.RMLI18n.t("ui.auto.b8ed20d8061d"), false), bool("default", window.RMLI18n.t("ui.auto.942c1e1b2cef"), false)], [syntaxInput("pattern", window.RMLI18n.t("ui.literal.c3a9fd825f84")), syntaxInput("when", window.RMLI18n.t("ui.literal.769bb19e615b")), syntaxInput("body", window.RMLI18n.t("ui.literal.eca0eeacb70c"))], ctx => {
    const label = parameter(ctx.node, "default", false) ? "default" : ctx.input("pattern");
    const when = ctx.input("when").trim();
    return parameter(ctx.node, "expressionArm", false)
      ? `${label}${when ? ` when ${when}` : ""} => ${ctx.input("body")},`
      : `${parameter(ctx.node, "default", false) ? "default" : `case ${label}`}${when ? ` when ${when}` : ""}:\n${indent(ctx.input("body"))}`;
  });
  statementNode("csharp.loop", window.RMLI18n.t("ui.literal.dc7f77b4ccfc"), window.RMLI18n.t("ui.literal.300a061f8ce5"), [select("kind", window.RMLI18n.t("ui.auto.c70e585618c8"), ["while", "do", "for", "foreach", "await foreach"], "while"), text("iterator", window.RMLI18n.t("ui.auto.3f57bf250986"), "item"), text("iteratorType", window.RMLI18n.t("ui.auto.b987338bea18"), "var")], [syntaxInput("initializer", window.RMLI18n.t("ui.literal.f54fe4e82421")), syntaxInput("condition", window.RMLI18n.t("ui.literal.81ad71a77701")), syntaxInput("increment", window.RMLI18n.t("ui.literal.9d9bdee42654")), syntaxInput("body", window.RMLI18n.t("ui.auto.ec672784079b"))], ctx => {
    const kind = parameter(ctx.node, "kind", "while");
    if (kind === "do") return `do${block(ctx.input("body"))}\nwhile (${ctx.input("condition")});`;
    if (kind === "for") return `for (${ctx.input("initializer", "statementExpression")}; ${ctx.input("condition")}; ${ctx.input("increment", "statementExpression")})${block(ctx.input("body"))}`;
    if (kind.includes("foreach")) {
      const type = parameter(ctx.node, "iteratorType", "var") === "var" ? "var" : requireType(ctx, parameter(ctx.node, "iteratorType", "var"));
      return `${kind} (${type} ${requireIdentifier(ctx, parameter(ctx.node, "iterator", "item"), "iterator name")} in ${ctx.input("condition")})${block(ctx.input("body"))}`;
    }
    return `while (${ctx.input("condition")})${block(ctx.input("body"))}`;
  });
  statementNode("csharp.try", window.RMLI18n.t("ui.auto.ca3d4ff841bd"), window.RMLI18n.t("ui.literal.51baf72a383a"), [], [syntaxInput("body", window.RMLI18n.t("ui.literal.9341f0206a50")), syntaxInput("catches", window.RMLI18n.t("ui.literal.b38cd9fecf09")), syntaxInput("finally", window.RMLI18n.t("ui.literal.6eb97eea635e"))], ctx => `try${block(ctx.input("body"))}${ctx.input("catches").trim() ? `\n${ctx.input("catches")}` : ""}${ctx.input("finally").trim() ? `\nfinally${block(ctx.input("finally"))}` : ""}`);
  statementNode("csharp.catch", window.RMLI18n.t("ui.literal.fc01f40fb7ed"), window.RMLI18n.t("ui.literal.5e5312ba58e8"), [text("type", window.RMLI18n.t("ui.auto.ae5d029d6170"), "System.Exception"), text("name", window.RMLI18n.t("ui.auto.f0c942d9a69e"), "exception"), bool("catchAll", window.RMLI18n.t("ui.auto.a4efe4780b40"), false)], [syntaxInput("filter", window.RMLI18n.t("ui.literal.d7decf1aa22b")), syntaxInput("body", window.RMLI18n.t("ui.auto.ec672784079b"))], ctx => `catch${parameter(ctx.node, "catchAll", false) ? "" : ` (${requireType(ctx, parameter(ctx.node, "type", "System.Exception"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "exception"), "exception variable")})`}${ctx.input("filter").trim() ? ` when (${ctx.input("filter")})` : ""}${block(ctx.input("body"))}`);
  statementNode("csharp.resourceStatement", window.RMLI18n.t("ui.literal.ffb8de116a81"), window.RMLI18n.t("ui.literal.0844e3b928d2"), [select("kind", window.RMLI18n.t("ui.auto.c70e585618c8"), ["using", "await using", "lock", "fixed", "checked", "unchecked", "unsafe"], "using")], [syntaxInput("resource", window.RMLI18n.t("ui.literal.d077736c725d")), syntaxInput("body", window.RMLI18n.t("ui.auto.ec672784079b"))], ctx => {
    const kind = parameter(ctx.node, "kind", "using");
    if (["fixed", "unsafe"].includes(kind)) ctx.requireUnsafe();
    if (["checked", "unchecked", "unsafe"].includes(kind)) return `${kind}${block(ctx.input("body"))}`;
    return `${kind} (${ctx.input("resource")})${block(ctx.input("body"))}`;
  });
  statementNode("csharp.label", window.RMLI18n.t("ui.literal.74341e3c271d"), window.RMLI18n.t("ui.literal.64b8a7e20b4f"), [text("name", window.RMLI18n.t("ui.auto.8e88786eb305"), "label")], [syntaxInput("statement", window.RMLI18n.t("ui.literal.a72ca256dc49"))], ctx => `${requireIdentifier(ctx, parameter(ctx.node, "name", "label"), "label")}:${ctx.input("statement") ? `\n${indent(ctx.input("statement"))}` : ""}`);

  function variadicIds(node) {
    const count = Math.max(2, Math.min(512, Number(parameter(node, "variadicInputCount", 2)) || 2));
    return Array.from({ length: count }, (_, index) => index < 26 ? String.fromCharCode(97 + index) : `input${index + 1}`);
  }

  function renderCustomCSharpGraph(customGraph) {
    const nodes = Array.isArray(customGraph?.nodes) ? customGraph.nodes : [];
    const connections = Array.isArray(customGraph?.connections) ? customGraph.connections : [];
    const outputNodeId = String(customGraph?.outputNodeId || "");
    const incoming = new Map(connections.map(item => [`${item.toNode}:${item.toPort}`, item]));
    const outputConnection = incoming.get(`${outputNodeId}:content`);
    const nodeById = new Map(nodes.map(node => [node.id, node]));
    const diagnostics = [];
    const cache = new Map();
    const stack = new Set();
    const renderNode = (nodeId, renderMode = "") => {
      if (!nodeId) return "";
      const cacheKey = `${nodeId}\u0000${renderMode}`;
      if (cache.has(cacheKey)) return cache.get(cacheKey);
      if (stack.has(nodeId)) {
        diagnostics.push(`Visual C# syntax cycle detected at node '${nodeId}'.`);
        return "";
      }
      const node = nodeById.get(nodeId);
      const definition = node ? getNodeDefinition(node.operatorId) : null;
      if (!node || typeof definition?.syntaxRender !== "function") {
        diagnostics.push(`Visual C# syntax references unavailable node '${nodeId}'.`);
        return "";
      }
      stack.add(nodeId);
      const input = (id, childRenderMode = "") => {
        const connection = incoming.get(`${node.id}:${id}`);
        return connection ? renderNode(connection.fromNode, childRenderMode) : "";
      };
      const context = {
        node,
        title: definition.title || node.operatorId,
        renderMode,
        input,
        graphValue(id) {
          diagnostics.push(`${definition.title}: Runtime Graph value input '${id}' is unavailable inside an isolated Custom C# File graph.`);
          return "default";
        },
        variadic: (childRenderMode = "") => variadicIds(node).map(id => input(id, childRenderMode)),
        diagnostic: message => diagnostics.push(String(message)),
        requireUnsafe() {}
      };
      let result = "";
      try {
        result = normalize(definition.syntaxRender(context));
      } catch (error) {
        diagnostics.push(`${context.title}: visual C# rendering failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      stack.delete(nodeId);
      cache.set(cacheKey, result);
      return result;
    };
    if (!outputConnection) {
      diagnostics.push(window.RMLI18n.t("ui.literal.036ff2d72d21"));
      return { ok: false, source: "", diagnostics };
    }
    const source = renderNode(outputConnection.fromNode);
    return { ok: diagnostics.length === 0, source, diagnostics };
  }

  registerCodegenPlugin({
    id: "visual-csharp14-complete-syntax-v2",
    collect(api) {
      const nodes = Array.isArray(api.nodes) ? api.nodes : api.graph?.nodes || [];
      const incoming = api.incoming instanceof Map ? api.incoming : new Map();
      let unsafeRequired = false;

      const createSyntaxRenderer = (localNodes, localIncoming, allowRuntimeValues) => {
        const localNodeById = new Map(localNodes.map(node => [node.id, node]));
        const cache = new Map();
        const stack = new Set();
        const renderNode = (nodeId, renderMode = "") => {
          if (!nodeId) return "";
          const cacheKey = `${nodeId}\u0000${renderMode}`;
          if (cache.has(cacheKey)) return cache.get(cacheKey);
          if (stack.has(nodeId)) {
            api.diagnostic(`Visual C# syntax cycle detected at node '${nodeId}'.`);
            return "";
          }
          const node = localNodeById.get(nodeId);
          const definition = node ? getNodeDefinition(node.operatorId) : null;
          if (!node || typeof definition?.syntaxRender !== "function") {
            api.diagnostic(`Visual C# syntax references unavailable node '${nodeId}'.`);
            return "";
          }
          stack.add(nodeId);
          const input = (id, childRenderMode = "") => {
            const connection = localIncoming.get(`${node.id}:${id}`);
            return connection ? renderNode(connection.fromNode, childRenderMode) : "";
          };
          const context = {
            node,
            title: definition.title || node.operatorId,
            renderMode,
            input,
            graphValue(id) {
              const connection = localIncoming.get(`${node.id}:${id}`);
              if (!connection) {
                api.diagnostic(`${definition.title}: '${id}' is not connected to a typed graph value.`);
                return "default";
              }
              if (!allowRuntimeValues) {
                api.diagnostic(`${definition.title}: Runtime Graph value inputs are not available inside an isolated Custom C# File graph. Use visual C# syntax nodes for the value.`);
                return "default";
              }
              const expression = api.output(connection.fromNode, connection.fromPort);
              return String(expression?.code || "default");
            },
            variadic: (childRenderMode = "") => variadicIds(node).map(id => input(id, childRenderMode)),
            diagnostic: message => api.diagnostic(message),
            requireUnsafe() { unsafeRequired = true; }
          };
          let result = "";
          try {
            result = normalize(definition.syntaxRender(context));
          } catch (error) {
            api.diagnostic(`${context.title}: visual C# rendering failed: ${error instanceof Error ? error.message : String(error)}`);
          }
          stack.delete(nodeId);
          cache.set(cacheKey, result);
          return result;
        };
        return renderNode;
      };

      const renderMainNode = createSyntaxRenderer(nodes, incoming, true);

      const fileNodes = nodes.filter(node =>
        node?.operatorId === "csharp.file" &&
        !CUSTOM_CSHARP_RUNTIME_MODES.has(
          String(node?.parameters?.mode || "file")
        )
      );
      const projectNodes = nodes.filter(node => node?.operatorId === "csharp.project");
      const projectById = new Map();
      for (const node of projectNodes) {
        const id = String(parameter(node, "projectId", "main")).trim() || "main";
        if (projectById.has(id)) api.diagnostic(`Visual C# Project Id '${id}' is declared more than once.`);
        else projectById.set(id, node);
      }

      const mainProject = projectById.get("main");
      if (mainProject) {
        if (parameter(mainProject, "allowUnsafeBlocks", false) === true) unsafeRequired = true;
        api.require("useWindowsForms", parameter(mainProject, "useWindowsForms", false) === true);
        api.require("usesElements", parameter(mainProject, "usesElements", true) === true);
        api.require("usesRenderiteShared", parameter(mainProject, "usesRenderiteShared", false) === true);
      }

      const resources = type => nodes.filter(node => node?.operatorId === type);
      const resourceFor = (node, projectId) => String(parameter(node, "projectId", "main")).trim() === projectId;
      const referencesFor = projectId => resources("csharp.reference").filter(node =>
        resourceFor(node, projectId) &&
        String(parameter(node, "referenceKind", "assembly")) === "assembly"
      ).map(node => ({
        include: String(parameter(node, "include", "")).trim(),
        hintPath: String(parameter(node, "hintPath", "")).trim(),
        private: parameter(node, "private", false) === true
      })).filter(item => item.include);
      const mergeAssemblyReferences = (...groups) => {
        const references = new Map();
        for (const group of groups) {
          for (const reference of Array.isArray(group) ? group : []) {
            const include = String(reference?.include || "").trim();
            if (!include) continue;
            const key = include.toLowerCase();
            const candidate = {
              include,
              hintPath: String(reference?.hintPath || "").trim(),
              private: reference?.private === true
            };
            const existing = references.get(key);
            if (!existing) {
              references.set(key, candidate);
            } else if (!existing.hintPath && candidate.hintPath) {
              references.set(key, { ...existing, hintPath: candidate.hintPath });
            }
          }
        }
        return [...references.values()];
      };
      const requiredReferencesByProject = new Map();
      const collectCustomGraphReferences = (projectId, customGraph) => {
        const required = [];
        for (const graphNode of Array.isArray(customGraph?.nodes) ? customGraph.nodes : []) {
          const definition = getNodeDefinition(graphNode?.operatorId);
          if (definition?.catalogGenerated !== true) continue;
          required.push(...(
            Array.isArray(definition.requiredAssemblyReferences)
              ? definition.requiredAssemblyReferences
              : []
          ));
        }
        requiredReferencesByProject.set(
          projectId,
          mergeAssemblyReferences(requiredReferencesByProject.get(projectId), required)
        );
      };
      const projectReferences = projectId => mergeAssemblyReferences(
        referencesFor(projectId),
        requiredReferencesByProject.get(projectId)
      );
      const packagesFor = projectId => resources("csharp.reference").filter(node =>
        resourceFor(node, projectId) &&
        String(parameter(node, "referenceKind", "assembly")) === "package"
      ).map(node => ({
        include: String(parameter(node, "include", "")).trim(), version: String(parameter(node, "version", "")).trim(),
        privateAssets: String(parameter(node, "privateAssets", "")).trim(), includeAssets: String(parameter(node, "includeAssets", "")).trim()
      })).filter(item => item.include && item.version);
      const frameworksFor = projectId => resources("csharp.reference").filter(node =>
        resourceFor(node, projectId) &&
        String(parameter(node, "referenceKind", "assembly")) === "framework"
      ).map(node => String(parameter(node, "include", "")).trim()).filter(Boolean);

      const filesByProject = new Map();
      const customFileByIdentity = new Map();
      const earlyHarmonyPresetFiles = [];
      const earlyHarmonyPatchOrders = new Set();
      let exactHarmonyPresetUsed = false;
      for (const node of fileNodes) {
        const preset = String(parameter(node, "filePreset", "blank"));
        const fileName = customCSharpPresetFileName(node);
        const projectId = preset === "harmonyEarly"
          ? "__rml_early_harmony_preset__"
          : String(parameter(node, "projectId", "main")).trim() || "main";
        const customGraph = api.graph?.customCSharpFiles?.[node.id];
        let connection;
        let renderNode = renderMainNode;
        if (
          customGraph &&
          Array.isArray(customGraph.nodes) &&
          Array.isArray(customGraph.connections)
        ) {
          const customIncoming = new Map(customGraph.connections.map(item => [
            `${item.toNode}:${item.toPort}`,
            item
          ]));
          collectCustomGraphReferences(projectId, customGraph);
          const outputNodeId = String(customGraph.outputNodeId || "");
          connection = customIncoming.get(`${outputNodeId}:content`) || null;
          renderNode = createSyntaxRenderer(customGraph.nodes, customIncoming, false);
        } else {
          connection = incoming.get(`${node.id}:content`) || null;
        }
        let body = connection
          ? renderNode(connection.fromNode)
          : customCSharpPresetSource(node);
        if (preset === "harmonyExact" || preset === "harmonyEarly") {
          const replacements = {
            MOD: api.className || "GeneratedMod",
            GRAPH: api.graphClassName || "GeneratedGraph",
            NAMESPACE: api.namespaceName || "GeneratedMod",
            NODE: "CustomCSharp"
          };
          for (const [name, value] of Object.entries(replacements)) {
            body = String(body).replaceAll(`{${name}}`, String(value));
          }
        }
        if (!body.trim()) {
          continue;
        }
        if (!/^(?![./\\])(?:(?!\.\.)[^<>:"|?*\u0000-\u001f])+\.cs$/i.test(fileName)) {
          api.diagnostic(`C# File '${fileName}' must be a safe relative .cs path.`);
          continue;
        }
        const nullable = parameter(node, "nullable", "inherit");
        const header = parameter(node, "autoGeneratedHeader", true) ? "// <auto-generated by the visual C# node graph />\n" : "";
        const nullableLine = nullable === "inherit" ? "" : `#nullable ${nullable}\n`;
        const item = {
          name: fileName,
          content: `${header}${nullableLine}${body}${body.endsWith("\n") ? "" : "\n"}`,
          type: "text/plain;charset=utf-8",
          skipHeuristicDiagnostics: true
        };
        if (preset === "harmonyExact") {
          exactHarmonyPresetUsed = true;
        }
        if (preset === "harmonyEarly") {
          earlyHarmonyPresetFiles.push(item);
          const order = Number(parameter(node, "harmonyPatchOrder", 0));
          earlyHarmonyPatchOrders.add(Number.isFinite(order) ? Math.trunc(order) : 0);
          continue;
        }
        const identity = `${projectId}\0${fileName.toLowerCase()}`;
        const existingItem = customFileByIdentity.get(identity);
        if (existingItem) {
          if (existingItem.content !== item.content) {
            api.diagnostic(`Custom C# File '${fileName}' exists more than once in project '${projectId}' with different source content. Rename one file or remove the obsolete container.`);
          }
          continue;
        }
        customFileByIdentity.set(identity, item);
        const list = filesByProject.get(projectId) || [];
        list.push(item);
        filesByProject.set(projectId, list);
      }

      if (exactHarmonyPresetUsed) {
        api.addReference({
          include: "0Harmony",
          hintPath: "$(ResonitePath)rml_libs/0Harmony.dll",
          private: false
        });
        api.addEngineInit?.("RegisterGeneratedHarmonyAttributePatches();");
      }

      if (earlyHarmonyPresetFiles.length > 0) {
        const loadOrder = Math.min(...earlyHarmonyPatchOrders);
        if (earlyHarmonyPatchOrders.size > 1) {
          api.warning?.(`All Early Harmony Patch presets are compiled into one rml_libs assembly. Their differing patch orders were reduced to the earliest value (${loadOrder}).`);
        }
        const projectName = `${api.className}.HarmonyPatches`;
        const harmonyId = `${api.namespaceName}.${projectName}`;
        api.addProject({
          id: "generated-early-harmony-patches",
          role: "rml-lib-harmony-patches",
          name: projectName,
          assemblyName: projectName,
          rootNamespace: `${api.namespaceName}.EarlyPatches`,
          folder: "EarlyHarmonyPatches",
          deployDirectory: "rml_libs",
          files: [
            {
              name: "RmlPatchAssembly.cs",
              content: `[assembly: ResoniteModLoader.RmlPatchAssembly(\n    "${String(harmonyId).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}",\n    ${loadOrder})]\n`,
              type: "text/plain;charset=utf-8",
              skipHeuristicDiagnostics: true
            },
            ...earlyHarmonyPresetFiles
          ],
          requirements: {
            allowUnsafeBlocks: unsafeRequired || parameter(mainProject, "allowUnsafeBlocks", false) === true,
            useWindowsForms: parameter(mainProject, "useWindowsForms", false) === true,
            usesElements: true,
            usesRenderiteShared: parameter(mainProject, "usesRenderiteShared", false) === true,
            references: mergeAssemblyReferences(
              [{ include: "0Harmony", hintPath: "$(ResonitePath)rml_libs/0Harmony.dll", private: false }],
              referencesFor("main").filter(reference => reference.include.toLowerCase() !== "0harmony"),
              requiredReferencesByProject.get("__rml_early_harmony_preset__")
            ),
            packageReferences: packagesFor("main"),
            frameworkReferences: frameworksFor("main")
          }
        });
      }

      for (const [projectId, files] of filesByProject) {
        if (projectId === "main") {
          for (const file of files) api.addFile(file);
          for (const reference of projectReferences(projectId)) api.addReference(reference);
          for (const packageReference of packagesFor(projectId)) api.addPackageReference(packageReference);
          for (const framework of frameworksFor(projectId)) api.addFrameworkReference(framework);
          continue;
        }
        const project = projectById.get(projectId);
        if (!project) {
          api.diagnostic(`C# File project '${projectId}' has no matching C# Project node.`);
          continue;
        }
        api.addProject({
          id: projectId,
          name: String(parameter(project, "assemblyName", projectId)).trim() || projectId,
          assemblyName: String(parameter(project, "assemblyName", projectId)).trim() || projectId,
          rootNamespace: String(parameter(project, "rootNamespace", projectId)).trim() || projectId,
          deployDirectory: parameter(project, "deployDirectory", "rml_mods"),
          files,
          requirements: {
            allowUnsafeBlocks: unsafeRequired || parameter(project, "allowUnsafeBlocks", false) === true,
            useWindowsForms: parameter(project, "useWindowsForms", false) === true,
            usesElements: parameter(project, "usesElements", true) === true,
            usesRenderiteShared: parameter(project, "usesRenderiteShared", false) === true,
            references: projectReferences(projectId),
            packageReferences: packagesFor(projectId),
            frameworkReferences: frameworksFor(projectId)
          }
        });
      }

      if (unsafeRequired) api.require("allowUnsafeBlocks");
    }
  });

  const LEXICAL_PUNCTUATORS = [...new Set([
    ...PUNCTUATORS,
    ">>>=", ">>>", "=>", "??=", "<<=", ">>=", "?.", "?[", "::", "->",
    "++", "--", "&&", "||", "??", "==", "!=", "<=", ">=", "+=", "-=",
    "*=", "/=", "%=", "&=", "|=", "^=", "<<", ">>", ".."
  ])].sort((left, right) => right.length - left.length);

  function stableHash(value) {
    let hash = 2166136261;
    for (const character of String(value || "")) {
      hash ^= character.codePointAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36);
  }

  function lexVisualCSharp(source) {
    const input = normalize(source);
    const items = [];
    const diagnostics = [];
    let cursor = 0;
    let lineOnlyWhitespace = true;
    const push = (operatorId, parameters) => items.push({ operatorId, parameters });

    while (cursor < input.length) {
      const rest = input.slice(cursor);
      const current = input[cursor];

      if (/\s/u.test(current)) {
        let end = cursor + 1;
        while (end < input.length && /\s/u.test(input[end])) end += 1;
        const value = input.slice(cursor, end);
        push("csharp.trivia", { kind: "exact", value, count: 1 });
        if (value.includes("\n")) {
          lineOnlyWhitespace = value.endsWith("\n") || /^\n[ \t]*$/.test(value.slice(value.lastIndexOf("\n")));
        }
        cursor = end;
        continue;
      }

      if (lineOnlyWhitespace && current === "#") {
        const end = input.indexOf("\n", cursor);
        const value = input.slice(cursor, end < 0 ? input.length : end);
        push("csharp.token", { kind: "directive", value });
        cursor = end < 0 ? input.length : end;
        lineOnlyWhitespace = false;
        continue;
      }

      if (rest.startsWith("//")) {
        const end = input.indexOf("\n", cursor + 2);
        const value = input.slice(cursor + 2, end < 0 ? input.length : end);
        push("csharp.token", { kind: "lineComment", value });
        cursor = end < 0 ? input.length : end;
        lineOnlyWhitespace = false;
        continue;
      }

      if (rest.startsWith("/*")) {
        const end = input.indexOf("*/", cursor + 2);
        if (end < 0) {
          diagnostics.push(`Unterminated block comment at character ${cursor}.`);
          break;
        }
        const value = input.slice(cursor + 2, end);
        push("csharp.token", { kind: "blockComment", value });
        cursor = end + 2;
        lineOnlyWhitespace = value.includes("\n") && value.endsWith("\n");
        continue;
      }

      const stringPrefix = /^(?:\$+@?|@\$?)?"/.exec(rest)?.[0] || "";
      if (stringPrefix) {
        const end = csharpStringLexemeEnd(input, cursor);
        if (end < 0) {
          diagnostics.push(`Unterminated string literal at character ${cursor}.`);
          break;
        }
        push("csharp.token", { kind: "stringLexeme", value: input.slice(cursor, end) });
        cursor = end;
        lineOnlyWhitespace = false;
        continue;
      }

      if (current === "'") {
        let end = cursor + 1;
        if (input[end] === "\\") {
          const escape = /^(?:\\(?:x[0-9a-fA-F]{1,4}|u[0-9a-fA-F]{4}|U[0-9a-fA-F]{8}|[0abefnrtv\\'"]))/u.exec(input.slice(end));
          if (!escape) {
            diagnostics.push(`Invalid character escape at character ${cursor}.`);
            break;
          }
          end += escape[0].length;
        }
        else end += Array.from(input.slice(end))[0]?.length || 1;
        if (input[end] !== "'") {
          diagnostics.push(`Invalid character literal at character ${cursor}.`);
          break;
        }
        end += 1;
        push("csharp.token", { kind: "charLexeme", value: input.slice(cursor, end) });
        cursor = end;
        lineOnlyWhitespace = false;
        continue;
      }

      const numberMatch = /^(?:0[xX][0-9a-fA-F_]+(?:[uU](?:[lL])?|[lL](?:[uU])?)?|0[bB][01_]+(?:[uU](?:[lL])?|[lL](?:[uU])?)?|(?:\d[\d_]*(?:\.\d[\d_]*)?|\.\d[\d_]+)(?:[eE][+-]?\d[\d_]*)?(?:[fFdDmM]|[uU](?:[lL])?|[lL](?:[uU])?)?)/.exec(rest);
      if (numberMatch) {
        push("csharp.token", { kind: "number", value: numberMatch[0] });
        cursor += numberMatch[0].length;
        lineOnlyWhitespace = false;
        continue;
      }

      const identifierMatch = new RegExp(`^@?${IDENTIFIER_START}${IDENTIFIER_PART}*`, "u").exec(rest);
      if (identifierMatch) {
        const value = identifierMatch[0];
        push("csharp.token", {
          kind: KEYWORDS.has(value) ? "keyword" : "identifier",
          value
        });
        cursor += value.length;
        lineOnlyWhitespace = false;
        continue;
      }

      const punctuation = LEXICAL_PUNCTUATORS.find(value => rest.startsWith(value));
      if (punctuation) {
        push("csharp.token", { kind: "punctuation", value: punctuation });
        cursor += punctuation.length;
        lineOnlyWhitespace = false;
        continue;
      }

      diagnostics.push(`Unsupported C# lexical character '${current}' at character ${cursor}.`);
      cursor += current.length;
      lineOnlyWhitespace = false;
    }

    return { items, diagnostics, normalizedSource: input };
  }

  function createImportFragment(source, options = {}) {
    const lexical = lexVisualCSharp(source);
    if (lexical.diagnostics.length > 0) {
      return { ok: false, diagnostics: lexical.diagnostics, nodes: [], connections: [] };
    }
    const fileName = String(options.fileName || window.RMLI18n.t("ui.literal.ee6d86d67877")).trim();
    const projectId = String(options.projectId || "main").trim() || "main";
    const prefix = String(options.prefix || `csharp-import-${stableHash(`${fileName}\0${lexical.normalizedSource}`)}`).replace(/[^A-Za-z0-9_-]/g, "-");
    const nodes = [];
    const connections = [];
    let nodeSequence = 0;
    let edgeSequence = 0;
    const nextNodeId = label => `${prefix}-${label}-${++nodeSequence}`;
    const nextEdgeId = () => `${prefix}-edge-${++edgeSequence}`;
    const addNode = (operatorId, parameters, depth = 0) => {
      const id = nextNodeId(operatorId.split(".").pop());
      const index = nodes.length;
      nodes.push({
        id, kind: "operator", operatorId,
        x: 180 + (index % 128) * 330 + depth * 60,
        y: 180 + Math.floor(index / 128) * 190,
        width: null, height: null,
        label: operatorId === "csharp.token"
          ? String(parameters?.value || parameters?.kind || window.RMLI18n.t("ui.literal.a1141eb96836")).replace(/\s+/g, " ").slice(0, 48)
          : operatorId === "csharp.file"
            ? String(parameters?.fileName || window.RMLI18n.t("ui.literal.87f8ecebb21e"))
            : "",
        parameters
      });
      return id;
    };
    const connect = (fromNode, toNode, toPort, fromPort = null) => {
      const sourceNode = nodes.find(node => node.id === fromNode);
      const sourceDefinition = sourceNode ? getNodeDefinition(sourceNode.operatorId) : null;
      connections.push({
        id: nextEdgeId(),
        fromNode,
        fromPort: fromPort || sourceDefinition?.customCSharpOutputPort || "syntax",
        toNode,
        toPort,
        points: [],
        branchFrom: null
      });
    };
    let syntaxIds = lexical.items.map(item => addNode(item.operatorId, item.parameters));
    if (syntaxIds.length === 0) {
      syntaxIds = [addNode("csharp.trivia", { kind: "exact", value: "", count: 1 })];
    }
    let depth = 0;
    while (syntaxIds.length > 1) {
      const next = [];
      for (let index = 0; index < syntaxIds.length; index += 32) {
        const chunk = syntaxIds.slice(index, index + 32);
        if (chunk.length === 1) { next.push(chunk[0]); continue; }
        const sequenceId = addNode("csharp.sequence", { separator: "none", variadicInputCount: chunk.length }, ++depth);
        chunk.forEach((id, chunkIndex) => connect(id, sequenceId, chunkIndex < 26 ? String.fromCharCode(97 + chunkIndex) : `input${chunkIndex + 1}`));
        next.push(sequenceId);
      }
      syntaxIds = next;
    }
    const fileId = addNode("csharp.file", {
      fileName, projectId,
      nullable: options.nullable || "inherit",
      autoGeneratedHeader: options.autoGeneratedHeader === true
    }, depth + 1);
    connect(syntaxIds[0], fileId, "content");
    return {
      ok: true,
      diagnostics: [],
      nodes,
      connections,
      fileNodeId: fileId,
      rootSyntaxNodeId: syntaxIds[0],
      normalizedSource: lexical.normalizedSource
    };
  }

  function formatRoslynDiagnostics(diagnostics) {
    return (Array.isArray(diagnostics) ? diagnostics : []).map(item => {
      const location = item?.startLine > 0
        ? `line ${item.startLine}, column ${item.startColumn || 1}`
        : window.RMLI18n.t("ui.literal.72c533106f85");
      return `${item?.id || "C#14"} at ${location}: ${item?.message || window.RMLI18n.t("ui.auto.5d693dcc2c35")}`;
    });
  }

  function roslynRootFullText(root) {
    if (!root || !Array.isArray(root.children)) return null;
    const parts = [];
    const stack = [{ type: "node", node: root }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item.type === "text") {
        parts.push(item.value);
        continue;
      }
      if (item.type === "node") {
        if (!item.node || !Array.isArray(item.node.children)) return null;
        for (let index = item.node.children.length - 1; index >= 0; index -= 1) {
          const child = item.node.children[index];
          if (child?.type === "node" && child.node) {
            stack.push({ type: "node", node: child.node });
          } else if (child?.type === "token" && child.token) {
            stack.push({ type: "token", token: child.token });
          } else {
            return null;
          }
        }
        continue;
      }
      if (item.type !== "token" || !item.token) return null;
      const token = item.token;
      const trailing = Array.isArray(token.trailing) ? token.trailing : [];
      const leading = Array.isArray(token.leading) ? token.leading : [];
      for (let index = trailing.length - 1; index >= 0; index -= 1) {
        stack.push({ type: "text", value: String(trailing[index]?.text || "") });
      }
      if (token.isMissing !== true) {
        stack.push({ type: "text", value: String(token.text || "") });
      }
      for (let index = leading.length - 1; index >= 0; index -= 1) {
        stack.push({ type: "text", value: String(leading[index]?.text || "") });
      }
    }
    return parts.join("");
  }

  function countRoslynSyntaxItems(root) {
    if (!root || !Array.isArray(root.children)) return 0;
    let count = 0;
    const stack = [{ type: "node", node: root }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item?.type === "node" && item.node) {
        count += 1;
        for (const child of item.node.children || []) stack.push(child);
        continue;
      }
      if (item?.type !== "token" || !item.token) continue;
      if (item.token.isMissing !== true) count += 1;
      count += (item.token.leading || []).filter(trivia => String(trivia?.text || "")).length;
      count += (item.token.trailing || []).filter(trivia => String(trivia?.text || "")).length;
    }
    return count;
  }

  function roslynStructuralSignature(root) {
    const parts = [];
    const stack = [{ type: "node", node: root }];
    while (stack.length > 0) {
      const item = stack.pop();
      if (item?.type === "node" && item.node) {
        const children = Array.isArray(item.node.children) ? item.node.children : [];
        for (let index = children.length - 1; index >= 0; index -= 1) stack.push(children[index]);
        continue;
      }
      if (item?.type !== "token" || !item.token) continue;
      const token = item.token;
      const meaningfulTrivia = trivia => {
        const value = String(trivia?.text || "");
        if (!value || /^\s*$/.test(value)) return;
        parts.push(`R:${String(trivia?.kind || "")}:${value.replace(/\r\n?/g, "\n")}`);
      };
      for (const trivia of token.leading || []) meaningfulTrivia(trivia);
      if (
        token.isMissing !== true &&
        token.kind !== window.RMLI18n.t("ui.literal.5c53117f7b41") &&
        token.kind !== window.RMLI18n.t("ui.literal.27c9d882ba4e")
      ) {
        parts.push(`T:${String(token.kind || "")}:${String(token.text || "")}`);
      }
      for (const trivia of token.trailing || []) meaningfulTrivia(trivia);
    }
    return stableHash(parts.join("\0"));
  }

  function createRoslynImportFragment(source, parseResult, options = {}) {
    const sourceText = String(source ?? "");
    const normalizedSource = normalize(sourceText);
    if (!parseResult || parseResult.ok !== true || parseResult.languageVersion !== "14.0" || !parseResult.root) {
      return {
        ok: false,
        diagnostics: formatRoslynDiagnostics(parseResult?.diagnostics).length
          ? formatRoslynDiagnostics(parseResult.diagnostics)
          : [window.RMLI18n.t("ui.literal.060387ffb448")],
        nodes: [], connections: []
      };
    }
    const certifiedSource = roslynRootFullText(parseResult.root);
    if (certifiedSource === null || certifiedSource !== sourceText) {
      return {
        ok: false,
        diagnostics: [
          window.RMLI18n.t("ui.literal.d9aee27eae75")
        ],
        nodes: [], connections: []
      };
    }

    const fileName = String(options.fileName || window.RMLI18n.t("ui.literal.ee6d86d67877")).trim();
    const projectId = String(options.projectId || "main").trim() || "main";
    const prefix = String(options.prefix || `csharp14-roslyn-${stableHash(`${fileName}\0${normalizedSource}`)}`)
      .replace(/[^A-Za-z0-9_-]/g, "-");
    const nodes = [];
    const connections = [];
    const layoutDepthById = new Map();
    let nodeSequence = 0;
    let edgeSequence = 0;
    const nextNodeId = label => `${prefix}-${label}-${++nodeSequence}`;
    const nextEdgeId = () => `${prefix}-edge-${++edgeSequence}`;
    const portId = index => index < 26 ? String.fromCharCode(97 + index) : `input${index + 1}`;
    const addNode = (operatorId, parameters, depth = 0, label = "") => {
      const id = nextNodeId(operatorId.split(".").pop());
      const index = nodes.length;
      nodes.push({
        id,
        kind: "operator",
        operatorId,
        x: 180 + (depth % 10) * 350 + Math.floor(index / 256) * 70,
        y: 180 + (index % 256) * 150,
        width: null,
        height: null,
        label: String(label || "").replace(/\s+/g, " ").slice(0, 64),
        parameters
      });
      layoutDepthById.set(id, Math.max(0, depth));
      return id;
    };
    const connect = (fromNode, toNode, toPort, fromPort = null) => {
      const sourceNode = nodes.find(node => node.id === fromNode);
      const sourceDefinition = sourceNode ? getNodeDefinition(sourceNode.operatorId) : null;
      connections.push({
        id: nextEdgeId(),
        fromNode,
        fromPort: fromPort || sourceDefinition?.customCSharpOutputPort || "syntax",
        toNode,
        toPort,
        points: [], branchFrom: null
      });
    };

    const tryAddCompactUsing = (syntaxNode, depth) => {
      if (String(syntaxNode?.kind || "") !== "UsingDirective") return null;
      const value = roslynRootFullText(syntaxNode);
      if (value === null) return null;
      const parameters = {
        name: window.RMLI18n.t("ui.literal.bc0792d8dc81"),
        alias: "",
        global: false,
        static: false,
        exactSource: value,
        leadingTrivia: "",
        trailingTrivia: ""
      };
      parameters.validationSignature = stableHash(`using-exact\0${value}`);
      return addNode("csharp.usingDirective", parameters, depth, window.RMLI18n.t("ui.auto.9f98c27de221"));
    };

    const collapseChildren = (childIds, depth, label) => {
      let current = childIds;
      let generation = 0;
      while (current.length > 512) {
        const next = [];
        for (let index = 0; index < current.length; index += 32) {
          const chunk = current.slice(index, index + 32);
          if (chunk.length === 1) { next.push(chunk[0]); continue; }
          const sequenceId = addNode("csharp.sequence", {
            separator: "none",
            variadicInputCount: chunk.length
          }, depth + generation + 1, `${label} · continuation`);
          chunk.forEach((childId, childIndex) => connect(childId, sequenceId, portId(childIndex)));
          next.push(sequenceId);
        }
        current = next;
        generation += 1;
      }
      return current;
    };

    const addTrivia = (trivia, depth) => {
      const value = String(trivia?.text || "");
      if (!value) return null;
      const kind = String(trivia?.kind || window.RMLI18n.t("ui.literal.d8ed1a9de9f9"));
      return addNode("csharp.roslynTrivia", {
        syntaxKind: kind,
        value,
        signature: stableHash(`trivia\0${kind}\0${value}`)
      }, depth, kind);
    };

    const addTokenParts = (token, depth) => {
      const ids = [];
      for (const trivia of token?.leading || []) {
        const id = addTrivia(trivia, depth);
        if (id) ids.push(id);
      }
      if (token && token.isMissing !== true) {
        const kind = String(token.kind || window.RMLI18n.t("ui.literal.ee4f0c4cf584"));
        const value = String(token.text || "");
        ids.push(addNode("csharp.roslynToken", {
          syntaxKind: kind,
          value,
          signature: stableHash(`token\0${kind}\0${value}`)
        }, depth, `${kind} ${value}`));
      }
      for (const trivia of token?.trailing || []) {
        const id = addTrivia(trivia, depth);
        if (id) ids.push(id);
      }
      return ids;
    };

    let addOptimizedSyntaxNode;
    const addSyntaxNode = (syntaxNode, depth = 0) => {
      let childIds = [];
      for (const child of syntaxNode?.children || []) {
        if (child?.type === "node" && child.node) childIds.push(addOptimizedSyntaxNode(child.node, depth + 1, true));
        else if (child?.type === "token" && child.token) childIds.push(...addTokenParts(child.token, depth + 1));
      }
      childIds = collapseChildren(childIds, depth, syntaxNode?.kind || window.RMLI18n.t("ui.literal.17c7ba7676ad"));
      const syntaxKind = String(syntaxNode?.kind || window.RMLI18n.t("ui.literal.6eef6648406c"));
      const id = addNode("csharp.roslynNode", {
        syntaxKind,
        languageVersion: "14.0",
        variadicInputCount: Math.max(2, childIds.length)
      }, depth, syntaxKind);
      childIds.forEach((childId, index) => connect(childId, id, portId(index)));
      return id;
    };

    const directSyntaxChildren = syntaxNode => (syntaxNode?.children || [])
      .filter(child => child?.type === "node" && child.node)
      .map(child => child.node);
    const directTokens = syntaxNode => (syntaxNode?.children || [])
      .filter(child => child?.type === "token" && child.token)
      .map(child => child.token);
    const findDescendant = (syntaxNode, predicate) => {
      const stack = [...directSyntaxChildren(syntaxNode)].reverse();
      while (stack.length > 0) {
        const candidate = stack.pop();
        if (predicate(candidate)) return candidate;
        stack.push(...directSyntaxChildren(candidate).reverse());
      }
      return null;
    };
    const syntaxTextCache = new WeakMap();
    const directTriviaProfileCache = new WeakMap();
    const syntaxText = syntaxNode => {
      if (!syntaxNode || typeof syntaxNode !== "object") return null;
      if (syntaxTextCache.has(syntaxNode)) return syntaxTextCache.get(syntaxNode);
      const fullStart = Number(syntaxNode.fullStart);
      const fullLength = Number(syntaxNode.fullLength);
      const result = Number.isInteger(fullStart) && Number.isInteger(fullLength) && fullStart >= 0 && fullLength >= 0
        ? sourceText.slice(fullStart, fullStart + fullLength)
        : roslynRootFullText(syntaxNode);
      syntaxTextCache.set(syntaxNode, result);
      return result;
    };
    const syntaxCoreText = syntaxNode => {
      const start = Number(syntaxNode?.start);
      const length = Number(syntaxNode?.length);
      return Number.isInteger(start) && Number.isInteger(length) && start >= 0 && length >= 0
        ? sourceText.slice(start, start + length)
        : String(syntaxText(syntaxNode) || "").trim();
    };
    const catalogDefinitions = Object.entries(
      options.disableCatalogNodes === true
        ? {}
        : options.catalogDefinitions && typeof options.catalogDefinitions === "object"
        ? options.catalogDefinitions
        : getNodeDefinitions?.() || {}
    ).filter(([, definition]) =>
      definition?.catalogGenerated === true &&
      definition?.customCSharpCatalogNode === true &&
      definition?.apiVerification?.catalogSource === "scanner" &&
      String(definition?.apiVerification?.catalogFingerprint || "").trim()
    );
    const catalogTypeAlias = new Map([
      ["bool", "System.Boolean"], ["byte", "System.Byte"], ["sbyte", "System.SByte"],
      ["short", "System.Int16"], ["ushort", "System.UInt16"], ["int", "System.Int32"],
      ["uint", "System.UInt32"], ["long", "System.Int64"], ["ulong", "System.UInt64"],
      ["float", "System.Single"], ["double", "System.Double"], ["decimal", "System.Decimal"],
      ["char", "System.Char"], ["string", "System.String"], ["object", "System.Object"],
      ["void", "System.Void"]
    ]);
    const normalizeCatalogType = value => {
      let type = String(value || "").replace(/global::/g, "").trim();
      while (type.endsWith("?")) type = type.slice(0, -1).trim();
      return catalogTypeAlias.get(type) || type;
    };
    const catalogTypes = new Set();
    for (const [, definition] of catalogDefinitions) {
      for (const type of [
        definition.catalogType,
        definition.apiReturnType,
        ...(definition.apiParameters || []).flatMap(parameter => [parameter?.type, parameter?.elementType])
      ]) {
        const normalized = normalizeCatalogType(type);
        if (normalized) catalogTypes.add(normalized);
      }
    }
    const shortCatalogType = value => normalizeCatalogType(value)
      .replace(/<.*>$/, "")
      .split(".")
      .at(-1);
    const resolveCatalogType = value => {
      const normalized = normalizeCatalogType(value);
      if (!normalized) return "";
      if (catalogTypes.has(normalized)) return normalized;
      const matches = [...catalogTypes].filter(type => shortCatalogType(type) === shortCatalogType(normalized));
      return matches.length === 1 ? matches[0] : normalized;
    };
    const symbolTypes = new Map();
    const sourceMemberNames = new Set();
    const pendingVarSymbols = [];
    const recordSymbolType = (name, type) => {
      const symbol = String(name || "").replace(/^@/, "");
      const resolved = resolveCatalogType(type);
      if (!symbol || !resolved) return;
      if (!symbolTypes.has(symbol)) symbolTypes.set(symbol, resolved);
      else if (symbolTypes.get(symbol) !== resolved) symbolTypes.set(symbol, "");
    };
    const collectSourceSymbols = root => {
      const stack = [root];
      while (stack.length > 0) {
        const current = stack.pop();
        const kind = String(current?.kind || "");
        const core = syntaxCoreText(current);
        if (kind === window.RMLI18n.t("ui.auto.8e63222113d8")) {
          const match = /^(?:(?:this|ref readonly|ref|out|in|params|scoped ref|scoped)\s+)?(.+?)\s+(@?[\p{L}_][\p{L}\p{N}_]*)(?:\s*=|$)/u.exec(core);
          if (match) recordSymbolType(match[2], match[1]);
        } else if (kind === window.RMLI18n.t("ui.literal.377a6210f321")) {
          const match = /^(.+?)\s+(@?[\p{L}_][\p{L}\p{N}_]*)(?:\s*=|\s*,|$)/u.exec(core);
          if (match && match[1] !== "var") {
            for (const declarator of directSyntaxChildren(current).filter(child => String(child?.kind || "") === "VariableDeclarator")) {
              const name = /^@?[\p{L}_][\p{L}\p{N}_]*/u.exec(syntaxCoreText(declarator))?.[0];
              if (name) recordSymbolType(name, match[1]);
            }
          } else if (match?.[1] === "var") {
            for (const declarator of directSyntaxChildren(current).filter(child => String(child?.kind || "") === "VariableDeclarator")) {
              const name = /^@?[\p{L}_][\p{L}\p{N}_]*/u.exec(syntaxCoreText(declarator))?.[0];
              const equalsValue = findDescendant(declarator, child => String(child?.kind || "") === "EqualsValueClause");
              const initializer = equalsValue ? directSyntaxChildren(equalsValue).at(-1) : null;
              if (name && initializer) pendingVarSymbols.push({ name, initializer });
            }
          }
        } else if (/^(?:MethodDeclaration|LocalFunctionStatement|ConstructorDeclaration)$/.test(kind)) {
          const name = /(@?[\p{L}_][\p{L}\p{N}_]*)\s*(?:<[^>{}()]*>)?\s*\(/u.exec(core)?.[1];
          if (name) sourceMemberNames.add(name.replace(/^@/, ""));
        }
        stack.push(...directSyntaxChildren(current));
      }
    };
    collectSourceSymbols(parseResult.root);

    const catalogByOwnerKindMember = new Map();
    const catalogEnumsByType = new Map();
    const catalogEnumValues = definition => {
      const options = (Array.isArray(definition?.parameters) ? definition.parameters : [])
        .find(parameter => parameter?.key === "value")?.options;
      return new Set((Array.isArray(options) ? options : [])
        .map(option => Array.isArray(option)
          ? option[0]
          : option && typeof option === "object"
            ? option.value
            : option)
        .map(value => String(value || "").replace(/^@/, ""))
        .filter(Boolean));
    };
    for (const [operatorId, definition] of catalogDefinitions) {
      const owner = resolveCatalogType(definition.catalogType);
      const key = [
        owner,
        String(definition.apiMemberKind || ""),
        String(definition.catalogMember || "")
      ].join("\0");
      if (!catalogByOwnerKindMember.has(key)) catalogByOwnerKindMember.set(key, []);
      catalogByOwnerKindMember.get(key).push({ operatorId, definition });
      if (definition.apiMemberKind === "enum" && owner) {
        if (!catalogEnumsByType.has(owner)) catalogEnumsByType.set(owner, []);
        catalogEnumsByType.get(owner).push({
          operatorId,
          definition,
          values: catalogEnumValues(definition)
        });
      }
    }
    const typeDefinitions = getTypeDefinitions?.() || {};
    const graphTypeByCatalogType = new Map(
      Object.entries(typeDefinitions)
        .map(([graphType, information]) => [resolveCatalogType(information?.apiCatalogType || information?.csType), graphType])
        .filter(([type]) => Boolean(type))
    );
    const catalogAssignableOwners = owner => {
      const resolved = resolveCatalogType(owner);
      const graphType = graphTypeByCatalogType.get(resolved);
      const information = graphType ? typeDefinitions[graphType] : null;
      const result = [resolved];
      for (const assignableGraphType of information?.assignableTo || []) {
        const candidate = resolveCatalogType(typeDefinitions[assignableGraphType]?.apiCatalogType || typeDefinitions[assignableGraphType]?.csType);
        if (candidate && !result.includes(candidate)) result.push(candidate);
      }
      return result;
    };
    const catalogMembers = (owner, kind, member) => {
      const name = String(member || "").replace(/^@/, "");
      for (const candidateOwner of catalogAssignableOwners(owner)) {
        const candidates = catalogByOwnerKindMember.get([candidateOwner, kind, name].join("\0")) || [];
        if (candidates.length > 0) return candidates;
      }
      return [];
    };
    const catalogEnumMember = (receiver, member) => {
      const receiverText = syntaxCoreText(receiver).trim();
      const simpleReceiver = /^@?[\p{L}_][\p{L}\p{N}_]*$/u.test(receiverText);
      if (simpleReceiver && symbolTypes.has(receiverText.replace(/^@/, ""))) return null;
      const owner = resolveCatalogType(receiverText);
      const name = String(member || "").trim().replace(/^@/, "");
      const matches = (catalogEnumsByType.get(owner) || [])
        .filter(candidate => candidate.values.has(name));
      const canonical = matches.filter(candidate => candidate.definition?.legacyCatalogAlias !== true);
      const candidates = canonical.length > 0 ? canonical : matches;
      return candidates.length === 1 ? { ...candidates[0], value: name } : null;
    };
    const argumentValueNode = argument => {
      const children = directSyntaxChildren(argument);
      return children.at(-1) || argument;
    };
    const expressionTypeCache = new WeakMap();
    const inferExpressionType = syntaxNode => {
      if (!syntaxNode || typeof syntaxNode !== "object") return "";
      if (expressionTypeCache.has(syntaxNode)) return expressionTypeCache.get(syntaxNode);
      const kind = String(syntaxNode.kind || "");
      const core = syntaxCoreText(syntaxNode).trim();
      const children = directSyntaxChildren(syntaxNode);
      let result = "";
      if (kind === window.RMLI18n.t("ui.literal.0ebb31e2d900")) {
        result = symbolTypes.get(core.replace(/^@/, "")) || resolveCatalogType(core);
      } else if (/^(?:ObjectCreationExpression|ImplicitObjectCreationExpression)$/.test(kind)) {
        const type = /^new\s+([^({]+?)(?:\s*\(|\s*\{)/s.exec(core)?.[1];
        result = resolveCatalogType(type || "");
      } else if (kind === window.RMLI18n.t("ui.literal.25e55b52ee2f")) {
        result = resolveCatalogType(/^\(\s*([^()]+)\s*\)/s.exec(core)?.[1] || "");
      } else if (kind === window.RMLI18n.t("ui.literal.900cb51b56fb") || kind === window.RMLI18n.t("ui.literal.e88830bb358e")) {
        result = "System.String";
      } else if (kind === window.RMLI18n.t("ui.literal.c733c8d25561") || kind === window.RMLI18n.t("ui.literal.37a5ae7bb519")) {
        result = "System.Boolean";
      } else if (kind === window.RMLI18n.t("ui.literal.5d543bb472fd")) {
        result = /[fF]$/.test(core) ? "System.Single" : /[dD]$/.test(core) ? "System.Double" : /[mM]$/.test(core) ? "System.Decimal" : "System.Int32";
      } else if (kind === window.RMLI18n.t("ui.literal.9398fb0ae4dc")) {
        result = inferExpressionType(children[0]);
      } else if (kind === window.RMLI18n.t("ui.literal.ffe3de5640e0")) {
        const collection = inferExpressionType(children[0]);
        result = collection.endsWith("[]") ? collection.slice(0, -2) : "";
      } else if (kind === window.RMLI18n.t("ui.literal.e0d6f8050968")) {
        const member = syntaxCoreText(children.at(-1)).replace(/<.*>$/, "");
        const enumMember = catalogEnumMember(children[0], member);
        if (enumMember) {
          result = resolveCatalogType(
            enumMember.definition.apiReturnType || enumMember.definition.catalogType
          );
        } else {
          const owner = inferExpressionType(children[0]);
          const candidates = [
            ...catalogMembers(owner, "property-get", member),
            ...catalogMembers(owner, "field-get", member)
          ];
          if (candidates.length === 1) result = resolveCatalogType(candidates[0].definition.apiReturnType);
        }
      } else if (kind === window.RMLI18n.t("ui.literal.54d759f30520")) {
        const match = resolveCatalogInvocation(syntaxNode, false);
        if (match) {
          const declaredReturn = normalizeCatalogType(match.definition.apiReturnType);
          result = /^[A-Z][A-Za-z0-9_]*$/.test(declaredReturn) && match.genericTypes.length === 1
            ? resolveCatalogType(match.genericTypes[0])
            : resolveCatalogType(declaredReturn);
        }
      }
      expressionTypeCache.set(syntaxNode, result || "");
      return result || "";
    };
    const parameterAcceptsType = (parameter, actualType) => {
      if (!actualType) return true;
      const expected = resolveCatalogType(parameter?.elementType || parameter?.type || "");
      if (!expected || /^[A-Z][A-Za-z0-9_]*$/.test(expected)) return true;
      return expected === resolveCatalogType(actualType) || expected === "System.Object";
    };
    function resolveCatalogInvocation(syntaxNode, requireUnique = true) {
      const children = directSyntaxChildren(syntaxNode);
      const target = children[0];
      const argumentList = children.find(child => String(child?.kind || "") === "ArgumentList");
      if (!target || !argumentList) return null;
      const targetChildren = directSyntaxChildren(target);
      if (String(target.kind || "") !== "SimpleMemberAccessExpression" || targetChildren.length < 2) return null;
      const receiver = targetChildren[0];
      const memberSyntax = targetChildren.at(-1);
      const memberText = syntaxCoreText(memberSyntax).trim();
      const member = memberText.replace(/<.*>$/, "").replace(/^@/, "");
      if (sourceMemberNames.has(member)) return null;
      const genericText = /<([\s\S]*)>$/.exec(memberText)?.[1] || "";
      const genericTypes = genericText ? genericText.split(",").map(item => item.trim()).filter(Boolean) : [];
      const owner = inferExpressionType(receiver);
      if (!owner) return null;
      const args = directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument");
      let candidates = catalogMembers(owner, "method", member).filter(({ definition }) => {
        const parameters = Array.isArray(definition.apiParameters) ? definition.apiParameters : [];
        if (parameters.some(parameter => parameter?.isOut === true || parameter?.isByRef === true)) return false;
        const required = parameters.filter(parameter => parameter?.isOptional !== true && parameter?.hasDefaultValue !== true).length;
        if (args.length < required || args.length > parameters.length) return false;
        if (Math.max(0, Number(definition.apiGenericArity) || 0) !== genericTypes.length) return false;
        return args.every((argument, index) => parameterAcceptsType(parameters[index], inferExpressionType(argumentValueNode(argument))));
      });
      if (candidates.length > 1) {
        const scored = candidates.map(candidate => ({
          candidate,
          score: args.reduce((score, argument, index) => {
            const actual = resolveCatalogType(inferExpressionType(argumentValueNode(argument)));
            const expected = resolveCatalogType(candidate.definition.apiParameters?.[index]?.elementType || candidate.definition.apiParameters?.[index]?.type || "");
            return score + (actual && expected === actual ? 1 : 0);
          }, 0)
        })).sort((a, b) => b.score - a.score);
        if (scored.length > 1 && scored[0].score === scored[1].score) return null;
        candidates = [scored[0].candidate];
      }
      if (candidates.length !== 1 && requireUnique) return null;
      if (candidates.length !== 1) return null;
      return { ...candidates[0], receiver, args, genericTypes };
    }
    const addCatalogInvocation = (match, depth, label) => {
      const id = addNode(match.operatorId, {
        customCSharpStaticTarget: match.definition.apiIsStatic === true
          ? syntaxCoreText(match.receiver)
          : ""
      }, depth, label || match.definition.title);
      if (match.definition.apiIsStatic !== true) {
        connect(addOptimizedSyntaxNode(match.receiver, depth + 1), id, "target");
      }
      match.genericTypes.forEach((type, index) => {
        const typeId = addNode("csharp.type", { name: type }, depth + 1, type);
        connect(typeId, id, `generic${index}`);
      });
      match.args.forEach((argument, index) => {
        connect(addOptimizedSyntaxNode(argumentValueNode(argument), depth + 1), id, `arg${index}`);
      });
      return id;
    };
    for (const pending of pendingVarSymbols) {
      const inferred = inferExpressionType(pending.initializer);
      if (inferred) recordSymbolType(pending.name, inferred);
    }
    const directTriviaProfile = syntaxNode => {
      if (!syntaxNode || typeof syntaxNode !== "object") {
        return { prefix: [], suffix: [], prefixSignificant: false, suffixSignificant: false, internalSignificant: false };
      }
      if (directTriviaProfileCache.has(syntaxNode)) return directTriviaProfileCache.get(syntaxNode);
      const tokenStack = [syntaxNode];
      const allTokens = [];
      while (tokenStack.length > 0) {
        const current = tokenStack.pop();
        allTokens.push(...directTokens(current));
        tokenStack.push(...directSyntaxChildren(current));
      }
      allTokens.sort((left, right) => Number(left?.start) - Number(right?.start));
      const tokens = allTokens.length > 1
        ? [allTokens[0], allTokens.at(-1)]
        : allTokens;
      const prefix = [];
      const suffix = [];
      let internalSignificant = false;
      const nodeStart = Number(syntaxNode.start);
      const nodeLength = Number(syntaxNode.length);
      const hasSpan = Number.isInteger(nodeStart) && Number.isInteger(nodeLength) && nodeStart >= 0 && nodeLength >= 0;
      const nodeEnd = nodeStart + nodeLength;
      tokens.forEach((token, tokenIndex) => {
        const inspect = (trivia, side) => {
          const value = String(trivia?.text || "");
          if (!value) return;
          const triviaStart = Number(trivia?.start);
          const triviaLength = Number(trivia?.length);
          const hasTriviaSpan = hasSpan && Number.isInteger(triviaStart) && Number.isInteger(triviaLength);
          const isPrefix = hasTriviaSpan
            ? triviaStart + triviaLength <= nodeStart
            : tokenIndex === 0 && side === "leading";
          const isSuffix = hasTriviaSpan
            ? triviaStart >= nodeEnd
            : tokenIndex === tokens.length - 1 && side === "trailing";
          if (isPrefix) prefix.push(trivia);
          else if (isSuffix) suffix.push(trivia);
          else if (!/^\s*$/.test(value)) internalSignificant = true;
        };
        for (const trivia of token?.leading || []) inspect(trivia, "leading");
        for (const trivia of token?.trailing || []) inspect(trivia, "trailing");
      });
      const profile = {
        prefix,
        suffix,
        prefixSignificant: prefix.some(item => !/^\s*$/.test(String(item?.text || ""))),
        suffixSignificant: suffix.some(item => !/^\s*$/.test(String(item?.text || ""))),
        internalSignificant
      };
      directTriviaProfileCache.set(syntaxNode, profile);
      return profile;
    };
    const addSemanticNode = (operatorId, parameters, inputs, depth, label) => {
      const id = addNode(operatorId, parameters, depth, label);
      Object.entries(inputs || {}).forEach(([portName, childId]) => {
        if (childId) connect(childId, id, portName);
      });
      return id;
    };
    const addSyntaxSequence = (syntaxNodes, separator, depth, label) => {
      const ids = syntaxNodes.map(item => addOptimizedSyntaxNode(item, depth + 1));
      if (ids.length === 0) return null;
      if (ids.length === 1) return ids[0];
      const compactIds = collapseChildren(ids, depth, label);
      if (compactIds.length === 1) return compactIds[0];
      const sequenceId = addNode("csharp.sequence", {
        separator,
        variadicInputCount: compactIds.length
      }, depth, label);
      compactIds.forEach((childId, index) => connect(childId, sequenceId, portId(index)));
      return sequenceId;
    };
    const wrapSemanticTrivia = (syntaxNode, semanticId, depth, preserveWhitespace = false) => {
      if (!semanticId || String(syntaxNode?.kind || "") === "UsingDirective") return semanticId;
      const profile = directTriviaProfile(syntaxNode);
      const ids = [];
      const prefix = preserveWhitespace || profile.prefixSignificant ? profile.prefix : [];
      const suffix = preserveWhitespace || profile.suffixSignificant ? profile.suffix : [];
      for (const trivia of prefix) {
        const triviaId = addTrivia(trivia, depth + 1);
        if (triviaId) ids.push(triviaId);
      }
      ids.push(semanticId);
      for (const trivia of suffix) {
        const triviaId = addTrivia(trivia, depth + 1);
        if (triviaId) ids.push(triviaId);
      }
      if (ids.length === 1) return semanticId;
      const sequenceId = addNode("csharp.sequence", {
        separator: "none",
        variadicInputCount: ids.length
      }, depth, `${syntaxNode.kind} with trivia`);
      ids.forEach((childId, index) => connect(childId, sequenceId, portId(index)));
      return sequenceId;
    };
    const literalKindBySyntaxKind = new Map([
      [window.RMLI18n.t("ui.literal.5d543bb472fd"), "number"],
      [window.RMLI18n.t("ui.literal.c733c8d25561"), "true"],
      [window.RMLI18n.t("ui.literal.37a5ae7bb519"), "false"],
      [window.RMLI18n.t("ui.literal.9a7d0fe0dcee"), "null"],
      [window.RMLI18n.t("ui.literal.621a7934d0f1"), "default"]
    ]);
    const binaryOperatorByKind = new Map([
      [window.RMLI18n.t("ui.literal.7c3a62cd51b0"), "+"], ["SubtractExpression", "-"],
      [window.RMLI18n.t("ui.literal.a65542b52bda"), "*"], ["DivideExpression", "/"],
      [window.RMLI18n.t("ui.literal.13896a76a959"), "%"], ["EqualsExpression", "=="],
      [window.RMLI18n.t("ui.literal.7b0ed06ee52e"), "!="], ["LessThanExpression", "<"],
      [window.RMLI18n.t("ui.literal.a1df39d84765"), ">"], ["LessThanOrEqualExpression", "<="],
      [window.RMLI18n.t("ui.literal.9c417bf29e6c"), ">="], ["LogicalAndExpression", "&&"],
      [window.RMLI18n.t("ui.literal.b63416bdd201"), "||"], ["BitwiseAndExpression", "&"],
      [window.RMLI18n.t("ui.literal.7c4f19a2f350"), "|"], ["ExclusiveOrExpression", "^"],
      [window.RMLI18n.t("ui.literal.ebb7bb56f1a1"), "<<"], ["RightShiftExpression", ">>"],
      [window.RMLI18n.t("ui.literal.1e5fd6dc7606"), "??"], ["IsExpression", "is"],
      [window.RMLI18n.t("ui.literal.5e788396ddb5"), "as"]
    ]);
    const assignmentOperatorByKind = new Map([
      [window.RMLI18n.t("ui.literal.80feb5723656"), "="], ["AddAssignmentExpression", "+="],
      [window.RMLI18n.t("ui.literal.eb5eb47a2701"), "-="], ["MultiplyAssignmentExpression", "*="],
      [window.RMLI18n.t("ui.literal.ea95db34d883"), "/="], ["ModuloAssignmentExpression", "%="],
      [window.RMLI18n.t("ui.literal.e91a1d9e41c7"), "&="], ["OrAssignmentExpression", "|="],
      [window.RMLI18n.t("ui.literal.abef550caed2"), "^="], ["LeftShiftAssignmentExpression", "<<="],
      [window.RMLI18n.t("ui.literal.83108251ddaf"), ">>="], [window.RMLI18n.t("ui.literal.8a77df6beb90"), "??="]
    ]);
    const jumpKindBySyntaxKind = new Map([
      [window.RMLI18n.t("ui.literal.aa6f79138c08"), "return"], [window.RMLI18n.t("ui.literal.867b40904f8e"), "throw"],
      [window.RMLI18n.t("ui.literal.ab8baff92337"), "break"], [window.RMLI18n.t("ui.literal.1d7d329e58f1"), "continue"],
      [window.RMLI18n.t("ui.literal.63f8c2170ab6"), "yield return"], [window.RMLI18n.t("ui.literal.6403a0414217"), "yield break"],
      [window.RMLI18n.t("ui.literal.2d75a452fb19"), "goto"], [window.RMLI18n.t("ui.literal.96e57bc227c4"), "goto case"],
      [window.RMLI18n.t("ui.literal.2957ca1b3ab8"), "goto default"]
    ]);
    const typeDeclarationKind = new Map([
      [window.RMLI18n.t("ui.literal.6f02b7cdf3a2"), "class"], [window.RMLI18n.t("ui.literal.39818ac06cc6"), "struct"],
      [window.RMLI18n.t("ui.literal.1003b5847002"), "interface"], [window.RMLI18n.t("ui.literal.2dda102d7bb0"), "record"],
      [window.RMLI18n.t("ui.literal.75d60a070456"), "record struct"], [window.RMLI18n.t("ui.literal.fa872359adca"), "enum"]
    ]);
    const keywordByKind = new Map([
      [window.RMLI18n.t("ui.literal.96e685767692"), "typeof"], [window.RMLI18n.t("ui.literal.eb17fccab109"), "nameof"],
      [window.RMLI18n.t("ui.literal.4c3fa67386b2"), "sizeof"], [window.RMLI18n.t("ui.literal.c03e98a330c9"), "default"],
      [window.RMLI18n.t("ui.literal.431ae6e75e1b"), "checked"], [window.RMLI18n.t("ui.literal.2fb6e4e361bf"), "unchecked"]
    ]);
    const unaryOperatorByKind = new Map([
      [window.RMLI18n.t("ui.literal.479fd8c4702f"), "+"], ["UnaryMinusExpression", "-"],
      [window.RMLI18n.t("ui.literal.de5751a3e372"), "!"], ["BitwiseNotExpression", "~"],
      [window.RMLI18n.t("ui.literal.680a8d0e2ed2"), "++pre"], [window.RMLI18n.t("ui.literal.acfee2244f30"), "--pre"],
      [window.RMLI18n.t("ui.literal.c3e8ffc6b10f"), "++post"], [window.RMLI18n.t("ui.literal.a78b44301fda"), "--post"],
      [window.RMLI18n.t("ui.literal.e49703c9cea6"), "&"], ["PointerIndirectionExpression", "*"],
      [window.RMLI18n.t("ui.literal.a04ef38d2ddc"), "^"], ["AwaitExpression", "await"],
      [window.RMLI18n.t("ui.literal.b056a5f929bf"), "!post"]
    ]);
    const resourceKindBySyntaxKind = new Map([
      [window.RMLI18n.t("ui.literal.44c512706803"), "using"], [window.RMLI18n.t("ui.literal.21a6d1eb11a6"), "lock"],
      [window.RMLI18n.t("ui.literal.7fca3cf4685d"), "fixed"], [window.RMLI18n.t("ui.literal.fb4dac5342b8"), "checked"],
      [window.RMLI18n.t("ui.literal.32a700e7147c"), "unchecked"], [window.RMLI18n.t("ui.literal.409f8d77cd24"), "unsafe"]
    ]);
    const initializerDelimiterByKind = new Map([
      [window.RMLI18n.t("ui.literal.096a73dabbaa"), "braces"],
      [window.RMLI18n.t("ui.literal.c837d9eed114"), "braces"],
      [window.RMLI18n.t("ui.literal.bad82b7fa69e"), "braces"],
      [window.RMLI18n.t("ui.literal.d4722f372d68"), "braces"],
      [window.RMLI18n.t("ui.literal.6c7d6ed58bbf"), "brackets"]
    ]);

    const tryAddSemanticNode = (syntaxNode, depth) => {
      const kind = String(syntaxNode?.kind || "");
      const value = syntaxText(syntaxNode);
      if (value === null) return null;

      const compactUsing = tryAddCompactUsing(syntaxNode, depth);
      if (compactUsing) return compactUsing;

      const triviaProfile = directTriviaProfile(syntaxNode);
      const significantTrivia = triviaProfile.internalSignificant;
      const semanticValue = significantTrivia ? value : syntaxCoreText(syntaxNode);

      if (kind === window.RMLI18n.t("ui.literal.0ebb31e2d900") && IDENTIFIER.test(semanticValue)) {
        return addNode("csharp.identifier", { name: semanticValue }, depth, semanticValue);
      }
      if ((kind === window.RMLI18n.t("ui.literal.aeee8ad9b2c5") || /(?:Name|Type)$/.test(kind)) && TYPE_TEXT.test(semanticValue)) {
        return addNode("csharp.type", { name: semanticValue }, depth, kind);
      }
      if (literalKindBySyntaxKind.has(kind)) {
        const literalKind = literalKindBySyntaxKind.get(kind);
        if (literalKind !== "number" || NUMBER_LITERAL.test(semanticValue)) {
          return addNode("csharp.literal", {
            kind: literalKind === "number" && /[.eEfFdDmM]/.test(semanticValue) ? "real" : literalKind === "number" ? "integer" : literalKind,
            value: literalKind === "number" ? semanticValue : ""
          }, depth, kind);
        }
      }
      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.900cb51b56fb") && /^"(?:[^"\\]|\\.)*"$/s.test(semanticValue)) {
        try {
          const decoded = JSON.parse(semanticValue);
          return addNode("csharp.literal", { kind: "string", value: decoded }, depth, kind);
        } catch {}
      }

      const children = directSyntaxChildren(syntaxNode);

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.c70308f8560c")) {
        return addSyntaxSequence(children, "newline", depth, window.RMLI18n.t("ui.literal.96cd345d12b5")) ||
          addNode("csharp.trivia", { kind: "exact", count: 1, value: "" }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.auto.8e63222113d8")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(this|ref readonly|ref|out|in|params|scoped ref|scoped) )?(.+?) (@?[\p{L}_][\p{L}\p{N}_]*)(?: = ([\s\S]+))?$/u.exec(core);
        if (match && TYPE_TEXT.test(match[2])) {
          const defaultNode = match[4] ? children[children.length - 1] : null;
          return addSemanticNode("csharp.parameter", {
            name: match[3], type: match[2], modifier: match[1] || "none"
          }, {
            default: defaultNode ? addOptimizedSyntaxNode(defaultNode, depth + 1) : null
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.49b4855e1f33")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(in|out) )?(@?[\p{L}_][\p{L}\p{N}_]*)$/u.exec(core);
        if (match) {
          return addNode("csharp.genericParameter", {
            variance: match[1] || "none", name: match[2]
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.ec07399a5758")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^where (@?[\p{L}_][\p{L}\p{N}_]*)\s*:\s*([\s\S]+)$/u.exec(core);
        if (match) {
          const constraintNodes = children.filter(child => /Constraint$/.test(String(child?.kind || "")));
          return addSemanticNode("csharp.constraint", { parameter: match[1] }, {
            constraints: addSyntaxSequence(constraintNodes, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.52e68a873a2b"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.a2de454ef29d")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^\[(?:(assembly|module|field|event|method|param|property|return|type):\s*)?([^\]()]+)(?:\((.*)\))?\]$/u.exec(core);
        if (match && TYPE_TEXT.test(match[2].trim())) {
          const attributeNode = children.find(child => String(child?.kind || "") === "Attribute");
          const argumentList = attributeNode
            ? directSyntaxChildren(attributeNode).find(child => String(child?.kind || "") === "AttributeArgumentList")
            : null;
          const argumentNodes = argumentList ? directSyntaxChildren(argumentList) : [];
          return addSemanticNode("csharp.attribute", {
            target: match[1] || "none", name: match[2].trim()
          }, {
            arguments: addSyntaxSequence(argumentNodes, "commaSpace", depth + 1, window.RMLI18n.t("ui.auto.cda21d9622e7"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.82dd2cdf36f9")) {
        const statements = children.filter(child => /Statement$/.test(String(child?.kind || "")));
        return addSemanticNode("csharp.block", {}, {
          statements: addSyntaxSequence(statements, "newline", depth + 1, window.RMLI18n.t("ui.literal.5653cebc057d"))
        }, depth, kind);
      }

      if (!significantTrivia && initializerDelimiterByKind.has(kind)) {
        const items = children.filter(child => !/(?:ArgumentList|BracketedArgumentList)$/.test(String(child?.kind || "")));
        return addSemanticNode("csharp.delimited", {
          delimiter: initializerDelimiterByKind.get(kind),
          layout: /[\r\n]/.test(syntaxCoreText(syntaxNode)) ? "block" : "inline",
          suffix: "none"
        }, {
          content: addSyntaxSequence(items, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.ad995a1eb11c"))
        }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.fd3c535741d1")) {
        const initializer = children.find(child => String(child?.kind || "") === "ArrayInitializerExpression");
        const items = initializer ? directSyntaxChildren(initializer) : [];
        return addSemanticNode("csharp.objectCreation", {
          type: "object", kind: "implicitArray"
        }, {
          initializer: addSyntaxSequence(items, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.ad995a1eb11c"))
        }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.31b6a0b3b2b5")) {
        const argumentList = children.find(child => String(child?.kind || "") === "ArgumentList");
        const initializer = children.find(child => String(child?.kind || "") === "ObjectInitializerExpression");
        const argumentsList = argumentList
          ? directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument")
          : [];
        const initializerItems = initializer ? directSyntaxChildren(initializer) : [];
        return addSemanticNode("csharp.objectCreation", {
          type: "object", kind: "implicitObject"
        }, {
          arguments: addSyntaxSequence(argumentsList, "commaSpace", depth + 1, window.RMLI18n.t("ui.auto.cda21d9622e7")),
          initializer: addSyntaxSequence(initializerItems, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.ad995a1eb11c"))
        }, depth, kind);
      }

      if (!significantTrivia && [window.RMLI18n.t("ui.literal.655d2b5b0ecf"), window.RMLI18n.t("ui.literal.3f2d28dfdd24")].includes(kind)) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^namespace\s+([^\s;{]+)\s*[;{]/u.exec(core);
        if (match && QUALIFIED_NAME.test(match[1])) {
          const members = children.filter(child => {
            const childKind = String(child?.kind || "");
            return childKind === window.RMLI18n.t("ui.literal.435382c68a4d") || childKind === window.RMLI18n.t("ui.literal.e34561f4ae71") ||
              (/Declaration$/.test(childKind) && !/(?:Name|Type)Declaration$/.test(childKind));
          });
          return addSemanticNode("csharp.namespace", {
            name: match[1], style: kind === window.RMLI18n.t("ui.literal.3f2d28dfdd24") ? "fileScoped" : "block"
          }, {
            members: addSyntaxSequence(members, "newline", depth + 1, window.RMLI18n.t("ui.literal.1cb449c11266"))
          }, depth, kind);
        }
      }
      if (!significantTrivia && typeDeclarationKind.has(kind)) {
        const tokens = directTokens(syntaxNode).filter(token => token?.isMissing !== true);
        const keywordIndex = tokens.findIndex(token => [window.RMLI18n.t("ui.literal.fe83b23ca6d6"), window.RMLI18n.t("ui.literal.b9fcc828a1cc"), window.RMLI18n.t("ui.literal.6d75ca9c40f9"), window.RMLI18n.t("ui.literal.e3b700a9586e"), window.RMLI18n.t("ui.literal.36e8e5c79514")].includes(String(token?.kind || "")));
        const nameToken = tokens.slice(keywordIndex + 1).find(token => String(token?.kind || "") === "IdentifierToken");
        if (keywordIndex >= 0 && nameToken) {
          const modifiers = tokens.slice(0, keywordIndex).map(token => String(token.text || "")).filter(Boolean).join(" ");
          const members = children.filter(child => /(?:Declaration|Member)$/.test(String(child?.kind || "")));
          const attributes = children.filter(child => String(child?.kind || "") === "AttributeList");
          const typeParameterList = children.find(child => String(child?.kind || "") === "TypeParameterList");
          const typeParameters = typeParameterList
            ? directSyntaxChildren(typeParameterList).filter(child => String(child?.kind || "") === "TypeParameter")
            : [];
          const primaryConstructor = children.find(child => String(child?.kind || "") === "ParameterList");
          const primaryParameters = primaryConstructor
            ? directSyntaxChildren(primaryConstructor).filter(child => String(child?.kind || "") === "Parameter")
            : [];
          const baseList = children.find(child => String(child?.kind || "") === "BaseList");
          const baseTypes = baseList ? directSyntaxChildren(baseList) : [];
          const constraints = children.filter(child => String(child?.kind || "") === "TypeParameterConstraintClause");
          return addSemanticNode("csharp.typeDeclaration", {
            kind: typeDeclarationKind.get(kind),
            name: String(nameToken.text || window.RMLI18n.t("ui.literal.d623f6f1bce4")),
            modifiers
          }, {
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, window.RMLI18n.t("ui.literal.a6652617f2c7")),
            typeParameters: addSyntaxSequence(typeParameters, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.c50d144660c5")),
            primaryConstructor: addSyntaxSequence(primaryParameters, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.dec25a7ce77a")),
            baseTypes: addSyntaxSequence(baseTypes, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.fb6d805e2be1")),
            constraints: addSyntaxSequence(constraints, "newline", depth + 1, window.RMLI18n.t("ui.literal.52e68a873a2b")),
            members: addSyntaxSequence(
              members,
              typeDeclarationKind.get(kind) === "enum" ? "commaSpace" : "newline",
              depth + 1,
              window.RMLI18n.t("ui.literal.1cb449c11266")
            )
          }, depth, kind);
        }
      }

      if (!significantTrivia && (kind === window.RMLI18n.t("ui.literal.40506f2c9a8e") || kind === window.RMLI18n.t("ui.literal.0c8743d5b136"))) {
        const parameterList = children.find(child => String(child?.kind || "") === "ParameterList");
        const bodyNode = children.find(child => [window.RMLI18n.t("ui.literal.82dd2cdf36f9"), window.RMLI18n.t("ui.literal.b138c6d3f9ee")].includes(String(child?.kind || "")));
        const tokens = directTokens(syntaxNode).filter(token => token?.isMissing !== true);
        const nameTokenIndex = tokens.findIndex(token => String(token?.kind || "") === "IdentifierToken");
        const core = syntaxCoreText(syntaxNode);
        const headerMatch = /^(?:(.*?) )?([^\s]+) (@?[\p{L}_][\p{L}\p{N}_]*)(?:<[^>{}]+>)?\s*\(/u.exec(core);
        if (parameterList && bodyNode && nameTokenIndex >= 0 && headerMatch && TYPE_TEXT.test(headerMatch[2])) {
          const parameters = directSyntaxChildren(parameterList).filter(child => String(child?.kind || "") === "Parameter");
          const attributes = children.filter(child => String(child?.kind || "") === "AttributeList");
          const typeParameterList = children.find(child => String(child?.kind || "") === "TypeParameterList");
          const typeParameters = typeParameterList
            ? directSyntaxChildren(typeParameterList).filter(child => String(child?.kind || "") === "TypeParameter")
            : [];
          const constraints = children.filter(child => String(child?.kind || "") === "TypeParameterConstraintClause");
          const bodyChildren = String(bodyNode.kind || "") === "Block"
            ? directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")))
            : directSyntaxChildren(bodyNode);
          return addSemanticNode("csharp.method", {
            name: String(tokens[nameTokenIndex].text || headerMatch[3]),
            returnType: headerMatch[2],
            modifiers: String(headerMatch[1] || ""),
            bodyStyle: String(bodyNode.kind || "") === "Block" ? "block" : "expression"
          }, {
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, window.RMLI18n.t("ui.literal.a6652617f2c7")),
            typeParameters: addSyntaxSequence(typeParameters, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.c50d144660c5")),
            parameters: addSyntaxSequence(parameters, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.a975eea30db9")),
            constraints: addSyntaxSequence(constraints, "newline", depth + 1, window.RMLI18n.t("ui.literal.52e68a873a2b")),
            body: addSyntaxSequence(bodyChildren, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.7594963de84d")) {
        const parameterList = children.find(child => String(child?.kind || "") === "ParameterList");
        const bodyNode = children.find(child => [window.RMLI18n.t("ui.literal.82dd2cdf36f9"), window.RMLI18n.t("ui.literal.b138c6d3f9ee")].includes(String(child?.kind || "")));
        const core = syntaxCoreText(syntaxNode);
        const headerMatch = /^(?:(.*?) )?(@?[\p{L}_][\p{L}\p{N}_]*)\s*\(/u.exec(core);
        const initializerNode = children.find(child => /ConstructorInitializer$/.test(String(child?.kind || "")));
        if (parameterList && bodyNode && headerMatch && String(bodyNode.kind || "") === "Block") {
          const parameters = directSyntaxChildren(parameterList).filter(child => String(child?.kind || "") === "Parameter");
          const bodyChildren = directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")));
          const initializerArgumentList = initializerNode
            ? directSyntaxChildren(initializerNode).find(child => String(child?.kind || "") === "ArgumentList")
            : null;
          const initializerArguments = initializerArgumentList
            ? directSyntaxChildren(initializerArgumentList).filter(child => String(child?.kind || "") === "Argument")
            : [];
          return addSemanticNode("csharp.constructor", {
            name: headerMatch[2], modifiers: String(headerMatch[1] || ""), destructor: false,
            initializer: !initializerNode ? "none" : String(initializerNode.kind || "").startsWith("Base") ? "base" : "this"
          }, {
            parameters: addSyntaxSequence(parameters, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.a975eea30db9")),
            initializerArguments: addSyntaxSequence(initializerArguments, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.13eebcfccb0e")),
            body: addSyntaxSequence(bodyChildren, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.b30dff3a9096")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(.*?) )?delegate ([^\s]+) (@?[\p{L}_][\p{L}\p{N}_]*)(?:<[^>{}]+>)?\s*\(/u.exec(core);
        const parameterList = children.find(child => String(child?.kind || "") === "ParameterList");
        if (match && parameterList && TYPE_TEXT.test(match[2])) {
          const parameters = directSyntaxChildren(parameterList).filter(child => String(child?.kind || "") === "Parameter");
          const attributes = children.filter(child => String(child?.kind || "") === "AttributeList");
          const typeParameterList = children.find(child => String(child?.kind || "") === "TypeParameterList");
          const typeParameters = typeParameterList
            ? directSyntaxChildren(typeParameterList).filter(child => String(child?.kind || "") === "TypeParameter")
            : [];
          const constraints = children.filter(child => String(child?.kind || "") === "TypeParameterConstraintClause");
          return addSemanticNode("csharp.delegate", {
            modifiers: String(match[1] || ""), returnType: match[2], name: match[3]
          }, {
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, window.RMLI18n.t("ui.literal.a6652617f2c7")),
            typeParameters: addSyntaxSequence(typeParameters, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.c50d144660c5")),
            parameters: addSyntaxSequence(parameters, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.a975eea30db9")),
            constraints: addSyntaxSequence(constraints, "newline", depth + 1, window.RMLI18n.t("ui.literal.52e68a873a2b"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.e0931bcc1a63")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(.*?)\s+)?([^\s]+)\s+(@?[\p{L}_][\p{L}\p{N}_]*)(?:\s*=\s*([\s\S]+))?;$/u.exec(core);
        const attributes = children.filter(child => String(child?.kind || "") === "AttributeList");
        if (match && TYPE_TEXT.test(match[2])) {
          const equalsValue = findDescendant(syntaxNode, child => String(child?.kind || "") === "EqualsValueClause");
          const initializer = equalsValue ? directSyntaxChildren(equalsValue).at(-1) : null;
          const modifiers = String(match[1] || "");
          return addSemanticNode("csharp.field", {
            name: match[3], type: match[2],
            modifiers: modifiers.replace(/(?:^|\s)const(?:\s|$)/g, " ").trim(),
            constant: /(?:^|\s)const(?:\s|$)/.test(modifiers)
          }, {
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, window.RMLI18n.t("ui.literal.a6652617f2c7")),
            initializer: match[4] && initializer ? addOptimizedSyntaxNode(initializer, depth + 1) : null
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.aef58322a9dd")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(.*?) )?([^\s]+) (@?[\p{L}_][\p{L}\p{N}_]*)\s*(?:\{|=>)/u.exec(core);
        const accessorList = children.find(child => String(child?.kind || "") === "AccessorList");
        const arrow = children.find(child => String(child?.kind || "") === "ArrowExpressionClause");
        if (match && TYPE_TEXT.test(match[2]) && (accessorList || arrow)) {
          const bodyNodes = accessorList
            ? directSyntaxChildren(accessorList).filter(child => String(child?.kind || "") === "AccessorDeclaration")
            : directSyntaxChildren(arrow);
          const attributes = children.filter(child => String(child?.kind || "") === "AttributeList");
          const equalsValue = children.find(child => String(child?.kind || "") === "EqualsValueClause");
          const initializerValue = equalsValue ? directSyntaxChildren(equalsValue).at(-1) : null;
          return addSemanticNode("csharp.property", {
            name: match[3], type: match[2], modifiers: String(match[1] || ""),
            indexer: false, bodyStyle: arrow ? "expression" : "accessors"
          }, {
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, window.RMLI18n.t("ui.literal.a6652617f2c7")),
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, window.RMLI18n.t("ui.literal.f5b0e226ed89")),
            initializer: initializerValue ? addOptimizedSyntaxNode(initializerValue, depth + 1) : null
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.6c76e7f3b77b")) {
        const core = syntaxCoreText(syntaxNode);
        const accessorMatch = /^(?:(.*?) )?(get|set|init|add|remove)(?:;|\s*=>|\s*\{)/.exec(core);
        if (accessorMatch) {
          const bodyNode = children.find(child => [window.RMLI18n.t("ui.literal.82dd2cdf36f9"), window.RMLI18n.t("ui.literal.b138c6d3f9ee")].includes(String(child?.kind || "")));
          const bodyChildren = bodyNode
            ? String(bodyNode.kind || "") === "Block"
              ? directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")))
              : directSyntaxChildren(bodyNode)
            : [];
          return addSemanticNode("csharp.accessor", {
            kind: accessorMatch[2], modifiers: String(accessorMatch[1] || ""),
            bodyStyle: !bodyNode ? "semicolon" : String(bodyNode.kind || "") === "Block" ? "block" : "expression"
          }, {
            body: addSyntaxSequence(bodyChildren, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.d343d5064763")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(.*?)\s+)?event\s+([^\s]+)\s+(@?[\p{L}_][\p{L}\p{N}_]*)(?:\s*=\s*([\s\S]+))?;$/u.exec(core);
        if (match && TYPE_TEXT.test(match[2])) {
          const equalsValue = findDescendant(syntaxNode, child => String(child?.kind || "") === "EqualsValueClause");
          const initializer = equalsValue ? directSyntaxChildren(equalsValue).at(-1) : null;
          return addSemanticNode("csharp.event", {
            name: match[3], type: match[2], modifiers: String(match[1] || "")
          }, {
            initializer: match[4] && initializer ? addOptimizedSyntaxNode(initializer, depth + 1) : null
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.3021e85daaf8")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(.*?) )?event ([^\s]+) (@?[\p{L}_][\p{L}\p{N}_]*)\s*\{/u.exec(core);
        const accessorList = children.find(child => String(child?.kind || "") === "AccessorList");
        if (match && TYPE_TEXT.test(match[2]) && accessorList) {
          const attributes = children.filter(child => String(child?.kind || "") === "AttributeList");
          const accessors = directSyntaxChildren(accessorList).filter(child => String(child?.kind || "") === "AccessorDeclaration");
          return addSemanticNode("csharp.event", {
            name: match[3], type: match[2], modifiers: String(match[1] || "")
          }, {
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, window.RMLI18n.t("ui.literal.a6652617f2c7")),
            accessors: addSyntaxSequence(accessors, "newline", depth + 1, window.RMLI18n.t("ui.literal.f5b0e226ed89"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.1b1ddd17608c")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(@?[\p{L}_][\p{L}\p{N}_]*)(?:\s*=\s*([\s\S]+))?$/u.exec(core);
        if (match) {
          const valueNode = children.at(-1);
          return addSemanticNode("csharp.enumMember", { name: match[1] }, {
            value: match[2] && valueNode ? addOptimizedSyntaxNode(valueNode, depth + 1) : null
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.2e6df5ca827b")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(const|using|await using|ref readonly|ref|scoped ref|scoped)\s+)?([^\s]+)\s+(@?[\p{L}_][\p{L}\p{N}_]*)(?:\s*=\s*([\s\S]+))?;$/u.exec(core);
        if (match && (match[2] === "var" || TYPE_TEXT.test(match[2]))) {
          const equalsValue = findDescendant(syntaxNode, child => String(child?.kind || "") === "EqualsValueClause");
          const initializer = equalsValue ? directSyntaxChildren(equalsValue).at(-1) : null;
          return addSemanticNode("csharp.localDeclaration", {
            modifier: match[1] || "none", type: match[2], name: match[3]
          }, {
            initializer: match[4] && initializer ? addOptimizedSyntaxNode(initializer, depth + 1) : null
          }, depth, kind);
        }
      }
      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.377a6210f321")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^([^,=]+?)\s+(@?[\p{L}_][\p{L}\p{N}_]*)(?:\s*=\s*([\s\S]+))?$/u.exec(core);
        const declarators = children.filter(child => String(child?.kind || "") === "VariableDeclarator");
        if (match && declarators.length === 1 && (match[1].trim() === "var" || TYPE_TEXT.test(match[1].trim()))) {
          const equalsValue = findDescendant(declarators[0], child => String(child?.kind || "") === "EqualsValueClause");
          const initializer = equalsValue ? directSyntaxChildren(equalsValue).at(-1) : null;
          return addSemanticNode("csharp.localDeclaration", {
            modifier: "none",
            type: match[1].trim(),
            name: match[2],
            omitSemicolon: true
          }, {
            initializer: match[3] && initializer ? addOptimizedSyntaxNode(initializer, depth + 1) : null
          }, depth, kind);
        }
      }
      if (kind === window.RMLI18n.t("ui.literal.9398fb0ae4dc") && children.length === 1) {
        const child = children[0];
        const childText = syntaxCoreText(child);
        const binaryOperator = binaryOperatorByKind.get(String(child?.kind || ""));
        const binaryChildren = directSyntaxChildren(child);
        if (binaryOperator && binaryChildren.length === 2) {
          const leftText = syntaxCoreText(binaryChildren[0]);
          const rightText = syntaxCoreText(binaryChildren[1]);
          if (!significantTrivia && semanticValue === `(${leftText} ${binaryOperator} ${rightText})`) {
            return addSemanticNode("csharp.binary", { operator: binaryOperator }, {
              left: addOptimizedSyntaxNode(binaryChildren[0], depth + 1),
              right: addOptimizedSyntaxNode(binaryChildren[1], depth + 1)
            }, depth, kind);
          }
        }
        if (!significantTrivia && semanticValue === `(${childText})`) {
          return addSemanticNode("csharp.delimited", {
            delimiter: "parentheses", layout: "inline", suffix: "none"
          }, { content: addOptimizedSyntaxNode(child, depth + 1) }, depth, kind);
        }
      }

      if ((kind === window.RMLI18n.t("ui.literal.e0d6f8050968") || kind === window.RMLI18n.t("ui.literal.edf4eccd35aa")) && children.length === 2) {
        const leftText = syntaxCoreText(children[0]);
        const rightText = syntaxCoreText(children[1]);
        if (!significantTrivia && semanticValue.replace(/\s+/g, "") === `${leftText}.${rightText}`.replace(/\s+/g, "")) {
          if (kind === window.RMLI18n.t("ui.literal.e0d6f8050968")) {
            const member = rightText.replace(/<.*>$/, "").replace(/^@/, "");
            const enumMember = catalogEnumMember(children[0], member);
            if (enumMember) {
              const { operatorId, definition, value } = enumMember;
              return addNode(operatorId, { value }, depth, definition.title || kind);
            }
            const owner = inferExpressionType(children[0]);
            const candidates = [
              ...catalogMembers(owner, "property-get", member),
              ...catalogMembers(owner, "field-get", member)
            ];
            if (candidates.length === 1) {
              const [{ operatorId, definition }] = candidates;
              const id = addNode(operatorId, {
                customCSharpStaticTarget: definition.apiIsStatic === true ? leftText : ""
              }, depth, definition.title || kind);
              if (definition.apiIsStatic !== true) {
                connect(addOptimizedSyntaxNode(children[0], depth + 1), id, "target");
              }
              return id;
            }
          }
          if (QUALIFIED_NAME.test(semanticValue)) {
            return addNode("csharp.qualifiedAccess", { path: semanticValue }, depth, kind);
          }
          return addSemanticNode("csharp.memberAccess", {}, {
            target: addOptimizedSyntaxNode(children[0], depth + 1),
            member: addOptimizedSyntaxNode(children[1], depth + 1)
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.54d759f30520") && children.length >= 2) {
        const catalogInvocation = resolveCatalogInvocation(syntaxNode);
        if (catalogInvocation) {
          return addCatalogInvocation(catalogInvocation, depth, kind);
        }
        const target = children[0];
        const argumentList = children.find(child => String(child?.kind || "") === "ArgumentList");
        if (argumentList) {
          const argumentsList = directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument");
          const targetText = syntaxCoreText(target);
          if (TYPE_TEXT.test(targetText)) {
            const argumentIds = argumentsList.map(argument => addOptimizedSyntaxNode(argument, depth + 1));
            const invocationId = addNode("csharp.compactInvocation", {
              target: targetText,
              variadicInputCount: Math.max(2, argumentIds.length)
            }, depth, kind);
            argumentIds.forEach((argumentId, index) => connect(argumentId, invocationId, portId(index)));
            return invocationId;
          }
          return addSemanticNode("csharp.invocation", {}, {
            target: addOptimizedSyntaxNode(target, depth + 1),
            arguments: addSyntaxSequence(argumentsList, "commaSpace", depth + 1, window.RMLI18n.t("ui.auto.cda21d9622e7"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.00d549f48caa")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^((?:global::)?@?[\p{L}_][\p{L}\p{N}_]*(?:(?:::|\.)@?[\p{L}_][\p{L}\p{N}_]*)*)\?\.(@?[\p{L}_][\p{L}\p{N}_]*)\((.*)\)$/u.exec(core);
        const argumentList = findDescendant(syntaxNode, child => String(child?.kind || "") === "ArgumentList");
        if (match && argumentList) {
          const argumentsList = directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument");
          const argumentIds = argumentsList.map(argument => addOptimizedSyntaxNode(argument, depth + 1));
          const id = addNode("csharp.conditionalInvocation", {
            target: match[1], member: match[2], variadicInputCount: Math.max(2, argumentIds.length)
          }, depth, kind);
          argumentIds.forEach((argumentId, index) => connect(argumentId, id, portId(index)));
          return id;
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.ffe3de5640e0") && children.length >= 2) {
        const target = children[0];
        const argumentList = children.find(child => String(child?.kind || "") === "BracketedArgumentList");
        if (argumentList) {
          const argumentsList = directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument");
          const owner = inferExpressionType(target);
          const candidates = catalogMembers(owner, "property-get", window.RMLI18n.t("ui.auto.be2f2387e7ac")).filter(({ definition }) => {
            const parameters = Array.isArray(definition.apiParameters) ? definition.apiParameters : [];
            return parameters.length === argumentsList.length &&
              argumentsList.every((argument, index) => parameterAcceptsType(parameters[index], inferExpressionType(argumentValueNode(argument))));
          });
          if (candidates.length === 1) {
            const [{ operatorId, definition }] = candidates;
            const id = addNode(operatorId, {}, depth, definition.title || kind);
            if (definition.apiIsStatic !== true) connect(addOptimizedSyntaxNode(target, depth + 1), id, "target");
            argumentsList.forEach((argument, index) => {
              connect(addOptimizedSyntaxNode(argumentValueNode(argument), depth + 1), id, `arg${index}`);
            });
            return id;
          }
          return addSemanticNode("csharp.elementAccess", {}, {
            target: addOptimizedSyntaxNode(target, depth + 1),
            arguments: addSyntaxSequence(argumentsList, "commaSpace", depth + 1, window.RMLI18n.t("ui.auto.cda21d9622e7"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && binaryOperatorByKind.has(kind) && children.length === 2) {
        return addSemanticNode("csharp.binary", { operator: binaryOperatorByKind.get(kind) }, {
          left: addOptimizedSyntaxNode(children[0], depth + 1),
          right: addOptimizedSyntaxNode(children[1], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.4a1836c9604a") && children.length === 2) {
        return addSemanticNode("csharp.binary", { operator: "is" }, {
          left: addOptimizedSyntaxNode(children[0], depth + 1),
          right: addOptimizedSyntaxNode(children[1], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && [window.RMLI18n.t("ui.literal.b6f5a726974c"), window.RMLI18n.t("ui.literal.942bb3f6bc9d"), window.RMLI18n.t("ui.literal.c37dec570824")].includes(kind) && children.length === 1) {
        return addOptimizedSyntaxNode(children[0], depth);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.e219b5503a3e") && children.length === 1) {
        return addSemanticNode("csharp.unary", { operator: "not" }, {
          operand: addOptimizedSyntaxNode(children[0], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && [window.RMLI18n.t("ui.literal.c46fa24a10cb"), window.RMLI18n.t("ui.literal.388b7debfa5a")].includes(kind) && children.length === 2) {
        return addSemanticNode("csharp.binary", {
          operator: kind === window.RMLI18n.t("ui.literal.c46fa24a10cb") ? "and" : "or"
        }, {
          left: addOptimizedSyntaxNode(children[0], depth + 1),
          right: addOptimizedSyntaxNode(children[1], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && unaryOperatorByKind.has(kind) && children.length === 1) {
        const operator = unaryOperatorByKind.get(kind);
        if (operator !== "!post") {
          return addSemanticNode("csharp.unary", { operator }, {
            operand: addOptimizedSyntaxNode(children[0], depth + 1)
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.25e55b52ee2f") && children.length === 2) {
        const typeText = syntaxCoreText(children[0]);
        if (TYPE_TEXT.test(typeText)) {
          return addSemanticNode("csharp.cast", { type: typeText }, {
            value: addOptimizedSyntaxNode(children[1], depth + 1)
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.44fb8e121d1a")) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^new\s+([^\s([{]+(?:<[^{};=]+>)?)\s*\(/u.exec(core);
        const argumentList = children.find(child => String(child?.kind || "") === "ArgumentList");
        const initializer = children.find(child => String(child?.kind || "") === "ObjectInitializerExpression");
        if (match && argumentList && TYPE_TEXT.test(match[1])) {
          const argumentsList = directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument");
          const initializerItems = initializer ? directSyntaxChildren(initializer) : [];
          if (initializerItems.length === 0) {
            const owner = resolveCatalogType(match[1]);
            let constructors = catalogMembers(owner, "constructor", "").filter(({ definition }) => {
              const parameters = Array.isArray(definition.apiParameters) ? definition.apiParameters : [];
              if (parameters.some(parameter => parameter?.isOut === true || parameter?.isByRef === true)) return false;
              const required = parameters.filter(parameter => parameter?.isOptional !== true && parameter?.hasDefaultValue !== true).length;
              return argumentsList.length >= required && argumentsList.length <= parameters.length &&
                argumentsList.every((argument, index) => parameterAcceptsType(parameters[index], inferExpressionType(argumentValueNode(argument))));
            });
            if (constructors.length === 1) {
              const [{ operatorId, definition }] = constructors;
              const id = addNode(operatorId, {
                customCSharpTypeText: match[1]
              }, depth, definition.title || kind);
              argumentsList.forEach((argument, index) => {
                connect(addOptimizedSyntaxNode(argumentValueNode(argument), depth + 1), id, `arg${index}`);
              });
              return id;
            }
          }
          return addSemanticNode("csharp.objectCreation", { type: match[1], kind: "object" }, {
            arguments: addSyntaxSequence(argumentsList, "commaSpace", depth + 1, window.RMLI18n.t("ui.auto.cda21d9622e7")),
            initializer: addSyntaxSequence(initializerItems, "commaSpace", depth + 1, window.RMLI18n.t("ui.auto.bb8835da9f7c"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.3fa5ed62b65d") && children.length === 3) {
        return addSemanticNode("csharp.conditional", {}, {
          condition: addOptimizedSyntaxNode(children[0], depth + 1),
          true: addOptimizedSyntaxNode(children[1], depth + 1),
          false: addOptimizedSyntaxNode(children[2], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && [window.RMLI18n.t("ui.literal.0e935dd3c533"), window.RMLI18n.t("ui.literal.07cd67696361"), window.RMLI18n.t("ui.literal.19d12bc5ed0e")].includes(kind)) {
        const bodyNode = children.at(-1);
        const parameterContainer = children.find(child => String(child?.kind || "") === "ParameterList");
        const parameters = parameterContainer
          ? directSyntaxChildren(parameterContainer).filter(child => String(child?.kind || "") === "Parameter")
          : children.filter(child => String(child?.kind || "") === "Parameter");
        if (bodyNode) {
          const blockBody = String(bodyNode.kind || "") === "Block";
          const bodyNodes = blockBody
            ? directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")))
            : [bodyNode];
          const core = syntaxCoreText(syntaxNode);
          const modifierMatch = /^(?:(static|async)\s+|((?:static\s+async|async\s+static))\s+)?/.exec(core);
          return addSemanticNode("csharp.lambda", {
            kind: kind === window.RMLI18n.t("ui.literal.19d12bc5ed0e") ? "anonymous" : "lambda",
            modifiers: String(modifierMatch?.[1] || modifierMatch?.[2] || ""),
            expressionBody: !blockBody
          }, {
            parameters: addSyntaxSequence(parameters, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.a975eea30db9")),
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
          }, depth, kind);
        }
      }

      if (assignmentOperatorByKind.has(kind) && children.length === 2) {
        const operator = assignmentOperatorByKind.get(kind);
        if (!significantTrivia) {
          if (operator === "=" && String(children[0]?.kind || "") === "SimpleMemberAccessExpression") {
            const accessChildren = directSyntaxChildren(children[0]);
            if (accessChildren.length === 2) {
              const owner = inferExpressionType(accessChildren[0]);
              const member = syntaxCoreText(accessChildren[1]).replace(/^@/, "");
              const candidates = [
                ...catalogMembers(owner, "property-set", member),
                ...catalogMembers(owner, "field-set", member)
              ];
              if (candidates.length === 1) {
                const [{ operatorId, definition }] = candidates;
                const id = addNode(operatorId, {
                  customCSharpStaticTarget: definition.apiIsStatic === true
                    ? syntaxCoreText(accessChildren[0])
                    : ""
                }, depth, definition.title || kind);
                if (definition.apiIsStatic !== true) {
                  connect(addOptimizedSyntaxNode(accessChildren[0], depth + 1), id, "target");
                }
                connect(addOptimizedSyntaxNode(children[1], depth + 1), id, "value");
                return id;
              }
            }
          }
          if (operator === "=" && String(children[0]?.kind || "") === "ElementAccessExpression") {
            const accessChildren = directSyntaxChildren(children[0]);
            const target = accessChildren[0];
            const argumentList = accessChildren.find(child => String(child?.kind || "") === "BracketedArgumentList");
            const argumentsList = argumentList
              ? directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument")
              : [];
            const owner = inferExpressionType(target);
            const candidates = catalogMembers(owner, "property-set", window.RMLI18n.t("ui.auto.be2f2387e7ac")).filter(({ definition }) => {
              const parameters = Array.isArray(definition.apiParameters) ? definition.apiParameters : [];
              return parameters.length === argumentsList.length + 1 &&
                argumentsList.every((argument, index) => parameterAcceptsType(parameters[index], inferExpressionType(argumentValueNode(argument))));
            });
            if (candidates.length === 1) {
              const [{ operatorId, definition }] = candidates;
              const id = addNode(operatorId, {}, depth, definition.title || kind);
              if (definition.apiIsStatic !== true) connect(addOptimizedSyntaxNode(target, depth + 1), id, "target");
              argumentsList.forEach((argument, index) => {
                connect(addOptimizedSyntaxNode(argumentValueNode(argument), depth + 1), id, `arg${index}`);
              });
              connect(addOptimizedSyntaxNode(children[1], depth + 1), id, "value");
              return id;
            }
          }
          return addSemanticNode("csharp.assignment", { operator }, {
            target: addOptimizedSyntaxNode(children[0], depth + 1),
            value: addOptimizedSyntaxNode(children[1], depth + 1)
          }, depth, kind);
        }
      }

      if (kind === window.RMLI18n.t("ui.literal.ce5e5792e97f") && children.length === 1) {
        const childText = syntaxCoreText(children[0]);
        const match = /^(?:(@?[\p{L}_][\p{L}\p{N}_]*):\s*)?(?:(ref|out|in)\s+)?([\s\S]+)$/u.exec(semanticValue);
        if (match && match[3] === childText) {
          if (!match[1] && !match[2]) {
            return addOptimizedSyntaxNode(children[0], depth);
          }
          return addSemanticNode("csharp.argument", {
            modifier: match[2] || "none", name: match[1] || ""
          }, { value: addOptimizedSyntaxNode(children[0], depth + 1) }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.82c424b7606f") && children.length === 1) {
        return addSemanticNode("csharp.expressionStatement", {}, {
          expression: addOptimizedSyntaxNode(children[0], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.b24030051799") && children.length >= 2) {
        const condition = children[0];
        const thenNode = children[1];
        const elseClause = children.find(child => String(child?.kind || "") === "ElseClause");
        const thenNodes = String(thenNode?.kind || "") === "Block"
          ? directSyntaxChildren(thenNode).filter(child => /Statement$/.test(String(child?.kind || "")))
          : [thenNode];
        const elseStatement = elseClause ? directSyntaxChildren(elseClause).at(-1) : null;
        const elseNodes = !elseStatement ? [] : String(elseStatement?.kind || "") === "Block"
          ? directSyntaxChildren(elseStatement).filter(child => /Statement$/.test(String(child?.kind || "")))
          : [elseStatement];
        return addSemanticNode("csharp.if", {}, {
          condition: addOptimizedSyntaxNode(condition, depth + 1),
          then: addSyntaxSequence(thenNodes, "newline", depth + 1, window.RMLI18n.t("ui.literal.b7d93209feaa")),
          else: addSyntaxSequence(elseNodes, "newline", depth + 1, window.RMLI18n.t("ui.literal.a9c075ef1bb9"))
        }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.b22709839352") && children.length === 1) {
        const match = /^(@?[\p{L}_][\p{L}\p{N}_]*):/u.exec(syntaxCoreText(syntaxNode));
        if (match) {
          return addSemanticNode("csharp.label", { name: match[1] }, {
            statement: addOptimizedSyntaxNode(children[0], depth + 1)
          }, depth, kind);
        }
      }

      if (!significantTrivia && resourceKindBySyntaxKind.has(kind) && children.length >= 1) {
        const bodyNode = children.at(-1);
        const resourceNode = children.length > 1 ? children[0] : null;
        const bodyNodes = String(bodyNode?.kind || "") === "Block"
          ? directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")))
          : [bodyNode];
        return addSemanticNode("csharp.resourceStatement", {
          kind: resourceKindBySyntaxKind.get(kind)
        }, {
          resource: resourceNode ? addOptimizedSyntaxNode(resourceNode, depth + 1) : null,
          body: addSyntaxSequence(bodyNodes, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
        }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.4572a0ed476d")) {
        const bodyNode = children.find(child => String(child?.kind || "") === "Block");
        const declaration = children.find(child => String(child?.kind || "") === "CatchDeclaration");
        const filter = children.find(child => String(child?.kind || "") === "CatchFilterClause");
        const declarationMatch = declaration
          ? /^\(([^\s)]+)(?:\s+(@?[\p{L}_][\p{L}\p{N}_]*))?\)$/u.exec(syntaxCoreText(declaration))
          : null;
        if (bodyNode && (!declaration || declarationMatch)) {
          const bodyNodes = directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")));
          const filterValue = filter ? directSyntaxChildren(filter).at(-1) : null;
          return addSemanticNode("csharp.catch", {
            catchAll: !declaration,
            type: declarationMatch?.[1] || "System.Exception",
            name: declarationMatch?.[2] || "exception"
          }, {
            filter: filterValue ? addOptimizedSyntaxNode(filterValue, depth + 1) : null,
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.7b1fdcae82a3")) {
        const bodyNode = children.find(child => String(child?.kind || "") === "Block");
        const catches = children.filter(child => String(child?.kind || "") === "CatchClause");
        const finallyClause = children.find(child => String(child?.kind || "") === "FinallyClause");
        if (bodyNode) {
          const bodyNodes = directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")));
          const finallyBlock = finallyClause
            ? directSyntaxChildren(finallyClause).find(child => String(child?.kind || "") === "Block")
            : null;
          const finallyNodes = finallyBlock
            ? directSyntaxChildren(finallyBlock).filter(child => /Statement$/.test(String(child?.kind || "")))
            : [];
          return addSemanticNode("csharp.try", {}, {
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b")),
            catches: addSyntaxSequence(catches, "newline", depth + 1, window.RMLI18n.t("ui.literal.5e59a1d3b6be")),
            finally: addSyntaxSequence(finallyNodes, "newline", depth + 1, window.RMLI18n.t("ui.auto.19d2c63707cf"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.9ee88ef977cf") && children.length >= 1) {
        const valueNode = children[0];
        const sections = children.filter(child => String(child?.kind || "") === "SwitchSection");
        return addSemanticNode("csharp.switch", { expression: false }, {
          value: addOptimizedSyntaxNode(valueNode, depth + 1),
          sections: addSyntaxSequence(sections, "newline", depth + 1, window.RMLI18n.t("ui.literal.7ff5a6dafd80"))
        }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.50b43de706f4")) {
        const labels = children.filter(child => /SwitchLabel$/.test(String(child?.kind || "")));
        const statements = children.filter(child => /Statement$/.test(String(child?.kind || "")));
        if (labels.length === 1) {
          const label = labels[0];
          const isDefault = String(label.kind || "") === "DefaultSwitchLabel";
          const labelChildren = directSyntaxChildren(label);
          const pattern = isDefault ? null : labelChildren[0] || null;
          const whenClause = labelChildren.find(child => String(child?.kind || "") === "WhenClause");
          const whenValue = whenClause ? directSyntaxChildren(whenClause).at(-1) : null;
          return addSemanticNode("csharp.switchSection", {
            expressionArm: false, default: isDefault
          }, {
            pattern: pattern ? addOptimizedSyntaxNode(pattern, depth + 1) : null,
            when: whenValue ? addOptimizedSyntaxNode(whenValue, depth + 1) : null,
            body: addSyntaxSequence(statements, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.32490648215d") && children.length >= 1) {
        const valueNode = children[0];
        const arms = children.filter(child => String(child?.kind || "") === "SwitchExpressionArm");
        return addSemanticNode("csharp.switch", { expression: true }, {
          value: addOptimizedSyntaxNode(valueNode, depth + 1),
          sections: addSyntaxSequence(arms, "newline", depth + 1, window.RMLI18n.t("ui.literal.047072f53ca8"))
        }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.8f7391ba8568") && children.length >= 2) {
        const whenClause = children.find(child => String(child?.kind || "") === "WhenClause");
        const pattern = children[0];
        const result = children.at(-1);
        const whenValue = whenClause ? directSyntaxChildren(whenClause).at(-1) : null;
        return addSemanticNode("csharp.switchSection", {
          expressionArm: true, default: false
        }, {
          pattern: addOptimizedSyntaxNode(pattern, depth + 1),
          when: whenValue ? addOptimizedSyntaxNode(whenValue, depth + 1) : null,
          body: addOptimizedSyntaxNode(result, depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && [window.RMLI18n.t("ui.literal.fe393d5a7229"), window.RMLI18n.t("ui.literal.9b2d01c2afc1")].includes(kind) && children.length >= 2) {
        const condition = kind === window.RMLI18n.t("ui.literal.fe393d5a7229") ? children[0] : children.at(-1);
        const bodyNode = kind === window.RMLI18n.t("ui.literal.fe393d5a7229") ? children[1] : children[0];
        const bodyNodes = String(bodyNode?.kind || "") === "Block"
          ? directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")))
          : [bodyNode];
        return addSemanticNode("csharp.loop", {
          kind: kind === window.RMLI18n.t("ui.literal.9b2d01c2afc1") ? "do" : "while", iterator: "item", iteratorType: "var"
        }, {
          condition: addOptimizedSyntaxNode(condition, depth + 1),
          body: addSyntaxSequence(bodyNodes, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
        }, depth, kind);
      }

      if (!significantTrivia && kind === window.RMLI18n.t("ui.literal.0512a8baa5c7")) {
        const semicolons = directTokens(syntaxNode)
          .filter(token => String(token?.kind || "") === "SemicolonToken")
          .sort((left, right) => Number(left.start) - Number(right.start));
        const bodyNode = children.at(-1);
        if (semicolons.length === 2 && bodyNode) {
          const first = Number(semicolons[0].start);
          const second = Number(semicolons[1].start);
          const headerNodes = children.slice(0, -1);
          const initializers = headerNodes.filter(child => Number(child?.start) < first);
          const conditions = headerNodes.filter(child => Number(child?.start) > first && Number(child?.start) < second);
          const increments = headerNodes.filter(child => Number(child?.start) > second);
          const bodyNodes = String(bodyNode?.kind || "") === "Block"
            ? directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")))
            : [bodyNode];
          return addSemanticNode("csharp.loop", {
            kind: "for", iterator: "item", iteratorType: "var"
          }, {
            initializer: addSyntaxSequence(initializers, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.db5e65d8fc7d")),
            condition: addSyntaxSequence(conditions, "commaSpace", depth + 1, window.RMLI18n.t("ui.auto.6756b63c2646")),
            increment: addSyntaxSequence(increments, "commaSpace", depth + 1, window.RMLI18n.t("ui.literal.d12f1fabbb58")),
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
          }, depth, kind);
        }
      }

      if (!significantTrivia && [window.RMLI18n.t("ui.literal.1f9815b51681"), window.RMLI18n.t("ui.literal.bf6df4452237")].includes(kind)) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(await )?foreach \(([^\s]+) (@?[\p{L}_][\p{L}\p{N}_]*) in /u.exec(core);
        const bodyNode = children.at(-1);
        const collection = children.length >= 2 ? children.at(-2) : null;
        if (match && bodyNode && collection) {
          const bodyNodes = String(bodyNode?.kind || "") === "Block"
            ? directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")))
            : [bodyNode];
          return addSemanticNode("csharp.loop", {
            kind: match[1] ? "await foreach" : "foreach", iteratorType: match[2], iterator: match[3]
          }, {
            condition: addOptimizedSyntaxNode(collection, depth + 1),
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, window.RMLI18n.t("ui.auto.ec672784079b"))
          }, depth, kind);
        }
      }

      if (jumpKindBySyntaxKind.has(kind)) {
        const jumpKind = jumpKindBySyntaxKind.get(kind);
        const childText = children.length === 1 ? syntaxText(children[0]) : "";
        const expected = ["break", "continue", "yield break", "goto default"].includes(jumpKind)
          ? `${jumpKind};`
          : `${jumpKind}${childText ? ` ${childText}` : ""};`;
        if (!significantTrivia && semanticValue.replace(/\s+/g, " ").trim() === expected.replace(/\s+/g, " ").trim()) {
          return addSemanticNode("csharp.jump", { kind: jumpKind }, {
            value: children.length === 1 ? addOptimizedSyntaxNode(children[0], depth + 1) : null
          }, depth, kind);
        }
      }

      if (keywordByKind.has(kind) && children.length === 1) {
        const keyword = keywordByKind.get(kind);
        if (!significantTrivia && semanticValue.replace(/\s+/g, "") === `${keyword}(${syntaxCoreText(children[0])})`.replace(/\s+/g, "")) {
          return addSemanticNode("csharp.keywordExpression", { keyword }, {
            value: addOptimizedSyntaxNode(children[0], depth + 1)
          }, depth, kind);
        }
      }
      return null;
    };

    let preserveWhitespaceContext = 0;
    addOptimizedSyntaxNode = (syntaxNode, depth = 0, preserveExact = false) => {
      const effectivePreserve = preserveExact || preserveWhitespaceContext > 0;
      if (preserveExact) preserveWhitespaceContext += 1;
      try {
        const semanticId = effectivePreserve
          ? null
          : tryAddSemanticNode(syntaxNode, depth);
        return semanticId
          ? wrapSemanticTrivia(syntaxNode, semanticId, depth, effectivePreserve)
          : addSyntaxNode(syntaxNode, depth);
      } finally {
        if (preserveExact) preserveWhitespaceContext -= 1;
      }
    };

    const rootChildren = String(parseResult.root?.kind || "") === "CompilationUnit"
      ? directSyntaxChildren(parseResult.root)
      : [];
    let rootSyntaxNodeId;
    if (options.semanticOptimization === false) {
      rootSyntaxNodeId = addSyntaxNode(parseResult.root, 0);
    } else if (rootChildren.length === 1 && syntaxText(rootChildren[0]) === sourceText) {
      rootSyntaxNodeId = addOptimizedSyntaxNode(rootChildren[0], 0);
    } else {
      rootSyntaxNodeId = addOptimizedSyntaxNode(parseResult.root, 0);
    }
    const fileId = addNode("csharp.file", {
      fileName,
      projectId,
      nullable: options.nullable || "inherit",
      autoGeneratedHeader: options.autoGeneratedHeader === true
    }, 0, fileName);
    connect(rootSyntaxNodeId, fileId, "content");

    const childrenByParent = new Map();
    for (const edge of connections) {
      const list = childrenByParent.get(edge.toNode) || [];
      list.push(edge.fromNode);
      childrenByParent.set(edge.toNode, list);
    }
    let leafRow = 0;
    const yById = new Map();
    const placeSubtree = nodeId => {
      const childIds = childrenByParent.get(nodeId) || [];
      if (childIds.length === 0) {
        const y = 140 + leafRow * 150;
        leafRow += 1;
        yById.set(nodeId, y);
        return y;
      }
      const childYs = childIds.map(placeSubtree);
      const y = (childYs[0] + childYs[childYs.length - 1]) / 2;
      yById.set(nodeId, y);
      return y;
    };
    placeSubtree(fileId);

    const maximumDepth = Math.max(0, ...layoutDepthById.values());
    const nodesByColumn = new Map();
    for (const node of nodes) {
      const column = node.id === fileId
        ? maximumDepth + 1
        : maximumDepth - (layoutDepthById.get(node.id) || 0);
      node.x = 140 + column * 390;
      node.y = yById.get(node.id) || 140;
      const columnNodes = nodesByColumn.get(column) || [];
      columnNodes.push(node);
      nodesByColumn.set(column, columnNodes);
    }

    for (const columnNodes of nodesByColumn.values()) {
      columnNodes.sort((left, right) => left.y - right.y);
      let nextY = 140;
      for (const node of columnNodes) {
        const inputCount = Math.max(0, Number(node.parameters?.variadicInputCount) || 0);
        const estimatedHeight = node.operatorId === "csharp.roslynNode"
          ? 132 + Math.min(inputCount, 512) * 28
          : 150;
        node.y = Math.max(node.y, nextY);
        nextY = node.y + estimatedHeight + 54;
      }
    }
    return {
      ok: true,
      diagnostics: [],
      nodes,
      connections,
      fileNodeId: fileId,
      rootSyntaxNodeId,
      normalizedSource,
      parser: window.RMLI18n.t("index.text.b5e50a2e9087"),
      languageVersion: "14.0"
    };
  }

  function resolveCSharpImportTarget(options = {}) {
    const host = window.RMLDynamicGraphHost;
    const declared = host?.getCSharpImportTarget?.();
    if (declared?.available === false) {
      return {
        ok: false,
        diagnostics: [
          String(
            declared.reason ||
            window.RMLI18n.t("ui.literal.5e8015142003")
          )
        ]
      };
    }
    const state =
      declared?.state ||
      host?.getState?.() ||
      host?.getRootState?.();
    if (
      !state ||
      !Array.isArray(state.nodes) ||
      !Array.isArray(state.connections)
    ) {
      return {
        ok: false,
        diagnostics: [
          window.RMLI18n.t("ui.literal.32d2d33e30ac")
        ]
      };
    }
    const key = String(
      declared?.key || "runtime-root"
    );
    const expectedKey = String(
      options.expectedTargetKey || ""
    );
    if (expectedKey && expectedKey !== key) {
      return {
        ok: false,
        diagnostics: [
          window.RMLI18n.t("ui.literal.043e2864299b")
        ]
      };
    }
    return {
      ok: true,
      host,
      state,
      key,
      kind: String(
        declared?.kind || "runtime-root"
      ),
      label: String(
        declared?.label || window.RMLI18n.t("index.aria_label.755f023e2cc7")
      )
    };
  }

  function csharpImportUsedIds(
    host,
    state
  ) {
    const used = new Set([
      ...state.nodes.map(node =>
        String(node?.id || "")
      ),
      ...state.connections.map(connection =>
        String(connection?.id || "")
      )
    ]);
    const identities =
      host?.getGraphIdentitySets?.();
    for (const values of [
      identities?.nodeIds,
      identities?.connectionIds
    ]) {
      if (!values) continue;
      for (const value of values) {
        const id = String(value || "");
        if (id) used.add(id);
      }
    }
    return used;
  }

  function csharpImportPrefix(
    source,
    target,
    options,
    fallback
  ) {
    return `${options.prefix || fallback}-${stableHash(
      `${target.key}\0${String(options.projectId || "main")}\0${String(options.fileName || window.RMLI18n.t("ui.literal.ee6d86d67877"))}\0${source}`
    )}`;
  }

  function importIntoCurrentGraph(source, options = {}) {
    const target =
      resolveCSharpImportTarget(options);
    if (!target.ok) return target;
    const { host, state } = target;
    let attempt = 0;
    let fragment;
    const usedIds = csharpImportUsedIds(
      host,
      state
    );
    const prefix = csharpImportPrefix(
      source,
      target,
      options,
      "csharp-import"
    );
    do {
      fragment = createImportFragment(source, {
        ...options,
        prefix: `${prefix}-${attempt || 1}`
      });
      attempt += 1;
    } while (fragment.ok && [...fragment.nodes, ...fragment.connections].some(item => usedIds.has(item.id)) && attempt < 100);
    if (!fragment.ok) return fragment;
    return storeCustomCSharpFragment(
      fragment,
      host,
      state,
      source,
      target
    );
  }

  async function importRoslynIntoCurrentGraph(source, parseResult, options = {}) {
    const target =
      resolveCSharpImportTarget(options);
    if (!target.ok) return target;
    const { host, state } = target;
    let attempt = 0;
    let fragment;
    const usedIds = csharpImportUsedIds(
      host,
      state
    );
    const prefix = csharpImportPrefix(
      source,
      target,
      options,
      "csharp14-roslyn-import"
    );
    do {
      fragment = createRoslynImportFragment(source, parseResult, {
        ...options,
        prefix: `${prefix}-${attempt || 1}`
      });
      attempt += 1;
    } while (fragment.ok && [...fragment.nodes, ...fragment.connections].some(item => usedIds.has(item.id)) && attempt < 100);
    if (!fragment.ok) return fragment;
    const validateFragment = async candidate => {
      const prepared = createCustomCSharpFileGraphFromFragment(candidate);
      if (!prepared.ok) return false;
      const rendered = renderCustomCSharpGraph(prepared.customGraph);
      if (!rendered.ok) return false;
      const reparsed = await window.RMLCSharp14Roslyn.parse(rendered.source);
      return reparsed?.ok === true &&
        roslynStructuralSignature(parseResult.root) === roslynStructuralSignature(reparsed.root);
    };
    if (!await validateFragment(fragment)) {
      fragment = createRoslynImportFragment(source, parseResult, {
        ...options,
        prefix: `${prefix}-semantic-${attempt}`,
        disableCatalogNodes: true
      });
    }
    if (!fragment.ok || !await validateFragment(fragment)) {
      fragment = createRoslynImportFragment(source, parseResult, {
        ...options,
        prefix: `${prefix}-exact-${attempt}`,
        disableCatalogNodes: true,
        semanticOptimization: false
      });
      if (!fragment.ok || !await validateFragment(fragment)) {
        return {
          ok: false,
          diagnostics: [
            `Roslyn accepted this file as valid C# 14, but this Builder version could not convert its complete token and meaningful-trivia stream into a lossless editable Custom C# graph. This is a visual-importer limitation, not a damaged source file. ${target.label} was left unchanged and no source data was discarded.`
          ],
          nodes: [], connections: []
        };
      }
    }
    return storeCustomCSharpFragment(
      fragment,
      host,
      state,
      source,
      target
    );
  }

  function createCustomCSharpFileGraphFromFragment(fragment) {
    const mainFileNode = fragment.nodes.find(node => node?.id === fragment.fileNodeId && node?.operatorId === "csharp.file");
    if (!mainFileNode) {
      return { ok: false, diagnostics: [window.RMLI18n.t("ui.literal.5ff5c035c5c8")] };
    }

    const internalNodes = fragment.nodes.map(node => node.id === mainFileNode.id
      ? {
          ...node,
          operatorId: "csharp.customFileOutput",
          label: `Output · ${String(mainFileNode.parameters?.fileName || window.RMLI18n.t("ui.text.e77a632beeb3"))}`,
          parameters: {}
        }
      : node);
    const customGraph = {
      version: 1,
      fileName: String(mainFileNode.parameters?.fileName || window.RMLI18n.t("ui.literal.ee6d86d67877")),
      projectId: String(mainFileNode.parameters?.projectId || "main"),
      parser: String(fragment.parser || window.RMLI18n.t("ui.literal.e888e6feb0d7")),
      languageVersion: String(fragment.languageVersion || "14.0"),
      optimizerVersion: VERSION,
      importedSource: false,
      coordinateSpaceVersion:
        CUSTOM_CSHARP_COORDINATE_SPACE_VERSION,
      sourceHash: stableHash(fragment.normalizedSource || ""),
      outputNodeId: mainFileNode.id,
      rootSyntaxNodeId: String(fragment.rootSyntaxNodeId || ""),
      nodes: internalNodes,
      connections: fragment.connections,
      viewport: { x: 56, y: 54, scale: 0.45 },
      selectedNodeId: mainFileNode.id,
      selectedConnectionId: null,
      selectedWirePoint: null,
      nextSequence: internalNodes.length + fragment.connections.length + 1
    };

    return {
      ok: true,
      diagnostics: [],
      mainFileNode,
      customGraph,
      importedSyntaxNodeCount: internalNodes.length
    };
  }

  function storeCustomCSharpFragment(
    fragment,
    host,
    state,
    originalSource = null,
    target = null
  ) {
    const prepared = createCustomCSharpFileGraphFromFragment(fragment);
    if (!prepared.ok) {
      return { ...prepared, nodes: [], connections: [] };
    }
    const { mainFileNode, importedSyntaxNodeCount } = prepared;
    if (state.nodes.some(node => node?.id === mainFileNode.id)) {
      return { ok: false, diagnostics: [`A node with id '${mainFileNode.id}' already exists in ${target?.label || "the active graph"}.`], nodes: [], connections: [] };
    }

    state.customCSharpFiles = state.customCSharpFiles && typeof state.customCSharpFiles === "object"
      ? state.customCSharpFiles
      : {};
    const importedFileName = String(mainFileNode.parameters?.fileName || window.RMLI18n.t("ui.literal.ee6d86d67877")).trim().toLowerCase();
    const importedProjectId = String(mainFileNode.parameters?.projectId || "main").trim().toLowerCase() || "main";
    const matchingFiles = state.nodes.filter(node =>
      node?.operatorId === "csharp.file" &&
      String(node.parameters?.fileName || "").trim().toLowerCase() === importedFileName &&
      (String(node.parameters?.projectId || "main").trim().toLowerCase() || "main") === importedProjectId
    );
    const runtimeFileNode = matchingFiles[0] || mainFileNode;
    const duplicateIds = new Set(matchingFiles.slice(1).map(node => node.id));
    if (duplicateIds.size > 0) {
      state.nodes = state.nodes.filter(node => !duplicateIds.has(node.id));
      state.connections = state.connections.filter(connection =>
        !duplicateIds.has(connection.fromNode) && !duplicateIds.has(connection.toNode)
      );
      for (const duplicateId of duplicateIds) delete state.customCSharpFiles[duplicateId];
    }
    const viewport = state.viewport && typeof state.viewport === "object"
      ? state.viewport
      : { x: 56, y: 54, scale: 0.9 };
    const scale = Math.max(0.1, Number(viewport.scale) || 0.9);
    if (matchingFiles.length === 0) {
      runtimeFileNode.x = (600 - (Number(viewport.x) || 0)) / scale - 160;
      runtimeFileNode.y = (380 - (Number(viewport.y) || 0)) / scale - 100;
      state.nodes.push(runtimeFileNode);
    }
    runtimeFileNode.parameters = {
      ...(runtimeFileNode.parameters || {}),
      ...(mainFileNode.parameters || {}),
      source: String(originalSource ?? fragment.normalizedSource ?? "")
    };
    prepared.customGraph.sourceHash = stableHash(
      String(originalSource ?? fragment.normalizedSource ?? "")
    );
    prepared.customGraph.importedSource = true;
    state.customCSharpFiles[runtimeFileNode.id] = prepared.customGraph;
    state.selectedNodeId = runtimeFileNode.id;
    state.selectedConnectionId = null;
    state.selectedWirePoint = null;
    state.revision = Math.max(0, Number(state.revision) || 0) + 1;
    state.nextSequence = Math.max(Number(state.nextSequence) || 1, state.nodes.length + state.connections.length + 1);
    const activation = host.ensureActiveMode?.({ activateIfNeeded: true });
    if (activation?.ok !== true) {
      return {
        ok: false,
        diagnostics: [activation?.reason || `${target?.label || window.RMLI18n.t("ui.literal.13170d5fbba1")} could not be presented after importing the C# file.`],
        nodes: [],
        connections: []
      };
    }
    host.commit?.({
      documentChanged:
        activation?.documentMutationAccepted !== true,
      mutationClass: "topology",
      refreshGeneratedOutput: true,
      refreshCompositeActions: true
    });
    return {
      ...fragment,
      nodes: [runtimeFileNode],
      connections: [],
      importedSyntaxNodeCount,
      openedCustomCSharpGraph: false,
      replacedExistingFile: matchingFiles.length > 0,
      removedDuplicateFileCount: duplicateIds.size,
      targetKey: String(
        target?.key || "runtime-root"
      ),
      targetKind: String(
        target?.kind || "runtime-root"
      ),
      targetLabel: String(
        target?.label || window.RMLI18n.t("index.aria_label.755f023e2cc7")
      )
    };
  }

  function installCSharpImportControl() {
    const actions = document.querySelector?.(".project-file-actions");
    if (!actions || document.getElementById?.("project-import-csharp")) return;

    const expertPanel = document.createElement("details");
    expertPanel.className = "project-csharp-import-expert";

    const refreshExpertPanelVisibility = () => {
      const host = window.RMLDynamicGraphHost;
      const editorState = host?.getCustomCSharpEditorState?.();
      if (editorState?.active === true) {
        expertPanel.hidden = true;
        expertPanel.open = false;
        return;
      }
      const rootState = host?.getRootState?.();
      expertPanel.hidden = !(
        rootState?.showAdvancedNodes === true
      );
      if (expertPanel.hidden) {
        expertPanel.open = false;
      }
      const target =
        resolveCSharpImportTarget();
      expertPanel.dataset
        .rmlCSharpImportTarget =
        target.ok
          ? target.kind
          : "unavailable";
    };

    const summary = document.createElement("summary");
    summary.textContent = window.RMLI18n.t("{{i18n:ui.js.a1d4d48f13ed}}");
    expertPanel.appendChild(summary);

    const body = document.createElement("div");
    body.className = "project-csharp-import-body";

    const warning = document.createElement("div");
    warning.className = "project-csharp-import-warning";
    const warningStrong =
      document.createElement("strong");
    const warningText =
      document.createTextNode("");
    warning.append(
      warningStrong,
      warningText
    );
    body.appendChild(warning);

    const acknowledgementLabel = document.createElement("label");
    acknowledgementLabel.className = "project-csharp-import-acknowledgement";
    const acknowledgement = document.createElement("input");
    acknowledgement.type = "checkbox";
    acknowledgement.id = "project-import-csharp-acknowledgement";
    const acknowledgementText = document.createElement("span");
    acknowledgementText.textContent =
      window.RMLI18n.t("{{i18n:ui.js.006a07e230b3}}");
    acknowledgementLabel.append(acknowledgement, acknowledgementText);
    body.appendChild(acknowledgementLabel);

    const button = document.createElement("button");
    button.id = "project-import-csharp";
    button.className = "button secondary project-csharp-import-button";
    button.type = "button";
    button.textContent = window.RMLI18n.t("{{i18n:ui.js.cfa01c47dcc8}}");
    const setImportButtonAvailability =
      available => {
        const reason =
          window.RMLI18n.t("ui.literal.484700eb5aa7");
        const shared =
          window.RMLAlwaysClickableButtons
            ?.set;
        if (typeof shared === "function") {
          shared(
            button,
            available,
            reason
          );
        } else {
          button.disabled = false;
          button.setAttribute(
            "aria-disabled",
            String(available !== true)
          );
          button.dataset.unavailableReason =
            reason;
        }
      };
    setImportButtonAvailability(false);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".cs,text/plain";
    input.hidden = true;

    const pending = document.createElement("div");
    pending.className = "project-csharp-import-pending";
    pending.hidden = true;
    const pendingText = document.createElement("p");
    const pendingActions = document.createElement("div");
    pendingActions.className = "project-csharp-import-pending-actions";
    const cancel = document.createElement("button");
    cancel.className = "button secondary";
    cancel.type = "button";
    cancel.textContent = window.RMLI18n.t("{{i18n:index.text.02bc50efcb1e}}");
    const commit = document.createElement("button");
    commit.className = "button primary";
    commit.type = "button";

    const refreshCSharpImportLanguage =
      () => {
        summary.textContent =
          window.RMLI18n.t(
            "ui.js.a1d4d48f13ed"
          );
        warningStrong.textContent =
          window.RMLI18n.t(
            "ui.text.61f955937222"
          );
        warningText.textContent =
          ` ${window.RMLI18n.t(
            "ui.literal.056a6536e026"
          )}${window.RMLI18n.t(
            "ui.literal.e9a48a69f7f1"
          )}`;
        acknowledgementText.textContent =
          window.RMLI18n.t(
            "ui.js.006a07e230b3"
          );
        button.textContent =
          window.RMLI18n.t(
            "ui.js.cfa01c47dcc8"
          );
        cancel.textContent =
          window.RMLI18n.t(
            "index.text.02bc50efcb1e"
          );
        commit.textContent =
          window.RMLI18n.t(
            "ui.js.165340ccb9ab"
          );
        setImportButtonAvailability(
          acknowledgement.checked
        );
      };

    refreshCSharpImportLanguage();
    pendingActions.append(cancel, commit);
    pending.append(pendingText, pendingActions);

    const localStatus = document.createElement("p");
    localStatus.className = "project-csharp-import-status";
    localStatus.setAttribute("aria-live", "polite");

    let pendingImport = null;
    const clearPending = () => {
      pendingImport = null;
      pending.hidden = true;
      pendingText.textContent = "";
      input.value = "";
    };

    acknowledgement.addEventListener("change", () => {
      setImportButtonAvailability(
        acknowledgement.checked
      );
      if (!acknowledgement.checked) clearPending();
    });
    button.addEventListener("click", () => {
      if (!acknowledgement.checked) {
        localStatus.textContent =
          window.RMLI18n.t("{{i18n:ui.js.b1b2e4f4b658}}");
        localStatus.classList.toggle(
          "success",
          false
        );
        localStatus.classList.toggle(
          "error",
          true
        );
        return;
      }
      input.click();
    });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const target =
          resolveCSharpImportTarget();
        if (!target.ok) {
          throw new Error(
            target.diagnostics.join("\n")
          );
        }
        const source = await file.text();
        if (!window.RMLCSharp14Roslyn?.parse) {
          throw new Error(window.RMLI18n.t("ui.literal.d9741ac77b16"));
        }
        localStatus.textContent = window.RMLI18n.t("{{i18n:ui.js.e84b82cf2476}}");
        localStatus.classList.remove("success", "error");
        const parseResult = await window.RMLCSharp14Roslyn.parse(source);
        if (parseResult.ok !== true) {
          throw new Error(formatRoslynDiagnostics(parseResult.diagnostics).join("\n"));
        }
        const syntaxItemCount = countRoslynSyntaxItems(parseResult.root);
        pendingImport = {
          fileName: file.name,
          source,
          parseResult,
          syntaxItemCount,
          targetKey: target.key,
          targetKind: target.kind,
          targetLabel: target.label
        };
        pendingText.textContent =
          window.RMLI18n.format(
            "csharp.import.pending",
            {
              file: file.name,
              target: target.label,
              count:
                syntaxItemCount.toLocaleString(
                  window.RMLI18n?.language ||
                    undefined
                )
            }
          );
        pending.hidden = false;
        localStatus.textContent = window.RMLI18n.t("{{i18n:ui.js.9e7c52fb16ac}}");
        localStatus.classList.remove("success", "error");
      } catch (error) {
        clearPending();
        localStatus.textContent = error instanceof Error ? error.message : String(error);
        localStatus.classList.toggle("success", false);
        localStatus.classList.toggle("error", true);
      } finally {
        input.value = "";
      }
    });

    cancel.addEventListener("click", () => {
      clearPending();
      localStatus.textContent = window.RMLI18n.t("{{i18n:ui.js.2db968ca59ea}}");
      localStatus.classList.remove("success", "error");
    });

    commit.addEventListener("click", async () => {
      if (!pendingImport || !acknowledgement.checked) return;
      try {
        const result = await importRoslynIntoCurrentGraph(pendingImport.source, pendingImport.parseResult, {
          fileName: pendingImport.fileName,
          projectId: "main",
          expectedTargetKey:
            pendingImport.targetKey
        });
        if (!result.ok) throw new Error(result.diagnostics.join("\n"));
        const importedFileName = pendingImport.fileName;
        clearPending();
        acknowledgement.checked = false;
        setImportButtonAvailability(false);
        const duplicateText =
          result.removedDuplicateFileCount
            ? window.RMLI18n.format(
                result.removedDuplicateFileCount === 1
                  ? "csharp.import.duplicates.one"
                  : "csharp.import.duplicates.other",
                {
                  count:
                    result.removedDuplicateFileCount
                      .toLocaleString(
                        window.RMLI18n?.language ||
                          undefined
                      )
                }
              )
            : "";
        localStatus.textContent =
          window.RMLI18n.format(
            "csharp.import.success",
            {
              action:
                result.replacedExistingFile
                  ? window.RMLI18n.t(
                      "ui.literal.f2f8570ddd7b"
                    )
                  : window.RMLI18n.t(
                      "ui.literal.434eb26f4835"
                    ),
              file: importedFileName,
              target: result.targetLabel,
              duplicates: duplicateText,
              count:
                result.importedSyntaxNodeCount
                  .toLocaleString(
                    window.RMLI18n?.language ||
                      undefined
                  )
            }
          );
        localStatus.classList.toggle("success", true);
        localStatus.classList.toggle("error", false);
      } catch (error) {
        localStatus.textContent = error instanceof Error ? error.message : String(error);
        localStatus.classList.toggle("success", false);
        localStatus.classList.toggle("error", true);
      }
    });

    body.append(button, input, pending, localStatus);
    expertPanel.appendChild(body);
    actions.insertAdjacentElement("afterend", expertPanel);
    refreshExpertPanelVisibility();
    window.addEventListener(
      "rml-graph-advanced-mode-change",
      refreshExpertPanelVisibility
    );
    window.addEventListener(
      "rml-dynamic-graph-commit",
      refreshExpertPanelVisibility
    );
    window.addEventListener(
      "rml-language-changed",
      refreshCSharpImportLanguage
    );
  }

  const visualCSharpApi = Object.freeze({
    version: VERSION,
    lex: lexVisualCSharp,
    createImportFragment,
    importIntoCurrentGraph,
    createRoslynImportFragment,
    createCustomCSharpFileGraphFromFragment,
    sourceHash: stableHash,
    roslynStructuralSignature,
    renderCustomCSharpGraph,
    importRoslynIntoCurrentGraph,
    formatRoslynDiagnostics
  });
  Object.defineProperty(window, window.RMLI18n.t("ui.literal.a54868b71eb4"), {
    value: visualCSharpApi,
    configurable: true,
    enumerable: true
  });
  if (document.readyState === "loading") {
    document.addEventListener(window.RMLI18n.t("ui.literal.300467240c7e"), installCSharpImportControl, { once: true });
  } else {
    installCSharpImportControl();
  }

  Object.defineProperty(window, window.RMLI18n.t("ui.literal.7b9f939ac876"), {
    value: Object.freeze({
      version: VERSION,
      representation: "verified-scanner-catalog-first-recursive-semantic-minimizer-plus-exact-roslyn-fallback",
      targetFramework: "net10.0",
      languageVersion: "14.0",
      grammarValidator: "bundled-dotnet10-roslyn-webassembly",
      grammarImportFailClosed: true,
      sourceBoundAst: true,
      roslynAstNodes: true,
      compactRoslynGraph: true,
      verifiedScannerCatalogFirst: true,
      catalogOverloadGuessing: false,
      tokenAndMeaningfulTriviaRoundtripGate: true,
      opaqueRoslynSubtrees: false,
      contextualKeywords: Object.freeze(["allows", "args", "extension", "field"]),
      fileBasedDirectives: true,
      escapeCharacterE: true,
      rawSourceNodes: 1,
      projectRoots: true,
      arbitraryCompilationUnits: true,
      csharpImportRoundtrip: true,
      lexicalFallback: "validated-single-token"
    }),
    configurable: true,
    enumerable: true
  });
  if (
    typeof window.dispatchEvent === "function" &&
    typeof CustomEvent === "function"
  ) {
    window.dispatchEvent(new CustomEvent("rml-visual-csharp-ready", {
      detail: { version: VERSION }
    }));
  }
})();
