---
name: Content batch
about: Draft and review a batch of questions for one topic and level
title: "Content: <topic> L<n> batch <k>"
labels: ["type:content", "area:content"]
---

## Batch

- **Topic:** <!-- spark | sql | git -->
- **Level:** <!-- 1–5 -->
- **Count:** 20
- **Id range:** <!-- e.g. sql-l4-0021 … sql-l4-0040 -->
- **Branch:** `content/<topic>-l<n>-batch-<k>`

## Subtopics to cover

<!-- The rubric cell for this topic and level (docs/content-guide.md), plus any gaps in the existing bank. -->

## Steps

- [ ] Draft with [docs/content-prompt.md](../blob/main/docs/content-prompt.md) (`status: draft`)
- [ ] `pnpm content:validate` reports 0 errors
- [ ] Run every correct option (DuckDB / `pyspark` / a throwaway git repo) and confirm each wrong option fails for the reason its explanation gives
- [ ] Open a PR and go through the content review checklist
- [ ] Flip accepted questions to `approved` and merge
