import type { AnswerResult, Level, PublicQuestion } from "@/domain/types";

// A Survival run stays at one level. It ends on the first wrong answer ("over")
// or when that level has no unseen questions left ("cleared").
export interface SurvivalState {
  status: "loading" | "answering" | "feedback" | "over" | "cleared";
  level: Level;
  streak: number;
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

export const initialSurvivalState = (level: Level): SurvivalState => ({
  status: "loading", level, streak: 0, current: null, lastResult: null, seenIds: [], missed: null,
});

/** The level offered after clearing `level`, or null at the top. */
export const nextSurvivalLevel = (level: Level): Level | null => (level < 5 ? ((level + 1) as Level) : null);

export function survivalReducer(s: SurvivalState, e: SurvivalEvent): SurvivalState {
  switch (e.type) {
    case "QUESTION_LOADED":
      if (s.status !== "loading") return s;
      return { ...s, status: "answering", current: e.question, lastResult: null, seenIds: [...s.seenIds, e.question.id] };
    case "POOL_EXHAUSTED":
      return s.status === "loading" ? { ...s, status: "cleared" } : s;
    case "ANSWER_RESULT": {
      if (s.status !== "answering" || !s.current || e.result.questionId !== s.current.id) return s;
      if (!e.result.correct) return { ...s, status: "over", lastResult: e.result, missed: { question: s.current, result: e.result } };
      return { ...s, status: "feedback", lastResult: e.result, streak: s.streak + 1 };
    }
    case "NEXT":
      return s.status === "feedback" ? { ...s, status: "loading", current: null } : s;
  }
}
