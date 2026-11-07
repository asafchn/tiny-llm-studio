import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parseJunit, type TestCase } from './junit.ts';
import { PYTHON, REPO } from './paths.ts';
import { recordRun } from './progress.ts';
import { dayKey } from './outline.ts';

export type TestEvent =
  | { type: 'log'; line: string }
  | { type: 'result'; tests: TestCase[]; passed: number; failed: number; seconds: number; exitCode: number | null };

// The course parametrises every test over [cpu, gpu]. With CPU-only MLX the gpu half can
// never pass, so deselect it rather than show permanent red. Probed once per server.
let gpu: boolean | undefined;
function hasGpu(): boolean {
  if (gpu === undefined) {
    const r = spawnSync(PYTHON, ['-c', 'import mlx.core as mx; print(mx.default_device().type == mx.DeviceType.gpu)'], { cwd: REPO, encoding: 'utf8', timeout: 30_000 });
    gpu = r.stdout.trim() === 'True';
  }
  return gpu;
}

export function runDayTests(week: number, day: number, only: string[], signal: AbortSignal): ReadableStream<Uint8Array> {
  const enc = new TextEncoder();
  const xml = path.join(os.tmpdir(), `tiny-llm-studio-${process.pid}-${Date.now()}.xml`);
  const filters = [
    ...(only.length ? [`(${only.map((n) => n.replace(/[^\w-]/g, ' ').trim().replace(/\s+/g, ' and ')).join(' or ')})`] : []),
    ...(hasGpu() ? [] : ['not gpu']),
  ];
  const extra = filters.length ? ['-k', filters.join(' and ')] : [];
  const args = ['scripts/dev-tools.py', 'test', '--week', String(week), '--day', String(day), '--', `--junitxml=${xml}`, '-q', ...extra];
  const started = Date.now();

  return new ReadableStream({
    start(controller) {
      const send = (e: TestEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + '\n'));
      const child = spawn(PYTHON, args, { cwd: REPO, env: { ...process.env, PYTHONUNBUFFERED: '1' } });
      signal.addEventListener('abort', () => child.kill('SIGTERM'));
      let carry = '';
      const onData = (c: Buffer) => {
        carry += c.toString('utf8');
        const lines = carry.split('\n');
        carry = lines.pop() ?? '';
        for (const line of lines) send({ type: 'log', line });
      };
      child.stdout.on('data', onData);
      child.stderr.on('data', onData);
      child.on('error', (e) => send({ type: 'log', line: `Could not start Python: ${e.message}` }));
      child.on('close', (code) => {
        if (carry) send({ type: 'log', line: carry });
        let tests: TestCase[] = [];
        try {
          tests = parseJunit(fs.readFileSync(xml, 'utf8'));
          fs.rmSync(xml, { force: true });
        } catch {
          // collection error or crash: no junit file, the log says why
        }
        const passed = tests.filter((t) => t.status === 'passed').length;
        const failed = tests.filter((t) => t.status === 'failed').length + (tests.length === 0 && code !== 0 ? 1 : 0);
        if (!only.length) recordRun(dayKey(week, day), passed, failed);
        send({ type: 'result', tests, passed, failed, seconds: (Date.now() - started) / 1000, exitCode: code });
        controller.close();
      });
    },
  });
}
