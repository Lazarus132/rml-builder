"use strict";

const DEFAULT_PROJECT_MAX_BYTES =
  512 * 1024 * 1024;
const GZIP_MAGIC_FIRST = 0x1f;
const GZIP_MAGIC_SECOND = 0x8b;

// Large draft snapshots arrive as the same bounded token stream used by the
// graph-code-generation transport.  Rebuilding the value in this worker keeps
// the browser's main thread away from one monolithic structured-clone step.
const PROJECT_STREAM_TOKEN = Object.freeze({
  null: 1,
  false: 2,
  true: 3,
  number: 4,
  string: 5,
  array: 6,
  object: 7,
  key: 8,
  end: 9,
  longString: 10,
  stringPart: 11,
  endString: 12,
  longKey: 13,
  keyPart: 14,
  endKey: 15
});
const streamedProjectRequests = new Map();

function projectStreamDecoder() {
  return {
    root: undefined,
    hasRoot: false,
    frames: [],
    longStringParts: null,
    longKeyParts: null
  };
}

function assignProjectStreamValue(decoder, value) {
  const parent =
    decoder.frames[decoder.frames.length - 1];
  if (!parent) {
    if (decoder.hasRoot) {
      throw new Error(
        "Project stream contains more than one root value."
      );
    }
    decoder.root = value;
    decoder.hasRoot = true;
    return;
  }
  if (parent.kind === "array") {
    parent.value.push(value);
    return;
  }
  if (typeof parent.key !== "string") {
    throw new Error(
      "Project stream object value has no key."
    );
  }
  Object.defineProperty(
    parent.value,
    parent.key,
    {
      value,
      writable: true,
      enumerable: true,
      configurable: true
    }
  );
  parent.key = null;
}

function decodeProjectStreamTokens(decoder, tokens) {
  if (
    !Array.isArray(tokens) ||
    tokens.length === 0 ||
    (tokens.length & 1) !== 0
  ) {
    throw new TypeError(
      "Project stream chunks must contain complete token/value pairs."
    );
  }

  for (
    let index = 0;
    index < tokens.length;
    index += 2
  ) {
    const code = tokens[index];
    const value = tokens[index + 1];
    if (code === PROJECT_STREAM_TOKEN.null) {
      assignProjectStreamValue(decoder, null);
    } else if (
      code === PROJECT_STREAM_TOKEN.false ||
      code === PROJECT_STREAM_TOKEN.true
    ) {
      if (value !== (code === PROJECT_STREAM_TOKEN.true)) {
        throw new TypeError(
          "Project stream contains an invalid Boolean token."
        );
      }
      assignProjectStreamValue(decoder, value);
    } else if (code === PROJECT_STREAM_TOKEN.number) {
      if (
        typeof value !== "number" ||
        !Number.isFinite(value)
      ) {
        throw new TypeError(
          "Project stream contains an invalid number token."
        );
      }
      assignProjectStreamValue(decoder, value);
    } else if (code === PROJECT_STREAM_TOKEN.string) {
      if (typeof value !== "string") {
        throw new TypeError(
          "Project stream contains an invalid string token."
        );
      }
      assignProjectStreamValue(decoder, value);
    } else if (
      code === PROJECT_STREAM_TOKEN.array ||
      code === PROJECT_STREAM_TOKEN.object
    ) {
      const container =
        code === PROJECT_STREAM_TOKEN.array
          ? []
          : {};
      assignProjectStreamValue(decoder, container);
      decoder.frames.push({
        kind:
          code === PROJECT_STREAM_TOKEN.array
            ? "array"
            : "object",
        value: container,
        key: null
      });
    } else if (code === PROJECT_STREAM_TOKEN.key) {
      const frame =
        decoder.frames[decoder.frames.length - 1];
      if (
        frame?.kind !== "object" ||
        typeof value !== "string" ||
        typeof frame.key === "string"
      ) {
        throw new Error(
          "Project stream key is outside an available object slot."
        );
      }
      frame.key = value;
    } else if (code === PROJECT_STREAM_TOKEN.end) {
      const frame =
        decoder.frames[decoder.frames.length - 1];
      if (
        !frame ||
        (frame.kind === "object" &&
          typeof frame.key === "string")
      ) {
        throw new Error(
          "Project stream closes an incomplete container."
        );
      }
      decoder.frames.pop();
    } else if (
      code === PROJECT_STREAM_TOKEN.longString
    ) {
      if (decoder.longStringParts !== null) {
        throw new Error(
          "Project stream opened a nested long string."
        );
      }
      decoder.longStringParts = [];
    } else if (
      code === PROJECT_STREAM_TOKEN.stringPart
    ) {
      if (
        decoder.longStringParts === null ||
        typeof value !== "string"
      ) {
        throw new Error(
          "Project stream string part has no open string."
        );
      }
      decoder.longStringParts.push(value);
    } else if (
      code === PROJECT_STREAM_TOKEN.endString
    ) {
      if (decoder.longStringParts === null) {
        throw new Error(
          "Project stream closes no long string."
        );
      }
      assignProjectStreamValue(
        decoder,
        decoder.longStringParts.join("")
      );
      decoder.longStringParts = null;
    } else if (
      code === PROJECT_STREAM_TOKEN.longKey
    ) {
      const frame =
        decoder.frames[decoder.frames.length - 1];
      if (
        decoder.longKeyParts !== null ||
        frame?.kind !== "object" ||
        typeof frame.key === "string"
      ) {
        throw new Error(
          "Project stream long key has no available object slot."
        );
      }
      decoder.longKeyParts = [];
    } else if (
      code === PROJECT_STREAM_TOKEN.keyPart
    ) {
      if (
        decoder.longKeyParts === null ||
        typeof value !== "string"
      ) {
        throw new Error(
          "Project stream key part has no open key."
        );
      }
      decoder.longKeyParts.push(value);
    } else if (
      code === PROJECT_STREAM_TOKEN.endKey
    ) {
      const frame =
        decoder.frames[decoder.frames.length - 1];
      if (
        decoder.longKeyParts === null ||
        frame?.kind !== "object" ||
        typeof frame.key === "string"
      ) {
        throw new Error(
          "Project stream closes no long object key."
        );
      }
      frame.key = decoder.longKeyParts.join("");
      decoder.longKeyParts = null;
    } else {
      throw new Error(
        `Unknown project stream token '${code}'.`
      );
    }
  }
}

