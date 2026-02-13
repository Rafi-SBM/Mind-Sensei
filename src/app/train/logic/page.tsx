'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSessions, useXP, useStreak, useDifficulty, useAchievements } from '@/hooks/useStorage';
import { createLogicState, generateLogicStimulus, processLogicInput, evaluateLogicSession, calculateLogicScore, type LogicState } from '@/domain/engines/logic';
import { adjustDifficulty } from '@/domain/difficulty/adaptive';
import { calculateSessionXP, applyXP } from '@/domain/gamification/xp';
import { updateStreak } from '@/domain/gamification/streaks';
import { checkNewAchievements } from '@/domain/gamification/achievements';
import { estimateFatigue } from '@/domain/analytics/metrics';
import { ENGINE_INFO } from '@/lib/constants';
import { uuid, roundTo } from '@/lib/math';
import { IconLogic, IconArrowLeft } from '@/components/icons';
import type { SessionRecord } from '@/types/engines';
import type { LogicMetrics } from '@/types/engines';

type Phase = 'ready' | 'countdown' | 'playing' | 'feedback' | 'results';

export default function LogicTrainPage() {
    const { sessions, addSession } = useSessions();
    const { xp, setXP } = useXP();
    const { streak, setStreak } = useStreak();
    const { difficulty, setDifficulty } = useDifficulty();
    const { achievements, addAchievements } = useAchievements();
    const [phase, setPhase] = useState<Phase>('ready');
    const [state, setState] = useState<LogicState | null>(null);
    const [sequence, setSequence] = useState<number[]>([]);
    const [options, setOptions] = useState<number[]>([]);
    const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
    const [patternHint, setPatternHint] = useState('');
    const [score, setScore] = useState(0);
    const [xpGained, setXpGained] = useState(0);
    const [countdown, setCountdown] = useState(3);
    const [metrics, setMetrics] = useState<LogicMetrics | null>(null);
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    const timerRef = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

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
                const s = createLogicState(difficulty.logic);
                setState(s);
                showNextPuzzle(s);
            }
        };
        timerRef.current = setTimeout(tick, 800);
    }, [difficulty.logic]);

    const showNextPuzzle = (s: LogicState) => {
        if (s.currentRound >= s.totalRounds) { endSession(s); return; }
        const stimulus = generateLogicStimulus(s);
        setSequence(stimulus.data.sequence as number[]);
        setOptions(stimulus.data.options as number[]);
        setPatternHint('');
        setLastCorrect(null);
        setPhase('playing');
        setState({ ...s });
    };

    const PATTERN_LABELS: Record<string, string> = {
        arithmetic: 'Arithmetic',
        geometric: 'Geometric',
        'fibonacci-like': 'Fibonacci',
        alternating: 'Alternating',
        mixed: 'Mixed',
        square: 'Perfect Squares',
        prime: 'Prime Numbers',
        power: 'Powers',
    };

    const handleAnswer = (answer: number) => {
        if (!state || phase !== 'playing') return;
        const isCorrect = answer === state.currentPuzzle?.correctAnswer;
        const pType = state.currentPuzzle?.patternType ?? '';
        const updated = processLogicInput(state, { selectedAnswer: answer, timestamp: Date.now() });
        setState({ ...updated });
        setLastCorrect(isCorrect);
        setPatternHint(PATTERN_LABELS[pType] || pType);
        setPhase('feedback');
        setTimeout(() => showNextPuzzle(updated), 1200);
    };

    const endSession = async (s: LogicState) => {
        setPhase('results');
        const m = evaluateLogicSession(s);
        setMetrics(m);
        const sc = roundTo(calculateLogicScore(m), 1);
        setScore(sc);

        const session: SessionRecord = {
            id: uuid(), engineType: 'logic', timestamp: Date.now(),
            duration: Date.now() - s.startedAt, difficulty: s.difficulty, metrics: m, score: sc,
        };
        await addSession(session);

        const newStreak = updateStreak(streak);
        setStreak(newStreak);
        const earnedXP = calculateSessionXP(session, newStreak);
        setXpGained(earnedXP);
        setXP(applyXP(xp, earnedXP));

        const fatigue = estimateFatigue([...sessions, session]);
        const adj = adjustDifficulty(difficulty.logic, sc / 100, fatigue.probability);
        setDifficulty({ ...difficulty, logic: adj.newDifficulty });

        const newAch = checkNewAchievements([...sessions, session], newStreak, applyXP(xp, earnedXP), achievements);
        if (newAch.length > 0) await addAchievements(newAch);
    };

    useEffect(() => { return () => clearTimeout(timerRef.current); }, []);
    if (!mounted) return null;

    const progress = state ? (state.currentRound / state.totalRounds) * 100 : 0;
    // Count unique pattern types encountered
    const patternsEncountered = state ? new Set(state.usedPatternTypes).size : 0;

    return (
        <div className="training-page animate-fade-in">
            <div className="page-header">
                <Link href="/dashboard" className="btn btn-ghost btn-sm"><IconArrowLeft size={16} /> Back</Link>
                <h1 className="page-title" style={{ color: ENGINE_INFO.logic.color }}><IconLogic size={22} color={ENGINE_INFO.logic.color} /> Logic Training</h1>
            </div>

            {phase === 'ready' && (
                <div className="card" style={{ textAlign: 'center', padding: 'var(--sp-12) var(--sp-8)' }}>
                    <div style={{ marginBottom: 'var(--sp-4)' }}><IconLogic size={48} color={ENGINE_INFO.logic.color} /></div>
                    <h2 style={{ marginBottom: 'var(--sp-3)' }}>Pattern Completion</h2>
                    <p style={{ color: 'var(--clr-text-secondary)', marginBottom: 'var(--sp-2)', fontSize: 'var(--fs-sm)' }}>Identify the pattern in the sequence and choose the next number.</p>
                    <p style={{ color: 'var(--clr-text-tertiary)', marginBottom: 'var(--sp-8)', fontSize: 'var(--fs-xs)' }}>Difficulty: {Math.round(difficulty.logic)}</p>
                    <button className="btn btn-primary btn-lg" onClick={startCountdown}>Begin Session</button>
                </div>
            )}

            {phase === 'countdown' && (
                <div className="card countdown-card">
                    <div className="countdown-num">{countdown}</div>
                    <p style={{ color: 'var(--clr-text-secondary)' }}>Get ready...</p>
                </div>
            )}

            {(phase === 'playing' || phase === 'feedback') && state && (
                <div className="game-area">
                    <div className="game-hud">
                        <span>Puzzle {state.currentRound}/{state.totalRounds}</span>
                        <span>{state.roundResults.filter(r => r.isCorrect).length} correct</span>
                    </div>
                    <div className="progress-bar" style={{ marginBottom: 'var(--sp-4)' }}>
                        <div className="progress-fill" style={{ width: `${progress}%`, background: ENGINE_INFO.logic.color, transition: 'width 0.3s ease' }} />
                    </div>
                    <div className="card" style={{ padding: 'var(--sp-8)', textAlign: 'center' }}>
                        <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--clr-text-tertiary)', marginBottom: 'var(--sp-4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>What comes next?</p>
                        <div className="sequence-row">
                            {sequence.map((n, i) => (
                                <span key={i} className="seq-num">{n}</span>
                            ))}
                            <span className="seq-num seq-mystery">?</span>
                        </div>

                        {phase === 'playing' && (
                            <div className="options-row">
                                {options.map((opt, i) => (
                                    <button key={i} className="btn btn-secondary option-btn" onClick={() => handleAnswer(opt)}>{opt}</button>
                                ))}
                            </div>
                        )}

                        {phase === 'feedback' && (
                            <div style={{ marginTop: 'var(--sp-6)' }}>
                                <p style={{ fontWeight: 600, color: lastCorrect ? 'var(--clr-success)' : 'var(--clr-error)', marginBottom: 'var(--sp-2)' }}>
                                    {lastCorrect ? 'Correct!' : `Answer: ${state.roundResults[state.roundResults.length - 1]?.correctAnswer}`}
                                </p>
                                {patternHint && (
                                    <p style={{ fontSize: 'var(--fs-xs)', color: 'var(--clr-text-tertiary)' }}>Pattern: {patternHint}</p>
                                )}
                            </div>
                        )}
                    </div>
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
                            <div className="breakdown-item"><span className="breakdown-label">Accuracy</span><span className="breakdown-val">{roundTo(metrics.efficiencyRatio * 100, 0)}%</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Avg Solve</span><span className="breakdown-val">{roundTo(metrics.solveTimeMs / 1000, 1)}s</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Patterns</span><span className="breakdown-val">{patternsEncountered} types</span></div>
                            <div className="breakdown-item"><span className="breakdown-label">Improvement</span><span className="breakdown-val">{roundTo(metrics.patternImprovementCurve * 100, 0)}%</span></div>
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
