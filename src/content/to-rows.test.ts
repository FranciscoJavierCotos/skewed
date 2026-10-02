import { toRows } from "./to-rows";
import type { QuestionFile } from "./schema";

const q: QuestionFile = {
  id: "sql-l1-0001", topic: "sql", level: 1, title: "T", prompt: "P", context: null, dialect: null,
  tags: ["x"], docs_url: null, status: "approved",
  options: [
    { code: "A", correct: false, explanation: "a" },
    { code: "B", correct: true, explanation: "b" },
    { code: "C", correct: false, explanation: "c" },
    { code: "D", correct: false, explanation: "d" },
  ],
};

it("maps a question to rows with positions and active flag", () => {
  const { question, options } = toRows(q);
  expect(question).toMatchObject({ id: "sql-l1-0001", topic: "sql", level: 1, active: true, tags: ["x"] });
  expect(question.content_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(options.map((o) => [o.position, o.is_correct])).toEqual([[0, false], [1, true], [2, false], [3, false]]);
  expect(options[0]).not.toHaveProperty("id"); // ids are DB-generated and stay stable across upserts
});

it("marks draft and retired questions inactive", () => {
  expect(toRows({ ...q, status: "draft" }).question.active).toBe(false);
  expect(toRows({ ...q, status: "retired" }).question.active).toBe(false);
});

it("hash changes when content changes", () => {
  expect(toRows(q).question.content_hash).not.toBe(toRows({ ...q, prompt: "P2" }).question.content_hash);
});

it("hash ignores status so retiring a question does not look like a content edit", () => {
  expect(toRows(q).question.content_hash).toBe(toRows({ ...q, status: "retired" }).question.content_hash);
});
