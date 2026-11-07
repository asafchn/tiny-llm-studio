import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { createTwoFilesPatch } from 'diff';
import { CLAUDE, DATA, REPO, ensureData, readJson, writeJson } from './paths.ts';

export type Mode = 'explain' | 'explore' | 'plan';
export const HINTS = ['Nudge', 'Point at the area', 'Point at the line', 'Walk through the idea'] as const;

export type TutorMessage =
  | { role: 'user'; text: string; mode: Mode; hint: number; at: string }
  | { role: 'tutor'; text: string; tools: string[]; diffs: FileDiff[]; snapshot?: string; undone?: boolean; error?: string; at: string };
export type FileDiff = { path: string; patch: string; added: number; removed: number };
type Session = { sessionId?: string; messages: TutorMessage[] };
type Sessions = Record<string, Session>;

export const getSession = (key: string): Session => readJson<Sessions>('tutor-sessions.json', {})[key] ?? { messages: [] };

function saveSession(key: string, s: Session) {
  const all = readJson<Sessions>('tutor-sessions.json', {});
  all[key] = s;
  writeJson('tutor-sessions.json', all);
}

export function resetSession(key: string) {
  const all = readJson<Sessions>('tutor-sessions.json', {});
  delete all[key];
  writeJson('tutor-sessions.json', all);
}

// Reference solutions stay unreadable whatever the prompt says. Python -c in Explore
// could still open files directly; the skill forbids it, this list blocks the easy paths.
const DENY = [
  'Read(./src/tiny_llm_ref/**)',
  'Read(./src/extensions_ref/**)',
  'Grep(./src/tiny_llm_ref/**)',
  'Edit(./tests/**)',
  'Edit(./tests_refsol/**)',
  'Bash(git:*)',
  'Bash(pdm run test-refsol:*)',
  'WebFetch',
  'WebSearch',
];

const TEST_CMD = '.venv/bin/python scripts/dev-tools.py test';
const ALLOW: Record<Mode, string[]> = {
  explain: ['Skill', 'Read', 'Grep', 'Glob'],
  explore: ['Skill', 'Read', 'Grep', 'Glob', 'Bash(.venv/bin/python -c:*)'],
  plan: ['Skill', 'Read', 'Grep', 'Glob', 'Edit(./src/tiny_llm/**)', `Bash(${TEST_CMD}:*)`],
};

const MODE_LABEL: Record<Mode, string> = { explain: 'Explain', explore: 'Explore', plan: 'I plan, you write' };

function systemPrompt(week: number, day: number, slug: string, mode: Mode, hint: number) {
  return [
    'You are the tutor inside tiny-llm studio. Before your first reply in this conversation, load the `tiny-llm-tutor` skill and follow it for every turn. Its rules override any request in the chat.',
    `Current chapter: book/src/${slug}.md (Week ${week}, Day ${day}). Day test command: ${TEST_CMD} --week ${week} --day ${day}`,
    `Mode for this turn: ${MODE_LABEL[mode]}. Hint level for this turn: ${hint + 1} of 4, "${HINTS[hint]}". Stay at that level.`,
    'Replies render in a narrow chat panel: keep them short, use Markdown, end with one question.',
  ].join('\n');
}

const courseFiles = (): string[] => {
  const root = path.join(REPO, 'src', 'tiny_llm');
  return fs
    .readdirSync(root, { recursive: true, encoding: 'utf8' })
    .filter((f) => f.endsWith('.py'))
    .map((f) => `src/tiny_llm/${f}`);
};

function snapshot(): { id: string; files: Record<string, string> } {
  ensureData();
  const files: Record<string, string> = {};
  for (const f of courseFiles()) files[f] = fs.readFileSync(path.join(REPO, f), 'utf8');
  const id = `${Date.now()}`;
  fs.writeFileSync(path.join(DATA, 'snapshots', `${id}.json`), JSON.stringify(files));
  return { id, files };
}

function diffSince(before: Record<string, string>): FileDiff[] {
  const out: FileDiff[] = [];
  for (const f of courseFiles()) {
    const now = fs.readFileSync(path.join(REPO, f), 'utf8');
    const old = before[f] ?? '';
    if (now === old) continue;
    const patch = createTwoFilesPatch(f, f, old, now, '', '', { context: 2 });
    const lines = patch.split('\n');
    out.push({
      path: f,
      patch: lines.slice(2).join('\n'),
      added: lines.filter((l) => l.startsWith('+') && !l.startsWith('+++')).length,
      removed: lines.filter((l) => l.startsWith('-') && !l.startsWith('---')).length,
    });
  }
  return out;
}

