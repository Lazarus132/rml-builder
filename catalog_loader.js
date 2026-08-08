(() => {
  "use strict";

  const LOADER_VERSION = 5;
  const DEFAULT_PORT_FIRST = 42719;
  const DEFAULT_PORT_LAST = 42729;
  const CATALOG_PATH = "/resonite_api_catalog.json";
  const HEALTH_PATH = "/health";
  const POLL_INTERVAL_MS = 30000;
  const PROBE_TIMEOUT_MS = 900;
  const CATALOG_FETCH_TIMEOUT_MS = 45000;
  const FALLBACK_FETCH_TIMEOUT_MS = 5000;
  const CACHE_DATABASE_NAME =
    "rml-resonite-api-catalog";
  const CACHE_DATABASE_VERSION = 1;
  const CACHE_STORE_NAME = "catalogs";
  const CACHE_RECORD_KEY = "latest-live";

  const scriptUrl =
    document.currentScript?.src ||
    window.location.href;
  const fallbackUrl = new URL(
    "resonite_api_catalog.fallback.json?v=3",
    scriptUrl
  ).href;
  const modNodesUrl = new URL(
    "mod_nodes.js?v=15",
    scriptUrl
  ).href;
  const apiNodesUrl = new URL(
    "api_nodes.js?v=3",
    scriptUrl
  ).href;

  const minimalFallback = Object.freeze({
    schemaVersion: 3,
    catalogKind: "embedded-minimal-fallback",
    engineVersion: "unknown",
    sourceAssembly: "FrooxEngine.dll",
    assemblyFingerprint: "embedded-minimal",
    catalogFingerprint: "embedded-minimal",
    assemblies: [],
    components: [
      "FrooxEngine.Grabbable",
      "FrooxEngine.PBS_Metallic",
      "FrooxEngine.BoxMesh"
    ],
    materials: [
      "FrooxEngine.PBS_Metallic",
      "FrooxEngine.PBS_Specular",
      "FrooxEngine.UnlitMaterial"
    ],
    commonMaterials: [
      "FrooxEngine.PBS_Metallic",
      "FrooxEngine.PBS_Specular",
      "FrooxEngine.UnlitMaterial"
    ],
    meshes: [
      "FrooxEngine.QuadMesh",
      "FrooxEngine.BoxMesh",
      "FrooxEngine.SphereMesh",
      "FrooxEngine.CylinderMesh",
      "FrooxEngine.ArrowMesh"
    ],
    slotAttachOverloads: [],
    types: [],
    enums: []
  });

  let resolveRegistryReady;
  let registryResolved = false;

  const registryReady =
    window.RMLNodeRegistryReady ||
    new Promise(resolve => {
      resolveRegistryReady = value => {
        if (registryResolved) {
          return;
        }

        registryResolved = true;
        resolve(value);
      };
    });

  if (!window.RMLNodeRegistryReady) {
    Object.defineProperty(
      window,
      "RMLNodeRegistryReady",
      {
        value: registryReady,
        writable: false,
        enumerable: true,
        configurable: true
      }
    );
  }

  const previousRegistryResolver =
    window.__rmlResolveNodeRegistryReady;

  window.__rmlResolveNodeRegistryReady =
    registry => {
      try {
        previousRegistryResolver?.(
          registry
        );
      } catch (error) {
        console.warn(
          "Previous node-registry resolver failed.",
          error
        );
      }

      resolveRegistryReady?.(
        registry
      );
    };

  if (window.RMLModNodeRegistry) {
    window.__rmlResolveNodeRegistryReady(
      window.RMLModNodeRegistry
    );
  }

  function uniqueSorted(values) {
    return [...new Set(
      (Array.isArray(values)
        ? values
        : [])
        .map(value =>
          String(value || "").trim()
        )
        .filter(Boolean)
    )].sort((left, right) =>
      left.localeCompare(right)
    );
  }

  function catalogTypes(raw) {
    return Array.isArray(raw?.types)
      ? raw.types.filter(
          value =>
            value &&
            typeof value === "object"
        )
      : [];
  }

  function typeNamesByFlag(
    raw,
    flag
  ) {
    return catalogTypes(raw)
      .filter(type =>
        type[flag] === true
      )
      .map(type =>
        type.fullName
      );
  }

  function normalizeCatalog(
    raw,
    source,
    sourceUrl = ""
  ) {
    const value =
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw)
        ? raw
        : minimalFallback;

    const components = uniqueSorted(
      Array.isArray(value.components)
        ? value.components
        : typeNamesByFlag(
            value,
            "isAttachableComponent"
          )
    );
    const materials = uniqueSorted(
      Array.isArray(value.materials)
        ? value.materials
        : typeNamesByFlag(
            value,
            "isMaterial"
          )
    );
    const commonMaterials =
      uniqueSorted(
        Array.isArray(
          value.commonMaterials
        )
          ? value.commonMaterials
          : typeNamesByFlag(
              value,
              "isCommonMaterial"
            )
      );
    const meshes = uniqueSorted(
      Array.isArray(value.meshes)
        ? value.meshes
        : typeNamesByFlag(
            value,
            "isMeshProvider"
          )
    );

    return Object.freeze({
      ...value,
      schemaVersion:
        Number(value.schemaVersion) || 3,
      loaderVersion: LOADER_VERSION,
      catalogSource: source,
      catalogSourceUrl: sourceUrl,
      engineVersion:
        String(
          value.engineVersion ||
          "unknown"
        ),
      sourceAssembly:
        String(
          value.sourceAssembly ||
          "FrooxEngine.dll"
        ),
      components: Object.freeze(
        components.length > 0
          ? components
          : [...minimalFallback.components]
      ),
      materials: Object.freeze(
        materials.length > 0
          ? materials
          : [...minimalFallback.materials]
      ),
      commonMaterials: Object.freeze(
        commonMaterials.length > 0
          ? commonMaterials
          : [...minimalFallback.commonMaterials]
      ),
      meshes: Object.freeze(
        meshes.length > 0
          ? meshes
          : [...minimalFallback.meshes]
      ),
      slotAttachOverloads:
        Object.freeze(
          Array.isArray(
            value.slotAttachOverloads
          )
            ? value.slotAttachOverloads
            : []
        ),
      types: Object.freeze(
        catalogTypes(value)
      ),
      enums: Object.freeze(
        Array.isArray(value.enums)
          ? value.enums
          : []
      ),
      assemblies: Object.freeze(
        Array.isArray(value.assemblies)
          ? value.assemblies
          : []
      )
    });
  }

  function installCatalog(catalog) {
    for (const property of [
      "RMLResoniteApiCatalog",
      "RMLFrooxComponentCatalog"
    ]) {
      Object.defineProperty(
        window,
        property,
        {
          value: catalog,
          writable: false,
          enumerable: true,
          configurable: true
        }
      );
    }

    updateStatus(catalog);

    document.dispatchEvent(
      new CustomEvent(
        "rml-catalog:loaded",
        {
          detail: catalog
        }
      )
    );

    return catalog;
  }

  function updateStatus(catalog) {
    const element =
      document.getElementById(
        "api-catalog-state"
      );

    if (!element) {
      return;
    }

    const source =
      String(
        catalog.catalogSource ||
        "fallback"
      );
    const live = source === "scanner";
    const cached =
      source === "scanner-cache";
    const count =
      catalog.components?.length || 0;

    element.dataset.source = live
      ? "scanner"
      : cached
        ? "cache"
        : "fallback";

    element.textContent = live
      ? `Resonite API ${catalog.engineVersion} · live · ${count} components`
      : cached
        ? `Resonite API ${catalog.engineVersion} · cached live catalog · ${count} components`
        : `Resonite API ${catalog.engineVersion} · fallback · ${count} components`;

    element.title = live
      ? `Live catalog from ${catalog.catalogSourceUrl}`
      : cached
        ? "The last live scanner catalog is loaded from this browser's IndexedDB cache. Resonite does not need to stay open."
        : "The Resonite scanner endpoint and the browser's last-live cache were unavailable. The packaged fallback catalog is active.";
  }

  function safeLocalStorageValue(key) {
    try {
      return window.localStorage
        ?.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function configuredCatalogUrl() {
    const query =
      new URLSearchParams(
        window.location.search
      ).get("catalogUrl");

    return String(
      query ||
      safeLocalStorageValue(
        "rml-resonite-api-catalog-url"
      ) ||
      ""
    ).trim();
  }

  function scannerUrls() {
    const configured =
      configuredCatalogUrl();

    if (configured) {
      return [configured];
    }

    const urls = [];

    for (
      let port = DEFAULT_PORT_FIRST;
      port <= DEFAULT_PORT_LAST;
      port += 1
    ) {
      urls.push(
        `http://127.0.0.1:${port}${CATALOG_PATH}`
      );
    }

    return urls;
  }

  function healthUrlFor(catalogUrl) {
    try {
      const url = new URL(
        catalogUrl,
        window.location.href
      );
      url.pathname = HEALTH_PATH;
      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return "";
    }
  }

  async function fetchJson(
    url,
    timeoutMs
  ) {
    const controller =
      new AbortController();
    const timeout =
      window.setTimeout(
        () => controller.abort(),
        timeoutMs
      );

    try {
      const response = await fetch(
        url,
        {
          cache: "no-store",
          mode: "cors",
          signal: controller.signal,
          headers: {
            Accept: "application/json"
          }
        }
      );

      if (!response.ok) {
        throw new Error(
          `${response.status} ${response.statusText}`
        );
      }

      const value = await response.json();

      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value)
      ) {
        throw new TypeError(
          "Catalog response is not a JSON object."
        );
      }

      return value;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function delay(milliseconds) {
    return new Promise(resolve =>
      window.setTimeout(
        resolve,
        milliseconds
      )
    );
  }

  async function probeScannerUrl(
    catalogUrl
  ) {
    const configured =
      Boolean(configuredCatalogUrl());

    if (!configured) {
      const healthUrl =
        healthUrlFor(catalogUrl);

      if (!healthUrl) {
        throw new Error(
          "Invalid scanner URL."
        );
      }

      const health = await fetchJson(
        healthUrl,
        PROBE_TIMEOUT_MS
      );

      if (
        health.ok !== true ||
        health.catalogReady !== true
      ) {
        throw new Error(
          "Scanner is running but its current-process catalog scan is not ready yet."
        );
      }
    }

    const raw = await fetchJson(
      catalogUrl,
      CATALOG_FETCH_TIMEOUT_MS
    );

    return {
      raw,
      url: catalogUrl
    };
  }

  async function tryScannerCatalog(
    retryDelays = [0]
  ) {
    const urls = scannerUrls();

    for (const retryDelay of retryDelays) {
      if (retryDelay > 0) {
        await delay(retryDelay);
      }

      const candidates =
        await Promise.all(
          urls.map(async url => {
            try {
              return await probeScannerUrl(
                url
              );
            } catch {
              return null;
            }
          })
        );

      const live = candidates.find(
        Boolean
      );

      if (live) {
        return live;
      }
    }

    return null;
  }

  function openCatalogCache() {
    return new Promise(
      (resolve, reject) => {
        if (!window.indexedDB) {
          reject(
            new Error(
              "IndexedDB is unavailable."
            )
          );
          return;
        }

        const request =
          window.indexedDB.open(
            CACHE_DATABASE_NAME,
            CACHE_DATABASE_VERSION
          );

        request.onupgradeneeded =
          () => {
            const database =
              request.result;

            if (
              !database.objectStoreNames
                .contains(
                  CACHE_STORE_NAME
                )
            ) {
              database.createObjectStore(
                CACHE_STORE_NAME,
                { keyPath: "id" }
              );
            }
          };

        request.onsuccess =
          () => resolve(
            request.result
          );
        request.onerror =
          () => reject(
            request.error ||
            new Error(
              "Catalog cache could not be opened."
            )
          );
        request.onblocked =
          () => reject(
            new Error(
              "Catalog cache upgrade is blocked."
            )
          );
      }
    );
  }

  async function readCachedLiveCatalog() {
    let database;

    try {
      database =
        await openCatalogCache();

      return await new Promise(
        (resolve, reject) => {
          const transaction =
            database.transaction(
              CACHE_STORE_NAME,
              "readonly"
            );
          const request =
            transaction
              .objectStore(
                CACHE_STORE_NAME
              )
              .get(CACHE_RECORD_KEY);

          request.onsuccess = () => {
            const record =
              request.result;
            const raw = record?.catalog;

            resolve(
              raw &&
              typeof raw === "object" &&
              !Array.isArray(raw)
                ? record
                : null
            );
          };
          request.onerror = () =>
            reject(
              request.error ||
              new Error(
                "Cached catalog could not be read."
              )
            );
        }
      );
    } catch (error) {
      console.debug(
        "No cached live Resonite API catalog is available.",
        error
      );
      return null;
    } finally {
      database?.close?.();
    }
  }

  async function writeCachedLiveCatalog(
    raw,
    sourceUrl
  ) {
    let database;

    try {
      database =
        await openCatalogCache();

      await new Promise(
        (resolve, reject) => {
          const transaction =
            database.transaction(
              CACHE_STORE_NAME,
              "readwrite"
            );

          transaction.objectStore(
            CACHE_STORE_NAME
          ).put({
            id: CACHE_RECORD_KEY,
            savedAtUtc:
              new Date().toISOString(),
            sourceUrl,
            catalog: raw
          });

          transaction.oncomplete =
            () => resolve(true);
          transaction.onerror =
            () => reject(
              transaction.error ||
              new Error(
                "Live catalog could not be cached."
              )
            );
          transaction.onabort =
            () => reject(
              transaction.error ||
              new Error(
                "Live catalog cache transaction was aborted."
              )
            );
        }
      );
    } catch (error) {
      console.warn(
        "The live Resonite API catalog could not be saved in IndexedDB.",
        error
      );
    } finally {
      database?.close?.();
    }
  }

  async function loadCatalog() {
    // Read the browser cache in parallel with one fast live probe. This keeps
    // the builder responsive when Resonite is closed, while still preferring
    // a scanner that is already ready.
    const cachedPromise =
      readCachedLiveCatalog();
    const live =
      await tryScannerCatalog([0]);

    if (live) {
      void writeCachedLiveCatalog(
        live.raw,
        live.url
      );

      return installCatalog(
        normalizeCatalog(
          live.raw,
          "scanner",
          live.url
        )
      );
    }

    const cached =
      await cachedPromise;

    if (cached) {
      return installCatalog(
        normalizeCatalog(
          cached.catalog,
          "scanner-cache",
          cached.sourceUrl || ""
        )
      );
    }

    try {
      const fallback =
        await fetchJson(
          fallbackUrl,
          FALLBACK_FETCH_TIMEOUT_MS
        );

      return installCatalog(
        normalizeCatalog(
          fallback,
          "fallback-file",
          fallbackUrl
        )
      );
    } catch (error) {
      console.warn(
        "The packaged Resonite API fallback catalog could not be loaded. The embedded minimal catalog is used.",
        error
      );

      return installCatalog(
        normalizeCatalog(
          minimalFallback,
          "fallback-embedded",
          ""
        )
      );
    }
  }

  function loadScript(
    url,
    marker,
    displayName
  ) {
    return new Promise(
      (resolve, reject) => {
        const attribute =
          `data-rml-${marker}`;
        const existing =
          document.querySelector(
            `script[${attribute}="true"]`
          );

        if (existing) {
          if (
            existing.dataset.loaded ===
            "true"
          ) {
            resolve(true);
            return;
          }

          existing.addEventListener(
            "load",
            () => resolve(true),
            { once: true }
          );
          existing.addEventListener(
            "error",
            () => reject(
              new Error(
                `${displayName} could not be loaded.`
              )
            ),
            { once: true }
          );
          return;
        }

        const script =
          document.createElement(
            "script"
          );
        script.src = url;
        script.async = false;
        script.setAttribute(
          attribute,
          "true"
        );
        script.addEventListener(
          "load",
          () => {
            script.dataset.loaded =
              "true";
            resolve(true);
          },
          { once: true }
        );
        script.addEventListener(
          "error",
          () => reject(
            new Error(
              `Could not load ${displayName} from ${url}`
            )
          ),
          { once: true }
        );
        document.body.appendChild(
          script
        );
      }
    );
  }

  function catalogIdentity(catalog) {
    return String(
      catalog?.catalogFingerprint ||
      catalog?.assemblyFingerprint ||
      catalog?.engineVersion ||
      "unknown"
    );
  }

  function startCatalogPolling(
    initialCatalog
  ) {
    let currentIdentity =
      catalogIdentity(initialCatalog);
    let currentSource =
      initialCatalog.catalogSource;
    let pollActive = false;

    const poll = async () => {
      if (pollActive) {
        return;
      }

      pollActive = true;

      try {
        const live =
          await tryScannerCatalog([0]);

        if (!live) {
          return;
        }

        const normalized =
          normalizeCatalog(
            live.raw,
            "scanner",
            live.url
          );
        const nextIdentity =
          catalogIdentity(normalized);

        if (
          currentSource !== "scanner" ||
          nextIdentity !==
            currentIdentity
        ) {
          void writeCachedLiveCatalog(
            live.raw,
            live.url
          );

          const status =
            document.getElementById(
              "api-catalog-state"
            );

          if (status) {
            status.dataset.source =
              "updating";
            status.textContent =
              `Resonite API ${normalized.engineVersion} · catalog updated · reloading…`;
          }

          currentIdentity =
            nextIdentity;
          currentSource = "scanner";
          window.setTimeout(
            () =>
              window.location.reload(),
            350
          );
        }
      } catch (error) {
        console.debug(
          "Resonite API catalog poll failed.",
          error
        );
      } finally {
        pollActive = false;
      }
    };

    // A scanner that is still completing its startup scan is picked up soon,
    // rather than making the initial builder render wait for several retries.
    for (const delayMs of [1500, 4000, 8000]) {
      window.setTimeout(
        poll,
        delayMs
      );
    }

    window.setInterval(
      poll,
      POLL_INTERVAL_MS
    );
  }

  const catalogReady =
    loadCatalog();

  const modNodesReady =
    Promise.all([
      catalogReady,
      registryReady
    ])
      .then(async () => {
        await loadScript(
          modNodesUrl,
          "mod-nodes",
          "mod_nodes.js"
        );
        await loadScript(
          apiNodesUrl,
          "api-nodes",
          "api_nodes.js"
        );
        return true;
      })
      .catch(error => {
        console.error(
          "The typed Resonite API nodes could not be initialized.",
          error
        );
        throw error;
      });

  Object.defineProperty(
    window,
    "RMLCatalogReady",
    {
      value: catalogReady,
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  Object.defineProperty(
    window,
    "RMLModNodesReady",
    {
      value: modNodesReady,
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  catalogReady
    .then(startCatalogPolling)
    .catch(() => {});

  Object.defineProperty(
    window,
    "RMLCatalogScannerPorts",
    {
      value: Object.freeze({
        first: DEFAULT_PORT_FIRST,
        last: DEFAULT_PORT_LAST,
        healthPath: HEALTH_PATH,
        catalogPath: CATALOG_PATH
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();