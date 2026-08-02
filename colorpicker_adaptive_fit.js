(() => {
  "use strict";

  const PORTRAIT_BASE_WIDTH = 435;
  const PORTRAIT_BASE_HEIGHT = 1242;

  const LANDSCAPE_BASE_WIDTH = 878;
  const LANDSCAPE_BASE_HEIGHT = 613;

  const CONTENT_GAP = 12;

  /*
   * Querformat wird niemals kleiner als 72 %.
   * Reicht der Platz dafür nicht aus, wird gescrollt statt weiter verkleinert.
   */
  const MIN_LANDSCAPE_SCALE = 0.72;

  let scheduledFrame = 0;
  let lastOrientation = "";
  let lastColorPageOpen = false;

  function visibleViewport() {
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

  function finitePositive(value, fallback) {
    return Number.isFinite(value) && value > 0
      ? value
      : fallback;
  }

  function resetPickerScroll(dialog) {
    const content = dialog.querySelector(
      ".rml-preview-content"
    );

    if (!content) {
      return;
    }

    /*
     * Sofort und noch einmal im nächsten Frame.
     * Das verhindert insbesondere auf iOS Safari, dass eine alte
     * Scrollposition nach Rendern oder Drehen wiederhergestellt wird.
     */
    content.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant"
    });

    requestAnimationFrame(() => {
      content.scrollTo({
        top: 0,
        left: 0,
        behavior: "instant"
      });
    });
  }

  function fitSettingsPreviewColorPicker() {
    const dialog = document.querySelector(
      ".settings-preview-dialog"
    );

    const colorPageOpen = Boolean(
      dialog &&
      dialog.open &&
      dialog.classList.contains(
        "rml-preview-color-open"
      )
    );

    if (!colorPageOpen) {
      lastColorPageOpen = false;
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

    const contentWidth = finitePositive(
      content.clientWidth,
      viewport.width
    );

    const contentHeight = finitePositive(
      content.clientHeight,
      viewport.height
    );

    const portrait =
      viewport.height >= viewport.width;

    const orientation =
      portrait
        ? "portrait"
        : "landscape";

    let scale;
    let scaledWidth;
    let scaledHeight;

    if (portrait) {
      /*
       * Im Hochformat bestimmt ausschließlich die Breite die Skalierung.
       * Die Gesamthöhe bleibt scrollbar.
       */
      scale = Math.min(
        1,
        Math.max(
          0.1,
          (
            contentWidth -
            CONTENT_GAP * 2
          ) /
          PORTRAIT_BASE_WIDTH
        )
      );

      scaledWidth =
        PORTRAIT_BASE_WIDTH *
        scale;

      scaledHeight =
        PORTRAIT_BASE_HEIGHT *
        scale;
    } else {
      const widthScale =
        (
          contentWidth -
          CONTENT_GAP * 2
        ) /
        LANDSCAPE_BASE_WIDTH;

      const heightScale =
        (
          contentHeight -
          CONTENT_GAP * 2
        ) /
        LANDSCAPE_BASE_HEIGHT;

      const fittedScale =
        Math.min(
          widthScale,
          heightScale,
          1
        );

      /*
       * Unterhalb von 72 % wird nicht weiter verkleinert.
       * Stattdessen bekommt der mittlere Bereich horizontales und
       * vertikales Scrollen.
       */
      scale = Math.min(
        1,
        Math.max(
          MIN_LANDSCAPE_SCALE,
          fittedScale
        )
      );

      scaledWidth =
        LANDSCAPE_BASE_WIDTH *
        scale;

      scaledHeight =
        LANDSCAPE_BASE_HEIGHT *
        scale;
    }

    dialog.dataset.pickerOrientation =
      orientation;

    dialog.style.setProperty(
      "--rml-picker-scale",
      String(scale)
    );

    dialog.style.setProperty(
      "--rml-picker-scaled-width",
      `${scaledWidth}px`
    );

    dialog.style.setProperty(
      "--rml-picker-scaled-height",
      `${scaledHeight}px`
    );

    dialog.style.setProperty(
      "--rml-picker-canvas-width",
      `${Math.max(
        contentWidth,
        scaledWidth +
        CONTENT_GAP * 2
      )}px`
    );

    dialog.style.setProperty(
      "--rml-picker-canvas-height",
      `${Math.max(
        contentHeight,
        scaledHeight +
        CONTENT_GAP * 2
      )}px`
    );

    const newlyOpened =
      !lastColorPageOpen;

    const orientationChanged =
      orientation !==
      lastOrientation;

    if (
      newlyOpened ||
      orientationChanged
    ) {
      resetPickerScroll(dialog);
    }

    lastColorPageOpen = true;
    lastOrientation = orientation;
  }

  function scheduleFit() {
    cancelAnimationFrame(
      scheduledFrame
    );

    scheduledFrame =
      requestAnimationFrame(() => {
        fitSettingsPreviewColorPicker();

        requestAnimationFrame(
          fitSettingsPreviewColorPicker
        );
      });
  }

  const observer =
    new MutationObserver(
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
    {
      passive: true
    }
  );

  window.addEventListener(
    "orientationchange",
    () => {
      /*
       * iOS liefert direkt beim orientationchange häufig noch die alten
       * VisualViewport-Maße. Deshalb mehrere spätere Messungen.
       */
      scheduleFit();

      window.setTimeout(
        scheduleFit,
        100
      );

      window.setTimeout(
        scheduleFit,
        300
      );

      window.setTimeout(
        scheduleFit,
        600
      );
    },
    {
      passive: true
    }
  );

  if (window.visualViewport) {
    window.visualViewport.addEventListener(
      "resize",
      scheduleFit,
      {
        passive: true
      }
    );

    window.visualViewport.addEventListener(
      "scroll",
      scheduleFit,
      {
        passive: true
      }
    );
  }

  document.addEventListener(
    "DOMContentLoaded",
    scheduleFit,
    {
      once: true
    }
  );

  window.fitSettingsPreviewColorPicker =
    fitSettingsPreviewColorPicker;

  window.resetSettingsPreviewColorPickerScroll =
    () => {
      const dialog =
        document.querySelector(
          ".settings-preview-dialog.rml-preview-color-open"
        );

      if (dialog) {
        resetPickerScroll(dialog);
      }
    };
})();