'use client';
import { useEffect, useRef, useState } from 'react';
import { useAppState } from '@/hooks/useStorage';
import { downloadExport, parseBackup } from '@/infrastructure/export/data-io';
import { clearTrainingData, replaceData, resetDifficulty, updatePreferences } from '@/infrastructure/state/store';
import { ENGINE_INFO } from '@/lib/constants';
import { Icon } from '@/components/icons';
import type { ExportData } from '@/types/storage';
interface InstallEvent extends Event { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }>; }
export default function SettingsPage() {
    const { preferences, difficulty, sessions, loaded } = useAppState();
    const [status, setStatus] = useState('');
    const [failed, setFailed] = useState(false);
    const [busy, setBusy] = useState(false);
    const [pending, setPending] = useState<ExportData | null>(null);
    const [action, setAction] = useState<'clear' | 'import' | 'reset'>('clear');
    const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
    const [offlineReady, setOfflineReady] = useState(false);
    const [persistent, setPersistent] = useState(false);
    const input = useRef<HTMLInputElement>(null);
    const dialog = useRef<HTMLDialogElement>(null);
    useEffect(() => {
        const install = (event: Event) => { event.preventDefault(); setInstallEvent(event as InstallEvent); };
        window.addEventListener('beforeinstallprompt', install);
        if ('serviceWorker' in navigator) void navigator.serviceWorker.ready.then(() => setOfflineReady(true));
        void navigator.storage?.persisted?.().then(setPersistent).catch(() => {});
        return () => window.removeEventListener('beforeinstallprompt', install);
    }, []);
    async function perform(task: () => Promise<unknown>, success: string) {
        setBusy(true); setStatus(''); setFailed(false);
        try { await task(); setStatus(success); }
        catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : 'Could not finish. Please try again.'); }
        finally { setBusy(false); }
    }
    function confirmAction(value: typeof action) { setAction(value); dialog.current?.showModal(); }
    async function chooseBackup(event: React.ChangeEvent<HTMLInputElement>) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) return;
        setFailed(false); setStatus('');
        try {
            if (file.size > 25 * 1024 * 1024) throw new Error('Please choose a backup smaller than 25 MB.');
            const data = parseBackup(await file.text());
            setPending(data); confirmAction('import');
        } catch (error) { setFailed(true); setStatus(error instanceof Error ? error.message : 'This file is not a valid backup.'); }
    }
    function confirm() {
        dialog.current?.close();
        if (action === 'clear') void perform(clearTrainingData, 'Training data cleared. Your preferences have been kept.');
        else if (action === 'reset') void perform(resetDifficulty, 'All four difficulty levels are reset to 30.');
        else if (pending) void perform(() => replaceData(pending), `Imported ${pending.sessions.length} sessions. Your progress is ready.`);
    }
    if (!loaded) return <div className="page-loading" role="status">Loading settings…</div>;
    return <div className="settings-page animate-fade-in"><header className="overview-heading"><div><p className="eyebrow">MAKE IT YOURS</p><h1>Settings & your data.</h1><p>A practice that fits you. Data that belongs to you.</p></div></header>
        <div className="settings-grid"><div className="settings-col">
            <section className="card settings-card"><div className="card-header"><h2 className="card-title">Your training preferences</h2></div><div className="setting-row"><div className="setting-info"><span className="setting-label">Sound effects</span><span className="setting-desc">Gentle cues for feedback and completed sessions</span></div><button className={`toggle ${preferences.soundEnabled ? 'toggle-on' : ''}`} role="switch" aria-label="Sound effects" aria-checked={preferences.soundEnabled} disabled={busy} onClick={() => void perform(() => updatePreferences({ soundEnabled: !preferences.soundEnabled }), 'Sound preference saved.')}><span className="toggle-thumb" /></button></div><div className="setting-row"><div className="setting-info"><span className="setting-label">Reduced motion</span><span className="setting-desc">Minimize movement and transitions</span></div><button className={`toggle ${preferences.reducedMotion ? 'toggle-on' : ''}`} role="switch" aria-label="Reduced motion" aria-checked={preferences.reducedMotion} disabled={busy} onClick={() => void perform(() => updatePreferences({ reducedMotion: !preferences.reducedMotion }), 'Motion preference saved.')}><span className="toggle-thumb" /></button></div><div className="setting-row"><label className="setting-info" htmlFor="session-length"><span className="setting-label">Default session</span><span className="setting-desc">You can also change this before training</span></label><select id="session-length" value={preferences.sessionRounds ?? 8} disabled={busy} onChange={event => void perform(() => updatePreferences({ sessionRounds: Number(event.target.value) as 8 | 16 }), 'Session preference saved.')}><option value="8">Quick · 8 rounds</option><option value="16">Standard · 16 rounds</option></select></div></section>
            <section className="card settings-card"><div className="card-header"><h2 className="card-title">Take your practice anywhere</h2><Icon name="shield" size={18} /></div><p className="about-text">{offlineReady ? 'Offline training is ready. You can open every training mode without a connection.' : 'Offline training becomes available after the production app finishes preparing on your first connected visit.'}</p><div className={`offline-pill ${offlineReady ? 'ready' : ''}`}><span />{offlineReady ? 'Ready for offline practice' : 'Offline setup not active'}</div>{installEvent ? <button className="btn btn-secondary btn-full" onClick={() => void perform(async () => { await installEvent.prompt(); const result = await installEvent.userChoice; if (result.outcome === 'accepted') setInstallEvent(null); }, 'Install prompt closed.')}>Install Mind Sensei</button> : <p className="card-footnote">To install, choose “Install app” in your browser menu, or Share → Add to Home Screen on iPhone and iPad.</p>}<p className="card-footnote">{persistent ? 'Your browser has granted persistent storage.' : 'Keep a JSON backup before clearing browser data or moving devices.'}</p>{!persistent && <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void perform(async () => { const granted = await navigator.storage?.persist?.(); setPersistent(!!granted); if (!granted) throw new Error('Your browser has not granted persistent storage. JSON backups are still available.'); }, 'Persistent storage enabled.')}>Request persistent storage</button>}</section>
        </div><div className="settings-col">
            <section className="card settings-card"><div className="card-header"><h2 className="card-title">Your challenge level</h2><button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => confirmAction('reset')}><Icon name="refresh" size={14} />Reset</button></div><p className="card-footnote">Each skill adapts after a completed session. Higher scores increase the challenge; lower scores ease it.</p><div className="difficulty-grid">{(['focus','memory','reaction','logic'] as const).map(engine => <div className="diff-item" key={engine}><div className="diff-icon" style={{ background: `color-mix(in srgb, ${ENGINE_INFO[engine].color} 12%, transparent)` }}><Icon name={engine} size={20} color={ENGINE_INFO[engine].color} /></div><div className="diff-content"><span className="diff-label">{ENGINE_INFO[engine].label}</span><div className="diff-bar-bg"><div className="diff-bar-fill" style={{ width: `${difficulty[engine]}%`, background: ENGINE_INFO[engine].color }} /></div></div><strong>{Math.round(difficulty[engine])}</strong></div>)}</div></section>
            <section className="card settings-card"><div className="card-header"><h2 className="card-title">Your data, in your hands</h2><span className="badge badge-accent">{sessions.length} sessions</span></div><p className="about-text">Export everything as a JSON backup. Importing replaces the training history and preferences on this device after you review the backup.</p><div className="data-actions"><button className="btn btn-secondary btn-full" disabled={busy} onClick={() => void perform(downloadExport, 'Backup downloaded. Keep it somewhere safe.')}><Icon name="export" size={16} />Export backup</button><button className="btn btn-secondary btn-full" disabled={busy} onClick={() => input.current?.click()}><Icon name="import" size={16} />Import backup</button><input ref={input} type="file" accept=".json,application/json" aria-label="Import a Mind Sensei backup" hidden onChange={chooseBackup} /><button className="btn btn-ghost btn-full btn-danger" disabled={busy} onClick={() => confirmAction('clear')}><Icon name="trash" size={16} />Clear training data</button></div></section>
        </div></div>
        {status && <div className={`settings-status ${failed ? 'is-error' : ''}`} role={failed ? 'alert' : 'status'}><Icon name={failed ? 'x' : 'check'} size={18} />{status}</div>}
        <footer className="settings-footer"><Icon name="brain" size={20} /><span>Mind Sensei · v1.0</span><p>Training scores describe your performance in these games. All progress is stored on this device, with no account or analytics tracking.</p></footer>
        <dialog ref={dialog} className="confirm-dialog" aria-labelledby="confirm-title" aria-describedby="confirm-description"><h2 id="confirm-title">{action === 'import' ? 'Restore this backup?' : action === 'clear' ? 'Clear your training history?' : 'Reset difficulty?'}</h2><p id="confirm-description">{action === 'import' ? `This backup contains ${pending?.sessions.length ?? 0} sessions, exported ${pending ? new Date(pending.exportedAt).toLocaleDateString() : ''}. It will replace your current ${sessions.length} sessions and preferences. Export a backup first if you want to keep them.` : action === 'clear' ? `This removes ${sessions.length} sessions, XP, streaks, and achievements from this device. Export a backup first if you want to restore them later.` : 'All four training modes will return to difficulty 30. Your history, XP, and achievements will stay saved.'}</p><div className="dialog-actions"><button className="btn btn-secondary" onClick={() => dialog.current?.close()} autoFocus>Cancel</button><button className={`btn ${action === 'clear' ? 'btn-danger' : 'btn-primary'}`} onClick={confirm}>{action === 'import' ? 'Restore backup' : action === 'clear' ? 'Clear training data' : 'Reset difficulty'}</button></div></dialog>
    </div>;
}
