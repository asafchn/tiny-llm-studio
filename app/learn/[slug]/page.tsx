import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Markdown } from '@/components/Markdown.tsx';
import { PracticePanel } from '@/components/PracticePanel.tsx';
import { Sidebar } from '@/components/Sidebar.tsx';
import { TopBar } from '@/components/TopBar.tsx';
import { getChapter, getOutline } from '@/lib/book.ts';
import { getProgress, recordVisit } from '@/lib/progress.ts';

export const dynamic = 'force-dynamic';

export default async function Learn({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [chapter, outline] = await Promise.all([getChapter(slug), getOutline()]);
  if (!chapter) notFound();
  const { item } = chapter;
  const practice = item.week !== undefined && item.day !== undefined;
  if (practice) recordVisit(slug);
  const week = outline.weeks.find((w) => w.slug === slug || [...w.days, ...w.historical].some((d) => d.slug === slug));

  return (
    <>
      <TopBar
        crumbs={[
          ...(week ? [{ label: `Week ${week.week}`, href: `/learn/${week.slug}` }] : []),
          { label: practice ? `Day ${item.day} · ${item.title}` : item.title },
        ]}
      />
      <div className="learn">
        <Sidebar weeks={outline.weeks} current={slug} progress={getProgress()} />
        <main className="chapter" id="main">
          <article className="chapter-inner prose">
            {item.wip && (
              <p className="notice" role="note" style={{ margin: '0 0 20px' }}>
                The author is still writing this chapter. Parts may change, and some tests may not run on Linux yet.
              </p>
            )}
            <Markdown source={chapter.markdown} />
            <nav className="chapter-nav" aria-label="Chapter">
              {chapter.prev && <Link className="btn" href={`/learn/${chapter.prev.slug}`}>← {chapter.prev.title}</Link>}
              {chapter.next && <Link className="btn" href={`/learn/${chapter.next.slug}`} style={{ background: 'var(--hover)' }}>Next: {chapter.next.title} →</Link>}
            </nav>
          </article>
        </main>
        {practice && <PracticePanel week={item.week!} day={item.day!} slug={slug} files={chapter.files} />}
      </div>
    </>
  );
}
