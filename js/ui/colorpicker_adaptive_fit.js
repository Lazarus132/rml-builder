(() => {
  "use strict";

  const PORTRAIT_WIDTH = 435;
  const PORTRAIT_HEIGHT = 1242;
  const LANDSCAPE_WIDTH = 878;
  const LANDSCAPE_HEIGHT = 613;

  const SIDE_GAP = 12;
  const VERTICAL_GAP = 12;

  const MOBILE_MAX_WIDTH = 980;
  const SHORT_MAX_HEIGHT = 720;

  const ADAPTIVE_PROPERTIES = new Map([
    ["--rml-visible-width", "rmlVisibleWidth"],
    ["--rml-visible-height", "rmlVisibleHeight"],
    ["--rml-visual-left", "rmlVisualLeft"],
    ["--rml-visual-top", "rmlVisualTop"],
    ["--rml-picker-scale", "rmlPickerScale"],
    ["--rml-picker-left", "rmlPickerLeft"],
    ["--rml-picker-canvas-width", "rmlPickerCanvasWidth"],
    ["--rml-picker-canvas-height", "rmlPickerCanvasHeight"]
  ]);

  const SHARED_MOBILE_PROPERTIES = new Map([
    ["--rml-mobile-ui-scale", "rmlMobileUiScale"]
  ]);

  const dialog =
    document.getElementById(
      "settings-preview-dialog"
    );

  let frameId = 0;
  let lastOrientation = "";
  let wasOpen = false;
  let adaptiveActive = false;

  function readVisibleViewport() {
    const viewport =
      window.visualViewport;

    if (viewport) {
      return {
        width:
          Math.max(
            1,
            viewport.width
          ),
        height:
          Math.max(
            1,
            viewport.height
          ),
        left:
          viewport.offsetLeft,
        top:
          viewport.offsetTop
      };
    }

    return {
      width:
        Math.max(
          1,
          window.innerWidth ||
          document.documentElement.clientWidth
        ),
      height:
        Math.max(
          1,
          window.innerHeight ||
          document.documentElement.clientHeight
        ),
      left: 0,
      top: 0
    };
  }

  function isAdaptiveViewport(
    viewport
  ) {
    return (
      viewport.width <=
        MOBILE_MAX_WIDTH ||
      viewport.height <=
        SHORT_MAX_HEIGHT
    );
  }

  function setStyleProperty(
    element,
    property,
    value
  ) {
    const dataKey =
      ADAPTIVE_PROPERTIES.get(property) ||
      SHARED_MOBILE_PROPERTIES.get(property);
    if (
      dataKey &&
      element?.dataset?.[dataKey] !== value
    ) {
      element.dataset[dataKey] = value;
    }
  }


  function readSafeAreaInsets() {
    const probe =
      document.createElement("div");

    probe.className =
      "rml-safe-area-probe";

    document.documentElement
      .appendChild(probe);

    const computed =
      getComputedStyle(probe);

    const result = {
      top:
        parseFloat(
          computed.paddingTop
        ) || 0,
      right:
        parseFloat(
          computed.paddingRight
        ) || 0,
      bottom:
        parseFloat(
          computed.paddingBottom
        ) || 0,
      left:
        parseFloat(
          computed.paddingLeft
        ) || 0
    };

    probe.remove();

    return result;
  }

  let headerPlaceholder = null;

  function getPreviewWindow() {
    return dialog?.querySelector(
      ".rml-preview-window"
    ) || null;
  }

  function getPreviewHeader() {
    return dialog?.querySelector(
      ".rml-preview-header"
    ) || null;
  }

  function ensureHeaderPlaceholder(
    previewWindow,
    header
  ) {
    if (
      headerPlaceholder &&
      headerPlaceholder.isConnected
    ) {
      return headerPlaceholder;
    }

    headerPlaceholder =
      document.createElement("div");

    headerPlaceholder.setAttribute(
      "data-rml-header-placeholder",
      "true"
    );

    headerPlaceholder.setAttribute(
      "aria-hidden",
      "true"
    );

    previewWindow.insertBefore(
      headerPlaceholder,
      header
    );

    return headerPlaceholder;
  }

  function restoreHeaderToWindow() {
    if (!dialog) {
      return;
    }

    const previewWindow =
      getPreviewWindow();

    const header =
      getPreviewHeader();

    if (
      !previewWindow ||
      !header
    ) {
      return;
    }

    if (
      header.parentElement !==
      previewWindow
    ) {
      if (
        headerPlaceholder &&
        headerPlaceholder.parentElement ===
          previewWindow
      ) {
        previewWindow.insertBefore(
          header,
          headerPlaceholder.nextSibling
        );
      } else {
        previewWindow.insertBefore(
          header,
          previewWindow.firstChild
        );
      }
    }

    if (
      headerPlaceholder &&
      headerPlaceholder.isConnected
    ) {
      headerPlaceholder.remove();
    }

    headerPlaceholder = null;

    header.removeAttribute(
      "data-rml-shared-mobile-header"
    );

    const warning =
      header.querySelector(
        ":scope > div"
      );

    const title =
      header.querySelector("h2");

    const close =
      header.querySelector(
        ".rml-preview-close"
      );

    header.classList.remove(
      "rml-adaptive-preview-header"
    );
    warning?.classList.remove(
      "rml-adaptive-preview-warning"
    );
    title?.classList.remove(
      "rml-adaptive-preview-title"
    );
    close?.classList.remove(
      "rml-adaptive-preview-close"
    );
  }

  function applySharedHeaderLayout(
    viewport
  ) {
    if (!dialog) {
      return;
    }

    if (
      !dialog.open ||
      !isAdaptiveViewport(viewport)
    ) {
      restoreHeaderToWindow();
      return;
    }

    const previewWindow =
      getPreviewWindow();

    const header =
      getPreviewHeader();

    if (
      !previewWindow ||
      !header
    ) {
      return;
    }

    ensureHeaderPlaceholder(
      previewWindow,
      header
    );

    if (
      header.parentElement !== dialog
    ) {
      dialog.appendChild(header);
    }

    header.setAttribute(
      "data-rml-shared-mobile-header",
      "true"
    );

    const warning =
      header.querySelector(
        ":scope > div"
      );

    const title =
      header.querySelector("h2");

    const close =
      header.querySelector(
        ".rml-preview-close"
      );

    if (
      !warning ||
      !title ||
      !close
    ) {
      return;
    }

    const portrait =
      viewport.height >=
      viewport.width;

    const designWidth =
      portrait
        ? PORTRAIT_WIDTH
        : LANDSCAPE_WIDTH;

    const usableWidth =
      Math.max(
        1,
        viewport.width -
        SIDE_GAP * 2
      );

    const scale =
      Math.min(
        1,
        usableWidth /
        designWidth
      );

    const safe =
      readSafeAreaInsets();

    const headerContentHeight =
      50 * scale;

    const headerHeight =
      safe.top +
      headerContentHeight;

    const rightInset =
      Math.max(
        10 * scale,
        safe.right
      );

    const leftInset =
      Math.max(
        12 * scale,
        safe.left
      );

    const closeSize =
      42 * scale;

    const closeFontSize =
      38 * scale;

    const warningFontSize =
      Math.max(
        7,
        9 * scale
      );

    const titleFontSize =
      Math.min(
        30,
        Math.max(
          16,
          30 * scale
        )
      );

    const dialogRect =
      dialog.getBoundingClientRect();

    const headerLeft =
      viewport.left -
      dialogRect.left;

    header.classList.add(
      "rml-adaptive-preview-header"
    );
    header.dataset.rmlHeaderLeft =
      String(headerLeft);
    header.dataset.rmlHeaderWidth =
      String(viewport.width);
    header.dataset.rmlHeaderHeight =
      String(headerHeight);
    header.dataset.rmlHeaderGap =
      String(8 * scale);
    header.dataset.rmlHeaderSafeTop =
      String(safe.top);
    header.dataset.rmlHeaderRightInset =
      String(rightInset);
    header.dataset.rmlHeaderLeftInset =
      String(leftInset);

    warning.classList.add(
      "rml-adaptive-preview-warning"
    );
    warning.dataset.rmlFontSize =
      String(warningFontSize);

    title.classList.add(
      "rml-adaptive-preview-title"
    );
    title.dataset.rmlFontSize =
      String(titleFontSize);

    close.classList.add(
      "rml-adaptive-preview-close"
    );
    close.dataset.rmlControlSize =
      String(closeSize);
    close.dataset.rmlFontSize =
      String(closeFontSize);
    close.dataset.rmlBottomPadding =
      String(4 * scale);
  }

  function updateSharedMobileScale(
    viewport
  ) {
    if (!dialog) {
      return;
    }

    const dialogOpen =
      Boolean(dialog.open);

    if (
      !dialogOpen ||
      !isAdaptiveViewport(viewport)
    ) {
      for (
        const dataKey of
        SHARED_MOBILE_PROPERTIES.values()
      ) {
        delete dialog.dataset[dataKey];
      }

      return;
    }

    const portrait =
      viewport.height >=
      viewport.width;

    const designWidth =
      portrait
        ? PORTRAIT_WIDTH
        : LANDSCAPE_WIDTH;

    const usableWidth =
      Math.max(
        1,
        viewport.width -
        SIDE_GAP * 2
      );

    const scale =
      Math.min(
        1,
        usableWidth /
        designWidth
      );

    setStyleProperty(
      dialog,
      "--rml-mobile-ui-scale",
      String(scale)
    );
  }

  function clearAdaptiveState() {
    if (
      !dialog ||
      !adaptiveActive
    ) {
      return;
    }

    delete dialog.dataset
      .pickerOrientation;

    delete dialog.dataset
      .pickerFitted;

    for (
      const dataKey of
      ADAPTIVE_PROPERTIES.values()
    ) {
      delete dialog.dataset[dataKey];
    }

    adaptiveActive = false;
    wasOpen = false;
    lastOrientation = "";
  }

  function resetScroll() {
    const content =
      dialog?.querySelector(
        ".rml-preview-content"
      );

    if (!content) {
      return;
    }

    content.scrollTop = 0;
    content.scrollLeft = 0;

    requestAnimationFrame(() => {
      content.scrollTop = 0;
      content.scrollLeft = 0;
    });
  }

  function fitSettingsPreviewColorPicker() {
    const viewport =
      readVisibleViewport();

    updateSharedMobileScale(
      viewport
    );

    applySharedHeaderLayout(
      viewport
    );

    const colorPageOpen =
      Boolean(
        dialog?.open &&
        dialog.classList.contains(
          "rml-preview-color-open"
        )
      );

    if (!colorPageOpen) {
      if (dialog) {
        delete dialog.dataset
          .pickerFitted;
      }

      clearAdaptiveState();
      wasOpen = false;
      return;
    }

    if (!isAdaptiveViewport(viewport)) {
      clearAdaptiveState();
      return;
    }

    const portrait =
      viewport.height >=
      viewport.width;

    const orientation =
      portrait
        ? "portrait"
        : "landscape";

    const designWidth =
      portrait
        ? PORTRAIT_WIDTH
        : LANDSCAPE_WIDTH;

    const designHeight =
      portrait
        ? PORTRAIT_HEIGHT
        : LANDSCAPE_HEIGHT;

    const usableWidth =
      Math.max(
        1,
        viewport.width -
        SIDE_GAP * 2
      );

    const scale =
      Math.min(
        1,
        usableWidth /
        designWidth
      );

    const scaledWidth =
      designWidth * scale;

    const scaledHeight =
      designHeight * scale;

    const canvasWidth =
      Math.max(
        viewport.width,
        scaledWidth +
        SIDE_GAP * 2
      );

    const canvasHeight =
      scaledHeight +
      VERTICAL_GAP * 2;

    const pickerLeft =
      Math.max(
        SIDE_GAP,
        (
          canvasWidth -
          scaledWidth
        ) / 2
      );

    if (
      dialog.dataset
        .pickerOrientation !==
      orientation
    ) {
      dialog.dataset
        .pickerOrientation =
        orientation;
    }

    setStyleProperty(
      dialog,
      "--rml-visible-width",
      `${viewport.width}px`
    );
    setStyleProperty(
      dialog,
      "--rml-visible-height",
      `${viewport.height}px`
    );
    setStyleProperty(
      dialog,
      "--rml-visual-left",
      `${viewport.left}px`
    );
    setStyleProperty(
      dialog,
      "--rml-visual-top",
      `${viewport.top}px`
    );
    setStyleProperty(
      dialog,
      "--rml-picker-scale",
      String(scale)
    );
    setStyleProperty(
      dialog,
      "--rml-picker-left",
      `${pickerLeft}px`
    );
    setStyleProperty(
      dialog,
      "--rml-picker-canvas-width",
      `${canvasWidth}px`
    );
    setStyleProperty(
      dialog,
      "--rml-picker-canvas-height",
      `${canvasHeight}px`
    );

    dialog.dataset.pickerFitted =
      "true";

    const newlyOpened =
      !wasOpen;

    const orientationChanged =
      orientation !==
      lastOrientation;

    if (
      newlyOpened ||
      orientationChanged
    ) {
      resetScroll();
    }

    adaptiveActive = true;
    wasOpen = true;
    lastOrientation =
      orientation;
  }

  function scheduleFit() {
    cancelAnimationFrame(
      frameId
    );

    frameId =
      requestAnimationFrame(() => {
        fitSettingsPreviewColorPicker();

        requestAnimationFrame(
          fitSettingsPreviewColorPicker
        );
      });
  }

  if (dialog) {
    const mutationObserver =
      new MutationObserver(
        scheduleFit
      );

    mutationObserver.observe(
      dialog,
      {
        attributes: true,
        attributeFilter: [
          "open",
          "class"
        ]
      }
    );
  }

  if (
    dialog &&
    typeof ResizeObserver ===
      "function"
  ) {
    const resizeObserver =
      new ResizeObserver(
        scheduleFit
      );

    resizeObserver.observe(
      document.documentElement
    );

    resizeObserver.observe(
      dialog
    );

    const content =
      dialog.querySelector(
        ".rml-preview-content"
      );

    if (content) {
      resizeObserver.observe(
        content
      );
    }
  }

  window.addEventListener(
    "resize",
    scheduleFit,
    {
      passive: true
    }
  );

  window.addEventListener(
    "orientationchange",
    scheduleFit,
    {
      passive: true
    }
  );

  if (window.visualViewport) {
    window.visualViewport
      .addEventListener(
        "resize",
        scheduleFit,
        {
          passive: true
        }
      );

    window.visualViewport
      .addEventListener(
        "scroll",
        scheduleFit,
        {
          passive: true
        }
      );
  }

  if (
    document.readyState ===
    "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      scheduleFit,
      {
        once: true
      }
    );
  } else {
    scheduleFit();
  }

  window.fitSettingsPreviewColorPicker =
    fitSettingsPreviewColorPicker;

  window.resetSettingsPreviewColorPickerScroll =
    resetScroll;
})();
