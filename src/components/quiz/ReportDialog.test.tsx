import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ApiError, type QuizApi } from "@/api/quiz-api";
import { ReportDialog } from "./ReportDialog";

const setup = (reportQuestion: QuizApi["reportQuestion"]) =>
  render(<ReportDialog api={{ reportQuestion } as QuizApi} anonId="a" questionId="q1" />);

it("submits reason and note", async () => {
  const report = vi.fn().mockResolvedValue(undefined);
  setup(report);
  await userEvent.click(screen.getByRole("button", { name: /report/i }));
  await userEvent.click(screen.getByLabelText(/ambiguous/i));
  await userEvent.type(screen.getByLabelText(/details/i), "two answers work");
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
  expect(report).toHaveBeenCalledWith({ anonId: "a", questionId: "q1", reason: "ambiguous", note: "two answers work" });
  expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
});

it("shows a friendly message when rate limited", async () => {
  setup(vi.fn().mockRejectedValue(new ApiError("x", "rate_limited")));
  await userEvent.click(screen.getByRole("button", { name: /report/i }));
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
  expect(await screen.findByText(/too many reports/i)).toBeInTheDocument();
});

it("shows a retryable message on other failures", async () => {
  const report = vi.fn().mockRejectedValueOnce(new ApiError("x", "network")).mockResolvedValueOnce(undefined);
  setup(report);
  await userEvent.click(screen.getByRole("button", { name: /report/i }));
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
  expect(await screen.findByText(/couldn't send/i)).toBeInTheDocument();
  await userEvent.click(screen.getByRole("button", { name: /send/i }));
  expect(await screen.findByText(/thanks/i)).toBeInTheDocument();
});

it("cancel closes the dialog", async () => {
  setup(vi.fn());
  await userEvent.click(screen.getByRole("button", { name: /report/i }));
  await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("limits the note to 500 characters", async () => {
  setup(vi.fn());
  await userEvent.click(screen.getByRole("button", { name: /report/i }));
  expect(screen.getByLabelText(/details/i)).toHaveAttribute("maxlength", "500");
});
