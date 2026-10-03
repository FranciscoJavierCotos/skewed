-- Bounded growth: purge old throttle windows and answer events on a schedule.
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

-- The hourly cap reads the last hour of windows, so keep two.
select cron.schedule('purge-rpc-throttle', '*/10 * * * *',
  $$delete from private.rpc_throttle where window_start < now() - interval '2 hours'$$);

-- Content triage (question_stats) only needs recent answers.
select cron.schedule('purge-answer-events', '17 3 * * *',
  $$delete from public.answer_events where created_at < now() - interval '180 days'$$);
