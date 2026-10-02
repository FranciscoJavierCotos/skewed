import { examReducer as r, initialExamState, summarizeExam } from "./exam";
import { makeQuestion, makeResult } from "./test-helpers";

const qs = [makeQuestion("a", { topic: "sql", level: 1 }), makeQuestion("b", { topic: "spark", level: 2 }), makeQuestion("c", { topic: "spark", level: 2 })];
const loaded = r(initialExamState, { type: "QUESTIONS_LOADED", questions: qs, requested: 10 });

it("starts answering the first question and records the shortfall", () => {
  expect(loaded).toMatchObject({ status: "answering", index: 0, requested: 10 });
  expect(summarizeExam(loaded).shortBy).toBe(7);
});

it("empty pool -> empty status", () => {
  expect(r(initialExamState, { type: "QUESTIONS_LOADED", questions: [], requested: 10 }).status).toBe("empty");
});

it("advances on each result and finishes after the last", () => {
  let s = r(loaded, { type: "ANSWER_RESULT", result: makeResult("a", true) });
  expect(s.index).toBe(1);
  s = r(s, { type: "ANSWER_RESULT", result: makeResult("b", false) });
  s = r(s, { type: "ANSWER_RESULT", result: makeResult("c", true) });
  expect(s.status).toBe("finished");
  expect(summarizeExam(s)).toMatchObject({
    total: 3, correct: 2, pct: 67,
    byTopic: { sql: { total: 1, correct: 1 }, spark: { total: 2, correct: 1 } },
    byLevel: { 1: { total: 1, correct: 1 }, 2: { total: 2, correct: 1 } },
  });
});

it("timer/click race: a second result for the same question is ignored", () => {
  const s1 = r(loaded, { type: "ANSWER_RESULT", result: { ...makeResult("a", false), chosenOptionId: null } });
  const s2 = r(s1, { type: "ANSWER_RESULT", result: makeResult("a", true) });
  expect(s2).toBe(s1);
  expect(s2.index).toBe(1);
});
