"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const rendererPath = path.resolve(
  __dirname,
  "..",
  "graph_gpu_renderer.js"
);
const rendererSource = fs.readFileSync(
  rendererPath,
  "utf8"
);

function extractFunction(name) {
  const marker = `function ${name}(`;
  const start = rendererSource.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const candidates = [
    rendererSource.indexOf("\n  function ", start + 1),
    rendererSource.indexOf("\n\n  let ", start + 1),
    rendererSource.indexOf("\n\n  const ", start + 1)
  ].filter(index => index > start);
  const end = candidates.length > 0
    ? Math.min(...candidates)
    : rendererSource.length;
  return rendererSource.slice(start, end).trim();
}

function createLivenessHarness() {
  let nextTimer = 1;
  const timers = new Map();
  const context = {
    console,
    Math,
    Number,
    Object,
    Promise,
    __timers: timers,
    __cleanupCalls: 0
  };
  context.window = context;
  context.globalThis = context;
  context.setTimeout = (callback, delay) => {
    const id = nextTimer++;
    timers.set(id, { callback, delay });
    return id;
  };
  context.clearTimeout = id => {
    timers.delete(id);
  };
  vm.createContext(context);
  vm.runInContext(`
    const RENDERER_INITIALIZATION_STALL_MS = 15000;
    const RENDERER_SUBMISSION_STALL_MS = 10000;
    const rendererBackendSubmissionFailures = new Map();
    ${extractFunction("rendererLivenessTimeoutError")}
    ${extractFunction("waitForRendererLiveness")}
    ${extractFunction("markRendererBackendSubmissionFailure")}
    ${extractFunction("rendererBackendTemporarilyUnavailable")}
    globalThis.api = {
      waitForRendererLiveness,
      markRendererBackendSubmissionFailure,
      rendererBackendTemporarilyUnavailable
    };
  `, context, { filename: rendererPath });
  return context;
}

function fireOnlyTimer(context) {
  assert.equal(
    context.__timers.size,
    1,
    "exactly one renderer deadline must be armed"
  );
  const [id, timer] = context.__timers.entries().next().value;
  context.__timers.delete(id);
  timer.callback();
  return timer.delay;
}

test("the central renderer watcher rejects a hung operation and runs timeout cleanup once", async () => {
  const context = createLivenessHarness();
  const pending = context.api.waitForRendererLiveness(
    new Promise(() => {}),
    "invented GPU wait",
    {
      timeoutMs: 25,
      onTimeout() {
        context.__cleanupCalls += 1;
      }
    }
  );

  assert.equal(fireOnlyTimer(context), 25);
  await assert.rejects(
    pending,
    error =>
      error?.name === "RendererLivenessTimeoutError" &&
      error?.code === "RML_RENDERER_LIVENESS_TIMEOUT" &&
      error?.operation === "invented GPU wait"
  );
  assert.equal(context.__cleanupCalls, 1);
  assert.equal(context.__timers.size, 0);
});

test("successful renderer settlement always clears its deadline timer", async () => {
  const context = createLivenessHarness();
  const result = await context.api.waitForRendererLiveness(
    Promise.resolve("ready"),
    "invented successful GPU wait",
    { timeoutMs: 25 }
  );

  assert.equal(result, "ready");
  assert.equal(context.__timers.size, 0);
});

test("all asynchronous GPU gates use the same response-stall contract", () => {
  assert.match(
    rendererSource,
    /const RENDERER_INITIALIZATION_STALL_MS\s*=\s*15000/
  );
  assert.match(
    rendererSource,
    /const RENDERER_SUBMISSION_STALL_MS\s*=\s*10000/
  );
  assert.match(
    rendererSource,
    /waitForRendererLiveness\(\s*\(\) => navigator\.gpu\.requestAdapter\(/
  );
  assert.match(
    rendererSource,
    /waitForRendererLiveness\(\s*\(\) => adapter\.requestDevice\(/
  );
  assert.match(
    rendererSource,
    /waitForRendererLiveness\(\s*\(\) => device\.popErrorScope\(\)/
  );
  assert.match(
    rendererSource,
    /waitForRendererLiveness\(\s*\(\) => queue\.onSubmittedWorkDone\(\)/
  );
});

test("renderer initialization has no cumulative total-runtime deadline", () => {
  assert.doesNotMatch(
    rendererSource,
    /createRendererLivenessDeadline|initializationDeadline/
  );
  const initialization = rendererSource.slice(
    rendererSource.indexOf("webGpuRuntime.ready ="),
    rendererSource.indexOf("function grownCapacity(")
  );
  assert.equal(
    (
      initialization.match(
        /RENDERER_INITIALIZATION_STALL_MS/g
      ) || []
    ).length,
    4,
    "each independent WebGPU browser promise must receive a fresh stall watcher"
  );
});

test("a failed backend falls back once and is retried on a later creation", () => {
  const context = createLivenessHarness();
  context.api.markRendererBackendSubmissionFailure(
    "invented-backend"
  );
  assert.equal(
    context.api.rendererBackendTemporarilyUnavailable(
      "invented-backend"
    ),
    true
  );
  assert.equal(
    context.api.rendererBackendTemporarilyUnavailable(
      "invented-backend"
    ),
    false
  );
});

test("WebGL fence timeout cancels polling and deletes the fence idempotently", () => {
  assert.match(
    rendererSource,
    /window\.cancelAnimationFrame\(frame\)/
  );
  assert.match(
    rendererSource,
    /gl\.deleteSync\(fence\)/
  );
  assert.match(
    rendererSource,
    /"WebGL fence submission"[\s\S]*?onTimeout:\s*cleanup[\s\S]*?\.finally\(cleanup\)/
  );
});
