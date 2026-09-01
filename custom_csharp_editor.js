(() => {
  "use strict";

  if (window.RMLCustomCSharpDetachedEditor) {
    return;
  }

  const DEFAULT_APPEARANCE = Object.freeze({
    workbench: "#181818",
    background: "#000000",
    gutter: "#000000",
    panel: "#181818",
    overlay: "#252526",
    status: "#68217a",
    selection: "#264f78",
    text: "#ffffff",
    uiText: "#cccccc",
    gutterText: "#858585",
    statusText: "#ffffff",
    accent: "#b789ff",
    caret: "#ffffff"
  });

  const normalizedColor = (value, fallback) => {
    const candidate = String(value || "").trim();
    return /^#[0-9a-f]{6}$/i.test(candidate)
      ? candidate.toLowerCase()
      : fallback;
  };

  const normalizedAppearance = appearance => ({
    workbench: normalizedColor(
      appearance?.workbench,
      DEFAULT_APPEARANCE.workbench
    ),
    background: normalizedColor(
      appearance?.background,
      DEFAULT_APPEARANCE.background
    ),
    gutter: normalizedColor(
      appearance?.gutter,
      DEFAULT_APPEARANCE.gutter
    ),
    panel: normalizedColor(
      appearance?.panel,
      DEFAULT_APPEARANCE.panel
    ),
    overlay: normalizedColor(
      appearance?.overlay,
      DEFAULT_APPEARANCE.overlay
    ),
    status: normalizedColor(
      appearance?.status,
      DEFAULT_APPEARANCE.status
    ),
    selection: normalizedColor(
      appearance?.selection,
      DEFAULT_APPEARANCE.selection
    ),
    text: normalizedColor(
      appearance?.text,
      DEFAULT_APPEARANCE.text
    ),
    uiText: normalizedColor(
      appearance?.uiText,
      DEFAULT_APPEARANCE.uiText
    ),
    gutterText: normalizedColor(
      appearance?.gutterText,
      DEFAULT_APPEARANCE.gutterText
    ),
    statusText: normalizedColor(
      appearance?.statusText,
      DEFAULT_APPEARANCE.statusText
    ),
    accent: normalizedColor(
      appearance?.accent,
      DEFAULT_APPEARANCE.accent
    ),
    caret: normalizedColor(
      appearance?.caret,
      DEFAULT_APPEARANCE.caret
    )
  });

  const DIAGNOSTIC_SOURCE_STORAGE_KEY =
    "rml-detached-editor-diagnostic-source-v1";
  const RML_GRAPH_NODE_DRAG_TYPE =
    "application/x-rml-graph-node";
  let diagnosticClockEpoch = 0;
  const nextDiagnosticClock = () => {
    diagnosticClockEpoch = Math.max(
      Date.now(),
      diagnosticClockEpoch + 1
    );
    return new Date(
      diagnosticClockEpoch
    ).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3
    });
  };
  const normalizedDiagnosticSource = value =>
    /^builder$/i.test(String(value || ""))
      ? "Builder"
      : "Roslyn";
  const outputDiagnosticSource = value =>
    /roslyn/i.test(String(value || ""))
      ? "Roslyn"
      : "Builder";
  const normalizedDiagnostics = values => {
    const groups = {
      Builder: [],
      Roslyn: []
    };
    const append = (source, entries) => {
      const target = groups[normalizedDiagnosticSource(source)];
      for (const entry of Array.isArray(entries) ? entries : []) {
        const message = String(
          entry?.message || entry || ""
        );
        if (message && !target.includes(message)) {
          target.push(message);
        }
      }
    };
    if (Array.isArray(values)) {
      for (const entry of values) {
        append(
          entry && typeof entry === "object"
            ? entry.source
            : "Roslyn",
          [entry]
        );
      }
    } else if (values && typeof values === "object") {
      append("Builder", values.Builder || values.builder);
      append("Roslyn", values.Roslyn || values.roslyn);
    }
    return groups;
  };

  const STYLE_TEXT = `
    :root { color-scheme: dark; --editor-font-size: 16px; --editor-line-height: 24px; --rml-workbench-background: #181818; --rml-code-background: #000000; --rml-gutter-background: #000000; --rml-panel-background: #181818; --rml-overlay-background: #252526; --rml-status-background: #68217a; --rml-selection-background: #264f78; --rml-code-text: #ffffff; --rml-ui-text: #cccccc; --rml-gutter-text: #858585; --rml-status-text: #ffffff; --rml-accent: #b789ff; --line: #45414f; --line-strong: #665d75; --panel-deep: #121019; --text: #e8e3ef; --muted: #9790a2; --accent-dark: #a476ff; --accent-soft: rgba(164, 118, 255, .16); }
    * { box-sizing: border-box; }
    html, body { width: 100%; min-height: 100%; margin: 0; }
    body { display: grid; grid-template-rows: auto minmax(0, 1fr) minmax(132px, 24vh) auto; height: 100dvh; overflow: hidden; background: var(--rml-workbench-background); color: var(--rml-ui-text); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    header { display: flex; align-items: stretch; min-width: 0; min-height: calc(36px + env(safe-area-inset-top)); padding-top: env(safe-area-inset-top); background: var(--rml-workbench-background); border-bottom: 1px solid #2b2b2b; }
    header strong { display: flex; align-items: center; min-width: 0; max-width: min(520px, 75vw); padding: 0 14px; overflow: hidden; border-top: 1px solid var(--rml-accent); border-right: 1px solid #2b2b2b; background: var(--rml-workbench-background); color: var(--rml-ui-text); font-size: 12px; font-weight: 500; text-overflow: ellipsis; white-space: nowrap; }
    .editor-header-actions { display: flex; align-items: center; margin-left: auto; padding-inline: 4px; }
    .editor-header-actions > button { display: inline-grid; place-items: center; width: 36px; min-width: 36px; height: 36px; padding: 8px; border: 0; border-radius: 4px; background: transparent; color: var(--rml-ui-text); cursor: pointer; }
    .editor-header-actions > button:hover { background: var(--rml-overlay-background); color: var(--rml-code-text); }
    .editor-header-actions > button[aria-pressed="true"] { background: var(--rml-selection-background); color: var(--rml-code-text); box-shadow: inset 0 -2px var(--rml-accent); }
    .editor-header-actions > button[aria-pressed="true"]:hover { background: color-mix(in srgb, var(--rml-selection-background) 82%, var(--rml-accent)); }
    .editor-header-actions svg { width: 19px; height: 19px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; pointer-events: none; }
    .editor-presentation-picker { width: 164px; min-width: 132px; margin-inline: 4px; }
    .rml-graph-searchable-select { position: relative; display: block; width: 100%; min-width: 0; }
    .rml-graph-searchable-native-select { position: absolute !important; width: 1px !important; height: 1px !important; min-height: 0 !important; margin: -1px !important; padding: 0 !important; overflow: hidden !important; clip: rect(0 0 0 0) !important; -webkit-clip-path: inset(50%) !important; clip-path: inset(50%) !important; border: 0 !important; white-space: nowrap !important; pointer-events: none !important; }
    .rml-graph-searchable-trigger { position: relative; display: flex; width: 100%; min-width: 0; min-height: 35px; align-items: center; gap: 8px; padding: 8px 34px 8px 10px; border: 1px solid var(--line); border-radius: 7px; outline: none; background: var(--panel-deep); color: var(--text); font-size: 11px; font-weight: 520; line-height: 1.2; text-align: left; cursor: pointer; }
    .rml-graph-searchable-trigger:hover { border-color: var(--line-strong); background: #12101a; }
    .rml-graph-searchable-trigger:focus-visible, .rml-graph-searchable-select.open .rml-graph-searchable-trigger { border-color: var(--accent-dark); box-shadow: 0 0 0 3px var(--accent-soft); }
    .rml-graph-searchable-trigger::after { position: absolute; top: 50%; right: 11px; width: 7px; height: 7px; border-right: 2px solid var(--muted); border-bottom: 2px solid var(--muted); content: ""; transform: translateY(-67%) rotate(45deg); transition: transform 120ms ease, border-color 120ms ease; pointer-events: none; }
    .rml-graph-searchable-select.open .rml-graph-searchable-trigger::after { border-color: #d0bbff; transform: translateY(-30%) rotate(225deg); }
    .rml-graph-searchable-trigger-text { display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .rml-graph-searchable-popup { position: fixed; z-index: 100000; display: grid; min-width: 180px; max-width: min(560px, calc(100vw - 16px)); gap: 6px; padding: 7px; border: 1px solid var(--line-strong); border-radius: 9px; background: linear-gradient(180deg, rgba(24, 22, 34, .995), rgba(13, 12, 19, .995)); box-shadow: 0 18px 48px rgba(0, 0, 0, .58), inset 0 1px rgba(255, 255, 255, .035); }
    .rml-graph-searchable-popup[hidden] { display: none; }
    .rml-graph-searchable-options { display: grid; max-height: min(280px, 46vh); gap: 3px; overflow-y: auto; overscroll-behavior: contain; padding: 1px; scrollbar-width: thin; scrollbar-color: var(--line-strong) transparent; }
    .rml-graph-searchable-option { display: block; width: 100%; min-height: 30px; padding: 7px 9px; overflow: hidden; border: 1px solid transparent; border-radius: 6px; background: transparent; color: #d9d4e8; font-size: 10px; font-weight: 520; line-height: 1.25; text-align: left; text-overflow: ellipsis; white-space: nowrap; cursor: pointer; }
    .rml-graph-searchable-option:hover, .rml-graph-searchable-option:focus-visible { border-color: rgba(164, 118, 255, .38); outline: none; background: rgba(164, 118, 255, .10); color: #f2edff; }
    .rml-graph-searchable-option:disabled { opacity: .55; cursor: wait; }
    .editor-shell { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); min-width: 0; min-height: 0; overflow: hidden; background: #1f1f1f; }
    .line-gutter { min-width: 58px; min-height: 0; overflow: hidden; border-right: 1px solid #292929; background: var(--rml-gutter-background); color: var(--rml-gutter-text); user-select: none; }
    .line-gutter pre { margin: 0; padding: 14px 10px 14px 6px; font: var(--editor-font-size)/var(--editor-line-height) ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; text-align: right; white-space: pre; will-change: transform; }
    .editor-content { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
    textarea { position: relative; z-index: 1; width: 100%; height: 100%; min-width: 0; min-height: 0; resize: none; border: 0; border-radius: 0; padding: 14px 18px; outline: none; background: transparent; font: var(--editor-font-size)/var(--editor-line-height) ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; tab-size: 4; white-space: pre; overflow: auto; -webkit-overflow-scrolling: touch; scrollbar-width: auto; scrollbar-color: var(--rml-accent) var(--rml-code-background); }
    textarea::selection { background: var(--rml-selection-background); color: var(--rml-code-text); }
    textarea::-webkit-scrollbar { width: 10px; height: 10px; }
    textarea::-webkit-scrollbar-track { background: var(--rml-code-background); }
    textarea::-webkit-scrollbar-thumb { min-width: 44px; min-height: 44px; border: 2px solid var(--rml-code-background); border-radius: 999px; background: var(--rml-accent); }
    textarea::-webkit-scrollbar-thumb:hover { filter: brightness(1.15); }
    textarea:focus { box-shadow: inset 0 0 0 1px var(--rml-accent); }
    .editor-shell.node-drop-active { box-shadow: inset 0 0 0 2px var(--rml-accent), inset 0 0 34px color-mix(in srgb, var(--rml-accent) 20%, transparent); }
    .editor-shell.node-drop-active textarea { cursor: copy; }
    .find-widget { position: absolute; z-index: 4; top: 0; right: 18px; display: grid; grid-template-columns: minmax(180px, 310px) auto; gap: 5px 7px; width: min(620px, calc(100% - 78px)); padding: 6px; border: 1px solid #454545; border-top: 0; border-radius: 0 0 4px 4px; background: var(--rml-overlay-background); box-shadow: 0 4px 12px rgba(0, 0, 0, .42); color: var(--rml-ui-text); }
    .find-widget[hidden] { display: none; }
    .find-widget [hidden] { display: none !important; }
    .find-fields { display: grid; gap: 5px; min-width: 0; }
    .find-input-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; min-width: 0; border: 1px solid #3c3c3c; background: #3c3c3c; }
    .find-input-row:focus-within { border-color: var(--rml-accent); }
    .find-input-row input { min-width: 0; height: 28px; padding: 3px 7px; border: 0; outline: 0; background: #3c3c3c; color: var(--rml-ui-text); font: 13px/20px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .find-options { display: flex; align-items: center; gap: 1px; padding-right: 2px; }
    .find-widget button { display: inline-grid; place-items: center; min-width: 28px; height: 28px; padding: 0 5px; border: 1px solid transparent; border-radius: 3px; background: transparent; color: var(--rml-ui-text); font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; cursor: pointer; }
    .find-widget button:hover { background: #3a3d41; }
    .find-widget button[aria-pressed="true"] { border-color: var(--rml-accent); background: var(--rml-selection-background); color: var(--rml-code-text); }
    .find-actions { display: grid; grid-template-columns: repeat(3, 28px); align-content: start; gap: 2px; }
    .find-replace-actions { display: flex; align-items: center; justify-content: flex-end; gap: 4px; grid-column: 1 / -1; }
    .find-replace-actions button { width: auto; min-width: 72px; padding-inline: 8px; }
    .find-match-count { align-self: center; min-width: 56px; color: #a9a9a9; font-size: 11px; text-align: right; white-space: nowrap; }
    .find-match-count.error { color: #f48771; }
    .settings-overlay { position: fixed; z-index: 8; top: calc(36px + env(safe-area-inset-top)); right: 4px; width: min(300px, calc(100vw - 16px)); max-height: calc(100dvh - 44px - env(safe-area-inset-top)); padding: 10px; overflow: auto; border: 1px solid #454545; border-radius: 0 0 5px 5px; background: var(--rml-overlay-background); box-shadow: 0 7px 22px rgba(0, 0, 0, .52); color: var(--rml-ui-text); }
    body.separate-window-editor .settings-overlay { top: calc(74px + env(safe-area-inset-top)); max-height: calc(100dvh - 82px - env(safe-area-inset-top)); }
    .settings-overlay[hidden] { display: none; }
    .settings-overlay h2 { margin: 0 0 9px; color: var(--rml-ui-text); font-size: 12px; font-weight: 600; }
    .settings-overlay h2:not(:first-child) { margin-top: 14px; }
    .settings-source { display: grid; gap: 6px; }
    .settings-source > span { color: var(--rml-ui-text); font-size: 12px; }
    .settings-source-toggle { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 4px; }
    .settings-source-toggle button { min-height: 30px; border: 1px solid #454545; border-radius: 3px; background: #333333; color: var(--rml-ui-text); font: 12px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; cursor: pointer; }
    .settings-source-toggle button:hover { background: #3a3d41; }
    .settings-source-toggle button[aria-pressed="true"] { border-color: var(--rml-accent); background: var(--rml-selection-background); color: var(--rml-code-text); }
    .settings-colors { display: grid; gap: 7px; }
    .settings-color { position: relative; display: grid; grid-template-columns: minmax(0, 1fr) 86px; align-items: center; gap: 10px; min-height: 28px; padding: 2px 4px; border-radius: 3px; color: var(--rml-ui-text); font-size: 12px; cursor: pointer; }
    .settings-color:hover, .settings-color:focus-within { background: var(--rml-selection-background); color: var(--rml-code-text); }
    .settings-color-trigger { position: absolute; z-index: 2; inset: 0; width: 100%; height: 100%; padding: 0; border: 0; background: transparent; cursor: pointer; }
    .settings-color input[type="color"] { position: fixed; left: -10000px; width: 1px; height: 1px; padding: 0; border: 0; opacity: 0; pointer-events: none; }
    .settings-color-line { display: block; height: 4px; border: 1px solid rgba(255, 255, 255, .32); border-radius: 999px; box-shadow: 0 0 0 1px rgba(0, 0, 0, .42); pointer-events: none; }
    .settings-picker-popover { position: fixed; z-index: 9; top: calc(44px + env(safe-area-inset-top)); right: 308px; width: min(390px, calc(100vw - 324px)); max-height: calc(100dvh - 60px - env(safe-area-inset-top)); padding: 8px; overflow: auto; border: 1px solid #454545; border-radius: 5px; background: var(--rml-overlay-background); box-shadow: 0 9px 28px rgba(0, 0, 0, .58); }
    body.separate-window-editor .settings-picker-popover { top: calc(82px + env(safe-area-inset-top)); max-height: calc(100dvh - 98px - env(safe-area-inset-top)); }
    .settings-picker-popover[hidden] { display: none; }
    .settings-picker-popover .rml-detached-editor-color-picker { margin: 0; }
    .debug-panel { display: grid; grid-template-rows: auto minmax(0, 1fr); min-width: 0; min-height: 0; border-top: 1px solid #2b2b2b; background: var(--rml-panel-background); }
    .debug-tabs { display: flex; align-items: stretch; min-width: 0; min-height: 34px; padding-inline: 8px; gap: 2px; border-bottom: 1px solid #252525; overflow-x: auto; scrollbar-width: thin; scrollbar-color: rgba(183, 137, 255, .72) transparent; }
    .debug-tabs button { position: relative; min-width: max-content; min-height: 34px; padding: 0 10px; border: 0; background: transparent; color: #969696; font: 11px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; letter-spacing: .035em; cursor: pointer; }
    .debug-tabs button[aria-selected="true"] { color: var(--rml-ui-text); }
    .debug-tabs button[aria-selected="true"]::after { position: absolute; right: 8px; bottom: 0; left: 8px; height: 1px; background: var(--rml-accent); content: ""; }
    .debug-tabs output { display: inline-grid; place-items: center; min-width: 18px; height: 18px; margin-left: 5px; padding-inline: 4px; border-radius: 9px; background: #37373d; color: #f3f3f3; font-size: 10px; }
    .debug-views { position: relative; min-width: 0; min-height: 0; overflow: hidden; background: var(--rml-panel-background); }
    .debug-view { position: absolute; inset: 0; margin: 0; padding: 9px 12px 14px; overflow: auto; background: var(--rml-panel-background); color: var(--rml-ui-text); font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; white-space: pre-wrap; overflow-wrap: anywhere; scrollbar-color: var(--rml-accent) var(--rml-panel-background); }
    .debug-view[hidden] { display: none; }
    .debug-entry { display: grid; grid-template-columns: max-content max-content minmax(0, 1fr); gap: 8px; padding-block: 2px; }
    .debug-entry time { color: #858585; }
    .debug-entry b { color: #9cdcfe; font-weight: 500; }
    .debug-entry[data-tone="warning"] span { color: #dcdcaa; }
    .debug-entry[data-tone="error"] span { color: #f48771; }
    .debug-entry[data-tone="success"] span { color: #89d185; }
    .problem { display: grid; grid-template-columns: 14px minmax(0, 1fr); gap: 8px; padding-block: 3px; color: #f48771; }
    .problem::before { content: "×"; font-weight: 700; }
    .debug-empty { color: #858585; }
    footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; min-height: calc(24px + env(safe-area-inset-bottom)); padding: 0 max(10px, env(safe-area-inset-right)) env(safe-area-inset-bottom) max(10px, env(safe-area-inset-left)); background: var(--rml-status-background); color: var(--rml-status-text); font-size: 11px; line-height: 24px; }
    footer output { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .status-right { display: flex; align-items: center; gap: 14px; flex: 0 0 auto; white-space: nowrap; }
    @media (hover: none), (pointer: coarse), (max-width: 780px) {
      :root { --editor-font-size: 17px; --editor-line-height: 25.5px; }
      body { grid-template-rows: auto minmax(0, 1fr) minmax(150px, 28vh) auto; }
      .editor-header-actions > button { width: 44px; min-width: 44px; height: 44px; }
      .editor-presentation-picker { width: 132px; margin-inline: 3px; }
      .editor-presentation-picker .rml-graph-searchable-trigger { min-height: 40px; font-size: 12px; }
      .line-gutter { min-width: 52px; }
      .find-widget { right: 8px; width: calc(100% - 60px); grid-template-columns: minmax(0, 1fr); }
      .find-input-row input { height: 42px; font-size: 17px; }
      .find-widget button { min-width: 44px; height: 44px; }
      .find-actions { position: absolute; top: 6px; right: 6px; grid-template-columns: repeat(3, 44px); }
      .find-fields { padding-right: 136px; }
      .find-replace-actions { justify-content: stretch; }
      .find-replace-actions button { flex: 1 1 auto; }
      .settings-overlay { top: calc(44px + env(safe-area-inset-top)); right: 8px; width: calc(100vw - 16px); }
      .settings-picker-popover { top: calc(52px + env(safe-area-inset-top)); right: 8px; left: 8px; width: auto; max-height: calc(100dvh - 68px - env(safe-area-inset-top)); }
      .settings-source-toggle button { min-height: 44px; font-size: 14px; }
      .settings-color { min-height: 44px; font-size: 14px; }
      .debug-tabs button { min-height: 44px; padding-inline: 12px; }
      .debug-view { font-size: 13px; }
      footer { min-height: calc(32px + env(safe-area-inset-bottom)); line-height: 32px; }
    }
  `;

  function applyAppearance(
    popupDocument,
    editorShell,
    gutter,
    textarea,
    appearance = {}
  ) {
    const normalized = normalizedAppearance(appearance);
    const workbench = normalized.workbench;
    const background = normalized.background;
    const gutterBackground = normalized.gutter;
    const text = normalized.text;
    const caret = normalized.caret;
    const variables = {
      "--rml-workbench-background": workbench,
      "--rml-code-background": background,
      "--rml-gutter-background": gutterBackground,
      "--rml-panel-background": normalized.panel,
      "--rml-overlay-background": normalized.overlay,
      "--rml-status-background": normalized.status,
      "--rml-selection-background": normalized.selection,
      "--rml-code-text": text,
      "--rml-ui-text": normalized.uiText,
      "--rml-gutter-text": normalized.gutterText,
      "--rml-status-text": normalized.statusText,
      "--rml-accent": normalized.accent
    };
    for (const [name, value] of Object.entries(variables)) {
      popupDocument.documentElement.style.setProperty(name, value);
    }
    editorShell.style.setProperty(
      "background-color",
      background,
      "important"
    );
    gutter.style.setProperty(
      "background-color",
      gutterBackground,
      "important"
    );
    gutter.style.setProperty(
      "color",
      normalized.gutterText,
      "important"
    );
    textarea.style.setProperty(
      "background-color",
      "transparent",
      "important"
    );
    textarea.style.setProperty(
      "color",
      text,
      "important"
    );
    textarea.style.setProperty(
      "caret-color",
      caret,
      "important"
    );
  }

  function mount(options = {}) {
    const popup = options.popup;
    if (!popup || popup.closed) {
      return null;
    }

    const popupDocument = popup.document;
    popupDocument.documentElement.lang =
      options.language || "en";
    popupDocument.title =
      String(options.documentTitle || "Custom C# · Code editor");
    popupDocument.head.replaceChildren();
    popupDocument.body.replaceChildren();

    const viewport = popupDocument.createElement("meta");
    viewport.name = "viewport";
    viewport.content =
      "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content";
    const title = popupDocument.createElement("title");
    title.textContent = popupDocument.title;
    const style = popupDocument.createElement("style");
    style.textContent = STYLE_TEXT;
    const styleLinks = Array.from(
      new Set(
        (Array.isArray(options.styleUrls) ? options.styleUrls : [])
          .map(value => String(value || "").trim())
          .filter(Boolean)
      ),
      href => {
        const link = popupDocument.createElement("link");
        link.rel = "stylesheet";
        link.href = href;
        return link;
      }
    );
    popupDocument.head.append(viewport, title, ...styleLinks, style);

    const header = popupDocument.createElement("header");
    const heading = popupDocument.createElement("strong");
    heading.textContent = String(options.tabTitle || "Custom C#");
    const headerActions = popupDocument.createElement("div");
    headerActions.className = "editor-header-actions";
    const createHeaderButton = (label, paths) => {
      const button = popupDocument.createElement("button");
      button.type = "button";
      button.title = label;
      button.setAttribute("aria-label", label);
      button.innerHTML =
        `<svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg>`;
      return button;
    };
    const showFind = createHeaderButton(
      "Find (Ctrl/Command+F)",
      '<circle cx="10.5" cy="10.5" r="6.5"></circle><path d="M15.5 15.5L21 21"></path>'
    );
    const showReplace = createHeaderButton(
      "Find and replace (Ctrl+H / Command+Option+F)",
      '<path d="M4 7h11M12 4l3 3-3 3M20 17H9M12 14l-3 3 3 3"></path>'
    );
    for (const button of [showFind, showReplace]) {
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-expanded", "false");
    }
    const showSettings = createHeaderButton(
      "Settings Overlay",
      '<circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.12.38.34.72.64 1 .3.27.68.4 1.06.4h.1v4h-.1c-.38 0-.76.13-1.06.4-.3.28-.52.62-.64 1Z"></path>'
    );
    const presentationMode =
      ["inline", "overlay", "external"].includes(
        String(options.presentationMode || "")
      )
        ? String(options.presentationMode)
        : "inline";
    const embedded =
      presentationMode === "inline";
    const separateWindow =
      presentationMode === "external";
    let pageAreasHidden =
      options.pageAreasHidden === true;
    const pageAreasIcon = hidden =>
      hidden
        ? '<path d="M4 9h5V4M20 9h-5V4M4 15h5v5M20 15h-5v5"></path>'
        : '<path d="M9 4H4v5M15 4h5v5M9 20H4v-5M15 20h5v-5"></path>';
    const togglePageAreas = createHeaderButton(
      "",
      pageAreasIcon(pageAreasHidden)
    );
    const synchronizePageAreasButton = () => {
      const label = pageAreasHidden
        ? "Show the normal page areas above and below the Runtime Graph"
        : "Hide only the page areas above and below the Runtime Graph";
      togglePageAreas.title = label;
      togglePageAreas.setAttribute(
        "aria-label",
        label
      );
      togglePageAreas.setAttribute(
        "aria-pressed",
        String(pageAreasHidden)
      );
      togglePageAreas.innerHTML =
        `<svg viewBox="0 0 24 24" aria-hidden="true">${pageAreasIcon(pageAreasHidden)}</svg>`;
    };
    synchronizePageAreasButton();
    const popupReturnToEmbedded = createHeaderButton(
      "Return to embedded editor",
      '<path d="M9 7 4 12l5 5"></path><path d="M4 12h10a6 6 0 0 1 6 6"></path>'
    );
    popupReturnToEmbedded.addEventListener(
      "click",
      () => {
        void options.onRequestPresentation?.("inline");
      }
    );
    const presentationPicker =
      popupDocument.createElement("div");
    presentationPicker.className =
      "editor-presentation-picker";
    presentationPicker.title =
      "Choose how the Custom C# code editor is displayed";
    const presentationSelect =
      popupDocument.createElement("select");
    presentationSelect.setAttribute(
      "aria-label",
      "Open embedded code editor as"
    );
    for (const [value, label] of [
      ["overlay", "Overlay"],
      ["external", "Separate Window"]
    ]) {
      const option =
        popupDocument.createElement("option");
      option.value = value;
      option.textContent = label;
      presentationSelect.appendChild(option);
    }
    presentationSelect.selectedIndex = -1;
    presentationSelect.value = "";
    presentationPicker.appendChild(
      presentationSelect
    );

    const createPresentationDropdown = () => {
      const wrapper =
        popupDocument.createElement("div");
      wrapper.className =
        "rml-graph-searchable-select rml-universal-custom-select";
      presentationPicker.replaceChildren(wrapper);
      wrapper.appendChild(presentationSelect);
      presentationSelect.classList.add(
        "rml-graph-searchable-native-select"
      );
      presentationSelect.tabIndex = -1;
      presentationSelect.setAttribute(
        "aria-hidden",
        "true"
      );

      const trigger =
        popupDocument.createElement("button");
      trigger.type = "button";
      trigger.className =
        "rml-graph-searchable-trigger rml-universal-select-trigger";
      trigger.setAttribute(
        "aria-label",
        "Choose code editor presentation"
      );
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      const triggerText =
        popupDocument.createElement("span");
      triggerText.className =
        "rml-graph-searchable-trigger-text";
      triggerText.textContent = "Open as…";
      trigger.appendChild(triggerText);
      wrapper.appendChild(trigger);

      const menu =
        popupDocument.createElement("div");
      menu.className =
        "rml-graph-searchable-popup rml-universal-select-popup";
      menu.hidden = true;
      const optionsHost =
        popupDocument.createElement("div");
      optionsHost.className =
        "rml-graph-searchable-options";
      optionsHost.setAttribute("role", "listbox");
      optionsHost.setAttribute(
        "aria-label",
        "Code editor presentation targets"
      );
      menu.appendChild(optionsHost);

      let opened = false;
      let busy = false;
      const optionButtons = [];

      const positionMenu = () => {
        if (!opened) return;
        const rect = trigger.getBoundingClientRect();
        const viewport = popup.visualViewport;
        const viewportLeft = viewport?.offsetLeft || 0;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportWidth = viewport?.width || popup.innerWidth;
        const viewportHeight = viewport?.height || popup.innerHeight;
        const margin = 8;
        const gap = 5;
        const width = Math.min(
          Math.max(rect.width, 180),
          Math.max(160, viewportWidth - margin * 2)
        );
        menu.style.width = `${Math.round(width)}px`;
        menu.style.maxWidth =
          `${Math.max(160, viewportWidth - margin * 2)}px`;
        const left = Math.min(
          viewportLeft + viewportWidth - width - margin,
          Math.max(viewportLeft + margin, rect.left)
        );
        const measuredHeight =
          menu.getBoundingClientRect().height || 84;
        const below =
          viewportTop + viewportHeight - rect.bottom - margin - gap;
        const above =
          rect.top - viewportTop - margin - gap;
        const top = measuredHeight > below && above > below
          ? rect.top - measuredHeight - gap
          : rect.bottom + gap;
        menu.style.left = `${Math.round(left)}px`;
        menu.style.top = `${Math.round(Math.max(
          viewportTop + margin,
          Math.min(
            viewportTop + viewportHeight - measuredHeight - margin,
            top
          )
        ))}px`;
      };

      const close = (restoreFocus = false) => {
        if (!opened) return;
        opened = false;
        wrapper.classList.remove("open");
        trigger.setAttribute("aria-expanded", "false");
        menu.hidden = true;
        menu.remove();
        popup.removeEventListener("resize", positionMenu);
        popup.visualViewport?.removeEventListener(
          "resize",
          positionMenu
        );
        if (restoreFocus) {
          trigger.focus({ preventScroll: true });
        }
      };

      const setBusy = value => {
        busy = value === true;
        presentationSelect.disabled = busy;
        trigger.disabled = busy;
        for (const button of optionButtons) {
          button.disabled = busy;
        }
      };

      const request = requested => {
        if (
          busy ||
          !["overlay", "external"].includes(requested)
        ) {
          return;
        }
        close(false);
        setBusy(true);
        Promise.resolve(
          options.onRequestPresentation?.(requested)
        )
          .then(committed => {
            if (committed === false) {
              presentationSelect.selectedIndex = -1;
              presentationSelect.value = "";
              setBusy(false);
              trigger.focus({ preventScroll: true });
            }
          })
          .catch(() => {
            presentationSelect.selectedIndex = -1;
            presentationSelect.value = "";
            setBusy(false);
            trigger.focus({ preventScroll: true });
          });
      };

      for (const option of presentationSelect.options) {
        const button =
          popupDocument.createElement("button");
        button.type = "button";
        button.className =
          "rml-graph-searchable-option";
        button.textContent = option.textContent;
        button.dataset.value = option.value;
        button.setAttribute("role", "option");
        button.setAttribute("aria-selected", "false");
        button.addEventListener("click", () => {
          presentationSelect.value = option.value;
          request(option.value);
        });
        optionsHost.appendChild(button);
        optionButtons.push(button);
      }

      const open = () => {
        if (opened || busy) return;
        opened = true;
        wrapper.classList.add("open");
        trigger.setAttribute("aria-expanded", "true");
        menu.hidden = false;
        popupDocument.body.appendChild(menu);
        positionMenu();
        popup.addEventListener("resize", positionMenu);
        popup.visualViewport?.addEventListener(
          "resize",
          positionMenu
        );
        optionButtons[0]?.focus({ preventScroll: true });
      };

      const moveFocus = delta => {
        const current = optionButtons.indexOf(
          popupDocument.activeElement
        );
        const index = current < 0
          ? 0
          : Math.max(
              0,
              Math.min(optionButtons.length - 1, current + delta)
            );
        optionButtons[index]?.focus({ preventScroll: true });
      };

      trigger.addEventListener("click", event => {
        event.stopPropagation();
        opened ? close(true) : open();
      });
      trigger.addEventListener("keydown", event => {
        if (
          event.key === "ArrowDown" ||
          event.key === "ArrowUp" ||
          event.key === "Enter" ||
          event.key === " "
        ) {
          event.preventDefault();
          if (!opened) open();
          if (event.key === "ArrowUp") {
            optionButtons.at(-1)?.focus({ preventScroll: true });
          }
        }
      });
      optionsHost.addEventListener("keydown", event => {
        if (event.key === "Escape") {
          event.preventDefault();
          close(true);
        } else if (event.key === "ArrowDown") {
          event.preventDefault();
          moveFocus(1);
        } else if (event.key === "ArrowUp") {
          event.preventDefault();
          moveFocus(-1);
        } else if (event.key === "Home") {
          event.preventDefault();
          optionButtons[0]?.focus({ preventScroll: true });
        } else if (event.key === "End") {
          event.preventDefault();
          optionButtons.at(-1)?.focus({ preventScroll: true });
        }
      });
      popupDocument.addEventListener(
        "pointerdown",
        event => {
          if (
            opened &&
            !wrapper.contains(event.target) &&
            !menu.contains(event.target)
          ) {
            close(false);
          }
        },
        true
      );
      presentationSelect.addEventListener("change", () => {
        request(presentationSelect.value);
      });

      return {
        close,
        isOpen: () => opened,
        trigger,
        optionButtons
      };
    };
    const presentationDropdown = embedded
      ? createPresentationDropdown()
      : {
          close() {},
          isOpen: () => false
        };
    if (separateWindow) {
      headerActions.append(
        popupReturnToEmbedded
      );
    }
    headerActions.append(
      showFind,
      showReplace,
      showSettings
    );
    if (embedded) {
      headerActions.append(
        togglePageAreas,
        presentationPicker
      );
    }
    header.append(heading, headerActions);

    const editorShell = popupDocument.createElement("main");
    editorShell.className = "editor-shell";
    const gutter = popupDocument.createElement("aside");
    gutter.className = "line-gutter";
    gutter.setAttribute("aria-hidden", "true");
    const lineNumbers = popupDocument.createElement("pre");
    gutter.appendChild(lineNumbers);

    const textarea = popupDocument.createElement("textarea");
    textarea.value = String(options.value || "");
    textarea.spellcheck = false;
    textarea.autocomplete = "off";
    textarea.setAttribute("autocapitalize", "off");
    textarea.setAttribute("autocorrect", "off");
    textarea.setAttribute("aria-label", String(options.ariaLabel || "C# 14 source"));
    const initialSelectionStart = Math.max(
      0,
      Math.min(
        textarea.value.length,
        Number(options.initialSelection?.start) || 0
      )
    );
    const initialSelectionEnd = Math.max(
      initialSelectionStart,
      Math.min(
        textarea.value.length,
        Number(options.initialSelection?.end) ||
          initialSelectionStart
      )
    );
    textarea.setSelectionRange(
      initialSelectionStart,
      initialSelectionEnd,
      options.initialSelection?.direction === "backward"
        ? "backward"
        : "forward"
    );

    const editorContent = popupDocument.createElement("div");
    editorContent.className = "editor-content";
    editorContent.appendChild(textarea);

    const findWidget = popupDocument.createElement("section");
    findWidget.id = "rml-custom-csharp-find-widget";
    findWidget.className = "find-widget";
    findWidget.hidden = true;
    findWidget.setAttribute("role", "search");
    findWidget.setAttribute("aria-label", "Find and replace");
    showFind.setAttribute("aria-controls", findWidget.id);
    showReplace.setAttribute("aria-controls", findWidget.id);
    const findFields = popupDocument.createElement("div");
    findFields.className = "find-fields";
    const findInputRow = popupDocument.createElement("div");
    findInputRow.className = "find-input-row";
    const findInput = popupDocument.createElement("input");
    findInput.type = "text";
    findInput.autocomplete = "off";
    findInput.spellcheck = false;
    findInput.placeholder = "Find";
    findInput.setAttribute("aria-label", "Find");
    const findOptions = popupDocument.createElement("div");
    findOptions.className = "find-options";
    const createFindButton = (label, text) => {
      const button = popupDocument.createElement("button");
      button.type = "button";
      button.title = label;
      button.setAttribute("aria-label", label);
      button.textContent = text;
      return button;
    };
    const matchCase = createFindButton("Match case", "Aa");
    const wholeWord = createFindButton("Match whole word", "ab");
    const regularExpression = createFindButton("Use regular expression", ".*");
    for (const button of [matchCase, wholeWord, regularExpression]) {
      button.setAttribute("aria-pressed", "false");
      findOptions.appendChild(button);
    }
    findInputRow.append(findInput, findOptions);
    const replaceInputRow = popupDocument.createElement("div");
    replaceInputRow.className = "find-input-row";
    replaceInputRow.hidden = true;
    const replaceInput = popupDocument.createElement("input");
    replaceInput.type = "text";
    replaceInput.autocomplete = "off";
    replaceInput.spellcheck = false;
    replaceInput.placeholder = "Replace";
    replaceInput.setAttribute("aria-label", "Replace");
    replaceInputRow.appendChild(replaceInput);
    findFields.append(findInputRow, replaceInputRow);
    const findActions = popupDocument.createElement("div");
    findActions.className = "find-actions";
    const previousMatch = createFindButton("Previous match", "↑");
    const nextMatch = createFindButton("Next match", "↓");
    const hideFind = createFindButton("Close find and replace", "×");
    findActions.append(previousMatch, nextMatch, hideFind);
    const replaceActions = popupDocument.createElement("div");
    replaceActions.className = "find-replace-actions";
    const matchCount = popupDocument.createElement("output");
    matchCount.className = "find-match-count";
    matchCount.setAttribute("aria-live", "polite");
    matchCount.textContent = "No results";
    const replaceCurrent = createFindButton("Replace current match", "Replace");
    const replaceAll = createFindButton("Replace all matches", "Replace All");
    replaceCurrent.hidden = true;
    replaceAll.hidden = true;
    replaceActions.append(matchCount, replaceCurrent, replaceAll);
    findWidget.append(findFields, findActions, replaceActions);

    editorShell.append(gutter, editorContent, findWidget);
    applyAppearance(
      popupDocument,
      editorShell,
      gutter,
      textarea,
      options.appearance
    );

    let appearanceState = normalizedAppearance(options.appearance);
    let diagnosticSource = normalizedDiagnosticSource(
      options.diagnosticSource ||
        (() => {
          try {
            return popup.localStorage.getItem(
              DIAGNOSTIC_SOURCE_STORAGE_KEY
            );
          } catch {
            return "Roslyn";
          }
        })()
    );
    const settingsOverlay = popupDocument.createElement("section");
    settingsOverlay.className = "settings-overlay";
    settingsOverlay.hidden = true;
    settingsOverlay.setAttribute("aria-label", "Editor Settings Overlay");
    const diagnosticSettingsTitle = popupDocument.createElement("h2");
    diagnosticSettingsTitle.textContent = "Debug & Problems";
    const diagnosticSourceSetting = popupDocument.createElement("div");
    diagnosticSourceSetting.className = "settings-source";
    const diagnosticSourceLabel = popupDocument.createElement("span");
    diagnosticSourceLabel.textContent = "Output source";
    const diagnosticSourceToggle = popupDocument.createElement("div");
    diagnosticSourceToggle.className = "settings-source-toggle";
    diagnosticSourceToggle.setAttribute("role", "group");
    diagnosticSourceToggle.setAttribute(
      "aria-label",
      "Debug and problems output source"
    );
    const diagnosticSourceButtons = new Map();
    const synchronizeDiagnosticSourceControls = () => {
      for (const [source, button] of diagnosticSourceButtons) {
        button.setAttribute(
          "aria-pressed",
          source === diagnosticSource ? "true" : "false"
        );
      }
    };
    const commitDiagnosticSource = source => {
      diagnosticSource = normalizedDiagnosticSource(source);
      synchronizeDiagnosticSourceControls();
      try {
        popup.localStorage.setItem(
          DIAGNOSTIC_SOURCE_STORAGE_KEY,
          diagnosticSource
        );
      } catch {}
      renderDebugEntries();
      renderDiagnostics();
    };
    for (const source of ["Builder", "Roslyn"]) {
      const button = popupDocument.createElement("button");
      button.type = "button";
      button.textContent = source;
      button.setAttribute(
        "aria-label",
        `${source} debug and problems output`
      );
      button.addEventListener("click", () => {
        commitDiagnosticSource(source);
      });
      diagnosticSourceButtons.set(source, button);
      diagnosticSourceToggle.appendChild(button);
    }
    synchronizeDiagnosticSourceControls();
    diagnosticSourceSetting.append(
      diagnosticSourceLabel,
      diagnosticSourceToggle
    );
    const settingsTitle = popupDocument.createElement("h2");
    settingsTitle.textContent = "Editor Colors";
    const settingsColors = popupDocument.createElement("div");
    settingsColors.className = "settings-colors";
    const appearanceControls = new Map();
    const appearanceEntries = [
      ["background", "Editor Background"],
      ["gutter", "Line Gutter Background"],
      ["workbench", "Workbench Background"],
      ["panel", "Output Panel Background"],
      ["overlay", "Overlay Background"],
      ["status", "Status Bar Background"],
      ["selection", "Selection Background"],
      ["text", "Editor Text"],
      ["uiText", "Interface Text"],
      ["gutterText", "Line Number Text"],
      ["statusText", "Status Bar Text"],
      ["accent", "Accent"],
      ["caret", "Cursor"]
    ];
    const synchronizeAppearanceControls = () => {
      for (const [key, controls] of appearanceControls) {
        controls.input.value = appearanceState[key];
        controls.line.style.backgroundColor = appearanceState[key];
      }
    };
    const commitAppearance = (key, value) => {
      appearanceState = normalizedAppearance({
        ...appearanceState,
        [key]: value
      });
      applyAppearance(
        popupDocument,
        editorShell,
        gutter,
        textarea,
        appearanceState
      );
      synchronizeAppearanceControls();
      options.onAppearanceChange?.({ ...appearanceState });
    };
    const pickerPopover = popupDocument.createElement("div");
    pickerPopover.className = "settings-picker-popover";
    pickerPopover.hidden = true;
    const closeAppearancePicker = () => {
      pickerPopover.hidden = true;
      pickerPopover.replaceChildren();
      for (const controls of appearanceControls.values()) {
        controls.trigger.setAttribute("aria-expanded", "false");
      }
    };
    const openAppearancePicker = (key, labelText) => {
      const controls = appearanceControls.get(key);
      if (!controls) return;
      const wasOpen =
        !pickerPopover.hidden &&
        controls.trigger.getAttribute("aria-expanded") === "true";
      closeAppearancePicker();
      if (wasOpen) return;
      const factory = options.createAppearanceColorEditor;
      const editor =
        typeof factory === "function"
          ? factory({
              label: `${labelText} color`,
              value: appearanceState[key],
              onChange(value) {
                commitAppearance(key, value);
              }
            })
          : null;
      if (editor?.nodeType === 1) {
        const adopted =
          editor.ownerDocument === popupDocument
            ? editor
            : popupDocument.adoptNode(editor);
        pickerPopover.appendChild(adopted);
        pickerPopover.hidden = false;
        controls.trigger.setAttribute("aria-expanded", "true");
        return;
      }
      controls.input.click();
    };
    for (const [key, labelText] of appearanceEntries) {
      const row = popupDocument.createElement("div");
      row.className = "settings-color";
      const text = popupDocument.createElement("span");
      text.textContent = labelText;
      const line = popupDocument.createElement("i");
      line.className = "settings-color-line";
      const trigger = popupDocument.createElement("button");
      trigger.type = "button";
      trigger.className = "settings-color-trigger";
      trigger.setAttribute("aria-label", `Open ${labelText} color picker`);
      trigger.setAttribute("aria-haspopup", "dialog");
      trigger.setAttribute("aria-expanded", "false");
      const input = popupDocument.createElement("input");
      input.type = "color";
      input.setAttribute("aria-label", `${labelText} color`);
      input.addEventListener("input", () => {
        commitAppearance(key, input.value);
      });
      trigger.addEventListener("click", () => {
        openAppearancePicker(key, labelText);
      });
      row.append(text, line, trigger, input);
      settingsColors.appendChild(row);
      appearanceControls.set(key, { input, line, trigger });
    }
    synchronizeAppearanceControls();
    settingsOverlay.append(
      diagnosticSettingsTitle,
      diagnosticSourceSetting,
      settingsTitle,
      settingsColors,
      pickerPopover
    );

    const statusBar = popupDocument.createElement("footer");
    const statusMessage = popupDocument.createElement("output");
    statusMessage.textContent = String(options.status || "Synchronized with Builder");
    const statusRight = popupDocument.createElement("div");
    statusRight.className = "status-right";
    const cursorPosition = popupDocument.createElement("output");
    const encoding = popupDocument.createElement("span");
    encoding.textContent = "UTF-8";
    const language = popupDocument.createElement("span");
    language.textContent = "C#";
    statusRight.append(cursorPosition, encoding, language);
    statusBar.append(statusMessage, statusRight);

    const debugPanel = popupDocument.createElement("section");
    debugPanel.className = "debug-panel";
    debugPanel.setAttribute("aria-label", "Editor output and diagnostics");
    const debugTabs = popupDocument.createElement("nav");
    debugTabs.className = "debug-tabs";
    debugTabs.setAttribute("aria-label", "Debug output views");
    const debugViews = popupDocument.createElement("div");
    debugViews.className = "debug-views";
    const viewDefinitions = [
      ["output", "OUTPUT"],
      ["problems", "PROBLEMS"],
      ["debug", "DEBUG CONSOLE"]
    ];
    const views = new Map();
    const tabs = new Map();
    let activeView = "output";
    for (const [id, label] of viewDefinitions) {
      const button = popupDocument.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.setAttribute("role", "tab");
      button.setAttribute("aria-selected", id === activeView ? "true" : "false");
      button.dataset.view = id;
      if (id === "problems") {
        const count = popupDocument.createElement("output");
        count.textContent = "0";
        count.setAttribute("aria-label", "0 problems");
        button.appendChild(count);
      }
      const view = popupDocument.createElement("div");
      view.className = "debug-view";
      view.dataset.view = id;
      view.setAttribute("role", "tabpanel");
      view.hidden = id !== activeView;
      debugTabs.appendChild(button);
      debugViews.appendChild(view);
      tabs.set(id, button);
      views.set(id, view);
      button.addEventListener("click", () => {
        activeView = id;
        for (const [viewId, candidate] of views) {
          candidate.hidden = viewId !== activeView;
          tabs.get(viewId)?.setAttribute(
            "aria-selected",
            viewId === activeView ? "true" : "false"
          );
        }
      });
    }
    debugPanel.append(debugTabs, debugViews);
    popupDocument.body.append(
      header,
      editorShell,
      debugPanel,
      statusBar,
      settingsOverlay
    );

    const outputEntries = [];
    let diagnostics = normalizedDiagnostics(options.diagnostics);
    let diagnosticSnapshotTime =
      nextDiagnosticClock();
    const renderEntries = (
      viewId,
      entries,
      requiredSource = ""
    ) => {
      const view = views.get(viewId);
      if (!view) return;
      const visibleEntries = requiredSource
        ? entries.filter(
            entry =>
              entry.sourceGroup === requiredSource
          )
        : entries;
      view.replaceChildren();
      if (!visibleEntries.length) {
        const empty = popupDocument.createElement("span");
        empty.className = "debug-empty";
        empty.textContent =
          viewId === "debug"
            ? "Waiting for Roslyn, worker or Builder debug output…"
            : "No output yet.";
        view.appendChild(empty);
        return;
      }
      for (const entry of visibleEntries) {
        const row = popupDocument.createElement("div");
        row.className = "debug-entry";
        row.dataset.tone = String(entry.tone || "info");
        row.dataset.source = entry.sourceGroup;
        const time = popupDocument.createElement("time");
        time.textContent = String(entry.time || "");
        const source = popupDocument.createElement("b");
        source.textContent = String(entry.source || "Builder");
        const message = popupDocument.createElement("span");
        message.textContent = String(entry.message || "");
        row.append(time, source, message);
        view.appendChild(row);
      }
      view.scrollTop = view.scrollHeight;
    };
    const renderDebugEntries = () => {
      const view = views.get("debug");
      if (view) {
        view.dataset.source = diagnosticSource;
      }
      const sourceDiagnostics =
        diagnostics[diagnosticSource] || [];
      renderEntries(
        "debug",
        sourceDiagnostics.map(message => ({
          time: diagnosticSnapshotTime,
          source: diagnosticSource,
          sourceGroup: diagnosticSource,
          message,
          tone: "error"
        })),
        diagnosticSource
      );
    };
    const renderDiagnostics = () => {
      const view = views.get("problems");
      if (!view) return;
      view.dataset.source = diagnosticSource;
      view.replaceChildren();
      const visibleDiagnostics =
        diagnostics[diagnosticSource] || [];
      if (!visibleDiagnostics.length) {
        const empty = popupDocument.createElement("span");
        empty.className = "debug-empty";
        empty.textContent =
          `No ${diagnosticSource} problems detected.`;
        view.appendChild(empty);
      } else {
        for (const diagnostic of visibleDiagnostics) {
          const row = popupDocument.createElement("div");
          row.className = "problem";
          row.dataset.source = diagnosticSource;
          row.textContent = String(diagnostic);
          view.appendChild(row);
        }
      }
      const count = tabs.get("problems")?.querySelector("output");
      if (count) {
        count.textContent = String(visibleDiagnostics.length);
        count.setAttribute(
          "aria-label",
          `${visibleDiagnostics.length} ${diagnosticSource} problem${visibleDiagnostics.length === 1 ? "" : "s"}`
        );
      }
    };
    const appendOutput = entry => {
      const normalized = Object.freeze({
        time: String(
          entry?.time ||
            nextDiagnosticClock()
        ),
        source: String(entry?.source || "Builder"),
        sourceGroup: outputDiagnosticSource(
          entry?.source || "Builder"
        ),
        message: String(entry?.message || ""),
        tone: String(entry?.tone || "info")
      });
      if (!normalized.message) return;
      const repeatedIndex =
        outputEntries.findLastIndex(previous =>
          previous?.message === normalized.message &&
          previous?.source === normalized.source &&
          previous?.tone === normalized.tone
        );
      if (repeatedIndex >= 0) {
        outputEntries.splice(
          repeatedIndex,
          1
        );
      }
      outputEntries.push(normalized);
      if (outputEntries.length > 500) outputEntries.shift();
      renderEntries("output", outputEntries);
    };
    for (const entry of Array.isArray(options.output) ? options.output : []) {
      appendOutput(entry);
    }
    renderEntries("output", outputEntries);
    renderDebugEntries();
    renderDiagnostics();

    const refreshLineNumbers = () => {
      const count = Math.max(1, textarea.value.split("\n").length);
      lineNumbers.textContent = Array.from(
        { length: count },
        (_, index) => String(index + 1)
      ).join("\n");
    };
    const refreshCursorPosition = () => {
      const offset = Math.max(0, textarea.selectionStart || 0);
      const lines = textarea.value.slice(0, offset).split("\n");
      cursorPosition.textContent =
        `Ln ${lines.length}, Col ${lines.at(-1).length + 1}`;
    };
    const synchronizeGutterScroll = () => {
      lineNumbers.style.transform =
        `translateY(${-textarea.scrollTop}px)`;
    };
    const refresh = () => {
      refreshLineNumbers();
      refreshCursorPosition();
      synchronizeGutterScroll();
    };
    refresh();

    let composing = false;
    const commit = () => {
      options.onInput?.(textarea.value);
      statusMessage.textContent = "Synchronized with Builder";
      refresh();
      if (!findWidget.hidden) {
        refreshMatches(textarea.selectionStart);
      }
    };
    const insertNodeSnippet = snippetValue => {
      const snippet = String(
        snippetValue?.snippet ??
        snippetValue ??
        ""
      );
      if (!snippet) return false;
      const start = Math.max(
        0,
        Number(textarea.selectionStart) || 0
      );
      const end = Math.max(
        start,
        Number(textarea.selectionEnd) || start
      );
      const before = textarea.value.slice(0, start);
      const after = textarea.value.slice(end);
      const prefix =
        before &&
        !before.endsWith("\n") &&
        !/^\s/.test(snippet)
          ? "\n"
          : "";
      const suffix =
        after &&
        !after.startsWith("\n") &&
        !/\s$/.test(snippet)
          ? "\n"
          : "";
      const inserted =
        `${prefix}${snippet}${suffix}`;
      textarea.value =
        before + inserted + after;
      const cursor =
        before.length + inserted.length;
      textarea.setSelectionRange(
        cursor,
        cursor,
        "forward"
      );
      commit();
      statusMessage.textContent = String(
        snippetValue?.status ||
        "Node inserted and synchronized with Builder"
      );
      statusMessage.dataset.tone = "info";
      try {
        textarea.focus({ preventScroll: true });
      } catch {
        textarea.focus();
      }
      return true;
    };

    let replaceMode = false;
    let findMatches = [];
    let activeMatchIndex = -1;
    let activeFindExpression = null;
    const regexEscape = value =>
      String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const optionEnabled = button =>
      button.getAttribute("aria-pressed") === "true";
    const setOptionEnabled = (button, enabled) => {
      button.setAttribute(
        "aria-pressed",
        enabled ? "true" : "false"
      );
    };
    const isWordCharacter = character =>
      Boolean(character) &&
      /[\p{L}\p{N}_]/u.test(character);
    const createFindExpression = () => {
      const query = findInput.value;
      if (!query) return null;
      const source = optionEnabled(regularExpression)
        ? query
        : regexEscape(query);
      return new RegExp(
        source,
        `gu${optionEnabled(matchCase) ? "" : "i"}`
      );
    };
    const collectMatches = expression => {
      const matches = [];
      if (!expression) return matches;
      expression.lastIndex = 0;
      let match;
      while ((match = expression.exec(textarea.value))) {
        const start = match.index;
        const length = match[0].length;
        const end = start + length;
        const wholeWordMismatch =
          optionEnabled(wholeWord) &&
          (
            isWordCharacter(textarea.value[start - 1]) ||
            isWordCharacter(textarea.value[end])
          );
        if (!wholeWordMismatch) {
          matches.push({
            start,
            end,
            value: match[0],
            captures: Array.from(match),
            groups: match.groups || null
          });
        }
        if (length === 0) {
          expression.lastIndex = start + 1;
        }
        if (matches.length >= 100000) break;
      }
      expression.lastIndex = 0;
      return matches;
    };
    const updateMatchStatus = error => {
      matchCount.classList.toggle("error", Boolean(error));
      if (error) {
        matchCount.textContent = "Invalid expression";
        matchCount.title = String(error.message || error);
      } else if (!findInput.value) {
        matchCount.textContent = "No query";
        matchCount.removeAttribute("title");
      } else if (!findMatches.length) {
        matchCount.textContent = "No results";
        matchCount.removeAttribute("title");
      } else {
        matchCount.textContent =
          `${activeMatchIndex + 1} / ${findMatches.length}`;
        matchCount.removeAttribute("title");
      }
      const unavailable =
        Boolean(error) || findMatches.length === 0;
      for (const button of [
        previousMatch,
        nextMatch,
        replaceCurrent,
        replaceAll
      ]) {
        button.disabled = false;
        button.setAttribute(
          "aria-disabled",
          String(unavailable)
        );
        button.title = unavailable
          ? error
            ? "Correct the invalid search expression first."
            : "Enter a search term that has at least one match."
          : "";
      }
    };
    const refreshMatches = (preferredOffset = textarea.selectionStart) => {
      try {
        activeFindExpression = createFindExpression();
        findMatches = collectMatches(activeFindExpression);
        activeMatchIndex = findMatches.findIndex(
          match =>
            match.start <= preferredOffset &&
            match.end >= preferredOffset
        );
        if (activeMatchIndex < 0 && findMatches.length > 0) {
          activeMatchIndex = findMatches.findIndex(
            match => match.start >= preferredOffset
          );
          if (activeMatchIndex < 0) activeMatchIndex = 0;
        }
        updateMatchStatus(null);
      } catch (error) {
        activeFindExpression = null;
        findMatches = [];
        activeMatchIndex = -1;
        updateMatchStatus(error);
      }
    };
    const revealActiveMatch = (focusEditor = false) => {
      const match = findMatches[activeMatchIndex];
      if (!match) return;
      if (focusEditor) {
        textarea.focus();
      }
      textarea.setSelectionRange(
        match.start,
        match.end,
        "forward"
      );
      const lineIndex =
        textarea.value.slice(0, match.start).split("\n").length - 1;
      const lineHeight =
        Number.parseFloat(
          popup.getComputedStyle(textarea).lineHeight
        ) || 24;
      textarea.scrollTop = Math.max(
        0,
        lineIndex * lineHeight - textarea.clientHeight / 2
      );
      refreshCursorPosition();
      synchronizeGutterScroll();
      updateMatchStatus(null);
    };
    const stepMatch = direction => {
      if (!findMatches.length) {
        refreshMatches();
      }
      if (!findMatches.length) return;
      activeMatchIndex =
        (activeMatchIndex + direction + findMatches.length) %
        findMatches.length;
      revealActiveMatch(true);
    };
    const synchronizeSettingsToggleButton = () => {
      const open = !settingsOverlay.hidden;
      showSettings.setAttribute(
        "aria-expanded",
        String(open)
      );
      showSettings.setAttribute(
        "aria-pressed",
        String(open)
      );
    };
    const synchronizeFindToggleButtons = () => {
      const widgetOpen = !findWidget.hidden;
      const findActive =
        widgetOpen && !replaceMode;
      const replaceActive =
        widgetOpen && replaceMode;
      showFind.setAttribute(
        "aria-pressed",
        String(findActive)
      );
      showFind.setAttribute(
        "aria-expanded",
        String(findActive)
      );
      showReplace.setAttribute(
        "aria-pressed",
        String(replaceActive)
      );
      showReplace.setAttribute(
        "aria-expanded",
        String(replaceActive)
      );
    };
    const openFind = (withReplace = false) => {
      presentationDropdown.close(false);
      settingsOverlay.hidden = true;
      synchronizeSettingsToggleButton();
      closeAppearancePicker();
      replaceMode = withReplace;
      findWidget.hidden = false;
      replaceInputRow.hidden = !replaceMode;
      replaceCurrent.hidden = !replaceMode;
      replaceAll.hidden = !replaceMode;
      synchronizeFindToggleButtons();
      const selection = textarea.value.slice(
        textarea.selectionStart,
        textarea.selectionEnd
      );
      if (
        !findInput.value &&
        selection &&
        !selection.includes("\n") &&
        selection.length <= 500
      ) {
        findInput.value = selection;
      }
      refreshMatches();
      if (findMatches.length) {
        revealActiveMatch();
      }
      findInput.focus();
      findInput.select();
    };
    const closeFind = () => {
      findWidget.hidden = true;
      synchronizeFindToggleButtons();
      textarea.focus();
    };
    const toggleFind = withReplace => {
      if (
        !findWidget.hidden &&
        replaceMode === withReplace
      ) {
        closeFind();
        return;
      }
      openFind(withReplace);
    };
    const expandedReplacement = (replacement, match, source) => {
      if (!optionEnabled(regularExpression)) {
        return replacement;
      }
      return String(replacement).replace(
        /\$(\$|&|`|'|<[^>]+>|\d{1,2})/g,
        (token, marker) => {
          if (marker === "$") return "$";
          if (marker === "&") return match.value;
          if (marker === "`") return source.slice(0, match.start);
          if (marker === "'") return source.slice(match.end);
          if (marker.startsWith("<")) {
            return String(
              match.groups?.[marker.slice(1, -1)] ?? token
            );
          }
          const index = Number(marker);
          return Number.isInteger(index) && index > 0
            ? String(match.captures[index] ?? token)
            : token;
        }
      );
    };
    const replaceActiveMatch = () => {
      const match = findMatches[activeMatchIndex];
      if (!match) return;
      const source = textarea.value;
      const replacement = expandedReplacement(
        replaceInput.value,
        match,
        source
      );
      textarea.value =
        source.slice(0, match.start) +
        replacement +
        source.slice(match.end);
      textarea.focus();
      textarea.setSelectionRange(
        match.start,
        match.start + replacement.length,
        "forward"
      );
      commit();
      refreshMatches(match.start + replacement.length);
      revealActiveMatch(true);
      appendOutput({
        source: "Editor",
        tone: "success",
        message: "Replaced the current match."
      });
    };
    const replaceEveryMatch = () => {
      refreshMatches(0);
      if (!findMatches.length || !activeFindExpression) return;
      const count = findMatches.length;
      const source = textarea.value;
      let cursor = 0;
      let replaced = "";
      for (const match of findMatches) {
        replaced +=
          source.slice(cursor, match.start) +
          expandedReplacement(
            replaceInput.value,
            match,
            source
          );
        cursor = match.end;
      }
      textarea.value = replaced + source.slice(cursor);
      textarea.focus();
      textarea.setSelectionRange(0, 0, "forward");
      commit();
      refreshMatches(0);
      appendOutput({
        source: "Editor",
        tone: "success",
        message: `Replaced ${count.toLocaleString()} match${count === 1 ? "" : "es"}.`
      });
    };
    findInput.addEventListener("input", () => {
      refreshMatches();
      if (findMatches.length) revealActiveMatch();
    });
    for (const button of [matchCase, wholeWord, regularExpression]) {
      button.addEventListener("click", () => {
        setOptionEnabled(button, !optionEnabled(button));
        refreshMatches();
        if (findMatches.length) revealActiveMatch();
      });
    }
    previousMatch.addEventListener("click", () => {
      stepMatch(-1);
    });
    nextMatch.addEventListener("click", () => {
      stepMatch(1);
    });
    hideFind.addEventListener("click", closeFind);
    replaceCurrent.addEventListener("click", () => {
      replaceActiveMatch();
    });
    replaceAll.addEventListener("click", () => {
      replaceEveryMatch();
    });
    showFind.addEventListener("click", () => toggleFind(false));
    showReplace.addEventListener("click", () => toggleFind(true));
    synchronizeFindToggleButtons();
    synchronizeSettingsToggleButton();
    showSettings.addEventListener("click", event => {
      event.stopPropagation();
      presentationDropdown.close(false);
      const open = settingsOverlay.hidden;
      settingsOverlay.hidden = !open;
      synchronizeSettingsToggleButton();
      if (!open) {
        closeAppearancePicker();
      }
      if (open && !findWidget.hidden) {
        closeFind();
      }
    });
    settingsOverlay.addEventListener("click", event => {
      event.stopPropagation();
    });
    popupDocument.addEventListener("click", () => {
      presentationDropdown.close(false);
      if (!settingsOverlay.hidden) {
        settingsOverlay.hidden = true;
        synchronizeSettingsToggleButton();
        closeAppearancePicker();
      }
    });
    popupDocument.addEventListener(
      "pointerdown",
      () => options.onRequestForeground?.(),
      true
    );
    popup.addEventListener(
      "focus",
      () => options.onRequestForeground?.()
    );
    findInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        stepMatch(event.shiftKey ? -1 : 1);
      }
    });
    replaceInput.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        replaceActiveMatch();
      }
    });
    popupDocument.addEventListener("keydown", event => {
      const command = event.ctrlKey || event.metaKey;
      const key = event.key.toLowerCase();
      if (command && key === "f") {
        event.preventDefault();
        openFind(false);
        return;
      }
      if (
        command && key === "h" ||
        event.metaKey && event.altKey && key === "f"
      ) {
        event.preventDefault();
        openFind(true);
        return;
      }
      if (event.key === "F3") {
        event.preventDefault();
        if (findWidget.hidden) openFind(false);
        else stepMatch(event.shiftKey ? -1 : 1);
        return;
      }
      if (event.key === "Escape") {
        if (presentationDropdown.isOpen()) {
          event.preventDefault();
          presentationDropdown.close(true);
        } else if (!settingsOverlay.hidden) {
          event.preventDefault();
          settingsOverlay.hidden = true;
          synchronizeSettingsToggleButton();
          closeAppearancePicker();
        } else if (!findWidget.hidden) {
          event.preventDefault();
          closeFind();
        }
      }
    });
    textarea.addEventListener("compositionstart", () => {
      composing = true;
    });
    textarea.addEventListener("compositionend", () => {
      composing = false;
      commit();
    });
    const indentSelection = (
      width,
      remove = false
    ) => {
      const source = textarea.value;
      const start = Math.max(
        0,
        Number(textarea.selectionStart) || 0
      );
      const end = Math.max(
        start,
        Number(textarea.selectionEnd) || start
      );
      const indentation = " ".repeat(
        Math.max(1, width)
      );
      if (start === end) {
        if (remove) {
          const lineStart =
            source.lastIndexOf("\n", start - 1) + 1;
          const available =
            source.slice(lineStart, start)
              .match(/\s*$/)?.[0] || "";
          const count = Math.min(
            indentation.length,
            available.replace(/[^ ]/g, "").length
          );
          if (count === 0) return false;
          textarea.value =
            source.slice(0, start - count) +
            source.slice(start);
          textarea.setSelectionRange(
            start - count,
            start - count,
            "forward"
          );
        } else {
          textarea.value =
            source.slice(0, start) +
            indentation +
            source.slice(end);
          textarea.setSelectionRange(
            start + indentation.length,
            start + indentation.length,
            "forward"
          );
        }
        commit();
        return true;
      }

      const lineStart =
        source.lastIndexOf("\n", start - 1) + 1;
      const effectiveEnd =
        end > start &&
        source[end - 1] === "\n"
          ? end - 1
          : end;
      const nextLineBreak =
        source.indexOf("\n", effectiveEnd);
      const blockEnd =
        nextLineBreak < 0
          ? source.length
          : nextLineBreak;
      const lines = source
        .slice(lineStart, blockEnd)
        .split("\n");
      const deltas = [];
      const transformed = lines.map(line => {
        if (!remove) {
          deltas.push(indentation.length);
          return indentation + line;
        }
        const match = line.match(
          new RegExp(`^ {1,${indentation.length}}`)
        );
        const count = match?.[0]?.length ||
          (line.startsWith("\t") ? 1 : 0);
        deltas.push(-count);
        return line.slice(count);
      });
      const totalDelta = deltas.reduce(
        (sum, value) => sum + value,
        0
      );
      const firstDelta = deltas[0] || 0;
      textarea.value =
        source.slice(0, lineStart) +
        transformed.join("\n") +
        source.slice(blockEnd);
      textarea.setSelectionRange(
        Math.max(
          lineStart,
          start + firstDelta
        ),
        Math.max(
          lineStart,
          end + totalDelta
        ),
        "forward"
      );
      commit();
      return true;
    };
    textarea.addEventListener(
      "keydown",
      event => {
        if (
          event.key === "Tab" &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey
        ) {
          event.preventDefault();
          indentSelection(
            4,
            event.shiftKey === true
          );
          return;
        }
        if (
          event.key === " " &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          !event.shiftKey &&
          textarea.selectionEnd >
            textarea.selectionStart
        ) {
          event.preventDefault();
          indentSelection(1);
        }
      }
    );
    textarea.addEventListener("input", () => {
      if (!composing) {
        commit();
      }
    });
    textarea.addEventListener("scroll", synchronizeGutterScroll, {
      passive: true
    });
    for (const eventName of ["click", "keyup", "select"]) {
      textarea.addEventListener(eventName, refreshCursorPosition);
    }
    textarea.addEventListener("blur", () => {
      if (!composing) {
        options.onBlur?.();
      }
    });
    if (options.enableNodeDrop === true) {
      const carriesGraphNode = dataTransfer =>
        Array.from(
          dataTransfer?.types || []
        ).includes(RML_GRAPH_NODE_DRAG_TYPE);
      textarea.addEventListener(
        "dragenter",
        event => {
          if (!carriesGraphNode(event.dataTransfer)) return;
          event.preventDefault();
          editorShell.classList.add(
            "node-drop-active"
          );
        }
      );
      textarea.addEventListener(
        "dragover",
        event => {
          if (!carriesGraphNode(event.dataTransfer)) return;
          event.preventDefault();
          if (event.dataTransfer) {
            event.dataTransfer.dropEffect = "copy";
          }
          editorShell.classList.add(
            "node-drop-active"
          );
        }
      );
      textarea.addEventListener(
        "dragleave",
        event => {
          if (
            event.relatedTarget &&
            editorShell.contains(
              event.relatedTarget
            )
          ) {
            return;
          }
          editorShell.classList.remove(
            "node-drop-active"
          );
        }
      );
      textarea.addEventListener(
        "drop",
        event => {
          if (!carriesGraphNode(event.dataTransfer)) return;
          event.preventDefault();
          editorShell.classList.remove(
            "node-drop-active"
          );
          let payload = null;
          try {
            payload = JSON.parse(
              event.dataTransfer.getData(
                RML_GRAPH_NODE_DRAG_TYPE
              ) || "null"
            );
          } catch {
            payload = null;
          }
          const resolved =
            options.onNodeDrop?.(payload);
          if (!insertNodeSnippet(resolved)) {
            statusMessage.textContent =
              "This node cannot be represented in the current C# field.";
            statusMessage.dataset.tone =
              "error";
          }
        }
      );
    }

    togglePageAreas.addEventListener("click", () => {
      const requested = !pageAreasHidden;
      const committed =
        options.onTogglePageAreas?.(requested);
      pageAreasHidden =
        typeof committed === "boolean"
          ? committed
          : requested;
      synchronizePageAreasButton();
    });

    const record = Object.freeze({
      popup,
      textarea,
      presentationMode,
      getValue() {
        return textarea.value;
      },
      setValue(value) {
        const next = String(value || "");
        if (textarea.value !== next) {
          textarea.value = next;
          refresh();
          if (!findWidget.hidden) {
            refreshMatches();
            if (findMatches.length) {
              revealActiveMatch();
            }
          }
        }
      },
      setAppearance(appearance) {
        appearanceState = normalizedAppearance(appearance);
        applyAppearance(
          popupDocument,
          editorShell,
          gutter,
          textarea,
          appearanceState
        );
        synchronizeAppearanceControls();
      },
      setStatus(status) {
        const state =
          status && typeof status === "object"
            ? status
            : { message: status };
        statusMessage.textContent =
          String(state.message || "Synchronized with Builder");
        statusMessage.dataset.tone =
          String(state.tone || "info");
      },
      appendOutput,
      setDiagnostics(values) {
        diagnostics = normalizedDiagnostics(values);
        diagnosticSnapshotTime =
          nextDiagnosticClock();
        renderDebugEntries();
        renderDiagnostics();
      },
      setDiagnosticSource(source) {
        commitDiagnosticSource(source);
      },
      setPageAreasHidden(hidden) {
        pageAreasHidden = hidden === true;
        synchronizePageAreasButton();
      },
      insertNodeSnippet,
      bringToFront() {
        popup.focus();
      },
      focus() {
        popup.focus();
        try {
          textarea.focus({ preventScroll: true });
        } catch {
          textarea.focus();
        }
      },
      close() {
        if (!popup.closed) {
          popup.close();
        }
      },
      refresh
    });

    let closedNotified = false;
    const notifyClosed = () => {
      if (closedNotified) return;
      closedNotified = true;
      options.onClosed?.(record);
    };
    popup.addEventListener(
      "beforeunload",
      notifyClosed,
      { once: true }
    );
    popup.addEventListener(
      "pagehide",
      notifyClosed,
      { once: true }
    );

    textarea.scrollTop = Math.max(
      0,
      Number(options.initialScroll?.top) || 0
    );
    textarea.scrollLeft = Math.max(
      0,
      Number(options.initialScroll?.left) || 0
    );
    record.focus();
    return record;
  }

  Object.defineProperty(
    window,
    "RMLCustomCSharpDetachedEditor",
    {
      value: Object.freeze({
        version: 28,
        mount
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
