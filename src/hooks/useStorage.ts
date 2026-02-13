'use client';

import { useState, useEffect, useCallback } from 'react';
import { dbGetAll, dbPut } from '@/infrastructure/db/client';
import { lsGetOrDefault, lsSet } from '@/infrastructure/storage/local';
import { STORE_SESSIONS, STORE_ACHIEVEMENTS, LS_KEYS } from '@/types/storage';
import type { SessionRecord, EngineType } from '@/types/engines';
import type { DifficultyState, Preferences } from '@/types/storage';
import type { UnlockedAchievement, XPState, StreakState } from '@/types/gamification';
import { getDefaultXPState } from '@/domain/gamification/xp';
import { getDefaultStreak } from '@/domain/gamification/streaks';
import { getDefaultDifficulty } from '@/domain/difficulty/adaptive';

export function useSessions() {
    const [sessions, setSessions] = useState<SessionRecord[]>([]);
    const [loading, setLoading] = useState(true);

    const loadSessions = useCallback(async () => {
        try {
            const data = await dbGetAll<SessionRecord>(STORE_SESSIONS);
            setSessions(data.sort((a, b) => b.timestamp - a.timestamp));
        } catch (e) { console.error('Failed to load sessions:', e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadSessions(); }, [loadSessions]);

    const addSession = useCallback(async (session: SessionRecord) => {
        await dbPut(STORE_SESSIONS, session);
        setSessions(prev => [session, ...prev]);
    }, []);

    return { sessions, loading, addSession, reload: loadSessions };
}

export function useXP() {
    const [xp, setXP] = useState<XPState>(() => lsGetOrDefault(LS_KEYS.XP, getDefaultXPState()));
    const save = useCallback((newXP: XPState) => { setXP(newXP); lsSet(LS_KEYS.XP, newXP); }, []);
    return { xp, setXP: save };
}

export function useStreak() {
    const [streak, setStreak] = useState<StreakState>(() => lsGetOrDefault(LS_KEYS.STREAK, getDefaultStreak()));
    const save = useCallback((s: StreakState) => { setStreak(s); lsSet(LS_KEYS.STREAK, s); }, []);
    return { streak, setStreak: save };
}

export function useDifficulty() {
    const [difficulty, setDifficulty] = useState<DifficultyState>(() => lsGetOrDefault(LS_KEYS.DIFFICULTY, getDefaultDifficulty()));
    const save = useCallback((d: DifficultyState) => { setDifficulty(d); lsSet(LS_KEYS.DIFFICULTY, d); }, []);
    return { difficulty, setDifficulty: save };
}

export function useAchievements() {
    const [achievements, setAchievements] = useState<UnlockedAchievement[]>([]);
    useEffect(() => {
        dbGetAll<UnlockedAchievement>(STORE_ACHIEVEMENTS).then(setAchievements).catch(console.error);
    }, []);
    const addAchievements = useCallback(async (newOnes: UnlockedAchievement[]) => {
        for (const a of newOnes) await dbPut(STORE_ACHIEVEMENTS, a);
        setAchievements(prev => [...prev, ...newOnes]);
    }, []);
    return { achievements, addAchievements };
}

export function usePreferences() {
    const defaults: Preferences = { theme: 'dark', soundEnabled: true, reducedMotion: false };
    const [prefs, setPrefs] = useState<Preferences>(() => lsGetOrDefault(LS_KEYS.PREFERENCES, defaults));
    const save = useCallback((p: Preferences) => { setPrefs(p); lsSet(LS_KEYS.PREFERENCES, p); }, []);
    return { preferences: prefs, setPreferences: save };
}

