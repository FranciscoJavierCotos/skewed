import type { AnswerResult, Level, PublicQuestion, Topic } from "@/domain/types";

export interface ExamState {
  status: "loading" | "empty" | "answering" | "finished";
  questions: PublicQuestion[];
  index: number;
  results: AnswerResult[];
  requested: number;
}

export type ExamEvent =
  | { type: "QUESTIONS_LOADED"; questions: PublicQuestion[]; requested: number }
  | { type: "ANSWER_RESULT"; result: AnswerResult };

export const initialExamState: ExamState = { status: "loading", questions: [], index: 0, results: [], requested: 0 };

export function examReducer(s: ExamState, e: ExamEvent): ExamState {
  switch (e.type) {
    case "QUESTIONS_LOADED":
      if (s.status !== "loading") return s;
      return { ...s, status: e.questions.length ? "answering" : "empty", questions: e.questions, requested: e.requested };
    case "ANSWER_RESULT": {
      if (s.status !== "answering" || e.result.questionId !== s.questions[s.index]?.id) return s;
      const index = s.index + 1;
      return { ...s, results: [...s.results, e.result], index, status: index >= s.questions.length ? "finished" : "answering" };
    }
  }
}

type Tally = { total: number; correct: number };
export interface ExamSummary {
  total: number; correct: number; pct: number; shortBy: number;
  byTopic: Partial<Record<Topic, Tally>>; byLevel: Partial<Record<Level, Tally>>;
}

export function summarizeExam(s: ExamState): ExamSummary {
  const byTopic: ExamSummary["byTopic"] = {};
  const byLevel: ExamSummary["byLevel"] = {};
  let correct = 0;
  s.results.forEach((res, i) => {
    const q = s.questions[i];
    const t = (byTopic[q.topic] ??= { total: 0, correct: 0 });
    const l = (byLevel[q.level] ??= { total: 0, correct: 0 });
    t.total++; l.total++;
    if (res.correct) { correct++; t.correct++; l.correct++; }
  });
  const total = s.results.length;
  return {
    total, correct, byTopic, byLevel,
    pct: total ? Math.round((correct / total) * 100) : 0,
    shortBy: Math.max(0, s.requested - s.questions.length),
  };
}
