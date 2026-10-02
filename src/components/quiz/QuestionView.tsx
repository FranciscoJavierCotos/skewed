"use client";
import Markdown from "react-markdown";
import type { AnswerResult, PublicOption, PublicQuestion } from "@/domain/types";
import { langFor } from "@/lib/highlight";
import en from "@/messages/en.json";
import { CodeBlock } from "./CodeBlock";

const LETTERS = ["A", "B", "C", "D"];

interface Props {
  question: PublicQuestion;
  options: PublicOption[];
  result: AnswerResult | null;
  disabled: boolean;
  onSelect: (optionId: string) => void;
}

export function QuestionView({ question, options, result, disabled, onSelect }: Props) {
  const lang = langFor(question.topic);
  return (
    <article className="space-y-4">
      <header className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">
        <span>{question.topic}</span>
        <span>· {en.quiz.level} {question.level}</span>
      </header>
      <h2 className="text-xl font-semibold">{question.title}</h2>
      <div className="prose prose-neutral dark:prose-invert max-w-none"><Markdown>{question.prompt}</Markdown></div>
      {question.context && (
        <div className="prose prose-sm dark:prose-invert max-w-none rounded border p-3"><Markdown>{question.context}</Markdown></div>
      )}
      {result && result.chosenOptionId === null && <p className="text-amber-600">{en.quiz.timedOut}</p>}
      <ol className="space-y-3">
        {options.map((o, i) => {
          const isCorrect = result?.correctOptionId === o.id;
          const isChosen = result?.chosenOptionId === o.id;
          const tone = !result ? "hover:border-sky-500" : isCorrect ? "border-emerald-500" : isChosen ? "border-rose-500" : "opacity-70";
          const label = [`${en.quiz.option} ${LETTERS[i]}`, isCorrect && en.quiz.correctAnswer, isChosen && en.quiz.yourAnswer]
            .filter(Boolean).join(", ");
          return (
            <li key={o.id}>
              <button
                type="button"
                aria-label={label}
                disabled={disabled}
                onClick={() => onSelect(o.id)}
                className={`w-full rounded-lg border-2 p-2 text-left transition ${tone} disabled:cursor-default`}
              >
                <span className="mb-1 block text-sm font-bold">{LETTERS[i]}</span>
                <CodeBlock code={o.code} lang={lang} />
              </button>
              {result && <p className="mt-1 px-2 text-sm text-neutral-600 dark:text-neutral-300">{result.explanations[o.id]}</p>}
            </li>
          );
        })}
      </ol>
      {result?.docsUrl && (
        <a className="text-sky-600 underline" href={result.docsUrl} target="_blank" rel="noreferrer">{en.quiz.docs}</a>
      )}
    </article>
  );
}
