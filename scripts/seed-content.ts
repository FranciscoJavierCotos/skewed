import { createClient } from "@supabase/supabase-js";
import { loadContent } from "../src/content/load";
import { toRows } from "../src/content/to-rows";

const dir = process.argv[2] ?? "content";

// Validate before touching the database so a broken bank never gets half-seeded.
const { questions, errors } = loadContent(dir);
if (errors.length) {
  for (const e of errors) console.error(`✖ ${e.file}: ${e.message}`);
  process.exit(1);
}

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");

const db = createClient(url, key, { auth: { persistSession: false } });
const rows = questions.map((q) => toRows(q.question));

// Throw instead of process.exit() so open sockets close cleanly (exiting mid-request aborts Node on Windows).
const fail = (step: string, error: { message: string } | null) => {
  if (error) throw new Error(`${step} failed: ${error.message}`);
};

async function main() {
  if (rows.length) {
    const { error: qErr } = await db.from("questions").upsert(rows.map((r) => r.question), { onConflict: "id" });
    fail("upsert questions", qErr);
    // Conflict on (question_id, position) updates in place, so option ids stay stable.
    const { error: oErr } = await db
      .from("question_options")
      .upsert(rows.flatMap((r) => r.options), { onConflict: "question_id,position" });
    fail("upsert options", oErr);
  }
  // Questions removed from the repo are deactivated, never deleted: answer_events reference them.
  const ids = rows.map((r) => r.question.id);
  const deactivate = db.from("questions").update({ active: false });
  const { error: dErr } = ids.length
    ? await deactivate.not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`)
    : await deactivate.neq("id", "");
  fail("deactivate removed questions", dErr);

  const active = rows.filter((r) => r.question.active).length;
  console.log(`Seeded ${rows.length} questions (${active} active) from ${dir}`);
}

main().catch((e: Error) => {
  console.error(e.message);
  process.exitCode = 1;
});
