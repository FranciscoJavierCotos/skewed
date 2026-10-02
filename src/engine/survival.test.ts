import { initialSurvivalState, nextSurvivalLevel, survivalReducer as r, type SurvivalState } from "./survival";
import { makeQuestion, makeResult } from "./test-helpers";

const s0 = initialSurvivalState(3);

function answerCorrect(s: SurvivalState, id: string): SurvivalState {
  s = r(s, { type: "QUESTION_LOADED", question: makeQuestion(id, { level: 3 }) });
  s = r(s, { type: "ANSWER_RESULT", result: makeResult(id, true) });
  return r(s, { type: "NEXT" });
}

it("stays at the chosen level however long the streak", () => {
  let s = s0;
  for (let i = 0; i < 12; i++) s = answerCorrect(s, `q${i}`);
  expect(s).toMatchObject({ level: 3, streak: 12, status: "loading" });
});

it("one wrong answer ends the run and records the miss", () => {
  let s = answerCorrect(s0, "q0");
  const q = makeQuestion("q1");
  s = r(s, { type: "QUESTION_LOADED", question: q });
  s = r(s, { type: "ANSWER_RESULT", result: makeResult("q1", false) });
  expect(s).toMatchObject({ status: "over", streak: 1, missed: { question: q } });
});

it("running out of the level's questions clears it (game over)", () => {
  const s = r(answerCorrect(answerCorrect(s0, "q0"), "q1"), { type: "POOL_EXHAUSTED" });
  expect(s).toMatchObject({ status: "cleared", streak: 2, missed: null });
});

it("POOL_EXHAUSTED only applies while loading", () => {
  const answering = r(s0, { type: "QUESTION_LOADED", question: makeQuestion("q0") });
  expect(r(answering, { type: "POOL_EXHAUSTED" })).toBe(answering);
});

it("tracks seen ids and ignores NEXT outside feedback", () => {
  let s = answerCorrect(answerCorrect(s0, "q0"), "q1");
  s = r(s, { type: "QUESTION_LOADED", question: makeQuestion("q2") });
  expect(s.seenIds).toEqual(["q0", "q1", "q2"]);
  expect(r(s, { type: "NEXT" })).toBe(s);
});

it("ignores stale results", () => {
  const s = r(s0, { type: "QUESTION_LOADED", question: makeQuestion("q0") });
  expect(r(s, { type: "ANSWER_RESULT", result: makeResult("other", false) })).toBe(s);
});

it("ignores events once the run is over", () => {
  let s = r(s0, { type: "QUESTION_LOADED", question: makeQuestion("q0") });
  s = r(s, { type: "ANSWER_RESULT", result: makeResult("q0", false) });
  expect(r(s, { type: "ANSWER_RESULT", result: makeResult("q0", true) })).toBe(s);
  expect(r(s, { type: "QUESTION_LOADED", question: makeQuestion("q1") })).toBe(s);
  expect(r(s, { type: "NEXT" })).toBe(s);
});

it("offers the next level up to 5", () => {
  expect(nextSurvivalLevel(1)).toBe(2);
  expect(nextSurvivalLevel(5)).toBeNull();
});
