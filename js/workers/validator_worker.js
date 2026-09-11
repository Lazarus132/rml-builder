"use strict";
// RML Builder workers: validator_worker.

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

function editorValidationEnvelope(parameterKey, value) {
  const key = String(parameterKey || "");
  const raw = String(value ?? "");
  if (key === "source") return { source: raw, lineOffset: 0 };
  const placeholders = raw.replace(/\{([A-Z][A-Z0-9_]*)\}/g,
    (_token, name) => name === "NEXT" ? "__Next();" : "default(object)");
  if (key === "actionCode") return {
    source: "class __RmlLiveValidation\n{\n  void __Action()\n  {\n" + placeholders + "\n  }\n  void __Next() {}\n}", lineOffset: 4
  };
  if (key === "expressionCode") return {
    source: "class __RmlLiveValidation\n{\n  object __Expression() =>\n" + placeholders + ";\n}", lineOffset: 3
  };
  if (key === "memberCode") return {
    source: "class __RmlLiveValidation\n{\n" + placeholders + "\n}", lineOffset: 2
  };
  return null;
}

async function validateEditor(backend, parameterKey, value) {
  const envelope = editorValidationEnvelope(parameterKey, value);
  if (!envelope) return null;
  const result = await backend.validate(envelope.source);
  const messages = [...new Set(result.diagnostics.map(diagnostic => {
    const physicalLine = Number(diagnostic?.startLine);
    const line = physicalLine > 0 ? Math.max(1, physicalLine - envelope.lineOffset) : 0;
    const location = line > 0
      ? `line ${line}, column ${Number(diagnostic?.startColumn) || 1}`
      : "unknown location";
    return `${diagnostic?.id || "C#14"} at ${location}: ${diagnostic?.message || "Invalid C# 14 syntax."}`;
  }))];
  if (result.ok !== true && !messages.length) {
    messages.push("C#14 at unknown location: Roslyn rejected the current source.");
  }
  return messages;
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
    case "validateEditor":
      return validateEditor(backend, args[0], args[1]);
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
