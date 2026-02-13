import type { XPState, LevelThreshold } from '@/types/gamification';
import type { SessionRecord } from '@/types/engines';
import type { StreakState } from '@/types/gamification';
import { XP_BASE_PER_SESSION, XP_DIFFICULTY_MULTIPLIER, XP_SCORE_MULTIPLIER, XP_STREAK_BONUS, LEVEL_BASE_XP, LEVEL_EXPONENT } from '@/lib/constants';

export function xpForLevel(level: number): number {
    return Math.floor(LEVEL_BASE_XP * Math.pow(level, LEVEL_EXPONENT));
}

export function cumulativeXpForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i <= level; i++) total += xpForLevel(i);
    return total;
}

export function getLevelThresholds(maxLevel: number = 100): LevelThreshold[] {
    const thresholds: LevelThreshold[] = [];
    let cumulative = 0;
    for (let level = 1; level <= maxLevel; level++) {
        const xpRequired = xpForLevel(level);
        cumulative += xpRequired;
        thresholds.push({ level, xpRequired, cumulativeXp: cumulative });
    }
    return thresholds;
}

export function calculateSessionXP(session: SessionRecord, streak: StreakState): number {
    const base = XP_BASE_PER_SESSION;
    const difficultyBonus = session.difficulty * XP_DIFFICULTY_MULTIPLIER;
    const scoreBonus = (session.score / 100) * XP_SCORE_MULTIPLIER * base;
    const streakMultiplier = 1 + Math.min(streak.currentStreak, 30) * XP_STREAK_BONUS;
    return Math.floor((base + difficultyBonus + scoreBonus) * streakMultiplier);
}

export function applyXP(state: XPState, xpGained: number): XPState {
    let { totalXp, level, currentLevelXp } = state;
    totalXp += xpGained;
    currentLevelXp += xpGained;
    let xpNeeded = xpForLevel(level + 1);
    while (currentLevelXp >= xpNeeded) {
        currentLevelXp -= xpNeeded;
        level++;
        xpNeeded = xpForLevel(level + 1);
    }
    return { totalXp, level, xpToNextLevel: xpNeeded - currentLevelXp, currentLevelXp };
}

export function getDefaultXPState(): XPState {
    return { totalXp: 0, level: 1, xpToNextLevel: xpForLevel(2), currentLevelXp: 0 };
}
