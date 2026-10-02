# Content generation prompt

Use this prompt to draft one batch of questions for a single topic and level. Fill in the placeholders, paste everything below the line into Claude, save each returned file to `content/{topic}/level-{level}/{id}.yaml`, then run `pnpm content:validate`. The full review process is in [content-guide.md](content-guide.md).

| Placeholder | What to fill in |
|---|---|
| `{topic}` | `spark`, `sql` or `git` |
| `{level}` | `1`–`5` |
| `{count}` | Number of questions, usually `20` |
| `{first_id}` | First free id for this topic and level, e.g. `sql-l4-0021` (see "Id allocation" in the guide) |
| `{existing_titles}` | Titles already in `content/{topic}/level-{level}/`, one per line. Get them with `grep -h '^title:' content/{topic}/level-{level}/*.yaml` |
| `{rubric_row}` | The `{topic}` cell for `{level}` from the level rubric in the guide |

---

You are writing quiz questions for Skewed, a quick-fire quiz for working data engineers. Write **{count}** new questions for topic **`{topic}`** at level **{level}**.

## What this level covers

{rubric_row}

Spread the batch across these subtopics. Use at least 4 distinct tags, and don't let one subtopic take more than a third of the batch.

## Do not duplicate

These questions already exist. Don't write a question that tests the same idea in the same way as any of them, even with a different title:

```
{existing_titles}
```

## Output format

Output each question as a separate YAML file. Before each file, write a line with its path: `content/{topic}/level-{level}/<id>.yaml`. Number the ids sequentially from `{first_id}`. Use exactly this shape and these keys:

```yaml
id: {topic}-l{level}-0000       # sequential from {first_id}
topic: {topic}
level: {level}
title: Short noun phrase, at most 120 characters
prompt: |
  A business or technical scenario in markdown: who needs what, and why.
context: |
  Optional. Table schemas, DataFrame columns, sample rows or repo state the options rely on.
dialect: null
options:
  - code: |
      <code>
    correct: true
    explanation: Why this option produces the required result.
  - code: |
      <code>
    correct: false
    explanation: The one specific reason this option is wrong.
  - code: |
      <code>
    correct: false
    explanation: The one specific reason this option is wrong.
  - code: |
      <code>
    correct: false
    explanation: The one specific reason this option is wrong.
tags: [kebab-case, tags]
docs_url: https://official-docs/...
status: draft
```

## Rules

1. **Exactly 4 options, exactly 1 with `correct: true`.** All four `code` values must differ. Every option has an `explanation`.
2. **Set `status: draft`** on every question. A human reviewer approves it.
3. **Write a scenario, not trivia.** The prompt describes a real task (a report, a pipeline fix, a repo mess to untangle) and states the required result precisely enough that exactly one option meets it. Don't ask "What does function X do?".
4. **Language conventions:**
   - `spark`: PySpark only, using the DataFrame API. Use `spark.sql` only where it's the idiomatic choice. Assume `F` is `pyspark.sql.functions` and `Window` is `pyspark.sql.Window`, and say so in `context`.
   - `sql`: ANSI SQL. Set `dialect` (`postgres`, `snowflake`, `bigquery` or `spark-sql`) **only** when the correct answer depends on an engine-specific feature, such as `QUALIFY`. Otherwise use `dialect: null`. At most 30% of the batch may set a dialect.
   - `git`: Each option is a sequence of shell commands, one per line. State the starting repo state in the prompt or `context`.
5. **The correct option must work.** It must run as written against the stated `context` and produce exactly the result the prompt asks for. Don't write code you aren't sure runs.
6. **Each wrong option is wrong for one specific, teachable reason**, such as the wrong window frame, `RANK` vs `ROW_NUMBER`, a detached HEAD, or a lost join key. Its `explanation` names that reason in one or two sentences. Wrong options must be plausible code an engineer might really write. At level 3 and above, never make an option wrong through a syntax error or a typo.
7. **Don't let length or style give the answer away.** Keep all four options within about 30% of each other in length, and match their formatting and style. Vary where the correct option appears (1st to 4th) across the batch, and don't make it always the most complete-looking or most cautious one.
8. **Include `docs_url`.** Link the official documentation for the concept the question tests: spark.apache.org, postgresql.org, docs.snowflake.com, cloud.google.com/bigquery or git-scm.com. Link to the specific page, not a docs home page.
9. **Match the level.** The question needs the knowledge described above for level {level}, no more and no less.
10. **YAML hygiene:** Use `|` block scalars for code and multi-line text. Quote any plain scalar that contains `: ` or starts with a special character. Write tags in kebab-case.

After the files, list each question's id and the one-line idea it tests, so the reviewer can check coverage and spot duplicates.
