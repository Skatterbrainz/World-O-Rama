export const BASE_POINTS = 100;
export const DIFFICULTY_MULTIPLIER: Record<1 | 2 | 3, number> = { 1: 1, 2: 1.5, 3: 2 };
export const HINT_PENALTY = 0.25;
export const MAX_HINTS = 3;
export const STREAK_BONUS_PER = 10;
export const STREAK_BONUS_CAP = 10;

export interface ScoreInput {
  correct: boolean;
  difficulty: 1 | 2 | 3;
  hintsUsed: number;
  streakBefore: number;
}

export interface ScoreResult {
  points: number;
  basePoints: number;
  hintPenalty: number;
  streakBonus: number;
  streakAfter: number;
}

export function scoreAnswer(i: ScoreInput): ScoreResult {
  const full = Math.round(BASE_POINTS * DIFFICULTY_MULTIPLIER[i.difficulty]);
  if (!i.correct) return { points: 0, basePoints: full, hintPenalty: 0, streakBonus: 0, streakAfter: 0 };
  const hints = Math.min(Math.max(i.hintsUsed, 0), MAX_HINTS);
  const hintPenalty = Math.min(Math.round(full * HINT_PENALTY * hints), Math.round(full * 0.75));
  const streakBonus = STREAK_BONUS_PER * Math.min(i.streakBefore, STREAK_BONUS_CAP);
  return {
    points: full - hintPenalty + streakBonus,
    basePoints: full,
    hintPenalty,
    streakBonus,
    streakAfter: i.streakBefore + 1,
  };
}
