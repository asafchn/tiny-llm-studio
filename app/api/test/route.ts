import { runDayTests } from '@/lib/runTests.ts';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { week, day, only } = (await req.json()) as { week: number; day: number; only?: string[] };
  if (!Number.isInteger(week) || !Number.isInteger(day) || week < 1 || day < 1 || week > 9 || day > 20) {
    return Response.json({ error: 'bad week/day' }, { status: 400 });
  }
  const stream = runDayTests(week, day, Array.isArray(only) ? only.slice(0, 50).map(String) : [], req.signal);
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}
