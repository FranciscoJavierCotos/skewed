import { flagQuestions, type QuestionStat } from "./flagged";

const stat = (over: Partial<QuestionStat>): QuestionStat => ({
  id: "git-l1-0001",
  topic: "git",
  level: 1,
  title: "T",
  attempts: 0,
  accuracy_pct: null,
  open_reports: 0,
  ...over,
});

describe("flagQuestions", () => {
  it("flags open reports regardless of attempts", () => {
    expect(flagQuestions([stat({ open_reports: 1 })]).map((s) => s.id)).toEqual(["git-l1-0001"]);
  });

  it("flags accuracy below 25% or above 95% once attempts reach 20", () => {
    const rows = [
      stat({ id: "low", attempts: 20, accuracy_pct: 24.9 }),
      stat({ id: "high", attempts: 20, accuracy_pct: 95.1 }),
      stat({ id: "edge-low", attempts: 20, accuracy_pct: 25 }),
      stat({ id: "edge-high", attempts: 20, accuracy_pct: 95 }),
    ];
    expect(flagQuestions(rows).map((s) => s.id).sort()).toEqual(["high", "low"]);
  });

  it("ignores extreme accuracy with fewer than 20 attempts", () => {
    expect(flagQuestions([stat({ attempts: 19, accuracy_pct: 0 })])).toEqual([]);
  });

  it("parses numeric columns that PostgREST returns as strings", () => {
    const row = { ...stat({}), attempts: "30", accuracy_pct: "10.0", open_reports: "0" } as unknown as QuestionStat;
    expect(flagQuestions([row])).toHaveLength(1);
  });

  it("sorts by open reports, then by distance from the healthy band", () => {
    const rows = [
      stat({ id: "a", attempts: 40, accuracy_pct: 20 }),
      stat({ id: "b", attempts: 40, accuracy_pct: 2 }),
      stat({ id: "c", open_reports: 3 }),
      stat({ id: "d", open_reports: 1 }),
    ];
    expect(flagQuestions(rows).map((s) => s.id)).toEqual(["c", "d", "b", "a"]);
  });
});
