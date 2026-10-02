# Skewed — Data Engineering Drills: Design Spec

**Date:** 2026-10-02
**Status:** Approved design, pending spec review
**Owner:** FranciscoJavierCotos

## 1. Purpose & success

Skewed is a **public web product** where data engineers practice **PySpark, SQL and Git** by answering business/technical questions with **4 code options**, across **5 difficulty levels** and **3 game modes**.

MVP success criteria:
- A visitor can play all three modes as a guest (no login) on a public Vercel URL.
- Launch bank of **~300 reviewed questions** (3 topics × 5 levels × ~20).
- Every answer is logged anonymously so we can find broken/too-easy/too-hard questions.
- Players can report bad questions.
- Correct answers are never exposed to the client before answering.

Non-goals for MVP: login, leaderboards, spaced repetition, non-code question formats, languages other than English, live AI generation.

## 2. Content

### 2.1 Topics & conventions
| Topic | Convention |
|---|---|
| `spark` | **PySpark only** (DataFrame API; `spark.sql` allowed when idiomatic). |
| `sql` | **ANSI SQL**; when a feature is engine-specific (e.g. `QUALIFY`, `MERGE` variants) the question sets `dialect` (`postgres`, `snowflake`, `bigquery`, `spark-sql`) and the UI shows a badge. |
| `git` | Options are git command sequences (shell). |

**Format rule (MVP): strictly 4 code options, exactly one correct.**

### 2.2 Level rubric
| Level | Name | Spark | SQL | Git |
|---|---|---|---|---|
| 1 | Fundamentals | select, filter, withColumn, read/write | SELECT/WHERE/basic JOIN | init, add, commit, branch, checkout/switch |
| 2 | Practitioner | groupBy/agg, joins, null handling basics | GROUP BY/HAVING, CTEs, outer joins | merge, rebase basics, remotes, stash |
| 3 | Intermediate | window functions, null semantics, explode/structs | window functions, anti/semi joins, CASE logic | interactive rebase, reset vs revert, conflict resolution |
| 4 | Advanced | partitioning, skew, broadcast, caching, UDF pitfalls | gaps & islands, SCD2 MERGE, QUALIFY, dedup patterns | reflog recovery, cherry-pick conflicts, rewriting shared history |
| 5 | Expert | AQE, plan-driven optimization, structured streaming watermarks, Delta MERGE semantics | performance-aware rewrites, engine-specific semantics, recursive CTEs | bisect, filter-repo, submodule/subtree edge cases, worktrees |

### 2.3 Question file format
Stored in the repo at `content/{topic}/level-{n}/{id}.yaml`:

```yaml
id: spark-l3-0007            # unique, stable, never reused
topic: spark                 # spark | sql | git
level: 3                     # 1..5
title: Latest order per customer
prompt: |                    # business or technical scenario (markdown)
  The analytics team needs each customer's most recent order...
context: |                   # optional: schema / sample data (markdown)
  orders(customer_id, order_id, order_ts, amount)
dialect: null                # sql only, optional
options:                     # exactly 4
  - code: |
      w = Window.partitionBy("customer_id").orderBy(F.col("order_ts").desc())
      df.withColumn("rn", F.row_number().over(w)).filter("rn = 1")
    correct: true
    explanation: row_number over a descending window keeps exactly one row per customer.
  - code: ...
    correct: false
    explanation: rank() returns ties, so customers with two orders at the same ts appear twice.
  # ... 2 more
tags: [window-functions, dedup]
docs_url: https://spark.apache.org/docs/latest/api/python/...
status: approved             # draft | approved | retired
```

**Validation (Zod, run in CI):** exactly 4 options; exactly 1 `correct: true`; all option `code` unique and non-empty; every option has a non-empty `explanation`; `id` unique across the repo and matches the filename; `topic`/`level` match the folder; `dialect` only on `sql`.

