import fs from 'node:fs/promises';
import { editablePath } from '@/lib/paths.ts';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const rel = new URL(req.url).searchParams.get('path') ?? '';
  try {
    const abs = editablePath(rel);
    const [content, stat] = await Promise.all([fs.readFile(abs, 'utf8'), fs.stat(abs)]);
    return Response.json({ path: rel, content, mtime: stat.mtimeMs });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 404 });
  }
}

export async function PUT(req: Request) {
  const body = (await req.json()) as { path: string; content: string; baseMtime?: number; force?: boolean };
  let abs: string;
  try {
    abs = editablePath(body.path);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 400 });
  }
  if (typeof body.content !== 'string' || body.content.length > 2_000_000) return Response.json({ error: 'bad content' }, { status: 400 });
  const current = await fs.stat(abs).catch(() => null);
  // Someone else (the tutor, or another editor) changed it since it was loaded.
  if (!body.force && current && body.baseMtime && Math.abs(current.mtimeMs - body.baseMtime) > 1) {
    return Response.json({ error: 'changed on disk', mtime: current.mtimeMs }, { status: 409 });
  }
  await fs.writeFile(abs, body.content);
  const stat = await fs.stat(abs);
  return Response.json({ ok: true, mtime: stat.mtimeMs });
}
