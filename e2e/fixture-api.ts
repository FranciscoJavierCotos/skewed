import { test as base, type Route } from "@playwright/test";
import { loadContent } from "../src/content/load";

/**
 * Stands in for the Supabase RPCs, backed by fixtures/content, so e2e never reads or writes the
 * production project (its bank is real content and `pnpm seed fixtures/content` would deactivate it).
 * Mirrors get_questions / submit_answer / report_question from supabase/migrations.
 */
const { questions, errors } = loadContent("fixtures/content");
if (errors.length) throw new Error(`invalid fixtures: ${errors.map((e) => `${e.file}: ${e.message}`).join("; ")}`);
const bank = questions.map(({ question: q }) => ({
  ...q,
  options: q.options.map((o, i) => ({ ...o, id: `${q.id}:${i}` })),
}));

const CORS = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "POST, OPTIONS" };
const json = (route: Route, body: unknown) => route.fulfill({ status: 200, headers: CORS, contentType: "application/json", body: JSON.stringify(body) });

function getQuestions(args: { p_topics: string[]; p_level: number | null; p_exclude: string[] | null; p_limit: number | null }) {
  const limit = Math.min(Math.max(args.p_limit ?? 1, 1), 50);
  return bank
    .filter((q) => q.status === "approved" && args.p_topics.includes(q.topic))
    .filter((q) => args.p_level === null || q.level === args.p_level)
    .filter((q) => !(args.p_exclude ?? []).includes(q.id))
    .sort(() => Math.random() - 0.5)
    .slice(0, limit)
    .map((q) => ({
      id: q.id, topic: q.topic, level: q.level, title: q.title, prompt: q.prompt,
      context: q.context ?? null, tags: q.tags,
      options: q.options.map((o) => ({ id: o.id, code: o.code })),
    }));
}

function submitAnswer(args: { p_question_id: string; p_option_id: string | null }) {
  const q = bank.find((x) => x.id === args.p_question_id);
  if (!q) throw new Error(`unknown question ${args.p_question_id}`);
  const correct = q.options.find((o) => o.correct)!;
  return {
    correct: args.p_option_id === correct.id,
    correct_option_id: correct.id,
    explanations: Object.fromEntries(q.options.map((o) => [o.id, o.explanation])),
    docs_url: q.docs_url ?? null,
  };
}

export const test = base.extend<{ fixtureApi: void }>({
  fixtureApi: [async ({ page }, use) => {
    await page.route("**/rest/v1/**", async (route) => {
      const req = route.request();
      if (req.method() === "OPTIONS") return route.fulfill({ status: 204, headers: CORS });
      const fn = new URL(req.url()).pathname.split("/rpc/")[1];
      const args = req.postDataJSON();
      if (fn === "get_questions") return json(route, getQuestions(args));
      if (fn === "submit_answer") return json(route, submitAnswer(args));
      if (fn === "report_question") return route.fulfill({ status: 204, headers: CORS });
      return route.fulfill({ status: 404, headers: CORS, body: `unmocked ${req.url()}` });
    });
    await use();
  }, { auto: true }],
});

export { expect } from "@playwright/test";
