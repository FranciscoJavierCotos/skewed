# Skewed MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Each task maps 1:1 to a GitHub issue.** Branch per issue (`feat/<issue#>-slug`), Conventional Commits, PR closes the issue.

**Goal:** Ship a guest-playable web quiz where data engineers answer PySpark/SQL/Git questions (4 code options, 5 levels) in Practice, Exam and Survival modes. It is backed by a Supabase question bank with anonymous telemetry and deployed on Vercel.

**Architecture:**
- Questions are authored as YAML in `content/`, validated by a Zod schema, and seeded into Supabase Postgres.
- The browser never reads tables directly. It calls three `SECURITY DEFINER` RPCs: `get_questions` (no answers), `submit_answer` (logs an event and returns correctness and explanations) and `report_question`.
- Game logic is a set of pure reducers in `src/engine/`.
- React pages are thin adapters that wire the reducers to a `QuizApi` and a `ProgressStore` (localStorage).

**Tech Stack:** Next.js (App Router) + TypeScript strict + Tailwind, Supabase (Postgres, RLS, pgTAP), Zod 4, `yaml`, Shiki, react-markdown, Vitest + React Testing Library, Playwright, pnpm, GitHub Actions, Vercel.

**Spec:** `docs/superpowers/specs/2026-10-02-skewed-design.md`

## Global Constraints

- Topics: exactly `spark` (PySpark only), `sql` (PostgreSQL 17 only), `git`.
- Levels are integers 1–5. "Mixed" means `level = null` in RPC calls.
- Every question has **exactly 4 code options, exactly 1 correct**, and an explanation on every option.
- Question ids match `^(spark|sql|git)-l[1-5]-\d{4}$`, equal the filename, and live at `content/{topic}/level-{n}/{id}.yaml`.
- The `anon` role has **no direct table privileges**. All access goes through RPCs with `set search_path = ''`.
- `get_questions` never returns `is_correct`, explanations or `docs_url`. `p_limit` is clamped to 1–50.
- Report rate limit: 10 per `anon_id` per hour. Report note ≤ 500 chars.
- Exam lengths are 10/20/40. The exam timer is 60 s/question, off by default. A timeout counts as unanswered (wrong).
- Survival starts at L1 and goes up a level every 5 correct answers (cap 5). One wrong answer ends the run. Recycling at L5 excludes the 20 most recent ids.
- localStorage keys are prefixed `skewed:v1:`. History is capped at 200 sessions.
- All UI copy comes from `src/messages/en.json`. Content language is English only.
- Env vars:
  - app: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`;
  - scripts: `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.

## Review Focus

1. **Double submit / timer race.** If the user clicks an option at the same moment the Exam timer fires, or double-clicks, exactly one answer counts and the exam advances by one question. Tests: Task 6 (stale `ANSWER_RESULT` ignored) and Task 9 (submitter ignores a second submit while one is in flight).
2. **Network failure on submit.** The answer isn't lost: the user sees "Retry", and the retry reuses the same `client_event_id`, so the server logs one event. Tests: Task 3 (pgTAP duplicate `client_event_id` → 1 row) and Task 9 (retry resends identical params).
3. **Corrupt or blocked localStorage** (private mode, hand-edited JSON). The app still plays, the store resets to empty, and personal bests show "not saved". Test: Task 8.
4. **Selection smaller than requested** (e.g. Git L5 has 3 questions and the user picks a 10-question exam). The exam runs with 3 questions and says "only 3 available". An empty selection shows the empty state. Tests: Task 6 (`shortBy`, `empty`) and Task 16 (e2e).
5. **Refresh mid-exam.** The browser asks "Leave page?" before the exam is lost. Test: Task 14 (the `beforeunload` handler is registered only while answering).

---

## File Structure

```
content/{spark,sql,git}/level-{1..5}/*.yaml      # question bank (Task 17–19)
fixtures/content/sql/level-{1,2}/*.yaml          # e2e fixture bank (Task 16)
supabase/migrations/20261002000000_init.sql      # schema, RLS, RPCs (Task 3)
supabase/migrations/20261002000100_question_stats.sql  # (Task 20)
supabase/migrations/20261002230000_drop_question_dialect.sql  # (#47)
supabase/tests/database/rpc.test.sql             # pgTAP (Task 3)
scripts/validate-content.ts                      # CLI (Task 2)
scripts/seed-content.ts                          # CLI (Task 4)
scripts/flagged-questions.ts                     # CLI (Task 20)
scripts/gen-fixtures.ts                          # one-off generator (Task 16)
scripts/local-supabase-env.sh                    # env helper (Task 3)
src/domain/types.ts                              # shared types/constants (Task 2)
src/content/schema.ts, load.ts, to-rows.ts       # content model (Task 2, 4)
src/engine/shared.ts, session-config.ts          # primitives (Task 5)
src/engine/practice.ts, exam.ts, survival.ts     # reducers (Task 5–7)
src/progress/store.ts, local-store.ts, anon-id.ts # guest progress (Task 8)
src/api/quiz-api.ts, supabase-quiz-api.ts        # API boundary (Task 9)
src/game/use-answer-submitter.ts, services.tsx   # React glue (Task 9, 12)
src/lib/highlight.ts                             # Shiki singleton (Task 10)
src/components/quiz/*.tsx                        # QuestionView, CodeBlock, ReportDialog (Task 10–11)
src/app/**                                       # pages (Task 12–15)
src/messages/en.json                             # UI copy
e2e/*.spec.ts, playwright.config.ts              # e2e (Task 16)
.github/workflows/ci.yml, deploy.yml             # CI/CD (Task 1, 16, 21)
docs/content-guide.md                            # authoring guide (Task 17)
```

---

# Milestone M1 — Foundation

### Task 1: Scaffold Next.js app with tooling and CI

**Files:**
- Create: the Next.js scaffold, `vitest.config.ts`, `vitest.setup.ts`, `src/messages/en.json`, `.github/workflows/ci.yml`, `README.md`, `.nvmrc`, `content/.gitkeep`
- Test: `src/smoke.test.ts`

**Interfaces:**
- Produces: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, the `@/*` → `src/*` alias, and the `en` messages JSON importable as `import en from "@/messages/en.json"`.

- [ ] **Step 1: Scaffold.** From the repo root (only `docs/` and `.git` exist, which create-next-app allows):

```bash
pnpm create next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-pnpm --yes
pnpm add zod yaml @supabase/supabase-js shiki react-markdown
pnpm add -D vitest @vitejs/plugin-react vite-tsconfig-paths jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event tsx
echo "22" > .nvmrc
mkdir -p content && touch content/.gitkeep
```

- [ ] **Step 2: Configure Vitest.** `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}", "scripts/**/*.test.ts"],
    exclude: ["e2e/**", "node_modules/**"],
  },
});
```

`vitest.setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

In `tsconfig.json` `compilerOptions`, add `"types": ["vitest/globals"]` so `it`, `expect` and `vi` need no imports.

- [ ] **Step 3: Add scripts to `package.json`:**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "content:validate": "tsx scripts/validate-content.ts content",
    "seed": "tsx scripts/seed-content.ts",
    "content:flagged": "tsx scripts/flagged-questions.ts",
    "e2e": "playwright test"
  }
}
```

(The `content:*`, `seed` and `e2e` scripts start working in later tasks. Leave them in now so CI config doesn't churn.)

- [ ] **Step 4: Write a smoke test.** `src/smoke.test.ts`:

```ts
import en from "@/messages/en.json";

it("loads UI messages", () => {
  expect(en.app.name).toBe("Skewed");
});
```

`src/messages/en.json` (later tasks add keys to it):

```json
{
  "app": { "name": "Skewed", "tagline": "Data engineering drills: PySpark, SQL & Git" }
}
```

- [ ] **Step 5: Run.** `pnpm test`. Expected: 1 passed. Then `pnpm lint && pnpm typecheck && pnpm build`. Expected: all succeed.

- [ ] **Step 6: CI.** `.github/workflows/ci.yml`:

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test
      - run: pnpm build
        env:
          NEXT_PUBLIC_SUPABASE_URL: http://127.0.0.1:54321
          NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: ci-placeholder
```

Add `"packageManager": "pnpm@11.2.2"` to `package.json` so `pnpm/action-setup` picks the version.

- [ ] **Step 7: README.** Replace the generated README with: the project pitch (one paragraph), a link to the spec and plan, local setup (`pnpm i`, `supabase start`, `bash scripts/local-supabase-env.sh > .env.local`, `pnpm seed content`, `pnpm dev`), and the scripts table.

- [ ] **Step 8: Commit.** `git add -A && git commit -m "chore: scaffold Next.js app with vitest and CI"`

---

### Task 2: Domain types, content schema and validator CLI

**Files:**
- Create: `src/domain/types.ts`, `src/content/schema.ts`, `src/content/load.ts`, `scripts/validate-content.ts`
- Test: `src/content/load.test.ts`

**Interfaces:**
- Produces:
  - `TOPICS`, `Topic`, `LEVELS`, `Level`, `Mode`, `EXAM_LENGTHS`, `ExamLength`, `REPORT_REASONS`, `ReportReason`, `isTopic(s)`, `isLevel(n)`
  - `PublicOption`, `PublicQuestion`, `AnswerResult`, `SessionConfig`
  - `QuestionFileSchema`, `QuestionFile`
  - `loadContent(rootDir): { questions: LoadedQuestion[]; errors: ContentError[] }`

- [ ] **Step 1: Domain types.** `src/domain/types.ts`:

```ts
export const TOPICS = ["spark", "sql", "git"] as const;
export type Topic = (typeof TOPICS)[number];
export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];
export type Mode = "practice" | "exam" | "survival";
export const EXAM_LENGTHS = [10, 20, 40] as const;
export type ExamLength = (typeof EXAM_LENGTHS)[number];
export const EXAM_TIMER_SECONDS = 60;
export const REPORT_REASONS = ["wrong_answer", "ambiguous", "typo", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];

export const isTopic = (s: string): s is Topic => (TOPICS as readonly string[]).includes(s);
export const isLevel = (n: unknown): n is Level =>
  typeof n === "number" && (LEVELS as readonly number[]).includes(n);

export interface PublicOption { id: string; code: string }

export interface PublicQuestion {
  id: string;
  topic: Topic;
  level: Level;
  title: string;
  prompt: string;
  context: string | null;
  tags: string[];
  options: PublicOption[];
}

export interface AnswerResult {
  questionId: string;
  chosenOptionId: string | null; // null = timed out
  correct: boolean;
  correctOptionId: string;
  explanations: Record<string, string>; // optionId -> explanation
  docsUrl: string | null;
}

