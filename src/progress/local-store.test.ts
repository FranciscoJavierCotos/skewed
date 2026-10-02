import { LocalProgressStore } from "./local-store";
import type { Level } from "@/domain/types";
import type { SessionSummary } from "./store";

const survival = (streak: number, level: Level = 2): SessionSummary => ({
  mode: "survival", topics: ["sql", "git"], level, answered: streak + 1, correct: streak,
  streak, finishedAt: new Date().toISOString(),
});
const exam = (correct: number, answered = 10): SessionSummary => ({
  mode: "exam", topics: ["spark"], level: 3, answered, correct, streak: null, finishedAt: new Date().toISOString(),
});

beforeEach(() => localStorage.clear());

it("tracks survival best streak per topic set (order-insensitive) and level", () => {
  const s = new LocalProgressStore(localStorage);
  expect(s.recordSession(survival(3)).newBest).toBe(true);
  expect(s.recordSession(survival(2)).newBest).toBe(false);
  expect(s.getPersonalBest("survival", "git+sql@2")).toBe(3);
  expect(new LocalProgressStore(localStorage).getPersonalBest("survival", "git+sql@2")).toBe(3); // persisted
  expect(s.recordSession(survival(1, 3)).newBest).toBe(true); // separate best per level
  expect(s.getPersonalBest("survival", "git+sql@3")).toBe(1);
});

it("tracks exam best percentage", () => {
  const s = new LocalProgressStore(localStorage);
  s.recordSession(exam(7));
  expect(s.recordSession(exam(9)).newBest).toBe(true);
  expect(s.getPersonalBest("exam", "spark")).toBe(90);
});

it("caps history at 200, newest first", () => {
  const s = new LocalProgressStore(localStorage);
  for (let i = 0; i < 205; i++) s.recordSession(exam(i % 10));
  expect(s.getHistory(1000)).toHaveLength(200);
  expect(s.getHistory(2).map((h) => h.correct)).toEqual([4, 3]);
});

it("resets on corrupt JSON instead of crashing", () => {
  localStorage.setItem("skewed:v1:progress", "{not json");
  const s = new LocalProgressStore(localStorage);
  expect(s.getHistory(10)).toEqual([]);
  expect(s.recordSession(exam(5)).newBest).toBe(true);
});

it("works in memory when storage is unavailable", () => {
  const s = new LocalProgressStore(null);
  expect(s.persistent).toBe(false);
  s.recordSession(survival(4));
  expect(s.getPersonalBest("survival", "git+sql@2")).toBe(4);
});

it("survives a storage that throws on write (quota/private mode)", () => {
  const throwing = { getItem: () => null, setItem: () => { throw new Error("QuotaExceeded"); }, removeItem() {}, clear() {}, key: () => null, length: 0 } as Storage;
  expect(() => new LocalProgressStore(throwing).recordSession(exam(5))).not.toThrow();
});
