import type { SupabaseClient } from "@supabase/supabase-js";
import { ApiError } from "./quiz-api";
import { createSupabaseQuizApi } from "./supabase-quiz-api";

const client = (rpc: ReturnType<typeof vi.fn>) => ({ rpc }) as unknown as SupabaseClient;
const rawQ = { id: "sql-l1-0001", topic: "sql", level: 1, title: "T", prompt: "P", context: null, tags: [],
  options: [1, 2, 3, 4].map((n) => ({ id: `o${n}`, code: `c${n}` })) };

it("getQuestions sends snake_case params and parses rows", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: [rawQ], error: null });
  const qs = await createSupabaseQuizApi(client(rpc)).getQuestions({ topics: ["sql"], level: null, exclude: ["x"], limit: 1 });
  expect(rpc).toHaveBeenCalledWith("get_questions", { p_topics: ["sql"], p_level: null, p_exclude: ["x"], p_limit: 1 });
  expect(qs[0].options).toHaveLength(4);
});

it("submitAnswer maps the response to AnswerResult", async () => {
  const rpc = vi.fn().mockResolvedValue({ data: { correct: false, correct_option_id: "o1", explanations: { o1: "e" }, docs_url: null }, error: null });
  const r = await createSupabaseQuizApi(client(rpc)).submitAnswer({
    clientEventId: "c", anonId: "a", sessionId: "s", questionId: "q", optionId: "o2", mode: "exam", msToAnswer: 5,
  });
  expect(r).toEqual({ questionId: "q", chosenOptionId: "o2", correct: false, correctOptionId: "o1", explanations: { o1: "e" }, docsUrl: null });
});

it("maps rate limit and network errors", async () => {
  const limited = vi.fn().mockResolvedValue({ data: null, error: { message: "rate limit exceeded", code: "P0001", hint: "rate_limited" } });
  await expect(createSupabaseQuizApi(client(limited)).reportQuestion({ anonId: "a", questionId: "q", reason: "typo", note: "" }))
    .rejects.toMatchObject({ kind: "rate_limited" });
  const offline = vi.fn().mockResolvedValue({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } });
  await expect(createSupabaseQuizApi(client(offline)).getQuestions({ topics: ["sql"], level: 1, exclude: [], limit: 1 }))
    .rejects.toBeInstanceOf(ApiError);
});
