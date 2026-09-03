(() => {
  "use strict";

  const ASSEMBLY = "RmlCSharp14ParserWasm";
  const LANGUAGE_VERSION = "14.0";
  const MODULE_URL = new URL(
    "../../runtime/compiler-v730/dotnet.js",
    self.location.href
  ).href;
  const REFERENCE_PACK_URL = new URL(
    "../../assets/compiler/compiler_references-v730.pack",
    self.location.href
  ).href;
  const REFERENCE_PACK_MAGIC = "RMLREFS1";
  let runtimePromise = null;
  let referencePackPromise = null;
  let syntaxKindsPromise = null;
  let configuredReferenceFingerprint = "";
  let configuredReferences = Object.freeze([]);

  function parseJson(value, label) {
    try {
      return JSON.parse(String(value));
    } catch (error) {
      throw new Error(
        `${label} returned invalid JSON: ${
          error instanceof Error
            ? error.message
            : String(error)
        }`
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
      cache: "no-cache",
      credentials: "same-origin"
    };
    if (integrity) {
      options.integrity = integrity;
    }

    return fetch(defaultUri, options).then(
      response => {
        if (
          !response.ok ||
          /^application\/wasm(?:;|$)/i.test(
            response.headers.get(
              "content-type"
            ) || ""
          )
        ) {
          return response;
        }

        const headers = new Headers(
          response.headers
        );
        headers.set(
          "content-type",
          "application/wasm"
        );
        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers
        });
      }
    );
  }

  async function startRuntime() {
    const runtimeModule =
      await import(MODULE_URL);
    if (!runtimeModule?.dotnet?.create) {
      throw new Error(
        "The bundled .NET 9 compiler-host runtime is incomplete."
      );
    }

    const runtime = await runtimeModule.dotnet
      .withResourceLoader(
        loadRuntimeResource
      )
      .withApplicationArguments(
        "--rml-csharp14-compiler"
      )
      .create();
    const config = runtime.getConfig();
    const mainAssemblyName = String(
      config?.mainAssemblyName || ""
    ).replace(/\.dll$/i, "");
    if (mainAssemblyName !== ASSEMBLY) {
      throw new Error(
        `Unexpected Roslyn compiler assembly '${
          config?.mainAssemblyName || "unknown"
        }'.`
      );
    }

    const exports =
      await runtime.getAssemblyExports(
        mainAssemblyName
      );
    const namespace =
      exports?.RmlCSharp14ParserWasm;
    const parser =
      namespace?.CSharp14ParserBridge;
    const compiler =
      namespace?.BrowserCompilerBridge;
    if (
      !parser?.ParseCSharp14Export ||
      !parser?.ValidateCSharp14Export ||
      !parser?.GetCSharp14SyntaxKindsExport
    ) {
      throw new Error(
        "The bundled Roslyn C# 14 parser exports are missing."
      );
    }
    if (
      !compiler?.AddCompilerReferenceExport ||
      !compiler?.ClearCompilerReferencesExport ||
      !compiler?.CompileCSharp14ProjectExport ||
      !compiler?.TakeCompilerOutputExport ||
      !compiler?.ReleaseCompilerOutputExport
    ) {
      throw new Error(
        "The bundled Roslyn C# 14 compiler exports are missing."
      );
    }

    return Object.freeze({
      runtime,
      parser,
      compiler
    });
  }

  function ensureReady() {
    if (!runtimePromise) {
      runtimePromise = startRuntime()
        .catch(error => {
          runtimePromise = null;
          throw error;
        });
    }
    return runtimePromise;
  }

  async function parse(source) {
    const { parser } = await ensureReady();
    const result = parseJson(
      parser.ParseCSharp14Export(
        String(source ?? "")
      ),
      "Roslyn C# 14 parser"
    );
    if (
      !result ||
      result.languageVersion !==
        LANGUAGE_VERSION ||
      !result.root
    ) {
      throw new Error(
        "The bundled parser did not return the fixed C# 14 AST contract."
      );
    }
    return result;
  }

  async function validate(source) {
    const { parser } = await ensureReady();
    const result = parseJson(
      parser.ValidateCSharp14Export(
        String(source ?? "")
      ),
      "Roslyn C# 14 validator"
    );
    if (
      !result ||
      result.languageVersion !==
        LANGUAGE_VERSION ||
      !Array.isArray(result.diagnostics)
    ) {
      throw new Error(
        "The bundled validator did not return the fixed C# 14 diagnostic contract."
      );
    }
    return result;
  }

  async function getSyntaxKinds() {
    if (!syntaxKindsPromise) {
      syntaxKindsPromise = (async () => {
        const { parser } =
          await ensureReady();
        const syntaxKinds = parseJson(
          parser.GetCSharp14SyntaxKindsExport(),
          "Roslyn SyntaxKind catalog"
        );
        if (
          !Array.isArray(syntaxKinds) ||
          syntaxKinds.length < 500
        ) {
          throw new Error(
            `The Roslyn SyntaxKind catalog is incomplete (${
              syntaxKinds?.length || 0
            }).`
          );
        }
        return Object.freeze(syntaxKinds);
      })().catch(error => {
        syntaxKindsPromise = null;
        throw error;
      });
    }
    return [...await syntaxKindsPromise];
  }

  async function loadReferencePack() {
    if (!referencePackPromise) {
      referencePackPromise = (async () => {
        const response = await fetch(
          REFERENCE_PACK_URL,
          {
            cache: "force-cache",
            credentials: "same-origin"
          }
        );
        if (!response.ok) {
          throw new Error(
            `The bundled .NET 10 target reference pack could not be loaded (${response.status}).`
          );
        }

        const bytes = new Uint8Array(
          await response.arrayBuffer()
        );
        if (bytes.length < 12) {
          throw new Error(
            "The bundled .NET 10 target reference pack is truncated."
          );
        }
        const magic = new TextDecoder(
          "ascii"
        ).decode(bytes.subarray(0, 8));
        if (magic !== REFERENCE_PACK_MAGIC) {
          throw new Error(
            "The bundled .NET 10 target reference pack has an invalid header."
          );
        }

        const view = new DataView(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength
        );
        const manifestLength =
          view.getUint32(8, true);
        const contentOffset =
          12 + manifestLength;
        if (contentOffset > bytes.length) {
          throw new Error(
            "The bundled .NET 10 target reference manifest is truncated."
          );
        }
        const manifest = JSON.parse(
          new TextDecoder().decode(
            bytes.subarray(
              12,
              contentOffset
            )
          )
        );
        if (!Array.isArray(manifest)) {
          throw new Error(
            "The bundled .NET 10 target reference manifest is invalid."
          );
        }

        return Object.freeze({
          bytes,
          contentOffset,
          manifest: Object.freeze(
            manifest.map(entry =>
              Object.freeze({
                name: String(
                  entry?.name || ""
                ),
                offset:
                  Number(entry?.offset) || 0,
                length:
                  Number(entry?.length) || 0
              })
            )
          )
        });
      })().catch(error => {
        referencePackPromise = null;
        throw error;
      });
    }
    return referencePackPromise;
  }

  function referenceFileFingerprint(
    files
  ) {
    return (Array.isArray(files)
      ? files
      : [])
      .map(file => [
        String(file?.name || ""),
        Number(file?.size) ||
          Number(file?.image?.byteLength) ||
          0,
        Number(file?.lastModified) || 0,
        String(
          file?.webkitRelativePath || ""
        )
      ].join(":"))
      .sort()
      .join("|");
  }

  async function fileBytes(file) {
    if (file?.image instanceof Uint8Array) {
      return file.image;
    }
    if (file?.image instanceof ArrayBuffer) {
      return new Uint8Array(file.image);
    }
    if (
      typeof file?.arrayBuffer ===
      "function"
    ) {
      return new Uint8Array(
        await file.arrayBuffer()
      );
    }
    throw new Error(
      `Reference '${file?.name || "unknown"}' cannot be read.`
    );
  }

  function yieldToBrowser() {
    if (
      typeof globalThis.scheduler?.postTask ===
      "function"
    ) {
      return globalThis.scheduler.postTask(
        () => undefined,
        { priority: "background" }
      );
    }
    return new Promise(resolve => {
      globalThis.setTimeout(resolve, 0);
    });
  }

  async function configureReferences(
    files,
    onProgress
  ) {
    const external = (Array.isArray(files)
      ? files
      : [])
      .filter(file =>
        file &&
        /\.dll$/i.test(
          String(file.name || "")
        )
      );
    const fingerprint =
      referenceFileFingerprint(external);
    if (
      configuredReferenceFingerprint ===
        fingerprint &&
      configuredReferences.length > 0
    ) {
      return configuredReferences;
    }

    const { compiler } =
      await ensureReady();
    const pack = await loadReferencePack();
    parseJson(
      compiler.ClearCompilerReferencesExport(),
      "Roslyn reference reset"
    );
    const loaded = [];
    const total =
      pack.manifest.length +
      external.length;
    let completed = 0;

    const finishReference = (
      name,
      skipped = false
    ) => {
      completed += 1;
      onProgress?.({
        phase: "references",
        completed,
        total,
        name,
        skipped
      });
    };
    const add = (
      name,
      image,
      source,
      allowInvalid = false
    ) => {
      const result = parseJson(
        compiler.AddCompilerReferenceExport(
          name,
          image
        ),
        `Roslyn reference '${name}'`
      );
      if (result?.ok !== true) {
        if (allowInvalid) {
          finishReference(name, true);
          return false;
        }
        throw new Error(
          `${name}: ${
            result?.error ||
            "Roslyn rejected this reference assembly."
          }`
        );
      }
      loaded.push(Object.freeze({
        ...result,
        source
      }));
      finishReference(name);
      return true;
    };

    for (const entry of pack.manifest) {
      const start =
        pack.contentOffset +
        entry.offset;
      const end = start + entry.length;
      if (
        !entry.name ||
        entry.length <= 0 ||
        start < pack.contentOffset ||
        end > pack.bytes.length
      ) {
        throw new Error(
          "The bundled .NET 10 target reference pack contains an invalid entry."
        );
      }
      add(
        entry.name,
        pack.bytes.subarray(start, end),
        "bundled-net10"
      );
      if (completed % 8 === 0) {
        await yieldToBrowser();
      }
    }

    const bundledNames = new Set(
      pack.manifest.map(entry =>
        entry.name.toLowerCase()
      )
    );
    for (const file of external) {
      const name = String(
        file.name || "Reference.dll"
      );
      if (
        bundledNames.has(
          name.toLowerCase()
        )
      ) {
        finishReference(name, true);
        if (completed % 4 === 0) {
          await yieldToBrowser();
        }
        continue;
      }
      add(
        name,
        await fileBytes(file),
        "selected",
        true
      );
      if (completed % 4 === 0) {
        await yieldToBrowser();
      }
    }

    configuredReferenceFingerprint =
      fingerprint;
    configuredReferences =
      Object.freeze(loaded);
    return configuredReferences;
  }

  function normalizeDiagnostics(
    diagnostics,
    project
  ) {
    return Object.freeze(
      (Array.isArray(diagnostics)
        ? diagnostics
        : [])
        .map(diagnostic =>
          Object.freeze({
            projectId:
              String(project?.id || ""),
            projectLabel:
              String(
                project?.label ||
                project?.assemblyName ||
                "Generated project"
              ),
            fileName:
              String(
                diagnostic?.fileName ||
                "Generated.cs"
              ),
            id:
              String(
                diagnostic?.id ||
                "RMLC2000"
              ),
            severity:
              String(
                diagnostic?.severity ||
                "Error"
              ),
            message:
              String(
                diagnostic?.message ||
                "C# compilation failed."
              ),
            startLine:
              Number(
                diagnostic?.startLine
              ) || 0,
            startColumn:
              Number(
                diagnostic?.startColumn
              ) || 0,
            endLine:
              Number(
                diagnostic?.endLine
              ) || 0,
            endColumn:
              Number(
                diagnostic?.endColumn
              ) || 0
          })
        )
    );
  }

  async function compile(
    projects,
    options = {}
  ) {
    const items = Array.isArray(projects)
      ? projects
      : [];
    if (items.length === 0) {
      return Object.freeze({
        ok: false,
        diagnostics: Object.freeze([]),
        outputs: Object.freeze([]),
        error:
          "No generated project is available for compilation."
      });
    }

    const { compiler } =
      await ensureReady();
    await configureReferences(
      options.referenceFiles,
      options.onProgress
    );
    const outputs = [];
    const diagnostics = [];

    for (
      let index = 0;
      index < items.length;
      index += 1
    ) {
      const project = items[index];
      options.onProgress?.({
        phase: "compile",
        completed: index,
        total: items.length,
        name:
          String(
            project?.label ||
            project?.assemblyName ||
            "Generated project"
          )
      });
      await yieldToBrowser();
      const request = {
        assemblyName:
          String(
            project?.assemblyName ||
            `Generated-${index + 1}`
          ),
        sources:
          (Array.isArray(project?.sources)
            ? project.sources
            : [])
            .map((source, sourceIndex) => ({
              name:
                String(
                  source?.name ||
                  `Generated-${sourceIndex + 1}.cs`
                ),
              content:
                String(
                  source?.content || ""
                )
            })),
        allowUnsafe:
          project?.allowUnsafe === true,
        checkOverflow:
          project?.checkOverflow === true,
        deterministic:
          project?.deterministic !== false,
        emitPdb:
          options.emitPdb === true,
        implicitUsings:
          project?.implicitUsings !== false,
        nullable:
          project?.nullable !== false,
        optimize:
          project?.optimize !== false
      };
      const result = parseJson(
        compiler.CompileCSharp14ProjectExport(
          JSON.stringify(request)
        ),
        `Roslyn compilation '${request.assemblyName}'`
      );
      const projectDiagnostics =
        normalizeDiagnostics(
          result?.diagnostics,
          project
        );
      diagnostics.push(
        ...projectDiagnostics
      );
      if (
        result?.ok !== true ||
        !result.outputId
      ) {
        if (result?.error) {
          diagnostics.push(
            Object.freeze({
              projectId:
                String(project?.id || ""),
              projectLabel:
                String(
                  project?.label ||
                  request.assemblyName
                ),
              fileName: "Generated.cs",
              id: "RMLC2001",
              severity: "Error",
              message:
                String(result.error),
              startLine: 0,
              startColumn: 0,
              endLine: 0,
              endColumn: 0
            })
          );
        }
        return Object.freeze({
          ok: false,
          diagnostics:
            Object.freeze(diagnostics),
          outputs: Object.freeze(outputs),
          error:
            String(
              result?.error ||
              "Roslyn compilation failed."
            )
        });
      }

      try {
        const peImage = new Uint8Array(
          compiler.TakeCompilerOutputExport(
            `${result.outputId}|pe`
          )
        );
        const pdbImage = options.emitPdb === true
          ? new Uint8Array(
              compiler.TakeCompilerOutputExport(
                `${result.outputId}|pdb`
              )
            )
          : new Uint8Array();
        if (
          peImage.length < 2 ||
          peImage[0] !== 0x4d ||
          peImage[1] !== 0x5a
        ) {
          throw new Error(
            "Roslyn returned an invalid PE image."
          );
        }
        outputs.push(Object.freeze({
          projectId:
            String(project?.id || ""),
          assemblyName:
            String(
              result.assemblyName ||
              request.assemblyName
            ),
          peImage,
          pdbImage
        }));
      } finally {
        compiler.ReleaseCompilerOutputExport(
          String(result.outputId)
        );
      }

      options.onProgress?.({
        phase: "compile",
        completed: index + 1,
        total: items.length,
        name: request.assemblyName
      });
    }

    return Object.freeze({
      ok: true,
      diagnostics:
        Object.freeze(diagnostics),
      outputs: Object.freeze(outputs),
      references: configuredReferences
    });
  }

  async function resetCompilerReferences() {
    configuredReferenceFingerprint = "";
    configuredReferences = Object.freeze([]);
    if (runtimePromise) {
      const { compiler } =
        await ensureReady();
      parseJson(
        compiler.ClearCompilerReferencesExport(),
        "Roslyn reference reset"
      );
    }
  }

  Object.defineProperty(
    window,
    "RMLCSharp14Roslyn",
    {
      value: Object.freeze({
        version: 9,
        name: "Roslyn C# 14 browser compiler (.NET 9 host, .NET 10 target)",
        languageVersion:
          LANGUAGE_VERSION,
        assembly: ASSEMBLY,
        runtime:
          "bundled-dotnet9-browser-wasm-worker-runtime-net10-target",
        ensureReady,
        parse,
        validate,
        getSyntaxKinds,
        compile,
        configureReferences,
        resetCompilerReferences,
        capabilities: Object.freeze({
          syntaxValidation: true,
          binaryCompilation: true,
          portablePdb: false,
          offline: true,
          targetFramework: "net10.0"
        })
      }),
      configurable: true,
      enumerable: true
    }
  );
})();
