/* ==========================================================================
   Reaction Engine — Pure Domain Logic
   
   Game: Stimulus-response latency test.
   A visual stimulus appears after a random delay. User must respond
   as quickly as possible. Includes catch trials (no-go stimuli) to
   measure false triggers.
   ========================================================================== */

import type { ReactionMetrics, Stimulus } from '@/types/engines';
import { seededRandom, clamp, mean, standardDeviation, uuid } from '@/lib/math';

export interface ReactionState {
    difficulty: number;
    seed: number;
    random: () => number;
    currentRound: number;
    totalRounds: number;
    startedAt: number;

    // Current trial
    currentStimulusId: string | null;
    stimulusAppearedAt: number;
    isGoTrial: boolean;           // true = respond, false = inhibit
    waitingForResponse: boolean;
    trialStartedAt: number;

    // History
    trials: ReactionTrial[];
}

export interface ReactionTrial {
    round: number;
    isGoTrial: boolean;
    delayMs: number;              // pre-stimulus delay
    responseTimeMs: number | null; // null = no response
    wasCorrect: boolean;
    isFalseStart: boolean;       // responded during delay
    timestamp: number;
}

export interface ReactionInput {
    timestamp: number;
    type: 'tap';
}

/** Create initial state */
export function createReactionState(difficulty: number, seed?: number): ReactionState {
    const s = seed ?? Date.now();

    return {
        difficulty,
        seed: s,
        random: seededRandom(s),
        currentRound: 0,
        totalRounds: Math.floor(20 + difficulty * 0.1),  // 20-30 trials
        startedAt: Date.now(),
        currentStimulusId: null,
        stimulusAppearedAt: 0,
        isGoTrial: true,
        waitingForResponse: false,
        trialStartedAt: 0,
        trials: [],
    };
}

/** Generate next stimulus with random delay */
export function generateReactionStimulus(state: ReactionState): Stimulus {
    // Random delay before stimulus: 1-4 seconds
    const minDelay = 1000;
    const maxDelay = 4000 - state.difficulty * 15;  // Tighter window at high difficulty
    const delay = clamp(
        minDelay + state.random() * (maxDelay - minDelay),
        800, 4000
    );

    // No-go probability increases with difficulty
    const noGoProbability = clamp(0.15 + state.difficulty * 0.002, 0.15, 0.35);
    const isGoTrial = state.random() >= noGoProbability;

    state.currentRound++;
    state.stimulusAppearedAt = 0;
    state.trialStartedAt = Date.now();
    state.isGoTrial = isGoTrial;
    state.waitingForResponse = true;
    state.currentStimulusId = uuid();

    return {
        id: state.currentStimulusId,
        type: isGoTrial ? 'go' : 'no-go',
        data: {
            delay,
            isGoTrial,
            round: state.currentRound,
            color: isGoTrial ? 'var(--clr-success)' : 'var(--clr-error)',
        },
        timestamp: Date.now(),
    };
}

/** Record when the stimulus actually appears (after delay) */
export function markStimulusAppeared(state: ReactionState): ReactionState {
    state.stimulusAppearedAt = Date.now();
    return state;
}

/** Process user tap */
export function processReactionInput(state: ReactionState, input: ReactionInput): ReactionState {
    if (!state.waitingForResponse) return state;

    const responseTime = state.stimulusAppearedAt > 0
        ? input.timestamp - state.stimulusAppearedAt
        : null;

    const isFalseStart = state.stimulusAppearedAt === 0 || (responseTime !== null && responseTime < 0);

    let wasCorrect: boolean;
    if (isFalseStart) {
        wasCorrect = false;  // Tapped before stimulus appeared
    } else if (state.isGoTrial) {
        wasCorrect = true;   // Correctly responded to go stimulus
    } else {
        wasCorrect = false;  // Incorrectly responded to no-go stimulus
    }

    const trial: ReactionTrial = {
        round: state.currentRound,
        isGoTrial: state.isGoTrial,
        delayMs: state.stimulusAppearedAt > 0 ? state.stimulusAppearedAt - state.trialStartedAt : 0,
        responseTimeMs: isFalseStart ? null : responseTime,
        wasCorrect,
        isFalseStart,
        timestamp: input.timestamp,
    };

    state.trials.push(trial);
    state.waitingForResponse = false;
    state.currentStimulusId = null;
    state.stimulusAppearedAt = 0;

    return state;
}

