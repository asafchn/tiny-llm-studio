'use client';

import { python } from '@codemirror/lang-python';
import { oneDark } from '@codemirror/theme-one-dark';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';
import { basicSetup } from 'codemirror';
import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';

export type EditorHandle = { saveAll: () => Promise<void> };

type FileState = { state: EditorState; saved: string; mtime: number; conflict?: boolean };

const isDark = () => document.documentElement.dataset.theme !== 'light';

export function CodeEditor({ files, diskVersion, ref }: { files: string[]; diskVersion: number; ref?: Ref<EditorHandle> }) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const docs = useRef(new Map<string, FileState>());
  const theme = useRef(new Compartment());
  const [active, setActive] = useState(files[0]);
  const [dirty, setDirty] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState('');
  const [conflict, setConflict] = useState<string | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const extensions = (path: string) => [
    basicSetup,
    python(),
    theme.current.of(isDark() ? oneDark : []),
    keymap.of([{ key: 'Mod-s', preventDefault: true, run: () => { void save(activeRef.current); return true; } }]),
    EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      const f = docs.current.get(path);
      if (f) setDirty((d) => ({ ...d, [path]: u.state.doc.toString() !== f.saved }));
    }),
    EditorView.contentAttributes.of({ 'aria-label': `Code editor: ${path}` }),
  ];

  async function load(path: string, keepIfDirty = true) {
    const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) return;
    const { content, mtime } = (await res.json()) as { content: string; mtime: number };
    const existing = docs.current.get(path);
    if (existing && existing.mtime === mtime) return;
    if (existing && keepIfDirty && existing.state.doc.toString() !== existing.saved) {
      docs.current.set(path, { ...existing, conflict: true });
      if (path === activeRef.current) setConflict(path);
      return;
    }
    const state = EditorState.create({ doc: content, extensions: extensions(path) });
    docs.current.set(path, { state, saved: content, mtime });
    setDirty((d) => ({ ...d, [path]: false }));
    if (path === activeRef.current) view.current?.setState(state);
  }

  async function save(path: string, force = false) {
    const f = docs.current.get(path);
    if (!f) return;
    if (path === activeRef.current && view.current) f.state = view.current.state;
    const content = f.state.doc.toString();
    if (content === f.saved && !force) return;
    const res = await fetch('/api/file', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ path, content, baseMtime: f.mtime, force }),
    });
    if (res.status === 409) {
      setConflict(path);
      return;
    }
    const { mtime } = (await res.json()) as { mtime: number };
    docs.current.set(path, { state: f.state, saved: content, mtime });
    setDirty((d) => ({ ...d, [path]: false }));
    setConflict(null);
    setStatus(`Saved ${path.split('/').pop()}`);
  }

  useImperativeHandle(ref, () => ({
    saveAll: async () => {
      await Promise.all(files.map((p) => save(p)));
    },
  }));

  // Create the view once; load every chapter file in parallel.
  useEffect(() => {
    if (!host.current) return;
    const v = new EditorView({ parent: host.current });
    view.current = v;
    void Promise.all(files.map((p) => load(p))).then(() => {
      const f = docs.current.get(activeRef.current);
      if (f) v.setState(f.state);
    });
    const obs = new MutationObserver(() => v.dispatch({ effects: theme.current.reconfigure(isDark() ? oneDark : []) }));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => { obs.disconnect(); v.destroy(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Leaving the page would drop unsaved edits.
  const anyDirty = Object.values(dirty).some(Boolean);
  useEffect(() => {
    if (!anyDirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [anyDirty]);

  // The tutor (or Undo) touched files on disk: pull them in unless there are unsaved edits.
  useEffect(() => {
    if (diskVersion === 0) return;
    if (view.current && docs.current.get(activeRef.current)) docs.current.get(activeRef.current)!.state = view.current.state;
    void Promise.all(files.map((p) => load(p)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diskVersion]);

  const switchTo = (path: string) => {
    if (!view.current || path === active) return;
    const cur = docs.current.get(active);
    if (cur) cur.state = view.current.state;
    const next = docs.current.get(path);
    if (next) view.current.setState(next.state);
    setActive(path);
    setConflict(next?.conflict ? path : null);
  };

  if (files.length === 0) {
    return <div className="editor-host meta" style={{ padding: 16 }}>This chapter doesn&apos;t name a course file to edit.</div>;
  }

  return (
    <>
      <div className="file-tabs" role="tablist" aria-label="Files">
        {files.map((p) => (
          <button key={p} type="button" role="tab" className="file-tab" aria-selected={p === active} onClick={() => switchTo(p)} title={p}>
            {p.replace('src/tiny_llm/', '')}
            {dirty[p] && <span aria-label=" (unsaved)"> ●</span>}
          </button>
        ))}
      </div>
      {conflict && (
        <div className="notice" role="alert">
          <span style={{ flex: 1 }}>{conflict.split('/').pop()} changed on disk while you had unsaved edits.</span>
          <button type="button" className="btn" onClick={() => { docs.current.delete(conflict); setConflict(null); void load(conflict, false); }}>Load disk version</button>
          <button type="button" className="btn" onClick={() => void save(conflict, true)}>Keep mine</button>
        </div>
      )}
      <div ref={host} className="editor-host" />
      <div className="sr-only" aria-live="polite">{status}</div>
    </>
  );
}
