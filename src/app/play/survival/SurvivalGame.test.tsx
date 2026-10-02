import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuizApi } from "@/api/quiz-api";
import { makeQuestion } from "@/engine/test-helpers";
import { GameServicesProvider } from "@/game/services";
import { LocalProgressStore } from "@/progress/local-store";
import { SurvivalGame } from "./SurvivalGame";

vi.mock("@/components/quiz/CodeBlock", () => ({ CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre> }));
// Options are shuffled; make it identity so option A is always `<id>-a`.
vi.mock("@/engine/shared", async (orig) => ({ ...(await orig<object>()), shuffle: <T,>(x: readonly T[]) => [...x] }));
const config = { mode: "survival" as const, topics: ["sql" as const], level: 1 as const, examLength: 10 as const, timerSeconds: null };

const submitAnswer = vi.fn().mockImplementation(async ({ questionId, optionId }: { questionId: string; optionId: string }) => ({
  questionId, chosenOptionId: optionId, correct: optionId.endsWith("-a"), correctOptionId: `${questionId}-a`,
  explanations: { [`${questionId}-a`]: "why" }, docsUrl: null,
}));
const renderGame = (getQuestions: ReturnType<typeof vi.fn>, progress = new LocalProgressStore(null)) => {
  render(
    <GameServicesProvider services={{ api: { getQuestions, submitAnswer } as unknown as QuizApi, progress, anonId: "a" }}>
      <SurvivalGame config={config} />
    </GameServicesProvider>,
  );
  return progress;
};
const answerRight = async (id: string) => {
  await screen.findByRole("heading", { name: id });
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]);
  await userEvent.click(await screen.findByRole("button", { name: /next/i }));
};

it("stays at the chosen level, ends on a wrong answer, records the per-level best", async () => {
  let n = 0;
  const getQuestions = vi.fn().mockImplementation(async () => [makeQuestion(`q${n++}`)]);
  const progress = renderGame(getQuestions);
  for (let i = 0; i < 5; i++) await answerRight(`q${i}`);
  expect(getQuestions).toHaveBeenLastCalledWith(expect.objectContaining({ level: 1, exclude: ["q0", "q1", "q2", "q3", "q4"] }));
  await screen.findByRole("heading", { name: "q5" });
  expect(screen.getByText("Level 1")).toBeInTheDocument(); // HUD (QuestionView also shows "· Level 1")
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[1]);
  expect(await screen.findByText(/game over/i)).toBeInTheDocument();
  expect(screen.getByText(/streak: 5/i)).toBeInTheDocument();
  expect(screen.getByText(/new personal best/i)).toBeInTheDocument();
  expect(screen.getByText(/the question that got you/i)).toBeInTheDocument();
  expect(screen.getByText("why")).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /report question/i })).toBeInTheDocument();
  expect(progress.getPersonalBest("survival", "sql@1")).toBe(5);
});

it("clearing the level ends the run and offers a new run one level up", async () => {
  const getQuestions = vi.fn()
    .mockResolvedValueOnce([makeQuestion("q0")])
    .mockResolvedValueOnce([makeQuestion("q1")])
    .mockResolvedValue([]);
  const progress = renderGame(getQuestions);
  await answerRight("q0");
  await answerRight("q1");
  expect(await screen.findByText(/level 1 cleared/i)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /go to level 2/i })).toHaveAttribute("href", "/play/survival?topics=sql&level=2");
  expect(progress.getPersonalBest("survival", "sql@1")).toBe(2);
});

it("shows the empty message and records nothing when the level has no questions", async () => {
  const progress = renderGame(vi.fn().mockResolvedValue([]));
  expect(await screen.findByText(/no questions match/i)).toBeInTheDocument();
  expect(progress.getHistory(10)).toEqual([]);
});
