import { dayKey } from '@/lib/outline.ts';
import { getSession, resetSession, runTutor, undo, type Mode } from '@/lib/tutor.ts';

export const dynamic = 'force-dynamic';

const MODES: Mode[] = ['explain', 'explore', 'plan'];
const parseDay = (sp: URLSearchParams) => [Number(sp.get('week')), Number(sp.get('day'))] as const;
const validDay = (w: number, d: number) => Number.isInteger(w) && Number.isInteger(d) && w > 0 && d > 0 && w < 10 && d < 21;

export async function GET(req: Request) {
  const [week, day] = parseDay(new URL(req.url).searchParams);
  if (!validDay(week, day)) return Response.json({ error: 'bad day' }, { status: 400 });
  return Response.json({ messages: getSession(dayKey(week, day)).messages });
}

export async function POST(req: Request) {
  const b = (await req.json()) as { week: number; day: number; slug: string; mode: Mode; hint: number; text: string };
  if (!validDay(b.week, b.day) || !MODES.includes(b.mode) || !/^[\w.-]+$/.test(b.slug)) return Response.json({ error: 'bad request' }, { status: 400 });
  const text = String(b.text ?? '').trim().slice(0, 8000);
  if (!text) return Response.json({ error: 'empty message' }, { status: 400 });
  const hint = Math.max(0, Math.min(3, Math.trunc(Number(b.hint) || 0)));
  const stream = runTutor({ key: dayKey(b.week, b.day), week: b.week, day: b.day, slug: b.slug, mode: b.mode, hint, text, signal: req.signal });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}

export async function PATCH(req: Request) {
  const b = (await req.json()) as { week: number; day: number; action: 'undo' | 'reset'; index?: number };
  if (!validDay(b.week, b.day)) return Response.json({ error: 'bad day' }, { status: 400 });
  const key = dayKey(b.week, b.day);
  try {
    if (b.action === 'reset') {
      resetSession(key);
      return Response.json({ ok: true });
    }
    return Response.json({ restored: undo(key, Number(b.index)) });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
}
