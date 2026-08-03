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

  const ADAPTIVE_PROPERTIES = [
    "--rml-visible-width",
    "--rml-visible-height",
    "--rml-visual-left",
    "--rml-visual-top",
    "--rml-picker-scale",
    "--rml-picker-left",
    "--rml-picker-canvas-width",
    "--rml-picker-canvas-height"
  ];

  const SHARED_MOBILE_PROPERTIES = [
    "--rml-mobile-ui-scale"
  ];

  const HEADER_INLINE_PROPERTIES = [
    "position",
    "display",
    "width",
    "height",
    "min-height",
    "align-items",
    "grid-template-columns",
    "column-gap",
    "padding",
    "box-sizing"
  ];

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
    if (
      element.style.getPropertyValue(
        property
      ) !== value
    ) {
      element.style.setProperty(
        property,
        value
      );
    }
  }

  function setImportantStyle(
    element,
    property,
    value
  ) {
    if (!element) {
      return;
    }

    if (
      element.style.getPropertyValue(
        property
      ) !== value ||
      element.style.getPropertyPriority(
        property
      ) !== "important"
    ) {
      element.style.setProperty(
        property,
        value,
        "important"
      );
    }
  }

  function clearImportantStyles(
    element,
    properties
  ) {
    if (!element) {
      return;
    }

    for (const property of properties) {
      element.style.removeProperty(
        property
      );
    }
  }

  function readSafeAreaInsets() {
    const probe =
      document.createElement("div");

    probe.style.cssText = [
      "position:fixed",
      "visibility:hidden",
      "pointer-events:none",
      "inset:0 auto auto 0",
      "padding-top:env(safe-area-inset-top)",
      "padding-right:env(safe-area-inset-right)",
      "padding-bottom:env(safe-area-inset-bottom)",
      "padding-left:env(safe-area-inset-left)"
    ].join(";");

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

    headerPlaceholder.style.cssText = [
      "display:block",
      "width:100%",
      "height:100%",
      "min-width:0",
      "min-height:0",
      "pointer-events:none"
    ].join(";");

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

    header.removeAttribute("style");

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

    warning?.removeAttribute("style");
    title?.removeAttribute("style");
    close?.removeAttribute("style");
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

    setImportantStyle(
      header,
      "position",
      "absolute"
    );
    setImportantStyle(
      header,
      "z-index",
      "100"
    );
    setImportantStyle(
      header,
      "inset",
      "auto"
    );
    setImportantStyle(
      header,
      "top",
      "0px"
    );
    setImportantStyle(
      header,
      "left",
      `${headerLeft}px`
    );
    setImportantStyle(
      header,
      "right",
      "auto"
    );
    setImportantStyle(
      header,
      "display",
      "flex"
    );
    setImportantStyle(
      header,
      "width",
      `${viewport.width}px`
    );
    setImportantStyle(
      header,
      "height",
      `${headerHeight}px`
    );
    setImportantStyle(
      header,
      "min-height",
      `${headerHeight}px`
    );
    setImportantStyle(
      header,
      "align-items",
      "center"
    );
    setImportantStyle(
      header,
      "justify-content",
      "space-between"
    );
    setImportantStyle(
      header,
      "gap",
      `${8 * scale}px`
    );
    setImportantStyle(
      header,
      "padding",
      `${safe.top}px ${rightInset}px 0 ${leftInset}px`
    );
    setImportantStyle(
      header,
      "overflow",
      "hidden"
    );
    setImportantStyle(
      header,
      "background",
      "rgba(9, 13, 19, 0.995)"
    );
    setImportantStyle(
      header,
      "box-sizing",
      "border-box"
    );
    setImportantStyle(
      header,
      "transform",
      "none"
    );

    setImportantStyle(
      warning,
      "position",
      "static"
    );
    setImportantStyle(
      warning,
      "min-width",
      "0"
    );
    setImportantStyle(
      warning,
      "max-width",
      "31%"
    );
    setImportantStyle(
      warning,
      "margin",
      "0"
    );
    setImportantStyle(
      warning,
      "padding",
      "0"
    );
    setImportantStyle(
      warning,
      "overflow",
      "hidden"
    );
    setImportantStyle(
      warning,
      "font-size",
      `${warningFontSize}px`
    );
    setImportantStyle(
      warning,
      "line-height",
      "1.05"
    );
    setImportantStyle(
      warning,
      "text-overflow",
      "ellipsis"
    );
    setImportantStyle(
      warning,
      "white-space",
      "nowrap"
    );
    setImportantStyle(
      warning,
      "transform",
      "none"
    );

    setImportantStyle(
      title,
      "position",
      "static"
    );
    setImportantStyle(
      title,
      "min-width",
      "0"
    );
    setImportantStyle(
      title,
      "margin",
      "0 auto"
    );
    setImportantStyle(
      title,
      "padding",
      "0"
    );
    setImportantStyle(
      title,
      "flex",
      "1 1 auto"
    );
    setImportantStyle(
      title,
      "overflow",
      "hidden"
    );
    setImportantStyle(
      title,
      "font-size",
      `${titleFontSize}px`
    );
    setImportantStyle(
      title,
      "line-height",
      "1"
    );
    setImportantStyle(
      title,
      "text-align",
      "center"
    );
    setImportantStyle(
      title,
      "text-overflow",
      "ellipsis"
    );
    setImportantStyle(
      title,
      "white-space",
      "nowrap"
    );
    setImportantStyle(
      title,
      "transform",
      "none"
    );

    setImportantStyle(
      close,
      "position",
      "static"
    );
    setImportantStyle(
      close,
      "width",
      `${closeSize}px`
    );
    setImportantStyle(
      close,
      "min-width",
      `${closeSize}px`
    );
    setImportantStyle(
      close,
      "max-width",
      `${closeSize}px`
    );
    setImportantStyle(
      close,
      "height",
      `${closeSize}px`
    );
    setImportantStyle(
      close,
      "min-height",
      `${closeSize}px`
    );
    setImportantStyle(
      close,
      "max-height",
      `${closeSize}px`
    );
    setImportantStyle(
      close,
      "margin",
      "0"
    );
    setImportantStyle(
      close,
      "padding",
      `0 0 ${4 * scale}px`
    );
    setImportantStyle(
      close,
      "flex",
      `0 0 ${closeSize}px`
    );
    setImportantStyle(
      close,
      "font-size",
      `${closeFontSize}px`
    );
    setImportantStyle(
      close,
      "transform",
      "none"
    );
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
        const property of
        SHARED_MOBILE_PROPERTIES
      ) {
        dialog.style.removeProperty(
          property
        );
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
      const property of
      ADAPTIVE_PROPERTIES
    ) {
      dialog.style.removeProperty(
        property
      );
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