/** Record a timeout (user didn't respond) */
export function recordReactionTimeout(state: ReactionState): ReactionState {
    if (!state.waitingForResponse) return state;
    const wasCorrect = !state.isGoTrial;  // Not responding to no-go is correct

    const trial: ReactionTrial = {
        round: state.currentRound,
        isGoTrial: state.isGoTrial,
        delayMs: Math.max(0, state.stimulusAppearedAt - state.trialStartedAt),
        responseTimeMs: null,
        wasCorrect,
        isFalseStart: false,
        timestamp: Date.now(),
    };

    state.trials.push(trial);
    state.waitingForResponse = false;
    state.currentStimulusId = null;
    state.stimulusAppearedAt = 0;

    return state;
}

/** Evaluate session metrics */
export function evaluateReactionSession(state: ReactionState): ReactionMetrics {
    const goTrials = state.trials.filter(t => t.isGoTrial);

    // Average latency (only correct go trials)
    const validResponseTimes = goTrials
        .filter(t => t.wasCorrect && t.responseTimeMs !== null)
        .map(t => t.responseTimeMs as number);

    const averageLatencyMs = validResponseTimes.length > 0
        ? mean(validResponseTimes)
        : 2000;

    // Standard deviation
    const standardDeviationMs = standardDeviation(validResponseTimes);

    // Count each false start or incorrect no-go response exactly once.
    const totalFalseTriggers = state.trials.filter(t => t.isFalseStart || (!t.isGoTrial && !t.wasCorrect)).length;
    const falseTriggerRate = state.trials.length > 0
        ? totalFalseTriggers / state.trials.length
        : 1;

    // Fatigue drift: compare first half response times to second half
    const halfIdx = Math.floor(validResponseTimes.length / 2);
    const firstHalf = halfIdx > 0 ? mean(validResponseTimes.slice(0, halfIdx)) : 0;
    const secondHalf = validResponseTimes.length > halfIdx ? mean(validResponseTimes.slice(halfIdx)) : 0;
    const fatigueDrift = firstHalf > 0
        ? clamp((secondHalf - firstHalf) / firstHalf, -1, 1)
        : 0;

    return {
        trialAccuracy: state.trials.length ? state.trials.filter(t => t.wasCorrect).length / state.trials.length : 0,
        responseAccuracy: goTrials.length ? validResponseTimes.length / goTrials.length : 0,
        averageLatencyMs,
        standardDeviationMs,
        falseTriggerRate,
        fatigueDrift,
    };
}

/** Calculate normalized score (0-100) */
export function calculateReactionScore(metrics: ReactionMetrics): number {
    // Lower latency = better (250ms = perfect, 1000ms = 0)
    const latencyScore = metrics.averageLatencyMs > 0
        ? clamp((1 - (metrics.averageLatencyMs - 200) / 800) * 100, 0, 100)
        : 50;

    // Lower stddev = more consistent
    const consistencyScore = clamp((1 - metrics.standardDeviationMs / 300) * 100, 0, 100);

    // Lower false triggers = better
    const accuracyScore = (1 - metrics.falseTriggerRate) * 100;

    // Lower fatigue drift = better
    const fatigueScore = clamp((1 - Math.abs(metrics.fatigueDrift)) * 100, 0, 100);

    return clamp((metrics.responseAccuracy ?? 1) * (metrics.trialAccuracy ?? (1 - metrics.falseTriggerRate)) * (
        latencyScore * 0.35 + consistencyScore * 0.25 + accuracyScore * 0.25 + fatigueScore * 0.15
        ), 0, 100
    );
}
