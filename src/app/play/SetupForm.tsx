"use client";
import { useState } from "react";
import { EXAM_LENGTHS, EXAM_TIMER_SECONDS, LEVELS, TOPICS, type ExamLength, type Level, type Mode, type Topic } from "@/domain/types";
import { toSearchParams } from "@/engine/session-config";
import en from "@/messages/en.json";

const MODES: Mode[] = ["practice", "exam", "survival"];

export function SetupForm({ onStart }: { onStart: (mode: Mode, query: string) => void }) {
  const [mode, setMode] = useState<Mode>("practice");
  const [topics, setTopics] = useState<Topic[]>(["spark", "sql"]);
  const [level, setLevel] = useState<Level | "mixed">("mixed");
  const [examLength, setExamLength] = useState<ExamLength>(10);
  const [timer, setTimer] = useState(false);

  const toggle = (t: Topic) => setTopics((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));
  const ordered = TOPICS.filter((t) => topics.includes(t));
  // Survival always runs at one fixed level, so "Mixed" falls back to level 1 there.
  const shownLevel: Level | "mixed" = mode === "survival" && level === "mixed" ? 1 : level;

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        onStart(mode, toSearchParams({ mode, topics: ordered, level: shownLevel, examLength, timerSeconds: timer ? EXAM_TIMER_SECONDS : null }));
      }}
    >
      <fieldset className="grid gap-2 sm:grid-cols-3">
        <legend className="mb-2 font-medium">{en.setup.mode}</legend>
        {MODES.map((m) => (
          <label
            key={m}
            className={`cursor-pointer rounded-lg border-2 p-3 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-sky-400 ${mode === m ? "border-sky-500" : "border-neutral-200 dark:border-neutral-700"}`}
          >
            <input type="radio" name="mode" className="sr-only" checked={mode === m} onChange={() => setMode(m)} aria-label={en.setup.modes[m].name} />
            <span className="block font-semibold">{en.setup.modes[m].name}</span>
            <span className="text-sm text-neutral-500">{en.setup.modes[m].desc}</span>
          </label>
        ))}
      </fieldset>
      <fieldset className="flex flex-wrap gap-4">
        <legend className="mb-2 font-medium">{en.setup.topics}</legend>
        {TOPICS.map((t) => (
          <label key={t} className="flex items-center gap-2">
            <input type="checkbox" checked={topics.includes(t)} onChange={() => toggle(t)} aria-label={t} />
            {en.setup.topicNames[t]}
          </label>
        ))}
      </fieldset>
      <label className="block">
        {en.setup.level}
        <select
          className="ml-2 rounded border p-1"
          value={String(shownLevel)}
          onChange={(e) => setLevel(e.target.value === "mixed" ? "mixed" : (Number(e.target.value) as Level))}
        >
          {mode !== "survival" && <option value="mixed">{en.setup.mixed}</option>}
          {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
        </select>
      </label>
      {mode === "exam" && (
        <div className="flex flex-wrap gap-6">
          <label>
            {en.setup.questions}
            <select className="ml-2 rounded border p-1" value={examLength} onChange={(e) => setExamLength(Number(e.target.value) as ExamLength)}>
              {EXAM_LENGTHS.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={timer} onChange={(e) => setTimer(e.target.checked)} />
            {en.setup.timer}
          </label>
        </div>
      )}
      <button type="submit" disabled={topics.length === 0} className="rounded-lg bg-sky-600 px-5 py-2 font-semibold text-white disabled:opacity-40">
        {en.setup.start}
      </button>
    </form>
  );
}
