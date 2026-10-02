"use client";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { ErrorRetry } from "@/components/quiz/ErrorRetry";
import { QuestionView } from "@/components/quiz/QuestionView";
import { useShuffledOptions } from "@/components/quiz/useShuffledOptions";
import type { AnswerResult, SessionConfig } from "@/domain/types";
import { examReducer, initialExamState, summarizeExam } from "@/engine/exam";
import { levelParam } from "@/engine/session-config";
import { useAnswerSubmitter } from "@/game/use-answer-submitter";
import { useCountdown } from "@/game/use-countdown";
import { useGameServices } from "@/game/services";
import en from "@/messages/en.json";
import { ExamReview } from "./ExamReview";

const fmt = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k]));

export function ExamGame({ config }: { config: SessionConfig }) {
  const { api, anonId, progress } = useGameServices();
  const [sessionId] = useState(() => crypto.randomUUID());
  const [state, dispatch] = useReducer(examReducer, initialExamState);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [newBest, setNewBest] = useState(false);
  const recorded = useRef(false);
  const latest = useRef(state);
  useEffect(() => { latest.current = state; });

  // Record the finished exam from the result callback (not an effect) so the personal best is set once.
  const onResult = useCallback((result: AnswerResult) => {
    const event = { type: "ANSWER_RESULT", result } as const;
    const next = examReducer(latest.current, event);
    dispatch(event);
    if (next.status !== "finished" || recorded.current) return;
    recorded.current = true;
    const s = summarizeExam(next);
    const { newBest } = progress.recordSession({ mode: "exam", topics: config.topics, level: config.level, answered: s.total,
      correct: s.correct, streak: null, finishedAt: new Date().toISOString() });
    setNewBest(newBest);
  }, [progress, config]);
  const submitter = useAnswerSubmitter(api, { anonId, sessionId, mode: "exam" }, onResult);
  const current = state.status === "answering" ? state.questions[state.index] : null;
  const currentId = current?.id ?? null;
  const options = useShuffledOptions(current);
  const { submit, markShown } = submitter;
  // Timeout counts as unanswered.
  const remaining = useCountdown(currentId ? config.timerSeconds : null, currentId ?? "none", () => {
    if (currentId) submit(currentId, null);
  });

  useEffect(() => {
    let alive = true;
    api.getQuestions({ topics: config.topics, level: levelParam(config.level), exclude: [], limit: config.examLength })
      .then((questions) => alive && dispatch({ type: "QUESTIONS_LOADED", questions, requested: config.examLength }))
      .catch(() => alive && setLoadError(true));
    return () => { alive = false; };
  }, [api, config, attempt]);

  useEffect(() => { if (currentId) markShown(); }, [currentId, markShown]);

  useEffect(() => {
    if (state.status !== "answering") return;
    const guard = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [state.status]);

  if (loadError)
    return <ErrorRetry message={en.game.loadFailed} onRetry={() => { setLoadError(false); setAttempt((n) => n + 1); }} />;
  if (state.status === "empty") return <p>{en.game.empty}</p>;
  if (state.status === "finished") return <ExamReview state={state} newBest={newBest} persistent={progress.persistent} />;
  if (!current) return null;

  const shortBy = summarizeExam(state).shortBy;
  return (
    <div className="space-y-4">
      <div className="flex justify-between text-sm text-neutral-500">
        <span>{fmt(en.exam.progress, { n: state.index + 1, total: state.questions.length })}</span>
        {remaining !== null && <span className={remaining <= 10 ? "font-bold text-rose-600" : ""}>{fmt(en.exam.timeLeft, { s: remaining })}</span>}
      </div>
      {shortBy > 0 && state.index === 0 && <p className="text-amber-600">{fmt(en.exam.short, { n: state.questions.length })}</p>}
      <QuestionView question={current} options={options} result={null} disabled={submitter.pending}
        onSelect={(id) => submit(current.id, id)} />
      {submitter.error && <ErrorRetry message={en.game.submitFailed} onRetry={submitter.retry} />}
    </div>
  );
}
