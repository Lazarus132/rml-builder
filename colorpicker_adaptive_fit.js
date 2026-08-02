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

    /*
     * This flag is set synchronously after every required geometry variable
     * has been written. CSS keeps the freshly inserted picker invisible only
     * during the impossible-to-fit intermediate state.
     */
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

  window.addEventListener(
    "resize",
    scheduleFit,
    {
      passive: true
    }
  );

  window.addEventListener(
    "orientationchange",
    () => {
      scheduleFit();
      setTimeout(
        scheduleFit,
        100
      );
      setTimeout(
        scheduleFit,
        300
      );
      setTimeout(
        scheduleFit,
        600
      );
    },
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
