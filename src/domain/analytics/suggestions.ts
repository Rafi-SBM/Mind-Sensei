/* ==========================================================================
   Training Suggestions — Pure Domain Logic
   ========================================================================== */

import type { EngineType, SessionRecord } from '@/types/engines';
import type { TrainingSuggestion, SkillImbalance, RollingAverage } from '@/types/analytics';
import { mean } from '@/lib/math';

const ENGINE_TYPES: EngineType[] = ['focus', 'memory', 'reaction', 'logic'];

/** Compute skill imbalance from rolling averages */
export function computeSkillImbalance(
    averages: Record<EngineType, RollingAverage>
): SkillImbalance {
    const distribution: Partial<Record<EngineType, number>> = {};
    let maxSkill: EngineType = 'focus';
    let minSkill: EngineType = 'focus';
    let maxVal = -Infinity;
    let minVal = Infinity;

    for (const engine of ENGINE_TYPES) {
        const val = averages[engine].value;
        distribution[engine] = val;
        if (val > maxVal) { maxVal = val; maxSkill = engine; }
        if (val < minVal) { minVal = val; minSkill = engine; }
    }

    return {
        maxSkill,
        minSkill,
        spread: maxVal - minVal,
        distribution: distribution as Record<EngineType, number>,
    };
}

/** Generate a training suggestion */
export function suggestTraining(
    sessions: SessionRecord[],
    imbalance: SkillImbalance
): TrainingSuggestion {
    // Find last trained time per engine
    const engineLastTrained: Partial<Record<EngineType, number | null>> = {};
    for (const engine of ENGINE_TYPES) {
        const last = sessions
            .filter(s => s.engineType === engine)
            .sort((a, b) => b.timestamp - a.timestamp)[0];
        engineLastTrained[engine] = last?.timestamp ?? null;
    }

    // Default: suggest weakest skill
    let suggested = imbalance.minSkill;
    let reason = `Your ${imbalance.minSkill} score is the lowest - training it will balance your skills.`;
    let priority: TrainingSuggestion['priority'] = 'high';

    // If skills are balanced, suggest least recently trained
    if (imbalance.spread < 10) {
        let oldestTime = Infinity;
        for (const engine of ENGINE_TYPES) {
            const t = engineLastTrained[engine] ?? 0;
            if (t < oldestTime) {
                oldestTime = t;
                suggested = engine;
            }
        }
        reason = `Skills are balanced. ${suggested} hasn't been trained recently.`;
        priority = 'medium';
    }

    // If no data at all
    if (sessions.length === 0) {
        suggested = 'focus';
        reason = 'Start with a focus session to establish your baseline.';
        priority = 'high';
    }

    return {
        engineType: suggested,
        reason,
        priority,
        lastTrainedAt: engineLastTrained[suggested] ?? null,
    };
}
