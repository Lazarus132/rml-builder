(() => {
  "use strict";
  // RML Builder compiler: csharp14_roslyn.

  const ASSEMBLY = "RmlCSharp14ParserWasm";
  const LANGUAGE_VERSION = "14.0";
  const channels = {
    validator: {
      label: "C# 14 validator",
      url: new URL(
        "../workers/validator_worker.js?v=5-editor-live-worker-v786",
        document.currentScript?.src || window.location.href
      ).href,
      name: "rml-csharp14-validator",
      worker: null,
      idleTimer: 0,
      failure: null
    },
    liveValidator: {
      label: "C# 14 live validator",
      url: new URL(
        "../workers/validator_worker.js?v=5-editor-live-worker-v786",
        document.currentScript?.src || window.location.href
      ).href,
      name: "rml-csharp14-live-validator",
      worker: null,
      idleTimer: 0,
      failure: null
    },
    compiler: {
      label: ".NET compiler",
      url: new URL(
        "../workers/compiler_worker.js?v=4-max-graph-performance-v755",
        document.currentScript?.src || window.location.href
      ).href,
      name: "rml-csharp14-compiler",
      worker: null,
      idleTimer: 0,
      failure: null
    }
  };
  const START_TIMEOUT_MS = 5 * 60 * 1000;
  const OPERATION_TIMEOUT_MS = 10 * 60 * 1000;
  const IDLE_WORKER_RELEASE_MS = 15000;

  let requestSequence = 0;
  const pending = new Map();

  function describeError(error, fallback) {
    const message = error instanceof Error
      ? error.message
      : String(error || "");
    return message || fallback;
  }

  function rejectPending(channel, error) {
    for (const [id, request] of pending) {
      if (request.channel !== channel) continue;
      globalThis.clearTimeout(request.timer);
      request.reject(error);
      pending.delete(id);
    }
  }

  function markWorkerFailed(channel, message) {
    if (channel.failure) return channel.failure;
    channel.failure = new Error(
      message ||
      `The isolated ${channel.label} worker stopped unexpectedly. Reload the Builder before trying again.`
    );
    const failedWorker = channel.worker;
    channel.worker = null;
    if (channel.idleTimer) {
      globalThis.clearTimeout(
        channel.idleTimer
      );
      channel.idleTimer = 0;
    }
    try {
      failedWorker?.terminate();
    } catch {}
    rejectPending(channel, channel.failure);
    return channel.failure;
  }

  function channelHasPendingRequests(
    channel
  ) {
    for (const request of pending.values()) {
      if (request.channel === channel) {
        return true;
      }
    }
    return false;
  }

  function releaseIdleChannel(channel) {
    if (
      !channel.worker ||
      channelHasPendingRequests(channel)
    ) {
      return false;
    }
    if (channel.idleTimer) {
      globalThis.clearTimeout(
        channel.idleTimer
      );
      channel.idleTimer = 0;
    }
    const worker = channel.worker;
    channel.worker = null;
    try {
      worker.terminate();
    } catch {}
    return true;
  }

  function scheduleIdleChannelRelease(
    channel
  ) {
    if (channel.idleTimer) {
      globalThis.clearTimeout(
        channel.idleTimer
      );
    }
    channel.idleTimer = globalThis.setTimeout(
      () => {
        channel.idleTimer = 0;
        releaseIdleChannel(channel);
      },
      IDLE_WORKER_RELEASE_MS
    );
  }

  function releaseIdleWorkers() {
    let released = 0;
    let busy = 0;
    for (const channel of
      Object.values(channels)) {
      if (channelHasPendingRequests(channel)) {
        busy += 1;
      } else if (releaseIdleChannel(channel)) {
        released += 1;
      }
    }
    return Object.freeze({ released, busy });
  }

  function handleMessage(channel, event) {
    const message = event?.data;
    const request = pending.get(message?.id);
    if (!request || request.channel !== channel) return;

    if (message.type === "progress") {
      try {
        request.onProgress?.(message.progress);
      } catch (error) {
        console.error("Compiler progress callback failed.", error);
      }
      return;
    }

    pending.delete(message.id);
    globalThis.clearTimeout(request.timer);
    scheduleIdleChannelRelease(channel);
    if (message.type === "result") {
      request.resolve(message.result);
      return;
    }

    const detail = String(
      message?.error?.message ||
      "The isolated compiler operation failed."
    );
    const error = new Error(detail);
    if (message?.error?.stack) {
      error.stack = String(message.error.stack);
    }
    request.reject(error);
  }

  function createWorker(channel) {
    if (channel.failure) throw channel.failure;
    if (channel.idleTimer) {
      globalThis.clearTimeout(
        channel.idleTimer
      );
      channel.idleTimer = 0;
    }
    if (channel.worker) return channel.worker;
    if (typeof globalThis.Worker !== "function") {
      throw markWorkerFailed(
        channel,
        "This browser does not support the isolated workers required for local C# validation and DLL builds."
      );
    }

    const nextWorker = new Worker(channel.url, {
      name: channel.name
    });
    channel.worker = nextWorker;
    nextWorker.addEventListener(
      "message",
      event => handleMessage(channel, event)
    );
    nextWorker.addEventListener("messageerror", () => {
      markWorkerFailed(
        channel,
        `The browser could not read a response from the isolated ${channel.label} worker. Reload the Builder before trying again.`
      );
    });
    nextWorker.addEventListener("error", event => {
      event.preventDefault?.();
      const detail = String(event?.message || "").trim();
      markWorkerFailed(
        channel,
        detail
          ? `The isolated ${channel.label} worker stopped: ${detail}`
          : `The isolated ${channel.label} worker stopped unexpectedly. Reload the Builder before trying again.`
      );
    });
    return channel.worker;
  }

  function invoke(
    channel,
    method,
    args = [],
    {
      onProgress = null,
      timeoutMs = OPERATION_TIMEOUT_MS
    } = {}
  ) {
    if (channel.failure) {
      return Promise.reject(channel.failure);
    }

    return new Promise((resolve, reject) => {
      let activeWorker;
      try {
        activeWorker = createWorker(channel);
      } catch (error) {
        reject(error);
        return;
      }

      const id = ++requestSequence;
      const timer = globalThis.setTimeout(() => {
        pending.delete(id);
        const error = markWorkerFailed(
          channel,
          `The isolated ${channel.label} did not finish '${method}' within ${Math.round(timeoutMs / 60000)} minutes. Reload the Builder before trying again.`
        );
        reject(error);
      }, timeoutMs);
      pending.set(id, {
        resolve,
        reject,
        onProgress,
        timer,
        channel
      });

      try {
        activeWorker.postMessage({
          type: "invoke",
          id,
          method,
          args
        });
      } catch (error) {
        pending.delete(id);
        globalThis.clearTimeout(timer);
        reject(markWorkerFailed(
          channel,
          `The ${channel.label} request could not be sent to its worker: ${describeError(error, "unknown browser error")}`
        ));
      }
    });
  }

  function ensureReady() {
    return invoke(
      channels.validator,
      "ensureReady",
      [],
      { timeoutMs: START_TIMEOUT_MS }
    );
  }

  function parse(source) {
    return invoke(
      channels.validator,
      "parse",
      [String(source ?? "")]
    );
  }

  function validate(source) {
    return invoke(
      channels.validator,
      "validate",
      [String(source ?? "")]
    );
  }

  function validateEditor(parameterKey, source) {
    return invoke(channels.liveValidator, "validateEditor", [
      String(parameterKey || ""), String(source ?? "")
    ]);
  }

  function getSyntaxKinds() {
    return invoke(
      channels.validator,
      "getSyntaxKinds"
    );
  }

  function configureReferences(files, onProgress) {
    return invoke(
      channels.compiler,
      "configureReferences",
      [Array.isArray(files) ? files : []],
      { onProgress }
    );
  }

  function compile(projects, options = {}) {
    const workerOptions = {
      referenceFiles: Array.isArray(options.referenceFiles)
        ? options.referenceFiles
        : [],
      emitPdb: options.emitPdb === true
    };
    return invoke(
      channels.compiler,
      "compile",
      [Array.isArray(projects) ? projects : [], workerOptions],
      { onProgress: options.onProgress }
    );
  }

  function resetCompilerReferences() {
    if (
      !channels.compiler.worker ||
      channels.compiler.failure
    ) {
      return Promise.resolve();
    }
    return invoke(
      channels.compiler,
      "resetCompilerReferences"
    );
  }

  Object.defineProperty(
    window,
    "RMLCSharp14Roslyn",
    {
      value: Object.freeze({
        version: 11,
        name: "Roslyn C# 14 isolated browser compiler (.NET 9 host, .NET 10 target)",
        languageVersion: LANGUAGE_VERSION,
        assembly: ASSEMBLY,
        runtime: "split-dotnet9-browser-wasm-workers-net10-target",
        ensureReady,
        parse,
        validate,
        validateEditor,
        getSyntaxKinds,
        compile,
        configureReferences,
        resetCompilerReferences,
        releaseIdleWorkers,
        capabilities: Object.freeze({
          syntaxValidation: true,
          binaryCompilation: true,
          portablePdb: false,
          offline: true,
          isolatedWorker: true,
          isolatedLiveDiagnostics: true,
          targetFramework: "net10.0"
        })
      }),
      configurable: true,
      enumerable: true
    }
  );
})();
