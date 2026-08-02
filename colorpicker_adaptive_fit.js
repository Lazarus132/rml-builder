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

  let frameId = 0;
  let lastOrientation = "";
  let wasOpen = false;

  function readVisibleViewport() {
    const viewport = window.visualViewport;

    if (viewport) {
      return {
        width: Math.max(1, viewport.width),
        height: Math.max(1, viewport.height),
        left: viewport.offsetLeft,
        top: viewport.offsetTop
      };
    }

    return {
      width: Math.max(
        1,
        window.innerWidth ||
        document.documentElement.clientWidth
      ),
      height: Math.max(
        1,
        window.innerHeight ||
        document.documentElement.clientHeight
      ),
      left: 0,
      top: 0
    };
  }

  function isAdaptiveViewport(viewport) {
    return (
      viewport.width <= MOBILE_MAX_WIDTH ||
      viewport.height <= SHORT_MAX_HEIGHT
    );
  }

  function clearAdaptiveState(dialog) {
    delete dialog.dataset.pickerOrientation;

    for (const property of [
      "--rml-visible-width",
      "--rml-visible-height",
      "--rml-visual-left",
      "--rml-visual-top",
      "--rml-picker-scale",
      "--rml-mobile-ui-scale",
      "--rml-picker-left",
      "--rml-picker-canvas-width",
      "--rml-picker-canvas-height"
    ]) {
      dialog.style.removeProperty(property);
    }

    wasOpen = false;
    lastOrientation = "";
  }

  function resetScroll(dialog) {
    const content = dialog.querySelector(
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
    const dialog = document.querySelector(
      ".settings-preview-dialog.rml-preview-color-open"
    );

    if (!dialog || !dialog.open) {
      wasOpen = false;
      return;
    }

    const viewport = readVisibleViewport();

    if (!isAdaptiveViewport(viewport)) {
      clearAdaptiveState(dialog);
      return;
    }

    const portrait =
      viewport.height >= viewport.width;

    const orientation =
      portrait ? "portrait" : "landscape";

    const designWidth =
      portrait ? PORTRAIT_WIDTH : LANDSCAPE_WIDTH;

    const designHeight =
      portrait ? PORTRAIT_HEIGHT : LANDSCAPE_HEIGHT;

    const usableWidth = Math.max(
      1,
      viewport.width - SIDE_GAP * 2
    );

    const scale = Math.min(
      1,
      usableWidth / designWidth
    );

    const scaledWidth =
      designWidth * scale;

    const scaledHeight =
      designHeight * scale;

    const canvasWidth = Math.max(
      viewport.width,
      scaledWidth + SIDE_GAP * 2
    );

    const canvasHeight =
      scaledHeight + VERTICAL_GAP * 2;

    const pickerLeft = Math.max(
      SIDE_GAP,
      (canvasWidth - scaledWidth) / 2
    );

    dialog.dataset.pickerOrientation =
      orientation;

    dialog.style.setProperty(
      "--rml-visible-width",
      `${viewport.width}px`
    );
    dialog.style.setProperty(
      "--rml-visible-height",
      `${viewport.height}px`
    );
    dialog.style.setProperty(
      "--rml-visual-left",
      `${viewport.left}px`
    );
    dialog.style.setProperty(
      "--rml-visual-top",
      `${viewport.top}px`
    );
    dialog.style.setProperty(
      "--rml-picker-scale",
      String(scale)
    );

    dialog.style.setProperty(
      "--rml-mobile-ui-scale",
      String(scale)
    );
    dialog.style.setProperty(
      "--rml-picker-left",
      `${pickerLeft}px`
    );
    dialog.style.setProperty(
      "--rml-picker-canvas-width",
      `${canvasWidth}px`
    );
    dialog.style.setProperty(
      "--rml-picker-canvas-height",
      `${canvasHeight}px`
    );

    const newlyOpened = !wasOpen;
    const orientationChanged =
      orientation !== lastOrientation;

    if (newlyOpened || orientationChanged) {
      resetScroll(dialog);
    }

    wasOpen = true;
    lastOrientation = orientation;
  }

  function scheduleFit() {
    cancelAnimationFrame(frameId);

    frameId = requestAnimationFrame(() => {
      fitSettingsPreviewColorPicker();
      requestAnimationFrame(
        fitSettingsPreviewColorPicker
      );
    });
  }

  const mutationObserver =
    new MutationObserver(scheduleFit);

  mutationObserver.observe(
    document.documentElement,
    {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["open", "class"]
    }
  );

  window.addEventListener(
    "resize",
    scheduleFit,
    { passive: true }
  );

  window.addEventListener(
    "orientationchange",
    () => {
      scheduleFit();
      setTimeout(scheduleFit, 100);
      setTimeout(scheduleFit, 300);
      setTimeout(scheduleFit, 600);
    },
    { passive: true }
  );

  if (window.visualViewport) {
    window.visualViewport.addEventListener(
      "resize",
      scheduleFit,
      { passive: true }
    );

    window.visualViewport.addEventListener(
      "scroll",
      scheduleFit,
      { passive: true }
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    scheduleFit,
    { once: true }
  );

  window.fitSettingsPreviewColorPicker =
    fitSettingsPreviewColorPicker;

  window.resetSettingsPreviewColorPickerScroll =
    () => {
      const dialog = document.querySelector(
        ".settings-preview-dialog.rml-preview-color-open"
      );

      if (dialog) {
        resetScroll(dialog);
      }
    };
})();
