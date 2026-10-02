import type { AnswerResult, Level, PublicQuestion } from "@/domain/types";
import { survivalLevel } from "./shared";

export interface SurvivalState {
  status: "loading" | "answering" | "feedback" | "over" | "exhausted";
  level: Level;
  maxLevel: Level;
  streak: number;
  leveledUp: boolean;
  current: PublicQuestion | null;
  lastResult: AnswerResult | null;
  seenIds: string[];
  missed: { question: PublicQuestion; result: AnswerResult } | null;
}

export type SurvivalEvent =
  | { type: "QUESTION_LOADED"; question: PublicQuestion }
  | { type: "POOL_EXHAUSTED" }
  | { type: "ANSWER_RESULT"; result: AnswerResult }
  | { type: "NEXT" };

export const initialSurvivalState: SurvivalState = {
  status: "loading", level: 1, maxLevel: 1, streak: 0, leveledUp: false,
  current: null, lastResult: null, seenIds: [], missed: null,
};

export function survivalReducer(s: SurvivalState, e: SurvivalEvent): SurvivalState {
  switch (e.type) {
    case "QUESTION_LOADED":
      if (s.status !== "loading") return s;
      return { ...s, status: "answering", current: e.question, lastResult: null, leveledUp: false, seenIds: [...s.seenIds, e.question.id] };
    case "POOL_EXHAUSTED":
      return s.status === "loading" ? { ...s, status: "exhausted" } : s;
    case "ANSWER_RESULT": {
      if (s.status !== "answering" || !s.current || e.result.questionId !== s.current.id) return s;
      if (!e.result.correct) return { ...s, status: "over", lastResult: e.result, missed: { question: s.current, result: e.result } };
      const streak = s.streak + 1;
      const level = survivalLevel(streak);
      return {
        ...s, status: "feedback", lastResult: e.result, streak, level,
        maxLevel: Math.max(s.maxLevel, level) as Level, leveledUp: level > s.level,
      };
    }
    case "NEXT":
      return s.status === "feedback" ? { ...s, status: "loading", current: null } : s;
  }
}
