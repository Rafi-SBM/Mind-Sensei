'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSessions, useXP, useStreak, useDifficulty, useAchievements } from '@/hooks/useStorage';
import { createReactionState, generateReactionStimulus, markStimulusAppeared, processReactionInput, recordReactionTimeout, evaluateReactionSession, calculateReactionScore, type ReactionState } from '@/domain/engines/reaction';
import { adjustDifficulty } from '@/domain/difficulty/adaptive';
import { calculateSessionXP, applyXP } from '@/domain/gamification/xp';
import { updateStreak } from '@/domain/gamification/streaks';
import { checkNewAchievements } from '@/domain/gamification/achievements';
import { estimateFatigue } from '@/domain/analytics/metrics';
import { ENGINE_INFO } from '@/lib/constants';
import { uuid, roundTo } from '@/lib/math';
import { IconReaction, IconArrowLeft } from '@/components/icons';
import type { SessionRecord } from '@/types/engines';

type Phase = 'ready' | 'countdown' | 'waiting' | 'stimulus' | 'results';

export default function ReactionTrainPage() {
    const { sessions, addSession } = useSessions();
    const { xp, setXP } = useXP();
    const { streak, setStreak } = useStreak();
    const { difficulty, setDifficulty } = useDifficulty();
    const { achievements, addAchievements } = useAchievements();
    const [phase, setPhase] = useState<Phase>('ready');
    const [state, setState] = useState<ReactionState | null>(null);
    const [stimulusColor, setStimulusColor] = useState('');
    const [message, setMessage] = useState('');
    const [lastRT, setLastRT] = useState<number | null>(null);
    const [score, setScore] = useState(0);
    const [xpGained, setXpGained] = useState(0);
    const [countdown, setCountdown] = useState(3);
    const [metrics, setMetrics] = useState<ReturnType<typeof evaluateReactionSession> | null>(null);
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
                const s = createReactionState(difficulty.reaction);
                setState(s);
                runTrial(s);
            }
        };
        timerRef.current = setTimeout(tick, 800);
    }, [difficulty.reaction]);

    const runTrial = (s: ReactionState) => {
        if (s.currentRound >= s.totalRounds) { endSession(s); return; }
        const stimulus = generateReactionStimulus(s);
        const delay = stimulus.data.delay as number;
        const isGo = stimulus.data.isGoTrial as boolean;

        setPhase('waiting');
        setMessage('Wait for the signal...');
        setStimulusColor('');
        setLastRT(null);

        timerRef.current = setTimeout(() => {
            markStimulusAppeared(s);
            setState({ ...s });
            setPhase('stimulus');
            setStimulusColor(isGo ? 'var(--clr-success)' : 'var(--clr-error)');
            setMessage(isGo ? 'TAP NOW!' : 'DON\'T TAP!');

            timerRef.current = setTimeout(() => {
                recordReactionTimeout(s);
                setState({ ...s });
                if (isGo) { setMessage('Too slow!'); } else { setMessage('Correct - inhibited!'); }
                timerRef.current = setTimeout(() => runTrial(s), 1000);
            }, 2000);
        }, delay);
    };

    const handleTap = () => {
        if (!state) return;
        if (phase === 'waiting') {
            clearTimeout(timerRef.current);
            setMessage('Too early! Wait for the signal.');
            processReactionInput(state, { timestamp: Date.now(), type: 'tap' });
            setState({ ...state });
            timerRef.current = setTimeout(() => runTrial(state), 1200);
            return;
        }
        if (phase === 'stimulus') {
            clearTimeout(timerRef.current);
            const now = Date.now();
            const rt = now - state.stimulusAppearedAt;
            processReactionInput(state, { timestamp: now, type: 'tap' });
            setState({ ...state });
            if (state.isGoTrial) {
                setLastRT(rt);
                setMessage(`${rt}ms`);
            } else {
                setMessage('Should not have tapped!');
            }
            timerRef.current = setTimeout(() => runTrial(state), 1200);
        }
    };

    const endSession = async (s: ReactionState) => {
        setPhase('results');
        const m = evaluateReactionSession(s);
        setMetrics(m);
        const sc = roundTo(calculateReactionScore(m), 1);
        setScore(sc);

        const session: SessionRecord = {
            id: uuid(), engineType: 'reaction', timestamp: Date.now(),
            duration: Date.now() - s.startedAt, difficulty: s.difficulty, metrics: m, score: sc,
        };
        await addSession(session);

        const newStreak = updateStreak(streak);
        setStreak(newStreak);
        const earnedXP = calculateSessionXP(session, newStreak);
        setXpGained(earnedXP);
        setXP(applyXP(xp, earnedXP));

        const fatigue = estimateFatigue([...sessions, session]);
        const adj = adjustDifficulty(difficulty.reaction, sc / 100, fatigue.probability);
        setDifficulty({ ...difficulty, reaction: adj.newDifficulty });

        const newAch = checkNewAchievements([...sessions, session], newStreak, applyXP(xp, earnedXP), achievements);
        if (newAch.length > 0) await addAchievements(newAch);
    };

    useEffect(() => { return () => clearTimeout(timerRef.current); }, []);
    if (!mounted) return null;

    const progress = state ? (state.currentRound / state.totalRounds) * 100 : 0;

    return (
        <div className="training-page animate-fade-in">
            <div className="page-header">
                <Link href="/dashboard" className="btn btn-ghost btn-sm"><IconArrowLeft size={16} /> Back</Link>
                <h1 className="page-title" style={{ color: ENGINE_INFO.reaction.color }}><IconReaction size={22} color={ENGINE_INFO.reaction.color} /> Reaction Training</h1>
            </div>

            {phase === 'ready' && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-8)' }}>
                    <div style={{ marginBottom: 'var(--sp-4)' }}><IconReaction size={48} color={ENGINE_INFO.reaction.color} /></div>
                    <h2 style={{ marginBottom: 'var(--sp-3)' }}>Reaction Speed Test</h2>
                    <p style={{ color: 'var(--clr-text-secondary)', marginBottom: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>
                        Tap when you see <strong style={{ color: 'var(--clr-success)' }}>green</strong>.
                        Don&apos;t tap on <strong style={{ color: 'var(--clr-error)' }}>red</strong>.
                    </p>
                    <p style={{ color: 'var(--clr-text-tertiary)', marginBottom: 'var(--sp-8)', fontSize: 'var(--fs-xs)' }}>Difficulty: {Math.round(difficulty.reaction)}</p>
                    <button className="btn btn-primary btn-lg" onClick={startCountdown}>Begin Session</button>
                </div>
            )}

            {phase === 'countdown' && (
                <div className="card countdown-card">
                    <div className="countdown-num">{countdown}</div>
                    <p style={{ color: 'var(--clr-text-secondary)' }}>Get ready...</p>
                </div>
            )}

            {(phase === 'waiting' || phase === 'stimulus') && state && (
                <div className="game-area">
                    <div className="game-hud">
                        <span>Trial {state.currentRound}/{state.totalRounds}</span>
                        <span>{lastRT !== null ? `Last: ${lastRT}ms` : ''}</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 'var(--sp-4)' }}>
                        <div className="progress-fill" style={{ width: `${progress}%`, background: ENGINE_INFO.reaction.color, transition: 'width 0.3s ease' }} />
                    </div>
                    <button className="reaction-zone" onClick={handleTap} style={{ borderColor: stimulusColor || 'var(--clr-border)' }} aria-label="Reaction tap zone">
                        <div className="reaction-circle" style={{ background: stimulusColor || 'var(--clr-surface-200)' }} />
                        <p className="reaction-msg">{message}</p>
                    </button>
                </div>
            )}

            {phase === 'results' && (
                <div className="card animate-fade-in-up" style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-8)' }}>
                    <h2 style={{ marginBottom: 'var(--sp-2)' }}>Session Complete</h2>
                    <div className="result-score">{roundTo(score, 0)}</div>
                    <p style={{ color: 'var(--clr-text-tertiary)', fontSize: 'var(--fs-xs)', marginBottom: 'var(--sp-6)' }}>out of 100</p>
                    <p style={{ color: 'var(--clr-accent)', fontSize: 'var(--fs-sm)', marginBottom: 'var(--sp-6)' }}>+{xpGained} XP</p>

                    {metrics && (
                        <div className="score-breakdown">
                            <div className="breakdown-item"><span className="breakdown-label">Avg Latency</span><span className="breakdown-val">{roundTo(metrics.averageLatencyMs, 0)}ms</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Consistency</span><span className="breakdown-val">{roundTo(metrics.standardDeviationMs, 0)}ms σ</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">False Triggers</span><span className="breakdown-val">{roundTo(metrics.falseTriggerRate * 100, 0)}%</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Fatigue Drift</span><span className="breakdown-val">{roundTo(metrics.fatigueDrift * 100, 0)}%</span></div>
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
