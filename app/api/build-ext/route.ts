import { spawn } from 'node:child_process';
import path from 'node:path';
import { PYTHON, REPO } from '@/lib/paths.ts';

export const dynamic = 'force-dynamic';

// Same as `pdm run build-ext` then `pdm run build-ext-ref`: the course's native modules,
// which test collection imports even on Day 1. The ref module is Metal-only upstream, so on
// Linux it can't compile; Week 1 tests don't need it, so its failure is reported, not fatal.
const STEPS = [
  { dir: 'src/extensions', required: true },
  { dir: 'src/extensions_ref', required: process.platform === 'darwin' },
];

export async function POST(req: Request) {
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + '\n'));
      for (const { dir, required } of STEPS) {
        send({ type: 'log', line: `$ cd ${dir} && python build.py` });
        const code = await new Promise<number | null>((resolve) => {
          const child = spawn(PYTHON, ['build.py'], { cwd: path.join(REPO, dir), env: { ...process.env, PYTHONUNBUFFERED: '1' } });
          req.signal.addEventListener('abort', () => child.kill('SIGTERM'));
          const onData = (c: Buffer) => c.toString('utf8').split('\n').filter(Boolean).forEach((line) => send({ type: 'log', line }));
          child.stdout.on('data', onData);
          child.stderr.on('data', onData);
          child.on('error', (e) => { send({ type: 'log', line: e.message }); resolve(1); });
          child.on('close', resolve);
        });
        if (code !== 0 && !required) {
          send({ type: 'log', line: `(${dir} is Mac-only upstream and is skipped on Linux. Week 1 doesn't need it.)` });
        } else if (code !== 0) {
          send({ type: 'done', ok: false });
          controller.close();
          return;
        }
      }
      send({ type: 'done', ok: true });
      controller.close();
    },
  });
  return new Response(stream, { headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-store' } });
}
