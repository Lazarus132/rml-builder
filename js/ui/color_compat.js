(() => {
  "use strict";

  if (window.RMLColorCompat) {
    return;
  }

  const NAMED_COLORS = Object.freeze({
    black: [0, 0, 0, 1],
    transparent: [0, 0, 0, 0],
    white: [255, 255, 255, 1]
  });

  function normalizedByte(value) {
    return Math.max(
      0,
      Math.min(255, Number(value) || 0)
    );
  }

  function normalizedAlpha(value) {
    return Math.max(
      0,
      Math.min(1, Number(value) || 0)
    );
  }

  function parseHexColor(value) {
    const match = String(value || "")
      .trim()
      .match(/^#([0-9a-f]{3,8})$/i);
    if (!match) return null;
    let hex = match[1];
    if (hex.length === 3 || hex.length === 4) {
      hex = Array.from(hex, character =>
        character + character
      ).join("");
    }
    if (hex.length !== 6 && hex.length !== 8) {
      return null;
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
      hex.length === 8
        ? parseInt(hex.slice(6, 8), 16) / 255
        : 1
    ];
  }

  function parseFunctionalColor(value) {
    const match = String(value || "")
      .trim()
      .match(/^rgba?\((.*)\)$/i);
    if (!match) return null;
    const normalized = match[1]
      .replace(/\s*\/\s*/, ",")
      .trim();
    const parts = normalized.includes(",")
      ? normalized.split(/\s*,\s*/)
      : normalized.split(/\s+/);
    if (parts.length < 3 || parts.length > 4) {
      return null;
    }
    const channel = part => {
      const text = String(part || "").trim();
      return text.endsWith("%")
        ? normalizedByte(parseFloat(text) * 2.55)
        : normalizedByte(parseFloat(text));
    };
    const alpha = parts[3] === undefined
      ? 1
      : String(parts[3]).trim().endsWith("%")
        ? normalizedAlpha(parseFloat(parts[3]) / 100)
        : normalizedAlpha(parseFloat(parts[3]));
    return [
      channel(parts[0]),
      channel(parts[1]),
      channel(parts[2]),
      alpha
    ];
  }

  function parse(value) {
    const text = String(value || "")
      .trim()
      .toLowerCase();
    return NAMED_COLORS[text]
      ? [...NAMED_COLORS[text]]
      : parseHexColor(text) ||
          parseFunctionalColor(text);
  }

  function formattedAlpha(value) {
    return String(
      Math.round(normalizedAlpha(value) * 10000) /
        10000
    );
  }

  function mix(
    first,
    firstWeight,
    second = "transparent"
  ) {
    const firstColor = parse(first);
    const secondColor = parse(second);
    if (!firstColor || !secondColor) {
      return String(first || second || "transparent");
    }
    const weight = Math.max(
      0,
      Math.min(1, Number(firstWeight) || 0)
    );
    const inverse = 1 - weight;
    const alpha =
      firstColor[3] * weight +
      secondColor[3] * inverse;
    const channel = index => alpha > 0
      ? Math.round((
          firstColor[index] * firstColor[3] * weight +
          secondColor[index] * secondColor[3] * inverse
        ) / alpha)
      : 0;
    return `rgba(${channel(0)}, ${channel(1)}, ${channel(2)}, ${formattedAlpha(alpha)})`;
  }

  Object.defineProperty(
    window,
    "RMLColorCompat",
    {
      value: Object.freeze({ mix, parse }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
