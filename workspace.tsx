'use client';
import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Layers,
  History,
  Settings,
  Users,
  ShieldCheck,
  LogOut,
  LifeBuoy,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { authClient } from '@/lib/auth-client';
import type { bootstrap } from '@/server/workspace-service';
import { Brand, Button, ErrorMessage } from './ui';
export type WorkspaceData = Awaited<ReturnType<typeof bootstrap>>;
export type ParticipantData = Extract<WorkspaceData, { records: unknown }>;
export type ClinicianData = Extract<WorkspaceData, { participants: unknown }>;
export type AdminData = Extract<WorkspaceData, { users: unknown }>;
const Context = createContext<{ data: WorkspaceData; refresh: () => Promise<void> } | null>(null);
export function useWorkspace() {
  const value = useContext(Context);
  if (!value) throw new Error('Workspace is not ready.');
  return value;
}
export function Workspace({ children }: { children: ReactNode }) {
  const [data, setData] = useState<WorkspaceData | null>(null),
    [error, setError] = useState(''),
    [offline, setOffline] = useState(false);
  const path = usePathname();
  const refresh = useCallback(async () => {
    try {
      setData(await api<WorkspaceData>('bootstrap'));
      setError('');
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const on = () => setOffline(false),
      off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, [refresh]);
  if (!data)
    return (
      <main className="standalone">
        <Brand />
        <h1>{error ? 'Workspace unavailable' : 'Opening your workspace…'}</h1>
        <ErrorMessage message={error} />
        {error && (
          <>
            <Link href="/signin" className="button">
              Sign in
            </Link>{' '}
            <Button secondary onClick={() => void refresh()}>
              Try again
            </Button>
          </>
        )}
      </main>
    );
  const role = data.actor.role;
  const restricted =
    (role !== 'participant' &&
      [
        '/workspace/consent',
        '/workspace/profile',
        '/workspace/library',
        '/workspace/history',
      ].includes(path)) ||
    (role !== 'clinician' &&
      (path.startsWith('/workspace/participant/') || path === '/workspace/participants')) ||
    (role !== 'admin' && path === '/workspace/admin') ||
    (role === 'admin' &&
      (path.startsWith('/workspace/assessment/') || path.startsWith('/workspace/report/')));
  const nav =
    role === 'participant'
      ? ([
          ['/workspace', 'Overview', LayoutDashboard],
          ['/workspace/library', 'Assessment library', Layers],
          ['/workspace/history', 'History & results', History],
          ['/workspace/account', 'Account & privacy', Settings],
        ] as const)
      : role === 'clinician'
        ? ([
            ['/workspace', 'Review workspace', LayoutDashboard],
            ['/workspace/participants', 'Assigned participants', Users],
            ['/workspace/account', 'Account & security', Settings],
          ] as const)
        : ([
            ['/workspace', 'Operations', LayoutDashboard],
            ['/workspace/admin', 'Manage service', ShieldCheck],
            ['/workspace/account', 'Account & security', Settings],
          ] as const);
  return (
    <Context.Provider value={{ data, refresh }}>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <div className="app-shell">
        <aside className="sidebar">
          <Brand />
          <div className="workspace-label">
            {role === 'clinician'
              ? 'REVIEW WORKSPACE'
              : role === 'admin'
                ? 'OPERATIONS'
                : 'YOUR WORKSPACE'}
          </div>
          <nav aria-label="Workspace navigation">
            {nav.map(([href, label, Icon]) => (
              <Link
                key={href}
                href={href}
                aria-current={path === href ? 'page' : undefined}
                className={path === href ? 'nav-link active' : 'nav-link'}
              >
                <Icon size={18} />
                {label}
                {path === href && <ArrowRight className="nav-arrow" size={15} />}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="privacy-note">
              <ShieldCheck size={22} />
              <p>
                Thoughtful by design.
                <br />
                <span>Your information, in context.</span>
              </p>
            </div>
            <Link href="/urgent-help" className="nav-link">
              <LifeBuoy size={18} />
              Get urgent help
            </Link>
            <button
              className="nav-link signout"
              onClick={async () => {
                await authClient.signOut();
                window.location.assign('/signin');
              }}
            >
              <LogOut size={18} />
              Sign out
            </button>
          </div>
        </aside>
        <div className="workspace-main">
          <header className="topbar">
            <span className="crumb">
              Workspace <span>/</span>{' '}
              {role === 'clinician'
                ? 'Professional review'
                : role === 'admin'
                  ? 'Service administration'
                  : 'Participant'}
            </span>
            <div className="identity">
              <span className="avatar">{data.actor.name[0]}</span>
              <span>{data.actor.name}</span>
            </div>
          </header>
          <div className="environment">
            <span>
              <span className="status-dot" />{' '}
              {data.demo ? 'SYNTHETIC DEMO' : 'DEMO INSTRUMENTS ONLY'}
            </span>
            <span>Not for clinical use · Submissions are not monitored</span>
          </div>
          {offline && (
            <div className="offline" role="alert">
              You are offline. Unsaved answers remain in this window. Reconnect before saving or
              closing.
            </div>
          )}
          <main id="main" className="workspace-content">
            <ErrorMessage message={error} />
            {restricted ? (
              <div className="card">
                <h1>Page unavailable for this role</h1>
                <Link href="/workspace" className="button">
                  Return to workspace
                </Link>
              </div>
            ) : data.mfaRequired && path !== '/workspace/account' ? (
              <div className="card">
                <h1>Secure your account</h1>
                <p>Set up two-factor authentication before accessing this workspace.</p>
                <Link href="/workspace/account" className="button">
                  Account security
                </Link>
              </div>
            ) : (
              children
            )}
          </main>
          <footer className="app-footer">
            <span>
              <CheckCircle2 size={14} /> Clear boundaries. Human review.
            </span>
            <Link href="/about">About & limitations</Link>
            <Link href="/privacy">Privacy</Link>
          </footer>
        </div>
      </div>
    </Context.Provider>
  );
}