export interface SessionConfig {
  mode: Mode;
  topics: Topic[];
  level: Level | "mixed"; // ignored by survival
  examLength: ExamLength;
  timerSeconds: number | null;
}
```

- [ ] **Step 2: Write the failing loader tests.** `src/content/load.test.ts`:

```ts
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

  it("rejects unknown keys, including the removed dialect", () => {
    const q = valid("sql-l1-0001", { dialect: "postgres" });
    expect(loadContent(bank({ "sql/level-1/sql-l1-0001.yaml": q })).errors[0].message).toMatch(/dialect/);
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
```

- [ ] **Step 3: Run.** `pnpm vitest run src/content`. Expected: FAIL with "Cannot find module './load'".

- [ ] **Step 4: Schema.** `src/content/schema.ts`:

```ts
import { z } from "zod";
import { TOPICS } from "@/domain/types";

const OptionSchema = z.object({
  code: z.string().trim().min(1, "option code is required"),
  correct: z.boolean(),
  explanation: z.string().trim().min(1, "every option needs an explanation"),
});

export const QuestionFileSchema = z
  .strictObject({
    id: z.string().regex(/^(spark|sql|git)-l[1-5]-\d{4}$/, "id must look like sql-l3-0007"),
    topic: z.enum(TOPICS),
    level: z.number().int().min(1).max(5),
    title: z.string().trim().min(1).max(120),
    prompt: z.string().trim().min(1),
    context: z.string().trim().min(1).nullish(),
    options: z.array(OptionSchema).length(4, "exactly 4 options required"),
    tags: z.array(z.string()).default([]),
    docs_url: z.url().nullish(),
    status: z.enum(["draft", "approved", "retired"]),
  })
  .superRefine((q, ctx) => {
    const correct = q.options.filter((o) => o.correct).length;
    if (correct !== 1)
      ctx.addIssue({ code: "custom", path: ["options"], message: `expected exactly 1 correct option, found ${correct}` });
    if (new Set(q.options.map((o) => o.code.trim())).size !== q.options.length)
      ctx.addIssue({ code: "custom", path: ["options"], message: "option code must be unique" });
    if (!q.id.startsWith(`${q.topic}-l${q.level}-`))
      ctx.addIssue({ code: "custom", path: ["id"], message: "id prefix must match topic and level" });
  });

export type QuestionFile = z.infer<typeof QuestionFileSchema>;
```

- [ ] **Step 5: Loader.** `src/content/load.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { QuestionFileSchema, type QuestionFile } from "./schema";

export interface LoadedQuestion { file: string; question: QuestionFile }
export interface ContentError { file: string; message: string }

const LOCATION = /^(spark|sql|git)\/level-([1-5])\/([^/]+)\.yaml$/;

export function loadContent(rootDir: string): { questions: LoadedQuestion[]; errors: ContentError[] } {
  const questions: LoadedQuestion[] = [];
  const errors: ContentError[] = [];
  const seen = new Map<string, string>();
  const files = readdirSync(rootDir, { recursive: true, encoding: "utf8" })
    .map((f) => f.split(path.sep).join("/"))
    .filter((f) => f.endsWith(".yaml"))
    .sort();

  for (const file of files) {
    const fail = (message: string) => errors.push({ file, message });
    let raw: unknown;
    try {
      raw = parse(readFileSync(path.join(rootDir, file), "utf8"));
    } catch (e) {
      fail(`invalid YAML: ${(e as Error).message}`);
      continue;
    }
    const parsed = QuestionFileSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) fail(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
      continue;
    }
    const q = parsed.data;
    const before = errors.length;
    const loc = file.match(LOCATION);
    if (!loc || loc[1] !== q.topic || Number(loc[2]) !== q.level)
      fail(`folder must be ${q.topic}/level-${q.level}/`);
    else if (loc[3] !== q.id) fail(`filename must be ${q.id}.yaml`);
    const prev = seen.get(q.id);
    if (prev) fail(`duplicate id ${q.id} (also in ${prev})`);
    else seen.set(q.id, file);
    if (errors.length === before) questions.push({ file, question: q });
  }
  return { questions, errors };
}
```

- [ ] **Step 6: CLI.** `scripts/validate-content.ts`:

```ts
import { loadContent } from "../src/content/load";

const dir = process.argv[2] ?? "content";
const { questions, errors } = loadContent(dir);
for (const e of errors) console.error(`✖ ${e.file}: ${e.message}`);
const byStatus = Object.groupBy(questions, (q) => q.question.status);
console.log(
  `${questions.length} valid (${byStatus.approved?.length ?? 0} approved, ${byStatus.draft?.length ?? 0} draft, ` +
    `${byStatus.retired?.length ?? 0} retired), ${errors.length} errors`,
);
process.exit(errors.length ? 1 : 0);
```

- [ ] **Step 7: Run.** `pnpm vitest run src/content` → all pass. `pnpm content:validate` → `0 valid (...), 0 errors`, exit 0. Add `- run: pnpm content:validate` after `pnpm test` in `.github/workflows/ci.yml`.

- [ ] **Step 8: Commit.** `git commit -am "feat(content): question schema, loader and validator CLI"` (run `git add` first for the new files).

---

### Task 3: Database schema, RLS and RPCs with pgTAP tests

**Files:**
- Create: `supabase/config.toml` (via `supabase init`), `supabase/migrations/20261002000000_init.sql`, `supabase/tests/database/rpc.test.sql`, `scripts/local-supabase-env.sh`
- Modify: `.gitignore` (add `.env.local`, `supabase/.temp`)

**Interfaces:**
- Produces these RPCs:
  - `get_questions(p_topics text[], p_level int, p_exclude text[], p_limit int) → jsonb`: an array of `{id, topic, level, title, prompt, context, tags, options:[{id, code}]}`.
  - `submit_answer(p_client_event_id uuid, p_anon_id uuid, p_session_id uuid, p_question_id text, p_option_id uuid, p_mode text, p_ms int) → jsonb`: `{correct, correct_option_id, explanations: {optionId: text}, docs_url}`.
  - `report_question(p_anon_id uuid, p_question_id text, p_reason text, p_note text) → void`. Raises with hint `rate_limited`.

- [ ] **Step 1: Init.** Run `pnpm dlx supabase init` (answer "no" to the VS Code settings prompts). Then `pnpm dlx supabase start` (needs Docker).

- [ ] **Step 2: Write the failing pgTAP test.** `supabase/tests/database/rpc.test.sql`:

```sql
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into public.questions (id, topic, level, title, prompt, docs_url, content_hash) values
  ('sql-l1-9001', 'sql', 1, 'Q1', 'P1', 'https://docs.example/q1', 'h1'),
  ('sql-l1-9002', 'sql', 1, 'Q2', 'P2', null, 'h2');
insert into public.question_options (id, question_id, position, code, is_correct, explanation) values
  ('00000000-0000-0000-0000-000000000011', 'sql-l1-9001', 0, 'SELECT 11', true,  'SECRET_EXPLANATION_11'),
  ('00000000-0000-0000-0000-000000000012', 'sql-l1-9001', 1, 'SELECT 12', false, 'SECRET_EXPLANATION_12'),
  ('00000000-0000-0000-0000-000000000013', 'sql-l1-9001', 2, 'SELECT 13', false, 'SECRET_EXPLANATION_13'),
  ('00000000-0000-0000-0000-000000000014', 'sql-l1-9001', 3, 'SELECT 14', false, 'SECRET_EXPLANATION_14'),
  ('00000000-0000-0000-0000-000000000021', 'sql-l1-9002', 0, 'SELECT 21', true,  'SECRET_EXPLANATION_21'),
  ('00000000-0000-0000-0000-000000000022', 'sql-l1-9002', 1, 'SELECT 22', false, 'SECRET_EXPLANATION_22'),
  ('00000000-0000-0000-0000-000000000023', 'sql-l1-9002', 2, 'SELECT 23', false, 'SECRET_EXPLANATION_23'),
  ('00000000-0000-0000-0000-000000000024', 'sql-l1-9002', 3, 'SELECT 24', false, 'SECRET_EXPLANATION_24');

set local role anon;

select throws_ok($$ select * from public.question_options $$, '42501', null, 'anon cannot read question_options');
select throws_ok($$ select * from public.answer_events $$, '42501', null, 'anon cannot read answer_events');

select is(jsonb_array_length(public.get_questions(array['sql'], 1, null, 10)), 2, 'get_questions returns active questions');
select ok(
  position('SECRET' in public.get_questions(array['sql'], 1, null, 10)::text) = 0
  and position('is_correct' in public.get_questions(array['sql'], 1, null, 10)::text) = 0
  and position('docs.example' in public.get_questions(array['sql'], 1, null, 10)::text) = 0,
  'get_questions leaks no answers, explanations or docs');
select is(jsonb_array_length(public.get_questions(array['sql'], 1, array['sql-l1-9001'], 10)), 1, 'exclude works');

select is(
  (public.submit_answer('10000000-0000-0000-0000-000000000001', gen_random_uuid(), gen_random_uuid(),
     'sql-l1-9001', '00000000-0000-0000-0000-000000000011', 'practice', 1200) ->> 'correct')::boolean,
  true, 'correct option is graded correct');

select throws_ok(
  $$ select public.submit_answer(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
       'sql-l1-9001', '00000000-0000-0000-0000-000000000021', 'practice', 10) $$,
  '22023', null, 'option from another question is rejected');

select is(
  (public.submit_answer(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
     'sql-l1-9001', null, 'exam', 60000) ->> 'correct')::boolean,
  false, 'timeout (null option) is graded wrong');

-- idempotent retry: same client_event_id twice -> one row
select public.submit_answer('10000000-0000-0000-0000-000000000002', gen_random_uuid(), gen_random_uuid(),
  'sql-l1-9002', '00000000-0000-0000-0000-000000000021', 'survival', 5);
select public.submit_answer('10000000-0000-0000-0000-000000000002', gen_random_uuid(), gen_random_uuid(),
  'sql-l1-9002', '00000000-0000-0000-0000-000000000021', 'survival', 5);
reset role;
select is((select count(*)::int from public.answer_events
           where client_event_id = '10000000-0000-0000-0000-000000000002'), 1, 'retries are idempotent');
set local role anon;

select public.report_question('20000000-0000-0000-0000-000000000001', 'sql-l1-9001', 'typo', 'n')
  from generate_series(1, 10);
select throws_ok(
  $$ select public.report_question('20000000-0000-0000-0000-000000000001', 'sql-l1-9001', 'typo', 'n') $$,
  'P0001', 'rate limit exceeded', '11th report in an hour is rejected');

select * from finish();
rollback;
```

- [ ] **Step 3: Run.** `pnpm dlx supabase test db`. Expected: FAIL (relation `public.questions` does not exist).

- [ ] **Step 4: Migration.** Create it with `pnpm dlx supabase migration new init`, rename the file to `20261002000000_init.sql`, and fill it in:

```sql
create table public.questions (
  id text primary key,
  topic text not null check (topic in ('spark', 'sql', 'git')),
  level int not null check (level between 1 and 5),
  title text not null,
  prompt text not null,
  context text,
  dialect text,
  tags text[] not null default '{}',
  docs_url text,
  active boolean not null default true,
  content_hash text not null,
  updated_at timestamptz not null default now()
);
create index questions_pool_idx on public.questions (topic, level) where active;

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions (id),
  position int not null check (position between 0 and 3),
  code text not null,
  is_correct boolean not null,
  explanation text not null,
  unique (question_id, position)
);

create table public.answer_events (
  id bigserial primary key,
  client_event_id uuid not null unique,
  anon_id uuid not null,
  session_id uuid not null,
  question_id text not null references public.questions (id),
  option_id uuid references public.question_options (id),
  correct boolean not null,
  mode text not null check (mode in ('practice', 'exam', 'survival')),
  ms_to_answer int check (ms_to_answer >= 0),
  created_at timestamptz not null default now()
);
create index answer_events_question_idx on public.answer_events (question_id);

create table public.question_reports (
  id bigserial primary key,
  anon_id uuid not null,
  question_id text not null references public.questions (id),
  reason text not null check (reason in ('wrong_answer', 'ambiguous', 'typo', 'other')),
  note text check (char_length(note) <= 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index question_reports_rate_idx on public.question_reports (anon_id, created_at);

alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.answer_events enable row level security;
alter table public.question_reports enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

create or replace function public.get_questions(p_topics text[], p_level int, p_exclude text[], p_limit int)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.obj), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', q.id, 'topic', q.topic, 'level', q.level, 'title', q.title, 'prompt', q.prompt,
      'context', q.context, 'dialect', q.dialect, 'tags', to_jsonb(q.tags),
      'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'code', o.code) order by o.position)
                  from public.question_options o where o.question_id = q.id)
    ) as obj
    from public.questions q
    where q.active
      and q.topic = any (p_topics)
      and (p_level is null or q.level = p_level)
      and not (q.id = any (coalesce(p_exclude, '{}')))
    order by random()
    limit least(greatest(coalesce(p_limit, 1), 1), 50)
  ) x;
$$;

create or replace function public.submit_answer(
  p_client_event_id uuid, p_anon_id uuid, p_session_id uuid,
  p_question_id text, p_option_id uuid, p_mode text, p_ms int)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_correct_id uuid;
  v_correct boolean;
begin
  select o.id into v_correct_id
  from public.question_options o
  join public.questions q on q.id = o.question_id
  where o.question_id = p_question_id and o.is_correct and q.active;
  if v_correct_id is null then
    raise exception 'unknown question %', p_question_id using errcode = 'P0002';
  end if;
  if p_option_id is not null and not exists (
    select 1 from public.question_options where id = p_option_id and question_id = p_question_id) then
    raise exception 'option does not belong to question' using errcode = '22023';
  end if;
  v_correct := p_option_id is not distinct from v_correct_id;
  insert into public.answer_events (client_event_id, anon_id, session_id, question_id, option_id, correct, mode, ms_to_answer)
  values (p_client_event_id, p_anon_id, p_session_id, p_question_id, p_option_id, v_correct, p_mode, greatest(coalesce(p_ms, 0), 0))
  on conflict (client_event_id) do nothing;
  return jsonb_build_object(
    'correct', v_correct,
    'correct_option_id', v_correct_id,
    'explanations', (select jsonb_object_agg(o.id, o.explanation) from public.question_options o where o.question_id = p_question_id),
    'docs_url', (select q.docs_url from public.questions q where q.id = p_question_id));
end;
$$;

