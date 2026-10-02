import {
  EXAM_LENGTHS, EXAM_TIMER_SECONDS, isLevel, isTopic,
  type ExamLength, type Level, type Mode, type SessionConfig, type Topic,
} from "@/domain/types";

export function parseSessionConfig(mode: Mode, params: URLSearchParams): SessionConfig | null {
  const topics = [...new Set((params.get("topics") ?? "").split(",").filter(Boolean))];
  if (topics.length === 0 || !topics.every(isTopic)) return null;
  const rawLevel = params.get("level") ?? (mode === "survival" ? "1" : "mixed");
  const level = rawLevel === "mixed" ? "mixed" : Number(rawLevel);
  if (level === "mixed" ? mode === "survival" : !isLevel(level)) return null; // survival needs a fixed level
  const examLength = Number(params.get("length") ?? 10);
  if (!(EXAM_LENGTHS as readonly number[]).includes(examLength)) return null;
  return {
    mode,
    topics: topics as Topic[],
    level: level as Level | "mixed",
    examLength: examLength as ExamLength,
    timerSeconds: params.get("timer") === "on" ? EXAM_TIMER_SECONDS : null,
  };
}

export function toSearchParams(c: SessionConfig): string {
  const p = new URLSearchParams({ topics: c.topics.join(","), level: String(c.level) });
  if (c.mode === "exam") {
    p.set("length", String(c.examLength));
    if (c.timerSeconds) p.set("timer", "on");
  }
  return p.toString();
}

export const levelParam = (level: Level | "mixed"): Level | null => (level === "mixed" ? null : level);
