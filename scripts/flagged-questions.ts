import { createClient } from "@supabase/supabase-js";
import { flagQuestions, type QuestionStat } from "../src/content/flagged";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are required");

const db = createClient(url, key, { auth: { persistSession: false } });

async function main() {
  // question_stats is service-role only; one row per active question, so fetching it all is cheap.
  const { data, error } = await db.from("question_stats").select("*");
  if (error) throw new Error(`read question_stats failed: ${error.message}`);
  const flagged = flagQuestions((data ?? []) as QuestionStat[]);
  if (!flagged.length) {
    console.log(`No flagged questions (${data?.length ?? 0} active).`);
    return;
  }
  console.table(flagged);
}

void main();
