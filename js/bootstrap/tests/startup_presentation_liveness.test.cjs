"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appPath = path.resolve(__dirname, "..", "app.js");
const loaderPath = path.resolve(
  __dirname,
  "..",
  "..",
  "loaders",
  "script_loader.js"
);
const graphViewPath = path.resolve(
  __dirname,
  "..",
  "..",
  "graph",
  "node_graph_view.js"
);

const appSource = fs.readFileSync(appPath, "utf8");
const loaderSource = fs.readFileSync(loaderPath, "utf8");
const graphViewSource = fs.readFileSync(graphViewPath, "utf8");

function between(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `${startMarker} must exist`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `${endMarker} must follow ${startMarker}`);
  return source.slice(start, end);
}

test("the usable Builder startup never awaits Runtime Graph presentation", () => {
  const initialize = between(
    appSource,
    "async function initialize()",
    "const RML_RUNTIME_DISPLAY_VALUE_TYPE"
  );
  const stages = initialize.match(/await completeStartupStage\(/g) || [];
  assert.equal(stages.length, 19);

  const usableFrame = initialize.indexOf(
    "The first workspace frame and public Builder bridge are ready."
  );
  const rendererHandoff = initialize.indexOf(
    "were handed to the Runtime Graph renderer"
  );
  const overlayComplete = initialize.indexOf(
    "await startupWork.complete("
  );
  const builderReady = initialize.indexOf(
    '"rml-builder:ready"'
  );
  const backgroundPresentation = initialize.indexOf(
    "return waitForImportedGraphUi("
  );

  assert.ok(usableFrame >= 0);
  assert.ok(rendererHandoff > usableFrame);
  assert.ok(overlayComplete > rendererHandoff);
  assert.ok(builderReady > overlayComplete);
  assert.ok(backgroundPresentation > builderReady);
  assert.doesNotMatch(initialize, /await\s+waitForImportedGraphUi\(/);
  assert.match(
    initialize,
    /await paintBuilderUi\(\);[\s\S]*?return waitForImportedGraphUi\(/
  );
});

test("Runtime Graph presentation waiting is bounded by inactivity, never total duration", () => {
  const wait = between(
    appSource,
    "function waitForImportedGraphUi(",
    "async function applyLoadedProjectWithFeedback("
  );

  assert.match(wait, /presentationStallMs = null/);
  assert.doesNotMatch(wait, /presentationTimeoutMs/);
  assert.match(wait, /recordPresentationActivity/);
  assert.match(wait, /new MutationObserver\(/);
  assert.match(wait, /rml-graph:render-complete/);
  assert.match(wait, /Date\.now\(\) - lastActivityAt/);
  assert.match(wait, /No total presentation duration limit was applied/);
  assert.match(wait, /stallTimerId = window\.setTimeout\(/);
  assert.match(wait, /window\.clearTimeout\(stallTimerId\)/);
  assert.match(wait, /activityObserver\?\.disconnect\(\)/);
  assert.match(
    wait,
    /document\.visibilityState ===[\s\S]*?"hidden"/
  );
  assert.match(wait, /"visibilitychange"/);
  assert.match(
    wait,
    /removeEventListener\([\s\S]*?"visibilitychange",[\s\S]*?handleVisibilityChange/
  );
  assert.match(
    wait,
    /handleVisibilityChange[\s\S]*?inspectNow\(\)[\s\S]*?recordPresentationActivity\(\)/
  );
  assert.match(
    wait,
    /document\.removeEventListener\([\s\S]*?presentation-complete/
  );
  assert.match(wait, /finish\(null, \{[\s\S]*?failed: true/);
});

test("deferred script event stalls retry and remain retryable", () => {
  const loadFile = between(
    loaderSource,
    "function loadFile(file)",
    "function prefetchFile(file)"
  );

  assert.match(loaderSource, /const SCRIPT_LOAD_EVENT_STALL_MS = 30000/);
  assert.match(loaderSource, /const SCRIPT_LOAD_STALL_RETRIES = 1/);
  assert.match(loadFile, /let settled = false/);
  assert.match(loadFile, /timeoutId = window\.setTimeout\(/);
  assert.match(loadFile, /window\.clearTimeout\(timeoutId\)/);
  assert.match(loadFile, /script\.removeEventListener\("load", onLoad\)/);
  assert.match(loadFile, /script\.removeEventListener\("error", onError\)/);
  assert.match(loadFile, /state\.promise = null/);
  assert.match(loadFile, /RML_SCRIPT_LOAD_EVENT_STALL/);
  assert.match(loadFile, /attempt <= SCRIPT_LOAD_STALL_RETRIES/);
  assert.match(
    loaderSource,
    /rmlBuilderReady !== "true"[\s\S]*?rml-builder:ready[\s\S]*?prepareRestoredRuntimeGraph/
  );
});

test("automatic startup restore reports progress inside the graph panel", () => {
  const restoreShell = between(
    graphViewSource,
    "function presentRuntimeGraphRestoreShell()",
    "function activateGraphMode()"
  );

  assert.match(
    restoreShell,
    /rmlStartupGraphPresentation ===[\s\S]*?"pending"/
  );
  assert.match(
    restoreShell,
    /startupRestoreRunsInPanel[\s\S]*?\? 0[\s\S]*?: beginGraphTransitionWork\(/
  );
});
