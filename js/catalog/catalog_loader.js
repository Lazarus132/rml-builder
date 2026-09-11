(() => {
  "use strict";
  // RML Builder catalog: catalog_loader.

  const CATALOG_LOADER_MODULE_ID =
    "1.20.31-universal-presentation-dev27";
  const LOADER_VERSION = 84;
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
  const REQUIRED_SCANNER_VERSION =
    "1.11.1";
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
  const REQUIRED_API_FACTORY_VERSION = 38;
  const REQUIRED_API_VERIFICATION_SCHEMA_VERSION = 3;

  const scriptUrl =
    document.currentScript?.src ||
    window.location.href;
  const modNodesUrl = new URL(
    "mod_nodes.js?v=794-shared-loader-runtime",
    scriptUrl
  ).href;
  const visualCSharpUrl = new URL(
    "../compiler/visual_csharp.js?v=83-empty-custom-csharp-ignored",
    scriptUrl
  ).href;
  const apiNodesUrl = new URL(
    "api_nodes.js?v=1.20.31-universal-presentation-dev27",
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
      contract.scannerVersion ===
        REQUIRED_SCANNER_VERSION &&
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
        "SHA-256 is unavailable for catalog cache verification."
      );
    }

    let payload = JSON.stringify(raw);
    if (typeof payload !== "string") {
      throw new Error(
        "Catalog cache payload is not JSON serializable."
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
            "Catalog cache values must be finite JSON numbers."
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
          "Catalog cache values must be JSON serializable."
        );
      }
      if (depth > CACHE_CHUNK_MAX_DEPTH) {
        throw new Error(
          `Catalog cache values may not be nested more than ${CACHE_CHUNK_MAX_DEPTH} levels.`
        );
      }
      if (ancestors.has(current)) {
        throw new TypeError(
          "Catalog cache values may not contain cycles."
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
              "Catalog cache arrays must be dense JSON arrays without named properties."
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
            "Catalog cache objects must be plain JSON objects."
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
        "SHA-256 is unavailable for catalog cache verification."
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
        setTimeout(resolve, 0);
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

    const pending = [value];
    while (pending.length > 0) {
      const current = pending.pop();
      if (
        !current ||
        typeof current !== "object" ||
        Object.isFrozen(current)
      ) {
        continue;
      }

      Object.freeze(current);
      for (const child of
        Object.values(current)) {
        if (
          child &&
          typeof child === "object" &&
          !Object.isFrozen(child)
        ) {
          pending.push(child);
        }
      }
    }

    return value;
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
  let cachedCatalogReadPromise = null;
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



  function updateStatus() { window.RMLRuntimeBridge?.renderStatus?.(); }
  function updateUnavailableStatus() { updateStatus(); }

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
              "Cached catalog data could not be read."
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
              "Live catalog data could not be cached."
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
              "Catalog cache manifest could not be committed."
            )
          );
        transaction.onabort =
          () => reject(
            transaction.error ||
            new Error(
              "Catalog cache manifest commit was aborted."
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
              "Obsolete catalog cache chunks could not be removed."
            )
          );
        transaction.onabort =
          () => reject(
            transaction.error ||
            new Error(
              "Catalog cache cleanup was aborted."
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
        const manifestRequest = store.get(
          CACHE_ACTIVE_RECORD_KEY
        );
        const chunkRequest = store.get(
          catalogCacheChunkId(
            manifest.generation,
            index
          )
        );
        let manifestDone = false;
        let chunkDone = false;
        const finish = () => {
          if (!manifestDone || !chunkDone) {
            return;
          }
          const active =
            manifestRequest.result;
          if (
            Number(active?.schemaVersion) !==
              CACHE_CHUNK_RECORD_SCHEMA_VERSION ||
            String(active?.generation || "") !==
              manifest.generation ||
            String(active?.contentHash || "") !==
              manifest.contentHash
          ) {
            const error = new Error(
              "The active catalog cache generation changed while it was being read."
            );
            error.code =
              "RML_CATALOG_CACHE_GENERATION_CHANGED";
            reject(error);
            return;
          }
          resolve(chunkRequest.result || null);
        };
        manifestRequest.onsuccess = () => {
          manifestDone = true;
          finish();
        };
        chunkRequest.onsuccess = () => {
          chunkDone = true;
          finish();
        };
        const fail = request =>
          reject(
            request.error ||
            new Error(
              "A catalog cache chunk could not be read."
            )
          );
        manifestRequest.onerror = () =>
          fail(manifestRequest);
        chunkRequest.onerror = () =>
          fail(chunkRequest);
      }
    );
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
        "An oversized catalog cache entry cannot be structurally chunked."
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
        "Catalog cache arrays must be dense JSON arrays without named properties."
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
          "A catalog cache object key exceeds the 64 KiB metadata limit."
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
        "Catalog cache structure is invalid."
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
        "Catalog cache array length is invalid."
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
            "Catalog cache child ordering is invalid."
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
          "Catalog cache segment type is invalid."
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
          "Catalog cache contains a missing or duplicate chunk reference."
        );
      }
      const expected =
        context.manifest.chunks[index];
      if (
        expected.kind !==
          (isArray ? "array" : "object")
      ) {
        throw new Error(
          "Catalog cache chunk kind is invalid."
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
          "Catalog cache chunk metadata is invalid."
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
          "Catalog cache chunk integrity verification failed."
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
            "Catalog cache array chunk ordering is invalid."
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
            "Catalog cache object chunk keys are invalid."
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
              "Catalog cache object chunk contains duplicate or mismatched keys."
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
        "Catalog cache array is incomplete."
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
            "Another catalog cache generation is still being written."
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
        console.debug(
          "Committed catalog staging metadata could not be removed.",
          cleanupError
        );
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
          console.debug(
            "The previous catalog cache generation could not be removed.",
            cleanupError
          );
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
          console.debug(
            "Incomplete catalog cache generation cleanup failed.",
            cleanupError
          );
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
      console.debug(
        "The verified legacy catalog cache could not be migrated to chunks.",
        error
      );



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
          const current =
            await verifiedCurrentCacheRecord(
              database,
              stored
            );
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
      console.debug(
        "No cached live Resonite API catalog is available.",
        error
      );
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
    sourceUrl
  ) {
    let database;
    const fingerprint =
      scannerCatalogFingerprint(raw);

    if (
      !fingerprint ||
      !strictCachedScannerContract(raw)
    ) {
      throw new Error(
        "Live scanner catalog does not satisfy the current cache contract."
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
      const stored = Object.freeze({
        ...manifest,
        catalog: catalogSnapshot
      });
      cachedCatalogRecord = stored;
      cachedCatalogReadPromise =
        Promise.resolve(stored);
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


      return normalizeCatalog(
        cached.catalog,
        "scanner-cache",
        cached.sourceUrl || ""
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
          "The verified API factory report could not be republished with its prepared graph-codegen projection index."
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
    window.dispatchEvent(
      new CustomEvent(
        "rml-api-node-factory-ready",
        { detail: nextReport }
      )
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
    return Boolean(
      left &&
      right &&
      catalogIdentity(left) &&
      catalogIdentity(left) ===
        catalogIdentity(right) &&
      String(left.engineVersion || "") ===
        String(right.engineVersion || "")
    );
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
        "The active API catalog and its verified node factory did not commit the same fingerprint and engine version."
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
        "The API node factory cannot activate the selected catalog fingerprint."
      );
    }

    await controller.rebuild(
      catalog,
      {
        createCatalogPublication
      }
    );
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
    window.dispatchEvent(new CustomEvent("rml-api-node-factory-ready", { detail: next }));
  }

  async function synchronizeScannerStatus(options = {}) {
    const session = currentScannerConnection();


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
          "The API factory registry publication could not be verified.",
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
      console.debug(
        "The catalog progress callback failed.",
        error
      );
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

  function ensureCatalogForExport(
    options = {}
  ) {
    const requiredNodes =
      normalizedRequiredApiNodes(options)
        .filter(requirement =>
          requirement.catalogScope ===
            "api"
        );

    return queueCatalogActivationOperation(
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
                "No verified cached API catalog is available."
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
              "The active API catalog changed before export registry repair could start. Export was not prepared."
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
              "The API node factory cannot repair the registry required by this export."
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
            "The active API catalog changed while the export registry was being verified. Export was not prepared."
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
          "Checking required catalog contracts…",
        message:
          `Checking ${requiredNodes.length} catalog contract famil${requiredNodes.length === 1 ? "y" : "ies"}; only instances with the same portable contract and parameters share a result.`,
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

  function synchronizeConnectedSession(connection = currentScannerConnection()) {
    if (connection.mode === "live") {


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
          await activateCatalogAndFactory(
            catalog
          );
        } else {
          console.info(
            "RML API catalog nodes are unavailable until a live or cached catalog is available. Stored API contracts remain editable in offline-preservation mode."
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
