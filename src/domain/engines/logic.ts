/* ==========================================================================
   Logic Engine — Pure Domain Logic
   
   Game: Pattern completion puzzles.
   User must identify the rule governing a sequence and select the
   correct next element. Pattern complexity scales with difficulty.
   
   Anti-repetition: tracks used pattern types per session to avoid 
   consecutive repeats. Per-puzzle seed variation ensures unique puzzles.
   ========================================================================== */

import type { LogicMetrics, Stimulus } from '@/types/engines';
import { seededRandom, clamp, mean, uuid } from '@/lib/math';

export type PatternType = 'arithmetic' | 'geometric' | 'fibonacci-like' | 'alternating' | 'mixed' | 'square' | 'prime' | 'power';

export interface LogicState {
    difficulty: number;
    seed: number;
    random: () => number;
    currentRound: number;
    totalRounds: number;
    startedAt: number;

    // Current puzzle
    currentPuzzle: LogicPuzzle | null;
    puzzleShownAt: number;

    // Anti-repetition tracking
    usedPatternTypes: PatternType[];

    // History
    roundResults: LogicRoundResult[];
}

export interface LogicPuzzle {
    id: string;
    sequence: number[];
    correctAnswer: number;
    options: number[];       // Multiple choice options
    patternType: PatternType;
    complexityLevel: number;
}

export interface LogicRoundResult {
    round: number;
    puzzleId: string;
    selectedAnswer: number;
    correctAnswer: number;
    isCorrect: boolean;
    solveTimeMs: number;
    complexityLevel: number;
    patternType: PatternType;
    optimalMoves: number;
    actualMoves: number;
}

export interface LogicInput {
    selectedAnswer: number;
    timestamp: number;
}

/** Small primes list for prime pattern */
const PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71];

/** Generate a pattern sequence based on type and complexity */
function generatePattern(
    type: PatternType,
    complexity: number,
    random: () => number
): { sequence: number[]; answer: number } {
    const len = clamp(Math.floor(4 + complexity * 0.3), 4, 8);

    switch (type) {
        case 'arithmetic': {
            const start = Math.floor(random() * 10) + 1;
            const step = Math.floor(random() * (3 + complexity)) + 1;
            const sequence = Array.from({ length: len }, (_, i) => start + step * i);
            const answer = start + step * len;
            return { sequence, answer };
        }
        case 'geometric': {
            const start = Math.floor(random() * 5) + 2;
            const ratio = Math.floor(random() * 3) + 2;
            const sequence = Array.from({ length: len }, (_, i) => start * (ratio ** i));
            const answer = start * (ratio ** len);
            return { sequence, answer };
        }
        case 'fibonacci-like': {
            const a = Math.floor(random() * 5) + 1;
            const b = Math.floor(random() * 5) + 1;
            const sequence = [a, b];
            for (let i = 2; i < len; i++) {
                sequence.push(sequence[i - 1] + sequence[i - 2]);
            }
            const answer = sequence[len - 1] + sequence[len - 2];
            return { sequence, answer };
        }
        case 'alternating': {
            const base1 = Math.floor(random() * 10) + 1;
            const base2 = Math.floor(random() * 10) + 1;
            const step1 = Math.floor(random() * 3) + 1;
            const step2 = Math.floor(random() * 3) + 1;
            const sequence: number[] = [];
            for (let i = 0; i < len; i++) {
                sequence.push(i % 2 === 0 ? base1 + step1 * Math.floor(i / 2) : base2 + step2 * Math.floor(i / 2));
            }
            const answer = len % 2 === 0
                ? base1 + step1 * Math.floor(len / 2)
                : base2 + step2 * Math.floor(len / 2);
            return { sequence, answer };
        }
        case 'mixed': {
            // Combined: multiply then add
            const start = Math.floor(random() * 5) + 1;
            const mult = 2;
            const add = Math.floor(random() * 3) + 1;
            const sequence = [start];
            for (let i = 1; i < len; i++) {
                sequence.push(sequence[i - 1] * mult + add);
            }
            const answer = sequence[len - 1] * mult + add;
            return { sequence, answer };
        }
        case 'square': {
            // Perfect squares: n^2
            const offset = Math.floor(random() * 5) + 1;
            const sequence = Array.from({ length: len }, (_, i) => (offset + i) ** 2);
            const answer = (offset + len) ** 2;
            return { sequence, answer };
        }
        case 'prime': {
            // Consecutive primes from a random starting index
            const maxStart = Math.max(0, PRIMES.length - len - 1);
            const startIdx = Math.floor(random() * maxStart);
            const sequence = PRIMES.slice(startIdx, startIdx + len);
            const answer = PRIMES[startIdx + len] ?? PRIMES[PRIMES.length - 1] + 2;
            return { sequence, answer };
        }
        case 'power': {
            // Powers of N: base^1, base^2, base^3...
            const base = Math.floor(random() * 3) + 2; // 2, 3, or 4
            const sequence = Array.from({ length: len }, (_, i) => base ** (i + 1));
            const answer = base ** (len + 1);
            return { sequence, answer };
        }
    }
}

/** Create initial state */
export function createLogicState(difficulty: number, seed?: number): LogicState {
    const s = seed ?? Date.now();

    return {
        difficulty,
        seed: s,
        random: seededRandom(s),
        currentRound: 0,
        totalRounds: Math.floor(10 + difficulty * 0.1),  // 10-20 puzzles
        startedAt: Date.now(),
        currentPuzzle: null,
        puzzleShownAt: 0,
        usedPatternTypes: [],
        roundResults: [],
    };
}

