"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const catalogDirectory = path.resolve(__dirname, "..");
const loaderSource = fs.readFileSync(
  path.join(catalogDirectory, "catalog_loader.js"),
  "utf8"
);
const factorySource = fs.readFileSync(
  path.join(catalogDirectory, "api_nodes.js"),
  "utf8"
);

function functionSource(source, name) {
  const starts = [
    `function ${name}(`,
    `async function ${name}(`
  ]
    .map(marker => source.indexOf(marker))
    .filter(index => index >= 0);
  assert.ok(starts.length > 0, `${name} must exist`);
  const start = Math.min(...starts);
  const bodyStart = source.indexOf(") {", start);
  assert.ok(bodyStart > start, `${name} must have a body`);
  let depth = 0;
  let bodyStarted = false;
  for (let index = bodyStart + 2; index < source.length; index += 1) {
    if (source[index] === "{") {
      depth += 1;
      bodyStarted = true;
    } else if (source[index] === "}") {
      depth -= 1;
      if (bodyStarted && depth === 0) {
        return source.slice(start, index + 1);
      }
    }
  }
  assert.fail(`${name} must have a complete body`);
}

test("catalog notification is the final irreversible factory action", () => {
  const rebuild = functionSource(
    factorySource,
    "rebuildFactoryForCatalog"
  );
  const finalNotify = rebuild.indexOf(
    "catalogPublication.notify();"
  );
  const finalReturn = rebuild.indexOf(
    "return report;",
    finalNotify
  );
  assert.ok(finalNotify >= 0 && finalReturn > finalNotify);
  const afterNotify = rebuild.slice(finalNotify, finalReturn);
  assert.doesNotMatch(afterNotify, /\bawait\b/);
  assert.doesNotMatch(afterNotify, /assertNotCancelled/);
  assert.doesNotMatch(afterNotify, /\.rollback\s*\(/);
  const notificationBoundary = rebuild.indexOf(
    "publicationNotificationStarted = true;"
  );
  assert.ok(notificationBoundary >= 0);
  const afterBoundary = rebuild.slice(
    notificationBoundary,
    finalReturn
  ).replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(afterBoundary, /\bawait\b/);
  assert.doesNotMatch(
    afterBoundary,
    /assert(?:FactoryOperationLease|NotCancelled)/
  );
  assert.match(
    rebuild,
    /if \(publicationNotificationStarted\) \{[\s\S]*?throw error;[\s\S]*?\}[\s\S]*?if \(registryMutationStarted\)/
  );

  const publication = functionSource(
    loaderSource,
    "createCatalogPublication"
  );
  assert.match(
    publication,
    /notified = true;[\s\S]*?try \{[\s\S]*?updateStatus\(catalog\)/
  );
  assert.match(
    publication,
    /document\.dispatchEvent\([\s\S]*?catch \(error\)/
  );
});

test("stream snapshots CAS-check generation before publication", () => {
  const verify = functionSource(
    loaderSource,
    "verifiedCatalogStreamDemandRecord"
  );
  assert.match(verify, /attempt < 3/);
  assert.match(
    verify,
    /finalActive[\s\S]*?catalogDemandState !== expectedState[\s\S]*?finalActive\?\.generation[\s\S]*?publishCatalogDemandState/
  );

  const hydrate = functionSource(
    loaderSource,
    "ensureCatalogStreamDemandOperators"
  );
  assert.match(hydrate, /attempt < 3/);
  assert.match(
    hydrate,
    /assertCatalogDemandStateLease\([\s\S]*?hydrateCatalogStreamDemandSnapshot[\s\S]*?assertCatalogDemandStateLease/
  );
  assert.match(
    hydrate,
    /activateCatalogAndFactoryNow\([\s\S]*?signal: lease\.controller\.signal[\s\S]*?assertCatalogDemandStateLease/
  );
  assert.match(
    hydrate,
    /isCatalogDemandStaleError\(error\)[\s\S]*?continue;[\s\S]*?throw lastStaleError/
  );
});

test("a newer health sweep makes every older completion ineligible", () => {
  const publish = functionSource(
    loaderSource,
    "publishCatalogHealthSweepDiagnostics"
  );
  assert.match(
    publish,
    /requestEpoch <[\s\S]*?catalogHealthSweepRequestEpoch/
  );
  assert.match(
    publish,
    /requestEpoch <=[\s\S]*?catalogHealthSweepPublishedEpoch/
  );

  const discover = functionSource(
    loaderSource,
    "discoverBuilderCatalogSession"
  );
  assert.match(
    discover,
    /\+\+catalogHealthSweepRequestEpoch/
  );
  assert.match(
    discover,
    /requestEpoch !==[\s\S]*?catalogHealthSweepRequestEpoch[\s\S]*?return null;/
  );
  assert.match(
    discover,
    /publishCatalogHealthSweepDiagnostics\(\{[\s\S]*?requestEpoch/
  );

  const synchronize = functionSource(
    loaderSource,
    "synchronizeAvailableCatalogCore"
  );
  assert.match(
    synchronize,
    /healthSweepEpoch !==[\s\S]*?catalogHealthSweepRequestEpoch[\s\S]*?return Boolean/
  );
});
