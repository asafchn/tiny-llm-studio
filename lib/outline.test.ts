import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { parseJunit } from './junit.ts';
import { filesInChapter, groupWeeks, parseSummary } from './outline.ts';
import { editablePath, resolveInside } from './paths.ts';

const SUMMARY = `# Tiny-LLM

[Learn LLM Serving](./preface.md)

---

- [Week 1: From Matmul to Text](./week1-overview.md)
    - [Attention](./week1-01-attention.md)
    - [RoPE](./week1-02-positional-encodings.md)
- [🚧 Week 2: Faster](./week2-overview.md)
    - [🚧 Day 1: Cache](./week2-01-kv-cache.md)
    - [Historical Week 2 lesson addresses](./week2-02-benchmark-profile.md)
        - [Earlier quantization lesson](./week2-03-quantize-model.md)
    - [🚧 Day 2: Packed](./week2-02-quantize-model.md)
- [Sponsor](./sponsor.md)
`;

test('parses weeks, days, WIP and historical lessons', () => {
  const items = parseSummary(SUMMARY);
  const { intro, weeks, extra } = groupWeeks(items);
  assert.deepEqual(intro.map((i) => i.slug), ['preface']);
  assert.equal(weeks.length, 2);
  assert.deepEqual(weeks[0].days.map((d) => [d.week, d.day]), [[1, 1], [1, 2]]);
  assert.equal(weeks[1].wip, true);
  assert.equal(weeks[1].title, 'Week 2: Faster');
  // historical items never claim a day number, so they can't collide with the real Day 2
  assert.deepEqual(weeks[1].days.map((d) => [d.slug, d.day]), [['week2-01-kv-cache', 1], ['week2-02-quantize-model', 2]]);
  assert.deepEqual(weeks[1].historical.map((d) => d.slug), ['week2-02-benchmark-profile', 'week2-03-quantize-model']);
  assert.deepEqual(extra.map((i) => i.slug), ['sponsor']);
});

test('finds course files in first-mention order', () => {
  const md = 'Edit `src/tiny_llm/attention.py` and `src/tiny_llm/basics.py`, then src/tiny_llm/attention.py again.';
  assert.deepEqual(filesInChapter(md), ['src/tiny_llm/attention.py', 'src/tiny_llm/basics.py']);
});

test('parses junit failures with location in learner code', () => {
  const xml = `<?xml version="1.0"?><testsuites><testsuite name="pytest" tests="2">
    <testcase classname="tests.t" name="test_ok" time="0.1"/>
    <testcase classname="tests.t" name="test_bad[f32]" time="0.2"><failure message="AssertionError: not close&#10;more">Traceback
src/tiny_llm/attention.py:12: in f
AssertionError &lt;x&gt;</failure></testcase>
  </testsuite></testsuites>`;
  const [ok, bad] = parseJunit(xml);
  assert.equal(ok.status, 'passed');
  assert.equal(bad.status, 'failed');
  assert.equal(bad.location, 'src/tiny_llm/attention.py:12');
  assert.equal(bad.message, 'AssertionError: not close');
  assert.match(bad.detail ?? '', /AssertionError <x>/);
});

test('path guard rejects escapes and symlinks out of the root', () => {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'studio-')));
  fs.mkdirSync(path.join(root, 'a'));
  fs.symlinkSync('/etc', path.join(root, 'a', 'out'));
  assert.equal(resolveInside(root, 'a/x.py'), path.join(root, 'a/x.py'));
  assert.throws(() => resolveInside(root, '../etc/passwd'));
  assert.throws(() => resolveInside(root, '/etc/passwd'));
  assert.throws(() => resolveInside(root, 'a/out/passwd'));
});

test('only learner course files are editable', () => {
  assert.throws(() => editablePath('tests/test_week_1_day_1.py'));
  assert.throws(() => editablePath('src/tiny_llm_ref/attention.py'));
  assert.throws(() => editablePath('src/tiny_llm/../tiny_llm_ref/attention.py'));
  assert.throws(() => editablePath('scripts/dev-tools.py'));
});