create or replace function public.report_question(p_anon_id uuid, p_question_id text, p_reason text, p_note text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  if (select count(*) from public.question_reports
      where anon_id = p_anon_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate limit exceeded' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.question_reports (anon_id, question_id, reason, note)
  values (p_anon_id, p_question_id, p_reason, nullif(btrim(left(p_note, 500)), ''));
end;
$$;

revoke execute on function public.get_questions, public.submit_answer, public.report_question from public;
grant execute on function public.get_questions, public.submit_answer, public.report_question to anon, authenticated, service_role;
```

- [ ] **Step 5: Run.** `pnpm dlx supabase db reset && pnpm dlx supabase test db`. Expected: `rpc.test.sql .. ok`, all 10 pass.

- [ ] **Step 6: Env helper.** `scripts/local-supabase-env.sh`:

```bash
#!/usr/bin/env bash
# Prints env vars for the local Supabase stack. Usage: bash scripts/local-supabase-env.sh > .env.local
set -euo pipefail
eval "$(${SUPABASE_BIN:-pnpm dlx supabase} status -o env)"
cat <<EOF
NEXT_PUBLIC_SUPABASE_URL=$API_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$ANON_KEY
SUPABASE_URL=$API_URL
SUPABASE_SECRET_KEY=$SERVICE_ROLE_KEY
EOF
```

Append `.env.local` and `supabase/.temp` to `.gitignore`.

- [ ] **Step 7: Run the Supabase security advisor.** Run `pnpm dlx supabase db lint`. Expected: no errors about `search_path` or RLS.

- [ ] **Step 8: Commit.** `git add supabase scripts/local-supabase-env.sh .gitignore && git commit -m "feat(db): schema, RLS and quiz RPCs with pgTAP tests"`

---

### Task 4: Content seed script

**Files:**
- Create: `src/content/to-rows.ts`, `scripts/seed-content.ts`
- Test: `src/content/to-rows.test.ts`

**Interfaces:**
- Consumes: `loadContent`, `QuestionFile` (Task 2); tables (Task 3).
- Produces:
  - `toRows(q: QuestionFile): { question: QuestionRow; options: OptionRow[] }`
  - CLI `pnpm seed <dir>`, which uses `SUPABASE_URL` and `SUPABASE_SECRET_KEY`.

- [ ] **Step 1: Write the failing test.** `src/content/to-rows.test.ts`:

```ts
import { toRows } from "./to-rows";
import type { QuestionFile } from "./schema";

const q: QuestionFile = {
  id: "sql-l1-0001", topic: "sql", level: 1, title: "T", prompt: "P", context: null,
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
```

- [ ] **Step 2: Run.** `pnpm vitest run src/content/to-rows` → FAIL (module missing).

- [ ] **Step 3: Implement.** `src/content/to-rows.ts`:

```ts
import { createHash } from "node:crypto";
import type { QuestionFile } from "./schema";

export interface QuestionRow {
  id: string; topic: string; level: number; title: string; prompt: string;
  context: string | null; tags: string[]; docs_url: string | null;
  active: boolean; content_hash: string; updated_at: string;
}
export interface OptionRow {
  question_id: string; position: number; code: string; is_correct: boolean; explanation: string;
}

export function toRows(q: QuestionFile): { question: QuestionRow; options: OptionRow[] } {
  const { status, ...content } = q;
  return {
    question: {
      id: q.id, topic: q.topic, level: q.level, title: q.title, prompt: q.prompt,
      context: q.context ?? null, tags: q.tags, docs_url: q.docs_url ?? null,
      active: status === "approved",
      content_hash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
      updated_at: new Date().toISOString(),
    },
    options: q.options.map((o, position) => ({
      question_id: q.id, position, code: o.code, is_correct: o.correct, explanation: o.explanation,
    })),
  };
}
```

- [ ] **Step 4: Run.** The test passes.

- [ ] **Step 5: CLI.** `scripts/seed-content.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { loadContent } from "../src/content/load";
import { toRows } from "../src/content/to-rows";

const dir = process.argv[2] ?? "content";
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");

const { questions, errors } = loadContent(dir);
if (errors.length) {
  for (const e of errors) console.error(`✖ ${e.file}: ${e.message}`);
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });
const rows = questions.map((q) => toRows(q.question));

const fail = (step: string, error: { message: string } | null) => {
  if (error) { console.error(`${step} failed: ${error.message}`); process.exit(1); }
};

async function main() {
if (rows.length) {
  const { error: qErr } = await db.from("questions").upsert(rows.map((r) => r.question), { onConflict: "id" });
  fail("upsert questions", qErr);
  const { error: oErr } = await db
    .from("question_options")
    .upsert(rows.flatMap((r) => r.options), { onConflict: "question_id,position" });
  fail("upsert options", oErr);
}
const ids = rows.map((r) => r.question.id);
const deactivate = db.from("questions").update({ active: false });
const { error: dErr } = ids.length
  ? await deactivate.not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`)
  : await deactivate.neq("id", "");
fail("deactivate removed questions", dErr);

const active = rows.filter((r) => r.question.active).length;
console.log(`Seeded ${rows.length} questions (${active} active) from ${dir}`);
}

void main();
```

(The scripts run under tsx in CommonJS mode, where top-level `await` is not allowed, hence `main()`.)

- [ ] **Step 6: Manual check.** Create one temporary valid question at `content/sql/level-1/sql-l1-0001.yaml` (copy the `valid()` object from Task 2's test as YAML). Then:

```bash
bash scripts/local-supabase-env.sh > .env.local
set -a; . ./.env.local; set +a
pnpm seed content
```

Expected: `Seeded 1 questions (1 active) from content`. Run it again and expect the same (idempotent). In Supabase Studio (http://127.0.0.1:54323), check that the option ids didn't change between runs. Delete the temporary file and run the seed again → the question becomes `active = false`.

- [ ] **Step 7: Commit.** `git add src/content scripts/seed-content.ts && git commit -m "feat(content): idempotent seed script"`

---

# Milestone M2 — Game Engine

### Task 5: Engine primitives and session config

**Files:**
- Create: `src/engine/shared.ts`, `src/engine/session-config.ts`
- Test: `src/engine/shared.test.ts`, `src/engine/session-config.test.ts`

**Interfaces:**
- Produces:
  - `shuffle<T>(items: readonly T[], rng?: () => number): T[]`
  - `parseSessionConfig(mode: Mode, params: URLSearchParams): SessionConfig | null`
  - `toSearchParams(config: SessionConfig): string`
  - `levelParam(level: Level | "mixed"): Level | null`

- [ ] **Step 1: Write the failing tests.** `src/engine/shared.test.ts`:

```ts
import { shuffle } from "./shared";

describe("shuffle", () => {
  it("returns a permutation without mutating input", () => {
    const input = [1, 2, 3, 4];
    const out = shuffle(input, () => 0);
    expect(out.sort()).toEqual([1, 2, 3, 4]);
    expect(input).toEqual([1, 2, 3, 4]);
  });
  it("is deterministic for a given rng", () => {
    const seeded = () => { const seq = [0.9, 0.1, 0.5]; let i = 0; return () => seq[i++ % seq.length]; };
    expect(shuffle(["a", "b", "c", "d"], seeded())).toEqual(shuffle(["a", "b", "c", "d"], seeded()));
  });
});
```

`src/engine/session-config.test.ts`:

```ts
import { parseSessionConfig, toSearchParams } from "./session-config";

const p = (s: string) => new URLSearchParams(s);

it("parses a full exam config", () => {
  expect(parseSessionConfig("exam", p("topics=spark,sql&level=3&length=20&timer=on"))).toEqual({
    mode: "exam", topics: ["spark", "sql"], level: 3, examLength: 20, timerSeconds: 60,
  });
});
it("defaults level=mixed, length=10, timer off", () => {
  expect(parseSessionConfig("practice", p("topics=git"))).toEqual({
    mode: "practice", topics: ["git"], level: "mixed", examLength: 10, timerSeconds: null,
  });
});
it("dedupes topics", () => {
  expect(parseSessionConfig("practice", p("topics=git,git"))?.topics).toEqual(["git"]);
});
it.each(["", "topics=", "topics=python", "topics=sql&level=6", "topics=sql&level=abc", "topics=sql&length=15"])(
  "rejects %s", (q) => expect(parseSessionConfig("exam", p(q))).toBeNull(),
);
it("survival defaults to level 1 and rejects mixed", () => {
  expect(parseSessionConfig("survival", p("topics=sql"))?.level).toBe(1);
  expect(parseSessionConfig("survival", p("topics=sql&level=4"))?.level).toBe(4);
  expect(parseSessionConfig("survival", p("topics=sql&level=mixed"))).toBeNull();
});
it("round-trips", () => {
  const c = parseSessionConfig("exam", p("topics=sql&level=2&length=40&timer=on"))!;
  expect(parseSessionConfig("exam", p(toSearchParams(c)))).toEqual(c);
});
```

- [ ] **Step 2: Run.** `pnpm vitest run src/engine` → FAIL.

- [ ] **Step 3: Implement.** `src/engine/shared.ts`:

```ts
export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
```

`src/engine/session-config.ts`:

```ts
import {
  EXAM_LENGTHS, EXAM_TIMER_SECONDS, isLevel, isTopic,
  type ExamLength, type Level, type Mode, type SessionConfig, type Topic,
} from "@/domain/types";

export function parseSessionConfig(mode: Mode, params: URLSearchParams): SessionConfig | null {
  const topics = [...new Set((params.get("topics") ?? "").split(",").filter(Boolean))];
  if (topics.length === 0 || !topics.every(isTopic)) return null;
  const rawLevel = params.get("level") ?? (mode === "survival" ? "1" : "mixed");
  const level = rawLevel === "mixed" ? "mixed" : Number(rawLevel);
  if (level === "mixed" ? mode === "survival" : !isLevel(level)) return null; // survival needs a fixed level
  const examLength = Number(params.get("length") ?? 10);
  if (!(EXAM_LENGTHS as readonly number[]).includes(examLength)) return null;
  return {
    mode,
    topics: topics as Topic[],
    level: level as Level | "mixed",
    examLength: examLength as ExamLength,
    timerSeconds: params.get("timer") === "on" ? EXAM_TIMER_SECONDS : null,
  };
}

export function toSearchParams(c: SessionConfig): string {
  const p = new URLSearchParams({ topics: c.topics.join(","), level: String(c.level) });
  if (c.mode === "exam") {
    p.set("length", String(c.examLength));
    if (c.timerSeconds) p.set("timer", "on");
  }
  return p.toString();
}

export const levelParam = (level: Level | "mixed"): Level | null => (level === "mixed" ? null : level);
```

- [ ] **Step 4: Run.** `pnpm vitest run src/engine` → PASS.

- [ ] **Step 5: Commit.** `git commit -m "feat(engine): primitives and session config parsing"`

---

### Task 6: Practice and Exam reducers

**Files:**
- Create: `src/engine/practice.ts`, `src/engine/exam.ts`
- Test: `src/engine/practice.test.ts`, `src/engine/exam.test.ts`, `src/engine/test-helpers.ts`

**Interfaces:**
- Consumes: `PublicQuestion`, `AnswerResult`, `Topic`, `Level`.
- Produces:
  - Practice: `PracticeState`, `PracticeEvent`, `initialPracticeState`, `practiceReducer(state, event)`.
  - Exam: `ExamState`, `ExamEvent`, `initialExamState`, `examReducer(state, event)`, `summarizeExam(state): ExamSummary`.
  - Test helpers: `makeQuestion(id, overrides?)`, `makeResult(questionId, correct)`.

- [ ] **Step 1: Test helpers.** `src/engine/test-helpers.ts`:

```ts
import type { AnswerResult, PublicQuestion } from "@/domain/types";

export const makeQuestion = (id: string, o: Partial<PublicQuestion> = {}): PublicQuestion => ({
  id, topic: "sql", level: 1, title: id, prompt: "p", context: null, tags: [],
  options: ["a", "b", "c", "d"].map((x) => ({ id: `${id}-${x}`, code: x })), ...o,
});

export const makeResult = (questionId: string, correct: boolean): AnswerResult => ({
  questionId, chosenOptionId: `${questionId}-${correct ? "a" : "b"}`, correct,
  correctOptionId: `${questionId}-a`, explanations: {}, docsUrl: null,
});
```

- [ ] **Step 2: Write the failing Practice tests.** `src/engine/practice.test.ts`:

```ts
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
```

- [ ] **Step 3: Write the failing Exam tests.** `src/engine/exam.test.ts`:

```ts
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
```

- [ ] **Step 4: Run.** `pnpm vitest run src/engine` → FAIL.

- [ ] **Step 5: Implement Practice.** `src/engine/practice.ts`:

```ts
import type { AnswerResult, PublicQuestion } from "@/domain/types";

export interface PracticeState {
  status: "loading" | "answering" | "feedback" | "exhausted" | "ended";
  current: PublicQuestion | null;
  lastResult: AnswerResult | null;
  seenIds: string[];
  answered: number;
  correct: number;
}

export type PracticeEvent =
  | { type: "QUESTION_LOADED"; question: PublicQuestion }
  | { type: "POOL_EXHAUSTED" }
  | { type: "ANSWER_RESULT"; result: AnswerResult }
  | { type: "NEXT" }
  | { type: "END" };

export const initialPracticeState: PracticeState = {
  status: "loading", current: null, lastResult: null, seenIds: [], answered: 0, correct: 0,
};

export function practiceReducer(s: PracticeState, e: PracticeEvent): PracticeState {
  switch (e.type) {
    case "QUESTION_LOADED":
      if (s.status !== "loading") return s;
      return { ...s, status: "answering", current: e.question, lastResult: null, seenIds: [...s.seenIds, e.question.id] };
    case "POOL_EXHAUSTED":
      return s.status === "loading" ? { ...s, status: "exhausted" } : s;
    case "ANSWER_RESULT":
      if (s.status !== "answering" || e.result.questionId !== s.current?.id) return s;
      return { ...s, status: "feedback", lastResult: e.result, answered: s.answered + 1, correct: s.correct + (e.result.correct ? 1 : 0) };
    case "NEXT":
      return s.status === "feedback" ? { ...s, status: "loading", current: null } : s;
    case "END":
      return s.status === "ended" ? s : { ...s, status: "ended" };
  }
}
```

- [ ] **Step 6: Implement Exam.** `src/engine/exam.ts`:

```ts
import type { AnswerResult, Level, PublicQuestion, Topic } from "@/domain/types";

export interface ExamState {
  status: "loading" | "empty" | "answering" | "finished";
  questions: PublicQuestion[];
  index: number;
  results: AnswerResult[];
  requested: number;
}

export type ExamEvent =
  | { type: "QUESTIONS_LOADED"; questions: PublicQuestion[]; requested: number }
  | { type: "ANSWER_RESULT"; result: AnswerResult };

export const initialExamState: ExamState = { status: "loading", questions: [], index: 0, results: [], requested: 0 };

export function examReducer(s: ExamState, e: ExamEvent): ExamState {
  switch (e.type) {
    case "QUESTIONS_LOADED":
      if (s.status !== "loading") return s;
      return { ...s, status: e.questions.length ? "answering" : "empty", questions: e.questions, requested: e.requested };
    case "ANSWER_RESULT": {
      if (s.status !== "answering" || e.result.questionId !== s.questions[s.index]?.id) return s;
      const index = s.index + 1;
      return { ...s, results: [...s.results, e.result], index, status: index >= s.questions.length ? "finished" : "answering" };
    }
  }
}

type Tally = { total: number; correct: number };
export interface ExamSummary {
  total: number; correct: number; pct: number; shortBy: number;
  byTopic: Partial<Record<Topic, Tally>>; byLevel: Partial<Record<Level, Tally>>;
}

export function summarizeExam(s: ExamState): ExamSummary {
  const byTopic: ExamSummary["byTopic"] = {};
  const byLevel: ExamSummary["byLevel"] = {};
  let correct = 0;
  s.results.forEach((res, i) => {
    const q = s.questions[i];
    const t = (byTopic[q.topic] ??= { total: 0, correct: 0 });
    const l = (byLevel[q.level] ??= { total: 0, correct: 0 });
    t.total++; l.total++;
    if (res.correct) { correct++; t.correct++; l.correct++; }
  });
  const total = s.results.length;
  return {
    total, correct, byTopic, byLevel,
    pct: total ? Math.round((correct / total) * 100) : 0,
    shortBy: Math.max(0, s.requested - s.questions.length),
  };
}
```

- [ ] **Step 7: Run.** `pnpm vitest run src/engine` → PASS.

- [ ] **Step 8: Commit.** `git commit -m "feat(engine): practice and exam reducers"`

---

### Task 7: Survival reducer

> **Revised 2026-10-02:** Survival no longer ramps levels. A run stays at the level the player picked and only gets that level's questions. It ends on the first wrong answer (`over`) or when the level has no unseen questions left (`cleared`). From `cleared`, the UI offers a **new run** at the next level. No pool fallback, no recycling, so `survival-fetch.ts` is gone and the game calls `QuizApi.getQuestions` directly.

**Files:**
- Create: `src/engine/survival.ts`
- Test: `src/engine/survival.test.ts`

**Interfaces:**
- Consumes: `makeQuestion`/`makeResult` (Task 6).
- Produces: `SurvivalState`, `SurvivalEvent`, `initialSurvivalState(level)`, `nextSurvivalLevel(level): Level | null`, `survivalReducer`.

- [ ] **Step 1: Write the failing tests.** `src/engine/survival.test.ts`:

```ts
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
```

- [ ] **Step 2: Run.** → FAIL.

- [ ] **Step 3: Implement.** `src/engine/survival.ts`:

```ts
import type { AnswerResult, Level, PublicQuestion } from "@/domain/types";

// A Survival run stays at one level. It ends on the first wrong answer ("over")
// or when that level has no unseen questions left ("cleared").
export interface SurvivalState {
  status: "loading" | "answering" | "feedback" | "over" | "cleared";
  level: Level;
  streak: number;
  current: PublicQuestion | null;
  lastResult: AnswerResult | null;
  seenIds: string[];
  missed: { question: PublicQuestion; result: AnswerResult } | null;
}

export type SurvivalEvent =
  | { type: "QUESTION_LOADED"; question: PublicQuestion }
  | { type: "POOL_EXHAUSTED" }
  | { type: "ANSWER_RESULT"; result: AnswerResult }
  | { type: "NEXT" };

export const initialSurvivalState = (level: Level): SurvivalState => ({
  status: "loading", level, streak: 0, current: null, lastResult: null, seenIds: [], missed: null,
});

/** The level offered after clearing `level`, or null at the top. */
export const nextSurvivalLevel = (level: Level): Level | null => (level < 5 ? ((level + 1) as Level) : null);

export function survivalReducer(s: SurvivalState, e: SurvivalEvent): SurvivalState {
  switch (e.type) {
    case "QUESTION_LOADED":
      if (s.status !== "loading") return s;
      return { ...s, status: "answering", current: e.question, lastResult: null, seenIds: [...s.seenIds, e.question.id] };
    case "POOL_EXHAUSTED":
      return s.status === "loading" ? { ...s, status: "cleared" } : s;
    case "ANSWER_RESULT": {
      if (s.status !== "answering" || !s.current || e.result.questionId !== s.current.id) return s;
      if (!e.result.correct) return { ...s, status: "over", lastResult: e.result, missed: { question: s.current, result: e.result } };
      return { ...s, status: "feedback", lastResult: e.result, streak: s.streak + 1 };
    }
    case "NEXT":
      return s.status === "feedback" ? { ...s, status: "loading", current: null } : s;
  }
}
```

- [ ] **Step 4: Run.** → PASS. **Step 5: Commit.** `git commit -m "feat(engine): fixed-level survival reducer"`

---

### Task 8: Guest progress store and anon id

**Files:**
- Create: `src/progress/store.ts`, `src/progress/local-store.ts`, `src/progress/anon-id.ts`
- Test: `src/progress/local-store.test.ts`, `src/progress/anon-id.test.ts`

**Interfaces:**
- Produces:
  - `SessionSummary`
  - `ProgressStore { persistent; getPersonalBest(mode, key); recordSession(s): { newBest: boolean }; getHistory(limit) }`
  - `topicsKey(topics)`, `bestKey(mode, topics, level)` (Survival bests are per level, e.g. `"git+sql@2"`; Exam bests per topic set, e.g. `"spark"`)
  - `LocalProgressStore(storage: Storage | null)`
  - `browserStorage(): Storage | null`
  - `getAnonId(storage: Storage | null): string`

- [ ] **Step 1: Write the failing tests.** `src/progress/local-store.test.ts`:

```ts
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
```

`src/progress/anon-id.test.ts`:

```ts
import { getAnonId } from "./anon-id";

beforeEach(() => localStorage.clear());
it("is stable across calls", () => expect(getAnonId(localStorage)).toBe(getAnonId(localStorage)));
it("is a uuid", () => expect(getAnonId(localStorage)).toMatch(/^[0-9a-f-]{36}$/));
it("replaces a malformed stored value", () => {
  localStorage.setItem("skewed:v1:anon_id", "garbage");
  expect(getAnonId(localStorage)).toMatch(/^[0-9a-f-]{36}$/);
});
it("works without storage", () => expect(getAnonId(null)).toMatch(/^[0-9a-f-]{36}$/));
```

- [ ] **Step 2: Run.** → FAIL.

- [ ] **Step 3: Implement.** `src/progress/store.ts`:

```ts
import type { Level, Mode, Topic } from "@/domain/types";

export interface SessionSummary {
  mode: Mode;
  topics: Topic[];
  level: Level | "mixed";
  answered: number;
  correct: number;
  streak: number | null;   // survival only
  finishedAt: string;      // ISO
}

export interface ProgressStore {
  readonly persistent: boolean;
  getPersonalBest(mode: "exam" | "survival", key: string): number | null;
  recordSession(s: SessionSummary): { newBest: boolean };
  getHistory(limit: number): SessionSummary[];
}

export const topicsKey = (topics: Topic[]): string => [...topics].sort().join("+");

/** Personal-best key: Survival bests are per level (streaks at different levels aren't comparable). */
export const bestKey = (mode: Mode, topics: Topic[], level: Level | "mixed"): string =>
  mode === "survival" ? `${topicsKey(topics)}@${level}` : topicsKey(topics);
```

`src/progress/local-store.ts`:

```ts
import { z } from "zod";
import { bestKey, type ProgressStore, type SessionSummary } from "./store";

const KEY = "skewed:v1:progress";
const HISTORY_CAP = 200;
const Data = z.object({ bests: z.record(z.string(), z.number()), history: z.array(z.any()) });
type Data = { bests: Record<string, number>; history: SessionSummary[] };

export function browserStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem("skewed:v1:probe", "1");
    s.removeItem("skewed:v1:probe");
    return s;
  } catch {
    return null;
  }
}

export class LocalProgressStore implements ProgressStore {
  readonly persistent: boolean;
  private data: Data;

  constructor(private readonly storage: Storage | null) {
    this.persistent = storage !== null;
    this.data = this.read();
  }

  getPersonalBest(mode: "exam" | "survival", key: string): number | null {
    return this.data.bests[`${mode}:${key}`] ?? null;
  }

  recordSession(s: SessionSummary): { newBest: boolean } {
    let newBest = false;
    const score = s.mode === "survival" ? s.streak ?? 0 : s.mode === "exam" && s.answered ? Math.round((s.correct / s.answered) * 100) : null;
    if (score !== null) {
      const k = `${s.mode}:${bestKey(s.mode, s.topics, s.level)}`;
      const prev = this.data.bests[k];
      if (prev === undefined || score > prev) { this.data.bests[k] = score; newBest = true; }
    }
    this.data.history = [s, ...this.data.history].slice(0, HISTORY_CAP);
    this.write();
    return { newBest };
  }

  getHistory(limit: number): SessionSummary[] {
    return this.data.history.slice(0, limit);
  }

  private read(): Data {
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) return Data.parse(JSON.parse(raw)) as Data;
    } catch { /* corrupt -> reset */ }
    return { bests: {}, history: [] };
  }

  private write() {
    try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* quota/private mode: keep in memory */ }
  }
}
```

`src/progress/anon-id.ts`:

```ts
const KEY = "skewed:v1:anon_id";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
let memory: string | null = null;

export function getAnonId(storage: Storage | null): string {
  try {
    const existing = storage?.getItem(KEY);
    if (existing && UUID.test(existing)) return existing;
    const id = crypto.randomUUID();
    storage?.setItem(KEY, id);
    if (storage) return id;
  } catch { /* fall through to memory */ }
  return (memory ??= crypto.randomUUID());
}
```

- [ ] **Step 4: Run.** → PASS. **Step 5: Commit.** `git commit -m "feat(progress): local guest progress store and anon id"`

---

### Task 9: Quiz API client and answer submitter hook

**Files:**
- Create: `src/api/quiz-api.ts`, `src/api/supabase-quiz-api.ts`, `src/game/use-answer-submitter.ts`
- Test: `src/api/supabase-quiz-api.test.ts`, `src/game/use-answer-submitter.test.tsx`

**Interfaces:**
- Consumes: the RPCs (Task 3), domain types (Task 2).
- Produces:
  - `QuizApi { getQuestions(p: GetQuestionsParams): Promise<PublicQuestion[]>; submitAnswer(p: SubmitAnswerParams): Promise<AnswerResult>; reportQuestion(p: ReportParams): Promise<void> }`
  - `ApiError(kind: "network" | "rate_limited" | "server")`
  - `createSupabaseQuizApi(client)`
  - `useAnswerSubmitter(api, ctx, onResult) → { submit(questionId, optionId | null), retry(), markShown(), pending, error }`

- [ ] **Step 1: Interface.** `src/api/quiz-api.ts`:

```ts
import type { AnswerResult, Level, Mode, PublicQuestion, ReportReason, Topic } from "@/domain/types";

export interface GetQuestionsParams { topics: Topic[]; level: Level | null; exclude: string[]; limit: number }
export interface SubmitAnswerParams {
  clientEventId: string; anonId: string; sessionId: string; questionId: string;
  optionId: string | null; mode: Mode; msToAnswer: number;
}
export interface ReportParams { anonId: string; questionId: string; reason: ReportReason; note: string }

export interface QuizApi {
  getQuestions(p: GetQuestionsParams): Promise<PublicQuestion[]>;
  submitAnswer(p: SubmitAnswerParams): Promise<AnswerResult>;
  reportQuestion(p: ReportParams): Promise<void>;
}

export class ApiError extends Error {
  constructor(message: string, readonly kind: "network" | "rate_limited" | "server") {
    super(message);
    this.name = "ApiError";
  }
}
```

- [ ] **Step 2: Write the failing API tests.** `src/api/supabase-quiz-api.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./quiz-api";
import { createSupabaseQuizApi } from "./supabase-quiz-api";

const client = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient;
const rawQ = { id: "sql-l1-0001", topic: "sql", level: 1, title: "T", prompt: "P", context: null, tags: [],
  options: [1, 2, 3, 4].map((n) => ({ id: `o${n}`, code: `c${n}` })) };

it("getQuestions sends snake_case params and parses rows", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: [rawQ], error: null });
  const qs = await createSupabaseQuizApi(client(rpc)).getQuestions({ topics: ["sql"], level: null, exclude: ["x"], limit: 1 });
  expect(rpc).toHaveBeenCalledWith("get_questions", { p_topics: ["sql"], p_level: null, p_exclude: ["x"], p_limit: 1 });
  expect(qs[0].options).toHaveLength(4);
});

it("submitAnswer maps the response to AnswerResult", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { correct: false, correct_option_id: "o1", explanations: { o1: "e" }, docs_url: null }, error: null });
  const r = await createSupabaseQuizApi(client(rpc)).submitAnswer({
    clientEventId: "c", anonId: "a", sessionId: "s", questionId: "q", optionId: "o2", mode: "exam", msToAnswer: 5,
  });
  expect(r).toEqual({ questionId: "q", chosenOptionId: "o2", correct: false, correctOptionId: "o1", explanations: { o1: "e" }, docsUrl: null });
});

it("maps rate limit and network errors", async () => {
  const limited = vi.fn().mockResolvedValue({ data: null, error: { message: "rate limit exceeded", code: "P0001", hint: "rate_limited" } });
  await expect(createSupabaseQuizApi(client(limited)).reportQuestion({ anonId: "a", questionId: "q", reason: "typo", note: "" }))
    .rejects.toMatchObject({ kind: "rate_limited" });
  const offline = vi.fn().mockResolvedValue({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } });
  await expect(createSupabaseQuizApi(client(offline)).getQuestions({ topics: ["sql"], level: 1, exclude: [], limit: 1 }))
    .rejects.toBeInstanceOf(ApiError);
});
```

- [ ] **Step 3: Write the failing hook tests.** `src/game/use-answer-submitter.test.tsx`:

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiError, type QuizApi } from "@/api/quiz-api";
import { makeResult } from "@/engine/test-helpers";
import { useAnswerSubmitter } from "./use-answer-submitter";

const ctx = { anonId: "a", sessionId: "s", mode: "practice" as const };

it("submits once even if called twice quickly (double click / timer race)", async () => {
  const api = { submitAnswer: vi.fn().mockResolvedValue(makeResult("q", true)) } as unknown as QuizApi;
  const onResult = vi.fn();
  const { result } = renderHook(() => useAnswerSubmitter(api, ctx, onResult));
  act(() => { result.current.submit("q", "o1"); result.current.submit("q", "o2"); });
  await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
  expect(api.submitAnswer).toHaveBeenCalledTimes(1);
});

it("on failure exposes error; retry resends identical params (same clientEventId)", async () => {
  const submitAnswer = vi.fn()
    .mockRejectedValueOnce(new ApiError("offline", "network"))
    .mockResolvedValueOnce(makeResult("q", true));
  const onResult = vi.fn();
  const { result } = renderHook(() => useAnswerSubmitter({ submitAnswer } as unknown as QuizApi, ctx, onResult));
  act(() => result.current.submit("q", "o1"));
  await waitFor(() => expect(result.current.error?.kind).toBe("network"));
  act(() => result.current.retry());
  await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
  expect(submitAnswer.mock.calls[1][0]).toEqual(submitAnswer.mock.calls[0][0]);
});

it("allows a new submit after a successful one", async () => {
  const api = { submitAnswer: vi.fn().mockResolvedValue(makeResult("q", true)) } as unknown as QuizApi;
  const { result } = renderHook(() => useAnswerSubmitter(api, ctx, vi.fn()));
  act(() => result.current.submit("q1", "o1"));
  await waitFor(() => expect(result.current.pending).toBe(false));
  act(() => result.current.submit("q2", "o1"));
  await waitFor(() => expect(api.submitAnswer).toHaveBeenCalledTimes(2));
});
```

- [ ] **Step 4: Run.** → FAIL.

- [ ] **Step 5: Implement the API.** `src/api/supabase-quiz-api.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TOPICS, type Level, type PublicQuestion } from "@/domain/types";
import { ApiError, type QuizApi } from "./quiz-api";

const QuestionsSchema = z.array(z.object({
  id: z.string(), topic: z.enum(TOPICS), level: z.number().int().min(1).max(5), title: z.string(), prompt: z.string(),
  context: z.string().nullable(), tags: z.array(z.string()),
  options: z.array(z.object({ id: z.string(), code: z.string() })).length(4),
}));
const ResultSchema = z.object({
  correct: z.boolean(), correct_option_id: z.string(), explanations: z.record(z.string(), z.string()), docs_url: z.string().nullable(),
});

type RpcError = { message: string; code?: string; hint?: string } | null;
function toApiError(error: NonNullable<RpcError>): ApiError {
  if (error.hint === "rate_limited") return new ApiError(error.message, "rate_limited");
  if (!error.code) return new ApiError(error.message, "network");
  return new ApiError(error.message, "server");
}

export function createSupabaseQuizApi(client: SupabaseClient): QuizApi {
  async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
    let res: { data: unknown; error: RpcError };
    try {
      res = await client.rpc(fn, args);
    } catch (e) {
      throw new ApiError((e as Error).message, "network");
    }
    if (res.error) throw toApiError(res.error);
    return res.data;
  }
  return {
    async getQuestions({ topics, level, exclude, limit }) {
      const data = await call("get_questions", { p_topics: topics, p_level: level, p_exclude: exclude, p_limit: limit });
      return QuestionsSchema.parse(data).map((q) => ({ ...q, level: q.level as Level })) satisfies PublicQuestion[];
    },
    async submitAnswer(p) {
      const r = ResultSchema.parse(await call("submit_answer", {
        p_client_event_id: p.clientEventId, p_anon_id: p.anonId, p_session_id: p.sessionId,
        p_question_id: p.questionId, p_option_id: p.optionId, p_mode: p.mode, p_ms: Math.round(p.msToAnswer),
      }));
      return {
        questionId: p.questionId, chosenOptionId: p.optionId, correct: r.correct,
        correctOptionId: r.correct_option_id, explanations: r.explanations, docsUrl: r.docs_url,
      };
    },
    async reportQuestion(p) {
      await call("report_question", { p_anon_id: p.anonId, p_question_id: p.questionId, p_reason: p.reason, p_note: p.note });
    },
  };
}
```

- [ ] **Step 6: Implement the hook.** `src/game/use-answer-submitter.ts`:

```ts
"use client";
import { useCallback, useRef, useState } from "react";
import { ApiError, type QuizApi, type SubmitAnswerParams } from "@/api/quiz-api";
import type { AnswerResult, Mode } from "@/domain/types";

export function useAnswerSubmitter(
  api: QuizApi,
  ctx: { anonId: string; sessionId: string; mode: Mode },
  onResult: (r: AnswerResult) => void,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  const inflight = useRef<SubmitAnswerParams | null>(null);
  const sending = useRef(false);
  const shownAt = useRef(Date.now());

  const send = useCallback(async (params: SubmitAnswerParams) => {
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    setError(null);
    try {
      const r = await api.submitAnswer(params);
      inflight.current = null;
      onResult(r);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), "server"));
    } finally {
      sending.current = false;
      setPending(false);
    }
  }, [api, onResult]);

  const submit = useCallback((questionId: string, optionId: string | null) => {
    if (inflight.current) return;
    const params: SubmitAnswerParams = {
      clientEventId: crypto.randomUUID(), anonId: ctx.anonId, sessionId: ctx.sessionId,
      questionId, optionId, mode: ctx.mode, msToAnswer: Date.now() - shownAt.current,
    };
    inflight.current = params;
    void send(params);
  }, [ctx.anonId, ctx.sessionId, ctx.mode, send]);

  const retry = useCallback(() => { if (inflight.current) void send(inflight.current); }, [send]);
  const markShown = useCallback(() => { shownAt.current = Date.now(); }, []);

  return { submit, retry, markShown, pending, error };
}
```

- [ ] **Step 7: Run.** `pnpm vitest run src/api src/game` → PASS. **Step 8: Commit.** `git commit -m "feat(api): supabase quiz api and idempotent answer submitter"`

---

# Milestone M3 — Playable UI

### Task 10: Code highlighting and QuestionView

**Files:**
- Create: `src/lib/highlight.ts`, `src/components/quiz/CodeBlock.tsx`, `src/components/quiz/QuestionView.tsx`
- Modify: `src/app/globals.css` (Shiki dual-theme CSS), `src/messages/en.json`
- Test: `src/components/quiz/QuestionView.test.tsx`

**Interfaces:**
- Consumes: `PublicQuestion`, `AnswerResult`.
- Produces:
  - `<CodeBlock code lang />`
  - `langFor(topic): "python" | "sql" | "bash"`
  - `<QuestionView question options result selectedId disabled onSelect />`. Here `options` is the already-shuffled `PublicOption[]` and `result: AnswerResult | null`. When `result` is set, it shows correct/wrong marks plus an explanation under every option and a docs link.

- [ ] **Step 1: Write the failing test.** `src/components/quiz/QuestionView.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { makeQuestion } from "@/engine/test-helpers";
import { QuestionView } from "./QuestionView";

