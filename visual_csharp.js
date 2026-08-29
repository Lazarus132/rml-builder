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
    getNodeDefinition,
    getNodeDefinitions,
    getTypeDefinitions
  } = registry;

  const VERSION = 13;
  const CUSTOM_CSHARP_COORDINATE_SPACE_VERSION = 2;
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
      bool("static", "Static", false),
      code("exactSource", "Exact Roslyn source", "", "Roslyn-certified directive text, including any valid comments, tabs and line breaks.", 3),
      code("leadingTrivia", "Leading trivia", "", "Exact Roslyn trivia retained by compact imports.", 2),
      code("trailingTrivia", "Trailing trivia", "", "Exact Roslyn trivia retained by compact imports.", 2),
      text("validationSignature", "Import validation signature", "")
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
      const name = requireQualifiedName(ctx, parameter(ctx.node, "name", "System"), "namespace/type name");
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

  registerSyntaxNode("csharp.qualifiedAccess", {
    title: "Qualified Member Access",
    group: GROUPS.expressions,
    symbol: "A.B",
    parameters: [text("path", "Qualified path", "value.Member")],
    syntaxRender(ctx) {
      return requireQualifiedName(ctx, parameter(ctx.node, "path", "value.Member"), "qualified member path");
    }
  });
  registerSyntaxNode("csharp.compactInvocation", {
    title: "Compact Invocation",
    group: GROUPS.expressions,
    symbol: "CALL",
    parameters: [
      text("target", "Call target", "Method"),
      number("variadicInputCount", "Argument count", 2)
    ],
    inputs: [syntaxInput("a", "Argument A"), syntaxInput("b", "Argument B")],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 512,
      template: syntaxInput("a", "Argument A")
    },
    syntaxRender(ctx) {
      const target = String(parameter(ctx.node, "target", "Method")).trim();
      if (!TYPE_TEXT.test(target)) {
        ctx.diagnostic(`${ctx.title}: '${target}' is not a valid qualified or generic invocation target.`);
        return "__invalid_call()";
      }
      const argumentsList = ctx.variadic().map(value => value.trim()).filter(Boolean);
      return `${target}(${argumentsList.join(", ")})`;
    }
  });
  registerSyntaxNode("csharp.conditionalInvocation", {
    title: "Conditional Invocation",
    group: GROUPS.expressions,
    symbol: "?.()",
    parameters: [
      text("target", "Conditional target", "value"),
      text("member", "Member", "Method"),
      number("variadicInputCount", "Argument count", 2)
    ],
    inputs: [syntaxInput("a", "Argument A"), syntaxInput("b", "Argument B")],
    variadicInputs: {
      minimum: 2,
      defaultCount: 2,
      maximum: 512,
      template: syntaxInput("a", "Argument A")
    },
    syntaxRender(ctx) {
      const target = requireQualifiedName(ctx, parameter(ctx.node, "target", "value"), "conditional target");
      const member = requireIdentifier(ctx, parameter(ctx.node, "member", "Method"), "conditional member");
      const argumentsList = ctx.variadic().map(value => value.trim()).filter(Boolean);
      return `${target}?.${member}(${argumentsList.join(", ")})`;
    }
  });
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
  statementNode("csharp.localDeclaration", "Local Declaration", "VAR", [text("type", "Type", "var"), text("name", "Name", "value"), select("modifier", "Modifier", ["none", "const", "using", "await using", "ref", "ref readonly", "scoped", "scoped ref"], "none"), bool("omitSemicolon", "Omit semicolon", false)], [syntaxInput("initializer", "Initializer")], ctx => `${parameter(ctx.node, "modifier", "none") === "none" ? "" : `${parameter(ctx.node, "modifier")} `}${parameter(ctx.node, "type", "var") === "var" ? "var" : requireType(ctx, parameter(ctx.node, "type", "object"))} ${requireIdentifier(ctx, parameter(ctx.node, "name", "value"), "local name")}${ctx.input("initializer").trim() ? ` = ${ctx.input("initializer")}` : ""}${parameter(ctx.node, "omitSemicolon", false) ? "" : ";"}`);
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
        token.kind !== "OpenParenToken" &&
        token.kind !== "CloseParenToken"
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
        name: "System",
        alias: "",
        global: false,
        static: false,
        exactSource: value,
        leadingTrivia: "",
        trailingTrivia: ""
      };
      parameters.validationSignature = stableHash(`using-exact\0${value}`);
      return addNode("csharp.using", parameters, depth, "Using Directive");
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

    let addOptimizedSyntaxNode;
    const addSyntaxNode = (syntaxNode, depth = 0) => {
      let childIds = [];
      for (const child of syntaxNode?.children || []) {
        if (child?.type === "node" && child.node) childIds.push(addOptimizedSyntaxNode(child.node, depth + 1, true));
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
        if (kind === "Parameter") {
          const match = /^(?:(?:this|ref readonly|ref|out|in|params|scoped ref|scoped)\s+)?(.+?)\s+(@?[\p{L}_][\p{L}\p{N}_]*)(?:\s*=|$)/u.exec(core);
          if (match) recordSymbolType(match[2], match[1]);
        } else if (kind === "VariableDeclaration") {
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
    for (const [operatorId, definition] of catalogDefinitions) {
      const key = [
        resolveCatalogType(definition.catalogType),
        String(definition.apiMemberKind || ""),
        String(definition.catalogMember || "")
      ].join("\0");
      if (!catalogByOwnerKindMember.has(key)) catalogByOwnerKindMember.set(key, []);
      catalogByOwnerKindMember.get(key).push({ operatorId, definition });
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
      if (kind === "IdentifierName") {
        result = symbolTypes.get(core.replace(/^@/, "")) || resolveCatalogType(core);
      } else if (/^(?:ObjectCreationExpression|ImplicitObjectCreationExpression)$/.test(kind)) {
        const type = /^new\s+([^({]+?)(?:\s*\(|\s*\{)/s.exec(core)?.[1];
        result = resolveCatalogType(type || "");
      } else if (kind === "CastExpression") {
        result = resolveCatalogType(/^\(\s*([^()]+)\s*\)/s.exec(core)?.[1] || "");
      } else if (kind === "StringLiteralExpression" || kind === "InterpolatedStringExpression") {
        result = "System.String";
      } else if (kind === "TrueLiteralExpression" || kind === "FalseLiteralExpression") {
        result = "System.Boolean";
      } else if (kind === "NumericLiteralExpression") {
        result = /[fF]$/.test(core) ? "System.Single" : /[dD]$/.test(core) ? "System.Double" : /[mM]$/.test(core) ? "System.Decimal" : "System.Int32";
      } else if (kind === "ParenthesizedExpression") {
        result = inferExpressionType(children[0]);
      } else if (kind === "ElementAccessExpression") {
        const collection = inferExpressionType(children[0]);
        result = collection.endsWith("[]") ? collection.slice(0, -2) : "";
      } else if (kind === "SimpleMemberAccessExpression") {
        const owner = inferExpressionType(children[0]);
        const member = syntaxCoreText(children.at(-1)).replace(/<.*>$/, "");
        const candidates = [
          ...catalogMembers(owner, "property-get", member),
          ...catalogMembers(owner, "field-get", member)
        ];
        if (candidates.length === 1) result = resolveCatalogType(candidates[0].definition.apiReturnType);
      } else if (kind === "InvocationExpression") {
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
        if (parameters.some(parameter => parameter?.isOut === true)) return false;
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
      ["NumericLiteralExpression", "number"],
      ["TrueLiteralExpression", "true"],
      ["FalseLiteralExpression", "false"],
      ["NullLiteralExpression", "null"],
      ["DefaultLiteralExpression", "default"]
    ]);
    const binaryOperatorByKind = new Map([
      ["AddExpression", "+"], ["SubtractExpression", "-"],
      ["MultiplyExpression", "*"], ["DivideExpression", "/"],
      ["ModuloExpression", "%"], ["EqualsExpression", "=="],
      ["NotEqualsExpression", "!="], ["LessThanExpression", "<"],
      ["GreaterThanExpression", ">"], ["LessThanOrEqualExpression", "<="],
      ["GreaterThanOrEqualExpression", ">="], ["LogicalAndExpression", "&&"],
      ["LogicalOrExpression", "||"], ["BitwiseAndExpression", "&"],
      ["BitwiseOrExpression", "|"], ["ExclusiveOrExpression", "^"],
      ["LeftShiftExpression", "<<"], ["RightShiftExpression", ">>"],
      ["CoalesceExpression", "??"], ["IsExpression", "is"],
      ["AsExpression", "as"]
    ]);
    const assignmentOperatorByKind = new Map([
      ["SimpleAssignmentExpression", "="], ["AddAssignmentExpression", "+="],
      ["SubtractAssignmentExpression", "-="], ["MultiplyAssignmentExpression", "*="],
      ["DivideAssignmentExpression", "/="], ["ModuloAssignmentExpression", "%="],
      ["AndAssignmentExpression", "&="], ["OrAssignmentExpression", "|="],
      ["ExclusiveOrAssignmentExpression", "^="], ["LeftShiftAssignmentExpression", "<<="],
      ["RightShiftAssignmentExpression", ">>="], ["CoalesceAssignmentExpression", "??="]
    ]);
    const jumpKindBySyntaxKind = new Map([
      ["ReturnStatement", "return"], ["ThrowStatement", "throw"],
      ["BreakStatement", "break"], ["ContinueStatement", "continue"],
      ["YieldReturnStatement", "yield return"], ["YieldBreakStatement", "yield break"],
      ["GotoStatement", "goto"], ["GotoCaseStatement", "goto case"],
      ["GotoDefaultStatement", "goto default"]
    ]);
    const typeDeclarationKind = new Map([
      ["ClassDeclaration", "class"], ["StructDeclaration", "struct"],
      ["InterfaceDeclaration", "interface"], ["RecordDeclaration", "record"],
      ["RecordStructDeclaration", "record struct"], ["EnumDeclaration", "enum"]
    ]);
    const keywordByKind = new Map([
      ["TypeOfExpression", "typeof"], ["NameOfExpression", "nameof"],
      ["SizeOfExpression", "sizeof"], ["DefaultExpression", "default"],
      ["CheckedExpression", "checked"], ["UncheckedExpression", "unchecked"]
    ]);
    const unaryOperatorByKind = new Map([
      ["UnaryPlusExpression", "+"], ["UnaryMinusExpression", "-"],
      ["LogicalNotExpression", "!"], ["BitwiseNotExpression", "~"],
      ["PreIncrementExpression", "++pre"], ["PreDecrementExpression", "--pre"],
      ["PostIncrementExpression", "++post"], ["PostDecrementExpression", "--post"],
      ["AddressOfExpression", "&"], ["PointerIndirectionExpression", "*"],
      ["IndexExpression", "^"], ["AwaitExpression", "await"],
      ["SuppressNullableWarningExpression", "!post"]
    ]);
    const resourceKindBySyntaxKind = new Map([
      ["UsingStatement", "using"], ["LockStatement", "lock"],
      ["FixedStatement", "fixed"], ["CheckedStatement", "checked"],
      ["UncheckedStatement", "unchecked"], ["UnsafeStatement", "unsafe"]
    ]);
    const initializerDelimiterByKind = new Map([
      ["ArrayInitializerExpression", "braces"],
      ["ObjectInitializerExpression", "braces"],
      ["CollectionInitializerExpression", "braces"],
      ["ComplexElementInitializerExpression", "braces"],
      ["CollectionExpression", "brackets"]
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

      if (kind === "IdentifierName" && IDENTIFIER.test(semanticValue)) {
        return addNode("csharp.identifier", { name: semanticValue }, depth, semanticValue);
      }
      if ((kind === "PredefinedType" || /(?:Name|Type)$/.test(kind)) && TYPE_TEXT.test(semanticValue)) {
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
      if (!significantTrivia && kind === "StringLiteralExpression" && /^"(?:[^"\\]|\\.)*"$/s.test(semanticValue)) {
        try {
          const decoded = JSON.parse(semanticValue);
          return addNode("csharp.literal", { kind: "string", value: decoded }, depth, kind);
        } catch {}
      }

      const children = directSyntaxChildren(syntaxNode);

      if (!significantTrivia && kind === "CompilationUnit") {
        return addSyntaxSequence(children, "newline", depth, "Compilation Unit") ||
          addNode("csharp.trivia", { kind: "exact", count: 1, value: "" }, depth, kind);
      }

      if (!significantTrivia && kind === "Parameter") {
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

      if (!significantTrivia && kind === "TypeParameter") {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(in|out) )?(@?[\p{L}_][\p{L}\p{N}_]*)$/u.exec(core);
        if (match) {
          return addNode("csharp.genericParameter", {
            variance: match[1] || "none", name: match[2]
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "TypeParameterConstraintClause") {
        const core = syntaxCoreText(syntaxNode);
        const match = /^where (@?[\p{L}_][\p{L}\p{N}_]*)\s*:\s*([\s\S]+)$/u.exec(core);
        if (match) {
          const constraintNodes = children.filter(child => /Constraint$/.test(String(child?.kind || "")));
          return addSemanticNode("csharp.constraint", { parameter: match[1] }, {
            constraints: addSyntaxSequence(constraintNodes, "commaSpace", depth + 1, "Constraints")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "AttributeList") {
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
            arguments: addSyntaxSequence(argumentNodes, "commaSpace", depth + 1, "Arguments")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "Block") {
        const statements = children.filter(child => /Statement$/.test(String(child?.kind || "")));
        return addSemanticNode("csharp.block", {}, {
          statements: addSyntaxSequence(statements, "newline", depth + 1, "Statements")
        }, depth, kind);
      }

      if (!significantTrivia && initializerDelimiterByKind.has(kind)) {
        const items = children.filter(child => !/(?:ArgumentList|BracketedArgumentList)$/.test(String(child?.kind || "")));
        return addSemanticNode("csharp.delimited", {
          delimiter: initializerDelimiterByKind.get(kind),
          layout: /[\r\n]/.test(syntaxCoreText(syntaxNode)) ? "block" : "inline",
          suffix: "none"
        }, {
          content: addSyntaxSequence(items, "commaSpace", depth + 1, "Initializer Items")
        }, depth, kind);
      }

      if (!significantTrivia && kind === "ImplicitArrayCreationExpression") {
        const initializer = children.find(child => String(child?.kind || "") === "ArrayInitializerExpression");
        const items = initializer ? directSyntaxChildren(initializer) : [];
        return addSemanticNode("csharp.objectCreation", {
          type: "object", kind: "implicitArray"
        }, {
          initializer: addSyntaxSequence(items, "commaSpace", depth + 1, "Initializer Items")
        }, depth, kind);
      }

      if (!significantTrivia && kind === "ImplicitObjectCreationExpression") {
        const argumentList = children.find(child => String(child?.kind || "") === "ArgumentList");
        const initializer = children.find(child => String(child?.kind || "") === "ObjectInitializerExpression");
        const argumentsList = argumentList
          ? directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument")
          : [];
        const initializerItems = initializer ? directSyntaxChildren(initializer) : [];
        return addSemanticNode("csharp.objectCreation", {
          type: "object", kind: "implicitObject"
        }, {
          arguments: addSyntaxSequence(argumentsList, "commaSpace", depth + 1, "Arguments"),
          initializer: addSyntaxSequence(initializerItems, "commaSpace", depth + 1, "Initializer Items")
        }, depth, kind);
      }

      if (!significantTrivia && ["NamespaceDeclaration", "FileScopedNamespaceDeclaration"].includes(kind)) {
        const core = syntaxCoreText(syntaxNode);
        const match = /^namespace\s+([^\s;{]+)\s*[;{]/u.exec(core);
        if (match && QUALIFIED_NAME.test(match[1])) {
          const members = children.filter(child => {
            const childKind = String(child?.kind || "");
            return childKind === "UsingDirective" || childKind === "ExternAliasDirective" ||
              (/Declaration$/.test(childKind) && !/(?:Name|Type)Declaration$/.test(childKind));
          });
          return addSemanticNode("csharp.namespace", {
            name: match[1], style: kind === "FileScopedNamespaceDeclaration" ? "fileScoped" : "block"
          }, {
            members: addSyntaxSequence(members, "newline", depth + 1, "Members")
          }, depth, kind);
        }
      }
      if (!significantTrivia && typeDeclarationKind.has(kind)) {
        const tokens = directTokens(syntaxNode).filter(token => token?.isMissing !== true);
        const keywordIndex = tokens.findIndex(token => ["ClassKeyword", "StructKeyword", "InterfaceKeyword", "RecordKeyword", "EnumKeyword"].includes(String(token?.kind || "")));
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
            name: String(nameToken.text || "GeneratedType"),
            modifiers
          }, {
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, "Attributes"),
            typeParameters: addSyntaxSequence(typeParameters, "commaSpace", depth + 1, "Type Parameters"),
            primaryConstructor: addSyntaxSequence(primaryParameters, "commaSpace", depth + 1, "Primary Constructor"),
            baseTypes: addSyntaxSequence(baseTypes, "commaSpace", depth + 1, "Base Types"),
            constraints: addSyntaxSequence(constraints, "newline", depth + 1, "Constraints"),
            members: addSyntaxSequence(
              members,
              typeDeclarationKind.get(kind) === "enum" ? "commaSpace" : "newline",
              depth + 1,
              "Members"
            )
          }, depth, kind);
        }
      }

      if (!significantTrivia && (kind === "MethodDeclaration" || kind === "LocalFunctionStatement")) {
        const parameterList = children.find(child => String(child?.kind || "") === "ParameterList");
        const bodyNode = children.find(child => ["Block", "ArrowExpressionClause"].includes(String(child?.kind || "")));
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
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, "Attributes"),
            typeParameters: addSyntaxSequence(typeParameters, "commaSpace", depth + 1, "Type Parameters"),
            parameters: addSyntaxSequence(parameters, "commaSpace", depth + 1, "Parameters"),
            constraints: addSyntaxSequence(constraints, "newline", depth + 1, "Constraints"),
            body: addSyntaxSequence(bodyChildren, "newline", depth + 1, "Body")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "ConstructorDeclaration") {
        const parameterList = children.find(child => String(child?.kind || "") === "ParameterList");
        const bodyNode = children.find(child => ["Block", "ArrowExpressionClause"].includes(String(child?.kind || "")));
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
            parameters: addSyntaxSequence(parameters, "commaSpace", depth + 1, "Parameters"),
            initializerArguments: addSyntaxSequence(initializerArguments, "commaSpace", depth + 1, "Initializer Arguments"),
            body: addSyntaxSequence(bodyChildren, "newline", depth + 1, "Body")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "DelegateDeclaration") {
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
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, "Attributes"),
            typeParameters: addSyntaxSequence(typeParameters, "commaSpace", depth + 1, "Type Parameters"),
            parameters: addSyntaxSequence(parameters, "commaSpace", depth + 1, "Parameters"),
            constraints: addSyntaxSequence(constraints, "newline", depth + 1, "Constraints")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "FieldDeclaration") {
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
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, "Attributes"),
            initializer: match[4] && initializer ? addOptimizedSyntaxNode(initializer, depth + 1) : null
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "PropertyDeclaration") {
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
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, "Attributes"),
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, "Accessors"),
            initializer: initializerValue ? addOptimizedSyntaxNode(initializerValue, depth + 1) : null
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "AccessorDeclaration") {
        const core = syntaxCoreText(syntaxNode);
        const accessorMatch = /^(?:(.*?) )?(get|set|init|add|remove)(?:;|\s*=>|\s*\{)/.exec(core);
        if (accessorMatch) {
          const bodyNode = children.find(child => ["Block", "ArrowExpressionClause"].includes(String(child?.kind || "")));
          const bodyChildren = bodyNode
            ? String(bodyNode.kind || "") === "Block"
              ? directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")))
              : directSyntaxChildren(bodyNode)
            : [];
          return addSemanticNode("csharp.accessor", {
            kind: accessorMatch[2], modifiers: String(accessorMatch[1] || ""),
            bodyStyle: !bodyNode ? "semicolon" : String(bodyNode.kind || "") === "Block" ? "block" : "expression"
          }, {
            body: addSyntaxSequence(bodyChildren, "newline", depth + 1, "Body")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "EventFieldDeclaration") {
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

      if (!significantTrivia && kind === "EventDeclaration") {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(?:(.*?) )?event ([^\s]+) (@?[\p{L}_][\p{L}\p{N}_]*)\s*\{/u.exec(core);
        const accessorList = children.find(child => String(child?.kind || "") === "AccessorList");
        if (match && TYPE_TEXT.test(match[2]) && accessorList) {
          const attributes = children.filter(child => String(child?.kind || "") === "AttributeList");
          const accessors = directSyntaxChildren(accessorList).filter(child => String(child?.kind || "") === "AccessorDeclaration");
          return addSemanticNode("csharp.event", {
            name: match[3], type: match[2], modifiers: String(match[1] || "")
          }, {
            attributes: addSyntaxSequence(attributes, "newline", depth + 1, "Attributes"),
            accessors: addSyntaxSequence(accessors, "newline", depth + 1, "Accessors")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "EnumMemberDeclaration") {
        const core = syntaxCoreText(syntaxNode);
        const match = /^(@?[\p{L}_][\p{L}\p{N}_]*)(?:\s*=\s*([\s\S]+))?$/u.exec(core);
        if (match) {
          const valueNode = children.at(-1);
          return addSemanticNode("csharp.enumMember", { name: match[1] }, {
            value: match[2] && valueNode ? addOptimizedSyntaxNode(valueNode, depth + 1) : null
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "LocalDeclarationStatement") {
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
      if (!significantTrivia && kind === "VariableDeclaration") {
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
      if (kind === "ParenthesizedExpression" && children.length === 1) {
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

      if ((kind === "SimpleMemberAccessExpression" || kind === "MemberBindingExpression") && children.length === 2) {
        const leftText = syntaxCoreText(children[0]);
        const rightText = syntaxCoreText(children[1]);
        if (!significantTrivia && semanticValue.replace(/\s+/g, "") === `${leftText}.${rightText}`.replace(/\s+/g, "")) {
          if (kind === "SimpleMemberAccessExpression") {
            const owner = inferExpressionType(children[0]);
            const member = rightText.replace(/<.*>$/, "").replace(/^@/, "");
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

      if (!significantTrivia && kind === "InvocationExpression" && children.length >= 2) {
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
            arguments: addSyntaxSequence(argumentsList, "commaSpace", depth + 1, "Arguments")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "ConditionalAccessExpression") {
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

      if (!significantTrivia && kind === "ElementAccessExpression" && children.length >= 2) {
        const target = children[0];
        const argumentList = children.find(child => String(child?.kind || "") === "BracketedArgumentList");
        if (argumentList) {
          const argumentsList = directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument");
          const owner = inferExpressionType(target);
          const candidates = catalogMembers(owner, "property-get", "Item").filter(({ definition }) => {
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
            arguments: addSyntaxSequence(argumentsList, "commaSpace", depth + 1, "Arguments")
          }, depth, kind);
        }
      }

      if (!significantTrivia && binaryOperatorByKind.has(kind) && children.length === 2) {
        return addSemanticNode("csharp.binary", { operator: binaryOperatorByKind.get(kind) }, {
          left: addOptimizedSyntaxNode(children[0], depth + 1),
          right: addOptimizedSyntaxNode(children[1], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && kind === "IsPatternExpression" && children.length === 2) {
        return addSemanticNode("csharp.binary", { operator: "is" }, {
          left: addOptimizedSyntaxNode(children[0], depth + 1),
          right: addOptimizedSyntaxNode(children[1], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && ["ConstantPattern", "TypePattern", "ParenthesizedPattern"].includes(kind) && children.length === 1) {
        return addOptimizedSyntaxNode(children[0], depth);
      }

      if (!significantTrivia && kind === "NotPattern" && children.length === 1) {
        return addSemanticNode("csharp.unary", { operator: "not" }, {
          operand: addOptimizedSyntaxNode(children[0], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && ["AndPattern", "OrPattern"].includes(kind) && children.length === 2) {
        return addSemanticNode("csharp.binary", {
          operator: kind === "AndPattern" ? "and" : "or"
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

      if (!significantTrivia && kind === "CastExpression" && children.length === 2) {
        const typeText = syntaxCoreText(children[0]);
        if (TYPE_TEXT.test(typeText)) {
          return addSemanticNode("csharp.cast", { type: typeText }, {
            value: addOptimizedSyntaxNode(children[1], depth + 1)
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "ObjectCreationExpression") {
        const core = syntaxCoreText(syntaxNode);
        const match = /^new\s+([^\s(\[{]+(?:<[^{};=]+>)?)\s*\(/u.exec(core);
        const argumentList = children.find(child => String(child?.kind || "") === "ArgumentList");
        const initializer = children.find(child => String(child?.kind || "") === "ObjectInitializerExpression");
        if (match && argumentList && TYPE_TEXT.test(match[1])) {
          const argumentsList = directSyntaxChildren(argumentList).filter(child => String(child?.kind || "") === "Argument");
          const initializerItems = initializer ? directSyntaxChildren(initializer) : [];
          if (initializerItems.length === 0) {
            const owner = resolveCatalogType(match[1]);
            let constructors = catalogMembers(owner, "constructor", "").filter(({ definition }) => {
              const parameters = Array.isArray(definition.apiParameters) ? definition.apiParameters : [];
              if (parameters.some(parameter => parameter?.isOut === true)) return false;
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
            arguments: addSyntaxSequence(argumentsList, "commaSpace", depth + 1, "Arguments"),
            initializer: addSyntaxSequence(initializerItems, "commaSpace", depth + 1, "Initializer")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "ConditionalExpression" && children.length === 3) {
        return addSemanticNode("csharp.conditional", {}, {
          condition: addOptimizedSyntaxNode(children[0], depth + 1),
          true: addOptimizedSyntaxNode(children[1], depth + 1),
          false: addOptimizedSyntaxNode(children[2], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && ["SimpleLambdaExpression", "ParenthesizedLambdaExpression", "AnonymousMethodExpression"].includes(kind)) {
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
            kind: kind === "AnonymousMethodExpression" ? "anonymous" : "lambda",
            modifiers: String(modifierMatch?.[1] || modifierMatch?.[2] || ""),
            expressionBody: !blockBody
          }, {
            parameters: addSyntaxSequence(parameters, "commaSpace", depth + 1, "Parameters"),
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, "Body")
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
            const candidates = catalogMembers(owner, "property-set", "Item").filter(({ definition }) => {
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

      if (kind === "Argument" && children.length === 1) {
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

      if (!significantTrivia && kind === "ExpressionStatement" && children.length === 1) {
        return addSemanticNode("csharp.expressionStatement", {}, {
          expression: addOptimizedSyntaxNode(children[0], depth + 1)
        }, depth, kind);
      }

      if (!significantTrivia && kind === "IfStatement" && children.length >= 2) {
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
          then: addSyntaxSequence(thenNodes, "newline", depth + 1, "Then"),
          else: addSyntaxSequence(elseNodes, "newline", depth + 1, "Else")
        }, depth, kind);
      }

      if (!significantTrivia && kind === "LabeledStatement" && children.length === 1) {
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
          body: addSyntaxSequence(bodyNodes, "newline", depth + 1, "Body")
        }, depth, kind);
      }

      if (!significantTrivia && kind === "CatchClause") {
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
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, "Body")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "TryStatement") {
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
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, "Body"),
            catches: addSyntaxSequence(catches, "newline", depth + 1, "Catches"),
            finally: addSyntaxSequence(finallyNodes, "newline", depth + 1, "Finally")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "SwitchStatement" && children.length >= 1) {
        const valueNode = children[0];
        const sections = children.filter(child => String(child?.kind || "") === "SwitchSection");
        return addSemanticNode("csharp.switch", { expression: false }, {
          value: addOptimizedSyntaxNode(valueNode, depth + 1),
          sections: addSyntaxSequence(sections, "newline", depth + 1, "Sections")
        }, depth, kind);
      }

      if (!significantTrivia && kind === "SwitchSection") {
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
            body: addSyntaxSequence(statements, "newline", depth + 1, "Body")
          }, depth, kind);
        }
      }

      if (!significantTrivia && kind === "SwitchExpression" && children.length >= 1) {
        const valueNode = children[0];
        const arms = children.filter(child => String(child?.kind || "") === "SwitchExpressionArm");
        return addSemanticNode("csharp.switch", { expression: true }, {
          value: addOptimizedSyntaxNode(valueNode, depth + 1),
          sections: addSyntaxSequence(arms, "newline", depth + 1, "Arms")
        }, depth, kind);
      }

      if (!significantTrivia && kind === "SwitchExpressionArm" && children.length >= 2) {
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

      if (!significantTrivia && ["WhileStatement", "DoStatement"].includes(kind) && children.length >= 2) {
        const condition = kind === "WhileStatement" ? children[0] : children.at(-1);
        const bodyNode = kind === "WhileStatement" ? children[1] : children[0];
        const bodyNodes = String(bodyNode?.kind || "") === "Block"
          ? directSyntaxChildren(bodyNode).filter(child => /Statement$/.test(String(child?.kind || "")))
          : [bodyNode];
        return addSemanticNode("csharp.loop", {
          kind: kind === "DoStatement" ? "do" : "while", iterator: "item", iteratorType: "var"
        }, {
          condition: addOptimizedSyntaxNode(condition, depth + 1),
          body: addSyntaxSequence(bodyNodes, "newline", depth + 1, "Body")
        }, depth, kind);
      }

      if (!significantTrivia && kind === "ForStatement") {
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
            initializer: addSyntaxSequence(initializers, "commaSpace", depth + 1, "Initializers"),
            condition: addSyntaxSequence(conditions, "commaSpace", depth + 1, "Condition"),
            increment: addSyntaxSequence(increments, "commaSpace", depth + 1, "Increment"),
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, "Body")
          }, depth, kind);
        }
      }

      if (!significantTrivia && ["ForEachStatement", "ForEachVariableStatement"].includes(kind)) {
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
            body: addSyntaxSequence(bodyNodes, "newline", depth + 1, "Body")
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
        const semanticId = tryAddSemanticNode(syntaxNode, depth);
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

  async function importRoslynIntoCurrentGraph(source, parseResult, options = {}) {
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
        prefix: `${options.prefix || "csharp14-roslyn-import"}-${stableHash(source)}-semantic-${attempt}`,
        disableCatalogNodes: true
      });
    }
    if (!fragment.ok || !await validateFragment(fragment)) {
      fragment = createRoslynImportFragment(source, parseResult, {
        ...options,
        prefix: `${options.prefix || "csharp14-roslyn-import"}-${stableHash(source)}-exact-${attempt}`,
        semanticOptimization: false
      });
      if (!fragment.ok || !await validateFragment(fragment)) {
        return {
          ok: false,
          diagnostics: ["The imported Node Graph did not reproduce the complete validated C# 14 token and meaningful-trivia stream."],
          nodes: [], connections: []
        };
      }
    }
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

    commit.addEventListener("click", async () => {
      if (!pendingImport || !acknowledgement.checked) return;
      try {
        const result = await importRoslynIntoCurrentGraph(pendingImport.source, pendingImport.parseResult, {
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
    roslynStructuralSignature,
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
