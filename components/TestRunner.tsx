'use client';

import { useEffect, useRef, useState } from 'react';
import type { TestCase } from '@/lib/junit.ts';
import { ndjson } from '@/lib/ndjson.ts';
import type { TestEvent } from '@/lib/runTests.ts';

type Result = Extract<TestEvent, { type: 'result' }>;

export function TestRunner({ week, day, runSignal, beforeRun }: { week: number; day: number; runSignal: number; beforeRun: () => Promise<void> }) {
  const [running, setRunning] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [showPassed, setShowPassed] = useState(false);
  const [building, setBuilding] = useState(false);
  const abort = useRef<AbortController | null>(null);

  async function run(only: string[] = []) {
    if (running) return;
    setRunning(true);
    setLog([]);
    if (!only.length) setResult(null);
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      await beforeRun();
      const res = await fetch('/api/test', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ week, day, only }), signal: ctl.signal });
      for await (const ev of ndjson<TestEvent>(res)) {
        if (ev.type === 'log') setLog((l) => (l.length > 2000 ? [...l.slice(-1500), ev.line] : [...l, ev.line]));
        else setResult(ev);
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setLog((l) => [...l, String(e)]);
    } finally {
      setRunning(false);
    }
  }

  // Ctrl+Enter from the panel.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    void run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runSignal]);

  async function buildExt() {
    setBuilding(true);
    setLog([]);
    setShowLog(true);
    try {
      const res = await fetch('/api/build-ext', { method: 'POST' });
      for await (const ev of ndjson<{ type: 'log'; line: string } | { type: 'done'; ok: boolean }>(res)) {
        if (ev.type === 'log') setLog((l) => [...l, ev.line]);
        else if (ev.ok) { setResult(null); setLog((l) => [...l, 'Build finished. Running the tests again…']); setBuilding(false); void run(); return; }
        else setLog((l) => [...l, 'Build failed. Open Setup (top of the overview page) and follow the highlighted step.']);
      }
    } finally {
      setBuilding(false);
    }
  }

  const failed = result?.tests.filter((t) => t.status === 'failed') ?? [];
  const passed = result?.tests.filter((t) => t.status === 'passed') ?? [];
  const noJunit = result && result.tests.length === 0;
  // Collection fails before any test runs when the course's native module hasn't been built yet.
  const needsBuild = !!result && passed.length === 0 && [...failed.map((t) => t.detail ?? ''), ...log].some((s) => /tiny_llm_ext|extensions[./]|_ext\b/.test(s) && /Error|No module/.test(s));

  return (
    <div className="runner">
      <div className="runner-bar">
        {running ? (
          <button type="button" className="btn btn-primary" onClick={() => abort.current?.abort()}>Stop</button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => void run()}>
            <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8z" /></svg>
            Run Day {day} tests
          </button>
        )}
        {failed.length > 0 && !running && <button type="button" className="btn" onClick={() => void run(failed.map((t) => t.name))}>Re-run failed</button>}
        <div className="spacer" />
        <div aria-live="polite" style={{ display: 'flex', gap: 12 }}>
          {running && <span className="meta">Running…</span>}
          {result && !noJunit && (
            <>
              <span className="count-pass">{passed.length} passed</span>
              {failed.length > 0 && <span className="count-fail">{failed.length} failed</span>}
              <span className="meta">{result.seconds.toFixed(1)} s</span>
            </>
          )}
          {noJunit && !running && <span className="count-fail">Tests didn&apos;t run, see the log</span>}
        </div>
      </div>

      {needsBuild && !running && (
        <div className="notice" role="alert">
          <span style={{ flex: 1 }}>The course&apos;s native extension isn&apos;t built yet, so pytest can&apos;t load the tests. This is a one-time setup step, not a problem with your code.</span>
          <button type="button" className="btn btn-primary" onClick={() => void buildExt()} disabled={building}>{building ? 'Building…' : 'Build extensions'}</button>
        </div>
      )}

      {result && failed.length === 0 && passed.length > 0 &&<p className="count-pass" style={{ margin: 0 }}>All Day {day} tests pass. Nice work.</p>}

      {result && result.tests.length > 0 && (
        <ul className="test-list" aria-label="Test results">
          {failed.map((t) => <FailedRow key={t.name} t={t} />)}
          {passed.length > 0 && (
            <li>
              <button type="button" className="btn" style={{ minHeight: 32, fontSize: 12 }} aria-expanded={showPassed} onClick={() => setShowPassed((s) => !s)}>
                {showPassed ? 'Hide' : 'Show'} {passed.length} passing
              </button>
            </li>
          )}
          {showPassed && passed.map((t) => (
            <li key={t.name} className="test-row"><div><span className="mark-pass" aria-label="passed">✓</span><span>{t.name}</span></div></li>
          ))}
        </ul>
      )}

      {(log.length > 0 || noJunit) && (
        <div>
          <button type="button" className="btn" style={{ minHeight: 32, fontSize: 12 }} aria-expanded={showLog || !!noJunit} onClick={() => setShowLog((s) => !s)}>
            {showLog || noJunit ? 'Hide' : 'Show'} pytest output
          </button>
          {(showLog || noJunit) && <pre className="log" tabIndex={0}>{log.join('\n')}</pre>}
        </div>
      )}
    </div>
  );
}

function FailedRow({ t }: { t: TestCase }) {
  return (
    <li>
      <details className="test-row failed">
        <summary>
          <span className="mark-fail" aria-label="failed">✗</span>
          <span style={{ flex: 1 }}>{t.name}</span>
          {t.location && <span className="meta">{t.location.replace('src/tiny_llm/', '')}</span>}
        </summary>
        {t.message && <div className="msg">{t.message}</div>}
        {t.detail && <pre tabIndex={0}>{t.detail}</pre>}
      </details>
    </li>
  );
}
