(() => {
  "use strict";

  const LOADER_VERSION = 11;
  const DEFAULT_PORT_FIRST = 42719;
  const DEFAULT_PORT_LAST = 42729;
  const CATALOG_PATH = "/resonite_api_catalog.json";
  const HEALTH_PATH = "/health";
  const POLL_INTERVAL_MS = 30000;
  const PROBE_TIMEOUT_MS = 900;
  const CATALOG_FETCH_TIMEOUT_MS = 45000;
  const CACHE_DATABASE_NAME =
    "rml-resonite-api-catalog";
  const CACHE_DATABASE_VERSION = 1;
  const CACHE_STORE_NAME = "catalogs";
  const CACHE_RECORD_KEY = "latest-live";

  const scriptUrl =
    document.currentScript?.src ||
    window.location.href;
  const modNodesUrl = new URL(
    "mod_nodes.js?v=20",
    scriptUrl
  ).href;
  const apiNodesUrl = new URL(
    "api_nodes.js?v=4",
    scriptUrl
  ).href;


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
    if (
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw)
    ) {
      throw new TypeError(
        "Resonite API catalog is not a JSON object."
      );
    }

    const value = raw;

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
      components: Object.freeze(components),
      materials: Object.freeze(materials),
      commonMaterials: Object.freeze(commonMaterials),
      meshes: Object.freeze(meshes),
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

  let scannerOnline = false;
  let scannerChecking = false;
  let scannerPollTimer = 0;
  let scannerCheckPromise = null;

  function statusCatalog() {
    return (
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null
    );
  }

  function updateStatus(
    catalog = statusCatalog(),
    options = {}
  ) {
    const element =
      document.getElementById(
        "api-catalog-state"
      );

    if (!element) {
      return;
    }

    const checking =
      options.checking === true ||
      scannerChecking === true;
    const online =
      options.online === true ||
      (
        options.online !== false &&
        scannerOnline === true
      );

    const count =
      catalog?.components?.length || 0;
    const version =
      String(
        catalog?.engineVersion ||
        "unknown"
      );

    if (checking) {
      element.dataset.source = "updating";
      element.textContent =
        catalog
          ? `Resonite API ${version} · checking… · ${count} components`
          : "Resonite API · checking…";
      element.title =
        "Checking the local Resonite scanner. The cached catalog remains in use unless a newer catalog is found.";
      return;
    }

    if (online) {
      element.dataset.source = "scanner";
      element.textContent =
        catalog
          ? `Resonite API ${version} · live · ${count} components`
          : "Resonite API · live";
      element.title =
        "The local Resonite scanner is online. The builder continues using the cached catalog when it already matches the live catalog. Click to check and synchronize now.";
      return;
    }

    if (catalog) {
      element.dataset.source = "cache";
      element.textContent =
        `Resonite API ${version} · cached · ${count} components`;
      element.title =
        "The local Resonite scanner is offline. The last synchronized catalog is being used from this browser's IndexedDB cache. Click to reconnect and synchronize.";
      return;
    }

    element.dataset.source = "unavailable";
    element.textContent =
      "Resonite API · unavailable";
    element.title =
      "No live scanner connection or cached Resonite API catalog is available. Click to reconnect.";
  }

  function updateUnavailableStatus(
    message = "No live scanner connection or cached Resonite API catalog is available. Click to reconnect."
  ) {
    scannerOnline = false;
    scannerChecking = false;

    const element =
      document.getElementById(
        "api-catalog-state"
      );

    if (!element) {
      return;
    }

    element.dataset.source = "unavailable";
    element.textContent =
      "Resonite API · unavailable";
    element.title = message;
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
    const cached =
      await readCachedLiveCatalog();

    if (cached) {
      return installCatalog(
        normalizeCatalog(
          cached.catalog,
          "scanner-cache",
          cached.sourceUrl || ""
        )
      );
    }

    scannerChecking = true;
    updateStatus(null, {
      checking: true,
      online: false
    });

    const live =
      await tryScannerCatalog([0]);

    scannerChecking = false;

    if (live) {
      scannerOnline = true;

      await writeCachedLiveCatalog(
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

    scannerOnline = false;
    updateUnavailableStatus();
    return null;
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

  function scheduleScannerStatusCheck(
    delayMs = POLL_INTERVAL_MS
  ) {
    window.clearTimeout(
      scannerPollTimer
    );

    scannerPollTimer =
      window.setTimeout(
        () => {
          void synchronizeScannerStatus({
            showChecking:
              !scannerOnline,
            reloadOnChange: true
          });
        },
        Math.max(
          1000,
          Number(delayMs) ||
            POLL_INTERVAL_MS
        )
      );
  }

  async function synchronizeScannerStatus(
    options = {}
  ) {
    if (scannerCheckPromise) {
      return scannerCheckPromise;
    }

    const showChecking =
      options.showChecking === true;
    const reloadOnChange =
      options.reloadOnChange !== false;

    scannerCheckPromise =
      (async () => {
        if (showChecking) {
          scannerChecking = true;
          updateStatus(
            statusCatalog(),
            {
              checking: true,
              online: scannerOnline
            }
          );
        }

        const live =
          await tryScannerCatalog([0]);

        scannerChecking = false;

        if (!live) {
          scannerOnline = false;
          updateStatus(
            statusCatalog(),
            {
              checking: false,
              online: false
            }
          );
          return false;
        }

        scannerOnline = true;

        const normalized =
          normalizeCatalog(
            live.raw,
            "scanner",
            live.url
          );

        const current =
          statusCatalog();
        const currentIdentity =
          catalogIdentity(current);
        const nextIdentity =
          catalogIdentity(normalized);

        if (
          !current ||
          nextIdentity !==
            currentIdentity
        ) {
          await writeCachedLiveCatalog(
            live.raw,
            live.url
          );

          installCatalog(normalized);

          if (
            current &&
            reloadOnChange
          ) {
            window.setTimeout(
              () =>
                window.location.reload(),
              250
            );
          }

          return true;
        }

        updateStatus(
          current,
          {
            checking: false,
            online: true
          }
        );

        return true;
      })()
        .catch(error => {
          scannerChecking = false;
          scannerOnline = false;

          updateStatus(
            statusCatalog(),
            {
              checking: false,
              online: false
            }
          );

          console.debug(
            "Resonite scanner status check failed.",
            error
          );

          return false;
        })
        .finally(() => {
          scannerCheckPromise = null;
          scheduleScannerStatusCheck();
        });

    return scannerCheckPromise;
  }

  async function refreshLiveCatalogManually() {
    return synchronizeScannerStatus({
      showChecking: true,
      reloadOnChange: true
    });
  }

  function installManualScannerRefresh() {
    const status =
      document.getElementById(
        "api-catalog-state"
      );

    if (!status || status.dataset.manualScannerBound === "true") {
      return;
    }

    status.dataset.manualScannerBound = "true";
    status.tabIndex = 0;
    status.setAttribute("role", "button");

    const run = () => {
      void refreshLiveCatalogManually();
    };

    status.addEventListener("click", run);
    status.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        run();
      }
    });
  }

  const catalogReady =
    loadCatalog();

  const modNodesReady =
    Promise.all([
      catalogReady,
      registryReady
    ])
      .then(async ([catalog]) => {
        await loadScript(
          modNodesUrl,
          "mod-nodes",
          "mod_nodes.js"
        );

        if (catalog) {
          await loadScript(
            apiNodesUrl,
            "api-nodes",
            "api_nodes.js"
          );
        } else {
          console.info(
            "RML API catalog nodes are disabled until a live or cached catalog is available."
          );
        }

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
    .then(() => {
      installManualScannerRefresh();

      void synchronizeScannerStatus({
        showChecking: true,
        reloadOnChange: true
      });
    })
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