(() => {
  "use strict";
  const root = globalThis;
  if (root.RMLCodeTemplates?.version === 797) return;
  const scriptBase = new URL("./",
    root.document?.currentScript?.src || root.location.href);
  const base = new URL("../../assets/data/code-templates/",
    root.document?.currentScript?.src || root.location.href);
  const staticPayloadBundleUrl = new URL(
    "static_file_payloads.js?v=797",
    scriptBase
  );
  const sizes = Object.freeze({ configuration: 15, runtime: 7, nodes: 29, api: 1 });
  const packages = new Set(Object.keys(sizes));
  const cache = new Map();
  const workerPackages = new WeakMap();
  const pendingMessage = window.RMLI18n.t("ui.literal.8369277e83c3");
  let outputPending = null;
  let staticPayloadPromise = null;
  function normalizeCSharpSource(value) {
    const source = String(value ?? "");
    if (!source.includes("\\")) return source;
    let result = "";
    let index = 0;
    let mode = "code";
    let rawQuoteCount = 0;
    while (index < source.length) {
      const character = source[index];
      const next = source[index + 1] || "";
      if (mode === "line-comment") {
        result += character;
        index += 1;
        if (character === "\r" || character === "\n") mode = "code";
        continue;
      }
      if (mode === "block-comment") {
        if (character === "*" && next === "/") {
          result += "*/";
          index += 2;
          mode = "code";
        } else {
          result += character;
          index += 1;
        }
        continue;
      }
      if (mode === "regular-string" || mode === "character") {
        result += character;
        index += 1;
        if (character === "\\" && index < source.length) {
          result += source[index];
          index += 1;
        } else if (
          (mode === "regular-string" && character === "\"") ||
          (mode === "character" && character === "'")
        ) {
          mode = "code";
        }
        continue;
      }
      if (mode === "verbatim-string") {
        result += character;
        index += 1;
        if (character === "\"") {
          if (source[index] === "\"") {
            result += source[index];
            index += 1;
          } else {
            mode = "code";
          }
        }
        continue;
      }
      if (mode === "raw-string") {
        if (character === "\"") {
          let quoteCount = 1;
          while (source[index + quoteCount] === "\"") quoteCount += 1;
          result += source.slice(index, index + quoteCount);
          index += quoteCount;
          if (quoteCount >= rawQuoteCount) mode = "code";
        } else {
          result += character;
          index += 1;
        }
        continue;
      }
      if (character === "/" && next === "/") {
        result += "//";
        index += 2;
        mode = "line-comment";
        continue;
      }
      if (character === "/" && next === "*") {
        result += "/*";
        index += 2;
        mode = "block-comment";
        continue;
      }
      let rawPrefixLength = 0;
      while (source[index + rawPrefixLength] === "$") rawPrefixLength += 1;
      let rawQuoteStart = index + rawPrefixLength;
      let possibleRawQuoteCount = 0;
      while (source[rawQuoteStart + possibleRawQuoteCount] === "\"") {
        possibleRawQuoteCount += 1;
      }
      if (possibleRawQuoteCount >= 3) {
        const length = rawPrefixLength + possibleRawQuoteCount;
        result += source.slice(index, index + length);
        index += length;
        rawQuoteCount = possibleRawQuoteCount;
        mode = "raw-string";
        continue;
      }
      if (
        source.startsWith("$@\"", index) ||
        source.startsWith("@$\"", index)
      ) {
        result += source.slice(index, index + 3);
        index += 3;
        mode = "verbatim-string";
        continue;
      }
      if (source.startsWith("@\"", index)) {
        result += "@\"";
        index += 2;
        mode = "verbatim-string";
        continue;
      }
      if (source.startsWith("$\"", index)) {
        result += "$\"";
        index += 2;
        mode = "regular-string";
        continue;
      }
      if (character === "\"") {
        result += character;
        index += 1;
        mode = "regular-string";
        continue;
      }
      if (character === "'") {
        result += character;
        index += 1;
        mode = "character";
        continue;
      }
      if (character === "\\") {
        if (source.startsWith("\\r\\n", index)) {
          result += "\n";
          index += 4;
          continue;
        }
        if (next === "r" || next === "n") {
          result += "\n";
          index += 2;
          continue;
        }
        if (next === "t") {
          result += "\t";
          index += 2;
          continue;
        }
      }
      result += character;
      index += 1;
    }
    return result;
  }
  const forState = state => {
    const graph = state?.extensions?.typedNodeGraph?.configSnapshot;
    return graph && Array.isArray(graph.nodes)
      ? ["configuration", "runtime", "nodes", "api"] : ["configuration"];
  };
  function install(name, pack) {
    if (!packages.has(name) || pack?.schemaVersion !== 1 || pack.version !== 797 ||
        pack.package !== name || !pack.templates || Array.isArray(pack.templates) ||
        typeof pack.templates !== "object" || Object.keys(pack.templates).length !== sizes[name] || Object.values(pack.templates).some(parts =>
          !Array.isArray(parts) || !parts.length || parts.some(value => typeof value !== "string"))) {
      throw new Error(`Invalid C# template package: ${name} (v797 required).`);
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
        const response = await fetch(new URL(`${name}.json?v=797`, base), { signal: controller.signal });
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
    version: 797,
    pendingMessage,
    ensure,
    ensureFor: state => ensure(forState(state)),
    ensureStaticPayloads,
    normalizeCSharpSource,
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
