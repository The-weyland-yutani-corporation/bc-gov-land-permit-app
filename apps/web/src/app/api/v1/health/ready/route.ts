import { ReadinessResponseSchema } from '@permit-readiness/contracts';
import { NextResponse } from 'next/server';
import { evaluateReadiness } from '../../../../../lib/readiness';

export async function GET() {
  const dependencies = await evaluateReadiness();
  const ready = dependencies.every(
    (dependency) => dependency.status === 'ready',
  );
  const body = ReadinessResponseSchema.parse({
    status: ready ? 'ready' : 'not_ready',
    service: 'permit-readiness-web',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    dependencies,
  });
  return NextResponse.json(body, { status: ready ? 200 : 503 });
}
