import Link from 'next/link';
import type { Week } from '@/lib/outline.ts';
import { dayKey } from '@/lib/outline.ts';
import type { Progress } from '@/lib/progress.ts';

export function Sidebar({ weeks, current, progress }: { weeks: Week[]; current: string; progress: Progress }) {
  const active = weeks.find((w) => w.slug === current || w.days.some((d) => d.slug === current) || w.historical.some((d) => d.slug === current)) ?? weeks[0];
  const done = active?.days.filter((d) => d.week && d.day && progress.days[dayKey(d.week, d.day)]?.status === 'passed').length ?? 0;
  return (
    <aside className="sidebar" aria-label="Chapters">
      {active && (
        <div style={{ padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--muted)', fontSize: 12 }}>
            <span>Week {active.week} progress</span>
            <span>{done} of {active.days.length} days</span>
          </div>
          <div style={{ height: 6, borderRadius: 3, background: 'var(--line)' }} role="progressbar" aria-label={`Week ${active.week} progress`} aria-valuemin={0} aria-valuemax={active.days.length} aria-valuenow={done}>
            <div style={{ width: `${(done / Math.max(1, active.days.length)) * 100}%`, height: 6, borderRadius: 3, background: 'var(--accent)' }} />
          </div>
        </div>
      )}
      {weeks.map((w) => (
        <nav key={w.slug} aria-label={`Week ${w.week}`}>
          <Link href={`/learn/${w.slug}`} className="side-label" style={{ display: 'flex', gap: 8, alignItems: 'center', textDecoration: 'none' }} aria-current={current === w.slug ? 'page' : undefined}>
            <span>{w.title}</span>
            {w.wip && <span className="wip-tag">WIP</span>}
          </Link>
          {w === active &&
            w.days.map((d, i) => {
              const status = d.week && d.day ? progress.days[dayKey(d.week, d.day)]?.status : undefined;
              return (
                <Link key={d.slug} href={`/learn/${d.slug}`} className="side-item" aria-current={d.slug === current ? 'page' : undefined}>
                  <span className={`dot ${status ?? ''}`} aria-hidden="true">{status === 'passed' ? '✓' : d.day ?? i + 1}</span>
                  <span style={{ flex: 1 }}>{d.title}</span>
                  {status && <span className="sr-only">{status === 'passed' ? 'passed' : 'in progress'}</span>}
                  {d.wip && <span className="wip-tag">WIP</span>}
                </Link>
              );
            })}
          {w === active && w.historical.length > 0 && (
            <details>
              <summary>Earlier versions of these lessons</summary>
              {w.historical.map((d) => (
                <Link key={d.slug} href={`/learn/${d.slug}`} className="side-item" aria-current={d.slug === current ? 'page' : undefined}>
                  {d.title}
                </Link>
              ))}
            </details>
          )}
        </nav>
      ))}
    </aside>
  );
}
