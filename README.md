# Skewed

Skewed is a quick-fire quiz for data engineers. Each question shows a PySpark, SQL (PostgreSQL) or Git task with four code options, across five difficulty levels. You can play in Practice, Exam or Survival mode as a guest, without signing up. Questions live as YAML in `content/`, are seeded into Supabase, and are served through RPCs that never send the answers to the browser.

- Design spec: [docs/superpowers/specs/2026-10-02-skewed-design.md](docs/superpowers/specs/2026-10-02-skewed-design.md)
- Implementation plan: [docs/superpowers/plans/2026-10-02-skewed-mvp.md](docs/superpowers/plans/2026-10-02-skewed-mvp.md)
- Content authoring guide: [docs/content-guide.md](docs/content-guide.md)

## Local setup

Prerequisites: Node 22 (see `.nvmrc`), pnpm 11, and the [Supabase CLI](https://supabase.com/docs/guides/local-development) with Docker.

```bash
pnpm i
supabase start
bash scripts/local-supabase-env.sh > .env.local
pnpm seed content
pnpm dev
```

Then open http://localhost:3000.

## Scripts

| Script | What it does |
| --- | --- |
| `pnpm dev` | Start the Next.js dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint over the repo |
| `pnpm typecheck` | Generate Next route types, then `tsc --noEmit` |
| `pnpm test` | Run unit and component tests once (Vitest) |
| `pnpm test:watch` | Vitest in watch mode |
| `pnpm content:validate` | Validate the YAML question bank in `content/` |
| `pnpm seed <dir>` | Seed questions from a content directory into Supabase |
| `pnpm content:flagged` | List questions that players report or get wrong often |
| `pnpm e2e` | Playwright end-to-end tests |

The `content:*`, `seed` and `e2e` scripts and `scripts/local-supabase-env.sh` are added in later milestones.

## Environment variables

| Variable | Used by |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | App |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App |
| `SUPABASE_URL` | Scripts |
| `SUPABASE_SECRET_KEY` | Scripts |
