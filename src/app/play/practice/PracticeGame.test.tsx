import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type QuizApi } from "@/api/quiz-api";
import { makeQuestion } from "@/engine/test-helpers";
import { GameServicesProvider } from "@/game/services";
import { LocalProgressStore } from "@/progress/local-store";
import { PracticeGame } from "./PracticeGame";

vi.mock("@/components/quiz/CodeBlock", () => ({ CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre> }));
// Options are shuffled; make it identity so option A is always `<id>-a`.
vi.mock("@/engine/shared", async (orig) => ({ ...(await orig<object>()), shuffle: <T,>(x: readonly T[]) => [...x] }));
const config = { mode: "practice" as const, topics: ["sql" as const], level: 1 as const, examLength: 10 as const, timerSeconds: null };

function renderWith(api: Partial<QuizApi>) {
  return render(
    <GameServicesProvider services={{ api: api as QuizApi, progress: new LocalProgressStore(null), anonId: "a" }}>
      <PracticeGame config={config} />
    </GameServicesProvider>,
  );
}

it("answer -> feedback with explanations -> next question -> pool exhausted", async () => {
  const getQuestions = vi.fn()
    .mockResolvedValueOnce([makeQuestion("q1", { title: "First" })])
    .mockResolvedValueOnce([]);
  const submitAnswer = vi.fn().mockResolvedValue({
    questionId: "q1", chosenOptionId: "q1-a", correct: true, correctOptionId: "q1-a",
    explanations: { "q1-a": "Because A", "q1-b": "nb", "q1-c": "nc", "q1-d": "nd" }, docsUrl: null,
  });
  renderWith({ getQuestions, submitAnswer });
  expect(await screen.findByRole("heading", { name: "First" })).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]);
  expect(await screen.findByText("Because A")).toBeInTheDocument();
  expect(screen.getByText(/1 \/ 1/)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /next/i }));
  expect(await screen.findByText(/seen all questions/i)).toBeInTheDocument();
  expect(getQuestions).toHaveBeenLastCalledWith({ topics: ["sql"], level: 1, exclude: ["q1"], limit: 1 });
});

it("shows retry on submit failure and recovers", async () => {
  const submitAnswer = vi.fn()
    .mockRejectedValueOnce(new ApiError("x", "network"))
    .mockResolvedValueOnce({ questionId: "q1", chosenOptionId: "q1-a", correct: false, correctOptionId: "q1-b", explanations: {}, docsUrl: null });
  renderWith({ getQuestions: vi.fn().mockResolvedValue([makeQuestion("q1")]), submitAnswer });
  await screen.findByRole("heading", { name: "q1" });
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]);
  await userEvent.click(await screen.findByRole("button", { name: /retry/i }));
  expect(await screen.findByText(/0 \/ 1/)).toBeInTheDocument();
});
