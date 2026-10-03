import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AnswerResult } from "@/domain/types";
import { makeQuestion } from "@/engine/test-helpers";
import { QuestionView } from "./QuestionView";

vi.mock("./CodeBlock", () => ({ CodeBlock: ({ code }: { code: string }) => <pre>{code}</pre> }));
const q = makeQuestion("q1", { title: "Latest order", prompt: "Pick **one**" });

it("renders title, prompt and 4 lettered options", () => {
  render(<QuestionView question={q} options={q.options} result={null} disabled={false} onSelect={() => {}} />);
  expect(screen.getByRole("heading", { name: "Latest order" })).toBeInTheDocument();
  expect(screen.getByText("one", { selector: "strong" })).toBeInTheDocument();
  expect(screen.getAllByRole("button", { name: /^Option [A-D]/ })).toHaveLength(4);
});

it("calls onSelect with the option id; disabled blocks clicks", async () => {
  const onSelect = vi.fn();
  const { rerender } = render(<QuestionView question={q} options={q.options} result={null} disabled={false} onSelect={onSelect} />);
  await userEvent.click(screen.getByRole("button", { name: /^Option B/ }));
  expect(onSelect).toHaveBeenCalledWith("q1-b");
  rerender(<QuestionView question={q} options={q.options} result={null} disabled onSelect={onSelect} />);
  await userEvent.click(screen.getByRole("button", { name: /^Option C/ }));
  expect(onSelect).toHaveBeenCalledTimes(1);
});

it("in result mode marks correct/chosen and shows every explanation", () => {
  const result: AnswerResult = { questionId: "q1", chosenOptionId: "q1-b", correct: false, correctOptionId: "q1-a",
    explanations: { "q1-a": "A is right", "q1-b": "B is wrong", "q1-c": "C no", "q1-d": "D no" }, docsUrl: "https://docs.example" };
  render(<QuestionView question={q} options={q.options} result={result} disabled onSelect={() => {}} />);
  expect(screen.getByRole("button", { name: /^Option A.*correct answer/ })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /^Option B.*your answer/ })).toBeInTheDocument();
  for (const t of ["A is right", "B is wrong", "C no", "D no"]) expect(screen.getByText(t)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /docs/i })).toHaveAttribute("href", "https://docs.example");
  expect(screen.queryByText(/time ran out/i)).not.toBeInTheDocument();
});

it("renders no docs link for a non-https docsUrl", () => {
  const result: AnswerResult = { questionId: "q1", chosenOptionId: "q1-a", correct: true, correctOptionId: "q1-a",
    explanations: {}, docsUrl: "javascript:alert(1)" };
  render(<QuestionView question={q} options={q.options} result={result} disabled onSelect={() => {}} />);
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});

it("shows a time-ran-out notice when the answer timed out", () => {
  const result: AnswerResult = { questionId: "q1", chosenOptionId: null, correct: false, correctOptionId: "q1-a",
    explanations: {}, docsUrl: null };
  render(<QuestionView question={q} options={q.options} result={result} disabled onSelect={() => {}} />);
  expect(screen.getByText(/time ran out/i)).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /your answer/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("link")).not.toBeInTheDocument();
});
