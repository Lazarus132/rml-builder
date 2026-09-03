"use strict";

// Guided Runtime Graph planning, routing and verification.

function guidedStep11Finite(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

function guidedStep11Snap(value, step) {
    return Math.round(guidedStep11Finite(value, 0) / step) * step;
  }

function guidedStep11PlainRect(rect) {
    if (!rect) return null;
    const left = guidedStep11Finite(rect.left, 0);
    const top = guidedStep11Finite(rect.top, 0);
    const right = guidedStep11Finite(rect.right, left);
    const bottom = guidedStep11Finite(rect.bottom, top);
    return {
      left,
      top,
      right,
      bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    };
  }

function guidedStep11NodeElement(nodeId) {
    return dom.nodesHost?.querySelector(
      `.rml-graph-node[data-graph-node-id="${CSS.escape(String(nodeId || ""))}"]`
    ) || null;
  }

function guidedStep11NodeDimensions(node) {
    const element = guidedStep11NodeElement(node?.id);
    const estimated = node
      ? estimatedGraphNodeGeometry(node)
      : null;
    return {
      width: Math.max(
        1,
        guidedStep11Finite(
          element?.offsetWidth,
          guidedStep11Finite(
            node?.width,
            estimated?.width ||
              (node?.kind === "configuration" ? 390 : 280)
          )
        )
      ),
      height: Math.max(
        1,
        guidedStep11Finite(
          element?.offsetHeight,
          guidedStep11Finite(
            node?.height,
            estimated?.height ||
              (node?.kind === "configuration" ? 240 : 96)
          )
        )
      )
    };
  }

function guidedStep11NodeRecord(
    node,
    position = null,
    size = null
  ) {
    const dimensions = guidedStep11NodeDimensions(node);
    const width = Math.max(
      1,
      guidedStep11Finite(size?.width, dimensions.width)
    );
    const height = Math.max(
      1,
      guidedStep11Finite(size?.height, dimensions.height)
    );
    const x = guidedStep11Finite(position?.x, guidedStep11Finite(node?.x, 0));
    const y = guidedStep11Finite(position?.y, guidedStep11Finite(node?.y, 0));
    return {
      id: String(node?.id || ""),
      kind: String(node?.kind || ""),
      operatorId: String(node?.operatorId || ""),
      x,
      y,
      width,
      height,
      rect: {
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        width,
        height
      }
    };
  }

function guidedStep11SocketTemplate(nodeId, portId, direction) {
    const node = findGraphNode(nodeId);
    if (!node) return null;
    const current = socketGraphCenter(nodeId, portId, direction);
    if (!current) return null;
    const element = socketElement(nodeId, portId, direction);
    const reference = graphPortReference(node, portId, direction);
    const dimensions = guidedStep11NodeDimensions(node);
    const localX =
      current.x - guidedStep11Finite(node.x, 0);
    return {
      nodeId,
      portId,
      direction,
      localX,
      localY: current.y - guidedStep11Finite(node.y, 0),
      referenceWidth: dimensions.width,
      leftInset: localX,
      rightInset: dimensions.width - localX,
      side:
        element?.dataset.side ||
        reference?.side ||
        (direction === "input" ? "left" : "right")
    };
  }

function guidedStep11SocketAt(template, nodeRecord) {
    if (!template || !nodeRecord) return null;
    const x = template.side === "right"
      ? nodeRecord.x + nodeRecord.width -
          guidedStep11Finite(template.rightInset, 0)
      : template.side === "left"
        ? nodeRecord.x +
            guidedStep11Finite(
              template.leftInset,
              template.localX
            )
        : nodeRecord.x + template.localX;
    return {
      x,
      y: nodeRecord.y + template.localY,
      side: template.side,
      nodeId: nodeRecord.id,
      portId: template.portId,
      direction: template.direction
    };
  }

function guidedStep11CubicControlPoints(from, to) {
    const horizontal = Math.abs(to.x - from.x);
    const vertical = Math.abs(to.y - from.y);
    const control = nodeGraphClamp(
      Math.max(horizontal * .48, vertical * .24),
      36,
      260
    );
    const fromDirection = from.side === "left" ? -1 : 1;
    const toDirection = to.side === "right" ? 1 : -1;
    return {
      p0: { x: from.x, y: from.y },
      p1: { x: from.x + control * fromDirection, y: from.y },
      p2: { x: to.x + control * toDirection, y: to.y },
      p3: { x: to.x, y: to.y },
      control
    };
  }

function guidedStep11CubicPoint(control, t) {
    const raw = nodeGraphClamp(guidedStep11Finite(t, 0), 0, 1);
    const inverse = 1 - raw;
    return {
      x:
        inverse * inverse * inverse * control.p0.x +
        3 * inverse * inverse * raw * control.p1.x +
        3 * inverse * raw * raw * control.p2.x +
        raw * raw * raw * control.p3.x,
      y:
        inverse * inverse * inverse * control.p0.y +
        3 * inverse * inverse * raw * control.p1.y +
        3 * inverse * raw * raw * control.p2.y +
        raw * raw * raw * control.p3.y
    };
  }

function guidedStep11Segment(rawFrom, rawTo, sampleCount = 42) {
    const from = {
      ...rawFrom,
      side:
        rawFrom.side ||
        (rawTo.x >= rawFrom.x ? "right" : "left")
    };
    const to = {
      ...rawTo,
      side:
        rawTo.side ||
        (rawFrom.x <= rawTo.x ? "left" : "right")
    };
    const control = guidedStep11CubicControlPoints(from, to);
    const count = Math.max(8, Math.trunc(sampleCount));
    const points = [];
    for (let index = 0; index <= count; index += 1) {
      points.push(guidedStep11CubicPoint(control, index / count));
    }
    return { from, to, control, points };
  }

function guidedStep11Path(anchors, sampleCount = 42) {
    const segments = [];
    const points = [];
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const segment = guidedStep11Segment(
        anchors[index],
        anchors[index + 1],
        sampleCount
      );
      segments.push(segment);
      points.push(...segment.points.slice(index === 0 ? 0 : 1));
    }
    return { anchors, segments, points };
  }

function guidedStep11PathLength(points) {
    let result = 0;
    for (let index = 1; index < points.length; index += 1) {
      result += Math.hypot(
        points[index].x - points[index - 1].x,
        points[index].y - points[index - 1].y
      );
    }
    return result;
  }

function guidedStep11PointAtPathFraction(path, fraction) {
    const points = path?.points || [];
    if (points.length === 0) return null;
    const lengths = [0];
    let total = 0;
    for (let index = 1; index < points.length; index += 1) {
      total += Math.hypot(
        points[index].x - points[index - 1].x,
        points[index].y - points[index - 1].y
      );
      lengths.push(total);
    }
    if (total <= .0001) return { ...points[0] };
    const target = nodeGraphClamp(fraction, 0, 1) * total;
    for (let index = 1; index < lengths.length; index += 1) {
      if (lengths[index] < target) continue;
      const previousLength = lengths[index - 1];
      const span = Math.max(.0001, lengths[index] - previousLength);
      const local = (target - previousLength) / span;
      return {
        x: points[index - 1].x + (points[index].x - points[index - 1].x) * local,
        y: points[index - 1].y + (points[index].y - points[index - 1].y) * local
      };
    }
    return { ...points[points.length - 1] };
  }

function guidedStep11RectOverlap(first, second, clearance = 0) {
    return !(
      first.right + clearance <= second.left ||
      second.right + clearance <= first.left ||
      first.bottom + clearance <= second.top ||
      second.bottom + clearance <= first.top
    );
  }

function guidedStep11PointInRect(point, rect, margin = 0) {
    return Boolean(
      point && rect &&
      point.x >= rect.left - margin &&
      point.x <= rect.right + margin &&
      point.y >= rect.top - margin &&
      point.y <= rect.bottom + margin
    );
  }

function guidedStep11EndpointReentry(points, rect, atStart, margin) {
    const sequence = atStart ? points : [...points].reverse();
    let index = 0;
    while (
      index < sequence.length &&
      guidedStep11PointInRect(sequence[index], rect, margin)
    ) {
      index += 1;
    }
    for (; index < sequence.length; index += 1) {
      if (guidedStep11PointInRect(sequence[index], rect, margin)) {
        return true;
      }
    }
    return false;
  }