### 2.4 Content pipeline
1. Claude drafts a batch (15–20 questions for one topic and level) as `status: draft` on a branch.
2. The owner reviews it in a PR and flips accepted questions to `approved`.
3. CI validates every file.
4. On merge to `main`, a seed script upserts `approved` questions into Supabase. `retired` questions get `active = false`; nothing is ever hard-deleted, so telemetry keeps its references.

## 3. Game modes

All modes: the player selects **one or more topics**. No question repeats within a session. Option order is shuffled per display.

### 3.1 Practice
- Choose topics plus a level (1–5 or **Mixed**).
- After each answer you see right/wrong immediately, plus the explanation for **every** option and the docs link.
- It's unlimited; an "End session" button shows a small summary (answered, accuracy).
- If the pool runs out, show "You've seen all questions for this selection" and offer to restart.

### 3.2 Exam
- Choose topics, a level (1–5 or Mixed) and a length (**10 / 20 / 40**), with an **optional timer of 60s per question** (off by default).
- No feedback during the exam. Answers are still submitted server-side as they are made (for telemetry), but the result is hidden in the UI.
- When the timer expires, the question is recorded as **unanswered** (counted wrong) and the exam moves on.
- The review screen shows:
  - the score and percentage;
  - a breakdown by topic and level;
  - each question with the player's pick, the correct option and all explanations.
- If the pool is smaller than the chosen length, the exam uses what's available and tells the player.

### 3.3 Survival
- Choose topics. You start at **level 1**, and **every 5 correct answers moves you up a level** (capped at 5).
- **One wrong answer ends the run.** There is no timer in the MVP.
- If the current level's pool runs out, draw from the next level up. At level 5, recycle the least recently seen questions.
- The game-over screen shows the streak, the highest level reached, the question you missed with its explanations, and your personal best (localStorage) with a "New best!" badge.

### 3.4 Game engine
A pure TypeScript module per mode (`src/engine/`), with no React and no I/O. Each one is a reducer, `(state, event) => state`, with these events: `START`, `QUESTION_LOADED`, `ANSWER_RESULT`, `TIMEOUT`, `END`. Fetching questions and submitting answers happen in a thin adapter layer that dispatches events.

## 4. Architecture

```
Browser (Next.js client components)
  ├─ engine/ (pure state machines)
  ├─ ProgressStore (interface) ── LocalProgressStore (localStorage)
  └─ api client ──► Supabase RPCs (anon key)
                       ├─ get_questions(...)   -> questions WITHOUT answers
                       ├─ submit_answer(...)   -> correctness + explanations, logs event
                       └─ report_question(...) -> stores report
Vercel: Next.js App Router (static marketing/landing, client game pages)
Supabase: Postgres + RLS + RPCs (SECURITY DEFINER)
```

### 4.1 Stack
Next.js (App Router), TypeScript (strict), Tailwind CSS, Shiki for highlighting (python, sql, bash), `@supabase/supabase-js`, Zod, Vitest + React Testing Library, Playwright, pnpm. UI strings live in `messages/en.json` (i18n-ready; English only).

### 4.2 Data model (Postgres)
- `questions`: `id text pk`, `topic text check in (spark,sql,git)`, `level int check 1..5`, `title`, `prompt`, `context`, `dialect`, `tags text[]`, `docs_url`, `active bool`, `content_hash text`, `updated_at`.
- `question_options`: `id uuid pk`, `question_id fk`, `position int`, `code text`, `is_correct bool`, `explanation text`. Unique on `(question_id, position)`.
- `answer_events`: `id bigserial`, `anon_id uuid`, `session_id uuid`, `question_id`, `option_id`, `correct bool`, `mode text`, `ms_to_answer int`, `created_at`. A null `option_id` means timed out.
- `question_reports`: `id`, `anon_id`, `question_id`, `reason text check in (wrong_answer, ambiguous, typo, other)`, `note text (≤500)`, `created_at`, `resolved bool`.

