// Weekly triage rule for `pnpm content:flagged`: a question needs a look when players
// report it, or when enough attempts show it is far too hard or far too easy.
export const MIN_ATTEMPTS = 20;
export const LOW_ACCURACY_PCT = 25;
export const HIGH_ACCURACY_PCT = 95;

/** A row of the `public.question_stats` view. */
export interface QuestionStat {
  id: string;
  topic: string;
  level: number;
  title: string;
  attempts: number;
  accuracy_pct: number | null;
  open_reports: number;
}

const outOfBand = (s: QuestionStat): number => {
  if (s.attempts < MIN_ATTEMPTS || s.accuracy_pct === null) return 0;
  if (s.accuracy_pct < LOW_ACCURACY_PCT) return LOW_ACCURACY_PCT - s.accuracy_pct;
  if (s.accuracy_pct > HIGH_ACCURACY_PCT) return s.accuracy_pct - HIGH_ACCURACY_PCT;
  return 0;
};

export function flagQuestions(rows: QuestionStat[]): QuestionStat[] {
  return rows
    .map((r) => ({
      ...r,
      attempts: Number(r.attempts),
      accuracy_pct: r.accuracy_pct === null ? null : Number(r.accuracy_pct),
      open_reports: Number(r.open_reports),
    }))
    .filter((s) => s.open_reports > 0 || outOfBand(s) > 0)
    .sort((a, b) => b.open_reports - a.open_reports || outOfBand(b) - outOfBand(a));
}
