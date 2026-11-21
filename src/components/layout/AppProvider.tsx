'use client';
import { useEffect, useState } from 'react';
import { initializeStore, loadState } from '@/infrastructure/state/store';
import { useAppState } from '@/hooks/useStorage';

export default function AppProvider({ children }: { children: React.ReactNode }) {
    const { preferences, error } = useAppState();
    const [offline, setOffline] = useState(false);
    useEffect(() => {
        void initializeStore();
        const online = () => setOffline(!navigator.onLine);
        online();
        const refresh = () => { if (document.visibilityState === 'visible') void loadState(); };
        window.addEventListener('online', online);
        window.addEventListener('offline', online);
        document.addEventListener('visibilitychange', refresh);
        if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
            navigator.serviceWorker.register('/sw.js').catch(() => { /* Settings reports availability. */ });
        }
        return () => { window.removeEventListener('online', online); window.removeEventListener('offline', online); document.removeEventListener('visibilitychange', refresh); };
    }, []);
    useEffect(() => {
        document.documentElement.dataset.reducedMotion = String(preferences.reducedMotion);
    }, [preferences.reducedMotion]);
    return <>
        <a className="skip-link" href="#main-content">Skip to content</a>
        {offline && <div className="connection-status" role="status">You’re offline. Training and saved progress are available on this device.</div>}
        {error && <div className="storage-error" role="alert">Progress storage is unavailable: {error} <button className="btn btn-secondary btn-sm" onClick={() => void loadState()}>Try again</button></div>}
        {children}
    </>;
}
