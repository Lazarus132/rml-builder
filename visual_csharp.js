(() => {
  "use strict";

  const registry = window.RMLModNodeRegistry;
  if (!registry) {
    console.error("Visual C# nodes require node_graph.js.");
    return;
  }

  const {
    port,
    genericPort,
    registerType,
    registerGroup,
    registerNode,
    registerCodegenPlugin,
    getNodeDefinition
  } = registry;

  const VERSION = 7;
  const SYNTAX_TYPE = "csharpSyntax";
  const GROUPS = {
    project: "Visual C# · Projects",
    declarations: "Visual C# · Declarations",
    statements: "Visual C# · Statements",
    expressions: "Visual C# · Expressions",
    syntax: "Visual C# · Exact Syntax"
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
  const number = (key, label, defaultValue = 0, help = "") => ({
    key,
    label,
    kind: "number",
    default: defaultValue,
    storeAsNumber: true,
    help
  });

  registerType(SYNTAX_TYPE, {
    label: "C# Syntax",
    short: "C#",
    color: "#b789ff",
    valueType: false,
    globalGenericCandidate: false,
    csType: "object",
    defaultCs: "default(object)"
  });

  registerGroup(GROUPS.project, { after: "Visual C# Language" });
  registerGroup(GROUPS.declarations, { after: GROUPS.project });
  registerGroup(GROUPS.statements, { after: GROUPS.declarations });
  registerGroup(GROUPS.expressions, { after: GROUPS.statements });
  registerGroup(GROUPS.syntax, { after: GROUPS.expressions });

  const syntaxInput = (id, label, extra = {}) =>
    port(id, label, SYNTAX_TYPE, extra);
  const syntaxOutput = () => port("syntax", "Syntax", SYNTAX_TYPE);
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
    .replace(/\"/g, '\\"')
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
      return "Invalid.Name";
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
      customCSharpSyntaxNode: true,
      ...definition,
      outputs: definition.outputs || [syntaxOutput()]
    });
  }

  registerNode("csharp.project", {
    expertOnly: true,
    title: "C# Project",
    group: GROUPS.project,
    symbol: "CSPROJ",
    description: "Defines an optional independent compiled project. C# File nodes join it through Project Id.",
    parameters: [
      text("projectId", "Project Id", "main", "Use 'main' for the normal generated mod project."),
      text("assemblyName", "Assembly name", "GeneratedVisualMod"),
      text("rootNamespace", "Root namespace", "GeneratedVisualMod"),
      select("deployDirectory", "Deploy directory", ["rml_mods", "rml_libs"], "rml_mods"),
      bool("allowUnsafeBlocks", "Allow unsafe", false),
      bool("useWindowsForms", "Windows Forms", false),
      bool("usesElements", "Reference Elements.Core", true),
      bool("usesRenderiteShared", "Reference Renderite.Shared", false)
    ],
    inputs: [],
    outputs: []
  });

  registerNode("csharp.file", {
    title: "Custom C# File",
    group: GROUPS.project,
    symbol: ".CS",
    customCSharpFile: true,
    description: "A reusable C# source container. Its complete source stays persistently in this Runtime Graph node's Actions. Imported files synchronize changed source through Roslyn when opened; manually built file graphs remain graph-authoritative.",
    parameters: [
      text("fileName", "File name", "VisualProgram.cs"),
      text("projectId", "Project Id", "main"),
      select("nullable", "Nullable", ["inherit", "enable", "disable", "annotations", "warnings"], "inherit"),
      bool("autoGeneratedHeader", "Generated header", true),
      code("source", "C# 14 source", "", "Persistent complete source of this custom file. For imported files, Open Node Graph parses externally changed source with bundled .NET 10 Roslyn automatically. A manually built file graph is never overwritten from this field. Graph changes write generated code back here.", 22)
    ],
    inputs: [],
    resolveDefinition(node) {
      return {
        inputs: node?.parameters?.legacyInlineContent === true
          ? [syntaxInput("content", "Legacy inline compilation unit")]
          : []
      };
    },
    outputs: []
  });

  registerNode("csharp.customFileOutput", {
    expertOnly: true,
    customCSharpSubgraphOnly: true,
    title: "Custom C# File Output",
    group: GROUPS.project,
    symbol: "OUT",
    description: "The compilation-unit output of a Custom C# File subgraph. Connect exactly one complete visual C# syntax tree to Content.",
    parameters: [],
    inputs: [syntaxInput("content", "Compilation unit")],
    outputs: []
  });

  registerNode("csharp.reference", {
    expertOnly: true,
    title: "Assembly Reference",
    group: GROUPS.project,
    symbol: "DLL",
    parameters: [
      text("projectId", "Project Id", "main"),
      text("include", "Assembly", "Assembly.Name"),
      text("hintPath", "Hint path", ""),
      bool("private", "Copy local", false)
    ],
    inputs: [], outputs: []
  });

  registerNode("csharp.packageReference", {
    expertOnly: true,
    title: "NuGet Package Reference",
    group: GROUPS.project,
    symbol: "NUGET",
    parameters: [
      text("projectId", "Project Id", "main"),
      text("include", "Package", "Package.Name"),
      text("version", "Version", "1.0.0"),
      text("privateAssets", "PrivateAssets", ""),
      text("includeAssets", "IncludeAssets", "")
    ],
    inputs: [], outputs: []
  });

  registerNode("csharp.frameworkReference", {
    expertOnly: true,
    title: "Framework Reference",
    group: GROUPS.project,
    symbol: "FX",
    parameters: [
      text("projectId", "Project Id", "main"),
      text("include", "Framework", "Microsoft.AspNetCore.App")
    ],
    inputs: [], outputs: []
  });

  registerSyntaxNode("csharp.sequence", {
    title: "Syntax Sequence",
    group: GROUPS.syntax,
    symbol: "A…Z",
    description: "Combines any number of syntax fragments deterministically.",
    parameters: [
      select("separator", "Separator", ["automatic", "none", "space", "newline", "blankLine", "comma", "commaSpace"], "newline"),
      number("variadicInputCount", "Input count", 2)
    ],
    inputs: [syntaxInput("a", "A"), syntaxInput("b", "B")],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 512,
      template: syntaxInput("a", "A")
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
      const rawValues = ctx.variadic();
      if (parameter(ctx.node, "separator", "newline") === "none") {
        return rawValues.join("");
      }
      const values = rawValues.map(value => value.trim()).filter(Boolean);
      if (separator !== undefined) return values.join(separator);
      return values.reduce((result, value) => {
        if (!result) return value;
        const tightLeft = /^[,;.:)\]}?]/.test(value);
        const tightRight = /[(\[{.?:]$/.test(result);
        return `${result}${tightLeft || tightRight ? "" : " "}${value}`;
      }, "");
    }
  });

  registerSyntaxNode("csharp.trivia", {
    title: "Whitespace / Trivia",
    group: GROUPS.syntax,
    symbol: "WS",
    parameters: [
      select("kind", "Kind", ["space", "newline", "blankLine", "indent", "tab", "exact"], "space"),
      number("count", "Count", 1),
      text("value", "Exact whitespace", " ", "Used only by Exact. Non-whitespace characters are rejected.")
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
    title: "Validated C# Token",
    group: GROUPS.syntax,
    symbol: "TOK",
    description: "One validated lexical token. Token sequences can represent every C# grammar production without embedding a raw C# block.",
    parameters: [
      select("kind", "Token kind", ["identifier", "keyword", "punctuation", "string", "char", "number", "lineComment", "blockComment", "directive", "stringLexeme", "charLexeme"], "identifier"),
      code("value", "Value", "value", "The token payload, not a source-code block.", 3)
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
        case "string": return `\"${escapeString(value)}\"`;
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
    title: "Roslyn C# 14 Syntax",
    group: GROUPS.syntax,
    symbol: "AST",
    description: "One grammar node produced by the bundled .NET 10 Roslyn parser. Children preserve the exact C# 14 syntax order.",
    parameters: [
      text("syntaxKind", "Roslyn SyntaxKind", "CompilationUnit"),
      text("languageVersion", "Language version", "14.0"),
      number("variadicInputCount", "Child count", 2)
    ],
    inputs: [syntaxInput("a", "Child A"), syntaxInput("b", "Child B")],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 512,
      template: syntaxInput("a", "Child A")
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
    title: "Roslyn C# 14 Token",
    group: GROUPS.syntax,
    symbol: "RTOK",
    description: "One exact token certified by the bundled Roslyn C# 14 parser.",
    parameters: [
      text("syntaxKind", "Roslyn SyntaxKind", "IdentifierToken"),
      code("value", "Exact token", "value", "Exactly one Roslyn-validated token; not a source block.", 2),
      text("signature", "Validation signature", "")
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
    title: "Roslyn C# 14 Trivia",
    group: GROUPS.syntax,
    symbol: "RTRIV",
    description: "One exact whitespace, comment or directive trivia item certified by Roslyn.",
    parameters: [
      text("syntaxKind", "Roslyn SyntaxKind", "WhitespaceTrivia"),
      code("value", "Exact trivia", " ", "Exactly one Roslyn-validated trivia item.", 2),
      text("signature", "Validation signature", "")
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
    title: "Delimited Syntax",
    group: GROUPS.syntax,
    symbol: "(…)",
    parameters: [
      select("delimiter", "Delimiter", ["parentheses", "brackets", "braces", "angles"], "parentheses"),
      select("layout", "Layout", ["inline", "block"], "inline"),
      select("suffix", "Suffix", ["none", "semicolon", "comma"], "none")
    ],
    inputs: [syntaxInput("content", "Content")],
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
    title: "Identifier",
    group: GROUPS.expressions,
    symbol: "ID",
    parameters: [text("name", "Name", "value")],
    syntaxRender(ctx) { return requireIdentifier(ctx, parameter(ctx.node, "name", "value")); }
  });

  registerSyntaxNode("csharp.type", {
    title: "Type Syntax",
    group: GROUPS.declarations,
    symbol: "TYPE",
    parameters: [text("name", "Type", "object", "Simple, qualified, generic, nullable, array and pointer type syntax.")],
    syntaxRender(ctx) { return requireType(ctx, parameter(ctx.node, "name", "object")); }
  });

  registerSyntaxNode("csharp.literal", {
    title: "Literal",
    group: GROUPS.expressions,
    symbol: "LIT",
    parameters: [
      select("kind", "Kind", ["string", "char", "integer", "real", "true", "false", "null", "default"], "string"),
      text("value", "Value", "")
    ],
    syntaxRender(ctx) {
      const kind = parameter(ctx.node, "kind", "string");
      const value = String(parameter(ctx.node, "value", ""));
      if (kind === "string") return `\"${escapeString(value)}\"`;
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
    title: "Runtime Graph Value as C#",
    group: GROUPS.expressions,
    symbol: "GRAPH→C#",
    description: "Embeds the generated expression of a typed Runtime Graph or scanner-generated API value. Use it inside a partial NodeGraph declaration where generated private helpers are in scope.",
    inputs: [genericPort("value", "Typed graph value", "T", "anyValue")],
    syntaxRender(ctx) {
      return ctx.graphValue("value");
    }
  });

  registerSyntaxNode("csharp.using", {
    title: "Using Directive",
    group: GROUPS.declarations,
    symbol: "USING",
    parameters: [
      text("name", "Namespace or type", "System"),
      text("alias", "Alias", ""),
      bool("global", "Global", false),
      bool("static", "Static", false)
    ],
    syntaxRender(ctx) {
      const name = requireQualifiedName(ctx, parameter(ctx.node, "name", "System"), "namespace/type name");
      const aliasRaw = String(parameter(ctx.node, "alias", "")).trim();
      const alias = aliasRaw ? `${requireIdentifier(ctx, aliasRaw, "alias")} = ` : "";
      return `${parameter(ctx.node, "global", false) ? "global " : ""}using ${parameter(ctx.node, "static", false) ? "static " : ""}${alias}${name};`;
    }
  });

  registerSyntaxNode("csharp.namespace", {
    title: "Namespace",
    group: GROUPS.declarations,
    symbol: "NS",
    parameters: [
      text("name", "Name", "Generated"),
      select("style", "Style", ["fileScoped", "block"], "fileScoped")
    ],
    inputs: [syntaxInput("members", "Members")],
    syntaxRender(ctx) {
      const name = requireQualifiedName(ctx, parameter(ctx.node, "name", "Generated"), "namespace");
      const members = ctx.input("members");
      return parameter(ctx.node, "style", "fileScoped") === "block"
        ? `namespace ${name}${block(members)}`
        : `namespace ${name};\n\n${members}`;
    }
  });

  registerSyntaxNode("csharp.attribute", {
    title: "Attribute",
    group: GROUPS.declarations,
    symbol: "ATTR",
    parameters: [
      text("name", "Attribute type", "System.Obsolete"),
      select("target", "Target", ["none", "assembly", "module", "field", "event", "method", "param", "property", "return", "type"], "none")
    ],
    inputs: [syntaxInput("arguments", "Arguments")],
    syntaxRender(ctx) {
      const target = parameter(ctx.node, "target", "none");
      const argumentsSyntax = ctx.input("arguments").trim();
      return `[${target === "none" ? "" : `${target}: `}${requireType(ctx, parameter(ctx.node, "name", "System.Obsolete"))}${argumentsSyntax ? `(${argumentsSyntax})` : ""}]`;
    }
  });

  registerSyntaxNode("csharp.genericParameter", {
    title: "Generic Parameter",
    group: GROUPS.declarations,
    symbol: "<T>",
    parameters: [
      text("name", "Name", "T"),
      select("variance", "Variance", ["none", "in", "out"], "none")
    ],
    inputs: [syntaxInput("attributes", "Attributes")],
    syntaxRender(ctx) {
      const variance = parameter(ctx.node, "variance", "none");
      return `${ctx.input("attributes").trim()}${ctx.input("attributes").trim() ? " " : ""}${variance === "none" ? "" : `${variance} `}${requireIdentifier(ctx, parameter(ctx.node, "name", "T"))}`;
    }
  });

  registerSyntaxNode("csharp.constraint", {
    title: "Generic Constraint Clause",
    group: GROUPS.declarations,
    symbol: "WHERE",
    parameters: [text("parameter", "Type parameter", "T")],
    inputs: [syntaxInput("constraints", "Constraints")],
    syntaxRender(ctx) {
      return `where ${requireIdentifier(ctx, parameter(ctx.node, "parameter", "T"))} : ${ctx.input("constraints") || "notnull"}`;
    }
  });

  registerSyntaxNode("csharp.parameter", {
    title: "Parameter",
    group: GROUPS.declarations,
    symbol: "PARAM",
    parameters: [
      text("name", "Name", "value"),
      text("type", "Type", "object"),
      select("modifier", "Modifier", ["none", "this", "ref", "out", "in", "params", "scoped", "scoped ref", "ref readonly"], "none")
    ],
    inputs: [syntaxInput("attributes", "Attributes"), syntaxInput("default", "Default value")],
    syntaxRender(ctx) {
      const attributes = ctx.input("attributes").trim();
      const modifier = parameter(ctx.node, "modifier", "none");
      const fallback = ctx.input("default").trim();
      return `${attributes ? `${attributes} ` : ""}${modifier === "none" ? "" : `${modifier} `}${requireType(ctx, parameter(ctx.node, "type", "object"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "value"))}${fallback ? ` = ${fallback}` : ""}`;
    }
  });

  registerSyntaxNode("csharp.typeDeclaration", {
    title: "Type Declaration",
    group: GROUPS.declarations,
    symbol: "TYPE{}",
    parameters: [
      select("kind", "Kind", ["class", "struct", "interface", "record", "record class", "record struct", "enum", "ref struct", "readonly struct"], "class"),
      text("name", "Name", "GeneratedType"),
      text("modifiers", "Modifiers", "internal sealed partial")
    ],
    inputs: [
      syntaxInput("attributes", "Attributes"),
      syntaxInput("typeParameters", "Type parameters"),
      syntaxInput("primaryConstructor", "Primary constructor"),
      syntaxInput("baseTypes", "Base types"),
      syntaxInput("constraints", "Constraints"),
      syntaxInput("members", "Members")
    ],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "internal sealed partial"));
      const kind = parameter(ctx.node, "kind", "class");
      const name = requireIdentifier(ctx, parameter(ctx.node, "name", "GeneratedType"), "type name");
      const typeParameters = ctx.input("typeParameters").trim();
      const primaryConstructor = ctx.input("primaryConstructor").trim();
      const bases = ctx.input("baseTypes").trim();
      const constraints = ctx.input("constraints").trim();
      const members = ctx.input("members");
      return `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${kind} ${name}${typeParameters ? `<${typeParameters}>` : ""}${primaryConstructor ? `(${primaryConstructor})` : ""}${bases ? ` : ${bases}` : ""}${constraints ? `\n${constraints}` : ""}${block(members)}`;
    }
  });

  registerSyntaxNode("csharp.method", {
    title: "Method / Local Function",
    group: GROUPS.declarations,
    symbol: "METHOD",
    parameters: [
      text("name", "Name", "Method"),
      text("returnType", "Return type", "void"),
      text("modifiers", "Modifiers", "private static"),
      select("bodyStyle", "Body", ["block", "expression", "semicolon"], "block")
    ],
    inputs: [
      syntaxInput("attributes", "Attributes"), syntaxInput("typeParameters", "Type parameters"),
      syntaxInput("parameters", "Parameters"), syntaxInput("constraints", "Constraints"),
      syntaxInput("body", "Body / expression")
    ],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "private static"));
      const returnType = parameter(ctx.node, "returnType", "void").trim() === "void" ? "void" : requireType(ctx, parameter(ctx.node, "returnType", "void"));
      const name = requireIdentifier(ctx, parameter(ctx.node, "name", "Method"), "method name");
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
    title: "Constructor / Destructor",
    group: GROUPS.declarations,
    symbol: "CTOR",
    parameters: [
      text("name", "Type name", "GeneratedType"),
      text("modifiers", "Modifiers", "public"),
      bool("destructor", "Destructor", false),
      select("initializer", "Initializer", ["none", "base", "this"], "none")
    ],
    inputs: [syntaxInput("attributes", "Attributes"), syntaxInput("parameters", "Parameters"), syntaxInput("initializerArguments", "Initializer arguments"), syntaxInput("body", "Body")],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const name = requireIdentifier(ctx, parameter(ctx.node, "name", "GeneratedType"), "type name");
      const destructor = parameter(ctx.node, "destructor", false);
      const mods = destructor ? "" : requireModifiers(ctx, parameter(ctx.node, "modifiers", "public"));
      const init = destructor ? "none" : parameter(ctx.node, "initializer", "none");
      return `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${destructor ? "~" : ""}${name}(${destructor ? "" : ctx.input("parameters").trim()})${init === "none" ? "" : ` : ${init}(${ctx.input("initializerArguments").trim()})`}${block(ctx.input("body"))}`;
    }
  });

  registerSyntaxNode("csharp.field", {
    title: "Field / Constant",
    group: GROUPS.declarations,
    symbol: "FIELD",
    parameters: [
      text("name", "Name", "_value"), text("type", "Type", "object"),
      text("modifiers", "Modifiers", "private static"), bool("constant", "Const", false)
    ],
    inputs: [syntaxInput("attributes", "Attributes"), syntaxInput("initializer", "Initializer")],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "private static"));
      const initializer = ctx.input("initializer").trim();
      return `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${parameter(ctx.node, "constant", false) ? "const " : ""}${requireType(ctx, parameter(ctx.node, "type", "object"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "_value"), "field name")}${initializer ? ` = ${initializer}` : ""};`;
    }
  });

  registerSyntaxNode("csharp.property", {
    title: "Property / Indexer",
    group: GROUPS.declarations,
    symbol: "PROP",
    parameters: [
      text("name", "Name", "Value"), text("type", "Type", "object"),
      text("modifiers", "Modifiers", "public"), bool("indexer", "Indexer", false),
      select("bodyStyle", "Body", ["accessors", "expression"], "accessors")
    ],
    inputs: [syntaxInput("attributes", "Attributes"), syntaxInput("parameters", "Indexer parameters"), syntaxInput("body", "Accessors / expression"), syntaxInput("initializer", "Initializer")],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "public"));
      const name = parameter(ctx.node, "indexer", false) ? `this[${ctx.input("parameters").trim()}]` : requireIdentifier(ctx, parameter(ctx.node, "name", "Value"), "property name");
      const header = `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}${requireType(ctx, parameter(ctx.node, "type", "object"))} ${name}`;
      const initializer = ctx.input("initializer").trim();
      if (parameter(ctx.node, "bodyStyle", "accessors") === "expression") return `${header} => ${ctx.input("body") || "default"};`;
      return `${header}${block(ctx.input("body") || "get;\nset;")}${initializer ? ` = ${initializer};` : ""}`;
    }
  });

  registerSyntaxNode("csharp.accessor", {
    title: "Property/Event Accessor",
    group: GROUPS.declarations,
    symbol: "GET",
    parameters: [
      select("kind", "Kind", ["get", "set", "init", "add", "remove"], "get"),
      text("modifiers", "Modifiers", ""),
      select("bodyStyle", "Body", ["semicolon", "block", "expression"], "semicolon")
    ],
    inputs: [syntaxInput("attributes", "Attributes"), syntaxInput("body", "Body / expression")],
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
    title: "Event",
    group: GROUPS.declarations,
    symbol: "EVENT",
    parameters: [text("name", "Name", "Changed"), text("type", "Type", "System.Action"), text("modifiers", "Modifiers", "public")],
    inputs: [syntaxInput("attributes", "Attributes"), syntaxInput("accessors", "Accessors"), syntaxInput("initializer", "Initializer")],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "public"));
      const header = `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}event ${requireType(ctx, parameter(ctx.node, "type", "System.Action"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "Changed"), "event name")}`;
      const accessors = ctx.input("accessors").trim();
      const initializer = ctx.input("initializer").trim();
      return accessors ? `${header}${block(accessors)}` : `${header}${initializer ? ` = ${initializer}` : ""};`;
    }
  });

  registerSyntaxNode("csharp.delegate", {
    title: "Delegate Declaration",
    group: GROUPS.declarations,
    symbol: "DELEGATE",
    parameters: [text("name", "Name", "Handler"), text("returnType", "Return type", "void"), text("modifiers", "Modifiers", "public")],
    inputs: [syntaxInput("attributes", "Attributes"), syntaxInput("typeParameters", "Type parameters"), syntaxInput("parameters", "Parameters"), syntaxInput("constraints", "Constraints")],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const mods = requireModifiers(ctx, parameter(ctx.node, "modifiers", "public"));
      const returnType = parameter(ctx.node, "returnType", "void") === "void" ? "void" : requireType(ctx, parameter(ctx.node, "returnType", "void"));
      const types = ctx.input("typeParameters").trim();
      const constraints = ctx.input("constraints").trim();
      return `${attrs ? `${attrs}\n` : ""}${mods ? `${mods} ` : ""}delegate ${returnType} ${requireIdentifier(ctx, parameter(ctx.node, "name", "Handler"), "delegate name")}${types ? `<${types}>` : ""}(${ctx.input("parameters").trim()})${constraints ? `\n${constraints}` : ""};`;
    }
  });

  registerSyntaxNode("csharp.enumMember", {
    title: "Enum Member",
    group: GROUPS.declarations,
    symbol: "ENUM",
    parameters: [text("name", "Name", "Value")],
    inputs: [syntaxInput("attributes", "Attributes"), syntaxInput("value", "Value")],
    syntaxRender(ctx) {
      const attrs = ctx.input("attributes").trim();
      const value = ctx.input("value").trim();
      return `${attrs ? `${attrs}\n` : ""}${requireIdentifier(ctx, parameter(ctx.node, "name", "Value"), "enum member")}${value ? ` = ${value}` : ""}`;
    }
  });

  const expressionNode = (id, title, symbol, parameters, inputs, renderer) =>
    registerSyntaxNode(id, { title, group: GROUPS.expressions, symbol, parameters, inputs, syntaxRender: renderer });

  expressionNode("csharp.memberAccess", "Member Access", ".", [], [syntaxInput("target", "Target") , syntaxInput("member", "Member")], ctx => `${ctx.input("target")}.${ctx.input("member")}`);
  expressionNode("csharp.conditionalAccess", "Conditional Access", "?.", [], [syntaxInput("target", "Target"), syntaxInput("access", "Access")], ctx => `${ctx.input("target")}?.${ctx.input("access")}`);
  expressionNode("csharp.invocation", "Invocation", "()", [], [syntaxInput("target", "Target"), syntaxInput("typeArguments", "Type arguments"), syntaxInput("arguments", "Arguments")], ctx => `${ctx.input("target")}${ctx.input("typeArguments").trim() ? `<${ctx.input("typeArguments").trim()}>` : ""}(${ctx.input("arguments")})`);
  expressionNode("csharp.argument", "Argument", "ARG", [select("modifier", "Modifier", ["none", "ref", "out", "in"], "none"), text("name", "Named argument", "")], [syntaxInput("value", "Value")], ctx => `${String(parameter(ctx.node, "name", "")).trim() ? `${requireIdentifier(ctx, parameter(ctx.node, "name", ""), "argument name")}: ` : ""}${parameter(ctx.node, "modifier", "none") === "none" ? "" : `${parameter(ctx.node, "modifier")} `}${ctx.input("value")}`);
  expressionNode("csharp.objectCreation", "Object / Array Creation", "NEW", [text("type", "Type", "object"), select("kind", "Kind", ["object", "implicitObject", "array", "implicitArray", "stackalloc"], "object")], [syntaxInput("arguments", "Arguments / dimensions"), syntaxInput("initializer", "Initializer")], ctx => {
    const kind = parameter(ctx.node, "kind", "object");
    const args = ctx.input("arguments");
    const init = ctx.input("initializer").trim();
    if (kind === "implicitObject") return `new(${args})${init ? ` { ${init} }` : ""}`;
    if (kind === "implicitArray") return `new[]${init ? ` { ${init} }` : " { }"}`;
    if (kind === "stackalloc") { ctx.requireUnsafe(); return `stackalloc ${requireType(ctx, parameter(ctx.node, "type", "object"))}[${args}]${init ? ` { ${init} }` : ""}`; }
    if (kind === "array") return `new ${requireType(ctx, parameter(ctx.node, "type", "object"))}[${args}]${init ? ` { ${init} }` : ""}`;
    return `new ${requireType(ctx, parameter(ctx.node, "type", "object"))}(${args})${init ? ` { ${init} }` : ""}`;
  });
  expressionNode("csharp.elementAccess", "Element Access", "[]", [], [syntaxInput("target", "Target"), syntaxInput("arguments", "Arguments")], ctx => `${ctx.input("target")}[${ctx.input("arguments")}]`);
  expressionNode("csharp.binary", "Binary / Pattern Expression", "A+B", [select("operator", "Operator", ["+", "-", "*", "/", "%", "==", "!=", "<", ">", "<=", ">=", "&&", "||", "&", "|", "^", "<<", ">>", "??", "is", "as", "and", "or", ".."], "+")], [syntaxInput("left", "Left"), syntaxInput("right", "Right")], ctx => `(${ctx.input("left")} ${parameter(ctx.node, "operator", "+")} ${ctx.input("right")})`);
  expressionNode("csharp.unary", "Unary Expression", "!A", [select("operator", "Operator", ["+", "-", "!", "~", "++pre", "--pre", "++post", "--post", "&", "*", "^", "not", "await", "checked", "unchecked"], "!")], [syntaxInput("operand", "Operand")], ctx => {
    const op = parameter(ctx.node, "operator", "!");
    if (["&", "*"].includes(op)) ctx.requireUnsafe();
    if (op.endsWith("post")) return `(${ctx.input("operand")}${op.slice(0, 2)})`;
    if (op.endsWith("pre")) return `(${op.slice(0, 2)}${ctx.input("operand")})`;
    if (["await", "not"].includes(op)) return `(${op} ${ctx.input("operand")})`;
    if (["checked", "unchecked"].includes(op)) return `${op}(${ctx.input("operand")})`;
    return `(${op}${ctx.input("operand")})`;
  });
  expressionNode("csharp.assignment", "Assignment", "=", [select("operator", "Operator", ["=", "+=", "-=", "*=", "/=", "%=", "&=", "|=", "^=", "<<=", ">>=", "??="], "=")], [syntaxInput("target", "Target"), syntaxInput("value", "Value")], ctx => `${ctx.input("target")} ${parameter(ctx.node, "operator", "=")} ${ctx.input("value")}`);
  expressionNode("csharp.conditional", "Conditional Expression", "?:", [], [syntaxInput("condition", "Condition"), syntaxInput("true", "True"), syntaxInput("false", "False")], ctx => `(${ctx.input("condition")} ? ${ctx.input("true")} : ${ctx.input("false")})`);
  expressionNode("csharp.cast", "Cast", "(T)", [text("type", "Type", "object")], [syntaxInput("value", "Value")], ctx => `((${requireType(ctx, parameter(ctx.node, "type", "object"))})${ctx.input("value")})`);
  expressionNode("csharp.keywordExpression", "Keyword Expression", "KW", [select("keyword", "Keyword", ["typeof", "nameof", "sizeof", "default", "checked", "unchecked"], "typeof")], [syntaxInput("value", "Type / expression")], ctx => {
    if (parameter(ctx.node, "keyword", "typeof") === "sizeof") ctx.requireUnsafe();
    return `${parameter(ctx.node, "keyword", "typeof")}(${ctx.input("value")})`;
  });
  expressionNode("csharp.lambda", "Lambda / Anonymous Method", "λ", [select("kind", "Kind", ["lambda", "anonymous"], "lambda"), text("modifiers", "Modifiers", ""), bool("expressionBody", "Expression body", false)], [syntaxInput("parameters", "Parameters"), syntaxInput("body", "Body")], ctx => {
    const modifiers = String(parameter(ctx.node, "modifiers", "")).trim();
    const body = ctx.input("body");
    if (parameter(ctx.node, "kind", "lambda") === "anonymous") return `${modifiers ? `${modifiers} ` : ""}delegate(${ctx.input("parameters")})${block(body)}`;
    return `${modifiers ? `${modifiers} ` : ""}(${ctx.input("parameters")}) => ${parameter(ctx.node, "expressionBody", false) ? body : block(body)}`;
  });
  expressionNode("csharp.interpolatedString", "Interpolated String", "$\"\"", [text("format", "Format text", "Value: {0}")], [syntaxInput("arguments", "Interpolation arguments")], ctx => `string.Format(System.Globalization.CultureInfo.InvariantCulture, \"${escapeString(parameter(ctx.node, "format", ""))}\", ${ctx.input("arguments")})`);

  const statementNode = (id, title, symbol, parameters, inputs, renderer) =>
    registerSyntaxNode(id, { title, group: GROUPS.statements, symbol, parameters, inputs, syntaxRender: renderer });

  statementNode("csharp.block", "Block", "{}", [], [syntaxInput("statements", "Statements")], ctx => `{\n${indent(ctx.input("statements"))}\n}`);
  statementNode("csharp.expressionStatement", "Expression Statement", "EXPR;", [], [syntaxInput("expression", "Expression")], ctx => statement(ctx.input("expression")));
  statementNode("csharp.localDeclaration", "Local Declaration", "VAR", [text("type", "Type", "var"), text("name", "Name", "value"), select("modifier", "Modifier", ["none", "const", "using", "await using", "ref", "ref readonly", "scoped", "scoped ref"], "none")], [syntaxInput("initializer", "Initializer")], ctx => `${parameter(ctx.node, "modifier", "none") === "none" ? "" : `${parameter(ctx.node, "modifier")} `}${parameter(ctx.node, "type", "var") === "var" ? "var" : requireType(ctx, parameter(ctx.node, "type", "object"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "value"), "local name")}${ctx.input("initializer").trim() ? ` = ${ctx.input("initializer")}` : ""};`);
  statementNode("csharp.jump", "Jump Statement", "JUMP", [select("kind", "Kind", ["return", "yield return", "yield break", "throw", "break", "continue", "goto", "goto case", "goto default"], "return")], [syntaxInput("value", "Value / label")], ctx => {
    const kind = parameter(ctx.node, "kind", "return");
    const value = ctx.input("value").trim();
    if (["break", "continue", "yield break", "goto default"].includes(kind)) return `${kind};`;
    return `${kind}${value ? ` ${value}` : ""};`;
  });
  statementNode("csharp.if", "If / Else", "IF", [], [syntaxInput("condition", "Condition"), syntaxInput("then", "Then"), syntaxInput("else", "Else")], ctx => `if (${ctx.input("condition")})${block(ctx.input("then"))}${ctx.input("else").trim() ? `\nelse${block(ctx.input("else"))}` : ""}`);
  statementNode("csharp.switch", "Switch Statement / Expression", "SWITCH", [bool("expression", "Expression form", false)], [syntaxInput("value", "Value"), syntaxInput("sections", "Sections / arms")], ctx => parameter(ctx.node, "expression", false) ? `${ctx.input("value")} switch\n{\n${indent(ctx.input("sections"))}\n}` : `switch (${ctx.input("value")})${block(ctx.input("sections"))}`);
  statementNode("csharp.switchSection", "Switch Section / Arm", "CASE", [bool("expressionArm", "Expression arm", false), bool("default", "Default", false)], [syntaxInput("pattern", "Pattern / case value"), syntaxInput("when", "When"), syntaxInput("body", "Body / result")], ctx => {
    const label = parameter(ctx.node, "default", false) ? "default" : ctx.input("pattern");
    const when = ctx.input("when").trim();
    return parameter(ctx.node, "expressionArm", false)
      ? `${label}${when ? ` when ${when}` : ""} => ${ctx.input("body")},`
      : `${parameter(ctx.node, "default", false) ? "default" : `case ${label}`}${when ? ` when ${when}` : ""}:\n${indent(ctx.input("body"))}`;
  });
  statementNode("csharp.loop", "Loop", "LOOP", [select("kind", "Kind", ["while", "do", "for", "foreach", "await foreach"], "while"), text("iterator", "Foreach variable", "item"), text("iteratorType", "Foreach type", "var")], [syntaxInput("initializer", "For initializer"), syntaxInput("condition", "Condition / collection"), syntaxInput("increment", "For increment"), syntaxInput("body", "Body")], ctx => {
    const kind = parameter(ctx.node, "kind", "while");
    if (kind === "do") return `do${block(ctx.input("body"))}\nwhile (${ctx.input("condition")});`;
    if (kind === "for") return `for (${ctx.input("initializer")}; ${ctx.input("condition")}; ${ctx.input("increment")})${block(ctx.input("body"))}`;
    if (kind.includes("foreach")) {
      const type = parameter(ctx.node, "iteratorType", "var") === "var" ? "var" : requireType(ctx, parameter(ctx.node, "iteratorType", "var"));
      return `${kind} (${type} ${requireIdentifier(ctx, parameter(ctx.node, "iterator", "item"), "iterator name")} in ${ctx.input("condition")})${block(ctx.input("body"))}`;
    }
    return `while (${ctx.input("condition")})${block(ctx.input("body"))}`;
  });
  statementNode("csharp.try", "Try / Catch / Finally", "TRY", [], [syntaxInput("body", "Try body"), syntaxInput("catches", "Catch clauses"), syntaxInput("finally", "Finally body")], ctx => `try${block(ctx.input("body"))}${ctx.input("catches").trim() ? `\n${ctx.input("catches")}` : ""}${ctx.input("finally").trim() ? `\nfinally${block(ctx.input("finally"))}` : ""}`);
  statementNode("csharp.catch", "Catch Clause", "CATCH", [text("type", "Exception type", "System.Exception"), text("name", "Variable", "exception"), bool("catchAll", "Catch all", false)], [syntaxInput("filter", "Filter"), syntaxInput("body", "Body")], ctx => `catch${parameter(ctx.node, "catchAll", false) ? "" : ` (${requireType(ctx, parameter(ctx.node, "type", "System.Exception"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "exception"), "exception variable")})`}${ctx.input("filter").trim() ? ` when (${ctx.input("filter")})` : ""}${block(ctx.input("body"))}`);
  statementNode("csharp.resourceStatement", "Using / Lock / Fixed", "SCOPE", [select("kind", "Kind", ["using", "await using", "lock", "fixed", "checked", "unchecked", "unsafe"], "using")], [syntaxInput("resource", "Resource / expression"), syntaxInput("body", "Body")], ctx => {
    const kind = parameter(ctx.node, "kind", "using");
    if (["fixed", "unsafe"].includes(kind)) ctx.requireUnsafe();
    if (["checked", "unchecked", "unsafe"].includes(kind)) return `${kind}${block(ctx.input("body"))}`;
    return `${kind} (${ctx.input("resource")})${block(ctx.input("body"))}`;
  });
  statementNode("csharp.label", "Label", "LABEL", [text("name", "Name", "label")], [syntaxInput("statement", "Statement")], ctx => `${requireIdentifier(ctx, parameter(ctx.node, "name", "label"), "label")}:${ctx.input("statement") ? `\n${indent(ctx.input("statement"))}` : ""}`);

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
    const renderNode = nodeId => {
      if (!nodeId) return "";
      if (cache.has(nodeId)) return cache.get(nodeId);
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
      const input = id => {
        const connection = incoming.get(`${node.id}:${id}`);
        return connection ? renderNode(connection.fromNode) : "";
      };
      const context = {
        node,
        title: definition.title || node.operatorId,
        input,
        graphValue(id) {
          diagnostics.push(`${definition.title}: Runtime Graph value input '${id}' is unavailable inside an isolated Custom C# File graph.`);
          return "default";
        },
        variadic: () => variadicIds(node).map(input),
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
      cache.set(nodeId, result);
      return result;
    };
    if (!outputConnection) {
      diagnostics.push("The Custom C# File node graph has no Compilation unit connected to its Output node.");
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
      const nodeById = api.nodeById instanceof Map ? api.nodeById : new Map(nodes.map(node => [node.id, node]));
      let unsafeRequired = false;

      const createSyntaxRenderer = (localNodes, localIncoming, allowRuntimeValues) => {
        const localNodeById = new Map(localNodes.map(node => [node.id, node]));
        const cache = new Map();
        const stack = new Set();
        const renderNode = nodeId => {
          if (!nodeId) return "";
          if (cache.has(nodeId)) return cache.get(nodeId);
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
          const input = id => {
            const connection = localIncoming.get(`${node.id}:${id}`);
            return connection ? renderNode(connection.fromNode) : "";
          };
          const context = {
            node,
            title: definition.title || node.operatorId,
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
            variadic: () => variadicIds(node).map(input),
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
          cache.set(nodeId, result);
          return result;
        };
        return renderNode;
      };

      const renderMainNode = createSyntaxRenderer(nodes, incoming, true);

      const fileNodes = nodes.filter(node => node?.operatorId === "csharp.file");
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
      const referencesFor = projectId => resources("csharp.reference").filter(node => resourceFor(node, projectId)).map(node => ({
        include: String(parameter(node, "include", "")).trim(),
        hintPath: String(parameter(node, "hintPath", "")).trim(),
        private: parameter(node, "private", false) === true
      })).filter(item => item.include);
      const packagesFor = projectId => resources("csharp.packageReference").filter(node => resourceFor(node, projectId)).map(node => ({
        include: String(parameter(node, "include", "")).trim(), version: String(parameter(node, "version", "")).trim(),
        privateAssets: String(parameter(node, "privateAssets", "")).trim(), includeAssets: String(parameter(node, "includeAssets", "")).trim()
      })).filter(item => item.include && item.version);
      const frameworksFor = projectId => resources("csharp.frameworkReference").filter(node => resourceFor(node, projectId)).map(node => String(parameter(node, "include", "")).trim()).filter(Boolean);

      const filesByProject = new Map();
      const customFileByIdentity = new Map();
      for (const node of fileNodes) {
        const fileName = String(parameter(node, "fileName", "VisualProgram.cs")).trim();
        const projectId = String(parameter(node, "projectId", "main")).trim() || "main";
        if (!/^(?![./\\])(?:(?!\.\.)[^<>:\"|?*\u0000-\u001f])+\.cs$/i.test(fileName)) {
          api.diagnostic(`C# File '${fileName}' must be a safe relative .cs path.`);
          continue;
        }
        const customGraph = api.graph?.customCSharpFiles?.[node.id];
        let connection = null;
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
          const outputNodeId = String(customGraph.outputNodeId || "");
          connection = customIncoming.get(`${outputNodeId}:content`) || null;
          renderNode = createSyntaxRenderer(customGraph.nodes, customIncoming, false);
        } else {
          connection = incoming.get(`${node.id}:content`) || null;
        }
        const body = connection
          ? renderNode(connection.fromNode)
          : String(parameter(node, "source", ""));
        if (!body.trim()) {
          api.diagnostic(`Custom C# File '${fileName}' has neither generated node-graph code nor C# source text.`);
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

      for (const [projectId, files] of filesByProject) {
        if (projectId === "main") {
          for (const file of files) api.addFile(file);
          for (const reference of referencesFor(projectId)) api.addReference(reference);
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
            references: referencesFor(projectId),
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
    const fileName = String(options.fileName || "Imported.cs").trim();
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
          ? String(parameters?.value || parameters?.kind || "Token").replace(/\s+/g, " ").slice(0, 48)
          : operatorId === "csharp.file"
            ? String(parameters?.fileName || "C# File")
            : "",
        parameters
      });
      return id;
    };
    const connect = (fromNode, toNode, toPort) => connections.push({
      id: nextEdgeId(), fromNode, fromPort: "syntax", toNode, toPort,
      points: [], branchFrom: null
    });
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
        : "unknown location";
      return `${item?.id || "C#14"} at ${location}: ${item?.message || "Invalid C# 14 syntax."}`;
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

  function createRoslynImportFragment(source, parseResult, options = {}) {
    const sourceText = String(source ?? "");
    const normalizedSource = normalize(sourceText);
    if (!parseResult || parseResult.ok !== true || parseResult.languageVersion !== "14.0" || !parseResult.root) {
      return {
        ok: false,
        diagnostics: formatRoslynDiagnostics(parseResult?.diagnostics).length
          ? formatRoslynDiagnostics(parseResult.diagnostics)
          : ["The bundled Roslyn runtime did not certify this source as C# 14."],
        nodes: [], connections: []
      };
    }
    const certifiedSource = roslynRootFullText(parseResult.root);
    if (certifiedSource === null || certifiedSource !== sourceText) {
      return {
        ok: false,
        diagnostics: [
          "The Roslyn AST does not reproduce the selected source exactly. Import is blocked instead of accepting an unrelated or incomplete syntax tree."
        ],
        nodes: [], connections: []
      };
    }

    const fileName = String(options.fileName || "Imported.cs").trim();
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
    const connect = (fromNode, toNode, toPort) => connections.push({
      id: nextEdgeId(), fromNode, fromPort: "syntax", toNode, toPort,
      points: [], branchFrom: null
    });

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
      const kind = String(trivia?.kind || "WhitespaceTrivia");
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
        const kind = String(token.kind || "IdentifierToken");
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

    const addSyntaxNode = (syntaxNode, depth = 0) => {
      let childIds = [];
      for (const child of syntaxNode?.children || []) {
        if (child?.type === "node" && child.node) childIds.push(addSyntaxNode(child.node, depth + 1));
        else if (child?.type === "token" && child.token) childIds.push(...addTokenParts(child.token, depth + 1));
      }
      childIds = collapseChildren(childIds, depth, syntaxNode?.kind || "Syntax");
      const syntaxKind = String(syntaxNode?.kind || "None");
      const id = addNode("csharp.roslynNode", {
        syntaxKind,
        languageVersion: "14.0",
        variadicInputCount: Math.max(2, childIds.length)
      }, depth, syntaxKind);
      childIds.forEach((childId, index) => connect(childId, id, portId(index)));
      return id;
    };

    const rootSyntaxNodeId = addSyntaxNode(parseResult.root, 0);
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
      parser: "Roslyn",
      languageVersion: "14.0"
    };
  }

  function importIntoCurrentGraph(source, options = {}) {
    const host = window.RMLDynamicGraphHost;
    const state = host?.getRootState?.() || host?.getState?.();
    if (!state || !Array.isArray(state.nodes) || !Array.isArray(state.connections)) {
      return { ok: false, diagnostics: ["The Runtime Graph is not ready."] };
    }
    let attempt = 0;
    let fragment;
    const usedIds = new Set([...state.nodes.map(node => node.id), ...state.connections.map(connection => connection.id)]);
    do {
      fragment = createImportFragment(source, {
        ...options,
        prefix: `${options.prefix || "csharp-import"}-${stableHash(source)}-${attempt || 1}`
      });
      attempt += 1;
    } while (fragment.ok && [...fragment.nodes, ...fragment.connections].some(item => usedIds.has(item.id)) && attempt < 100);
    if (!fragment.ok) return fragment;
    return storeCustomCSharpFragment(fragment, host, state, source);
  }

  function importRoslynIntoCurrentGraph(source, parseResult, options = {}) {
    const host = window.RMLDynamicGraphHost;
    const state = host?.getRootState?.() || host?.getState?.();
    if (!state || !Array.isArray(state.nodes) || !Array.isArray(state.connections)) {
      return { ok: false, diagnostics: ["The Runtime Graph is not ready."] };
    }
    let attempt = 0;
    let fragment;
    const usedIds = new Set([...state.nodes.map(node => node.id), ...state.connections.map(connection => connection.id)]);
    do {
      fragment = createRoslynImportFragment(source, parseResult, {
        ...options,
        prefix: `${options.prefix || "csharp14-roslyn-import"}-${stableHash(source)}-${attempt || 1}`
      });
      attempt += 1;
    } while (fragment.ok && [...fragment.nodes, ...fragment.connections].some(item => usedIds.has(item.id)) && attempt < 100);
    if (!fragment.ok) return fragment;
    return storeCustomCSharpFragment(fragment, host, state, source);
  }

  function createCustomCSharpFileGraphFromFragment(fragment) {
    const mainFileNode = fragment.nodes.find(node => node?.id === fragment.fileNodeId && node?.operatorId === "csharp.file");
    if (!mainFileNode) {
      return { ok: false, diagnostics: ["The imported C# graph has no Custom C# File container."] };
    }

    const internalNodes = fragment.nodes.map(node => node.id === mainFileNode.id
      ? {
          ...node,
          operatorId: "csharp.customFileOutput",
          label: `Output · ${String(mainFileNode.parameters?.fileName || "Custom C# File")}`,
          parameters: {}
        }
      : node);
    const customGraph = {
      version: 1,
      fileName: String(mainFileNode.parameters?.fileName || "Imported.cs"),
      projectId: String(mainFileNode.parameters?.projectId || "main"),
      parser: String(fragment.parser || "Visual C# lexer"),
      languageVersion: String(fragment.languageVersion || "14.0"),
      importedSource: false,
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

  function storeCustomCSharpFragment(fragment, host, state, originalSource = null) {
    const prepared = createCustomCSharpFileGraphFromFragment(fragment);
    if (!prepared.ok) {
      return { ...prepared, nodes: [], connections: [] };
    }
    const { mainFileNode, importedSyntaxNodeCount } = prepared;
    if (state.nodes.some(node => node?.id === mainFileNode.id)) {
      return { ok: false, diagnostics: [`A Runtime Graph node with id '${mainFileNode.id}' already exists.`], nodes: [], connections: [] };
    }

    state.customCSharpFiles = state.customCSharpFiles && typeof state.customCSharpFiles === "object"
      ? state.customCSharpFiles
      : {};
    const importedFileName = String(mainFileNode.parameters?.fileName || "Imported.cs").trim().toLowerCase();
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
        diagnostics: [activation?.reason || "The Runtime Graph could not be opened after importing the C# file."],
        nodes: [],
        connections: []
      };
    }
    host.commit?.();
    return {
      ...fragment,
      nodes: [runtimeFileNode],
      connections: [],
      importedSyntaxNodeCount,
      openedCustomCSharpGraph: false,
      replacedExistingFile: matchingFiles.length > 0,
      removedDuplicateFileCount: duplicateIds.size
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
    };

    const summary = document.createElement("summary");
    summary.textContent = "Expert tools · C# 14 / Roslyn conversion";
    expertPanel.appendChild(summary);

    const body = document.createElement("div");
    body.className = "project-csharp-import-body";

    const warning = document.createElement("div");
    warning.className = "project-csharp-import-warning";
    warning.innerHTML =
      "<strong>Official C# 14 syntax parse—not verified program logic.</strong> " +
      "The bundled .NET 10 Roslyn parser must accept the complete file before it is converted into AST, token and trivia nodes. " +
      "This proves C# 14 grammar and preserves source text, but does not prove semantic compilation, compatible Resonite APIs or correct runtime behavior.";
    body.appendChild(warning);

    const acknowledgementLabel = document.createElement("label");
    acknowledgementLabel.className = "project-csharp-import-acknowledgement";
    const acknowledgement = document.createElement("input");
    acknowledgement.type = "checkbox";
    acknowledgement.id = "project-import-csharp-acknowledgement";
    const acknowledgementText = document.createElement("span");
    acknowledgementText.textContent =
      "I understand that Roslyn validates C# 14 syntax only and that compile plus Resonite runtime validation are still required.";
    acknowledgementLabel.append(acknowledgement, acknowledgementText);
    body.appendChild(acknowledgementLabel);

    const button = document.createElement("button");
    button.id = "project-import-csharp";
    button.className = "button secondary project-csharp-import-button";
    button.type = "button";
    button.textContent = "Choose C# 14 source…";
    button.disabled = true;

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
    cancel.textContent = "Cancel";
    const commit = document.createElement("button");
    commit.className = "button primary";
    commit.type = "button";
    commit.textContent = "Import as Custom C# File";
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
      button.disabled = !acknowledgement.checked;
      if (!acknowledgement.checked) clearPending();
    });
    button.addEventListener("click", () => {
      if (acknowledgement.checked) input.click();
    });
    input.addEventListener("change", async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const source = await file.text();
        if (!window.RMLCSharp14Roslyn?.parse) {
          throw new Error("The local Roslyn C# 14 runtime loader is unavailable. Reload the complete Builder package.");
        }
        localStatus.textContent = "Loading the bundled .NET 10 Roslyn parser and validating C# 14 syntax…";
        localStatus.classList.remove("success", "error");
        const parseResult = await window.RMLCSharp14Roslyn.parse(source);
        if (parseResult.ok !== true) {
          throw new Error(formatRoslynDiagnostics(parseResult.diagnostics).join("\n"));
        }
        const syntaxItemCount = countRoslynSyntaxItems(parseResult.root);
        pendingImport = { fileName: file.name, source, parseResult, syntaxItemCount };
        pendingText.textContent =
          `${file.name} passed Roslyn C# 14 syntax validation. One Custom C# File node will be added to the Runtime Graph with the complete persistent file text in its Actions and ${syntaxItemCount.toLocaleString()} editable AST, token and trivia elements in its automatically available Node Graph. Nothing has been imported yet.`;
        pending.hidden = false;
        localStatus.textContent = "Roslyn syntax validation passed. Review the conversion and confirm it explicitly.";
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
      localStatus.textContent = "C# conversion cancelled. The graph was not changed.";
      localStatus.classList.remove("success", "error");
    });

    commit.addEventListener("click", () => {
      if (!pendingImport || !acknowledgement.checked) return;
      try {
        const result = importRoslynIntoCurrentGraph(pendingImport.source, pendingImport.parseResult, {
          fileName: pendingImport.fileName,
          projectId: "main"
        });
        if (!result.ok) throw new Error(result.diagnostics.join("\n"));
        const importedFileName = pendingImport.fileName;
        clearPending();
        acknowledgement.checked = false;
        button.disabled = true;
        localStatus.textContent =
          `${result.replacedExistingFile ? "Updated" : "Imported"} ${importedFileName} as one Custom C# File node${result.removedDuplicateFileCount ? ` and removed ${result.removedDuplicateFileCount} obsolete same-name duplicate${result.removedDuplicateFileCount === 1 ? "" : "s"}` : ""}. Its Actions contain the complete persistent imported source text, and Open Node Graph directly opens its ${result.importedSyntaxNodeCount.toLocaleString()} Roslyn C# 14 syntax nodes. Semantic compile and Resonite runtime validation are still required.`;
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
  }

  const visualCSharpApi = Object.freeze({
    version: VERSION,
    lex: lexVisualCSharp,
    createImportFragment,
    importIntoCurrentGraph,
    createRoslynImportFragment,
    createCustomCSharpFileGraphFromFragment,
    sourceHash: stableHash,
    renderCustomCSharpGraph,
    importRoslynIntoCurrentGraph,
    formatRoslynDiagnostics
  });
  Object.defineProperty(window, "RMLVisualCSharp", {
    value: visualCSharpApi,
    configurable: true,
    enumerable: true
  });
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", installCSharpImportControl, { once: true });
  } else {
    installCSharpImportControl();
  }

  Object.defineProperty(window, "RMLVisualCSharpReport", {
    value: Object.freeze({
      version: VERSION,
      representation: "roslyn-csharp14-ast-token-trivia-plus-structured-nodes",
      targetFramework: "net10.0",
      languageVersion: "14.0",
      grammarValidator: "bundled-dotnet10-roslyn-webassembly",
      grammarImportFailClosed: true,
      sourceBoundAst: true,
      roslynAstNodes: true,
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
