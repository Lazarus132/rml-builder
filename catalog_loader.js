(() => {
  "use strict";

  const LOADER_VERSION = 36;
  const DEFAULT_PORT_FIRST = 42719;
  const DEFAULT_PORT_LAST = 42729;
  const CATALOG_PATH = "/resonite_api_catalog.json";
  const HEALTH_PATH = "/health";
  const BUILDER_SCANNER_STATUS_PATH =
    "/rml-scanner-status";
  const BUILDER_SCANNER_CATALOG_PATH =
    "/rml-scanner-catalog";
  const BUILDER_PROBE_TIMEOUT_MS = 6000;
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
    "mod_nodes.js?v=44-scanner-only-v603f4",
    scriptUrl
  ).href;
  const visualCSharpUrl = new URL(
    "visual_csharp.js?v=11-import-expert-visibility-v603f8",
    scriptUrl
  ).href;
  const apiNodesUrl = new URL(
    "api_nodes.js?v=26-normal-core-v603",
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

  function stableCatalogHash(value) {
    const text = String(value || "");
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;

    for (let index = 0; index < text.length; index += 1) {
      const code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 0x01000193) >>> 0;
      second ^= code + index;
      second = Math.imul(second, 0x85ebca6b) >>> 0;
    }

    return (
      first.toString(16).padStart(8, "0") +
      second.toString(16).padStart(8, "0")
    );
  }

  function catalogFingerprint(raw) {
    const supplied = String(
      raw?.catalogFingerprint ||
      raw?.assemblyFingerprint ||
      ""
    ).trim();

    const content = stableCatalogHash(
      JSON.stringify({
        schemaVersion: raw?.schemaVersion || 0,
        engineVersion: raw?.engineVersion || "unknown",
        sourceAssembly: raw?.sourceAssembly || "FrooxEngine.dll",
        declaredFingerprint: supplied,
        assemblies: raw?.assemblies || [],
        types: raw?.types || [],
        enums: raw?.enums || [],
        components: raw?.components || [],
        materials: raw?.materials || [],
        commonMaterials: raw?.commonMaterials || [],
        meshes: raw?.meshes || [],
        slotAttachOverloads:
          raw?.slotAttachOverloads || []
      })
    );

    return supplied
      ? `${supplied}:${content}`
      : content;
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
      catalogFingerprint:
        catalogFingerprint(value),
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
      genericArity = 0
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
        parameterShape,
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
        0
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
          0
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
          (method?.genericParameters || []).length
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
            0
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
            0
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
          0
        );
        if (!field?.isReadOnly && !field?.isConst) {
          add(
            "field-set",
            owner,
            field?.name,
            [{ position: 0, type: field?.type }],
            "System.Void",
            field?.isStatic,
            0
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
          0
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
    const compatibility = previous
      ? compareApiCatalogs(
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

  let scannerOnline = false;
  let scannerChecking = false;
  let scannerCheckPromise = null;
  let activeScannerCatalogUrl = "";

  function statusCatalog() {
    return (
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null
    );
  }

  function formatStatusCount(value) {
    return Math.max(
      0,
      Number(value) || 0
    ).toLocaleString("de-DE");
  }

  function catalogStatisticsTooltip(
    catalog
  ) {
    const report =
      window.RMLApiNodeFactoryReport;

    if (
      !catalog ||
      !report ||
      String(report.engineVersion || "") !==
        String(catalog.engineVersion || "") ||
      !Number.isFinite(
        Number(report.totalGeneratedNodes)
      )
    ) {
      return "";
    }

    return `${formatStatusCount(
      catalog.components?.length
    )} attachable components · ${formatStatusCount(
      catalog.types?.length
    )} API types · ${formatStatusCount(
      report.totalGeneratedNodes
    )} generated nodes`;
  }

  function setCatalogStatusContent(
    element,
    text,
    catalog = null
  ) {
    element.textContent = text;

    const tooltip =
      catalogStatisticsTooltip(
        catalog
      );

    if (tooltip) {
      element.title = tooltip;
      element.setAttribute(
        "aria-label",
        `${text}. ${tooltip}`
      );
    } else {
      element.removeAttribute("title");
      element.setAttribute(
        "aria-label",
        text
      );
    }
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

    const version =
      String(
        catalog?.engineVersion ||
        "unknown"
      );

    if (checking) {
      element.dataset.source = "updating";
      setCatalogStatusContent(
        element,
        catalog
          ? `Resonite API ${version} · checking…`
          : "Resonite API · checking…",
        catalog
      );
      return;
    }

    if (online) {
      element.dataset.source = "scanner";
      setCatalogStatusContent(
        element,
        catalog
          ? `Resonite API ${version} · Live`
          : "Resonite API · Live",
        catalog
      );
      return;
    }

    if (catalog) {
      element.dataset.source = "cache";
      setCatalogStatusContent(
        element,
        `Resonite API ${version} · cached`,
        catalog
      );
      return;
    }

    element.dataset.source = "unavailable";
    setCatalogStatusContent(
      element,
      "Resonite API · unavailable"
    );
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
    setCatalogStatusContent(
      element,
      "Resonite API · unavailable"
    );
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

  function isPrivateIpv4Hostname(hostname) {
    const parts = String(hostname || "")
      .split(".")
      .map(part => Number(part));

    if (
      parts.length !== 4 ||
      parts.some(part =>
        !Number.isInteger(part) ||
        part < 0 ||
        part > 255
      )
    ) {
      return false;
    }

    return (
      parts[0] === 10 ||
      parts[0] === 127 ||
      (parts[0] === 169 &&
        parts[1] === 254) ||
      (parts[0] === 172 &&
        parts[1] >= 16 &&
        parts[1] <= 31) ||
      (parts[0] === 192 &&
        parts[1] === 168)
    );
  }

  function isLocalBuilderOrigin() {
    if (
      window.location.protocol !== "http:" &&
      window.location.protocol !== "https:"
    ) {
      return false;
    }

    const hostname = String(
      window.location.hostname || ""
    )
      .trim()
      .toLowerCase()
      .replace(/^\[|\]$/g, "");

    return (
      hostname === "localhost" ||
      hostname === "::1" ||
      hostname.endsWith(".localhost") ||
      hostname.endsWith(".local") ||
      (hostname.includes(":") &&
        hostname.startsWith("fc")) ||
      (hostname.includes(":") &&
        hostname.startsWith("fd")) ||
      hostname.startsWith("fe80:") ||
      isPrivateIpv4Hostname(hostname)
    );
  }

  function builderBridgeUrl(path) {
    try {
      if (!isLocalBuilderOrigin()) {
        return "";
      }

      return new URL(
        path,
        window.location.origin
      ).href;
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

  async function probeConfiguredScannerUrl(
    catalogUrl
  ) {
    const raw = await fetchJson(
      catalogUrl,
      CATALOG_FETCH_TIMEOUT_MS
    );

    return {
      raw,
      url: catalogUrl
    };
  }

  function directScannerUrls(
    excludedUrls = []
  ) {
    const urls = [];
    const excluded = new Set(
      (Array.isArray(excludedUrls)
        ? excludedUrls
        : [])
        .map(value =>
          String(value || "").trim()
        )
        .filter(Boolean)
    );

    if (
      activeScannerCatalogUrl &&
      !excluded.has(
        activeScannerCatalogUrl
      )
    ) {
      urls.push(activeScannerCatalogUrl);
    }

    for (
      let port = DEFAULT_PORT_FIRST;
      port <= DEFAULT_PORT_LAST;
      port += 1
    ) {
      const url =
        `http://127.0.0.1:${port}${CATALOG_PATH}`;

      if (
        !excluded.has(url) &&
        !urls.includes(url)
      ) {
        urls.push(url);
      }
    }

    return urls;
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

  async function probeDirectScannerUrl(
    catalogUrl
  ) {
    const healthUrl =
      healthUrlFor(catalogUrl);

    if (!healthUrl) {
      return null;
    }

    const health = await fetchJson(
      healthUrl,
      BUILDER_PROBE_TIMEOUT_MS
    );

    if (
      health.ok !== true ||
      health.catalogReady !== true
    ) {
      return null;
    }

    return probeConfiguredScannerUrl(
      catalogUrl
    );
  }

  async function probeDirectScannerRange(
    excludedUrls = []
  ) {
    const urls = directScannerUrls(
      excludedUrls
    );
    const results = await Promise.all(
      urls.map(async url => {
        try {
          return await probeDirectScannerUrl(
            url
          );
        } catch {
          return null;
        }
      })
    );

    return results.find(Boolean) || null;
  }

  async function probeBuilderScannerBridge() {
    const statusUrl = builderBridgeUrl(
      BUILDER_SCANNER_STATUS_PATH
    );

    if (!statusUrl) {
      return null;
    }

    const status = await fetchJson(
      statusUrl,
      BUILDER_PROBE_TIMEOUT_MS
    );
    const scannerPort = Number(
      status.port
    );

    if (
      status.rmlScannerBridge !== 1 ||
      status.available !== true ||
      !Number.isInteger(scannerPort) ||
      scannerPort < DEFAULT_PORT_FIRST ||
      scannerPort > DEFAULT_PORT_LAST
    ) {
      return null;
    }

    const catalogBridgeUrl =
      builderBridgeUrl(
        `${BUILDER_SCANNER_CATALOG_PATH}?port=${scannerPort}`
      );

    if (!catalogBridgeUrl) {
      return null;
    }

    const raw = await fetchJson(
      catalogBridgeUrl,
      CATALOG_FETCH_TIMEOUT_MS
    );

    if (
      raw.rmlScannerBridge === 1 &&
      raw.available === false
    ) {
      return null;
    }

    return {
      raw,
      url:
        `http://127.0.0.1:${scannerPort}${CATALOG_PATH}`
    };
  }

  async function tryScannerCatalog() {
    const configured =
      configuredCatalogUrl();
    const configuredLoopback =
      loopbackScannerCatalogUrl(
        configured
      );

    let live = null;

    if (configured) {
      try {
        live =
          configuredLoopback
            ? await probeDirectScannerUrl(
                configuredLoopback
              )
            : await probeConfiguredScannerUrl(
                configured
              );
      } catch {
      }

      if (live) {
        return live;
      }
    }

    if (isLocalBuilderOrigin()) {
      try {
        live =
          await probeBuilderScannerBridge();
      } catch {
      }

      if (live) {
        return live;
      }
    }
    try {
      live =
        await probeDirectScannerRange(
          configuredLoopback
            ? [configuredLoopback]
            : []
        );
    } catch {
    }

    return live || null;
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
      scannerOnline = false;
      activeScannerCatalogUrl =
        loopbackScannerCatalogUrl(
          cached.sourceUrl
        );

      return installCatalog(
        normalizeCatalog(
          cached.catalog,
          "scanner-cache",
          cached.sourceUrl || ""
        )
      );
    }

    scannerOnline = false;
    scannerChecking = false;
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
    return [
      catalog?.catalogFingerprint ||
        catalog?.assemblyFingerprint ||
        "unknown",
      catalog?.engineVersion || "unknown"
    ].join("|");
  }

  function promoteCachedApiNodesToLive(
    catalog
  ) {
    const report =
      window.RMLApiNodeFactoryReport;
    const definitions =
      window.RMLModNodeRegistry
        ?.getNodeDefinitions?.();

    if (
      !report ||
      typeof report !== "object" ||
      !definitions ||
      typeof definitions !== "object" ||
      report.verificationPassed !== true ||
      String(report.catalogFingerprint || "") !==
        String(catalog?.catalogFingerprint || "") ||
      String(report.engineVersion || "") !==
        String(catalog?.engineVersion || "")
    ) {
      return false;
    }

    if (
      report.catalogSource === "scanner" &&
      report.liveCatalogVerified === true
    ) {
      return true;
    }

    let promotedCount = 0;

    for (const definition of
      Object.values(definitions)) {
      const contract =
        definition?.apiVerification;

      if (
        definition?.catalogGenerated !== true ||
        !contract ||
        typeof contract !== "object" ||
        String(contract.catalogFingerprint || "") !==
          String(catalog.catalogFingerprint || "") ||
        String(contract.engineVersion || "") !==
          String(catalog.engineVersion || "")
      ) {
        continue;
      }

      const {
        contractFingerprint:
          _cachedContractFingerprint,
        ...cachedCore
      } = contract;
      const liveCore = {
        ...cachedCore,
        catalogSource: "scanner"
      };

      definition.apiVerification =
        Object.freeze({
          ...liveCore,
          contractFingerprint:
            stableCatalogHash(
              JSON.stringify(liveCore)
            )
        });
      delete definition.hiddenFromPalette;
      delete definition.catalogVerificationUnavailable;
      promotedCount += 1;
    }

    const liveReport = Object.freeze({
      ...report,
      catalogSource: "scanner",
      liveCatalogVerified: true
    });

    window.RMLApiNodeFactoryReport =
      liveReport;
    window.__RMLNodeDefinitionRevision =
      (Number(
        window.__RMLNodeDefinitionRevision
      ) || 0) + 1;

    window.dispatchEvent(
      new CustomEvent(
        "rml-api-node-factory-ready",
        {
          detail: liveReport
        }
      )
    );

    return promotedCount > 0 ||
      Number(report.totalGeneratedNodes) === 0;
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

  async function synchronizeScannerStatus(
    options = {}
  ) {
    if (scannerCheckPromise) {
      return scannerCheckPromise;
    }

    const showChecking =
      options.showChecking === true;
    const throwOnFailure =
      options.throwOnFailure === true;

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
          await tryScannerCatalog();

        scannerChecking = false;

        if (!live) {
          scannerOnline = false;
          activeScannerCatalogUrl = "";
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
        activeScannerCatalogUrl =
          live.url;

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
        const catalogChanged =
          !current ||
          nextIdentity !==
            currentIdentity;

        installCatalog(normalized);
        try {
          if (!current) {
            await modNodesReady;
            await ensureApiNodesLoaded();
          }

          if (
            current &&
            !catalogChanged
          ) {
            await modNodesReady;
            await ensureApiNodesLoaded();
            const promoted =
              promoteCachedApiNodesToLive(
                normalized
              );

            if (!promoted) {
              const controller =
                window.RMLApiNodeFactoryController;

              if (
                !controller ||
                typeof controller.rebuild !==
                  "function"
              ) {
                throw new Error(
                  "The live API node factory cannot rebuild an unavailable or unverifiable cached catalog."
                );
              }

              await controller.rebuild(
                normalized
              );
            }
          }

          if (
            current &&
            catalogChanged
          ) {
            await modNodesReady;
            await ensureApiNodesLoaded();

            const controller =
              window.RMLApiNodeFactoryController;

            if (
              !controller ||
              typeof controller.rebuild !==
                "function"
            ) {
              throw new Error(
                "The live API node factory cannot rebuild for the updated catalog."
              );
            }

            await controller.rebuild(
              normalized
            );
          }

        } catch (error) {
          if (
            current &&
            catalogChanged
          ) {
            installCatalog(current);
          }
          throw error;
        }

        await writeCachedLiveCatalog(
          live.raw,
          live.url
        );

        return true;
      })()
        .catch(error => {
          scannerChecking = false;
          scannerOnline = false;
          activeScannerCatalogUrl = "";

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

          if (throwOnFailure) {
            throw error;
          }

          return false;
        })
        .finally(() => {
          scannerCheckPromise = null;
        });

    return scannerCheckPromise;
  }

  async function refreshLiveCatalogManually() {
    return synchronizeScannerStatus({
      showChecking: true,
      reloadOnChange: false
    });
  }

  function normalizedRequiredApiNodes(
    options
  ) {
    const requirements = new Map();
    const add = (
      operatorId,
      inputPorts = [],
      outputPorts = [],
      apiContract = null
    ) => {
      const id = String(
        operatorId || ""
      ).trim();

      if (!id.startsWith("api.")) {
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
          inputPorts: new Set(),
          outputPorts: new Set()
        });
      }

      const requirement =
        requirements.get(id);

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
        value?.apiContract
      );
    }

    return [...requirements.values()]
      .map(requirement => ({
        operatorId:
          requirement.operatorId,
        apiContract:
          requirement.apiContract,
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
        report.catalogSource || ""
      ) ===
        String(
          catalog.catalogSource || ""
        ) &&
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
        String(
          contract.catalogSource || ""
        ) ===
          String(
            report?.catalogSource || ""
          ) &&
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
    const migrations = {};
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
    };

    if (requiredNodeIds.length === 0) {
      await modNodesReady;
      return Object.freeze({
        required: false,
        verified: true,
        requiredNodeIds:
          Object.freeze([]),
        catalogFingerprint: "",
        engineVersion: ""
      });
    }

    await modNodesReady;

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
      collectMigrations(
        await reconcileLegacyRequiredApiNodes(
        requiredNodes,
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

    if (missing.length === 0) {
      return Object.freeze({
        required: true,
        verified: true,
        live:
          catalog.catalogSource ===
            "scanner",
        cacheSatisfied:
          catalog.catalogSource ===
            "scanner-cache",
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
        liveFallbackAttempted: false
      });
    }

    if (
      typeof options.onLiveFallback ===
        "function"
    ) {
      try {
        options.onLiveFallback(
          Object.freeze({
            missingCount:
              missing.length,
            missing:
              Object.freeze(
                missing.slice(0, 12)
                  .map(failure =>
                    requiredApiNodeFailureLabel(
                      failure
                    )
                  )
              )
          })
        );
      } catch (error) {
        console.debug(
          "The import progress callback failed.",
          error
        );
      }
    }

    const connected =
      await synchronizeScannerStatus({
        showChecking: true,
        reloadOnChange: false,
        throwOnFailure: true
      });

    if (!connected) {
      const visible =
        missing.slice(0, 8)
          .map(
            requiredApiNodeFailureLabel
          );
      throw new Error(
        `The cached Resonite API catalog cannot resolve ${missing.length.toLocaleString("de-DE")} required operator or port contract${missing.length === 1 ? "" : "s"} (${visible.join(", ")}${missing.length > visible.length ? ` and ${(missing.length - visible.length).toLocaleString("de-DE")} more` : ""}), and the live scanner is unavailable. The JSON was not loaded.`
      );
    }

    await ensureApiNodesLoaded();
    catalog = statusCatalog();
    report =
      window.RMLApiNodeFactoryReport;

    if (
      !factoryMatchesCatalog(
        catalog,
        report
      ) ||
      catalog?.catalogSource !==
        "scanner" ||
      report?.liveCatalogVerified !==
        true
    ) {
      throw new Error(
        "The live Resonite API catalog was reached, but its verified node factory did not become ready. The JSON was not loaded."
      );
    }

    collectMigrations(
      await reconcileLegacyRequiredApiNodes(
      requiredNodes,
      catalog
      )
    );
    report =
      window.RMLApiNodeFactoryReport;
    missing =
      missingRequiredApiNodes(
        requiredNodes,
        catalog,
        report
      );

    if (missing.length > 0) {
      const visible =
        missing.slice(0, 12);
      const remainder =
        missing.length - visible.length;

      throw new Error(
        `This JSON cannot be loaded because the current live Resonite API catalog does not provide ${missing.length.toLocaleString("de-DE")} required operator or port contract${missing.length === 1 ? "" : "s"}: ${visible.map(requiredApiNodeFailureLabel).join(", ")}${remainder > 0 ? ` and ${remainder.toLocaleString("de-DE")} more` : ""}.`
      );
    }

    return Object.freeze({
      required: true,
      verified: true,
      live: true,
      cacheSatisfied: false,
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
      source: "scanner",
      migrations:
        Object.freeze({
          ...migrations
        }),
      liveFallbackAttempted: true
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

  window.addEventListener(
    "rml-api-node-factory-ready",
    () => {
      updateStatus(
        statusCatalog(),
        {
          checking: scannerChecking,
          online: scannerOnline
        }
      );
    }
  );

  if (window.RMLApiNodeFactoryReport) {
    queueMicrotask(() => {
      updateStatus(
        statusCatalog(),
        {
          checking: scannerChecking,
          online: scannerOnline
        }
      );
    });
  }

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
      installManualScannerRefresh();
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
        version: 1,
        ensureForImport:
          ensureCatalogForImport,
        ensureLive:
          ensureCatalogForImport
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
