# Skewed

Skewed is a quick-fire quiz for data engineers. Each question shows a PySpark, SQL (PostgreSQL) or Git task with four code options, across five difficulty levels. You can play in Practice, Exam or Survival mode as a guest, without signing up. Questions live as YAML in `content/`, are seeded into Supabase, and are served through RPCs that never send the answers to the browser.

**Live:** https://skewed-quiz.vercel.app

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

## Environment variables

| Variable | Used by |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | App |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | App |
| `SUPABASE_URL` | Scripts |
| `SUPABASE_SECRET_KEY` | Scripts |

## Deploy

Production runs on one Supabase project (`ukneqhxwnwftsmsrgodo`, eu-west-3) and the Vercel project `skewed`, at https://skewed-quiz.vercel.app.

**App (Vercel).** The GitHub repo is imported in Vercel (Next.js preset, pnpm). Every push to `main` deploys to production, and every PR gets a preview deployment. Previews use the production Supabase project too: the MVP has no staging project, the reads are harmless, and preview telemetry is tagged only by session.

| Vercel env var | Environments |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview, Development |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Production, Preview, Development |

**Database and content (GitHub Actions).** [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) runs on a push to `main` that touches migrations, content or the seed code, and you can also start it by hand (`workflow_dispatch`). It validates the bank, runs `supabase db push`, and then runs `pnpm seed content`. On a PR that touches the same paths, it does a `--dry-run` push instead and lists the pending migrations. Runners have no IPv6, so [`scripts/ci-pooler-url.sh`](scripts/ci-pooler-url.sh) rewrites a direct DB URL to the Supavisor session pooler.

| GitHub secret | Used for |
| --- | --- |
| `SUPABASE_DB_URL` | `supabase db push` and the CI pgTAP run (a postgres connection string, direct or pooler) |
| `SUPABASE_URL` | Seeding |
| `SUPABASE_SECRET_KEY` | Seeding (service-level key, server-only) |

Migration versions in `supabase_migrations.schema_migrations` must match the repo filenames, so `db push` treats migrations that are already applied as no-ops. When a migration is applied by hand (for example through the Supabase MCP), rename its version to match the file.

**Security advisor.** There are no RLS or `search_path` findings. The remaining notices are intentional. The tables have RLS with no policies (deny-all), so the only way in is through the three `SECURITY DEFINER` RPCs (`get_questions`, `submit_answer`, `report_question`). Those RPCs are meant to be callable by `anon`, and they never return `is_correct` or explanations before an answer.
