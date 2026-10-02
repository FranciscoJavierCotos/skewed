import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { TOPICS, type Level, type PublicQuestion } from "@/domain/types";
import { ApiError, type QuizApi } from "./quiz-api";

const QuestionsSchema = z.array(z.object({
  id: z.string(), topic: z.enum(TOPICS), level: z.number().int().min(1).max(5), title: z.string(), prompt: z.string(),
  context: z.string().nullable(), dialect: z.string().nullable(), tags: z.array(z.string()),
  options: z.array(z.object({ id: z.string(), code: z.string() })).length(4),
}));
const ResultSchema = z.object({
  correct: z.boolean(), correct_option_id: z.string(), explanations: z.record(z.string(), z.string()), docs_url: z.string().nullable(),
});

type RpcError = { message: string; code?: string; hint?: string } | null;
function toApiError(error: NonNullable<RpcError>): ApiError {
  // report_question raises `using errcode = 'P0001', hint = 'rate_limited'`.
  if (error.hint === "rate_limited") return new ApiError(error.message, "rate_limited");
  // postgrest-js reports fetch failures as an error with an empty code.
  if (!error.code) return new ApiError(error.message, "network");
  return new ApiError(error.message, "server");
}

// A malformed payload is a server problem, not a crash: surface it as ApiError("server").
function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (!r.success) throw new ApiError(`unexpected response: ${r.error.message}`, "server");
  return r.data;
}

export function createSupabaseQuizApi(client: SupabaseClient): QuizApi {
  async function call(fn: string, args: Record<string, unknown>): Promise<unknown> {
    let res: { data: unknown; error: RpcError };
    try {
      res = await client.rpc(fn, args);
    } catch (e) {
      throw new ApiError((e as Error).message, "network");
    }
    if (res.error) throw toApiError(res.error);
    return res.data;
  }
  return {
    async getQuestions({ topics, level, exclude, limit }) {
      const data = await call("get_questions", { p_topics: topics, p_level: level, p_exclude: exclude, p_limit: limit });
      return parse(QuestionsSchema, data).map((q) => ({ ...q, level: q.level as Level })) satisfies PublicQuestion[];
    },
    async submitAnswer(p) {
      const r = parse(ResultSchema, await call("submit_answer", {
        p_client_event_id: p.clientEventId, p_anon_id: p.anonId, p_session_id: p.sessionId,
        p_question_id: p.questionId, p_option_id: p.optionId, p_mode: p.mode, p_ms: Math.round(p.msToAnswer),
      }));
      return {
        questionId: p.questionId, chosenOptionId: p.optionId, correct: r.correct,
        correctOptionId: r.correct_option_id, explanations: r.explanations, docsUrl: r.docs_url,
      };
    },
    async reportQuestion(p) {
      await call("report_question", { p_anon_id: p.anonId, p_question_id: p.questionId, p_reason: p.reason, p_note: p.note });
    },
  };
}
