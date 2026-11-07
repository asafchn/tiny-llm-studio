'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorHandle } from './CodeEditor.tsx';
import { TestRunner } from './TestRunner.tsx';

// Both heavy panes load on demand: CodeMirror on first paint of the panel, the tutor only when opened.
const CodeEditor = dynamic(() => import('./CodeEditor.tsx').then((m) => m.CodeEditor), {
  ssr: false,
  loading: () => <div className="editor-host meta" style={{ padding: 16 }}>Loading editor…</div>,
});
const Tutor = dynamic(() => import('./Tutor.tsx').then((m) => m.Tutor), {
  ssr: false,
  loading: () => <div className="meta" style={{ padding: 16 }}>Loading tutor…</div>,
});

type Tab = 'editor' | 'tutor';

export function PracticePanel({ week, day, slug, files }: { week: number; day: number; slug: string; files: string[] }) {
  const [tab, setTab] = useState<Tab>('editor');
  const [tutorOpened, setTutorOpened] = useState(false);

  // The open tab lives in the URL (?panel=tutor), so reload and links keep it.
  useEffect(() => {
    if (new URLSearchParams(location.search).get('panel') === 'tutor') {
      setTab('tutor');
      setTutorOpened(true);
    }
  }, []);
  const [diskVersion, setDiskVersion] = useState(0);
  const [runSignal, setRunSignal] = useState(0);
  const editor = useRef<EditorHandle | null>(null);

  const open = (t: Tab) => {
    setTab(t);
    if (t === 'tutor') setTutorOpened(true);
    const url = new URL(location.href);
    if (t === 'tutor') url.searchParams.set('panel', 'tutor');
    else url.searchParams.delete('panel');
    history.replaceState(history.state, '', url);
  };
  const filesChanged = useCallback(() => setDiskVersion((v) => v + 1), []);
  const beforeRun = useCallback(async () => { await editor.current?.saveAll(); }, []);

  return (
    <section
      className="panel"
      aria-label="Practice"
      onKeyDown={(e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter' && tab === 'editor') {
          e.preventDefault();
          setRunSignal((n) => n + 1);
        }
      }}
    >
      <div className="panel-tabs">
        <div className="seg" role="tablist" aria-label="Practice panel">
          <button type="button" role="tab" id="tab-editor" aria-controls="pane-editor" aria-selected={tab === 'editor'} onClick={() => open('editor')}>Editor</button>
          <button type="button" role="tab" id="tab-tutor" aria-controls="pane-tutor" aria-selected={tab === 'tutor'} onClick={() => open('tutor')}>Tutor</button>
        </div>
        <div className="spacer" />
        <span className="kbd">{tab === 'editor' ? 'Ctrl+S save · Ctrl+Enter run tests' : 'Ctrl+Enter send'}</span>
      </div>

      {/* Kept mounted while hidden so unsaved edits and undo history survive tab switches. */}
      <div id="pane-editor" role="tabpanel" aria-labelledby="tab-editor" hidden={tab !== 'editor'} style={{ display: tab === 'editor' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <CodeEditor ref={editor} files={files} diskVersion={diskVersion} />
        <TestRunner week={week} day={day} runSignal={runSignal} beforeRun={beforeRun} />
      </div>
      {tutorOpened && (
        <div id="pane-tutor" role="tabpanel" aria-labelledby="tab-tutor" hidden={tab !== 'tutor'} style={{ display: tab === 'tutor' ? 'flex' : 'none', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <Tutor week={week} day={day} slug={slug} beforeSend={beforeRun} onFilesChanged={filesChanged} />
        </div>
      )}
    </section>
  );
}
