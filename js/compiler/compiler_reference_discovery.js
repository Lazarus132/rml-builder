(() => {
  "use strict";

  function normalizeAssemblyName(value) {
    return String(value || "")
      .trim()
      .split(",", 1)[0]
      .replace(/\.dll$/i, "")
      .toLowerCase();
  }

  function missingAssemblyMap(names) {
    const result = new Map();
    for (const name of Array.isArray(names) ? names : []) {
      const display = String(name || "")
        .trim()
        .split(",", 1)[0]
        .replace(/\.dll$/i, "");
      const key = normalizeAssemblyName(display);
      if (key) result.set(key, display);
    }
    return result;
  }

  function selectMissingFiles(fileList, missingNames) {
    const missing = missingAssemblyMap(missingNames);
    const files = [];

    for (const file of fileList || []) {
      const key = normalizeAssemblyName(file?.name);
      if (!missing.has(key)) continue;
      files.push(file);
      missing.delete(key);
      if (missing.size === 0) break;
    }

    return Object.freeze({
      files: Object.freeze(files),
      missing: Object.freeze([...missing.values()])
    });
  }

  function assemblyNamesFromDiagnostics(diagnostics) {
    const names = new Map();
    for (const diagnostic of
      Array.isArray(diagnostics) ? diagnostics : []) {
      const id = String(diagnostic?.id || "");
      if (
        id !== "CS0012" &&
        id !== "CS1068" &&
        id !== "CS1069" &&
        id !== "CS7069"
      ) {
        continue;
      }

      const message = String(diagnostic?.message || "");
      for (const match of message.matchAll(
        /assembly\s+['"]([^,'"]+)/gi
      )) {
        const display = String(match[1] || "")
          .trim()
          .replace(/\.dll$/i, "");
        const key = normalizeAssemblyName(display);
        if (key) names.set(key, display);
      }
    }
    return Object.freeze([...names.values()]);
  }

  async function scanDirectory(
    rootHandle,
    missingNames,
    { onProgress = null } = {}
  ) {
    if (
      !rootHandle ||
      rootHandle.kind !== "directory" ||
      typeof rootHandle.entries !== "function"
    ) {
      throw new Error(
        "A readable Resonite directory was not provided."
      );
    }

    const missing = missingAssemblyMap(missingNames);
    const files = [];
    const matches = [];
    const queue = [{
      handle: rootHandle,
      path: String(rootHandle.name || "Resonite")
    }];
    let directoriesScanned = 0;
    let filesScanned = 0;

    while (queue.length > 0 && missing.size > 0) {
      const current = queue.shift();
      directoriesScanned += 1;

      for await (const [entryName, entry] of current.handle.entries()) {
        const name = String(entryName || entry?.name || "");
        const relativePath = `${current.path}/${name}`;

        if (entry?.kind === "directory") {
          queue.push({
            handle: entry,
            path: relativePath
          });
          continue;
        }

        if (entry?.kind !== "file") continue;
        filesScanned += 1;
        const key = normalizeAssemblyName(name);
        if (!missing.has(key)) {
          if (
            typeof onProgress === "function" &&
            filesScanned % 250 === 0
          ) {
            onProgress(Object.freeze({
              directoriesScanned,
              filesScanned,
              found: files.length,
              remaining: missing.size,
              path: relativePath
            }));
          }
          continue;
        }

        const file = await entry.getFile();
        files.push(file);
        matches.push(Object.freeze({
          name: missing.get(key),
          path: relativePath
        }));
        missing.delete(key);

        if (typeof onProgress === "function") {
          onProgress(Object.freeze({
            directoriesScanned,
            filesScanned,
            found: files.length,
            remaining: missing.size,
            path: relativePath
          }));
        }

        if (missing.size === 0) break;
      }
    }

    return Object.freeze({
      files: Object.freeze(files),
      matches: Object.freeze(matches),
      missing: Object.freeze([...missing.values()]),
      directoriesScanned,
      filesScanned
    });
  }

  Object.defineProperty(
    window,
    "RMLCompilerReferenceDiscovery",
    {
      value: Object.freeze({
        version: 1,
        normalizeAssemblyName,
        selectMissingFiles,
        assemblyNamesFromDiagnostics,
        scanDirectory
      }),
      configurable: true,
      enumerable: true
    }
  );
})();
