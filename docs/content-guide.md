# Content authoring guide

This guide covers how to write, review and ship questions for the Skewed question bank. Every question is a YAML file in `content/`. CI validates it, and on merge to `main` the seed script loads it into Supabase. Only questions with `status: approved` go live.

- Generation prompt for a batch: [content-prompt.md](content-prompt.md)
- Design spec: [superpowers/specs/2026-10-02-skewed-design.md](superpowers/specs/2026-10-02-skewed-design.md)

## Topics and conventions

| Topic | Convention |
|---|---|
| `spark` | **PySpark only** (DataFrame API; `spark.sql` allowed when idiomatic). |
| `sql` | **ANSI SQL**; when a feature is engine-specific (e.g. `QUALIFY`, `MERGE` variants) the question sets `dialect` (`postgres`, `snowflake`, `bigquery`, `spark-sql`) and the UI shows a badge. |
| `git` | Options are git command sequences (shell). |

Every question has **exactly 4 code options and exactly 1 correct**.

## Level rubric

| Level | Name | Spark | SQL | Git |
|---|---|---|---|---|
| 1 | Fundamentals | select, filter, withColumn, read/write | SELECT/WHERE/basic JOIN | init, add, commit, branch, checkout/switch |
| 2 | Practitioner | groupBy/agg, joins, null handling basics | GROUP BY/HAVING, CTEs, outer joins | merge, rebase basics, remotes, stash |
| 3 | Intermediate | window functions, null semantics, explode/structs | window functions, anti/semi joins, CASE logic | interactive rebase, reset vs revert, conflict resolution |
| 4 | Advanced | partitioning, skew, broadcast, caching, UDF pitfalls | gaps & islands, SCD2 MERGE, QUALIFY, dedup patterns | reflog recovery, cherry-pick conflicts, rewriting shared history |
| 5 | Expert | AQE, plan-driven optimization, structured streaming watermarks, Delta MERGE semantics | performance-aware rewrites, engine-specific semantics, recursive CTEs | bisect, filter-repo, submodule/subtree edge cases, worktrees |

## File format

Each file is stored at `content/{topic}/level-{n}/{id}.yaml`:

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

`pnpm content:validate` checks every file and fails CI if any of these break:

- exactly 4 options, exactly 1 with `correct: true`;
- every option `code` is unique and non-empty, and every option has a non-empty `explanation`;
- `id` matches `^(spark|sql|git)-l[1-5]-\d{4}$`, is unique across the repo and equals the filename;
- `topic` and `level` match the folder and the id prefix;
- `dialect` appears only on `sql` questions;
- `title` is at most 120 characters, and `docs_url` is a valid URL when present.

`status` controls what goes live: `draft` is in review, `approved` is served to players, and `retired` is pulled from play but keeps its id and telemetry.

### Worked example: Spark L3 (window functions)

`content/spark/level-3/spark-l3-0001.yaml`

```yaml
id: spark-l3-0001
topic: spark
level: 3
title: Running total of spend per customer
prompt: |
  Finance wants every order row to carry the customer's cumulative spend up to and
  including that order, so they can spot the order where a customer crosses a
  loyalty threshold. Keep one output row per input order. Two orders from the same
  customer can share an `order_ts`; break ties by `order_id`.
context: |
  `df` has columns `customer_id`, `order_id`, `order_ts`, `amount`.
  `F` is `pyspark.sql.functions` and `Window` is `pyspark.sql.Window`.
options:
  - code: |
      w = (Window.partitionBy("customer_id").orderBy("order_ts", "order_id")
           .rowsBetween(Window.unboundedPreceding, Window.currentRow))
      df.withColumn("running_total", F.sum("amount").over(w))
    correct: true
    explanation: >-
      The ordered row frame sums from the first order up to the current row, and the
      order_id tiebreaker gives orders that share a timestamp their own totals.
  - code: |
      w = Window.partitionBy("customer_id").orderBy("order_ts")
      df.withColumn("running_total", F.sum("amount").over(w))
    correct: false
    explanation: >-
      With only orderBy, the default frame is RANGE up to the current row, so
      orders that share an order_ts are summed together and get the same total.
  - code: |
      w = Window.partitionBy("customer_id")
      df.withColumn("running_total", F.sum("amount").over(w))
    correct: false
    explanation: >-
      A window without orderBy covers the whole partition, so every row gets the
      customer's lifetime total instead of a running total.
  - code: |
      (df.groupBy("customer_id")
         .agg(F.sum("amount").alias("running_total")))
    correct: false
    explanation: >-
      groupBy collapses the orders into one row per customer, so the per-order rows
      the prompt asks to keep are lost.
tags: [window-functions, running-total, window-frames]
docs_url: https://spark.apache.org/docs/latest/api/python/reference/pyspark.sql/api/pyspark.sql.Window.rowsBetween.html
status: approved
```

### Worked example: SQL L4 (`QUALIFY`, Snowflake)

`content/sql/level-4/sql-l4-0001.yaml`

