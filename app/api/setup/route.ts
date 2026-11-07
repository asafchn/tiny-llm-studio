import { setupStatus } from '@/lib/setup.ts';

export const dynamic = 'force-dynamic';

export function GET() {
  return Response.json({ steps: setupStatus() });
}