/** Generate next puzzle — avoids consecutive pattern type repeats */
export function generateLogicStimulus(state: LogicState): Stimulus {
    const complexityLevel = clamp(Math.floor(state.difficulty / 20) + 1, 1, 5);

    // All pattern types, unlocked progressively with complexity
    const allTypes: PatternType[] = ['arithmetic', 'geometric', 'fibonacci-like', 'alternating', 'mixed', 'square', 'prime', 'power'];
    const availableTypes = allTypes.slice(0, clamp(complexityLevel + 3, 3, 8));

    // Avoid repeating the last used pattern type
    const lastType = state.usedPatternTypes[state.usedPatternTypes.length - 1];
    let candidates = availableTypes.filter(t => t !== lastType);
    if (candidates.length === 0) candidates = availableTypes;

    // Use per-puzzle seed variation to guarantee unique puzzles each round
    const puzzleRandom = state.random;

    const type = candidates[Math.floor(puzzleRandom() * candidates.length)];
    state.usedPatternTypes.push(type);

    const { sequence, answer } = generatePattern(type, complexityLevel, puzzleRandom);

    // Generate wrong options
    const options = [answer];
    while (options.length < 4) {
        const offset = Math.floor(puzzleRandom() * 10) - 5;
        const wrongAnswer = answer + (offset === 0 ? 1 : offset);
        if (!options.includes(wrongAnswer) && wrongAnswer > 0) {
            options.push(wrongAnswer);
        }
    }
    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(puzzleRandom() * (i + 1));
        [options[i], options[j]] = [options[j], options[i]];
    }

    const puzzle: LogicPuzzle = {
        id: uuid(),
        sequence,
        correctAnswer: answer,
        options,
        patternType: type,
        complexityLevel,
    };

    state.currentPuzzle = puzzle;
    state.puzzleShownAt = Date.now();
    state.currentRound++;

    return {
        id: puzzle.id,
        type: 'pattern',
        data: {
            sequence,
            options,
            complexityLevel,
            patternType: type,
            round: state.currentRound,
        },
        timestamp: Date.now(),
    };
}

/** Process user answer */
export function processLogicInput(state: LogicState, input: LogicInput): LogicState {
    if (!state.currentPuzzle) return state;

    const solveTimeMs = input.timestamp - state.puzzleShownAt;
    const isCorrect = input.selectedAnswer === state.currentPuzzle.correctAnswer;

    const result: LogicRoundResult = {
        round: state.currentRound,
        puzzleId: state.currentPuzzle.id,
        selectedAnswer: input.selectedAnswer,
        correctAnswer: state.currentPuzzle.correctAnswer,
        isCorrect,
        solveTimeMs,
        complexityLevel: state.currentPuzzle.complexityLevel,
        patternType: state.currentPuzzle.patternType,
        optimalMoves: 1,  // Pattern puzzles are single-choice
        actualMoves: 1,
    };

    state.roundResults.push(result);
    state.currentPuzzle = null;

    return state;
}

/** Evaluate session metrics */
export function evaluateLogicSession(state: LogicState): LogicMetrics {
    const results = state.roundResults;

    // Solve time: average across all puzzles
    const solveTimeMs = results.length > 0
        ? mean(results.map(r => r.solveTimeMs))
        : 0;

    // Efficiency ratio: correct / total
    const correctCount = results.filter(r => r.isCorrect).length;
    const efficiencyRatio = results.length > 0
        ? correctCount / results.length
        : 0;

    // Scaling adaptation: does accuracy hold as complexity increases?
    const byComplexity = new Map<number, number[]>();
    for (const r of results) {
        const existing = byComplexity.get(r.complexityLevel) ?? [];
        existing.push(r.isCorrect ? 1 : 0);
        byComplexity.set(r.complexityLevel, existing);
    }

    let scalingResponse = 0;
    const complexityLevels = Array.from(byComplexity.keys()).sort();
    if (complexityLevels.length >= 2) {
        const accuracies = complexityLevels.map(level => mean(byComplexity.get(level)!));
        scalingResponse = (accuracies[accuracies.length - 1] - accuracies[0]);
    }

    // Pattern improvement: are later puzzles solved faster?
    const solveTimes = results.map(r => r.solveTimeMs);
    let patternCurve = 0;
    if (solveTimes.length >= 4) {
        const firstHalf = mean(solveTimes.slice(0, Math.floor(solveTimes.length / 2)));
        const secondHalf = mean(solveTimes.slice(Math.floor(solveTimes.length / 2)));
        patternCurve = firstHalf > 0 ? (firstHalf - secondHalf) / firstHalf : 0;
    }

    return {
        solveTimeMs,
        efficiencyRatio,
        scalingAdaptationResponse: scalingResponse,
        patternImprovementCurve: patternCurve,
    };
}

/** Calculate normalized score (0-100) */
export function calculateLogicScore(metrics: LogicMetrics): number {
    // Faster solve = better (max 30s for 0, 2s for 100)
    const timeScore = clamp((1 - (metrics.solveTimeMs - 2000) / 28000) * 100, 0, 100);
    // Higher efficiency = better
    const efficiencyScore = metrics.efficiencyRatio * 100;
    // Positive scaling = better
    const scalingScore = clamp((metrics.scalingAdaptationResponse + 0.5) / 1.0 * 100, 0, 100);
    // Positive curve = improving
    const curveScore = clamp((metrics.patternImprovementCurve + 0.3) / 0.6 * 100, 0, 100);

    return clamp(metrics.efficiencyRatio * (
        timeScore * 0.25 + efficiencyScore * 0.35 + scalingScore * 0.2 + curveScore * 0.2
        ), 0, 100
    );
}
