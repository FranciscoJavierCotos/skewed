import type { AnswerResult, PublicQuestion } from "@/domain/types";

export interface PracticeState {
  status: "loading" | "answering" | "feedback" | "exhausted" | "ended";
  current: PublicQuestion | null;
  lastResult: AnswerResult | null;
  seenIds: string[];
  answered: number;
  correct: number;
}

export type PracticeEvent =
  | { type: "QUESTION_LOADED"; question: PublicQuestion }
  | { type: "POOL_EXHAUSTED" }
  | { type: "ANSWER_RESULT"; result: AnswerResult }
  | { type: "NEXT" }
  | { type: "END" };

export const initialPracticeState: PracticeState = {
  status: "loading", current: null, lastResult: null, seenIds: [], answered: 0, correct: 0,
};

export function practiceReducer(s: PracticeState, e: PracticeEvent): PracticeState {
  switch (e.type) {
    case "QUESTION_LOADED":
      if (s.status !== "loading") return s;
      return { ...s, status: "answering", current: e.question, lastResult: null, seenIds: [...s.seenIds, e.question.id] };
    case "POOL_EXHAUSTED":
      return s.status === "loading" ? { ...s, status: "exhausted" } : s;
    case "ANSWER_RESULT":
      if (s.status !== "answering" || e.result.questionId !== s.current?.id) return s;
      return { ...s, status: "feedback", lastResult: e.result, answered: s.answered + 1, correct: s.correct + (e.result.correct ? 1 : 0) };
    case "NEXT":
      return s.status === "feedback" ? { ...s, status: "loading", current: null } : s;
    case "END":
      return s.status === "ended" ? s : { ...s, status: "ended" };
  }
}
