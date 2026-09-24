(() => {
  "use strict";

  const VERSION = 3;
  const LANGUAGE_VERSION = "14.0";
  const validationCache = new Map();
  let validationSequence = 0;
  let activeValidation = null;
  let stateSources = Object.freeze([]);
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
          message: String(diagnostic?.message || window.RMLI18n.t("ui.auto.5d693dcc2c35")),
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

  function frozenSources(sources) {
    return Object.freeze(
      (Array.isArray(sources) ? sources : [])
        .map(file => Object.freeze({
          name: String(file?.name || ""),
          content: String(file?.content || "")
        }))
    );
  }

  function publish(nextState, sources = []) {
    state = nextState;
    stateSources = frozenSources(sources);
    document.dispatchEvent(
      new CustomEvent("rml-compile:state-changed", {
        detail: state
      })
    );
    return state;
  }

  function sameSources(left, right) {
    if (
      !Array.isArray(left) ||
      !Array.isArray(right) ||
      left.length !== right.length
    ) {
      return false;
    }
    return left.every((file, index) =>
      file.name === right[index]?.name &&
      file.content === right[index]?.content
    );
  }

  function cachedValidation(
    sourceFingerprint,
    sources
  ) {
    const entry =
      validationCache.get(
        sourceFingerprint
      );
    return entry &&
      sameSources(entry.sources, sources)
        ? entry.result
        : null;
  }

  function remember(result, sources) {
    validationCache.set(
      result.fingerprint,
      Object.freeze({
        result,
        sources: Object.freeze(
          sources.map(file =>
            Object.freeze({
              name: file.name,
              content: file.content
            })
          )
        )
      })
    );
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
    return new Promise(resolve => {
      window.RMLScheduleTask(resolve);
    });
  }

  function diagnosticText(diagnostic) {
    const line = Number(diagnostic?.startLine) || 0;
    const column = Number(diagnostic?.startColumn) || 0;
    const location = line > 0
      ? ` at line ${line}, column ${Math.max(1, column)}`
      : "";
    return `${diagnostic?.fileName || "Generated.cs"}: ${diagnostic?.id || "C#14"}${location}: ${diagnostic?.message || window.RMLI18n.t("ui.auto.5d693dcc2c35")}`;
  }

  function inspect(files) {
    const sources = sourceFiles(files);
    const sourceFingerprint = fingerprint(files);
    return cachedValidation(
      sourceFingerprint,
      sources
    ) ||
      (
        state.fingerprint === sourceFingerprint &&
        sameSources(stateSources, sources)
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
    const cached = cachedValidation(
      sourceFingerprint,
      sources
    );
    if (cached) {
      if (
        state.fingerprint !== sourceFingerprint ||
        state.phase !== cached.phase ||
        !sameSources(stateSources, sources)
      ) {
        publish(cached, sources);
      }
      return cached;
    }
    if (
      activeValidation?.fingerprint ===
        sourceFingerprint &&
      sameSources(
        activeValidation.sources,
        sources
      )
    ) {
      return activeValidation.promise;
    }

    const sequence = ++validationSequence;
    publish(
      resultState("checking", sourceFingerprint, [], sources.length),
      sources
    );
    const promise = (async () => {
      if (sources.length === 0) {
        return remember(resultState(
          "error",
          sourceFingerprint,
          [{
            fileName: "Generated.cs",
            id: "RMLC0002",
            message: window.RMLI18n.t("ui.auto.5a8278a8f51e")
          }],
          0
        ), sources);
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
            message: window.RMLI18n.t("ui.auto.a45f6588210d")
          }],
          sources.length
        ), sources);
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
              message: window.RMLI18n.t("ui.auto.3387d6d59bf1")
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
      ), sources);
    })();

    activeValidation = {
      fingerprint: sourceFingerprint,
      sources,
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
      publish(result, sources);
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

  function compilerCancellation(signal) {
    return signal?.reason || Object.assign(
      new Error("The compiler operation was cancelled."),
      { code: "RML_COMPILER_CANCELLED" }
    );
  }

  function awaitCompilerStep(promise, signal) {
    if (!signal) {
      return Promise.resolve(promise);
    }
    return new Promise((resolve, reject) => {
      const cancelled = () => reject(
        compilerCancellation(signal)
      );
      if (signal.aborted) {
        cancelled();
        return;
      }
      signal.addEventListener(
        "abort",
        cancelled,
        { once: true }
      );
      Promise.resolve(promise)
        .then(resolve, reject)
        .finally(() => signal.removeEventListener(
          "abort",
          cancelled
        ));
    });
  }

  async function compile(files, options = {}) {
    const signal = options.signal || null;
    if (signal?.aborted) {
      throw compilerCancellation(signal);
    }
    const referenceFiles = Array.isArray(
      options.referenceFiles
    )
      ? options.referenceFiles
      : [];
    const referenceIdentities = Array.isArray(
      options.referenceIdentities
    )
      ? options.referenceIdentities
      : [];
    if (
      referenceFiles.length !==
        referenceIdentities.length ||
      referenceFiles.some((file, index) => {
        const identity =
          referenceIdentities[index];
        return !identity ||
          identity.name !==
            String(file?.name || "") ||
          identity.size !==
            (Number(file?.size) || 0) ||
          identity.byteLength !==
            (Number(file?.size) || 0) ||
          identity.lastModified !==
            (Number(file?.lastModified) || 0) ||
          !/^sha256:[a-f0-9]{64}$/i.test(
            String(
              identity.contentIdentity || ""
            )
          );
      })
    ) {
      throw new Error(
        window.RMLI18n.t(
          "export.compiler_references.identity_missing"
        )
      );
    }
    const projects = Array.isArray(options.projects)
      ? options.projects
      : [{
          id: "main-mod",
          label: String(options.assemblyName || window.RMLI18n.t("ui.literal.3ab238d024c9")),
          assemblyName: String(options.assemblyName || "GeneratedMod"),
          sources: sourceFiles(files)
        }];
    const validationFiles = projects.flatMap(project =>
      sourceFiles(project?.sources)
    );
    const validation = await awaitCompilerStep(
      validate(validationFiles),
      signal
    );
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
          message: window.RMLI18n.t("ui.auto.0dc07b388654")
        }]),
        outputs: Object.freeze([])
      });
    }
    return awaitCompilerStep(
      backend.compile(projects, options),
      signal
    );
  }

  function cancelCompilation(reason) {
    return binaryCompilerBackend()
      ?.cancelCompilerOperations?.(
        reason
      ) === true;
  }

  function invalidate() {
    validationSequence += 1;
    activeValidation = null;
    publish(resultState("idle", "", [], 0), []);
  }

  function releaseCaches() {
    validationCache.clear();
    if (!activeValidation) {
      publish(
        resultState("idle", "", [], 0),
        []
      );
    }
    return true;
  }

  const api = Object.freeze({
    version: VERSION,
    languageVersion: LANGUAGE_VERSION,
    fingerprint,
    inspect,
    validate,
    compile,
    cancelCompilation,
    capabilities,
    diagnosticText,
    getState() {
      return state;
    },
    invalidate,
    releaseCaches
  });

  Object.defineProperty(window, "RMLCompile", {
    value: api,
    writable: false,
    enumerable: true,
    configurable: true
  });
})();
