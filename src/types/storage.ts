/* ==========================================================================
   Storage Type Definitions
   ========================================================================== */

import type { SessionRecord } from './engines';
import type { DailyAggregate } from './analytics';
import type { UnlockedAchievement, XPState, StreakState } from './gamification';

/** IndexedDB Store Names */
export const DB_NAME = 'mindsensei-db';
export const DB_VERSION = 2;

export const STORE_SESSIONS = 'sessions' as const;
export const STORE_DAILY_AGGREGATES = 'dailyAggregates' as const;
export const STORE_ACHIEVEMENTS = 'achievements' as const;
export const STORE_STATE = 'state' as const;

/** Object store configs for schema creation */
export interface StoreConfig {
    name: string;
    keyPath: string | string[];
    indexes: Array<{
        name: string;
        keyPath: string | string[];
        unique: boolean;
    }>;
}

export const STORE_CONFIGS: StoreConfig[] = [
    {
        name: STORE_SESSIONS,
        keyPath: 'id',
        indexes: [
            { name: 'by-engine', keyPath: 'engineType', unique: false },
            { name: 'by-timestamp', keyPath: 'timestamp', unique: false },
            { name: 'by-engine-timestamp', keyPath: ['engineType', 'timestamp'], unique: false },
        ],
    },
    {
        name: STORE_DAILY_AGGREGATES,
        keyPath: ['date', 'engineType'],
        indexes: [
            { name: 'by-engine', keyPath: 'engineType', unique: false },
        ],
    },
    {
        name: STORE_ACHIEVEMENTS,
        keyPath: 'id',
        indexes: [],
    },
    { name: STORE_STATE, keyPath: 'id', indexes: [] },
];

/** LocalStorage Keys */
export const LS_KEYS = {
    PREFERENCES: 'ms-preferences',
    STREAK: 'ms-streak',
    XP: 'ms-xp',
    DIFFICULTY: 'ms-difficulty',
} as const;

/** Preferences schema */
export interface Preferences {
    theme: 'dark';
    soundEnabled: boolean;
    reducedMotion: boolean;
    sessionRounds?: 8 | 16;
}

/** Difficulty per engine */
export interface DifficultyState {
    focus: number;
    memory: number;
    reaction: number;
    logic: number;
}

/** Export/Import data shape */
export interface ExportData {
    version: number;
    exportedAt: number;
    sessions: SessionRecord[];
    dailyAggregates: DailyAggregate[];
    achievements: UnlockedAchievement[];
    xp: XPState;
    streak: StreakState;
    difficulty: DifficultyState;
    preferences: Preferences;
}
