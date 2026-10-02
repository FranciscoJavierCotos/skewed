-- SQL questions are PostgreSQL-only, so the per-question dialect is gone.
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
    order by random()
    limit least(greatest(coalesce(p_limit, 1), 1), 50)
  ) x;
$$;

alter table public.questions drop column dialect;
