/* ==========================================================================
   Focus Engine — Pure Domain Logic
   
   Game: Sustained attention tracking.
   Targets appear at intervals. User must click targets (circles)
   and ignore distractors (squares). Tracks attention duration,
   distraction errors, recovery latency, and performance variance.
   ========================================================================== */

import type { FocusMetrics, Stimulus } from '@/types/engines';
import { seededRandom, clamp, mean, standardDeviation, uuid } from '@/lib/math';

export interface FocusState {
    difficulty: number;
    seed: number;
    random: () => number;
    currentRound: number;
    totalRounds: number;
    startedAt: number;

    // Per-round tracking
    stimuli: FocusStimulusData[];
    responses: FocusResponse[];

    // Timing
    lastTargetAppeared: number;
    lastCorrectResponse: number;
    attentionStreaks: number[];  // consecutive correct durations
    currentStreakStart: number;

    // Counters
    targetsShown: number;
    distractorsShown: number;
    correctHits: number;
    distractorClicks: number;  // errors
    missedTargets: number;
}

export interface FocusStimulusData {
    id: string;
    isTarget: boolean;
    position: { x: number; y: number };
    size: number;
    appearedAt: number;
    duration: number;          // how long it stays visible
}

export interface FocusResponse {
    stimulusId: string;
    isCorrect: boolean;
    responseTime: number;
    timestamp: number;
}

export interface FocusInput {
    stimulusId: string;
    timestamp: number;
}

/** Create initial state for a focus session */
export function createFocusState(difficulty: number, seed?: number): FocusState {
    const s = seed ?? Date.now();
    const scaledRounds = Math.floor(15 + difficulty * 0.15);  // 15-30 rounds

    return {
        difficulty,
        seed: s,
        random: seededRandom(s),
        currentRound: 0,
        totalRounds: scaledRounds,
        startedAt: Date.now(),
        stimuli: [],
        responses: [],
        lastTargetAppeared: 0,
        lastCorrectResponse: 0,
        attentionStreaks: [],
        currentStreakStart: Date.now(),
        targetsShown: 0,
        distractorsShown: 0,
        correctHits: 0,
        distractorClicks: 0,
        missedTargets: 0,
    };
}

/** Generate the next stimulus */
export function generateFocusStimulus(state: FocusState): Stimulus {
    const r = state.random();

    // Target probability decreases with difficulty
    const targetProbability = clamp(0.7 - state.difficulty * 0.003, 0.35, 0.7);
    const isTarget = r < targetProbability;

    // Position in normalized coordinates [0-1]
    const x = state.random() * 0.8 + 0.1;  // 10%-90% range
    const y = state.random() * 0.8 + 0.1;

    // Size decreases with difficulty
    const baseSize = 60 - state.difficulty * 0.3;  // 60px down to ~30px
    const size = clamp(baseSize + state.random() * 10 - 5, 24, 70);

    // Display duration decreases with difficulty
    const baseDuration = 3000 - state.difficulty * 20;  // 3s down to ~1s
    const duration = clamp(baseDuration, 800, 3000);

    const stimulus: FocusStimulusData = {
        id: uuid(),
        isTarget,
        position: { x, y },
        size,
        appearedAt: Date.now(),
        duration,
    };

    state.stimuli.push(stimulus);
    if (isTarget) {
        state.targetsShown++;
        state.lastTargetAppeared = Date.now();
    } else {
        state.distractorsShown++;
    }
    state.currentRound++;

    return {
        id: stimulus.id,
        type: isTarget ? 'target' : 'distractor',
        data: {
            position: stimulus.position,
            size: stimulus.size,
            duration: stimulus.duration,
            isTarget,
        },
        timestamp: Date.now(),
    };
}

/** Process a user click response */
export function processFocusInput(state: FocusState, input: FocusInput): FocusState {
    const stimulus = state.stimuli.find(s => s.id === input.stimulusId);
    if (!stimulus) return state;

    const responseTime = input.timestamp - stimulus.appearedAt;
    const isCorrect = stimulus.isTarget;

    const response: FocusResponse = {
        stimulusId: input.stimulusId,
        isCorrect,
        responseTime,
        timestamp: input.timestamp,
    };

    state.responses.push(response);

    if (isCorrect) {
        state.correctHits++;
        state.lastCorrectResponse = input.timestamp;
    } else {
        // Clicked a distractor — error
        state.distractorClicks++;
        // End current attention streak
        if (state.currentStreakStart > 0) {
            const streakDuration = input.timestamp - state.currentStreakStart;
            state.attentionStreaks.push(streakDuration);
            state.currentStreakStart = input.timestamp;
        }
    }

    return state;
}

/** Record a missed target (wasn't clicked in time) */
export function recordMissedTarget(state: FocusState): FocusState {
    state.missedTargets++;
    // End current attention streak
    if (state.currentStreakStart > 0) {
        const streakDuration = Date.now() - state.currentStreakStart;
        state.attentionStreaks.push(streakDuration);
        state.currentStreakStart = Date.now();
    }
    return state;
}

/** Evaluate session metrics */
export function evaluateFocusSession(state: FocusState): FocusMetrics {
    // Finalize last streak
    if (state.currentStreakStart > 0) {
        state.attentionStreaks.push(Date.now() - state.currentStreakStart);
    }

    // Sustained attention = average streak duration
    const sustainedAttentionMs = state.attentionStreaks.length > 0
        ? mean(state.attentionStreaks)
        : Date.now() - state.startedAt;

    // Distraction error rate
    const totalInteractions = state.correctHits + state.distractorClicks;
    const distractionErrorRate = totalInteractions > 0
        ? state.distractorClicks / totalInteractions
        : 0;

    // Focus recovery latency: time between error and next correct response
    const recoveryTimes: number[] = [];
    for (let i = 0; i < state.responses.length - 1; i++) {
        if (!state.responses[i].isCorrect && state.responses[i + 1]?.isCorrect) {
            recoveryTimes.push(state.responses[i + 1].timestamp - state.responses[i].timestamp);
        }
    }
    const focusRecoveryLatencyMs = recoveryTimes.length > 0 ? mean(recoveryTimes) : 0;

    // Performance variance = stddev of response times for correct hits
    const correctResponseTimes = state.responses
        .filter(r => r.isCorrect)
        .map(r => r.responseTime);
    const performanceVariance = standardDeviation(correctResponseTimes);

    return {
        sustainedAttentionMs,
        distractionErrorRate,
        focusRecoveryLatencyMs,
        performanceVariance,
    };
}

/** Calculate normalized score (0-100) */
export function calculateFocusScore(metrics: FocusMetrics): number {
    // Higher sustained attention = better (normalized to 5min max)
    const attentionScore = clamp(metrics.sustainedAttentionMs / 300000 * 100, 0, 100);
    // Lower error rate = better
    const errorScore = (1 - metrics.distractionErrorRate) * 100;
    // Lower recovery = better (normalized to 5s max)
    const recoveryScore = metrics.focusRecoveryLatencyMs > 0
        ? clamp((1 - metrics.focusRecoveryLatencyMs / 5000) * 100, 0, 100)
        : 100;
    // Lower variance = better (normalized to 1000ms max)
    const varianceScore = clamp((1 - metrics.performanceVariance / 1000) * 100, 0, 100);

    return clamp(
        attentionScore * 0.3 + errorScore * 0.35 + recoveryScore * 0.2 + varianceScore * 0.15,
        0, 100
    );
}
