import type { AnswerResult, Level, Mode, PublicQuestion, ReportReason, Topic } from "@/domain/types";

export interface GetQuestionsParams { topics: Topic[]; level: Level | null; exclude: string[]; limit: number }
export interface SubmitAnswerParams {
  clientEventId: string; anonId: string; sessionId: string; questionId: string;
  optionId: string | null; mode: Mode; msToAnswer: number;
}
export interface ReportParams { anonId: string; questionId: string; reason: ReportReason; note: string }

export interface QuizApi {
  getQuestions(p: GetQuestionsParams): Promise<PublicQuestion[]>;
  submitAnswer(p: SubmitAnswerParams): Promise<AnswerResult>;
  reportQuestion(p: ReportParams): Promise<void>;
}

export class ApiError extends Error {
  constructor(message: string, readonly kind: "network" | "rate_limited" | "server") {
    super(message);
    this.name = "ApiError";
  }
}
