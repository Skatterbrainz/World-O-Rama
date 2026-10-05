import type { EraBucket, Region } from "../types";
import type { CountryRecord, Topic } from "./questions";

export const STATS_KEY = "world-o-rama:stats:v1";
export const MAX_ANSWERS_STORED = 3000;
export const MAX_SESSIONS_STORED = 500;

export type Mode = "quick" | "endless";

export interface AnswerRecord {
  t: number;
  key: string;
  /** Country of the event behind the question. */
  country: string;
  guessed: string | null;
  correct: boolean;
  difficulty: 1 | 2 | 3;
  hints: number;
  points: number;
  region: Region;
  era: EraBucket;
  exploiter: string;
}

export interface SessionRecord {
  id: string;
  startedAt: number;
  mode: Mode;
  answered: number;
  correct: number;
  score: number;
  bestStreak: number;
}

export interface StatsData {
  version: 1;
  sessions: SessionRecord[];
  answers: AnswerRecord[];
  bestStreak: number;
  bestSessionScore: number;
}

/** Minimal storage surface so tests can pass a fake. */
export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export function emptyStats(): StatsData {
  return { version: 1, sessions: [], answers: [], bestStreak: 0, bestSessionScore: 0 };
}

export function parseStats(raw: string | null): StatsData {
  if (!raw) return emptyStats();
  try {
    const d = JSON.parse(raw) as Partial<StatsData>;
    if (d.version !== 1 || !Array.isArray(d.sessions) || !Array.isArray(d.answers)) return emptyStats();
    return {
      version: 1,
      sessions: d.sessions,
      answers: d.answers,
      bestStreak: Number(d.bestStreak) || 0,
      bestSessionScore: Number(d.bestSessionScore) || 0,
    };
  } catch {
    return emptyStats();
  }
}

export function loadStats(store: KeyValueStore): StatsData {
  return parseStats(store.getItem(STATS_KEY));
}

export function saveStats(store: KeyValueStore, data: StatsData): void {
  data.answers = data.answers.slice(-MAX_ANSWERS_STORED);
  data.sessions = data.sessions.slice(-MAX_SESSIONS_STORED);
  store.setItem(STATS_KEY, JSON.stringify(data));
}

export function resetStats(store: KeyValueStore): StatsData {
  store.removeItem(STATS_KEY);
  return emptyStats();
}

export function startSession(data: StatsData, mode: Mode, now = Date.now()): SessionRecord {
  const s: SessionRecord = {
    id: `${now}-${Math.random().toString(36).slice(2, 7)}`,
    startedAt: now,
    mode,
    answered: 0,
    correct: 0,
    score: 0,
    bestStreak: 0,
  };
  data.sessions.push(s);
  return s;
}

export function recordAnswer(data: StatsData, session: SessionRecord, rec: AnswerRecord, streakAfter: number): void {
  data.answers.push(rec);
  session.answered += 1;
  if (rec.correct) session.correct += 1;
  session.score += rec.points;
  session.bestStreak = Math.max(session.bestStreak, streakAfter);
  data.bestStreak = Math.max(data.bestStreak, streakAfter);
  data.bestSessionScore = Math.max(data.bestSessionScore, session.score);
}

export function countryRecords(data: StatsData): Map<string, CountryRecord> {
  const m = new Map<string, CountryRecord>();
  for (const a of data.answers) {
    const r = m.get(a.country) ?? { asked: 0, correct: 0 };
    r.asked += 1;
    if (a.correct) r.correct += 1;
    m.set(a.country, r);
  }
  return m;
}

export interface TrendPoint {
  index: number;
  value: number;
}

/** Rolling accuracy (0-1) over the last `window` answers, one point per answer. */
export function rollingAccuracy(answers: AnswerRecord[], window = 10): TrendPoint[] {
  const out: TrendPoint[] = [];
  let hits = 0;
  for (let i = 0; i < answers.length; i++) {
    if (answers[i].correct) hits += 1;
    if (i >= window && answers[i - window].correct) hits -= 1;
    const n = Math.min(i + 1, window);
    out.push({ index: i + 1, value: hits / n });
  }
  return out;
}

export function sessionScores(data: StatsData): TrendPoint[] {
  return data.sessions
    .filter((s) => s.answered > 0)
    .map((s, i) => ({ index: i + 1, value: s.score }));
}

export interface BreakdownRow {
  label: string;
  asked: number;
  correct: number;
  accuracy: number;
}

export function breakdown(answers: AnswerRecord[], keyOf: (a: AnswerRecord) => string): BreakdownRow[] {
  const m = new Map<string, { asked: number; correct: number }>();
  for (const a of answers) {
    const k = keyOf(a);
    const r = m.get(k) ?? { asked: 0, correct: 0 };
    r.asked += 1;
    if (a.correct) r.correct += 1;
    m.set(k, r);
  }
  return [...m.entries()]
    .map(([label, r]) => ({ label, ...r, accuracy: r.correct / r.asked }))
    .sort((a, b) => b.asked - a.asked);
}

/** Countries asked at least `minAsked` times, worst accuracy first. */
export function weakSpots(data: StatsData, minAsked = 2, limit = 8): Array<{ country: string; asked: number; accuracy: number }> {
  return [...countryRecords(data).entries()]
    .filter(([, r]) => r.asked >= minAsked && r.correct < r.asked)
    .map(([country, r]) => ({ country, asked: r.asked, accuracy: r.correct / r.asked }))
    .sort((a, b) => a.accuracy - b.accuracy || b.asked - a.asked)
    .slice(0, limit);
}

export function exportStats(data: StatsData): string {
  return JSON.stringify(data, null, 2);
}

export function importStats(raw: string): StatsData | null {
  const d = parseStats(raw);
  return d.answers.length || d.sessions.length ? d : null;
}

// ---- Settings ---------------------------------------------------------------

export const SETTINGS_KEY = "world-o-rama:settings:v1";

export interface Settings {
  quips: boolean;
  /** Show the country name in a tooltip while hovering over the map. */
  showNames: boolean;
  mode: Mode;
  regions: Region[] | null;
  eras: EraBucket[] | null;
  difficulties: (1 | 2 | 3)[] | null;
  /** Restrict questions to a theme such as coups or invasions. */
  topic: Topic | null;
}

export const DEFAULT_SETTINGS: Settings = {
  quips: true,
  showNames: true,
  mode: "quick",
  regions: null,
  eras: null,
  difficulties: null,
  topic: null,
};

export function loadSettings(store: KeyValueStore): Settings {
  try {
    const raw = store.getItem(SETTINGS_KEY);
    if (!raw) return { ...DEFAULT_SETTINGS };
    return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as Partial<Settings>) };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(store: KeyValueStore, s: Settings): void {
  store.setItem(SETTINGS_KEY, JSON.stringify(s));
}
