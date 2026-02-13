/* ==========================================================================
   App-wide Constants
   ========================================================================== */

import type { EngineType } from '@/types/engines';
import type { RankInfo, RankTier } from '@/types/gamification';

/** App metadata */
export const APP_NAME = 'MindSenSei';
export const APP_DESCRIPTION = 'A privacy-first cognitive performance platform to sharpen focus, memory, reaction speed, and logical thinking.';
export const APP_URL = 'https://mindsensei.app';

/** Engine display info */
export const ENGINE_INFO: Record<EngineType, {
    label: string;
    description: string;
    icon: string;
    color: string;
}> = {
    focus: {
        label: 'Focus',
        description: 'Train sustained attention and concentration',
        icon: 'focus',
        color: 'var(--clr-focus)',
    },
    memory: {
        label: 'Memory',
        description: 'Strengthen working memory and recall',
        icon: 'memory',
        color: 'var(--clr-memory)',
    },
    reaction: {
        label: 'Reaction',
        description: 'Improve response speed and precision',
        icon: 'reaction',
        color: 'var(--clr-reaction)',
    },
    logic: {
        label: 'Logic',
        description: 'Develop pattern recognition and reasoning',
        icon: 'logic',
        color: 'var(--clr-logic)',
    },
};

/** Difficulty bounds */
export const DIFFICULTY_MIN = 1;
export const DIFFICULTY_MAX = 100;
export const DIFFICULTY_DEFAULT = 30;
export const DIFFICULTY_STEP_MAX = 8;

/** Adaptive difficulty constants */
export const ADAPTIVE_LEARNING_RATE = 0.1;
export const ADAPTIVE_TARGET_PERFORMANCE = 0.7;
export const ADAPTIVE_FATIGUE_THRESHOLD = 0.5;
export const ADAPTIVE_FATIGUE_DAMPENING = 0.5;

/** Analytics constants */
export const ROLLING_WINDOW_DAYS = 7;
export const PLATEAU_THRESHOLD = 2.0;
export const CONSISTENCY_SAMPLE_SIZE = 14;
export const CGI_WEIGHTS: Record<EngineType, number> = {
    focus: 0.30,
    memory: 0.25,
    reaction: 0.25,
    logic: 0.20,
};

/** Gamification constants */
export const XP_BASE_PER_SESSION = 50;
export const XP_DIFFICULTY_MULTIPLIER = 0.5;
export const XP_SCORE_MULTIPLIER = 1.5;
export const XP_STREAK_BONUS = 0.1;

export const LEVEL_BASE_XP = 100;
export const LEVEL_EXPONENT = 1.5;

export const RANK_TIERS: RankInfo[] = [
    { tier: 'Novice' as RankTier, minLevel: 1, displayName: 'Novice' },
    { tier: 'Apprentice' as RankTier, minLevel: 5, displayName: 'Apprentice' },
    { tier: 'Practitioner' as RankTier, minLevel: 10, displayName: 'Practitioner' },
    { tier: 'Adept' as RankTier, minLevel: 20, displayName: 'Adept' },
    { tier: 'Expert' as RankTier, minLevel: 35, displayName: 'Expert' },
    { tier: 'Master' as RankTier, minLevel: 50, displayName: 'Master' },
    { tier: 'Grandmaster' as RankTier, minLevel: 75, displayName: 'Grandmaster' },
];

/** Session limits */
export const ROUNDS_PER_SESSION = 20;
export const SESSION_TIMEOUT_MS = 300_000; // 5 minutes max
