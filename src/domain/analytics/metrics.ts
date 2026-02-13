/* ==========================================================================
   Analytics Engine — Pure Domain Logic (client-side wrapper)
   
   The heavy computation happens in the Web Worker.
   This module provides convenience functions for light analytics
   that don't need to be offloaded.
   ========================================================================== */

import type { SessionRecord, EngineType } from '@/types/engines';
import type {
    DailyAggregate,
    RollingAverage,
    GrowthVelocity,
    FatigueEstimation,
    CognitiveGrowthIndex,
    ConsistencyScore,
} from '@/types/analytics';
import { mean, standardDeviation, clamp } from '@/lib/math';
import { toDateString } from '@/lib/time';
import { CGI_WEIGHTS, ROLLING_WINDOW_DAYS, CONSISTENCY_SAMPLE_SIZE } from '@/lib/constants';

const ENGINE_TYPES: EngineType[] = ['focus', 'memory', 'reaction', 'logic'];

/** Aggregate sessions into daily summaries */
export function aggregateDaily(sessions: SessionRecord[]): DailyAggregate[] {
    const grouped = new Map<string, SessionRecord[]>();

    for (const session of sessions) {
        const key = `${toDateString(session.timestamp)}-${session.engineType}`;
        const existing = grouped.get(key) ?? [];
        existing.push(session);
        grouped.set(key, existing);
    }

    const aggregates: DailyAggregate[] = [];
    for (const [key, group] of grouped) {
        const [date, engineType] = key.split('-') as [string, EngineType];
        aggregates.push({
            date,
            engineType,
            sessionsCount: group.length,
            avgScore: mean(group.map(s => s.score)),
            avgDifficulty: mean(group.map(s => s.difficulty)),
            totalDuration: group.reduce((sum, s) => sum + s.duration, 0),
            metrics: {},
        });
    }

    return aggregates;
}

/** Compute rolling averages (light version for UI) */
export function computeRollingAverages(
    sessions: SessionRecord[],
    windowDays: number = ROLLING_WINDOW_DAYS
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

/** Compute growth velocity */
export function computeGrowthVelocity(
    sessions: SessionRecord[],
    windowDays: number = ROLLING_WINDOW_DAYS
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

/** Quick fatigue check */
export function estimateFatigue(sessions: SessionRecord[]): FatigueEstimation {
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

/** Compute CGI from averages */
export function computeCGI(
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

/** Compute consistency score */
export function computeConsistency(
    sessions: SessionRecord[],
    sampleSize: number = CONSISTENCY_SAMPLE_SIZE
): ConsistencyScore {
    const recent = sessions
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, sampleSize)
        .map(s => s.score);

    if (recent.length < 2) {
        return { value: 0, stdDev: 0, mean: 0, sampleSize: recent.length };
    }

    const m = mean(recent);
    const sd = standardDeviation(recent);
    const consistency = m > 0 ? clamp(1 - sd / m, 0, 1) : 0;

    return { value: consistency, stdDev: sd, mean: m, sampleSize: recent.length };
}
