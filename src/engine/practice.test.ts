import { initialPracticeState as s0, practiceReducer as r } from "./practice";
import { makeQuestion, makeResult } from "./test-helpers";

const q1 = makeQuestion("q1");

it("loads, answers, shows feedback, then loads next", () => {
  let s = r(s0, { type: "QUESTION_LOADED", question: q1 });
  expect(s.status).toBe("answering");
  s = r(s, { type: "ANSWER_RESULT", result: makeResult("q1", true) });
  expect(s).toMatchObject({ status: "feedback", answered: 1, correct: 1, seenIds: ["q1"] });
  s = r(s, { type: "NEXT" });
  expect(s).toMatchObject({ status: "loading", current: null });
});

it("ignores a result for a question that is not current (stale/duplicate)", () => {
  let s = r(s0, { type: "QUESTION_LOADED", question: q1 });
  s = r(s, { type: "ANSWER_RESULT", result: makeResult("q1", false) });
  const again = r(s, { type: "ANSWER_RESULT", result: makeResult("q1", true) });
  expect(again).toBe(s);
  expect(r(r(s0, { type: "QUESTION_LOADED", question: q1 }), { type: "ANSWER_RESULT", result: makeResult("zz", true) }).status).toBe("answering");
});

it("goes to exhausted when the pool is empty", () => {
  expect(r(s0, { type: "POOL_EXHAUSTED" }).status).toBe("exhausted");
});

it("END from any active state ends the session", () => {
  expect(r(r(s0, { type: "QUESTION_LOADED", question: q1 }), { type: "END" }).status).toBe("ended");
});
