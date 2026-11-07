import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const REPO = path.resolve(process.env.TINY_LLM_DIR ?? path.join(os.homedir(), 'tiny-llm'));
export const BOOK = path.join(REPO, 'book', 'src');
export const DATA = path.join(os.homedir(), '.tiny-llm-studio');
export const PYTHON = process.env.TINY_LLM_PYTHON ?? path.join(REPO, '.venv', 'bin', 'python');
export const CLAUDE = process.env.CLAUDE_BIN ?? path.join(os.homedir(), '.local', 'node', 'bin', 'claude');

// The only files the browser may write: the learner's own course code.
export const EDITABLE = /^src\/tiny_llm\/[A-Za-z0-9_/]+\.py$/;

/** Resolve a repo-relative path, refusing anything (including symlinks) that escapes `root`. */
export function resolveInside(root: string, rel: string): string {
  if (path.isAbsolute(rel) || rel.includes('\0')) throw new Error('bad path');
  const abs = path.resolve(root, rel);
  if (abs !== root && !abs.startsWith(root + path.sep)) throw new Error('path escapes root');
  if (fs.existsSync(abs)) {
    const real = fs.realpathSync(abs);
    const realRoot = fs.realpathSync(root);
    if (real !== realRoot && !real.startsWith(realRoot + path.sep)) throw new Error('path escapes root');
  }
  return abs;
}

export function editablePath(rel: string): string {
  if (!EDITABLE.test(rel) || rel.includes('..')) throw new Error('not an editable course file');
  return resolveInside(REPO, rel);
}

export function ensureData(): void {
  fs.mkdirSync(path.join(DATA, 'snapshots'), { recursive: true });
}

export function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(file: string, value: unknown): void {
  ensureData();
  const target = path.join(DATA, file);
  const tmp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, target);
}
