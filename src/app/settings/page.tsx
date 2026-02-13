'use client';
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { downloadExport, importData } from '@/infrastructure/export/data-io';
import { usePreferences, useSessions, useXP, useStreak, useDifficulty } from '@/hooks/useStorage';
import { getDefaultDifficulty } from '@/domain/difficulty/adaptive';
import { getDefaultXPState } from '@/domain/gamification/xp';
import { getDefaultStreak } from '@/domain/gamification/streaks';
import { lsSet } from '@/infrastructure/storage/local';
import { LS_KEYS } from '@/types/storage';
import { dbClear } from '@/infrastructure/db/client';
import { STORE_SESSIONS, STORE_DAILY_AGGREGATES, STORE_ACHIEVEMENTS } from '@/types/storage';
import { ENGINE_INFO } from '@/lib/constants';
import { IconExport, IconImport, IconTrash, IconRefresh, Icon } from '@/components/icons';
import { roundTo } from '@/lib/math';

export default function SettingsPage() {
    const { preferences, setPreferences } = usePreferences();
    const { sessions, reload } = useSessions();
    const { setXP } = useXP();
    const { setStreak } = useStreak();
    const { difficulty, setDifficulty } = useDifficulty();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [importStatus, setImportStatus] = useState<string>('');
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const handleExport = async () => {
        try { await downloadExport(); } catch { setImportStatus('Export failed.'); }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const text = await file.text();
        const result = await importData(text);
        if (result.success) {
            setImportStatus('Data imported successfully! Reload to see changes.');
            reload();
        } else {
            setImportStatus(`Import failed: ${result.error}`);
        }
    };

    const handleClearData = async () => {
        if (!confirm('Are you sure? This will delete ALL training data.')) return;
        await dbClear(STORE_SESSIONS);
        await dbClear(STORE_DAILY_AGGREGATES);
        await dbClear(STORE_ACHIEVEMENTS);
        setXP(getDefaultXPState());
        setStreak(getDefaultStreak());
        setDifficulty(getDefaultDifficulty());
        setImportStatus('All data cleared.');
        reload();
    };

    const handleResetDifficulty = () => {
        if (!confirm('Reset all engine difficulties to default (30)?')) return;
        setDifficulty(getDefaultDifficulty());
        setImportStatus('Difficulty reset to defaults.');
    };

    // Recent sessions for quick view
    const recentSessions = useMemo(() =>
        [...sessions].sort((a, b) => b.timestamp - a.timestamp).slice(0, 5),
        [sessions]
    );

    if (!mounted) return null;

    return (
        <div className="settings-page animate-fade-in">
            <header className="settings-header">
                <h1 className="page-title">Settings</h1>
                <p className="page-subtitle">Manage your preferences and data</p>
            </header>

            <div className="settings-grid">
                {/* Left Column */}
                <div className="settings-col">
                    <div className="card settings-card">
                        <div className="card-header">
                            <h2 className="card-title">Preferences</h2>
                        </div>
                        <div className="setting-row">
                            <div className="setting-info">
                                <span className="setting-label">Sound Effects</span>
                                <span className="setting-desc">Enable audio cues during training</span>
                            </div>
                            <button
                                className={`toggle ${preferences.soundEnabled ? 'toggle-on' : ''}`}
                                onClick={() => setPreferences({ ...preferences, soundEnabled: !preferences.soundEnabled })}
                                role="switch"
                                aria-checked={preferences.soundEnabled}
                            >
                                <span className="toggle-thumb" />
                            </button>
                        </div>
                        <div className="setting-row">
                            <div className="setting-info">
                                <span className="setting-label">Reduced Motion</span>
                                <span className="setting-desc">Minimize animations for accessibility</span>
                            </div>
                            <button
                                className={`toggle ${preferences.reducedMotion ? 'toggle-on' : ''}`}
                                onClick={() => setPreferences({ ...preferences, reducedMotion: !preferences.reducedMotion })}
                                role="switch"
                                aria-checked={preferences.reducedMotion}
                            >
                                <span className="toggle-thumb" />
                            </button>
                        </div>
                    </div>

                    <div className="card settings-card">
                        <div className="card-header">
                            <h2 className="card-title">About MindSenSei</h2>
                        </div>
                        <p className="about-text">
                            MindSenSei is a privacy-first cognitive performance platform. All data is stored locally on your device. No tracking, no accounts, no cloud. built for peak mental performance.
                        </p>
                        <div className="app-version">Version 1.0.0 (Beta)</div>
                    </div>
                </div>

                {/* Right Column */}
                <div className="settings-col">
                    {/* Current Difficulty */}
                    <div className="card settings-card">
                        <div className="card-header">
                            <h2 className="card-title">Adaptive Difficulty</h2>
                            <button className="btn btn-ghost btn-sm" onClick={handleResetDifficulty} title="Reset all to level 30">
                                <IconRefresh size={14} /> Reset
                            </button>
                        </div>
                        <div className="difficulty-grid">
                            {(['focus', 'memory', 'reaction', 'logic'] as const).map(e => (
                                <div key={e} className="diff-item">
                                    <div className="diff-icon" style={{ backgroundColor: `${ENGINE_INFO[e].color}20` }}>
                                        <Icon name={ENGINE_INFO[e].icon} size={18} color={ENGINE_INFO[e].color} />
                                    </div>
                                    <div className="diff-content">
                                        <span className="diff-label">{ENGINE_INFO[e].label}</span>
                                        <div className="diff-bar-bg">
                                            <div
                                                className="diff-bar-fill"
                                                style={{
                                                    width: `${Math.min(difficulty[e], 100)}%`,
                                                    backgroundColor: ENGINE_INFO[e].color
                                                }}
                                            />
                                        </div>
                                    </div>
                                    <span className="diff-value">{Math.round(difficulty[e])}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card settings-card">
                        <div className="card-header">
                            <h2 className="card-title">Data Management</h2>
                        </div>
                        <div className="data-actions">
                            <button className="btn btn-secondary btn-full" onClick={handleExport}>
                                <IconExport size={16} /> Export Data (JSON)
                            </button>
                            <div className="import-wrapper">
                                <button className="btn btn-secondary btn-full" onClick={() => fileInputRef.current?.click()}>
                                    <IconImport size={16} /> Import Data
                                </button>
                                <input type="file" ref={fileInputRef} accept=".json" onChange={handleImport} style={{ display: 'none' }} />
                            </div>
                            <button className="btn btn-ghost btn-full btn-danger" onClick={handleClearData}>
                                <IconTrash size={16} /> Clear All Data
                            </button>
                        </div>
                        {importStatus && <div className="import-status animate-fade-in">{importStatus}</div>}
                    </div>
                </div>
            </div>

            {/* Recent Sessions (Full Width) */}
            {recentSessions.length > 0 && (
                <div className="card settings-card full-width" style={{ marginTop: 'var(--sp-6)' }}>
                    <h2 className="card-title">Recent Session History</h2>
                    <div className="sessions-list">
                        {recentSessions.map(s => (
                            <div key={s.id} className="session-row">
                                <span className="session-engine" style={{ color: ENGINE_INFO[s.engineType].color }}>
                                    <Icon name={ENGINE_INFO[s.engineType].icon} size={14} color={ENGINE_INFO[s.engineType].color} />
                                    {ENGINE_INFO[s.engineType].label}
                                </span>
                                <span className="session-score">{roundTo(s.score, 0)}</span>
                                <span className="session-date">{new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
