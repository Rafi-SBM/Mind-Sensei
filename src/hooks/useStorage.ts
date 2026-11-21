'use client';
import { useSyncExternalStore } from 'react';
import { subscribe, getSnapshot, getServerSnapshot, loadState, completeSession, updatePreferences, resetDifficulty } from '@/infrastructure/state/store';

export function useAppState() { return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot); }
export function useSessions() {
    const { sessions, loaded, error } = useAppState();
    return { sessions, loading: !loaded, error, addSession: completeSession, reload: loadState };
}
export function useXP() { const { xp } = useAppState(); return { xp }; }
export function useStreak() { const { streak } = useAppState(); return { streak }; }
export function useDifficulty() { const { difficulty } = useAppState(); return { difficulty, resetDifficulty }; }
export function useAchievements() { const { achievements } = useAppState(); return { achievements }; }
export function usePreferences() {
    const { preferences } = useAppState();
    return { preferences, setPreferences: updatePreferences };
}
