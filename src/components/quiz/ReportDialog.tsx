"use client";
import { useState } from "react";
import { ApiError, type QuizApi } from "@/api/quiz-api";
import { REPORT_REASONS, type ReportReason } from "@/domain/types";
import en from "@/messages/en.json";

type Status = "closed" | "open" | "sending" | "sent" | "rate_limited" | "failed";

interface Props {
  api: QuizApi;
  anonId: string;
  questionId: string;
}

export function ReportDialog({ api, anonId, questionId }: Props) {
  const [status, setStatus] = useState<Status>("closed");
  const [reason, setReason] = useState<ReportReason>("wrong_answer");
  const [note, setNote] = useState("");

  async function send() {
    setStatus("sending");
    try {
      await api.reportQuestion({ anonId, questionId, reason, note });
      setStatus("sent");
    } catch (e) {
      setStatus(e instanceof ApiError && e.kind === "rate_limited" ? "rate_limited" : "failed");
    }
  }

  if (status === "closed")
    return (
      <button type="button" className="text-sm text-neutral-500 underline" onClick={() => setStatus("open")}>
        {en.report.open}
      </button>
    );
  if (status === "sent") return <p role="status" className="text-sm text-emerald-600">{en.report.thanks}</p>;

  return (
    <div role="dialog" aria-labelledby="report-title" className="space-y-2 rounded border p-3">
      <h3 id="report-title" className="font-medium">{en.report.title}</h3>
      {REPORT_REASONS.map((r) => (
        <label key={r} className="flex items-center gap-2 text-sm">
          <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} />
          {en.report.reasons[r]}
        </label>
      ))}
      <label className="block text-sm">
        {en.report.details}
        <textarea
          className="mt-1 w-full rounded border p-1"
          maxLength={500}
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {status === "rate_limited" && <p role="alert" className="text-sm text-rose-600">{en.report.rateLimited}</p>}
      {status === "failed" && <p role="alert" className="text-sm text-rose-600">{en.report.failed}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={status === "sending"}
          onClick={send}
          className="rounded bg-neutral-900 px-3 py-1 text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {en.report.send}
        </button>
        <button type="button" onClick={() => setStatus("closed")}>{en.report.cancel}</button>
      </div>
    </div>
  );
}
