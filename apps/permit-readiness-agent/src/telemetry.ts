import { SpanStatusCode, context, trace, type Span } from '@opentelemetry/api';

export const tracer = trace.getTracer(
  'permit-readiness-agent',
  process.env.FOUNDRY_AGENT_VERSION ?? 'local',
);

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const levelRank: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export function createLogger(minimumLevel: LogLevel) {
  return (
    level: LogLevel,
    event: string,
    attributes: Record<string, unknown> = {},
  ): void => {
    if (levelRank[level] < levelRank[minimumLevel]) return;
    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext();
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      event,
      traceId: spanContext?.traceId,
      spanId: spanContext?.spanId,
      ...attributes,
    };
    const serialized = JSON.stringify(payload);
    if (level === 'error') console.error(serialized);
    else if (level === 'warn') console.warn(serialized);
    else console.log(serialized);
  };
}

export async function inSpan<T>(
  name: string,
  attributes: Record<string, string | number | boolean>,
  operation: (span: Span) => Promise<T>,
): Promise<T> {
  return tracer.startActiveSpan(name, { attributes }, async (span) => {
    try {
      const result = await operation(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: error instanceof Error ? error.message : 'Unknown error',
      });
      if (error instanceof Error) span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}
