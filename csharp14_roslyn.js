(() => {
  "use strict";

  const ASSEMBLY = "RmlCSharp14ParserWasm";
  const LANGUAGE_VERSION = "14.0";
  const MODULE_URL = "./_framework/dotnet.js";
  let runtimePromise = null;

  function parseJson(value, label) {
    try {
      return JSON.parse(String(value));
    } catch (error) {
      throw new Error(`${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function startRuntime() {
    const runtimeModule = await import(MODULE_URL);
    if (!runtimeModule?.dotnet?.create) {
      throw new Error("The bundled .NET 10 browser runtime is incomplete.");
    }
    const runtime = await runtimeModule.dotnet
      .withApplicationArguments("--rml-csharp14-parser")
      .create();
    const config = runtime.getConfig();
    if (config?.mainAssemblyName !== ASSEMBLY) {
      throw new Error(`Unexpected Roslyn parser assembly '${config?.mainAssemblyName || "unknown"}'.`);
    }
    const exports = await runtime.getAssemblyExports(config.mainAssemblyName);
    const bridge = exports?.RmlCSharp14ParserWasm?.CSharp14ParserBridge;
    if (!bridge?.ParseCSharp14Export || !bridge?.ValidateCSharp14Export || !bridge?.GetCSharp14SyntaxKindsExport) {
      throw new Error("The bundled Roslyn C# 14 bridge exports are missing.");
    }
    const syntaxKinds = parseJson(bridge.GetCSharp14SyntaxKindsExport(), "Roslyn SyntaxKind catalog");
    if (!Array.isArray(syntaxKinds) || syntaxKinds.length < 500) {
      throw new Error(`The Roslyn SyntaxKind catalog is incomplete (${syntaxKinds?.length || 0}).`);
    }
    return Object.freeze({ runtime, bridge, syntaxKinds: Object.freeze(syntaxKinds) });
  }

  function ensureReady() {
    if (!runtimePromise) {
      runtimePromise = startRuntime().catch(error => {
        runtimePromise = null;
        throw error;
      });
    }
    return runtimePromise;
  }

  async function parse(source) {
    const { bridge } = await ensureReady();
    const result = parseJson(bridge.ParseCSharp14Export(String(source ?? "")), "Roslyn C# 14 parser");
    if (!result || result.languageVersion !== LANGUAGE_VERSION || !result.root) {
      throw new Error("The bundled parser did not return the fixed C# 14 AST contract.");
    }
    return result;
  }

  async function validate(source) {
    const { bridge } = await ensureReady();
    const result = parseJson(bridge.ValidateCSharp14Export(String(source ?? "")), "Roslyn C# 14 validator");
    if (!result || result.languageVersion !== LANGUAGE_VERSION || !Array.isArray(result.diagnostics)) {
      throw new Error("The bundled validator did not return the fixed C# 14 diagnostic contract.");
    }
    return result;
  }

  async function getSyntaxKinds() {
    const { syntaxKinds } = await ensureReady();
    return [...syntaxKinds];
  }

  Object.defineProperty(window, "RMLCSharp14Roslyn", {
    value: Object.freeze({
      version: 3,
      languageVersion: LANGUAGE_VERSION,
      assembly: ASSEMBLY,
      runtime: "bundled-dotnet10-browser-wasm",
      ensureReady,
      parse,
      validate,
      getSyntaxKinds
    }),
    configurable: true,
    enumerable: true
  });
})();
