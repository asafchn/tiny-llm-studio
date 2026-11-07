import ReactMarkdown, { type Components } from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { highlight } from '@/lib/highlight.ts';

// Book-relative links (./setup.md#x) become in-app routes; images go through the asset route.
function rewriteHref(href = ''): string {
  if (/^[a-z]+:/i.test(href) || href.startsWith('#') || href.startsWith('/')) return href;
  const m = /^(?:\.\/)?([\w.-]+)\.md(#.*)?$/.exec(href);
  return m ? `/learn/${m[1]}${m[2] ?? ''}` : href;
}

// The book's shell commands that the studio does with a button instead.
const BUTTON_FOR: [RegExp, string][] = [
  [/^pdm run (test|copy-test)\b/, 'You don’t need to type this: use the Run tests button in the panel on the right.'],
  [/^pdm run (build-ext|build-ext-ref|clean-ext)\b/, 'You don’t need to type this: the studio’s Setup page builds the course extension for you.'],
  [/^pdm (install|sync)\b/, 'You don’t need to type this: your environment is already set up (and pdm would replace it with older, vulnerable versions).'],
];

async function Code({ className, children }: { className?: string; children?: React.ReactNode }) {
  const lang = /language-(\w+)/.exec(className ?? '')?.[1];
  const src = String(children ?? '').replace(/\n$/, '');
  if (!lang && !src.includes('\n')) return <code className={className}>{children}</code>;
  if (lang && /^(bash|sh|shell|console|zsh)$/.test(lang)) {
    const lines = src.split('\n').map((l) => l.replace(/^\$\s*/, '').trim()).filter(Boolean);
    const hints = lines.map((l) => BUTTON_FOR.find(([re]) => re.test(l))?.[1]);
    if (lines.length && hints.every(Boolean)) {
      return (
        <div className="notice" role="note" style={{ margin: '0 0 16px', borderColor: 'var(--line-strong)' }}>
          <span>{[...new Set(hints)].join(' ')}</span>
          <details style={{ width: '100%' }}><summary className="meta" style={{ cursor: 'pointer' }}>Show the original command</summary><pre style={{ margin: '8px 0 0' }}><code>{src}</code></pre></details>
        </div>
      );
    }
    if (lines.some((l) => l.startsWith('pdm run'))) {
      return (
        <>
          <div dangerouslySetInnerHTML={{ __html: await highlight(src, lang) }} />
          <p className="meta" style={{ margin: '-8px 0 16px' }}>Run this in the Ubuntu terminal window, inside <code>~/tiny-llm</code>.</p>
        </>
      );
    }
  }
  // Shiki escapes everything it emits, so this HTML carries no markup from the book.
  return <div dangerouslySetInnerHTML={{ __html: await highlight(src, lang ?? 'text') }} />;
}

// mdBook's heading ids, so the book's own `page.md#section` links land on the right heading.
const text = (n: React.ReactNode): string =>
  typeof n === 'string' || typeof n === 'number' ? String(n)
  : Array.isArray(n) ? n.map(text).join('')
  : n && typeof n === 'object' && 'props' in n ? text((n as React.ReactElement<{ children?: React.ReactNode }>).props.children)
  : '';
const slugify = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const heading = (Tag: 'h1' | 'h2' | 'h3' | 'h4') =>
  function H({ children }: { children?: React.ReactNode }) {
    return <Tag id={slugify(text(children))}>{children}</Tag>;
  };

const components: Components = {
  h1: heading('h1'),
  h2: heading('h2'),
  h3: heading('h3'),
  h4: heading('h4'),
  a: ({ href, children }) => {
    const to = rewriteHref(href);
    const external = /^https?:/.test(to);
    return <a href={to} {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}>{children}</a>;
  },
  img: ({ src, alt }) => {
    const s = typeof src === 'string' ? src : '';
    const url = /^[a-z]+:/i.test(s) ? s : `/api/book-asset/${s.replace(/^\.\//, '')}`;
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={alt ?? ''} loading="lazy" />;
  },
  pre: ({ children }) => <>{children}</>,
  code: Code as Components['code'],
};

export function Markdown({ source }: { source: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={components}>
      {source}
    </ReactMarkdown>
  );
}
