import type { Level, PublicQuestion, Topic } from "@/domain/types";

export const RECYCLE_WINDOW = 20;
export type GetQuestionsFn = (p: { topics: Topic[]; level: Level | null; exclude: string[]; limit: number }) => Promise<PublicQuestion[]>;

export async function fetchSurvivalQuestion(
  getQuestions: GetQuestionsFn, topics: Topic[], level: Level, seenIds: string[],
): Promise<PublicQuestion | null> {
  for (let l = level; l <= 5; l++) {
    const [q] = await getQuestions({ topics, level: l as Level, exclude: seenIds, limit: 1 });
    if (q) return q;
  }
  if (seenIds.length <= RECYCLE_WINDOW) return null; // recycling would repeat the L5 query above
  const [q] = await getQuestions({ topics, level: 5, exclude: seenIds.slice(-RECYCLE_WINDOW), limit: 1 });
  return q ?? null;
}
