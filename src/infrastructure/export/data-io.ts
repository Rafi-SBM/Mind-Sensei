/* ==========================================================================
   Data Export/Import
   ========================================================================== */

import { dbGetAll, dbPutBatch, dbClear } from '@/infrastructure/db/client';
import { lsGet, lsSet } from '@/infrastructure/storage/local';
import { STORE_SESSIONS, STORE_DAILY_AGGREGATES, STORE_ACHIEVEMENTS, LS_KEYS } from '@/types/storage';
import type { SessionRecord } from '@/types/engines';
import type { DailyAggregate } from '@/types/analytics';
import type { UnlockedAchievement, XPState, StreakState } from '@/types/gamification';
import type { ExportData, DifficultyState, Preferences } from '@/types/storage';

const EXPORT_VERSION = 1;

/** Export all data as a JSON blob */
export async function exportAllData(): Promise<ExportData> {
    const sessions = await dbGetAll<SessionRecord>(STORE_SESSIONS);
    const dailyAggregates = await dbGetAll<DailyAggregate>(STORE_DAILY_AGGREGATES);
    const achievements = await dbGetAll<UnlockedAchievement>(STORE_ACHIEVEMENTS);

    const xp = lsGet<XPState>(LS_KEYS.XP) ?? { totalXp: 0, level: 1, xpToNextLevel: 100, currentLevelXp: 0 };
    const streak = lsGet<StreakState>(LS_KEYS.STREAK) ?? { currentStreak: 0, longestStreak: 0, lastActiveDate: '' };
    const difficulty = lsGet<DifficultyState>(LS_KEYS.DIFFICULTY) ?? { focus: 30, memory: 30, reaction: 30, logic: 30 };
    const preferences = lsGet<Preferences>(LS_KEYS.PREFERENCES) ?? { theme: 'dark' as const, soundEnabled: true, reducedMotion: false };

    return {
        version: EXPORT_VERSION,
        exportedAt: Date.now(),
        sessions,
        dailyAggregates,
        achievements,
        xp,
        streak,
        difficulty,
        preferences,
    };
}

/** Download data as JSON file */
export async function downloadExport(): Promise<void> {
    const data = await exportAllData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `mindsensei-backup-${new Date().toISOString().split('T')[0]}.json`;
    link.click();

    URL.revokeObjectURL(url);
}

/** Validate and import data from JSON */
export async function importData(jsonString: string): Promise<{ success: boolean; error?: string }> {
    try {
        const data = JSON.parse(jsonString) as ExportData;

        // Basic validation
        if (!data.version || !data.sessions || !Array.isArray(data.sessions)) {
            return { success: false, error: 'Invalid data format.' };
        }

        if (data.version > EXPORT_VERSION) {
            return { success: false, error: `Data version ${data.version} is not supported.` };
        }

        // Clear existing data
        await dbClear(STORE_SESSIONS);
        await dbClear(STORE_DAILY_AGGREGATES);
        await dbClear(STORE_ACHIEVEMENTS);

        // Import IndexedDB data
        if (data.sessions.length > 0) {
            await dbPutBatch(STORE_SESSIONS, data.sessions);
        }
        if (data.dailyAggregates?.length > 0) {
            await dbPutBatch(STORE_DAILY_AGGREGATES, data.dailyAggregates);
        }
        if (data.achievements?.length > 0) {
            await dbPutBatch(STORE_ACHIEVEMENTS, data.achievements);
        }

        // Import LocalStorage data
        if (data.xp) lsSet(LS_KEYS.XP, data.xp);
        if (data.streak) lsSet(LS_KEYS.STREAK, data.streak);
        if (data.difficulty) lsSet(LS_KEYS.DIFFICULTY, data.difficulty);
        if (data.preferences) lsSet(LS_KEYS.PREFERENCES, data.preferences);

        return { success: true };
    } catch (e) {
        return { success: false, error: e instanceof Error ? e.message : 'Import failed.' };
    }
}
