"use client";
import { useEffect, useState } from "react";
import { highlight, type CodeLang } from "@/lib/highlight";

export function CodeBlock({ code, lang }: { code: string; lang: CodeLang }) {
  const [html, setHtml] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    highlight(code, lang).then((h) => alive && setHtml(h)).catch(() => {});
    return () => { alive = false; };
  }, [code, lang]);
  if (!html) return <pre className="shiki overflow-x-auto bg-neutral-100 dark:bg-neutral-900"><code>{code}</code></pre>;
  // Shiki escapes the source text, so this HTML is safe.
  return <div className="text-left" dangerouslySetInnerHTML={{ __html: html }} />;
}