vi.mock("./CodeBlock", () => ({ CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre> }));
const q = makeQuestion("q1", { title: "Latest order", prompt: "Pick **one**" });

it("renders title, prompt and 4 lettered options", () => {
  render(<QuestionView question={q} options={q.options} result={null} disabled={false} onSelect={() => {}} />);
  expect(screen.getByRole("heading", { name: "Latest order" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^Option [A-D]/ })).toHaveLength(4);
});

it("calls onSelect with the option id; disabled blocks clicks", async () => {
  const onSelect = vi.fn();
  const { rerender } = render(<QuestionView question={q} options={q.options} result={null} disabled={false} onSelect={onSelect} />);
  await userEvent.click(screen.getByRole("button", { name: /^Option B/ }));
  expect(onSelect).toHaveBeenCalledWith("q1-b");
  rerender(<QuestionView question={q} options={q.options} result={null} disabled onSelect={onSelect} />);
  await userEvent.click(screen.getByRole("button", { name: /^Option C/ }));
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it("in result mode marks correct/chosen and shows every explanation", () => {
  const result = { questionId: "q1", chosenOptionId: "q1-b", correct: false, correctOptionId: "q1-a",
    explanations: { "q1-a": "A is right", "q1-b": "B is wrong", "q1-c": "C no", "q1-d": "D no" }, docsUrl: "https://docs.example" };
  render(<QuestionView question={q} options={q.options} result={result} disabled onSelect={() => {}} />);
  expect(screen.getByRole("button", { name: /^Option A.*correct answer/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Option B.*your answer/ })).toBeInTheDocument();
  for (const t of ["A is right", "B is wrong", "C no", "D no"]) expect(screen.getByText(t)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /docs/i })).toHaveAttribute("href", "https://docs.example");
});
```

- [ ] **Step 2: Run.** → FAIL.

- [ ] **Step 3: Highlighter.** `src/lib/highlight.ts`:

```ts
import type { HighlighterGeneric } from "shiki";
import type { Topic } from "@/domain/types";

export type CodeLang = "python" | "sql" | "bash";
export const langFor = (t: Topic): CodeLang => ({ spark: "python", sql: "sql", git: "bash" } as const)[t];

let highlighter: Promise<HighlighterGeneric<string, string>> | null = null;

