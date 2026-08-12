(() => {
  "use strict";

  if (window.RMLScrollManager) return;

  const handlers = [];
  const revealProviders = [];
  let installed = false;

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
    for (const entry of [...handlers]) {
      if (event.cancelBubble || event.defaultPrevented) break;

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

  Object.defineProperty(window, "RMLScrollManager", {
    value: Object.freeze({
      version: 3,
      registerWheelHandler,
      unregisterWheelHandler,
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
})();