function guidedStep11Orientation(a, b, c) {
    return (b.x - a.x) * (c.y - a.y) -
      (b.y - a.y) * (c.x - a.x);
  }

function guidedStep11PointOnSegment(point, a, b, epsilon = .01) {
    return Math.abs(guidedStep11Orientation(a, b, point)) <= epsilon &&
      point.x >= Math.min(a.x, b.x) - epsilon &&
      point.x <= Math.max(a.x, b.x) + epsilon &&
      point.y >= Math.min(a.y, b.y) - epsilon &&
      point.y <= Math.max(a.y, b.y) + epsilon;
  }

function guidedStep11SegmentIntersection(a, b, c, d) {
    const denominator =
      (a.x - b.x) * (c.y - d.y) -
      (a.y - b.y) * (c.x - d.x);
    if (Math.abs(denominator) <= .000001) {
      const collinear =
        Math.abs(guidedStep11Orientation(a, b, c)) <= .02 &&
        Math.abs(guidedStep11Orientation(a, b, d)) <= .02;
      if (!collinear) return null;
      const candidates = [a, b, c, d].filter(point =>
        guidedStep11PointOnSegment(point, a, b, .05) &&
        guidedStep11PointOnSegment(point, c, d, .05)
      );
      if (candidates.length === 0) return null;
      return {
        point: { ...candidates[0] },
        collinear: true
      };
    }
    const determinantAB = a.x * b.y - a.y * b.x;
    const determinantCD = c.x * d.y - c.y * d.x;
    const point = {
      x:
        (determinantAB * (c.x - d.x) -
          (a.x - b.x) * determinantCD) /
        denominator,
      y:
        (determinantAB * (c.y - d.y) -
          (a.y - b.y) * determinantCD) /
        denominator
    };
    return guidedStep11PointOnSegment(point, a, b, .08) &&
      guidedStep11PointOnSegment(point, c, d, .08)
        ? { point, collinear: false }
        : null;
  }

function guidedStep11Distance(first, second) {
    return Math.hypot(first.x - second.x, first.y - second.y);
  }

function guidedStep11PointRectDistance(point, rect) {
    if (!point || !rect) return Infinity;
    const deltaX = Math.max(
      rect.left - point.x,
      0,
      point.x - rect.right
    );
    const deltaY = Math.max(
      rect.top - point.y,
      0,
      point.y - rect.bottom
    );
    return Math.hypot(deltaX, deltaY);
  }

function guidedStep11PointSegmentDistance(point, from, to) {
    const deltaX = to.x - from.x;
    const deltaY = to.y - from.y;
    const lengthSquared = deltaX * deltaX + deltaY * deltaY;
    if (lengthSquared <= .000001) {
      return guidedStep11Distance(point, from);
    }
    const fraction = nodeGraphClamp(
      ((point.x - from.x) * deltaX +
        (point.y - from.y) * deltaY) /
        lengthSquared,
      0,
      1
    );
    return guidedStep11Distance(point, {
      x: from.x + deltaX * fraction,
      y: from.y + deltaY * fraction
    });
  }

function guidedStep11TurnAngleDegrees(previous, point, next) {
    const first = {
      x: previous.x - point.x,
      y: previous.y - point.y
    };
    const second = {
      x: next.x - point.x,
      y: next.y - point.y
    };
    const firstLength = Math.hypot(first.x, first.y);
    const secondLength = Math.hypot(second.x, second.y);
    if (firstLength <= .0001 || secondLength <= .0001) {
      return 180;
    }
    const cosine = nodeGraphClamp(
      (first.x * second.x + first.y * second.y) /
        (firstLength * secondLength),
      -1,
      1
    );
    return Math.acos(cosine) * 180 / Math.PI;
  }

function guidedStep11ReadabilityThresholds(
    scene,
    fit,
    options = {}
  ) {
    const rect = fit?.clientRect || {
      width: 375,
      height: 641
    };
    const shortSide = Math.max(
      1,
      Math.min(rect.width, rect.height)
    );
    const nodeCount = Math.max(
      1,
      scene?.nodes?.length || 1
    );
    const sparseBoost = nodeCount <= 3
      ? 1.12
      : nodeCount <= 5
        ? 1.04
        : .96;
    const override = (name, fallback) =>
      Math.max(
        0,
        guidedStep11Finite(options[name], fallback)
      );
    const planningSafetyFactor =
      options.readabilityPlanning === true
        ? nodeGraphClamp(
            guidedStep11Finite(
              options.readabilityPlanningSafetyFactor,
              1.22
            ),
            1,
            1.5
          )
        : 1;
    const minimumConnectionLengthPx = override(
      "minimumConnectionLengthPx",
      nodeGraphClamp(shortSide * .14 * sparseBoost, 52, 118) *
        planningSafetyFactor
    );
    const minimumLegLengthPx = override(
      "minimumLegLengthPx",
      nodeGraphClamp(shortSide * .09 * sparseBoost, 36, 80) *
        planningSafetyFactor
    );
    const minimumRoutePointNodeClearancePx = override(
      "minimumRoutePointNodeClearancePx",
      nodeGraphClamp(shortSide * .052 * sparseBoost, 20, 46) *
        planningSafetyFactor
    );
    const minimumWireNodeClearancePx = override(
      "minimumWireNodeClearancePx",
      nodeGraphClamp(shortSide * .03 * sparseBoost, 11, 27) *
        planningSafetyFactor
    );
    const minimumWireSeparationPx = override(
      "minimumWireSeparationPx",
      nodeGraphClamp(shortSide * .022 * sparseBoost, 8, 14) *
        (options.readabilityPlanning === true
          ? 1.8
          : 1)
    );
    const minimumTurnAngleDegrees = override(
      "minimumTurnAngleDegrees",
      46
    );
    const minimumReadableScale = override(
      "minimumReadableScale",
      nodeGraphClamp(shortSide / 920, .34, .72)
    );
    return {
      shortSide,
      nodeCount,
      sparseBoost,
      planningSafetyFactor,
      minimumConnectionLengthPx,
      preferredConnectionLengthPx: override(
        "preferredConnectionLengthPx",
        nodeGraphClamp(minimumConnectionLengthPx * 1.58, 82, 188)
      ),
      minimumLegLengthPx,
      preferredLegLengthPx: override(
        "preferredLegLengthPx",
        nodeGraphClamp(minimumLegLengthPx * 1.52, 56, 126)
      ),
      minimumRoutePointNodeClearancePx,
      preferredRoutePointNodeClearancePx: override(
        "preferredRoutePointNodeClearancePx",
        nodeGraphClamp(
          minimumRoutePointNodeClearancePx * 1.55,
          32,
          72
        )
      ),
      minimumWireNodeClearancePx,
      preferredWireNodeClearancePx: override(
        "preferredWireNodeClearancePx",
        nodeGraphClamp(minimumWireNodeClearancePx * 1.65, 20, 46)
      ),
      minimumWireSeparationPx,
      preferredWireSeparationPx: override(
        "preferredWireSeparationPx",
        nodeGraphClamp(minimumWireSeparationPx * 1.7, 14, 34)
      ),
      minimumTurnAngleDegrees,
      preferredTurnAngleDegrees: override(
        "preferredTurnAngleDegrees",
        82
      ),
      minimumReadableScale,
      preferredReadableScale: override(
        "preferredReadableScale",
        nodeGraphClamp(shortSide / 620, .58, .96)
      ),
      preferredFill: override(
        "preferredViewportFill",
        shortSide <= 460 ? .80 : .86
      )
    };
  }

