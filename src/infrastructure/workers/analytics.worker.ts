/* ==========================================================================
   Analytics Web Worker
   ========================================================================== */

import type { SessionRecord } from '@/types/engines';
import type {
    RollingAverage,
    GrowthVelocity,
    PlateauDetection,
    FatigueEstimation,
    CognitiveGrowthIndex,
    ConsistencyScore,
    SkillImbalance,
    AnalyticsSummary,
    TrainingSuggestion,
} from '@/types/analytics';

// Since this runs in a worker, we inline the math helpers
function mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function standardDeviation(values: number[]): number {
    if (values.length < 2) return 0;
    const m = mean(values);
    const squaredDiffs = values.map(v => (v - m) ** 2);
    return Math.sqrt(squaredDiffs.reduce((sum, v) => sum + v, 0) / (values.length - 1));
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

type EngineType = 'focus' | 'memory' | 'reaction' | 'logic';
const ENGINE_TYPES: EngineType[] = ['focus', 'memory', 'reaction', 'logic'];
const CGI_WEIGHTS: Record<EngineType, number> = {
    focus: 0.30,
    memory: 0.25,
    reaction: 0.25,
    logic: 0.20,
};

interface AnalyticsPayload {
    sessions: SessionRecord[];
    windowDays: number;
    plateauThreshold: number;
}

function computeRollingAverages(
    sessions: SessionRecord[],
    windowDays: number
): Record<EngineType, RollingAverage> {
    const now = Date.now();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const result: Partial<Record<EngineType, RollingAverage>> = {};

    for (const engine of ENGINE_TYPES) {
        const recent = sessions.filter(
            s => s.engineType === engine && s.timestamp >= now - windowMs
        );
        result[engine] = {
            engineType: engine,
            windowDays,
            value: mean(recent.map(s => s.score)),
            sampleCount: recent.length,
        };
    }

    return result as Record<EngineType, RollingAverage>;
}

function computeGrowthVelocity(
    sessions: SessionRecord[],
    windowDays: number
): Record<EngineType, GrowthVelocity> {
    const now = Date.now();
    const windowMs = windowDays * 24 * 60 * 60 * 1000;
    const result: Partial<Record<EngineType, GrowthVelocity>> = {};

    for (const engine of ENGINE_TYPES) {
        const currentWindow = sessions.filter(
            s => s.engineType === engine && s.timestamp >= now - windowMs
        );
        const prevWindow = sessions.filter(
            s => s.engineType === engine &&
                s.timestamp >= now - 2 * windowMs &&
                s.timestamp < now - windowMs
        );

        const currentAvg = mean(currentWindow.map(s => s.score));
        const prevAvg = mean(prevWindow.map(s => s.score));
        const delta = prevAvg > 0 ? (currentAvg - prevAvg) / windowDays : 0;

        let direction: GrowthVelocity['direction'] = 'stable';
        if (delta > 0.5) direction = 'improving';
        else if (delta < -0.5) direction = 'declining';

        result[engine] = { engineType: engine, delta, direction };
    }

    return result as Record<EngineType, GrowthVelocity>;
}

function computePlateauDetection(
    sessions: SessionRecord[],
    threshold: number
): Record<EngineType, PlateauDetection> {
    const result: Partial<Record<EngineType, PlateauDetection>> = {};

    for (const engine of ENGINE_TYPES) {
        const engineSessions = sessions
            .filter(s => s.engineType === engine)
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, 14);

        const scores = engineSessions.map(s => s.score);
        const v = scores.length >= 3 ? standardDeviation(scores) : Infinity;

        result[engine] = {
            engineType: engine,
            isPlateaued: v < threshold && scores.length >= 3,
            variance: v === Infinity ? 0 : v,
            threshold,
        };
    }

    return result as Record<EngineType, PlateauDetection>;
}

