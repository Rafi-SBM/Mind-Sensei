/* ==========================================================================
   Working Memory Engine — Pure Domain Logic
   
   Game: Sequence recall.
   Show a sequence of items (numbers/colors), then user must recall
   in correct order. Sequence length adapts to performance.
   ========================================================================== */

import type { MemoryMetrics, Stimulus } from '@/types/engines';
import { seededRandom, clamp, mean, uuid } from '@/lib/math';

export interface MemoryState {
    difficulty: number;
    seed: number;
    random: () => number;
    currentRound: number;
    totalRounds: number;
    startedAt: number;

    // Current sequence
    currentSequence: number[];
    userRecall: number[];
    sequenceLength: number;
    isShowingSequence: boolean;
    sequenceShowTime: number;    // when sequence display started

    // History
    roundResults: MemoryRoundResult[];

    // Adaptive span tracking
    maxSpanReached: number;
    spanHistory: number[];
}

export interface MemoryRoundResult {
    round: number;
    sequenceLength: number;
    recallAccuracy: number;
    recallTimeMs: number;
    isCorrect: boolean;
}

export interface MemoryInput {
    selectedIndex: number;       // The number the user selected
    timestamp: number;
}

/** Create initial state */
export function createMemoryState(difficulty: number, seed?: number): MemoryState {
    const s = seed ?? Date.now();
    const startSpan = Math.floor(3 + difficulty * 0.04);  // 3-7 initial span

    return {
        difficulty,
        seed: s,
        random: seededRandom(s),
        currentRound: 0,
        totalRounds: Math.floor(10 + difficulty * 0.1),  // 10-20 rounds
        startedAt: Date.now(),
        currentSequence: [],
        userRecall: [],
        sequenceLength: clamp(startSpan, 3, 9),
        isShowingSequence: false,
        sequenceShowTime: 0,
        roundResults: [],
        maxSpanReached: startSpan,
        spanHistory: [],
    };
}

/** Generate a new sequence stimulus */
export function generateMemoryStimulus(state: MemoryState): Stimulus {
    // Generate a random sequence of numbers 1-9
    const sequence: number[] = [];
    for (let i = 0; i < state.sequenceLength; i++) {
        sequence.push(Math.floor(state.random() * 9) + 1);
    }

    state.currentSequence = sequence;
    state.userRecall = [];
    state.isShowingSequence = true;
    state.sequenceShowTime = Date.now();
    state.currentRound++;

    // Display time scales with sequence length: 800ms per item + 500ms buffer
    const displayTime = state.sequenceLength * 800 + 500;

    return {
        id: uuid(),
        type: 'sequence',
        data: {
            sequence,
            displayTime,
            sequenceLength: state.sequenceLength,
            round: state.currentRound,
        },
        timestamp: Date.now(),
    };
}

/** Process a recall input */
export function processMemoryInput(state: MemoryState, input: MemoryInput): MemoryState {
    state.userRecall.push(input.selectedIndex);
    return state;
}

/** Complete current round and evaluate */
export function completeMemoryRound(state: MemoryState): {
    state: MemoryState;
    result: MemoryRoundResult;
} {
    state.isShowingSequence = false;
    const recallTimeMs = Date.now() - state.sequenceShowTime;

    // Calculate accuracy: correct items in correct positions
    let correctCount = 0;
    for (let i = 0; i < state.currentSequence.length; i++) {
        if (state.userRecall[i] === state.currentSequence[i]) {
            correctCount++;
        }
    }
    const recallAccuracy = state.currentSequence.length > 0
        ? correctCount / state.currentSequence.length
        : 0;

    const isCorrect = recallAccuracy >= 0.8;  // 80% threshold for "correct"

    const result: MemoryRoundResult = {
        round: state.currentRound,
        sequenceLength: state.sequenceLength,
        recallAccuracy,
        recallTimeMs,
        isCorrect,
    };

    state.roundResults.push(result);
    state.spanHistory.push(state.sequenceLength);

    // Adapt sequence length
    if (isCorrect) {
        state.sequenceLength = clamp(state.sequenceLength + 1, 3, 12);
        state.maxSpanReached = Math.max(state.maxSpanReached, state.sequenceLength);
    } else {
        state.sequenceLength = clamp(state.sequenceLength - 1, 3, 12);
    }

    return { state, result };
}

/** Evaluate session metrics */
export function evaluateMemorySession(state: MemoryState): MemoryMetrics {
    const results = state.roundResults;

    // Recall accuracy: average across all rounds
    const recallAccuracy = results.length > 0
        ? mean(results.map(r => r.recallAccuracy))
        : 0;

    // Memory span tolerance: max span where accuracy >= 70%
    const memorySpanTolerance = state.maxSpanReached;

    // Retention decay: compare first half accuracy to second half
    const halfIdx = Math.floor(results.length / 2);
    const firstHalfAcc = halfIdx > 0 ? mean(results.slice(0, halfIdx).map(r => r.recallAccuracy)) : 0;
    const secondHalfAcc = results.length > halfIdx ? mean(results.slice(halfIdx).map(r => r.recallAccuracy)) : 0;
    const retentionDecay = firstHalfAcc > 0 ? clamp(firstHalfAcc - secondHalfAcc, 0, 1) : 0;

    // Complexity adaptation slope: how well user adapts to increasing difficulty
    // Positive = improving with complexity, negative = struggling
    const spanScorePairs = results.map(r => ({
        span: r.sequenceLength,
        accuracy: r.recallAccuracy,
    }));

    let complexitySlope = 0;
    if (spanScorePairs.length >= 3) {
        // Simple linear regression of accuracy over rounds
        const n = spanScorePairs.length;
        const xs = spanScorePairs.map((_, i) => i);
        const ys = spanScorePairs.map(p => p.accuracy);
        const sumX = xs.reduce((a, b) => a + b, 0);
        const sumY = ys.reduce((a, b) => a + b, 0);
        const sumXY = xs.reduce((sum, x, i) => sum + x * ys[i], 0);
        const sumXX = xs.reduce((sum, x) => sum + x * x, 0);
        complexitySlope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    }

    return {
        recallAccuracy,
        memorySpanTolerance,
        retentionDecay,
        complexityAdaptationSlope: complexitySlope,
    };
}

/** Calculate normalized score (0-100) */
export function calculateMemoryScore(metrics: MemoryMetrics): number {
    const accuracyScore = metrics.recallAccuracy * 100;
    const spanScore = clamp((metrics.memorySpanTolerance / 9) * 100, 0, 100);
    const decayScore = (1 - metrics.retentionDecay) * 100;
    const adaptScore = clamp((metrics.complexityAdaptationSlope + 0.1) / 0.2 * 100, 0, 100);

    return clamp(
        accuracyScore * 0.35 + spanScore * 0.3 + decayScore * 0.2 + adaptScore * 0.15,
        0, 100
    );
}
