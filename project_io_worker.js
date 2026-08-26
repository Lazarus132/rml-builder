"use strict";

self.addEventListener("message", event => {
  const request = event.data || {};
  const id = request.id;

  void (async () => {
    try {
      if (request.operation === "parse") {
        const value = JSON.parse(
          String(request.text ?? "")
        );

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

        const value = JSON.parse(
          await request.file.text()
        );

        self.postMessage({
          id,
          ok: true,
          value
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