function guidedStep11SceneReadability(
    scene,
    fit,
    options = {}
  ) {
    if (!fit?.viewport || !fit?.clientRect) {
      return {
        readable: false,
        score: 0,
        reason: "viewport-fit-unavailable"
      };
    }
    const scale = Math.max(
      GRAPH_MIN_ZOOM,
      guidedStep11Finite(fit.viewport.scale, GRAPH_MIN_ZOOM)
    );
    const compact = options.compactReadability === true;
    const pathSampleStride = compact ? 4 : 2;
    const wireSampleStride = compact ? 5 : 2;
    const thresholds = guidedStep11ReadabilityThresholds(
      scene,
      fit,
      options
    );
    const connections = scene.connections || [];
    const nodes = scene.nodes || [];
    const routePoints = scene.routePoints || [];
    const allowedJunctions = scene.allowedJunctions || [];
    const connectionMetrics = connections.map(connection => {
      const pathLengthPx =
        guidedStep11PathLength(connection.path.points) * scale;
      const legLengthsPx = (connection.path.segments || [])
        .map(segment =>
          guidedStep11PathLength(segment.points) * scale
        );
      const anchors = connection.path.anchors || [];
      const turnAngles = [];
      for (let index = 1; index < anchors.length - 1; index += 1) {
        turnAngles.push(
          guidedStep11TurnAngleDegrees(
            anchors[index - 1],
            anchors[index],
            anchors[index + 1]
          )
        );
      }
      let unrelatedNodeClearancePx = Infinity;
      for (const node of nodes) {
        if (
          node.id === connection.startNodeId ||
          node.id === connection.endNodeId
        ) {
          continue;
        }
        for (
          let index = 0;
          index < connection.path.points.length;
          index += pathSampleStride
        ) {
          unrelatedNodeClearancePx = Math.min(
            unrelatedNodeClearancePx,
            guidedStep11PointRectDistance(
              connection.path.points[index],
              node.rect
            ) * scale
          );
        }
      }
      return {
        connectionId: connection.id,
        pathLengthPx,
        directSpanPx:
          guidedStep11Distance(
            connection.path.points[0],
            connection.path.points[
              connection.path.points.length - 1
            ]
          ) * scale,
        legLengthsPx,
        minimumLegLengthPx:
          legLengthsPx.length > 0
            ? Math.min(...legLengthsPx)
            : pathLengthPx,
        turnAngles,
        minimumTurnAngleDegrees:
          turnAngles.length > 0
            ? Math.min(...turnAngles)
            : 180,
        unrelatedNodeClearancePx
      };
    });

    let minimumRoutePointNodeClearancePx = Infinity;
    for (const point of routePoints) {
      for (const node of nodes) {
        minimumRoutePointNodeClearancePx = Math.min(
          minimumRoutePointNodeClearancePx,
          guidedStep11PointRectDistance(point, node.rect) * scale
        );
      }
    }

    let minimumWireSeparationPx = Infinity;
    const junctionIgnoreGraphRadius =
      Math.max(
        thresholds.minimumWireSeparationPx * 1.9,
        18
      ) / scale;
    for (let firstIndex = 0; firstIndex < connections.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < connections.length; secondIndex += 1) {
        const first = connections[firstIndex];
        const second = connections[secondIndex];
        const firstPoints = first.path.points;
        const secondPoints = second.path.points;
        for (let pointIndex = 0; pointIndex < firstPoints.length; pointIndex += wireSampleStride) {
          const point = firstPoints[pointIndex];
          if (allowedJunctions.some(junction =>
            guidedStep11Distance(point, junction) <=
              junctionIgnoreGraphRadius
          )) {
            continue;
          }
          for (let edgeIndex = 1; edgeIndex < secondPoints.length; edgeIndex += wireSampleStride) {
            const from = secondPoints[edgeIndex - 1];
            const to = secondPoints[edgeIndex];
            if (allowedJunctions.some(junction =>
              Math.min(
                guidedStep11Distance(from, junction),
                guidedStep11Distance(to, junction)
              ) <= junctionIgnoreGraphRadius
            )) {
              continue;
            }
            minimumWireSeparationPx = Math.min(
              minimumWireSeparationPx,
              guidedStep11PointSegmentDistance(
                point,
                from,
                to
              ) * scale
            );
          }
        }
      }
    }

    const finiteOrPreferred = (value, preferred) =>
      Number.isFinite(value) ? value : preferred;
    const minimumConnectionLengthPx = connectionMetrics.length > 0
      ? Math.min(...connectionMetrics.map(item => item.pathLengthPx))
      : Infinity;
    const averageConnectionLengthPx = connectionMetrics.length > 0
      ? connectionMetrics.reduce(
          (sum, item) => sum + item.pathLengthPx,
          0
        ) / connectionMetrics.length
      : Infinity;
    const maximumConnectionLengthPx = connectionMetrics.length > 0
      ? Math.max(...connectionMetrics.map(item => item.pathLengthPx))
      : Infinity;
    const minimumLegLengthPx = connectionMetrics.length > 0
      ? Math.min(...connectionMetrics.map(item => item.minimumLegLengthPx))
      : Infinity;
    const minimumTurnAngleDegrees = connectionMetrics.length > 0
      ? Math.min(...connectionMetrics.map(item => item.minimumTurnAngleDegrees))
      : 180;
    const minimumWireNodeClearancePx = connectionMetrics.length > 0
      ? Math.min(...connectionMetrics.map(item =>
          finiteOrPreferred(
            item.unrelatedNodeClearancePx,
            thresholds.preferredWireNodeClearancePx
          )
        ))
      : Infinity;
    minimumRoutePointNodeClearancePx = finiteOrPreferred(
      minimumRoutePointNodeClearancePx,
      thresholds.preferredRoutePointNodeClearancePx
    );
    minimumWireSeparationPx = finiteOrPreferred(
      minimumWireSeparationPx,
      thresholds.preferredWireSeparationPx
    );

    const ratio = (value, preferred) =>
      nodeGraphClamp(value / Math.max(.0001, preferred), 0, 1);
    const connectionLengthScore =
      .68 * ratio(
        minimumConnectionLengthPx,
        thresholds.preferredConnectionLengthPx
      ) +
      .32 * ratio(
        averageConnectionLengthPx,
        thresholds.preferredConnectionLengthPx * 1.12
      );
    const legScore = ratio(
      minimumLegLengthPx,
      thresholds.preferredLegLengthPx
    );
    const routePointScore = ratio(
      minimumRoutePointNodeClearancePx,
      thresholds.preferredRoutePointNodeClearancePx
    );
    const wireNodeScore = ratio(
      minimumWireNodeClearancePx,
      thresholds.preferredWireNodeClearancePx
    );
    const wireSeparationScore = ratio(
      minimumWireSeparationPx,
      thresholds.preferredWireSeparationPx
    );
    const turnScore = ratio(
      minimumTurnAngleDegrees,
      thresholds.preferredTurnAngleDegrees
    );
    const wireReadabilityScore =
      connectionLengthScore * .25 +
      legScore * .24 +
      routePointScore * .21 +
      wireNodeScore * .13 +
      wireSeparationScore * .10 +
      turnScore * .07;
    const nodeReadabilityScore = nodeGraphClamp(
      (scale - thresholds.minimumReadableScale) /
        Math.max(
          .0001,
          thresholds.preferredReadableScale -
            thresholds.minimumReadableScale
        ),
      0,
      1
    );
    const currentFill = Number.isFinite(fit.fill)
      ? fit.fill
      : 0;
    const viewportUsageScore = nodeGraphClamp(
      1 - Math.abs(
        currentFill - thresholds.preferredFill
      ) / .34,
      0,
      1
    );
    const lengthBalanceScore =
      Number.isFinite(minimumConnectionLengthPx) &&
      Number.isFinite(maximumConnectionLengthPx) &&
      maximumConnectionLengthPx > .001
        ? nodeGraphClamp(
            minimumConnectionLengthPx /
              maximumConnectionLengthPx /
              .72,
            0,
            1
          )
        : 1;
    const score =
      wireReadabilityScore * .48 +
      nodeReadabilityScore * .24 +
      viewportUsageScore * .18 +
      lengthBalanceScore * .10;

    const hardMinimums = {
      connectionLength:
        minimumConnectionLengthPx + .01 >=
          thresholds.minimumConnectionLengthPx,
      legLength:
        minimumLegLengthPx + .01 >=
          thresholds.minimumLegLengthPx,
      routePointNodeClearance:
        minimumRoutePointNodeClearancePx + .01 >=
          thresholds.minimumRoutePointNodeClearancePx,
      wireNodeClearance:
        minimumWireNodeClearancePx + .01 >=
          thresholds.minimumWireNodeClearancePx,
      wireSeparation:
        minimumWireSeparationPx + .01 >=
          thresholds.minimumWireSeparationPx,
      turnAngle:
        minimumTurnAngleDegrees + .01 >=
          thresholds.minimumTurnAngleDegrees,
      nodeScale:
        scale + .0001 >= thresholds.minimumReadableScale
    };
    const readable = Object.values(hardMinimums).every(Boolean);
    return {
      readable,
      score,
      wireReadabilityScore,
      nodeReadabilityScore,
      viewportUsageScore,
      lengthBalanceScore,
      thresholds,
      hardMinimums,
      connectionMetrics: compact
        ? connectionMetrics.map(item => ({
            connectionId: item.connectionId,
            pathLengthPx: item.pathLengthPx,
            directSpanPx: item.directSpanPx,
            minimumLegLengthPx: item.minimumLegLengthPx,
            minimumTurnAngleDegrees:
              item.minimumTurnAngleDegrees,
            unrelatedNodeClearancePx:
              item.unrelatedNodeClearancePx
          }))
        : connectionMetrics,
      minimumConnectionLengthPx,
      averageConnectionLengthPx,
      maximumConnectionLengthPx,
      minimumLegLengthPx,
      minimumRoutePointNodeClearancePx,
      minimumWireNodeClearancePx,
      minimumWireSeparationPx,
      minimumTurnAngleDegrees,
      scale,
      fill: currentFill
    };
  }

