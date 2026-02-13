'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSessions, useXP, useStreak, useDifficulty, useAchievements } from '@/hooks/useStorage';
import { createFocusState, generateFocusStimulus, processFocusInput, recordMissedTarget, evaluateFocusSession, calculateFocusScore, type FocusState, type FocusStimulusData } from '@/domain/engines/focus';
import { adjustDifficulty } from '@/domain/difficulty/adaptive';
import { calculateSessionXP, applyXP } from '@/domain/gamification/xp';
import { updateStreak } from '@/domain/gamification/streaks';
import { checkNewAchievements } from '@/domain/gamification/achievements';
import { estimateFatigue } from '@/domain/analytics/metrics';
import { ENGINE_INFO } from '@/lib/constants';
import { uuid, roundTo } from '@/lib/math';
import { IconFocus, IconArrowLeft } from '@/components/icons';
import type { SessionRecord } from '@/types/engines';
type Phase = 'ready' | 'countdown' | 'playing' | 'results';

export default function FocusTrainPage() {
    const { sessions, addSession } = useSessions();
    const { xp, setXP } = useXP();
    const { streak, setStreak } = useStreak();
    const { difficulty, setDifficulty } = useDifficulty();
    const { achievements, addAchievements } = useAchievements();
    const [phase, setPhase] = useState<Phase>('ready');
    const [state, setState] = useState<FocusState | null>(null);
    const [currentStimulus, setCurrentStimulus] = useState<FocusStimulusData | null>(null);
    const [score, setScore] = useState(0);
    const [xpGained, setXpGained] = useState(0);
    const [countdown, setCountdown] = useState(3);
    const [metrics, setMetrics] = useState<ReturnType<typeof evaluateFocusSession> | null>(null);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const startCountdown = useCallback(() => {
        setPhase('countdown');
        setCountdown(3);
        let count = 3;
        const tick = () => {
            count--;
            if (count > 0) {
                setCountdown(count);
                timerRef.current = setTimeout(tick, 800);
            } else {
                setCountdown(0);
                const s = createFocusState(difficulty.focus);
                setState(s);
                setPhase('playing');
                nextStimulus(s);
            }
        };
        timerRef.current = setTimeout(tick, 800);
    }, [difficulty.focus]);

    const nextStimulus = (s: FocusState) => {
        if (s.currentRound >= s.totalRounds) { endSession(s); return; }
        const stimulus = generateFocusStimulus(s);
        const data = s.stimuli[s.stimuli.length - 1];
        setCurrentStimulus(data);
        setState({ ...s });
        timerRef.current = setTimeout(() => {
            if (data.isTarget) { recordMissedTarget(s); }
            setCurrentStimulus(null);
            setTimeout(() => nextStimulus(s), 300);
        }, data.duration);
    };

    const handleClick = (stimulusId: string) => {
        if (!state) return;
        clearTimeout(timerRef.current);
        const updated = processFocusInput(state, { stimulusId, timestamp: Date.now() });
        setState({ ...updated });
        setCurrentStimulus(null);
        setTimeout(() => nextStimulus(updated), 400);
    };

    const endSession = async (s: FocusState) => {
        setPhase('results');
        const m = evaluateFocusSession(s);
        setMetrics(m);
        const sc = roundTo(calculateFocusScore(m), 1);
        setScore(sc);

        const session: SessionRecord = {
            id: uuid(), engineType: 'focus', timestamp: Date.now(),
            duration: Date.now() - s.startedAt, difficulty: s.difficulty,
            metrics: m, score: sc,
        };
        await addSession(session);

        const newStreak = updateStreak(streak);
        setStreak(newStreak);
        const earnedXP = calculateSessionXP(session, newStreak);
        setXpGained(earnedXP);
        setXP(applyXP(xp, earnedXP));

        const fatigue = estimateFatigue([...sessions, session]);
        const adj = adjustDifficulty(difficulty.focus, sc / 100, fatigue.probability);
        setDifficulty({ ...difficulty, focus: adj.newDifficulty });

        const allSessions = [...sessions, session];
        const newAchievements = checkNewAchievements(allSessions, newStreak, applyXP(xp, earnedXP), achievements);
        if (newAchievements.length > 0) await addAchievements(newAchievements);
    };

    useEffect(() => { return () => { clearTimeout(timerRef.current); }; }, []);
    if (!mounted) return null;

    const progress = state ? (state.currentRound / state.totalRounds) * 100 : 0;

    return (
        <div className="training-page animate-fade-in">
            <div className="page-header">
                <Link href="/dashboard" className="btn btn-ghost btn-sm"><IconArrowLeft size={16} /> Back</Link>
                <h1 className="page-title" style={{ color: ENGINE_INFO.focus.color }}><IconFocus size={22} color={ENGINE_INFO.focus.color} /> Focus Training</h1>
            </div>

            {phase === 'ready' && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-8)' }}>
                    <div style={{ marginBottom: 'var(--sp-4)' }}><IconFocus size={48} color={ENGINE_INFO.focus.color} /></div>
                    <h2 style={{ marginBottom: 'var(--sp-3)' }}>Sustained Attention Test</h2>
                    <p style={{ color: 'var(--clr-text-secondary)', marginBottom: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>Click the <strong>circles</strong> (targets). Ignore the <strong>squares</strong> (distractors).</p>
                    <p style={{ color: 'var(--clr-text-tertiary)', marginBottom: 'var(--sp-8)', fontSize: 'var(--fs-xs)' }}>Difficulty: {Math.round(difficulty.focus)}</p>
                    <button className="btn btn-primary btn-lg" onClick={startCountdown}>Begin Session</button>
                </div>
            )}

            {phase === 'countdown' && (
                <div className="card countdown-card">
                    <div className="countdown-num">{countdown}</div>
                    <p style={{ color: 'var(--clr-text-secondary)' }}>Get ready...</p>
                </div>
            )}

            {phase === 'playing' && state && (
                <div className="game-area">
                    <div className="game-hud">
                        <span>Round {state.currentRound}/{state.totalRounds}</span>
                        <span>Hits: {state.correctHits}</span>
                        <span>Errors: {state.distractorClicks}</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 'var(--sp-4)' }}>
                        <div className="progress-fill" style={{ width: `${progress}%`, background: ENGINE_INFO.focus.color, transition: 'width 0.3s ease' }} />
                    </div>
                    <div className="game-canvas" role="application" aria-label="Focus training area">
                        {currentStimulus && (
                            <button
                                className={`stimulus ${currentStimulus.isTarget ? 'stimulus-target' : 'stimulus-distractor'} animate-scale-in`}
                                style={{
                                    left: `${currentStimulus.position.x * 100}%`,
                                    top: `${currentStimulus.position.y * 100}%`,
                                    width: currentStimulus.size,
                                    height: currentStimulus.size,
                                }}
                                onClick={() => handleClick(currentStimulus.id)}
                                aria-label={currentStimulus.isTarget ? 'Target - click me' : 'Distractor - ignore'}
                            />
                        )}
                    </div>
                </div>
            )}

            {phase === 'results' && (
                <div className="card results-card animate-fade-in-up" style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-8)' }}>
                    <h2 style={{ marginBottom: 'var(--sp-2)' }}>Session Complete</h2>
                    <div className="result-score">{roundTo(score, 0)}</div>
                    <p style={{ color: 'var(--clr-text-tertiary)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-6)' }}>out of 100</p>
                    <p style={{ color: 'var(--clr-accent)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-6)' }}>+{xpGained} XP</p>

                    {metrics && (
                        <div className="score-breakdown">
                            <div className="breakdown-item"><span className="breakdown-label">Sustained Focus</span><span className="breakdown-val">{roundTo(metrics.sustainedAttentionMs / 1000, 1)}s</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Error Rate</span><span className="breakdown-val">{roundTo(metrics.distractionErrorRate * 100, 0)}%</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Recovery</span><span className="breakdown-val">{roundTo(metrics.focusRecoveryLatencyMs, 0)}ms</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Variance</span><span className="breakdown-val">{roundTo(metrics.performanceVariance, 0)}ms</span></div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 'var(--sp-4)', justifyContent: 'center', marginTop: 'var(--sp-8)' }}>
                        <button className="btn btn-primary" onClick={() => { setState(null); setMetrics(null); setPhase('ready'); }}>Train Again</button>
                        <Link href="/dashboard" className="btn btn-secondary">Dashboard</Link>
                    </div>
                </div>
            )}


        </div>
    );
}
