"use strict";

self.window = self;

importScripts(
  "../compiler/csharp14_roslyn_worker_runtime.js?v=11-domain-folder-layout-v754"
);

function errorPayload(error) {
  return {
    message: error instanceof Error
      ? error.message
      : String(error || "The compiler worker failed."),
    stack: error instanceof Error
      ? error.stack || ""
      : ""
  };
}

function transferableOutputs(result) {
  const transfers = [];
  for (const output of Array.isArray(result?.outputs)
    ? result.outputs
    : []) {
    if (output?.peImage?.buffer instanceof ArrayBuffer) {
      transfers.push(output.peImage.buffer);
    }
    if (
      output?.pdbImage?.buffer instanceof ArrayBuffer &&
      output.pdbImage.buffer.byteLength > 0
    ) {
      transfers.push(output.pdbImage.buffer);
    }
  }
  return transfers;
}

async function invokeCompiler(message) {
  const backend = self.RMLCSharp14Roslyn;
  if (!backend) {
    throw new Error(
      "The isolated Roslyn compiler runtime did not initialize."
    );
  }

  const args = Array.isArray(message.args)
    ? message.args
    : [];
  switch (message.method) {
    case "ensureReady":
      await backend.ensureReady();
      return {
        languageVersion: backend.languageVersion,
        assembly: backend.assembly
      };
    case "parse":
      return backend.parse(args[0]);
    case "validate":
      return backend.validate(args[0]);
    case "getSyntaxKinds":
      return backend.getSyntaxKinds();
    case "configureReferences":
      return backend.configureReferences(
        args[0],
        progress => self.postMessage({
          type: "progress",
          id: message.id,
          progress
        })
      );
    case "compile": {
      const options = {
        ...(args[1] || {}),
        onProgress(progress) {
          self.postMessage({
            type: "progress",
            id: message.id,
            progress
          });
        }
      };
      return backend.compile(args[0], options);
    }
    case "resetCompilerReferences":
      return backend.resetCompilerReferences();
    default:
      throw new Error(
        `Unsupported compiler worker operation '${message.method}'.`
      );
  }
}

self.addEventListener("message", async event => {
  const message = event?.data;
  if (
    message?.type !== "invoke" ||
    !Number.isSafeInteger(message.id)
  ) {
    return;
  }

  try {
    const result = await invokeCompiler(message);
    self.postMessage(
      {
        type: "result",
        id: message.id,
        result
      },
      transferableOutputs(result)
    );
  } catch (error) {
    self.postMessage({
      type: "error",
      id: message.id,
      error: errorPayload(error)
    });
  }
});
