import type {
  GeographicPosition,
  PointGeometry,
  PolygonGeometry,
  ProjectGeometry,
} from './types.js';

export interface SpatialZone {
  readonly id: string;
  readonly geometry: PolygonGeometry;
  readonly sourceId?: string;
}

const EPSILON = 1e-10;

function cross(
  start: GeographicPosition,
  middle: GeographicPosition,
  end: GeographicPosition,
): number {
  return (
    (middle[0] - start[0]) * (end[1] - start[1]) -
    (middle[1] - start[1]) * (end[0] - start[0])
  );
}

function pointOnSegment(
  point: GeographicPosition,
  start: GeographicPosition,
  end: GeographicPosition,
): boolean {
  return (
    Math.abs(cross(start, end, point)) <= EPSILON &&
    point[0] >= Math.min(start[0], end[0]) - EPSILON &&
    point[0] <= Math.max(start[0], end[0]) + EPSILON &&
    point[1] >= Math.min(start[1], end[1]) - EPSILON &&
    point[1] <= Math.max(start[1], end[1]) + EPSILON
  );
}

function segmentsIntersect(
  firstStart: GeographicPosition,
  firstEnd: GeographicPosition,
  secondStart: GeographicPosition,
  secondEnd: GeographicPosition,
): boolean {
  const first = cross(firstStart, firstEnd, secondStart);
  const second = cross(firstStart, firstEnd, secondEnd);
  const third = cross(secondStart, secondEnd, firstStart);
  const fourth = cross(secondStart, secondEnd, firstEnd);

  if (
    ((first > EPSILON && second < -EPSILON) ||
      (first < -EPSILON && second > EPSILON)) &&
    ((third > EPSILON && fourth < -EPSILON) ||
      (third < -EPSILON && fourth > EPSILON))
  ) {
    return true;
  }

  return (
    pointOnSegment(secondStart, firstStart, firstEnd) ||
    pointOnSegment(secondEnd, firstStart, firstEnd) ||
    pointOnSegment(firstStart, secondStart, secondEnd) ||
    pointOnSegment(firstEnd, secondStart, secondEnd)
  );
}

function pointInRing(
  point: GeographicPosition,
  ring: readonly GeographicPosition[],
): boolean {
  let inside = false;
  for (
    let index = 0, previous = ring.length - 1;
    index < ring.length;
    previous = index, index += 1
  ) {
    const currentPoint = ring[index];
    const previousPoint = ring[previous];
    if (!currentPoint || !previousPoint) {
      continue;
    }
    if (pointOnSegment(point, previousPoint, currentPoint)) {
      return true;
    }
    const crossesLatitude =
      currentPoint[1] > point[1] !== previousPoint[1] > point[1];
    const crossingLongitude =
      ((previousPoint[0] - currentPoint[0]) * (point[1] - currentPoint[1])) /
        (previousPoint[1] - currentPoint[1]) +
      currentPoint[0];
    if (crossesLatitude && point[0] < crossingLongitude) {
      inside = !inside;
    }
  }
  return inside;
}

export function pointIntersectsPolygon(
  point: PointGeometry,
  polygon: PolygonGeometry,
): boolean {
  const outerRing = polygon.coordinates[0];
  if (!outerRing || !pointInRing(point.coordinates, outerRing)) {
    return false;
  }
  return !polygon.coordinates
    .slice(1)
    .some((hole) => pointInRing(point.coordinates, hole));
}

function ringsIntersect(
  left: readonly GeographicPosition[],
  right: readonly GeographicPosition[],
): boolean {
  for (let leftIndex = 0; leftIndex < left.length - 1; leftIndex += 1) {
    const leftStart = left[leftIndex];
    const leftEnd = left[leftIndex + 1];
    if (!leftStart || !leftEnd) {
      continue;
    }
    for (let rightIndex = 0; rightIndex < right.length - 1; rightIndex += 1) {
      const rightStart = right[rightIndex];
      const rightEnd = right[rightIndex + 1];
      if (
        rightStart &&
        rightEnd &&
        segmentsIntersect(leftStart, leftEnd, rightStart, rightEnd)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function polygonsIntersect(
  left: PolygonGeometry,
  right: PolygonGeometry,
): boolean {
  for (const leftRing of left.coordinates) {
    for (const rightRing of right.coordinates) {
      if (ringsIntersect(leftRing, rightRing)) {
        return true;
      }
    }
  }

  const leftPoint = left.coordinates[0]?.[0];
  const rightPoint = right.coordinates[0]?.[0];
  return (
    (leftPoint !== undefined &&
      pointIntersectsPolygon(
        { type: 'Point', coordinates: leftPoint },
        right,
      )) ||
    (rightPoint !== undefined &&
      pointIntersectsPolygon({ type: 'Point', coordinates: rightPoint }, left))
  );
}

export function geometryIntersectsPolygon(
  geometry: ProjectGeometry,
  polygon: PolygonGeometry,
): boolean {
  return geometry.type === 'Point'
    ? pointIntersectsPolygon(geometry, polygon)
    : polygonsIntersect(geometry, polygon);
}

export function calculateSpatialMatches(
  geometry: ProjectGeometry,
  zones: readonly SpatialZone[],
): Readonly<Record<string, boolean>> {
  return Object.fromEntries(
    [...zones]
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((zone) => [
        zone.id,
        geometryIntersectsPolygon(geometry, zone.geometry),
      ]),
  );
}