export async function highlight(code: string, lang: CodeLang): Promise<string> {
  highlighter ??= import("shiki").then(({ createHighlighter }) =>
    createHighlighter({ themes: ["github-light", "github-dark"], langs: ["python", "sql", "bash"] }));
  const h = await highlighter;
  return h.codeToHtml(code, { lang, themes: { light: "github-light", dark: "github-dark" } });
}
```

Append to `src/app/globals.css`:

```css
.shiki { padding: 0.75rem 1rem; border-radius: 0.5rem; overflow-x: auto; font-size: 0.85rem; }
@media (prefers-color-scheme: dark) {
  .shiki, .shiki span { color: var(--shiki-dark) !important; background-color: var(--shiki-dark-bg) !important; }
}
```

- [ ] **Step 4: CodeBlock.** `src/components/quiz/CodeBlock.tsx`:

```tsx
"use client";
import { useEffect, useState } from "react";
import { highlight, type CodeLang } from "@/lib/highlight";

export function CodeBlock({ code, lang }: { code: string; lang: CodeLang }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    highlight(code, lang).then((h) => alive && setHtml(h)).catch(() => {});
    return () => { alive = false; };
  }, [code, lang]);
  if (!html) return <pre className="shiki overflow-x-auto bg-neutral-100 dark:bg-neutral-900"><code>{code}</code></pre>;
  // Shiki escapes the source text, so this HTML is safe.
  return <div className="text-left" dangerouslySetInnerHTML={{ __html: html }} />;
}
```

- [ ] **Step 5: QuestionView.** Add to `en.json`:

```json
"quiz": {
  "option": "Option", "correctAnswer": "correct answer", "yourAnswer": "your answer",
  "timedOut": "Time ran out — no answer recorded", "docs": "Read the docs", "level": "Level"
}
```

`src/components/quiz/QuestionView.tsx`:

```tsx
"use client";
import Markdown from "react-markdown";
import type { AnswerResult, PublicOption, PublicQuestion } from "@/domain/types";
import { langFor } from "@/lib/highlight";
import en from "@/messages/en.json";
import { CodeBlock } from "./CodeBlock";

const LETTERS = ["A", "B", "C", "D"];

interface Props {
  question: PublicQuestion;
  options: PublicOption[];
  result: AnswerResult | null;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}

export function QuestionView({ question, options, result, disabled, onSelect }: Props) {
  const lang = langFor(question.topic);
  return (
    <article className="space-y-4">
      <header className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
        <span>{question.topic}</span>
        <span>· {en.quiz.level} {question.level}</span>
      </header>
      <h2 className="text-xl font-semibold">{question.title}</h2>
      <div className="prose prose-neutral dark:prose-invert max-w-none"><Markdown>{question.prompt}</Markdown></div>
      {question.context && (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded border p-3"><Markdown>{question.context}</Markdown></div>
      )}
      {result && result.chosenOptionId === null && <p className="text-amber-600">{en.quiz.timedOut}</p>}
      <ol className="space-y-3">
        {options.map((o, i) => {
          const isCorrect = result?.correctOptionId === o.id;
          const isChosen = result?.chosenOptionId === o.id;
          const tone = !result ? "hover:border-sky-500" : isCorrect ? "border-emerald-500" : isChosen ? "border-rose-500" : "opacity-70";
          const label = [`${en.quiz.option} ${LETTERS[i]}`, isCorrect && en.quiz.correctAnswer, isChosen && en.quiz.yourAnswer]
            .filter(Boolean).join(", ");
          return (
            <li key={o.id}>
              <button
                type="button"
                aria-label={label}
                disabled={disabled}
                onClick={() => onSelect(o.id)}
                className={`w-full rounded-lg border-2 p-2 text-left transition ${tone} disabled:cursor-default`}
              >
                <span className="mb-1 block text-sm font-bold">{LETTERS[i]}</span>
                <CodeBlock code={o.code} lang={lang} />
              </button>
              {result && <p className="mt-1 px-2 text-sm text-neutral-600 dark:text-neutral-300">{result.explanations[o.id]}</p>}
            </li>
          );
        })}
      </ol>
      {result?.docsUrl && (
        <a className="text-sky-600 underline" href={result.docsUrl} target="_blank" rel="noreferrer">{en.quiz.docs}</a>
      )}
    </article>
  );
}
```

Install typography for `prose` with `pnpm add -D @tailwindcss/typography`, then add `@plugin "@tailwindcss/typography";` to `globals.css`.

- [ ] **Step 6: Run.** → PASS. **Step 7: Commit.** `git commit -m "feat(ui): question view with highlighted code options"`

---

### Task 11: Report question dialog

**Files:**
- Create: `src/components/quiz/ReportDialog.tsx`
- Modify: `src/messages/en.json`
- Test: `src/components/quiz/ReportDialog.test.tsx`

**Interfaces:**
- Consumes: `QuizApi.reportQuestion`, `ApiError`.
- Produces: `<ReportDialog api anonId questionId />`, a "Report" button that opens a dialog.

- [ ] **Step 1: Write the failing test.** `src/components/quiz/ReportDialog.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type QuizApi } from "@/api/quiz-api";
import { ReportDialog } from "./ReportDialog";

const setup = (reportQuestion: QuizApi["reportQuestion"]) =>
  render(<ReportDialog api={{ reportQuestion } as QuizApi} anonId="a" questionId="q1" />);

it("submits reason and note", async () => {
  const report = vi.fn().mockResolvedValue(undefined);
  setup(report);
  await userEvent.click(screen.getByRole("button", { name: /report/i }));
  await userEvent.click(screen.getByLabelText(/ambiguous/i));
  await userEvent.type(screen.getByLabelText(/details/i), "two answers work");
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
  expect(report).toHaveBeenCalledWith({ anonId: "a", questionId: "q1", reason: "ambiguous", note: "two answers work" });
  expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
});

it("shows a friendly message when rate limited", async () => {
  setup(vi.fn().mockRejectedValue(new ApiError("x", "rate_limited")));
  await userEvent.click(screen.getByRole("button", { name: /report/i }));
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
  expect(await screen.findByText(/too many reports/i)).toBeInTheDocument();
});

it("limits the note to 500 characters", async () => {
  setup(vi.fn());
  await userEvent.click(screen.getByRole("button", { name: /report/i }));
  expect(screen.getByLabelText(/details/i)).toHaveAttribute("maxlength", "500");
});
```

- [ ] **Step 2: Run.** → FAIL.

- [ ] **Step 3: Implement.** Add to `en.json`:

```json
"report": {
  "open": "Report question", "title": "What's wrong with this question?", "details": "Details (optional)",
  "send": "Send report", "cancel": "Cancel", "thanks": "Thanks! We'll review it.",
  "rateLimited": "Too many reports — try again in an hour.", "failed": "Couldn't send the report. Try again.",
  "reasons": { "wrong_answer": "The marked answer is wrong", "ambiguous": "More than one answer is valid / ambiguous", "typo": "Typo or formatting", "other": "Other" }
}
```

`src/components/quiz/ReportDialog.tsx`:

```tsx
"use client";
import { useState } from "react";
import { ApiError, type QuizApi } from "@/api/quiz-api";
import { REPORT_REASONS, type ReportReason } from "@/domain/types";
import en from "@/messages/en.json";

type Status = "closed" | "open" | "sending" | "sent" | "rate_limited" | "failed";

