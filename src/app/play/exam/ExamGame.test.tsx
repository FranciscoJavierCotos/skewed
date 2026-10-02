import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { QuizApi } from "@/api/quiz-api";
import { makeQuestion } from "@/engine/test-helpers";
import { GameServicesProvider } from "@/game/services";
import { LocalProgressStore } from "@/progress/local-store";
import { ExamGame } from "./ExamGame";

vi.mock("@/components/quiz/CodeBlock", () => ({ CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre> }));
// Options are shuffled; make it identity so option A is always `<id>-a`.
vi.mock("@/engine/shared", async (orig) => ({ ...(await orig<object>()), shuffle: <T,>(x: readonly T[]) => [...x] }));
const config = { mode: "exam" as const, topics: ["sql" as const], level: 1 as const, examLength: 10 as const, timerSeconds: null };

function renderWith(api: Partial<QuizApi>, progress = new LocalProgressStore(null)) {
  return render(
    <GameServicesProvider services={{ api: api as QuizApi, progress, anonId: "a" }}>
      <ExamGame config={config} />
    </GameServicesProvider>,
  );
}

const grade = vi.fn().mockImplementation(async ({ questionId, optionId }: { questionId: string; optionId: string | null }) => ({
  questionId, chosenOptionId: optionId, correct: optionId === `${questionId}-a`, correctOptionId: `${questionId}-a`,
  explanations: { [`${questionId}-a`]: `why ${questionId}` }, docsUrl: null,
}));

it("hides feedback during the exam, then shows review with score and shortfall", async () => {
  const qs = [makeQuestion("q1", { title: "One" }), makeQuestion("q2", { title: "Two" })];
  renderWith({ getQuestions: vi.fn().mockResolvedValue(qs), submitAnswer: grade });
  await screen.findByRole("heading", { name: "One" });
  expect(screen.getByText(/only 2 questions available/i)).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]); // correct
  await screen.findByRole("heading", { name: "Two" });
  expect(screen.queryByText("why q1")).not.toBeInTheDocument(); // no feedback mid-exam
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[1]); // wrong
  expect(await screen.findByText(/1 \/ 2 \(50%\)/)).toBeInTheDocument();
  expect(screen.getByText("why q1")).toBeInTheDocument();
  expect(screen.getByText("why q2")).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /by topic/i })).toBeInTheDocument();
  expect(screen.getByRole("heading", { name: /by level/i })).toBeInTheDocument();
});

it("records the session and announces a personal best", async () => {
  const progress = new LocalProgressStore(null);
  const record = vi.spyOn(progress, "recordSession");
  renderWith({ getQuestions: vi.fn().mockResolvedValue([makeQuestion("q1")]), submitAnswer: grade }, progress);
  await screen.findByRole("heading", { name: "q1" });
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]);
  expect(await screen.findByText(/new personal best/i)).toBeInTheDocument();
  expect(record).toHaveBeenCalledTimes(1);
  expect(record).toHaveBeenCalledWith(expect.objectContaining({ mode: "exam", answered: 1, correct: 1 }));
});

it("shows empty state when nothing matches", async () => {
  renderWith({ getQuestions: vi.fn().mockResolvedValue([]), submitAnswer: vi.fn() });
  expect(await screen.findByText(/no questions match/i)).toBeInTheDocument();
});

it("registers beforeunload only while answering", async () => {
  const add = vi.spyOn(window, "addEventListener");
  const remove = vi.spyOn(window, "removeEventListener");
  renderWith({ getQuestions: vi.fn().mockResolvedValue([makeQuestion("q1")]), submitAnswer: grade });
  await screen.findByRole("heading", { name: "q1" });
  expect(add.mock.calls.some(([t]) => t === "beforeunload")).toBe(true);
  await userEvent.click(screen.getAllByRole("button", { name: /^Option/ })[0]);
  await screen.findByText(/1 \/ 1 \(100%\)/);
  expect(remove.mock.calls.some(([t]) => t === "beforeunload")).toBe(true);
});
