-- New objects in public must be granted explicitly: nothing reaches the API roles by default.
-- Defaults owned by supabase_admin can't be altered by postgres; migrations run as postgres.
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from anon, authenticated, public;

create index if not exists answer_events_option_idx on public.answer_events (option_id);
create index if not exists question_reports_question_idx on public.question_reports (question_id);

-- docs_url is rendered as an href: only https links.
alter table public.questions
  add constraint questions_docs_url_https check (docs_url is null or docs_url ~ '^https://');
