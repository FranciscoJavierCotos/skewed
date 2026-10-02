// Generates the e2e fixture bank (6 sql level-1 + 2 sql level-2). Run once and commit the output.
// The fixtures are served to Playwright through a mocked RPC layer; never `pnpm seed` them into production.
import { mkdirSync, writeFileSync } from "node:fs";
import { stringify } from "yaml";

const make = (level: number, n: number) => {
  const id = `sql-l${level}-${String(n).padStart(4, "0")}`;
  const dir = `fixtures/content/sql/level-${level}`;
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/${id}.yaml`, stringify({
    id, topic: "sql", level, title: `Fixture ${id}`, prompt: `Fixture prompt for ${id}.`,
    options: [
      { code: `SELECT 'right-${id}';`, correct: true, explanation: `Explanation right ${id}` },
      { code: `SELECT 'nope-${id}-1';`, correct: false, explanation: `Explanation nope 1 ${id}` },
      { code: `SELECT 'nope-${id}-2';`, correct: false, explanation: `Explanation nope 2 ${id}` },
      { code: `SELECT 'nope-${id}-3';`, correct: false, explanation: `Explanation nope 3 ${id}` },
    ],
    tags: ["fixture"], docs_url: null, status: "approved",
  }));
};
for (let i = 1; i <= 6; i++) make(1, i);
for (let i = 1; i <= 2; i++) make(2, i);
