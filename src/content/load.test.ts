import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { stringify } from "yaml";
import { loadContent } from "./load";

const valid = (id = "sql-l1-0001", overrides: Record<string, unknown> = {}) => ({
  id, topic: "sql", level: 1, title: "Filter rows", prompt: "Pick the query.",
  options: [
    { code: "SELECT 1", correct: true, explanation: "right" },
    { code: "SELECT 2", correct: false, explanation: "wrong a" },
    { code: "SELECT 3", correct: false, explanation: "wrong b" },
    { code: "SELECT 4", correct: false, explanation: "wrong c" },
  ],
  tags: [], status: "approved", ...overrides,
});

function bank(files: Record<string, unknown>): string {
  const root = mkdtempSync(path.join(tmpdir(), "skewed-"));
  for (const [rel, obj] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), typeof obj === "string" ? obj : stringify(obj));
  }
  return root;
}

describe("loadContent", () => {
  it("loads a valid question", () => {
    const r = loadContent(bank({ "sql/level-1/sql-l1-0001.yaml": valid() }));
    expect(r.errors).toEqual([]);
    expect(r.questions).toHaveLength(1);
  });

  it("rejects zero or two correct options", () => {
    const q = valid();
    q.options[1].correct = true;
    const r = loadContent(bank({ "sql/level-1/sql-l1-0001.yaml": q }));
    expect(r.errors[0].message).toMatch(/exactly 1 correct option, found 2/);
  });

  it("rejects duplicate option code", () => {
    const q = valid();
    q.options[3].code = "SELECT 1";
    expect(loadContent(bank({ "sql/level-1/sql-l1-0001.yaml": q })).errors[0].message).toMatch(/unique/);
  });

  it("rejects missing explanation and wrong option count", () => {
    const q = valid();
    q.options[2].explanation = "";
    q.options.pop();
    const r = loadContent(bank({ "sql/level-1/sql-l1-0001.yaml": q }));
    expect(r.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("rejects folder/topic/level/filename mismatches", () => {
    const r = loadContent(bank({ "git/level-2/sql-l1-0001.yaml": valid() }));
    expect(r.errors.map((e) => e.message).join("\n")).toMatch(/folder/);
  });

  it("rejects dialect on non-sql topics", () => {
    const q = valid("spark-l1-0001", { topic: "spark", dialect: "postgres" });
    expect(loadContent(bank({ "spark/level-1/spark-l1-0001.yaml": q })).errors[0].message).toMatch(/dialect/);
  });

  it("rejects duplicate ids across files", () => {
    const r = loadContent(bank({
      "sql/level-1/sql-l1-0001.yaml": valid(),
      "sql/level-1/extra/sql-l1-0001.yaml": valid(),
    }));
    expect(r.errors.length).toBeGreaterThan(0);
  });

  it("reports invalid YAML without crashing", () => {
    const r = loadContent(bank({ "sql/level-1/sql-l1-0001.yaml": "id: [unclosed" }));
    expect(r.errors[0].message).toMatch(/invalid YAML/);
  });

  it("ignores non-yaml files like .gitkeep", () => {
    expect(loadContent(bank({ ".gitkeep": "" })).errors).toEqual([]);
  });
});
