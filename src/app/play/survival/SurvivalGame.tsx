"use client";
import Link from "next/link";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ErrorRetry } from "@/components/quiz/ErrorRetry";
import { QuestionView } from "@/components/quiz/QuestionView";
import { ReportDialog } from "@/components/quiz/ReportDialog";
import { useShuffledOptions } from "@/components/quiz/useShuffledOptions";
import type { AnswerResult, Level, SessionConfig } from "@/domain/types";
import { toSearchParams } from "@/engine/session-config";
import { initialSurvivalState, nextSurvivalLevel, survivalReducer } from "@/engine/survival";
import { useAnswerSubmitter } from "@/game/use-answer-submitter";
import { useGameServices } from "@/game/services";
import { bestKey } from "@/progress/store";
import en from "@/messages/en.json";

const fmt = (s: string, v: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]));

export function SurvivalGame({ config }: { config: SessionConfig }) {
  const level = config.level as Level; // parseSessionConfig never yields "mixed" for survival
  const { api, anonId, progress } = useGameServices();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, dispatch] = useReducer(survivalReducer, level, initialSurvivalState);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const recorded = useRef(false);
  const onResult = useCallback((result: AnswerResult) => dispatch({ type: "ANSWER_RESULT", result }), []);
  const submitter = useAnswerSubmitter(api, { anonId, sessionId, mode: "survival" }, onResult);
  const options = useShuffledOptions(state.current ?? state.missed?.question ?? null);

  useEffect(() => {
    if (state.status !== "loading") return;
    let alive = true;
    api.getQuestions({ topics: config.topics, level: state.level, exclude: state.seenIds, limit: 1 })
      .then(([q]) => alive && dispatch(q ? { type: "QUESTION_LOADED", question: q } : { type: "POOL_EXHAUSTED" }))
      .catch(() => alive && setLoadError(true));
    return () => { alive = false; };
  }, [state.status, state.level, state.seenIds, api, config.topics, attempt]);

  const { markShown } = submitter;
  useEffect(() => { if (state.status === "answering") markShown(); }, [state.status, state.current?.id, markShown]);

  const ended = state.status === "over" || (state.status === "cleared" && state.streak > 0);
  useEffect(() => {
    if (!ended || recorded.current) return;
    recorded.current = true;
    setNewBest(progress.recordSession({
      mode: "survival", topics: config.topics, level: state.level,
      answered: state.streak + (state.status === "over" ? 1 : 0), correct: state.streak, streak: state.streak,
      finishedAt: new Date().toISOString(),
    }).newBest);
  }, [ended, state, progress, config.topics]);

  if (loadError) return <ErrorRetry message={en.game.loadFailed} onRetry={() => { setLoadError(false); setAttempt((n) => n + 1); }} />;
  if (state.status === "cleared" && state.streak === 0) return <p>{en.game.empty}</p>;

  if (ended) {
    const best = progress.getPersonalBest("survival", bestKey("survival", config.topics, state.level));
    const next = state.status === "cleared" ? nextSurvivalLevel(state.level) : null;
    return (
      <div className="space-y-6">
        <section>
          <h1 className="text-2xl font-bold">{state.status === "cleared" ? fmt(en.survival.cleared, { n: state.level }) : en.survival.over}</h1>
          {state.status === "cleared" && <p>{fmt(en.survival.clearedHint, { n: state.level })}</p>}
          <p>{fmt(en.survival.streak, { n: state.streak })} · {fmt(en.survival.level, { n: state.level })}</p>
          {newBest ? <p className="text-emerald-600">{en.survival.newBest}</p> : best !== null && <p>{fmt(en.survival.best, { n: best })}</p>}
          {!progress.persistent && <p className="text-sm text-neutral-500">{en.game.notSaved}</p>}
          <div className="mt-3 flex gap-3">
            {next && (
              <Link href={`/play/survival?${toSearchParams({ ...config, level: next })}`} className="rounded bg-emerald-600 px-4 py-2 text-white">
                {fmt(en.survival.nextLevel, { n: next })}
              </Link>
            )}
            <button type="button" onClick={() => window.location.reload()} className="rounded bg-sky-600 px-4 py-2 text-white">{en.survival.again}</button>
            <Link href="/play" className="rounded border px-4 py-2">{en.game.changeSetup}</Link>
          </div>
        </section>
        {state.missed && (
          <>
            <h2 className="font-medium">{en.survival.missed}</h2>
            <QuestionView question={state.missed.question} options={options} result={state.missed.result} disabled onSelect={() => {}} />
            <ReportDialog api={api} anonId={anonId} questionId={state.missed.question.id} />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm">
        <span>{fmt(en.survival.streak, { n: state.streak })}</span>
        <span className="font-semibold">{fmt(en.survival.level, { n: state.level })}</span>
      </div>
      {state.current && (
        <>
          <QuestionView question={state.current} options={options}
            result={state.status === "feedback" ? state.lastResult : null}
            disabled={state.status !== "answering" || submitter.pending}
            onSelect={(id) => submitter.submit(state.current!.id, id)} />
          {submitter.error && <ErrorRetry message={en.game.submitFailed} onRetry={submitter.retry} />}
          {state.status === "feedback" && (
            <div className="flex items-center justify-between">
              <p className="text-emerald-600">{en.game.correct}</p>
              <button type="button" onClick={() => dispatch({ type: "NEXT" })} className="rounded bg-sky-600 px-4 py-2 text-white">{en.game.next}</button>
            </div>
          )}
          <ReportDialog api={api} anonId={anonId} questionId={state.current.id} />
        </>
      )}
    </div>
  );
}
