"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const catalogPath = path.resolve(__dirname, "..", "catalog_loader.js");
const loaderPath = path.resolve(
  __dirname,
  "..",
  "..",
  "loaders",
  "script_loader.js"
);
const catalogSource = fs.readFileSync(catalogPath, "utf8");
const loaderSource = fs.readFileSync(loaderPath, "utf8");

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} must exist`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} must follow ${startMarker}`);
  return source.slice(start, end);
}

test("loopback health discovery retries stalled hints without limiting catalog work", () => {
  const discovery = between(
    catalogSource,
    "async function discoverBuilderCatalogSession(",
    "function currentScannerConnection("
  );

  assert.match(
    catalogSource,
    /const CATALOG_HEALTH_PROBE_STALL_MS = 1000;/
  );
  assert.match(
    catalogSource,
    /const CATALOG_HEALTH_RETRY_STALL_MS = 4000;/
  );
  assert.match(discovery, /const stallWindows = \[/);
  assert.match(
    discovery,
    /CATALOG_HEALTH_PROBE_STALL_MS,[\s\S]*?CATALOG_HEALTH_RETRY_STALL_MS/
  );
  assert.match(discovery, /attempt \+ 1 < stallWindows\.length/);
  assert.match(discovery, /await Promise\.all\(/);
  assert.match(discovery, /ports\.map\(probe\)/);
  assert.match(
    discovery,
    /error\?\.code ===\s*"RML_CATALOG_FETCH_TIMEOUT"/
  );
});

test("catalog data fetches do not inherit the health-hint stall watcher", () => {
  const calls = catalogSource.match(
    /fetchJson\([\s\S]*?\);/g
  ) || [];
  const watchedCalls = calls.filter(call =>
    /timeoutMs:/.test(call)
  );
  assert.equal(watchedCalls.length, 1);
  assert.match(
    watchedCalls[0],
    /127\.0\.0\.1:\$\{port\}\/health/
  );
});

test("the JSON transport aborts and classifies a request deadline", async () => {
  const fetchFunction = between(
    catalogSource,
    "async function fetchJson(",
    "function loopbackScannerCatalogUrl("
  );
  const context = {
    AbortController,
    Error,
    Promise,
    TypeError,
    URL,
    setTimeout,
    clearTimeout,
    fetch(_url, options) {
      return new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        }, { once: true });
      });
    },
    location: { href: "https://example.test/index.html", origin: "https://example.test" }
  };
  context.window = context;
  context.RMLI18n = { t: value => value };
  vm.createContext(context);
  vm.runInContext(
    `${fetchFunction}\nglobalThis.runFetchJson = fetchJson;`,
    context,
    { filename: catalogPath }
  );

  await assert.rejects(
    context.runFetchJson(
      "http://127.0.0.1:42719/health",
      null,
      { timeoutMs: 5 }
    ),
    error =>
      error?.name === "TimeoutError" &&
      error?.code === "RML_CATALOG_FETCH_TIMEOUT"
  );
});

test("visible catalog checks own their overlay from health sweep to finally", () => {
  const wrapper = between(
    catalogSource,
    "async function synchronizeAvailableCatalog(\n",
    'window.addEventListener("rml-api-node-factory-ready"'
  );
  const core = between(
    catalogSource,
    "async function synchronizeAvailableCatalogCore(",
    "async function synchronizeAvailableCatalog(\n"
  );

  assert.ok(
    wrapper.indexOf("ensureScannerCheckWork(") <
      wrapper.indexOf("synchronizeAvailableCatalogCore(")
  );
  assert.match(wrapper, /finally \{/);
  assert.match(wrapper, /await finishScannerCheckWork\(false\)/);
  assert.match(wrapper, /aria-busy[\s\S]*?false/);
  assert.match(
    core,
    /deferScannerCheckWorkFinish:\s*options\.showWork === true/
  );
  assert.match(
    catalogSource,
    /deferScannerCheckWorkFinish !==[\s\S]*?true &&[\s\S]*?scannerCheckWorkOwner === 0/
  );
});

test("the scanner status control has exactly one click owner", () => {
  const install = between(
    loaderSource,
    "function installScannerStatusControl()",
    "installScannerStatusControl();"
  );
  const catalogInstall = between(
    catalogSource,
    "function installManualUnavailableCatalogActivation()",
    "installManualUnavailableCatalogActivation();"
  );

  assert.match(
    install,
    /event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\);\s*void run\(status\)/
  );
  assert.match(
    catalogInstall,
    /RMLScannerStatusControl\?\.owner ===\s*"script-loader"/
  );
});

test("a scanner-button check opens visible work before lazy modules load", () => {
  const install = between(
    loaderSource,
    "function installScannerStatusControl()",
    "installScannerStatusControl();"
  );
  const beginIndex = install.indexOf(
    "builderWork?.begin?.("
  );
  const moduleLoadIndex = install.indexOf(
    "await Promise.all(["
  );

  assert.notEqual(beginIndex, -1);
  assert.notEqual(moduleLoadIndex, -1);
  assert.ok(beginIndex < moduleLoadIndex);
  assert.match(
    install,
    /showWork:\s*workSession === 0/
  );
  assert.match(
    install,
    /builderWork\?\.finish\?\.\(\s*workSession\s*\)/
  );
});

test("a stalled lazy script is retried and never permanently locks its bundle", () => {
  const loadFile = between(
    loaderSource,
    "function loadFile(file)",
    "function prefetchFile(file)"
  );
  assert.match(
    loaderSource,
    /const SCRIPT_LOAD_EVENT_STALL_MS = 30000;/
  );
  assert.match(
    loaderSource,
    /const SCRIPT_LOAD_STALL_RETRIES = 1;/
  );
  assert.match(loadFile, /RML_SCRIPT_LOAD_EVENT_STALL/);
  assert.match(
    loadFile,
    /attempt <= SCRIPT_LOAD_STALL_RETRIES/
  );
  assert.match(loadFile, /state\.promise = null/);
});
