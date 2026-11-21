'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/icons';
import { ENGINE_INFO, SESSION_TIMEOUT_MS } from '@/lib/constants';
import { roundTo, uuid } from '@/lib/math';
import { formatDuration } from '@/lib/time';
import { useAppState } from '@/hooks/useStorage';
import { useSessionTimers } from '@/hooks/useSessionTimers';
import { completeSession, type SessionReward } from '@/infrastructure/state/store';
import { playCue } from '@/lib/sound';
import { ACHIEVEMENTS } from '@/domain/gamification/achievements';
import { createFocusState, generateFocusStimulus, processFocusInput, recordMissedTarget, evaluateFocusSession, calculateFocusScore, type FocusState, type FocusStimulusData } from '@/domain/engines/focus';
import { createMemoryState, generateMemoryStimulus, processMemoryInput, completeMemoryRound, evaluateMemorySession, calculateMemoryScore, type MemoryState } from '@/domain/engines/memory';
import { createReactionState, generateReactionStimulus, markStimulusAppeared, processReactionInput, recordReactionTimeout, evaluateReactionSession, calculateReactionScore, type ReactionState } from '@/domain/engines/reaction';
import { createLogicState, generateLogicStimulus, processLogicInput, evaluateLogicSession, calculateLogicScore, type LogicState } from '@/domain/engines/logic';
import type { EngineType, SessionRecord, FocusMetrics, MemoryMetrics, ReactionMetrics, LogicMetrics } from '@/types/engines';

type GameState = FocusState | MemoryState | ReactionState | LogicState;
type Phase = 'ready' | 'countdown' | 'playing' | 'feedback' | 'results';
interface View {
    phase: Phase; game: GameState | null; countdown: number; paused: boolean;
    stimulus: FocusStimulusData | null; highlighted: number | null; recall: number[];
    message: string; correct: boolean | null; signal: 'waiting' | 'go' | 'no-go';
    session: SessionRecord | null; reward: SessionReward | null; saving: boolean; error: string;
    selectedRounds?: 8 | 16;
}
const initial: View = { phase: 'ready', game: null, countdown: 3, paused: false, stimulus: null, highlighted: null, recall: [], message: '', correct: null, signal: 'waiting', session: null, reward: null, saving: false, error: '' };
const DETAILS = {
    focus: { title: 'Find your focus.', task: 'Sustained attention', description: 'Tap the blue circles. Let the red squares pass. Stay attentive as targets move around the field.', keyboard: 'Press Space when a circle appears. Ignore squares.' },
    memory: { title: 'Make it stick.', task: 'Sequence recall', description: 'Watch the numbers appear one at a time, then enter them in the same order. A perfect recall adds one number to the next round.', keyboard: 'Use number keys 1–9 or the onscreen keypad.' },
    reaction: { title: 'Trust the signal.', task: 'Go / no-go', description: 'Wait for a signal. Tap when you see GO. If you see STOP, hold still until the next trial. Tapping early counts as an error.', keyboard: 'Press Space or tap the signal area.' },
    logic: { title: 'See the pattern.', task: 'Pattern completion', description: 'Find the rule connecting a number sequence, then choose the number that comes next. You have 30 seconds for each puzzle.', keyboard: 'Use keys 1–4 to choose the corresponding answer.' },
};

