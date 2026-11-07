import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { CLAUDE, PYTHON, REPO } from './paths.ts';

export type StepId = 'python' | 'compiler' | 'extensions' | 'claude';
export type Step = { id: StepId; ok: boolean; detail?: string };

const which = (bin: string) => spawnSync('sh', ['-c', `command -v ${bin}`], { encoding: 'utf8' }).status === 0;

function checkPython(): Step {
  const r = spawnSync(PYTHON, ['-c', 'import mlx.core, torch; print("ok")'], { cwd: REPO, encoding: 'utf8', timeout: 60_000 });
  return { id: 'python', ok: r.stdout.trim() === 'ok', detail: r.status === 0 ? undefined : (r.stderr || r.error?.message || '').trim().split('\n').pop() };
}

function checkExtensions(): Step {
  const dir = path.join(REPO, 'src', 'extensions', 'tiny_llm_ext');
  const built = fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.startsWith('_ext') && f.endsWith('.so'));
  return { id: 'extensions', ok: built };
}

function checkClaude(): Step {
  if (!fs.existsSync(CLAUDE)) return { id: 'claude', ok: false, detail: 'Claude Code is not installed in Ubuntu.' };
  const r = spawnSync(CLAUDE, ['auth', 'status'], { encoding: 'utf8', timeout: 30_000 });
  try {
    return { id: 'claude', ok: JSON.parse(r.stdout).loggedIn === true };
  } catch {
    return { id: 'claude', ok: r.status === 0 };
  }
}

export function setupStatus(): Step[] {
  return [checkPython(), { id: 'compiler', ok: which('g++') && which('cmake') }, checkExtensions(), checkClaude()];
}
