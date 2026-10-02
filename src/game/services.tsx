"use client";
import { createClient } from "@supabase/supabase-js";
import { createContext, useContext, useState, useSyncExternalStore, type ReactNode } from "react";
import type { QuizApi } from "@/api/quiz-api";
import { createSupabaseQuizApi } from "@/api/supabase-quiz-api";
import { getAnonId } from "@/progress/anon-id";
import { browserStorage, LocalProgressStore } from "@/progress/local-store";
import type { ProgressStore } from "@/progress/store";

export interface GameServices { api: QuizApi; progress: ProgressStore; anonId: string }
const Ctx = createContext<GameServices | null>(null);

function createDefaultServices(): GameServices {
  const storage = browserStorage();
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  return { api: createSupabaseQuizApi(client), progress: new LocalProgressStore(storage), anonId: getAnonId(storage) };
}

const noopSubscribe = () => () => {};

/**
 * Wraps /play/*. Pass `services` to inject fakes in tests.
 * The default services need the browser (localStorage, anon id), so without injected services
 * nothing renders on the server or during hydration; children mount on the client only.
 */
export function GameServicesProvider({ children, services }: { children: ReactNode; services?: GameServices }) {
  const isClient = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const [value] = useState(() => services ?? (typeof window === "undefined" ? null : createDefaultServices()));
  if (!value || (!services && !isClient)) return null;
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useGameServices(): GameServices {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGameServices must be used inside GameServicesProvider");
  return v;
}
