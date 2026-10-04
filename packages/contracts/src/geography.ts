import { z } from 'zod';

const LongitudeSchema = z.number().finite().min(-180).max(180);
const LatitudeSchema = z.number().finite().min(-90).max(90);

export const GeoJsonPositionSchema = z.tuple([LongitudeSchema, LatitudeSchema]);

type Position = z.infer<typeof GeoJsonPositionSchema>;

function positionsEqual(left: Position, right: Position): boolean {
  return left[0] === right[0] && left[1] === right[1];
}

function signedArea(ring: readonly Position[]): number {
  let area = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const current = ring[index];
    const next = ring[index + 1];
    if (current && next) {
      area += current[0] * next[1] - next[0] * current[1];
    }
  }
  return area / 2;
}

function orientation(a: Position, b: Position, c: Position): number {
  return (b[1] - a[1]) * (c[0] - b[0]) - (b[0] - a[0]) * (c[1] - b[1]);
}

function intersects(
  firstStart: Position,
  firstEnd: Position,
  secondStart: Position,
  secondEnd: Position,
): boolean {
  const first = orientation(firstStart, firstEnd, secondStart);
  const second = orientation(firstStart, firstEnd, secondEnd);
  const third = orientation(secondStart, secondEnd, firstStart);
  const fourth = orientation(secondStart, secondEnd, firstEnd);
  return first * second < 0 && third * fourth < 0;
}

function isSelfIntersecting(ring: readonly Position[]): boolean {
  const segmentCount = ring.length - 1;
  for (let first = 0; first < segmentCount; first += 1) {
    const firstStart = ring[first];
    const firstEnd = ring[first + 1];
    if (!firstStart || !firstEnd) {
      continue;
    }
    for (let second = first + 1; second < segmentCount; second += 1) {
      const adjacent =
        second === first + 1 || (first === 0 && second === segmentCount - 1);
      if (adjacent) {
        continue;
      }
      const secondStart = ring[second];
      const secondEnd = ring[second + 1];
      if (
        secondStart &&
        secondEnd &&
        intersects(firstStart, firstEnd, secondStart, secondEnd)
      ) {
        return true;
      }
    }
  }
  return false;
}

export const GeoJsonLinearRingSchema = z
  .array(GeoJsonPositionSchema)
  .min(4)
  .max(5001)
  .superRefine((ring, context) => {
    const first = ring[0];
    const last = ring.at(-1);
    if (!first || !last || !positionsEqual(first, last)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A GeoJSON linear ring must be closed.',
      });
      return;
    }

    const uniquePositions = new Set(
      ring.slice(0, -1).map((position) => position.join(',')),
    );
    if (uniquePositions.size < 3 || Math.abs(signedArea(ring)) < 1e-12) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A GeoJSON linear ring must enclose a non-zero area.',
      });
    }
    if (isSelfIntersecting(ring)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'A GeoJSON linear ring must not self-intersect.',
      });
    }
  });

export const GeoJsonPointSchema = z
  .object({
    type: z.literal('Point'),
    coordinates: GeoJsonPositionSchema,
  })
  .strict();

export const GeoJsonPolygonSchema = z
  .object({
    type: z.literal('Polygon'),
    coordinates: z.array(GeoJsonLinearRingSchema).min(1).max(50),
  })
  .strict();

export const ProjectGeometrySchema = z.discriminatedUnion('type', [
  GeoJsonPointSchema,
  GeoJsonPolygonSchema,
]);

export const ProjectLocationSchema = z
  .object({
    geometry: ProjectGeometrySchema,
    source: z.enum(['map', 'coordinates', 'address_approximation']),
    description: z.string().min(1).max(500).optional(),
  })
  .strict();

export type GeoJsonPoint = z.infer<typeof GeoJsonPointSchema>;
export type GeoJsonPolygon = z.infer<typeof GeoJsonPolygonSchema>;
export type ProjectLocation = z.infer<typeof ProjectLocationSchema>;
