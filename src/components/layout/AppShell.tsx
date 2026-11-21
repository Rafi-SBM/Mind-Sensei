'use client';
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ENGINE_INFO } from '@/lib/constants';
import { Icon, IconBrain, IconMenu, IconClose } from '@/components/icons';
import { useXP } from '@/hooks/useStorage';
import { getRank } from '@/domain/gamification/ranks';

const NAV_ITEMS = [
    { href: '/dashboard', label: 'Overview', icon: 'dashboard' },
    { href: '/train', label: 'Training studio', icon: 'target' },
    ...(['focus', 'memory', 'reaction', 'logic'] as const).map(engine => ({ href: `/train/${engine}`, label: ENGINE_INFO[engine].label, icon: engine })),
    { href: '/settings', label: 'Settings & data', icon: 'settings' },
];
export default function AppShell({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const menuRef = useRef<HTMLButtonElement>(null);
    const sidebarRef = useRef<HTMLElement>(null);
    const { xp } = useXP();
    useEffect(() => {
        if (!sidebarOpen) return;
        const before = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        sidebarRef.current?.querySelector<HTMLElement>('a')?.focus();
        const key = (event: KeyboardEvent) => {
            if (event.key === 'Escape') { setSidebarOpen(false); menuRef.current?.focus(); }
            if (event.key === 'Tab') {
                const items = sidebarRef.current?.querySelectorAll<HTMLElement>('a, button');
                if (!items?.length) return;
                if (event.shiftKey && document.activeElement === items[0]) { event.preventDefault(); items[items.length - 1].focus(); }
                else if (!event.shiftKey && document.activeElement === items[items.length - 1]) { event.preventDefault(); items[0].focus(); }
            }
        };
        window.addEventListener('keydown', key);
        return () => { document.body.style.overflow = before; window.removeEventListener('keydown', key); };
    }, [sidebarOpen]);
    if (pathname === '/') return <main id="main-content">{children}</main>;
    return <div className="app-shell">
        <button ref={menuRef} className="mobile-menu-btn btn-icon btn-ghost" onClick={() => setSidebarOpen(!sidebarOpen)} aria-label="Open navigation" aria-expanded={sidebarOpen} aria-controls="app-sidebar"><IconMenu size={22} /></button>
        <aside ref={sidebarRef} id="app-sidebar" className={`sidebar ${sidebarOpen ? 'sidebar-open' : ''}`} aria-label="App navigation">
            <div className="sidebar-header"><Link href="/" className="sidebar-logo" onClick={() => setSidebarOpen(false)}><span className="logo-icon"><IconBrain size={26} color="var(--clr-accent)" /></span><span className="logo-text">Mind Sensei<span className="logo-caption">YOUR DAILY MENTAL PRACTICE</span></span></Link><button className="sidebar-close btn btn-ghost btn-sm" aria-label="Close navigation" onClick={() => { setSidebarOpen(false); menuRef.current?.focus(); }}><IconClose size={20} /></button></div>
            <nav className="sidebar-nav">{NAV_ITEMS.map(item => <Link key={item.href} href={item.href} className={`nav-item ${pathname === item.href ? 'nav-item-active' : ''} ${['focus','memory','reaction','logic'].includes(item.icon) ? 'nav-engine' : ''}`} onClick={() => setSidebarOpen(false)} aria-current={pathname === item.href ? 'page' : undefined}><span className="nav-icon"><Icon name={item.icon} size={18} /></span><span className="nav-label">{item.label}</span></Link>)}</nav>
            <div className="sidebar-bottom"><div className="sidebar-level"><span className="level-orb">{xp.level}</span><div><strong>{getRank(xp.level).displayName}</strong><span>{xp.totalXp.toLocaleString()} total XP</span></div></div><div className="progress-bar"><div className="progress-fill" style={{ width: `${xp.currentLevelXp / (xp.currentLevelXp + xp.xpToNextLevel) * 100}%` }} /></div><p><Icon name="shield" size={13} /> Your practice. Your device. Your data.</p></div>
        </aside>
        {sidebarOpen && <button className="sidebar-overlay" aria-label="Close navigation overlay" onClick={() => setSidebarOpen(false)} tabIndex={-1} />}
        <main className="main-content" id="main-content">{children}</main>
    </div>;
}
