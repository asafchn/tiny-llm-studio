import fs from 'node:fs/promises';
import path from 'node:path';
import { BOOK, resolveInside } from './paths.ts';
import { filesInChapter, groupWeeks, parseSummary, type OutlineItem } from './outline.ts';

const SLUG = /^[A-Za-z0-9_.-]+$/;

export async function getOutline() {
  const items = parseSummary(await fs.readFile(path.join(BOOK, 'SUMMARY.md'), 'utf8'));
  return { items, ...groupWeeks(items) };
}

// mdBook's {{#include file}}; one level is all the book uses.
async function expandIncludes(md: string): Promise<string> {
  const parts = await Promise.all(
    [...md.matchAll(/\{\{#include\s+([^}\s]+)\s*\}\}/g)].map(async (m) => {
      try {
        return [m[0], await fs.readFile(resolveInside(BOOK, m[1]), 'utf8')] as const;
      } catch {
        return [m[0], ''] as const;
      }
    }),
  );
  return parts.reduce((acc, [token, text]) => acc.split(token).join(text), md);
}

export type Chapter = { item: OutlineItem; markdown: string; files: string[]; prev?: OutlineItem; next?: OutlineItem };

export async function getChapter(slug: string): Promise<Chapter | null> {
  if (!SLUG.test(slug)) return null;
  // Outline and chapter text don't depend on each other: read both at once.
  const [outline, raw] = await Promise.all([
    getOutline(),
    fs.readFile(resolveInside(BOOK, `${slug}.md`), 'utf8').catch(() => null),
  ]);
  if (raw === null) return null;
  const linear = outline.items.filter((i) => !i.historical);
  const idx = linear.findIndex((i) => i.slug === slug);
  const item = outline.items.find((i) => i.slug === slug) ?? { title: slug, slug, depth: 0, wip: false, historical: false };
  const markdown = await expandIncludes(raw);
  return {
    item,
    markdown,
    files: filesInChapter(markdown),
    prev: idx > 0 ? linear[idx - 1] : undefined,
    next: idx >= 0 ? linear[idx + 1] : undefined,
  };
}
