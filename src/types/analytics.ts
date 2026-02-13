/* ==========================================================================
   Analytics Type Definitions
   ========================================================================== */

import type { EngineType } from './engines';

export interface DailyAggregate {
    date: string;                         // YYYY-MM-DD
    engineType: EngineType;
    sessionsCount: number;
    avgScore: number;
    avgDifficulty: number;
    totalDuration: number;
    metrics: Record<string, number>;
}

export interface RollingAverage {
    engineType: EngineType;
    windowDays: number;
    value: number;
    sampleCount: number;
}

export interface GrowthVelocity {
    engineType: EngineType;
    delta: number;                        // Change per window
    direction: 'improving' | 'declining' | 'stable';
}

export interface PlateauDetection {
    engineType: EngineType;
    isPlateaued: boolean;
    variance: number;
    threshold: number;
}

export interface FatigueEstimation {
    probability: number;                  // 0-1
    sessionsToday: number;
    performanceDropPercent: number;
}

export interface CognitiveGrowthIndex {
    overall: number;                      // 0-100
    components: Record<EngineType, number>;
    weights: Record<EngineType, number>;
}

export interface ConsistencyScore {
    value: number;                        // 0-1
    stdDev: number;
    mean: number;
    sampleSize: number;
}

export interface SkillImbalance {
    maxSkill: EngineType;
    minSkill: EngineType;
    spread: number;
    distribution: Record<EngineType, number>;
}

export interface TrainingSuggestion {
    engineType: EngineType;
    reason: string;
    priority: 'high' | 'medium' | 'low';
    lastTrainedAt: number | null;
}

export interface AnalyticsSummary {
    rollingAverages: Record<EngineType, RollingAverage>;
    growthVelocity: Record<EngineType, GrowthVelocity>;
    plateau: Record<EngineType, PlateauDetection>;
    fatigue: FatigueEstimation;
    cgi: CognitiveGrowthIndex;
    consistency: ConsistencyScore;
    skillImbalance: SkillImbalance;
    suggestion: TrainingSuggestion;
}