```yaml
id: sql-l4-0001
topic: sql
level: 4
title: Keep the latest CDC record per customer
prompt: |
  A CDC feed lands every change to a customer as a new row in `customer_changes`.
  The marketing team wants a current snapshot: exactly one row per customer, with
  all columns taken from that customer's most recent change. A bulk backfill can
  give two changes the same `updated_at`; in that case either row is acceptable.
context: |
  customer_changes(customer_id, email, plan, updated_at)
dialect: snowflake
options:
  - code: |
      SELECT *
      FROM customer_changes
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY customer_id ORDER BY updated_at DESC) = 1;
    correct: true
    explanation: >-
      QUALIFY filters on the window result after it is computed, and ROW_NUMBER
      numbers ties uniquely, so exactly one latest row per customer survives.
  - code: |
      SELECT *
      FROM customer_changes
      QUALIFY ROW_NUMBER() OVER (
        PARTITION BY customer_id ORDER BY updated_at) = 1;
    correct: false
    explanation: >-
      The window is ordered ascending, so row number 1 is each customer's oldest
      change, not the latest one.
  - code: |
      SELECT customer_id, MAX(email) AS email,
             MAX(plan) AS plan, MAX(updated_at) AS updated_at
      FROM customer_changes
      GROUP BY customer_id;
    correct: false
    explanation: >-
      Each MAX is computed on its own, so email and plan can come from different
      changes than the latest updated_at, mixing values across rows.
  - code: |
      SELECT *
      FROM customer_changes
      QUALIFY RANK() OVER (
        PARTITION BY customer_id ORDER BY updated_at DESC) = 1;
    correct: false
    explanation: >-
      RANK gives tied rows the same value, so a customer with two changes at the
      latest updated_at keeps both rows instead of exactly one.
tags: [qualify, dedup, cdc]
docs_url: https://docs.snowflake.com/en/sql-reference/constructs/qualify
status: approved
```

### Worked example: Git L4 (reflog recovery)

`content/git/level-4/git-l4-0001.yaml`

```yaml
id: git-l4-0001
topic: git
level: 4
title: Recover commits after an accidental hard reset
prompt: |
  On your local `feature` branch you made three commits, A, B and C, and never
  pushed them. You then meant to drop only some staged changes, but ran
  `git reset --hard HEAD~3` instead. You have run no other commands since. Get
  `feature` back to pointing at commit C with a clean working tree.
options:
  - code: |
      git reflog
      git reset --hard HEAD@{1}
    correct: true
    explanation: >-
      HEAD@{1} is where HEAD was right before the reset, which is commit C, so a
      hard reset to it moves feature back to C.
  - code: |
      git reflog
      git reset --hard HEAD@{3}
    correct: false
    explanation: >-
      Reflog entries count HEAD movements, not commits. HEAD@{3} is commit A,
      so B and C would still be missing.
  - code: |
      git reflog
      git checkout HEAD@{1}
    correct: false
    explanation: >-
      Checking out the reflog entry detaches HEAD at C, but the feature branch
      itself still points at the commit before A.
  - code: |
      git fetch origin
      git reset --hard origin/feature
    correct: false
    explanation: >-
      The commits were never pushed, so origin/feature does not contain them and
      the reset cannot bring them back.
tags: [reflog, reset, recovery]
docs_url: https://git-scm.com/docs/git-reflog
status: approved
```

## Review checklist

Copy this list into every content PR (the PR template already includes it) and tick it for the batch:

- [ ] The correct answer actually runs and produces the stated result. Run Spark/SQL snippets locally (DuckDB or `pyspark` shell; a git sandbox repo for Git).
- [ ] Each wrong option is wrong for **one specific, teachable reason**, and the explanation names that reason.
- [ ] Wrong options are plausible: no syntax-error strawmen at L3+.
- [ ] The correct option isn't identifiable by length or style. Option lengths are within ~30% of each other, and the correct option isn't always the most "complete-looking".
- [ ] The prompt is a business or technical scenario, not a trivia question.
- [ ] The level matches the rubric.
- [ ] It isn't a near-duplicate of an existing question (`grep` the tags and title).
- [ ] `docs_url` points to official documentation (Spark, Postgres, Snowflake, BigQuery or git-scm).

## Batch workflow

1. Open a "Content batch" issue for one topic and level.
2. Create a branch named `content/<topic>-l<n>-batch-<k>`, e.g. `content/sql-l4-batch-2`.
3. Claude drafts 20 questions with [content-prompt.md](content-prompt.md). Every file starts as `status: draft`.
4. Run `pnpm content:validate`. It must report 0 errors.
5. Open a PR. The template includes the review checklist.
6. The owner reviews each question, edits it where needed and flips accepted questions from `draft` to `approved`. Delete rejected drafts before merge. Their ids were never published, so they can be reused.
7. Merge. The seed upserts every question, and only `approved` ones go live.

## Id allocation

- Ids are `{topic}-l{level}-{nnnn}`. Numbers count separately for each topic and level, starting at `0001`.
- Take the next free number after the highest existing id in that folder:

  ```bash
  ls content/sql/level-4 | sort | tail -n 1
  ```

- **Never reuse a retired id.** To pull a question from play, set `status: retired` and leave the file in place. Answer and report telemetry reference the id. A reused id would mix the stats of two different questions.
- Never rename or renumber a published question. To fix it, edit it in place under the same id. If the change is substantive, retire it and add a new question with a new id.
