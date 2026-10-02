import type { Level, Mode, Topic } from "@/domain/types";

export interface SessionSummary {
  mode: Mode;
  topics: Topic[];
  level: Level | "mixed";
  answered: number;
  correct: number;
  streak: number | null;   // survival only
  finishedAt: string;      // ISO
}

export interface ProgressStore {
  readonly persistent: boolean;
  getPersonalBest(mode: "exam" | "survival", key: string): number | null;
  recordSession(s: SessionSummary): { newBest: boolean };
  getHistory(limit: number): SessionSummary[];
}

export const topicsKey = (topics: Topic[]): string => [...topics].sort().join("+");

/** Personal-best key: Survival bests are per level (streaks at different levels aren't comparable). */
export const bestKey = (mode: Mode, topics: Topic[], level: Level | "mixed"): string =>
  mode === "survival" ? `${topicsKey(topics)}@${level}` : topicsKey(topics);
