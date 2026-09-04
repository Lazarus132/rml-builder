"use strict";

const DEFAULT_PROJECT_MAX_BYTES =
  512 * 1024 * 1024;
const GZIP_MAGIC_FIRST = 0x1f;
const GZIP_MAGIC_SECOND = 0x8b;

function projectGzipFallbackCodec() {
  if (
    typeof self.RMLGzipCodec?.decompress ===
      "function" &&
    typeof self.RMLGzipCodec?.compress ===
      "function"
  ) {
    return self.RMLGzipCodec;
  }
  if (typeof importScripts !== "function") {
    throw new Error(
      "The built-in GZIP fallback cannot be loaded in this worker."
    );
  }
  importScripts(
    "../core/gzip_codec.js?v=1-own-gzip-fallback-v756"
  );
  if (
    typeof self.RMLGzipCodec?.decompress !==
      "function" ||
    typeof self.RMLGzipCodec?.compress !==
      "function"
  ) {
    throw new Error(
      "The built-in GZIP fallback did not initialize."
    );
  }
  return self.RMLGzipCodec;
}

function projectMaximumBytes(value) {
  const maximum = Number(value);
  return Number.isFinite(maximum) &&
    maximum > 0
    ? Math.floor(maximum)
    : DEFAULT_PROJECT_MAX_BYTES;
}

async function readProjectBlobText(
  blob,
  maximumBytes
) {
  const limit =
    projectMaximumBytes(maximumBytes);
  const header = new Uint8Array(
    await blob.slice(0, 2).arrayBuffer()
  );
  const gzip =
    header.length === 2 &&
    header[0] === GZIP_MAGIC_FIRST &&
    header[1] === GZIP_MAGIC_SECOND;

  if (!gzip) {
    if (blob.size > limit) {
      throw new RangeError(
        "The uncompressed JSON exceeds the configured project limit."
      );
    }
    return {
      text: await blob.text(),
      uncompressedBytes: blob.size,
      compression: "identity"
    };
  }

  if (
    typeof DecompressionStream !==
      "function"
  ) {
    const compressed = new Uint8Array(
      await blob.arrayBuffer()
    );
    const decompressed =
      projectGzipFallbackCodec()
        .decompress(compressed, limit);
    return {
      text: new TextDecoder(
        "utf-8",
        { fatal: true }
      ).decode(decompressed),
      uncompressedBytes:
        decompressed.byteLength,
      compression: "gzip",
      codec: "fallback"
    };
  }

  let stream;
  try {
    stream = blob.stream().pipeThrough(
      new DecompressionStream("gzip")
    );
  } catch (error) {
    throw new Error(
      "The compressed project file could not be opened.",
      { cause: error }
    );
  }

  const reader = stream.getReader();
  const decoder = new TextDecoder(
    "utf-8",
    { fatal: true }
  );
  const parts = [];
  let uncompressedBytes = 0;

  try {
    while (true) {
      const { done, value } =
        await reader.read();
      if (done) {
        break;
      }
      uncompressedBytes +=
        value.byteLength;
      if (uncompressedBytes > limit) {
        await reader.cancel();
        throw new RangeError(
          "The decompressed JSON exceeds the configured project limit."
        );
      }
      parts.push(
        decoder.decode(
          value,
          { stream: true }
        )
      );
    }
    parts.push(decoder.decode());
  } catch (error) {
    if (error instanceof RangeError) {
      throw error;
    }
    try {
      const compressed =
        new Uint8Array(
          await blob.arrayBuffer()
        );
      const decompressed =
        projectGzipFallbackCodec()
          .decompress(compressed, limit);
      return {
        text: new TextDecoder(
          "utf-8",
          { fatal: true }
        ).decode(decompressed),
        uncompressedBytes:
          decompressed.byteLength,
        compression: "gzip",
        codec: "fallback-after-native"
      };
    } catch (fallbackError) {
      throw new Error(
        `The GZIP project data is damaged or incomplete. ${String(fallbackError?.message || "The independent decoder also rejected the data.")}`,
        { cause: error }
      );
    }
  } finally {
    reader.releaseLock();
  }

  return {
    text: parts.join(""),
    uncompressedBytes,
    compression: "gzip"
  };
}