function finishProjectStream(decoder) {
  if (
    !decoder?.hasRoot ||
    decoder.frames.length > 0 ||
    decoder.longStringParts !== null ||
    decoder.longKeyParts !== null
  ) {
    throw new Error(
      "Project stream ended before its root value was complete."
    );
  }
  return decoder.root;
}

function postProjectWorkerError(
  id,
  error,
  recoverable = false
) {
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
          : String(error),
      recoverable:
        recoverable === true
    }
  });
}

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
    parts.length = 0;
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

  const text = parts.join("");
  parts.length = 0;
  return {
    text,
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

self.addEventListener("message", event => {
  const request = event.data || {};
  const id = request.id;
  const operation = String(
    request.operation || ""
  );

  if (operation === "streamCancel") {
    streamedProjectRequests.delete(id);
    return;
  }

  if (operation === "streamStart") {
    try {
      if (streamedProjectRequests.has(id)) {
        throw new Error(
          "A project stream with this request ID is already open."
        );
      }
      streamedProjectRequests.set(id, {
        decoder: projectStreamDecoder(),
        maximumBytes:
          projectMaximumBytes(
            request.maximumBytes
          )
      });
    } catch (error) {
      streamedProjectRequests.delete(id);
      postProjectWorkerError(id, error);
    }
    return;
  }

  if (operation === "streamChunk") {
    try {
      const record =
        streamedProjectRequests.get(id);
      if (!record) {
        throw new Error(
          "Project stream chunk has no open request."
        );
      }
      decodeProjectStreamTokens(
        record.decoder,
        request.tokens
      );
    } catch (error) {
      streamedProjectRequests.delete(id);
      postProjectWorkerError(id, error);
    }
    return;
  }

  if (operation === "streamEnd") {
    const record =
      streamedProjectRequests.get(id);
    streamedProjectRequests.delete(id);

    let value;
    try {
      if (!record) {
        throw new Error(
          "Project stream ended without an open request."
        );
      }
      value =
        finishProjectStream(record.decoder);
    } catch (error) {
      postProjectWorkerError(id, error);
      return;
    }

    void (async () => {
      try {
        const result =
          await compressProjectJson(value);
        if (
          result.jsonBytes >
            record.maximumBytes
        ) {
          throw new RangeError(
            "The streamed project JSON exceeds the configured project limit."
          );
        }
        self.postMessage(
          {
            id,
            ok: true,
            buffer: result.buffer,
            jsonBytes: result.jsonBytes,
            compressedBytes:
              result.compressedBytes,
            compression: "gzip",
            transport: "token-stream"
          },
          [result.buffer]
        );
      } catch (error) {
        postProjectWorkerError(
          id,
          error,
          !(error instanceof RangeError)
        );
      }
    })();
    return;
  }

  void (async () => {
    try {
      if (request.operation === "parse") {
        const text =
          String(request.text ?? "");
        const value = JSON.parse(text);

        self.postMessage({
          id,
          ok: true,
          value
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
        const savedCompositeMaximumBytes =
          projectMaximumBytes(
            request.savedCompositeMaximumBytes
          );
        if (
          value &&
          typeof value === "object" &&
          !Array.isArray(value) &&
          !(
            request.projectFormat &&
            value.format ===
              request.projectFormat
          ) &&
          value.schema ===
            request.savedCompositeSchema &&
          decoded.uncompressedBytes >
            savedCompositeMaximumBytes
        ) {
          throw new RangeError(
            "The decompressed Saved API Composite JSON is larger than 32 MiB."
          );
        }

        self.postMessage({
          id,
          ok: true,
          value,
          uncompressedBytes:
            decoded.uncompressedBytes,
          compressedBytes:
            request.file.size,
          compression:
            decoded.compression
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