function computeFatigue(sessions: SessionRecord[]): FatigueEstimation {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    const todaySessions = sessions
        .filter(s => s.timestamp >= todayStart)
        .sort((a, b) => a.timestamp - b.timestamp);

    if (todaySessions.length < 2) {
        return { probability: 0, sessionsToday: todaySessions.length, performanceDropPercent: 0 };
    }

    const firstScore = todaySessions[0].score;
    const lastScore = todaySessions[todaySessions.length - 1].score;
    const drop = firstScore > 0 ? 1 - (lastScore / firstScore) : 0;

    return {
        probability: clamp(drop, 0, 1),
        sessionsToday: todaySessions.length,
        performanceDropPercent: clamp(drop * 100, 0, 100),
    };
}

function computeCGI(
    averages: Record<EngineType, RollingAverage>
): CognitiveGrowthIndex {
    const components: Partial<Record<EngineType, number>> = {};
    let overall = 0;

    for (const engine of ENGINE_TYPES) {
        const val = averages[engine].value;
        components[engine] = val;
        overall += val * CGI_WEIGHTS[engine];
    }

    return {
        overall,
        components: components as Record<EngineType, number>,
        weights: CGI_WEIGHTS,
    };
}

function computeConsistency(sessions: SessionRecord[]): ConsistencyScore {
    const recent = sessions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, 14)
        .map(s => s.score);

    if (recent.length < 2) {
        return { value: 0, stdDev: 0, mean: 0, sampleSize: recent.length };
    }

    const m = mean(recent);
    const sd = standardDeviation(recent);
    const consistency = m > 0 ? clamp(1 - sd / m, 0, 1) : 0;

    return { value: consistency, stdDev: sd, mean: m, sampleSize: recent.length };
}

function computeSkillImbalance(
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

function computeSuggestion(
    sessions: SessionRecord[],
    imbalance: SkillImbalance
): TrainingSuggestion {
    // Recommend weakest skill, or least recently trained
    const engineLastTrained: Partial<Record<EngineType, number>> = {};

    for (const engine of ENGINE_TYPES) {
        const last = sessions
            .filter(s => s.engineType === engine)
            .sort((a, b) => b.timestamp - a.timestamp)[0];
        engineLastTrained[engine] = last?.timestamp ?? null;
    }

    // Priority: weakest skill first, then least recently trained
    let suggested = imbalance.minSkill;
    let reason = `Your ${imbalance.minSkill} score is the lowest — training it will balance your skills.`;
    let priority: TrainingSuggestion['priority'] = 'high';

    // If spread is small, prefer least recently trained
    if (imbalance.spread < 10) {
        let oldestTime = Infinity;
        for (const engine of ENGINE_TYPES) {
            const t = engineLastTrained[engine] ?? 0;
            if (t < oldestTime) {
                oldestTime = t;
                suggested = engine;
            }
        }
        reason = `All skills are balanced. ${suggested} hasn't been trained recently.`;
        priority = 'medium';
    }

    return {
        engineType: suggested,
        reason,
        priority,
        lastTrainedAt: engineLastTrained[suggested] ?? null,
    };
}

function computeFullAnalytics(payload: AnalyticsPayload): AnalyticsSummary {
    const { sessions, windowDays, plateauThreshold } = payload;

    const rollingAverages = computeRollingAverages(sessions, windowDays);
    const growthVelocity = computeGrowthVelocity(sessions, windowDays);
    const plateau = computePlateauDetection(sessions, plateauThreshold);
    const fatigue = computeFatigue(sessions);
    const cgi = computeCGI(rollingAverages);
    const consistency = computeConsistency(sessions);
    const skillImbalance = computeSkillImbalance(rollingAverages);
    const suggestion = computeSuggestion(sessions, skillImbalance);

    return {
        rollingAverages,
        growthVelocity,
        plateau,
        fatigue,
        cgi,
        consistency,
        skillImbalance,
        suggestion,
    };
}

// Worker message handler
self.onmessage = (event: MessageEvent) => {
    const { type, payload, id } = event.data;

    try {
        let result: unknown;

        switch (type) {
            case 'computeAnalytics':
                result = computeFullAnalytics(payload as AnalyticsPayload);
                break;
            default:
                self.postMessage({ type, id, error: `Unknown message type: ${type}` });
                return;
        }

        self.postMessage({ type, payload: result, id });
    } catch (e) {
        const errorMsg = e instanceof Error ? e.message : 'Unknown error';
        self.postMessage({ type, id, error: errorMsg });
    }
};