export default function TrainingSession({ engine }: { engine: EngineType }) {
    const app = useAppState();
    const [view, setView] = useState<View>(initial);
    const machine = useRef<View>(initial);
    const timers = useSessionTimers();
    const cancelRound = useRef<(() => void) | undefined>(undefined);
    const pausedAt = useRef(0);
    const closed = useRef(false);
    const info = ENGINE_INFO[engine];
    const details = DETAILS[engine];
    const rounds = view.selectedRounds ?? app.preferences.sessionRounds ?? 8;
    function update(patch: Partial<View>) { machine.current = { ...machine.current, ...patch }; setView(machine.current); }
    function after(callback: () => void, delay: number) { cancelRound.current = timers.schedule(callback, delay); }
    function feedback(message: string, correct: boolean, game: GameState) {
        update({ phase: 'feedback', message, correct, game, stimulus: null });
        playCue(correct ? 'correct' : 'wrong');
        after(() => nextRound(game), 1000);
    }
    async function save(session: SessionRecord) {
        update({ saving: true, error: '' });
        try { const reward = await completeSession(session); update({ reward, saving: false }); }
        catch { update({ saving: false, error: 'Your session has not been saved. Free up device storage and try again.' }); }
    }
    function finish(game: GameState) {
        if (closed.current) return;
        closed.current = true;
        timers.clear();
        let metrics: SessionRecord['metrics'];
        let score: number;
        if (engine === 'focus') { metrics = evaluateFocusSession(game as FocusState); score = calculateFocusScore(metrics); }
        else if (engine === 'memory') { metrics = evaluateMemorySession(game as MemoryState); score = calculateMemoryScore(metrics); }
        else if (engine === 'reaction') { metrics = evaluateReactionSession(game as ReactionState); score = calculateReactionScore(metrics); }
        else { metrics = evaluateLogicSession(game as LogicState); score = calculateLogicScore(metrics); }
        const session: SessionRecord = { id: uuid(), engineType: engine, timestamp: Date.now(), duration: Date.now() - game.startedAt, difficulty: game.difficulty, metrics, score: roundTo(score, 1) };
        update({ phase: 'results', paused: false, game, session, stimulus: null });
        playCue('complete');
        void save(session);
    }
    function nextRound(game: GameState) {
        if (closed.current) return;
        if (game.currentRound >= game.totalRounds || Date.now() - game.startedAt >= SESSION_TIMEOUT_MS) { finish(game); return; }
        update({ phase: 'playing', correct: null, message: '', game });
        if (engine === 'focus') {
            const state = game as FocusState;
            generateFocusStimulus(state);
            const stimulus = state.stimuli[state.stimuli.length - 1];
            update({ stimulus, game: state });
            after(() => {
                if (stimulus.isTarget) recordMissedTarget(state);
                feedback(stimulus.isTarget ? 'Missed target. Look for the circle.' : 'Good restraint.', !stimulus.isTarget, state);
            }, stimulus.duration);
        } else if (engine === 'memory') {
            const state = game as MemoryState;
            generateMemoryStimulus(state);
            update({ game: state, recall: [], highlighted: null, message: 'Watch the sequence' });
            let index = 0;
            const reveal = () => {
                if (index >= state.currentSequence.length) {
                    state.isShowingSequence = false;
                    state.recallStartedAt = Date.now();
                    update({ highlighted: null, game: state, message: 'Your turn. Recall the sequence.' });
                    after(() => { const result = completeMemoryRound(state); feedback(`Time’s up. Sequence: ${state.currentSequence.join(' · ')}`, result.result.isCorrect, state); }, 30000);
                    return;
                }
                update({ highlighted: state.currentSequence[index] });
                after(() => { update({ highlighted: null }); index++; after(reveal, 180); }, 650);
            };
            after(reveal, 500);
        } else if (engine === 'reaction') {
            const state = game as ReactionState;
            const stimulus = generateReactionStimulus(state);
            update({ game: state, signal: 'waiting', message: 'Wait for the signal…' });
            after(() => {
                markStimulusAppeared(state);
                update({ game: state, signal: state.isGoTrial ? 'go' : 'no-go', message: state.isGoTrial ? 'GO · TAP NOW' : 'STOP · DON’T TAP' });
                after(() => { recordReactionTimeout(state); feedback(state.isGoTrial ? 'Missed signal. Stay ready.' : 'Correct. You held back.', !state.isGoTrial, state); }, 1800);
            }, stimulus.data.delay as number);
        } else {
            const state = game as LogicState;
            generateLogicStimulus(state);
            update({ game: state });
            after(() => answerLogic(-1), 30000);
        }
    }
    function begin() {
        if (!app.loaded || app.error || machine.current.phase !== 'ready') return;
        timers.clear(); closed.current = false;
        update({ ...initial, selectedRounds: rounds, phase: 'countdown' });
        playCue('start');
        let count = 3;
        const tick = () => {
            count--;
            if (count > 0) { update({ countdown: count }); after(tick, 700); }
            else {
                const difficulty = app.difficulty[engine];
                const game = engine === 'focus' ? createFocusState(difficulty) : engine === 'memory' ? createMemoryState(difficulty) : engine === 'reaction' ? createReactionState(difficulty) : createLogicState(difficulty);
                game.totalRounds = rounds;
                timers.schedule(() => {
                    if (machine.current.phase === 'playing') {
                        if (engine === 'focus' && machine.current.stimulus?.isTarget) recordMissedTarget(game as FocusState);
                        else if (engine === 'memory') completeMemoryRound(game as MemoryState);
                        else if (engine === 'reaction') recordReactionTimeout(game as ReactionState);
                        else if (engine === 'logic') processLogicInput(game as LogicState, { selectedAnswer: -1, timestamp: Date.now() });
                    }
                    finish(game);
                }, SESSION_TIMEOUT_MS);
                nextRound(game);
            }
        };
        after(tick, 700);
    }
    function tapFocus() {
        const current = machine.current;
        if (current.phase !== 'playing' || current.paused || !current.stimulus) return;
        cancelRound.current?.();
        const state = current.game as FocusState;
        const stimulus = current.stimulus;
        processFocusInput(state, { stimulusId: stimulus.id, timestamp: Date.now() });
        feedback(stimulus.isTarget ? 'Target found.' : 'That was a distractor. Let squares pass.', stimulus.isTarget, state);
    }
    function recall(number: number) {
        const current = machine.current;
        if (current.phase !== 'playing' || current.paused) return;
        const state = current.game as MemoryState;
        if (state.isShowingSequence) return;
        processMemoryInput(state, { selectedIndex: number, timestamp: Date.now() });
        update({ recall: [...state.userRecall], game: state });
        if (state.userRecall.length === state.currentSequence.length) {
            cancelRound.current?.();
            const { result } = completeMemoryRound(state);
            feedback(result.isCorrect ? 'Perfect recall.' : `Sequence: ${state.currentSequence.join(' · ')}`, result.isCorrect, state);
        }
    }
    function tapReaction() {
        const current = machine.current;
        if (current.phase !== 'playing' || current.paused) return;
        cancelRound.current?.();
        const state = current.game as ReactionState;
        const latency = state.stimulusAppearedAt ? Date.now() - state.stimulusAppearedAt : null;
        processReactionInput(state, { timestamp: Date.now(), type: 'tap' });
        const trial = state.trials[state.trials.length - 1];
        feedback(trial.isFalseStart ? 'Too early. Wait for GO.' : trial.wasCorrect ? `${latency} ms. Nice response.` : 'STOP means hold still.', trial.wasCorrect, state);
    }
    function answerLogic(answer: number) {
        const current = machine.current;
        if (current.phase !== 'playing' || current.paused) return;
        const state = current.game as LogicState;
        if (!state.currentPuzzle) return;
        cancelRound.current?.();
        const puzzle = state.currentPuzzle;
        processLogicInput(state, { selectedAnswer: answer, timestamp: Date.now() });
        const pattern = puzzle.patternType.replaceAll('-', ' ');
        feedback(`${answer === puzzle.correctAnswer ? 'Correct.' : `Answer: ${puzzle.correctAnswer}.`} Pattern: ${pattern}.`, answer === puzzle.correctAnswer, state);
    }
    function pause() {
        if (machine.current.paused || !['playing', 'feedback', 'countdown'].includes(machine.current.phase)) return;
        pausedAt.current = Date.now(); timers.pause(); update({ paused: true });
    }
    function resume() {
        const delta = Date.now() - pausedAt.current;
        const game = machine.current.game;
        if (game) {
            game.startedAt += delta;
            if (engine === 'focus') {
                const s = game as FocusState;
                if (s.currentStreakStart) s.currentStreakStart += delta;
                const stimulus = s.stimuli[s.stimuli.length - 1];
                if (stimulus) stimulus.appearedAt += delta;
            } else if (engine === 'memory') { const s = game as MemoryState; s.sequenceShowTime += delta; if (s.recallStartedAt) s.recallStartedAt += delta; }
            else if (engine === 'reaction') { const s = game as ReactionState; s.trialStartedAt += delta; if (s.stimulusAppearedAt) s.stimulusAppearedAt += delta; }
            else (game as LogicState).puzzleShownAt += delta;
        }
        update({ paused: false }); timers.resume();
    }
    function discard() { timers.clear(); closed.current = true; update({ ...initial, selectedRounds: rounds }); }
    useEffect(() => {
        const handleVisibility = () => { if (document.hidden) pause(); };
        const beforeUnload = (event: BeforeUnloadEvent) => { if (['playing', 'feedback', 'countdown'].includes(machine.current.phase)) { event.preventDefault(); } };
        const keys = (event: KeyboardEvent) => {
            if (event.repeat || event.altKey || event.ctrlKey || event.metaKey || (event.target instanceof HTMLElement && (['A', 'SELECT', 'INPUT', 'TEXTAREA'].includes(event.target.tagName) || (event.target.tagName === 'BUTTON' && event.code === 'Space')))) return;
            if (machine.current.phase !== 'playing' || machine.current.paused) return;
            if (event.code === 'Space' && (engine === 'reaction' || engine === 'focus')) { event.preventDefault(); if (engine === 'reaction') tapReaction(); else tapFocus(); }
            if (engine === 'memory' && /^[1-9]$/.test(event.key)) recall(Number(event.key));
            if (engine === 'logic' && /^[1-4]$/.test(event.key)) { const puzzle = (machine.current.game as LogicState)?.currentPuzzle; if (puzzle) answerLogic(puzzle.options[Number(event.key) - 1]); }
        };
        document.addEventListener('visibilitychange', handleVisibility);
        window.addEventListener('beforeunload', beforeUnload);
        window.addEventListener('keydown', keys);
        return () => { document.removeEventListener('visibilitychange', handleVisibility); window.removeEventListener('beforeunload', beforeUnload); window.removeEventListener('keydown', keys); };
    });
    const active = ['countdown', 'playing', 'feedback'].includes(view.phase);
    const memory = view.game as MemoryState | null;
    const puzzle = (view.game as LogicState | null)?.currentPuzzle;
    const progress = view.game ? ((view.game.currentRound - (view.phase === 'playing' ? 1 : 0)) / view.game.totalRounds) * 100 : 0;
    return <div className="training-page animate-fade-in" style={{ '--engine-color': info.color } as React.CSSProperties}>
        <header className="training-header">
            <Link href="/train" className="btn btn-ghost btn-sm"><Icon name="arrowLeft" size={16} /> All training</Link>
            <span className="engine-tag"><Icon name={engine} size={16} /> {info.label}</span>
        </header>
        {view.phase === 'ready' && <section className="card training-intro">
            <div className="training-emblem"><Icon name={engine} size={40} /></div>
            <p className="eyebrow">{details.task}</p>
            <h1>{details.title}</h1>
            <p className="training-description">{details.description}</p>
            <div className="session-facts"><span>Difficulty <strong>{Math.round(app.difficulty[engine])} / 100</strong></span><span>Session <strong>{rounds} rounds · {rounds === 8 ? '1–2' : '2–5'} min</strong></span></div>
            <div className="segmented-control" aria-label="Session length">{([8, 16] as const).map(value => <button key={value} className={rounds === value ? 'selected' : ''} aria-pressed={rounds === value} onClick={() => update({ selectedRounds: value })}>{value === 8 ? 'Quick · 8 rounds' : 'Standard · 16 rounds'}</button>)}</div>
            <button className="btn btn-primary btn-lg" disabled={!app.loaded || !!app.error} onClick={begin}>{!app.loaded ? 'Loading progress…' : 'Begin Session'} <span aria-hidden="true">→</span></button>
            <p className="keyboard-hint">{details.keyboard}</p>
        </section>}
        {active && <section className="session-stage"><h1 className="sr-only">{info.label} training session</h1>
            <div className="game-hud"><span>{view.game ? `Round ${view.game.currentRound} of ${view.game.totalRounds}` : 'Get ready'}</span><span>Difficulty {Math.round(view.game?.difficulty ?? app.difficulty[engine])}</span><button className="btn btn-ghost btn-sm" onClick={pause}>Pause</button></div>
            <div className="progress-bar" role="progressbar" aria-label="Session progress" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}><div className="progress-fill" style={{ width: `${progress}%`, background: info.color }} /></div>
            {view.paused ? <div className="card paused-panel"><Icon name="shield" size={36} /><h1>Take a breath.</h1><p>Your session is paused. Resume when you’re ready.</p><button className="btn btn-primary" onClick={resume}>Resume session</button><button className="btn btn-ghost" onClick={discard}>Discard session</button></div> : <>
                {view.phase === 'countdown' && <div className="card countdown-card" aria-live="polite"><div className="countdown-num">{view.countdown}</div><p>Find a comfortable position. Let’s begin.</p></div>}
                {view.phase === 'feedback' && <div className={`card round-feedback ${view.correct ? 'is-correct' : 'is-incorrect'}`} role="status"><Icon name={view.correct ? 'check' : 'refresh'} size={40} /><h2>{view.message}</h2><p>Next round in a moment…</p></div>}
                {view.phase === 'playing' && engine === 'focus' && <div className="game-canvas" aria-label="Focus training area">{view.stimulus && <button className={`stimulus ${view.stimulus.isTarget ? 'stimulus-target' : 'stimulus-distractor'}`} style={{ left: `${view.stimulus.position.x * 100}%`, top: `${view.stimulus.position.y * 100}%`, width: view.stimulus.size, height: view.stimulus.size }} aria-label={view.stimulus.isTarget ? 'Circle target' : 'Square distractor'} onClick={tapFocus} />}</div>}
                {view.phase === 'playing' && engine === 'memory' && memory && <div className="card memory-stage">
                    <p className="eyebrow">{memory.isShowingSequence ? 'Watch and remember' : 'Recall in order'}</p>
                    {memory.isShowingSequence ? <><div className="memory-digit" aria-live="off">{view.highlighted ?? '·'}</div><p>{memory.currentSequence.length} numbers in this sequence</p></> : <><div className="recall-progress">{memory.currentSequence.map((_, i) => <div key={i} className={`recall-slot ${i < view.recall.length ? 'recall-filled' : ''}`}>{view.recall[i] ?? '·'}</div>)}</div><div className="number-pad">{Array.from({ length: 9 }, (_, i) => <button key={i} className="btn btn-secondary num-btn" onClick={() => recall(i + 1)}>{i + 1}</button>)}</div><p className="keyboard-hint">{view.recall.length} of {memory.currentSequence.length} entered · 30 seconds to recall</p></>}
                </div>}
                {view.phase === 'playing' && engine === 'reaction' && <button className={`reaction-zone signal-${view.signal}`} onClick={tapReaction} aria-label="Reaction tap zone"><div className="reaction-circle">{view.signal === 'go' ? 'GO' : view.signal === 'no-go' ? 'STOP' : '···'}</div><span className="reaction-msg">{view.message}</span><span className="keyboard-hint">Tap here or press Space</span></button>}
                {view.phase === 'playing' && engine === 'logic' && puzzle && <div className="card logic-stage"><p className="eyebrow">What comes next?</p><div className="sequence-row">{puzzle.sequence.map((n, i) => <span className="seq-num" key={i}>{n.toLocaleString()}</span>)}<span className="seq-num seq-mystery">?</span></div><div className="options-row">{puzzle.options.map((option, i) => <button key={option} className="btn btn-secondary option-btn" onClick={() => answerLogic(option)}><kbd>{i + 1}</kbd>{option.toLocaleString()}</button>)}</div><p className="keyboard-hint">Choose an answer · 30 seconds per puzzle</p></div>}
            </>}
            {!view.paused && <p className="session-footnote">{details.keyboard} · Switching tabs pauses your session.</p>}
        </section>}
        {view.phase === 'results' && view.session && <section className="card results-card animate-fade-in-up">
            <div className="training-emblem"><Icon name="trophy" size={36} /></div><p className="eyebrow">A little sharper, every session</p><h1>Session complete.</h1><div className="result-score">{Math.round(view.session.score)}<small>/100</small></div>
            <p className="reward-line" role="status">{view.saving ? 'Saving your progress…' : view.reward ? `+${view.reward.xp} XP · Progress saved on this device` : 'Progress not saved yet'}</p>
            <div className="score-breakdown"><div className="breakdown-item"><span>Duration</span><strong>{formatDuration(view.session.duration)}</strong></div><div className="breakdown-item"><span>Rounds</span><strong>{view.game?.currentRound}</strong></div><div className="breakdown-item"><span>Difficulty</span><strong>{Math.round(view.session.difficulty)}</strong></div><div className="breakdown-item"><span>Next difficulty</span><strong>{view.reward ? Math.round(view.reward.nextDifficulty) : '—'}</strong></div></div>
            <div className="performance-details">{performanceDetails(view.session).map(([label, value]) => <div key={label}><span>{label}</span><strong>{value}</strong></div>)}</div>
            {view.reward && <p className="adaptive-note">{view.reward.reason}</p>}
            {view.reward?.newAchievements.map(a => <p className="achievement-unlock" key={a.id}><Icon name="award" size={16} /> Unlocked: {ACHIEVEMENTS.find(def => def.id === a.id)?.name}</p>)}
            {view.error && <div className="inline-error" role="alert">{view.error}<button className="btn btn-secondary btn-sm" onClick={() => void save(view.session!)}>Retry saving</button></div>}
            <div className="result-actions"><button className="btn btn-primary" disabled={view.saving || !!view.error} onClick={discard}>Train Again</button><Link href="/dashboard" className={`btn btn-secondary ${view.saving || view.error ? 'disabled-link' : ''}`}>View dashboard</Link></div>
        </section>}
    </div>;
}

