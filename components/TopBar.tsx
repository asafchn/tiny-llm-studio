import Link from 'next/link';
import { ThemeToggle } from './ThemeToggle.tsx';

export function TopBar({ crumbs }: { crumbs?: { label: string; href?: string }[] }) {
  return (
    <header className="topbar">
      <a href="#main" className="skip">Skip to content</a>
      <Link href="/" className="brand">
        <svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><path d="M14 17.5h7M17.5 14v7" />
        </svg>
        tiny-llm studio
      </Link>
      {crumbs && (
        <nav aria-label="Breadcrumb" className="crumbs">
          {crumbs.map((c, i) => (
            <span key={i} style={{ display: 'contents' }}>
              {i > 0 && <span aria-hidden="true">/</span>}
              {c.href ? <Link href={c.href} style={{ color: 'var(--muted)', textDecoration: 'none' }}>{c.label}</Link> : <span>{c.label}</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="spacer" />
      <ThemeToggle />
    </header>
  );
}