export function ReportDialog({ api, anonId, questionId }: { api: QuizApi; anonId: string; questionId: string }) {
  const [status, setStatus] = useState<Status>("closed");
  const [reason, setReason] = useState<ReportReason>("wrong_answer");
  const [note, setNote] = useState("");

  async function send() {
    setStatus("sending");
    try {
      await api.reportQuestion({ anonId, questionId, reason, note });
      setStatus("sent");
    } catch (e) {
      setStatus(e instanceof ApiError && e.kind === "rate_limited" ? "rate_limited" : "failed");
    }
  }

  if (status === "closed")
    return <button type="button" className="text-sm text-neutral-500 underline" onClick={() => setStatus("open")}>{en.report.open}</button>;
  if (status === "sent") return <p className="text-sm text-emerald-600">{en.report.thanks}</p>;

  return (
    <div role="dialog" aria-labelledby="report-title" className="space-y-2 rounded border p-3">
      <h3 id="report-title" className="font-medium">{en.report.title}</h3>
      {REPORT_REASONS.map((r) => (
        <label key={r} className="flex items-center gap-2 text-sm">
          <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
          {en.report.reasons[r]}
        </label>
      ))}
      <label className="block text-sm">
        {en.report.details}
        <textarea className="mt-1 w-full rounded border p-1" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
      </label>
      {status === "rate_limited" && <p className="text-sm text-rose-600">{en.report.rateLimited}</p>}
      {status === "failed" && <p className="text-sm text-rose-600">{en.report.failed}</p>}
      <div className="flex gap-2">
        <button type="button" disabled={status === "sending"} onClick={send} className="rounded bg-neutral-900 px-3 py-1 text-white">{en.report.send}</button>
        <button type="button" onClick={() => setStatus("closed")}>{en.report.cancel}</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run.** → PASS. **Step 5: Commit.** `git commit -m "feat(ui): report question dialog"`

---

### Task 12: Landing, about and play setup pages with game services

**Files:**
- Create: `src/game/services.tsx`, `src/app/play/page.tsx`, `src/app/play/SetupForm.tsx`, `src/app/about/page.tsx`, `src/app/play/layout.tsx`
- Modify: `src/app/page.tsx`, `src/app/layout.tsx`, `src/messages/en.json`
- Test: `src/app/play/SetupForm.test.tsx`

**Interfaces:**
- Consumes: `createSupabaseQuizApi`, `LocalProgressStore`, `browserStorage`, `getAnonId`, `toSearchParams`.
- Produces:
  - `<GameServicesProvider>`, which wraps `/play/*`
  - `useGameServices(): { api: QuizApi; progress: ProgressStore; anonId: string }`
  - `<SetupForm onStart(mode, config) />`

- [ ] **Step 1: Services.** `src/game/services.tsx`:

```tsx
"use client";
import { createClient } from "@supabase/supabase-js";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { QuizApi } from "@/api/quiz-api";
import { createSupabaseQuizApi } from "@/api/supabase-quiz-api";
import { getAnonId } from "@/progress/anon-id";
import { browserStorage, LocalProgressStore } from "@/progress/local-store";
import type { ProgressStore } from "@/progress/store";

export interface GameServices { api: QuizApi; progress: ProgressStore; anonId: string }
const Ctx = createContext<GameServices | null>(null);

function createDefaultServices(): GameServices {
  const storage = browserStorage();
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  return { api: createSupabaseQuizApi(client), progress: new LocalProgressStore(storage), anonId: getAnonId(storage) };
}

export function GameServicesProvider({ children, services }: { children: ReactNode; services?: GameServices }) {
  const [value] = useState(() => services ?? createDefaultServices());
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGameServices(): GameServices {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGameServices must be used inside GameServicesProvider");
  return v;
}
```

`src/app/play/layout.tsx`:

```tsx
import { GameServicesProvider } from "@/game/services";
export default function PlayLayout({ children }: { children: React.ReactNode }) {
  return <GameServicesProvider><main className="mx-auto max-w-3xl p-4">{children}</main></GameServicesProvider>;
}
```

- [ ] **Step 2: Write the failing SetupForm test.** `src/app/play/SetupForm.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SetupForm } from "./SetupForm";

it("starts an exam with chosen topics, level, length and timer", async () => {
  const onStart = vi.fn();
  render(<SetupForm onStart={onStart} />);
  await userEvent.click(screen.getByRole("radio", { name: /exam/i }));
  await userEvent.click(screen.getByRole("checkbox", { name: /git/i }));
  await userEvent.selectOptions(screen.getByLabelText(/level/i), "3");
  await userEvent.selectOptions(screen.getByLabelText(/questions/i), "20");
  await userEvent.click(screen.getByRole("checkbox", { name: /timer/i }));
  await userEvent.click(screen.getByRole("button", { name: /start/i }));
  expect(onStart).toHaveBeenCalledWith("exam", "topics=spark%2Csql%2Cgit&level=3&length=20&timer=on");
});

it("survival offers levels 1-5 without Mixed and disables start with no topics", async () => {
  const onStart = vi.fn();
  render(<SetupForm onStart={onStart} />);
  await userEvent.click(screen.getByRole("radio", { name: /survival/i }));
  expect(screen.getByLabelText(/level/i)).toHaveValue("1");
  expect(screen.queryByRole("option", { name: /mixed/i })).not.toBeInTheDocument();
  await userEvent.selectOptions(screen.getByLabelText(/level/i), "3");
  await userEvent.click(screen.getByRole("button", { name: /start/i }));
  expect(onStart).toHaveBeenCalledWith("survival", "topics=spark%2Csql&level=3");
  for (const t of ["spark", "sql"]) await userEvent.click(screen.getByRole("checkbox", { name: new RegExp(t, "i") }));
  expect(screen.getByRole("button", { name: /start/i })).toBeDisabled();
});
```

(The default selection is Practice with topics spark + sql checked.)

- [ ] **Step 3: Run.** → FAIL.

- [ ] **Step 4: Implement SetupForm.** Add `en.json` keys under `"setup"`:

```json
"setup": {
  "title": "Pick your drill", "mode": "Mode", "topics": "Topics", "level": "Level", "mixed": "Mixed",
  "questions": "Questions", "timer": "60s timer per question", "start": "Start",
  "modes": {
    "practice": { "name": "Practice", "desc": "Instant feedback after every question." },
    "exam": { "name": "Exam", "desc": "Answer them all, then review your results." },
    "survival": { "name": "Survival", "desc": "Pick a level. One wrong answer and it's over." }
  },
  "topicNames": { "spark": "PySpark", "sql": "SQL", "git": "Git" }
}
```

`src/app/play/SetupForm.tsx`:

```tsx
"use client";
import { useState } from "react";
import { EXAM_LENGTHS, EXAM_TIMER_SECONDS, LEVELS, TOPICS, type ExamLength, type Level, type Mode, type Topic } from "@/domain/types";
import { toSearchParams } from "@/engine/session-config";
import en from "@/messages/en.json";

const MODES: Mode[] = ["practice", "exam", "survival"];

export function SetupForm({ onStart }: { onStart: (mode: Mode, query: string) => void }) {
  const [mode, setMode] = useState<Mode>("practice");
  const [topics, setTopics] = useState<Topic[]>(["spark", "sql"]);
  const [level, setLevel] = useState<Level | "mixed">("mixed");
  const [examLength, setExamLength] = useState<ExamLength>(10);
  const [timer, setTimer] = useState(false);

  const toggle = (t: Topic) => setTopics((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
  const ordered = TOPICS.filter((t) => topics.includes(t));
  // Survival always runs at one fixed level, so "Mixed" falls back to level 1 there.
  const shownLevel: Level | "mixed" = mode === "survival" && level === "mixed" ? 1 : level;

  return (
    <form className="space-y-6" onSubmit={(e) => {
      e.preventDefault();
      onStart(mode, toSearchParams({ mode, topics: ordered, level: shownLevel, examLength, timerSeconds: timer ? EXAM_TIMER_SECONDS : null }));
    }}>
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="mb-2 font-medium">{en.setup.mode}</legend>
        {MODES.map((m) => (
          <label key={m} className={`cursor-pointer rounded-lg border-2 p-3 ${mode === m ? "border-sky-500" : ""}`}>
            <input type="radio" name="mode" className="sr-only" checked={mode === m} onChange={() => setMode(m)} aria-label={en.setup.modes[m].name} />
            <span className="block font-semibold">{en.setup.modes[m].name}</span>
            <span className="text-sm text-neutral-500">{en.setup.modes[m].desc}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex gap-4">
        <legend className="mb-2 font-medium">{en.setup.topics}</legend>
        {TOPICS.map((t) => (
          <label key={t} className="flex items-center gap-2">
            <input type="checkbox" checked={topics.includes(t)} onChange={() => toggle(t)} aria-label={t} />
            {en.setup.topicNames[t]}
          </label>
        ))}
      </fieldset>
      <label className="block">
        {en.setup.level}
        <select className="ml-2 rounded border p-1" value={String(shownLevel)} onChange={(e) => setLevel(e.target.value === "mixed" ? "mixed" : (Number(e.target.value) as Level))}>
          {mode !== "survival" && <option value="mixed">{en.setup.mixed}</option>}
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      {mode === "exam" && (
        <div className="flex flex-wrap gap-6">
          <label>
            {en.setup.questions}
            <select className="ml-2 rounded border p-1" value={examLength} onChange={(e) => setExamLength(Number(e.target.value) as ExamLength)}>
              {EXAM_LENGTHS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={timer} onChange={(e) => setTimer(e.target.checked)} />
            {en.setup.timer}
          </label>
        </div>
      )}
      <button type="submit" disabled={topics.length === 0} className="rounded-lg bg-sky-600 px-5 py-2 font-semibold text-white disabled:opacity-40">
        {en.setup.start}
      </button>
    </form>
  );
}
```

`src/app/play/page.tsx`:

```tsx
"use client";
import { useRouter } from "next/navigation";
import en from "@/messages/en.json";
import { SetupForm } from "./SetupForm";

export default function PlayPage() {
  const router = useRouter();
  return (
    <>
      <h1 className="mb-6 text-2xl font-bold">{en.setup.title}</h1>
      <SetupForm onStart={(mode, query) => router.push(`/play/${mode}?${query}`)} />
    </>
  );
}
```

- [ ] **Step 5: Landing and about.** `src/app/page.tsx`: a hero with `en.app.name`, `en.app.tagline`, three cards (one per mode, reusing `en.setup.modes`) and a primary CTA `<Link href="/play">Play as guest</Link>`. Add these keys: `"landing": { "cta": "Play as guest — no sign-up", "levels": "5 levels from fundamentals to expert" }`. `src/app/about/page.tsx` renders the level rubric table from spec §2.2 as static JSX, plus a paragraph on how to report a question. `src/app/layout.tsx` sets `metadata = { title: "Skewed — Data Engineering Drills", description: en.app.tagline }` and adds a header nav (Home, Play, About).

- [ ] **Step 6: Run.** `pnpm test` → PASS. Run `pnpm dev`, open `/` and `/play`, and check you can click through the setup form.

- [ ] **Step 7: Commit.** `git commit -m "feat(ui): landing, about and play setup"`

---

### Task 13: Practice mode page

**Files:**
- Create: `src/app/play/practice/page.tsx`, `src/app/play/practice/PracticeGame.tsx`, `src/components/quiz/ErrorRetry.tsx`, `src/components/quiz/useShuffledOptions.ts`
- Modify: `src/messages/en.json`
- Test: `src/app/play/practice/PracticeGame.test.tsx`

**Interfaces:**
- Consumes: `practiceReducer` (Task 6), `useAnswerSubmitter` (Task 9), `QuestionView` (Task 10), `ReportDialog` (Task 11), `useGameServices` and `GameServicesProvider` (Task 12), `parseSessionConfig` and `levelParam` (Task 5).
- Produces:
  - `<PracticeGame config />`
  - `<ErrorRetry message onRetry />`
  - `useShuffledOptions(question): PublicOption[]`, stable per question id. Exam and Survival reuse it.

- [ ] **Step 1: Write the failing test.** `src/app/play/practice/PracticeGame.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type QuizApi } from "@/api/quiz-api";
import { makeQuestion } from "@/engine/test-helpers";
import { GameServicesProvider } from "@/game/services";
import { LocalProgressStore } from "@/progress/local-store";
import { PracticeGame } from "./PracticeGame";

vi.mock("@/components/quiz/CodeBlock", () => ({ CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre> }));
// Options are shuffled; make it identity so option A is always `<id>-a`.
vi.mock("@/engine/shared", async (orig) => ({ ...(await orig<object>()), shuffle: <T,>(x: readonly T[]) => [...x] }));
const config = { mode: "practice" as const, topics: ["sql" as const], level: 1 as const, examLength: 10 as const, timerSeconds: null };

function renderWith(api: Partial<QuizApi>) {
  return render(
    <GameServicesProvider services={{ api: api as QuizApi, progress: new LocalProgressStore(null), anonId: "a" }}>
      <PracticeGame config={config} />
    </GameServicesProvider>,
  );
}

it("answer -> feedback with explanations -> next question -> pool exhausted", async () => {
  const getQuestions = vi.fn()
    .mockResolvedValueOnce([makeQuestion("q1", { title: "First" })])
    .mockResolvedValueOnce([]);
  const submitAnswer = vi.fn().mockResolvedValue({
    questionId: "q1", chosenOptionId: "q1-a", correct: true, correctOptionId: "q1-a",
    explanations: { "q1-a": "Because A", "q1-b": "nb", "q1-c": "nc", "q1-d": "nd" }, docsUrl: null,
  });
  renderWith({ getQuestions, submitAnswer });
  expect(await screen.findByRole("heading", { name: "First" })).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]);
  expect(await screen.findByText("Because A")).toBeInTheDocument();
  expect(screen.getByText(/1 \/ 1/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /next/i }));
  expect(await screen.findByText(/seen all questions/i)).toBeInTheDocument();
  expect(getQuestions).toHaveBeenLastCalledWith({ topics: ["sql"], level: 1, exclude: ["q1"], limit: 1 });
});

it("shows retry on submit failure and recovers", async () => {
  const submitAnswer = vi.fn()
    .mockRejectedValueOnce(new ApiError("x", "network"))
    .mockResolvedValueOnce({ questionId: "q1", chosenOptionId: "q1-a", correct: false, correctOptionId: "q1-b", explanations: {}, docsUrl: null });
  renderWith({ getQuestions: vi.fn().mockResolvedValue([makeQuestion("q1")]), submitAnswer });
  await screen.findByRole("heading", { name: "q1" });
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]);
  await userEvent.click(await screen.findByRole("button", { name: /retry/i }));
  expect(await screen.findByText(/0 \/ 1/)).toBeInTheDocument();
});
```


- [ ] **Step 2: Run.** → FAIL.

- [ ] **Step 3: Shared bits.** Add to `en.json`:

```json
"game": {
  "next": "Next question", "end": "End session", "score": "Score", "retry": "Retry",
  "submitFailed": "Couldn't reach the server. Your answer wasn't lost.", "loadFailed": "Couldn't load a question.",
  "exhausted": "You've seen all questions for this selection.", "restart": "Start over", "changeSetup": "Change setup",
  "badConfig": "This drill link is invalid.", "empty": "No questions match this selection yet. Try other topics or Mixed level.",
  "correct": "Correct!", "wrong": "Not quite.", "notSaved": "Progress isn't saved in this browser (private mode?)."
}
```

`src/components/quiz/useShuffledOptions.ts`:

```ts
import { useMemo } from "react";
import type { PublicOption, PublicQuestion } from "@/domain/types";
import { shuffle } from "@/engine/shared";

export function useShuffledOptions(q: PublicQuestion | null): PublicOption[] {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reshuffle only when the question changes
  return useMemo(() => (q ? shuffle(q.options) : []), [q?.id]);
}
```

`src/components/quiz/ErrorRetry.tsx`:

```tsx
import en from "@/messages/en.json";
export function ErrorRetry({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex items-center gap-3 rounded border border-rose-300 bg-rose-50 p-3 text-rose-800 dark:bg-rose-950 dark:text-rose-200">
      <span>{message}</span>
      <button type="button" onClick={onRetry} className="rounded bg-rose-600 px-3 py-1 text-white">{en.game.retry}</button>
    </div>
  );
}
```

- [ ] **Step 4: PracticeGame.** `src/app/play/practice/PracticeGame.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useState } from "react";
import { ErrorRetry } from "@/components/quiz/ErrorRetry";
import { QuestionView } from "@/components/quiz/QuestionView";
import { ReportDialog } from "@/components/quiz/ReportDialog";
import { useShuffledOptions } from "@/components/quiz/useShuffledOptions";
import type { AnswerResult, SessionConfig } from "@/domain/types";
import { initialPracticeState, practiceReducer } from "@/engine/practice";
import { levelParam } from "@/engine/session-config";
import { useAnswerSubmitter } from "@/game/use-answer-submitter";
import { useGameServices } from "@/game/services";
import en from "@/messages/en.json";

export function PracticeGame({ config }: { config: SessionConfig }) {
  const { api, anonId, progress } = useGameServices();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, dispatch] = useReducer(practiceReducer, initialPracticeState);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const onResult = useCallback((result: AnswerResult) => dispatch({ type: "ANSWER_RESULT", result }), []);
  const submitter = useAnswerSubmitter(api, { anonId, sessionId, mode: "practice" }, onResult);
  const options = useShuffledOptions(state.current);

  useEffect(() => {
    if (state.status !== "loading") return;
    let alive = true;
    setLoadError(false);
    api.getQuestions({ topics: config.topics, level: levelParam(config.level), exclude: state.seenIds, limit: 1 })
      .then(([q]) => { if (!alive) return; dispatch(q ? { type: "QUESTION_LOADED", question: q } : { type: "POOL_EXHAUSTED" }); })
      .catch(() => alive && setLoadError(true));
    return () => { alive = false; };
  }, [state.status, state.seenIds, api, config, loadAttempt]);

  const { markShown } = submitter;
  useEffect(() => { if (state.status === "answering") markShown(); }, [state.status, state.current?.id, markShown]);

  useEffect(() => {
    if (state.status === "ended" && state.answered > 0)
      progress.recordSession({ mode: "practice", topics: config.topics, level: config.level, answered: state.answered,
        correct: state.correct, streak: null, finishedAt: new Date().toISOString() });
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const score = <p className="text-sm text-neutral-500">{en.game.score}: {state.correct} / {state.answered}</p>;

  if (state.status === "exhausted" || state.status === "ended")
    return (
      <div className="space-y-4">
        {state.status === "exhausted" && <p>{en.game.exhausted}</p>}
        {score}
        <div className="flex gap-3">
          <button type="button" onClick={() => window.location.reload()} className="rounded bg-sky-600 px-4 py-2 text-white">{en.game.restart}</button>
          <Link href="/play" className="rounded border px-4 py-2">{en.game.changeSetup}</Link>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {score}
        <button type="button" onClick={() => dispatch({ type: "END" })} className="text-sm underline">{en.game.end}</button>
      </div>
      {loadError && <ErrorRetry message={en.game.loadFailed} onRetry={() => setLoadAttempt((n) => n + 1)} />}
      {state.current && (
        <>
          <QuestionView
            question={state.current}
            options={options}
            result={state.status === "feedback" ? state.lastResult : null}
            disabled={state.status !== "answering" || submitter.pending}
            onSelect={(id) => submitter.submit(state.current!.id, id)}
          />
          {submitter.error && <ErrorRetry message={en.game.submitFailed} onRetry={submitter.retry} />}
          {state.status === "feedback" && (
            <div className="flex items-center justify-between">
              <p className={state.lastResult?.correct ? "text-emerald-600" : "text-rose-600"}>{state.lastResult?.correct ? en.game.correct : en.game.wrong}</p>
              <button type="button" onClick={() => dispatch({ type: "NEXT" })} className="rounded bg-sky-600 px-4 py-2 text-white">{en.game.next}</button>
            </div>
          )}
          <ReportDialog api={api} anonId={anonId} questionId={state.current.id} />
        </>
      )}
    </div>
  );
}
```

`src/app/play/practice/page.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { parseSessionConfig } from "@/engine/session-config";
import en from "@/messages/en.json";
import { PracticeGame } from "./PracticeGame";

function Inner() {
  const config = parseSessionConfig("practice", new URLSearchParams(useSearchParams()));
  if (!config) return <p>{en.game.badConfig} <Link className="underline" href="/play">{en.game.changeSetup}</Link></p>;
  return <PracticeGame config={config} />;
}

export default function Page() {
  return <Suspense fallback={null}><Inner /></Suspense>;
}
```

- [ ] **Step 5: Run.** → PASS. Manual check: start the local Supabase stack, run `pnpm seed content` with one sample question, `pnpm dev`, and play a practice round.

- [ ] **Step 6: Commit.** `git commit -m "feat(ui): practice mode"`

---

### Task 14: Exam mode page and review

**Files:**
- Create: `src/app/play/exam/page.tsx`, `src/app/play/exam/ExamGame.tsx`, `src/app/play/exam/ExamReview.tsx`, `src/game/use-countdown.ts`
- Modify: `src/messages/en.json`
- Test: `src/app/play/exam/ExamGame.test.tsx`, `src/game/use-countdown.test.ts`

**Interfaces:**
- Consumes: `examReducer`, `summarizeExam` (Task 6), plus everything Practice consumes.
- Produces:
  - `useCountdown(seconds: number | null, resetKey: string, onExpire: () => void): number | null` (remaining seconds)
  - `<ExamGame config />`
  - `<ExamReview state />`

- [ ] **Step 1: Write the failing countdown test.** `src/game/use-countdown.test.ts`:

```ts
import { act, renderHook } from "@testing-library/react";
import { useCountdown } from "./use-countdown";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("counts down and fires onExpire once", () => {
  const onExpire = vi.fn();
  const { result } = renderHook(() => useCountdown(3, "q1", onExpire));
  expect(result.current).toBe(3);
  act(() => vi.advanceTimersByTime(3000));
  expect(onExpire).toHaveBeenCalledTimes(1);
  act(() => vi.advanceTimersByTime(3000));
  expect(onExpire).toHaveBeenCalledTimes(1);
});

it("resets when the key changes", () => {
  const { result, rerender } = renderHook(({ k }) => useCountdown(5, k, vi.fn()), { initialProps: { k: "q1" } });
  act(() => vi.advanceTimersByTime(3000));
  rerender({ k: "q2" });
  expect(result.current).toBe(5);
});

it("is inert when seconds is null", () => {
  const onExpire = vi.fn();
  const { result } = renderHook(() => useCountdown(null, "q1", onExpire));
  act(() => vi.advanceTimersByTime(100000));
  expect(result.current).toBeNull();
  expect(onExpire).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Write the failing ExamGame test.** `src/app/play/exam/ExamGame.test.tsx`. Use the same `renderWith`, CodeBlock mock and shuffle mock as Task 13, with config `{ mode: "exam", topics: ["sql"], level: 1, examLength: 10, timerSeconds: null }`.

```tsx
it("hides feedback during the exam, then shows review with score and shortfall", async () => {
  const qs = [makeQuestion("q1", { title: "One" }), makeQuestion("q2", { title: "Two" })];
  const submitAnswer = vi.fn().mockImplementation(async ({ questionId, optionId }) => ({
    questionId, chosenOptionId: optionId, correct: optionId === `${questionId}-a`, correctOptionId: `${questionId}-a`,
    explanations: { [`${questionId}-a`]: `why ${questionId}` }, docsUrl: null,
  }));
  renderWith({ getQuestions: vi.fn().mockResolvedValue(qs), submitAnswer });
  await screen.findByRole("heading", { name: "One" });
  expect(screen.getByText(/only 2 questions available/i)).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]); // correct
  await screen.findByRole("heading", { name: "Two" });
  expect(screen.queryByText("why q1")).not.toBeInTheDocument(); // no feedback mid-exam
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[1]); // wrong
  expect(await screen.findByText(/1 \/ 2 \(50%\)/)).toBeInTheDocument();
  expect(screen.getByText("why q1")).toBeInTheDocument();
  expect(screen.getByText("why q2")).toBeInTheDocument();
});

it("shows empty state when nothing matches", async () => {
  renderWith({ getQuestions: vi.fn().mockResolvedValue([]), submitAnswer: vi.fn() });
  expect(await screen.findByText(/no questions match/i)).toBeInTheDocument();
});

it("registers beforeunload only while answering", async () => {
  const add = vi.spyOn(window, "addEventListener");
  renderWith({ getQuestions: vi.fn().mockResolvedValue([makeQuestion("q1")]), submitAnswer: vi.fn() });
  await screen.findByRole("heading", { name: "q1" });
  expect(add.mock.calls.some(([t]) => t === "beforeunload")).toBe(true);
});
```

- [ ] **Step 3: Run.** → FAIL.

- [ ] **Step 4: Countdown.** `src/game/use-countdown.ts`:

```ts
"use client";
import { useEffect, useRef, useState } from "react";

