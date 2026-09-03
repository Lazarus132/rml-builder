(() => {
  "use strict";

  const VERSION = 2;
  const LANGUAGE_VERSION = "14.0";
  const validationCache = new Map();
  let validationSequence = 0;
  let activeValidation = null;
  let state = Object.freeze({
    phase: "idle",
    fingerprint: "",
    diagnostics: Object.freeze([]),
    fileCount: 0
  });

  function sourceFiles(files) {
    return (Array.isArray(files) ? files : [])
      .filter(file =>
        file &&
        /\.cs$/i.test(String(file.name || file.relativePath || ""))
      )
      .map((file, index) => Object.freeze({
        name: String(
          file.name ||
          file.relativePath ||
          `Generated-${index + 1}.cs`
        ),
        content: String(file.content || "")
      }));
  }

  function mixHash(hash, value, multiplier) {
    let result = hash >>> 0;
    const text = String(value || "");
    for (let index = 0; index < text.length; index += 1) {
      result ^= text.charCodeAt(index);
      result = Math.imul(result, multiplier) >>> 0;
    }
    return result;
  }

  function fingerprint(files) {
    const sources = sourceFiles(files);
    let first = 2166136261;
    let second = 2246822507;
    let size = 0;
    for (const file of sources) {
      first = mixHash(first, file.name, 16777619);
      first = mixHash(first, "\u0000", 16777619);
      first = mixHash(first, file.content, 16777619);
      second = mixHash(second, file.content, 3266489909);
      second = mixHash(second, file.name, 3266489909);
      size += file.name.length + file.content.length;
    }
    return `csharp14-v2-${sources.length.toString(36)}-${size.toString(36)}-${first.toString(16).padStart(8, "0")}${second.toString(16).padStart(8, "0")}`;
  }

  function freezeDiagnostics(diagnostics) {
    return Object.freeze(
      (Array.isArray(diagnostics) ? diagnostics : [])
        .map(diagnostic => Object.freeze({
          fileName: String(diagnostic?.fileName || "Generated.cs"),
          id: String(diagnostic?.id || "C#14"),
          message: String(diagnostic?.message || "Invalid C# 14 syntax."),
          startLine: Number(diagnostic?.startLine) || 0,
          startColumn: Number(diagnostic?.startColumn) || 0,
          endLine: Number(diagnostic?.endLine) || 0,
          endColumn: Number(diagnostic?.endColumn) || 0
        }))
    );
  }

  function resultState(phase, sourceFingerprint, diagnostics, fileCount) {
    return Object.freeze({
      phase,
      fingerprint: sourceFingerprint,
      diagnostics: freezeDiagnostics(diagnostics),
      fileCount: Math.max(0, Number(fileCount) || 0)
    });
  }

  function publish(nextState) {
    state = nextState;
    document.dispatchEvent(
      new CustomEvent("rml-compile:state-changed", {
        detail: state
      })
    );
    return state;
  }

  function remember(result) {
    validationCache.set(result.fingerprint, result);
    while (validationCache.size > 12) {
      validationCache.delete(validationCache.keys().next().value);
    }
    return result;
  }

  function waitForBackgroundTurn() {
    if (typeof globalThis.scheduler?.postTask === "function") {
      return globalThis.scheduler.postTask(
        () => undefined,
        { priority: "background" }
      );
    }
    return new Promise(resolve => window.setTimeout(resolve, 0));
  }

  function diagnosticText(diagnostic) {
    const line = Number(diagnostic?.startLine) || 0;
    const column = Number(diagnostic?.startColumn) || 0;
    const location = line > 0
      ? ` at line ${line}, column ${Math.max(1, column)}`
      : "";
    return `${diagnostic?.fileName || "Generated.cs"}: ${diagnostic?.id || "C#14"}${location}: ${diagnostic?.message || "Invalid C# 14 syntax."}`;
  }

  function inspect(files) {
    const sourceFingerprint = fingerprint(files);
    return validationCache.get(sourceFingerprint) ||
      (
        state.fingerprint === sourceFingerprint
          ? state
          : resultState(
              "idle",
              sourceFingerprint,
              [],
              sourceFiles(files).length
            )
      );
  }

  async function validate(files) {
    const sources = sourceFiles(files);
    const sourceFingerprint = fingerprint(sources);
    const cached = validationCache.get(sourceFingerprint);
    if (cached) {
      if (state.fingerprint !== sourceFingerprint || state.phase !== cached.phase) {
        publish(cached);
      }
      return cached;
    }
    if (activeValidation?.fingerprint === sourceFingerprint) {
      return activeValidation.promise;
    }

    const sequence = ++validationSequence;
    publish(resultState("checking", sourceFingerprint, [], sources.length));
    const promise = (async () => {
      if (sources.length === 0) {
        return remember(resultState(
          "error",
          sourceFingerprint,
          [{
            fileName: "Generated.cs",
            id: "RMLC0002",
            message: "No generated C# source file is available for validation."
          }],
          0
        ));
      }

      const parser = window.RMLCSharp14Roslyn;
      if (
        typeof parser?.validate !== "function" ||
        parser.languageVersion !== LANGUAGE_VERSION
      ) {
        return remember(resultState(
          "error",
          sourceFingerprint,
          [{
            fileName: "Generated.cs",
            id: "RMLC0001",
            message: "The bundled local Roslyn C# 14 validator is unavailable."
          }],
          sources.length
        ));
      }

      const diagnostics = [];
      try {
        await waitForBackgroundTurn();
        await parser.ensureReady?.();
        for (const file of sources) {
          await waitForBackgroundTurn();
          const result = await parser.validate(file.content);
          if (result?.ok === true) continue;
          const entries = Array.isArray(result?.diagnostics)
            ? result.diagnostics
            : [];
          if (entries.length === 0) {
            diagnostics.push({
              fileName: file.name,
              id: "C#14",
              message: "Roslyn rejected this generated source file."
            });
            continue;
          }
          for (const diagnostic of entries) {
            diagnostics.push({
              fileName: file.name,
              ...diagnostic
            });
          }
        }
      } catch (error) {
        diagnostics.push({
          fileName: "Generated.cs",
          id: "RMLC0003",
          message: `Roslyn validation failed: ${error instanceof Error ? error.message : String(error)}`
        });
      }

      return remember(resultState(
        diagnostics.length > 0 ? "error" : "ready",
        sourceFingerprint,
        diagnostics,
        sources.length
      ));
    })();

    activeValidation = {
      fingerprint: sourceFingerprint,
      sequence,
      promise
    };

    const result = await promise;
    if (
      activeValidation?.sequence === sequence
    ) {
      activeValidation = null;
    }
    if (
      sequence === validationSequence &&
      state.fingerprint === sourceFingerprint
    ) {
      publish(result);
    }
    return result;
  }

  function binaryCompilerBackend() {
    const candidates = [
      window.RMLCSharpBinaryCompiler,
      window.RMLCSharp14Roslyn
    ];
    return candidates.find(candidate =>
      candidate &&
      typeof candidate.compile === "function" &&
      candidate.compile !== compile
    ) || null;
  }

  function capabilities() {
    const backend = binaryCompilerBackend();
    return Object.freeze({
      syntaxValidation: Boolean(
        window.RMLCSharp14Roslyn?.validate
      ),
      binaryCompilation: Boolean(backend),
      requiresTargetReferences: true,
      backend:
        String(backend?.name || backend?.assembly || "")
    });
  }

  async function compile(files, options = {}) {
    const projects = Array.isArray(options.projects)
      ? options.projects
      : [{
          id: "main-mod",
          label: String(options.assemblyName || "Generated project"),
          assemblyName: String(options.assemblyName || "GeneratedMod"),
          sources: sourceFiles(files)
        }];
    const validationFiles = projects.flatMap(project =>
      sourceFiles(project?.sources)
    );
    const validation = await validate(validationFiles);
    if (validation.phase !== "ready") {
      return Object.freeze({
        ok: false,
        unavailable: false,
        diagnostics: validation.diagnostics,
        outputs: Object.freeze([])
      });
    }
    const backend = binaryCompilerBackend();
    if (!backend) {
      return Object.freeze({
        ok: false,
        unavailable: true,
        diagnostics: freezeDiagnostics([{
          fileName: "Generated.cs",
          id: "RMLC1000",
          message: "Binary compilation is unavailable because no browser compiler backend with the exact target reference assemblies is installed."
        }]),
        outputs: Object.freeze([])
      });
    }
    return backend.compile(projects, options);
  }

  function invalidate() {
    validationSequence += 1;
    activeValidation = null;
    publish(resultState("idle", "", [], 0));
  }

  const api = Object.freeze({
    version: VERSION,
    languageVersion: LANGUAGE_VERSION,
    fingerprint,
    inspect,
    validate,
    compile,
    capabilities,
    diagnosticText,
    getState() {
      return state;
    },
    invalidate
  });

  Object.defineProperty(window, "RMLCompile", {
    value: api,
    writable: false,
    enumerable: true,
    configurable: true
  });
})();
