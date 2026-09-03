"use strict";

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

        const text =
          await request.file.text();
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
