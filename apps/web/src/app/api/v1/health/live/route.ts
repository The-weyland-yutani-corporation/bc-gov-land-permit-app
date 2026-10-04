import { LivenessResponseSchema } from '@permit-readiness/contracts';
import { NextResponse } from 'next/server';

export function GET() {
  const body = LivenessResponseSchema.parse({
    status: 'alive',
    service: 'permit-readiness-web',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  });
  return NextResponse.json(body);
}
