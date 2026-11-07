// Pure parsing of the book's SUMMARY.md and chapter text; no fs, so it is unit-testable.

export type OutlineItem = {
  title: string;
  slug: string;
  depth: number;
  wip: boolean;
  week?: number;
  day?: number;
  /** Superseded lessons the author keeps around; shown collapsed, never tested. */
  historical: boolean;
};

const ITEM = /^(\s*)(?:[-*]\s+)?\[(.+?)\]\(\.\/([A-Za-z0-9_.-]+)\.md\)\s*$/;
const DAY_FILE = /^week(\d+)-0*(\d+)-/;

export function parseSummary(md: string): OutlineItem[] {
  const items: OutlineItem[] = [];
  let historicalDepth = -1;
  for (const line of md.split('\n')) {
    const m = ITEM.exec(line);
    if (!m) continue;
    const depth = Math.floor(m[1].replace(/\t/g, '    ').length / 4);
    let title = m[2].trim();
    const wip = title.startsWith('🚧');
    title = title.replace(/^🚧\s*/, '');
    if (historicalDepth >= 0 && depth <= historicalDepth) historicalDepth = -1;
    const historical = historicalDepth >= 0 || /^(historical|earlier)\b/i.test(title);
    if (historical && historicalDepth < 0) historicalDepth = depth;
    const item: OutlineItem = { title, slug: m[3], depth, wip, historical };
    const d = DAY_FILE.exec(m[3]);
    if (d && !historical) {
      item.week = Number(d[1]);
      item.day = Number(d[2]);
    }
    items.push(item);
  }
  return items;
}

export type Week = { week: number; title: string; slug: string; wip: boolean; days: OutlineItem[]; historical: OutlineItem[] };

export function groupWeeks(items: OutlineItem[]): { intro: OutlineItem[]; weeks: Week[]; extra: OutlineItem[] } {
  const intro: OutlineItem[] = [];
  const weeks: Week[] = [];
  const extra: OutlineItem[] = [];
  let current: Week | undefined;
  for (const it of items) {
    const w = /^week(\d+)-overview$/.exec(it.slug);
    if (w) {
      current = { week: Number(w[1]), title: it.title, slug: it.slug, wip: it.wip, days: [], historical: [] };
      weeks.push(current);
    } else if (current && it.depth > 0) {
      (it.historical ? current.historical : current.days).push(it);
    } else {
      current = undefined;
      (weeks.length ? extra : intro).push(it);
    }
  }
  return { intro, weeks, extra };
}

/** Course files a chapter asks the learner to edit, in first-mention order. */
export function filesInChapter(md: string): string[] {
  const seen = new Set<string>();
  for (const m of md.matchAll(/src\/tiny_llm\/[A-Za-z0-9_/]+\.py/g)) seen.add(m[0]);
  return [...seen];
}

export const dayKey = (week: number, day: number) => `${week}-${day}`;