function guidedStep11NodeResizeLimits(node) {
    const element = guidedStep11NodeElement(node?.id);
    const dimensions = guidedStep11NodeDimensions(node);
    if (!(element instanceof HTMLElement)) {
      return {
        minimumWidth: dimensions.width,
        maximumWidth: dimensions.width,
        minimumHeight: dimensions.height,
        maximumHeight: dimensions.height
      };
    }
    let limits = element._rmlResizeLimits || null;
    try {
      limits ||= measureNodeResizeLimits(element, node);
    } catch {
    }
    return {
      minimumWidth: Math.max(
        1,
        guidedStep11Finite(
          limits?.minimumWidth,
          dimensions.width
        )
      ),
      maximumWidth: Math.max(
        1,
        guidedStep11Finite(
          limits?.maximumWidth,
          dimensions.width
        )
      ),
      minimumHeight: Math.max(
        1,
        guidedStep11Finite(
          limits?.minimumHeight,
          dimensions.height
        )
      ),
      maximumHeight: Math.max(
        1,
        guidedStep11Finite(
          limits?.maximumHeight,
          dimensions.height
        )
      )
    };
  }

function guidedStep11ConnectedSocketLocalYs(nodeId) {
    const result = [];
    for (const connection of graph?.connections || []) {
      if (
        !connection.branchFrom &&
        connection.fromNode === nodeId
      ) {
        const template = guidedStep11SocketTemplate(
          nodeId,
          connection.fromPort,
          "output"
        );
        if (template) result.push(template.localY);
      }
      if (connection.toNode === nodeId) {
        const template = guidedStep11SocketTemplate(
          nodeId,
          connection.toPort,
          "input"
        );
        if (template) result.push(template.localY);
      }
    }
    return result;
  }

function guidedStep11SourceSizeOptions(
    context,
    request = {}
  ) {
    const current = context.sourceCurrent;
    if (request.allowNodeResize === false) {
      return [{
        width: current.width,
        height: current.height,
        resizeRatio: 0,
        resized: false
      }];
    }
    const limits = guidedStep11NodeResizeLimits(
      context.source
    );
    const socketYs = [
      context.sourceTemplate.localY,
      ...guidedStep11ConnectedSocketLocalYs(
        context.source.id
      )
    ].filter(Number.isFinite);
    const maximumRelevantSocketY = socketYs.length > 0
      ? Math.max(...socketYs)
      : 0;
    const minimumVisibleHeight = Math.min(
      current.height,
      Math.max(
        limits.minimumHeight,
        maximumRelevantSocketY + 32
      )
    );
    const heights = [
      current.height,
      Math.max(
        minimumVisibleHeight,
        current.height * .82
      ),
      minimumVisibleHeight
    ].map(height => nodeGraphClamp(
      guidedStep11Snap(height, GRAPH_GRID),
      limits.minimumHeight,
      Math.max(limits.minimumHeight, current.height)
    ));
    const seen = new Set();
    return heights
      .filter(height => {
        const key = String(height);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .map(height => ({
        width: current.width,
        height,
        resizeRatio:
          Math.max(0, current.height - height) /
          Math.max(1, current.height),
        resized:
          Math.abs(current.height - height) > .75,
        minimumVisibleHeight,
        limits
      }));
  }

function guidedStep11Bounds(nodes, connections, routePoints = []) {
    let minimumX = Infinity;
    let minimumY = Infinity;
    let maximumX = -Infinity;
    let maximumY = -Infinity;
    const include = point => {
      if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) return;
      minimumX = Math.min(minimumX, point.x);
      minimumY = Math.min(minimumY, point.y);
      maximumX = Math.max(maximumX, point.x);
      maximumY = Math.max(maximumY, point.y);
    };
    for (const node of nodes) {
      include({ x: node.rect.left, y: node.rect.top });
      include({ x: node.rect.right, y: node.rect.bottom });
    }
    for (const connection of connections) {
      for (const point of connection.path.points) include(point);
    }
    for (const point of routePoints) include(point);
    if (!Number.isFinite(minimumX)) {
      minimumX = minimumY = 0;
      maximumX = maximumY = 1;
    }
    const graphPadding = 14;
    return {
      left: minimumX - graphPadding,
      top: minimumY - graphPadding,
      right: maximumX + graphPadding,
      bottom: maximumY + graphPadding,
      width: Math.max(1, maximumX - minimumX + graphPadding * 2),
      height: Math.max(1, maximumY - minimumY + graphPadding * 2)
    };
  }

function guidedStep11RequestedClientRect(request = {}) {
    const viewportRect = dom.viewport?.getBoundingClientRect();
    if (!viewportRect) return null;
    const requested = request.clientRect || request.requestedRect || null;
    const inset = Math.max(0, guidedStep11Finite(request.inset, 10));
    const raw = requested
      ? {
          left: guidedStep11Finite(requested.left, viewportRect.left),
          top: guidedStep11Finite(requested.top, viewportRect.top),
          right: guidedStep11Finite(requested.right, viewportRect.right),
          bottom: guidedStep11Finite(requested.bottom, viewportRect.bottom)
        }
      : {
          left: viewportRect.left,
          top: viewportRect.top,
          right: viewportRect.right,
          bottom: viewportRect.bottom
        };
    const rect = {
      left: nodeGraphClamp(raw.left + inset, viewportRect.left, viewportRect.right),
      top: nodeGraphClamp(raw.top + inset, viewportRect.top, viewportRect.bottom),
      right: nodeGraphClamp(raw.right - inset, viewportRect.left, viewportRect.right),
      bottom: nodeGraphClamp(raw.bottom - inset, viewportRect.top, viewportRect.bottom)
    };
    rect.width = Math.max(1, rect.right - rect.left);
    rect.height = Math.max(1, rect.bottom - rect.top);
    return { viewportRect: guidedStep11PlainRect(viewportRect), rect };
  }

function guidedStep11Fit(bounds, request = {}) {
    const requested = guidedStep11RequestedClientRect(request);
    if (!requested) return null;
    const padding = Math.max(8, guidedStep11Finite(request.padding, 16));
    const maximumScale = nodeGraphClamp(
      guidedStep11Finite(request.maxScale, 1.08),
      GRAPH_MIN_ZOOM,
      GRAPH_MAX_ZOOM
    );
    const usableWidth = Math.max(1, requested.rect.width - padding * 2);
    const usableHeight = Math.max(1, requested.rect.height - padding * 2);
    const scale = nodeGraphClamp(
      Math.min(
        usableWidth / Math.max(1, bounds.width),
        usableHeight / Math.max(1, bounds.height),
        maximumScale
      ),
      GRAPH_MIN_ZOOM,
      GRAPH_MAX_ZOOM
    );
    const x =
      requested.rect.left - requested.viewportRect.left +
      (requested.rect.width - bounds.width * scale) / 2 -
      bounds.left * scale;
    const y =
      requested.rect.top - requested.viewportRect.top +
      (requested.rect.height - bounds.height * scale) / 2 -
      bounds.top * scale;
    return {
      viewport: { x, y, scale },
      clientRect: requested.rect,
      viewportRect: requested.viewportRect,
      padding,
      fill: Math.max(
        bounds.width * scale / Math.max(1, requested.rect.width),
        bounds.height * scale / Math.max(1, requested.rect.height)
      )
    };
  }

function guidedStep11ClientPointWithViewport(point, viewport, viewportRect) {
    return {
      x: viewportRect.left + viewport.x + point.x * viewport.scale,
      y: viewportRect.top + viewport.y + point.y * viewport.scale
    };
  }

function guidedStep11ValidateScene(scene, options = {}) {
    const nodeClearance = Math.max(0, guidedStep11Finite(options.nodeClearance, 10));
    const wireMargin = Math.max(0, guidedStep11Finite(options.wireMargin, 6));
    const pointMargin = Math.max(0, guidedStep11Finite(options.pointMargin, 10));
    const junctionTolerance = Math.max(4, guidedStep11Finite(options.junctionTolerance, 18));
    const violations = [];
    const nodes = scene.nodes || [];
    const connections = scene.connections || [];
    const allowedJunctions = scene.allowedJunctions || [];

    for (let leftIndex = 0; leftIndex < nodes.length; leftIndex += 1) {
      for (let rightIndex = leftIndex + 1; rightIndex < nodes.length; rightIndex += 1) {
        const left = nodes[leftIndex];
        const right = nodes[rightIndex];
        if (guidedStep11RectOverlap(left.rect, right.rect, nodeClearance)) {
          violations.push({
            type: "node-node-overlap",
            firstNodeId: left.id,
            secondNodeId: right.id
          });
        }
      }
    }

    for (const point of scene.routePoints || []) {
      for (const node of nodes) {
        if (guidedStep11PointInRect(point, node.rect, pointMargin)) {
          violations.push({
            type: "route-point-covered",
            pointId: point.id || "",
            pointKind: point.kind || "",
            nodeId: node.id
          });
        }
      }
    }

    for (const connection of connections) {
      const points = connection.path.points;
      for (const node of nodes) {
        let blocked;
        if (node.id === connection.startNodeId) {
          blocked = guidedStep11EndpointReentry(points, node.rect, true, wireMargin);
        } else if (node.id === connection.endNodeId) {
          blocked = guidedStep11EndpointReentry(points, node.rect, false, wireMargin);
        } else {
          blocked = points.some(point =>
            guidedStep11PointInRect(point, node.rect, wireMargin)
          );
        }
        if (blocked) {
          violations.push({
            type: "wire-node-occlusion",
            connectionId: connection.id,
            nodeId: node.id
          });
        }
      }

      if (options.skipSelfCrossing !== true) {
        const edges = points.slice(1).map((point, index) => ({
          a: points[index],
          b: point,
          index
        }));
        for (let first = 0; first < edges.length; first += 1) {
          for (let second = first + 2; second < edges.length; second += 1) {
            if (second === first + 1) continue;
            const intersection = guidedStep11SegmentIntersection(
              edges[first].a,
              edges[first].b,
              edges[second].a,
              edges[second].b
            );
            if (intersection) {
              violations.push({
                type: "wire-self-crossing",
                connectionId: connection.id,
                point: intersection.point
              });
            }
          }
        }
      }
    }

    if (options.skipWireCrossing !== true) {
    for (let firstIndex = 0; firstIndex < connections.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < connections.length; secondIndex += 1) {
        const first = connections[firstIndex];
        const second = connections[secondIndex];
        const firstPoints = first.path.points;
        const secondPoints = second.path.points;
        let invalidIntersection = null;
        outer:
        for (let aIndex = 1; aIndex < firstPoints.length; aIndex += 1) {
          for (let bIndex = 1; bIndex < secondPoints.length; bIndex += 1) {
            const intersection = guidedStep11SegmentIntersection(
              firstPoints[aIndex - 1],
              firstPoints[aIndex],
              secondPoints[bIndex - 1],
              secondPoints[bIndex]
            );
            if (!intersection) continue;
            const allowed = allowedJunctions.some(junction =>
              guidedStep11Distance(intersection.point, junction) <= junctionTolerance
            );
            if (!allowed) {
              invalidIntersection = intersection;
              break outer;
            }
          }
        }
        if (invalidIntersection) {
          violations.push({
            type: invalidIntersection.collinear
              ? "wire-wire-overlap"
              : "wire-crossing",
            firstConnectionId: first.id,
            secondConnectionId: second.id,
            point: invalidIntersection.point
          });
        }
      }
    }
    }

    return {
      clean: violations.length === 0,
      violations
    };
  }

