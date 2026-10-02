"use client";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useState } from "react";
import { ErrorRetry } from "@/components/quiz/ErrorRetry";
import { QuestionView } from "@/components/quiz/QuestionView";
import { ReportDialog } from "@/components/quiz/ReportDialog";
import { useShuffledOptions } from "@/components/quiz/useShuffledOptions";
import type { AnswerResult, SessionConfig } from "@/domain/types";
import { initialPracticeState, practiceReducer } from "@/engine/practice";
import { levelParam } from "@/engine/session-config";
import { useAnswerSubmitter } from "@/game/use-answer-submitter";
import { useGameServices } from "@/game/services";
import en from "@/messages/en.json";

export function PracticeGame({ config }: { config: SessionConfig }) {
  const { api, anonId, progress } = useGameServices();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, dispatch] = useReducer(practiceReducer, initialPracticeState);
  const [loadError, setLoadError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const onResult = useCallback((result: AnswerResult) => dispatch({ type: "ANSWER_RESULT", result }), []);
  const submitter = useAnswerSubmitter(api, { anonId, sessionId, mode: "practice" }, onResult);
  const options = useShuffledOptions(state.current);

  useEffect(() => {
    if (state.status !== "loading") return;
    let alive = true;
    api.getQuestions({ topics: config.topics, level: levelParam(config.level), exclude: state.seenIds, limit: 1 })
      .then(([q]) => { if (!alive) return; dispatch(q ? { type: "QUESTION_LOADED", question: q } : { type: "POOL_EXHAUSTED" }); })
      .catch(() => alive && setLoadError(true));
    return () => { alive = false; };
  }, [state.status, state.seenIds, api, config, loadAttempt]);

  const { markShown } = submitter;
  useEffect(() => { if (state.status === "answering") markShown(); }, [state.status, state.current?.id, markShown]);

  useEffect(() => {
    if (state.status === "ended" && state.answered > 0)
      progress.recordSession({ mode: "practice", topics: config.topics, level: config.level, answered: state.answered,
        correct: state.correct, streak: null, finishedAt: new Date().toISOString() });
  }, [state.status]); // eslint-disable-line react-hooks/exhaustive-deps

  const score = <p className="text-sm text-neutral-500">{en.game.score}: {state.correct} / {state.answered}</p>;

  if (state.status === "exhausted" || state.status === "ended")
    return (
      <div className="space-y-4">
        {state.status === "exhausted" && <p>{en.game.exhausted}</p>}
        {score}
        <div className="flex gap-3">
          <button type="button" onClick={() => window.location.reload()} className="rounded bg-sky-600 px-4 py-2 text-white">{en.game.restart}</button>
          <Link href="/play" className="rounded border px-4 py-2">{en.game.changeSetup}</Link>
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        {score}
        <button type="button" onClick={() => dispatch({ type: "END" })} className="text-sm underline">{en.game.end}</button>
      </div>
      {loadError && <ErrorRetry message={en.game.loadFailed} onRetry={() => { setLoadError(false); setLoadAttempt((n) => n + 1); }} />}
      {state.current && (
        <>
          <QuestionView
            question={state.current}
            options={options}
            result={state.status === "feedback" ? state.lastResult : null}
            disabled={state.status !== "answering" || submitter.pending}
            onSelect={(id) => submitter.submit(state.current!.id, id)}
          />
          {submitter.error && <ErrorRetry message={en.game.submitFailed} onRetry={submitter.retry} />}
          {state.status === "feedback" && (
            <div className="flex items-center justify-between">
              <p className={state.lastResult?.correct ? "text-emerald-600" : "text-rose-600"}>{state.lastResult?.correct ? en.game.correct : en.game.wrong}</p>
              <button type="button" onClick={() => dispatch({ type: "NEXT" })} className="rounded bg-sky-600 px-4 py-2 text-white">{en.game.next}</button>
            </div>
          )}
          <ReportDialog api={api} anonId={anonId} questionId={state.current.id} />
        </>
      )}
    </div>
  );
}