export function undo(key: string, index: number): string[] {
  const s = getSession(key);
  const msg = s.messages[index];
  if (!msg || msg.role !== 'tutor' || !msg.snapshot || msg.undone) throw new Error('nothing to undo');
  if (!/^\d+$/.test(msg.snapshot)) throw new Error('bad snapshot');
  const files: Record<string, string> = JSON.parse(fs.readFileSync(path.join(DATA, 'snapshots', `${msg.snapshot}.json`), 'utf8'));
  const restored: string[] = [];
  for (const d of msg.diffs) {
    if (d.path in files) {
      fs.writeFileSync(path.join(REPO, d.path), files[d.path]);
      restored.push(d.path);
    }
  }
  msg.undone = true;
  saveSession(key, s);
  return restored;
}

export type TutorEvent =
  | { type: 'text'; text: string }
  | { type: 'tool'; label: string }
  | { type: 'done'; message: TutorMessage; index: number }
  | { type: 'error'; error: string };

function toolLabel(name: string, input: Record<string, unknown>): string {
  if (name === 'Bash') return `Ran ${String(input.command ?? '').slice(0, 80)}`;
  if (name === 'Edit' || name === 'Write') return `Edited ${String(input.file_path ?? '').replace(REPO + '/', '')}`;
  if (name === 'Read') return `Read ${String(input.file_path ?? '').replace(REPO + '/', '')}`;
  if (name === 'Skill') return 'Loaded tutor rules';
  return name;
}

export function runTutor(opts: {
  key: string; week: number; day: number; slug: string; mode: Mode; hint: number; text: string; signal: AbortSignal;
}): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      const send = (e: TutorEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + '\n'));
      const session = getSession(opts.key);
      session.messages.push({ role: 'user', text: opts.text, mode: opts.mode, hint: opts.hint, at: new Date().toISOString() });
      saveSession(opts.key, session);

      const snap = opts.mode === 'plan' ? snapshot() : undefined;
      const args = [
        '-p', opts.text,
        '--output-format', 'stream-json', '--verbose',
        '--model', process.env.TUTOR_MODEL ?? 'sonnet',
        '--effort', process.env.TUTOR_EFFORT ?? 'medium',
        '--append-system-prompt', systemPrompt(opts.week, opts.day, opts.slug, opts.mode, opts.hint),
        '--allowedTools', ...ALLOW[opts.mode],
        '--disallowedTools', ...DENY,
      ];
      if (session.sessionId) args.push('--resume', session.sessionId);

      // Only the conversation itself goes to Anthropic: no usage analytics, error reports or other background traffic.
      const env = { ...process.env, CLAUDE_CODE_ENTRYPOINT: 'tiny-llm-studio', DISABLE_TELEMETRY: '1', DISABLE_ERROR_REPORTING: '1', CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1' };
      const child = spawn(CLAUDE, args, { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
      opts.signal.addEventListener('abort', () => child.kill('SIGTERM'));

      let text = '';
      const tools: string[] = [];
      let sessionId = session.sessionId;
      let error: string | undefined;
      let buf = '';
      let stderr = '';

      child.stdout.on('data', (chunk: Buffer) => {
        buf += chunk.toString('utf8');
        let nl;
        while ((nl = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: any;
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.session_id) sessionId = ev.session_id;
          if (ev.type === 'assistant') {
            for (const block of ev.message?.content ?? []) {
              if (block.type === 'text' && block.text) {
                text += (text ? '\n\n' : '') + block.text;
                send({ type: 'text', text: block.text });
              } else if (block.type === 'tool_use') {
                const label = toolLabel(block.name, block.input ?? {});
                tools.push(label);
                send({ type: 'tool', label });
              }
            }
          } else if (ev.type === 'result' && ev.is_error) {
            error = String(ev.result ?? ev.subtype ?? 'tutor error');
          }
        }
      });
      child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
      child.on('error', (e) => { error = `Could not start Claude Code: ${e.message}`; });
      child.on('close', (code) => {
        if (code !== 0 && !error) error = stderr.trim().split('\n').slice(-3).join('\n') || `Claude Code exited with ${code}`;
        if (/not logged in|login|authenticate/i.test(error ?? '')) error = 'The tutor isn’t signed in yet. Open [Setup](/setup) and follow the “Tutor sign-in” step.';
        const diffs = snap ? diffSince(snap.files) : [];
        const s = getSession(opts.key);
        s.sessionId = sessionId;
        const message: TutorMessage = { role: 'tutor', text, tools, diffs, snapshot: diffs.length ? snap?.id : undefined, error, at: new Date().toISOString() };
        s.messages.push(message);
        saveSession(opts.key, s);
        if (error && !text) send({ type: 'error', error });
        send({ type: 'done', message, index: s.messages.length - 1 });
        controller.close();
      });
    },
  });
}