function guidedStep11VisibleAtViewport(scene, fit) {
    if (!fit) return { allVisible: false, outside: ["viewport-unavailable"] };
    const outside = [];
    const rect = fit.clientRect;
    const viewport = fit.viewport;
    const viewportRect = fit.viewportRect;
    const check = (id, point) => {
      const client = guidedStep11ClientPointWithViewport(point, viewport, viewportRect);
      if (
        client.x < rect.left - .75 ||
        client.x > rect.right + .75 ||
        client.y < rect.top - .75 ||
        client.y > rect.bottom + .75
      ) {
        outside.push(id);
      }
    };
    for (const node of scene.nodes || []) {
      check(`${node.id}:top-left`, { x: node.rect.left, y: node.rect.top });
      check(`${node.id}:bottom-right`, { x: node.rect.right, y: node.rect.bottom });
    }
    for (const connection of scene.connections || []) {
      connection.path.points.forEach((point, index) =>
        check(`${connection.id}:path:${index}`, point)
      );
    }
    for (const point of scene.routePoints || []) {
      check(`${point.kind || "point"}:${point.id || ""}`, point);
    }
    return { allVisible: outside.length === 0, outside };
  }

function guidedStep11CandidateScene(context, candidate) {
    const nodes = context.otherNodes.map(node => ({ ...node, rect: { ...node.rect } }));
    const replace = record => {
      const index = nodes.findIndex(node => node.id === record.id);
      if (index >= 0) nodes[index] = record;
      else nodes.push(record);
    };
    replace(candidate.sourceNode);
    replace(candidate.primaryNode);
    replace(candidate.branchNode);

    const basePath = guidedStep11Path([
      candidate.sourceSocket,
      { ...candidate.junction },
      candidate.primaryInput
    ], 62);
    const branchPath = guidedStep11Path([
      { ...candidate.junction },
      ...candidate.bends.map(point => ({ ...point })),
      candidate.branchInput
    ], 62);
    const unchanged = context.unchangedConnections;
    const connections = [
      ...unchanged,
      {
        id: context.baseConnectionId || "guided-step11-base",
        startNodeId: candidate.sourceNode.id,
        endNodeId: candidate.primaryNode.id,
        path: basePath
      },
      {
        id: context.branchConnectionId || "guided-step11-branch",
        startNodeId: null,
        endNodeId: candidate.branchNode.id,
        path: branchPath
      }
    ];
    const routePoints = [
      {
        ...candidate.junction,
        id: "planned-junction",
        kind: "junction"
      },
      ...candidate.bends.map((point, index) => ({
        ...point,
        id: `planned-bend-${index + 1}`,
        kind: "bend"
      }))
    ];
    return {
      nodes,
      connections,
      routePoints,
      allowedJunctions: [{ ...candidate.junction }]
    };
  }

function guidedStep11FindAccessibleBranchPoint(path, nodes) {
    const points = path.points;
    const minimum = Math.floor(points.length * .20);
    const maximum = Math.ceil(points.length * .82);
    for (let index = minimum; index <= maximum; index += 1) {
      const point = points[index];
      if (!nodes.some(node => guidedStep11PointInRect(point, node.rect, 8))) {
        return {
          point: { ...point },
          fraction: index / Math.max(1, points.length - 1)
        };
      }
    }
    return null;
  }

