-- Per-question quality stats for weekly content triage (`pnpm content:flagged`).
-- Service role only: anon and authenticated must never see accuracy or reports.
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
