import test from 'node:test';
import assert from 'node:assert/strict';
import { createFocusState, generateFocusStimulus, processFocusInput, recordMissedTarget, evaluateFocusSession, calculateFocusScore } from '../src/domain/engines/focus';
import { createMemoryState, generateMemoryStimulus, processMemoryInput, completeMemoryRound, evaluateMemorySession, calculateMemoryScore } from '../src/domain/engines/memory';
import { createReactionState, generateReactionStimulus, markStimulusAppeared, processReactionInput, recordReactionTimeout, evaluateReactionSession, calculateReactionScore } from '../src/domain/engines/reaction';
import { createLogicState, generateLogicStimulus, processLogicInput, evaluateLogicSession, calculateLogicScore } from '../src/domain/engines/logic';
import { aggregateDaily, computeConsistency, computeRollingAverages } from '../src/domain/analytics/metrics';
import { adjustDifficulty } from '../src/domain/difficulty/adaptive';
import { getDefaultXPState, applyXP, xpForLevel } from '../src/domain/gamification/xp';
import { getDefaultStreak, updateStreak } from '../src/domain/gamification/streaks';
import { checkNewAchievements } from '../src/domain/gamification/achievements';
import { validateBackup } from '../src/infrastructure/export/validation';
import { toDateString, isYesterday } from '../src/lib/time';
import type { SessionRecord } from '../src/types/engines';
const sample = (engineType: SessionRecord['engineType'] = 'focus', timestamp = Date.now(), score = 80): SessionRecord => ({ id: `${engineType}-${timestamp}-${score}`, engineType, timestamp, duration: 30000, difficulty: 30, score, metrics: { sustainedAttentionMs: 20000, distractionErrorRate: 0, focusRecoveryLatencyMs: 0, performanceVariance: 30 } });
const backup = () => ({ version: 1, exportedAt: Date.now(), sessions: [sample()], achievements: [], dailyAggregates: [], xp: getDefaultXPState(), streak: getDefaultStreak(), difficulty: { focus: 30, memory: 30, reaction: 30, logic: 30 }, preferences: { theme: 'dark', soundEnabled: true, reducedMotion: false } });

