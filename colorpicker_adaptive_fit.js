(() => {
  "use strict";

  const PORTRAIT_BASE_WIDTH = 435;
  const LANDSCAPE_BASE_WIDTH = 878;
  const LANDSCAPE_BASE_HEIGHT = 613;
  const EDGE_GAP = 12;

  function visibleViewport() {
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

    const viewport = visibleViewport();

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

    const portrait =
      viewport.height >= viewport.width;

    let scale;

    if (portrait) {
      /*
       * Portrait uses width only.
       * The palette sits below the controls and the middle area scrolls.
       */
      scale =
        (content.clientWidth - EDGE_GAP * 2) /
        PORTRAIT_BASE_WIDTH;
    } else {
      /*
       * Landscape must fit the complete original two-column picker into the
       * visible middle area, so both dimensions constrain the scale.
       */
      scale = Math.min(
        (content.clientWidth - EDGE_GAP * 2) /
          LANDSCAPE_BASE_WIDTH,
        (content.clientHeight - EDGE_GAP * 2) /
          LANDSCAPE_BASE_HEIGHT
      );
    }

    scale = Math.max(
      0.1,
      Math.min(scale, 1)
    );

    dialog.style.setProperty(
      "--rml-picker-scale",
      String(scale)
    );
  }

  let scheduledFrame = 0;

  function scheduleFit() {
    cancelAnimationFrame(scheduledFrame);

    scheduledFrame = requestAnimationFrame(() => {
      fitSettingsPreviewColorPicker();

      requestAnimationFrame(
        fitSettingsPreviewColorPicker
      );
    });
  }

  const observer = new MutationObserver(
    scheduleFit
  );

  observer.observe(
    document.documentElement,
    {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "open",
        "class"
      ]
    }
  );

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

  window.fitSettingsPreviewColorPicker =
    fitSettingsPreviewColorPicker;
})();
