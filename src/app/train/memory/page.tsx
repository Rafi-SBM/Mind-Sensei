'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSessions, useXP, useStreak, useDifficulty, useAchievements } from '@/hooks/useStorage';
import { createMemoryState, generateMemoryStimulus, processMemoryInput, completeMemoryRound, evaluateMemorySession, calculateMemoryScore, type MemoryState } from '@/domain/engines/memory';
import { adjustDifficulty } from '@/domain/difficulty/adaptive';
import { calculateSessionXP, applyXP } from '@/domain/gamification/xp';
import { updateStreak } from '@/domain/gamification/streaks';
import { checkNewAchievements } from '@/domain/gamification/achievements';
import { estimateFatigue } from '@/domain/analytics/metrics';
import { ENGINE_INFO } from '@/lib/constants';
import { uuid, roundTo } from '@/lib/math';
import { IconMemory, IconArrowLeft } from '@/components/icons';
import type { SessionRecord } from '@/types/engines';

type Phase = 'ready' | 'countdown' | 'showing' | 'recalling' | 'feedback' | 'results';

export default function MemoryTrainPage() {
    const { sessions, addSession } = useSessions();
    const { xp, setXP } = useXP();
    const { streak, setStreak } = useStreak();
    const { difficulty, setDifficulty } = useDifficulty();
    const { achievements, addAchievements } = useAchievements();
    const [phase, setPhase] = useState<Phase>('ready');
    const [state, setState] = useState<MemoryState | null>(null);
    const [displaySequence, setDisplaySequence] = useState<number[]>([]);
    const [highlightIdx, setHighlightIdx] = useState(-1);
    const [userInput, setUserInput] = useState<number[]>([]);
    const [roundCorrect, setRoundCorrect] = useState<boolean | null>(null);
    const [score, setScore] = useState(0);
    const [xpGained, setXpGained] = useState(0);
    const [countdown, setCountdown] = useState(3);
    const [metrics, setMetrics] = useState<ReturnType<typeof evaluateMemorySession> | null>(null);
    const [mounted, setMounted] = useState(false);
    const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
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
                const s = createMemoryState(difficulty.memory);
                setState(s);
                showNextRound(s);
            }
        };
        timerRef.current = setTimeout(tick, 800);
    }, [difficulty.memory]);

    const showNextRound = (s: MemoryState) => {
        if (s.currentRound >= s.totalRounds) { endSession(s); return; }
        const stimulus = generateMemoryStimulus(s);
        const seq = stimulus.data.sequence as number[];
        setDisplaySequence(seq);
        setUserInput([]);
        setRoundCorrect(null);
        setPhase('showing');
        setState({ ...s });

        let i = 0;
        const showNext = () => {
            if (i < seq.length) {
                setHighlightIdx(i);
                timerRef.current = setTimeout(() => {
                    setHighlightIdx(-1);
                    timerRef.current = setTimeout(() => { i++; showNext(); }, 200);
                }, 600);
            } else {
                setHighlightIdx(-1);
                setPhase('recalling');
            }
        };
        timerRef.current = setTimeout(showNext, 500);
    };

    const handleNumberClick = (num: number) => {
        if (phase !== 'recalling' || !state) return;
        const newInput = [...userInput, num];
        setUserInput(newInput);
        processMemoryInput(state, { selectedIndex: num, timestamp: Date.now() });

        if (newInput.length >= displaySequence.length) {
            const { state: updated, result } = completeMemoryRound(state);
            setRoundCorrect(result.isCorrect);
            setState({ ...updated });
            setPhase('feedback');
            timerRef.current = setTimeout(() => showNextRound(updated), 1200);
        }
    };

    const endSession = async (s: MemoryState) => {
        setPhase('results');
        const m = evaluateMemorySession(s);
        setMetrics(m);
        const sc = roundTo(calculateMemoryScore(m), 1);
        setScore(sc);

        const session: SessionRecord = {
            id: uuid(), engineType: 'memory', timestamp: Date.now(),
            duration: Date.now() - s.startedAt, difficulty: s.difficulty, metrics: m, score: sc,
        };
        await addSession(session);

        const newStreak = updateStreak(streak);
        setStreak(newStreak);
        const earnedXP = calculateSessionXP(session, newStreak);
        setXpGained(earnedXP);
        setXP(applyXP(xp, earnedXP));

        const fatigue = estimateFatigue([...sessions, session]);
        const adj = adjustDifficulty(difficulty.memory, sc / 100, fatigue.probability);
        setDifficulty({ ...difficulty, memory: adj.newDifficulty });

        const newAch = checkNewAchievements([...sessions, session], newStreak, applyXP(xp, earnedXP), achievements);
        if (newAch.length > 0) await addAchievements(newAch);
    };

    useEffect(() => { return () => clearTimeout(timerRef.current); }, []);
    if (!mounted) return null;

    const numberPad = [1, 2, 3, 4, 5, 6, 7, 8, 9];
    const progress = state ? (state.currentRound / state.totalRounds) * 100 : 0;

    return (
        <div className="training-page animate-fade-in">
            <div className="page-header">
                <Link href="/dashboard" className="btn btn-ghost btn-sm"><IconArrowLeft size={16} /> Back</Link>
                <h1 className="page-title" style={{ color: ENGINE_INFO.memory.color }}><IconMemory size={22} color={ENGINE_INFO.memory.color} /> Memory Training</h1>
            </div>

            {phase === 'ready' && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-8)' }}>
                    <div style={{ marginBottom: 'var(--sp-4)' }}><IconMemory size={48} color={ENGINE_INFO.memory.color} /></div>
                    <h2 style={{ marginBottom: 'var(--sp-3)' }}>Sequence Recall</h2>
                    <p style={{ color: 'var(--clr-text-secondary)', marginBottom: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>Watch the number sequence, then recall it in order.</p>
                    <p style={{ color: 'var(--clr-text-tertiary)', marginBottom: 'var(--sp-8)', fontSize: 'var(--fs-xs)' }}>Difficulty: {Math.round(difficulty.memory)}</p>
                    <button className="btn btn-primary btn-lg" onClick={startCountdown}>Begin Session</button>
                </div>
            )}

            {phase === 'countdown' && (
                <div className="card countdown-card">
                    <div className="countdown-num">{countdown}</div>
                    <p style={{ color: 'var(--clr-text-secondary)' }}>Get ready...</p>
                </div>
            )}

            {(phase === 'showing' || phase === 'recalling' || phase === 'feedback') && state && (
                <div className="game-area">
                    <div className="game-hud">
                        <span>Round {state.currentRound}/{state.totalRounds}</span>
                        <span>Span: {state.sequenceLength}</span>
                        <span>{phase === 'showing' ? 'Watch...' : phase === 'recalling' ? 'Recall!' : roundCorrect ? 'Correct' : 'Wrong'}</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 'var(--sp-4)' }}>
                        <div className="progress-fill" style={{ width: `${progress}%`, background: ENGINE_INFO.memory.color, transition: 'width 0.3s ease' }} />
                    </div>

                    {phase === 'showing' && (
                        <div className="sequence-display">
                            {displaySequence.map((num, i) => (
                                <div key={i} className={`seq-item ${highlightIdx === i ? 'seq-active' : ''}`}>{highlightIdx === i ? num : '\u2022'}</div>
                            ))}
                        </div>
                    )}

                    {phase === 'recalling' && (
                        <>
                            <div className="recall-progress">
                                {displaySequence.map((_, i) => (
                                    <div key={i} className={`recall-slot ${i < userInput.length ? 'recall-filled' : ''}`}>
                                        {userInput[i] ?? ''}
                                    </div>
                                ))}
                            </div>
                            <div className="number-pad">
                                {numberPad.map(n => (
                                    <button key={n} className="btn btn-secondary num-btn" onClick={() => handleNumberClick(n)}>{n}</button>
                                ))}
                            </div>
                        </>
                    )}

                    {phase === 'feedback' && (
                        <div className="feedback-display" style={{ textAlign: 'center', padding: 'var(--sp-8)' }}>
                            <p style={{ fontSize: 'var(--fs-2xl)', fontWeight: 600, color: roundCorrect ? 'var(--clr-success)' : 'var(--clr-error)' }}>
                                {roundCorrect ? 'Correct!' : 'Incorrect'}
                            </p>
                        </div>
                    )}
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
                            <div className="breakdown-item"><span className="breakdown-label">Accuracy</span><span className="breakdown-val">{roundTo(metrics.recallAccuracy * 100, 0)}%</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Max Span</span><span className="breakdown-val">{metrics.memorySpanTolerance}</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Retention</span><span className="breakdown-val">{roundTo((1 - metrics.retentionDecay) * 100, 0)}%</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Adaptation</span><span className="breakdown-val">{roundTo(metrics.complexityAdaptationSlope * 100, 0)}%</span></div>
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

