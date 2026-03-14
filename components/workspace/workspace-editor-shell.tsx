'use client';

import Link from 'next/link';
import { useState } from 'react';

export function WorkspaceEditorShell({
  backHref,
  backLabel,
  title,
  toolbar,
  actions,
  sidebar,
  children
}: {
  backHref: string;
  backLabel?: string;
  title?: string;
  toolbar?: React.ReactNode;
  actions?: React.ReactNode;
  sidebar?: React.ReactNode;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-white text-slate-900">
      {/* Top bar */}
      <header className="flex h-12 shrink-0 items-center border-b border-slate-200 bg-white px-4">
        {/* Left — back button & title */}
        <div className="flex shrink-0 items-center gap-3 overflow-hidden">
          <Link
            href={backHref}
            prefetch={false}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            <svg aria-hidden="true" viewBox="0 0 8 12" className="h-3 w-2 fill-current">
              <path d="M7.4 1.4 6 0 0 6l6 6 1.4-1.4L2.8 6z" />
            </svg>
            {backLabel || 'Back'}
          </Link>

          {title ? (
            <>
              <span className="shrink-0 text-slate-300">|</span>
              <span className="max-w-[180px] truncate text-sm font-medium text-slate-500">{title}</span>
            </>
          ) : null}
        </div>

        {/* Center — toolbar */}
        {toolbar ? (
          <div className="mx-3 flex min-w-0 flex-1 items-center justify-center overflow-x-auto">
            {toolbar}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        {/* Right — sidebar toggle & actions */}
        <div className="flex shrink-0 items-center gap-2">
          {sidebar !== undefined ? (
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              aria-label={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
              title={sidebarOpen ? 'Close sidebar' : 'Open sidebar'}
            >
              <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 fill-current">
                {sidebarOpen ? (
                  <path d="M2 2h12v1H2zm0 3h12v1H2zm0 3h7v1H2zm0 3h7v1H2zm9-5h4v1h-4zm0 3h4v1h-4zm-1-4v6h1V6z" />
                ) : (
                  <path d="M2 2h12v1H2zm0 3h12v1H2zm0 3h12v1H2zm0 3h12v1H2z" />
                )}
              </svg>
            </button>
          ) : null}

          {actions}
        </div>
      </header>

      {/* Editor + Sidebar */}
      <div className="relative min-h-0 flex-1">
        {/* Main editor area — always fills the full width so content stays centered */}
        <main className="h-full overflow-y-auto">
          {children}
        </main>

        {/* Right sidebar — slides out as a drawer over the content */}
        {sidebar !== undefined ? (
          <aside
            className={`absolute right-0 top-0 hidden h-full w-[360px] overflow-y-auto border-l border-slate-200 bg-slate-50 shadow-lg transition-transform duration-200 ease-in-out md:block lg:w-[400px] ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}`}
          >
            {sidebar}
          </aside>
        ) : null}
      </div>
    </div>
  );
}
