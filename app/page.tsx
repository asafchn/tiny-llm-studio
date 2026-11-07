import Link from 'next/link';
import { SetupBanner } from '@/components/SetupBanner.tsx';
import { TopBar } from '@/components/TopBar.tsx';
import { getOutline } from '@/lib/book.ts';
import { dayKey } from '@/lib/outline.ts';
import { getProgress } from '@/lib/progress.ts';

export const dynamic = 'force-dynamic';

export default async function Overview() {
  const outline = await getOutline();
  const progress = getProgress();
  const firstDay = outline.weeks[0]?.days[0];
  const resume = outline.items.find((i) => i.slug === progress.last) ?? firstDay;

  return (
    <>
      <TopBar />
      <main className="overview" id="main">
        <SetupBanner />
        <div className="hero">
          <div>
            <h1>Build an LLM server from scratch</h1>
            <p>Read a chapter, write the code, pass the tests.</p>
          </div>
          {resume && (
            <Link href={`/learn/${resume.slug}`} className="btn btn-primary" style={{ minHeight: 48, padding: '0 20px' }}>
              {progress.last ? 'Continue' : 'Start'}: {resume.title} →
            </Link>
          )}
        </div>

        <div className="weeks">
          {outline.weeks.map((w) => {
            const passed = w.days.filter((d) => d.week && d.day && progress.days[dayKey(d.week, d.day)]?.status === 'passed').length;
            return (
              <section key={w.slug} className="week-card" aria-labelledby={`wk-${w.week}`}>
                <div className="head">
                  <h2 id={`wk-${w.week}`}><Link href={`/learn/${w.slug}`} style={{ color: 'inherit', textDecoration: 'none' }}>{w.title}</Link></h2>
                  <span className={`badge ${w.wip ? 'wip' : ''}`}>{w.wip ? 'Author WIP' : 'Ready'}</span>
                </div>
                <div className="day-squares">
                  {w.days.map((d, i) => {
                    const st = d.week && d.day ? progress.days[dayKey(d.week, d.day)]?.status : undefined;
                    const label = `Day ${d.day ?? i + 1}: ${d.title}${st === 'passed' ? ' (passed)' : st === 'started' ? ' (in progress)' : ''}`;
                    return (
                      <Link key={d.slug} href={`/learn/${d.slug}`} className={`day-sq ${st ?? ''} ${d.wip ? 'wip' : ''}`} aria-label={label} title={label}>
                        {st === 'passed' ? '✓' : d.day ?? i + 1}
                      </Link>
                    );
                  })}
                </div>
                <p className="meta" style={{ margin: 0 }}>{w.wip ? 'Chapters still being written upstream. ' : ''}{passed} of {w.days.length} days passed</p>
              </section>
            );
          })}
        </div>

        <div className="legend" aria-label="Legend">
          <span><i style={{ background: 'var(--pass)', borderColor: 'var(--pass)' }} />Tests passed</span>
          <span><i style={{ border: '2px solid var(--fail)' }} />In progress</span>
          <span><i />Not started</span>
          <span><i style={{ borderStyle: 'dashed' }} />Author WIP</span>
        </div>

        <div className="extra-links">
          {[...outline.intro, ...outline.extra].map((i) => (
            <Link key={i.slug} href={`/learn/${i.slug}`}>{i.title}</Link>
          ))}
        </div>
      </main>
    </>
  );
}
