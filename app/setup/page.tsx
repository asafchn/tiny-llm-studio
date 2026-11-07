import { SetupChecklist } from '@/components/SetupChecklist.tsx';
import { TopBar } from '@/components/TopBar.tsx';

export const metadata = { title: 'Setup · tiny-llm studio' };

export default function SetupPage() {
  return (
    <>
      <TopBar crumbs={[{ label: 'Setup' }]} />
      <main className="overview" id="main" style={{ maxWidth: 760 }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: 34 }}>Setup</h1>
          <p style={{ margin: 0, color: 'var(--text-2)' }}>Do the highlighted step. Each one turns green by itself when it&apos;s done.</p>
        </div>
        <SetupChecklist />
      </main>
    </>
  );
}
