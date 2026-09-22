(() => {
  "use strict";

  const CATALOG_LOADER_MODULE_ID =
    "1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll";
  const LOADER_VERSION = 84;
  const DEFAULT_PORT_FIRST = 42719;
  const DEFAULT_PORT_LAST = 42729;
  const CATALOG_PATH = "/resonite_api_catalog.json";
  const HEALTH_PATH = "/health";
  const CATALOG_READY_TIMEOUT_MS = 16000;
  const CATALOG_TRANSFER_TIMEOUT_MS = 30000;
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
  const REQUIRED_METHOD_IDENTITY_ALGORITHM =
    "assembly-neutral-declaring-type-and-signature-v2";
  const REQUIRED_RELOAD_SAFETY_CONTRACT_VERSION = 1;
  const REQUIRED_RELOAD_SAFETY_POLICY =
    "operation-structure-and-use-site-v2-compatible-v1";
  const CACHE_RECORD_SCHEMA_VERSION = 3;
  const LEGACY_CACHE_RECORD_SCHEMA_VERSION = 2;
  const LEGACY_CACHE_CONTENT_HASH_ALGORITHM =
    "sha256-json-payload-v1";
  const CACHE_CHUNK_FORMAT =
    "rml-catalog-structural-chunks-v1";
  const CACHE_CONTENT_HASH_ALGORITHM =
    "sha256-catalog-chunk-tree-v1";
  const CACHE_CHUNK_RECORD_SCHEMA_VERSION = 1;
  const CACHE_CHUNK_TARGET_BYTES =
    512 * 1024;
  const CACHE_CHUNK_MAX_BYTES =
    4 * 1024 * 1024;
  const CACHE_CHUNK_MAX_KEY_BYTES =
    64 * 1024;
  const CACHE_CHUNK_MAX_COUNT = 16384;
  const CACHE_CHUNK_MAX_DEPTH = 128;
  const CACHE_CHUNK_MAX_CONTAINER_ENTRIES =
    5_000_000;
  const CACHE_MANIFEST_MAX_BYTES =
    4 * 1024 * 1024;
  const CACHE_STAGING_RECORD_KEY =
    "catalog-chunk-staging";
  const CACHE_ACTIVE_RECORD_KEY =
    "catalog-chunk-active";
  const DEMAND_CACHE_MANIFEST_KEY =
    "catalog-demand-manifest";
  const DEMAND_CACHE_FORMAT =
    "rml-catalog-demand-index-v2";
  const DEMAND_CACHE_SCHEMA_VERSION = 2;
  const DEMAND_CACHE_MANIFEST_MAX_BYTES =
    32 * 1024 * 1024;
  const REQUIRED_API_FACTORY_VERSION = 38;
  const REQUIRED_API_VERIFICATION_SCHEMA_VERSION = 3;

  const scriptUrl =
    document.currentScript?.src ||
    window.location.href;
  const modNodesUrl = new URL(
    "mod_nodes.js?v=800-harmony-source-presets",
    scriptUrl
  ).href;
  const visualCSharpUrl = new URL(
    "../compiler/visual_csharp.js?v=84-harmony-file-presets",
    scriptUrl
  ).href;
  const apiNodesUrl = new URL(
    "api_nodes.js?v=1.21.10-universal-presentation-dev407-resonite-preview-overlay-scroll",
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
          window.RMLI18n.t("ui.literal.d11b88ab247a"),
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

  function cachedCatalogMatchesScannerHealth(
    catalog,
    health
  ) {
    const cachedContract =
      scannerFingerprintContract(catalog);
    const liveContract =
      scannerFingerprintContract(health);
    const cachedAssemblyFingerprint = String(
      catalog?.assemblyFingerprint || ""
    ).trim().toLowerCase();
    const liveAssemblyFingerprint = String(
      health?.catalogAssemblyFingerprint ||
      health?.assemblyFingerprint ||
      ""
    ).trim().toLowerCase();
    const knownTransportOnlyUpgrade =
      /^1\.11\.[1-4]$/.test(
        cachedContract?.scannerVersion || ""
      ) &&
      liveContract?.scannerVersion ===
        "1.11.5";

    return Boolean(
      cachedContract &&
      liveContract &&
      knownTransportOnlyUpgrade &&
      cachedAssemblyFingerprint &&
      cachedAssemblyFingerprint ===
        liveAssemblyFingerprint &&
      cachedContract.schemaVersion ===
        liveContract.schemaVersion &&
      cachedContract.methodIdentityVersion ===
        liveContract.methodIdentityVersion &&
      cachedContract.methodIdentityAlgorithm ===
        liveContract.methodIdentityAlgorithm &&
      cachedContract.reloadSafetyContractVersion ===
        liveContract.reloadSafetyContractVersion &&
      cachedContract.reloadSafetyPolicy ===
        liveContract.reloadSafetyPolicy &&
      cachedContract.reloadSafetyMinimumReaderVersion ===
        liveContract.reloadSafetyMinimumReaderVersion &&
      cachedContract.reloadSafetyMaximumReaderVersion ===
        liveContract.reloadSafetyMaximumReaderVersion &&
      Number(
        catalog?.suppressedDuplicateTypeDefinitions
      ) === Number(
        health?.suppressedDuplicateTypeDefinitions
      )
    );
  }

  function strictCachedScannerContract(raw) {
    const contract =
      scannerFingerprintContract(raw);
    const assemblyFingerprint = String(
      raw?.assemblyFingerprint || ""
    ).trim().toLowerCase();
    const engineVersion = String(
      raw?.engineVersion || ""
    ).trim();
    const types = catalogTypes(raw);

    return Boolean(
      contract &&
      contract.schemaVersion ===
        REQUIRED_CATALOG_SCHEMA_VERSION &&
      String(raw?.catalogKind || "") ===
        "live-resonite-api" &&
      contract.version ===
        REQUIRED_SCANNER_FINGERPRINT_VERSION &&
      contract.algorithm ===
        REQUIRED_SCANNER_FINGERPRINT_ALGORITHM &&
      contract.methodIdentityVersion ===
        REQUIRED_METHOD_IDENTITY_VERSION &&
      contract.methodIdentityAlgorithm ===
        REQUIRED_METHOD_IDENTITY_ALGORITHM &&
      contract.reloadSafetyContractVersion ===
        REQUIRED_RELOAD_SAFETY_CONTRACT_VERSION &&
      contract.reloadSafetyPolicy ===
        REQUIRED_RELOAD_SAFETY_POLICY &&
      contract.reloadSafetyMinimumReaderVersion ===
        SUPPORTED_RELOAD_SAFETY_READER_VERSION &&
      contract.reloadSafetyMaximumReaderVersion ===
        SUPPORTED_RELOAD_SAFETY_READER_VERSION &&
      contract.reloadSafetyCompatible === true &&
      engineVersion &&
      engineVersion !== "unknown" &&
      /^[a-f0-9]{64}$/.test(
        assemblyFingerprint
      ) &&
      /^[a-f0-9]{64}$/.test(
        contract.fingerprint
      ) &&
      types.length > 0 &&
      types.some(type =>
        String(type?.fullName || "").trim()
      )
    );
  }

  async function legacyCatalogCacheContentHash(raw) {
    const subtle =
      globalThis.crypto?.subtle;
    if (
      !subtle ||
      typeof subtle.digest !== "function"
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.8845daae2fbf")
      );
    }

    let payload = JSON.stringify(raw);
    if (typeof payload !== "string") {
      throw new Error(
        window.RMLI18n.t("ui.literal.cfce762a9504")
      );
    }
    let encodedPayload =
      new TextEncoder().encode(payload);

    payload = "";
    const digest = await subtle.digest(
      "SHA-256",
      encodedPayload
    );
    encodedPayload = null;
    return [...new Uint8Array(digest)]
      .map(value =>
        value.toString(16).padStart(2, "0")
      )
      .join("");
  }

  const CACHE_JSON_TOO_LARGE =
    Symbol("catalog-cache-json-too-large");

  function catalogUtf8ByteLength(value) {
    let bytes = 0;
    for (let index = 0; index < value.length; index += 1) {
      const code = value.charCodeAt(index);
      if (code <= 0x7f) {
        bytes += 1;
      } else if (code <= 0x7ff) {
        bytes += 2;
      } else if (
        code >= 0xd800 &&
        code <= 0xdbff &&
        index + 1 < value.length &&
        value.charCodeAt(index + 1) >= 0xdc00 &&
        value.charCodeAt(index + 1) <= 0xdfff
      ) {
        bytes += 4;
        index += 1;
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }

  function boundedCatalogJson(
    value,
    maximumBytes = CACHE_CHUNK_MAX_BYTES
  ) {
    const parts = [];
    let byteLength = 0;
    const ancestors = new WeakSet();

    const append = token => {
      const tokenBytes =
        catalogUtf8ByteLength(token);
      if (
        byteLength + tokenBytes >
          maximumBytes
      ) {
        throw CACHE_JSON_TOO_LARGE;
      }
      byteLength += tokenBytes;
      parts.push(token);
    };

    const visit = (current, depth) => {
      if (current === null) {
        append("null");
        return;
      }

      const type = typeof current;
      if (type === "string") {
        if (
          current.length > maximumBytes
        ) {
          throw CACHE_JSON_TOO_LARGE;
        }
        append(JSON.stringify(current));
        return;
      }
      if (type === "boolean") {
        append(current ? "true" : "false");
        return;
      }
      if (type === "number") {
        if (!Number.isFinite(current)) {
          throw new TypeError(
            window.RMLI18n.t("ui.literal.6fdf38f7af5d")
          );
        }
        append(
          Object.is(current, -0)
            ? "0"
            : String(current)
        );
        return;
      }
      if (type !== "object") {
        throw new TypeError(
          window.RMLI18n.t("ui.literal.c4e02157667c")
        );
      }
      if (depth > CACHE_CHUNK_MAX_DEPTH) {
        throw new Error(
          `Catalog cache values may not be nested more than ${CACHE_CHUNK_MAX_DEPTH} levels.`
        );
      }
      if (ancestors.has(current)) {
        throw new TypeError(
          window.RMLI18n.t("ui.literal.4d1f346218b8")
        );
      }

      ancestors.add(current);
      try {
        if (Array.isArray(current)) {
          const keys = Object.keys(current);
          if (
            keys.length !== current.length ||
            keys.some((key, index) =>
              key !== String(index)
            )
          ) {
            throw new TypeError(
              window.RMLI18n.t("ui.literal.934bf3607465")
            );
          }
          append("[");
          for (
            let index = 0;
            index < current.length;
            index += 1
          ) {
            if (index > 0) append(",");
            visit(current[index], depth + 1);
          }
          append("]");
          return;
        }

        const prototype =
          Object.getPrototypeOf(current);
        if (
          prototype !== null &&
          Object.prototype.toString.call(
            current
          ) !== "[object Object]"
        ) {
          throw new TypeError(
            window.RMLI18n.t("ui.literal.4697e502cf22")
          );
        }
        append("{");
        const keys = Object.keys(current);
        for (
          let index = 0;
          index < keys.length;
          index += 1
        ) {
          if (index > 0) append(",");
          const key = keys[index];
          if (key.length > maximumBytes) {
            throw CACHE_JSON_TOO_LARGE;
          }
          append(JSON.stringify(key));
          append(":");
          visit(current[key], depth + 1);
        }
        append("}");
      } finally {
        ancestors.delete(current);
      }
    };

    try {
      visit(value, 0);
      return Object.freeze({
        json: parts.join(""),
        byteLength,
        tooLarge: false
      });
    } catch (error) {
      if (error === CACHE_JSON_TOO_LARGE) {
        return Object.freeze({
          json: "",
          byteLength: maximumBytes + 1,
          tooLarge: true
        });
      }
      throw error;
    }
  }

  function catalogDigestHex(digest) {
    return [...new Uint8Array(digest)]
      .map(value =>
        value.toString(16).padStart(2, "0")
      )
      .join("");
  }

  async function catalogCacheBoundedHash(
    value,
    maximumBytes = CACHE_CHUNK_MAX_BYTES
  ) {
    const serialized = boundedCatalogJson(
      value,
      maximumBytes
    );
    if (serialized.tooLarge) {
      throw new Error(
        `A catalog cache entry exceeds the ${Math.floor(maximumBytes / (1024 * 1024))} MiB integrity limit.`
      );
    }
    const subtle = globalThis.crypto?.subtle;
    if (
      !subtle ||
      typeof subtle.digest !== "function"
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.8845daae2fbf")
      );
    }
    const encoded = new TextEncoder().encode(
      serialized.json
    );
    const digest = await subtle.digest(
      "SHA-256",
      encoded
    );
    return Object.freeze({
      hash: catalogDigestHex(digest),
      byteLength: serialized.byteLength
    });
  }

  function createCatalogCacheGeneration() {
    const bytes = new Uint8Array(16);
    let random = "";
    if (
      typeof globalThis.crypto
        ?.getRandomValues === "function"
    ) {
      globalThis.crypto.getRandomValues(
        bytes
      );
      random = [...bytes]
        .map(value =>
          value.toString(16).padStart(2, "0")
        )
        .join("");
    } else {
      random = Math.random()
        .toString(36).slice(2);
    }
    return `${Date.now().toString(36)}-${random}`;
  }

  function catalogCacheChunkId(
    generation,
    index
  ) {
    return `catalog-chunk:${generation}:${String(index).padStart(8, "0")}`;
  }

  async function yieldCatalogCacheWork() {
    await new Promise(resolve => {
      if (
        typeof requestAnimationFrame ===
          "function"
      ) {
        requestAnimationFrame(() =>
          resolve()
        );
      } else {
        window.RMLScheduleTask(resolve);
      }
    });
  }

  function deepFreezeCatalogSnapshot(
    value
  ) {
    if (
      !value ||
      typeof value !== "object"
    ) {
      return value;
    }

    return Object.isFrozen(value)
      ? value
      : Object.freeze(value);
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

  function requireScannerFingerprintContract(
    raw,
    label = window.RMLI18n.t("ui.auto.50cdb367f212")
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
        window.RMLI18n.t("ui.literal.0077cf3a41b1")
      );
    }

    const value = raw;
    const fingerprintContract =
      scannerFingerprintContract(value);
    const legacyFingerprint =
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
          ).sort((left, right) =>
            left.position - right.position
          );
      const normalizedReturnType =
        catalogContractType(
          returnType || "System.Void"
        );
      const identity = JSON.stringify({
        kind,
        ownerType:
          catalogContractType(ownerType),
        memberName:
          String(memberName || ""),
        parameterShape,
        returnType:
          normalizedReturnType,
        isStatic: isStatic === true,
        genericArity: Math.max(
          0,
          Number(genericArity) || 0
        )
      });
      const shape = JSON.stringify({
        parameterShape,
        returnType:
          normalizedReturnType
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

  function createCatalogPublication(
    catalog
  ) {
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

    const properties = [
      "RMLCatalogDiffReport",
      "RMLResoniteApiCatalog",
      "RMLFrooxComponentCatalog"
    ];
    const previousDescriptors =
      new Map(
        properties.map(property => [
          property,
          Object.getOwnPropertyDescriptor(
            window,
            property
          )
        ])
      );
    let committed = false;
    let rolledBack = false;
    let notified = false;
    const restorePreviousDescriptors = () => {
      for (const property of properties) {
        const descriptor =
          previousDescriptors.get(
            property
          );
        if (descriptor) {
          Object.defineProperty(
            window,
            property,
            descriptor
          );
        } else {
          delete window[property];
        }
      }
    };
    const verify = () =>
      committed &&
      !rolledBack &&
      window.RMLResoniteApiCatalog ===
        catalog &&
      window.RMLFrooxComponentCatalog ===
        catalog &&
      window.RMLCatalogDiffReport ===
        compatibility;
    const commit = () => {
      if (rolledBack || notified) {
        return false;
      }
      if (committed) return verify();
      try {
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
        committed = true;
        return verify();
      } catch (error) {
        restorePreviousDescriptors();
        rolledBack = true;
        throw error;
      }
    };
    const rollback = () => {
      if (
        !committed ||
        rolledBack ||
        notified
      ) {
        return false;
      }
      restorePreviousDescriptors();
      rolledBack = true;
      return true;
    };
    const notify = () => {
      if (
        notified ||
        !verify()
      ) {
        return false;
      }
      notified = true;
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
      return true;
    };

    return Object.freeze({
      catalog,
      compatibility,
      commit,
      verify,
      rollback,
      notify
    });
  }

  let scannerCheckPromise = null;
  let scannerCheckGeneration = -1;
  let cachedCatalogRecord = null;
  let cachedCatalogStatus = null;
  let catalogAvailabilityKnown = false;
  let catalogAvailable = false;
  let cachedCatalogReadPromise = null;
  let catalogDemandManifest = null;
  let catalogDemandState = null;
  let catalogDemandHydrationPromise =
    Promise.resolve();
  let catalogDemandIndexWritePromise = null;
  let catalogDemandPaletteManifest = null;
  let catalogDemandPalettePublication =
    Object.freeze({
      entries: Object.freeze([]),
      revision: "",
      contentHash: "",
      catalogFingerprint: ""
    });
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

  function updateStatus() {
    const element =
      document.getElementById(
        "api-catalog-state"
      );

    if (!element) {
      return;
    }

    const connection =
      window.RMLRuntimeBridge
        ?.getConnectionState?.() ||
      null;

    if (
      connection?.mode === "checking" ||
      connection?.mode === "live"
    ) {
      return;
    }

    const catalog =
      statusCatalog() ||
      cachedCatalogStatus;

    if (
      catalogAvailabilityKnown &&
      catalogAvailable !== true &&
      !catalog
    ) {
      element.dataset.source =
        "unavailable";
      element.textContent =
        window.RMLI18n.t("{{i18n:index.text.87602dd154de}}");
      element.removeAttribute("title");
      element.setAttribute(
        "aria-label",
        window.RMLI18n.t("{{i18n:index.text.87602dd154de}}")
      );
      return;
    }
    if (!catalog) {
      element.dataset.source =
        "unavailable";
      element.textContent =
        window.RMLI18n.t("{{i18n:index.text.87602dd154de}}");
      element.removeAttribute(
        "title"
      );
      element.setAttribute(
        "aria-label",
        window.RMLI18n.t("{{i18n:index.text.87602dd154de}}")
      );
      return;
    }

    element.dataset.source = "cache";
    element.textContent =
      window.RMLI18n.t("{{i18n:js.presentation.925dcc9e0d7e}}");

    element.setAttribute(
      "aria-label",
      element.textContent
    );
  }

  function updateUnavailableStatus() {
    updateStatus();
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
        throw new TypeError(window.RMLI18n.t("ui.literal.1ff18edb1614"));
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
        CATALOG_TRANSFER_TIMEOUT_MS,
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
          ? window.RMLI18n.t("ui.literal.0bac37a95aac")
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
        window.RMLI18n.t("ui.literal.d449d34b5f6e")
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
              window.RMLI18n.t("ui.literal.cb6d55c78f0b")
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
              window.RMLI18n.t("ui.literal.96ef78a457d3")
            )
          );
        request.onblocked =
          () => reject(
            new Error(
              window.RMLI18n.t("ui.literal.cbb79c27ce96")
            )
          );
      }
    );
  }

  function readCatalogCacheValue(
    database,
    key
  ) {
    return new Promise(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            CACHE_STORE_NAME,
            "readonly"
          );
        const request = transaction
          .objectStore(CACHE_STORE_NAME)
          .get(key);
        request.onsuccess = () =>
          resolve(request.result || null);
        request.onerror = () =>
          reject(
            request.error ||
            new Error(
              window.RMLI18n.t("ui.literal.0e2d6d316dae")
            )
          );
      }
    );
  }

  function readCatalogCacheRecord(
    database
  ) {
    return readCatalogCacheValue(
      database,
      CACHE_RECORD_KEY
    );
  }

  function storeCatalogCacheRecord(
    database,
    record
  ) {
    return new Promise(
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
              window.RMLI18n.t("ui.literal.b86a898007fb")
            )
          );
        transaction.onabort =
          () => reject(
            transaction.error ||
            new Error(
              window.RMLI18n.t("ui.literal.a4e8e8baf994")
            )
          );
      }
    );
  }

  function commitCatalogCacheManifest(
    database,
    manifest
  ) {
    return new Promise(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            CACHE_STORE_NAME,
            "readwrite"
          );
        const store = transaction.objectStore(
          CACHE_STORE_NAME
        );
        store.put(manifest);
        store.put({
          id: CACHE_ACTIVE_RECORD_KEY,
          schemaVersion:
            CACHE_CHUNK_RECORD_SCHEMA_VERSION,
          generation: manifest.generation,
          contentHash: manifest.contentHash
        });
        transaction.oncomplete =
          () => resolve(true);
        transaction.onerror =
          () => reject(
            transaction.error ||
            new Error(
              window.RMLI18n.t("ui.literal.4b255e933f18")
            )
          );
        transaction.onabort =
          () => reject(
            transaction.error ||
            new Error(
              window.RMLI18n.t("ui.literal.dd513fe319e9")
            )
          );
      }
    );
  }

  function deleteCatalogCacheKeys(
    database,
    keys
  ) {
    if (!Array.isArray(keys) || keys.length === 0) {
      return Promise.resolve(true);
    }
    return new Promise(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            CACHE_STORE_NAME,
            "readwrite"
          );
        const store = transaction.objectStore(
          CACHE_STORE_NAME
        );
        for (const key of keys) {
          store.delete(key);
        }
        transaction.oncomplete =
          () => resolve(true);
        transaction.onerror =
          () => reject(
            transaction.error ||
            new Error(
              window.RMLI18n.t("ui.literal.98dc843f8986")
            )
          );
        transaction.onabort =
          () => reject(
            transaction.error ||
            new Error(
              window.RMLI18n.t("ui.literal.7fb445caf1a2")
            )
          );
      }
    );
  }

  function catalogCacheManifestIntegrity(
    record
  ) {
    return {
      schemaVersion: Number(
        record?.schemaVersion
      ),
      format: String(record?.format || ""),
      generation: String(
        record?.generation || ""
      ),
      fingerprint: String(
        record?.fingerprint || ""
      ).trim().toLowerCase(),
      chunkCount: Number(
        record?.chunkCount
      ),
      chunkTargetBytes: Number(
        record?.chunkTargetBytes
      ),
      chunkMaximumBytes: Number(
        record?.chunkMaximumBytes
      ),
      root: record?.root,
      chunks: record?.chunks
    };
  }

  function validCatalogCacheManifest(
    record
  ) {
    const generation = String(
      record?.generation || ""
    );
    const chunks = record?.chunks;
    const chunkCount = record?.chunkCount;
    return Boolean(
      String(record?.id || "") ===
        CACHE_RECORD_KEY &&
      record?.schemaVersion ===
        CACHE_RECORD_SCHEMA_VERSION &&
      String(record?.format || "") ===
        CACHE_CHUNK_FORMAT &&
      String(
        record?.contentHashAlgorithm || ""
      ) === CACHE_CONTENT_HASH_ALGORITHM &&
      /^[a-f0-9]{64}$/.test(
        String(record?.contentHash || "")
          .trim().toLowerCase()
      ) &&
      /^[a-z0-9-]{12,96}$/i.test(
        generation
      ) &&
      /^[a-f0-9]{64}$/.test(
        String(record?.fingerprint || "")
          .trim().toLowerCase()
      ) &&
      Number.isInteger(chunkCount) &&
      chunkCount >= 0 &&
      chunkCount <= CACHE_CHUNK_MAX_COUNT &&
      record?.chunkTargetBytes ===
        CACHE_CHUNK_TARGET_BYTES &&
      record?.chunkMaximumBytes ===
        CACHE_CHUNK_MAX_BYTES &&
      Array.isArray(chunks) &&
      chunks.length === chunkCount &&
      chunks.every((chunk, index) =>
        Number.isInteger(chunk?.index) &&
        chunk.index === index &&
        /^(array|object)$/.test(
          String(chunk?.kind || "")
        ) &&
        Number.isInteger(chunk?.count) &&
        chunk.count > 0 &&
        Number.isInteger(chunk?.byteLength) &&
        chunk.byteLength > 0 &&
        chunk.byteLength <=
          CACHE_CHUNK_MAX_BYTES &&
        /^[a-f0-9]{64}$/.test(
          String(chunk?.hash || "")
        )
      ) &&
      record?.root &&
      typeof record.root === "object"
    );
  }

  function readActiveCatalogChunk(
    database,
    manifest,
    index
  ) {
    return new Promise(
      (resolve, reject) => {
        const transaction =
          database.transaction(
            CACHE_STORE_NAME,
            "readonly"
          );
        const store = transaction.objectStore(
          CACHE_STORE_NAME
        );
        const chunkRequest = store.get(
          catalogCacheChunkId(
            manifest.generation,
            index
          )
        );
        chunkRequest.onsuccess = () => {
          resolve(chunkRequest.result || null);
        };
        const fail = request =>
          reject(
            request.error ||
            new Error(
              window.RMLI18n.t("ui.literal.cbfab94cc829")
            )
          );
        chunkRequest.onerror = () =>
          fail(chunkRequest);
      }
    );
  }

  function catalogDemandManifestIntegrity(
    manifest
  ) {
    return {
      schemaVersion: Number(
        manifest?.schemaVersion
      ),
      format: String(
        manifest?.format || ""
      ),
      fullGeneration: String(
        manifest?.fullGeneration || ""
      ),
      fullContentHash: String(
        manifest?.fullContentHash || ""
      ),
      fullChunkCount: Number(
        manifest?.fullChunkCount
      ),
      fullByteLength: Number(
        manifest?.fullByteLength
      ),
      fingerprint: String(
        manifest?.fingerprint || ""
      ).trim().toLowerCase(),
      builderModuleId: String(
        manifest?.builderModuleId || ""
      ),
      apiFactoryVersion: Number(
        manifest?.apiFactoryVersion
      ),
      root: manifest?.root,
      typeRouting:
        manifest?.typeRouting,
      operatorIndex:
        manifest?.operatorIndex,
      groups: manifest?.groups,
      memberKinds: manifest?.memberKinds,
      symbols: manifest?.symbols,
      bootstrapOwners:
        manifest?.bootstrapOwners
    };
  }

  async function catalogDemandManifestHash(
    manifest
  ) {
    const encoded = new TextEncoder().encode(
      JSON.stringify(
        catalogDemandManifestIntegrity(
          manifest
        )
      )
    );
    if (
      encoded.byteLength >
        DEMAND_CACHE_MANIFEST_MAX_BYTES
    ) {
      throw new Error(
        `A catalog demand index exceeds the ${Math.floor(DEMAND_CACHE_MANIFEST_MAX_BYTES / (1024 * 1024))} MiB integrity limit.`
      );
    }
    const subtle = globalThis.crypto?.subtle;
    if (
      !subtle ||
      typeof subtle.digest !== "function"
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.8845daae2fbf")
      );
    }
    return Object.freeze({
      hash: catalogDigestHex(
        await subtle.digest(
          "SHA-256",
          encoded
        )
      ),
      byteLength: encoded.byteLength
    });
  }

  function validCatalogDemandManifest(
    manifest,
    fullManifest
  ) {
    const typeRouting =
      manifest?.typeRouting;
    const operatorIndex =
      manifest?.operatorIndex;
    const groups = manifest?.groups;
    const memberKinds =
      manifest?.memberKinds;
    const symbols = manifest?.symbols;
    return Boolean(
      String(manifest?.id || "") ===
        DEMAND_CACHE_MANIFEST_KEY &&
      Number(manifest?.schemaVersion) ===
        DEMAND_CACHE_SCHEMA_VERSION &&
      String(manifest?.format || "") ===
        DEMAND_CACHE_FORMAT &&
      String(
        manifest?.contentHashAlgorithm || ""
      ) === "sha256-demand-index-v2" &&
      /^[a-f0-9]{64}$/.test(
        String(manifest?.contentHash || "")
          .trim().toLowerCase()
      ) &&
      String(manifest?.fullGeneration || "") ===
        String(fullManifest?.generation || "") &&
      String(manifest?.fullContentHash || "") ===
        String(fullManifest?.contentHash || "") &&
      String(manifest?.fingerprint || "")
        .trim().toLowerCase() ===
        String(fullManifest?.fingerprint || "")
          .trim().toLowerCase() &&
      Number(manifest?.fullChunkCount) ===
        Number(fullManifest?.chunkCount) &&
      Number.isFinite(
        Number(manifest?.fullByteLength)
      ) &&
      Number(manifest?.fullByteLength) > 0 &&
      Number(manifest?.apiFactoryVersion) ===
        REQUIRED_API_FACTORY_VERSION &&
      manifest?.root &&
      typeof manifest.root === "object" &&
      !Array.isArray(manifest.root) &&
      Array.isArray(typeRouting) &&
      typeRouting.length > 0 &&
      typeRouting.length <=
        CACHE_CHUNK_MAX_CONTAINER_ENTRIES &&
      typeRouting.every(entry =>
        Array.isArray(entry) &&
        entry.length === 3 &&
        Boolean(String(entry[0] || "").trim()) &&
        (
          Number(entry[1]) === -1 ||
          (
            Number.isInteger(Number(entry[1])) &&
            Number(entry[1]) >= 0
          )
        ) &&
        (
          Number(entry[2]) === -1 ||
          (
            Number.isInteger(Number(entry[2])) &&
            Number(entry[2]) >= 0
          )
        )
      ) &&
      Array.isArray(groups) &&
      groups.every(value =>
        typeof value === "string"
      ) &&
      Array.isArray(memberKinds) &&
      memberKinds.every(value =>
        typeof value === "string"
      ) &&
      Array.isArray(symbols) &&
      symbols.every(value =>
        typeof value === "string"
      ) &&
      Array.isArray(operatorIndex) &&
      operatorIndex.length > 0 &&
      operatorIndex.length <=
        CACHE_CHUNK_MAX_CONTAINER_ENTRIES &&
      operatorIndex.every(entry =>
        Array.isArray(entry) &&
        entry.length === 8 &&
        String(entry[0] || "")
          .startsWith("api.") &&
        Number.isInteger(Number(entry[1])) &&
        Number(entry[1]) >= 0 &&
        Number(entry[1]) < typeRouting.length &&
        typeof entry[2] === "string" &&
        Number.isInteger(Number(entry[3])) &&
        Number(entry[3]) >= -1 &&
        Number(entry[3]) < groups.length &&
        Number.isInteger(Number(entry[4])) &&
        Number(entry[4]) >= 0 &&
        Number.isInteger(Number(entry[5])) &&
        Number(entry[5]) >= 0 &&
        Number(entry[5]) < memberKinds.length &&
        Number.isInteger(Number(entry[6])) &&
        Number(entry[6]) >= 0 &&
        Number(entry[6]) < symbols.length &&
        typeof entry[7] === "string"
      ) &&
      Array.isArray(
        manifest?.bootstrapOwners
      ) &&
      manifest.bootstrapOwners.length > 0
    );
  }

  async function verifiedCatalogDemandManifest(
    database,
    fullManifest
  ) {
    const manifest =
      await readCatalogCacheValue(
        database,
        DEMAND_CACHE_MANIFEST_KEY
      );
    if (
      !validCatalogDemandManifest(
        manifest,
        fullManifest
      )
    ) {
      return null;
    }
    const actual =
      await catalogDemandManifestHash(
        manifest
      );
    if (
      actual.hash !==
        String(manifest.contentHash)
          .trim().toLowerCase()
    ) {
      return null;
    }
    const active =
      await readCatalogCacheValue(
        database,
        CACHE_ACTIVE_RECORD_KEY
      );
    if (
      Number(active?.schemaVersion) !==
        CACHE_CHUNK_RECORD_SCHEMA_VERSION ||
      String(active?.generation || "") !==
        String(fullManifest.generation) ||
      String(active?.contentHash || "") !==
        String(fullManifest.contentHash)
    ) {
      return null;
    }
    return Object.freeze(manifest);
  }

  function catalogDemandRootWithoutRows(raw) {
    const root = {};
    for (const [key, value] of
      Object.entries(raw || {})) {
      if (key === "types" || key === "enums") {
        continue;
      }
      root[key] = value;
    }
    return root;
  }

  function catalogDemandRouting(raw) {
    const routing = new Map();
    const remember = (
      fullName,
      position,
      slot
    ) => {
      const owner = catalogContractType(
        fullName
      );
      if (!owner) return;
      const current =
        routing.get(owner) || [-1, -1];
      current[slot] = position;
      routing.set(owner, current);
    };
    catalogTypes(raw).forEach(
      (row, index) =>
        remember(row?.fullName, index, 0)
    );
    (Array.isArray(raw?.enums)
      ? raw.enums
      : []).forEach(
      (row, index) =>
        remember(row?.fullName, index, 1)
    );
    return routing;
  }

  function yieldCatalogDemandIndexWork() {
    if (
      globalThis.scheduler &&
      typeof globalThis.scheduler.postTask ===
        "function"
    ) {
      return globalThis.scheduler.postTask(
        () => {},
        { priority: "background" }
      );
    }
    return new Promise(resolve => {
      window.window.RMLScheduleTask(resolve);
    });
  }

  async function catalogDemandRegistryIndex(
    typeRouting
  ) {
    const definitions =
      window.RMLModNodeRegistry
        ?.getNodeDefinitions?.();
    if (
      !definitions ||
      typeof definitions !== "object" ||
      Array.isArray(definitions)
    ) {
      return null;
    }
    const ownerIndexes = new Map(
      typeRouting.map((entry, index) => [
        entry[0],
        index
      ])
    );
    const groups = [];
    const groupIndexes = new Map();
    const memberKinds = [];
    const memberKindIndexes = new Map();
    const symbols = [];
    const symbolIndexes = new Map();
    const intern = (value, rows, indexes) => {
      const text = String(value || "");
      if (!indexes.has(text)) {
        indexes.set(text, rows.length);
        rows.push(text);
      }
      return indexes.get(text);
    };
    const operatorIndex = [];
    let visited = 0;
    for (const operatorId in definitions) {
      if (!Object.hasOwn(definitions, operatorId)) {
        continue;
      }
      visited += 1;
      if (visited % 256 === 0) {
        await yieldCatalogDemandIndexWork();
      }
      const definition = definitions[operatorId];
      if (
        !operatorId.startsWith("api.") ||
        definition?.catalogGenerated !== true ||
        definition?.legacyCatalogAlias === true
      ) {
        continue;
      }
      const owner = catalogContractType(
        definition?.apiVerification
          ?.ownerType ||
        definition?.catalogType || ""
      );
      const ownerIndex =
        ownerIndexes.get(owner);
      if (
        !owner ||
        !Number.isInteger(ownerIndex)
      ) {
        continue;
      }
      const hidden =
        definition.hiddenFromPalette === true ||
        definition.paletteHidden === true;
      const flags =
        (definition.expertOnly === true ? 1 : 0) |
        (definition.customCSharpCatalogNode === true
          ? 2
          : 0) |
        (hidden ? 4 : 0);
      const searchText = String(
        definition.apiSearchText || ""
      );
      operatorIndex.push([
        operatorId,
        ownerIndex,
        hidden
          ? ""
          : String(
              definition.title || operatorId
            ),
        hidden
          ? -1
          : intern(
              definition.group || "Other",
              groups,
              groupIndexes
            ),
        flags,
        intern(
          definition.apiMemberKind || "",
          memberKinds,
          memberKindIndexes
        ),
        intern(
          definition.symbol || "API",
          symbols,
          symbolIndexes
        ),
        searchText && owner
          ? searchText
              .split(owner)
              .join(" ")
              .trim()
          : searchText
      ]);
    }
    if (operatorIndex.length === 0) {
      return null;
    }
    return {
      operatorIndex,
      groups,
      memberKinds,
      symbols
    };
  }

  async function writeCatalogDemandIndex(
    database,
    raw,
    fullManifest
  ) {
    if (
      !validCatalogCacheManifest(
        fullManifest
      ) ||
      !strictCachedScannerContract(raw)
    ) {
      return false;
    }
    const routing =
      catalogDemandRouting(raw);
    const typeRouting =
      [...routing.entries()]
        .map(([owner, positions]) => [
          owner,
          positions[0],
          positions[1]
        ])
        .sort((left, right) =>
          left[0].localeCompare(right[0])
        );
    const registryIndex =
      await catalogDemandRegistryIndex(
        typeRouting
      );
    if (!registryIndex) return false;
    const bootstrapOwner =
      routing.has("System.Object")
        ? "System.Object"
        : routing.keys().next().value;
    if (!bootstrapOwner) return false;
    const manifest = {
      id: DEMAND_CACHE_MANIFEST_KEY,
      schemaVersion:
        DEMAND_CACHE_SCHEMA_VERSION,
      format: DEMAND_CACHE_FORMAT,
      contentHashAlgorithm:
        "sha256-demand-index-v2",
      contentHash: "",
      createdAtUtc:
        new Date().toISOString(),
      fullGeneration:
        fullManifest.generation,
      fullContentHash:
        fullManifest.contentHash,
      fullChunkCount:
        fullManifest.chunkCount,
      fullByteLength:
        fullManifest.chunks.reduce(
          (total, chunk) =>
            total + Math.max(
              0,
              Number(chunk?.byteLength) || 0
            ),
          0
        ),
      fingerprint:
        scannerCatalogFingerprint(raw),
      builderModuleId:
        CATALOG_LOADER_MODULE_ID,
      apiFactoryVersion:
        REQUIRED_API_FACTORY_VERSION,
      root:
        catalogDemandRootWithoutRows(raw),
      typeRouting,
      operatorIndex:
        registryIndex.operatorIndex,
      groups: registryIndex.groups,
      memberKinds:
        registryIndex.memberKinds,
      symbols: registryIndex.symbols,
      bootstrapOwners: [bootstrapOwner]
    };
    const integrity =
      await catalogDemandManifestHash(
        manifest
      );
    manifest.contentHash = integrity.hash;
    await storeCatalogCacheRecord(
      database,
      manifest
    );
    catalogDemandManifest =
      Object.freeze(manifest);
    return true;
  }

  function catalogDemandArrayDescriptor(
    rootDescriptor,
    property
  ) {
    if (
      rootDescriptor?.kind !== "object" ||
      !Array.isArray(rootDescriptor.segments)
    ) {
      return null;
    }
    const segment =
      rootDescriptor.segments.find(
        value =>
          value?.kind === "child" &&
          value.key === property
      );
    return segment?.node || null;
  }

  async function readVerifiedCatalogDemandChunk(
    database,
    manifest,
    index,
    chunkCache
  ) {
    if (chunkCache.has(index)) {
      return chunkCache.get(index);
    }
    const expected =
      manifest.chunks[index];
    const record =
      await readActiveCatalogChunk(
        database,
        manifest,
        index
      );
    if (
      !expected ||
      !record ||
      String(record.generation || "") !==
        manifest.generation ||
      Number(record.index) !== index ||
      String(record.kind || "") !==
        expected.kind ||
      Number(record.count) !==
        expected.count ||
      Number(record.byteLength) !==
        expected.byteLength ||
      String(record.hash || "") !==
        expected.hash ||
      !Array.isArray(record.payload)
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.c8c04b03cbf5")
      );
    }
    const actual =
      await catalogCacheBoundedHash(
        record.payload
      );
    if (
      actual.hash !== expected.hash ||
      actual.byteLength !==
        expected.byteLength
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.3cea6eabf747")
      );
    }
    chunkCache.set(index, record);
    return record;
  }

  async function readCatalogDemandArrayEntry(
    database,
    state,
    property,
    index
  ) {
    if (!Number.isInteger(index) || index < 0) {
      return null;
    }
    const descriptor =
      catalogDemandArrayDescriptor(
        state.fullManifest.root,
        property
      );
    if (descriptor) {
      for (const segment of
        descriptor.segments || []) {
        if (
          segment?.kind === "child" &&
          Number(segment.key) === index
        ) {
          return reconstructCatalogCacheNode(
            segment.node,
            {
              database,
              manifest:
                state.fullManifest,
              usedChunks: new Set()
            }
          );
        }
        if (
          segment?.kind === "chunk" &&
          Number.isInteger(segment.start) &&
          Number.isInteger(segment.count) &&
          index >= segment.start &&
          index <
            segment.start + segment.count
        ) {
          const record =
            await readVerifiedCatalogDemandChunk(
              database,
              state.fullManifest,
              Number(segment.index),
              state.chunkCache
            );
          return record.payload[
            index - segment.start
          ] || null;
        }
      }
      throw new Error(
        `Catalog demand index ${property}[${index}] is not represented by the full cache tree.`
      );
    }

    for (const segment of
      state.fullManifest.root?.segments || []) {
      if (
        segment?.kind !== "chunk" ||
        !Array.isArray(segment.keys) ||
        !segment.keys.includes(property)
      ) {
        continue;
      }
      const record =
        await readVerifiedCatalogDemandChunk(
          database,
          state.fullManifest,
          Number(segment.index),
          state.chunkCache
        );
      const pair = record.payload.find(
        value =>
          Array.isArray(value) &&
          value[0] === property
      );
      return Array.isArray(pair?.[1])
        ? pair[1][index] || null
        : null;
    }
    throw new Error(
      `Catalog demand source '${property}' is unavailable.`
    );
  }

  function catalogDemandTypeHeader(row) {
    if (!row || typeof row !== "object") {
      return null;
    }
    const excluded = new Set([
      "constructors",
      "methods",
      "properties",
      "fields",
      "events"
    ]);
    const header = {};
    for (const [key, value] of
      Object.entries(row)) {
      if (!excluded.has(key)) {
        header[key] = value;
      }
    }
    return header;
  }

  function collectCatalogDemandTypeReferences(
    value,
    routing,
    output = new Set(),
    visited = new WeakSet()
  ) {
    if (typeof value === "string") {
      const exact = catalogContractType(value);
      if (routing.has(exact)) {
        output.add(exact);
      }
      const matches = value.match(
        /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_+]*)+/g
      ) || [];
      for (const match of matches) {
        const candidate =
          catalogContractType(match);
        if (routing.has(candidate)) {
          output.add(candidate);
        }
      }
      return output;
    }
    if (
      !value ||
      typeof value !== "object" ||
      visited.has(value)
    ) {
      return output;
    }
    visited.add(value);
    if (Array.isArray(value)) {
      for (const item of value) {
        collectCatalogDemandTypeReferences(
          item,
          routing,
          output,
          visited
        );
      }
    } else {
      for (const item of Object.values(value)) {
        collectCatalogDemandTypeReferences(
          item,
          routing,
          output,
          visited
        );
      }
    }
    return output;
  }

  function currentCatalogDemandRequirements() {
    const result = {
      operatorIds: new Set(),
      portableOwners: new Map()
    };
    const graph =
      window.RMLBuilderBridge
        ?.getExtensionStateReference?.(
          "typedNodeGraph"
        );
    if (!graph || typeof graph !== "object") {
      return result;
    }
    const visited = new WeakSet();
    const stack = [graph];
    let inspected = 0;
    while (stack.length > 0) {
      const value = stack.pop();
      if (
        !value ||
        typeof value !== "object" ||
        visited.has(value)
      ) {
        continue;
      }
      visited.add(value);
      inspected += 1;
      if (inspected > 2_000_000) {
        throw new Error(
          window.RMLI18n.t("ui.literal.aa632855d555")
        );
      }
      const operatorId = String(
        value.operatorId || ""
      ).trim();
      const owner = catalogContractType(
        value.apiContract?.ownerType || ""
      );
      if (operatorId.startsWith("api.")) {
        result.operatorIds.add(operatorId);
        if (owner) {
          result.portableOwners.set(
            operatorId,
            owner
          );
        }
      }
      for (const child of
        Array.isArray(value)
          ? value
          : Object.values(value)) {
        if (child && typeof child === "object") {
          stack.push(child);
        }
      }
    }
    return result;
  }

  async function encodeCatalogCacheNode(
    value,
    context,
    depth = 0
  ) {
    if (
      depth > CACHE_CHUNK_MAX_DEPTH ||
      !value ||
      typeof value !== "object"
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.228c75d00e0b")
      );
    }
    const isArray = Array.isArray(value);
    const descriptor = isArray
      ? {
          kind: "array",
          length: value.length,
          segments: []
        }
      : {
          kind: "object",
          segments: []
        };
    const directKeys = Object.keys(value);
    if (
      (
        isArray
          ? value.length
          : directKeys.length
      ) > CACHE_CHUNK_MAX_CONTAINER_ENTRIES
    ) {
      throw new Error(
        `A catalog cache container exceeds ${CACHE_CHUNK_MAX_CONTAINER_ENTRIES} entries.`
      );
    }
    if (
      isArray &&
      (
        directKeys.length !== value.length ||
        directKeys.some((key, index) =>
          key !== String(index)
        )
      )
    ) {
      throw new TypeError(
        window.RMLI18n.t("ui.literal.934bf3607465")
      );
    }
    const entryCount = isArray
      ? value.length
      : directKeys.length;
    let pending = [];
    let pendingBytes = 2;
    let pendingStart = 0;

    const writePending = async () => {
      if (pending.length === 0) return;
      const payload = isArray
        ? pending.map(entry => entry[1])
        : pending.map(entry => [
            entry[0],
            entry[1]
          ]);
      const integrity =
        await catalogCacheBoundedHash(
          payload
        );
      const index = context.chunks.length;
      if (index >= CACHE_CHUNK_MAX_COUNT) {
        throw new Error(
          `Catalog cache requires more than ${CACHE_CHUNK_MAX_COUNT} chunks.`
        );
      }
      const expected = {
        index,
        kind: isArray ? "array" : "object",
        count: pending.length,
        byteLength: integrity.byteLength,
        hash: integrity.hash
      };
      await storeCatalogCacheRecord(
        context.database,
        {
          id: CACHE_STAGING_RECORD_KEY,
          schemaVersion:
            CACHE_CHUNK_RECORD_SCHEMA_VERSION,
          generation: context.generation,
          chunkCount: index + 1,
          createdAtUtc: context.createdAtUtc,
          updatedAtUtc:
            new Date().toISOString()
        }
      );
      context.plannedChunkCount =
        index + 1;
      await storeCatalogCacheRecord(
        context.database,
        {
          id: catalogCacheChunkId(
            context.generation,
            index
          ),
          schemaVersion:
            CACHE_CHUNK_RECORD_SCHEMA_VERSION,
          generation: context.generation,
          index,
          kind: expected.kind,
          count: expected.count,
          byteLength: expected.byteLength,
          hash: expected.hash,
          payload
        }
      );
      context.chunks.push(expected);
      descriptor.segments.push(
        isArray
          ? {
              kind: "chunk",
              index,
              start: pendingStart,
              count: pending.length
            }
          : {
              kind: "chunk",
              index,
              keys: pending.map(entry =>
                entry[0]
              )
            }
      );
      pending = [];
      pendingBytes = 2;
      if (context.chunks.length % 4 === 0) {
        await yieldCatalogCacheWork();
      }
    };

    for (
      let entryIndex = 0;
      entryIndex < entryCount;
      entryIndex += 1
    ) {
      const entryKey = isArray
        ? entryIndex
        : directKeys[entryIndex];
      const entryValue = value[entryKey];
      if (
        !isArray &&
        boundedCatalogJson(
          String(entryKey),
          CACHE_CHUNK_MAX_KEY_BYTES
        ).tooLarge
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.8fae71cc7c22")
        );
      }
      const candidateValue = isArray
        ? entryValue
        : [entryKey, entryValue];
      let candidate = boundedCatalogJson(
        candidateValue,
        CACHE_CHUNK_TARGET_BYTES - 2
      );
      const structuralCandidate = Boolean(
        entryValue &&
        typeof entryValue === "object"
      );
      if (
        candidate.tooLarge &&
        !structuralCandidate
      ) {
        candidate = boundedCatalogJson(
          candidateValue,
          CACHE_CHUNK_MAX_BYTES - 2
        );
      }
      if (
        candidate.tooLarge
      ) {
        await writePending();
        if (
          !structuralCandidate
        ) {
          throw new Error(
            `A single catalog cache value exceeds ${Math.floor(CACHE_CHUNK_MAX_BYTES / (1024 * 1024))} MiB.`
          );
        }
        descriptor.segments.push({
          kind: "child",
          key: entryKey,
          node: await encodeCatalogCacheNode(
            entryValue,
            context,
            depth + 1
          )
        });
        pendingStart = entryIndex + 1;
        continue;
      }
      const addedBytes =
        candidate.byteLength +
        (pending.length > 0 ? 1 : 0);
      if (
        pending.length > 0 &&
        pendingBytes + addedBytes >
          CACHE_CHUNK_TARGET_BYTES
      ) {
        await writePending();
        pendingStart = entryIndex;
      }
      pending.push([
        entryKey,
        entryValue
      ]);
      pendingBytes +=
        candidate.byteLength +
        (pending.length > 1 ? 1 : 0);
    }
    await writePending();
    return descriptor;
  }

  async function reconstructCatalogCacheNode(
    descriptor,
    context,
    depth = 0
  ) {
    if (
      depth > CACHE_CHUNK_MAX_DEPTH ||
      !descriptor ||
      typeof descriptor !== "object" ||
      !Array.isArray(descriptor.segments) ||
      !/^(array|object)$/.test(
        String(descriptor.kind || "")
      )
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.677b78ed963d")
      );
    }
    const isArray =
      descriptor.kind === "array";
    if (
      isArray &&
      (!Number.isInteger(descriptor.length) ||
        descriptor.length < 0 ||
        descriptor.length >
          CACHE_CHUNK_MAX_CONTAINER_ENTRIES)
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.161870a3e3e5")
      );
    }
    const result = isArray
      ? new Array(descriptor.length)
      : {};
    let expectedPosition = 0;
    const objectKeys = new Set();

    for (const segment of descriptor.segments) {
      if (segment?.kind === "child") {
        const key = segment.key;
        if (
          isArray
            ? !Number.isInteger(key) ||
              key !== expectedPosition
            : typeof key !== "string" ||
              objectKeys.has(key)
        ) {
          throw new Error(
            window.RMLI18n.t("ui.literal.8dc8afdf2f70")
          );
        }
        const child =
          await reconstructCatalogCacheNode(
            segment.node,
            context,
            depth + 1
          );
        if (isArray) {
          result[key] = child;
        } else {
          Object.defineProperty(
            result,
            key,
            {
              value: child,
              writable: true,
              enumerable: true,
              configurable: true
            }
          );
        }
        if (isArray) {
          expectedPosition += 1;
        } else {
          objectKeys.add(key);
        }
        continue;
      }
      if (segment?.kind !== "chunk") {
        throw new Error(
          window.RMLI18n.t("ui.literal.fc3384170478")
        );
      }
      const index = Number(segment.index);
      if (
        !Number.isInteger(index) ||
        index < 0 ||
        index >= context.manifest.chunkCount ||
        context.usedChunks.has(index)
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.113bda4f77a0")
        );
      }
      const expected =
        context.manifest.chunks[index];
      if (
        expected.kind !==
          (isArray ? "array" : "object")
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.427e6101c2b3")
        );
      }
      const record = await readActiveCatalogChunk(
        context.database,
        context.manifest,
        index
      );
      if (
        !record ||
        String(record.id || "") !==
          catalogCacheChunkId(
            context.manifest.generation,
            index
          ) ||
        Number(record.schemaVersion) !==
          CACHE_CHUNK_RECORD_SCHEMA_VERSION ||
        String(record.generation || "") !==
          context.manifest.generation ||
        Number(record.index) !== index ||
        String(record.kind || "") !==
          expected.kind ||
        Number(record.count) !==
          expected.count ||
        Number(record.byteLength) !==
          expected.byteLength ||
        String(record.hash || "") !==
          expected.hash ||
        !Array.isArray(record.payload)
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.db6737b48063")
        );
      }
      const actual =
        await catalogCacheBoundedHash(
          record.payload
        );
      if (
        actual.hash !== expected.hash ||
        actual.byteLength !==
          expected.byteLength ||
        record.payload.length !==
          expected.count
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.147e0a6810ed")
        );
      }
      context.usedChunks.add(index);

      if (isArray) {
        if (
        !Number.isInteger(segment.start) ||
          segment.start !==
            expectedPosition ||
          !Number.isInteger(segment.count) ||
          segment.count !==
            record.payload.length
        ) {
          throw new Error(
            window.RMLI18n.t("ui.literal.ce466ce6f89b")
          );
        }
        for (const item of record.payload) {
          result[expectedPosition] = item;
          expectedPosition += 1;
        }
      } else {
        const keys = segment.keys;
        if (
          !Array.isArray(keys) ||
          keys.length !== record.payload.length
        ) {
          throw new Error(
            window.RMLI18n.t("ui.literal.824f8fbf205d")
          );
        }
        for (
          let position = 0;
          position < keys.length;
          position += 1
        ) {
          const pair = record.payload[position];
          const key = keys[position];
          if (
            typeof key !== "string" ||
            objectKeys.has(key) ||
            !Array.isArray(pair) ||
            pair.length !== 2 ||
            pair[0] !== key
          ) {
            throw new Error(
              window.RMLI18n.t("ui.literal.f1aa412be92b")
            );
          }
          Object.defineProperty(
            result,
            key,
            {
              value: pair[1],
              writable: true,
              enumerable: true,
              configurable: true
            }
          );
          objectKeys.add(key);
        }
      }
      if (context.usedChunks.size % 4 === 0) {
        await yieldCatalogCacheWork();
      }
    }
    if (
      isArray &&
      expectedPosition !== descriptor.length
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.1305cb5454d4")
      );
    }
    return result;
  }

  async function verifiedCurrentCacheRecord(
    database,
    record
  ) {
    if (!validCatalogCacheManifest(record)) {
      return null;
    }
    const expectedContentHash = String(
      record.contentHash
    ).trim().toLowerCase();
    const manifestIntegrity =
      await catalogCacheBoundedHash(
        catalogCacheManifestIntegrity(
          record
        ),
        CACHE_MANIFEST_MAX_BYTES
      );
    if (
      manifestIntegrity.hash !==
        expectedContentHash
    ) {
      return null;
    }
    const active =
      await readCatalogCacheValue(
        database,
        CACHE_ACTIVE_RECORD_KEY
      );
    if (
      Number(active?.schemaVersion) !==
        CACHE_CHUNK_RECORD_SCHEMA_VERSION ||
      String(active?.generation || "") !==
        record.generation ||
      String(active?.contentHash || "") !==
        expectedContentHash
    ) {
      return null;
    }
    const context = {
      database,
      manifest: record,
      usedChunks: new Set()
    };
    const raw =
      await reconstructCatalogCacheNode(
        record.root,
        context
      );
    const finalActive =
      await readCatalogCacheValue(
        database,
        CACHE_ACTIVE_RECORD_KEY
      );
    if (
      Number(finalActive?.schemaVersion) !==
        CACHE_CHUNK_RECORD_SCHEMA_VERSION ||
      String(finalActive?.generation || "") !==
        record.generation ||
      String(finalActive?.contentHash || "") !==
        expectedContentHash
    ) {
      const error = new Error(
        window.RMLI18n.t("ui.literal.baef3b871808")
      );
      error.code =
        "RML_CATALOG_CACHE_GENERATION_CHANGED";
      throw error;
    }
    if (
      context.usedChunks.size !==
        record.chunkCount ||
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      !strictCachedScannerContract(raw)
    ) {
      return null;
    }
    const fingerprint =
      scannerCatalogFingerprint(raw);
    if (
      !fingerprint ||
      fingerprint !==
        String(record.fingerprint)
          .trim().toLowerCase()
    ) {
      return null;
    }
    return Object.freeze({
      ...record,
      fingerprint,
      contentHash: expectedContentHash,
      catalog:
        deepFreezeCatalogSnapshot(raw)
    });
  }

  function createCatalogDemandState(
    fullManifest,
    demandManifest
  ) {
    const typeRouting =
      demandManifest.typeRouting;
    const routing = new Map(
      typeRouting.map(
        entry => [
          catalogContractType(entry[0]),
          {
            typeIndex: Number(entry[1]),
            enumIndex: Number(entry[2])
          }
        ]
      )
    );
    return {
      fullManifest,
      manifest: demandManifest,
      routing,
      operatorOwners: new Map(
        demandManifest.operatorIndex.map(
          entry => [
            entry[0],
            typeRouting[Number(entry[1])][0]
          ]
        )
      ),
      bootstrapOwners: new Set(
        demandManifest.bootstrapOwners.map(
          catalogContractType
        )
      ),
      seedOwners: new Set(),
      dependencyOwners: new Set(),
      requiredOperatorIds: new Set(),
      rows: new Map(),
      chunkCache: new Map(),
      fullActive: false,
      fallbackReason: ""
    };
  }

  function resolveCatalogDemandOwners(
    state,
    operatorIds,
    portableOwners = new Map()
  ) {
    const owners = new Set();
    const unresolved = [];
    for (const rawId of operatorIds || []) {
      const operatorId = String(
        rawId || ""
      ).trim();
      if (!operatorId.startsWith("api.")) {
        continue;
      }
      const owner = catalogContractType(
        state.operatorOwners.get(
          operatorId
        ) ||
        portableOwners.get(operatorId) ||
        ""
      );
      if (!owner || !state.routing.has(owner)) {
        unresolved.push(operatorId);
        continue;
      }
      owners.add(owner);
      state.requiredOperatorIds.add(
        operatorId
      );
    }
    if (unresolved.length > 0) {
      const error = new Error(
        `The catalog demand index cannot route ${unresolved.length} stored API operator(s).`
      );
      error.code =
        "RML_CATALOG_DEMAND_UNROUTABLE";
      error.operatorIds = unresolved;
      throw error;
    }
    return owners;
  }

  async function loadCatalogDemandOwner(
    database,
    state,
    owner
  ) {
    if (state.rows.has(owner)) {
      return state.rows.get(owner);
    }
    const route = state.routing.get(owner);
    if (!route) {
      throw new Error(
        `The catalog demand owner '${owner}' is not indexed.`
      );
    }
    const typeRow = route.typeIndex >= 0
      ? await readCatalogDemandArrayEntry(
          database,
          state,
          "types",
          route.typeIndex
        )
      : null;
    const enumRow = route.enumIndex >= 0
      ? await readCatalogDemandArrayEntry(
          database,
          state,
          "enums",
          route.enumIndex
        )
      : null;
    if (
      !typeRow && !enumRow
    ) {
      throw new Error(
        `The indexed catalog owner '${owner}' has no cached row.`
      );
    }
    if (
      typeRow &&
      catalogContractType(typeRow.fullName) !==
        owner
    ) {
      throw new Error(
        `The cached catalog type row for '${owner}' does not match its demand index.`
      );
    }
    if (
      enumRow &&
      catalogContractType(enumRow.fullName) !==
        owner
    ) {
      throw new Error(
        `The cached catalog enum row for '${owner}' does not match its demand index.`
      );
    }
    const value = {
      owner,
      typeIndex: route.typeIndex,
      enumIndex: route.enumIndex,
      typeRow,
      enumRow
    };
    state.rows.set(owner, value);
    return value;
  }

  function catalogDemandSyntheticTypeHeader(
    owner,
    enumRow
  ) {
    return {
      fullName: owner,
      name: String(
        enumRow?.name ||
        owner.split(".").pop() ||
        owner
      ),
      kind: "enum",
      isValueType: true,
      assembly: String(
        enumRow?.assembly || ""
      )
    };
  }

  async function hydrateCatalogDemandOwners(
    database,
    state,
    requestedOwners
  ) {
    for (const owner of requestedOwners) {
      state.seedOwners.add(owner);
      state.dependencyOwners.delete(owner);
      await loadCatalogDemandOwner(
        database,
        state,
        owner
      );
    }
    for (const owner of
      state.bootstrapOwners) {
      if (!state.seedOwners.has(owner)) {
        state.dependencyOwners.add(owner);
      }
      await loadCatalogDemandOwner(
        database,
        state,
        owner
      );
    }

    const pending = [];
    const visited = new Set();
    for (const owner of state.seedOwners) {
      const entry = state.rows.get(owner);
      const references =
        collectCatalogDemandTypeReferences(
          [entry?.typeRow, entry?.enumRow],
          state.routing
        );
      for (const reference of references) {
        if (
          !state.seedOwners.has(reference) &&
          !state.dependencyOwners.has(reference)
        ) {
          state.dependencyOwners.add(reference);
          pending.push(reference);
        }
      }
    }
    for (const owner of state.bootstrapOwners) {
      if (!visited.has(owner)) {
        pending.push(owner);
      }
    }

    while (pending.length > 0) {
      const owner = pending.shift();
      if (visited.has(owner)) continue;
      visited.add(owner);
      if (visited.size > 100_000) {
        throw new Error(
          window.RMLI18n.t("ui.literal.984408e4bcda")
        );
      }
      const entry =
        await loadCatalogDemandOwner(
          database,
          state,
          owner
        );
      const header =
        catalogDemandTypeHeader(
          entry.typeRow
        ) ||
        catalogDemandSyntheticTypeHeader(
          owner,
          entry.enumRow
        );
      const references =
        collectCatalogDemandTypeReferences(
          header,
          state.routing
        );
      for (const reference of references) {
        if (
          reference !== owner &&
          !state.seedOwners.has(reference) &&
          !state.dependencyOwners.has(reference)
        ) {
          state.dependencyOwners.add(reference);
          pending.push(reference);
        }
      }
      if (visited.size % 64 === 0) {
        await yieldCatalogCacheWork();
      }
    }
  }

  function buildCatalogDemandSnapshot(
    state
  ) {
    const types = [];
    const enums = [];
    for (const [owner, entry] of
      state.rows) {
      const full =
        state.seedOwners.has(owner);
      if (entry.typeRow) {
        types.push({
          index: entry.typeIndex,
          row: full
            ? entry.typeRow
            : catalogDemandTypeHeader(
                entry.typeRow
              )
        });
      } else {
        types.push({
          index:
            Number.MAX_SAFE_INTEGER +
            entry.enumIndex,
          row:
            catalogDemandSyntheticTypeHeader(
              owner,
              entry.enumRow
            )
        });
      }
      if (full && entry.enumRow) {
        enums.push({
          index: entry.enumIndex,
          row: entry.enumRow
        });
      }
    }
    types.sort((left, right) =>
      left.index - right.index
    );
    enums.sort((left, right) =>
      left.index - right.index
    );
    const revision = stableCatalogHash(
      JSON.stringify({
        seeds: [...state.seedOwners].sort(),
        dependencies:
          [...state.dependencyOwners].sort()
      })
    );
    return {
      ...state.manifest.root,
      types: types.map(value => value.row),
      enums: enums.map(value => value.row),
      catalogDemandPartial: true,
      catalogDemandRevision: revision,
      catalogDemandLoadedOwnerCount:
        state.seedOwners.size,
      catalogDemandDependencyOwnerCount:
        state.dependencyOwners.size,
      catalogDemandTotalOwnerCount:
        state.routing.size
    };
  }

  async function verifiedCatalogDemandRecord(
    database,
    fullManifest
  ) {
    if (!validCatalogCacheManifest(fullManifest)) {
      return null;
    }
    const fullIntegrity =
      await catalogCacheBoundedHash(
        catalogCacheManifestIntegrity(
          fullManifest
        ),
        CACHE_MANIFEST_MAX_BYTES
      );
    if (
      fullIntegrity.hash !==
        String(fullManifest.contentHash)
          .trim().toLowerCase()
    ) {
      return null;
    }
    const demandManifest =
      await verifiedCatalogDemandManifest(
        database,
        fullManifest
      );
    if (!demandManifest) return null;
    const state = createCatalogDemandState(
      fullManifest,
      demandManifest
    );
    const requirements =
      currentCatalogDemandRequirements();
    const owners =
      resolveCatalogDemandOwners(
        state,
        requirements.operatorIds,
        requirements.portableOwners
      );
    await hydrateCatalogDemandOwners(
      database,
      state,
      owners
    );
    const finalActive =
      await readCatalogCacheValue(
        database,
        CACHE_ACTIVE_RECORD_KEY
      );
    if (
      String(finalActive?.generation || "") !==
        String(fullManifest.generation || "") ||
      String(finalActive?.contentHash || "") !==
        String(fullManifest.contentHash || "")
    ) {
      const error = new Error(
        window.RMLI18n.t("ui.literal.1022aa169a3b")
      );
      error.code =
        "RML_CATALOG_CACHE_GENERATION_CHANGED";
      throw error;
    }
    const raw = buildCatalogDemandSnapshot(
      state
    );
    if (!strictCachedScannerContract(raw)) {
      throw new Error(
        window.RMLI18n.t("ui.literal.ee6266c77c7f")
      );
    }
    catalogDemandManifest =
      demandManifest;
    catalogDemandState = state;
    return Object.freeze({
      ...fullManifest,
      demandPartial: true,
      demandManifest,
      catalog:
        deepFreezeCatalogSnapshot(raw)
    });
  }

  async function activateFullCatalogDemandFallback(
    reason = ""
  ) {
    const state = catalogDemandState;
    if (!state || state.fullActive) {
      return statusCatalog();
    }
    let database;
    try {
      database = await openCatalogCache();
      const record =
        await verifiedCurrentCacheRecord(
          database,
          state.fullManifest
        );
      if (!record) {
        throw new Error(
          window.RMLI18n.t("ui.literal.491908615e73")
        );
      }
      const catalog = normalizeCatalog(
        record.catalog,
        "scanner-cache",
        record.sourceUrl || ""
      );
      let published = null;
      await queueCatalogActivationOperation(
        async () => {
          if (
            catalogDemandState !== state ||
            state.fullActive
          ) {
            return;
          }
          await activateCatalogAndFactoryNow(
            catalog
          );
          if (catalogDemandState !== state) {
            return;
          }
          state.fullActive = true;
          state.fallbackReason = String(
            reason ||
            state.fallbackReason ||
            ""
          );
          cachedCatalogRecord = record;
          cachedCatalogReadPromise =
            Promise.resolve(record);
          cachedCatalogStatus = catalog;
          published = catalog;
        }
      );
      return published || statusCatalog();
    } finally {
      database?.close?.();
    }
  }

  function ensureCatalogDemandOperators(
    operatorIds = []
  ) {
    const ids = [...new Set(
      (Array.isArray(operatorIds)
        ? operatorIds
        : [])
        .map(value =>
          String(value || "").trim()
        )
        .filter(value =>
          value.startsWith("api.")
        )
    )];
    const run = async () => {
      const state = catalogDemandState;
      if (
        ids.length === 0 ||
        !state ||
        state.fullActive ||
        statusCatalog()
          ?.catalogDemandPartial !== true
      ) {
        return Object.freeze({
          available: true,
          full: Boolean(
            !state ||
            state.fullActive ||
            statusCatalog()
              ?.catalogDemandPartial !== true
          ),
          loaded: 0
        });
      }
      let owners;
      try {
        owners = resolveCatalogDemandOwners(
          state,
          ids
        );
      } catch (error) {
        await activateFullCatalogDemandFallback(
          error?.message ||
          window.RMLI18n.t("ui.literal.0cf737b11b39")
        );
        return Object.freeze({
          available: true,
          full: true,
          loaded: ids.length
        });
      }
      const newOwners = [...owners]
        .filter(owner =>
          !state.seedOwners.has(owner)
        );
      if (newOwners.length === 0) {
        return Object.freeze({
          available: true,
          full: false,
          loaded: 0
        });
      }
      let database;
      try {
        database = await openCatalogCache();
        await hydrateCatalogDemandOwners(
          database,
          state,
          newOwners
        );
      } catch (error) {
        database?.close?.();
        database = null;
        await activateFullCatalogDemandFallback(
          error?.message ||
          window.RMLI18n.t("ui.literal.f2dffa08ea7c")
        );
        return Object.freeze({
          available: true,
          full: true,
          loaded: ids.length
        });
      } finally {
        database?.close?.();
      }
      const raw = buildCatalogDemandSnapshot(
        state
      );
      const catalog = normalizeCatalog(
        raw,
        "scanner-cache",
        state.fullManifest.sourceUrl || ""
      );
      let published = false;
      try {
        await queueCatalogActivationOperation(
          async () => {
            if (catalogDemandState !== state) {
              return;
            }
            await activateCatalogAndFactoryNow(
              catalog
            );
            if (catalogDemandState !== state) {
              return;
            }
            cachedCatalogRecord = Object.freeze({
              ...state.fullManifest,
              demandPartial: true,
              demandManifest:
                state.manifest,
              catalog:
                deepFreezeCatalogSnapshot(raw)
            });
            cachedCatalogReadPromise =
              Promise.resolve(
                cachedCatalogRecord
              );
            cachedCatalogStatus = catalog;
            published = true;
          }
        );
      } catch (error) {
        await activateFullCatalogDemandFallback(
          error?.message ||
          window.RMLI18n.t("ui.literal.3b4c54a95a3b")
        );
        return Object.freeze({
          available: true,
          full: true,
          loaded: ids.length
        });
      }
      if (!published) {
        return Object.freeze({
          available: Boolean(statusCatalog()),
          full:
            statusCatalog()
              ?.catalogDemandPartial !== true,
          loaded: 0
        });
      }
      return Object.freeze({
        available: true,
        full: false,
        loaded: newOwners.length
      });
    };
    const pending =
      catalogDemandHydrationPromise.then(
        run,
        run
      );
    catalogDemandHydrationPromise =
      pending.catch(() => null);
    return pending;
  }

  function catalogDemandPublicState() {
    const state = catalogDemandState;
    const loadedBytes = state
      ? [...state.chunkCache.values()]
          .reduce(
            (total, record) =>
              total + Math.max(
                0,
                Number(record?.byteLength) || 0
              ),
            0
          )
      : 0;
    const totalBytes = state
      ? state.fullManifest.chunks.reduce(
          (total, chunk) =>
            total + Math.max(
              0,
              Number(chunk?.byteLength) || 0
            ),
          0
        )
      : Math.max(
          0,
          Number(
            catalogDemandManifest
              ?.fullByteLength
          ) || 0
        );
    const partial =
      statusCatalog()
        ?.catalogDemandPartial === true;
    const full = Boolean(
      state?.fullActive ||
      (
        statusCatalog() &&
        !partial
      )
    );
    return Object.freeze({
      available:
        Boolean(catalogDemandManifest),
      ready:
        Boolean(catalogDemandManifest),
      busy: false,
      mode: partial
        ? "partial"
        : full
          ? "full"
          : catalogDemandManifest
            ? "indexed"
            : "unavailable",
      partial,
      full,
      fullCatalogLoaded: full,
      fingerprint: String(
        catalogDemandManifest
          ?.fingerprint || ""
      ),
      contentHash: String(
        catalogDemandManifest
          ?.contentHash || ""
      ),
      requiredOperatorCount:
        state?.requiredOperatorIds.size || 0,
      requiredOwnerCount:
        state?.seedOwners.size || 0,
      bootstrapOwnerCount:
        state?.bootstrapOwners.size || 0,
      dependencyOwnerCount:
        state?.dependencyOwners.size || 0,
      cachedChunkCount:
        state?.chunkCache.size || 0,
      loadedOwnerCount:
        state?.rows.size || 0,
      loadedShardCount:
        state?.chunkCache.size || 0,
      totalShardCount:
        state?.fullManifest
          ?.chunkCount ||
        catalogDemandManifest
          ?.fullChunkCount || 0,
      loadedBytes,
      totalBytes,
      fallbackReason: String(
        state?.fallbackReason || ""
      ),
      totalOwnerCount:
        state?.routing.size ||
        catalogDemandManifest
          ?.typeRouting?.length || 0
    });
  }

  function catalogDemandPaletteIndex() {
    const manifest =
      statusCatalog()
        ?.catalogDemandPartial === true
        ? catalogDemandManifest
        : null;
    if (
      catalogDemandPaletteManifest ===
        manifest
    ) {
      return catalogDemandPalettePublication;
    }
    catalogDemandPaletteManifest = manifest;
    catalogDemandPalettePublication =
      Object.freeze({
        compact: true,
        entries:
          manifest?.operatorIndex || [],
        typeRouting:
          manifest?.typeRouting || [],
        groups: manifest?.groups || [],
        memberKinds:
          manifest?.memberKinds || [],
        symbols: manifest?.symbols || [],
        revision: String(
          manifest?.contentHash || ""
        ),
        contentHash: String(
          manifest?.contentHash || ""
        ),
        catalogFingerprint: String(
          manifest?.fingerprint || ""
        )
      });
    return catalogDemandPalettePublication;
  }

  async function verifiedLegacyV2CacheRecord(
    record
  ) {
    const raw = record?.catalog;
    const fingerprint =
      scannerCatalogFingerprint(raw);
    const expectedContentHash = String(
      record?.contentHash || ""
    ).trim().toLowerCase();
    if (
      String(record?.id || "") !==
        CACHE_RECORD_KEY ||
      Number(record?.schemaVersion) !==
        LEGACY_CACHE_RECORD_SCHEMA_VERSION ||
      String(
        record?.contentHashAlgorithm || ""
      ) !==
        LEGACY_CACHE_CONTENT_HASH_ALGORITHM ||
      !/^[a-f0-9]{64}$/.test(
        expectedContentHash
      ) ||
      !raw ||
      typeof raw !== "object" ||
      Array.isArray(raw) ||
      !strictCachedScannerContract(raw) ||
      !fingerprint ||
      String(record?.fingerprint || "")
        .trim().toLowerCase() !== fingerprint
    ) {
      return null;
    }
    const actualContentHash =
      await legacyCatalogCacheContentHash(raw);
    return actualContentHash ===
      expectedContentHash
      ? Object.freeze({
          ...record,
          catalog:
            deepFreezeCatalogSnapshot(raw)
        })
      : null;
  }

  function legacyCacheRecordCanMigrate(
    record
  ) {
    const schemaVersion =
      record?.schemaVersion;
    const raw = record?.catalog;
    const fingerprint =
      scannerCatalogFingerprint(raw);
    return Boolean(
      (schemaVersion == null ||
        schemaVersion === "" ||
        Number(schemaVersion) === 1) &&
      String(record?.id || "") ===
        CACHE_RECORD_KEY &&
      !String(
        record?.contentHashAlgorithm || ""
      ).trim() &&
      !String(
        record?.contentHash || ""
      ).trim() &&
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      strictCachedScannerContract(raw) &&
      fingerprint &&
      String(record?.fingerprint || "")
        .trim().toLowerCase() === fingerprint
    );
  }

  async function removeCatalogCacheGeneration(
    database,
    generation,
    chunkCount
  ) {
    if (
      !generation ||
      !Number.isInteger(chunkCount) ||
      chunkCount < 1 ||
      chunkCount > CACHE_CHUNK_MAX_COUNT
    ) {
      return;
    }
    for (
      let start = 0;
      start < chunkCount;
      start += 256
    ) {
      const end = Math.min(
        chunkCount,
        start + 256
      );
      const keys = [];
      for (let index = start; index < end; index += 1) {
        keys.push(
          catalogCacheChunkId(
            generation,
            index
          )
        );
      }
      await deleteCatalogCacheKeys(
        database,
        keys
      );
      await yieldCatalogCacheWork();
    }
  }

  async function clearOwnedCatalogStaging(
    database,
    generation
  ) {
    const staging =
      await readCatalogCacheValue(
        database,
        CACHE_STAGING_RECORD_KEY
      );
    if (
      String(staging?.generation || "") ===
        generation
    ) {
      await deleteCatalogCacheKeys(
        database,
        [CACHE_STAGING_RECORD_KEY]
      );
    }
  }

  async function writeChunkedCatalogRecord(
    database,
    raw,
    sourceUrl,
    previousRecord = null
  ) {
    const generation =
      createCatalogCacheGeneration();
    const createdAtUtc =
      new Date().toISOString();
    const context = {
      database,
      generation,
      createdAtUtc,
      chunks: [],
      plannedChunkCount: 0
    };
    let committed = false;
    try {
      const staleStaging =
        await readCatalogCacheValue(
          database,
          CACHE_STAGING_RECORD_KEY
        );
      const staleAge =
        Date.now() - Date.parse(
          String(
            staleStaging?.updatedAtUtc ||
            staleStaging?.createdAtUtc || ""
          )
        );
      if (staleStaging?.generation) {
        const staleGeneration = String(
          staleStaging.generation
        );
        const activeGeneration = String(
          previousRecord?.generation || ""
        );
        if (
          staleGeneration ===
            activeGeneration
        ) {

          await clearOwnedCatalogStaging(
            database,
            staleGeneration
          );
        } else if (
          Number.isFinite(staleAge) &&
          staleAge > 10 * 60 * 1000
        ) {
          await removeCatalogCacheGeneration(
            database,
            staleGeneration,
            Number(staleStaging.chunkCount)
          );
          await clearOwnedCatalogStaging(
            database,
            staleGeneration
          );
        } else {
          throw new Error(
            window.RMLI18n.t("ui.literal.a4db286a8934")
          );
        }
      }
      await storeCatalogCacheRecord(
        database,
        {
          id: CACHE_STAGING_RECORD_KEY,
          schemaVersion:
            CACHE_CHUNK_RECORD_SCHEMA_VERSION,
          generation,
          chunkCount: 0,
          createdAtUtc,
          updatedAtUtc: createdAtUtc
        }
      );
      const root =
        await encodeCatalogCacheNode(
          raw,
          context
        );
      const manifest = {
        id: CACHE_RECORD_KEY,
        schemaVersion:
          CACHE_RECORD_SCHEMA_VERSION,
        format: CACHE_CHUNK_FORMAT,
        savedAtUtc: createdAtUtc,
        sourceUrl,
        fingerprint:
          scannerCatalogFingerprint(raw),
        contentHashAlgorithm:
          CACHE_CONTENT_HASH_ALGORITHM,
        contentHash: "",
        generation,
        chunkCount:
          context.chunks.length,
        chunkTargetBytes:
          CACHE_CHUNK_TARGET_BYTES,
        chunkMaximumBytes:
          CACHE_CHUNK_MAX_BYTES,
        root,
        chunks: context.chunks
      };
      const integrity =
        await catalogCacheBoundedHash(
          catalogCacheManifestIntegrity(
            manifest
          ),
          CACHE_MANIFEST_MAX_BYTES
        );
      manifest.contentHash =
        integrity.hash;

      await commitCatalogCacheManifest(
        database,
        manifest
      );
      committed = true;
      try {
        await clearOwnedCatalogStaging(
          database,
          generation
        );
      } catch (cleanupError) {
      }

      if (
        Number(previousRecord?.schemaVersion) ===
          CACHE_RECORD_SCHEMA_VERSION &&
        previousRecord.generation &&
        previousRecord.generation !== generation
      ) {
        try {
          await removeCatalogCacheGeneration(
            database,
            String(previousRecord.generation),
            Number(previousRecord.chunkCount)
          );
        } catch (cleanupError) {
        }
      }
      return manifest;
    } catch (error) {
      if (!committed) {
        try {
          await removeCatalogCacheGeneration(
            database,
            generation,
            context.plannedChunkCount
          );
          await clearOwnedCatalogStaging(
            database,
            generation
          );
        } catch (cleanupError) {
        }
      }
      throw error;
    }
  }

  async function migrateLegacyCacheRecord(
    database,
    record
  ) {
    const verifiedV2 =
      await verifiedLegacyV2CacheRecord(
        record
      );
    const legacyV1 =
      legacyCacheRecordCanMigrate(record)
        ? record
        : null;
    const accepted = verifiedV2 || legacyV1;
    if (!accepted) return null;
    const raw =
      deepFreezeCatalogSnapshot(
        accepted.catalog
      );
    try {
      const manifest =
        await writeChunkedCatalogRecord(
          database,
          raw,
          accepted.sourceUrl || "",
          accepted
        );
      return Object.freeze({
        ...manifest,
        migratedAtUtc:
          new Date().toISOString(),
        catalog: raw
      });
    } catch (error) {

      return verifiedV2;
    }
  }

  async function readCachedLiveCatalogRecord() {
    let database;

    try {
      database =
        await openCatalogCache();
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const stored =
          await readCatalogCacheRecord(
            database
          );
        try {
          let current = null;
          try {
            current =
              await verifiedCatalogDemandRecord(
                database,
                stored
              );
          } catch (error) {
          }
          if (!current) {
            current =
              await verifiedCurrentCacheRecord(
                database,
                stored
              );
          }
          const resolved = current ||
            await migrateLegacyCacheRecord(
              database,
              stored
            );
          if (resolved) {
            cachedCatalogRecord =
              resolved;
          }
          return resolved;
        } catch (error) {
          if (
            error?.code ===
              "RML_CATALOG_CACHE_GENERATION_CHANGED" &&
            attempt === 0
          ) {
            continue;
          }
          throw error;
        }
      }
      return null;
    } catch (error) {
      return null;
    } finally {
      database?.close?.();
    }
  }

  function readCachedLiveCatalog() {
    if (!cachedCatalogReadPromise) {
      cachedCatalogReadPromise =
        readCachedLiveCatalogRecord()
          .then(record => {
            if (!record) {
              cachedCatalogReadPromise =
                null;
            }
            return record;
          })
          .catch(error => {
            cachedCatalogReadPromise =
              null;
            throw error;
          });
    }
    return cachedCatalogReadPromise;
  }

  async function writeCachedLiveCatalog(
    raw,
    sourceUrl,
    { retainInMemory = true } = {}
  ) {
    let database;
    const fingerprint =
      scannerCatalogFingerprint(raw);

    if (
      !fingerprint ||
      !strictCachedScannerContract(raw)
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.825d0300d29a")
      );
    }
    const catalogSnapshot =
      deepFreezeCatalogSnapshot(raw);

    try {
      database =
        await openCatalogCache();
      const previousRecord =
        await readCatalogCacheRecord(
          database
        );
      const manifest =
        await writeChunkedCatalogRecord(
          database,
          catalogSnapshot,
          sourceUrl,
          previousRecord
        );
      catalogDemandManifest = null;
      try {
        await writeCatalogDemandIndex(
          database,
          catalogSnapshot,
          manifest
        );
      } catch (error) {
      }
      catalogDemandState = null;
      const stored = Object.freeze({
        ...manifest,
        catalog: catalogSnapshot
      });
      if (retainInMemory) {
        cachedCatalogRecord = stored;
        cachedCatalogReadPromise =
          Promise.resolve(stored);
      }
      return true;
    } catch (error) {
      console.warn(
        window.RMLI18n.t("ui.literal.e7bd3dbebd74"),
        error
      );
      return false;
    } finally {
      database?.close?.();
    }
  }

  function ensureCatalogDemandIndexForRecord(
    record
  ) {
    if (
      !record ||
      record.demandPartial === true ||
      !record.catalog ||
      !validCatalogCacheManifest(record)
    ) {
      return Promise.resolve(false);
    }
    if (catalogDemandIndexWritePromise) {
      return catalogDemandIndexWritePromise;
    }
    catalogDemandIndexWritePromise =
      Promise.resolve().then(async () => {
        let database;
        try {
          database = await openCatalogCache();
          const existing =
            await verifiedCatalogDemandManifest(
              database,
              record
            );
          if (existing) {
            catalogDemandManifest = existing;
            return true;
          }
          return await writeCatalogDemandIndex(
            database,
            record.catalog,
            record
          );
        } catch (error) {
          return false;
        } finally {
          database?.close?.();
        }
      }).finally(() => {
        catalogDemandIndexWritePromise = null;
      });
    return catalogDemandIndexWritePromise;
  }

  let scheduledCatalogDemandIndexRecord =
    null;
  let catalogDemandIndexScheduled = false;

  function scheduleCatalogDemandIndexForRecord(
    record
  ) {
    scheduledCatalogDemandIndexRecord = record;
    if (catalogDemandIndexScheduled) {
      return;
    }
    catalogDemandIndexScheduled = true;

    const start = () => {
      const scheduledRecord =
        scheduledCatalogDemandIndexRecord;
      scheduledCatalogDemandIndexRecord = null;
      catalogDemandIndexScheduled = false;
      if (!scheduledRecord) {
        return;
      }
      const run = () => {
        void ensureCatalogDemandIndexForRecord(
          scheduledRecord
        );
      };
      if (
        globalThis.scheduler &&
        typeof globalThis.scheduler.postTask ===
          "function"
      ) {
        void globalThis.scheduler.postTask(
          run,
          { priority: "background" }
        );
      } else {
        window.RMLScheduleTask(run);
      }
    };

    if (
      document.documentElement.dataset
        .rmlBuilderReady === "true"
    ) {
      start();
      return;
    }
    document.addEventListener(
      "rml-builder:ready",
      start,
      { once: true }
    );
  }

  async function loadCatalog() {
    const cached =
      await readCachedLiveCatalog();

    if (cached) {
      cachedCatalogRecord = cached;
      cachedCatalogStatus =
        cached.catalog;
      catalogAvailabilityKnown = true;
      catalogAvailable = true;

      return normalizeCatalog(
        cached.catalog,
        "scanner-cache",
        cached.sourceUrl || ""
      );
    }
    cachedCatalogStatus = null;
    catalogAvailabilityKnown = true;
    catalogAvailable = false;
    updateUnavailableStatus();
    return null;
  }

  let manualCatalogActivationInstalled =
    false;
  let manualCatalogActivationPromise =
    null;

  function renderManualCatalogChecking() {
    const element =
      document.getElementById(
        "api-catalog-state"
      );

    if (!element) {
      return;
    }

    element.dataset.source =
      "updating";
    element.textContent =
      window.RMLI18n.t("{{i18n:js.presentation.be775996d3f7}}");
    element.setAttribute(
      "aria-label",
      element.textContent
    );
  }

  async function activateCatalogFromUserClick() {
    if (manualCatalogActivationPromise) {
      window.RMLRuntimeBridge?.disconnect?.(
        window.RMLI18n.t("ui.literal.553b0f547640")
      );
      return false;
    }

    manualCatalogActivationPromise =
      Promise.resolve()
        .then(async () => {
          const scriptLoader =
            window.RMLScriptLoader;

          if (
            !scriptLoader ||
            typeof scriptLoader.ensure !== "function"
          ) {
            throw new Error(
              "[RML API Catalog] The deferred JavaScript module loader is unavailable."
            );
          }

          await scriptLoader.ensure(
            "scanner-connection"
          );

          const bridge =
            window.RMLRuntimeBridge;

          if (
            !bridge ||
            typeof bridge.connect !== "function"
          ) {
            throw new Error(
              "[RML API Catalog] runtime-core finished loading but RMLRuntimeBridge.connect() is still unavailable."
            );
          }

          const before =
            bridge.getConnectionState?.() ||
            currentScannerConnection();

          if (before?.mode === "live") {
            bridge.disconnect?.();
            catalogAvailabilityKnown = true;
            catalogAvailable =
              Boolean(statusCatalog());
            updateStatus();
            return false;
          }

          renderManualCatalogChecking();

          let connected = false;

          try {
            connected =
              await bridge.connect();
          } catch (error) {
            console.error(
              "[RML API Catalog] Scanner discovery failed.",
              error
            );
            connected = false;
          }

          if (connected) {
            try {
              const session =
                bridge.getConnectionState?.() ||
                currentScannerConnection();

              const synchronized =
                await synchronizeScannerStatus({
                  manualSession: session,
                  showChecking: true,
                  throwOnFailure: false
                });

              if (
                synchronized === true &&
                statusCatalog()
              ) {
                catalogAvailabilityKnown = true;
                catalogAvailable = true;
                updateStatus();
                document.dispatchEvent(new CustomEvent("rml-scanner:manual-live-activated", { detail: session }));
                return true;
              }
            } catch (error) {
              console.error(
                "[RML API Catalog] Live scanner connected, but catalog synchronization failed.",
                error
              );
            }
          }

          const existing =
            statusCatalog() ||
            cachedCatalogStatus;

          catalogAvailabilityKnown = true;
          catalogAvailable =
            Boolean(existing);

          if (existing) {
            updateStatus();
          } else {
            updateUnavailableStatus();
          }

          return false;
        })
        .finally(() => {
          manualCatalogActivationPromise =
            null;
        });

    return manualCatalogActivationPromise;
  }

  function installManualUnavailableCatalogActivation() {
    if (manualCatalogActivationInstalled) {
      return;
    }

    const element =
      document.getElementById(
        "api-catalog-state"
      );

    if (!element) {
      return;
    }

    manualCatalogActivationInstalled = true;

    const reassertUnavailable = () => {
      if (manualCatalogActivationPromise) {
        return;
      }

      if (
        catalogAvailabilityKnown &&
        catalogAvailable !== true
      ) {
        queueMicrotask(
          updateUnavailableStatus
        );
      }
    };

    window.addEventListener(
      "rml-scanner-connection",
      reassertUnavailable
    );

    element.addEventListener(
      "click",
      event => {
        event.preventDefault();
        event.stopImmediatePropagation();

        void activateCatalogFromUserClick()
          .catch(error => {
            console.error(
              "[RML API Catalog] Manual catalog activation failed.",
              error
            );

            catalogAvailabilityKnown = true;
            catalogAvailable =
              Boolean(statusCatalog());

            if (catalogAvailable) {
              updateStatus();
            } else {
              updateUnavailableStatus();
            }
          });
      },
      true
    );
  }

  installManualUnavailableCatalogActivation();

  if (!manualCatalogActivationInstalled) {
    document.addEventListener(
      "DOMContentLoaded",
      installManualUnavailableCatalogActivation,
      { once: true }
    );
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

  function publishFactoryReportMetadata(
    previousReport,
    nextReport
  ) {
    const projectionIndex =
      window.RMLApiCatalogProjectionIndex;
    const replacePublishedReport =
      window.RMLApiNodeFactoryController
        ?.replacePublishedFactoryReport;
    if (projectionIndex) {
      if (
        typeof replacePublishedReport !==
          "function" ||
        replacePublishedReport(
          previousReport,
          nextReport
        ) !== true
      ) {
        throw new Error(
          window.RMLI18n.t("ui.literal.48f9efcf484d")
        );
      }
    } else {
      window.RMLApiNodeFactoryReport =
        nextReport;
    }
    return nextReport;
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
    publishFactoryReportMetadata(
      report,
      nextReport
    );
    return true;
  }

  async function ensureApiNodesModuleLoaded() {
    await loadScript(
      apiNodesUrl,
      "api-nodes",
      "api_nodes.js"
    );

    const controller =
      window.RMLApiNodeFactoryController;
    if (
      controller?.moduleId !==
        CATALOG_LOADER_MODULE_ID ||
      Number(controller?.factoryVersion) !==
        REQUIRED_API_FACTORY_VERSION
    ) {
      throw new Error(
        `Runtime module version mismatch: the API node factory is not the ${CATALOG_LOADER_MODULE_ID} factory required by this catalog loader. Reload the Builder without cached files. The JSON was not loaded.`
      );
    }

    const report =
      window.RMLApiNodeFactoryReport;
    const activeFactoryVersion =
      Number(
        window.__RMLApiNodeFactoryVersion
      ) || 0;
    if (
      (
        activeFactoryVersion !== 0 &&
        activeFactoryVersion !==
          REQUIRED_API_FACTORY_VERSION
      ) ||
      (
        report &&
        (
          Number(report.factoryVersion) !==
            REQUIRED_API_FACTORY_VERSION ||
          report.moduleId !==
            CATALOG_LOADER_MODULE_ID
        )
      )
    ) {
      throw new Error(
        `Runtime module version mismatch: catalog loader v${LOADER_VERSION} requires API factory v${REQUIRED_API_FACTORY_VERSION}, but the active factory is v${activeFactoryVersion || 0}. Reload the Builder without cached files. The JSON was not loaded.`
      );
    }
  }

  let catalogActivationPromise =
    Promise.resolve();

  function queueCatalogActivationOperation(
    operation
  ) {
    const run = () =>
      Promise.resolve().then(
        operation
      );
    const queued =
      catalogActivationPromise.then(
        run,
        run
      );
    catalogActivationPromise =
      queued.catch(() => null);
    return queued;
  }

  function catalogSnapshotsMatch(
    left,
    right
  ) {
    const identityMatches = Boolean(
      left &&
      right &&
      catalogIdentity(left) &&
      catalogIdentity(left) ===
        catalogIdentity(right) &&
      String(left.engineVersion || "") ===
        String(right.engineVersion || "")
    );
    if (!identityMatches) return false;
    if (
      left.catalogDemandPartial === true ||
      right.catalogDemandPartial === true
    ) {
      return Boolean(
        left.catalogDemandPartial ===
          right.catalogDemandPartial &&
        String(
          left.catalogDemandRevision || ""
        ) ===
          String(
            right.catalogDemandRevision || ""
          )
      );
    }
    return true;
  }

  function assertCatalogFactoryCommit(
    catalog,
    report
  ) {
    const activeCatalog =
      statusCatalog();
    if (
      !catalogSnapshotsMatch(
        activeCatalog,
        catalog
      ) ||
      !factoryMatchesCatalog(
        catalog,
        report
      ) ||
      !factoryMatchesCatalog(
        activeCatalog,
        report
      )
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.1fb3264551ac")
      );
    }
    return report;
  }

  async function activateCatalogAndFactoryNow(
    catalog
  ) {
    const existingReport =
      window.RMLApiNodeFactoryReport;
    if (
      factoryMatchesCatalog(
        catalog,
        existingReport
      ) &&
      catalogSnapshotsMatch(
        statusCatalog(),
        catalog
      )
    ) {
      promoteFactoryReportForCatalog(
        catalog
      );
      return assertCatalogFactoryCommit(
        catalog,
        window.RMLApiNodeFactoryReport ||
          existingReport
      );
    }

    await baseModNodesReady;
    await ensureApiNodesModuleLoaded();

    let report =
      window.RMLApiNodeFactoryReport;

    if (
      factoryMatchesCatalog(
        catalog,
        report
      ) &&
      catalogSnapshotsMatch(
        statusCatalog(),
        catalog
      )
    ) {
      promoteFactoryReportForCatalog(
        catalog
      );
      return assertCatalogFactoryCommit(
        catalog,
        window.RMLApiNodeFactoryReport ||
          report
      );
    }

    const controller =
      window.RMLApiNodeFactoryController;

    if (
      !controller ||
      typeof controller.rebuild !==
        "function"
    ) {
      throw new Error(
        window.RMLI18n.t("ui.literal.9d9796871ed3")
      );
    }

    const rebuildOptions = {
      createCatalogPublication
    };
    let rebuildError = null;
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        await controller.rebuild(
          catalog,
          rebuildOptions
        );
        rebuildError = null;
        break;
      } catch (error) {
        rebuildError = error;
        const message = String(
          error?.message || error || ""
        );
        const registryChanged =
          message.includes(
            window.RMLI18n.t("ui.literal.6bafcf11ed48")
          ) ||
          message.includes(
            window.RMLI18n.t("ui.literal.a57d9e3cfe81")
          );
        if (!registryChanged || attempt >= 2) {
          throw error;
        }
        await new Promise(resolve =>
          window.RMLScheduleTask(resolve)
        );
      }
    }
    if (rebuildError) {
      throw rebuildError;
    }
    report =
      window.RMLApiNodeFactoryReport;
    return assertCatalogFactoryCommit(
      catalog,
      report
    );
  }

  function activateCatalogAndFactory(
    catalog
  ) {
    return queueCatalogActivationOperation(
      () =>
        activateCatalogAndFactoryNow(
          catalog
        )
    );
  }

  function currentScannerConnection() {
    return window.RMLRuntimeBridge?.getConnectionState?.() || { mode: "cached", generation: -1 };
  }

  function demoteLiveFactoryReport() {
    const report = window.RMLApiNodeFactoryReport;
    if (!report || report.liveCatalogVerified !== true) return;
    const next = Object.freeze({ ...report, liveCatalogVerified: false,
      catalogSource: statusCatalog()?.catalogSource || "scanner-cache" });
    publishFactoryReportMetadata(
      report,
      next
    );
  }

  async function synchronizeScannerStatus(options = {}) {
    const session = currentScannerConnection();

    if (session.mode !== "live") return false;
    if (
      scannerCheckGeneration === session.generation &&
      scannerCheckPromise
    ) {
      return scannerCheckPromise;
    }
    if (
      scannerCheckGeneration === session.generation &&
      lastScannerFingerprintSync.liveReached === true &&
      window.RMLApiNodeFactoryReport?.liveCatalogVerified === true
    ) {
      return true;
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
      const builderWork =
        window.RMLBuilderWork;
      let catalogUpdateWork = 0;
      let factoryActivated = false;
      let cacheWriteFailed = false;
      try {
        assertSession();
        let scannerHealth = session.health;
          if (
            scannerHealth?.catalogReady !== true ||
            scannerHealth?.catalogAvailable !== true
          ) {
            const ready = await fetchJson(
              `${session.scannerBaseUrl}/catalog/ready`,
              CATALOG_READY_TIMEOUT_MS,
              signal
            );
          assertSession();
          if (ready?.ready !== true) {
            throw new Error(
              window.RMLI18n.t("ui.literal.fce6a1d811a0")
            );
          }
            scannerHealth = await fetchJson(
              `${session.scannerBaseUrl}/health`,
              CATALOG_READY_TIMEOUT_MS,
              signal
            );
          assertSession();
        }

        const fingerprintContract = scannerFingerprintContract(scannerHealth);
        const legacyFingerprint = legacyScannerFingerprint(scannerHealth);
        if (
          scannerHealth?.catalogReady !== true ||
          scannerHealth?.catalogAvailable !== true ||
          (!fingerprintContract && !legacyFingerprint)
        ) {
          throw new Error(
            window.RMLI18n.t("ui.literal.bbb2086c85ac")
          );
        }
        const live = { health: scannerHealth,
          fingerprint: fingerprintContract?.fingerprint || legacyFingerprint,
          legacy: !fingerprintContract,
          url: `${session.scannerBaseUrl}/resonite_api_catalog.json`, signal };
        const activeBeforeSync = statusCatalog();
        let cached = cachedCatalogRecord;
        if (!cached) cached = await readCachedLiveCatalog();
        assertSession();
        const cachedFingerprint =
          String(
            cached?.fingerprint ||
            (
              live.legacy === true
                ? legacyCacheFingerprint(
                    cached?.catalog
                  )
                : scannerFingerprintContract(
                    cached?.catalog
                  )?.fingerprint
            ) ||
            ""
          ).trim().toLowerCase();
        const fingerprintMatchedCache =
          Boolean(
            cached?.catalog &&
            (
              (
                cachedFingerprint &&
                String(live.fingerprint || "") ===
                  String(
                    cachedFingerprint || ""
                  )
              ) ||
              cachedCatalogMatchesScannerHealth(
                cached.catalog,
                scannerHealth
              )
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
                ? window.RMLI18n.t("ui.literal.2e85f456b4d4")
                : window.RMLI18n.t("ui.literal.5a3cc4a0f777")
          }
        );
        if (
          !fingerprintMatchedCache &&
          builderWork?.version >= 1
        ) {
          catalogUpdateWork =
            builderWork.begin({
              kicker: window.RMLI18n.t("ui.auto.9fc587f7a4db"),
              title: window.RMLI18n.t("ui.auto.703179d36bf0"),
              message:
                window.RMLI18n.t("ui.auto.12e7a6f0b973"),
              detail:
                window.RMLI18n.t("ui.literal.2068df93dd69"),
              progress: 20,
              timeout: 120000
            });
          await builderWork.paint();
        }
        const liveRaw =
          fingerprintMatchedCache
            ? null
            : await loadAndVerifyLiveCatalog(
                live
              );
        assertSession();
        if (
          !fingerprintMatchedCache &&
          statusCatalog()
            ?.catalogDemandPartial === true
        ) {
          await activateFullCatalogDemandFallback();
          assertSession();
        }
        let cacheUpdatedFromLive = false;
        const synchronizedRaw =
          fingerprintMatchedCache
            ? cached.catalog
            : liveRaw;
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
                fingerprintMatchedCache
                  ? "scanner-cache"
                  : "scanner",
                live.url
              );

        notifyCatalogGate(
          options.onFactoryActivation,
          {
            phase: "factory",
            message:
              fingerprintMatchedCache
                ? window.RMLI18n.t("ui.literal.254549ea6ed6")
                : window.RMLI18n.t("ui.literal.40a71b43c30d")
          }
        );
        builderWork?.update?.(
          catalogUpdateWork,
          {
            title: window.RMLI18n.t("ui.auto.b3eedfd6c481"),
            message:
              window.RMLI18n.t("ui.auto.aeb3813489d0"),
            progress: 65
          }
        );
        await builderWork?.paint?.();
        if (!fingerprintMatchedCache) {
          await queueCatalogActivationOperation(
            async () => {
              catalogDemandState = null;
              catalogDemandManifest = null;
              await activateCatalogAndFactoryNow(
                confirmedCatalog
              );
            }
          );
        } else {
          await activateCatalogAndFactory(
            confirmedCatalog
          );
        }
        factoryActivated = true;
        promoteFactoryReportForCatalog(
          confirmedCatalog,
          {
            liveFingerprintVerified: true
          }
        );
        if (!fingerprintMatchedCache) {
          notifyCatalogGate(
            options.onCatalogCacheWrite,
            {
              phase: "catalog-cache-write",
              message:
                window.RMLI18n.t("ui.auto.969f8798a2e1")
            }
          );
          builderWork?.update?.(
            catalogUpdateWork,
            {
              title: window.RMLI18n.t("ui.auto.703179d36bf0"),
              message:
                window.RMLI18n.t("ui.auto.4cc0f26064e3"),
              progress: 85
            }
          );
          await builderWork?.paint?.();
          cacheUpdatedFromLive =
            await writeCachedLiveCatalog(
              liveRaw,
              live.url
            );
          if (!cacheUpdatedFromLive) {
            cacheWriteFailed = true;
          }
        }
        builderWork?.update?.(
          catalogUpdateWork,
          {
            title: window.RMLI18n.t("ui.auto.135b2e3c04b9"),
            message:
              cacheUpdatedFromLive || fingerprintMatchedCache
                ? window.RMLI18n.t("ui.literal.d34172e03925")
                : window.RMLI18n.t("ui.literal.4cf0c78ba4c8"),
            progress: 100
          }
        );
        await builderWork?.paint?.();
        if (cacheWriteFailed) {
          window.setTimeout(() => {
            void window.RMLBuilderDialog?.notice?.({
              tone: "danger",
              kicker: window.RMLI18n.t("ui.auto.9fc587f7a4db"),
              title: window.RMLI18n.t("ui.auto.42784ff61fb7"),
              message:
                window.RMLI18n.t("ui.auto.4ec642bd800d"),
              details:
                window.RMLI18n.t("ui.literal.219b9621355b"),
              confirmLabel: window.RMLI18n.t("ui.literal.9ce3bd4224c8")
            });
          }, 0);
        }

        lastScannerFingerprintSync =
          Object.freeze({
            liveReached: true,
            fingerprintMatchedCache,
            cacheUpdatedFromLive,
            cacheFallback: false,
            fingerprint:
              catalogIdentity(
                confirmedCatalog
              ),
            error: cacheWriteFailed
              ? window.RMLI18n.t("ui.auto.4ec642bd800d")
              : ""
          });

        catalogAvailabilityKnown = true;
        catalogAvailable = true;
        cachedCatalogStatus =
          confirmedCatalog;
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
          const message =
            error?.message || String(error);
          lastScannerFingerprintSync = Object.freeze({ liveReached: factoryActivated,
            fingerprintMatchedCache: false, cacheUpdatedFromLive: false,
            cacheFallback: !factoryActivated, fingerprint: factoryActivated
              ? String(statusCatalog()?.catalogFingerprint || "")
              : String(cachedCatalogRecord?.fingerprint || ""),
            error: message });
          if (!factoryActivated) {
            demoteLiveFactoryReport();
            window.RMLRuntimeBridge?.disconnect?.(
              window.RMLI18n.t("ui.literal.6eb076a442fc")
            );
          }
          catalogAvailabilityKnown = true;
          catalogAvailable =
            Boolean(statusCatalog());
          updateStatus();
          window.setTimeout(() => {
            void window.RMLBuilderDialog?.notice?.({
              tone: "danger",
              kicker: window.RMLI18n.t("ui.auto.9fc587f7a4db"),
              title: factoryActivated
                ? "Catalog finalization failed"
                : "Catalog update rejected",
              message,
              details:
                factoryActivated
                  ? window.RMLI18n.t("ui.literal.df4fc16221ae")
                  : window.RMLI18n.t("ui.literal.0a6c834f4d72"),
              confirmLabel: window.RMLI18n.t("ui.literal.9ce3bd4224c8")
            });
          }, 0);
        }
        if (
          options.throwOnFailure === true &&
          !factoryActivated
        ) {
          throw error;
        }
        return factoryActivated;
      } finally {
        if (catalogUpdateWork) {
          builderWork?.finish?.(
            catalogUpdateWork
          );
        }
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
    const stableFamilyValue = value =>
      value &&
      typeof value === "object"
        ? Array.isArray(value)
          ? value.map(stableFamilyValue)
          : Object.fromEntries(
              Object.keys(value)
                .sort((left, right) =>
                  left.localeCompare(right)
                )
                .map(key => [
                  key,
                  stableFamilyValue(
                    value[key]
                  )
                ])
            )
        : value ?? null;
    const add = (
      operatorId,
      inputPorts = [],
      outputPorts = [],
      apiContract = null,
      missingCatalogObject = false,
      catalogScope = "api",
      nodeParameters = {},
      nodeLabels = [],
      requirementKey = "",
      nodeReferences = []
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

      const familyKey = String(
        requirementKey || ""
      ).trim() || JSON.stringify({
        operatorId: id,
        apiContract:
          stableFamilyValue(apiContract),
        nodeParameters:
          stableFamilyValue(
            nodeParameters
          )
      });

      if (!requirements.has(familyKey)) {
        requirements.set(familyKey, {
          requirementKey: familyKey,
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
          nodeReferences: new Map(),
          inputPorts: new Set(),
          outputPorts: new Set()
        });
      }

      const requirement =
        requirements.get(familyKey);

      for (const reference of
        Array.isArray(nodeReferences)
          ? nodeReferences
          : []) {
        const nodeId = String(
          reference?.nodeId || ""
        ).trim();
        const path = String(
          reference?.path ||
          "runtime-root"
        ).trim();
        if (nodeId) {
          requirement.nodeReferences.set(
            `${path}\u0000${nodeId}`,
            { nodeId, path }
          );
        }
      }

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
        value?.nodeLabels,
        value?.requirementKey,
        value?.nodeReferences
      );
    }

    return [...requirements.values()]
      .map(requirement => ({
        requirementKey:
          requirement.requirementKey,
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
        nodeReferences:
          [...requirement
            .nodeReferences.values()]
            .sort((left, right) =>
              left.path.localeCompare(
                right.path
              ) ||
              left.nodeId.localeCompare(
                right.nodeId
              )
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
        ) ||
        left.requirementKey.localeCompare(
          right.requirementKey
        )
      );
  }

  let factoryRegistryIntegrityCache = null;

  function factoryRegistryIntegrity(
    catalog,
    report,
    requiredNodes = []
  ) {
    const controller =
      window.RMLApiNodeFactoryController;
    if (
      typeof controller
        ?.verifyRegistryPublication ===
        "function"
    ) {
      try {
        const verifiedPublication = controller
          .verifyRegistryPublication(
            catalog,
            report,
            requiredNodes
          );
        if (
          verifiedPublication &&
          typeof verifiedPublication ===
            "object"
        ) {
          return verifiedPublication;
        }
      } catch (error) {
        console.error(
          window.RMLI18n.t("ui.literal.606988957e1b"),
          error
        );
      }
    }

    const registry =
      window.RMLModNodeRegistry;
    const definitions =
      registry?.getNodeDefinitions?.();
    const catalogFingerprint = String(
      catalog?.catalogFingerprint || ""
    );
    const engineVersion = String(
      catalog?.engineVersion || ""
    );
    const definitionRevision = Number(
      window.__RMLNodeDefinitionRevision
    ) || 0;
    const cacheMatches = Boolean(
      factoryRegistryIntegrityCache &&
      factoryRegistryIntegrityCache.registry ===
        registry &&
      factoryRegistryIntegrityCache.definitions ===
        definitions &&
      factoryRegistryIntegrityCache.report ===
        report &&
      factoryRegistryIntegrityCache.catalog ===
        catalog &&
      factoryRegistryIntegrityCache.catalogIdentity ===
        `${catalogFingerprint}|${engineVersion}` &&
      factoryRegistryIntegrityCache.definitionRevision ===
        definitionRevision
    );
    let publicationValid = false;
    let generatedDefinitions = 0;

    if (cacheMatches) {
      publicationValid =
        factoryRegistryIntegrityCache
          .publicationValid;
      generatedDefinitions =
        factoryRegistryIntegrityCache
          .generatedDefinitions;
    } else {
      publicationValid = Boolean(
        definitions &&
        typeof definitions === "object" &&
        !Array.isArray(definitions) &&
        catalogFingerprint &&
        report &&
        report.verificationPassed === true &&
        Number(report.totalGeneratedNodes) > 0
      );
      if (publicationValid) {
        for (const id in definitions) {
          if (!Object.prototype.hasOwnProperty.call(
            definitions,
            id
          )) {
            continue;
          }
          const definition = definitions[id];
          if (
            definition?.catalogGenerated !==
              true ||
            definition?.legacyCatalogAlias ===
              true
          ) {
            continue;
          }
          generatedDefinitions += 1;
          const contract =
            definition.apiVerification;
          if (
            definition.unavailableApiContract ===
              true ||
            !contract ||
            typeof contract !== "object" ||
            Number(contract.schemaVersion) !==
              REQUIRED_API_VERIFICATION_SCHEMA_VERSION ||
            String(contract.nodeId || "") !==
              id ||
            String(
              contract.catalogFingerprint || ""
            ) !== catalogFingerprint ||
            String(
              contract.engineVersion || ""
            ) !== engineVersion ||
            !String(
              contract.contractFingerprint || ""
            ).trim()
          ) {
            publicationValid = false;
          }
        }
        if (
          generatedDefinitions !==
            Number(
              report.totalGeneratedNodes
            )
        ) {
          publicationValid = false;
        }
      }
      factoryRegistryIntegrityCache = {
        registry,
        definitions,
        report,
        catalog,
        catalogIdentity:
          `${catalogFingerprint}|${engineVersion}`,
        definitionRevision,
        publicationValid,
        generatedDefinitions
      };
    }

    const missingRequired = [];
    for (const requirement of
      Array.isArray(requiredNodes)
        ? requiredNodes
        : []) {
      const operatorId = String(
        typeof requirement === "string"
          ? requirement
          : requirement?.operatorId || ""
      ).trim();
      if (!operatorId) continue;
      const definition =
        definitions?.[operatorId];
      const contract =
        definition?.apiVerification;
      const inputIds = new Set(
        (Array.isArray(definition?.inputs)
          ? definition.inputs
          : []).map(port =>
          String(port?.id || "")
        )
      );
      const outputIds = new Set(
        (Array.isArray(definition?.outputs)
          ? definition.outputs
          : []).map(port =>
          String(port?.id || "")
        )
      );
      const requiredInputs =
        typeof requirement === "string"
          ? []
          : Array.isArray(
                requirement?.inputPorts
              )
            ? requirement.inputPorts
            : [];
      const requiredOutputs =
        typeof requirement === "string"
          ? []
          : Array.isArray(
                requirement?.outputPorts
              )
            ? requirement.outputPorts
            : [];
      if (
        definition?.catalogGenerated !==
          true ||
        definition.unavailableApiContract ===
          true ||
        !contract ||
        typeof contract !== "object" ||
        Number(contract.schemaVersion) !==
          REQUIRED_API_VERIFICATION_SCHEMA_VERSION ||
        String(contract.nodeId || "") !==
          operatorId ||
        String(
          contract.catalogFingerprint || ""
        ) !== catalogFingerprint ||
        String(contract.engineVersion || "") !==
          engineVersion ||
        !String(
          contract.contractFingerprint || ""
        ).trim() ||
        !requiredInputs.every(id =>
          inputIds.has(String(id || ""))
        ) ||
        !requiredOutputs.every(id =>
          outputIds.has(String(id || ""))
        )
      ) {
        missingRequired.push(operatorId);
      }
    }

    return Object.freeze({
      valid:
        publicationValid &&
        missingRequired.length === 0,
      publicationValid,
      generatedDefinitions,
      expectedGeneratedDefinitions:
        Math.max(
          0,
          Number(
            report?.totalGeneratedNodes
          ) || 0
        ),
      missingRequired: Object.freeze([
        ...new Set(missingRequired)
      ])
    });
  }

  function factoryMatchesCatalog(
    catalog,
    report
  ) {
    return Boolean(
      catalog &&
      report &&
      report.verificationPassed === true &&
      report.moduleId ===
        CATALOG_LOADER_MODULE_ID &&
      Number(report.factoryVersion) ===
        REQUIRED_API_FACTORY_VERSION &&
      window.RMLApiNodeFactoryController
        ?.moduleId ===
        CATALOG_LOADER_MODULE_ID &&
      Number(
        window.RMLApiNodeFactoryController
          ?.factoryVersion
      ) === REQUIRED_API_FACTORY_VERSION &&
      Number(
        window.__RMLApiNodeFactoryVersion
      ) === REQUIRED_API_FACTORY_VERSION &&
      Number(
        report.verificationSchemaVersion
      ) ===
        REQUIRED_API_VERIFICATION_SCHEMA_VERSION &&
      Number(report.generatedTypes) > 0 &&
      Number(report.totalGeneratedNodes) > 0 &&
      String(
        report.catalogFingerprint || ""
      ) ===
        String(
          catalog.catalogFingerprint || ""
        ) &&
      String(report.engineVersion || "") ===
        String(catalog.engineVersion || "") &&
      factoryRegistryIntegrity(
        catalog,
        report
      ).publicationValid === true
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
    const semanticKey = value => {
      if (
        !value ||
        typeof value !== "object" ||
        Array.isArray(value) ||
        !String(value.ownerType || "").trim() ||
        !String(value.kind || "").trim()
      ) {
        return "";
      }
      const normalizeType = type =>
        String(type || "System.Object")
          .replace(/^global::/, "")
          .replace(/\s+/g, "")
          .replace(/&$/, "");
      return JSON.stringify({
        kind: String(value.kind),
        ownerType:
          normalizeType(value.ownerType),
        memberName:
          String(value.memberName || ""),
        parameters:
          (Array.isArray(value.parameters)
            ? value.parameters
            : []).map((parameter, index) => ({
              position: Math.max(
                0,
                Number(parameter?.position) ||
                index
              ),
              type: normalizeType(
                parameter?.elementType ||
                parameter?.type
              ),
              isByRef:
                parameter?.isByRef === true ||
                parameter?.isOut === true,
              isOut:
                parameter?.isOut === true
            })),
        returnType: normalizeType(
          value.returnType ||
          "System.Void"
        ),
        isStatic:
          value.isStatic === true,
        genericArity: Math.max(
          0,
          Number(value.genericArity) || 0
        )
      });
    };

    return requiredNodes
      .map(requirement => {
      const id =
        requirement.operatorId;
      const definition =
        definitions[id];
      const contract =
        definition?.apiVerification;
      const requiredSemanticKey =
        semanticKey(
          requirement.apiContract
        );

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
          ) &&
        (
          !requiredSemanticKey ||
          semanticKey(contract) ===
            requiredSemanticKey
        )
      );

      if (!contractValid) {
        return {
          requirementKey:
            String(
              requirement
                .requirementKey || ""
            ),
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
            requirementKey:
              String(
                requirement
                  .requirementKey || ""
              ),
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
        requirementKey:
          String(
            requirement
              .requirementKey || ""
          ),
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

  function reconcileLegacyRequiredApiNodes(
    requiredNodes,
    catalog
  ) {
    return queueCatalogActivationOperation(
      () => {
        const controller =
          window.RMLApiNodeFactoryController;
        const activeCatalog =
          statusCatalog();
        const resolvedCatalog =
          catalogSnapshotsMatch(
            activeCatalog,
            catalog
          )
            ? catalog
            : activeCatalog;
        const report =
          window.RMLApiNodeFactoryReport;

        if (
          !resolvedCatalog ||
          !factoryMatchesCatalog(
            resolvedCatalog,
            report
          ) ||
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
            resolvedCatalog
          );
      }
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
    }
  }

  async function activateCachedCatalogFallback() {
    const activeCatalog = statusCatalog();
    const activeReport =
      window.RMLApiNodeFactoryReport;

    if (
      activeCatalog &&
      factoryMatchesCatalog(
        activeCatalog,
        activeReport
      )
    ) {
      return activeCatalog;
    }

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
    const demandRequirements =
      normalizedRequiredApiNodes(options)
        .filter(requirement =>
          requirement.catalogScope === "api"
        );
    await ensureCatalogDemandOperators(
      demandRequirements.map(
        requirement =>
          requirement.operatorId
      )
    );
    const activeCatalog = statusCatalog();
    const activeReport =
      window.RMLApiNodeFactoryReport;
    const activeLive = Boolean(
      activeCatalog &&
      factoryMatchesCatalog(
        activeCatalog,
        activeReport
      ) &&
      currentScannerConnection().mode ===
        "live" &&
      activeReport?.liveCatalogVerified ===
        true
    );
    if (
      activeCatalog &&
      factoryMatchesCatalog(
        activeCatalog,
        activeReport
      ) &&
      (
        options.forceLiveRefresh !== true ||
        activeLive
      )
    ) {
      return Object.freeze({
        available: true,
        live: activeLive,
        cacheFallback: !activeLive,
        catalogBackedByCache: true,
        liveAttempted:
          currentScannerConnection().mode ===
            "live",
        source: activeLive
          ? "scanner-verified-cache"
          : "scanner-cache",
        catalogFingerprint: String(
          activeCatalog.catalogFingerprint ||
          ""
        ),
        engineVersion: String(
          activeCatalog.engineVersion || ""
        ),
        fingerprintMatchedCache:
          lastScannerFingerprintSync
            .fingerprintMatchedCache === true,
        cacheUpdatedFromLive:
          lastScannerFingerprintSync
            .cacheUpdatedFromLive === true
      });
    }

    notifyCatalogGate(
      options.onLiveLookup,
      {
        phase: "live",
        message:
          currentScannerConnection().mode === "live"
            ? window.RMLI18n.t("ui.literal.313f18890446")
            : window.RMLI18n.t("ui.literal.d549ec3a2638")
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
      }) === true;

    if (!connected) {
      notifyCatalogGate(
        options.onCacheFallback,
        {
          phase: "cache",
          message:
            currentScannerConnection().mode === "live"
              ? window.RMLI18n.t("ui.literal.7d1161f56e73")
              : window.RMLI18n.t("ui.literal.9ace8597394b")
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

  function ensureCatalogForExport(
    options = {}
  ) {
    const requiredNodes =
      normalizedRequiredApiNodes(options)
        .filter(requirement =>
          requirement.catalogScope ===
            "api"
        );

    return ensureCatalogDemandOperators(
      requiredNodes.map(
        requirement =>
          requirement.operatorId
      )
    ).then(() =>
      queueCatalogActivationOperation(
        async () => {
        let catalog = statusCatalog();
        let rebuilt = false;

        if (!catalog) {
          const cached =
            cachedCatalogRecord ||
            await readCachedLiveCatalog();
          if (cached) {
            const normalized =
              normalizeCatalog(
                cached.catalog,
                "scanner-cache",
                cached.sourceUrl || ""
              );
            await activateCatalogAndFactoryNow(
              normalized
            );
            rebuilt = true;
            catalog = statusCatalog();
          }
        }

        if (!catalog) {
          return Object.freeze({
            required:
              requiredNodes.length > 0,
            verified: false,
            available: false,
            rebuilt,
            unresolved:
              requiredNodes.length,
            unresolvedRequirements:
              Object.freeze([
                ...requiredNodes
              ]),
            failureLabels:
              Object.freeze([
                window.RMLI18n.t("ui.literal.5b43201db8a6")
              ]),
            catalogFingerprint: "",
            engineVersion: ""
          });
        }

        const expectedFingerprint = String(
          catalog.catalogFingerprint || ""
        );
        const expectedEngineVersion = String(
          catalog.engineVersion || ""
        );
        let report =
          window.RMLApiNodeFactoryReport;
        let integrity =
          factoryRegistryIntegrity(
            catalog,
            report,
            requiredNodes
          );
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
                requiredNodes,
                "the verified catalog factory publication is incomplete"
              );

        if (
          integrity.valid !== true ||
          missing.length > 0
        ) {
          await baseModNodesReady;
          await ensureApiNodesModuleLoaded();
          if (
            statusCatalog() !== catalog ||
            !catalogSnapshotsMatch(
              statusCatalog(),
              catalog
            )
          ) {
            throw new Error(
              window.RMLI18n.t("ui.literal.35f76455ea57")
            );
          }
          const controller =
            window.RMLApiNodeFactoryController;
          if (
            !controller ||
            typeof controller.rebuild !==
              "function"
          ) {
            throw new Error(
              window.RMLI18n.t("ui.literal.c5989983bcb6")
            );
          }
          await controller.rebuild(
            catalog,
            {
              createCatalogPublication
            }
          );
          rebuilt = true;
        }

        const activeCatalog = statusCatalog();
        report =
          window.RMLApiNodeFactoryReport;
        if (
          activeCatalog !== catalog ||
          !catalogSnapshotsMatch(
            activeCatalog,
            catalog
          ) ||
          String(
            activeCatalog
              ?.catalogFingerprint || ""
          ) !== expectedFingerprint ||
          String(
            activeCatalog
              ?.engineVersion || ""
          ) !== expectedEngineVersion
        ) {
          throw new Error(
            window.RMLI18n.t("ui.literal.68fd6954095b")
          );
        }

        integrity = factoryRegistryIntegrity(
          activeCatalog,
          report,
          requiredNodes
        );
        const factoryReady =
          factoryMatchesCatalog(
            activeCatalog,
            report
          );
        missing = factoryReady
          ? missingRequiredApiNodes(
              requiredNodes,
              activeCatalog,
              report
            )
          : unresolvedRequiredApiNodes(
              requiredNodes,
              "the verified catalog factory publication is incomplete"
            );
        const verified = Boolean(
          factoryReady &&
          integrity.valid === true &&
          missing.length === 0
        );

        return Object.freeze({
          required:
            requiredNodes.length > 0,
          verified,
          available: verified,
          rebuilt,
          unresolved: missing.length,
          unresolvedRequirements:
            Object.freeze(missing),
          failureLabels: Object.freeze(
            missing.map(
              requiredApiNodeFailureLabel
            )
          ),
          catalogFingerprint:
            expectedFingerprint,
          engineVersion:
            expectedEngineVersion
        });
        }
      )
    );
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
          window.RMLI18n.t("ui.auto.c216f5cc29b7"),
        message:
          `Checking ${requiredNodes.length} catalog contract famil${requiredNodes.length === 1 ? "y" : "ies"}; only instances with the same portable contract and parameters share a result.`,
        detail:
          window.RMLI18n.t("ui.literal.80f3da7aa6b8"),
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
            window.RMLI18n.t("ui.auto.97024eaeaa7a"),
          message:
            `Resolving ${scannerResolvableNodes.length} unresolved API contract${scannerResolvableNodes.length === 1 ? "" : "s"} by portable contract or exact stored API node name.`,
          detail:
            window.RMLI18n.t("ui.literal.b4b4122f396f"),
          progress: 51.75
        }
      );
      collectMigrations(
        await reconcileLegacyRequiredApiNodes(
          scannerResolvableNodes,
          catalog
        )
      );
      catalog = statusCatalog() ||
        catalog;
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
      catalog = statusCatalog() ||
        catalog;
      await activateCatalogAndFactory(
        catalog
      );
      catalog = statusCatalog() ||
        catalog;
      collectMigrations(
        await reconcileLegacyRequiredApiNodes(
          scannerResolvableNodes,
          catalog
        )
      );
      catalog = statusCatalog() ||
        catalog;
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

    const missingByRequirement =
      new Map(
        missing.map(failure => [
          String(
            failure?.requirementKey ||
            failure?.operatorId || ""
          ),
          failure
        ])
      );
    const unresolvedRequirements =
      requiredNodes
        .filter(requirement =>
          missingByRequirement.has(
            String(
              requirement
                ?.requirementKey ||
              requirement?.operatorId || ""
            )
          )
        )
        .map(requirement => ({
          requirementKey:
            String(
              requirement
                .requirementKey || ""
            ),
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
          nodeReferences:
            Object.freeze(
              (Array.isArray(
                requirement
                  .nodeReferences
              )
                ? requirement
                    .nodeReferences
                : [])
                .map(reference =>
                  Object.freeze({
                    nodeId: String(
                      reference?.nodeId ||
                      ""
                    ),
                    path: String(
                      reference?.path ||
                      "runtime-root"
                    )
                  })
                )
            ),
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
              ...missingByRequirement.get(
                String(
                  requirement
                    .requirementKey ||
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

  function synchronizeConnectedSession(
    connection = currentScannerConnection()
  ) {
    if (connection.mode === "live") {
      void synchronizeScannerStatus({
        manualSession: connection,
        showChecking: true,
        throwOnFailure: false
      }).then(synchronized => {
        if (synchronized === true && statusCatalog()) {
          catalogAvailabilityKnown = true;
          catalogAvailable = true;
          updateStatus();
          return;
        }

        if (!manualCatalogActivationPromise) {
          const existing =
            statusCatalog() ||
            cachedCatalogRecord?.catalog ||
            cachedCatalogStatus ||
            null;
          catalogAvailabilityKnown = true;
          catalogAvailable = Boolean(existing);
          if (existing) {
            updateStatus();
          } else {
            updateUnavailableStatus();
          }
        }
      });
      return;
    }

    demoteLiveFactoryReport();

    if (manualCatalogActivationPromise) {
      return;
    }

    const existing =
      statusCatalog() ||
      cachedCatalogRecord?.catalog ||
      cachedCatalogStatus ||
      null;
    catalogAvailabilityKnown = true;
    catalogAvailable = Boolean(existing);

    if (existing) {
      updateStatus();
    } else {
      updateUnavailableStatus();
    }
  }

  window.addEventListener("rml-scanner-connection", event => {
    synchronizeConnectedSession(event.detail);
  });
  window.addEventListener("rml-api-node-factory-ready", updateStatus);

  Object.defineProperty(
    window,
    "RMLCatalogDemandCache",
    {
      value: Object.freeze({
        version: 1,
        getPaletteIndex() {
          return catalogDemandPaletteIndex();
        },
        ensureOperators:
          ensureCatalogDemandOperators,
        ensureFull:
          activateFullCatalogDemandFallback,
        getState:
          catalogDemandPublicState
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

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

        await ensureApiNodesModuleLoaded();

        return true;
      });

  const modNodesReady =
    Promise.all([
      catalogReady,
      baseModNodesReady
      ])
      .then(async ([catalog]) => {
        await ensureApiNodesModuleLoaded();
        if (catalog) {
          let preparedCatalog = catalog;
          try {
            await activateCatalogAndFactory(
              preparedCatalog
            );
          } catch (error) {
            if (
              preparedCatalog
                .catalogDemandPartial !== true ||
              !catalogDemandState
            ) {
              throw error;
            }
            preparedCatalog =
              await activateFullCatalogDemandFallback(
                error?.message ||
                window.RMLI18n.t("ui.literal.c7a09cae19f9")
              );
            if (!preparedCatalog) {
              throw error;
            }
          }
          scheduleCatalogDemandIndexForRecord(
            cachedCatalogRecord
          );
          catalogAvailabilityKnown = true;
          catalogAvailable = true;
          cachedCatalogStatus =
            preparedCatalog;
          updateStatus();
        } else {
        }

        return true;
      })
      .catch(error => {
        console.error(
          window.RMLI18n.t("ui.literal.c65c449b572b"),
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
      installManualUnavailableCatalogActivation();

      if (
        catalogAvailabilityKnown &&
        catalogAvailable !== true
      ) {
        updateUnavailableStatus();
      }

      if (
        currentScannerConnection().mode ===
          "live"
      ) {
        synchronizeConnectedSession();
      } else if (statusCatalog()) {
        updateStatus();
      }

      queueMicrotask(() => {
        if (
          catalogAvailabilityKnown &&
          catalogAvailable !== true
        ) {
          updateUnavailableStatus();
        }
      });
    })
    .catch(() => {
      catalogAvailabilityKnown = true;
      catalogAvailable = false;
      installManualUnavailableCatalogActivation();
      updateUnavailableStatus();
    });

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

  Object.defineProperty(
    window,
    "RMLCatalogImportGate",
    {
      value: Object.freeze({
        version: 12,
        moduleId:
          CATALOG_LOADER_MODULE_ID,
        loaderVersion:
          LOADER_VERSION,
        requiredApiFactoryVersion:
          REQUIRED_API_FACTORY_VERSION,
        ensureForImport:
          ensureCatalogForImport,
        ensureLive:
          ensureCatalogForImport,
        ensureForReplacement:
          ensureCatalogForReplacement,
        ensureForExport:
          ensureCatalogForExport
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