### 4.3 Security
- RLS is enabled on all tables, and the `anon` role has **no direct SELECT/INSERT on any table**.
- All access goes through `SECURITY DEFINER` functions with a fixed `search_path`:
  - `get_questions(p_topics text[], p_level int | null, p_exclude text[], p_limit int ≤ 50)` returns questions plus options (`id`, `position`, `code`) **without `is_correct` or explanations**.
  - `submit_answer(p_anon_id, p_session_id, p_question_id, p_option_id | null, p_mode, p_ms)`:
    - validates that the option belongs to the question;
    - inserts into `answer_events`;
    - returns `{correct, correct_option_id, explanations[{option_id, explanation}], docs_url}`.
  - `report_question(p_anon_id, p_question_id, p_reason, p_note)` is rate-limited to **10 reports per anon_id per hour**.
- `anon_id` is a random UUID generated client-side and kept in localStorage. It isn't an identity. It exists only for telemetry and rate limiting.

### 4.4 Guest progress (localStorage)
The `ProgressStore` interface has these methods:
- `getPersonalBest(mode, topicsKey)`
- `recordSession(summary)`
- `getHistory(limit)`
- `getSeenQuestionIds()`

`LocalProgressStore` implements it under a versioned key, `skewed:v1:*`. History is capped at the last 200 sessions. A corrupt or missing store resets safely. `SupabaseProgressStore` arrives in M5.

### 4.5 Pages
| Route | Purpose |
|---|---|
| `/` | Landing: pitch and a "Play as guest" CTA. |
| `/play` | Mode picker plus setup (topics, level, length, timer). |
| `/play/practice`, `/play/exam`, `/play/survival` | Game screens. |
| `/play/exam/review` | Exam review (state is held client-side). |
| `/about` | How levels work and how to report a question. |

### 4.6 Error handling
- If a network or RPC failure happens mid-game, show an inline retry. The engine state is kept, so the answer is retried rather than lost.
- If `get_questions` returns an empty pool, show an "empty selection" message with suggestions.
- If localStorage is unavailable (private mode), the game still runs and personal bests show "not saved".
- RPC errors are logged to the console in dev. In prod the user sees a generic message.

## 5. Testing & CI/CD
- **Unit (Vitest):**
  - engines: Survival ramping and game over, Exam timer and scoring, Practice with no repeats and pool exhaustion;
  - content validator;
  - LocalProgressStore.
- **Database (SQL tests against local Supabase):**
  - the anon role cannot select `question_options.is_correct`;
  - `submit_answer` rejects an option from a different question;
  - the report rate limit works.
- **E2E (Playwright, against local Supabase seeded with fixture questions):** one happy path per mode, plus the Exam review screen.
- **GitHub Actions, on PR:** lint, typecheck, unit tests, content validation, build. Vercel creates a preview deploy for each PR.
- **On merge to main:** `supabase db push` (migrations), then the seed script, then the Vercel production deploy.

## 6. Roadmap (post-MVP milestones)
- **M5 – Accounts:** Supabase Auth with GitHub, Google and magic link; import localStorage history into the account (`SupabaseProgressStore`); a stats dashboard (accuracy by topic and level, weak tags, history); a Survival leaderboard (runs are validated server-side from `answer_events` per session).
- **M6 – Spaced repetition:** wrong answers resurface on an SM-2 schedule in a "Review" mode (requires login).
- **M7 – Spot the bug / Optimize it:** flawed PySpark/SQL jobs where the options are fixes. Fits the 4-code-option format.
- **M8 – Explain-plan reader:** a Spark physical plan or SQL EXPLAIN is shown and the options are interpretations. This is the first non-code format, so the schema gains `option_kind`.
- **M9 – Pipeline Builder:** a drag-and-drop puzzle for ordering pipeline steps, plus a new `modeling` topic (star schema, SCD2).

## 7. Open risks
- **Correctness of AI-drafted content.** Mitigations: every question gets human review, a report button and telemetry, and questions with very low accuracy are flagged for re-review.
- **Option-length bias.** The correct option is often the longest one. The review checklist includes "the correct answer is not visually distinguishable by length or style".
- **Supabase free tier pausing.** Projects pause after 7 days of inactivity. Acceptable for the MVP; upgrade once there are real users.
