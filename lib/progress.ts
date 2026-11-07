import { readJson, writeJson } from './paths.ts';

export type DayStatus = 'passed' | 'started';
export type Progress = { days: Record<string, { status: DayStatus; passed: number; failed: number; at: string }>; last?: string };

export const getProgress = () => readJson<Progress>('progress.json', { days: {} });

export function recordRun(key: string, passed: number, failed: number): void {
  const p = getProgress();
  const prev = p.days[key];
  // Once a day has passed it stays passed; later red runs while refactoring don't un-earn it.
  const status: DayStatus = failed === 0 && passed > 0 ? 'passed' : prev?.status === 'passed' ? 'passed' : 'started';
  p.days[key] = { status, passed, failed, at: new Date().toISOString() };
  writeJson('progress.json', p);
}

export function recordVisit(slug: string): void {
  const p = getProgress();
  if (p.last === slug) return;
  p.last = slug;
  writeJson('progress.json', p);
}
