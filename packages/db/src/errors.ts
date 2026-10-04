export type RepositoryErrorCode =
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'DEPENDENCY_UNAVAILABLE';

export class RepositoryError extends Error {
  constructor(
    readonly code: RepositoryErrorCode,
    message: string,
    readonly repositoryCause?: unknown,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export function resourceNotFound(resource: string): RepositoryError {
  return new RepositoryError('NOT_FOUND', `${resource} was not found.`);
}

export function forbidden(): RepositoryError {
  return new RepositoryError(
    'FORBIDDEN',
    'The authenticated user cannot act in this organization.',
  );
}

export function conflict(message: string): RepositoryError {
  return new RepositoryError('CONFLICT', message);
}

export function dependencyUnavailable(message: string): RepositoryError {
  return new RepositoryError('DEPENDENCY_UNAVAILABLE', message);
}
