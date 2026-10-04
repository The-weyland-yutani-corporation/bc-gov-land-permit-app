import {
  GeoJsonPolygonSchema,
  ProjectGeometrySchema,
  type GeoJsonPolygon,
  type ProjectLocation,
} from '@permit-readiness/contracts';
import { customType } from 'drizzle-orm/pg-core';

declare const geometryEwktBrand: unique symbol;

export type GeometryEwkt = string & {
  readonly [geometryEwktBrand]: true;
};

const geometry4326Type = customType<{
  data: GeometryEwkt;
  driverData: string;
  config: { shape: 'Geometry' | 'Polygon' };
  configRequired: true;
}>({
  dataType(config) {
    return `geometry(${config.shape},4326)`;
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    if (!value.startsWith('SRID=4326;')) {
      throw new Error(
        'Geometry columns must be read through ST_AsEWKT or ST_AsGeoJSON.',
      );
    }
    return value as GeometryEwkt;
  },
});

export function geometry4326<TName extends string>(
  name: TName,
  shape: 'Geometry' | 'Polygon',
) {
  return geometry4326Type(name, { shape });
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new Error('Geometry coordinates must be finite numbers.');
  }
  return Object.is(value, -0) ? '0' : String(value);
}

function formatPosition(position: readonly [number, number]): string {
  return `${formatNumber(position[0])} ${formatNumber(position[1])}`;
}

export function serializeGeometryToEwkt(
  geometryInput: ProjectLocation['geometry'],
): GeometryEwkt {
  const geometry = ProjectGeometrySchema.parse(geometryInput);
  if (geometry.type === 'Point') {
    return `SRID=4326;POINT(${formatPosition(geometry.coordinates)})` as GeometryEwkt;
  }

  const rings = geometry.coordinates
    .map((ring) => `(${ring.map(formatPosition).join(',')})`)
    .join(',');
  return `SRID=4326;POLYGON(${rings})` as GeometryEwkt;
}

export function serializePolygonToEwkt(
  polygonInput: GeoJsonPolygon,
): GeometryEwkt {
  return serializeGeometryToEwkt(GeoJsonPolygonSchema.parse(polygonInput));
}

export function parseGeometryGeoJson(
  value: string,
): ProjectLocation['geometry'] {
  return ProjectGeometrySchema.parse(JSON.parse(value));
}

export function parsePolygonGeoJson(value: string): GeoJsonPolygon {
  return GeoJsonPolygonSchema.parse(JSON.parse(value));
}