function performanceDetails(session: SessionRecord): [string, string][] {
    if (session.engineType === 'focus') {
        const metrics = session.metrics as FocusMetrics;
        return [['Targets found', `${Math.round((metrics.targetAccuracy ?? 0) * 100)}%`], ['Errors', `${Math.round(metrics.distractionErrorRate * 100)}%`], ['Sustained focus', formatDuration(metrics.sustainedAttentionMs)]];
    }
    if (session.engineType === 'memory') {
        const metrics = session.metrics as MemoryMetrics;
        return [['Recall accuracy', `${Math.round(metrics.recallAccuracy * 100)}%`], ['Longest recalled sequence', `${metrics.memorySpanTolerance} numbers`], ['Accuracy drop', `${Math.round(metrics.retentionDecay * 100)}%`]];
    }
    if (session.engineType === 'reaction') {
        const metrics = session.metrics as ReactionMetrics;
        return [['Average response', metrics.averageLatencyMs >= 1800 ? '—' : `${Math.round(metrics.averageLatencyMs)} ms`], ['Trial accuracy', `${Math.round((metrics.trialAccuracy ?? 1 - metrics.falseTriggerRate) * 100)}%`], ['False triggers', `${Math.round(metrics.falseTriggerRate * 100)}%`]];
    }
    const metrics = session.metrics as LogicMetrics;
    return [['Correct answers', `${Math.round(metrics.efficiencyRatio * 100)}%`], ['Average solve time', formatDuration(metrics.solveTimeMs)], ['Solving improvement', `${Math.round(metrics.patternImprovementCurve * 100)}%`]];
}
