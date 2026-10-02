Closes #

## Summary

<!-- What changed and why. -->

## Test checklist

- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm content:validate` passes locally

<details>
<summary>Content review checklist (content PRs only)</summary>

See [docs/content-guide.md](../blob/main/docs/content-guide.md) for the rubric and format.

- [ ] The correct answer actually runs and produces the stated result. Run Spark/SQL snippets locally (DuckDB or `pyspark` shell; a git sandbox repo for Git).
- [ ] Each wrong option is wrong for **one specific, teachable reason**, and the explanation names that reason.
- [ ] Wrong options are plausible: no syntax-error strawmen at L3+.
- [ ] The correct option isn't identifiable by length or style. Option lengths are within ~30% of each other, and the correct option isn't always the most "complete-looking".
- [ ] The prompt is a business or technical scenario, not a trivia question.
- [ ] The level matches the rubric.
- [ ] It isn't a near-duplicate of an existing question (`grep` the tags and title).
- [ ] `docs_url` points to official documentation (Spark, Postgres, Snowflake, BigQuery or git-scm).
- [ ] Accepted questions are flipped from `draft` to `approved`, and rejected drafts are removed.

</details>