test('inactivity cannot earn a performance score in any engine', () => {
    const focus = createFocusState(30, 42);
    for (let i = 0; i < 30; i++) { generateFocusStimulus(focus); if (focus.stimuli.at(-1)!.isTarget) recordMissedTarget(focus); }
    assert.equal(calculateFocusScore(evaluateFocusSession(focus)), 0);
    const memory = createMemoryState(30, 42);
    generateMemoryStimulus(memory); completeMemoryRound(memory);
    assert.equal(calculateMemoryScore(evaluateMemorySession(memory)), 0);
    const reaction = createReactionState(30, 42);
    for (let i = 0; i < 30; i++) { generateReactionStimulus(reaction); markStimulusAppeared(reaction); recordReactionTimeout(reaction); }
    assert.equal(calculateReactionScore(evaluateReactionSession(reaction)), 0);
    const logic = createLogicState(30, 42); generateLogicStimulus(logic); processLogicInput(logic, { selectedAnswer: -1, timestamp: Date.now() });
    assert.equal(calculateLogicScore(evaluateLogicSession(logic)), 0);
});
test('focus counts a target only once and rewards accurate practice', () => {
    const state = createFocusState(30, 4);
    for (let i = 0; i < 20; i++) { const stimulus = generateFocusStimulus(state); if (stimulus.type === 'target') { processFocusInput(state, { stimulusId: stimulus.id, timestamp: stimulus.timestamp + 100 }); processFocusInput(state, { stimulusId: stimulus.id, timestamp: stimulus.timestamp + 120 }); } }
    assert.equal(state.correctHits, state.targetsShown);
    assert.ok(calculateFocusScore(evaluateFocusSession(state)) >= 90);
    const before = state.attentionStreaks.length; evaluateFocusSession(state); evaluateFocusSession(state); assert.equal(state.attentionStreaks.length, before);
});
test('memory accepts recall only after presentation and advances only on exact recall', () => {
    const state = createMemoryState(50, 9);
    generateMemoryStimulus(state); processMemoryInput(state, { selectedIndex: 1, timestamp: Date.now() }); assert.equal(state.userRecall.length, 0);
    state.isShowingSequence = false; state.recallStartedAt = Date.now();
    state.currentSequence.forEach(n => processMemoryInput(state, { selectedIndex: n, timestamp: Date.now() }));
    const span = state.sequenceLength; const { result } = completeMemoryRound(state);
    assert.equal(result.isCorrect, true); assert.equal(state.maxSpanReached, span); assert.equal(state.sequenceLength, span + 1);
    generateMemoryStimulus(state); state.isShowingSequence = false;
    state.currentSequence.forEach((n, i) => processMemoryInput(state, { selectedIndex: i === 0 ? n % 9 + 1 : n, timestamp: Date.now() }));
    assert.equal(completeMemoryRound(state).result.isCorrect, false);
});
test('reaction false starts and timeouts are recorded exactly once', () => {
    const state = createReactionState(30, 42);
    generateReactionStimulus(state); state.isGoTrial = false;
    processReactionInput(state, { timestamp: Date.now(), type: 'tap' });
    recordReactionTimeout(state); processReactionInput(state, { timestamp: Date.now(), type: 'tap' });
    assert.equal(state.trials.length, 1); assert.equal(evaluateReactionSession(state).falseTriggerRate, 1);
    state.stimulusAppearedAt = 123; generateReactionStimulus(state); assert.equal(state.stimulusAppearedAt, 0);
});
test('logic puzzles are reproducible, have unique options, and unlock every pattern', () => {
    const a = createLogicState(100, 123); const b = createLogicState(100, 123);
    for (let i = 0; i < 100; i++) {
        generateLogicStimulus(a); generateLogicStimulus(b);
        assert.deepEqual(a.currentPuzzle!.sequence, b.currentPuzzle!.sequence);
        assert.deepEqual(a.currentPuzzle!.options, b.currentPuzzle!.options);
        assert.equal(new Set(a.currentPuzzle!.options).size, 4);
        assert.ok(a.currentPuzzle!.options.includes(a.currentPuzzle!.correctAnswer));
        if (i) assert.notEqual(a.usedPatternTypes[i], a.usedPatternTypes[i - 1]);
        processLogicInput(a, { selectedAnswer: a.currentPuzzle!.correctAnswer, timestamp: Date.now() });
    }
    assert.equal(new Set(a.usedPatternTypes).size, 8);
    assert.ok(calculateLogicScore(evaluateLogicSession(a)) >= 75);
});
test('daily summaries keep the full local date and separate skills on the same day', () => {
    const sessions = [sample('focus'), sample('memory')];
    const daily = aggregateDaily(sessions); assert.equal(daily.length, 2);
    assert.equal(daily[0].date, toDateString(sessions[0].timestamp)); assert.equal(daily[1].engineType, 'memory');
});
test('analytics do not reorder their input and old sessions leave the rolling window', () => {
    const sessions = [sample('focus', Date.now() - 86400000 * 10), sample('focus')];
    const ids = sessions.map(s => s.id); computeConsistency(sessions); assert.deepEqual(sessions.map(s => s.id), ids);
    assert.equal(computeRollingAverages(sessions).focus.sampleCount, 1);
});
test('adaptive difficulty respects bounds and dampens changes during fatigue', () => {
    assert.ok(adjustDifficulty(99, 1, 0).newDifficulty <= 100);
    assert.ok(adjustDifficulty(1, 0, 0).newDifficulty >= 1);
    assert.ok(Math.abs(adjustDifficulty(30, .4, .9).delta) < Math.abs(adjustDifficulty(30, .4, 0).delta));
});
test('XP crosses multiple levels without losing the remainder and achievements unlock once', () => {
    const earned = xpForLevel(2) + xpForLevel(3) + 12;
    const xp = applyXP(getDefaultXPState(), earned); assert.equal(xp.level, 3); assert.equal(xp.currentLevelXp, 12); assert.equal(xp.totalXp, earned);
    const streak = updateStreak(getDefaultStreak()); assert.equal(streak.currentStreak, 1); assert.deepEqual(updateStreak(streak), streak);
    const unlocked = checkNewAchievements([sample()], streak, xp, []); assert.ok(unlocked.some(a => a.id === 'first-session'));
    assert.equal(checkNewAchievements([sample()], streak, xp, unlocked).length, 0);
});
test('calendar dates handle month boundaries without daylight-saving assumptions', () => {
    assert.equal(isYesterday('2026-02-28', '2026-03-01'), true); assert.equal(isYesterday('2026-03-07', '2026-03-09'), false); assert.equal(isYesterday('', '2026-03-01'), false);
});
test('backup validation rejects malformed and duplicate records before any write', () => {
    assert.equal(validateBackup(backup()).sessions.length, 1);
    assert.throws(() => validateBackup({ ...backup(), version: 99 }));
    assert.throws(() => validateBackup({ ...backup(), sessions: [{ ...sample(), engineType: 'unknown' }] }));
    assert.throws(() => validateBackup({ ...backup(), sessions: [sample(), sample()] }));
    assert.throws(() => validateBackup({ ...backup(), sessions: [{ ...sample(), score: NaN }] }));
    assert.throws(() => validateBackup({ ...backup(), preferences: {} }));
    assert.throws(() => validateBackup({ ...backup(), achievements: [{ id: 'unknown', unlockedAt: Date.now() }] }));
});
