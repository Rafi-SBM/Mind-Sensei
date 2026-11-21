'use client';

import { openDB } from '@/infrastructure/db/schema';
import { lsGet } from '@/infrastructure/storage/local';
import { aggregateDaily, estimateFatigue } from '@/domain/analytics/metrics';
import { getDefaultDifficulty, adjustDifficulty } from '@/domain/difficulty/adaptive';
import { applyXP, calculateSessionXP, getDefaultXPState } from '@/domain/gamification/xp';
import { getDefaultStreak, isStreakActive, updateStreak } from '@/domain/gamification/streaks';
import { checkNewAchievements } from '@/domain/gamification/achievements';
import { LS_KEYS, STORE_SESSIONS, STORE_ACHIEVEMENTS, STORE_DAILY_AGGREGATES, STORE_STATE } from '@/types/storage';
import type { ExportData, Preferences, DifficultyState } from '@/types/storage';
import type { SessionRecord } from '@/types/engines';
import type { XPState, StreakState, UnlockedAchievement } from '@/types/gamification';

export const DEFAULT_PREFERENCES: Preferences = { theme: 'dark', soundEnabled: true, reducedMotion: false, sessionRounds: 8 };
export interface AppState {
    sessions: SessionRecord[];
    achievements: UnlockedAchievement[];
    xp: XPState;
    streak: StreakState;
    difficulty: DifficultyState;
    preferences: Preferences;
    loaded: boolean;
    error: string | null;
}
const initial: AppState = {
    sessions: [], achievements: [], xp: getDefaultXPState(), streak: getDefaultStreak(),
    difficulty: getDefaultDifficulty(), preferences: DEFAULT_PREFERENCES, loaded: false, error: null,
};
let state = initial;
const listeners = new Set<() => void>();
export const subscribe = (callback: () => void) => { listeners.add(callback); return () => { listeners.delete(callback); }; };
export const getSnapshot = () => state;
export const getServerSnapshot = () => initial;
function publish(next: AppState) { state = next; listeners.forEach(fn => fn()); }
const stores = [STORE_SESSIONS, STORE_ACHIEVEMENTS, STORE_DAILY_AGGREGATES, STORE_STATE];

