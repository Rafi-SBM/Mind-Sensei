import type { StreakState } from '@/types/gamification';
import { todayString, isYesterday } from '@/lib/time';

export function getDefaultStreak(): StreakState {
    return { currentStreak: 0, longestStreak: 0, lastActiveDate: '' };
}

export function updateStreak(state: StreakState): StreakState {
    const today = todayString();
    if (state.lastActiveDate === today) return state;

    let newStreak: number;
    if (isYesterday(state.lastActiveDate, today)) {
        newStreak = state.currentStreak + 1;
    } else if (state.lastActiveDate === '') {
        newStreak = 1;
    } else {
        newStreak = 1; // streak broken
    }

    return {
        currentStreak: newStreak,
        longestStreak: Math.max(state.longestStreak, newStreak),
        lastActiveDate: today,
    };
}

export function isStreakActive(state: StreakState): boolean {
    const today = todayString();
    return state.lastActiveDate === today || isYesterday(state.lastActiveDate, today);
}

export function getStreakMessage(streak: StreakState): string {
    if (streak.currentStreak === 0) return 'Start your streak today!';
    if (streak.currentStreak === 1) return 'Day 1 - keep going!';
    if (streak.currentStreak < 7) return `${streak.currentStreak} day streak 🔥`;
    if (streak.currentStreak < 30) return `${streak.currentStreak} day streak! Impressive! 🔥🔥`;
    return `${streak.currentStreak} day streak! Legendary! 🔥🔥🔥`;
}
