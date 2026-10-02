import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parse } from "yaml";
import { QuestionFileSchema, type QuestionFile } from "./schema";

export interface LoadedQuestion { file: string; question: QuestionFile }
export interface ContentError { file: string; message: string }

const LOCATION = /^(spark|sql|git)\/level-([1-5])\/([^/]+)\.yaml$/;

export function loadContent(rootDir: string): { questions: LoadedQuestion[]; errors: ContentError[] } {
  const questions: LoadedQuestion[] = [];
  const errors: ContentError[] = [];
  const seen = new Map<string, string>();
  const files = readdirSync(rootDir, { recursive: true, encoding: "utf8" })
    .map((f) => f.split(path.sep).join("/"))
    .filter((f) => f.endsWith(".yaml"))
    .sort();

  for (const file of files) {
    const fail = (message: string) => errors.push({ file, message });
    let raw: unknown;
    try {
      raw = parse(readFileSync(path.join(rootDir, file), "utf8"));
    } catch (e) {
      fail(`invalid YAML: ${(e as Error).message}`);
      continue;
    }
    const parsed = QuestionFileSchema.safeParse(raw);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) fail(`${issue.path.join(".") || "(root)"}: ${issue.message}`);
      continue;
    }
    const q = parsed.data;
    const before = errors.length;
    const loc = file.match(LOCATION);
    if (!loc || loc[1] !== q.topic || Number(loc[2]) !== q.level)
      fail(`folder must be ${q.topic}/level-${q.level}/`);
    else if (loc[3] !== q.id) fail(`filename must be ${q.id}.yaml`);
    const prev = seen.get(q.id);
    if (prev) fail(`duplicate id ${q.id} (also in ${prev})`);
    else seen.set(q.id, file);
    if (errors.length === before) questions.push({ file, question: q });
  }
  return { questions, errors };
}
