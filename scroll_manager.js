(() => {
  "use strict";

  if (window.RMLScrollManager) return;

  const handlers = [];
  const revealProviders = [];
  let installed = false;
  let mobileViewportFrame = 0;
  let mobileFocusRevealFrame = 0;

  function sortHandlers() {
    handlers.sort((a, b) => b.priority - a.priority || a.order - b.order);
  }

  let order = 0;

  function registerWheelHandler(name, handler, priority = 0) {
    if (typeof handler !== "function") {
      throw new TypeError("Scroll manager wheel handler must be a function.");
    }

    const id = String(name || `handler-${order + 1}`);
    const existing = handlers.find(entry => entry.name === id);
    if (existing) {
      existing.handler = handler;
      existing.priority = Number(priority) || 0;
      sortHandlers();
      return () => unregisterWheelHandler(id);
    }

    handlers.push({
      name: id,
      handler,
      priority: Number(priority) || 0,
      order: order++
    });
    sortHandlers();
    ensureInstalled();
    return () => unregisterWheelHandler(id);
  }

  function unregisterWheelHandler(name) {
    const index = handlers.findIndex(entry => entry.name === name);
    if (index < 0) return false;
    handlers.splice(index, 1);
    return true;
  }

  function routeWheel(event) {
    if (
      event.isTrusted === true &&
      document.documentElement.classList.contains(
        "rml-setup-tour-active"
      )
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    for (const entry of [...handlers]) {
      if (event.cancelBubble || event.defaultPrevented) {
        break;
      }

      let handled = false;

      try {
        handled = entry.handler(event) === true;
      } catch (error) {
        console.error(`RML scroll handler failed: ${entry.name}`, error);
      }

      if (handled || event.cancelBubble || event.defaultPrevented) {
        break;
      }
    }
  }



  function createCyclicWheelStepper(options = {}) {
    const threshold =
      Math.max(
        1,
        Number(options.threshold) || 40
      );

    let accumulator = 0;
    let direction = 0;

    function reset() {
      accumulator = 0;
      direction = 0;
    }

    function step(index, count, dominantDelta) {
      const candidateCount =
        Math.max(
          0,
          Math.trunc(Number(count) || 0)
        );

      if (candidateCount <= 0) {
        reset();
        return {
          index: 0,
          moved: false,
          direction: 0
        };
      }

      const currentIndex =
        (
          Math.trunc(Number(index) || 0) %
            candidateCount +
          candidateCount
        ) % candidateCount;

      const nextDirection =
        Math.sign(
          Number(dominantDelta) || 0
        );

      if (nextDirection === 0) {
        return {
          index: currentIndex,
          moved: false,
          direction
        };
      }

      if (direction !== nextDirection) {
        accumulator = 0;
        direction = nextDirection;
      }

      accumulator +=
        Number(dominantDelta) || 0;

      if (
        Math.abs(accumulator) <
        threshold
      ) {
        return {
          index: currentIndex,
          moved: false,
          direction
        };
      }

      accumulator -=
        direction * threshold;

      return {
        index:
          (
            currentIndex +
            direction +
            candidateCount
          ) % candidateCount,
        moved: true,
        direction
      };
    }

    return Object.freeze({
      step,
      reset,
      getState() {
        return Object.freeze({
          accumulator,
          direction,
          threshold
        });
      }
    });
  }


  function registerRevealProvider(name, provider, priority = 0) {
    if (typeof provider !== "function") {
      throw new TypeError("Scroll manager reveal provider must be a function.");
    }

    const id = String(name || `reveal-${revealProviders.length + 1}`);
    const existing = revealProviders.find(entry => entry.name === id);

    if (existing) {
      existing.provider = provider;
      existing.priority = Number(priority) || 0;
      revealProviders.sort((a, b) => b.priority - a.priority || a.order - b.order);
      return () => unregisterRevealProvider(id);
    }

    revealProviders.push({
      name: id,
      provider,
      priority: Number(priority) || 0,
      order: revealProviders.length
    });
    revealProviders.sort((a, b) => b.priority - a.priority || a.order - b.order);

    return () => unregisterRevealProvider(id);
  }

  function unregisterRevealProvider(name) {
    const index = revealProviders.findIndex(entry => entry.name === name);
    if (index < 0) return false;
    revealProviders.splice(index, 1);
    return true;
  }

  function visibleViewportRectangle() {
    const visual = window.visualViewport;
    const left = visual?.offsetLeft || 0;
    const top = visual?.offsetTop || 0;
    const width = Math.max(
      1,
      visual?.width ||
      window.innerWidth ||
      document.documentElement.clientWidth ||
      1
    );
    const height = Math.max(
      1,
      visual?.height ||
      window.innerHeight ||
      document.documentElement.clientHeight ||
      1
    );

    return {
      left,
      top,
      right: left + width,
      bottom: top + height,
      width,
      height
    };
  }

  function scrollableOverflow(value) {
    return value === "auto" || value === "scroll" || value === "overlay";
  }

  function nativeScrollableAxes(element) {
    if (!(element instanceof HTMLElement)) {
      return { x: false, y: false };
    }

    const style = getComputedStyle(element);
    return {
      x:
        element.scrollWidth > element.clientWidth + 1 &&
        scrollableOverflow(style.overflowX),
      y:
        element.scrollHeight > element.clientHeight + 1 &&
        scrollableOverflow(style.overflowY)
    };
  }

  function nearestDelta(start, end, visibleStart, visibleEnd, margin) {
    const innerStart = visibleStart + margin;
    const innerEnd = visibleEnd - margin;
    const size = end - start;
    const available = Math.max(1, innerEnd - innerStart);

    if (size > available) {
      if (start < innerStart || start > innerEnd) {
        return innerStart - start;
      }
      return 0;
    }

    if (start < innerStart) {
      return innerStart - start;
    }

    if (end > innerEnd) {
      return innerEnd - end;
    }

    return 0;
  }

  function revealInsideScrollableAncestor(element, ancestor, margin, behavior) {
    const targetRect = element.getBoundingClientRect();
    const ancestorRect = ancestor.getBoundingClientRect();
    const axes = nativeScrollableAxes(ancestor);

    if (!axes.x && !axes.y) {
      return false;
    }

    const dx = axes.x
      ? nearestDelta(
          targetRect.left,
          targetRect.right,
          ancestorRect.left,
          ancestorRect.right,
          margin
        )
      : 0;

    const dy = axes.y
      ? nearestDelta(
          targetRect.top,
          targetRect.bottom,
          ancestorRect.top,
          ancestorRect.bottom,
          margin
        )
      : 0;

    if (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) {
      return false;
    }

    ancestor.scrollBy({
      left: -dx,
      top: -dy,
      behavior
    });
    return true;
  }

  function revealInsidePage(element, margin, topInset, behavior) {
    const rect = element.getBoundingClientRect();
    const viewport = visibleViewportRectangle();
    const visibleTop = Math.max(viewport.top, topInset);
    const dx = nearestDelta(
      rect.left,
      rect.right,
      viewport.left,
      viewport.right,
      margin
    );
    const dy = nearestDelta(
      rect.top,
      rect.bottom,
      visibleTop,
      viewport.bottom,
      margin
    );

    if (Math.abs(dx) <= 0.5 && Math.abs(dy) <= 0.5) {
      return false;
    }

    window.scrollBy({
      left: -dx,
      top: -dy,
      behavior
    });
    return true;
  }

  function revealElement(element, options = {}) {
    if (!(element instanceof HTMLElement) || !element.isConnected) {
      return false;
    }

    const margin = Math.max(0, Number(options.margin) || 18);
    const behavior =
      options.behavior === "auto"
        ? "auto"
        : "smooth";
    const topbar = document.querySelector(".topbar");
    const viewport = visibleViewportRectangle();
    const topInset = Math.max(
      viewport.top,
      topbar?.getBoundingClientRect().bottom || viewport.top
    );

    let moved = false;

    for (const entry of [...revealProviders]) {
      try {
        moved = entry.provider(element, {
          margin,
          topInset,
          viewport,
          reason: options.reason || "selection",
          behavior
        }) === true || moved;
      } catch (error) {
        console.error(`RML reveal provider failed: ${entry.name}`, error);
      }
    }

    let current = element.parentElement;
    while (current && current !== document.body && current !== document.documentElement) {
      moved = revealInsideScrollableAncestor(
        element,
        current,
        margin,
        behavior
      ) || moved;
      current = current.parentElement;
    }

    moved = revealInsidePage(
      element,
      margin,
      topInset,
      behavior
    ) || moved;

    return moved;
  }

  function ensureInstalled() {
    if (installed) return;
    installed = true;
    window.addEventListener("wheel", routeWheel, {
      capture: true,
      passive: false
    });
  }

  function mobileEditableControl(element) {
    return Boolean(
      element instanceof HTMLElement &&
      element.matches(
        "input:not([type='checkbox']):not([type='radio']):not([type='range']):not([type='color']):not([type='file']):not([type='button']):not([type='submit']):not([type='reset']), textarea, select, [contenteditable='true']"
      )
    );
  }

  function updateMobileViewportMetrics() {
    mobileViewportFrame = 0;
    const viewport = window.visualViewport;
    const width = Math.max(
      1,
      viewport?.width ||
        window.innerWidth ||
        document.documentElement.clientWidth ||
        1
    );
    const height = Math.max(
      1,
      viewport?.height ||
        window.innerHeight ||
        document.documentElement.clientHeight ||
        1
    );
    const rootStyle =
      document.documentElement.style;
    rootStyle.setProperty(
      "--rml-mobile-viewport-width",
      `${Math.round(width)}px`
    );
    rootStyle.setProperty(
      "--rml-mobile-viewport-height",
      `${Math.round(height)}px`
    );
    rootStyle.setProperty(
      "--rml-mobile-viewport-left",
      `${Math.round(viewport?.offsetLeft || 0)}px`
    );
    rootStyle.setProperty(
      "--rml-mobile-viewport-top",
      `${Math.round(viewport?.offsetTop || 0)}px`
    );
  }

  function revealFocusedMobileEditor() {
    mobileFocusRevealFrame = 0;
    const active = document.activeElement;
    if (!mobileEditableControl(active)) {
      return;
    }
    revealElement(active, {
      behavior: "auto",
      margin: 16,
      reason: "mobile-keyboard"
    });
  }

  function scheduleMobileViewportRefresh(
    revealFocused = true
  ) {
    if (!mobileViewportFrame) {
      mobileViewportFrame =
        window.requestAnimationFrame(
          updateMobileViewportMetrics
        );
    }
    if (
      revealFocused &&
      !mobileFocusRevealFrame
    ) {
      mobileFocusRevealFrame =
        window.requestAnimationFrame(
          revealFocusedMobileEditor
        );
    }
  }

  function installMobileViewportSupport() {
    const viewport = window.visualViewport;
    updateMobileViewportMetrics();

    window.addEventListener(
      "resize",
      () => scheduleMobileViewportRefresh(),
      { passive: true }
    );
    viewport?.addEventListener(
      "resize",
      () => scheduleMobileViewportRefresh(),
      { passive: true }
    );
    viewport?.addEventListener(
      "scroll",
      () => scheduleMobileViewportRefresh(false),
      { passive: true }
    );
    document.addEventListener(
      "focusin",
      event => {
        if (mobileEditableControl(event.target)) {
          scheduleMobileViewportRefresh(true);
        }
      },
      true
    );
  }

  Object.defineProperty(window, "RMLScrollManager", {
    value: Object.freeze({
      version: 8,
      registerWheelHandler,
      unregisterWheelHandler,
      createCyclicWheelStepper,
      registerRevealProvider,
      unregisterRevealProvider,
      revealElement,
      getHandlers() {
        return handlers.map(entry => ({
          name: entry.name,
          priority: entry.priority
        }));
      },
      getRevealProviders() {
        return revealProviders.map(entry => ({
          name: entry.name,
          priority: entry.priority
        }));
      }
    }),
    writable: false,
    enumerable: false,
    configurable: true
  });

  installMobileViewportSupport();
})();
