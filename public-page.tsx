import Link from 'next/link';
import { Brand } from './ui';
export function PublicPage({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <header className="public-header">
        <Brand />
        <nav>
          <Link href="/signin">Sign in</Link>
          <Link href="/urgent-help">Get urgent help</Link>
        </nav>
      </header>
      <main className="reading-page">
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        {children}
      </main>
      <footer className="public-footer">
        <Link href="/">Home</Link>
        <Link href="/about">Limitations</Link>
        <Link href="/privacy">Privacy</Link>
      </footer>
    </>
  );
}
