import { createHighlighter, type Highlighter } from 'shiki';

const LANGS = ['python', 'bash', 'shell', 'console', 'toml', 'json', 'cpp', 'c', 'yaml', 'diff', 'text'];
let instance: Promise<Highlighter> | undefined;

const getHighlighter = () =>
  (instance ??= createHighlighter({ themes: ['github-dark-default', 'github-light-default'], langs: LANGS }));

export async function highlight(code: string, lang: string): Promise<string> {
  const h = await getHighlighter();
  const l = h.getLoadedLanguages().includes(lang) ? lang : 'text';
  return h.codeToHtml(code, { lang: l, themes: { dark: 'github-dark-default', light: 'github-light-default' }, defaultColor: false });
}
