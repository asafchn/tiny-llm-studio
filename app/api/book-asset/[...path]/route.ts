import fs from 'node:fs/promises';
import path from 'node:path';
import { BOOK, resolveInside } from '@/lib/paths.ts';

const TYPES: Record<string, string> = { '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp' };

export async function GET(_req: Request, ctx: { params: Promise<{ path: string[] }> }) {
  const rel = (await ctx.params).path.join('/');
  const type = TYPES[path.extname(rel).toLowerCase()];
  if (!type) return new Response('not found', { status: 404 });
  try {
    const data = await fs.readFile(resolveInside(BOOK, rel));
    // SVGs from the book are shown via <img>, which never runs their scripts; the CSP is belt and braces.
    return new Response(new Uint8Array(data), { headers: { 'content-type': type, 'content-security-policy': "default-src 'none'; style-src 'unsafe-inline'", 'cache-control': 'no-cache' } });
  } catch {
    return new Response('not found', { status: 404 });
  }
}
