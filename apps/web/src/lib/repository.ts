import 'server-only';

import { LocalDemoRepository } from './local-repository';
import type { PermitAppRepository } from './repository-types';

declare global {
  var permitReadinessLocalRepository: LocalDemoRepository | undefined;
}

function getLocalRepository() {
  globalThis.permitReadinessLocalRepository ??= new LocalDemoRepository();
  return globalThis.permitReadinessLocalRepository;
}

export async function getPermitAppRepository(): Promise<PermitAppRepository> {
  if (!process.env.DATABASE_URL) {
    if ((process.env.APP_ENV ?? 'local') !== 'local') {
      throw new Error(
        'Deployed environments require the PostgreSQL repository.',
      );
    }
    return getLocalRepository();
  }
  const { DrizzlePermitAppRepository } = await import('./drizzle-repository');
  return new DrizzlePermitAppRepository();
}
