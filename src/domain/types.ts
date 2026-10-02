export const TOPICS = ["spark", "sql", "git"] as const;
export type Topic = (typeof TOPICS)[number];
export const LEVELS = [1, 2, 3, 4, 5] as const;
export type Level = (typeof LEVELS)[number];
export type Mode = "practice" | "exam" | "survival";
export const EXAM_LENGTHS = [10, 20, 40] as const;
export type ExamLength = (typeof EXAM_LENGTHS)[number];
export const EXAM_TIMER_SECONDS = 60;
export const REPORT_REASONS = ["wrong_answer", "ambiguous", "typo", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const DIALECTS = ["postgres", "snowflake", "bigquery", "spark-sql"] as const;

export const isTopic = (s: string): s is Topic => (TOPICS as readonly string[]).includes(s);
export const isLevel = (n: unknown): n is Level =>
  typeof n === "number" && (LEVELS as readonly number[]).includes(n);

export interface PublicOption { id: string; code: string }

export interface PublicQuestion {
  id: string;
  topic: Topic;
  level: Level;
  title: string;
  prompt: string;
  context: string | null;
  dialect: string | null;
  tags: string[];
  options: PublicOption[];
}

export interface AnswerResult {
  questionId: string;
  chosenOptionId: string | null; // null = timed out
  correct: boolean;
  correctOptionId: string;
  explanations: Record<string, string>; // optionId -> explanation
  docsUrl: string | null;
}

export interface SessionConfig {
  mode: Mode;
  topics: Topic[];
  level: Level | "mixed"; // ignored by survival
  examLength: ExamLength;
  timerSeconds: number | null;
}
