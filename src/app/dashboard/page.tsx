'use client';
import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useSessions, useXP, useStreak, useDifficulty, useAchievements } from '@/hooks/useStorage';
import { ENGINE_INFO } from '@/lib/constants';
import { computeRollingAverages, computeGrowthVelocity, estimateFatigue, computeCGI, computeConsistency } from '@/domain/analytics/metrics';
import { computeSkillImbalance, suggestTraining } from '@/domain/analytics/suggestions';
import { getRank, getRankProgress } from '@/domain/gamification/ranks';
import { getStreakMessage } from '@/domain/gamification/streaks';
import { ACHIEVEMENTS } from '@/domain/gamification/achievements';
import { roundTo } from '@/lib/math';
import { Icon, IconBrain } from '@/components/icons';
import type { EngineType } from '@/types/engines';

export default function DashboardPage() {
    const { sessions, loading } = useSessions();
    const { xp } = useXP();
    const { streak } = useStreak();
    const { achievements } = useAchievements();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const analytics = useMemo(() => {
        if (!mounted || sessions.length === 0) return null;
        const averages = computeRollingAverages(sessions);
        const velocity = computeGrowthVelocity(sessions);
        const fatigue = estimateFatigue(sessions);
        const cgi = computeCGI(averages);
        const consistency = computeConsistency(sessions);
        const imbalance = computeSkillImbalance(averages);
        const suggestion = suggestTraining(sessions, imbalance);
        return { averages, velocity, fatigue, cgi, consistency, imbalance, suggestion };
    }, [sessions, mounted]);

    const rank = getRank(xp.level);
    const rankProgress = getRankProgress(xp.level);
    const engines: EngineType[] = ['focus', 'memory', 'reaction', 'logic'];

    // Personal bests per engine
    const personalBests = useMemo(() => {
        const bests: Record<EngineType, number> = { focus: 0, memory: 0, reaction: 0, logic: 0 };
        for (const s of sessions) {
            if (s.score > bests[s.engineType]) bests[s.engineType] = s.score;
        }
        return bests;
    }, [sessions]);

    // Today's sessions count
    const todaySessions = useMemo(() => {
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        return sessions.filter(s => s.timestamp >= todayStart.getTime()).length;
    }, [sessions]);

    if (!mounted || loading) {
        return <div className="page-loading"><div className="skeleton" style={{ height: 200, borderRadius: 'var(--radius-lg)' }} /></div>;
    }

    const isEmpty = sessions.length === 0;
    const recentSessions = [...sessions].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

    return (
        <div className="dashboard animate-fade-in">
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
                <p className="page-subtitle">{getStreakMessage(streak)}</p>
            </div>

            {isEmpty ? (
                <div className="empty-state card" style={{ textAlign: 'center', padding: 'var(--sp-16) var(--sp-8)' }}>
                    <div style={{ marginBottom: 'var(--sp-4)' }}><IconBrain size={48} color="var(--clr-accent)" /></div>
                    <h2 style={{ fontSize: 'var(--fs-xl)', marginBottom: 'var(--sp-3)' }}>Welcome to MindSenSei</h2>
                    <p style={{ color: 'var(--clr-text-secondary)', marginBottom: 'var(--sp-8)' }}>Complete your first training session to see your cognitive performance data.</p>
                    <Link href="/train/focus" className="btn btn-primary btn-lg">Start Training</Link>
                </div>
            ) : (
                <div className="dashboard-grid">
                    {/* CGI Card */}
                    <div className="card cgi-card">
                        <div className="card-header"><span className="card-title">Cognitive Growth Index</span></div>
                        <div className="cgi-value">{analytics ? roundTo(analytics.cgi.overall, 1) : '-'}</div>
                        <div className="cgi-label">out of 100</div>
                        {analytics && (
                            <div className="cgi-breakdown">
                                {engines.map(e => (
                                    <div key={e} className="cgi-item">
                                        <span className="cgi-engine" style={{ color: ENGINE_INFO[e].color }}>
                                            <Icon name={ENGINE_INFO[e].icon} size={14} color={ENGINE_INFO[e].color} /> {ENGINE_INFO[e].label}
                                        </span>
                                        <span className="cgi-score">{roundTo(analytics.cgi.components[e], 1)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Stats Row */}
                    <div className="card stat-card">
                        <div className="stat"><span className="stat-value">{xp.level}</span><span className="stat-label">Level</span></div>
                        <div className="stat"><span className="stat-value">{rank.displayName}</span><span className="stat-label">Rank</span></div>
                        <div className="stat"><span className="stat-value">{streak.currentStreak}</span><span className="stat-label">Day Streak</span></div>
                        <div className="stat"><span className="stat-value">{sessions.length}</span><span className="stat-label">Sessions</span></div>
                    </div>

                    {/* Today's Goal */}
                    <div className="card today-card">
                        <div className="card-header">
                            <span className="card-title"><Icon name="target" size={16} color="var(--clr-accent)" /> Today&apos;s Goal</span>
                            <span className={`badge ${todaySessions >= 3 ? 'badge-success' : 'badge-accent'}`}>
                                {todaySessions}/3
                            </span>
                        </div>
                        <div className="progress-bar" style={{ marginTop: 'var(--sp-3)' }}>
                            <div className="progress-fill" style={{ width: `${Math.min(todaySessions / 3, 1) * 100}%`, background: todaySessions >= 3 ? 'var(--clr-success)' : 'var(--grad-accent)' }} />
                        </div>
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--clr-text-tertiary)', marginTop: 'var(--sp-2)' }}>
                            {todaySessions >= 3 ? 'Goal reached! Keep going for extra XP.' : `${3 - todaySessions} more session${3 - todaySessions !== 1 ? 's' : ''} to hit today's goal.`}
                        </p>
                    </div>

                    {/* XP Progress */}
                    <div className="card">
                        <div className="card-header"><span className="card-title">XP Progress</span><span className="badge badge-accent">Lv.{xp.level}</span></div>
                        <div className="progress-bar" style={{ marginTop: 'var(--sp-3)' }}>
                            <div className="progress-fill" style={{ width: `${(xp.currentLevelXp / (xp.currentLevelXp + xp.xpToNextLevel)) * 100}%`, background: 'var(--grad-accent)' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 'var(--sp-2)', fontSize: 'var(--fs-xs)', color: 'var(--clr-text-tertiary)' }}>
                            <span>{xp.currentLevelXp} XP</span>
                            <span>{xp.xpToNextLevel} to next level</span>
                        </div>
                    </div>

                    {/* Skill Performance */}
                    <div className="card">
                        <div className="card-header"><span className="card-title">Skill Performance (7-day)</span></div>
                        <div className="skill-bars">
                            {engines.map(e => {
                                const avg = analytics?.averages[e].value ?? 0;
                                return (
                                    <div key={e} className="skill-row">
                                        <span className="skill-name" style={{ color: ENGINE_INFO[e].color }}>
                                            <Icon name={ENGINE_INFO[e].icon} size={14} color={ENGINE_INFO[e].color} /> {ENGINE_INFO[e].label}
                                        </span>
                                        <div className="progress-bar" style={{ flex: 1 }}>
                                            <div className="progress-fill" style={{ width: `${avg}%`, background: ENGINE_INFO[e].color }} />
                                        </div>
                                        <span className="skill-value">{roundTo(avg, 0)}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Personal Bests */}
                    <div className="card">
                        <div className="card-header">
                            <span className="card-title"><Icon name="trophy" size={16} color="var(--clr-warning)" /> Personal Bests</span>
                        </div>
                        <div className="bests-grid">
                            {engines.map(e => (
                                <div key={e} className="best-item">
                                    <Icon name={ENGINE_INFO[e].icon} size={18} color={ENGINE_INFO[e].color} />
                                    <span className="best-score">{personalBests[e] > 0 ? roundTo(personalBests[e], 0) : '-'}</span>
                                    <span className="best-label">{ENGINE_INFO[e].label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Suggestion */}
                    {analytics?.suggestion && (
                        <div className="card suggestion-card">
                            <div className="card-header"><span className="card-title">Suggested Training</span><span className={`badge badge-${analytics.suggestion.priority === 'high' ? 'warning' : 'accent'}`}>{analytics.suggestion.priority}</span></div>
                            <p style={{ color: 'var(--clr-text-secondary)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-4)' }}>{analytics.suggestion.reason}</p>
                            <Link href={`/train/${analytics.suggestion.engineType}`} className="btn btn-primary">Train {ENGINE_INFO[analytics.suggestion.engineType].label}</Link>
                        </div>
                    )}

                    {/* Achievements (Full Width) */}
                    <div className="card achievements-card">
                        <div className="card-header"><span className="card-title">Achievements</span><span className="badge badge-accent">{achievements.length}/{ACHIEVEMENTS.length}</span></div>
                        <div className="achievements-grid">
                            {ACHIEVEMENTS.slice(0, 8).map(def => {
                                const unlocked = achievements.find(a => a.id === def.id);
                                return (
                                    <div key={def.id} className={`achievement-item ${unlocked ? 'unlocked' : 'locked'}`} title={`${def.name}: ${def.description}`}>
                                        <span className="achievement-icon"><Icon name={def.icon} size={20} /></span>
                                        <span className="achievement-name">{def.name}</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Session History (Full Width) */}
                    <div className="card history-card">
                        <div className="card-header">
                            <span className="card-title"><Icon name="clock" size={16} color="var(--clr-accent)" /> Recent Sessions</span>
                        </div>
                        {recentSessions.length > 0 ? (
                            <div className="history-table">
                                <div className="history-header">
                                    <span>Engine</span><span>Score</span><span>Difficulty</span><span>Date</span>
                                </div>
                                {recentSessions.map(s => (
                                    <div key={s.id} className="history-row">
                                        <span className="history-engine" style={{ color: ENGINE_INFO[s.engineType].color }}>
                                            <Icon name={ENGINE_INFO[s.engineType].icon} size={14} color={ENGINE_INFO[s.engineType].color} />
                                            {ENGINE_INFO[s.engineType].label}
                                        </span>
                                        <span className="history-score">{roundTo(s.score, 0)}</span>
                                        <span>{Math.round(s.difficulty)}</span>
                                        <span className="history-date">{new Date(s.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p style={{ color: 'var(--clr-text-tertiary)', fontSize: 'var(--fs-sm)', marginTop: 'var(--sp-3)' }}>No sessions yet.</p>
                        )}
                    </div>

                    {/* Consistency & Fatigue */}
                    <div className="card">
                        <div className="card-header"><span className="card-title">Session Insights</span></div>
                        <div className="insights-grid">
                            <div className="stat">
                                <span className="stat-value">{analytics ? `${roundTo(analytics.consistency.value * 100, 0)}%` : '-'}</span>
                                <span className="stat-label">Consistency</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">{analytics ? `${roundTo(analytics.fatigue.probability * 100, 0)}%` : '-'}</span>
                                <span className="stat-label">Fatigue Level</span>
                            </div>
                            <div className="stat">
                                <span className="stat-value">{analytics?.fatigue.sessionsToday ?? 0}</span>
                                <span className="stat-label">Sessions Today</span>
                            </div>
                        </div>
                    </div>

                    {/* Activity Heatmap (New Fill Card) */}
                    <div className="card">
                        <div className="card-header"><span className="card-title">Activity Map (30 Days)</span></div>
                        <div className="heatmap-grid" style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(7, 1fr)',
                            gap: 'var(--sp-2)',
                            marginTop: 'var(--sp-2)'
                        }}>
                            {Array.from({ length: 28 }).map((_, i) => {
                                const date = new Date();
                                date.setDate(date.getDate() - (27 - i));
                                const dateStr = date.toDateString();
                                const count = sessions.filter(s => new Date(s.timestamp).toDateString() === dateStr).length;
                                const intensity = count === 0 ? 'var(--clr-surface-200)' :
                                    count < 3 ? 'var(--clr-accent-muted)' : 'var(--clr-accent)';

                                return (
                                    <div key={i} title={`${dateStr}: ${count} sessions`} style={{
                                        aspectRatio: '1',
                                        background: intensity,
                                        borderRadius: 'var(--radius-sm)',
                                        opacity: count === 0 ? 0.3 : 1
                                    }} />
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}


        </div>
    );
}
