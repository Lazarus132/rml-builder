"use strict";

self.window = self;

importScripts(
  "../compiler/csharp14_validator_runtime.js?v=4-max-graph-performance-v755"
);

function errorPayload(error) {
  return {
    message: error instanceof Error
      ? error.message
      : String(error || "The validator worker failed."),
    stack: error instanceof Error
      ? error.stack || ""
      : ""
  };
}

async function invokeValidator(message) {
  const backend = self.RMLCSharp14ValidatorRuntime;
  if (!backend) {
    throw new Error(
      "The isolated Roslyn validator runtime did not initialize."
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
    default:
      throw new Error(
        `Unsupported validator worker operation '${message.method}'.`
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
    self.postMessage({
      type: "result",
      id: message.id,
      result: await invokeValidator(message)
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      id: message.id,
      error: errorPayload(error)
    });
  }
});
