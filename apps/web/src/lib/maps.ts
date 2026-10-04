import 'server-only';

export interface BrowserMapConfiguration {
  readonly available: boolean;
  readonly mode: 'subscription-key-demo' | 'entra-external-id' | 'unavailable';
  readonly subscriptionKey?: string;
  readonly message: string;
}

export interface MapAdapter {
  getBrowserConfiguration(): BrowserMapConfiguration;
}

export class AzureMapsAdapter implements MapAdapter {
  getBrowserConfiguration(): BrowserMapConfiguration {
    const demoKey = process.env.NEXT_PUBLIC_AZURE_MAPS_SUBSCRIPTION_KEY;
    if (process.env.NODE_ENV !== 'production' && demoKey) {
      return {
        available: true,
        mode: 'subscription-key-demo',
        subscriptionKey: demoKey,
        message:
          'Azure Maps is available for local demonstration. Coordinates can also be entered manually.',
      };
    }
    if (process.env.AZURE_MAPS_CLIENT_ID) {
      return {
        available: false,
        mode: 'entra-external-id',
        message:
          'Azure Maps managed-identity configuration is present, but the production browser token adapter is not yet wired.',
      };
    }
    return {
      available: false,
      mode: 'unavailable',
      message:
        'Azure Maps is not configured. Use coordinates or GeoJSON instead.',
    };
  }
}

export function getMapAdapter(): MapAdapter {
  return new AzureMapsAdapter();
}
