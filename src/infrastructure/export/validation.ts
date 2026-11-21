import type { ExportData } from '@/types/storage';
import { ACHIEVEMENTS } from '@/domain/gamification/achievements';
import { applyXP, getDefaultXPState } from '@/domain/gamification/xp';

const engines = ['focus', 'memory', 'reaction', 'logic'];
const object = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const number = (v: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): v is number => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
const metricKeys = {
    focus: ['sustainedAttentionMs', 'distractionErrorRate', 'focusRecoveryLatencyMs', 'performanceVariance'],
    memory: ['recallAccuracy', 'memorySpanTolerance', 'retentionDecay', 'complexityAdaptationSlope'],
    reaction: ['averageLatencyMs', 'standardDeviationMs', 'falseTriggerRate', 'fatigueDrift'],
    logic: ['solveTimeMs', 'efficiencyRatio', 'scalingAdaptationResponse', 'patternImprovementCurve'],
};
export function validateBackup(value: unknown): ExportData {
    if (!object(value) || value.version !== 1) throw new Error('Choose a Mind Sensei version 1 JSON backup.');
    if (!number(value.exportedAt) || !Array.isArray(value.sessions) || value.sessions.length > 100000) throw new Error('The backup has invalid session data.');
    const ids = new Set<string>();
    for (const session of value.sessions) {
        if (!object(session) || typeof session.id !== 'string' || !session.id || ids.has(session.id) || !engines.includes(String(session.engineType)) || !number(session.timestamp) || !number(session.duration) || !number(session.difficulty, 1, 100) || !number(session.score, 0, 100) || !object(session.metrics)) throw new Error('The backup contains an invalid or duplicate session.');
        const keys = metricKeys[session.engineType as keyof typeof metricKeys];
        if (!keys.every(key => typeof (session.metrics as Record<string, unknown>)[key] === 'number' && Number.isFinite((session.metrics as Record<string, number>)[key]))) throw new Error('The backup contains invalid game metrics.');
        const metrics = session.metrics as Record<string, unknown>;
        const ranges: Record<string, [number, number]> = {
            sustainedAttentionMs: [0, Number.MAX_SAFE_INTEGER], distractionErrorRate: [0, 1], focusRecoveryLatencyMs: [0, Number.MAX_SAFE_INTEGER], performanceVariance: [0, Number.MAX_SAFE_INTEGER], targetAccuracy: [0, 1],
            recallAccuracy: [0, 1], memorySpanTolerance: [0, 12], retentionDecay: [0, 1], complexityAdaptationSlope: [-1, 1],
            averageLatencyMs: [0, Number.MAX_SAFE_INTEGER], standardDeviationMs: [0, Number.MAX_SAFE_INTEGER], falseTriggerRate: [0, 1], fatigueDrift: [-1, 1], responseAccuracy: [0, 1], trialAccuracy: [0, 1],
            solveTimeMs: [0, Number.MAX_SAFE_INTEGER], efficiencyRatio: [0, 1], scalingAdaptationResponse: [-1, 1],
        };
        for (const [key, bounds] of Object.entries(ranges)) {
            if (key in metrics && !number(metrics[key], ...bounds)) throw new Error('The backup contains metrics outside the supported range.');
        }
        ids.add(session.id);
    }
    if (!object(value.xp) || !number(value.xp.totalXp, 0, 1e9) || !Number.isInteger(value.xp.totalXp)) throw new Error('The backup has invalid XP data.');
    if (!object(value.streak) || !number(value.streak.currentStreak, 0, 100000) || !number(value.streak.longestStreak, 0, 100000) || value.streak.currentStreak > value.streak.longestStreak || typeof value.streak.lastActiveDate !== 'string' || (value.streak.lastActiveDate !== '' && !/^\d{4}-\d{2}-\d{2}$/.test(value.streak.lastActiveDate))) throw new Error('The backup has invalid streak data.');
    if (!object(value.difficulty) || !engines.every(e => number((value.difficulty as Record<string, unknown>)[e], 1, 100))) throw new Error('The backup has invalid difficulty levels.');
    if (!object(value.preferences) || value.preferences.theme !== 'dark' || typeof value.preferences.soundEnabled !== 'boolean' || typeof value.preferences.reducedMotion !== 'boolean' || (value.preferences.sessionRounds !== undefined && value.preferences.sessionRounds !== 8 && value.preferences.sessionRounds !== 16)) throw new Error('The backup has invalid preferences.');
    if (!Array.isArray(value.achievements)) throw new Error('The backup has invalid achievements.');
    const knownIds = new Set(ACHIEVEMENTS.map(a => a.id));
    const achievementIds = new Set<string>();
    for (const achievement of value.achievements) {
        if (!object(achievement) || typeof achievement.id !== 'string' || !knownIds.has(achievement.id) || achievementIds.has(achievement.id) || !number(achievement.unlockedAt)) throw new Error('The backup has invalid achievements.');
        achievementIds.add(achievement.id);
    }
    // Level counters and daily aggregates are derived rather than trusted.
    return { ...value, xp: applyXP(getDefaultXPState(), value.xp.totalXp), dailyAggregates: [] } as unknown as ExportData;
}
