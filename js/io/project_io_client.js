(() => {
  "use strict";

  if (window.RMLProjectIoClient?.version >= 1) {
    return;
  }

  function create({
    baseUrl,
    maximumProjectBytes,
    savedCompositeMaximumBytes,
    postTokenStream
  }) {
    const APP_SCRIPT_BASE_URL =
      baseUrl ||
      document.currentScript?.src ||
      window.location.href;
    const PROJECT_FILE_MAX_BYTES =
      Number(maximumProjectBytes) ||
      512 * 1024 * 1024;
    const SAVED_API_COMPOSITE_IMPORT_MAX_BYTES =
      Number(savedCompositeMaximumBytes) ||
      32 * 1024 * 1024;
    const postGraphCodegenTokenStream =
      postTokenStream;

  let projectIoWorker = null;
  let projectIoWorkerGeneration = 0;
  let projectIoRequestSequence = 1;
  const projectIoPendingRequests = new Map();
  const PROJECT_GZIP_MAGIC_FIRST = 0x1f;
  const PROJECT_GZIP_MAGIC_SECOND = 0x8b;
  let projectGzipFallbackLoadPromise = null;
  
  function projectGzipFallbackCodec() {
    if (
      typeof window.RMLGzipCodec
        ?.compress === "function" &&
      typeof window.RMLGzipCodec
        ?.decompress === "function"
    ) {
      return Promise.resolve(
        window.RMLGzipCodec
      );
    }
    if (projectGzipFallbackLoadPromise) {
      return projectGzipFallbackLoadPromise;
    }
  
    projectGzipFallbackLoadPromise =
      new Promise((resolve, reject) => {
        const script =
          document.createElement("script");
        script.src = new URL(
          "../core/gzip_codec.js?v=1-own-gzip-fallback-v756",
          APP_SCRIPT_BASE_URL
        ).href;
        script.async = true;
        script.dataset.rmlGzipFallback =
          "true";
        script.addEventListener(
          "load",
          () => {
            if (
              typeof window.RMLGzipCodec
                ?.compress !== "function" ||
              typeof window.RMLGzipCodec
                ?.decompress !== "function"
            ) {
              reject(
                new Error(
                  window.RMLI18n.t("ui.literal.23c4cdc55cb1")
                )
              );
              return;
            }
            resolve(window.RMLGzipCodec);
          },
          { once: true }
        );
        script.addEventListener(
          "error",
          () => reject(
            new Error(
              window.RMLI18n.t("ui.literal.6c425c9b9011")
            )
          ),
          { once: true }
        );
        (document.body || document.head)
          .appendChild(script);
      }).catch(error => {
        projectGzipFallbackLoadPromise =
          null;
        throw error;
      });
  
    return projectGzipFallbackLoadPromise;
  }
  
  async function readProjectBlobTextOnMainThread(
    blob,
    maximumBytes = PROJECT_FILE_MAX_BYTES
  ) {
    const header = new Uint8Array(
      await blob.slice(0, 2).arrayBuffer()
    );
    const gzip =
      header.length === 2 &&
      header[0] ===
        PROJECT_GZIP_MAGIC_FIRST &&
      header[1] ===
        PROJECT_GZIP_MAGIC_SECOND;
  
    if (!gzip) {
      if (blob.size > maximumBytes) {
        throw new RangeError(
          window.RMLI18n.t("ui.literal.f49a0b29babe")
        );
      }
      return {
        text: await blob.text(),
        uncompressedBytes: blob.size,
        compression: "identity"
      };
    }
  
    if (
      typeof DecompressionStream !==
        "function"
    ) {
      const codec =
        await projectGzipFallbackCodec();
      const decompressed =
        codec.decompress(
          new Uint8Array(
            await blob.arrayBuffer()
          ),
          maximumBytes
        );
      return {
        text: new TextDecoder(
          "utf-8",
          { fatal: true }
        ).decode(decompressed),
        uncompressedBytes:
          decompressed.byteLength,
        compression: "gzip"
      };
    }
  
    const reader = blob.stream()
      .pipeThrough(
        new DecompressionStream("gzip")
      )
      .getReader();
    const decoder = new TextDecoder(
      "utf-8",
      { fatal: true }
    );
    const parts = [];
    let uncompressedBytes = 0;
  
    try {
      while (true) {
        const { done, value } =
          await reader.read();
        if (done) {
          break;
        }
        uncompressedBytes +=
          value.byteLength;
        if (
          uncompressedBytes >
            maximumBytes
        ) {
          await reader.cancel();
          throw new RangeError(
            window.RMLI18n.t("ui.literal.fafff7553987")
          );
        }
        parts.push(
          decoder.decode(
            value,
            { stream: true }
          )
        );
      }
      parts.push(decoder.decode());
    } catch (error) {
      if (error instanceof RangeError) {
        throw error;
      }
      parts.length = 0;
      try {
        const codec =
          await projectGzipFallbackCodec();
        const decompressed =
          codec.decompress(
            new Uint8Array(
              await blob.arrayBuffer()
            ),
            maximumBytes
          );
        return {
          text: new TextDecoder(
            "utf-8",
            { fatal: true }
          ).decode(decompressed),
          uncompressedBytes:
            decompressed.byteLength,
          compression: "gzip"
        };
      } catch (fallbackError) {
        throw new Error(
          `The GZIP project data is damaged or incomplete. ${String(fallbackError?.message || window.RMLI18n.t("ui.literal.2c40873d3a65"))}`,
          { cause: error }
        );
      }
    } finally {
      reader.releaseLock();
    }
  
    const text = parts.join("");
    parts.length = 0;
    return {
      text,
      uncompressedBytes,
      compression: "gzip"
    };
  }
  
  async function compressProjectJsonOnMainThread(
    value
  ) {
    const text = JSON.stringify(value);
    const source = new Blob(
      [text],
      {
        type:
          "application/json;charset=utf-8"
      }
    );
    if (
      typeof CompressionStream !==
        "function"
    ) {
      const codec =
        await projectGzipFallbackCodec();
      const compressed =
        codec.compress(
          new Uint8Array(
            await source.arrayBuffer()
          )
        );
      return {
        buffer: compressed.buffer,
        jsonBytes: source.size,
        compressedBytes:
          compressed.byteLength,
        compression: "gzip"
      };
    }
  
    const buffer = await new Response(
      source.stream().pipeThrough(
        new CompressionStream("gzip")
      )
    ).arrayBuffer();
  
    return {
      buffer,
      jsonBytes: source.size,
      compressedBytes: buffer.byteLength,
      compression: "gzip"
    };
  }
  
  function projectIoWorkerInstance() {
    if (projectIoWorker) {
      return projectIoWorker;
    }
  
    if (typeof Worker !== "function") {
      return null;
    }
  
    try {
      const worker = new Worker(
        new URL(
          "../workers/project_io_worker.js?v=12-streamed-draft-v758",
          APP_SCRIPT_BASE_URL
        ),
        {
          name: "rml-project-io"
        }
      );
      const workerGeneration =
        ++projectIoWorkerGeneration;
  
      worker.addEventListener(
        "message",
        event => {
          const response = event.data || {};
          const pending =
            projectIoPendingRequests.get(
              response.id
            );
  
          if (
            !pending ||
            pending.worker !== worker ||
            pending.workerGeneration !==
              workerGeneration
          ) {
            return;
          }
  
          if (
            response.ok !== true &&
            pending.streamed === true &&
            response.error?.recoverable ===
              true
          ) {
            const error = new Error(
              response.error?.message ||
              window.RMLI18n.t("ui.literal.49c8cd2697ba")
            );
            error.name =
              response.error?.name ||
              window.RMLI18n.t("ui.auto.c61dcc959d06");
            retireFailedProjectIoWorker(
              worker,
              workerGeneration,
              error
            );
            return;
          }
  
          projectIoPendingRequests.delete(
            response.id
          );
  
          if (response.ok === true) {
            if (
              pending.streamed === true &&
              pending.streamPromise
            ) {
              void pending.streamPromise.then(
                metrics => {
                  completeProjectIoRequest(
                    pending,
                    "resolve",
                    {
                      ...response,
                      streamMetrics:
                        metrics || null
                    }
                  );
                }
              );
            } else {
              completeProjectIoRequest(
                pending,
                "resolve",
                response
              );
            }
          } else {
            const error = new Error(
              response.error?.message ||
              window.RMLI18n.t("ui.literal.fc76cd98d8a4")
            );
            error.name =
              response.error?.name ||
              window.RMLI18n.t("ui.auto.c61dcc959d06");
            completeProjectIoRequest(
              pending,
              "reject",
              error
            );
          }
        }
      );
  
      worker.addEventListener(
        "error",
        event => {
          event.preventDefault?.();
          const error = new Error(
            event.message ||
            event.error?.message ||
            window.RMLI18n.t("ui.literal.fc76cd98d8a4")
          );
          error.name =
            event.error?.name || window.RMLI18n.t("ui.auto.c61dcc959d06");
  
          retireFailedProjectIoWorker(
            worker,
            workerGeneration,
            error
          );
        }
      );
  
      worker.addEventListener(
        "messageerror",
        () => {
          const error = new Error(
            window.RMLI18n.t("ui.literal.c4787c42729a")
          );
          error.name = window.RMLI18n.t("ui.literal.c749561f3732");
          retireFailedProjectIoWorker(
            worker,
            workerGeneration,
            error
          );
        }
      );
  
      projectIoWorker = worker;
      return projectIoWorker;
    } catch (error) {
      console.warn(
        window.RMLI18n.t("ui.literal.72e30aa2c40d"),
        error
      );
      return null;
    }
  }
  
  function completeProjectIoRequest(
    pending,
    completion,
    value
  ) {
    if (pending.settled) {
      return false;
    }
    pending.settled = true;
    pending[completion](value);
    return true;
  }

  function runProjectIoRequestOnMainThread(
    operation,
    payload
  ) {
    return new Promise((resolve, reject) => {
      queueMicrotask(() => {
        void (async () => {
          if (operation === "parse") {
            const text =
              String(payload.text ?? "");
            const value = JSON.parse(text);
            return {
              ok: true,
              value
            };
          }
  
          if (operation === "parseFile") {
            if (
              !payload.file ||
              typeof payload.file.text !==
                "function"
            ) {
              throw new TypeError(
                window.RMLI18n.t("ui.literal.7096289f5f79")
              );
            }
  
            const decoded =
              await readProjectBlobTextOnMainThread(
                payload.file,
                Number(
                  payload.maximumBytes
                ) || PROJECT_FILE_MAX_BYTES
              );
            const value =
              JSON.parse(decoded.text);
            if (
              value &&
              typeof value === "object" &&
              !Array.isArray(value) &&
              !(
                payload.projectFormat &&
                value.format ===
                  payload.projectFormat
              ) &&
              value.schema ===
                payload.savedCompositeSchema &&
              decoded.uncompressedBytes >
                (
                  Number(
                    payload
                      .savedCompositeMaximumBytes
                  ) ||
                  SAVED_API_COMPOSITE_IMPORT_MAX_BYTES
                )
            ) {
              throw new RangeError(
                window.RMLI18n.t("ui.literal.4292dd2d5a90")
              );
            }
            return {
              ok: true,
              value,
              uncompressedBytes:
                decoded.uncompressedBytes,
              compressedBytes:
                payload.file.size,
              compression:
                decoded.compression
            };
          }
  
          if (
            operation ===
              "stringifyGzip" ||
            operation ===
              "streamStringifyGzip"
          ) {
            const result =
              await compressProjectJsonOnMainThread(
                payload.value
              );
            const maximumBytes = Number(
              payload.maximumBytes
            );
            if (
              Number.isFinite(maximumBytes) &&
              maximumBytes > 0 &&
              result.jsonBytes > maximumBytes
            ) {
              throw new RangeError(
                window.RMLI18n.t("ui.literal.39a9ea82588a")
              );
            }
            return {
              ok: true,
              ...result,
              transport:
                operation ===
                  "streamStringifyGzip"
                  ? "main-thread-fallback"
                  : "main-fallback"
            };
          }
  
          if (operation === "stringify") {
            return {
              ok: true,
              text: JSON.stringify(
                payload.value,
                null,
                Number(payload.space) || 0
              )
            };
          }
  
          throw new Error(
            `Unsupported project I/O operation '${operation}'.`
          );
        })().then(resolve, reject);
      });
    });
  }
  
  function dispatchProjectIoRequestOnMainThread(
    pending
  ) {
    pending.worker = null;
    pending.workerGeneration = 0;
    void runProjectIoRequestOnMainThread(
      pending.operation,
      pending.payload
    ).then(
      response => {
        completeProjectIoRequest(
          pending,
          "resolve",
          response
        );
      },
      error => {
        completeProjectIoRequest(
          pending,
          "reject",
          error
        );
      }
    );
  }
  
  function recoverProjectIoRequest(
    pending,
    error,
    {
      preferMainThread = false
    } = {}
  ) {
    if (pending.settled) {
      return;
    }
  
    if (
      typeof pending.isCurrent ===
        "function" &&
      !pending.isCurrent()
    ) {
      const staleError = new Error(
        window.RMLI18n.t("ui.literal.60c57fd74be6")
      );
      staleError.code =
        "RML_PROJECT_DRAFT_STALE";
      completeProjectIoRequest(
        pending,
        "reject",
        staleError
      );
      return;
    }
  
    if (pending.recoveryAttempted) {
  
      dispatchProjectIoRequestOnMainThread(
        pending
      );
      return;
    }
  
    pending.recoveryAttempted = true;
    if (preferMainThread) {
      dispatchProjectIoRequestOnMainThread(
        pending
      );
      return;
    }
  
    dispatchProjectIoRequest(pending);
  }
  
  function retireFailedProjectIoWorker(
    worker,
    workerGeneration,
    error
  ) {
    const ownedRequests = [];
  
    for (const [id, pending] of
      projectIoPendingRequests) {
      if (
        pending.worker !== worker ||
        pending.workerGeneration !==
          workerGeneration
      ) {
        continue;
      }
  
      projectIoPendingRequests.delete(id);
      ownedRequests.push(pending);
    }
  
    worker.terminate();
    if (projectIoWorker === worker) {
      projectIoWorker = null;
    }
  
    for (const pending of ownedRequests) {
      recoverProjectIoRequest(
        pending,
        error
      );
    }
  
    if (ownedRequests.length === 0) {
      scheduleProjectIoWorkerIdleRelease();
    }
  }
  
  function dispatchStreamedProjectIoRequest(
    pending
  ) {
    if (pending.settled) {
      return;
    }
  
    if (
      typeof pending.isCurrent ===
        "function" &&
      !pending.isCurrent()
    ) {
      const error = new Error(
        window.RMLI18n.t("ui.literal.c2e2b63c3ffe")
      );
      error.code =
        "RML_PROJECT_DRAFT_STALE";
      completeProjectIoRequest(
        pending,
        "reject",
        error
      );
      return;
    }
  
    const worker = projectIoWorkerInstance();
    if (!worker) {
      dispatchProjectIoRequestOnMainThread(
        pending
      );
      return;
    }
  
    const id = projectIoRequestSequence++;
    const workerGeneration =
      projectIoWorkerGeneration;
    pending.worker = worker;
    pending.workerGeneration =
      workerGeneration;
    projectIoPendingRequests.set(id, pending);
    const streamIsCurrent = () =>
      !pending.settled &&
      pending.worker === worker &&
      pending.workerGeneration ===
        workerGeneration &&
      projectIoPendingRequests.get(id) ===
        pending &&
      (
        typeof pending.isCurrent !==
          "function" ||
        pending.isCurrent()
      );
  
    pending.streamPromise =
      postGraphCodegenTokenStream(
        worker,
        id,
        "project-draft",
        pending.payload.value,
        {
          isCurrent: streamIsCurrent,
          startFields: {
            maximumBytes:
              pending.payload.maximumBytes
          },
          onProgress: () => {
            if (streamIsCurrent()) {
            }
          }
        }
      ).then(metrics => {
        if (streamIsCurrent()) {
          pending.streamMetrics = metrics;
        }
        return metrics;
      }).catch(error => {
        if (
          projectIoPendingRequests.get(id) !==
            pending ||
          pending.worker !== worker ||
          pending.workerGeneration !==
            workerGeneration
        ) {
          return;
        }
  
        if (
          error?.code ===
            "RML_GRAPH_CODEGEN_STALE" ||
          error instanceof TypeError
        ) {
          projectIoPendingRequests.delete(id);
          try {
            worker.postMessage({
              id,
              operation: "streamCancel"
            });
          } catch {
          }
          if (
            error?.code ===
              "RML_GRAPH_CODEGEN_STALE"
          ) {
            error.code =
              "RML_PROJECT_DRAFT_STALE";
          }
          completeProjectIoRequest(
            pending,
            "reject",
            error
          );
          return;
        }
  
        retireFailedProjectIoWorker(
          worker,
          workerGeneration,
          error
        );
      });
  }
  
  function dispatchProjectIoRequest(pending) {
    if (pending.settled) {
      return;
    }
  
    if (pending.streamed === true) {
      dispatchStreamedProjectIoRequest(
        pending
      );
      return;
    }
  
    const worker =
      projectIoWorkerInstance();
    if (!worker) {
      dispatchProjectIoRequestOnMainThread(
        pending
      );
      return;
    }
  
    const id =
      projectIoRequestSequence++;
    const workerGeneration =
      projectIoWorkerGeneration;
  
    pending.worker = worker;
    pending.workerGeneration =
      workerGeneration;
    projectIoPendingRequests.set(id, pending);
    try {
      worker.postMessage({
        id,
        operation: pending.operation,
        ...pending.payload
      });
    } catch (error) {
      if (
        projectIoPendingRequests.get(id) !==
          pending ||
        pending.worker !== worker ||
        pending.workerGeneration !==
          workerGeneration
      ) {
        return;
      }
  
      if (error?.name === window.RMLI18n.t("ui.literal.c749561f3732")) {
        projectIoPendingRequests.delete(id);
        recoverProjectIoRequest(
          pending,
          error,
          { preferMainThread: true }
        );
        return;
      }
  
      retireFailedProjectIoWorker(
        worker,
        workerGeneration,
        error
      );
    }
  }
  
  function releaseProjectIoWorkerIfIdle() {
    if (
      !projectIoWorker ||
      projectIoPendingRequests.size > 0
    ) {
      return false;
    }
  
    projectIoWorker.terminate();
    projectIoWorker = null;
    return true;
  }
  
  function scheduleProjectIoWorkerIdleRelease() {
    releaseProjectIoWorkerIfIdle();
  }
  
  function projectIoRequest(
    operation,
    payload
  ) {
    return new Promise(
      (resolve, reject) => {
        const pending = {
          operation,
          payload,
          resolve,
          reject,
          worker: null,
          workerGeneration: 0,
          recoveryAttempted: false,
          settled: false,
        };
        dispatchProjectIoRequest(pending);
      }
    ).finally(() => {
      scheduleProjectIoWorkerIdleRelease();
    });
  }
  
  function projectIoStreamedGzipRequest(
    value,
    {
      maximumBytes =
        PROJECT_FILE_MAX_BYTES,
      isCurrent = null
    } = {}
  ) {
    return new Promise(
      (resolve, reject) => {
        const pending = {
          operation:
            "streamStringifyGzip",
          payload: {
            value,
            maximumBytes
          },
          resolve,
          reject,
          worker: null,
          workerGeneration: 0,
          recoveryAttempted: false,
          settled: false,
          streamed: true,
          isCurrent:
            typeof isCurrent ===
              "function"
              ? isCurrent
              : null,
          streamPromise: null,
          streamMetrics: null,
        };
        dispatchProjectIoRequest(pending);
      }
    ).finally(() => {
      scheduleProjectIoWorkerIdleRelease();
    });
  }
  
  async function createCompressedJsonBlob(
    value
  ) {
    const response =
      await projectIoRequest(
        "stringifyGzip",
        { value }
      );
    return {
      blob: new Blob(
        [response.buffer],
        { type: "application/gzip" }
      ),
      jsonBytes:
        Number(response.jsonBytes) || 0,
      compressedBytes:
        Number(response.compressedBytes) ||
        response.buffer?.byteLength ||
        0,
      compression: "gzip"
    };
  }
  
  Object.defineProperty(
    window,
    window.RMLI18n.t("ui.literal.f3445f54a383"),
    {
      value: Object.freeze({
        version: 1,
        compress: value =>
          createCompressedJsonBlob(value)
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );

    return Object.freeze({
      request: projectIoRequest,
      requestStreamedGzip:
        projectIoStreamedGzipRequest,
      createCompressedJsonBlob,
      releaseIfIdle:
        releaseProjectIoWorkerIfIdle
    });
  }

  Object.defineProperty(
    window,
    "RMLProjectIoClient",
    {
      value: Object.freeze({
        version: 1,
        create
      }),
      writable: false,
      enumerable: false,
      configurable: true
    }
  );
})();
