'use client';

import type { ProjectLocation } from '@permit-readiness/contracts';
import type { BrowserMapConfiguration } from '../lib/maps';
import { AzureMap } from './azure-map';
import { Button } from './button';

export interface LocationFieldState {
  mode: 'coordinates' | 'geojson';
  longitude: string;
  latitude: string;
  geojson: string;
  description: string;
  source: ProjectLocation['source'];
}

export interface LocationFieldErrors {
  longitude?: string;
  latitude?: string;
  geojson?: string;
  general?: string;
}

export function LocationFields({
  state,
  configuration,
  confirmedLocation,
  errors,
  statusMessage,
  onChange,
  onConfirm,
  onReset,
}: {
  state: LocationFieldState;
  configuration: BrowserMapConfiguration;
  confirmedLocation?: ProjectLocation;
  errors: LocationFieldErrors;
  statusMessage?: string;
  onChange(next: Partial<LocationFieldState>): void;
  onConfirm(): void;
  onReset(): void;
}) {
  const longitudeDescription = errors.longitude
    ? 'longitude-hint longitude-error'
    : 'longitude-hint';
  const latitudeDescription = errors.latitude
    ? 'latitude-hint latitude-error'
    : 'latitude-hint';
  const geojsonDescription = errors.geojson
    ? 'geojson-hint geojson-error'
    : 'geojson-hint';

  return (
    <section className="form-section" aria-labelledby="location-heading">
      <h2 id="location-heading">Provide a general project location</h2>
      <p className="measure">
        The location is illustrative, not a survey or authoritative parcel
        analysis. The manual method is always available. Nothing is saved until
        you confirm the location below.
      </p>
      <div className="field">
        <AzureMap
          configuration={configuration}
          onSelect={(longitude, latitude) =>
            onChange({
              mode: 'coordinates',
              longitude: longitude.toFixed(6),
              latitude: latitude.toFixed(6),
              source: 'map',
            })
          }
        />
      </div>
      <fieldset className="field">
        <legend>Manual location method</legend>
        <div className="choice-list">
          <label className="choice">
            <input
              type="radio"
              checked={state.mode === 'coordinates'}
              onChange={() =>
                onChange({ mode: 'coordinates', source: 'coordinates' })
              }
            />
            Enter longitude and latitude
          </label>
          <label className="choice">
            <input
              type="radio"
              checked={state.mode === 'geojson'}
              onChange={() =>
                onChange({ mode: 'geojson', source: 'coordinates' })
              }
            />
            Paste Point or Polygon GeoJSON
          </label>
        </div>
      </fieldset>
      {state.mode === 'coordinates' ? (
        <div className="form-grid">
          <div className="field">
            <label htmlFor="longitude">Longitude</label>
            <span className="field__hint" id="longitude-hint">
              Enter a value from -180 to 180.
            </span>
            <input
              id="longitude"
              type="number"
              min="-180"
              max="180"
              step="any"
              value={state.longitude}
              required
              aria-invalid={Boolean(errors.longitude)}
              aria-describedby={longitudeDescription}
              onChange={(event) =>
                onChange({
                  longitude: event.target.value,
                  source: 'coordinates',
                })
              }
            />
            {errors.longitude ? (
              <span className="field__error" id="longitude-error" role="alert">
                {errors.longitude}
              </span>
            ) : null}
          </div>
          <div className="field">
            <label htmlFor="latitude">Latitude</label>
            <span className="field__hint" id="latitude-hint">
              Enter a value from -90 to 90.
            </span>
            <input
              id="latitude"
              type="number"
              min="-90"
              max="90"
              step="any"
              value={state.latitude}
              required
              aria-invalid={Boolean(errors.latitude)}
              aria-describedby={latitudeDescription}
              onChange={(event) =>
                onChange({
                  latitude: event.target.value,
                  source: 'coordinates',
                })
              }
            />
            {errors.latitude ? (
              <span className="field__error" id="latitude-error" role="alert">
                {errors.latitude}
              </span>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="field">
          <label htmlFor="geojson">GeoJSON geometry</label>
          <span className="field__hint" id="geojson-hint">
            Paste a GeoJSON Point or Polygon geometry object.
          </span>
          <textarea
            id="geojson"
            value={state.geojson}
            required
            aria-invalid={Boolean(errors.geojson)}
            aria-describedby={geojsonDescription}
            onChange={(event) =>
              onChange({
                geojson: event.target.value,
                source: 'coordinates',
              })
            }
          />
          {errors.geojson ? (
            <span className="field__error" id="geojson-error" role="alert">
              {errors.geojson}
            </span>
          ) : null}
        </div>
      )}
      <div className="field">
        <label htmlFor="location-description">
          General location description
        </label>
        <span className="field__hint" id="description-hint">
          Do not include a private address or precise sensitive site details.
        </span>
        <input
          id="location-description"
          maxLength={500}
          value={state.description}
          aria-describedby="description-hint"
          onChange={(event) => onChange({ description: event.target.value })}
        />
      </div>
      {errors.general ? (
        <div className="notice notice--danger field" role="alert">
          <strong>Location not confirmed.</strong> {errors.general}
        </div>
      ) : null}
      {confirmedLocation ? (
        <div className="notice notice--success field" role="status">
          <strong>Location confirmed.</strong>{' '}
          {confirmedLocation.geometry.type === 'Point'
            ? 'The point'
            : 'The polygon'}{' '}
          will be saved when you finish the intake.
        </div>
      ) : statusMessage ? (
        <div className="notice notice--info field" role="status">
          {statusMessage}
        </div>
      ) : null}
      <p className="field__hint field" id="location-confirmation-hint">
        Confirm the location before continuing. Editing or resetting it will
        require confirmation again.
      </p>
      <div className="actions" aria-describedby="location-confirmation-hint">
        <Button type="button" onClick={onConfirm}>
          Confirm this location
        </Button>
        <Button type="button" variant="secondary" onClick={onReset}>
          Reset location
        </Button>
      </div>
    </section>
  );
}
