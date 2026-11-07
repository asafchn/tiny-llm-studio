'use client';

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { ndjson } from '@/lib/ndjson.ts';
import type { FileDiff, Mode, TutorEvent, TutorMessage } from '@/lib/tutor.ts';

const HINTS = ['Nudge', 'Point at the area', 'Point at the line', 'Walk through the idea'];
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'explain', label: 'Explain', hint: 'Ask about anything in the chapter or your code.' },
  { id: 'explore', label: 'Explore', hint: 'Ask it to run small experiments, like printing shapes.' },
  { id: 'plan', label: 'I plan, you write', hint: 'Describe your approach step by step. The tutor writes only what you say.' },
];

type Pending = { text: string; tools: string[] };

export function Tutor({ week, day, slug, beforeSend, onFilesChanged }: {
  week: number; day: number; slug: string; beforeSend: () => Promise<void>; onFilesChanged: () => void;
}) {
  const [messages, setMessages] = useState<TutorMessage[]>([]);
  const [mode, setMode] = useState<Mode>('plan');
  const [hint, setHint] = useState(0);
  const [draft, setDraft] = useState('');
  const [pending, setPending] = useState<Pending | null>(null);
  const [error, setError] = useState('');
  const [announce, setAnnounce] = useState('');
  const chat = useRef<HTMLDivElement>(null);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    void fetch(`/api/tutor?week=${week}&day=${day}`).then((r) => r.json()).then((d: { messages: TutorMessage[] }) => setMessages(d.messages ?? []));
  }, [week, day]);

  useEffect(() => {
    chat.current?.scrollTo({ top: chat.current.scrollHeight });
  }, [messages, pending]);

  async function send(text: string, hintLevel = hint) {
    const body = text.trim();
    if (!body || pending) return;
    setError('');
    setDraft('');
    setMessages((m) => [...m, { role: 'user', text: body, mode, hint: hintLevel, at: new Date().toISOString() }]);
    setPending({ text: '', tools: [] });
    const ctl = new AbortController();
    abort.current = ctl;
    try {
      await beforeSend();
      const res = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ week, day, slug, mode, hint: hintLevel, text: body }),
        signal: ctl.signal,
      });
      if (!res.ok) throw new Error((await res.json()).error ?? 'tutor request failed');
      for await (const ev of ndjson<TutorEvent>(res)) {
        if (ev.type === 'text') setPending((p) => p && { ...p, text: p.text + (p.text ? '\n\n' : '') + ev.text });
        else if (ev.type === 'tool') setPending((p) => p && { ...p, tools: [...p.tools, ev.label] });
        else if (ev.type === 'error') setError(ev.error);
        else if (ev.type === 'done') {
          setMessages((m) => [...m, ev.message]);
          if (ev.message.role === 'tutor' && ev.message.diffs.length) onFilesChanged();
          setAnnounce('Tutor replied');
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setPending(null);
    }
  }

  // Stable identity so memoised bubbles skip re-rendering.
  const onUndo = useCallback(async (index: number) => {
    const res = await fetch('/api/tutor', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ week, day, action: 'undo', index }) });
    if (!res.ok) return setError((await res.json()).error);
    setMessages((m) => m.map((msg, i) => (i === index && msg.role === 'tutor' ? { ...msg, undone: true } : msg)));
    onFilesChanged();
  }, [week, day, onFilesChanged]);

  async function reset() {
    if (!confirm('Start a new conversation for this day? The tutor forgets this chat; your code stays as it is.')) return;
    await fetch('/api/tutor', { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ week, day, action: 'reset' }) });
    setMessages([]);
  }

  const nextHint = () => {
    const h = Math.min(3, hint + 1);
    setHint(h);
    void send(`Can I have the next hint? (${HINTS[h]})`, h);
  };

  const modeInfo = MODES.find((m) => m.id === mode)!;

  return (
    <div className="tutor">
      <div className="tutor-bar">
        <div className="seg" role="group" aria-label="Tutor mode">
          {MODES.map((m) => (
            <button key={m.id} type="button" aria-pressed={mode === m.id} onClick={() => setMode(m.id)}>{m.label}</button>
          ))}
        </div>
        <div className="spacer" />
        <label style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--muted)', fontSize: 13 }}>
          Hint level
          <select value={hint} onChange={(e) => setHint(Number(e.target.value))}>
            {HINTS.map((h, i) => <option key={h} value={i}>{h}</option>)}
          </select>
        </label>
        <button type="button" className="btn" onClick={() => void reset()} title="Start a new conversation for this day">New chat</button>
      </div>

      <div className="chat" ref={chat} role="log" aria-label="Tutor conversation">
        {messages.length === 0 && !pending && (
          <div className="meta" style={{ lineHeight: 1.6 }}>
            <p style={{ margin: '0 0 8px' }}>The tutor won&apos;t hand you the answer. It asks questions and gives hints one step at a time, so you work it out yourself.</p>
            <p style={{ margin: 0 }}>Try: “Why do we divide by √d?” or, in <em>I plan, you write</em>: “Compute Q·Kᵀ, scale it, softmax, multiply by V.”</p>
          </div>
        )}
        {messages.map((m, i) =>
          m.role === 'user' ? (
            <div key={i} className="bubble-user">{m.text}</div>
          ) : (
            <TutorBubble key={i} m={m} index={i} onUndo={onUndo} />
          ),
        )}
        {pending && (
          <div className="bubble-tutor">
            {pending.tools.map((t, i) => <div key={i} className="tool-chip">· {t}</div>)}
            {pending.text ? <div className="body"><Md text={pending.text} /></div> : <div className="typing">Thinking…</div>}
          </div>
        )}
        {error && <div className="notice" role="alert">{error}</div>}
      </div>
      <div className="sr-only" aria-live="polite">{announce}</div>

      <form
        className="composer"
        onSubmit={(e) => { e.preventDefault(); void send(draft); }}
      >
        <label htmlFor="tutor-input" className="meta">{modeInfo.hint}</label>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <textarea
            id="tutor-input"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); void send(draft); }
            }}
            placeholder={mode === 'plan' ? 'My plan: first …, then …' : 'Ask the tutor…'}
            name="message"
            autoComplete="off"
            rows={2}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {pending ? (
              <button type="button" className="btn btn-primary" onClick={() => abort.current?.abort()}>Stop</button>
            ) : (
              <button type="submit" className="btn btn-primary" disabled={!draft.trim()}>Send</button>
            )}
            <button type="button" className="btn" onClick={nextHint} disabled={!!pending || messages.length === 0 || hint === 3}>Next hint</button>
          </div>
        </div>
      </form>
    </div>
  );
}

