(() => {
  "use strict";
  const root = globalThis;
  if (root.RMLGuidance?.version === 793) return;
  const base = new URL("../../assets/data/guidance/",
    root.document?.currentScript?.src || root.location.href);
  const sizes = { configuration: 16, runtime: 31 };
  const cache = new Map();
  const workers = new WeakSet();
  let outputPending = null;
  const packsFor = state => state?.metadata?.includeGuide !== true ? [] :
    state.extensions?.typedNodeGraph?.configSnapshot &&
    Array.isArray(state.extensions.typedNodeGraph.configSnapshot.nodes)
      ? ["configuration", "runtime"] : ["configuration"];

  function install(name, pack) {
    const strings = pack?.strings;
    if (!Object.hasOwn(sizes, name) || pack?.schemaVersion !== 1 ||
        pack?.version !== 793 || !strings || Array.isArray(strings) ||
        typeof strings !== "object" || Object.keys(strings).length !== sizes[name] ||
        Object.values(strings).some(value => typeof value !== "string")) {
      throw new Error(`Invalid guidance package: ${name} (v793 required).`);
    }
    const value = Object.freeze({ ...pack, strings: Object.freeze({ ...strings }) });
    cache.set(name, { value });
    return value;
  }

  function load(name) {
    if (!Object.hasOwn(sizes, name)) return Promise.reject(new Error(`Unknown guidance package: ${name}`));
    const entry = cache.get(name);
    if (entry?.value) return Promise.resolve(entry.value);
    if (entry?.error) return Promise.reject(entry.error);
    if (entry?.promise) return entry.promise;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const pending = {};
    cache.set(name, pending);
    pending.promise = (async () => {
      try {
        const response = await fetch(new URL(`${name}.json?v=793`, base), { signal: controller.signal });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return install(name, await response.json());
      } catch (error) {
        pending.error = new Error(`${name}.json: ${error?.message || error}`);
        throw pending.error;
      } finally {
        clearTimeout(timer);
        pending.promise = null;
      }
    })();
    return pending.promise;
  }

  root.RMLGuidance = Object.freeze({
    version: 793,
    ready: names => names.every(name => !!cache.get(name)?.value),
    error: names => names.map(name => cache.get(name)?.error).find(Boolean) || null,
    ensure: names => Promise.all(names.map(load)),
    ensureFor: state => Promise.all(packsFor(state).map(load)),
    prepareOutput(state, refresh) {
      const names = packsFor(state);
      if (names.every(name => cache.get(name)?.value)) return "";
      const error = names.map(name => cache.get(name)?.error).find(Boolean);
      if (error) return `Guidance comments: ${error.message} Switch guidance comments off and on to retry.`;
      if (!outputPending) {
        outputPending = Promise.all(names.map(load)).catch(() => {}).finally(() => {
          outputPending = null;
          refresh();
          root.announceGraphCodegenSettlement?.({ guidance: true });
        });
      }
      return "Guidance comments are loading…";
    },
    forWorker(worker, enabled) {
      if (!enabled || workers.has(worker)) return null;
      const pack = cache.get("runtime")?.value;
      if (!pack) throw new Error("Runtime guidance is not ready for worker generation.");
      workers.add(worker);
      return pack;
    },
    retryFailed(names = Object.keys(sizes)) {
      for (const name of names) if (cache.get(name)?.error) cache.delete(name);
    },
    install,
    snapshot: name => cache.get(name)?.value || null,
    text(name, key, ...values) {
      const strings = cache.get(name)?.value?.strings;
      if (!strings || !Object.hasOwn(strings, key)) {
        throw new Error(`Guidance text is not ready: ${name}/${key}.`);
      }
      const text = strings[key];
      if (!values.length) return text;
      return text.replace(/\{(\d+)\}/g, (_, index) => {
        if (Number(index) >= values.length) throw new Error(`Missing guidance parameter: ${name}/${key}/${index}`);
        return String(values[index]);
      });
    }
  });
})();
