import { XMLParser } from 'fast-xml-parser';

export type TestCase = {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  message?: string;
  detail?: string;
  /** file:line of the deepest frame inside the learner's code, when we can find one */
  location?: string;
  seconds: number;
};

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '',
  textNodeName: 'text',
  // pytest output never needs entities beyond the XML builtins; refuse DOCTYPE tricks outright
  processEntities: false,
  isArray: (name) => name === 'testcase' || name === 'testsuite',
});

const unescape = (s: string) =>
  s
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, h) => String.fromCodePoint(Math.min(parseInt(h, 16), 0x10ffff)))
    .replace(/&#(\d{1,7});/g, (_, d) => String.fromCodePoint(Math.min(Number(d), 0x10ffff)))
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');

export function parseJunit(xml: string): TestCase[] {
  const doc = parser.parse(xml);
  const suites = doc.testsuites?.testsuite ?? doc.testsuite ?? [];
  const out: TestCase[] = [];
  for (const suite of suites) {
    for (const tc of suite.testcase ?? []) {
      const fail = tc.failure ?? tc.error;
      const node = Array.isArray(fail) ? fail[0] : fail;
      const detail = node ? unescape(typeof node === 'string' ? node : (node.text ?? '')) : undefined;
      const loc = detail ? [...detail.matchAll(/(src\/tiny_llm\/[\w/]+\.py):(\d+)/g)].pop() : undefined;
      out.push({
        name: tc.name,
        status: node ? 'failed' : tc.skipped !== undefined ? 'skipped' : 'passed',
        message: node && typeof node !== 'string' && node.message ? unescape(node.message).split('\n')[0] : undefined,
        detail,
        location: loc ? `${loc[1]}:${loc[2]}` : undefined,
        seconds: Number(tc.time ?? 0),
      });
    }
  }
  return out;
}