export function useCountdown(seconds: number | null, resetKey: string, onExpire: () => void): number | null {
  const [remaining, setRemaining] = useState(seconds);
  const expire = useRef(onExpire);
  expire.current = onExpire;

  useEffect(() => {
    setRemaining(seconds);
    if (seconds === null) return;
    const deadline = Date.now() + seconds * 1000;
    let fired = false;
    const id = setInterval(() => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0 && !fired) { fired = true; clearInterval(id); expire.current(); }
    }, 250);
    return () => clearInterval(id);
  }, [seconds, resetKey]);

  return seconds === null ? null : remaining;
}
```

- [ ] **Step 5: ExamGame and ExamReview.** Add to `en.json`: `"exam": { "progress": "Question {n} of {total}", "short": "Only {n} questions available for this selection.", "result": "Your score", "byTopic": "By topic", "byLevel": "By level", "timeLeft": "{s}s left", "newBest": "New personal best!" }`.

`src/app/play/exam/ExamGame.tsx`:

```tsx
"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ErrorRetry } from "@/components/quiz/ErrorRetry";
import { QuestionView } from "@/components/quiz/QuestionView";
import { useShuffledOptions } from "@/components/quiz/useShuffledOptions";
import type { AnswerResult, SessionConfig } from "@/domain/types";
import { examReducer, initialExamState, summarizeExam } from "@/engine/exam";
import { levelParam } from "@/engine/session-config";
import { useAnswerSubmitter } from "@/game/use-answer-submitter";
import { useCountdown } from "@/game/use-countdown";
import { useGameServices } from "@/game/services";
import en from "@/messages/en.json";
import { ExamReview } from "./ExamReview";

const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));

export function ExamGame({ config }: { config: SessionConfig }) {
  const { api, anonId, progress } = useGameServices();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, dispatch] = useReducer(examReducer, initialExamState);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const recorded = useRef(false);
  const onResult = useCallback((result: AnswerResult) => dispatch({ type: "ANSWER_RESULT", result }), []);
  const submitter = useAnswerSubmitter(api, { anonId, sessionId, mode: "exam" }, onResult);
  const current = state.status === "answering" ? state.questions[state.index] : null;
  const options = useShuffledOptions(current);
  const remaining = useCountdown(current ? config.timerSeconds : null, current?.id ?? "none", () => {
    if (current) submitter.submit(current.id, null);
  });

  useEffect(() => {
    let alive = true;
    setLoadError(false);
    api.getQuestions({ topics: config.topics, level: levelParam(config.level), exclude: [], limit: config.examLength })
      .then((questions) => alive && dispatch({ type: "QUESTIONS_LOADED", questions, requested: config.examLength }))
      .catch(() => alive && setLoadError(true));
    return () => { alive = false; };
  }, [api, config, attempt]);

  const { markShown } = submitter;
  useEffect(() => { if (current) markShown(); }, [current?.id, markShown]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (state.status !== "answering") return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [state.status]);

  useEffect(() => {
    if (state.status !== "finished" || recorded.current) return;
    recorded.current = true;
    const s = summarizeExam(state);
    setNewBest(progress.recordSession({ mode: "exam", topics: config.topics, level: config.level, answered: s.total,
      correct: s.correct, streak: null, finishedAt: new Date().toISOString() }).newBest);
  }, [state, progress, config]);

  if (loadError) return <ErrorRetry message={en.game.loadFailed} onRetry={() => setAttempt((n) => n + 1)} />;
  if (state.status === "empty") return <p>{en.game.empty}</p>;
  if (state.status === "finished") return <ExamReview state={state} newBest={newBest} persistent={progress.persistent} />;
  if (!current) return null;

  const shortBy = summarizeExam(state).shortBy;
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-neutral-500">
        <span>{fmt(en.exam.progress, { n: state.index + 1, total: state.questions.length })}</span>
        {remaining !== null && <span className={remaining <= 10 ? "font-bold text-rose-600" : ""}>{fmt(en.exam.timeLeft, { s: remaining })}</span>}
      </div>
      {shortBy > 0 && state.index === 0 && <p className="text-amber-600">{fmt(en.exam.short, { n: state.questions.length })}</p>}
      <QuestionView question={current} options={options} result={null} disabled={submitter.pending}
        onSelect={(id) => submitter.submit(current.id, id)} />
      {submitter.error && <ErrorRetry message={en.game.submitFailed} onRetry={submitter.retry} />}
    </div>
  );
}
```

`src/app/play/exam/ExamReview.tsx`:

```tsx
"use client";
import Link from "next/link";
import { QuestionView } from "@/components/quiz/QuestionView";
import { summarizeExam, type ExamState } from "@/engine/exam";
import en from "@/messages/en.json";

export function ExamReview({ state, newBest, persistent }: { state: ExamState; newBest: boolean; persistent: boolean }) {
  const s = summarizeExam(state);
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">{en.exam.result}: {s.correct} / {s.total} ({s.pct}%)</h1>
        {newBest && <p className="text-emerald-600">{en.exam.newBest}</p>}
        {!persistent && <p className="text-sm text-neutral-500">{en.game.notSaved}</p>}
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div><h2 className="font-medium">{en.exam.byTopic}</h2>
            {Object.entries(s.byTopic).map(([k, v]) => <p key={k}>{k}: {v.correct}/{v.total}</p>)}</div>
          <div><h2 className="font-medium">{en.exam.byLevel}</h2>
            {Object.entries(s.byLevel).map(([k, v]) => <p key={k}>L{k}: {v.correct}/{v.total}</p>)}</div>
        </div>
        <Link href="/play" className="mt-4 inline-block rounded bg-sky-600 px-4 py-2 text-white">{en.game.changeSetup}</Link>
      </section>
      {state.questions.map((q, i) => (
        <section key={q.id} className="border-t pt-6">
          <QuestionView question={q} options={q.options} result={state.results[i]} disabled onSelect={() => {}} />
        </section>
      ))}
    </div>
  );
}
```

`src/app/play/exam/page.tsx`: same as the Practice page, but with `parseSessionConfig("exam", ...)` and `<ExamGame>`.

- [ ] **Step 6: Run.** → PASS. **Step 7: Commit.** `git commit -m "feat(ui): exam mode with timer and review"`

---

### Task 15: Survival mode page and game over

**Files:**
- Create: `src/app/play/survival/page.tsx`, `src/app/play/survival/SurvivalGame.tsx`
- Modify: `src/messages/en.json`
- Test: `src/app/play/survival/SurvivalGame.test.tsx`

**Interfaces:**
- Consumes: `survivalReducer`, `initialSurvivalState`, `nextSurvivalLevel` (Task 7), `bestKey` (Task 8), `toSearchParams` (Task 5), plus the shared UI.
- Produces: `<SurvivalGame config />`.

**Behaviour:** the run stays at `config.level` (always 1–5 for survival; `parseSessionConfig` guarantees it). A wrong answer → "Game over" with the missed question. Running out of the level's questions → "Level N cleared!" with a link that starts a **new run** at N+1 (none at level 5). Both record the session and show the per-level personal best. If the level has no questions at all (cleared with streak 0), show `en.game.empty` and record nothing.

- [ ] **Step 1: Write the failing tests.** Use the same harness as Task 13 (mocks for `CodeBlock` and an identity `shuffle`), with config `{ mode: "survival", topics: ["sql"], level: 1, examLength: 10, timerSeconds: null }`.

```tsx
const submitAnswer = vi.fn().mockImplementation(async ({ questionId, optionId }) => ({
  questionId, chosenOptionId: optionId, correct: optionId.endsWith("-a"), correctOptionId: `${questionId}-a`,
  explanations: { [`${questionId}-a`]: "why" }, docsUrl: null,
}));
const renderGame = (getQuestions: ReturnType<typeof vi.fn>, progress = new LocalProgressStore(null)) => {
  render(
    <GameServicesProvider services={{ api: { getQuestions, submitAnswer } as unknown as QuizApi, progress, anonId: "a" }}>
      <SurvivalGame config={config} />
    </GameServicesProvider>,
  );
  return progress;
};
const answerRight = async (id: string) => {
  await screen.findByRole("heading", { name: id });
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]);
  await userEvent.click(await screen.findByRole("button", { name: /next/i }));
};

it("stays at the chosen level, ends on a wrong answer, records the per-level best", async () => {
  let n = 0;
  const getQuestions = vi.fn().mockImplementation(async () => [makeQuestion(`q${n++}`)]);
  const progress = renderGame(getQuestions);
  for (let i = 0; i < 5; i++) await answerRight(`q${i}`);
  expect(getQuestions).toHaveBeenLastCalledWith(expect.objectContaining({ level: 1, exclude: ["q0", "q1", "q2", "q3", "q4"] }));
  await screen.findByRole("heading", { name: "q5" });
  expect(screen.getByText(/level 1/i)).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[1]);
  expect(await screen.findByText(/game over/i)).toBeInTheDocument();
  expect(screen.getByText(/streak: 5/i)).toBeInTheDocument();
  expect(screen.getByText(/new personal best/i)).toBeInTheDocument();
  expect(progress.getPersonalBest("survival", "sql@1")).toBe(5);
});

it("clearing the level ends the run and offers a new run one level up", async () => {
  const getQuestions = vi.fn()
    .mockResolvedValueOnce([makeQuestion("q0")])
    .mockResolvedValueOnce([makeQuestion("q1")])
    .mockResolvedValue([]);
  const progress = renderGame(getQuestions);
  await answerRight("q0");
  await answerRight("q1");
  expect(await screen.findByText(/level 1 cleared/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /go to level 2/i })).toHaveAttribute("href", "/play/survival?topics=sql&level=2");
  expect(progress.getPersonalBest("survival", "sql@1")).toBe(2);
});
```

- [ ] **Step 2: Run.** → FAIL.

- [ ] **Step 3: Implement.** Add to `en.json`: `"survival": { "streak": "Streak: {n}", "level": "Level {n}", "over": "Game over", "cleared": "Level {n} cleared!", "clearedHint": "You've answered every level {n} question.", "nextLevel": "Go to level {n}", "best": "Personal best: {n}", "newBest": "New personal best!", "missed": "The question that got you:", "again": "Play again" }`.

`src/app/play/survival/SurvivalGame.tsx`:

```tsx
"use client";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ErrorRetry } from "@/components/quiz/ErrorRetry";
import { QuestionView } from "@/components/quiz/QuestionView";
import { ReportDialog } from "@/components/quiz/ReportDialog";
import { useShuffledOptions } from "@/components/quiz/useShuffledOptions";
import type { AnswerResult, Level, SessionConfig } from "@/domain/types";
import { toSearchParams } from "@/engine/session-config";
import { initialSurvivalState, nextSurvivalLevel, survivalReducer } from "@/engine/survival";
import { useAnswerSubmitter } from "@/game/use-answer-submitter";
import { useGameServices } from "@/game/services";
import { bestKey } from "@/progress/store";
import en from "@/messages/en.json";

const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));

