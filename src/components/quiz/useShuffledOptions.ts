import { useMemo } from "react";
import type { PublicOption, PublicQuestion } from "@/domain/types";
import { shuffle } from "@/engine/shared";

export function useShuffledOptions(q: PublicQuestion | null): PublicOption[] {
  // eslint-disable-next-line react-hooks/exhaustive-deps -- reshuffle only when the question changes
  return useMemo(() => (q ? shuffle(q.options) : []), [q?.id]);
}
