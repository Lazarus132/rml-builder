(() => {
  "use strict";
  // RML Builder editor: custom_csharp_editor.

  if (
    window.RMLCustomCSharpDetachedEditor?.version >= 37 &&
    typeof window.RMLCustomCSharpDetachedEditor?.mount === "function"
  ) {
    return;
  }

  const CUSTOM_CSHARP_SHORTCUT_BOOTSTRAP_VERSION = 18;

  function customCSharpSearchNavigationDirection(event) {
    const key = String(event?.key || "").toLowerCase();
    const code = String(event?.code || "").toLowerCase();
    const legacy = Number(event?.keyCode) || 0;
    const f3 = key === "f3" || code === "f3" || legacy === 114;
    const g = key === "g" || code === "keyg" || legacy === 71;
    if (
      f3 &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      return event.shiftKey ? -1 : 1;
    }
    if (
      g &&
      (event.ctrlKey || event.metaKey) &&
      !event.altKey
    ) {
      return event.shiftKey ? -1 : 1;
    }
    return 0;
  }

  function ensureCustomCSharpShortcutBootstrap(popup) {
    const property =
      "RMLCustomCSharpSearchShortcutBootstrap";
    const existing = popup?.[property];
    if (
      existing?.version >=
        CUSTOM_CSHARP_SHORTCUT_BOOTSTRAP_VERSION &&
      typeof existing.enqueue === "function" &&
      typeof existing.activate === "function"
    ) {
      return existing;
    }

    existing?.dispose?.();
    const claimedKeys = new Set();
    const pendingDirections = [];
    let delegate = null;
    let disposed = false;
    let broker = null;
    const shortcutKey = event =>
      String(
        event.code ||
        event.key ||
        event.keyCode ||
        ""
      ).toLowerCase();
    const claim = event => {
      if (event.cancelable) event.preventDefault();
      try {
        event.returnValue = false;
      } catch {}
      event.stopImmediatePropagation();
    };
    const enqueue = (direction, event = null) => {
      const normalized = direction < 0 ? -1 : 1;
      if (typeof delegate === "function") {
        delegate(normalized, event);
        return true;
      }
      if (
        event?.repeat !== true &&
        event?.isComposing !== true
      ) {
        pendingDirections.push(normalized);
        if (pendingDirections.length > 8) {
          pendingDirections.shift();
        }
      }
      return true;
    };
    const handleKeyDown = event => {
      const direction =
        customCSharpSearchNavigationDirection(event);
      if (direction === 0) return;
      claim(event);
      claimedKeys.add(shortcutKey(event));
      if (!event.isComposing) enqueue(direction, event);
    };
    const handleKeyUp = event => {
      if (!claimedKeys.delete(shortcutKey(event))) return;
      claim(event);
    };
    const clearClaims = () => claimedKeys.clear();
    const listenerOptions = {
      capture: true,
      passive: false
    };

    popup.addEventListener(
      "keydown",
      handleKeyDown,
      listenerOptions
    );
    popup.addEventListener(
      "keyup",
      handleKeyUp,
      listenerOptions
    );
    popup.addEventListener("blur", clearClaims);

    broker = Object.freeze({
      version:
        CUSTOM_CSHARP_SHORTCUT_BOOTSTRAP_VERSION,
      enqueue,
      activate(callback) {
        if (disposed) return false;
        delegate =
          typeof callback === "function"
            ? callback
            : null;
        if (!delegate) return false;
        const queued = pendingDirections.splice(0);
        for (const direction of queued) {
          delegate(direction, null);
        }
        return true;
      },
      dispose() {
        if (disposed) return;
        disposed = true;
        delegate = null;
        pendingDirections.length = 0;
        claimedKeys.clear();
        popup.removeEventListener(
          "keydown",
          handleKeyDown,
          true
        );
        popup.removeEventListener(
          "keyup",
          handleKeyUp,
          true
        );
        popup.removeEventListener("blur", clearClaims);
        if (popup[property] === broker) {
          try {
            delete popup[property];
          } catch {}
        }
      }
    });

    Object.defineProperty(popup, property, {
      value: broker,
      writable: false,
      enumerable: false,
      configurable: true
    });
    return broker;
  }

  const EDITOR_MODULE_URL =
    document.currentScript?.src ||
    document.baseURI;
  const EDITOR_STYLESHEET_URL = new URL(
    "../../styles/features/styles.custom-csharp-editor.css?v=5-editor-live-worker-v786",
    EDITOR_MODULE_URL
  ).href;

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

  function waitForStylesheet(
    popup,
    stylesheet
  ) {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true;
        popup.clearTimeout(timeoutId);
        stylesheet.removeEventListener(
          "load",
          handleLoad
        );
        stylesheet.removeEventListener(
          "error",
          handleError
        );
        if (error) {
          reject(error);
        } else {
          resolve(stylesheet);
        }
      };
      const handleLoad = () => finish();
      const handleError = () => finish(
        new Error(
          "The Custom C# editor stylesheet could not be loaded."
        )
      );
      const timeoutId = popup.setTimeout(
        () => finish(
          new Error(
            "The Custom C# editor stylesheet did not finish loading within 30 seconds."
          )
        ),
        30000
      );
      stylesheet.addEventListener(
        "load",
        handleLoad,
        { once: true }
      );
      stylesheet.addEventListener(
        "error",
        handleError,
        { once: true }
      );
    });
  }

  const DIAGNOSTIC_SOURCE_STORAGE_KEY =
    "rml-detached-editor-diagnostic-source-v1";
  const RML_GRAPH_NODE_DRAG_TYPE =
    "application/x-rml-graph-node";
  let diagnosticClockEpoch = 0;
  const diagnosticClockFormatter = new Intl.DateTimeFormat([], {
    hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3
  });
  const nextDiagnosticClock = () => {
    diagnosticClockEpoch = Math.max(
      Date.now(),
      diagnosticClockEpoch + 1
    );
    return diagnosticClockFormatter.format(diagnosticClockEpoch);
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
      const seen = new Set(target);
      for (const entry of Array.isArray(entries) ? entries : []) {
        const message = String(
          entry?.message || entry || ""
        );
        if (message && !seen.has(message)) {
          seen.add(message);
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
      rmlWorkbenchBackground: workbench,
      rmlCodeBackground: background,
      rmlGutterBackground: gutterBackground,
      rmlPanelBackground: normalized.panel,
      rmlOverlayBackground: normalized.overlay,
      rmlStatusBackground: normalized.status,
      rmlSelectionBackground: normalized.selection,
      rmlCodeText: text,
      rmlUiText: normalized.uiText,
      rmlGutterText: normalized.gutterText,
      rmlStatusText: normalized.statusText,
      rmlAccent: normalized.accent,
      rmlCaret: caret
    };
    for (const [name, value] of Object.entries(variables)) {
      popupDocument.documentElement.dataset[name] = value;
    }
    window.RMLClassStyles?.sync(
      popupDocument.documentElement
    );
  }

  async function mount(options = {}) {
    const popup = options.popup;
    if (!popup || popup.closed) {
      return null;
    }

    const shortcutBootstrap =
      ensureCustomCSharpShortcutBootstrap(popup);

    const popupDocument = popup.document;
    popupDocument.documentElement.lang =
      options.language || "en";
    popupDocument.title =
      String(options.documentTitle || "Custom C# · Code editor");
    const viewport = popupDocument.createElement("meta");
    viewport.name = "viewport";
    viewport.content =
      "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content";
    const title = popupDocument.createElement("title");
    title.textContent = popupDocument.title;
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
    const editorStylesheet =
      popupDocument.createElement("link");
    editorStylesheet.rel = "stylesheet";
    editorStylesheet.href = String(
      options.editorStylesheetUrl ||
        EDITOR_STYLESHEET_URL
    );
    editorStylesheet.dataset
      .rmlCustomCSharpEditorStyle = "true";
    const stylesheetReadiness = [...styleLinks, editorStylesheet].map(
      link => waitForStylesheet(popup, link)
    );
    popupDocument.head.append(
      viewport,
      title,
      ...styleLinks,
      editorStylesheet
    );
    await Promise.all(stylesheetReadiness);
    if (popup.closed) {
      return null;
    }
    const liveClassStyles = Array.from(popupDocument.head.querySelectorAll(
      "style[data-rml-class-style-rules]"
    ));
    const retainedHeadNodes = new Set([
      viewport, title, ...styleLinks, editorStylesheet, ...liveClassStyles
    ]);
    for (const child of [...popupDocument.head.childNodes]) {
      if (!retainedHeadNodes.has(child)) child.remove();
    }
    window.RMLClassStyles?.observe(popupDocument);
    popupDocument.body.replaceChildren();

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
      wrapper.appendChild(menu);

      let opened = false;
      let busy = false;
      const optionButtons = [];

      const positionMenu = () => {
        if (!opened) return;
        wrapper.classList.remove("open-above");
        const rect = trigger.getBoundingClientRect();
        const viewport = popup.visualViewport;
        const viewportTop = viewport?.offsetTop || 0;
        const viewportHeight = viewport?.height || popup.innerHeight;
        const margin = 8;
        const gap = 5;
        const measuredHeight =
          menu.getBoundingClientRect().height || 84;
        const below =
          viewportTop + viewportHeight - rect.bottom - margin - gap;
        const above =
          rect.top - viewportTop - margin - gap;
        wrapper.classList.toggle(
          "open-above",
          measuredHeight > below && above > below
        );
      };

      const close = (restoreFocus = false) => {
        if (!opened) return;
        opened = false;
        wrapper.classList.remove("open", "open-above");
        trigger.setAttribute("aria-expanded", "false");
        menu.hidden = true;
        popup.removeEventListener("resize", positionMenu);
        popup.visualViewport?.removeEventListener(
          "resize",
          positionMenu
        );
        popup.visualViewport?.removeEventListener(
          "scroll",
          positionMenu
        );
        popupDocument.removeEventListener(
          "scroll",
          positionMenu,
          true
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
        positionMenu();
        popup.addEventListener("resize", positionMenu);
        popup.visualViewport?.addEventListener(
          "resize",
          positionMenu
        );
        popup.visualViewport?.addEventListener(
          "scroll",
          positionMenu
        );
        popupDocument.addEventListener(
          "scroll",
          positionMenu,
          true
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
    textarea.wrap = "off";
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
    previousMatch.title = "Previous match (Shift+F3 or Ctrl/Command+Shift+G)";
    previousMatch.setAttribute("aria-label", previousMatch.title);
    previousMatch.setAttribute("aria-keyshortcuts", "Shift+F3 Control+Shift+G Meta+Shift+G");
    nextMatch.title = "Next match (F3 or Ctrl/Command+G)";
    nextMatch.setAttribute("aria-label", nextMatch.title);
    nextMatch.setAttribute("aria-keyshortcuts", "F3 Control+G Meta+G");
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
      updateEditorPresentation(() => {
        renderDebugEntries();
        renderDiagnostics();
      });
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
        controls.line.dataset.rmlColor =
          appearanceState[key];
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
        const selectedView = views.get(activeView);
        if (followTail.get(activeView) !== false) {
          selectedView.scrollTop = selectedView.scrollHeight;
        }
        publishScrollLayers();
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

    const embeddedHostElement = () => {
      if (
        options.hostElement
          ?.isConnected
      ) {
        return options.hostElement;
      }
      try {
        return popup.frameElement;
      } catch {
        return null;
      }
    };
    const embeddedLayerKey =
      options.scrollLayerKey ||
      "custom-csharp-editor";
    const embeddedLayerDefinitions = [
      {
        scrollElement: textarea,
        visualElement: editorShell,
        key: embeddedLayerKey,
        label:
          options.scrollLayerLabel ||
          "Custom C# code and line numbers"
      },
      {
        scrollElement: debugTabs,
        key:
          `${embeddedLayerKey}:debug-tabs`,
        label:
          "Custom C# debug view tabs"
      },
      ...viewDefinitions.map(
        ([id, label]) => ({
          scrollElement: views.get(id),
          key:
            `${embeddedLayerKey}:${id}`,
          label:
            `Custom C# ${label.toLowerCase()}`
        })
      ),
      {
        scrollElement: settingsOverlay,
        key:
          `${embeddedLayerKey}:settings`,
        label:
          "Custom C# editor settings"
      },
      {
        scrollElement: pickerPopover,
        key:
          `${embeddedLayerKey}:color-picker`,
        label:
          "Custom C# editor color picker"
      },
      ...Array.from(
        popupDocument.querySelectorAll(
          ".rml-graph-searchable-options"
        ),
        (scrollElement, index) => ({
          scrollElement,
          key:
            `${embeddedLayerKey}:options:${index}`,
          label:
            "Custom C# editor options"
        })
      )
    ].filter(
      definition =>
        definition.scrollElement
    );
    const embeddedLayerDetails =
      definition => ({
        hostElement:
          embeddedHostElement(),
        sourceWindow: popup,
        scrollElement:
          definition.scrollElement,
        key: definition.key,
        label: definition.label
      });
    const embeddedLayerForTarget =
      target =>
        embeddedLayerDefinitions.find(
          definition =>
            definition.scrollElement ===
              target ||
            definition.scrollElement
              .contains?.(target)
        ) ||
        embeddedLayerDefinitions[0];
    let presentationReady = false;
    let presentationDisposed = false;
    let presentationUpdateDepth = 0;
    let scrollSnapshot = [];
    let scrollSnapshotSignature = "";
    let scrollSnapshotQueued = false;
    let scrollMutationObserver = null;
    let scrollResizeObserver = null;
    let localScrollSession = null;
    let localScrollSelection = null;
    let localScrollOutline = null;
    const localWheelStepper = window.RMLScrollManager?.createCyclicWheelStepper?.({ threshold: 40 });
    const followTail = new Map(viewDefinitions.map(([id]) => [id, id !== "problems"]));

    const localScrollableOverflow = value => /^(auto|scroll|overlay)$/.test(value);
    const collectScrollLayers = () => {
      const viewport = Object.freeze({ width: popup.innerWidth, height: popup.innerHeight });
      return embeddedLayerDefinitions.map(definition => {
        const target = definition.scrollElement;
        const visual = definition.visualElement || target;
        const style = popup.getComputedStyle(target);
        const box = visual.getBoundingClientRect();
        let left = Math.max(0, box.left);
        let top = Math.max(0, box.top);
        let right = Math.min(viewport.width, box.right);
        let bottom = Math.min(viewport.height, box.bottom);

        for (let parent = visual.parentElement; parent && parent !== popupDocument.body; parent = parent.parentElement) {
          const parentStyle = popup.getComputedStyle(parent);
          if (parentStyle.overflowX !== "visible" || parentStyle.overflowY !== "visible") {
            const clip = parent.getBoundingClientRect();
            if (parentStyle.overflowX !== "visible") {
              left = Math.max(left, clip.left); right = Math.min(right, clip.right);
            }
            if (parentStyle.overflowY !== "visible") {
              top = Math.max(top, clip.top); bottom = Math.min(bottom, clip.bottom);
            }
          }
        }
        const rectangle = Object.freeze({
          left, top, right, bottom,
          width: Math.max(0, right - left), height: Math.max(0, bottom - top)
        });
        let visible = target.isConnected && !target.hidden && target.getClientRects().length > 0 &&
          style.display !== "none" && style.visibility !== "hidden" && style.visibility !== "collapse" &&
          rectangle.width >= 1 && rectangle.height >= 1;
        if (visible) {
          visible = [0.1, 0.5, 0.9].some(y => [0.1, 0.5, 0.9].some(x => {
            const hit = popupDocument.elementFromPoint(left + rectangle.width * x, top + rectangle.height * y);
            return hit === visual || visual.contains(hit);
          }));
        }
        const axes = Object.freeze({
          x: visible && target.scrollWidth > target.clientWidth + 1 && localScrollableOverflow(style.overflowX),
          y: visible && target.scrollHeight > target.clientHeight + 1 && localScrollableOverflow(style.overflowY)
        });
        return Object.freeze({
          ...embeddedLayerDetails(definition),
          snapshot: Object.freeze({ visible, axes, rectangle, viewport }),
          onScroll() {
            if (target === textarea) synchronizeGutterScroll();
          }
        });
      });
    };
    const localScrollCandidates = () => scrollSnapshot.filter(layer =>
      layer.snapshot.visible && (layer.snapshot.axes.x || layer.snapshot.axes.y));
    const renderLocalScrollSelection = () => {
      if (!separateWindow) return;
      const key = localScrollSession?.candidates[localScrollSession.index]?.key || localScrollSelection?.key;
      const active = localScrollCandidates().find(layer => layer.key === key);
      if (!active) {
        if (localScrollOutline) localScrollOutline.hidden = true;
        return;
      }
      if (!localScrollOutline) {
        localScrollOutline = popupDocument.createElement("div");
        localScrollOutline.className = "rml-scroll-layer-outline rml-editor-scroll-outline";
        localScrollOutline.setAttribute("aria-hidden", "true");
        popupDocument.body.appendChild(localScrollOutline);
      }
      const rect = active.snapshot.rectangle;
      Object.assign(localScrollOutline.dataset, {
        rmlBoxLeft: String(rect.left), rmlBoxTop: String(rect.top),
        rmlBoxWidth: String(rect.width), rmlBoxHeight: String(rect.height),
        rmlBoxRadius: "8px", label: active.label, kind: "embedded"
      });
      localScrollOutline.classList.toggle("preview", Boolean(localScrollSession));
      localScrollOutline.classList.toggle("selected", !localScrollSession);
      localScrollOutline.hidden = false;
      window.RMLClassStyles?.sync(localScrollOutline);
    };
    const clearLocalScrollSelection = () => {
      localScrollSession = null;
      localScrollSelection = null;
      localWheelStepper?.reset();
      if (localScrollOutline) localScrollOutline.hidden = true;
    };
    const reconcileLocalScrollSelection = () => {
      const candidates = localScrollCandidates();
      if (localScrollSession) {
        const key = localScrollSession.candidates[localScrollSession.index]?.key;
        const index = candidates.findIndex(layer => layer.key === key);
        localScrollSession.candidates = candidates;
        localScrollSession.index = index >= 0 ? index : Math.max(0, Math.min(localScrollSession.index, candidates.length - 1));
        if (!candidates.length) localScrollSession = null;
      }
      if (localScrollSelection && !candidates.some(layer => layer.key === localScrollSelection.key)) {
        localScrollSelection = null;
      }
      renderLocalScrollSelection();
    };
    const publishScrollLayers = () => {
      if (!presentationReady || presentationDisposed || presentationUpdateDepth) return;
      scrollSnapshotQueued = false;
      scrollMutationObserver?.takeRecords();
      const next = collectScrollLayers();
      const signature = JSON.stringify(next.map(layer => [layer.key, layer.snapshot]));
      if (signature === scrollSnapshotSignature) return;
      scrollSnapshotSignature = signature;
      scrollSnapshot = next;
      if (separateWindow) {
        reconcileLocalScrollSelection();
      } else {
        window.RMLUniversalScrollLayers?.updateEmbeddedSnapshot?.({
          hostElement: embeddedHostElement(), sourceWindow: popup, layers: next
        });
      }
    };
    const queueScrollSnapshot = () => {
      if (presentationDisposed || scrollSnapshotQueued) return;
      scrollSnapshotQueued = true;
      popup.requestAnimationFrame(() => {
        if (scrollSnapshotQueued) publishScrollLayers();
      });
    };
    const updateEditorPresentation = update => {
      presentationUpdateDepth += 1;
      try { return update(); }
      finally {
        presentationUpdateDepth -= 1;
        if (!presentationUpdateDepth) publishScrollLayers();
      }
    };
    const commitLocalScrollSelection = () => {
      publishScrollLayers();
      if (localScrollSession) {
        localScrollSelection = localScrollSession.candidates[localScrollSession.index] || null;
        localScrollSession = null;
        localWheelStepper?.reset();
      }
      renderLocalScrollSelection();
    };

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
      const keepTail = view.hidden
        ? followTail.get(viewId) !== false
        : view.scrollHeight - view.clientHeight - view.scrollTop <= 2;
      const previousTop = view.scrollTop;
      const fragment = popupDocument.createDocumentFragment();
      if (!visibleEntries.length) {
        const empty = popupDocument.createElement("span");
        empty.className = "debug-empty";
        empty.textContent =
          viewId === "debug"
            ? "Waiting for Roslyn, worker or Builder debug output…"
            : "No output yet.";
        fragment.appendChild(empty);
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
        fragment.appendChild(row);
      }
      view.replaceChildren(fragment);
      followTail.set(viewId, keepTail);
      if (!view.hidden) view.scrollTop = keepTail ? view.scrollHeight : previousTop;
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
      const fragment = popupDocument.createDocumentFragment();
      const previousTop = view.scrollTop;
      const visibleDiagnostics =
        diagnostics[diagnosticSource] || [];
      if (!visibleDiagnostics.length) {
        const empty = popupDocument.createElement("span");
        empty.className = "debug-empty";
        empty.textContent =
          `No ${diagnosticSource} problems detected.`;
        fragment.appendChild(empty);
      } else {
        for (const diagnostic of visibleDiagnostics) {
          const row = popupDocument.createElement("div");
          row.className = "problem";
          row.dataset.source = diagnosticSource;
          row.textContent = String(diagnostic);
          fragment.appendChild(row);
        }
      }
      view.replaceChildren(fragment);
      if (!view.hidden) view.scrollTop = previousTop;
      const count = tabs.get("problems")?.querySelector("output");
      if (count) {
        count.textContent = String(visibleDiagnostics.length);
        count.setAttribute(
          "aria-label",
          `${visibleDiagnostics.length} ${diagnosticSource} problem${visibleDiagnostics.length === 1 ? "" : "s"}`
        );
      }
    };
    const storeOutputEntry = entry => {
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
    };
    const appendOutput = entry => updateEditorPresentation(() => {
      storeOutputEntry(entry);
      renderEntries("output", outputEntries);
    });
    const replaceOutput = entries => {
      outputEntries.length = 0;
      for (const entry of Array.isArray(entries) ? entries : []) storeOutputEntry(entry);
      renderEntries("output", outputEntries);
    };
    for (const entry of Array.isArray(options.output) ? options.output : []) {
      storeOutputEntry(entry);
    }
    renderEntries("output", outputEntries);
    renderDebugEntries();
    renderDiagnostics();

    let lineSource = null;
    let lineStarts = [0];
    let renderedLineCount = 0;
    let validationPending = false;
    const refreshLineNumbers = () => {
      const source = textarea.value;
      if (source !== lineSource) {
        lineSource = source;
        lineStarts = [0];
        let at = -1;
        while ((at = source.indexOf("\n", at + 1)) >= 0) lineStarts.push(at + 1);
      }
      const count = lineStarts.length;
      if (count === renderedLineCount) return;
      renderedLineCount = count;
      gutter.style.setProperty("--rml-code-line-digits", String(Math.max(4, String(count).length)));
      lineNumbers.textContent = Array.from({ length: count }, (_, index) => String(index + 1)).join("\n");
    };
    const refreshCursorPosition = () => {
      const offset = Math.max(0, textarea.selectionStart || 0);
      let lower = 0, upper = lineStarts.length;
      while (lower + 1 < upper) {
        const middle = (lower + upper) >>> 1;
        if (lineStarts[middle] <= offset) lower = middle;
        else upper = middle;
      }
      const label = `Ln ${lower + 1}, Col ${offset - lineStarts[lower] + 1}`;
      if (cursorPosition.textContent !== label) cursorPosition.textContent = label;
    };
    const synchronizeGutterScroll = () => {
      if (gutter.scrollTop !== textarea.scrollTop) {
        gutter.scrollTop = textarea.scrollTop;
      }
    };
    const refresh = () => {
      refreshLineNumbers();
      refreshCursorPosition();
      queueScrollSnapshot();
    };
    refresh();

    let composing = false;
    const commit = () => {
      options.onInput?.(textarea.value);
      const label = validationPending ? "Synchronized with Builder · Checking C# 14…" : "Synchronized with Builder";
      if (statusMessage.textContent !== label) statusMessage.textContent = label;
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
      () => {
        clearLocalScrollSelection();
        if (!separateWindow) {
          window.RMLUniversalScrollLayers
            ?.clear?.();
          window.RMLTypedNodeGraphScrollLayers
            ?.clear?.();
        }
        options.onRequestForeground?.();
      },
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
    showFind.setAttribute("aria-keyshortcuts", "Control+F Meta+F");
    showReplace.setAttribute("aria-keyshortcuts", "Control+H Meta+Alt+F");
    const handledEditorShortcutKeys = new Set();
    const editorShortcutAbort = new popup.AbortController();
    const editorShortcutKey = event =>
      String(
        event.code ||
        event.key ||
        event.keyCode ||
        ""
      ).toLowerCase();
    const editorShortcutAction = event => {
      const command =
        event.ctrlKey || event.metaKey;
      const key =
        String(event.key || "")
          .toLowerCase();
      const code =
        String(event.code || "")
          .toLowerCase();
      const legacy =
        Number(event.keyCode) || 0;
      const f3 =
        key === "f3" ||
        code === "f3" ||
        legacy === 114;
      const f =
        key === "f" ||
        code === "keyf" ||
        legacy === 70;
      const g =
        key === "g" ||
        code === "keyg" ||
        legacy === 71;
      const h =
        key === "h" ||
        code === "keyh" ||
        legacy === 72;
      if (
        f3 &&
        !command &&
        !event.altKey
      ) {
        return event.shiftKey
          ? "previous"
          : "next";
      }
      if (
        command &&
        g &&
        !event.altKey
      ) {
        return event.shiftKey
          ? "previous"
          : "next";
      }
      if (
        command &&
        f &&
        !event.altKey &&
        !event.shiftKey
      ) {
        return "find";
      }
      if (
        !event.shiftKey &&
        (
          (command && !event.altKey && h) ||
          (event.metaKey && event.altKey && f)
        )
      ) {
        return "replace";
      }
      return "";
    };
    const consumeEditorShortcut = event => {
      if (event.cancelable) event.preventDefault();
      try {
        event.returnValue = false;
      } catch {}
      event.stopImmediatePropagation();
      if (event.type === "keydown") handledEditorShortcutKeys.add(editorShortcutKey(event));
    };
    const clearEditorScrollForKey = event => {
      if (event.key !== "Control" && event.key !== "Meta" &&
          !(event.key === "Shift" && (localScrollSession?.candidates[localScrollSession.index] || localScrollSelection)?.snapshot.axes.x)) {
        clearLocalScrollSelection();
      }
      if (!separateWindow) window.RMLUniversalScrollLayers?.handleKeyDown?.(event);
    };
    const runEditorSearchNavigation = (
      direction,
      event = null
    ) => {
      if (event) {
        clearEditorScrollForKey(event);
      } else {
        clearLocalScrollSelection();
        if (!separateWindow) {
          window.RMLUniversalScrollLayers?.clear?.();
          window.RMLTypedNodeGraphScrollLayers?.clear?.();
        }
      }
      if (findWidget.hidden) {
        openFind(false);
      } else {
        stepMatch(direction < 0 ? -1 : 1);
      }
      return true;
    };
    const handleEditorShortcutKeyDown = event => {
      const action =
        editorShortcutAction(event);
      if (!action) return;
      const identity = editorShortcutKey(event);
      consumeEditorShortcut(event);
      if (event.isComposing) return;
      if (
        event.repeat &&
        (
          action === "find" ||
          action === "replace"
        )
      ) {
        return;
      }
      if (action === "find") {
        clearEditorScrollForKey(event);
        openFind(false);
      } else if (action === "replace") {
        clearEditorScrollForKey(event);
        openFind(true);
      } else {
        runEditorSearchNavigation(
          action === "previous" ? -1 : 1,
          event
        );
      }
      handledEditorShortcutKeys.add(identity);
    };
    const handleEditorShortcutKeyUp = event => {
      if (handledEditorShortcutKeys.delete(editorShortcutKey(event))) consumeEditorShortcut(event);
    };
    const editorShortcutListenerOptions = {
      capture: true,
      passive: false,
      signal: editorShortcutAbort.signal
    };
    popup.addEventListener(
      "keydown",
      handleEditorShortcutKeyDown,
      editorShortcutListenerOptions
    );
    popup.addEventListener(
      "keyup",
      handleEditorShortcutKeyUp,
      editorShortcutListenerOptions
    );
    popupDocument.addEventListener(
      "keydown",
      handleEditorShortcutKeyDown,
      editorShortcutListenerOptions
    );
    popupDocument.addEventListener(
      "keyup",
      handleEditorShortcutKeyUp,
      editorShortcutListenerOptions
    );
    shortcutBootstrap?.activate?.(
      runEditorSearchNavigation
    );
    popup.addEventListener("blur", () => handledEditorShortcutKeys.clear(), { signal: editorShortcutAbort.signal });
    popupDocument.addEventListener("keydown", event => {
      clearEditorScrollForKey(event);
      if (event.defaultPrevented) return;
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
    }, { passive: false, signal: editorShortcutAbort.signal });
    popupDocument.addEventListener("keyup", event => {
      if (event.key === "Control" || event.key === "Meta") {
        if (separateWindow) commitLocalScrollSelection();
        else window.RMLUniversalScrollLayers?.commit?.();
      }
    }, { signal: editorShortcutAbort.signal });
    popup.addEventListener("blur", () => {
      if (separateWindow) commitLocalScrollSelection();
      else window.RMLUniversalScrollLayers?.commit?.();
    }, { signal: editorShortcutAbort.signal });
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
    const normalizedEditorWheelDelta = (
      event,
      referenceElement = textarea
    ) => {
      const unit =
        event.deltaMode === 1
          ? Number.parseFloat(
              popup.getComputedStyle(
                referenceElement
              ).lineHeight
            ) || 24
          : event.deltaMode === 2
            ? Math.max(
                1,
                referenceElement
                  .clientHeight
              )
            : 1;
      let x = (Number(event.deltaX) || 0) * unit;
      let y = (Number(event.deltaY) || 0) * unit;
      if (
        event.shiftKey &&
        Math.abs(x) < Math.abs(y)
      ) {
        x = y;
        y = 0;
      }
      return { x, y };
    };
    const routeUnifiedEditorWheel = event => {
      publishScrollLayers();
      const target = event.target;
      const overGutter =
        target === gutter ||
        gutter.contains(target);
      const modifier =
        event.ctrlKey || event.metaKey;
      const layerDefinition =
        embeddedLayerForTarget(target);
      const layerDetails = embeddedLayerDetails(layerDefinition);
      if (separateWindow && modifier) {
        const candidates = localScrollCandidates();
        const starting = !localScrollSession;
        if (starting) {
          localScrollSession = candidates.length ? { candidates, index: 0 } : null;
          localWheelStepper?.reset();
        } else if (candidates.length) {
          const delta = normalizedEditorWheelDelta(event, layerDefinition.scrollElement);
          const dominant = Math.abs(delta.y) >= Math.abs(delta.x) ? delta.y : delta.x;
          const stepped = localWheelStepper?.step(localScrollSession.index, candidates.length, dominant);
          localScrollSession.index = stepped ? stepped.index :
            (localScrollSession.index + Math.sign(dominant) + candidates.length) % candidates.length;
        }
        renderLocalScrollSelection();
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      if (separateWindow && localScrollSession) commitLocalScrollSelection();
      if (separateWindow && localScrollSelection) {
        const selected = localScrollCandidates().find(layer => layer.key === localScrollSelection.key);
        if (selected) {
          const target = selected.scrollElement;
          let { x, y } = normalizedEditorWheelDelta(event, target);
          const axes = selected.snapshot.axes;
          if (!axes.y && axes.x && Math.abs(x) < Math.abs(y)) { x = y; y = 0; }
          if (axes.x) target.scrollLeft += x;
          if (axes.y) target.scrollTop += y;
          selected.onScroll();
          event.preventDefault();
          event.stopImmediatePropagation();
          return;
        }
        clearLocalScrollSelection();
      }
      const bridgeHandled =
        !separateWindow &&
        window.RMLUniversalScrollLayers
          ?.routeEmbeddedWheel?.({
            event,
            ...layerDetails
          }) === true;
      if (bridgeHandled) {
        synchronizeGutterScroll();
        return;
      }
      if (
        !overGutter &&
        !(separateWindow && modifier)
      ) {
        return;
      }
      const scrollOwner =
        overGutter
          ? textarea
          : layerDefinition
              .scrollElement;
      const delta =
        normalizedEditorWheelDelta(
          event,
          scrollOwner
        );
      const previousTop =
        scrollOwner.scrollTop;
      const previousLeft =
        scrollOwner.scrollLeft;
      scrollOwner.scrollTop += delta.y;
      scrollOwner.scrollLeft += delta.x;
      if (scrollOwner === textarea) {
        synchronizeGutterScroll();
      }
      if (
        modifier ||
        scrollOwner.scrollTop !==
          previousTop ||
        scrollOwner.scrollLeft !==
          previousLeft
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    popupDocument.addEventListener(
      "wheel",
      routeUnifiedEditorWheel,
      {
        capture: true,
        passive: false
      }
    );
    for (const eventName of ["click", "keyup", "select"]) {
      textarea.addEventListener(eventName, refreshCursorPosition);
    }
    textarea.addEventListener("blur", () => {
      if (!composing && !presentationDisposed) {
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
          let payload;
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
      setValidationPending(pending) {
        const next = pending === true;
        if (next === validationPending) return;
        validationPending = next;
        debugPanel.dataset.validationPending = String(next);
        debugPanel.title = next ? "Checking the current source; the last completed diagnostic snapshot remains visible." : "";
        statusMessage.textContent = next ? "Synchronized with Builder · Checking C# 14…" : "Synchronized with Builder";
        statusMessage.dataset.tone = "info";
      },
      setDiagnostics(values) {
        updateEditorPresentation(() => {
          diagnostics = normalizedDiagnostics(values);
          diagnosticSnapshotTime = nextDiagnosticClock();
          renderDebugEntries();
          renderDiagnostics();
        });
      },
      applySnapshot(snapshot = {}) {
        updateEditorPresentation(() => {
          if (Object.hasOwn(snapshot, "value")) record.setValue(snapshot.value);
          if (Object.hasOwn(snapshot, "appearance")) record.setAppearance(snapshot.appearance);
          if (Object.hasOwn(snapshot, "status")) record.setStatus(snapshot.status);
          if (Object.hasOwn(snapshot, "output")) replaceOutput(snapshot.output);
          if (Object.hasOwn(snapshot, "diagnostics")) record.setDiagnostics(snapshot.diagnostics);
        });
      },
      getScrollState() {
        return Object.freeze({
          cycling: Boolean(localScrollSession),
          selectedKey: localScrollSelection?.key || "",
          previewKey: localScrollSession?.candidates[localScrollSession.index]?.key || "",
          candidates: localScrollCandidates().map(layer => ({ key: layer.key, label: layer.label, ...layer.snapshot }))
        });
      },
      setDiagnosticSource(source) {
        commitDiagnosticSource(source);
      },
      setPageAreasHidden(hidden) {
        pageAreasHidden = hidden === true;
        synchronizePageAreasButton();
      },
      runSearchShortcut(direction) {
        return shortcutBootstrap?.enqueue?.(direction) === true;
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
      dispose() {
        if (presentationDisposed) return;
        presentationDisposed = true;
        shortcutBootstrap?.dispose?.();
        editorShortcutAbort.abort();
        handledEditorShortcutKeys.clear();
        scrollSnapshotQueued = false;
        scrollMutationObserver?.disconnect();
        scrollResizeObserver?.disconnect();
        clearLocalScrollSelection();
        if (!separateWindow) {
          window.RMLUniversalScrollLayers?.releaseEmbedded?.({
            hostElement: embeddedHostElement(), sourceWindow: popup
          });
        }
      },
      close() {
        record.dispose();
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
      record.dispose();
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
    for (const [id, view] of views) {
      view.addEventListener("scroll", () => {
        if (!view.hidden) followTail.set(id, view.scrollHeight - view.clientHeight - view.scrollTop <= 2);
      }, { passive: true });
    }
    if (typeof popup.MutationObserver === "function") {
      scrollMutationObserver = new popup.MutationObserver(records => {
        if (records.some(change => change.target !== localScrollOutline &&
            !(change.type === "childList" && [...change.addedNodes, ...change.removedNodes].every(node => node === localScrollOutline)))) {
          queueScrollSnapshot();
        }
      });
      scrollMutationObserver.observe(popupDocument.body, {
        subtree: true, childList: true, characterData: true,
        attributes: true, attributeFilter: ["hidden", "class", "style"]
      });
    }
    if (typeof popup.ResizeObserver === "function") {
      scrollResizeObserver = new popup.ResizeObserver(queueScrollSnapshot);
      for (const target of new Set([popupDocument.body, editorShell, debugViews,
        ...embeddedLayerDefinitions.map(definition => definition.scrollElement)])) {
        scrollResizeObserver.observe(target);
      }
    }
    popup.addEventListener("resize", queueScrollSnapshot, { passive: true });
    popupDocument.addEventListener("scroll", queueScrollSnapshot, { capture: true, passive: true });
    popupDocument.fonts?.ready.then(queueScrollSnapshot);
    presentationReady = true;
    publishScrollLayers();
    record.focus();
    return record;
  }

  Object.defineProperty(
    window,
    "RMLCustomCSharpDetachedEditor",
    {
      value: Object.freeze({
        version: 37,
        mount
      }),
      writable: false,
      enumerable: true,
      configurable: true
    }
  );
})();