function request<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => { req.onsuccess = () => resolve(req.result); req.onerror = () => reject(req.error); });
}
async function read(): Promise<AppState> {
    const db = await openDB();
    const tx = db.transaction(stores, 'readonly');
    const [sessions, achievements, saved] = await Promise.all([
        request(tx.objectStore(STORE_SESSIONS).getAll()) as Promise<SessionRecord[]>,
        request(tx.objectStore(STORE_ACHIEVEMENTS).getAll()) as Promise<UnlockedAchievement[]>,
        request(tx.objectStore(STORE_STATE).get('profile')) as Promise<{ value: Pick<AppState, 'xp' | 'streak' | 'difficulty' | 'preferences'> } | undefined>,
    ]);
    const profile = saved?.value ?? {
        xp: lsGet<XPState>(LS_KEYS.XP) ?? getDefaultXPState(),
        streak: lsGet<StreakState>(LS_KEYS.STREAK) ?? getDefaultStreak(),
        difficulty: lsGet<DifficultyState>(LS_KEYS.DIFFICULTY) ?? getDefaultDifficulty(),
        preferences: lsGet<Preferences>(LS_KEYS.PREFERENCES) ?? DEFAULT_PREFERENCES,
    };
    const streak = isStreakActive(profile.streak) ? profile.streak : { ...profile.streak, currentStreak: 0 };
    return { ...profile, streak, preferences: { ...DEFAULT_PREFERENCES, ...profile.preferences }, sessions: sessions.sort((a, b) => b.timestamp - a.timestamp), achievements, loaded: true, error: null };
}
async function persist(next: AppState): Promise<void> {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(stores, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error ?? new Error('Could not save your data.'));
        for (const store of stores) tx.objectStore(store).clear();
        next.sessions.forEach(s => tx.objectStore(STORE_SESSIONS).put(s));
        next.achievements.forEach(a => tx.objectStore(STORE_ACHIEVEMENTS).put(a));
        aggregateDaily(next.sessions).forEach(a => tx.objectStore(STORE_DAILY_AGGREGATES).put(a));
        const { xp, streak, difficulty, preferences } = next;
        tx.objectStore(STORE_STATE).put({ id: 'profile', value: { xp, streak, difficulty, preferences } });
    });
    // Legacy keys are no longer authoritative; remove them after a successful migration.
    try { Object.values(LS_KEYS).forEach(key => localStorage.removeItem(key)); } catch { /* IndexedDB is authoritative. */ }
    publish(next);
    channel?.postMessage('changed');
}
let queue: Promise<unknown> = Promise.resolve();
function mutate<T>(operation: (current: AppState) => Promise<T>): Promise<T> {
    const run = async (): Promise<T> => {
        if (typeof navigator !== 'undefined' && navigator.locks) {
            return await navigator.locks.request('mindsensei-write', async () => operation(await read()));
        }
        return await operation(await read());
    };
    const pending = queue.then(run, run);
    queue = pending.catch(() => undefined);
    return pending;
}
let channel: BroadcastChannel | null = null;
let initialization: Promise<void> | null = null;
export async function loadState(): Promise<void> {
    try { publish(await read()); }
    catch (error) { publish({ ...state, loaded: true, error: error instanceof Error ? error.message : 'Your browser could not open local storage.' }); }
}
export function initializeStore() {
    if (!initialization) {
        if (typeof BroadcastChannel !== 'undefined') {
            channel = new BroadcastChannel('mindsensei-data');
            channel.onmessage = () => { void loadState(); };
        }
        initialization = loadState();
    }
    return initialization;
}
export interface SessionReward { xp: number; newAchievements: UnlockedAchievement[]; nextDifficulty: number; reason: string; }
export function completeSession(session: SessionRecord): Promise<SessionReward> {
    return mutate(async current => {
        if (current.sessions.some(s => s.id === session.id)) {
            return { xp: 0, newAchievements: [], nextDifficulty: current.difficulty[session.engineType], reason: 'This session is already saved.' };
        }
        const sessions = [session, ...current.sessions].sort((a, b) => b.timestamp - a.timestamp);
        const streak = updateStreak(current.streak);
        const earned = calculateSessionXP(session, streak);
        const xp = applyXP(current.xp, earned);
        const adjustment = adjustDifficulty(current.difficulty[session.engineType], session.score / 100, estimateFatigue(sessions.filter(s => s.engineType === session.engineType)).probability, sessions.filter(s => s.engineType === session.engineType).length);
        const newAchievements = checkNewAchievements(sessions, streak, xp, current.achievements);
        await persist({ ...current, sessions, streak, xp, difficulty: { ...current.difficulty, [session.engineType]: adjustment.newDifficulty }, achievements: [...current.achievements, ...newAchievements] });
        return { xp: earned, newAchievements, nextDifficulty: adjustment.newDifficulty, reason: adjustment.reason };
    });
}
export function updatePreferences(patch: Partial<Preferences>) {
    return mutate(async current => { await persist({ ...current, preferences: { ...current.preferences, ...patch } }); });
}
export function resetDifficulty() {
    return mutate(async current => { await persist({ ...current, difficulty: getDefaultDifficulty() }); });
}
export function clearTrainingData() {
    return mutate(async current => { await persist({ ...initial, loaded: true, preferences: current.preferences }); });
}
export function replaceData(data: ExportData) {
    return mutate(async () => {
        await persist({ sessions: data.sessions, achievements: data.achievements, xp: data.xp, streak: data.streak, difficulty: data.difficulty, preferences: { ...DEFAULT_PREFERENCES, ...data.preferences }, loaded: true, error: null });
    });
}
export async function exportSnapshot(): Promise<ExportData> {
    const current = await read();
    return { version: 1, exportedAt: Date.now(), sessions: current.sessions, achievements: current.achievements, dailyAggregates: aggregateDaily(current.sessions), xp: current.xp, streak: current.streak, difficulty: current.difficulty, preferences: current.preferences };
}
