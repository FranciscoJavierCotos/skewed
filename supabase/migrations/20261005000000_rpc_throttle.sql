-- Per-IP throttle for the anon write RPCs. The private schema is not exposed by PostgREST.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.rpc_throttle (
  ip inet not null,
  fn text not null,
  window_start timestamptz not null,
  hits int not null default 1,
  primary key (ip, fn, window_start)
);
revoke all on private.rpc_throttle from public, anon, authenticated;

-- Raises rate_limited past p_per_minute (and p_per_hour) calls of p_fn from the caller's IP.
-- cf-connecting-ip is set by the edge (a client-sent one is rejected); x-forwarded-for is client-extendable.
-- No header (server-side callers) fails open. A rejected call rolls back its own hit.
create function private.throttle(p_fn text, p_per_minute int, p_per_hour int default null)
returns void language plpgsql volatile set search_path = '' as $$
declare
  v_ip inet;
  v_hits int;
begin
  begin
    v_ip := nullif(btrim(current_setting('request.headers', true)::json ->> 'cf-connecting-ip'), '')::inet;
  exception when others then
    v_ip := null;
  end;
  if v_ip is null then
    return;
  end if;
  insert into private.rpc_throttle as t (ip, fn, window_start)
  values (v_ip, p_fn, date_trunc('minute', now()))
  on conflict (ip, fn, window_start) do update set hits = t.hits + 1
  returning t.hits into v_hits;
  if v_hits > p_per_minute or (p_per_hour is not null and (
      select sum(hits) from private.rpc_throttle
      where ip = v_ip and fn = p_fn and window_start > now() - interval '1 hour') > p_per_hour) then
    raise exception 'rate limit exceeded' using errcode = 'P0001', hint = 'rate_limited';
  end if;
end;
$$;
revoke execute on function private.throttle from public, anon, authenticated;

create or replace function public.get_questions(p_topics text[], p_level int, p_exclude text[], p_limit int)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.obj), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', q.id, 'topic', q.topic, 'level', q.level, 'title', q.title, 'prompt', q.prompt,
      'context', q.context, 'tags', to_jsonb(q.tags),
      'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'code', o.code) order by o.position)
                  from public.question_options o where o.question_id = q.id)
    ) as obj
    from public.questions q
    where q.active
      and q.topic = any (p_topics)
      and (p_level is null or q.level = p_level)
      and not (q.id = any (coalesce(p_exclude, '{}')))
      and cardinality(coalesce(p_exclude, '{}')) <= 500
    order by random()
    limit least(greatest(coalesce(p_limit, 1), 1), 50)
  ) x;
$$;

create or replace function public.submit_answer(
  p_client_event_id uuid, p_anon_id uuid, p_session_id uuid,
  p_question_id text, p_option_id uuid, p_mode text, p_ms int)
returns jsonb language plpgsql volatile security definer set search_path = '' as $$
declare
  v_correct_id uuid;
  v_correct boolean;
begin
  perform private.throttle('submit_answer', 60, 1200);
  select o.id into v_correct_id
  from public.question_options o
  join public.questions q on q.id = o.question_id
  where o.question_id = p_question_id and o.is_correct and q.active;
  if v_correct_id is null then
    raise exception 'unknown question %', p_question_id using errcode = 'P0002';
  end if;
  if p_option_id is not null and not exists (
    select 1 from public.question_options where id = p_option_id and question_id = p_question_id) then
    raise exception 'option does not belong to question' using errcode = '22023';
  end if;
  v_correct := p_option_id is not distinct from v_correct_id;
  insert into public.answer_events (client_event_id, anon_id, session_id, question_id, option_id, correct, mode, ms_to_answer)
  values (p_client_event_id, p_anon_id, p_session_id, p_question_id, p_option_id, v_correct, p_mode, greatest(coalesce(p_ms, 0), 0))
  on conflict (client_event_id) do nothing;
  return jsonb_build_object(
    'correct', v_correct,
    'correct_option_id', v_correct_id,
    'explanations', (select jsonb_object_agg(o.id, o.explanation) from public.question_options o where o.question_id = p_question_id),
    'docs_url', (select q.docs_url from public.questions q where q.id = p_question_id));
end;
$$;

create or replace function public.report_question(p_anon_id uuid, p_question_id text, p_reason text, p_note text)
returns void language plpgsql volatile security definer set search_path = '' as $$
begin
  perform private.throttle('report_question', 5);
  if (select count(*) from public.question_reports
      where anon_id = p_anon_id and created_at > now() - interval '1 hour') >= 10 then
    raise exception 'rate limit exceeded' using errcode = 'P0001', hint = 'rate_limited';
  end if;
  insert into public.question_reports (anon_id, question_id, reason, note)
  values (p_anon_id, p_question_id, p_reason, nullif(btrim(left(p_note, 500)), ''));
end;
$$;

revoke execute on function public.get_questions, public.submit_answer, public.report_question from public;
grant execute on function public.get_questions, public.submit_answer, public.report_question to anon, authenticated, service_role;