export function SurvivalGame({ config }: { config: SessionConfig }) {
  const level = config.level as Level; // parseSessionConfig never yields "mixed" for survival
  const { api, anonId, progress } = useGameServices();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, dispatch] = useReducer(survivalReducer, level, initialSurvivalState);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const recorded = useRef(false);
  const onResult = useCallback((result: AnswerResult) => dispatch({ type: "ANSWER_RESULT", result }), []);
  const submitter = useAnswerSubmitter(api, { anonId, sessionId, mode: "survival" }, onResult);
  const options = useShuffledOptions(state.current ?? state.missed?.question ?? null);

  useEffect(() => {
    if (state.status !== "loading") return;
    let alive = true;
    setLoadError(false);
    api.getQuestions({ topics: config.topics, level: state.level, exclude: state.seenIds, limit: 1 })
      .then(([q]) => alive && dispatch(q ? { type: "QUESTION_LOADED", question: q } : { type: "POOL_EXHAUSTED" }))
      .catch(() => alive && setLoadError(true));
    return () => { alive = false; };
  }, [state.status, state.level, state.seenIds, api, config.topics, attempt]);

  const { markShown } = submitter;
  useEffect(() => { if (state.status === "answering") markShown(); }, [state.status, state.current?.id, markShown]);

  const ended = state.status === "over" || (state.status === "cleared" && state.streak > 0);
  useEffect(() => {
    if (!ended || recorded.current) return;
    recorded.current = true;
    setNewBest(progress.recordSession({
      mode: "survival", topics: config.topics, level: state.level,
      answered: state.streak + (state.status === "over" ? 1 : 0), correct: state.streak, streak: state.streak,
      finishedAt: new Date().toISOString(),
    }).newBest);
  }, [ended, state, progress, config.topics]);

  if (loadError) return <ErrorRetry message={en.game.loadFailed} onRetry={() => setAttempt((n) => n + 1)} />;
  if (state.status === "cleared" && state.streak === 0) return <p>{en.game.empty}</p>;

  if (ended) {
    const best = progress.getPersonalBest("survival", bestKey("survival", config.topics, state.level));
    const next = state.status === "cleared" ? nextSurvivalLevel(state.level) : null;
    return (
      <div className="space-y-6">
        <section>
          <h1 className="text-2xl font-bold">{state.status === "cleared" ? fmt(en.survival.cleared, { n: state.level }) : en.survival.over}</h1>
          {state.status === "cleared" && <p>{fmt(en.survival.clearedHint, { n: state.level })}</p>}
          <p>{fmt(en.survival.streak, { n: state.streak })} · {fmt(en.survival.level, { n: state.level })}</p>
          {newBest ? <p className="text-emerald-600">{en.survival.newBest}</p> : best !== null && <p>{fmt(en.survival.best, { n: best })}</p>}
          {!progress.persistent && <p className="text-sm text-neutral-500">{en.game.notSaved}</p>}
          <div className="mt-3 flex gap-3">
            {next && (
              <Link href={`/play/survival?${toSearchParams({ ...config, level: next })}`} className="rounded bg-emerald-600 px-4 py-2 text-white">
                {fmt(en.survival.nextLevel, { n: next })}
              </Link>
            )}
            <button type="button" onClick={() => window.location.reload()} className="rounded bg-sky-600 px-4 py-2 text-white">{en.survival.again}</button>
            <Link href="/play" className="rounded border px-4 py-2">{en.game.changeSetup}</Link>
          </div>
        </section>
        {state.missed && (
          <>
            <h2 className="font-medium">{en.survival.missed}</h2>
            <QuestionView question={state.missed.question} options={options} result={state.missed.result} disabled onSelect={() => {}} />
            <ReportDialog api={api} anonId={anonId} questionId={state.missed.question.id} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span>{fmt(en.survival.streak, { n: state.streak })}</span>
        <span className="font-semibold">{fmt(en.survival.level, { n: state.level })}</span>
      </div>
      {state.current && (
        <>
          <QuestionView question={state.current} options={options}
            result={state.status === "feedback" ? state.lastResult : null}
            disabled={state.status !== "answering" || submitter.pending}
            onSelect={(id) => submitter.submit(state.current!.id, id)} />
          {submitter.error && <ErrorRetry message={en.game.submitFailed} onRetry={submitter.retry} />}
          {state.status === "feedback" && (
            <div className="flex items-center justify-between">
              <p className="text-emerald-600">{en.game.correct}</p>
              <button type="button" onClick={() => dispatch({ type: "NEXT" })} className="rounded bg-sky-600 px-4 py-2 text-white">{en.game.next}</button>
            </div>
          )}
          <ReportDialog api={api} anonId={anonId} questionId={state.current.id} />
        </>
      )}
    </div>
  );
}
```

`src/app/play/survival/page.tsx`: same pattern as Practice, with `parseSessionConfig("survival", ...)`, rendering `<SurvivalGame key={toSearchParams(config)} config={config} />`. The `key` matters: "Go to level N+1" is a client-side navigation to the same route, and the key forces a fresh run (new reducer state and session id).

- [ ] **Step 4: Run.** → PASS. **Step 5: Commit.** `git commit -m "feat(ui): fixed-level survival with game over and level-up offer"`

---

### Task 16: E2E tests with fixture content and the CI database/e2e job

**Files:**
- Create: `scripts/gen-fixtures.ts`, `fixtures/content/sql/level-{1,2}/*.yaml` (generated), `playwright.config.ts`, `e2e/practice.spec.ts`, `e2e/exam.spec.ts`, `e2e/survival.spec.ts`
- Modify: `.github/workflows/ci.yml` (add the `db-e2e` job)

**Interfaces:**
- Consumes: the whole app, `pnpm seed`, and `scripts/local-supabase-env.sh`.

- [ ] **Step 1: Fixture generator.** `scripts/gen-fixtures.ts` (run once; commit the output):

```ts
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
```

Run `pnpm tsx scripts/gen-fixtures.ts && pnpm tsx scripts/validate-content.ts fixtures/content`. Expected: `8 valid (8 approved...), 0 errors`.

- [ ] **Step 2: Playwright.** Run `pnpm add -D @playwright/test && pnpm exec playwright install --with-deps chromium`. Then `playwright.config.ts`:

```ts
import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure" },
  webServer: { command: "pnpm build && pnpm start -p 3100", port: 3100, reuseExistingServer: !process.env.CI, timeout: 180_000 },
});
```

(Vitest already excludes `e2e/**`; that was set in Task 1.)

- [ ] **Step 3: Write the specs.** `e2e/practice.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("practice: answer shows explanations for all options", async ({ page }) => {
  await page.goto("/play/practice?topics=sql&level=1");
  await expect(page.getByRole("heading", { name: /Fixture sql-l1-/ })).toBeVisible();
  await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "right-" }).click();
  await expect(page.getByText("Correct!")).toBeVisible();
  await expect(page.getByText(/Explanation nope 3/)).toBeVisible();
  await page.getByRole("button", { name: /next question/i }).click();
  await expect(page.getByRole("heading", { name: /Fixture sql-l1-/ })).toBeVisible();
});
```

`e2e/exam.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("exam: shortfall notice, no mid-exam feedback, review at end", async ({ page }) => {
  await page.goto("/play/exam?topics=sql&level=2&length=10");
  await expect(page.getByText(/only 2 questions available/i)).toBeVisible();
  await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "right-" }).click();
  await expect(page.getByText(/Explanation right/)).toHaveCount(0);
  await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "nope-" }).first().click();
  await expect(page.getByText(/1 \/ 2 \(50%\)/)).toBeVisible();
});

test("exam: setup flow from /play", async ({ page }) => {
  await page.goto("/play");
  await page.getByText("Exam", { exact: true }).click();
  await page.getByRole("checkbox", { name: "spark" }).uncheck();
  await page.getByRole("button", { name: "Start" }).click();
  await expect(page).toHaveURL(/\/play\/exam\?topics=sql/);
});
```

`e2e/survival.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

test("survival: stays at level 1, wrong answer ends run", async ({ page }) => {
  await page.goto("/play/survival?topics=sql&level=1");
  for (let i = 0; i < 5; i++) {
    await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "right-" }).click();
    await page.getByRole("button", { name: /next question/i }).click();
  }
  await expect(page.getByText("Level 1", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "nope-" }).first().click();
  await expect(page.getByText("Game over")).toBeVisible();
  await expect(page.getByText(/Streak: 5/)).toBeVisible();
  await expect(page.getByText(/new personal best/i)).toBeVisible();
});

test("survival: clearing a level offers a new run one level up", async ({ page }) => {
  await page.goto("/play/survival?topics=sql&level=2"); // the fixture bank has 2 level-2 questions
  for (let i = 0; i < 2; i++) {
    await page.getByRole("button", { name: /^Option/ }).filter({ hasText: "right-" }).click();
    await page.getByRole("button", { name: /next question/i }).click();
  }
  await expect(page.getByText("Level 2 cleared!")).toBeVisible();
  await page.getByRole("link", { name: "Go to level 3" }).click();
  await expect(page).toHaveURL(/\/play\/survival\?topics=sql&level=3/);
});
```

- [ ] **Step 4: Run locally.**

```bash
pnpm dlx supabase db reset
bash scripts/local-supabase-env.sh > .env.local && set -a && . ./.env.local && set +a
pnpm seed fixtures/content && pnpm e2e
```

Expected: 4 passed.

- [ ] **Step 5: Add the CI job** (append under `jobs:` in `ci.yml`):

```yaml
  db-e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: pnpm install --frozen-lockfile
      - run: supabase start -x studio,imgproxy,inbucket,edge-runtime,logflare,vector
      - run: supabase test db
      - run: SUPABASE_BIN=supabase bash scripts/local-supabase-env.sh >> "$GITHUB_ENV"
      - run: pnpm seed fixtures/content
      - run: pnpm exec playwright install --with-deps chromium
      - run: pnpm e2e
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: playwright-report, path: test-results }
```


- [ ] **Step 6: Commit.** `git commit -m "test(e2e): fixture bank, playwright specs and CI db/e2e job"`

---

# Milestone M4 — Content & Launch

### Task 17: Content authoring guide, generation prompt and PR template

**Files:**
- Create: `docs/content-guide.md`, `docs/content-prompt.md`, `.github/pull_request_template.md`, `.github/ISSUE_TEMPLATE/content-batch.md`

- [ ] **Step 1: Write `docs/content-guide.md`.** It must contain:
  1. The level rubric table, copied verbatim from spec §2.2.
  2. The YAML format, copied from spec §2.3, with one fully worked example per topic: a Spark L3 window-function question, a SQL L4 `DISTINCT ON` dedup question, and a Git L4 reflog-recovery question.
  3. **The review checklist** (each item a checkbox, copied into every content PR):
     - The correct answer actually runs and produces the stated result. Run Spark/SQL snippets locally (`pyspark` shell; PostgreSQL 17 via `psql` for SQL; a git sandbox repo for Git).
     - Each wrong option is wrong for **one specific, teachable reason**, and the explanation names that reason.
     - Wrong options are plausible: no syntax-error strawmen at L3+.
     - The correct option isn't identifiable by length or style. Option lengths are within ~30% of each other, and the correct option isn't always the most "complete-looking".
     - The prompt is a business or technical scenario, not a trivia question.
     - The level matches the rubric.
     - It isn't a near-duplicate of an existing question (`grep` the tags and title).
     - `docs_url` points to official documentation (Spark, postgresql.org or git-scm).
  4. **Batch workflow:** branch `content/<topic>-l<n>-batch-<k>` → Claude drafts 20 using `docs/content-prompt.md` → `pnpm content:validate` → PR with the checklist → owner reviews, edits and flips `draft` to `approved` → merge.
  5. **Id allocation:** take the next free 4-digit number per topic and level. Never reuse a retired id.

- [ ] **Step 2: Write `docs/content-prompt.md`.** This is the reusable prompt for drafting a batch. Its inputs are `{topic}`, `{level}`, `{count}`, `{existing_titles}` and `{rubric_row}`. It must instruct the model to:
  - output YAML files in the exact format;
  - set `status: draft`;
  - write business-scenario prompts;
  - write PySpark-only Spark code / PostgreSQL-only SQL;
  - make each wrong option wrong for one specific reason;
  - keep option lengths balanced;
  - include `docs_url`;
  - avoid duplicating any of `{existing_titles}`.

- [ ] **Step 3: Write `.github/pull_request_template.md`.** It has a "Closes #" line, a summary, a test checklist (`pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate`) and a collapsible "Content review checklist" section (the list from Step 1).

- [ ] **Step 4: Commit.** `git commit -m "docs(content): authoring guide, generation prompt and PR template"`

---

### Task 18: Content bank — PySpark L1–L5 (100 questions)

**Files:** `content/spark/level-{1..5}/spark-l{n}-00{01..20}.yaml`

- [ ] For each level n = 1…5, as a separate PR per level:
  - [ ] Draft 20 questions with `docs/content-prompt.md` (topic `spark`, level n). Spread them across the rubric row's subtopics: at least 4 distinct tags per level.
  - [ ] Run `pnpm content:validate`. Expected: 0 errors.
  - [ ] Execute every correct-option snippet against a local `pyspark` session with a tiny DataFrame matching the question's `context`. Confirm the stated result and confirm that each wrong option is actually wrong in the way its explanation says.
  - [ ] Go through the review checklist in the PR, flip to `approved`, and merge.
- [ ] Done when: `pnpm content:validate` reports ≥ 100 approved `spark` questions with ≥ 20 per level.

### Task 19: Content bank — SQL L1–L5 (100 questions)

**Files:** `content/sql/level-{1..5}/sql-l{n}-00{01..20}.yaml`

- [x] For each level n = 1…5, as a separate PR per level (L1–L5: PRs #56–#60):
  - [x] Draft 20 questions (topic `sql`). All SQL is PostgreSQL 17.
  - [x] Run `pnpm content:validate` → 0 errors.
  - [x] Execute every option in PostgreSQL 17 (`psql` against a scratch database) with a tiny dataset from `context`. *Done with the Supabase MCP `execute_sql` against the prod project instead: one schema per question, all inside `begin … rollback`. EXPLAIN/index questions compared plans, and DML questions compared table snapshots.*
  - [x] Go through the review checklist, approve and merge.
- [x] Done when: ≥ 100 approved `sql` questions, ≥ 20 per level.

### Task 20: Content bank — Git L1–L5 (100 questions) and the content quality report

**Files:** `content/git/level-{1..5}/git-l{n}-00{01..20}.yaml`, `supabase/migrations/20261002000100_question_stats.sql`, `scripts/flagged-questions.ts`

- [ ] **Content.** For each level n = 1…5, as a separate PR per level:
  - draft 20 (topic `git`, options are command sequences);
  - validate;
  - replay each correct option in a throwaway repo (`git init /tmp/g && cd /tmp/g && ...`) to confirm the end state the prompt describes;
  - review, approve, merge.
- [ ] **Stats view.** Write the failing pgTAP test first: append to `supabase/tests/database/rpc.test.sql` (bump `plan(10)` → `plan(11)`), before the rate-limit block and while still `set local role anon`:

```sql
select throws_ok($$ select * from public.question_stats $$, '42501', null, 'anon cannot read question_stats');
```

Run `pnpm dlx supabase test db` → FAIL (relation does not exist). Then create the migration `supabase/migrations/20261002000100_question_stats.sql`:

```sql
create view public.question_stats with (security_invoker = true) as
select q.id, q.topic, q.level, q.title,
       count(e.id) as attempts,
       round(avg(case when e.correct then 1 else 0 end)::numeric * 100, 1) as accuracy_pct,
       (select count(*) from public.question_reports r where r.question_id = q.id and not r.resolved) as open_reports
from public.questions q
left join public.answer_events e on e.question_id = q.id
where q.active
group by q.id;
revoke all on public.question_stats from anon, authenticated;
```

Run `pnpm dlx supabase db reset && pnpm dlx supabase test db` → 11 pass.
- [ ] **Flag script.** `scripts/flagged-questions.ts`:

```ts
import { createClient } from "@supabase/supabase-js";

async function main() {
  const db = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, { auth: { persistSession: false } });
  const { data, error } = await db.from("question_stats").select("*")
    .or("open_reports.gt.0,and(attempts.gte.20,accuracy_pct.lt.25),and(attempts.gte.20,accuracy_pct.gt.95)")
    .order("open_reports", { ascending: false });
  if (error) { console.error(error.message); process.exit(1); }
  console.table(data);
}

void main();
```

Manual check: seed the fixtures, answer a fixture question wrong 20 times via practice e2e or SQL inserts, and run `pnpm content:flagged` → the question is listed. Document `pnpm content:flagged` in `docs/content-guide.md` under "Weekly triage".
- [ ] Done when: ≥ 100 approved `git` questions (≥ 20 per level), the migration is applied, and the flag script works.

---

### Task 21: Production deploy — Supabase project, Vercel and the deploy workflow

**Files:**
- Create: `.github/workflows/deploy.yml`
- Modify: `README.md` (deploy section)

- [ ] **Step 1: Create the Supabase project** (region close to your users, e.g. `eu-west-1`). Record the project ref, `SUPABASE_URL`, the publishable key and the secret key.
- [ ] **Step 2: Add GitHub secrets.** `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF`, `SUPABASE_DB_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
- [ ] **Step 3: Write the deploy workflow.** `.github/workflows/deploy.yml`:

```yaml
name: Deploy DB & content
on:
  push:
    branches: [main]
concurrency: { group: deploy-prod, cancel-in-progress: false }
jobs:
  db-and-content:
    runs-on: ubuntu-latest
    environment: production
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version-file: .nvmrc, cache: pnpm }
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: pnpm install --frozen-lockfile
      - run: pnpm content:validate
      - run: supabase link --project-ref "$SUPABASE_PROJECT_REF"
        env: { SUPABASE_ACCESS_TOKEN: "${{ secrets.SUPABASE_ACCESS_TOKEN }}", SUPABASE_PROJECT_REF: "${{ secrets.SUPABASE_PROJECT_REF }}", SUPABASE_DB_PASSWORD: "${{ secrets.SUPABASE_DB_PASSWORD }}" }
      - run: supabase db push
        env: { SUPABASE_ACCESS_TOKEN: "${{ secrets.SUPABASE_ACCESS_TOKEN }}", SUPABASE_DB_PASSWORD: "${{ secrets.SUPABASE_DB_PASSWORD }}" }
      - run: pnpm seed content
        env: { SUPABASE_URL: "${{ secrets.SUPABASE_URL }}", SUPABASE_SECRET_KEY: "${{ secrets.SUPABASE_SECRET_KEY }}" }
```

- [ ] **Step 4: Vercel.** Import the GitHub repo in Vercel (framework: Next.js, install `pnpm install`). Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview. Previews point at the production Supabase project in the MVP: reads are harmless, and telemetry from previews is tagged by session only. A staging project can come later.
- [ ] **Step 5: Verify.**
  - Merge to `main` → the deploy workflow is green.
  - The Supabase dashboard shows the migrations and about 300 active questions.
  - The Vercel production URL plays all 3 modes.
  - Supabase → Advisors (security) shows no RLS or `search_path` warnings.
  - In the browser devtools network tab, the `get_questions` response contains no `is_correct` or explanation fields.
- [ ] **Step 6: README.** Add a "Deploy" section (secrets list, Vercel env vars) and a link to the live URL. **Commit:** `git commit -m "ci: production deploy of migrations and content"`

---

# Post-MVP roadmap (each milestone gets its own brainstorm → spec → plan before work starts)

These are tracked as GitHub issues with acceptance criteria only. They are **not** detailed here on purpose: each depends on decisions that should be made once the MVP has real usage data.

- **M5 – Accounts:**
  - Supabase Auth (GitHub, Google, magic link) with protected `/me` routes.
  - `SupabaseProgressStore`, plus a one-time import of localStorage history on first login.
  - A stats dashboard (accuracy by topic and level, weakest tags, history).
  - A Survival leaderboard, validated server-side by replaying the session's `answer_events`. Before it ships, decide whether `content/` moves to a private repo, because the answer key is public.
- **M6 – Spaced repetition:** a Review mode that resurfaces questions answered wrong, on an SM-2 schedule (requires M5).
- **M7 – Spot the bug / Optimize it:** a new `kind: spot_the_bug` question style that still uses 4 code options, plus a content batch.
- **M8 – Explain-plan reader:** adds `option_kind: code | text` to the schema and DB, a plan renderer, and a content batch.
- **M9 – Pipeline Builder + modeling topic:** a drag-and-drop ordering puzzle, a new `modeling` topic (star schema, SCD2) and its content.
