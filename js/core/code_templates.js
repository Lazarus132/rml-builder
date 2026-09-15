(() => {
  "use strict";
  const root = globalThis;
  if (root.RMLCodeTemplates?.version === 794) return;
  const scriptBase = new URL("./",
    root.document?.currentScript?.src || root.location.href);
  const base = new URL("../../assets/data/code-templates/",
    root.document?.currentScript?.src || root.location.href);
  const staticPayloadBundleUrl = new URL(
    "static_file_payloads.js?v=794",
    scriptBase
  );
  const sizes = Object.freeze({ configuration: 15, runtime: 7, nodes: 29, api: 1 });
  const packages = new Set(Object.keys(sizes));
  const cache = new Map();
  const workerPackages = new WeakMap();
  const pendingMessage = "C# source templates are loading…";
  let outputPending = null;
  let staticPayloadPromise = null;
  const forState = state => {
    const graph = state?.extensions?.typedNodeGraph?.configSnapshot;
    return graph && Array.isArray(graph.nodes)
      ? ["configuration", "runtime", "nodes", "api"] : ["configuration"];
  };
  function install(name, pack) {
    if (!packages.has(name) || pack?.schemaVersion !== 1 || pack.version !== 794 ||
        pack.package !== name || !pack.templates || Array.isArray(pack.templates) ||
        typeof pack.templates !== "object" || Object.keys(pack.templates).length !== sizes[name] || Object.values(pack.templates).some(parts =>
          !Array.isArray(parts) || !parts.length || parts.some(value => typeof value !== "string"))) {
      throw new Error(`Invalid C# template package: ${name} (v794 required).`);
    }
    const templates = Object.create(null);
    for (const [key, parts] of Object.entries(pack.templates)) templates[key] = Object.freeze([...parts]);
    const value = Object.freeze({ ...pack, templates: Object.freeze(templates) });
    cache.set(name, { value });
    return value;
  }
  function currentStaticPayloads() {
    const payloads = root.RMLStaticBuilderPayloads;
    return payloads?.schemaVersion === 1 &&
      payloads.codeTemplates &&
      typeof payloads.codeTemplates === "object"
      ? payloads
      : null;
  }
  function ensureStaticPayloads() {
    const current = currentStaticPayloads();
    if (current) return Promise.resolve(current);
    if (staticPayloadPromise) return staticPayloadPromise;
    staticPayloadPromise = new Promise((resolve, reject) => {
      const document = root.document;
      const parent = document?.head || document?.documentElement;
      if (!document?.createElement || !parent?.appendChild) {
        reject(new Error("The static Builder payload loader is unavailable."));
        return;
      }
      const script = document.createElement("script");
      script.async = true;
      script.src = staticPayloadBundleUrl.href;
      script.onload = () => {
        const payloads = currentStaticPayloads();
        if (payloads) resolve(payloads);
        else reject(new Error("The static Builder payload bundle is invalid."));
      };
      script.onerror = () => reject(new Error(
        "The static Builder payload bundle could not be loaded."
      ));
      parent.appendChild(script);
    }).catch(error => {
      staticPayloadPromise = null;
      throw error;
    });
    return staticPayloadPromise;
  }
  function load(name) {
    if (!packages.has(name)) return Promise.reject(new Error(`Unknown C# template package: ${name}`));
    const current = cache.get(name);
    if (current?.value) return Promise.resolve(current.value);
    if (current?.promise) return current.promise;
    if (current?.error) return Promise.reject(current.error);
    const entry = {};
    cache.set(name, entry);
    entry.promise = (async () => {
      let controller = null;
      let timeout = 0;
      try {
        if (root.location?.protocol === "file:") {
          const payloads = await ensureStaticPayloads();
          return install(name, payloads.codeTemplates[name]);
        }
        controller = new AbortController();
        timeout = setTimeout(() => controller.abort(), 20000);
        const response = await fetch(new URL(`${name}.json?v=794`, base), { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return install(name, await response.json());
      } catch (cause) {
        entry.error = new Error(`C# templates ${name}.json: ${cause?.message || cause}. Reload the page to retry.`);
        throw entry.error;
      } finally {
        if (timeout) clearTimeout(timeout);
        entry.promise = null;
      }
    })();
    return entry.promise;
  }
  function ensure(names) { return Promise.all([...new Set(names)].map(load)); }
  root.RMLCodeTemplates = Object.freeze({
    version: 794,
    pendingMessage,
    ensure,
    ensureFor: state => ensure(forState(state)),
    ensureStaticPayloads,
    ready: names => names.every(name => !!cache.get(name)?.value),
    install,
    retryFailed() { for (const [name, value] of cache) if (value.error) cache.delete(name); },
    prepareOutput(state, refresh) {
      const names = forState(state);
      if (names.every(name => cache.get(name)?.value)) return "";
      const error = names.map(name => cache.get(name)?.error).find(Boolean);
      if (error) return error.message;
      if (!outputPending) outputPending = ensure(names).catch(() => {}).finally(() => {
        outputPending = null;
        refresh();
        root.announceGraphCodegenSettlement?.({ templates: true });
      });
      return pendingMessage;
    },
    forWorker(worker) {
      let sent = workerPackages.get(worker);
      if (!sent) workerPackages.set(worker, sent = new Set());
      const result = [];
      for (const name of ["runtime", "nodes", "api"]) {
        if (sent.has(name)) continue;
        const pack = cache.get(name)?.value;
        if (!pack) throw new Error(`C# template package is not ready for worker: ${name}`);
        result.push(pack);
        sent.add(name);
      }
      return result;
    },
    snapshot: name => cache.get(name)?.value || null,
    text(name, key, values = []) {
      const parts = cache.get(name)?.value?.templates?.[key];
      if (!parts) throw new Error(`C# template is not loaded: ${name}/${key}`);
      if (!Array.isArray(values) || values.length !== parts.length - 1) {
        throw new Error(`C# template parameter mismatch: ${name}/${key}`);
      }
      let result = parts[0];
      for (let i = 0; i < values.length; i++) result += String(values[i]) + parts[i + 1];
      return result;
    }
  });
})();
