"use client";
import Link from "next/link";
import { QuestionView } from "@/components/quiz/QuestionView";
import { summarizeExam, type ExamState } from "@/engine/exam";
import en from "@/messages/en.json";

export function ExamReview({ state, newBest, persistent }: { state: ExamState; newBest: boolean; persistent: boolean }) {
  const s = summarizeExam(state);
  return (
    <div className="space-y-8">
      <section>
        <h1 className="text-2xl font-bold">{en.exam.result}: {s.correct} / {s.total} ({s.pct}%)</h1>
        {newBest && <p className="text-emerald-600">{en.exam.newBest}</p>}
        {!persistent && <p className="text-sm text-neutral-500">{en.game.notSaved}</p>}
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div><h2 className="font-medium">{en.exam.byTopic}</h2>
            {Object.entries(s.byTopic).map(([k, v]) => <p key={k}>{k}: {v.correct}/{v.total}</p>)}</div>
          <div><h2 className="font-medium">{en.exam.byLevel}</h2>
            {Object.entries(s.byLevel).map(([k, v]) => <p key={k}>L{k}: {v.correct}/{v.total}</p>)}</div>
        </div>
        <Link href="/play" className="mt-4 inline-block rounded bg-sky-600 px-4 py-2 text-white">{en.game.changeSetup}</Link>
      </section>
      {state.questions.map((q, i) => (
        <section key={q.id} className="border-t pt-6">
          <QuestionView question={q} options={q.options} result={state.results[i]} disabled onSelect={() => {}} />
        </section>
      ))}
    </div>
  );
}
