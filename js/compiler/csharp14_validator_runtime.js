(() => {
  "use strict";

  const ASSEMBLY = "RmlCSharp14ParserWasm";
  const LANGUAGE_VERSION = "14.0";
  const MODULE_URL = new URL(
    "../../runtime/validator-v730/dotnet.js",
    self.location.href
  ).href;
  let runtimePromise = null;
  let syntaxKindsPromise = null;

  function parseJson(value, label) {
    try {
      return JSON.parse(String(value));
    } catch (error) {
      throw new Error(
        `${label} returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  function loadRuntimeResource(
    type,
    _name,
    defaultUri,
    integrity
  ) {
    if (
      type !== "dotnetwasm" ||
      typeof window === "undefined" ||
      String(defaultUri).startsWith("file:")
    ) {
      return defaultUri;
    }

    const options = {
      cache: "force-cache",
      credentials: "same-origin"
    };
    if (integrity) options.integrity = integrity;
    return fetch(defaultUri, options).then(response => {
      if (
        !response.ok ||
        /^application\/wasm(?:;|$)/i.test(
          response.headers.get("content-type") || ""
        )
      ) {
        return response;
      }
      const headers = new Headers(response.headers);
      headers.set("content-type", "application/wasm");
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers
      });
    });
  }

  async function startRuntime() {
    const runtimeModule = await import(MODULE_URL);
    if (!runtimeModule?.dotnet?.create) {
      throw new Error(
        "The bundled .NET 9 C# validator-host runtime is incomplete."
      );
    }

    const runtime = await runtimeModule.dotnet
      .withResourceLoader(loadRuntimeResource)
      .withApplicationArguments("--rml-csharp14-validator")
      .create();
    const config = runtime.getConfig();
    const mainAssemblyName = String(
      config?.mainAssemblyName || ""
    ).replace(/\.dll$/i, "");
    if (mainAssemblyName !== ASSEMBLY) {
      throw new Error(
        `Unexpected C# validator assembly '${config?.mainAssemblyName || "unknown"}'.`
      );
    }

    const exports = await runtime.getAssemblyExports(
      mainAssemblyName
    );
    const parser =
      exports?.RmlCSharp14ParserWasm
        ?.CSharp14ParserBridge;
    if (
      !parser?.ParseCSharp14Export ||
      !parser?.ValidateCSharp14Export ||
      !parser?.GetCSharp14SyntaxKindsExport
    ) {
      throw new Error(
        "The bundled Roslyn C# 14 validator exports are missing."
      );
    }
    return Object.freeze({ runtime, parser });
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
    const { parser } = await ensureReady();
    const result = parseJson(
      parser.ParseCSharp14Export(String(source ?? "")),
      "Roslyn C# 14 parser"
    );
    if (
      !result ||
      result.languageVersion !== LANGUAGE_VERSION ||
      !result.root
    ) {
      throw new Error(
        "The bundled parser returned an invalid C# 14 AST contract."
      );
    }
    return result;
  }

  async function validate(source) {
    const { parser } = await ensureReady();
    const result = parseJson(
      parser.ValidateCSharp14Export(String(source ?? "")),
      "Roslyn C# 14 validator"
    );
    if (
      !result ||
      result.languageVersion !== LANGUAGE_VERSION ||
      !Array.isArray(result.diagnostics)
    ) {
      throw new Error(
        "The bundled validator returned an invalid C# 14 diagnostic contract."
      );
    }
    return result;
  }

  async function getSyntaxKinds() {
    if (!syntaxKindsPromise) {
      syntaxKindsPromise = (async () => {
        const { parser } = await ensureReady();
        const result = parseJson(
          parser.GetCSharp14SyntaxKindsExport(),
          "Roslyn SyntaxKind catalog"
        );
        if (!Array.isArray(result) || result.length < 500) {
          throw new Error(
            `The Roslyn SyntaxKind catalog is incomplete (${result?.length || 0}).`
          );
        }
        return Object.freeze(result);
      })().catch(error => {
        syntaxKindsPromise = null;
        throw error;
      });
    }
    return [...await syntaxKindsPromise];
  }

  Object.defineProperty(
    window,
    "RMLCSharp14ValidatorRuntime",
    {
      value: Object.freeze({
        languageVersion: LANGUAGE_VERSION,
        assembly: ASSEMBLY,
        ensureReady,
        parse,
        validate,
        getSyntaxKinds
      }),
      configurable: true,
      enumerable: true
    }
  );
})();
