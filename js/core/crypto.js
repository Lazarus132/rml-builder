(() => {
  "use strict";

  function normalizeName(value) {
    return String(value || "")
      .normalize("NFKC")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function stableHash64(value) {
    const text = String(value || "");
    let first = 0x811c9dc5;
    let second = 0x9e3779b9;

    for (
      let index = 0;
      index < text.length;
      index += 1
    ) {
      const code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(
        first,
        0x01000193
      ) >>> 0;
      second ^= code + index;
      second = Math.imul(
        second,
        0x85ebca6b
      ) >>> 0;
    }

    return (
      first
        .toString(16)
        .padStart(8, "0") +
      second
        .toString(16)
        .padStart(8, "0")
    );
  }

  function stableHash128(value) {
    const text = String(value || "");
    let a = 0x811c9dc5;
    let b = 0x9e3779b9;
    let c = 0x85ebca6b;
    let d = 0xc2b2ae35;

    for (
      let index = 0;
      index < text.length;
      index += 1
    ) {
      const code = text.charCodeAt(index);
      a = Math.imul(
        a ^ code,
        0x01000193
      );
      b = Math.imul(
        b ^ code,
        0x27d4eb2d
      );
      c = Math.imul(
        c ^ code,
        0x165667b1
      );
      d = Math.imul(
        d ^ code,
        0x9e3779b1
      );
    }

    const hex = number =>
      (number >>> 0)
        .toString(16)
        .padStart(8, "0");
    return `${hex(a)}${hex(b)}${hex(c)}${hex(d)}`;
  }

  function fingerprint(namespace, value) {
    const prefix = String(
      namespace || "rml"
    ).trim() || "rml";
    return `${prefix}-${stableHash128(value)}`;
  }

  Object.defineProperty(
    window,
    "RMLCrypto",
    {
      value: Object.freeze({
        normalizeName,
        stableHash64,
        stableHash128,
        fingerprint
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
