import type { Level } from "@/domain/types";

export const SURVIVAL_STEP = 5;

export function survivalLevel(streak: number): Level {
  return Math.min(5, 1 + Math.floor(streak / SURVIVAL_STEP)) as Level;
}

export function shuffle<T>(items: readonly T[], rng: () => number = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
