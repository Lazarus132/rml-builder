(() => {
  "use strict";

  if (window.RMLScrollHierarchy?.version >= 8) {
    return;
  }

  function uniqueDescriptors(descriptors) {
    const result = [];
    const keys = new Set();

    for (const descriptor of Array.isArray(descriptors) ? descriptors : []) {
      const key = String(descriptor?.key || "");
      if (!descriptor || !key || keys.has(key)) continue;
      keys.add(key);
      result.push(descriptor);
    }

    return result;
  }

  function rectangleFor(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected) return null;
    try {
      return element.getBoundingClientRect();
    } catch {
      return null;
    }
  }

  function elementDepth(element) {
    let depth = 0;
    let current = element;
    const seen = new Set();
    while (current?.parentElement && !seen.has(current)) {
      seen.add(current);
      depth += 1;
      current = current.parentElement;
    }
    return depth;
  }

  function visualCompare(left, right) {
    if (!left.rect && !right.rect) return left.index - right.index;
    if (!left.rect) return 1;
    if (!right.rect) return -1;

    const l = left.rect;
    const r = right.rect;
    const overlap = Math.max(0, Math.min(l.bottom, r.bottom) - Math.max(l.top, r.top));
    const smallerHeight = Math.max(1, Math.min(l.height, r.height));
    const sameRow = overlap >= Math.min(24, smallerHeight * 0.35);

    if (sameRow) {
      const dx = l.left - r.left;
      if (Math.abs(dx) > 1) return dx;
      const dy = l.top - r.top;
      if (Math.abs(dy) > 1) return dy;
    } else {
      const dy = l.top - r.top;
      if (Math.abs(dy) > 1) return dy;
      const dx = l.left - r.left;
      if (Math.abs(dx) > 1) return dx;
    }

    const db = l.bottom - r.bottom;
    if (Math.abs(db) > 1) return db;
    const dr = l.right - r.right;
    if (Math.abs(dr) > 1) return dr;
    return left.index - right.index;
  }

  function orderByReadingHierarchy(descriptors, options = {}) {
    const resolveElement = typeof options.resolveElement === "function"
      ? options.resolveElement
      : () => null;
    const kindRank = typeof options.kindRank === "function"
      ? options.kindRank
      : () => 0;
    const isVirtualParent = typeof options.isVirtualParent === "function"
      ? options.isVirtualParent
      : () => false;

    const items = uniqueDescriptors(descriptors).map((descriptor, index) => {
      let element = null;
      try {
        const resolved = resolveElement(descriptor);
        element = resolved instanceof HTMLElement && resolved.isConnected ? resolved : null;
      } catch {}

      return {
        descriptor,
        element,
        rect: rectangleFor(element),
        domDepth: elementDepth(element),
        index,
        parent: null,
        children: [],
        treeDepth: 0,
        coordinate: [0, 0, 0]
      };
    });

    const canParent = (parent, child) => {
      if (!parent || !child || parent === child) return false;

      try {
        if (
          parent.element &&
          child.element &&
          parent.element !== child.element &&
          parent.element.contains(child.element)
        ) {
          return true;
        }
      } catch {}

      try {
        return isVirtualParent(parent.descriptor, child.descriptor) === true;
      } catch {
        return false;
      }
    };

    for (const child of items) {
      const possible = items.filter(parent => canParent(parent, child));
      if (!possible.length) continue;

      possible.sort((left, right) => {
        const leftReal = Boolean(
          left.element && child.element && left.element !== child.element && left.element.contains(child.element)
        );
        const rightReal = Boolean(
          right.element && child.element && right.element !== child.element && right.element.contains(child.element)
        );

        if (leftReal !== rightReal) return leftReal ? -1 : 1;
        if (leftReal && rightReal) {
          const depthDifference = right.domDepth - left.domDepth;
          if (depthDifference) return depthDifference;
        }

        const visual = visualCompare(left, right);
        if (visual) return -visual;
        return left.index - right.index;
      });

      child.parent = possible[0];
      child.parent.children.push(child);
    }

    const roots = items.filter(item => !item.parent);

    const sortSiblings = siblings => siblings.sort((left, right) => {
      const rankDifference = Number(kindRank(left.descriptor) || 0) - Number(kindRank(right.descriptor) || 0);
      if (rankDifference) return rankDifference;
      return visualCompare(left, right);
    });

    sortSiblings(roots);
    for (const item of items) sortSiblings(item.children);

    const ordered = [];
    let globalOrder = 0;

    const visit = (item, depth) => {
      item.treeDepth = depth;
      item.coordinate = [
        item.rect ? Number(item.rect.left.toFixed(3)) : Number.POSITIVE_INFINITY,
        item.rect ? Number(item.rect.top.toFixed(3)) : Number.POSITIVE_INFINITY,
        depth
      ];
      ordered.push(item);
      globalOrder += 1;
      for (const child of item.children) visit(child, depth + 1);
    };

    for (const root of roots) visit(root, 0);

    if (ordered.length !== items.length) {
      const seen = new Set(ordered);
      for (const item of items) {
        if (!seen.has(item)) ordered.push(item);
      }
    }

    return ordered.map(item => item.descriptor);
  }

  function enforceParentBeforeDescendants(descriptors, options = {}) {
    const items = uniqueDescriptors(descriptors);
    const parentKey = String(options.parentKey || "");
    const isDescendant = typeof options.isDescendant === "function"
      ? options.isDescendant
      : () => false;

    if (!parentKey) return items;
    const parentIndex = items.findIndex(descriptor => descriptor.key === parentKey);
    if (parentIndex < 0) return items;

    const parent = items[parentIndex];
    const descendants = [];
    const remainder = [];

    for (const descriptor of items) {
      if (descriptor.key === parentKey) continue;
      let belongs = false;
      try {
        belongs = isDescendant(descriptor) === true;
      } catch {}
      if (belongs) descendants.push(descriptor);
      else remainder.push(descriptor);
    }

    let parentPosition = 0;
    for (let index = 0; index < parentIndex; index += 1) {
      const descriptor = items[index];
      if (
        descriptor.key !== parentKey &&
        !descendants.some(value => value.key === descriptor.key)
      ) {
        parentPosition += 1;
      }
    }

    remainder.splice(parentPosition, 0, parent, ...descendants);
    return remainder;
  }


  const api = Object.freeze({
    version: 8,
    orderByReadingHierarchy,
    enforceParentBeforeDescendants
  });

  Object.defineProperty(window, "RMLScrollHierarchy", {
    value: api,
    writable: false,
    enumerable: false,
    configurable: true
  });
})();