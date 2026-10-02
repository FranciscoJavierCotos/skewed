import { createHash } from "node:crypto";
import type { QuestionFile } from "./schema";

export interface QuestionRow {
  id: string; topic: string; level: number; title: string; prompt: string;
  context: string | null; tags: string[]; docs_url: string | null;
  active: boolean; content_hash: string; updated_at: string;
}
export interface OptionRow {
  question_id: string; position: number; code: string; is_correct: boolean; explanation: string;
}

export function toRows(q: QuestionFile): { question: QuestionRow; options: OptionRow[] } {
  const { status, ...content } = q;
  return {
    question: {
      id: q.id, topic: q.topic, level: q.level, title: q.title, prompt: q.prompt,
      context: q.context ?? null, tags: q.tags, docs_url: q.docs_url ?? null,
      active: status === "approved",
      content_hash: createHash("sha256").update(JSON.stringify(content)).digest("hex"),
      updated_at: new Date().toISOString(),
    },
    options: q.options.map((o, position) => ({
      question_id: q.id, position, code: o.code, is_correct: o.correct, explanation: o.explanation,
    })),
  };
}
