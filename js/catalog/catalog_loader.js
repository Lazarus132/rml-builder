(() => {
  "use strict";

  const CATALOG_LOADER_MODULE_ID =
    "1.22.5-dead-control-flow-cleanup";
  const LOADER_VERSION = 91;
  const DEFAULT_PORT_FIRST = 42719;
  const DEFAULT_PORT_LAST = 42725;
  const CATALOG_PATH = "/resonite_api_catalog.json";
  const BUILDER_SCANNER_CATALOG_PATH =
    "/rml-scanner-catalog";
  const BUILDER_SCANNER_DEMAND_PATH =
    "/rml-scanner-demand";
  const CACHE_DATABASE_NAME =
    "rml-resonite-api-catalog";
  const CACHE_DATABASE_VERSION = 3;
  const CACHE_STORE_NAME = "catalogs";
  const STREAM_DEMAND_OPERATOR_OWNER_INDEX =
    "stream-demand-operator-owner";
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
  const CATALOG_DEMAND_CHUNK_CACHE_LIMIT = 8;
  const CACHE_MANIFEST_MAX_BYTES =
    4 * 1024 * 1024;
  const CACHE_STAGING_RECORD_KEY =
    "catalog-chunk-staging";
  const CACHE_WRITE_LOCK_NAME =
    "rml-resonite-api-catalog-write-v1";
  const CACHE_ACTIVE_RECORD_KEY =
    "catalog-chunk-active";
  const DEMAND_CACHE_MANIFEST_KEY =
    "catalog-demand-manifest";
  const DEMAND_CACHE_FORMAT =
    "rml-catalog-demand-index-v3";
  const DEMAND_CACHE_SCHEMA_VERSION = 3;
  const DEMAND_CACHE_MANIFEST_MAX_BYTES =
    32 * 1024 * 1024;
  const STREAM_DEMAND_PROTOCOL =
    "rml-catalog-demand-v1";
  const STREAM_DEMAND_PROTOCOL_VERSION = 1;
  const LEGACY_STREAM_DEMAND_CACHE_FORMAT =
    "rml-catalog-demand-records-v2";
  const LEGACY_STREAM_DEMAND_CACHE_SCHEMA_VERSION = 2;
  const STREAM_DEMAND_CACHE_FORMAT =
    "rml-catalog-demand-records-v3";
  const STREAM_DEMAND_CACHE_SCHEMA_VERSION = 3;
  const STREAM_DEMAND_ACTIVE_KEY =
    "catalog-demand-stream-active";
  const STREAM_DEMAND_STAGING_KEY =
    "catalog-demand-stream-staging";
  const STREAM_DEMAND_KEY_PREFIX =
    "catalog-demand-stream:";
  const STREAM_DEMAND_MAX_LINE_BYTES =
    1024 * 1024;
  const STREAM_DEMAND_MAX_TOTAL_BYTES =
    1024 * 1024 * 1024;
  const STREAM_DEMAND_MAX_RECORDS =
    5_000_000;
  const STREAM_DEMAND_MAX_JSON_DEPTH = 32;
  const STREAM_DEMAND_MAX_JSON_NODES = 250_000;
  const STREAM_DEMAND_BATCH_RECORDS = 256;
  const STREAM_DEMAND_INGEST_BATCH_RECORDS =
    1024;
  const STREAM_DEMAND_BATCH_BYTES =
    1024 * 1024;
  const STREAM_DEMAND_CACHE_PREPARE_CONCURRENCY = 8;
  const STREAM_DEMAND_OWNER_CHUNK_RECORDS = 128;
  const STREAM_DEMAND_OWNER_CHUNK_BYTES =
    256 * 1024;
  const STREAM_DEMAND_OWNER_PAYLOAD_ENCODING =
    "gzip-json-v1";
  const STREAM_DEMAND_OWNER_IDENTITY_ENCODING =
    "identity-json-v1";
  const STREAM_DEMAND_OWNER_STORAGE_ENCODING =
    "binary-owner-payload-v1";
  const STREAM_DEMAND_OWNER_PAYLOAD_VERSION = 1;
  const STREAM_DEMAND_OWNER_PAYLOAD_HASH_ALGORITHM =
    "sha256-uncompressed-json-v1";
  const STREAM_DEMAND_OWNER_PAYLOAD_MAX_BYTES =
    STREAM_DEMAND_MAX_LINE_BYTES + 64 * 1024;
  const STREAM_DEMAND_OWNER_COMPRESSED_MAX_BYTES =
    STREAM_DEMAND_OWNER_PAYLOAD_MAX_BYTES +
      64 * 1024;
  const STREAM_DEMAND_OWNER_GZIP_MIN_BYTES =
    32 * 1024;
  const STREAM_DEMAND_OPERATOR_HASH_PREFIX_LENGTH = 3;
  const STREAM_DEMAND_OPERATOR_SHARD_RECORDS = 128;
  const STREAM_DEMAND_OPERATOR_SHARD_BYTES =
    256 * 1024;
  const STREAM_DEMAND_OPERATOR_READ_RECORDS = 64;
  const STREAM_DEMAND_COMPACTION_WRITE_BYTES =
    128 * 1024;
  const STREAM_DEMAND_PALETTE_SHARD_RECORDS = 128;
  const STREAM_DEMAND_PALETTE_SHARD_BYTES =
    128 * 1024;
  const STREAM_DEMAND_TRANSIENT_FLUSH_BYTES =
    2 * 1024 * 1024;
  const STREAM_DEMAND_QUERY_LIMIT = 240;
  const STREAM_DEMAND_EPHEMERAL_OWNER_CAP = 32;
  const STREAM_DEMAND_DEPENDENCY_OWNER_CAP = 2048;
  const REQUIRED_API_FACTORY_VERSION = 38;
  const REQUIRED_API_VERIFICATION_SCHEMA_VERSION = 3;

  const scriptUrl =
    document.currentScript?.src ||
    window.location.href;
  const modNodesUrl = new URL(
    "mod_nodes.js?v=803-visual-function-semantics",
    scriptUrl
  ).href;
  const visualCSharpUrl = new URL(
    "../compiler/visual_csharp.js?v=1.22.5-dead-control-flow-cleanup",
    scriptUrl
  ).href;
  const apiNodesUrl = new URL(
    "api_nodes.js?v=1.22.5-dead-control-flow-cleanup",
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
      !Number.isInteger(version) ||
      version < 1 ||
      !algorithm ||
      !Number.isInteger(schemaVersion) ||
      schemaVersion < 1 ||
      !scannerVersion ||
      !Number.isInteger(
        methodIdentityVersion
      ) ||
      methodIdentityVersion < 1 ||
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
      reloadSafetyCompatible,
      readerCompatible:
        version ===
          REQUIRED_SCANNER_FINGERPRINT_VERSION &&
        algorithm ===
          REQUIRED_SCANNER_FINGERPRINT_ALGORITHM &&
        schemaVersion >=
          REQUIRED_CATALOG_SCHEMA_VERSION &&
        methodIdentityVersion >=
          REQUIRED_METHOD_IDENTITY_VERSION
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
    const values = raw?.types;
    if (!Array.isArray(values)) return [];
    for (const value of values) {
      if (
        !value ||
        typeof value !== "object"
      ) {
        return values.filter(
          candidate =>
            candidate &&
            typeof candidate === "object"
        );
      }
    }
    return values;
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
  let scannerCheckGeneration = "";
  let scannerCheckWorkSession = 0;
  let scannerCheckMismatchSessionKey = "";
  let scannerCheckPresentedSessionKey = "";
  let scannerCheckRejectedSessionKey = "";
  let scannerCheckAbortController = null;
  const scannerCheckProgressChannels =
    new Map();
  let activeBuilderCatalogSessionKey = "";
  let catalogHealthSweepSequence = 0;
  let latestCatalogHealthSweepDiagnostics = null;
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
  let catalogStreamDemandManifest = null;
  let catalogStreamDemandIngestPromise = null;
  let catalogStreamDemandIngestKey = "";
  let catalogStreamDemandIngestController = null;
  let lastScannerFingerprintSync =
    Object.freeze({
      liveReached: false,
      fingerprintMatchedCache: false,
      cacheUpdatedFromLive: false,
      cacheFallback: false,
      fingerprint: ""
    });

  function catalogDemandDiagnosticTime() {
    const now = globalThis.performance?.now?.();
    return Number.isFinite(now)
      ? Number(now)
      : Date.now();
  }

  function publishCatalogDemandDiagnostics(
    value
  ) {
    const timings = Object.freeze(
      Object.fromEntries(
        Object.entries(value?.timings || {})
          .map(([name, milliseconds]) => [
            name,
            Math.max(
              0,
              Math.round(
                (Number(milliseconds) || 0) *
                  10
              ) / 10
            )
          ])
      )
    );
    const snapshot = Object.freeze({
      version: 1,
      status: String(value?.status || "running"),
      phase: String(value?.phase || "request"),
      generation: String(
        value?.generation || ""
      ).slice(0, 96),
      recordCount: Math.max(
        0,
        Number(value?.recordCount) || 0
      ),
      totalBytes: Math.max(
        0,
        Number(value?.totalBytes) || 0
      ),
      ownerCount: Math.max(
        0,
        Number(value?.ownerCount) || 0
      ),
      operatorCount: Math.max(
        0,
        Number(value?.operatorCount) || 0
      ),
      ownerChunkCount: Math.max(
        0,
        Number(value?.ownerChunkCount) || 0
      ),
      paletteShardCount: Math.max(
        0,
        Number(value?.paletteShardCount) || 0
      ),
      gzipPayloadCount: Math.max(
        0,
        Number(value?.gzipPayloadCount) || 0
      ),
      identityPayloadCount: Math.max(
        0,
        Number(value?.identityPayloadCount) || 0
      ),
      hashCount: Math.max(
        0,
        Number(value?.hashCount) || 0
      ),
      transactionCount: Math.max(
        0,
        Number(value?.transactionCount) || 0
      ),
      error: String(value?.error || "")
        .slice(0, 240),
      timings
    });
    try {
      Object.defineProperty(
        window,
        "RMLCatalogDemandDiagnostics",
        {
          configurable: true,
          enumerable: false,
          writable: false,
          value: snapshot
        }
      );
    } catch {}
    try {
      document.documentElement.dataset
        .rmlCatalogDemandDiagnostics =
          JSON.stringify(snapshot);
    } catch {}
    return snapshot;
  }

  function statusCatalog() {
    return (
      window.RMLResoniteApiCatalog ||
      window.RMLFrooxComponentCatalog ||
      null
    );
  }

  function verifiedLiveRuntimeCatalog(
    _catalog,
    _report
  ) {
    const selectedSession =
      window.RMLScannerHealthSession;
    const connection =
      window.RMLRuntimeBridge
        ?.getConnectionState?.();
    const selectedHealth =
      selectedSession?.health;
    const connectionHealth =
      connection?.health;
    return Boolean(
      _catalog &&
      _report?.liveCatalogVerified === true &&
      selectedSession &&
      selectedHealth?.ok === true &&
      selectedHealth.runtimeBridgeReady ===
        true &&
      Number(
        selectedHealth.runtimeBridgeVersion
      ) === 1 &&
      connection?.mode === "live" &&
      connectionHealth?.ok === true &&
      connectionHealth.runtimeBridgeReady ===
        true &&
      Number(
        connectionHealth.runtimeBridgeVersion
      ) === 1 &&
      String(
        connection.scannerBaseUrl || ""
      ) === String(
        selectedSession.scannerBaseUrl || ""
      )
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

    if (
      element.dataset.source === "updating" &&
      element.getAttribute("aria-busy") === "true"
    ) {
      return;
    }

    const catalog =
      statusCatalog() ||
      cachedCatalogStatus;
    const report =
      window.RMLApiNodeFactoryReport;
    const live =
      verifiedLiveRuntimeCatalog(
        catalog,
        report
      );

    if (live) {
      element.dataset.source = "scanner";
      element.textContent =
        "Resonite API · Live";
      element.setAttribute(
        "aria-pressed",
        "true"
      );
      element.setAttribute(
        "aria-busy",
        "false"
      );
      element.setAttribute(
        "aria-label",
        element.textContent
      );
      return;
    }

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
      element.setAttribute("aria-pressed", "false");
      element.setAttribute("aria-busy", "false");
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
      element.setAttribute("aria-pressed", "false");
      element.setAttribute("aria-busy", "false");
      return;
    }

    element.dataset.source = "cache";
    element.textContent =
      window.RMLI18n.t("{{i18n:js.presentation.925dcc9e0d7e}}");
    element.setAttribute(
      "aria-pressed",
      "false"
    );
    element.setAttribute(
      "aria-busy",
      "false"
    );

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

  function catalogAbortError(
    signal,
    label = "The catalog operation"
  ) {
    if (signal?.reason instanceof Error) {
      return signal.reason;
    }
    const error = new Error(
      `${String(label || "The catalog operation")} was cancelled before it completed.`
    );
    error.name = "AbortError";
    error.code = "RML_CATALOG_OPERATION_ABORTED";
    return error;
  }

  function awaitCatalogSettlement(
    operation,
    signal = null,
    label = "The catalog operation"
  ) {
    const pending = Promise.resolve(operation);
    if (!signal) return pending;

    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        signal.removeEventListener?.(
          "abort",
          onAbort
        );
        callback(value);
      };
      const onAbort = () => {
        pending.catch(() => {});
        finish(
          reject,
          catalogAbortError(signal, label)
        );
      };

      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener(
        "abort",
        onAbort,
        { once: true }
      );
      pending.then(
        value => finish(resolve, value),
        error => finish(reject, error)
      );
    });
  }

  async function fetchJson(url, signal = null) {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (signal?.aborted) abort();
    else signal?.addEventListener("abort", abort, { once: true });
    try {
      const requestUrl = new URL(
        url,
        window.location.href
      );
      const sameOrigin =
        requestUrl.origin ===
        window.location.origin;
      const response = await fetch(requestUrl.href, { cache: "no-store",
        mode: sameOrigin ? "same-origin" : "cors",
        credentials: sameOrigin ? "same-origin" : "omit",
        redirect: "error", signal: controller.signal,
        headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const value = await response.json();
      if (!value || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError(window.RMLI18n.t("ui.literal.1ff18edb1614"));
      }
      return value;
    } finally {
      signal?.removeEventListener("abort", abort);
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
      live?.fingerprint &&
      String(live.fingerprint)
        .trim()
        .toLowerCase() !== fingerprint
    ) {
      throw new Error(
        "The scanner catalog changed while it was being transferred. The current cache remains active and the new revision will be requested again."
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

        let settled = false;
        const request =
          window.indexedDB.open(
            CACHE_DATABASE_NAME,
            CACHE_DATABASE_VERSION
          );
        const finish = (callback, value) => {
          if (settled) {
            if (
              callback === resolve &&
              value &&
              typeof value.close === "function"
            ) {
              value.close();
            }
            return;
          }
          settled = true;
            callback(value);
        };
  
        request.onupgradeneeded =
          () => {
            const database =
              request.result;
            let store;
            if (
              !database.objectStoreNames
                .contains(
                  CACHE_STORE_NAME
                )
            ) {
              store = database.createObjectStore(
                CACHE_STORE_NAME,
                { keyPath: "id" }
              );
            } else {
              store = request.transaction
                .objectStore(
                  CACHE_STORE_NAME
                );
            }
            if (
              store &&
              store.indexNames.contains(
                "stream-demand-operator-stage"
              )
            ) {
              store.deleteIndex(
                "stream-demand-operator-stage"
              );
            }
            if (
              store &&
              !store.indexNames.contains(
                STREAM_DEMAND_OPERATOR_OWNER_INDEX
              )
            ) {
              store.createIndex(
                STREAM_DEMAND_OPERATOR_OWNER_INDEX,
                "operatorStageKeys",
                {
                  unique: true,
                  multiEntry: true
                }
              );
            }
          };

        request.onsuccess =
          () => {
            request.result.onversionchange =
              () => request.result.close();
            finish(
              resolve,
              request.result
            );
          };
        request.onerror =
          () => finish(
            reject,
            request.error ||
            new Error(
              window.RMLI18n.t("ui.literal.96ef78a457d3")
            )
          );
        request.onblocked =
          () => finish(
            reject,
            new Error(
              window.RMLI18n.t("ui.literal.cbb79c27ce96")
            )
          );
      }
    );
  }

  function catalogCacheCapacityFailure(
    error
  ) {
    const messages = [];
    let current = error;
    for (
      let depth = 0;
      current && depth < 6;
      depth += 1
    ) {
      messages.push(
        String(
          current?.name || ""
        ),
        String(
          current?.message || current || ""
        )
      );
      current = current?.cause;
    }
    return /FILE_ERROR_NO_SPACE|QuotaExceededError|quota.{0,24}(?:exceed|full)|(?:disk|storage).{0,24}(?:full|space)|no space/i
      .test(messages.join(" "));
  }

  function readCatalogCacheValue(
    database,
    key
  ) {
    return new Promise(
      (resolve, reject) => {
        let settled = false;
        const transaction =
          database.transaction(
            CACHE_STORE_NAME,
            "readonly"
          );
        const request = transaction
          .objectStore(CACHE_STORE_NAME)
          .get(key);
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
            callback(value);
        };
        const fail = error => finish(
          reject,
          error ||
          new Error(
            window.RMLI18n.t("ui.literal.0e2d6d316dae")
          )
        );
          request.onsuccess = () =>
          finish(resolve, request.result || null);
        request.onerror = () =>
          fail(request.error);
        transaction.onerror = () =>
          fail(transaction.error);
        transaction.onabort = () =>
          fail(transaction.error);
      }
    );
  }

  function waitForCatalogCacheTransaction(
    transaction,
    {
      errorMessage,
      abortMessage
    }
  ) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      transaction.oncomplete = () =>
        finish(resolve, true);
      transaction.onerror = () =>
        finish(
          reject,
          transaction.error ||
          new Error(errorMessage)
        );
      transaction.onabort = () =>
        finish(
          reject,
          transaction.error ||
          new Error(abortMessage)
        );
    });
  }

  function catalogCachePersistenceError(
    error,
    message
  ) {
    const wrapped = new Error(
      `${String(message || "The local catalog cache could not be persisted.")} ${String(error?.message || error || "")}`.trim(),
      { cause: error }
    );
    wrapped.code =
      "RML_CATALOG_CACHE_PERSIST_FAILED";
    return wrapped;
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
    const transaction =
      database.transaction(
        CACHE_STORE_NAME,
        "readwrite"
      );
    transaction.objectStore(
      CACHE_STORE_NAME
    ).put(record);
    return waitForCatalogCacheTransaction(
      transaction,
      {
        errorMessage:
          window.RMLI18n.t("ui.literal.b86a898007fb"),
        abortMessage:
          window.RMLI18n.t("ui.literal.a4e8e8baf994"),
        timeoutMessage:
          "The local catalog cache write stopped responding; the active in-memory catalog remains usable."
      }
    ).catch(error => {
      throw catalogCachePersistenceError(
        error,
        "The streamed catalog cache batch could not be written."
      );
    });
  }

  function commitCatalogCacheManifest(
    database,
    manifest
  ) {
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
    return waitForCatalogCacheTransaction(
      transaction,
      {
        errorMessage:
          window.RMLI18n.t("ui.literal.4b255e933f18"),
        abortMessage:
          window.RMLI18n.t("ui.literal.dd513fe319e9"),
        timeoutMessage:
          "The local catalog cache commit stopped responding; the previous committed cache remains active."
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
    return waitForCatalogCacheTransaction(
      transaction,
      {
        errorMessage:
          window.RMLI18n.t("ui.literal.98dc843f8986"),
        abortMessage:
          window.RMLI18n.t("ui.literal.7fb445caf1a2"),
        timeoutMessage:
          "The local catalog cache cleanup stopped responding; the Builder will continue without waiting for it."
      }
    );
  }

  function catalogStreamDemandGenerationPrefix(
    generation
  ) {
    return `${STREAM_DEMAND_KEY_PREFIX}${String(generation || "")}:`;
  }

  function catalogStreamDemandKeyPart(value) {
    return encodeURIComponent(
      String(value || "")
    );
  }

  function catalogStreamDemandIndexPart(index) {
    return String(
      Math.max(0, Number(index) || 0)
    ).padStart(10, "0");
  }

  function catalogStreamDemandRecordKey(
    generation,
    ...parts
  ) {
    return (
      catalogStreamDemandGenerationPrefix(
        generation
      ) +
      parts.map(
        catalogStreamDemandKeyPart
      ).join(":")
    );
  }

  function catalogStreamDemandManifestKey(
    generation
  ) {
    return catalogStreamDemandRecordKey(
      generation,
      "manifest"
    );
  }

  async function storeCatalogCacheBatch(
    database,
    entries,
    metrics = null
  ) {
    if (
      !Array.isArray(entries) ||
      entries.length === 0
    ) {
      return true;
    }
    const candidates = entries.filter(
      entry => Boolean(entry?.value)
    );
    const prepared = new Array(
      candidates.length
    );
    let nextIndex = 0;
    const preparationStarted =
      catalogDemandDiagnosticTime();
    const prepareNext = async () => {
      while (nextIndex < candidates.length) {
        const index = nextIndex;
        nextIndex += 1;
        prepared[index] =
          await prepareCatalogStreamCacheEntryForStorage(
            candidates[index],
            metrics
          );
      }
    };
    await Promise.all(
      Array.from(
        {
          length: Math.min(
            STREAM_DEMAND_CACHE_PREPARE_CONCURRENCY,
            candidates.length
          )
        },
        () => prepareNext()
      )
    );
    if (metrics) {
      metrics.batchPreparationMs =
        (Number(metrics.batchPreparationMs) || 0) +
        (
          catalogDemandDiagnosticTime() -
          preparationStarted
        );
    }
    const transactionStarted =
      catalogDemandDiagnosticTime();
    let transaction;
    try {
      transaction = database.transaction(
        CACHE_STORE_NAME,
        "readwrite",
        { durability: "relaxed" }
      );
    } catch {
      transaction = database.transaction(
        CACHE_STORE_NAME,
        "readwrite"
      );
    }
    if (metrics) {
      metrics.transactionCount =
        (Number(metrics.transactionCount) || 0) + 1;
    }
    const store = transaction.objectStore(
      CACHE_STORE_NAME
    );
    for (const entry of prepared) {
      if (entry.add === true) {
        store.add(entry.value);
      } else {
        store.put(entry.value);
      }
    }
    try {
      return await waitForCatalogCacheTransaction(
        transaction,
        {
          errorMessage:
            "The streamed catalog cache batch could not be written.",
          abortMessage:
            "The streamed catalog cache batch was rejected.",
          timeoutMessage:
            "The streamed catalog cache write stopped responding."
        }
      );
    } finally {
      if (metrics) {
        metrics.transactionMs =
          (Number(metrics.transactionMs) || 0) +
          (
            catalogDemandDiagnosticTime() -
            transactionStarted
          );
      }
    }
  }

  function readCatalogCachePrefixBatch(
    database,
    prefix,
    afterKey = "",
    maximumRecords = 8
  ) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const records = [];
      let lastKey = "";
      const transaction = database.transaction(
        CACHE_STORE_NAME,
        "readonly"
      );
      const store = transaction.objectStore(
        CACHE_STORE_NAME
      );
      const lower = afterKey || prefix;
      const range = IDBKeyRange.bound(
        lower,
        `${prefix}\uffff`,
        Boolean(afterKey),
        false
      );
      const request = store.openCursor(range);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      const fail = error => finish(
        reject,
        error || transaction.error ||
          new Error(
            "The streamed catalog cache prefix batch failed."
          )
      );
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const key = String(cursor.key || "");
        if (!key.startsWith(prefix)) {
          try {
            transaction.abort();
          } catch {}
          fail(new Error(
            "A streamed catalog cache key escaped its requested prefix."
          ));
          return;
        }
        records.push(cursor.value);
        lastKey = key;
        if (records.length < maximumRecords) {
          cursor.continue();
        }
      };
      request.onerror = () => fail(request.error);
      transaction.onerror = () =>
        fail(transaction.error);
      transaction.onabort = () =>
        fail(transaction.error);
      transaction.oncomplete = () => finish(
        resolve,
        { records, lastKey }
      );
    });
  }

  function readCatalogCachePrefix(
    database,
    prefix,
    visit,
    maximumRecords =
      STREAM_DEMAND_MAX_RECORDS
  ) {
    return new Promise((resolve, reject) => {
      let settled = false;
      let visited = 0;
      const transaction = database.transaction(
        CACHE_STORE_NAME,
        "readonly"
      );
      const store = transaction.objectStore(
        CACHE_STORE_NAME
      );
      const range = IDBKeyRange.bound(
        prefix,
        `${prefix}\uffff`,
        false,
        false
      );
      const request = store.openCursor(range);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      const fail = error => finish(
        reject,
        error || transaction.error ||
          new Error(
            "The streamed catalog cache cursor failed."
          )
      );
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        visited += 1;
        if (visited > maximumRecords) {
          try {
            transaction.abort();
          } catch {}
          fail(new Error(
            "The streamed catalog cache cursor exceeded its record bound."
          ));
          return;
        }
        let keepGoing = true;
        try {
          keepGoing = visit(
            cursor.value,
            visited - 1
          ) !== false;
        } catch (error) {
          try {
            transaction.abort();
          } catch {}
          fail(error);
          return;
        }
        if (keepGoing) {
          cursor.continue();
        }
      };
      request.onerror = () =>
        fail(request.error);
      transaction.onerror = () =>
        fail(transaction.error);
      transaction.onabort = () =>
        fail(transaction.error);
      transaction.oncomplete = () =>
        finish(resolve, visited);
    });
  }

  async function readCatalogCacheIndexValues(
    database,
    indexName,
    keys
  ) {
    const uniqueKeys = [...new Set(
      (Array.isArray(keys) ? keys : [])
        .map(String)
    )];
    if (uniqueKeys.length === 0) {
      return new Map();
    }
    const primaryKeys = await new Promise((resolve, reject) => {
      let settled = false;
      const values = new Map();
      const transaction = database.transaction(
        CACHE_STORE_NAME,
        "readonly"
      );
      const store = transaction.objectStore(
        CACHE_STORE_NAME
      );
      const index = store.index(indexName);
      if (typeof index.getKey !== "function") {
        reject(new Error(
          "The browser cannot perform bounded catalog index lookups."
        ));
        return;
      }
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      const fail = error => finish(
        reject,
        error || transaction.error ||
          new Error(
            "The streamed catalog cache index batch read failed."
          )
      );
      for (const key of uniqueKeys) {
        const request = index.getKey(key);
        request.onsuccess = () => {
          if (request.result != null) {
            values.set(
              key,
              String(request.result)
            );
          }
        };
        request.onerror = () =>
          fail(request.error);
      }
      transaction.onerror = () =>
        fail(transaction.error);
      transaction.onabort = () =>
        fail(transaction.error);
      transaction.oncomplete = () =>
        finish(resolve, values);
    });
    const records = await readCatalogCacheValues(
      database,
      [...new Set(primaryKeys.values())]
    );
    const values = new Map();
    for (const [indexKey, primaryKey] of primaryKeys) {
      const record = records.get(primaryKey);
      if (record) values.set(indexKey, record);
    }
    return values;
  }

  function readCatalogCacheIndexBatch(
    database,
    indexName,
    prefix,
    afterKey = "",
    maximumRecords =
      STREAM_DEMAND_COMPACTION_READ_RECORDS
  ) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const records = [];
      let lastKey = "";
      const transaction = database.transaction(
        CACHE_STORE_NAME,
        "readonly"
      );
      const store = transaction.objectStore(
        CACHE_STORE_NAME
      );
      const index = store.index(indexName);
      const lower = afterKey || prefix;
      const range = IDBKeyRange.bound(
        lower,
        `${prefix}\uffff`,
        Boolean(afterKey),
        false
      );
      const request = index.openCursor(range);
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      const fail = error => finish(
        reject,
        error || transaction.error ||
          new Error(
            "The streamed catalog cache index cursor failed."
          )
      );
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) return;
        const key = String(cursor.key || "");
        if (!key.startsWith(prefix)) {
          try {
            transaction.abort();
          } catch {}
          fail(new Error(
            "A streamed catalog cache index key escaped its generation prefix."
          ));
          return;
        }
        records.push(cursor.value);
        lastKey = key;
        if (records.length < maximumRecords) {
          cursor.continue();
        }
      };
      request.onerror = () =>
        fail(request.error);
      transaction.onerror = () =>
        fail(transaction.error);
      transaction.onabort = () =>
        fail(transaction.error);
      transaction.oncomplete = () =>
        finish(resolve, {
          records,
          lastKey
        });
    });
  }

  async function deleteCatalogCachePrefixBatches(
    database,
    prefix
  ) {
    let deleted = 0;
    let batches = 0;
    let previousFirstKey = "";
    while (true) {
      const keys = [];
      await readCatalogCachePrefix(
        database,
        prefix,
        record => {
          const key = String(
            record?.id || ""
          );
          if (!key.startsWith(prefix)) {
            throw new Error(
              "A streamed staging key escaped its generation prefix."
            );
          }
          keys.push(key);
          return keys.length <
            STREAM_DEMAND_BATCH_RECORDS;
        },
        STREAM_DEMAND_BATCH_RECORDS
      );
      if (keys.length === 0) {
        return deleted;
      }
      if (keys[0] === previousFirstKey) {
        throw new Error(
          "The streamed staging cleanup stopped making progress."
        );
      }
      previousFirstKey = keys[0];
      deleted += keys.length;
      await deleteCatalogCacheKeys(
        database,
        keys
      );
      batches += 1;
      if (
        keys.length <
          STREAM_DEMAND_BATCH_RECORDS
      ) {
        return deleted;
      }
      if (batches % 8 === 0) {
        await yieldCatalogCacheWork();
      }
    }
    return deleted;
  }

  async function reclaimObsoleteCatalogStorage(
    database
  ) {
    const active =
      await readCatalogCacheValue(
        database,
        STREAM_DEMAND_ACTIVE_KEY
      );
    const activeGeneration = String(
      active?.generation || ""
    );
    const staging =
      await readCatalogCacheValue(
        database,
        STREAM_DEMAND_STAGING_KEY
      );
    if (staging) {
      const stagedGeneration = String(
        staging.generation || ""
      );
      if (
        /^[a-z0-9-]{12,96}$/i.test(
          stagedGeneration
        ) &&
        stagedGeneration !== activeGeneration
      ) {
        await deleteCatalogCachePrefixBatches(
          database,
          catalogStreamDemandGenerationPrefix(
            stagedGeneration
          )
        );
      }
      await deleteCatalogCacheKeys(
        database,
        [STREAM_DEMAND_STAGING_KEY]
      );
    }
    const activeManifest = active?.manifestId
      ? await readCatalogCacheValue(
          database,
          active.manifestId
        )
      : null;
    const streamedCacheIsValid = Boolean(
      activeGeneration &&
      activeManifest?.generation ===
        activeGeneration &&
      validCatalogStreamDemandManifest(
        activeManifest
      )
    );
    if (!streamedCacheIsValid) {
      return false;
    }

    const previousGeneration = String(
      active?.previousGeneration || ""
    );
    if (
      previousGeneration &&
      previousGeneration !== activeGeneration
    ) {
      await deleteCatalogCachePrefixBatches(
        database,
        catalogStreamDemandGenerationPrefix(
          previousGeneration
        )
      );
    }

    const fullManifest =
      await readCatalogCacheValue(
        database,
        CACHE_RECORD_KEY
      );
    if (fullManifest?.generation) {
      await removeCatalogCacheGeneration(
        database,
        String(fullManifest.generation),
        Math.max(
          0,
          Number(fullManifest.chunkCount) || 0
        )
      );
    }
    const staleStaging =
      await readCatalogCacheValue(
        database,
        CACHE_STAGING_RECORD_KEY
      );
    if (
      staleStaging?.generation &&
      staleStaging.generation !==
        fullManifest?.generation
    ) {
      await removeCatalogCacheGeneration(
        database,
        String(staleStaging.generation),
        Math.max(
          0,
          Number(staleStaging.chunkCount) || 0
        )
      );
    }
    await deleteCatalogCacheKeys(
      database,
      [
        CACHE_RECORD_KEY,
        CACHE_ACTIVE_RECORD_KEY,
        CACHE_STAGING_RECORD_KEY,
        DEMAND_CACHE_MANIFEST_KEY
      ]
    );
    return true;
  }

  function readCatalogCacheValues(
    database,
    keys
  ) {
    const uniqueKeys = [...new Set(
      (Array.isArray(keys) ? keys : [])
        .map(String)
    )];
    if (uniqueKeys.length === 0) {
      return Promise.resolve(new Map());
    }
    return new Promise((resolve, reject) => {
      let settled = false;
      const values = new Map();
      const transaction = database.transaction(
        CACHE_STORE_NAME,
        "readonly"
      );
      const store = transaction.objectStore(
        CACHE_STORE_NAME
      );
      const finish = (callback, value) => {
        if (settled) return;
        settled = true;
        callback(value);
      };
      const fail = error => finish(
        reject,
        error || transaction.error ||
          new Error(
            "The streamed catalog cache batch read failed."
          )
      );
      for (const key of uniqueKeys) {
        const request = store.get(key);
        request.onsuccess = () => {
          if (request.result) {
            values.set(key, request.result);
          }
        };
        request.onerror = () =>
          fail(request.error);
      }
      transaction.onerror = () =>
        fail(transaction.error);
      transaction.onabort = () =>
        fail(transaction.error);
      transaction.oncomplete = () =>
        finish(resolve, values);
    });
  }

  function assertCatalogStreamJsonBounds(
    value
  ) {
    const stack = [{ value, depth: 0 }];
    let nodes = 0;
    while (stack.length > 0) {
      const current = stack.pop();
      nodes += 1;
      if (nodes > STREAM_DEMAND_MAX_JSON_NODES) {
        throw new Error(
          "A streamed catalog record contains too many JSON values."
        );
      }
      if (
        current.depth >
          STREAM_DEMAND_MAX_JSON_DEPTH
      ) {
        throw new Error(
          "A streamed catalog record is nested too deeply."
        );
      }
      const item = current.value;
      if (
        !item ||
        typeof item !== "object"
      ) {
        continue;
      }
      const values = Array.isArray(item)
        ? item
        : Object.values(item);
      if (
        values.length >
          STREAM_DEMAND_MAX_JSON_NODES
      ) {
        throw new Error(
          "A streamed catalog record contains an oversized container."
        );
      }
      for (const child of values) {
        if (
          child &&
          typeof child === "object"
        ) {
          stack.push({
            value: child,
            depth: current.depth + 1
          });
        }
      }
    }
  }

  function catalogStreamDemandCounts(value) {
    const names = [
      "assemblies",
      "components",
      "materials",
      "commonMaterials",
      "meshes",
      "slotAttachOverloads",
      "types",
      "enums"
    ];
    const counts = {};
    for (const name of names) {
      const count = Number(value?.[name]);
      if (
        !Number.isInteger(count) ||
        count < 0 ||
        count >
          CACHE_CHUNK_MAX_CONTAINER_ENTRIES
      ) {
        throw new Error(
          `The streamed catalog count '${name}' is invalid.`
        );
      }
      counts[name] = count;
    }
    return Object.freeze(counts);
  }

  function catalogStreamDemandSameCounts(
    left,
    right
  ) {
    return [
      "assemblies",
      "components",
      "materials",
      "commonMaterials",
      "meshes",
      "slotAttachOverloads",
      "types",
      "enums"
    ].every(name =>
      Number(left?.[name]) ===
        Number(right?.[name])
    );
  }

  function catalogStreamNormalizeCsType(value) {
    let text = String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, " ");
    if (text.endsWith("?")) {
      text = text.slice(0, -1);
    }
    return text;
  }

  function catalogStreamExactType(value) {
    return String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, " ");
  }

  function catalogStreamShortTypeName(value) {
    const text =
      catalogStreamNormalizeCsType(value);
    const generic = text.lastIndexOf("<");
    const head = generic >= 0
      ? text.slice(0, generic)
      : text;
    const name = head.split(".").pop() ||
      head || "Type";
    return generic >= 0
      ? `${name}${text.slice(generic)}`
      : name;
  }

  function catalogStreamSafeType(value) {
    const text = String(value || "")
      .trim()
      .replace(/^global::/, "")
      .replace(/\s+/g, "");
    return Boolean(
      text &&
      !/[+`();{}=*]/.test(text) &&
      !text.endsWith("&") &&
      !text.includes("delegate*") &&
      ![
        "System.TypedReference",
        "System.ArgIterator",
        "System.RuntimeArgumentHandle"
      ].includes(text)
    );
  }

  function catalogStreamNoisyOwner(ownerRow) {
    const owner =
      catalogStreamNormalizeCsType(
        ownerRow?.fullName || ""
      );
    return Boolean(
      ownerRow?.isObsolete ||
      ownerRow?.isLegacyNamed ||
      ownerRow?.isDebugNamed ||
      ownerRow?.isEditorNamed ||
      ownerRow?.isToolNamed ||
      ownerRow?.isGizmoNamed ||
      owner === "HarmonyLib" ||
      owner.startsWith("HarmonyLib.")
    );
  }

  function catalogStreamParameterIdentity(
    parameters
  ) {
    return (Array.isArray(parameters)
      ? parameters
      : []).map((parameter, index) => ({
        position: Math.max(
          0,
          Number(parameter?.position) || index
        ),
        type: catalogStreamExactType(
          parameter?.elementType ||
          parameter?.type ||
          "System.Object"
        ),
        isByRef:
          parameter?.isByRef === true ||
          parameter?.isOut === true,
        isOut: parameter?.isOut === true
      }));
  }

  function catalogStreamCanonicalMemberId(
    prefix,
    {
      kind,
      owner,
      memberName = "",
      parameters = [],
      returnType = "System.Void",
      isStatic = false,
      genericArity = 0
    }
  ) {
    return `${prefix}${stableCatalogHash(
      JSON.stringify({
        kind: String(kind || ""),
        ownerType:
          catalogStreamNormalizeCsType(owner),
        memberName: String(memberName || ""),
        parameters:
          catalogStreamParameterIdentity(
            parameters
          ),
        returnType:
          catalogStreamExactType(
            returnType || "System.Void"
          ),
        isStatic: isStatic === true,
        genericArity: Math.max(
          0,
          Number(genericArity) || 0
        )
      })
    )}`;
  }

  const CATALOG_STREAM_GROUPS =
    Object.freeze({
      types: "API · Types & Enums",
      constructors: "API · Constructors",
      methods: "API · Methods",
      properties: "API · Properties",
      fields: "API · Fields",
      events: "API · Events",
      advanced: "Advanced / Raw C#"
    });

  function catalogStreamDefinition(
    operatorId,
    owner,
    locator,
    {
      title,
      group,
      symbol,
      kind,
      searchText,
      description = "",
      customCSharp = true
    }
  ) {
    const definition = Object.freeze({
      title: String(title || operatorId),
      description: String(description || ""),
      apiSearchText: String(
        searchText || ""
      ),
      group: String(group || "Other"),
      symbol: String(symbol || "API"),
      expertOnly:
        group ===
          CATALOG_STREAM_GROUPS.advanced,
      hiddenFromPalette: false,
      catalogGenerated: true,
      catalogType:
        catalogStreamNormalizeCsType(owner),
      apiMemberKind: String(kind || ""),
      customCSharpCatalogNode:
        customCSharp === true
    });
    return Object.freeze({
      operatorId,
      owner:
        catalogStreamNormalizeCsType(owner),
      locator: Object.freeze({ ...locator }),
      definition
    });
  }

  function catalogStreamSupportedParameters(
    parameters
  ) {
    return (
      Array.isArray(parameters) &&
      parameters.every(parameter =>
        parameter &&
        typeof parameter === "object" &&
        parameter.isPointer !== true &&
        parameter.isFunctionPointer !== true &&
        parameter.isByRefLike !== true &&
        catalogStreamSafeType(
          parameter.elementType ||
          parameter.type || ""
        )
      )
    );
  }

  function catalogStreamDirectMethod(
    owner,
    method,
    parameters
  ) {
    const directlyReferenceable = value => {
      const text =
        catalogStreamNormalizeCsType(value);
      return Boolean(
        catalogStreamSafeType(text) &&
        !/`\d+/.test(text) &&
        !/^(?:T|T[A-Z][A-Za-z0-9_]*)$/.test(
          text
        ) &&
        !/(?:^|[<, ])(?:T|T[A-Z][A-Za-z0-9_]*)(?:[>, ]|$)/.test(
          text
        )
      );
    };
    return Boolean(
      directlyReferenceable(owner) &&
      method?.isPublic !== false &&
      method?.isSpecialName !== true &&
      method?.isGenericMethodDefinition !== true &&
      !parameters.some(parameter =>
        parameter?.isOptional === true
      ) &&
      directlyReferenceable(
        method?.returnType || "System.Void"
      ) &&
      parameters.every(parameter =>
        directlyReferenceable(
          parameter?.elementType ||
          parameter?.type || ""
        )
      ) &&
      /^[A-Za-z_][A-Za-z0-9_]*$/.test(
        String(method?.name || "")
      )
    );
  }

  function catalogStreamProjectType(
    record
  ) {
    const row = record?.value;
    const owner =
      catalogStreamNormalizeCsType(
        record?.owner || row?.fullName
      );
    if (
      !row ||
      !owner ||
      row.isPublic === false ||
      row.isByRefLike === true ||
      row.isGeneric === true ||
      row.isObsolete === true ||
      row.isLegacyNamed === true ||
      owner === "System.Void" ||
      !catalogStreamSafeType(owner) ||
      owner.includes("<>")
    ) {
      return [];
    }
    const operatorId =
      `api.type.${stableCatalogHash(owner)}`;
    const group = catalogStreamNoisyOwner(row)
      ? CATALOG_STREAM_GROUPS.advanced
      : CATALOG_STREAM_GROUPS.types;
    return [catalogStreamDefinition(
      operatorId,
      owner,
      {
        record: "type-header",
        index: Number(record.index)
      },
      {
        title:
          `${row.kind === "enum" ? "Enum type" : "Type"} · ${row.name || catalogStreamShortTypeName(owner)}`,
        group,
        symbol: "TYPE",
        kind: "type",
        searchText: `${owner} type typeof`,
        description:
          `Exact System.Type constant for ${owner}.`
      }
    )];
  }

  function catalogStreamProjectEnum(
    record
  ) {
    const row = record?.value;
    const owner =
      catalogStreamNormalizeCsType(
        record?.owner || row?.fullName
      );
    if (
      !row ||
      !owner ||
      row.isObsolete === true ||
      Number(record?.counts?.values) < 1 ||
      !catalogStreamSafeType(owner)
    ) {
      return [];
    }
    const operatorId =
      `api.enum.${stableCatalogHash(owner)}`;
    const group =
      owner === "HarmonyLib" ||
      owner.startsWith("HarmonyLib.")
        ? CATALOG_STREAM_GROUPS.advanced
        : CATALOG_STREAM_GROUPS.types;
    return [catalogStreamDefinition(
      operatorId,
      owner,
      {
        record: "enum-header",
        index: Number(record.index)
      },
      {
        title:
          `Enum · ${catalogStreamShortTypeName(owner)}`,
        group,
        symbol: "ENUM",
        kind: "enum",
        searchText: owner,
        description:
          `Typed constant for ${owner}.`
      }
    )];
  }

  function catalogStreamProjectMember(
    record,
    ownerRow
  ) {
    const member = record?.value;
    const sourceKind = String(
      record?.memberKind || ""
    );
    const owner =
      catalogStreamNormalizeCsType(
        record?.owner ||
        ownerRow?.fullName ||
        member?.declaringType
      );
    const displayOwner =
      ownerRow?.name ||
      catalogStreamShortTypeName(owner);
    const noisy =
      catalogStreamNoisyOwner(ownerRow);
    const group = normal =>
      noisy
        ? CATALOG_STREAM_GROUPS.advanced
        : normal;
    const locator = {
      record: "member",
      memberKind: sourceKind,
      index: Number(record?.index)
    };
    if (
      !member ||
      !owner ||
      ownerRow?.isGeneric === true
    ) {
      return [];
    }

    if (sourceKind === "constructor") {
      const parameters = member.parameters;
      if (
        ownerRow?.isAbstract === true ||
        ownerRow?.kind === "interface" ||
        member.isPublic === false ||
        !catalogStreamSupportedParameters(
          parameters
        )
      ) {
        return [];
      }
      const operatorId =
        catalogStreamCanonicalMemberId(
          "api.ctor.",
          {
            kind: "constructor",
            owner,
            parameters,
            returnType: owner
          }
        );
      return [catalogStreamDefinition(
        operatorId,
        owner,
        locator,
        {
          title: `New · ${displayOwner}`,
          group: group(
            CATALOG_STREAM_GROUPS.constructors
          ),
          symbol: "new",
          kind: "constructor",
          searchText:
            `${owner} ${member.signature || "constructor new"}`,
          description:
            member.signature ||
            `Constructs ${owner}.`
        }
      )];
    }

    if (sourceKind === "method") {
      const parameters = Array.isArray(
        member.parameters
      ) ? member.parameters : [];
      const generics = Array.isArray(
        member.genericParameters
      ) ? member.genericParameters : [];
      if (
        member.isObsolete === true ||
        !member.name ||
        member.isPublic === false ||
        (
          member.isStatic === true &&
          member.isAbstract === true
        ) ||
        (
          member.isGenericMethodDefinition === true
        ) !== (generics.length > 0) ||
        !catalogStreamSupportedParameters(
          parameters
        ) ||
        !catalogStreamSafeType(
          member.returnType || "System.Void"
        )
      ) {
        return [];
      }
      const direct = catalogStreamDirectMethod(
        owner,
        member,
        parameters
      );
      const operatorId =
        catalogStreamCanonicalMemberId(
          "api.method.",
          {
            kind: "method",
            owner,
            memberName: member.name,
            parameters,
            returnType:
              member.returnType ||
              "System.Void",
            isStatic:
              member.isStatic === true,
            genericArity: generics.length
          }
        );
      return [catalogStreamDefinition(
        operatorId,
        owner,
        locator,
        {
          title:
            `${member.isStatic === true ? "Static" : "Call"} · ${displayOwner}.${member.name}`,
          group:
            noisy || !direct
              ? CATALOG_STREAM_GROUPS.advanced
              : CATALOG_STREAM_GROUPS.methods,
          symbol: "ƒ",
          kind: "method",
          searchText:
            `${owner} ${member.name} ${member.signature || ""}`,
          description:
            member.signature ||
            `${owner}.${member.name}`
        }
      )];
    }

    if (sourceKind === "property") {
      if (
        member.isObsolete === true ||
        !member.name ||
        member.isPublic === false ||
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(
          String(member.name)
        ) ||
        !catalogStreamSafeType(
          member.type || "System.Object"
        )
      ) {
        return [];
      }
      const indexes = Array.isArray(
        member.indexParameters
      ) ? member.indexParameters : [];
      if (
        !catalogStreamSupportedParameters(
          indexes
        ) ||
        (
          indexes.length > 0 &&
          member.name !== "Item" &&
          member.isIndexer !== true
        )
      ) {
        return [];
      }
      const results = [];
      const valueType =
        member.type || "System.Object";
      if (
        member.canRead === true &&
        member.getterIsPublic !== false
      ) {
        const operatorId =
          catalogStreamCanonicalMemberId(
            "api.property.get.",
            {
              kind: "property-get",
              owner,
              memberName: member.name,
              parameters: indexes,
              returnType: valueType,
              isStatic:
                member.isStatic === true
            }
          );
        results.push(catalogStreamDefinition(
          operatorId,
          owner,
          locator,
          {
            title:
              `Get · ${displayOwner}.${member.name}`,
            group: group(
              CATALOG_STREAM_GROUPS.properties
            ),
            symbol: "get",
            kind: "property-get",
            searchText:
              `${owner} ${member.name} property get read ${valueType}`,
            description:
              `Reads ${owner}.${member.name} (${valueType}).`
          }
        ));
      }
      if (
        member.canWrite === true &&
        member.setterIsPublic !== false
      ) {
        const parameters = [
          ...indexes,
          {
            position: indexes.length,
            type: valueType
          }
        ];
        const operatorId =
          catalogStreamCanonicalMemberId(
            "api.property.set.",
            {
              kind: "property-set",
              owner,
              memberName: member.name,
              parameters,
              isStatic:
                member.isStatic === true
            }
          );
        results.push(catalogStreamDefinition(
          operatorId,
          owner,
          locator,
          {
            title:
              `Set · ${displayOwner}.${member.name}`,
            group: group(
              CATALOG_STREAM_GROUPS.properties
            ),
            symbol: "set",
            kind: "property-set",
            searchText:
              `${owner} ${member.name} property set write ${valueType}`,
            description:
              `Writes ${owner}.${member.name} (${valueType}).`
          }
        ));
      }
      return results;
    }

    if (sourceKind === "field") {
      if (
        member.isObsolete === true ||
        !member.name ||
        member.isPublic === false ||
        !/^[A-Za-z_][A-Za-z0-9_]*$/.test(
          String(member.name)
        ) ||
        !catalogStreamSafeType(
          member.type || "System.Object"
        )
      ) {
        return [];
      }
      const valueType =
        member.type || "System.Object";
      const results = [];
      const getId =
        catalogStreamCanonicalMemberId(
          "api.field.get.",
          {
            kind: "field-get",
            owner,
            memberName: member.name,
            returnType: valueType,
            isStatic:
              member.isStatic === true
          }
        );
      results.push(catalogStreamDefinition(
        getId,
        owner,
        locator,
        {
          title:
            `Read · ${displayOwner}.${member.name}`,
          group: group(
            CATALOG_STREAM_GROUPS.fields
          ),
          symbol: "fld",
          kind: "field-get",
          searchText:
            `${owner} ${member.name} field read get ${valueType}`,
          description:
            `Reads field ${owner}.${member.name} (${valueType}).`
        }
      ));
      if (
        member.isReadOnly !== true &&
        member.isConst !== true
      ) {
        const setId =
          catalogStreamCanonicalMemberId(
            "api.field.set.",
            {
              kind: "field-set",
              owner,
              memberName: member.name,
              parameters: [{
                position: 0,
                type: valueType
              }],
              isStatic:
                member.isStatic === true
            }
          );
        results.push(catalogStreamDefinition(
          setId,
          owner,
          locator,
          {
            title:
              `Write · ${displayOwner}.${member.name}`,
            group: group(
              CATALOG_STREAM_GROUPS.fields
            ),
            symbol: "fld=",
            kind: "field-set",
            searchText:
              `${owner} ${member.name} field write set ${valueType}`,
            description:
              `Writes field ${owner}.${member.name} (${valueType}).`
          }
        ));
      }
      return results;
    }

    if (sourceKind === "event") {
      if (
        member.isObsolete === true ||
        !member.name
      ) {
        return [];
      }
      const handler =
        member.handlerType ||
        "System.Delegate";
      const operatorId =
        `api.event.${stableCatalogHash(
          `${owner}|${member.name}|${String(member.handlerType)}`
        )}`;
      return [catalogStreamDefinition(
        operatorId,
        owner,
        locator,
        {
          title:
            `On · ${displayOwner}.${member.name}`,
          group: group(
            CATALOG_STREAM_GROUPS.events
          ),
          symbol: "evt",
          kind: "event",
          searchText:
            `${owner} ${member.name} event ${member.handlerType || ""}`,
          description:
            `Typed catalog event wrapper for ${owner}.${member.name} (${handler}).`,
          customCSharp: false
        }
      )];
    }
    return [];
  }

  function catalogStreamOperatorHashPrefix(
    operatorId
  ) {
    return stableCatalogHash(
      String(operatorId || "")
    ).slice(
      0,
      STREAM_DEMAND_OPERATOR_HASH_PREFIX_LENGTH
    );
  }

  function catalogStreamProjectionRow(
    projection
  ) {
    return [
      String(projection?.operatorId || ""),
      catalogStreamNormalizeCsType(
        projection?.owner || ""
      ),
      projection?.locator || null,
      projection?.definition || null
    ];
  }

  function catalogStreamPaletteFlags(
    definition
  ) {
    return (
      (definition?.expertOnly === true ? 1 : 0) |
      (
        definition?.customCSharpCatalogNode === true
          ? 2
          : 0
      ) |
      (
        definition?.hiddenFromPalette === true
          ? 4
          : 0
      )
    );
  }

  function retainCatalogStreamHydrationOwner(
    owner,
    pinned,
    pinnedOwners,
    ephemeralOwners
  ) {
    const targetOwners = pinned
      ? pinnedOwners
      : ephemeralOwners;
    if (
      !pinned &&
      !targetOwners.has(owner) &&
      targetOwners.size >=
        STREAM_DEMAND_EPHEMERAL_OWNER_CAP
    ) {
      return false;
    }
    targetOwners.add(owner);
    return true;
  }

  function catalogStreamOwnerCounts(value) {
    const names = [
      "interfaces",
      "categories",
      "attributes",
      "constructors",
      "methods",
      "properties",
      "fields",
      "events",
      "enumValues"
    ];
    const counts = {};
    for (const name of names) {
      const count = Number(value?.[name]);
      if (
        !Number.isInteger(count) ||
        count < 0 ||
        count >
          CACHE_CHUNK_MAX_CONTAINER_ENTRIES
      ) {
        throw new Error(
          `The streamed type count '${name}' is invalid.`
        );
      }
      counts[name] = count;
    }
    return counts;
  }

  function catalogStreamEnumCounts(value) {
    const count = Number(value?.values);
    if (
      !Number.isInteger(count) ||
      count < 0 ||
      count >
        CACHE_CHUNK_MAX_CONTAINER_ENTRIES
    ) {
      throw new Error(
        "The streamed enum value count is invalid."
      );
    }
    return { values: count };
  }

  function catalogStreamCompactRawRecord(record) {
    const kind = String(record?.record || "");
    if (![
      "catalog-list-item",
      "assembly",
      "slot-attach-overload",
      "type-header",
      "type-list-item",
      "member",
      "enum-header",
      "enum-value"
    ].includes(kind)) {
      throw new Error(
        `Unsupported streamed catalog record '${kind}'.`
      );
    }
    return [
      kind,
      String(record.list || ""),
      String(record.memberKind || ""),
      Number(record.index),
      record.counts || null,
      record.value
    ];
  }

  function catalogStreamBinaryPayloadAvailable() {
    return Boolean(
      typeof globalThis.TextEncoder === "function" &&
      typeof globalThis.TextDecoder === "function" &&
      typeof globalThis.crypto?.subtle?.digest ===
        "function"
    );
  }

  function catalogStreamDecompressionAvailable() {
    return Boolean(
      catalogStreamBinaryPayloadAvailable() &&
      typeof globalThis.Blob === "function" &&
      typeof globalThis.DecompressionStream ===
        "function"
    );
  }

  function catalogStreamCompressionAvailable() {
    return Boolean(
      catalogStreamDecompressionAvailable() &&
      typeof globalThis.CompressionStream ===
        "function"
    );
  }

  function assertCatalogStreamOwnerPayloadBounds(
    logical
  ) {
    if (
      !Array.isArray(logical) ||
      logical.length !== 2 ||
      !Array.isArray(logical[0]) ||
      !Array.isArray(logical[1]) ||
      logical[0].length + logical[1].length < 1 ||
      logical[0].length + logical[1].length >
        STREAM_DEMAND_OWNER_CHUNK_RECORDS
    ) {
      throw new Error(
        "A streamed owner chunk has an invalid logical payload bound."
      );
    }
    for (const row of logical[0]) {
      assertCatalogStreamJsonBounds(row);
    }
    for (const row of logical[1]) {
      assertCatalogStreamJsonBounds(row);
    }
  }

  function catalogStreamPayloadBytes(value) {
    if (value instanceof Uint8Array) {
      return new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength
      );
    }
    if (ArrayBuffer.isView(value)) {
      return new Uint8Array(
        value.buffer,
        value.byteOffset,
        value.byteLength
      );
    }
    if (
      value instanceof ArrayBuffer ||
      Object.prototype.toString.call(value) ===
        "[object ArrayBuffer]"
    ) {
      return new Uint8Array(value);
    }
    return null;
  }

  async function catalogStreamCollectTransform(
    input,
    Transform,
    maximumBytes,
    operation
  ) {
    const reader = new globalThis.Blob([input])
      .stream()
      .pipeThrough(new Transform("gzip"))
      .getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        const bytes =
          catalogStreamPayloadBytes(next.value);
        if (!bytes) {
          throw new Error(
            `The streamed catalog ${operation} returned a non-binary chunk.`
          );
        }
        total += bytes.byteLength;
        if (total > maximumBytes) {
          throw new Error(
            `The streamed catalog ${operation} exceeded its bounded payload size.`
          );
        }
        chunks.push(new Uint8Array(bytes));
      }
    } catch (error) {
      try {
        await reader.cancel(error);
      } catch {}
      throw error;
    } finally {
      try {
        reader.releaseLock();
      } catch {}
    }
    const output = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      output.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return output;
  }

  let catalogStreamCompressionProbePromise = null;

  function resetCatalogStreamCompressionProbe() {
    catalogStreamCompressionProbePromise = null;
  }

  async function catalogStreamCompressionVerified() {
    if (!catalogStreamCompressionAvailable()) {
      return false;
    }
    if (!catalogStreamCompressionProbePromise) {
      catalogStreamCompressionProbePromise =
        (async () => {
          const source = Uint8Array.of(
            0x52,
            0x4d,
            0x4c,
            0x01
          );
          try {
            const compressed =
              await catalogStreamCollectTransform(
                source,
                globalThis.CompressionStream,
                1024,
                "codec probe compression"
              );
            const restored =
              await catalogStreamCollectTransform(
                compressed,
                globalThis.DecompressionStream,
                source.byteLength,
                "codec probe decompression"
              );
            return Boolean(
              restored.byteLength ===
                source.byteLength &&
              restored.every(
                (value, index) =>
                  value === source[index]
              )
            );
          } catch (error) {
            console.info(
              "[RML CATALOG CACHE] Gzip shard storage is unavailable; this generation will use the bounded identity-binary payload fallback.",
              String(error?.message || error || "")
            );
            return false;
          }
        })();
    }
    return catalogStreamCompressionProbePromise;
  }

  async function catalogStreamSelectedOwnerPayloadEncoding() {
    if (!catalogStreamBinaryPayloadAvailable()) {
      return "legacy-object-v1";
    }
    return await catalogStreamCompressionVerified()
      ? STREAM_DEMAND_OWNER_STORAGE_ENCODING
      : STREAM_DEMAND_OWNER_IDENTITY_ENCODING;
  }

  async function catalogStreamPayloadHash(bytes) {
    const subtle = globalThis.crypto?.subtle;
    if (
      !subtle ||
      typeof subtle.digest !== "function"
    ) {
      throw new Error(
        "The browser cannot integrity-check binary catalog shards."
      );
    }
    return catalogDigestHex(
      await subtle.digest("SHA-256", bytes)
    );
  }

  async function prepareCatalogStreamCacheEntryForStorage(
    entry,
    metrics = null
  ) {
    const value = entry?.value;
    if (
      value?.kind !== "owner-chunk" ||
      value.payloadEncoding
    ) {
      return entry;
    }
    const storageEncoding =
      await catalogStreamSelectedOwnerPayloadEncoding();
    if (storageEncoding === "legacy-object-v1") {
      return entry;
    }
    if (
      !Array.isArray(value.rows) ||
      !Array.isArray(value.operatorRows)
    ) {
      throw new Error(
        "A streamed owner chunk cannot be encoded because its logical payload is invalid."
      );
    }
    const logical = [
      value.rows,
      value.operatorRows
    ];
    if (metrics) {
      metrics.ownerPayloadCount =
        (Number(metrics.ownerPayloadCount) || 0) + 1;
    }
    assertCatalogStreamOwnerPayloadBounds(logical);
    const encoded = new TextEncoder().encode(
      JSON.stringify(logical)
    );
    if (
      encoded.byteLength < 1 ||
      encoded.byteLength >
        STREAM_DEMAND_OWNER_PAYLOAD_MAX_BYTES
    ) {
      throw new Error(
        "A streamed owner chunk exceeds its bounded binary input."
      );
    }
    const useGzip =
      storageEncoding ===
        STREAM_DEMAND_OWNER_STORAGE_ENCODING &&
      encoded.byteLength >=
        STREAM_DEMAND_OWNER_GZIP_MIN_BYTES;
    let storedBytes = encoded;
    if (useGzip) {
      const compressionStarted =
        catalogDemandDiagnosticTime();
      storedBytes =
        await catalogStreamCollectTransform(
          encoded,
          globalThis.CompressionStream,
          STREAM_DEMAND_OWNER_COMPRESSED_MAX_BYTES,
          "compression"
        );
      if (metrics) {
        metrics.gzipPayloadCount =
          (Number(metrics.gzipPayloadCount) || 0) + 1;
        metrics.compressionMs =
          (Number(metrics.compressionMs) || 0) +
          (
            catalogDemandDiagnosticTime() -
            compressionStarted
          );
      }
    } else if (metrics) {
      metrics.identityPayloadCount =
        (Number(metrics.identityPayloadCount) || 0) + 1;
    }
    const hashStarted =
      catalogDemandDiagnosticTime();
    const payloadHash =
      await catalogStreamPayloadHash(encoded);
    if (metrics) {
      metrics.hashCount =
        (Number(metrics.hashCount) || 0) + 1;
      metrics.hashMs =
        (Number(metrics.hashMs) || 0) +
        (
          catalogDemandDiagnosticTime() -
          hashStarted
        );
    }
    const payload =
      storedBytes.byteOffset === 0 &&
      storedBytes.byteLength ===
        storedBytes.buffer.byteLength
        ? storedBytes.buffer
        : storedBytes.buffer.slice(
            storedBytes.byteOffset,
            storedBytes.byteOffset +
              storedBytes.byteLength
          );
    const stored = { ...value };
    delete stored.rows;
    delete stored.operatorRows;
    return {
      ...entry,
      value: {
        ...stored,
        payloadEncoding:
          useGzip
            ? STREAM_DEMAND_OWNER_PAYLOAD_ENCODING
            : STREAM_DEMAND_OWNER_IDENTITY_ENCODING,
        payloadVersion:
          STREAM_DEMAND_OWNER_PAYLOAD_VERSION,
        payloadHashAlgorithm:
          STREAM_DEMAND_OWNER_PAYLOAD_HASH_ALGORITHM,
        payloadHash,
        payloadUncompressedBytes:
          encoded.byteLength,
        payloadByteLength:
          storedBytes.byteLength,
        payloadRowCount: value.rows.length,
        payloadOperatorRowCount:
          value.operatorRows.length,
        payload
      }
    };
  }

  async function decodeCatalogStreamOwnerChunk(record) {
    if (!record?.payloadEncoding) {
      return record;
    }
    const storedBytes =
      catalogStreamPayloadBytes(record.payload);
    const uncompressedBytes = Number(
      record.payloadUncompressedBytes
    );
    if (
      record.kind !== "owner-chunk" ||
      ![
        STREAM_DEMAND_OWNER_PAYLOAD_ENCODING,
        STREAM_DEMAND_OWNER_IDENTITY_ENCODING
      ].includes(record.payloadEncoding) ||
      Number(record.payloadVersion) !==
        STREAM_DEMAND_OWNER_PAYLOAD_VERSION ||
      record.payloadHashAlgorithm !==
        STREAM_DEMAND_OWNER_PAYLOAD_HASH_ALGORITHM ||
      !/^[a-f0-9]{64}$/.test(
        String(record.payloadHash || "")
      ) ||
      !Number.isInteger(uncompressedBytes) ||
      uncompressedBytes < 1 ||
      uncompressedBytes >
        STREAM_DEMAND_OWNER_PAYLOAD_MAX_BYTES ||
      !storedBytes ||
      storedBytes.byteLength < 1 ||
      storedBytes.byteLength !==
        Number(record.payloadByteLength) ||
      storedBytes.byteLength >
        STREAM_DEMAND_OWNER_COMPRESSED_MAX_BYTES ||
      (
        record.payloadEncoding ===
          STREAM_DEMAND_OWNER_IDENTITY_ENCODING &&
        storedBytes.byteLength !== uncompressedBytes
      ) ||
      !Number.isInteger(Number(record.payloadRowCount)) ||
      !Number.isInteger(
        Number(record.payloadOperatorRowCount)
      )
    ) {
      throw new Error(
        "A binary streamed owner chunk has invalid metadata."
      );
    }
    if (!catalogStreamBinaryPayloadAvailable()) {
      throw new Error(
        "The browser cannot decode the active catalog cache."
      );
    }
    if (
      record.payloadEncoding ===
        STREAM_DEMAND_OWNER_PAYLOAD_ENCODING &&
      !catalogStreamDecompressionAvailable()
    ) {
      throw new Error(
        "The browser cannot decompress the active catalog cache."
      );
    }
    const decoded = record.payloadEncoding ===
      STREAM_DEMAND_OWNER_PAYLOAD_ENCODING
        ? await catalogStreamCollectTransform(
            storedBytes,
            globalThis.DecompressionStream,
            uncompressedBytes,
            "decompression"
          )
        : storedBytes;
    if (
      decoded.byteLength !== uncompressedBytes ||
      await catalogStreamPayloadHash(decoded) !==
        String(record.payloadHash)
    ) {
      throw new Error(
        "A binary streamed owner chunk failed its integrity check."
      );
    }
    let logical;
    try {
      logical = JSON.parse(
        new TextDecoder(
          "utf-8",
          { fatal: true }
        ).decode(decoded)
      );
    } catch (error) {
      throw new Error(
        "A binary streamed owner chunk contains invalid JSON.",
        { cause: error }
      );
    }
    assertCatalogStreamOwnerPayloadBounds(logical);
    if (
      logical[0].length !==
        Number(record.payloadRowCount) ||
      logical[1].length !==
        Number(record.payloadOperatorRowCount)
    ) {
      throw new Error(
        "A binary streamed owner chunk has an invalid logical payload."
      );
    }
    const { payload: ignoredPayload, ...metadata } =
      record;
    return {
      ...metadata,
      rows: logical[0],
      operatorRows: logical[1]
    };
  }

  function catalogStreamRawChunkEntry(
    generation,
    {
      owner = "",
      section = "root",
      segment = 0,
      rows = [],
      operatorRows = [],
      operatorStageKeys = [],
      byteLength = 0,
      final = false
    } = {}
  ) {
    const normalizedOwner =
      catalogStreamNormalizeCsType(owner);
    const ownerChunk = Boolean(normalizedOwner);
    return {
      value: {
        id: catalogStreamDemandRecordKey(
          generation,
          ownerChunk
            ? "owner-chunk"
            : "root-chunk",
          ...(ownerChunk
            ? [normalizedOwner, section]
            : []),
          catalogStreamDemandIndexPart(
            segment
          )
        ),
        schemaVersion:
          STREAM_DEMAND_CACHE_SCHEMA_VERSION,
        format: STREAM_DEMAND_CACHE_FORMAT,
        generation,
        kind: ownerChunk
          ? "owner-chunk"
          : "root-chunk",
        owner: normalizedOwner,
        section: String(section || "root"),
        segment: Number(segment),
        byteLength: Number(byteLength),
        final: final === true,
        rows,
        ...(ownerChunk
          ? {
              operatorRows,
              operatorStageKeys
            }
          : {})
      },
      add: true
    };
  }

  function catalogStreamOperatorShardEntry(
    generation,
    prefix,
    segment,
    rows,
    byteLength
  ) {
    return {
      value: {
        id: catalogStreamDemandRecordKey(
          generation,
          "operator-shard",
          prefix,
          catalogStreamDemandIndexPart(
            segment
          )
        ),
        schemaVersion:
          STREAM_DEMAND_CACHE_SCHEMA_VERSION,
        format: STREAM_DEMAND_CACHE_FORMAT,
        generation,
        kind: "operator-shard",
        prefix: String(prefix || ""),
        segment: Number(segment),
        byteLength: Number(byteLength),
        rows
      },
      add: true
    };
  }

  function catalogStreamBoundedShardBytes(
    value,
    maximum,
    rowCount = 0
  ) {
    const bytes = Number(value);
    return Boolean(
      Number.isInteger(bytes) &&
      bytes >= 0 &&
      (
        bytes <= maximum ||
        (
          rowCount === 1 &&
          bytes <=
            STREAM_DEMAND_MAX_LINE_BYTES
        )
      )
    );
  }

  function catalogStreamCacheVersionSupported(record) {
    const format = String(record?.format || "");
    const schemaVersion = Number(
      record?.schemaVersion
    );
    return Boolean(
      (
        format === STREAM_DEMAND_CACHE_FORMAT &&
        schemaVersion ===
          STREAM_DEMAND_CACHE_SCHEMA_VERSION
      ) ||
      (
        format ===
          LEGACY_STREAM_DEMAND_CACHE_FORMAT &&
        schemaVersion ===
          LEGACY_STREAM_DEMAND_CACHE_SCHEMA_VERSION &&
        !record?.payloadEncoding
      )
    );
  }

  function catalogStreamRecordMatchesManifest(
    record,
    manifest
  ) {
    return Boolean(
      catalogStreamCacheVersionSupported(record) &&
      catalogStreamCacheVersionSupported(manifest) &&
      String(record?.format || "") ===
        String(manifest?.format || "") &&
      Number(record?.schemaVersion) ===
        Number(manifest?.schemaVersion)
    );
  }

  function validCatalogStreamDemandManifest(
    manifest
  ) {
    return Boolean(
      manifest &&
      catalogStreamCacheVersionSupported(manifest) &&
      (
        manifest.format ===
          LEGACY_STREAM_DEMAND_CACHE_FORMAT
          ? (
              manifest.ownerPayloadEncoding == null ||
              manifest.ownerPayloadEncoding === ""
            )
          : (
              manifest.ownerPayloadEncoding ===
                STREAM_DEMAND_OWNER_STORAGE_ENCODING ||
              manifest.ownerPayloadEncoding ===
                STREAM_DEMAND_OWNER_IDENTITY_ENCODING ||
              manifest.ownerPayloadEncoding ===
                "legacy-object-v1"
            )
      ) &&
      /^[a-z0-9-]{12,96}$/i.test(
        String(manifest.generation || "")
      ) &&
      /^[a-f0-9]{64}$/.test(
        String(
          manifest.catalogFingerprint || ""
        ).trim().toLowerCase()
      ) &&
      /^[a-f0-9]{64}$/.test(
        String(
          manifest.assemblyFingerprint || ""
        ).trim().toLowerCase()
      ) &&
      manifest.root &&
      typeof manifest.root === "object" &&
      !Array.isArray(manifest.root) &&
      Number.isInteger(manifest.recordCount) &&
      manifest.recordCount >= 2 &&
      manifest.recordCount <=
        STREAM_DEMAND_MAX_RECORDS &&
      Number.isInteger(manifest.operatorCount) &&
      manifest.operatorCount >= 0 &&
      Number.isInteger(
        manifest.ownerChunkCount
      ) &&
      manifest.ownerChunkCount >= 0 &&
      manifest.ownerChunkCount <=
        STREAM_DEMAND_MAX_RECORDS &&
      Number.isInteger(
        manifest.rootChunkCount
      ) &&
      manifest.rootChunkCount >= 0 &&
      Number.isInteger(
        manifest.operatorShardCount
      ) &&
      manifest.operatorShardCount === 0 &&
      manifest.operatorIndexKind ===
        "owner-multientry-v1" &&
      manifest.operatorShardCount <=
        STREAM_DEMAND_MAX_RECORDS &&
      Array.isArray(
        manifest.operatorShardCounts
      ) &&
      manifest.operatorShardCounts.every(entry =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        /^[a-f0-9]+$/.test(
          String(entry[0] || "")
        ) &&
        String(entry[0]).length ===
          STREAM_DEMAND_OPERATOR_HASH_PREFIX_LENGTH &&
        Number.isInteger(entry[1]) &&
        entry[1] > 0
      ) &&
      manifest.operatorShardCounts.reduce(
        (total, entry) => total + entry[1],
        0
      ) === 0 &&
      Number.isInteger(
        manifest.paletteShardCount
      ) &&
      manifest.paletteShardCount >= 0 &&
      manifest.paletteShardCount <=
        STREAM_DEMAND_MAX_RECORDS &&
      Array.isArray(
        manifest.paletteShardCounts
      ) &&
      manifest.paletteShardCounts.every(entry =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === "string" &&
        Number.isInteger(entry[1]) &&
        entry[1] > 0
      ) &&
      manifest.paletteShardCounts.reduce(
        (total, entry) => total + entry[1],
        0
      ) === manifest.paletteShardCount &&
      Number.isInteger(
        manifest.searchShardCount
      ) &&
      manifest.searchShardCount >= 0 &&
      manifest.searchShardCount <=
        STREAM_DEMAND_MAX_RECORDS &&
      Array.isArray(manifest.groupCounts) &&
      manifest.groupCounts.every(entry =>
        Array.isArray(entry) &&
        entry.length === 2 &&
        typeof entry[0] === "string" &&
        Number.isInteger(entry[1]) &&
        entry[1] >= 0
      ) &&
      Array.isArray(
        manifest.visibilityGroupCounts
      ) &&
      manifest.visibilityGroupCounts.every(entry =>
        Array.isArray(entry) &&
        entry.length === 4 &&
        typeof entry[0] === "string" &&
        entry.slice(1).every(value =>
          Number.isInteger(value) &&
          value >= 0
        )
      )
    );
  }

  async function commitCatalogStreamDemandManifest(
    database,
    manifest,
    previousActive = null
  ) {
    const transaction = database.transaction(
      CACHE_STORE_NAME,
      "readwrite"
    );
    const store = transaction.objectStore(
      CACHE_STORE_NAME
    );
    store.add(manifest);
    store.put({
      id: STREAM_DEMAND_ACTIVE_KEY,
      schemaVersion:
        STREAM_DEMAND_CACHE_SCHEMA_VERSION,
      format: STREAM_DEMAND_CACHE_FORMAT,
      generation: manifest.generation,
      previousGeneration: String(
        previousActive?.generation || ""
      ),
      manifestId: manifest.id,
      catalogFingerprint:
        manifest.catalogFingerprint,
      assemblyFingerprint:
        manifest.assemblyFingerprint,
      committedAtUtc:
        new Date().toISOString()
    });
    store.delete(STREAM_DEMAND_STAGING_KEY);
    try {
      await waitForCatalogCacheTransaction(
        transaction,
        {
          errorMessage:
            "The streamed catalog generation could not be committed.",
          abortMessage:
            "The streamed catalog generation commit was rejected.",
          timeoutMessage:
            "The streamed catalog generation commit stopped responding."
        }
      );
    } catch (error) {
      throw catalogCachePersistenceError(
        error,
        "The streamed catalog generation could not be committed."
      );
    }
  }

  async function stageCatalogStreamDemandGeneration(
    database,
    generation
  ) {
    const transaction = database.transaction(
      CACHE_STORE_NAME,
      "readwrite"
    );
    transaction.objectStore(
      CACHE_STORE_NAME
    ).put({
      id: STREAM_DEMAND_STAGING_KEY,
      schemaVersion:
        STREAM_DEMAND_CACHE_SCHEMA_VERSION,
      format: STREAM_DEMAND_CACHE_FORMAT,
      generation: String(generation || ""),
      kind: "stream-staging",
      createdAtUtc: new Date().toISOString()
    });
    try {
      await waitForCatalogCacheTransaction(
        transaction,
        {
          errorMessage:
            "The streamed catalog staging marker could not be written.",
          abortMessage:
            "The streamed catalog staging marker was rejected.",
          timeoutMessage:
            "The streamed catalog staging marker stopped responding."
        }
      );
    } catch (error) {
      throw catalogCachePersistenceError(
        error,
        "The streamed catalog staging marker could not be persisted."
      );
    }
  }

  function catalogStreamThrowIfAborted(signal) {
    if (signal?.aborted !== true) return;
    const error = new Error(
      "The streamed catalog operation was cancelled."
    );
    error.name = "AbortError";
    throw error;
  }

  async function compactCatalogStreamOperators(
    database,
    generation,
    encoder,
    signal = null
  ) {
    const stagePrefix = `${generation}:`;
    const segmentCounts = new Map();
    let currentPrefix = "";
    let currentRows = [];
    let currentBytes = 0;
    let shardCount = 0;
    let rowCount = 0;
    let afterKey = "";
    let readBatches = 0;
    let pendingWrites = [];
    let pendingWriteBytes = 0;

    const flushWrites = async () => {
      if (pendingWrites.length === 0) return;
      const writing = pendingWrites;
      pendingWrites = [];
      pendingWriteBytes = 0;
      await storeCatalogCacheBatch(
        database,
        writing
      );
    };
    const flushCurrent = async () => {
      if (currentRows.length === 0) return;
      const segment =
        segmentCounts.get(currentPrefix) || 0;
      if (
        pendingWrites.length > 0 &&
        (
          pendingWrites.length >=
            STREAM_DEMAND_BATCH_RECORDS ||
          pendingWriteBytes + currentBytes >
            STREAM_DEMAND_COMPACTION_WRITE_BYTES
        )
      ) {
        await flushWrites();
      }
      pendingWrites.push(
        catalogStreamOperatorShardEntry(
          generation,
          currentPrefix,
          segment,
          currentRows,
          currentBytes
        )
      );
      pendingWriteBytes += currentBytes;
      segmentCounts.set(
        currentPrefix,
        segment + 1
      );
      shardCount += 1;
      currentRows = [];
      currentBytes = 0;
      if (
        pendingWriteBytes >=
          STREAM_DEMAND_COMPACTION_WRITE_BYTES
      ) {
        await flushWrites();
      }
    };

    while (true) {
      catalogStreamThrowIfAborted(signal);
      const batch =
        await readCatalogCacheIndexBatch(
          database,
          STREAM_DEMAND_OPERATOR_STAGE_INDEX,
          stagePrefix,
          afterKey,
          STREAM_DEMAND_COMPACTION_READ_RECORDS
        );
      if (batch.records.length === 0) break;
      if (!batch.lastKey || batch.lastKey === afterKey) {
        throw new Error(
          "The streamed operator compaction cursor stopped making progress."
        );
      }
      afterKey = batch.lastKey;
      for (const record of batch.records) {
        catalogStreamThrowIfAborted(signal);
        const operatorId = String(
          record?.operatorId || ""
        );
        const prefix = String(
          record?.operatorPrefix || ""
        );
        const row = record?.operatorRow;
        if (
          record?.format !==
            STREAM_DEMAND_CACHE_FORMAT ||
          Number(record?.schemaVersion) !==
            STREAM_DEMAND_CACHE_SCHEMA_VERSION ||
          String(record?.generation || "") !==
            generation ||
          record?.kind !== "palette-stage" ||
          !operatorId.startsWith("api.") ||
          prefix !==
            catalogStreamOperatorHashPrefix(
              operatorId
            ) ||
          String(record?.operatorStageKey || "") !==
            `${generation}:${prefix}:${operatorId}` ||
          !Array.isArray(row) ||
          row.length !== 4 ||
          String(row[0] || "") !== operatorId
        ) {
          throw new Error(
            "A streamed operator staging row is invalid."
          );
        }
        const rowBytes =
          encoder.encode(
            JSON.stringify(row)
          ).byteLength + 1;
        if (
          currentRows.length > 0 &&
          (
            prefix !== currentPrefix ||
            currentRows.length >=
              STREAM_DEMAND_OPERATOR_SHARD_RECORDS ||
            currentBytes + rowBytes >
              STREAM_DEMAND_OPERATOR_SHARD_BYTES
          )
        ) {
          await flushCurrent();
        }
        currentPrefix = prefix;
        currentRows.push(row);
        currentBytes += rowBytes;
        rowCount += 1;
      }
      readBatches += 1;
      if (readBatches % 8 === 0) {
        await yieldCatalogCacheWork();
      }
    }
    await flushCurrent();
    await flushWrites();
    return Object.freeze({
      shardCount,
      rowCount,
      segmentCounts: Object.freeze(
        [...segmentCounts.entries()]
      )
    });
  }

  async function reusableCatalogStreamManifest(
    expectedFingerprint
  ) {
    const expected = String(
      expectedFingerprint || ""
    ).trim().toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(expected)) {
      return null;
    }
    let database;
    try {
      database = await openCatalogCache();
      const active = await readCatalogCacheValue(
        database,
        STREAM_DEMAND_ACTIVE_KEY
      );
      if (
        !catalogStreamCacheVersionSupported(active) ||
        !active?.manifestId ||
        String(active.catalogFingerprint || "")
          .trim().toLowerCase() !== expected
      ) {
        return null;
      }
      const manifest = await readCatalogCacheValue(
        database,
        active.manifestId
      );
      if (
        !validCatalogStreamDemandManifest(manifest) ||
        !catalogStreamRecordMatchesManifest(
          active,
          manifest
        ) ||
        String(manifest.generation || "") !==
          String(active.generation || "") ||
        String(manifest.catalogFingerprint || "")
          .trim().toLowerCase() !== expected ||
        String(manifest.assemblyFingerprint || "") !==
          String(active.assemblyFingerprint || "")
      ) {
        return null;
      }
      return Object.freeze(manifest);
    } catch (error) {
      console.error(
        "[RML BUILDER INTERNAL FAILURE] The cross-tab catalog cache recheck failed; the authorized stream import will continue without reusing it.",
        error
      );
      return null;
    } finally {
      database?.close?.();
    }
  }

  function runCatalogStreamIngestWithWriteLock(
    run,
    expectedFingerprint,
    signal
  ) {
    const locks = globalThis.navigator?.locks;
    if (!locks || typeof locks.request !== "function") {
      return run();
    }
    const options = { mode: "exclusive" };
    if (signal) options.signal = signal;
    return locks.request(
      CACHE_WRITE_LOCK_NAME,
      options,
      async () => {
        catalogStreamThrowIfAborted(signal);
        const reusable =
          await reusableCatalogStreamManifest(
            expectedFingerprint
          );
        if (reusable) {
          catalogStreamDemandManifest = reusable;
          return reusable;
        }
        return run();
      }
    );
  }

  async function ingestCatalogDemandStream(
    url,
    {
      expectedFingerprint = "",
      expectedRecordCount = 0,
      sourceUrl = "",
      signal = null,
      onProgress = null
    } = {}
  ) {
    const ingestKey = String(
      expectedFingerprint || url || ""
    ).trim().toLowerCase();
    while (catalogStreamDemandIngestPromise) {
      if (
        catalogStreamDemandIngestKey ===
        ingestKey
      ) {
        return awaitCatalogSettlement(
          catalogStreamDemandIngestPromise,
          signal,
          "The existing scanner demand-stream transfer"
        );
      }
      catalogStreamDemandIngestController
        ?.abort();
      try {
        await awaitCatalogSettlement(
          catalogStreamDemandIngestPromise,
          signal,
          "The superseded scanner demand-stream transfer"
        );
      } catch {}
    }
    catalogStreamDemandIngestKey = ingestKey;
    const run = async () => {
      const generation =
        createCatalogCacheGeneration();
      const diagnosticStartedAt =
        catalogDemandDiagnosticTime();
      const diagnosticTimings = {
        requestMs: 0,
        cachePrepareMs: 0,
        codecProbeMs: 0,
        streamElapsedMs: 0,
        streamReadWaitMs: 0,
        parseProjectMs: 0,
        batchPreparationMs: 0,
        compressionMs: 0,
        hashMs: 0,
        transactionMs: 0,
        paletteFinalizeMs: 0,
        commitMs: 0,
        retiredCleanupMs: 0,
        elapsedMs: 0
      };
      const diagnosticCounts = {
        recordCount: 0,
        totalBytes: 0,
        ownerCount: 0,
        operatorCount: 0,
        ownerChunkCount: 0,
        paletteShardCount: 0,
        ownerPayloadCount: 0,
        gzipPayloadCount: 0,
        identityPayloadCount: 0,
        hashCount: 0,
        transactionCount: 0
      };
      let diagnosticPhase = "request";
      let diagnosticStatus = "running";
      let diagnosticError = "";
      const publishDiagnostics = () =>
        publishCatalogDemandDiagnostics({
          ...diagnosticCounts,
          status: diagnosticStatus,
          phase: diagnosticPhase,
          generation,
          error: diagnosticError,
          timings: {
            ...diagnosticTimings,
            batchPreparationMs:
              diagnosticCounts.batchPreparationMs ||
              diagnosticTimings.batchPreparationMs,
            compressionMs:
              diagnosticCounts.compressionMs ||
              diagnosticTimings.compressionMs,
            hashMs:
              diagnosticCounts.hashMs ||
              diagnosticTimings.hashMs,
            transactionMs:
              diagnosticCounts.transactionMs ||
              diagnosticTimings.transactionMs,
            elapsedMs:
              catalogDemandDiagnosticTime() -
              diagnosticStartedAt
          }
        });
      publishDiagnostics();
      const requestController =
        new AbortController();
      catalogStreamDemandIngestController =
        requestController;
      const abort = () =>
        requestController.abort();
      if (signal?.aborted) abort();
      else signal?.addEventListener(
        "abort",
        abort,
        { once: true }
      );
      let database;
      let reader = null;
      let generationCommitted = false;
      try {
        const response =
          await awaitCatalogSettlement(
            fetch(
              new URL(url, window.location.href).href,
              {
                cache: "no-store",
                credentials: "same-origin",
                redirect: "error",
                signal: requestController.signal,
                headers: {
                  Accept:
                    "application/x-ndjson"
                }
              }
            ),
            requestController.signal,
            "The scanner demand-stream request"
          );
        diagnosticTimings.requestMs =
          catalogDemandDiagnosticTime() -
          diagnosticStartedAt;
        diagnosticPhase = "cache-prepare";
        publishDiagnostics();
        if (!response.ok) {
          throw new Error(
            `${response.status} ${response.statusText}`
          );
        }
        if (!response.body?.getReader) {
          throw new Error(
            "The browser cannot incrementally read the scanner demand stream."
          );
        }
        const contentType = String(
          response.headers.get(
            "content-type"
          ) || ""
        ).toLowerCase();
        if (
          !contentType.includes(
            "application/x-ndjson"
          )
        ) {
          throw new Error(
            "The scanner demand endpoint did not return NDJSON."
          );
        }
        const cachePrepareStarted =
          catalogDemandDiagnosticTime();
        try {
          database = await awaitCatalogSettlement(
            openCatalogCache(),
            requestController.signal,
            "The streamed catalog cache open"
          );
          await awaitCatalogSettlement(
            reclaimObsoleteCatalogStorage(
              database
            ),
            requestController.signal,
            "The streamed catalog cache preparation"
          );
          await awaitCatalogSettlement(
            stageCatalogStreamDemandGeneration(
              database,
              generation
            ),
            requestController.signal,
            "The streamed catalog staging marker"
          );
          diagnosticTimings.cachePrepareMs =
            catalogDemandDiagnosticTime() -
            cachePrepareStarted;
        } catch (error) {
          throw catalogCachePersistenceError(
            error,
            "The streamed catalog cache could not prepare storage for a new generation."
          );
        }
        reader = response.body.getReader();
        const decoder = new TextDecoder(
          "utf-8",
          { fatal: true }
        );
        const encoder = new TextEncoder();
        const codecProbeStarted =
          catalogDemandDiagnosticTime();
        const ownerPayloadEncoding =
          await catalogStreamSelectedOwnerPayloadEncoding();
        diagnosticTimings.codecProbeMs =
          catalogDemandDiagnosticTime() -
          codecProbeStarted;
        diagnosticPhase = "stream";
        publishDiagnostics();
        let buffer = "";
        let totalBytes = 0;
        let recordCount = 0;
        const totalRecordCount = Math.max(
          0,
          Math.trunc(
            Number(expectedRecordCount) || 0
          )
        );
        let header = null;
        let headerCounts = null;
        let commitSeen = false;
        let pendingManifest = null;
        let phase = "header";
        let currentType = null;
        let currentEnum = null;
        let firstOwner = "";
        let bootstrapOwner = "";
        let operatorCount = 0;
        const groupCounts = new Map();
        const visibilityGroupCounts = new Map();
        let ownerChunk = null;
        let ownerChunkCount = 0;
        let rootChunkRows = [];
        let rootChunkBytes = 0;
        let rootChunkIndex = 0;
        let rootChunkCount = 0;
        let searchShardIndex = 0;
        let searchShardRows = [];
        let searchShardBytes = 0;
        const paletteShardBuffers = new Map();
        const paletteShardCounts = new Map();
        let paletteShardCount = 0;
        let paletteRowCount = 0;
        let paletteResidentBytes = 0;
        let lastPublishedProgress = -1;
        let lastPublishedCounters = "";
        const actual = {
          assemblies: 0,
          components: 0,
          materials: 0,
          commonMaterials: 0,
          meshes: 0,
          slotAttachOverloads: 0,
          types: 0,
          enums: 0
        };
        let batch = [];
        let batchBytes = 0;
        let flushedBatchCount = 0;

        const flush = async () => {
          if (batch.length === 0) return;
          const writing = batch;
          batch = [];
          batchBytes = 0;
          await storeCatalogCacheBatch(
            database,
            writing,
            diagnosticCounts
          );
          flushedBatchCount += 1;
        };
        const queue = (entry, bytes = 0) => {
          batch.push(entry);
          batchBytes += Math.max(
            0,
            Number(bytes) || 0
          );
        };
        const publishProgress = (
          progress,
          detail = {}
        ) => {
          const bounded = Math.max(
            0,
            Math.min(1, Number(progress) || 0)
          );
          const counters = [
            recordCount,
            totalBytes,
            flushedBatchCount,
            Number(
              diagnosticCounts.transactionCount
            ) || 0,
            ownerChunkCount,
            paletteShardCount,
            Number(detail.ownerCount) || 0
          ].join(":");
          if (
            bounded === lastPublishedProgress &&
            counters === lastPublishedCounters
          ) {
            return;
          }
          lastPublishedProgress = bounded;
          lastPublishedCounters = counters;
          diagnosticCounts.recordCount =
            recordCount;
          diagnosticCounts.totalBytes =
            totalBytes;
          diagnosticCounts.ownerCount =
            Math.max(
              0,
              Number(detail.ownerCount) || 0
            );
          if (
            recordCount === 0 ||
            bounded >= 1 ||
            recordCount % 1024 === 0
          ) {
            publishDiagnostics();
          }
          if (typeof onProgress !== "function") {
            return;
          }
          try {
            onProgress(Object.freeze({
              phase: "stream",
              progress: bounded,
              recordCount,
              totalRecordCount,
              totalBytes,
              flushedBatchCount,
              transactionCount:
                Number(
                  diagnosticCounts
                    .transactionCount
                ) || 0,
              ownerChunkCount,
              paletteShardCount,
              ...detail
            }));
          } catch (error) {
            console.error(
              "[RML BUILDER INTERNAL FAILURE] The catalog progress observer failed.",
              error
            );
          }
        };
        const flushRootChunk = final => {
          if (rootChunkRows.length === 0) {
            return;
          }
          queue(
            catalogStreamRawChunkEntry(
              generation,
              {
                section: "root",
                segment: rootChunkIndex,
                rows: rootChunkRows,
                byteLength: rootChunkBytes,
                final
              }
            ),
            rootChunkBytes
          );
          rootChunkIndex += 1;
          rootChunkCount += 1;
          rootChunkRows = [];
          rootChunkBytes = 0;
        };
        const queueRootRaw = (
          record,
          bytes
        ) => {
          const row =
            catalogStreamCompactRawRecord(
              record
            );
          const rowBytes = Math.max(
            1,
            Number(bytes) || 0
          ) + 1;
          if (
            rootChunkRows.length > 0 &&
            (
              rootChunkRows.length >=
                STREAM_DEMAND_OWNER_CHUNK_RECORDS ||
              rootChunkBytes + rowBytes >
                STREAM_DEMAND_OWNER_CHUNK_BYTES
            )
          ) {
            flushRootChunk(false);
          }
          rootChunkRows.push(row);
          rootChunkBytes += rowBytes;
        };
        const flushOwnerChunk = final => {
          if (
            !ownerChunk?.rows?.length &&
            !ownerChunk?.operatorRows?.length
          ) {
            return;
          }
          const current = ownerChunk;
          queue(
            catalogStreamRawChunkEntry(
              generation,
              {
                owner: current.owner,
                section: current.section,
                segment: current.segment,
                rows: current.rows,
                operatorRows:
                  current.operatorRows,
                operatorStageKeys:
                  current.operatorStageKeys,
                byteLength: current.byteLength,
                final
              }
            ),
            current.byteLength
          );
          ownerChunkCount += 1;
          diagnosticCounts.ownerChunkCount =
            ownerChunkCount;
          ownerChunk = final
            ? null
            : {
                owner: current.owner,
                section: current.section,
                segment: current.segment + 1,
                rows: [],
                operatorRows: [],
                operatorStageKeys: [],
                byteLength: 0
              };
        };
        const queueOwnerRaw = (
          record,
          bytes,
          section
        ) => {
          const owner =
            catalogStreamNormalizeCsType(
              record?.owner || ""
            );
          if (
            ownerChunk &&
            (
              ownerChunk.owner !== owner ||
              ownerChunk.section !== section
            )
          ) {
            flushOwnerChunk(true);
          }
          if (!ownerChunk) {
            ownerChunk = {
              owner,
              section,
              segment: 0,
              rows: [],
              operatorRows: [],
              operatorStageKeys: [],
              byteLength: 0
            };
          }
          const row =
            catalogStreamCompactRawRecord(
              record
            );
          const rowBytes = Math.max(
            1,
            Number(bytes) || 0
          ) + 1;
          if (
            (
              ownerChunk.rows.length > 0 ||
              ownerChunk.operatorRows.length > 0
            ) &&
            (
              ownerChunk.rows.length +
                ownerChunk.operatorRows.length >=
                STREAM_DEMAND_OWNER_CHUNK_RECORDS ||
              ownerChunk.byteLength + rowBytes >
                STREAM_DEMAND_OWNER_CHUNK_BYTES
            )
          ) {
            flushOwnerChunk(false);
          }
          ownerChunk.rows.push(row);
          ownerChunk.byteLength += rowBytes;
        };
        const queueOwnerProjection = projection => {
          if (!ownerChunk) {
            throw new Error(
              "A streamed operator projection has no active owner chunk."
            );
          }
          const operatorRow =
            catalogStreamProjectionRow(
              projection
            );
          const rowBytes =
            encoder.encode(
              JSON.stringify(operatorRow)
            ).byteLength + 1;
          if (
            (
              ownerChunk.rows.length > 0 ||
              ownerChunk.operatorRows.length > 0
            ) &&
            (
              ownerChunk.rows.length +
                ownerChunk.operatorRows.length >=
                STREAM_DEMAND_OWNER_CHUNK_RECORDS ||
              ownerChunk.byteLength + rowBytes >
                STREAM_DEMAND_OWNER_CHUNK_BYTES
            )
          ) {
            flushOwnerChunk(false);
          }
          const operatorId = String(
            projection?.operatorId || ""
          );
          ownerChunk.operatorRows.push(
            operatorRow
          );
          ownerChunk.operatorStageKeys.push(
            `${generation}:${operatorId}`
          );
          ownerChunk.byteLength += rowBytes;
        };
        const flushSearchShard = () => {
          if (searchShardRows.length === 0) {
            return;
          }
          queue({
            add: true,
            value: {
              id: catalogStreamDemandRecordKey(
                generation,
                "search-shard",
                catalogStreamDemandIndexPart(
                  searchShardIndex
                )
              ),
              schemaVersion:
                STREAM_DEMAND_CACHE_SCHEMA_VERSION,
              format:
                STREAM_DEMAND_CACHE_FORMAT,
              generation,
              kind: "search-shard",
              index: searchShardIndex,
              byteLength: searchShardBytes,
              rows: searchShardRows
            }
          }, searchShardBytes);
          searchShardIndex += 1;
          searchShardRows = [];
          searchShardBytes = 0;
        };
        const queueSearchRow = (
          operatorId,
          searchText,
          group,
          flags = 0
        ) => {
          const row = [
            String(operatorId || ""),
            String(searchText || "")
              .toLocaleLowerCase("en-US"),
            String(group || ""),
            Number(flags) || 0
          ];
          const bytes = encoder.encode(
            JSON.stringify(row)
          ).byteLength + 1;
          if (
            searchShardRows.length >= 128 ||
            (
              searchShardRows.length > 0 &&
              searchShardBytes + bytes >
                128 * 1024
            )
          ) {
            flushSearchShard();
          }
          searchShardRows.push(row);
          searchShardBytes += bytes;
        };
        const flushPaletteShard = group => {
          const shard = paletteShardBuffers.get(group);
          if (!shard?.rows?.length) return;
          const segment =
            paletteShardCounts.get(group) || 0;
          queue({
            add: true,
            value: {
              id: catalogStreamDemandRecordKey(
                generation,
                "palette-shard",
                group,
                catalogStreamDemandIndexPart(
                  segment
                )
              ),
              schemaVersion:
                STREAM_DEMAND_CACHE_SCHEMA_VERSION,
              format:
                STREAM_DEMAND_CACHE_FORMAT,
              generation,
              kind: "palette-shard",
              group,
              segment,
              byteLength: shard.byteLength,
              rows: shard.rows
            }
          }, shard.byteLength);
          paletteResidentBytes -=
            shard.byteLength;
          paletteShardBuffers.delete(group);
          paletteShardCounts.set(
            group,
            segment + 1
          );
          paletteShardCount += 1;
          diagnosticCounts.paletteShardCount =
            paletteShardCount;
        };
        const queuePaletteRow = projection => {
          const operatorId = String(
            projection?.operatorId || ""
          );
          const definition =
            projection?.definition || {};
          const group = String(
            definition.group || "Other"
          );
          const flags =
            catalogStreamPaletteFlags(
              definition
            );
          const row = [operatorId, flags];
          const bytes = encoder.encode(
            JSON.stringify(row)
          ).byteLength + 1;
          let shard =
            paletteShardBuffers.get(group);
          if (
            shard?.rows?.length &&
            (
              shard.rows.length >=
                STREAM_DEMAND_PALETTE_SHARD_RECORDS ||
              shard.byteLength + bytes >
                STREAM_DEMAND_PALETTE_SHARD_BYTES
            )
          ) {
            flushPaletteShard(group);
            shard = null;
          }
          if (!shard) {
            shard = {
              rows: [],
              byteLength: 0
            };
            paletteShardBuffers.set(
              group,
              shard
            );
          }
          shard.rows.push(row);
          shard.byteLength += bytes;
          paletteResidentBytes += bytes;
          paletteRowCount += 1;
        };
        const flushPaletteShards = () => {
          for (const group of
            [...paletteShardBuffers.keys()]
              .sort((left, right) =>
                left.localeCompare(right)
              )) {
            flushPaletteShard(group);
          }
        };
        const queueProjection = projection => {
          queueOwnerProjection(projection);
          queuePaletteRow(projection);
          operatorCount += 1;
          diagnosticCounts.operatorCount =
            operatorCount;
          const group =
            projection.definition.group;
          groupCounts.set(
            group,
            (groupCounts.get(group) || 0) + 1
          );
          const flags =
            catalogStreamPaletteFlags(
              projection.definition
            );
          const visible =
            visibilityGroupCounts.get(group) ||
            [0, 0, 0];
          if (catalogStreamPaletteMetadataVisible(
            projection.definition,
            { showAdvanced: false }
          )) {
            visible[0] += 1;
          }
          if (catalogStreamPaletteMetadataVisible(
            projection.definition,
            { showAdvanced: true }
          )) {
            visible[1] += 1;
          }
          if (catalogStreamPaletteMetadataVisible(
            projection.definition,
            {
              showAdvanced: true,
              context: "custom-csharp"
            }
          )) {
            visible[2] += 1;
          }
          visibilityGroupCounts.set(
            group,
            visible
          );
          queueSearchRow(
            projection.operatorId,
            `${projection.definition.title} ${projection.definition.apiSearchText}`,
            group,
            flags
          );
        };
        const requireIndex = (
          index,
          expected,
          label
        ) => {
          if (Number(index) !== expected) {
            throw new Error(
              `The streamed ${label} index is not contiguous.`
            );
          }
        };
        const rootComplete = () => {
          if (!headerCounts) return false;
          return [
            "assemblies",
            "components",
            "materials",
            "commonMaterials",
            "meshes",
            "slotAttachOverloads"
          ].every(name =>
            actual[name] ===
              headerCounts[name]
          );
        };
        const finishType = () => {
          if (!currentType) return;
          for (const [name, expected] of
            Object.entries(
              currentType.counts
            )) {
            if (
              currentType.seen[name] !==
                expected
            ) {
              throw new Error(
                `The streamed type '${currentType.owner}' ended before '${name}' was complete.`
              );
            }
          }
          flushOwnerChunk(true);
          currentType = null;
        };
        const finishEnum = () => {
          if (!currentEnum) return;
          if (
            currentEnum.seen.values !==
              currentEnum.counts.values
          ) {
            throw new Error(
              `The streamed enum '${currentEnum.owner}' ended before its values were complete.`
            );
          }
          flushOwnerChunk(true);
          currentEnum = null;
        };

        const processRecord = async (
          record,
          lineBytes
        ) => {
          recordCount += 1;
          diagnosticCounts.recordCount =
            recordCount;
          if (
            recordCount >
              STREAM_DEMAND_MAX_RECORDS
          ) {
            throw new Error(
              "The scanner demand stream exceeded its record bound."
            );
          }
          const kind = String(
            record?.record || ""
          );
          if (commitSeen) {
            throw new Error(
              "The scanner demand stream contains data after its commit record."
            );
          }
          if (phase === "header") {
            if (
              recordCount !== 1 ||
              kind !== "header" ||
              record.protocol !==
                STREAM_DEMAND_PROTOCOL ||
              Number(record.protocolVersion) !==
                STREAM_DEMAND_PROTOCOL_VERSION
            ) {
              throw new Error(
                "The scanner demand stream has no valid first header record."
              );
            }
            const contract =
              scannerFingerprintContract(record);
            const assemblyFingerprint = String(
              record.assemblyFingerprint || ""
            ).trim().toLowerCase();
            if (
              !contract ||
              contract.readerCompatible !== true ||
              contract.reloadSafetyCompatible !== true ||
              !/^[a-f0-9]{64}$/.test(
                assemblyFingerprint
              ) ||
              (
                expectedFingerprint &&
                contract.fingerprint !==
                  String(expectedFingerprint)
                    .trim().toLowerCase()
              )
            ) {
              throw new Error(
                "The scanner demand header fingerprint contract is incompatible."
              );
            }
            header = record;
            headerCounts =
              catalogStreamDemandCounts(
                record.counts
              );
            publishProgress(0, {
              ownerCount: 0,
              totalOwnerCount:
                headerCounts.types +
                headerCounts.enums
            });
            phase = "root";
            return;
          }

          if (kind === "catalog-list-item") {
            if (phase !== "root") {
              throw new Error(
                "A root catalog list item appeared after type streaming started."
              );
            }
            const list = String(
              record.list || ""
            );
            if (![
              "components",
              "materials",
              "commonMaterials",
              "meshes"
            ].includes(list)) {
              throw new Error(
                `Unknown streamed root list '${list}'.`
              );
            }
            requireIndex(
              record.index,
              actual[list],
              list
            );
            actual[list] += 1;
            queueRootRaw(record, lineBytes);
          } else if (kind === "assembly") {
            if (phase !== "root") {
              throw new Error(
                "An assembly appeared after type streaming started."
              );
            }
            requireIndex(
              record.index,
              actual.assemblies,
              "assembly"
            );
            actual.assemblies += 1;
            queueRootRaw(record, lineBytes);
            const assemblyName = String(
              record.value?.name || ""
            ).trim();
            if (assemblyName) {
              queue({
                add: false,
                value: {
                  id: catalogStreamDemandRecordKey(
                    generation,
                    "assembly-name",
                    assemblyName
                  ),
                  schemaVersion:
                    STREAM_DEMAND_CACHE_SCHEMA_VERSION,
                  format:
                    STREAM_DEMAND_CACHE_FORMAT,
                  generation,
                  kind: "assembly-name",
                  value: record.value
                }
              }, 256);
            }
          } else if (
            kind === "slot-attach-overload"
          ) {
            if (phase !== "root") {
              throw new Error(
                "A slot overload appeared after type streaming started."
              );
            }
            requireIndex(
              record.index,
              actual.slotAttachOverloads,
              "slot overload"
            );
            actual.slotAttachOverloads += 1;
            queueRootRaw(record, lineBytes);
          } else if (kind === "type-header") {
            if (!rootComplete()) {
              throw new Error(
                "Type streaming started before the root records were complete."
              );
            }
            if (phase === "enum") {
              throw new Error(
                "A type appeared after enum streaming started."
              );
            }
            finishType();
            phase = "type";
            requireIndex(
              record.index,
              actual.types,
              "type"
            );
            const owner =
              catalogStreamNormalizeCsType(
                record.owner
              );
            if (
              !owner ||
              owner !==
                catalogStreamNormalizeCsType(
                  record.value?.fullName
                )
            ) {
              throw new Error(
                "A streamed type header has a mismatched owner."
              );
            }
            const counts =
              catalogStreamOwnerCounts(
                record.counts
              );
            currentType = {
              owner,
              row: record.value,
              counts,
              seen: Object.fromEntries(
                Object.keys(counts).map(
                  name => [name, 0]
                )
              )
            };
            actual.types += 1;
            publishProgress(
              totalRecordCount > 0
                ? recordCount /
                  totalRecordCount
                : (
                    actual.types +
                    actual.enums
                  ) /
                    Math.max(
                      1,
                      headerCounts.types +
                        headerCounts.enums
                    ),
              {
                ownerCount:
                  actual.types +
                  actual.enums,
                totalOwnerCount:
                  headerCounts.types +
                  headerCounts.enums
              }
            );
            if (!firstOwner) firstOwner = owner;
            if (owner === "System.Object") {
              bootstrapOwner = owner;
            }
            flushRootChunk(true);
            queueOwnerRaw(
              { ...record, owner },
              lineBytes,
              "type"
            );
            for (const projection of
              catalogStreamProjectType(
                { ...record, owner }
              )) {
              queueProjection(projection);
            }
          } else if (
            kind === "type-list-item" ||
            kind === "member"
          ) {
            if (
              phase !== "type" ||
              !currentType
            ) {
              throw new Error(
                "A streamed type child has no active type header."
              );
            }
            const owner =
              catalogStreamNormalizeCsType(
                record.owner
              );
            if (owner !== currentType.owner) {
              throw new Error(
                "A streamed type child changed owner without a new header."
              );
            }
            const name = kind ===
              "type-list-item"
              ? String(record.list || "")
              : ({
                  constructor: "constructors",
                  method: "methods",
                  property: "properties",
                  field: "fields",
                  event: "events"
                })[String(
                  record.memberKind || ""
                )];
            if (
              !name ||
              !Object.hasOwn(
                currentType.counts,
                name
              )
            ) {
              throw new Error(
                "A streamed type child has an unknown list kind."
              );
            }
            requireIndex(
              record.index,
              currentType.seen[name],
              `type ${name}`
            );
            currentType.seen[name] += 1;
            const normalized = {
              ...record,
              owner
            };
            queueOwnerRaw(
              normalized,
              lineBytes,
              "type"
            );
            if (kind === "member") {
              for (const projection of
                catalogStreamProjectMember(
                  normalized,
                  currentType.row
                )) {
                queueProjection(projection);
              }
            }
          } else if (kind === "enum-header") {
            if (!rootComplete()) {
              throw new Error(
                "Enum streaming started before the root records were complete."
              );
            }
            finishType();
            finishEnum();
            phase = "enum";
            requireIndex(
              record.index,
              actual.enums,
              "enum"
            );
            const owner =
              catalogStreamNormalizeCsType(
                record.owner
              );
            if (
              !owner ||
              owner !==
                catalogStreamNormalizeCsType(
                  record.value?.fullName
                )
            ) {
              throw new Error(
                "A streamed enum header has a mismatched owner."
              );
            }
            const counts =
              catalogStreamEnumCounts(
                record.counts
              );
            currentEnum = {
              owner,
              counts,
              seen: { values: 0 }
            };
            actual.enums += 1;
            publishProgress(
              totalRecordCount > 0
                ? recordCount /
                  totalRecordCount
                : (
                    actual.types +
                    actual.enums
                  ) /
                    Math.max(
                      1,
                      headerCounts.types +
                        headerCounts.enums
                    ),
              {
                ownerCount:
                  actual.types +
                  actual.enums,
                totalOwnerCount:
                  headerCounts.types +
                  headerCounts.enums
              }
            );
            queueOwnerRaw(
              { ...record, owner },
              lineBytes,
              "enum"
            );
            for (const projection of
              catalogStreamProjectEnum(
                { ...record, owner }
              )) {
              queueProjection(projection);
            }
          } else if (kind === "enum-value") {
            if (
              phase !== "enum" ||
              !currentEnum
            ) {
              throw new Error(
                "A streamed enum value has no active enum header."
              );
            }
            const owner =
              catalogStreamNormalizeCsType(
                record.owner
              );
            if (owner !== currentEnum.owner) {
              throw new Error(
                "A streamed enum value changed owner without a new header."
              );
            }
            requireIndex(
              record.index,
              currentEnum.seen.values,
              "enum value"
            );
            currentEnum.seen.values += 1;
            queueOwnerRaw(
              { ...record, owner },
              lineBytes,
              "enum"
            );
            const enumOperatorId =
              `api.enum.${stableCatalogHash(owner)}`;
            queueSearchRow(
              enumOperatorId,
              `${owner} ${record.value?.name || ""}`,
              owner === "HarmonyLib" ||
              owner.startsWith("HarmonyLib.")
                ? CATALOG_STREAM_GROUPS.advanced
                : CATALOG_STREAM_GROUPS.types,
              (
                owner === "HarmonyLib" ||
                owner.startsWith("HarmonyLib.")
                  ? 1
                  : 0
              ) | 2
            );
          } else if (kind === "commit") {
            finishType();
            finishEnum();
            if (
              !rootComplete() ||
              actual.types !==
                headerCounts.types ||
              actual.enums !==
                headerCounts.enums ||
              record.protocol !==
                STREAM_DEMAND_PROTOCOL ||
              Number(record.protocolVersion) !==
                STREAM_DEMAND_PROTOCOL_VERSION ||
              record.complete !== true ||
              Number(record.recordCount) !==
                recordCount ||
              (
                totalRecordCount > 0 &&
                totalRecordCount !==
                  recordCount
              ) ||
              String(record.catalogFingerprint || "")
                .trim().toLowerCase() !==
                String(header.catalogFingerprint || "")
                  .trim().toLowerCase() ||
              String(record.assemblyFingerprint || "")
                .trim().toLowerCase() !==
                String(header.assemblyFingerprint || "")
                  .trim().toLowerCase() ||
              !catalogStreamDemandSameCounts(
                record.counts,
                headerCounts
              )
            ) {
              throw new Error(
                "The scanner demand commit does not match its streamed generation."
              );
            }
            publishProgress(1, {
              ownerCount:
                actual.types + actual.enums,
              totalOwnerCount:
                headerCounts.types +
                headerCounts.enums
            });
            flushRootChunk(true);
            flushSearchShard();
            const paletteFinalizeStarted =
              catalogDemandDiagnosticTime();
            flushPaletteShards();
            diagnosticTimings.paletteFinalizeMs +=
              catalogDemandDiagnosticTime() -
              paletteFinalizeStarted;
            await flush();
            if (
              paletteRowCount !==
                operatorCount
            ) {
              throw new Error(
                "The directly sharded streamed palette is incomplete."
              );
            }
            const root = { ...header };
            delete root.record;
            delete root.protocol;
            delete root.protocolVersion;
            delete root.counts;
            root.assemblies = [];
            root.components = [];
            root.materials = [];
            root.commonMaterials = [];
            root.meshes = [];
            root.slotAttachOverloads = [];
            root.types = [];
            root.enums = [];
            const manifest = {
              id:
                catalogStreamDemandManifestKey(
                  generation
                ),
              schemaVersion:
                STREAM_DEMAND_CACHE_SCHEMA_VERSION,
              format:
                STREAM_DEMAND_CACHE_FORMAT,
              generation,
              protocol:
                STREAM_DEMAND_PROTOCOL,
              protocolVersion:
                STREAM_DEMAND_PROTOCOL_VERSION,
              createdAtUtc:
                new Date().toISOString(),
              sourceUrl: String(
                sourceUrl || url
              ),
              demandUrl: String(url),
              catalogFingerprint: String(
                header.catalogFingerprint
              ).trim().toLowerCase(),
              assemblyFingerprint: String(
                header.assemblyFingerprint
              ).trim().toLowerCase(),
              recordCount,
              totalBytes,
              operatorCount,
              ownerChunkCount,
              rootChunkCount,
              operatorShardCount: 0,
              operatorShardCounts: [],
              operatorIndexKind:
                "owner-multientry-v1",
              ownerPayloadEncoding,
              paletteShardCount:
                paletteShardCount,
              paletteShardCounts:
                [...paletteShardCounts.entries()],
              searchShardCount:
                searchShardIndex,
              groupCounts:
                [...groupCounts.entries()]
                  .sort((left, right) =>
                    left[0].localeCompare(
                      right[0]
                    )
                  ),
              visibilityGroupCounts:
                [...visibilityGroupCounts]
                  .map(([group, counts]) => [
                    group,
                    counts[0],
                    counts[1],
                    counts[2]
                  ])
                  .sort((left, right) =>
                    left[0].localeCompare(
                      right[0]
                    )
                  ),
              counts: headerCounts,
              bootstrapOwner:
                bootstrapOwner || firstOwner,
              root
            };
            if (
              !validCatalogStreamDemandManifest(
                manifest
              )
            ) {
              throw new Error(
                "The completed streamed catalog manifest is invalid."
              );
            }
            pendingManifest = manifest;
            commitSeen = true;
            return;
          } else {
            throw new Error(
              `Unknown scanner demand record '${kind}'.`
            );
          }

          if (totalRecordCount > 0) {
            publishProgress(
              recordCount /
                totalRecordCount,
              {
                ownerCount:
                  actual.types +
                  actual.enums,
                totalOwnerCount:
                  headerCounts
                    ? headerCounts.types +
                      headerCounts.enums
                    : 0
              }
            );
          }

          const residentBytes =
            batchBytes +
            rootChunkBytes +
            (ownerChunk?.byteLength || 0) +
            searchShardBytes +
            paletteResidentBytes;
          if (
            residentBytes >=
              STREAM_DEMAND_TRANSIENT_FLUSH_BYTES
          ) {
            if (rootChunkRows.length > 0) {
              flushRootChunk(false);
            }
            if (ownerChunk?.rows?.length) {
              flushOwnerChunk(false);
            }
            flushSearchShard();
          }
          if (
            batch.length >=
              STREAM_DEMAND_INGEST_BATCH_RECORDS ||
            batchBytes >=
              STREAM_DEMAND_BATCH_BYTES ||
            residentBytes >=
              STREAM_DEMAND_TRANSIENT_FLUSH_BYTES
          ) {
            await flush();
            if (
              flushedBatchCount % 8 === 0
            ) {
              await yieldCatalogCacheWork();
            }
          }
        };

        const processLine = async line => {
          if (!line.trim()) return;
          const encoded = encoder.encode(line);
          if (
            encoded.byteLength >
              STREAM_DEMAND_MAX_LINE_BYTES
          ) {
            throw new Error(
              "A scanner demand record exceeds the per-line memory bound."
            );
          }
          let record;
          try {
            record = JSON.parse(line);
          } catch {
            throw new Error(
              "A scanner demand record contains invalid JSON."
            );
          }
          if (
            !record ||
            typeof record !== "object" ||
            Array.isArray(record)
          ) {
            throw new Error(
              "A scanner demand record is not a JSON object."
            );
          }
          assertCatalogStreamJsonBounds(record);
          await processRecord(
            record,
            encoded.byteLength
          );
          record = null;
        };

        const streamStarted =
          catalogDemandDiagnosticTime();
        while (true) {
          const readStarted =
            catalogDemandDiagnosticTime();
          const next = await awaitCatalogSettlement(
            reader.read(),
            requestController.signal,
            "The scanner demand-stream read"
          );
          diagnosticTimings.streamReadWaitMs +=
            catalogDemandDiagnosticTime() -
            readStarted;
          if (next.done) break;
          totalBytes += next.value.byteLength;
          diagnosticCounts.totalBytes =
            totalBytes;
          if (
            totalBytes >
              STREAM_DEMAND_MAX_TOTAL_BYTES
          ) {
            throw new Error(
              "The scanner demand stream exceeds the total transfer bound."
            );
          }
          buffer += decoder.decode(
            next.value,
            { stream: true }
          );
          let lineEnd;
          while (
            (lineEnd = buffer.indexOf("\n")) >= 0
          ) {
            let line = buffer.slice(0, lineEnd);
            buffer = buffer.slice(lineEnd + 1);
            if (line.endsWith("\r")) {
              line = line.slice(0, -1);
            }
            await processLine(line);
          }
          if (
            buffer.length >
              STREAM_DEMAND_MAX_LINE_BYTES
          ) {
            throw new Error(
              "A scanner demand record exceeds the line buffer bound."
            );
          }
        }
        buffer += decoder.decode();
        if (buffer.trim()) {
          await processLine(buffer);
        }
        await flush();
        diagnosticTimings.streamElapsedMs =
          catalogDemandDiagnosticTime() -
          streamStarted;
        diagnosticTimings.parseProjectMs = Math.max(
          0,
          diagnosticTimings.streamElapsedMs -
            diagnosticTimings.streamReadWaitMs -
            (Number(
              diagnosticCounts.batchPreparationMs
            ) || 0) -
            (Number(
              diagnosticCounts.transactionMs
            ) || 0)
        );
        diagnosticPhase = "finalize";
        publishDiagnostics();
        if (!commitSeen || !pendingManifest) {
          throw new Error(
            "The scanner demand stream ended without a verified commit."
          );
        }
        const commitStarted =
          catalogDemandDiagnosticTime();
        const previousActive =
          await readCatalogCacheValue(
            database,
            STREAM_DEMAND_ACTIVE_KEY
          );
        await commitCatalogStreamDemandManifest(
          database,
          pendingManifest,
          previousActive
        );
        generationCommitted = true;
        diagnosticTimings.commitMs =
          catalogDemandDiagnosticTime() -
          commitStarted;
        const retiredCleanupStarted =
          catalogDemandDiagnosticTime();
        const retiredGeneration = String(
          previousActive?.previousGeneration || ""
        );
        if (
          retiredGeneration &&
          retiredGeneration !== generation &&
          retiredGeneration !== String(
            previousActive?.generation || ""
          )
        ) {
          try {
            await deleteCatalogCachePrefixBatches(
              database,
              catalogStreamDemandGenerationPrefix(
                retiredGeneration
              )
            );
          } catch {}
        }
        diagnosticTimings.retiredCleanupMs =
          catalogDemandDiagnosticTime() -
          retiredCleanupStarted;
        catalogStreamDemandManifest =
          Object.freeze(pendingManifest);
        diagnosticCounts.recordCount =
          recordCount;
        diagnosticCounts.totalBytes =
          totalBytes;
        diagnosticCounts.ownerCount =
          actual.types + actual.enums;
        diagnosticCounts.operatorCount =
          operatorCount;
        diagnosticCounts.ownerChunkCount =
          ownerChunkCount;
        diagnosticCounts.paletteShardCount =
          paletteShardCount;
        diagnosticStatus = "complete";
        diagnosticPhase = "complete";
        return catalogStreamDemandManifest;
      } catch (error) {
        diagnosticStatus = "failed";
        diagnosticPhase = "failed";
        diagnosticError = String(
          error?.message || error || ""
        );
        throw error;
      } finally {
        if (!generationCommitted) {
          requestController.abort();
          try {
            const cancellation =
              reader?.cancel?.();
            Promise.resolve(cancellation).catch(() => {});
          } catch {}
        }
        if (database && !generationCommitted) {
          try {
            await deleteCatalogCachePrefixBatches(
              database,
              catalogStreamDemandGenerationPrefix(
                generation
              )
            );
          } catch {}
        }
        database?.close?.();
        signal?.removeEventListener(
          "abort",
          abort
        );
        diagnosticTimings.elapsedMs =
          catalogDemandDiagnosticTime() -
          diagnosticStartedAt;
        publishDiagnostics();
      }
    };
    const pending = runCatalogStreamIngestWithWriteLock(
      run,
      expectedFingerprint,
      signal
    );
    const tracked = pending.finally(() => {
      if (
        catalogStreamDemandIngestPromise ===
        tracked
      ) {
        catalogStreamDemandIngestPromise = null;
        catalogStreamDemandIngestKey = "";
        catalogStreamDemandIngestController = null;
      }
    });
    catalogStreamDemandIngestPromise = tracked;
    return tracked;
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
        let settled = false;
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
        const finish = (callback, value) => {
          if (settled) return;
          settled = true;
            callback(value);
        };
        const fail = request =>
          finish(
            reject,
            request?.error ||
            transaction.error ||
            new Error(
              window.RMLI18n.t("ui.literal.cbfab94cc829")
            )
          );
          chunkRequest.onsuccess = () => {
          finish(
            resolve,
            chunkRequest.result || null
          );
        };
        chunkRequest.onerror = () =>
          fail(chunkRequest);
        transaction.onerror = () =>
          fail(transaction);
        transaction.onabort = () =>
          fail(transaction);
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
      ) === "sha256-demand-index-v3" &&
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
      window.RMLScheduleTask(resolve);
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
        "sha256-demand-index-v3",
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
        Number(
          window.RMLApiNodeFactoryController
            ?.factoryVersion
        ) || 0,
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
      const cached = chunkCache.get(index);
      chunkCache.delete(index);
      chunkCache.set(index, cached);
      return cached;
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
    while (
      chunkCache.size >
      CATALOG_DEMAND_CHUNK_CACHE_LIMIT
    ) {
      const oldest = chunkCache.keys().next();
      if (oldest.done) break;
      chunkCache.delete(oldest.value);
    }
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

  function createCatalogStreamDemandState(
    manifest
  ) {
    return {
      streamV1: true,
      manifest,
      fullManifest: manifest,
      generation: manifest.generation,
      seedOwners: new Set(),
      pinnedOwners: new Set(),
      ephemeralOwners: new Set(),
      dependencyOwners: new Set(),
      bootstrapOwners: new Set(
        manifest.bootstrapOwner
          ? [manifest.bootstrapOwner]
          : []
      ),
      requiredOperatorIds: new Set(),
      operatorRows: new Map(),
      operatorShardCounts: new Map(
        manifest.operatorShardCounts || []
      ),
      rows: new Map(),
      assemblies: new Map(),
      chunkCache: new Map(),
      fullActive: false,
      fallbackReason: "",
      hydrationRevision: 0,
      unresolvedOperatorIds: []
    };
  }

  async function readCatalogStreamRecord(
    database,
    state,
    ...parts
  ) {
    const record = await readCatalogCacheValue(
      database,
      catalogStreamDemandRecordKey(
        state.generation,
        ...parts
      )
    );
    if (!record) return null;
    if (
      !catalogStreamRecordMatchesManifest(
        record,
        state.manifest
      ) ||
      String(record.generation || "") !==
        state.generation
    ) {
      throw new Error(
        "A streamed catalog cache record does not belong to the active generation."
      );
    }
    return record;
  }

  function catalogStreamOperatorRowsFromOwnerChunk(
    state,
    chunk
  ) {
    const rows = chunk?.rows;
    const operatorRows = chunk?.operatorRows;
    const operatorStageKeys =
      chunk?.operatorStageKeys;
    if (
      !catalogStreamRecordMatchesManifest(
        chunk,
        state.manifest
      ) ||
      String(chunk?.generation || "") !==
        state.generation ||
      chunk?.kind !== "owner-chunk" ||
      !catalogStreamNormalizeCsType(chunk.owner) ||
      !["type", "enum"].includes(
        String(chunk.section || "")
      ) ||
      !Number.isInteger(Number(chunk.segment)) ||
      Number(chunk.segment) < 0 ||
      !Array.isArray(rows) ||
      !Array.isArray(operatorRows) ||
      operatorRows.length < 1 ||
      rows.length + operatorRows.length >
        STREAM_DEMAND_OWNER_CHUNK_RECORDS ||
      !Array.isArray(operatorStageKeys) ||
      operatorStageKeys.length !==
        operatorRows.length ||
      !catalogStreamBoundedShardBytes(
        chunk.byteLength,
        STREAM_DEMAND_OWNER_CHUNK_BYTES,
        Math.max(
          1,
          rows.length + operatorRows.length
        )
      )
    ) {
      throw new Error(
        "A streamed operator owner chunk is invalid."
      );
    }
    const indexed = new Map();
    for (
      let rowIndex = 0;
      rowIndex < operatorRows.length;
      rowIndex += 1
    ) {
      const row = operatorRows[rowIndex];
      if (!Array.isArray(row) || row.length !== 4) {
        throw new Error(
          "A streamed operator owner row is invalid."
        );
      }
      const operatorId = String(row[0] || "");
      if (
        !operatorId.startsWith("api.") ||
        indexed.has(operatorId) ||
        String(operatorStageKeys[rowIndex] || "") !==
          `${state.generation}:${operatorId}` ||
        catalogStreamNormalizeCsType(row[1]) !==
          catalogStreamNormalizeCsType(chunk.owner)
      ) {
        throw new Error(
          "A streamed operator owner index is inconsistent."
        );
      }
      indexed.set(operatorId, row);
    }
    return indexed;
  }

  async function readCatalogStreamOperators(
    database,
    state,
    operatorIds,
    signal = null
  ) {
    const requested = [...new Set(
      (operatorIds || [])
        .map(value => String(value || ""))
        .filter(value =>
          value.startsWith("api.")
        )
    )];
    const found = new Map();
    for (
      let offset = 0;
      offset < requested.length;
      offset +=
        STREAM_DEMAND_OPERATOR_READ_RECORDS
    ) {
      catalogStreamThrowIfAborted(signal);
      const batch = requested.slice(
        offset,
        offset +
          STREAM_DEMAND_OPERATOR_READ_RECORDS
      );
      const keys = batch.map(operatorId =>
        `${state.generation}:${operatorId}`
      );
      const values =
        await readCatalogCacheIndexValues(
          database,
          STREAM_DEMAND_OPERATOR_OWNER_INDEX,
          keys
        );
      const grouped = new Map();
      for (let index = 0; index < batch.length; index += 1) {
        const chunk = values.get(keys[index]);
        if (!chunk) continue;
        const chunkId = String(chunk.id || "");
        if (!chunkId) {
          throw new Error(
            "A streamed operator owner chunk has no stable cache identity."
          );
        }
        if (!grouped.has(chunkId)) {
          grouped.set(chunkId, {
            chunk,
            requests: []
          });
        }
        grouped.get(chunkId).requests.push({
          wantedId: batch[index],
          key: keys[index]
        });
      }
      for (const group of grouped.values()) {
        catalogStreamThrowIfAborted(signal);
        const chunk = await decodeCatalogStreamOwnerChunk(
          group.chunk
        );
        const indexed =
          catalogStreamOperatorRowsFromOwnerChunk(
            state,
            chunk
          );
        for (const request of group.requests) {
          const selected = indexed.get(
            request.wantedId
          );
          if (
            !selected ||
            !chunk.operatorStageKeys.includes(
              request.key
            )
          ) {
            throw new Error(
              "A streamed operator index points to the wrong owner chunk."
            );
          }
          found.set(request.wantedId, {
            format: state.manifest.format,
            schemaVersion:
              state.manifest.schemaVersion,
            generation: state.generation,
            kind: "operator",
            operatorId: request.wantedId,
            owner:
              catalogStreamNormalizeCsType(
                selected[1]
              ),
            locator: selected[2],
            definition: selected[3]
          });
        }
      }
      if (
        offset > 0 &&
        offset %
          (STREAM_DEMAND_OPERATOR_READ_RECORDS * 4) ===
            0
      ) {
        await yieldCatalogCacheWork();
      }
    }
    return found;
  }
  async function readCatalogStreamAssembly(
    database,
    state,
    assemblyName
  ) {
    const name = String(
      assemblyName || ""
    ).trim();
    if (!name || state.assemblies.has(name)) {
      return;
    }
    const record =
      await readCatalogStreamRecord(
        database,
        state,
        "assembly-name",
        name
      );
    if (record?.value) {
      state.assemblies.set(
        name,
        record.value
      );
    }
  }

  function createCatalogStreamOwnerHydration(
    state,
    owner,
    locators,
    dependencyOnly,
    hydrateAllMembers = false
  ) {
    const normalizedOwner =
      catalogStreamNormalizeCsType(owner);
    const wantedMembers = new Set();
    let wantsEnum = false;
    for (const locator of locators || []) {
      if (locator?.record === "enum-header") {
        wantsEnum = true;
      }
      if (locator?.record !== "member") {
        continue;
      }
      const memberKind = String(
        locator.memberKind || ""
      );
      const index = Number(locator.index);
      if (
        memberKind &&
        Number.isInteger(index) &&
        index >= 0
      ) {
        wantedMembers.add(
          `${memberKind}:${index}`
        );
      }
    }
    return {
      state,
      owner: normalizedOwner,
      dependencyOnly: dependencyOnly === true,
      hydrateAllMembers:
        hydrateAllMembers === true,
      wantsEnum,
      wantedMembers,
      foundMembers: new Set(),
      trackers: new Map(),
      typeHeader: null,
      enumHeader: null,
      typeRow: null,
      enumValues: null,
      seenEnumValues: 0
    };
  }

  function catalogStreamOwnerHydrationTarget(
    typeRow,
    memberKind
  ) {
    return ({
      constructor: typeRow?.constructors,
      method: typeRow?.methods,
      property: typeRow?.properties,
      field: typeRow?.fields,
      event: typeRow?.events
    })[memberKind] || null;
  }

  function applyCatalogStreamOwnerChunk(
    hydration,
    chunk
  ) {
    if (
      !catalogStreamRecordMatchesManifest(
        chunk,
        hydration.state.manifest
      ) ||
      String(chunk?.generation || "") !==
        hydration.state.generation ||
      chunk?.kind !== "owner-chunk" ||
      catalogStreamNormalizeCsType(
        chunk.owner
      ) !== hydration.owner
    ) {
      throw new Error(
        "A streamed owner chunk belongs to another cache generation."
      );
    }
    const section = String(
      chunk.section || ""
    );
    if (section !== "type" && section !== "enum") {
      throw new Error(
        "A streamed owner chunk has an invalid section."
      );
    }
    const rows = chunk.rows;
    const operatorRows =
      chunk.operatorRows;
    const operatorStageKeys =
      chunk.operatorStageKeys;
    if (
      !Array.isArray(rows) ||
      !Array.isArray(operatorRows) ||
      !Array.isArray(operatorStageKeys) ||
      operatorStageKeys.length !==
        operatorRows.length ||
      rows.length + operatorRows.length < 1 ||
      rows.length + operatorRows.length >
        STREAM_DEMAND_OWNER_CHUNK_RECORDS ||
      !catalogStreamBoundedShardBytes(
        chunk.byteLength,
        STREAM_DEMAND_OWNER_CHUNK_BYTES,
        rows.length + operatorRows.length
      )
    ) {
      throw new Error(
        "A streamed owner chunk exceeds its storage bound."
      );
    }
    const indexedOperators = new Set();
    for (
      let index = 0;
      index < operatorRows.length;
      index += 1
    ) {
      const row = operatorRows[index];
      const operatorId = String(
        row?.[0] || ""
      );
      if (
        !Array.isArray(row) ||
        row.length !== 4 ||
        !operatorId.startsWith("api.") ||
        indexedOperators.has(operatorId) ||
        String(operatorStageKeys[index] || "") !==
          `${hydration.state.generation}:${operatorId}` ||
        catalogStreamNormalizeCsType(
          row[1]
        ) !== hydration.owner
      ) {
        throw new Error(
          "A streamed owner operator index is invalid."
        );
      }
      indexedOperators.add(operatorId);
    }
    const tracker =
      hydration.trackers.get(section) || {
        segment: 0,
        final: false
      };
    const segment = Number(chunk.segment);
    if (
      tracker.final ||
      !Number.isInteger(segment) ||
      segment !== tracker.segment
    ) {
      throw new Error(
        "A streamed owner chunk has a corrupt segment suffix."
      );
    }

    for (const row of rows) {
      if (
        !Array.isArray(row) ||
        row.length !== 6
      ) {
        throw new Error(
          "A streamed owner chunk row is invalid."
        );
      }
      const kind = String(row[0] || "");
      const list = String(row[1] || "");
      const memberKind = String(row[2] || "");
      const index = Number(row[3]);
      const countsValue = row[4];
      const value = row[5];

      if (kind === "type-header") {
        if (
          section !== "type" ||
          hydration.typeHeader ||
          segment !== 0
        ) {
          throw new Error(
            "A streamed type header is duplicated or misplaced."
          );
        }
        const counts =
          catalogStreamOwnerCounts(
            countsValue
          );
        hydration.typeHeader = {
          index,
          counts,
          value
        };
        hydration.typeRow = {
          ...value,
          interfaces: [],
          categories: [],
          attributes: [],
          enumValues: [],
          constructors:
            hydration.dependencyOnly
              ? []
              : new Array(counts.constructors),
          methods:
            hydration.dependencyOnly
              ? []
              : new Array(counts.methods),
          properties:
            hydration.dependencyOnly
              ? []
              : new Array(counts.properties),
          fields:
            hydration.dependencyOnly
              ? []
              : new Array(counts.fields),
          events:
            hydration.dependencyOnly
              ? []
              : new Array(counts.events)
        };
        continue;
      }
      if (kind === "enum-header") {
        if (
          section !== "enum" ||
          hydration.enumHeader ||
          segment !== 0
        ) {
          throw new Error(
            "A streamed enum header is duplicated or misplaced."
          );
        }
        const counts =
          catalogStreamEnumCounts(
            countsValue
          );
        hydration.enumHeader = {
          index,
          counts,
          value
        };
        if (
          (
            hydration.wantsEnum ||
            hydration.hydrateAllMembers
          ) &&
          !hydration.dependencyOnly
        ) {
          hydration.enumValues =
            new Array(counts.values);
        }
        continue;
      }
      if (
        kind === "type-list-item" &&
        section === "type"
      ) {
        const counts =
          hydration.typeHeader?.counts;
        if (
          !counts ||
          !Object.hasOwn(counts, list) ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= counts[list]
        ) {
          throw new Error(
            "A streamed type-list cache index is invalid."
          );
        }
        if (list === "interfaces") {
          hydration.typeRow.interfaces[index] =
            value;
        }
        continue;
      }
      if (
        kind === "member" &&
        section === "type"
      ) {
        const countName = ({
          constructor: "constructors",
          method: "methods",
          property: "properties",
          field: "fields",
          event: "events"
        })[memberKind];
        const declaredCount =
          hydration.typeHeader?.counts?.[
            countName
          ];
        const target =
          catalogStreamOwnerHydrationTarget(
            hydration.typeRow,
            memberKind
          );
        if (
          !countName ||
          !Number.isInteger(declaredCount) ||
          !Number.isInteger(index) ||
          index < 0 ||
          index >= declaredCount
        ) {
          throw new Error(
            `The streamed ${memberKind} index for '${hydration.owner}' is outside its declared range.`
          );
        }
        const token = `${memberKind}:${index}`;
        if (
          !hydration.dependencyOnly &&
          (
            hydration.hydrateAllMembers ||
            hydration.wantedMembers.has(token)
          )
        ) {
          if (!target) {
            throw new Error(
              "A streamed member target is unavailable."
            );
          }
          target[index] = value;
          hydration.foundMembers.add(token);
        }
        continue;
      }
      if (
        kind === "enum-value" &&
        section === "enum"
      ) {
        const count =
          hydration.enumHeader?.counts?.values;
        if (
          !Number.isInteger(index) ||
          index < 0 ||
          !Number.isInteger(count) ||
          index >= count
        ) {
          throw new Error(
            "A streamed enum cache index is invalid."
          );
        }
        if (hydration.enumValues) {
          if (Object.hasOwn(
            hydration.enumValues,
            index
          )) {
            throw new Error(
              "A streamed enum cache index is duplicated."
            );
          }
          hydration.enumValues[index] = value;
          hydration.seenEnumValues += 1;
        }
        continue;
      }
      throw new Error(
        "A streamed owner chunk row is in the wrong section."
      );
    }
    tracker.segment += 1;
    tracker.final = chunk.final === true;
    hydration.trackers.set(section, tracker);
  }

  function finishCatalogStreamOwnerHydration(
    hydration
  ) {
    if (
      !hydration.typeHeader &&
      !hydration.enumHeader
    ) {
      return null;
    }
    for (const tracker of
      hydration.trackers.values()) {
      if (!tracker.final) {
        throw new Error(
          `The streamed owner '${hydration.owner}' has an incomplete chunk suffix.`
        );
      }
    }
    for (const token of
      hydration.wantedMembers) {
      if (!hydration.foundMembers.has(token)) {
        throw new Error(
          `The streamed member '${token}' for '${hydration.owner}' is missing.`
        );
      }
    }
    if (
      hydration.hydrateAllMembers &&
      !hydration.dependencyOnly &&
      hydration.typeHeader
    ) {
      for (const [memberKind, countName] of
        Object.entries({
          constructor: "constructors",
          method: "methods",
          property: "properties",
          field: "fields",
          event: "events"
        })) {
        const target =
          catalogStreamOwnerHydrationTarget(
            hydration.typeRow,
            memberKind
          );
        const declaredCount = Number(
          hydration.typeHeader.counts?.[
            countName
          ] || 0
        );
        if (
          !Array.isArray(target) ||
          target.length !== declaredCount ||
          Array.from(
            { length: declaredCount },
            (_, index) => index
          ).some(index =>
            !Object.hasOwn(target, index)
          )
        ) {
          throw new Error(
            `The complete streamed ${memberKind} set for '${hydration.owner}' is incomplete.`
          );
        }
      }
    }
    let enumRow = null;
    if (
      hydration.enumValues &&
      hydration.enumHeader
    ) {
      if (
        hydration.seenEnumValues !==
          hydration.enumValues.length
      ) {
        throw new Error(
          `The streamed enum '${hydration.owner}' is incomplete.`
        );
      }
      enumRow = {
        ...hydration.enumHeader.value,
        values: hydration.enumValues
      };
    }
    return {
      owner: hydration.owner,
      typeIndex: Number(
        hydration.typeHeader?.index ?? -1
      ),
      enumIndex: Number(
        hydration.enumHeader?.index ?? -1
      ),
      typeRow: hydration.typeRow,
      enumRow
    };
  }

  async function readCatalogStreamOwner(
    database,
    state,
    owner,
    locators = [],
    {
      dependencyOnly = false,
      hydrateAllMembers = false
    } = {}
  ) {
    const normalizedOwner =
      catalogStreamNormalizeCsType(owner);
    if (!normalizedOwner) return null;
    const hydration =
      createCatalogStreamOwnerHydration(
        state,
        normalizedOwner,
        locators,
        dependencyOnly,
        hydrateAllMembers
      );
    const prefix =
      catalogStreamDemandRecordKey(
        state.generation,
        "owner-chunk",
        normalizedOwner
      ) + ":";
    const maximumChunks = Math.max(
      0,
      Number(
        state.manifest.ownerChunkCount || 0
      )
    );
    let afterKey = "";
    let chunkCount = 0;
    while (true) {
      const batch = await readCatalogCachePrefixBatch(
        database,
        prefix,
        afterKey,
        8
      );
      if (batch.records.length === 0) break;
      if (
        !batch.lastKey ||
        batch.lastKey === afterKey
      ) {
        throw new Error(
          "The streamed owner cache cursor stopped making progress."
        );
      }
      afterKey = batch.lastKey;
      for (let chunk of batch.records) {
        chunkCount += 1;
        if (chunkCount > maximumChunks) {
          throw new Error(
            "The streamed owner cache exceeded its manifest chunk bound."
          );
        }
        chunk = await decodeCatalogStreamOwnerChunk(
          chunk
        );
        applyCatalogStreamOwnerChunk(
          hydration,
          chunk
        );
      }
      if (batch.records.length < 8) break;
      await yieldCatalogCacheWork();
    }
    const entry =
      finishCatalogStreamOwnerHydration(
        hydration
      );
    if (!entry) return null;
    if (entry.typeRow?.assembly) {
      await readCatalogStreamAssembly(
        database,
        state,
        entry.typeRow.assembly
      );
    }
    state.rows.set(
      normalizedOwner,
      entry
    );
    return entry;
  }

  function collectCatalogStreamReferences(
    value,
    output = new Set(),
    visited = new WeakSet()
  ) {
    if (typeof value === "string") {
      const matches = value.match(
        /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_+]*)+/g
      ) || [];
      for (const match of matches) {
        if (
          output.size >=
            STREAM_DEMAND_DEPENDENCY_OWNER_CAP
        ) {
          break;
        }
        output.add(
          catalogStreamNormalizeCsType(match)
        );
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
    for (const child of
      Array.isArray(value)
        ? value
        : Object.values(value)) {
      collectCatalogStreamReferences(
        child,
        output,
        visited
      );
      if (
        output.size >=
          STREAM_DEMAND_DEPENDENCY_OWNER_CAP
      ) {
        break;
      }
    }
    return output;
  }

  function collectCatalogStreamDirectReferences(
    entry
  ) {
    const references = new Set();
    const remember = value => {
      const text = String(value || "");
      if (!text) return;
      const exact =
        catalogStreamNormalizeCsType(text);
      if (exact.includes(".")) {
        references.add(exact);
      }
      const matches = text.match(
        /[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_+]*)+/g
      ) || [];
      for (const match of matches) {
        references.add(
          catalogStreamNormalizeCsType(match)
        );
      }
    };
    const type = entry?.typeRow;
    remember(type?.baseType);
    for (const value of
      type?.interfaces || []) {
      remember(value);
    }
    for (const constructor of
      type?.constructors || []) {
      for (const parameter of
        constructor?.parameters || []) {
        remember(
          parameter?.elementType ||
          parameter?.type
        );
      }
    }
    for (const method of
      type?.methods || []) {
      remember(method?.returnType);
      for (const parameter of
        method?.parameters || []) {
        remember(
          parameter?.elementType ||
          parameter?.type
        );
      }
    }
    for (const property of
      type?.properties || []) {
      remember(property?.type);
      for (const parameter of
        property?.indexParameters || []) {
        remember(
          parameter?.elementType ||
          parameter?.type
        );
      }
    }
    for (const field of
      type?.fields || []) {
      remember(field?.type);
    }
    for (const event of
      type?.events || []) {
      remember(event?.handlerType);
    }
    remember(entry?.enumRow?.underlyingType);
    references.delete(entry?.owner);
    return references;
  }

  async function hydrateCatalogStreamDemandSnapshot(
    database,
    state,
    requestedOperatorIds = [],
    portableOwners = new Map(),
    {
      requestedEphemeral = false,
      hydratePortableOwners = false,
      completePortableOwners = new Set(),
      signal = null
    } = {}
  ) {
    const requirements =
      currentCatalogDemandRequirements();
    const pinnedIds = [
      ...requirements.operatorIds
    ];
    const requestedIds = [
      ...new Set(
        (Array.isArray(requestedOperatorIds)
          ? requestedOperatorIds
          : [])
          .map(value =>
            String(value || "").trim()
          )
          .filter(value =>
            value.startsWith("api.")
          )
      )
    ];
    const allIds = [
      ...new Set([
        ...pinnedIds,
        ...requestedIds
      ])
    ];
    const pinnedSet = new Set([
      ...pinnedIds,
      ...(requestedEphemeral
        ? []
        : requestedIds)
    ]);
    const ownerLocators = new Map();
    const unresolved = [];
    const acceptedIds = new Set();
    const pinnedOwners = new Set();
    const ephemeralOwners = new Set();
    const nextOperatorRows = new Map();
    const completeOwners = new Set();

    if (hydratePortableOwners === true) {
      const requestedCompleteOwners =
        completePortableOwners instanceof Set &&
        completePortableOwners.size > 0
          ? completePortableOwners
          : new Set(portableOwners.values());
      for (const rawOwner of
        requestedCompleteOwners) {
        const owner =
          catalogStreamNormalizeCsType(
            rawOwner
          );
        if (
          !owner ||
          completeOwners.has(owner) ||
          completeOwners.size >=
            STREAM_DEMAND_EPHEMERAL_OWNER_CAP
        ) {
          continue;
        }
        completeOwners.add(owner);
        ephemeralOwners.add(owner);
        ownerLocators.set(owner, []);
      }
    }

    for (
      let start = 0;
      start < allIds.length;
      start += STREAM_DEMAND_BATCH_RECORDS
    ) {
      const idBatch = allIds.slice(
        start,
        start + STREAM_DEMAND_BATCH_RECORDS
      );
      const operatorValues =
        await readCatalogStreamOperators(
          database,
          state,
          idBatch,
          signal
        );

      for (const operatorId of idBatch) {
        const record = operatorValues.get(
          operatorId
        ) || null;
        if (
          record &&
          (
            !catalogStreamRecordMatchesManifest(
              record,
              state.manifest
            ) ||
            record.generation !==
              state.generation
          )
        ) {
          throw new Error(
            "A streamed operator route belongs to another cache generation."
          );
        }
        const portableOwner =
          requirements.portableOwners.get(
            operatorId
          ) ||
          portableOwners.get(operatorId) ||
          "";
        const owner =
          catalogStreamNormalizeCsType(
            record?.owner || portableOwner
          );
        if (!owner) {
          unresolved.push(operatorId);
          continue;
        }
        if (!record) {
          unresolved.push(operatorId);
          if (!completeOwners.has(owner)) {
            continue;
          }
        }
        const pinned =
          pinnedSet.has(operatorId);
        if (
          !retainCatalogStreamHydrationOwner(
            owner,
            pinned,
            pinnedOwners,
            ephemeralOwners
          )
        ) {
          unresolved.push(operatorId);
          continue;
        }
        if (pinned) {
          ephemeralOwners.delete(owner);
        }
        if (record) {
          acceptedIds.add(operatorId);
          nextOperatorRows.set(
            operatorId,
            record
          );
        }
        if (!ownerLocators.has(owner)) {
          ownerLocators.set(owner, []);
        }
        if (
          record &&
          !completeOwners.has(owner)
        ) {
          ownerLocators.get(owner).push(
            record.locator
          );
        }
      }
      if (
        start + STREAM_DEMAND_BATCH_RECORDS <
          allIds.length
      ) {
        await yieldCatalogCacheWork();
      }
    }

    state.rows = new Map();
    state.assemblies = new Map();
    state.seedOwners = new Set([
      ...pinnedOwners,
      ...ephemeralOwners
    ]);
    state.pinnedOwners = new Set(
      pinnedOwners
    );
    state.ephemeralOwners = new Set(
      ephemeralOwners
    );
    state.dependencyOwners = new Set();
    state.requiredOperatorIds =
      acceptedIds;
    state.operatorRows = nextOperatorRows;
    state.unresolvedOperatorIds =
      unresolved;

    for (const [owner, locators] of
      ownerLocators) {
      const entry =
        await readCatalogStreamOwner(
          database,
          state,
          owner,
          locators,
          {
            hydrateAllMembers:
              completeOwners.has(owner)
          }
        );
      if (!entry) {
        unresolved.push(
          ...[...nextOperatorRows]
            .filter(([, row]) =>
              row.owner === owner
            )
            .map(([operatorId]) =>
              operatorId
            )
        );
      }
    }

    const bootstrapOwner = String(
      state.manifest.bootstrapOwner || ""
    );
    if (
      bootstrapOwner &&
      !state.rows.has(bootstrapOwner)
    ) {
      const bootstrap =
        await readCatalogStreamOwner(
          database,
          state,
          bootstrapOwner,
          [],
          { dependencyOnly: true }
        );
      if (bootstrap) {
        state.dependencyOwners.add(
          bootstrapOwner
        );
      }
    }

    const pinnedDirect = new Set();
    for (const owner of pinnedOwners) {
      const entry = state.rows.get(owner);
      for (const reference of
        collectCatalogStreamDirectReferences(
          entry
        )) {
        if (
          reference &&
          !state.rows.has(reference)
        ) {
          pinnedDirect.add(reference);
        }
      }
    }

    const boundedPending = [];
    const boundedQueued = new Set();
    const queueBounded = owner => {
      if (
        !owner ||
        state.rows.has(owner) ||
        boundedQueued.has(owner) ||
        boundedQueued.size >=
          STREAM_DEMAND_DEPENDENCY_OWNER_CAP
      ) {
        return;
      }
      boundedQueued.add(owner);
      boundedPending.push(owner);
    };

    let directLoaded = 0;
    for (const owner of pinnedDirect) {
      catalogStreamThrowIfAborted(signal);
      if (state.rows.has(owner)) continue;
      const entry =
        await readCatalogStreamOwner(
          database,
          state,
          owner,
          [],
          { dependencyOnly: true }
        );
      if (!entry) continue;
      state.dependencyOwners.add(owner);
      for (const reference of
        collectCatalogStreamDirectReferences(
          entry
        )) {
        queueBounded(reference);
      }
      directLoaded += 1;
      if (directLoaded % 32 === 0) {
        await yieldCatalogCacheWork();
      }
    }

    for (const owner of ephemeralOwners) {
      const entry = state.rows.get(owner);
      for (const reference of
        collectCatalogStreamDirectReferences(
          entry
        )) {
        queueBounded(reference);
      }
    }
    for (const owner of state.bootstrapOwners) {
      const entry = state.rows.get(owner);
      for (const reference of
        collectCatalogStreamDirectReferences(
          entry
        )) {
        queueBounded(reference);
      }
    }

    let boundedLoaded = 0;
    while (
      boundedPending.length > 0 &&
      boundedLoaded <
        STREAM_DEMAND_DEPENDENCY_OWNER_CAP
    ) {
      catalogStreamThrowIfAborted(signal);
      const owner = boundedPending.shift();
      if (state.rows.has(owner)) continue;
      const entry =
        await readCatalogStreamOwner(
          database,
          state,
          owner,
          [],
          { dependencyOnly: true }
        );
      if (!entry) continue;
      state.dependencyOwners.add(owner);
      boundedLoaded += 1;
      for (const reference of
        collectCatalogStreamDirectReferences(
          entry
        )) {
        queueBounded(reference);
      }
      if (boundedLoaded % 32 === 0) {
        await yieldCatalogCacheWork();
      }
    }
    state.hydrationRevision += 1;
    return Object.freeze({
      requested: allIds.length,
      loaded: acceptedIds.size,
      unresolvedOperatorIds:
        Object.freeze([...new Set(unresolved)])
    });
  }

  function buildCatalogStreamDemandSnapshot(
    state
  ) {
    const types = [];
    const enums = [];
    for (const entry of state.rows.values()) {
      if (entry.typeRow) {
        types.push({
          index:
            Number.isInteger(entry.typeIndex)
              ? entry.typeIndex
              : Number.MAX_SAFE_INTEGER,
          row: entry.typeRow
        });
      }
      if (entry.enumRow) {
        enums.push({
          index:
            Number.isInteger(entry.enumIndex)
              ? entry.enumIndex
              : Number.MAX_SAFE_INTEGER,
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
    return {
      ...state.manifest.root,
      assemblies:
        [...state.assemblies.values()],
      components: [],
      materials: [],
      commonMaterials: [],
      meshes: [],
      slotAttachOverloads: [],
      types: types.map(entry => entry.row),
      enums: enums.map(entry => entry.row),
      catalogDemandPartial: true,
      catalogDemandStreamed: true,
      catalogDemandRequiredOperatorIds:
        [...state.requiredOperatorIds],
      catalogDemandRevision:
        `${state.manifest.catalogFingerprint}:${state.hydrationRevision}`,
      catalogDemandLoadedOwnerCount:
        state.seedOwners.size,
      catalogDemandDependencyOwnerCount:
        state.dependencyOwners.size,
      catalogDemandTotalOwnerCount:
        Number(state.manifest.counts?.types || 0) +
        Number(state.manifest.counts?.enums || 0)
    };
  }

  async function verifiedCatalogStreamDemandRecord(
    database
  ) {
    const active = await readCatalogCacheValue(
      database,
      STREAM_DEMAND_ACTIVE_KEY
    );
    if (
      !catalogStreamCacheVersionSupported(active) ||
      !active?.manifestId
    ) {
      return null;
    }
    const manifest = await readCatalogCacheValue(
      database,
      active.manifestId
    );
    if (
      !validCatalogStreamDemandManifest(
        manifest
      ) ||
      !catalogStreamRecordMatchesManifest(
        active,
        manifest
      ) ||
      manifest.generation !==
        active.generation ||
      manifest.catalogFingerprint !==
        active.catalogFingerprint ||
      manifest.assemblyFingerprint !==
        active.assemblyFingerprint
    ) {
      return null;
    }
    const state =
      createCatalogStreamDemandState(
        Object.freeze(manifest)
      );
    await hydrateCatalogStreamDemandSnapshot(
      database,
      state,
      []
    );
    const raw =
      buildCatalogStreamDemandSnapshot(
        state
      );
    if (!strictCachedScannerContract(raw)) {
      return null;
    }
    catalogStreamDemandManifest =
      Object.freeze(manifest);
    catalogDemandManifest =
      catalogStreamDemandManifest;
    catalogDemandState = state;
    return Object.freeze({
      id: manifest.id,
      schemaVersion: manifest.schemaVersion,
      format: manifest.format,
      generation: manifest.generation,
      fingerprint:
        manifest.catalogFingerprint,
      sourceUrl: manifest.sourceUrl,
      demandPartial: true,
      demandManifest: manifest,
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
    state.fallbackReason = String(
      reason ||
      state.fallbackReason ||
      "Full catalog activation is disabled by the browser memory safety policy."
    );
    document.documentElement.dataset
      .rmlCatalogFullFallbackBlocked =
        "true";
    return statusCatalog();
  }

  async function ensureCatalogStreamDemandOperators(
    operatorIds,
    options = {}
  ) {
    const state = catalogDemandState;
    if (!state?.streamV1) {
      return Object.freeze({
        available: false,
        full: false,
        loaded: 0
      });
    }
    let database;
    try {
      database = await openCatalogCache();
      const hydration =
        await hydrateCatalogStreamDemandSnapshot(
          database,
          state,
          operatorIds,
          options?.portableOwners instanceof Map
            ? options.portableOwners
            : new Map(),
          {
            requestedEphemeral:
              options?.ephemeral === true,
            hydratePortableOwners:
              options?.hydratePortableOwners ===
                true,
            completePortableOwners:
              options?.completePortableOwners instanceof
                Set
                ? options.completePortableOwners
                : new Set(),
            signal: options?.signal || null
          }
        );
      const active =
        await readCatalogCacheValue(
          database,
          STREAM_DEMAND_ACTIVE_KEY
        );
      if (
        String(active?.generation || "") !==
          state.generation ||
        String(
          active?.catalogFingerprint || ""
        ) !==
          state.manifest.catalogFingerprint
      ) {
        const error = new Error(
          "The active streamed catalog generation changed during hydration."
        );
        error.code =
          "RML_CATALOG_CACHE_GENERATION_CHANGED";
        throw error;
      }
      const raw =
        buildCatalogStreamDemandSnapshot(
          state
        );
      const cachedCatalog = normalizeCatalog(
        raw,
        "scanner-cache",
        state.manifest.sourceUrl || ""
      );

      const activeCatalog =
        statusCatalog();

      const activeReport =
        window.RMLApiNodeFactoryReport;

      const preserveLiveGeneration =
        Boolean(
          activeCatalog &&
          activeReport &&
          activeReport.verificationPassed === true &&
          activeReport.liveCatalogVerified === true &&
          String(
            activeReport.catalogFingerprint || ""
          ) ===
            String(
              cachedCatalog.catalogFingerprint || ""
            ) &&
          String(
            activeReport.engineVersion || ""
          ) ===
            String(
              cachedCatalog.engineVersion || ""
            )
        );

      const catalog =
        preserveLiveGeneration
          ? Object.freeze({
              ...cachedCatalog,
              catalogSource: "scanner",
              catalogDataSource:
                "scanner-cache"
            })
          : cachedCatalog;
      await queueCatalogActivationOperation(
        () => activateCatalogAndFactoryNow(
          catalog
        )
      );
      const stored = Object.freeze({
        id: state.manifest.id,
        schemaVersion:
          state.manifest.schemaVersion,
        format: state.manifest.format,
        generation: state.generation,
        fingerprint:
          state.manifest.catalogFingerprint,
        sourceUrl:
          state.manifest.sourceUrl,
        demandPartial: true,
        demandManifest:
          state.manifest,
        catalog:
          deepFreezeCatalogSnapshot(raw)
      });
      cachedCatalogRecord = stored;
      cachedCatalogReadPromise =
        Promise.resolve(stored);
      cachedCatalogStatus = catalog;
      catalogAvailabilityKnown = true;
      catalogAvailable = true;
      updateStatus();
      return Object.freeze({
        available: true,
        full: false,
        loaded: hydration.loaded,
        unresolvedOperatorIds:
          hydration.unresolvedOperatorIds
      });
    } catch (error) {
      state.fallbackReason = String(
        error?.message || error
      );
      return Object.freeze({
        available: Boolean(statusCatalog()),
        full: false,
        loaded: 0,
        unresolvedOperatorIds:
          Object.freeze([
            ...(Array.isArray(operatorIds)
              ? operatorIds
              : [])
          ]),
        error: state.fallbackReason
      });
    } finally {
      database?.close?.();
    }
  }

  function ensureCatalogDemandOperators(
    operatorIds = [],
    options = {}
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
      if (state?.streamV1) {
        return ensureCatalogStreamDemandOperators(
          ids,
          options
        );
      }
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
          ids,
          options?.portableOwners instanceof Map
            ? options.portableOwners
            : new Map()
        );
      } catch (error) {
        if (
          options?.allowFullFallback === false ||
          error?.code ===
            "RML_CATALOG_DEMAND_UNROUTABLE"
        ) {
          return Object.freeze({
            available: true,
            full: false,
            loaded: 0,
            unresolvedOperatorIds:
              Object.freeze([
                ...(Array.isArray(
                  error?.operatorIds
                )
                  ? error.operatorIds
                  : ids)
              ])
          });
        }
        const fallbackCatalog =
          await activateFullCatalogDemandFallback(
          error?.message ||
          window.RMLI18n.t("ui.literal.0cf737b11b39")
        );
        return Object.freeze({
          available: Boolean(fallbackCatalog),
          full: false,
          loaded: 0,
          unresolvedOperatorIds:
            Object.freeze([...ids])
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
        const fallbackCatalog =
          await activateFullCatalogDemandFallback(
          error?.message ||
          window.RMLI18n.t("ui.literal.f2dffa08ea7c")
        );
        return Object.freeze({
          available: Boolean(fallbackCatalog),
          full: false,
          loaded: 0,
          unresolvedOperatorIds:
            Object.freeze([...ids])
        });
      } finally {
        database?.close?.();
      }
      const raw = buildCatalogDemandSnapshot(
        state
      );
      const cachedCatalog = normalizeCatalog(
        raw,
        "scanner-cache",
        state.fullManifest.sourceUrl || ""
      );

      const activeCatalog =
        statusCatalog();

      const activeReport =
        window.RMLApiNodeFactoryReport;

      const preserveLiveGeneration =
        Boolean(
          activeCatalog &&
          activeReport &&
          activeReport.verificationPassed === true &&
          activeReport.liveCatalogVerified === true &&
          String(
            activeReport.catalogFingerprint || ""
          ) ===
            String(
              cachedCatalog.catalogFingerprint || ""
            ) &&
          String(
            activeReport.engineVersion || ""
          ) ===
            String(
              cachedCatalog.engineVersion || ""
            )
        );

      const catalog =
        preserveLiveGeneration
          ? Object.freeze({
              ...cachedCatalog,
              catalogSource: "scanner",
              catalogDataSource:
                "scanner-cache"
            })
          : cachedCatalog;
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
        const fallbackCatalog =
          await activateFullCatalogDemandFallback(
          error?.message ||
          window.RMLI18n.t("ui.literal.3b4c54a95a3b")
        );
        return Object.freeze({
          available: Boolean(fallbackCatalog),
          full: false,
          loaded: 0,
          unresolvedOperatorIds:
            Object.freeze([...ids])
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
    if (state?.streamV1) {
      return Object.freeze({
        available: true,
        ready: true,
        busy: Boolean(
          catalogStreamDemandIngestPromise
        ),
        mode: "streamed-partial",
        partial: true,
        full: false,
        fullCatalogLoaded: false,
        fingerprint: String(
          state.manifest
            ?.catalogFingerprint || ""
        ),
        contentHash: "",
        requiredOperatorCount:
          state.requiredOperatorIds.size,
        requiredOwnerCount:
          state.seedOwners.size,
        bootstrapOwnerCount:
          state.bootstrapOwners.size,
        dependencyOwnerCount:
          state.dependencyOwners.size,
        cachedChunkCount: 0,
        loadedOwnerCount:
          state.rows.size,
        loadedShardCount: 0,
        totalShardCount: Number(
          state.manifest
            ?.searchShardCount || 0
        ),
        loadedBytes: 0,
        totalBytes: Number(
          state.manifest?.totalBytes || 0
        ),
        fallbackReason: String(
          state.fallbackReason || ""
        ),
        totalOwnerCount:
          Number(
            state.manifest.counts?.types || 0
          ) +
          Number(
            state.manifest.counts?.enums || 0
          ),
        operatorCount: Number(
          state.manifest.operatorCount || 0
        ),
        unresolvedOperatorCount:
          state.unresolvedOperatorIds.length
      });
    }
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
    if (catalogDemandState?.streamV1) {
      return Object.freeze({
        compact: false,
        entries: Object.freeze([]),
        revision: String(
          catalogDemandState.manifest
            .catalogFingerprint || ""
        ),
        contentHash: "",
        catalogFingerprint: String(
          catalogDemandState.manifest
            .catalogFingerprint || ""
        ),
        paged: true
      });
    }
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

  function catalogStreamManifestVisibleGroups(
    manifest,
    {
      showAdvanced = false,
      context = ""
    } = {}
  ) {
    const countIndex =
      context === "custom-csharp"
        ? (showAdvanced === true ? 3 : -1)
        : (showAdvanced === true ? 2 : 1);
    if (countIndex < 0) return [];
    return (
      Array.isArray(
        manifest?.visibilityGroupCounts
      )
        ? manifest.visibilityGroupCounts
        : []
    ).map(entry => [
      String(entry?.[0] || "Other"),
      Math.max(
        0,
        Number(entry?.[countIndex]) || 0
      )
    ]);
  }

  async function catalogDemandPaletteSummary(
    options = {}
  ) {
    const manifest =
      catalogDemandState?.streamV1
        ? catalogDemandState.manifest
        : null;
    if (!manifest) {
      const legacy =
        catalogDemandPaletteIndex();
      const groups = new Map();
      for (const entry of
        legacy?.entries || []) {
        const group = legacy.compact
          ? String(
              legacy.groups?.[
                Number(entry?.[3])
              ] || "Other"
            )
          : String(
              entry?.definition?.group ||
              entry?.group || "Other"
            );
        groups.set(
          group,
          (groups.get(group) || 0) + 1
        );
      }
      return Object.freeze({
        revision: String(
          legacy?.revision || ""
        ),
        total:
          legacy?.entries?.length || 0,
        groups: Object.freeze(
          [...groups]
            .map(([name, count]) =>
              Object.freeze({
                name,
                count
              })
            )
            .sort((left, right) =>
              left.name.localeCompare(
                right.name
              )
            )
        )
      });
    }
    const filtersVisibility = Boolean(
      options &&
      (
        Object.hasOwn(
          options,
          "showAdvanced"
        ) ||
        String(options.context || "")
      )
    );
    const visibleGroups = filtersVisibility
      ? catalogStreamManifestVisibleGroups(
          manifest,
          options
        )
      : (
          Array.isArray(
            manifest.groupCounts
          )
            ? manifest.groupCounts
            : []
        ).map(entry => [
          String(entry?.[0] || "Other"),
          Math.max(
            0,
            Number(entry?.[1]) || 0
          )
        ]);
    return Object.freeze({
      revision: String(
        manifest.catalogFingerprint || ""
      ),
      total: visibleGroups.reduce(
        (total, entry) =>
          total + entry[1],
        0
      ),
      groups: Object.freeze(
        visibleGroups.map(
          ([name, count]) =>
            Object.freeze({
              name,
              count
            })
        )
      )
    });
  }

  function catalogStreamPaletteMetadataVisible(
    definition,
    {
      showAdvanced = false,
      context = ""
    } = {}
  ) {
    if (
      !definition ||
      definition.hiddenFromPalette === true
    ) {
      return false;
    }
    const custom =
      definition.customCSharpCatalogNode ===
        true;
    if (context === "custom-csharp") {
      return custom && showAdvanced === true;
    }
    if (
      showAdvanced !== true &&
      (
        custom ||
        definition.expertOnly === true ||
        definition.group ===
          CATALOG_STREAM_GROUPS.advanced
      )
    ) {
      return false;
    }
    return true;
  }

  async function catalogDemandQueryPalette(
    options = {}
  ) {
    const state = catalogDemandState;
    if (!state?.streamV1) {
      return Object.freeze({
        entries: Object.freeze([]),
        total: 0,
        offset: 0,
        limit: 0,
        revision: ""
      });
    }
    const signal = options?.signal || null;
    catalogStreamThrowIfAborted(signal);
    const group = String(
      options.group || ""
    );
    const query = String(
      options.query || ""
    ).trim().toLocaleLowerCase("en-US");
    const tokens = query
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 16);
    const rawOffset = Number(
      options.offset
    );
    const maximumOffset = Math.max(
      0,
      Math.min(
        Number.MAX_SAFE_INTEGER,
        Math.trunc(
          Number(
            state.manifest
              .operatorCount || 0
          )
        )
      )
    );
    const offset = Math.max(
      0,
      Math.min(
        maximumOffset,
        Number.isFinite(rawOffset)
          ? Math.trunc(rawOffset)
          : 0
      )
    );
    const rawLimit = Number(
      options.limit
    );
    const limit = Math.max(
      1,
      Math.min(
        STREAM_DEMAND_QUERY_LIMIT,
        Number.isFinite(rawLimit) &&
          rawLimit !== 0
          ? Math.trunc(rawLimit)
          : 32
      )
    );
    const visibility = {
      showAdvanced:
        options.showAdvanced === true,
      context: String(
        options.context || ""
      )
    };
    let database;
    try {
      database = await openCatalogCache();
      const selectedIds = [];
      let total = 0;
      if (tokens.length > 0) {
        const prefix =
          catalogStreamDemandRecordKey(
            state.generation,
            "search-shard"
          ) + ":";
        let lastMatchedId = "";
        await readCatalogCachePrefix(
          database,
          prefix,
          record => {
            catalogStreamThrowIfAborted(signal);
            const rows = record?.rows;
            if (
              !catalogStreamRecordMatchesManifest(
                record,
                state.manifest
              ) ||
              record?.generation !==
                state.generation ||
              record?.kind !== "search-shard" ||
              !Array.isArray(rows) ||
              rows.length < 1 ||
              rows.length > 128 ||
              !catalogStreamBoundedShardBytes(
                record.byteLength,
                128 * 1024,
                rows.length
              )
            ) {
              throw new Error(
                "A streamed catalog search shard is invalid."
              );
            }
            for (const row of rows) {
              if (
                !Array.isArray(row) ||
                row.length !== 4
              ) {
                throw new Error(
                  "A streamed catalog search row is invalid."
                );
              }
              const operatorId = String(
                row[0] || ""
              );
              const searchText = String(
                row[1] || ""
              );
              const rowGroup = String(
                row[2] || ""
              );
              const flags = Number(row[3]) || 0;
              if (
                (group && rowGroup !== group) ||
                !tokens.every(token =>
                  searchText.includes(token)
                ) ||
                !catalogStreamPaletteMetadataVisible(
                  {
                    group: rowGroup,
                    expertOnly:
                      (flags & 1) !== 0,
                    customCSharpCatalogNode:
                      (flags & 2) !== 0,
                    hiddenFromPalette:
                      (flags & 4) !== 0
                  },
                  visibility
                )
              ) {
                continue;
              }
              if (operatorId === lastMatchedId) {
                continue;
              }
              lastMatchedId = operatorId;
              if (
                total >= offset &&
                selectedIds.length < limit
              ) {
                selectedIds.push(operatorId);
              }
              total += 1;
            }
            return true;
          },
          Math.max(
            0,
            Number(
              state.manifest
                .searchShardCount || 0
            )
          )
        );
      } else {
        const visibleGroups =
          catalogStreamManifestVisibleGroups(
            state.manifest,
            visibility
          );
        const manifestTotal = group
          ? Number(
              visibleGroups.find(entry =>
                entry?.[0] === group
              )?.[1] || 0
            )
          : visibleGroups.reduce(
              (sum, entry) =>
                sum + Number(entry?.[1] || 0),
              0
            );
        total = manifestTotal;
        const prefix = group
          ? catalogStreamDemandRecordKey(
              state.generation,
              "palette-shard",
              group
            ) + ":"
          : catalogStreamDemandRecordKey(
              state.generation,
              "palette-shard"
            ) + ":";
        let visibleIndex = 0;
        await readCatalogCachePrefix(
          database,
          prefix,
          record => {
            catalogStreamThrowIfAborted(signal);
            const rows = record?.rows;
            if (
              !catalogStreamRecordMatchesManifest(
                record,
                state.manifest
              ) ||
              record?.generation !==
                state.generation ||
              record?.kind !== "palette-shard" ||
              !Array.isArray(rows) ||
              rows.length < 1 ||
              rows.length >
                STREAM_DEMAND_PALETTE_SHARD_RECORDS ||
              !catalogStreamBoundedShardBytes(
                record.byteLength,
                STREAM_DEMAND_PALETTE_SHARD_BYTES,
                rows.length
              )
            ) {
              throw new Error(
                "A streamed catalog palette shard is invalid."
              );
            }
            const rowGroup = String(
              record.group || "Other"
            );
            if (group && rowGroup !== group) {
              throw new Error(
                "A streamed palette shard escaped its group prefix."
              );
            }
            for (const row of rows) {
              if (
                !Array.isArray(row) ||
                row.length !== 2
              ) {
                throw new Error(
                  "A streamed catalog palette row is invalid."
                );
              }
              const flags = Number(row[1]) || 0;
              if (!catalogStreamPaletteMetadataVisible(
                {
                  group: rowGroup,
                  expertOnly:
                    (flags & 1) !== 0,
                  customCSharpCatalogNode:
                    (flags & 2) !== 0,
                  hiddenFromPalette:
                    (flags & 4) !== 0
                },
                visibility
              )) {
                continue;
              }
              if (
                visibleIndex >= offset &&
                selectedIds.length < limit
              ) {
                selectedIds.push(
                  String(row[0] || "")
                );
              }
              visibleIndex += 1;
            }
            return selectedIds.length < limit;
          },
          group
            ? Number(
                state.manifest
                  .paletteShardCounts
                  .find(entry =>
                    entry?.[0] === group
                  )?.[1] || 0
              ) + 1
            : Number(
                state.manifest
                  .paletteShardCount || 0
              ) + 1
        );
      }
      catalogStreamThrowIfAborted(signal);
      const operatorRecords =
        await readCatalogStreamOperators(
          database,
          state,
          selectedIds,
          signal
        );
      const entries = [];
      for (const operatorId of selectedIds) {
        const record =
          operatorRecords.get(operatorId);
        if (!record?.definition) continue;
        entries.push(Object.freeze({
          operatorId,
          definition:
            Object.freeze({
              ...record.definition,
              apiSearchText:
                query
                  ? `${record.definition.apiSearchText || ""} ${query}`.trim()
                  : String(
                      record.definition.apiSearchText || ""
                    ),
              customCSharpSyntaxNode: false,
              customCSharpSubgraphOnly: false
            })
        }));
      }
      return Object.freeze({
        entries: Object.freeze(entries),
        total,
        offset,
        limit,
        revision: String(
          state.manifest
            .catalogFingerprint || ""
        )
      });
    } finally {
      database?.close?.();
    }
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

  async function writeChunkedCatalogRecordUnlocked(
    database,
    raw,
    sourceUrl,
    previousRecord = null,
    exclusiveLockHeld = false
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
        } else if (exclusiveLockHeld) {
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

  function writeChunkedCatalogRecord(
    database,
    raw,
    sourceUrl,
    previousRecord = null
  ) {
    const locks = navigator.locks;
    if (
      locks &&
      typeof locks.request === "function"
    ) {
      let lockRequestStarted = false;
      let lockRequestAccepted = true;
      try {
        const request = locks.request(
          CACHE_WRITE_LOCK_NAME,
          {
            mode: "exclusive",
            ifAvailable: true
          },
          lock => {
            lockRequestStarted = true;
                if (!lockRequestAccepted) {
              return false;
            }
            if (!lock) {
              throw new Error(
                "Another Builder tab is already committing the catalog cache; this tab will keep using its verified in-memory catalog without waiting."
              );
            }
            return writeChunkedCatalogRecordUnlocked(
              database,
              raw,
              sourceUrl,
              previousRecord,
              true
            );
          }
        );
        return Promise.resolve(request);
      } catch (error) {
        throw error;
      }
    }
    return writeChunkedCatalogRecordUnlocked(
      database,
      raw,
      sourceUrl,
      previousRecord,
      false
    );
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
      const streamed =
        await verifiedCatalogStreamDemandRecord(
          database
        );
      if (streamed) {
        cachedCatalogRecord = streamed;
        return streamed;
      }
      for (let attempt = 0; attempt < 2; attempt += 1) {
        const stored =
          await readCatalogCacheRecord(
            database
          );
        const legacyByteLength =
          Array.isArray(stored?.chunks)
            ? stored.chunks.reduce(
                (total, chunk) =>
                  total + Math.max(
                    0,
                    Number(
                      chunk?.byteLength
                    ) || 0
                  ),
                0
              )
            : Number.POSITIVE_INFINITY;
        if (
          legacyByteLength >
            2 * 1024 * 1024 ||
          Number(stored?.chunkCount) > 4
        ) {
          return null;
        }
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
          const resolved = current;
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
    element.setAttribute(
      "aria-busy",
      "true"
    );
  }

  async function activateCatalogFromUserClick() {
    if (manualCatalogActivationPromise) {
      return manualCatalogActivationPromise;
    }

    manualCatalogActivationPromise =
      Promise.resolve()
        .then(async () => {
          renderManualCatalogChecking();

          const synchronized =
            await synchronizeAvailableCatalog({
              silent: true,
              showWork: true,
              forceRetry: true,
              throwOnFailure: false
            });

          if (
            synchronized === true &&
            statusCatalog()
          ) {
            catalogAvailabilityKnown = true;
            catalogAvailable = true;
            updateStatus();
            document.dispatchEvent(
              new CustomEvent(
                "rml-scanner:manual-live-activated",
                {
                  detail: Object.freeze({
                    transport:
                      "builder-proxy"
                  })
                }
              )
            );
            return true;
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
          const element =
            document.getElementById(
              "api-catalog-state"
            );
          element?.setAttribute(
            "aria-busy",
            "false"
          );
          updateStatus();
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

    if (
      Number(
        window.RMLScannerStatusControl?.version
      ) >= 2 &&
      window.RMLScannerStatusControl?.moduleId ===
        CATALOG_LOADER_MODULE_ID
    ) {
      manualCatalogActivationInstalled = true;
      window.RMLScannerStatusControl
        .refresh?.();
      return;
    }

    manualCatalogActivationInstalled = true;

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
      liveFingerprintVerified = false,
      preserveLiveVerification = false
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

    const catalogDataSource =
      String(
        catalog?.catalogSource || ""
      );

    const liveCatalogVerified =
      liveFingerprintVerified === true ||
      (
        preserveLiveVerification === true &&
        report.liveCatalogVerified === true
      ) ||
      catalogDataSource === "scanner";

    const catalogSource =
      liveCatalogVerified
        ? "scanner"
        : catalogDataSource;

    if (
      String(report.catalogSource || "") ===
        catalogSource &&
      report.liveCatalogVerified ===
        liveCatalogVerified &&
      String(report.catalogDataSource || "") ===
        catalogDataSource
    ) {
      return true;
    }

    const nextReport = Object.freeze({
      ...report,
      catalogSource,
      liveCatalogVerified,
      catalogDataSource
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
      !controller ||
      typeof controller.rebuild !== "function" ||
      typeof controller.resolveRequiredOperators !==
        "function"
    ) {
      throw new Error(
        "The API node factory module is present but does not expose the catalog capabilities required to evaluate API nodes."
      );
    }
  }

  let catalogActivationPromise =
    Promise.resolve();

  function queueCatalogActivationOperation(
    operation,
    signal = null
  ) {
    const run = () =>
      Promise.resolve().then(
        operation
      );
    const gate = signal
      ? awaitCatalogSettlement(
          catalogActivationPromise,
          signal,
          "The preceding catalog factory activation"
        )
      : catalogActivationPromise;
    const queued = gate.then(
      run,
      error => {
        if (signal?.aborted) {
          throw catalogAbortError(
            signal,
            "The catalog factory activation"
          );
        }
        return run(error);
      }
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
    catalog,
    { signal = null } = {}
  ) {
    const existingReport =
      window.RMLApiNodeFactoryReport;

    const preserveLiveVerification =
      Boolean(
        existingReport &&
        existingReport.verificationPassed === true &&
        existingReport.liveCatalogVerified === true &&
        String(
          existingReport.catalogFingerprint || ""
        ) ===
          String(
            catalog?.catalogFingerprint || ""
          ) &&
        String(
          existingReport.engineVersion || ""
        ) ===
          String(
            catalog?.engineVersion || ""
          )
      );

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
        catalog,
        {
          preserveLiveVerification
        }
      );

      return assertCatalogFactoryCommit(
        catalog,
        window.RMLApiNodeFactoryReport ||
          existingReport
      );
    }

    await awaitCatalogSettlement(
      baseModNodesReady,
      signal,
      "The base node modules"
    );

    await awaitCatalogSettlement(
      ensureApiNodesModuleLoaded(),
      signal,
      "The API node factory module"
    );

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
        catalog,
        {
          preserveLiveVerification
        }
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
        window.RMLI18n.t(
          "ui.literal.9d9796871ed3"
        )
      );
    }

    const rebuildOptions = {
      createCatalogPublication,
      signal
    };

    let rebuildError = null;

    for (
      let attempt = 0;
      attempt < 3;
      attempt += 1
    ) {
      try {
        await awaitCatalogSettlement(
          controller.rebuild(
            catalog,
            rebuildOptions
          ),
          signal,
          "The API node factory rebuild"
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
            window.RMLI18n.t(
              "ui.literal.6bafcf11ed48"
            )
          ) ||
          message.includes(
            window.RMLI18n.t(
              "ui.literal.a57d9e3cfe81"
            )
          );

        if (
          !registryChanged ||
          attempt >= 2
        ) {
          throw error;
        }

        await awaitCatalogSettlement(
          new Promise(resolve =>
            window.RMLScheduleTask(resolve)
          ),
          signal,
          "The API node factory registry retry yield"
        );
      }
    }

    if (rebuildError) {
      throw rebuildError;
    }

    report =
      window.RMLApiNodeFactoryReport;

    if (preserveLiveVerification) {
      promoteFactoryReportForCatalog(
        catalog,
        {
          preserveLiveVerification: true
        }
      );

      report =
        window.RMLApiNodeFactoryReport ||
        report;
    }

    return assertCatalogFactoryCommit(
      catalog,
      report
    );
  }

  function activateCatalogAndFactory(
    catalog,
    options = {}
  ) {
    return queueCatalogActivationOperation(
      () =>
        activateCatalogAndFactoryNow(
          catalog,
          options
        ),
      options.signal || null
    );
  }

  function catalogSessionKey(session) {
    return String(
      session?.syncKey ??
      session?.generation ??
      ""
    );
  }

  function builderScannerEndpoint(pathname) {
    return new URL(
      pathname,
      window.location.origin
    ).href;
  }

  function directScannerDemandEndpoint(
    status,
    health,
    port
  ) {
    const expectedOrigin =
      `http://127.0.0.1:${port}`;
    for (const candidate of [
      status?.catalogDemandUrl,
      health?.catalogDemandUrl
    ]) {
      try {
        const url = new URL(
          String(candidate || "")
        );
        if (
          url.origin === expectedOrigin &&
          url.pathname ===
            "/catalog/demand-v1" &&
          !url.username &&
          !url.password
        ) {
          return url.href;
        }
      } catch {}
    }
    return `${expectedOrigin}/catalog/demand-v1`;
  }

  Object.defineProperty(
    window,
    "RMLCatalogHealthSweepDiagnostics",
    {
      value: Object.freeze({
        version: 1,
        get latest() {
          return latestCatalogHealthSweepDiagnostics;
        }
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );

  function catalogHealthSweepHealthSummary(
    probes
  ) {
    const outcomes = Array.isArray(probes)
      ? probes
      : [];
    return Object.freeze({
      total: outcomes.length,
      responded: outcomes.filter(probe =>
        Boolean(probe?.health) ||
        Number(probe?.http?.status) > 0
      ).length,
      healthy: outcomes.filter(probe =>
        probe?.outcome === "healthy"
      ).length,
      unhealthy: outcomes.filter(probe =>
        probe?.outcome === "unhealthy"
      ).length,
      errors: outcomes.filter(probe =>
        probe?.outcome === "error"
      ).length,
      timeouts: outcomes.filter(probe =>
        probe?.outcome === "timeout"
      ).length,
      aborted: outcomes.filter(probe =>
        probe?.outcome === "aborted"
      ).length
    });
  }

  function catalogHealthSweepFailure(
    error,
    options = {}
  ) {
    const name = String(
      error?.name || "Error"
    );
    const message = String(
      error?.message ||
      error ||
      "The scanner health probe failed."
    );
    const aborted =
      options.aborted === true;
    const timedOut = Boolean(
      !aborted &&
      (
        options.timedOut === true ||
        name === "AbortError"
      )
    );
    const httpMatch = message.match(
      /^(?:HTTP\s+)?([1-5]\d{2})(?:\s+(.+))?$/i
    );
    const status = httpMatch
      ? Number(httpMatch[1])
      : 0;
    const statusText = httpMatch
      ? String(httpMatch[2] || "")
      : "";

    return Object.freeze({
      outcome: aborted
        ? "aborted"
        : timedOut
          ? "timeout"
          : "error",
      http: Object.freeze({
        status,
        statusText
      }),
      error: Object.freeze({
        name,
        message,
        code: String(error?.code || ""),
        aborted,
        timedOut
      })
    });
  }

  function publishCatalogHealthSweepDiagnostics(
    value
  ) {
    const probes = Object.freeze(
      (Array.isArray(value?.probes)
        ? value.probes
        : []).map(probe =>
        Object.freeze({
          ...probe,
          http: Object.freeze({
            status: Math.max(
              0,
              Number(
                probe?.http?.status
              ) || 0
            ),
            statusText: String(
              probe?.http?.statusText ||
              ""
            )
          }),
          ...(probe?.health
            ? {
              health: Object.freeze({
                ...probe.health
              })
            }
            : {}),
          ...(probe?.error
            ? {
              error: Object.freeze({
                ...probe.error
              })
            }
            : {})
        }))
    );
    const diagnostics = Object.freeze({
      ...value,
      sequence:
        ++catalogHealthSweepSequence,
      selectedPort: Math.max(
        0,
        Number(value?.selectedPort) || 0
      ),
      candidateCount: Math.max(
        0,
        Number(value?.candidateCount) || 0
      ),
      summary:
        catalogHealthSweepHealthSummary(
          probes
        ),
      probes
    });

    latestCatalogHealthSweepDiagnostics =
      diagnostics;
    document.documentElement.dataset
      .rmlCatalogHealthSweepState =
        diagnostics.outcome;
    document.documentElement.dataset
      .rmlCatalogHealthSweepSummary =
        JSON.stringify(
          diagnostics.summary
        );
    document.documentElement.dataset
      .rmlCatalogHealthSweepDiagnostics =
        JSON.stringify({
          sequence: diagnostics.sequence,
          outcome: diagnostics.outcome,
          selectedPort:
            diagnostics.selectedPort,
          candidateCount:
            diagnostics.candidateCount,
          summary: diagnostics.summary,
          probes: diagnostics.probes.map(
            probe => ({
              port: probe.port,
              outcome: probe.outcome,
              http: probe.http,
              error: probe.error || null,
              health: probe.health
                ? {
                    ok:
                      probe.health.ok === true,
                    catalogReady:
                      probe.health.catalogReady === true,
                    catalogAvailable:
                      probe.health.catalogAvailable === true,
                    runtimeBridgeReady:
                      probe.health.runtimeBridgeReady === true,
                    runtimeBridgeVersion:
                      Number(
                        probe.health.runtimeBridgeVersion
                      ) || 0
                  }
                : null
            })
          )
        });
    console.info(
      "[RML API Catalog] Completed a single ordered health sweep.",
      diagnostics
    );
    return diagnostics;
  }

  async function discoverBuilderCatalogSession(
    signal = null
  ) {
    const outcomes = [];
    let selected = null;
    for (
      let port = DEFAULT_PORT_FIRST;
      port <= DEFAULT_PORT_LAST;
      port += 1
    ) {
      if (signal?.aborted === true) {
        break;
      }
      let outcome;
      try {
        const health = await fetchJson(
          `http://127.0.0.1:${port}/health`,
          signal
        );
        outcome = Object.freeze({
          port,
          outcome:
            health?.ok === true
              ? "healthy"
              : "unhealthy",
          http: Object.freeze({
            status: 200,
            statusText: "OK"
          }),
          health: Object.freeze({
            ...health
          }),
          fingerprint: String(
            scannerFingerprintContract(
              health
            )?.fingerprint ||
            legacyScannerFingerprint(
              health
            ) ||
            ""
          ).trim().toLowerCase()
        });
      } catch (error) {
        outcome = Object.freeze({
          port,
          ...catalogHealthSweepFailure(
            error,
            {
              aborted:
                signal?.aborted === true
            }
          )
        });
      }
      outcomes.push(outcome);
      if (outcome.health?.ok === true) {
        selected = outcome;
        break;
      }
    }
    publishCatalogHealthSweepDiagnostics({
      outcome:
        signal?.aborted === true
          ? "aborted"
          : selected
            ? "selected"
            : "unavailable",
      selectedPort:
        signal?.aborted === true
          ? 0
          : selected?.port || 0,
      candidateCount:
        selected ? 1 : 0,
      probes: outcomes
    });
    if (signal?.aborted === true) {
      return null;
    }
    if (!selected) {
      return null;
    }

    const port = selected.port;
    const health = selected.health;
    const fingerprint = String(
      selected.fingerprint
    );

    const scannerBaseUrl =
      `http://127.0.0.1:${port}`;
    const syncKey =
      `builder-proxy:${port}:${fingerprint}`;
    return Object.freeze({
      mode: "live",
      transport: "builder-proxy",
      port,
      generation: syncKey,
      syncKey,
      health,
      scannerBaseUrl,
      catalogFetchUrl:
        `${builderScannerEndpoint(
          BUILDER_SCANNER_CATALOG_PATH
        )}?port=${encodeURIComponent(port)}`,
      catalogDemandFetchUrl:
        directScannerDemandEndpoint(
          null,
          health,
          port
        ),
      catalogDemandProxyUrl:
        `${builderScannerEndpoint(
          BUILDER_SCANNER_DEMAND_PATH
        )}?port=${encodeURIComponent(port)}`
    });
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

  function ensureScannerCheckWork(
    options = {},
    sessionKey = ""
  ) {
    if (
      options.showWork !== true ||
      !window.RMLBuilderWork
    ) {
      return scannerCheckWorkSession;
    }
    const presentationKey = String(
      sessionKey || ""
    );
    if (
      options.forceRetry !== true &&
      presentationKey &&
      scannerCheckPresentedSessionKey ===
        presentationKey
    ) {
      return scannerCheckWorkSession;
    }
    if (!scannerCheckWorkSession) {
      scannerCheckPresentedSessionKey =
        presentationKey;
      scannerCheckWorkSession =
        window.RMLBuilderWork.begin?.({
          kicker:
            window.RMLI18n.t("ui.literal.924e20a624e5"),
          title:
            window.RMLI18n.t("ui.auto.4fbd685b87a4"),
          message:
            window.RMLI18n.t("ui.auto.ef5bac1920fc"),
          detail:
            window.RMLI18n.t("ui.auto.112240abb0c0"),
          progress: 1,
        }) || 0;
    }
    return scannerCheckWorkSession;
  }

  function updateScannerCheckWork(options = {}) {
    if (!scannerCheckWorkSession) return;
    window.RMLBuilderWork?.update?.(
      scannerCheckWorkSession,
      options
    );
  }

  async function finishScannerCheckWork(
    completed = false
  ) {
    const session = scannerCheckWorkSession;
    scannerCheckWorkSession = 0;
    if (session) {
      if (
        completed === true &&
        typeof window.RMLBuilderWork?.complete ===
          "function"
      ) {
        await window.RMLBuilderWork.complete(
          session
        );
      } else {
        window.RMLBuilderWork?.finish?.(session);
      }
    }
  }

  function resetScannerCheckProgress(
    sessionKey
  ) {
    const channel = {
      snapshot: null,
      listeners: new Set()
    };
    scannerCheckProgressChannels.set(
      sessionKey,
      channel
    );
    while (
      scannerCheckProgressChannels.size > 8
    ) {
      const oldest =
        scannerCheckProgressChannels.keys()
          .next().value;
      if (!oldest || oldest === sessionKey) {
        break;
      }
      scannerCheckProgressChannels.delete(
        oldest
      );
    }
    return channel;
  }

  function subscribeScannerCheckProgress(
    sessionKey,
    callback
  ) {
    if (typeof callback !== "function") {
      return () => {};
    }
    const channel =
      scannerCheckProgressChannels.get(
        sessionKey
      ) ||
      resetScannerCheckProgress(
        sessionKey
      );
    channel.listeners.add(callback);
    if (channel.snapshot) {
      notifyCatalogGate(
        callback,
        channel.snapshot
      );
    }
    return () => {
      channel.listeners.delete(callback);
    };
  }

  function publishScannerCheckProgress(
    sessionKey,
    detail = {}
  ) {
    const channel =
      scannerCheckProgressChannels.get(
        sessionKey
      ) ||
      resetScannerCheckProgress(
        sessionKey
      );
    const requested = Number(
      detail.progress
    );
    const previous = Number(
      channel.snapshot?.progress
    ) || 0;
    const progress = Math.max(
      previous,
      Math.max(
        0,
        Math.min(
          1,
          Number.isFinite(requested)
            ? requested
            : previous
        )
      )
    );
    const snapshot = Object.freeze({
      version: 1,
      sessionKey,
      branch: String(
        detail.branch || "checking"
      ),
      phase: String(
        detail.phase || "checking"
      ),
      ...detail,
      progress
    });
    channel.snapshot = snapshot;
    for (const listener of [
      ...channel.listeners
    ]) {
      notifyCatalogGate(
        listener,
        snapshot
      );
    }
    return snapshot;
  }

  function observeScannerCheckProgress(
    sessionKey,
    callback,
    promise
  ) {
    const unsubscribe =
      subscribeScannerCheckProgress(
        sessionKey,
        callback
      );
    return Promise.resolve(promise)
      .finally(unsubscribe);
  }

  const SCANNER_DEMAND_RECORD_PROGRESS =
    Object.freeze([
      Object.freeze([0, 0.32]),
      Object.freeze([0.1, 0.33]),
      Object.freeze([0.25, 0.38]),
      Object.freeze([0.5, 0.69]),
      Object.freeze([0.75, 0.86]),
      Object.freeze([1, 0.985])
    ]);

  function scannerDemandRecordProgress(
    fraction
  ) {
    const bounded = Math.max(
      0,
      Math.min(1, Number(fraction) || 0)
    );
    for (
      let index = 1;
      index <
        SCANNER_DEMAND_RECORD_PROGRESS.length;
      index += 1
    ) {
      const left =
        SCANNER_DEMAND_RECORD_PROGRESS[
          index - 1
        ];
      const right =
        SCANNER_DEMAND_RECORD_PROGRESS[index];
      if (bounded > right[0]) continue;
      const span = right[0] - left[0];
      const ratio = span > 0
        ? (bounded - left[0]) / span
        : 1;
      return left[1] +
        (right[1] - left[1]) * ratio;
    }
    return 0.985;
  }

  async function synchronizeScannerStatus(options = {}) {
    const session =
      options.session ||
      currentScannerConnection();
    const sessionKey = catalogSessionKey(session);
    const builderProxySession =
      session.transport === "builder-proxy";
    const sessionFingerprint = String(
      scannerFingerprintContract(
        session.health
      )?.fingerprint ||
      legacyScannerFingerprint(
        session.health
      ) ||
      ""
    ).trim().toLowerCase();

    if (session.mode !== "live") {
      notifyCatalogGate(
        options.onProgress,
        Object.freeze({
          version: 1,
          sessionKey,
          branch: "fallback",
          phase: "unavailable",
          progress: 1,
          phaseProgress: 1
        })
      );
      return false;
    }
    if (
      options.forceRetry !== true &&
      scannerCheckRejectedSessionKey ===
        sessionKey
    ) {
      updateStatus();
      notifyCatalogGate(
        options.onProgress,
        Object.freeze({
          version: 1,
          sessionKey,
          branch: "fallback",
          phase: "latched-failure",
          progress: 1,
          phaseProgress: 1
        })
      );
      return false;
    }
    if (
      options.forceRetry === true &&
      scannerCheckRejectedSessionKey ===
        sessionKey
    ) {
      scannerCheckRejectedSessionKey = "";
    }
    if (
      scannerCheckGeneration === sessionKey &&
      scannerCheckPromise
    ) {
      if (
        scannerCheckMismatchSessionKey ===
        sessionKey
      ) {
        ensureScannerCheckWork(
          options,
          sessionKey
        );
      }
      return observeScannerCheckProgress(
        sessionKey,
        options.onProgress,
        scannerCheckPromise
      );
    }
    if (
      scannerCheckGeneration === sessionKey &&
      lastScannerFingerprintSync.liveReached === true &&
      window.RMLApiNodeFactoryReport?.liveCatalogVerified === true &&
      sessionFingerprint &&
      String(
        lastScannerFingerprintSync.fingerprint || ""
      ).trim().toLowerCase() === sessionFingerprint
    ) {
      updateStatus();
      notifyCatalogGate(
        options.onProgress,
        Object.freeze({
          version: 1,
          sessionKey,
          branch: "cache-match",
          phase: "complete",
          progress: 1,
          phaseProgress: 1
        })
      );
      return true;
    }
    if (
      !options.session &&
      (
        !options.manualSession ||
        options.manualSession.generation !==
          session.generation
      )
    ) {
      notifyCatalogGate(
        options.onProgress,
        Object.freeze({
          version: 1,
          sessionKey,
          branch: "fallback",
          phase: "stale-session",
          progress: 1,
          phaseProgress: 1
        })
      );
      return false;
    }
    scannerCheckAbortController?.abort();
    const externalSignal =
      options.signal ||
      (
        builderProxySession
          ? null
          : window.RMLRuntimeBridge
              ?.getSessionSignal?.()
      );
    const checkController =
      new AbortController();
    const abortCheck = () =>
      checkController.abort();
    if (externalSignal?.aborted) {
      abortCheck();
    } else {
      externalSignal?.addEventListener?.(
        "abort",
        abortCheck,
        { once: true }
      );
    }
    scannerCheckAbortController =
      checkController;
    const signal = checkController.signal;
    const sessionIsCurrent = () => {
      if (signal?.aborted) {
        return false;
      }
      if (builderProxySession) {
        return (
          activeBuilderCatalogSessionKey ===
          sessionKey
        );
      }
      const active = currentScannerConnection();
      return (
        active.mode === "live" &&
        active.generation ===
          session.generation
      );
    };
    const assertSession = () => {
      if (!sessionIsCurrent()) {
        throw new Error("Scanner session was closed.");
      }
    };
    resetScannerCheckProgress(sessionKey);
    const unsubscribeProgress =
      subscribeScannerCheckProgress(
        sessionKey,
        options.onProgress
      );
    publishScannerCheckProgress(
      sessionKey,
      {
        branch: "checking",
        phase: "cache-read",
        progress: 0,
        phaseProgress: 0
      }
    );
    scannerCheckGeneration = sessionKey;
    scannerCheckMismatchSessionKey = "";
    const pending = Promise.resolve().then(async () => {
      const builderWork =
        options.silent === true &&
        options.showWork !== true
          ? null
          : window.RMLBuilderWork;
      let catalogUpdateWork = 0;
      let factoryActivated = false;
      let cacheWriteFailed = false;
      try {
        assertSession();
        const scannerHealth = session.health;

        const fingerprintContract = scannerFingerprintContract(scannerHealth);
        const legacyFingerprint = legacyScannerFingerprint(scannerHealth);
        if (
          scannerHealth?.catalogReady !== true ||
          scannerHealth?.catalogAvailable !== true
        ) {
          const existing =
            statusCatalog() ||
            cachedCatalogStatus ||
            cachedCatalogRecord?.catalog ||
            null;
          lastScannerFingerprintSync =
            Object.freeze({
              liveReached: false,
              fingerprintMatchedCache: false,
              cacheUpdatedFromLive: false,
              cacheFallback: Boolean(existing),
              fingerprint: String(
                catalogIdentity(existing) || ""
              ),
              deferredDemandOnly: true,
              error: ""
            });
          document.documentElement.dataset
            .rmlCatalogSyncError = "";
          catalogAvailabilityKnown = true;
          catalogAvailable = Boolean(existing);
          updateStatus();
          publishScannerCheckProgress(
            sessionKey,
            {
              branch: "fallback",
              phase: "catalog-unavailable",
              progress: 1,
              phaseProgress: 1,
              cacheAvailable:
                Boolean(existing)
            }
          );
          return Boolean(existing);
        }
        const catalogFetchUrl =
          session.catalogFetchUrl ||
          `${session.scannerBaseUrl}/resonite_api_catalog.json`;
        const live = { health: scannerHealth,
          fingerprint: fingerprintContract?.fingerprint || legacyFingerprint,
          legacy: !fingerprintContract,
          url: catalogFetchUrl,
          catalogFetchUrl,
          signal };
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

        if (!fingerprintMatchedCache) {
          publishScannerCheckProgress(
            sessionKey,
            {
              branch: "demand-stream",
              phase: "fingerprint-mismatch",
              progress: 0.02,
              phaseProgress: 1
            }
          );
          scannerCheckMismatchSessionKey =
            sessionKey;
          ensureScannerCheckWork(
            {
              ...options,
            },
            sessionKey
          );
          updateScannerCheckWork({
            title:
              window.RMLI18n.t("ui.auto.864578600d79"),
            message:
              window.RMLI18n.t("ui.auto.ef5bac1920fc"),
            progress: 5
          });
          notifyCatalogGate(
            options.onCatalogRefresh,
            {
              phase:
                "catalog-demand-stream",
              message:
                "The API catalog is being updated in bounded demand records."
            }
          );
          document.documentElement.dataset
            .rmlCatalogDemandOnly = "true";
          const demandUrl =
            session.catalogDemandFetchUrl ||
            session.catalogDemandProxyUrl ||
            `${session.scannerBaseUrl}/catalog/demand-v1`;
          await awaitCatalogSettlement(
            ingestCatalogDemandStream(
              demandUrl,
              {
                expectedFingerprint:
                  live.fingerprint,
                expectedRecordCount:
                  Number(
                    scannerHealth
                      ?.catalogDemandRecordCount
                  ) || 0,
                sourceUrl: live.url,
                signal,
                onProgress: progress => {
                  const phaseProgress =
                    Math.max(
                      0,
                      Math.min(
                        1,
                        Number(
                          progress?.progress
                        ) || 0
                      )
                    );
                  const weightedProgress =
                    scannerDemandRecordProgress(
                      phaseProgress
                    );
                  const ownerCount = Math.max(
                    0,
                    Number(
                      progress?.ownerCount
                    ) || 0
                  );
                  const totalOwnerCount = Math.max(
                    ownerCount,
                    Number(
                      progress?.totalOwnerCount
                    ) || 0
                  );
                  updateScannerCheckWork({
                    progress:
                      2 +
                      weightedProgress * 96,
                    detail: totalOwnerCount > 0
                      ? `${ownerCount.toLocaleString()} / ${totalOwnerCount.toLocaleString()} catalog owners · ${Math.max(0, Number(progress?.recordCount) || 0).toLocaleString()} records processed`
                      : undefined
                  });
                  publishScannerCheckProgress(
                    sessionKey,
                    {
                      branch:
                        "demand-stream",
                      phase:
                        "catalog-records",
                      progress:
                        weightedProgress,
                      phaseProgress,
                      completed:
                        Number(
                          progress?.recordCount
                        ) || ownerCount,
                      total:
                        Number(
                          progress
                            ?.totalRecordCount
                        ) ||
                        totalOwnerCount,
                      unit:
                        Number(
                          progress
                            ?.totalRecordCount
                        ) > 0
                          ? "records"
                          : "owners",
                      ownerCount,
                      totalOwnerCount,
                      recordCount:
                        Number(
                          progress?.recordCount
                        ) || 0,
                      totalRecordCount:
                        Number(
                          progress
                            ?.totalRecordCount
                        ) || 0,
                      totalBytes:
                        Number(
                          progress?.totalBytes
                        ) || 0,
                      flushedBatchCount:
                        Number(
                          progress
                            ?.flushedBatchCount
                        ) || 0,
                      transactionCount:
                        Number(
                          progress
                            ?.transactionCount
                        ) || 0,
                      ownerChunkCount:
                        Number(
                          progress
                            ?.ownerChunkCount
                        ) || 0,
                      paletteShardCount:
                        Number(
                          progress
                            ?.paletteShardCount
                        ) || 0
                    }
                  );
                }
              }
            ),
            signal,
            "The scanner catalog demand-stream ingestion"
          );
          updateScannerCheckWork({
            title:
              window.RMLI18n.t("ui.auto.c6e763c4d979"),
            progress: 97
          });
          publishScannerCheckProgress(
            sessionKey,
            {
              branch: "demand-stream",
              phase: "stream-committed",
              progress: 0.99,
              phaseProgress: 1
            }
          );
          assertSession();
          let database;
          let streamed;
          try {
            database = await awaitCatalogSettlement(
              openCatalogCache(),
              signal,
              "The verified catalog cache reopen"
            );
            streamed =
              await awaitCatalogSettlement(
                verifiedCatalogStreamDemandRecord(
                  database
                ),
                signal,
                "The streamed catalog cache verification"
              );
          } finally {
            database?.close?.();
          }
          const streamedFingerprint = String(
            streamed?.fingerprint || ""
          ).trim().toLowerCase();
          if (
            !streamed?.catalog ||
            !streamedFingerprint ||
            (
              live.fingerprint &&
              streamedFingerprint !==
                String(live.fingerprint || "")
                  .trim().toLowerCase()
            )
          ) {
            throw new Error(
              "The newly streamed catalog generation could not be reopened atomically."
            );
          }
          if (!live.fingerprint) {
            live.fingerprint =
              streamedFingerprint;
          }
          publishScannerCheckProgress(
            sessionKey,
            {
              branch: "demand-stream",
              phase: "cache-verified",
              progress: 0.992,
              phaseProgress: 1
            }
          );
          const confirmedCatalog =
            normalizeCatalog(
              streamed.catalog,
              "scanner-cache",
              live.url
            );
          updateScannerCheckWork({
            title:
              window.RMLI18n.t("ui.auto.b3eedfd6c481"),
            message:
              window.RMLI18n.t("ui.auto.aeb3813489d0"),
            progress: 99
          });
          publishScannerCheckProgress(
            sessionKey,
            {
              branch: "demand-stream",
              phase: "factory-activation",
              progress: 0.995,
              phaseProgress: 0
            }
          );
          await awaitCatalogSettlement(
            activateCatalogAndFactory(
              confirmedCatalog,
              { signal }
            ),
            signal,
            "The streamed catalog factory activation"
          );
          factoryActivated = true;
          publishScannerCheckProgress(
            sessionKey,
            {
              branch: "demand-stream",
              phase: "factory-activated",
              progress: 0.998,
              phaseProgress: 1
            }
          );
          promoteFactoryReportForCatalog(
            confirmedCatalog,
            {
              liveFingerprintVerified: true
            }
          );
          cachedCatalogRecord = streamed;
          cachedCatalogReadPromise =
            Promise.resolve(streamed);
          cachedCatalogStatus =
            confirmedCatalog;
          catalogAvailabilityKnown = true;
          catalogAvailable = true;
          lastScannerFingerprintSync =
            Object.freeze({
              liveReached: true,
              fingerprintMatchedCache: true,
              cacheUpdatedFromLive: true,
              cacheFallback: false,
              fingerprint: String(
                live.fingerprint || ""
              ),
              deferredDemandOnly: false,
              error: ""
            });
          document.documentElement.dataset
            .rmlCatalogFingerprintMatchedCache =
              "true";
          document.documentElement.dataset
            .rmlCatalogCacheUpdatedFromLive =
              "true";
          document.documentElement.dataset
            .rmlCatalogDemandOnly = "false";
          document.documentElement.dataset
            .rmlCatalogSyncError = "";
          updateStatus();
          updateScannerCheckWork({
            title:
              window.RMLI18n.t("ui.auto.135b2e3c04b9"),
            message:
              window.RMLI18n.t("ui.literal.d34172e03925"),
            progress: 100
          });
          rememberScannerCatalogUrl(
            live.url
          );
          scannerCheckRejectedSessionKey = "";
          publishScannerCheckProgress(
            sessionKey,
            {
              branch: "demand-stream",
              phase: "complete",
              progress: 1,
              phaseProgress: 1
            }
          );
          return true;
        }

        document.documentElement.dataset
          .rmlCatalogDemandOnly = "false";
        publishScannerCheckProgress(
          sessionKey,
          {
            branch: "cache-match",
            phase: "verified-cache-match",
            progress: 0.2,
            phaseProgress: 1
          }
        );
        await yieldCatalogCacheWork();
        publishScannerCheckProgress(
          sessionKey,
          {
            branch: "cache-match",
            phase: "fingerprint-match",
            progress: 0.4,
            phaseProgress: 1
          }
        );
        notifyCatalogGate(
          options.onFingerprintMatch,
          {
            phase: "fingerprint-match-cache",
            message:
            window.RMLI18n.t("ui.literal.2e85f456b4d4")
          }
        );
        await yieldCatalogCacheWork();
        assertSession();
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
                cached.catalog,
                "scanner-cache",
                live.url
              );

        notifyCatalogGate(
          options.onFactoryActivation,
          {
            phase: "factory",
            message:
              window.RMLI18n.t("ui.literal.254549ea6ed6")
          }
        );
        publishScannerCheckProgress(
          sessionKey,
          {
            branch: "cache-match",
            phase: "factory-activation",
            progress: 0.55,
            phaseProgress: 0
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
        await awaitCatalogSettlement(
          activateCatalogAndFactory(
            confirmedCatalog,
            { signal }
          ),
          signal,
          "The cached catalog factory activation"
        );
        factoryActivated = true;
        publishScannerCheckProgress(
          sessionKey,
          {
            branch: "cache-match",
            phase: "factory-activated",
            progress: 0.97,
            phaseProgress: 1
          }
        );
        promoteFactoryReportForCatalog(
          confirmedCatalog,
          {
            liveFingerprintVerified: true
          }
        );
        builderWork?.update?.(
          catalogUpdateWork,
          {
            title: window.RMLI18n.t("ui.auto.135b2e3c04b9"),
            message:
              window.RMLI18n.t("ui.literal.d34172e03925"),
            progress: 100
          }
        );
        await builderWork?.paint?.();

        lastScannerFingerprintSync =
          Object.freeze({
            liveReached: true,
            fingerprintMatchedCache: true,
            cacheUpdatedFromLive: false,
            cacheFallback: false,
            fingerprint:
              catalogIdentity(
                confirmedCatalog
              ),
            deferredDemandOnly: false,
            error: ""
          });
        document.documentElement.dataset
          .rmlCatalogFingerprintMatchedCache =
            "true";
        document.documentElement.dataset
          .rmlCatalogCacheUpdatedFromLive =
            "false";
        document.documentElement.dataset
          .rmlCatalogSyncError = "";

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
        scannerCheckRejectedSessionKey = "";

        publishScannerCheckProgress(
          sessionKey,
          {
            branch: "cache-match",
            phase: "complete",
            progress: 1,
            phaseProgress: 1
          }
        );

        return true;
      } catch (error) {
        const storageCapacityFailed =
          catalogCacheCapacityFailure(
            error
          );
        if (
          !factoryActivated &&
          scannerCheckGeneration === sessionKey
        ) {
          scannerCheckRejectedSessionKey =
            sessionKey;
        }
        if (sessionIsCurrent()) {
          const message =
            error?.message || String(error);
          const fallbackCatalog =
            statusCatalog() ||
            cachedCatalogStatus ||
            cachedCatalogRecord?.catalog ||
            null;
          if (
            !cachedCatalogStatus &&
            fallbackCatalog
          ) {
            cachedCatalogStatus =
              fallbackCatalog;
          }
          console.error(
            storageCapacityFailed
              ? "[RML BUILDER INTERNAL FAILURE] The browser catalog cache has no writable space. The previously verified cache was preserved and this operation was not retried."
              : "[RML BUILDER INTERNAL FAILURE] The scanner selected by the health sweep could not complete catalog synchronization.",
            error
          );
          lastScannerFingerprintSync = Object.freeze({ liveReached: factoryActivated,
            fingerprintMatchedCache: false, cacheUpdatedFromLive: false,
            cacheFallback: Boolean(fallbackCatalog), fingerprint: factoryActivated
              ? String(statusCatalog()?.catalogFingerprint || "")
              : String(
                  catalogIdentity(
                    fallbackCatalog
                  ) ||
                  cachedCatalogRecord?.fingerprint ||
                  ""
                ),
            error: message });
          document.documentElement.dataset
            .rmlCatalogSyncError = message;
          if (!factoryActivated) {
            demoteLiveFactoryReport();
            if (!builderProxySession) {
              window.RMLRuntimeBridge?.disconnect?.(
                window.RMLI18n.t("ui.literal.6eb076a442fc")
              );
            }
          }
          catalogAvailabilityKnown = true;
          catalogAvailable =
            Boolean(fallbackCatalog);
          updateStatus();
          if (options.silent !== true) {
            window.RMLScheduleTask(() => {
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
        }
        if (
          options.throwOnFailure === true &&
          !factoryActivated
        ) {
          publishScannerCheckProgress(
            sessionKey,
            {
              branch: "fallback",
              phase: "failed",
              progress: 1,
              phaseProgress: 1,
              success: false
            }
          );
          throw error;
        }
        publishScannerCheckProgress(
          sessionKey,
          {
            branch: "fallback",
            phase: factoryActivated
              ? "factory-preserved"
              : "cache-fallback",
            progress: 1,
            phaseProgress: 1,
            success: factoryActivated
          }
        );
        return factoryActivated;
      } finally {
        if (catalogUpdateWork) {
          builderWork?.finish?.(
            catalogUpdateWork
          );
        }
        if (scannerCheckGeneration === sessionKey) {
          const terminalCatalog =
            statusCatalog() ||
            cachedCatalogStatus ||
            cachedCatalogRecord?.catalog ||
            null;
          const progressChannel =
            scannerCheckProgressChannels.get(
              sessionKey
            );
          const terminalPhases = new Set([
            "complete",
            "failed",
            "cache-fallback",
            "factory-preserved",
            "catalog-unavailable",
            "latched-failure",
            "unavailable",
            "stale-session"
          ]);
          const currentPhase = String(
            progressChannel?.snapshot?.phase ||
            ""
          );
          const operationWasCancelled =
            signal?.aborted === true ||
            !sessionIsCurrent();

          if (!terminalPhases.has(currentPhase)) {
            const terminalError = String(
              document.documentElement.dataset
                .rmlCatalogSyncError ||
              (operationWasCancelled
                ? "Catalog synchronization was cancelled before completion."
                : "Catalog synchronization ended without a terminal result.")
            );
            catalogAvailabilityKnown = true;
            catalogAvailable =
              Boolean(terminalCatalog);
            if (!factoryActivated) {
              demoteLiveFactoryReport();
            }
            document.documentElement.dataset
              .rmlCatalogSyncError =
                terminalError;
            publishScannerCheckProgress(
              sessionKey,
              {
                branch: "fallback",
                phase: operationWasCancelled
                  ? "cancelled"
                  : terminalCatalog
                    ? "cache-fallback"
                    : "failed",
                progress: 1,
                phaseProgress: 1,
                success: false,
                cacheAvailable:
                  Boolean(terminalCatalog),
                error: terminalError
              }
            );
          }

          const statusElement =
            document.getElementById(
              "api-catalog-state"
            );
          if (statusElement) {
            statusElement.setAttribute(
              "aria-busy",
              "false"
            );
            if (
              statusElement.dataset.source ===
              "updating"
            ) {
              statusElement.dataset.source =
                terminalCatalog
                  ? "cache"
                  : "unavailable";
            }
          }

          scannerCheckPromise = null;
          scannerCheckMismatchSessionKey = "";
          if (
            scannerCheckAbortController ===
            checkController
          ) {
            scannerCheckAbortController = null;
          }
          await finishScannerCheckWork(
            factoryActivated
          );
          updateStatus();
        }
        externalSignal?.removeEventListener?.(
          "abort",
          abortCheck
        );
      }
    });
    scannerCheckPromise = pending;
    return pending.finally(
      unsubscribeProgress
    );
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
    const replacementOwnerRequirements =
      options?.hydrateReplacementOwners === true
        ? normalizedRequiredApiNodes({
            requiredNodes:
              Array.isArray(
                options?.replacementNodes
              )
                ? options.replacementNodes
                : demandRequirements
          }).filter(requirement =>
            requirement.catalogScope === "api"
          )
        : [];
    notifyCatalogGate(
      options.onContractResolution,
      {
        phase: "demand-requirements",
        progress: 0.15,
        completed:
          demandRequirements.length,
        total:
          demandRequirements.length
      }
    );
    await ensureCatalogDemandOperators(
      demandRequirements.map(
        requirement =>
          requirement.operatorId
      ),
      {
        allowFullFallback: false,
        ephemeral:
          options?.hydrateReplacementOwners ===
            true,
        hydratePortableOwners:
          options?.hydrateReplacementOwners ===
            true,
        completePortableOwners: new Set(
          replacementOwnerRequirements
            .map(requirement =>
              String(
                requirement.apiContract
                  ?.ownerType || ""
              )
            )
            .filter(Boolean)
        ),
        portableOwners: new Map(
          demandRequirements
            .map(requirement => [
              String(
                requirement.operatorId || ""
              ),
              String(
                requirement.apiContract
                  ?.ownerType || ""
              )
            ])
            .filter(([, owner]) =>
              Boolean(owner)
            )
        )
      }
    );
    notifyCatalogGate(
      options.onContractResolution,
      {
        phase: "demand-hydration",
        progress: 0.3,
        completed:
          demandRequirements.length,
        total:
          demandRequirements.length
      }
    );
    const catalog = statusCatalog();
    notifyCatalogGate(
      options.onContractResolution,
      {
        phase: "catalog-snapshot",
        progress: 0.35,
        completed: catalog ? 1 : 0,
        total: 1
      }
    );
    const report =
      window.RMLApiNodeFactoryReport;
    const factoryReady = Boolean(
      catalog &&
      factoryMatchesCatalog(
        catalog,
        report
      )
    );
    notifyCatalogGate(
      options.onContractResolution,
      {
        phase: "factory-snapshot",
        progress: 0.4,
        completed: factoryReady ? 1 : 0,
        total: 1
      }
    );
    const live = Boolean(
      factoryReady &&
      report?.liveCatalogVerified === true &&
      String(
        report?.catalogFingerprint || ""
      ) === String(
        catalog?.catalogFingerprint || ""
      )
    );

    if (!factoryReady) {
      return Object.freeze({
        available: false,
        live: false,
        cacheFallback: true,
        liveAttempted: false,
        source: "unavailable",
        catalogFingerprint: "",
        engineVersion: ""
      });
    }

    return Object.freeze({
      available: true,
      live,
      cacheFallback: !live,
      catalogBackedByCache: true,
      liveAttempted: false,
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
          .fingerprintMatchedCache === true,
      cacheUpdatedFromLive:
        lastScannerFingerprintSync
          .cacheUpdatedFromLive === true
    });
  }

  function ensureCatalogForExportWithActivation(
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
      ),
      {
        portableOwners: new Map(
          requiredNodes
            .map(requirement => [
              String(
                requirement.operatorId || ""
              ),
              String(
                requirement.apiContract
                  ?.ownerType || ""
              )
            ])
            .filter(([, owner]) =>
              Boolean(owner)
            )
        )
      }
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

          await activateCatalogAndFactoryNow(
            catalog
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

  function ensureCatalogForExport(
    options = {}
  ) {
    const requiredNodes =
      normalizedRequiredApiNodes(options)
        .filter(requirement =>
          requirement.catalogScope ===
            "api"
        );
    const catalog = statusCatalog();
    const report =
      window.RMLApiNodeFactoryReport;

    if (!catalog) {
      return Promise.resolve(
        Object.freeze({
          required:
            requiredNodes.length > 0,
          verified: false,
          available: false,
          rebuilt: false,
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
          engineVersion: "",
          catalogSnapshot: null,
          factoryReport: null
        })
      );
    }

    const integrity =
      factoryRegistryIntegrity(
        catalog,
        report,
        requiredNodes
      );
    const factoryReady =
      factoryMatchesCatalog(
        catalog,
        report
      );
    const missing = factoryReady
      ? missingRequiredApiNodes(
          requiredNodes,
          catalog,
          report
        )
      : unresolvedRequiredApiNodes(
          requiredNodes,
          "the frozen catalog factory publication is incomplete"
        );
    const verified = Boolean(
      factoryReady &&
      integrity.valid === true &&
      missing.length === 0
    );

    return Promise.resolve(
      Object.freeze({
        required:
          requiredNodes.length > 0,
        verified,
        available: verified,
        rebuilt: false,
        unresolved: missing.length,
        unresolvedRequirements:
          Object.freeze(missing),
        failureLabels: Object.freeze(
          missing.map(
            requiredApiNodeFailureLabel
          )
        ),
        catalogFingerprint: String(
          catalog.catalogFingerprint || ""
        ),
        engineVersion: String(
          catalog.engineVersion || ""
        ),
        catalogSnapshot: catalog,
        factoryReport: report
      })
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
        phase: "replacement-catalog",
        progress: 0.45,
        completed:
          replacementCatalog?.available === true
            ? 1
            : 0,
        total: 1
      }
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
        progress: 0.5
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
          progress: 0.55
        }
      );
      collectMigrations(
        await reconcileLegacyRequiredApiNodes(
          scannerResolvableNodes,
          catalog
        )
      );
      notifyCatalogGate(
        options.onContractResolution,
        {
          phase: "legacy-contracts-resolved",
          progress: 0.7,
          completed:
            scannerResolvableNodes.length,
          total:
            scannerResolvableNodes.length
        }
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
        liveFallbackAttempted:
          lastScannerFingerprintSync.liveReached === true,
        liveAttempted:
          document.documentElement.dataset
            .rmlCatalogProxyState === "available",
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
      liveFallbackAttempted:
        lastScannerFingerprintSync.liveReached === true,
      liveAttempted:
        document.documentElement.dataset
          .rmlCatalogProxyState === "available",
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

  async function synchronizeAvailableCatalog(
    options = {}
  ) {
    notifyCatalogGate(
      options.onProgress,
      {
        version: 1,
        sessionKey: "",
        branch: "checking",
        phase: "health-sweep",
        progress: 0,
        phaseProgress: 0
      }
    );
    const proxySession =
      await discoverBuilderCatalogSession(
        options.signal || null
      );

    if (proxySession) {
      const selectedScannerSession =
        Object.freeze({
          port: proxySession.port,
          scannerBaseUrl:
            proxySession.scannerBaseUrl,
          health: proxySession.health,
          fingerprint: String(
            scannerFingerprintContract(
              proxySession.health
            )?.fingerprint ||
            legacyScannerFingerprint(
              proxySession.health
            ) ||
            ""
          ),
          trigger:
            options.trigger === "import"
              ? "import"
              : "button"
        });
      window.RMLScannerHealthSession =
        selectedScannerSession;
      document.dispatchEvent(
        new CustomEvent(
          "rml-scanner:selected",
          {
            detail:
              selectedScannerSession
          }
        )
      );
      activeBuilderCatalogSessionKey =
        catalogSessionKey(proxySession);
      document.documentElement.dataset
        .rmlCatalogProxyState = "available";
      document.documentElement.dataset
        .rmlCatalogProxyFingerprint =
          String(
            scannerFingerprintContract(
              proxySession.health
            )?.fingerprint ||
            legacyScannerFingerprint(
              proxySession.health
            ) ||
            ""
          );
      return synchronizeScannerStatus({
        ...options,
        session: proxySession,
        silent: true,
        throwOnFailure: false
      });
    }

    activeBuilderCatalogSessionKey = "";
    window.RMLScannerHealthSession = null;
    document.dispatchEvent(
      new CustomEvent(
        "rml-scanner:unavailable",
        {
          detail: Object.freeze({
            trigger:
              options.trigger === "import"
                ? "import"
                : "button"
          })
        }
      )
    );
    scannerCheckAbortController?.abort();
    document.documentElement.dataset
      .rmlCatalogProxyState = "unavailable";
    document.documentElement.dataset
      .rmlCatalogProxyFingerprint = "";

    const existing =
      statusCatalog() ||
      cachedCatalogRecord?.catalog ||
      cachedCatalogStatus ||
      null;
    if (
      !cachedCatalogStatus &&
      existing
    ) {
      cachedCatalogStatus = existing;
    }
    catalogAvailabilityKnown = true;
    catalogAvailable = Boolean(existing);
    if (existing) {
      updateStatus();
    } else {
      updateUnavailableStatus();
    }
    notifyCatalogGate(
      options.onProgress,
      {
        version: 1,
        sessionKey: "",
        branch: "fallback",
        phase: "health-unavailable",
        progress: 1,
        phaseProgress: 1,
        cacheAvailable:
          Boolean(existing)
      }
    );
    return false;
  }

  window.addEventListener("rml-api-node-factory-ready", updateStatus);
  window.addEventListener("rml-scanner-connection", updateStatus);
  window.addEventListener("rml-runtime-readiness", updateStatus);

  Object.defineProperty(
    window,
    "RMLCatalogDemandCache",
    {
      value: Object.freeze({
        version: 1,
        getPaletteIndex() {
          return catalogDemandPaletteIndex();
        },
        getPaletteSummary:
          catalogDemandPaletteSummary,
        queryPalette:
          catalogDemandQueryPalette,
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

      if (statusCatalog()) {
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
        catalogProxyPath:
          BUILDER_SCANNER_CATALOG_PATH,
        demandProxyPath:
          BUILDER_SCANNER_DEMAND_PATH
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
        version: 14,
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
          ensureCatalogForExportWithActivation,
        synchronizeLive(options = {}) {
          return synchronizeAvailableCatalog(
            options
          );
        },
        refreshStatus() {
          updateStatus();
          return String(
            document.getElementById(
              "api-catalog-state"
            )?.dataset?.source || ""
          );
        }
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
