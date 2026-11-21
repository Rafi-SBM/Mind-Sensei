import type { RankInfo } from '@/types/gamification';
import { RANK_TIERS } from '@/lib/constants';

export function getRank(level: number): RankInfo {
    let currentRank = RANK_TIERS[0];
    for (const rank of RANK_TIERS) {
        if (level >= rank.minLevel) currentRank = rank;
    }
    return currentRank;
}

export function getNextRank(level: number): RankInfo | null {
    const current = getRank(level);
    const idx = RANK_TIERS.findIndex(r => r.tier === current.tier);
    return idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
}

export function getRankProgress(level: number): number {
    const current = getRank(level);
    const next = getNextRank(level);
    if (!next) return 1;
    return (level - current.minLevel) / (next.minLevel - current.minLevel);
}

export function getAllRanks(): RankInfo[] {
    return [...RANK_TIERS];
}
