import { z } from "zod";
import { topicsKey, type ProgressStore, type SessionSummary } from "./store";

const KEY = "skewed:v1:progress";
const HISTORY_CAP = 200;
const Data = z.object({ bests: z.record(z.string(), z.number()), history: z.array(z.any()) });
type Data = { bests: Record<string, number>; history: SessionSummary[] };

export function browserStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem("skewed:v1:probe", "1");
    s.removeItem("skewed:v1:probe");
    return s;
  } catch {
    return null;
  }
}

export class LocalProgressStore implements ProgressStore {
  readonly persistent: boolean;
  private data: Data;

  constructor(private readonly storage: Storage | null) {
    this.persistent = storage !== null;
    this.data = this.read();
  }

  getPersonalBest(mode: "exam" | "survival", key: string): number | null {
    return this.data.bests[`${mode}:${key}`] ?? null;
  }

  recordSession(s: SessionSummary): { newBest: boolean } {
    let newBest = false;
    const score = s.mode === "survival" ? s.streak ?? 0 : s.mode === "exam" && s.answered ? Math.round((s.correct / s.answered) * 100) : null;
    if (score !== null) {
      const k = `${s.mode}:${topicsKey(s.topics)}`;
      const prev = this.data.bests[k];
      if (prev === undefined || score > prev) { this.data.bests[k] = score; newBest = true; }
    }
    this.data.history = [s, ...this.data.history].slice(0, HISTORY_CAP);
    this.write();
    return { newBest };
  }

  getHistory(limit: number): SessionSummary[] {
    return this.data.history.slice(0, limit);
  }

  private read(): Data {
    try {
      const raw = this.storage?.getItem(KEY);
      if (raw) return Data.parse(JSON.parse(raw)) as Data;
    } catch { /* corrupt -> reset */ }
    return { bests: {}, history: [] };
  }

  private write() {
    try { this.storage?.setItem(KEY, JSON.stringify(this.data)); } catch { /* quota/private mode: keep in memory */ }
  }
}
