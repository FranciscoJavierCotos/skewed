create table public.questions (
  id text primary key,
  topic text not null check (topic in ('spark', 'sql', 'git')),
  level int not null check (level between 1 and 5),
  title text not null,
  prompt text not null,
  context text,
  dialect text,
  tags text[] not null default '{}',
  docs_url text,
  active boolean not null default true,
  content_hash text not null,
  updated_at timestamptz not null default now()
);
create index questions_pool_idx on public.questions (topic, level) where active;

create table public.question_options (
  id uuid primary key default gen_random_uuid(),
  question_id text not null references public.questions (id),
  position int not null check (position between 0 and 3),
  code text not null,
  is_correct boolean not null,
  explanation text not null,
  unique (question_id, position)
);

create table public.answer_events (
  id bigserial primary key,
  client_event_id uuid not null unique,
  anon_id uuid not null,
  session_id uuid not null,
  question_id text not null references public.questions (id),
  option_id uuid references public.question_options (id),
  correct boolean not null,
  mode text not null check (mode in ('practice', 'exam', 'survival')),
  ms_to_answer int check (ms_to_answer >= 0),
  created_at timestamptz not null default now()
);
create index answer_events_question_idx on public.answer_events (question_id);

create table public.question_reports (
  id bigserial primary key,
  anon_id uuid not null,
  question_id text not null references public.questions (id),
  reason text not null check (reason in ('wrong_answer', 'ambiguous', 'typo', 'other')),
  note text check (char_length(note) <= 500),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index question_reports_rate_idx on public.question_reports (anon_id, created_at);

alter table public.questions enable row level security;
alter table public.question_options enable row level security;
alter table public.answer_events enable row level security;
alter table public.question_reports enable row level security;
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

create or replace function public.get_questions(p_topics text[], p_level int, p_exclude text[], p_limit int)
returns jsonb language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(x.obj), '[]'::jsonb)
  from (
    select jsonb_build_object(
      'id', q.id, 'topic', q.topic, 'level', q.level, 'title', q.title, 'prompt', q.prompt,
      'context', q.context, 'dialect', q.dialect, 'tags', to_jsonb(q.tags),
      'options', (select jsonb_agg(jsonb_build_object('id', o.id, 'code', o.code) order by o.position)
                  from public.question_options o where o.question_id = q.id)
    ) as obj
    from public.questions q
    where q.active
      and q.topic = any (p_topics)
      and (p_level is null or q.level = p_level)
      and not (q.id = any (coalesce(p_exclude, '{}')))
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
