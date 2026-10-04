'use client';

import { useEffect, useRef, useState } from 'react';
import type { BrowserMapConfiguration } from '../lib/maps';

export function AzureMap({
  configuration,
  onSelect,
}: {
  configuration: BrowserMapConfiguration;
  onSelect(longitude: number, latitude: number): void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (
      !configuration.available ||
      !configuration.subscriptionKey ||
      !containerRef.current
    ) {
      return;
    }
    let disposed = false;
    let map: import('azure-maps-control').Map | undefined;

    void import('azure-maps-control')
      .then((atlas) => {
        if (disposed || !containerRef.current) return;
        map = new atlas.Map(containerRef.current, {
          authOptions: {
            authType: atlas.AuthenticationType.subscriptionKey,
            subscriptionKey: configuration.subscriptionKey,
          },
          center: [-123.3, 49.1],
          zoom: 6,
          language: 'en-CA',
          view: 'Auto',
        });
        map.events.add('click', (event) => {
          const position = event.position;
          if (position?.[0] !== undefined && position[1] !== undefined) {
            onSelect(position[0], position[1]);
          }
        });
      })
      .catch(() => setError('The map could not be loaded.'));

    return () => {
      disposed = true;
      map?.dispose();
    };
  }, [configuration, onSelect]);

  if (!configuration.available || error) {
    return (
      <div className="notice notice--info" role="status">
        <strong>Interactive map unavailable.</strong>{' '}
        {error ?? configuration.message}
      </div>
    );
  }

  return (
    <div>
      <p className="field__hint">
        Select a general point on the map. A manual method remains available
        below.
      </p>
      <div
        ref={containerRef}
        className="map-frame"
        role="application"
        aria-label="Azure Maps demonstration location picker"
      />
    </div>
  );
}