function guidedStep11PlannerContext(request = {}) {
    if (!graph || !dom.viewport) {
      return { ok: false, reason: "graph-not-ready" };
    }
    const source = findGraphNode(request.sourceNodeId);
    const primary = findGraphNode(request.primaryNodeId);
    if (!source || !primary) {
      return { ok: false, reason: "source-or-primary-node-missing" };
    }
    const sourceTemplate = guidedStep11SocketTemplate(
      source.id,
      request.sourcePortId,
      "output"
    );
    const primaryInputTemplate = guidedStep11SocketTemplate(
      primary.id,
      request.primaryInputPortId,
      "input"
    );
    if (!sourceTemplate || !primaryInputTemplate) {
      return { ok: false, reason: "source-or-primary-socket-missing" };
    }
    const branchState = request.branchNodeId
      ? findGraphNode(request.branchNodeId)
      : null;
    const branchPrototype = branchState || primary;
    const branchInputPortId = request.branchInputPortId || request.primaryInputPortId;
    const branchInputTemplate = branchState
      ? guidedStep11SocketTemplate(branchState.id, branchInputPortId, "input")
      : {
          ...primaryInputTemplate,
          nodeId: "__guided_step11_virtual_branch__",
          portId: branchInputPortId
        };
    if (!branchInputTemplate) {
      return { ok: false, reason: "branch-input-socket-missing" };
    }

    const sourceCurrent = guidedStep11NodeRecord(source);
    const primaryCurrent = guidedStep11NodeRecord(primary);
    const branchCurrent = branchState
      ? guidedStep11NodeRecord(branchState)
      : {
          ...guidedStep11NodeRecord(branchPrototype),
          id: "__guided_step11_virtual_branch__"
        };
    const sourceSocket = guidedStep11SocketAt(
      sourceTemplate,
      sourceCurrent
    );
    const currentNodes = graph.nodes.map(node => guidedStep11NodeRecord(node));
    const otherNodes = currentNodes.filter(node =>
      node.id !== source.id &&
      node.id !== primary.id &&
      node.id !== branchState?.id
    );

    const baseConnectionId = String(request.baseConnectionId || "");
    const branchConnectionId = String(request.branchConnectionId || "");
    const unchangedConnections = graph.connections
      .filter(connection =>
        connection.id !== baseConnectionId &&
        connection.id !== branchConnectionId
      )
      .map(connection => {
        const geometry = connectionGeometry(connection);
        if (!geometry) return null;
        return {
          id: connection.id,
          startNodeId: connection.branchFrom ? null : connection.fromNode,
          endNodeId: connection.toNode,
          path: guidedStep11Path(
            geometry.anchors.map(anchor => ({
              x: anchor.x,
              y: anchor.y,
              side: anchor.side || null
            })),
            62
          )
        };
      })
      .filter(Boolean);

    return {
      ok: true,
      source,
      primary,
      branchState,
      sourceCurrent,
      primaryCurrent,
      branchCurrent,
      sourceTemplate,
      primaryInputTemplate,
      branchInputTemplate,
      sourceSocket,
      otherNodes,
      unchangedConnections,
      baseConnectionId,
      branchConnectionId,
      sourceResizeSafe:
        unchangedConnections.every(connection =>
          connection.startNodeId !== source.id &&
          connection.endNodeId !== source.id
        )
    };
  }

