(() => {
  "use strict";

  const BASE_PICKER_WIDTH = 878;
  const BASE_PICKER_HEIGHT = 613;
  const EDGE_GAP = 10;

  function getVisibleViewport() {
    const viewport = window.visualViewport;

    if (viewport) {
      return {
        width: viewport.width,
        height: viewport.height,
        left: viewport.offsetLeft,
        top: viewport.offsetTop
      };
    }

    return {
      width: window.innerWidth,
      height: window.innerHeight,
      left: 0,
      top: 0
    };
  }

  function fitSettingsPreviewColorPicker() {
    const dialog = document.querySelector(
      ".settings-preview-dialog.rml-preview-color-open"
    );

    if (!dialog || !dialog.open) {
      return;
    }

    const viewport = getVisibleViewport();

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

    const content = dialog.querySelector(
      ".rml-preview-content"
    );

    if (!content) {
      return;
    }

    const availableWidth =
      Math.max(1, content.clientWidth - EDGE_GAP * 2);

    const availableHeight =
      Math.max(1, content.clientHeight - EDGE_GAP * 2);

    /*
     * One uniform factor from BOTH dimensions.
     * Portrait therefore grows until height or width is full.
     * Landscape shrinks until the complete picker remains visible.
     */
    const scale = Math.min(
      availableWidth / BASE_PICKER_WIDTH,
      availableHeight / BASE_PICKER_HEIGHT,
      1
    );

    dialog.style.setProperty(
      "--rml-picker-scale",
      String(Math.max(0.1, scale))
    );
  }

  let frame = 0;

  function scheduleFit() {
    cancelAnimationFrame(frame);

    frame = requestAnimationFrame(() => {
      fitSettingsPreviewColorPicker();

      /*
       * Safari can change its visual viewport again after toolbar animation.
       */
      requestAnimationFrame(
        fitSettingsPreviewColorPicker
      );
    });
  }

  const observer = new MutationObserver(scheduleFit);

  observer.observe(document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: [
      "open",
      "class"
    ]
  });

  window.addEventListener(
    "resize",
    scheduleFit,
    { passive: true }
  );

  window.addEventListener(
    "orientationchange",
    scheduleFit,
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

  /*
   * Public hook: call after opening or rerendering the picker.
   */
  window.fitSettingsPreviewColorPicker =
    fitSettingsPreviewColorPicker;
})();
