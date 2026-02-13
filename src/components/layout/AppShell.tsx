'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ENGINE_INFO } from '@/lib/constants';
import { Icon, IconBrain, IconMenu, IconClose } from '@/components/icons';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { href: '/train/focus', label: 'Focus', icon: ENGINE_INFO.focus.icon },
  { href: '/train/memory', label: 'Memory', icon: ENGINE_INFO.memory.icon },
  { href: '/train/reaction', label: 'Reaction', icon: ENGINE_INFO.reaction.icon },
  { href: '/train/logic', label: 'Logic', icon: ENGINE_INFO.logic.icon },
  { href: '/settings', label: 'Settings', icon: 'settings' },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const isLanding = pathname === '/';
  if (isLanding) return <>{children}</>;

  return (
    <div className="app-shell">
      <button
        className="mobile-menu-btn btn-icon btn-ghost"
        onClick={() => setSidebarOpen(!sidebarOpen)}
        aria-label="Toggle menu"
      >
        {sidebarOpen ? <IconClose size={22} /> : <IconMenu size={22} />}
      </button>

      <aside className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} role="navigation" aria-label="Main navigation">
        <div className="sidebar-header">
          <Link href="/" className="sidebar-logo">
            <span className="logo-icon"><IconBrain size={24} color="var(--clr-accent)" /></span>
            <span className="logo-text">MindSenSei</span>
          </Link>
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-item ${isActive ? 'nav-item-active' : ''}`}
                onClick={() => setSidebarOpen(false)}
              >
                <span className="nav-icon"><Icon name={item.icon} size={18} /></span>
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      {sidebarOpen && <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />}

      <main className="main-content">
        {children}
      </main>

    </div>
  );
}
