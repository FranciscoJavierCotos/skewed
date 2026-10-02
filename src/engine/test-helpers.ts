import type { AnswerResult, PublicQuestion } from "@/domain/types";

export const makeQuestion = (id: string, o: Partial<PublicQuestion> = {}): PublicQuestion => ({
  id, topic: "sql", level: 1, title: id, prompt: "p", context: null, tags: [],
  options: ["a", "b", "c", "d"].map((x) => ({ id: `${id}-${x}`, code: x })), ...o,
});

export const makeResult = (questionId: string, correct: boolean): AnswerResult => ({
  questionId, chosenOptionId: `${questionId}-${correct ? "a" : "b"}`, correct,
  correctOptionId: `${questionId}-a`, explanations: {}, docsUrl: null,
});
