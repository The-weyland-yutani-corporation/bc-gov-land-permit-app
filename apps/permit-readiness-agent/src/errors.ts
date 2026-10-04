export type AgentErrorCode =
  | 'cancelled'
  | 'configuration_error'
  | 'invalid_output'
  | 'invalid_request'
  | 'model_error'
  | 'scope_violation'
  | 'timeout'
  | 'tool_error';

export class AgentError extends Error {
  constructor(
    readonly code: AgentErrorCode,
    message: string,
    readonly status: number,
    readonly retryable: boolean,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'AgentError';
  }
}

export function abortError(signal: AbortSignal): AgentError {
  return new AgentError(
    signal.reason instanceof Error && signal.reason.name === 'TimeoutError'
      ? 'timeout'
      : 'cancelled',
    signal.reason instanceof Error && signal.reason.name === 'TimeoutError'
      ? 'The agent request timed out.'
      : 'The agent request was cancelled.',
    signal.reason instanceof Error && signal.reason.name === 'TimeoutError'
      ? 504
      : 499,
    signal.reason instanceof Error && signal.reason.name === 'TimeoutError',
    { cause: signal.reason },
  );
}

export function throwIfAborted(signal: AbortSignal): void {
  if (signal.aborted) throw abortError(signal);
}
