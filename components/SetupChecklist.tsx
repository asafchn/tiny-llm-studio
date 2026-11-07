'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { ndjson } from '@/lib/ndjson.ts';
import type { Step, StepId } from '@/lib/setup.ts';

const INFO: Record<StepId, { title: string; done: string }> = {
  python: { title: 'Python and MLX', done: 'Installed and checked.' },
  compiler: { title: 'C++ compiler', done: 'Installed.' },
  extensions: { title: 'Course extension', done: 'Built.' },
  claude: { title: 'Tutor sign-in', done: 'Signed in with your Claude plan.' },
};

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      <code className="mono" style={{ padding: '10px 12px', borderRadius: 8, background: 'var(--panel)', border: '1px solid var(--line)', flex: '1 1 260px', overflowX: 'auto', whiteSpace: 'nowrap' }}>{text}</code>
      <button type="button" className="btn" onClick={() => { void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); }); }}>
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function SetupChecklist() {
  const [steps, setSteps] = useState<Step[] | null>(null);
  const [checking, setChecking] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [buildFailed, setBuildFailed] = useState(false);

  const refresh = useCallback(async () => {
    setChecking(true);
    try {
      const r = await fetch('/api/setup', { cache: 'no-store' });
      setSteps(((await r.json()) as { steps: Step[] }).steps);
    } finally {
      setChecking(false);
    }
  }, []);

  // Re-check every few seconds so steps done in the terminal tick themselves.
  useEffect(() => {
    void refresh();
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  async function build() {
    setBuilding(true);
    setBuildFailed(false);
    setBuildLog([]);
    try {
      const res = await fetch('/api/build-ext', { method: 'POST' });
      for await (const ev of ndjson<{ type: 'log'; line: string } | { type: 'done'; ok: boolean }>(res)) {
        if (ev.type === 'log') setBuildLog((l) => [...l.slice(-300), ev.line]);
        else setBuildFailed(!ev.ok);
      }
    } finally {
      setBuilding(false);
      void refresh();
    }
  }

  if (!steps) return <p className="meta">Checking your setup…</p>;
  const ok = (id: StepId) => steps.find((s) => s.id === id)?.ok ?? false;
  const firstTodo = steps.find((s) => !s.ok)?.id;
  const doneCount = steps.filter((s) => s.ok).length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div aria-live="polite" className="meta">{doneCount} of {steps.length} done{checking ? ' · checking…' : ''}</div>
      <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {steps.map((s, i) => {
          const current = s.id === firstTodo;
          return (
            <li key={s.id} className="week-card" style={{ gap: 12, padding: 20, borderColor: current ? 'var(--accent)' : undefined, opacity: !s.ok && !current ? 0.6 : 1 }}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <span className={`dot ${s.ok ? 'passed' : ''}`} style={{ width: 28, height: 28, borderRadius: '50%', display: 'grid', placeItems: 'center', border: '1px solid var(--line-strong)', flex: 'none', background: s.ok ? 'var(--pass)' : undefined, color: s.ok ? 'var(--bg)' : 'var(--muted)' }} aria-hidden="true">
                  {s.ok ? '✓' : i + 1}
                </span>
                <h2 style={{ margin: 0, fontSize: 18, flex: 1 }}>{INFO[s.id].title}</h2>
                <span className={s.ok ? 'count-pass' : 'meta'}>{s.ok ? 'Done' : current ? 'Do this now' : 'Waiting'}</span>
              </div>

              {s.ok && <p className="meta" style={{ margin: 0 }}>{INFO[s.id].done}</p>}

              {!s.ok && current && s.id === 'python' && (
                <p style={{ margin: 0, color: 'var(--text-2)' }}>
                  The Python environment isn&apos;t working{ s.detail ? ` (${s.detail})` : ''}. Ask Claude in your setup session to repair it.
                </p>
              )}

              {!s.ok && current && s.id === 'compiler' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--text-2)' }}>
                  <p style={{ margin: 0 }}>1. Click <strong>Copy</strong>.</p>
                  <CopyLine text="sudo apt update && sudo apt install -y build-essential cmake" />
                  <p style={{ margin: 0 }}>2. Click into the <strong>Ubuntu terminal window</strong> that opened with the app, right-click to paste, and press <strong>Enter</strong>.</p>
                  <p style={{ margin: 0 }}>3. Type your Ubuntu password when asked (nothing shows while you type, that&apos;s normal) and press <strong>Enter</strong>.</p>
                  <p style={{ margin: 0 }}>4. Wait until it finishes. This step turns green by itself.</p>
                </div>
              )}

              {!s.ok && current && s.id === 'extensions' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--text-2)' }}>
                  <p style={{ margin: 0 }}>Click the button and wait about a minute.</p>
                  <div><button type="button" className="btn btn-primary" onClick={() => void build()} disabled={building}>{building ? 'Building… (about a minute)' : 'Build the course extension'}</button></div>
                  {buildFailed && <p className="count-fail" style={{ margin: 0 }}>The build failed. Copy the last lines below and send them to Claude in your setup session.</p>}
                  {buildLog.length > 0 && <pre className="log" tabIndex={0}>{buildLog.slice(-40).join('\n')}</pre>}
                </div>
              )}

              {!s.ok && current && s.id === 'claude' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, color: 'var(--text-2)' }}>
                  <p style={{ margin: 0 }}>The tutor uses your Claude plan. Sign in once:</p>
                  <p style={{ margin: 0 }}>1. Click <strong>Copy</strong>, then paste into the <strong>Ubuntu terminal window</strong> and press <strong>Enter</strong>.</p>
                  <CopyLine text="claude" />
                  <p style={{ margin: 0 }}>2. If it asks about a theme or trusting the folder, press <strong>Enter</strong> to accept.</p>
                  <p style={{ margin: 0 }}>3. Choose <strong>Claude account with subscription</strong>. A browser page opens (or a link appears: Ctrl+click it). Sign in and click <strong>Authorize</strong>.</p>
                  <p style={{ margin: 0 }}>4. If the page shows a code, copy it, paste it into the terminal, and press <strong>Enter</strong>.</p>
                  <p style={{ margin: 0 }}>5. Type <code>/exit</code> and press <strong>Enter</strong>. This step turns green by itself.</p>
                </div>
              )}
            </li>
          );
        })}
      </ol>

      {doneCount === steps.length ? (
        <div className="week-card" style={{ borderColor: 'var(--pass)', gap: 12 }}>
          <h2 style={{ margin: 0 }}>You&apos;re all set.</h2>
          <div><Link className="btn btn-primary" href="/learn/week1-01-attention">Start Week 1 · Day 1 →</Link></div>
        </div>
      ) : (
        <div><button type="button" className="btn" onClick={() => void refresh()} disabled={checking}>Check again</button></div>
      )}
      {!ok('claude') && ok('extensions') && <p className="meta" style={{ margin: 0 }}>You can already read chapters and run tests. Only the tutor waits on the sign-in.</p>}
    </div>
  );
}
