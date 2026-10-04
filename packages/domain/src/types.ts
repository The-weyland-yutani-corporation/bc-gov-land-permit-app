export type Identifier = string;
export type IsoDate = string;
export type IsoDateTime = string;

export type GeographicPosition = readonly [longitude: number, latitude: number];

export interface PointGeometry {
  readonly type: 'Point';
  readonly coordinates: GeographicPosition;
}

export interface PolygonGeometry {
  readonly type: 'Polygon';
  readonly coordinates: readonly (readonly GeographicPosition[])[];
}

export type ProjectGeometry = PointGeometry | PolygonGeometry;

export interface VersionReference {
  readonly id: string;
  readonly version: string;
}

export interface JurisdictionReleaseReference {
  readonly schemaVersion: string;
  readonly jurisdictionId: string;
  readonly releaseVersion: string;
  readonly contentVersion: string;
  readonly ruleVersion: string;
  readonly guidanceVersion: string;
}

export interface JurisdictionConfigurationReader<TConfiguration = unknown> {
  getRelease(
    reference: Pick<
      JurisdictionReleaseReference,
      'jurisdictionId' | 'releaseVersion'
    >,
  ): Promise<TConfiguration | undefined>;
}