async function compressProjectJson(value) {
  const text = JSON.stringify(value);
  const source = new Blob(
    [text],
    {
      type:
        "application/json;charset=utf-8"
    }
  );
  if (
    typeof CompressionStream !==
      "function"
  ) {
    const compressed =
      projectGzipFallbackCodec()
        .compress(
          new Uint8Array(
            await source.arrayBuffer()
          )
        );
    return {
      buffer: compressed.buffer,
      jsonBytes: source.size,
      compressedBytes:
        compressed.byteLength
    };
  }

  const stream = source.stream().pipeThrough(
    new CompressionStream("gzip")
  );
  const buffer =
    await new Response(stream)
      .arrayBuffer();

  return {
    buffer,
    jsonBytes: source.size,
    compressedBytes: buffer.byteLength
  };
}

function canonicalProjectFingerprintValue(
  value,
  path = []
) {
  if (Array.isArray(value)) {
    return value.map((entry, index) =>
      canonicalProjectFingerprintValue(
        entry,
        [...path, String(index)]
      )
    );
  }

  if (
    value &&
    typeof value === "object"
  ) {
    const result = {};
    for (const key of
      Object.keys(value).sort()) {
      const rootSavedAt =
        path.length === 0 &&
        key === "savedAt";
      const workspacePage =
        path.length === 1 &&
        path[0] === "workspace" &&
        key === "activePage";
      const legacyGraphPage =
        path.length === 2 &&
        path[0] === "extensions" &&
        path[1] === "typedNodeGraph" &&
        key === "lastOpenPage";

      if (
        rootSavedAt ||
        workspacePage ||
        legacyGraphPage
      ) {
        continue;
      }

      result[key] =
        canonicalProjectFingerprintValue(
          value[key],
          [...path, key]
        );
    }
    return result;
  }

  return value;
}

function projectContentFingerprint(value) {
  const text = JSON.stringify(
    canonicalProjectFingerprintValue(
      value
    )
  );
  let first = 2166136261;
  let second = 2246822507;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const code = text.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second ^= code + index;
    second = Math.imul(second, 3266489909);
  }

  return `project-v1-${text.length.toString(36)}-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeProjectId(value) {
  const candidate =
    typeof value === "string"
      ? value.trim()
      : "";
  return /^[a-z0-9][a-z0-9._:-]{7,159}$/i
    .test(candidate)
      ? candidate
      : "";
}

function projectIdFromSource(source) {
  const explicit = normalizeProjectId(
    source?.projectId
  );
  return explicit ||
    `legacy-${projectContentFingerprint(source)}`;
}

function projectIdentityFingerprint(
  projectId
) {
  const text = normalizeProjectId(
    projectId
  );
  let first = 2166136261;
  let second = 2246822507;

  for (
    let index = 0;
    index < text.length;
    index += 1
  ) {
    const code = text.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second ^= code + index;
    second = Math.imul(second, 3266489909);
  }

  return `identity-v1-${text.length.toString(36)}-${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

self.addEventListener("message", event => {
  const request = event.data || {};
  const id = request.id;

  void (async () => {
    try {
      if (request.operation === "parse") {
        const text =
          String(request.text ?? "");
        const value = JSON.parse(text);

        self.postMessage({
          id,
          ok: true,
          value,
          fingerprint:
            projectIdentityFingerprint(
              projectIdFromSource(value)
            )
        });
        return;
      }

      if (request.operation === "parseFile") {
        if (
          !request.file ||
          typeof request.file.text !== "function"
        ) {
          throw new TypeError(
            "The project file is not a readable Blob."
          );
        }

        const decoded =
          await readProjectBlobText(
            request.file,
            request.maximumBytes
          );
        const value =
          JSON.parse(decoded.text);

        self.postMessage({
          id,
          ok: true,
          value,
          uncompressedBytes:
            decoded.uncompressedBytes,
          compressedBytes:
            request.file.size,
          compression:
            decoded.compression,
          fingerprint:
            projectIdentityFingerprint(
              projectIdFromSource(value)
            )
        });
        return;
      }

      if (
        request.operation ===
          "stringifyGzip"
      ) {
        const result =
          await compressProjectJson(
            request.value
          );

        self.postMessage(
          {
            id,
            ok: true,
            buffer: result.buffer,
            jsonBytes: result.jsonBytes,
            compressedBytes:
              result.compressedBytes,
            compression: "gzip"
          },
          [result.buffer]
        );
        return;
      }

      if (request.operation === "stringify") {
        const text = JSON.stringify(
          request.value,
          null,
          Number(request.space) || 0
        );

        self.postMessage({
          id,
          ok: true,
          text
        });
        return;
      }

      throw new Error(
        `Unsupported project I/O operation '${request.operation}'.`
      );
    } catch (error) {
      self.postMessage({
        id,
        ok: false,
        error: {
          name:
            error instanceof Error
              ? error.name
              : "Error",
          message:
            error instanceof Error
              ? error.message
              : String(error)
        }
      });
    }
  })();
});
