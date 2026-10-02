import type { Level, Mode, Topic } from "@/domain/types";

export interface SessionSummary {
  mode: Mode;
  topics: Topic[];
  level: Level | "mixed";
  answered: number;
  correct: number;
  streak: number | null;   // survival only
  maxLevel: Level | null;  // survival only
  finishedAt: string;      // ISO
}

export interface ProgressStore {
  readonly persistent: boolean;
  getPersonalBest(mode: "exam" | "survival", topicsKey: string): number | null;
  recordSession(s: SessionSummary): { newBest: boolean };
  getHistory(limit: number): SessionSummary[];
}

export const topicsKey = (topics: Topic[]): string => [...topics].sort().join("+");
