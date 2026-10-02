import { act, renderHook, waitFor } from "@testing-library/react";
import { ApiError, type QuizApi } from "@/api/quiz-api";
import { makeResult } from "@/engine/test-helpers";
import { useAnswerSubmitter } from "./use-answer-submitter";

const ctx = { anonId: "a", sessionId: "s", mode: "practice" as const };

it("submits once even if called twice quickly (double click / timer race)", async () => {
  const api = { submitAnswer: vi.fn().mockResolvedValue(makeResult("q", true)) } as unknown as QuizApi;
  const onResult = vi.fn();
  const { result } = renderHook(() => useAnswerSubmitter(api, ctx, onResult));
  act(() => { result.current.submit("q", "o1"); result.current.submit("q", "o2"); });
  await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
  expect(api.submitAnswer).toHaveBeenCalledTimes(1);
});

it("on failure exposes error; retry resends identical params (same clientEventId)", async () => {
  const submitAnswer = vi.fn()
    .mockRejectedValueOnce(new ApiError("offline", "network"))
    .mockResolvedValueOnce(makeResult("q", true));
  const onResult = vi.fn();
  const { result } = renderHook(() => useAnswerSubmitter({ submitAnswer } as unknown as QuizApi, ctx, onResult));
  act(() => result.current.submit("q", "o1"));
  await waitFor(() => expect(result.current.error?.kind).toBe("network"));
  act(() => result.current.retry());
  await waitFor(() => expect(onResult).toHaveBeenCalledTimes(1));
  expect(submitAnswer.mock.calls[1][0]).toEqual(submitAnswer.mock.calls[0][0]);
});

it("allows a new submit after a successful one", async () => {
  const api = { submitAnswer: vi.fn().mockResolvedValue(makeResult("q", true)) } as unknown as QuizApi;
  const { result } = renderHook(() => useAnswerSubmitter(api, ctx, vi.fn()));
  act(() => result.current.submit("q1", "o1"));
  await waitFor(() => expect(result.current.pending).toBe(false));
  act(() => result.current.submit("q2", "o1"));
  await waitFor(() => expect(api.submitAnswer).toHaveBeenCalledTimes(2));
});
