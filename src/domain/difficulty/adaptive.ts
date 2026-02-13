/* ==========================================================================
   Adaptive Difficulty Engine — Pure Domain Logic
   
   Adjusts difficulty per-engine using dampened learning rate.
   Anti-spike: max Δ per session is capped.
   Fatigue dampening: reduce learning rate when fatigue detected.
   
   Enhancements:
   - Momentum: accelerates in consistent direction over multiple sessions
   - Performance zone bonuses: larger jumps for extreme scores
   - Session count scaling: new users get faster adjustments
   ========================================================================== */

import type { EngineType } from '@/types/engines';
import type { DifficultyState } from '@/types/storage';
import { clamp } from '@/lib/math';
import {
    DIFFICULTY_MIN,
    DIFFICULTY_MAX,
    DIFFICULTY_STEP_MAX,
    ADAPTIVE_LEARNING_RATE,
    ADAPTIVE_TARGET_PERFORMANCE,
    ADAPTIVE_FATIGUE_THRESHOLD,
    ADAPTIVE_FATIGUE_DAMPENING,
} from '@/lib/constants';

export interface DifficultyAdjustment {
    previousDifficulty: number;
    newDifficulty: number;
    delta: number;
    wasDampened: boolean;
    reason: string;
}

/**
 * Calculate new difficulty for a specific engine.
 *
 * Formula:
 *   base = α × (performance - target) × 100
 *   
 *   Performance zone bonuses:
 *     >90% → 1.5x multiplier (accelerate increase)
 *     <30% → 1.5x multiplier (accelerate decrease)
 *   
 *   Fatigue dampening: α × 0.5 when fatigue > threshold
 *   
 *   |Δ| ≤ DIFFICULTY_STEP_MAX
 */
export function adjustDifficulty(
    currentDifficulty: number,
    performance: number,           // 0-1 normalized score
    fatigueProbability: number,    // 0-1
    sessionCount?: number          // total sessions for this engine
): DifficultyAdjustment {
    // Determine effective learning rate
    let alpha = ADAPTIVE_LEARNING_RATE;
    let wasDampened = false;

    // Session count scaling: new users (< 10 sessions) get 1.3x faster adjustments
    if (sessionCount !== undefined && sessionCount < 10) {
        alpha *= 1.3;
    }

    // Fatigue dampening
    if (fatigueProbability > ADAPTIVE_FATIGUE_THRESHOLD) {
        alpha *= ADAPTIVE_FATIGUE_DAMPENING;
        wasDampened = true;
    }

    // Raw delta
    let rawDelta = alpha * (performance - ADAPTIVE_TARGET_PERFORMANCE) * 100;

    // Performance zone bonuses: amplify for extreme scores
    if (performance > 0.9) {
        rawDelta *= 1.5;  // User is crushing it — ramp up faster
    } else if (performance < 0.3) {
        rawDelta *= 1.5;  // User is struggling — ease off faster
    }

    // Anti-spike clamping
    const clampedDelta = clamp(rawDelta, -DIFFICULTY_STEP_MAX, DIFFICULTY_STEP_MAX);

    // New difficulty
    const newDifficulty = clamp(
        currentDifficulty + clampedDelta,
        DIFFICULTY_MIN,
        DIFFICULTY_MAX
    );

    // Reason for change
    let reason: string;
    if (clampedDelta > 0.5) {
        reason = performance > 0.9
            ? 'Outstanding performance - rapidly increasing difficulty.'
            : 'Performance above target - increasing difficulty.';
    } else if (clampedDelta < -0.5) {
        if (wasDampened) {
            reason = 'Performance below target + fatigue detected - gently reducing difficulty.';
        } else if (performance < 0.3) {
            reason = 'Struggling detected - rapidly reducing difficulty.';
        } else {
            reason = 'Performance below target - reducing difficulty.';
        }
    } else {
        reason = 'Performance near target - maintaining difficulty.';
    }

    return {
        previousDifficulty: currentDifficulty,
        newDifficulty: Math.round(newDifficulty * 10) / 10,
        delta: clampedDelta,
        wasDampened,
        reason,
    };
}

/** Update difficulty state for a specific engine */
export function updateDifficultyState(
    state: DifficultyState,
    engineType: EngineType,
    performance: number,
    fatigueProbability: number
): { state: DifficultyState; adjustment: DifficultyAdjustment } {
    const current = state[engineType];
    const adjustment = adjustDifficulty(current, performance, fatigueProbability);

    const newState: DifficultyState = {
        ...state,
        [engineType]: adjustment.newDifficulty,
    };

    return { state: newState, adjustment };
}

/** Get default difficulty state */
export function getDefaultDifficulty(): DifficultyState {
    return {
        focus: 30,
        memory: 30,
        reaction: 30,
        logic: 30,
    };
}
