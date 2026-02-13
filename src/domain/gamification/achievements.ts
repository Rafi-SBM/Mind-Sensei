import type { AchievementDefinition, AchievementCondition, UnlockedAchievement } from '@/types/gamification';
import type { SessionRecord, EngineType } from '@/types/engines';
import type { StreakState, XPState } from '@/types/gamification';

export const ACHIEVEMENTS: AchievementDefinition[] = [
    { id: 'first-session', name: 'First Steps', description: 'Complete your first training session', icon: 'target', category: 'milestone', engineType: null, condition: { type: 'sessions_count', value: 1 } },
    { id: '10-sessions', name: 'Dedicated', description: 'Complete 10 training sessions', icon: 'star', category: 'milestone', engineType: null, condition: { type: 'sessions_count', value: 10 } },
    { id: '50-sessions', name: 'Committed', description: 'Complete 50 training sessions', icon: 'diamond', category: 'milestone', engineType: null, condition: { type: 'sessions_count', value: 50 } },
    { id: '100-sessions', name: 'Centurion', description: 'Complete 100 training sessions', icon: 'trophy', category: 'milestone', engineType: null, condition: { type: 'sessions_count', value: 100 } },
    { id: 'streak-3', name: 'Consistent', description: 'Maintain a 3-day streak', icon: 'flame', category: 'streak', engineType: null, condition: { type: 'streak_days', value: 3 } },
    { id: 'streak-7', name: 'Weekly Warrior', description: 'Maintain a 7-day streak', icon: 'flame', category: 'streak', engineType: null, condition: { type: 'streak_days', value: 7 } },
    { id: 'streak-30', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: 'shield', category: 'streak', engineType: null, condition: { type: 'streak_days', value: 30 } },
    { id: 'focus-80', name: 'Laser Focus', description: 'Score 80+ in a focus session', icon: 'focus', category: 'skill', engineType: 'focus', condition: { type: 'score_threshold', value: 80, engineType: 'focus' } },
    { id: 'memory-80', name: 'Steel Trap', description: 'Score 80+ in a memory session', icon: 'memory', category: 'skill', engineType: 'memory', condition: { type: 'score_threshold', value: 80, engineType: 'memory' } },
    { id: 'reaction-80', name: 'Lightning', description: 'Score 80+ in a reaction session', icon: 'reaction', category: 'skill', engineType: 'reaction', condition: { type: 'score_threshold', value: 80, engineType: 'reaction' } },
    { id: 'logic-80', name: 'Strategist', description: 'Score 80+ in a logic session', icon: 'logic', category: 'skill', engineType: 'logic', condition: { type: 'score_threshold', value: 80, engineType: 'logic' } },
    { id: 'level-5', name: 'Rising Star', description: 'Reach level 5', icon: 'starBurst', category: 'milestone', engineType: null, condition: { type: 'level_reached', value: 5 } },
    { id: 'level-10', name: 'Seasoned Mind', description: 'Reach level 10', icon: 'award', category: 'milestone', engineType: null, condition: { type: 'level_reached', value: 10 } },
    { id: 'level-25', name: 'Cognitive Elite', description: 'Reach level 25', icon: 'crown', category: 'milestone', engineType: null, condition: { type: 'level_reached', value: 25 } },
];

function checkCondition(condition: AchievementCondition, context: { sessions: SessionRecord[]; streak: StreakState; xp: XPState }): boolean {
    switch (condition.type) {
        case 'sessions_count':
            return context.sessions.length >= condition.value;
        case 'score_threshold':
            return context.sessions.some(s => (!condition.engineType || s.engineType === condition.engineType) && s.score >= condition.value);
        case 'streak_days':
            return context.streak.currentStreak >= condition.value || context.streak.longestStreak >= condition.value;
        case 'level_reached':
            return context.xp.level >= condition.value;
        case 'total_xp':
            return context.xp.totalXp >= condition.value;
        default:
            return false;
    }
}

export function checkNewAchievements(
    sessions: SessionRecord[],
    streak: StreakState,
    xp: XPState,
    alreadyUnlocked: UnlockedAchievement[]
): UnlockedAchievement[] {
    const unlockedIds = new Set(alreadyUnlocked.map(a => a.id));
    const newlyUnlocked: UnlockedAchievement[] = [];
    const context = { sessions, streak, xp };

    for (const achievement of ACHIEVEMENTS) {
        if (unlockedIds.has(achievement.id)) continue;
        if (checkCondition(achievement.condition, context)) {
            newlyUnlocked.push({ id: achievement.id, unlockedAt: Date.now() });
        }
    }

    return newlyUnlocked;
}