function guidedStep11Plan(request = {}) {
    const context = guidedStep11PlannerContext(request);
    if (!context.ok) return context;

    const graphStep = GRAPH_GRID;
    const currentPrimary = context.primaryCurrent;
    const currentBranch = context.branchCurrent;
    const requested = guidedStep11RequestedClientRect(request);
    const sourceSizeOptions = context.sourceResizeSafe
      ? guidedStep11SourceSizeOptions(context, request)
      : guidedStep11SourceSizeOptions(
          context,
          { ...request, allowNodeResize: false }
        );
    const fixedJunction =
      Number.isFinite(Number(request.fixedJunction?.x)) &&
      Number.isFinite(Number(request.fixedJunction?.y))
        ? {
            x: Number(request.fixedJunction.x),
            y: Number(request.fixedJunction.y)
          }
        : null;
    const junctionFractions = [.34, .42, .50, .58, .66];
    const provisionalCandidates = [];
    const candidates = [];
    let evaluated = 0;
    let rejectedNodeLayout = 0;
    let rejectedRoute = 0;
    let rejectedReadability = 0;

    for (const sourceSize of sourceSizeOptions) {
      const sourceNode = guidedStep11NodeRecord(
        context.source,
        null,
        sourceSize
      );
      const sourceSocket = guidedStep11SocketAt(
        context.sourceTemplate,
        sourceNode
      );
      const sourceRect = sourceNode.rect;
      const horizontalGapBase = nodeGraphClamp(
        Math.max(
          96,
          sourceNode.width * .27,
          currentPrimary.width * .58
        ),
        96,
        330
      );
      const xSeeds = [
        .90,
        1.14,
        1.43,
        1.78
      ].map(multiplier =>
        guidedStep11Snap(
          sourceRect.right +
            horizontalGapBase * multiplier,
          graphStep
        )
      );
      xSeeds.push(
        guidedStep11Snap(currentPrimary.x, graphStep)
      );
      const alignedPrimaryY =
        sourceSocket.y -
        context.primaryInputTemplate.localY;
      const ySeeds = [
        guidedStep11Snap(currentPrimary.y, graphStep),
        guidedStep11Snap(alignedPrimaryY, graphStep),
        guidedStep11Snap(
          alignedPrimaryY + currentPrimary.height * .42,
          graphStep
        )
      ];
      const primaryPositions = [];
      const primaryKeys = new Set();
      if (request.lockPrimaryPosition === true) {
        primaryPositions.push({
          x: currentPrimary.x,
          y: currentPrimary.y
        });
      } else {
        for (const x of xSeeds) {
          for (const y of ySeeds) {
            const key = `${x}:${y}`;
            if (primaryKeys.has(key)) continue;
            primaryKeys.add(key);
            primaryPositions.push({ x, y });
          }
        }
      }

      for (const primaryPosition of primaryPositions) {
        const primaryNode = guidedStep11NodeRecord(
          context.primary,
          primaryPosition
        );
        const primaryInput = guidedStep11SocketAt(
          context.primaryInputTemplate,
          primaryNode
        );
        const directBase = guidedStep11Path([
          sourceSocket,
          primaryInput
        ], 72);

        const primaryNodeSet = [
          sourceNode,
          primaryNode,
          ...context.otherNodes
        ];
        if (primaryNodeSet.some((node, index) =>
          primaryNodeSet.slice(index + 1).some(other =>
            guidedStep11RectOverlap(node.rect, other.rect, 10)
          )
        )) {
          rejectedNodeLayout += 1;
          continue;
        }

        const branchGapBase = nodeGraphClamp(
          Math.max(
            90,
            primaryNode.height * 1.04,
            sourceNode.height * .16
          ),
          90,
          280
        );
        const branchXSeeds =
          request.lockBranchPosition === true &&
          context.branchState
            ? [currentBranch.x]
            : [-.08, .12, .32]
                .map(ratio => guidedStep11Snap(
                  primaryNode.x +
                    primaryNode.width * ratio,
                  graphStep
                ));
        const branchYSeeds =
          request.lockBranchPosition === true &&
          context.branchState
            ? [currentBranch.y]
            : [.85, 1.10, 1.40, 1.75]
                .map(multiplier => guidedStep11Snap(
                  primaryNode.rect.bottom +
                    branchGapBase * multiplier,
                  graphStep
                ));

        for (const branchX of branchXSeeds) {
          for (const branchY of branchYSeeds) {
            const branchPrototypeNode =
              context.branchState || context.primary;
            const branchNode = guidedStep11NodeRecord(
              branchPrototypeNode,
              { x: branchX, y: branchY }
            );
            branchNode.id =
              context.branchState?.id ||
              "__guided_step11_virtual_branch__";
            const branchInput = guidedStep11SocketAt(
              context.branchInputTemplate,
              branchNode
            );
            const nodesForLayout = [
              sourceNode,
              primaryNode,
              branchNode,
              ...context.otherNodes
            ];
            if (nodesForLayout.some((node, index) =>
              nodesForLayout.slice(index + 1).some(other =>
                guidedStep11RectOverlap(node.rect, other.rect, 10)
              )
            )) {
              rejectedNodeLayout += 1;
              continue;
            }

            const junctionCandidates = fixedJunction
              ? [{ point: { ...fixedJunction }, fraction: null }]
              : junctionFractions.map(fraction => ({
                  point: guidedStep11PointAtPathFraction(
                    directBase,
                    fraction
                  ),
                  fraction
                }));

            for (const junctionCandidate of junctionCandidates) {
              const fraction = junctionCandidate.fraction;
              const junction = junctionCandidate.point;
              if (!junction) continue;
              if (nodesForLayout.some(node =>
                guidedStep11PointInRect(junction, node.rect, 10)
              )) {
                rejectedRoute += 1;
                continue;
              }

              const corridorPadding = Math.max(
                22,
                Math.min(
                  54,
                  (branchNode.rect.top -
                    primaryNode.rect.bottom) * .18
                )
              );
              const corridorTop =
                primaryNode.rect.bottom + corridorPadding;
              const corridorBottom =
                branchNode.rect.top - corridorPadding;
              if (corridorBottom <= corridorTop + 24) {
                rejectedRoute += 1;
                continue;
              }
              const bendYSeeds = [.34, .50, .66]
                .map(ratio => guidedStep11Snap(
                  corridorTop +
                    (corridorBottom - corridorTop) * ratio,
                  GRAPH_WIRE_POINT_SNAP
                ));
              const horizontalRun =
                branchInput.x - junction.x;
              const bendXSeeds = [.24, .43, .62]
                .map(ratio => guidedStep11Snap(
                  junction.x + horizontalRun * ratio,
                  GRAPH_WIRE_POINT_SNAP
                ));

              for (const bendY of bendYSeeds) {
                for (const bendX of bendXSeeds) {
                  const bend = { x: bendX, y: bendY };
                  evaluated += 1;
                  if (nodesForLayout.some(node =>
                    guidedStep11PointInRect(bend, node.rect, 10)
                  )) {
                    rejectedRoute += 1;
                    continue;
                  }
                  const candidate = {
                    sourceNode,
                    sourceSocket,
                    sourceSize,
                    primaryNode,
                    branchNode,
                    primaryInput,
                    branchInput,
                    junction,
                    junctionFraction: fraction,
                    bends: [bend]
                  };
                  const scene = guidedStep11CandidateScene(
                    context,
                    candidate
                  );
                  const fastValidation = guidedStep11ValidateScene(
                    scene,
                    {
                      skipSelfCrossing: true,
                      skipWireCrossing: true
                    }
                  );
                  if (!fastValidation.clean) {
                    rejectedRoute += 1;
                    continue;
                  }
                  const initialBranchPath = guidedStep11Path([
                    { ...junction },
                    branchInput
                  ], 40);
                  const accessible =
                    guidedStep11FindAccessibleBranchPoint(
                      initialBranchPath,
                      nodesForLayout
                    );
                  if (!accessible) {
                    rejectedRoute += 1;
                    continue;
                  }
                  const bounds = guidedStep11Bounds(
                    scene.nodes,
                    scene.connections,
                    scene.routePoints
                  );
                  const fit = guidedStep11Fit(bounds, request);
                  const visibility =
                    guidedStep11VisibleAtViewport(scene, fit);
                  if (!fit || !visibility.allVisible) {
                    rejectedRoute += 1;
                    continue;
                  }
                  const readability =
                    guidedStep11SceneReadability(
                      scene,
                      fit,
                      {
                        ...request,
                        compactReadability: true,
                        readabilityPlanning: true
                      }
                    );
                  if (!readability.readable) {
                    rejectedReadability += 1;
                  }
                  const movement =
                    guidedStep11Distance(
                      primaryNode,
                      currentPrimary
                    ) +
                    (context.branchState
                      ? guidedStep11Distance(
                          branchNode,
                          currentBranch
                        )
                      : 0);
                  const baseLength = guidedStep11PathLength(
                    scene.connections[
                      scene.connections.length - 2
                    ].path.points
                  );
                  const branchLength = guidedStep11PathLength(
                    scene.connections[
                      scene.connections.length - 1
                    ].path.points
                  );
                  const routeLength =
                    baseLength + branchLength;
                  const bendDetour =
                    guidedStep11Distance(junction, bend) +
                    guidedStep11Distance(bend, branchInput) -
                    guidedStep11Distance(
                      junction,
                      branchInput
                    );
                  const resizePenalty =
                    sourceSize.resizeRatio * 90_000;
                  const score =
                    (readability.readable ? 3_000_000 : 0) +
                    readability.score * 1_000_000 +
                    readability.wireReadabilityScore * 420_000 +
                    fit.viewport.scale * 105_000 +
                    fit.fill * 24_000 -
                    resizePenalty -
                    movement * 28 -
                    Math.max(0, bendDetour) * 5 -
                    Math.abs(
                      branchNode.x - primaryNode.x
                    ) * 1.6;
                  provisionalCandidates.push({
                    score,
                    candidate,
                    scene,
                    bounds,
                    fit,
                    visibility,
                    readability,
                    accessible,
                    movement,
                    routeLength,
                    bendDetour,
                    resizePenalty
                  });
                  if (provisionalCandidates.length >= 1400) {
                    provisionalCandidates.sort((left, right) =>
                      Number(right.readability.readable) -
                        Number(left.readability.readable) ||
                      right.score - left.score
                    );
                    provisionalCandidates.length = 520;
                  }
                }
              }
            }
          }
        }
      }
    }

    provisionalCandidates.sort((left, right) =>
      Number(right.readability.readable) -
        Number(left.readability.readable) ||
      right.score - left.score
    );
    for (const item of provisionalCandidates.slice(0, 360)) {
      const validation = guidedStep11ValidateScene(item.scene);
      if (!validation.clean) {
        rejectedRoute += 1;
        continue;
      }
      const readability = guidedStep11SceneReadability(
        item.scene,
        item.fit,
        {
          ...request,
          readabilityPlanning: true
        }
      );
      if (!readability.readable) {
        rejectedReadability += 1;
        continue;
      }
      candidates.push({
        ...item,
        validation,
        readability
      });
      if (candidates.length >= 32) break;
    }

    const winner = candidates[0] || null;
    if (!winner) {
      return {
        ok: false,
        reason: "no-globally-readable-step11-plan",
        diagnostics: {
          evaluated,
          rejectedNodeLayout,
          rejectedRoute,
          rejectedReadability,
          sourceNode: context.sourceCurrent,
          primaryNode: context.primaryCurrent,
          branchNode: context.branchCurrent,
          sourceResizeSafe: context.sourceResizeSafe,
          requestedClientRect: requested?.rect || null,
          bestUnreadableCandidates:
            provisionalCandidates.slice(0, 8).map(item => ({
              score: item.score,
              sourceSize: item.candidate.sourceSize,
              readability: item.readability,
              scale: item.fit?.viewport?.scale || null,
              fill: item.fit?.fill || null
            }))
        }
      };
    }

    const candidate = winner.candidate;
    const stagingNodes = winner.scene.nodes.map(node => ({
      ...node,
      rect: { ...node.rect }
    }));
    const includeStagingNode = record => {
      const existing = stagingNodes.find(node => node.id === record.id);
      if (!existing) {
        stagingNodes.push(record);
        return;
      }
      existing.rect = {
        left: Math.min(existing.rect.left, record.rect.left),
        top: Math.min(existing.rect.top, record.rect.top),
        right: Math.max(existing.rect.right, record.rect.right),
        bottom: Math.max(existing.rect.bottom, record.rect.bottom)
      };
      existing.rect.width =
        existing.rect.right - existing.rect.left;
      existing.rect.height =
        existing.rect.bottom - existing.rect.top;
    };
    includeStagingNode(context.sourceCurrent);
    includeStagingNode(context.primaryCurrent);
    if (context.branchState) {
      includeStagingNode(context.branchCurrent);
    }
    const stagingBounds = guidedStep11Bounds(
      stagingNodes,
      winner.scene.connections,
      winner.scene.routePoints
    );
    const stagingFit = guidedStep11Fit(
      stagingBounds,
      request
    );
    const client = point => guidedStep11ClientPointWithViewport(
      point,
      graph.viewport,
      guidedStep11PlainRect(
        dom.viewport.getBoundingClientRect()
      )
    );
    const sourceResizeRequired = Boolean(
      candidate.sourceSize.resized
    );
    return {
      ok: true,
      version: 2,
      policy:
        "global-human-readability-dry-run-before-pointerdown",
      source: {
        nodeId: context.sourceCurrent.id,
        portId: request.sourcePortId,
        x: candidate.sourceNode.x,
        y: candidate.sourceNode.y,
        width: candidate.sourceNode.width,
        height: candidate.sourceNode.height,
        currentWidth: context.sourceCurrent.width,
        currentHeight: context.sourceCurrent.height,
        resizeRequired: sourceResizeRequired,
        resizeAxis: sourceResizeRequired
          ? "height"
          : "none",
        socket: { ...candidate.sourceSocket },
        center: {
          x:
            candidate.sourceNode.x +
            candidate.sourceNode.width / 2,
          y:
            candidate.sourceNode.y +
            candidate.sourceNode.height / 2
        }
      },
      primary: {
        nodeId: context.primary.id,
        inputPortId: request.primaryInputPortId,
        x: candidate.primaryNode.x,
        y: candidate.primaryNode.y,
        width: candidate.primaryNode.width,
        height: candidate.primaryNode.height,
        center: {
          x:
            candidate.primaryNode.x +
            candidate.primaryNode.width / 2,
          y:
            candidate.primaryNode.y +
            candidate.primaryNode.height / 2
        },
        clientCenterNow: client({
          x:
            candidate.primaryNode.x +
            candidate.primaryNode.width / 2,
          y:
            candidate.primaryNode.y +
            candidate.primaryNode.height / 2
        })
      },
      branch: {
        nodeId: context.branchState?.id || "",
        virtual: !context.branchState,
        inputPortId:
          request.branchInputPortId ||
          request.primaryInputPortId,
        x: candidate.branchNode.x,
        y: candidate.branchNode.y,
        width: candidate.branchNode.width,
        height: candidate.branchNode.height,
        center: {
          x:
            candidate.branchNode.x +
            candidate.branchNode.width / 2,
          y:
            candidate.branchNode.y +
            candidate.branchNode.height / 2
        },
        palettePointerGraph: {
          x: candidate.branchNode.x + 130,
          y: candidate.branchNode.y + 35
        },
        palettePointerClientNow: client({
          x: candidate.branchNode.x + 130,
          y: candidate.branchNode.y + 35
        })
      },
      junction: {
        x: candidate.junction.x,
        y: candidate.junction.y,
        fraction: candidate.junctionFraction,
        clientNow: client(candidate.junction)
      },
      bend: {
        x: candidate.bends[0].x,
        y: candidate.bends[0].y,
        clientNow: client(candidate.bends[0]),
        dragSourceGraph: { ...winner.accessible.point },
        dragSourceFraction: winner.accessible.fraction,
        dragSourceClientNow: client(
          winner.accessible.point
        )
      },
      stagingViewport: stagingFit?.viewport
        ? { ...stagingFit.viewport }
        : { ...winner.fit.viewport },
      stagingBounds,
      viewport: { ...winner.fit.viewport },
      finalClientRect: { ...winner.fit.clientRect },
      bounds: { ...winner.bounds },
      score: winner.score,
      validation: winner.validation,
      visibility: winner.visibility,
      readability: winner.readability,
      diagnostics: {
        evaluated,
        accepted: candidates.length,
        rejectedNodeLayout,
        rejectedRoute,
        rejectedReadability,
        movement: winner.movement,
        routeLength: winner.routeLength,
        bendDetour: winner.bendDetour,
        resizePenalty: winner.resizePenalty,
        sourceResizeSafe: context.sourceResizeSafe,
        sourceResizeRequired,
        sourceCurrentHeight: context.sourceCurrent.height,
        sourcePlannedHeight: candidate.sourceNode.height,
        finalScale: winner.fit.viewport.scale,
        fill: winner.fit.fill,
        readability: winner.readability,
        topCandidates: candidates.slice(0, 5).map(item => ({
          score: item.score,
          scale: item.fit.viewport.scale,
          fill: item.fit.fill,
          readabilityScore: item.readability.score,
          wireReadabilityScore:
            item.readability.wireReadabilityScore,
          sourceHeight:
            item.candidate.sourceNode.height,
          sourceResized:
            item.candidate.sourceSize.resized,
          primary: {
            x: item.candidate.primaryNode.x,
            y: item.candidate.primaryNode.y
          },
          branch: {
            x: item.candidate.branchNode.x,
            y: item.candidate.branchNode.y
          },
          junction: { ...item.candidate.junction },
          bend: { ...item.candidate.bends[0] }
        }))
      }
    };
  }

