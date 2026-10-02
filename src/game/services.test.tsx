import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import type { QuizApi } from "@/api/quiz-api";
import type { ProgressStore } from "@/progress/store";
import { GameServicesProvider, useGameServices, type GameServices } from "./services";

it("provides injected services", () => {
  const services: GameServices = { api: {} as QuizApi, progress: {} as ProgressStore, anonId: "anon-1" };
  const wrapper = ({ children }: { children: ReactNode }) => (
    <GameServicesProvider services={services}>{children}</GameServicesProvider>
  );
  const { result } = renderHook(() => useGameServices(), { wrapper });
  expect(result.current).toBe(services);
});

it("throws when used outside the provider", () => {
  vi.spyOn(console, "error").mockImplementation(() => {});
  expect(() => renderHook(() => useGameServices())).toThrow(/GameServicesProvider/);
});
