(() => {
  "use strict";

  const LOADER_VERSION = 75;
  const DEFAULT_PORT_FIRST = 42719;
  const DEFAULT_PORT_LAST = 42729;
  const CATALOG_PATH = "/resonite_api_catalog.json";
  const HEALTH_PATH = "/health";
  const BUILDER_SCANNER_STATUS_PATH =
    "/rml-scanner-status";
  const BUILDER_SCANNER_CATALOG_PATH =
    "/rml-scanner-catalog";
  const CATALOG_FETCH_TIMEOUT_MS = 0;
  const CACHE_DATABASE_NAME =
    "rml-resonite-api-catalog";
  const CACHE_DATABASE_VERSION = 1;
  const CACHE_STORE_NAME = "catalogs";
  const CACHE_RECORD_KEY = "latest-live";
  const KNOWN_SCANNER_URL_STORAGE_KEY =
    "rml-resonite-api-last-scanner-url";
  const REQUIRED_CATALOG_SCHEMA_VERSION = 8;
  const REQUIRED_METHOD_IDENTITY_VERSION = 2;
  const REQUIRED_SCANNER_FINGERPRINT_VERSION = 1;
  const SUPPORTED_RELOAD_SAFETY_READER_VERSION = 1;
  const REQUIRED_SCANNER_FINGERPRINT_ALGORITHM =
    "sha256-canonical-semantic-catalog-v1";

  const scriptUrl =
    document.currentScript?.src ||
    window.location.href;
  const modNodesUrl = new URL(
    "mod_nodes.js?v=794-shared-loader-runtime",
    scriptUrl
  ).href;
  const visualCSharpUrl = new URL(
    "../compiler/visual_csharp.js?v=82-source-comment-pruning-v776",
    scriptUrl
  ).href;
  const apiNodesUrl = new URL(
    "api_nodes.js?v=794-shared-loader-runtime",
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


  function stableCatalogHash(value) {
    return window.RMLCrypto.stableHash64(
      value
    );
  }

  function scannerFingerprintContract(raw) {
    const fingerprint = String(
      raw?.catalogFingerprint || ""
    ).trim().toLowerCase();
    const version = Number(
      raw?.catalogFingerprintVersion
    );
    const algorithm = String(
      raw?.catalogFingerprintAlgorithm || ""
    ).trim();
    const schemaVersion = Number(
      raw?.schemaVersion
    );
    const scannerVersion = String(
      raw?.scannerVersion || ""
    ).trim();
    const methodIdentityVersion = Number(
      raw?.methodIdentityVersion
    );
    const methodIdentityAlgorithm = String(
      raw?.methodIdentityAlgorithm || ""
    ).trim();
    const reloadSafetyContractVersion =
      Number(
        raw?.reloadSafetyContractVersion
      );
    const reloadSafetyPolicy = String(
      raw?.reloadSafetyPolicy || ""
    ).trim();
    const reloadSafetyMinimumReaderVersion =
      Number(
        raw?.reloadSafetyMinimumReaderVersion
      );
    const reloadSafetyMaximumReaderVersion =
      Number(
        raw?.reloadSafetyMaximumReaderVersion
      );
    const reloadSafetyCompatible =
      Number.isInteger(
        reloadSafetyContractVersion
      ) &&
      reloadSafetyContractVersion > 0 &&
      Boolean(reloadSafetyPolicy) &&
      Number.isInteger(
        reloadSafetyMinimumReaderVersion
      ) &&
      Number.isInteger(
        reloadSafetyMaximumReaderVersion
      ) &&
      reloadSafetyMinimumReaderVersion <=
        SUPPORTED_RELOAD_SAFETY_READER_VERSION &&
      reloadSafetyMaximumReaderVersion >=
        SUPPORTED_RELOAD_SAFETY_READER_VERSION;

    if (
      !/^[a-f0-9]{64}$/.test(fingerprint) ||
      version !==
        REQUIRED_SCANNER_FINGERPRINT_VERSION ||
      algorithm !==
        REQUIRED_SCANNER_FINGERPRINT_ALGORITHM ||
      !Number.isInteger(schemaVersion) ||
      schemaVersion <
        REQUIRED_CATALOG_SCHEMA_VERSION ||
      !scannerVersion ||
      !Number.isInteger(
        methodIdentityVersion
      ) ||
      methodIdentityVersion <
        REQUIRED_METHOD_IDENTITY_VERSION ||
      !methodIdentityAlgorithm
    ) {
      return null;
    }

    return Object.freeze({
      fingerprint,
      version,
      algorithm,
      schemaVersion,
      scannerVersion,
      methodIdentityVersion,
      methodIdentityAlgorithm,
      reloadSafetyContractVersion,
      reloadSafetyPolicy,
      reloadSafetyMinimumReaderVersion,
      reloadSafetyMaximumReaderVersion,
      reloadSafetyCompatible
    });
  }

  function scannerCatalogFingerprint(raw) {
    return scannerFingerprintContract(raw)
      ?.fingerprint || "";
  }

  function legacyScannerFingerprint(raw) {
    const fingerprint = String(
      raw?.catalogFingerprint ||
      raw?.fingerprint ||
      raw?.assemblyFingerprint ||
      ""
    ).trim().toLowerCase();

    return /^[a-f0-9]{64}$/.test(fingerprint)
      ? fingerprint
      : "";
  }

  function legacyCacheFingerprint(raw) {
    return legacyScannerFingerprint(raw);
  }

  function cachedCatalogFingerprint(raw) {
    return scannerCatalogFingerprint(raw) ||
      legacyCacheFingerprint(raw);
  }

  function requireScannerFingerprintContract(
    raw,
    label = "Resonite API catalog"
  ) {
    const contract =
      scannerFingerprintContract(raw);

    if (!contract) {
      throw new Error(
        `${label} does not provide the required scanner catalog fingerprint contract v${REQUIRED_SCANNER_FINGERPRINT_VERSION} (${REQUIRED_SCANNER_FINGERPRINT_ALGORITHM}, schema ${REQUIRED_CATALOG_SCHEMA_VERSION}+).`
      );
    }

    return contract;
  }

  function bridgeCatalogPayload(raw) {
    const candidates = [
      raw?.catalog,
      raw?.data?.catalog,
      raw?.data,
      raw?.payload?.catalog,
      raw?.payload,
      raw?.result?.catalog,
      raw?.result,
      raw
    ];

    for (const candidateValue of candidates) {
      let candidate = candidateValue;

      if (typeof candidate === "string") {
        try {
          candidate = JSON.parse(candidate);
        } catch {
          continue;
        }
      }

      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      ) {
        continue;
      }

      if (
        Array.isArray(candidate.types) ||
        Number(candidate.schemaVersion) > 0 ||
        Boolean(candidate.engineVersion)
      ) {
        return candidate;
      }
    }

    return raw;
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
    const fingerprintContract =
      scannerFingerprintContract(value);
    const legacyFingerprint =
      source === "scanner-cache" ||
      source === "scanner-legacy"
        ? legacyCacheFingerprint(value)
        : "";
    const fingerprint =
      fingerprintContract?.fingerprint ||
      legacyFingerprint;

    if (!fingerprint) {
      requireScannerFingerprintContract(
        value
      );
    }

    return Object.freeze({
      ...value,
      schemaVersion:
        Number(value.schemaVersion) || 3,
      contractIdentityVersion:
        Number(value.contractIdentityVersion) || 1,
      contractRevision:
        String(
          value.contractRevision ||
          fingerprint
        ),
      loaderVersion: LOADER_VERSION,
      catalogSource: source,
      catalogSourceUrl: sourceUrl,
      catalogFingerprint:
        fingerprint,
      catalogFingerprintVersion:
        fingerprintContract?.version || 0,
      catalogFingerprintAlgorithm:
        fingerprintContract?.algorithm ||
        "legacy-scanner-cache",
      reloadSafetyContractVersion:
        fingerprintContract
          ?.reloadSafetyContractVersion || 0,
      reloadSafetyPolicy:
        fingerprintContract
          ?.reloadSafetyPolicy || "unknown",
      reloadSafetyMinimumReaderVersion:
        fingerprintContract
          ?.reloadSafetyMinimumReaderVersion || 0,
      reloadSafetyMaximumReaderVersion:
        fingerprintContract
          ?.reloadSafetyMaximumReaderVersion || 0,
      reloadSafetyCompatible:
        fingerprintContract
          ?.reloadSafetyCompatible === true,
      scannerFingerprintSupplied: true,
      scannerFingerprintVerified:
        Boolean(fingerprintContract),
      legacyCacheFallback:
        !fingerprintContract,
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

  function catalogContractType(value) {
    return String(value || "")
      .replace(/^global::/, "")
      .replace(/\s+/g, "")
      .replace(/&$/, "");
  }

  function catalogParameterShape(parameter, index) {
    return {
      position: Math.max(
        0,
        Number(parameter?.position) || index
      ),
      type: catalogContractType(
        parameter?.elementType ||
        parameter?.type ||
        "System.Object"
      ),
      isByRef:
        parameter?.isByRef === true ||
        parameter?.isOut === true,
      isOut:
        parameter?.isOut === true,
      isOptional:
        parameter?.isOptional === true
    };
  }

  function catalogSemanticMembers(catalog) {
    const members = new Map();
    const add = (
      kind,
      ownerType,
      memberName,
      parameters,
      returnType,
      isStatic,
      genericArity = 0,
      suppliedStableContractId = ""
    ) => {
      const parameterShape =
        (Array.isArray(parameters)
          ? parameters
          : []).map(
            catalogParameterShape
          );
      const identity = JSON.stringify({
        kind,
        ownerType:
          catalogContractType(ownerType),
        memberName:
          String(memberName || ""),
        isStatic: isStatic === true,
        genericArity: Math.max(
          0,
          Number(genericArity) || 0
        )
      });
      const shape = JSON.stringify({
        parameterShape,
        returnType:
          catalogContractType(
            returnType || "System.Void"
          )
      });
      members.set(identity, {
        identity,
        stableContractId:
          String(
            suppliedStableContractId ||
            `contract.${stableCatalogHash(identity)}`
          ),
        shape,
        kind,
        ownerType:
          catalogContractType(ownerType),
        memberName:
          String(memberName || "")
      });
    };

    for (const type of
      Array.isArray(catalog?.types)
        ? catalog.types
        : []) {
      const owner = type?.fullName;
      if (!owner) continue;
      add(
        "type",
        owner,
        "",
        [],
        owner,
        true,
        0,
        type.stableContractId
      );
      for (const constructor of
        type.constructors || []) {
        add(
          "constructor",
          owner,
          ".ctor",
          constructor?.parameters,
          owner,
          false,
          0,
          constructor?.stableContractId
        );
      }
      for (const method of
        type.methods || []) {
        add(
          "method",
          owner,
          method?.name,
          method?.parameters,
          method?.returnType,
          method?.isStatic,
          (method?.genericParameters || []).length,
          method?.stableContractId
        );
      }
      for (const property of
        type.properties || []) {
        if (property?.canRead) {
          add(
            "property-get",
            owner,
            property.name,
            property.indexParameters,
            property.type,
            property.isStatic,
            0,
            property.readContractId
          );
        }
        if (property?.canWrite) {
          add(
            "property-set",
            owner,
            property.name,
            [
              ...(property.indexParameters || []),
              {
                position:
                  (property.indexParameters || []).length,
                type: property.type
              }
            ],
            "System.Void",
            property.isStatic,
            0,
            property.writeContractId
          );
        }
      }
      for (const field of
        type.fields || []) {
        add(
          "field-get",
          owner,
          field?.name,
          [],
          field?.type,
          field?.isStatic,
          0,
          field?.readContractId
        );
        if (!field?.isReadOnly && !field?.isConst) {
          add(
            "field-set",
            owner,
            field?.name,
            [{ position: 0, type: field?.type }],
            "System.Void",
            field?.isStatic,
            0,
            field?.writeContractId
          );
        }
      }
      for (const eventInfo of
        type.events || []) {
        add(
          "event",
          owner,
          eventInfo?.name,
          [],
          eventInfo?.handlerType ||
            "System.Delegate",
          eventInfo?.isStatic,
          0,
          eventInfo?.stableContractId
        );
      }
    }

    return members;
  }

  function compareApiCatalogs(
    previous,
    current
  ) {
    const before =
      catalogSemanticMembers(previous);
    const after =
      catalogSemanticMembers(current);
    const added = [];
    const removed = [];
    const changed = [];

    for (const [identity, member] of before) {
      const replacement = after.get(identity);
      if (!replacement) {
        removed.push(member);
      } else if (replacement.shape !== member.shape) {
        changed.push({
          before: member,
          after: replacement
        });
      }
    }
    for (const [identity, member] of after) {
      if (!before.has(identity)) {
        added.push(member);
      }
    }

    return Object.freeze({
      compatible:
        removed.length === 0 &&
        changed.length === 0,
      previousEngineVersion: String(
        previous?.engineVersion || "unknown"
      ),
      currentEngineVersion: String(
        current?.engineVersion || "unknown"
      ),
      beforeCount: before.size,
      afterCount: after.size,
      added: Object.freeze(added),
      removed: Object.freeze(removed),
      changed: Object.freeze(changed)
    });
  }

  Object.defineProperty(
    window,
    "RMLCatalogCompatibility",
    {
      value: Object.freeze({
        version: 1,
        compare: compareApiCatalogs
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  function installCatalog(catalog) {
    const previous =
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null;
    const semanticIdentityMatches =
      Boolean(
        previous &&
        catalogIdentity(previous) &&
        catalogIdentity(previous) ===
          catalogIdentity(catalog) &&
        String(
          previous.engineVersion || ""
        ) ===
          String(
            catalog?.engineVersion || ""
          )
      );
    const compatibility = previous
      ? semanticIdentityMatches
        ? Object.freeze({
            compatible: true,
            reusedFingerprint: true,
            previousEngineVersion:
              String(
                previous.engineVersion ||
                "unknown"
              ),
            currentEngineVersion:
              String(
                catalog?.engineVersion ||
                "unknown"
              ),
            beforeCount: 0,
            afterCount: 0,
            added: Object.freeze([]),
            removed: Object.freeze([]),
            changed: Object.freeze([])
          })
        : compareApiCatalogs(
            previous,
            catalog
          )
      : null;

    Object.defineProperty(
      window,
      "RMLCatalogDiffReport",
      {
        value: compatibility,
        writable: false,
        enumerable: true,
        configurable: true
      }
    );
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

    if (compatibility) {
      document.dispatchEvent(
        new CustomEvent(
          "rml-catalog:compatibility",
          {
            detail: compatibility
          }
        )
      );
    }

    return catalog;
  }

  let scannerCheckPromise = null;
  let scannerCheckGeneration = -1;
  let cachedCatalogRecord = null;
  let lastScannerFingerprintSync =
    Object.freeze({
      liveReached: false,
      fingerprintMatchedCache: false,
      cacheUpdatedFromLive: false,
      cacheFallback: false,
      fingerprint: ""
    });

  function statusCatalog() {
    return (
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null
    );
  }

  // The RuntimeBridge owns the existing Cached/Live badge. A cache install,
  // factory rebuild or catalog error must never override transport state.
  function updateStatus() { window.RMLRuntimeBridge?.renderStatus?.(); }
  function updateUnavailableStatus() { updateStatus(); }

  function safeLocalStorageValue(key) {
    try {
      return window.localStorage
        ?.getItem(key) || "";
    } catch {
      return "";
    }
  }

  function setSafeLocalStorageValue(
    key,
    value
  ) {
    try {
      window.localStorage?.setItem(
        key,
        String(value || "")
      );
    } catch {
    }
  }

  function rememberedScannerCatalogUrl() {
    return loopbackScannerCatalogUrl(
      safeLocalStorageValue(
        KNOWN_SCANNER_URL_STORAGE_KEY
      )
    );
  }

  function rememberScannerCatalogUrl(url) {
    const candidate =
      loopbackScannerCatalogUrl(url);

    if (!candidate) {
      return;
    }

    setSafeLocalStorageValue(
      KNOWN_SCANNER_URL_STORAGE_KEY,
      candidate
    );
  }

  async function fetchJson(url, timeoutMs, signal = null) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    const timeout = Number(timeoutMs) > 0
      ? window.setTimeout(abort, Number(timeoutMs)) : 0;
    try {
      const response = await fetch(url, { cache: "no-store", mode: "cors",
        credentials: "omit", redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const value = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Catalog response is not a JSON object.");
      }
      return value;
    } finally {
      signal?.removeEventListener("abort", abort);
      if (timeout) window.clearTimeout(timeout);
    }
  }

  function loopbackScannerCatalogUrl(
    value
  ) {
    try {
      const url = new URL(
        String(value || "").trim()
      );
      const hostname = url.hostname
        .toLowerCase()
        .replace(/^\[|\]$/g, "");
      const port = Number(url.port);

      if (
        url.protocol !== "http:" ||
        (
          hostname !== "127.0.0.1" &&
          hostname !== "localhost" &&
          hostname !== "::1"
        ) ||
        !Number.isInteger(port) ||
        port < DEFAULT_PORT_FIRST ||
        port > DEFAULT_PORT_LAST ||
        url.pathname !== CATALOG_PATH
      ) {
        return "";
      }

      url.search = "";
      url.hash = "";
      return url.href;
    } catch {
      return "";
    }
  }

  async function loadAndVerifyLiveCatalog(
    live
  ) {
    const fetched = live?.raw ||
      await fetchJson(
        live.catalogFetchUrl || live.url,
        CATALOG_FETCH_TIMEOUT_MS,
        live.signal
      );
    const raw =
      bridgeCatalogPayload(fetched);
    const contract =
      scannerFingerprintContract(raw);
    const fingerprint =
      live?.legacy === true
        ? legacyScannerFingerprint(raw)
        : contract?.fingerprint || "";

    if (!fingerprint) {
      throw new Error(
        live?.legacy === true
          ? "The legacy Live scanner catalog does not contain its scanner fingerprint."
          : `The Live scanner catalog does not provide fingerprint contract v${REQUIRED_SCANNER_FINGERPRINT_VERSION}.`
      );
    }

    if (
      fingerprint !==
        String(live?.fingerprint || "")
          .trim()
          .toLowerCase()
    ) {
      throw new Error(
        "The Live scanner catalog changed while it was being downloaded. Its scanner fingerprint no longer matches the status response."
      );
    }

    return raw;
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

            const valid = Boolean(
              raw &&
              typeof raw === "object" &&
              !Array.isArray(raw) &&
              cachedCatalogFingerprint(raw) &&
              String(
                record?.fingerprint || ""
              ).trim().toLowerCase() ===
                cachedCatalogFingerprint(raw)
            );
            const resolved = valid
              ? {
                  ...record,
                  fingerprint:
                    cachedCatalogFingerprint(
                      raw
                    )
                }
              : null;

            if (resolved) {
              cachedCatalogRecord =
                resolved;
            }

            resolve(resolved);
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
    const fingerprint =
      scannerCatalogFingerprint(raw) ||
      legacyScannerFingerprint(raw);

    if (!fingerprint) {
      throw new Error(
        "Live scanner catalog has no cacheable scanner fingerprint."
      );
    }
    const record = {
      id: CACHE_RECORD_KEY,
      savedAtUtc:
        new Date().toISOString(),
      sourceUrl,
      fingerprint,
      catalog: raw
    };

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
          ).put(record);

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
      cachedCatalogRecord = record;
      return true;
    } catch (error) {
      console.warn(
        "The live Resonite API catalog could not be saved in IndexedDB.",
        error
      );
      return false;
    } finally {
      database?.close?.();
    }
  }

  async function loadCatalog() {

    

    const cached =
      await readCachedLiveCatalog();

    if (cached) {
      cachedCatalogRecord = cached;


      return installCatalog(
        normalizeCatalog(
          cached.catalog,
          "scanner-cache",
          cached.sourceUrl || ""
        )
      );
    }

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
      catalog?.catalogFingerprint || ""
    ).trim();
  }

  function promoteFactoryReportForCatalog(
    catalog,
    {
      liveFingerprintVerified = false
    } = {}
  ) {
    const report =
      window.RMLApiNodeFactoryReport;

    if (
      !report ||
      report.verificationPassed !== true ||
      String(
        report.catalogFingerprint || ""
      ) !==
        String(
          catalog?.catalogFingerprint || ""
        ) ||
      String(report.engineVersion || "") !==
        String(catalog?.engineVersion || "")
    ) {
      return false;
    }

    const catalogSource =
      liveFingerprintVerified
        ? "scanner"
        : String(
            catalog?.catalogSource || ""
          );
    const liveCatalogVerified =
      liveFingerprintVerified ||
      catalogSource === "scanner";
    if (
      String(report.catalogSource || "") ===
        catalogSource &&
      report.liveCatalogVerified ===
        liveCatalogVerified
    ) {
      return true;
    }

    const nextReport = Object.freeze({
      ...report,
      catalogSource,
      liveCatalogVerified,
      catalogDataSource:
        String(
          catalog?.catalogSource || ""
        )
    });
    window.RMLApiNodeFactoryReport =
      nextReport;
    window.dispatchEvent(
      new CustomEvent(
        "rml-api-node-factory-ready",
        { detail: nextReport }
      )
    );
    return true;
  }

  async function ensureApiNodesLoaded() {
    await loadScript(
      apiNodesUrl,
      "api-nodes",
      "api_nodes.js"
    );

    const factoryReady =
      window.RMLApiNodeFactoryReady;

    if (
      factoryReady &&
      typeof factoryReady.then ===
        "function"
    ) {
      await factoryReady;
    }
  }

  async function activateCatalogAndFactory(
    catalog
  ) {
    const existingReport =
      window.RMLApiNodeFactoryReport;
    if (
      factoryMatchesCatalog(
        catalog,
        existingReport
      )
    ) {
      installCatalog(catalog);
      promoteFactoryReportForCatalog(
        catalog
      );
      return existingReport;
    }

    installCatalog(catalog);
    await modNodesReady;
    await ensureApiNodesLoaded();

    let report =
      window.RMLApiNodeFactoryReport;

    if (
      factoryMatchesCatalog(
        catalog,
        report
      )
    ) {
      promoteFactoryReportForCatalog(
        catalog
      );
      return report;
    }

    const controller =
      window.RMLApiNodeFactoryController;

    if (
      !controller ||
      typeof controller.rebuild !==
        "function"
    ) {
      throw new Error(
        "The API node factory cannot activate the selected catalog fingerprint."
      );
    }

    await controller.rebuild(catalog);
    report =
      window.RMLApiNodeFactoryReport;

    if (
      !factoryMatchesCatalog(
        catalog,
        report
      )
    ) {
      throw new Error(
        "The API node factory did not publish the selected catalog fingerprint."
      );
    }

    return report;
  }

  function currentScannerConnection() {
    return window.RMLRuntimeBridge?.getConnectionState?.() || { mode: "cached", generation: -1 };
  }

  function demoteLiveFactoryReport() {
    const report = window.RMLApiNodeFactoryReport;
    if (!report || report.liveCatalogVerified !== true) return;
    const next = Object.freeze({ ...report, liveCatalogVerified: false,
      catalogSource: statusCatalog()?.catalogSource || "scanner-cache" });
    window.RMLApiNodeFactoryReport = next;
    window.dispatchEvent(new CustomEvent("rml-api-node-factory-ready", { detail: next }));
  }

  async function synchronizeScannerStatus(options = {}) {
    const session = currentScannerConnection();
    // Imports and renders may use the authorized cache but never initiate a
    // scanner request. Only the Cached/Live button supplies manualSession.
    if (session.mode !== "live") return false;
    if (scannerCheckGeneration === session.generation) {
      if (scannerCheckPromise) return scannerCheckPromise;
      return lastScannerFingerprintSync.liveReached === true &&
        window.RMLApiNodeFactoryReport?.liveCatalogVerified === true;
    }
    if (!options.manualSession || options.manualSession.generation !== session.generation) {
      return false;
    }
    const signal = window.RMLRuntimeBridge.getSessionSignal();
    const assertSession = () => {
      const active = currentScannerConnection();
      if (signal?.aborted || active.mode !== "live" || active.generation !== session.generation) {
        throw new Error("Scanner session was closed.");
      }
    };
    scannerCheckGeneration = session.generation;
    const pending = Promise.resolve().then(async () => {
      try {
        assertSession();
        const fingerprintContract = scannerFingerprintContract(session.health);
        const legacyFingerprint = legacyScannerFingerprint(session.health);
        if (session.health?.catalogReady !== true || session.health?.catalogAvailable !== true ||
            (!fingerprintContract && !legacyFingerprint)) {
          throw new Error("Scanner connected, but its catalog is not ready or lacks a compatible fingerprint. The existing cache remains available.");
        }
        const live = { health: session.health,
          fingerprint: fingerprintContract?.fingerprint || legacyFingerprint,
          legacy: !fingerprintContract,
          url: `${session.scannerBaseUrl}/resonite_api_catalog.json`, signal };
        const activeBeforeSync = statusCatalog();
        let cached = cachedCatalogRecord;
        if (!cached) cached = await readCachedLiveCatalog();
        assertSession();
        const fingerprintMatchedCache =
          Boolean(
            cached?.catalog &&
            (
              live.legacy === true
                ? legacyCacheFingerprint(
                    cached.catalog
                  )
                : scannerFingerprintContract(
                    cached.catalog
                  )?.fingerprint
            ) &&
            String(live.fingerprint || "") ===
              String(
                cached.fingerprint || ""
              )
          );
        notifyCatalogGate(
          fingerprintMatchedCache
            ? options.onFingerprintMatch
            : options.onCatalogRefresh,
          {
            phase:
              fingerprintMatchedCache
                ? "fingerprint-match-cache"
                : "catalog-refresh",
            message:
              fingerprintMatchedCache
                ? "The scanner fingerprint matches the cached catalog. Reusing the existing catalog bytes."
                : "The scanner fingerprint changed. Downloading and verifying the updated catalog once."
          }
        );
        const liveRaw =
          fingerprintMatchedCache
            ? null
            : await loadAndVerifyLiveCatalog(
                live
              );
        assertSession();
        if (!fingerprintMatchedCache) {
          notifyCatalogGate(
            options.onCatalogCacheWrite,
            {
              phase: "catalog-cache-write",
              message:
                "The changed Live catalog finished downloading and passed fingerprint verification. Persisting it as the new cache snapshot now."
            }
          );
        }
        const cacheUpdatedFromLive =
          !fingerprintMatchedCache
            ? await writeCachedLiveCatalog(
                liveRaw,
                live.url
              )
            : false;
        if (
          !fingerprintMatchedCache &&
          !cacheUpdatedFromLive
        ) {
          throw new Error(
            "The changed Live catalog was verified, but its synchronized cache snapshot could not be persisted. The Builder did not activate the uncached Live payload."
          );
        }
        assertSession();
        const synchronizedRaw =
          fingerprintMatchedCache
            ? cached.catalog
            : cachedCatalogRecord.catalog;
        const activeCacheMatches =
          Boolean(
            activeBeforeSync &&
            activeBeforeSync.catalogSource ===
              "scanner-cache" &&
            catalogIdentity(
              activeBeforeSync
            ) ===
              String(
                live.fingerprint || ""
              )
          );
        const confirmedCatalog =
          activeCacheMatches
            ? activeBeforeSync
            : normalizeCatalog(
                synchronizedRaw,
                "scanner-cache",
                live.url
              );

        notifyCatalogGate(
          options.onFactoryActivation,
          {
            phase: "factory",
            message:
              fingerprintMatchedCache
                ? "Using the fingerprint-confirmed cached API contracts."
                : "The changed Live catalog is cached. Activating API contracts exclusively from that synchronized cache."
          }
        );
        await activateCatalogAndFactory(
          confirmedCatalog
        );
        assertSession();
        promoteFactoryReportForCatalog(
          confirmedCatalog,
          {
            liveFingerprintVerified: true
          }
        );

        lastScannerFingerprintSync =
          Object.freeze({
            liveReached: true,
            fingerprintMatchedCache,
            cacheUpdatedFromLive,
            cacheFallback: false,
            fingerprint:
              catalogIdentity(
                confirmedCatalog
              )
          });

        updateStatus(
          confirmedCatalog,
          {
            checking: false,
            online: true
          }
        );
        rememberScannerCatalogUrl(
          live.url
        );

        return true;
      } catch (error) {
        if (currentScannerConnection().generation === session.generation) {
          demoteLiveFactoryReport();
          lastScannerFingerprintSync = Object.freeze({ liveReached: false,
            fingerprintMatchedCache: false, cacheUpdatedFromLive: false,
            cacheFallback: true, fingerprint: String(cachedCatalogRecord?.fingerprint || ""),
            error: error?.message || String(error) });
          updateStatus();
        }
        if (options.throwOnFailure === true) throw error;
        return false;
      } finally {
        if (scannerCheckGeneration === session.generation) scannerCheckPromise = null;
      }
    });
    scannerCheckPromise = pending;
    return pending;
  }

  function normalizedRequiredApiNodes(
    options
  ) {
    const requirements = new Map();
    const add = (
      operatorId,
      inputPorts = [],
      outputPorts = [],
      apiContract = null,
      missingCatalogObject = false,
      catalogScope = "api",
      nodeParameters = {},
      nodeLabels = []
    ) => {
      const id = String(
        operatorId || ""
      ).trim();
      const hasPortableApiIdentity =
        apiContract &&
        typeof apiContract === "object" &&
        !Array.isArray(apiContract) &&
        Boolean(
          String(apiContract.ownerType || "").trim() &&
          String(apiContract.kind || "").trim()
        );

      if (
        !id.startsWith("api.") &&
        !hasPortableApiIdentity &&
        missingCatalogObject !== true
      ) {
        return;
      }

      if (!requirements.has(id)) {
        requirements.set(id, {
          operatorId: id,
          apiContract:
            apiContract &&
            typeof apiContract === "object" &&
            !Array.isArray(apiContract)
              ? apiContract
              : null,
          missingCatalogObject:
            missingCatalogObject ===
              true,
          catalogScope:
            catalogScope === "all"
              ? "all"
              : "api",
          nodeParameters:
            nodeParameters &&
            typeof nodeParameters ===
              "object" &&
            !Array.isArray(
              nodeParameters
            )
              ? structuredClone(
                  nodeParameters
                )
              : {},
          nodeLabels: new Set(),
          inputPorts: new Set(),
          outputPorts: new Set()
        });
      }

      const requirement =
        requirements.get(id);

      for (const value of
        Array.isArray(nodeLabels)
          ? nodeLabels
          : []) {
        const label = String(
          value || ""
        ).trim();
        if (label) {
          requirement.nodeLabels.add(
            label
          );
        }
      }

      for (const portId of
        Array.isArray(inputPorts)
          ? inputPorts
          : []) {
        const port =
          String(portId || "").trim();
        if (port) {
          requirement.inputPorts.add(
            port
          );
        }
      }

      for (const portId of
        Array.isArray(outputPorts)
          ? outputPorts
          : []) {
        const port =
          String(portId || "").trim();
        if (port) {
          requirement.outputPorts.add(
            port
          );
        }
      }
    };

    for (const value of
      Array.isArray(
        options?.requiredNodeIds
      )
        ? options.requiredNodeIds
        : []) {
      add(value);
    }

    for (const value of
      Array.isArray(
        options?.requiredNodes
      )
        ? options.requiredNodes
        : []) {
      add(
        value?.operatorId,
        value?.inputPorts,
        value?.outputPorts,
        value?.apiContract,
        value?.missingCatalogObject,
        value?.catalogScope,
        value?.nodeParameters,
        value?.nodeLabels
      );
    }

    return [...requirements.values()]
      .map(requirement => ({
        operatorId:
          requirement.operatorId,
        apiContract:
          requirement.apiContract,
        missingCatalogObject:
          requirement
            .missingCatalogObject === true,
        catalogScope:
          requirement.catalogScope,
        nodeParameters:
          structuredClone(
            requirement.nodeParameters ||
            {}
          ),
        nodeLabels:
          [...requirement.nodeLabels]
            .sort((left, right) =>
              left.localeCompare(right)
            ),
        inputPorts:
          [...requirement.inputPorts]
            .sort((left, right) =>
              left.localeCompare(right)
            ),
        outputPorts:
          [...requirement.outputPorts]
            .sort((left, right) =>
              left.localeCompare(right)
            )
      }))
      .sort((left, right) =>
        left.operatorId.localeCompare(
          right.operatorId
        )
      );
  }

  function factoryMatchesCatalog(
    catalog,
    report
  ) {
    return Boolean(
      catalog &&
      report &&
      report.verificationPassed === true &&
      String(
        report.catalogFingerprint || ""
      ) ===
        String(
          catalog.catalogFingerprint || ""
        ) &&
      String(report.engineVersion || "") ===
        String(catalog.engineVersion || "")
    );
  }

  function missingRequiredApiNodes(
    requiredNodes,
    catalog,
    report
  ) {
    const definitions =
      window.RMLModNodeRegistry
        ?.getNodeDefinitions?.() || {};

    return requiredNodes
      .map(requirement => {
      const id =
        requirement.operatorId;
      const definition =
        definitions[id];
      const contract =
        definition?.apiVerification;

      const contractValid = Boolean(
        definition?.catalogGenerated ===
          true &&
        contract &&
        String(contract.nodeId || "") ===
          id &&
        String(
          contract.catalogFingerprint || ""
        ) ===
          String(
            catalog?.catalogFingerprint ||
            ""
          ) &&
        String(contract.engineVersion || "") ===
          String(
            report?.engineVersion || ""
          )
      );

      if (!contractValid) {
        return {
          operatorId: id,
          missingInputs: [],
          missingOutputs: [],
          reason:
            "verified operator contract is unavailable"
        };
      }

      const inputs = new Set(
        (Array.isArray(definition.inputs)
          ? definition.inputs
          : [])
          .map(port =>
            String(port?.id || "")
          )
      );
      const outputs = new Set(
        (Array.isArray(definition.outputs)
          ? definition.outputs
          : [])
          .map(port =>
            String(port?.id || "")
          )
      );
      const missingInputs =
        requirement.inputPorts
          .filter(portId =>
            !inputs.has(portId)
          );
      const missingOutputs =
        requirement.outputPorts
          .filter(portId =>
            !outputs.has(portId)
          );

      return missingInputs.length > 0 ||
        missingOutputs.length > 0
        ? {
            operatorId: id,
            missingInputs,
            missingOutputs,
            reason:
              "referenced port is unavailable"
          }
        : null;
    })
      .filter(Boolean);
  }

  function unresolvedRequiredApiNodes(
    requiredNodes,
    reason =
      "verified operator contract is unavailable"
  ) {
    return requiredNodes.map(
      requirement => ({
        operatorId:
          requirement.operatorId,
        missingInputs: [
          ...requirement.inputPorts
        ],
        missingOutputs: [
          ...requirement.outputPorts
        ],
        reason
      })
    );
  }

  async function reconcileLegacyRequiredApiNodes(
    requiredNodes,
    catalog
  ) {
    const controller =
      window.RMLApiNodeFactoryController;

    if (
      !catalog ||
      !controller ||
      typeof controller
        .resolveRequiredOperators !==
        "function"
    ) {
      return null;
    }

    return controller
      .resolveRequiredOperators(
        requiredNodes,
        catalog
      );
  }

  function requiredApiNodeFailureLabel(
    failure
  ) {
    const ports = [
      ...failure.missingInputs.map(
        portId =>
          `input '${portId}'`
      ),
      ...failure.missingOutputs.map(
        portId =>
          `output '${portId}'`
      )
    ];

    return ports.length > 0
      ? `${failure.operatorId} (${ports.join(", ")})`
      : `${failure.operatorId} (${failure.reason})`;
  }

  function notifyCatalogGate(
    callback,
    detail
  ) {
    if (typeof callback !== "function") {
      return;
    }

    try {
      callback(Object.freeze(detail));
    } catch (error) {
      console.debug(
        "The catalog progress callback failed.",
        error
      );
    }
  }

  async function activateCachedCatalogFallback() {
    const cached =
      cachedCatalogRecord ||
      await readCachedLiveCatalog();

    if (!cached) {
      return null;
    }

    const normalized =
      normalizeCatalog(
        cached.catalog,
        "scanner-cache",
        cached.sourceUrl || ""
      );

    await activateCatalogAndFactory(
      normalized
    );

    return normalized;
  }

  async function ensureCatalogForReplacement(
    options = {}
  ) {
    notifyCatalogGate(
      options.onLiveLookup,
      {
        phase: "live",
        message:
          currentScannerConnection().mode === "live"
            ? "Using available API contracts for the active scanner session."
            : "Cached mode: using saved API contracts without a scanner request. Click Cached to connect."
      }
    );

    const connected =
      await synchronizeScannerStatus({
        showChecking: true,
        throwOnFailure: false,
        onFingerprintMatch:
          options.onFingerprintMatch,
        onCatalogRefresh:
          options.onCatalogRefresh,
        onFactoryActivation:
          options.onFactoryActivation
      });

    if (!connected) {
      notifyCatalogGate(
        options.onCacheFallback,
        {
          phase: "cache",
          message:
            currentScannerConnection().mode === "live"
              ? "The current scanner session has no verified catalog. Using the cached catalog."
              : "Cached mode is active. Using the saved catalog without a live request."
        }
      );
    }

    const catalog = connected
      ? statusCatalog()
      : await activateCachedCatalogFallback();

    if (!catalog) {
      return Object.freeze({
        available: false,
        live: false,
        cacheFallback: true,
        liveAttempted: currentScannerConnection().mode === "live",
        source: "unavailable",
        catalogFingerprint: "",
        engineVersion: ""
      });
    }

    let report =
      window.RMLApiNodeFactoryReport;

    if (
      !factoryMatchesCatalog(
        catalog,
        report
      )
    ) {
      await activateCatalogAndFactory(
        catalog
      );
      report =
        window.RMLApiNodeFactoryReport;
    }

    const factoryReady =
      factoryMatchesCatalog(
        catalog,
        report
      );
    const live = Boolean(
      connected &&
      factoryReady &&
      window.RMLApiNodeFactoryReport
        ?.liveCatalogVerified === true &&
      String(
        window.RMLApiNodeFactoryReport
          ?.catalogFingerprint || ""
      ) ===
        String(
          catalog.catalogFingerprint || ""
        )
    );

    return Object.freeze({
      available: factoryReady,
      live,
      cacheFallback: !live,
      catalogBackedByCache: true,
      liveAttempted: currentScannerConnection().mode === "live",
      source: live
        ? "scanner-verified-cache"
        : "scanner-cache",
      catalogFingerprint: String(
        catalog.catalogFingerprint || ""
      ),
      engineVersion: String(
        catalog.engineVersion || ""
      ),
      fingerprintMatchedCache:
        lastScannerFingerprintSync
          .fingerprintMatchedCache ===
            true,
      cacheUpdatedFromLive:
        lastScannerFingerprintSync
          .cacheUpdatedFromLive === true
    });
  }

  async function ensureCatalogForImport(
    options = {}
  ) {
    const requiredNodes =
      normalizedRequiredApiNodes(
        options
      );
    const requiredNodeIds =
      requiredNodes.map(
        requirement =>
          requirement.operatorId
      );
    const scannerResolvableNodes =
      requiredNodes.filter(
        requirement =>
          requirement.catalogScope ===
            "api"
      );
    const migrations = {};
    const portMigrations = {};
    const collectMigrations = report => {
      const values =
        report?.migrations;

      if (
        !values ||
        typeof values !== "object" ||
        Array.isArray(values)
      ) {
        return;
      }

      for (const [from, to] of
        Object.entries(values)) {
        const source = String(from || "").trim();
        const target = String(to || "").trim();
        if (source && target) {
          migrations[source] = target;
        }
      }
      const portValues = report?.portMigrations;
      if (portValues && typeof portValues === "object" && !Array.isArray(portValues)) {
        for (const [from, mapping] of Object.entries(portValues)) {
          if (!from || !mapping || typeof mapping !== "object") continue;
          portMigrations[from] = structuredClone(mapping);
        }
      }
      for (const requirement of requiredNodes) {
        const originalId = String(requirement.operatorId || "");
        const targetId = String(migrations[originalId] || "");
        if (!targetId) continue;
        const mapping = portMigrations[originalId] || {};
        requirement.operatorId = targetId;
        requirement.inputPorts = requirement.inputPorts.map(id =>
          String(mapping.input?.[id] || id)
        );
        requirement.outputPorts = requirement.outputPorts.map(id =>
          String(mapping.output?.[id] || id)
        );
      }
    };

    if (requiredNodeIds.length === 0) {
      await modNodesReady;
      return Object.freeze({
        required: false,
        verified: true,
        available: true,
        unresolved: 0,
        unresolvedRequirements:
          Object.freeze([]),
        requiredNodeIds:
          Object.freeze([]),
        catalogFingerprint: "",
        engineVersion: ""
      });
    }

    const replacementCatalog =
      await ensureCatalogForReplacement(
        options
      );

    notifyCatalogGate(
      options.onContractResolution,
      {
        phase: "required-contract-check",
        title:
          "Checking required catalog contracts…",
        message:
          `Checking ${requiredNodes.length} unique catalog operator contract${requiredNodes.length === 1 ? "" : "s"}; repeated node instances share this result.`,
        detail:
          "The API factory is ready. This phase checks only project-referenced operator IDs and ports.",
        progress: 51.5
      }
    );

    let catalog = statusCatalog();
    let report =
      window.RMLApiNodeFactoryReport;
    let missing =
      factoryMatchesCatalog(
        catalog,
        report
      )
        ? missingRequiredApiNodes(
            requiredNodes,
            catalog,
            report
          )
        : unresolvedRequiredApiNodes(
            requiredNodes
          );

    if (missing.length > 0) {
      notifyCatalogGate(
        options.onContractResolution,
        {
          phase: "legacy-contract-resolution",
          title:
            "Resolving historical API identities…",
          message:
            `Resolving ${scannerResolvableNodes.length} unresolved API contract${scannerResolvableNodes.length === 1 ? "" : "s"} by portable contract or exact stored API node name.`,
          detail:
            "There is no catalog-wide 2,048-position hash scan. Name hints narrow legacy verification to the exact matching member definitions; otherwise the replacement dialog opens.",
          progress: 51.75
        }
      );
      collectMigrations(
        await reconcileLegacyRequiredApiNodes(
          scannerResolvableNodes,
          catalog
        )
      );
      report =
        window.RMLApiNodeFactoryReport;
      missing =
        factoryMatchesCatalog(
          catalog,
          report
        )
          ? missingRequiredApiNodes(
              requiredNodes,
              catalog,
              report
            )
          : unresolvedRequiredApiNodes(
              requiredNodes
            );
    }

    if (
      missing.length > 0 &&
      catalog &&
      !factoryMatchesCatalog(
        catalog,
        report
      )
    ) {
      const controller =
        window.RMLApiNodeFactoryController;

      if (
        controller &&
        typeof controller.rebuild ===
          "function"
      ) {
        await controller.rebuild(catalog);
        collectMigrations(
          await reconcileLegacyRequiredApiNodes(
            scannerResolvableNodes,
            catalog
          )
        );
        report =
          window.RMLApiNodeFactoryReport;
        missing =
          factoryMatchesCatalog(
            catalog,
            report
          )
            ? missingRequiredApiNodes(
                requiredNodes,
                catalog,
                report
              )
            : unresolvedRequiredApiNodes(
                requiredNodes
              );
      }
    }

    if (missing.length === 0) {
      return Object.freeze({
        required: true,
        verified: true,
        available: true,
        unresolved: 0,
        unresolvedRequirements:
          Object.freeze([]),
        live:
          replacementCatalog.live ===
            true,
        cacheSatisfied:
          replacementCatalog.cacheFallback ===
            true,
        requiredNodeIds:
          Object.freeze([
            ...requiredNodeIds
          ]),
        catalogFingerprint:
          String(
            catalog.catalogFingerprint ||
            ""
          ),
        engineVersion:
          String(
            catalog.engineVersion || ""
          ),
        source:
          String(
            catalog.catalogSource || ""
          ),
        migrations:
          Object.freeze({
            ...migrations
          }),
        portMigrations:
          Object.freeze(structuredClone(portMigrations)),
        liveFallbackAttempted: currentScannerConnection().mode === "live",
        liveAttempted: currentScannerConnection().mode === "live",
        cacheFallback:
          replacementCatalog.cacheFallback ===
            true,
        fingerprintMatchedCache:
          replacementCatalog
            .fingerprintMatchedCache ===
              true,
        cacheUpdatedFromLive:
          replacementCatalog
            .cacheUpdatedFromLive === true
      });
    }

    const missingByOperator =
      new Map(
        missing.map(failure => [
          String(
            failure?.operatorId || ""
          ),
          failure
        ])
      );
    const unresolvedRequirements =
      requiredNodes
        .filter(requirement =>
          missingByOperator.has(
            String(
              requirement?.operatorId || ""
            )
          )
        )
        .map(requirement => ({
          operatorId:
            String(
              requirement.operatorId || ""
            ),
          apiContract:
            requirement.apiContract &&
            typeof requirement.apiContract ===
              "object" &&
            !Array.isArray(
              requirement.apiContract
            )
              ? structuredClone(
                  requirement.apiContract
                )
              : null,
          missingCatalogObject:
            requirement
              .missingCatalogObject ===
                true,
          catalogScope:
            requirement.catalogScope ===
              "all"
              ? "all"
              : "api",
          nodeParameters:
            requirement.nodeParameters &&
            typeof requirement.nodeParameters ===
              "object" &&
            !Array.isArray(
              requirement.nodeParameters
            )
              ? structuredClone(
                  requirement
                    .nodeParameters
                )
              : {},
          nodeLabels:
            Object.freeze([
              ...(Array.isArray(
                requirement.nodeLabels
              )
                ? requirement.nodeLabels
                : [])
            ]),
          inputPorts:
            Object.freeze([
              ...requirement.inputPorts
            ]),
          outputPorts:
            Object.freeze([
              ...requirement.outputPorts
            ]),
          failure:
            Object.freeze({
              ...missingByOperator.get(
                String(
                  requirement.operatorId || ""
                )
              )
            })
        }));

    return Object.freeze({
      required: true,
      verified: false,
      available:
        replacementCatalog.available ===
          true,
      live:
        replacementCatalog.live === true,
      cacheSatisfied:
        replacementCatalog.cacheFallback ===
          true,
      requiredNodeIds:
        Object.freeze([
          ...requiredNodeIds
        ]),
      catalogFingerprint:
        String(
          catalog?.catalogFingerprint ||
          replacementCatalog
            .catalogFingerprint ||
          ""
        ),
      engineVersion:
        String(
          catalog?.engineVersion ||
          replacementCatalog
            .engineVersion ||
          ""
        ),
      source:
        String(
          catalog?.catalogSource ||
          replacementCatalog.source ||
          "unavailable"
        ),
      migrations:
        Object.freeze({
          ...migrations
        }),
      portMigrations:
        Object.freeze(
          structuredClone(
            portMigrations
          )
        ),
      unresolved:
        unresolvedRequirements.length,
      unresolvedRequirements:
        Object.freeze(
          unresolvedRequirements
        ),
      failureLabels:
        Object.freeze(
          missing.map(
            requiredApiNodeFailureLabel
          )
        ),
      liveFallbackAttempted: currentScannerConnection().mode === "live",
      liveAttempted: currentScannerConnection().mode === "live",
      cacheFallback:
        replacementCatalog.cacheFallback ===
          true,
      fingerprintMatchedCache:
        replacementCatalog
          .fingerprintMatchedCache ===
            true,
      cacheUpdatedFromLive:
        replacementCatalog
          .cacheUpdatedFromLive === true
    });
  }

  function synchronizeConnectedSession(connection = currentScannerConnection()) {
    if (connection.mode === "live") {
      // Only the badge can open a session. Catalog initialization may reuse that
      // session, but never opens or retries a transport connection itself.
      void synchronizeScannerStatus({ manualSession: connection });
    } else {
      demoteLiveFactoryReport();
    }
    updateStatus();
  }

  window.addEventListener("rml-scanner-connection", event => {
    synchronizeConnectedSession(event.detail);
  });
  window.addEventListener("rml-api-node-factory-ready", updateStatus);

  const catalogReady =
    loadCatalog();


  

  
  const baseModNodesReady =
    Promise.resolve(registryReady)
      .then(async () => {
        await loadScript(
          modNodesUrl,
          "mod-nodes",
          "mod_nodes.js"
        );
        await loadScript(
          visualCSharpUrl,
          "visual-csharp-nodes",
          "visual_csharp.js"
        );

        return true;
      });

  const modNodesReady =
    Promise.all([
      catalogReady,
      baseModNodesReady
    ])
      .then(async ([catalog]) => {
        if (catalog) {
          await ensureApiNodesLoaded();
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
    "RMLBaseModNodesReady",
    {
      value: baseModNodesReady,
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
      synchronizeConnectedSession();
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
        catalogPath: CATALOG_PATH,
        builderStatusPath:
          BUILDER_SCANNER_STATUS_PATH,
        builderCatalogPath:
          BUILDER_SCANNER_CATALOG_PATH
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  Object.defineProperty(
    window,
    "RMLCatalogImportGate",
    {
      value: Object.freeze({
        version: 12,
        ensureForImport:
          ensureCatalogForImport,
        ensureLive:
          ensureCatalogForImport,
        ensureForReplacement:
          ensureCatalogForReplacement
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
