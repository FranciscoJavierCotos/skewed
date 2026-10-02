import { initialSurvivalState as s0, survivalReducer as r, type SurvivalState } from "./survival";
import { makeQuestion, makeResult } from "./test-helpers";

function answerCorrect(s: SurvivalState, id: string): SurvivalState {
  s = r(s, { type: "QUESTION_LOADED", question: makeQuestion(id) });
  s = r(s, { type: "ANSWER_RESULT", result: makeResult(id, true) });
  return r(s, { type: "NEXT" });
}

it("ramps to level 2 after 5 correct and flags the level-up", () => {
  let s = s0;
  for (let i = 0; i < 4; i++) s = answerCorrect(s, `q${i}`);
  expect(s.level).toBe(1);
  s = r(s, { type: "QUESTION_LOADED", question: makeQuestion("q4") });
  s = r(s, { type: "ANSWER_RESULT", result: makeResult("q4", true) });
  expect(s).toMatchObject({ streak: 5, level: 2, maxLevel: 2, leveledUp: true, status: "feedback" });
});

it("one wrong answer ends the run and records the miss", () => {
  let s = answerCorrect(s0, "q0");
  const q = makeQuestion("q1");
  s = r(s, { type: "QUESTION_LOADED", question: q });
  s = r(s, { type: "ANSWER_RESULT", result: makeResult("q1", false) });
  expect(s).toMatchObject({ status: "over", streak: 1, missed: { question: q } });
});

it("caps at level 5", () => {
  let s = s0;
  for (let i = 0; i < 30; i++) s = answerCorrect(s, `q${i}`);
  expect(s.level).toBe(5);
});

it("ignores stale results", () => {
  const s = r(s0, { type: "QUESTION_LOADED", question: makeQuestion("q0") });
  expect(r(s, { type: "ANSWER_RESULT", result: makeResult("other", false) })).toBe(s);
});

it("POOL_EXHAUSTED only applies while loading", () => {
  expect(r(s0, { type: "POOL_EXHAUSTED" }).status).toBe("exhausted");
  const answering = r(s0, { type: "QUESTION_LOADED", question: makeQuestion("q0") });
  expect(r(answering, { type: "POOL_EXHAUSTED" })).toBe(answering);
});

it("NEXT clears the level-up flag on the following question and tracks seen ids", () => {
  let s = s0;
  for (let i = 0; i < 5; i++) s = answerCorrect(s, `q${i}`);
  expect(s).toMatchObject({ status: "loading", current: null, leveledUp: true });
  s = r(s, { type: "QUESTION_LOADED", question: makeQuestion("q5") });
  expect(s.leveledUp).toBe(false);
  expect(s.seenIds).toEqual(["q0", "q1", "q2", "q3", "q4", "q5"]);
  expect(r(s, { type: "NEXT" })).toBe(s); // ignored outside feedback
});

it("ignores events once the run is over", () => {
  let s = r(s0, { type: "QUESTION_LOADED", question: makeQuestion("q0") });
  s = r(s, { type: "ANSWER_RESULT", result: makeResult("q0", false) });
  expect(r(s, { type: "ANSWER_RESULT", result: makeResult("q0", true) })).toBe(s);
  expect(r(s, { type: "QUESTION_LOADED", question: makeQuestion("q1") })).toBe(s);
  expect(r(s, { type: "NEXT" })).toBe(s);
});
