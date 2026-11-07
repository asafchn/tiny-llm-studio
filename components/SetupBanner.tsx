'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { Step } from '@/lib/setup.ts';

// Fetched after paint so the overview never waits on the (slow-ish) Python probe.
export function SetupBanner() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  useEffect(() => {
    void fetch('/api/setup', { cache: 'no-store' }).then((r) => r.json()).then((d: { steps: Step[] }) => setSteps(d.steps));
  }, []);
  if (!steps || steps.every((s) => s.ok)) return null;
  const done = steps.filter((s) => s.ok).length;
  return (
    <div className="week-card" role="status" style={{ borderColor: 'var(--accent)', flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
      <div style={{ flex: '1 1 300px' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: 20 }}>Finish setup first</h2>
        <p className="meta" style={{ margin: 0 }}>{done} of {steps.length} steps done. Each remaining step takes a minute or two.</p>
      </div>
      <Link href="/setup" className="btn btn-primary">Continue setup →</Link>
    </div>
  );
}
