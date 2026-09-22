"use strict";

function validateStylesheetText(text, url) {
  if (!text.trim()) {
    throw new Error(`${url} returned an empty stylesheet.`);
  }
  if (/^\s*<!doctype\s+html|<html[\s>]/i.test(text)) {
    throw new Error(`${url} returned HTML instead of CSS.`);
  }

  let depth = 0;
  let quote = "";
  let comment = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    const next = text[index + 1];

    if (comment) {
      if (character === "*" && next === "/") {
        comment = false;
        index += 1;
      }
      continue;
    }
    if (!quote && character === "/" && next === "*") {
      comment = true;
      index += 1;
      continue;
    }
    if (quote) {
      if (character === "\\") index += 1;
      else if (character === quote) quote = "";
      continue;
    }
    if (character === "\"" || character === "'") {
      quote = character;
      continue;
    }
    if (character === "{") depth += 1;
    if (character === "}") depth -= 1;
    if (depth < 0) {
      throw new Error(`${url} contains an unexpected closing brace.`);
    }
  }

  if (comment || quote || depth !== 0) {
    throw new Error(`${url} contains an incomplete CSS block, string, or comment.`);
  }
}

self.addEventListener("message", async event => {
  const requestId = Number(event.data?.requestId) || 0;
  const url = String(event.data?.url || "");
  if (!requestId || !url) return;

  try {
    const response = await fetch(url, {
      cache: "force-cache",
      credentials: "same-origin"
    });
    if (!response.ok) {
      throw new Error(`${url}: ${response.status} ${response.statusText}`);
    }
    const text = await response.text();
    validateStylesheetText(text, url);
    self.postMessage({
      requestId,
      ok: true,
      text
    });
  } catch (error) {
    self.postMessage({
      requestId,
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
});