function guidedStep11LiveScene(request = {}) {
    const nodes = graph.nodes.map(node => guidedStep11NodeRecord(node));
    const connections = [];
    const routePoints = [];
    const allowedJunctions = [];
    const usage = branchPointUsageMap();
    for (const connection of graph.connections) {
      const geometry = connectionGeometry(connection);
      if (!geometry) continue;
      const path = guidedStep11Path(
        geometry.anchors.map(anchor => ({
          x: anchor.x,
          y: anchor.y,
          side: anchor.side || null
        })),
        62
      );
      connections.push({
        id: connection.id,
        startNodeId: connection.branchFrom ? null : connection.fromNode,
        endNodeId: connection.toNode,
        path
      });
      for (const point of connection.points || []) {
        const branchCount = branchPointUsageCount(
          connection.id,
          point.id,
          usage
        );
        const record = {
          id: point.id,
          x: point.x,
          y: point.y,
          kind: branchCount > 0 ? "junction" : "bend",
          connectionId: connection.id,
          branchCount
        };
        routePoints.push(record);
        if (branchCount > 0) allowedJunctions.push({ x: point.x, y: point.y });
      }
    }
    return { nodes, connections, routePoints, allowedJunctions };
  }

function guidedStep11EvaluateLive(request = {}) {
    if (!graph || !dom.viewport) {
      return { ok: false, clean: false, reason: "graph-not-ready" };
    }
    const scene = guidedStep11LiveScene(request);
    const validation = guidedStep11ValidateScene(scene, request);
    const bounds = guidedStep11Bounds(scene.nodes, scene.connections, scene.routePoints);
    const idealFit = guidedStep11Fit(bounds, request);
    const currentFit = idealFit
      ? {
          ...idealFit,
          viewport: { ...graph.viewport },
          fill: Math.max(
            bounds.width * graph.viewport.scale /
              Math.max(1, idealFit.clientRect.width),
            bounds.height * graph.viewport.scale /
              Math.max(1, idealFit.clientRect.height)
          )
        }
      : null;
    const visibility = guidedStep11VisibleAtViewport(scene, currentFit);
    const readability = guidedStep11SceneReadability(
      scene,
      currentFit,
      request
    );
    const idealReadability = guidedStep11SceneReadability(
      scene,
      idealFit,
      request
    );
    const base = graphConnectionById(request.baseConnectionId);
    const branch = graphConnectionById(request.branchConnectionId);
    const branchPoint = branch?.branchFrom
      ? wirePointById(
          graphConnectionById(branch.branchFrom.connectionId),
          branch.branchFrom.pointId
        )
      : null;
    const expected = {
      baseConnectionPresent: Boolean(base),
      branchConnectionPresent: Boolean(branch),
      branchStartsAtJunction: Boolean(branch?.branchFrom && branchPoint),
      branchHasManualBend: Boolean((branch?.points || []).length >= 1),
      primaryNodePresent: Boolean(findGraphNode(request.primaryNodeId)),
      branchNodePresent: Boolean(findGraphNode(request.branchNodeId))
    };
    const expectedComplete = Object.values(expected).every(Boolean);
    const scaleError = idealFit
      ? Math.abs(graph.viewport.scale - idealFit.viewport.scale)
      : Infinity;
    const centerError = idealFit
      ? Math.hypot(
          graph.viewport.x - idealFit.viewport.x,
          graph.viewport.y - idealFit.viewport.y
        )
      : Infinity;
    const maximallyFramed = Boolean(
      idealFit &&
      scaleError <= Math.max(.008, idealFit.viewport.scale * .025) &&
      centerError <= 3.5
    );
    return {
      ok:
        validation.clean &&
        visibility.allVisible &&
        readability.readable &&
        expectedComplete,
      clean: validation.clean,
      allVisible: visibility.allVisible,
      readable: readability.readable,
      readability,
      idealReadability,
      maximallyFramed,
      expectedComplete,
      expected,
      validation,
      visibility,
      bounds,
      currentViewport: { ...graph.viewport },
      idealViewport: idealFit?.viewport || null,
      scaleError,
      centerError,
      routePoints: scene.routePoints,
      connectionIds: scene.connections.map(connection => connection.id)
    };
  }
