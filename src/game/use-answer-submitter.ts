"use client";
import { useCallback, useRef, useState } from "react";
import { ApiError, type QuizApi, type SubmitAnswerParams } from "@/api/quiz-api";
import type { AnswerResult, Mode } from "@/domain/types";

export function useAnswerSubmitter(
  api: QuizApi,
  ctx: { anonId: string; sessionId: string; mode: Mode },
  onResult: (r: AnswerResult) => void,
) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ApiError | null>(null);
  // The answer currently being submitted (kept until it succeeds so retry can resend it verbatim).
  const inflight = useRef<SubmitAnswerParams | null>(null);
  const sending = useRef(false);
  const shownAt = useRef(0);

  const send = useCallback(async (params: SubmitAnswerParams) => {
    if (sending.current) return;
    sending.current = true;
    setPending(true);
    setError(null);
    try {
      const r = await api.submitAnswer(params);
      inflight.current = null;
      onResult(r);
    } catch (e) {
      setError(e instanceof ApiError ? e : new ApiError(String(e), "server"));
    } finally {
      sending.current = false;
      setPending(false);
    }
  }, [api, onResult]);

  const submit = useCallback((questionId: string, optionId: string | null) => {
    if (inflight.current) return;
    const now = Date.now();
    const params: SubmitAnswerParams = {
      clientEventId: crypto.randomUUID(), anonId: ctx.anonId, sessionId: ctx.sessionId,
      questionId, optionId, mode: ctx.mode, msToAnswer: shownAt.current ? now - shownAt.current : 0,
    };
    inflight.current = params;
    void send(params);
  }, [ctx.anonId, ctx.sessionId, ctx.mode, send]);

  const retry = useCallback(() => { if (inflight.current) void send(inflight.current); }, [send]);
  const markShown = useCallback(() => { shownAt.current = Date.now(); }, []);

  return { submit, retry, markShown, pending, error };
}