// Memoised: while a reply streams in, the earlier (finished) messages don't re-parse their Markdown.
const TutorBubble = memo(function TutorBubble({ m, index, onUndo }: { m: Extract<TutorMessage, { role: 'tutor' }>; index: number; onUndo: (i: number) => void }) {
  return (
    <div className="bubble-tutor">
      {m.tools.length > 0 && (
        <details>
          <summary className="tool-chip" style={{ cursor: 'pointer' }}>{m.tools.length} step{m.tools.length > 1 ? 's' : ''}</summary>
          {m.tools.map((t, i) => <div key={i} className="tool-chip">· {t}</div>)}
        </details>
      )}
      {m.diffs.map((d) => <Diff key={d.path} d={d} />)}
      {m.text && <div className="body"><Md text={m.text} /></div>}
      {m.error && <div className="notice">{m.error}</div>}
      {m.snapshot && (
        <div>
          <button type="button" className="btn" onClick={() => onUndo(index)} disabled={m.undone}>{m.undone ? 'Change undone' : 'Undo this change'}</button>
        </div>
      )}
    </div>
  );
});

function Diff({ d }: { d: FileDiff }) {
  return (
    <div className="diff">
      <div className="diff-head"><span className="mono">{d.path.replace('src/tiny_llm/', '')}</span><span>+{d.added} −{d.removed}</span></div>
      <pre>
        {d.patch.split('\n').map((l, i) => (
          <div key={i} className={l.startsWith('+') ? 'add' : l.startsWith('-') ? 'del' : l.startsWith('@@') ? 'hunk' : undefined}>{l || ' '}</div>
        ))}
      </pre>
    </div>
  );
}

function Md({ text }: { text: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{text}</ReactMarkdown>;
}
