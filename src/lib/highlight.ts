import type { Highlighter } from "shiki";
import type { Topic } from "@/domain/types";

export type CodeLang = "python" | "sql" | "bash";
export const langFor = (t: Topic): CodeLang => ({ spark: "python", sql: "sql", git: "bash" } as const)[t];

let highlighter: Promise<Highlighter> | null = null;

export async function highlight(code: string, lang: CodeLang): Promise<string> {
  highlighter ??= import("shiki").then(({ createHighlighter }) =>
    createHighlighter({ themes: ["github-light", "github-dark"], langs: ["python", "sql", "bash"] }));
  const h = await highlighter;
  return h.codeToHtml(code, { lang, themes: { light: "github-light", dark: "github-dark" } });
}
