begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into public.questions (id, topic, level, title, prompt, docs_url, content_hash) values
  ('sql-l1-9001', 'sql', 1, 'Q1', 'P1', 'https://docs.example/q1', 'h1'),
  ('sql-l1-9002', 'sql', 1, 'Q2', 'P2', null, 'h2');
insert into public.question_options (id, question_id, position, code, is_correct, explanation) values
  ('00000000-0000-0000-0000-000000000011', 'sql-l1-9001', 0, 'SELECT 11', true,  'SECRET_EXPLANATION_11'),
  ('00000000-0000-0000-0000-000000000012', 'sql-l1-9001', 1, 'SELECT 12', false, 'SECRET_EXPLANATION_12'),
  ('00000000-0000-0000-0000-000000000013', 'sql-l1-9001', 2, 'SELECT 13', false, 'SECRET_EXPLANATION_13'),
  ('00000000-0000-0000-0000-000000000014', 'sql-l1-9001', 3, 'SELECT 14', false, 'SECRET_EXPLANATION_14'),
  ('00000000-0000-0000-0000-000000000021', 'sql-l1-9002', 0, 'SELECT 21', true,  'SECRET_EXPLANATION_21'),
  ('00000000-0000-0000-0000-000000000022', 'sql-l1-9002', 1, 'SELECT 22', false, 'SECRET_EXPLANATION_22'),
  ('00000000-0000-0000-0000-000000000023', 'sql-l1-9002', 2, 'SELECT 23', false, 'SECRET_EXPLANATION_23'),
  ('00000000-0000-0000-0000-000000000024', 'sql-l1-9002', 3, 'SELECT 24', false, 'SECRET_EXPLANATION_24');

set local role anon;

select throws_ok($$ select * from public.question_options $$, '42501', null, 'anon cannot read question_options');
select throws_ok($$ select * from public.answer_events $$, '42501', null, 'anon cannot read answer_events');
select throws_ok($$ select * from public.questions $$, '42501', null, 'anon cannot read questions');
select throws_ok($$ select * from public.question_reports $$, '42501', null, 'anon cannot read question_reports');

select is(jsonb_array_length(public.get_questions(array['sql'], 1, null, 10)), 2, 'get_questions returns active questions');
select ok(
  position('SECRET' in public.get_questions(array['sql'], 1, null, 10)::text) = 0
  and position('is_correct' in public.get_questions(array['sql'], 1, null, 10)::text) = 0
  and position('docs.example' in public.get_questions(array['sql'], 1, null, 10)::text) = 0,
  'get_questions leaks no answers, explanations or docs');
select is(jsonb_array_length(public.get_questions(array['sql'], 1, array['sql-l1-9001'], 10)), 1, 'exclude works');
select is(jsonb_array_length(public.get_questions(array['sql'], 1, null, 0)), 1, 'limit is clamped to at least 1');

select is(
  (public.submit_answer('10000000-0000-0000-0000-000000000001', gen_random_uuid(), gen_random_uuid(),
     'sql-l1-9001', '00000000-0000-0000-0000-000000000011', 'practice', 1200) ->> 'correct')::boolean,
  true, 'correct option is graded correct');

select throws_ok(
  $$ select public.submit_answer(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
       'sql-l1-9001', '00000000-0000-0000-0000-000000000021', 'practice', 10) $$,
  '22023', null, 'option from another question is rejected');

select is(
  (public.submit_answer(gen_random_uuid(), gen_random_uuid(), gen_random_uuid(),
     'sql-l1-9001', null, 'exam', 60000) ->> 'correct')::boolean,
  false, 'timeout (null option) is graded wrong');

-- idempotent retry: same client_event_id twice -> one row
select public.submit_answer('10000000-0000-0000-0000-000000000002', gen_random_uuid(), gen_random_uuid(),
  'sql-l1-9002', '00000000-0000-0000-0000-000000000021', 'survival', 5);
select public.submit_answer('10000000-0000-0000-0000-000000000002', gen_random_uuid(), gen_random_uuid(),
  'sql-l1-9002', '00000000-0000-0000-0000-000000000021', 'survival', 5);
reset role;
select is((select count(*)::int from public.answer_events
           where client_event_id = '10000000-0000-0000-0000-000000000002'), 1, 'retries are idempotent');
set local role anon;

select public.report_question('20000000-0000-0000-0000-000000000001', 'sql-l1-9001', 'typo', 'n')
  from generate_series(1, 10);
select throws_ok(
  $$ select public.report_question('20000000-0000-0000-0000-000000000001', 'sql-l1-9001', 'typo', 'n') $$,
  'P0001', 'rate limit exceeded', '11th report in an hour is rejected');

select * from finish();
rollback;
