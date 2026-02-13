/* ==========================================================================
   Gamification Type Definitions
   ========================================================================== */

import type { EngineType } from './engines';

export interface XPState {
    totalXp: number;
    level: number;
    xpToNextLevel: number;
    currentLevelXp: number;
}

export interface StreakState {
    currentStreak: number;
    longestStreak: number;
    lastActiveDate: string;             // YYYY-MM-DD
}

export type RankTier =
    | 'Novice'
    | 'Apprentice'
    | 'Practitioner'
    | 'Adept'
    | 'Expert'
    | 'Master'
    | 'Grandmaster';

export interface RankInfo {
    tier: RankTier;
    minLevel: number;
    displayName: string;
}

export interface AchievementDefinition {
    id: string;
    name: string;
    description: string;
    icon: string;
    category: 'milestone' | 'skill' | 'streak' | 'special';
    engineType: EngineType | null;
    condition: AchievementCondition;
}

export interface AchievementCondition {
    type: 'sessions_count' | 'score_threshold' | 'streak_days' | 'level_reached' | 'total_xp' | 'custom';
    value: number;
    engineType?: EngineType;
}

export interface UnlockedAchievement {
    id: string;
    unlockedAt: number;
}

export interface LevelThreshold {
    level: number;
    xpRequired: number;
    cumulativeXp: number;
}

export interface SkillTreeNode {
    id: string;
    engineType: EngineType;
    name: string;
    level: number;
    maxLevel: number;
    xpInvested: number;
}
