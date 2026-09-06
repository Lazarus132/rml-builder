(() => {
  "use strict";
  const root = globalThis;
  if (root.RMLCodeTemplates?.version === 794) return;
  const base = new URL("../../assets/data/code-templates/",
    root.document?.currentScript?.src || root.location.href);
  const sizes = Object.freeze({ configuration: 15, runtime: 7, nodes: 29, api: 1 });
  const packages = new Set(Object.keys(sizes));
  const cache = new Map();
  const workerPackages = new WeakMap();
  const pendingMessage = "C# source templates are loading…";
  let outputPending = null;
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
  function load(name) {
    if (!packages.has(name)) return Promise.reject(new Error(`Unknown C# template package: ${name}`));
    const current = cache.get(name);
    if (current?.value) return Promise.resolve(current.value);
    if (current?.promise) return current.promise;
    if (current?.error) return Promise.reject(current.error);
    const entry = {};
    cache.set(name, entry);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    entry.promise = (async () => {
      try {
        const response = await fetch(new URL(`${name}.json?v=794`, base), { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return install(name, await response.json());
      } catch (cause) {
        entry.error = new Error(`C# templates ${name}.json: ${cause?.message || cause}. Reload the page to retry.`);
        throw entry.error;
      } finally { clearTimeout(timeout); entry.promise = null; }
    })();
    return entry.promise;
  }
  function ensure(names) { return Promise.all([...new Set(names)].map(load)); }
  root.RMLCodeTemplates = Object.freeze({
    version: 794,
    pendingMessage,
    ensure,
    ensureFor: state => ensure(forState(state)),
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
